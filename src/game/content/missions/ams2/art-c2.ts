/**
 * The cruise of c2 RONDVAART (docs/design/ams2.md §3): the tour boat, the low brick bridges, the Magere Brug, Carre, the far bank.
 */
import { addMargin, S, text } from '../../../art/herokit/canvas';
import { crown, trunk } from '../../../art/herokit/foliage';
import { renderBuffer } from '../../../art/herokit/hi';
import { cornice, quoins, slateRoof, wallBlock } from '../../../art/herokit/masonry';
import { K, KM, R } from '../../../art/herokit/palette';
import { tube } from '../../../art/herokit/props';
import { rngf } from '../../../art/herokit/rng';
import { type GableKind, house, window_ } from '../../../art/herokit/walls';
import { LOW_BRIDGE, MAGERE_BRUG } from '../ams/cruise';
import { C_BASIN, C2_FAR_ROOF_Y, C2_HOUSEBOAT, C2_W, DECK_Y, ROOF_Y } from '../ams/terrain';
import { BANK_Y, BOAT_PLATFORM, defineTwin, L, lowBoatArt } from './art-c';
import { B0, bandEnd, defineArt, S_MID } from './stage';
import { defineBank, quayWall } from './scene';

/** Where the tour boat waits at the pontoon of section c. */
export const TOUR_X = C_BASIN[0] + 6;

/** The art's numbers of the shared boat: 198 × 48, the stern on x, the deck on row 35, the roof on row 11. */
const BOAT = { w: 198, h: 48, ox: 1, oy: 35, roof: 11, c0: 41, c1: 169 } as const;
const LEN = 192;

/** The people behind the glass: x, hair, shirt. */
const TOURISTS: ReadonlyArray<readonly [number, string, string]> = [
  [52, 'yellow', 'dred'],
  [64, 'hull', 'navy'],
  [77, 'dred', 'white'],
  [89, 'bark', 'dgreen'],
  [102, 'plastc', 'tulip'],
  [114, 'hull', 'yellow'],
  [127, 'bark', 'blue'],
  [139, 'tulip', 'plastg'],
];

function cruiseBoat(frame: number): S {
  const { w, h, ox, oy: deck, roof, c0, c1 } = BOAT;
  const s = new S(w, h);
  const L_ = ox;
  const Rr = ox + LEN;
  const [n0, n1, n2, n3] = R.navy;
  const [w0, w1, w2, w3] = R.white;
  const [g0, g1, g2, g3] = R.glass;
  // The hull.
  s.use(1, 1);
  s.poly(n1, [
    [L_ + 1, deck],
    [Rr - 6, deck],
    [Rr, deck + 2],
    [Rr - 4, deck + 11],
    [L_ + 6, deck + 11],
    [L_, deck + 4],
  ]);
  s.hl(n2, L_ + 2, deck + 2, LEN - 7);
  s.hl(n0, L_ + 8, deck + 4, 60);
  s.hl(n0, Rr - 70, deck + 4, 60);
  s.hl(R.dred[1], L_ + 3, deck + 6, LEN - 8);
  s.hl(R.dred[2], L_ + 4, deck + 7, LEN - 9);
  s.hl(n3, L_ + 6, deck + 11, LEN - 12);
  // The rubbing strake along the deck edge.
  s.use(2, 2);
  s.hl(w0, L_, deck, LEN - 4);
  s.hl(w2, L_ + 1, deck + 1, LEN - 6);
  // The open aft deck: a railing with posts, a lifebuoy, the flag on the stern pole.
  s.use(3, 1.6);
  s.hl(R.pole[0], L_ + 2, deck - 8, c0 - L_ - 4);
  s.hl(R.pole[2], L_ + 2, deck - 4, c0 - L_ - 4);
  for (let x = L_ + 2; x < c0 - 1; x += 7) s.vl(R.pole[1], x, deck - 8, 8);
  s.use(4, 2.6);
  s.ell(R.dred[1], L_ + 14, deck - 4, 3, 3);
  s.px(w0, L_ + 14, deck - 7);
  s.px(w0, L_ + 14, deck - 1);
  s.px(w0, L_ + 17, deck - 4);
  s.px(w0, L_ + 11, deck - 4);
  s.rect(R.navy[2], L_ + 13, deck - 5, 2, 2);
  s.use(5, 2.4);
  s.vl(R.pole[1], L_ + 3, roof - 10, deck - roof + 1);
  s.rect(R.dred[1], L_ + 4, roof - 10, 7, 2);
  s.rect(w0, L_ + 4, roof - 8, 7, 2);
  s.rect(n1, L_ + 4, roof - 6, 7, 2);
  // The cabin: a white lower band, the glass, tourists.
  s.use(6, 2);
  s.rect(g2, c0 + 1, roof + 2, c1 - c0 - 2, deck - 8 - roof);
  s.hl(g1, c0 + 1, roof + 2, c1 - c0 - 2);
  s.hl(g3, c0 + 1, deck - 8, c1 - c0 - 2);
  // A short glint high in some panes, behind the passengers.
  s.use(7, 2.2);
  for (let k = 0; k < 3; k++) {
    for (let y = roof + 3; y < roof + 7; y++) {
      s.px(g0, c0 + 28 + k * 44 + (y - roof), y);
      s.px(g1, c0 + 27 + k * 44 + (y - roof), y);
    }
  }
  for (const [x, hair, shirt] of TOURISTS) {
    s.use(30 + x, 2.5);
    const sk = R.skin;
    s.rect(sk[1], x, roof + 8, 4, 4);
    s.px(sk[0], x + 3, roof + 8);
    s.hl(R[hair][1], x, roof + 7, 4);
    s.rect(R[shirt][1], x - 1, roof + 12, 6, deck - 8 - roof - 12);
    s.vl(R[shirt][0], x + 4, roof + 12, deck - 8 - roof - 12);
  }
  s.use(8, 3);
  for (let x = c0; x < c1; x += 16) {
    s.vl(w1, x, roof + 1, deck - roof - 7);
    s.vl(w2, x + 1, roof + 1, deck - roof - 7);
  }
  s.vl(w0, c1 - 1, roof + 1, deck - roof - 7);
  s.use(9, 2.9);
  s.rect(w1, c0, deck - 6, c1 - c0, 6);
  s.hl(w0, c0, deck - 6, c1 - c0);
  s.hl(R.yellow[1], c0 + 2, deck - 3, c1 - c0 - 4);
  s.hl(w3, c0, deck - 1, c1 - c0);
  // The wheelhouse window and the skipper.
  s.use(10, 3.1);
  s.rect(n2, c1 - 17, roof + 3, 14, deck - 10 - roof);
  s.hl(n1, c1 - 17, roof + 3, 14);
  s.rect(R.skin[1], c1 - 11, roof + 8, 4, 4);
  s.rect(n3, c1 - 12, roof + 6, 6, 2);
  s.hl(w0, c1 - 13, roof + 7, 7);
  s.rect(n0, c1 - 12, roof + 12, 6, deck - 10 - roof - 9);
  // The glass roof: a white frame, panes between ribs.
  s.use(11, 4);
  s.hl(w0, c0 + 2, roof, c1 - c0 - 4);
  s.hl(w1, c0 + 1, roof + 1, c1 - c0 - 2);
  s.px(w1, c0, roof + 1);
  s.px(w1, c1 - 1, roof + 1);
  for (let x = c0 + 8; x < c1 - 4; x += 16) s.px(w3, x, roof);
  // The bow railing and a fender.
  s.use(12, 1.6);
  s.line(R.pole[0], c1 + 2, deck - 6, Rr - 7, deck - 4);
  for (const x of [c1 + 4, c1 + 11, Rr - 9]) s.vl(R.pole[1], x, deck - 6, 6);
  s.use(13, 3);
  s.ell(R.hull[2], Rr - 2, deck + 1, 2, 2);
  s.px(R.hull[0], Rr - 2, deck);
  s.finish();
  // The wake, no outline: ripples at rest, foam while sailing.
  const [f0, f1] = R.water;
  const wl = deck + 8;
  s.use(20, 5);
  if (frame === 0) {
    for (let x = L_ + 8; x < Rr - 8; x += 12) s.hl(f1, x, wl + 3, 4);
  } else {
    const k = frame - 1;
    s.hl(f0, Rr - 2 + k, wl - 1, 4);
    s.hl(f1, Rr - 6, wl, 7 - k);
    for (let x = L_ - 1; x < L_ + 10 - k * 2; x += 2) s.px(f0, x, wl + (x & 1));
    for (let x = L_ + 12 + k * 6; x < Rr - 10; x += 14) s.hl(f1, x, wl + 2, 5);
  }
  return s;
}

