/**
 * The time of day (docs/design/rally.md §4, §7.5; docs/api/rally.md "B.1"). Wave B contract by PREP;
 * WORLD owns the colours (`DAY_KEYS`) and may add keys; the shape stays.
 *
 * `daylight(progress)`: `progress` is the race progress of the LEADING PLAYER in laps (0 … 3,
 * continuous; `raceProgress`). The light blends smoothly along the race, never in steps: the
 * afternoon of lap 1 (16:15, a low autumn sun), the sunset at the start of lap 2 (17:00: the
 * headlights and street lamps come on), dark at the start of lap 3 (17:45: the evening rush hour)
 * and night at the finish (18:30). One world time for both views in split screen.
 *
 * Pure and deterministic (spec §12.4: only + − × ÷, min / max / floor and the r3 trig tables);
 * `daylight(p, out)` reuses `out` (no allocation per frame). WORLD (wave B) filled the keys and the
 * sun's path (`SUN_PATH`, `sunAt`: the sky's sun sprite).
 */
import type { Light3, Rgb3 } from '../../engine/view3d';
import { cosT, sinT } from '../../engine/r3/trig';
import type { RaceState } from './api';

/** What the time of day gives the scene, WORLD's lights and the HUD. */
export interface Daylight {
  /** The race progress it was made for (laps, 0..3). */
  progress: number;
  /** The HUD clock: minutes after midnight (16:15 = 975 at 0 … 18:30 = 1110 at 3). */
  clock: number;
  /** 0 = full day … 1 = full night (WORLD: the window glow, the sky). */
  night: number;
  /** The light of every view (the sun, the ambient, the fog colour and distance, the sky). */
  readonly light: Light3;
  /** 0..1: the glow of the street lamps, the windows and the matrix signs' halo. */
  lampGlow: number;
  /** The cars drive with their headlights and tail lights on. */
  carLights: boolean;
}

/** One key of the day (WORLD fills the colours; `at` in laps, ascending). */
export interface DayKey {
  readonly at: number;
  readonly sunDir: Rgb3;
  readonly sun: Rgb3;
  readonly ambient: Rgb3;
  readonly fog: Rgb3;
  readonly fogNear: number;
  readonly fogFar: number;
  readonly skyTop: Rgb3;
  readonly skyBottom: Rgb3;
}

/** The HUD clock at the start (16:15) and its minutes per lap (spec §4). */
export const CLOCK_START = 16 * 60 + 15;
export const CLOCK_PER_LAP = 45;
/** The cars' lights come on at this much night (the sunset of lap 2). */
export const CAR_LIGHTS_AT = 0.3;

const DEG = Math.PI / 180;

/**
 * The direction TO the sun at a compass azimuth (degrees from north, clockwise) and an elevation
 * (degrees; below 0 = under the horizon): x = east, z = south, y up (the r3 tables, no Math.sin).
 */
export function sunVector(azimuth: number, elevation: number, out: Rgb3 = [0, 0, 0]): Rgb3 {
  const a = azimuth * DEG;
  const e = elevation * DEG;
  const c = cosT(e);
  out[0] = sinT(a) * c;
  out[1] = sinT(e);
  out[2] = -cosT(a) * c;
  return out;
}

/**
 * The sun's path over the race (WORLD; late October over Amsterdam): `at` laps, the compass azimuth
 * and the elevation (degrees). Low in the south-west on lap 1 (16:15), on the horizon in the
 * west-south-west at the start of lap 2 (17:00), under it after that. The sky's sun sprite
 * (content/rally/sky) follows it; the light's `sunDir` follows it until dusk, then turns into the
 * high fill of the night (the city's glow and the clouds).
 */
