/**
 * The façade grammar's colours (docs/design/oat.md §8.5 materials and ramps, §8.3 the light per
 * section, §8.9 the night bake; decision 51). Every strip px is an index of the oat set
 * (`HD_OAT_FULL_PALETTE` = PAL_HD ∪ PAL_HD_OAT, `bgPalette`); the painters pick indices from the
 * material ramps below, the light pass maps indices through tables (sun, shade, night levels and
 * tints) and the resolve looks every index up in the LUT of its density: the set's own colours at
 * 2× / 4×, the nearest 64-colour `PAL` colour at 1× (the `Pen` snap rule).
 *
 * The ramps are hand-picked guide colours (research §4, our own values; no photo pixel) walked in
 * Oklab and snapped to the oat set, so each big material has 6–8 tones (spec §8.5; the art map
 * measured 3–4 on `ams` brick). Mortar is a warm recessed grey, never a cool even grid.
 *
 * Same input, same pixels: built once at module load, no randomness.
 */
import type { Color } from '../../../../../engine/color';
import { hex } from '../../../../../engine/color';
import { PAL, PALETTE } from '../../../../../engine/palette';
import { HD_OAT_FULL_PALETTE, PAL_HD, PAL_HD_OAT } from '../../../../../engine/palette-hd';
import { bgPalette, oklab } from '../../ams/art-hd-bg-kit';
import type { PaintId, Tint, WallId } from './types';

/** The densities a strip is painted at. */
export type Dn = 1 | 2 | 4;

/** The oat colour set (index i + 1 = colour; 0 = clear). */
export const OAT_SET = bgPalette(HD_OAT_FULL_PALETTE);
const N = OAT_SET.colours.length;
const LAB = OAT_SET.colours.map((c) => oklab(c));
/**
 * The two outline inks are reserved for outlines (spec §8.11, decision 38: no ink on façades), so
 * no material, shade or night tone ever resolves to them; the darkest strip tones sit next to them.
 */
const INK = new Set<number>(PAL_HD.ink.map((c) => c >>> 0));
const NOT_INK = OAT_SET.colours.map((c) => !INK.has(c >>> 0));

/** The oat-set index nearest to an Oklab point (chroma weighted a little up: keep hue families; never an ink). */
export function nearestIdx(L: number, a: number, b: number): number {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < N; i++) {
    if (!NOT_INK[i]) continue;
    const p = LAB[i];
    const dl = p[0] - L;
    const da = p[1] - a;
    const db = p[2] - b;
    const dd = dl * dl + 1.4 * (da * da + db * db);
    if (dd < bd) {
      bd = dd;
      best = i;
    }
  }
  return best + 1;
}

/** The oat-set index of a colour (snapped). */
export function ix(c: Color | string): number {
  const v = typeof c === 'string' ? hex(c) : c;
  if (!INK.has(v >>> 0) && OAT_SET.colours.some((k) => k >>> 0 === v >>> 0)) return OAT_SET.ix(v);
  const p = oklab(v);
  return nearestIdx(p[0], p[1], p[2]);
}

/** The Oklab of an index. */
export function labOf(i: number): readonly [number, number, number] {
  return LAB[(i - 1) | 0] ?? [0, 0, 0];
}

/**
 * A ramp of `n` tones along the guide colours (dark → light), walked in Oklab and snapped to the
 * set; consecutive repeats dropped (so it may hold fewer than n).
 */
export function path(guides: readonly string[], n: number): Uint8Array {
  const keys = guides.map((g) => oklab(hex(g)));
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const t = (k / (n - 1)) * (keys.length - 1);
    const s = Math.min(keys.length - 2, Math.floor(t));
    const f = t - s;
    const p = keys[s];
    const q = keys[s + 1];
    const i = nearestIdx(p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, p[2] + (q[2] - p[2]) * f);
    if (out[out.length - 1] !== i) out.push(i);
  }
  return Uint8Array.from(out);
}

/** A ramp of set colours as indices. */
export function rampIdx(r: readonly Color[]): Uint8Array {
  return Uint8Array.from(r.map((c) => ix(c)));
}

/** Tone k of a ramp (clamped, rounded). */
export function tone(r: Uint8Array, k: number): number {
  const n = r.length;
  const i = Math.round(k);
  return r[i < 0 ? 0 : i >= n ? n - 1 : i];
}

/** The index halfway (t) between two indices, in Oklab, snapped. */
export function mixIdx(i: number, j: number, t: number): number {
  const p = labOf(i);
  const q = labOf(j);
  return nearestIdx(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t);
}

// ------------------------------------------------------------------------------------ materials

