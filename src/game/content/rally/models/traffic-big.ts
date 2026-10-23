/**
 * The traffic's big vehicles (FIELD, wave B; docs/design/rally.md §2, §6, §7.3): a lorry with a
 * curtain-sided trailer (a cab-over tractor, five axles; long: its slipstream pulls) and a coach —
 * our own plain designs, no badges, no company names (the coach's back shows a real place name,
 * AMSTERDAM), made-up yellow plates, about 250 triangles each, colour rows (palette swaps). Fewer
 * texels per metre (12 and 16) so the long sides fit one page. Pure.
 */
import type { Color } from '../../../../engine/color';
import { MeshBuilder } from '../mesh';
import { carRow, S, tone } from '../tex/car-palette';
import { glassAt, paintTread, paintWheel } from '../tex/car-parts';
import { bayer, CarSheet, type CarFrame } from '../tex/car-sheet';
import { PAGE_IDS } from '../../../rally/ids';
import { loft, topArc, zAtArc } from './loft';
import { plates, wells } from './parts';
import { CarShape } from './shape';
import type { RallyCarModel } from './types';
import { arches } from './traffic-cars';
import { assemble, capTextScaled, endPanel, lampSet, roofPanel, sidePanel, slotBox } from './vehicle';

type Tri = readonly [Color, Color, Color];

// -- the lorry ----------------------------------------------------------------------------------

export const LORRY_PAGE = PAGE_IDS.cars + 25;

const T = {
  nose: 8.0,
  cabBack: 5.9,
  trailerFront: 5.5,
  tail: -8.1,
  halfW: 1.25,
  wheelR: 0.5,
  wheelW: 0.3,
  wheelX: 1.0,
  wheelF: 7.1,
  wheelB: -6.7,
  axles: [4.5, -5.4],
  archR: 0.56,
  belt: 2.1,
  glassTop: 3.0,
  roof: 3.65,
  trailerY: [1.25, 3.95] as const,
  guard: [3.9, -4.6] as const,
} as const;

const CAB = new CarShape({
  nose: T.nose,
  tail: T.cabBack,
  halfW: T.halfW,
  endW: T.halfW - 0.05,
  wheelR: T.wheelR,
  wheelW: T.wheelW,
  wheelX: T.wheelX,
  wheelF: T.wheelF,
  // The cab has one axle under it: the "rear" arch lies outside its stations.
  wheelB: 0,
  archR: T.archR,
  archD: 0.4,
  sill: 0.62,
  endBottom: 0.45,
  endZone: 7.9,
  belt: T.belt,
  glassTop: T.glassTop,
  roof: T.roof,
  top: [
    [T.nose, 1.25],
    [7.98, 1.9],
    [7.9, 3.0],
    [7.7, 3.58],
    [7.3, 3.65],
    [T.cabBack, T.roof],
  ],
  screenFoot: [7.98, 1.9],
  screenTop: [7.9, 3.0],
  noseTopW: T.halfW - 0.08,
  bonnetW: T.halfW - 0.05,
  screenFootW: T.halfW - 0.05,
  roofW: T.halfW - 0.1,
  tailW: [[T.cabBack, T.halfW - 0.1]],
  shoulderDrop: 0.02,
  aInset: 0.06,
});

function cabStations(): ReturnType<CarShape['stations']> {
  const r = T.archR;
  return CAB.stations([T.nose, 7.9, T.wheelF + r, T.wheelF + r * 0.7, T.wheelF, T.wheelF - r * 0.7, T.wheelF - r, T.cabBack]);
}

const LORRY_FRAME: CarFrame = { z0: 8.2, y0: 4.02, y1: 0.1, x0: 1.3, topLen: 19, frontTop: 1.33, backTop: 4.02 };
const LORRY_TEXEL = 12;

