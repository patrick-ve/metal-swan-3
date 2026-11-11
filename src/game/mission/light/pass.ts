/**
 * THE MISSION LIGHT PASS (docs/design/oldenzaal.md §10.1, §10.2; docs/api/oldenzaal.md §3).
 * Owner: LIGHT. An ADDITIVE OPT-IN: the runner makes a pass only for a section that registered a
 * light config (`defineSectionLight`, ./api.ts since the oat wave A; content/oldenzaal/kit/
 * light-api.ts re-exports it). Every other section (ams, the ring, m0–m5, the first-person floors)
 * has no pass: it simulates and draws exactly as before (the pass never touches game state,
 * `world.rng` or `world.fxRng`). The oat flags of the contract (`glow`, `streaks`, `groups`,
 * `bakes`; docs/design/oat.md §8.9) default to today's behaviour: LIGHT-WATER implements them.
 *
 * Drawing order (MissionRunner.draw):
 *   background layers → `drawBack` (the far fog bands; the backdrop's lightning flash)
 *   → terrain / back decor → entities → front decor / layers
 *   → `draw`: the near fog over the feet → the darkness with the lights cut in (light map, normal
 *     blend) → the lights' colour (additive) → the rain → the lightning flash → (the scene: HUD)
 *
 * Lights (all cosmetic, refreshed every drawn frame, no allocation per frame):
 * - the section's static `lamps` (world px; flicker by a tick hash);
 * - every live entity with the tag `oz-light` and a `lightOf(out, tick)` (one reused LightSpot);
 * - the players (`heroLight` px, no colour: the readability floor) and the pickups (a faint pool);
 * - muzzle flashes and blasts (`fx/muzzle…`, `fx/explosion…`): a short warm flash in the dark.
 *
 * The perspective floor (docs/design/floor.md §3.8; ./floor.ts): ONLY in a section that has a floor
 * (`worldFloor`), the lamp glows move with their lamps' depth, every lamp lights an elliptical pool
 * on the floor, the far fog rises with the lifted backdrop and the near fog becomes a ground mist
 * lying on the floor (line-scrolled rows). Every other section takes the paths below unchanged.
 *
 * Weather: the `fog` bands use the `oz-fog` generator and the `rain` the `oz-rain` tile
 * (content/oldenzaal/weather/), built at the drawing's art density (1×, 2× or 4×; the dense ones
 * as art jobs in the browser). Wind gusts (`wind`) push the rain and the fog sideways.
 *
 * Lightning: a seeded schedule (`lightning.every`, its own Rng from the section seed: the game's
 * rngs are untouched) or `lightning(world, s)` from a script. A flash lifts the darkness, lights
 * the backdrop (drawn before the terrain, so the town stands black against it) and the whole
 * view, may strike twice (`double`), and the thunder sfx `oz/env/thunder` follows (when it is
 * defined) after a delay.
 *
 * THE OAT FLAGS (docs/design/oat.md §8.4, §8.8, §8.9; LIGHT-WATER), each off unless the config sets it,
 * so oldenzaal takes every old path cell for cell:
 * - `glow: 'smooth'`: at res ≥ 2 the lights still cut the 1× darkness map, but their COLOUR is drawn
 *   as dense additive glow frames at the art density (./glow.ts): round glows, pools and streak
 *   dashes instead of 4 × 4 blocks, for one frame draw per light; 1× keeps the map's glow.
 * - `streaks`: every static lamp with `streak` and every entity light whose `lightOf` sets
 *   `spot.streak` mirrors as a vertical stack of short dashes on the water / wet floor rows
 *   [y0, y1]: centred on its mirror point (`level` px under its floor row), wider and longer with
 *   `ripple`, the dashes swaying smoothly (a sine of world y and the tick: no on / off sparkle).
 * - `groups`: named lamp groups (`StaticLight.group`) a script switches on, off, or flickering out
 *   (`lampGroup`): a dying tube in uneven 3–6 tick steps between full and a third, then off; with
 *   the settings' reduced flashes a smooth fade instead.
 * - `bakes`: the 03:00 cross-fade of the lit and dark bakes (`crossFadeLight`): the pass eases the
 *   mix and pushes it to the section's strips (`setStripDarkMix`); the floor reads `lightSetMix`.
 * - `day`: a day section: no darkness, no light map; only the ground overlays below.
 * - `water`, `sunShadows` (a floor only, in `drawGround`): the dynamic reflections
 *   (mission/floor/reflect.ts) and the actors' sun-stretched cast shadows (./contact.ts).
 */
import type { Color } from '../../../engine/color';
import { sOfY } from '../../../engine/floor/cam';
import type { PixelBuffer } from '../../../engine/pixel';
import type { DrawOpts, Frame, ParallaxOpts, Renderer, SrcRect } from '../../../engine/render';
import { VIEW_H, VIEW_W } from '../../../engine/render';
import { Rng } from '../../../engine/rng';
import { cancelArtJobs, hiArtDeferred, queueArtJob } from '../../../engine/sprites';
import { hasSfx } from '../../../engine/synth';
import type { World } from '../../../engine/world';
import { bgDensityFor, getBgGenerator, hasBgGenerator, makeHiBgLayer } from '../../art/art-registry';
import { hash2 } from '../../art/paint';
import {
  bindLightControl,
  isLightSource,
  LIGHT_TAG,
  sectionLight,
  type LightControl,
  type LightSpot,
  type SectionLight,
  type StaticLight,
} from './api';
import { FxEntity } from '../../fx';
import { floorPool, floorShift, worldFloor, type FloorPoint, type FloorPool } from '../floor/hooks';
import { FramePlacer } from '../floor/place';
import { WaterReflections } from '../floor/reflect';
import type { SectionFloor } from '../floor/section-floor';
import { setStripDarkMix } from '../strips/live';
import type { SectionDef } from '../types';
import { SunShadows } from './contact';
import { GlowFrames } from './glow';
import { DEFAULT_MIST, floorLightOf, mistAlpha, type FloorLightConfig, type MistConfig } from './floor';
import { LightMap } from './lightmap';
import type { LampGroupState, LightSetId, StreakConfig } from './api';