/** The twin of `decor/ams/ams-cruise-boat`: calm, wake A, wake B; the deck and the roof on the shared rows. */
export const CRUISE_TWIN = defineTwin('river/cruise-boat', () => [0, 1, 2].map(cruiseBoat), BOAT.ox, BOAT.oy, 16);


// ------------------------------------------------------------------------------- the tour boats on the Amstel (c1)

/** The tour boat that glides on the Amstel of c1, at a length (the shared strip squeezes it when it turns). */
function npcBoat(len: number, phase: number): S {
  const W = 118;
  const s = new S(W, 32);
  const x0 = (W - len) >> 1;
  const x1 = x0 + len;
  const [n0, n1, n2, n3] = R.navy;
  const [w0, w1, w2] = R.white;
  const [g0, g1, g2] = R.glass;
  const deck = 20;
  const wl = 28;
  s.use(1, 1);
  s.poly(n1, [
    [x0, deck],
    [x1 - 2, deck],
    [x1, deck + 2],
    [x1 - 4, wl],
    [x0 + 4, wl],
  ]);
  s.hl(n2, x0 + 1, deck + 2, len - 4);
  s.hl(n0, x0 + 8, deck + 3, Math.max(4, len >> 1));
  s.hl(R.dred[1], x0 + 3, wl - 3, len - 7);
  s.hl(n3, x0 + 4, wl - 1, len - 8);
  s.use(2, 2);
  s.hl(w0, x0, deck, len - 2);
  // The cabin.
  const c0 = x0 + Math.round(len * 0.12);
  const c1 = x1 - Math.round(len * 0.1);
  s.use(3, 2);
  s.rect(g2, c0, deck - 11, c1 - c0, 11);
  s.hl(g1, c0, deck - 11, c1 - c0);
  s.use(4, 2.5);
  if (len > 60) {
    for (let x = c0 + 5; x < c1 - 8; x += 8) {
      s.rect(R.skin[1], x, deck - 8, 3, 3);
      s.hl(R[['hull', 'bark', 'yellow', 'dred'][x % 4]][1], x, deck - 9, 3);
      s.rect(R[['dred', 'navy', 'yellow', 'dgreen'][(x >> 3) % 4]][1], x - 1, deck - 5, 5, 4);
    }
  }
  s.use(5, 3);
  for (let x = c0; x < c1; x += Math.max(6, Math.round(len / 10))) s.vl(w1, x, deck - 10, 8);
  s.rect(w1, c0, deck - 3, c1 - c0, 3);
  s.hl(w0, c0, deck - 3, c1 - c0);
  s.hl(w2, c0, deck - 1, c1 - c0);
  s.use(6, 4);
  s.hl(w0, c0 + 2, deck - 13, c1 - c0 - 4);
  s.hl(w1, c0, deck - 12, c1 - c0);
  s.use(7, 3.2);
  for (let j = 0; j < 7; j++) s.px(g0, c0 + Math.round(len * 0.3) + j, deck - 10 + j);
  // The flag at the stern.
  s.use(8, 2.4);
  s.vl(R.pole[1], x0 + 3, 6, 14);
  s.rect(R.dred[1], x0 + 4, 6, 6, 2);
  s.rect(w0, x0 + 4, 8, 6, 2);
  s.rect(n1, x0 + 4, 10, 6, 2);
  s.finish();
  const [f0, f1] = R.water;
  s.use(9, 5);
  const foam = phase ? [[x1 - 4, 28, 3], [x1 - 8, 29, 4], [x0 + 2, 28, 3], [x0 - 1, 29, 3]] : [[x1 - 6, 28, 4], [x1 - 2, 29, 3], [x0 + 4, 29, 3], [x0, 28, 3]];
  for (const [x, y, n] of foam) s.hl(y === 28 ? f0 : f1, x, y, n);
  void g0;
  return s;
}

