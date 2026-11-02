/**
 * THE WATER of mission `oat` (docs/design/oat.md §8.8, decision 54; art map lever L5; docs/api/oat.md
 * "LIGHT-WATER"). Owner: LIGHT-WATER. The floor's water tiles and the baked reflection strips; the
 * dynamic reflections are mission/floor/reflect.ts and the night streaks the light pass's.
 *
 * - THE BODY: olive-brown and opaque by day (`PAL_HD_OAT.canal`, never teal), near black at night
 *   (`nightWater`); darker near the quay walls, under hulls and bridges; more sky toward the far
 *   edge (the grazing angle), more of the water's own dark near the viewer.
 * - ONE RIPPLE LANGUAGE (`waterRipple`): two scales, crests long along u, world-anchored. The near
 *   tiles, the strips, the far rows' painters (STREET-A, GRAMMAR: pass a smaller `scale`) and the
 *   reflection slices all use it, so the canal reads the same near and far.
 * - THE TILES (top faces of the floor's water cuts; (a, b) = world (u, v)): `oat-water-calm` (the
 *   morning mirror and 03:00), `oat-water-busy` (afternoon wakes), `oat-water-night`, and the drifting
 *   ripple layers over them `oat-water-glint-day` / `-night`. `OAT_WATER` holds ready `FloorSurface`s.
 * - THE STATIC REFLECTIONS (`ensureWaterStrip`): a non-repeating strip tile over a stretch of water
 *   (world u0 … u0 + len, the cut's rows v0 … v1) with the mirrored scene baked in world u: the far
 *   bank or our row's ground floors (a `mirror` colour function from the grammar output), the quay wall
 *   and hulls darkening the water, and at night the lantern and neon positions as broken columns of
 *   their own ramp. The ripple rows break the mirror image (a crest shows sky, a trough the body).
 *   2–6 MB at 4× per section inside the floor's 16 MB (spec §8.8).
 *
 * Pure in (a, b, d) and the strip's def (no time, no screen position, no global rng); ordered dither
 * only where a tone changes (the band borders), PAL_HD_OAT colours only.
 */
import type { Color } from '../../../../../engine/color';
import { PAL_HD_OAT } from '../../../../../engine/palette-hd';
import type { Ramp } from '../../../../../engine/pixel';
import { hash2 } from '../../../../art/paint';
import { defineFloorTile, hasFloorTile } from '../../../../mission/floor/registry';
import type { FloorSurface } from '../../../../mission/floor/types';

/** 4 × 4 ordered dither thresholds (−0.5 … 0.5). */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16 - 0.5);

/** A ramp tone t (fractional: ordered dither between the two neighbours, at art px X, Y). */
export function waterTone(r: Ramp, t: number, X: number, Y: number): Color {
  let k = Math.floor(t + 0.5 + BAYER[((Y & 3) << 2) | (X & 3)]);
  if (k < 0) k = 0;
  else if (k >= r.length) k = r.length - 1;
  return r[k] >>> 0;
}

function mod(a: number, n: number): number {
  const r = a % n;
  return r < 0 ? r + n : r;
}

const TAU = Math.PI * 2;

/**
 * THE RIPPLE (−1 … 1) at world (u, v): a broad swell (crest lines ~96 px long, 9 px apart) and a fine
 * chop (~32 px long, 3 px apart), both bent along u so no crest is straight, in slow patches of calm
 * and chop so a crest breaks into dashes. `scale` < 1 for the far rows (the same pattern smaller),
 * `busy` 0 … 1 adds the chop (afternoon wakes). Pure.
 */
export function waterRipple(u: number, v: number, scale = 1, busy = 0): number {
  const x = u / scale;
  const y = v / scale;
  const broad = Math.sin((y / 9) * TAU + Math.sin((x / 96) * TAU) * 1.7 + Math.sin((x / 41) * TAU + 1.3) * 0.6);
  const fine = Math.sin((y / 3.1) * TAU - (x / 32) * TAU * 0.35 + Math.sin((x / 23) * TAU) * 1.1);
  // Patches of calm and chop (a slow field along u): the crests break into dashes, never one line.
  const patch = 0.5 + 0.5 * Math.sin((x / 57) * TAU + Math.sin((y / 13) * TAU) * 2.1) * Math.sin((x / 131) * TAU + (y / 29) * TAU);
  return broad * (0.68 - 0.18 * busy) * (0.65 + 0.35 * patch) + fine * (0.32 + 0.18 * busy) * (0.35 + 0.65 * patch);
}

