/**
 * The traffic's cars and vans (FIELD, wave B; docs/design/rally.md §6, §7.3): a 1990s saloon, an
 * estate, a taxi (the saloon with a roof sign), a panel van and a tall parcel van — our own plain
 * designs, no badges, no company names, made-up yellow plates, 120–250 triangles, the paint as CLUT
 * rows (palette swaps: `rows`). One parametric builder (`buildTrafficCar`) on CARS' loft with
 * five-point arches and six-sided wheels; each type is its numbers and its look. Pure.
 */
import type { Color } from '../../../../engine/color';
import { MeshBuilder } from '../mesh';
import { carRow, S, tone } from '../tex/car-palette';
import { glassAt, paintTread, paintWheel, type WheelStyle } from '../tex/car-parts';
import { bayer, CarSheet, type CarFrame } from '../tex/car-sheet';
import { HATCH_COLOURS } from '../tex/hatch';
import { PAGE_IDS } from '../../../rally/ids';
import { loft, topArc, zAtArc } from './loft';
import { plates, wells } from './parts';
import { CarShape, type Line } from './shape';
import type { RallyCarModel } from './types';
import { assemble, capTextScaled, inWin, lampSet, lowerParts, type Win } from './vehicle';

type Paint = readonly [Color, Color, Color];

/** A traffic car's numbers and look. */
export interface TrafficCarDef {
  readonly page: number;
  readonly plate: string;
  readonly nose: number;
  readonly tail: number;
  readonly halfW: number;
  readonly wheel: { readonly r: number; readonly w: number; readonly x: number; readonly zf: number; readonly zb: number; readonly arch: number };
  readonly belt: number;
  readonly glassTop: number;
  readonly roof: number;
  readonly top: Line;
  readonly screenFoot: readonly [number, number];
  readonly screenTop: readonly [number, number];
  /** The rear glass on the top line (z from → to), or none (a van's blind back). */
  readonly rearGlass?: readonly [number, number];
  /** The side windows behind the A-pillar (none = the A-pillar's glass to `cabEnd`). */
  readonly windows: readonly Win[];
  /** The cab's side glass ends here (vans): z. */
  readonly cabEnd?: number;
  readonly roofW: number;
  readonly tailW: Line;
  readonly stations: readonly number[];
  readonly lod: readonly number[];
  readonly bumper: { readonly f: number; readonly b: number; readonly top: number };
  readonly lamps: Parameters<typeof lampSet>[0];
  readonly wheelStyle: WheelStyle;
  readonly paints: readonly { readonly name: string; readonly paint: Paint }[];
  /** Accents (ACC_A, ACC_B, ACC_C): a stripe, a sign, … */
  readonly acc: Paint;
  /** A side stripe (ACC_A) from y0 to y1, or none. */
  readonly stripe?: readonly [number, number];
  /** Extra painting of a side texel (−1 = none). */
  readonly sideExtra?: (z: number, y: number, side: 'L' | 'R', i: number, j: number) => number;
  /** Extra geometry (a roof sign). */
  readonly extra?: (mb: MeshBuilder, sh: CarSheet) => void;
  readonly extras?: readonly { readonly name: string; readonly w: number; readonly h: number }[];
  /** Paint the extras' rectangles. */
  readonly paintExtras?: (sh: CarSheet) => void;
  /** Text on the back (a van's rear doors), or none. */
  readonly backText?: string;
  readonly bumperCam: readonly [number, number, number];
  readonly texel?: number;
}

const SHAPES = new WeakMap<TrafficCarDef, CarShape>();

