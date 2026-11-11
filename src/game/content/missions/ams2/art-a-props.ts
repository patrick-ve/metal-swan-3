/**
 * Section a's props (morning; docs/design/ams2.md §3): the PLEINTJE (its floor, the street organ, the
 * terrace, the iron urinal), and the twins of what the shared script spawns as scenery: the breakables
 * and the secrets. A twin keeps the shared sprite's frame order and anchor; the hitboxes stay the entity's.
 */
import { addMargin, S, text, textW } from '../../../art/herokit/canvas';
import { pavers, kerb } from '../../../art/herokit/floors';
import { K, R } from '../../../art/herokit/palette';
import { bike, bikeRack, tube } from '../../../art/herokit/props';
import { rngf } from '../../../art/herokit/rng';
import { anchoredArt, L } from './art-a-canal';
import { B1, B2, defineArt, defineBand, S_WALK, VH } from './stage';

// ------------------------------------------------------------------------------------ street strips

/** The kerb of the near street at speed 1, under the near houses (rows 160 … 166). */
export function streetKerb(name: string, width: number) {
  return defineBand({
    light: L,
    name: `a/street-kerb-${name}`,
    speed: S_WALK,
    rows: [160, B1],
    width,
    paint: () => {
      const s = new S(width, VH);
      pavers(s, 160, B1 - 4, 91 + width);
      kerb(s, B1 - 4, 4, 92 + width);
      return s;
    },
  });
}

/** The floor of the PLEINTJE over the walk band: large slabs in a stone frame, a round figure in the middle. */
export function pleinFloor(x0: number, x1: number) {
  const width = x1 - x0;
  return defineBand({
    light: L,
    name: 'a/plein-floor',
    speed: S_WALK,
    rows: [B1, B2],
    width,
    paint: () => {
      const s = new S(width, VH);
      pavers(s, B1, B2, 92, 5, 7, 2.4, 'pave', 0.33);
      const [s0, s1, , s3] = R.stone;
      s.use(5, 1);
      for (const x of [0, width - 5]) {
        s.rect(s1, x, B1, 5, B2 - B1);
        s.vl(s0, x + 4, B1, B2 - B1);
        s.vl(s3, x, B1, B2 - B1);
        for (let y = B1 + 5; y < B2; y += 6) s.hl(s3, x, y, 5);
      }
      // The figure on the square: rings of red and white stone, flattened by the view.
      const cx = width >> 1;
      const cy = (B1 + B2) >> 1;
      const [l0, l1] = R.lane;
      s.use(6, 1);
      s.ell(R.pave[3], cx, cy, 53, 11);
      s.ell(l1, cx, cy, 52, 10);
      s.ell(R.pave[1], cx, cy, 44, 8);
      s.ell(s1, cx, cy, 34, 6);
      s.ell(l1, cx, cy, 16, 3);
      s.ell(l0, cx + 2, cy - 1, 10, 1);
      for (let a = 0; a < 16; a++) {
        const q = (a / 16) * Math.PI * 2;
        const x = Math.round(cx + Math.cos(q) * 48);
        const y = Math.round(cy + Math.sin(q) * 9);
        s.rect(R.pave[3], x, y, 2, 1);
      }
      return s;
    },
  });
}

// ------------------------------------------------------------------------------------- the PLEINTJE

