/**
 * Fixed-step accumulator (docs/ARCHITECTURE.md §3, §5.13). Pure: feed it elapsed real time and
 * it runs the tick callback 0..maxSteps times at exactly 60 Hz. loop.browser.ts drives it from
 * requestAnimationFrame.
 *
 * - Frame times within `snapMs` of a whole number of ticks are snapped to it, which removes
 *   the 0-tick / 2-tick jitter of 60 Hz displays.
 * - At most `maxSteps` ticks run per call; any further backlog is dropped (no spiral of death
 *   after a long stall). `dropped` counts the dropped ticks.
 */

export interface LoopOptions {
  /** Tick length in ms (default 1000 / 60). */
  stepMs?: number;
  /** Max ticks per advance call (default 4). */
  maxSteps?: number;
  /** Snap tolerance in ms (default 0.75). */
  snapMs?: number;
}

export class FixedStepLoop {
  readonly stepMs: number;
  maxSteps: number;
  snapMs: number;
  /** While paused, advance() runs nothing and time does not accumulate. */
  paused = false;
  /** Total ticks run. */
  ticks = 0;
  /** Ticks skipped because of the catch-up limit. */
  dropped = 0;
  private acc = 0;

  constructor(o: LoopOptions = {}) {
    this.stepMs = o.stepMs ?? 1000 / 60;
    this.maxSteps = Math.max(1, o.maxSteps ?? 4);
    this.snapMs = o.snapMs ?? 0.75;
  }

  /** Feed elapsed real time (ms) and run due ticks. Returns how many ran. */
  advance(elapsedMs: number, tick: () => void): number {
    if (this.paused || !(elapsedMs > 0)) return 0;
    const step = this.stepMs;
    // Snap frame times close to a whole number of ticks (vsync jitter).
    const whole = Math.round(elapsedMs / step);
    if (whole >= 1 && Math.abs(elapsedMs - whole * step) < this.snapMs) elapsedMs = whole * step;
    this.acc += elapsedMs;
    let n = 0;
    while (this.acc >= step - 1e-6 && n < this.maxSteps) {
      this.acc -= step;
      if (this.acc < 0) this.acc = 0;
      tick();
      n++;
    }
    if (this.acc >= step - 1e-6) {
      // Hit the catch-up limit: drop the backlog instead of running it later.
      this.dropped += Math.floor(this.acc / step + 1e-6);
      this.acc = 0;
    }
    this.ticks += n;
    return n;
  }

  /** Forget accumulated time (after a pause or a hidden tab). */
  reset(): void {
    this.acc = 0;
  }

  /** Fraction of a tick accumulated (0..1); handy for interpolation or diagnostics. */
  get alpha(): number {
    return this.acc / this.stepMs;
  }
}
