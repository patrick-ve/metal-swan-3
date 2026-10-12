/**
 * Art of THE GRAND GRAND (GDD §10.4, §15.6) and its props. Drawn UNFLIPPED (facing right: the
 * keyboard at +x); every piano piece shares the piano anchor (the floor under the body's middle,
 * see geom.ts), so the boss draws them all at the same point (+ the fold drop).
 *
 * - `boss/grand-grand/case-0|1|2`        the glossy body (by the boss's damage state)
 * - `boss/grand-grand/lid-0|1|2`         7 frames: the lid opened 0°, 4° … 24° about the hinge
 * - `boss/grand-grand/keyboard-0|1|2`    10 frames: rest, rattle ×2, the glissando run ×7
 * - `boss/grand-grand/front-legs-0|1|2`  5 frames: stand, step, lift, folded ×2 (castors roll)
 * - `boss/grand-grand/back-legs`         4 frames: stand, step, folded ×2
 * - `boss/grand-grand/strings-0|1|2`     the gold harp frame (seen when the lid is gone)
 * - `boss/grand-grand/bench`             the Countess's velvet stool
 * - `boss/grand-grand/countess`          COUNTESS.* frames (seat anchor; stand / bow / faint: feet)
 * - `boss/grand-grand/countess-tall`     the same after the costume change (hairdo twice as tall)
 * - `boss/grand-grand/wreck`             the collapsed piano (floor anchor)
 * - `boss/grand-grand/key` (4), `rose`, `hammer` (4), `shard` (2), `wave` (3): centre anchor
 * - `boss/grand-grand/curtain`           one 48 px panel of the stage curtain (top-left anchor)
 * - `boss/grand-grand/audience`          3 frames (still, gasp, clap): a 64 px strip of the stalls
 * - `boss/grand-grand/stagehand`         2 frames: legs walking under the curtain hem
 * - `prop/chandelier/idle` (2), `prop/chandelier/fallen`, `prop/chandelier/chain`
 */
import type { Color } from '../../../../engine/color';
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL, type Ramp } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { hash2 } from '../../../art/paint';
import { Canvas, scuff, shadeBox, sparkle } from './art-kit';
import { PIANO } from './geom';

const ART = 'boss/grand-grand';
const BLK = PAL.black;
const GOLD = PAL.gold;
const DEG = Math.PI / 180;

/** Piano canvas bounds (local). */
const PX0 = -104;
const PX1 = 116;
const PY0 = -140;
const PY1 = 1;

export const LID_FRAMES = 7;
export const LID_STEP = PIANO.lidOpenMax / (LID_FRAMES - 1);
export const KEY_RATTLE = [1, 2] as const;
export const KEY_GLISS0 = 3;
export const KEY_GLISS_N = 7;
export const LEGS = { stand: 0, step: 1, lift: 2, foldA: 3, foldB: 4 } as const;
export const BACK_LEGS = { stand: 0, step: 1, foldA: 2, foldB: 3 } as const;
export const COUNTESS = { sitA: 0, sitB: 1, sing: 2, inhale: 3, highC: 4, stand: 5, bow: 6, faint: 7 } as const;

// ---------------------------------------------------------------------------------------------
// The case (body)
// ---------------------------------------------------------------------------------------------

function caseFrame(state: 0 | 1 | 2): Frame {
  const c = new Canvas(PX0, PY0, PX1, PY1);
  const { x, y, w, h } = PIANO.body;
  const L = c.layer();
  L.roundRect(c.X(x), c.Y(y), w, h, 5, BLK[1]);
  // The bulge at the back (the curved tail of a grand, seen from the side as a round end).
  L.ellipse(c.X(x - 6), c.Y(y + 4), 20, h - 8, BLK[1]);
  c.put(L);
  const b = c.b;
  // Glossy bands: the top rim, a lighter upper panel, a dark plinth at the bottom.
  c.rect(x - 2, y, w + 2, 3, BLK[2]);
  c.rect(x + 2, y + 1, w - 6, 1, BLK[3]);
  c.rect(x, y + h - 6, w, 6, BLK[0]);
  // Gold trim: two lines and a beaded moulding.
  c.rect(x + 2, y + 6, w - 4, 1, GOLD[2]);
  c.rect(x + 2, y + 7, w - 4, 1, GOLD[0]);
  c.rect(x + 2, y + h - 8, w - 4, 1, GOLD[1]);
  for (let i = x + 4; i < x + w - 4; i += 6) c.set(i, y + h - 10, GOLD[3]);
  // Gloss streaks (the case is lacquer: two long diagonal reflections).
  for (const [sx, len] of [
    [-60, 22],
    [-48, 12],
    [34, 18],
  ] as const) {
    for (let i = 0; i < len; i++) {
      const px = sx + i;
      const py = y + 12 + Math.round(i * 0.9);
      if (py > y + h - 12) break;
      c.set(px, py, i % 5 === 0 ? PAL.snow[1] : BLK[3]);
      c.set(px + 1, py, BLK[2]);
    }
  }
  // The lyre emblem in gold.
  const ex = 0;
  const ey = -82;
  b.ellipse(c.X(ex - 9), c.Y(ey - 10), 8, 18, GOLD[2], false);
  b.ellipse(c.X(ex + 1), c.Y(ey - 10), 8, 18, GOLD[2], false);
  c.rect(ex - 7, ey + 7, 14, 2, GOLD[2]);
  c.rect(ex - 7, ey + 9, 14, 1, GOLD[0]);
  for (let s = -3; s <= 3; s += 3) c.line(ex + s, ey - 8, ex + s, ey + 6, GOLD[3]);
  c.rect(ex - 9, ey - 12, 18, 2, GOLD[3]);
  c.set(ex - 10, ey - 12, GOLD[1]);
  c.set(ex + 9, ey - 12, GOLD[1]);
  // Scroll curls at the corners of the panel.
  for (const sx of [x + 10, x + w - 18]) {
    b.circle(c.X(sx + 4), c.Y(y + 16), 3, GOLD[1], false);
    c.set(sx + 4, y + 16, GOLD[3]);
    c.line(sx + 7, y + 16, sx + 14, y + 16, GOLD[1]);
  }
  // Front edge: the cheek block beside the keyboard.
  c.rect(x + w - 6, y + 4, 6, h - 10, BLK[2]);
  c.rect(x + w - 6, y + 4, 1, h - 10, BLK[3]);
  if (state > 0) {
    scuff(b, c.X(x), c.Y(y), w, h, state, 41, BLK[3]);
    if (state === 2) {
      // A splintered hole in the side panel with a string poking out.
      b.ellipse(c.X(-40), c.Y(-90), 22, 14, INK);
      b.ellipse(c.X(-38), c.Y(-88), 18, 10, PAL.red[0]);
      c.line(-36, -86, -24, -100, GOLD[3]);
      c.line(-24, -100, -20, -98, GOLD[3]);
      for (const [px, py] of [
        [-42, -92],
        [-30, -91],
        [-22, -85],
      ] as const) c.line(px, py, px - 2, py - 4, BLK[3]);
    }
  }
  return c.frame();
}

