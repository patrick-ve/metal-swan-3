/**
 * The rival DE LAATSTE RIT's page (docs/design/rally.md §6): a black 1980s hearse of our own design,
 * no badge, a made-up plate. Black paint with a chrome belt strip and chrome bumpers, curtained rear
 * glass, a blind rear quarter with a chrome landau bar, the team name in gold on both sides and on
 * the roof (it reads from behind), chrome hubcaps, and the flowers on the roof (a top and a side
 * strip of blooms: pink, red, yellow and white on leaves). Pure; fixed seeds.
 */
import { Rng } from '../../../../engine/rng';
import type { TexturePage } from '../../../../engine/view3d';
import { PAGE_IDS } from '../../../rally/ids';
import { HEARSE, HRS, HRS_FRAME, hearseStations } from '../models/hearse-shape';
import { arcAtZ, topArc, zAtArc } from '../models/loft';
import { carRow, S, tone } from './car-palette';
import { glassAt, paintTread, paintWheel } from './car-parts';
import { bayer, CarSheet } from './car-sheet';
import type { TexRect } from './kit';

export const HEARSE_PAGE = PAGE_IDS.cars + 3;
export const HEARSE_TEAM = 'DE LAATSTE RIT';
const PLATE = 'DL-RT-80';

export interface HearseTex {
  readonly sheet: CarSheet;
  readonly page: TexturePage;
}

/** The landau bar: a chrome S on the blind rear quarter (z, y in metres → is it on the bar?). */
function landau(z: number, y: number): boolean {
  const zc = -2.08;
  const yc = 1.18;
  const dz = z - zc;
  const dy = y - yc;
  // Two arcs of an S: the upper bowl opens backwards, the lower one forwards.
  const r = 0.11;
  const up = Math.sqrt(dz * dz + (dy - r) * (dy - r));
  const lo = Math.sqrt(dz * dz + (dy + r) * (dy + r));
  if (up > r - 0.02 && up < r + 0.02 && !(dz > 0.02 && dy > r * 0.4)) return true;
  if (lo > r - 0.02 && lo < r + 0.02 && !(dz < -0.02 && dy < -r * 0.4)) return true;
  return false;
}

function baseSide(z: number, y: number, i: number, j: number): number {
  const H = HRS;
  // The rear lamp's wrap and the front corner.
  if (z < -2.76 && y >= H.tailLampY[0] && y <= H.tailLampY[1]) return S.RED;
  if (z > H.cornerZ[0] && y >= H.lampY[0] && y <= H.lampY[1]) return z > H.cornerZ[1] ? S.LENS : S.AMBER;
  // Chrome bumpers with a black rubber lip.
  if ((z > H.bumperF || z < H.bumperB) && y < H.bumperTop) return y > H.bumperTop - 0.03 ? S.LENS : y < 0.3 ? S.PLASTIC : S.SILVER;
  if (y < 0.27) return S.PLASTIC;
  // Arch lips.
  for (const zw of [H.wheelF, H.wheelB]) {
    const dz = z - zw;
    const dy = y - H.wheelR;
    if (Math.sqrt(dz * dz + dy * dy) < H.archR + 0.035 && y > H.wheelR - 0.02) return S.SILVER;
  }
  // The glasshouse.
  if (y > H.belt && y < H.glassTop + 0.03) {
    const zA = HEARSE.aPillarZ(y);
    if (z < zA + 0.035 && z > H.quarterEnd) {
      const frame = y < H.belt + 0.03 || y > H.glassTop || z > zA;
      if (frame) return S.BLACK;
      if (z > H.pillarB[0] && z < H.pillarB[1]) return S.BLACK;
      if (z < H.rearGlassEnd) {
        // The blind rear quarter: black vinyl with the chrome landau bar.
        if (landau(z, y)) return S.SILVER;
        return bayer(i, j) < 3 ? S.PAINT_L : S.PLASTIC;
      }
      if (z < H.pillarB[0]) {
        // The rear compartment's glass: drawn curtains in pleats, the rod above.
        if (z > H.rearGlassEnd + 0.03 && z < H.pillarB[0] - 0.03 && y < H.glassTop - 0.05 && y > H.belt + 0.06) return (i >> 1) % 2 === 0 ? S.LENS : S.SILVER;
        return glassAt(1, z * 0.6 + y, i, j);
      }
      if (y > 1.03 && y < 1.15 && z > 0.2 && z < 0.34) return S.GLASS_D; // a head restraint
      return glassAt((y - H.belt) / (H.glassTop - H.belt), -z * 0.8 + (y - H.belt) * 1.1, i, j);
    }
  }
  // The chrome belt strip, the seams, the handle.
  if (y > H.belt - 0.035 && y <= H.belt) return S.SILVER;
  if (y > 0.28 && y < H.belt) {
    for (const zs of H.seams) if (z > zs - 0.016 && z < zs + 0.016) return S.PAINT_D;
    if (y > 0.84 && y < 0.875 && z > 0.18 && z < 0.3) return S.SILVER;
  }
  if (y < 0.42 && bayer(i, j) * 0.012 > y - 0.27) return S.PAINT_D;
  return y > H.belt - 0.07 ? S.PAINT_L : S.PAINT;
}

