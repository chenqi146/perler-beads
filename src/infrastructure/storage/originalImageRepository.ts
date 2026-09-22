/** 原图单独存 IndexedDB，避免撑爆 localStorage；裁剪/抠图依赖真原图 */

const DB_NAME = 'perler-originals-v1';
const STORE = 'originals';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('open IndexedDB failed'));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

export async function putOriginalImage(patternId: string, dataUrl: string): Promise<void> {
  if (!patternId || !dataUrl || !dataUrl.startsWith('data:')) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('putOriginalImage failed'));
      tx.objectStore(STORE).put(dataUrl, patternId);
    });
    db.close();
  } catch (err) {
    console.warn('putOriginalImage failed:', err);
  }
}

export async function getOriginalImage(patternId: string): Promise<string | null> {
  if (!patternId) return null;
  try {
    const db = await openDb();
    const value = await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(patternId);
      req.onsuccess = () => {
        const v = req.result;
        resolve(typeof v === 'string' && v.startsWith('data:') ? v : null);
      };
      req.onerror = () => reject(req.error ?? new Error('getOriginalImage failed'));
    });
    db.close();
    return value;
  } catch (err) {
    console.warn('getOriginalImage failed:', err);
    return null;
  }
}

export async function deleteOriginalImage(patternId: string): Promise<void> {
  if (!patternId) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('deleteOriginalImage failed'));
      tx.objectStore(STORE).delete(patternId);
    });
    db.close();
  } catch (err) {
    console.warn('deleteOriginalImage failed:', err);
  }
}

/** 未保存图纸用的草稿键 */
export const DRAFT_ORIGINAL_KEY = '__draft__';
