/**
 * The floor's CPU raster (docs/design/floor.md §3.3): the reference renderer for node tools, tests
 * and CI, and the browser's fallback. A z-buffered scanline raster of the floor mesh's triangles with
 * perspective-correct texture coordinates and the sampling rules of tex-layout.ts (rows textures for
 * the painter's chunks, tiles with v-mips, sharp bilinear), into ONE reused band buffer.
 *
 * Fill rule: a pixel belongs to a triangle when its centre lies in [left edge, right edge) and
 * [top, bottom) of it; a shared edge is computed from the same two projected vertices on both sides,
 * so neighbouring triangles neither overlap nor leave a gap. Depth: larger s (= f/(f − v), the
 * perspective-correct 1/w) is nearer; ties keep the first drawn.
 *
 * Per frame nothing is allocated: the band, the z-buffer and the vertex scratch are made once per
 * size and reused, and the hot path passes only small integers to its helpers (weights, texture
 * coordinates and plane gradients live in reused objects), because V8 boxes a double — and a packed
 * colour above 2³⁰ — passed to or returned from a call it does not inline.
 */
import { PixelBuffer } from '../pixel';
import { VIEW_W } from '../render';
import { FLOOR_CX } from './cam';
import type { FloorFrame, FloorMaterial, FloorMaterialLayer } from './gpu';
import { QUAD_FACE_UN, QUAD_FACE_UP } from './mesh';
import type { FloorTexture } from './tex';
import { CHUNK_APRON } from './tex-layout';

/**
 * @internal (quad.ts) The sampling state of one texture layer: the texture, the row of the pixel
 * being drawn and the per-pixel inputs (set as fields, never passed as doubles).
 */
export interface Tex {
  /** MODE_CHUNK (rows) or MODE_TILE. */
  mode: number;
  /** Texels per world px. */
  d: number;
  /** Chunk: its first u. Tile: the layer's drift now (a and b subtract u0, b0). */
  u0: number;
  b0: number;
  tex: FloorTexture | null;
  // Span constants: the chunk row function (k1 = (yw − yh)·f, f, yb = yh − back), the mip level,
  // the sharpness along the rows (my) and the columns (mx), the mix over the layer below (alpha).
  k1: number;
  f: number;
  yb: number;
  level: number;
  my: number;
  mx: number;
  alpha: number;
  // Per pixel: the texture coordinates (world px) and the column weight.
  sa: number;
  sb: number;
  wx: number;
  // The current row (setRow): its buffer, width, the two row offsets and the weight between them.
  buf: Uint32Array;
  w: number;
  r0: number;
  r1: number;
  wy: number;
}

/** @internal (quad.ts) */
export function newTex(): Tex {
  // Doubles start as doubles (0.5), so the fields never change representation in the hot loop.
  return { mode: 0, d: 1, u0: 0.5, b0: 0.5, tex: null, k1: 0.5, f: 0.5, yb: 0.5, level: 0, my: 0.5, mx: 0.5, alpha: 0.5, sa: 0.5, sb: 0.5, wx: 0.5, buf: new Uint32Array(1), w: 1, r0: 0, r1: 0, wy: 0.5 };
}

/** @internal (quad.ts) */
export const MODE_CHUNK = 0;
/** @internal (quad.ts) */
export const MODE_TILE = 1;

/** The current triangle's plane: (q, qa, qb) at (x0, y0) and their gradients in band px. */
interface Plane {
  x0: number;
  y0: number;
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

export class FloorRaster {
  /** The band of the last frame (reused; (VIEW_W·d) × (bandH·d)). */
  band: PixelBuffer | null = null;
  private z: Float32Array = new Float32Array(0);
  /** Projected quad corners: x, y (band px), q (= s), qa, qb. */
  private readonly px = new Float64Array(4);
  private readonly py = new Float64Array(4);
  private readonly pq = new Float64Array(4);
  private readonly pa = new Float64Array(4);
  private readonly pb = new Float64Array(4);
  private readonly t0: Tex = newTex();
  private readonly t1: Tex = newTex();
  private readonly pl: Plane = { x0: 0.5, y0: 0.5, q0: 0.5, qx: 0.5, qy: 0.5, a0: 0.5, ax: 0.5, ay: 0.5, b0: 0.5, bx: 0.5, by: 0.5 };
  /** The current triangle draws flat rows (b and q constant along a row). */
  private flatRow = false;
  /** Second-layer mix (0 = none). */
  private overAlpha = 0;
  /** Frame constants used by the span loop. */
  private fr: FloorFrame | null = null;
  private outD = 1;
  /** Triangles and pixels drawn in the last frame (debug / perf). */
  triangles = 0;
  pixels = 0;