/** A tile's art px index of a world coordinate at density d. */
function tx(a: number, d: number): number {
  return Math.floor(a * d + 1e-6);
}

/** The day body at ripple r: troughs in the body's dark, crests catching the sky. */
function dayTexel(r: number, base: number, X: number, Y: number, crest: number): Color {
  const C = PAL_HD_OAT.canal;
  if (r > crest) return waterTone(C, 3.4 + (r - crest) * 2.4, X, Y);
  if (r < -0.72) return waterTone(C, base - 0.9, X, Y);
  return waterTone(C, base + r * 0.55, X, Y);
}

/** The night body: near black, the navy sky's sheen on the crests only. */
function nightTexel(r: number, X: number, Y: number): Color {
  if (r > 0.8) return waterTone(PAL_HD_OAT.nightSky, 0.6 + (r - 0.8) * 3, X, Y);
  return waterTone(PAL_HD_OAT.nightWater, 0.55 + r * 0.45, X, Y);
}

/** The tile ids (prefix `oat-water-`, ids.ts). */
export const OAT_WATER_TILE = {
  calm: 'oat-water-calm',
  busy: 'oat-water-busy',
  night: 'oat-water-night',
  glintDay: 'oat-water-glint-day',
  glintNight: 'oat-water-glint-night',
} as const;

/** Register the water tiles once (idempotent: section files and tests call it). */
export function ensureWaterTiles(): void {
  if (hasFloorTile(OAT_WATER_TILE.calm)) return;
  // 192 × 36: whole periods of the broad swell (96 along u, 9 across v) and of the chop's bend.
  defineFloorTile(OAT_WATER_TILE.calm, {
    w: 192,
    h: 36,
    paint: (a, b, d) => dayTexel(waterRipple(a, b, 1, 0), 1.9, tx(a, d), tx(b, d), 0.74),
  });
  defineFloorTile(OAT_WATER_TILE.busy, {
    w: 192,
    h: 36,
    paint: (a, b, d) => dayTexel(waterRipple(a, b, 1, 1), 1.75, tx(a, d), tx(b, d), 0.6),
  });
  defineFloorTile(OAT_WATER_TILE.night, {
    w: 192,
    h: 36,
    paint: (a, b, d) => nightTexel(waterRipple(a, b, 1, 0.3), tx(a, d), tx(b, d)),
  });
  // The drifting layers: only the chop's crests (the rest is the base tile through the alpha).
  defineFloorTile(OAT_WATER_TILE.glintDay, {
    w: 96,
    h: 12,
    paint: (a, b, d) => {
      const r = waterRipple(a * 2, b * 2, 1, 1);
      return r > 0.55 ? waterTone(PAL_HD_OAT.canal, 3.6 + (r - 0.55) * 2, tx(a, d), tx(b, d)) : waterTone(PAL_HD_OAT.canal, 1.6 + r * 0.4, tx(a, d), tx(b, d));
    },
  });
  defineFloorTile(OAT_WATER_TILE.glintNight, {
    w: 96,
    h: 12,
    paint: (a, b, d) => {
      const r = waterRipple(a * 2, b * 2, 1, 1);
      return r > 0.7 ? waterTone(PAL_HD_OAT.nightWater, 1.4 + (r - 0.7) * 2, tx(a, d), tx(b, d)) : PAL_HD_OAT.nightWater[0] >>> 0;
    },
  });
}

/**
 * Ready floor surfaces for the water cuts (docs/api/floor.md §3 `surface`): the base tile still and
 * world-anchored (its strips carry baked reflections), the ripple layer drifting slowly over it.
 */