function shapeOf(d: TrafficCarDef): CarShape {
  let s = SHAPES.get(d);
  if (s) return s;
  const W = d.wheel;
  s = new CarShape({
    nose: d.nose,
    tail: d.tail,
    halfW: d.halfW,
    endW: d.halfW - 0.05,
    wheelR: W.r,
    wheelW: W.w,
    wheelX: W.x,
    wheelF: W.zf,
    wheelB: W.zb,
    archR: W.arch,
    archD: W.arch * 0.7,
    sill: 0.24,
    endBottom: 0.22,
    endZone: Math.min(d.nose, -d.tail) - 0.15,
    belt: d.belt,
    glassTop: d.glassTop,
    roof: d.roof,
    top: d.top,
    screenFoot: d.screenFoot,
    screenTop: d.screenTop,
    noseTopW: d.halfW - 0.08,
    bonnetW: d.halfW - 0.03,
    screenFootW: d.halfW - 0.08,
    roofW: d.roofW,
    tailW: d.tailW,
    shoulderDrop: 0.02,
    aInset: 0.05,
  });
  SHAPES.set(d, s);
  return s;
}

/** Five-point arches round the two wheels. */
export function arches(zf: number, zb: number, r: number): number[] {
  const a = (zw: number): number[] => [zw + r, zw + r * 0.7, zw, zw - r * 0.7, zw - r];
  return [...a(zf), ...a(zb)];
}

function sidePaint(d: TrafficCarDef, z: number, y: number, sd: 'L' | 'R', i: number, j: number): number {
  const sh = shapeOf(d);
  const W = d.wheel;
  if (z < d.tail + 0.07 && y > d.lamps.rear[1] - d.lamps.rear[3] && y < d.lamps.rear[1] + d.lamps.rear[3]) return S.RED;
  if (z > d.nose - 0.07 && y > d.lamps.head[1] - 0.06 && y < d.lamps.head[1] + 0.06) return S.AMBER;
  const low = lowerParts(z, y, { bumperF: d.bumper.f, bumperB: d.bumper.b, bumperTop: d.bumper.top, bumper: S.PLASTIC, sill: 0.25, wheels: [W.zf, W.zb], r: W.r, archR: W.arch, lip: S.PLASTIC });
  if (low >= 0) return low;
  const ex = d.sideExtra?.(z, y, sd, i, j) ?? -1;
  if (ex >= 0) return ex;
  // The A-pillar's door glass (to the first window's front or the cab's end).
  if (y > d.belt && y < d.glassTop + 0.03) {
    const zA = sh.aPillarZ(y);
    const end = d.cabEnd ?? (d.windows.length > 0 ? d.windows[0].z1 : d.screenTop[0] - 0.6);
    if (z < zA + 0.03 && z > end - 0.03) {
      if (z > zA || z < end || y < d.belt + 0.025 || y > d.glassTop) return S.BLACK;
      return glassAt((y - d.belt) / (d.glassTop - d.belt), (sd === 'L' ? -z : z) * 0.8 + y, i, j);
    }
  }
  for (const w of d.windows) {
    const k = inWin(w, z, y, 0.03);
    if (k === 1) return S.BLACK;
    if (k === 2) return glassAt((y - w.y0) / Math.max(0.1, w.y1 - w.y0), (sd === 'L' ? -z : z) * 0.8 + y, i, j);
  }
  if (d.stripe && y > d.stripe[0] && y < d.stripe[1]) return S.ACC_A;
  if (y < 0.4 && bayer(i, j) * 0.012 > y - 0.25) return S.PAINT_D;
  return y > d.belt - 0.05 && y < d.belt + 0.01 ? S.PAINT_L : S.PAINT;
}

