/**
 * A closed Catmull-Rom spline with an arc-length table (docs/design/rally.md §3 "Data"): the track's
 * centre line. Uniform Catmull-Rom through the control points (x, y, z: y up); the table samples
 * every segment `sub` times, so `sample(s)` finds the point at arc length s (metres along the loop,
 * wrapped) and `nearest(x, z, hint)` the arc length closest to a point (a local search around the
 * hint; a full scan without one). Pure and deterministic (+ − × ÷, Math.sqrt, Math.floor).
 *
 * The constructor allocates the table; `sample` and `nearest` allocate nothing when given `out`.
 */
import { vec3, type Vec3 } from './vec';

/** A point of the spline: position, unit tangent (the driving direction) and the horizontal right. */
export interface SplineSample {
  p: Vec3;
  t: Vec3;
  /** Horizontal unit vector to the right of the tangent (y = 0): forward × up. */
  r: Vec3;
}

export function splineSample(): SplineSample {
  return { p: vec3(), t: vec3(0, 0, 1), r: vec3(-1, 0, 0) };
}

export interface SplineOpts {
  /** Table samples per control segment (default 32). */
  sub?: number;
}

export class Spline3 {
  /** Control points (x, y, z flat). */
  readonly points: Float64Array;
  readonly count: number;
  readonly sub: number;
  /** Total arc length (metres). */
  readonly length: number;
  /** Table: arc length at each sample (count·sub + 1 entries; the last = length). */
  readonly tableS: Float64Array;
  /** Table: the sample positions. */
  readonly tableX: Float64Array;
  readonly tableY: Float64Array;
  readonly tableZ: Float64Array;

  constructor(points: readonly number[] | Float64Array, o: SplineOpts = {}) {
    if (points.length % 3 !== 0 || points.length < 9) throw new Error('Spline3: needs at least 3 points (x, y, z)');
    this.points = Float64Array.from(points);
    this.count = points.length / 3;
    this.sub = Math.max(2, Math.floor(o.sub ?? 32));
    const m = this.count * this.sub;
    this.tableS = new Float64Array(m + 1);
    this.tableX = new Float64Array(m + 1);
    this.tableY = new Float64Array(m + 1);
    this.tableZ = new Float64Array(m + 1);
    const p = vec3();
    let s = 0;
    for (let j = 0; j <= m; j++) {
      const seg = Math.floor(j / this.sub) % this.count;
      const u = (j % this.sub) / this.sub;
      this.evalAt(seg, j === m ? 0 : u, p, null);
      if (j > 0) {
        const dx = p[0] - this.tableX[j - 1];
        const dy = p[1] - this.tableY[j - 1];
        const dz = p[2] - this.tableZ[j - 1];
        s += Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
      this.tableS[j] = s;
      this.tableX[j] = p[0];
      this.tableY[j] = p[1];
      this.tableZ[j] = p[2];
    }
    this.length = s;
  }

  /** Arc length wrapped into [0, length). */
  wrap(s: number): number {
    const L = this.length;
    const w = s - Math.floor(s / L) * L;
    return w >= L ? 0 : w;
  }

  /** The table sample at or before arc length s (s already wrapped). */
  private indexOf(s: number): number {
    const t = this.tableS;
    let lo = 0;
    let hi = t.length - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (t[mid] <= s) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  /** Position (and, with `d`, the derivative) of segment `seg` at u in [0, 1]. */
  private evalAt(seg: number, u: number, out: Vec3, d: Vec3 | null): void {
    const n = this.count;
    const P = this.points;
    const i0 = ((seg - 1 + n) % n) * 3;
    const i1 = seg * 3;
    const i2 = ((seg + 1) % n) * 3;
    const i3 = ((seg + 2) % n) * 3;
    const u2 = u * u;
    const u3 = u2 * u;
    for (let k = 0; k < 3; k++) {
      const p0 = P[i0 + k], p1 = P[i1 + k], p2 = P[i2 + k], p3 = P[i3 + k];
      const a = -p0 + p2;
      const b = 2 * p0 - 5 * p1 + 4 * p2 - p3;
      const c = -p0 + 3 * p1 - 3 * p2 + p3;
      out[k] = 0.5 * (2 * p1 + a * u + b * u2 + c * u3);
      if (d) d[k] = 0.5 * (a + 2 * b * u + 3 * c * u2);
    }
  }

  /** The point at arc length s (wrapped): position, unit tangent, horizontal right. */
  sample(s: number, out: SplineSample = splineSample()): SplineSample {
    const w = this.wrap(s);
    const j = this.indexOf(w);
    const s0 = this.tableS[j];
    const ds = this.tableS[j + 1] - s0;
    const f = ds > 0 ? (w - s0) / ds : 0;
    const seg = Math.floor(j / this.sub) % this.count;
    const u = ((j % this.sub) + f) / this.sub;
    const t = out.t;
    this.evalAt(seg, u, out.p, t);
    const l = Math.sqrt(t[0] * t[0] + t[1] * t[1] + t[2] * t[2]);
    if (l > 0) {
      t[0] /= l;
      t[1] /= l;
      t[2] /= l;
    } else {
      t[0] = 0;
      t[1] = 0;
      t[2] = 1;
    }
    const h = Math.sqrt(t[0] * t[0] + t[2] * t[2]);
    out.r[0] = h > 0 ? -t[2] / h : -1;
    out.r[1] = 0;
    out.r[2] = h > 0 ? t[0] / h : 0;
    return out;
  }

  /**
   * The arc length closest to (x, z) (horizontal distance). With `hint` (an arc length) only the
   * table within ±`window` metres of it is searched (a car's progress from tick to tick); without
   * one the whole loop.
   */
  nearest(x: number, z: number, hint?: number, window = 40): number {
    const S = this.tableS;
    const X = this.tableX;
    const Z = this.tableZ;
    const m = S.length - 1;
    let from = 0;
    let span = m;
    if (hint !== undefined) {
      const step = this.length / m;
      const k = Math.ceil(window / step) + 1;
      from = this.indexOf(this.wrap(hint)) - k;
      span = Math.min(m, 2 * k + 1);
    }
    let best = Infinity;
    let bestS = 0;
    for (let q = 0; q < span; q++) {
      const j = (((from + q) % m) + m) % m;
      const ax = X[j], az = Z[j];
      const bx = X[j + 1] - ax, bz = Z[j + 1] - az;
      const l2 = bx * bx + bz * bz;
      let t = l2 > 0 ? ((x - ax) * bx + (z - az) * bz) / l2 : 0;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
      const dx = ax + bx * t - x;
      const dz = az + bz * t - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < best) {
        best = d2;
        bestS = S[j] + (S[j + 1] - S[j]) * t;
      }
    }
    return this.wrap(bestS);
  }
}
