/**
 * Small math helpers shared by the whole engine (docs/ARCHITECTURE.md §5.1).
 * Pure functions. Functions that build a Rect accept an optional `out` so hot paths can reuse
 * one object instead of allocating.
 */

export const TAU = Math.PI * 2;
/** Multiply degrees by this to get radians. */
export const DEG = Math.PI / 180;

/** Axis-aligned rectangle. `x, y` is the top-left corner; y grows downward. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Inverse of lerp: where `v` lies between `a` and `b` (0 at a, 1 at b). Not clamped. */
export function invLerp(a: number, b: number, v: number): number {
  return a === b ? 0 : (v - a) / (b - a);
}

/** Move `v` toward `target` by at most `step` (step >= 0) without overshooting. */
export function approach(v: number, target: number, step: number): number {
  if (v < target) return Math.min(v + step, target);
  if (v > target) return Math.max(v - step, target);
  return target;
}

export function sign(v: number): -1 | 0 | 1 {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

/** Wrap `v` into the half-open range [lo, hi). */
export function wrap(v: number, lo: number, hi: number): number {
  const span = hi - lo;
  if (span <= 0) return lo;
  return lo + ((((v - lo) % span) + span) % span);
}

export function dist(x0: number, y0: number, x1: number, y1: number): number {
  return Math.hypot(x1 - x0, y1 - y0);
}

/** Squared distance (cheaper; fine for comparisons). */
export function dist2(x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  return dx * dx + dy * dy;
}

/** Angle in radians from (x0, y0) toward (x1, y1). 0 = right, PI/2 = down (y grows downward). */
export function angleTo(x0: number, y0: number, x1: number, y1: number): number {
  return Math.atan2(y1 - y0, x1 - x0);
}

/** Shortest signed difference `b - a`, wrapped into (-PI, PI]. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d <= -Math.PI) d += TAU;
  else if (d > Math.PI) d -= TAU;
  return d;
}

/** Turn angle `a` toward `target` by at most `maxStep` radians along the shortest way. */
export function rotateToward(a: number, target: number, maxStep: number): number {
  const d = angleDiff(a, target);
  if (Math.abs(d) <= maxStep) return target;
  return a + Math.sign(d) * maxStep;
}

/** Hermite smoothstep: 0 below e0, 1 above e1, smooth in between. */
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

export const easeInQuad = (t: number): number => t * t;
export const easeOutQuad = (t: number): number => t * (2 - t);
export const easeInOutQuad = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) * (-2 * t + 2)) / 2;

/** Ease out with a small overshoot past 1 (follow-through), back to 1 at t = 1. */
export const easeOutBack = (t: number, s = 1.70158): number => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;

/**
 * Playback rate of a stride strip (Animator.update(rate)) for a body moving at `speed` whose strip
 * is drawn for `nominal` speed: |speed| / nominal, clamped to [min, max]. `min` when nominal <= 0.
 */
export function strideRate(speed: number, nominal: number, min = 0.5, max = 1.6): number {
  if (!(nominal > 0)) return min;
  return clamp(Math.abs(speed) / nominal, min, max);
}

export function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h };
}

export function setRect(out: Rect, x: number, y: number, w: number, h: number): Rect {
  out.x = x;
  out.y = y;
  out.w = w;
  out.h = h;
  return out;
}

/** True when the rectangles share a positive area. Touching edges do not overlap. */
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Point test, half-open: the left/top edges are inside, the right/bottom edges are not. */
export function contains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/**
 * World-space rect from a rect `rel` given relative to an anchor (for example a hitbox relative
 * to the feet). With `flip`, `rel` is mirrored around the anchor (for entities facing left).
 */
export function rectAt(anchorX: number, anchorY: number, rel: Rect, flip = false, out?: Rect): Rect {
  const o = out ?? { x: 0, y: 0, w: 0, h: 0 };
  o.x = anchorX + (flip ? -rel.x - rel.w : rel.x);
  o.y = anchorY + rel.y;
  o.w = rel.w;
  o.h = rel.h;
  return o;
}

/** Grow (or shrink, with a negative margin) a rect on every side. */
export function expandRect(r: Rect, margin: number, out?: Rect): Rect {
  const o = out ?? { x: 0, y: 0, w: 0, h: 0 };
  o.x = r.x - margin;
  o.y = r.y - margin;
  o.w = r.w + margin * 2;
  o.h = r.h + margin * 2;
  return o;
}

