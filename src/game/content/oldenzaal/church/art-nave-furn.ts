/**
 * The nave's furnishings (CHURCH, wave B; docs/design/oldenzaal.md §7.1): our own drawings of the
 * objects of a Catholic church, dignified and whole (respect: nothing mocked, broken or burned on
 * purpose; abandoned only: dust, cobwebs, a toppled candle stand, a fallen hymn board). ONE drawer
 * per id for 1×, 2× and 4×; static playfield decor gets outline C.
 *
 * Ids (`decor/oz-nave/…`): `pews` (2 widths), `confessional`, `font` (holy water), `pulpit`,
 * `saint` (2 saints on consoles under canopies), `mary` (with her niche and twelve stars),
 * `votive` (the candle rack; 3 flicker frames), `station` (I … VII), `altar`, `crucifix`,
 * `candlestick` (3 frames), `lamp` (the red sanctuary lamp; 3 frames), `chandelier` (3 lit
 * frames + 1 unlit), `shaft` (a moonlight shaft, drawn with alpha), `hymn-board` (hanging /
 * fallen), `stand` (a toppled candle stand), `cobweb` (left / right), `doors` (the red west
 * doors, 4 frames: open → shut; the `oz-nave-doors` entity), `grille` (the chapel's iron grille,
 * 3 frames: closed → open; the `oz-chapel-gate` entity).
 */
import type { Color } from '../../../../engine/color';
import { GRILLE_H, GRILLE_W } from './art-nave-arch';
import { archPointed, ashlar, brassT, cobweb, COLD, ct, dp, dustOn, flame, h2, ironT, mx, oak, oakBox, outlineC, pick, regC, same, shaft, T, tinyText, tinyWidth, type Dn, type Pen } from './kit';

// ============================================================================================
// Pews (anchor bottom-left; the front backrest's top rail is the `oz-pew` platform at G − 14)
// ============================================================================================

export const PEW_WIDTHS = [96, 112] as const;
export const PEWS_H = 26;
/** The front backrest's top in the frame (G − 14 when the frame's bottom is at G). */
const PEW_RAIL = PEWS_H - 14;

regC(
  'decor/oz-nave/pews',
  PEW_WIDTHS.map((w) => ({ w, h: PEWS_H, ox: 0, oy: PEWS_H })),
  (p, f) => {
    const d = p.d;
    const w = PEW_WIDTHS[f];
    const wd = ct('wood', d, 0.22);
    // Three rows seen from behind: the far ones higher and darker.
    for (const [row, top, k] of [
      [2, 1, 0.9],
      [1, 6, 1.4],
      [0, PEW_RAIL, 2],
    ] as const) {
      const x0 = 3 + row * 0.5;
      const x1 = w - 3 - row * 0.5;
      // The backrest: a moulded top rail and a plain panel.
      oak(p, x0, top, x1 - x0, 6, k, 11 + row);
      p.rect(x0, top, x1 - x0, 1.4, pick(wd, k + 1.2));
      if (d >= 2) {
        p.rect(x0, top, x1 - x0, 0.5, pick(wd, k + 2.2));
        p.rect(x0, top + 1.4, x1 - x0, 0.5, pick(wd, k - 1));
      }
      // Under the backrest: the seat's shadow, then the legs and the kneeler (front row only).
      if (row === 0) {
        p.rect(x0, top + 6, x1 - x0, 2, pick(wd, 0.3));
        for (let x = x0 + 10; x < x1 - 4; x += 22) p.rect(x, top + 8, 2, PEWS_H - top - 8, pick(wd, 1.2));
        oak(p, x0 + 1, PEWS_H - 4, x1 - x0 - 2, 2, 1.6, 17);
        p.rect(x0 + 1, PEWS_H - 2, x1 - x0 - 2, 2, pick(wd, 0.2));
      }
    }
    // The carved bench ends at both sides: taller, with a scroll and a sunk trefoil panel.
    for (const ex of [0, w - 5]) {
      oakBox(p, ex, PEW_RAIL - 4, 5, PEWS_H - PEW_RAIL + 4, 2.4, 19 + ex, { vertical: true });
      p.disc(ex + 2.5, PEW_RAIL - 4, 2.5, 2, (_X, _Y, u, v) => pick(wd, 3 - v * 1.4 - u * 0.6));
      if (d >= 2) archPointed(p, ex + 1.2, PEW_RAIL + 1, 2.6, 8, pick(wd, 1.1));
    }
    // A hymn book left on the front rail; another on the floor.
    const pages = ct('cloth', d, 0.2);
    p.rect(w * 0.38, PEW_RAIL - 1.5, 5, 1.5, pick(ct('red', d, 0.2), 1.6));
    if (d >= 2) p.rect(w * 0.38, PEW_RAIL - 1.5, 5, 0.5, pick(pages, 3));
    p.rect(w * 0.7, PEWS_H - 1.5, 6, 1.5, pick(ct('navy', d, 0.2), 2.6));
    dustOn(p, 0, PEW_RAIL - 4, w, 2, 0.4, 23);
    dustOn(p, 0, 1, w, 2, 0.5, 24);
    outlineC(p);
  },
);

// ============================================================================================
// The confessional (anchor bottom-centre)
// ============================================================================================

export const CONF_W = 80;
export const CONF_H = 80;

regC('decor/oz-nave/confessional', [{ w: CONF_W, h: CONF_H, ox: CONF_W / 2, oy: CONF_H }], (p) => {
  const d = p.d;
  const wd = ct('wood', d, 0.2);
  const velvet = ct('red', d, 0.22);
  const H = CONF_H;
  const br = brassT(d);
  // The plinth.
  oakBox(p, 2, H - 5, CONF_W - 4, 5, 1.4, 1);
  // Three bays: the curtained penitents' sides, the priest's door in the middle.
  for (const [bx, bw, top] of [
    [4, 24, 18],
    [28, 24, 6],
    [52, 24, 18],
  ] as const) {
    const mid = bx === 28;
    oakBox(p, bx, top + 8, bw, H - 5 - top - 8, mid ? 2.2 : 1.8, bx, { vertical: true });
    // The gable with crockets and a small finial.
    p.poly([[bx - 1, top + 9], [bx + bw / 2, top], [bx + bw + 1, top + 9]], pick(wd, 2.8));
    if (d >= 2) p.poly([[bx + 3, top + 8], [bx + bw / 2, top + 3], [bx + bw - 3, top + 8]], pick(wd, 1.2));
    p.rect(bx + bw / 2 - 0.75, top - 4, 1.5, 4, pick(wd, 3.2));
    if (mid) {
      // The priest's door: panels, a little grille window, a small gilt cross on the gable.
      oakBox(p, bx + 3, top + 14, bw - 6, H - 5 - top - 14, 2.6, 33, { vertical: true });
      p.rect(bx + 7, top + 18, bw - 14, 8, pick(wd, 0.4));
      if (d >= 2) for (let k = 0; k < 4; k++) p.rect(bx + 7 + k * ((bw - 14) / 4) + 1, top + 18, 0.5, 8, pick(br, 2.4));
      p.rect(bx + 6, top + 30, bw - 12, 14, pick(wd, 2.2));
      if (d >= 2) p.rect(bx + 6, top + 30, bw - 12, 0.5, pick(wd, 3.6));
      p.rect(bx + bw - 7, top + 34, 1.5, 1.5, pick(br, 3.4));
      p.rect(bx + bw / 2 - 0.5, top - 9, 1, 5, pick(br, 3.6));
      p.rect(bx + bw / 2 - 2, top - 7.5, 4, 1, pick(br, 3.6));
    } else {
      // A heavy velvet curtain on a brass rod, faded, in deep folds; one hangs a little askew.
      const cx0 = bx + 2;
      const cw = bw - 4;
      const ct0 = top + 12;
      p.rect(cx0 - 1, ct0 - 1, cw + 2, 1, pick(br, 2.6));
      p.fill(cx0, ct0, cw, H - 7 - ct0, (X, Y) => {
        const lx = (X + 0.5) / d - cx0;
        const ly = (Y + 0.5) / d - ct0;
        const sway = bx === 52 ? ly * 0.06 : 0;
        const fold = Math.sin((lx - sway) * 1.3) * 1.2;
        let k = 2.6 + fold - ly * 0.012;
        if (ly > H - 7 - ct0 - 3) k -= 0.6;
        if (d >= 4 && h2(X, Y, 3) > 0.9) k -= 0.5;
        return dp(velvet, k, X, Y, 0.7);
      });
    }
  }
  // Pinnacles between the bays.
  for (const x of [27, 51]) {
    p.rect(x, 10, 2, H - 15, pick(wd, 3));
    p.poly([[x - 0.5, 10], [x + 1, 4], [x + 2.5, 10]], pick(wd, 3.2));
  }
  dustOn(p, 0, 0, CONF_W, H, 0.06, 37);
  cobweb(p, 4, 27, 6, 1, 38);
  outlineC(p);
});

