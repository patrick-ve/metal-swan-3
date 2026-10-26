/**
 * Small textured quads drawn per frame (docs/design/floor.md §2, §3.5, §11 R1): canopies, slabs, bay
 * roofs, the top faces of walk-plane props, flat openings and the face groups' side faces. One
 * `QuadCanvas` is a buffer at density d that is placed each frame under its quads (`begin`), cleared,
 * filled with convex quads from tile textures (`quad`) and drawn as a frame (a streamed buffer).
 *
 * Smooth (spec §2.1, §2.3):
 * - `begin(x, y, grid)` puts the canvas origin on a 1/grid lattice (the caller passes the renderer's
 *   res and draws the frame in world space, so it lands on the backbuffer grid like the rest of the
 *   world): a quad that only translates moves in backbuffer px steps, not in canvas px.
 * - The quad's silhouette can be anti-aliased (`aa`, a mask of its edges): the coverage of a pixel
 *   becomes its alpha, so an edge between two canvas px shows where it really is and moves
 *   smoothly. Rows (canopies, tops) take the x-coverage of every row's ends (at the row's centre) and
 *   the y-coverage of a level top or bottom edge; a constant-u face (a side wall, `cols`) is
 *   rasterised in COLUMNS, with the y-coverage of every column's ends and the x-coverage of a
 *   vertical front or back edge. Edges left out of the mask stay hard (the pixel-centre rule): edges
 *   shared by two faces of one group, a side's front edge on its facade sprite, no seam opens there.
 * - Textures are perspective-correct with sharp bilinear sampling and the tile's whole v-mip chain
 *   (down to its one-row mean, tex.ts `bakeTile`): the level comes from the real footprint of b, per
 *   column of a side wall (b is constant down a column there) and per row of a top (constant along a
 *   row), else per pixel. A side seen almost edge-on shows its calm mean colour, never moving noise.
 *
 * No allocation per frame; the hot loops pass only small integers to helpers (the sampling state
 * lives in fields: V8 boxes a double passed to a call it does not inline).
 */
import type { Frame } from '../render';
import { PixelBuffer } from '../pixel';
import type { FloorTexture } from './tex';

/** Every edge of a quad (bit i: the edge from corner i to corner i + 1). */
export const QUAD_EDGES = 15;

/**
 * The coverage of a pixel is min(x + 1, xr) − max(x, xl) with only the AA edges taking part; the
 * stand-ins for "no edge" (-0.5 left, NO_EDGE right) are not whole numbers, so V8 keeps these values
 * unboxed doubles (a whole-number stand-in made it box one per edge pixel).
 */
const NO_EDGE = 1e9 + 0.5;

// Slots of QuadCanvas.v.
const V_Y0 = 0;
const V_XL = 1;
const V_XR = 2;
const V_RCOV = 3;
const V_RF = 4;
const V_MB = 5;
const V_WX = 6;
const V_WY = 7;
const V_COV = 8;

/** A plane over the canvas (transposed in a column raster): v(x, y) = v0 + gx·(x − x0) + gy·(y − y0). */
interface Plane {
  q0: number;
  qx: number;
  qy: number;
  a0: number;
  ax: number;
  ay: number;
  b0: number;
  bx: number;
  by: number;
}

function newPlane(): Plane {
  // Doubles start as doubles, so the fields never change representation.
  return { q0: 0.5, qx: 0.5, qy: 0.5, a0: 0.5, ax: 0.5, ay: 0.5, b0: 0.5, bx: 0.5, by: 0.5 };
}

