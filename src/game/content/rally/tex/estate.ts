/**
 * The estates' pages (docs/design/rally.md §6; ring spec §3 and decisions 13 / 13a): the squad's two
 * rally estates and the police estate, painted by code on the estate's shape (models/estate-shape.ts).
 * Likeness only: no maker badge anywhere (the grille has plain slats), made-up yellow plates, our own
 * lettering, never mirrored.
 *
 * - WHITE "rozzers" (1P, P1): white; the orange / yellow / orange waist band from the front wing to
 *   the tailgate; `ROZZERS` in white on a dark-blue box on both front doors; `619` on the band at the
 *   rear of the front wings; silver wheel covers (the push bar, its lamps and the rails are geometry).
 * - GREEN "safari" (P2): bottle green with darker camouflage; RIGHT side `ARTISANAL` over `GRAPE`
 *   (yellow) with a pink grape bunch; LEFT side `MAJOR` (big) over `COCKTAILS` (pink) with a cocktail
 *   glass (an orange slice, a straw); silver five-spoke alloys (the rack, the roof lamps, the spare
 *   tyre, a bag and a red jerrycan are geometry).
 * - POLICE: our own livery (no real force's design or emblem): white with one dark-blue band low on
 *   the sides and a thin gold line above it, `POLITIE` in white on the band and on the tailgate, steel
 *   wheels; the roof bar (geometry) carries `STOP POLITIE` (back) and `POLITIE` (front).
 *
 * Shading baked in lightly (the era's way): a highlight on the shoulder, darker lower panels by an
 * ordered dither, the glass' dark interior and its diagonal streak. Pure; fixed seeds.
 */
import { Rng } from '../../../../engine/rng';
import type { TexturePage } from '../../../../engine/view3d';
import { PAGE_IDS } from '../../../rally/ids';
import { aPillarZ, EST, EST_FRAME, estateStations } from '../models/estate-shape';
import { topArc, zAtArc } from '../models/loft';
import { carRow, S, tone } from './car-palette';
import { paintSpotLamp, paintTread, paintWheel, glassAt } from './car-parts';
import { bayer, CarSheet } from './car-sheet';

export type EstateKind = 'white' | 'green' | 'police';

/** The page id of each estate. */
export const ESTATE_PAGE: Readonly<Record<EstateKind, number>> = { white: PAGE_IDS.cars + 1, green: PAGE_IDS.cars + 2, police: PAGE_IDS.cars + 5 };

/** The made-up plates (no real registration). */
export const ESTATE_PLATE: Readonly<Record<EstateKind, string>> = { white: 'RZ-ZR-19', green: 'GR-AP-07', police: 'PL-17-TJ' };

/** The extra rectangles of an estate page. */
const EXTRAS = [
  { name: 'spot', w: 8, h: 8 },
  { name: 'display', w: 46, h: 7 },
  { name: 'barFront', w: 46, h: 7 },
];

export interface EstateTex {
  readonly sheet: CarSheet;
  readonly page: TexturePage;
  readonly kind: EstateKind;
}

const isPaint = (k: number): boolean => k === S.PAINT || k === S.PAINT_D || k === S.PAINT_L;

