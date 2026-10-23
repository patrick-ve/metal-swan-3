/**
 * The layout of the compressed A10 (docs/design/rally.md §3 "Data"): the table's elements (straights
 * and bends with transition curves) laid out like a road designer's line, closed exactly, given its
 * elevation, and sampled into the control points of the track's `Spline3`.
 *
 * - A bend turns `turn` degrees (+ = left; the race runs clockwise, so the ring's corners are
 *   right turns) at the minimum radius `r`, with a transition curve of length `t` at each end
 *   (the curvature grows linearly: no kink in the steering). Its length is |turn|·r + t.
 * - The heading is exact (piecewise quadratic in the distance); the position is integrated with
 *   Simpson steps of ≤ 1 m over the r3 trig tables. The bends of the table sum to −360°.
 * - Closure: two straights flagged `close` ('x' along the Zuid straight, 'z' along the West
 *   straight; they must not be parallel) are lengthened or shortened so the end meets the start
 *   (a 2 × 2 linear solve: a straight only translates what follows it).
 * - Elevation: smooth bumps over the design distance (tunnel dips, decks), `smoothstep` ramps.
 *
 * Pure and deterministic (+ − × ÷, Math.sqrt / floor / round / abs / min / max and sinT / cosT).
 */
import { cosT, sinT } from '../../../../engine/r3/trig';
import type { ElemSpec, SectionSpec } from './table';

/** One element after the closure (design distance from the lap's start). */
interface Elem {
  readonly d0: number;
  readonly len: number;
  /** Heading at d0 (radians; forward = (sin, cos)). */
  readonly h0: number;
  /** 0 for a straight; else the signed peak curvature (1/m) and the transition length. */
  readonly k: number;
  readonly t: number;
  /** Position at d0. */
  readonly x0: number;
  readonly z0: number;
}

export interface Layout {
  /** Design length of the lap (m, horizontal). */
  readonly length: number;
  /** Section starts (design distance), plus the length at the end. */
  readonly sectionD: readonly number[];
  /** The closure gap before the fix (m) and the length changes of the two closure straights. */
  readonly gap: number;
  readonly closeDx: number;
  readonly closeDz: number;
  /** Heading at distance d (radians). */
  heading(d: number): number;
  /** Signed curvature at d (1/m; + = left). */
  curvature(d: number): number;
  /** Horizontal position at d into out[0] (x), out[1] (z). */
  position(d: number, out: number[]): number[];
  /** The road height at d (m; 0 = the ground). */
  height(d: number): number;
}

/** Heading change over the first l metres of a bend (k peak curvature, t transition, len total). */
function bendTurn(k: number, t: number, len: number, l: number): number {
  if (t <= 0) return k * l;
  if (l <= t) return (k * l * l) / (2 * t);
  const c = len - 2 * t;
  if (l <= t + c) return (k * t) / 2 + k * (l - t);
  const m = len - l;
  return k * (t + c) - (k * m * m) / (2 * t);
}

/** Curvature at l metres into a bend. */
function bendCurv(k: number, t: number, len: number, l: number): number {
  if (t <= 0) return k;
  if (l <= t) return (k * l) / t;
  if (l >= len - t) return (k * (len - l)) / t;
  return k;
}

const DEG = Math.PI / 180;

/** Smoothstep 0 → 1 over [0, 1]. */
export function smooth(f: number): number {
  const x = f < 0 ? 0 : f > 1 ? 1 : f;
  return x * x * (3 - 2 * x);
}

/** An elevation bump: `h` metres on [a, b], smooth ramps of `ramp` metres outside it. */
export interface Bump {
  readonly a: number;
  readonly b: number;
  readonly ramp: number;
  readonly h: number;
}

export function bumpHeight(bumps: readonly Bump[], d: number, length: number): number {
  let y = 0;
  for (const q of bumps) {
    // The nearest copy of d around the loop (a bump near the start line wraps).
    let x = d;
    const mid = (q.a + q.b) / 2;
    if (x - mid > length / 2) x -= length;
    else if (mid - x > length / 2) x += length;
    if (x <= q.a - q.ramp || x >= q.b + q.ramp) continue;
    if (x < q.a) y += q.h * smooth((x - (q.a - q.ramp)) / q.ramp);
    else if (x > q.b) y += q.h * smooth((q.b + q.ramp - x) / q.ramp);
    else y += q.h;
  }
  return y;
}

/** Length of an element spec (before the closure). */
export function elemLength(e: ElemSpec): number {
  if (e.kind === 'straight') return e.len;
  return Math.abs(e.turn * DEG) * e.r + e.t;
}

/**
 * Lay out the sections (their elements in order, from the start heading `yaw0` at the origin) and
 * close the loop. `bumps` (design distance) give the elevation.
 */