// ============================================================================================
// The holy water font (anchor bottom-centre)
// ============================================================================================

regC('decor/oz-nave/font', [{ w: 20, h: 36, ox: 10, oy: 36 }], (p) => {
  const d = p.d;
  const st = ct('sandstone', d);
  // Plinth, shaft, the octagonal bowl with its lip, the still water.
  p.fill(4, 31, 12, 5, ashlar(p, { k: 3.2, seed: 41, bw: 12, bh: 5, x0: 4, y0: 31, joints: false }));
  p.rect(4, 31, 12, d === 1 ? 1 : 0.5, pick(st, 5));
  shaft(p, 7.5, 16, 5, 15, { k: 3.8, seed: 42, bh: 30 });
  p.poly(
    [
      [1, 8],
      [19, 8],
      [15, 16],
      [5, 16],
    ],
    (X, Y) => {
      const u = ((X + 0.5) / d - 1) / 18;
      return dp(st, 4 + Math.cos((u - 0.3) * Math.PI) * 1.4 - ((Y + 0.5) / d - 8) * 0.12 + (d >= 2 && Math.abs(u - 0.5) < 0.04 ? -0.8 : 0), X, Y, 0.7);
    },
  );
  p.rect(0, 6, 20, 2, pick(st, 5));
  if (d >= 2) p.rect(0, 6, 20, 0.5, pick(st, 6.2));
  // The water: dark, one cold glint.
  p.rect(2, 7.5, 16, 0.5, pick(ct('night', d, 0), 4));
  if (d >= 2) p.rect(6, 7.5, 3, 0.5, T('night', 6, d));
  // A tiny carved cross on the bowl.
  if (d >= 2) {
    p.rect(9.75, 10, 0.5, 3.5, pick(st, 1.4));
    p.rect(8.75, 11, 2.5, 0.5, pick(st, 1.4));
  }
  outlineC(p);
});

// ============================================================================================
// The pulpit (anchor: the pillar's centre on the floor; the tub to the right of the pillar)
// ============================================================================================

export const PULPIT_W = 56;
export const PULPIT_H = 108;
const PUL_OX = 12;

regC('decor/oz-nave/pulpit', [{ w: PULPIT_W, h: PULPIT_H, ox: PUL_OX, oy: PULPIT_H }], (p) => {
  const d = p.d;
  const wd = ct('wood', d, 0.2);
  const br = brassT(d);
  const H = PULPIT_H;
  const tubTop = H - 58;
  const tubBot = H - 34;
  // The back panel on the pillar and the sounding board (the canopy) with its crest.
  oakBox(p, PUL_OX - 5, 14, 12, tubTop - 14, 1.6, 51, { vertical: true });
  if (d >= 2) archPointed(p, PUL_OX - 3, 18, 8, 22, pick(wd, 0.6));
  oakBox(p, PUL_OX - 10, 8, 46, 5, 2.4, 52);
  p.rect(PUL_OX - 10, 13, 46, 1, pick(br, 2.4));
  for (let x = PUL_OX - 9; x < PUL_OX + 35; x += 4) p.poly([[x, 13.5], [x + 2, 16], [x + 4, 13.5]], pick(wd, 1.6));
  // The crest: small gilt pinnacles and a cross.
  for (const x of [PUL_OX - 8, PUL_OX + 4, PUL_OX + 16, PUL_OX + 30]) p.poly([[x, 8], [x + 2, 3], [x + 4, 8]], pick(br, 2.2));
  p.rect(PUL_OX + 12.5, 0, 1.5, 6, pick(br, 3.4));
  p.rect(PUL_OX + 10.5, 1.5, 5.5, 1.2, pick(br, 3.4));
  // The tub: an octagon seen from the side (three faces), carved arched panels, a gilt rim.
  const tx0 = PUL_OX + 2;
  const tw = 30;
  p.fill(tx0, tubTop, tw, tubBot - tubTop, (X, Y) => {
    const u = ((X + 0.5) / d - tx0) / tw;
    const face = u < 0.25 ? 0 : u < 0.75 ? 1 : 2;
    const k = [3, 2.4, 1.4][face] + (h2(X >> 1, Y >> 2, 5) - 0.5) * 0.3;
    return dp(wd, k, X, Y, 0.6);
  });
  for (const [px, pw] of [
    [tx0 + 9, 12],
    [tx0 + 1.5, 5],
    [tx0 + 23.5, 5],
  ] as const) {
    archPointed(p, px, tubTop + 4, pw, tubBot - tubTop - 8, pick(wd, 0.7));
    if (d >= 2) archPointed(p, px, tubTop + 4, 0.5, tubBot - tubTop - 8, pick(wd, 3.4));
  }
  p.rect(tx0 - 1, tubTop - 2, tw + 2, 2, pick(br, 2.6));
  if (d >= 2) p.rect(tx0 - 1, tubTop - 2, tw + 2, 0.5, pick(br, 4.4));
  // The tub's cone and its stem down to the floor.
  p.poly([[tx0, tubBot], [tx0 + tw, tubBot], [tx0 + tw / 2 + 3, tubBot + 10], [tx0 + tw / 2 - 3, tubBot + 10]], pick(wd, 1.6));
  oakBox(p, tx0 + tw / 2 - 3, tubBot + 10, 6, H - tubBot - 14, 1.8, 53, { vertical: true });
  oakBox(p, tx0 + tw / 2 - 6, H - 4, 12, 4, 1.4, 54);
  // The stair down to the right with its handrail and balusters.
  const sx0 = tx0 + tw;
  for (let s = 0; s < 6; s++) {
    const x = sx0 + s * 3.4;
    const y = tubBot - 6 + s * 7;
    oakBox(p, x, y, 4, H - y, 1.2 + s * 0.08, 55 + s);
  }
  p.line(sx0, tubTop + 2, sx0 + 20, H - 18, pick(wd, 3), Math.max(1, d >> 1));
  if (d >= 2) for (let s = 0; s < 6; s++) p.rect(sx0 + 1.5 + s * 3.4, tubTop + 3 + s * 6.4, 0.5, 7, pick(wd, 2.4));
  dustOn(p, tx0 - 1, tubTop - 2, tw + 2, 1, 0.5, 57);
  outlineC(p);
});

// ============================================================================================
// Statues: saints on consoles, Mary in her niche (polychrome, faded, dusty; our own designs)
// ============================================================================================

export const SAINT_W = 26;
export const SAINT_H = 72;

/** A serene face at (cx, cy) (a little head, lit from the left, eyes cast down); hair, beard. */
function face(p: Pen, cx: number, cy: number, o: { beard?: Color; hair?: Color } = {}): void {
  const d = p.d;
  const skin = ct('plaster', d, 0.16);
  p.disc(cx, cy, 2.3, 2.9, (X, Y, u, v) => dp(skin, 4.8 - u * 1.3 - Math.max(0, v) * 0.6 - (u * u + v * v > 0.75 ? 0.7 : 0), X, Y, 0.5));
  if (o.hair !== undefined) {
    const hair = o.hair;
    // A cap of hair over the crown and down the back of the head (the lit side shows the face).
    p.disc(cx + 0.2, cy - 1.1, 2.5, 2.1, (_X, _Y, u, v) => (v < -0.25 || (u > 0.55 && v < 0.5) ? hair : 0));
  }
  if (o.beard !== undefined) {
    const beard = o.beard;
    p.disc(cx + 0.1, cy + 2, 2, 1.9, (_X, _Y, u, v) => (v > -0.15 && Math.abs(u) < 0.95 ? beard : 0));
  }
  if (d >= 2) {
    // Closed, downcast eyes, the nose's shade, the mouth (not under a beard).
    const ln = pick(skin, 2.2);
    p.rect(cx - 1.4, cy - 0.1, 0.9, 0.3, ln);
    p.rect(cx + 0.5, cy - 0.1, 0.9, 0.3, ln);
    p.rect(cx + 0.15, cy + 0.3, 0.35, 1, pick(skin, 3.2));
    if (o.beard === undefined) p.rect(cx - 0.4, cy + 1.7, 0.9, 0.25, pick(skin, 2.6));
  }
}

