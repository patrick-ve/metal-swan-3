/**
 * The traffic hatchback's page (docs/design/rally.md §6): a plain small car of our own design, no
 * badge, a made-up plate. The paint comes in colour variants: one CLUT row each (`HATCH_COLOURS`;
 * a traffic car picks one with CarSpec.clutRow), the same slots for everything else, so the wheels,
 * the shadow and the lamps of every variant read the same. Pure.
 */
import type { Color } from '../../../../engine/color';
import type { TexturePage } from '../../../../engine/view3d';
import { PAGE_IDS } from '../../../rally/ids';
import { HAT, HAT_FRAME, HATCH, hatchStations } from '../models/hatch-shape';
import { topArc, zAtArc } from '../models/loft';
import { carRow, S, tone } from './car-palette';
import { glassAt, paintTread, paintWheel } from './car-parts';
import { bayer, CarSheet } from './car-sheet';

export const HATCH_PAGE = PAGE_IDS.cars + 4;
const PLATE = 'TF-56-KX';

/** The paint variants (dark, base, light) in CLUT row order; row 0 is the model's own. */
export const HATCH_COLOURS: readonly { readonly name: string; readonly paint: readonly [Color, Color, Color] }[] = [
  { name: 'red', paint: [tone('red', 3), tone('red', 4), tone('red', 5)] },
  { name: 'blue', paint: [tone('navy', 3), tone('navy', 4), tone('sky', 1)] },
  { name: 'silver', paint: [tone('steel', 3), tone('steel', 4), tone('steel', 5)] },
  { name: 'white', paint: [tone('snow', 3), tone('snow', 4), tone('snow', 5)] },
  { name: 'black', paint: [tone('ink', 0), tone('black', 1), tone('black', 3)] },
  { name: 'yellow', paint: [tone('gold', 3), tone('gold', 4), tone('gold', 5)] },
  { name: 'green', paint: [tone('green', 1), tone('green', 2), tone('green', 3)] },
  { name: 'teal', paint: [tone('teal', 1), tone('teal', 2), tone('teal', 3)] },
  { name: 'brown', paint: [tone('brown', 2), tone('brown', 3), tone('brown', 4)] },
  { name: 'orange', paint: [tone('rust', 2), tone('rust', 3), tone('rust', 4)] },
];

export interface HatchTex {
  readonly sheet: CarSheet;
  readonly page: TexturePage;
}

function baseSide(z: number, y: number, side: 'L' | 'R', i: number, j: number): number {
  const H = HAT;
  if (z < -1.86 && y > 0.56 && y < 0.82) return y < 0.62 ? S.AMBER : S.RED;
  if (z > 1.84 && y >= H.lampY[0] && y <= H.lampY[1]) return S.AMBER;
  if ((z > H.bumperF || z < H.bumperB) && y < H.bumperTop) return S.PLASTIC;
  if (y < 0.25) return S.PLASTIC;
  if (y > 0.4 && y < 0.45 && z > H.bumperB && z < H.bumperF) return S.PLASTIC; // a side protection strip
  for (const zw of [H.wheelF, H.wheelB]) {
    const dz = z - zw;
    const dy = y - H.wheelR;
    if (Math.sqrt(dz * dz + dy * dy) < H.archR + 0.035 && y > H.wheelR - 0.02) return S.PLASTIC;
  }
  if (y > H.belt && y < H.glassTop + 0.03) {
    const zA = HATCH.aPillarZ(y);
    // The rear side glass ends at the C-pillar, which leans with the hatch.
    const zC = -1.3 + (y - H.belt) * 0.35;
    if (z < zA + 0.035 && z > zC - 0.035) {
      if (y < H.belt + 0.03 || y > H.glassTop || z > zA || z < zC) return S.BLACK;
      if (z > H.pillarB[0] && z < H.pillarB[1]) return S.BLACK;
      if (y > 0.98 && y < 1.1 && ((z > 0.0 && z < 0.12) || (z > -0.92 && z < -0.8))) return S.GLASS_D;
      return glassAt((y - H.belt) / (H.glassTop - H.belt), (side === 'L' ? -z : z) * 0.8 + (y - H.belt) * 1.1, i, j);
    }
  }
  if (y > 0.27 && y < H.belt) {
    for (const zs of H.seams) if (z > zs - 0.016 && z < zs + 0.016) return S.PAINT_D;
    if (y > 0.8 && y < 0.83 && ((z > 0.5 && z < 0.6) || (z > -0.55 && z < -0.45))) return S.BLACK;
  }
  if (y > H.belt - 0.035) return S.PAINT_L;
  if (y < 0.4 && bayer(i, j) * 0.012 > y - 0.25) return S.PAINT_D;
  return S.PAINT;
}

