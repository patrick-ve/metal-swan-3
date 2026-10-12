/**
 * Art of THE BIG HEAD (GDD §9.4, §15.6): a propaganda blimp shaped like Fanfaroni's head, seen from
 * the front. Every piece shares the head's anchor (the centre of the 160 × 120 blimp).
 *
 * - `boss/big-head/head-0|1|2`              the blimp: bicorne fin, face, ears, gondola
 * - `boss/big-head/moustache-left-0|1|2`    2 frames: rest, curled up (Moustache Volley telegraph)
 * - `boss/big-head/moustache-right-0|1|2`   the same, mirrored
 * - `boss/big-head/mouth-speaker-0|1|2`     2 frames: shut, open (ATTENTION!)
 * - `boss/big-head/hatch`                   2 frames: the hat hatch shut / open (overlay)
 * - `boss/big-head/attention`               the big ATTENTION! banner (overlay)
 * - `boss/big-head/deflate`                 4 frames: shrinking and wrinkling (centre anchor)
 * - `boss/big-head/statue`                  a bronze Fanfaroni on a stone plinth (feet anchor)
 * - `boss/big-head/mask`                    the deflated head draped over the statue (feet anchor)
 * - `boss/big-head/leaflet` (3), `leaflet-bomb` (2): centre anchor
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { drawText } from '../../../../engine/font';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { hash2 } from '../../../art/paint';
import { Canvas, scuff, shadeBox, sparkle } from './art-kit';
import { HEAD } from './geom';

const ART = 'boss/big-head';
const SKIN = PAL.skinA;
const GOLD = PAL.gold;
const RED = PAL.red;

function headFrame(state: 0 | 1 | 2): Frame {
  const c = new Canvas(-84, -64, 84, 64);
  const b = c.b;
  // Ears (behind the face).
  const E = c.layer();
  for (const s of [-1, 1]) E.ellipse(c.X(s * 58 - 9), c.Y(-14), 18, 24, SKIN[2]);
  shadeBox(E, c.X(-70), c.Y(-14), 140, 24, SKIN);
  c.put(E);
  for (const s of [-1, 1]) c.line(s * 58, -8, s * 60, 2, SKIN[1]);
  // The face: a rubber balloon with seams.
  const F = c.layer();
  F.ellipse(c.X(-56), c.Y(-42), 112, 90, SKIN[2]);
  F.ellipse(c.X(-34), c.Y(26), 68, 26, SKIN[2]); // the jowls and chin
  shadeBox(F, c.X(-56), c.Y(-42), 112, 94, SKIN);
  c.put(F);
  for (const sx of [-34, 34]) {
    for (let y = -36; y < 40; y++) {
      const x = sx * Math.cos(((y + 2) / 46) * 0.9);
      if ((b.get(c.X(x), c.Y(y)) & 255) !== 0 && y % 3 !== 0) c.set(x, y, SKIN[1]);
    }
  }
  // Rosy cheeks (2 × 2 clusters), the big round nose.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) c.rect(s * 30 - 3 + (i % 2) * 4, 6 + (i >> 1) * 2, 2, 2, PAL.pink[1]);
  }
  const N = c.layer();
  N.ellipse(c.X(-9), c.Y(-8), 18, 18, SKIN[2]);
  shadeBox(N, c.X(-9), c.Y(-8), 18, 18, SKIN);
  c.put(N);
  c.rect(-4, -4, 3, 2, SKIN[3]);
  c.rect(-5, 7, 3, 2, SKIN[0]);
  c.rect(3, 7, 3, 2, SKIN[0]);
  // Eyes: whites, pupils looking down at the street, stern brows.
  for (const s of [-1, 1]) {
    b.ellipse(c.X(s * 18 - 8), c.Y(-24), 16, 11, PAL.snow[2]);
    c.rect(s * 18 - 2, -18, 4, 4, INK);
    c.set(s * 18 - 1, -18, PAL.snow[3]);
    c.rect(s * 18 - 9, -27, 18, 3, PAL.hairA[0]);
    c.line(s * 18 - 9 * s, -29, s * 18 + 9 * s, -26, PAL.hairA[1]);
  }
  // Mouth recess (the loudspeaker sits in it).
  b.ellipse(c.X(-20), c.Y(12), 40, 26, RED[0]);
  // The bicorne hat: the blimp's top fin, gold and crimson with three white plumes.
  const H = c.layer();
  H.poly([[c.X(-74), c.Y(-30)], [c.X(-40), c.Y(-46)], [c.X(0), c.Y(-54)], [c.X(40), c.Y(-46)], [c.X(74), c.Y(-30)], [c.X(50), c.Y(-36)], [c.X(0), c.Y(-40)], [c.X(-50), c.Y(-36)]], RED[2]);
  shadeBox(H, c.X(-74), c.Y(-54), 148, 24, RED);
  c.put(H);
  c.line(-72, -31, -40, -44, GOLD[2]);
  c.line(-40, -44, 0, -52, GOLD[2]);
  c.line(0, -52, 40, -44, GOLD[2]);
  c.line(40, -44, 72, -31, GOLD[2]);
  c.line(-50, -37, 50, -37, GOLD[1]);
  // The cockade.
  b.circle(c.X(0), c.Y(-44), 5, GOLD[2]);
  b.circle(c.X(0), c.Y(-44), 3, RED[3]);
  c.set(0, -44, PAL.snow[3]);
  // Plumes.
  for (const [px, lean] of [
    [-8, -6],
    [0, 0],
    [8, 6],
  ] as const) {
    const P = c.layer();
    P.thickLine(c.X(px), c.Y(-50), c.X(px + lean), c.Y(-62), 5, PAL.snow[2]);
    shadeBox(P, c.X(px - 4), c.Y(-63), 9, 14, PAL.snow);
    c.put(P);
  }
  // The gondola: a little cabin hanging under the chin by two ropes.
  const [gx, gy] = HEAD.gondola;
  c.line(gx - 10, gy - 12, gx - 12, gy - 4, PAL.brown[1]);
  c.line(gx + 10, gy - 12, gx + 12, gy - 4, PAL.brown[1]);
  const G = c.layer();
  G.roundRect(c.X(gx - 15), c.Y(gy - 4), 30, 10, 2, PAL.brown[2]);
  shadeBox(G, c.X(gx - 15), c.Y(gy - 4), 30, 10, PAL.brown, false);
  c.put(G);
  c.rect(gx - 15, gy - 4, 30, 2, RED[2]);
  c.rect(gx - 9, gy, 4, 3, PAL.sky[2]);
  c.rect(gx + 5, gy, 4, 3, PAL.sky[2]);
  c.rect(gx - 2, gy - 1, 4, 6, PAL.brown[0]); // the door
  // Damage: dents and sticking plasters (state 1), tears hissing air (state 2).
  if (state > 0) {
    scuff(b, c.X(-56), c.Y(-40), 112, 80, state, 61, SKIN[3]);
    const plasters: Array<[number, number]> = state === 1 ? [[-36, -6], [40, 20]] : [[-36, -6], [40, 20], [26, -32], [-44, 22]];
    for (const [px, py] of plasters) {
      c.rect(px - 5, py - 2, 10, 4, PAL.sand[2]);
      c.rect(px - 5, py - 2, 10, 1, PAL.sand[3]);
      c.line(px - 4, py + 2, px + 4, py - 2, PAL.sand[1]);
    }
    if (state === 2) {
      for (const [px, py] of [
        [-20, 30],
        [48, -10],
      ] as const) {
        b.ellipse(c.X(px - 3), c.Y(py - 2), 7, 4, INK);
        c.line(px - 3, py - 2, px - 6, py - 5, SKIN[3]);
      }
    }
  }
  return c.frame();
}

/** The left moustache wing with its gun pod (the right one is the mirror). */
function moustacheFrame(state: 0 | 1 | 2, curled: boolean, left: boolean): Frame {
  const c = new Canvas(-84, -20, 4, 20);
  const b = c.b;
  const lift = curled ? 8 : 0;
  const M = c.layer();
  // A thick sweep from under the nose out past the ear, ending in a curl.
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    const x = -2 - t * 64;
    const y = 4 + Math.sin(t * Math.PI) * 4 - t * t * (6 + lift);
    M.circle(c.X(x), c.Y(y), Math.round(6 - t * 3), PAL.hairA[1]);
  }
  shadeBox(M, c.X(-70), c.Y(-8 - lift), 72, 22, PAL.hairA);
  c.put(M);
  // Bristle lines.
  for (let i = 0; i < 6; i++) c.line(-10 - i * 9, 6 - i, -16 - i * 9, 4 - i, PAL.hairA[0]);
  // The gun pod at the tip: a brass ring and a steel barrel pointing out and down.
  const [tx, ty] = HEAD.tipLeft;
  const py = ty - lift;
  b.circle(c.X(tx + 6), c.Y(py), 6, PAL.steel[2]);
  b.circle(c.X(tx + 6), c.Y(py), 4, PAL.steel[3]);
  c.rect(tx - 2, py - 2, 8, 4, PAL.steel[1]);
  c.rect(tx - 2, py - 2, 8, 1, PAL.steel[4]);
  c.rect(tx + 4, py - 6, 2, 12, GOLD[2]);
  c.set(tx + 7, py - 3, PAL.snow[3]);
  if (curled) {
    // The barrel glows: the volley is coming.
    c.rect(tx - 3, py - 1, 2, 2, PAL.orange[2]);
  }
  if (state > 0) scuff(b, c.X(-70), c.Y(-14), 74, 24, state, left ? 3 : 4, PAL.steel[3]);
  if (state === 2) sparkle(b, c.X(tx + 6), c.Y(py + 4), PAL.gold[3]);
  const f = c.frame();
  if (left) return f;
  return { buf: f.buf.flipped(true, false), ox: f.buf.w - 1 - f.ox, oy: f.oy };
}

