/**
 * Mission m2 background stacks (GDD §11.2): standard generators (docs/ART_GUIDE.md §7) plus the
 * custom ones in bg.ts (`cacti`, `canyon-walls`, `rock-pillars`, `quarry-terraces`).
 * Far layers first.
 */
import { PAL } from '../../../../engine/palette';
import type { BackgroundDef, BgLayerDef } from '../../../mission/index';
import './bg';

/** White-hot horizon → pale cyan sky with a high noon sun. */
const NOON_SKY: BgLayerDef = {
  gen: 'sky-gradient',
  params: { colors: [PAL.sky[2], PAL.sky[3], PAL.snow[1], PAL.snow[2], PAL.snow[3]], sun: { x: 0.72, y: 0.12, r: 10 } },
  factorX: 0,
};

const FLATS_LAYERS: BgLayerDef[] = [
  NOON_SKY,
  { gen: 'clouds', params: { y: 0.12, count: 2, size: 7, ramp: [PAL.snow[0], PAL.snow[1], PAL.snow[2], PAL.snow[3]] }, factorX: 0.05, driftX: -0.03 },
  // Flat-topped rust-orange mesas.
  { gen: 'mountains', params: { ramp: [PAL.rust[0], PAL.rust[1], PAL.orange[0], PAL.orange[1]], y: 0.36, height: 0.26, scale: 150 }, factorX: 0.15 },
  { gen: 'dunes', params: { ramp: [PAL.sand[0], PAL.sand[1], PAL.orange[1], PAL.sand[2]], y: 0.56, height: 0.26, waves: 2 }, factorX: 0.3 },
  { gen: 'dunes', params: { ramp: [PAL.sand[1], PAL.sand[2], PAL.sand[3]], y: 0.66, height: 0.22, waves: 3 }, factorX: 0.5, offsetY: 20 },
];

/** m2-a Rattlebone Flats. */
export const BG_FLATS: BackgroundDef = { sky: PAL.snow[2], layers: FLATS_LAYERS };

/** m2-b Rocky Road: as m2-a plus saguaro silhouettes close behind the road. */
export const BG_ROAD: BackgroundDef = {
  sky: PAL.snow[2],
  layers: [...FLATS_LAYERS, { gen: 'cacti', params: { base: 0.84, count: 2, height: 56 }, width: 640, factorX: 0.8 }],
};

/** m2-c1 Canyon Floor: a strip of hot sky over striped canyon walls, dark pillars in front. */
export const BG_CANYON: BackgroundDef = {
  sky: PAL.orange[1],
  layers: [
    { gen: 'sky-gradient', params: { colors: [PAL.sky[3], PAL.snow[2], PAL.gold[3]] }, factorX: 0, offsetY: -60 },
    { gen: 'canyon-walls', params: { y: 0.1, rough: 20 }, factorX: 0.3 },
    { gen: 'canyon-walls', params: { y: 0.3, rough: 26, dark: true }, factorX: 0.6 },
    { gen: 'rock-pillars', params: { count: 1, width: 18, y: 0.0 }, width: 768, factorX: 1.3, front: true },
  ],
};

/** m2-c2 Mesa Top: a wide deep-blue sky, far mesas, the desert far below. */
export const BG_MESA: BackgroundDef = {
  sky: PAL.sky[1],
  layers: [
    { gen: 'sky-gradient', params: { colors: [PAL.navy[1], PAL.sky[0], PAL.sky[1], PAL.sky[2], PAL.sky[3]] }, factorX: 0 },
    { gen: 'clouds', params: { y: 0.1, count: 3, size: 8 }, factorX: 0.05, driftX: -0.08 },
    { gen: 'mountains', params: { ramp: [PAL.rust[0], PAL.rust[1], PAL.orange[0], PAL.orange[1]], y: 0.5, height: 0.2, scale: 170 }, factorX: 0.1 },
    { gen: 'dunes', params: { ramp: [PAL.rust[1], PAL.orange[0], PAL.sand[1], PAL.sand[2]], y: 0.7, height: 0.2, waves: 4 }, factorX: 0.25, offsetY: 60 },
  ],
};

/** m2-d The Drum Quarry: dunes over the rim, stepped terraces with cranes and the drum banner. */
export const BG_QUARRY: BackgroundDef = {
  sky: PAL.snow[2],
  layers: [
    NOON_SKY,
    { gen: 'dunes', params: { ramp: [PAL.sand[0], PAL.sand[1], PAL.orange[1], PAL.sand[2]], y: 0.25, height: 0.2, waves: 2 }, factorX: 0.15 },
    { gen: 'quarry-terraces', params: { y: 0.32, steps: 4 }, width: 640, factorX: 0.3 },
  ],
};