// ---------------------------------------------------------------------------------------------
// The lid (the upper jaw), rotated about the hinge
// ---------------------------------------------------------------------------------------------

function rot(px: number, py: number, a: number): [number, number] {
  const [hx, hy] = PIANO.hinge;
  const dx = px - hx;
  const dy = py - hy;
  return [hx + dx * Math.cos(a) + dy * Math.sin(a), hy - dx * Math.sin(a) + dy * Math.cos(a)];
}

/** The lid's front tip (local, unflipped) for an opening angle in degrees. */
export function lidTip(deg: number, out: [number, number] = [0, 0]): [number, number] {
  const [hx, hy] = PIANO.hinge;
  const a = deg * DEG;
  out[0] = hx + PIANO.lidLen * Math.cos(a);
  out[1] = hy - PIANO.lidLen * Math.sin(a);
  return out;
}

function lidFrame(state: 0 | 1 | 2, k: number): Frame {
  const c = new Canvas(PX0, -212, PX1, -84);
  const a = k * LID_STEP * DEG;
  const [hx, hy] = PIANO.hinge;
  const tipX = hx + PIANO.lidLen;
  const T = (px: number, py: number): [number, number] => {
    const [rx, ry] = rot(px, py, a);
    return [c.X(rx), c.Y(ry)];
  };
  const L = c.layer();
  // The slab: 10 px thick, the front lip hangs 12 px down over the mouth.
  L.poly([T(hx, hy - 10), T(tipX - 4, hy - 10), T(tipX, hy - 6), T(tipX, hy + 12), T(tipX - 8, hy + 12), T(tipX - 10, hy), T(hx, hy)], BLK[1]);
  c.put(L);
  const b = c.b;
  // Top surface highlight, gold edge band along the slab's bottom, felt lining when open.
  const seg = (x0: number, y0: number, x1: number, y1: number, col: Color): void => {
    const p = T(x0, y0);
    const q = T(x1, y1);
    b.line(p[0], p[1], q[0], q[1], col);
  };
  seg(hx + 2, hy - 9, tipX - 5, hy - 9, BLK[3]);
  seg(hx + 2, hy - 8, tipX - 5, hy - 8, BLK[2]);
  seg(hx + 2, hy - 2, tipX - 11, hy - 2, GOLD[2]);
  seg(hx + 2, hy - 1, tipX - 11, hy - 1, GOLD[0]);
  if (k > 0) {
    // The crimson felt under the lid shows while it is open.
    seg(hx + 6, hy, tipX - 11, hy, PAL.red[2]);
    seg(hx + 10, hy + 1, tipX - 11, hy + 1, PAL.red[1]);
  }
  // The lip: gold scallops like a moustache over the keys.
  for (let i = 0; i < 3; i++) {
    const p = T(tipX - 7 + i * 2, hy + 10);
    b.set(p[0], p[1], GOLD[3]);
  }
  seg(tipX - 8, hy + 11, tipX - 1, hy + 11, GOLD[1]);
  // Gloss streaks on the top.
  for (const s of [30, 46, 120]) seg(hx + s, hy - 7, hx + s + 8, hy - 7, PAL.snow[1]);
  // Gold hinge knuckles.
  const h0 = T(hx + 2, hy - 4);
  b.circle(h0[0], h0[1], 3, GOLD[1]);
  b.set(h0[0] - 1, h0[1] - 1, GOLD[3]);
  if (state > 0) {
    const r = state === 1 ? 1 : 2;
    for (let i = 0; i < 5 * r; i++) {
      const u = 12 + hash2(i, 7, 5) * (PIANO.lidLen - 30);
      const v = -8 + hash2(i, 8, 5) * 6;
      const p = T(hx + u, hy + v);
      b.set(p[0], p[1], INK);
      if (i % 2 === 0) b.set(p[0] + 1, p[1] + 1, INK);
    }
    if (state === 2) {
      // A long crack through the slab.
      let p = T(hx + 90, hy - 10);
      for (let i = 0; i < 8; i++) {
        const q = T(hx + 92 + i * 2 + (i % 2), hy - 9 + i);
        b.line(p[0], p[1], q[0], q[1], INK);
        p = q;
      }
      seg(hx + 130, hy - 6, hx + 138, hy - 6, PAL.orange[2]);
    }
  }
  return c.frame();
}

// ---------------------------------------------------------------------------------------------
// The keyboard (the lower jaw with key-teeth)
// ---------------------------------------------------------------------------------------------