  /** CPU bytes of the band and its z-buffer (0 until it drew). */
  bytes(): number {
    return (this.band ? this.band.data.byteLength : 0) + this.z.byteLength;
  }

  /** Drop the band and its z-buffer (the GPU draws the band now; made again if the raster draws). */
  release(): void {
    this.band = null;
    this.z = new Float32Array(0);
  }

  /** Draw the frame's band (cleared first) and return the reused buffer. */
  render(fr: FloorFrame): PixelBuffer {
    const d = fr.density;
    const W = VIEW_W * d;
    const H = Math.max(1, fr.bandH * d);
    let band = this.band;
    if (!band || band.w !== W || band.h !== H) {
      band = new PixelBuffer(W, H);
      this.band = band;
      this.z = new Float32Array(W * H);
    } else {
      band.data.fill(0);
      this.z.fill(0);
    }
    this.fr = fr;
    this.outD = d;
    this.triangles = 0;
    this.pixels = 0;
    const mesh = fr.mesh;
    const cam = fr.cam;
    const f = cam.f;
    const k1 = cam.yw - cam.yh;
    const camX = fr.camX;
    const top = cam.yh - fr.camY - fr.bandTop;
    for (let q = fr.q0; q < fr.q1; q++) {
      const kind = mesh.quadKind[q];
      if (kind === QUAD_FACE_UP && fr.eyeU <= mesh.quadU0[q]) continue;
      if (kind === QUAD_FACE_UN && fr.eyeU >= mesh.quadU0[q]) continue;
      if (!this.bindQuad(fr, q)) continue;
      const base = q * 4;
      for (let c = 0; c < 4; c++) {
        const i = mesh.quads[base + c];
        const s = f / (f - mesh.pv[i]);
        this.px[c] = (FLOOR_CX + (mesh.pu[i] - camX - FLOOR_CX) * s) * d;
        this.py[c] = (top + (k1 - mesh.ph[i]) * s) * d;
        this.pq[c] = s;
        this.pa[c] = mesh.ta[i] * s;
        this.pb[c] = mesh.tb[i] * s;
      }
      this.tri(band, 0, 1, 2);
      this.tri(band, 0, 2, 3);
    }
    band.touch();
    this.fr = null;
    return band;
  }

  /** Set up the textures of quad q; false = nothing to draw with (skip). */
  private bindQuad(fr: FloorFrame, q: number): boolean {
    const m = fr.mesh.quadMat[q];
    this.overAlpha = 0;
    if (m < 0) {
      const tex = fr.chunk(fr.mesh.quadChunk[q]);
      if (!tex) return false;
      setTex(this.t0, tex, MODE_CHUNK, tex.u0, 0);
      return true;
    }
    const mat: FloorMaterial | undefined = fr.materials[m];
    if (!mat) return false;
    if (!this.bindLayer(fr, this.t0, mat.base)) return false;
    const o = mat.over;
    if (o && o.alpha > 0 && this.bindLayer(fr, this.t1, o)) this.overAlpha = o.alpha;
    return true;
  }

  private bindLayer(fr: FloorFrame, t: Tex, l: FloorMaterialLayer): boolean {
    const tex = fr.tile(l.tile);
    if (!tex) return false;
    setTex(t, tex, MODE_TILE, l.du * fr.tick, l.dv * fr.tick);
    return true;
  }