/** A street organ on its wagon: bright, carved, the size of a figure and a half. */
export const ORGAN = defineArt(
  L,
  'a/organ',
  () =>
    [0, 1].map((f) => {
      const s = new S(46, 56);
      const [g0, g1, g2] = R.brass;
      // The cart and its big wheels.
      for (const wx of [10, 36]) {
        s.use(1, 3);
        s.ell(R.hull[3], wx, 47, 8, 8);
        s.ell(R.dred[1], wx, 47, 6, 6);
        s.ell(R.hull[3], wx, 47, 4, 4);
        s.ell(R.brass[1], wx, 47, 1.4, 1.4);
        s.px(R.dred[0], wx + 4, 43);
      }
      s.use(2, 2);
      s.rect(R.navy[1], 3, 12, 40, 30);
      s.vl(R.navy[2], 3, 12, 30);
      s.vl(R.navy[0], 42, 12, 30);
      s.hl(R.navy[3], 3, 41, 40);
      // The crown over it.
      s.use(3, 3);
      s.poly(g1, [
        [2, 12],
        [10, 4],
        [17, 8],
        [23, 0],
        [29, 8],
        [36, 4],
        [44, 12],
      ]);
      s.line(g0, 23, 0, 29, 8);
      s.line(g0, 36, 4, 44, 12);
      s.hl(g2, 2, 12, 42);
      s.ell(R.dred[1], 23, 7, 3, 3);
      s.px(R.dred[0], 24, 5);
      // The pipes in the middle.
      s.use(4, 3);
      s.rect(R.hull[3], 11, 16, 24, 15);
      for (let q = 12; q < 34; q += 3) {
        const top = 17 + Math.abs(q - 23) >> 1;
        s.rect(g1, q, top, 2, 30 - top);
        s.px(g0, q + 1, top);
        s.px(g2, q, 29);
      }
      // Painted panels, a turning wheel and the lit bulbs that blink in turn.
      s.use(5, 3);
      for (const q of [5, 36]) {
        s.rect(R.plastg[1], q, 16, 6, 15);
        s.vl(R.plastg[0], q + 5, 16, 15);
        s.rect(R.tulip[1], q + 1, 21, 3, 3);
        s.px(R.tulip[0], q + 3, 21);
        s.vl(R.leaf[2], q + 2, 24, 4);
      }
      s.use(6, 3.5);
      s.rect(R.dred[1], 6, 33, 34, 7);
      s.hl(R.dred[0], 6, 33, 34);
      s.hl(R.dred[2], 6, 39, 34);
      text(s, 'ORGEL', 13, 34, R.yellow[0]);
      for (let q = 5; q < 42; q += 4) s.px(((q >> 2) + f) % 2 ? R.glow[0] : R.glow[3], q, 14);
      s.use(7, 4);
      // The handle, on the right: it turns.
      s.vl(R.pole[1], 43, 26, 4);
      s.px(R.pole[0], 44, f ? 26 : 29);
      s.px(R.pole[0], 45, f ? 26 : 29);
      const o = addMargin(s);
      o.finish(K);
      return o;
    }),
  { ticksPerFrame: 20, part: 'a-organ' },
);

/** A table with two chairs under a parasol. */
export const TERRACE = defineArt(
  L,
  'a/terrace',
  () => {
    const s = new S(40, 42);
    const [c0, c1, c2] = R.dred;
    s.use(1, 1);
    tube(s, 'pole', 19, 8, 2, 30);
    // The chairs.
    for (const q of [3, 30]) {
      s.use(2, 2);
      s.rect(R.wood[1], q, 30, 7, 2);
      s.hl(R.wood[0], q, 30, 7);
      s.vl(R.hull[2], q, 32, 9);
      s.vl(R.hull[2], q + 6, 32, 9);
      const back = q < 19 ? q : q + 6;
      s.vl(R.wood[2], back, 22, 8);
      s.vl(R.wood[1], back, 22, 3);
    }
    // The table with a glass and a cup.
    s.use(3, 3);
    s.rect(R.white[1], 11, 28, 19, 2);
    s.hl(R.white[0], 11, 28, 19);
    s.hl(R.white[2], 11, 29, 19);
    s.vl(R.hull[2], 20, 30, 10);
    s.hl(R.hull[2], 15, 40, 11);
    s.rect(R.yellow[1], 14, 24, 3, 4);
    s.hl(R.white[0], 14, 24, 3);
    s.rect(R.white[1], 24, 25, 3, 3);
    s.px(R.white[0], 26, 25);
    // The parasol: stripes, lit on the right, a scalloped hem.
    s.use(4, 4);
    s.poly(c1, [
      [20, 0],
      [39, 10],
      [0, 10],
    ]);
    s.line(c0, 20, 0, 39, 10);
    for (const [a, b] of [
      [13, 10],
      [26, 10],
    ]) {
      s.poly(R.white[1], [
        [20, 1],
        [a + 5, b],
        [a, b],
      ]);
    }
    s.line(R.white[0], 20, 1, 31, 10);
    s.hl(c2, 0, 10, 40);
    for (let q = 1; q < 38; q += 4) s.hl(R.dred[2], q, 11, 2);
    const o = addMargin(s);
    o.finish(K);
    return o;
  },
  { part: 'a-terrace' },
);