/** The page of a traffic car (one CLUT row per paint). */
export function paintTrafficCar(d: TrafficCarDef): { sheet: CarSheet; page: ReturnType<CarSheet['build']> } {
  const sh0 = shapeOf(d);
  const st = sh0.stations(d.stations);
  const arc = topArc(st);
  const frame: CarFrame = {
    z0: Math.max(d.nose, -d.tail) + 0.08,
    y0: d.roof + 0.08,
    y1: 0.12,
    x0: d.halfW + 0.04,
    topLen: arc[arc.length - 1] + 0.15,
    frontTop: d.top[0][1] + 0.08,
    backTop: d.top[d.top.length - 1][1] + 0.08,
  };
  const sh = new CarSheet(d.page, frame, d.extras ?? [], 256, d.texel ?? 32);
  for (const p of d.paints) sh.b.addRow(carRow(p.paint, d.acc));
  for (const sd of ['L', 'R'] as const) sh.paintSide(sd, (z, y, i, j) => sidePaint(d, z, y, sd, i, j));
  sh.paintTop((x, s, i, j) => {
    const z = zAtArc(st, arc, s);
    const ax = x < 0 ? -x : x;
    if (z > d.screenFoot[0] + 0.04) return S.PAINT;
    if (z > d.screenFoot[0]) return S.BLACK;
    if (z > d.screenTop[0]) {
      const t = (d.screenFoot[0] - z) / (d.screenFoot[0] - d.screenTop[0]);
      if (ax > d.halfW - 0.12 || t > 0.95 || t < 0.04) return S.BLACK;
      return glassAt(1 - t, x * 0.6 + t, i, j);
    }
    if (d.rearGlass && z < d.rearGlass[0] && z > d.rearGlass[1]) {
      const t = (d.rearGlass[0] - z) / (d.rearGlass[0] - d.rearGlass[1]);
      if (ax > d.roofW - 0.06 || t < 0.06 || t > 0.94) return S.BLACK;
      return glassAt(t, x * 0.6 + t, i, j);
    }
    return bayer(i, j) < 3 ? S.PAINT_L : S.PAINT;
  });
  sh.paintCap('front', (x, y) => {
    const ax = x < 0 ? -x : x;
    const L = d.lamps;
    if (y < d.bumper.top) return y > 0.3 && y < 0.36 && ax < 0.35 ? S.BLACK : S.PLASTIC;
    if (Math.abs(y - L.head[1]) < L.head[3] + 0.01) {
      if (ax > L.head[0] - L.head[2] && ax < L.head[0] + L.head[2]) return S.LENS;
      if (ax >= L.head[0] + L.head[2]) return S.AMBER;
      if (ax < 0.32) return (Math.floor(y * 32) & 1) === 0 ? S.BLACK : S.PLASTIC;
    }
    return S.PAINT;
  });
  sh.paintCap('back', (x, y, i, j) => {
    const ax = x < 0 ? -x : x;
    const R = d.lamps.rear;
    if (y < d.bumper.top) return S.PLASTIC;
    if (Math.abs(y - R[1]) < R[3] && ax > R[0] - R[2] && ax < R[0] + R[2] + 0.04) return ax > R[0] + R[2] - 0.02 ? S.AMBER : S.RED;
    if (d.rearGlass === undefined && d.cabEnd !== undefined && y > d.roof * 0.6 && y < d.roof - 0.25 && ax > 0.08 && ax < d.halfW - 0.2) {
      // A van's rear door windows.
      return ax < 0.11 || ax > d.halfW - 0.23 || y < d.roof * 0.6 + 0.03 || y > d.roof - 0.28 ? S.BLACK : glassAt(0.5, x + y, i, j);
    }
    if (ax < 0.012 && d.cabEnd !== undefined) return S.PAINT_D;
    return y < 0.6 && bayer(i, j) < 5 ? S.PAINT_D : S.PAINT;
  });
  if (d.backText) capTextScaled(sh, 'back', d.backText, 0, d.roof * 0.52, S.ACC_A, 1);
  d.paintExtras?.(sh);
  paintWheel(sh, d.wheelStyle);
  paintTread(sh);
  sh.plates(d.plate);
  return { sheet: sh, page: sh.build() };
}

