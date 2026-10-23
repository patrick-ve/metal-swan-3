/**
 * DE IJSCOMAN (FIELD, wave B; docs/design/rally.md §6): an ice-cream van of our own design — a
 * short bonnet, a tall rounded box in pastel pink and white with a mint waist line, the serving
 * window open on the right under a striped awning, and a giant ice cream (a wafer cone with two
 * scoops) on the roof over the cab. No badge; a made-up yellow plate; the team name on both sides,
 * on the roof and on the back. About 5.0 × 2.0 × 3.4 m. About 380 triangles. Wave C: its tune when
 * it is near. Pure.
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
import { assemble, capTextScaled, cone, inWin, lampSet, lowerParts, sideTextScaled, slotBox, topTextScaled } from './vehicle';

export const IJSCO_PAGE = PAGE_IDS.cars + 14;
const TEXEL = 30;
const NAME = 'DE IJSCOMAN';
const PLATE = 'IJ-55-CO';

const V = {
  nose: 2.5,
  tail: -2.5,
  halfW: 1.0,
  wheelR: 0.33,
  wheelW: 0.2,
  wheelX: 0.83,
  wheelF: 1.72,
  wheelB: -1.35,
  archR: 0.39,
  belt: 1.1,
  glassTop: 1.8,
  roof: 2.4,
  screenFoot: [2.12, 1.08] as const,
  screenTop: [1.72, 1.92] as const,
  bumperF: 2.36,
  bumperB: -2.38,
  bumperTop: 0.44,
  window: { z0: -1.2, z1: 0.5, y0: 1.25, y1: 2.0 },
  ice: { z: 1.25, y0: 2.42, y1: 2.95, r: 0.3 },
} as const;

const SHAPE = new CarShape({
  nose: V.nose,
  tail: V.tail,
  halfW: V.halfW,
  endW: 0.94,
  wheelR: V.wheelR,
  wheelW: V.wheelW,
  wheelX: V.wheelX,
  wheelF: V.wheelF,
  wheelB: V.wheelB,
  archR: V.archR,
  archD: 0.28,
  sill: 0.3,
  endBottom: 0.3,
  endZone: 2.3,
  belt: V.belt,
  glassTop: V.glassTop,
  roof: V.roof,
  top: [
    [V.nose, 0.95],
    [2.32, 1.02],
    [V.screenFoot[0], V.screenFoot[1]],
    [V.screenTop[0], V.screenTop[1]],
    [1.4, 2.36],
    [-2.3, V.roof],
    [-2.44, 2.32],
    [V.tail, 2.18],
  ],
  screenFoot: V.screenFoot,
  screenTop: V.screenTop,
  noseTopW: 0.88,
  bonnetW: 0.95,
  screenFootW: 0.95,
  roofW: 0.94,
  tailW: [
    [-2.3, 0.94],
    [-2.44, 0.9],
    [V.tail, 0.86],
  ],
  shoulderDrop: 0.03,
  aInset: 0.05,
});

function arch(zw: number): number[] {
  const r = V.archR;
  return [zw + r, zw + 0.27, zw, zw - 0.27, zw - r];
}

function stations(): ReturnType<CarShape['stations']> {
  return SHAPE.stations([V.nose, 2.32, ...arch(V.wheelF), V.screenFoot[0], V.screenTop[0], 1.4, -0.1, ...arch(V.wheelB), -2.3, -2.44, V.tail]);
}

function lodStations(): ReturnType<CarShape['stations']> {
  return SHAPE.stations([V.nose, V.wheelF + V.archR, V.screenFoot[0], V.screenTop[0], 1.4, V.wheelB, -2.3, V.tail]);
}

const FRAME: CarFrame = { z0: 2.6, y0: 2.46, y1: 0.12, x0: 1.04, topLen: 6.4, frontTop: 1.1, backTop: 2.36 };

/** Pink below the mint waist line, white above, a scalloped pink edge under the roof. */
function livery(z: number, y: number, i: number, j: number): number {
  if (y < 1.0) return y < 0.5 && bayer(i, j) < 5 ? S.PAINT_D : S.PAINT;
  if (y < 1.08) return S.ACC_B;
  const f = z * 4 - Math.floor(z * 4);
  const sc = 2.2 - 0.05 * (1 - Math.abs(f * 2 - 1));
  if (y > sc) return S.PAINT;
  return bayer(i, j) < 3 ? S.LENS : S.PAINT_L;
}

