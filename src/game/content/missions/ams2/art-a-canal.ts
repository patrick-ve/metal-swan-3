/**
 * Section a's canal things (morning; docs/design/ams2.md §3), all at speed 1 and from the numbers of
 * `ams/terrain.ts`: the hump bridge over `A_BRIDGES`, the raised drawbridge, the two houseboats of
 * `A_BOATS` (deck y 164, roof y 146), the little boat of the shared script.
 */
import { defineSprite, type Frame } from '../../../../engine/sprites';
import { addMargin, S, withKitTier } from '../../../art/herokit/canvas';
import { renderBuffer } from '../../../art/herokit/hi';
import { K, type LightName, R } from '../../../art/herokit/palette';
import { tube } from '../../../art/herokit/props';
import { rngf } from '../../../art/herokit/rng';
import { window_ } from '../../../art/herokit/walls';
import { A_BOATS, A_BRIDGES, DECK_Y, G, type Houseboat, ROOF_Y } from '../ams/terrain';
import { artId, defineArt, WATER_Y } from './stage';

export const L: LightName = 'morning';

/** A sprite with its own anchor (a twin of a shared sprite whose anchor is none of `defineArt`'s). */
export function anchoredArt(name: string, paint: () => readonly S[], ox: number, oy: number, ticksPerFrame?: number): string {
  const id = artId(L, name);
  const make = (u: 1 | 2 | 4): Frame[] =>
    withKitTier(u, () => paint().map((c): Frame => ({ buf: renderBuffer(c, L, u, c.w * 7 + c.h + name.length * 31), ox, oy })));
  defineSprite(id, () => make(1), { hd: (d) => make(d), ticksPerFrame });
  return id;
}

// -------------------------------------------------------------------------------- the hump bridge

const [, BRIDGE_LEN, BRIDGE_H] = A_BRIDGES[0];

/** The height of the deck over the street at bx px from the bridge's start (the terrain's `hill`). */
export function deckH(bx: number): number {
  if (bx <= 0 || bx >= BRIDGE_LEN) return 0;
  const n = 8;
  const q = (bx / BRIDGE_LEN) * n;
  const i = Math.floor(q);
  const at = (k: number): number => (BRIDGE_H * (1 - Math.cos((k / n) * Math.PI * 2))) / 2;
  return at(i) + (at(i + 1) - at(i)) * (q - i);
}

/** Canvas columns left of the bridge's start. */
export const BRIDGE_PAD = 10;
const BRIDGE_W = BRIDGE_LEN + 2 * BRIDGE_PAD;
/** World rows of the canvases' first rows. */
export const BACK_TOP = 118;
export const FACE_TOP = 160;
const FACE_FOOT = 207;
const footOf = (col: number): number => Math.round(G - deckH(col - BRIDGE_PAD));

function deckCobbles(s: S, col: number, y0: number, h: number, seed: number): void {
  const [c0, c1, c2, c3] = R.cobble;
  const lit = col - BRIDGE_PAD > BRIDGE_LEN / 2;
  for (let j = 0; j < h; j++) {
    const row = Math.floor(j / 3);
    const off = (row % 2) * 4;
    const m = (col + off + seed) % 8;
    let c = c1;
    if (j % 3 === 2) c = c3;
    else if (m === 0) c = c3;
    else if (j % 3 === 0 && m >= 4 && lit) c = c0;
    else if (j % 3 === 0 && m >= 5) c = c0;
    else if (j % 3 === 1 && m <= 2) c = c2;
    s.px(c, col, y0 + j);
  }
}

