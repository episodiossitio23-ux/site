import { useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import OrderStatsCards from '@/components/admin/OrderStatsCards';
import { supabase } from '@/lib/supabase';
import { formatBRL, formatDate } from '@/lib/format';
import { navigate } from '@/lib/router';
import { downloadOrdersCsv } from '@/lib/ordersCsv';
import { computeOrderStats } from '@/lib/orderStats';
import { ORDER_STATUSES, STATUS_LABEL, type OrderStatus } from '@/lib/orderStatus';
import type { AdminOrder } from '@/types/order';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'todos' | 'operacao'>('todos');
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error: queryError }) => {
        if (!active) return;
        if (queryError) setError('Não foi possível carregar os pedidos.');
        else setOrders((data as AdminOrder[]) ?? []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => computeOrderStats(orders), [orders]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter === 'operacao' && (order.status === 'entregue' || order.status === 'cancelado')) return false;
      if (statusFilter !== 'todos' && statusFilter !== 'operacao' && order.status !== statusFilter) return false;
      if (!term) return true;
      return (
        String(order.order_number).includes(term) ||
        order.customer_name.toLowerCase().includes(term) ||
        order.customer_email.toLowerCase().includes(term)
      );
    });
  }, [orders, statusFilter, search]);

  const changeStatus = async (order: AdminOrder, status: OrderStatus) => {
    setSavingId(order.id);
    setError(null);
    const { data, error: updateError } = await supabase
      .from('orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', order.id)
      .select('id')
      .maybeSingle();
    setSavingId(null);
    if (updateError || !data) {
      setError(`Não foi possível atualizar o pedido #${order.order_number}.`);
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)));
  };

  return (
    <AdminShell>
      <main className="mx-auto max-w-6xl px-6 py-10 animate-fade-in">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-stone-900">Pedidos</h1>
            <p className="mt-1 text-sm text-stone-500">{orders.length} pedido(s) registrados</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Número, nome ou e-mail"
                className="w-56 rounded-xl border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-clay-300"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'todos' | 'operacao')}
              className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
            >
              <option value="todos">Todos os status</option>
              <option value="operacao">Fila operacional</option>
              {ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABEL[status]}
                </option>
              ))}
            </select>
            <button
              onClick={() => downloadOrdersCsv(visible)}
              disabled={visible.length === 0}
              className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm transition hover:bg-stone-50 disabled:opacity-50"
            >
              <Download size={16} /> Exportar CSV
            </button>
          </div>
        </div>

        {!loading && orders.length > 0 && <OrderStatsCards stats={stats} />}
        {!loading && orders.length > 0 && (
          <p className="mt-5 text-sm text-stone-500">
            Mostrando <span className="font-medium text-stone-700">{visible.length}</span> de {orders.length} pedido(s)
          </p>
        )}
        {error && <p className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
        {loading && <p className="mt-10 text-stone-500">Carregando pedidos...</p>}

        {!loading && orders.length === 0 && !error && (
          <div className="mt-10 rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center text-sm text-stone-500">
            Nenhum pedido recebido ainda. Quando um cliente finalizar uma compra, ela aparecerá aqui.
          </div>
        )}

        {!loading && orders.length > 0 && visible.length === 0 && (
          <p className="mt-10 text-center text-sm text-stone-500">Nenhum pedido corresponde aos filtros.</p>
        )}

        {visible.length > 0 && (
          <div className="mt-6 overflow-x-auto rounded-3xl bg-white shadow-sm">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-5 py-3">Pedido</th>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Data</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {visible.map((order) => (
                  <tr key={order.id} className="transition hover:bg-stone-50">
                    <td className="px-5 py-4 font-medium text-stone-900">#{order.order_number}</td>
                    <td className="px-5 py-4 text-stone-700">{order.customer_name}</td>
                    <td className="px-5 py-4 text-stone-600">{formatDate(order.created_at)}</td>
                    <td className="px-5 py-4 font-medium">{formatBRL(order.total_cents)}</td>
                    <td className="px-5 py-4">
                      <select
                        value={order.status}
                        disabled={savingId === order.id}
                        onChange={(e) => void changeStatus(order, e.target.value as OrderStatus)}
                        className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm disabled:opacity-60"
                      >
                        {ORDER_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {STATUS_LABEL[status]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => navigate(`/admin/pedidos/${order.id}`)}
                        className="rounded-full border border-stone-300 px-4 py-1.5 text-xs font-medium transition hover:bg-stone-100"
                      >
                        Ver detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </AdminShell>
  );
}