export class QuadCanvas {
  /** Output px per logical px. */
  readonly d: number;
  /** Logical size (whole px). */
  readonly w: number;
  readonly h: number;
  readonly buf: PixelBuffer;
  /** The buffer as a frame (anchor top-left, density d), drawn at (ox, oy) (+ the camera in world space). */
  readonly frame: Frame;
  /** Logical top-left of the buffer this frame (screen px, on the `begin` grid). */
  ox = 0;
  oy = 0;
  /** Did the last quads touch any pixel? */
  drawn = false;
  /** Who holds this canvas now (a pool's bookkeeping; null = free). */
  owner: unknown = null;
  /**
   * Tests: the largest b footprint left after the chosen mip level (texels of that level per output
   * px) of the quads drawn since `clear` — ≤ √2 (or 0 on the one-row mean) means b is sampled
   * without aliasing: a face cannot flicker as it narrows (spec §2.3).
   */
  residual = 0;
  /** Ellipse mask in texture coordinates ([0, ew] × [0, eh]; 0 = none): a round cover. */
  private ew = 0;
  private eh = 0;
  // The quad in raster space (transposed for a column raster): x, y, q, qa, qb per corner.
  private readonly x = new Float64Array(4);
  private readonly y = new Float64Array(4);
  private readonly q = new Float64Array(4);
  private readonly a = new Float64Array(4);
  private readonly b = new Float64Array(4);
  private readonly p1: Plane = newPlane();
  private readonly p2: Plane = newPlane();
  // The texture and the sampling state of the pixel being drawn (fields: no doubles through calls).
  private tex: FloorTexture | null = null;
  private td = 1;
  private tw = 1;
  private lv: Uint32Array = new Uint32Array(1);
  private r0 = 0;
  private r1 = 0;
  /**
   * The doubles the raster's helpers share (a typed array: a store never allocates): the raster
   * row's sampling position V_Y0, its span V_XL … V_XR and coverage V_RCOV (`span`'s inputs), the
   * fractional texel row V_RF and the sharpness along b V_MB (`row`'s), the weights V_WX, V_WY and
   * the coverage V_COV of the pixel (`put`'s).
   */
  private readonly v = new Float64Array(9);
  private saaL = false;
  private saaR = false;

  constructor(w: number, h: number, d: number) {
    this.d = d;
    this.w = Math.max(1, Math.ceil(w));
    this.h = Math.max(1, Math.ceil(h));
    this.buf = new PixelBuffer(this.w * d, this.h * d);
    this.frame = { buf: this.buf, ox: 0, oy: 0, density: d };
  }

  /** CPU bytes of the buffer. */
  get bytes(): number {
    return this.buf.data.byteLength;
  }

  /**
   * Put the buffer's top-left at (x, y) (screen px) rounded DOWN to the 1/grid lattice (grid 1: whole
   * logical px; the renderer's res: its backbuffer px) and clear it.
   */
  begin(x: number, y: number, grid = 1): void {
    const g = grid >= 1 ? grid : 1;
    this.ox = Math.floor(x * g + 1e-9) / g;
    this.oy = Math.floor(y * g + 1e-9) / g;
    this.clear();
  }

  /** Clear the buffer for new quads at the top-left the caller set in `ox`, `oy` (any position). */
  clear(): void {
    this.buf.data.fill(0);
    this.drawn = false;
    this.residual = 0;
  }

  /** Mask the next quads to the ellipse inscribed in [0, w] × [0, h] of their texture coordinates (0, 0 = no mask). */
  ellipse(w: number, h: number): void {
    this.ew = w;
    this.eh = h;
  }

  /**
   * Fill the convex quad of corners (xs[i], ys[i]) (screen px) with tile texture `tex` at texture
   * coordinates (as[i], bs[i]) (world px of the tile), perspective weights qs[i] (1/w; all 1 =
   * affine). Corners in order around the quad (a triangle repeats a corner). `aa`: the edges to
   * anti-alias (bit i = corner i → i + 1; 0 = all hard). `cols`: rasterise in columns (a face of
   * constant u: q and b are constant down each column).
   */
  quad(xs: ArrayLike<number>, ys: ArrayLike<number>, qs: ArrayLike<number>, as: ArrayLike<number>, bs: ArrayLike<number>, tex: FloorTexture, aa = 0, cols = false): void {
    const d = this.d;
    for (let i = 0; i < 4; i++) {
      const px = (xs[i] - this.ox) * d;
      const py = (ys[i] - this.oy) * d;
      this.x[i] = cols ? py : px;
      this.y[i] = cols ? px : py;
      this.q[i] = qs[i];
      this.a[i] = as[i] * qs[i];
      this.b[i] = bs[i] * qs[i];
    }
    this.tex = tex;
    this.td = tex.density;
    this.tw = tex.levels[0].w;
    // The planes of the triangles (0, 1, 2) and (0, 2, 3), both from corner 0.
    const ok1 = this.plane(this.p1, 1, 2);
    const ok2 = this.plane(this.p2, 2, 3);
    if (!ok1 && !ok2) return;
    this.raster(ok1 ? this.p1 : this.p2, ok2 ? this.p2 : this.p1, aa, cols);
    this.buf.touch();
  }

