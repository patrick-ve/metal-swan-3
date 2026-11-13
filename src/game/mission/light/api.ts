/**
 * THE LIGHT CONTRACT of the mission light pass (docs/design/oldenzaal.md §10; docs/api/oldenzaal.md
 * "Light"; the opt-in flags came with the former level 2, docs/design/oat.md (deleted; git show eb3316a)
 * §8.3–§8.9). Moved here from `content/oldenzaal/kit/light-api.ts`, which re-exports it unchanged: a
 * neutral home for every mission (oldenzaal, sewers). The pass behind it is pass.ts; the section and
 * entity builders use it. Keep it small: types, two section registries and a few no-op-safe calls.
 *
 * 1. A SECTION OPTS IN: `defineSectionLight('oz-a', { darkness: 0.45, tint, fog, lamps, … })`
 *    (the section file does it at import time). A section without a config draws exactly as
 *    today (ams, the ring and every other mission never register one). The pass reads
 *    `sectionLight(section.id)` when a section loads. Section ids are global keys: a mission's
 *    ids must be unique in the game (`oz-…`, `sewers-…`; never ams's bare `a` … `d`).
 * 2. AN ENTITY GIVES LIGHT: it carries the tag `LIGHT_TAG` ('oz-light': the historical name, kept
 *    for every mission) and implements `LightSource.lightOf(out, tick)`: it fills `out` (world px)
 *    and returns true while it shines. The pass calls it once per drawn frame for every live tagged
 *    entity in or near the view and reuses one `LightSpot` record (no allocation per frame).
 *    `isLightSource(e)` checks both.
 * 3. STATIC LIGHTS (street lamps, windows, candles, neon in decor) are listed in the config
 *    (`lamps`): no entity needed.
 * 4. SCRIPTS: `lightning(world, strength)` flashes now, `setDarkness(world, d, fadeTicks)` changes
 *    the darkness; the opt-ins `lampGroup(world, name, state)` (a group of lamps on, off or
 *    flickering out) and `crossFadeLight(world, set, ticks)` (the strips' and floor's lit / dark
 *    bakes, the 03:00 switch). All do nothing while no pass is bound to the world (`bindLightControl`)
 *    or the pass does not implement them.
 * 5. THE SUN (ADDITIVE): `defineSectionSun('xyz-a', { elevation, yaw, color, key })`
 *    gives a day section its sun (no light pass needed: painters read it at paint time — the façade
 *    strips, the floor, the backdrops, the contact shadows). A section without one keeps today's
 *    fixed key light. `sunFloorShadow` / `sunWallShadow` are the spec's shadow offsets.
 *
 * The opt-in flags of `SectionLight` (`glow`, `streaks`, `groups`, `bakes`, `day`, `water`,
 * `sunShadows`) and of `StaticLight` (`group`, `streak`) are OPTIONAL with today's behaviour as their
 * default, so oldenzaal's configs (which set none of them) light every frame exactly as before.
 *
 * Everything here is cosmetic: the pass draws, it never changes game state, and its randomness
 * (flicker, the lightning schedule) uses `world.fxRng` or a hash of the tick (determinism rule).
 * Imports are type-only, so the runner side (src/game/mission/…) may import this module.
 */
import type { Color } from '../../../engine/color';
import type { Entity } from '../../../engine/entity';
import type { Renderer } from '../../../engine/render';
import type { World } from '../../../engine/world';
import type { SunDef } from '../../art/hd/light';
import type { ReflectConfig } from '../floor/reflect';
import type { LitMask } from './litmask';

/** The tag of an entity that gives light (oldenzaal ids.ts `OZ_LIGHT.tag`; every mission uses it). */
export const LIGHT_TAG = 'oz-light';

