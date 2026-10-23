/**
 * The two small rally cars (FIELD, wave B; docs/design/rally.md §6), our own designs, no badges,
 * made-up yellow plates, the team names on the doors and the roof:
 * - ACHTERUIT: a small 1970s Dutch saloon with a belt drive — two doors, a short bonnet and boot,
 *   orange with a black waist stripe and a white roof, chrome bumpers, round lamps, and white arrows
 *   pointing BACKWARDS on its sides and its boot (its gag: as fast backwards as forwards). About
 *   3.9 × 1.54 × 1.38 m.
 * - OMA TRUUS: a tiny tall 1990s hatchback in lilac, driven far too fast — the grey-haired driver
 *   shows through the glass (anonymous: a grey bun and big glasses). About 3.45 × 1.58 × 1.45 m.
 * About 300 triangles each. Pure.
 */
import { MeshBuilder } from '../mesh';
import { carRow, S, tone } from '../tex/car-palette';
import { glassAt, paintTread, paintWheel } from '../tex/car-parts';
import { bayer, CarSheet, type CarFrame } from '../tex/car-sheet';
import { PAGE_IDS } from '../../../rally/ids';
import { arcAtZ, box, loft, topArc, zAtArc } from './loft';
import { plates, wells } from './parts';
import { CarShape, type ShapeParams } from './shape';
import type { RallyCarModel } from './types';
import { assemble, lampSet, lowerParts } from './vehicle';

export const ACHTERUIT_PAGE = PAGE_IDS.cars + 15;
export const OMA_PAGE = PAGE_IDS.cars + 16;

// -- ACHTERUIT ----------------------------------------------------------------------------------

const A = {
  nose: 1.95,
  tail: -1.95,
  halfW: 0.77,
  wheelR: 0.28,
  wheelW: 0.17,
  wheelX: 0.65,
  wheelF: 1.2,
  wheelB: -1.1,
  archR: 0.32,
  belt: 0.88,
  glassTop: 1.32,
  roof: 1.38,
  screenFoot: [0.95, 0.88] as const,
  screenTop: [0.45, 1.34] as const,
  rearTop: -0.75,
  rearFoot: -1.2,
  bumperF: 1.82,
  bumperB: -1.82,
  bumperTop: 0.42,
} as const;

const A_SHAPE = new CarShape({
  nose: A.nose,
  tail: A.tail,
  halfW: A.halfW,
  endW: 0.72,
  wheelR: A.wheelR,
  wheelW: A.wheelW,
  wheelX: A.wheelX,
  wheelF: A.wheelF,
  wheelB: A.wheelB,
  archR: A.archR,
  archD: 0.23,
  sill: 0.22,
  endBottom: 0.22,
  endZone: 1.75,
  belt: A.belt,
  glassTop: A.glassTop,
  roof: A.roof,
  top: [
    [A.nose, 0.78],
    [1.85, 0.8],
    [A.screenFoot[0], A.screenFoot[1]],
    [A.screenTop[0], A.screenTop[1]],
    [A.rearTop, A.roof],
    [A.rearFoot, 0.97],
    [-1.85, 0.92],
    [A.tail, 0.88],
  ],
  screenFoot: A.screenFoot,
  screenTop: A.screenTop,
  noseTopW: 0.7,
  bonnetW: 0.73,
  screenFootW: 0.72,
  roofW: 0.63,
  tailW: [
    [A.rearTop, 0.63],
    [A.rearFoot, 0.72],
    [A.tail, 0.72],
  ],
  shoulderDrop: 0.02,
  aInset: 0.05,
} satisfies ShapeParams);

function arch5(zw: number, r: number, d: number): number[] {
  return [zw + r, zw + d, zw, zw - d, zw - r];
}

function aStations(): ReturnType<CarShape['stations']> {
  return A_SHAPE.stations([A.nose, 1.85, ...arch5(A.wheelF, A.archR, 0.23), A.screenFoot[0], A.screenTop[0], -0.15, ...arch5(A.wheelB, A.archR, 0.23), A.rearTop, A.rearFoot, -1.85, A.tail]);
}

function aLod(): ReturnType<CarShape['stations']> {
  return A_SHAPE.stations([A.nose, A.wheelF, A.screenFoot[0], A.screenTop[0], A.rearTop, A.wheelB, A.rearFoot, A.tail]);
}

const A_FRAME: CarFrame = { z0: 2.02, y0: 1.44, y1: 0.12, x0: 0.8, topLen: 4.6, frontTop: 0.86, backTop: 0.96 };