/** The lorries' colours: the trailer's curtains (paint), the cab (ACC_A). */
const LORRY_ROWS: readonly { readonly name: string; readonly paint: Tri; readonly cab: Color }[] = [
  { name: 'white', paint: [tone('snow', 3), tone('snow', 4), tone('snow', 5)], cab: tone('red', 4) },
  { name: 'blue', paint: [tone('navy', 3), tone('navy', 4), tone('sky', 1)], cab: tone('snow', 5) },
  { name: 'red', paint: [tone('red', 3), tone('red', 4), tone('red', 5)], cab: tone('steel', 5) },
  { name: 'green', paint: [tone('green', 1), tone('green', 2), tone('green', 3)], cab: tone('green', 3) },
  { name: 'yellow', paint: [tone('gold', 4), tone('gold', 5), tone('gold', 6)], cab: tone('navy', 4) },
  { name: 'grey', paint: [tone('steel', 2), tone('steel', 3), tone('steel', 4)], cab: tone('orange', 3) },
];

function lorrySide(z: number, y: number, i: number, j: number): number {
  if (z > T.cabBack) {
    // The cab: its door glass, the step, a grille band, the cab colour.
    if (y < 0.62) return S.PLASTIC;
    if (y > T.belt && y < T.glassTop && z > 6.4 && z < 7.75) return y < T.belt + 0.06 || y > T.glassTop - 0.06 || z < 6.46 || z > 7.69 ? S.BLACK : glassAt((y - T.belt) / 0.9, -z * 0.6 + y, i, j);
    if (y > 0.9 && y < 1.0) return S.PLASTIC;
    if (z > 6.3 && z < 6.33 && y < T.belt) return S.PLASTIC;
    return y > 3.4 && bayer(i, j) < 6 ? S.ACC_B : S.ACC_A;
  }
  const [y0, y1] = T.trailerY;
  if (y >= y0 && y <= y1) {
    // The curtain: rails top and bottom, straps every 0.7 m, folds.
    if (y > y1 - 0.12) return S.SILVER;
    if (y < y0 + 0.12) return S.PLASTIC;
    const zs = z * 10;
    if (Math.floor(zs + 1000) % 7 === 0) return S.PAINT_D;
    return (i % 4 === 0 && bayer(i, j) < 9) ? S.PAINT_L : S.PAINT;
  }
  // Below the trailer: the side guard (silver with a black stripe), else the dark chassis.
  if (z < T.guard[0] && z > T.guard[1] && y > 0.5) return y > 0.85 && y < 0.92 ? S.BLACK : S.SILVER;
  return S.BLACK;
}

export function paintLorry(): { sheet: CarSheet; page: ReturnType<CarSheet['build']> } {
  const sh = new CarSheet(LORRY_PAGE, LORRY_FRAME, [], 256, LORRY_TEXEL);
  for (const r of LORRY_ROWS) sh.b.addRow(carRow(r.paint, [r.cab, tone('steel', 5), tone('ink', 1)]));
  for (const sd of ['L', 'R'] as const) sh.paintSide(sd, (z, y, i, j) => lorrySide(z, y, i, j));
  const st = cabStations();
  const arc = topArc(st);
  const cabLen = arc[arc.length - 1];
  sh.paintTop((x, s, i, j) => {
    const ax = x < 0 ? -x : x;
    if (s > cabLen) {
      // The trailer's roof (its own panel from `cabLen + 0.2`).
      return ax > 1.15 ? S.SILVER : bayer(i, j) < 3 ? S.PAINT_L : S.PAINT;
    }
    const z = zAtArc(st, arc, s);
    if (z > 7.985) return (Math.floor(s * 12) & 1) === 0 ? S.BLACK : S.PLASTIC; // the grille band
    if (z > 7.9) {
      const t = (7.98 - z) / 0.08;
      if (ax > 1.1 || t < 0.05 || t > 0.94) return S.BLACK;
      return glassAt(1 - t, x * 0.5 + t, i, j);
    }
    return S.ACC_A;
  });
  sh.paintCap('front', (x, y) => {
    const ax = x < 0 ? -x : x;
    if (y < 0.5) return S.PLASTIC;
    if (y > 0.82 && y < 1.0 && ax > 0.6 && ax < 1.1) return ax > 1.0 ? S.AMBER : S.LENS;
    return y < 0.62 ? S.PLASTIC : S.ACC_A;
  });
  sh.paintCap('back', (x, y, i, j) => {
    const ax = x < 0 ? -x : x;
    if (y < T.trailerY[0]) return S.BLACK;
    // The rear doors: two leaves, their bars, the lamps along the bottom, the striped edge.
    if (y < 1.5) {
      if (ax > 0.75 && ax < 1.15) return ax > 1.05 ? S.AMBER : S.RED;
      return (Math.floor(x * 6 + 12) & 1) === 0 ? S.RED : S.LENS;
    }
    if (ax < 0.02 || ax > 1.2) return S.PAINT_D;
    if ((ax > 0.3 && ax < 0.34) || (ax > 0.86 && ax < 0.9)) return S.SILVER;
    return bayer(i, j) < 4 ? S.PAINT_L : S.PAINT;
  });
  paintWheel(sh, 'steel');
  paintTread(sh);
  sh.plates('BX-77-TL');
  return { sheet: sh, page: sh.build() };
}

