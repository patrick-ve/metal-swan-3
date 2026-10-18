/**
 * The offline cache (docs/ARCHITECTURE.md §5.4 "Offline cache"): tools/sw/plugin.ts and the
 * service worker template tools/sw/sw.js, run here in a fake worker (fake caches, network and
 * events). The browser check of the built site is tools/cache-check.ts (CI).
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { HAND_MUSIC } from '../../src/game/content/samples/index';
import { SAMPLE_MANIFEST } from '../../src/game/content/samples/manifest';
import { listFiles, precached, renderServiceWorker, revOf, SW_FILE } from '../../tools/sw/plugin';

const TEMPLATE = readFileSync(new URL('../../tools/sw/sw.js', import.meta.url), 'utf8');
const SCOPE = 'https://example.test/game/';

/** Every file of a sample group (paths under public/audio/). */
function groupFiles(name: string): string[] {
  const g = { ...SAMPLE_MANIFEST[name as keyof typeof SAMPLE_MANIFEST] } as Record<string, Record<string, { files?: string[]; file?: string }> | undefined>;
  const music = { ...g.music, ...HAND_MUSIC[name] } as Record<string, { file: string }>;
  const out: string[] = [];
  for (const kind of ['sfx', 'voice'] as const) for (const d of Object.values(g[kind] ?? {})) out.push(...(d.files ?? []));
  for (const d of Object.values(music)) out.push(d.file);
  return out;
}

describe('the precache list', () => {
  it('holds the page, the scripts and every file of the boot sample group, and no mission audio', () => {
    expect(precached('index.html')).toBe(true);
    expect(precached('assets/index-abc123.js')).toBe(true);
    const boot = groupFiles('boot');
    expect(boot.length).toBeGreaterThan(10);
    for (const f of boot) expect(precached(`audio/${f}`), f).toBe(true);
    for (const g of ['mission:ams', 'mode:fps']) for (const f of groupFiles(g)) expect(precached(`audio/${f}`), f).toBe(false);
  });
});

describe('the plugin', () => {
  it('lists every file with / paths, without sw.js, and hashes content', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ms3-sw-'));
    mkdirSync(join(dir, 'audio', 'boot'), { recursive: true });
    writeFileSync(join(dir, 'index.html'), 'x');
    writeFileSync(join(dir, 'audio', 'boot', 'a b.mp3'), 'y');
    writeFileSync(join(dir, SW_FILE), 'old');
    expect(listFiles(dir)).toEqual(['audio/boot/a b.mp3', 'index.html']);
    expect(revOf(new Uint8Array([1]))).not.toBe(revOf(new Uint8Array([2])));
    expect(revOf(new Uint8Array([1]))).toMatch(/^[0-9a-f]{16}$/);
  });

  it('fills the template with the build, the files and the precache list', () => {
    const src = renderServiceWorker(TEMPLATE, 'b1', { 'index.html': 'r1', 'audio/ams/x.mp3': 'r2' });
    expect(src).toContain('const BUILD = "b1";');
    expect(src).toContain('const PRECACHE = ["index.html"];');
    expect(src).not.toContain('/* global');
  });
});

// ------------------------------------------------------------------------------ a fake worker

class FakeCache {
  readonly map = new Map<string, Response>();
  match(req: string | Request): Promise<Response | undefined> {
    return Promise.resolve(this.map.get(typeof req === 'string' ? req : req.url)?.clone());
  }
  put(req: string | Request, res: Response): Promise<void> {
    this.map.set(typeof req === 'string' ? req : req.url, res);
    return Promise.resolve();
  }
  keys(): Promise<Request[]> {
    return Promise.resolve([...this.map.keys()].map((u) => new Request(u)));
  }
  delete(req: string | Request): Promise<boolean> {
    return Promise.resolve(this.map.delete(typeof req === 'string' ? req : req.url));
  }
}

interface Worker {
  caches: Map<string, FakeCache>;
  net: Map<string, string>;
  fetched: string[];
  offline: boolean;
  claimed: boolean;
  /** Run an install / activate event; resolves when its waitUntil work is done. */
  lifecycle(type: 'install' | 'activate'): Promise<void>;
  /** A fetch event: the response, or null when the worker lets it pass. */
  request(path: string, mode?: RequestMode): Promise<Response | null>;
}