/** The plain body at a side texel (no livery): glass, pillars, lamps, bumpers, seams, shading. */
function baseSide(z: number, y: number, side: 'L' | 'R', i: number, j: number): number {
  const E = EST;
  // The tall rear lamp up the D-pillar's back edge.
  if (z < E.tailLamp && y >= E.tailLampY[0] && y <= E.tailLampY[1]) return y < E.amberY ? S.AMBER : y < E.reverseY ? S.LENS : S.RED;
  // The front corner: the amber indicator, then the headlamp's wrap.
  if (z > E.cornerZ[0] && y >= E.lampY[0] && y <= E.lampY[1]) return z > E.cornerZ[1] ? S.LENS : S.AMBER;
  // Bumpers (the front one a dark band over a body-colour apron), the rubbing strip, the lower skirt.
  if (z > E.bumperF && y < E.bumperTop && y > 0.25 && y < E.apronTop) return bayer(i, j) < 5 ? S.PAINT_D : S.PAINT;
  if ((z > E.bumperF || z < E.bumperB) && y < E.bumperTop) return y > E.bumperTop - 0.035 ? S.BLACK : S.PLASTIC;
  if (y >= E.strip[0] && y < E.strip[1]) return S.PLASTIC;
  if (y < 0.25) return S.PLASTIC;
  // The arch lip (a dark rim round each arch).
  for (const zw of [E.wheelF, E.wheelB]) {
    const dz = z - zw;
    const dy = y - E.wheelR;
    const d = Math.sqrt(dz * dz + dy * dy);
    if (d < E.archR + 0.035 && y > E.wheelR - 0.02) return S.PLASTIC;
  }
  // The glasshouse: the glass between the A- and the D-pillar, black pillars and surrounds.
  if (y > E.belt && y < E.glassTop + 0.03) {
    const zA = aPillarZ(y);
    if (z < zA + 0.035 && z > E.dPillar - 0.035) {
      const frame = y < E.belt + 0.03 || y > E.glassTop || z > zA || z < E.dPillar;
      const pillar = (z > E.pillarB[0] && z < E.pillarB[1]) || (z > E.pillarC[0] && z < E.pillarC[1]);
      if (frame || pillar) return S.BLACK;
      // Head restraints (front and rear seats) as dark shapes behind the glass.
      for (const zh of [0.16, -0.92]) if (y > 1.0 && y < 1.13 && z > zh - 0.07 && z < zh + 0.07) return S.GLASS_D;
      return glassAt((y - E.belt) / (E.glassTop - E.belt), (side === 'L' ? -z : z) * 0.8 + (y - E.belt) * 1.1, i, j);
    }
  }
  // Door shut lines and handles.
  if (y > 0.26 && y < E.belt) {
    for (const zs of E.seams) if (z > zs - 0.016 && z < zs + 0.016 && (zs !== E.seams[2] || y > 0.52)) return S.PAINT_D;
    if (y > 0.84 && y < 0.875 && ((z > 0.62 && z < 0.74) || (z > -0.5 && z < -0.38))) return S.BLACK;
  }
  // The fuel flap (right side, rear quarter).
  if (side === 'R' && y > 0.72 && y < 0.84 && z < -1.74 && z > -1.9 && (y < 0.735 || y > 0.825 || z > -1.755 || z < -1.885)) return S.PAINT_D;
  // Paint: the shoulder's highlight, darker lower panels.
  if (y > E.belt - 0.035) return S.PAINT_L;
  if (y < 0.42 && bayer(i, j) * 0.012 > y - 0.25) return S.PAINT_D;
  return S.PAINT;
}

/** The camouflage blobs of one surface: ellipses in that surface's metres. */
interface Blob {
  readonly a: number;
  readonly b: number;
  readonly ra: number;
  readonly rb: number;
  readonly dark: boolean;
}

function camo(seed: string, a0: number, a1: number, b0: number, b1: number, n: number, rb0: number, rb1: number): Blob[] {
  const rng = new Rng(seed);
  const out: Blob[] = [];
  for (let k = 0; k < n; k++) {
    out.push({ a: rng.range(a0, a1), b: rng.range(b0, b1), ra: rng.range(0.18, 0.42), rb: rng.range(rb0, rb1), dark: rng.chance(0.4) });
  }
  return out;
}

function camoAt(blobs: readonly Blob[], a: number, b: number, i: number, j: number): number {
  let hit = -1;
  for (const o of blobs) {
    const da = (a - o.a) / o.ra;
    const db = (b - o.b) / o.rb;
    const d = da * da + db * db;
    // A ragged edge: the 4 × 4 threshold nibbles the rim.
    if (d < 0.7 + bayer(i, j) * 0.03) hit = o.dark ? S.ACC_C : hit === S.ACC_C ? S.ACC_C : S.PAINT_D;
  }
  return hit;
}

/** The grape bunch (pink, a green stalk) and the cocktail glass (an orange slice, a straw). */
const GRAPES = ['..lg.', '.pp..', 'ppppp', '.ppp.', '.pp..', '..p..'];
const GLASS_ICON = ['o...s', 'oo.s.', 'aaaaa', '.rrr.', '..r..', '..w..', '..w..', '.www.'];