/** What stands behind the figures: the deck they walk on, its back coping, the iron railing, the piers. */
export const BRIDGE_BACK = defineArt(
  L,
  'a/bridge-back',
  () => {
    const s = new S(BRIDGE_W, 72);
    const [s0, s1, s2, s3] = R.stone;
    const [i0, i1, i2] = R.iron;
    for (let col = BRIDGE_PAD - 4; col < BRIDGE_W - BRIDGE_PAD + 4; col++) {
      const f = footOf(col) - BACK_TOP;
      const back = f - 12;
      // The railing: bars on a lit top rail, drawn first so that the coping closes its foot.
      s.use(1, 1);
      if ((col - BRIDGE_PAD) % 8 < 2) {
        s.rect(i2, col, back - 14, 1, 13);
        if ((col - BRIDGE_PAD) % 8 === 1) s.rect(i1, col, back - 14, 1, 13);
      }
      s.use(2, 1.2);
      s.rect(i1, col, back - 6, 1, 2);
      s.px(i0, col, back - 6);
      s.use(3, 1.4);
      s.rect(i1, col, back - 16, 1, 3);
      s.px(i0, col, back - 16);
      s.px(i2, col, back - 14);
      // The coping.
      s.use(4, 2);
      s.rect(s1, col, back - 2, 1, 3);
      s.px(s0, col, back - 2);
      s.px(s3, col, back);
      if ((col - BRIDGE_PAD + 3) % 13 === 0) s.px(s3, col, back - 1);
      // The deck.
      s.use(5, 3);
      deckCobbles(s, col, back + 1, f + 5 - back, 3);
    }
    // The piers at the bridge's ends: stone on the coping, a stone ball.
    for (const px of [BRIDGE_PAD - 7, BRIDGE_W - BRIDGE_PAD - 3]) {
      const f = footOf(px + 5) - BACK_TOP - 12;
      s.use(10 + px, 4);
      s.rect(s1, px, f - 20, 10, 21);
      s.vl(s0, px + 9, f - 20, 21);
      s.vl(s0, px + 8, f - 20, 21);
      s.vl(s2, px, f - 20, 21);
      s.hl(s3, px, f, 10);
      for (const q of [f - 13, f - 7]) s.hl(s2, px, q, 9);
      s.use(40 + px, 4.5);
      s.rect(s1, px - 1, f - 23, 12, 3);
      s.hl(s0, px - 1, f - 23, 12);
      s.hl(s3, px - 1, f - 21, 12);
      s.ell(s1, px + 5, f - 27, 3, 3);
      s.px(s0, px + 6, f - 29);
      s.px(s0, px + 7, f - 28);
      s.px(s2, px + 3, f - 26);
    }
    return s.finish(K);
  },
  { anchor: 'tl', part: 'a-bridge-back' },
);

