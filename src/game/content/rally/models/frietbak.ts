/**
 * DE FRIETBAK (FIELD, wave B; docs/design/rally.md §6): a snack van of our own design with a giant
 * cone of fries on its roof (a nod to ams) — a white van with a high roof, a red and yellow livery,
 * the serving hatch open on the right side under its flap, the team name big on both sides, on the
 * roof and on the back doors. No badge; a made-up yellow plate. About 5.4 × 2.05 × 3.6 m (the fries
 * included). About 400 triangles. Pure.
 */
import { MeshBuilder } from '../mesh';
import { carRow, S, tone } from '../tex/car-palette';
import { glassAt, paintTread, paintWheel } from '../tex/car-parts';
import { bayer, CarSheet, type CarFrame } from '../tex/car-sheet';
import { PAGE_IDS } from '../../../rally/ids';
import { arcAtZ, box, face, loft, topArc, zAtArc } from './loft';
import { plates, wells } from './parts';
import { CarShape } from './shape';
import type { RallyCarModel } from './types';
import { assemble, capTextScaled, frustum, inWin, lampSet, lowerParts, sideTextScaled, slotBox, topTextScaled } from './vehicle';

export const FRIETBAK_PAGE = PAGE_IDS.cars + 12;
const TEXEL = 30;
const NAME = 'DE FRIETBAK';
const PLATE = 'FR-1-ET';

const F = {
  nose: 2.7,
  tail: -2.7,
  halfW: 1.02,
  wheelR: 0.34,
  wheelW: 0.21,
  wheelX: 0.84,
  wheelF: 1.85,
  wheelB: -1.45,
  archR: 0.4,
  belt: 1.12,
  glassTop: 1.85,
  roof: 2.45,
  screenFoot: [2.3, 1.1] as const,
  screenTop: [1.85, 2.0] as const,
  bumperF: 2.55,
  bumperB: -2.58,
  bumperTop: 0.45,
  /** The serving hatch (right side): its opening and its flap. */
  hatch: { z0: -1.15, z1: 0.65, y0: 1.2, y1: 2.05 },
  cone: { z: -0.65, y0: 2.45, y1: 3.2, r0: 0.2, r1: 0.52 },
} as const;

const SHAPE = new CarShape({
  nose: F.nose,
  tail: F.tail,
  halfW: F.halfW,
  endW: 0.97,
  wheelR: F.wheelR,
  wheelW: F.wheelW,
  wheelX: F.wheelX,
  wheelF: F.wheelF,
  wheelB: F.wheelB,
  archR: F.archR,
  archD: 0.3,
  sill: 0.3,
  endBottom: 0.3,
  endZone: 2.5,
  belt: F.belt,
  glassTop: F.glassTop,
  roof: F.roof,
  top: [
    [F.nose, 0.98],
    [2.5, 1.04],
    [F.screenFoot[0], F.screenFoot[1]],
    [F.screenTop[0], F.screenTop[1]],
    [1.5, 2.42],
    [-2.62, F.roof],
    [F.tail, 2.38],
  ],
  screenFoot: F.screenFoot,
  screenTop: F.screenTop,
  noseTopW: 0.92,
  bonnetW: 0.98,
  screenFootW: 0.97,
  roofW: 1.0,
  tailW: [
    [-2.62, 1.0],
    [F.tail, 0.97],
  ],
  shoulderDrop: 0.03,
  aInset: 0.05,
});

/** Five-point arches (fewer sections: the fries cost triangles). */
function arch(zw: number): number[] {
  const r = F.archR;
  return [zw + r, zw + 0.28, zw, zw - 0.28, zw - r];
}

function stations(): ReturnType<CarShape['stations']> {
  return SHAPE.stations([F.nose, 2.5, ...arch(F.wheelF), F.screenFoot[0], F.screenTop[0], 1.5, -0.2, ...arch(F.wheelB), -2.62, F.tail]);
}

function lodStations(): ReturnType<CarShape['stations']> {
  return SHAPE.stations([F.nose, F.wheelF + F.archR, F.screenFoot[0], F.screenTop[0], 1.5, F.wheelB + F.archR, F.wheelB - F.archR, F.tail]);
}

const FRAME: CarFrame = { z0: 2.8, y0: 2.52, y1: 0.12, x0: 1.06, topLen: 6.8, frontTop: 1.15, backTop: 2.5 };

/** The livery: white, a red skirt with a yellow pinstripe, a red waist band. */
function livery(y: number, i: number, j: number): number {
  if (y < 0.62) return S.ACC_A;
  if (y < 0.67) return S.ACC_B;
  if (y > 2.2 && y < 2.3) return S.ACC_A;
  return y > 2.3 && bayer(i, j) < 5 ? S.PAINT_L : S.PAINT;
}

