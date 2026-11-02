/**
 * The street kit of mission `oat` (STREET-A, wave A; docs/design/oat.md §8.5, §8.7, §8.11;
 * docs/ART_GUIDE.md "UHD art"): ONE drawer per sprite or layer for its 1×, 2× and 4× art, over the
 * oat colour set (PAL_HD ∪ PAL_HD_OAT).
 *
 * - `Pen` (the ring's scenery kit): a w × h LOGICAL px canvas at density d ∈ {1, 2, 4}; logical
 *   calls round to the art grid, so every density has the same geometry.
 * - Colours by ramp NAME: a PAL_HD ramp (`'stone'`, `'brick'` …) or an oat ramp with the `oat.`
 *   prefix (`'oat.brick'`, `'oat.canal'`, `'oat.green'` … the two sets share some names). `T(n, k,
 *   d)` is tone k (0 = deepest), `F(n, t, d)` the tone at fraction t. `mx(a, b, t, d)` mixes in
 *   Oklab and snaps over the oat set (our own nearest: the ams / ring / oldenzaal ones are never
 *   changed). `dim(c, k, d)` steps a colour k tones along its own ramp. At d 1 every colour snaps to
 *   the 64-colour `PAL` (the `Pen` snap rule: the 1× is the automatic snapped version, spec §0 #56).
 * - The light (spec §8.3, decision 37): the sun stays LEFT and in front, so a static prop is lit on
 *   its left and top faces and shaded on its right; its cast shadow falls right and back (the floor
 *   bakes it, floor/painter.ts). Static props have NO ink outline (decision 38); what can be shot
 *   keeps outline A (decision 60): `outlineA`.
 * - `reg` registers a sprite of n frames (its id in `OAT_STREET_SPRITES`), `regBg` a background
 *   generator (`OAT_STREET_BGS`); both draw every density with the one drawer.
 *
 * Same input, same pixels: no randomness except the hashes callers pass.
 */
import type { Color } from '../../../../../engine/color';
import { nearest as nearestPal } from '../../../../../engine/palette';
import { HD_OAT_FULL_PALETTE, PAL_HD, PAL_HD_OAT, type HdOatRampName, type HdRampName } from '../../../../../engine/palette-hd';
import type { Ramp } from '../../../../../engine/pixel';
import type { Frame } from '../../../../../engine/render';
import { defineSprite, type SpriteAnchor } from '../../../../../engine/sprites';
import { defineBgGenerator } from '../../../../art/art-registry';
import { hash2 } from '../../../../art/paint';
import { oklab } from '../../ams/art-hd-bg-kit';
import { bay, dq, outlineA, Pen, tinyText, tinyWidth, type Dn } from '../../../ring/scenery/kit';

export { bay, dq, outlineA, Pen, tinyText, tinyWidth, type Dn };
export const h2 = hash2;

/** A ramp name: a PAL_HD ramp, or an oat ramp with the `oat.` prefix. */
export type Rn = HdRampName | `oat.${HdOatRampName}`;

export function rampOf(n: Rn): Ramp {
  return (n.startsWith('oat.') ? PAL_HD_OAT[n.slice(4) as HdOatRampName] : PAL_HD[n as HdRampName]) as Ramp;
}

// ------------------------------------------------------------------------------------ colour

const FULL = HD_OAT_FULL_PALETTE.map((c) => c >>> 0);
const FULL_LAB = FULL.map((c) => oklab(c));
const FULL_SET = new Set<number>(FULL);
const nearCache = new Map<number, Color>();
const palCache = new Map<number, Color>();

function nearestOatLab(L: number, a: number, b: number): Color {
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

/** The colour of the palette of d nearest to `c` (PAL at 1; the oat set at 2 and 4). */
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
    hit = nearestOatLab(L, A, B);
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
    const hd = nearestOatLab(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t);
    hit = d === 1 ? snap(hd, 1) : hd;
    mixCache.set(key, hit);
  }
  return hit;
}

const homes: Array<readonly Color[]> = [...Object.values(PAL_HD_OAT), ...Object.values(PAL_HD)] as Array<readonly Color[]>;
const dimCache = new Map<string, Color>();

