/**
 * npm run smoke -- [--port 5180] [--url http://host:port/] [--query "mission=m0&god=1"] [--out tmp/smoke]
 *                  [--headed] [--timeout 90000] [--viewport 1152x648] [--dpr 1]
 *
 * Browser smoke test (docs/ARCHITECTURE.md §9): starts the Vite dev server on --port (strict:
 * the port must be free; or uses --url), opens headless Chromium (Playwright) with a 1152×648
 * viewport (3× the game; --viewport and --dpr change it, e.g. 1920x1080 for the 5× backbuffer),
 * waits for the title, presses Enter twice (title → menu →
 * 1 PLAYER), then plays a scripted sequence — run + shoot, jump, bomb, pause / resume, play on —
 * taking a screenshot of the canvas at each step into --out. Console errors / warnings, page
 * errors and failed requests are collected; a JSON summary is printed. Exit code 1 when the page
 * threw (page errors) or the game never reached gameplay. The server is always shut down.
 *
 * The first-person mode (docs/design/fps.md §10): `--query "mode=fps&floor=0"` skips the title
 * like `mission=` and expects FpsScene (then walks, turns, fires, opens, pauses and resumes);
 * `--query "mode=bridge"` expects GlitchBridgeScene, skips the story card and goes on into
 * FpsScene. `--route` (on by default for `mission=ams` with `boss=1&debug=1`) plays the normal
 * script, then presses F4 (the boss dies), expects the ams tally (the newspaper), the ring's
 * intro card and the RingScene (docs/design/ring.md §1), drives a little, skips the ring with F4
 * (stretch by stretch to the exit), expects the ring's own MISSION COMPLETE page (a shot of the
 * ring tally, then Enter), expects the bridge and follows it into FpsScene, then
 * plays the rest of the route with F4: floor-1 tally → floor 2 → the suit breaks → the boss dies →
 * floor-2 tally → the fps ending → the final tally → the name entry. The route adds `god=1` to
 * the query when it is missing (the scripted 2D part would lose its lives before F4).
 *
 * The ring (`--query "mission=ring&god=1"`): the same script in the RingScene (FIRE / JUMP = swerve
 * / BOMB = lob, pause and resume), plus lane changes (up / down), the steer lock (FIRE held + up:
 * the far aim) and player 2's join with the key 2 (a second wagon drives in).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import type { Browser, Page } from 'playwright';

interface Args {
  port: number;
  url?: string;
  query: string;
  out: string;
  headed: boolean;
  timeout: number;
  viewport: { width: number; height: number };
  dpr: number;
  /** After the side-scrolling script: F4, then the bridge into the first-person mode. */
  route: boolean;
}

const USAGE =
  'usage: npm run smoke -- [--port 5180] [--url http://127.0.0.1:5180/] [--query "mission=m0&god=1"] [--out tmp/smoke] [--headed] [--timeout 90000] ' +
  '[--viewport 1152x648] [--dpr 1] [--route]';

function parseArgs(argv: readonly string[]): Args {
  const a: Args = { port: 5180, query: '', out: 'tmp/smoke', headed: false, timeout: 90000, viewport: { width: 1152, height: 648 }, dpr: 1, route: false };
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
      case '--out':
        a.out = next();
        break;
      case '--headed':
        a.headed = true;
        break;
      case '--timeout':
        a.timeout = Math.max(5000, Number(next()) || a.timeout);
        break;
      case '--viewport': {
        const m = /^(\d{2,5})x(\d{2,5})$/i.exec(next());
        if (!m) throw new Error(`--viewport needs WxH, e.g. 1920x1080\n${USAGE}`);
        a.viewport = { width: Number(m[1]), height: Number(m[2]) };
        break;
      }
      case '--dpr':
        a.dpr = Number(next());
        if (!(a.dpr > 0 && a.dpr <= 4)) throw new Error(`bad --dpr\n${USAGE}`);
        break;
      case '--route':
        a.route = true;
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
  const q = new URLSearchParams(a.query);
  if (q.get('mission') === 'ams' && q.get('boss') === '1' && q.get('debug') === '1') a.route = true;
  // The scripted 2D part can lose every life before F4 (a continue / game over ends the route):
  // the route always plays with god mode (debug only; it changes no route step).
  if (a.route && q.get('god') !== '1') {
    q.set('god', '1');
    a.query = q.toString();
    console.log(`[smoke] --route adds god=1: ${a.query}`);
  }
  return a;
}

