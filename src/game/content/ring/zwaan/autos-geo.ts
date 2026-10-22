/**
 * The car transporter `ring-zwaan-autos` (ZWAAN AUTOTRANSPORT): geometry and sprite ids shared by
 * its logic (autos.ts) and its art (autos-art.ts). LOCAL coordinates: x 0 = the trailer's rear end,
 * + forward (the front, the drawbar); y 0 = the road line, − up. The part always faces right.
 *
 * Layout (196 px long, about 68 px high):
 * - the lower deck (floor y −17) with two car slots (centres x 46 and 116);
 * - the upper deck at y −45: a REAR section (x 2 … 80) that tilts about its rear pivot (2, −43.5)
 *   (the front end rises: the car on it slides off backwards), lifted by the deck ram (x 60);
 *   a fixed FRONT section (x 80 … 156) with the second upper slot (centre 118);
 * - the headboard (x 156 … 196): the tall rust-red front wall with `ZWAAN` and the swan mark;
 * - the rear ramp: hinged at (2, −17), stowed upright, lowered onto the road at x −34 by the ramp
 *   ram (x 0 … 14);
 * - wheels: the rear bogie (x 24, 40); the front runs on the kit's converter dolly (kit.ts).
 */
import { RING_ZWAAN } from '../../../ring/ids';
import { zwaanArt } from './api';

export const AUTOS_ID = RING_ZWAAN.autos;
export const AUTOS_ART = zwaanArt(AUTOS_ID);

export const AUTOS = {
  length: 196,
  height: 68,
  /** The lower deck's floor (the cars' road line on it). */
  lowY: -17,
  /** The upper deck's floor. */
  upY: -45,
  /** Car slot centres (x) on the lower and the upper deck: [rear, front]. */
  lowSlots: [46, 116] as const,
  upSlots: [40, 118] as const,
  /** The tilting rear section of the upper deck: x range and its rear pivot. */
  tiltX: [2, 80] as const,
  pivot: [2, -43.5] as const,
  /** Tilt angles of the `updeck` frames (degrees; the front end rises). */
  tilts: [0, 5, 10, 15] as const,
  /** The ramp: hinge, foot on the road (down). */
  hinge: [2, -17] as const,
  rampFoot: -34,
  /** The ramp angles of the `ramp` frames (degrees from upright: 0 = stowed … 4 = on the road). */
  rampFrames: 4,
  /** The rams (x of the part boxes) and the deck ram's base and top. */
  ramR: [-2, 14] as const,
  ramF: [52, 68] as const,
  ramFx: 60,
  /** Wheel centres (rear bogie, front axle). */
  wheels: [24, 40] as const,
  /** Rear lamp (brake / indicator) spot. */
  lampAt: [0, -16] as const,
} as const;

/** Car colours on the transporter (civilian-style hatches: no badges, no plates). */
export const AUTOS_CARS = ['red', 'sky', 'gold', 'gable', 'green'] as const;
export type AutosCarColour = (typeof AUTOS_CARS)[number];
/** Tilt angles of a car's frames (degrees, rear down). */
export const CAR_TILTS = [0, 8, 16, 24] as const;
/** The car's wheel centres (x, relative to its middle) and radius (the ring's small wheel). */
export const CAR_WHEELS = [-21, 21] as const;
export const CAR_WHEEL_R = 5.5;
export const CAR_LEN = 66;
export const CAR_H = 24;

export const AUTOS_SPR = {
  frame: (s: number) => `${AUTOS_ART}/frame-${s}`,
  head: (s: number) => `${AUTOS_ART}/head-${s}`,
  updeck: `${AUTOS_ART}/updeck`,
  updeckBroken: `${AUTOS_ART}/updeck-broken`,
  ramp: `${AUTOS_ART}/ramp`,
  rampBroken: `${AUTOS_ART}/ramp-broken`,
  car: (c: string) => `${AUTOS_ART}/car-${c}`,
  lamps: `${AUTOS_ART}/lamps`,
} as const;

/** The world-local y of the tilted upper deck's floor at local x (tilt in degrees). */
export function upDeckY(x: number, tilt: number): number {
  const [px, py] = AUTOS.pivot;
  if (x < AUTOS.tiltX[0] || x > AUTOS.tiltX[1]) return AUTOS.upY;
  return py - 1.5 - (x - px) * Math.tan((tilt * Math.PI) / 180);
}

/** The ramp's surface y at local x when it lies on the road (the slope from the hinge to its foot). */
export function rampY(x: number): number {
  const [hx, hy] = AUTOS.hinge;
  if (x >= hx) return hy;
  if (x <= AUTOS.rampFoot) return 0;
  return hy * ((x - AUTOS.rampFoot) / (hx - AUTOS.rampFoot));
}
