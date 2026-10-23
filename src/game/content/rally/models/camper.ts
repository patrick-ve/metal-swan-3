/**
 * HUISJE OP WIELEN (FIELD, wave B; docs/design/rally.md §6): a 1970s coachbuilt camper of our own
 * design — a small cab with a short bonnet, a tall cream box with brown and orange stripes that
 * sweep up at the back, an over-cab bed (the luton) with its own little window, curtained windows, a
 * door on the right, a ladder and a spare wheel on the back. No badge; a made-up yellow plate; the
 * team name on both sides, on the roof and on the back. About 5.7 × 2.1 × 2.8 m; it leans in corners
 * (its spec's `lean`). About 420 triangles. Pure.
 */
import { MeshBuilder } from '../mesh';
import { carRow, S, tone } from '../tex/car-palette';
import { glassAt, paintTread, paintWheel } from '../tex/car-parts';
import { bayer, CarSheet, type CarFrame } from '../tex/car-sheet';
import { PAGE_IDS } from '../../../rally/ids';
import { arcAtZ, box, loft, topArc, zAtArc } from './loft';
import { endUV, plates, wells } from './parts';
import { CarShape } from './shape';
import type { RallyCarModel } from './types';
import { assemble, capTextScaled, inWin, lampSet, lowerParts, sideTextScaled, topTextScaled, type Win } from './vehicle';

export const CAMPER_PAGE = PAGE_IDS.cars + 11;
const TEXEL = 28;
const NAME = 'HUISJE OP WIELEN';
const PLATE = '72-HW-OP';

const C = {
  nose: 2.85,
  tail: -2.85,
  halfW: 1.05,
  wheelR: 0.36,
  wheelW: 0.22,
  wheelX: 0.86,
  wheelF: 1.95,
  wheelB: -1.6,
  archR: 0.42,
  belt: 1.13,
  glassTop: 1.8,
  roof: 2.75,
  screenFoot: [2.32, 1.14] as const,
  screenTop: [2.0, 1.86] as const,
  step: 1.78,
  bumperF: 2.68,
  bumperB: -2.72,
  bumperTop: 0.46,
  luton: { z0: 1.7, z1: 2.42, y0: 1.95, y1: 2.62, hw: 0.98 },
} as const;

const SHAPE = new CarShape({
  nose: C.nose,
  tail: C.tail,
  halfW: C.halfW,
  endW: 0.98,
  wheelR: C.wheelR,
  wheelW: C.wheelW,
  wheelX: C.wheelX,
  wheelF: C.wheelF,
  wheelB: C.wheelB,
  archR: C.archR,
  archD: 0.32,
  sill: 0.3,
  endBottom: 0.3,
  endZone: 2.6,
  belt: C.belt,
  glassTop: C.glassTop,
  roof: C.roof,
  top: [
    [C.nose, 1.02],
    [2.6, 1.08],
    [C.screenFoot[0], C.screenFoot[1]],
    [C.screenTop[0], C.screenTop[1]],
    [1.82, 1.9],
    [C.step, 2.72],
    [-2.72, C.roof],
    [C.tail, 2.62],
  ],
  screenFoot: C.screenFoot,
  screenTop: C.screenTop,
  noseTopW: 0.95,
  bonnetW: 1.0,
  screenFootW: 1.0,
  roofW: 1.03,
  tailW: [
    [-2.72, 1.03],
    [C.tail, 0.98],
  ],
  shoulderDrop: 0.03,
  aInset: 0.05,
});

function stations(): ReturnType<CarShape['stations']> {
  return SHAPE.stations([C.nose, 2.6, ...SHAPE.archZ(C.wheelF), C.screenFoot[0], C.screenTop[0], 1.82, C.step, 0.2, -0.9, ...SHAPE.archZ(C.wheelB), -2.72, C.tail]);
}

function lodStations(): ReturnType<CarShape['stations']> {
  const r = C.archR;
  return SHAPE.stations([C.nose, C.wheelF + r, C.screenFoot[0], C.screenTop[0], C.step, C.wheelB + r, C.wheelB - r, C.tail]);
}

