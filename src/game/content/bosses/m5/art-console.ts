/**
 * Art of THE CONSOLE (`organ-console`, GDD §10.5 stage 2) and THE MAESTRO (`maestro`, stage 3),
 * plus Fanfaroni's pose strip, the boss shots and the `wreck-block` prop. Anchors: the top-left of
 * each part box in room coordinates (./geom.ts) unless noted.
 *
 * - `boss/organ-console/cabinet` — the console's back (dark walnut, gold pipes, stop rows,
 *   brackets under the mission's keyboard tiers, the pedalboard). Anchor: room (120, 40).
 * - `boss/organ-console/pipe-bank-left|pipe-bank-right-0|1|2` (40×136; `-2` frame 1 = wrecked).
 * - `boss/organ-console/console-0|1|2` — the gilded music stand with its lamp (40×40; `-2` frame 1
 *   = smashed).
 * - `boss/organ-console/screen` — the sheet-music screen (240×32), `bench`, `pedal` (up / down),
 *   `knob` (the big stop knob, 3 frames: in, half, out).
 * - `boss/maestro/podium-0|1|2` (48×28, centre anchor), `speaker-left|speaker-right-0|1|2` (frame 1
 *   = the cone pulses), `jet` (3 frames), `hat-chute` (his bicorne as a parachute).
 * - `boss/maestro/fanfaroni` — the pose strip (indices in `POSE`), feet anchor, faces right.
 * - Shots: `boss/grand-organ/chord-note`, `boss/organ-console/homing-note`,
 *   `boss/organ-console/note-bomb`. Prop: `prop/wreck-block/idle` (3 variants, feet anchor).
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { hash2 } from '../../../art/paint';
import { fanfaroni, type FanfOpts } from './art-fanfaroni';
import { brassPipe, frameOf, glint, walnutPanel, wear } from './art-kit';
import { CONSOLE } from './geom';

const C = 'boss/organ-console';
const M = 'boss/maestro';

// ---------------------------------------------------------------------------------------------
// Console
// ---------------------------------------------------------------------------------------------

function cabinetFrame(): Frame {
  const cb = CONSOLE.cabinet;
  const b = new PixelBuffer(cb.w + 2, cb.h + 2);
  const X = (rx: number) => rx - cb.x + 1;
  const Y = (ry: number) => ry - cb.y + 1;
  // The tall back: a stepped dark-walnut wall rising behind the tiers to the music stand.
  b.poly([X(140), Y(176), X(140), Y(140), X(168), Y(112), X(196), Y(80), X(222), Y(50), X(290), Y(40), X(343), Y(40), X(343), Y(176)], PAL.brown[0]);
  walnutPanel(b, X(232), Y(52), 60, 28, 5, true);
  // Display pipes on the back wall (dim brass, background).
  for (let k = 0; k < 7; k++) {
    const px = X(234 + k * 8);
    brassPipe(b, px, Y(54 + Math.abs(3 - k) * 3), 5, Y(80), [PAL.brown[0], PAL.gold[0], PAL.gold[1], PAL.gold[1]], k % 2 === 0);
  }
  // Stop rows by the bench: round knobs with ivory faces.
  for (let row = 0; row < 3; row++) {
    for (let k = 0; k < 4; k++) {
      const kx = X(300 + k * 9);
      const ky = Y(94 + row * 12);
      b.circle(kx, ky, 3, PAL.brown[1]);
      b.circle(kx, ky, 2, (row + k) % 3 === 0 ? PAL.red[2] : PAL.cloth[2]);
      b.set(kx - 1, ky - 1, PAL.snow[3]);
    }
  }
  // Brackets under each tier (brass posts and curved supports).
  for (const t of CONSOLE.tiers) {
    const below = t.y === 148 ? 176 : t.y + 32;
    for (const px of [t.x + 6, t.x + t.w - 8]) {
      b.rect(X(px), Y(t.y + 10), 3, below - t.y - 10, PAL.gold[1]);
      b.vline(X(px), Y(t.y + 10), Y(below - 1), PAL.gold[2]);
    }
    for (let k = 0; k < 8; k++) b.set(X(t.x + 9 + k), Y(t.y + 11 + Math.round(Math.sqrt(k) * 2)), PAL.gold[0]);
  }
  // Gold trim along the stepped edge.
  b.line(X(140), Y(140), X(168), Y(112), PAL.gold[1]);
  b.line(X(168), Y(112), X(196), Y(80), PAL.gold[1]);
  b.line(X(196), Y(80), X(222), Y(50), PAL.gold[1]);
  b.hline(X(222), X(343), Y(40), PAL.gold[2]);
  // Pedalboard housing under the console.
  const pd = CONSOLE.pedals;
  b.rect(X(pd.x - 4), Y(pd.y - 6), pd.w + 8, 16, PAL.brown[1]);
  b.hline(X(pd.x - 4), X(pd.x + pd.w + 3), Y(pd.y - 6), PAL.gold[2]);
  b.outline(INK);
  return frameOf(b, 1, 1);
}

function bankFrame(state: number, wrecked: boolean, right: boolean): Frame {
  const b = new PixelBuffer(42, 138);
  // Wooden pier with three tiers of pipes.
  walnutPanel(b, 1, 1, 40, 136, right ? 13 : 12);
  for (let row = 0; row < 3; row++) {
    const bot = 44 + row * 44;
    for (let k = 0; k < 5; k++) {
      const h = wrecked ? 6 + Math.floor(hash2(k, row, 4) * 8) : 22 + ((k + row) % 3) * 6 + (row === 0 ? 10 : 0);
      const x = 4 + k * 7;
      brassPipe(b, x, bot - h, 6, bot, PAL.gold, !wrecked);
      if (wrecked) b.hline(x, x + 5, bot - h, INK);
    }
    b.rect(2, bot, 38, 4, PAL.brown[2]);
    b.hline(2, 39, bot, PAL.gold[3]);
  }
  if (wrecked) {
    for (let k = 0; k < 14; k++) b.rect(3 + Math.floor(hash2(k, 1, 6) * 34), 2 + Math.floor(hash2(k, 2, 6) * 130), 3, 2, INK);
  } else glint(b, 6, 14);
  b.outline(INK);
  const out = state > 0 && !wrecked ? wear(b, state, (right ? 70 : 60) + state) : wrecked ? wear(b, 2, 99) : b;
  if (right) return frameOf(out.flipped(true), 1, 1);
  return frameOf(out, 1, 1);
}

function standFrame(state: number, smashed: boolean): Frame {
  const b = new PixelBuffer(42, 42);
  if (smashed) {
    b.thickLine(8, 41, 16, 26, 3, PAL.gold[1]);
    b.thickLine(32, 41, 26, 30, 3, PAL.gold[1]);
    b.poly([10, 34, 30, 30, 34, 38, 12, 40], PAL.brown[1]);
    for (let k = 0; k < 6; k++) b.rect(6 + k * 5, 36 + (k % 2) * 2, 3, 2, PAL.cloth[1 + (k % 2)]);
    b.outline(INK);
    return frameOf(b, 1, 1);
  }
  // Ornate stand: a pedestal, a tilted desk with a big score, a brass lamp on a swan-neck arm.
  b.rect(18, 26, 6, 15, PAL.gold[1]);
  b.vline(18, 26, 40, PAL.gold[3]);
  b.rect(10, 38, 22, 3, PAL.gold[2]);
  b.poly([2, 24, 40, 18, 40, 26, 2, 30], PAL.brown[1]);
  b.line(2, 24, 40, 18, PAL.gold[3]);
  // The score on the desk.
  b.poly([5, 22, 37, 14, 38, 2, 6, 8], PAL.cloth[2]);
  b.line(6, 8, 38, 2, PAL.cloth[3]);
  for (let k = 0; k < 4; k++) b.line(8, 11 + k * 3, 35, 5 + k * 3, PAL.stone[1]);
  for (let k = 0; k < 6; k++) b.rect(10 + k * 4, 12 + (k % 3) * 2 - k, 2, 2, INK);
  b.vline(21, 5, 18, PAL.stone[2]);
  // Lamp.
  b.line(38, 18, 40, 4, PAL.gold[2]);
  b.rect(30, 2, 10, 3, PAL.gold[3]);
  b.rect(31, 5, 8, 1, PAL.gold[3]);
  b.outline(INK);
  return frameOf(state > 0 ? wear(b, state, 80 + state) : b, 1, 1);
}

function screenFrame(): Frame {
  const s = CONSOLE.screen;
  const b = new PixelBuffer(s.w + 2, s.h + 2);
  b.rect(1, 1, s.w, s.h, PAL.gold[1]);
  b.rect(3, 3, s.w - 4, s.h - 4, PAL.cloth[2]);
  b.hline(1, s.w, 1, PAL.gold[3]);
  // Staff lines (lanes) and the treble-like clef squiggle (original glyph).
  for (const ly of CONSOLE.laneY) b.hline(4, s.w - 3, ly - s.y + 1, PAL.stone[1]);
  b.line(7, 4, 7, 30, INK);
  b.line(7, 4, 11, 9, INK);
  b.line(11, 9, 5, 18, INK);
  // Hanging chains.
  for (const cx of [20, s.w - 20]) b.vline(cx, 0, 1, PAL.gold[2]);
  b.outline(INK);
  return frameOf(b, 1, 1);
}

function benchFrame(): Frame {
  const b = new PixelBuffer(40, 12);
  b.rect(1, 1, 38, 4, PAL.red[2]);
  b.hline(1, 38, 1, PAL.red[3]);
  b.rect(1, 5, 38, 2, PAL.gold[2]);
  for (const x of [3, 34]) b.rect(x, 7, 3, 4, PAL.brown[1]);
  b.outline(INK);
  return frameOf(b, 1, 1);
}

function pedalFrame(down: boolean): Frame {
  const pd = CONSOLE.pedals;
  const b = new PixelBuffer(pd.w + 2, pd.h + 2);
  for (let k = 0; k < 9; k++) {
    const x = 1 + k * 8;
    const dy = down && k % 2 === 0 ? 3 : 0;
    b.rect(x, 1 + dy, 7, pd.h - 1 - dy, k % 3 === 2 ? PAL.black[1] : PAL.brown[2]);
    b.hline(x, x + 6, 1 + dy, k % 3 === 2 ? PAL.black[3] : PAL.cloth[2]);
  }
  b.outline(INK);
  return frameOf(b, 1, 1);
}

function knobFrame(out: number): Frame {
  const b = new PixelBuffer(30, 14);
  const len = 2 + out * 8;
  b.rect(28 - len, 5, len, 4, PAL.gold[1]);
  b.hline(28 - len, 27, 5, PAL.gold[3]);
  const kx = 28 - len - 9;
  b.circle(kx + 5, 7, 5, PAL.brown[2]);
  b.circle(kx + 5, 7, 4, PAL.cloth[2]);
  b.set(kx + 3, 5, PAL.snow[3]);
  b.outline(INK);
  return frameOf(b, 27, 7);
}

// ---------------------------------------------------------------------------------------------
// Maestro podium
// ---------------------------------------------------------------------------------------------

function podiumFrame(state: number, glow: number): Frame {
  const b = new PixelBuffer(50, 30);
  // Round brass drum, crimson velvet top, gold rail.
  b.ellipse(1, 1, 48, 10, PAL.red[2]);
  b.rect(3, 6, 44, 18, PAL.gold[2]);
  b.ellipse(3, 18, 44, 10, PAL.gold[1]);
  for (let x = 3; x < 47; x++) {
    const u = (x - 3) / 44;
    const c = u < 0.15 ? PAL.gold[3] : u < 0.55 ? PAL.gold[2] : u < 0.85 ? PAL.gold[1] : PAL.gold[0];
    b.vline(x, 6, 23, c);
  }
  b.hline(3, 46, 9, PAL.brown[1]);
  b.hline(3, 46, 20, PAL.brown[1]);
  for (let x = 6; x < 46; x += 6) b.set(x, 14, PAL.snow[3]);
  b.ellipse(1, 1, 48, 9, PAL.red[2]);
  b.ellipse(4, 2, 42, 6, PAL.red[3]);
  // The core gem on the front (a big ruby in a star mount).
  const gx = 25;
  const gy = 15;
  b.circle(gx, gy, 6, PAL.gold[3]);
  b.circle(gx, gy, 4, glow ? PAL.pink[2] : PAL.red[2]);
  b.circle(gx, gy, 2, glow ? PAL.snow[3] : PAL.red[3]);
  b.set(gx - 2, gy - 2, PAL.snow[3]);
  b.outline(INK);
  return frameOf(state > 0 ? wear(b, state, 90 + state) : b, 25, 15);
}

function wingFrame(state: number, pulse: boolean, wrecked: boolean): Frame {
  const b = new PixelBuffer(12, 28);
  b.rect(2, 1, 8, 26, PAL.steel[1]);
  b.vline(2, 1, 26, PAL.steel[3]);
  if (wrecked) {
    b.rect(3, 8, 6, 12, INK);
    b.line(3, 8, 8, 18, PAL.steel[2]);
  } else {
    const r = pulse ? 4 : 3;
    b.circle(6, 14, r, PAL.gold[2]);
    b.circle(6, 14, r - 1, PAL.black[2]);
    b.circle(6, 14, 1, PAL.gold[3]);
    b.rect(4, 3, 4, 3, PAL.gold[1]);
    b.rect(4, 22, 4, 3, PAL.gold[1]);
  }
  b.outline(INK);
  return frameOf(state > 0 && !wrecked ? wear(b, state, 95 + state) : b, 1, 1);
}

function jetFrame(k: number): Frame {
  const b = new PixelBuffer(16, 18);
  b.rect(3, 0, 10, 4, PAL.steel[1]);
  b.hline(3, 12, 0, PAL.steel[3]);
  const len = 8 + k * 3;
  b.tri(4, 4, 12, 4, 8, 4 + len, PAL.orange[2]);
  b.tri(6, 4, 10, 4, 8, 3 + Math.round(len * 0.7), PAL.gold[3]);
  b.vline(8, 4, 5 + (k & 1), PAL.snow[3]);
  return frameOf(b, 8, 0);
}

function hatChuteFrame(): Frame {
  // The bicorne upside down as a canopy, cords down to a hand-hold point (anchor = hands).
  const b = new PixelBuffer(36, 30);
  b.poly([2, 4, 8, 1, 18, 0, 28, 1, 34, 4, 30, 10, 18, 11, 6, 10], PAL.red[2]);
  b.bevel(PAL.red, { light: 'tl', depth: 1, base: 2 });
  b.hline(6, 30, 10, PAL.gold[3]);
  b.circle(18, 6, 2, PAL.gold[3]);
  for (const [x, l] of [
    [12, -1],
    [18, 0],
    [24, 1],
  ] as const) {
    b.line(x, 0, x + l, -3, PAL.black[2]);
  }
  b.line(6, 10, 17, 28, PAL.stone[2]);
  b.line(30, 10, 19, 28, PAL.stone[2]);
  b.outline(INK);
  return frameOf(b, 18, 29);
}

// ---------------------------------------------------------------------------------------------
// Fanfaroni's poses (shared by both stages)
// ---------------------------------------------------------------------------------------------

export const POSES: ReadonlyArray<FanfOpts> = [
  { legs: 'sit', arms: 'play-a' }, // 0 play a
  { legs: 'sit', arms: 'play-b', mouth: 'open' }, // 1 play b
  { legs: 'kick', arms: 'play-a', mouth: 'open' }, // 2 pedal stamp
  { legs: 'sit', arms: 'pull', mouth: 'wide' }, // 3 pull a stop
  { legs: 'sit', arms: 'baton-up', mouth: 'open' }, // 4 seated flourish
  { legs: 'stand', arms: 'down', sooty: true }, // 5 stand
  { legs: 'stand', arms: 'baton-up', sooty: true }, // 6 baton glint
  { legs: 'stand', arms: 'baton-fwd', mouth: 'open', sooty: true }, // 7 lash
  { legs: 'stand', arms: 'tap', sooty: true }, // 8 tap
  { legs: 'stand', arms: 'breath', mouth: 'puff', sooty: true }, // 9 breath
  { legs: 'stand', arms: 'scream', mouth: 'wide', hat: 'lift', sooty: true }, // 10 BRAVISSIMO
  { legs: 'stand', arms: 'cough', mouth: 'small', sooty: true, tired: true }, // 11 cough
  { legs: 'stand', arms: 'up-a', mouth: 'wide', hat: 'fire-a' }, // 12 hat on fire a
  { legs: 'stand', arms: 'up-b', mouth: 'wide', hat: 'fire-b' }, // 13 hat on fire b
  { legs: 'stand', arms: 'fist', mouth: 'puff', sooty: true }, // 14 blows it out
  { legs: 'dangle-a', arms: 'up-a', mouth: 'wide', sooty: true }, // 15 flung / dangling a
  { legs: 'dangle-b', arms: 'up-b', mouth: 'open', sooty: true }, // 16 dangling b
  { legs: 'stand', arms: 'scream', mouth: 'open', hat: 'off', sooty: true, tired: true }, // 17 squeak
  { legs: 'stand', arms: 'baton-fwd', mouth: 'shut', sooty: true }, // 18 volley point
  { legs: 'dangle-a', arms: 'up-a', mouth: 'wide' }, // 19 thrown up (clean plumes)
];

export const POSE = {
  playA: 0,
  playB: 1,
  kick: 2,
  pull: 3,
  flourish: 4,
  stand: 5,
  glint: 6,
  lash: 7,
  tap: 8,
  breath: 9,
  scream: 10,
  cough: 11,
  fireA: 12,
  fireB: 13,
  blow: 14,
  dangleA: 15,
  dangleB: 16,
  squeak: 17,
  point: 18,
  thrown: 19,
} as const;

// ---------------------------------------------------------------------------------------------
// Shots and the wreck block
// ---------------------------------------------------------------------------------------------

/** Chord note: a violet double note with gold heads (8×8), 2 frames. */
function chordNote(k: number): Frame {
  const b = new PixelBuffer(10, 10);
  b.circle(3, 7, 2, k ? PAL.pink[2] : PAL.purple[2]);
  b.circle(7, 6, 2, k ? PAL.purple[2] : PAL.pink[2]);
  b.vline(5, 1, 7, PAL.snow[3]);
  b.vline(9, 0, 6, PAL.snow[3]);
  b.line(5, 1, 9, 0, PAL.gold[3]);
  b.set(2, 6, PAL.snow[3]);
  b.outline(INK);
  return frameOf(b, 5, 5);
}

