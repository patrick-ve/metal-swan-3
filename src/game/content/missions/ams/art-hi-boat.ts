/**
 * 2× twin of `decor/ams/ams-boat-platform` (docs/ART_GUIDE.md "2x art (mission ams)"): the small
 * open canal boat that carries the player (1× art `smallBoat` in npc.art.ts). The same 64 × 22
 * logical frame, top-left anchor and shapes at the same logical places (1× pixel (x, y) is the
 * 2 × 2 block at (2x, 2y)), the 2 hi-res px INK outline, with the finer detail the 2× grid allows:
 * a lit gunwale, hull planks with 1 hi-res px seams and nail heads, a lit edge on the teal stripe,
 * the outboard motor's cowl seam and lit side, a round fender with a glint and finer foam.
 */
import { INK, PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineHiSprite } from '../../../../engine/sprites';
import { HI, outlineHi } from '../../../art/hi';
import './npc.art';

function smallBoatHi(phase: number): Frame {
  const b = new PixelBuffer(64 * HI, 22 * HI);
  // Hull (1× poly (2, 3) (61, 3) (57, 13) (8, 13)).
  b.poly([[4, 6], [123, 6], [115, 27], [16, 27]], PAL.brown[2]);
  // Planks: 1 hi-res px seams between the 1× bands, short butt joints, a nail at each joint.
  for (const Y of [12, 19, 23]) {
    for (let X = 0; X < b.w; X++) if ((b.get(X, Y) & 255) !== 0) b.set(X, Y, PAL.brown[1]);
  }
  for (let X = 20; X < 112; X += 22) {
    b.vline(X, 13, 15, PAL.brown[1]);
    b.set(X + 1, 13, PAL.brown[3]);
    b.vline(X + 9, 24, 25, PAL.brown[1]);
  }
  // The gunwale: the 1× cloth rim with a lit top, then the lit inner edge of the hull.
  b.hline(4, 123, 6, PAL.cloth[3]);
  b.hline(4, 123, 7, PAL.cloth[2]);
  b.set(4, 6, PAL.snow[3]);
  b.hline(6, 121, 8, PAL.brown[3]);
  b.hline(6, 121, 9, PAL.brown[3]);
  for (let X = 10; X < 120; X += 12) b.set(X, 9, PAL.brown[2]);
  // 1× row 8: the darker plank, row 10: the teal stripe with a lit top, row 12: the keel shadow.
  b.hline(10, 119, 16, PAL.brown[1]);
  b.hline(10, 119, 17, PAL.brown[1]);
  b.hline(12, 117, 20, PAL.teal[3]);
  b.hline(12, 117, 21, PAL.teal[2]);
  b.hline(16, 115, 24, PAL.brown[0]);
  b.hline(16, 115, 25, PAL.brown[0]);
  // Outboard motor at the stern: a lit left side, a cowl seam, the shaft and the prop.
  b.rect(2, 0, 8, 12, PAL.steel[2]);
  b.hline(2, 9, 0, PAL.steel[3]);
  b.hline(2, 9, 1, PAL.steel[3]);
  b.vline(2, 0, 11, PAL.steel[3]);
  b.vline(9, 2, 11, PAL.steel[1]);
  b.hline(3, 8, 5, PAL.steel[1]);
  b.set(4, 3, PAL.snow[3]);
  b.vline(6, 12, 29, PAL.steel[2]);
  b.vline(7, 12, 29, PAL.steel[1]);
  b.rect(5, 28, 4, 2, PAL.steel[1]);
  // Bow fender (1× circle (59, 6), r 1) with a glint.
  b.ellipse(116, 10, 6, 6, PAL.cloth[2]);
  b.set(117, 11, PAL.cloth[3]);
  b.set(120, 14, PAL.cloth[1]);
  outlineHi(b, 2, INK);
  // Wake (no outline): foam dashes (1× 4 px), the sky-blue wash with ripple dashes.
  const foam = phase ? [[0, 15], [58, 14], [52, 15]] : [[2, 14], [60, 15], [48, 15]];
  for (const [x, y] of foam) {
    const x1 = Math.min(b.w - 1, x * HI + 7);
    b.hline(x * HI, x1, y * HI, PAL.snow[3]);
    b.hline(x * HI + 1, x1, y * HI + 1, PAL.snow[2]);
  }
  b.hline(20, 109, 30, PAL.sky[2]);
  for (let X = 20; X <= 109; X++) if ((X + phase * 5) % 9 < 5) b.set(X, 31, PAL.sky[3]);
  return { buf: b, ox: 32, oy: 2, density: HI };
}

defineHiSprite('decor/ams/ams-boat-platform', () => [smallBoatHi(0), smallBoatHi(1)]);
