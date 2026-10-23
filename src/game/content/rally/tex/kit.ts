/**
 * The rally texture kit — the CORE by PREP (docs/design/rally.md §7.1 item 3, §7.4;
 * docs/api/rally.md "A. Wave A contracts"). CARS extends it (more painters, liveries) in this
 * folder; TRACK and WORLD paint with it.
 *
 * Textures are palettised and drawn by code (no photo, no scan, no AI image): a `PageBuilder` holds
 * one texture page (≤ 256 × 256 palette indices) with its CLUT rows, hands out rectangles (shelf
 * packing), and paints indices into them: fill, rects, lines, seeded noise (a fork of the caller's
 * rng), our own pixel lettering (the ring wagon font's capitals). `build()` gives the
 * `TexturePage` the 3D view uploads. A CLUT row holds up to 16 colours for a 4-bit texture (256 for
 * an 8-bit one where a gradient needs it), taken from the PAL_HD ramps (`ramp`, `clutOf`).
 *
 * `pageToPixels` expands a page through one CLUT row into a PixelBuffer (tools write it as a PNG
 * with tools/lib/image.ts `savePNG`). Pure; deterministic (+ − × ÷, Math.floor / round only).
 */
import type { Color } from '../../../../engine/color';
import { PAL_HD, type HdRampName } from '../../../../engine/palette-hd';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Rng } from '../../../../engine/rng';
import type { TexturePage } from '../../../../engine/view3d';
import { textCells, textWidth, type FontSize } from '../../ring/wagon/font';

/** The largest page (texels per side). */
export const PAGE_MAX = 256;
/** Entries per CLUT row. */
export const CLUT_ROW = 256;
/** A 4-bit texture's colours. */
export const CLUT_4BIT = 16;
/** A transparent CLUT entry (cut-outs: tree cards, fences). */
export const CLEAR: Color = 0x00000000;

/** A rectangle of a page (texels). */
export interface TexRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Tones `from`..`to` (inclusive) of a PAL_HD ramp, dark → light. */
export function ramp(name: HdRampName, from = 0, to?: number): Color[] {
  const r = PAL_HD[name] as readonly Color[];
  const end = Math.min(r.length - 1, to ?? r.length - 1);
  return r.slice(Math.max(0, from), end + 1);
}

/** A CLUT row from colours and ramps (flattened in order). Throws above 256 entries. */
export function clutOf(...parts: readonly (Color | readonly Color[])[]): Color[] {
  const out: Color[] = [];
  for (const p of parts) {
    if (typeof p === 'number') out.push(p);
    else out.push(...p);
  }
  if (out.length > CLUT_ROW) throw new Error(`clutOf: ${out.length} colours (max ${CLUT_ROW})`);
  return out;
}

export class PageBuilder {
  readonly id: number;
  readonly w: number;
  readonly h: number;
  readonly index: Uint8Array;
  private readonly rows: Color[][] = [];
  private shelfX = 0;
  private shelfY = 0;
  private shelfH = 0;

  constructor(id: number, w = PAGE_MAX, h = PAGE_MAX) {
    if (w < 1 || h < 1 || w > PAGE_MAX || h > PAGE_MAX) throw new Error(`PageBuilder: ${w}×${h} (max ${PAGE_MAX})`);
    this.id = id;
    this.w = w;
    this.h = h;
    this.index = new Uint8Array(w * h);
  }

  /** Add a CLUT row (≤ 256 colours; a 4-bit texture uses ≤ 16): returns its row number. */
  addRow(colors: readonly Color[]): number {
    if (colors.length > CLUT_ROW) throw new Error(`addRow: ${colors.length} colours`);
    this.rows.push([...colors]);
    return this.rows.length - 1;
  }

  /** The number of CLUT rows so far. */
  get rowCount(): number {
    return this.rows.length;
  }

  /**
   * A free rectangle of w × h texels (shelf packing: left to right, then a new shelf below), or
   * null when the page is full. A texture that must wrap (the road along its length) should take
   * the full page height or width (`reserve`).
   */
  alloc(w: number, h: number): TexRect | null {
    if (w > this.w || h > this.h) return null;
    if (this.shelfX + w > this.w) {
      this.shelfY += this.shelfH;
      this.shelfX = 0;
      this.shelfH = 0;
    }
    if (this.shelfY + h > this.h) return null;
    const r = { x: this.shelfX, y: this.shelfY, w, h };
    this.shelfX += w;
    this.shelfH = Math.max(this.shelfH, h);
    return r;
  }

