/**
 * Culling for the 3D view (docs/design/rally.md §3 "Streaming", §7.1 item 4, §7.3; docs/api/rally.md
 * "A.T The track"): the view draws only the pieces of the world within the fog distance and inside
 * the camera's frustum, nearest first (the depth test then rejects most hidden pixels early).
 *
 * - `Frustum.set(cam, aspect, far)`: the six planes of a `Cam3` (the same matrices the 3D view
 *   draws with: mat4Perspective · mat4View), inside = n · p + d ≥ 0.
 * - `CullSet`: units (a track segment, a ground chunk, ...) with a bounding sphere and an optional
 *   hull of 8 points (an oriented box: tighter than the sphere for long thin pieces). `cull(fr,
 *   x, y, z, maxDist)` fills `out` with the visible units' indices, sorted near → far, and returns
 *   the count. No allocation per call (the scratch arrays are the set's own).
 *
 * Pure; the determinism rules of `r3/` hold (nothing here feeds the race state).
 */
import type { Cam3 } from '../view3d';
import { mat4, mat4Multiply, mat4Perspective, mat4View } from './mat';

export class Frustum {
  /** 6 planes × (nx, ny, nz, d), normalised: left, right, bottom, top, near, far. */
  readonly planes = new Float64Array(24);
  private readonly proj = mat4();
  private readonly view = mat4();
  private readonly vp = mat4();

  /** The planes of a camera with this aspect (w / h); `far` defaults to the camera's. */
  set(cam: Readonly<Cam3>, aspect: number, far = cam.far): this {
    mat4Perspective(this.proj, cam.fovY, aspect, cam.near, Math.max(cam.near + 1e-3, far));
    mat4View(this.view, cam);
    mat4Multiply(this.vp, this.proj, this.view);
    const m = this.vp;
    const P = this.planes;
    // Row i of the column-major matrix: (m[i], m[4 + i], m[8 + i], m[12 + i]).
    for (let k = 0; k < 6; k++) {
      const i = k >> 1;
      const sgn = k & 1 ? -1 : 1;
      let a = m[3] + sgn * m[i];
      let b = m[7] + sgn * m[4 + i];
      let c = m[11] + sgn * m[8 + i];
      let d = m[15] + sgn * m[12 + i];
      const l = Math.sqrt(a * a + b * b + c * c) || 1;
      a /= l;
      b /= l;
      c /= l;
      d /= l;
      P[k * 4] = a;
      P[k * 4 + 1] = b;
      P[k * 4 + 2] = c;
      P[k * 4 + 3] = d;
    }
    return this;
  }

  /** False when the sphere lies wholly outside one plane. */
  sphere(x: number, y: number, z: number, r: number): boolean {
    const P = this.planes;
    for (let k = 0; k < 24; k += 4) if (P[k] * x + P[k + 1] * y + P[k + 2] * z + P[k + 3] < -r) return false;
    return true;
  }

  /** False when all `n` points (x, y, z from `off` in `pts`) lie outside one plane. */
  points(pts: Float32Array | Float64Array, off: number, n: number): boolean {
    const P = this.planes;
    for (let k = 0; k < 24; k += 4) {
      let out = 0;
      for (let j = 0; j < n; j++) {
        const o = off + j * 3;
        if (P[k] * pts[o] + P[k + 1] * pts[o + 1] + P[k + 2] * pts[o + 2] + P[k + 3] < 0) out++;
        else break;
      }
      if (out === n) return false;
    }
    return true;
  }
}

/** Points per unit hull (an oriented box). */
export const HULL_POINTS = 8;

/** A set of cullable units: spheres and hulls in flat arrays. */
export class CullSet {
  readonly count: number;
  readonly cx: Float64Array;
  readonly cy: Float64Array;
  readonly cz: Float64Array;
  readonly r: Float64Array;
  /** HULL_POINTS × 3 numbers per unit (null = spheres only). */
  readonly hull: Float64Array | null;
  /** The visible units of the last `cull` (indices, near → far). */
  readonly out: Int32Array;
  private readonly dist: Float64Array;

  constructor(count: number, withHull = true) {
    this.count = count;
    this.cx = new Float64Array(count);
    this.cy = new Float64Array(count);
    this.cz = new Float64Array(count);
    this.r = new Float64Array(count);
    this.hull = withHull ? new Float64Array(count * HULL_POINTS * 3) : null;
    this.out = new Int32Array(count);
    this.dist = new Float64Array(count);
  }

  /** Set unit i's bounding sphere. */
  setSphere(i: number, x: number, y: number, z: number, r: number): void {
    this.cx[i] = x;
    this.cy[i] = y;
    this.cz[i] = z;
    this.r[i] = r;
  }

  /**
   * Set unit i's hull: the box centre (x, y, z) plus/minus the half-axis vectors a, b, c (8 corners);
   * also its bounding sphere (the box's).
   */
  setBox(i: number, x: number, y: number, z: number, a: readonly number[], b: readonly number[], c: readonly number[]): void {
    const h = this.hull;
    if (h) {
      let o = i * HULL_POINTS * 3;
      for (let k = 0; k < 8; k++) {
        const sa = k & 1 ? 1 : -1, sb = k & 2 ? 1 : -1, sc = k & 4 ? 1 : -1;
        h[o++] = x + a[0] * sa + b[0] * sb + c[0] * sc;
        h[o++] = y + a[1] * sa + b[1] * sb + c[1] * sc;
        h[o++] = z + a[2] * sa + b[2] * sb + c[2] * sc;
      }
    }
    const la = a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
    const lb = b[0] * b[0] + b[1] * b[1] + b[2] * b[2];
    const lc = c[0] * c[0] + c[1] * c[1] + c[2] * c[2];
    this.setSphere(i, x, y, z, Math.sqrt(la + lb + lc));
  }

  /**
   * The visible units from a camera at (x, y, z): the sphere within `maxDist` (the fog's far end),
   * inside the frustum (the sphere, then the hull); `out[0..n)` near → far. Returns n.
   */
  cull(fr: Frustum, x: number, y: number, z: number, maxDist: number): number {
    const out = this.out;
    const dist = this.dist;
    const h = this.hull;
    let n = 0;
    for (let i = 0; i < this.count; i++) {
      const dx = this.cx[i] - x, dy = this.cy[i] - y, dz = this.cz[i] - z;
      const r = this.r[i];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
      if (d > maxDist) continue;
      if (!fr.sphere(this.cx[i], this.cy[i], this.cz[i], r)) continue;
      if (h && !fr.points(h, i * HULL_POINTS * 3, HULL_POINTS)) continue;
      // Insertion by distance (the lists are short: a few dozen units).
      let j = n++;
      while (j > 0 && dist[j - 1] > d) {
        dist[j] = dist[j - 1];
        out[j] = out[j - 1];
        j--;
      }
      dist[j] = d;
      out[j] = i;
    }
    return n;
  }
}
