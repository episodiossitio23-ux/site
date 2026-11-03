import { CalendarDays, CircleDollarSign, Factory, PackageCheck } from 'lucide-react';
import { formatBRL } from '@/lib/format';
import type { OrderStats } from '@/lib/orderStats';

export default function OrderStatsCards({ stats }: { stats: OrderStats }) {
  const cards = [
    { label: 'Pedidos hoje', value: String(stats.today), icon: CalendarDays, tone: 'bg-clay-50 text-clay-600' },
    { label: 'Em produção', value: String(stats.inProduction), icon: Factory, tone: 'bg-sky-50 text-sky-700' },
    { label: 'Prontos para envio', value: String(stats.readyToShip), icon: PackageCheck, tone: 'bg-sage-50 text-sage-700' },
    {
      label: 'Faturamento do mês',
      value: formatBRL(stats.monthRevenueCents),
      icon: CircleDollarSign,
      tone: 'bg-amber-50 text-amber-700',
    },
  ];

  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ label, value, icon: Icon, tone }) => (
        <div key={label} className="rounded-3xl bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone}`}>
            <Icon size={18} />
          </div>
          <p className="mt-4 text-sm text-stone-500">{label}</p>
          <p className="mt-1 font-display text-2xl text-stone-900">{value}</p>
        </div>
      ))}
    </div>
  );
}
