/**
 * `anthem-speaker` art (`machine/anthem-speaker/…`): an original propaganda lamp post. A black
 * iron post on a stone-and-gold plinth, a gold lantern on top, a crimson loudspeaker horn with a
 * gold rim, and a small oval portrait of Fanfaroni (giant crimson-and-gold bicorne, white plumes,
 * curled moustache). Feet anchor; the horn points forward (+x).
 *
 * Strips: `body` (3f: 0 silent; 1–2 the anthem: the horn swells, sound arcs pour out), `tell`
 * (2f: the crackle — the horn shakes, sparks at the mouth), `dent` (the dented-plate overlay),
 * `wreck` (the post bent over, the horn hanging, the portrait askew), `note-bubble` (a ♪ speech
 * bubble; anchor = the tail tip).
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { Composer, shadeLayer } from '../../../art/paint';
import { SPEAKER } from './geom';
import { dentOverlay, fr, horn } from './kit.art';

const ART = 'machine/anthem-speaker';

const W = 40;
const H = 52;
const OX = 14;
const OY = 50;
const X = (dx: number): number => OX + dx;
const Y = (dy: number): number => OY + dy;

/** The plinth: a stone block with a gold band and a top step. */
function plinthLayer(): PixelBuffer {
  const b = new PixelBuffer(W, H);
  b.rect(X(-6), Y(-5), 12, 5, PAL.stone[2]);
  b.rect(X(-4), Y(-8), 8, 3, PAL.stone[2]);
  shadeLayer(b, PAL.stone, { hi: 1, lo: 1 });
  b.hline(X(-6), X(5), Y(-4), PAL.gold[2]);
  b.hline(X(-4), X(3), Y(-8), PAL.gold[3]);
  return b;
}

/** The iron post (with a gold collar) and the lantern on top. `lean` bends it from y −20 up. */
function postLayer(lean = 0): PixelBuffer {
  const b = new PixelBuffer(W, H);
  for (let y = -38; y <= -9; y++) {
    const off = y < -20 ? Math.round(((-20 - y) * lean) / 18) : 0;
    b.hline(X(-1 + off), X(1 + off), Y(y), PAL.black[2]);
    b.set(X(-1 + off), Y(y), PAL.black[3]);
    b.set(X(1 + off), Y(y), PAL.black[1]);
  }
  b.hline(X(-2), X(2), Y(-12), PAL.gold[2]);
  b.hline(X(-2), X(2), Y(-11), PAL.gold[1]);
  if (lean === 0) {
    // The lantern: a gold cap, a pale glass, a finial.
    b.rect(X(-3), Y(-42), 7, 2, PAL.gold[2]);
    b.hline(X(-3), X(3), Y(-42), PAL.gold[3]);
    b.rect(X(-2), Y(-40), 5, 2, PAL.snow[2]);
    b.set(X(-2), Y(-40), PAL.snow[3]);
    b.set(X(0), Y(-44), PAL.gold[3]);
    b.set(X(0), Y(-43), PAL.gold[2]);
  }
  return b;
}

/** The portrait: an oval gold frame round a tiny Fanfaroni (centre at cx, cy; `tilt` skews it). */
function portraitLayer(cx: number, cy: number, tilt = 0): PixelBuffer {
  const b = new PixelBuffer(W, H);
  b.ellipse(cx - 5, cy - 6, 11, 13, PAL.gold[1]);
  b.ellipse(cx - 4, cy - 5, 9, 11, PAL.navy[1]);
  // The bicorne is wider than the frame (that is the joke), three white plumes on top.
  const rows = [
    '.w.w.w...',
    'RRRRRRRRR',
    '.ggggggg.',
    '..sssss..',
    '..sksks..',
    '.KKsssKK.',
    '..sssss..',
    '..ggrgg..',
  ];
  const col: Record<string, number> = { w: PAL.snow[3], R: PAL.red[2], g: PAL.gold[2], s: PAL.skinA[2], k: INK, K: PAL.ink[1], r: PAL.red[2] };
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < 9; x++) {
      const ch = rows[y][x];
      if (ch === '.') continue;
      b.set(cx - 4 + x + (tilt !== 0 ? Math.round((y - 4) * tilt * 0.25) : 0), cy - 5 + y, col[ch]);
    }
  }
  b.set(cx - 4, cy - 5, PAL.gold[3]);
  return b;
}

/** The crimson loudspeaker horn: throat on the post, mouth at `SPEAKER.horn`. */
function hornLayer(mouth: number, shake = 0, ang = 0): PixelBuffer {
  const b = new PixelBuffer(W, H);
  const hx = X(SPEAKER.horn[0]);
  const hy = Y(SPEAKER.horn[1]) + shake;
  const len = 9;
  const tx = hx - Math.round(Math.cos(ang) * len);
  const ty = hy - Math.round(Math.sin(ang) * len);
  // A bracket from the post to the horn's throat.
  b.rect(X(0), ty - 1, Math.max(1, tx - X(0)), 2, PAL.black[2]);
  horn(b, tx, ty, ang, len, 2, mouth, { ramp: 'red', rim: 'gold', inside: [PAL.red[0], PAL.ink[1]], depth: 2, flare: 1.6 });
  return b;
}

