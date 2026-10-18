/**
 * The offline cache (docs/ARCHITECTURE.md §5.4 "Offline cache"): registers the service worker
 * that the production build writes (sw.js, made by tools/sw/plugin.ts), or removes it and its
 * caches (`?cache=0`). Failures only warn: the game works the same without it.
 */
const CACHE_PREFIX = 'ms3-';

export function registerOfflineCache(url = './sw.js'): void {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register(url, { scope: './' }).catch((err: unknown) => {
    console.warn('[offline] service worker not registered:', err);
  });
}

export async function removeOfflineCache(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister();
    }
    if (typeof caches !== 'undefined') {
      for (const name of await caches.keys()) if (name.startsWith(CACHE_PREFIX)) await caches.delete(name);
    }
  } catch (err) {
    console.warn('[offline] cannot remove the offline cache:', err);
  }
}