export const SUN_PATH: readonly { readonly at: number; readonly azimuth: number; readonly elevation: number }[] = [
  { at: 0, azimuth: 226, elevation: 13 },
  { at: 0.5, azimuth: 234, elevation: 7.5 },
  { at: 1, azimuth: 242, elevation: 0.5 },
  { at: 1.4, azimuth: 248, elevation: -5 },
  { at: 3, azimuth: 262, elevation: -24 },
];

/** The sun's direction (unit; y < 0 below the horizon) at `progress` laps, written into `out`. */
export function sunAt(progress: number, out: Rgb3 = [0, 0, 0]): Rgb3 {
  const P = SUN_PATH;
  const p = Math.max(P[0].at, Math.min(P[P.length - 1].at, progress));
  let i = 0;
  while (i < P.length - 2 && p > P[i + 1].at) i++;
  const a = P[i];
  const b = P[i + 1];
  const t = (p - a.at) / (b.at - a.at);
  return sunVector(a.azimuth + (b.azimuth - a.azimuth) * t, a.elevation + (b.elevation - a.elevation) * t, out);
}

/** The high fill light of the night (the city's glow on the clouds): from the south-east, high. */
const NIGHT_FILL = sunVector(150, 62);

/**
 * WORLD's keys (spec §4, §7.5), from 16:15 to 18:30:
 * - 0 (16:15) a low autumn sun from the south-west: warm light, a cool blue fill (the long dark
 *   sides away from the sun), a hazy cream horizon;
 * - 0.5 (16:37) the sun lower and more golden;
 * - 0.95 (16:58) the sunset: an orange-pink horizon under a purple-blue sky, warm red light;
 * - 1.35 (17:16) the afterglow: pink at the horizon, the light from the sky alone;
 * - 1.85 (17:38) the blue hour: a deep blue sky, the horizon turning to the city's glow;
 * - 2.2 (17:54) dark: a deep blue sky with the orange city glow at the horizon (sodium haze);
 * - 3 (18:30) night.
 * The fog colour equals the sky's bottom (a seamless pop-in, docs/api/rally.md A.GL.1); the sight
 * shortens a little in the dark. Every channel of `skyTop` falls from key to key (the sky only darkens).
 */
export const DAY_KEYS: readonly DayKey[] = [
  key(0, sunVector(226, 13), [1.0, 0.87, 0.68], [0.47, 0.49, 0.58], [0.34, 0.53, 0.8], [0.86, 0.8, 0.7], 170, 430),
  key(0.5, sunVector(234, 7.5), [1.0, 0.78, 0.54], [0.45, 0.45, 0.54], [0.31, 0.46, 0.74], [0.9, 0.75, 0.58], 165, 425),
  key(0.95, sunVector(242, 1.2), [1.0, 0.58, 0.34], [0.43, 0.38, 0.46], [0.29, 0.32, 0.58], [0.95, 0.6, 0.42], 155, 410),
  key(1.35, [-0.55, 0.45, 0.2], [0.6, 0.38, 0.42], [0.37, 0.33, 0.43], [0.17, 0.19, 0.42], [0.66, 0.42, 0.4], 145, 395),
  key(1.85, NIGHT_FILL, [0.26, 0.26, 0.38], [0.31, 0.31, 0.42], [0.075, 0.1, 0.27], [0.36, 0.25, 0.26], 140, 380),
  key(2.2, NIGHT_FILL, [0.18, 0.18, 0.28], [0.29, 0.29, 0.39], [0.045, 0.06, 0.17], [0.32, 0.2, 0.15], 135, 370),
  key(3, NIGHT_FILL, [0.15, 0.15, 0.24], [0.27, 0.27, 0.37], [0.035, 0.045, 0.13], [0.29, 0.18, 0.13], 135, 370),
];

function key(at: number, sunDir: Rgb3, sun: Rgb3, ambient: Rgb3, skyTop: Rgb3, skyBottom: Rgb3, fogNear: number, fogFar: number): DayKey {
  const n = Math.sqrt(sunDir[0] * sunDir[0] + sunDir[1] * sunDir[1] + sunDir[2] * sunDir[2]) || 1;
  return { at, sunDir: [sunDir[0] / n, sunDir[1] / n, sunDir[2] / n], sun, ambient, fog: skyBottom, fogNear, fogFar, skyTop, skyBottom };
}

