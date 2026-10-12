/**
 * THE WINDBAG — projectile art (GDD §10.3, §15.4). Centre anchors.
 *
 * - `boss/windbag/homing-note`  a fat black eighth note with a gold rim, pulsing pink aura (2)
 * - `boss/windbag/sheet-mine`   a page of sheet music fluttering down, its red wax fuse blinking (4)
 * - `boss/windbag/reel-note`    a small silver note of the Reel (2)
 * - `boss/windbag/reel-burst`   the Reel note hitting the deck (anchor = bottom centre), 3
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import { defineSprite } from '../../../../engine/sprites';

defineSprite(
  'boss/windbag/homing-note',
  () =>
    [0, 1].map((f) => {
      const b = new PixelBuffer(16, 18);
      // Aura (one ring of pink pixels, every other frame).
      if (f === 0) {
        b.ellipse(1, 9, 11, 8, PAL.pink[1]);
        b.vline(13, 1, 12, PAL.pink[1]);
        b.vline(11, 1, 12, PAL.pink[1]);
      }
      // Head: a tilted oval, black with a gold glint.
      b.ellipse(2, 10, 9, 6, PAL.black[1]);
      b.hline(4, 7, 10, PAL.black[3]);
      b.set(4, 11, PAL.gold[3]);
      // Stem and flag.
      b.rect(9, 2, 2, 11, PAL.black[1]);
      b.vline(9, 2, 12, PAL.black[2]);
      b.line(11, 2, 14, 6, PAL.black[1]);
      b.line(11, 3, 14, 7, PAL.black[1]);
      b.line(12, 2, 14, 4, PAL.gold[2]);
      b.outline(INK);
      return { buf: b, ox: 8, oy: 9 };
    }),
  { ticksPerFrame: 6 },
);

defineSprite(
  'boss/windbag/sheet-mine',
  () =>
    [12, 9, 4, 9].map((w, f) => {
      const b = new PixelBuffer(15, 17);
      const x0 = Math.floor((15 - w) / 2);
      const tilt = f === 1 ? 1 : f === 3 ? -1 : 0;
      for (let y = 1; y < 15; y++) {
        const sh = Math.round(tilt * (y - 8) * 0.15);
        const c = f === 2 ? PAL.cloth[1] : y < 3 ? PAL.snow[3] : PAL.cloth[3];
        b.hline(x0 + sh, x0 + sh + w - 1, y, c);
      }
      if (w > 5) {
        // Staff lines and two notes.
        for (const y of [4, 6, 8, 10]) b.hline(x0 + 1, x0 + w - 2, y, PAL.steel[2]);
        b.rect(x0 + 2, 7, 2, 2, PAL.ink[1]);
        b.vline(x0 + 3, 3, 7, PAL.ink[1]);
        b.rect(x0 + w - 5, 9, 2, 2, PAL.ink[1]);
        b.vline(x0 + w - 4, 5, 9, PAL.ink[1]);
      }
      // The fuse: a red wax seal in the bottom corner (lit on frames 0 and 2).
      const fx = x0 + w - 3;
      b.rect(fx, 12, 2, 2, f % 2 === 0 ? PAL.red[3] : PAL.red[1]);
      if (f % 2 === 0) b.set(fx, 12, PAL.gold[3]);
      b.outline(INK);
      return { buf: b, ox: 7, oy: 8 };
    }),
  { ticksPerFrame: 6 },
);

defineSprite(
  'boss/windbag/reel-note',
  () =>
    [0, 1].map((f) => {
      const b = new PixelBuffer(10, 11);
      b.ellipse(1, 6, 6, 4, f === 0 ? PAL.snow[3] : PAL.snow[2]);
      b.set(2, 7, PAL.snow[3]);
      b.vline(6, 1, 7, PAL.snow[1]);
      b.line(6, 1, 8, 3, PAL.snow[1]);
      b.outline(INK);
      return { buf: b, ox: 4, oy: 6 };
    }),
  { ticksPerFrame: 4 },
);

defineSprite(
  'boss/windbag/reel-burst',
  () =>
    [0, 1, 2].map((f) => {
      const b = new PixelBuffer(20, 16);
      const r = 3 + f * 3;
      // A splash of sound: short rays up and to the sides, a bright core on the deck.
      for (let k = 0; k < 5; k++) {
        const a = Math.PI + (k * Math.PI) / 4;
        const x0 = 10 + Math.round(Math.cos(a) * (r - 2));
        const y0 = 15 + Math.round(Math.sin(a) * (r - 2));
        const x1 = 10 + Math.round(Math.cos(a) * r);
        const y1 = 15 + Math.round(Math.sin(a) * r);
        b.line(x0, y0, x1, y1, f === 2 ? PAL.snow[1] : PAL.snow[3]);
      }
      if (f < 2) b.rect(8, 13 - f, 4, 2 + f, f === 0 ? PAL.snow[3] : PAL.teal[3]);
      b.outline(INK);
      return { buf: b, ox: 10, oy: 16 };
    }),
  { ticksPerFrame: 3, loop: false },
);