/** The twin of `npc/ams/ams-tour-boat` (2 wake frames; the anchor in the hull's middle on the water line). */
export const TOUR_NPC = defineTwin('c1/tour-boat', () => [npcBoat(112, 0), npcBoat(112, 1)], 58, 28, 14);
/** The twin of its turn: the same boat squeezed end on. */
export const TOUR_NPC_TURN = defineTwin('c1/tour-boat-turn', () => [npcBoat(70, 0), npcBoat(36, 0)], 58, 28, 6);

// ------------------------------------------------------------------------------- the far bank of the Amstel (c2)

const AMSTEL_W = bandEnd(C2_W, S_MID);

/** A long grand building on the river: storeys of windows, a cornice, a slate roof, corner stones. */
function grand(w: number, st: number, mat: string, seed: number): S {
  const sh = 14;
  const gr = 15;
  const roofH = 14;
  const H = roofH + st * sh + gr + 3;
  const s = new S(w, H);
  const r = rngf(seed);
  slateRoof(
    s,
    [
      [2, roofH],
      [8, 1],
      [w - 9, 1],
      [w - 3, roofH],
    ],
    seed,
    1,
    0.5,
  );
  // Dormers.
  for (let x = 16; x < w - 16; x += 26) {
    s.use(40 + x, 1);
    s.rect(R.white[1], x, 4, 7, 8);
    s.hl(R.white[0], x, 4, 7);
    s.rect(R.glass[2], x + 1, 6, 5, 5);
    s.px(R.glass[0], x + 4, 6);
  }
  wallBlock(s, 0, roofH + 3, w, H - roofH - 3, mat, 2, 1, seed);
  cornice(s, 0, roofH, w, 3, 2);
  quoins(s, 0, roofH + 3, H - roofH - 3, 6, 4, 2);
  quoins(s, w - 6, roofH + 3, H - roofH - 3, 6, 5, 2, true);
  const n = Math.max(2, Math.floor((w - 16) / 13));
  const gap = (w - 12 - n * 8) / (n + 1);
  for (let j = 0; j < st; j++) {
    const wy = roofH + 6 + j * sh;
    for (let i = 0; i < n; i++) {
      const wx = Math.trunc(6 + gap + i * (8 + gap));
      window_(s, wx, wy, 8, 10, r, 60 + i * 2 + j * 40, { z: 3, arch: j === 0 && seed % 2 === 0 });
    }
    if (j > 0) {
      s.use(6 + j, 1.5);
      s.hl(R.stone[1], 0, roofH + 3 + j * sh, w);
      s.hl(R.stone[3], 0, roofH + 4 + j * sh, w);
    }
  }
  // The ground floor: stone, arched doors.
  const gy = H - gr;
  s.use(20, 2);
  s.rect(R.stone[1], 0, gy, w, gr);
  s.hl(R.stone[0], 0, gy, w);
  s.hl(R.stone[3], 0, H - 1, w);
  for (let y = gy + 4; y < H - 1; y += 4) s.hl(R.stone[2], 0, y, w);
  for (let i = 0; i < n; i++) {
    const wx = Math.trunc(6 + gap + i * (8 + gap));
    s.use(100 + i, 3);
    if (i === n >> 1) {
      s.rect(R.dgreen[2], wx - 2, gy + 3, 12, gr - 4);
      s.vl(R.dgreen[0], wx + 9, gy + 3, gr - 4);
      s.hl(R.white[0], wx - 3, gy + 2, 14);
    } else window_(s, wx, gy + 3, 8, 9, r, 130 + i * 2, { z: 3 });
  }
  const o = addMargin(s);
  o.finish(KM);
  return o;
}