export function buildLorry(id: string): RallyCarModel {
  const { sheet: sh, page } = paintLorry();
  const mb = new MeshBuilder();
  const st = cabStations();
  loft(mb, sh, st);
  wells(mb, sh, T.halfW - 0.4, T.halfW - 0.005, [T.wheelF], T.archR + 0.01, 1.0, false);
  const cabLen = topArc(st)[st.length - 1];
  const [y0, y1] = T.trailerY;
  // The trailer: the curtain sides in pieces (the affine warp stays mild), the roof, the doors.
  for (const g of [1, -1]) sidePanel(mb, sh, g * T.halfW, T.trailerFront, T.tail, y0, y1, 3);
  roofPanel(mb, sh, y1, T.trailerFront, T.tail, T.halfW, cabLen + 0.2, 2);
  endPanel(mb, sh, 'back', T.tail, T.halfW, y0, y1);
  slotBox(mb, sh, -T.halfW + 0.02, y0, T.trailerFront - 0.02, T.halfW - 0.02, y1 - 0.02, T.trailerFront, S.PLASTIC);
  // The chassis under it all, the side guards.
  slotBox(mb, sh, -0.45, 0.62, T.tail + 0.2, 0.45, y0, T.cabBack, S.BLACK);
  for (const g of [1, -1]) sidePanel(mb, sh, g * (T.halfW - 0.04), T.guard[0], T.guard[1], 0.5, y0, 1);
  plates(mb, sh, { z: T.nose + 0.006, y: 0.62 }, { z: T.tail - 0.006, y: 1.1 });
  const lod = new MeshBuilder();
  loft(lod, sh, CAB.stations([T.nose, 7.9, T.wheelF, T.cabBack]));
  for (const g of [1, -1]) sidePanel(lod, sh, g * T.halfW, T.trailerFront, T.tail, y0, y1, 1);
  roofPanel(lod, sh, y1, T.trailerFront, T.tail, T.halfW, cabLen + 0.2, 1);
  endPanel(lod, sh, 'back', T.tail, T.halfW, y0, y1);
  return assemble({
    id,
    sheet: sh,
    page,
    body: mb,
    lod,
    wheel: { x: T.wheelX, r: T.wheelR, w: T.wheelW, zf: T.wheelF, zb: T.wheelB, sides: 6 },
    axles: T.axles,
    shadow: [1.2, 7.9, 0.4],
    lamps: lampSet({ nose: T.nose, tail: T.tail, head: [0.85, 0.91, 0.16, 0.07], rear: [0.9, 1.38, 0.12, 0.08], indF: [1.08, 0.91, 0.06, 0.07], indB: [1.12, 1.38, 0.06, 0.08] }),
    box: { x0: -T.halfW, x1: T.halfW, y0: 0, y1: y1, z0: T.tail, z1: T.nose },
    bumperCam: [0, 2.4, 7.8],
    rows: LORRY_ROWS.map((r) => r.name),
  });
}

// -- the coach ----------------------------------------------------------------------------------

export const COACH_PAGE = PAGE_IDS.cars + 26;

const K = {
  nose: 6.0,
  tail: -6.0,
  halfW: 1.275,
  wheelR: 0.5,
  wheelW: 0.3,
  wheelX: 1.0,
  wheelF: 3.9,
  wheelB: -2.9,
  tag: -4.15,
  archR: 0.56,
  belt: 1.62,
  glassTop: 2.95,
  roof: 3.5,
} as const;