/**
 * Wall ramps (dark → light, lit by the sun at the light end). Brick walls use the middle and upper
 * tones for the bricks, the joint tone for the warm recessed mortar.
 */
export const WALL: Readonly<Record<WallId, Uint8Array>> = {
  'brick-red': rampIdx(PAL_HD_OAT.brick),
  'brick-orange': path(['#2a1a16', '#523026', '#7a4834', '#94604c', '#aa7660', '#c4927a'], 8),
  'brick-purple': path(['#1c1416', '#2e2224', '#3f2d2f', '#4a3436', '#5a3f40', '#6e5050', '#86685f'], 8),
  'brick-black': path(['#121012', '#1d191b', '#2a2426', '#36302f', '#463c37', '#5a4b41'], 7),
  'brick-yellow': path(['#3a3024', '#5e4e38', '#7e6a4c', '#9a845c', '#b49c6c', '#cbb582'], 7),
  'painted-red': path(['#38181a', '#5a2620', '#76352c', '#923f34', '#ad5544', '#c2705c'], 7),
  'painted-grey': path(['#262423', '#33302e', '#433f3b', '#57514b', '#6a6259', '#857c70'], 7),
  'plaster-cream': path(['#5a5040', '#7e7258', '#a39675', '#c2b48f', '#ddd0ac', '#ece3c8', '#f6f0dc'], 8),
  'plaster-white': path(['#5c5e62', '#7e8084', '#a0a19f', '#bebdb8', '#d6d4ce', '#e8e6e0', '#f4f2ec'], 8),
};

/** Is a wall plastered (no bricks)? Painted brick shows its courses under the paint. */
export function isPlaster(w: WallId): boolean {
  return w === 'plaster-cream' || w === 'plaster-white';
}

/** Mortar and Bentheimer sandstone (copings, sills, cornices of stone, gable edging). */
export const MORTAR = rampIdx(PAL_HD_OAT.mortar);
export const SANDSTONE = path(['#4a443a', '#6e6656', '#8e8570', '#aea58c', '#c9bf9e', '#ddd3b4', '#efe8d2'], 8);
/** White paint (sashes, frames, cornices, shop fronts): a cool shade, a warm sunlit white. */
export const WHITE = rampIdx(PAL_HD.gable);
/** Hardstone (blue stone): plinths, stoep steps, door steps, sills of the 19th century. */
export const HARDSTONE = path(['#24282c', '#33383d', '#41474d', '#50565c', '#5e646a', '#727880', '#8e949a'], 7);
/** Window glass (dark; the sky and the opposite row reflect toward the light end). */
export const GLASS = rampIdx(PAL_HD.glass);
/** Net curtains behind the glass (cloth, a little warm). */
export const CURTAIN = path(['#6e6a66', '#8e8a84', '#b0aca4', '#cfcbc2', '#e6e2d8'], 5);
/** The warm interior of a shop (shelves, goods, a lamp). */
export const INTERIOR = path(['#1a1210', '#2e2018', '#4a3422', '#6e4e30', '#9a7444', '#c49c5c', '#e8c27a'], 7);
/** Roof slate / zinc and red pan tiles. */
export const SLATE = path(['#1a1d24', '#262a33', '#343944', '#454b57', '#596070', '#717a88'], 6);
export const PANTILE = path(['#3a1e18', '#5e3226', '#7e4332', '#984f3c', '#ad6249', '#c27a5c'], 6);
/** Zinc of downpipes and gutters. */
export const ZINC = path(['#2a2e34', '#3e444c', '#565e68', '#717a84', '#8e96a0'], 5);
/** Black iron (anchors, railings' cast iron in black, the hoist hook). */
export const IRON = path(['#141214', '#1c1a1d', '#2a272b', '#3d393d', '#57524f'], 5);
/** Rust (streaks under anchors and railings, sheet iron). */
export const RUST = path(['#3a2016', '#5a3020', '#7a4a2a', '#9a6238'], 4);
/** Plants (flower boxes, door plants): leaves and flowers. */
export const LEAF = path(['#14200f', '#22331a', '#344a24', '#4e6430', '#6a7e3c'], 5);
export const FLOWER = path(['#6a1626', '#9a2234', '#c43a44', '#e2686a'], 4);

