/**
 * The car texture sheet (docs/design/rally.md §6, §7.4): one 4-bit page per car model, painted by
 * code in METRES of model space, so the meshes (models/loft.ts) and the painters (tex/estate.ts …)
 * share one mapping and every car has the same texel density, `CAR_TEXEL` texels per metre.
 *
 * Model space (docs/api/rally.md A.2): the nose points +z, y up, +x is the car's LEFT side, the
 * wheels stand on y = 0. The sheet's regions and their planar mappings:
 * - `sideL` (the left side, +x) and `sideR` (the right side, −x): u along z, v down from `frame.y0`.
 *   The left side has the nose at the texture's left (u = (z0 − z)·D), the right side at its right
 *   (u = (z + z0)·D): each side reads left to right as a viewer outside it sees it, so lettering is
 *   painted unmirrored on both.
 * - `top` (bonnet, windscreen, roof, unrolled along the profile): u = (x0 − x)·D (+x first: text reads
 *   from behind), v = s·D where s is the arc length along the top line from the nose.
 * - `front` (the nose, seen from ahead: u = (x + x0)·D) and `back` (the tail, seen from behind:
 *   u = (x0 − x)·D); v = (top − y)·D.
 * - `wheel` (the rim face, 22 × 22 texels = 0.69 m), `tread`, two plates (a decal at about 2× density
 *   so the made-up plate text fits), the flat-colour `solids` (one 2 × 2 patch per slot) and extras.
 *
 * Pure; setup code (it allocates freely; the result is a `TexturePage`).
 */
import type { TexturePage } from '../../../../engine/view3d';
import { S, type Slot } from './car-palette';
import { PageBuilder, PAGE_MAX, type TexRect } from './kit';
import { letterHeight, letterWidth, paintText, type LetterSize } from './letters';

/** Texels per metre on every car (sides, roofs, ends, wheels). */
export const CAR_TEXEL = 32;

/** Rim face texels (a square). */
export const WHEEL_TEX = 22;
/** Plate decal texels (34 × 8 on a 0.52 × 0.12 m plate). */
export const PLATE_TEX = { w: 34, h: 8 } as const;

/** The texture frame of a car body in metres (bounds a little outside the body: no edge bleed). */
export interface CarFrame {
  /** Half length of the side texture (z from −z0 to +z0). */
  readonly z0: number;
  /** The side texture's top and bottom (y, m). */
  readonly y0: number;
  readonly y1: number;
  /** Half width of the top and the end textures. */
  readonly x0: number;
  /** The unrolled length of the top line (m). */
  readonly topLen: number;
  /** The front and back textures' top (y, m); both end at `y1`. */
  readonly frontTop: number;
  readonly backTop: number;
}

/** A named extra rectangle of a sheet (lamp faces, displays, flowers …). */
export interface ExtraTex {
  readonly name: string;
  readonly w: number;
  readonly h: number;
}

export class CarSheet {
  readonly b: PageBuilder;
  /** Texels per metre (`CAR_TEXEL`; FIELD's long vehicles fewer: the limousine, the lorry, the coach). */
  readonly D: number;
  readonly frame: CarFrame;
  readonly sideL: TexRect;
  readonly sideR: TexRect;
  readonly top: TexRect;
  readonly front: TexRect;
  readonly back: TexRect;
  readonly wheel: TexRect;
  readonly tread: TexRect;
  readonly plateF: TexRect;
  readonly plateB: TexRect;
  /** A 2 × 2 patch per palette slot (flat-coloured parts). */
  readonly solids: readonly TexRect[];
  readonly extra: Readonly<Record<string, TexRect>>;

