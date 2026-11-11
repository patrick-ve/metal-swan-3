/**
 * Section d's own art (sunset; docs/design/ams2.md §3): the flea market's stalls and goods, what stands
 * between them, the steps before the doors, and the twins of the shared breakables and the chest.
 * The buildings: art-d-stopera.ts.
 */
import { addMargin, S, text, textW } from '../../../art/herokit/canvas';
import { K, R } from '../../../art/herokit/palette';
import { bike, bikeRack, flagPole, lamp, stall, tube } from '../../../art/herokit/props';
import { rngf } from '../../../art/herokit/rng';
import { window_ } from '../../../art/herokit/walls';
import { MID_ROWS, MID_W, paintStopera, S_BLD } from './art-d-stopera';
import { type Band, defineArt, defineBand } from './stage';

const L = 'sunset';

// ------------------------------------------------------------------------------- the middle plane

export const STOPERA: Band = defineBand({ light: L, name: 'd/stopera', speed: S_BLD, rows: MID_ROWS, width: MID_W, paint: paintStopera });

/** A lit window that goes on and off: frame 0 lit, the rest empty. */
export function blinkWindow(i: number, w = 16, h = 20): string {
  return defineArt(
    L,
    `d/lit-window-${i}-${w}x${h}`,
    () => {
      const s = new S(w, h);
      s.use(1, 1);
      window_(s, 0, 0, w, h, rngf(3), 2, { z: 1, lit: true });
      const out: S[] = [s];
      for (let k = 0; k < 2 + (i % 3); k++) out.push(new S(w, h));
      return out;
    },
    { anchor: 'tl' },
  );
}

// ------------------------------------------------------------------------------------ the market

const CLOTHS: ReadonlyArray<readonly [string, string]> = [
  ['dred', 'white'],
  ['navy', 'white'],
  ['yellow', 'dred'],
  ['dgreen', 'white'],
];

/** One stall of the market: the stand and its goods that sway. `i` picks the seed and the awning. */
export function stallArt(i: number, w = 60): { box: string; goods: string } {
  const cloth = CLOTHS[i % 4];
  return {
    box: defineArt(L, `d/stall-${i}-${w}`, () => stall(w, 400 + i, cloth).box),
    goods: defineArt(L, `d/stall-goods-${i}-${w}`, () => stall(w, 400 + i, cloth).cloth, { anchor: 'tl' }),
  };
}

export const LAMP_76 = defineArt(L, 'd/lamp-76', () => lamp(76));

/** A flag pole on a roof. */
export const ROOF_POLE = defineArt(L, 'd/roof-pole', () => flagPole(40));

/** Coats on a rail: two frames that sway. */
export const CLOTHES_RAIL = defineArt(
  L,
  'd/clothes-rail',
  () =>
    [0, 1].map((f) => {
      const w = 48;
      const h = 44;
      const s = new S(w, h);
      s.use(1, 1);
      tube(s, 'pole', 1, 2, 2, h - 4);
      tube(s, 'pole', w - 3, 2, 2, h - 4);
      s.rect(R.pole[1], 0, 2, w, 2);
      s.hl(R.pole[0], 0, 2, w);
      s.hl(R.pole[2], 0, 4, w);
      s.hl(R.hull[1], 0, h - 2, 6);
      s.hl(R.hull[1], w - 6, h - 2, 6);
      const r = rngf(641);
      const looks: readonly string[] = ['dgreen', 'yellow', 'navy', 'dred', 'plastp', 'blue', 'bricko', 'dred'];
      let x = 4;
      let k = 0;
      while (x < w - 8) {
        const cw = r.int(5, 7);
        const clen = r.int(17, 30);
        const c = R[looks[k % looks.length]];
        const lean = f && k % 2 ? 1 : 0;
        s.use(2 + k, 2 + k * 0.05);
        // Hook, shoulders, the body with a fold, a collar, buttons.
        s.vl(R.hull[3], x + (cw >> 1), 4, 2);
        s.rect(c[1], x, 6, cw, 5);
        s.rect(c[1], x + lean, 11, cw, clen - 5);
        s.vl(c[0], x + cw - 1, 6, 5);
        s.vl(c[0], x + cw - 1 + lean, 11, clen - 5);
        s.vl(c[2], x, 6, 5);
        s.vl(c[2], x + lean, 11, clen - 5);
        s.vl(c[2], x + 2 + lean, 13, clen - 9);
        s.hl(c[2], x + lean, 6 + clen - 1, cw);
        s.hl(c[0], x + 1, 6, cw - 2);
        s.px(R.white[0], x + (cw >> 1), 7);
        if (clen > 22) s.hl(c[2], x + lean, 18, cw);
        x += cw + 1;
        k++;
      }
      const o = addMargin(s);
      o.finish();
      return o;
    }),
  { ticksPerFrame: 30 },
);

