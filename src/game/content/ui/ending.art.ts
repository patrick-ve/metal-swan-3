/**
 * Art for the ending (GDD §2.6, §13.12). Original designs, palette ramps only, 1 px ink
 * outlines, light from the top left.
 *
 * - `ui/ending-organ`    the wrecked Grand Organ breaking in two: frames 0–3 the left half
 *                        tilting further left, 4–7 the right half tilting right (centre anchor)
 * - `ui/ending-pipe`     brass organ pipes tumbling: 3 lengths × 8 turns of 45° (centre anchor)
 * - `ui/fanfaroni`       Grand Marshal Fanfaroni (about 30 px, a bicorne as wide as he is tall):
 *                        0–1 floating under his hat, 2 sitting soaked, 3–4 marching with a
 *                        triangle, 5 the TING (feet anchor)
 * - `ui/ending-mk1`      Swan Mk1's rusty head with its MK1 lifebuoy (anchor: the waterline)
 * - `ui/ending-flyer`    SWAN-3 gliding with her wings open (2 frames; centre anchor; points
 *                        `seat`, `neck`, `legs`, `tail` for the riders who hang on)
 * - `ui/placard`         a critic's `5 ★` placard on a stick (anchor: the stick's foot)
 * - `ui/pigeon`, `ui/horse`  the audiences of Puffington's speech and Pizzicata's song
 * - `ui/leader-blare`, `ui/leader-rimshot`, `ui/leader-puffington`, `ui/leader-pizzicata`
 *                        the four Section Leaders on parade (frames 0–5 walk, 6–7 their gag)
 */
import { ascii } from '../../../engine/ascii';
import type { Color } from '../../../engine/color';
import { drawText } from '../../../engine/font';
import { INK, PAL } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineSprite } from '../../../engine/sprites';
import { poseFrames, withSwing } from '../../art/human-sprites';
import type { ArmPose, HumanStyle, Pose } from '../../art/humanoid';
import { WALK } from '../../art/poses';

const centre = (b: PixelBuffer, pts?: Frame['pts']): Frame => ({ buf: b, ox: b.w >> 1, oy: b.h >> 1, pts });

// ---------------------------------------------------------------------------------------------
// The Grand Organ, broken in two
// ---------------------------------------------------------------------------------------------

const ORGAN_W = 144;
const ORGAN_H = 100;
/** The crack runs down the middle with a zig-zag. */
const crackX = (y: number): number => 72 + (Math.floor(y / 7) % 2 === 0 ? -3 : 3);

/** A row of brass pipes standing on a base line; `broken` pipes end in a jagged stump. */
function pipeRow(b: PixelBuffer, x0: number, base: number, heights: readonly number[], broken: ReadonlySet<number>): void {
  heights.forEach((h, i) => {
    const x = x0 + i * 6;
    const top = base - h;
    b.rect(x, top, 5, h, PAL.gold[2]);
    b.rect(x, top, 1, h, PAL.gold[3]);
    b.rect(x + 4, top, 1, h, PAL.gold[1]);
    // The mouth: a dark slit a quarter up from the base, with a lit lip.
    b.rect(x + 1, base - Math.round(h * 0.3), 3, 2, INK);
    b.rect(x + 1, base - Math.round(h * 0.3) - 1, 3, 1, PAL.gold[3]);
    if (broken.has(i)) {
      b.set(x, top, 0);
      b.set(x + 2, top, 0);
      b.set(x + 3, top + 1, 0);
      b.set(x + 4, top, 0);
    } else b.rect(x, top, 5, 1, PAL.gold[1]);
  });
}