  /** The plane of the triangle (0, i1, i2) in raster space; false when it is degenerate. */
  private plane(p: Plane, i1: number, i2: number): boolean {
    const X = this.x;
    const Y = this.y;
    const e1x = X[i1] - X[0];
    const e1y = Y[i1] - Y[0];
    const e2x = X[i2] - X[0];
    const e2y = Y[i2] - Y[0];
    const det = e1x * e2y - e2x * e1y;
    if (Math.abs(det) < 1e-9) return false;
    const inv = 1 / det;
    const Q = this.q;
    const A = this.a;
    const B = this.b;
    p.q0 = Q[0];
    p.a0 = A[0];
    p.b0 = B[0];
    p.qx = ((Q[i1] - Q[0]) * e2y - (Q[i2] - Q[0]) * e1y) * inv;
    p.qy = ((Q[i2] - Q[0]) * e1x - (Q[i1] - Q[0]) * e2x) * inv;
    p.ax = ((A[i1] - A[0]) * e2y - (A[i2] - A[0]) * e1y) * inv;
    p.ay = ((A[i2] - A[0]) * e1x - (A[i1] - A[0]) * e2x) * inv;
    p.bx = ((B[i1] - B[0]) * e2y - (B[i2] - B[0]) * e1y) * inv;
    p.by = ((B[i2] - B[0]) * e1x - (B[i1] - B[0]) * e2x) * inv;
    return true;
  }

