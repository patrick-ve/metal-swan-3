/**
 * Mission `oat`, wave A: the PLACEHOLDER scenery of the six section stubs (CORE). Plain and clearly
 * temporary: the stock sky gradient and city silhouettes, the stock concrete street. The builders
 * replace a section's `background` and `terrainStyle` with their own (STREET-A oat-a and the oat-d
 * proof strip in wave A, the others in waves B and C) and the last section drops this file.
 * Nothing here is part of the realism target (docs/design/oat.md §8).
 */
import { PAL } from '../../../../engine/palette';
import type { BackgroundDef, TerrainStyleDef } from '../../../mission/index';

/** The stock street (no oat material yet). */
export const STUB_STYLE: TerrainStyleDef = { ground: 'concrete', edge: 'tiles', platform: 'metal', solid: 'brick' };

/** Day: a plain blue sky over grey city blocks (oat-a, oat-b). */
export const STUB_DAY: BackgroundDef = {
  sky: PAL.sky[3],
  layers: [
    { gen: 'sky-gradient', params: { ramp: 'sky' }, factorX: 0 },
    { gen: 'clouds', params: { y: 0.12, count: 3 }, factorX: 0.05 },
    { gen: 'city', params: { y: 0.2, height: 0.62, ramp: [PAL.stone[0], PAL.stone[1], PAL.stone[2], PAL.stone[3], PAL.snow[0]], lit: 0, night: false }, factorX: 0.3 },
  ],
};

/** Late afternoon: a warm sky over brown blocks (oat-c, oat-c1). */
export const STUB_DUSK: BackgroundDef = {
  sky: PAL.orange[2],
  layers: [
    { gen: 'sky-gradient', params: { colors: [PAL.sky[2], PAL.sky[3], PAL.gold[2], PAL.orange[2]] }, factorX: 0 },
    { gen: 'city', params: { y: 0.24, height: 0.56, ramp: [PAL.brown[0], PAL.brown[1], PAL.rust[1], PAL.rust[2], PAL.orange[1]], lit: 0, night: false }, factorX: 0.3 },
  ],
};

/** Night: a navy sky over dark blocks with lit windows (oat-d, oat-e). */
export const STUB_NIGHT: BackgroundDef = {
  sky: PAL.navy[0],
  layers: [
    { gen: 'sky-gradient', params: { colors: [PAL.ink[1], PAL.navy[0], PAL.navy[1], PAL.purple[0]] }, factorX: 0 },
    { gen: 'city', params: { y: 0.22, height: 0.6, lit: 0.3 }, factorX: 0.3 },
  ],
};