function side(z: number, y: number, sd: 'L' | 'R', i: number, j: number): number {
  if (z < -2.64 && y > 0.55 && y < 1.05) return y < 0.68 ? S.AMBER : S.RED;
  if (z > 2.62 && y > 0.62 && y < 0.78) return S.AMBER;
  const low = lowerParts(z, y, { bumperF: F.bumperF, bumperB: F.bumperB, bumperTop: F.bumperTop, bumper: S.PLASTIC, sill: 0.3, wheels: [F.wheelF, F.wheelB], r: F.wheelR, archR: F.archR, lip: S.PLASTIC });
  if (low >= 0) return low;
  if (z > 1.5 && y > F.belt && y < F.glassTop + 0.03) {
    const zA = SHAPE.aPillarZ(y);
    if (z < zA + 0.035) {
      if (z > zA || y < F.belt + 0.03 || y > F.glassTop || z < 1.56) return S.BLACK;
      return glassAt((y - F.belt) / (F.glassTop - F.belt), -z * 0.8 + y, i, j);
    }
  }
  if (sd === 'R') {
    // The open serving hatch: the dark inside, a counter, a menu board with the fries.
    const H = F.hatch;
    const k = inWin({ z0: H.z0, z1: H.z1, y0: H.y0, y1: H.y1 }, z, y, 0.04);
    if (k === 1) return S.SILVER;
    if (k === 2) {
      if (y < H.y0 + 0.08) return S.SILVER; // the counter
      if (y > 1.72 && z > -0.9 && z < 0.1) return (i + j) % 3 === 0 ? S.ACC_B : S.ACC_C; // the menu board
      if (y < 1.5 && z > 0.2 && z < 0.5) return (j & 1) === 0 ? S.SILVER : S.PLASTIC; // the fryer
      return y > 1.85 ? S.GLASS_D : S.BLACK;
    }
  } else {
    // A small side window behind the cab.
    const k = inWin({ z0: 0.6, z1: 1.3, y0: 1.5, y1: 1.95 }, z, y);
    if (k === 1) return S.BLACK;
    if (k === 2) return glassAt(0.6, z + y, i, j);
  }
  // The rear doors' shut line, the cab door.
  if (z > 1.5 && z < 1.53 && y < 2.0) return S.PAINT_D;
  return livery(y, i, j);
}

/** The cone of fries' paper: red and white stripes round it, the team's fries on top. */
function paintConePaper(sh: CarSheet): void {
  const r = sh.extra.cone;
  sh.paintRect(r, (i, j) => {
    if (j < 2) return S.PAINT_L;
    return ((i >> 2) & 1) === 0 ? S.ACC_A : S.PAINT_L;
  });
}

export function paintFrietbak(): { sheet: CarSheet; page: ReturnType<CarSheet['build']> } {
  const sh = new CarSheet(FRIETBAK_PAGE, FRAME, [{ name: 'cone', w: 48, h: 16 }], 256, TEXEL);
  sh.b.addRow(carRow([tone('snow', 3), tone('snow', 5), tone('snow', 6)], [tone('red', 5), tone('gold', 6), tone('brown', 2)]));
  for (const sd of ['L', 'R'] as const) {
    sh.paintSide(sd, (z, y, i, j) => side(z, y, sd, i, j));
    // The name in red on the white box, under the hatch (right) and the windows (left).
    sideTextScaled(sh, sd, NAME, -0.6, 1.12, S.ACC_A, 2);
  }
  const st = stations();
  const arc = topArc(st);
  sh.paintTop((x, s, i, j) => {
    const z = zAtArc(st, arc, s);
    const ax = x < 0 ? -x : x;
    if (z > F.screenFoot[0] + 0.04) return S.PAINT;
    if (z > F.screenFoot[0]) return S.BLACK;
    if (z > F.screenTop[0]) {
      const t = (F.screenFoot[0] - z) / (F.screenFoot[0] - F.screenTop[0]);
      if (ax > 0.9 || t > 0.95 || t < 0.04) return S.BLACK;
      return glassAt(1 - t, x * 0.6 + t, i, j);
    }
    if (z > 1.5) return S.ACC_A; // the red peak over the cab
    if (ax > 0.95) return S.PAINT_D;
    return bayer(i, j) < 4 ? S.PAINT_L : S.PAINT;
  });
  topTextScaled(sh, 'FRIETBAK', arcAtZ(st, arc, -1.5), S.ACC_A, 2);
  sh.paintCap('front', (x, y) => {
    const ax = x < 0 ? -x : x;
    if (y < F.bumperTop) return y < 0.3 ? S.PLASTIC : y > 0.4 ? S.ACC_B : S.PLASTIC;
    if (y > 0.6 && y < 0.82) {
      if (ax > 0.55 && ax < 0.82) return ax > 0.78 || y < 0.63 ? S.SILVER : S.LENS;
      if (ax >= 0.82) return S.AMBER;
      if (ax < 0.42) return (Math.floor(y * 30) & 1) === 0 ? S.BLACK : S.PLASTIC;
    }
    return y < 0.62 ? S.ACC_A : S.PAINT;
  });
  sh.paintCap('back', (x, y, i, j) => {
    const ax = x < 0 ? -x : x;
    if (y < F.bumperTop) return S.PLASTIC;
    if (ax > 0.78 && ax < 0.92 && y > 0.55 && y < 1.05) return y < 0.68 ? S.AMBER : S.RED;
    // Two rear doors with their windows.
    if (ax < 0.02) return S.PAINT_D;
    if (y > 1.6 && y < 2.05 && ax > 0.1 && ax < 0.7) return ax < 0.13 || ax > 0.67 || y < 1.63 || y > 2.02 ? S.BLACK : glassAt(0.5, x + y, i, j);
    return livery(y, i, j);
  });
  capTextScaled(sh, 'back', 'FRIETBAK', 0, 1.42, S.ACC_A, 1);
  paintConePaper(sh);
  paintWheel(sh, 'steel');
  paintTread(sh);
  sh.plates(PLATE);
  return { sheet: sh, page: sh.build() };
}

