import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Eye, Redo2, RotateCcw, Undo2 } from 'lucide-react';
import { clampTransform, getPrintLayout } from '@/lib/printLayout';
import { renderPrint } from '@/lib/renderPrint';
import type { CropTransform, PhotoDraft, PrintFormat } from '@/types/store';

const PREVIEW_WIDTH = 700;

interface DragState {
  startX: number;
  startY: number;
  start: CropTransform;
  moved: boolean;
}

interface CropPreviewProps {
  photo: PhotoDraft;
  format: PrintFormat;
  canUndo: boolean;
  canRedo: boolean;
  onPreview: (transform: CropTransform) => void;
  onCommit: (transform: CropTransform) => void;
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
}

export default function CropPreview({
  photo,
  format,
  canUndo,
  canRedo,
  onPreview,
  onCommit,
  onUndo,
  onRedo,
  onReset,
}: CropPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const { naturalWidth: imgW, naturalHeight: imgH } = photo.image;

  const transform = useMemo(
    () => clampTransform(photo.transform, imgW, imgH, getPrintLayout(format)),
    [photo.transform, imgW, imgH, format],
  );

  useEffect(() => {
    if (!canvasRef.current) return;
    renderPrint(canvasRef.current, { ...photo, transform }, format, PREVIEW_WIDTH, {
      mode: showOriginal ? 'original' : 'edit',
      showCutAreas: !showOriginal,
    });
  }, [photo, transform, format, showOriginal]);

  const handlePointerDown = (e: PointerEvent<HTMLCanvasElement>) => {
    if (showOriginal) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, start: transform, moved: false };
  };

  const handlePointerMove = (e: PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const layout = getPrintLayout(format);
    const windowWidthPx = layout.window.w * e.currentTarget.getBoundingClientRect().width;
    const next = clampTransform(
      {
        ...drag.start,
        offsetX: drag.start.offsetX + (e.clientX - drag.startX) / windowWidthPx,
        offsetY: drag.start.offsetY + (e.clientY - drag.startY) / windowWidthPx,
      },
      imgW,
      imgH,
      layout,
    );
    if (!drag.moved) {
      drag.moved = true;
      onCommit(drag.start);
    }
    onPreview(next);
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  return (
    <div className="mt-4 rounded-3xl bg-white p-6 shadow-sm">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ touchAction: 'none' }}
        className={`mx-auto w-full max-w-[700px] rounded-lg select-none ${showOriginal ? '' : 'cursor-grab active:cursor-grabbing'}`}
      />
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-500">
          {showOriginal ? 'Visualizando a foto original sem cortes' : 'Arraste a foto para reposicionar no formato'}
        </p>
        <div className="flex items-center gap-2">
          <IconButton label="Desfazer" icon={Undo2} disabled={!canUndo} onClick={onUndo} />
          <IconButton label="Refazer" icon={Redo2} disabled={!canRedo} onClick={onRedo} />
          <IconButton label="Restaurar" icon={RotateCcw} onClick={onReset} />
          <button
            onClick={() => setShowOriginal((v) => !v)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${showOriginal ? 'bg-stone-900 text-white' : 'border border-stone-300 text-stone-700 hover:bg-stone-100'}`}
          >
            <Eye size={16} /> {showOriginal ? 'Ver editada' : 'Ver original'}
          </button>
        </div>
      </div>
    </div>
  );
}

function IconButton({
  label,
  icon: Icon,
  disabled,
  onClick,
}: {
  label: string;
  icon: typeof Undo2;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 rounded-full border border-stone-300 px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon size={16} /> {label}
    </button>
  );
}