const FRAME: CarFrame = { z0: 2.95, y0: 2.82, y1: 0.12, x0: 1.1, topLen: 7.4, frontTop: 2.7, backTop: 2.8 };

/** The box's windows (with curtains) per side; the cab's door glass is the A-pillar's. */
const WINS: Readonly<Record<'L' | 'R', readonly Win[]>> = {
  L: [
    { z0: -0.55, z1: 0.75, y0: 1.5, y1: 2.05 },
    { z0: -2.45, z1: -1.45, y0: 1.5, y1: 2.05 },
  ],
  R: [
    { z0: -0.95, z1: 0.2, y0: 1.5, y1: 2.05 },
    { z0: -2.45, z1: -1.7, y0: 1.5, y1: 2.05 },
    // The door's own small window.
    { z0: 0.62, z1: 1.18, y0: 1.65, y1: 2.05 },
  ],
};
const DOOR = { z0: 0.55, z1: 1.25, y0: 0.42, y1: 2.2 };

/** The stripes: brown, orange, brown, sweeping up toward the back. */
function stripe(z: number, y: number): number {
  const lift = z < -0.3 ? (-0.3 - z) * 0.32 : 0;
  const yc = 1.3 + lift;
  const d = y - yc;
  if (d > -0.05 && d < 0.0) return S.ACC_A;
  if (d >= 0.0 && d < 0.07) return S.ACC_B;
  if (d >= 0.07 && d < 0.1) return S.ACC_A;
  return -1;
}

/** Orange gingham curtains with a pleat every other texel column. */
function curtain(i: number, j: number): number {
  return ((i >> 1) + (j >> 1)) % 2 === 0 ? S.ACC_B : S.PAINT_L;
}

function side(z: number, y: number, sd: 'L' | 'R', i: number, j: number): number {
  // The rear lamps' wrap and the front indicator.
  if (z < -2.76 && y > 0.5 && y < 1.0) return y < 0.62 ? S.AMBER : S.RED;
  if (z > 2.74 && y > 0.64 && y < 0.8) return S.AMBER;
  const low = lowerParts(z, y, { bumperF: C.bumperF, bumperB: C.bumperB, bumperTop: C.bumperTop, bumper: S.SILVER, sill: 0.32, wheels: [C.wheelF, C.wheelB], r: C.wheelR, archR: C.archR, lip: S.PAINT_D });
  if (low >= 0) return low;
  // The cab's door glass.
  if (z > C.step + 0.04 && y > C.belt && y < C.glassTop + 0.03) {
    const zA = SHAPE.aPillarZ(y);
    if (z < zA + 0.035) {
      if (z > zA || y < C.belt + 0.03 || y > C.glassTop || z < C.step + 0.08) return S.BLACK;
      return glassAt((y - C.belt) / (C.glassTop - C.belt), -z * 0.8 + y, i, j);
    }
  }
  // The box: windows with curtains, the door, the stripes.
  for (const w of WINS[sd]) {
    const k = inWin(w, z, y, 0.04);
    if (k === 1) return S.SILVER;
    if (k === 2) return y > w.y1 - 0.08 || (j + i) % 7 === 0 ? glassAt(0.5, z + y, i, j) : curtain(i, j);
  }
  if (sd === 'R' && z > DOOR.z0 && z < DOOR.z1 && y > DOOR.y0 && y < DOOR.y1) {
    if (z < DOOR.z0 + 0.03 || z > DOOR.z1 - 0.03 || y > DOOR.y1 - 0.03) return S.PAINT_D;
    if (y > 1.1 && y < 1.14 && z > DOOR.z0 + 0.06 && z < DOOR.z0 + 0.18) return S.SILVER;
  }
  const st = stripe(z, y);
  if (st >= 0) return st;
  // A rain gutter under the roof, a seam at the box's foot, the cab door's shut line.
  if (y > 2.6 && y < 2.63) return S.PAINT_D;
  if (z > 2.0 && z < 2.03 && y < C.belt) return S.PAINT_D;
  if (y < 0.6 && bayer(i, j) * 0.02 > y - 0.32) return S.PAINT_D;
  return y > 2.45 && bayer(i, j) < 6 ? S.PAINT_L : S.PAINT;
}