function speakerFrame(state: 0 | 1 | 2, open: boolean): Frame {
  const c = new Canvas(-24, 4, 24, 46);
  const b = c.b;
  const [mx, my] = HEAD.mouth;
  const r = open ? 13 : 10;
  if (open) {
    // The jaw drops: a dark mouth around the horn.
    b.ellipse(c.X(mx - 22), c.Y(my - 14), 44, 30, INK);
    c.rect(mx - 16, my - 15, 32, 3, PAL.snow[2]); // teeth
  }
  // The loudspeaker horn seen from the front: rings in steel with a crimson rim.
  b.circle(c.X(mx), c.Y(my), r + 1, RED[2]);
  b.circle(c.X(mx), c.Y(my), r, PAL.steel[3]);
  b.circle(c.X(mx), c.Y(my), r - 3, PAL.steel[2]);
  b.circle(c.X(mx), c.Y(my), r - 6, PAL.steel[1]);
  b.circle(c.X(mx), c.Y(my), 2, INK);
  for (let i = -r + 3; i <= r - 3; i += 3) c.set(mx + i, my, PAL.steel[0]);
  c.set(mx - 4, my - r + 2, PAL.snow[3]);
  c.set(mx - 5, my - r + 3, PAL.snow[2]);
  if (state > 0) scuff(b, c.X(mx - r), c.Y(my - r), r * 2, r * 2, state, 9, PAL.snow[2]);
  if (state === 2) {
    c.line(mx - r + 2, my + 2, mx + r - 4, my - 3, INK);
    sparkle(b, c.X(mx + 4), c.Y(my + 4), PAL.gold[3]);
  }
  return c.frame();
}

