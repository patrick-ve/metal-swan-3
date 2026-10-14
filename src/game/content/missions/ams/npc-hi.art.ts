/**
 * 2× ambient life of mission `ams` (docs/ART_GUIDE.md "2x art (mission ams)"): the 2× twins of
 * `npc/ams/ams-pigeons`, `npc/ams/ams-ducks`, `npc/ams/ams-tour-boat` and
 * `npc/ams/ams-window-waver/cat` (1× art in npc.art.ts). Each frame is the 1× frame's design on
 * the 2× grid — the same shapes at the same logical places (1× pixel (x, y) is the 2 × 2 block at
 * (2x, 2y)), the same buffer rectangle and anchor, the 2 hi-res px INK outline — with the finer
 * details the 2× grid allows: the pigeon's wing bars, white cere and orange eye; the mallard's
 * white neck ring, chestnut breast, curled tail and white-edged speculum (the hen mottled with an
 * eye stripe); the tour boat's tourists with faces, glints on the glass roof, hull plating, a
 * waving flag fold and finer foam; the cat's ears, slit eyes, whiskers and tabby stripes.
 */
import type { Color } from '../../../../engine/color';
import { INK, PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineHiSprite } from '../../../../engine/sprites';
import { HI, outlineHi } from '../../../art/hi';
import { hash2 } from '../../../art/paint';
import { windowDoneHi, windowFrameHi } from './npc.art';

// ------------------------------------------------------------------------------------ pigeons

/** `pigeon(f)` at 2× (14 × 12 logical, feet anchor 6, 10): stand, peck, step, wings up, wings down. */
function pigeonHi(f: number): Frame {
  const b = new PixelBuffer(28, 24);
  const fly = f >= 3;
  const peck = f === 1;
  // Tail with its dark tip band, the body.
  b.poly([[2, 12], [9, 10], [9, 17]], PAL.steel[1]);
  b.vline(2, 12, 12, PAL.steel[0]);
  b.vline(3, 12, 13, PAL.steel[0]);
  b.ellipse(6, 8, 14, 10, PAL.steel[2]);
  // Lit back (1× row 5), the belly shade (1× row 8).
  b.hline(8, 17, 10, PAL.steel[3]);
  b.hline(10, 16, 11, PAL.steel[3]);
  b.hline(10, 17, 16, PAL.steel[1]);
  b.hline(12, 16, 17, PAL.steel[1]);
  // Head and neck (1× head centre hx, hy): the iridescent neck patch, the round grey head.
  const hx = (peck ? 10 : 9) * HI;
  const hy = (peck ? 7 : 3) * HI;
  b.rect(hx - 2, hy + 2, 4, 4, PAL.teal[2]);
  b.set(hx - 1, hy + 2, PAL.teal[3]);
  b.rect(hx - 2, hy + 4, 2, 2, PAL.purple[2]);
  b.set(hx - 2, hy + 5, PAL.purple[1]);
  b.ellipse(hx - 2, hy - 2, 6, 6, PAL.steel[2]);
  b.hline(hx - 1, hx + 1, hy - 2, PAL.steel[3]);
  b.set(hx - 2, hy - 1, PAL.steel[3]);
  // The beak with its white cere.
  b.rect(hx + 4, hy, 2, 2, PAL.stone[1]);
  b.set(hx + 4, hy, PAL.snow[2]);
  // Wing: raised, lowered, or folded with two dark bars.
  if (f === 3) {
    b.poly([[8, 10], [17, 10], [11, 0], [6, 2]], PAL.steel[3]);
    b.line(9, 9, 7, 3, PAL.steel[2]);
    b.line(12, 9, 10, 2, PAL.steel[2]);
  } else if (f === 4) {
    b.poly([[8, 12], [17, 12], [13, 21], [6, 21]], PAL.steel[1]);
    b.line(9, 14, 7, 20, PAL.steel[0]);
    b.line(12, 14, 11, 20, PAL.steel[0]);
  } else {
    b.hline(8, 15, 12, PAL.steel[1]);
    b.hline(8, 15, 13, PAL.steel[2]);
    b.set(11, 13, PAL.steel[0]);
    b.set(14, 13, PAL.steel[0]);
  }
  outlineHi(b, 2);
  // The eye (on the 1× eye pixel): an orange iris round a dark pupil.
  b.rect(hx, hy, 2, 2, INK);
  b.set(hx, hy, PAL.orange[2]);
  if (!fly) {
    // Pink legs (1× (6, 9) and (7 or 8, 9)) with a lit shin pixel.
    for (const x of [6, f === 2 ? 8 : 7]) {
      b.rect(x * HI, 18, 2, 2, PAL.pink[1]);
      b.set(x * HI, 18, PAL.pink[2]);
    }
  }
  return { buf: b, ox: 6, oy: 10, density: HI };
}
defineHiSprite('npc/ams/ams-pigeons', () => [0, 1, 2, 3, 4].map(pigeonHi));

