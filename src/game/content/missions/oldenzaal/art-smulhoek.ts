/**
 * De Smulhoek, the corner snack bar (TOWN, wave A; docs/design/oldenzaal.md §4.1; a likeness by
 * eye, never traced): ONE density-generic drawer per id (art-kit.ts `reg`), static decor with
 * outline C. In the dark of oz-b its windows glow warm: the only cosy light in the town.
 *
 * - `decor/oz/smulhoek` — the three-storey 19th-century corner building seen from the street: the
 *   angled corner bays left and right, white-painted brick on the ground floor with cream pilasters
 *   and medallions, dark red-brown brick panels upstairs, the cream centre bay of rusticated
 *   blocks with a tall window under a green scalloped awning and a pediment, a cornice on cream
 *   consoles, the dark tile hipped roof and the white dormer with three windows; the shop: the
 *   dark-green sign board with `de Smulhoek` in our own cream SCRIPT lettering, the green door
 *   (glass, warm inside), the open door where Meneer Wu stands, the bright poster door, a dark
 *   green plinth. Anchor bottom-left (the foot on the street line).
 * - `decor/oz/menu-board` — the A-frame menu board on the pavement (chalk lines, a tray of fries).
 * - `decor/oz/parasol` — the closed grey parasol on its pole and foot.
 * - `decor/oz/smulhoek-screen` — the low terrace screen with the script name on a cream panel.
 *
 * The points the scene and the light pass need are exported (`SMULHOEK_*`), relative to the
 * building's left foot; the section adds its world x.
 */
import type { Color } from '../../../../engine/color';
import { SMULHOEK_SIGN } from './lines';
import { dq, F, h2, outlineC, pick, reg, snap, T, tinyText, tones, type Dn, type Pen, type Rn } from './art-kit';
import { GRADE } from './art-street';

const COLD = T('night', 3, 2);
function gt(n: Rn, d: Dn, t = GRADE): readonly Color[] {
  return tones(n, d, COLD, t);
}

/** The building's frame (logical px). */
export const SMULHOEK_W = 124;
export const SMULHOEK_H = 132;
/** Heights: the shop floor, the first floor, the cornice, the roof. */
const GF = 50;
const FF = 42;
const CORN = 8;
const ROOF = 22;

/** Meneer Wu's spot: the open door's centre x (from the building's left) on the street line. */
export const SMULHOEK_DOOR_X = 62;
/** The open door's width (the warm opening behind Wu). */
export const SMULHOEK_DOOR_W = 11;

/** A warm light of the building for the light pass (relative to the left foot; y up is negative). */
export interface SmulhoekLight {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly intensity: number;
  readonly flicker: number;
}

/** De Smulhoek's warm lights: the open door, the shop windows, the first-floor window, the dormer. */
export const SMULHOEK_LIGHTS: readonly SmulhoekLight[] = [
  { x: SMULHOEK_DOOR_X, y: -16, r: 34, intensity: 1, flicker: 0.04 },
  { x: 74, y: -18, r: 22, intensity: 0.8, flicker: 0.03 },
  { x: 49, y: -18, r: 20, intensity: 0.7, flicker: 0 },
  { x: 62, y: -(GF + 22), r: 22, intensity: 0.75, flicker: 0.02 },
  { x: 62, y: -(GF + FF + CORN + ROOF - 2), r: 18, intensity: 0.55, flicker: 0 },
];

// ------------------------------------------------------------------------------------ script

/**
 * Our own pixel SCRIPT for the name (7 rows; '#' = ink): a slanted, joined hand with a
 * swashed capital S. Drawn with an italic shear; at 2× and 4× every px is a soft round dot, so the
 * strokes read as brush lines.
 */
const SCRIPT: Readonly<Record<string, readonly string[]>> = {
  d: ['...#', '...#', '...#', '.###', '#..#', '#..#', '.##.#'],
  e: ['....', '....', '....', '.##.', '#.##', '##..', '.###'],
  ' ': ['..', '..', '..', '..', '..', '..', '..'],
  S: ['..###', '.#..#', '.#...', '..##.', '....#', '#...#', '.###.'],
  m: ['......', '......', '......', '##.##.', '#.#.#.', '#.#.#.', '#.#.##'],
  u: ['....', '....', '....', '#..#', '#..#', '#.##', '.#.#'],
  l: ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
  h: ['#...', '#...', '#...', '#.#.', '##.#', '#..#', '#..#'],
  o: ['....', '....', '....', '.##.', '#..#', '#..#', '.##.'],
  k: ['#...', '#...', '#..#', '#.#.', '##..', '#.#.', '#..#'],
};