  /** Rasterise triangle (a, b, c) of the projected quad. */
  private tri(band: PixelBuffer, a: number, b: number, c: number): void {
    const X = this.px;
    const Y = this.py;
    // Sort by y (then x), so a shared edge is always walked from the same end.
    let i0 = a;
    let i1 = b;
    let i2 = c;
    let tmp: number;
    if (Y[i1] < Y[i0] || (Y[i1] === Y[i0] && X[i1] < X[i0])) {
      tmp = i0;
      i0 = i1;
      i1 = tmp;
    }
    if (Y[i2] < Y[i1] || (Y[i2] === Y[i1] && X[i2] < X[i1])) {
      tmp = i1;
      i1 = i2;
      i2 = tmp;
    }
    if (Y[i1] < Y[i0] || (Y[i1] === Y[i0] && X[i1] < X[i0])) {
      tmp = i0;
      i0 = i1;
      i1 = tmp;
    }
    const x0 = X[i0];
    const y0 = Y[i0];
    const x1 = X[i1];
    const y1 = Y[i1];
    const x2 = X[i2];
    const y2 = Y[i2];
    const det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(det) < 1e-9) return;
    const H = band.h;
    const W = band.w;
    // Whole rows and columns as int32 (`| 0`): no int / double merge for V8 to box at the span call.
    let ys = Math.ceil(y0 - 0.5) | 0;
    let ye = Math.ceil(y2 - 0.5) | 0;
    if (ys < 0) ys = 0;
    if (ye > H) ye = H;
    if (ys >= ye) return;
    this.triangles++;
    // Plane gradients of q, qa, qb in band px.
    const Q = this.pq;
    const A = this.pa;
    const B = this.pb;
    const e1x = x1 - x0;
    const e1y = y1 - y0;
    const e2x = x2 - x0;
    const e2y = y2 - y0;
    const inv = 1 / det;
    const pl = this.pl;
    pl.x0 = x0;
    pl.y0 = y0;
    pl.q0 = Q[i0];
    pl.a0 = A[i0];
    pl.b0 = B[i0];
    pl.qx = ((Q[i1] - Q[i0]) * e2y - (Q[i2] - Q[i0]) * e1y) * inv;
    pl.qy = ((Q[i2] - Q[i0]) * e1x - (Q[i1] - Q[i0]) * e2x) * inv;
    pl.ax = ((A[i1] - A[i0]) * e2y - (A[i2] - A[i0]) * e1y) * inv;
    pl.ay = ((A[i2] - A[i0]) * e1x - (A[i1] - A[i0]) * e2x) * inv;
    pl.bx = ((B[i1] - B[i0]) * e2y - (B[i2] - B[i0]) * e1y) * inv;
    pl.by = ((B[i2] - B[i0]) * e1x - (B[i1] - B[i0]) * e2x) * inv;
    // Rows: b is constant along a row when q and qb do not change with x (flat tops, v faces).
    this.flatRow = Math.abs(pl.qx) < 1e-12 && Math.abs(pl.bx) < 1e-12;
    // The long edge (i0 → i2) is on the left when i1 lies right of it.
    const longLeft = det > 0;
    for (let y = ys; y < ye; y++) {
      const yc = y + 0.5;
      const xl0 = x0 + ((yc - y0) * (x2 - x0)) / (y2 - y0);
      let xs0: number;
      if (yc < y1) xs0 = y1 === y0 ? x1 : x0 + ((yc - y0) * (x1 - x0)) / (y1 - y0);
      else xs0 = y2 === y1 ? x1 : x1 + ((yc - y1) * (x2 - x1)) / (y2 - y1);
      const xl = longLeft ? xl0 : xs0;
      const xr = longLeft ? xs0 : xl0;
      let xa = Math.ceil(xl - 0.5) | 0;
      let xb = Math.ceil(xr - 0.5) | 0;
      if (xa < 0) xa = 0;
      if (xb > W) xb = W;
      if (xa >= xb) continue;
      this.span(band, y, xa, xb);
    }
  }

