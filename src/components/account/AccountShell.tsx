import { useState, type ReactNode } from 'react';
import { ClipboardList, Loader2, LogOut, UserRound } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import SiteHeader from '@/components/layout/SiteHeader';
import { useAuthSession } from '@/hooks/useAuthSession';
import { supabase } from '@/lib/supabase';
import { navigate, usePathname } from '@/lib/router';

const TABS = [
  { href: '/meus-pedidos', label: 'Meus pedidos', icon: ClipboardList },
  { href: '/conta', label: 'Minha conta', icon: UserRound },
];

export default function AccountShell({ children }: { children: (session: Session) => ReactNode }) {
  const auth = useAuthSession();
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
    navigate('/');
  };

  return (
    <main>
      <SiteHeader />
      {auth.status === 'loading' && (
        <div className="flex justify-center py-32 text-stone-500">
          <Loader2 className="animate-spin" size={22} />
        </div>
      )}

      {auth.status === 'signed-out' && (
        <div className="mx-auto max-w-md px-6 py-24 text-center animate-fade-up">
          <p className="font-display text-3xl text-stone-900">Entre para ver sua conta</p>
          <p className="mt-3 text-stone-600">Seus pedidos, endereços e fotos reveladas ficam guardados aqui.</p>
          <button
            onClick={() => navigate('/entrar')}
            className="mt-8 rounded-full bg-stone-900 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-clay-600"
          >
            Entrar ou criar conta
          </button>
        </div>
      )}

      {auth.status === 'signed-in' && (
        <div className="mx-auto max-w-5xl px-6 py-10 animate-fade-up">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-stone-500">Olá, {auth.session.user.user_metadata?.full_name || auth.session.user.email}</p>
              <h1 className="font-display text-3xl text-stone-900">Minha conta</h1>
            </div>
            <button
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="flex items-center gap-1.5 rounded-full border border-stone-300 px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100 disabled:opacity-60"
            >
              <LogOut size={16} /> Sair
            </button>
          </div>

          <nav className="mt-6 flex gap-2 border-b border-stone-200">
            {TABS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href === '/meus-pedidos' && pathname.startsWith('/meus-pedidos/'));
              return (
                <button
                  key={href}
                  onClick={() => navigate(href)}
                  className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${active ? 'border-clay-500 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800'}`}
                >
                  <Icon size={16} /> {label}
                </button>
              );
            })}
          </nav>

          <div className="mt-8">{children(auth.session)}</div>
        </div>
      )}
    </main>
  );
}