/** Rugs over a frame: hard bands of pattern, a fringe. */
export const RUG_RACK = defineArt(L, 'd/rug-rack', () => {
  const w = 42;
  const h = 46;
  const s = new S(w, h);
  s.use(1, 1);
  const W_ = R.wood;
  tube(s, 'wood', 0, 3, 3, h - 3);
  tube(s, 'wood', w - 3, 3, 3, h - 3);
  s.rect(W_[1], 0, 3, w, 2);
  s.hl(W_[0], 0, 3, w);
  s.hl(W_[3], 0, 5, w);
  const rugs: ReadonlyArray<readonly [number, number, string, string, number]> = [
    [4, 11, 'dred', 'yellow', 30],
    [15, 12, 'navy', 'plastc', 35],
    [27, 11, 'plastg', 'dred', 27],
  ];
  rugs.forEach(([x, rw, a, b, rh], i) => {
    const c = R[a];
    const d = R[b];
    s.use(2 + i, 2 + i * 0.1);
    s.rect(c[1], x, 5, rw, rh);
    s.vl(c[2], x, 5, rh);
    s.vl(c[0], x + rw - 1, 5, rh);
    for (let y = 8; y < 5 + rh - 3; y += 8) {
      const m = x + (rw >> 1);
      for (let q = -2; q <= 2; q++) {
        const span = 2 - Math.abs(q);
        s.hl(d[1], m - span, y + 2 + q, span * 2 + 1);
      }
      s.hl(d[2], x + 1, y - 2, rw - 2);
    }
    for (let q = x; q < x + rw; q += 2) s.vl(R.cloth[1], q, 5 + rh, 2);
  });
  const o = addMargin(s);
  o.finish();
  return o;
});

/** A table of records with a gramophone. */
export const RECORD_TABLE = defineArt(L, 'd/record-table', () => {
  const w = 44;
  const h = 34;
  const s = new S(w, h);
  const W_ = R.wood;
  s.use(1, 1);
  s.rect(W_[1], 0, 18, w, 3);
  s.hl(W_[0], 0, 18, w);
  s.hl(W_[3], 0, 20, w);
  for (const x of [2, w - 5]) s.rect(W_[2], x, 21, 3, 13);
  s.vl(W_[3], 2, 21, 13);
  // The bin of sleeves.
  s.use(2, 2);
  s.rect(W_[2], 3, 10, 21, 8);
  s.hl(W_[0], 3, 10, 21);
  s.hl(W_[3], 3, 17, 21);
  s.use(3, 1.6);
  const r = rngf(655);
  for (let x = 4; x < 23; x += 3) {
    const c = R[r.pick(['dred', 'navy', 'yellow', 'plastg', 'white', 'plastp'])];
    s.rect(c[1], x, 4 + (x % 2), 2, 7);
    s.vl(c[0], x + 1, 4 + (x % 2), 7);
    s.px(c[2], x, 10);
  }
  // The gramophone: a box and a brass horn.
  s.use(4, 2.2);
  s.rect(W_[2], 28, 11, 12, 7);
  s.hl(W_[0], 28, 11, 12);
  s.vl(W_[0], 39, 11, 7);
  s.vl(W_[3], 28, 11, 7);
  s.use(5, 2.4);
  const b = R.brass;
  s.poly(b[1], [
    [30, 10],
    [33, 8],
    [40, 0],
    [43, 6],
    [34, 11],
  ]);
  s.line(b[0], 40, 1, 42, 5);
  s.line(b[2], 31, 10, 39, 3);
  s.rect(R.hull[3], 29, 9, 4, 2);
  // The cloth under the table with the price card.
  s.use(6, 1.3);
  s.rect(R.cloth[1], 6, 21, 32, 8);
  for (let x = 6; x < 38; x += 4) s.vl(R.cloth[2], x, 21, 8);
  s.hl(R.cloth[2], 6, 28, 32);
  s.use(7, 1.5);
  s.rect(R.white[0], 15, 22, 13, 6);
  text(s, 'LP', 18, 22, K);
  const o = addMargin(s);
  o.finish();
  return o;
});

