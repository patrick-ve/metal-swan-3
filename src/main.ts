/**
 * Browser entry (docs/ARCHITECTURE.md §4): the only module that wires the *.browser.ts parts —
 * canvas renderer + display, keyboard / gamepad input, Web Audio, localStorage, the
 * requestAnimationFrame loop — to the pure game (scenes, mission runner, debug), plus URL
 * launch parameters and an on-screen overlay for uncaught errors.
 */
import { WebAudioOut } from './engine/audio.browser';
import { Debug } from './engine/debug';
import { createDisplay } from './engine/display.browser';
import { InputManager, parseBindings } from './engine/input';
import { GamepadSource, KeyboardSource, TouchSource } from './engine/input.browser';
import { startBrowserLoop } from './engine/loop.browser';
import { CanvasRenderer } from './engine/render-canvas.browser';
import { createBrowserStore } from './engine/storage.browser';
import { createApp, type GameApp } from './game/app';
import { parseLaunchParams } from './game/params';
import { BootScene } from './game/scenes/index';
import { applyTuning } from './game/tuning';

declare global {
  interface Window {
    /** Debug handle for the console and browser tests. */
    __ms3?: { app: GameApp };
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
  const renderer = new CanvasRenderer();
  const display = createDisplay(canvas);

  const debug = new Debug(params.debug);
  if (params.debug) debug.reserveKeys(input);

  const app = createApp({ input, audio, store, params, debug, gesture: false });
  window.__ms3 = { app };
  app.scenes.reset(new BootScene(app));
  // Losing focus (another window, a notification) pauses a game in progress.
  window.addEventListener('blur', () => {
    app.focusLost = true;
  });

  const loop = startBrowserLoop({
    tick: () => {
      input.update();
      debug.handleInput(input);
      if (input.keyPressed('KeyM')) {
        muted = !muted;
        audio.setMuted(muted);
      }
      app.scenes.update();
    },
    render: () => {
      app.frame++;
      renderer.begin();
      app.scenes.draw(renderer);
      renderer.end();
      display.present(renderer.canvas);
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