  /** A fixed rectangle (a full-height strip that wraps); the caller keeps `alloc` clear of it. */
  reserve(x: number, y: number, w: number, h: number): TexRect {
    if (x < 0 || y < 0 || x + w > this.w || y + h > this.h) throw new Error(`reserve: ${x},${y} ${w}×${h} outside the page`);
    return { x, y, w, h };
  }

  /** One texel (local to `r`; outside `r` is ignored). */
  set(r: TexRect, x: number, y: number, i: number): void {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    if (xi < 0 || yi < 0 || xi >= r.w || yi >= r.h) return;
    this.index[(r.y + yi) * this.w + r.x + xi] = i;
  }

  get(r: TexRect, x: number, y: number): number {
    return this.index[(r.y + y) * this.w + r.x + x];
  }

  fill(r: TexRect, i: number): void {
    for (let y = 0; y < r.h; y++) this.index.fill(i, (r.y + y) * this.w + r.x, (r.y + y) * this.w + r.x + r.w);
  }

  /** A filled rectangle local to `r` (clipped). */
  rect(r: TexRect, x: number, y: number, w: number, h: number, i: number): void {
    for (let yy = Math.max(0, y); yy < Math.min(r.h, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(r.w, x + w); xx++) this.index[(r.y + yy) * this.w + r.x + xx] = i;
  }

  /** A 1-texel line local to `r` (Bresenham). */
  line(r: TexRect, x0: number, y0: number, x1: number, y1: number, i: number): void {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const xe = Math.round(x1);
    const ye = Math.round(y1);
    const dx = Math.abs(xe - x);
    const dy = -Math.abs(ye - y);
    const sx = x < xe ? 1 : -1;
    const sy = y < ye ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(r, x, y, i);
      if (x === xe && y === ye) break;
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

  /**
   * Seeded noise: every texel of `r` gets one of `idx` (by `weights`, default equal). Pass a fork
   * of the content's rng (`rng.fork('asphalt')`): the same fork gives the same texture.
   */
  noise(r: TexRect, rng: Rng, idx: readonly number[], weights?: readonly number[]): void {
    const w = weights ?? idx.map(() => 1);
    let total = 0;
    for (const v of w) total += v;
    for (let y = 0; y < r.h; y++) {
      for (let x = 0; x < r.w; x++) {
        let pick = rng.next() * total;
        let k = 0;
        while (k < idx.length - 1 && pick >= w[k]) {
          pick -= w[k];
          k++;
        }
        this.index[(r.y + y) * this.w + r.x + x] = idx[k];
      }
    }
  }

  /** Our pixel lettering (the wagon font's capitals: small 3 × 5, big 4 × 6) at (x, y) local to `r`. */
  text(r: TexRect, s: string, x: number, y: number, i: number, size: FontSize = 'small'): void {
    for (const [cx, cy] of textCells(s, [x, x + textWidth(s, size), y, y + 8], { size })) this.set(r, cx, cy, i);
  }

  /** The finished page (the CLUT rows packed, 256 entries each). */
  build(): TexturePage {
    const rows = Math.max(1, this.rows.length);
    const clut = new Uint32Array(rows * CLUT_ROW);
    this.rows.forEach((row, k) => row.forEach((c, j) => (clut[k * CLUT_ROW + j] = c >>> 0)));
    return { id: this.id, w: this.w, h: this.h, index: this.index, clut };
  }
}

/** Width of a text in the kit's lettering (texels). */
export function kitTextWidth(s: string, size: FontSize = 'small'): number {
  return textWidth(s, size);
}

/** A page through one CLUT row as RGBA pixels (tools: `savePNG(pageToPixels(page, 0), file)`). */
export function pageToPixels(page: TexturePage, row = 0): PixelBuffer {
  const buf = new PixelBuffer(page.w, page.h);
  const base = row * CLUT_ROW;
  for (let i = 0; i < page.w * page.h; i++) buf.data[i] = page.clut[base + page.index[i]];
  buf.touch();
  return buf;
}
