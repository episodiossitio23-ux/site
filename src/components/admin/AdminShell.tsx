import type { ReactNode } from 'react';
import { Camera, LogOut, ClipboardList, Settings } from 'lucide-react';
import { useAdminSession } from '@/hooks/useAdminSession';
import { supabase } from '@/lib/supabase';
import { navigate } from '@/lib/router';
import AdminLoginPage from '@/pages/admin/AdminLoginPage';

export default function AdminShell({ children }: { children: ReactNode }) {
  const session = useAdminSession();

  if (session.status === 'loading') {
    return <main className="flex min-h-screen items-center justify-center text-stone-500">Carregando...</main>;
  }
  if (session.status === 'signed-out') return <AdminLoginPage />;
  if (session.status === 'forbidden') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-sm rounded-3xl bg-white p-8 text-center shadow-sm">
          <p className="font-display text-2xl text-stone-900">Acesso não liberado</p>
          <p className="mt-3 text-sm text-stone-600">
            A conta {session.email} ainda não tem permissão para acessar o painel.
          </p>
          <button
            onClick={() => void supabase.auth.signOut()}
            className="mt-6 rounded-full border border-stone-300 px-5 py-2 text-sm transition hover:bg-stone-50"
          >
            Sair
          </button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2 font-display text-lg text-stone-900">
              <Camera size={18} className="text-clay-500" /> Painel
            </span>
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-1.5 text-sm text-stone-700 transition hover:text-clay-700"
            >
              <ClipboardList size={16} /> Pedidos
            </button>
            <button
              onClick={() => navigate('/admin/configuracoes')}
              className="flex items-center gap-1.5 text-sm text-stone-700 transition hover:text-clay-700"
            >
              <Settings size={16} /> Configurações
            </button>
          </div>
          <button
            onClick={() => void supabase.auth.signOut()}
            className="flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-stone-900"
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
