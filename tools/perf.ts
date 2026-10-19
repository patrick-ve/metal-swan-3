/**
 * npm run perf -- [--port 4179] [--url http://host:port/] [--query "mission=ams&section=d&boss=1&god=1"]
 *                 [--gfx pixel,smooth,xbr] [--viewport 1920x1080,3840x2160] [--dpr 1] [--seconds 10]
 *                 [--headed] [--gpu]
 *
 * Browser frame-time measurement (docs/ARCHITECTURE.md §3): serves the production build (dist/,
 * run `npm run build` first) with `vite preview` on --port (strict: the port must be free; or
 * uses --url), opens Chromium (Playwright) for every viewport × graphics mode with
 * `?<query>&gfx=<gfx>`, clicks the canvas, lets the game run for --seconds and reads the
 * render + present time of every frame (window.__ms3.frames, recorded by main.ts) and the
 * requestAnimationFrame intervals. --art runs every ART DETAIL value given (`?art=`; default
 * auto: a 3840×2160 viewport at dpr 1 is display scale 10 → art tier 4 with k 8). Prints one JSON
 * line per run: art tier, backbuffer resolution, average
 * / p95 / max frame time (ms), average frame interval and fps, texture cache numbers.
 * Headless Chromium rasterises on the CPU (SwiftShader) unless --gpu asks for the hardware GPU
 * (ANGLE / Metal on macOS); without it absolute numbers are pessimistic, so compare modes and
 * sizes with each other.
 */
import type { Browser } from 'playwright';

interface Args {
  port: number;
  url?: string;
  query: string;
  gfx: string[];
  viewports: Array<{ width: number; height: number }>;
  dpr: number;
  seconds: number;
  headed: boolean;
  gpu: boolean;
  /** ART DETAIL per run (`?art=`): 'auto' (the display picks: 4K → tier 4, k 8), '4', '2', '1'. */
  art: string[];
}

const USAGE =
  'usage: npm run perf -- [--port 4179] [--url http://127.0.0.1:4179/] [--query "mission=ams&section=d&boss=1&god=1"] ' +
  '[--gfx pixel,smooth,xbr] [--viewport 1920x1080,3840x2160] [--dpr 1] [--seconds 10] [--art auto,4,2] [--headed] [--gpu]';

function parseArgs(argv: readonly string[]): Args {
  const a: Args = {
    port: 4179,
    query: 'mission=ams&section=d&boss=1&god=1',
    gfx: ['pixel', 'smooth', 'xbr'],
    viewports: [
      { width: 1920, height: 1080 },
      { width: 3840, height: 2160 },
    ],
    dpr: 1,
    seconds: 10,
    headed: false,
    gpu: false,
    art: ['auto'],
  };
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    const next = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`missing value after ${s}\n${USAGE}`);
      return v;
    };
    switch (s) {
      case '--port':
        a.port = Number(next());
        if (!Number.isInteger(a.port) || a.port <= 0) throw new Error(`bad --port\n${USAGE}`);
        break;
      case '--url':
        a.url = next();
        break;
      case '--query':
        a.query = next().replace(/^\?/, '');
        break;
      case '--gfx':
        a.gfx = next()
          .split(',')
          .map((g) => g.trim())
          .filter(Boolean);
        break;
      case '--viewport':
        a.viewports = next()
          .split(',')
          .map((v) => {
            const m = /^(\d{2,5})x(\d{2,5})$/i.exec(v.trim());
            if (!m) throw new Error(`--viewport needs WxH[,WxH], e.g. 1920x1080\n${USAGE}`);
            return { width: Number(m[1]), height: Number(m[2]) };
          });
        break;
      case '--dpr':
        a.dpr = Number(next());
        if (!(a.dpr > 0 && a.dpr <= 4)) throw new Error(`bad --dpr\n${USAGE}`);
        break;
      case '--seconds':
        a.seconds = Math.max(1, Math.min(120, Number(next()) || a.seconds));
        break;
      case '--headed':
        a.headed = true;
        break;
      case '--art':
        a.art = next()
          .split(',')
          .map((v) => v.trim().toLowerCase())
          .filter((v) => v === 'auto' || v === '1' || v === '2' || v === '4');
        if (a.art.length === 0) throw new Error(`--art takes auto,4,2,1\n${USAGE}`);
        break;
      case '--gpu':
        a.gpu = true;
        break;
      case '--help':
      case '-h':
        console.log(USAGE);
        process.exit(0);
        break;
      default:
        throw new Error(`unknown option ${s}\n${USAGE}`);
    }
  }
  return a;
}

