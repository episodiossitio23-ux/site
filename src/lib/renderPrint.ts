import type { CaptionFont, CropTransform, PhotoDraft, PrintFormat } from '@/types/store';
import { getPrintLayout, getPrintPixelWidth, getScale } from '@/lib/printLayout';

const CAPTION_FONT_FAMILY: Record<CaptionFont, string> = {
  serif: 'Fraunces, Georgia, serif',
  sans: 'Inter, system-ui, sans-serif',
  hand: "'Segoe Script', 'Brush Script MT', cursive",
};

const CARD_COLOR = '#FFFEFA';
const ORIGINAL_BACKDROP = '#E9E4DC';

export interface RenderOptions {
  mode?: 'edit' | 'original';
  showCutAreas?: boolean;
}

function drawPhoto(
  ctx: CanvasRenderingContext2D,
  photo: PhotoDraft,
  transform: CropTransform,
  format: PrintFormat,
  canvasWidth: number,
  options: RenderOptions,
) {
  const layout = getPrintLayout(format);
  const img = photo.image;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const windowX = layout.window.x * canvasWidth;
  const windowY = layout.window.y * canvasWidth;
  const windowW = layout.window.w * canvasWidth;
  const windowH = layout.window.h * canvasWidth;

  const drawWithTransform = (scalePx: number, cx: number, cy: number, t: CropTransform) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((t.rotation * Math.PI) / 180);
    ctx.scale(t.flipH ? -1 : 1, t.flipV ? -1 : 1);
    ctx.drawImage(img, (-iw * scalePx) / 2, (-ih * scalePx) / 2, iw * scalePx, ih * scalePx);
    ctx.restore();
  };

  const editScalePx = (t: CropTransform) => getScale(iw, ih, t, layout.window.h / layout.window.w) * windowW;

  if (options.mode === 'original') {
    ctx.fillStyle = ORIGINAL_BACKDROP;
    ctx.fillRect(windowX, windowY, windowW, windowH);
    const fit = Math.min(windowW / iw, windowH / ih);
    const cx = windowX + windowW / 2;
    const cy = windowY + windowH / 2;
    ctx.drawImage(img, cx - (iw * fit) / 2, cy - (ih * fit) / 2, iw * fit, ih * fit);
    return;
  }

  const centerX = windowX + windowW / 2 + transform.offsetX * windowW;
  const centerY = windowY + windowH / 2 + transform.offsetY * windowW;

  if (options.showCutAreas) {
    ctx.save();
    ctx.globalAlpha = 0.28;
    drawWithTransform(editScalePx(transform), centerX, centerY, transform);
    ctx.restore();
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(windowX, windowY, windowW, windowH);
  ctx.clip();
  drawWithTransform(editScalePx(transform), centerX, centerY, transform);
  ctx.restore();
}

function wrapLine(ctx: CanvasRenderingContext2D, line: string, maxWidth: number): string[] {
  const words = line.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawCaption(ctx: CanvasRenderingContext2D, photo: PhotoDraft, format: PrintFormat, canvasWidth: number) {
  const layout = getPrintLayout(format);
  const area = layout.captionArea;
  const { caption } = photo;
  if (!area || !caption.text.trim()) return;

  const fontSize = caption.size * canvasWidth;
  const windowW = layout.window.w * canvasWidth;
  const windowX = layout.window.x * canvasWidth;
  const top = area.top * canvasWidth;
  const bottom = area.bottom * canvasWidth;

  ctx.font = `${fontSize}px ${CAPTION_FONT_FAMILY[caption.font]}`;
  ctx.fillStyle = caption.color;
  ctx.textBaseline = 'middle';

  const x =
    caption.align === 'left' ? windowX : caption.align === 'right' ? windowX + windowW : canvasWidth / 2;
  ctx.textAlign = caption.align;

  const lines = caption.text
    .split('\n')
    .flatMap((line) => (line.trim() ? wrapLine(ctx, line, windowW) : ['']));
  const lineHeight = fontSize * 1.2;
  const blockHeight = lines.length * lineHeight;
  const startY = (top + bottom) / 2 - blockHeight / 2 + lineHeight / 2;

  lines.forEach((line, index) => {
    ctx.fillText(line, x, startY + index * lineHeight, windowW);
  });
}

export function renderPrint(
  canvas: HTMLCanvasElement,
  photo: PhotoDraft,
  format: PrintFormat,
  canvasWidth: number,
  options: RenderOptions = {},
) {
  const layout = getPrintLayout(format);
  const width = Math.round(canvasWidth);
  const height = Math.round(width * layout.cardHeight);
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = format.kind === 'polaroid' ? CARD_COLOR : ORIGINAL_BACKDROP;
  ctx.fillRect(0, 0, width, height);

  drawPhoto(ctx, photo, photo.transform, format, width, options);
  drawCaption(ctx, photo, format, width);
}

export function exportPrintBlob(photo: PhotoDraft, format: PrintFormat): Promise<Blob> {
  const canvas = document.createElement('canvas');
  renderPrint(canvas, photo, format, getPrintPixelWidth(format));

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        canvas.width = 0;
        canvas.height = 0;
        if (blob) resolve(blob);
        else reject(new Error('Não foi possível gerar o arquivo de impressão.'));
      },
      'image/jpeg',
      0.94,
    );
  });
}
