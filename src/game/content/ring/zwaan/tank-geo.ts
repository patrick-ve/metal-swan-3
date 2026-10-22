/**
 * The tanker `ring-zwaan-tank` (ZWAAN TANKWAGEN; `FRITUURVET` on the tank): geometry and sprite ids
 * shared by its logic (tank.ts) and art (tank-art.ts). LOCAL coordinates: x 0 = the rear end,
 * + forward; y 0 = the road line, − up. It always faces right.
 *
 * - the tank: a white barrel x 4 … 152, y −20 … −52 (axis y −36, radius 16), dished ends; a
 *   rust-red band with `FRITUURVET`, the orange pin stripe, `ZWAAN` and the swan mark; the walkway
 *   rail and three manhole domes on top; the ladder at the rear;
 * - three valves under it (x 9, 78, 128): the rear one is the dump valve with the hose (the slick);
 * - the running gear: the rear bogie (x 24, 40, 56); the front runs on the kit's dolly.
 */
import { RING_ZWAAN } from '../../../ring/ids';
import { zwaanArt } from './api';

export const TANK_ID = RING_ZWAAN.tank;
export const TANK_ART = zwaanArt(TANK_ID);

export const TANK = {
  length: 156,
  height: 56,
  deck: -18,
  barrel: { x0: 4, x1: 152, cy: -36, r: 16 },
  /** Valve centres (x), the valve's spot under the tank (y), their part boxes' half width. */
  valves: [9, 78, 128] as const,
  valveY: -15,
  valveHalf: 8,
  /** The dump hose's nozzle (local) at the rear. */
  nozzle: [-3, -17] as const,
  wheels: [24, 40, 56] as const,
  lampAt: [0, -16] as const,
} as const;

export const TANK_SPR = {
  body: (s: number) => `${TANK_ART}/body-${s}`,
  valve: `${TANK_ART}/valve`,
  hose: `${TANK_ART}/hose`,
  blob: `${TANK_ART}/blob`,
  slick: `${TANK_ART}/slick`,
  streak: `${TANK_ART}/streak`,
  flame: `${TANK_ART}/flame`,
  roll: `${TANK_ART}/roll`,
  chassis: `${TANK_ART}/chassis`,
  lamps: `${TANK_ART}/lamps`,
} as const;

/** Tile width of the slick, the streak and the flame strips (px). */
export const TILE = 12;