/** Generator ids (content/oldenzaal/weather; ids.ts OZ_LIGHT.fogLayer / rainLayer). */
export const FOG_GEN = 'oz-fog';
export const RAIN_GEN = 'oz-rain';
/** The thunder after a flash (AUDIO's synth / sample id). */
export const THUNDER_SFX = 'oz/env/thunder';

/** Darkness is capped here (spec §10.1: the squad and the pickups stay readable). */
export const MAX_DARKNESS = 0.75;
/** Default share of a light's colour added on top. */
const LAMP_GLOW = 0.4;
/** A flash lifts this share of the darkness at its peak. */
const FLASH_LIFT = 0.7;
/** Backdrop flash (additive, before the terrain) and the full-view flash, alpha at strength 1. */
const BACK_FLASH = 0.45;
const VIEW_FLASH = 0.2;
/** The settings' reduced flashes: the flash drawn at this share (context.ts screenFlash: 30 %). */
export const REDUCED_FLASH = 0.3;
/** A flickering lamp group's step (ticks: ≤ 3 dims per second, spec §14 risk 6) and its dim factor. */
export const FLICKER_STEP = 10;
const FLICKER_DIM = 0.6;
const FLASH_COLOR: Color = 0xdfeaffff;
/** Hero light: no colour, this strength. Pickups: a faint pool. */
const HERO_LIGHT = 0.8;
const ITEM_R = 18;
const ITEM_LIGHT = 0.6;
const MUZZLE_COLOR: Color = 0xf8c055ff; // PAL_HD_OZ.candle[5]
const BLAST_COLOR: Color = 0xe19529ff; // PAL_HD_OZ.candle[4]
const NEUTRAL: Color = 0xffffffff;

/** The walk line (the water plane's reference without a floor). */
const G_WALK = 176;
/** Fog / rain tile sizes (logical px). */
const FOG_W = 512;
/** The ground mist's texture rows (a floor only: from the mist's top to the view's bottom). */
const MIST_H = 80;
/** The ground mist's highest density (its 4× build is one 32 ms art job: integration, wave A). */
const MIST_MAX_DENSITY = 2;
const RAIN_W = 192;
const RAIN_H = 216;

/** Streak defaults (spec §8.8): the rows, the length, the dash strength, the water plane, the ripple. */
const STREAK_Y0 = 184;
const STREAK_LEN = 26;
const STREAK_STRENGTH = 0.8;
const STREAK_LEVEL = 6;
const STREAK_RIPPLE = 0.5;
/** A dash every this many logical px down the streak. */
const DASH_STEP = 2;
/** A flickering group's default length, ticks (spec §6.9: 20–40). */
const GROUP_FLICKER: readonly [number, number] = [20, 40];
/** Group states as numbers. */
const G_ON = 0;
const G_OFF = 1;
const G_FLICKER = 2;

/** One scheduled or scripted flash. */
interface Flash {
  t0: number;
  s: number;
}

/** A weather buffer at its densities (undefined = not built yet, null = none). */
interface WeatherBuf {
  readonly gen: string;
  readonly w: number;
  readonly h: number;
  readonly params: Readonly<Record<string, unknown>>;
  readonly seed: number;
  one: PixelBuffer | null;
  hi: { 2: PixelBuffer | null | undefined; 4: PixelBuffer | null | undefined };
}

let passSerial = 0;

/** The highest density ≤ want that res k can show (4 needs 4 | k; 2 needs k ≥ 2): view.ts's rule. */
function atRes(want: number, k: number): 1 | 2 | 4 {
  if (want >= 4 && k >= 4 && k % 4 === 0) return 4;
  return want >= 2 && k >= 2 ? 2 : 1;
}

/** Flicker factor of a light (0 = steady): a slow wobble and rare drop-outs, by tick hash. */
export function flickerAt(f: number, tick: number, key: number): number {
  if (f <= 0) return 1;
  const wob = hash2(Math.floor(tick / 4), key, 0x51f1);
  let k = 1 - f * 0.3 * wob;
  if (hash2(Math.floor(tick / 3), key, 0x77d3) < f * 0.09) k *= 0.15;
  return k;
}

/** Gust strength 0..1 at tick t (a smooth, uneven function; 0 most of the time at low wind). */
export function gustAt(t: number): number {
  const v = Math.sin(t * 0.0113) * 0.7 + Math.sin(t * 0.0271 + 1.7) * 0.5 - 0.25;
  return v <= 0 ? 0 : Math.min(1, v / 0.95);
}

