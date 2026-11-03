import { useState, type FormEvent } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import SiteHeader from '@/components/layout/SiteHeader';
import { useAuthSession } from '@/hooks/useAuthSession';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/router';

type Mode = 'signin' | 'signup' | 'forgot';

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const SUBMIT_LABEL: Record<Mode, string> = {
  signin: 'Entrar',
  signup: 'Criar minha conta',
  forgot: 'Enviar link de redefinição',
};

const inputClass =
  'mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 transition focus:outline-none focus:ring-2 focus:ring-clay-300';

function signInMessage(message: string): string {
  if (message.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (message.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  return 'Não foi possível entrar agora. Tente novamente.';
}

function signUpMessage(message: string): string {
  if (message.includes('already registered')) return 'Já existe uma conta com este e-mail. Entre com sua senha.';
  if (message.toLowerCase().includes('password')) return 'Escolha uma senha mais forte, com pelo menos 6 caracteres.';
  return 'Não foi possível criar sua conta agora. Tente novamente.';
}

export default function AccountAuthPage() {
  const auth = useAuthSession();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  const validate = (): string | null => {
    if (!EMAIL_PATTERN.test(email.trim())) return 'Informe um e-mail válido.';
    if (mode === 'forgot') return null;
    if (password.length < 6) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (mode === 'signup') {
      if (name.trim().length < 3 || !name.trim().includes(' ')) return 'Informe seu nome completo.';
      if (phone.replace(/\D/g, '').length < 10) return 'Informe um telefone com DDD.';
    }
    return null;
  };

  const handleSignIn = async () => {
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) {
      setError(signInMessage(authError.message));
      return;
    }
    navigate('/meus-pedidos');
  };

  const handleSignUp = async () => {
    const { data, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim(), phone: phone.trim() } },
    });
    if (authError) {
      setError(signUpMessage(authError.message));
      return;
    }
    if (data.session) navigate('/meus-pedidos');
    else setInfo('Enviamos um e-mail de confirmação. Confirme sua conta para começar a acompanhar seus pedidos.');
  };

  const handleForgot = async () => {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/conta/nova-senha`,
    });
    if (resetError) {
      setError('Não foi possível enviar o e-mail agora. Tente novamente em instantes.');
      return;
    }
    setInfo('Se este e-mail tiver uma conta, você receberá o link para criar uma nova senha.');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'signin') await handleSignIn();
      else if (mode === 'signup') await handleSignUp();
      else await handleForgot();
    } catch {
      setError('Não foi possível concluir. Verifique sua conexão e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main>
      <SiteHeader />
      <div className="mx-auto max-w-md px-6 py-12 animate-fade-up">
        <div className="rounded-3xl bg-white p-8 shadow-sm">
          <div className="flex items-center gap-2 font-display text-lg text-stone-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-clay-500 text-white">
              <Camera size={16} />
            </span>
            Minha conta
          </div>

          {auth.status === 'loading' && (
            <div className="flex justify-center py-16 text-stone-500">
              <Loader2 className="animate-spin" size={20} />
            </div>
          )}

          {auth.status === 'signed-in' && (
            <div className="mt-6 space-y-5 text-center">
              <p className="font-display text-2xl text-stone-900">Você já está conectado</p>
              <p className="text-sm text-stone-600">{auth.session.user.email}</p>
              <button
                onClick={() => navigate('/meus-pedidos')}
                className="w-full rounded-full bg-stone-900 py-3 text-sm font-medium text-white transition hover:bg-clay-600"
              >
                Ir para meus pedidos
              </button>
            </div>
          )}

          {auth.status === 'signed-out' && (
            <>
              {mode !== 'forgot' && (
                <div className="mt-6 grid grid-cols-2 rounded-full bg-stone-100 p-1 text-sm">
                  {(['signin', 'signup'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => switchMode(tab)}
                      className={`rounded-full py-2 font-medium transition ${mode === tab ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
                    >
                      {tab === 'signin' ? 'Já tenho conta' : 'Criar conta'}
                    </button>
                  ))}
                </div>
              )}

              <p className="mt-6 font-display text-2xl text-stone-900">
                {mode === 'signin' && 'Entrar'}
                {mode === 'signup' && 'Criar sua conta'}
                {mode === 'forgot' && 'Recuperar senha'}
              </p>
              <p className="mt-2 text-sm text-stone-600">
                {mode === 'signup'
                  ? 'Acompanhe seus pedidos, guarde endereços e repita compras com um clique.'
                  : mode === 'forgot'
                    ? 'Informe o e-mail usado na conta para receber o link.'
                    : 'Acesse seus pedidos e fotos reveladas.'}
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
                {mode === 'signup' && (
                  <>
                    <label className="block">
                      <span className="text-sm font-medium text-stone-700">Nome completo</span>
                      <input value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} className={inputClass} />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-stone-700">Telefone com DDD</span>
                      <input
                        value={phone}
                        type="tel"
                        autoComplete="tel"
                        placeholder="(11) 99999-9999"
                        onChange={(e) => setPhone(e.target.value)}
                        className={inputClass}
                      />
                    </label>
                  </>
                )}
                <label className="block">
                  <span className="text-sm font-medium text-stone-700">E-mail</span>
                  <input
                    type="email"
                    value={email}
                    autoComplete="email"
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </label>
                {mode !== 'forgot' && (
                  <label className="block">
                    <span className="text-sm font-medium text-stone-700">Senha</span>
                    <input
                      type="password"
                      value={password}
                      autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputClass}
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
                  {submitting && <Loader2 size={16} className="animate-spin" />}
                  {submitting ? 'Aguarde...' : SUBMIT_LABEL[mode]}
                </button>
              </form>

              <div className="mt-6 text-center text-sm">
                {mode === 'signin' && (
                  <button onClick={() => switchMode('forgot')} className="text-clay-700 transition hover:underline">
                    Esqueci minha senha
                  </button>
                )}
                {mode === 'forgot' && (
                  <button onClick={() => switchMode('signin')} className="text-clay-700 transition hover:underline">
                    Voltar para o login
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