function organWhole(): PixelBuffer {
  const b = new PixelBuffer(ORGAN_W, ORGAN_H);
  // Pipe clusters behind the case (left, right and the tall middle ones).
  pipeRow(b, 6, 46, [22, 30, 36, 28, 18], new Set([2, 4]));
  pipeRow(b, 108, 46, [20, 34, 28, 36, 24], new Set([1]));
  pipeRow(b, 50, 30, [14, 22, 28, 34, 28, 22, 14], new Set([3, 5]));
  // The carved case: a gabled cabinet of dark wood.
  const wood = new PixelBuffer(ORGAN_W, ORGAN_H);
  wood.poly([12, 44, 72, 18, 132, 44, 132, 92, 12, 92], PAL.brown[1]);
  wood.bevel(PAL.brown, { light: 'tl', depth: 2, base: 1 });
  b.blit(wood, 0, 0);
  // Carved panels and gold trim.
  for (const x of [24, 40, 104, 120]) b.rect(x, 52, 1, 34, PAL.brown[0]);
  b.rect(12, 44, 121, 2, PAL.gold[2]);
  b.rect(12, 44, 121, 1, PAL.gold[3]);
  b.rect(12, 90, 121, 2, PAL.gold[1]);
  b.line(12, 44, 72, 18, PAL.gold[3]);
  b.line(72, 18, 132, 44, PAL.gold[2]);
  // The rose window: a gold ring with crimson and purple glass, cracked.
  b.circle(72, 32, 9, PAL.gold[2]);
  b.circle(72, 32, 7, PAL.purple[1]);
  for (let a = 0; a < 8; a++) {
    const ang = (a * Math.PI) / 4;
    b.line(72, 32, Math.round(72 + Math.cos(ang) * 7), Math.round(32 + Math.sin(ang) * 7), PAL.gold[1]);
  }
  b.set(70, 30, PAL.red[3]);
  b.set(74, 34, PAL.red[2]);
  b.set(69, 34, PAL.pink[2]);
  b.circle(72, 32, 2, PAL.gold[3]);
  // The loudspeaker horn in the centre, bent and dented.
  b.poly([56, 50, 88, 50, 82, 62, 62, 62], PAL.gold[2]);
  b.poly([60, 62, 84, 62, 80, 74, 64, 74], PAL.gold[1]);
  b.ellipse(62, 66, 20, 10, INK);
  b.ellipse(64, 67, 16, 7, PAL.ink[1]);
  b.rect(56, 50, 32, 1, PAL.gold[3]);
  // Bellows: accordion folds along the bottom.
  for (let i = 0; i < 9; i++) {
    const x = 34 + i * 9;
    b.poly([x, 78, x + 5, 76, x + 9, 78, x + 9, 88, x + 5, 86, x, 88], i % 2 ? PAL.sand[2] : PAL.sand[1]);
    b.rect(x, 78, 1, 10, PAL.brown[0]);
  }
  // Propeller hubs on the sides and a few smashed boards.
  for (const x of [6, 134]) {
    b.circle(x + 2, 66, 4, PAL.steel[2]);
    b.rect(x - 4, 65, 13, 2, PAL.steel[1]);
    b.set(x + 1, 65, PAL.steel[4]);
  }
  b.rect(98, 54, 6, 3, PAL.ink[1]);
  b.rect(30, 70, 4, 6, PAL.ink[1]);
  return b;
}

/** One half of the organ (0 left, 1 right), outlined along the break too. */
function organHalf(side: 0 | 1): PixelBuffer {
  const whole = organWhole();
  const out = new PixelBuffer(ORGAN_W, ORGAN_H);
  for (let y = 0; y < ORGAN_H; y++) {
    const cx = crackX(y);
    for (let x = 0; x < ORGAN_W; x++) {
      const left = x < cx;
      if ((side === 0) === left) out.set(x, y, whole.get(x, y));
    }
  }
  const trimmed = out.trimBounds();
  const crop = trimmed ? out.crop(trimmed.x, trimmed.y, trimmed.w, trimmed.h) : out;
  return crop.padded(1).outline(INK);
}

function organFrames(): Frame[] {
  const out: Frame[] = [];
  for (const side of [0, 1] as const) {
    const half = organHalf(side);
    for (let i = 0; i < 4; i++) {
      const angle = (side === 0 ? -1 : 1) * i * 0.07;
      out.push(centre(i === 0 ? half : half.rotated(angle)));
    }
  }
  return out;
}