export class MissionLight implements LightControl {
  readonly cfg: SectionLight;
  readonly world: World;
  readonly map = new LightMap(VIEW_W + 1, VIEW_H + 1);
  private readonly rng: Rng;
  private readonly key: string;
  /** The runner tick of the last update (scripts' flash / setDarkness use it). */
  private now = 0;
  private started = false;
  /** Darkness fade: from → to over [f0, f0 + flen). */
  private dFrom: number;
  private dTo: number;
  private f0 = 0;
  private flen = 0;
  /** Up to 4 live flashes (reused records). */
  private readonly flashes: Flash[] = [
    { t0: -1e9, s: 0 },
    { t0: -1e9, s: 0 },
    { t0: -1e9, s: 0 },
    { t0: -1e9, s: 0 },
  ];
  private nextBolt = Infinity;
  private thunderAt = Infinity;
  private thunderVol = 1;
  /** Flashes started so far (tests / debug). */
  bolts = 0;
  /** Thunders played so far (tests / debug). */
  thunders = 0;
  /** Accumulated wind push (px): the rain and the fog drift. */
  windX = 0;
  fogX = 0;
  private readonly fogFar: WeatherBuf | null;
  private readonly fogNear: WeatherBuf | null;
  private readonly rain: WeatherBuf | null;
  private readonly spot: LightSpot = { x: 0, y: 0, r: 0, color: NEUTRAL, intensity: 1, flicker: 0, streak: false };
  private readonly darkOpts: DrawOpts = { stream: true };
  private readonly glowOpts: DrawOpts = { stream: true, blend: 'add' };
  private readonly flashOpts: DrawOpts = { screen: true, blend: 'add', alpha: 0 };
  private readonly layerOpts: ParallaxOpts = { repeatX: true, repeatY: false, alpha: 1 };
  private readonly rainOpts: ParallaxOpts = { repeatX: true, repeatY: true, alpha: 1 };
  /** Was the glow layer drawn last frame (tests / debug)? */
  glowDrawn = false;
  /** The section's perspective floor (null: none — every path below draws as before). */
  readonly floor: SectionFloor | null;
  private readonly floorCfg: FloorLightConfig | null;
  private readonly mistCfg: MistConfig;
  private readonly mist: WeatherBuf | null;
  /** The depth of each static lamp on the floor (null: no floor, or every lamp at the walk plane). */
  private readonly lampDepths: Float64Array | null;
  private readonly pt: FloorPoint = { x: 0, y: 0 };
  private readonly pool: FloorPool = { x: 0, y: 0, rx: 0, ry: 0 };
  private readonly mistFrames = new Map<PixelBuffer, Frame>();
  private readonly mistSrc: SrcRect = { x: 0, y: 0, w: FOG_W, h: 1 };
  /** The mist rows draw in world space (the renderer's 1/res grid: no whole-px stepping, spec §2.1). */
  private readonly mistOpts: DrawOpts = { alpha: 1, src: this.mistSrc };
  private readonly placer = new FramePlacer();
  /** Mist rows drawn last frame (tests / debug). */
  mistRows = 0;
  /** OAT: the smooth glow's dense frames (a section with `glow: 'smooth'`), and this frame's density for them (0: off). */
  readonly glows: GlowFrames | null;
  private glowD = 0;
  /** OAT: the streak settings (null: no streaks). */
  private readonly streak: StreakConfig | null;
  /** Streak dashes added last frame (tests / debug). */
  streakDashes = 0;
  /** OAT: lamp groups — names, states, flicker ends and lengths; each static lamp's group (−1 none). */
  private readonly groupNames: readonly string[];
  private readonly groupState: Uint8Array;
  private readonly groupEnd: Float64Array;
  private readonly groupStart: Float64Array;
  private readonly groupLen: readonly (readonly [number, number])[];
  private readonly lampGroupIx: Int16Array | null;
  /** OAT: the bake cross-fade (0 lit … 1 dark): from → to over [b0, b0 + blen). */
  private mixFrom = 0;
  private mixTo = 0;
  private b0 = 0;
  private blen = 0;
  private lastMix = -1;
  private readonly sectionId: string | undefined;
  /** OAT: the ground overlays (a floor only). */
  readonly reflections: WaterReflections | null;
  readonly sunShadows: SunShadows | null;
  /**
   * The ground mist is drawn UNDER the entities (the runner binds `drawGround` to the view's
   * `floorHook`, a floor only); false: `draw` lays it over them, in the old near fog's slot.
   */
  mistUnder = false;

  /** The pass of a section, or null when it has no light config (= no pass: draws as today). */
  static forSection(def: SectionDef, world: World, seed: number, flashScale = 1): MissionLight | null {
    const cfg = sectionLight(def.id);
    return cfg ? new MissionLight(cfg, world, seed, flashScale, def.id) : null;
  }

  /**
   * `flashScale`: how strongly the lightning is DRAWN (1; REDUCED_FLASH with the settings'
   * reduced flashes). The schedule and the thunder do not depend on it.
   */
  readonly flashScale: number;

