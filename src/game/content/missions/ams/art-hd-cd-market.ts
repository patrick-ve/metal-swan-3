/**
 * UHD art (d 2 and 4) of the Waterlooplein flea-market stalls `decor/ams/market-stall` (frames
 * 0–2; 1× art in art.ts `marketStall`): static decor of sections c and d, outline C (the deepest
 * tone on the lit side, ink on the shadow side) so the stalls sit in the painted street.
 *
 * A striped canvas awning sloping to the front (seams, a soft sag, a scalloped hem), steel tube
 * posts, a grained table board with panelled front, and the goods: (0) shirts and dresses on
 * hangers along a rail, (1) crates of records with sleeves and a few vinyl discs, (2) table lamps
 * and glazed vases with glints.
 */
import { PAL_HD } from '../../../../engine/palette-hd';
import type { PixelBuffer, Ramp } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { wood as woodTex } from '../../../art/hd/index';
import { hash2, noise2 } from '../../../art/paint';
import { decoMat, HdCanvas, hdStrip, metalMat } from './art-hd-cd-kit';

const ID = 'decor/ams/market-stall';

/** Awning stripe A, stripe B and the goods of each frame (the 1× STALL_SETS, as HD ramps). */
const SETS: readonly (readonly [Ramp, Ramp, Ramp])[] = [
  [PAL_HD.red, PAL_HD.cloth, PAL_HD.sky],
  [PAL_HD.green, PAL_HD.cloth, PAL_HD.gold],
  [PAL_HD.sky, PAL_HD.gold, PAL_HD.pink],
];

/** Light band range of an awning / goods ramp (keeps the 1× colour on a face-on plane). */
function lit(c: HdCanvas, r: Ramp, extra: { spec?: number; wrap?: number } = {}): number {
  const lo = r === PAL_HD.cloth ? 3 : r === PAL_HD.gold ? 3 : 2;
  return decoMat(c, r, { lo, hi: r.length - 2, wrap: extra.wrap ?? 0.15, spec: extra.spec ?? 0, shine: 16 });
}

/** Striped canvas awning over x0…x1, y0…y1 with stripes `sw` wide and a scalloped hem below y1. */
export function awningHd(c: HdCanvas, x0: number, x1: number, y0: number, y1: number, sw: number, a: number, b: number, z: number): void {
  const part = c.newPart();
  c.box(x0, y0, x1 - x0, y1 - y0, {
    mat: a,
    z,
    part,
    n: [0, -0.42, 0.91],
    tex: (s) => {
      const k = Math.floor((s.x - x0) / sw);
      if (k & 1) s.mat = b;
      const f = s.x - x0 - k * sw;
      // A seam shadow at each stripe edge, the canvas sagging between the frame ribs.
      if (f > sw - 1 / s.d) s.tone -= 0.28;
      s.tone += Math.sin(((s.x - x0) / (x1 - x0)) * Math.PI * 3) * 0.07 - (s.y - y0) * 0.02;
      // The lit front roll of the awning frame.
      if (s.y - y0 < 0.6) s.ny -= 0.7;
    },
  });
  // The hem: a rounded tongue per stripe.
  for (let x = x0; x < x1 - 0.01; x += sw) {
    const k = Math.round((x - x0) / sw);
    c.box(x, y1 - 1.6, Math.min(sw, x1 - x), 3, { mat: k & 1 ? b : a, z: z - 0.4, r: Math.min(1.4, sw * 0.3), bevel: 0.6, tone: -0.08 });
  }
}