/** Two old chairs, a standing mirror that holds the sky. */
export const CHAIRS_MIRROR = defineArt(L, 'd/chairs-mirror', () => {
  const w = 40;
  const h = 42;
  const s = new S(w, h);
  const W_ = R.wood;
  // The mirror.
  s.use(1, 1);
  s.rect(W_[2], 24, 3, 13, 33);
  s.hl(W_[0], 24, 3, 13);
  s.vl(W_[0], 36, 3, 33);
  s.vl(W_[3], 24, 3, 33);
  s.hl(W_[3], 24, 35, 13);
  s.use(2, 1.2);
  const g = R.sky_s;
  s.rect(g[3], 26, 5, 9, 7);
  s.rect(g[4], 26, 12, 9, 8);
  s.rect(g[5], 26, 20, 9, 8);
  s.rect(g[6], 26, 28, 9, 6);
  s.line(R.white[0], 33, 7, 28, 16);
  s.use(3, 1.4);
  s.rect(W_[2], 24, 36, 2, 6);
  s.rect(W_[2], 35, 36, 2, 6);
  s.hl(W_[3], 22, h - 1, 17);
  // The chairs.
  const chair = (x: number, part: number, c: readonly number[]): void => {
    s.use(part, 2);
    s.rect(c[1], x + 7, 14, 2, 28);
    s.vl(c[0], x + 8, 14, 28);
    s.rect(c[1], x, 28, 9, 3);
    s.hl(c[0], x, 28, 9);
    s.hl(c[3], x, 30, 9);
    s.rect(c[2], x, 31, 2, 11);
    for (const y of [16, 20, 24]) s.hl(c[1], x + 3, y, 5);
    s.vl(c[2], x + 3, 16, 9);
  };
  chair(1, 4, R.wood);
  chair(12, 5, R.brickb);
  const o = addMargin(s);
  o.finish();
  return o;
});

