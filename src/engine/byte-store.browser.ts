import type { ByteStore } from './byte-store';

/**
 * A ByteStore in IndexedDB (one database, one object store, values are Uint8Arrays). Opening
 * fails softly: without IndexedDB (some private windows) `openIdbByteStore` returns null and
 * the game runs without a cache.
 */
const STORE = 'bytes';

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB request failed'));
  });
}

class IdbByteStore implements ByteStore {
  private readonly db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  private tx(mode: IDBTransactionMode): IDBObjectStore {
    return this.db.transaction(STORE, mode).objectStore(STORE);
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      const v: unknown = await req(this.tx('readonly').get(key));
      return v instanceof Uint8Array ? v : null;
    } catch {
      return null;
    }
  }

  async put(key: string, bytes: Uint8Array): Promise<boolean> {
    try {
      const t = this.db.transaction(STORE, 'readwrite');
      t.objectStore(STORE).put(bytes, key);
      await new Promise<void>((resolve, reject) => {
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error ?? new Error('IndexedDB write failed'));
        t.onabort = () => reject(t.error ?? new Error('IndexedDB write aborted'));
      });
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await req(this.tx('readwrite').delete(key));
    } catch {
      // A failed delete leaves a stale value; the cache rejects it by its tag.
    }
  }
}

/** Open (or create) the database `name`; null when IndexedDB is missing or blocked. */
export async function openIdbByteStore(name: string): Promise<ByteStore | null> {
  try {
    if (typeof indexedDB === 'undefined') return null;
    const open = indexedDB.open(name, 1);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE);
    };
    return new IdbByteStore(await req(open));
  } catch {
    return null;
  }
}

/**
 * A ByteStore that opens the database `name` on first use. Without IndexedDB it acts as an
 * empty store that keeps nothing.
 */
export function idbByteStore(name: string): ByteStore {
  let db: Promise<ByteStore | null> | null = null;
  const open = (): Promise<ByteStore | null> => (db ??= openIdbByteStore(name));
  return {
    get: async (key) => (await open())?.get(key) ?? null,
    put: async (key, bytes) => (await open())?.put(key, bytes) ?? false,
    delete: async (key) => {
      await (await open())?.delete(key);
    },
  };
}