/** Paint ramps (doors, sashes, shutters, railings; research S13). */
export const PAINT: Readonly<Record<PaintId, Uint8Array>> = {
  green: path(['#0e1512', '#121a17', '#1e2a26', '#2f3d36', '#3f5a4a', '#5a7864'], 6),
  black: path(['#0e0d10', '#17161a', '#222127', '#323138', '#4a4950', '#66656c'], 6),
  oxblood: path(['#25100f', '#3a1a1c', '#5a2a2c', '#7a3a3a', '#94504a'], 5),
  white: WHITE,
  red: path(['#3a1410', '#5e1e17', '#8b2e22', '#a8452f', '#c46a50'], 5),
  wood: path(['#2a1810', '#4a2c1a', '#6a4426', '#8a5e34', '#a87a48'], 5),
};

/** Awning cloths: stripes on white, or plain. */
export const AWNING: readonly Uint8Array[] = [
  path(['#0f2a22', '#1a4636', '#2a6a50', '#3e8a68'], 4), // green
  path(['#3a0f14', '#6a1a1e', '#9a2a28', '#be4a3e'], 4), // red
  path(['#1a2440', '#2a3a64', '#3e5288', '#5a70a8'], 4), // navy
  path(['#2a2a2a', '#3e3e40', '#58585c', '#76767a'], 4), // grey
  path(['#3a2a0e', '#6a4c18', '#9a7024', '#c49434'], 4), // ochre
];

/** Night emitters. */
export const LANTERN = rampIdx(PAL_HD_OAT.lantern);
export const RED_LIGHT = rampIdx(PAL_HD_OAT.redLight);
export const NEON_PINK = rampIdx(PAL_HD_OAT.neonPink);
export const NEON_CYAN = rampIdx(PAL_HD_OAT.neonCyan);
/** A lit window at night (warm interior through a curtain). */
export const LIT_WINDOW = path(['#5a3418', '#8a5424', '#c08038', '#e8b060', '#f8d898'], 5);
/** The red curtain of a window frame (closed; architecture only). */
export const RED_CURTAIN = path(['#1e0608', '#3a0a10', '#5a1018', '#7a1a22'], 4);

/** The warm recessed joint of a wall: between the wall's dark tone and the mortar, in shade. */
export function jointOf(wall: Uint8Array): number {
  return mixIdx(tone(wall, 1), MORTAR[0], 0.42);
}

// ------------------------------------------------------------------------------------ light tables

/**
 * Mask values (one byte per art px; the light pass writes them, the resolve maps the px's index
 * through `TABLES[mask]`): day 0 SHADE, 1 LIT, 2 DEEP (an occluded corner), 3 EMIT (an emitter: no
 * change); night 8 + tint · 8 + level (level 0 … 5, tint 0 none, 1 warm, 2 red, 3 pink, 4 cyan).
 */
export const M_SHADE = 0;
export const M_LIT = 1;
export const M_DEEP = 2;
export const M_EMIT = 3;
export const M_NIGHT = 8;
export const NIGHT_LEVELS = 6;
export const TINTS: readonly (Tint | 'none')[] = ['none', 'warm', 'red', 'pink', 'cyan'];

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** An index table (256) mapping every set index through an Oklab transform. */
function table(fn: (L: number, a: number, b: number) => readonly [number, number, number]): Uint8Array {
  const o = new Uint8Array(256);
  for (let i = 1; i <= N; i++) {
    const p = LAB[i - 1];
    const q = fn(p[0], p[1], p[2]);
    o[i] = nearestIdx(q[0], q[1], q[2]);
  }
  return o;
}

const IDENTITY = (() => {
  const o = new Uint8Array(256);
  for (let i = 0; i < 256; i++) o[i] = i;
  return o;
})();

const tableCache = new Map<string, Uint8Array[]>();

/**
 * Wear tables (spec §8.10 "Façade wear"): GRIME darkens and browns (damp feet, soot under cornices,
 * dirt streaks), BLEACH lightens and greys (salt bloom), FRESH warms a little (patched brick), DIM
 * one step darker (a recessed joint, a closed curtain's fold).
 */
export const GRIME = table((L, a, b) => [L * 0.8 - 0.01, a * 0.85 + 0.004, b * 0.9 + 0.01]);
export const BLEACH = table((L, a, b) => [L * 0.9 + 0.09, a * 0.5, b * 0.5 + 0.004]);
export const FRESH = table((L, a, b) => [L * 1.04 + 0.01, a * 1.1 + 0.01, b * 1.08 + 0.008]);
export const DIM = table((L, a, b) => [L * 0.88, a, b]);

/**
 * The light tables of a day section with a sun of colour `sun` (a guide colour; spec §8.3 Kelvin
 * column): LIT warms the lit highlights toward the sun's hue (the lit brick at c is clearly warmer
 * than at b), SHADE is about two tones darker and cooler (the sky's blue fill, ≈ #bfd3ff as a
 * guide), DEEP darker still (soffits, reveal corners).
 */
