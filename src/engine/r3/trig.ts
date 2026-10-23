/**
 * Deterministic trigonometry for the race sim (docs/design/rally.md §12.4): every JS engine gets
 * the same values, because the sim never calls Math.sin / cos / tan / atan2.
 *
 * - `sinT` / `cosT`: a table of TRIG_N entries per full turn, built once with Math.sin and rounded
 *   to 1/2^20 (like `ray/fixed.ts`: one quadrant, mirrored, so sin(π/2) = 1 and cos(π/2) = 0
 *   exactly), with linear steps between the entries (|error| < 2e-6).
 * - `atan2T`: range reduction plus a minimax polynomial (only + − × ÷; |error| < 1.1e-5 rad).
 * - `wrapAngle` to (−π, π]; `angleDiff` (the signed shortest turn).
 *
 * Square roots are `Math.sqrt` (IEEE exact on every engine).
 */

/** Table entries per full turn. */
export const TRIG_N = 16384;
export const TAU = Math.PI * 2;
export const PI = Math.PI;
export const HALF_PI = Math.PI / 2;

const Q = 1048576;
const QUARTER = TRIG_N >> 2;
const MASK = TRIG_N - 1;
/** Table index per radian. */
const PER_RAD = TRIG_N / TAU;

/** sin of entry i (0..TRIG_N); one extra entry so the linear step never wraps. */
export const SIN_TABLE: Float64Array = new Float64Array(TRIG_N + 1);

{
  const quarter = new Float64Array(QUARTER + 1);
  // determinism-ok: the table is built once with Math.sin and rounded to 1/2^20 (like ray/fixed.ts).
  for (let i = 0; i <= QUARTER; i++) quarter[i] = Math.round(Math.sin((i * TAU) / TRIG_N) * Q) / Q; // determinism-ok
  for (let i = 0; i <= TRIG_N; i++) {
    const k = i & MASK;
    const q = k >> 12;
    const r = k & (QUARTER - 1);
    let s: number;
    if (q === 0) s = quarter[r];
    else if (q === 1) s = quarter[QUARTER - r];
    else if (q === 2) s = -quarter[r];
    else s = -quarter[QUARTER - r];
    SIN_TABLE[i] = s === 0 ? 0 : s;
  }
}

/** sin(a) from the table (any finite a). */
export function sinT(a: number): number {
  let x = a * PER_RAD;
  x -= Math.floor(x / TRIG_N) * TRIG_N;
  const i = Math.floor(x);
  const f = x - i;
  const s0 = SIN_TABLE[i & MASK];
  const s1 = SIN_TABLE[(i & MASK) + 1];
  return s0 + (s1 - s0) * f;
}

/** cos(a) = sin(a + π/2) from the table. */
export function cosT(a: number): number {
  let x = a * PER_RAD + QUARTER;
  x -= Math.floor(x / TRIG_N) * TRIG_N;
  const i = Math.floor(x);
  const f = x - i;
  const s0 = SIN_TABLE[i & MASK];
  const s1 = SIN_TABLE[(i & MASK) + 1];
  return s0 + (s1 - s0) * f;
}

/** tan(a) = sin / cos (callers keep a away from ±π/2). */
export function tanT(a: number): number {
  return sinT(a) / cosT(a);
}

/** atan(z) for |z| ≤ 1 (minimax polynomial). */
function atanUnit(z: number): number {
  const z2 = z * z;
  return z * (0.9998660 + z2 * (-0.3302995 + z2 * (0.1801410 + z2 * (-0.0851330 + z2 * 0.0208351))));
}

/** The angle of the vector (x, y) in (−π, π]; (0, 0) → 0. */
export function atan2T(y: number, x: number): number {
  if (x === 0 && y === 0) return 0;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  let a: number;
  if (ax >= ay) a = atanUnit(ay / ax);
  else a = HALF_PI - atanUnit(ax / ay);
  if (x < 0) a = PI - a;
  return y < 0 ? -a : a;
}

/** Wrap an angle to (−π, π]. */
export function wrapAngle(a: number): number {
  const w = a - TAU * Math.floor((a + PI) / TAU);
  return w === -PI ? PI : w;
}

/** The signed shortest turn from `from` to `to`, in (−π, π]. */
export function angleDiff(from: number, to: number): number {
  return wrapAngle(to - from);
}
