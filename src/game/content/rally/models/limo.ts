/**
 * VRIJGEZELLEN (FIELD, wave B; docs/design/rally.md §6): a white stretch limousine of our own design
 * with a bachelor party through the sunroof — three of the lads stand in the opening, arms up, the
 * groom in a gold paper hat. A long white body, a chrome belt line, dark tinted glass, chrome wheels,
 * the team name in pink on both sides and on the roof behind the sunroof. No badge; a made-up
 * yellow plate. About 7.65 × 1.86 × 2.2 m (the lads included), a long wheelbase. About 420
 * triangles; 24 texels per metre (the page holds the long sides). Pure. No real persons: the lads
 * are anonymous blocky figures.
 */
import { MeshBuilder } from '../mesh';
import { carRow, S, tone, type Slot } from '../tex/car-palette';
import { glassAt, paintTread, paintWheel } from '../tex/car-parts';
import { bayer, CarSheet, type CarFrame } from '../tex/car-sheet';
import { PAGE_IDS } from '../../../rally/ids';
import { arcAtZ, box, loft, topArc, zAtArc } from './loft';
import { plates, wells } from './parts';
import { CarShape } from './shape';
import type { RallyCarModel } from './types';
import { assemble, lampSet, lowerParts, sideTextScaled, slotBox, topTextScaled } from './vehicle';

export const LIMO_PAGE = PAGE_IDS.cars + 13;
const TEXEL = 24;
const NAME = 'VRIJGEZELLEN';
const PLATE = 'VR-IJ-01';

const M = {
  nose: 3.85,
  tail: -3.8,
  halfW: 0.93,
  wheelR: 0.33,
  wheelW: 0.21,
  wheelX: 0.8,
  wheelF: 2.75,
  wheelB: -2.3,
  archR: 0.38,
  belt: 0.95,
  glassTop: 1.36,
  roof: 1.42,
  screenFoot: [2.3, 0.97] as const,
  screenTop: [1.62, 1.4] as const,
  rearTop: -2.55,
  rearFoot: -3.15,
  bumperF: 3.62,
  bumperB: -3.55,
  bumperTop: 0.5,
  sunroof: { z0: -0.75, z1: 0.65, hw: 0.55 },
} as const;

const SHAPE = new CarShape({
  nose: M.nose,
  tail: M.tail,
  halfW: M.halfW,
  endW: 0.86,
  wheelR: M.wheelR,
  wheelW: M.wheelW,
  wheelX: M.wheelX,
  wheelF: M.wheelF,
  wheelB: M.wheelB,
  archR: M.archR,
  archD: 0.27,
  sill: 0.26,
  endBottom: 0.24,
  endZone: 3.5,
  belt: M.belt,
  glassTop: M.glassTop,
  roof: M.roof,
  top: [
    [M.nose, 0.8],
    [3.7, 0.83],
    [M.screenFoot[0], M.screenFoot[1]],
    [M.screenTop[0], M.screenTop[1]],
    [M.rearTop, M.roof],
    [M.rearFoot, 1.06],
    [-3.62, 1.0],
    [M.tail, 0.97],
  ],
  screenFoot: M.screenFoot,
  screenTop: M.screenTop,
  noseTopW: 0.84,
  bonnetW: 0.88,
  screenFootW: 0.88,
  roofW: 0.8,
  tailW: [
    [M.rearTop, 0.8],
    [M.rearFoot, 0.86],
    [M.tail, 0.86],
  ],
  shoulderDrop: 0.03,
  aInset: 0.06,
});

function arch(zw: number): number[] {
  const r = M.archR;
  return [zw + r, zw + 0.27, zw, zw - 0.27, zw - r];
}

function stations(): ReturnType<CarShape['stations']> {
  return SHAPE.stations([M.nose, 3.7, ...arch(M.wheelF), M.screenFoot[0], M.screenTop[0], 0.9, 0.1, -0.7, -1.5, ...arch(M.wheelB), M.rearTop, M.rearFoot, -3.62, M.tail]);
}

function lodStations(): ReturnType<CarShape['stations']> {
  return SHAPE.stations([M.nose, M.wheelF, M.screenFoot[0], M.screenTop[0], 0.1, M.wheelB, M.rearTop, M.rearFoot, M.tail]);
}

const FRAME: CarFrame = { z0: 3.95, y0: 1.5, y1: 0.12, x0: 0.97, topLen: 8.6, frontTop: 0.9, backTop: 1.1 };