/** A traffic car's model. */
export function buildTrafficCar(id: string, d: TrafficCarDef): RallyCarModel {
  const { sheet: sh, page } = paintTrafficCar(d);
  const shape = shapeOf(d);
  const W = d.wheel;
  const mb = new MeshBuilder();
  loft(mb, sh, shape.stations(d.stations));
  wells(mb, sh, d.halfW - 0.3, d.halfW - 0.005, [W.zf, W.zb], W.arch + 0.01, W.r + W.arch * 0.9, false);
  d.extra?.(mb, sh);
  plates(mb, sh, { z: d.nose + 0.006, y: 0.36 }, { z: d.tail - 0.006, y: Math.min(0.62, d.lamps.rear[1] - 0.12) }, 0.24, 0.055);
  const lod = new MeshBuilder();
  loft(lod, sh, shape.stations(d.lod));
  const height = d.roof + (d.extra ? 0.3 : 0);
  return assemble({
    id,
    sheet: sh,
    page,
    body: mb,
    lod,
    wheel: { x: W.x, r: W.r, w: W.w, zf: W.zf, zb: W.zb, sides: 6 },
    shadow: [d.halfW - 0.05, (d.nose - d.tail) / 2 - 0.1, 0.28],
    lamps: lampSet(d.lamps),
    box: { x0: -d.halfW, x1: d.halfW, y0: 0, y1: height, z0: d.tail, z1: d.nose },
    bumperCam: d.bumperCam,
    rows: d.paints.map((p) => p.name),
  });
}

const CAR_PAINTS = HATCH_COLOURS;
const ACC_PLAIN: Paint = [tone('cloth', 2), tone('steel', 3), tone('stone', 2)];

/** A 1990s four-door saloon. */
export const SALOON: TrafficCarDef = {
  page: PAGE_IDS.cars + 20,
  plate: 'HX-402-T',
  nose: 2.28,
  tail: -2.27,
  halfW: 0.86,
  wheel: { r: 0.3, w: 0.19, x: 0.73, zf: 1.4, zb: -1.3, arch: 0.34 },
  belt: 0.9,
  glassTop: 1.33,
  roof: 1.4,
  top: [
    [2.28, 0.76],
    [2.18, 0.79],
    [1.15, 0.9],
    [0.45, 1.38],
    [-0.85, 1.4],
    [-1.45, 1.0],
    [-2.17, 0.96],
    [-2.27, 0.92],
  ],
  screenFoot: [1.15, 0.9],
  screenTop: [0.45, 1.38],
  rearGlass: [-0.85, -1.45],
  windows: [{ z0: -1.0, z1: -0.22, y0: 0.92, y1: 1.31, leanB: 0.6 }],
  roofW: 0.7,
  tailW: [
    [-0.85, 0.7],
    [-1.45, 0.8],
    [-2.27, 0.8],
  ],
  stations: [2.28, ...arches(1.4, -1.3, 0.34), 0.45, -0.85, -2.27],
  lod: [2.28, 1.4, 1.15, 0.45, -0.85, -1.3, -1.45, -2.27],
  bumper: { f: 2.1, b: -2.12, top: 0.46 },
  lamps: { nose: 2.28, tail: -2.27, head: [0.55, 0.64, 0.18, 0.06], rear: [0.6, 0.76, 0.16, 0.07], indF: [0.78, 0.64, 0.04, 0.06], indB: [0.78, 0.76, 0.03, 0.07] },
  wheelStyle: 'cover',
  paints: CAR_PAINTS,
  acc: ACC_PLAIN,
  bumperCam: [0, 0.95, 1.8],
};

/** The taxi: the saloon in black or white with a roof sign (TAXI, our lettering). */
export const TAXI: TrafficCarDef = {
  ...SALOON,
  page: PAGE_IDS.cars + 21,
  plate: 'TX-777-B',
  paints: [
    { name: 'black', paint: [tone('ink', 0), tone('black', 1), tone('black', 3)] },
    { name: 'white', paint: [tone('snow', 3), tone('snow', 4), tone('snow', 5)] },
  ],
  acc: [tone('gold', 6), tone('steel', 3), tone('stone', 2)],
  extras: [{ name: 'sign', w: 20, h: 6 }],
  paintExtras: (sh) => {
    const r = sh.extra.sign;
    sh.b.fill(r, S.ACC_A);
    sh.textIn(r, 'TAXI', S.BLACK);
  },
  extra: (mb, sh) => {
    const r = sh.extra.sign;
    const face = [r.x + r.w, r.y + r.h, r.x, r.y] as const;
    mb.box(-0.3, 1.39, -0.25, 0.3, 1.56, -0.05, (f) => (f === 'front' || f === 'back' ? face : sh.solid(S.ACC_A)), [128, 128, 128]);
  },
};