function hatchFrame(open: boolean): Frame {
  const c = new Canvas(-10, -62, 10, -44);
  const [hx, hy] = HEAD.hatch;
  if (!open) {
    c.rect(hx - 6, hy - 2, 12, 4, RED[1]);
    c.rect(hx - 6, hy - 2, 12, 1, GOLD[2]);
  } else {
    c.rect(hx - 6, hy - 2, 12, 4, INK);
    c.rect(hx - 7, hy - 8, 2, 7, RED[1]); // the flap standing up
    c.rect(hx - 7, hy - 8, 1, 7, GOLD[2]);
  }
  return c.frame(false);
}

function attentionFrame(): Frame {
  const text = 'ATTENTION!';
  const w = 108;
  const b = new PixelBuffer(w, 16);
  b.roundRect(0, 0, w, 16, 3, PAL.cloth[2]);
  b.rect(1, 1, w - 2, 1, PAL.snow[3]);
  b.rect(1, 13, w - 2, 2, PAL.cloth[0]);
  drawText(b, text, w / 2, 4, { font: 'big', color: RED[2], align: 'center' });
  b.outline(INK);
  return { buf: b.padded(1).outline(INK), ox: w / 2 + 1, oy: 9 };
}

function deflateFrames(): Frame[] {
  const full = headFrame(2).buf;
  const out: Frame[] = [];
  const scales = [0.7, 0.5, 0.36, 0.26];
  for (let i = 0; i < scales.length; i++) {
    const w = Math.max(8, Math.round(full.w * scales[i]));
    const h = Math.max(8, Math.round(full.h * scales[i] * (1 - i * 0.08)));
    const small = full.resized(w, h);
    // Wrinkles: ink creases across the shrinking rubber.
    for (let k = 0; k < 3 + i * 2; k++) {
      const y = Math.round(h * (0.25 + 0.5 * hash2(k, i, 7)));
      const x0 = Math.round(w * 0.2);
      const x1 = Math.round(w * (0.5 + 0.3 * hash2(k, i, 8)));
      for (let x = x0; x <= x1; x++) if ((small.get(x, y) & 255) !== 0) small.set(x, y + ((x >> 2) & 1), SKIN[0]);
    }
    const p = small.padded(1);
    out.push({ buf: p.outline(INK), ox: p.w >> 1, oy: p.h >> 1 });
  }
  return out;
}

