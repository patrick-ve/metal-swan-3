/**
 * Snore for the player's time-out sleep (anim wave p2, plan Phase 2 row 15): `fx/snore`, 6
 * frames × 8 ticks, loop, deferred (a rare strip). Little "z" letters (white, ink outline) rise
 * up and forward from the sleeper's head, growing from 3 to 5 px, and fade at the top. The HD
 * twins (2× and 4×, fx/hd/small.ts `snoreHd`) draw the same letters as lit strokes.
 *
 * Anchor: bottom-left of the frame box (put it at the head point).
 */
import type { Color } from '../../../engine/color';
import { PixelBuffer } from '../../../engine/pixel';
import { INK, PAL } from '../../../engine/palette';
import type { Frame } from '../../../engine/render';
import { defineSprite } from '../../../engine/sprites';
import { snoreHd } from './hd/small';

const W = 16;
const H = 18;
const FRAMES = 6;

/** One "z" of size s (3..5) with its top-left at (x, y), logical px, at density d. */
function zed(b: PixelBuffer, x: number, y: number, s: number, c: Color, d: number): void {
  const px = (X: number, Y: number, col: Color, o = 0): void => {
    b.rect((x + X) * d - o, (y + Y) * d - o, d + 2 * o, d + 2 * o, col);
  };
  const cells: Array<[number, number]> = [];
  for (let i = 0; i < s; i++) cells.push([i, 0], [i, s - 1]);
  for (let i = 1; i < s - 1; i++) cells.push([s - 1 - i, i]);
  // Ink ring first (1 logical px at 1×, 1 buffer px at 2×), then the letter.
  for (const [X, Y] of cells) {
    if (d === 1) for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) px(X + ox, Y + oy, INK);
    else px(X, Y, INK, 1);
  }
  for (const [X, Y] of cells) px(X, Y, c);
}

/** Frame i: three letters on a rising path, phase-shifted by 2 frames each. */
function snoreFrame(i: number, d: number): Frame {
  const b = new PixelBuffer(W * d, H * d);
  for (let k = 0; k < 3; k++) {
    const t = (i + k * 2) % FRAMES; // 0..5 along the path
    const s = t < 2 ? 3 : t < 4 ? 4 : 5;
    const x = 1 + t * 2;
    const y = H - 5 - t * 2 - (s - 3);
    const c = t === 5 ? PAL.sky[2] : PAL.snow[3];
    zed(b, x, y, s, c, d);
  }
  return { buf: b.touch(), ox: 0, oy: H, ...(d > 1 ? { density: d } : {}) };
}

// HD art (2× and 4×): fx/hd/small.ts `snoreHd` (lit letters, outline A).
defineSprite('fx/snore', () => Array.from({ length: FRAMES }, (_, i) => snoreFrame(i, 1)), {
  ticksPerFrame: 8,
  defer: true,
  hd: (d) => snoreHd('fx/snore', d),
});