  constructor(id: number, frame: CarFrame, extras: readonly ExtraTex[] = [], h = PAGE_MAX, texel = CAR_TEXEL) {
    const D = texel;
    this.D = texel;
    this.frame = frame;
    this.b = new PageBuilder(id, PAGE_MAX, h);
    const sw = Math.ceil(2 * frame.z0 * D);
    const sh = Math.ceil((frame.y0 - frame.y1) * D);
    const tw = Math.ceil(2 * frame.x0 * D);
    const th = Math.ceil(frame.topLen * D);
    const fh = Math.ceil((frame.frontTop - frame.y1) * D);
    const bh = Math.ceil((frame.backTop - frame.y1) * D);
    if (sw + tw > PAGE_MAX || th > h) throw new Error(`CarSheet ${id}: the sides (${sw}) and the top (${tw}×${th}) do not fit`);
    this.sideL = this.b.reserve(0, 0, sw, sh);
    this.sideR = this.b.reserve(0, sh, sw, sh);
    this.top = this.b.reserve(PAGE_MAX - tw, 0, tw, th);
    this.front = this.b.reserve(0, 2 * sh, tw, fh);
    this.back = this.b.reserve(tw, 2 * sh, tw, bh);
    // The rest: shelves under the ends, left of the top strip.
    const areaW = PAGE_MAX - tw;
    let x = 2 * tw;
    let y = 2 * sh;
    let shelf = Math.max(fh, bh);
    if (x > areaW) {
      x = 0;
      y += shelf;
      shelf = 0;
    }
    const place = (w: number, hh: number): TexRect => {
      if (x + w > areaW) {
        x = 0;
        y += shelf;
        shelf = 0;
      }
      if (y + hh > h) throw new Error(`CarSheet ${id}: the page is full`);
      const r = this.b.reserve(x, y, w, hh);
      x += w;
      shelf = Math.max(shelf, hh);
      return r;
    };
    this.wheel = place(WHEEL_TEX, WHEEL_TEX);
    this.tread = place(8, 9);
    this.plateF = place(PLATE_TEX.w, PLATE_TEX.h);
    this.plateB = place(PLATE_TEX.w, PLATE_TEX.h);
    const solids: TexRect[] = [];
    for (let k = 0; k < 16; k++) solids.push(place(2, 2));
    this.solids = solids;
    const extra: Record<string, TexRect> = {};
    for (const e of extras) extra[e.name] = place(e.w, e.h);
    this.extra = extra;
    for (let k = 0; k < 16; k++) this.b.fill(solids[k], k);
  }

  // -- uv (texel units) of model-space points ----------------------------------------------------

  sideU(side: 'L' | 'R', z: number): number {
    const r = side === 'L' ? this.sideL : this.sideR;
    return r.x + (side === 'L' ? this.frame.z0 - z : z + this.frame.z0) * this.D;
  }

  sideV(side: 'L' | 'R', y: number): number {
    const r = side === 'L' ? this.sideL : this.sideR;
    return r.y + (this.frame.y0 - y) * this.D;
  }

  topU(x: number): number {
    return this.top.x + (this.frame.x0 - x) * this.D;
  }

  topV(s: number): number {
    return this.top.y + s * this.D;
  }

  capU(end: 'front' | 'back', x: number): number {
    const r = end === 'front' ? this.front : this.back;
    return r.x + (end === 'front' ? x + this.frame.x0 : this.frame.x0 - x) * this.D;
  }

  capV(end: 'front' | 'back', y: number): number {
    const r = end === 'front' ? this.front : this.back;
    return r.y + ((end === 'front' ? this.frame.frontTop : this.frame.backTop) - y) * this.D;
  }

  /** The uv of a flat-coloured slot (the middle of its patch). */
  solid(slot: Slot): readonly [number, number, number, number] {
    const r = this.solids[slot];
    const u = r.x + 1;
    const v = r.y + 1;
    return [u, v, u, v];
  }

  /** The texel rectangle of a named extra as the uv corners u0 v0 u1 v1. */
  rectUV(r: TexRect): readonly [number, number, number, number] {
    return [r.x, r.y, r.x + r.w, r.y + r.h];
  }

  // -- painters in metres ------------------------------------------------------------------------

  /** Paint a side texel by texel: `f(z, y, i, j)` gives the slot at the texel's centre (i, j: the texel, for dithers). */
  paintSide(side: 'L' | 'R', f: (z: number, y: number, i: number, j: number) => number): void {
    const r = side === 'L' ? this.sideL : this.sideR;
    const { z0, y0 } = this.frame;
    for (let j = 0; j < r.h; j++) {
      const y = y0 - (j + 0.5) / this.D;
      for (let i = 0; i < r.w; i++) {
        const z = side === 'L' ? z0 - (i + 0.5) / this.D : (i + 0.5) / this.D - z0;
        this.b.set(r, i, j, f(z, y, i, j));
      }
    }
  }

  /** Paint the top: `f(x, s)` with s the arc length from the nose. */
  paintTop(f: (x: number, s: number, i: number, j: number) => number): void {
    const r = this.top;
    for (let j = 0; j < r.h; j++) {
      const s = (j + 0.5) / this.D;
      for (let i = 0; i < r.w; i++) this.b.set(r, i, j, f(this.frame.x0 - (i + 0.5) / this.D, s, i, j));
    }
  }

  /** Paint an end: `f(x, y)` (x in model space). */
  paintCap(end: 'front' | 'back', f: (x: number, y: number, i: number, j: number) => number): void {
    const r = end === 'front' ? this.front : this.back;
    const top = end === 'front' ? this.frame.frontTop : this.frame.backTop;
    for (let j = 0; j < r.h; j++) {
      const y = top - (j + 0.5) / this.D;
      for (let i = 0; i < r.w; i++) {
        const x = end === 'front' ? (i + 0.5) / this.D - this.frame.x0 : this.frame.x0 - (i + 0.5) / this.D;
        this.b.set(r, i, j, f(x, y, i, j));
      }
    }
  }