export function layoutTrack(sections: readonly SectionSpec[], yaw0: number, bumpsOf: (sectionD: readonly number[]) => Bump[]): Layout {
  // 1. Turtle pass with the nominal lengths.
  const specs: { e: ElemSpec; sec: number }[] = [];
  sections.forEach((s, i) => s.elems.forEach((e) => specs.push({ e, sec: i })));
  let turnSum = 0;
  for (const { e } of specs) if (e.kind === 'bend') turnSum += e.turn;
  if (Math.abs(turnSum + 360) > 1e-9) throw new Error(`layoutTrack: the bends turn ${turnSum}° (a clockwise loop needs −360°)`);

  const run = (extra: (e: ElemSpec) => number): { elems: Elem[]; x: number; z: number; d: number; h: number } => {
    const elems: Elem[] = [];
    let x = 0, z = 0, d = 0, h = yaw0;
    for (const { e } of specs) {
      const len = elemLength(e) + extra(e);
      if (e.kind === 'straight') {
        elems.push({ d0: d, len, h0: h, k: 0, t: 0, x0: x, z0: z });
        x += sinT(h) * len;
        z += cosT(h) * len;
      } else {
        const k = (Math.sign(e.turn) * 1) / e.r;
        const el: Elem = { d0: d, len, h0: h, k, t: e.t, x0: x, z0: z };
        elems.push(el);
        const p = [0, 0];
        integrate(el, len, p);
        x = p[0];
        z = p[1];
        h += e.turn * DEG;
      }
      d += len;
    }
    return { elems, x, z, d, h };
  };

  const a = run(() => 0);
  const gx = a.x, gz = a.z;
  const gap = Math.sqrt(gx * gx + gz * gz);
  // 2. The closure: Δx·dirX + Δz·dirZ = −gap (dirX / dirZ = the closure straights' directions).
  const cx = a.elems[specs.findIndex((q) => q.e.kind === 'straight' && q.e.close === 'x')];
  const cz = a.elems[specs.findIndex((q) => q.e.kind === 'straight' && q.e.close === 'z')];
  if (!cx || !cz) throw new Error('layoutTrack: needs one straight with close "x" and one with close "z"');
  const ux = sinT(cx.h0), uz = cosT(cx.h0);
  const vx = sinT(cz.h0), vz = cosT(cz.h0);
  const det = ux * vz - uz * vx;
  if (Math.abs(det) < 0.2) throw new Error('layoutTrack: the closure straights are too close to parallel');
  // Solve [ux vx; uz vz] [p; q] = [−gx; −gz].
  const p = (-gx * vz + gz * vx) / det;
  const q = (-gz * ux + gx * uz) / det;
  const b = run((e) => (e.kind === 'straight' && e.close === 'x' ? p : e.kind === 'straight' && e.close === 'z' ? q : 0));
  for (const s of specs) if (s.e.kind === 'straight' && s.e.close && elemLength(s.e) + (s.e.close === 'x' ? p : q) < 20) throw new Error(`layoutTrack: a closure straight became shorter than 20 m (Δx ${p.toFixed(1)}, Δz ${q.toFixed(1)})`);
  const elems = b.elems;
  const length = b.d;
  // Section starts.
  const sectionD: number[] = [];
  let k = 0;
  for (let i = 0; i < sections.length; i++) {
    sectionD.push(elems[k].d0);
    k += sections[i].elems.length;
  }
  sectionD.push(length);
  const bumps = bumpsOf(sectionD);

  const find = (d: number): Elem => {
    const w = d - Math.floor(d / length) * length;
    let lo = 0, hi = elems.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (elems[mid].d0 <= w) lo = mid;
      else hi = mid - 1;
    }
    return elems[lo];
  };
  const wrap = (d: number): number => d - Math.floor(d / length) * length;
  return {
    length,
    sectionD,
    gap,
    closeDx: p,
    closeDz: q,
    heading(d) {
      const e = find(d);
      const l = wrap(d) - e.d0;
      return e.k === 0 ? e.h0 : e.h0 + bendTurn(e.k, e.t, e.len, l);
    },
    curvature(d) {
      const e = find(d);
      return e.k === 0 ? 0 : bendCurv(e.k, e.t, e.len, wrap(d) - e.d0);
    },
    position(d, out) {
      const e = find(d);
      const l = wrap(d) - e.d0;
      if (e.k === 0) {
        out[0] = e.x0 + sinT(e.h0) * l;
        out[1] = e.z0 + cosT(e.h0) * l;
      } else integrate(e, l, out);
      return out;
    },
    height(d) {
      return bumpHeight(bumps, wrap(d), length);
    },
  };
}

/** Position l metres into a bend (Simpson steps of ≤ 1 m on the exact heading). */
function integrate(e: Elem, l: number, out: number[]): void {
  const n = Math.max(2, Math.ceil(l) + (Math.ceil(l) % 2));
  const step = l / n;
  let sx = 0, sz = 0;
  for (let i = 0; i <= n; i++) {
    const h = e.h0 + bendTurn(e.k, e.t, e.len, i * step);
    const w = i === 0 || i === n ? 1 : i % 2 === 1 ? 4 : 2;
    sx += w * sinT(h);
    sz += w * cosT(h);
  }
  out[0] = e.x0 + (sx * step) / 3;
  out[1] = e.z0 + (sz * step) / 3;
}
