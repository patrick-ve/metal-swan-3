/**
 * The rally's content registry (docs/api/rally.md "A. Wave A contracts"): the lazy content
 * (src/game/content/rally/, loaded by the card or the glitch scene, never at boot) registers its
 * track and car models here at import time; the runner, the scenes and the tools read them. A
 * later definition with the same id replaces the earlier one. Built objects are kept (one build
 * per process: the track and the models come from pure code, the same every time).
 */
import type { Renderer } from '../../engine/render';
import type { Cam3, DrawItem, Mesh3, TexturePage, View3d } from '../../engine/view3d';
import type { CarSpec, CarState, RallyModel, RallyTrack } from './api';
import type { Daylight } from './daylight';
import type { RallyRunner } from './runner';

export interface RallyTrackDef {
  readonly id: string;
  build(): RallyTrack;
}

export interface RallyModelDef {
  readonly id: string;
  build(): RallyModel;
}

let trackDef: RallyTrackDef | null = null;
let track: RallyTrack | null = null;
const modelDefs = new Map<string, RallyModelDef>();
const models = new Map<string, RallyModel>();

/** Register the track (replaces the one before; the built copy is dropped). */
export function defineRallyTrack(def: RallyTrackDef): void {
  trackDef = def;
  track = null;
}

/** Is a track registered (the rally content loaded)? */
export function hasRallyTrack(): boolean {
  return trackDef !== null;
}

/** The track, built once. Throws when the rally content is not loaded. */
export function rallyTrack(): RallyTrack {
  if (!track) {
    if (!trackDef) throw new Error('[rally] no track registered (the rally content is not loaded)');
    track = trackDef.build();
  }
  return track;
}

/** Register a car model (replaces one with the same id). */
export function defineRallyModel(def: RallyModelDef): void {
  modelDefs.set(def.id, def);
  models.delete(def.id);
}

export function hasRallyModel(id: string): boolean {
  return modelDefs.has(id);
}

/** A car model, built once; null when it is not registered. */
export function rallyModel(id: string): RallyModel | null {
  let m = models.get(id) ?? null;
  if (m) return m;
  const def = modelDefs.get(id);
  if (!def) return null;
  m = def.build();
  models.set(id, m);
  return m;
}

/** The registered model ids (sorted). */
export function listRallyModels(): string[] {
  return [...modelDefs.keys()].sort();
}

// ---------------------------------------------------------------------------------------------
// Wave B (PREP, additive; docs/api/rally.md "B.6"): the plug-ins of the lazy content. The race's
// new parts live in src/game/content/rally/** (lazy, lead note 6), so the runner and the scene
// (static, the main chunk) find them here. Every list is ordered by `order`, then `id`; a later
// definition with the same id replaces the earlier one; `undefineRally(id)` removes one (tests).
// ---------------------------------------------------------------------------------------------

/** A part of the race sim (FIELD's traffic, RULES' director, cameras, police): installed into every new runner. */
export interface RallySystemDef {
  readonly id: string;
  /** Lower first: the install order is the step order of the systems it adds (FIELD 100–199, RULES 200–299). */
  readonly order?: number;
  /**
   * Called at the END of the runner's constructor (the grid is set, nothing has stepped): add the
   * systems (`runner.addSystem`), bodies (`runner.addBody`) and listeners (`runner.events.on`).
   * Deterministic (spec §12.4): `runner.rng` (or a fork) for gameplay, `runner.fxRng` for cosmetics.
   * It must cope with any track (a test track has no gantries, cameras or zones).
   */
  install(runner: RallyRunner): void;
}

/** A rival of the grid (FIELD's rally teams): its car and its share of the difficulty's pace. */
export interface RivalEntry {
  readonly spec: CarSpec;
  readonly pace: number;
}

/** The rally teams (FIELD): the rivals of a race, in grid order. */
export interface RallyTeamsDef {
  readonly id: string;
  /** `count` rivals (7 in 1P, 6 in 2P), in grid order; fewer = the runner repeats from the start. */
  rivals(count: number): readonly RivalEntry[];
}

/** What a scenery part draws with in one view (the scene fills it every frame; cosmetic). */
export interface RallyDrawCtx {
  readonly runner: RallyRunner;
  /** The player view: 0 (1P, P1) or 1 (P2). */
  readonly view: number;
  readonly cam: Readonly<Cam3>;
  /** The view's width / height. */
  readonly aspect: number;
  /** The draw distance (the fog's far end, m). */
  readonly far: number;
  /** The time of day (one world time for both views). */
  readonly day: Readonly<Daylight>;
  /** The scene's frame counter (cosmetic animation: blinking, the oncoming traffic). */
  readonly t: number;
  /** The 3D view (dynamic meshes: `updateMesh`). */
  readonly v3: View3d;
}