/** `c` moved k tones along its own ramp (the oat ramps first; + lighter), snapped to the palette of d. */
export function dim(c: Color, k: number, d: Dn): Color {
  const key = `${c >>> 0}:${k}:${d}`;
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

const ladderCache = new Map<string, readonly Color[]>();

/**
 * A fine colour ladder through `stops` (Oklab, `steps` tones per pair), snapped to the palette of d,
 * without consecutive repeats: index it with a continuous value (`pick`), dithered in world space at
 * band borders only.
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

/** Pick from a tone list by a continuous index (clamped). */
export function pick(list: readonly Color[], v: number): Color {
  const k = Math.floor(v);
  return list[k < 0 ? 0 : k >= list.length ? list.length - 1 : k];
}

/** The haze of a late-September morning over the old city (far things mix toward it; spec §8.7 a 2). */
export const HAZE_MORNING: Color = 0xc9d3dcff;
/** The night air over the Wallen (far things sink toward it; spec §8.7 d 1). */
export const HAZE_NIGHT: Color = 0x18214aff;

// ------------------------------------------------------------------------------------ shapes

/**
 * A lit box face-on, NO outline (static decor): the front in tone `mid` of ramp n, a lit left strip
 * and top edge (the sun is left, decision 37), a shaded right strip and a darker foot.
 */
export function box(p: Pen, x: number, y: number, w: number, h: number, n: Rn, mid: number): void {
  const d = p.d;
  const e = d === 1 ? 1 : Math.max(1 / d, Math.min(1, w / 8));
  p.rect(x, y, w, h, T(n, mid, d));
  p.rect(x, y, e, h, T(n, mid + 1, d));
  p.rect(x, y, w, d === 1 ? 1 : 1 / d, T(n, mid + 2, d));
  p.rect(x + w - e, y, e, h, T(n, mid - 1, d));
  if (h > 3) p.rect(x, y + h - (d === 1 ? 1 : 0.5), w, d === 1 ? 1 : 0.5, T(n, mid - 1, d));
}

/** A round post (lit left, shaded right) from (x, y0) down to y1, w logical px wide, on ramp n. */
export function post(p: Pen, x: number, y0: number, y1: number, w: number, n: Rn, mid: number): void {
  const d = p.d;
  p.rect(x, y0, w, y1 - y0, T(n, mid, d));
  if (d === 1) {
    if (w >= 2) p.rect(x, y0, 1, y1 - y0, T(n, mid + 1, d));
    return;
  }
  const W = Math.round(w * d);
  for (let i = 0; i < W; i++) {
    const t = (i + 0.5) / W;
    const k = t < 0.28 ? mid + 1.4 : t < 0.5 ? mid + 0.6 : t > 0.82 ? mid - 1 : mid;
    p.rect(x + i / d, y0, 1 / d, y1 - y0, T(n, k, d));
  }
}

/** A filled disc in one colour (logical). */
export function blob(p: Pen, cx: number, cy: number, rx: number, ry: number, c: Color): void {
  p.disc(cx, cy, rx, ry, c);
}

/**
 * Text in our 3 × 5 capitals at `scale` logical px per glyph px. Below a whole logical px a glyph
 * px only exists at d ≥ 2 (at d 1 the caller draws a plain stroke instead: `textBar`).
 */
export function text(p: Pen, s: string, x: number, y: number, c: Color, scale = 1): number {
  return tinyText(p, s, x, y, c, { scale });
}

/** The width of `s` at `scale` (logical px). */
export function textW(s: string, scale = 1): number {
  return tinyWidth(s) * scale;
}

// ------------------------------------------------------------------------------------ registration

/** Every sprite id STREET-A registers (tests). */
export const OAT_STREET_SPRITES: string[] = [];
/** Every background generator id STREET-A registers (tests). */
export const OAT_STREET_BGS: string[] = [];
/** The sprite ids that can be shot (they carry outline A; the rest have none, spec §8.11). */
export const OAT_STREET_HITTABLE = new Set<string>();

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
 * `hittable`: the sprite gets outline A (and is listed in `OAT_STREET_HITTABLE`).
 */
export function reg(id: string, geoms: readonly FrameGeom[], draw: Draw, o: { defer?: boolean; ticksPerFrame?: number; anchor?: SpriteAnchor; hittable?: boolean } = {}): void {
  const frames = (d: Dn): Frame[] =>
    geoms.map((g, i) => {
      const p = new Pen(g.w, g.h, d);
      draw(p, i);
      if (o.hittable) outlineA(p);
      return p.frame(g.ox, g.oy);
    });
  defineSprite(id, () => frames(1), { hd: (d) => frames(d as Dn), defer: o.defer, ticksPerFrame: o.ticksPerFrame ?? 8 });
  OAT_STREET_SPRITES.push(id);
  if (o.hittable) OAT_STREET_HITTABLE.add(id);
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
  OAT_STREET_BGS.push(id);
}

export function num(p: Params, k: string, dflt: number): number {
  const v = p[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : dflt;
}

export function str(p: Params, k: string, dflt: string): string {
  const v = p[k];
  return typeof v === 'string' ? v : dflt;
}

/** A deterministic 32-bit mix of integers (per-item seeds). */
export function mixSeed(a: number, b: number, c = 0): number {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b) ^ Math.imul(c | 0, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/** The terrain's bridge hump (engine/terrain.ts `hill`, 8 steps): its height at t ∈ [0, 1] of the span. */
export function humpAt(t: number, height: number): number {
  if (t <= 0 || t >= 1) return 0;
  const n = 8;
  const i = Math.min(n - 1, Math.floor(t * n));
  const a = (height * (1 - Math.cos((i / n) * Math.PI * 2))) / 2;
  const b = i + 1 === n ? 0 : (height * (1 - Math.cos(((i + 1) / n) * Math.PI * 2))) / 2;
  const ar = Math.round(a * 100) / 100;
  const br = Math.round(b * 100) / 100;
  return ar + (br - ar) * (t * n - i);
}
