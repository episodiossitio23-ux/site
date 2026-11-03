import type { AdminOrder } from '@/types/order';
import type { OrderStatus } from '@/lib/orderStatus';

const IN_PRODUCTION: OrderStatus[] = [
  'pagamento_aprovado',
  'aguardando_producao',
  'em_producao',
  'aguardando_conferencia',
];
const REVENUE_EXCLUDED: OrderStatus[] = ['aguardando_pagamento', 'cancelado'];

export interface OrderStats {
  today: number;
  inProduction: number;
  readyToShip: number;
  monthRevenueCents: number;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function computeOrderStats(orders: AdminOrder[], now: Date = new Date()): OrderStats {
  const active = orders.filter((o) => o.status !== 'cancelado');
  return {
    today: active.filter((o) => isSameDay(new Date(o.created_at), now)).length,
    inProduction: orders.filter((o) => IN_PRODUCTION.includes(o.status)).length,
    readyToShip: orders.filter((o) => o.status === 'pronto_envio').length,
    monthRevenueCents: orders
      .filter((o) => !REVENUE_EXCLUDED.includes(o.status))
      .filter((o) => {
        const created = new Date(o.created_at);
        return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
      })
      .reduce((sum, o) => sum + o.total_cents, 0),
  };
}