/** A halo disc (gilt, a lit rim) behind a head at (cx, cy). */
function halo(p: Pen, cx: number, cy: number, r: number): void {
  const br = brassT(p.d);
  p.disc(cx, cy, r, r, (_X, _Y, u, v) => {
    const q = u * u + v * v;
    return q > 0.72 ? pick(br, 3.6 - (u + v) * 0.5) : pick(br, 1.6 - v * 0.4);
  });
}

/**
 * The statue's place on the pillar: a shallow niche of darker stone behind it, a carved corbel
 * under its feet and a small crocketed canopy over its head (all of a piece with the pillar).
 */
function consoleAndCanopy(p: Pen, w: number, h: number): void {
  const d = p.d;
  const st = ct('sandstone', d);
  const c = w / 2;
  // The niche's back (in shadow) between the canopy and the corbel.
  p.fill(c - 9, 10, 18, h - 24, (X, Y) => dp(st, 1.5 + ((X + 0.5) / d > c + 5 ? -0.5 : 0) + (h2(X >> 2, Y >> 3, 3) - 0.5) * 0.3, X, Y, 0.7));
  // The corbel under the feet (a tapering block with carved leaves).
  p.poly([[c - 10, h - 14], [c + 10, h - 14], [c + 6, h - 5], [c, h], [c - 6, h - 5]], (X, Y) => {
    const u = ((X + 0.5) / d - (c - 10)) / 20;
    const v = ((Y + 0.5) / d - (h - 14)) / 14;
    return dp(st, 4.2 + Math.cos((u - 0.3) * Math.PI) - v * 1.4 + (d >= 2 ? Math.sin(u * 18) * Math.sin(v * 6) * 0.5 : 0), X, Y, 0.7);
  });
  p.rect(c - 11, h - 15, 22, 2, pick(st, 5));
  if (d >= 2) p.rect(c - 11, h - 13, 22, 0.5, pick(st, 2));
  // The canopy: a little pointed vault seen from below (dark), a crocketed gable, two pinnacles.
  p.rect(c - 11, 9, 22, 3, pick(st, 4.4));
  if (d >= 2) p.rect(c - 11, 11.5, 22, 0.5, pick(st, 1.4));
  p.poly([[c - 10, 9], [c, 1.5], [c + 10, 9]], (X, Y) => dp(st, 3.8 + ((X + 0.5) / d < c ? 0.7 : -0.5) - ((Y + 0.5) / d) * 0.04, X, Y, 0.7));
  if (d >= 2) {
    archPointed(p, c - 5.5, 4.5, 11, 4.5, pick(st, 2.2));
    for (let k = 0; k < 4; k++) {
      const t = (k + 0.5) / 4;
      p.disc(c - 10 + 10 * t, 9 - 7.5 * t, 0.7, 0.6, pick(st, 5.2));
      p.disc(c + 10 - 10 * t, 9 - 7.5 * t, 0.7, 0.6, pick(st, 3.6));
    }
  }
  for (const x of [c - 12, c + 10]) {
    p.rect(x, 3, 2, 9, pick(st, x < c ? 4.6 : 3));
    p.poly([[x, 3], [x + 1, 0], [x + 2, 3]], pick(st, 4));
  }
  p.rect(c - 0.5, 0, 1, 2, pick(st, 4.4));
}

/** A robe falling from the shoulders to the hem: folds (vertical bands), lit from the left. */
function robe(p: Pen, c: number, top: number, foot: number, half0: number, half1: number, tones: readonly Color[], k: number): void {
  const d = p.d;
  p.poly(
    [
      [c - half0, top],
      [c + half0, top],
      [c + half1, foot],
      [c - half1, foot],
    ],
    (X, Y) => {
      const x = (X + 0.5) / d - c;
      const t = ((Y + 0.5) / d - top) / (foot - top);
      const half = half0 + (half1 - half0) * t;
      const u = (x + half) / (2 * half);
      const fold = Math.sin(u * Math.PI * 5 + t * 1.2) * 0.55 * Math.min(1, t * 2);
      return dp(tones, k + Math.cos((u - 0.3) * Math.PI) * 1.3 + fold - t * 0.3, X, Y, 0.6);
    },
  );
}

regC(
  'decor/oz-nave/saint',
  same(2, { w: SAINT_W, h: SAINT_H, ox: SAINT_W / 2, oy: SAINT_H }),
  (p, f) => {
    const d = p.d;
    const c = SAINT_W / 2;
    const H = SAINT_H;
    consoleAndCanopy(p, SAINT_W, H);
    const foot = H - 15;
    const headY = 19;
    halo(p, c, headY - 0.5, 4.2);
    const skin = ct('plaster', d, 0.16);
    if (f === 0) {
      // A saint in a brown habit with a rope belt, reading an open book (our own design).
      const habit = ct('brown', d, 0.2);
      robe(p, c, headY + 3, foot, 4.6, 6.6, habit, 3);
      // The cowl around the neck, the sleeves to the book, the rope belt with its knotted end.
      p.disc(c, headY + 3.6, 4.4, 2, (X, Y, u, v) => (v > -0.3 ? dp(habit, 3.4 - u * 1.2, X, Y, 0.5) : 0));
      p.poly([[c - 5, headY + 5], [c - 2, headY + 5], [c - 1, headY + 13], [c - 5.5, headY + 13]], (X, Y) => dp(habit, 4.2, X, Y, 0.5));
      p.poly([[c + 2, headY + 5], [c + 5, headY + 5], [c + 5.5, headY + 13], [c + 1, headY + 13]], (X, Y) => dp(habit, 2.4, X, Y, 0.5));
      const rope = ct('sand', d, 0.2);
      p.rect(c - 5.2, headY + 16, 10.4, 1, pick(rope, 4));
      p.rect(c + 1.5, headY + 17, 0.8, 10, pick(rope, 3.4));
      p.disc(c + 1.9, headY + 27, 0.8, 0.8, pick(rope, 3.8));
      // The open book in both hands.
      const pages = ct('cloth', d, 0.2);
      p.poly([[c - 4.5, headY + 11], [c, headY + 12.2], [c + 4.5, headY + 11], [c + 4.5, headY + 14], [c, headY + 15], [c - 4.5, headY + 14]], (X) => dp(pages, (X + 0.5) / d < c ? 4.4 : 3.6, X, 0, 0.5));
      if (d >= 2) {
        p.rect(c - 0.2, headY + 12.2, 0.4, 2.8, pick(pages, 1.8));
        for (let k = 0; k < 3; k++) p.rect(c - 3.6, headY + 12.4 + k * 0.7, 2.6, 0.2, pick(pages, 2.4));
      }
      p.disc(c - 4.8, headY + 13.4, 1.1, 1.1, pick(skin, 4.4));
      p.disc(c + 4.8, headY + 13.4, 1.1, 1.1, pick(skin, 3.6));
      face(p, c, headY, { hair: pick(habit, 1.8) });
    } else {
      // A bearded saint with a staff of lilies: a grey-green tunic under an ochre mantle.
      const tunic = ct('teal', d, 0.32);
      const mantle = ct('gold', d, 0.36);
      robe(p, c, headY + 3, foot, 4.4, 6.2, tunic, 2.2);
      p.poly([[c - 4.8, headY + 4], [c + 0.5, headY + 5.5], [c + 6.4, foot - 7], [c + 6.4, foot], [c - 6.6, foot], [c - 6.6, headY + 16]], (X, Y) => {
        const u = ((X + 0.5) / d - (c - 6.6)) / 13;
        return dp(mantle, 2.8 + Math.cos((u - 0.3) * Math.PI) * 1.2 + Math.sin(u * 11 + (Y / d) * 0.25) * 0.5, X, Y, 0.6);
      });
      // The right arm holding the staff with the lilies; the left hand on the breast.
      p.poly([[c + 2, headY + 5], [c + 5, headY + 5], [c + 5.5, headY + 10], [c + 3, headY + 10]], (X, Y) => dp(tunic, 2, X, Y, 0.5));
      p.rect(c + 4.8, headY - 5, 0.9, foot - headY + 5, pick(ct('wood', d, 0.2), 3.6));
      const lily = ct('cloth', d, 0.15);
      p.rect(c + 4.9, headY - 5, 0.4, 4, pick(ct('green', d, 0.3), 3));
      for (const [lx, ly] of [
        [c + 5.2, headY - 6.4],
        [c + 3.6, headY - 4],
        [c + 6.9, headY - 4.2],
      ] as const)
        p.disc(lx, ly, 1.2, 1, (X, Y, u, v) => dp(lily, 4.6 - v - u * 0.6, X, Y, 0.4));
      p.disc(c + 5.2, headY + 9.5, 1.2, 1.2, pick(skin, 4));
      p.disc(c - 1.5, headY + 9, 1.1, 1.1, pick(skin, 4.4));
      const hair = pick(ct('brown', d, 0.24), 2.4);
      face(p, c, headY, { hair, beard: hair });
    }
    // The hem and the feet on the corbel.
    p.rect(c - 6.6, foot - 1, 13.2, 1, pick(ct('wood', d, 0.2), 1.2));
    outlineC(p);
  },
);