function keyboardFrame(state: 0 | 1 | 2, k: number): Frame {
  const c = new Canvas(74, -104, 114, -48);
  const b = c.b;
  // The throat: a dark mouth plate behind the teeth.
  c.rect(84, -100, 16, 22, PAL.red[0]);
  c.rect(84, -100, 3, 22, INK);
  // The jaw (key bed) with gold trim and a curled cheek.
  const L = c.layer();
  L.roundRect(c.X(80), c.Y(-68), 30, 14, 3, BLK[1]);
  L.ellipse(c.X(100), c.Y(-74), 12, 12, BLK[1]);
  c.put(L);
  shadeBox(b, c.X(80), c.Y(-74), 30, 20, BLK);
  c.rect(81, -66, 28, 1, GOLD[2]);
  c.rect(81, -58, 28, 1, GOLD[1]);
  b.circle(c.X(106), c.Y(-71), 2, GOLD[2], false);
  // The teeth: seven white keys with three black ones between.
  const lost = state === 0 ? [] : state === 1 ? [2, 5] : [0, 1, 3, 4, 6];
  for (let i = 0; i < 7; i++) {
    if (lost.includes(i)) {
      // A broken stub.
      c.rect(84 + i * 3, -70, 2, 2, PAL.stone[2]);
      continue;
    }
    const up = k === KEY_RATTLE[0] ? (i % 2 ? 2 : 0) : k === KEY_RATTLE[1] ? (i % 2 ? 0 : 2) : 0;
    const lit = k >= KEY_GLISS0 && i <= k - KEY_GLISS0;
    const top = -82 - up;
    const col: Ramp = lit ? PAL.gold : PAL.snow;
    c.rect(84 + i * 3, top, 2, -68 - top, col[2]);
    c.set(84 + i * 3, top, col[3]);
    c.set(85 + i * 3, top, col[3]);
    c.rect(84 + i * 3, -70, 2, 1, col[1]);
  }
  for (const j of [1, 3, 5]) {
    if (state === 2 && j !== 3) continue;
    const up = k === KEY_RATTLE[0] ? 0 : k === KEY_RATTLE[1] ? 2 : 0;
    c.rect(85 + j * 3, -80 - up, 2, 6, INK);
    c.set(85 + j * 3, -80 - up, BLK[3]);
  }
  if (state === 2) {
    sparkle(b, c.X(96), c.Y(-76), PAL.gold[3]);
    c.line(88, -72, 92, -76, INK);
  }
  return c.frame();
}

// ---------------------------------------------------------------------------------------------
// Legs and castors
// ---------------------------------------------------------------------------------------------

function castor(c: Canvas, x: number, y: number, phase: number): void {
  const b = c.b;
  // Fork.
  c.rect(x - 4, y - 7, 8, 3, PAL.steel[2]);
  c.rect(x - 4, y - 7, 8, 1, PAL.steel[4]);
  // Brass wheel.
  b.circle(c.X(x), c.Y(y), 5, GOLD[1]);
  b.circle(c.X(x), c.Y(y), 3, GOLD[2]);
  b.circle(c.X(x), c.Y(y), 1, GOLD[0]);
  const a = (phase * Math.PI) / 4;
  const sx = Math.round(Math.cos(a) * 3);
  const sy = Math.round(Math.sin(a) * 3);
  c.set(x + sx, y + sy, GOLD[3]);
  c.set(x - sx, y - sy, GOLD[0]);
  c.set(x - 2, y - 3, GOLD[3]);
}

/** One piston leg standing on its castor (top at y top, castor centre at y wheelY). */
function piston(c: Canvas, x: number, top: number, wheelY: number, state: number, phase = 0): void {
  const b = c.b;
  const mid = top + Math.round((wheelY - 6 - top) * 0.55);
  // Sleeve (thick chrome cylinder).
  const L = c.layer();
  L.rect(c.X(x - 4), c.Y(top), 9, mid - top, PAL.steel[2]);
  shadeBox(L, c.X(x - 4), c.Y(top), 9, mid - top, PAL.steel, false);
  for (let yy = top; yy < mid; yy++) {
    L.set(c.X(x - 3), c.Y(yy), PAL.steel[4]);
    L.set(c.X(x - 2), c.Y(yy), PAL.steel[3]);
    L.set(c.X(x + 3), c.Y(yy), PAL.steel[1]);
    L.set(c.X(x + 4), c.Y(yy), PAL.steel[0]);
  }
  c.put(L);
  // Gold collar and the rod.
  c.rect(x - 5, mid - 2, 11, 3, GOLD[2]);
  c.rect(x - 5, mid - 2, 11, 1, GOLD[3]);
  c.rect(x - 2, mid + 1, 5, wheelY - 7 - mid, PAL.steel[3]);
  c.rect(x - 2, mid + 1, 1, wheelY - 7 - mid, PAL.snow[2]);
  c.rect(x + 2, mid + 1, 1, wheelY - 7 - mid, PAL.steel[1]);
  castor(c, x, wheelY, phase);
  if (state > 0) {
    scuff(b, c.X(x - 4), c.Y(top), 9, mid - top, state, 17 + x, PAL.snow[2]);
    if (state === 2) {
      sparkle(b, c.X(x + 3), c.Y(mid + 3), PAL.gold[3]);
      c.rect(x - 4, top + 6, 9, 3, PAL.sand[2]); // repair tape
      c.rect(x - 4, top + 6, 9, 1, PAL.sand[3]);
    }
  }
}

function legsFrame(xs: readonly number[], frame: number, state: number, front: boolean): Frame {
  const c = new Canvas(PX0, -60, PX1, PY1);
  const top = PIANO.body.y + PIANO.body.h - 2; // under the plinth
  for (const x of xs) {
    if (frame === LEGS.stand || (!front && frame === BACK_LEGS.stand)) piston(c, x, top, -5, state);
    else if ((front && frame === LEGS.step) || (!front && frame === BACK_LEGS.step)) piston(c, x, top, -9, state);
    else if (front && frame === LEGS.lift) piston(c, x, top, -18, state);
    else {
      // Folded: the legs swing up under the body; only the castors show.
      const ph = (front ? frame === LEGS.foldB : frame === BACK_LEGS.foldB) ? 2 : 0;
      castor(c, x, -5, ph);
      c.rect(x - 9, -12, 18, 3, PAL.steel[2]);
      c.rect(x - 9, -12, 18, 1, PAL.steel[4]);
      if (state === 2) sparkle(c.b, c.X(x + 6), c.Y(-12), PAL.gold[3]);
    }
  }
  return c.frame();
}