/** The city's iron street urinal: a green curl of plates. */
export const URINAL = defineArt(
  L,
  'a/urinal',
  () => {
    const s = new S(30, 46);
    const [a, b, c, d] = R.iron;
    s.use(1, 1);
    s.rect(b, 2, 12, 26, 28);
    s.vl(c, 2, 12, 28);
    s.vl(c, 3, 12, 28);
    s.vl(a, 27, 12, 28);
    s.vl(a, 26, 12, 28);
    for (const q of [8, 14, 20]) {
      s.vl(c, q, 13, 26);
      s.vl(a, q + 1, 13, 26);
    }
    s.hl(d, 2, 39, 26);
    s.hl(a, 2, 12, 26);
    // The band with the three crosses.
    s.use(2, 2);
    s.rect(R.dred[1], 9, 18, 12, 5);
    s.hl(R.dred[0], 9, 18, 12);
    for (const q of [10, 14, 18]) {
      s.px(R.xw[0], q, 19);
      s.px(R.xw[0], q + 2, 19);
      s.px(R.xw[0], q + 1, 20);
      s.px(R.xw[0], q, 21);
      s.px(R.xw[0], q + 2, 21);
    }
    // The dome and the finial, the open foot.
    s.use(3, 3);
    s.ell(b, 15, 11, 14, 8);
    s.rect(R.hull[3], 1, 11, 28, 1);
    for (let q = 4; q < 28; q += 5) s.vl(c, q, 5, 6);
    s.vl(a, 24, 5, 6);
    s.vl(a, 23, 4, 6);
    s.use(4, 3.5);
    s.rect(c, 13, 1, 4, 3);
    s.px(a, 16, 1);
    s.ell(R.brass[1], 15, 0.5, 2, 1);
    s.use(5, 3);
    s.rect(c, 0, 40, 30, 3);
    s.hl(a, 0, 40, 30);
    s.hl(d, 0, 42, 30);
    s.rect(d, 3, 43, 24, 3);
    const o = addMargin(s);
    o.finish(K);
    return o;
  },
  { part: 'a-urinal' },
);

/** Buckets of flowers on the pavement, and a board. */
export const FLOWER_BUCKETS = defineArt(
  L,
  'a/flower-buckets',
  () => {
    const s = new S(34, 24);
    const r = rngf(55);
    for (let q = 1; q < 30; q += 8) {
      s.use(q, 2);
      s.rect(R.pole[1], q, 15, 7, 9);
      s.vl(R.pole[0], q + 6, 15, 9);
      s.vl(R.pole[2], q, 15, 9);
      s.hl(R.pole[3], q, 23, 7);
      s.use(q + 40, 3);
      const col = R[['tulip', 'yellow', 'dred', 'cloth'][(q >> 3) % 4]];
      for (let n = 0; n < 12; n++) {
        const x = q + r.int(-1, 7);
        const y = r.int(1, 14);
        s.px(R.leaf[n % 3], x, y + 2);
        if (y < 9) s.rect(col[1], x, y, 2, 2);
        if (y < 6) s.px(col[0], x + 1, y);
      }
    }
    const o = addMargin(s);
    o.finish(K);
    return o;
  },
  { part: 'a-buckets' },
);

/** A pavement board with the shop's offer. */
export const STREET_BOARD = defineArt(
  L,
  'a/street-board',
  () => {
    const s = new S(16, 22);
    const [a, b, c] = R.wood;
    s.use(1, 1);
    s.rect(b, 0, 0, 16, 22);
    s.vl(c, 0, 0, 22);
    s.vl(a, 15, 0, 22);
    s.hl(a, 0, 0, 16);
    s.use(2, 2);
    s.rect(R.hull[2], 2, 2, 12, 14);
    for (const q of [4, 7, 10, 13]) s.hl(R.cloth[1], 4, q, q % 2 ? 8 : 6);
    s.hl(R.yellow[0], 4, 4, 8);
    const o = addMargin(s);
    o.finish(K);
    return o;
  },
  { part: 'a-board' },
);