export const MARY_W = 36;
export const MARY_H = 96;

regC('decor/oz-nave/mary', [{ w: MARY_W, h: MARY_H, ox: MARY_W / 2, oy: MARY_H }], (p) => {
  const d = p.d;
  const c = MARY_W / 2;
  const H = MARY_H;
  const st = ct('sandstone', d);
  const blueNiche = ct('navy', d, 0.1);
  const br = brassT(d);
  // The niche behind her: a pointed recess painted deep blue with small gilt stars.
  archPointed(p, 1, 0, MARY_W - 2, H - 30, (X, Y) => {
    const lx = (X + 0.5) / d;
    const edge = lx < 3 || lx > MARY_W - 3;
    if (edge) return dp(st, 4 - (lx > c ? 1.2 : 0), X, Y, 0.7);
    if (d >= 2 && h2(X >> 1, Y >> 1, 77) > 0.985) return pick(br, 3.6);
    return dp(blueNiche, 2.2 - ((Y + 0.5) / d) * 0.012, X, Y, 0.6);
  });
  // The pedestal (a moulded stone column-base).
  const pedTop = H - 30;
  p.fill(c - 9, pedTop + 4, 18, H - pedTop - 4, ashlar(p, { k: 3.6, seed: 71, bw: 18, bh: 8, x0: c - 9, y0: pedTop + 4, grime: 0.25 }));
  p.rect(c - 11, pedTop, 22, 4, pick(st, 4.8));
  if (d >= 2) p.rect(c - 11, pedTop, 22, 0.5, pick(st, 6));
  p.rect(c - 11, H - 4, 22, 4, pick(st, 3.4));
  // Mary standing: a white gown, a blue mantle from the head to the feet with a gilt hem, the
  // hands folded at her breast, a white veil, the crown of twelve stars.
  const top = 18;
  const foot = pedTop;
  const gown = ct('cloth', d, 0.18);
  const mantle = ct('sky', d, 0.28);
  p.poly([[c - 4, top + 6], [c + 4, top + 6], [c + 6, foot], [c - 6, foot]], (X) => dp(gown, 3.6 + Math.cos((((X + 0.5) / d - c + 6) / 12 - 0.3) * Math.PI) * 1.2, X, 0, 0.6));
  for (const s of [-1, 1]) {
    p.poly(
      [
        [c + s * 2, top + 2],
        [c + s * 5.5, top + 6],
        [c + s * 8.5, foot],
        [c + s * 3, foot],
        [c + s * 3, top + 18],
      ],
      (X, Y) => {
        const u = ((X + 0.5) / d - c) * s;
        return dp(mantle, (s < 0 ? 3 : 2) + Math.sin(u * 1.7 + (Y / d) * 0.15) * 0.6 - ((Y + 0.5) / d - top) * 0.012, X, Y, 0.6);
      },
    );
    p.line(c + s * 5.5, top + 6, c + s * 8.5, foot, pick(br, 3), Math.max(1, d >> 1));
  }
  // The veil over the head and shoulders, the folded hands.
  p.disc(c, top + 3, 4.2, 4.4, (_X, _Y, u, v) => (v > -0.95 ? dp(gown, 4.4 - u * 0.9 - v * 0.4, _X, _Y, 0.5) : 0));
  face(p, c, top + 3.4);
  const skin = ct('plaster', d, 0.16);
  p.poly([[c - 1.2, top + 12], [c + 1.2, top + 12], [c + 0.6, top + 17], [c - 0.6, top + 17]], pick(skin, 4.2));
  if (d >= 2) p.rect(c - 0.15, top + 12.5, 0.3, 4, pick(skin, 2.6));
  // The crown of twelve stars in a ring over her head.
  for (let i = 0; i < 12; i++) {
    const a = Math.PI + (i / 11) * Math.PI;
    const sx = c + Math.cos(a) * 7;
    const sy = top - 1 + Math.sin(a) * 4.2;
    if (d === 1) p.rect(sx - 0.5, sy - 0.5, 1, 1, T('gold', 4, 1));
    else {
      p.rect(sx - 0.5, sy - 0.15, 1, 0.3, pick(br, 5));
      p.rect(sx - 0.15, sy - 0.5, 0.3, 1, pick(br, 5));
    }
  }
  // A garland of faded roses at her feet (paper flowers, grey with dust).
  for (let i = 0; i < 5; i++) p.disc(c - 7 + i * 3.5, foot - 1, 1.3, 1.1, (_X, _Y, u, v) => pick(ct('pink', d, 0.4), 2.4 - v - u * 0.4));
  dustOn(p, c - 11, pedTop, 22, 1, 0.6, 73);
  outlineC(p);
});

// ============================================================================================
// The votive candle rack (anchor bottom-centre; 3 flicker frames)
// ============================================================================================

export const VOTIVE_W = 44;
export const VOTIVE_H = 38;
/** The rack's flames (local px): [x, y] of each cup's wick; some are burnt out (`lit` false). */
const VOTIVE_CUPS: ReadonlyArray<readonly [number, number, boolean]> = (() => {
  const out: Array<[number, number, boolean]> = [];
  const tiers = [
    [8, 12],
    [16, 10],
    [24, 8],
  ] as const;
  tiers.forEach(([y, n], t) => {
    const w = 6 + n * 3.4;
    for (let i = 0; i < n; i++) out.push([VOTIVE_W / 2 - w / 2 + 3 + i * 3.4, y, h2(i, t, 91) > 0.22]);
  });
  return out;
})();

