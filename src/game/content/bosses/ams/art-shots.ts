/**
 * ROBO-HALSEMA — projectile art (centre anchors; the moving strips are drawn moving LEFT).
 *
 * `boss/ams-mayor/stamp-wave` (2, a 16-px wave of red stamp ink and dust), `noise-letter` (4:
 * open while rising, then 3 tumbling envelopes with a red NOISE mark), `shield-shot` (2, a
 * spinning enamel shield). The 1× frames are drawn here with PAL (byte-identical); the 2× / 4×
 * frames come from one density-generic HD drawer per strip (docs/ART_GUIDE.md "UHD art"): lit
 * glossy ink, folded paper, enamel and silver, outline A, the 1× geometry.
 */
import { PAL } from '../../../../engine/palette';
import { PAL_HD } from '../../../../engine/palette-hd';
import type { Frame } from '../../../../engine/render';
import { defineSprite, getFrames } from '../../../../engine/sprites';
import type { RenderOpts } from '../../../art/hd/canvas';
import { DCanvas, HdPiece, geomOf } from './canvas';

const ART = 'boss/ams-mayor';
const R = PAL_HD;
const RENDER: RenderOpts = { outline: 'A', ao: 0.3, rimLight: 2 };

/** Distance from (x, y) to the segment a–b. */
function segDistance(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax;
  const vy = by - ay;
  const l2 = vx * vx + vy * vy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / l2));
  return Math.hypot(x - ax - vx * t, y - ay - vy * t);
}

/** A w × h 1× canvas for one shot frame. */
function pad(w: number, h: number): DCanvas {
  return new DCanvas(0, 0, w - 1, h - 1);
}

/** The outlined frame with its centre anchor (logical px). */
function done(c: DCanvas, ox: number, oy: number): Frame {
  c.outline();
  return { buf: c.b, ox, oy };
}

function stampWave(p: number): Frame {
  const b = pad(20, 18);
  // A curling ink wave (front at the left), dust behind.
  b.poly([[2, 17], [4, 8 + p], [8, 3], [13, 2 + p], [12, 7], [16, 11], [19, 17]], PAL.red[2]);
  b.poly([[5, 16], [7, 9 + p], [10, 6], [12, 9], [15, 16]], PAL.red[3]);
  b.line(6, 6 + p, 10, 3, PAL.pink[2]);
  b.rect(15, 13 - p, 2, 2, PAL.stone[2]);
  b.rect(17, 10 + p, 2, 2, PAL.stone[1]);
  b.rect(1, 17, 18, 1, PAL.red[1]);
  return done(b, 10, 10);
}

function noiseLetter(p: number): Frame {
  const b = pad(16, 14);
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
    b.poly(
      [
        [2, 4 + tilt],
        [13, 4 - tilt],
        [13, 11 - tilt],
        [2, 11 + tilt],
      ],
      PAL.snow[2],
    );
    b.line(2, 4 + tilt, 7, 8, PAL.stone[2]);
    b.line(13, 4 - tilt, 8, 8, PAL.stone[2]);
    // The red stamp mark (a crossed-out speaker note).
    b.rect(9, 8, 3, 2, PAL.red[2]);
    b.set(10, 7, PAL.red[2]);
  }
  return done(b, 8, 7);
}

function shieldShot(p: number): Frame {
  const b = pad(11, 12);
  const w = p === 0 ? 7 : 4;
  const x0 = 5 - (w >> 1);
  const field = p === 0 ? PAL.red[2] : PAL.sky[2];
  b.rect(x0 - 1, 1, w + 2, 7, PAL.snow[2]);
  b.rect(x0, 2, w, 6, field);
  b.line(x0, 8, 5, 10, PAL.snow[2]);
  b.line(x0 + w - 1, 8, 5, 10, PAL.snow[2]);
  b.line(x0 + 1, 8, 5, 9, field);
  if (p === 0) {
    b.set(5, 4, PAL.snow[3]);
    b.set(4, 3, PAL.snow[3]);
    b.set(6, 5, PAL.snow[3]);
    b.set(6, 3, PAL.snow[3]);
    b.set(4, 5, PAL.snow[3]);
  }
  b.set(x0, 2, PAL.snow[3]);
  return done(b, 5, 5);
}

// ---------------------------------------------------------------------------------------------
// HD (2× / 4×). Local coordinates = the 1× pad (top-left 0, 0); the anchor is the 1× one.
// ---------------------------------------------------------------------------------------------

/** An HD piece in pad coordinates for 1× frame `f` (local x = pad x). */
function hdPad(f: Frame, d: number): HdPiece {
  const g = geomOf(f);
  return new HdPiece(g, d, { anchor: [g.ox, g.oy], margin: 1 });
}