function side(z: number, y: number, sd: 'L' | 'R', i: number, j: number): number {
  if (z < -2.42 && y > 0.55 && y < 1.0) return y < 0.66 ? S.AMBER : S.RED;
  if (z > 2.4 && y > 0.6 && y < 0.76) return S.AMBER;
  const low = lowerParts(z, y, { bumperF: V.bumperF, bumperB: V.bumperB, bumperTop: V.bumperTop, bumper: S.SILVER, sill: 0.3, wheels: [V.wheelF, V.wheelB], r: V.wheelR, archR: V.archR, lip: S.PAINT_D });
  if (low >= 0) return low;
  if (z > 1.4 && y > V.belt && y < V.glassTop + 0.03) {
    const zA = SHAPE.aPillarZ(y);
    if (z < zA + 0.035) {
      if (z > zA || y < V.belt + 0.03 || y > V.glassTop || z < 1.46) return S.BLACK;
      return glassAt((y - V.belt) / (V.glassTop - V.belt), -z * 0.8 + y, i, j);
    }
  }
  if (sd === 'R') {
    // The serving window: the cones and the tubs inside, a counter, a price board.
    const W = V.window;
    const k = inWin(W, z, y, 0.04);
    if (k === 1) return S.SILVER;
    if (k === 2) {
      if (y < W.y0 + 0.07) return S.SILVER;
      if (y > 1.75 && (Math.floor(z * 8) & 1) === 0) return S.ACC_A; // rows of scoops on the board
      if (y < 1.45 && z < -0.4) return (i + j) % 2 === 0 ? S.ACC_C : S.PAINT_L; // the tubs
      return S.GLASS_D;
    }
  } else {
    const k = inWin({ z0: -1.8, z1: 0.9, y0: 1.35, y1: 1.95 }, z, y);
    if (k === 1) return S.BLACK;
    if (k === 2) return glassAt(0.6, z * 0.5 + y, i, j);
  }
  if (z > 1.4 && z < 1.43 && y < 1.95) return S.PAINT_D;
  return livery(z, y, i, j);
}

export function paintIjsco(): { sheet: CarSheet; page: ReturnType<CarSheet['build']> } {
  const sh = new CarSheet(IJSCO_PAGE, FRAME, [{ name: 'wafer', w: 36, h: 12 }, { name: 'awning', w: 24, h: 8 }], 256, TEXEL);
  sh.b.addRow(carRow([tone('pink', 3), tone('pink', 5), tone('pink', 6)], [tone('red', 5), tone('teal', 4), tone('brown', 4)]));
  for (const sd of ['L', 'R'] as const) {
    sh.paintSide(sd, (z, y, i, j) => side(z, y, sd, i, j));
    sideTextScaled(sh, sd, NAME, sd === 'R' ? -0.35 : -0.45, sd === 'R' ? 2.34 : 0.98 + 0.0, sd === 'R' ? S.ACC_A : S.PAINT_L, 2);
  }
  const st = stations();
  const arc = topArc(st);
  sh.paintTop((x, s, i, j) => {
    const z = zAtArc(st, arc, s);
    const ax = x < 0 ? -x : x;
    if (z > V.screenFoot[0] + 0.04) return S.PAINT;
    if (z > V.screenFoot[0]) return S.BLACK;
    if (z > V.screenTop[0]) {
      const t = (V.screenFoot[0] - z) / (V.screenFoot[0] - V.screenTop[0]);
      if (ax > 0.88 || t > 0.95 || t < 0.04) return S.BLACK;
      return glassAt(1 - t, x * 0.6 + t, i, j);
    }
    if (ax > 0.86) return S.ACC_B;
    return bayer(i, j) < 4 ? S.LENS : S.PAINT_L;
  });
  topTextScaled(sh, NAME, arcAtZ(st, arc, -1.2), S.ACC_A, 1);
  sh.paintCap('front', (x, y) => {
    const ax = x < 0 ? -x : x;
    if (y < V.bumperTop) return y > V.bumperTop - 0.03 ? S.LENS : y < 0.3 ? S.PLASTIC : S.SILVER;
    const dx = ax - 0.62;
    const dy = y - 0.72;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.1) return d > 0.075 ? S.SILVER : S.LENS;
    if (ax > 0.82 && y > 0.62 && y < 0.8) return S.AMBER;
    if (ax < 0.4 && y > 0.6 && y < 0.84) return (Math.floor(y * 30) & 1) === 0 ? S.SILVER : S.PLASTIC;
    return S.PAINT;
  });
  sh.paintCap('back', (x, y, i, j) => {
    const ax = x < 0 ? -x : x;
    if (y < V.bumperTop) return y > V.bumperTop - 0.03 ? S.LENS : y < 0.3 ? S.PLASTIC : S.SILVER;
    if (ax > 0.7 && ax < 0.86 && y > 0.55 && y < 1.0) return y < 0.66 ? S.AMBER : S.RED;
    if (y > 1.55 && y < 1.98 && ax < 0.55) return ax > 0.51 || y < 1.59 || y > 1.94 ? S.BLACK : glassAt(0.5, x + y, i, j);
    // A big painted ice cream on the back door.
    const cx = x;
    const cy = y - 1.0;
    if (cy > -0.35 && cy < 0.05 && Math.abs(cx) < (cy + 0.35) * 0.45) return (i + j) % 3 === 0 ? S.ACC_C : S.PLATE;
    const s1 = Math.sqrt(cx * cx + (cy - 0.14) * (cy - 0.14));
    if (s1 < 0.16) return S.PAINT_L;
    const s2 = Math.sqrt(cx * cx + (cy - 0.34) * (cy - 0.34));
    if (s2 < 0.13) return S.ACC_A;
    return livery(0, y, i, j);
  });
  capTextScaled(sh, 'back', 'IJSCOMAN', 0, 2.18, S.ACC_A, 1);
  // The wafer: a golden lattice; the awning: pink and white stripes.
  sh.paintRect(sh.extra.wafer, (i, j) => ((i + j) % 4 === 0 || (i - j + 64) % 4 === 0 ? S.ACC_C : S.PLATE));
  sh.paintRect(sh.extra.awning, (i) => ((i >> 2) & 1) === 0 ? S.PAINT : S.LENS);
  paintWheel(sh, 'chrome');
  paintTread(sh);
  sh.plates(PLATE);
  return { sheet: sh, page: sh.build() };
}