/** Destroyed front legs: snapped pistons, the front propped on a stack of opera scores. */
function frontStumpFrame(frame: number): Frame {
  const c = new Canvas(PX0, -60, PX1, PY1);
  const folded = frame >= LEGS.foldA;
  const x = PIANO.legFront;
  if (!folded) {
    c.rect(x - 4, -52, 9, 10, PAL.steel[1]);
    c.line(x - 4, -42, x + 4, -44, PAL.steel[0]);
    // The scores stack (books in crimson, navy and green, gold titles).
    const cols = [PAL.red, PAL.navy, PAL.green, PAL.red, PAL.purple, PAL.brown] as const;
    for (let i = 0; i < 6; i++) {
      const y = -6 - i * 6 - (i === 5 ? 1 : 0);
      const dx = (i % 2) * 2 - 1;
      const col = cols[i];
      c.rect(x - 10 + dx, y, 22, 6, col[1]);
      c.rect(x - 10 + dx, y, 22, 1, col[2]);
      c.rect(x - 6 + dx, y + 3, 10, 1, GOLD[2]);
    }
  } else {
    c.rect(x - 9, -12, 18, 3, PAL.steel[1]);
    c.line(x - 8, -10, x + 6, -6, PAL.steel[0]);
  }
  return c.frame();
}

// ---------------------------------------------------------------------------------------------
// Strings (the harp frame)
// ---------------------------------------------------------------------------------------------

function stringsFrame(state: 0 | 1 | 2): Frame {
  const c = new Canvas(-80, -114, 86, -80);
  const b = c.b;
  const { x, y, w, h } = PIANO.stringsBox;
  // The cast frame: a gold rim around the dark felt-lined well, with a curved brace.
  const L = c.layer();
  L.roundRect(c.X(x), c.Y(y), w, h, 4, GOLD[1]);
  shadeBox(L, c.X(x), c.Y(y), w, h, GOLD, false);
  c.put(L);
  c.rect(x + 3, y + 3, w - 8, h - 6, PAL.red[0]);
  c.rect(x + 3, y + 3, w - 8, 1, INK);
  // The strings: thin wires every other row (bronze bass strings at the back), slanting.
  const snapped = state === 0 ? 0 : state === 1 ? 3 : 7;
  for (let i = 0; i < 9; i++) {
    const sy = y + 5 + i * 2;
    const broken = i % 2 === 1 && (i >> 1) < snapped;
    const x0 = x + 5;
    const x1 = x + w - 8;
    const col = i < 3 ? GOLD[2] : PAL.steel[4];
    if (!broken) c.line(x0, sy, x1, sy - 1, col);
    else {
      // A snapped string curls up out of the well.
      c.line(x0, sy, x0 + 40 + i * 4, sy, col);
      c.set(x0 + 41 + i * 4, sy - 1, col);
      c.set(x0 + 42 + i * 4, sy - 2, col);
      c.set(x0 + 42 + i * 4, sy - 3, col);
    }
  }
  // The brace: a gold arch across the strings with three round holes.
  for (let bx = -40; bx <= 40; bx++) {
    const by = y + 4 + Math.round(((bx * bx) / 1600) * 10);
    c.rect(bx, by, 1, 3, bx % 2 ? GOLD[2] : GOLD[3]);
  }
  for (const hx of [-26, 0, 26]) {
    const hy = y + 5 + Math.round(((hx * hx) / 1600) * 10);
    c.b.circle(c.X(hx), c.Y(hy + 1), 2, GOLD[1]);
    c.set(hx, hy + 1, PAL.red[0]);
  }
  // Tuning pins at the front.
  for (let i = 0; i < 6; i++) c.set(x + w - 6, y + 4 + i * 3, PAL.snow[3]);
  c.rect(x + w - 8, y + 2, 1, h - 4, GOLD[0]);
  // The maker's plaque.
  c.rect(-14, y + h - 7, 28, 4, GOLD[3]);
  c.rect(-12, y + h - 6, 24, 2, GOLD[2]);
  if (state > 0) scuff(b, c.X(x), c.Y(y), w, h, state, 23, GOLD[3]);
  if (state === 2) {
    sparkle(b, c.X(10), c.Y(y + 6), PAL.snow[3]);
    sparkle(b, c.X(-40), c.Y(y + 16), PAL.gold[3]);
  }
  return c.frame();
}

function benchFrame(): Frame {
  const c = new Canvas(-10, -12, 10, 0);
  c.rect(-8, -11, 16, 5, PAL.red[2]);
  c.rect(-8, -11, 16, 1, PAL.red[3]);
  c.rect(-8, -7, 16, 1, PAL.red[1]);
  c.rect(-7, -6, 2, 6, GOLD[1]);
  c.rect(5, -6, 2, 6, GOLD[1]);
  c.set(-7, -6, GOLD[3]);
  c.set(5, -6, GOLD[3]);
  for (const bx of [-4, 0, 4]) c.set(bx, -9, GOLD[3]);
  return c.frame();
}

// ---------------------------------------------------------------------------------------------
// Countess Pizzicata
// ---------------------------------------------------------------------------------------------

const GOWN = PAL.green;
const SKIN = PAL.skinA;
const HAIR = PAL.snow;