/** A white arrow pointing to the tail (u grows toward the tail on both sides' textures? see `toTail`). */
function arrow(dz: number, dy: number, toTail: number): boolean {
  // An arrowhead and a shaft along z: `dz` toward the tail is +.
  const t = dz * toTail;
  if (t > 0.08 && t < 0.2) return Math.abs(dy) < (0.2 - t) * 0.9;
  return t > -0.25 && t <= 0.08 && Math.abs(dy) < 0.035;
}

function aSide(z: number, y: number, i: number, j: number): number {
  if (z < -1.88 && y > 0.55 && y < 0.72) return S.RED;
  if (z > 1.88 && y > 0.6 && y < 0.72) return S.AMBER;
  const low = lowerParts(z, y, { bumperF: A.bumperF, bumperB: A.bumperB, bumperTop: A.bumperTop, bumper: S.SILVER, sill: 0.24, wheels: [A.wheelF, A.wheelB], r: A.wheelR, archR: A.archR, lip: S.PAINT_D });
  if (low >= 0) return low;
  if (y > A.belt && y < A.glassTop + 0.03) {
    const zA = A_SHAPE.aPillarZ(y);
    const zC = A.rearTop + 0.05 - (y - A.belt) * 0.5;
    if (z < zA + 0.03 && z > zC - 0.03) {
      if (z > zA || z < zC || y < A.belt + 0.025 || y > A.glassTop) return S.SILVER;
      if (z > -0.12 && z < -0.06) return S.SILVER;
      return glassAt((y - A.belt) / (A.glassTop - A.belt), -z * 0.8 + y, i, j);
    }
  }
  // The black waist stripe, the white arrows pointing back (the tail is −z).
  if (y > 0.7 && y < 0.78) return S.BLACK;
  if (arrow(-(z + 1.1 - 0.45), y - 0.55, 1) || arrow(-(z - 1.1 - 0.0), y - 0.55, 1)) return S.ACC_B;
  if (y > 0.28 && y < A.belt && z > 0.9 && z < 0.92) return S.PAINT_D;
  if (y > 0.28 && y < A.belt && z > -0.66 && z < -0.64) return S.PAINT_D;
  if (y < 0.4 && bayer(i, j) * 0.012 > y - 0.24) return S.PAINT_D;
  return y > A.belt - 0.06 ? S.PAINT_L : S.PAINT;
}

export function paintAchteruit(): { sheet: CarSheet; page: ReturnType<CarSheet['build']> } {
  const sh = new CarSheet(ACHTERUIT_PAGE, A_FRAME);
  sh.b.addRow(carRow([tone('rust', 3), tone('rust', 4), tone('rust', 5)], [tone('black', 1), tone('snow', 6), tone('steel', 4)]));
  for (const sd of ['L', 'R'] as const) {
    sh.paintSide(sd, (z, y, i, j) => aSide(z, y, i, j));
    sh.sideText(sd, 'ACHTERUIT', 0.18, 0.66, S.ACC_B);
  }
  const st = aStations();
  const arc = topArc(st);
  sh.paintTop((x, s, i, j) => {
    const z = zAtArc(st, arc, s);
    const ax = x < 0 ? -x : x;
    if (z > A.screenFoot[0] + 0.04) return ax > 0.62 && ax < 0.64 ? S.PAINT_D : S.PAINT;
    if (z > A.screenFoot[0]) return S.SILVER;
    if (z > A.screenTop[0]) {
      const t = (A.screenFoot[0] - z) / (A.screenFoot[0] - A.screenTop[0]);
      if (ax > 0.66 || t > 0.95 || t < 0.04) return S.SILVER;
      return glassAt(1 - t, x * 0.6 + t, i, j);
    }
    if (z > A.rearTop) return bayer(i, j) < 3 ? S.LENS : S.ACC_B; // the white roof
    if (z > A.rearFoot) {
      const t = (A.rearTop - z) / (A.rearTop - A.rearFoot);
      if (ax > 0.6 || t < 0.06 || t > 0.94) return S.SILVER;
      return glassAt(t, x * 0.6 + t, i, j);
    }
    // The boot lid: a white arrow pointing back.
    if (arrow(-(z + 1.45), x, 1)) return S.ACC_B;
    return S.PAINT;
  });
  sh.topText('ACHTERUIT', arcAtZ(st, arc, -0.2), S.ACC_A);
  sh.paintCap('front', (x, y) => {
    const ax = x < 0 ? -x : x;
    if (y < A.bumperTop) return y > A.bumperTop - 0.03 ? S.LENS : y < 0.28 ? S.PLASTIC : S.SILVER;
    const dx = ax - 0.5;
    const dy = y - 0.66;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.09) return d > 0.07 ? S.SILVER : S.LENS;
    if (ax < 0.3 && y > 0.56 && y < 0.74) return (Math.floor(x * 32 + 64) & 1) === 0 ? S.SILVER : S.BLACK;
    if (ax > 0.64 && y > 0.6 && y < 0.7) return S.AMBER;
    return S.PAINT;
  });
  sh.paintCap('back', (x, y) => {
    const ax = x < 0 ? -x : x;
    if (y < A.bumperTop) return y > A.bumperTop - 0.03 ? S.LENS : y < 0.28 ? S.PLASTIC : S.SILVER;
    if (y > 0.55 && y < 0.72 && ax > 0.42) return ax > 0.62 ? S.AMBER : S.RED;
    if (y > 0.7 && y < 0.78) return S.BLACK;
    return S.PAINT;
  });
  sh.capText('back', 'ACHTERUIT', 0, 0.88, S.ACC_B);
  paintWheel(sh, 'chrome');
  paintTread(sh);
  sh.plates('AU-71-RV');
  return { sheet: sh, page: sh.build() };
}

