/**
 * Key-value storage for settings, bindings and high scores (docs/ARCHITECTURE.md §5.13).
 * `MemoryStore` here; `createBrowserStore()` in storage.browser.ts wraps localStorage.
 * Values are strings; use `loadJson` / `saveJson` for structured data. Nothing here throws.
 */

export interface Store {
  get(key: string): string | null;
  /** Returns false when the value could not be stored (quota, blocked storage). */
  set(key: string, value: string): boolean;
  remove(key: string): void;
  keys(): string[];
}

export class MemoryStore implements Store {
  private readonly map = new Map<string, string>();

  get(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  set(key: string, value: string): boolean {
    this.map.set(key, value);
    return true;
  }

  remove(key: string): void {
    this.map.delete(key);
  }

  keys(): string[] {
    return [...this.map.keys()];
  }
}

/** A view of another store where every key gets a prefix (e.g. 'ms3:'). */
export class PrefixedStore implements Store {
  private readonly inner: Store;
  readonly prefix: string;

  constructor(inner: Store, prefix: string) {
    this.inner = inner;
    this.prefix = prefix;
  }

  get(key: string): string | null {
    return this.inner.get(this.prefix + key);
  }

  set(key: string, value: string): boolean {
    return this.inner.set(this.prefix + key, value);
  }

  remove(key: string): void {
    this.inner.remove(this.prefix + key);
  }

  keys(): string[] {
    return this.inner
      .keys()
      .filter((k) => k.startsWith(this.prefix))
      .map((k) => k.slice(this.prefix.length));
  }
}

/**
 * Read JSON. Returns `fallback` when the key is missing, the JSON is broken, or `validate`
 * rejects the value. `validate` may also repair the value and return it.
 */
export function loadJson<T>(store: Store, key: string, fallback: T, validate?: (v: unknown) => T | null): T {
  const raw = store.get(key);
  if (raw === null) return fallback;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return fallback;
  }
  if (!validate) return v as T;
  try {
    const ok = validate(v);
    return ok === null ? fallback : ok;
  } catch {
    return fallback;
  }
}

export function saveJson(store: Store, key: string, value: unknown): boolean {
  let raw: string;
  try {
    raw = JSON.stringify(value);
  } catch {
    return false;
  }
  return store.set(key, raw);
}
