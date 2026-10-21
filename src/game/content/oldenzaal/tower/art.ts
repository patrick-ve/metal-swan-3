/**
 * Mission oldenzaal — the tower's art (revision 2, spec §8, §9). Owner: TOWER. Manifest id
 * 'oldenzaal/tower/art'. Prefixes `OZ_SPRITES.tower` ('decor/oz-tower/', 'enemy/oz-tide/',
 * 'prop/oz-bell/', 'vehicle/oz-swan-jet/', 'fx/oz/tower/'); background generators `oz-tower-…`.
 * Every id: 1× (PAL) and 2× / 4× (PAL_HD) from one drawer (art-kit.ts); the bells and the toll
 * ring are `defer: true` (rare strips).
 *
 * - art-entities.ts: the tide, the bells, the toll ring, the jet units, flames and trail.
 * - art-scene.ts: the storm layer, the wall layer, the roof backdrop, the interior decor.
 */
import { PAL } from '../../../../engine/palette';
import type { BackgroundDef } from '../../../mission/index';
import './art-entities';
import { WALL_TILE_H } from './art-scene';

export { TOWER_FRAME_Y } from './art-scene';
export { TOWER_BGS, TOWER_SPRITES } from './art-kit';
export { TOWER_ENTITY_ART } from './art-entities';

/** The tower's decor sprite ids (section-oz-f.ts places them). */
export const TOWER_ART = {
  top: 'decor/oz-tower/top',
  landing: 'decor/oz-tower/landing',
  stair: 'decor/oz-tower/stair',
  door: 'decor/oz-tower/door',
  lantern: 'decor/oz-tower/lantern',
  clock: 'decor/oz-tower/clock',
  pendulum: 'decor/oz-tower/pendulum',
  braces: 'decor/oz-tower/braces',
  rope: 'decor/oz-tower/rope',
  louvre: 'decor/oz-tower/louvre',
  frame: 'decor/oz-tower/frame',
  roof: 'decor/oz-tower/roof',
  wall: 'decor/oz-tower/wall',
  floor: 'decor/oz-tower/floor',
  /** What the section's entities draw (its tier-4 `art`): the tide, the bells, the jet Swan and her own strips. */
  entities: ['enemy/oz-tide/', 'prop/oz-bell/', 'vehicle/oz-swan-jet/', 'fx/oz/tower/', 'vehicle/swan/glide', 'vehicle/swan/neck-relax'] as string[],
} as const;

/** oz-f: the storm sky behind the openings (screen-fixed) and the tower's inner walls (world-locked, tiled in y). */
export const BG_OZ_TOWER: BackgroundDef = {
  sky: PAL.ink[0],
  layers: [
    { gen: 'oz-tower-storm', width: 384, factorX: 0, factorY: 0 },
    { gen: 'oz-tower-wall', width: 384, height: WALL_TILE_H, factorX: 1, factorY: 1, repeatY: true },
  ],
};
