import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react';
import type { CaptionAlign, CaptionFont, CaptionStyle } from '@/types/store';

interface CaptionControlsProps {
  caption: CaptionStyle;
  onChange: (patch: Partial<CaptionStyle>) => void;
}

const MAX_CAPTION_LENGTH = 120;

const FONT_OPTIONS: { value: CaptionFont; label: string; className: string }[] = [
  { value: 'serif', label: 'Clássica', className: 'font-display' },
  { value: 'sans', label: 'Moderna', className: 'font-sans' },
  { value: 'hand', label: 'Manuscrita', className: 'italic' },
];

const ALIGN_OPTIONS: { value: CaptionAlign; label: string; Icon: typeof AlignLeft }[] = [
  { value: 'left', label: 'Alinhar à esquerda', Icon: AlignLeft },
  { value: 'center', label: 'Centralizar', Icon: AlignCenter },
  { value: 'right', label: 'Alinhar à direita', Icon: AlignRight },
];

const COLOR_OPTIONS = ['#2b2b2b', '#6b4f3a', '#3f5a4a', '#8a3b3b', '#2f4a6b'];

export default function CaptionControls({ caption, onChange }: CaptionControlsProps) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="caption-text" className="text-sm font-medium text-stone-700">
            Legenda
          </label>
          <span className="text-xs text-stone-400">
            {caption.text.length}/{MAX_CAPTION_LENGTH}
          </span>
        </div>
        <textarea
          id="caption-text"
          rows={2}
          maxLength={MAX_CAPTION_LENGTH}
          value={caption.text}
          placeholder="Escreva uma frase para a sua foto"
          onChange={(e) => onChange({ text: e.target.value })}
          className="mt-2 w-full resize-none rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-clay-500 focus:outline-none focus:ring-2 focus:ring-clay-200"
        />
      </div>

      <div>
        <p className="text-sm font-medium text-stone-700">Fonte</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {FONT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onChange({ font: option.value })}
              aria-pressed={caption.font === option.value}
              className={`rounded-xl border py-2 text-sm transition ${option.className} ${caption.font === option.value ? 'border-clay-500 bg-clay-50 text-stone-900' : 'border-stone-300 text-stone-600 hover:bg-stone-50'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-stone-700">Tamanho</p>
          <span className="text-xs text-stone-400">{Math.round(caption.size * 1000) / 10}</span>
        </div>
        <input
          type="range"
          min={0.03}
          max={0.12}
          step={0.005}
          value={caption.size}
          onChange={(e) => onChange({ size: Number(e.target.value) })}
          className="mt-2 w-full accent-clay-500"
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-stone-700">Alinhamento</p>
        <div className="flex gap-1">
          {ALIGN_OPTIONS.map(({ value, label, Icon }) => (
            <button
              key={value}
              onClick={() => onChange({ align: value })}
              aria-label={label}
              aria-pressed={caption.align === value}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${caption.align === value ? 'border-clay-500 bg-clay-50 text-clay-700' : 'border-stone-300 text-stone-500 hover:bg-stone-50'}`}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-stone-700">Cor</p>
        <div className="flex gap-2">
          {COLOR_OPTIONS.map((color) => (
            <button
              key={color}
              onClick={() => onChange({ color })}
              aria-label={`Cor ${color}`}
              aria-pressed={caption.color === color}
              style={{ backgroundColor: color }}
              className={`h-7 w-7 rounded-full transition hover:scale-110 ${caption.color === color ? 'ring-2 ring-clay-500 ring-offset-2' : 'ring-1 ring-stone-200'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
