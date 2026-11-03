import { createDefaultTransform, DEFAULT_CAPTION } from '@/lib/printLayout';
import type { PhotoDraft, PhotoMeta } from '@/types/store';

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'heic', 'heif'];

export type PhotoDraftResult = { ok: true; photo: PhotoDraft } | { ok: false; reason: string };

function hasAcceptedExtension(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return ACCEPTED_EXTENSIONS.includes(ext);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('decode'));
    image.src = url;
  });
}

export function revokePhotoUrl(photo: PhotoDraft) {
  URL.revokeObjectURL(photo.url);
}
export async function restorePhoto(meta: PhotoMeta, file: Blob): Promise<PhotoDraft | null> {
  const result = await createPhotoDraft(new File([file], meta.name, { type: file.type }));
  if (!result.ok) return null;
  return {
    ...result.photo,
    id: meta.id,
    formatId: meta.formatId,
    catalogVariantId: meta.catalogVariantId,
    quantity: meta.quantity,
    caption: { ...DEFAULT_CAPTION, ...meta.caption },
    transform: meta.transform,
    inCart: meta.inCart,
  };
}

export async function createPhotoDraft(file: File): Promise<PhotoDraftResult> {
  if (!hasAcceptedExtension(file.name)) {
    return { ok: false, reason: `${file.name}: formato não aceito. Use JPG, PNG ou HEIC.` };
  }
  if (file.size === 0) {
    return { ok: false, reason: `${file.name}: o arquivo está vazio ou danificado.` };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, reason: `${file.name}: o arquivo passa de 50 MB.` };
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await loadImage(url);
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('empty');
    return {
      ok: true,
      photo: {
        id: crypto.randomUUID(),
        name: file.name,
        file,
        url,
        image,
        formatId: null,
        catalogVariantId: null,
        quantity: 1,
        caption: { ...DEFAULT_CAPTION },
        transform: createDefaultTransform(),
        past: [],
        future: [],
        inCart: false,
      },
    };
  } catch {
    URL.revokeObjectURL(url);
    return {
      ok: false,
      reason: `${file.name}: não foi possível abrir esta foto. Se for HEIC, exporte como JPG e envie novamente.`,
    };
  }
}