/** A book cart under a parasol. */
export const BOOK_CART = defineArt(L, 'd/book-cart', () => {
  const w = 60;
  const h = 50;
  const s = new S(w, h);
  const c = R.dgreen;
  const d = R.white;
  // The parasol.
  s.use(1, 1);
  tube(s, 'pole', 29, 8, 2, h - 8);
  s.use(2, 3);
  for (let i = 0; i < w; i++) {
    const u = (i - w / 2 + 0.5) / (w / 2);
    const top = Math.round(1 + 6 * u * u);
    const band = Math.floor((i + 2) / 10) % 2;
    const col = band ? d : c;
    s.vl(i >= w / 2 ? col[0] : col[1], i, top, 12 - top);
    s.px(col[2], i, 11);
    s.px(col[2], i, 12);
  }
  s.rect(R.brass[1], 29, 0, 2, 2);
  // The cart.
  s.use(3, 2);
  const W_ = R.wood;
  s.rect(W_[1], 8, 26, 44, 17);
  s.hl(W_[0], 8, 26, 44);
  s.vl(W_[0], 51, 26, 17);
  s.vl(W_[3], 8, 26, 17);
  s.hl(W_[3], 8, 42, 44);
  s.use(4, 2.2);
  const r = rngf(672);
  for (const row of [27, 35]) {
    s.rect(R.hull[3], 10, row, 40, 7);
    let x = 10;
    while (x < 48) {
      const bw = r.int(2, 4);
      const bh = r.int(5, 8);
      const cc = R[r.pick(['dred', 'navy', 'plastc', 'plastg', 'bricko', 'brickd'])];
      s.rect(cc[1], x, row + 7 - bh, bw, bh);
      s.vl(cc[0], x + bw - 1, row + 7 - bh, bh);
      s.px(R.cloth[0], x, row + 8 - bh + 1);
      x += bw;
    }
  }
  s.use(5, 2.4);
  s.rect(W_[2], 20, 19, 22, 7);
  s.hl(W_[0], 20, 19, 22);
  s.hl(W_[3], 20, 25, 22);
  text(s, 'BOEKEN', 31 - (textW('BOEKEN') >> 1), 20, R.white[0]);
  // Wheels.
  s.use(6, 2.6);
  for (const x of [15, 45]) {
    s.ell(R.hull[3], x, 45, 4.5, 4.5);
    s.ell(R.pole[1], x, 45, 2.5, 2.5);
    s.px(R.pole[0], x + 1, 44);
  }
  const o = addMargin(s);
  o.finish();
  return o;
});

/** A trunk of oddments: a lamp with a shade on a stack of crates. */
export const LAMP_ON_CRATES = defineArt(L, 'd/lamp-crates', () => {
  const w = 30;
  const h = 40;
  const s = new S(w, h);
  const W_ = R.wood;
  s.use(1, 1);
  s.rect(W_[1], 0, 22, 26, 18);
  s.hl(W_[0], 0, 22, 26);
  s.vl(W_[0], 25, 22, 18);
  s.vl(W_[2], 0, 22, 18);
  s.hl(W_[3], 0, 39, 26);
  for (const y of [28, 34]) s.hl(W_[2], 1, y, 24);
  s.line(W_[2], 2, 37, 23, 24);
  s.use(2, 2);
  const c = R.plastp;
  s.poly(c[1], [
    [8, 11],
    [18, 11],
    [21, 2],
    [5, 2],
  ]);
  s.hl(c[0], 6, 2, 15);
  s.line(c[0], 20, 3, 18, 10);
  s.line(c[2], 6, 3, 9, 10);
  s.use(3, 2.2);
  s.rect(R.brass[1], 12, 12, 2, 9);
  s.vl(R.brass[0], 13, 12, 9);
  s.rect(R.brass[2], 9, 20, 8, 2);
  s.hl(R.brass[0], 9, 20, 8);
  const o = addMargin(s);
  o.finish();
  return o;
});

// ------------------------------------------------------------------------------------- the steps

/** The steps before the glass doors, on the far floor band (their foot stays clear of the kerb). */
export const DOOR_STEPS = defineArt(L, 'd/door-steps', () => {
  const w = 112;
  const s = new S(w, 14);
  const [m0, m1, m2, m3] = R.marble;
  for (let i = 0; i < 3; i++) {
    const y = i * 4;
    const inset = (2 - i) * 4;
    s.use(i + 1, 1 + i);
    s.rect(m1, inset, y, w - inset * 2, 4);
    s.hl(m0, inset, y, w - inset * 2);
    s.hl(m3, inset, y + 3, w - inset * 2);
    s.vl(m0, w - inset - 1, y, 4);
    s.vl(m2, inset, y, 4);
    for (let x = inset + 9; x < w - inset; x += 17) s.vl(m2, x, y + 1, 2);
  }
  const o = addMargin(s);
  o.finish();
  return o;
});