/** Three wooden crates with apples, by a wall. */
export const WALL_CRATES = defineArt(
  L,
  'a/wall-crates',
  () => {
    const s = new S(28, 18);
    const r = rngf(71);
    const [a, b, c, d] = R.wood;
    for (const [x, y] of [
      [0, 8],
      [14, 8],
      [7, 0],
    ]) {
      s.use(x + y + 1, 1 + y * -0.01 + (y === 0 ? 2 : 0));
      s.rect(b, x, y + 3, 14, 7);
      s.hl(a, x, y + 3, 14);
      s.hl(c, x, y + 6, 14);
      s.hl(d, x, y + 9, 14);
      s.vl(c, x, y + 3, 7);
      s.vl(a, x + 13, y + 3, 7);
      for (let q = x + 1; q < x + 13; q += 2) {
        const col = R[r.pick(['dred', 'leaf2', 'bricko'])];
        s.rect(col[1], q, y + 1, 2, 2);
        s.px(col[0], q + 1, y + 1);
      }
    }
    const o = addMargin(s);
    o.finish(K);
    return o;
  },
  { part: 'a-crates' },
);

// ------------------------------------------------------------------------------- twins: the breakables

/** A wreck's bits on the street. */
function debrisRow(s: S, x0: number, x1: number, y: number, seed: number, mats: readonly string[]): void {
  const r = rngf(seed);
  for (let q = x0; q < x1; q += r.int(3, 6)) {
    const c = R[r.pick(mats)];
    const h = r.int(1, 4);
    s.rect(c[1], q, y - h, r.int(2, 4), h);
    s.px(c[0], q + 1, y - h);
  }
}

/** The twin of `decor/ams/ams-herring-cart` (0 whole, 1 wrecked; 50 × 40, bottom centre). */
export const HERRING_TWIN = defineArt(
  L,
  'a/herring-twin',
  () => {
    const whole = new S(48, 38);
    const [w0, w1, w2] = R.white;
    const [n0, n1, n2, n3] = R.navy;
    // The box.
    whole.use(1, 1);
    whole.rect(w0, 3, 10, 42, 20);
    whole.vl(w1, 3, 10, 20);
    whole.vl(w1, 4, 10, 20);
    whole.hl(w2, 3, 29, 42);
    // The blue band with the name, the hatch.
    whole.use(2, 2);
    whole.rect(n1, 3, 21, 42, 7);
    whole.hl(n0, 3, 21, 42);
    whole.hl(n2, 3, 27, 42);
    whole.vl(n3, 3, 21, 7);
    const lb = 'HARING';
    text(whole, lb, 4 + ((40 - textW(lb)) >> 1), 22, w0);
    whole.use(3, 2.5);
    whole.rect(R.hull[3], 9, 12, 30, 8);
    whole.hl(R.glow[1], 10, 13, 28);
    // Fish on ice, an onion tray.
    whole.use(4, 3);
    for (let q = 11; q < 26; q += 5) {
      whole.rect(R.pole[1], q, 16, 4, 2);
      whole.px(R.pole[0], q + 3, 16);
      whole.px(R.hull[2], q, 17);
    }
    whole.rect(R.white[1], 28, 17, 9, 2);
    whole.hl(R.white[0], 28, 17, 9);
    whole.hl(R.wood[0], 8, 19, 32);
    // The roof: stripes, a scalloped hem, a flag.
    whole.use(5, 4);
    for (let i = 0; i < 48; i++) {
      const odd = Math.floor(i / 6) % 2 === 1;
      const c = odd ? R.white : R.navy;
      whole.vl(i > 24 ? c[0] : c[1], i, 5, 5);
      whole.px(c[1], i, 10);
      if (i % 6 !== 5) whole.px(c[2], i, 11);
    }
    whole.hl(R.white[0], 0, 5, 48);
    whole.use(6, 3.5);
    whole.vl(R.pole[1], 40, 0, 6);
    whole.rect(R.dred[1], 41, 0, 5, 1);
    whole.rect(R.white[0], 41, 1, 5, 1);
    whole.rect(R.navy[1], 41, 2, 5, 1);
    // The wheels.
    for (const wx of [12, 36]) {
      whole.use(7, 5);
      whole.ell(R.hull[3], wx, 31, 6, 6);
      whole.ell(R.hull[2], wx, 31, 5, 5);
      whole.ell(R.pole[1], wx, 31, 2.6, 2.6);
      whole.px(R.pole[0], wx + 1, 30);
    }
    const o = addMargin(whole);
    o.finish();
    const wr = new S(48, 38);
    wr.use(1, 1);
    wr.poly(w1, [
      [4, 36],
      [6, 22],
      [34, 18],
      [38, 33],
    ]);
    wr.line(w0, 6, 22, 34, 18);
    wr.poly(n1, [
      [6, 30],
      [7, 26],
      [36, 23],
      [37, 27],
    ]);
    wr.use(2, 2);
    wr.ell(R.hull[3], 41, 32, 5, 5);
    wr.ell(R.pole[1], 41, 32, 2, 2);
    debrisRow(wr, 2, 46, 38, 9, ['pole', 'white', 'navy']);
    const ow = addMargin(wr);
    ow.finish();
    return [o, ow];
  },
  { anchor: 'bc', part: 'a-herring' },
);

