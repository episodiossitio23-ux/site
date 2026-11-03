import { Sparkles } from 'lucide-react';
import SiteHeader from '@/components/layout/SiteHeader';
import { useFormats } from '@/hooks/useFormats';
import { navigate } from '@/lib/router';
import { formatBRL } from '@/lib/format';

export default function HomePage() {
  const { formats, error } = useFormats();
  return (
    <main>
      <SiteHeader />
      <section className="mx-auto max-w-6xl px-6 py-20 animate-fade-up">
        <p className="text-sm font-medium uppercase tracking-widest text-clay-600">Revelação e impressão</p>
        <h1 className="mt-4 max-w-2xl font-display text-5xl leading-[1.15] text-stone-900 md:text-6xl">
          Transforme momentos especiais em fotografias impressas.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-stone-600">
          Envie suas fotos, ajuste o corte vendo o resultado em tempo real e receba suas impressões em casa.
        </p>
        <button
          onClick={() => navigate('/revelar')}
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-clay-500 px-7 py-3.5 font-medium text-white shadow-lg shadow-clay-500/20 transition hover:-translate-y-0.5 hover:bg-clay-600"
        >
          <Sparkles size={18} /> Revelar minhas fotos
        </button>
      </section>
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="font-display text-3xl text-stone-900">Formatos disponíveis</h2>
        {error && <p className="mt-4 text-rose-700">{error}</p>}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {formats.map((format) => (
            <div key={format.id} className="rounded-2xl border border-stone-200 bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg">
              <p className="font-display text-xl text-stone-900">{format.label}</p>
              <p className="mt-4 font-medium text-clay-700">{formatBRL(format.price_cents)}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="border-t border-stone-200 px-6 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between text-sm text-stone-500">
          <p>Revelô Fotos</p>
          <button
            onClick={() => navigate('/admin')}
            className="transition hover:text-stone-900"
          >
            Área do administrador
          </button>
        </div>
      </footer>
    </main>
  );
}
