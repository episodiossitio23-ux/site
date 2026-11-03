import { supabase } from '@/lib/supabase';
import { createPhotoDraft } from '@/lib/photoFiles';
import { createDefaultTransform, DEFAULT_CAPTION } from '@/lib/printLayout';
import type { CustomerOrderItem } from '@/types/order';
import type { PhotoDraft, PrintFormat } from '@/types/store';

const MAX_QUANTITY = 100;

export interface RepeatResult {
  photos: PhotoDraft[];
  skipped: string[];
}

export async function loadRepeatablePhotos(items: CustomerOrderItem[], formats: PrintFormat[]): Promise<RepeatResult> {
  const photos: PhotoDraft[] = [];
  const skipped: string[] = [];

  for (const item of items) {
    const format = formats.find((f) => f.id === item.format_id);
    if (!format) {
      skipped.push(item.original_name);
      continue;
    }

    const { data, error } = await supabase.storage.from('print-files').download(item.original_path);
    if (error || !data) {
      skipped.push(item.original_name);
      continue;
    }

    const result = await createPhotoDraft(new File([data], item.original_name, { type: data.type }));
    if (!result.ok) {
      skipped.push(item.original_name);
      continue;
    }

    const caption = item.caption_style;
    const transform = item.crop_settings;
    photos.push({
      ...result.photo,
      formatId: format.id,
      quantity: Math.min(Math.max(item.quantity, 1), MAX_QUANTITY),
      caption: { ...DEFAULT_CAPTION, ...caption, text: item.caption },
      transform: typeof transform.zoom === 'number' ? { ...createDefaultTransform(), ...transform } : createDefaultTransform(),
      inCart: true,
    });
  }

  return { photos, skipped };
}