/** Head at (hx, hy) (centre), facing right; mouth: 0 shut, 1 open, 2 wide; tall hairdo. */
function countessHead(c: Canvas, hx: number, hy: number, mouth: number, tall: boolean, tilt = 0): void {
  const b = c.b;
  // The beehive (behind the head): tall, layered, a tiara at its base.
  const hh = tall ? 30 : 15;
  const L = c.layer();
  L.ellipse(c.X(hx - 7 + tilt), c.Y(hy - 4 - hh), 13, hh + 4, HAIR[2]);
  L.ellipse(c.X(hx - 6), c.Y(hy - 6), 12, 10, HAIR[2]);
  shadeBox(L, c.X(hx - 7 + tilt), c.Y(hy - 4 - hh), 13, hh + 12, HAIR);
  c.put(L);
  for (let yy = hy - hh; yy < hy - 4; yy += 4) c.line(hx - 4 + tilt, yy, hx + 2 + tilt, yy + 2, HAIR[1]);
  // Face.
  b.circle(c.X(hx), c.Y(hy), 4, SKIN[2]);
  c.rect(hx + 3, hy - 1, 2, 2, SKIN[2]); // the nose
  c.set(hx + 4, hy - 1, SKIN[3]);
  c.set(hx - 2, hy - 2, SKIN[3]);
  c.set(hx + 1, hy - 2, INK); // eye (heavy lashes)
  c.set(hx + 2, hy - 3, INK);
  c.set(hx + 1, hy, PAL.pink[1]); // rouge
  if (mouth === 0) c.rect(hx + 2, hy + 2, 2, 1, PAL.red[2]);
  else if (mouth === 1) {
    c.rect(hx + 2, hy + 2, 2, 2, PAL.red[2]);
    c.set(hx + 2, hy + 3, INK);
  } else {
    c.rect(hx + 1, hy + 1, 3, 3, PAL.red[2]);
    c.rect(hx + 2, hy + 2, 1, 2, INK);
  }
  // The tiara: gold with a pink jewel.
  c.rect(hx - 4 + tilt, hy - 6, 8, 1, GOLD[2]);
  c.set(hx - 3 + tilt, hy - 7, GOLD[3]);
  c.set(hx + 2 + tilt, hy - 7, GOLD[3]);
  c.set(hx + tilt, hy - 8, PAL.pink[2]);
  c.set(hx + tilt, hy - 7, GOLD[3]);
}

function countessFrame(pose: number, tall: boolean): Frame {
  const c = new Canvas(-22, -64, 26, 6);
  const b = c.b;
  if (pose === COUNTESS.faint) {
    // Lying on her back across the wreck, one glove on her forehead (feet anchor at her middle).
    const L = c.layer();
    L.ellipse(c.X(-4), c.Y(-9), 26, 9, GOWN[2]);
    L.ellipse(c.X(-14), c.Y(-7), 10, 6, GOWN[2]);
    shadeBox(L, c.X(-14), c.Y(-9), 36, 9, GOWN);
    c.put(L);
    b.circle(c.X(-16), c.Y(-6), 4, SKIN[2]);
    const H = c.layer();
    H.ellipse(c.X(-22 - (tall ? 10 : 4)), c.Y(-10), tall ? 18 : 10, 9, HAIR[2]);
    shadeBox(H, c.X(-22 - (tall ? 10 : 4)), c.Y(-10), tall ? 18 : 10, 9, HAIR);
    c.put(H);
    c.set(-15, -7, INK);
    c.set(-17, -8, INK);
    c.rect(-17, -5, 2, 1, PAL.red[2]);
    c.line(-12, -10, -16, -12, PAL.snow[3]); // arm over the forehead
    c.line(-12, -9, -16, -11, PAL.snow[2]);
    c.rect(10, -6, 4, 3, PAL.snow[2]); // shoes
    return c.frame();
  }
  if (pose === COUNTESS.stand || pose === COUNTESS.bow) {
    const bow = pose === COUNTESS.bow;
    // Standing in her gown (feet anchor): a bell skirt to the floor.
    const L = c.layer();
    L.poly([[c.X(-10), c.Y(0)], [c.X(12), c.Y(0)], [c.X(5), c.Y(-22)], [c.X(-3), c.Y(-22)]], GOWN[2]);
    shadeBox(L, c.X(-10), c.Y(-22), 22, 22, GOWN);
    c.put(L);
    for (let i = -8; i <= 9; i += 6) c.line(i, -1, i * 0.4 + 1, -18, GOWN[1]);
    if (!bow) {
      c.rect(-3, -32, 8, 11, GOWN[3]);
      c.rect(-3, -32, 8, 2, SKIN[2]);
      c.rect(-2, -31, 6, 1, GOLD[3]); // necklace
      c.line(5, -30, 9, -36, PAL.snow[2]); // arm raised in triumph
      countessHead(c, 1, -37, 1, tall);
    } else {
      // A deep bow: the torso folds forward, the head low, one arm sweeping out.
      c.rect(1, -27, 11, 6, GOWN[3]);
      c.rect(9, -26, 4, 3, SKIN[2]);
      c.line(4, -22, 10, -14, PAL.snow[2]);
      c.line(-4, -24, -12, -18, PAL.snow[2]);
      const H = c.layer();
      H.ellipse(c.X(13), c.Y(-28 - (tall ? 18 : 8)), 9, tall ? 22 : 12, HAIR[2]);
      shadeBox(H, c.X(13), c.Y(-28 - (tall ? 18 : 8)), 9, tall ? 22 : 12, HAIR);
      c.put(H);
      b.circle(c.X(16), c.Y(-22), 4, SKIN[2]);
      c.set(18, -22, INK);
      c.rect(14, -26, 6, 1, GOLD[2]);
    }
    return c.frame();
  }
  // Seated (seat anchor): the gown spreads over the bench.
  const breathe = pose === COUNTESS.sitB ? 1 : 0;
  const puff = pose === COUNTESS.inhale ? 2 : 0;
  const L = c.layer();
  L.ellipse(c.X(-12), c.Y(-6), 26, 12, GOWN[2]);
  L.poly([[c.X(-11), c.Y(4)], [c.X(14), c.Y(4)], [c.X(10), c.Y(-2)], [c.X(-8), c.Y(-2)]], GOWN[2]);
  shadeBox(L, c.X(-12), c.Y(-6), 26, 10, GOWN);
  c.put(L);
  c.line(-6, 3, -2, -4, GOWN[1]);
  c.line(4, 3, 4, -4, GOWN[1]);
  // Bodice and shoulders.
  const T = c.layer();
  T.rect(c.X(-4 - puff / 2), c.Y(-16 + breathe), 9 + puff, 11 - breathe, GOWN[3]);
  shadeBox(T, c.X(-4 - puff / 2), c.Y(-16 + breathe), 9 + puff, 11 - breathe, GOWN);
  c.put(T);
  c.rect(-3, -16 + breathe, 7, 2, SKIN[2]);
  c.rect(-2, -15 + breathe, 5, 1, GOLD[3]);
  c.set(0, -14 + breathe, PAL.pink[2]);
  // Arms in long white opera gloves; the opera glasses in the near hand.
  const head = pose === COUNTESS.inhale ? -3 : 0;
  if (pose === COUNTESS.sing || pose === COUNTESS.highC) {
    c.line(4, -13, 12, -20, PAL.snow[2]);
    c.line(4, -12, 12, -19, PAL.snow[1]);
    c.set(13, -21, PAL.snow[3]);
    if (pose === COUNTESS.highC) {
      c.line(-4, -13, -12, -21, PAL.snow[2]);
      c.set(-13, -22, PAL.snow[3]);
    } else c.line(-3, -12, -2, -6, PAL.snow[1]);
  } else if (pose === COUNTESS.inhale) {
    c.line(4, -13, 2, -10, PAL.snow[2]); // hand on the heart
    c.line(-3, -12, -7, -6, PAL.snow[1]);
  } else {
    // Holding the opera glasses to her eyes.
    c.line(4, -13, 6, -20, PAL.snow[2]);
    c.rect(4, -23 + breathe, 4, 2, GOLD[2]);
    c.set(4, -23 + breathe, PAL.sky[3]);
    c.set(7, -23 + breathe, PAL.sky[3]);
    c.line(6, -21 + breathe, 7, -18 + breathe, GOLD[1]);
    c.line(-3, -12, -1, -6, PAL.snow[1]);
  }
  countessHead(c, 1, -22 + breathe + head, pose === COUNTESS.highC ? 2 : pose === COUNTESS.sing ? 1 : 0, tall, pose === COUNTESS.inhale ? -1 : 0);
  if (pose !== COUNTESS.sing && pose !== COUNTESS.highC && pose !== COUNTESS.inhale) {
    c.rect(4, -24 + breathe, 4, 2, GOLD[2]);
    c.set(5, -24 + breathe, PAL.sky[3]);
    c.set(7, -24 + breathe, PAL.sky[3]);
  }
  return c.frame();
}