interface GameState {
  scene: string;
  mission: string | null;
  section: string | null;
  x: number | null;
  score: number | null;
  kills: number | null;
  ticks: number | null;
}

interface Summary {
  ok: boolean;
  /** Why the scripted run stopped early (null = it ran to the end). */
  failure: string | null;
  url: string;
  durationMs: number;
  reachedGameplay: boolean;
  /** Set for the first-person queries and --route. */
  reachedBridge?: boolean;
  reachedFps?: boolean;
  screenshots: string[];
  states: Record<string, GameState>;
  pageErrors: string[];
  consoleErrors: string[];
  consoleWarnings: string[];
  failedRequests: string[];
}

/** Read the game's state through the debug handle (window.__ms3). */
async function gameState(page: Page): Promise<GameState> {
  return page.evaluate(() => {
    type AnyApp = {
      scenes: { top: { constructor: { name: string }; runner?: AnyRunner } | null };
      session: { slots: Array<{ score: number; joined: boolean; stats: { kills: number } }> } | null;
    };
    // A tally page's runner (the ring's `ringTally`) has no section, ticks or players.
    type AnyRunner = { mission?: { id: string }; section?: { id: string }; ticks?: number; players?: Array<{ x: number }> };
    const app = (window as unknown as { __ms3?: { app: AnyApp } }).__ms3?.app;
    const top = app?.scenes.top ?? null;
    const runner = top && 'runner' in top ? (top.runner ?? null) : null;
    const slot = app?.session?.slots[0];
    return {
      scene: top ? top.constructor.name : 'none',
      mission: runner?.mission ? runner.mission.id : null,
      section: runner?.section ? runner.section.id : null,
      x: runner?.players?.[0] ? Math.round(runner.players[0].x) : null,
      score: slot ? slot.score : null,
      kills: slot ? slot.stats.kills : null,
      ticks: runner?.ticks ?? null,
    };
  });
}

/** The scenes that host a play (the side-scrolling missions and the ring). */
const PLAY_SCENES: readonly string[] = ['GameplayScene', 'RingScene'];