export function buildAchteruit(id: string): RallyCarModel {
  const { sheet: sh, page } = paintAchteruit();
  const mb = new MeshBuilder();
  loft(mb, sh, aStations());
  wells(mb, sh, 0.5, A.halfW - 0.005, [A.wheelF, A.wheelB], A.archR + 0.01, 0.66, false);
  for (const g of [1, -1]) box(mb, sh, g > 0 ? A.halfW - 0.02 : -0.86, 0.9, 0.82, g > 0 ? 0.86 : -A.halfW + 0.02, 1.0, 0.88, S.SILVER);
  plates(mb, sh, { z: A.nose + 0.006, y: 0.34 }, { z: A.tail - 0.006, y: 0.56 }, 0.24, 0.055);
  const lod = new MeshBuilder();
  loft(lod, sh, aLod());
  return assemble({
    id,
    sheet: sh,
    page,
    body: mb,
    lod,
    wheel: { x: A.wheelX, r: A.wheelR, w: A.wheelW, zf: A.wheelF, zb: A.wheelB },
    shadow: [0.72, 1.85, 0.26],
    lamps: lampSet({ nose: A.nose, tail: A.tail, head: [0.5, 0.66, 0.07, 0.07], rear: [0.52, 0.64, 0.1, 0.07], indF: [0.69, 0.65, 0.03, 0.05], indB: [0.69, 0.64, 0.04, 0.07] }),
    box: { x0: -A.halfW, x1: A.halfW, y0: 0, y1: A.roof, z0: A.tail, z1: A.nose },
    bumperCam: [0, 0.92, 1.55],
    rows: ['orange'],
  });
}

// -- OMA TRUUS ----------------------------------------------------------------------------------

const O = {
  nose: 1.72,
  tail: -1.73,
  halfW: 0.79,
  wheelR: 0.27,
  wheelW: 0.17,
  wheelX: 0.67,
  wheelF: 1.12,
  wheelB: -1.1,
  archR: 0.31,
  belt: 0.88,
  glassTop: 1.38,
  roof: 1.45,
  screenFoot: [0.9, 0.9] as const,
  screenTop: [0.25, 1.43] as const,
  roofEnd: -1.3,
  hatchFoot: [-1.66, 1.0] as const,
  bumperF: 1.5,
  bumperB: -1.52,
  bumperTop: 0.46,
} as const;

const O_SHAPE = new CarShape({
  nose: O.nose,
  tail: O.tail,
  halfW: O.halfW,
  endW: 0.74,
  wheelR: O.wheelR,
  wheelW: O.wheelW,
  wheelX: O.wheelX,
  wheelF: O.wheelF,
  wheelB: O.wheelB,
  archR: O.archR,
  archD: 0.22,
  sill: 0.22,
  endBottom: 0.2,
  endZone: 1.55,
  belt: O.belt,
  glassTop: O.glassTop,
  roof: O.roof,
  top: [
    [O.nose, 0.76],
    [1.62, 0.8],
    [O.screenFoot[0], O.screenFoot[1]],
    [O.screenTop[0], O.screenTop[1]],
    [O.roofEnd, O.roof],
    [O.hatchFoot[0], O.hatchFoot[1]],
    [O.tail, 0.95],
  ],
  screenFoot: O.screenFoot,
  screenTop: O.screenTop,
  noseTopW: 0.72,
  bonnetW: O.halfW,
  screenFootW: 0.74,
  roofW: 0.68,
  tailW: [
    [O.roofEnd, 0.68],
    [O.hatchFoot[0], 0.72],
    [O.tail, 0.72],
  ],
  shoulderDrop: 0,
  aInset: 0.05,
} satisfies ShapeParams);

