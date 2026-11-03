import { Clock3 } from 'lucide-react';
import { STATUS_LABEL, type OrderStatus } from '@/lib/orderStatus';
import { formatDate } from '@/lib/format';

export interface TimelineEntry {
  previous_status: string | null;
  new_status: string;
  created_at: string;
}

export default function OrderTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-center gap-2">
        <Clock3 size={18} className="text-clay-600" />
        <h2 className="font-display text-xl text-stone-900">Atualizações do pedido</h2>
      </div>
      <ol className="mt-5 space-y-4">
        {entries.map((entry, index) => (
          <li key={`${entry.created_at}-${index}`} className="border-l-2 border-clay-200 pl-4">
            <p className="text-sm font-medium text-stone-900">{STATUS_LABEL[entry.new_status as OrderStatus] ?? entry.new_status}</p>
            <p className="mt-1 text-xs text-stone-500">{entry.previous_status ? `De ${STATUS_LABEL[entry.previous_status as OrderStatus] ?? entry.previous_status} · ` : ''}{formatDate(entry.created_at)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