  /** `sectionId`: names the floor light (`defineFloorLight`) of a section with a perspective floor. */
  constructor(cfg: SectionLight, world: World, seed: number, flashScale = 1, sectionId?: string) {
    this.cfg = cfg;
    this.flashScale = Math.max(0, Math.min(1, flashScale));
    this.world = world;
    this.rng = new Rng((seed ^ 0x6c1647) >>> 0);
    this.key = `light/${++passSerial}/`;
    const d = Math.max(0, Math.min(MAX_DARKNESS, cfg.darkness));
    this.dFrom = d;
    this.dTo = d;
    const fog = cfg.fog;
    if (fog && fog.density > 0 && hasBgGenerator(FOG_GEN)) {
      const top = Math.max(0, Math.min(VIEW_H - 8, fog.top));
      const farH = VIEW_H - top + 4;
      const nearTop = Math.round(top + (VIEW_H - top) * 0.3);
      const nearH = VIEW_H - nearTop + 4;
      this.fogFar = this.weather(FOG_GEN, FOG_W, farH, { color: fog.color, ramp: farH * 0.55, base: 0.6 }, seed ^ 0xf06);
      this.fogNear = this.weather(FOG_GEN, FOG_W, nearH, { color: fog.color, ramp: nearH * 0.6, base: 0.45, cell: 64 }, seed ^ 0xf07);
    } else {
      this.fogFar = null;
      this.fogNear = null;
    }
    const rain = cfg.rain;
    if (rain && rain.density > 0 && hasBgGenerator(RAIN_GEN)) {
      const params: Record<string, unknown> = { slant: rain.slant ?? 0.25 };
      if (rain.color !== undefined) params.color = rain.color;
      this.rain = this.weather(RAIN_GEN, RAIN_W, RAIN_H, params, seed ^ 0x4a1);
    } else this.rain = null;
    // The perspective floor (opt-in: a section with a floor only).
    const floor = worldFloor(world);
    this.floor = floor;
    this.floorCfg = floor ? ((sectionId !== undefined ? floorLightOf(sectionId) : undefined) ?? {}) : null;
    this.mistCfg = { ...DEFAULT_MIST, ...(this.floorCfg?.mist ?? {}) };
    this.mist = floor && fog && fog.density > 0 && hasBgGenerator(FOG_GEN) ? this.weather(FOG_GEN, FOG_W, MIST_H, { color: fog.color, ramp: 1, base: 0.62, cell: 96 }, seed ^ 0xf08) : null;
    const lampDepth = this.floorCfg?.lampDepth;
    const lamps = cfg.lamps;
    this.lampDepths = floor && lamps && lampDepth ? Float64Array.from(lamps, (l, i) => lampDepth(l, i)) : null;
    // The oat opt-ins (none of them set: every field below is inert).
    this.sectionId = sectionId;
    const st = cfg.streaks;
    this.streak = st ? (st === true ? {} : st) : null;
    const groups = cfg.groups ?? [];
    this.groupNames = groups.map((g) => g.name);
    this.groupState = new Uint8Array(groups.length);
    this.groupEnd = new Float64Array(groups.length);
    this.groupStart = new Float64Array(groups.length);
    this.groupLen = groups.map((g) => g.flicker ?? GROUP_FLICKER);
    for (let i = 0; i < groups.length; i++) this.groupState[i] = groups[i].state === 'off' ? G_OFF : G_ON;
    this.lampGroupIx = groups.length > 0 && lamps ? Int16Array.from(lamps, (l) => (l.group !== undefined ? this.groupNames.indexOf(l.group) : -1)) : null;
    if (cfg.bakes?.start === 'dark') {
      this.mixFrom = 1;
      this.mixTo = 1;
    }
    this.reflections = floor && cfg.water ? new WaterReflections(cfg.water) : null;
    this.sunShadows = floor && cfg.sunShadows ? new SunShadows(cfg.sunShadows) : null;
    this.glows = cfg.glow === 'smooth' ? new GlowFrames() : null;
    bindLightControl(world, this);
  }

  private weather(gen: string, w: number, h: number, params: Record<string, unknown>, seed: number): WeatherBuf {
    return { gen, w, h, params, seed: seed >>> 0, one: null, hi: { 2: undefined, 4: undefined } };
  }

  /** Unbind from the world and drop queued art jobs (the runner replaces the pass). */
  dispose(): void {
    bindLightControl(this.world, null);
    cancelArtJobs(this.key);
  }

  // ------------------------------------------------------------------------------- control

  /** The darkness now (0..MAX_DARKNESS; without the flash). */
  get darkness(): number {
    if (this.flen <= 0 || this.now >= this.f0 + this.flen) return this.dTo;
    const t = Math.max(0, (this.now - this.f0) / this.flen);
    return this.dFrom + (this.dTo - this.dFrom) * t;
  }

  setDarkness(d: number, fadeTicks = 60): void {
    const cur = this.darkness;
    this.dFrom = cur;
    this.dTo = Math.max(0, Math.min(MAX_DARKNESS, d));
    this.f0 = this.now;
    this.flen = Math.max(0, fadeTicks);
  }

  flash(strength = 1): void {
    this.bolt(this.now, Math.max(0, Math.min(1, strength)), true);
  }

  /** OAT (spec §6.9): switch a lamp group; 'flicker' = a dying tube for the group's ticks, then off. Unknown names: nothing. */
  group(name: string, state: LampGroupState): void {
    const g = this.groupNames.indexOf(name);
    if (g < 0) return;
    if (state === 'flicker') {
      if (this.groupState[g] === G_OFF) return;
      const [a, b] = this.groupLen[g];
      this.groupState[g] = G_FLICKER;
      this.groupStart[g] = this.now;
      this.groupEnd[g] = this.now + this.rng.int(Math.max(1, a), Math.max(a, b));
    } else this.groupState[g] = state === 'off' ? G_OFF : G_ON;
  }

  /** The state of a lamp group now (tests / scripts; undefined: no such group). */
  groupOf(name: string): LampGroupState | undefined {
    const g = this.groupNames.indexOf(name);
    if (g < 0) return undefined;
    const s = this.groupState[g];
    return s === G_ON ? 'on' : s === G_OFF ? 'off' : 'flicker';
  }

  /**
   * A group's light factor at tick t (1 on, 0 off; flickering: 10-tick steps between 1 and 0.6, more
   * of them dim toward the end — a smooth fade with the reduced flashes). At most 3 dims per second
   * per group (spec §14 risk 6), and each group's step grid is offset by 3 ticks per group index, so
   * no two groups dim on the same tick.
   */
  private groupK(g: number, tick: number): number {
    const s = this.groupState[g];
    if (s === G_ON) return 1;
    if (s === G_OFF) return 0;
    const t0 = this.groupStart[g];
    const t1 = this.groupEnd[g];
    if (tick >= t1) return 0;
    const p = (tick - t0) / Math.max(1, t1 - t0);
    if (this.flashScale < 1) return 1 - p;
    // Steps of FLICKER_STEP ticks on the world's tick grid (staggered per group), each on or dim by
    // the tube's age at the step's start (so a step never changes inside).
    const off = (g * 3) % FLICKER_STEP;
    const step = Math.floor((tick + off) / FLICKER_STEP);
    const age = Math.max(0, (step * FLICKER_STEP - off - t0) / Math.max(1, t1 - t0));
    return hash2(step, g, 0x7f3) < 0.75 - 0.6 * age ? 1 : FLICKER_DIM;
  }