// ------------------------------------------------------------------------------------ ducks

/** `duck(f, drake)` at 2× (12 × 9 logical, waterline anchor 5, 7): paddle bob up, down. */
function duckHi(f: number, drake: boolean): Frame {
  const b = new PixelBuffer(24, 18);
  const d = f === 1 ? 2 : 0;
  const body = drake ? PAL.stone : PAL.brown;
  b.ellipse(2, 6 + d, 16, 8, body[2]);
  // Lit back (1× row 3), the darker tail (1× (1, 4)).
  b.hline(4, 15, 6 + d, body[3]);
  b.hline(6, 13, 7 + d, body[3]);
  b.rect(2, 8 + d, 2, 2, drake ? PAL.ink[1] : PAL.brown[1]);
  if (drake) {
    // Chestnut breast, the black stern with its curl.
    b.rect(14, 8 + d, 3, 4, PAL.rust[1]);
    b.set(14, 8 + d, PAL.rust[2]);
    b.rect(3, 7 + d, 3, 4, PAL.ink[1]);
    b.set(5, 6 + d, PAL.ink[1]);
  } else {
    // Mottled hen: darker feather marks on the 2× grid.
    for (let y = 8; y < 13; y++) for (let x = 4; x < 16; x++) if (hash2(x, y, 7) > 0.8 && (b.get(x, y + d) & 255) !== 0) b.set(x, y + d, PAL.brown[1]);
  }
  // The speculum (1× (4, 5) 3 × 1): blue on the drake with a white edge, brown on the hen.
  b.hline(8, 13, 9 + d, drake ? PAL.snow[3] : PAL.brown[3]);
  b.rect(8, 10 + d, 6, 2, drake ? PAL.sky[1] : PAL.brown[1]);
  if (drake) b.set(9, 10 + d, PAL.sky[2]);
  // Head (1× circle (8, 2) and rect (7, 1)): green with a lit crown and a white neck ring.
  const head = drake ? PAL.green : PAL.brown;
  b.ellipse(14, 2 + d, 6, 6, drake ? head[1] : head[2]);
  b.rect(14, 2 + d, 4, 4, drake ? head[2] : head[2]);
  b.hline(15, 17, 2 + d, drake ? PAL.green[3] : PAL.brown[3]);
  if (drake) b.hline(14, 17, 7 + d, PAL.snow[3]);
  else b.hline(15, 19, 4 + d, PAL.brown[0]);
  outlineHi(b, 2);
  // Eye (1× (9, 1)), the bill (1× (10, 2) 2 × 1) with its dark nail.
  b.set(17, 3 + d, INK);
  b.rect(20, 4 + d, 4, 2, drake ? PAL.gold[2] : PAL.orange[2]);
  b.hline(20, 22, 4 + d, drake ? PAL.gold[3] : PAL.orange[3]);
  b.set(23, 5 + d, PAL.ink[1]);
  // Ripple at the waterline (1× row 7): a lit crest over a softer line.
  for (let x = 0; x < 20; x++) b.set(x, 14, (x + f * 3) % 7 === 0 ? PAL.sky[2] : PAL.snow[3]);
  for (let x = 2; x < 18; x++) b.set(x, 15, PAL.snow[2]);
  return { buf: b, ox: 5, oy: 7, density: HI };
}
defineHiSprite('npc/ams/ams-ducks', () => [duckHi(0, true), duckHi(1, true), duckHi(0, false), duckHi(1, false)]);

// ------------------------------------------------------------------------------------ tour boat

