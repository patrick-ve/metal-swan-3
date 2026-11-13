/**
 * npm run shot3d -- [--url http://127.0.0.1:5551/ | --port 5560] [--query "mission=rally&players=2"]
 *                   [--art 1|2|4] [--players 2] [--cam chase|bumper] [--lap n] [--seed n]
 *                   [--size 1152x648] [--dpr 1] [--ticks 120] [--keys KeyZ,ArrowLeft] [--out tmp/shot3d.png]
 *                   [--at 2400[,3100,…] [--speed 150] [--no-auto]] [--until "<js>" [--freeze]]
 *                   [--gpu] [--headed] [--timeout 90000]
 * npm run shot3d -- --orbit estate-white [--density 4] [--ps1 snap=0,affine=0] [--out tmp/x.png] [--gpu]
 * npm run shot3d -- --test-scene scene [--density 1|2|4] [--players 2] [--t 0] [--ps1 dither=0] [--out tmp/x.png] [--gpu]
 *
 * Captures of the 3D view (docs/design/rally.md §12.1 "Tools", §14 items 5 and 8; docs/api/rally.md
 * "Tools") — v0 by PREP; GL completes it (orbit sheets of the models, captures per lap, camera,
 * tier, players). Node has no WebGL, so every visual check of the race runs in a browser.
 *
 * It opens headless Chromium (Playwright; without `--gpu` WebGL2 runs on SwiftShader, which
 * Playwright enables by itself; `--gpu` adds the flags of tools/perf.ts for the real GPU), loads the
 * game with `--query` (default `mission=rally`; `art=`, `players=`, `lap=`, `cam=`, `seed=` work as
 * in the game), answers the 6767 password dialog, clicks the canvas (the gesture), waits for the
 * RallyScene, FAILS when `window.__ms3.rally.gl.ok` is false (the reason is printed), holds
 * `--keys` (e.g. `KeyZ` = FIRE = gas), waits until `--ticks` race ticks after GO have passed, and
 * screenshots `#game` into `--out`. With `--url` it uses a running server; else it starts a Vite dev
 * server on `--port` (strict: the port must be free). Prints a JSON summary (the probe and the 3D
 * view's `stats()`: tris, draws, the frame interval, the density cap); exit code 1 on failure.
 * `--art`, `--players`, `--cam`, `--lap` and `--seed` add their URL params to the query.
 *
 * Without the game (no server; the WebGL2 view alone, bundled from tests/media/browser/gl3d-entry.ts
 * — `gl3d-orbit-entry.ts` with the rally content for `--orbit` — into a blank page, as the browser
 * 3D test does):
 * - `--orbit <model>`: a contact sheet of a rally model (a `RALLY_MODEL` id, e.g. `estate-white`)
 *   from 8 angles (4 × 2 views of 96 × 108 logical px) on a neutral grey, at `--density` (default 4);
 * - `--test-scene <name>`: a test scene of that bundle (`scene` = a small road scene; `flat`,
 *   `gradient`, `fog`, `snap`, `affine`, `frontal`, `cull`, `blend`, `split`), at `--density`
 *   (default 1), `--players 2` for the split screen, `--t` for the moving ones; also `nearfloor`, `bias`;
 * - `--ps1 snap=0,affine=0,dither=0,fog=0` switches traits off (default: all on, as in the game);
 *   on the game too (the 3D view's debug override `window.__ms3.gl3d.ps1Override`);
 * - `--eval "<js>"` (the game): runs in the page once the race is up, e.g.
 *   `--eval "__ms3.gl3d.affineNear = 0"` (tuning).
 * - `--at <m>[,<m>…]` (the game; INTEGRATE): after GO, put player 1's car `m` metres past the start
 *   line (P2 10 m behind it) at `--speed` km/h (default 150) with the debug autopilot on (the
 *   runner's `placeCar` / `setAutopilot`; `--no-auto` leaves the pad in charge), wait `--ticks`
 *   (default 60), capture; one capture per distance, into `--out` with `-<m>` before `.png` when
 *   more than one distance is given. A capture along the whole lap in one page load.
 * - `--until "<js>"` (the game): capture when this page expression turns true (instead of the
 *   race ticks), e.g. the glitch's fold: `--until "__ms3.app.scenes.top.foldT >= 20"`; with
 *   `--freeze` the scene updates stop at that moment (the capture shows exactly that state).
 * The page is clicked until the boot screen is gone (the user gesture; a single early click can be
 * lost while the boot still loads).
 * The PNG is the 3D canvas at its own size (384·d × 216·d).
 */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'playwright';