  /** OAT (spec §8.9): cross-fade to the lit or the dark bake over `fadeTicks` (default the bake's, 60). */
  lightSet(set: LightSetId, fadeTicks?: number): void {
    if (!this.cfg.bakes) return;
    this.mixFrom = this.bakeMix();
    this.mixTo = set === 'dark' ? 1 : 0;
    this.b0 = this.now;
    this.blen = Math.max(0, fadeTicks ?? this.cfg.bakes.fadeTicks ?? 60);
  }

  /** The dark bake's share now (0 lit … 1 dark), eased. */
  bakeMix(): number {
    if (this.blen <= 0 || this.now >= this.b0 + this.blen) return this.mixTo;
    const t = Math.max(0, (this.now - this.b0) / this.blen);
    const e = t * t * (3 - 2 * t);
    return this.mixFrom + (this.mixTo - this.mixFrom) * e;
  }

  /** Start a flash at t0 (maybe a second one), and schedule its thunder. */
  private bolt(t0: number, s: number, thunder: boolean): void {
    if (s <= 0) return;
    this.push(t0, s);
    this.bolts++;
    const dbl = this.cfg.lightning?.double ?? 0;
    if (dbl > 0 && this.rng.chance(dbl)) this.push(t0 + this.rng.int(6, 12), s * 0.75);
    if (thunder && s >= 0.4) {
      this.thunderAt = t0 + this.rng.int(20, 70);
      this.thunderVol = 0.5 + 0.5 * s;
    }
  }

  private push(t0: number, s: number): void {
    // Reuse the oldest record.
    let k = 0;
    for (let i = 1; i < this.flashes.length; i++) if (this.flashes[i].t0 < this.flashes[k].t0) k = i;
    this.flashes[k].t0 = t0;
    this.flashes[k].s = s;
  }

  /** The flash level 0..1 at tick t (the brightest live flash: a 2-tick peak, then a fast fade). */
  flashAt(t: number): number {
    let v = 0;
    for (const f of this.flashes) {
      const dt = t - f.t0;
      if (dt < 0 || dt > 40) continue;
      const e = dt < 2 ? f.s : f.s * Math.exp(-(dt - 2) / 4.5);
      if (e > v) v = e;
    }
    return v;
  }

  // ------------------------------------------------------------------------------- tick

  /** Once per runner tick: the lightning schedule, the thunder, the wind. Cosmetic only. */
  update(tick: number): void {
    this.now = tick;
    const ln = this.cfg.lightning;
    if (!this.started) {
      this.started = true;
      if (ln) this.nextBolt = tick + this.rng.int(Math.max(1, Math.floor(ln.every[0] / 2)), Math.max(1, ln.every[1]));
    }
    if (ln && tick >= this.nextBolt) {
      this.bolt(tick, Math.max(0.2, Math.min(1, ln.strength ?? 1)) * (0.7 + 0.3 * this.rng.next()), true);
      this.nextBolt = tick + this.rng.int(Math.max(1, ln.every[0]), Math.max(ln.every[0], ln.every[1]));
    }
    if (tick >= this.thunderAt) {
      this.thunderAt = Infinity;
      this.thunders++;
      if (hasSfx(THUNDER_SFX)) this.world.audio.sfx(THUNDER_SFX, { vol: this.thunderVol });
    }
    const wind = this.cfg.wind ?? (this.cfg.rain ? 0.5 : 0);
    const g = wind > 0 ? gustAt(tick) * wind : 0;
    this.windX += g * 2.4;
    const drift = this.cfg.fog?.drift ?? 0;
    this.fogX += drift + (drift < 0 ? -g : g) * 0.6;
    // OAT: flickering groups die out; the bake's mix goes to the strips.
    for (let i = 0; i < this.groupState.length; i++) if (this.groupState[i] === G_FLICKER && tick >= this.groupEnd[i]) this.groupState[i] = G_OFF;
    if (this.cfg.bakes && this.sectionId !== undefined) {
      const mix = this.bakeMix();
      if (mix !== this.lastMix) {
        this.lastMix = mix;
        setStripDarkMix(this.sectionId, mix);
      }
    }
  }

  // ------------------------------------------------------------------------------- draw

  /** The weather buffer at density d (≤ d with art; the 1× one until a dense one is built). */
  private buf(wb: WeatherBuf, want: 1 | 2 | 4): { buf: PixelBuffer; d: 1 | 2 | 4 } | null {
    if (!wb.one) {
      try {
        wb.one = getBgGenerator(wb.gen)(wb.w, wb.h, wb.params, wb.seed);
      } catch {
        wb.one = null;
      }
      if (!wb.one) return null;
    }
    const d = want > 1 ? bgDensityFor(wb.gen, want) : 1;
    if (d === 1) return { buf: wb.one, d: 1 };
    const have = wb.hi[d];
    if (have) return { buf: have, d };
    if (have === undefined) {
      const build = (): void => {
        if (wb.hi[d] !== undefined) return;
        wb.hi[d] = makeHiBgLayer(wb.gen, wb.w, wb.h, wb.params, wb.seed, d);
      };
      if (hiArtDeferred()) queueArtJob(`${this.key}${wb.gen}:${wb.seed}@${d}`, build);
      else build();
      const now = wb.hi[d];
      if (now) return { buf: now, d };
    }
    // Not built yet at 4: the 2× one when it is there.
    if (d === 4 && wb.hi[2]) return { buf: wb.hi[2], d: 2 };
    return { buf: wb.one, d: 1 };
  }

  private drawLayer(r: Renderer, wb: WeatherBuf | null, want: 1 | 2 | 4, factor: number, ox: number, oy: number, alpha: number, o: ParallaxOpts, factorY = 0): void {
    if (!wb || alpha <= 0.004) return;
    const b = this.buf(wb, want);
    if (!b) return;
    o.alpha = Math.min(1, alpha);
    o.density = b.d === 1 ? undefined : b.d;
    const wrapX = ((ox % wb.w) + wb.w) % wb.w;
    const wrapY = o.repeatY ? ((oy % wb.h) + wb.h) % wb.h : oy;
    r.parallax(b.buf, factor, factorY, wrapX, wrapY, o);
  }