const SKINS: readonly Color[] = [PAL.skinA[2], PAL.skinB[2], PAL.skinC[2], PAL.skinA[3]];
const SKIN_SHADE: readonly Color[] = [PAL.skinA[1], PAL.skinB[1], PAL.skinC[1], PAL.skinA[2]];
const HAIRS: readonly Color[] = [PAL.hairC[2], PAL.hairA[2], PAL.hairB[1], PAL.red[1], PAL.snow[2]];
const SHIRTS: readonly (readonly Color[])[] = [PAL.red, PAL.gold, PAL.teal];

/** `tourBoat(phase)` at 2× (116 × 32 logical, anchor 58, 28: the water line). */
function tourBoatHi(phase: number): Frame {
  const W = 116 * HI;
  const b = new PixelBuffer(W, 32 * HI);
  // Hull (1× poly (4, 20) (104, 20) (112, 21) (109, 27) (7, 27)) with a lit rim, the cloth
  // stripe, plating seams and the dark keel.
  b.poly([[8, 40], [209, 40], [225, 43], [219, 55], [14, 55]], PAL.navy[1]);
  b.hline(10, 219, 40, PAL.sky[2]);
  b.hline(10, 219, 41, PAL.sky[1]);
  b.hline(12, 217, 44, PAL.cloth[3]);
  b.hline(12, 217, 45, PAL.cloth[2]);
  for (let x = 30; x < 210; x += 24) b.vline(x, 46, 51, PAL.navy[0]);
  b.hline(14, 215, 52, PAL.navy[0]);
  b.hline(14, 215, 53, PAL.navy[0]);
  // The curved glass roof (1× ellipse (12, 6, 90, 14), its band rows 6–11) and its base line.
  b.ellipse(24, 12, 180, 28, PAL.sky[2]);
  b.rect(28, 26, 172, 14, 0);
  b.rect(24, 24, 180, 2, PAL.sky[3]);
  // Glints on the glass: short diagonal lit strokes.
  for (let x = 44; x < 196; x += 30) {
    b.line(x, 22, x + 4, 15, PAL.snow[3]);
    b.line(x + 3, 22, x + 5, 19, PAL.snow[2]);
  }
  b.hline(36, 193, 16, PAL.snow[3]);
  // Dark cabin interior and the tourists in their seats (1× torso rect (x − 2, 17, 5, 3), head
  // circle (x, 15, 1), hair row 13).
  b.rect(28, 26, 172, 14, PAL.navy[0]);
  for (let i = 0; i < 12; i++) {
    const x = (18 + i * 7 + ((i * 5) % 3)) * HI;
    const shirt = SHIRTS[i % 3];
    b.rect(x - 4, 34, 10, 6, shirt[2]);
    b.vline(x - 4, 34, 39, shirt[3]);
    b.vline(x + 5, 35, 39, shirt[1]);
    b.ellipse(x - 2, 28, 6, 6, SKINS[i % SKINS.length]);
    b.vline(x + 3, 30, 32, SKIN_SHADE[i % SKIN_SHADE.length]);
    b.hline(x - 2, x + 3, 26, HAIRS[(i * 3) % HAIRS.length]);
    b.hline(x - 2, x + 1, 27, HAIRS[(i * 3) % HAIRS.length]);
    // A face looking out of the boat: one eye, and every fourth tourist holds up a camera.
    b.set(x + 2, 30, PAL.ink[1]);
    if (i % 4 === 1) {
      b.rect(x + 3, 32, 3, 2, PAL.ink[1]);
      b.set(x + 5, 32, PAL.steel[3]);
    }
  }
  // Window struts (1× every 10 px from x 16): lit left column.
  for (let x = 32; x < 200; x += 20) {
    b.vline(x, 16, 23, PAL.snow[3]);
    b.vline(x + 1, 16, 23, PAL.snow[2]);
    b.vline(x, 24, 39, PAL.snow[2]);
    b.vline(x + 1, 24, 39, PAL.snow[1]);
  }
  // The pilot's window with a glint, the bow.
  b.rect(200, 28, 10, 12, PAL.sky[2]);
  b.hline(200, 209, 28, PAL.sky[3]);
  b.set(202, 30, PAL.snow[3]);
  b.set(203, 30, PAL.snow[3]);
  b.set(202, 31, PAL.snow[3]);
  // The Dutch flag at the stern on its pole, with a fold.
  b.vline(10, 12, 39, PAL.stone[3]);
  b.vline(11, 12, 39, PAL.stone[2]);
  const flag: readonly (readonly Color[])[] = [PAL.red, PAL.cloth, PAL.sky];
  const stripe: readonly number[] = [2, 3, 1];
  for (let k = 0; k < 3; k++) {
    b.rect(12, 12 + k * 4, 12, 4, flag[k][stripe[k]]);
    b.vline(17 + phase, 12 + k * 4, 15 + k * 4, flag[k][Math.max(0, stripe[k] - 1)]);
  }
  b.set(10, 11, PAL.gold[3]);
  b.set(11, 11, PAL.gold[2]);
  outlineHi(b, 2);
  // Wake (no outline): foam at the bow and stern (1× 3-px dashes), the sky-blue wash.
  const foam = phase ? [[112, 28], [108, 29], [3, 28], [0, 29], [104, 29]] : [[110, 28], [113, 29], [5, 29], [1, 28], [99, 29]];
  for (const [x, y] of foam) {
    const x1 = Math.min(W - 1, x * HI + 5);
    b.hline(x * HI, x1, y * HI, PAL.snow[3]);
    b.hline(x * HI + 1, x1, y * HI + 1, PAL.snow[2]);
  }
  b.hline(20, 209, 56, PAL.sky[2]);
  for (let x = 22; x < 208; x++) if ((x + phase * 5) % 9 < 5) b.set(x, 57, PAL.sky[3]);
  return { buf: b, ox: 58, oy: 28, density: HI };
}
defineHiSprite('npc/ams/ams-tour-boat', () => [tourBoatHi(0), tourBoatHi(1)]);

