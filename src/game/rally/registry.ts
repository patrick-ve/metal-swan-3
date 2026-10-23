/**
 * The rally's content registry (docs/api/rally.md "A. Wave A contracts"): the lazy content
 * (src/game/content/rally/, loaded by the card or the glitch scene, never at boot) registers its
 * track and car models here at import time; the runner, the scenes and the tools read them. A
 * later definition with the same id replaces the earlier one. Built objects are kept (one build
 * per process: the track and the models come from pure code, the same every time).
 */
import type { RallyModel, RallyTrack } from './api';

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
