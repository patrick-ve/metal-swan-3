/**
 * The town kit of mission `oldenzaal` (TOWN, wave A; docs/design/oldenzaal.md §10; docs/ART_GUIDE.md
 * "UHD art"): ONE painter for the 1×, 2× and 4× art of the town (the shop fronts, De Smulhoek, the
 * street furniture, the basilica, the sky and the roofs).
 *
 * - `Pen` (the ring's scenery kit): a w × h LOGICAL px canvas at density d ∈ {1, 2, 4}. Logical
 *   calls round to the art grid; one drawer per id makes every density, so the geometry (size,
 *   anchor, footprint) is the same at 1×, 2× and 4×.
 * - Colours by ramp NAME from `PAL_HD` or the oldenzaal ramps `PAL_HD_OZ` (sandstone, dusk,
 *   ghost, candle, night): `T(name, k, d)` is tone k (0 = deepest), `F(name, t, d)` tone at the
 *   fraction t. At d 1 a tone snaps to the 64-colour `PAL`; at d 2 / 4 it is the HD colour itself.
 *   `mx(a, b, t, d)` mixes in Oklab and snaps over `HD_FULL_PALETTE` (PAL_HD + PAL_HD_OZ; our own
 *   small nearest: the ams / ring `nearestLab` is never changed). `dim(c, k, d)` steps a colour k
 *   tones along its own ramp (either palette).
 * - `outlineC(p)`: static decor outline C (½ logical px: ink on the shadow side, two tones deeper on
 *   the lit side; at 1× a 1 px ink line on the shadow side) over both palettes.
 * - `reg(...)` registers a sprite of n frames drawn by one drawer at d 1, 2 and 4 (lists the id in
 *   `OZ_TOWN_SPRITES`); `regBg(...)` a background generator (`OZ_TOWN_BGS`).
 *
 * Same input, same pixels: no randomness except the hashes callers pass.
 */
import type { Color } from '../../../../engine/color';
import { nearest as nearestPal } from '../../../../engine/palette';
import { HD_FULL_PALETTE, PAL_HD, PAL_HD_OZ, type HdOzRampName, type HdRampName } from '../../../../engine/palette-hd';
import type { Ramp } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite, type SpriteAnchor } from '../../../../engine/sprites';
import { defineBgGenerator } from '../../../art/art-registry';
import { hash2 } from '../../../art/paint';
import { oklab } from '../ams/art-hd-bg-kit';
import { bay, dq, outlineA, Pen, tinyText, tinyWidth, type Dn } from '../../ring/scenery/kit';

export { bay, dq, outlineA, Pen, tinyText, tinyWidth, type Dn };
export const h2 = hash2;

/** A ramp name of either HD palette. */
export type Rn = HdRampName | HdOzRampName;

export function rampOf(n: Rn): Ramp {
  return (n in PAL_HD_OZ ? PAL_HD_OZ[n as HdOzRampName] : PAL_HD[n as HdRampName]) as Ramp;
}

// ------------------------------------------------------------------------------------ colour

const FULL = HD_FULL_PALETTE.map((c) => c >>> 0);
const FULL_LAB = FULL.map((c) => oklab(c));
const FULL_SET = new Set<number>(FULL);
const nearCache = new Map<number, Color>();
const palCache = new Map<number, Color>();

/** The HD_FULL_PALETTE colour nearest to an Oklab point (chroma weighted a little up). */
function nearestFullLab(L: number, a: number, b: number): Color {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < FULL_LAB.length; i++) {
    const p = FULL_LAB[i];
    const dl = p[0] - L;
    const da = p[1] - a;
    const db = p[2] - b;
    const dd = dl * dl + 1.4 * (da * da + db * db);
    if (dd < bd) {
      bd = dd;
      best = i;
    }
  }
  return FULL[best];
}

