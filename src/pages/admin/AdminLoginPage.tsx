import { useState, type FormEvent } from 'react';
import { Camera, LogIn, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function friendlyAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  return 'Não foi possível concluir. Tente novamente.';
}

export default function AdminLoginPage() {
  const [mode, setMode] = useState<'signin' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const switchMode = (next: 'signin' | 'forgot') => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  const handleSignIn = async () => {
    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    setSubmitting(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);
    if (authError) setError(friendlyAuthError(authError.message));
  };

  const handleForgot = async () => {
    setSubmitting(true);
    const { error: fnError } = await supabase.functions.invoke('password-recovery', {
      body: { email: email.trim(), redirectTo: `${window.location.origin}/admin/redefinir-senha` },
    });
    setSubmitting(false);
    if (fnError) {
      setError('Não foi possível enviar o e-mail agora. Tente novamente em instantes.');
      return;
    }
    setInfo('Se este e-mail pertencer a um administrador, você receberá o link de redefinição em instantes.');
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('Informe um e-mail válido.');
      return;
    }
    void (mode === 'signin' ? handleSignIn() : handleForgot());
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-900 px-6 py-12">
      <div className="w-full max-w-sm animate-scale-in rounded-3xl bg-white p-8 shadow-2xl">
        <div className="flex items-center gap-2 font-display text-xl text-stone-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-clay-500 text-white">
            <Camera size={18} />
          </span>
          Painel da loja
        </div>
        <p className="mt-6 font-display text-2xl text-stone-900">
          {mode === 'signin' ? 'Entrar no painel' : 'Recuperar senha'}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-stone-700">E-mail</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-clay-300"
            />
          </label>
          {mode === 'signin' && (
            <label className="block">
              <span className="text-sm font-medium text-stone-700">Senha</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-clay-300"
              />
            </label>
          )}
          {error && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
          {info && <p className="rounded-xl bg-sage-50 p-3 text-sm text-sage-700">{info}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-clay-500 py-3 font-medium text-white transition hover:bg-clay-600 disabled:opacity-60"
          >
            {mode === 'signin' ? <LogIn size={16} /> : <Mail size={16} />}
            {submitting ? 'Aguarde...' : mode === 'signin' ? 'Entrar' : 'Enviar link de redefinição'}
          </button>
        </form>

        <button
          onClick={() => switchMode(mode === 'signin' ? 'forgot' : 'signin')}
          className="mt-6 w-full text-center text-sm text-clay-700 transition hover:underline"
        >
          {mode === 'signin' ? 'Esqueci minha senha' : 'Voltar para o login'}
        </button>
      </div>
    </main>
  );
}