function stall(c: HdCanvas, i: number): PixelBuffer {
  const [ra, rb, rg] = SETS[i];
  const a = lit(c, ra);
  const b = lit(c, rb);
  const goods = lit(c, rg, { spec: i === 2 ? 0.9 : 0, wrap: i === 0 ? 0.25 : 0.1 });
  const steel = metalMat(c, PAL_HD.steel, { lo: 1, hi: 5, edge: 'C' });
  const wood = decoMat(c, PAL_HD.wood, { lo: 1, hi: 6, spec: 0.15, edge: 'C' });
  const woodDark = decoMat(c, PAL_HD.wood, { lo: 0, hi: 3, edge: 'C' });
  c.getMaterial(a).edge = 'C';
  c.getMaterial(b).edge = 'C';
  c.getMaterial(goods).edge = 'C';
  // Posts: steel tubes.
  for (const x of [3, 53]) c.cylinder(x, 8, 2, 38, { mat: steel, z: 0.5 });
  // The awning.
  awningHd(c, 1, 57, 4, 12, 6, a, b, 4);
  c.capsule(1.4, 4.4, 56.6, 4.4, 0.45, 0.45, { mat: b, z: 4.8, round: 0.6, tone: 0.25 });
  // The table: a lit board, a panelled front, the dark gap under the board.
  c.box(2, 28, 54, 4, { mat: wood, z: 2.5, bevel: 0.6, n: [0, -0.35, 0.94], tex: woodTex({ seed: 11 + i }) });
  c.box(4, 32, 50, 13, {
    mat: woodDark,
    z: 2,
    tex: (s) => {
      // Panels: a lit left stile and a dark right one every 10 px, the boards' grain.
      const f = (s.x - 4) % 10;
      if (f < 0.5) s.tone += 0.3;
      else if (f > 9.5) s.tone -= 0.4;
      if (s.y < 33) s.tone -= 0.35;
      s.tone += (noise2(s.x * 0.2, s.y * 2, 1, 7) - 0.5) * 0.25;
    },
  });
  // The rail.
  c.cylinder(5, 14.6, 48, 1, { mat: steel, z: 1, axis: 'h' });
  if (i === 0) {
    // Shirts and dresses on hangers, their folds catching the light.
    for (let x = 8; x < 50; x += 6) {
      const alt = x % 12 !== 8;
      const m = alt ? lit(c, PAL_HD.pink, { wrap: 0.25 }) : goods;
      c.getMaterial(m).edge = 'C';
      const dress = (x / 6) % 3 === 1;
      const pts: [number, number][] = dress
        ? [[x + 1, 15.6], [x + 4, 15.6], [x + 5.4, 26], [x - 0.4, 26]]
        : [[x, 15.8], [x + 5, 15.8], [x + 5.2, 18.4], [x + 4.6, 18.4], [x + 4.6, 26], [x + 0.4, 26], [x + 0.4, 18.4], [x - 0.2, 18.4]];
      c.blob(pts, 0.9, {
        mat: m,
        z: 1.6,
        tex: (s) => {
          s.nx += Math.sin((s.x - x) * 2.6 + hash2(x, 3, 1) * 3) * 0.35 * Math.min(1, (s.y - 16) / 5);
        },
      });
      // Hanger hook and the collar.
      c.capsule(x + 2.5, 14, x + 2.5, 15.8, 0.14, 0.14, { mat: steel, z: 1.8, round: 0.5 });
      c.ellipsoid(x + 2.5, 16.3, 0.9, 0.45, { mat: m, z: 2, tone: -0.3, round: 0.5 });
    }
  } else if (i === 1) {
    // Crates of records: sleeves standing in two crates, a few discs out.
    for (const [cx, cw] of [[5, 22], [30, 22]] as const) {
      for (let x = cx + 1; x < cx + cw - 1; x += 1.6) {
        const k = Math.round((x - cx) / 1.6);
        const r: Ramp = k % 3 === 0 ? PAL_HD.ink : k % 3 === 1 ? rg : k % 4 === 2 ? PAL_HD.red : PAL_HD.teal;
        const m = r === PAL_HD.ink ? decoMat(c, PAL_HD.black, { lo: 0, hi: 3, edge: 'C' }) : lit(c, r);
        c.getMaterial(m).edge = 'C';
        const lean = (hash2(k, cx, 4) - 0.5) * 0.8;
        const top = 19.6 + hash2(k, cx, 5) * 1.4;
        c.poly([[x + lean, top], [x + 1.5 + lean, top], [x + 1.5, 27], [x, 27]], { mat: m, z: 1.5 + k * 0.01, n: [-0.25, -0.15, 0.95] });
      }
      c.box(cx, 25.4, cw, 2.6, { mat: wood, z: 2.2, bevel: 0.4, tex: woodTex({ seed: cx, plank: 1.3 }) });
    }
    const vinyl = decoMat(c, PAL_HD.black, { lo: 0, hi: 4, spec: 0.9, shine: 30, edge: 'C' });
    for (const [x, y] of [[29, 19], [52, 21]] as const) {
      c.ellipsoid(x, y, 2.6, 2.6, { mat: vinyl, z: 2.1, round: 0.35 });
      c.paint(x - 0.8, y - 0.8, 1.6, 1.6, (px, py) => (Math.hypot(px - x, py - y) < 0.75 ? (Math.hypot(px - x, py - y) < 0.22 ? PAL_HD.ink[0] : PAL_HD.gold[5]) : 0));
    }
  } else {
    // Lamps and vases: glazed bodies with a glint, a pink shade on each lamp.
    const shade = lit(c, PAL_HD.pink, { wrap: 0.3 });
    c.getMaterial(shade).edge = 'C';
    const brass = metalMat(c, PAL_HD.gold, { lo: 2, hi: 6, edge: 'C' });
    for (let x = 8; x < 50; x += 9) {
      const lamp = (x / 9) % 2 > 0.5;
      c.ellipsoid(x + 3, 23, 3, 4.6, { mat: goods, z: 1.6 });
      c.ellipsoid(x + 3, 18.6, 1.4, 1.6, { mat: goods, z: 1.65 });
      if (lamp) {
        c.cylinder(x + 2.6, 13.6, 0.8, 4, { mat: brass, z: 1.5 });
        c.blob([[x + 0.6, 15.4], [x + 5.4, 15.4], [x + 4.4, 11.6], [x + 1.6, 11.6]], 0.6, { mat: shade, z: 1.7 });
      } else c.ellipsoid(x + 3, 17, 1.2, 0.5, { mat: goods, z: 1.7, tone: -0.4, round: 0.4 });
      // A painted band round the belly.
      c.shade(x, 22, 6, 2, (px, py) => (Math.abs(py - 23 + Math.sin(px * 1.5) * 0.3) < 0.3 ? -0.45 : 0));
    }
  }
  return c.render({ outline: 'C', ao: 0.3, sepZ: 0.3 });
}

/** The three stalls at density d. */
export function marketStallHd(d: number): Frame[] {
  return hdStrip(ID, d, (c, i) => stall(c, i));
}

export const MARKET_HD: ReadonlyArray<readonly [string, (d: number) => Frame[]]> = [[ID, marketStallHd]];