  /** Paint any rectangle texel by texel: `f(i, j)`. */
  paintRect(r: TexRect, f: (i: number, j: number) => number): void {
    for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) this.b.set(r, i, j, f(i, j));
  }

  /** Text on a side, centred at z = zc, its top at y = yTop (it reads left to right on both sides). */
  sideText(side: 'L' | 'R', s: string, zc: number, yTop: number, slot: number, o: { size?: LetterSize; gap?: number; shadow?: number } = {}): void {
    const r = side === 'L' ? this.sideL : this.sideR;
    const w = letterWidth(s, o.size, o.gap);
    const uc = this.sideU(side, zc) - r.x;
    paintText(this.b, r, s, Math.round(uc - w / 2), Math.round((this.frame.y0 - yTop) * this.D), slot, o);
  }

  /** A filled box on a side between z0 and z1 (any order), from yTop down to yBot. */
  sideBox(side: 'L' | 'R', z0: number, z1: number, yTop: number, yBot: number, slot: number): void {
    const r = side === 'L' ? this.sideL : this.sideR;
    const ua = this.sideU(side, z0) - r.x;
    const ub = this.sideU(side, z1) - r.x;
    const u0 = Math.round(ua < ub ? ua : ub);
    const u1 = Math.round(ua < ub ? ub : ua);
    const v0 = Math.round((this.frame.y0 - yTop) * this.D);
    const v1 = Math.round((this.frame.y0 - yBot) * this.D);
    this.b.rect(r, u0, v0, u1 - u0, v1 - v0, slot);
  }

  /** Text centred in a rectangle (displays, signs). */
  textIn(r: TexRect, s: string, slot: number, gap = 1): void {
    const w = letterWidth(s, 'small', gap);
    paintText(this.b, r, s, Math.floor((r.w - w) / 2), Math.floor((r.h - letterHeight()) / 2), slot, { gap });
  }

  /** A small bitmap (rows of characters → slots by `key`; '.' = untouched) on a side, centred at zc. */
  sideIcon(side: 'L' | 'R', rows: readonly string[], key: Readonly<Record<string, number>>, zc: number, yTop: number, flip = false): void {
    const r = side === 'L' ? this.sideL : this.sideR;
    const w = rows[0].length;
    const x0 = Math.round(this.sideU(side, zc) - r.x - w / 2);
    const y0 = Math.round((this.frame.y0 - yTop) * this.D);
    this.icon(r, rows, key, x0, y0, flip);
  }

  /** A bitmap at texel (x0, y0) of `r`. */
  icon(r: TexRect, rows: readonly string[], key: Readonly<Record<string, number>>, x0: number, y0: number, flip = false): void {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      for (let i = 0; i < row.length; i++) {
        const k = key[row[flip ? row.length - 1 - i : i]];
        if (k !== undefined) this.b.set(r, x0 + i, y0 + j, k);
      }
    }
  }

  /** Text across the top, centred on the car's centre line, its first row at arc length `s`. */
  topText(s: string, at: number, slot: number, o: { size?: LetterSize; gap?: number; shadow?: number } = {}): void {
    const w = letterWidth(s, o.size, o.gap);
    paintText(this.b, this.top, s, Math.round(this.frame.x0 * this.D - w / 2), Math.round(at * this.D), slot, o);
  }

  /** Text on an end, centred at x = xc, its top at y = yTop. */
  capText(end: 'front' | 'back', s: string, xc: number, yTop: number, slot: number, o: { size?: LetterSize; gap?: number } = {}): void {
    const r = end === 'front' ? this.front : this.back;
    const w = letterWidth(s, o.size, o.gap);
    paintText(this.b, r, s, Math.round(this.capU(end, xc) - r.x - w / 2), Math.round(this.capV(end, yTop) - r.y), slot, o);
  }

  /** A made-up yellow Dutch plate (both plates): a dark rim and the text. */
  plates(text: string): void {
    for (const r of [this.plateF, this.plateB]) {
      this.b.fill(r, S.PLATE);
      this.b.rect(r, 0, 0, r.w, 1, S.PLASTIC);
      this.b.rect(r, 0, r.h - 1, r.w, 1, S.PLASTIC);
      this.b.rect(r, 0, 0, 1, r.h, S.PLASTIC);
      this.b.rect(r, r.w - 1, 0, 1, r.h, S.PLASTIC);
      const w = letterWidth(text);
      paintText(this.b, r, text, Math.floor((r.w - w) / 2), Math.floor((r.h - letterHeight()) / 2), S.BLACK);
    }
  }

  build(): TexturePage {
    return this.b.build();
  }
}

/** A 2 × 2 ordered dither: true on half the texels (a checker), for two-tone blends. */
export function checker(i: number, j: number): boolean {
  return ((i + j) & 1) === 0;
}

/** A 4 × 4 ordered (Bayer) threshold 0..15 at texel (i, j). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function bayer(i: number, j: number): number {
  return BAYER[(j & 3) * 4 + (i & 3)];
}