/** One light as the pass draws it (world px; the record is reused, fill every field). */
export interface LightSpot {
  /** Centre, world px. */
  x: number;
  y: number;
  /** Radius of the glow, logical px (the light fades to 0 at r). */
  r: number;
  /** The light's colour (a PAL / PAL_HD / PAL_HD_OZ / PAL_HD_OAT colour; the pass adds it). */
  color: Color;
  /** 0..1 strength (default the pass's 1). */
  intensity: number;
  /** 0 = steady … 1 = a dying fluorescent tube (the pass flickers it with fxRng / the tick). */
  flicker: number;
  /**
   * OPT-IN: this light mirrors as a night streak on water and wet floor (a section
   * with `streaks`). The pass sets it to false before each `lightOf` call; a source sets it to true.
   */
  streak?: boolean;
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

/** A light that never moves (decor lamps, windows, candles, neon): world px. */
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
  /** OPT-IN: the lamp group it belongs to (`SectionLight.groups`; default: none, always on). */
  group?: string;
  /** OPT-IN: it mirrors as a night streak on water and wet floor (a section with `streaks`). */
  streak?: boolean;
  /**
   * OPT-IN (a lamp painted on a parallax plane of a canal scene, docs/api/canal.md "A lit section"):
   * the plane's speed s; `x` is the lamp's world x on that plane (the kit's `sec.put` x), and the pass
   * places it each frame where the plane shows it: camX + 192 + (x − 192 − camX) · s. Default 1 (a
   * section with a perspective floor uses `FloorLightConfig.lampDepth` instead).
   */
  speed?: number;
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

/** OPT-IN: the night streaks below lights with `streak: true`. */
export interface StreakConfig {
  /** Screen y range where streaks may fall (the water and wet floor quads; default the floor band). */
  y0?: number;
  y1?: number;
  /** Streak length, logical px (default the pass's; longer with more ripple). */
  length?: number;
  /** 0..1 strength of the dashes (additive; default the pass's). */
  strength?: number;
  /**
   * The water plane, logical px below the light's floor row (the walk plane without a floor; default
   * 6): a light h px over it mirrors at h px below it (then clamped into [y0, y1]).
   */
  level?: number;
  /** 0..1 ripple: wider, longer, more broken dashes (default 0.5). */
  ripple?: number;
}

/**
 * OPT-IN: the cast shadow of every hero, enemy and npc in a day section,
 * a tail from the feet stretched along the sun's floor direction, drawn on the floor before the
 * floor's own contact ovals (which stay: the ambient contact under the feet). Screen px per px of
 * the caster's height; a floor only.
 */
export interface SunShadowConfig {
  /** To the right (h · cot e · cos yaw at true scale). */
  along: number;
  /** Up the screen (the back part h · cot e · sin yaw through the floor camera). */
  up: number;
  /** 0..1 alpha of the tail's core (default 0.4: shade ≤ 1.5 tones, spec §8.4). */
  strength?: number;
  /** 0..1 sun at the feet (world x, y; the section's shade model): no tail in shade. Default 1. */
  lit?: (x: number, y: number) => number;
}

/** The state of a lamp group (spec §6.9: the neon goes out group by group). */
export type LampGroupState = 'on' | 'off' | 'flicker';

/** OPT-IN: a named group of lamps (`StaticLight.group`) a script switches. */
export interface LampGroupDef {
  name: string;
  /** The state at section load (default 'on'). */
  state?: LampGroupState;
  /** A 'flicker' lasts a random number of ticks in this range, then the group is off (default [20, 40]). */
  flicker?: readonly [number, number];
}

/** The light set of the baked strips and floor (spec §8.9: the 03:00 switch has a lit and a dark bake). */
export type LightSetId = 'lit' | 'dark';

/** OPT-IN: the arena's two bakes and their cross-fade. */
export interface BakeConfig {
  /** World x range that has a dark bake (the arena view plus its margin). */
  x0: number;
  x1: number;
  /** The set at section load (default 'lit'). */
  start?: LightSetId;
  /** Cross-fade length, ticks (default 60). */
  fadeTicks?: number;
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
  /**
   * OPT-IN: the glow shape at 2× / 4×. 'block' (default) = today's light map;
   * 'smooth' = round, smoothed glows (1× stays per pixel either way).
   */
  glow?: 'block' | 'smooth';
  /** OPT-IN: night streaks below the lights marked `streak` (default off). */
  streaks?: boolean | StreakConfig;
  /** OPT-IN: the lamp groups (default none: every lamp is always on). */
  groups?: readonly LampGroupDef[];
  /** OPT-IN: the lit / dark bakes of the strips and floor and their cross-fade (default none). */
  bakes?: BakeConfig;
  /**
   * OPT-IN: a DAY section: no darkness and no light map at all; the pass
   * only draws the ground overlays (`water`, `sunShadows`) under the entities. `darkness` is ignored.
   */
  day?: boolean;
  /** OPT-IN: dynamic reflections in these water bands (mission/floor/reflect.ts; a floor only). */
  water?: ReflectConfig;
  /** OPT-IN: sun-stretched cast shadows of the actors (a floor only). */
  sunShadows?: SunShadowConfig;
  /**
   * OPT-IN (mission sewers, docs/design/sewers.md §5.1): every living hero's FLASHLIGHT cone
   * (./cone.ts: from the muzzle along the aim, the battery's longer cone) cuts the darkness, and
   * the sim's light test (`flashlightsOn`, cone.ts `litByHeroes`) sees it. `true`: on from the
   * section start; `{ off: true }`: off until a script calls `setFlashlights(world, true)`.
   * Default: no cones.
   */
  cones?: boolean | ConeConfig;
  /**
   * OPT-IN (mission sewers): EMITTERS that skip the darkness, drawn by the pass right after the
   * darkness and the lights' colour (world space): e.g. the rat eyes, which must stay bright in the
   * dark. Draw only (never change game state). Default: none.
   */
  emissive?: (world: World, r: Renderer) => void;
  /**
   * OPT-IN (mission sewers, docs/design/sewers.md §5.1 "Art (L5)", docs/api/canal.md "A lit
   * section"): 'entities' — the ENTITY-ONLY mode. While the section draws a baked canal scene, the
   * scenery's darkness is painted (the ambient stack, and the lit stack inside the cones and glows:
   * the scene asks the pass for the lit mask, `LightControl.litMask`), so the darkness outside the
   * cones and glows lands on the entities only (they draw into the renderer's layer, the pass
   * darkens the layer's own pixels and draws it over the scenery, then the `over` layers come), never
   * on the scenery again; additive draws (fire glow, beams) and the emitters (`emissive`,
   * `emitSprites`, `emitTags`) skip it. Without a live scene (`?canal=0`, no source, a failed file,
   * a renderer without the layer) the pass darkens everything as 'all' (the default) does.
   */
  scope?: 'all' | 'entities';
  /**
   * OPT-IN with scope 'entities': EMITTERS by sprite id prefix (fx and shots: muzzle flashes, the
   * slime) that the pass draws again after the darkness (full colour), like `emissive`.
   */
  emitSprites?: readonly string[];
  /** OPT-IN with scope 'entities': EMITTERS by tag (the pickups' glints), drawn again after the darkness. */
  emitTags?: readonly string[];
}

/** The flashlight cones of a section (`SectionLight.cones`). */
export interface ConeConfig {
  /** Off at the section start (a script switches them on: `setFlashlights`). */
  off?: boolean;
  /** 0..1 share of the warm colour the cones add on top (default the pass's). */
  glow?: number;
}

const sections = new Map<string, SectionLight>();

/**
 * Register (or replace) the light of a section id (`'oz-a'`, `'sewers-c'` …; section ids of these
 * missions are unique in the game). Returns the config.
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
// The sun per section (additive: a section without one keeps today's fixed key)
// ---------------------------------------------------------------------------------------------

/**
 * A day section's sun (spec §8.3 table). The sun is a game convention: always LEFT and in front of
 * the façades (the camera side), so its shadows fall right and toward the back.
 */
export interface SectionSun {
  /** Elevation e above the horizon, degrees (e.g. 32 for a morning street, 15 for golden hour). */
  elevation: number;
  /** Yaw from the façade plane toward the camera, degrees (e.g. 30–45). */
  yaw: number;
  /** The sun's colour (a guide for the lit tones; spec §8.3 Kelvin column). */
  color: Color;
  /** The HD canvas key light of this sun (`sunFrom(elevation, yaw)`, art/hd/light.ts). */
  key: SunDef;
  /** Optional: the elevation at the section's end (a sun that sinks during an auto-scroll). */
  elevationEnd?: number;
}

const suns = new Map<string, SectionSun>();

/** Register (or replace) the sun of a section id. Returns it. */
export function defineSectionSun(sectionId: string, sun: SectionSun): SectionSun {
  suns.set(sectionId, sun);
  return sun;
}

/** The sun of a section id, or undefined (= today's fixed key light: `KEY` in art/hd/light.ts). */
export function sectionSun(sectionId: string): SectionSun | undefined {
  return suns.get(sectionId);
}

const DEG = Math.PI / 180;

/**
 * The floor shadow of a point at height h (spec §8.3): Δu = h · cot e · cos yaw (to the right) and
 * Δv = −h · cot e · sin yaw (v grows toward the camera, so the shadow falls toward the back). Any
 * unit in, the same unit out (metres; the caller converts with the band's scale). Writes `out`.
 */
export function sunFloorShadow(sun: Pick<SectionSun, 'elevation' | 'yaw'>, h: number, out: { du: number; dv: number }): { du: number; dv: number } {
  const k = h / Math.tan(sun.elevation * DEG);
  out.du = k * Math.cos(sun.yaw * DEG);
  out.dv = -k * Math.sin(sun.yaw * DEG);
  return out;
}

/**
 * The shadow a protrusion of depth d casts on its own wall (spec §8.3): Δx = d · cot yaw (right)
 * and Δy = d · tan e / sin yaw (down). Writes `out`.
 */
export function sunWallShadow(sun: Pick<SectionSun, 'elevation' | 'yaw'>, d: number, out: { dx: number; dy: number }): { dx: number; dy: number } {
  out.dx = d / Math.tan(sun.yaw * DEG);
  out.dy = (d * Math.tan(sun.elevation * DEG)) / Math.sin(sun.yaw * DEG);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Script control (bound by the light pass to its world)
// ---------------------------------------------------------------------------------------------

/** What the pass offers to scripts. */
export interface LightControl {
  /** Flash now (0..1; default 1) — a lightning bolt, a ghost's entrance. */
  flash(strength?: number): void;
  /** Move the darkness to `d` over `fadeTicks` (default 60). */
  setDarkness(d: number, fadeTicks?: number): void;
  /** OPT-IN: switch a lamp group ('flicker' = flicker for the group's ticks, then off). */
  group?(name: string, state: LampGroupState): void;
  /** OPT-IN: cross-fade the strips' and floor's light set over `fadeTicks` (default the bake's 60). */
  lightSet?(set: LightSetId, fadeTicks?: number): void;
  /** OPT-IN: the dark bake's share now, 0 (lit) … 1 (dark): the floor's bake reads it. */
  bakeMix?(): number;
  /** The section's light config (the sim's light test reads `cones` and `heroLight`). */
  readonly cfg?: SectionLight;
  /** OPT-IN: switch the heroes' flashlight cones on or off (a section with `cones`). */
  flashlights?(on: boolean): void;
  /** OPT-IN: are the flashlight cones on now? */
  flashlightsOn?(): boolean;
  /**
   * OPT-IN (scope 'entities'): this frame's LIT MASK at the canal's draw density d (the heroes'
   * cones, spill and glow; ./litmask.ts), or null (nothing lit, or not this mode). The canal scene
   * asks for it in its back pass, before the entities.
   */
  litMask?(r: Renderer, d: number): LitMask | null;
  /**
   * OPT-IN (scope 'entities'): the canal scene's back pass is done: the entities draw into the
   * renderer's layer from now on. False: no layer (the pass darkens everything later).
   */
  entitiesBegin?(r: Renderer, tick?: number, density?: number): boolean;
  /**
   * OPT-IN (scope 'entities'): close the entity layer now (the darkness on its pixels, the layer
   * drawn), so an entity can be drawn like the scenery in between; `entitiesReopen` opens it again.
   */
  entitiesFlush?(r: Renderer): void;
  entitiesReopen?(r: Renderer): void;
  /**
   * OPT-IN (scope 'entities'): before the scene's `over` layers: the darkness on the entity layer's
   * own pixels, the layer over the scenery, the lights' colour. Nothing when no layer is open.
   */
  entitiesEnd?(r: Renderer, tick: number, density: number): void;
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

/** Switch a lamp group; nothing without a pass that has groups. */
export function lampGroup(world: World, name: string, state: LampGroupState): void {
  controls.get(world)?.group?.(name, state);
}

/** Cross-fade to the lit or the dark bake; nothing without a pass that has bakes. */
export function crossFadeLight(world: World, set: LightSetId, fadeTicks?: number): void {
  controls.get(world)?.lightSet?.(set, fadeTicks);
}

/**
 * The dark bake's share of the 03:00 cross-fade now (0 lit … 1 dark; 0 without a pass with bakes):
 * the hook for the floor's two bakes (the strips get it pushed: `setStripDarkMix`).
 */
export function lightSetMix(world: World): number {
  return controls.get(world)?.bakeMix?.() ?? 0;
}

/** Switch the heroes' flashlight cones on or off; nothing without a pass with `cones`. */
export function setFlashlights(world: World, on: boolean): void {
  controls.get(world)?.flashlights?.(on);
}

/** Are the heroes' flashlight cones on now (false without a pass with `cones`)? */
export function flashlightsOn(world: World): boolean {
  return controls.get(world)?.flashlightsOn?.() ?? false;
}