function oStations(): ReturnType<CarShape['stations']> {
  return O_SHAPE.stations([O.nose, 1.62, ...arch5(O.wheelF, O.archR, 0.22), O.screenFoot[0], O.screenTop[0], -0.35, ...arch5(O.wheelB, O.archR, 0.22), O.roofEnd, O.hatchFoot[0], O.tail]);
}

function oLod(): ReturnType<CarShape['stations']> {
  return O_SHAPE.stations([O.nose, O.wheelF, O.screenFoot[0], O.screenTop[0], O.wheelB, O.roofEnd, O.tail]);
}

const O_FRAME: CarFrame = { z0: 1.8, y0: 1.5, y1: 0.12, x0: 0.82, topLen: 4.2, frontTop: 0.84, backTop: 1.04 };

/** The driver through the glass: a grey bun, a pink face, big glasses (z, y of her head's centre). */
function oma(dz: number, dy: number): number {
  const hair = Math.sqrt(dz * dz + (dy - 0.06) * (dy - 0.06));
  const bun = Math.sqrt((dz + 0.1) * (dz + 0.1) + (dy - 0.16) * (dy - 0.16));
  if (bun < 0.06 || (hair < 0.12 && dy > 0.02)) return S.ACC_B;
  if (hair < 0.11) return Math.abs(dy + 0.01) < 0.02 && Math.abs(dz - 0.04) < 0.07 ? S.BLACK : S.ACC_C;
  return -1;
}

function oSide(z: number, y: number, sd: 'L' | 'R', i: number, j: number): number {
  if (z < -1.66 && y > 0.6 && y < 0.95) return y < 0.7 ? S.AMBER : S.RED;
  if (z > 1.64 && y > 0.6 && y < 0.72) return S.AMBER;
  const low = lowerParts(z, y, { bumperF: O.bumperF, bumperB: O.bumperB, bumperTop: O.bumperTop, bumper: S.PLASTIC, sill: 0.24, wheels: [O.wheelF, O.wheelB], r: O.wheelR, archR: O.archR, lip: S.PLASTIC });
  if (low >= 0) return low;
  if (y > O.belt && y < O.glassTop + 0.03) {
    const zA = O_SHAPE.aPillarZ(y);
    const zC = -1.2 + (y - O.belt) * 0.3;
    if (z < zA + 0.03 && z > zC - 0.03) {
      if (z > zA || z < zC || y < O.belt + 0.025 || y > O.glassTop) return S.BLACK;
      if (z > -0.32 && z < -0.24) return S.BLACK;
      // Her head in the front door glass (she shows from both sides).
      const o = oma(z - 0.05, y - 1.12);
      if (o >= 0) return o;
      return glassAt((y - O.belt) / (O.glassTop - O.belt), (sd === 'L' ? -z : z) * 0.8 + y, i, j);
    }
  }
  if (y > 0.4 && y < 0.46 && z > O.bumperB && z < O.bumperF) return S.ACC_A;
  if (y > 0.26 && y < O.belt && z > -0.36 && z < -0.34) return S.PAINT_D;
  if (y < 0.42 && bayer(i, j) * 0.012 > y - 0.24) return S.PAINT_D;
  return y > O.belt - 0.05 ? S.PAINT_L : S.PAINT;
}

