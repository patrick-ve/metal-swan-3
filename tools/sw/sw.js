/*
 * Metal Swan 3 offline cache (docs/ARCHITECTURE.md §5.4 "Offline cache"). This is the template:
 * tools/sw/plugin.ts fills in BUILD, FILES and PRECACHE and writes dist/sw.js at build time.
 *
 * - FILES: every published file (path relative to the site) and a hash of its content. A cached
 *   copy is used only while its hash (header x-ms3-rev) is the one in FILES, so a deploy fetches
 *   just the files that changed, and never serves an old copy of a changed file.
 * - install: fetch the PRECACHE files (the page, the scripts, the boot audio) that are missing
 *   or old, then take over at once.
 * - activate: drop cached files that are no longer in FILES and the caches of older versions.
 * - fetch: a page load goes to the network first (an update shows at once) and falls back to
 *   the cached page offline; a file in FILES comes from the cache, else from the network (and
 *   is cached); everything else passes through.
 */
/* global BUILD, FILES, PRECACHE */
const CACHE = 'ms3-offline';
const REV = 'x-ms3-rev';
const PARALLEL = 6;
const scope = new URL(self.registration.scope);

/** Path of a URL relative to the site ('' → 'index.html'), or null outside the site. */
function pathOf(url) {
  const u = new URL(url);
  if (u.origin !== scope.origin || !u.pathname.startsWith(scope.pathname)) return null;
  const p = decodeURIComponent(u.pathname.slice(scope.pathname.length));
  return p === '' ? 'index.html' : p;
}

function urlOf(path) {
  return new URL(encodeURI(path), scope).href;
}

async function store(cache, path, res) {
  const headers = new Headers(res.headers);
  headers.set(REV, FILES[path]);
  const body = await res.blob();
  await cache.put(urlOf(path), new Response(body, { status: res.status, statusText: res.statusText, headers }));
}

/** Fetch a file (revalidated, never a stale HTTP-cache copy) and cache a good answer. */
async function fetchAndStore(cache, path) {
  const res = await fetch(urlOf(path), { cache: 'no-cache' });
  if (res.ok && res.status === 200) await store(cache, path, res.clone());
  return res;
}

async function fresh(cache, path) {
  const hit = await cache.match(urlOf(path));
  return hit && hit.headers.get(REV) === FILES[path] ? hit : null;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const todo = PRECACHE.filter((p) => p in FILES);
      const worker = async () => {
        while (todo.length > 0) {
          const path = todo.shift();
          if (await fresh(cache, path)) continue;
          try {
            await fetchAndStore(cache, path);
          } catch {
            // Offline or a server error: the file is fetched again when the game asks for it.
          }
        }
      };
      await Promise.all(Array.from({ length: PARALLEL }, worker));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (name.startsWith('ms3-') && name !== CACHE) await caches.delete(name);
      const cache = await caches.open(CACHE);
      for (const req of await cache.keys()) {
        const path = pathOf(req.url);
        if (path === null || !(path in FILES)) await cache.delete(req);
      }
      await self.clients.claim();
    })(),
  );
});

async function page(req) {
  try {
    return await fetch(req);
  } catch (err) {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(urlOf('index.html'));
    if (hit) return hit;
    throw err;
  }
}

async function asset(path) {
  const cache = await caches.open(CACHE);
  const hit = await fresh(cache, path);
  if (hit) return hit;
  try {
    return await fetchAndStore(cache, path);
  } catch (err) {
    // Offline: an older copy is better than nothing (the game then falls back to the synth).
    const old = await cache.match(urlOf(path));
    if (old) return old;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const path = pathOf(req.url);
  if (path === null) return;
  if (req.mode === 'navigate') {
    event.respondWith(page(req));
    return;
  }
  if (!(path in FILES) || req.headers.has('range')) return;
  event.respondWith(asset(path));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'version' && event.ports[0]) event.ports[0].postMessage({ build: BUILD });
});
