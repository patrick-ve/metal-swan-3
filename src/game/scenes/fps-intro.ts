/**
 * FpsIntroScene (docs/design/fps.md §1.5): loads the lazy fps content behind a progress bar
 * (skipped when already loaded), then shows the floor card (`MODE_TITLE`, `FLOOR n`, the floor
 * name, lives, the controls hint) and starts the FpsScene.
 *
 * `loadFpsContent` is one shared, idempotent promise that never rejects (a failed step logs and
 * goes on, like the boot). The bridge starts it early and reads `fpsLoadState()` every tick.
 */
import { hasSfx, listSfx } from '../../engine/audio';
import { PAL } from '../../engine/palette';
import { prepareRayAssets } from '../../engine/ray';
import type { DrawOpts, Renderer } from '../../engine/render';
import type { Scene } from '../../engine/scene';
import { preloadSprites } from '../../engine/sprites';
import { requestFpsDenseArt } from '../content/fps/dense-load';
import { blinkOn, centerText, PLAYER_COLORS, type GameApp } from '../app';
import { isLazyContent, loadContent } from '../content/index';
import { MODE_TITLE } from '../content/fps/names';
import { fpsFloorByNumber } from '../fps/registry';
import { newFpsRun, reserveLives } from '../fps/run';
import type { FpsRun } from '../fps/types';
import { FpsScene } from './fps';
import { toTitle } from './flow';
import { newSession } from './gameplay';

export interface FpsIntroOpts {
  floor: number;
  run?: FpsRun;
  fromBridge?: boolean;
}

interface LoadState {
  registered: boolean;
  ready: boolean;
  frac: number;
}

const LOAD: LoadState = { registered: false, ready: false, frac: 0 };
let loading: Promise<void> | null = null;

/** The samples never hold the load longer than this (ms); the synth fills in. */
export const FPS_SAMPLES_MAX_MS = 3000;

/** The bridge's sounds, pre-rendered first (spec §1.5). */
const BRIDGE_SFX: readonly string[] = ['fps/glitch', 'fps/type', 'fps/fold'];

const nextTick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Progress of the shared load (no allocation; read every tick by the bridge and the intro). */
export function fpsLoadState(): { readonly registered: boolean; readonly ready: boolean; readonly frac: number } {
  return LOAD;
}

/**
 * Load the fps content once: the lazy manifest entries (10 %), the bridge sfx + the `fps/` sprites
 * (25 %), the ray textures and billboards (45 %), every other `fps/` sfx (10 %), the `mode:fps`
 * samples with a 3 s cap (10 %). Never rejects.
 */
export function loadFpsContent(app: GameApp, onProgress?: (frac: number) => void): Promise<void> {
  if (!loading) loading = runLoad(app);
  if (onProgress) {
    onProgress(LOAD.frac);
    void loading.then(() => onProgress(LOAD.frac));
  }
  return loading;
}

function setFrac(f: number): void {
  LOAD.frac = Math.max(LOAD.frac, Math.min(1, f));
}

async function step(name: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`[fps] loading step "${name}" failed:`, err);
  }
}

async function runLoad(app: GameApp): Promise<void> {
  const audio = app.audio as { preload?: (ids: readonly string[]) => void };
  const preload = typeof audio.preload === 'function' ? (ids: readonly string[]) => audio.preload?.call(app.audio, ids) : null;
  await step('content', async () => {
    const report = await loadContent(isLazyContent);
    for (const f of report.failed) console.error(`[fps] content "${f.id}" failed`);
  });
  LOAD.registered = true;
  setFrac(0.1);
  await step('sprites', async () => {
    preload?.(BRIDGE_SFX.filter((id) => hasSfx(id)));
    // The sprite cache (art-cache.ts) first: the preload then skips every id it installed.
    await app.artCache?.restore('fps');
    await preloadSprites('fps/', (d, t) => setFrac(0.1 + 0.25 * (t > 0 ? d / t : 1)), { timeBudgetMs: 8 });
    void app.artCache?.save('fps', ['fps/']);
  });
  setFrac(0.35);
  await step('ray', () => prepareRayAssets(['fps/'], (d, t) => setFrac(0.35 + 0.45 * (t > 0 ? d / t : 1)), { timeBudgetMs: 8 }));
  setFrac(0.8);
  await step('sfx', async () => {
    if (!preload) return;
    const ids = listSfx('fps/').filter((id) => !BRIDGE_SFX.includes(id));
    for (let i = 0; i < ids.length; i += 8) {
      preload(ids.slice(i, i + 8));
      setFrac(0.8 + 0.1 * Math.min(1, (i + 8) / ids.length));
      await nextTick();
    }
  });
  setFrac(0.9);
  await step('samples', async () => {
    const load = app.audio.loadSamples?.('mode:fps', (d, t) => setFrac(0.9 + 0.1 * (t > 0 ? d / t : 1)));
    if (!load) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cap = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, FPS_SAMPLES_MAX_MS);
    });
    await Promise.race([load, cap]);
    clearTimeout(timer);
  });
  LOAD.frac = 1;
  LOAD.ready = true;
}

