import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { deletePhotoRecords, loadStoredPhotos, savePhotoFile, savePhotoMetas } from '@/lib/photoDb';
import { restorePhoto, revokePhotoUrl } from '@/lib/photoFiles';
import type { CropTransform, PhotoDraft, PhotoMeta } from '@/types/store';

const HISTORY_LIMIT = 50;
const META_SAVE_DELAY_MS = 300;

function toMeta(photo: PhotoDraft): PhotoMeta {
  return {
    id: photo.id,
    name: photo.name,
    formatId: photo.formatId,
    quantity: photo.quantity,
    caption: photo.caption,
    transform: photo.transform,
    inCart: photo.inCart,
  };
}

interface StoreValue {
  photos: PhotoDraft[];
  addPhotos: (added: PhotoDraft[]) => void;
  updatePhoto: (id: string, patch: Partial<PhotoDraft>) => void;
  removePhoto: (id: string) => void;
  clearCart: () => void;
  previewTransform: (id: string, transform: CropTransform) => void;
  commitTransform: (id: string, transform: CropTransform) => void;
  undoTransform: (id: string) => void;
  redoTransform: (id: string) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [ready, setReady] = useState(false);
  const knownIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadStoredPhotos().catch(() => []);
      const restored = await Promise.all(
        stored.map(async ({ meta, file }) => (file ? restorePhoto(meta, file) : null)),
      );
      const drafts = restored.flatMap((photo) => (photo ? [photo] : []));
      const failedIds = stored.flatMap(({ meta }, index) => (restored[index] ? [] : [meta.id]));
      if (cancelled) {
        drafts.forEach(revokePhotoUrl);
        return;
      }
      if (failedIds.length) void deletePhotoRecords(failedIds);
      knownIds.current = new Set(drafts.map((p) => p.id));
      setPhotos(drafts);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const currentIds = new Set(photos.map((p) => p.id));
    const removed = [...knownIds.current].filter((id) => !currentIds.has(id));
    const added = photos.filter((p) => !knownIds.current.has(p.id));
    knownIds.current = currentIds;
    if (removed.length) void deletePhotoRecords(removed);
    added.forEach((p) => void savePhotoFile(p.id, p.file));
    const timer = setTimeout(() => {
      void savePhotoMetas(photos.map(toMeta));
    }, META_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [photos, ready]);

  const addPhotos = useCallback((added: PhotoDraft[]) => {
    setPhotos((prev) => [...prev, ...added]);
  }, []);

  const updatePhoto = useCallback((id: string, patch: Partial<PhotoDraft>) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const removePhoto = useCallback(
    (id: string) => {
      photos.filter((p) => p.id === id).forEach(revokePhotoUrl);
      setPhotos((prev) => prev.filter((p) => p.id !== id));
    },
    [photos],
  );

  const clearCart = useCallback(() => {
    photos.filter((p) => p.inCart).forEach(revokePhotoUrl);
    setPhotos((prev) => prev.filter((p) => !p.inCart));
  }, [photos]);

  const previewTransform = useCallback((id: string, transform: CropTransform) => {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, transform } : p)));
  }, []);

  const commitTransform = useCallback((id: string, transform: CropTransform) => {
    setPhotos((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, transform, past: [...p.past, p.transform].slice(-HISTORY_LIMIT), future: [] }
          : p,
      ),
    );
  }, []);

  const undoTransform = useCallback((id: string) => {
    setPhotos((prev) =>
      prev.map((p) => {
        if (p.id !== id || p.past.length === 0) return p;
        return {
          ...p,
          transform: p.past[p.past.length - 1],
          past: p.past.slice(0, -1),
          future: [p.transform, ...p.future],
        };
      }),
    );
  }, []);

  const redoTransform = useCallback((id: string) => {
    setPhotos((prev) =>
      prev.map((p) => {
        if (p.id !== id || p.future.length === 0) return p;
        return {
          ...p,
          transform: p.future[0],
          past: [...p.past, p.transform].slice(-HISTORY_LIMIT),
          future: p.future.slice(1),
        };
      }),
    );
  }, []);

  const value = useMemo(
    () => ({
      photos,
      addPhotos,
      updatePhoto,
      removePhoto,
      clearCart,
      previewTransform,
      commitTransform,
      undoTransform,
      redoTransform,
    }),
    [
      photos,
      addPhotos,
      updatePhoto,
      removePhoto,
      clearCart,
      previewTransform,
      commitTransform,
      undoTransform,
      redoTransform,
    ],
  );

  if (!ready) return null;

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside StoreProvider');
  return value;
}