regC(
  'decor/oz-nave/votive',
  same(3, { w: VOTIVE_W, h: VOTIVE_H, ox: VOTIVE_W / 2, oy: VOTIVE_H }),
  (p, f) => {
    const d = p.d;
    const ir = ironT(d);
    const red = ct('red', d, 0.08);
    const amber = ct('candle', d, 0.06);
    const c = VOTIVE_W / 2;
    // The legs and the coin box.
    for (const x of [c - 16, c + 15]) p.rect(x, 26, 1.5, VOTIVE_H - 26, pick(ir, 2.4));
    p.rect(c - 5, 28, 10, 8, pick(ir, 1.6));
    if (d >= 2) {
      p.rect(c - 5, 28, 10, 0.5, pick(ir, 4));
      p.rect(c - 2, 30, 4, 0.5, T('ink', 0, d));
    }
    // The three stepped trays (the back one highest).
    for (const [y, n] of [
      [8, 12],
      [16, 10],
      [24, 8],
    ] as const) {
      const w = 6 + n * 3.4;
      p.rect(c - w / 2, y + 2, w, 1.5, pick(ir, 3));
      if (d >= 2) p.rect(c - w / 2, y + 2, w, 0.5, pick(ir, 4.6));
    }
    // The cups (red and amber glass, lit from inside) and the flames.
    VOTIVE_CUPS.forEach(([x, y, lit], i) => {
      const g = i % 3 === 0 ? amber : red;
      p.rect(x - 1.2, y - 1, 2.4, 3, pick(g, lit ? 4.4 : 1.6));
      if (d >= 2 && lit) p.rect(x - 1.2, y - 1, 2.4, 0.6, pick(g, 5.6));
      if (lit) flame(p, x, y - 1, 2.6 + h2(i, 1, 92) * 1.2, (f + i) % 4);
    });
    // Wax drips on the trays and a couple of spent cups on the floor.
    if (d >= 2) for (let i = 0; i < 5; i++) p.rect(c - 14 + i * 7, 18.5 + (i % 2) * 8, 0.5, 1.5, T('cloth', 4, d));
    p.rect(c - 18, VOTIVE_H - 2, 2.4, 2, pick(red, 1.4));
    p.rect(c + 17, VOTIVE_H - 2, 2.4, 2, pick(red, 1.2));
    outlineC(p);
  },
  { ticksPerFrame: 7 },
);

/** The votive rack's lamp centre (local, from the frame's bottom-centre). */
export const VOTIVE_LIGHT_DY = -20;

// ============================================================================================
// The Stations of the Cross (I … VII; anchor bottom-centre)
// ============================================================================================

export const STATION_W = 18;
export const STATION_H = 26;
const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const;

regC(
  'decor/oz-nave/station',
  same(7, { w: STATION_W, h: STATION_H, ox: STATION_W / 2, oy: STATION_H }),
  (p, f) => {
    const d = p.d;
    const wd = ct('wood', d, 0.2);
    const relief = ct('plaster', d, 0.24);
    const c = STATION_W / 2;
    // The small cross on top and the gabled frame.
    p.rect(c - 0.6, 0, 1.2, 5, pick(wd, 3.2));
    p.rect(c - 2, 1.4, 4, 1.1, pick(wd, 3.2));
    p.poly([[1, 7.5], [c, 4], [STATION_W - 1, 7.5]], pick(wd, 2.6));
    oakBox(p, 1, 7, STATION_W - 2, 13, 2.2, 101 + f);
    // The relief panel: a cream ground with figures in low relief (our own simple compositions).
    p.fill(3, 9, STATION_W - 6, 9, (X, Y) => dp(relief, 3.6 - ((Y + 0.5) / d - 9) * 0.05, X, Y, 0.5));
    const fig = (x: number, y: number, h: number, lean = 0): void => {
      p.disc(x + lean, y, 0.9, 0.9, pick(relief, 5.4));
      p.poly([[x - 1 + lean, y + 1], [x + 1 + lean, y + 1], [x + 1.4, y + h], [x - 1.4, y + h]], (X) => dp(relief, ((X + 0.5) / d < x ? 5 : 2.2), X, 0, 0.4));
    };
    const cross = (x0: number, y0: number, x1: number, y1: number): void => {
      p.line(x0, y0, x1, y1, pick(wd, 2), Math.max(1, d >> 1));
      const mxp = x0 + (x1 - x0) * 0.3;
      const myp = y0 + (y1 - y0) * 0.3;
      p.line(mxp - 1.5, myp + 1, mxp + 1.5, myp - 1, pick(wd, 2), Math.max(1, d >> 1));
    };
    switch (f) {
      case 0:
        fig(6.5, 11.5, 6);
        fig(11.5, 12.5, 5);
        p.rect(10, 15, 4, 1, pick(relief, 2));
        break;
      case 1:
        fig(9, 11.5, 6);
        cross(6, 11, 13, 17);
        break;
      case 2:
        fig(8, 14, 3.5, 1);
        cross(5, 12, 13, 16.5);
        break;
      case 3:
        fig(6.5, 11.5, 6);
        fig(11, 11.5, 6);
        cross(8, 10.5, 9, 17);
        break;
      case 4:
        fig(6, 11.5, 6);
        fig(11.5, 11.5, 6);
        cross(4.5, 12, 14, 15);
        break;
      case 5:
        fig(7, 11.5, 6);
        fig(11.5, 12, 5.5);
        p.rect(9.5, 13, 3, 2.5, pick(relief, 5.6));
        break;
      default:
        fig(8.5, 14.5, 3, -1);
        cross(5, 13, 14, 15.5);
        break;
    }
    // The numeral plaque under the frame (our own pixel lettering).
    p.rect(3, 20.5, STATION_W - 6, 5, pick(wd, 1.2));
    const txt = NUMERALS[f];
    tinyText(p, txt, c - tinyWidth(txt) / 2, 21, pick(ct('gold', d, 0.3), 4));
    outlineC(p);
  },
);

// ============================================================================================
// The altar, the crucifix, the candlesticks, the sanctuary lamp
// ============================================================================================

export const ALTAR_W = 76;
export const ALTAR_H = 58;

regC('decor/oz-nave/altar', [{ w: ALTAR_W, h: ALTAR_H, ox: ALTAR_W / 2, oy: ALTAR_H }], (p) => {
  const d = p.d;
  const st = ct('sandstone', d);
  const br = brassT(d);
  const linen = ct('cloth', d, 0.18);
  const ante = ct('green', d, 0.35);
  const c = ALTAR_W / 2;
  const H = ALTAR_H;
  const mensa = 28;
  // The stone altar under its frontal (the antependium: deep green with a gilt border and cross).
  p.fill(3, mensa + 2, ALTAR_W - 6, H - mensa - 2, ashlar(p, { k: 3, seed: 111, bw: 18, bh: 7, x0: 3, y0: mensa + 2, grime: 0.2 }));
  p.fill(8, mensa + 6, ALTAR_W - 16, H - mensa - 9, (X, Y) => dp(ante, 2 + Math.sin(((X + 0.5) / d) * 0.9) * 0.25 - ((Y + 0.5) / d - mensa) * 0.02, X, Y, 0.6));
  p.rect(8, mensa + 6, ALTAR_W - 16, 1, pick(br, 3));
  p.rect(8, H - 4, ALTAR_W - 16, 1, pick(br, 2.6));
  p.rect(8, mensa + 6, 1, H - mensa - 9, pick(br, 2.6));
  p.rect(ALTAR_W - 9, mensa + 6, 1, H - mensa - 9, pick(br, 2.4));
  p.rect(c - 1, mensa + 10, 2, 14, pick(br, 3.4));
  p.rect(c - 5, mensa + 14, 10, 2, pick(br, 3.4));
  if (d >= 2) {
    p.rect(c - 1, mensa + 10, 0.5, 14, pick(br, 5));
    p.rect(c - 5, mensa + 14, 10, 0.5, pick(br, 5));
  }
  // The linen cloth over the mensa, hanging over the front with a lace edge.
  p.rect(1, mensa, ALTAR_W - 2, 2, pick(st, 4.6));
  p.rect(2, mensa - 1, ALTAR_W - 4, 6, pick(linen, 4.2));
  if (d >= 2) {
    p.rect(2, mensa - 1, ALTAR_W - 4, 0.5, pick(linen, 5.4));
    for (let x = 2.5; x < ALTAR_W - 2; x += 2) p.disc(x + 0.5, mensa + 5, 0.7, 0.7, pick(linen, 3.6));
  }
  // The tabernacle: a small gilt house with a domed roof and a cross, its doors closed.
  p.fill(c - 8, 10, 16, mensa - 11, (X, Y) => {
    const u = ((X + 0.5) / d - (c - 8)) / 16;
    return dp(br, 2.6 + Math.cos((u - 0.3) * Math.PI) * 1.2 - (Math.abs(u - 0.5) < 0.03 ? 1.4 : 0), X, Y, 0.6);
  });
  p.disc(c, 10, 8.5, 5, (_X, _Y, u, v) => (v < 0 ? pick(br, 3.2 - u * 0.8 - v * 0.6) : 0));
  p.rect(c - 0.6, 0, 1.2, 6, pick(br, 3.8));
  p.rect(c - 2.2, 1.6, 4.4, 1.2, pick(br, 3.8));
  if (d >= 2) {
    p.rect(c - 6, 14, 5, 10, pick(br, 1.8));
    p.rect(c + 1, 14, 5, 10, pick(br, 1.6));
    p.rect(c - 0.5, 18, 1, 1, pick(br, 5));
  }
  // Two small candlesticks with unlit candles, the missal on its stand.
  for (const x of [c - 22, c + 22]) {
    p.rect(x - 2, mensa - 3, 4, 2, pick(br, 2.6));
    p.rect(x - 0.6, mensa - 9, 1.2, 6, pick(br, 3));
    p.rect(x - 1.5, mensa - 10, 3, 1, pick(br, 3.2));
    p.rect(x - 0.8, mensa - 17, 1.6, 7, pick(linen, 4.4));
    p.rect(x - 0.2, mensa - 18, 0.4, 1, T('ink', 0, d));
  }
  p.poly([[c + 9, mensa - 1], [c + 17, mensa - 1], [c + 16, mensa - 6], [c + 10, mensa - 5]], pick(ct('red', d, 0.25), 1.6));
  if (d >= 2) p.rect(c + 10, mensa - 5, 6, 0.5, pick(linen, 3.6));
  dustOn(p, 2, mensa - 1, ALTAR_W - 4, 1.5, 0.5, 113);
  outlineC(p);
});

