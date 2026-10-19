/**
 * npm run cache-check -- --url http://127.0.0.1:4173/ [--timeout 120000] [--headed]
 *
 * Browser check of the caches of a production build (docs/ARCHITECTURE.md §5.4), run by CI on
 * the built site after the smoke test. In one fresh Chromium profile:
 * 1. first visit: the boot ends, the sprite cache saves its 'boot' pack and the offline cache
 *    (service worker) takes over the page;
 * 2. second visit: the boot installs the 'boot' pack (no sprite of the boot set is generated);
 * 3. offline: the page still loads, the boot ends and a key opens the title.
 * The art pool's worker chunk (assets/art-worker-*.js) must be in the service worker's precache
 * list and in its cache, and it must build a sprite in a module worker online and offline.
 * Prints the boot times and a JSON summary. Exit code 1 when a step fails or the page threw.
 * The site must be a production build (the dev server has no caches).
 */
import type { BrowserContext, Page } from 'playwright';

interface Args {
  url: string;
  timeout: number;
  headed: boolean;
}

const USAGE = 'usage: npm run cache-check -- --url http://127.0.0.1:4173/ [--timeout 120000] [--headed]';

function parseArgs(argv: readonly string[]): Args {
  const a: Args = { url: '', timeout: 120000, headed: false };
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    if (s === '--url') a.url = argv[++i] ?? '';
    else if (s === '--timeout') a.timeout = Math.max(10000, Number(argv[++i]) || a.timeout);
    else if (s === '--headed') a.headed = true;
    else throw new Error(`unknown argument ${s}\n${USAGE}`);
  }
  if (!a.url) throw new Error(`--url is required\n${USAGE}`);
  return a;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** The parts of the game's debug handle (window.__ms3, src/main.ts) this check reads. */
type Handle = {
  app: {
    scenes: { top: { constructor: { name: string }; ready?: boolean } | null };
    artCache: { restored: Map<string, number> } | null;
  };
};

interface BootState {
  scene: string;
  ready: boolean;
}

async function bootState(page: Page): Promise<BootState | null> {
  return page
    .evaluate(() => {
      const top = (window as unknown as { __ms3?: Handle }).__ms3?.app.scenes.top;
      return top ? { scene: top.constructor.name, ready: top.ready === true } : null;
    })
    .catch(() => null);
}

/** Open the site and wait until the boot scene is ready; returns the page and the boot time. */
async function visit(ctx: BrowserContext, url: string, timeout: number, errors: string[], label: string): Promise<{ page: Page; ms: number }> {
  const page = await ctx.newPage();
  // The password gate in index.html.
  page.on('dialog', (d) => void d.accept('SW4N'));
  page.on('pageerror', (e) => errors.push(`${label}: ${e.message}`));
  const t0 = Date.now();
  await page.goto(url);
  while (Date.now() - t0 < timeout) {
    const s = await bootState(page);
    if (s?.scene === 'BootScene' && s.ready) return { page, ms: Date.now() - t0 };
    await sleep(100);
  }
  throw new Error(`${label}: the boot did not end within ${timeout} ms`);
}

async function packKeys(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const r = indexedDB.open('ms3-cache', 1);
        r.onerror = () => resolve([]);
        r.onsuccess = () => {
          const db = r.result;
          if (!db.objectStoreNames.contains('bytes')) return resolve([]);
          const q = db.transaction('bytes').objectStore('bytes').getAllKeys();
          q.onsuccess = () => resolve(q.result.map(String));
          q.onerror = () => resolve([]);
        };
      }),
  );
}

/**
 * The art pool's worker chunk: listed in the service worker's PRECACHE, then a module worker of
 * it builds one 2× sprite (the art pool's request / reply). `known`: the chunk found before (the
 * offline visit; sw.js itself is not cached). Returns the chunk path.
 */
