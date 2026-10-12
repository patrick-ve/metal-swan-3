/**
 * Mission m5 sprites (procedural, palette only, original designs):
 *
 * - `decor/m5/organ-distant`  3 frames = 3 sizes (small, mid, large) of the flying Grand Organ seen
 *                             far away at dusk (anchor centre). m5-a decor from @3000.
 * - `decor/m5/hatch`          the landing hatch in the ceiling of m5-b (anchor top-left, 112×22).
 * - `decor/m5/door`           2 frames closed / open: the brass exit door at the bottom of m5-b
 *                             (anchor feet, 84×52).
 * - `decor/m5/tier-<w>`       the console keyboards of m5-c as one-way platforms, w = 180 / 150 / 120
 *                             (anchor top-left = the standing surface; 12 px tall).
 */
import type { Color } from '../../../../engine/color';
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';

// ---------------------------------------------------------------------------------------------
// organ-distant
// ---------------------------------------------------------------------------------------------

/**
 * The Grand Organ far away: a carved cabinet with three pipe clusters, a rose window, a horn,
 * pumping bellows at the sides and two propellers under it. Drawn on a 128×100 design grid
 * scaled by `s` (hazy dusk colours: it is far).
 */
function organDistant(s: number): Frame {
  const W = Math.round(128 * s) + 2;
  const H = Math.round(100 * s) + 2;
  const b = new PixelBuffer(W, H);
  const R = (x: number, y: number, w: number, h: number, c: Color): void => {
    const x0 = Math.round(x * s) + 1;
    const y0 = Math.round(y * s) + 1;
    const x1 = Math.round((x + w) * s) + 1;
    const y1 = Math.round((y + h) * s) + 1;
    b.rect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0), c);
  };
  const body = PAL.purple[0];
  const lit = PAL.purple[1];
  const pipeC = PAL.pink[0];
  const pipeLit = PAL.pink[1];
  // Propeller pods under the cabinet.
  R(14, 86, 20, 6, PAL.navy[1]);
  R(94, 86, 20, 6, PAL.navy[1]);
  R(8, 92, 32, 2, PAL.steel[1]);
  R(88, 92, 32, 2, PAL.steel[1]);
  // Bellows at the sides (accordion folds).
  for (let k = 0; k < 4; k++) {
    R(8 + (k % 2) * 2, 44 + k * 9, 16, 8, k % 2 ? PAL.purple[1] : PAL.purple[0]);
    R(104 - (k % 2) * 2, 44 + k * 9, 16, 8, k % 2 ? PAL.purple[1] : PAL.purple[0]);
  }
  // Cabinet.
  R(22, 34, 84, 56, body);
  R(22, 34, 4, 56, lit);
  R(22, 34, 84, 3, lit);
  R(22, 86, 84, 4, PAL.navy[0]);
  // Pipe clusters: top (tall, middle), mid (left), low (right).
  const cluster = (x: number, y: number, n: number, tall: number): void => {
    for (let j = 0; j < n; j++) {
      const arch = 1 - Math.abs(j - (n - 1) / 2) / n;
      const h = Math.round(tall * (0.5 + 0.5 * arch));
      R(x + j * 6, y - h, 5, h, pipeC);
      R(x + j * 6, y - h, 2, h, pipeLit);
    }
  };
  cluster(40, 36, 9, 34);
  cluster(26, 60, 3, 14);
  cluster(86, 60, 3, 14);
  // Rose window (glowing) above the horn.
  b.circle(Math.round(64 * s) + 1, Math.round(50 * s) + 1, Math.max(1, Math.round(9 * s)), PAL.pink[2]);
  if (s >= 0.5) {
    b.circle(Math.round(64 * s) + 1, Math.round(50 * s) + 1, Math.max(1, Math.round(5 * s)), PAL.gold[2]);
    b.circle(Math.round(64 * s) + 1, Math.round(50 * s) + 1, Math.max(1, Math.round(2 * s)), PAL.gold[3]);
  }
  // The loudspeaker horn (shutters closed) and lit windows.
  R(54, 64, 20, 16, PAL.gold[0]);
  R(56, 66, 16, 12, PAL.navy[1]);
  for (let k = 0; k < 4; k++) R(30 + k * 20 + (k > 1 ? 16 : 0), 72, 3, 4, PAL.gold[2]);
  return { buf: b.outline(INK), ox: Math.floor((W + 2) / 2), oy: Math.floor((H + 2) / 2) };
}

defineSprite('decor/m5/organ-distant', () => [organDistant(0.3), organDistant(0.55), organDistant(0.95)]);

// ---------------------------------------------------------------------------------------------
// hatch (m5-b ceiling) and door (m5-b exit)
// ---------------------------------------------------------------------------------------------