/** Carre: a white-yellow theatre with a pediment, three tall arched windows, a dome at each corner. */
export const CARRE_W = 178;
function carre(): S {
  const w = 176;
  const h = 88;
  const s = new S(w, h);
  const [p0, p1, p2, p3] = R.plastc;
  const [t0, t1, , t3] = R.roof;
  const r = rngf(5);
  const c0 = 58;
  const c1 = 118;
  // The wings' roof and wall.
  slateRoof(
    s,
    [
      [0, 34],
      [4, 26],
      [w - 5, 26],
      [w - 1, 34],
    ],
    77,
    1,
    0.5,
  );
  s.use(2, 1);
  s.rect(p1, 0, 34, w, h - 34);
  s.hl(p0, 0, 34, w);
  s.hl(p0, 0, 35, w);
  s.hl(p3, 0, 36, w);
  s.vl(p0, w - 1, 34, h - 34);
  s.vl(p2, 0, 34, h - 34);
  for (let y = 48; y < h - 18; y += 15) {
    s.hl(p0, 0, y, w);
    s.hl(p2, 0, y + 1, w);
  }
  // The windows of the wings: arched, a warm reflection of the low sun.
  for (let x = 7; x < w - 7; x += 11) {
    if (x > c0 - 8 && x < c1) continue;
    for (const y of [38, 53]) {
      s.use(100 + x + y, 2.5);
      s.rect(R.glass[2], x, y, 6, 9);
      s.hl(R.glass[2], x + 1, y - 1, 4);
      s.px(R.lit[0], x + 4, y + 1);
      s.px(R.lit[1], x + 4, y + 2);
      s.hl(p3, x, y + 9, 6);
      s.hl(p0, x, y - 2, 6);
      s.vl(p0, x + 6, y, 9);
    }
  }
  // The arcade on the ground floor.
  s.use(3, 1.5);
  s.rect(R.stone[1], 0, h - 18, w, 18);
  s.hl(R.stone[0], 0, h - 18, w);
  s.hl(R.stone[3], 0, h - 1, w);
  for (let x = 4; x < w - 4; x += 10) {
    s.use(300 + x, 2);
    s.rect(R.hull[3], x, h - 13, 7, 12);
    s.hl(R.hull[3], x + 1, h - 14, 5);
    s.vl(R.lit[2], x + 6, h - 8, 7);
    s.vl(R.stone[0], x + 7, h - 13, 12);
  }
  // The central block with its curved pediment and the name.
  s.use(4, 3);
  s.rect(p0, c0, 18, c1 - c0, h - 18 - 18);
  s.vl(p2, c0, 18, h - 36);
  s.vl(R.white[0], c1 - 1, 18, h - 36);
  s.use(5, 3.2);
  for (let x = c0 + 3; x < c1 - 3; x++) {
    const t = (x - c0 - 3) / (c1 - c0 - 6);
    const y = 14 - Math.round(Math.sin(t * Math.PI) * 12);
    s.rect(p0, x, y, 1, 18 - y);
    s.px(R.white[0], x, y);
    s.px(p2, x, y + 1);
  }
  s.use(6, 3.5);
  s.rect(R.brass[3], c0 + 16, 12, c1 - c0 - 32, 7);
  s.hl(R.brass[1], c0 + 16, 12, c1 - c0 - 32);
  text(s, 'CARRE', c0 + 20, 13, R.brass[0]);
  s.px(R.brass[0], c0 + 37, 12);
  // Three tall arched windows.
  for (let k = 0; k < 3; k++) {
    const x = c0 + 9 + k * 15;
    s.use(7 + k, 3.8);
    s.rect(R.glass[3], x, 26, 11, 26);
    s.hl(R.glass[3], x + 2, 25, 7);
    s.hl(R.glass[3], x + 3, 24, 5);
    s.vl(R.glass[1], x + 8, 28, 22);
    s.vl(R.lit[1], x + 9, 30, 14);
    s.vl(p1, x + 5, 25, 27);
    s.hl(p1, x, 38, 11);
    s.use(10 + k, 3.6);
    s.hl(p3, x - 1, 52, 13);
    s.vl(p0, x + 11, 26, 26);
  }
  // Turrets and little domes: at the wings' corners and the central block.
  for (const x of [1, w - 12, c0 - 5, c1 - 6]) {
    s.use(20 + x, 4);
    s.ell(t1, x + 5.5, 21, 5.5, 6);
    s.ell(t0, x + 7, 19, 2.5, 3);
    s.rect(t3, x, 24, 11, 1);
    s.px(R.brass[0], x + 5, 14);
    s.px(R.brass[1], x + 5, 15);
    s.use(40 + x, 4.2);
    s.rect(p0, x, 25, 11, 15);
    s.hl(R.white[0], x, 25, 11);
    s.vl(R.white[0], x + 10, 25, 15);
    s.vl(p2, x, 25, 15);
    s.rect(R.glass[2], x + 4, 29, 4, 8);
    s.px(R.lit[1], x + 6, 30);
  }
  // Little figures on the roofline: the theatre's clowns.
  for (const x of [c0 + 8, c0 + 22, c1 - 24, c1 - 10]) {
    s.use(60 + x, 3.3);
    const y0 = 6 - Math.round(Math.sin(((x - c0 - 3) / (c1 - c0 - 6)) * Math.PI) * 6) + 3;
    s.rect(R.white[1], x, y0, 2, 4);
    s.px(R.dred[1], x, y0 - 1);
  }
  void r;
  const o = addMargin(s);
  o.finish(KM);
  return o;
}

/** The row of the far bank: houses and long buildings, Carre where it stands behind the bow at the Magere Brug. */
interface Lot {
  x: number;
  w: number;
  kind: 'grand' | 'house';
  mat: string;
  st: number;
  gable?: GableKind;
}

export const CARRE_BAND_X = 952;

function lots(): Lot[] {
  const mats = ['plastc', 'brickr', 'plastw', 'brickb', 'bricko', 'plastg', 'brickn', 'plastp', 'brickd'];
  const kinds: readonly GableKind[] = ['neck', 'bell', 'step', 'spout', 'flat'];
  const out: Lot[] = [];
  const plan = [108, 44, 38, 96, 42, 50, 40, 120, 36, 46, 88, 42, 40, 34, 39];
  const after = [40, 48, 112, 38, 44, 96];
  let x = 0;
  let i = 0;
  const add = (w: number, xs: number): void => {
    if (w >= 80) out.push({ x: xs, w, kind: 'grand', mat: ['plastc', 'brickr', 'plastw', 'bricko', 'brickb'][out.length % 5], st: w > 110 ? 3 : 2 + (i % 2) });
    else out.push({ x: xs, w, kind: 'house', mat: mats[i % mats.length], st: 2 + (i % 2), gable: kinds[i % kinds.length] });
    i++;
  };
  for (const w of plan) {
    add(w, x);
    x += w;
  }
  x = CARRE_BAND_X + 88 + 2;
  for (const w of after) {
    add(w, x);
    x += w;
  }
  return out;
}

