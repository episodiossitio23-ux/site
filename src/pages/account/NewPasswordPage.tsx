import { useState, type FormEvent } from 'react';
import { CheckCircle2, KeyRound, Loader2 } from 'lucide-react';
import SiteHeader from '@/components/layout/SiteHeader';
import { useAuthSession } from '@/hooks/useAuthSession';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/router';

export default function NewPasswordPage() {
  const auth = useAuthSession();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError('Não foi possível salvar a nova senha. Solicite um novo link.');
        return;
      }
      setDone(true);
    } catch {
      setError('Não foi possível salvar a nova senha. Verifique sua conexão.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main>
      <SiteHeader />
      <div className="mx-auto max-w-md px-6 py-12 animate-fade-up">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          {auth.status === 'loading' && (
            <div className="flex justify-center py-16 text-stone-500">
              <Loader2 className="animate-spin" size={20} />
            </div>
          )}

          {auth.status === 'signed-out' && (
            <div className="text-center">
              <p className="font-display text-2xl text-stone-900">Link expirado</p>
              <p className="mt-2 text-sm text-stone-600">Este link de redefinição não é válido ou já foi usado. Solicite um novo.</p>
              <button
                onClick={() => navigate('/entrar')}
                className="mt-6 rounded-full bg-clay-500 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-clay-600"
              >
                Solicitar novo link
              </button>
            </div>
          )}

          {auth.status === 'signed-in' && done && (
            <div className="text-center animate-scale-in">
              <CheckCircle2 className="mx-auto text-sage-600" size={36} />
              <p className="mt-4 font-display text-2xl text-stone-900">Senha atualizada</p>
              <p className="mt-2 text-sm text-stone-600">Sua nova senha já está valendo.</p>
              <button
                onClick={() => navigate('/meus-pedidos')}
                className="mt-6 rounded-full bg-clay-500 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-clay-600"
              >
                Ir para meus pedidos
              </button>
            </div>
          )}

          {auth.status === 'signed-in' && !done && (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="flex items-center gap-2">
                <KeyRound className="text-clay-500" size={20} />
                <p className="font-display text-2xl text-stone-900">Nova senha</p>
              </div>
              <label className="block">
                <span className="text-sm font-medium text-stone-700">Nova senha</span>
                <input
                  type="password"
                  value={password}
                  autoComplete="new-password"
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 transition focus:outline-none focus:ring-2 focus:ring-clay-300"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-stone-700">Confirme a nova senha</span>
                <input
                  type="password"
                  value={confirm}
                  autoComplete="new-password"
                  onChange={(e) => setConfirm(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 transition focus:outline-none focus:ring-2 focus:ring-clay-300"
                />
              </label>
              {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-clay-500 py-3 font-medium text-white transition hover:bg-clay-600 disabled:opacity-60"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                Salvar nova senha
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