export const OAT_WATER: Readonly<Record<'calm' | 'busy' | 'night', FloorSurface>> = {
  calm: { tile: OAT_WATER_TILE.calm, du: 0.02, dv: 0.004, over: { tile: OAT_WATER_TILE.glintDay, du: -0.035, alpha: 0.22 } },
  busy: { tile: OAT_WATER_TILE.busy, du: 0.05, dv: 0.012, over: { tile: OAT_WATER_TILE.glintDay, du: -0.07, alpha: 0.38 } },
  night: { tile: OAT_WATER_TILE.night, du: 0.015, dv: 0.004, over: { tile: OAT_WATER_TILE.glintNight, du: -0.03, alpha: 0.3 } },
};

// ---------------------------------------------------------------------------------------------
// The static reflection strips
// ---------------------------------------------------------------------------------------------

/** A light mirrored in a strip (world u, its height over the water in px, its ramp). */
export interface StripLight {
  readonly u: number;
  readonly h: number;
  readonly ramp: 'lantern' | 'neonPink' | 'neonCyan' | 'redLight';
  /** 0..1 strength (default 1). */
  readonly k?: number;
}

/** A strip of water with baked reflections (`ensureWaterStrip`). */
export interface WaterStripDef {
  /** World u of the strip's start and its length (px; the tile's width). */
  readonly u0: number;
  readonly len: number;
  /** World v of the water's far edge (the quay wall / coping) and near edge (the view's bottom). */
  readonly v0: number;
  readonly v1: number;
  /** Night water (nightWater + the lights) or day (canal + the sky). */
  readonly night?: boolean;
  /** 0 … 1 chop (afternoon wakes: 1). */
  readonly busy?: number;
  /** The quay wall's dark band at the far edge, world v (default 3). */
  readonly wall?: number;
  /** Hulls and bridge shadows over the water: world u ranges (darker under them). */
  readonly hulls?: readonly (readonly [number, number])[];
  /**
   * The mirrored scene (from the grammar output): the colour at world u, `h` px over the water (0 at
   * the water line), or 0 for sky / nothing. By day 0 = the sky's sheen; at night 0 = the body.
   */
  readonly mirror?: (u: number, h: number) => Color;
  /** How many px of mirrored height one v unit of the strip shows (default 1.4: the grazing angle stretches). */
  readonly mirrorScale?: number;
  readonly lights?: readonly StripLight[];
  readonly seed?: number;
}

/**
 * The texel function of a reflection strip (exported for tests and the far rows' painters): world
 * (u, v) inside the strip → a PAL_HD_OAT colour.
 */
