import { useState } from 'react';
import { Upload, ShoppingBag, Check, Trash2 } from 'lucide-react';
import SiteHeader from '@/components/layout/SiteHeader';
import CaptionControls from '@/components/editor/CaptionControls';
import CropPreview from '@/components/editor/CropPreview';
import { useStore } from '@/context/StoreContext';
import { useFormats } from '@/hooks/useFormats';
import { navigate } from '@/lib/router';
import { createPhotoDraft } from '@/lib/photoFiles';
import { formatBRL } from '@/lib/format';
import {
  clampTransform,
  createDefaultTransform,
  getEffectiveDpi,
  getPrintLayout,
  getQualityLevel,
  QUALITY_LABEL,
} from '@/lib/printLayout';
import type { CropTransform, Rotation } from '@/types/store';

export default function EditorPage() {
  const { formats, error } = useFormats();
  const {
    photos,
    addPhotos,
    updatePhoto,
    removePhoto,
    previewTransform,
    commitTransform,
    undoTransform,
    redoTransform,
  } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('foto'),
  );
  const [message, setMessage] = useState<string | null>(null);

  const selected = photos.find((p) => p.id === selectedId) ?? photos[0] ?? null;
  const formatId = selected?.formatId ?? formats[0]?.id ?? null;
  const format = formats.find((f) => f.id === formatId) ?? null;

  const handleFiles = async (files: FileList | File[]) => {
    const results = await Promise.all(Array.from(files).map(createPhotoDraft));
    const added = results.flatMap((r) => (r.ok ? [r.photo] : []));
    const problems = results.flatMap((r) => (r.ok ? [] : [r.reason]));
    if (added.length) {
      addPhotos(added);
      if (!selected) setSelectedId(added[0].id);
    }
    setMessage(problems.length ? problems.join(' ') : null);
  };

  const buildTransform = (patch: Partial<CropTransform>): CropTransform | null => {
    if (!selected || !format) return null;
    return clampTransform(
      { ...selected.transform, ...patch },
      selected.image.naturalWidth,
      selected.image.naturalHeight,
      getPrintLayout(format),
    );
  };

  const commitChange = (patch: Partial<CropTransform>) => {
    const next = buildTransform(patch);
    if (selected && next) commitTransform(selected.id, next);
  };

  const handleZoomChange = (zoom: number) => {
    const next = buildTransform({ zoom });
    if (selected && next) previewTransform(selected.id, next);
  };

  const handleFormatChange = (nextFormatId: string) => {
    const nextFormat = formats.find((f) => f.id === nextFormatId);
    if (!selected || !nextFormat) return;
    updatePhoto(selected.id, {
      formatId: nextFormat.id,
      transform: clampTransform(
        selected.transform,
        selected.image.naturalWidth,
        selected.image.naturalHeight,
        getPrintLayout(nextFormat),
      ),
    });
  };

  const setCaption = (patch: Partial<NonNullable<typeof selected>['caption']>) => {
    if (!selected) return;
    updatePhoto(selected.id, { caption: { ...selected.caption, ...patch } });
  };

  const addToCart = () => {
    if (!selected || !format) return;
    updatePhoto(selected.id, { inCart: true, formatId: format.id });
  };

  const quality =
    selected && format
      ? QUALITY_LABEL[
          getQualityLevel(
            getEffectiveDpi(selected.image.naturalWidth, selected.image.naturalHeight, selected.transform, format),
          )
        ]
      : null;

  return (
    <main>
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-6 py-10 animate-fade-in">
        <h1 className="font-display text-3xl text-stone-900">Editor de fotos</h1>
        {error && <p className="mt-4 text-rose-700">{error}</p>}
        {message && <p className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{message}</p>}

        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void handleFiles(e.dataTransfer.files);
          }}
          className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-stone-300 bg-white p-10 text-center transition hover:border-clay-400 hover:bg-clay-50"
        >
          <Upload className="text-clay-500" />
          <span className="mt-3 font-medium text-stone-800">Arraste suas fotos aqui ou clique para escolher</span>
          <span className="mt-1 text-sm text-stone-500">JPG ou PNG. Você pode selecionar várias de uma vez.</span>
          <input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.heic,.heif,image/*"
            className="hidden"
            onChange={(e) => e.target.files && void handleFiles(e.target.files)}
          />
        </label>

        {selected && format && (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
            <div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {photos.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`relative h-20 w-20 flex-none overflow-hidden rounded-xl ring-2 transition ${p.id === selected.id ? 'ring-clay-500' : 'ring-transparent'}`}
                  >
                    <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                    {p.inCart && (
                      <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-sage-600 text-white">
                        <Check size={12} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <CropPreview
                photo={selected}
                format={format}
                canUndo={selected.past.length > 0}
                canRedo={selected.future.length > 0}
                onPreview={(t) => previewTransform(selected.id, t)}
                onCommit={(t) => commitTransform(selected.id, t)}
                onUndo={() => undoTransform(selected.id)}
                onRedo={() => redoTransform(selected.id)}
                onReset={() => commitTransform(selected.id, createDefaultTransform())}
              />
            </div>

            <aside className="space-y-6 rounded-3xl bg-white p-6 shadow-sm">
              <div>
                <p className="text-sm font-medium text-stone-700">Formato</p>
                <select
                  value={format.id}
                  onChange={(e) => handleFormatChange(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2"
                >
                  {formats.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label} - {formatBRL(f.price_cents)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="text-sm font-medium text-stone-700">Zoom</p>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={0.05}
                  value={selected.transform.zoom}
                  onPointerDown={() => commitTransform(selected.id, selected.transform)}
                  onChange={(e) => handleZoomChange(Number(e.target.value))}
                  className="mt-2 w-full accent-clay-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => commitChange({ rotation: ((selected.transform.rotation + 90) % 360) as Rotation })}
                  className="rounded-xl border border-stone-300 py-2 text-sm transition hover:bg-stone-50"
                >
                  Girar 90°
                </button>
                <button
                  onClick={() => commitChange({ flipH: !selected.transform.flipH })}
                  className="rounded-xl border border-stone-300 py-2 text-sm transition hover:bg-stone-50"
                >
                  Espelhar
                </button>
              </div>
              {format.kind === 'polaroid' && (
                <CaptionControls caption={selected.caption} onChange={setCaption} />
              )}
              <p className="rounded-xl bg-stone-50 p-3 text-sm text-stone-700">{quality}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">Quantidade</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updatePhoto(selected.id, { quantity: Math.max(1, selected.quantity - 1) })}
                    className="h-8 w-8 rounded-full border border-stone-300 transition hover:bg-stone-100"
                  >
                    -
                  </button>
                  <span className="w-6 text-center">{selected.quantity}</span>
                  <button
                    onClick={() => updatePhoto(selected.id, { quantity: Math.min(100, selected.quantity + 1) })}
                    className="h-8 w-8 rounded-full border border-stone-300 transition hover:bg-stone-100"
                  >
                    +
                  </button>
                </div>
              </div>
              {selected.inCart ? (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm text-sage-700">
                    <Check size={16} /> Salva no carrinho
                  </p>
                  <button
                    onClick={() => navigate('/carrinho')}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-stone-900 py-3 text-sm font-medium text-white transition hover:bg-clay-600"
                  >
                    <ShoppingBag size={16} /> Ver carrinho
                  </button>
                </div>
              ) : (
                <button
                  onClick={addToCart}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-clay-500 py-3 text-sm font-medium text-white shadow-md shadow-clay-500/20 transition hover:-translate-y-0.5 hover:bg-clay-600"
                >
                  <ShoppingBag size={16} /> Adicionar ao carrinho
                </button>
              )}
              <button
                onClick={() => removePhoto(selected.id)}
                className="flex w-full items-center justify-center gap-2 text-sm text-rose-700 transition hover:underline"
              >
                <Trash2 size={14} /> Remover esta foto
              </button>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
