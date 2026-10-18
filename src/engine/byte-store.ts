/**
 * Large binary values by key (docs/ARCHITECTURE.md §5.4 "Sprite cache"): the sprite cache keeps
 * its packs here. `MemoryByteStore` here; `openIdbByteStore()` in byte-store.browser.ts uses
 * IndexedDB. A store may lose its values at any time (the browser clears site data): callers
 * treat a missing value as a cache miss. Nothing here throws to the caller of `get`.
 */
export interface ByteStore {
  /** The value, or null (missing, or the store failed). */
  get(key: string): Promise<Uint8Array | null>;
  /** Store a value; false when it could not be stored (quota, blocked storage). */
  put(key: string, bytes: Uint8Array): Promise<boolean>;
  delete(key: string): Promise<void>;
}

export class MemoryByteStore implements ByteStore {
  readonly map = new Map<string, Uint8Array>();

  get(key: string): Promise<Uint8Array | null> {
    return Promise.resolve(this.map.get(key) ?? null);
  }

  put(key: string, bytes: Uint8Array): Promise<boolean> {
    this.map.set(key, bytes);
    return Promise.resolve(true);
  }

  delete(key: string): Promise<void> {
    this.map.delete(key);
    return Promise.resolve();
  }
}
