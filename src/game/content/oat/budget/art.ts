/**
 * The art of the oat budget pieces (docs/design/oat.md §6.1, §6.2, §8.11; first versions by BUDGET,
 * wave A; PIECES polishes them in wave B): ONE drawer per sprite id for its 1×, 2× and 4× art (the
 * ring kit's `Pen`: logical geometry, every density the same shapes).
 *
 * - `decor/oat/piece/bin-100`, `decor/oat/piece/bin-200`: the city's dark grey street bins (100 L:
 *   14 × 20; 200 L: 16 × 24 on two small wheels) with our own `XXX` band (never the arms as a logo).
 *   Frame 0 whole, frame 1 the wreck (100 L burst open, its lid beside it; 200 L tipped on its side,
 *   lid open to the right: the entity mirrors it to the side it falls). They can be shot: outline A.
 * - `item/oat/can`, `item/oat/bottle-s`, `item/oat/bottle-l`: the statiegeld pickups (outline A).
 * - `item/oat/flat-white`, `item/oat/matcha`, `item/oat/zuurdesem`: DE HAVERBAR's goods on the
 *   counter (outline A; also the HUD status icons).
 * - `decor/oat/piece/haverbar`: the shop window (104 × 56, anchor at its foot centre; static: NO
 *   outline, lit from the left). Frame 0 the whole front, frame 1 only the counter (drawn again over
 *   the barista, so she stands behind it). `decor/oat/piece/haverbar-barista`: the friendly barista
 *   (an NPC that acts: outline A), frames idle / serve / refuse.
 *
 * Colours: PAL_HD ramps by tone (`toneI`), the oat ramps (`PAL_HD_OAT`) at 2× / 4×; at 1× every
 * colour snaps to PAL. Same input, same pixels (no randomness).
 */
import type { Color } from '../../../../engine/color';
import { PAL_HD_OAT, type HdOatRampName, type HdRampName } from '../../../../engine/palette-hd';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { outlineA, Pen, snap, tinyText, tinyWidth, toneI, type Dn } from '../../ring/scenery/kit';

/** Every sprite id this file registers (tests). */
export const OAT_BUDGET_SPRITES: string[] = [];
/** The ids that carry outline A (shootable things, pickups, the acting barista; spec §8.11). */
export const OAT_BUDGET_OUTLINED = new Set<string>();

export const BIN_SPRITE = { 100: 'decor/oat/piece/bin-100', 200: 'decor/oat/piece/bin-200' } as const;
export const DEPOSIT_SPRITE = { can: 'item/oat/can', bottleS: 'item/oat/bottle-s', bottleL: 'item/oat/bottle-l' } as const;
export const GOOD_SPRITE = { flatWhite: 'item/oat/flat-white', matcha: 'item/oat/matcha', zuurdesem: 'item/oat/zuurdesem' } as const;
export const HAVERBAR_SPRITE = 'decor/oat/piece/haverbar';
export const BARISTA_SPRITE = 'decor/oat/piece/haverbar-barista';

/** The shop sprite's size (logical px; anchor at the foot centre) and the counter top over the floor. */
export const HAVERBAR_W = 104;
export const HAVERBAR_H = 56;
export const COUNTER_TOP = 20;

type Draw = (p: Pen, frame: number) => void;

/** Register `id`: `n` frames of w × h logical px with anchor (ox, oy), drawn at d 1, 2 and 4. */
function reg(id: string, w: number, h: number, ox: number, oy: number, n: number, draw: Draw, outlined: boolean): void {
  const frames = (d: Dn): Frame[] => {
    const out: Frame[] = [];
    for (let i = 0; i < n; i++) {
      const p = new Pen(w, h, d);
      draw(p, i);
      if (outlined) outlineA(p);
      out.push(p.frame(ox, oy));
    }
    return out;
  };
  defineSprite(id, () => frames(1), { hd: (d) => frames(d as Dn), ticksPerFrame: 8 });
  OAT_BUDGET_SPRITES.push(id);
  if (outlined) OAT_BUDGET_OUTLINED.add(id);
}

// ------------------------------------------------------------------------------------ colour

