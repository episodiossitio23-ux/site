import { useEffect, useState } from 'react';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { supabase } from '@/lib/supabase';
import { createZipBlob, downloadBlob, type ArchiveEntry } from '@/lib/archive';
import { formatBRL, formatDate } from '@/lib/format';
import { navigate } from '@/lib/router';
import { ORDER_STATUSES, STATUS_LABEL, type OrderStatus } from '@/lib/orderStatus';
import type { AdminOrder, AdminOrderItem } from '@/types/order';

type FileKind = 'original' | 'print';

function safeFileName(name: string): string {
  return name.replace(/[^\w.-]+/g, '_');
}

function archiveNameFor(item: AdminOrderItem, kind: FileKind): string {
  const position = String(item.position).padStart(2, '0');
  if (kind === 'original') return `${position}-${safeFileName(item.original_name)}`;
  return `${position}-${safeFileName(item.format_label)}-x${item.quantity}.jpg`;
}

export default function AdminOrderDetailPage({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [items, setItems] = useState<AdminOrderItem[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [zipping, setZipping] = useState<FileKind | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const [orderResult, itemsResult] = await Promise.all([
        supabase.from('orders').select('*').eq('id', orderId).maybeSingle(),
        supabase.from('order_items').select('*').eq('order_id', orderId).order('position'),
      ]);
      if (!active) return;
      if (orderResult.error || itemsResult.error) {
        setState('error');
        return;
      }
      if (!orderResult.data) {
        setState('missing');
        return;
      }
      setOrder(orderResult.data as AdminOrder);
      setItems((itemsResult.data as AdminOrderItem[]) ?? []);
      setState('ready');
    })();
    return () => {
      active = false;
    };
  }, [orderId]);

  const downloadFile = async (item: AdminOrderItem, kind: FileKind) => {
    const key = `${item.id}-${kind}`;
    const path = kind === 'original' ? item.original_path : item.print_path;
    setDownloading(key);
    setDownloadError(null);
    const { data, error } = await supabase.storage.from('print-files').createSignedUrl(path, 300);
    setDownloading(null);
    if (error || !data?.signedUrl) {
      setDownloadError('Não foi possível gerar o download deste arquivo.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const downloadZip = async (kind: FileKind) => {
    if (!order) return;
    setZipping(kind);
    setDownloadError(null);
    try {
      const entries: ArchiveEntry[] = [];
      for (const item of items) {
        const path = kind === 'original' ? item.original_path : item.print_path;
        const { data, error } = await supabase.storage.from('print-files').createSignedUrl(path, 300);
        if (error || !data?.signedUrl) throw new Error('signed-url');
        const response = await fetch(data.signedUrl);
        if (!response.ok) throw new Error('fetch');
        entries.push({ name: archiveNameFor(item, kind), data: new Uint8Array(await response.arrayBuffer()) });
      }
      downloadBlob(createZipBlob(entries), `pedido-${order.order_number}-${kind}.zip`);
    } catch {
      setDownloadError('Não foi possível montar o arquivo ZIP. Tente novamente.');
    } finally {
      setZipping(null);
    }
  };

  const changeStatus = async (status: OrderStatus) => {
    if (!order) return;
    const { data, error } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', order.id)
      .select('id')
      .maybeSingle();
    if (error || !data) {
      setDownloadError('Não foi possível atualizar o status do pedido.');
      return;
    }
    setOrder({ ...order, status });
  };

  return (
    <AdminShell>
      <main className="mx-auto max-w-6xl px-6 py-10 animate-fade-in">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-1.5 text-sm text-stone-600 transition hover:text-stone-900"
        >
          <ArrowLeft size={16} /> Voltar aos pedidos
        </button>

        {state === 'loading' && (
          <div className="flex items-center gap-3 py-20 text-stone-500">
            <Loader2 className="animate-spin" size={18} /> Carregando pedido...
          </div>
        )}
        {state === 'missing' && <p className="mt-10 text-stone-600">Pedido não encontrado.</p>}
        {state === 'error' && (
          <p className="mt-10 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
            Não foi possível carregar o pedido. Tente novamente.
          </p>
        )}

        {state === 'ready' && order && (
          <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
            <section className="space-y-6">
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <h1 className="font-display text-3xl text-stone-900">Pedido #{order.order_number}</h1>
                <p className="mt-1 text-sm text-stone-500">Feito em {formatDate(order.created_at)}</p>
              </div>

              {downloadError && <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{downloadError}</p>}

              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-xl text-stone-900">Fotografias</h2>
                  <div className="flex gap-2">
                    {(['original', 'print'] as FileKind[]).map((kind) => (
                      <button
                        key={kind}
                        onClick={() => void downloadZip(kind)}
                        disabled={zipping !== null || items.length === 0}
                        className="flex items-center gap-1.5 rounded-full bg-stone-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-clay-600 disabled:opacity-60"
                      >
                        {zipping === kind ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        {kind === 'original' ? 'Originais (ZIP)' : 'Para impressão (ZIP)'}
                      </button>
                    ))}
                  </div>
                </div>
                <ul className="mt-4 divide-y divide-stone-100">
                  {items.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                      <div>
                        <p className="font-medium text-stone-900">
                          {item.position}. {item.format_label} x{item.quantity}
                        </p>
                        <p className="text-sm text-stone-500">{item.original_name}</p>
                        {item.caption && <p className="mt-1 text-sm italic text-stone-600">"{item.caption}"</p>}
                      </div>
                      <div className="flex gap-2">
                        {(['original', 'print'] as FileKind[]).map((kind) => (
                          <button
                            key={kind}
                            onClick={() => void downloadFile(item, kind)}
                            disabled={downloading === `${item.id}-${kind}`}
                            className="flex items-center gap-1.5 rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium transition hover:bg-stone-100 disabled:opacity-60"
                          >
                            {downloading === `${item.id}-${kind}` ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Download size={14} />
                            )}
                            {kind === 'original' ? 'Original' : 'Para impressão'}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
                {order.shipping_cents > 0 && (
                  <div className="mt-4 flex justify-between text-sm">
                    <span>Frete {order.shipping_method_name && `(${order.shipping_method_name})`}</span>
                    <span>{formatBRL(order.shipping_cents)}</span>
                  </div>
                )}
                <div className="mt-4 flex justify-between border-t border-stone-200 pt-4 font-semibold">
                  <span>Total</span>
                  <span>{formatBRL(order.total_cents)}</span>
                </div>
              </div>
            </section>

            <aside className="h-fit space-y-6">
              <div className="rounded-3xl bg-white p-6 shadow-sm">
                <label className="block text-sm font-medium text-stone-700">Status</label>
                <select
                  value={order.status}
                  onChange={(e) => void changeStatus(e.target.value as OrderStatus)}
                  className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                >
                  {ORDER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-3xl bg-white p-6 text-sm text-stone-700 shadow-sm">
                <p className="font-display text-lg text-stone-900">Cliente</p>
                <p className="mt-3">{order.customer_name}</p>
                <p>{order.customer_email}</p>
                <p>{order.customer_phone}</p>
                <p className="mt-4 font-display text-lg text-stone-900">
                  {order.fulfillment_type === 'retirada' ? 'Retirada na loja' : 'Entrega'}
                </p>
                {order.fulfillment_type === 'retirada' ? (
                  <p className="mt-3">{order.pickup_address}</p>
                ) : (
                  <>
                    <p className="mt-3">
                      {order.delivery_street}, {order.delivery_number}
                      {order.delivery_complement ? ` - ${order.delivery_complement}` : ''}
                    </p>
                    <p>
                      {order.delivery_neighborhood} - {order.delivery_city}/{order.delivery_state}
                    </p>
                    <p>CEP {order.delivery_cep}</p>
                  </>
                )}
              </div>
            </aside>
          </div>
        )}
      </main>
    </AdminShell>
  );
}
