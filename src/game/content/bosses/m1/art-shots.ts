/**
 * THE ENCORE — projectile art (GDD §15.4 ids; centre anchors, moving LEFT is the flipped look
 * for the anim strips, so they are drawn moving left and the shots flip them for vx > 0).
 *
 * `boss/encore/steam-note` (2), `steam-puff` (3, 26×18 lethal cloud), `foghorn-wave` (2, a band
 * of sonic arcs), `paddle-wave` (3, a 24-px river wave), `barrel` (4, rolling end view),
 * `soot-ball` (2), `brass-pellet` (2).
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import { defineSprite } from '../../../../engine/sprites';

const C = 'center' as const;

/** A note of steam: a white note head and stem, a curling wisp behind. */
defineSprite(
  'boss/encore/steam-note',
  () =>
    [0, 1].map((p) => {
      const b = new PixelBuffer(16, 18);
      // Wisp trailing up-right.
      b.circle(11, 4 + p, 2, PAL.snow[1]);
      b.circle(13, 2 + p, 1, PAL.snow[0]);
      // Head + stem + flag.
      b.ellipse(2, 10, 8, 6, PAL.snow[3]);
      b.set(3, 11, PAL.snow[2]);
      b.hline(4, 7, 15, PAL.snow[1]);
      b.vline(9, 3, 12, PAL.snow[3]);
      b.line(9, 3, 12, 6 + p, PAL.snow[3]);
      b.line(10, 3, 12, 5 + p, PAL.snow[2]);
      return { buf: b.outline(INK), ox: 6, oy: 12 };
    }),
  { ticksPerFrame: 6 },
);

/** The scalding steam puff a note leaves behind (lethal for 20 ticks). */
defineSprite(
  'boss/encore/steam-puff',
  () =>
    [0, 1, 2].map((p) => {
      const b = new PixelBuffer(28, 20);
      const blobs: Array<[number, number, number]> = [
        [7, 12, 5],
        [14, 10, 6 + (p === 1 ? 1 : 0)],
        [21, 12, 5],
        [11, 6 - p, 3 + p],
        [18, 6 - p, 3],
      ];
      for (const [x, y, r] of blobs) b.circle(x, y, r, PAL.snow[1]);
      for (const [x, y, r] of blobs) b.circle(x - 1, y - 1, Math.max(1, r - 2), PAL.snow[2]);
      for (const [x, y, r] of blobs) if (r > 3) b.circle(x - 2, y - 2, 1, PAL.snow[3]);
      // Hot pink core (scalding).
      b.hline(10, 17, 15, PAL.pink[2]);
      b.hline(12, 15, 16, PAL.pink[1]);
      return { buf: b.outline(INK), ox: 14, oy: 12 };
    }),
  { ticksPerFrame: 7, loop: true },
);

/** Sonic band: three gold arcs bulging left (the direction of travel), 16 px tall. */
defineSprite(
  'boss/encore/foghorn-wave',
  () =>
    [0, 1].map((p) => {
      const b = new PixelBuffer(20, 22);
      for (let k = 0; k < 3; k++) {
        const x0 = 3 + k * 5 + (p && k === 1 ? 1 : 0);
        const col = k === 0 ? PAL.gold[3] : k === 1 ? PAL.orange[2] : PAL.orange[1];
        for (let y = 2; y <= 19; y++) {
          const t = (y - 10.5) / 8.5;
          const x = Math.round(x0 + 3 * t * t);
          b.set(x, y, col);
          b.set(x + 1, y, col);
        }
      }
      return { buf: b.outline(INK), ox: 9, oy: 11 };
    }),
  { ticksPerFrame: 3 },
);

/** A river wave 24 px tall with a foaming crest curling left. */
defineSprite(
  'boss/encore/paddle-wave',
  () =>
    [0, 1, 2].map((p) => {
      const b = new PixelBuffer(30, 28);
      // Body: from the base (y 26) up to the crest.
      for (let x = 2; x < 28; x++) {
        const t = (x - 2) / 25;
        const top = Math.round(3 + 18 * Math.pow(t, 1.6) + (x < 9 ? (9 - x) * 0.9 : 0));
        for (let y = top; y <= 26; y++) b.set(x, y, y > 22 ? PAL.teal[0] : y > 14 ? PAL.teal[1] : PAL.teal[2]);
      }
      // Crest lip curling left + foam.
      b.ellipse(1, 2, 12, 6, PAL.snow[2]);
      b.hline(3, 9, 2, PAL.snow[3]);
      b.set(1 + p, 7, PAL.snow[3]);
      b.set(3 + p, 9, PAL.snow[2]);
      for (let k = 0; k < 4; k++) b.set(10 + k * 4 + p, 10 + k * 3, PAL.snow[3]);
      b.hline(4, 26, 25, PAL.teal[3]);
      return { buf: b.outline(INK), ox: 14, oy: 14 };
    }),
  { ticksPerFrame: 4 },
);

/** Barrel rolling toward the player: the round end, staves and hoops turning (4 frames). */
defineSprite(
  'boss/encore/barrel',
  () =>
    [0, 1, 2, 3].map((p) => {
      const b = new PixelBuffer(20, 20);
      b.circle(9, 9, 8, PAL.brown[2]);
      b.circle(9, 9, 8, PAL.steel[1], false);
      b.circle(9, 9, 7, PAL.steel[2], false);
      const a0 = (-p * Math.PI) / 8;
      for (let i = 0; i < 4; i++) {
        const a = a0 + (i * Math.PI) / 4;
        b.line(Math.round(9 - Math.cos(a) * 6), Math.round(9 - Math.sin(a) * 6), Math.round(9 + Math.cos(a) * 6), Math.round(9 + Math.sin(a) * 6), PAL.brown[1]);
      }
      b.circle(8, 8, 1, PAL.brown[3]);
      b.set(5, 4, PAL.steel[3]);
      b.set(4, 5, PAL.steel[3]);
      return { buf: b.outline(INK), ox: 9, oy: 9 };
    }),
  { ticksPerFrame: 5 },
);

/** Soot ball: a black sooty sphere with glowing embers. */
defineSprite(
  'boss/encore/soot-ball',
  () =>
    [0, 1].map((p) => {
      const b = new PixelBuffer(16, 16);
      b.circle(7, 8, 6, PAL.ink[1]);
      b.circle(6, 7, 4, PAL.steel[0]);
      b.circle(5, 5, 1, PAL.steel[1]);
      b.set(9 + p, 10, PAL.orange[2]);
      b.set(4, 11 - p, PAL.orange[1]);
      b.set(10, 5 + p, PAL.gold[3]);
      b.circle(12, 3, 1, PAL.stone[1]);
      return { buf: b.outline(INK), ox: 7, oy: 8 };
    }),
  { ticksPerFrame: 5, anchor: C },
);

/** Brass pellet: a gold ball with a glint and a short streak (moving left). */
defineSprite(
  'boss/encore/brass-pellet',
  () =>
    [0, 1].map((p) => {
      const b = new PixelBuffer(14, 9);
      b.hline(7, 12 - p, 4, PAL.gold[1]);
      b.hline(8, 10 - p, 3, PAL.gold[0]);
      b.circle(4, 4, 3, PAL.gold[2]);
      b.circle(3, 3, 1, PAL.gold[3]);
      b.set(3, 3, PAL.snow[3]);
      return { buf: b.outline(INK), ox: 4, oy: 4 };
    }),
  { ticksPerFrame: 3 },
);