/** The twin of `decor/ams/ams-tulip-stall` (0 whole, 1 wrecked; 50 × 38, bottom centre). */
export const TULIP_TWIN = defineArt(
  L,
  'a/tulip-twin',
  () => {
    const whole = new S(48, 36);
    const r = rngf(590);
    const [a, b, c, d] = R.wood;
    // The poles and the back.
    whole.use(1, 1);
    tube(whole, 'pole', 2, 8, 2, 28);
    tube(whole, 'pole', 44, 8, 2, 28);
    // Crates in two steps, full of tulips.
    for (const [x, y, w] of [
      [4, 24, 40],
      [8, 16, 32],
    ]) {
      whole.use(y === 24 ? 4 : 2, y === 24 ? 3 : 2);
      whole.rect(b, x, y, w, 12);
      whole.hl(a, x, y, w);
      whole.hl(c, x, y + 4, w);
      whole.hl(d, x, y + 11, w);
      whole.vl(c, x, y, 12);
      whole.vl(a, x + w - 1, y, 12);
      for (let q = x + 1; q < x + w - 2; q += 2) {
        const col = R[r.pick(['tulip', 'yellow', 'dred', 'cloth', 'bricko'])];
        const hh = r.int(2, 6);
        whole.vl(R.leaf[r.int(1, 3)], q, y - hh, hh);
        whole.rect(col[1], q, y - hh - 2, 2, 2);
        whole.px(col[0], q + 1, y - hh - 2);
      }
    }
    // A price board.
    whole.use(5, 3.5);
    whole.rect(R.cloth[0], 20, 27, 12, 6);
    whole.hl(R.dred[1], 20, 27, 12);
    whole.hl(R.hull[2], 22, 30, 8);
    // The awning.
    whole.use(6, 4);
    for (let i = 0; i < 48; i++) {
      const odd = Math.floor(i / 6) % 2 === 1;
      const col = odd ? R.white : R.dgreen;
      whole.vl(i > 24 ? col[0] : col[1], i, 0, 7);
      whole.px(col[1], i, 7);
      if (i % 6 !== 5) whole.px(col[2], i, 8);
    }
    const o = addMargin(whole);
    o.finish();
    const wr = new S(48, 36);
    wr.use(1, 1);
    wr.rect(b, 6, 26, 20, 8);
    wr.hl(a, 6, 26, 20);
    wr.hl(d, 6, 33, 20);
    wr.line(c, 20, 26, 34, 34);
    wr.use(2, 2);
    wr.line(R.pole[1], 36, 35, 46, 18);
    debrisRow(wr, 2, 46, 36, 11, ['tulip', 'yellow', 'dred', 'leaf', 'wood']);
    const ow = addMargin(wr);
    ow.finish();
    return [o, ow];
  },
  { anchor: 'bc', part: 'a-tulip' },
);

const K_WHEEL = R.iron[2];

/**
 * The twin of the shared breakable `decor/ams/ams-bike-rack` (frame 0 whole, frame 1 wrecked; bottom
 * centre anchor, as the shared sprite). Its hitbox stays the entity's: 50 × 22.
 */
