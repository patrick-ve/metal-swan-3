/**
 * oz-e — the tower, scrolling up to the top (docs/design/oldenzaal.md §2, §8, §9: the storm; the
 * climb, the horde tide, the bells; at the top the Swan finale).
 *
 * CORE STUB (wave A): a small vertical placeholder (384 × 648, `scroll: 'up'`): a zig-zag of
 * ledges (terrain.ts) and an exit at the top that completes the mission. Wave B (TOWER, FINALE)
 * builds the real climb (about 384 × 1,800) and the finale, whose last step is
 * `ctx.missionComplete()`. Keep `sectionOzE` and 'oz-e'.
 */
import { PAL_HD_OZ } from '../../../../engine/palette-hd';
import type { SectionDef } from '../../../mission/index';
import { defineSectionLight } from '../../oldenzaal/kit/light-api';
import { BG_OZ_E } from './backgrounds';
import { OZ_AMBIENCE, OZ_SECTION, OZ_SONG } from './ids';
import { OZ_E_FLOOR, OZ_E_H, OZ_E_W, terrainOzE } from './terrain';

/** The storm: rain, frequent lightning that lights the whole tower. */
export const OZ_E_LIGHT = defineSectionLight(OZ_SECTION.e, {
  darkness: 0.55,
  tint: PAL_HD_OZ.night[1],
  rain: { density: 0.8, slant: 0.3 },
  lightning: { every: [240, 600], strength: 1, double: 0.4 },
  heroLight: 32,
});

export const sectionOzE: SectionDef = {
  id: OZ_SECTION.e,
  name: 'The tower (storm)',
  width: OZ_E_W,
  height: OZ_E_H,
  scroll: 'up',
  background: BG_OZ_E,
  terrain: terrainOzE(),
  terrainStyle: { ground: 'klinker', edge: 'kerb', platform: 'wood', solid: 'brick' },
  decor: [],
  art: [],
  playerStart: { x: 192, y: OZ_E_FLOOR },
  checkpoints: [OZ_E_H - 324],
  music: OZ_SONG.tower,
  ambience: OZ_AMBIENCE.storm,
  // The top ledge (k = 16, feet y 48) is inside the rect: the placeholder's mission end.
  exits: [{ id: 'top', rect: { x: 24, y: 0, w: OZ_E_W - 48, h: 52 }, to: 'complete' }],
  *script(ctx) {
    ctx.showGo('up');
  },
};
