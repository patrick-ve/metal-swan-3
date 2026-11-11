/** The canal scenes (docs/api/canal.md): baked layer stacks drawn in place of a section's old scenery. */
export type { CanalDef, CanalLayerKind, CanalLayerMeta, CanalManifest, CanalSectionManifest, CanalSpriteMeta, CanalTierLayer, CanalTierManifest } from './types';
export {
  canalActive,
  canalManifest,
  canalOn,
  canalPaintedArt,
  canalPaintedNow,
  canalScene,
  canalSource,
  defineCanalManifest,
  drawnArt,
  fetchCanalSource,
  setCanal,
  setCanalPaintedNow,
  setCanalSource,
  setCanalTextures,
  type CanalSource,
} from './registry';
export { canalBusy, canalBytes, canalIdle, canalState, releaseCanal, resetCanalStore, wantCanal, type CanalTile } from './store';
export { CANAL_FRAME_TICKS, CanalView, canalDrawDensity, canalDrawStats, resetCanalDrawStats, type CanalDrawStats } from './view';
export { canalSections } from './sections';
export { CanalSprites } from './sprites';