import { PixelBuffer } from '../src/engine/pixel';
import { savePNG } from './lib/image';

interface Args {
  url?: string;
  port: number;
  query: string;
  size: { width: number; height: number };
  dpr: number;
  ticks: number;
  keys: string[];
  out: string;
  gpu: boolean;
  headed: boolean;
  timeout: number;
  /** A rally model id: the orbit sheet (no game). */
  orbit?: string;
  /** A test scene of tests/media/browser/gl3d-entry.ts (no game). */
  testScene?: string;
  density?: 1 | 2 | 4;
  players?: number;
  t: number;
  ps1: Record<string, boolean>;
  /** JavaScript run in the game page before the capture (debug tuning, e.g. `__ms3.gl3d.affineNear = 0`). */
  eval?: string;
  /** Distances past the start line to capture at (m; the debug teleport), the speed there (km/h), the autopilot. */
  at: number[];
  speed: number;
  auto: boolean;
  /** A page expression: capture when it turns true; `freeze`: stop the scene updates at that moment. */
  until?: string;
  freeze: boolean;
}

const USAGE =
  'usage: npm run shot3d -- [--url http://127.0.0.1:5551/ | --port 5560] [--query "mission=rally&players=2"] [--art 1|2|4] [--players 2] ' +
  '[--cam chase|bumper] [--lap n] [--seed n] [--size 1152x648] [--dpr 1] [--ticks 120] [--keys KeyZ,ArrowLeft] [--out tmp/shot3d.png] ' +
  '[--gpu] [--headed] [--timeout 90000] [--ps1 affine=0,…] [--eval "<js>"] [--at m[,m…] [--speed kmh] [--no-auto]] [--until "<js>"]\n' +
  '       npm run shot3d -- (--orbit <model> | --test-scene <name>) [--density 1|2|4] [--players 2] [--t n] [--ps1 snap=0,affine=0,dither=0,fog=0] [--out x.png] [--gpu]';

function parseArgs(argv: readonly string[]): Args {
  const a: Args = { port: 5560, query: 'mission=rally', size: { width: 1152, height: 648 }, dpr: 1, ticks: 60, keys: [], out: 'tmp/shot3d.png', gpu: false, headed: false, timeout: 90000, t: 0, ps1: {}, at: [], speed: 150, auto: true, freeze: false };
  const extra: string[] = [];
  const param = (k: string, v: string): void => {
    extra.push(`${k}=${encodeURIComponent(v)}`);
  };
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    const next = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`missing value after ${s}\n${USAGE}`);
      return v;
    };
    switch (s) {
      case '--url':
        a.url = next();
        break;
      case '--port':
        a.port = Number(next());
        if (!Number.isInteger(a.port) || a.port <= 0) throw new Error(`bad --port\n${USAGE}`);
        break;
      case '--query':
        a.query = next().replace(/^\?/, '');
        break;
      case '--size': {
        const m = /^(\d{2,5})x(\d{2,5})$/i.exec(next());
        if (!m) throw new Error(`--size needs WxH, e.g. 1920x1080\n${USAGE}`);
        a.size = { width: Number(m[1]), height: Number(m[2]) };
        break;
      }
      case '--dpr':
        a.dpr = Number(next());
        if (!(a.dpr > 0 && a.dpr <= 4)) throw new Error(`bad --dpr\n${USAGE}`);
        break;
      case '--ticks':
        a.ticks = Math.max(0, Math.floor(Number(next()) || 0));
        break;
      case '--keys':
        a.keys = next()
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean);
        break;
      case '--out':
        a.out = next();
        break;
      case '--gpu':
        a.gpu = true;
        break;
      case '--headed':
        a.headed = true;
        break;
      case '--timeout':
        a.timeout = Math.max(5000, Number(next()) || a.timeout);
        break;
      case '--art': {
        const v = next();
        if (!/^(1|2|4)$/.test(v)) throw new Error(`--art needs 1, 2 or 4\n${USAGE}`);
        param('art', v);
        if (a.density === undefined) a.density = Number(v) as 1 | 2 | 4;
        break;
      }
      case '--players': {
        const v = next();
        if (!/^(1|2)$/.test(v)) throw new Error(`--players needs 1 or 2\n${USAGE}`);
        a.players = Number(v);
        param('players', v);
        break;
      }
      case '--cam': {
        const v = next();
        if (!/^(chase|bumper)$/.test(v)) throw new Error(`--cam needs chase or bumper\n${USAGE}`);
        param('cam', v);
        break;
      }
      case '--lap':
        param('lap', String(Math.max(1, Math.floor(Number(next()) || 1))));
        break;
      case '--seed':
        param('seed', String(Math.floor(Number(next()) || 0)));
        break;
      case '--orbit':
        a.orbit = next();
        break;
      case '--test-scene':
        a.testScene = next();
        break;
      case '--density': {
        const v = next();
        if (!/^(1|2|4)$/.test(v)) throw new Error(`--density needs 1, 2 or 4\n${USAGE}`);
        a.density = Number(v) as 1 | 2 | 4;
        break;
      }
      case '--t':
        a.t = Number(next()) || 0;
        break;
      case '--eval':
        a.eval = next();
        break;
      case '--at':
        a.at = next()
          .split(',')
          .map((v) => Number(v.trim()))
          .filter((v) => Number.isFinite(v));
        if (a.at.length === 0) throw new Error(`--at needs metres, e.g. 2400 or 300,1200\n${USAGE}`);
        break;
      case '--speed':
        a.speed = Math.max(0, Number(next()) || 0);
        break;
      case '--no-auto':
        a.auto = false;
        break;
      case '--until':
        a.until = next();
        break;
      case '--freeze':
        a.freeze = true;
        break;
      case '--ps1':
        for (const kv of next().split(',')) {
          const m = /^(snap|affine|dither|fog)=(0|1|on|off|true|false)$/.exec(kv.trim());
          if (!m) throw new Error(`--ps1 needs snap|affine|dither|fog=0|1, got "${kv}"\n${USAGE}`);
          a.ps1[m[1]] = m[2] === '1' || m[2] === 'on' || m[2] === 'true';
        }
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
  if (!/(^|&)mission=/.test(a.query)) a.query = `mission=rally${a.query ? `&${a.query}` : ''}`;
  for (const kv of extra) {
    const key = kv.slice(0, kv.indexOf('='));
    a.query = a.query.replace(new RegExp(`(^|&)${key}=[^&]*`), '');
    a.query = `${a.query}${a.query ? '&' : ''}${kv}`.replace(/^&/, '');
  }
  return a;
}

