import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, RotateCcw } from 'lucide-react';
import AccountShell from '@/components/account/AccountShell';
import OrderProgress from '@/components/account/OrderProgress';
import OrderStatusBadge from '@/components/account/OrderStatusBadge';
import { useFormats } from '@/hooks/useFormats';
import { useStore } from '@/context/StoreContext';
import { supabase } from '@/lib/supabase';
import { formatBRL, formatDate } from '@/lib/format';
import { navigate } from '@/lib/router';
import { loadRepeatablePhotos } from '@/lib/repeatOrder';
import type { OrderStatus } from '@/lib/orderStatus';
import type { CustomerOrder, CustomerOrderItem } from '@/types/order';

const ORDER_COLUMNS =
  'id,order_number,status,total_cents,shipping_cents,fulfillment_type,shipping_method_name,pickup_address,tracking_code,delivery_street,delivery_number,delivery_complement,delivery_neighborhood,delivery_city,delivery_state,delivery_cep,created_at';
const ITEM_COLUMNS = 'id,format_id,format_label,quantity,line_total_cents,caption,caption_style,crop_settings,original_name,original_path';

function OrderDetail({ orderId }: { orderId: string }) {
  const { addPhotos } = useStore();
  const { formats, loading: formatsLoading } = useFormats();
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [items, setItems] = useState<CustomerOrderItem[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [repeating, setRepeating] = useState(false);
  const [repeatMessage, setRepeatMessage] = useState<{ type: 'error' | 'warning'; text: string } | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from('orders').select(ORDER_COLUMNS).eq('id', orderId).maybeSingle(),
      supabase.from('order_items').select(ITEM_COLUMNS).eq('order_id', orderId).order('position'),
    ]).then(([orderResult, itemsResult]) => {
      if (!active) return;
      if (orderResult.error || itemsResult.error || !Array.isArray(itemsResult.data)) {
        setState('error');
        return;
      }
      if (!orderResult.data) {
        setState('missing');
        return;
      }
      setOrder(orderResult.data as CustomerOrder);
      setItems(itemsResult.data as CustomerOrderItem[]);
      setState('ready');
    });
    return () => {
      active = false;
    };
  }, [orderId]);

  const handleRepeat = async () => {
    setRepeating(true);
    setRepeatMessage(null);
    setSkipped([]);
    try {
      const result = await loadRepeatablePhotos(items, formats);
      if (result.photos.length === 0) {
        setRepeatMessage({ type: 'error', text: 'Não foi possível recuperar as fotos deste pedido. Tente novamente.' });
        return;
      }
      addPhotos(result.photos);
      if (result.skipped.length > 0) {
        setSkipped(result.skipped);
        setRepeatMessage({ type: 'warning', text: 'Algumas fotos não puderam ser recuperadas e ficaram de fora do carrinho:' });
        return;
      }
      navigate('/carrinho');
    } catch {
      setRepeatMessage({ type: 'error', text: 'Não foi possível repetir o pedido agora. Verifique sua conexão.' });
    } finally {
      setRepeating(false);
    }
  };

  if (state === 'loading') {
    return (
      <div className="flex items-center gap-3 py-16 text-stone-500">
        <Loader2 className="animate-spin" size={18} /> Carregando pedido...
      </div>
    );
  }

  if (state === 'missing' || state === 'error' || !order) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
        <p className="font-display text-2xl text-stone-900">
          {state === 'missing' ? 'Pedido não encontrado' : 'Não foi possível carregar o pedido'}
        </p>
        <button onClick={() => navigate('/meus-pedidos')} className="mt-6 text-sm text-clay-700 transition hover:underline">
          Voltar para meus pedidos
        </button>
      </div>
    );
  }

  const status = order.status as OrderStatus;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/meus-pedidos')} className="flex items-center gap-1.5 text-sm text-stone-600 transition hover:text-stone-900">
        <ArrowLeft size={16} /> Voltar para meus pedidos
      </button>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl text-stone-900">Pedido #{order.order_number}</h2>
                <p className="mt-1 text-sm text-stone-500">Feito em {formatDate(order.created_at)}</p>
              </div>
              <OrderStatusBadge status={status} />
            </div>
            <div className="mt-8">
              <OrderProgress status={status} />
            </div>
            {order.tracking_code && (
              <div className="mt-6 rounded-2xl bg-sage-50 p-4 text-sm text-sage-700">
                Código de rastreio: <span className="font-semibold tracking-wide">{order.tracking_code}</span>
              </div>
            )}
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
            <h3 className="font-display text-xl text-stone-900">Fotografias</h3>
            <ul className="mt-4 divide-y divide-stone-100">
              {items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4 py-4 text-sm">
                  <div>
                    <p className="font-medium text-stone-900">
                      {item.quantity}x {item.format_label}
                    </p>
                    <p className="text-stone-500">{item.original_name}</p>
                    {item.caption && <p className="mt-1 italic text-stone-600">"{item.caption}"</p>}
                  </div>
                  <span className="flex-none font-medium text-stone-900">{formatBRL(item.line_total_cents)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 space-y-2 border-t border-stone-200 pt-4 text-sm text-stone-700">
              {order.shipping_cents > 0 && (
                <div className="flex justify-between">
                  <span>Frete {order.shipping_method_name && `(${order.shipping_method_name})`}</span>
                  <span>{formatBRL(order.shipping_cents)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold text-stone-900">
                <span>Total</span>
                <span>{formatBRL(order.total_cents)}</span>
              </div>
            </div>
          </section>
        </div>

        <aside className="h-fit space-y-6">
          <section className="rounded-3xl bg-white p-6 text-sm text-stone-700 shadow-sm">
            <p className="font-display text-lg text-stone-900">{order.fulfillment_type === 'retirada' ? 'Retirada na loja' : 'Entrega'}</p>
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
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="font-display text-lg text-stone-900">Repetir pedido</p>
            <p className="mt-2 text-sm text-stone-600">As mesmas fotos voltam ao carrinho com o formato, a quantidade e as personalizações deste pedido.</p>
            {repeatMessage && (
              <div className={`mt-4 rounded-xl p-3 text-sm ${repeatMessage.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                <p>{repeatMessage.text}</p>
                {skipped.length > 0 && (
                  <ul className="mt-2 list-disc pl-5">
                    {skipped.map((name, index) => (
                      <li key={`${name}-${index}`}>{name}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {repeatMessage?.type === 'warning' && (
              <button
                onClick={() => navigate('/carrinho')}
                className="mt-4 w-full rounded-full bg-stone-900 py-2.5 text-sm font-medium text-white transition hover:bg-clay-600"
              >
                Ver carrinho
              </button>
            )}
            {repeatMessage?.type !== 'warning' && (
              <button
                onClick={() => void handleRepeat()}
                disabled={repeating || formatsLoading || items.length === 0}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-clay-500 py-2.5 text-sm font-medium text-white transition hover:bg-clay-600 disabled:opacity-60"
              >
                {repeating ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                {repeating ? 'Preparando fotos...' : 'Repetir este pedido'}
              </button>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

export default function MyOrderDetailPage({ orderId }: { orderId: string }) {
  return <AccountShell>{() => <OrderDetail orderId={orderId} />}</AccountShell>;
}
