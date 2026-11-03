import { formatDate } from '@/lib/format';
import { STATUS_LABEL } from '@/lib/orderStatus';
import type { AdminOrder } from '@/types/order';

const HEADERS = [
  'Pedido',
  'Data',
  'Cliente',
  'E-mail',
  'Telefone',
  'Endereço',
  'Status',
  'Total (R$)',
];

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function escapeCell(value: string): string {
  const safe = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function formatAddress(order: AdminOrder): string {
  const complement = order.delivery_complement ? ` - ${order.delivery_complement}` : '';
  return `${order.delivery_street}, ${order.delivery_number}${complement} - ${order.delivery_neighborhood}, ${order.delivery_city}/${order.delivery_state} - CEP ${order.delivery_cep}`;
}

export function buildOrdersCsv(orders: AdminOrder[]): string {
  const rows = orders.map((order) =>
    [
      `#${order.order_number}`,
      formatDate(order.created_at),
      order.customer_name,
      order.customer_email,
      order.customer_phone,
      formatAddress(order),
      STATUS_LABEL[order.status],
      (order.total_cents / 100).toFixed(2).replace('.', ','),
    ].map(escapeCell).join(';'),
  );
  return [HEADERS.map(escapeCell).join(';'), ...rows].join('\r\n');
}

export function downloadOrdersCsv(orders: AdminOrder[]) {
  const blob = new Blob(['\uFEFF' + buildOrdersCsv(orders)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pedidos-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