/** The trees of the far bank of the Amstel (reuses the crowns of section c's bank). */
export const AMSTEL_TREES: ReadonlyArray<readonly [number, number]> = [
  [110, 40],
  [276, 220],
  [498, 430],
  [650, 640],
  [846, 860],
  [1090, 40],
  [1256, 220],
];

const AMSTEL = defineBank({
  light: L,
  name: 'c2/amstel',
  speed: S_MID,
  width: AMSTEL_W,
  rows: [8, BANK_Y + 6],
  waterRows: [BANK_Y + 6, B0 + 8],
  seed: 351,
  paint: (md) => {
    for (const lot of lots()) {
      if (lot.kind === 'grand') {
        const g = grand(lot.w, lot.st, lot.mat, 500 + lot.x);
        md.paste(g, lot.x, BANK_Y + 1 - g.h + 1);
      } else {
        const h = house(lot.w, lot.st, lot.mat, lot.gable ?? 'neck', 7000 + lot.x, { sh: 16, ww: 8, wh: 10, gr: 18, gh: 18, plastered: lot.mat.startsWith('plast') });
        md.paste(h, lot.x, BANK_Y + 1 - h.h + 1);
      }
    }
    const c = carre();
    md.paste(c, CARRE_BAND_X - (c.w >> 1), BANK_Y + 1 - c.h + 1);
    quayWall(md, BANK_Y);
    for (const [x, seed] of AMSTEL_TREES) trunk(md, x, BANK_Y, 42, 4, 900 + seed);
  },
  reflect: (bank) => {
    for (const [x, seed] of AMSTEL_TREES) bank.blit(renderBuffer(crown(56, 50, 900 + seed, 0), L, 1, 0), x - 28, BANK_Y - 66);
  },
});

export const AMSTEL_BANK = AMSTEL.bank;
export const AMSTEL_WATER = AMSTEL.water;

/** A moored open boat at the far quay. */
export const FAR_BOAT = defineArt(
  L,
  'c2/far-boat',
  () => {
    const bt = new S(62, 20);
    bt.use(1, 1);
    const bl = R.dgreen;
    bt.poly(bl[1], [
      [0, 8],
      [59, 8],
      [53, 18],
      [6, 18],
    ]);
    bt.hl(bl[0], 0, 8, 60);
    bt.hl(R.white[0], 2, 10, 56);
    bt.hl(bl[3], 6, 18, 48);
    bt.hl(bl[2], 5, 16, 50);
    bt.use(2, 2);
    const W_ = R.wood;
    bt.rect(W_[1], 12, 1, 32, 7);
    bt.hl(W_[0], 12, 1, 32);
    bt.vl(W_[0], 43, 1, 7);
    bt.vl(W_[2], 12, 1, 7);
    bt.hl(W_[3], 12, 7, 32);
    for (let q = 16; q < 42; q += 7) {
      bt.rect(R.glass[2], q, 3, 4, 3);
      bt.px(R.glass[0], q + 3, 3);
    }
    const o = addMargin(bt);
    o.finish(KM);
    return o;
  },
  { anchor: 'tl', bob: [0, 1, 0, -1] },
);

/** A mooring dolphin in the river: three piles lashed with an iron band, green at the water line. */
export const DOLPHIN = defineArt(L, 'c2/dolphin', () => {
  const s = new S(26, 34);
  const piles: ReadonlyArray<readonly [number, number, number]> = [
    [1, 7, 1.2],
    [17, 5, 1.2],
    [9, 0, 1.6],
  ];
  piles.forEach(([x, y, z], i) => {
    s.use(i + 1, z);
    tube(s, 'bark', x, y + 2, 7, s.h - y - 2);
    s.rect(R.bark[0], x, y, 7, 2);
    s.hl(R.bark[2], x + 1, y, 5);
    s.rect(R.moss[2], x, s.h - 7, 7, 7);
    s.hl(R.moss[0], x, s.h - 7, 7);
    s.px(R.moss[1], x + 5, s.h - 6);
  });
  s.use(9, 2);
  s.rect(R.iron[1], 1, 14, 23, 3);
  s.hl(R.iron[0], 1, 14, 23);
  s.hl(R.iron[3], 1, 16, 23);
  const o = addMargin(s);
  o.finish();
  return o;
});

/** An open sloop with a striped canopy and a small flag, moored in the river. */
export const SLOOP = defineArt(
  L,
  'c2/sloop',
  () => {
    const s = new S(84, 36);
    const [a, b, c, d] = R.wood;
    // The hull: varnished planks.
    s.use(1, 1);
    s.poly(b, [
      [0, 20],
      [83, 20],
      [76, 35],
      [8, 35],
    ]);
    s.hl(a, 0, 20, 84);
    s.hl(c, 4, 24, 77);
    s.hl(R.white[0], 3, 22, 78);
    for (let y = 26; y < 35; y += 3) s.hl(c, 6, y, 72);
    s.hl(d, 8, 34, 68);
    // The canopy on four posts, its stripes lit to the right.
    s.use(2, 2);
    for (const x of [18, 36, 54, 70]) s.vl(R.pole[1], x, 8, 12);
    s.use(3, 3);
    for (let x = 13; x < 76; x++) {
      const cc = R[Math.floor((x - 13) / 7) % 2 ? 'white' : 'dred'];
      s.vl(x > 50 ? cc[0] : cc[1], x, 2, 6);
      s.px(cc[2], x, 8);
    }
    s.hl(R.white[0], 15, 1, 59);
    // Benches and a basket under the canopy.
    s.use(4, 1.5);
    s.rect(R.wood[1], 22, 16, 12, 4);
    s.hl(R.wood[0], 22, 16, 12);
    s.rect(R.wood[1], 40, 16, 12, 4);
    s.hl(R.wood[0], 40, 16, 12);
    s.rect(R.bricko[1], 58, 15, 8, 5);
    s.hl(R.bricko[0], 58, 15, 8);
    // The flag at the stern.
    s.use(5, 3.5);
    s.vl(R.pole[0], 4, 4, 16);
    s.rect(R.dred[1], 5, 4, 7, 2);
    s.rect(R.white[0], 5, 6, 7, 2);
    s.rect(R.navy[1], 5, 8, 7, 2);
    const o = addMargin(s);
    o.finish();
    return o;
  },
  { bob: [0, 1, 0, -1] },
);