/** The pillars of the long glasshouse (z centres): the B, two in the stretch, the C. */
const PILLARS: readonly number[] = [1.0, -0.15, -1.3, -2.45];

function side(z: number, y: number, i: number, j: number): number {
  if (z < -3.7 && y > 0.6 && y < 0.82) return S.RED;
  if (z > 3.72 && y > 0.62 && y < 0.78) return S.AMBER;
  const low = lowerParts(z, y, { bumperF: M.bumperF, bumperB: M.bumperB, bumperTop: M.bumperTop, bumper: S.SILVER, sill: 0.28, wheels: [M.wheelF, M.wheelB], r: M.wheelR, archR: M.archR, lip: S.SILVER });
  if (low >= 0) return low;
  if (y > M.belt && y < M.glassTop + 0.03) {
    const zA = SHAPE.aPillarZ(y);
    // The rear pillar leans with the rear screen.
    const zC = M.rearTop + ((M.rearFoot - M.rearTop) * (M.glassTop - y)) / (M.glassTop - 1.06) * 0.6 + 0.12;
    if (z < zA + 0.03 && z > zC - 0.03) {
      if (z > zA || z < zC || y < M.belt + 0.025 || y > M.glassTop) return S.BLACK;
      for (const p of PILLARS) if (z > p - 0.05 && z < p + 0.05) return S.BLACK;
      // Dark tint (a limousine's privacy glass) with the streaks.
      return glassAt(0.1, -z * 0.5 + y, i, j);
    }
  }
  // The chrome belt line, the door shut lines.
  if (y > M.belt - 0.035 && y <= M.belt) return S.SILVER;
  if (y > 0.3 && y < M.belt) for (const p of PILLARS) if (z > p - 0.012 && z < p + 0.012) return S.PAINT_D;
  if (y < 0.45 && bayer(i, j) * 0.012 > y - 0.28) return S.PAINT_D;
  return y > M.belt - 0.08 ? S.PAINT_L : S.PAINT;
}

export function paintLimo(): { sheet: CarSheet; page: ReturnType<CarSheet['build']> } {
  const sh = new CarSheet(LIMO_PAGE, FRAME, [], 256, TEXEL);
  // White paint; pink, sky and the skin tone for the lads.
  sh.b.addRow(carRow([tone('snow', 3), tone('snow', 5), tone('snow', 6)], [tone('pink', 4), tone('sky', 4), tone('brown', 6)]));
  for (const sd of ['L', 'R'] as const) {
    sh.paintSide(sd, (z, y, i, j) => side(z, y, i, j));
    sideTextScaled(sh, sd, NAME, -0.7, 0.86, S.ACC_A, 2);
  }
  const st = stations();
  const arc = topArc(st);
  const R = M.sunroof;
  sh.paintTop((x, s, i, j) => {
    const z = zAtArc(st, arc, s);
    const ax = x < 0 ? -x : x;
    if (z > M.screenFoot[0] + 0.05) return ax > 0.7 && ax < 0.72 ? S.PAINT_D : S.PAINT;
    if (z > M.screenFoot[0]) return S.BLACK;
    if (z > M.screenTop[0]) {
      const t = (M.screenFoot[0] - z) / (M.screenFoot[0] - M.screenTop[0]);
      if (ax > 0.82 || t > 0.95) return S.BLACK;
      return glassAt(1 - t, x * 0.6 + t, i, j);
    }
    if (z > M.rearTop) {
      // The sunroof's opening (dark), its chrome rim.
      if (z < R.z1 && z > R.z0 && ax < R.hw) return z > R.z1 - 0.04 || z < R.z0 + 0.04 || ax > R.hw - 0.04 ? S.SILVER : S.BLACK;
      return bayer(i, j) < 4 ? S.PAINT_L : S.PAINT;
    }
    if (z > M.rearFoot) {
      const t = (M.rearTop - z) / (M.rearTop - M.rearFoot);
      if (ax > 0.72 || t < 0.06 || t > 0.94) return S.BLACK;
      return glassAt(t, x * 0.6 + t, i, j);
    }
    return S.PAINT;
  });
  topTextScaled(sh, NAME, arcAtZ(st, arc, -1.3), S.ACC_A, 1);
  sh.paintCap('front', (x, y) => {
    const ax = x < 0 ? -x : x;
    if (y < M.bumperTop) return y > M.bumperTop - 0.03 ? S.LENS : y < 0.3 ? S.PLASTIC : S.SILVER;
    if (y > 0.6 && y < 0.78) {
      if (ax < 0.4) return ax > 0.37 ? S.SILVER : (Math.floor(x * 24 + 32) & 1) === 0 ? S.SILVER : S.BLACK;
      if (ax < 0.78) return ax > 0.58 && ax < 0.6 ? S.SILVER : S.LENS;
      return S.AMBER;
    }
    return S.PAINT;
  });
  sh.paintCap('back', (x, y) => {
    const ax = x < 0 ? -x : x;
    if (y < M.bumperTop) return y > M.bumperTop - 0.03 ? S.LENS : y < 0.3 ? S.PLASTIC : S.SILVER;
    if (y > 0.6 && y < 0.82 && ax > 0.4) return ax > 0.78 ? S.AMBER : S.RED;
    if (y > 0.88 && y < 0.91 && ax < 0.6) return S.SILVER;
    return S.PAINT;
  });
  paintWheel(sh, 'chrome');
  paintTread(sh);
  sh.plates(PLATE);
  return { sheet: sh, page: sh.build() };
}