export const CRUCIFIX_W = 50;
export const CRUCIFIX_H = 104;
/** The cross's top in the frame (the chains above it). */
const CROSS_TOP = 38;

regC('decor/oz-nave/crucifix', [{ w: CRUCIFIX_W, h: CRUCIFIX_H, ox: CRUCIFIX_W / 2, oy: 0 }], (p) => {
  const d = p.d;
  const wd = ct('wood', d, 0.15);
  const br = brassT(d);
  const ir = ironT(d);
  const skin = ct('plaster', d, 0.14);
  const c = CRUCIFIX_W / 2;
  const armY = CROSS_TOP + 12;
  // The two chains it hangs from (from the vault, out of view).
  for (const x of [4, CRUCIFIX_W - 4]) {
    for (let y = 0; y < armY; y += 2) p.rect(x - 0.5, y, 1, 1.4, pick(ir, y % 4 === 0 ? 3.4 : 2));
  }
  // The cross: a dark wood beam with gilt quatrefoil terminals and a gilt edge.
  oakBox(p, c - 3, CROSS_TOP, 6, CRUCIFIX_H - CROSS_TOP - 2, 1.8, 121, { vertical: true });
  oakBox(p, 2, armY - 3, CRUCIFIX_W - 4, 6, 1.8, 122);
  for (const [tx, ty] of [
    [c, CROSS_TOP],
    [3, armY],
    [CRUCIFIX_W - 3, armY],
    [c, CRUCIFIX_H - 3],
  ] as const) {
    p.disc(tx, ty, 3.6, 3.6, (_X, _Y, u, v) => (Math.abs(u) < 0.42 || Math.abs(v) < 0.42 ? pick(br, 3 - u * 0.8 - v * 0.8) : 0));
  }
  if (d >= 2) {
    p.rect(c - 3, CROSS_TOP + 3, 0.5, CRUCIFIX_H - CROSS_TOP - 8, pick(br, 2.8));
    p.rect(5, armY - 3, CRUCIFIX_W - 10, 0.5, pick(br, 2.8));
  }
  // The title plaque (blank).
  p.rect(c - 3.5, CROSS_TOP + 3, 7, 3, pick(ct('cloth', d, 0.2), 3.4));
  // The corpus: a calm, dignified figure; the head inclined, a thin gilt halo; no blood.
  const hy = armY + 2.5;
  p.disc(c + 0.6, hy - 1.2, 3.6, 3.6, (_X, _Y, u, v) => (u * u + v * v > 0.78 ? pick(br, 3.4) : 0));
  p.disc(c + 0.6, hy, 1.9, 2.3, (_X, _Y, u, v) => dp(skin, 4.6 - u - v * 0.4, _X, _Y, 0.5));
  p.disc(c + 0.3, hy - 1.2, 2.1, 1.3, (_X, _Y, _u, v) => (v < 0.2 ? pick(ct('brown', d, 0.2), 1.6) : 0));
  // The arms along the beam, the hands.
  p.poly([[c - 1.5, armY + 4.5], [5, armY - 0.6], [5, armY + 1], [c - 1.5, armY + 6.5]], (X) => dp(skin, 4.4 - Math.abs((X + 0.5) / d - c) * 0.02, X, 0, 0.5));
  p.poly([[c + 1.5, armY + 4.5], [CRUCIFIX_W - 5, armY - 0.6], [CRUCIFIX_W - 5, armY + 1], [c + 1.5, armY + 6.5]], (X) => dp(skin, 3.8 - Math.abs((X + 0.5) / d - c) * 0.02, X, 0, 0.5));
  // The torso (lit from the left), the loincloth, the legs and the feet.
  const ty0 = armY + 4;
  p.poly([[c - 2.6, ty0], [c + 2.6, ty0], [c + 2, ty0 + 14], [c - 2, ty0 + 14]], (X, Y) => {
    const u = ((X + 0.5) / d - (c - 2.6)) / 5.2;
    return dp(skin, 4.2 + Math.cos((u - 0.3) * Math.PI) * 0.9 - (d >= 2 && ((Y / d - ty0) | 0) % 3 === 0 && Math.abs(u - 0.5) < 0.3 ? 0.4 : 0), X, Y, 0.5);
  });
  const lc = ct('cloth', d, 0.18);
  p.poly([[c - 2.6, ty0 + 13], [c + 2.8, ty0 + 13], [c + 2.4, ty0 + 18], [c - 2.2, ty0 + 17]], (X) => dp(lc, 4.4 - ((X + 0.5) / d > c ? 1 : 0), X, 0, 0.5));
  p.poly([[c - 1.8, ty0 + 17.5], [c + 1.8, ty0 + 17.5], [c + 0.9, ty0 + 31], [c - 0.6, ty0 + 31]], (X) => dp(skin, ((X + 0.5) / d < c ? 4.2 : 3.2), X, 0, 0.5));
  p.rect(c - 1, ty0 + 31, 2, 1.5, pick(skin, 3.4));
  p.rect(c - 2.5, ty0 + 32.5, 5, 1.2, pick(wd, 2.8));
  outlineC(p);
});

export const CANDLESTICK_W = 10;
export const CANDLESTICK_H = 48;

regC(
  'decor/oz-nave/candlestick',
  same(3, { w: CANDLESTICK_W, h: CANDLESTICK_H, ox: CANDLESTICK_W / 2, oy: CANDLESTICK_H }),
  (p, f) => {
    const d = p.d;
    const br = brassT(d);
    const wax = ct('cloth', d, 0.15);
    const c = CANDLESTICK_W / 2;
    const H = CANDLESTICK_H;
    // A tall brass floor candlestick: a tripod foot, knops on the stem, the drip pan, a tall candle.
    p.poly([[c - 4.5, H], [c + 4.5, H], [c + 1.5, H - 6], [c - 1.5, H - 6]], (X) => dp(br, 2.6 + (((X + 0.5) / d < c ? 1 : -0.4)), X, 0, 0.6));
    shaftBrass(p, c - 1, 20, 2, H - 26, br);
    for (const y of [H - 10, 30, 22]) p.disc(c, y, 2.2, 1.2, (_X, _Y, u, v) => pick(br, 3.6 - u - v));
    p.rect(c - 3, 19, 6, 1.4, pick(br, 3.2));
    p.rect(c - 1.3, 6, 2.6, 13, pick(wax, 4.4));
    if (d >= 2) p.rect(c - 1.3, 6, 0.6, 13, pick(wax, 5.4));
    flame(p, c, 6, 4, f);
    outlineC(p);
  },
  { ticksPerFrame: 6 },
);

function shaftBrass(p: Pen, x: number, y: number, w: number, h: number, br: readonly Color[]): void {
  const d = p.d;
  p.fill(x, y, w, h, (X, Y) => dp(br, 2.4 + Math.cos(((((X + 0.5) / d - x) / w) - 0.3) * Math.PI) * 1.4, X, Y, 0.6));
}