/** Brass pipes for the bowling-pin fall: lengths 22, 30, 38; frame = length × 8 + turn. */
function pipeFrames(): Frame[] {
  const out: Frame[] = [];
  for (const len of [22, 30, 38]) {
    const b = new PixelBuffer(7, len + 4);
    // The foot cone, the body and the open top.
    b.poly([2, len + 3, 4, len + 3, 6, len - 2, 0, len - 2], PAL.gold[1]);
    b.rect(0, 0, 7, len - 1, PAL.gold[2]);
    b.rect(0, 0, 2, len - 1, PAL.gold[3]);
    b.rect(5, 0, 2, len - 1, PAL.gold[1]);
    b.rect(0, 0, 7, 2, PAL.gold[0]);
    b.rect(2, Math.round(len * 0.7), 3, 2, INK);
    b.rect(2, Math.round(len * 0.7) - 1, 3, 1, PAL.snow[3]);
    const pipe = b.padded(1).outline(INK);
    for (let a = 0; a < 8; a++) out.push(centre(pipe.rotated((a * Math.PI) / 4)));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Grand Marshal Fanfaroni (GDD §2.2): tiny, round, a giant bicorne with three white plumes, huge
// gold epaulettes, a moustache whose points reach past his ears, white gloves
// ---------------------------------------------------------------------------------------------

type FanfLegs = 'stand' | 'walk-a' | 'walk-b' | 'sit' | 'dangle-a' | 'dangle-b';
type FanfArms = 'down' | 'up' | 'triangle' | 'ting';

const FANF_W = 32;
const FANF_H = 44;
/** Feet anchor inside the buffer. */
const FX = 15;
const FY = 43;

function fanfaroni(legs: FanfLegs, arms: FanfArms, wet = false): Frame {
  const b = new PixelBuffer(FANF_W, FANF_H);
  const y0 = FY - 37; // top of the hat brim area when worn
  const hatDy = arms === 'up' ? -7 : wet ? 2 : 0;
  // Legs: white trousers, black boots.
  const leg = (x: number, y: number, h: number): void => {
    b.rect(x, y, 3, h, PAL.snow[2]);
    b.rect(x, y, 1, h, PAL.snow[3]);
    b.rect(x, y + h, 4, 2, PAL.black[1]);
    b.set(x + 3, y + h, PAL.black[2]);
  };
  const ly = FY - 6;
  switch (legs) {
    case 'stand':
      leg(FX - 4, ly, 4);
      leg(FX + 1, ly, 4);
      break;
    case 'walk-a':
      leg(FX - 6, ly, 4);
      leg(FX + 3, ly, 4);
      break;
    case 'walk-b':
      leg(FX - 3, ly, 4);
      leg(FX, ly - 1, 4);
      break;
    case 'sit':
      b.rect(FX, FY - 8, 8, 3, PAL.snow[2]);
      b.rect(FX + 8, FY - 9, 2, 4, PAL.black[1]);
      b.rect(FX - 2, FY - 7, 8, 3, PAL.snow[1]);
      b.rect(FX + 6, FY - 8, 2, 4, PAL.black[1]);
      break;
    case 'dangle-a':
    case 'dangle-b': {
      const k = legs === 'dangle-a' ? 1 : -1;
      b.rect(FX - 4, ly - 1, 3, 5, PAL.snow[2]);
      b.rect(FX + 1, ly - 1, 3, 5, PAL.snow[2]);
      b.rect(FX - 4 + k, ly + 4, 3, 3, PAL.black[1]);
      b.rect(FX + 1 - k, ly + 4, 3, 3, PAL.black[1]);
      break;
    }
  }
  // The round body: crimson tunic with gold cross-cords and a white belt.
  const bodyTop = legs === 'sit' ? FY - 20 : FY - 18;
  const body = new PixelBuffer(FANF_W, FANF_H);
  body.ellipse(FX - 7, bodyTop, 15, 14, wet ? PAL.red[1] : PAL.red[2]);
  body.bevel(PAL.red, { light: 'tl', depth: 1, base: wet ? 1 : 2 });
  b.blit(body, 0, 0);
  b.line(FX - 4, bodyTop + 3, FX + 4, bodyTop + 10, PAL.gold[3]);
  b.line(FX + 4, bodyTop + 3, FX - 4, bodyTop + 10, PAL.gold[2]);
  b.rect(FX - 6, bodyTop + 11, 13, 1, PAL.snow[3]);
  // Huge gold epaulettes with a fringe.
  for (const ex of [FX - 10, FX + 5]) {
    b.ellipse(ex, bodyTop + 1, 7, 4, PAL.gold[3]);
    b.rect(ex + 1, bodyTop + 3, 5, 1, PAL.gold[1]);
    for (let i = 0; i < 3; i++) b.set(ex + 1 + i * 2, bodyTop + 4, PAL.gold[2]);
  }
  // Head with the long curled moustache (points past the ears) and a proud nose.
  const hy = bodyTop - 7;
  const head = new PixelBuffer(FANF_W, FANF_H);
  head.ellipse(FX - 4, hy, 10, 9, PAL.skinA[2]);
  head.bevel(PAL.skinA, { light: 'tl', depth: 1, base: 2 });
  b.blit(head, 0, 0);
  b.set(FX + 6, hy + 4, PAL.skinA[2]);
  b.set(FX + 6, hy + 5, PAL.skinA[1]);
  b.set(FX + 3, hy + 3, INK); // eye
  if (wet) b.set(FX + 3, hy + 4, PAL.sky[3]); // a tear, or the lake
  const my = hy + 6;
  b.rect(FX - 3, my, 10, 1, INK);
  b.rect(FX - 1, my + 1, 6, 1, INK);
  if (wet) {
    // Drooping: the points hang down.
    b.set(FX - 4, my + 1, INK);
    b.set(FX - 5, my + 2, INK);
    b.set(FX + 7, my + 1, INK);
    b.set(FX + 8, my + 2, INK);
  } else {
    b.set(FX - 4, my - 1, INK);
    b.set(FX - 5, my - 2, INK);
    b.set(FX - 4, my - 3, INK);
    b.set(FX + 7, my - 1, INK);
    b.set(FX + 8, my - 2, INK);
    b.set(FX + 7, my - 3, INK);
  }
  // Arms and white gloves.
  const glove = (x: number, y: number): void => {
    b.rect(x, y, 3, 3, PAL.snow[3]);
    b.set(x + 2, y + 2, PAL.snow[1]);
  };
  const sleeve = (x0: number, y0s: number, x1: number, y1: number): void => {
    b.thickLine(x0, y0s, x1, y1, 3, PAL.red[1]);
  };
  const sy = bodyTop + 3;
  if (arms === 'up') {
    sleeve(FX - 7, sy, FX - 9, hy - 3);
    sleeve(FX + 7, sy, FX + 9, hy - 3);
    glove(FX - 11, hy - 6);
    glove(FX + 8, hy - 6);
  } else if (arms === 'triangle' || arms === 'ting') {
    // Near hand holds the triangle out front; far hand the beater.
    sleeve(FX + 6, sy, FX + 10, sy + 5);
    glove(FX + 9, sy + 4);
    const tx = FX + 11;
    const ty = sy + 6;
    b.line(tx, ty, tx + 4, ty + 7, PAL.steel[3]);
    b.line(tx + 4, ty + 7, tx - 3, ty + 7, PAL.steel[2]);
    b.line(tx - 3, ty + 7, tx, ty + 1, PAL.steel[3]);
    sleeve(FX - 6, sy, FX - 9, sy + 6);
    glove(FX - 11, sy + 6);
    if (arms === 'ting') {
      b.line(FX - 9, sy + 7, tx + 1, ty + 4, PAL.steel[4]);
      b.set(tx + 5, ty + 2, PAL.snow[3]);
      b.set(tx + 6, ty + 1, PAL.snow[3]);
      b.set(tx + 6, ty + 3, PAL.gold[3]);
    } else b.line(FX - 9, sy + 7, FX - 5, sy + 2, PAL.steel[4]);
  } else {
    sleeve(FX + 6, sy, FX + 7, sy + 7);
    glove(FX + 6, sy + 7);
    sleeve(FX - 6, sy, FX - 7, sy + 7);
    glove(FX - 9, sy + 7);
    // The conductor's baton.
    b.line(FX + 8, sy + 8, FX + 13, sy + 2, PAL.snow[3]);
    b.set(FX + 13, sy + 2, PAL.gold[3]);
  }
  // The bicorne: a crimson crescent with a gold edge, a cockade and three white plumes.
  const top = y0 + hatDy + (legs === 'sit' ? -2 : 0);
  const hat = new PixelBuffer(FANF_W, FANF_H);
  const hatC = wet ? PAL.red[1] : PAL.red[2];
  hat.poly([1, top + 10, 4, top + 6, 9, top + 3, 15, top + 2, 21, top + 3, 26, top + 6, 29, top + 10, 22, top + 9, 15, top + 9, 8, top + 9], hatC);
  hat.bevel(PAL.red, { light: 'tl', depth: 1, base: wet ? 1 : 2 });
  b.blit(hat, 0, 0);
  b.line(1, top + 10, 8, top + 9, PAL.gold[3]);
  b.line(8, top + 9, 22, top + 9, PAL.gold[3]);
  b.line(22, top + 9, 29, top + 10, PAL.gold[2]);
  b.circle(15, top + 5, 2, PAL.gold[3]);
  b.set(15, top + 5, PAL.snow[3]);
  for (const [px, lean] of [[10, -1], [15, 0], [20, 1]] as const) {
    if (wet) {
      // Soaked plumes flop over.
      b.line(px, top + 2, px + 3, top + 4, PAL.snow[1]);
      b.set(px + 3, top + 5, PAL.sky[3]);
    } else {
      b.line(px, top + 2, px + lean, top - 3, PAL.snow[3]);
      b.set(px + lean - 1, top - 2, PAL.snow[2]);
      b.set(px + lean + 1, top - 3, PAL.snow[2]);
    }
  }
  if (wet) {
    // Drips from the brim.
    for (const x of [3, 12, 27]) b.set(x, top + 12, PAL.sky[3]);
  }
  b.outline(INK);
  return { buf: b, ox: FX, oy: FY + 1 };
}

function fanfaroniFrames(): Frame[] {
  return [
    fanfaroni('dangle-a', 'up'),
    fanfaroni('dangle-b', 'up'),
    fanfaroni('sit', 'down', true),
    fanfaroni('walk-a', 'triangle'),
    fanfaroni('walk-b', 'triangle'),
    fanfaroni('stand', 'ting'),
  ];
}

// ---------------------------------------------------------------------------------------------
// Swan Mk1's head (GDD §2.5): an older, rusty SWAN-3 head with a dented dome, river weed and a
// lifebuoy stencilled MK1 (red and ivory quarters) at the waterline. No hat of any kind.
// ---------------------------------------------------------------------------------------------

function mk1Frames(): Frame[] {
  const w = 34;
  const h = 40;
  const b = new PixelBuffer(w, h);
  const water = h - 4;
  // Neck: a rusty S rising from the water.
  const neck = new PixelBuffer(w, h);
  neck.thickLine(16, water, 14, water - 12, 6, PAL.snow[1]);
  neck.thickLine(14, water - 12, 16, water - 20, 5, PAL.snow[1]);
  neck.bevel(PAL.snow, { light: 'tl', depth: 1, base: 1 });
  b.blit(neck, 0, 0);
  for (let i = 0; i < 4; i++) b.set(13 + (i % 2), water - 4 - i * 4, PAL.rust[1]);
  // Dome (dented) and the faded face.
  const dome = new PixelBuffer(w, h);
  dome.ellipse(11, water - 31, 13, 11, PAL.snow[1]);
  dome.bevel(PAL.snow, { light: 'tl', depth: 1, base: 1 });
  b.blit(dome, 0, 0);
  b.rect(14, water - 31, 3, 1, 0); // the dent
  b.set(14, water - 30, PAL.snow[0]);
  b.set(15, water - 30, PAL.snow[0]);
  for (const [x, y] of [[13, water - 26], [19, water - 22], [12, water - 23], [20, water - 28]] as const) b.set(x, y, PAL.rust[2]);
  // Dull lens eye, navy face patch, faded beak with a rusty nail.
  b.set(19, water - 27, PAL.gold[1]);
  b.set(20, water - 27, PAL.stone[2]);
  b.set(20, water - 26, PAL.navy[0]);
  b.set(21, water - 25, PAL.navy[0]);
  for (let i = 0; i < 8; i++) {
    b.set(23 + i, water - 25 + (i >> 2), i < 7 ? PAL.orange[1] : PAL.rust[1]);
    if (i < 5) b.set(23 + i, water - 24 + (i >> 2), PAL.orange[0]);
  }
  // River weed draped over the dome.
  for (const [x, len] of [[12, 3], [14, 5], [16, 2], [18, 4], [20, 2]] as const) b.rect(x, water - 32, 1, len, PAL.green[x % 3 === 0 ? 1 : 2]);
  b.rect(12, water - 32, 9, 1, PAL.green[2]);
  // The lifebuoy at the waterline: a ring in red and ivory quarters with MK1 on its front.
  const ring = new PixelBuffer(w, h);
  ring.ellipse(3, water - 7, 28, 10, PAL.snow[2]);
  ring.rect(3, water - 7, 7, 10, 0);
  ring.ellipse(3, water - 7, 28, 10, PAL.snow[2]);
  for (let x = 3; x < 31; x++) for (let y = water - 7; y < water + 3; y++) if (ring.get(x, y) !== 0 && (x < 10 || x > 24)) ring.set(x, y, PAL.red[2]);
  ring.bevel(PAL.snow, { light: 'tl', depth: 1, only: PAL.snow[2] });
  ring.bevel(PAL.red, { light: 'tl', depth: 1, only: PAL.red[2] });
  b.blit(ring, 0, 0);
  drawText(b, 'MK1', 17, water - 5, { font: 'small', color: PAL.ink[1], align: 'center' });
  b.outline(INK);
  // Ripples on the water (no outline).
  b.rect(0, water + 3, w, 1, PAL.sky[3]);
  b.rect(4, water + 4, 8, 1, PAL.snow[3]);
  b.rect(22, water + 4, 9, 1, PAL.snow[3]);
  return [{ buf: b, ox: w >> 1, oy: water + 3 }];
}

// ---------------------------------------------------------------------------------------------
// SWAN-3 gliding (the Splashdown): wings open, legs trailing, neck stretched forward
// ---------------------------------------------------------------------------------------------

function flyerFrames(): Frame[] {
  const out: Frame[] = [];
  for (let f = 0; f < 2; f++) {
    const w = 84;
    const h = 52;
    const b = new PixelBuffer(w, h);
    const lift = f === 0 ? 0 : 4;
    // Far wing (behind the hull), up and back.
    const far = new PixelBuffer(w, h);
    far.poly([40, 28, 30, 4 + lift, 40, 2 + lift, 54, 26], PAL.snow[1]);
    far.rect(30, 3 + lift, 9, 3, PAL.navy[1]);
    b.blit(far.outline(INK), 0, 0);
    // Legs trailing back with orange paddles.
    b.thickLine(30, 36, 14, 40, 2, PAL.steel[2]);
    b.thickLine(34, 37, 18, 43, 2, PAL.steel[1]);
    b.poly([10, 38, 15, 39, 13, 43, 8, 42], PAL.orange[2]);
    b.poly([14, 41, 19, 42, 17, 46, 12, 45], PAL.orange[1]);
    // Tail blades and the hull.
    const hull = new PixelBuffer(w, h);
    hull.poly([22, 28, 10, 20, 16, 20, 26, 27], PAL.snow[2]);
    hull.poly([22, 31, 8, 27, 14, 26, 26, 30], PAL.snow[1]);
    hull.ellipse(20, 24, 40, 16, PAL.snow[2]);
    hull.bevel(PAL.snow, { light: 'tl', depth: 1 });
    hull.rect(23, 34, 34, 2, PAL.navy[1]);
    for (let x = 26; x < 56; x += 6) hull.set(x, 28, PAL.gold[3]);
    // The seat pad and the gold handles.
    hull.rect(32, 23, 12, 3, PAL.navy[1]);
    hull.rect(33, 23, 10, 1, PAL.navy[2]);
    hull.rect(46, 20, 2, 5, PAL.gold[2]);
    // The neck, straight forward, and the head with its beak.
    hull.thickLine(56, 30, 70, 24, 5, PAL.snow[2]);
    for (let i = 0; i < 3; i++) hull.set(60 + i * 4, 30 - i * 2, PAL.snow[0]);
    hull.ellipse(66, 17, 10, 9, PAL.snow[3]);
    hull.bevel(PAL.snow, { light: 'tl', depth: 1, only: PAL.snow[3] });
    hull.set(71, 19, PAL.gold[2]);
    hull.set(72, 19, INK);
    hull.set(73, 21, PAL.navy[0]);
    for (let i = 0; i < 8; i++) {
      hull.set(75 + i, 21, i < 7 ? PAL.orange[3] : PAL.steel[3]);
      if (i < 6) hull.set(75 + i, 22, PAL.orange[1]);
    }
    // The near wing, spread up and back over the hull.
    hull.poly([36, 30, 20, 6 - lift, 30, 4 - lift, 50, 28], PAL.snow[3]);
    hull.rect(20, 5 - lift, 9, 3, PAL.navy[2]);
    hull.line(36, 30, 24, 8 - lift, PAL.snow[1]);
    b.blit(hull.outline(INK), 0, 0);
    const ax = 40;
    const ay = 30;
    out.push({ buf: b, ox: ax, oy: ay, pts: { seat: [38 - ax, 24 - ay], neck: [64 - ax, 28 - ay], legs: [14 - ax, 42 - ay], tail: [12 - ax, 22 - ay] } });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Parade props
// ---------------------------------------------------------------------------------------------

/** A critic's placard: `5 ★` on white card, held up on a stick (anchor: the hand). */
function placardFrames(): Frame[] {
  const b = new PixelBuffer(20, 22);
  b.rect(9, 9, 2, 13, PAL.brown[2]);
  b.rect(1, 0, 18, 11, PAL.snow[3]);
  b.rect(1, 10, 18, 1, PAL.snow[1]);
  drawText(b, '5', 4, 2, { font: 'small', color: PAL.red[2] });
  drawText(b, '★', 11, 2, { font: 'small', color: PAL.gold[2] });
  const p = b.padded(1).outline(INK);
  return [{ buf: p, ox: 10, oy: 16 }];
}

/** A pigeon on the cobbles: frame 0 listening, frame 1 pecking. */
function pigeonFrames(): Frame[] {
  const key = { g: PAL.stone[2], G: PAL.stone[3], d: PAL.stone[1], p: PAL.purple[2], o: PAL.orange[2], k: INK, w: PAL.snow[3] };
  const rows = [
    ['....GG.', '...Gkgo', '...gpg.', '.Gggpg.', 'Gggggg.', '.dggg..', '..o.o..'],
    ['.......', '.......', '...GG..', '.GGgkgo', 'Gggpgg.', '.dggg..', '..o.o..'],
  ];
  return rows.map((r) => ({ buf: ascii(r, key).padded(1).outline(INK), ox: 4, oy: 8 }));
}

/** A parade horse with a white plume (2 walk frames), facing right. */
function horseFrames(): Frame[] {
  const out: Frame[] = [];
  for (let f = 0; f < 2; f++) {
    const w = 34;
    const h = 30;
    const b = new PixelBuffer(w, h);
    const body = new PixelBuffer(w, h);
    // Body, neck and head.
    body.ellipse(5, 10, 22, 10, PAL.brown[2]);
    body.poly([22, 12, 26, 3, 30, 3, 31, 7, 27, 9, 25, 16], PAL.brown[2]);
    body.ellipse(26, 2, 8, 5, PAL.brown[2]);
    body.bevel(PAL.brown, { light: 'tl', depth: 1, base: 2 });
    b.blit(body, 0, 0);
    // Legs (the pairs swap between the frames).
    const legs = f === 0 ? [7, 11, 20, 24] : [9, 9, 22, 22];
    const kick = f === 0 ? [0, 2, 0, 2] : [1, 0, 1, 0];
    legs.forEach((x, i) => {
      b.rect(x + kick[i], 18, 2, 9, PAL.brown[1]);
      b.rect(x + kick[i], 26, 3, 2, PAL.ink[1]);
    });
    // Mane, tail, eye, the crimson saddle cloth with gold trim and a white plume.
    b.rect(22, 4, 3, 8, PAL.brown[0]);
    b.line(5, 12, 1, 22, PAL.brown[0]);
    b.set(29, 4, INK);
    b.rect(10, 9, 10, 6, PAL.red[2]);
    b.rect(10, 15, 10, 1, PAL.gold[3]);
    b.line(26, 2, 25, -2 + 3, PAL.snow[3]);
    b.rect(25, 0, 2, 2, PAL.snow[3]);
    out.push({ buf: b.padded(1, 2, 1, 1).outline(INK), ox: 17, oy: 30 });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// The Section Leaders (GDD §2.2) on parade, built with the humanoid rig
// ---------------------------------------------------------------------------------------------

const LEGION_BASE = { pants: 'snow', boots: 'black', gloves: 'snow', belt: 'snow', accent: 'gold' } as const;

const LEADERS: Readonly<Record<string, HumanStyle>> = {
  blare: { ...LEGION_BASE, skin: 'skinB', hair: 'hairA', hairStyle: 'short', headgear: 'cap', gear: 'black', top: 'red', topType: 'tunic', build: 'heavy', accessories: ['epaulettes', 'cross-belt'], face: ['moustache'] },
  rimshot: { ...LEGION_BASE, skin: 'skinA', hair: 'stone', hairStyle: 'short', headgear: 'shako', gear: 'black', top: 'red', topType: 'tunic', build: 'normal', accessories: ['epaulettes'], face: ['moustache', 'blush'] },
  puffington: { ...LEGION_BASE, skin: 'skinC', hair: 'stone', hairStyle: 'parted', headgear: 'cap', gear: 'red', top: 'red', topType: 'coat', build: 'slim', accessories: ['epaulettes', 'scarf'], face: ['moustache', 'glasses'] },
  pizzicata: { ...LEGION_BASE, skin: 'skinA', hair: 'gold', hairStyle: 'long', headgear: 'none', top: 'red', topType: 'coat', pants: 'red', build: 'slim', accessories: ['epaulettes'], face: ['blush'] },
};

/** Arm poses for each leader's gag (two frames). */
const GAGS: Readonly<Record<string, readonly [ArmPose, ArmPose]>> = {
  // Directing traffic: the megaphone up at the mouth, the other arm waving.
  blare: [{ to: [5, -7], hand: 'grip' }, { to: [7, -9], hand: 'open' }],
  // The joke: a finger raised for the punchline.
  rimshot: [{ to: [6, 2], hand: 'point' }, { to: [5, -9], hand: 'point' }],
  // The speech: one arm sweeping out.
  puffington: [{ to: [8, -2], hand: 'open' }, { to: [9, -6], hand: 'open' }],
  // The aria: both arms spread.
  pizzicata: [{ to: [7, -8], hand: 'open' }, { to: [8, -10], hand: 'open' }],
};

function leaderFrames(id: string): () => Frame[] {
  return () => {
    const style = LEADERS[id];
    const walk = withSwing(WALK, 0.6, 30);
    const gag = GAGS[id];
    const poses: Pose[] = [
      ...walk,
      { armN: gag[0], armF: { sh: -10, el: 40, hand: 'fist' }, expr: id === 'pizzicata' ? 'shout' : 'happy' },
      { armN: gag[1], armF: { sh: -20, el: 60, hand: 'open' }, expr: 'shout', head: { tilt: -6 } },
    ];
    const frames = poseFrames(style, poses, 'full');
    if (id === 'blare') {
      // A gold megaphone at the hand in both gag frames.
      for (let i = walk.length; i < frames.length; i++) {
        const f = frames[i];
        const hand = f.pts?.hand;
        if (!hand) continue;
        const x = f.ox + hand[0];
        const y = f.oy + hand[1];
        const cone = new PixelBuffer(9, 7);
        cone.poly([0, 2, 8, 0, 8, 6, 0, 4], PAL.gold[2]);
        cone.rect(0, 2, 8, 1, PAL.gold[3]);
        cone.rect(8, 0, 1, 7, PAL.gold[1]);
        const padded = f.buf.padded(0, 0, 8, 0);
        padded.blit(cone.outline(INK), x, y - 4);
        frames[i] = { ...f, buf: padded };
      }
    }
    return frames;
  };
}

export function defineEndingArt(): void {
  defineSprite('ui/ending-organ', organFrames);
  defineSprite('ui/ending-pipe', pipeFrames);
  defineSprite('ui/fanfaroni', fanfaroniFrames, { ticksPerFrame: 10 });
  defineSprite('ui/ending-mk1', mk1Frames);
  defineSprite('ui/ending-flyer', flyerFrames, { ticksPerFrame: 12 });
  defineSprite('ui/placard', placardFrames);
  defineSprite('ui/pigeon', pigeonFrames, { ticksPerFrame: 20 });
  defineSprite('ui/horse', horseFrames, { ticksPerFrame: 10 });
  for (const id of Object.keys(LEADERS)) defineSprite(`ui/leader-${id}`, leaderFrames(id), { ticksPerFrame: 8 });
}

/** Ink and colour helpers used by the scene for small effects. */
export const ENDING_COLORS: Readonly<Record<string, Color>> = {
  confetti0: PAL.red[3],
  confetti1: PAL.gold[3],
  confetti2: PAL.sky[3],
  confetti3: PAL.snow[3],
};