function worker(files: Record<string, string>, net: Record<string, string>): Worker {
  const handlers = new Map<string, (e: unknown) => void>();
  const w: Worker = {
    caches: new Map(),
    net: new Map(Object.entries(net)),
    fetched: [],
    offline: false,
    claimed: false,
    async lifecycle(type) {
      let work: Promise<unknown> = Promise.resolve();
      handlers.get(type)?.({ waitUntil: (p: Promise<unknown>) => (work = p) });
      await work;
    },
    async request(path, mode = 'cors') {
      let out: Promise<Response> | null = null;
      const request = { url: new URL(path, SCOPE).href, method: 'GET', mode, headers: new Headers() };
      handlers.get('fetch')?.({ request, respondWith: (p: Promise<Response>) => (out = p) });
      return out;
    },
  };
  const caches = {
    open: (name: string) => {
      if (!w.caches.has(name)) w.caches.set(name, new FakeCache());
      return Promise.resolve(w.caches.get(name));
    },
    keys: () => Promise.resolve([...w.caches.keys()]),
    delete: (name: string) => Promise.resolve(w.caches.delete(name)),
  };
  const fetch = (input: string | { url: string }): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.url;
    if (w.offline) return Promise.reject(new TypeError('offline'));
    const path = decodeURIComponent(new URL(url).pathname.slice(new URL(SCOPE).pathname.length)) || 'index.html';
    w.fetched.push(path);
    const body = w.net.get(path);
    return Promise.resolve(body === undefined ? new Response('missing', { status: 404 }) : new Response(body, { status: 200 }));
  };
  const self = {
    registration: { scope: SCOPE },
    addEventListener: (type: string, fn: (e: unknown) => void) => handlers.set(type, fn),
    skipWaiting: () => Promise.resolve(),
    clients: {
      claim: () => {
        w.claimed = true;
        return Promise.resolve();
      },
    },
  };
  runInNewContext(renderServiceWorker(TEMPLATE, 'b1', files), { self, caches, fetch, URL, Headers, Response, Request, Blob, encodeURI, decodeURIComponent });
  return w;
}

const text = async (r: Response | null): Promise<string | null> => (r ? r.text() : null);

describe('the service worker', () => {
  const FILES = { 'index.html': 'r-index', 'assets/main-1.js': 'r-main', 'audio/boot/sfx/a b.mp3': 'r-boot', 'audio/ams/x.mp3': 'r-ams' };
  const NET = { 'index.html': '<html>', 'assets/main-1.js': 'main()', 'audio/boot/sfx/a b.mp3': 'BOOT', 'audio/ams/x.mp3': 'AMS', 'other.txt': 'other' };

  it('install fetches the precache files, then a file comes from the cache', async () => {
    const w = worker(FILES, NET);
    await w.lifecycle('install');
    expect(w.fetched.sort()).toEqual(['assets/main-1.js', 'audio/boot/sfx/a b.mp3', 'index.html']);
    w.fetched.length = 0;
    expect(await text(await w.request('audio/boot/sfx/a%20b.mp3'))).toBe('BOOT');
    expect(await text(await w.request('assets/main-1.js'))).toBe('main()');
    expect(w.fetched).toEqual([]);
  });

  it('caches other listed files when the game fetches them, and lets unlisted ones pass', async () => {
    const w = worker(FILES, NET);
    expect(await text(await w.request('audio/ams/x.mp3'))).toBe('AMS');
    expect(await text(await w.request('audio/ams/x.mp3'))).toBe('AMS');
    expect(w.fetched).toEqual(['audio/ams/x.mp3']);
    expect(await w.request('other.txt')).toBeNull();
    expect(await w.request('https://elsewhere.test/game/index.html')).toBeNull();
  });

  it('fetches a file again when its cached copy has another hash (a deploy changed it)', async () => {
    const old = worker({ ...FILES, 'audio/ams/x.mp3': 'r-old' }, { ...NET, 'audio/ams/x.mp3': 'OLD' });
    await old.request('audio/ams/x.mp3');
    const w = worker(FILES, NET);
    w.caches = old.caches;
    expect(await text(await w.request('audio/ams/x.mp3'))).toBe('AMS');
    expect(w.fetched).toEqual(['audio/ams/x.mp3']);
  });

  it('serves pages from the network, and the cached page offline', async () => {
    const w = worker(FILES, NET);
    await w.lifecycle('install');
    w.net.set('index.html', '<html v2>');
    expect(await text(await w.request('?mission=ams', 'navigate'))).toBe('<html v2>');
    w.offline = true;
    expect(await text(await w.request('?mission=ams', 'navigate'))).toBe('<html>');
    expect(await text(await w.request('assets/main-1.js'))).toBe('main()');
    // Offline and never cached: the request fails (the game falls back to the synth).
    await expect(w.request('audio/ams/x.mp3')).rejects.toThrow();
  });

  it('activate drops unlisted files and older ms3 caches, keeps other caches, and takes over', async () => {
    const w = worker(FILES, NET);
    await w.lifecycle('install');
    const cache = w.caches.get('ms3-offline');
    await cache?.put(new URL('assets/main-0.js', SCOPE).href, new Response('old'));
    w.caches.set('ms3-v0', new FakeCache());
    w.caches.set('someone-else', new FakeCache());
    await w.lifecycle('activate');
    expect([...w.caches.keys()].sort()).toEqual(['ms3-offline', 'someone-else']);
    expect([...(cache?.map.keys() ?? [])].map((u) => u.slice(SCOPE.length)).sort()).toEqual(['assets/main-1.js', 'audio/boot/sfx/a%20b.mp3', 'index.html']);
    expect(w.claimed).toBe(true);
  });
});