/** Width (logical px) of `s` in the script (1 px between letters). */
export function scriptWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += (SCRIPT[ch]?.[0].length ?? 3) + 1;
  return Math.max(0, w - 1) + 2;
}

/** Draw `s` in the script with its top-left at (x, y); `shear` logical px per row (italic). */
export function scriptText(p: Pen, s: string, x: number, y: number, c: Color, shear = 0.3): void {
  const d = p.d;
  let cx = x;
  for (const ch of s) {
    const g = SCRIPT[ch] ?? SCRIPT[' '];
    for (let r = 0; r < g.length; r++) {
      const off = (g.length - 1 - r) * shear;
      for (let i = 0; i < g[r].length; i++) {
        if (g[r][i] !== '#') continue;
        if (d === 1) p.rect(Math.round(cx + i + off), y + r, 1, 1, c);
        else p.disc(cx + i + off + 0.5, y + r + 0.5, 0.66, 0.62, c);
      }
    }
    cx += g[0].length + 1;
  }
}

// ------------------------------------------------------------------------------------ the building

/** White-painted brick (pale at dusk), with faint courses. */
function whiteBrick(p: Pen, seed: number): (X: number, Y: number) => Color {
  const d = p.d;
  const t = gt('cloth', d, 0.32);
  const bh = 3 * d;
  const bw = 6 * d;
  return (X, Y) => {
    const row = Math.floor(Y / bh);
    const xx = X + (row & 1 ? bw >> 1 : 0);
    const v = Y - row * bh;
    let k = 3.6 + (h2(Math.floor(xx / bw), row, seed) - 0.5) * 0.5;
    if (d >= 2 && v === bh - 1) k -= 0.9;
    if (d >= 4 && xx % bw === 0) k -= 0.6;
    if (d >= 4 && h2(X, Y, seed + 3) > 0.94) k -= 0.5;
    return pick(t, dq(k, X, Y, 0.5));
  };
}

function darkBrick(p: Pen, seed: number): (X: number, Y: number) => Color {
  const d = p.d;
  const t = gt('brickDark', d, 0.15);
  const mortar = pick(gt('stone', d, 0.35), 1.4);
  const bh = 3 * d;
  const bw = 6 * d;
  return (X, Y) => {
    const row = Math.floor(Y / bh);
    const xx = X + (row & 1 ? bw >> 1 : 0);
    const u = xx % bw;
    const v = Y - row * bh;
    if (d >= 2 && (v === bh - 1 || (d >= 4 && u === 0))) return mortar;
    if (d === 1 && v === bh - 1 && row % 2 === 0) return mortar;
    let k = 3.2 + (h2(Math.floor(xx / bw), row, seed) - 0.5) * 1.1;
    if (d >= 2 && v === 0) k += 0.5;
    return pick(t, dq(k, X, Y, 0.5));
  };
}

/** The green scalloped window awning (x, y top-left, width w). */
function scallopAwning(p: Pen, x: number, y: number, w: number): void {
  const d = p.d;
  const g = gt('green', d, 0.25);
  const cream = gt('sand', d, 0.25);
  p.poly(
    [
      [x + 1, y],
      [x + w - 1, y],
      [x + w + 1, y + 5],
      [x - 1, y + 5],
    ],
    (X, Y) => pick(g, dq(2.6 - ((Y + 0.5) / d - y) * 0.25 + (d >= 2 && Math.floor(((X + 0.5) / d - x) / 2) % 2 === 0 ? 0.5 : 0), X, Y, 0.5)),
  );
  for (let sx = x - 1; sx < x + w + 1; sx += 3) p.disc(sx + 1.5, y + 5, 1.5, 1.6, (_X, _Y, _u, v) => (v > 0 ? pick(cream, 4.6) : 0));
}