export function dayTables(sun: Color): Uint8Array[] {
  const key = `day:${sun >>> 0}`;
  const hit = tableCache.get(key);
  if (hit) return hit;
  const s = oklab(sun);
  const t: Uint8Array[] = [];
  t[M_SHADE] = table((L, a, b) => [L * 0.78 - 0.012, a * 0.78 - 0.005, b * 0.66 - 0.03]);
  t[M_LIT] = table((L, a, b) => {
    const hi = smoothstep(0.25, 0.85, L);
    return [Math.min(0.97, L * 1.07 + 0.02), a + s[1] * (0.25 + 0.3 * hi), b + s[2] * (0.3 + 0.35 * hi)];
  });
  t[M_DEEP] = table((L, a, b) => [L * 0.56 - 0.01, a * 0.7 - 0.004, b * 0.6 - 0.025]);
  t[M_EMIT] = IDENTITY;
  tableCache.set(key, t);
  return t;
}

/** The tint targets of the night bake (Oklab a, b) and how much of the tint a lit px takes. */
function tintAB(c: string, share: number): readonly [number, number, number] {
  const p = oklab(hex(c));
  return [p[1], p[2], share];
}
const TINT_AB: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  tintAB('#ffa757', 0.55),
  tintAB('#e0141e', 0.7),
  tintAB('#ff3fa0', 0.6),
  tintAB('#2fb6ff', 0.6),
];
/** Lightness factor per night level (0 = the dark street, 5 = right under a lamp). */
const LEVEL_L = [0.2, 0.3, 0.42, 0.56, 0.72, 0.9];

/**
 * The night tables (spec §8.9 "baked static light"): level 0 is the navy night (cool, very dark),
 * each level up is lighter and takes more of its light's tint, so brick near a lantern shows in
 * its own warm lit ramp and plaster near a sign takes the neon's hue.
 */
export function nightTables(): Uint8Array[] {
  const key = 'night';
  const hit = tableCache.get(key);
  if (hit) return hit;
  const t: Uint8Array[] = [];
  t[M_SHADE] = IDENTITY;
  t[M_LIT] = IDENTITY;
  t[M_DEEP] = IDENTITY;
  t[M_EMIT] = IDENTITY;
  for (let ti = 0; ti < TINTS.length; ti++) {
    for (let lv = 0; lv < NIGHT_LEVELS; lv++) {
      const f = LEVEL_L[lv];
      const [ta, tb, share] = TINT_AB[ti];
      const k = ti === 0 ? 0 : share * (0.35 + 0.65 * (lv / (NIGHT_LEVELS - 1)));
      const cool = ti === 0 ? 1 - lv / (NIGHT_LEVELS - 1) : 0.4 * (1 - lv / (NIGHT_LEVELS - 1));
      t[M_NIGHT + ti * 8 + lv] = table((L, a, b) => [
        L * f,
        a * (1 - k) * 0.7 + ta * k * (0.4 + L),
        b * (1 - k) * 0.6 + tb * k * (0.4 + L) - 0.045 * cool,
      ]);
    }
  }
  tableCache.set(key, t);
  return t;
}

/** The colour LUT of density d: the set's colours at 2× / 4×, the nearest `PAL` colour at 1×. */
export function lutOf(d: Dn): Uint32Array {
  if (d !== 1) return OAT_SET.lut;
  return LUT1;
}

const LUT1 = (() => {
  // The nearest 64-colour PAL colour that is not an outline ink (redmean distance, as `nearest`).
  const pal = PALETTE.filter((c) => !INK.has(c >>> 0) && !PAL.ink.some((k) => k >>> 0 === c >>> 0));
  const o = new Uint32Array(256);
  for (let i = 1; i <= N; i++) {
    const c = OAT_SET.lut[i];
    const r = (c >>> 24) & 255;
    const g = (c >>> 16) & 255;
    const b = (c >>> 8) & 255;
    let best = pal[0];
    let bd = Infinity;
    for (const p of pal) {
      const pr = (p >>> 24) & 255;
      const pg = (p >>> 16) & 255;
      const pb = (p >>> 8) & 255;
      const rm = (pr + r) / 2;
      const dd = (2 + rm / 256) * (pr - r) ** 2 + 4 * (pg - g) ** 2 + (2 + (255 - rm) / 256) * (pb - b) ** 2;
      if (dd < bd) {
        bd = dd;
        best = p;
      }
    }
    o[i] = (best | 255) >>> 0;
  }
  return o;
})();
