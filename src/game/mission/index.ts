/**
 * Mission runtime — public entry for mission agents (docs/ARCHITECTURE.md §6.2):
 * the data types, the terrain builders, the runner and the section view.
 * ```ts
 * import { defineMission } from '../../registry';
 * import { terrain, type SectionDef } from '../../mission/index';
 * ```
 */
export type {
  BackgroundDef,
  BgLayerDef,
  BodyWall,
  BodyWallOpts,
  BossIntroOpts,
  DecorDef,
  EnterOpts,
  EntrySide,
  ExitDef,
  MissionDef,
  MusicCallOpts,
  RespawnSpot,
  ScrollDir,
  SectionContext,
  SectionDef,
  SectionScript,
  SpawnGroupOpts,
  TerrainDef,
  TerrainStyleDef,
  TimerControl,
  TransitionKind,
} from './types';
export { MissionRunner, placeholderMission, placeholderSection, type RunnerEvents, type RunnerOptions, type RunnerState } from './runner';
export { CHUNK, SectionView } from './view';
export { CampaignRecords } from '../session';
// Terrain builders (engine/terrain.ts): terrain(w, h).ground().at(0, 170).flat(400).slope(200, -40)…
export { Terrain, TerrainBuilder, PathBuilder, ground, platformPath, terrain } from '../../engine/terrain';
export type { HazardDef, HazardKind, Point, Polyline, SolidDef } from '../../engine/terrain';
