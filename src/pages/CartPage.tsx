import { Minus, Plus, Pencil, Trash2, ShoppingBag } from 'lucide-react';
import SiteHeader from '@/components/layout/SiteHeader';
import { useStore } from '@/context/StoreContext';
import { useFormats } from '@/hooks/useFormats';
import { navigate } from '@/lib/router';
import { formatBRL } from '@/lib/format';

export default function CartPage() {
  const { photos, updatePhoto } = useStore();
  const { formats, loading, error } = useFormats();

  const items = photos
    .filter((p) => p.inCart)
    .map((photo) => {
      const format = formats.find((f) => f.id === photo.formatId) ?? null;
      return { photo, format, lineTotal: format ? format.price_cents * photo.quantity : 0 };
    });

  const itemCount = items.reduce((sum, item) => sum + item.photo.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.lineTotal, 0);

  return (
    <main>
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-6 py-10 animate-fade-in">
        <h1 className="font-display text-3xl text-stone-900">Seu carrinho</h1>

        {error && <p className="mt-4 text-rose-700">{error}</p>}

        {!loading && items.length === 0 && (
          <div className="mt-10 rounded-3xl border border-dashed border-stone-300 bg-white p-12 text-center">
            <ShoppingBag className="mx-auto text-stone-400" />
            <p className="mt-4 font-medium text-stone-800">Seu carrinho está vazio</p>
            <p className="mt-1 text-sm text-stone-500">Envie suas fotos e adicione os formatos que você quiser.</p>
            <button
              onClick={() => navigate('/revelar')}
              className="mt-6 rounded-full bg-clay-500 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-clay-600"
            >
              Revelar minhas fotos
            </button>
          </div>
        )}

        {items.length > 0 && (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
            <ul className="space-y-4">
              {items.map(({ photo, format, lineTotal }) => (
                <li key={photo.id} className="flex gap-4 rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md">
                  <img src={photo.url} alt={photo.name} className="h-24 w-24 flex-none rounded-xl object-cover" />
                  <div className="flex flex-1 flex-col justify-between gap-2">
                    <div>
                      <p className="font-medium text-stone-900">{format?.label ?? 'Formato indisponível'}</p>
                      <p className="truncate text-sm text-stone-500">{photo.name}</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updatePhoto(photo.id, { quantity: Math.max(1, photo.quantity - 1) })}
                          aria-label="Diminuir quantidade"
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-300 transition hover:bg-stone-100"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center font-medium">{photo.quantity}</span>
                        <button
                          onClick={() => updatePhoto(photo.id, { quantity: Math.min(100, photo.quantity + 1) })}
                          aria-label="Aumentar quantidade"
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-300 transition hover:bg-stone-100"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <p className="font-medium text-stone-900">{format ? formatBRL(lineTotal) : '-'}</p>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <button
                        onClick={() => navigate(`/revelar?foto=${photo.id}`)}
                        className="flex items-center gap-1 text-clay-700 transition hover:underline"
                      >
                        <Pencil size={14} /> Editar corte
                      </button>
                      <button
                        onClick={() => updatePhoto(photo.id, { inCart: false })}
                        className="flex items-center gap-1 text-rose-700 transition hover:underline"
                      >
                        <Trash2 size={14} /> Remover
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <aside className="h-fit space-y-4 rounded-3xl bg-white p-6 shadow-sm lg:sticky lg:top-24">
              <p className="font-display text-xl text-stone-900">Resumo</p>
              <div className="flex justify-between text-sm text-stone-600">
                <span>Fotografias</span>
                <span>{itemCount}</span>
              </div>
              <div className="flex justify-between border-t border-stone-200 pt-4 text-lg font-semibold text-stone-900">
                <span>Total</span>
                <span>{formatBRL(total)}</span>
              </div>
              <button
                onClick={() => navigate('/finalizar')}
                disabled={loading}
                className="w-full rounded-full bg-stone-900 py-3 text-sm font-medium text-white transition hover:bg-clay-600 disabled:opacity-50"
              >
                Finalizar compra
              </button>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