  /** One span of the current triangle: pixels xa … xb − 1 of row y. */
  private span(band: PixelBuffer, y: number, xa: number, xb: number): void {
    const fr = this.fr as FloorFrame;
    const pl = this.pl;
    const d = this.outD;
    const out = band.data;
    const z = this.z;
    const row = y * band.w;
    const t = this.t0;
    const t1 = this.t1;
    const qx = pl.qx;
    const ax = pl.ax;
    const bx = pl.bx;
    const dy = y + 0.5 - pl.y0;
    const dx = xa + 0.5 - pl.x0;
    let q = pl.q0 + qx * dx + pl.qy * dy;
    let qa = pl.a0 + ax * dx + pl.ay * dy;
    let qb = pl.b0 + bx * dx + pl.by * dy;
    // Footprints at the span's middle (texture px per output px), for the level and the sharpness.
    const n = xb - xa;
    const qm = q + qx * (n / 2);
    const iqm = 1 / qm;
    const amw = (qa + ax * (n / 2)) * iqm;
    const bmw = (qb + bx * (n / 2)) * iqm;
    const fa = Math.max(Math.abs((ax - amw * qx) * iqm), Math.abs((pl.ay - amw * pl.qy) * iqm)) * t.d;
    const fb = Math.max(Math.abs((bx - bmw * qx) * iqm), Math.abs((pl.by - bmw * pl.qy) * iqm)) * t.d;
    // Sharp bilinear: magnification along the columns (mx) and the rows (my); the tile level.
    const mx = fa > 1e-9 ? 1 / fa : 64;
    let my: number;
    let level = 0;
    if (t.mode === MODE_CHUNK) {
      my = d / t.d;
    } else {
      // tileLevel(fb), inlined (no double passes through a call in the hot path).
      level = fb > 2.8284271 ? 2 : fb > 1.4142135 ? 1 : 0;
      const fl = fb / (1 << level);
      my = fl > 1e-9 ? 1 / fl : 64;
    }
    const cam = fr.cam;
    const ov = this.overAlpha;
    const k1 = (cam.yw - cam.yh) * cam.f;
    const yb = cam.yh - cam.back;
    t.f = cam.f;
    t.k1 = k1;
    t.yb = yb;
    t.level = level;
    t.my = my;
    t.mx = mx;
    t.alpha = 1;
    if (ov > 0) {
      t1.f = cam.f;
      t1.k1 = k1;
      t1.yb = yb;
      t1.level = level;
      t1.my = my;
      t1.mx = mx;
      t1.alpha = ov;
    }
    let cnt = 0;
    if (this.flatRow) {
      // b fixed along the row: the rows are set up once; the texel column moves linearly in x (q is
      // constant), so it is stepped (and wrapped for a tile) instead of divided per pixel.
      const iq = 1 / q;
      t.sb = qb * iq;
      t.sa = qa * iq;
      setRow(t);
      const da = ax * iq;
      const tile0 = t.mode === MODE_TILE;
      const w0 = t.w;
      // The first texel column (a tile's wrapped into [0, w)): colStart, inlined.
      let c0 = (t.sa - t.u0) * t.d - 0.5;
      if (tile0) c0 -= Math.floor(c0 / w0) * w0;
      else c0 += CHUNK_APRON;
      const dc0 = da * t.d;
      let c1 = 0.5;
      let dc1 = 0.5;
      let w1 = 1;
      if (ov > 0) {
        t1.sb = t.sb;
        t1.sa = t.sa;
        setRow(t1);
        w1 = t1.w;
        c1 = (t1.sa - t1.u0) * t1.d - 0.5;
        c1 -= Math.floor(c1 / w1) * w1;
        dc1 = da * t1.d;
      }
      for (let x = xa; x < xb; x++) {
        const p = row + x;
        if (q > z[p]) {
          z[p] = q;
          let i = Math.floor(c0) | 0;
          let wx = c0 - i;
          if (mx > 1) {
            wx = (wx - 0.5) * mx + 0.5;
            wx = wx < 0 ? 0 : wx > 1 ? 1 : wx;
          }
          let i1 = i + 1;
          if (tile0) {
            if (i1 === w0) i1 = 0;
          } else {
            if (i < 0) i = 0;
            else if (i >= w0) i = w0 - 1;
            if (i1 < 0) i1 = 0;
            else if (i1 >= w0) i1 = w0 - 1;
          }
          t.wx = wx;
          tapInto(out, p, t, i, i1);
          if (ov > 0) {
            const j = Math.floor(c1) | 0;
            const j1 = j + 1 === w1 ? 0 : j + 1;
            let w = c1 - j;
            if (mx > 1) {
              w = (w - 0.5) * mx + 0.5;
              w = w < 0 ? 0 : w > 1 ? 1 : w;
            }
            t1.wx = w;
            tapInto(out, p, t1, j, j1);
          }
          cnt++;
        }
        c0 += dc0;
        if (tile0) {
          if (c0 >= w0) c0 -= w0;
          else if (c0 < 0) c0 += w0;
        }
        if (ov > 0) {
          c1 += dc1;
          if (c1 >= w1) c1 -= w1;
          else if (c1 < 0) c1 += w1;
        }
      }
    } else {
      for (let x = xa; x < xb; x++, q += qx, qa += ax, qb += bx) {
        const p = row + x;
        if (q <= z[p]) continue;
        z[p] = q;
        const iq = 1 / q;
        t.sa = qa * iq;
        t.sb = qb * iq;
        setRow(t);
        sampleInto(out, p, t);
        if (ov > 0) {
          t1.sa = t.sa;
          t1.sb = t.sb;
          setRow(t1);
          sampleInto(out, p, t1);
        }
        cnt++;
      }
    }
    this.pixels += cnt;
  }
}

