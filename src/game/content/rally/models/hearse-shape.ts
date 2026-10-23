/**
 * The rival DE LAATSTE RIT (docs/design/rally.md §6): a black 1980s hearse of our own design — a
 * long three-box front, a high flat roof over the rear compartment (curtained glass, then a blind
 * rear quarter with a chrome landau bar), chrome bumpers, an upright rear door; flowers on the roof.
 * About 5.65 m long, 1.84 m wide, 1.50 m high (1.72 with the flowers); wheelbase 3.30 m. Pure.
 */
import type { CarFrame } from '../tex/car-sheet';
import type { Station } from './loft';
import { CarShape } from './shape';

export const HRS = {
  nose: 2.8,
  tail: -2.85,
  halfW: 0.92,
  wheelR: 0.34,
  wheelW: 0.21,
  wheelX: 0.8,
  wheelF: 1.75,
  wheelB: -1.55,
  archR: 0.39,
  belt: 0.92,
  glassTop: 1.41,
  roof: 1.5,
  screenFoot: [1.3, 0.97] as const,
  screenTop: [0.72, 1.48] as const,
  roofEnd: -2.66,
  bumperTop: 0.55,
  bumperF: 2.42,
  bumperB: -2.47,
  /** Door shut lines: the front door's front edge, its rear edge (the B-pillar). */
  seams: [1.22, 0.1] as const,
  pillarB: [0.05, 0.14] as const,
  /** The curtained rear glass ends here; the blind rear quarter runs to `quarterEnd`. */
  rearGlassEnd: -1.5,
  quarterEnd: -2.62,
  lampY: [0.6, 0.76] as const,
  cornerZ: [2.62, 2.72] as const,
  tailLampY: [0.62, 0.8] as const,
} as const;

export const HEARSE = new CarShape({
  nose: HRS.nose,
  tail: HRS.tail,
  halfW: HRS.halfW,
  endW: 0.86,
  wheelR: HRS.wheelR,
  wheelW: HRS.wheelW,
  wheelX: HRS.wheelX,
  wheelF: HRS.wheelF,
  wheelB: HRS.wheelB,
  archR: HRS.archR,
  archD: 0.3,
  sill: 0.24,
  endBottom: 0.22,
  endZone: 2.66,
  belt: HRS.belt,
  glassTop: HRS.glassTop,
  roof: HRS.roof,
  top: [
    [HRS.nose, 0.86],
    [2.72, 0.87],
    [HRS.screenFoot[0], HRS.screenFoot[1]],
    [HRS.screenTop[0], HRS.screenTop[1]],
    [HRS.roofEnd, HRS.roof],
    [-2.76, 1.46],
    [HRS.tail, 1.38],
  ],
  screenFoot: HRS.screenFoot,
  screenTop: HRS.screenTop,
  noseTopW: 0.8,
  bonnetW: 0.84,
  screenFootW: 0.84,
  roofW: 0.8,
  tailW: [
    [HRS.roofEnd, 0.8],
    [-2.76, 0.79],
    [HRS.tail, 0.76],
  ],
  shoulderDrop: 0.04,
  aInset: 0.07,
});

/** The hearse's stations (nose → tail): 23 sections (two extra keep the long panels short). */
export function hearseStations(): Station[] {
  return HEARSE.stations([HRS.nose, 2.72, ...HEARSE.archZ(HRS.wheelF), HRS.screenFoot[0], HRS.screenTop[0], -0.2, ...HEARSE.archZ(HRS.wheelB), -2.34, HRS.roofEnd, -2.76, HRS.tail]);
}

/** The far version: 10 sections. */
export function hearseLodStations(): Station[] {
  const r = HRS.archR;
  return HEARSE.stations([HRS.nose, HRS.wheelF + r, HRS.wheelF, HRS.screenFoot[0], HRS.screenTop[0], HRS.wheelB + r, HRS.wheelB, HRS.wheelB - r, HRS.roofEnd, HRS.tail]);
}

export const HRS_FRAME: CarFrame = {
  z0: 2.92,
  y0: 1.56,
  y1: 0.125,
  x0: 0.96875,
  topLen: 6.0,
  frontTop: 0.99,
  backTop: 1.53,
};