/** A yellow pedal boat with a slide of two seats. */
export const PEDAL = defineArt(
  L,
  'c2/pedal-boat',
  () => {
    const s = new S(40, 24);
    const [a, b, c, d] = R.yellow;
    s.use(1, 1);
    s.poly(b, [
      [0, 10],
      [39, 10],
      [34, 23],
      [5, 23],
    ]);
    s.hl(a, 0, 10, 40);
    s.hl(c, 3, 15, 34);
    s.hl(d, 6, 22, 28);
    s.use(2, 2);
    for (const x of [9, 22]) {
      s.rect(R.navy[1], x, 3, 3, 8);
      s.rect(R.navy[1], x, 8, 9, 3);
      s.vl(R.navy[0], x + 2, 3, 6);
      s.hl(R.navy[0], x, 8, 9);
    }
    s.use(3, 3);
    s.rect(R.white[0], 33, 6, 3, 4);
    s.px(R.dred[1], 34, 5);
    const o = addMargin(s);
    o.finish();
    return o;
  },
  { bob: [0, 0, 1, 1, 0, 0, -1, -1] },
);

/** The houseboat at the far quay, on its platforms (its tourist is the c2 hostage). */
export const C2_BOAT = lowBoatArt(C2_HOUSEBOAT, 3, C2_FAR_ROOF_Y, C2_FAR_ROOF_Y + DECK_Y - ROOF_Y, 'c2/boat', true);

// ------------------------------------------------------------------------------- low brick bridges

const BRICKS = 'brickr';

function brickFace(s: S, x: number, y: number, w: number, h: number, seed: number): void {
  const [a, b, c, d] = R[BRICKS];
  const r = rngf(seed);
  s.rect(b, x, y, w, h);
  for (let j = y; j < y + h; j += 3) {
    s.hl(c, x, j + 2, w);
    for (let q = x + ((j - y) % 2 ? 4 : 0); q < x + w; q += 8) s.vl(c, q, j, 2);
    if (r.random() < 0.8) {
      const px = x + r.int(0, Math.max(1, w - 5));
      s.hl(a, px, j, r.int(2, 5));
    }
    if (r.random() < 0.6) {
      const px = x + r.int(0, Math.max(1, w - 5));
      s.hl(d, px, j + 1, r.int(2, 5));
    }
  }
}

/** The twin of `decor/ams/low-bridge`, in front of the figures: the slab's near face, its underside on the terrain's number. */
export const LOW_FACE = defineTwin(
  'c2/low-face',
  () => {
    const w = LOW_BRIDGE.w + 8;
    const oy = 1;
    const h = LOW_BRIDGE.under - LOW_BRIDGE.top + 2;
    const under = oy + LOW_BRIDGE.under - LOW_BRIDGE.top;
    const s = new S(w, h);
    const [t0, t1, t2, t3] = R.stone;
    s.use(1, 1);
    brickFace(s, 2, oy + 2, w - 4, under - oy - 6, 11);
    s.use(2, 2);
    s.rect(t1, 1, oy, w - 2, 2);
    s.hl(t0, 1, oy, w - 2);
    s.hl(t3, 1, oy + 1, w - 2);
    s.use(3, 2);
    s.rect(t2, 2, under - 4, w - 4, 4);
    s.hl(t1, 2, under - 4, w - 4);
    s.use(4, 3);
    for (let x = 4; x < w - 4; x++) {
      const on = Math.floor((x + 1) / 4) % 2 === 1;
      s.px(on ? R.yellow[1] : K, x, under - 3);
      s.px(on ? R.yellow[1] : K, x, under - 2);
    }
    // The bridge's number on a white plate.
    s.use(5, 3);
    const m = w >> 1;
    s.rect(R.white[0], m - 5, oy + 3, 10, 5);
    s.hl(R.navy[1], m - 3, oy + 5, 6);
    s.vl(R.white[2], m - 5, oy + 3, 5);
    s.finish();
    return [s];
  },
  (LOW_BRIDGE.w + 8) / 2,
  1,
);