export const RACK_TWIN = defineArt(
  L,
  'a/rack-twin',
  () => {
    const whole = new S(58, 30);
    const rk = bikeRack(6);
    whole.paste(rk, 29 - (rk.w >> 1), 30 - rk.h);
    whole.paste(bike('navy'), 0, 30 - bike('navy').h);
    whole.paste(bike('dred'), 15, 30 - bike('dred').h);
    const wreck = new S(58, 30);
    const low = bikeRack(4);
    wreck.paste(low, 4, 30 - low.h);
    const [a, b] = R.pole;
    wreck.use(9, 2);
    wreck.line(b, 40, 28, 54, 21);
    wreck.line(a, 41, 29, 55, 22);
    wreck.ell(K_WHEEL, 36, 25, 4, 4);
    wreck.ell(a, 36, 25, 2, 2);
    wreck.finish();
    return [whole, wreck];
  },
  { anchor: 'bc' },
);

// ---------------------------------------------------------------------------------- twins: the crate

/** The white swan on the crate's front (beak to the right). */
const CRATE_SWAN = ['......##.', '......###', '.....##..', '#....#...', '##..##...', '#######..', '.#####...'];

/** The supply crate on a canvas of 22 + `pad` × `h`: planks, lit lid, rope bands, the swan; `crack` splits it. */
function crateCanvas(cw: number, ch: number, x0: number, y0: number, w: number, h: number, crack: boolean): S {
  const s = new S(cw, ch);
  const [a, b, c, d] = R.wood;
  const [r0, r1, r2] = R.plastc;
  // The front.
  s.use(1, 1);
  s.rect(b, x0, y0 + 3, w, h - 3);
  for (let y = y0 + 8; y < y0 + h - 1; y += 5) {
    s.hl(c, x0 + 2, y, w - 4);
    s.hl(d, x0 + 2, y + 1, 5);
    s.hl(d, x0 + w - 7, y + 1, 5);
  }
  s.hl(a, x0 + w - 8, y0 + 3, 6);
  s.hl(d, x0, y0 + h - 1, w);
  // The frame boards: shade on the left, light on the right.
  s.use(1, 1);
  s.rect(c, x0, y0 + 3, 2, h - 3);
  s.rect(a, x0 + w - 2, y0 + 3, 2, h - 3);
  s.vl(b, x0 + w - 2, y0 + 3, h - 3);
  s.hl(d, x0, y0 + h - 1, 2);
  s.hl(c, x0 + w - 2, y0 + h - 1, 2);
  for (let y = y0 + 6; y < y0 + h - 2; y += 5) {
    s.px(d, x0 + 2, y);
    s.px(d, x0 + w - 3, y);
  }
  // The lid.
  s.use(1, 1);
  s.rect(a, x0, y0, w, 3);
  s.hl(b, x0, y0 + 2, w);
  s.hl(c, x0, y0 + 3, w);
  for (let q = x0 + 5; q < x0 + w - 2; q += 7) s.vl(b, q, y0, 2);
  // The swan.
  s.use(1, 1);
  const sx = x0 + ((w - 9) >> 1);
  const sy = y0 + 6 + ((h - 18) >> 1);
  CRATE_SWAN.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] === '#') s.px(i > 4 ? R.white[0] : R.white[1], sx + i, sy + j);
  });
  // The rope bands, a knot on the left one.
  s.use(1, 1);
  for (const q of [x0 + 3, x0 + w - 6]) {
    for (let y = y0; y < y0 + h; y++) {
      s.px((y >> 1) & 1 ? r0 : r1, q, y);
      s.px((y >> 1) & 1 ? r1 : r2, q + 1, y);
    }
  }
  s.use(1, 1);
  s.rect(r1, x0 + 2, y0 + 3, 4, 3);
  s.hl(r0, x0 + 2, y0 + 3, 4);
  s.px(r2, x0 + 2, y0 + 5);
  s.px(r2, x0 + 4, y0 + 6);
  if (crack) {
    s.use(1, 1);
    for (const [p, q] of [
      [x0 + 8, 2],
      [x0 + 15, -1],
    ] as const) {
      let x = p;
      for (let y = y0 + 4; y < y0 + h - 1; y += 1) {
        s.px(R.hull[3], x, y);
        if (y % 3 === 0) x += q > 0 ? 1 : -1;
      }
    }
  }
  return s;
}