/** The characters whose HUD face the fps run may show (the joined slots; the recruit as the fallback). */
export function fpsChars(app: GameApp): string[] {
  const out = new Set<string>(['recruit']);
  for (const s of app.session?.slots ?? []) if (s.joined && s.character) out.add(s.character);
  return [...out];
}

/** The card shows at least this long; PRESS START after CARD_SKIP; it goes on its own at CARD_AUTO. */
export const CARD_MIN = 120;
export const CARD_SKIP = 60;
export const CARD_AUTO = 180;

const plain: DrawOpts = { screen: true };

export class FpsIntroScene implements Scene {
  private readonly app: GameApp;
  readonly floor: number;
  readonly run: FpsRun;
  readonly fromBridge: boolean;
  /** Ticks on the card (0 while loading). */
  private t = 0;
  private wantGo = false;
  private leaving = false;

  constructor(app: GameApp, o: FpsIntroOpts) {
    this.app = app;
    app.session ??= newSession(app, ['recruit']);
    this.floor = o.floor;
    this.run = o.run ?? newFpsRun(app.session, o.floor);
    this.run.floor = o.floor;
    this.fromBridge = o.fromBridge ?? false;
  }

  enter(): void {
    void loadFpsContent(this.app);
    this.app.input.suppress();
  }

  private readonly chars = (): readonly string[] => fpsChars(this.app);

  /** True while the content still loads. */
  get loading(): boolean {
    return !LOAD.ready;
  }

  update(): void {
    if (this.leaving) return;
    const app = this.app;
    if (!LOAD.ready) return;
    this.t++;
    const pressed = app.input.anyPressed() || app.pointerPressed;
    app.pointerPressed = false;
    if (pressed && this.t >= CARD_SKIP) this.wantGo = true;
    if ((this.wantGo && this.t >= CARD_MIN) || this.t >= CARD_AUTO) this.go();
  }

  private go(): void {
    const app = this.app;
    const session = app.session;
    if (!session) return;
    this.leaving = true;
    const run = this.run;
    if (!fpsFloorByNumber(run.floor)) {
      if (!fpsFloorByNumber(0)) {
        // Fail soft (ARCHITECTURE rule 7): the fps content did not load; back to the title.
        console.warn(`[fps] floor ${run.floor} and floor 0 are not registered (fps content not loaded) — back to the title`);
        toTitle(app);
        return;
      }
      console.warn(`[fps] floor ${run.floor} is not registered — playing floor 0`);
      run.floor = 0;
    }
    if (!run.entered) {
      session.startMission(`fps-${run.floor}`);
      run.floorStartScore = session.slots[run.slot].score;
      run.entered = true;
    }
    app.scenes.replace(new FpsScene(app, run), { fade: 20 });
  }

  draw(r: Renderer): void {
    r.begin(0x000000ff);
    if (!LOAD.ready) {
      const f = LOAD.frac;
      centerText(r, `LOADING ${Math.floor(f * 100)}%`, 112, PAL.stone[3]);
      r.rect(112, 122, 160, 6, PAL.ui[0], plain);
      r.rect(112, 122, Math.round(160 * f), 6, PAL.ui[2], plain);
      r.rect(112, 122, Math.round(160 * f), 1, PAL.ui[3], plain);
      return;
    }
    const app = this.app;
    // The dense art (UHD) for the display, in the background while the card shows.
    requestFpsDenseArt(r, this.chars, app.artCache);
    const def = fpsFloorByNumber(this.floor) ?? fpsFloorByNumber(0);
    const slot = app.session?.slots[this.run.slot];
    centerText(r, MODE_TITLE, 40, PAL.gold[3], 'big');
    centerText(r, `FLOOR ${this.floor}`, 76, PAL.snow[3], 'big', 2);
    centerText(r, def?.name ?? '???', 100, PAL.snow[2]);
    centerText(r, `LIVES ${slot ? reserveLives(slot) : 0}`, 118, PAL.stone[3]);
    if (this.floor <= 1) {
      centerText(r, 'WASD MOVE  ARROWS OR MOUSE TURN', 150, PAL.stone[2]);
      centerText(r, 'SPACE FIRE  E OPEN  1-4 WEAPONS', 160, PAL.stone[2]);
    }
    const waiting = this.run.slot === 0 ? 1 : 0;
    if (app.session?.slots[waiting].joined) centerText(r, `${waiting + 1}P GUARDS THE SWAN`, 178, PLAYER_COLORS[waiting]);
    if (this.t >= CARD_SKIP && !this.wantGo && blinkOn(this.t)) centerText(r, 'PRESS START', 200, PAL.snow[3]);
  }
}