export function paintHatch(): HatchTex {
  const sh = new CarSheet(HATCH_PAGE, HAT_FRAME);
  const acc = [tone('cloth', 2), tone('steel', 3), tone('stone', 2)] as const;
  for (const c of HATCH_COLOURS) sh.b.addRow(carRow(c.paint, acc));
  for (const side of ['L', 'R'] as const) sh.paintSide(side, (z, y, i, j) => baseSide(z, y, side, i, j));
  const st = hatchStations();
  const arc = topArc(st);
  sh.paintTop((x, s, i, j) => {
    const z = zAtArc(st, arc, s);
    const ax = x < 0 ? -x : x;
    if (z > HAT.screenFoot[0] + 0.05) return ax > 0.72 && ax < 0.745 ? S.PAINT_D : S.PAINT;
    if (z > HAT.screenFoot[0]) return S.BLACK;
    if (z > HAT.screenTop[0]) {
      const t = (HAT.screenFoot[0] - z) / (HAT.screenFoot[0] - HAT.screenTop[0]);
      const w = 0.76 + (0.68 - 0.76) * t;
      if (ax > w - 0.05 || t > 0.94) return S.BLACK;
      return glassAt(1 - t, x * 0.7 + t * 0.9, i, j);
    }
    if (z > HAT.roofEnd) return bayer(i, j) < 6 && ax < 0.55 ? S.PAINT_L : S.PAINT;
    if (z > HAT.hatchFoot[0]) {
      // The hatch's glass with its wiper.
      const t = (HAT.roofEnd - z) / (HAT.roofEnd - HAT.hatchFoot[0]);
      if (ax > 0.6 || t < 0.08 || t > 0.9) return S.BLACK;
      if (t > 0.7 && Math.abs(x - (t - 0.7) * 1.2) < 0.02) return S.BLACK;
      return glassAt(t, x * 0.7 + t, i, j);
    }
    return S.PAINT;
  });
  sh.paintCap('front', (x, y, i, j) => {
    const ax = x < 0 ? -x : x;
    if (y < HAT.bumperTop) return y > 0.3 && y < 0.36 && ax < 0.4 ? S.BLACK : S.PLASTIC;
    if (y >= HAT.lampY[0] && y <= HAT.lampY[1]) {
      if (ax < 0.34) return (j & 1) === 0 ? S.BLACK : S.PLASTIC;
      if (ax < 0.7) return y < HAT.lampY[0] + 0.02 ? S.SILVER : S.LENS;
      return S.AMBER;
    }
    return bayer(i, j) < 4 ? S.PAINT_D : S.PAINT;
  });
  sh.paintCap('back', (x, y, i, j) => {
    const ax = x < 0 ? -x : x;
    if (y < HAT.bumperTop) return S.PLASTIC;
    if (y > 0.56 && y < 0.82 && ax > 0.5) return y < 0.62 ? S.AMBER : y < 0.67 ? S.LENS : S.RED;
    if (y > 0.88) return S.PAINT_L;
    return y < 0.6 && bayer(i, j) < 6 ? S.PAINT_D : S.PAINT;
  });
  paintWheel(sh, 'steel');
  paintTread(sh);
  sh.plates(PLATE);
  return { sheet: sh, page: sh.build() };
}
