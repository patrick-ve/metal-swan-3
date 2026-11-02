/**
 * The index raster of one façade strip chunk band (docs/design/oat.md §8.6 "The strips"; the strip
 * space: mission/strips/types.ts "THE STRIP SPACE"). The painters draw MATERIAL indices of the oat
 * set (palette.ts) plus a light MASK per art px; the light pass (light.ts) turns the mask into
 * the section's light and the resolve writes the colours.
 *
 * Coordinates: local art columns x (0 … W − 1 of the chunk; global art column gx = gx0 + x) and art
 * y UP from the façade base (0 … H − 1). Geometry is planned in WORLD px (the grammar's lots) and
 * mapped here: x = round(stripXOfU(u, s) · d) − gx0, y = round(h · s · d). Every edge is computed from
 * global numbers, so chunks tile without a seam and every band of a chunk agrees.
 *
 * Only the band's rows [yLo, yHi) are written (the store slices a chunk into bands; spec §8.6: no
 * job over 16 ms). One raster is reused by every paint (no per-frame allocation; jobs run one at a
 * time on the main thread).
 */
import { stripXOfU, uOfStripX } from '../../../../mission/strips/space';
import type { Dn } from './palette';
import { M_LIT } from './palette';

export class Art {
  d: Dn = 1;
  s = 1;
  W = 0;
  H = 0;
  /** Global art column of local column 0 (= cx · 256 · d). */
  gx0 = 0;
  /** The band: art y [yLo, yHi) (up from the base). */
  yLo = 0;
  yHi = 0;
  idx: Uint8Array = new Uint8Array(0);
  mask: Uint8Array = new Uint8Array(0);
  /** The lot index (into the plan's lot list) painted at each column, −1 none. */
  colLot: Int32Array = new Int32Array(0);

  begin(cx: number, d: Dn, s: number, W: number, H: number, yLo: number, yHi: number): void {
    this.d = d;
    this.s = s;
    this.W = W;
    this.H = H;
    this.gx0 = cx * 256 * d;
    this.yLo = Math.max(0, yLo);
    this.yHi = Math.min(H, yHi);
    if (this.idx.length < W * H) {
      this.idx = new Uint8Array(W * H);
      this.mask = new Uint8Array(W * H);
    }
    if (this.colLot.length < W) this.colLot = new Int32Array(W);
    this.colLot.fill(-1, 0, W);
    const r0 = (H - this.yHi) * W;
    const r1 = (H - this.yLo) * W;
    this.idx.fill(0, r0, r1);
    this.mask.fill(0, r0, r1);
  }

  /** Local art column of world x u (the left edge of the art px that holds u). */
  X(u: number): number {
    return Math.round(stripXOfU(u, this.s) * this.d) - this.gx0;
  }

  /** Art y of a world height h over the façade base. */
  Y(h: number): number {
    return Math.round(h * this.s * this.d);
  }

  /** Art px of a world length (at least `min`). */
  L(w: number, min = 1): number {
    return Math.max(min, Math.round(w * this.s * this.d));
  }

  /** World x at the centre of local column x. */
  uOf(x: number): number {
    return uOfStripX((this.gx0 + x + 0.5) / this.d, this.s);
  }

  /** World height at the centre of art row y. */
  hOf(y: number): number {
    return (y + 0.5) / (this.s * this.d);
  }

  /** Buffer offset of (x, y) (no clip). */
  at(x: number, y: number): number {
    return (this.H - 1 - y) * this.W + x;
  }

  ok(x: number, y: number): boolean {
    return x >= 0 && x < this.W && y >= this.yLo && y < this.yHi;
  }

  get(x: number, y: number): number {
    return this.ok(x, y) ? this.idx[this.at(x, y)] : 0;
  }

  put(x: number, y: number, v: number, m: number = M_LIT): void {
    if (!this.ok(x, y)) return;
    const o = this.at(x, y);
    this.idx[o] = v;
    this.mask[o] = m;
  }

  /** Fill art rect [x0, x1) × [y0, y1) (clipped to the chunk and the band). */
  rect(x0: number, y0: number, x1: number, y1: number, v: number, m: number = M_LIT): void {
    const a = Math.max(0, x0);
    const b = Math.min(this.W, x1);
    const c = Math.max(this.yLo, y0);
    const e = Math.min(this.yHi, y1);
    if (a >= b || c >= e) return;
    for (let y = c; y < e; y++) {
      const o = (this.H - 1 - y) * this.W;
      this.idx.fill(v, o + a, o + b);
      this.mask.fill(m, o + a, o + b);
    }
  }

  /** Set the mask over a rect where something is painted and the mask is `only` (a cast shadow). */
  shadow(x0: number, y0: number, x1: number, y1: number, m: number, only: number = M_LIT): void {
    const a = Math.max(0, x0);
    const b = Math.min(this.W, x1);
    const c = Math.max(this.yLo, y0);
    const e = Math.min(this.yHi, y1);
    for (let y = c; y < e; y++) {
      const o = (this.H - 1 - y) * this.W;
      for (let x = a; x < b; x++) if (this.idx[o + x] !== 0 && this.mask[o + x] === only) this.mask[o + x] = m;
    }
  }

  /** Map the painted indices of a rect through a table (wear: grime, bleach); `keep` returns false to skip a px. */
  remap(x0: number, y0: number, x1: number, y1: number, table: Uint8Array, keep?: (x: number, y: number) => boolean): void {
    const a = Math.max(0, x0);
    const b = Math.min(this.W, x1);
    const c = Math.max(this.yLo, y0);
    const e = Math.min(this.yHi, y1);
    for (let y = c; y < e; y++) {
      const o = (this.H - 1 - y) * this.W;
      for (let x = a; x < b; x++) {
        const i = this.idx[o + x];
        if (i === 0 || (keep && !keep(x, y))) continue;
        this.idx[o + x] = table[i];
      }
    }
  }

  /** A 1-art-px line from (x0, y0) to (x1, y1) (Bresenham), `w` px thick to the right. */
  line(x0: number, y0: number, x1: number, y1: number, v: number, m: number = M_LIT, w = 1): void {
    let x = x0;
    let y = y0;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 4096; n++) {
      for (let k = 0; k < w; k++) this.put(x + k, y, v, m);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /** Like `line`, but sets the mask only (a cast shadow line) where painted and LIT. */
  shadowLine(x0: number, y0: number, x1: number, y1: number, m: number, w = 1): void {
    let x = x0;
    let y = y0;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 4096; n++) {
      for (let k = 0; k < w; k++) {
        if (this.ok(x + k, y)) {
          const o = this.at(x + k, y);
          if (this.idx[o] !== 0 && this.mask[o] === M_LIT) this.mask[o] = m;
        }
      }
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }
}
