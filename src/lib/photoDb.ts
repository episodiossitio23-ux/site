import type { PhotoMeta } from '@/types/store';

const DB_NAME = 'photo-store';
const DB_VERSION = 1;
const FILES = 'files';
const META = 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(FILES);
        request.result.createObjectStore(META);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

async function readAll<T>(storeName: string): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

async function readOne<T>(storeName: string, key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function writeTransaction(
  storeNames: string[],
  write: (tx: IDBTransaction) => void,
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, 'readwrite');
    write(tx);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function savePhotoFile(id: string, file: Blob): Promise<void> {
  return writeTransaction([FILES], (tx) => tx.objectStore(FILES).put(file, id));
}

export function savePhotoMetas(metas: PhotoMeta[]): Promise<void> {
  return writeTransaction([META], (tx) => {
    const store = tx.objectStore(META);
    metas.forEach((meta) => store.put(meta, meta.id));
  });
}

export function deletePhotoRecords(ids: string[]): Promise<void> {
  return writeTransaction([FILES, META], (tx) => {
    ids.forEach((id) => {
      tx.objectStore(FILES).delete(id);
      tx.objectStore(META).delete(id);
    });
  });
}

export interface StoredPhoto {
  meta: PhotoMeta;
  file: Blob | undefined;
}

export async function loadStoredPhotos(): Promise<StoredPhoto[]> {
  const metas = await readAll<PhotoMeta>(META);
  return Promise.all(
    metas.map(async (meta) => ({ meta, file: await readOne<Blob>(FILES, meta.id) })),
  );
}