const T = (r: HdRampName, k: number, d: Dn): Color => toneI(r, k, d);

/** Tone k of an oat ramp at d (snapped to PAL at 1). */
function O(r: HdOatRampName, k: number, d: Dn): Color {
  const ramp = PAL_HD_OAT[r];
  const c = ramp[Math.max(0, Math.min(ramp.length - 1, Math.round(k)))] >>> 0;
  return d === 1 ? snap(c, 1) : c;
}

/** A vertical cylinder shaded across (lit left, the sun of spec §8.3): tones k0 (shade) … k1 (lit) of `tone`. */
function cyl(p: Pen, x: number, y: number, w: number, h: number, tone: (k: number) => Color, k0: number, k1: number): void {
  const d = p.d;
  p.fill(x, y, w, h, (X) => {
    const u = ((X + 0.5) / d - x) / w;
    const t = 1 - Math.abs(u - 0.3) * 1.7;
    return tone(Math.round(k0 + Math.max(0, Math.min(1, t)) * (k1 - k0)));
  });
}

/** Our bin motif: three small crosses side by side from (x, y), each 3 × 3 logical px, 1 px apart. */
function crosses(p: Pen, x: number, y: number, c: Color): void {
  const d = p.d;
  const wA = d === 1 ? 1 : Math.max(1, d >> 1);
  for (let i = 0; i < 3; i++) {
    const cx = x + i * 4;
    if (d === 1) {
      for (let k = 0; k < 3; k++) {
        p.rect(cx + k, y + k, 1, 1, c);
        p.rect(cx + 2 - k, y + k, 1, 1, c);
      }
    } else {
      p.line(cx + 0.25, y + 0.25, cx + 2.75 - 1 / d, y + 2.75 - 1 / d, c, wA);
      p.line(cx + 2.75 - 1 / d, y + 0.25, cx + 0.25, y + 2.75 - 1 / d, c, wA);
    }
  }
}

// =============================================================================================
// The statiegeld bins (spec §6.1)
// =============================================================================================

const grey = (d: Dn) => (k: number): Color => T('black', k, d);

/** The 100 L bin: 14 × 20 (Pen 22 × 22, anchor (9, 21)); frame 1 burst open, its lid on the floor at the right. */
reg(BIN_SPRITE[100], 22, 22, 9, 21, 2, (p, f) => {
  const d = p.d;
  const g = grey(d);
  const x = 2;
  const w = 14;
  if (f === 0) {
    // Body, a darker foot ring, the domed lid.
    cyl(p, x, 4, w, 17, g, 3, 6);
    p.rect(x, 19, w, 2, g(2));
    p.rect(x + 0.5, 2, w - 1, 2.5, g(5));
    p.rect(x + 2, 1, w - 4, 1.5, g(6));
    if (d > 1) p.rect(x + 2, 1, 3, 1 / d, T('steel', 6, d));
    // The throw-in slot with a lit lower lip.
    p.rect(x + 2, 6, w - 4, 3, T('ink', 0, d));
    p.rect(x + 2, 9, w - 4, d === 1 ? 1 : 0.5, g(6));
    // Our XXX band.
    p.rect(x, 12, w, 5, g(2));
    crosses(p, x + 1, 13, T('cloth', 4, d));
  } else {
    // Burst: the lower half with a torn rim, the dark inside, the lid on the floor beside it.
    cyl(p, x, 11, w, 10, g, 3, 6);
    p.rect(x, 19, w, 2, g(2));
    p.poly(
      [
        [x, 11],
        [x + 3, 8],
        [x + 5, 11],
        [x + 8, 9],
        [x + 11, 12],
        [x + w, 9],
        [x + w, 13],
        [x, 13],
      ],
      g(5),
    );
    p.rect(x + 2, 12, w - 4, 2, T('ink', 0, d));
    p.rect(x, 15, w, 3, g(2));
    crosses(p, x + 1, 15, T('cloth', 3, d));
    p.rect(x + w + 0.5, 19.5, 4.5, 1.5, g(5));
    p.rect(x + w + 0.5, 19.5, 4.5, d === 1 ? 1 : 0.5, g(6));
  }
}, true);

