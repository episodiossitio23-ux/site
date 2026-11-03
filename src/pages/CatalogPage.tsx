import { ArrowRight, Camera, Check, Clock3 } from 'lucide-react';
import SiteHeader from '@/components/layout/SiteHeader';
import { useCatalog } from '@/hooks/useCatalog';
import { formatBRL } from '@/lib/format';
import { navigate } from '@/lib/router';
import type { CatalogCategory } from '@/types/catalog';

function categoryFor(categories: CatalogCategory[], categoryId: string): CatalogCategory | undefined {
  return categories.find((category) => category.id === categoryId);
}

export default function CatalogPage() {
  const { categories, products, loading, error } = useCatalog();

  return (
    <main>
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-6 py-12 animate-fade-up">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-widest text-clay-600">Catálogo</p>
          <h1 className="mt-3 font-display text-4xl text-stone-900 md:text-5xl">Escolha a melhor forma de guardar suas memórias.</h1>
          <p className="mt-4 text-lg leading-relaxed text-stone-600">Formatos, molduras e kits preparados para transformar suas fotos digitais em lembranças para tocar.</p>
        </div>

        {error && <p className="mt-8 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}
        {loading && <p className="mt-10 text-stone-500">Carregando produtos...</p>}
        {!loading && products.length === 0 && <p className="mt-10 rounded-3xl border border-dashed border-stone-300 p-10 text-center text-stone-500">Nenhum produto disponível no momento.</p>}

        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const category = categoryFor(categories, product.category_id);
            const startingPrice = Math.min(...product.variants.map((variant) => variant.price_cents));
            return (
              <article key={product.id} className="group flex flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <div className="flex h-44 items-center justify-center bg-clay-50 text-clay-500">
                  {product.image_url ? <img src={product.image_url} alt="" className="h-full w-full object-cover" /> : <Camera size={42} strokeWidth={1.5} />}
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <p className="text-xs font-medium uppercase tracking-wide text-clay-600">{category?.name ?? 'Produto'}</p>
                  <h2 className="mt-2 font-display text-2xl text-stone-900">{product.name}</h2>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-stone-600">{product.description}</p>
                  <div className="mt-6 space-y-3 border-t border-stone-100 pt-4">
                    <p className="text-sm text-stone-500">A partir de <span className="font-semibold text-stone-900">{Number.isFinite(startingPrice) ? formatBRL(startingPrice) : 'consulte'}</span></p>
                    <div className="flex flex-wrap gap-2 text-xs text-stone-500">
                      <span className="flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1"><Check size={13} /> {product.variants.length} opções</span>
                      {product.variants[0] && <span className="flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1"><Clock3 size={13} /> {product.variants[0].production_days} dias</span>}
                    </div>
                    <button onClick={() => navigate('/revelar')} className="flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 py-2.5 text-sm font-medium text-white transition hover:bg-clay-600">
                      Escolher e revelar <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </main>
  );
}