/** One of the lads: a shirt, a head (hair on top), one arm up; `hat` the groom's gold hat. */
function lad(mb: MeshBuilder, sh: CarSheet, x: number, z: number, shirt: Slot, armSide: number, hat: boolean): void {
  const y0 = M.roof - 0.1;
  slotBox(mb, sh, x - 0.17, y0, z - 0.12, x + 0.17, y0 + 0.48, z + 0.12, shirt);
  const skin = sh.solid(S.ACC_C);
  const hair = sh.solid(S.BLACK);
  mb.box(x - 0.1, y0 + 0.5, z - 0.1, x + 0.1, y0 + 0.73, z + 0.1, (f) => (f === 'top' ? hair : skin), [128, 128, 128]);
  const ax = x + armSide * 0.22;
  slotBox(mb, sh, ax - 0.05, y0 + 0.3, z - 0.05, ax + 0.05, y0 + 0.86, z + 0.05, shirt);
  if (hat) slotBox(mb, sh, x - 0.06, y0 + 0.73, z - 0.06, x + 0.06, y0 + 0.9, z + 0.06, S.PLATE);
}

export function buildLimo(id: string): RallyCarModel {
  const { sheet: sh, page } = paintLimo();
  const mb = new MeshBuilder();
  loft(mb, sh, stations());
  wells(mb, sh, 0.62, M.halfW - 0.005, [M.wheelF, M.wheelB], M.archR + 0.01, 0.78, false);
  lad(mb, sh, 0.3, 0.3, S.ACC_A, 1, false);
  lad(mb, sh, -0.02, -0.15, S.RED, -1, true);
  lad(mb, sh, -0.34, 0.2, S.ACC_B, -1, false);
  for (const g of [1, -1]) box(mb, sh, g > 0 ? M.halfW - 0.02 : -1.04, 0.95, 1.95, g > 0 ? 1.04 : -M.halfW + 0.02, 1.08, 2.02, S.PAINT);
  plates(mb, sh, { z: M.nose + 0.006, y: 0.4 }, { z: M.tail - 0.006, y: 0.72 });
  const lod = new MeshBuilder();
  loft(lod, sh, lodStations());
  slotBox(lod, sh, -0.45, M.roof - 0.1, -0.2, 0.45, M.roof + 0.6, 0.35, S.ACC_A);
  const height = M.roof - 0.1 + 0.9;
  return assemble({
    id,
    sheet: sh,
    page,
    body: mb,
    lod,
    wheel: { x: M.wheelX, r: M.wheelR, w: M.wheelW, zf: M.wheelF, zb: M.wheelB, sides: 6 },
    shadow: [0.9, 3.7, 0.3],
    lamps: lampSet({ nose: M.nose, tail: M.tail, head: [0.6, 0.69, 0.17, 0.07], rear: [0.6, 0.71, 0.18, 0.09], indF: [0.84, 0.69, 0.04, 0.07], indB: [0.84, 0.71, 0.04, 0.09] }),
    box: { x0: -M.halfW, x1: M.halfW, y0: 0, y1: height, z0: M.tail, z1: M.nose },
    bumperCam: [0, 1.0, 3.3],
    rows: ['white'],
  });
}
