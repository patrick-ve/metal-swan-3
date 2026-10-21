/**
 * Shared drawing kit of the `ring/gangs` art (docs/ART_GUIDE.md "UHD art"): the same technique as
 * the civilian cars (content/ring/traffic/art.ts: a lit painted volume over a side profile, rolled
 * edges, the shoulder under the glass, the lower doors tucking under, fittings over it), for our
 * own vehicles. Every helper paints an `HdCanvas` at density d with the ramps of that density
 * (`mat` / `top` / `bot`: `PAL` at 1×, `PAL_HD` at 2× / 4×), so one drawer makes 1×, 2× and 4×.
 */
import type { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { HdCanvas, inPoly, polyDist, type TexSample } from '../../../art/hd';
import { mat, top, type Dn } from '../../stag/kit.art';
import { glyphHit, textWidth } from '../traffic/lettering';
import type { Pt } from './geometry';

export const frac = (v: number): number => v - Math.floor(v);

/** A rolled edge: height over distance e from an edge with roll radius r. */
export function roll(e: number, r: number): number {
  const t = e >= r ? 1 : e <= 0 ? 0 : e / r;
  return r * Math.sqrt(1 - (1 - t) * (1 - t));
}

/** Half width of a fine line (a shut line, a crease) at density d, logical px. */
export function lineW(d: number): number {
  return d === 1 ? 0.5 : d === 2 ? 0.26 : 0.17;
}

/** A frame from a buffer (density tagged above 1×). */
export function frameOf(buf: PixelBuffer, ox: number, oy: number, d: Dn): Frame {
  return d === 1 ? { buf, ox, oy } : { buf, ox, oy, density: d };
}

/**
 * A lit field over the local box where `h(x, y)` is a number (NaN elsewhere): local coordinates,
 * (ox, oy) = the canvas origin in local coordinates.
 */
export function field(c: HdCanvas, ox: number, oy: number, x: number, y: number, w: number, hgt: number, h: (x: number, y: number) => number, o: Parameters<HdCanvas['heightField']>[5]): void {
  c.heightField(x - ox, y - oy, w, hgt, (cx, cy) => h(cx + ox, cy + oy), o);
}

/** Bounding box of a polygon. */
export function polyBox(poly: readonly Pt[]): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [px, py] of poly) {
    x0 = Math.min(x0, px);
    x1 = Math.max(x1, px);
    y0 = Math.min(y0, py);
    y1 = Math.max(y1, py);
  }
  return { x0, y0, x1, y1 };
}

/** What a painted volume needs to know about its vehicle. */
export interface VolumeGeo {
  /** Wheel centres x, their radius (arches are cut round them, 1.2 px wider). */
  wheels: readonly number[];
  wheelR: number;
  /** Holes in the paint (the glass band): nothing is painted inside. */
  holes?: ReadonlyArray<readonly Pt[]>;
  /** The belt (bottom of the glass: a shoulder just under it) and the sill (the doors tuck under). */
  belt: number;
  sill: number;
}

/** Distance from (x, y) to the nearer wheel centre. */
export function wheelDist(g: VolumeGeo, x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < g.wheels.length; i++) best = Math.min(best, Math.hypot(x - (g.wheels[i] + 0.5), y + g.wheelR));
  return best;
}

/**
 * A painted body volume over `poly` (wheel arches cut, holes left out): rolled edges, the shoulder
 * under the belt, the lower panels tucking under toward the sill; `extra` adds height, `tex` paints.
 */
