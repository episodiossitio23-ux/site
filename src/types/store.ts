export type FormatKind = 'tradicional' | 'quadrada' | 'polaroid';

export interface PrintFormat {
  id: string;
  code: string;
  label: string;
  kind: FormatKind;
  width_cm: number;
  height_cm: number;
  price_cents: number;
  is_active: boolean;
  sort_order: number;
}

export type Rotation = 0 | 90 | 180 | 270;

export interface CropTransform {
  rotation: Rotation;
  flipH: boolean;
  flipV: boolean;
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export type CaptionAlign = 'left' | 'center' | 'right';
export type CaptionFont = 'serif' | 'sans' | 'hand';

export interface CaptionStyle {
  text: string;
  font: CaptionFont;
  size: number;
  align: CaptionAlign;
  color: string;
  frameColor: string;
}

export interface PhotoDraft {
  id: string;
  name: string;
  file: File;
  url: string;
  image: HTMLImageElement;
  formatId: string | null;
  catalogVariantId: string | null;
  quantity: number;
  caption: CaptionStyle;
  transform: CropTransform;
  past: CropTransform[];
  future: CropTransform[];
  inCart: boolean;
}

export type PhotoMeta = Pick<
  PhotoDraft,
  'id' | 'name' | 'formatId' | 'catalogVariantId' | 'quantity' | 'caption' | 'transform' | 'inCart'
>;

export type QualityLevel = 'excelente' | 'adequada' | 'baixa' | 'insuficiente';