/** FLUTE homing note: a cyan note with a white trail (2 frames). */
function fluteNote(k: number): Frame {
  const b = new PixelBuffer(12, 12);
  b.circle(5, 8, 3, PAL.teal[2]);
  b.set(4, 7, PAL.snow[3]);
  b.vline(8, 1, 8, PAL.snow[3]);
  b.line(8, 1, 11, 4 + k, PAL.snow[2]);
  if (k) b.set(1, 8, PAL.teal[3]);
  else b.set(1, 10, PAL.teal[3]);
  b.outline(INK);
  return frameOf(b, 6, 6);
}

/** BOMBARDE note-bomb: a black round bomb with a note stem and a lit fuse (2 frames). */
function noteBomb(k: number): Frame {
  const b = new PixelBuffer(14, 16);
  b.circle(6, 10, 5, PAL.black[1]);
  b.set(4, 8, PAL.black[3]);
  b.set(5, 7, PAL.black[3]);
  b.vline(11, 1, 9, PAL.black[2]);
  b.line(11, 1, 13, 4, PAL.black[2]);
  b.set(6, 3 + k, k ? PAL.gold[3] : PAL.orange[2]);
  b.set(7, 4, PAL.red[3]);
  b.rect(5, 4, 3, 2, PAL.steel[2]);
  b.outline(INK);
  return frameOf(b, 7, 8);
}