/** In front of the figures: the arch's face. Its coping starts right under their feet. */
export const BRIDGE_FACE = defineArt(
  L,
  'a/bridge-face',
  () => {
    const H = FACE_FOOT - FACE_TOP + 2;
    const s = new S(BRIDGE_W, H);
    const [s0, s1, s2, s3] = R.stone;
    const [b0, b1, b2] = R.brickr;
    const cx = BRIDGE_W / 2 - 0.5;
    const cy = FACE_FOOT - FACE_TOP;
    const r = rngf(77);
    const inEll = (x: number, y: number, rx: number, ry: number): boolean => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
    // The brick of the spandrels, in courses and lit and dark bricks: a hero's cloth, no full pattern.
    for (let col = BRIDGE_PAD - 8; col < BRIDGE_W - BRIDGE_PAD + 8; col++) {
      const top = footOf(col) + 4 - FACE_TOP;
      s.use(1, 1);
      for (let y = top; y < cy; y++) {
        const row = y >> 1;
        const brick = (col + (row % 2) * 3) % 7;
        let c = b1;
        if (y % 2 === 1 && (col * 7 + row * 3) % 11 < 6) c = b2;
        else if (brick === 0 && (col + row) % 3 === 0) c = b2;
        else if (y % 2 === 0 && col > cx && (col * 5 + row * 13) % 17 < 5) c = b0;
        s.px(c, col, y);
      }
    }
    // The arch: a ring of stones, lit on the right, a keystone, a dark mouth with water in it.
    for (let y = 0; y < cy; y++) {
      for (let x = 0; x < BRIDGE_W; x++) {
        if (!inEll(x, y, 66, 31)) continue;
        const i = y * BRIDGE_W + x;
        const an = Math.atan2(y - cy, x - cx + 0.001);
        const seg = Math.trunc(an * 13);
        const odd = ((seg % 2) + 2) % 2;
        s.c[i] = odd === 0 ? s2 : x > cx ? s0 : s1;
        s.z[i] = 2;
        s.p[i] = 2;
        if (inEll(x, y, 61, 27)) {
          const dy = cy - y;
          let c = R.hull[3];
          if (dy <= 6) {
            const st = (x * 5 + y * 13) % 19;
            c = st < 3 ? R.water[3] : R.water[4];
            if (dy <= 2 && st < 7) c = R.water[3];
          } else if (dy >= 21 && x < cx) c = R.hull[2];
          s.c[i] = c;
          s.p[i] = 3;
          s.z[i] = Math.fround(0.5);
        }
      }
    }
    // The keystone.
    s.use(4, 3);
    const kx = Math.round(cx) - 4;
    s.poly(s1, [
      [kx, cy - 33],
      [kx + 8, cy - 33],
      [kx + 7, cy - 26],
      [kx + 1, cy - 26],
    ]);
    s.hl(s0, kx, cy - 33, 9);
    s.vl(s0, kx + 7, cy - 32, 6);
    s.hl(s3, kx + 1, cy - 26, 7);
    // The small lights along the arch, as this city has them.
    s.use(5, 3);
    for (let a = 12; a <= 168; a += 13) {
      const q = (a * Math.PI) / 180;
      const lx = Math.round(cx + Math.cos(q) * 70);
      const ly = Math.round(cy - Math.sin(q) * 34);
      if (a === 90 || (a > 84 && a < 96)) continue;
      s.px(R.glow[1], lx, ly);
      s.px(R.glow[3], lx, ly + 1);
    }
    // The coping under the figures' feet, the abutments at both ends.
    for (let col = BRIDGE_PAD - 8; col < BRIDGE_W - BRIDGE_PAD + 8; col++) {
      const top = footOf(col) + 4 - FACE_TOP;
      s.use(6, 4);
      s.rect(s1, col, top, 1, 2);
      s.px(s0, col, top);
      s.px(s3, col, top + 2);
      if ((col + 5) % 15 === 0) s.px(s3, col, top + 1);
    }
    for (const [ax, right] of [
      [BRIDGE_PAD - 8, false],
      [BRIDGE_W - BRIDGE_PAD - 8, true],
    ] as const) {
      s.use(7, 3.5);
      const top = footOf(ax + (right ? 12 : 4)) + 7 - FACE_TOP;
      s.rect(s1, ax, top, 16, cy - top);
      s.vl(s2, ax, top, cy - top);
      s.vl(s0, ax + 15, top, cy - top);
      s.vl(s0, ax + 14, top, cy - top);
      for (let q = top + 3; q < cy; q += 5) {
        s.hl(s3, ax, q, 16);
        const off = (((q - top) >> 2) & 1) * 5 + 3;
        s.vl(s3, ax + off, q - 3, 3);
        s.vl(s3, ax + off + 6, q - 3, 3);
      }
    }
    // The foot in the water, green with weed.
    s.use(8, 4.5);
    for (let x = BRIDGE_PAD - 8; x < BRIDGE_W - BRIDGE_PAD + 8; x++) {
      if (inEll(x, cy - 2, 61, 27)) continue;
      s.px(R.moss[2], x, cy - 2);
      s.px(R.moss[3], x, cy - 1);
      if (r.random() < 0.3) s.px(R.moss[1], x, cy - 3);
      if (r.random() < 0.2) s.px(R.moss[3], x, cy - 3);
    }
    return s.finish(K);
  },
  { anchor: 'tl', part: 'a-bridge-face' },
);

// ----------------------------------------------------------------------------- the raised drawbridge