/** The 200 L bin: 16 × 24 on two wheels (Pen 34 × 26, anchor (17, 25)); frame 1 tipped to the right, lid open. */
reg(BIN_SPRITE[200], 34, 26, 17, 25, 2, (p, f) => {
  const d = p.d;
  const g = grey(d);
  if (f === 0) {
    const x = 9;
    const w = 16;
    // A slightly tapered body (wider at the top), the overhanging lid, the handle bar.
    p.poly(
      [
        [x, 4],
        [x + w, 4],
        [x + w - 1, 23],
        [x + 1, 23],
      ],
      (X) => g(Math.round(3 + Math.max(0, Math.min(1, 1 - Math.abs(((X + 0.5) / d - x) / w - 0.3) * 1.7)) * 3)),
    );
    p.rect(x - 0.5, 2, w + 1, 2.5, g(5));
    p.rect(x, 1, w, 1, g(6));
    p.rect(x + 1, 4.5, w - 2, d === 1 ? 1 : 0.5, g(2));
    // Our XXX band and a darker skirt.
    p.rect(x + 1, 11, w - 2, 5, g(2));
    crosses(p, x + 2, 12, T('cloth', 4, d));
    p.rect(x + 1, 20, w - 2, 3, g(2));
    // The two wheels at the foot.
    for (const wx of [x + 2.5, x + w - 2.5]) {
      p.disc(wx, 23.5, 2, 1.5, T('ink', 1, d));
      p.disc(wx - 0.3, 23.3, 0.8, 0.6, g(4));
    }
  } else {
    // On its side: the body along the floor, the bottom (wheels) at the left, the lid open at the right.
    const x = 4;
    const y = 12;
    const L = 23;
    const H = 13;
    p.fill(x, y, L, H, (_X, Y) => {
      const v = ((Y + 0.5) / d - y) / H;
      const t = 1 - Math.abs(v - 0.3) * 1.7;
      return g(Math.round(3 + Math.max(0, Math.min(1, t)) * 3));
    });
    p.rect(x, y + 1, 2, H - 2, g(2));
    p.disc(x + 1.5, y + 2, 1.8, 1.8, T('ink', 1, d));
    p.rect(x + 7, y + 1, 5, H - 2, g(2));
    crosses(p, x + 7.5, y + 2.5, T('cloth', 4, d));
    // The open mouth and the lid hanging down to the floor.
    p.rect(x + L, y + 1, 1.5, H - 1, T('ink', 0, d));
    p.poly(
      [
        [x + L + 1, y],
        [x + L + 3, y],
        [x + L + 6, y + H],
        [x + L + 4, y + H],
      ],
      g(5),
    );
  }
}, true);

// =============================================================================================
// Cans and bottles (spec §6.1)
// =============================================================================================

/** A can: 4 × 7, steel with a red band (Pen 6 × 9, anchor (3, 8)). */
reg(DEPOSIT_SPRITE.can, 6, 9, 3, 8, 1, (p) => {
  const d = p.d;
  cyl(p, 1, 1, 4, 7, (k) => T('steel', k, d), 3, 6);
  p.fill(1, 3, 4, 3, (X) => T('red', ((X + 0.5) / d - 1) / 4 < 0.45 ? 5 : 3, d));
  p.rect(1, 1, 4, d === 1 ? 1 : 0.5, T('steel', 6, d));
  if (d > 1) p.rect(1.5, 7.5, 3, 0.5, T('steel', 2, d));
}, true);

/** A small glass bottle: green glass, a cream label, a gold cap (Pen 6 × 12, anchor (3, 11)). */
reg(DEPOSIT_SPRITE.bottleS, 6, 12, 3, 11, 1, (p) => {
  const d = p.d;
  cyl(p, 1, 5, 4, 6, (k) => T('green', k, d), 2, 5);
  p.rect(1.5, 4, 3, 1, T('green', 3, d));
  cyl(p, 2, 1.5, 2, 2.5, (k) => T('green', k, d), 2, 4);
  p.rect(2, 1, 2, d === 1 ? 1 : 0.75, T('gold', 5, d));
  p.rect(1, 7, 4, 2, T('cloth', 4, d));
  if (d > 1) p.rect(1.5, 5.5, 0.5, 1.5, T('green', 7, d));
}, true);