/** Smallest rect that contains both rects. */
export function unionRect(a: Rect, b: Rect, out?: Rect): Rect {
  const x0 = Math.min(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const x1 = Math.max(a.x + a.w, b.x + b.w);
  const y1 = Math.max(a.y + a.h, b.y + b.h);
  return setRect(out ?? { x: 0, y: 0, w: 0, h: 0 }, x0, y0, x1 - x0, y1 - y0);
}

/** Circle vs rect overlap (touching counts as no overlap, like `overlaps`). */
export function circleOverlapsRect(cx: number, cy: number, r: number, b: Rect): boolean {
  const nx = clamp(cx, b.x, b.x + b.w);
  const ny = clamp(cy, b.y, b.y + b.h);
  return dist2(cx, cy, nx, ny) < r * r;
}

/** Distance from a point to the nearest point of a rect (0 when inside). */
export function distToRect(px: number, py: number, b: Rect): number {
  const nx = clamp(px, b.x, b.x + b.w);
  const ny = clamp(py, b.y, b.y + b.h);
  return Math.hypot(px - nx, py - ny);
}

/**
 * Segment (x0,y0)→(x1,y1) against a rect (slab method).
 * Returns the entry parameter t in [0, 1] (0 when the start is already inside), or -1 for a miss.
 */
export function segmentRectT(x0: number, y0: number, x1: number, y1: number, b: Rect): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let tMin = 0;
  let tMax = 1;
  // X slab
  if (dx === 0) {
    if (x0 < b.x || x0 >= b.x + b.w) return -1;
  } else {
    let t0 = (b.x - x0) / dx;
    let t1 = (b.x + b.w - x0) / dx;
    if (t0 > t1) {
      const s = t0;
      t0 = t1;
      t1 = s;
    }
    if (t0 > tMin) tMin = t0;
    if (t1 < tMax) tMax = t1;
    if (tMin >= tMax) return -1;
  }
  // Y slab
  if (dy === 0) {
    if (y0 < b.y || y0 >= b.y + b.h) return -1;
  } else {
    let t0 = (b.y - y0) / dy;
    let t1 = (b.y + b.h - y0) / dy;
    if (t0 > t1) {
      const s = t0;
      t0 = t1;
      t1 = s;
    }
    if (t0 > tMin) tMin = t0;
    if (t1 < tMax) tMax = t1;
    if (tMin >= tMax) return -1;
  }
  return tMin;
}

/**
 * Swept rect test: rect `a` moving by (dx, dy) against a static rect `b`.
 * Returns the first time of overlap t in [0, 1] (0 if they already overlap), or -1 for a miss.
 * Touching edges do not count as overlap.
 */
export function sweptRectT(a: Rect, dx: number, dy: number, b: Rect): number {
  if (overlaps(a, b)) return 0;
  // Minkowski sum: grow b by a's size and trace a's top-left corner.
  const ex = b.x - a.w;
  const ey = b.y - a.h;
  const ew = b.w + a.w;
  const eh = b.h + a.h;
  const x0 = a.x;
  const y0 = a.y;
  let tMin = 0;
  let tMax = 1;
  if (dx === 0) {
    if (x0 <= ex || x0 >= ex + ew) return -1;
  } else {
    let t0 = (ex - x0) / dx;
    let t1 = (ex + ew - x0) / dx;
    if (t0 > t1) {
      const s = t0;
      t0 = t1;
      t1 = s;
    }
    if (t0 > tMin) tMin = t0;
    if (t1 < tMax) tMax = t1;
    if (tMin >= tMax) return -1;
  }
  if (dy === 0) {
    if (y0 <= ey || y0 >= ey + eh) return -1;
  } else {
    let t0 = (ey - y0) / dy;
    let t1 = (ey + eh - y0) / dy;
    if (t0 > t1) {
      const s = t0;
      t0 = t1;
      t1 = s;
    }
    if (t0 > tMin) tMin = t0;
    if (t1 < tMax) tMax = t1;
    if (tMin >= tMax) return -1;
  }
  return tMin;
}