export function paintOma(): { sheet: CarSheet; page: ReturnType<CarSheet['build']> } {
  const sh = new CarSheet(OMA_PAGE, O_FRAME);
  sh.b.addRow(carRow([tone('purple', 3), tone('purple', 4), tone('purple', 5)], [tone('snow', 6), tone('cloth', 4), tone('pink', 6)]));
  for (const sd of ['L', 'R'] as const) {
    sh.paintSide(sd, (z, y, i, j) => oSide(z, y, sd, i, j));
    sh.sideText(sd, 'OMA TRUUS', 0.2, 0.8, S.ACC_A);
  }
  const st = oStations();
  const arc = topArc(st);
  sh.paintTop((x, s, i, j) => {
    const z = zAtArc(st, arc, s);
    const ax = x < 0 ? -x : x;
    if (z > O.screenFoot[0] + 0.04) return S.PAINT;
    if (z > O.screenFoot[0]) return S.BLACK;
    if (z > O.screenTop[0]) {
      const t = (O.screenFoot[0] - z) / (O.screenFoot[0] - O.screenTop[0]);
      if (ax > 0.7 || t > 0.95 || t < 0.04) return S.BLACK;
      // Her face through the windscreen (left seat: +x).
      const o = oma((x - 0.36) * 0.8, (0.62 - t) * 0.42);
      if (o >= 0) return o;
      return glassAt(1 - t, x * 0.6 + t, i, j);
    }
    if (z > O.roofEnd) return bayer(i, j) < 5 ? S.PAINT_L : S.PAINT;
    if (z > O.hatchFoot[0]) {
      const t = (O.roofEnd - z) / (O.roofEnd - O.hatchFoot[0]);
      if (ax > 0.6 || t < 0.08 || t > 0.9) return S.BLACK;
      // A lace curtain on the rear shelf.
      if (t > 0.65) return (i + j) % 2 === 0 ? S.ACC_A : S.GLASS;
      return glassAt(t, x * 0.7 + t, i, j);
    }
    return S.PAINT;
  });
  sh.topText('OMA TRUUS', arcAtZ(st, arc, -0.5), S.ACC_A);
  sh.paintCap('front', (x, y) => {
    const ax = x < 0 ? -x : x;
    if (y < O.bumperTop) return y > 0.3 && y < 0.36 && ax < 0.35 ? S.BLACK : S.PLASTIC;
    if (y > 0.58 && y < 0.72) {
      if (ax < 0.3) return S.BLACK;
      if (ax < 0.66) return y < 0.6 ? S.SILVER : S.LENS;
      return S.AMBER;
    }
    return S.PAINT;
  });
  sh.paintCap('back', (x, y) => {
    const ax = x < 0 ? -x : x;
    if (y < O.bumperTop) return S.PLASTIC;
    if (y > 0.6 && y < 0.95 && ax > 0.52) return y < 0.7 ? S.AMBER : S.RED;
    return S.PAINT;
  });
  sh.capText('back', 'OMA TRUUS', 0, 0.86, S.ACC_A);
  paintWheel(sh, 'cover');
  paintTread(sh);
  sh.plates('OT-93-GO');
  return { sheet: sh, page: sh.build() };
}

export function buildOma(id: string): RallyCarModel {
  const { sheet: sh, page } = paintOma();
  const mb = new MeshBuilder();
  loft(mb, sh, oStations());
  wells(mb, sh, 0.52, O.halfW - 0.005, [O.wheelF, O.wheelB], O.archR + 0.01, 0.66, false);
  for (const g of [1, -1]) box(mb, sh, g > 0 ? O.halfW - 0.02 : -0.88, 0.95, 0.78, g > 0 ? 0.88 : -O.halfW + 0.02, 1.06, 0.84, S.PAINT);
  // Far too fast: a boy racer's rear wing on the hatch (two posts and the blade).
  for (const g of [1, -1]) box(mb, sh, g * 0.5 - 0.03, O.roof - 0.02, -1.36, g * 0.5 + 0.03, O.roof + 0.12, -1.3, S.BLACK);
  box(mb, sh, -0.72, O.roof + 0.12, -1.46, 0.72, O.roof + 0.16, -1.24, S.ACC_A);
  plates(mb, sh, { z: O.nose + 0.006, y: 0.36 }, { z: O.tail - 0.006, y: 0.58 }, 0.24, 0.055);
  const lod = new MeshBuilder();
  loft(lod, sh, oLod());
  return assemble({
    id,
    sheet: sh,
    page,
    body: mb,
    lod,
    wheel: { x: O.wheelX, r: O.wheelR, w: O.wheelW, zf: O.wheelF, zb: O.wheelB },
    shadow: [0.74, 1.62, 0.26],
    lamps: lampSet({ nose: O.nose, tail: O.tail, head: [0.48, 0.65, 0.17, 0.06], rear: [0.62, 0.82, 0.09, 0.12], indF: [0.7, 0.65, 0.03, 0.06], indB: [0.62, 0.65, 0.09, 0.04] }),
    box: { x0: -O.halfW, x1: O.halfW, y0: 0, y1: O.roof + 0.16, z0: O.tail, z1: O.nose },
    bumperCam: [0, 0.95, 1.4],
    rows: ['lilac'],
  });
}
