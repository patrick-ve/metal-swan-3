/**
 * The AI lines of the track (docs/design/rally.md §2 "Rivals' AI"; docs/api/rally.md "A.T"): sampled
 * every 5 m of arc length.
 *
 * - `curv`: the signed curvature of the centre line (1/m; + = a left bend), from the layout's exact
 *   curvature (the bends' transition curves included).
 * - `racing`: the racing line's lateral offset (m, + = right): toward the inside of a bend in
 *   proportion to its tightness (the curvature smoothed over ±60 m, so the car turns in before the
 *   apex and drifts out after it), back to the middle of the three lanes on the straights, kept off
 *   the hard shoulder and the barrier strip.
 * - `lanes`: the lane centres (0 = the left lane; the last = the hard shoulder).
 *
 * Pure and deterministic; `racingAt` / `curvAt` interpolate and allocate nothing (the AI calls them
 * every tick).
 */
import type { Spline3 } from '../../../../engine/r3/spline';
import type { TrackAiLines } from './types';

export const AI_STEP = 5;
/** The racing line: the most it leaves the middle of the lanes (m) and the curvature that asks for all of it (1/m). */
const RACING_SWING = 3.0;
const RACING_FULL_K = 1 / 300;
/** Smoothing half-windows (m): the curvature, then the line. */
const SMOOTH_K = 60;
const SMOOTH_LINE = 40;

export interface AiLinesOut {
  readonly lines: TrackAiLines;
  racingAt(s: number): number;
  curvAt(s: number): number;
}

/** A triangular moving average over ±`half` metres of a looped table. */
function smoothLoop(src: Float64Array, half: number): Float64Array {
  const n = src.length;
  const k = Math.max(1, Math.round(half / AI_STEP));
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0, wsum = 0;
    for (let j = -k; j <= k; j++) {
      const w = k + 1 - Math.abs(j);
      sum += src[(((i + j) % n) + n) % n] * w;
      wsum += w;
    }
    out[i] = sum / wsum;
  }
  return out;
}

export function buildAiLines(spline: Spline3, curvature: (s: number) => number, laneX: readonly number[]): AiLinesOut {
  const L = spline.length;
  const n = Math.ceil(L / AI_STEP);
  const curv = new Float64Array(n);
  for (let i = 0; i < n; i++) curv[i] = curvature(i * AI_STEP);
  const ks = smoothLoop(curv, SMOOTH_K);
  const mid = (laneX[0] + laneX[2]) / 2;
  const lo = laneX[0] - 0.5, hi = laneX[2] + 0.5;
  const raw = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const q = ks[i] / RACING_FULL_K;
    const c = q < -1 ? -1 : q > 1 ? 1 : q;
    // A right bend (k < 0) has its inside on the right (+).
    const o = mid - RACING_SWING * c;
    raw[i] = o < lo ? lo : o > hi ? hi : o;
  }
  const racing = smoothLoop(raw, SMOOTH_LINE);
  const lerp = (tab: Float64Array, s: number): number => {
    const w = s - Math.floor(s / L) * L;
    const f = w / AI_STEP;
    const i = Math.floor(f);
    const a = tab[i % n];
    const b = tab[(i + 1) % n];
    return a + (b - a) * (f - i);
  };
  return {
    lines: { step: AI_STEP, count: n, racing, curv, lanes: laneX },
    racingAt: (s) => lerp(racing, s),
    curvAt: (s) => lerp(curv, s),
  };
}