export const LAMP_W = 16;
export const LAMP_H = 72;
/** The red glass's centre in the frame. */
export const LAMP_GLASS_Y = 60;

regC(
  'decor/oz-nave/lamp',
  same(3, { w: LAMP_W, h: LAMP_H, ox: LAMP_W / 2, oy: 0 }),
  (p, f) => {
    const d = p.d;
    const br = brassT(d);
    const ir = ironT(d);
    const red = ct('red', d, 0);
    const c = LAMP_W / 2;
    // The long chain and the three short ones to the bowl.
    for (let y = 0; y < 50; y += 2) p.rect(c - 0.5, y, 1, 1.4, pick(ir, y % 4 === 0 ? 3.4 : 2.2));
    p.line(c, 50, c - 5, 56, pick(br, 2.4));
    p.line(c, 50, c + 5, 56, pick(br, 2));
    p.line(c, 50, c, 56, pick(br, 2.4));
    // The brass bowl with a pendant knob, the red glass in it, the flame's glow.
    p.disc(c, 61, 6, 3.2, (_X, _Y, u, v) => (v > -0.35 ? pick(br, 3 - u * 1.4 + v * -0.5) : 0));
    p.rect(c - 6, 59.5, 12, 1, pick(br, 3.8));
    p.disc(c, 67, 1.2, 1.6, pick(br, 2.4));
    const glow = [4.6, 5.2, 4.2][f];
    p.disc(c, LAMP_GLASS_Y - 1.5, 2.6, 3.2, (_X, _Y, u, v) => pick(red, glow + 1 - (u * u + v * v) * 2 - v * 0.6));
    p.rect(c - 2.4, 58, 4.8, 1, pick(red, 3));
    if (d >= 2) p.disc(c, LAMP_GLASS_Y - 2, 0.8, 1.1, T('candle', f === 1 ? 6 : 5, d));
    outlineC(p);
  },
  { ticksPerFrame: 9 },
);

// ============================================================================================
// The iron chandelier (anchor: the top of its chain; frames 0–2 lit, 3 unlit)
// ============================================================================================

export const CHANDELIER_W = 46;
export const CHANDELIER_H = 52;
const RING_Y = 38;

regC(
  'decor/oz-nave/chandelier',
  same(4, { w: CHANDELIER_W, h: CHANDELIER_H, ox: CHANDELIER_W / 2, oy: 0 }),
  (p, f) => {
    const d = p.d;
    const ir = ironT(d);
    const wax = ct('cloth', d, 0.2);
    const c = CHANDELIER_W / 2;
    const lit = f < 3;
    // The chain, the crown's stays.
    for (let y = 0; y < 26; y += 2) p.rect(c - 0.5, y, 1, 1.4, pick(ir, y % 4 === 0 ? 3.2 : 2));
    for (const s of [-1, -0.4, 0.4, 1]) p.line(c, 26, c + s * 20, RING_Y, pick(ir, 2.4));
    // The ring seen from the side: a band with spikes, its back half darker.
    p.disc(c, RING_Y + 1, 21, 3, (_X, _Y, u, v) => (Math.abs(v) > 0.5 && u * u + v * v > 0.5 ? pick(ir, v < 0 ? 1.4 : 3.2) : 0));
    p.rect(c - 21, RING_Y, 42, 2, pick(ir, 2.8));
    if (d >= 2) p.rect(c - 21, RING_Y, 42, 0.5, pick(ir, 4.6));
    for (let i = 0; i < 7; i++) {
      const x = c - 18 + i * 6;
      p.poly([[x - 1, RING_Y + 2], [x, RING_Y + 6], [x + 1, RING_Y + 2]], pick(ir, 2));
      // A candle on its pricket; burnt down unevenly; wax runs over the ring.
      const ch = 3 + h2(i, 3, 131) * 4;
      p.rect(x - 0.9, RING_Y - ch, 1.8, ch, pick(wax, 4 - (i % 2) * 0.6));
      if (d >= 2) p.rect(x - 0.9, RING_Y + 1.5, 0.5, 1 + h2(i, 4, 132) * 3, pick(wax, 4.4));
      if (lit && h2(i, 5, 133) > 0.3) flame(p, x, RING_Y - ch, 3, (f + i) % 4);
    }
    // Old cobweb strands hanging from the ring.
    if (d >= 2) {
      const silk = mx(T('stone', 4, d), COLD, 0.3, d);
      for (const x of [c - 15, c + 9]) p.line(x, RING_Y + 2, x + 2, CHANDELIER_H - 2, silk);
    }
    outlineC(p);
  },
  { ticksPerFrame: 7 },
);

// ============================================================================================
// A moonlight shaft (decor drawn with alpha ≈ 0.3; anchor bottom-centre on the floor)
// ============================================================================================

export const SHAFT_W = 72;
export const SHAFT_H = 176;

regC('decor/oz-nave/shaft', [{ w: SHAFT_W, h: SHAFT_H, ox: SHAFT_W / 2, oy: SHAFT_H }], (p) => {
  const d = p.d;
  const moon = ct('night', d, 0);
  // A slanted band from the upper left (a window high in the aisle) to the floor, soft-edged.
  p.fill(0, 0, SHAFT_W, SHAFT_H, (X, Y) => {
    const x = (X + 0.5) / d;
    const y = (Y + 0.5) / d;
    const centre = 14 + (y / SHAFT_H) * (SHAFT_W - 34);
    const half = 7 + (y / SHAFT_H) * 7;
    const q = Math.abs(x - centre) / half;
    if (q > 1) return 0;
    const v = (1 - q * q) * (0.4 + 0.6 * (y / SHAFT_H));
    // Ordered dither: the shaft is a screen of light pixels thinning to its edges.
    if (((X * 5 + Y * 3) % 7) / 7 > v * 1.1) return 0;
    return pick(moon, 5 + v * 1.4);
  });
  // Motes caught in the light.
  for (let i = 0; i < 14; i++) {
    const y = 10 + h2(i, 1, 141) * (SHAFT_H - 20);
    const x = 14 + (y / SHAFT_H) * (SHAFT_W - 34) + (h2(i, 2, 141) - 0.5) * 10;
    p.rect(x, y, d === 1 ? 1 : 0.5, d === 1 ? 1 : 0.5, T('night', 6, d));
  }
});

// ============================================================================================
// Signs of the weeks of abandonment: a hymn board (hanging / fallen), a toppled stand, cobwebs
// ============================================================================================

regC(
  'decor/oz-nave/hymn-board',
  [
    { w: 16, h: 24, ox: 8, oy: 24 },
    { w: 26, h: 12, ox: 13, oy: 12 },
  ],
  (p, f) => {
    const d = p.d;
    const wd = ct('wood', d, 0.2);
    const card = ct('cloth', d, 0.25);
    const ink = T('ink', 1, d);
    const nums = ['84', '17', '52'];
    if (f === 0) {
      // A board with a small gable and three number cards.
      p.poly([[1, 4], [8, 0], [15, 4]], pick(wd, 2.6));
      oakBox(p, 1, 3, 14, 21, 1.8, 151);
      nums.forEach((s, i) => {
        p.rect(3, 6 + i * 6, 10, 4.5, pick(card, 3.8));
        tinyText(p, s, 8 - tinyWidth(s) / 2, 6.3 + i * 6, ink);
      });
    } else {
      // Fallen: lying askew on the floor, one card slipped out beside it.
      p.poly([[2, 11], [22, 5], [24, 8], [4, 12]], (X, Y) => dp(wd, 2 + (h2(X >> 1, Y, 3) - 0.5) * 0.4, X, Y, 0.5));
      if (d >= 2) p.line(3, 11, 22, 5.6, pick(wd, 3.4));
      p.poly([[8, 9.5], [13, 8], [13.5, 9.5], [8.5, 11]], pick(card, 3.4));
      p.rect(19, 10.5, 5, 1.5, pick(card, 3.6));
    }
    outlineC(p);
  },
);