/** A tall window with a cream frame (dark or warm glass). */
function tallWindow(p: Pen, x: number, y: number, w: number, h: number, warm: number, seed: number): void {
  const d = p.d;
  const frame = gt('sand', d, 0.25);
  const glass = gt('night', d, 0.05);
  const cand = tones('candle', d);
  p.rect(x, y, w, h, pick(frame, 4.6));
  p.fill(x + 1, y + 1, w - 2, h - 2, (X, Y) => {
    const v = ((Y + 0.5) / d - y) / h;
    if (warm > 0) {
      // A warm room behind net curtains: brighter high up, a lamp's glow.
      const u = ((X + 0.5) / d - x) / w;
      const k = warm * (3.4 + (1 - Math.abs(u - 0.5) * 2) * 1.6 - v * 1.4);
      return pick(cand, dq(k, X, Y, 0.9));
    }
    return pick(glass, dq(1.4 + (1 - v) * 0.6, X, Y, 0.8));
  });
  const bar = pick(frame, 5);
  p.rect(x + 1, y + h * 0.42, w - 2, d === 1 ? 1 : 0.6, bar);
  p.rect(x + w / 2 - 0.3, y + 1, d === 1 ? 1 : 0.6, h - 2, bar);
  if (warm > 0 && d >= 2) {
    // Net curtains: soft vertical folds.
    for (let fx = x + 1.5; fx < x + w - 1; fx += 2) p.rect(fx, y + 1, 0.5, h - 2, pick(cand, 5.6));
  }
  void seed;
}

