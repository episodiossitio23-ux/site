import type { CaptionStyle, CropTransform, PrintFormat, QualityLevel, Rotation } from '@/types/store';

export const PRINT_DPI = 300;
export const MAX_ZOOM = 4;

export interface PrintWindow {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PrintLayout {
  cardHeight: number;
  window: PrintWindow;
  captionArea: { top: number; bottom: number } | null;
}

export function getPrintLayout(format: PrintFormat): PrintLayout {
  const cardHeight = format.height_cm / format.width_cm;

  if (format.kind === 'polaroid') {
    const margin = 0.06;
    const windowSize = 1 - margin * 2;
    const windowBottom = margin + windowSize;
    return {
      cardHeight,
      window: { x: margin, y: margin, w: windowSize, h: windowSize },
      captionArea: { top: windowBottom, bottom: cardHeight },
    };
  }

  return {
    cardHeight,
    window: { x: 0, y: 0, w: 1, h: cardHeight },
    captionArea: null,
  };
}

export const DEFAULT_CAPTION: CaptionStyle = {
  text: '',
  font: 'serif',
  size: 0.07,
  align: 'center',
  color: '#2b2b2b',
  frameColor: '#FFFEFA',
};

export function createDefaultTransform(): CropTransform {
  return { rotation: 0, flipH: false, flipV: false, zoom: 1, offsetX: 0, offsetY: 0 };
}

function rotatedSize(imgW: number, imgH: number, rotation: Rotation) {
  const odd = rotation === 90 || rotation === 270;
  return odd ? { rw: imgH, rh: imgW } : { rw: imgW, rh: imgH };
}

/**
 * All geometry is expressed in "window-width units": the crop window is 1 unit wide,
 * so the same numbers work for the on-screen preview and the full-resolution export.
 */
export function getScale(
  imgW: number,
  imgH: number,
  transform: CropTransform,
  windowAspect: number,
) {
  const { rw, rh } = rotatedSize(imgW, imgH, transform.rotation);
  const base = Math.max(1 / rw, windowAspect / rh);
  return base * transform.zoom;
}

export function clampTransform(
  transform: CropTransform,
  imgW: number,
  imgH: number,
  layout: PrintLayout,
): CropTransform {
  const windowAspect = layout.window.h / layout.window.w;
  const { rw, rh } = rotatedSize(imgW, imgH, transform.rotation);
  const scale = getScale(imgW, imgH, transform, windowAspect);
  const maxX = Math.max(0, (rw * scale - 1) / 2);
  const maxY = Math.max(0, (rh * scale - windowAspect) / 2);
  const zoom = Math.min(MAX_ZOOM, Math.max(1, transform.zoom));
  return {
    ...transform,
    zoom,
    offsetX: Math.min(maxX, Math.max(-maxX, transform.offsetX)),
    offsetY: Math.min(maxY, Math.max(-maxY, transform.offsetY)),
  };
}

export function getEffectiveDpi(
  imgW: number,
  imgH: number,
  transform: CropTransform,
  format: PrintFormat,
): number {
  const layout = getPrintLayout(format);
  const windowAspect = layout.window.h / layout.window.w;
  const scale = getScale(imgW, imgH, transform, windowAspect);
  const windowWidthInches = layout.window.w * (format.width_cm / 2.54);
  return 1 / scale / windowWidthInches;
}

export function getQualityLevel(dpi: number): QualityLevel {
  if (dpi >= 250) return 'excelente';
  if (dpi >= 150) return 'adequada';
  if (dpi >= 100) return 'baixa';
  return 'insuficiente';
}

export const QUALITY_LABEL: Record<QualityLevel, string> = {
  excelente: 'Qualidade excelente',
  adequada: 'Qualidade adequada',
  baixa: 'Resolução baixa',
  insuficiente: 'Resolução insuficiente',
};

export function getPrintPixelWidth(format: PrintFormat): number {
  return Math.round((format.width_cm / 2.54) * PRINT_DPI);
}