/** The drawn world beyond the track: WORLD's sections, landmarks, signs and lights; FIELD's oncoming decor traffic. */
export interface RallyScenery {
  /** Uploaded once with the track (the scene releases them on exit). */
  readonly meshes: readonly Mesh3[];
  readonly pages: readonly TexturePage[];
  /**
   * Append this view's items to `out` from index `k` and return the new count. Called once per view
   * per frame, after the track and before the cars. No allocation per frame.
   */
  fill(ctx: RallyDrawCtx, out: DrawItem[], k: number): number;
}

export interface RallySceneryDef {
  readonly id: string;
  /** Lower first (the draw-list order: WORLD 100–199, FIELD 200–299, RULES 300–399). */
  readonly order?: number;
  /** Built once per track (pure; the same every time). */
  build(track: RallyTrack): RallyScenery;
}

/** One player view of the HUD (logical px of the 384 × 216 frame). */
export interface RallyHudView {
  readonly slot: number;
  readonly car: CarState;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly split: boolean;
  readonly day: Readonly<Daylight>;
  /** The radio ticker's text ('' until wave C's radio writes `RallyScene.ticker`). */
  readonly ticker: string;
}

/** A part of the HUD (RULES: the warnings, the clock, the radio ticker, the mini-map; cosmetic). */
export interface RallyHudPart {
  /** Once per scene update, after the race stepped (cosmetic timers). */
  tick?(): void;
  /** Draw one player view (after the base HUD: place, lap, times, speed). */
  draw(r: Renderer, v: RallyHudView): void;
  /** Once over the whole frame, after the views (the results, a full-screen flash). */
  drawFrame?(r: Renderer): void;
  /** The scene leaves (unsubscribe the runner's events). */
  dispose?(): void;
}

export interface RallyHudDef {
  readonly id: string;
  readonly order?: number;
  /** One part per race (the scene's enter). */
  create(runner: RallyRunner): RallyHudPart;
}

const systemDefs = new Map<string, RallySystemDef>();
const sceneryDefs = new Map<string, RallySceneryDef>();
const hudDefs = new Map<string, RallyHudDef>();
let teamsDef: RallyTeamsDef | null = null;
const sceneryBuilt = new Map<string, { track: RallyTrack; scenery: RallyScenery }>();

function ordered<T extends { readonly id: string; readonly order?: number }>(m: Map<string, T>): T[] {
  return [...m.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function defineRallySystem(def: RallySystemDef): void {
  systemDefs.set(def.id, def);
}

/** The race systems, in install order. */
export function rallySystems(): readonly RallySystemDef[] {
  return ordered(systemDefs);
}

export function defineRallyTeams(def: RallyTeamsDef): void {
  teamsDef = def;
}

/** The registered rally teams (null: the runner's wave-A stub rivals). */
export function rallyTeams(): RallyTeamsDef | null {
  return teamsDef;
}

export function defineRallyScenery(def: RallySceneryDef): void {
  sceneryDefs.set(def.id, def);
  sceneryBuilt.delete(def.id);
}

/** Every scenery part for a track (built once per track), in draw order. */
export function rallyScenery(track: RallyTrack): RallyScenery[] {
  const out: RallyScenery[] = [];
  for (const def of ordered(sceneryDefs)) {
    let b = sceneryBuilt.get(def.id);
    if (!b || b.track !== track) {
      b = { track, scenery: def.build(track) };
      sceneryBuilt.set(def.id, b);
    }
    out.push(b.scenery);
  }
  return out;
}

export function defineRallyHud(def: RallyHudDef): void {
  hudDefs.set(def.id, def);
}

/** The HUD parts, in draw order. */
export function rallyHud(): readonly RallyHudDef[] {
  return ordered(hudDefs);
}

/** Remove a wave-B plug-in by id (a system, a scenery or a HUD part; 'teams' the teams). Tests. */
export function undefineRally(id: string): void {
  systemDefs.delete(id);
  sceneryDefs.delete(id);
  sceneryBuilt.delete(id);
  hudDefs.delete(id);
  if (teamsDef?.id === id) teamsDef = null;
}