/** The idle crate's size with its outline (as `item/crate`). */
const CRATE_OW = 24;
const CRATE_OH = 20;

/** The twin of `item/crate` (one frame, bottom centre: 24 × 20). */
export const CRATE_TWIN = anchoredArt(
  'a/crate-twin',
  () => {
    const o = addMargin(crateCanvas(CRATE_OW - 2, CRATE_OH - 2, 0, 0, CRATE_OW - 2, CRATE_OH - 2, false));
    o.finish(K);
    return [o];
  },
  CRATE_OW >> 1,
  CRATE_OH,
);

/** The twin of `item/crate-hit` (two frames: it squashes, it recovers). */
export const CRATE_HIT_TWIN = anchoredArt(
  'a/crate-hit-twin',
  () => {
    const squashed = addMargin(crateCanvas(24, CRATE_OH - 2, 0, 2, 24, CRATE_OH - 4, false));
    squashed.finish(K);
    const back = addMargin(crateCanvas(24, CRATE_OH - 2, 1, 0, CRATE_OW - 2, CRATE_OH - 2, false));
    back.finish(K);
    return [squashed, back];
  },
  (CRATE_OW + 2) >> 1,
  CRATE_OH,
);

/** Canvas of the crate's break: the planks fly. */
const BREAK_W = 66;
const BREAK_H = 42;

/** A loose plank, or a bit of rope. */
function loosePlank(s: S, x: number, y: number, len: number, upright: boolean, rope: boolean, part: number): void {
  const [a, b, c] = rope ? R.plastc : R.wood;
  s.use(part, part);
  if (upright) {
    s.rect(b, x, y, 3, len);
    s.vl(a, x + 2, y, len);
    s.vl(c, x, y, len);
  } else {
    s.rect(b, x, y, len, 3);
    s.hl(a, x, y, len);
    s.hl(c, x, y + 2, len);
  }
}

/** The twin of `item/crate-break` (four frames: it splits, the planks fly, they lie, they stay a moment). */
export const CRATE_BREAK_TWIN = anchoredArt(
  'a/crate-break-twin',
  () => {
    const out: S[] = [];
    const split = crateCanvas(BREAK_W, BREAK_H, 22, BREAK_H - 19, CRATE_OW - 2, CRATE_OH - 3, true);
    const planks: ReadonlyArray<readonly (readonly [number, number, number, boolean, boolean])[]> = [
      [
        [18, 22, 12, false, false],
        [36, 16, 11, false, false],
        [28, 8, 7, false, true],
        [14, 30, 10, true, false],
        [48, 24, 12, true, false],
        [32, 36, 13, false, false],
        [44, 32, 7, false, true],
      ],
      [
        [10, 18, 12, false, false],
        [38, 6, 11, false, false],
        [26, 0, 7, false, true],
        [6, 30, 10, true, false],
        [56, 20, 12, true, false],
        [30, 38, 13, false, false],
        [50, 34, 7, false, true],
      ],
      [
        [4, 30, 12, false, false],
        [44, 26, 11, false, false],
        [24, 34, 7, false, true],
        [2, 38, 10, false, false],
        [54, 37, 10, false, false],
        [30, 38, 13, false, false],
        [46, 38, 7, false, true],
      ],
    ];
    split.finish(K);
    out.push(split);
    for (const row of planks) {
      const s = new S(BREAK_W, BREAK_H);
      row.forEach(([x, y, len, upright, rope], i) => loosePlank(s, x, y, len, upright, rope, i + 1));
      s.finish(K);
      out.push(s);
    }
    return out;
  },
  BREAK_W >> 1,
  BREAK_H,
);

// ---------------------------------------------------------------------------------- twins: the secrets