/** The colour of the palette of d nearest to `c` (PAL at 1; PAL_HD + PAL_HD_OZ at 2 and 4). */
export function snap(c: Color, d: Dn): Color {
  const key = (c | 255) >>> 0;
  if (d === 1) {
    let hit = palCache.get(key);
    if (hit === undefined) {
      hit = nearestPal(key) >>> 0;
      palCache.set(key, hit);
    }
    return hit;
  }
  if (FULL_SET.has(key)) return key;
  let hit = nearCache.get(key);
  if (hit === undefined) {
    const [L, A, B] = oklab(key);
    hit = nearestFullLab(L, A, B);
    nearCache.set(key, hit);
  }
  return hit;
}

/** Tone k (0 = deepest; clamped, rounded) of ramp n at density d (at 1: the nearest PAL colour). */
export function T(n: Rn, k: number, d: Dn): Color {
  const r = rampOf(n);
  const c = r[Math.max(0, Math.min(r.length - 1, Math.round(k)))] >>> 0;
  return d === 1 ? snap(c, 1) : c;
}

/** The tone at fraction t (0 = deepest … 1 = lightest) of ramp n at density d. */
export function F(n: Rn, t: number, d: Dn): Color {
  const r = rampOf(n);
  return T(n, Math.max(0, Math.min(1, t)) * (r.length - 1), d);
}

const mixCache = new Map<string, Color>();

/** a → b in Oklab (t 0 … 1), snapped to the palette of d. */
export function mx(a: Color, b: Color, t: number, d: Dn): Color {
  if (t <= 0) return snap(a, d);
  if (t >= 1) return snap(b, d);
  const key = `${a >>> 0}:${b >>> 0}:${Math.round(t * 1000)}:${d}`;
  let hit = mixCache.get(key);
  if (hit === undefined) {
    const p = oklab(a >>> 0);
    const q = oklab(b >>> 0);
    const hd = nearestFullLab(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t);
    hit = d === 1 ? snap(hd, 1) : hd;
    mixCache.set(key, hit);
  }
  return hit;
}

const homes: Array<readonly Color[]> = [...Object.values(PAL_HD_OZ), ...Object.values(PAL_HD)] as Array<readonly Color[]>;
const dimCache = new Map<number, Color>();

/** `c` moved k tones along its own HD ramp (either palette; + lighter), snapped to the palette of d. */
export function dim(c: Color, k: number, d: Dn): Color {
  const key = ((((c | 255) >>> 0) & 0xffffff00) >>> 0) * 64 + (k + 16) * 2 + (d === 1 ? 1 : 0);
  let hit = dimCache.get(key);
  if (hit !== undefined) return hit;
  const hd = snap(c, 2);
  hit = hd;
  for (const r of homes) {
    const i = r.indexOf(hd);
    if (i >= 0) {
      hit = r[Math.max(0, Math.min(r.length - 1, i + k))] >>> 0;
      break;
    }
  }
  hit = snap(hit, d);
  dimCache.set(key, hit);
  return hit;
}

/** Ink (outline) colours. */
export const INK0 = PAL_HD.ink[0] >>> 0;
export const INK1 = PAL_HD.ink[1] >>> 0;

/**
 * Outline C (static decor, ART_GUIDE "UHD art"): ½ logical px on clear px round the silhouette —
 * ink on the shadow side (right / below), the shape's own colour two tones deeper on the lit side
 * (left / above). At d 1 a 1 px ink line on the shadow side only.
 */
export function outlineC(p: Pen): void {
  const W = p.W;
  const H = p.H;
  const r = Math.max(1, p.d >> 1);
  const ink = snap(INK1, p.d);
  const src = p.px.slice();
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const i = Y * W + X;
      if (src[i] !== 0) continue;
      let shadow = false;
      for (let k = 1; k <= r && !shadow; k++) {
        if ((X - k >= 0 && src[i - k] !== 0) || (Y - k >= 0 && src[i - k * W] !== 0)) shadow = true;
      }
      if (shadow) {
        p.px[i] = ink;
        continue;
      }
      if (p.d === 1) continue;
      let lit: Color = 0;
      for (let k = 1; k <= r && !lit; k++) {
        if (X + k < W && src[i + k] !== 0) lit = src[i + k];
        else if (Y + k < H && src[i + k * W] !== 0) lit = src[i + k * W];
      }
      if (lit) p.px[i] = dim(lit, -2, p.d);
    }
  }
}