/** A fresh Daylight (its light is the first key's). */
export function newDaylight(): Daylight {
  const k = DAY_KEYS[0];
  return {
    progress: 0,
    clock: CLOCK_START,
    night: 0,
    light: { sunDir: c3(k.sunDir), sun: c3(k.sun), ambient: c3(k.ambient), fog: c3(k.fog), fogNear: k.fogNear, fogFar: k.fogFar, skyTop: c3(k.skyTop), skyBottom: c3(k.skyBottom) },
    lampGlow: 0,
    carLights: false,
  };
}

function c3(v: Readonly<Rgb3>): Rgb3 {
  return [v[0], v[1], v[2]];
}

/** 0..1 with a soft start and end (3t² − 2t³). */
function smooth(t: number): number {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return u * u * (3 - 2 * u);
}

function mix3(out: Rgb3, a: Rgb3, b: Rgb3, t: number): void {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
}

/**
 * The time of day at `progress` laps (clamped to the keys' range). Writes `out` (default a new one)
 * and returns it.
 */
export function daylight(progress: number, out: Daylight = newDaylight(), keys: readonly DayKey[] = DAY_KEYS): Daylight {
  const last = keys[keys.length - 1];
  const p = Math.max(keys[0].at, Math.min(last.at, progress));
  let i = 0;
  while (i < keys.length - 2 && p > keys[i + 1].at) i++;
  const a = keys[i];
  const b = keys[Math.min(i + 1, keys.length - 1)];
  const t = b.at > a.at ? smooth((p - a.at) / (b.at - a.at)) : 0;
  const L = out.light;
  mix3(L.sunDir, a.sunDir, b.sunDir, t);
  const n = Math.sqrt(L.sunDir[0] * L.sunDir[0] + L.sunDir[1] * L.sunDir[1] + L.sunDir[2] * L.sunDir[2]) || 1;
  L.sunDir[0] /= n;
  L.sunDir[1] /= n;
  L.sunDir[2] /= n;
  mix3(L.sun, a.sun, b.sun, t);
  mix3(L.ambient, a.ambient, b.ambient, t);
  mix3(L.fog, a.fog, b.fog, t);
  mix3(L.skyTop, a.skyTop, b.skyTop, t);
  mix3(L.skyBottom, a.skyBottom, b.skyBottom, t);
  L.fogNear = a.fogNear + (b.fogNear - a.fogNear) * t;
  L.fogFar = a.fogFar + (b.fogFar - a.fogFar) * t;
  out.progress = p;
  out.clock = CLOCK_START + CLOCK_PER_LAP * p;
  // Night: from the sunset (0.6 laps) to dark (2 laps); the lamps from 0.8 to 1.6 laps.
  out.night = smooth((p - 0.6) / 1.4);
  out.lampGlow = smooth((p - 0.8) / 0.8);
  out.carLights = out.night >= CAR_LIGHTS_AT;
  return out;
}

/** The HUD clock text of `minutes` after midnight ('16:15'). */
export function clockText(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return `${h}:${mm < 10 ? '0' : ''}${mm}`;
}

/**
 * The race progress of the leading PLAYER in laps (0 … laps, continuous): the largest `dist` of the
 * player cars / the track length. On the grid it is the start lap's (a `?lap=2` race starts at
 * about 1). 0 when no player races.
 */
export function raceProgress(race: Readonly<RaceState>, length: number): number {
  let best = -Infinity;
  for (const c of race.cars) if (c.slot >= 0 && c.dist > best) best = c.dist;
  if (best === -Infinity || length <= 0) return 0;
  return Math.max(0, Math.min(race.laps, best / length));
}