// ---------------------------------------------------------------------------------------------
// The wreck, debris and projectiles
// ---------------------------------------------------------------------------------------------

function wreckFrame(): Frame {
  const c = new Canvas(-110, -60, 118, 1);
  const b = c.b;
  // Two halves of the case, slumped on the floor; the lid leans against them.
  const L = c.layer();
  L.poly([[c.X(-96), c.Y(0)], [c.X(-6), c.Y(0)], [c.X(-10), c.Y(-34)], [c.X(-92), c.Y(-28)]], BLK[1]);
  L.poly([[c.X(4), c.Y(0)], [c.X(100), c.Y(0)], [c.X(96), c.Y(-26)], [c.X(8), c.Y(-38)]], BLK[1]);
  c.put(L);
  c.line(-92, -27, -10, -33, BLK[3]);
  c.line(8, -37, 96, -25, BLK[3]);
  c.line(-90, -22, -12, -27, GOLD[2]);
  c.line(10, -31, 94, -20, GOLD[2]);
  // The harp frame sticking out with curled strings.
  c.line(-20, -34, 30, -54, GOLD[2]);
  c.line(-18, -33, 32, -53, GOLD[1]);
  for (let i = 0; i < 6; i++) {
    c.line(-14 + i * 8, -36 - i * 3, -10 + i * 8, -44 - i * 3, PAL.snow[2]);
    c.set(-9 + i * 8, -45 - i * 3, PAL.snow[2]);
    c.set(-8 + i * 8, -44 - i * 3, PAL.snow[2]);
  }
  // Keys scattered on the floor and a leg poking out.
  for (let i = 0; i < 9; i++) {
    const kx = -104 + Math.floor(hash2(i, 1, 3) * 210);
    c.rect(kx, -3, 6, 2, i % 3 === 0 ? INK : PAL.snow[2]);
  }
  c.line(96, -8, 112, -20, PAL.steel[3]);
  b.circle(c.X(113), c.Y(-21), 3, GOLD[1]);
  for (let i = 0; i < 3; i++) sparkle(b, c.X(-60 + i * 50), c.Y(-30 + (i % 2) * 6), PAL.gold[3]);
  return c.frame();
}

function keyFrames(): Frame[] {
  const out: Frame[] = [];
  for (let i = 0; i < 4; i++) {
    const b = new PixelBuffer(16, 16);
    const base = new PixelBuffer(16, 16);
    base.rect(6, 2, 4, 12, PAL.snow[2]);
    base.rect(6, 2, 1, 12, PAL.snow[3]);
    base.rect(9, 2, 1, 12, PAL.snow[0]);
    base.rect(6, 2, 4, 2, i % 2 ? PAL.snow[3] : PAL.snow[1]);
    const r = base.rotated((i * Math.PI) / 4, { quality: 'fast' });
    b.blit(r, Math.round((16 - r.w) / 2), Math.round((16 - r.h) / 2));
    out.push({ buf: b.outline(INK), ox: 8, oy: 8 });
  }
  return out;
}

function roseFrame(): Frame {
  const c = new Canvas(-6, -8, 6, 8);
  c.line(0, -1, 1, 6, PAL.green[2]);
  c.set(2, 2, PAL.green[3]);
  c.set(-1, 3, PAL.green[3]);
  c.b.circle(c.X(0), c.Y(-4), 3, PAL.red[2]);
  c.set(-1, -5, PAL.red[3]);
  c.set(1, -4, PAL.red[1]);
  c.set(0, -3, PAL.red[1]);
  return c.frame();
}

