/**
 * The estate's shape in metres (docs/design/rally.md §6; ring spec §3 and decisions 13 / 13a): a
 * likeness of the squad's boxy 1990s Swedish estate, no badge. The numbers come from the ring
 * wagon's side profile (content/ring/wagon/geometry.ts, 1 px = 1.76 m / 34 = 0.0518 m), so the 2D
 * and the 3D car share their proportions: about 4.84 m long, 1.76 m wide, 1.43 m high (1.48 with the
 * rails); wheelbase 2.68 m; the flat upright nose, the long flat roof, the nearly upright tailgate
 * with the tall rear lamps up the D-pillars.
 *
 * The mesh (models/estate.ts) and the painters (tex/estate.ts) read the same numbers. Pure.
 */
import type { CarFrame } from '../tex/car-sheet';
import type { Station } from './loft';
import { CarShape } from './shape';

export const EST = {
  nose: 2.42,
  tail: -2.42,
  halfW: 0.88,
  endW: 0.82,
  wheelR: 0.33,
  wheelW: 0.2,
  wheelX: 0.76,
  wheelF: 1.4,
  wheelB: -1.28,
  archR: 0.38,
  sill: 0.22,
  belt: 0.9,
  glassTop: 1.37,
  roof: 1.43,
  noseTop: 0.86,
  screenFoot: [1.11, 0.93] as const,
  screenTop: [0.58, 1.42] as const,
  /** Where the roof ends and the tailgate starts. */
  roofEnd: -2.26,
  /** The bumpers' top and their inner ends; the rubbing strip between them. */
  bumperTop: 0.56,
  /** The front bumper's dark band starts here; the apron below it is body colour. */
  apronTop: 0.42,
  bumperF: 2.02,
  bumperB: -1.92,
  strip: [0.5, 0.56] as const,
  /** Door shut lines (z): the front door's front edge, the B-pillar, the rear door's rear edge. */
  seams: [0.95, 0.02, -1.1] as const,
  /** Pillars (z ranges): B and C; the D-pillar starts at `dPillar`. */
  pillarB: [-0.03, 0.06] as const,
  pillarC: [-1.14, -1.06] as const,
  dPillar: -2.18,
  /** The tall rear lamp (z from the tail to `tailLamp`), its height and its lower bands. */
  tailLamp: -2.3,
  tailLampY: [0.59, 1.36] as const,
  reverseY: 0.8,
  amberY: 0.69,
  /** The front corner (the amber indicator, then the headlamp's wrap) and the lamp heights. */
  cornerZ: [2.28, 2.36] as const,
  lampY: [0.62, 0.79] as const,
} as const;

export const ESTATE = new CarShape({
  nose: EST.nose,
  tail: EST.tail,
  halfW: EST.halfW,
  endW: EST.endW,
  wheelR: EST.wheelR,
  wheelW: EST.wheelW,
  wheelX: EST.wheelX,
  wheelF: EST.wheelF,
  wheelB: EST.wheelB,
  archR: EST.archR,
  // 0.29 ≈ r · cos 45°, rounded so the front arch's rear station is the windscreen's foot (1.11).
  archD: 0.29,
  sill: EST.sill,
  endBottom: 0.2,
  endZone: 2.3,
  belt: EST.belt,
  glassTop: EST.glassTop,
  roof: EST.roof,
  top: [
    [EST.nose, 0.85],
    [2.34, EST.noseTop],
    [EST.screenFoot[0], EST.screenFoot[1]],
    [EST.screenTop[0], EST.screenTop[1]],
    [EST.roofEnd, EST.roof],
    [-2.34, 1.4],
    [EST.tail, 1.34],
  ],
  screenFoot: EST.screenFoot,
  screenTop: EST.screenTop,
  noseTopW: 0.76,
  bonnetW: 0.8,
  screenFootW: 0.8,
  roofW: 0.74,
  tailW: [
    [EST.roofEnd, 0.74],
    [-2.34, 0.73],
    [EST.tail, 0.7],
  ],
  shoulderDrop: 0.04,
  aInset: 0.07,
});

/** The z of the side glass' front edge at height y. */
export function aPillarZ(y: number): number {
  return ESTATE.aPillarZ(y);
}

/** The full body's stations (nose → tail): 22 sections. */
export function estateStations(): Station[] {
  // Extra sections at the B-pillar and the D-pillar keep the long side panels short (the affine warp).
  return ESTATE.stations([EST.nose, 2.34, ...ESTATE.archZ(EST.wheelF), EST.screenTop[0], 0.02, ...ESTATE.archZ(EST.wheelB), -2.0, EST.roofEnd, -2.34, EST.tail]);
}

/** The far version's stations (nose → tail): 10 sections, the arches as three points. */
export function estateLodStations(): Station[] {
  const r = EST.archR;
  return ESTATE.stations([EST.nose, EST.wheelF + r, EST.wheelF, EST.screenFoot[0], EST.screenTop[0], EST.wheelB + r, EST.wheelB, EST.wheelB - r, EST.roofEnd, EST.tail]);
}

/** The estate's texture frame. */
export const EST_FRAME: CarFrame = {
  z0: 2.48,
  y0: 1.5,
  y1: 0.125,
  x0: 0.9375,
  topLen: 5.25,
  frontTop: 0.975,
  backTop: 1.475,
};
