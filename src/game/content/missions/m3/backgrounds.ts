/**
 * Mission m3 background stacks (GDD §11.3): standard generators (docs/ART_GUIDE.md §7) plus the
 * custom ones in bg.ts (`chalets`, `ice-cave`, `cable-cars`). Far layers first.
 *
 * Vertical sections (b1, b2) scroll the camera over 1,584 px: each layer is made tall enough for
 * its factorY (216 + 1584 × factorY) so it never runs out (no vertical tiling seams).
 */
import { PAL } from '../../../../engine/palette';
import type { BackgroundDef } from '../../../mission/index';
import './bg';

/** Camera travel of the 384×1800 vertical sections. */
const V_TRAVEL = 1800 - 216;
const tall = (factorY: number): number => Math.ceil(216 + V_TRAVEL * factorY) + 4;

/** m3-a Yodel Valley: cold blue sky to a pale peach horizon, ice peaks, snowy pines, chalets. */
export const BG_VALLEY: BackgroundDef = {
  sky: PAL.sky[2],
  layers: [
    { gen: 'sky-gradient', params: { colors: [PAL.sky[1], PAL.sky[2], PAL.sky[3], PAL.snow[2], PAL.pink[2]] }, factorX: 0 },
    { gen: 'ice-peaks', params: { y: 0.18, height: 0.5, scale: 140 }, factorX: 0.1 },
    { gen: 'clouds', params: { y: 0.14, count: 3, size: 8, ramp: [PAL.snow[1], PAL.snow[2], PAL.snow[3]] }, factorX: 0.15, driftX: -0.04 },
    { gen: 'treeline', params: { y: 0.6, height: 0.3, size: 7, ramp: [PAL.teal[0], PAL.green[0], PAL.green[1], PAL.snow[1]] }, factorX: 0.35 },
    { gen: 'chalets', params: { y: 0.5, base: 0.8, count: 3, dim: true }, factorX: 0.55, offsetY: 4 },
  ],
};

/** m3-b1 North Face: deep blue at the top to peach at the bottom, peaks and drifting clouds. */
export const BG_NORTH_FACE: BackgroundDef = {
  sky: PAL.navy[1],
  layers: [
    {
      gen: 'sky-gradient',
      params: { colors: [PAL.navy[0], PAL.navy[1], PAL.sky[0], PAL.sky[0], PAL.sky[1], PAL.sky[1], PAL.purple[1], PAL.pink[1], PAL.orange[1]] },
      height: tall(0.2),
      factorX: 0,
      factorY: 0.2,
    },
    { gen: 'ice-peaks', params: { y: 0.45, height: 0.55, scale: 120 }, factorX: 0, factorY: 0.1, offsetY: Math.round(V_TRAVEL * 0.1) },
    {
      gen: 'clouds',
      params: { y: 0.5, spread: 200, count: 6, size: 9, ramp: [PAL.snow[0], PAL.snow[1], PAL.snow[2], PAL.snow[3]] },
      height: tall(0.3),
      factorX: 0.1,
      factorY: 0.3,
      driftX: -0.12,
    },
  ],
};

/** m3-b2 Echo Caves: a dark far crystal layer and a glowing near one; violet behind. */
export const BG_ECHO_CAVES: BackgroundDef = {
  sky: PAL.purple[0],
  layers: [
    { gen: 'ice-cave', params: { dark: true, count: 2 }, height: tall(0.15), factorX: 0.1, factorY: 0.15 },
    { gen: 'ice-cave', params: { count: 3 }, height: tall(0.3), width: 384, factorX: 0.2, factorY: 0.3 },
  ],
};

/** m3-c Summit Station: sunset (orange horizon → pink → violet top), pink clouds, cable cars. */
export const BG_SUMMIT: BackgroundDef = {
  sky: PAL.pink[1],
  layers: [
    { gen: 'sky-gradient', params: { colors: [PAL.purple[0], PAL.purple[1], PAL.pink[1], PAL.pink[2], PAL.orange[2], PAL.orange[3]], sun: { x: 0.7, y: 0.6, r: 12 } }, factorX: 0 },
    { gen: 'clouds', params: { y: 0.2, count: 4, size: 8, ramp: [PAL.purple[1], PAL.pink[1], PAL.pink[2], PAL.snow[2]] }, factorX: 0.1, driftX: -0.05 },
    { gen: 'ice-peaks', params: { y: 0.4, height: 0.45, scale: 150, ramp: [PAL.purple[0], PAL.purple[1], PAL.pink[1], PAL.pink[2], PAL.snow[2], PAL.snow[3]] }, factorX: 0.2 },
    { gen: 'cable-cars', params: { y: 0.28, sag: 24, cars: 2, base: 0.85 }, width: 640, factorX: 0.5 },
  ],
};