function hammerFrames(): Frame[] {
  const out: Frame[] = [];
  for (let i = 0; i < 4; i++) {
    const base = new PixelBuffer(14, 14);
    base.rect(6, 4, 2, 9, PAL.brown[2]); // shank
    base.rect(6, 4, 1, 9, PAL.brown[3]);
    base.roundRect(3, 1, 8, 5, 2, PAL.red[2]); // the felt head
    base.rect(4, 1, 6, 1, PAL.red[3]);
    base.rect(3, 4, 8, 1, PAL.cloth[2]);
    const r = base.rotated((i * Math.PI) / 2, { quality: 'fast' });
    const b = new PixelBuffer(16, 16);
    b.blit(r, Math.round((16 - r.w) / 2), Math.round((16 - r.h) / 2));
    out.push({ buf: b.outline(INK), ox: 8, oy: 8 });
  }
  return out;
}

function shardFrames(): Frame[] {
  const out: Frame[] = [];
  for (let i = 0; i < 2; i++) {
    const b = new PixelBuffer(10, 16);
    b.poly([[5, 1], [8, 6], [5, 14], [2, 6]], PAL.teal[3]);
    b.poly([[5, 1], [8, 6], [5, 14]], PAL.snow[1]);
    b.line(5, 2, 5, 12, PAL.snow[3]);
    if (i === 1) sparkle(b, 4, 5);
    out.push({ buf: b.outline(INK), ox: 5, oy: 8 });
  }
  return out;
}

