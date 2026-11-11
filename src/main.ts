/**
 * Browser entry (docs/ARCHITECTURE.md §4): the only module that wires the *.browser.ts parts —
 * canvas renderer + display, keyboard / gamepad input, Web Audio, localStorage, the
 * requestAnimationFrame loop — to the pure game (scenes, mission runner, debug), plus URL
 * launch parameters and an on-screen overlay for uncaught errors.
 *
 * Resolution (docs/ARCHITECTURE.md §3): the renderer's sprite filter follows the GRAPHICS option,
 * or `?gfx=` until the option is changed (`graphicsMode`); its backbuffer follows the display's
 * resolution for that filter (`display.resFor`, re-checked every frame, so resizes and DPR
 * changes apply at once).
 *
 * Art tier (docs/ARCHITECTURE.md §3): ART DETAIL (`settings.artDetail`, or `?art=` until the
 * option is changed) and the display scale pick the art tier and the backbuffer res together
 * (`display.tierRes`: AUTO tier 4 at an integer scale ≥ 8 with k 8, tier 2 from scale 2, tier 1
 * below); `setArtTier` publishes it to the sprites and the mission runner. At tier 4 a missing 4×
 * frame draws its 2× frame and is queued (`setDeferDense`), never generated here. A frame-time
 * governor (`FrameGovernor`) caps the tier at 2 (k ≤ 6) once per session when render + present
 * average more than 8 ms over 2 s at tier 4.
 *
 * The 3D view (docs/design/rally.md §12.2): WebGL2 on a detached canvas (`createGl3d`), injected
 * through `AppOptions.view3d`. The CPU governor cannot see the GPU, so the 3D frames get their own
 * frame-interval governor (`Governor3d`, r3/ps1.ts): a 2 s average interval above 20 ms at 3D
 * density 4 caps the 3D view at 2, a later one at 2 caps it at 1 (once per session each; the 2D art
 * tier stays). The 2D governor's sample leaves out the 3D view's own CPU time.
 *
 * The perspective floor (docs/design/floor.md §3.3): WebGL2 on a second detached canvas
 * (`createGlFloor`), injected through `AppOptions.floorGpu`; its context is made with the first
 * floor section. It draws the band at the backbuffer res (`renderer.res`, so `Renderer.surface` puts
 * it 1:1) with the art tier's textures. Its CPU time stays inside the 2D governor's sample (it is 2D
 * art, unlike the 3D view): a slow floor drops the art tier like any other art, and the floor then
 * follows the tier (2× textures, k ≤ 6). `?floorgl=0` keeps it off: the CPU raster draws the floor
 * (at most 2×), as it does without WebGL2 or while the context is lost. `?debug=floor` draws the
 * floor's debug overlay (the depth grid, the walk line, the row lines).
 *
 * Pointer lock (docs/design/fps.md §2.3): a click on the canvas takes the lock when
 * `app.pointerLockWanted` and the MOUSE LOOK setting are on; the lock is given back when either
 * turns off; losing it while it is wanted (Esc, alt-tab) sets `app.focusLost` (the scene pauses).
 *
 * Caches (docs/ARCHITECTURE.md §5.4), production builds only: the sprite cache in IndexedDB
 * (`app.artCache`) and the offline cache (service worker), registered once the boot scene is done
 * (its downloads then come from the HTTP cache instead of the network a second time). `?cache=0`
 * turns both off and removes the service worker.
 */
import { WebAudioOut } from './engine/audio.browser';
import { idbByteStore } from './engine/byte-store.browser';
import { Debug } from './engine/debug';
import { createDisplay } from './engine/display.browser';
import { InputManager, parseBindings } from './engine/input';
import { GamepadSource, KeyboardSource, TouchSource } from './engine/input.browser';
import { startBrowserLoop } from './engine/loop.browser';
import { registerOfflineCache, removeOfflineCache } from './engine/offline.browser';
import { PointerLockSource } from './engine/pointer.browser';
import { createGl3d, type Gl3dView } from './engine/gl3d.browser';
import { createGlFloor, type GlFloor } from './engine/gl-floor.browser';
import { canvasTexture, CanvasRenderer } from './engine/render-canvas.browser';
import { FrameGovernor } from './engine/render-common';
import { Governor3d } from './engine/r3/ps1';
import { artTier, setArtTier, setDeferDense } from './engine/sprites';
import { upscaleFactor } from './engine/upscale';
import { createBrowserStore } from './engine/storage.browser';
import { createApp, graphicsMode, type GameApp } from './game/app';
import { ArtCache } from './game/art-cache';
import { parseLaunchParams } from './game/params';
import { setFloorOverlay } from './game/mission/floor/registry';
import { fetchCanalSource, setCanal, setCanalSource, setCanalTextures } from './game/mission/canal/registry';
import { canalBytes, canalSceneBytes } from './game/mission/canal/store';
import { canalDrawStats, resetCanalDrawStats, type CanalDrawStats } from './game/mission/canal/view';
import { artDetailTier } from './game/settings';
import { BootScene } from './game/scenes/index';
import { rallyProbe, type RallyProbe } from './game/scenes/rally-route';
import { applyTuning } from './game/tuning';