/** The raised white drawbridge on the quay at the side canal: 76 × 150, its feet on the street's far edge. */
export const DRAWBRIDGE = defineArt(
  L,
  'a/drawbridge',
  () => {
    const W = 76;
    const H = 152;
    const s = new S(W, H);
    const [w0, w1, w2, w3] = R.white;
    const [s0, s1, s2, s3] = R.stone;
    // The far mast and the near mast of the gallows.
    for (const mx of [6, 40]) {
      s.use(1, 1);
      s.rect(w1, mx, 22, 6, 120);
      s.vl(w0, mx + 5, 22, 120);
      s.vl(w0, mx + 4, 22, 120);
      s.vl(w2, mx, 22, 120);
      s.vl(w3, mx + 1, 26, 8);
      for (let q = 36; q < 136; q += 20) {
        s.use(2, 1.5);
        s.hl(w3, mx, q, 6);
        s.hl(w0, mx, q + 1, 6);
        s.px(R.iron[2], mx + 2, q + 4);
      }
      // A stone foot.
      s.use(3, 2);
      s.rect(s1, mx - 3, 140, 12, 12);
      s.hl(s0, mx - 3, 140, 12);
      s.vl(s0, mx + 8, 140, 12);
      s.vl(s2, mx - 3, 141, 11);
      s.hl(s3, mx - 3, 151, 12);
      s.hl(s2, mx - 3, 145, 11);
    }
    // The bracing between the masts.
    s.use(4, 0.5);
    for (const [ya, yb] of [
      [36, 74],
      [74, 112],
    ]) {
      s.line(w2, 12, ya, 40, yb);
      s.line(w1, 12, ya + 1, 40, yb + 1);
      s.line(w2, 40, ya, 12, yb);
      s.line(w1, 40, ya + 1, 12, yb + 1);
    }
    s.use(4, 0.6);
    s.rect(w1, 12, 73, 28, 3);
    s.hl(w0, 12, 73, 28);
    s.hl(w3, 12, 75, 28);
    // The top beam and the balance beams: they lie over, the weight on the street's side.
    s.use(5, 3);
    s.rect(w1, 2, 16, 48, 6);
    s.hl(w0, 2, 16, 48);
    s.hl(w3, 2, 21, 48);
    s.vl(w0, 49, 16, 6);
    s.use(6, 4);
    s.poly(w1, [
      [0, 2],
      [66, 0],
      [66, 5],
      [0, 8],
    ]);
    s.line(w0, 0, 2, 66, 0);
    s.line(w3, 0, 8, 66, 5);
    // The bearing and the counterweight.
    s.use(7, 4.5);
    s.rect(R.hull[1], 40, 4, 8, 11);
    s.hl(R.hull[0], 40, 4, 8);
    s.vl(R.hull[0], 47, 4, 11);
    s.px(R.xw[0], 44, 8);
    s.use(8, 5);
    s.rect(R.hull[2], 0, 8, 14, 14);
    s.hl(R.hull[0], 0, 8, 14);
    s.vl(R.hull[0], 13, 8, 14);
    s.hl(R.hull[3], 0, 21, 14);
    for (const q of [3, 7, 11]) s.vl(R.hull[3], q, 10, 11);
    // The leaf standing up: white planks over a wooden core, an iron rail, red and white marks at its ends.
    const lx = 54;
    const lw = 18;
    s.use(9, 2.5);
    s.rect(w1, lx, 18, lw, 128);
    for (let q = lx + 3; q < lx + lw; q += 5) s.vl(w2, q, 18, 128);
    s.vl(w0, lx + lw - 2, 18, 128);
    s.vl(w0, lx + lw - 1, 18, 128);
    s.vl(w3, lx, 18, 128);
    for (let q = 30; q < 134; q += 26) {
      s.hl(w3, lx, q, lw);
      s.hl(w0, lx, q + 1, lw);
      s.px(R.iron[2], lx + 4, q + 4);
      s.px(R.iron[2], lx + lw - 5, q + 4);
    }
    s.use(10, 3);
    const stripes = (y0: number, y1: number): void => {
      for (let q = y0; q < y1; q++) {
        for (let x = lx + 1; x < lx + lw - 1; x++) {
          const red = (((x + q) % 8) + 8) % 8 < 4;
          s.px(red ? (x > lx + lw - 5 ? R.dred[0] : R.dred[1]) : x > lx + lw - 5 ? R.white[0] : R.white[1], x, q);
        }
      }
    };
    stripes(18, 28);
    stripes(136, 146);
    s.use(11, 3.5);
    for (const rx of [lx + 5, lx + 12]) {
      s.vl(R.iron[1], rx, 34, 96);
      s.vl(R.iron[0], rx + 1, 34, 96);
    }
    // The chains from the beam to the leaf's head.
    s.use(12, 5);
    s.line(R.pole[2], 60, 5, 60, 18);
    s.line(R.pole[2], 66, 5, 66, 18);
    for (const x of [60, 66]) for (let q = 6; q < 18; q += 3) s.px(R.pole[0], x, q);
    const o = addMargin(s);
    o.finish(K);
    return o;
  },
  { part: 'a-drawbridge' },
);