  /**
   * Scan the quad in raster rows (canvas rows, or canvas columns when `cols`): each row's span from
   * the edges that cross its centre, the coverage of its end pixels (AA edges) and of the row itself
   * (a level AA edge at the top or the bottom), split at the diagonal 0–2 between the two planes.
   */
  private raster(pa: Plane, pb: Plane, aa: number, cols: boolean): void {
    const X = this.x;
    const Y = this.y;
    const buf = this.buf;
    const rows = cols ? buf.w : buf.h;
    const span = cols ? buf.h : buf.w;
    const rowStride = cols ? 1 : buf.w;
    const step = cols ? buf.w : 1;
    let yMin = Infinity;
    let yMax = -Infinity;
    for (let i = 0; i < 4; i++) {
      if (Y[i] < yMin) yMin = Y[i];
      if (Y[i] > yMax) yMax = Y[i];
    }
    if (!(yMax - yMin > 1e-9)) return;
    // A level (constant-row) AA edge at the top / the bottom: those rows get their coverage.
    let topAA = false;
    let botAA = false;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) & 3;
      if (!((aa >> i) & 1) || Math.abs(Y[i] - Y[j]) > 1e-6) continue;
      if (Math.abs(Y[i] - yMin) < 1e-6) topAA = true;
      if (Math.abs(Y[i] - yMax) < 1e-6) botAA = true;
    }
    // Whole rows and columns as int32 (`| 0`): no int / double merge for V8 to box.
    let r0 = (topAA ? Math.floor(yMin) : Math.ceil(yMin - 0.5)) | 0;
    let r1 = (botAA ? Math.ceil(yMax) : Math.ceil(yMax - 0.5)) | 0;
    if (r0 < 0) r0 = 0;
    if (r1 > rows) r1 = rows;
    const dX = X[2] - X[0];
    const dY = Y[2] - Y[0];
    // The side of the diagonal 0–2 where corner 1 lies: plane pa there.
    const side1 = dX * (Y[1] - Y[0]) - dY * (X[1] - X[0]) >= 0;
    for (let r = r0; r < r1; r++) {
      const rc = r + 0.5;
      // The row's coverage (a level AA edge), and where its span is sampled (inside the quad).
      const rlo = topAA && yMin > r ? yMin : r;
      const rhi = botAA && yMax < r + 1 ? yMax : r + 1;
      const rcov = rhi - rlo;
      if (rcov <= 0) continue;
      const ys = rc < yMin + 1e-7 ? yMin + 1e-7 : rc > yMax - 1e-7 ? yMax - 1e-7 : rc;
      // The span: the edges crossing the row at ys.
      let xl = Infinity;
      let xr = -Infinity;
      let el = -1;
      let er = -1;
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) & 3;
        const ya = Y[i];
        const yb = Y[j];
        if (ya === yb) continue;
        if (ys < (ya < yb ? ya : yb) || ys > (ya < yb ? yb : ya)) continue;
        const xe = X[i] + ((ys - ya) * (X[j] - X[i])) / (yb - ya);
        if (xe < xl) {
          xl = xe;
          el = i;
        }
        if (xe > xr) {
          xr = xe;
          er = i;
        }
      }
      if (el < 0 || !(xr > xl - 1e-9)) continue;
      const aaL = ((aa >> el) & 1) === 1;
      const aaR = ((aa >> er) & 1) === 1;
      let xa = (aaL ? Math.floor(xl) : Math.ceil(xl - 0.5)) | 0;
      let xb = (aaR ? Math.ceil(xr) : Math.ceil(xr - 0.5)) | 0;
      if (xa < 0) xa = 0;
      if (xb > span) xb = span;
      if (xa >= xb) continue;
      // Split at the diagonal: [xa, xs) on one plane, [xs, xb) on the other.
      let xs = xb;
      let firstA = side1;
      if (Math.abs(dY) > 1e-12) {
        const xd = X[0] + ((ys - Y[0]) * dX) / dY;
        // Left of the diagonal (x < xd) the side function dX·(y − Y0) − dY·(x − X0) has the sign of dY.
        firstA = dY > 0 === side1;
        xs = Math.ceil(xd - 0.5) | 0;
        if (xs < xa) xs = xa;
        if (xs > xb) xs = xb;
      } else {
        // A level diagonal: the whole row is on one side.
        firstA = dX * (ys - Y[0]) >= 0 === side1;
      }
      // The span's inputs go through fields (no double passes through a call).
      this.v[V_Y0] = ys;
      this.v[V_XL] = xl;
      this.v[V_XR] = xr;
      this.v[V_RCOV] = rcov;
      this.saaL = aaL;
      this.saaR = aaR;
      if (xs > xa) this.span(firstA ? pa : pb, r * rowStride, step, xa, xs);
      if (xb > xs) this.span(firstA ? pb : pa, r * rowStride, step, xs, xb);
    }
  }

  /**
   * Pixels [xa, xb) of one raster row (output index rowBase + x·step) on plane p, sampled at row
   * position `y0` and x clamped into the span [sxl, sxr]; the end pixels' coverage from the AA edges
   * (`saaL`, `saaR`) times the row's (`srcov`).
   */
  private span(p: Plane, rowBase: number, step: number, xa: number, xb: number): void {
    const xl = this.v[V_XL];
    const xr = this.v[V_XR];
    const aaL = this.saaL;
    const aaR = this.saaR;
    const rcov = this.v[V_RCOV];
    const tex = this.tex as FloorTexture;
    const out = this.buf.data;
    const td = this.td;
    const W = this.tw;
    const levels = tex.levels;
    const last = levels.length - 1;
    const h0 = levels[0].h;
    // Corner 0 in raster space (the planes' origin).
    const dy = this.v[V_Y0] - this.y[0];
    const X0 = this.x[0];
    const ew = this.ew;
    const eh = this.eh;
    // q, qa, qb at the row (x = X0) and their steps along it.
    const qr = p.q0 + p.qy * dy - p.qx * X0;
    const ar = p.a0 + p.ay * dy - p.ax * X0;
    const br = p.b0 + p.by * dy - p.bx * X0;
    const n = xb - xa;
    const flat = Math.abs(p.qx) * (n + 2) < 1e-9 * Math.abs(qr + p.qx * xa) && Math.abs(p.bx) * (n + 2) < 1e-7 * Math.max(1e-3, Math.abs(qr + p.qx * xa));
    let level = 0;
    let kL = 1;
    let ma = 64;
    if (flat) {
      // q and b fixed along the row: one texture row pair (and one level) for the whole span.
      const xm = Math.min(xr, Math.max(xl, xa + n / 2));
      const q = qr + p.qx * xm;
      const iq = 1 / q;
      const b = (br + p.bx * xm) * iq;
      const a = (ar + p.ax * xm) * iq;
      const fb = Math.abs((p.by - b * p.qy) * iq) * td;
      const fa = Math.max(Math.abs(p.ax * iq), Math.abs((p.ay - a * p.qy) * iq)) * td;
      // chainLevel(fb, last), inlined: round(log2(fb)) clamped to the chain.
      for (let t = 1.4142135; level < last && fb > t; t *= 2) level++;
      kL = levels[level].h / h0;
      ma = fa > 1e-9 ? 1 / fa : 64;
      const mb = fb * kL > 1e-9 ? 1 / (fb * kL) : 64;
      if (levels[level].h > 1 && fb * kL > this.residual) this.residual = fb * kL;
      this.v[V_RF] = b * td * kL - 0.5;
      this.v[V_MB] = mb;
      this.row(level);
      // The span's row pair, in locals (the inner loop below blends a covered pixel itself).
      const lvd = this.lv;
      const r0 = this.r0;
      const r1 = this.r1;
      const wy = this.v[V_WY];
      const iwy = 1 - wy;
      const da = p.ax * iq * td;
      const c0 = (ar + p.ax * X0) * iq * td - 0.5;
      for (let x = xa; x < xb; x++) {
        const xc = x + 0.5 < xl ? xl : x + 0.5 > xr ? xr : x + 0.5;
        if (ew > 0) {
          const aa = (ar + p.ax * xc) * iq;
          const ex = aa / ew - 0.5;
          const ey = b / eh - 0.5;
          if (ex * ex + ey * ey > 0.25) continue;
        }
        let c = c0 + da * (xc - X0);
        c -= Math.floor(c / W) * W;
        let i = Math.floor(c) | 0;
        let wx = c - i;
        if (ma > 1) {
          wx = (wx - 0.5) * ma + 0.5;
          wx = wx < 0 ? 0 : wx > 1 ? 1 : wx;
        }
        if (i >= W) i -= W;
        const i1 = i + 1 >= W ? 0 : i + 1;
        const lo = Math.max(x, aaL ? xl : -0.5);
        const hi = Math.min(x + 1, aaR ? xr : NO_EDGE);
        const cov = (hi - lo) * rcov;
        if (cov >= 0.999) {
          // Covered: the bilinear texel, written here (the hot path: no call per pixel).
          const c00 = lvd[r0 + i];
          const c10 = lvd[r0 + i1];
          const c01 = lvd[r1 + i];
          const c11 = lvd[r1 + i1];
          const iwx = 1 - wx;
          const cr = ((c00 >>> 24) * iwx + (c10 >>> 24) * wx) * iwy + ((c01 >>> 24) * iwx + (c11 >>> 24) * wx) * wy;
          const cg = (((c00 >>> 16) & 255) * iwx + ((c10 >>> 16) & 255) * wx) * iwy + (((c01 >>> 16) & 255) * iwx + ((c11 >>> 16) & 255) * wx) * wy;
          const cb = (((c00 >>> 8) & 255) * iwx + ((c10 >>> 8) & 255) * wx) * iwy + (((c01 >>> 8) & 255) * iwx + ((c11 >>> 8) & 255) * wx) * wy;
          out[rowBase + x * step] = (((cr + 0.5) | 0) << 24) | (((cg + 0.5) | 0) << 16) | (((cb + 0.5) | 0) << 8) | 255;
          continue;
        }
        this.v[V_WX] = wx;
        this.v[V_COV] = cov;
        this.put(out, rowBase + x * step, i, i1);
      }
      this.drawn = true;
      return;
    }
    // The general case: per pixel q, a, b and the level from the pixel's own footprint.
    for (let x = xa; x < xb; x++) {
      const xc = x + 0.5 < xl ? xl : x + 0.5 > xr ? xr : x + 0.5;
      const q = qr + p.qx * xc;
      const iq = 1 / q;
      const a = (ar + p.ax * xc) * iq;
      const b = (br + p.bx * xc) * iq;
      if (ew > 0) {
        const ex = a / ew - 0.5;
        const ey = b / eh - 0.5;
        if (ex * ex + ey * ey > 0.25) continue;
      }
      const fbx = Math.abs((p.bx - b * p.qx) * iq);
      const fby = Math.abs((p.by - b * p.qy) * iq);
      const fb = (fbx > fby ? fbx : fby) * td;
      const fax = Math.abs((p.ax - a * p.qx) * iq);
      const fay = Math.abs((p.ay - a * p.qy) * iq);
      const fa = (fax > fay ? fax : fay) * td;
      // chainLevel(fb, last), stepped from the last pixel's level (the footprint changes slowly).
      while (level < last && fb > 1.4142135 * (1 << level)) level++;
      while (level > 0 && fb <= 1.4142135 * (1 << (level - 1))) level--;
      kL = levels[level].h / h0;
      ma = fa > 1e-9 ? 1 / fa : 64;
      const mb = fb * kL > 1e-9 ? 1 / (fb * kL) : 64;
      if (levels[level].h > 1 && fb * kL > this.residual) this.residual = fb * kL;
      // The row pair of the level (`row`, inlined: no call per pixel).
      const lv = levels[level];
      const lh = lv.h;
      let f = b * td * kL - 0.5;
      f -= Math.floor(f / lh) * lh;
      let j = Math.floor(f) | 0;
      if (j >= lh) {
        j -= lh;
        f -= lh;
      }
      let wy = f - j;
      if (mb > 1) {
        wy = (wy - 0.5) * mb + 0.5;
        wy = wy < 0 ? 0 : wy > 1 ? 1 : wy;
      }
      const lvd = lv.data;
      const r0 = j * lv.w;
      const r1 = (j + 1 >= lh ? 0 : j + 1) * lv.w;
      let c = a * td - 0.5;
      c -= Math.floor(c / W) * W;
      let i = Math.floor(c) | 0;
      let wx = c - i;
      if (ma > 1) {
        wx = (wx - 0.5) * ma + 0.5;
        wx = wx < 0 ? 0 : wx > 1 ? 1 : wx;
      }
      if (i >= W) i -= W;
      const i1 = i + 1 >= W ? 0 : i + 1;
      const lo = Math.max(x, aaL ? xl : -0.5);
      const hi = Math.min(x + 1, aaR ? xr : NO_EDGE);
      const cov = (hi - lo) * rcov;
      if (cov >= 0.999) {
        const iwx = 1 - wx;
        const iwy = 1 - wy;
        const c00 = lvd[r0 + i];
        const c10 = lvd[r0 + i1];
        const c01 = lvd[r1 + i];
        const c11 = lvd[r1 + i1];
        const cr = ((c00 >>> 24) * iwx + (c10 >>> 24) * wx) * iwy + ((c01 >>> 24) * iwx + (c11 >>> 24) * wx) * wy;
        const cg = (((c00 >>> 16) & 255) * iwx + ((c10 >>> 16) & 255) * wx) * iwy + (((c01 >>> 16) & 255) * iwx + ((c11 >>> 16) & 255) * wx) * wy;
        const cb = (((c00 >>> 8) & 255) * iwx + ((c10 >>> 8) & 255) * wx) * iwy + (((c01 >>> 8) & 255) * iwx + ((c11 >>> 8) & 255) * wx) * wy;
        out[rowBase + x * step] = (((cr + 0.5) | 0) << 24) | (((cg + 0.5) | 0) << 16) | (((cb + 0.5) | 0) << 8) | 255;
        continue;
      }
      this.lv = lvd;
      this.r0 = r0;
      this.r1 = r1;
      this.v[V_WY] = wy;
      this.v[V_WX] = wx;
      this.v[V_COV] = cov;
      this.put(out, rowBase + x * step, i, i1);
    }
    this.drawn = true;
  }

  /**
   * Set the row pair of mip level L for the fractional row `rf` (wrapping), with the sharp weight for
   * `mb` output px per texel row (the fields r0, r1, wy, lv).
   */
  private row(L: number): void {
    const rf = this.v[V_RF];
    const mb = this.v[V_MB];
    const lv = (this.tex as FloorTexture).levels[L];
    const h = lv.h;
    let f = rf - Math.floor(rf / h) * h;
    let j = Math.floor(f) | 0;
    if (j >= h) {
      j -= h;
      f -= h;
    }
    let wy = f - j;
    if (mb > 1) {
      wy = (wy - 0.5) * mb + 0.5;
      wy = wy < 0 ? 0 : wy > 1 ? 1 : wy;
    }
    const j1 = j + 1 >= h ? 0 : j + 1;
    this.lv = lv.data;
    this.r0 = j * lv.w;
    this.r1 = j1 * lv.w;
    this.v[V_WY] = wy;
  }

  /** The bilinear texel of columns i, i1 on the set row pair, written to out[p] at the coverage `cov` (over what is there). */
  private put(out: Uint32Array, p: number, i: number, i1: number): void {
    const buf = this.lv;
    const wx = this.v[V_WX];
    const wy = this.v[V_WY];
    const c00 = buf[this.r0 + i];
    const c10 = buf[this.r0 + i1];
    const c01 = buf[this.r1 + i];
    const c11 = buf[this.r1 + i1];
    const iwx = 1 - wx;
    const iwy = 1 - wy;
    let r = ((c00 >>> 24) * iwx + (c10 >>> 24) * wx) * iwy + ((c01 >>> 24) * iwx + (c11 >>> 24) * wx) * wy;
    let g = (((c00 >>> 16) & 255) * iwx + ((c10 >>> 16) & 255) * wx) * iwy + (((c01 >>> 16) & 255) * iwx + ((c11 >>> 16) & 255) * wx) * wy;
    let b = (((c00 >>> 8) & 255) * iwx + ((c10 >>> 8) & 255) * wx) * iwy + (((c01 >>> 8) & 255) * iwx + ((c11 >>> 8) & 255) * wx) * wy;
    const cov = this.v[V_COV];
    if (cov >= 0.999) {
      out[p] = (((r + 0.5) | 0) << 24) | (((g + 0.5) | 0) << 16) | (((b + 0.5) | 0) << 8) | 255;
      return;
    }
    if (cov <= 0.001) return;
    const o = out[p];
    const ad = (o & 255) / 255;
    let ao = cov;
    if (ad > 0) {
      // Over what an earlier quad of this canvas left there.
      const k = ad * (1 - cov);
      ao = cov + k;
      const inv = 1 / ao;
      r = (r * cov + (o >>> 24) * k) * inv;
      g = (g * cov + ((o >>> 16) & 255) * k) * inv;
      b = (b * cov + ((o >>> 8) & 255) * k) * inv;
    }
    out[p] = (((r + 0.5) | 0) << 24) | (((g + 0.5) | 0) << 16) | (((b + 0.5) | 0) << 8) | ((ao * 255 + 0.5) | 0);
  }
}