function drawSmulhoek(p: Pen): void {
  const d = p.d;
  const W = SMULHOEK_W;
  const H = SMULHOEK_H;
  const yGF = H - GF;
  const yFF = yGF - FF;
  const yC = yFF - CORN;
  const yR = yC - ROOF;
  const cream = gt('plaster', d, 0.14);
  const green = tones('green', d, COLD, 0.08);
  const tilesT = gt('brickDark', d, 0.4);
  const cand = tones('candle', d);

  // ---- the roof: a dark tile hip, the dormer with three windows.
  p.poly(
    [
      [-0.5, yC + 1],
      [12, yR + 4],
      [W - 12, yR + 4],
      [W + 0.5, yC + 1],
    ],
    (X, Y) => {
      const v = (Y + 0.5) / d - yR;
      let k = 1.9 - v / ROOF * 0.8;
      if (d >= 2 && v % 2.5 < 1 / d + 0.01) k -= 0.9;
      if (d >= 4 && h2(Math.floor(X / (3 * d)) + Math.floor(v / 2.5) * 5, 1, 9) > 0.85) k += 0.6;
      return pick(tilesT, dq(k, X, Y, 0.6));
    },
  );
  p.rect(12, yR + 3, W - 24, 1.5, pick(tilesT, 3.2));
  // The dormer: a white box, three windows with dark green frames, a white fascia.
  const dx0 = 42;
  const dw = 40;
  const dy0 = yR - 4;
  const white = gt('cloth', d, 0.3);
  p.rect(dx0, dy0, dw, 18, pick(white, 4));
  p.rect(dx0 - 1.5, dy0 - 1.5, dw + 3, 3, pick(white, 4.8));
  p.rect(dx0 - 1.5, dy0 + 1.2, dw + 3, 0.5 + (d === 1 ? 0.5 : 0), pick(white, 2.4));
  for (let i = 0; i < 3; i++) {
    const wx = dx0 + 3 + i * 12.3;
    p.rect(wx, dy0 + 4, 10, 11, pick(green, 1));
    p.fill(wx + 1, dy0 + 5, 8, 9, (X, Y) => pick(cand, dq(2.2 + (i === 1 ? 0.6 : 0) - ((Y + 0.5) / d - dy0 - 5) * 0.08, X, Y, 0.8)));
    p.rect(wx + 4.7, dy0 + 5, d === 1 ? 1 : 0.6, 9, pick(green, 1.6));
  }

  // ---- the cornice on its consoles
  p.rect(0, yC, W, CORN, pick(cream, 4));
  p.rect(-0.5, yC, W + 1, 2, pick(cream, 5.4));
  p.rect(0, yC + CORN - 1.5, W, 1.5, pick(cream, 2.4));
  if (d >= 2) for (let x = 1; x < W - 1; x += 2.5) p.rect(x, yC + 3, 1.2, 1.5, pick(cream, 2.8));

  // ---- the first floor: corner bays, brick panels, the white centre bay
  const brickSh = darkBrick(p, 3);
  const whiteSh = whiteBrick(p, 5);

  for (const [x0, x1] of [[0, 16], [22, 38], [86, 102], [108, W]] as const) p.fill(x0, yFF, x1 - x0, FF, brickSh);
  p.fill(44, yFF, 36, FF, (X, Y) => {
    // Rusticated white blocks (horizontal channels) in the centre bay.
    const v = (Y + 0.5) / d - yFF;
    return d >= 2 && v % 5 < 0.6 ? pick(white, 2.6) : whiteSh(X, Y);
  });
  // The ground floor's white brick (the shop front comes over it).
  p.fill(0, yGF + 1, W, GF - 1, whiteSh);
  // The angled corner bays are in shade (they turn away from the street).
  p.tint(0, yFF, 16, FF + GF, (_X, _Y, old) => tonesShift(old, -1, d));
  p.tint(108, yFF, 16, FF + GF, (_X, _Y, old) => tonesShift(old, -1, d));
  // Cream pilasters with medallions and the consoles under the cornice.
  for (const px of [16, 38, 80, 102]) {
    p.rect(px, yFF, 6, FF + GF - 3, pick(cream, 4.6));
    p.rect(px, yFF, d === 1 ? 1 : 1 / d, FF + GF - 3, pick(cream, 5.8));
    p.rect(px + 5, yFF, 1, FF + GF - 3, pick(cream, 3));
    if (d >= 2) p.rect(px + 1.5, yFF + 2, 0.5, FF + GF - 8, pick(cream, 3.6));
    p.disc(px + 3, yGF - 9, 2, 2, (_X, _Y, u, v) => (u * u + v * v > 0.5 ? pick(cream, 3.2) : pick(cream, 5)));
    // The console (a scrolled bracket) under the cornice.
    p.rect(px + 0.5, yFF - 3, 5, 3, pick(cream, 5.2));
    p.poly([[px + 1, yFF], [px + 5, yFF], [px + 4, yFF + 5], [px + 2, yFF + 5]], pick(cream, 4.8));
    p.rect(px + 2, yFF + 5, 2, 1, pick(cream, 2.6));
  }
  // The first-floor windows: the corner bays' tall narrow ones (the left one under a green
  // awning), the centre's tall window with its pediment and awning (warm).
  tallWindow(p, 4, yFF + 9, 8, 24, 0, 1);
  scallopAwning(p, 2, yFF + 4, 12);
  tallWindow(p, 112, yFF + 9, 8, 24, 0, 2);
  tallWindow(p, 55, yFF + 12, 14, 24, 1, 3);
  scallopAwning(p, 53, yFF + 7, 18);
  p.poly(
    [
      [52, yFF + 7],
      [62, yFF + 2],
      [72, yFF + 7],
    ],
    pick(cream, 4.4),
  );
  p.rect(52, yFF + 6.5, 20, 1, pick(cream, 2.6));
  // The first-floor ledge (sill course) over the shop.
  p.rect(0, yGF - 2, W, 3, pick(cream, 4));
  p.rect(0, yGF - 2, W, d === 1 ? 1 : 0.6, pick(cream, 5.6));
  p.rect(0, yGF + 0.6, W, 0.8, pick(cream, 2.2));
  // Blind panels (recessed rectangles) in the white walls beside the shop.
  for (const [x0, w] of [[4, 9], [25, 10], [89, 10], [111, 9]] as const) {
    p.rect(x0, yGF + 18, w, 22, pick(white, 3));
    p.rect(x0 + 1, yGF + 19, w - 2, 20, pick(white, 3.8));
    if (d >= 2) p.rect(x0 + 1, yGF + 19, w - 2, 0.5, pick(white, 2.2));
  }
  // ---- the shop: the sign board over the three doors between the middle pilasters
  const sbx = 30;
  const sbw = 64;
  const sby = yGF + 4;
  p.rect(sbx, sby, sbw, 12, pick(green, 0.8));
  p.rect(sbx, sby, sbw, d === 1 ? 1 : 0.6, pick(green, 2.6));
  p.rect(sbx, sby + 11, sbw, 1, pick(green, 0.2));
  if (d >= 2) {
    p.rect(sbx + 1, sby + 1.2, sbw - 2, 0.4, pick(cream, 3.4));
    p.rect(sbx + 1, sby + 10.2, sbw - 2, 0.4, pick(cream, 3.4));
  }
  const scriptC = snap(T('sand', 6, d), d);
  const tw = scriptWidth(SMULHOEK_SIGN);
  scriptText(p, SMULHOEK_SIGN, sbx + (sbw - tw) / 2 + 0.5, sby + 2.5, scriptC);
  const fy = sby + 14;
  const fh = H - 3 - fy;
  // Left: the green door with glass (stickers), warm through the glass.
  const g1 = 44;
  p.rect(g1, fy, 11, fh, pick(green, 2));
  p.fill(g1 + 1.5, fy + 2, 8, fh - 9, (X, Y) => {
    const v = ((Y + 0.5) / d - fy) / fh;
    const st = d >= 2 && h2(Math.floor(X / (2 * d)), Math.floor(Y / (2 * d)), 4) > 0.82 && v < 0.6;
    return st ? pick(gt('sky', d, 0.5), 3) : pick(cand, dq(3.6 - v * 1.6, X, Y, 0.8));
  });
  p.rect(g1, fy, 11, 1, pick(green, 3.4));
  if (d >= 2) p.rect(g1 + 8.5, fy + fh * 0.55, 1, 1, F('gold', 0.6, d));
  // Middle: the open door (the warm shop, the counter inside) — Meneer Wu's spot.
  const ox = SMULHOEK_DOOR_X - SMULHOEK_DOOR_W / 2;
  p.rect(ox - 1, fy, SMULHOEK_DOOR_W + 2, fh, pick(green, 2.2));
  p.fill(ox, fy + 1, SMULHOEK_DOOR_W, fh - 1, (X, Y) => {
    const v = ((Y + 0.5) / d - fy) / fh;
    const u = ((X + 0.5) / d - ox) / SMULHOEK_DOOR_W;
    if (v > 0.62 && v < 0.7) return pick(gt('stone', d, 0.2), 4.4); // the counter's top
    if (v >= 0.7) return pick(gt('wood', d, 0.2), dq(2.6 - (v - 0.7) * 3, X, Y, 0.8)); // the counter
    // The warm room: a glowing back wall, the menu strip, a lamp.
    if (v < 0.16 && d >= 2 && Math.floor(u * 6) % 2 === 0) return pick(cand, 5);
    return pick(cand, dq(5 - v * 2.2 - Math.abs(u - 0.5) * 1.2, X, Y, 0.8));
  });
  // Right: the poster door (a bright picture of fries and a snack).
  const g3 = 68.5;
  p.rect(g3, fy, 11.5, fh, pick(white, 4.4));
  p.rect(g3 + 1.5, fy + 2, 8.5, fh - 8, pick(cand, 4));
  p.disc(g3 + 5.75, fy + 9, 3.5, 4, (_X, _Y, u, v) => (v < 0.2 ? pick(gt('gold', d, 0.1), 5 - (u + 1) * 0.6) : pick(gt('red', d, 0.2), 4)));
  for (let k = 0; k < 4; k++) p.rect(g3 + 3.2 + k * 1.5, fy + 4 - (k % 2), 0.9, 5, pick(gt('gold', d, 0.1), 6));
  if (d >= 2) p.rect(g3 + 9.5, fy + fh * 0.55, 1, 1, F('gold', 0.5, d));
  // The plinth: a dark green band at the foot of the whole ground floor.
  p.rect(0, H - 3, W, 3, pick(green, 0.6));
  p.rect(0, H - 3, W, d === 1 ? 1 : 0.5, pick(green, 1.8));
  // Small wall lamps on the pilasters beside the shop (warm).
  for (const lx of [41, 83]) {
    p.rect(lx - 1, yGF + 20, 2, 3, pick(gt('black', d), 1.2));
    p.disc(lx, yGF + 24.5, 1.4, 1.6, T('candle', 6, d));
  }
  outlineC(p);
}

