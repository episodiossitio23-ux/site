import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import SiteHeader from '@/components/layout/SiteHeader';
import PayWithMercadoPago from '@/components/order/PayWithMercadoPago';
import { supabase } from '@/lib/supabase';
import { formatBRL, formatDate } from '@/lib/format';
import { navigate } from '@/lib/router';
import { STATUS_LABEL, type OrderStatus } from '@/lib/orderStatus';

interface OrderItemView {
  id: string;
  format_label: string;
  quantity: number;
  line_total_cents: number;
  original_name: string;
}

interface OrderView {
  order_number: number;
  status: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  delivery: {
    cep: string;
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  total_cents: number;
  shipping_cents: number;
  fulfillment_type: string;
  pickup_address: string;
  shipping_method_name: string;
  items: OrderItemView[];
}

function isOrderView(value: unknown): value is OrderView {
  if (!value || typeof value !== 'object') return false;
  const order = value as Partial<OrderView>;
  return typeof order.order_number === 'number' && Array.isArray(order.items) && typeof order.total_cents === 'number';
}

export default function OrderPage({ token }: { token: string }) {
  const [order, setOrder] = useState<OrderView | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [paymentEnabled, setPaymentEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.rpc('get_order_by_token', { p_token: token }),
      supabase.rpc('mercadopago_enabled'),
    ]).then(([orderResult, paymentResult]) => {
      if (!active) return;
      setPaymentEnabled(!paymentResult.error && paymentResult.data === true);
      const { data, error } = orderResult;
      if (error) setState('error');
      else if (!data) setState('missing');
      else if (isOrderView(data)) {
        setOrder(data);
        setState('ready');
      } else setState('error');
    });
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <main>
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-12 animate-fade-up">
        {state === 'loading' && (
          <div className="flex items-center justify-center gap-3 py-20 text-stone-600">
            <Loader2 className="animate-spin" size={20} /> Carregando pedido...
          </div>
        )}
        {state === 'missing' && (
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
            <p className="font-display text-2xl text-stone-900">Pedido não encontrado</p>
            <p className="mt-2 text-sm text-stone-500">Confira o link recebido após a compra.</p>
          </div>
        )}
        {state === 'error' && (
          <div className="rounded-3xl bg-rose-50 p-10 text-center text-rose-700">
            Não foi possível carregar o pedido agora. Tente novamente em instantes.
          </div>
        )}
        {state === 'ready' && order && (
          <div className="space-y-6">
            <div className="rounded-3xl bg-white p-8 shadow-sm">
              <CheckCircle2 className="text-sage-600" size={36} />
              <p className="mt-4 font-display text-3xl text-stone-900">Pedido #{order.order_number} recebido</p>
              <p className="mt-2 text-stone-600">
                Feito em {formatDate(order.created_at)} · {STATUS_LABEL[order.status as OrderStatus] ?? order.status}
              </p>
            </div>

            <div className="rounded-3xl bg-white p-8 shadow-sm">
              <p className="font-display text-xl text-stone-900">Fotografias</p>
              <ul className="mt-4 divide-y divide-stone-100">
                {order.items.map((item) => (
                  <li key={item.id} className="flex justify-between py-3 text-sm">
                    <span className="text-stone-700">
                      {item.quantity}x {item.format_label} <span className="text-stone-400">({item.original_name})</span>
                    </span>
                    <span className="font-medium">{formatBRL(item.line_total_cents)}</span>
                  </li>
                ))}
              </ul>
              {order.shipping_cents > 0 && (
                <div className="mt-4 flex justify-between text-sm text-stone-700">
                  <span>Frete</span>
                  <span>{formatBRL(order.shipping_cents)}</span>
                </div>
              )}
              <div className="mt-4 flex justify-between border-t border-stone-200 pt-4 text-lg font-semibold">
                <span>Total</span>
                <span>{formatBRL(order.total_cents)}</span>
              </div>
            </div>

            {paymentEnabled && order.status === 'aguardando_pagamento' && <PayWithMercadoPago token={token} />}

            <div className="rounded-3xl bg-white p-8 shadow-sm text-sm text-stone-700">
              {order.fulfillment_type === 'retirada' ? (
                <>
                  <p className="font-display text-xl text-stone-900">Retirada na loja</p>
                  <p className="mt-3">{order.pickup_address}</p>
                </>
              ) : (
                <>
                  <p className="font-display text-xl text-stone-900">Entrega</p>
                  <p className="mt-3">
                    {order.delivery.street}, {order.delivery.number}
                    {order.delivery.complement ? ` - ${order.delivery.complement}` : ''}
                  </p>
                  <p>
                    {order.delivery.neighborhood} - {order.delivery.city}/{order.delivery.state} - CEP {order.delivery.cep}
                  </p>
                  {order.shipping_method_name && <p className="mt-1 text-stone-500">Envio: {order.shipping_method_name}</p>}
                </>
              )}
              <p className="mt-3 text-stone-500">E-mail do pedido: {order.customer_email}.</p>
            </div>

            <button onClick={() => navigate('/')} className="text-sm text-clay-700 transition hover:underline">
              Voltar para a página inicial
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