/** The twin of `decor/ams/low-bridge/back`: the railing and lantern over the walkway, the arch and far piers behind the boat. */
export const LOW_BACK = defineTwin(
  'c2/low-back',
  () => {
    const w = LOW_BRIDGE.w + 12;
    const h = 116;
    const oy = 28;
    const under = oy + LOW_BRIDGE.under - LOW_BRIDGE.top;
    const water = oy + 180 - LOW_BRIDGE.top;
    const s = new S(w, h);
    const m = w >> 1;
    const [hd, , hs, hk] = R.hull;
    // The vault: the dark under the bridge, a far arch of light at its foot.
    s.use(1, 1);
    s.rect(hk, 4, oy, w - 8, under - oy + 14);
    s.rect(hs, 8, under, w - 16, 5);
    for (let y = under + 5; y < under + 14; y++) {
      const dx = Math.round(((y - under - 5) * (y - under - 5)) / 8);
      s.hl(0, 0, y, 0);
      s.rect(hk, 4, y, w - 8, 1);
      for (let x = 10 + 10 - dx; x < w - 20 + dx; x++) s.c[y * w + x] = 0;
    }
    s.use(2, 2);
    for (const x of [1, w - 9]) {
      brickFace(s, x, oy, 8, water - oy + 8, 31 + x);
      s.vl(R[BRICKS][x < m ? 3 : 0], x < m ? x : x + 7, oy, water - oy + 8);
    }
    s.use(3, 2.2);
    for (const x of [1, w - 9]) {
      s.rect(R.moss[2], x, water - 2, 8, 3);
      s.hl(R.moss[1], x + 1, water - 2, 6);
    }
    // The railing over the walkway.
    s.use(4, 2);
    s.hl(R.iron[0], 2, oy - 10, w - 4);
    s.hl(R.iron[1], 2, oy - 9, w - 4);
    s.hl(R.iron[2], 2, oy - 4, w - 4);
    for (let x = 3; x < w - 3; x += 5) {
      s.vl(R.iron[1], x, oy - 9, 8);
      s.px(R.iron[0], x, oy - 9);
    }
    // The lantern.
    s.use(5, 3);
    tube(s, 'iron', m - 1, oy - 24, 3, 24);
    s.poly(R.glow[1], [
      [m - 3, oy - 27],
      [m + 4, oy - 27],
      [m + 3, oy - 21],
      [m - 2, oy - 21],
    ]);
    s.vl(R.glow[0], m + 2, oy - 26, 4);
    s.hl(K, m - 3, oy - 28, 8);
    s.px(R.iron[0], m, oy - 28);
    void hd;
    const o = s;
    o.finish();
    return [o];
  },
  (LOW_BRIDGE.w + 12) / 2,
  28,
);

// ------------------------------------------------------------------------------- the Magere Brug

const M = { w: 128, h: 104, ox: 64, oy: 82 } as const;
const MB = { w: 128, h: 156, ox: 64, oy: 72 } as const;
const MAGERE_ANGLES: readonly number[] = [0, 26, 54, 80];

/** The twin of `decor/ams/magere-brug/back`: two white portals with their bulbs, on stone piers in the river. */
export const MAGERE_BACK = defineTwin(
  'c2/magere-back',
  () => {
    const { w, h, oy } = MB;
    const s = new S(w, h);
    const [w0, w1, w2, w3] = R.white;
    const [t0, t1, t2, t3] = R.stone;
    const top = oy - (MAGERE_BRUG.top - 50);
    const water = oy + 180 - MAGERE_BRUG.top;
    // The stone piers in the water.
    for (const x of [1, w - 15]) {
      s.use(1, 1);
      s.rect(t1, x, oy + 12, 14, water - oy - 2);
      s.vl(t0, x + 13, oy + 12, water - oy - 2);
      s.vl(t2, x, oy + 12, water - oy - 2);
      s.hl(t0, x, oy + 12, 14);
      for (let y = oy + 15; y < water + 9; y += 4) {
        s.hl(t3, x + 1, y, 12);
        s.vl(t3, x + 5 + ((y >> 2) % 2) * 4, y - 3, 3);
      }
      s.use(2, 1.2);
      s.rect(R.moss[2], x, water - 3, 14, 3);
      s.hl(R.moss[1], x + 2, water - 3, 9);
    }
    for (const side of [0, 1]) {
      const x0 = side === 0 ? 3 : 115;
      for (const x of [x0, x0 + 7]) {
        s.use(3 + x, 2);
        s.rect(w1, x, top, 3, oy + 13 - top);
        s.vl(w0, x + 2, top, oy + 13 - top);
        s.vl(w2, x, top, oy + 13 - top);
      }
      s.use(4 + side * 40, 3);
      s.rect(w1, x0 - 2, top, 14, 3);
      s.hl(w0, x0 - 2, top, 14);
      s.hl(w3, x0 - 2, top + 2, 14);
      s.rect(w2, x0 - 1, oy - 10, 12, 2);
      s.hl(w1, x0 - 1, oy - 10, 12);
      s.use(5 + side * 40, 2.5);
      s.line(w1, x0 + 2, top + 4, x0 + 8, oy - 11);
      s.line(w2, x0 + 8, top + 4, x0 + 2, oy - 11);
      s.use(6 + side * 40, 3.2);
      for (let y = top + 6; y < oy; y += 6) {
        s.px(R.yellow[0], x0 - 1, y);
        s.px(R.yellow[1], x0 + 11, y);
      }
      for (let x = x0 - 1; x < x0 + 12; x += 3) s.px(R.yellow[0], x, top - 1);
    }
    s.finish();
    return [s];
  },
  MB.ox,
  MB.oy,
);