async function poolWorker(page: Page, label: string, known: string | null): Promise<string> {
  const r = await page.evaluate(async (known: string | null) => {
    const sw = known === null ? await (await fetch('sw.js')).text() : '';
    const m = /const PRECACHE = (\[.*?\]);/.exec(sw);
    const pre = m ? (JSON.parse(m[1]) as string[]) : [];
    const chunk = known ?? pre.find((p) => /^assets\/art-worker-[\w-]+\.js$/.test(p));
    if (!chunk) return { error: 'the art worker chunk is not in the precache list' };
    if (known === null) {
      let hit = false;
      for (const k of await caches.keys()) if (await (await caches.open(k)).match(new URL(chunk, location.href).href)) hit = true;
      if (!hit) return { error: `${chunk} is not in the offline cache` };
    }
    return await new Promise<{ error?: string; chunk?: string }>((resolve) => {
      const w = new Worker(new URL(chunk, location.href), { type: 'module' });
      const timer = setTimeout(() => resolve({ error: 'the art worker did not answer in 60 s' }), 60000);
      w.onerror = (e) => resolve({ error: `art worker: ${e.message}` });
      w.onmessage = (e: MessageEvent<{ t: string; pack?: { s: unknown[] }; message?: string }>) => {
        clearTimeout(timer);
        w.terminate();
        const d = e.data;
        resolve(d.t === 'done' && d.pack?.s.length === 1 ? { chunk } : { error: `art worker reply: ${JSON.stringify(d).slice(0, 200)}` });
      };
      w.postMessage({ t: 'build', job: 1, d: 2, ids: ['fx/explosion-s'] });
    });
  }, known);
  if (r.error) throw new Error(`${label}: ${r.error}`);
  return r.chunk as string;
}

async function waitFor(what: string, ms: number, test: () => Promise<boolean>): Promise<number> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await test()) return Date.now() - t0;
    await sleep(250);
  }
  throw new Error(`${what}: not within ${ms} ms`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: !args.headed });
  const errors: string[] = [];
  const summary: Record<string, unknown> = { url: args.url };
  let ok = false;
  try {
    const ctx = await browser.newContext({ viewport: { width: 1152, height: 648 } });

    const first = await visit(ctx, args.url, args.timeout, errors, 'first visit');
    summary.firstBootMs = first.ms;
    summary.bootPackSavedMs = await waitFor('the boot pack', 60000, async () => (await packKeys(first.page)).includes('sprites:boot'));
    summary.workerMs = await waitFor('the service worker', 60000, () =>
      first.page.evaluate(async () => {
        await navigator.serviceWorker.ready;
        return navigator.serviceWorker.controller !== null;
      }),
    );
    summary.artWorker = await poolWorker(first.page, 'first visit', null);
    await first.page.close();

    const second = await visit(ctx, args.url, args.timeout, errors, 'second visit');
    summary.secondBootMs = second.ms;
    const restored = await second.page.evaluate(() => (window as unknown as { __ms3?: Handle }).__ms3?.app.artCache?.restored.get('boot') ?? 0);
    summary.restoredIds = restored;
    if (restored < 100) throw new Error(`second visit: the boot installed ${restored} cached sprite ids`);
    await second.page.close();

    await ctx.setOffline(true);
    const off = await visit(ctx, args.url, args.timeout, errors, 'offline visit');
    summary.offlineBootMs = off.ms;
    await poolWorker(off.page, 'offline visit', summary.artWorker as string);
    await off.page.keyboard.press('Enter');
    await waitFor('the title offline', 15000, async () => (await bootState(off.page))?.scene === 'TitleScene');
    await off.page.close();
    await ctx.close();
    ok = errors.length === 0;
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  } finally {
    await browser.close().catch(() => {});
  }
  summary.ok = ok;
  summary.errors = errors;
  console.log(JSON.stringify(summary, null, 2));
  process.exit(ok ? 0 : 1);
}

void main();