/** A 24×32 chunk of the broken console (three variants), feet anchor at its bottom centre. */
function wreckBlock(v: number): Frame {
  const b = new PixelBuffer(26, 34);
  b.rect(1, 1, 24, 32, PAL.brown[1]);
  for (let y = 1; y < 33; y++) for (let x = 1; x < 25; x++) if (Math.sin(x * 0.7 + y * 0.15 + v * 2) > 0.85) b.set(x, y, PAL.brown[0]);
  b.hline(1, 24, 1, PAL.brown[2]);
  b.vline(1, 1, 32, PAL.brown[2]);
  b.vline(24, 1, 32, PAL.brown[0]);
  // A slab of ivory keys, a gold rail and broken pipes depending on the variant.
  if (v === 0) {
    b.rect(2, 4, 22, 5, PAL.cloth[2]);
    for (let x = 4; x < 24; x += 4) b.vline(x, 4, 8, PAL.stone[2]);
    for (let x = 3; x < 22; x += 8) b.rect(x + 2, 4, 2, 3, INK);
  } else if (v === 1) {
    for (let k = 0; k < 3; k++) brassPipe(b, 4 + k * 7, 4 + k * 2, 5, 22, PAL.gold, false);
  } else {
    b.circle(12, 14, 6, PAL.gold[2]);
    b.circle(12, 14, 4, PAL.brown[0]);
    b.circle(12, 14, 1, PAL.gold[3]);
  }
  b.hline(1, 24, 24, PAL.gold[2]);
  b.hline(1, 24, 25, PAL.gold[0]);
  // Splintered top corners.
  b.set(1, 1, 0);
  b.set(2, 1, 0);
  b.set(24, 1, 0);
  b.set(23 - v * 3, 1, 0);
  b.outline(INK);
  return frameOf(b, 13, 33);
}

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