/** A striped warning post at a quay edge, with a round sign. */
export const QUAY_POST = defineArt(
  L,
  'a/quay-post',
  () => {
    const s = new S(9, 40);
    s.use(1, 1);
    for (let q = 12; q < 40; q += 6) {
      const c = (q - 12) % 12 === 0 ? R.dred : R.white;
      s.rect(c[1], 3, q, 4, 6);
      s.vl(c[0], 6, q, 6);
      s.vl(c[2], 3, q, 6);
    }
    s.use(2, 2);
    s.ell(R.white[0], 4, 5, 5, 5);
    s.ell(R.dred[1], 4, 5, 4, 4);
    s.rect(R.white[0], 2, 4, 5, 2);
    s.px(R.dred[0], 6, 2);
    const o = addMargin(s);
    o.finish(K);
    return o;
  },
  { part: 'a-quay-post' },
);

// ------------------------------------------------------------------------------------ the houseboats

/** Rows above the roof the sprite keeps (chimney and roof garden). */
const BOAT_HEAD = 26;
/** The hull's foot: the water surface in front of the figures hides what lies under WATER_Y + 2. */
const BOAT_FOOT = WATER_Y + 7;
/** Canvas columns left of the hull. */
export const BOAT_PAD = 8;

interface BoatLook {
  wall: string;
  trim: string;
  roof: string;
}

const LOOKS: Readonly<Record<number, BoatLook>> = {
  0: { wall: 'plastg', trim: 'white', roof: 'roof' },
  2: { wall: 'navy', trim: 'plastc', roof: 'hull' },
};

