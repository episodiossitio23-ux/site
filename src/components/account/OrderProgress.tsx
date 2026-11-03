import { Check } from 'lucide-react';
import type { OrderStatus } from '@/lib/orderStatus';

const STEPS: { label: string; minRank: number }[] = [
  { label: 'Pagamento', minRank: 1 },
  { label: 'Produção', minRank: 2 },
  { label: 'Pronto', minRank: 3 },
  { label: 'Enviado', minRank: 4 },
  { label: 'Entregue', minRank: 5 },
];

const RANK: Record<OrderStatus, number> = {
  aguardando_pagamento: 0,
  pagamento_aprovado: 1,
  aguardando_producao: 2,
  em_producao: 2,
  aguardando_conferencia: 2,
  pronto_envio: 3,
  enviado: 4,
  entregue: 5,
  cancelado: -1,
};

export default function OrderProgress({ status }: { status: OrderStatus }) {
  const rank = RANK[status] ?? 0;
  if (rank < 0) {
    return <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">Este pedido foi cancelado.</p>;
  }

  return (
    <ol className="grid grid-cols-5 gap-2">
      {STEPS.map((step) => {
        const done = rank >= step.minRank;
        return (
          <li key={step.label} className="flex flex-col items-center gap-2 text-center">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-500 ${done ? 'bg-sage-600 text-white' : 'bg-stone-200 text-stone-500'}`}
            >
              {done ? <Check size={16} /> : null}
            </span>
            <span className={`text-xs ${done ? 'font-medium text-stone-900' : 'text-stone-500'}`}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