/** A big plastic bottle: clear blue, a red label, a blue cap (Pen 8 × 15, anchor (4, 14)). */
reg(DEPOSIT_SPRITE.bottleL, 8, 15, 4, 14, 1, (p) => {
  const d = p.d;
  cyl(p, 1, 5, 6, 9, (k) => T('sky', k, d), 3, 7);
  p.poly(
    [
      [2, 3.5],
      [6, 3.5],
      [7, 5],
      [1, 5],
    ],
    T('sky', 5, d),
  );
  p.rect(3, 1.5, 2, 2, T('sky', 4, d));
  p.rect(2.5, 1, 3, 1, T('navy', 4, d));
  p.rect(1, 8, 6, 2.5, T('red', 5, d));
  if (d > 1) {
    p.rect(1, 8, 6, 0.5, T('red', 6, d));
    p.rect(1.75, 5.5, 0.5, 2, T('sky', 7, d));
    p.rect(1.75, 11, 0.5, 2, T('sky', 7, d));
  }
}, true);

// =============================================================================================
// DE HAVERBAR's goods (spec §6.2)
// =============================================================================================

/** FLAT WHITE: a white cup and saucer, the crema with a leaf (Pen 10 × 10, anchor (5, 9)). */
reg(GOOD_SPRITE.flatWhite, 11, 10, 5, 9, 1, (p) => {
  const d = p.d;
  p.rect(1, 8, 8, 1, T('cloth', 3, d));
  p.rect(1.5, 7.5, 7, d === 1 ? 1 : 0.5, T('cloth', 5, d));
  // The handle at the right.
  p.rect(7.5, 4, 2, 3, T('cloth', 3, d));
  p.rect(8, 4.75, 1, 1.5, 0);
  cyl(p, 2, 3, 6, 5, (k) => T('cloth', k, d), 2, 6);
  p.rect(2, 2, 6, 1.5, T('sand', 5, d));
  if (d > 1) {
    p.rect(4, 2.25, 2, 0.75, T('cloth', 6, d));
    p.rect(4.5, 2, 1, 0.25, T('brown', 4, d));
  } else p.rect(4, 2, 2, 1, T('cloth', 6, d));
}, true);

/** MATCHA: a tall glass, the green below the oat milk (Pen 8 × 12, anchor (4, 11)). */
reg(GOOD_SPRITE.matcha, 8, 12, 4, 11, 1, (p) => {
  const d = p.d;
  cyl(p, 1, 1, 6, 10, (k) => T('glass', k, d), 3, 5);
  cyl(p, 1.5, 5, 5, 5.5, (k) => T('green', k, d), 4, 7);
  cyl(p, 1.5, 2, 5, 3, (k) => T('cloth', k, d), 3, 6);
  p.rect(1.5, 4.5, 5, d === 1 ? 1 : 0.5, T('green', 6, d));
  // A paper straw.
  p.rect(4.5, 0, 1, 3, T('cloth', 5, d));
  if (d > 1) p.rect(1.5, 2, 0.5, 8, T('glass', 5, d));
}, true);

/** ZUURDESEM: a round sourdough loaf with its scored ear and flour (Pen 14 × 9, anchor (7, 8)). */
reg(GOOD_SPRITE.zuurdesem, 14, 9, 7, 8, 1, (p) => {
  const d = p.d;
  p.disc(7, 5, 6, 3.5, (_X, _Y, u, v) => {
    const lit = -u * 0.6 - v * 0.8;
    return T('wood', lit > 0.45 ? 6 : lit > 0 ? 5 : lit > -0.45 ? 4 : 3, d);
  });
  // The ear: a lighter score from left to right over the crown.
  p.line(3.5, 4.5, 10, 2.75, T('sand', 6, d), d === 1 ? 1 : Math.max(1, d >> 1));
  if (d > 1) {
    p.line(4, 5.1, 10, 3.5, T('wood', 2, d), 1);
    for (const [fx, fy] of [[4, 3], [6, 2.25], [9, 5], [5.5, 6]] as const) p.rect(fx, fy, 0.5, 0.5, T('cloth', 5, d));
  }
}, true);