// ------------------------------------------------------------------------------- sampling

/** @internal (quad.ts) Bind a texture to a layer (u0, b0: the chunk's first u, or a tile's drift). */
export function setTex(t: Tex, tex: FloorTexture, mode: number, u0: number, b0: number): void {
  t.tex = tex;
  t.mode = mode;
  t.d = tex.density;
  t.u0 = u0;
  t.b0 = b0;
}

/** @internal (quad.ts) The span constants of a layer (see `Tex`). */
export function spanConsts(t: Tex, f: number, k1: number, yb: number, level: number, my: number, mx: number, alpha: number): void {
  t.f = f;
  t.k1 = k1;
  t.yb = yb;
  t.level = level;
  t.my = my;
  t.mx = mx;
  t.alpha = alpha;
}

/**
 * @internal (quad.ts) Pick the row pair of layer t for its texture coordinate `t.sb` (world px; a
 * chunk maps it through its row function) at its mip level, with the sharp weight for `t.my`.
 */
export function setRow(t: Tex): void {
  const tex = t.tex as FloorTexture;
  const chunk = t.mode === MODE_CHUNK;
  const lv = tex.levels[chunk ? 0 : t.level];
  const w = lv.w;
  const h = lv.h;
  // Chunk: rowOf = d · (y(v) − back) − 0.5 with y(v) = yh + (yw − yh)·f/(f − v). Tile: wrapping rows.
  const rf = chunk ? t.d * (t.k1 / (t.f - t.sb) + t.yb) - 0.5 : ((t.sb - t.b0) * t.d) / (1 << t.level) - 0.5;
  let j = Math.floor(rf) | 0;
  let wy = rf - j;
  const my = t.my;
  if (my > 1) {
    wy = (wy - 0.5) * my + 0.5;
    wy = wy < 0 ? 0 : wy > 1 ? 1 : wy;
  }
  t.wy = wy;
  let j1 = j + 1;
  if (chunk) {
    if (j < 0) j = 0;
    else if (j >= h) j = h - 1;
    if (j1 < 0) j1 = 0;
    else if (j1 >= h) j1 = h - 1;
  } else {
    j = ((j % h) + h) % h;
    j1 = j + 1 === h ? 0 : j + 1;
  }
  t.buf = lv.data;
  t.w = w;
  t.r0 = j * w;
  t.r1 = j1 * w;
}