export function buildIjsco(id: string): RallyCarModel {
  const { sheet: sh, page } = paintIjsco();
  const mb = new MeshBuilder();
  loft(mb, sh, stations());
  wells(mb, sh, 0.68, V.halfW - 0.005, [V.wheelF, V.wheelB], V.archR + 0.01, 0.82, false);
  // The awning over the serving window (both faces: striped).
  const W = V.window;
  const aw = sh.extra.awning;
  const x0 = -V.halfW;
  const x1 = -V.halfW - 0.45;
  const pts = [
    [x0, W.y1 + 0.1, W.z0],
    [x0, W.y1 + 0.1, W.z1],
    [x1, W.y1 - 0.1, W.z1],
    [x1, W.y1 - 0.1, W.z0],
  ] as const;
  const uv = [
    [aw.x, aw.y],
    [aw.x + aw.w, aw.y],
    [aw.x + aw.w, aw.y + aw.h],
    [aw.x, aw.y + aw.h],
  ] as const;
  face(mb, pts, uv, [0, 1, 0]);
  face(mb, pts, uv, [0, -1, 0]);
  // The giant ice cream over the cab: the wafer cone, two scoops (strawberry, vanilla).
  const I = V.ice;
  cone(mb, 0, I.z, I.y0, I.y1, I.r, 6, sh.extra.wafer);
  slotBox(mb, sh, -0.3, I.y1 - 0.04, I.z - 0.3, 0.3, I.y1 + 0.3, I.z + 0.3, S.PAINT_L);
  slotBox(mb, sh, -0.24, I.y1 + 0.28, I.z - 0.24, 0.24, I.y1 + 0.5, I.z + 0.24, S.ACC_A);
  for (const g of [1, -1]) box(mb, sh, g > 0 ? V.halfW - 0.02 : -1.12, 1.15, 1.75, g > 0 ? 1.12 : -V.halfW + 0.02, 1.4, 1.83, S.BLACK);
  plates(mb, sh, { z: V.nose + 0.006, y: 0.36 }, { z: V.tail - 0.006, y: 0.6 });
  const lod = new MeshBuilder();
  loft(lod, sh, lodStations());
  slotBox(lod, sh, -0.28, I.y0, I.z - 0.28, 0.28, I.y1 + 0.45, I.z + 0.28, S.PAINT_L);
  const height = I.y1 + 0.5;
  return assemble({
    id,
    sheet: sh,
    page,
    body: mb,
    lod,
    wheel: { x: V.wheelX, r: V.wheelR, w: V.wheelW, zf: V.wheelF, zb: V.wheelB, sides: 6 },
    shadow: [0.96, 2.4, 0.3],
    lamps: lampSet({ nose: V.nose, tail: V.tail, head: [0.62, 0.72, 0.075, 0.075], rear: [0.78, 0.85, 0.06, 0.13], indF: [0.86, 0.71, 0.04, 0.07], indB: [0.78, 0.6, 0.06, 0.05] }),
    box: { x0: -V.halfW, x1: V.halfW, y0: 0, y1: height, z0: V.tail, z1: V.nose },
    bumperCam: [0, 1.22, 2.25],
    rows: ['pink'],
  });
}
