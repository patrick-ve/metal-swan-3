/**
 * The traffic hatchback (docs/design/rally.md §6): a small 1990s five-door of our own design — a
 * short bonnet, a raked windscreen, a sloping hatch with its glass on top. About 3.85 m long, 1.66 m
 * wide, 1.38 m high; wheelbase 2.44 m. Fewer sections than the estates (a traffic car is 120–250
 * triangles): five-point arches, no bonnet shoulder. Pure.
 */
import type { CarFrame } from '../tex/car-sheet';
import type { Station } from './loft';
import { CarShape } from './shape';

export const HAT = {
  nose: 1.92,
  tail: -1.93,
  halfW: 0.83,
  wheelR: 0.29,
  wheelW: 0.18,
  wheelX: 0.7,
  wheelF: 1.2,
  wheelB: -1.24,
  archR: 0.33,
  belt: 0.86,
  glassTop: 1.31,
  roof: 1.38,
  screenFoot: [0.95, 0.88] as const,
  screenTop: [0.1, 1.37] as const,
  roofEnd: -1.45,
  hatchFoot: [-1.82, 1.02] as const,
  bumperTop: 0.5,
  bumperF: 1.62,
  bumperB: -1.64,
  seams: [0.82, -0.08, -0.98] as const,
  pillarB: [-0.12, -0.04] as const,
  lampY: [0.58, 0.72] as const,
} as const;

export const HATCH = new CarShape({
  nose: HAT.nose,
  tail: HAT.tail,
  halfW: HAT.halfW,
  endW: 0.77,
  wheelR: HAT.wheelR,
  wheelW: HAT.wheelW,
  wheelX: HAT.wheelX,
  wheelF: HAT.wheelF,
  wheelB: HAT.wheelB,
  archR: HAT.archR,
  archD: 0.25,
  sill: 0.21,
  endBottom: 0.19,
  endZone: 1.8,
  belt: HAT.belt,
  glassTop: HAT.glassTop,
  roof: HAT.roof,
  top: [
    [HAT.nose, 0.78],
    [1.85, 0.8],
    [HAT.screenFoot[0], HAT.screenFoot[1]],
    [HAT.screenTop[0], HAT.screenTop[1]],
    [HAT.roofEnd, HAT.roof],
    [HAT.hatchFoot[0], HAT.hatchFoot[1]],
    [HAT.tail, 0.96],
  ],
  screenFoot: HAT.screenFoot,
  screenTop: HAT.screenTop,
  // No shoulder on the bonnet: its top runs to the full width (the side quads stop at the top).
  noseTopW: 0.77,
  bonnetW: HAT.halfW,
  screenFootW: 0.76,
  roofW: 0.68,
  tailW: [
    [HAT.roofEnd, 0.68],
    [HAT.hatchFoot[0], 0.72],
    [HAT.tail, 0.7],
  ],
  shoulderDrop: 0,
  aInset: 0.06,
});

/** The hatch's stations (nose → tail): 16 sections. */
export function hatchStations(): Station[] {
  const a = (zw: number): number[] => {
    const r = HAT.archR;
    const d = 0.25;
    return [zw + r, zw + d, zw, zw - d, zw - r];
  };
  return HATCH.stations([HAT.nose, 1.85, ...a(HAT.wheelF), HAT.screenTop[0], ...a(HAT.wheelB), HAT.roofEnd, HAT.hatchFoot[0], HAT.tail]);
}

/** The far version: 8 sections. */
export function hatchLodStations(): Station[] {
  return HATCH.stations([HAT.nose, HAT.wheelF + HAT.archR, HAT.wheelF, HAT.screenFoot[0], HAT.screenTop[0], HAT.wheelB, HAT.roofEnd, HAT.tail]);
}

export const HAT_FRAME: CarFrame = {
  z0: 1.98,
  y0: 1.44,
  y1: 0.125,
  x0: 0.875,
  topLen: 4.4,
  frontTop: 0.9,
  backTop: 1.0,
};