function statueFrame(masked: boolean): Frame {
  const c = new Canvas(-26, -84, 26, 0);
  const b = c.b;
  // Stone plinth 36 × 40 with a bronze plaque.
  const P = c.layer();
  P.rect(c.X(-18), c.Y(-40), 36, 40, PAL.stone[2]);
  shadeBox(P, c.X(-18), c.Y(-40), 36, 40, PAL.stone, false);
  c.put(P);
  c.rect(-20, -42, 40, 4, PAL.stone[3]);
  c.rect(-20, -39, 40, 1, PAL.stone[1]);
  c.rect(-8, -26, 16, 8, GOLD[1]);
  c.rect(-6, -24, 12, 1, GOLD[3]);
  c.rect(-6, -21, 12, 1, GOLD[3]);
  // Bronze Fanfaroni: short and round, hand on his heart, a giant bicorne.
  const B = PAL.brown;
  const S = c.layer();
  S.ellipse(c.X(-9), c.Y(-66), 18, 24, B[2]);
  S.rect(c.X(-7), c.Y(-46), 5, 6, B[2]);
  S.rect(c.X(2), c.Y(-46), 5, 6, B[2]);
  S.circle(c.X(0), c.Y(-70), 6, B[2]);
  S.poly([[c.X(-16), c.Y(-74)], [c.X(0), c.Y(-82)], [c.X(16), c.Y(-74)], [c.X(0), c.Y(-77)]], B[2]);
  shadeBox(S, c.X(-16), c.Y(-82), 32, 42, B);
  c.put(S);
  c.line(-5, -60, 2, -56, B[0]);
  c.set(-2, -70, B[0]);
  c.set(2, -70, B[0]);
  c.line(-4, -66, 4, -66, B[0]);
  if (masked) {
    // The deflated blimp draped over him like a rubber mask: the face hangs over the plinth.
    const M = c.layer();
    M.ellipse(c.X(-22), c.Y(-82), 44, 40, SKIN[2]);
    M.poly([[c.X(-22), c.Y(-58)], [c.X(22), c.Y(-58)], [c.X(18), c.Y(-36)], [c.X(10), c.Y(-46)], [c.X(0), c.Y(-34)], [c.X(-10), c.Y(-46)], [c.X(-18), c.Y(-36)]], SKIN[2]);
    shadeBox(M, c.X(-22), c.Y(-82), 44, 48, SKIN);
    c.put(M);
    for (let i = 0; i < 5; i++) c.line(-16 + i * 8, -78 + (i % 2) * 3, -12 + i * 8, -48, SKIN[1]);
    // Its droopy eyes, nose and moustache.
    for (const s of [-1, 1]) {
      c.rect(s * 8 - 3, -70, 6, 3, PAL.snow[2]);
      c.rect(s * 8 - 1, -69, 2, 2, INK);
      c.line(s * 3, -56, s * 16, -46, PAL.hairA[1]);
      c.line(s * 3, -55, s * 16, -45, PAL.hairA[1]);
    }
    b.circle(c.X(0), c.Y(-62), 3, SKIN[3]);
    c.line(-20, -84, 20, -84, RED[2]); // the hat fin flopped over
    c.line(-18, -85, 18, -85, GOLD[2]);
  }
  return c.frame();
}