/** A 1990s estate (a long roof, an upright tailgate). */
export const ESTATE_T: TrafficCarDef = {
  page: PAGE_IDS.cars + 22,
  plate: 'JS-118-N',
  nose: 2.35,
  tail: -2.35,
  halfW: 0.87,
  wheel: { r: 0.31, w: 0.19, x: 0.74, zf: 1.42, zb: -1.35, arch: 0.35 },
  belt: 0.92,
  glassTop: 1.4,
  roof: 1.48,
  top: [
    [2.35, 0.78],
    [2.25, 0.81],
    [1.2, 0.92],
    [0.5, 1.45],
    [-2.18, 1.48],
    [-2.3, 1.1],
    [-2.35, 1.0],
  ],
  screenFoot: [1.2, 0.92],
  screenTop: [0.5, 1.45],
  rearGlass: [-2.18, -2.3],
  windows: [
    { z0: -0.95, z1: -0.2, y0: 0.94, y1: 1.38 },
    { z0: -2.1, z1: -1.05, y0: 0.94, y1: 1.38, leanB: 0.15 },
  ],
  roofW: 0.74,
  tailW: [
    [-2.18, 0.74],
    [-2.35, 0.8],
  ],
  stations: [2.35, ...arches(1.42, -1.35, 0.35), 0.5, -0.4, -2.18, -2.35],
  lod: [2.35, 1.42, 1.2, 0.5, -1.35, -2.18, -2.35],
  bumper: { f: 2.18, b: -2.2, top: 0.47 },
  lamps: { nose: 2.35, tail: -2.35, head: [0.56, 0.66, 0.17, 0.06], rear: [0.72, 0.85, 0.08, 0.14], indF: [0.79, 0.66, 0.04, 0.06], indB: [0.72, 0.66, 0.08, 0.04] },
  wheelStyle: 'steel',
  paints: CAR_PAINTS,
  acc: ACC_PLAIN,
  bumperCam: [0, 0.98, 1.9],
};

const VAN_PAINTS: readonly { readonly name: string; readonly paint: Paint }[] = [
  { name: 'white', paint: [tone('snow', 3), tone('snow', 4), tone('snow', 5)] },
  { name: 'silver', paint: [tone('steel', 3), tone('steel', 4), tone('steel', 5)] },
  { name: 'blue', paint: [tone('navy', 3), tone('navy', 4), tone('sky', 1)] },
  { name: 'red', paint: [tone('red', 3), tone('red', 4), tone('red', 5)] },
  { name: 'yellow', paint: [tone('gold', 3), tone('gold', 4), tone('gold', 5)] },
  { name: 'green', paint: [tone('green', 1), tone('green', 2), tone('green', 3)] },
];

/** A panel van: a short bonnet, a tall box, glass only in the cab, rear doors. */
export const VAN: TrafficCarDef = {
  page: PAGE_IDS.cars + 23,
  plate: 'VB-60-ZK',
  nose: 2.4,
  tail: -2.4,
  halfW: 0.95,
  wheel: { r: 0.32, w: 0.2, x: 0.8, zf: 1.55, zb: -1.45, arch: 0.37 },
  belt: 1.05,
  glassTop: 1.72,
  roof: 1.95,
  top: [
    [2.4, 0.9],
    [2.3, 0.95],
    [1.65, 1.05],
    [1.0, 1.88],
    [0.7, 1.95],
    [-2.32, 1.95],
    [-2.4, 1.88],
  ],
  screenFoot: [1.65, 1.05],
  screenTop: [1.0, 1.88],
  windows: [],
  cabEnd: 0.6,
  roofW: 0.9,
  tailW: [
    [-2.32, 0.9],
    [-2.4, 0.88],
  ],
  stations: [2.4, ...arches(1.55, -1.45, 0.37), 1.0, 0.7, -2.32, -2.4],
  lod: [2.4, 1.55, 1.0, 0.7, -1.45, -2.4],
  bumper: { f: 2.25, b: -2.28, top: 0.45 },
  lamps: { nose: 2.4, tail: -2.4, head: [0.62, 0.72, 0.15, 0.07], rear: [0.82, 0.8, 0.06, 0.15], indF: [0.85, 0.72, 0.04, 0.07], indB: [0.82, 0.6, 0.06, 0.04] },
  wheelStyle: 'steel',
  paints: VAN_PAINTS,
  acc: ACC_PLAIN,
  bumperCam: [0, 1.1, 2.0],
};

