/**
 * Mission m4 background stacks (GDD §11.4): standard generators (docs/ART_GUIDE.md §7) plus the
 * custom ones in bg.ts (`neon-signs`, `crowd-barrier`, `subway-tiles`, `opera-hall`,
 * `m4-confetti`). Far layers first. Night palette: deep navy and violet, neon pink / cyan / gold.
 */
import { PAL } from '../../../../engine/palette';
import type { BackgroundDef, BgLayerDef } from '../../../mission/index';
import './bg';

/** Deep navy at the top → violet over the skyline, a pale moon and a few stars. */
const NIGHT_SKY: BgLayerDef = {
  gen: 'sky-gradient',
  params: { colors: [PAL.ink[1], PAL.navy[0], PAL.navy[1], PAL.purple[0], PAL.purple[1]], stars: 26, sun: { x: 0.78, y: 0.14, r: 7 }, moon: true },
  factorX: 0,
};

const NIGHT_CLOUDS: BgLayerDef = {
  gen: 'clouds',
  params: { y: 0.18, count: 3, size: 5, spread: 10, ramp: [PAL.navy[1], PAL.purple[0], PAL.purple[1]] },
  factorX: 0.05,
  driftX: -0.04,
};

const FAR_CITY: BgLayerDef = {
  gen: 'city',
  params: { ramp: [PAL.ink[1], PAL.navy[0], PAL.navy[1]], y: 0.3, height: 0.6, lit: 0.2, windows: PAL.gold[0], night: true },
  factorX: 0.25,
};

const NEAR_CITY: BgLayerDef = {
  gen: 'city',
  params: { ramp: [PAL.ink[0], PAL.ink[1], PAL.purple[0], PAL.navy[0]], y: 0.38, height: 0.55, lit: 0.22, windows: PAL.gold[1], night: true },
  factorX: 0.5,
  offsetY: 6,
};

const AVENUE_SIGNS = ['FANFARONI LAUNDRY', 'FANFARONI BAKERY', 'FANFARONI AVENUE'];

const NEON_ROW: BgLayerDef = {
  gen: 'neon-signs',
  params: { signs: AVENUE_SIGNS, crossed: 'LITTLE HUSHING', top: 40, low: 76 },
  width: 1024,
  factorX: 0.7,
};

/** m4-a Avenue of Statues. */
export const BG_AVENUE: BackgroundDef = {
  sky: PAL.navy[0],
  layers: [NIGHT_SKY, NIGHT_CLOUDS, FAR_CITY, NEAR_CITY, NEON_ROW],
};

/** m4-b Bandwagon Boulevard: as m4-a with more neon, the crowd barriers and falling confetti. */
export const BG_BOULEVARD: BackgroundDef = {
  sky: PAL.navy[0],
  layers: [
    NIGHT_SKY,
    NIGHT_CLOUDS,
    FAR_CITY,
    NEAR_CITY,
    {
      gen: 'neon-signs',
      params: { signs: ['FANFARONI PARADE', 'FANFARONI CAFE', 'FANFARONI TONIGHT', 'FANFARONI SHOES'], top: 36, low: 70 },
      width: 1280,
      factorX: 0.7,
    },
    { gen: 'crowd-barrier', params: { y: 182, rows: 2 }, width: 512, factorX: 0.9 },
    { gen: 'm4-confetti', params: { count: 50 }, width: 384, factorX: 0.95, repeatY: true, driftY: 0.35, driftX: -0.1, front: true, alpha: 0.85 },
  ],
};

/** m4-c1 The Underground: tiled station walls (the ceiling and the track pit are terrain). */
export const BG_SUBWAY: BackgroundDef = {
  sky: PAL.ink[0],
  layers: [{ gen: 'subway-tiles', params: { y0: 40, y1: 152, name: 'FANFARONI SQ.' }, width: 512, factorX: 0.5 }],
};

/** m4-c2 Billboard Rooftops: the night sky, the far city, giant billboards of the Grand Marshal. */
export const BG_ROOFTOPS: BackgroundDef = {
  sky: PAL.navy[0],
  layers: [
    NIGHT_SKY,
    NIGHT_CLOUDS,
    { ...FAR_CITY, params: { ...FAR_CITY.params, y: 0.42, height: 0.5 } },
    {
      gen: 'neon-signs',
      params: { billboards: true, roof: 150, signs: ['HE IS\nLISTENING', 'APPLAUD\nLOUDER', 'STAND\nUP!'] },
      width: 768,
      factorX: 0.6,
    },
  ],
};

/** m4-d The Opera House: crimson velvet, gold balconies, chandeliers. */
export const BG_OPERA: BackgroundDef = {
  sky: PAL.red[0],
  layers: [{ gen: 'opera-hall', params: { tiers: 2, top: 44, gap: 38 }, width: 512, factorX: 0.4 }],
};
