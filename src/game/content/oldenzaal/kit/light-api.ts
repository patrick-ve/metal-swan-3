/**
 * THE LIGHT CONTRACT of mission `oldenzaal` (docs/design/oldenzaal.md §10; docs/api/oldenzaal.md
 * "Light"). CORE wrote it; the LIGHT builder implements the pass behind it; TOWN, POSSESSED and
 * WUGHOST use it. Keep it small: types, a section registry and three no-op-safe calls.
 *
 * 1. A SECTION OPTS IN: `defineSectionLight('oz-a', { darkness: 0.45, tint, fog, lamps, … })`
 *    (the section file does it at import time). A section without a config draws exactly as
 *    today (ams, the ring and every other mission never register one). The pass reads
 *    `sectionLight(section.id)` when a section loads.
 * 2. AN ENTITY GIVES LIGHT: it carries the tag `LIGHT_TAG` ('oz-light') and implements
 *    `LightSource.lightOf(out, tick)`: it fills `out` (world px) and returns true while it shines.
 *    The pass calls it once per drawn frame for every live tagged entity in or near the view and
 *    reuses one `LightSpot` record (no allocation per frame). `isLightSource(e)` checks both.
 * 3. STATIC LIGHTS (street lamps, De Smulhoek's windows, candles in decor) are listed in the
 *    config (`lamps`): no entity needed.
 * 4. SCRIPTS: `lightning(world, strength)` flashes now (oz-c, oz-d set pieces, the ghost's
 *    entrance), `setDarkness(world, d, fadeTicks)` changes the darkness (dusk → night inside a
 *    section). Both do nothing while no pass is bound to the world (`bindLightControl`).
 *
 * Everything here is cosmetic: the pass draws, it never changes game state, and its randomness
 * (flicker, the lightning schedule) uses `world.fxRng` or a hash of the tick (determinism rule).
 * Imports are type-only, so the runner side (src/game/mission/…) may import this module.
 */
import type { Color } from '../../../../engine/color';
import type { Entity } from '../../../../engine/entity';
import type { World } from '../../../../engine/world';

/** The tag of an entity that gives light (ids.ts `OZ_LIGHT.tag`). */
export const LIGHT_TAG = 'oz-light';

/** One light as the pass draws it (world px; the record is reused, fill every field). */
export interface LightSpot {
  /** Centre, world px. */
  x: number;
  y: number;
  /** Radius of the glow, logical px (the light fades to 0 at r). */
  r: number;
  /** The light's colour (a PAL / PAL_HD / PAL_HD_OZ colour; the pass adds it). */
  color: Color;
  /** 0..1 strength (default the pass's 1). */
  intensity: number;
  /** 0 = steady … 1 = a dying fluorescent tube (the pass flickers it with fxRng / the tick). */
  flicker: number;
}

/** An entity that gives light (tag `LIGHT_TAG`). */
export interface LightSource {
  /** Fill `out` with this frame's light; false = dark this frame (no light drawn). */
  lightOf(out: LightSpot, tick: number): boolean;
}

/** Does `e` give light (the tag and the method)? */
export function isLightSource(e: Entity): e is Entity & LightSource {
  return e.hasTag(LIGHT_TAG) && typeof (e as Partial<LightSource>).lightOf === 'function';
}

/** A light that never moves (decor lamps, windows, candles): world px. */
export interface StaticLight {
  x: number;
  y: number;
  r: number;
  color: Color;
  /** Default 1. */
  intensity?: number;
  /** Default 0 (steady). */
  flicker?: number;
  /**
   * LIGHT (added): the share of the light's colour the pass adds on top (the warm pool and halo;
   * default 0.4). 0 = the light only lifts the darkness (no colour).
   */
  glow?: number;
}

/** Drifting ground fog (parallax bands in front of the backdrop, behind or over the floor). */
export interface FogConfig {
  /** 0..1 thickness. */
  density: number;
  /** The fog's colour (a cold grey-green / blue). */
  color: Color;
  /** Screen y of the fog's top edge (logical px, 0..216; the bands fill down from it). */
  top: number;
  /** Drift, px per tick (negative = left). */
  drift?: number;
}

/** Rain streaks (oz-e storm; light drizzle elsewhere). */
export interface RainConfig {
  /** 0..1 amount. */
  density: number;
  /** Slant, x px per y px (wind). */
  slant?: number;
  color?: Color;
}

/** The lightning schedule (cosmetic; the thunder sfx `oz/env/thunder` follows the flash). */
export interface LightningConfig {
  /** Ticks between flashes: a random value in [min, max] (fxRng). */
  every: readonly [number, number];
  /** 0..1 flash strength. */
  strength?: number;
  /** A second flash shortly after the first, with this chance (0..1). */
  double?: number;
}

/** A section's light (defineSectionLight). */
export interface SectionLight {
  /**
   * 0 = daylight (no overlay) … 1 = black. The overlay is a full-view rect of `tint` at this
   * alpha drawn after the entities and the front decor, before the HUD; lights cut into it.
   * The squad and the pickups must stay readable (spec §10.1): keep it ≤ 0.7.
   */
  darkness: number;
  /** The darkness colour (a deep cold blue / violet, e.g. PAL_HD_OZ.night[1]). */
  tint: Color;
  /** Lights that never move. */
  lamps?: readonly StaticLight[];
  fog?: FogConfig;
  rain?: RainConfig;
  lightning?: LightningConfig;
  /**
   * The players carry a faint light of this radius (logical px; 0 / unset = none): the
   * readability floor in the darkest sections.
   */
  heroLight?: number;
  /**
   * LIGHT (added): wind gusts, 0..1 (default 0.5 with rain, else 0): a gust drives the rain and
   * the fog sideways for a few seconds (cosmetic; a smooth function of the tick).
   */
  wind?: number;
}

const sections = new Map<string, SectionLight>();

/**
 * Register (or replace) the light of a section id (`'oz-a'` …; section ids of this mission are
 * unique in the game). Returns the config.
 */
export function defineSectionLight(sectionId: string, cfg: SectionLight): SectionLight {
  sections.set(sectionId, cfg);
  return cfg;
}

/** The light of a section id, or undefined (= no light pass: the section draws as today). */
export function sectionLight(sectionId: string): SectionLight | undefined {
  return sections.get(sectionId);
}

// ---------------------------------------------------------------------------------------------
// Script control (bound by the LIGHT pass to its world)
// ---------------------------------------------------------------------------------------------

/** What the pass offers to scripts. */
export interface LightControl {
  /** Flash now (0..1; default 1) — a lightning bolt, a ghost's entrance. */
  flash(strength?: number): void;
  /** Move the darkness to `d` over `fadeTicks` (default 60). */
  setDarkness(d: number, fadeTicks?: number): void;
}

const controls = new WeakMap<World, LightControl>();

/** The pass binds itself to the world it lights (null unbinds). LIGHT calls this. */
export function bindLightControl(world: World, ctl: LightControl | null): void {
  if (ctl) controls.set(world, ctl);
  else controls.delete(world);
}

/** The bound control, or null (no light pass for this world / section). */
export function lightControl(world: World): LightControl | null {
  return controls.get(world) ?? null;
}

/** A lightning flash now; nothing without a light pass. */
export function lightning(world: World, strength = 1): void {
  controls.get(world)?.flash(strength);
}

/** Change the darkness (0..1) over `fadeTicks`; nothing without a light pass. */
export function setDarkness(world: World, d: number, fadeTicks = 60): void {
  controls.get(world)?.setDarkness(d, fadeTicks);
}
