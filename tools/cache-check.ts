/**
 * npm run cache-check -- --url http://127.0.0.1:4173/ [--timeout 120000] [--headed]
 *
 * Browser check of the caches of a production build (docs/ARCHITECTURE.md §5.4), run by CI on
 * the built site after the smoke test. In one fresh Chromium profile:
 * 1. first visit: the boot ends, the sprite cache saves its 'boot' pack and the offline cache
 *    (service worker) takes over the page;
 * 2. second visit: the boot installs the 'boot' pack (no sprite of the boot set is generated);
 * 3. offline: the page still loads, the boot ends and a key opens the title.
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