// ------------------------------------------------------------------------------------- the twins

/** Twin of the breakable `decor/ams/ams-market-stall` (0 whole, 1 wreck; bottom centre; its hitbox stays the entity's: 54 × 36). */
export const STALL_TWIN = defineArt(
  L,
  'd/stall-twin',
  () => {
    const whole = new S(62, 52);
    const { box, cloth } = stall(54, 431, ['dgreen', 'yellow']);
    whole.paste(box, 0, 0);
    whole.paste(cloth[0], 4, 13);
    const wreck = new S(62, 52);
    wreck.use(1, 1);
    const W_ = R.wood;
    // A leg still standing, the table's top on the ground, the awning in a heap.
    tube(wreck, 'pole', 53, 26, 2, 26);
    wreck.line(R.pole[2], 9, 50, 22, 34);
    wreck.line(R.pole[1], 10, 50, 23, 34);
    wreck.use(2, 2);
    wreck.poly(W_[1], [
      [6, 49],
      [50, 43],
      [51, 46],
      [7, 51],
    ]);
    wreck.line(W_[0], 7, 49, 50, 43);
    wreck.line(W_[3], 8, 51, 50, 46);
    wreck.use(3, 3);
    const a = R.dgreen;
    const b = R.yellow;
    for (let i = 0; i < 44; i++) {
      const c = Math.floor(i / 6) % 2 ? b : a;
      const y = 34 + Math.round(Math.abs(Math.sin(i * 0.31)) * 4) + (i >> 3);
      wreck.vl(i % 6 >= 2 ? c[0] : c[1], 16 + i, y, 5);
      wreck.vl(c[2], 16 + i, y + 5, 2);
    }
    wreck.use(4, 3.5);
    const r = rngf(432);
    for (let i = 0; i < 6; i++) {
      const c = R[r.pick(['dred', 'navy', 'plastg', 'bricko'])];
      const x = r.int(2, 52);
      wreck.rect(c[1], x, 47 + (i % 3), 6, 3);
      wreck.hl(c[0], x, 47 + (i % 3), 6);
    }
    wreck.finish();
    return [whole, wreck];
  },
  { anchor: 'bc' },
);

/** Twin of the breakable `decor/ams/ams-bike-rack` (0 whole, 1 wreck; bottom centre; hitbox 50 × 22). */
export const RACK_TWIN = defineArt(
  L,
  'd/rack-twin',
  () => {
    const whole = new S(58, 30);
    const rk = bikeRack(6);
    whole.paste(rk, 29 - (rk.w >> 1), 30 - rk.h);
    whole.paste(bike('dgreen'), 2, 30 - bike('dgreen').h);
    whole.paste(bike('navy'), 16, 30 - bike('navy').h);
    const wreck = new S(58, 30);
    const low = bikeRack(4);
    wreck.paste(low, 4, 30 - low.h);
    const [a, b, c] = R.pole;
    // A bike on its side in front of the rack: two flat wheels, the bent frame, a saddle; one wheel off, against the rack.
    const n = R.navy;
    wreck.use(9, 2);
    wreck.ell(R.hull[3], 46, 20, 6, 6);
    wreck.ell(c, 46, 20, 4, 4);
    wreck.ell(R.hull[3], 46, 20, 3, 3);
    wreck.line(a, 44, 18, 48, 22);
    wreck.use(10, 3);
    wreck.ell(R.hull[3], 12, 27, 8, 2);
    wreck.ell(c, 12, 27, 6, 1);
    wreck.ell(R.hull[3], 36, 27, 8, 2);
    wreck.ell(c, 36, 27, 6, 1);
    wreck.use(11, 3.5);
    wreck.line(n[1], 12, 25, 25, 23);
    wreck.line(n[0], 13, 24, 25, 22);
    wreck.line(n[1], 25, 23, 36, 26);
    wreck.line(n[2], 19, 26, 30, 26);
    wreck.rect(R.hull[2], 24, 20, 6, 2);
    wreck.line(b, 8, 25, 3, 20);
    wreck.line(a, 3, 20, 7, 19);
    wreck.finish();
    return [whole, wreck];
  },
  { anchor: 'bc' },
);