defineSprite(
  'decor/m5/hatch',
  () => {
    const b = new PixelBuffer(112, 22);
    // The night sky through the open hatch, a brass rim and two folded lids.
    b.rect(8, 0, 96, 12, PAL.navy[0]);
    b.set(30, 3, PAL.snow[2]);
    b.set(71, 6, PAL.snow[1]);
    b.set(88, 2, PAL.snow[2]);
    b.rect(0, 12, 112, 6, PAL.gold[1]);
    b.hline(0, 111, 12, PAL.gold[3]);
    b.hline(0, 111, 17, PAL.gold[0]);
    for (let x = 4; x < 112; x += 10) b.set(x, 14, PAL.brown[1]);
    b.rect(0, 0, 8, 12, PAL.steel[1]);
    b.rect(104, 0, 8, 12, PAL.steel[1]);
    b.vline(7, 0, 11, PAL.steel[3]);
    b.vline(104, 0, 11, PAL.steel[0]);
    b.rect(2, 18, 108, 4, PAL.ink[1]);
    return { buf: b.outline(INK, {}), ox: 0, oy: 0 };
  },
  { anchor: 'top-left' },
);

function door(open: boolean): Frame {
  const W = 86;
  const H = 54;
  const b = new PixelBuffer(W, H);
  // Arch frame: brass.
  b.roundRect(1, 1, 84, 53, 14, PAL.gold[1]);
  b.roundRect(3, 3, 80, 51, 12, PAL.gold[0]);
  if (open) {
    b.roundRect(6, 6, 74, 48, 10, INK);
    // Light at the end of the passage (the console room glows).
    b.rect(30, 26, 26, 28, PAL.red[0]);
    b.rect(36, 30, 14, 24, PAL.gold[0]);
    b.rect(40, 34, 6, 20, PAL.gold[2]);
    // The folded leaves at the sides.
    b.rect(6, 12, 6, 42, PAL.brown[1]);
    b.rect(74, 12, 6, 42, PAL.brown[1]);
  } else {
    b.roundRect(6, 6, 74, 48, 10, PAL.brown[1]);
    b.vline(42, 6, 53, INK);
    b.vline(43, 6, 53, PAL.brown[0]);
    // Carved panels and gold studs; a treble clef handle on each leaf.
    for (const x of [12, 48]) {
      b.strokeRect(x, 16, 26, 14, PAL.brown[2]);
      b.strokeRect(x, 34, 26, 16, PAL.brown[2]);
      b.rect(x + 1, 17, 24, 12, PAL.brown[0]);
      b.rect(x + 1, 35, 24, 14, PAL.brown[0]);
    }
    for (let y = 10; y < 54; y += 8) {
      b.set(8, y, PAL.gold[2]);
      b.set(77, y, PAL.gold[2]);
    }
    b.circle(38, 32, 2, PAL.gold[2]);
    b.circle(47, 32, 2, PAL.gold[2]);
  }
  // Keystone.
  b.rect(38, 0, 10, 5, PAL.gold[2]);
  b.hline(38, 47, 0, PAL.gold[3]);
  return { buf: b.outline(INK), ox: 43, oy: 54 };
}

defineSprite('decor/m5/door', () => [door(false), door(true)]);

// ---------------------------------------------------------------------------------------------
// console tiers (m5-c)
// ---------------------------------------------------------------------------------------------

/** A keyboard platform: ivory keys on top (the standing line), black keys, a walnut case, gold trim. */
function tier(w: number): Frame {
  const H = 12;
  const b = new PixelBuffer(w, H);
  // Ivory key fronts: 6 px keys with a dark gap.
  b.rect(0, 0, w, 4, PAL.cloth[2]);
  b.hline(0, w - 1, 0, PAL.cloth[3]);
  b.hline(0, w - 1, 3, PAL.cloth[1]);
  for (let x = 5; x < w; x += 6) b.vline(x, 0, 3, PAL.stone[2]);
  // Black keys (groups of 2 and 3 like a real keyboard pattern of 7 white keys).
  for (let x = 0, k = 0; x + 6 < w; x += 6, k++) {
    const n = k % 7;
    if (n === 2 || n === 6) continue;
    b.rect(x + 4, 0, 3, 2, INK);
  }
  // Walnut case with a gold rail.
  b.rect(0, 4, w, 8, PAL.brown[1]);
  b.hline(0, w - 1, 4, PAL.gold[2]);
  b.hline(0, w - 1, 5, PAL.gold[0]);
  b.hline(0, w - 1, 11, PAL.brown[0]);
  for (let x = 8; x < w - 4; x += 24) {
    b.rect(x, 7, 12, 3, PAL.brown[0]);
    b.set(x + 6, 8, PAL.gold[1]);
  }
  b.vline(0, 4, 11, PAL.brown[2]);
  b.vline(w - 1, 4, 11, PAL.brown[0]);
  return { buf: b, ox: 0, oy: 0 };
}

for (const w of [180, 150, 120]) defineSprite(`decor/m5/tier-${w}`, () => tier(w), { anchor: 'top-left' });