/**
 * Bilinear of columns i, i1 (weight `t.wx`) on the row pair set by setRow, written to out[p], mixed
 * over what is there at `t.alpha` < 1.
 */
function tapInto(out: Uint32Array, p: number, t: Tex, i: number, i1: number): void {
  const buf = t.buf;
  const wy = t.wy;
  const wx = t.wx;
  const alpha = t.alpha;
  const c00 = buf[t.r0 + i];
  let r: number;
  let g: number;
  let b: number;
  if (wy === 0 && wx === 0) {
    if (alpha >= 1) {
      out[p] = c00;
      return;
    }
    r = c00 >>> 24;
    g = (c00 >>> 16) & 255;
    b = (c00 >>> 8) & 255;
  } else {
    const c10 = buf[t.r0 + i1];
    const c01 = wy === 0 ? c00 : buf[t.r1 + i];
    const c11 = wy === 0 ? c10 : buf[t.r1 + i1];
    const iwx = 1 - wx;
    const iwy = 1 - wy;
    r = ((c00 >>> 24) * iwx + (c10 >>> 24) * wx) * iwy + ((c01 >>> 24) * iwx + (c11 >>> 24) * wx) * wy;
    g = (((c00 >>> 16) & 255) * iwx + ((c10 >>> 16) & 255) * wx) * iwy + (((c01 >>> 16) & 255) * iwx + ((c11 >>> 16) & 255) * wx) * wy;
    b = (((c00 >>> 8) & 255) * iwx + ((c10 >>> 8) & 255) * wx) * iwy + (((c01 >>> 8) & 255) * iwx + ((c11 >>> 8) & 255) * wx) * wy;
  }
  if (alpha < 1) {
    const o = out[p];
    const ia = 1 - alpha;
    r = (o >>> 24) * ia + r * alpha;
    g = ((o >>> 16) & 255) * ia + g * alpha;
    b = ((o >>> 8) & 255) * ia + b * alpha;
  }
  out[p] = (((r + 0.5) | 0) << 24) | (((g + 0.5) | 0) << 16) | (((b + 0.5) | 0) << 8) | 255;
}

/** @internal (quad.ts) Sample layer t at `t.sa` on the row set by setRow into out[p]. */
export function sampleInto(out: Uint32Array, p: number, t: Tex): void {
  const w = t.w;
  const cf = t.mode === MODE_CHUNK ? (t.sa - t.u0) * t.d + (CHUNK_APRON - 0.5) : (t.sa - t.u0) * t.d - 0.5;
  let i = Math.floor(cf) | 0;
  let wx = cf - i;
  const mx = t.mx;
  if (mx > 1) {
    wx = (wx - 0.5) * mx + 0.5;
    wx = wx < 0 ? 0 : wx > 1 ? 1 : wx;
  }
  t.wx = wx;
  let i1 = i + 1;
  if (t.mode === MODE_CHUNK) {
    if (i < 0) i = 0;
    else if (i >= w) i = w - 1;
    if (i1 < 0) i1 = 0;
    else if (i1 >= w) i1 = w - 1;
  } else {
    i = ((i % w) + w) % w;
    i1 = i + 1 === w ? 0 : i + 1;
  }
  tapInto(out, p, t, i, i1);
}

/** a → b by w (0..1), per channel, rounded; opaque. */
export function lerpColor(a: number, b: number, w: number): number {
  const iw = 1 - w;
  const r = (a >>> 24) * iw + (b >>> 24) * w;
  const g = ((a >>> 16) & 255) * iw + ((b >>> 16) & 255) * w;
  const bl = ((a >>> 8) & 255) * iw + ((b >>> 8) & 255) * w;
  return ((((r + 0.5) | 0) << 24) | (((g + 0.5) | 0) << 16) | (((bl + 0.5) | 0) << 8) | 255) >>> 0;
}