/** The stamp wave: a glossy curl of red ink (a lit crest, a pink highlight), dust puffs behind. */
function stampWaveHd(f: Frame, p: number, d: number): Frame {
  const P = hdPad(f, d);
  const ink = P.material({ ramp: R.red, lo: 2, hi: 6, spec: 0.8, shine: 22, wrap: 0.05 });
  const dust = P.material({ ramp: R.stone, lo: 1, hi: 5, wrap: 0.3, amb: 0.2 });
  const part = P.newPart();
  P.blob([[2.2, 17.8], [4.2, 8.4 + p], [8.5, 3.2], [13.6, 2.2 + p], [12.6, 7.4], [16.6, 11.4], [19.8, 17.8]], 2.2, { mat: ink, z: 0, part, bulge: 0.5 });
  P.blob([[5.5, 16.8], [7.5, 9.6 + p], [10.5, 6.6], [12.5, 9.6], [15.5, 16.8]], 1.6, { mat: ink, z: 1.2, tone: 0.18 });
  P.shade(4, 2, 10, 8, (x, y) => (segDistance(x, y, 6.5, 6.5 + p, 10.5, 3.5) < 0.5 ? 0.5 : 0), part);
  P.ell(16, 14 - p, 1.3, 1.2, { mat: dust, z: 2 });
  P.ell(18, 11 + p, 1.25, 1.15, { mat: dust, z: 2, tone: -0.15 });
  P.box(1, 17, 18, 1, { mat: ink, z: 0.5, tone: -0.35 });
  return P.frame(RENDER);
}

/** The noise letter: a paper envelope (lit flap triangles, creases), the red stamp mark. */
function noiseLetterHd(f: Frame, p: number, d: number): Frame {
  const P = hdPad(f, d);
  const paper = P.material({ ramp: R.snow, lo: 2, hi: 5, wrap: 0.25, amb: 0.2, spec: 0.1 });
  const card = P.material({ ramp: R.cloth, lo: 2, hi: 5, wrap: 0.25, amb: 0.2 });
  const mark = P.material({ ramp: R.red, lo: 3, hi: 6, spec: 0.3 });
  if (p === 0) {
    // Flap open, the letter half out.
    const card0 = P.newPart();
    P.box(3, 2, 10, 6, { mat: card, z: 0, bevel: 0.5, part: card0 });
    P.shade(3, 2, 10, 6, (x, y) => (Math.abs(y - 4.5) < 0.25 && x > 4 && x < 12 ? -0.55 : Math.abs(y - 6.5) < 0.25 && x > 4 && x < 10 ? -0.55 : 0), card0);
    P.box(2, 6, 12, 7, { mat: paper, z: 2, bevel: 0.6 });
    P.poly([[2, 6], [14, 6], [8.5, 10.6]], { mat: paper, z: 2.6, n: [0, -0.5, 0.86] });
    P.box(9, 10, 2, 2, { mat: mark, z: 3, bevel: 0.4 });
    return P.frame(RENDER);
  }
  const tilt = p - 2;
  const env: Array<[number, number]> = [[2, 4 + tilt], [14, 4 - tilt], [14, 12 - tilt], [2, 12 + tilt]];
  const part = P.newPart();
  P.blob(env, 0.7, { mat: paper, z: 0, part });
  // The flap: a lit triangle down to the middle, its creases.
  P.poly([[2.2, 4.2 + tilt], [13.8, 4.2 - tilt], [8, 8.6]], { mat: paper, z: 0.4, n: [-0.25, -0.45, 0.86] });
  P.box(9, 8, 3, 2, { mat: mark, z: 1.2, bevel: 0.35 });
  P.box(10, 7, 1, 1, { mat: mark, z: 1.2 });
  return P.frame(RENDER);
}

/** The spinning enamel shield: face-on (red, a white saltire) or edge-on (blue), a silver rim. */
function shieldShotHd(f: Frame, p: number, d: number): Frame {
  const P = hdPad(f, d);
  const silver = P.material({ ramp: R.steel, lo: 3, hi: 6, spec: 1, shine: 30, amb: 0.15 });
  const red = P.material({ ramp: R.red, lo: 3, hi: 6, spec: 1, shine: 34 });
  const blue = P.material({ ramp: R.sky, lo: 1, hi: 5, spec: 1, shine: 34 });
  const white = P.material({ ramp: R.snow, lo: 3, hi: 5, spec: 1, shine: 34 });
  const w = p === 0 ? 7 : 4;
  const x0 = 5 - (w >> 1);
  P.blob([[x0 - 1, 1], [x0 + w + 1, 1], [x0 + w + 1, 8], [5.5, 11], [x0 - 1, 8]], 1, { mat: silver, z: 0 });
  P.blob([[x0, 2], [x0 + w, 2], [x0 + w, 8], [5.5, 10], [x0, 8]], 0.9, { mat: p === 0 ? red : blue, z: 1 });
  if (p === 0) {
    P.cap(4.1, 3.1, 6.9, 5.9, 0.5, 0.5, { mat: white, z: 2 });
    P.cap(6.9, 3.1, 4.1, 5.9, 0.5, 0.5, { mat: white, z: 2 });
  }
  return P.frame(RENDER);
}

/** The HD strip of `id` from its 1× frames. */
function hd(id: string, draw: (f: Frame, i: number, d: number) => Frame): (d: number) => Frame[] {
  return (d) => getFrames(id, 1).map((f, i) => draw(f, i, d));
}

defineSprite(`${ART}/stamp-wave`, () => [0, 1].map((p) => stampWave(p)), { ticksPerFrame: 3, hd: hd(`${ART}/stamp-wave`, stampWaveHd) });
defineSprite(`${ART}/noise-letter`, () => [0, 1, 2, 3].map((p) => noiseLetter(p)), { ticksPerFrame: 6, hd: hd(`${ART}/noise-letter`, noiseLetterHd) });
defineSprite(`${ART}/shield-shot`, () => [0, 1].map((p) => shieldShot(p)), { ticksPerFrame: 4, hd: hd(`${ART}/shield-shot`, shieldShotHd) });