/** The parcel van's livery: a stripe and a parcel icon of our own (no company name). */
function parcelSide(z: number, y: number): number {
  if (y > 1.6 && y < 1.68) return S.ACC_A;
  if (z > -1.2 && z < -0.2 && y > 1.85 && y < 2.3) {
    // A parcel: a box with its tape.
    if (z > -0.73 && z < -0.67) return S.ACC_A;
    if (y > 2.05 && y < 2.1) return S.ACC_A;
    return z < -1.15 || z > -0.25 || y < 1.9 || y > 2.25 ? S.ACC_C : S.ACC_B;
  }
  return -1;
}

const PARCEL_PAINTS: readonly { readonly name: string; readonly paint: Paint }[] = [
  { name: 'brown', paint: [tone('brown', 2), tone('brown', 3), tone('brown', 4)] },
  { name: 'yellow', paint: [tone('gold', 4), tone('gold', 5), tone('gold', 6)] },
  { name: 'white', paint: [tone('snow', 3), tone('snow', 4), tone('snow', 5)] },
  { name: 'red', paint: [tone('red', 4), tone('red', 5), tone('red', 6)] },
];

/** A tall parcel van (a step van: a flat front, a tall box, a sliding door). */
export const PARCEL: TrafficCarDef = {
  page: PAGE_IDS.cars + 24,
  plate: 'PK-24-DL',
  nose: 2.9,
  tail: -2.9,
  halfW: 1.05,
  wheel: { r: 0.36, w: 0.22, x: 0.86, zf: 1.9, zb: -1.6, arch: 0.41 },
  belt: 1.15,
  glassTop: 1.95,
  roof: 2.6,
  top: [
    [2.9, 1.0],
    [2.8, 1.06],
    [2.72, 1.12],
    [2.52, 2.12],
    [2.3, 2.55],
    [-2.84, 2.6],
    [-2.9, 2.55],
  ],
  screenFoot: [2.72, 1.12],
  screenTop: [2.52, 2.12],
  windows: [],
  cabEnd: 1.7,
  roofW: 1.0,
  tailW: [
    [-2.84, 1.0],
    [-2.9, 0.98],
  ],
  stations: [2.9, ...arches(1.9, -1.6, 0.41), 2.52, 2.3, -2.84, -2.9],
  lod: [2.9, 1.9, 2.52, 2.3, -1.6, -2.9],
  bumper: { f: 2.78, b: -2.8, top: 0.48 },
  lamps: { nose: 2.9, tail: -2.9, head: [0.7, 0.75, 0.13, 0.08], rear: [0.9, 0.85, 0.06, 0.15], indF: [0.92, 0.75, 0.05, 0.08], indB: [0.9, 0.64, 0.06, 0.05] },
  wheelStyle: 'steel',
  paints: PARCEL_PAINTS,
  acc: [tone('gold', 6), tone('sand', 6), tone('brown', 1)],
  sideExtra: parcelSide,
  backText: 'PAKKETTEN',
  bumperCam: [0, 1.3, 2.6],
  texel: 30,
};

/** Build each traffic car model. */
export const buildSaloon = (id: string): RallyCarModel => buildTrafficCar(id, SALOON);
export const buildTaxi = (id: string): RallyCarModel => buildTrafficCar(id, TAXI);
export const buildEstateT = (id: string): RallyCarModel => buildTrafficCar(id, ESTATE_T);
export const buildVan = (id: string): RallyCarModel => buildTrafficCar(id, VAN);
export const buildParcel = (id: string): RallyCarModel => buildTrafficCar(id, PARCEL);