/** Paint one estate page. */
export function paintEstate(kind: EstateKind): EstateTex {
  const sh = new CarSheet(ESTATE_PAGE[kind], EST_FRAME, EXTRAS);
  const b = sh.b;
  // Row 0: the model's own colours.
  if (kind === 'white') b.addRow(carRow([tone('snow', 3), tone('snow', 4), tone('snow', 5)], [tone('orange', 3), tone('gold', 5), tone('navy', 3)]));
  else if (kind === 'green') b.addRow(carRow([tone('olive', 1), tone('green', 2), tone('green', 3)], [tone('pink', 4), tone('gold', 5), tone('olive', 0)]));
  else b.addRow(carRow([tone('snow', 3), tone('snow', 4), tone('snow', 5)], [tone('navy', 3), tone('sky', 3), tone('gold', 5)]));

  // Camouflage blobs in metres: along z and up the side (y), along z and across the top (x).
  const sideBlobs = { L: camo('rally/estate-green/camo-L', -2.4, 2.4, 0.25, 0.95, 18, 0.07, 0.16), R: camo('rally/estate-green/camo-R', -2.4, 2.4, 0.25, 0.95, 18, 0.07, 0.16) };
  for (const side of ['L', 'R'] as const) {
    sh.paintSide(side, (z, y, i, j) => {
      const k = baseSide(z, y, side, i, j);
      if (!isPaint(k)) return k;
      if (kind === 'white') {
        // The jam-sandwich band: orange, yellow, orange.
        if (z > -2.24 && z < EST.cornerZ[0] - 0.02 && y >= 0.66 && y < 0.84) return y >= 0.78 || y < 0.72 ? S.ACC_A : S.ACC_B;
      } else if (kind === 'police') {
        if (z > -2.24 && z < EST.cornerZ[0] - 0.02) {
          if (y >= 0.58 && y < 0.78) return S.ACC_A;
          if (y >= 0.8 && y < 0.83) return S.ACC_C;
        }
      } else {
        const c = camoAt(sideBlobs[side], z, y, i, j);
        if (c >= 0) return c;
      }
      return k;
    });
    if (kind === 'white') {
      // ROZZERS on a dark-blue box on the front door; 619 on the band at the rear of the front wing.
      sh.sideBox(side, 0.04, 0.92, 0.87, 0.625, S.ACC_C);
      sh.sideText(side, 'ROZZERS', 0.48, 0.835, S.PAINT_L);
      sh.sideText(side, '619', 1.1, 0.835, S.PAINT_L, { shadow: S.ACC_C });
    } else if (kind === 'green') {
      if (side === 'R') {
        sh.sideText(side, 'ARTISANAL', -0.12, 0.83, S.ACC_B, { gap: 2, shadow: S.ACC_C });
        sh.sideText(side, 'GRAPE', 0.12, 0.45, S.ACC_B, { gap: 2, shadow: S.ACC_C });
        sh.sideIcon(side, GRAPES, { p: S.ACC_A, g: S.PAINT_L, l: S.PAINT_L }, 0.73, 0.85);
      } else {
        sh.sideText(side, 'MAJOR', 0.46, 0.84, S.ACC_A, { size: 'big', gap: 1, shadow: S.ACC_C });
        sh.sideIcon(side, GLASS_ICON, { o: S.AMBER, s: S.ACC_A, a: S.AMBER, r: S.RED, w: S.LENS }, -0.12, 0.86);
        sh.sideText(side, 'COCKTAILS', 0.04, 0.45, S.ACC_A, { gap: 1, shadow: S.ACC_C });
      }
    } else {
      sh.sideText(side, 'POLITIE', 0.1, 0.755, S.PAINT_L, { gap: 2 });
    }
  }

  // The top: bonnet, windscreen, roof, the tailgate's top edge.
  const st = estateStations();
  const arc = topArc(st);
  const topBlobs = camo('rally/estate-green/camo-top', -2.3, 2.4, -0.85, 0.85, 16, 0.12, 0.28);
  sh.paintTop((x, s, i, j) => {
    const z = zAtArc(st, arc, s);
    const ax = x < 0 ? -x : x;
    let k: number;
    if (z > EST.screenFoot[0] + 0.06) {
      // The bonnet: its shut lines along the wings, a light front lip.
      k = ax > 0.75 && ax < 0.775 ? S.PAINT_D : S.PAINT;
    } else if (z > EST.screenFoot[0]) {
      k = S.BLACK; // the cowl and the wipers' spindles
    } else if (z > EST.screenTop[0]) {
      const t = (EST.screenFoot[0] - z) / (EST.screenFoot[0] - EST.screenTop[0]);
      const w = 0.8 + (0.74 - 0.8) * t;
      if (ax > w - 0.05 || t > 0.93) k = S.BLACK;
      else if (t < 0.22 && ((x > 0 && Math.abs(x - 0.05 - t * 1.6) < 0.025) || (x < 0 && Math.abs(-x - 0.12 - t * 1.6) < 0.025))) k = S.BLACK; // wipers
      else k = glassAt(1 - t, x * 0.7 + t * 0.9, i, j);
    } else if (z > EST.roofEnd) {
      k = ax < 0.6 && bayer(i, j) < 6 ? S.PAINT_L : S.PAINT;
    } else {
      k = z > -2.3 && ax < 0.62 ? S.PAINT_L : S.PAINT;
    }
    if (kind === 'green' && isPaint(k)) {
      const c = camoAt(topBlobs, z, x, i, j);
      if (c >= 0) return c;
    }
    return k;
  });

  // The nose: grille (plain slats: no badge), headlamps, corner indicators, the bumper.
  sh.paintCap('front', (x, y, i, j) => {
    const ax = x < 0 ? -x : x;
    if (y < EST.bumperTop) {
      if (y > EST.bumperTop - 0.035) return S.BLACK;
      if (y >= EST.apronTop || y < 0.24) return S.PLASTIC;
      // The apron: body colour with an air intake.
      if (y > 0.26 && y < 0.31 && ax < 0.55) return S.BLACK;
      return bayer(i, j) < 5 ? S.PAINT_D : S.PAINT;
    }
    if (y >= EST.lampY[0] && y <= EST.lampY[1]) {
      if (ax < 0.4) {
        if (ax > 0.37 || y < EST.lampY[0] + 0.03 || y > EST.lampY[1] - 0.03) return S.SILVER;
        return (j & 1) === 0 ? S.BLACK : S.PLASTIC;
      }
      if (ax < 0.44) return S.PAINT;
      if (ax < 0.78) return ax < 0.47 || y < EST.lampY[0] + 0.02 ? S.SILVER : y > 0.735 && ax > 0.5 && ax < 0.74 ? S.LENS : ax > 0.6 ? S.GLASS_L : S.SILVER;
      return S.AMBER;
    }
    if (y > 0.83) return S.PAINT_L;
    return bayer(i, j) < 4 ? S.PAINT_D : S.PAINT;
  });

  // The tail: the tall lamps, the tailgate glass with the high brake lamp, the plate recess, the bumper.
  sh.paintCap('back', (x, y, i, j) => {
    const ax = x < 0 ? -x : x;
    if (y < EST.bumperTop) return y > EST.bumperTop - 0.035 ? S.BLACK : S.PLASTIC;
    if (ax > 0.66 && y >= EST.tailLampY[0] && y <= EST.tailLampY[1]) return y < EST.amberY ? S.AMBER : y < EST.reverseY ? S.LENS : S.RED;
    if (ax > 0.635 && ax <= 0.66) return S.PAINT_D;
    if (y > 0.96 && y < 1.31 && ax < 0.6) {
      if (y > 1.27 && ax < 0.16) return S.RED;
      if (y < 0.99 || y > 1.28 || ax > 0.57) return S.BLACK;
      return glassAt((y - 0.96) / 0.35, x * 0.9 + y * 1.2, i, j);
    }
    if (y > 0.62 && y < 0.77 && ax < 0.3) return ax > 0.28 || y < 0.635 || y > 0.755 ? S.PAINT_D : S.PLASTIC;
    if (y > 0.78 && y < 0.8 && ax < 0.12) return S.SILVER;
    if (y > 1.29) return S.PAINT_L;
    return y < 0.66 && bayer(i, j) < 6 ? S.PAINT_D : S.PAINT;
  });
  if (kind === 'police') sh.capText('back', 'POLITIE', 0, 0.94, S.ACC_A);

  paintWheel(sh, kind === 'white' ? 'cover' : kind === 'green' ? 'alloy' : 'steel');
  paintTread(sh);
  sh.plates(ESTATE_PLATE[kind]);
  paintSpotLamp(sh, sh.extra.spot, kind === 'white');
  // The police roof bar's display (back: STOP POLITIE in red lamps) and its front (POLITIE).
  b.fill(sh.extra.display, S.BLACK);
  sh.textIn(sh.extra.display, 'STOP POLITIE', S.RED);
  b.fill(sh.extra.barFront, S.ACC_A);
  sh.textIn(sh.extra.barFront, 'POLITIE', S.PAINT_L, 2);
  return { sheet: sh, page: sh.build(), kind };
}
