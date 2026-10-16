/**
 * Integer angles for the raycaster: 4096 units per full turn. 0 = east (+x), 1024 = south (+y),
 * 2048 = west, 3072 = north (map y grows downward). Turning right adds, turning left subtracts.
 * Direction vector of angle `a` = (COS[a], SIN[a]).
 *
 * The tables are built once with Math.sin / Math.cos and rounded to 1/65536, so every JS engine
 * gets the same values. `angleTo` uses only these tables (no Math.atan2), so it is exact too.
 */

export const ANG_FULL = 4096;
export const ANG_MASK = 4095;
export const ANG_90 = 1024;
export const ANG_180 = 2048;
export const ANG_270 = 3072;

const Q = 65536;

export const SIN: Float64Array = new Float64Array(ANG_FULL);
export const COS: Float64Array = new Float64Array(ANG_FULL);

for (let i = 0; i < ANG_FULL; i++) {
  // Build one quadrant and mirror it, so SIN/COS are exactly symmetric (sin(90°) = 1, cos(90°) = 0).
  const q = i >> 10;
  const r = i & 1023;
  const s = Math.round(Math.sin((r * Math.PI * 2) / ANG_FULL) * Q) / Q;
  const c = Math.round(Math.cos((r * Math.PI * 2) / ANG_FULL) * Q) / Q;
  // Rotating by 90° (q steps): (c, s) → (−s, c).
  if (q === 0) {
    COS[i] = c;
    SIN[i] = s;
  } else if (q === 1) {
    COS[i] = -s;
    SIN[i] = c;
  } else if (q === 2) {
    COS[i] = -c;
    SIN[i] = -s;
  } else {
    COS[i] = s;
    SIN[i] = -c;
  }
}
// −0 → 0 (keeps hashes and comparisons simple).
for (let i = 0; i < ANG_FULL; i++) {
  if (SIN[i] === 0) SIN[i] = 0;
  if (COS[i] === 0) COS[i] = 0;
}

/** Any integer (also negative) → 0..4095. Non-integers are truncated first. */
export function angNorm(a: number): number {
  return a & ANG_MASK;
}

/** Signed shortest turn from `from` to `to`, in −2047..2048. */
export function angDelta(from: number, to: number): number {
  const d = (to - from) & ANG_MASK;
  return d > ANG_180 ? d - ANG_FULL : d;
}

/** Cross product sign helper: > 0 when the vector (x, y) lies after (clockwise of) angle a. */
function cross(a: number, x: number, y: number): number {
  return COS[a] * y - SIN[a] * x;
}

/**
 * Integer angle (0..4095) of the vector (dx, dy); (0, 0) → 0. Exact for the same inputs on every
 * JS engine (a binary search over the tables, no atan2).
 */
export function angleTo(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return 0;
  // Fold into the first quadrant (x ≥ 0, y ≥ 0, not both 0), then unfold.
  let base = 0;
  let x = dx;
  let y = dy;
  // Rotate by −90° steps until x > 0 and y ≥ 0: (x, y) → (y, −x) is a −90° turn.
  for (let k = 0; k < 4 && !(x > 0 && y >= 0); k++) {
    const t = x;
    x = y;
    y = -t;
    base += ANG_90;
  }
  // Largest a in 0..1023 with the vector at or after angle a.
  let lo = 0;
  let hi = ANG_90 - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cross(mid, x, y) >= 0) lo = mid;
    else hi = mid - 1;
  }
  // Nearest of lo and lo + 1 (lo + 1 may be 1024, the next quadrant's start).
  const dLo = Math.abs(cross(lo, x, y));
  const dHi = Math.abs(cross((lo + 1) & ANG_MASK, x, y));
  const a = dHi < dLo ? lo + 1 : lo;
  return (a + base) & ANG_MASK;
}

/** Degrees (0 east, 90 south) → the nearest integer angle 0..4095. */
export function degToAng(deg: number): number {
  return Math.round((deg * ANG_FULL) / 360) & ANG_MASK;
}
