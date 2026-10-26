/**
 * THE MISSION LIGHT PASS (docs/design/oldenzaal.md §10.1, §10.2; docs/api/oldenzaal.md §3).
 * Owner: LIGHT. An ADDITIVE OPT-IN: the runner makes a pass only for a section that registered a
 * light config (`defineSectionLight`, content/oldenzaal/kit/light-api.ts). Every other section
 * (ams, the ring, m0–m5, the first-person floors) has no pass: it simulates and draws exactly as
 * before (the pass never touches game state, `world.rng` or `world.fxRng`).
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
} from '../../content/oldenzaal/kit/light-api';
import { FxEntity } from '../../fx';
import { floorPool, floorShift, worldFloor, type FloorPoint, type FloorPool } from '../floor/hooks';
import { FramePlacer } from '../floor/place';
import type { SectionFloor } from '../floor/section-floor';
import type { SectionDef } from '../types';
import { DEFAULT_MIST, floorLightOf, mistAlpha, type FloorLightConfig, type MistConfig } from './floor';
import { LightMap } from './lightmap';

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
const FLASH_COLOR: Color = 0xdfeaffff;
/** Hero light: no colour, this strength. Pickups: a faint pool. */
const HERO_LIGHT = 0.8;
const ITEM_R = 18;
const ITEM_LIGHT = 0.6;
const MUZZLE_COLOR: Color = 0xf8c055ff; // PAL_HD_OZ.candle[5]
const BLAST_COLOR: Color = 0xe19529ff; // PAL_HD_OZ.candle[4]
const NEUTRAL: Color = 0xffffffff;

/** Fog / rain tile sizes (logical px). */
const FOG_W = 512;
/** The ground mist's texture rows (a floor only: from the mist's top to the view's bottom). */
const MIST_H = 80;
/** The ground mist's highest density (its 4× build is one 32 ms art job: integration, wave A). */
const MIST_MAX_DENSITY = 2;
const RAIN_W = 192;
const RAIN_H = 216;

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
  private readonly spot: LightSpot = { x: 0, y: 0, r: 0, color: NEUTRAL, intensity: 1, flicker: 0 };
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
    // 2. Darkness with the lights cut in, then their colour.
    const f = this.flashAt(tick) * this.flashScale;
    const dark = this.darkness * (1 - FLASH_LIFT * f);
    const map = this.map;
    map.begin(Math.floor(r.camX), Math.floor(r.camY));
    this.gatherLights(tick, r.camX);
    const glow = map.resolve(cfg.tint, dark);
    if (dark > 0.004) r.image(map.dark, map.ox, map.oy, this.darkOpts);
    this.glowDrawn = glow;
    if (glow) r.image(map.glow, map.ox, map.oy, this.glowOpts);
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
  drawGround(r: Renderer, _tick: number, density: number): void {
    this.mistUnder = true;
    const fog = this.cfg.fog;
    if (fog && this.floor) this.drawMist(r, atRes(density, r.res), fog.density, this.floor);
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
  private gatherLights(tick: number, camX: number): void {
    const map = this.map;
    const cfg = this.cfg;
    const x0 = map.ox;
    const y0 = map.oy;
    const x1 = x0 + map.w;
    const y1 = y0 + map.h;
    const lamps = cfg.lamps;
    const floor = this.floor;
    if (lamps && floor) this.floorLamps(lamps, floor, tick, camX);
    else if (lamps) {
      for (let i = 0; i < lamps.length; i++) {
        const l = lamps[i];
        if (l.x + l.r < x0 || l.x - l.r > x1 || l.y + l.r < y0 || l.y - l.r > y1) continue;
        const k = flickerAt(l.flicker ?? 0, tick, i * 7 + 3);
        map.add(l.x, l.y, l.r, (l.intensity ?? 1) * k, l.color, l.glow ?? LAMP_GLOW);
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
      if (!e.lightOf(spot, tick)) continue;
      if (floor && e.drawDepth !== 0) {
        // Drawn at a depth (render only): its light goes with it.
        floorShift(floor, spot.x, spot.y, e.drawDepth, camX, this.pt);
        spot.x = this.pt.x;
        spot.y = this.pt.y;
      }
      if (spot.x + spot.r < x0 || spot.x - spot.r > x1 || spot.y + spot.r < y0 || spot.y - spot.r > y1) continue;
      map.add(spot.x, spot.y, spot.r, spot.intensity * flickerAt(spot.flicker, tick, e.id), spot.color, LAMP_GLOW);
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
      if (e instanceof FxEntity && !e.removed) this.fxLight(e);
    }
  }

  /**
   * The static lamps on a floor: each glow at its lamp's depth (the shift and speed of that depth,
   * so it stays on the lamp head), and its pool on the floor row of that depth, flickering with it.
   */
  private floorLamps(lamps: readonly StaticLight[], floor: SectionFloor, tick: number, camX: number): void {
    const map = this.map;
    const x0 = map.ox;
    const y0 = map.oy;
    const x1 = x0 + map.w;
    const y1 = y0 + map.h;
    const depths = this.lampDepths;
    const pc = this.floorCfg?.pool;
    const pt = this.pt;
    const pool = this.pool;
    const yMin = floor.cam.back - 1;
    for (let i = 0; i < lamps.length; i++) {
      const l = lamps[i];
      const depth = depths ? depths[i] : 0;
      floorShift(floor, l.x, l.y, depth, camX, pt);
      const k = flickerAt(l.flicker ?? 0, tick, i * 7 + 3);
      const glow = l.glow ?? LAMP_GLOW;
      if (!(pt.x + l.r < x0 || pt.x - l.r > x1 || pt.y + l.r < y0 || pt.y - l.r > y1)) map.add(pt.x, pt.y, l.r, (l.intensity ?? 1) * k, l.color, glow);
      if (!pc || pc.intensity <= 0) continue;
      floorPool(floor, l.x, depth, l.r * pc.radius, camX, pool);
      if (pool.x + pool.rx < x0 || pool.x - pool.rx > x1 || pool.y + pool.ry < y0 || pool.y - pool.ry > y1) continue;
      map.addEllipse(pool.x, pool.y, pool.rx, pool.ry, (l.intensity ?? 1) * k * pc.intensity, l.color, pc.glow, yMin);
    }
  }

  /** Muzzle flashes and blasts light the dark for a moment. */
  private fxLight(e: FxEntity): void {
    const s = e.sprite;
    if (s.startsWith('fx/muzzle')) {
      if (e.t > 3) return;
      this.map.add(e.x, e.y, 22, 0.9, MUZZLE_COLOR, 0.5);
    } else if (s.startsWith('fx/explosion')) {
      const fade = 1 - e.t / 24;
      if (fade <= 0) return;
      const big = s.endsWith('-l') || s.endsWith('-xl');
      this.map.add(e.x, e.y, big ? 72 : 48, fade, BLAST_COLOR, 0.6 * fade);
    }
  }
}