interface PageStats {
  res: number;
  mode: string;
  tier: number;
  frames: number[];
  intervals: number[];
  textures: { entries: number; px: number; evicted: number } | null;
}

/** Runs in the page: frame times from window.__ms3.frames, rAF intervals, texture numbers. */
const MEASURE = `(async () => {
  const h = window.__ms3;
  const start = h.frames.count;
  const intervals = [];
  let last = performance.now();
  let on = true;
  function tick(t) {
    intervals.push(t - last);
    last = t;
    if (on) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  await new Promise((r) => setTimeout(r, SECONDS * 1000));
  on = false;
  const n = Math.min(h.frames.count - start, h.frames.ms.length);
  const frames = [];
  for (let i = h.frames.count - n; i < h.frames.count; i++) frames.push(h.frames.ms[i % h.frames.ms.length]);
  return { res: h.renderer.res, mode: h.renderer.mode, tier: h.tier ? h.tier() : 0, frames, intervals: intervals.slice(1), textures: h.renderer.textureStats() };
})()`;

function pct(list: readonly number[], p: number): number {
  if (!list.length) return 0;
  const s = [...list].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))];
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  let server: { close(): Promise<void> } | null = null;
  let browser: Browser | null = null;
  try {
    let base = args.url;
    if (!base) {
      const { preview } = await import('vite');
      const p = await preview({ logLevel: 'error', preview: { port: args.port, strictPort: true, host: '127.0.0.1' } });
      server = { close: () => p.close() };
      base = `http://127.0.0.1:${args.port}/`;
    }
    const { chromium } = await import('playwright');
    const gpuArgs = ['--enable-gpu', '--ignore-gpu-blocklist', ...(process.platform === 'darwin' ? ['--use-angle=metal'] : [])];
    browser = await chromium.launch({ headless: !args.headed, args: args.gpu ? gpuArgs : [] });
    for (const vp of args.viewports) {
      for (const art of args.art) {
        for (const gfx of args.gfx) {
          const page = await browser.newPage({ viewport: vp, deviceScaleFactor: args.dpr });
          // The password gate in index.html.
          page.on('dialog', (d) => void d.accept('SW4N'));
          const errors: string[] = [];
          page.on('pageerror', (e) => errors.push(e.message));
          const url = `${base}?${args.query}${args.query ? '&' : ''}gfx=${gfx}${art === 'auto' ? '' : `&art=${art}`}`;
          await page.goto(url, { waitUntil: 'load' });
          await page.locator('#game').click();
          // Class names are minified in the build: the gameplay scene is the one with a runner, the
          // first-person scene (`?mode=fps`, spec §10) the one with a `game`.
          await page.waitForFunction(() => {
            const app = (window as unknown as { __ms3?: { app: { scenes: { top: { runner?: unknown; game?: unknown } | null } } } }).__ms3?.app;
            const top = app?.scenes.top;
            return !!(top?.runner || top?.game);
          }, undefined, { timeout: 60_000, polling: 100 });
          // Warm up (first uploads and upscales), then measure.
          await page.waitForTimeout(2000);
          // A plain string: tsx would wrap named functions in a helper the page does not have.
          const stats = (await page.evaluate(MEASURE.replace('SECONDS', String(args.seconds)))) as PageStats;
          const avg = stats.frames.reduce((a, v) => a + v, 0) / Math.max(1, stats.frames.length);
          const iv = stats.intervals.reduce((a, v) => a + v, 0) / Math.max(1, stats.intervals.length);
          console.log(
            JSON.stringify({
              viewport: `${vp.width}x${vp.height}@${args.dpr}`,
              gpu: args.gpu,
              gfx,
              art,
              tier: stats.tier,
              res: stats.res,
              mode: stats.mode,
              frames: stats.frames.length,
              avgMs: r2(avg),
              p95Ms: r2(pct(stats.frames, 0.95)),
              maxMs: r2(Math.max(0, ...stats.frames)),
              avgIntervalMs: r2(iv),
              fps: r2(1000 / Math.max(1e-6, iv)),
              textures: stats.textures,
              errors,
            }),
          );
          await page.close();
        }
      }
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) await server.close().catch(() => {});
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