function leafletFrames(bomb: boolean): Frame[] {
  const out: Frame[] = [];
  const n = bomb ? 2 : 3;
  for (let i = 0; i < n; i++) {
    const b = new PixelBuffer(12, 10);
    const w = i === 1 ? 6 : 8;
    const x0 = 6 - (w >> 1);
    b.rect(x0, 2, w, 6, PAL.cloth[2]);
    b.hline(x0, x0 + w - 1, 2, PAL.snow[3]);
    if (bomb) {
      b.line(x0 + 1, 3, x0 + w - 2, 6, RED[2]);
      b.line(x0 + w - 2, 3, x0 + 1, 6, RED[2]);
      b.set(x0 + w - 1, 1, i ? PAL.orange[2] : PAL.gold[3]);
    } else {
      b.hline(x0 + 1, x0 + w - 2, 4, RED[1]);
      b.hline(x0 + 1, x0 + w - 3, 6, PAL.stone[1]);
    }
    out.push({ buf: b.outline(INK), ox: 6, oy: 5 });
  }
  return out;
}

const STATES = [0, 1, 2] as const;
for (const s of STATES) {
  defineSprite(`${ART}/head-${s}`, () => headFrame(s));
  defineSprite(`${ART}/moustache-left-${s}`, () => [moustacheFrame(s, false, true), moustacheFrame(s, true, true)]);
  defineSprite(`${ART}/moustache-right-${s}`, () => [moustacheFrame(s, false, false), moustacheFrame(s, true, false)]);
  defineSprite(`${ART}/mouth-speaker-${s}`, () => [speakerFrame(s, false), speakerFrame(s, true)]);
}
defineSprite(`${ART}/hatch`, () => [hatchFrame(false), hatchFrame(true)]);
defineSprite(`${ART}/attention`, () => attentionFrame());
defineSprite(`${ART}/deflate`, () => deflateFrames(), { ticksPerFrame: 20, loop: false });
defineSprite(`${ART}/statue`, () => statueFrame(false));
defineSprite(`${ART}/mask`, () => statueFrame(true));
defineSprite(`${ART}/leaflet`, () => leafletFrames(false), { ticksPerFrame: 8 });
defineSprite(`${ART}/leaflet-bomb`, () => leafletFrames(true), { ticksPerFrame: 8 });