const GPU_ARGS = ['--enable-gpu', '--ignore-gpu-blocklist', ...(process.platform === 'darwin' ? ['--use-angle=metal'] : [])];

/** The IIFE of tests/media/browser/gl3d-entry.ts (`window.Gl3dTest`), built with Vite. */
async function gl3dBundle(file: string): Promise<string> {
  const { build } = await import('vite');
  const entry = fileURLToPath(new URL(`../tests/media/browser/${file}`, import.meta.url));
  const out = await build({
    configFile: false,
    logLevel: 'silent',
    build: { write: false, minify: false, lib: { entry, name: 'Gl3dTestBundle', formats: ['iife'], fileName: 'gl3d-test' } },
  });
  for (const o of Array.isArray(out) ? out : [out]) {
    if ('output' in o) {
      const chunk = o.output.find((c) => c.type === 'chunk');
      if (chunk && chunk.type === 'chunk') return chunk.code;
    }
  }
  throw new Error('vite produced no chunk');
}

interface BundleShot {
  w: number;
  h: number;
  rgba: string;
  stats: Record<string, unknown>;
  warnings: string[];
}

/** `--orbit` / `--test-scene`: the 3D view alone in a blank page. */
async function mainBundle(args: Args): Promise<void> {
  const summary: { ok: boolean; failure: string | null; out: string; info: unknown; stats: unknown; warnings: string[]; pageErrors: string[] } = {
    ok: false,
    failure: null,
    out: args.out,
    info: null,
    stats: null,
    warnings: [],
    pageErrors: [],
  };
  let browser: Browser | null = null;
  try {
    const code = await gl3dBundle(args.orbit ? 'gl3d-orbit-entry.ts' : 'gl3d-entry.ts');
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: !args.headed, args: args.gpu ? GPU_ARGS : [] });
    const page = await browser.newPage();
    page.on('pageerror', (e) => summary.pageErrors.push(e.message));
    page.setDefaultTimeout(args.timeout);
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ content: code });
    type T = { Gl3dTest: { info(): { ok: boolean; reason: string }; shot(n: string, o: unknown): BundleShot | null; orbit(id: string, o: unknown): BundleShot | null } };
    const info = await page.evaluate(() => (window as unknown as T).Gl3dTest.info());
    summary.info = info;
    if (!info.ok) throw new Error(`the 3D view is not OK: ${info.reason}`);
    const shot = args.orbit
      ? await page.evaluate(([id, o]) => (window as unknown as T).Gl3dTest.orbit(id as string, o), [args.orbit, { d: args.density ?? 4, ps1: args.ps1 }] as const)
      : await page.evaluate(([n, o]) => (window as unknown as T).Gl3dTest.shot(n as string, o), [args.testScene ?? 'scene', { d: args.density ?? 1, ps1: args.ps1, t: args.t, players: args.players ?? 1 }] as const);
    if (!shot) throw new Error('the 3D view drew nothing');
    savePNG(PixelBuffer.fromRGBA(shot.w, shot.h, Buffer.from(shot.rgba, 'base64')), args.out);
    summary.stats = shot.stats;
    summary.warnings = shot.warnings;
    summary.ok = summary.pageErrors.length === 0;
    if (!summary.ok) summary.failure = summary.pageErrors[0];
  } catch (err) {
    summary.failure = err instanceof Error ? err.message : String(err);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) process.exitCode = 1;
}