/** Width classes of pooled canvases (logical px; the last one holds the whole view). */
export const CANVAS_W_CLASSES: readonly number[] = [8, 16, 32, 64, 128, 256, 392];
/** Height classes of pooled canvases (logical px; the last one holds the whole view). */
export const CANVAS_H_CLASSES: readonly number[] = [8, 16, 32, 64, 128, 232];

/** The smallest class ≥ n (the largest when none is: callers clamp their boxes to the view). */
export function canvasClass(n: number, classes: readonly number[]): number {
  for (let i = 0; i < classes.length; i++) if (n <= classes[i]) return classes[i];
  return classes[classes.length - 1];
}

/**
 * Canvases shared by many quads (docs/design/floor.md §2.6, §3.2): only the few things on screen
 * at once hold one, so a section's face groups and quads share a handful of canvases, made ahead
 * (`ensure`, at the section start) and handed out per frame: `acquire` gives the smallest free
 * canvas that fits (of the density asked), `release` takes it back when its thing leaves the view or
 * needs another size. Once the pool is sized nothing is made on the frame path (`made` counts).
 */
export class QuadCanvasPool {
  private readonly all: QuadCanvas[] = [];
  /** Canvases made so far (tests: none after the section start). */
  made = 0;

  /** At least n canvases of exactly w × h (logical px) at density d. */
  ensure(w: number, h: number, d: number, n: number): void {
    let have = 0;
    for (let i = 0; i < this.all.length; i++) {
      const c = this.all[i];
      if (c.w === w && c.h === h && c.d === d) have++;
    }
    for (; have < n; have++) this.make(w, h, d);
  }

  /** The smallest free canvas of density d with room for w × h, now held by `owner` (made when none is free). */
  acquire(owner: unknown, w: number, h: number, d: number): QuadCanvas {
    let best: QuadCanvas | null = null;
    for (let i = 0; i < this.all.length; i++) {
      const c = this.all[i];
      if (c.owner !== null || c.d !== d || c.w < w || c.h < h) continue;
      if (!best || c.w * c.h < best.w * best.h) best = c;
    }
    const cv = best ?? this.make(w, h, d);
    cv.owner = owner;
    return cv;
  }

  release(cv: QuadCanvas | null): void {
    if (cv) cv.owner = null;
  }

  /** Canvases held now (debug / tests). */
  get held(): number {
    let n = 0;
    for (let i = 0; i < this.all.length; i++) if (this.all[i].owner !== null) n++;
    return n;
  }

  get size(): number {
    return this.all.length;
  }

  /** CPU bytes of every canvas. */
  bytes(): number {
    let n = 0;
    for (let i = 0; i < this.all.length; i++) n += this.all[i].bytes;
    return n;
  }

  private make(w: number, h: number, d: number): QuadCanvas {
    const c = new QuadCanvas(w, h, d);
    this.all.push(c);
    this.made++;
    return c;
  }
}