/** Blooms on leaves (a flower bed seen from above or the side). */
function paintFlowers(sh: CarSheet, r: TexRect, seed: string): void {
  const rng = new Rng(seed);
  sh.paintRect(r, (i, j) => ((i * 3 + j * 5) % 7 === 0 ? S.PAINT_L : S.ACC_C));
  const blooms = [S.ACC_A, S.ACC_A, S.RED, S.ACC_B, S.LENS];
  const n = Math.floor((r.w * r.h) / 9);
  for (let k = 0; k < n; k++) {
    const x = rng.int(0, r.w - 1);
    const y = rng.int(0, r.h - 1);
    const c = blooms[rng.int(0, blooms.length - 1)];
    sh.b.set(r, x, y, c);
    if (rng.chance(0.5)) sh.b.set(r, x + 1, y, c);
    if (rng.chance(0.5)) sh.b.set(r, x, y + 1, c);
  }
}

export function paintHearse(): HearseTex {
  const sh = new CarSheet(HEARSE_PAGE, HRS_FRAME, [
    { name: 'flowersTop', w: 30, h: 54 },
    { name: 'flowersSide', w: 54, h: 4 },
  ]);
  sh.b.addRow(carRow([tone('ink', 0), tone('black', 1), tone('black', 3)], [tone('pink', 4), tone('gold', 6), tone('green', 3)]));
  for (const side of ['L', 'R'] as const) {
    sh.paintSide(side, (z, y, i, j) => baseSide(z, y, i, j));
    sh.sideText(side, HEARSE_TEAM, 0.25, 0.8, S.PLATE, { gap: 1 });
  }
  const st = hearseStations();
  const arc = topArc(st);
  sh.paintTop((x, s, i, j) => {
    const z = zAtArc(st, arc, s);
    const ax = x < 0 ? -x : x;
    if (z > HRS.screenFoot[0] + 0.06) return ax > 0.79 && ax < 0.815 ? S.PAINT_D : bayer(i, j) < 2 ? S.PAINT_L : S.PAINT;
    if (z > HRS.screenFoot[0]) return S.BLACK;
    if (z > HRS.screenTop[0]) {
      const t = (HRS.screenFoot[0] - z) / (HRS.screenFoot[0] - HRS.screenTop[0]);
      const w = 0.84 + (0.8 - 0.84) * t;
      if (ax > w - 0.05 || t > 0.93) return S.BLACK;
      return glassAt(1 - t, x * 0.7 + t * 0.9, i, j);
    }
    if (ax > 0.74) return S.SILVER; // the roof's chrome drip rails
    return bayer(i, j) < 5 ? S.PAINT_L : S.PAINT;
  });
    // The team name on the rear roof, behind the flowers: the cars behind read it.
  const at = arcAtZ(st, arc, -1.86);
  sh.topText('DE LAATSTE', at, S.PLATE);
  sh.topText('RIT', at + 0.22, S.PLATE);

  sh.paintCap('front', (x, y, i, j) => {
    const ax = x < 0 ? -x : x;
    if (y < HRS.bumperTop) return y > HRS.bumperTop - 0.03 ? S.LENS : y < 0.3 ? S.PLASTIC : y > 0.33 && y < 0.36 && ax < 0.6 ? S.PLASTIC : S.SILVER;
    if (y >= HRS.lampY[0] && y <= HRS.lampY[1]) {
      if (ax < 0.42) {
        if (ax > 0.39 || y < HRS.lampY[0] + 0.03 || y > HRS.lampY[1] - 0.03) return S.SILVER;
        return i % 3 === 0 ? S.SILVER : S.BLACK; // upright chrome bars, no badge
      }
      if (ax < 0.46) return S.PAINT;
      // Twin square lamps each side, the amber corner.
      if (ax < 0.82) return ax > 0.63 && ax < 0.66 ? S.SILVER : y < HRS.lampY[0] + 0.02 || y > HRS.lampY[1] - 0.02 ? S.SILVER : S.LENS;
      return S.AMBER;
    }
    return y > 0.82 ? S.PAINT_L : bayer(i, j) < 4 ? S.PAINT_D : S.PAINT;
  });
  sh.paintCap('back', (x, y, i, j) => {
    const ax = x < 0 ? -x : x;
    if (y < HRS.bumperTop) return y > HRS.bumperTop - 0.03 ? S.LENS : y < 0.3 ? S.PLASTIC : S.SILVER;
    if (y >= HRS.tailLampY[0] && y <= HRS.tailLampY[1] && ax > 0.42) return ax > 0.78 ? S.AMBER : y < 0.67 ? S.LENS : S.RED;
    if (y > 0.98 && y < 1.36 && ax < 0.64) {
      if (y < 1.01 || y > 1.33 || ax > 0.61) return S.BLACK;
      return (i >> 1) % 2 === 0 ? S.LENS : S.SILVER; // curtains in the rear door
    }
    if (y > 0.9 && y < 0.92) return S.SILVER;
    return y < 0.62 && bayer(i, j) < 6 ? S.PAINT_D : S.PAINT;
  });
  paintWheel(sh, 'chrome');
  paintTread(sh);
  sh.plates(PLATE);
  paintFlowers(sh, sh.extra.flowersTop, 'rally/hearse/flowers-top');
  paintFlowers(sh, sh.extra.flowersSide, 'rally/hearse/flowers-side');
  return { sheet: sh, page: sh.build() };
}