// ------------------------------------------------------------------------------------ shapes

/** A round-headed (Romanesque) arch shape: left x, top y of its round head, width w, total height h. */
export function archRound(p: Pen, x: number, y: number, w: number, h: number, c: Color | ((X: number, Y: number) => Color)): void {
  const r = w / 2;
  if (typeof c === 'number') {
    p.disc(x + r, y + r, r, r, c);
    p.rect(x, y + r, w, h - r, c);
  } else {
    p.disc(x + r, y + r, r, r, (X, Y) => c(X, Y));
    p.fill(x, y + r, w, h - r, c);
  }
}

/** A pointed (Gothic, equilateral) arch opening with its apex at (x + w/2, y), total height h. */
export function archPointed(p: Pen, x: number, y: number, w: number, h: number, c: Color | ((X: number, Y: number) => Color)): void {
  const rise = Math.min(w * 0.866, h * 0.7);
  const k = rise / (w * 0.866);
  const ys = y + rise;
  const n = 12;
  const poly: Array<[number, number]> = [[x, y + h], [x, ys]];
  // The left arc turns round the right springer, the right arc round the left one.
  for (let i = 1; i < n; i++) {
    const a = Math.PI - (Math.PI / 3) * (i / n);
    poly.push([x + w + w * Math.cos(a), ys - w * Math.sin(a) * k]);
  }
  poly.push([x + w / 2, y]);
  for (let i = n - 1; i >= 1; i--) {
    const a = (Math.PI / 3) * (i / n);
    poly.push([x + w * Math.cos(a), ys - w * Math.sin(a) * k]);
  }
  poly.push([x + w, ys], [x + w, y + h]);
  p.poly(poly, c);
}

/** A tiny brick texture shader on ramp n: bricks bw × bh logical px, mortar `mortar`, tones by hash. */
export function brickShader(p: Pen, n: Rn, o: { bw?: number; bh?: number; base: number; spread?: number; mortar: Color; seed: number; ox?: number; oy?: number }): (X: number, Y: number) => Color {
  const d = p.d;
  const bw = (o.bw ?? 6) * d;
  const bh = (o.bh ?? 3) * d;
  const ox = (o.ox ?? 0) * d;
  const oy = (o.oy ?? 0) * d;
  const spread = o.spread ?? 1.2;
  return (X: number, Y: number): Color => {
    const yy = Y - oy;
    const row = Math.floor(yy / bh);
    const xx = X - ox + (row & 1 ? bw >> 1 : 0);
    const col = Math.floor(xx / bw);
    const u = xx - col * bw;
    const v = yy - row * bh;
    if (d === 1) {
      if (v === bh - 1 || u === 0) return o.mortar;
      const h = hash2(col, row, o.seed);
      return T(n, o.base + (h - 0.5) * spread, d);
    }
    const jw = d >= 4 ? 1 : 1;
    if (v >= bh - jw || u < jw) return o.mortar;
    const h = hash2(col, row, o.seed);
    let k = o.base + (h - 0.5) * spread;
    if (v === 0) k += 0.6; // the lit top arris
    if (v >= bh - jw - 1 && d >= 4) k -= 0.5;
    if (d >= 4 && hash2(X, Y, o.seed + 7) > 0.93) k -= 0.7; // grain
    return T(n, k, d);
  };
}

// ------------------------------------------------------------------------------------ registration

/** Every sprite id TOWN registers (tests). */
export const OZ_TOWN_SPRITES: string[] = [];
/** Every background generator id TOWN registers (tests). */
export const OZ_TOWN_BGS: string[] = [];

export type Draw = (p: Pen, frame: number) => void;

/** One frame's geometry: logical size and anchor. */
export interface FrameGeom {
  w: number;
  h: number;
  ox: number;
  oy: number;
}