defineSprite(`${C}/cabinet`, () => cabinetFrame());
for (const s of [0, 1, 2]) {
  defineSprite(`${C}/pipe-bank-left-${s}`, () => (s === 2 ? [bankFrame(2, false, false), bankFrame(2, true, false)] : bankFrame(s, false, false)));
  defineSprite(`${C}/pipe-bank-right-${s}`, () => (s === 2 ? [bankFrame(2, false, true), bankFrame(2, true, true)] : bankFrame(s, false, true)));
  defineSprite(`${C}/console-${s}`, () => (s === 2 ? [standFrame(2, false), standFrame(2, true)] : standFrame(s, false)));
  defineSprite(`${M}/podium-${s}`, () => [podiumFrame(s, 0), podiumFrame(s, 1)]);
  defineSprite(`${M}/speaker-left-${s}`, () => (s === 2 ? [wingFrame(2, false, false), wingFrame(2, true, false), wingFrame(2, false, true)] : [wingFrame(s, false, false), wingFrame(s, true, false)]));
  defineSprite(`${M}/speaker-right-${s}`, () => (s === 2 ? [wingFrame(2, false, false), wingFrame(2, true, false), wingFrame(2, false, true)] : [wingFrame(s, false, false), wingFrame(s, true, false)]));
}
defineSprite(`${C}/screen`, () => screenFrame());
defineSprite(`${C}/bench`, () => benchFrame());
defineSprite(`${C}/pedal`, () => [pedalFrame(false), pedalFrame(true)]);
defineSprite(`${C}/knob`, () => [0, 1, 2].map(knobFrame));
defineSprite(`${M}/jet`, () => [0, 1, 2].map(jetFrame), { ticksPerFrame: 3 });
defineSprite(`${M}/hat-chute`, () => hatChuteFrame());
defineSprite(`${M}/fanfaroni`, () => POSES.map((o) => fanfaroni(o)));
defineSprite('boss/grand-organ/chord-note', () => [chordNote(0), chordNote(1)], { ticksPerFrame: 6 });
defineSprite(`${C}/homing-note`, () => [fluteNote(0), fluteNote(1)], { ticksPerFrame: 5 });
defineSprite(`${C}/note-bomb`, () => [noteBomb(0), noteBomb(1)], { ticksPerFrame: 4 });
defineSprite('prop/wreck-block/idle', () => [0, 1, 2].map(wreckBlock));