async function waitForScene(page: Page, names: readonly string[], timeout: number): Promise<boolean> {
  try {
    await page.waitForFunction(
      (list) => {
        const app = (window as unknown as { __ms3?: { app: { scenes: { top: { constructor: { name: string } } | null } } } }).__ms3?.app;
        const name = app?.scenes.top?.constructor.name;
        return !!name && list.includes(name);
      },
      names,
      { timeout, polling: 100 },
    );
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const t0 = performance.now();
  mkdirSync(args.out, { recursive: true });
  const summary: Summary = {
    ok: false,
    failure: null,
    url: '',
    durationMs: 0,
    reachedGameplay: false,
    screenshots: [],
    states: {},
    pageErrors: [],
    consoleErrors: [],
    consoleWarnings: [],
    failedRequests: [],
  };

  let server: { close(): Promise<void> } | null = null;
  let browser: Browser | null = null;
  try {
    let base = args.url;
    if (!base) {
      const { createServer } = await import('vite');
      const vite = await createServer({
        logLevel: 'error',
        clearScreen: false,
        // No file watching: parallel agents edit files, and a reload would reset the run.
        server: { port: args.port, strictPort: true, host: '127.0.0.1', watch: null, hmr: false },
      });
      server = vite;
      await vite.listen();
      base = `http://127.0.0.1:${args.port}/`;
    }
    const url = args.query ? `${base}${base.includes('?') ? '&' : '?'}${args.query}` : base;
    summary.url = url;

    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: !args.headed });
    const page = await browser.newPage({ viewport: args.viewport, deviceScaleFactor: args.dpr });
    // The password gate in index.html.
    page.on('dialog', (d) => void d.accept('SW4N'));
    page.setDefaultTimeout(args.timeout);
    const seen = new Set<string>();
    page.on('console', (m) => {
      const type = m.type();
      if (type !== 'error' && type !== 'warning') return;
      const loc = m.location();
      const line = `${m.text()}${loc.url ? `  (${loc.url.replace(base ?? '', '')}:${loc.lineNumber})` : ''}`.slice(0, 400);
      const key = `${type}:${line}`;
      if (seen.has(key)) return;
      seen.add(key);
      (type === 'error' ? summary.consoleErrors : summary.consoleWarnings).push(line);
    });
    page.on('pageerror', (err) => summary.pageErrors.push(`${err.message}\n${(err.stack ?? '').split('\n').slice(1, 6).join('\n')}`));
    page.on('requestfailed', (req) => summary.failedRequests.push(`${req.url()} ${req.failure()?.errorText ?? ''}`));

    let n = 0;
    const shot = async (name: string): Promise<void> => {
      const file = join(args.out, `${String(++n).padStart(2, '0')}-${name}.png`);
      await page.locator('#game').screenshot({ path: file });
      summary.screenshots.push(file);
      summary.states[name] = await gameState(page);
    };
    const wait = (ms: number): Promise<void> => page.waitForTimeout(ms);
    /** Hold `keys` for `ms`, tapping `tap` every `every` ms. */
    const holdAndTap = async (keys: readonly string[], ms: number, tap?: string, every = 120): Promise<void> => {
      for (const k of keys) await page.keyboard.down(k);
      const end = performance.now() + ms;
      while (performance.now() < end) {
        if (tap) await page.keyboard.press(tap, { delay: 30 });
        await wait(tap ? every : Math.min(100, ms));
      }
      for (const k of keys) await page.keyboard.up(k);
    };

    /** The first-person script: walk, turn, fire, open, pause and resume. */
    const playFps = async (): Promise<void> => {
      summary.reachedFps = await waitForScene(page, ['FpsScene'], args.timeout);
      if (!summary.reachedFps) throw new Error('the first-person mode never started');
      summary.reachedGameplay = true;
      await wait(1200);
      await shot('fps-start');
      await holdAndTap(['KeyW'], 900, 'Space', 200);
      await shot('fps-walk-fire');
      await holdAndTap(['ArrowLeft'], 700);
      await page.keyboard.press('KeyE', { delay: 40 });
      await wait(500);
      await shot('fps-turn-use');
      await page.keyboard.press('Escape', { delay: 40 });
      await wait(400);
      await shot('fps-pause');
      if (!(await waitForScene(page, ['PauseScene'], 2000))) throw new Error('Esc did not pause the first-person mode');
      await page.keyboard.press('Escape', { delay: 40 });
      await wait(400);
      if (!(await waitForScene(page, ['FpsScene'], 2000))) throw new Error('Esc did not resume the first-person mode');
      await holdAndTap(['KeyW', 'ArrowRight'], 900, 'Space', 200);
      await shot('fps-play');
    };
    /** The glitch bridge: shots of its phases, Enter through the story card, then the fps mode. */
    const followBridge = async (): Promise<void> => {
      summary.reachedBridge = await waitForScene(page, ['GlitchBridgeScene'], args.timeout);
      if (!summary.reachedBridge) throw new Error('the glitch bridge never appeared');
      await wait(300);
      await shot('bridge-freeze');
      await wait(1200);
      await shot('bridge-glitch');
      await wait(2600);
      await shot('bridge-card');
      // The first press finishes the typing, the second folds the card.
      await page.keyboard.press('Enter', { delay: 40 });
      await wait(300);
      await shot('bridge-card-full');
      await page.keyboard.press('Enter', { delay: 40 });
      if (!(await waitForScene(page, ['FpsIntroScene', 'FpsScene'], args.timeout))) throw new Error('the bridge never reached the fps intro');
      await wait(1500);
      await shot('fps-intro');
    };

    /** The ring's own steps: lane changes, the steer lock, player 2's join (key 2). */
    const playRing = async (): Promise<void> => {
      await page.keyboard.press('ArrowUp', { delay: 40 });
      await wait(500);
      await shot('ring-lane-up');
      await page.keyboard.press('ArrowDown', { delay: 40 });
      await wait(300);
      await page.keyboard.press('ArrowDown', { delay: 40 });
      await wait(500);
      await shot('ring-lane-down');
      // The steer lock: FIRE held, up = the far aim (the car keeps its lane).
      await page.keyboard.down('KeyZ');
      await holdAndTap(['ArrowUp'], 700);
      await page.keyboard.up('KeyZ');
      await shot('ring-aim-far');
      // Player 2 joins with the key 2: a second wagon drives in from the left.
      await page.keyboard.press('Digit2', { delay: 40 });
      await wait(1200);
      await shot('ring-p2-join');
      const players = await page.evaluate(() => {
        const app = (window as unknown as { __ms3?: { app: { scenes: { top: { runner?: { players: unknown[] } } | null } } } }).__ms3?.app;
        return app?.scenes.top?.runner?.players.length ?? 0;
      });
      if (players < 2) throw new Error('player 2 did not join the ring (key 2)');
    };
    /**
     * --route after the ams boss: its tally (the newspaper) → the ring's intro card → the RingScene;
     * a little driving, then F4 stretch by stretch to the exit; the victory drive; the ring's own
     * MISSION COMPLETE page (hostages, FINES, `RING SEED n` in the footer); Enter → the bridge.
     */
    const followRing = async (): Promise<void> => {
      if (!(await waitForScene(page, ['MissionCompleteScene'], args.timeout))) throw new Error('the ams boss did not reach its tally');
      await wait(2500);
      await shot('ams-tally');
      if (!(await pressUntil(['MissionIntroScene'], 30000, 1500))) throw new Error('the ams tally did not move on to the ring card');
      await wait(1200);
      await shot('ring-card');
      if (!(await pressUntil(['RingScene'], 15000))) throw new Error('the ring never started');
      await wait(1500);
      await shot('ring-start');
      await holdAndTap(['ArrowRight'], 900, 'KeyZ');
      await shot('ring-play');
      let tally = false;
      for (let i = 0; i < 40 && !tally; i++) {
        tally = await waitForScene(page, ['MissionCompleteScene'], 700);
        if (!tally) await page.keyboard.press('F4', { delay: 40 });
      }
      if (!tally) throw new Error('the ring did not reach its MISSION COMPLETE page');
      // The ring's own page: its runner is the ring's tally (the seed in the footer).
      const footer = await page.evaluate(() => {
        const app = (window as unknown as { __ms3?: { app: { scenes: { top: { runner?: { tallyFooter?: string } } | null } } } }).__ms3?.app;
        return app?.scenes.top?.runner?.tallyFooter ?? null;
      });
      if (!footer || !footer.startsWith('RING SEED')) throw new Error(`the page after the ring is not the ring's tally (footer: ${footer})`);
      await wait(2500);
      await shot('ring-tally');
      await page.keyboard.press('Enter', { delay: 40 }); // the first press shows the whole page
      await wait(500);
      await shot('ring-tally-full');
      if (!(await pressUntil(['GlitchBridgeScene'], 15000))) throw new Error('the ring tally did not move on to the bridge');
    };

    /** The title flow (unless `mission=`), then the side-scrolling script; with --route on into the fps mode. */
    const playSideScroller = async (): Promise<void> => {
      const direct = /(^|&)mission=/.test(args.query);
      if (!direct) {
        if (!(await waitForScene(page, ['TitleScene'], args.timeout))) throw new Error('the title screen never appeared');
        await wait(600);
        await shot('title');
        await page.keyboard.press('Enter', { delay: 40 });
        await wait(400);
        await shot('menu');
        await page.keyboard.press('Enter', { delay: 40 });
        // Mode select → character select → mission intro card (GDD §13.1); confirm and skip each.
        if (await waitForScene(page, ['CharacterSelectScene', ...PLAY_SCENES], 10000)) {
          await wait(1000);
          await page.keyboard.press('Enter', { delay: 40 });
        }
        if (await waitForScene(page, ['MissionIntroScene', ...PLAY_SCENES], 10000)) {
          await wait(1500);
          await page.keyboard.press('Enter', { delay: 40 });
        }
      }
      summary.reachedGameplay = await waitForScene(page, PLAY_SCENES, args.timeout);
      if (!summary.reachedGameplay) throw new Error('gameplay never started');
      const ring = await waitForScene(page, ['RingScene'], 100);
      await wait(1200);
      await shot('mission-start');
      // Run and shoot.
      await holdAndTap(['ArrowRight'], 1600, 'KeyZ');
      await shot('run-shoot');
      if (ring) await playRing();
      // Jump while running.
      await page.keyboard.down('ArrowRight');
      await page.keyboard.press('KeyX', { delay: 40 });
      await wait(260);
      await shot('jump');
      await page.keyboard.up('ArrowRight');
      await wait(700);
      // A bomb.
      await page.keyboard.press('KeyC', { delay: 40 });
      await wait(350);
      await shot('bomb');
      await wait(800);
      await shot('explosion');
      // Pause and resume.
      await page.keyboard.press('Escape', { delay: 40 });
      await wait(400);
      await shot('pause');
      await page.keyboard.press('Escape', { delay: 40 });
      await wait(400);
      await shot('resume');
      // Play on for a while: run, shoot, jump now and then.
      for (let i = 0; i < 4; i++) {
        await holdAndTap(['ArrowRight'], 900, 'KeyZ');
        await page.keyboard.press('KeyX', { delay: 40 });
      }
      await holdAndTap(['ArrowRight'], 900, 'KeyZ');
      await shot('play');
      if (args.route) {
        // F4 (debug skip) kills the boss; the victory poses play, then the tally and the ring.
        await page.keyboard.press('F4', { delay: 40 });
        await wait(500);
        await shot('boss-skip');
        await followRing();
        await followBridge();
        await playFps();
        await finishRoute();
      }
    };
    /** Press Enter until one of `names` is on top (or the time runs out). */
    const pressUntil = async (names: readonly string[], ms: number, every = 600): Promise<boolean> => {
      const end = performance.now() + ms;
      while (performance.now() < end) {
        if (await waitForScene(page, names, every)) return true;
        await page.keyboard.press('Enter', { delay: 40 });
      }
      return waitForScene(page, names, 100);
    };
    /**
     * --route after floor 1 (debug=1): F4 ends floor 1 (the elevator) → its tally → floor 2 →
     * F4 breaks the suit → F4 kills him on foot (the death-cam) → the tally → the fps ending →
     * the final tally → the name entry (or the high scores).
     */
    const finishRoute = async (): Promise<void> => {
      await page.keyboard.press('F4', { delay: 40 });
      if (!(await waitForScene(page, ['FpsTallyScene'], 8000))) throw new Error('F4 on floor 1 did not reach the floor tally');
      await wait(1500);
      await shot('tally-1');
      await page.keyboard.press('Enter', { delay: 40 }); // the first press shows the whole page
      await wait(500);
      await shot('tally-1-full');
      if (!(await pressUntil(['FpsIntroScene'], 15000))) throw new Error('the floor-1 tally did not move on to floor 2');
      await wait(800);
      await shot('intro-2');
      if (!(await pressUntil(['FpsScene'], 10000))) throw new Error('floor 2 never started');
      await wait(1500);
      await shot('floor-2');
      await page.keyboard.press('F4', { delay: 40 });
      await wait(700);
      await shot('boss-break');
      await wait(2200);
      await shot('boss-phase-2');
      await page.keyboard.press('F4', { delay: 40 });
      await wait(1200);
      await shot('boss-deathcam');
      if (!(await waitForScene(page, ['FpsTallyScene'], 10000))) throw new Error('the boss death did not reach the floor tally');
      await wait(1500);
      await shot('tally-2');
      await page.keyboard.press('Enter', { delay: 40 }); // the first press shows the whole page
      await wait(500);
      await shot('tally-2-full');
      if (!(await pressUntil(['EndingScene'], 15000))) throw new Error('the floor-2 tally did not move on to the ending');
      await wait(1500);
      await shot('ending');
      if (!(await pressUntil(['FinalTallyScene'], 60000, 1500))) throw new Error('the ending never reached the final tally');
      await wait(2500);
      await shot('final-tally');
      if (!(await pressUntil(['NameEntryScene', 'HighScoresScene'], 30000, 1500))) throw new Error('the final tally never reached the name entry');
      await wait(800);
      await shot('name-entry');
    };

    await page.goto(url, { waitUntil: 'load' });
    await page.locator('#game').click();
    const mode = new URLSearchParams(args.query).get('mode');
    if (mode === 'fps' || mode === 'bridge') {
      if (mode === 'bridge') await followBridge();
      await playFps();
    } else await playSideScroller();
  } catch (err) {
    summary.failure = err instanceof Error ? err.message : String(err);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) await server.close().catch(() => {});
  }
  summary.durationMs = Math.round(performance.now() - t0);
  summary.ok = summary.pageErrors.length === 0 && summary.reachedGameplay && summary.failure === null;
  if (!summary.ok) process.exitCode = 1;
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
