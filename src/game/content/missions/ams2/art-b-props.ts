/**
 * Section b's props (noon): the hot-dog wagon and its front, the red roof flag of the hidden 1UP, the street
 * furniture by the stand, the wagon of the museum tickets, an ice cart, and the twins of the shared
 * breakables and of the museum crate. Frame order and anchors of the twins are those of the shared sprites.
 */
import { addMargin, S, text } from '../../../art/herokit/canvas';
import { range } from '../../../art/herokit/canvas-math';
import { K, R } from '../../../art/herokit/palette';
import { rngf } from '../../../art/herokit/rng';
import { stand } from '../../../art/herokit/props';
import { type Frame, defineSprite, getFrames, hasSprite, setSpriteOverrides } from '../../../../engine/sprites';
import { SET as VENDOR } from '../../art40/ams-hotdog-vendor.gen';
import { artId, defineArt } from './stage';

const L = 'noon';

export const STAND = defineArt(L, 'b/stand-hotdogs', () => stand('HOTDOGS', 'dred'));
export const STAND_TICKETS = defineArt(L, 'b/stand-tickets', () => stand('TICKETS', 'dgreen'));

/** The red flag on the wagon's roof: shoot it for the hidden 1UP. */
export const ROOF_FLAG = defineArt(
  L,
  'b/roof-flag',
  () => {
    const [a, b, c, d] = R.dred;
    const shapes: ReadonlyArray<readonly number[]> = [
      [0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0],
      [0, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
      [1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 1],
      [1, 1, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 1, 1],
    ];
    return shapes.map((wave) => {
      const s = new S(18, 18);
      s.use(1, 1);
      s.vl(R.pole[1], 1, 0, 18);
      s.vl(R.pole[0], 2, 0, 18);
      s.px(R.brass[0], 1, 0);
      s.use(2, 2);
      for (let x = 0; x < 14; x++) {
        const dy = wave[x];
        s.rect(b, 3 + x, 2 + dy, 1, 9);
        s.px(a, 3 + x, 2 + dy);
        s.px(c, 3 + x, 9 + dy);
        s.px(d, 3 + x, 10 + dy);
        if (x > 3 && x < 7) s.px(R.xw[0], 3 + x, 5 + dy);
      }
      const o = addMargin(s);
      o.finish();
      return o;
    });
  },
  { ticksPerFrame: 8 },
);

/** The grey box by the wagon: the power of the plein. */
export const POWER_BOX = defineArt(L, 'b/power-box', () => {
  const s = new S(16, 24);
  const [a, b, c, d] = R.pole;
  s.use(1, 1);
  s.rect(b, 0, 0, 16, 24);
  s.hl(a, 0, 0, 16);
  s.vl(a, 15, 0, 24);
  s.vl(c, 0, 0, 24);
  s.hl(d, 0, 23, 16);
  s.use(2, 2);
  s.rect(c, 3, 4, 10, 15);
  s.hl(d, 3, 4, 10);
  s.vl(a, 12, 5, 14);
  s.px(R.yellow[1], 7, 8);
  s.px(R.yellow[0], 8, 8);
  s.px(R.yellow[2], 7, 9);
  s.hl(R.dred[1], 4, 15, 8);
  s.hl(R.dred[0], 4, 16, 8);
  const o = addMargin(s);
  o.finish();
  return o;
});

/** A cart that sells ices, under a parasol. */
export const ICE_CART = defineArt(L, 'b/ice-cart', () => {
  const s = new S(52, 58);
  // The parasol.
  s.use(1, 3);
  s.poly(R.blue[1], [
    [4, 14],
    [26, 2],
    [48, 14],
  ]);
  s.use(2, 3.1);
  s.poly(R.cloth[0], [
    [14, 14],
    [26, 2],
    [22, 14],
  ]);
  s.poly(R.cloth[0], [
    [30, 14],
    [26, 2],
    [38, 14],
  ]);
  s.use(3, 3.2);
  s.hl(R.blue[3], 4, 14, 44);
  s.line(R.blue[0], 26, 2, 47, 13);
  s.use(4, 1);
  s.rect(R.pole[1], 25, 14, 2, 18);
  s.vl(R.pole[0], 26, 14, 18);
  // The box.
  s.use(5, 2);
  s.rect(R.cloth[0], 8, 32, 36, 18);
  s.hl(R.white[0], 8, 32, 36);
  s.vl(R.white[0], 43, 32, 18);
  s.vl(R.cloth[1], 8, 32, 18);
  s.hl(R.cloth[2], 8, 49, 36);
  s.use(6, 2.5);
  s.rect(R.plastp[1], 11, 40, 30, 7);
  s.hl(R.plastp[0], 11, 40, 30);
  s.hl(R.plastp[2], 11, 46, 30);
  text(s, 'IJS', 20, 41, R.white[0]);
  // Three scoops on the lid.
  s.use(7, 3);
  for (const [x, c] of [
    [14, 'plastp'],
    [24, 'plastc'],
    [34, 'bricko'],
  ] as const) {
    s.ell(R[c][1], x, 29, 3, 3);
    s.px(R[c][0], x + 1, 28);
    s.hl(R[c][2], x - 2, 31, 5);
  }
  // Wheels and a handle.
  for (const wx of [15, 37]) {
    s.use(8, 4);
    s.ell(R.hull[3], wx, 52, 5, 5);
    s.ell(R.pole[1], wx, 52, 2, 2);
    s.px(R.pole[0], wx + 1, 51);
  }
  s.use(9, 1.5);
  s.rect(R.pole[2], 2, 36, 7, 2);
  s.hl(R.pole[0], 2, 36, 7);
  const o = addMargin(s);
  o.finish();
  return o;
});

/** A notice board of the plein. */
export const NOTICE = defineArt(L, 'b/notice', () => {
  const s = new S(30, 40);
  s.use(1, 1);
  s.rect(R.wood[2], 3, 8, 3, 32);
  s.vl(R.wood[1], 5, 8, 32);
  s.rect(R.wood[2], 24, 8, 3, 32);
  s.vl(R.wood[1], 26, 8, 32);
  s.use(2, 2);
  s.rect(R.wood[1], 0, 2, 30, 20);
  s.hl(R.wood[0], 0, 2, 30);
  s.hl(R.wood[3], 0, 21, 30);
  s.vl(R.wood[0], 29, 2, 20);
  s.use(3, 3);
  s.rect(R.cloth[0], 3, 5, 10, 13);
  s.hl(R.cloth[1], 3, 17, 10);
  s.hl(R.dred[1], 4, 7, 8);
  s.hl(R.hull[2], 4, 10, 8);
  s.hl(R.hull[2], 4, 12, 6);
  s.use(4, 3);
  s.rect(R.blue[1], 16, 5, 11, 13);
  s.hl(R.blue[0], 16, 5, 11);
  s.vl(R.blue[2], 16, 5, 13);
  s.rect(R.yellow[1], 19, 9, 5, 5);
  s.px(R.yellow[0], 23, 9);
  const o = addMargin(s);
  o.finish();
  return o;
});

/** A rack of postcards by the ice cart: three tiers, each card a hard little picture. */
export const POSTCARDS = defineArt(L, 'b/postcards', () => {
  const s = new S(22, 40);
  const [p0, p1, p2, p3] = R.pole;
  s.use(1, 1);
  s.rect(p1, 10, 2, 2, 34);
  s.vl(p0, 11, 2, 34);
  s.rect(p2, 5, 37, 12, 2);
  s.hl(p1, 6, 36, 10);
  s.hl(p3, 5, 39, 12);
  const cards: ReadonlyArray<readonly [string, string]> = [
    ['blue', 'dred'],
    ['tulip', 'leaf'],
    ['bricko', 'navy'],
    ['glass', 'white'],
    ['yellow', 'dgreen'],
    ['dred', 'cloth'],
  ];
  let n = 0;
  for (const y of [3, 13, 23]) {
    s.use(2, 1.5);
    s.hl(p2, 1, y - 1, 20);
    s.hl(p0, 2, y - 1, 18);
    for (const x of [1, 8, 15]) {
      const [top, foot] = cards[n++ % cards.length];
      s.use(3 + n, 2);
      s.rect(R.cloth[0], x, y, 6, 8);
      s.hl(R.cloth[2], x, y + 7, 6);
      s.vl(R.white[0], x + 5, y, 7);
      s.rect(R[top][1], x + 1, y + 1, 4, 3);
      s.rect(R[foot][1], x + 1, y + 4, 4, 2);
      s.px(R[top][0], x + 3, y + 1);
    }
  }
  const o = addMargin(s);
  o.finish();
  return o;
});

/** A small terrace: a round table with a cup and two rattan chairs. */
export const TERRACE = defineArt(L, 'b/terrace', () => {
  const s = new S(48, 28);
  const [w0, w1, w2, w3] = R.wood;
  const chair = (x: number, back: number, part: number): void => {
    s.use(part, 1);
    s.rect(w1, x, 8, 3, 12);
    s.rect(w1, x + 3 * back, 16, 9 * back, 3);
    s.rect(w1, x + 3 * back, 19, 9 * back, 1);
    if (back > 0) s.vl(w0, x + 2, 8, 12);
    else s.vl(w0, x, 8, 12);
    for (let y = 9; y < 16; y += 3) s.px(w3, x + 1, y);
    s.use(part + 1, 1.1);
    s.hl(R.dred[1], x + (back > 0 ? 3 : -8), 15, 8);
    s.hl(R.dred[0], x + (back > 0 ? 4 : -7), 15, 6);
    s.use(part + 2, 0.9);
    s.vl(w2, x, 20, 8);
    s.vl(w2, x + 9 * back, 20, 8);
    s.vl(w3, x + 1, 20, 8);
  };
  chair(1, 1, 1);
  chair(44, -1, 5);
  const [i0, i1, i2, i3] = R.iron;
  s.use(10, 2);
  s.ell(i1, 24, 13, 11, 2);
  s.hl(i0, 16, 11, 16);
  s.hl(i2, 14, 14, 21);
  s.use(11, 1.8);
  s.rect(i2, 23, 15, 3, 11);
  s.vl(i1, 25, 15, 11);
  s.rect(i2, 18, 26, 13, 2);
  s.hl(i1, 19, 25, 11);
  s.hl(i3, 18, 27, 13);
  s.use(12, 3);
  s.rect(R.cloth[0], 20, 8, 5, 3);
  s.vl(R.cloth[2], 20, 8, 3);
  s.px(R.brickb[2], 22, 8);
  s.px(R.cloth[0], 25, 9);
  s.use(13, 3);
  s.rect(R.glass[1], 28, 6, 2, 5);
  s.px(R.glass[0], 29, 6);
  const o = addMargin(s);
  o.finish();
  return o;
});

/** A finger post: this way to the museum, the plein and the Amstel. */
export const FINGER_POST = defineArt(L, 'b/finger-post', () => {
  const s = new S(60, 60);
  const [p0, p1, p2, p3] = R.pole;
  s.use(1, 1);
  s.rect(p1, 24, 2, 3, 54);
  s.vl(p0, 26, 2, 54);
  s.vl(p2, 24, 2, 54);
  s.rect(p2, 22, 55, 7, 5);
  s.hl(p1, 22, 55, 7);
  s.vl(p1, 28, 55, 5);
  s.hl(p3, 22, 59, 7);
  s.use(2, 1.5);
  s.rect(p2, 24, 0, 3, 2);
  s.px(p0, 26, 0);
  const finger = (y: number, x0: number, w: number, dir: 1 | -1, label: string, c: readonly number[], part: number): void => {
    s.use(part, 2);
    s.rect(c[1], x0, y, w, 8);
    s.hl(c[0], x0, y, w);
    s.hl(c[3], x0, y + 7, w);
    const tip = dir > 0 ? x0 + w : x0 - 1;
    for (let k = 0; k < 4; k++) s.vl(c[1], tip + dir * k, y + k, 8 - 2 * k);
    s.px(c[0], tip, y);
    s.use(part + 1, 2.5);
    text(s, label, x0 + 2, y + 1, R.xw[0]);
  };
  finger(5, 3, 24, -1, 'PLEIN', R.navy, 3);
  finger(16, 25, 28, 1, 'AMSTEL', R.navy, 5);
  finger(27, 3, 24, -1, 'KUNST', R.dred, 7);
  const o = addMargin(s);
  o.finish();
  return o;
});

/** A board on the pavement: today's price of a herring. */
export const SANDWICH_BOARD = defineArt(L, 'b/sandwich-board', () => {
  const s = new S(20, 26);
  const [a, b, c, d] = R.wood;
  s.use(1, 1);
  s.poly(c, [
    [15, 2],
    [19, 25],
    [17, 25],
    [14, 6],
  ]);
  s.use(2, 2);
  s.poly(b, [
    [3, 1],
    [15, 1],
    [17, 25],
    [1, 25],
  ]);
  s.line(a, 15, 1, 17, 25);
  s.hl(a, 3, 1, 12);
  s.hl(d, 1, 25, 16);
  s.use(3, 3);
  s.poly(R.hull[3], [
    [5, 4],
    [13, 4],
    [14, 21],
    [4, 21],
  ]);
  s.use(4, 4);
  s.hl(R.cloth[0], 6, 7, 7);
  s.hl(R.yellow[1], 6, 10, 5);
  s.hl(R.cloth[1], 6, 13, 7);
  s.hl(R.cloth[1], 5, 16, 6);
  s.px(R.dred[0], 11, 18);
  s.px(R.dred[1], 12, 18);
  const o = addMargin(s);
  o.finish();
  return o;
});

function wheel(s: S, x: number, y: number, r: number): void {
  s.ell(R.hull[3], x, y, r, r);
  s.ell(R.wood[2], x, y, r - 2, r - 2);
  s.px(R.wood[0], x + 1, y - 1);
  s.px(R.hull[3], x, y);
}

/** The twin of `decor/ams/ams-tulip-stall` (frame 0 whole, frame 1 wrecked; bottom centre). */
export const TULIP_STALL = defineArt(
  L,
  'b/tulip-stall',
  () => {
    const W = 56;
    const H = 42;
    const s = new S(W, H);
    const seed = rngf(211);
    // The cart.
    s.use(1, 2);
    s.rect(R.wood[1], 3, 22, 50, 11);
    s.hl(R.wood[0], 3, 22, 50);
    s.hl(R.wood[3], 3, 32, 50);
    s.vl(R.wood[0], 52, 22, 11);
    s.vl(R.wood[2], 3, 22, 11);
    for (const q of range(9, 50, 8)) s.vl(R.wood[2], q, 23, 9);
    s.use(2, 2.5);
    s.rect(R.iron[1], 12, 25, 32, 6);
    s.hl(R.iron[0], 12, 25, 32);
    s.hl(R.iron[3], 12, 30, 32);
    text(s, 'TULPEN', 11 + 2, 25, R.xw[0], 1);
    // The tulips in rows.
    const cols = ['tulip', 'yellow', 'dred', 'plastp'];
    for (let j = 0; j < 3; j++) {
      for (let q = 5 + j; q < 51; q += 4) {
        const c = R[cols[(q + j * 3) % 4 < 2 ? j % 4 : (j + 1) % 4]];
        const y = 8 + j * 4 + seed.int(0, 2);
        s.use(10 + j, 3 + j * 0.1);
        s.vl(R.leaf[2], q, y + 2, 16 - j * 3 - (y - 8));
        s.px(R.leaf[1], q + 1, y + 5);
        s.px(c[1], q, y);
        s.px(c[0], q + 1, y);
        s.px(c[2] ?? c[1], q, y + 1);
        s.px(c[1], q + 1, y + 1);
      }
    }
    for (const wx of [13, 43]) {
      s.use(20, 4);
      wheel(s, wx, 35, 6);
    }
    const whole = addMargin(s);
    whole.finish();

    const b = new S(W, H);
    b.use(1, 2);
    b.poly(R.wood[2], [
      [4, 28],
      [50, 34],
      [50, 41],
      [2, 41],
    ]);
    b.line(R.wood[0], 4, 28, 50, 34);
    b.use(2, 2.2);
    for (const q of range(8, 48, 9)) b.vl(R.wood[3], q, 33, 8);
    b.use(3, 3);
    wheel(b, 42, 36, 5);
    b.use(4, 3);
    for (const [x, y, c] of [
      [10, 25, 'tulip'],
      [20, 31, 'yellow'],
      [28, 27, 'dred'],
      [36, 33, 'tulip'],
      [48, 30, 'plastp'],
    ] as const) {
      b.vl(R.leaf[2], x, y + 2, 5);
      b.px(R[c][1], x, y);
      b.px(R[c][0], x + 1, y);
      b.px(R[c][1], x, y + 1);
    }
    const wreck = addMargin(b);
    wreck.finish();
    return [whole, wreck];
  },
  { anchor: 'bc' },
);

/** The twin of `decor/ams/ams-herring-cart` (frame 0 whole, frame 1 wrecked; bottom centre). */
export const HERRING_CART = defineArt(
  L,
  'b/herring-cart',
  () => {
    const W = 56;
    const H = 44;
    const s = new S(W, H);
    // The roof: a Dutch flag's stripes.
    s.use(1, 4);
    for (const [y, c] of [
      [0, R.dred],
      [3, R.cloth],
      [6, R.navy],
    ] as const) {
      s.rect(c[1], 3, y, 50, 3);
      s.hl(c[0], 3, y, 50);
    }
    s.hl(R.navy[3], 3, 8, 50);
    // The posts.
    s.use(2, 1);
    s.rect(R.pole[1], 6, 9, 2, 16);
    s.rect(R.pole[1], 48, 9, 2, 16);
    s.vl(R.pole[0], 7, 9, 16);
    s.vl(R.pole[0], 49, 9, 16);
    // The back wall with a sign.
    s.use(3, 0.5);
    s.rect(R.blue[2], 8, 9, 40, 16);
    s.hl(R.blue[3], 8, 9, 40);
    text(s, 'HARING', 17, 11, R.xw[0]);
    // The glass case with fish.
    s.use(4, 2);
    s.rect(R.glass[1], 6, 18, 44, 7);
    s.hl(R.glass[0], 6, 18, 44);
    s.vl(R.glass[0], 49, 18, 7);
    s.use(5, 3);
    for (const q of range(9, 46, 8)) {
      s.hl(R.pole[1], q, 22, 6);
      s.hl(R.pole[0], q + 1, 21, 4);
      s.hl(R.pole[3], q, 23, 5);
      s.px(R.hull[3], q + 5, 22);
    }
    // The box.
    s.use(6, 2);
    s.rect(R.cloth[0], 3, 25, 50, 11);
    s.hl(R.white[0], 3, 25, 50);
    s.vl(R.white[0], 52, 25, 11);
    s.vl(R.cloth[2], 3, 25, 11);
    s.hl(R.cloth[2], 3, 35, 50);
    s.use(7, 2.5);
    s.hl(R.dred[1], 3, 28, 50);
    s.hl(R.navy[1], 3, 32, 50);
    for (const wx of [14, 42]) {
      s.use(8, 4);
      s.ell(R.hull[3], wx, 37, 6, 6);
      s.ell(R.pole[1], wx, 37, 3, 3);
      s.px(R.pole[0], wx + 1, 36);
      s.px(K, wx, 37);
    }
    const whole = addMargin(s);
    whole.finish();

    const b = new S(W, H);
    b.use(1, 2);
    b.poly(R.cloth[1], [
      [2, 30],
      [28, 26],
      [52, 34],
      [52, 43],
      [2, 43],
    ]);
    b.line(R.white[0], 2, 30, 28, 26);
    b.line(R.white[0], 28, 26, 52, 34);
    b.use(2, 2.2);
    b.hl(R.dred[1], 4, 35, 46);
    b.hl(R.navy[1], 4, 39, 46);
    b.use(3, 3);
    b.line(R.pole[1], 8, 30, 15, 14);
    b.line(R.pole[0], 9, 30, 16, 14);
    for (const [x, y] of [
      [20, 40],
      [33, 37],
      [44, 41],
    ] as const) {
      b.hl(R.pole[1], x, y, 6);
      b.hl(R.pole[3], x, y + 1, 5);
      b.px(R.hull[3], x + 5, y);
    }
    b.use(4, 4);
    b.ell(R.hull[3], 40, 38, 5, 5);
    b.ell(R.pole[1], 40, 38, 2, 2);
    const wreck = addMargin(b);
    wreck.finish();
    return [whole, wreck];
  },
  { anchor: 'bc' },
);

/**
 * The twin of `decor/ams/secret-museum-crate`: a pine crate NIET OPENEN in the passage (32 × 24, feet at the
 * bottom centre). Frames: 0 hidden, 1 the front falls, 2 open, straw inside.
 */
export const MUSEUM_CRATE = defineArt(
  L,
  'b/museum-crate',
  () => {
    const [a, b, c, d] = R.wood;
    const body = (s: S, y0: number): void => {
      s.use(1, 1);
      s.rect(b, 1, y0, 30, 23 - y0);
      s.hl(a, 1, y0, 30);
      s.hl(d, 1, 22, 30);
      s.vl(a, 30, y0, 23 - y0);
      s.vl(c, 1, y0, 23 - y0);
    };
    const closed = new S(32, 24);
    body(closed, 1);
    closed.use(2, 2);
    for (const q of [6, 12, 18, 24]) closed.vl(c, q, 2, 20);
    closed.hl(c, 2, 8, 28);
    closed.hl(c, 2, 16, 28);
    closed.use(3, 3);
    closed.rect(a, 1, 1, 3, 22);
    closed.rect(a, 28, 1, 3, 22);
    closed.rect(a, 1, 1, 30, 3);
    closed.rect(a, 1, 20, 30, 3);
    closed.hl(d, 1, 22, 30);
    closed.vl(c, 4, 4, 16);
    closed.hl(c, 4, 4, 24);
    closed.use(4, 4);
    closed.rect(R.cloth[0], 6, 5, 20, 14);
    closed.hl(R.cloth[1], 6, 18, 20);
    text(closed, 'NIET', 9, 6, R.dred[2]);
    text(closed, 'OPEN', 9, 12, R.dred[2]);
    closed.use(5, 5);
    closed.px(K, 2, 2);
    closed.px(K, 29, 2);
    closed.px(K, 2, 21);
    closed.px(K, 29, 21);

    const falling = new S(32, 24);
    body(falling, 1);
    falling.use(2, 2);
    falling.rect(R.hull[2], 4, 4, 24, 16);
    falling.use(3, 3);
    falling.poly(a, [
      [2, 20],
      [29, 20],
      [31, 24],
      [0, 24],
    ]);
    falling.hl(c, 1, 22, 30);
    falling.use(4, 4);
    falling.rect(R.bricko[1], 6, 14, 20, 6);
    falling.hl(R.bricko[0], 7, 14, 18);

    const open = new S(32, 24);
    body(open, 1);
    open.use(2, 2);
    open.rect(R.hull[2], 4, 4, 24, 16);
    open.use(3, 3);
    open.rect(R.bricko[1], 5, 12, 22, 8);
    for (const q of range(6, 26, 3)) {
      open.px(R.bricko[0], q, 11 + (q % 2));
      open.px(R.bricko[2], q + 1, 14 + (q % 3));
    }
    open.use(4, 3.5);
    open.hl(d, 2, 22, 28);
    return [closed, falling, open].map((o) => {
      o.finish();
      return o;
    });
  },
  { anchor: 'bc' },
);

/** The rows of the hot-dog vendor that show over the counter: he stands in the wagon, his legs stay inside. */
const VENDOR_COUNTER_ABOVE_FEET = 26;

/**
 * The twins of the vendor's baked strips, the same drawing cut off at the wagon's counter (the entity stands
 * him on the ground inside the wagon; without a front box in the way of the heroes he must end at the counter).
 */
export const VENDOR_TWINS: Readonly<Record<string, string>> = Object.fromEntries(
  Object.keys(VENDOR.strips).map((anim) => {
    const shared = `npc/ams/ams-hotdog-vendor/${anim}`;
    const id = artId(L, `b/vendor-${anim}`);
    if (!hasSprite(id)) {
      defineSprite(id, () => {
        const was = setSpriteOverrides(null);
        const frames = getFrames(shared, 1);
        setSpriteOverrides(was);
        return frames.map((f): Frame => {
          const buf = f.buf.clone();
          const cut = Math.max(0, f.oy - VENDOR_COUNTER_ABOVE_FEET);
          for (let y = cut; y < buf.h; y++) for (let x = 0; x < buf.w; x++) buf.data[y * buf.w + x] = 0;
          return { ...f, buf };
        });
      });
    }
    return [shared, id];
  }),
);

// ------------------------------------------------------------------------------- the supply crate's twin

const SWAN: readonly string[] = ['.........##.', '........####', '........##..', '#.......##..', '##......##..', '###....###..', '##########..', '.########...', '..######....'];

/** The supply crate in the kit's method: same size, rope bands and the white swan. `squash` as the shared hit frame. */
function supplyCrate(squash: number, cracks: boolean): S {
  const w = 22 + squash;
  const h = 18 - squash;
  const s = new S(w, h);
  const [a, b, c, d] = R.wood;
  s.use(1, 1);
  s.rect(b, 0, 3, w, h - 3);
  for (let y = 7; y < h - 1; y += 5) {
    s.hl(c, 2, y, w - 4);
    s.hl(a, 2, y + 1, w - 4);
  }
  s.hl(d, 0, h - 1, w);
  // The lid and the corner boards: lit on the right, shade on the left.
  s.use(2, 2);
  s.rect(a, 0, 0, w, 3);
  s.hl(R.white[0], 1, 0, w - 2);
  s.hl(c, 0, 3, w);
  s.rect(c, 0, 3, 2, h - 3);
  s.vl(d, 0, 3, h - 3);
  s.rect(a, w - 2, 3, 2, h - 3);
  s.vl(R.white[0], w - 1, 3, h - 4);
  // The swan.
  s.use(3, 2.5);
  s.grid(SWAN, (w >> 1) - 6, 4 + (h > 14 ? 1 : 0), { '#': R.white[0] });
  // Rope bands.
  s.use(4, 3);
  for (const x of [3, w - 5]) {
    s.rect(R.gravel[1], x, 0, 2, h);
    for (let y = 0; y < h; y += 2) s.px(R.gravel[2], x, y);
    s.vl(R.gravel[0], x + 1, 0, h);
  }
  if (cracks) {
    s.use(5, 3.5);
    s.line(d, 6, 0, 10, h - 1);
    s.line(d, 16, 2, 13, h - 3);
    s.line(R.hull[3], 1, 8, w - 2, 11);
  }
  const o = addMargin(s);
  o.finish();
  return o;
}

export const CRATE_TWIN = defineArt(L, 'b/crate-twin', () => supplyCrate(0, false), { anchor: 'bc' });
export const CRATE_HIT_TWIN = defineArt(L, 'b/crate-hit-twin', () => [supplyCrate(2, false), supplyCrate(0, false)], { anchor: 'bc' });

/** The planks of the shared break frames: [x, y from the bottom centre, length, vertical]. */
const PLANKS: ReadonlyArray<ReadonlyArray<readonly [number, number, number, boolean]>> = [
  [[-15, -24, 13, false], [-2, -28, 11, false], [-17, -16, 10, true], [10, -17, 10, true], [-9, -10, 15, false], [4, -21, 7, false]],
  [[-21, -27, 13, false], [-1, -33, 11, false], [-23, -13, 10, true], [15, -13, 10, true], [-10, -7, 15, false], [9, -25, 7, false]],
  [[-24, -5, 13, false], [-7, -6, 11, false], [-26, -9, 10, true], [17, -9, 10, true], [4, -5, 15, false], [13, -5, 7, false]],
];

export const CRATE_BREAK_TWIN = defineArt(
  L,
  'b/crate-break-twin',
  () => {
    const out: S[] = [supplyCrate(1, true)];
    for (const lay of PLANKS) {
      const s = new S(66, 42);
      const [a, b, c] = R.wood;
      lay.forEach(([x, y, len, v], i) => {
        s.use(i + 1, 1 + i * 0.1);
        const px = 33 + x;
        const py = 42 + y;
        if (v) {
          s.rect(b, px, py, 3, len);
          s.vl(a, px + 2, py, len);
          s.vl(c, px, py, len);
        } else {
          s.rect(b, px, py, len, 3);
          s.hl(a, px, py, len);
          s.hl(c, px, py + 2, len);
        }
      });
      s.finish();
      out.push(s);
    }
    return out;
  },
  { anchor: 'bc' },
);
