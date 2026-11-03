import { useEffect, useState } from 'react';
import { ChevronRight, Package, Loader2 } from 'lucide-react';
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
    <ul className="space-y-3">
      {orders.map((order) => (
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
  );
}

export default function MyOrdersPage() {
  return <AccountShell>{() => <OrdersList />}</AccountShell>;
}
