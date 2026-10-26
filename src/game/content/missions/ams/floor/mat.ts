/**
 * The Amsterdam floor materials (docs/design/floor.md §4.1, §2): pure texel functions of world
 * (u, v) — red asphalt with polished tyre lanes, white road paint, pavement tiles, granite kerbs
 * and the quay coping, kinderkopjes (domed cobbles) in courses and in the fan pattern of a square,
 * klinkers (bricks, stretcher bond) — and the light of the section's time of day.
 *
 * Every detail lives in world space (spec §2.2): the ordered dither runs on the texel grid of the
 * world (`X = ⌊u·d⌋`, `Y = ⌊v·d⌋`), so the texture stays still on the floor while the camera moves;
 * the store box-filters the far rows (no screen dither, no mip work here). Fine joints are kept at
 * least one texel wide and low in contrast (far rows must not shimmer). Hashes only, no allocation.
 */
import type { Color } from '../../../../../engine/color';
import { PAL_HD } from '../../../../../engine/palette-hd';
import type { Ramp } from '../../../../../engine/pixel';
import { hash2 } from '../../../../art/paint';
import type { Light } from '../art';

export const STONE = PAL_HD.stone;
export const SLATE = PAL_HD.slate;
export const BRICK = PAL_HD.brick;
export const BRICK_DARK = PAL_HD.brickDark;
export const SNOW = PAL_HD.snow;
export const SAND = PAL_HD.sand;
export const STEEL = PAL_HD.steel;