regC('decor/oz-nave/stand', [{ w: 38, h: 10, ox: 19, oy: 10 }], (p) => {
  const d = p.d;
  const ir = ironT(d);
  const wax = ct('cloth', d, 0.2);
  // A tall iron candle stand lying on its side; its candle rolled away; a splash of old wax.
  p.line(4, 7, 30, 6, pick(ir, 2.8), Math.max(1, d));
  p.poly([[1, 9.5], [3, 3], [5, 3], [7, 9.5]], pick(ir, 2.2));
  p.rect(30, 3.5, 2, 5, pick(ir, 3.2));
  p.rect(32, 4, 3, 4, pick(ir, 2.4));
  p.rect(14, 8.5, 6, 1.5, pick(wax, 3.6));
  p.poly([[22, 9.5], [27, 8.5], [27.4, 9.6], [22.4, 10]], pick(wax, 4.2));
  outlineC(p);
});

regC(
  'decor/oz-nave/cobweb',
  same(2, { w: 22, h: 18, ox: 0, oy: 0 }),
  (p, f) => {
    if (f === 0) cobweb(p, 0.5, 0.5, 18, 1, 161);
    else cobweb(p, 21.5, 0.5, 18, -1, 162);
  },
);

// ============================================================================================
// The red west doors (the `oz-nave-doors` entity; anchor bottom-centre in the doorway)
// ============================================================================================

export const DOORS_W = 40;
export const DOORS_H = 74;

regC(
  'decor/oz-nave/doors',
  same(4, { w: DOORS_W, h: DOORS_H, ox: DOORS_W / 2, oy: DOORS_H }),
  (p, f) => {
    const d = p.d;
    const W = DOORS_W;
    const H = DOORS_H;
    const red = ct('red', d, 0.3);
    const ir = ironT(d);
    // The opening's shape: a pointed arch filling the frame.
    archPointed(p, 0, 0, W, H, (X, Y) => outside(X, Y, d));
    // The leaves: open (thin, swung in) → shut; each leaf hinged at its jamb.
    const leaf = [3.5, 10, 17, W / 2][f];
    for (const s of [-1, 1] as const) {
      const x0 = s < 0 ? 0 : W - leaf;
      archPointed(p, 0, 0, W, H, (X, Y) => {
        const x = (X + 0.5) / d;
        if (x < x0 || x >= x0 + leaf) return 0;
        const u = s < 0 ? (x - x0) / leaf : (x0 + leaf - x) / leaf;
        // Vertical planks, weathered red paint, darker toward the hinge when swung in.
        const plank = Math.floor(((x - x0) * W) / Math.max(1, leaf) / 4.5);
        let k = 2.8 + (h2(plank, s, 171) - 0.5) * 0.7 - (f < 3 ? (1 - u) * 1.2 : 0);
        if (d >= 2 && ((x - x0) * (W / Math.max(1, leaf))) % 4.5 < 0.5) k -= 1.2;
        if (d >= 4 && h2(X, Y, 172) > 0.93) k -= 0.8;
        if (h2(Math.floor(X / (2 * d)), Math.floor(Y / (6 * d)), 173) > 0.94) k -= 0.8; // flaked paint
        return dp(red, k, X, Y, 0.6);
      });
      if (f === 3) {
        // Wrought-iron strap hinges with scrolls, studs, the ring handle.
        for (const y of [18, 50]) {
          const xs = s < 0 ? 0 : W - 16;
          p.rect(xs, y, 16, 1.6, pick(ir, 2.6));
          if (d >= 2) p.rect(xs, y, 16, 0.5, pick(ir, 4.2));
          p.disc(s < 0 ? 15 : W - 15, y + 0.8, 1.6, 1.6, (_X, _Y, u, v) => (u * u + v * v > 0.35 ? pick(ir, 3) : 0));
        }
        if (d >= 2) for (let y = 8; y < H - 4; y += 6) for (const x of [4, 12]) p.rect(s < 0 ? x : W - x - 1, y, 0.75, 0.75, pick(ir, 4));
      }
    }
    if (f === 3) {
      p.rect(W / 2 - 0.5, 10, 1, H - 10, pick(red, 0.8));
      p.disc(W / 2 + 3, 40, 2, 2, (_X, _Y, u, v) => (u * u + v * v > 0.45 ? pick(ir, 3.4) : 0));
    }
  },
);

/** The night square seen through the open doors: the cold sky, the fog, the pavers, the statue's plinth. */
function outside(X: number, Y: number, d: Dn): Color {
  const y = (Y + 0.5) / d;
  const x = (X + 0.5) / d;
  const night = ct('night', d, 0);
  if (y > DOORS_H - 9) {
    // The red-brick pavers of Plechelmusplein, cold in the moonlight.
    const row = Math.floor((y - (DOORS_H - 9)) / 2);
    return dp(ct('brick', d, 0.45), 1.6 + ((Math.floor(x / 3) + row) % 2) * 0.5, X, Y, 0.5);
  }
  // The freed statue on its plinth, a dark silhouette in the fog to the right.
  if (x > 25 && x < 31 && y > DOORS_H - 30) return dp(night, x > 27 && y < DOORS_H - 22 ? 1.6 : 1.2, X, Y, 0.5);
  if (x > 26.5 && x < 29.5 && y > DOORS_H - 38 && y <= DOORS_H - 30) return dp(night, 1.6, X, Y, 0.5);
  // The sky: moonlit fog low, darker high.
  return dp(night, 2.6 + (y / DOORS_H) * 2.2, X, Y, 0.9);
}

// ============================================================================================
// The chapel's iron grille (the `oz-chapel-gate` entity; anchor bottom-centre; 3 frames)
// ============================================================================================

regC(
  'decor/oz-nave/grille',
  same(3, { w: GRILLE_W, h: GRILLE_H, ox: GRILLE_W / 2, oy: GRILLE_H }),
  (p, f) => {
    const d = p.d;
    const ir = ironT(d);
    const W = GRILLE_W;
    const H = GRILLE_H;
    const c = W / 2;
    const gate = 34;
    const g0 = c - gate / 2;
    const bar = (x: number, top: number, bot: number, k = 2.6): void => {
      p.rect(x, top, d === 1 ? 1 : 0.75, bot - top, pick(ir, k));
      if (d >= 2) p.rect(x, top, 0.25, bot - top, pick(ir, k + 1.6));
      // The spear finial.
      p.poly([[x - 0.75, top + 1], [x + 0.375, top - 2.5], [x + 1.5, top + 1]], pick(ir, k + 0.6));
    };
    // The fixed side panels: bars, two rails, a band of C-scrolls along the top.
    for (const [x0, x1] of [
      [2, g0],
      [g0 + gate, W - 2],
    ] as const) {
      for (let x = x0; x < x1 - 0.5; x += 4) bar(x, 6, H - 1);
      p.rect(x0, 14, x1 - x0, 1.2, pick(ir, 3));
      p.rect(x0, H - 10, x1 - x0, 1.2, pick(ir, 3));
      if (d >= 2) for (let x = x0 + 2; x < x1 - 3; x += 8) p.disc(x + 2, 10.5, 2, 2.4, (_X, _Y, u, v) => (u * u + v * v > 0.45 && !(u > 0 && v > 0) ? pick(ir, 3.4) : 0));
    }
    // The posts either side of the gate.
    for (const x of [g0 - 1, g0 + gate]) {
      p.rect(x, 2, 2, H - 2, pick(ir, 2.2));
      p.disc(x + 1, 2, 1.6, 1.6, pick(ir, 3.6));
    }
    // The two gate leaves: shut (f 0), swinging (1), open against the posts (2).
    const lw = [gate / 2, gate / 4, 3][f];
    for (const s of [-1, 1] as const) {
      const lx0 = s < 0 ? g0 + 1 : g0 + gate - 1 - lw;
      const n = Math.max(1, Math.round(lw / 3.6));
      for (let i = 0; i <= n; i++) bar(lx0 + (i * (lw - 1)) / n, 8, H - 2, f === 0 ? 2.8 : 2.2);
      p.rect(lx0, 16, lw, 1.2, pick(ir, 3));
      p.rect(lx0, H - 10, lw, 1.2, pick(ir, 3));
    }
    if (f === 0) {
      // The lock box and its hasp where the leaves meet.
      p.rect(c - 2, 38, 4, 5, pick(ir, 1.8));
      if (d >= 2) p.rect(c - 2, 38, 4, 0.5, pick(ir, 4));
    }
  },
);
