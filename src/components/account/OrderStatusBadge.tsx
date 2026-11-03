import type { OrderStatus } from '@/lib/orderStatus';
import { STATUS_LABEL } from '@/lib/orderStatus';

const STATUS_STYLE: Record<OrderStatus, string> = {
  aguardando_pagamento: 'bg-amber-50 text-amber-700',
  pagamento_aprovado: 'bg-sage-50 text-sage-700',
  aguardando_producao: 'bg-stone-100 text-stone-700',
  em_producao: 'bg-clay-50 text-clay-700',
  aguardando_conferencia: 'bg-clay-50 text-clay-700',
  pronto_envio: 'bg-sage-50 text-sage-700',
  enviado: 'bg-sage-100 text-sage-700',
  entregue: 'bg-sage-100 text-sage-700',
  cancelado: 'bg-rose-50 text-rose-700',
};

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[status] ?? 'bg-stone-100 text-stone-700'}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