export function volume(
  c: HdCanvas,
  g: VolumeGeo,
  poly: readonly Pt[],
  paint: number,
  ox: number,
  oy: number,
  part: number,
  tex?: (t: TexSample, x: number, y: number) => void,
  extra?: (x: number, y: number) => number,
): void {
  const b = polyBox(poly);
  const ar = g.wheelR + 1.2;
  field(
    c,
    ox,
    oy,
    b.x0 - 1,
    b.y0 - 1,
    b.x1 - b.x0 + 2,
    b.y1 - b.y0 + 2,
    (x, y) => {
      if (!inPoly(x, y, poly)) return NaN;
      const wd = wheelDist(g, x, y);
      if (wd < ar) return NaN;
      if (g.holes) for (const h of g.holes) if (inPoly(x, y, h)) return NaN;
      const e = Math.min(polyDist(x, y, poly), wd - ar + 0.5);
      let h = roll(e, 2.2);
      const sb = y - g.belt;
      if (sb > -0.5) h += 0.55 * Math.exp(-(((sb - 1.1) / 0.8) ** 2)) - 0.2 * Math.exp(-(((sb - 3.2) / 1.4) ** 2));
      if (y > g.sill - 3) h -= (y - (g.sill - 3)) * 0.42;
      return h + (extra ? extra(x, y) : 0);
    },
    { mat: paint, z: 1, part, tex: tex ? (t) => tex(t, t.x + ox, t.y + oy) : null },
  );
}

/** Materials every vehicle shares. */
export interface Mats {
  black: number;
  plastic: number;
  well: number;
  glass: number;
  chrome: number;
  head: number;
  tail: number;
  amber: number;
}

export function mats(c: HdCanvas): Mats {
  return {
    black: mat(c, 'black', { spec: 0.7, shine: 34, lo1: 0, hi1: 2, lo: 1, hi: 4 }),
    plastic: mat(c, 'slate', { spec: 0.25, shine: 14, lo1: 0, hi1: 2, lo: 1, hi: 4 }),
    well: mat(c, 'black', { spec: 0, amb: 0, lo1: 0, hi1: 0, lo: 0, hi: 1 }),
    glass: mat(c, 'slate', { spec: 1.2, shine: 60, lo1: 0, hi1: 2, lo: 1, hi: 3, wrap: 0.2 }),
    chrome: mat(c, 'steel', { spec: 1.2, shine: 50, lo1: 1, hi1: 4, lo: 3, hi: 6, rim: 0.4 }),
    head: mat(c, 'snow', { spec: 1.2, shine: 60, lo1: 2, hi1: 3, lo: 3, hi: 6 }),
    tail: mat(c, 'red', { spec: 1, shine: 50, lo1: 1, hi1: 3, lo: 3, hi: 6 }),
    amber: mat(c, 'orange', { spec: 1, shine: 50, lo1: 0, hi1: 1, lo: 2, hi: 5 }),
  };
}

/** A glossy paint material. */
export function paintMat(c: HdCanvas, colour: string): number {
  if (colour === 'gable') return mat(c, 'gable', { spec: 0.9, shine: 46, lo1: 1, hi1: 3, lo: 2, hi: 5, rim: 0.3, bounce: 0.3 });
  if (colour === 'teal') return mat(c, 'teal', { spec: 0.9, shine: 44, lo1: 0, hi1: 3, lo: 2, hi: 6, rim: 0.3, bounce: 0.35 });
  if (colour === 'cream') return mat(c, 'sand', { spec: 0.7, shine: 40, lo1: 2, hi1: 3, lo: 4, hi: 6, rim: 0.3, bounce: 0.3 });
  if (colour === 'sand') return mat(c, 'sand', { spec: 0.7, shine: 40, lo1: 1, hi1: 3, lo: 2, hi: 6, rim: 0.3, bounce: 0.3 });
  return mat(c, colour, { spec: 0.85, shine: 42, lo1: 0, hi1: 3, lo: 2, rim: 0.3, bounce: 0.3 });
}

/** Dark wheel wells behind the wheels (drawn first, under the body). */
export function wells(c: HdCanvas, g: VolumeGeo, m: Mats, ox: number, oy: number): void {
  const ar = g.wheelR + 1.2;
  for (const wx of g.wheels) {
    const cx = wx + 0.5;
    const cy = -g.wheelR;
    field(c, ox, oy, cx - ar, cy - ar, ar * 2, ar - cy, (x, y) => (Math.hypot(x - cx, y - cy) < ar && y < -1.6 ? 0 : NaN), { mat: m.well, z: 0.3 });
  }
}