/** Render + present times of the last frames (ms), for the perf tool (tools/perf.ts). */
export interface FrameTimes {
  readonly ms: Float32Array;
  /** Frames recorded so far (the ring holds the last ms.length). */
  count: number;
}

declare global {
  interface Window {
    /** Debug handle for the console, the smoke / perf tools and browser tests. */
    __ms3?: {
      app: GameApp;
      renderer: CanvasRenderer;
      frames: FrameTimes;
      tier: () => number;
      /** The 3D race's probe (a getter; docs/api/rally.md): the GL flag, the last race's state. */
      readonly rally?: RallyProbe;
      /** The WebGL2 3D view (docs/api/rally.md "A.GL"): `stats()` (frame interval, cap, tris), `cap`, `ok`. */
      gl3d?: Gl3dView;
      /** The WebGL2 floor (docs/api/floor.md §7): `stats()` (CPU ms, res, uploads, GPU bytes), `ok`, `reason`. */
      floorGl?: GlFloor;
      /** The canal scenes (docs/api/canal.md): the draw time, the resident bytes (all, by scene), the stats' reset. */
      canal?: {
        stats: () => CanalDrawStats;
        bytes: () => { cpu: number; tex: number };
        scenes: () => Record<string, { cpu: number; tex: number }>;
        reset: () => void;
      };
    };
  }
}

// ---------------------------------------------------------------------------------------------
// Error overlay
// ---------------------------------------------------------------------------------------------

const shownErrors = new Set<string>();
let errorBox: HTMLDivElement | null = null;

function showError(err: unknown): void {
  const msg = err instanceof Error ? `${err.message}\n${(err.stack ?? '').split('\n').slice(1, 4).join('\n')}` : String(err);
  const key = msg.split('\n')[0];
  if (shownErrors.has(key) || shownErrors.size >= 5) return;
  shownErrors.add(key);
  console.error('[metal-swan-3]', err);
  if (!errorBox) {
    errorBox = document.createElement('div');
    errorBox.style.cssText =
      'position:fixed;left:8px;right:8px;top:8px;z-index:10;max-height:40vh;overflow:auto;padding:8px 10px;' +
      'background:rgba(40,0,0,.88);color:#ffd0c0;font:12px/1.4 monospace;white-space:pre-wrap;border:1px solid #ff6040;';
    errorBox.title = 'Click to hide';
    errorBox.addEventListener('click', () => errorBox?.remove());
    document.body.appendChild(errorBox);
  }
  errorBox.textContent += `${errorBox.textContent ? '\n\n' : ''}⚠ ${msg}`;
}