export function waterStripTexels(def: WaterStripDef, d: number): (u: number, v: number) => Color {
  const night = def.night === true;
  const busy = def.busy ?? 0;
  const span = Math.max(1, def.v1 - def.v0);
  const wall = def.wall ?? 3;
  const hulls = def.hulls ?? [];
  const lights = def.lights ?? [];
  const seed = (def.seed ?? 0x3a7e) | 0;
  const ms = def.mirrorScale ?? 1.4;
  // Lights by 32 px bucket.
  const nb = Math.ceil(def.len / 32) + 2;
  const lb: StripLight[][] = Array.from({ length: nb }, () => []);
  for (const L of lights) {
    const a = Math.max(0, Math.floor((L.u - def.u0 - 12) / 32));
    const b = Math.min(nb - 1, Math.floor((L.u - def.u0 + 12) / 32));
    for (let i = a; i <= b; i++) lb[i].push(L);
  }
  const C = PAL_HD_OAT.canal;
  const N = PAL_HD_OAT.nightWater;
  return (u, v) => {
    const X = tx(u, d);
    const Y = tx(v, d);
    const g = Math.max(0, Math.min(1, (v - def.v0) / span)); // 0 far edge … 1 the viewer
    const r = waterRipple(u, v, 1, busy);
    // Darker at the wall and under hulls (and bridges).
    let dark = v - def.v0 < wall ? 1 - (v - def.v0) / wall : 0;
    for (let i = 0; i < hulls.length; i++) {
      // Under a hull or a bridge: dark, softening over 8 px at its ends.
      const e = Math.min(u - hulls[i][0], hulls[i][1] - u);
      if (e > -8) dark = Math.max(dark, 0.8 * Math.min(1, (e + 8) / 16));
    }
    // The mirrored height of this row: the far edge mirrors the scene's foot, deeper rows higher up,
    // pushed up and down by the swell (the ripple rows break the image).
    const h = (v - def.v0) * ms + r * 2.2;
    if (night) {
      // The lights: broken columns of their own ramp under each light's u (wider toward the viewer).
      const bucket = lb[Math.max(0, Math.min(nb - 1, Math.floor((u - def.u0) / 32)))];
      for (let i = 0; i < bucket.length; i++) {
        const L = bucket[i];
        const half = 0.8 + g * 2.2 + Math.abs(r) * 0.8;
        const du = Math.abs(u - L.u + r * 1.6);
        if (du >= half) continue;
        // The light's mirror row lies h ≈ L.h; the column runs from there toward the viewer, in dashes.
        const near = h - L.h * 0.5;
        if (near < -6) continue;
        if (hash2(Math.floor(v * 1.3), Math.floor(L.u), seed) < 0.3 + 0.2 * busy) continue;
        const k = (L.k ?? 1) * (1 - du / half) * (1 - Math.min(1, Math.abs(near) / (span * ms)));
        if (k > 0.12) {
          const ramp = PAL_HD_OAT[L.ramp];
          return waterTone(ramp, Math.min(ramp.length - 1, k * (ramp.length - 0.5) - 0.4), X, Y);
        }
      }
      if (def.mirror && dark < 0.5 && mirrorRow(r, -0.05, X, Y)) {
        const m = def.mirror(u, h);
        if (m !== 0) return m >>> 0;
      }
      return dark > 0.3 ? N[0] >>> 0 : nightTexel(r, X, Y);
    }
    // Day: the mirrored scene where the ripple faces the scene (troughs), the sky on the crests.
    if (def.mirror && dark < 0.6 && mirrorRow(r, 0.05, X, Y)) {
      const m = def.mirror(u, h);
      if (m !== 0) return m >>> 0;
    }
    // The body: more sky toward the far edge, the water's own dark near the viewer; darker at walls.
    const base = 2.35 - 1.0 * g - 1.6 * dark;
    const crest = 0.58 + 0.25 * g + 0.3 * dark;
    if (r > crest) return waterTone(C, (dark > 0.5 ? 2.2 : 3.3) + (r - crest) * 2.4 - g * 0.6, X, Y);
    if (r < -0.7) return waterTone(C, base - 0.9, X, Y);
    return waterTone(C, base + r * 0.5, X, Y);
  };
}

/**
 * Does the mirror image show at ripple r (the troughs face the scene; the crests show the sky or the
 * body)? Below `at` always, over at + 0.3 never, between them an ordered dither (the image breaks up).
 */
function mirrorRow(r: number, at: number, X: number, Y: number): boolean {
  if (r < at) return true;
  if (r >= at + 0.3) return false;
  return (r - at) / 0.3 < 0.5 - BAYER[((Y & 3) << 2) | (X & 3)];
}

/**
 * Register a reflection strip as a floor tile (idempotent per id; `oat-water-strip-…` ids). Its
 * width is the strip's length (no repeat along it); its height the cut's rows rounded up to 4, so
 * (a, b) = (u, v) maps back to the strip with `mod`. Returns the tile id for the cut's `surface`.
 */
export function ensureWaterStrip(id: string, def: WaterStripDef): string {
  if (hasFloorTile(id)) return id;
  const h = 4 * Math.ceil((def.v1 - def.v0 + 1) / 4);
  const fns = new Map<number, (u: number, v: number) => Color>();
  defineFloorTile(id, {
    w: def.len,
    h,
    paint: (a, b, d) => {
      let fn = fns.get(d);
      if (!fn) {
        fn = waterStripTexels(def, d);
        fns.set(d, fn);
      }
      return fn(def.u0 + mod(a - def.u0, def.len), def.v0 + mod(b - def.v0, h));
    },
  });
  return id;
}

/** The bytes of a strip at density d (the floor budget, spec §8.8: 2–6 MB at 4× per section). */
export function waterStripBytes(def: WaterStripDef, d: number): number {
  const h = 4 * Math.ceil((def.v1 - def.v0 + 1) / 4);
  return def.len * d * h * d * 4;
}
