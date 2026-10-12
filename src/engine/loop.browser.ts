/**
 * requestAnimationFrame driver for FixedStepLoop (docs/ARCHITECTURE.md §3, §5.13).
 * Runs whole 60 Hz ticks, then renders once per animation frame. A hidden tab runs nothing, and
 * the time spent hidden is discarded (no catch-up burst). Exceptions in tick / render are
 * logged once per message and do not stop the loop.
 *
 * ```ts
 * const handle = startBrowserLoop({ tick: () => game.tick(), render: () => game.draw() });
 * debug.perf = handle.stats; // live numbers for the overlay
 * ```
 */
import { FixedStepLoop } from './loop';

export interface BrowserLoopOptions {
  /** One simulation tick (input.update, scenes.update, …). */
  tick: () => void;
  /** Draw the latest state. */
  render: () => void;
  loop?: FixedStepLoop;
  onError?: (err: unknown) => void;
}

export interface LoopStats {
  fps: number;
  /** Average time per tick (ms) over the last half second. */
  tickMs: number;
  /** Average render time per frame (ms) over the last half second. */
  drawMs: number;
}

export interface BrowserLoopHandle {
  readonly loop: FixedStepLoop;
  readonly stats: LoopStats;
  stop(): void;
}

export function startBrowserLoop(o: BrowserLoopOptions): BrowserLoopHandle {
  const loop = o.loop ?? new FixedStepLoop();
  const stats: LoopStats = { fps: 0, tickMs: 0, drawMs: 0 };
  const reported = new Set<string>();
  const report =
    o.onError ??
    ((err: unknown): void => {
      const key = err instanceof Error ? err.message : String(err);
      if (reported.has(key)) return;
      reported.add(key);
      console.error('[loop] uncaught error:', err);
    });

  let running = true;
  let raf = 0;
  let last = performance.now();
  let frames = 0;
  let windowStart = last;
  let tickTime = 0;
  let tickCount = 0;
  let drawTime = 0;

  const tick = (): void => {
    const t0 = performance.now();
    try {
      o.tick();
    } catch (err) {
      report(err);
    }
    tickTime += performance.now() - t0;
    tickCount++;
  };

  const frame = (now: number): void => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = now - last;
    last = now;
    if (document.hidden) return;
    loop.advance(dt, tick);
    const d0 = performance.now();
    try {
      o.render();
    } catch (err) {
      report(err);
    }
    drawTime += performance.now() - d0;
    frames++;
    const span = now - windowStart;
    if (span >= 500) {
      stats.fps = (frames * 1000) / span;
      stats.tickMs = tickCount ? tickTime / tickCount : 0;
      stats.drawMs = frames ? drawTime / frames : 0;
      frames = 0;
      tickCount = 0;
      tickTime = 0;
      drawTime = 0;
      windowStart = now;
    }
  };

  const onVisibility = (): void => {
    // Coming back: drop the hidden time instead of fast-forwarding through it.
    last = performance.now();
    windowStart = last;
    frames = 0;
    loop.reset();
  };
  document.addEventListener('visibilitychange', onVisibility);
  raf = requestAnimationFrame(frame);

  return {
    loop,
    stats,
    stop(): void {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