/** The giant cone of fries: the paper frustum, a yellow top and the fries sticking out. */
function fries(mb: MeshBuilder, sh: CarSheet): void {
  const c = F.cone;
  frustum(mb, sh, 0, c.z, c.y0, c.y1, c.r0, c.r1, 8, sh.extra.cone, S.PLATE);
  const sticks: [number, number, number][] = [
    [-0.25, -0.1, 0.45],
    [0.05, -0.3, 0.55],
    [0.28, 0.05, 0.4],
    [-0.05, 0.25, 0.5],
    [0.2, -0.25, 0.35],
    [-0.3, 0.2, 0.38],
  ];
  for (const [dx, dz, h] of sticks) slotBox(mb, sh, dx - 0.05, c.y1 - 0.02, c.z + dz - 0.05, dx + 0.05, c.y1 + h, c.z + dz + 0.05, S.PLATE);
  // A dollop of mayonnaise on top.
  slotBox(mb, sh, -0.12, c.y1, c.z - 0.12, 0.12, c.y1 + 0.16, c.z + 0.12, S.LENS);
}

export function buildFrietbak(id: string): RallyCarModel {
  const { sheet: sh, page } = paintFrietbak();
  const mb = new MeshBuilder();
  loft(mb, sh, stations());
  wells(mb, sh, 0.7, F.halfW - 0.005, [F.wheelF, F.wheelB], F.archR + 0.01, 0.85, false);
  // The serving hatch's flap, hinged at the top, open (both faces: red outside, white under it).
  const H = F.hatch;
  const x0 = -F.halfW;
  const x1 = -F.halfW - 0.55;
  const y1 = H.y1 + 0.32;
  const red = sh.solid(S.ACC_A);
  const white = sh.solid(S.PAINT_L);
  const flap = [
    [x0, H.y1 + 0.08, H.z0],
    [x0, H.y1 + 0.08, H.z1],
    [x1, y1, H.z1],
    [x1, y1, H.z0],
  ] as const;
  face(mb, flap, flap.map(() => [red[0], red[1]] as const), [0, 1, 0]);
  face(mb, flap, flap.map(() => [white[0], white[1]] as const), [0, -1, 0]);
  fries(mb, sh);
  for (const g of [1, -1]) box(mb, sh, g > 0 ? F.halfW - 0.02 : -1.14, 1.2, 1.9, g > 0 ? 1.14 : -F.halfW + 0.02, 1.45, 1.98, S.BLACK);
  plates(mb, sh, { z: F.nose + 0.006, y: 0.36 }, { z: F.tail - 0.006, y: 0.6 });
  const lod = new MeshBuilder();
  loft(lod, sh, lodStations());
  frustum(lod, sh, 0, F.cone.z, F.cone.y0, F.cone.y1 + 0.3, F.cone.r0, F.cone.r1, 4, sh.extra.cone, S.PLATE);
  const height = F.cone.y1 + 0.55;
  return assemble({
    id,
    sheet: sh,
    page,
    body: mb,
    lod,
    wheel: { x: F.wheelX, r: F.wheelR, w: F.wheelW, zf: F.wheelF, zb: F.wheelB, sides: 6 },
    shadow: [0.98, 2.6, 0.3],
    lamps: lampSet({ nose: F.nose, tail: F.tail, head: [0.68, 0.72, 0.12, 0.08], rear: [0.85, 0.88, 0.06, 0.15], indF: [0.88, 0.72, 0.05, 0.08], indB: [0.85, 0.62, 0.06, 0.05] }),
    box: { x0: -F.halfW, x1: F.halfW, y0: 0, y1: height, z0: F.tail, z1: F.nose },
    bumperCam: [0, 1.25, 2.45],
    rows: ['white'],
  });
}
