import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

const inputClass =
  'mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 transition focus:outline-none focus:ring-2 focus:ring-clay-300';

export default function ProfileSection({ session }: { session: Session }) {
  const metadata = session.user.user_metadata ?? {};
  const [name, setName] = useState<string>(metadata.full_name ?? '');
  const [phone, setPhone] = useState<string>(metadata.phone ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (name.trim().length < 3 || !name.trim().includes(' ')) {
      setMessage({ type: 'error', text: 'Informe seu nome completo.' });
      return;
    }
    if (phone.replace(/\D/g, '').length < 10) {
      setMessage({ type: 'error', text: 'Informe um telefone com DDD.' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: name.trim(), phone: phone.trim() },
      });
      setMessage(
        error
          ? { type: 'error', text: 'Não foi possível salvar seus dados. Tente novamente.' }
          : { type: 'ok', text: 'Dados atualizados.' },
      );
    } catch {
      setMessage({ type: 'error', text: 'Não foi possível salvar seus dados. Verifique sua conexão.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <h2 className="font-display text-xl text-stone-900">Seus dados</h2>
      <form onSubmit={handleSubmit} noValidate className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-stone-700">Nome completo</span>
          <input value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-stone-700">Telefone com DDD</span>
          <input value={phone} type="tel" autoComplete="tel" placeholder="(11) 99999-9999" onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-stone-700">E-mail</span>
          <input value={session.user.email ?? ''} disabled className={`${inputClass} bg-stone-100 text-stone-500`} />
        </label>
        {message && (
          <p className={`rounded-xl p-3 text-sm sm:col-span-2 ${message.type === 'ok' ? 'bg-sage-50 text-sage-700' : 'bg-rose-50 text-rose-700'}`}>
            {message.text}
          </p>
        )}
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-full bg-stone-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-clay-600 disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Salvar dados
          </button>
        </div>
      </form>
    </section>
  );
}