/**
 * Register sprite `id`: frames of the given logical geometry (one per entry), each drawn by
 * `draw(pen, i)` at d 1, 2 and 4 (the dense frames have the 1× geometry by construction).
 */
export function reg(id: string, geoms: readonly FrameGeom[], draw: Draw, o: { defer?: boolean; ticksPerFrame?: number; anchor?: SpriteAnchor } = {}): void {
  const frames = (d: Dn): Frame[] =>
    geoms.map((g, i) => {
      const p = new Pen(g.w, g.h, d);
      draw(p, i);
      return p.frame(g.ox, g.oy);
    });
  defineSprite(id, () => frames(1), { hd: (d) => frames(d), defer: o.defer, ticksPerFrame: o.ticksPerFrame ?? 8 });
  OZ_TOWN_SPRITES.push(id);
}

export type Params = Readonly<Record<string, unknown>>;
export type BgDraw = (p: Pen, params: Params, seed: number) => void;

/** Register background generator `id` (1× and HD from one drawer; the pen wraps in x, so layers tile). */
export function regBg(id: string, draw: BgDraw): void {
  const gen = (w: number, h: number, params: Params, seed: number, d: Dn) => {
    const p = new Pen(w, h, d, true);
    draw(p, params, seed);
    return p.finish();
  };
  defineBgGenerator(id, (w, h, params, seed) => gen(w, h, params, seed, 1), { hd: (w, h, params, seed, d) => gen(w, h, params, seed, d) });
  OZ_TOWN_BGS.push(id);
}

export function num(p: Params, k: string, dflt: number): number {
  const v = p[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : dflt;
}

export function str(p: Params, k: string, dflt: string): string {
  const v = p[k];
  return typeof v === 'string' ? v : dflt;
}

/** The town's light moods (backgrounds): dusk (oz-a), late dusk (oz-b), night (oz-c). */
export type OzLight = 'dusk' | 'late' | 'night';
export function ozLight(p: Params): OzLight {
  const v = p.light;
  return v === 'late' || v === 'night' ? v : 'dusk';
}

// ------------------------------------------------------------------------------------ tables

const ladderCache = new Map<string, Color[]>();

/**
 * A fine colour ladder through `stops` (Oklab, `steps` tones per pair), snapped to the palette of d,
 * without consecutive repeats: index it with a dithered continuous value (`dq`).
 */
export function ladder(stops: readonly Color[], steps: number, d: Dn): readonly Color[] {
  const key = `${stops.map((c) => c >>> 0).join(',')}|${steps}|${d}`;
  let hit = ladderCache.get(key);
  if (!hit) {
    const out: Color[] = [];
    for (let i = 0; i + 1 < stops.length; i++) {
      for (let k = 0; k < steps; k++) {
        const c = mx(stops[i], stops[i + 1], k / steps, d);
        if (out[out.length - 1] !== c) out.push(c);
      }
    }
    const last = snap(stops[stops.length - 1], d);
    if (out[out.length - 1] !== last) out.push(last);
    hit = out;
    ladderCache.set(key, hit);
  }
  return hit;
}

const hazeCache = new Map<string, Color[]>();

/** Every tone of ramp n mixed toward `air` by t (aerial perspective, a cold grade), snapped to d. */
export function tones(n: Rn, d: Dn, air: Color = 0, t = 0): readonly Color[] {
  const key = `${n}|${d}|${air >>> 0}|${Math.round(t * 1000)}`;
  let hit = hazeCache.get(key);
  if (!hit) {
    const r = rampOf(n);
    hit = r.map((c) => (t > 0 ? mx(c >>> 0, air, t, d) : d === 1 ? snap(c >>> 0, 1) : c >>> 0));
    hazeCache.set(key, hit);
  }
  return hit;
}

/** Pick from a tone list by a continuous index (clamped). */
export function pick(list: readonly Color[], v: number): Color {
  const k = Math.floor(v);
  return list[k < 0 ? 0 : k >= list.length ? list.length - 1 : k];
}