/** Twin of `decor/ams/secret-chest` (0 hidden, 1 the lid lifts, 2 open with coins; feet anchor). */
export const CHEST_TWIN = defineArt(
  L,
  'd/chest-twin',
  () =>
    [0, 1, 2].map((f) => {
      const s = new S(20, 17);
      const W_ = R.wood;
      const iron = R.pole;
      const b = R.brass;
      // The body.
      s.use(1, 1);
      s.rect(W_[1], 1, 8, 18, 9);
      s.hl(W_[3], 1, 16, 18);
      s.vl(W_[2], 1, 8, 9);
      s.vl(W_[0], 18, 8, 9);
      s.hl(W_[2], 2, 12, 16);
      if (f === 2) {
        // Open: the inside of the lid behind, coins heaped.
        s.use(2, 0.8);
        s.rect(W_[3], 2, 1, 16, 7);
        s.hl(W_[2], 2, 1, 16);
        s.use(3, 1.4);
        s.rect(b[1], 2, 6, 16, 3);
        s.hl(b[0], 3, 6, 14);
        for (let x = 3; x < 17; x += 3) s.px(R.yellow[0], x, 5);
        s.px(R.white[0], 12, 3);
      } else {
        const lift = f === 1 ? 2 : 0;
        if (f === 1) {
          s.use(4, 0.9);
          s.hl(R.yellow[0], 2, 7, 16);
          s.hl(b[1], 2, 6, 16);
        }
        s.use(5, 2);
        s.rect(W_[1], 1, 3 - lift, 18, 5);
        s.hl(W_[0], 2, 3 - lift, 16);
        s.vl(W_[0], 18, 4 - lift, 4);
        s.vl(W_[2], 1, 4 - lift, 4);
        s.hl(W_[3], 1, 7 - lift, 18);
        s.use(6, 2.2);
        s.rect(b[1], 9, 6, 2, 4);
        s.px(b[0], 10, 6);
        s.px(R.hull[3], 9, 8);
      }
      s.use(7, 2.1);
      for (const x of [4, 15]) {
        s.vl(iron[2], x, f === 2 ? 8 : 3 - (f === 1 ? 2 : 0), f === 2 ? 9 : 14 + (f === 1 ? 2 : 0));
        s.px(iron[0], x, 8);
      }
      const o = addMargin(s);
      o.finish();
      return o;
    }),
  { anchor: 'bc' },
);

// -------------------------------------------------------------------------------- the crate's twin

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

export const CRATE_TWIN = defineArt(L, 'd/crate-twin', () => supplyCrate(0, false), { anchor: 'bc' });
export const CRATE_HIT_TWIN = defineArt(L, 'd/crate-hit-twin', () => [supplyCrate(2, false), supplyCrate(0, false)], { anchor: 'bc' });

/** The planks of the shared break frames: [x, y from the bottom centre, length, vertical]. */
const PLANKS: ReadonlyArray<ReadonlyArray<readonly [number, number, number, boolean]>> = [
  [[-15, -24, 13, false], [-2, -28, 11, false], [-17, -16, 10, true], [10, -17, 10, true], [-9, -10, 15, false], [4, -21, 7, false]],
  [[-21, -27, 13, false], [-1, -33, 11, false], [-23, -13, 10, true], [15, -13, 10, true], [-10, -7, 15, false], [9, -25, 7, false]],
  [[-24, -5, 13, false], [-7, -6, 11, false], [-26, -9, 10, true], [17, -9, 10, true], [4, -5, 15, false], [13, -5, 7, false]],
];

export const CRATE_BREAK_TWIN = defineArt(
  L,
  'd/crate-break-twin',
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