window.addEventListener('error', (e) => showError(e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => showError(e.reason));

// ---------------------------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------------------------

function main(): void {
  applyTuning();
  const params = parseLaunchParams(window.location.search);
  const store = createBrowserStore();

  const input = new InputManager(parseBindings(store.get('bindings')));
  input.players = params.players;
  input.addSource(new KeyboardSource(window, { isBound: (code) => input.isBound(code) }));
  // Gamepads: identity, sticky player slots, profiles and rumble (docs/api/input.md).
  input.useGamepads(new GamepadSource());
  // Phones and tablets: an on-screen pad that appears on the first touch.
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) input.addSource(new TouchSource());

  const audio = new WebAudioOut();
  let muted = params.mute;
  audio.setMuted(muted);

  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  if (!canvas) throw new Error('missing <canvas id="game">');
  const display = createDisplay(canvas, { kmax: params.kmax ?? undefined });
  const renderer = new CanvasRenderer(undefined, undefined, undefined, { res: display.res });
  const frames: FrameTimes = { ms: new Float32Array(1024), count: 0 };
  const governor = new FrameGovernor();

  // The pointer-lock mouse of the first-person mode (reports nothing without the lock).
  const pointer = new PointerLockSource(canvas);
  input.addSource(pointer);

  const debug = new Debug(params.debug);
  if (params.debug) debug.reserveKeys(input);

  const caching = import.meta.env.PROD && !params.noCache;
  const artCache = caching ? new ArtCache(idbByteStore('ms3-cache'), __MS3_BUILD__) : null;
  if (import.meta.env.PROD && params.noCache) void removeOfflineCache();
  let offlinePending = caching;

  // The 3D view (docs/design/rally.md §12.2): WebGL2 on a detached canvas, created on its first use
  // (the rally card's preload); the rally scene draws it through `Renderer.surface`.
  const view3d = createGl3d();
  const gov3d = new Governor3d();
  let frames3d = 0;
  let last3d = -1;
  // The perspective floor (docs/design/floor.md §3.3): WebGL2 at the backbuffer res; `?floorgl=0`
  // leaves it off (the CPU raster draws).
  const query = new URLSearchParams(window.location.search);
  const floorGl = createGlFloor({ enabled: query.get('floorgl') !== '0', res: () => renderer.res });
  if (query.get('debug') === 'floor') setFloorOverlay(true);
  // The canal scenes (docs/api/canal.md): the baked scenery files under the site's base, each tile a
  // texture of its own; `?canal=0` draws the old scenery (to compare).
  setCanalSource(fetchCanalSource(import.meta.env.BASE_URL));
  setCanalTextures(canvasTexture);
  if (query.get('canal') === '0') setCanal(false);
  const app = createApp({ input, audio, store, params, debug, gesture: false, preloadArt: true, artCache, view3d, floorGpu: floorGl });
  // `?art=` wins over ART DETAIL until the option is changed.
  const artAtStart = app.settings.artDetail;
  const wantedTier = (): number => {
    const w = params.art !== undefined && app.settings.artDetail === artAtStart ? params.art : artDetailTier(app.settings.artDetail);
    // The governor tripped: tier 2 at most for the rest of the session.
    return governor.tripped ? (w === 1 ? 1 : 2) : w;
  };
  let tier = 0;
  window.__ms3 = {
    app,
    renderer,
    frames,
    tier: artTier,
    gl3d: view3d,
    floorGl,
    canal: { stats: canalDrawStats, bytes: canalBytes, scenes: canalSceneBytes, reset: resetCanalDrawStats },
    get rally(): RallyProbe {
      return rallyProbe(app);
    },
  };
  app.scenes.reset(new BootScene(app));
  // Losing focus (another window, a notification) pauses a game in progress.
  window.addEventListener('blur', () => {
    app.focusLost = true;
  });
  const lockWanted = (): boolean => app.pointerLockWanted && app.settings.mouseLook;
  /** We gave the lock back ourselves: that loss is no reason to pause. */
  let releasing = false;
  pointer.onLockChange = (locked) => {
    app.pointerLocked = locked;
    if (!locked && !releasing && lockWanted()) app.focusLost = true;
    if (!locked) releasing = false;
  };
  canvas.addEventListener('click', () => {
    if (lockWanted() && !pointer.locked) pointer.request();
  });

  const loop = startBrowserLoop({
    tick: () => {
      pointer.enabled = app.settings.mouseLook;
      pointer.sensitivity = app.settings.mouseSensitivity;
      input.update();
      debug.handleInput(input);
      if (input.keyPressed('KeyM')) {
        muted = !muted;
        audio.setMuted(muted);
      }
      app.scenes.update();
      if (offlinePending && !(app.scenes.top instanceof BootScene && !app.scenes.top.ready)) {
        offlinePending = false;
        registerOfflineCache();
      }
      if (pointer.locked && !lockWanted()) {
        releasing = true;
        pointer.exit();
      }
    },
    render: () => {
      const t0 = performance.now();
      app.frame++;
      const mode = graphicsMode(app);
      if (renderer.mode !== mode) renderer.setMode(mode);
      const tr = display.tierRes(upscaleFactor(mode), wantedTier());
      const res = tr.k;
      if (renderer.res !== res) renderer.setRes(res);
      if (tr.tier !== tier) {
        tier = tr.tier;
        setArtTier(tier);
        setDeferDense(tier >= 4);
      }
      app.displayRes = res;
      renderer.begin();
      app.scenes.draw(renderer);
      renderer.end();
      display.present(renderer.canvas);
      const t1 = performance.now();
      frames.ms[frames.count++ % frames.ms.length] = t1 - t0;
      // The 3D governor: the interval between 3D frames (it sees the GPU through the rAF pace).
      const drew3d = view3d.frames !== frames3d;
      if (drew3d) {
        frames3d = view3d.frames;
        if (last3d >= 0) {
          const cap = gov3d.sample(t1 - last3d, t1, view3d.density);
          if (cap) {
            view3d.setCap(cap);
            console.info(`[metal-swan-3] 3D frames averaged ${gov3d.trippedMs.toFixed(1)} ms apart: the 3D view drops to ${cap}× for this session`);
          }
        }
        last3d = t1;
      } else last3d = -1;
      // The floor's GL time stays in the sample (2D art); the 3D view has its own governor above.
      if (governor.sample(t1 - t0 - (drew3d ? view3d.stats().cpuMs : 0), t1, tier)) {
        console.info(`[metal-swan-3] render + present averaged ${governor.trippedMs.toFixed(1)} ms at 4× art: dropping to 2× art for this session`);
      }
    },
    onError: showError,
  });
  debug.perf = loop.stats;

  // The first click, tap or key unlocks audio (the boot scene waits for it, GDD §13.2).
  const gesture = (): void => {
    app.gesture = true;
  };
  window.addEventListener('keydown', gesture, { capture: true });
  window.addEventListener('pointerdown', gesture, { capture: true });
  window.addEventListener('touchstart', gesture, { capture: true, passive: true });
  canvas.addEventListener('pointerdown', () => {
    canvas.focus();
    app.pointerPressed = true;
  });
  canvas.focus();
}

try {
  main();
} catch (err) {
  showError(err);
}
