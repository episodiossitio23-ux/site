import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, KeyRound } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/router';

export default function AdminResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.title = 'Redefinir senha | Painel';
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError('Não foi possível salvar a nova senha. Solicite um novo link.');
      return;
    }
    setDone(true);
  };

  return (
    <AdminShell>
      <main className="mx-auto max-w-md px-6 py-12 animate-fade-in">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          {done ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto text-sage-600" size={36} />
              <p className="mt-4 font-display text-2xl text-stone-900">Senha atualizada</p>
              <p className="mt-2 text-sm text-stone-600">Você já pode usar a nova senha para entrar no painel.</p>
              <button
                onClick={() => navigate('/admin')}
                className="mt-6 rounded-full bg-clay-500 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-clay-600"
              >
                Ir para os pedidos
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-2">
                <KeyRound className="text-clay-500" size={20} />
                <p className="font-display text-2xl text-stone-900">Nova senha</p>
              </div>
              <label className="block">
                <span className="text-sm font-medium text-stone-700">Nova senha</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-clay-300"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-stone-700">Confirme a nova senha</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-clay-300"
                />
              </label>
              {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-clay-500 py-3 text-sm font-medium text-white transition hover:bg-clay-600 disabled:opacity-60"
              >
                {submitting ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </form>
          )}
        </div>
      </main>
    </AdminShell>
  );
}
