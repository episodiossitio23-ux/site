import { useEffect, useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { supabase } from '@/lib/supabase';
import { formatBRL, formatDate } from '@/lib/format';

interface CustomerSummary {
  key: string;
  name: string;
  email: string;
  phone: string;
  orders: number;
  spentCents: number;
  lastOrder: string;
}

interface OrderCustomerRow {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total_cents: number;
  created_at: string;
}

export default function AdminCustomersPage() {
  const [rows, setRows] = useState<CustomerSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.from('orders').select('customer_name,customer_email,customer_phone,total_cents,created_at').order('created_at', { ascending: false }).then(({ data, error: queryError }) => {
      if (!active) return;
      if (queryError) {
        setError('Não foi possível carregar os clientes.');
        setLoading(false);
        return;
      }
      const grouped = new Map<string, CustomerSummary>();
      for (const order of (data as OrderCustomerRow[]) ?? []) {
        const key = order.customer_email.trim().toLowerCase();
        const current = grouped.get(key);
        if (current) {
          current.orders += 1;
          current.spentCents += order.total_cents;
        } else {
          grouped.set(key, { key, name: order.customer_name, email: order.customer_email, phone: order.customer_phone, orders: 1, spentCents: order.total_cents, lastOrder: order.created_at });
        }
      }
      setRows([...grouped.values()]);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => `${row.name} ${row.email} ${row.phone}`.toLowerCase().includes(term));
  }, [rows, search]);

  return (
    <AdminShell>
      <main className="mx-auto max-w-6xl px-6 py-10 animate-fade-in">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-stone-900">Clientes</h1>
            <p className="mt-1 text-sm text-stone-500">Resumo dos clientes que já fizeram pedidos.</p>
          </div>
          <label className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, e-mail ou telefone" className="w-64 rounded-xl border border-stone-300 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-clay-300" />
          </label>
        </div>
        {error && <p className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
        {loading && <p className="mt-10 text-sm text-stone-500">Carregando clientes...</p>}
        {!loading && !error && visible.length === 0 && <div className="mt-10 rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center"><Users className="mx-auto text-stone-400" /><p className="mt-4 text-sm text-stone-500">Nenhum cliente encontrado.</p></div>}
        {!loading && visible.length > 0 && (
          <div className="mt-8 overflow-x-auto rounded-3xl bg-white shadow-sm">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500"><tr><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">Contato</th><th className="px-5 py-3">Pedidos</th><th className="px-5 py-3">Total gasto</th><th className="px-5 py-3">Último pedido</th></tr></thead>
              <tbody className="divide-y divide-stone-100">
                {visible.map((row) => <tr key={row.key} className="transition hover:bg-stone-50"><td className="px-5 py-4"><p className="font-medium text-stone-900">{row.name}</p><p className="text-stone-500">{row.email}</p></td><td className="px-5 py-4 text-stone-600">{row.phone}</td><td className="px-5 py-4 text-stone-700">{row.orders}</td><td className="px-5 py-4 font-medium text-stone-900">{formatBRL(row.spentCents)}</td><td className="px-5 py-4 text-stone-600">{formatDate(row.lastOrder)}</td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </AdminShell>
  );
}
