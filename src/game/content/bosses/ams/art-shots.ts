/**
 * ROBO-HALSEMA — projectile art (centre anchors; the moving strips are drawn moving LEFT).
 *
 * `boss/ams-mayor/stamp-wave` (2, a 16-px wave of red stamp ink and dust), `noise-letter` (4:
 * open while rising, then 3 tumbling envelopes with a red NOISE mark), `shield-shot` (2, a
 * spinning enamel shield).
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import { defineSprite } from '../../../../engine/sprites';

const ART = 'boss/ams-mayor';

defineSprite(
  `${ART}/stamp-wave`,
  () =>
    [0, 1].map((p) => {
      const b = new PixelBuffer(20, 18);
      // A curling ink wave (front at the left), dust behind.
      b.poly([[2, 17], [4, 8 + p], [8, 3], [13, 2 + p], [12, 7], [16, 11], [19, 17]], PAL.red[2]);
      b.poly([[5, 16], [7, 9 + p], [10, 6], [12, 9], [15, 16]], PAL.red[3]);
      b.line(6, 6 + p, 10, 3, PAL.pink[2]);
      b.rect(15, 13 - p, 2, 2, PAL.stone[2]);
      b.rect(17, 10 + p, 2, 2, PAL.stone[1]);
      b.hline(1, 18, 17, PAL.red[1]);
      return { buf: b.outline(INK), ox: 10, oy: 10 };
    }),
  { ticksPerFrame: 3 },
);

defineSprite(
  `${ART}/noise-letter`,
  () =>
    [0, 1, 2, 3].map((p) => {
      const b = new PixelBuffer(16, 14);
      if (p === 0) {
        // Flap open, the letter half out.
        b.rect(3, 2, 10, 6, PAL.cloth[3]);
        b.line(4, 4, 11, 4, PAL.stone[2]);
        b.line(4, 6, 9, 6, PAL.stone[2]);
        b.rect(2, 6, 12, 7, PAL.snow[2]);
        b.line(2, 6, 8, 10, PAL.stone[2]);
        b.line(13, 6, 8, 10, PAL.stone[2]);
        b.rect(9, 10, 2, 2, PAL.red[2]);
      } else {
        const tilt = p - 2; // −1, 0, 1
        const pts: Array<[number, number]> = [
          [2, 4 + tilt],
          [13, 4 - tilt],
          [13, 11 - tilt],
          [2, 11 + tilt],
        ];
        b.poly(pts, PAL.snow[2]);
        b.line(2, 4 + tilt, 7, 8, PAL.stone[2]);
        b.line(13, 4 - tilt, 8, 8, PAL.stone[2]);
        // The red stamp mark (a crossed-out speaker note).
        b.rect(9, 8, 3, 2, PAL.red[2]);
        b.set(10, 7, PAL.red[2]);
      }
      return { buf: b.outline(INK), ox: 8, oy: 7 };
    }),
  { ticksPerFrame: 6 },
);

defineSprite(
  `${ART}/shield-shot`,
  () =>
    [0, 1].map((p) => {
      const b = new PixelBuffer(11, 12);
      const w = p === 0 ? 7 : 4;
      const x0 = 5 - (w >> 1);
      b.rect(x0 - 1, 1, w + 2, 7, PAL.snow[2]);
      b.rect(x0, 2, w, 6, p === 0 ? PAL.red[2] : PAL.sky[2]);
      b.line(x0, 8, 5, 10, PAL.snow[2]);
      b.line(x0 + w - 1, 8, 5, 10, PAL.snow[2]);
      b.line(x0 + 1, 8, 5, 9, p === 0 ? PAL.red[2] : PAL.sky[2]);
      if (p === 0) {
        b.set(5, 4, PAL.snow[3]);
        b.set(4, 3, PAL.snow[3]);
        b.set(6, 5, PAL.snow[3]);
        b.set(6, 3, PAL.snow[3]);
        b.set(4, 5, PAL.snow[3]);
      }
      b.set(x0, 2, PAL.snow[3]);
      return { buf: b.outline(INK), ox: 5, oy: 5 };
    }),
  { ticksPerFrame: 4 },
);