/** A colour stepped k tones along its graded ramp (the corner bays' shade). */
function tonesShift(c: Color, k: number, d: Dn): Color {
  void d;
  for (const n of ['cloth', 'brickDark', 'sand', 'green', 'night', 'candle'] as const) {
    const t = gt(n, d);
    const i = t.indexOf(c >>> 0);
    if (i >= 0) return t[Math.max(0, Math.min(t.length - 1, i + k))];
  }
  return c;
}

reg('decor/oz/smulhoek', [{ w: SMULHOEK_W, h: SMULHOEK_H, ox: 0, oy: SMULHOEK_H }], (p) => drawSmulhoek(p));

// ------------------------------------------------------------------------------------ props

/** The A-frame menu board (anchor bottom-centre). */
reg('decor/oz/menu-board', [{ w: 24, h: 26, ox: 12, oy: 26 }], (p) => {
  const d = p.d;
  const wood = gt('wood', d, 0.3);
  const slate = gt('black', d, 0.1);
  const chalk = snap(T('snow', 4, d), d);
  p.poly(
    [
      [3, 2],
      [21, 2],
      [23, 26],
      [1, 26],
    ],
    pick(wood, 2.6),
  );
  p.rect(3, 4, 18, 18, pick(slate, 1.2));
  tinyText(p, 'MENU', 3, 5, chalk);
  // A tray of fries and a frikandel in chalk, two price lines.
  p.rect(8, 13, 7, 3, pick(gt('gold', d, 0.15), 5));
  for (let k = 0; k < 4; k++) p.rect(8.5 + k * 1.6, 11 - (k % 2), 0.9, 3, pick(gt('gold', d, 0.15), 6));
  p.rect(5, 18, 13, d === 1 ? 1 : 0.5, chalk);
  p.rect(5, 20, 10, d === 1 ? 1 : 0.5, chalk);
  if (d >= 2) p.rect(3, 2, 18, 0.5, pick(wood, 4));
  outlineC(p);
});