function boatCanvas(b: Houseboat): S {
  const look = LOOKS[b.colour] ?? LOOKS[0];
  const r = rngf(b.x0);
  const W = b.w + 2 * BOAT_PAD;
  const top = ROOF_Y - BOAT_HEAD;
  const H = BOAT_FOOT - top;
  const s = new S(W, H);
  const yOf = (y: number): number => y - top;
  const hx = BOAT_PAD;
  const deck = yOf(DECK_Y);
  const roof = yOf(ROOF_Y);
  const [h0, h1, h2, h3] = R.hull;
  const [wd0, wd1, wd2, wd3] = R.wood;
  // The roof garden stands behind everything.
  const cx = b.cx - b.x0 + hx;
  const [a, ba, c, d] = R[look.wall];
  {
    let q = cx + 3;
    let i = 0;
    while (q < cx + b.cw - 24) {
      const pot = i % 3 === 2 ? R.wood : R.bricko;
      s.use(40 + i, 2);
      s.rect(pot[1], q, roof - 7, 8, 6);
      s.hl(pot[0], q, roof - 7, 8);
      s.vl(pot[0], q + 7, roof - 7, 6);
      s.vl(pot[2], q, roof - 6, 5);
      for (let n = 0; n < 18; n++) {
        const xx = q + r.int(-1, 9);
        const yy = roof - 8 - r.int(0, 8);
        const tone = xx > q + 4 ? R.leaf[r.int(0, 2)] : R.leaf[r.int(1, 3)];
        s.px(tone, xx, yy);
        s.px(tone, xx + 1, yy);
      }
      if (i % 2 === 0) {
        for (let n = 0; n < 4; n++) {
          const cc = R[r.pick(['tulip', 'yellow', 'dred'])];
          s.px(cc[0], q + r.int(0, 8), roof - 9 - r.int(0, 6));
        }
      }
      q += 13;
      i++;
    }
    // The chimney, under the shared smoke.
    s.use(60, 2);
    tube(s, 'iron', b.cx - b.x0 + b.cw - 10 + hx, roof - 11, 5, 11);
    s.rect(R.iron[2], b.cx - b.x0 + b.cw - 11 + hx, roof - 12, 7, 2);
    s.hl(R.iron[0], b.cx - b.x0 + b.cw - 10 + hx, roof - 12, 6);
  }
  // The deck behind the figures' feet.
  s.use(1, 1);
  s.poly(wd1, [
    [hx + 5, deck - 7],
    [hx + b.w - 5, deck - 7],
    [hx + b.w, deck + 1],
    [hx, deck + 1],
  ]);
  for (let j = deck - 6; j <= deck; j += 2) s.hl(wd2, hx + 2, j, b.w - 4);
  for (let q = hx + 7; q < hx + b.w - 4; q += 13) s.vl(wd2, q, deck - 7, 8);
  // The cabin.
  s.use(2, 2);
  const cTop = roof + 3;
  const cBot = deck - 3;
  s.rect(ba, cx, cTop, b.cw, cBot - cTop);
  for (let j = cTop + 3; j < cBot; j += 3) {
    s.hl(c, cx, j, b.cw);
    s.hl(a, cx + (b.cw >> 1) + 4, j - 1, (b.cw >> 1) - 4);
  }
  s.vl(d, cx, cTop, cBot - cTop);
  s.vl(c, cx + 1, cTop, cBot - cTop);
  s.vl(a, cx + b.cw - 1, cTop, cBot - cTop);
  s.hl(d, cx, cBot - 1, b.cw);
  // A door on the left, windows along the cabin.
  const t1 = R[look.trim][1];
  s.use(3, 3);
  s.rect(t1, cx + 3, cTop, 9, cBot - cTop);
  s.rect(R.dred[1], cx + 4, cTop + 1, 7, cBot - cTop - 1);
  s.vl(R.dred[0], cx + 10, cTop + 1, cBot - cTop - 1);
  s.vl(R.dred[2], cx + 4, cTop + 1, cBot - cTop - 1);
  s.rect(R.glass[2], cx + 5, cTop + 2, 5, 3);
  s.px(R.glass[0], cx + 9, cTop + 2);
  s.px(R.brass[0], cx + 5, cTop + 7);
  const nw = Math.floor((b.cw - 18) / 13);
  for (let i = 0; i < nw; i++) {
    const wx = cx + 15 + i * 13;
    window_(s, wx, cTop + 1, 9, 7, r, 10 + i * 2, { z: 3, trim: look.trim, kind: i % 4 });
  }
  // The flat roof: a slab that overhangs, its top on the platform line.
  const rm = R[look.roof];
  s.use(5, 4);
  s.rect(rm[1], cx - 2, roof, b.cw + 4, 3);
  s.hl(rm[0], cx - 2, roof, b.cw + 4);
  s.hl(rm[3], cx - 2, roof + 2, b.cw + 4);
  s.vl(rm[0], cx + b.cw + 1, roof, 3);
  // The hull: a heavy black barge, its gunwale on the deck line, rivets and a lit edge, a bow to the right.
  s.use(6, 5);
  s.poly(h2, [
    [hx, deck + 1],
    [hx + b.w - 1, deck + 1],
    [hx + b.w - 6, H - 1],
    [hx + 2, H - 1],
  ]);
  for (let q = hx + 6; q < hx + b.w - 8; q += 7) {
    s.px(h3, q, deck + 7);
    s.px(h0, q + 1, deck + 6);
  }
  for (let n = 0; n < Math.floor(b.w / 6); n++) s.hl(r.random() < 0.5 ? h1 : h3, hx + r.int(3, b.w - 12), deck + r.int(4, 14), r.int(3, 7));
  s.use(7, 5.5);
  s.rect(R[look.wall === 'navy' ? 'dred' : 'navy'][1], hx, deck + 1, b.w, 3);
  s.hl(R[look.wall === 'navy' ? 'dred' : 'navy'][0], hx, deck + 1, b.w);
  s.hl(R[look.wall === 'navy' ? 'dred' : 'navy'][2], hx, deck + 3, b.w);
  s.use(8, 6);
  s.rect(wd1, hx - 1, deck - 1, b.w + 2, 2);
  s.hl(wd0, hx - 1, deck - 1, b.w + 2);
  s.hl(wd3, hx - 1, deck, b.w + 2);
  // A lifebuoy on the hull and a mooring rope, a name in white.
  s.use(9, 6.5);
  const by = deck + 10;
  const bx = hx + b.w - 18;
  s.ell(R.dred[1], bx, by, 4, 4);
  s.ell(R.white[0], bx, by, 2.4, 2.4);
  s.rect(R.hull[3], bx - 1, by - 1, 2, 2);
  s.px(R.dred[0], bx + 2, by - 3);
  const o = addMargin(s);
  o.finish(K);
  return o;
}

/** The sprite of a houseboat. Lay it with `boatProp` (its numbers come from `A_BOATS`). */
export function boatArt(b: Houseboat): string {
  return defineArt(L, `a/houseboat-${b.x0}`, () => boatCanvas(b), { anchor: 'tl', part: `a-boat-${b.x0}` });
}

