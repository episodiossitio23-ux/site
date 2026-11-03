import { Camera, ShoppingBag, UserRound } from 'lucide-react';
import { navigate } from '@/lib/router';
import { useStore } from '@/context/StoreContext';
import { useAuthSession } from '@/hooks/useAuthSession';

export default function SiteHeader() {
  const { photos } = useStore();
  const auth = useAuthSession();
  const cartCount = photos.filter((p) => p.inCart).reduce((sum, p) => sum + p.quantity, 0);
  const accountPath = auth.status === 'signed-in' ? '/meus-pedidos' : '/entrar';

  return (
    <header className="sticky top-0 z-10 border-b border-stone-200 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 font-display text-xl text-stone-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-clay-500 text-white">
            <Camera size={18} />
          </span>
          Revelô Fotos
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/produtos')}
            className="hidden rounded-full px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 sm:block"
          >
            Catálogo
          </button>
          <button
            onClick={() => navigate(accountPath)}
            aria-label={auth.status === 'signed-in' ? 'Minha conta' : 'Entrar'}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-300 text-stone-700 transition hover:bg-stone-100"
          >
            <UserRound size={18} />
          </button>
          <button
            onClick={() => navigate('/carrinho')}
            aria-label="Ver carrinho"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-stone-300 text-stone-700 transition hover:bg-stone-100"
          >
            <ShoppingBag size={18} />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-clay-500 px-1 text-xs font-semibold text-white">
                {cartCount}
              </span>
            )}
          </button>
          <button
            onClick={() => navigate('/revelar')}
            className="rounded-full bg-stone-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-clay-600"
          >
            Revelar minhas fotos
          </button>
        </div>
      </div>
    </header>
  );
}