const COACH = new CarShape({
  nose: K.nose,
  tail: K.tail,
  halfW: K.halfW,
  endW: K.halfW - 0.05,
  wheelR: K.wheelR,
  wheelW: K.wheelW,
  wheelX: K.wheelX,
  wheelF: K.wheelF,
  wheelB: K.wheelB,
  archR: K.archR,
  archD: 0.4,
  sill: 0.42,
  endBottom: 0.38,
  endZone: 5.8,
  belt: K.belt,
  glassTop: K.glassTop,
  roof: K.roof,
  top: [
    [K.nose, 1.15],
    [5.97, 1.6],
    [5.8, 3.25],
    [5.55, 3.5],
    [-5.85, K.roof],
    [K.tail, 3.3],
  ],
  screenFoot: [5.97, 1.6],
  screenTop: [5.8, 3.25],
  noseTopW: K.halfW - 0.08,
  bonnetW: K.halfW - 0.05,
  screenFootW: K.halfW - 0.05,
  roofW: K.halfW - 0.1,
  tailW: [
    [-5.85, K.halfW - 0.1],
    [K.tail, K.halfW - 0.12],
  ],
  shoulderDrop: 0.02,
  aInset: 0.05,
});

function coachStations(): ReturnType<CarShape['stations']> {
  return COACH.stations([K.nose, 5.55, ...arches(K.wheelF, K.wheelB, K.archR), K.tail]);
}

const COACH_FRAME: CarFrame = { z0: 6.1, y0: 3.56, y1: 0.1, x0: 1.32, topLen: 14.6, frontTop: 1.23, backTop: 3.38 };

const COACH_ROWS: readonly { readonly name: string; readonly a: Color; readonly b: Color }[] = [
  { name: 'blue', a: tone('navy', 4), b: tone('sky', 3) },
  { name: 'red', a: tone('red', 4), b: tone('orange', 4) },
  { name: 'green', a: tone('green', 2), b: tone('green', 5) },
  { name: 'purple', a: tone('purple', 3), b: tone('pink', 4) },
];

function coachSide(z: number, y: number, sd: 'L' | 'R', i: number, j: number): number {
  if (y < 0.42) return S.PLASTIC;
  for (const zw of [K.wheelF, K.wheelB]) {
    const dz = z - zw;
    const dy = y - K.wheelR;
    if (Math.sqrt(dz * dz + dy * dy) < K.archR + 0.04 && y > K.wheelR - 0.02) return S.PLASTIC;
  }
  // The door (right side, at the front): glass top to bottom.
  if (sd === 'R' && z > 4.65 && z < 5.6 && y > 0.45 && y < K.glassTop) {
    if (z < 4.7 || z > 5.55 || y > K.glassTop - 0.05 || (z > 5.1 && z < 5.14)) return S.BLACK;
    return glassAt(y / K.glassTop, z * 0.5 + y, i, j);
  }
  // The window band: tinted, with pillars every 1.4 m.
  if (y > K.belt && y < K.glassTop + 0.05 && z < 5.65 && z > -5.7) {
    if (y < K.belt + 0.05 || y > K.glassTop) return S.BLACK;
    const p = (z + 7) / 1.4;
    if (p - Math.floor(p) < 0.06) return S.BLACK;
    return glassAt(0.2, -z * 0.4 + y, i, j);
  }
  // The swoosh: two coloured bands that rise toward the back.
  const lift = (2 - z) * 0.05;
  if (y > 0.75 + lift && y < 0.95 + lift) return S.ACC_A;
  if (y > 0.98 + lift && y < 1.1 + lift) return S.ACC_B;
  // The luggage bay doors' lines.
  if (y > 0.5 && y < 1.5 && (Math.abs(z - 2.0) < 0.02 || Math.abs(z - 0.3) < 0.02 || Math.abs(z + 1.4) < 0.02)) return S.PAINT_D;
  return y > 3.1 && bayer(i, j) < 5 ? S.PAINT_L : S.PAINT;
}