// =============================================================================================
// The shop window and the barista (spec §6.2)
// =============================================================================================

/** The shop front (104 × 56, anchor at the foot centre; NO outline). Frame 1: only the counter. */
reg(HAVERBAR_SPRITE, HAVERBAR_W, HAVERBAR_H, HAVERBAR_W / 2, HAVERBAR_H, 2, (p, f) => {
  const d = p.d;
  const W = HAVERBAR_W;
  const H = HAVERBAR_H;
  const top = H - COUNTER_TOP;
  if (f === 0) {
    // The brick piers (lit left, mortar joints at 2× / 4×).
    for (const px of [0, W - 6]) {
      p.rect(px, 8, 6, H - 8, O('brick', 4, d));
      p.rect(px, 8, 1, H - 8, O('brick', 5, d));
      p.rect(px + 5, 8, 1, H - 8, O('brick', 2, d));
      if (d > 1) for (let y = 10; y < H; y += 2) p.rect(px + 1, y, 4, 0.25, O('mortar', 0, d));
    }
    // The fascia board with our name, lit along its top edge.
    p.rect(0, 0, W, 8, O('green', 3, d));
    p.rect(0, 0, W, d === 1 ? 1 : 0.5, T('moss', 4, d));
    p.rect(0, 7.5, W, 0.5, O('green', 1, d));
    const name = 'DE HAVERBAR';
    tinyText(p, name, Math.round((W - tinyWidth(name)) / 2), 1.5, T('plaster', 5, d), { lit: T('plaster', 6, d) });
    // The window: the café inside (a warm back wall, a shelf with jars, the chalk menu, the espresso machine).
    p.fill(6, 14, W - 12, top - 14, (_X, Y) => T('brown', (Y + 0.5) / d < 22 ? 2 : 3, d));
    p.rect(6, 22, W - 12, 1, T('wood', 3, d));
    for (let i = 0; i < 9; i++) {
      const jx = 34 + i * 4;
      if (jx > 66) break;
      p.rect(jx, 19, 2, 3, i % 3 === 0 ? T('sand', 5, d) : i % 3 === 1 ? T('cloth', 4, d) : T('wood', 5, d));
    }
    p.rect(11, 17, 18, 13, T('black', 1, d));
    p.rect(11, 17, 18, d === 1 ? 1 : 0.5, T('wood', 4, d));
    for (let i = 0; i < 4; i++) p.rect(13, 19.5 + i * 2.5, 6 + ((i * 5) % 9), d === 1 ? 1 : 0.5, T('cloth', 4, d));
    p.rect(74, 25, 18, top - 25, T('steel', 4, d));
    p.rect(74, 25, 18, 2, T('steel', 6, d));
    p.rect(91, 25, 1, top - 25, T('steel', 2, d));
    p.rect(77, 30, 3, 3, T('ink', 1, d));
    p.rect(85, 30, 3, 3, T('ink', 1, d));
    // The awning: cream and green stripes, a scalloped edge, its shade on the wall below.
    p.rect(6, 14, W - 12, 1.5, T('brown', 1, d));
    for (let x = 4, i = 0; x < W - 4; x += 6, i++) {
      const c = i % 2 === 0 ? T('plaster', 5, d) : O('green', 3, d);
      p.rect(x, 8, 6, 5, c);
      p.disc(x + 3, 13, 3, 1.5, c);
      if (i % 2 === 0) p.rect(x, 8, 1, 5, T('plaster', 6, d));
    }
    p.rect(4, 8, W - 8, d === 1 ? 1 : 0.5, T('plaster', 3, d));
    // A glint on the glass (2× / 4× only).
    if (d > 1) {
      p.line(36, top - 1, 44, 16, T('glass', 5, d), 1);
      p.line(40, top - 1, 47, 17, T('glass', 4, d), 1);
    }
  }
  // The counter: an oak top and a green panelled front with HAVERMELK.
  p.rect(4, top, W - 8, 3, T('wood', 5, d));
  p.rect(4, top, W - 8, d === 1 ? 1 : 0.5, T('wood', 7, d));
  p.rect(4, top + 2.5, W - 8, 0.5, T('wood', 2, d));
  p.rect(6, top + 3, W - 12, COUNTER_TOP - 6, O('green', 2, d));
  for (const [x0, x1] of [[9, 28], [32, 72], [76, 95]] as const) {
    p.rect(x0, top + 5, x1 - x0, COUNTER_TOP - 11, O('green', 3, d));
    p.rect(x0, top + 5, x1 - x0, d === 1 ? 1 : 0.5, O('green', 1, d));
    p.rect(x0, top + COUNTER_TOP - 6.5, x1 - x0, d === 1 ? 1 : 0.5, T('moss', 3, d));
  }
  const word = 'HAVERMELK';
  tinyText(p, word, Math.round((W - tinyWidth(word)) / 2), top + 7, T('plaster', 5, d));
  p.rect(6, H - 3, W - 12, 3, O('green', 1, d));
  p.rect(6, H - 3, W - 12, d === 1 ? 1 : 0.5, O('green', 0, d));
}, false);

