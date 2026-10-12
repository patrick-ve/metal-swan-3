/**
 * localStorage-backed Store (docs/ARCHITECTURE.md §5.13). Every access is wrapped in try/catch
 * (storage can be disabled, full, or throw in private windows); when localStorage does not work
 * at all, the store silently falls back to memory for this session.
 */
import { MemoryStore, PrefixedStore, type Store } from './storage';

class LocalStore implements Store {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  set(key: string, value: string): boolean {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* storage unavailable: nothing to remove */
    }
  }

  keys(): string[] {
    try {
      const ls = window.localStorage;
      const out: string[] = [];
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i);
        if (k !== null) out.push(k);
      }
      return out;
    } catch {
      return [];
    }
  }
}

function localStorageWorks(): boolean {
  try {
    const k = '__ms3_probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

/** The game's persistent store; keys are namespaced with `prefix`. */
export function createBrowserStore(prefix = 'metal-swan-3:'): Store {
  return new PrefixedStore(localStorageWorks() ? new LocalStore() : new MemoryStore(), prefix);
}