export function paintCoach(): { sheet: CarSheet; page: ReturnType<CarSheet['build']> } {
  const sh = new CarSheet(COACH_PAGE, COACH_FRAME, [], 256, 16);
  for (const r of COACH_ROWS) sh.b.addRow(carRow([tone('snow', 3), tone('snow', 4), tone('snow', 5)], [r.a, r.b, tone('ink', 1)]));
  for (const sd of ['L', 'R'] as const) sh.paintSide(sd, (z, y, i, j) => coachSide(z, y, sd, i, j));
  const st = coachStations();
  const arc = topArc(st);
  sh.paintTop((x, s, i, j) => {
    const z = zAtArc(st, arc, s);
    const ax = x < 0 ? -x : x;
    if (z > 5.97) return ax < 1.0 && (Math.floor(s * 16) & 1) === 0 ? S.BLACK : S.PAINT;
    if (z > 5.8) {
      // The big windscreen, the destination display at its top.
      const t = (5.97 - z) / 0.17;
      if (ax > 1.18 || t < 0.03) return S.BLACK;
      if (t > 0.86) return t > 0.97 ? S.BLACK : S.ACC_C;
      return glassAt(1 - t, x * 0.4 + t, i, j);
    }
    if (ax > 1.12) return S.PAINT_D;
    return bayer(i, j) < 3 ? S.PAINT_L : S.PAINT;
  });
  sh.paintCap('front', (x, y) => {
    const ax = x < 0 ? -x : x;
    if (y < 0.38) return S.PLASTIC;
    if (y > 0.62 && y < 0.82 && ax > 0.55 && ax < 1.15) return ax > 1.05 ? S.AMBER : S.LENS;
    return y < 0.5 ? S.ACC_A : S.PAINT;
  });
  sh.paintCap('back', (x, y, i, j) => {
    const ax = x < 0 ? -x : x;
    if (y < 0.38) return S.PLASTIC;
    if (y > 0.8 && y < 1.4 && ax > 0.95 && ax < 1.2) return y < 0.95 ? S.AMBER : S.RED;
    if (y > 2.15 && y < 3.1 && ax < 1.0) return ax > 0.96 || y < 2.19 || y > 3.06 ? S.BLACK : glassAt((y - 2.15) / 0.95, x * 0.4 + y, i, j);
    if (y > 0.5 && y < 1.4 && ax < 0.8) return (Math.floor(y * 16) & 1) === 0 ? S.PLASTIC : S.PAINT_D; // the engine grille
    return bayer(i, j) < 4 ? S.PAINT_L : S.PAINT;
  });
  capTextScaled(sh, 'back', 'AMSTERDAM', 0, 1.95, S.ACC_A, 1);
  paintWheel(sh, 'steel');
  paintTread(sh);
  sh.plates('BB-41-RT');
  return { sheet: sh, page: sh.build() };
}

export function buildCoach(id: string): RallyCarModel {
  const { sheet: sh, page } = paintCoach();
  const mb = new MeshBuilder();
  loft(mb, sh, coachStations());
  wells(mb, sh, K.halfW - 0.4, K.halfW - 0.005, [K.wheelF, K.wheelB], K.archR + 0.01, 1.05, false);
  plates(mb, sh, { z: K.nose + 0.006, y: 0.5 }, { z: K.tail - 0.006, y: 0.6 });
  const lod = new MeshBuilder();
  loft(lod, sh, COACH.stations([K.nose, 5.8, K.wheelF, K.wheelB, K.tail]));
  return assemble({
    id,
    sheet: sh,
    page,
    body: mb,
    lod,
    wheel: { x: K.wheelX, r: K.wheelR, w: K.wheelW, zf: K.wheelF, zb: K.wheelB, sides: 6 },
    axles: [K.tag],
    shadow: [1.2, 5.9, 0.4],
    lamps: lampSet({ nose: K.nose, tail: K.tail, head: [0.85, 0.72, 0.28, 0.09], rear: [1.08, 1.17, 0.1, 0.22], indF: [1.1, 0.72, 0.05, 0.09], indB: [1.08, 0.87, 0.1, 0.07] }),
    box: { x0: -K.halfW, x1: K.halfW, y0: 0, y1: K.roof, z0: K.tail, z1: K.nose },
    bumperCam: [0, 1.6, 5.75],
    rows: COACH_ROWS.map((r) => r.name),
  });
}