// ------------------------------------------------------------------------------------ window cat

/** The ginger cat on the window sill at 2× (the 1× inner 14 × 16 picture, tail swishing). */
function catHi(t: number): Frame {
  const c = new PixelBuffer(28, 32);
  // Body (1× ellipse (3, 7, 9, 9)) with a lit back and chest (1× row 8), tabby stripes.
  c.ellipse(6, 14, 18, 18, PAL.orange[1]);
  c.hline(10, 19, 16, PAL.orange[2]);
  c.hline(12, 19, 17, PAL.orange[2]);
  for (const [x, y] of [[8, 20], [10, 24], [9, 27]] as const) c.line(x, y, x + 3, y - 1, PAL.orange[0]);
  // Head (1× circle (8, 6, 3)) and ears (1× triangles), pink inside the ears.
  c.ellipse(10, 6, 14, 14, PAL.orange[2]);
  c.tri(10, 9, 12, 2, 15, 9, PAL.orange[2]);
  c.tri(18, 9, 20, 2, 23, 9, PAL.orange[2]);
  c.vline(12, 5, 7, PAL.pink[1]);
  c.vline(20, 5, 7, PAL.pink[1]);
  c.set(11, 3, PAL.orange[3]);
  c.hline(13, 18, 7, PAL.orange[3]);
  // Forehead stripes.
  c.vline(15, 8, 9, PAL.orange[1]);
  c.vline(17, 8, 10, PAL.orange[1]);
  // Eyes (1× (7, 6) and (10, 6)): green with a dark slit.
  for (const ex of [14, 20]) {
    c.rect(ex, 12, 2, 2, PAL.green[3]);
    c.vline(ex + 1, 12, 13, INK);
  }
  // Nose (1× (8, 8)), the mouth and whiskers.
  c.rect(16, 16, 2, 1, PAL.pink[2]);
  c.set(16, 17, PAL.orange[0]);
  c.hline(20, 22, 16, PAL.snow[3]);
  c.hline(20, 21, 18, PAL.snow[2]);
  c.hline(10, 13, 16, PAL.snow[3]);
  // Tail (1× thickLine (3, 14) → (t ? 0 : 1, t ? 8 : 7), 2 px) with a darker tip.
  c.thickLine(6, 28, t ? 0 : 2, t ? 16 : 14, 4, PAL.orange[0]);
  c.thickLine(6, 27, t ? 1 : 3, t ? 18 : 16, 1, PAL.orange[1]);
  c.rect(t ? 0 : 2, t ? 15 : 13, 2, 2, PAL.brown[1]);
  return windowDoneHi(windowFrameHi(), c);
}
defineHiSprite('npc/ams/ams-window-waver/cat', () => [catHi(0), catHi(1)]);