  /**
   * After the background layers, before the terrain (SectionView's back hook): the far fog bands
   * and the backdrop's lightning flash. `density`: the runner's art density now.
   */
  drawBack(r: Renderer, tick: number, density: number): void {
    const want = atRes(density, r.res);
    const fog = this.cfg.fog;
    if (fog && this.fogFar) {
      const top = Math.max(0, Math.min(VIEW_H - 8, fog.top));
      // On a floor the far bands rise with the lifted backdrop (its depth behind the feet).
      const lift = this.floor ? this.floor.cam.yw - this.floor.cam.back : 0;
      this.drawLayer(r, this.fogFar, want, 0.22, this.fogX * 0.4 + 131, top - 10 - lift, fog.density * 0.8, this.layerOpts);
      this.drawLayer(r, this.fogFar, want, 0.5, this.fogX * 0.7, top - 2 - lift, fog.density * 0.75, this.layerOpts);
    }
    const f = this.flashAt(tick) * this.flashScale;
    if (f > 0.01) {
      this.flashOpts.alpha = f * BACK_FLASH;
      r.rect(0, 0, VIEW_W, VIEW_H, FLASH_COLOR, this.flashOpts);
    }
  }

  /** After the entities and the front decor, before the HUD: fog, darkness and lights, rain, flash. */
  draw(r: Renderer, tick: number, density: number): void {
    const want = atRes(density, r.res);
    const cfg = this.cfg;
    // 1. The near fog over the feet (in front of the entities, thin); on a floor, the ground mist
    //    (here only when `drawGround` does not lay it under the entities).
    const fog = cfg.fog;
    if (fog && this.floor) {
      if (!this.mistUnder) this.drawMist(r, want, fog.density, this.floor);
    } else if (fog && this.fogNear) {
      const top = Math.max(0, Math.min(VIEW_H - 8, fog.top));
      const nearTop = Math.round(top + (VIEW_H - top) * 0.3);
      this.drawLayer(r, this.fogNear, want, 1.2, this.fogX * 1.3 + 57, nearTop, fog.density * 0.6, this.layerOpts);
    }
    // 2. Darkness with the lights cut in, then their colour (a day section: none).
    const f = this.flashAt(tick) * this.flashScale;
    if (!cfg.day) {
      const dark = this.darkness * (1 - FLASH_LIFT * f);
      const glows = this.glows;
      const smooth = glows !== null && r.res >= 2;
      this.glowD = smooth ? atRes(density, r.res) : 0;
      const map = this.map;
      map.begin(Math.floor(r.camX), Math.floor(r.camY));
      if (glows) glows.begin();
      this.gatherLights(map, tick, r.camX);
      const glow = map.resolve(cfg.tint, dark);
      if (smooth && glows) {
        if (dark > 0.004) r.image(map.dark, map.ox, map.oy, this.darkOpts);
        // The map holds no colour in this mode: the glows are the dense frames.
        this.glowDrawn = glows.queued > 0;
        glows.flush(r);
      } else {
        if (dark > 0.004) r.image(map.dark, map.ox, map.oy, this.darkOpts);
        this.glowDrawn = glow;
        if (glow) r.image(map.glow, map.ox, map.oy, this.glowOpts);
      }
    }
    // 3. Rain: a far, slow sheet and a near, fast one (both wrap; the wind pushes them).
    const rain = cfg.rain;
    if (rain && this.rain) {
      const slant = rain.slant ?? 0.25;
      const vFar = 3.2;
      const vNear = 6.5;
      this.drawLayer(r, this.rain, want, 0.35, tick * vFar * slant + this.windX * 0.5 + 97, tick * vFar + 61, rain.density * 0.5, this.rainOpts, 0.35);
      this.drawLayer(r, this.rain, want, 1, tick * vNear * slant + this.windX, tick * vNear, rain.density * 0.85, this.rainOpts, 1);
    }
    // 4. The lightning flash over everything (the HUD comes after).
    if (f > 0.01) {
      this.flashOpts.alpha = f * VIEW_FLASH;
      r.rect(0, 0, VIEW_W, VIEW_H, FLASH_COLOR, this.flashOpts);
    }
  }

  /**
   * The ground mist under the entities (a floor only; the view's `floorHook`, before the contact
   * shadows and `world.draw`): it lies on the floor and the walk-plane decor, and the heroes stand
   * in it. Sets `mistUnder` (then `draw` leaves the mist out).
   */
  drawGround(r: Renderer, tick: number, density: number): void {
    this.mistUnder = true;
    const fog = this.cfg.fog;
    if (fog && this.floor) this.drawMist(r, atRes(density, r.res), fog.density, this.floor);
    // OAT (spec §8.1 steps 6–7): the water's dynamic reflections, then the actors' sun tails.
    if (this.reflections) this.reflections.draw(r, this.world, tick, this.floor);
    if (this.sunShadows) this.sunShadows.draw(r, this.world, atRes(density, r.res));
  }

  /**
   * A round light into the map: as always, or (the smooth glow) its cut in the map and its colour as
   * a dense glow frame.
   */
  private addLight(map: LightMap, x: number, y: number, r: number, intensity: number, color: Color, glow: number): void {
    const d = this.glowD;
    if (d === 0 || glow <= 0) {
      map.add(x, y, r, intensity, color, glow);
      return;
    }
    map.add(x, y, r, intensity, color, 0);
    (this.glows as GlowFrames).circle(x, y, r, color, glow * intensity, d);
  }