/** The twin of `decor/ams/secret-hatch` (16 × 14, feet on the cabin roof: hidden, flips up, open). */
export const HATCH_TWIN = defineArt(
  L,
  'a/hatch-twin',
  () =>
    [0, 1, 2].map((f) => {
      const s = new S(14, 12);
      const [a, b, c, d] = R.wood;
      s.use(1, 1);
      s.rect(R.iron[2], 0, 9, 14, 3);
      s.hl(R.iron[0], 0, 9, 14);
      if (f === 0) {
        s.use(2, 2);
        s.rect(b, 1, 6, 12, 4);
        s.hl(a, 1, 6, 12);
        s.hl(d, 1, 9, 12);
        s.vl(c, 1, 6, 4);
        s.vl(a, 12, 6, 4);
        s.rect(R.brass[1], 6, 7, 2, 2);
        s.px(R.brass[0], 7, 7);
      } else if (f === 1) {
        s.use(2, 2);
        s.rect(R.hull[3], 2, 8, 10, 2);
        s.poly(b, [
          [2, 7],
          [12, 2],
          [12, 6],
          [2, 9],
        ]);
        s.line(a, 2, 7, 12, 2);
      } else {
        s.use(2, 2);
        s.rect(R.hull[3], 2, 8, 10, 2);
        s.rect(b, 11, 0, 3, 9);
        s.vl(a, 13, 0, 9);
        s.vl(d, 11, 0, 9);
      }
      const o = addMargin(s);
      o.finish();
      return o;
    }),
  { anchor: 'bc', part: 'a-hatch' },
);

/** The twin of `decor/ams/secret-tree-bike` (30 × 26, feet: a bike on a branch, it slips, the bare branch). */
export const TREE_BIKE_TWIN = defineArt(
  L,
  'a/tree-bike-twin',
  () =>
    [0, 1, 2].map((f) => {
      const s = new S(28, 24);
      const [a, b, c] = R.bark;
      // The branch.
      s.use(1, 1);
      s.line(b, 0, 2, 27, 9);
      s.line(a, 1, 1, 27, 8);
      s.line(c, 0, 3, 27, 10);
      if (f < 2) {
        const dy = f === 1 ? 4 : 0;
        s.use(2, 2);
        for (const cx of [6, 21]) {
          s.ell(R.hull[3], cx, 15 + dy, 5.5, 5.5);
          s.ell(R.pole[1], cx, 15 + dy, 4, 4);
          s.ell(R.glass[3], cx, 15 + dy, 3, 3);
          s.px(R.pole[0], cx, 15 + dy);
        }
        s.use(3, 3);
        const [d0, d1] = R.dred;
        s.line(d1, 6, 15 + dy, 11, 8 + dy);
        s.line(d1, 11, 8 + dy, 18, 8 + dy);
        s.line(d1, 18, 8 + dy, 21, 15 + dy);
        s.line(d1, 11, 8 + dy, 14, 15 + dy);
        s.line(d0, 12, 7 + dy, 18, 7 + dy);
        s.hl(R.hull[3], 9, 6 + dy, 4);
        s.hl(R.hull[3], 17, 5 + dy, 4);
      }
      const o = addMargin(s);
      o.finish();
      return o;
    }),
  { anchor: 'bc', part: 'a-tree-bike' },
);

/** The twin of `decor/ams/secret-hoist` (16 × 26, top centre at the hook: a crate in a sling, it bursts, the sling). */
export const HOIST_TWIN = anchoredArt(
  'a/hoist-twin',
  () =>
    [0, 1, 2].map((f) => {
      const s = new S(14, 24);
      const [a, b, c, d] = R.wood;
      s.use(1, 1);
      s.vl(R.bark[2], 6, 0, 8);
      s.line(R.bark[1], 6, 7, 1, 11);
      s.line(R.bark[1], 7, 7, 12, 11);
      if (f < 2) {
        s.use(2, 2);
        s.rect(b, 0, 11, 14, 12);
        s.hl(a, 0, 11, 14);
        s.hl(d, 0, 22, 14);
        s.vl(c, 0, 11, 12);
        s.vl(a, 13, 11, 12);
        s.hl(c, 1, 15, 12);
        s.hl(c, 1, 19, 12);
        if (f === 0) {
          s.line(c, 2, 21, 11, 13);
          s.rect(R.yellow[1], 6, 16, 2, 2);
        } else {
          s.line(R.hull[3], 3, 22, 10, 12);
          s.rect(R.hull[3], 5, 13, 3, 3);
        }
      }
      const o = addMargin(s);
      o.finish();
      return o;
    }),
  8,
  1,
);