/** The barista behind the counter (Pen 18 × 22, anchor at the bottom centre). Frames: idle, serve, refuse. */
reg(BARISTA_SPRITE, 18, 22, 9, 22, 3, (p, f) => {
  const d = p.d;
  const skin = (k: number): Color => T('skinB', k, d);
  // Shirt and the green apron with its straps.
  cyl(p, 4, 11, 10, 11, (k) => T('cloth', k, d), 2, 5);
  p.rect(6, 13, 6, 9, O('green', 3, d));
  p.rect(6, 11, 1, 2, O('green', 3, d));
  p.rect(11, 11, 1, 2, O('green', 3, d));
  if (d > 1) p.rect(6, 13, 6, 0.5, T('moss', 3, d));
  // Arms: idle at the sides; serve: the near arm forward with a cup; refuse: a raised palm.
  p.rect(3, 12, 2, 7, T('cloth', 3, d));
  p.rect(3, 18.5, 2, 1.5, skin(5));
  if (f === 1) {
    p.rect(13, 12, 3.5, 2, T('cloth', 4, d));
    p.rect(14.5, 9, 2, 3.5, skin(5));
    p.rect(14, 6.5, 3, 3, T('cloth', 6, d));
  } else if (f === 2) {
    p.rect(13, 9, 2, 4, T('cloth', 4, d));
    p.rect(13, 5, 3, 4, skin(6));
  } else {
    p.rect(13, 12, 2, 7, T('cloth', 3, d));
    p.rect(13, 18.5, 2, 1.5, skin(5));
  }
  // Neck, head, hair with a bun.
  p.rect(8, 9, 2, 2.5, skin(4));
  p.disc(9, 6, 3.5, 3.6, (_X, _Y, u, v) => skin(-u - v > 0.4 ? 6 : u + v > 0.7 ? 4 : 5));
  p.rect(5.5, 2, 7, 2, T('hairB', 3, d));
  p.rect(5.5, 3, 1.5, 3, T('hairB', 3, d));
  p.disc(12, 2.5, 1.6, 1.6, T('hairB', 2, d));
  // The face: eyes, and a smile (a flat mouth when she refuses).
  const eye = T('ink', 0, d);
  p.rect(7.5, 5.5, d === 1 ? 1 : 0.75, 1, eye);
  p.rect(10, 5.5, d === 1 ? 1 : 0.75, 1, eye);
  if (f === 2) p.rect(8, 8, 2.5, d === 1 ? 1 : 0.5, T('skinB', 1, d));
  else {
    p.rect(8, 8, 2.5, d === 1 ? 1 : 0.5, T('skinB', 1, d));
    if (d > 1) {
      p.rect(7.5, 7.5, 0.5, 0.5, T('skinB', 1, d));
      p.rect(10.5, 7.5, 0.5, 0.5, T('skinB', 1, d));
    }
  }
}, true);