function waveFrames(): Frame[] {
  const out: Frame[] = [];
  for (let i = 0; i < 3; i++) {
    const b = new PixelBuffer(20, 13);
    for (let k = 0; k < 3; k++) {
      const x = 3 + k * 5 + (i % 2);
      const h = 10 - Math.abs(k - 1) * 3 - (i === 2 ? 1 : 0);
      b.thickLine(x, 12, x + 2, 12 - h, 2, k === 1 ? PAL.gold[3] : PAL.gold[2]);
    }
    b.hline(1, 18, 11, PAL.gold[1]);
    out.push({ buf: b.outline(INK), ox: 10, oy: 6 });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Stage: curtain, audience, stage hands
// ---------------------------------------------------------------------------------------------

export const CURTAIN_W = 48;
export const CURTAIN_H = 216;

function curtainFrame(): Frame {
  const b = new PixelBuffer(CURTAIN_W, CURTAIN_H);
  const R = PAL.red;
  for (let x = 0; x < CURTAIN_W; x++) {
    // Four soft folds per panel: shade by a sine of x.
    const s = Math.sin((x / CURTAIN_W) * Math.PI * 4 - 0.6);
    const i = s > 0.8 ? 3 : s > 0.2 ? 2 : s > -0.5 ? 1 : 0;
    b.vline(x, 0, CURTAIN_H - 9, R[i]);
  }
  // Ordered dither at the band borders keeps the velvet soft.
  for (let y = 0; y < CURTAIN_H - 9; y += 2) {
    for (let x = 0; x < CURTAIN_W; x++) {
      const s = Math.sin((x / CURTAIN_W) * Math.PI * 4 - 0.6);
      if (Math.abs(s - 0.2) < 0.1 && ((x + y) & 3) === 0) b.set(x, y, R[1]);
    }
  }
  // Gold braid and fringe at the hem.
  b.rect(0, CURTAIN_H - 10, CURTAIN_W, 2, GOLD[2]);
  b.hline(0, CURTAIN_W - 1, CURTAIN_H - 10, GOLD[3]);
  for (let x = 0; x < CURTAIN_W; x += 2) b.vline(x, CURTAIN_H - 8, CURTAIN_H - 2 - (x % 4 === 0 ? 1 : 0), x % 4 === 0 ? GOLD[1] : GOLD[2]);
  return { buf: b, ox: 0, oy: 0 };
}

export const AUDIENCE_W = 64;

function audienceFrames(): Frame[] {
  const out: Frame[] = [];
  for (let f = 0; f < 3; f++) {
    const b = new PixelBuffer(AUDIENCE_W, 26);
    for (let i = 0; i < 6; i++) {
      const x = 5 + i * 11 + (i % 2);
      const tall = hash2(i, 1, 9) < 0.4 ? 2 : 0;
      const up = f === 1 ? 2 : f === 2 && i % 2 === 0 ? 1 : 0;
      const top = 8 - tall - up;
      const col = i % 3 === 0 ? PAL.navy[0] : INK;
      // Shoulders and a head; a few hats, a bun, opera glasses.
      b.ellipse(x - 6, top + 9, 13, 14, col);
      b.circle(x, top + 4, 4, col);
      if (i === 1) b.rect(x - 3, top - 2, 7, 3, col); // top hat
      if (i === 4) b.circle(x + 2, top - 1, 2, col); // bun
      if (i === 2 && f === 0) b.set(x + 3, top + 3, PAL.gold[2]);
      if (f === 2 && i % 2 === 0) {
        // Clapping hands up.
        b.rect(x - 7, top - 1, 2, 4, col);
        b.rect(x + 6, top - 1, 2, 4, col);
      }
      if (f === 1 && i % 3 === 1) b.set(x, top - 6, PAL.snow[3]); // a gasp: '!' above
      if (f === 1 && i % 3 === 1) b.vline(x, top - 10, top - 8, PAL.snow[3]);
    }
    out.push({ buf: b, ox: 0, oy: 26 });
  }
  return out;
}

function stagehandFrames(): Frame[] {
  const out: Frame[] = [];
  for (let f = 0; f < 2; f++) {
    const c = new Canvas(-8, -16, 8, 0);
    const a = f === 0 ? 3 : -3;
    c.b.thickLine(c.X(-1), c.Y(-15), c.X(-1 + a), c.Y(-3), 3, PAL.black[1]);
    c.b.thickLine(c.X(1), c.Y(-15), c.X(1 - a), c.Y(-3), 3, PAL.black[2]);
    c.rect(-3 + a, -3, 5, 2, INK);
    c.rect(-1 - a, -3, 5, 2, PAL.black[1]);
    out.push(c.frame());
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// The chandelier prop
// ---------------------------------------------------------------------------------------------

function chandelierFrame(glint: number): Frame {
  // 32 × 24 (anchor: the top middle, where the chain meets the crown).
  const c = new Canvas(-17, -1, 17, 25);
  const b = c.b;
  // Crown and the gold frame: a ring with curled arms.
  c.rect(-3, 0, 6, 3, GOLD[2]);
  c.set(-2, 0, GOLD[3]);
  b.ellipse(c.X(-14), c.Y(7), 28, 7, GOLD[1], false);
  b.ellipse(c.X(-12), c.Y(8), 24, 5, GOLD[2], false);
  c.line(0, 3, 0, 12, GOLD[2]);
  for (const s of [-1, 1]) {
    c.line(0, 4, s * 12, 9, GOLD[2]);
    c.line(s * 12, 9, s * 15, 6, GOLD[2]);
    // Candles with flames on the arm tips.
    c.rect(s * 15 - 1, 3, 2, 3, PAL.cloth[2]);
    c.set(s * 15, 2, PAL.gold[3]);
    c.set(s * 15, 1, PAL.orange[2]);
  }
  c.rect(-1, 2, 2, 3, PAL.cloth[2]);
  // Crystal drops hanging from the ring: three tiers.
  for (let i = 0; i < 7; i++) {
    const x = -12 + i * 4;
    const len = 4 + (3 - Math.abs(i - 3)) * 2;
    c.line(x, 11, x, 11 + len, PAL.teal[3]);
    c.set(x, 12 + len, PAL.snow[3]);
    c.set(x + 1, 11 + len, PAL.sky[3]);
  }
  c.rect(-2, 19, 4, 4, PAL.teal[3]);
  c.set(-1, 22, PAL.snow[3]);
  c.set(0, 23, PAL.snow[3]);
  sparkle(b, c.X(glint ? 6 : -7), c.Y(glint ? 15 : 17));
  return c.frame();
}

function chandelierFallenFrame(): Frame {
  // 32 × 16 heap of bent gold and crystal (feet anchor).
  const c = new Canvas(-17, -17, 17, 0);
  const b = c.b;
  b.ellipse(c.X(-15), c.Y(-12), 30, 9, GOLD[1], false);
  b.ellipse(c.X(-13), c.Y(-11), 26, 7, GOLD[2], false);
  c.line(-15, -2, -6, -10, GOLD[2]);
  c.line(14, -2, 6, -12, GOLD[2]);
  c.rect(-14, -4, 28, 4, GOLD[0]);
  c.rect(-14, -4, 28, 1, GOLD[2]);
  for (let i = 0; i < 9; i++) {
    const x = -13 + i * 3;
    const y = -6 - Math.round(hash2(i, 2, 4) * 6);
    c.rect(x, y, 2, 3, i % 2 ? PAL.teal[3] : PAL.snow[2]);
  }
  sparkle(b, c.X(4), c.Y(-9));
  return c.frame();
}

function chainFrame(): Frame {
  const b = new PixelBuffer(5, 8);
  b.ellipse(1, 0, 3, 5, GOLD[1], false);
  b.vline(2, 4, 7, GOLD[2]);
  b.set(2, 1, GOLD[3]);
  return { buf: b, ox: 2, oy: 0 };
}

// ---------------------------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------------------------

const STATES = [0, 1, 2] as const;
for (const s of STATES) {
  defineSprite(`${ART}/case-${s}`, () => caseFrame(s));
  defineSprite(`${ART}/lid-${s}`, () => Array.from({ length: LID_FRAMES }, (_, k) => lidFrame(s, k)));
  defineSprite(`${ART}/keyboard-${s}`, () => Array.from({ length: KEY_GLISS0 + KEY_GLISS_N }, (_, k) => keyboardFrame(s, k)));
  defineSprite(`${ART}/front-legs-${s}`, () => [0, 1, 2, 3, 4].map((f) => legsFrame([PIANO.legFront, PIANO.legFront - 12], f, s, true)));
  defineSprite(`${ART}/strings-${s}`, () => stringsFrame(s));
}
defineSprite(`${ART}/front-legs-broken`, () => [0, 1, 2, 3, 4].map((f) => frontStumpFrame(f)));
defineSprite(`${ART}/back-legs`, () => [0, 1, 2, 3].map((f) => legsFrame([PIANO.legBack, PIANO.legBack + 12], f, 0, false)));
defineSprite(`${ART}/bench`, () => benchFrame());
defineSprite(`${ART}/countess`, () => [0, 1, 2, 3, 4, 5, 6, 7].map((p) => countessFrame(p, false)));
defineSprite(`${ART}/countess-tall`, () => [0, 1, 2, 3, 4, 5, 6, 7].map((p) => countessFrame(p, true)));
defineSprite(`${ART}/wreck`, () => wreckFrame());
defineSprite(`${ART}/key`, () => keyFrames(), { ticksPerFrame: 3 });
defineSprite(`${ART}/rose`, () => roseFrame());
defineSprite(`${ART}/hammer`, () => hammerFrames(), { ticksPerFrame: 4 });
defineSprite(`${ART}/shard`, () => shardFrames(), { ticksPerFrame: 6 });
defineSprite(`${ART}/wave`, () => waveFrames(), { ticksPerFrame: 3 });
defineSprite(`${ART}/curtain`, () => curtainFrame());
defineSprite(`${ART}/audience`, () => audienceFrames());
defineSprite(`${ART}/stagehand`, () => stagehandFrames(), { ticksPerFrame: 6 });
defineSprite('prop/chandelier/idle', () => [chandelierFrame(0), chandelierFrame(1)], { ticksPerFrame: 30 });
defineSprite('prop/chandelier/fallen', () => chandelierFallenFrame());
defineSprite('prop/chandelier/chain', () => chainFrame());