function bodyFrame(f: number): Frame {
  const c = new Composer(W, H);
  c.add(plinthLayer(), { ramp: PAL.stone });
  c.add(postLayer(), { ramp: PAL.black });
  c.add(portraitLayer(X(-1), Y(-23)), { ramp: PAL.gold });
  c.add(hornLayer(f === 0 ? 6 : f === 1 ? 7 : 6), { ramp: PAL.red });
  const buf = c.finish();
  if (f > 0) {
    // Sound arcs pouring out of the mouth (drawn after the outline: they float free).
    const hx = X(SPEAKER.horn[0]) + 4;
    const hy = Y(SPEAKER.horn[1]);
    for (let k = 0; k < 2; k++) {
      const r = 4 + k * 4 + (f === 2 ? 2 : 0);
      for (let a = -50; a <= 50; a += 8) {
        const t = (a * Math.PI) / 180;
        buf.set(Math.round(hx + Math.cos(t) * r), Math.round(hy + Math.sin(t) * (r + 2)), k === 0 ? PAL.gold[3] : PAL.gold[2]);
      }
    }
  }
  return fr(buf, OX, OY);
}

/** The crackle: the horn shakes up and down, white-and-gold sparks at the mouth. */
function tellFrame(f: number): Frame {
  const c = new Composer(W, H);
  c.add(plinthLayer(), { ramp: PAL.stone });
  c.add(postLayer(), { ramp: PAL.black });
  c.add(portraitLayer(X(-1), Y(-23)), { ramp: PAL.gold });
  c.add(hornLayer(6, f === 0 ? -1 : 1), { ramp: PAL.red });
  const buf = c.finish();
  const hx = X(SPEAKER.horn[0]) + 4;
  const hy = Y(SPEAKER.horn[1]);
  const zig = f === 0 ? [[0, -6], [2, -4], [1, -2], [3, 0]] : [[1, 5], [3, 3], [2, 1], [4, -1]];
  for (const [dx, dy] of zig) buf.set(hx + dx, hy + dy, PAL.snow[3]);
  buf.set(hx + 4, hy + (f === 0 ? -5 : 4), PAL.gold[3]);
  return fr(buf, OX, OY);
}

/** Destroyed: the post bent over at the collar, the horn hanging mouth-down, the portrait askew. */
function wreckFrame(): Frame {
  const c = new Composer(W, H);
  c.add(plinthLayer(), { ramp: PAL.stone });
  c.add(postLayer(9), { ramp: PAL.black });
  const h = new PixelBuffer(W, H);
  horn(h, X(9), Y(-22), Math.PI * 0.42, 9, 2, 5, { ramp: 'red', rim: 'rust', inside: [PAL.ink[1], PAL.ink[0]], depth: 2 });
  c.add(h, { ramp: PAL.red });
  c.add(portraitLayer(X(-3), Y(-16), 1), { ramp: PAL.gold });
  const buf = c.finish();
  // Soot on the plinth.
  for (const [dx, dy] of [[-4, -3], [-1, -2], [2, -3], [4, -2], [-2, -6]]) buf.set(X(dx), Y(dy), PAL.ink[1]);
  return fr(buf, OX, OY);
}

/** A white speech bubble with a black ♪ (the font has no note glyph); anchor = the tail tip. */
function noteBubble(): Frame {
  const b = new PixelBuffer(15, 15);
  b.roundRect(1, 1, 13, 10, 3, PAL.snow[3]);
  b.tri(5, 10, 9, 10, 7, 13, PAL.snow[3]);
  b.hline(2, 12, 10, PAL.snow[1]);
  // The note: a head, a stem and a flag.
  b.rect(5, 7, 3, 2, INK);
  b.vline(7, 3, 7, INK);
  b.set(8, 3, INK);
  b.set(9, 4, INK);
  b.set(9, 5, INK);
  return fr(b.outline(INK), 7, 14);
}

export function defineSpeakerSprites(): void {
  defineSprite(`${ART}/body`, () => [0, 1, 2].map(bodyFrame), { ticksPerFrame: 8 });
  defineSprite(`${ART}/tell`, () => [0, 1].map(tellFrame), { ticksPerFrame: 4 });
  defineSprite(`${ART}/dent`, () => [dentOverlay(bodyFrame(0), 3, 53)], { ticksPerFrame: 30 });
  defineSprite(`${ART}/wreck`, () => [wreckFrame()], { ticksPerFrame: 30 });
  defineSprite(`${ART}/note-bubble`, () => [noteBubble()], { ticksPerFrame: 30 });
}