export function paintCamper(): { sheet: CarSheet; page: ReturnType<CarSheet['build']> } {
  const sh = new CarSheet(CAMPER_PAGE, FRAME, [{ name: 'vent', w: 12, h: 12 }], 256, TEXEL);
  sh.b.addRow(carRow([tone('sand', 5), tone('sand', 6), tone('sand', 7)], [tone('brown', 3), tone('orange', 4), tone('brown', 1)]));
  for (const sd of ['L', 'R'] as const) {
    sh.paintSide(sd, (z, y, i, j) => side(z, y, sd, i, j));
    sideTextScaled(sh, sd, NAME, -0.55, 2.58, S.ACC_C, 2);
  }
  const st = stations();
  const arc = topArc(st);
  sh.paintTop((x, s, i, j) => {
    const z = zAtArc(st, arc, s);
    const ax = x < 0 ? -x : x;
    if (z > C.screenFoot[0] + 0.04) return ax > 0.9 ? S.PAINT_D : S.PAINT;
    if (z > C.screenFoot[0]) return S.BLACK;
    if (z > C.screenTop[0]) {
      const t = (C.screenFoot[0] - z) / (C.screenFoot[0] - C.screenTop[0]);
      if (ax > 0.93 || t > 0.95 || t < 0.05) return S.BLACK;
      return glassAt(1 - t, x * 0.6 + t, i, j);
    }
    if (z > C.step) return S.PAINT_D;
    // The box roof: a lighter cream, the team name toward the back (the cars behind read it).
    if (ax > 0.96) return S.PAINT_D;
    return bayer(i, j) < 4 ? S.PAINT : S.PAINT_L;
  });
  topTextScaled(sh, NAME, arcAtZ(st, arc, -1.8), S.ACC_A, 1);
  topTextScaled(sh, 'HUISJE', arcAtZ(st, arc, 0.4), S.ACC_A, 2);
  sh.paintCap('front', (x, y, i, j) => {
    const ax = x < 0 ? -x : x;
    if (y > 1.9) {
      // The luton's front: cream, the stripe, a small window.
      if (y > 2.2 && y < 2.48 && ax < 0.45) return ax > 0.41 || y < 2.23 || y > 2.45 ? S.SILVER : curtain(i, j);
      if (y > 2.04 && y < 2.12) return S.ACC_B;
      if (y > 2.0 && y < 2.16) return S.ACC_A;
      return bayer(i, j) < 3 ? S.PAINT_L : S.PAINT;
    }
    if (y < C.bumperTop) return y > C.bumperTop - 0.03 ? S.LENS : y < 0.3 ? S.PLASTIC : S.SILVER;
    // Round headlamps in chrome rings, a slatted grille between them, the amber corners.
    const dx = ax - 0.68;
    const dy = y - 0.72;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.11) return d > 0.085 ? S.SILVER : S.LENS;
    if (ax > 0.84 && y > 0.64 && y < 0.8) return S.AMBER;
    if (ax < 0.45 && y > 0.58 && y < 0.88) return (j & 1) === 0 ? S.BLACK : S.SILVER;
    return y > 0.95 ? S.PAINT_L : S.PAINT;
  });
  sh.paintCap('back', (x, y, i, j) => {
    const ax = x < 0 ? -x : x;
    if (y < C.bumperTop) return y > C.bumperTop - 0.03 ? S.LENS : y < 0.3 ? S.PLASTIC : S.SILVER;
    // Tall tail lamps, the rear window with curtains, the ladder (left), the spare wheel (right).
    if (ax > 0.76 && ax < 0.9 && y > 0.5 && y < 1.0) return y < 0.62 ? S.AMBER : S.RED;
    if (y > 1.62 && y < 2.12 && ax < 0.42) return ax > 0.38 || y < 1.66 || y > 2.08 ? S.SILVER : curtain(i, j);
    if (x > 0.48 && x < 0.66 && y > 0.6 && y < 2.7) {
      if (x < 0.51 || x > 0.63) return S.SILVER;
      if (Math.floor(y * 28) % 8 === 0) return S.SILVER;
    }
    const sx = x + 0.48;
    const sy = y - 1.05;
    const ds = Math.sqrt(sx * sx + sy * sy);
    if (ds < 0.3) return ds > 0.22 ? S.BLACK : ds > 0.12 ? S.SILVER : S.PAINT_D;
    const stp = stripe(-2.85, y);
    if (stp >= 0) return stp;
    return y < 0.6 && bayer(i, j) < 6 ? S.PAINT_D : S.PAINT;
  });
  capTextScaled(sh, 'back', 'HUISJE', 0, 2.55, S.ACC_C, 1);
  capTextScaled(sh, 'back', 'OP WIELEN', 0, 2.33, S.ACC_C, 1);
  // The roof vent: a grey square with slats.
  sh.paintRect(sh.extra.vent, (i, j) => (i === 0 || j === 0 || i === 11 || j === 11 ? S.PLASTIC : (j & 1) === 0 ? S.SILVER : S.PLASTIC));
  paintWheel(sh, 'steel');
  paintTread(sh);
  sh.plates(PLATE);
  return { sheet: sh, page: sh.build() };
}