/** The closed parasol (anchor bottom-centre). */
reg('decor/oz/parasol', [{ w: 14, h: 60, ox: 7, oy: 60 }], (p) => {
  const d = p.d;
  const cloth = gt('stone', d, 0.25);
  const steel = gt('steel', d, 0.2);
  p.rect(6.5, 2, 1, 56, pick(steel, 3));
  p.poly(
    [
      [7, 3],
      [10.5, 18],
      [11, 36],
      [8.5, 44],
      [5.5, 44],
      [3, 36],
      [3.5, 18],
    ],
    (X) => pick(cloth, (X + 0.5) / d < 7 ? 3.2 : 2),
  );
  if (d >= 2) {
    for (const fx of [5, 7.5, 9.5]) p.line(7, 6, fx, 43, pick(cloth, 1.2));
    p.rect(3.5, 30, 7, 1, pick(gt('black', d), 1.4));
  }
  p.rect(2, 57, 10, 3, pick(gt('black', d), 1.6));
  p.disc(7, 2, 1, 1, pick(steel, 4));
  outlineC(p);
});

/** The low terrace screen with the name (anchor bottom-left). */
reg('decor/oz/smulhoek-screen', [{ w: 62, h: 22, ox: 0, oy: 22 }], (p) => {
  const d = p.d;
  const cream = gt('sand', d, 0.25);
  const steel = gt('black', d, 0.15);
  const glass = gt('night', d, 0.4);
  p.rect(1, 1, 60, 9, pick(glass, 3));
  if (d >= 2) p.line(4, 9, 12, 1, pick(glass, 5));
  p.rect(1, 10, 60, 11, pick(cream, 4.6));
  p.rect(1, 10, 60, d === 1 ? 1 : 0.5, pick(cream, 5.8));
  scriptText(p, SMULHOEK_SIGN, 1.5 + (60 - scriptWidth(SMULHOEK_SIGN)) / 2, 12, pick(gt('green', d, 0.2), 1.2), 0.3);
  for (const x of [0, 60]) p.rect(x, 0, 2, 22, pick(steel, 2));
  outlineC(p);
});
