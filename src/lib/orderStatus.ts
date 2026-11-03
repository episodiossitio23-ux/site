export const ORDER_STATUSES = [
  'aguardando_pagamento',
  'pagamento_aprovado',
  'aguardando_producao',
  'em_producao',
  'aguardando_conferencia',
  'pronto_envio',
  'enviado',
  'entregue',
  'cancelado',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  aguardando_pagamento: 'Aguardando pagamento',
  pagamento_aprovado: 'Pagamento aprovado',
  aguardando_producao: 'Aguardando produção',
  em_producao: 'Em produção',
  aguardando_conferencia: 'Aguardando conferência',
  pronto_envio: 'Pronto para envio',
  enviado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};