/** The probe (`window.__ms3.rally`, main.ts / rally-route.ts `rallyProbe`). */
interface Probe {
  gl: { ok: boolean; reason: string };
  scene: string;
  tick: number;
  raceTick: number;
  phase: string;
  lap: number;
  place: number;
  finished: boolean;
  players: number;
  cars: number;
  tris: number;
  draws: number;
  density: number;
}

async function probe(page: Page): Promise<Probe | null> {
  return page.evaluate(() => {
    const w = window as unknown as { __ms3?: { rally?: unknown } };
    return (w.__ms3?.rally ?? null) as never;
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.orbit || args.testScene) return mainBundle(args);
  const summary: { ok: boolean; failure: string | null; url: string; out: string; probe: Probe | null; gl3d: unknown; pageErrors: string[]; consoleErrors: string[] } = {
    ok: false,
    failure: null,
    url: '',
    out: args.out,
    probe: null,
    gl3d: null,
    pageErrors: [],
    consoleErrors: [],
  };
  let server: { close(): Promise<void> } | null = null;
  let browser: Browser | null = null;
  let gamePage: Page | null = null;
  try {
    let base = args.url;
    if (!base) {
      const { createServer } = await import('vite');
      const vite = await createServer({ logLevel: 'error', clearScreen: false, server: { port: args.port, strictPort: true, host: '127.0.0.1', watch: null, hmr: false } });
      server = vite;
      await vite.listen();
      base = `http://127.0.0.1:${args.port}/`;
    }
    const url = `${base}${base.includes('?') ? '&' : '?'}${args.query}`;
    summary.url = url;
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: !args.headed, args: args.gpu ? GPU_ARGS : [] });
    const page = await browser.newPage({ viewport: args.size, deviceScaleFactor: args.dpr });
    gamePage = page;
    page.on('dialog', (d) => void d.accept('6767'));
    page.on('pageerror', (e) => summary.pageErrors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') summary.consoleErrors.push(m.text().slice(0, 300));
    });
    page.setDefaultTimeout(args.timeout);
    await page.goto(url, { waitUntil: 'load' });
    // The user gesture: click until the boot screen is gone (an early click can be lost while it loads).
    const sceneNow = (): Promise<string> => page.evaluate(() => (window as unknown as { __ms3?: { app: { scenes: { top: object | null } } } }).__ms3?.app.scenes.top?.constructor.name ?? 'none');
    for (let i = 0; i < 40; i++) {
      await page.locator('#game').click();
      const name = await sceneNow();
      if (name !== 'BootScene' && name !== 'none') break;
      await page.waitForTimeout(250);
    }
    const wanted = args.until ? ['RallyGlitchScene', 'RallyScene', 'RallyNoGlScene', 'MissionCompleteScene'] : ['RallyScene', 'RallyNoGlScene', 'MissionCompleteScene'];
    await page.waitForFunction(
      (names) => {
        const p = (window as unknown as { __ms3?: { rally?: { scene: string } } }).__ms3?.rally;
        return !!p && names.includes(p.scene);
      },
      wanted,
      { timeout: args.timeout, polling: 50 },
    );
    const first = await probe(page);
    if (!first || !first.gl.ok) throw new Error(`the 3D view is not OK: ${first?.gl.reason ?? 'no probe'}`);
    if (args.eval) await page.evaluate(args.eval);
    if (Object.keys(args.ps1).length > 0) {
      // `--ps1` on the game: the 3D view's debug override (window.__ms3.gl3d.ps1Override).
      await page.evaluate((o) => {
        const v = (window as unknown as { __ms3?: { gl3d?: { ps1Override: unknown } } }).__ms3?.gl3d;
        if (v) v.ps1Override = o;
      }, args.ps1);
    }
    for (const k of args.keys) await page.keyboard.down(k);
    mkdirSync(dirname(args.out), { recursive: true });
    if (args.until) {
      // `--freeze`: the scenes stop updating the moment the expression holds (the draw goes on), so a
      // fast effect is captured at that state and not a few frames later.
      const expr = `(() => { const ok = !!(${args.until}); if (ok && ${args.freeze}) window.__ms3.app.scenes.update = () => {}; return ok; })()`;
      await page.waitForFunction(expr, undefined, { timeout: args.timeout, polling: 'raf' });
      await page.locator('#game').screenshot({ path: args.out });
    } else if (args.at.length > 0) {
      // After GO: one teleport and one capture per distance (the debug autopilot drives).
      await page.waitForFunction(
        () => {
          const p = (window as unknown as { __ms3?: { rally?: { raceTick: number } } }).__ms3?.rally;
          return !!p && p.raceTick >= 1;
        },
        undefined,
        { timeout: args.timeout, polling: 50 },
      );
      for (const at of args.at) {
        const t0 = await page.evaluate(
          ([m, kmh, auto]) => {
            type R = { placeCar(s: number, d: number, v: number): void; setAutopilot(s: number, on: boolean): void; carOf(s: number): unknown; race: { raceTick: number } };
            const r = (window as unknown as { __ms3: { app: { scenes: { top: { runner?: R } } } } }).__ms3.app.scenes.top.runner;
            if (!r) return -1;
            const v = (kmh as number) / 3.6;
            r.placeCar(0, m as number, v);
            if (r.carOf(1)) r.placeCar(1, (m as number) - 10, v);
            r.setAutopilot(0, auto as boolean);
            if (r.carOf(1)) r.setAutopilot(1, auto as boolean);
            return r.race.raceTick;
          },
          [at, args.speed, args.auto] as const,
        );
        if (t0 < 0) throw new Error('no race runner on top (paused?)');
        await page.waitForFunction(
          (n) => {
            const p = (window as unknown as { __ms3?: { rally?: { raceTick: number; phase: string } } }).__ms3?.rally;
            return !!p && (p.raceTick >= n || p.phase === 'finish' || p.phase === 'done');
          },
          t0 + args.ticks,
          { timeout: args.timeout, polling: 16 },
        );
        const out = args.at.length > 1 ? args.out.replace(/\.png$/i, '') + `-${at}.png` : args.out;
        await page.locator('#game').screenshot({ path: out });
      }
    } else {
      await page.waitForFunction(
        (n) => {
          const p = (window as unknown as { __ms3?: { rally?: { raceTick: number; phase: string } } }).__ms3?.rally;
          return !!p && (p.raceTick >= n || p.phase === 'finish' || p.phase === 'done');
        },
        args.ticks,
        { timeout: args.timeout, polling: 50 },
      );
      await page.locator('#game').screenshot({ path: args.out });
    }
    for (const k of args.keys) await page.keyboard.up(k);
    summary.probe = await probe(page);
    summary.gl3d = await page.evaluate(() => {
      const w = window as unknown as { __ms3?: { gl3d?: { stats(): unknown; ok: boolean; reason: string; cap: number } } };
      const v = w.__ms3?.gl3d;
      return v ? { ok: v.ok, reason: v.reason, cap: v.cap, stats: v.stats() } : null;
    });
    summary.ok = summary.pageErrors.length === 0 && !!summary.probe?.gl.ok;
    if (!summary.ok && !summary.failure) summary.failure = summary.pageErrors[0] ?? 'the GL flag went down';
  } catch (err) {
    summary.failure = err instanceof Error ? err.message : String(err);
    // Where it stopped (the scene on top, the race state).
    if (gamePage && !summary.probe) summary.probe = await probe(gamePage).catch(() => null);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) await server.close().catch(() => {});
  }
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) process.exitCode = 1;
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