export const BOATS = A_BOATS.map((b) => ({ id: boatArt(b), x: b.x0 - BOAT_PAD - 1, y: ROOF_Y - BOAT_HEAD - 1, def: b }));

// -------------------------------------------------------------------------------- the little boat

/** Rows of the little boat's canvas above its gunwale: the motor, the stern flag. */
const SMALL_HEAD = 13;

/**
 * The twin of `decor/ams/ams-boat-platform`: two frames (its flag flutters), the gunwale on the platform
 * line, centred on x as the shared sprite. The bow lies right: the entity flips it when it sails left. The
 * water in front of the figures hides what lies under row 180, so all that reads stands in 8 rows.
 */
export const SMALL_BOAT_TWIN = anchoredArt(
  'a/small-boat-twin',
  () =>
    [0, 1].map((ph) => {
      const g = SMALL_HEAD;
      const s = new S(62, g + 13);
      const [w0, w1, w2, w3] = R.wood;
      const [n0, n1, n2, n3] = R.navy;
      // The inside, seen over the gunwale: two thwarts and a coil of rope behind the figures' feet.
      s.use(1, 1);
      s.rect(R.hull[3], 8, g - 2, 45, 2);
      for (const q of [18, 36]) {
        s.rect(w1, q, g - 2, 9, 1);
        s.hl(w0, q + 4, g - 2, 5);
        s.rect(w3, q, g - 1, 9, 1);
      }
      s.rect(R.plastc[2], 48, g - 3, 4, 2);
      s.hl(R.plastc[0], 49, g - 3, 3);
      // The hull: navy, lit towards the bow, a white stripe under the wooden gunwale.
      s.use(2, 2);
      s.poly(n1, [
        [1, g],
        [61, g],
        [54, g + 11],
        [6, g + 11],
      ]);
      for (let y = g + 3; y < g + 7; y++) {
        const x0 = 2 + (y - g);
        const x1 = 60 - (y - g);
        s.hl(n0, 38, y, x1 - 38);
        s.hl(n2, x0, y, 10);
      }
      s.hl(n2, 4, g + 7, 52);
      s.hl(n3, 5, g + 8, 50);
      s.rect(n3, 6, g + 9, 48, 2);
      s.use(3, 3);
      s.hl(R.white[1], 3, g + 2, 34);
      s.hl(R.white[0], 37, g + 2, 22);
      s.use(4, 4);
      s.rect(w1, 1, g, 60, 2);
      s.hl(w0, 1, g, 60);
      s.hl(w2, 1, g + 1, 38);
      for (let q = 6; q < 58; q += 13) s.px(R.brass[0], q, g + 1);
      // The bow's fender.
      s.use(5, 4.5);
      s.rect(R.white[1], 59, g + 2, 3, 3);
      s.px(R.white[0], 61, g + 2);
      // The stern flag: it flutters by a pixel.
      s.use(6, 2.5);
      s.vl(R.pole[1], 12, 0, g);
      s.px(R.pole[0], 12, 0);
      const fw = 7;
      for (let i = 0; i < 3; i++) {
        const c = [R.dred, R.white, R.navy][i];
        s.hl(c[0], 13, 1 + i * 2, fw + (ph ? 1 : 0));
        s.hl(c[1], 13, 2 + i * 2, fw - (ph ? 1 : 0));
      }
      // The outboard motor on the stern.
      s.use(7, 5);
      s.rect(R.pole[2], 3, g, 2, 11);
      s.px(R.pole[0], 4, g);
      s.use(8, 6);
      s.rect(R.dred[1], 0, g - 7, 8, 7);
      s.hl(R.dred[0], 0, g - 7, 8);
      s.vl(R.dred[0], 7, g - 7, 7);
      s.vl(R.dred[2], 0, g - 6, 6);
      s.hl(R.dred[3], 0, g - 1, 8);
      s.hl(R.white[0], 2, g - 4, 4);
      s.use(9, 5.5);
      s.line(R.hull[1], 8, g - 3, 16, g - 2);
      const o = addMargin(s);
      o.finish(K);
      return o;
    }),
  32,
  SMALL_HEAD + 1,
  12,
);