function magereLeaves(deg: number): S {
  const { w, h, ox, oy } = M;
  const s = new S(w, h);
  const a = (deg * Math.PI) / 180;
  const half = MAGERE_BRUG.gap / 2;
  const thick = MAGERE_BRUG.under - MAGERE_BRUG.top;
  const beamY = oy - (MAGERE_BRUG.top - 50) + 3;
  const [w0, w1, w2, w3] = R.white;
  const [d0, d1, d2] = R.wood;
  let part = 1;
  for (const side of [-1, 1]) {
    const px = ox + side * half;
    const py = oy + thick / 2;
    const len = half;
    const ux = -side * Math.cos(a);
    const uy = -Math.sin(a);
    const upx = side < 0 ? uy : -uy;
    const upy = side < 0 ? -ux : ux;
    const at = (k: number, hh: number): readonly [number, number] => [Math.round(px + ux * len * k + upx * hh), Math.round(py + uy * len * k + upy * hh)];
    const quad = (k0: number, k1: number, h0: number, h1: number): Array<readonly [number, number]> => [at(k0, h0), at(k1, h0), at(k1, h1), at(k0, h1)];
    const seg = (k0: number, h0: number, k1: number, h1: number, c: number): void => {
      const [x0, y0] = at(k0, h0);
      const [x1, y1] = at(k1, h1);
      s.line(c, x0, y0, x1, y1);
    };
    // The railing on the leaf.
    s.use(part++, 1);
    const rail = 7;
    for (let k = 0.04; k <= 1.0001; k += 0.19) {
      seg(k, thick / 2 + 1, k, thick / 2 + rail, w0);
      if (k + 0.19 <= 1.0001) {
        seg(k, thick / 2 + 1, k + 0.19, thick / 2 + rail, w2);
        seg(k, thick / 2 + rail, k + 0.19, thick / 2 + 1, w2);
      }
    }
    seg(0.04, thick / 2 + rail, 1, thick / 2 + rail, w0);
    s.use(part++, 1.2);
    for (let k = 0.04; k <= 1.0001; k += 0.19) {
      const [lx, ly] = at(k, thick / 2 + rail + 1);
      s.px(R.yellow[0], lx, ly);
    }
    // The girder.
    s.use(part++, 2);
    s.poly(w1, quad(0, 1, -thick / 2, thick / 2 - 2));
    seg(0, -thick / 2 + 1, 1, -thick / 2 + 1, w3);
    seg(0, -thick / 2 + 2, 1, -thick / 2 + 2, w2);
    seg(0, thick / 2 - 4, 1, thick / 2 - 4, w2);
    seg(0, thick / 2 - 3, 1, thick / 2 - 3, w0);
    for (let k = 0.06; k < 1; k += 0.12) {
      const [bx, by] = at(k, 1);
      s.px(w3, bx, by);
    }
    // The plank deck on top.
    s.use(part++, 3);
    s.poly(d1, quad(0, 1, thick / 2 - 2, thick / 2));
    seg(0, thick / 2, 1, thick / 2, d0);
    for (let k = 0.08; k < 1; k += 0.1) {
      const [jx, jy] = at(k, thick / 2 - 1);
      s.px(d2, jx, jy);
    }
    // The balance beam: it tilts with the leaf.
    const bx0 = ox + side * (half + 8);
    const bx1 = ox + side * 8;
    const by0 = beamY + Math.sin(a) * 6;
    const by1 = beamY - Math.sin(a) * 18;
    s.use(part++, 4);
    s.poly(w1, [
      [Math.round(bx0), Math.round(by0 - 1)],
      [Math.round(bx1), Math.round(by1 - 1)],
      [Math.round(bx1), Math.round(by1 + 1)],
      [Math.round(bx0), Math.round(by0 + 1)],
    ]);
    s.line(w0, Math.round(bx0), Math.round(by0 - 1), Math.round(bx1), Math.round(by1 - 1));
    s.line(w2, Math.round(bx0), Math.round(by0 + 1), Math.round(bx1), Math.round(by1 + 1));
    s.use(part++, 4.2);
    for (let k = 0.1; k < 1; k += 0.18) s.px(R.yellow[0], Math.round(bx0 + (bx1 - bx0) * k), Math.round(by0 + (by1 - by0) * k) - 2);
    // The rod from the beam's inner end down to the leaf tip.
    const [tx, ty] = at(1, thick / 2);
    s.use(part++, 1.6);
    s.line(R.pole[1], Math.round(bx1), Math.round(by1 + 1), tx, ty);
  }
  s.finish();
  return s;
}

/** The twin of `decor/ams/magere-brug`: 4 frames, closed to open; the walkway on the shared row. */
export const MAGERE_LEAVES = defineTwin('c2/magere-leaves', () => MAGERE_ANGLES.map(magereLeaves), M.ox, M.oy);

// ------------------------------------------------------------------------------- the party boat, the secret

export const PARTY_BOAT = BOAT_PLATFORM;

/** The twin of the secret `decor/ams/secret-hatch` (3 frames: shut, it flips, open; 16 × 14, the feet on the roof). */
export const HATCH_TWIN = defineArt(
  L,
  'c2/hatch',
  () =>
    [0, 1, 2].map((f) => {
      const s = new S(16, 14);
      const [a, b, c, d] = R.wood;
      s.use(1, 1);
      s.rect(b, 1, 10, 14, 3);
      s.hl(a, 1, 10, 14);
      s.hl(d, 1, 12, 14);
      s.vl(a, 14, 10, 3);
      if (f === 0) {
        s.use(2, 2);
        s.rect(b, 2, 8, 12, 2);
        s.hl(a, 2, 8, 12);
        for (const x of [5, 8, 11]) s.px(c, x, 9);
        s.use(3, 3);
        s.hl(R.brass[0], 7, 6, 3);
        s.px(R.brass[1], 7, 7);
        s.px(R.brass[1], 9, 7);
      } else if (f === 1) {
        s.use(2, 2);
        s.rect(R.hull[3], 2, 9, 12, 1);
        s.line(b, 2, 9, 10, 1);
        s.line(a, 3, 8, 11, 0);
        s.line(c, 2, 8, 10, 2);
      } else {
        s.use(2, 2);
        s.rect(R.hull[3], 3, 9, 11, 1);
        s.rect(b, 1, 0, 2, 10);
        s.vl(a, 2, 0, 9);
        for (const y of [3, 6]) s.px(c, 1, y);
      }
      s.finish();
      return s;
    }),
  { anchor: 'bc' },
);

export { ROOF_Y as C2_ROOF_REF };