  /** An elliptical light (a pool, a streak dash) into the map, as `addLight`. */
  private addOval(map: LightMap, x: number, y: number, rx: number, ry: number, intensity: number, color: Color, glow: number, yMin: number): void {
    const d = this.glowD;
    if (d === 0 || glow <= 0) {
      map.addEllipse(x, y, rx, ry, intensity, color, glow, yMin);
      return;
    }
    map.addEllipse(x, y, rx, ry, intensity, color, 0, yMin);
    (this.glows as GlowFrames).ellipse(x, y, rx, ry, color, glow * intensity, d, yMin);
  }

  /**
   * The ground mist on a floor (docs/design/floor.md §3.8): one row of the mist texture per floor
   * row (two below the walk line, where the mist is thin), each scrolling at its row's speed s(y)
   * (line scroll) and drifting with the fog; alpha by `mistAlpha` × the fog's density. The rows are
   * drawn in world space, so they move in the renderer's 1/res steps like the floor under them
   * (spec §2.1: nothing on whole logical px), through the placer (no boxed doubles per row).
   */
  private drawMist(r: Renderer, want: 1 | 2 | 4, density: number, floor: SectionFloor): void {
    this.mistRows = 0;
    if (!this.mist) return;
    // At most 2× (a soft noise: the 4× one is a 32 ms art job and 2.6 MB for no visible gain).
    const b = this.buf(this.mist, want > MIST_MAX_DENSITY ? MIST_MAX_DENSITY : want);
    if (!b) return;
    let f = this.mistFrames.get(b.buf);
    if (!f) {
      f = { buf: b.buf, ox: 0, oy: 0, density: b.d };
      this.mistFrames.set(b.buf, f);
    }
    const cam = floor.cam;
    const m = this.mistCfg;
    const top = Math.max(0, Math.floor(cam.back - m.rise));
    const src = this.mistSrc;
    const o = this.mistOpts;
    const shift = this.fogX + r.camX;
    for (let y = top; y < VIEW_H; ) {
      const step = y < cam.yw + 4 ? 1 : 2;
      const a = density * mistAlpha(y + step / 2, cam.back, cam.yw, m);
      const row = Math.min(MIST_H - step, y - top);
      if (a > 0.004) {
        const s = sOfY(cam, Math.max(cam.back, y + step / 2));
        const off = (((shift * s) % FOG_W) + FOG_W) % FOG_W;
        src.y = row;
        src.h = step;
        o.alpha = Math.min(1, a);
        // World space: the row's screen y is y − camY (the shake), its x the scroll offset.
        const pl = this.placer;
        pl.x = r.camX - off;
        pl.y = y - row;
        pl.put(r, f, o);
        if (FOG_W - off < VIEW_W) {
          pl.x = r.camX + FOG_W - off;
          pl.y = y - row;
          pl.put(r, f, o);
        }
        this.mistRows++;
      }
      y += step;
    }
  }

