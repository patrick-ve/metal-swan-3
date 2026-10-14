/**
 * ROBO-HALSEMA — projectile art (centre anchors; the moving strips are drawn moving LEFT).
 *
 * `boss/ams-mayor/stamp-wave` (2, a 16-px wave of red stamp ink and dust), `noise-letter` (4:
 * open while rising, then 3 tumbling envelopes with a red NOISE mark), `shield-shot` (2, a
 * spinning enamel shield).
 */
import { PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { DCanvas } from './canvas';

const ART = 'boss/ams-mayor';

/** A w × h canvas at density d (buffer px = logical px × d) for one shot frame. */
function pad(w: number, h: number, d: number): DCanvas {
  return new DCanvas(0, 0, w - 1, h - 1, d);
}

/** The outlined frame with its centre anchor (logical px), density 2 for the ams twin. */
function done(c: DCanvas, ox: number, oy: number): Frame {
  c.outline();
  return c.d === 1 ? { buf: c.b, ox, oy } : { buf: c.b, ox, oy, density: c.d };
}

function stampWave(p: number, d: number): Frame {
  const b = pad(20, 18, d);
  // A curling ink wave (front at the left), dust behind.
  b.poly([[2, 17], [4, 8 + p], [8, 3], [13, 2 + p], [12, 7], [16, 11], [19, 17]], PAL.red[2]);
  b.poly([[5, 16], [7, 9 + p], [10, 6], [12, 9], [15, 16]], PAL.red[3]);
  b.line(6, 6 + p, 10, 3, PAL.pink[2]);
  if (d === 2) {
    // Fine curl lines and ink droplets.
    b.fine(9, 12, 12.5, 15.5, PAL.red[2]);
    b.fine(5.5, 13, 7, 9.5 + p, PAL.pink[2]);
    b.dot(3, 6.5, PAL.red[2]);
  }
  b.rect(15, 13 - p, 2, 2, PAL.stone[2]);
  b.rect(17, 10 + p, 2, 2, PAL.stone[1]);
  if (d === 2) {
    b.dot(15, 13 - p, PAL.stone[3]);
    b.dot(17, 10 + p, PAL.stone[2]);
  }
  b.rect(1, 17, 18, 1, PAL.red[1]);
  return done(b, 10, 10);
}

function noiseLetter(p: number, d: number): Frame {
  const b = pad(16, 14, d);
  const line = d === 1 ? b.line.bind(b) : b.fine.bind(b);
  if (p === 0) {
    // Flap open, the letter half out.
    b.rect(3, 2, 10, 6, PAL.cloth[3]);
    line(4, 4, 11, 4, PAL.stone[2]);
    line(4, 6, 9, 6, PAL.stone[2]);
    b.rect(2, 6, 12, 7, PAL.snow[2]);
    line(2, 6, 8, 10, PAL.stone[2]);
    line(13, 6, 8, 10, PAL.stone[2]);
    b.rect(9, 10, 2, 2, PAL.red[2]);
    if (d === 2) b.dot(9, 10, PAL.red[3]);
  } else {
    const tilt = p - 2; // −1, 0, 1
    b.poly(
      [
        [2, 4 + tilt],
        [13, 4 - tilt],
        [13, 11 - tilt],
        [2, 11 + tilt],
      ],
      PAL.snow[2],
    );
    line(2, 4 + tilt, 7, 8, PAL.stone[2]);
    line(13, 4 - tilt, 8, 8, PAL.stone[2]);
    // The red stamp mark (a crossed-out speaker note).
    b.rect(9, 8, 3, 2, PAL.red[2]);
    b.set(10, 7, PAL.red[2]);
    if (d === 2) b.fine(9, 10, 12, 7, PAL.red[1]);
  }
  return done(b, 8, 7);
}

function shieldShot(p: number, d: number): Frame {
  const b = pad(11, 12, d);
  const w = p === 0 ? 7 : 4;
  const x0 = 5 - (w >> 1);
  const field = p === 0 ? PAL.red[2] : PAL.sky[2];
  b.rect(x0 - 1, 1, w + 2, 7, PAL.snow[2]);
  b.rect(x0, 2, w, 6, field);
  b.line(x0, 8, 5, 10, PAL.snow[2]);
  b.line(x0 + w - 1, 8, 5, 10, PAL.snow[2]);
  b.line(x0 + 1, 8, 5, 9, field);
  if (p === 0) {
    if (d === 2) {
      // A crisp white saltire.
      b.fine(4, 3, 6.5, 5.5, PAL.snow[3]);
      b.fine(6.5, 3, 4, 5.5, PAL.snow[3]);
    } else {
      b.set(5, 4, PAL.snow[3]);
      b.set(4, 3, PAL.snow[3]);
      b.set(6, 5, PAL.snow[3]);
      b.set(6, 3, PAL.snow[3]);
      b.set(4, 5, PAL.snow[3]);
    }
  }
  b.set(x0, 2, PAL.snow[3]);
  return done(b, 5, 5);
}

defineSprite(`${ART}/stamp-wave`, () => [0, 1].map((p) => stampWave(p, 1)), { ticksPerFrame: 3, hi: () => [0, 1].map((p) => stampWave(p, 2)) });
defineSprite(`${ART}/noise-letter`, () => [0, 1, 2, 3].map((p) => noiseLetter(p, 1)), { ticksPerFrame: 6, hi: () => [0, 1, 2, 3].map((p) => noiseLetter(p, 2)) });
defineSprite(`${ART}/shield-shot`, () => [0, 1].map((p) => shieldShot(p, 1)), { ticksPerFrame: 4, hi: () => [0, 1].map((p) => shieldShot(p, 2)) });
