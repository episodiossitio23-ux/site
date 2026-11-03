import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Package, Loader2, Search } from 'lucide-react';
import AccountShell from '@/components/account/AccountShell';
import OrderStatusBadge from '@/components/account/OrderStatusBadge';
import { supabase } from '@/lib/supabase';
import { formatBRL, formatDate } from '@/lib/format';
import { navigate } from '@/lib/router';
import type { OrderStatus } from '@/lib/orderStatus';
import type { CustomerOrder } from '@/types/order';

const ORDER_COLUMNS =
  'id,order_number,status,total_cents,shipping_cents,fulfillment_type,shipping_method_name,pickup_address,tracking_code,delivery_street,delivery_number,delivery_complement,delivery_neighborhood,delivery_city,delivery_state,delivery_cep,created_at';

function OrdersList() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'todos' | 'ativos' | 'entregues' | 'cancelados'>('todos');

  useEffect(() => {
    let active = true;
    supabase
      .from('orders')
      .select(ORDER_COLUMNS)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !Array.isArray(data)) {
          setState('error');
          return;
        }
        setOrders(data as CustomerOrder[]);
        setState('ready');
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesQuery = !normalizedQuery || String(order.order_number).includes(normalizedQuery) || order.status.replace(/_/g, ' ').includes(normalizedQuery);
      const matchesFilter =
        filter === 'todos' ||
        (filter === 'ativos' && order.status !== 'entregue' && order.status !== 'cancelado') ||
        (filter === 'entregues' && order.status === 'entregue') ||
        (filter === 'cancelados' && order.status === 'cancelado');
      return matchesQuery && matchesFilter;
    });
  }, [filter, orders, query]);

  if (state === 'loading') {
    return (
      <div className="flex items-center gap-3 py-16 text-stone-500">
        <Loader2 className="animate-spin" size={18} /> Carregando seus pedidos...
      </div>
    );
  }

  if (state === 'error') {
    return <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">Não foi possível carregar seus pedidos. Tente novamente em instantes.</p>;
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-3xl bg-white px-6 py-16 text-center shadow-sm">
        <Package className="text-stone-400" size={32} />
        <p className="mt-4 font-display text-2xl text-stone-900">Você ainda não tem pedidos</p>
        <p className="mt-2 max-w-sm text-sm text-stone-600">Quando você revelar suas fotos, o pedido aparece aqui para acompanhar.</p>
        <button
          onClick={() => navigate('/revelar')}
          className="mt-6 rounded-full bg-clay-500 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-clay-600"
        >
          Revelar minhas fotos
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-3xl bg-stone-100 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Buscar pedido</span>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar pelo número ou status"
              className="w-full rounded-xl border border-stone-300 bg-white py-2.5 pl-10 pr-3 text-sm text-stone-900 outline-none transition focus:border-clay-500 focus:ring-2 focus:ring-clay-200"
            />
          </label>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as typeof filter)}
            aria-label="Filtrar pedidos"
            className="rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-700 outline-none focus:border-clay-500 focus:ring-2 focus:ring-clay-200"
          >
            <option value="todos">Todos os pedidos</option>
            <option value="ativos">Em andamento</option>
            <option value="entregues">Entregues</option>
            <option value="cancelados">Cancelados</option>
          </select>
        </div>
        <p className="mt-3 text-xs text-stone-500">{visibleOrders.length} de {orders.length} pedido(s)</p>
      </div>

      {visibleOrders.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
          Nenhum pedido corresponde à sua busca.
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {visibleOrders.map((order) => (
        <li key={order.id}>
          <button
            onClick={() => navigate(`/meus-pedidos/${order.id}`)}
            className="group flex w-full items-center justify-between gap-4 rounded-2xl bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="space-y-2">
              <p className="font-display text-lg text-stone-900">Pedido #{order.order_number}</p>
              <p className="text-sm text-stone-500">
                {formatDate(order.created_at)} · {formatBRL(order.total_cents)}
              </p>
              <OrderStatusBadge status={order.status as OrderStatus} />
            </div>
            <ChevronRight className="flex-none text-stone-400 transition group-hover:translate-x-0.5 group-hover:text-stone-700" size={20} />
          </button>
        </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function MyOrdersPage() {
  return <AccountShell>{() => <OrdersList />}</AccountShell>;
}