/** Is (px, py) on `text` (our 3 × 5 sign face) centred on (cx, cy) with bits of `s` px? */
export function textAt(text: string, cx: number, cy: number, s: number, px: number, py: number, gap = 1): boolean {
  return glyphHit(text, cx - textWidth(text, s, gap) / 2, cy - (5 * s) / 2, s, gap, px, py);
}

const strokeCache = new Map<string, number[]>();

/**
 * The strokes of a text in bit units (x0, y0, x1, y1 per segment): every on-bit is a node, joined to
 * its on-neighbours right and down, and diagonally where no orthogonal bit joins them.
 */
function strokesOf(text: string): number[] {
  const hit = strokeCache.get(text);
  if (hit) return hit;
  const W = textWidth(text, 1, 1);
  const on = (i: number, j: number): boolean => i >= 0 && j >= 0 && i < W && j < 5 && glyphHit(text, 0, 0, 1, 1, i + 0.5, j + 0.5);
  const segs: number[] = [];
  for (let j = 0; j < 5; j++) {
    for (let i = 0; i < W; i++) {
      if (!on(i, j)) continue;
      const x = i + 0.5;
      const y = j + 0.5;
      segs.push(x, y, x, y);
      if (on(i + 1, j)) segs.push(x, y, x + 1, y);
      if (on(i, j + 1)) segs.push(x, y, x, y + 1);
      if (on(i + 1, j + 1) && !on(i + 1, j) && !on(i, j + 1)) segs.push(x, y, x + 1, y + 1);
      if (on(i - 1, j + 1) && !on(i - 1, j) && !on(i, j + 1)) segs.push(x, y, x - 1, y + 1);
    }
  }
  strokeCache.set(text, segs);
  return segs;
}

/**
 * The same text as round-capped strokes (the 2× / 4× letters: the 1× bit footprint, smooth at
 * high density): is (px, py) within `weight` bits of a stroke?
 */
export function textStrokeAt(text: string, cx: number, cy: number, s: number, px: number, py: number, weight = 0.56): boolean {
  const x0 = cx - textWidth(text, s, 1) / 2;
  const y0 = cy - (5 * s) / 2;
  const u = (px - x0) / s;
  const v = (py - y0) / s;
  if (u < -1 || v < -1 || v > 6 || u > textWidth(text, 1, 1) + 1) return false;
  const segs = strokesOf(text);
  const r2 = weight * weight;
  for (let k = 0; k < segs.length; k += 4) {
    const ax = segs[k];
    const ay = segs[k + 1];
    const vx = segs[k + 2] - ax;
    const vy = segs[k + 3] - ay;
    const l2 = vx * vx + vy * vy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((u - ax) * vx + (v - ay) * vy) / l2)) : 0;
    const dx = u - ax - vx * t;
    const dy = v - ay - vy * t;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

/** The letter test of density d: the bits at 1×, the strokes at 2× / 4×. */
export function letterAt(d: number, text: string, cx: number, cy: number, s: number, px: number, py: number): boolean {
  return d === 1 ? textAt(text, cx, cy, s, px, py) : textStrokeAt(text, cx, cy, s, px, py);
}

/** Paint a text (and an optional drop shadow 1 logical px down-right) in fixed colours. */
export function lettering(c: HdCanvas, ox: number, oy: number, text: string, cx: number, cy: number, s: number, ink: string, inkTone: number, shadow: string | null, z = 1e6): void {
  const d = c.d;
  const w = textWidth(text, s, 1) + 2;
  const h = 5 * s + 2;
  const fg = top(ink, d, inkTone);
  const sh = shadow ? top(shadow, d, d === 1 ? 1 : 3) : 0;
  const sd = d === 1 ? 1 : 0.75;
  c.paint(
    cx - w / 2 - ox,
    cy - h / 2 - oy,
    w + 1,
    h + 1,
    (x, y) => {
      const lx = x + ox;
      const ly = y + oy;
      if (letterAt(d, text, cx, cy, s, lx, ly)) return fg;
      if (shadow && letterAt(d, text, cx, cy, s, lx - sd, ly - sd)) return sh;
      return 0;
    },
    z,
  );
}