export function buildCamper(id: string): RallyCarModel {
  const { sheet: sh, page } = paintCamper();
  const mb = new MeshBuilder();
  loft(mb, sh, stations());
  wells(mb, sh, 0.72, C.halfW - 0.005, [C.wheelF, C.wheelB], C.archR + 0.01, 0.9, false);
  // The luton over the cab: its sides on the side texture, its front on the front cap.
  const Lt = C.luton;
  mb.box(-Lt.hw, Lt.y0, Lt.z0, Lt.hw, Lt.y1, Lt.z1, (f) => {
    if (f === 'left') return [sh.sideU('L', Lt.z0), sh.sideV('L', Lt.y0), sh.sideU('L', Lt.z1), sh.sideV('L', Lt.y1)];
    if (f === 'right') return [sh.sideU('R', Lt.z1), sh.sideV('R', Lt.y0), sh.sideU('R', Lt.z0), sh.sideV('R', Lt.y1)];
    if (f === 'front') return [sh.capU('front', Lt.hw), sh.capV('front', Lt.y0), sh.capU('front', -Lt.hw), sh.capV('front', Lt.y1)];
    return sh.solid(S.PAINT);
  }, [128, 128, 128]);
  // A roof vent, the mirrors on stalks.
  mb.box(-0.3, C.roof, -0.9, 0.3, C.roof + 0.1, -0.4, (f) => (f === 'top' ? endUV(sh.extra.vent) : sh.solid(S.PLASTIC)), [128, 128, 128]);
  for (const g of [1, -1]) box(mb, sh, g > 0 ? C.halfW - 0.02 : -1.16, 1.25, 2.0, g > 0 ? 1.16 : -C.halfW + 0.02, 1.5, 2.08, S.BLACK);
  plates(mb, sh, { z: C.nose + 0.006, y: 0.36 }, { z: C.tail - 0.006, y: 0.62 });
  const lod = new MeshBuilder();
  loft(lod, sh, lodStations());
  lod.box(-Lt.hw, Lt.y0, Lt.z0, Lt.hw, Lt.y1, Lt.z1, () => sh.solid(S.PAINT), [128, 128, 128]);
  const height = C.roof + 0.1;
  return assemble({
    id,
    sheet: sh,
    page,
    body: mb,
    lod,
    wheel: { x: C.wheelX, r: C.wheelR, w: C.wheelW, zf: C.wheelF, zb: C.wheelB },
    shadow: [1.0, 2.75, 0.32],
    lamps: lampSet({ nose: C.nose, tail: C.tail, head: [0.68, 0.72, 0.085, 0.085], rear: [0.83, 0.85, 0.07, 0.14], indF: [0.9, 0.72, 0.05, 0.07], indB: [0.83, 0.56, 0.07, 0.05] }),
    box: { x0: -C.halfW, x1: C.halfW, y0: 0, y1: height, z0: C.tail, z1: C.nose },
    bumperCam: [0, 1.3, 2.6],
    rows: ['cream'],
  });
}