/** 4 × 4 Bayer thresholds, centred on 0 (−0.47 … 0.47). */
const BAYER = new Float64Array([0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((m) => (m + 0.5) / 16 - 0.5));

/** The colour of a continuous tone t on ramp r: ordered dither on the world texel (X, Y). */
export function dt(r: Ramp, t: number, X: number, Y: number): Color {
  let k = Math.floor(t + 0.5 + BAYER[((Y & 3) << 2) | (X & 3)]);
  if (k < 0) k = 0;
  else if (k >= r.length) k = r.length - 1;
  return r[k] >>> 0;
}

/** A flat band colour (no dither): ramp index ⌊t + ½⌋ clamped. */
export function band(r: Ramp, t: number): Color {
  let k = Math.floor(t + 0.5);
  if (k < 0) k = 0;
  else if (k >= r.length) k = r.length - 1;
  return r[k] >>> 0;
}

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

export function mod(a: number, n: number): number {
  const r = a % n;
  return r < 0 ? r + n : r;
}

// ------------------------------------------------------------------------------- light

/** The time-of-day light of a floor (spec §4.1): a tone lift and a tint mixed over every texel. */
export interface FloorLight {
  /** Ramp tone added everywhere. */
  readonly tone: number;
  /** Tint colour and its weight (0 = none). */
  readonly tint: Color;
  readonly k: number;
}

const LIGHTS: Readonly<Record<Light, FloorLight>> = {
  morning: { tone: 0.15, tint: 0xfff4e6ff, k: 0 },
  noon: { tone: 0.3, tint: 0xffffffff, k: 0 },
  golden: { tone: -0.05, tint: PAL_HD.gold[5], k: 0.14 },
  sunset: { tone: -0.35, tint: PAL_HD.orange[3], k: 0.18 },
};

export function floorLight(l: unknown): FloorLight {
  return typeof l === 'string' && l in LIGHTS ? LIGHTS[l as Light] : LIGHTS.morning;
}

/** Mix colour c toward t by k (opaque). */
export function mix(c: Color, t: Color, k: number): Color {
  if (k <= 0) return c >>> 0;
  const r = c >>> 24;
  const g = (c >>> 16) & 255;
  const b = (c >>> 8) & 255;
  const R = r + ((t >>> 24) - r) * k;
  const G = g + (((t >>> 16) & 255) - g) * k;
  const B = b + (((t >>> 8) & 255) - b) * k;
  return (((R + 0.5) << 24) | ((G + 0.5) << 16) | ((B + 0.5) << 8) | 255) >>> 0;
}

/**
 * The light over the floor's depth (spec §4.1 "darker far rows"): a tone offset for the kits' depth
 * D (screen px behind the walk line): −0.55 at the back edge (30) easing to 0 by depth 8, and a
 * slight darkening of the bottom rows (in front of depth −28).
 */
export function depthLight(depth: number): number {
  return -0.55 * smoothstep(8, 30, depth) - 0.3 * smoothstep(-28, -40, depth);
}

// ------------------------------------------------------------------------------- materials

/** Red asphalt (the fietspad): fine aggregate, a soft mottle; `polish` lifts the tyre lanes. */
export function asphalt(u: number, v: number, X: number, Y: number, lit: number, polish: number): Color {
  const g = hash2(X, Y, 72);
  let t = 2.55 + lit + polish;
  t += (hash2(Math.floor(u / 5), Math.floor(v / 3), 73) - 0.5) * 0.35;
  if (g > 0.95) t += 1;
  else if (g < 0.05) t -= 0.9;
  return dt(BRICK, t, X, Y);
}

/** White road paint, worn a little (the asphalt shows through in specks). */
export function paint(u: number, v: number, X: number, Y: number, lit: number): Color {
  if (hash2(X, Y, 81) < 0.06) return asphalt(u, v, X, Y, lit, 0);
  return dt(SNOW, 4.75 + lit * 0.5 + (hash2(X >> 1, Y >> 1, 82) - 0.5) * 0.4, X, Y);
}

/**
 * Grey pavement tiles (stoeptegels) T world px square with a joint `jw` px wide (at least one
 * texel): a lit far edge, a shaded near edge, a stained tile now and then.
 */
export function tiles(u: number, v: number, X: number, Y: number, lit: number, d: number, seed: number, T = 6): Color {
  const iu = Math.floor(u / T);
  const iv = Math.floor(v / T);
  const lu = u - iu * T;
  const lv = v - iv * T;
  const jw = Math.max(0.55, 1 / d);
  if (lu < jw || lv < jw) return dt(STONE, 2.7 + lit * 0.6, X, Y);
  const h = hash2(iu, iv, seed);
  let t = 4.55 + lit + (h - 0.5) * 0.7;
  if (h < 0.06) t -= 0.7;
  if (lv < jw + 0.7) t += 0.45;
  else if (lv > T - 0.7) t -= 0.35;
  t += (hash2(X >> 1, Y >> 1, seed + 3) - 0.5) * 0.35;
  return dt(STONE, t, X, Y);
}

/**
 * Granite blocks along u (the quay coping, kerb tops, the crossing's band): block joints every L
 * px, a speckle, `edge` 0…1 across the band (0 = the lit arris, 1 = the shaded far side).
 */
export function granite(u: number, X: number, Y: number, lit: number, edge: number, seed: number, L = 26): Color {
  const b = Math.floor(u / L);
  const lu = u - b * L;
  if (lu < 0.7) return dt(STONE, 2.6 + lit * 0.5, X, Y);
  let t = 5.1 + lit + (hash2(b, 7, seed) - 0.5) * 0.6;
  if (edge < 0.18) t += 0.9;
  else if (edge > 0.85) t -= 0.8;
  t += (hash2(X, Y, seed + 3) - 0.5) * 0.8;
  return dt(STONE, t, X, Y);
}

/** The dark sandy joint between cobbles and bricks. */
export function jointSand(X: number, Y: number, lit: number): Color {
  return dt(SAND, 1.3 + lit * 0.4 + (hash2(X, Y, 91) - 0.5) * 0.6, X, Y);
}

/** One domed stone: (x, y) in −1…1 across it, the stone's hash h, its ramp and base tone. */
function dome(r: Ramp, base: number, x: number, y: number, h: number, X: number, Y: number, lit: number): Color {
  let t = base + lit + (h - 0.5) * 0.7;
  // Lit from the upper left (far, −v is "up" on the floor): the far-left shoulder is brighter.
  t += (-x * 0.4 - y * 0.55) * 0.85;
  t -= (x * x + y * y) * 0.3;
  t += (hash2(X, Y, 95) - 0.5) * 0.45;
  return dt(r, t, X, Y);
}

/** Kinderkopje ramps: mostly warm grey granite, some blue-grey basalt (calm: the pattern must read, not the colours). */
function cobbleRamp(h: number): Ramp {
  return h < 0.72 ? STONE : SLATE;
}

function cobbleBase(h: number): number {
  return h < 0.72 ? 3.6 + (h < 0.12 ? -0.5 : 0) : 4.1;
}

/**
 * Kinderkopjes in courses along the street (spec §4.1 "the cobblestone street"): rows Dc px deep
 * (v), stones about Lc px long (u) with a jittered length and a staggered start per course; each a
 * rounded, domed stone with a dark sand gap (≥ one texel).
 */
export function cobbles(u: number, v: number, X: number, Y: number, lit: number, d: number): Color {
  const Dc = 4.4;
  const Lc = 5.6;
  const r = Math.floor(v / Dc);
  const lv = v - r * Dc;
  const uu = u + hash2(r, 1, 31) * Lc;
  const k = Math.floor(uu / Lc);
  // The stone's ends jitter by up to ±0.8 px (shared with the neighbour: the joint moves, no overlap).
  const j0 = (hash2(k, r, 32) - 0.5) * 1.6;
  const j1 = (hash2(k + 1, r, 32) - 0.5) * 1.6;
  const a = k * Lc + j0;
  const b = (k + 1) * Lc + j1;
  let s0 = a;
  let s1 = b;
  let idx = k;
  if (uu < a) {
    s0 = (k - 1) * Lc + (hash2(k - 1, r, 32) - 0.5) * 1.6;
    s1 = a;
    idx = k - 1;
  } else if (uu >= b) {
    s0 = b;
    s1 = (k + 2) * Lc + (hash2(k + 2, r, 32) - 0.5) * 1.6;
    idx = k + 1;
  }
  const gap = Math.max(0.5, 1 / d) * 0.5;
  const w = (s1 - s0) * 0.5 - gap;
  const hgt = Dc * 0.5 - gap;
  const x = (uu - (s0 + s1) * 0.5) / w;
  const y = (lv - Dc * 0.5) / hgt;
  // A rounded square (superellipse, p 4): outside it is the gap.
  const x2 = x * x;
  const y2 = y * y;
  if (x2 * x2 + y2 * y2 > 1) return jointSand(X, Y, lit);
  const h = hash2(idx, r, 33);
  return dome(cobbleRamp(h), cobbleBase(h), x, y, h, X, Y, lit);
}

/** Fan (waaierverband) geometry of the square: scale radius, column width and row step (world px). */
const FAN_R = 20;
const FAN_W = 32;
const FAN_H = 12;
/** Sett size along the arcs (u-ish) and ring depth (radial). */
const FAN_SETT = 4.2;
const FAN_RING = 3.6;

/**
 * Kinderkopjes in the fan pattern of a square (spec §4.4 "the Pleintje: cobbles in a fan
 * pattern"): fish-scale fans of concentric arcs, opening toward the viewer; the nearest row of fans
 * whose centre lies at or in front of the point owns it when within the radius.
 */
export function fan(u: number, v: number, X: number, Y: number, lit: number, d: number): Color {
  let j = Math.ceil(v / FAN_H);
  for (let n = 0; n < 3; n++, j++) {
    const off = (j & 1) * FAN_W * 0.5;
    const i = Math.round((u - off) / FAN_W);
    const cu = i * FAN_W + off;
    const cv = j * FAN_H;
    const du = u - cu;
    const dv = cv - v;
    const r = Math.sqrt(du * du + dv * dv);
    if (r >= FAN_R) continue;
    const gap = Math.max(0.45, 1 / d) * 0.5;
    // The rim course of the fan (a border of lighter stones) and the rings inside it.
    const ring = Math.floor(r / FAN_RING);
    const lr = r - ring * FAN_RING;
    if (lr < gap || lr > FAN_RING - gap) return jointSand(X, Y, lit);
    const rm = (ring + 0.5) * FAN_RING;
    // The stones along this ring (arc length from the fan's axis, a jittered start per ring).
    const a = (Math.atan2(du, dv) * rm) / FAN_SETT + hash2(ring, i * 7 + j, 41);
    const sk = Math.floor(a);
    const la = a - sk;
    const ga = gap / FAN_SETT;
    if (la < ga || la > 1 - ga) return jointSand(X, Y, lit);
    const h = hash2(sk * 31 + ring, i * 131 + j, 43);
    const x = (la - 0.5) * 2;
    const y = (lr / FAN_RING - 0.5) * 2;
    if (r > FAN_R - FAN_RING) return dome(STONE, 4.7, x, -y, h, X, Y, lit);
    return dome(cobbleRamp(h), cobbleBase(h) - 0.2, x, -y, h, X, Y, lit);
  }
  return jointSand(X, Y, lit);
}

/**
 * Klinkers (red-brown bricks) in stretcher bond along u: the bridge decks (spec §4.1). Rows Db px
 * deep, bricks Lb px long, half-brick offset per row, a low dome, a sand joint.
 */
export function klinkers(u: number, v: number, X: number, Y: number, lit: number, d: number): Color {
  const Db = 4.4;
  const Lb = 9.2;
  const r = Math.floor(v / Db);
  const lv = v - r * Db;
  const uu = u + (r & 1) * Lb * 0.5;
  const b = Math.floor(uu / Lb);
  const lu = uu - b * Lb;
  const jw = Math.max(0.5, 1 / d);
  if (lu < jw || lv < jw * 0.9) return jointSand(X, Y, lit);
  const h = hash2(b, r, 51);
  const ramp = h < 0.45 ? BRICK : BRICK_DARK;
  let t = (h < 0.45 ? 2.7 : 3.8) + lit + (hash2(b, r, 52) - 0.5) * 0.7;
  const x = (lu - Lb / 2) / (Lb / 2);
  const y = (lv - Db / 2) / (Db / 2);
  t += (-x * 0.25 - y * 0.55) * 0.7;
  t += (hash2(X, Y, 53) - 0.5) * 0.5;
  return dt(ramp, t, X, Y);
}