  /** Every light of this frame into the map (culled to the view by the map). `camX`: the renderer's camera (the floor's shifts). */
  private gatherLights(map: LightMap, tick: number, camX: number): void {
    const cfg = this.cfg;
    const x0 = map.ox;
    const y0 = map.oy;
    const x1 = x0 + map.w;
    const y1 = y0 + map.h;
    const lamps = cfg.lamps;
    const floor = this.floor;
    const gix = this.lampGroupIx;
    const streak = this.streak;
    this.streakDashes = 0;
    if (lamps && floor) this.floorLamps(map, lamps, floor, tick, camX);
    else if (lamps) {
      for (let i = 0; i < lamps.length; i++) {
        const l = lamps[i];
        if (l.x + l.r < x0 || l.x - l.r > x1 || l.y + l.r < y0 || l.y - l.r > y1) {
          if (!(streak && l.streak && l.x + l.r >= x0 && l.x - l.r <= x1)) continue;
        }
        let k = flickerAt(l.flicker ?? 0, tick, i * 7 + 3);
        if (gix && gix[i] >= 0) {
          k *= this.groupK(gix[i], tick);
          if (k <= 0) continue;
        }
        this.addLight(map, l.x, l.y, l.r, (l.intensity ?? 1) * k, l.color, l.glow ?? LAMP_GLOW);
        if (streak && l.streak) this.addStreak(map, streak, l.x, l.y, -1, (l.intensity ?? 1) * k, l.color, tick, i * 13 + 5);
      }
    }
    const world = this.world;
    const spot = this.spot;
    const tagged = world.byTag(LIGHT_TAG);
    for (let i = 0; i < tagged.length; i++) {
      const e = tagged[i];
      if (e.removed || !isLightSource(e)) continue;
      spot.flicker = 0;
      spot.intensity = 1;
      spot.streak = false;
      if (!e.lightOf(spot, tick)) continue;
      let floorY = -1;
      if (floor && e.drawDepth !== 0) {
        // Drawn at a depth (render only): its light goes with it.
        floorShift(floor, spot.x, spot.y, e.drawDepth, camX, this.pt);
        spot.x = this.pt.x;
        spot.y = this.pt.y;
        floorY = floor.cam.yw - e.drawDepth;
      }
      if (spot.x + spot.r < x0 || spot.x - spot.r > x1 || spot.y + spot.r < y0 || spot.y - spot.r > y1) continue;
      this.addLight(map, spot.x, spot.y, spot.r, spot.intensity * flickerAt(spot.flicker, tick, e.id), spot.color, LAMP_GLOW);
      if (streak && spot.streak) this.addStreak(map, streak, spot.x, spot.y, floorY, spot.intensity, spot.color, tick, e.id);
    }
    const hero = cfg.heroLight ?? 0;
    if (hero > 0) {
      const ps = world.players;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        if (p.removed) continue;
        map.add(p.x, p.y - 14, hero, HERO_LIGHT, NEUTRAL, 0);
      }
    }
    const items = world.byTag('item');
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (e.removed) continue;
      map.add(e.x, e.y - 6, ITEM_R, ITEM_LIGHT, NEUTRAL, 0);
    }
    const ents = world.entities;
    for (let i = 0; i < ents.length; i++) {
      const e = ents[i];
      if (e instanceof FxEntity && !e.removed) this.fxLight(map, e);
    }
  }

  /**
   * The static lamps on a floor: each glow at its lamp's depth (the shift and speed of that depth,
   * so it stays on the lamp head), and its pool on the floor row of that depth, flickering with it.
   */
  private floorLamps(map: LightMap, lamps: readonly StaticLight[], floor: SectionFloor, tick: number, camX: number): void {
    const x0 = map.ox;
    const y0 = map.oy;
    const x1 = x0 + map.w;
    const y1 = y0 + map.h;
    const gix = this.lampGroupIx;
    const streak = this.streak;
    const depths = this.lampDepths;
    const pc = this.floorCfg?.pool;
    const pt = this.pt;
    const pool = this.pool;
    const yMin = floor.cam.back - 1;
    for (let i = 0; i < lamps.length; i++) {
      const l = lamps[i];
      const depth = depths ? depths[i] : 0;
      floorShift(floor, l.x, l.y, depth, camX, pt);
      let k = flickerAt(l.flicker ?? 0, tick, i * 7 + 3);
      if (gix && gix[i] >= 0) {
        k *= this.groupK(gix[i], tick);
        if (k <= 0) continue;
      }
      const glow = l.glow ?? LAMP_GLOW;
      if (!(pt.x + l.r < x0 || pt.x - l.r > x1 || pt.y + l.r < y0 || pt.y - l.r > y1)) this.addLight(map, pt.x, pt.y, l.r, (l.intensity ?? 1) * k, l.color, glow);
      if (streak && l.streak && pt.x + l.r >= x0 && pt.x - l.r <= x1) this.addStreak(map, streak, pt.x, pt.y, floor.cam.yw - depth, (l.intensity ?? 1) * k, l.color, tick, i * 13 + 5);
      if (!pc || pc.intensity <= 0) continue;
      floorPool(floor, l.x, depth, l.r * pc.radius, camX, pool);
      if (pool.x + pool.rx < x0 || pool.x - pool.rx > x1 || pool.y + pool.ry < y0 || pool.y - pool.ry > y1) continue;
      this.addOval(map, pool.x, pool.y, pool.rx, pool.ry, (l.intensity ?? 1) * k * pc.intensity, l.color, pc.glow, yMin);
    }
  }

  /** Muzzle flashes and blasts light the dark for a moment. */
  private fxLight(map: LightMap, e: FxEntity): void {
    const s = e.sprite;
    if (s.startsWith('fx/muzzle')) {
      if (e.t > 3) return;
      this.addLight(map, e.x, e.y, 22, 0.9, MUZZLE_COLOR, 0.5);
    } else if (s.startsWith('fx/explosion')) {
      const fade = 1 - e.t / 24;
      if (fade <= 0) return;
      const big = s.endsWith('-l') || s.endsWith('-xl');
      this.addLight(map, e.x, e.y, big ? 72 : 48, fade, BLAST_COLOR, 0.6 * fade);
    }
  }

  /**
   * OAT (spec §8.8 "Night streaks"): a light at world (x, y) mirrors on the water / wet rows
   * [y0, y1] (world y of the map's frame; `floorY` its floor row, −1: the walk plane): a column of
   * short dashes from above to below its mirror point, each a thin ellipse in the map (so the
   * smooth glow rounds them), swaying with a sine of its world row and the tick, fading away from the
   * mirror point. `key` decorrelates lights.
   */
  private addStreak(map: LightMap, st: StreakConfig, x: number, y: number, floorY: number, intensity: number, color: Color, tick: number, key: number): void {
    if (intensity <= 0.02) return;
    const camY = map.oy;
    const yTop = (st.y0 ?? STREAK_Y0) + camY;
    const yBot = (st.y1 ?? VIEW_H) + camY;
    if (yBot <= yTop) return;
    const ripple = Math.max(0, Math.min(1, st.ripple ?? STREAK_RIPPLE));
    const len = (st.length ?? STREAK_LEN) * (0.8 + 0.6 * ripple);
    const base = (floorY >= 0 ? floorY : G_WALK) + (st.level ?? STREAK_LEVEL);
    if (y >= base) return; // a light under the water plane does not mirror
    let c = 2 * base - y;
    if (c < yTop + 2) c = yTop + 2;
    if (c > yBot - 2) c = yBot - 2;
    const top = Math.max(yTop, c - len * 0.6);
    const bot = Math.min(yBot, c + len * 0.4);
    const amp = 0.4 + 1.6 * ripple;
    const s = (st.strength ?? STREAK_STRENGTH) * Math.min(1, intensity);
    // Dashes on a world-anchored grid of rows (they do not crawl when the camera moves up or down).
    for (let yy = Math.ceil(top / DASH_STEP) * DASH_STEP; yy < bot; yy += DASH_STEP) {
      const dist = Math.abs(yy - c) / len;
      if (dist >= 1) continue;
      // A gap in the column (a fixed pattern per light; ripple breaks it more).
      if (hash2(yy >> 1, key, 0x5b2) < 0.18 + 0.25 * ripple) continue;
      const sway = Math.sin(yy * 0.83 + tick * 0.045 + key) * amp * (0.4 + dist);
      const w = 1.2 + ripple * 2 + (yy - yTop) * 0.04 + hash2(yy >> 1, key, 0x2c9) * 1.4;
      const k = s * (1 - dist * dist) * (0.75 + 0.25 * Math.sin(tick * 0.03 + yy * 0.4 + key));
      this.addOval(map, x + sway, yy + 0.5, w, 0.75, k, color, 0.9, yTop);
      this.streakDashes++;
    }
  }
}
