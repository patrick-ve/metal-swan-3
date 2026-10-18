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
import { CanvasRenderer } from './engine/render-canvas.browser';
import { upscaleFactor } from './engine/upscale';
import { createBrowserStore } from './engine/storage.browser';
import { createApp, graphicsMode, type GameApp } from './game/app';
import { ArtCache } from './game/art-cache';
import { parseLaunchParams } from './game/params';
import { BootScene } from './game/scenes/index';
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
    __ms3?: { app: GameApp; renderer: CanvasRenderer; frames: FrameTimes };
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
  input.addSource(new GamepadSource());
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

  // The pointer-lock mouse of the first-person mode (reports nothing without the lock).
  const pointer = new PointerLockSource(canvas);
  input.addSource(pointer);

  const debug = new Debug(params.debug);
  if (params.debug) debug.reserveKeys(input);

  const caching = import.meta.env.PROD && !params.noCache;
  const artCache = caching ? new ArtCache(idbByteStore('ms3-cache'), __MS3_BUILD__) : null;
  if (import.meta.env.PROD && params.noCache) void removeOfflineCache();
  let offlinePending = caching;

  const app = createApp({ input, audio, store, params, debug, gesture: false, preloadArt: true, artCache });
  window.__ms3 = { app, renderer, frames };
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
      const res = display.resFor(upscaleFactor(mode));
      if (renderer.res !== res) renderer.setRes(res);
      app.displayRes = res;
      renderer.begin();
      app.scenes.draw(renderer);
      renderer.end();
      display.present(renderer.canvas);
      frames.ms[frames.count++ % frames.ms.length] = performance.now() - t0;
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
