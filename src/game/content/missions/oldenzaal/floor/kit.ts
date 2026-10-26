/**
 * The Oldenzaal floor kit's shared helpers (docs/design/floor.md §2, §5.1; docs/api/floor.md §4):
 * the town's light moods as graded tone ladders, a world-anchored grain and value noise, the
 * joint and bevel widths per density, and the kit's ids. Everything is TEXTURE SPACE (spec §2.2):
 * world (u, v) or a tile's (a, b), never a screen coordinate or the time. Pure; the ladders are
 * built once per (ramp, light, density) by art-kit's caches.
 *
 * The light moods (`OzLight`, art-kit.ts: the backgrounds' own names): 'dusk' (oz-a), 'late'
 * (late dusk, oz-b), 'night' (oz-c). Each is the town's cold grade (art-street.ts `GRADE`: every
 * near material mixed toward the night blue) at its own strength, plus a tone shift (darker
 * later). Wave B adds the church moods next to these (the nave, the crypt).
 */
import type { Color } from '../../../../../engine/color';
import type { FloorDef } from '../../../../mission/floor/types';
import { hash2, noise2 } from '../../../../art/paint';
import { ladder, mx, rampOf, T, tones, type Dn, type OzLight, type Rn } from '../art-kit';

export type { OzLight };

/** Every light mood of the kit (tile and prop ids carry it). */
export const OZ_FLOOR_LIGHTS: readonly OzLight[] = ['dusk', 'late', 'night'];

/** The grade of a mood: the air colour every tone mixes toward, how far, and a tone shift. */
interface Grade {
  air: number;
  t: number;
  shift: number;
}

const GRADES: Record<OzLight, Grade> = {
  dusk: { air: 3, t: 0.22, shift: 0 },
  late: { air: 2, t: 0.3, shift: -0.3 },
  night: { air: 2, t: 0.42, shift: -0.6 },
};

/** The tone shift of a mood (added to every material's tone). */
export function moodShift(light: OzLight): number {
  return GRADES[light].shift;
}

/**
 * The graded tone ladder of ramp n for a mood at density d: the ramp mixed toward the mood's
 * night blue, then a fine ladder (2 steps per ramp tone). Index it with `tone · 2` (`toneAt`).
 */
export function moodTones(n: Rn, light: OzLight, d: Dn): readonly Color[] {
  const g = GRADES[light];
  return ladder(tones(n, d, T('night', g.air, 2), g.t), 2, d);
}

const blends = new Map<string, readonly Color[]>();

/**
 * Ramp `a` blended toward ramp `b` by k, tone by tone (by fraction along each ramp; HD colours,
 * Oklab): the street's bricks lean brown so their darks read as old brick and grime, never as
 * wine red (the level's no-blood rule).
 */
export function blendRamps(a: Rn, b: Rn, k: number): readonly Color[] {
  const key = `${a}|${b}|${k}`;
  let hit = blends.get(key);
  if (!hit) {
    const ra = rampOf(a);
    const rb = rampOf(b);
    hit = ra.map((c, i) => mx(c >>> 0, rb[Math.round((i * (rb.length - 1)) / Math.max(1, ra.length - 1))] >>> 0, k, 2));
    blends.set(key, hit);
  }
  return hit;
}

const gradedLists = new Map<string, readonly Color[]>();

/** The graded tone ladder of an explicit colour list (`blendRamps`) for a mood at density d (as `moodTones`). */
export function moodTonesOf(key: string, colors: readonly Color[], light: OzLight, d: Dn): readonly Color[] {
  const k = `${key}|${light}|${d}`;
  let hit = gradedLists.get(k);
  if (!hit) {
    const g = GRADES[light];
    const air = T('night', g.air, 2);
    hit = ladder(colors.map((c) => mx(c, air, g.t, d)), 2, d);
    gradedLists.set(k, hit);
  }
  return hit;
}

/** The colour of a continuous ramp tone (0 = deepest) on a ladder from `moodTones`. */
export function toneAt(list: readonly Color[], tone: number): Color {
  const k = Math.floor(tone * 2 + 0.5);
  return list[k < 0 ? 0 : k >= list.length ? list.length - 1 : k];
}

/** A density as the kit's art densities (1, 2, 4). */
export function dn(d: number): Dn {
  return d >= 4 ? 4 : d >= 2 ? 2 : 1;
}

/** Joint width in world px: one texel at 1×, half a px at 2× and 4× (the same look at every density). */
export function jointW(d: number): number {
  return d <= 1 ? 1 : 0.5;
}

/** Bevel width in world px (0 at 1×: a 1 px bevel would eat a 4 px brick). */
export function bevelW(d: number): number {
  return d <= 1 ? 0 : 0.5;
}

/** Grain: a world-anchored hash in −0.5 … 0.5 per cell of 1 px (1×) or ½ px (2×, 4×). */
export function grain(u: number, v: number, d: number, seed: number): number {
  const k = d <= 1 ? 1 : 2;
  return hash2(Math.floor(u * k), Math.floor(v * k), seed) - 0.5;
}

/** Smooth value noise 0 … 1 at world (u, v) with feature size `cell` (world px). */
export function vnoise(u: number, v: number, cell: number, seed: number): number {
  return noise2(u, v, cell, seed);
}

export function smooth01(a: number, b: number, x: number): number {
  const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a);
  return t * t * (3 - 2 * t);
}

/**
 * Fail soft (docs/ARCHITECTURE.md §2 rule 7): a section's FloorDef is built (with its tiles and faces)
 * while the section module loads; when that throws, log once and give no floor — the section then
 * draws as one without a floor, and the mission still loads.
 */
export function ozKitFloor(key: string, build: () => FloorDef): FloorDef | undefined {
  try {
    return build();
  } catch (err) {
    console.warn(`[floor] the floor of ${key} failed to build; the section draws without it:`, err);
    return undefined;
  }
}

/** Tile, prop and painter ids of the kit (the mood is part of the id: the textures differ). */
export const OZ_FLOOR_IDS = {
  painter: 'oz/town',
  kerbFace: (l: OzLight) => `oz/${l}/kerb-face`,
  slab: (l: OzLight) => `oz/${l}/slab`,
  bayRoof: (l: OzLight) => `oz/${l}/bay-roof`,
  wallTop: (l: OzLight) => `oz/${l}/wall-top`,
  car: (l: OzLight, frame: number) => `oz/${l}/car/${frame}`,
  carGlass: (l: OzLight) => `oz/${l}/car-glass`,
  awning: (l: OzLight, colour: number, phase: number) => `oz/${l}/awning/${colour}/${phase}`,
  manhole: (l: OzLight) => `oz/${l}/manhole`,
  manholeShaft: (l: OzLight) => `oz/${l}/manhole-shaft`,
  post: (l: OzLight) => `oz/${l}/post`,
} as const;
