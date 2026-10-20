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
 *
 * The ending flow's UHD art (docs/ART_GUIDE.md "UHD art"): the scenes draw it at the density
 * scenes/base.ts `screenArt` picks (the art tier once the screen art pool built it; never this
 * thread) and drop its 4× frames when the flow moves on (`ENDING_ART`). Each id has a 1× frame
 * (its geometry; at 1× the scenes draw exactly the pictures of before) and ONE density-generic HD
 * generator for 2× and 4×, painted in PAL_HD with no ink outline on the backdrops (style
 * decision) and outline A on the heads:
 * - `ui/ending-lake`     the lake at dusk (384 × 216, top-left): the 1× sky bands with a warm
 *                        glow round the low sun and stars, backlit hills with a tree line and a
 *                        warm rim near the sun, the far bank with reeds and two lit windows, water
 *                        that deepens toward the viewer with perspective ripples, the hills'
 *                        broken reflection and the sun's shimmering gold path
 * - `ui/ending-night`    the night of the first-person route's credits (384 × 216): a deep sky
 *                        with fine stars and a low ridge with the glow of the fire behind it
 * - `ui/ending-sea-night`, `ui/ending-sea-dawn`   the campaign's night sea (a lit moon with
 *                        craters, a silver path) and dawn sea (the sun half up in a warm glow, a
 *                        broad gold path) (384 × 216)
 * - `ui/ending-street-sky`, `ui/ending-street-city`, `ui/ending-street`   the campaign parade's
 *                        day sky, far skyline (384 × 150, parallax 0.3) and house fronts (384 ×
 *                        216, a wrapping tile: plaster, tiles, windows, flower boxes, doors,
 *                        bunting, pavement, kerb and road)
 * - `ui/ending-glint`    a water glint (frame = length 0–3 × 2 + colour 0–1; 3–9 × 1 px)
 * - `ui/ending-ember`    a drifting ember (frame = colour 0–3; 1 × 1 px)
 * - `ui/ending-beam`     the spotlight of the victory poses (72 × 106, drawn additively)
 * - `ui/ending-stage`    the little stage under it (80 × 3)
 * - `ui/score-head/<id>` the high-score head icons (scenes/heads.ts; top-left)
 */
import { ascii } from '../../../engine/ascii';
import type { Color } from '../../../engine/color';
import { drawText } from '../../../engine/font';
import { INK, PAL } from '../../../engine/palette';
import { PAL_HD } from '../../../engine/palette-hd';
import { PixelBuffer, type Ramp } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineSprite, type DenseDensity } from '../../../engine/sprites';
import { getBgGenerator, hasBgGenerator } from '../../art/art-registry';
import { poseFrames, withSwing } from '../../art/human-sprites';
import { renderHuman, type ArmPose, type HumanStyle, type Pose } from '../../art/humanoid';
import { hash2, noise2 } from '../../art/paint';
import { WALK } from '../../art/poses';
import { headCrop, headIcon, headSpriteId, HEAD_BACKGROUND, LEGION_HEAD } from '../../scenes/heads';
import { HERO_STYLES, RECRUIT_STYLE } from '../characters/art';
import { PORTRAITS } from '../characters/portrait.art';
import { isSquad, smallPortrait } from '../characters/select.art';
import { BgCanvas, dq, hdPath, idx, ix, pick, step } from '../missions/ams/art-hd-bg-kit';

const centre = (b: PixelBuffer, pts?: Frame['pts']): Frame => ({ buf: b, ox: b.w >> 1, oy: b.h >> 1, pts });

/** The lake's horizon (scenes/lake.ts re-exports it). */
export const LAKE_HORIZON = 128;
/** The UHD sprites of the ending flow (see the module comment). */
export const LAKE_ID = 'ui/ending-lake';
export const GLINT_ID = 'ui/ending-glint';
export const NIGHT_ID = 'ui/ending-night';
export const EMBER_ID = 'ui/ending-ember';
export const BEAM_ID = 'ui/ending-beam';
export const STAGE_ID = 'ui/ending-stage';
export const SEA_NIGHT_ID = 'ui/ending-sea-night';
export const SEA_DAWN_ID = 'ui/ending-sea-dawn';
export const STREET_SKY_ID = 'ui/ending-street-sky';
export const STREET_CITY_ID = 'ui/ending-street-city';
export const STREET_ID = 'ui/ending-street';

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
  defineEndingHdArt();
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

// =============================================================================================
// UHD art of the ending flow (2× and 4×; see the module comment)
// =============================================================================================

type Den = DenseDensity;
const VW = 384;
const VH = 216;
/** Backdrops and effects: top-left anchor, never in the boot preload. */
const BACKDROP = { anchor: 'top-left', defer: true } as const;
const topLeft = (buf: PixelBuffer): Frame => ({ buf, ox: 0, oy: 0 });

// ------------------------------------------------------------------------------------ the lake

const LAKE_DUSK: Color[] = [PAL.navy[0], PAL.navy[1], PAL.purple[0], PAL.purple[1], PAL.pink[1], PAL.orange[2]];
const LAKE_HILLS = { ramp: [PAL.ink[1], PAL.navy[0], PAL.purple[0], PAL.purple[1]], y: LAKE_HORIZON - 22, height: 14, scale: 90, bushes: false };
const LAKE_WATER: Color[] = [PAL.navy[0], PAL.navy[1], PAL.purple[0], PAL.purple[1], PAL.pink[1]];
/** The sun's x (its gold path on the water runs under it). */
const LAKE_SUN_X = Math.round(VW * 0.74);

/** The 1× lake: sky, far hills and water in one 384 × 216 buffer (as before the UHD wave). */
function lakeBackdrop(w: number, h: number): PixelBuffer {
  const b = new PixelBuffer(w, h);
  const dusk: Color[] = [PAL.navy[0], PAL.navy[1], PAL.purple[0], PAL.purple[1], PAL.pink[1], PAL.orange[2]];
  if (hasBgGenerator('sky-gradient')) {
    b.blit(getBgGenerator('sky-gradient')(w, LAKE_HORIZON + 4, { colors: dusk, dither: 0.35, sun: { x: 0.74, y: LAKE_HORIZON - 2, r: 11 }, stars: 18, y1: LAKE_HORIZON }, 7), 0, 0);
  } else b.gradient(0, 0, w, LAKE_HORIZON + 4, dusk);
  if (hasBgGenerator('hills')) {
    b.blit(getBgGenerator('hills')(w, LAKE_HORIZON + 4, { ramp: [PAL.ink[1], PAL.navy[0], PAL.purple[0], PAL.purple[1]], y: LAKE_HORIZON - 22, height: 14, scale: 90, bushes: false }, 11), 0, 0);
  } else b.rect(0, LAKE_HORIZON - 12, w, 16, PAL.navy[0]);
  // The far bank: a dark strip the parade marches on.
  b.rect(0, LAKE_HORIZON - 3, w, 4, PAL.ink[1]);
  b.rect(0, LAKE_HORIZON - 4, w, 1, PAL.navy[0]);
  const water: Color[] = [PAL.navy[0], PAL.navy[1], PAL.purple[0], PAL.purple[1], PAL.pink[1]];
  if (hasBgGenerator('sea')) {
    // The sea layer is transparent above its horizon, so it goes on top as a whole.
    b.blit(getBgGenerator('sea')(w, h, { ramp: water, y: LAKE_HORIZON + 1, sparkle: 0.8, foam: PAL.pink[2] }, 5), 0, 0);
  } else b.gradient(0, LAKE_HORIZON + 1, w, h - LAKE_HORIZON - 1, [...water].reverse());
  // The sun's reflection: a column of gold dashes on the water under the sun.
  const sx = Math.round(w * 0.74);
  for (let y = LAKE_HORIZON + 2; y < h; y += 3) {
    const half = 2 + Math.floor((y - LAKE_HORIZON) / 9);
    const jitter = ((y * 7) % 5) - 2;
    b.rect(sx - half + jitter, y, half * 2 - ((y >> 2) % 3), 1, y < LAKE_HORIZON + 30 ? PAL.gold[2] : PAL.orange[2]);
  }
  return b;
}

/** A vertical HD gradient through `keys` (top → bottom) over logical rows [y0, y1), dithered at the band borders. */
function hdGradient(c: BgCanvas, y0: number, y1: number, keys: readonly Color[], z = 0.6): void {
  const tones = idx(hdPath(keys, Math.max(2, keys.length * 3)));
  const d = c.d;
  const W = c.W;
  for (let Y = Math.max(0, Math.round(y0 * d)); Y < Math.min(c.H, Math.round(y1 * d)); Y++) {
    const v = (((Y + 0.5) / d - y0) / (y1 - y0)) * (tones.length - 1) + 0.5;
    for (let X = 0; X < W; X++) c.px[Y * W + X] = pick(tones, dq(v, X, Y, z));
  }
}

/** The 1× hills' skyline (the top px of every column), smoothed: the HD hills keep its silhouette. */
let lakeRidge: Float32Array | null = null;
function ridgeOf(): Float32Array {
  if (lakeRidge) return lakeRidge;
  const h = LAKE_HORIZON + 4;
  const top = new Float32Array(VW);
  const b = hasBgGenerator('hills') ? getBgGenerator('hills')(VW, h, LAKE_HILLS, 11) : null;
  for (let x = 0; x < VW; x++) {
    let y = LAKE_HORIZON - 12;
    if (b) {
      y = h;
      for (let yy = 0; yy < h; yy++) {
        if ((b.get(x, yy) & 255) !== 0) {
          y = yy;
          break;
        }
      }
    }
    top[x] = y;
  }
  const s = new Float32Array(VW);
  const K = [1, 2, 3, 2, 1];
  for (let x = 0; x < VW; x++) {
    let a = 0;
    for (let k = -2; k <= 2; k++) a += top[(x + k + VW) % VW] * K[k + 2];
    s[x] = a / 9;
  }
  lakeRidge = s;
  return s;
}

/** A smoothed profile at a logical x (linear between column centres, wrapping). */
function profileAt(s: Float32Array, x: number): number {
  const n = s.length;
  const u = x - 0.5;
  const i = Math.floor(u);
  const f = u - i;
  const a = ((i % n) + n) % n;
  return s[a] * (1 - f) + s[(a + 1) % n] * f;
}

/** A soft-edged ring of `rad` art px in PAL_HD ink round every opaque px (outline A at density rad). */
function inkRing(b: PixelBuffer, rad: number): PixelBuffer {
  const { w, h, data } = b;
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < data.length; i++) solid[i] = (data[i] & 255) !== 0 ? 1 : 0;
  const lim = rad * rad + (rad > 1 ? rad * 0.5 : 0);
  const ink = PAL_HD.ink[0] >>> 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (solid[y * w + x]) continue;
      let near = false;
      for (let dy = -rad; dy <= rad && !near; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -rad; dx <= rad; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w || dx * dx + dy * dy > lim) continue;
          if (solid[yy * w + xx]) {
            near = true;
            break;
          }
        }
      }
      if (near) data[y * w + x] = ink;
    }
  }
  return b.touch();
}

/**
 * The far hills, backlit by the low sun: the 1× skyline with a tree line of small crowns where a
 * wood grows, a hazier ridge behind it, a warm rim along the crest that burns orange and gold near
 * the sun, and tree masses in clean clusters that darken toward the bank.
 */
function paintLakeHills(c: BgCanvas, ridge: Float32Array): void {
  const d = c.d;
  const W = c.W;
  const near = idx(hdPath([PAL.ink[1], PAL.navy[0], PAL.purple[0], PAL.purple[1]], 8));
  const far = idx(hdPath([PAL.purple[0], PAL.purple[1], PAL.pink[1]], 6));
  const rim = idx([PAL_HD.purple[3], PAL_HD.pink[2], PAL_HD.pink[3], PAL_HD.orange[3], PAL_HD.orange[4], PAL_HD.gold[5]]);
  const bottom = (LAKE_HORIZON + 1) * d;
  for (let X = 0; X < W; X++) {
    const x = (X + 0.5) / d;
    const prox = Math.exp(-(((x - LAKE_SUN_X) / 70) ** 2));
    // The wood: scalloped crowns along the crest where the forest noise is high.
    const forest = noise2(x, 3, 34, 17);
    let crown = 0;
    if (forest > 0.4) {
      const cell = 1.6;
      const j = Math.floor(x / cell);
      const u = x / cell - j;
      crown = (0.4 + 0.6 * hash2(j, 5, 23)) * Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2)) * Math.min(1, (forest - 0.4) * 5) * 1.3;
    }
    const nearTop = profileAt(ridge, x) - crown;
    const farTop = profileAt(ridge, x + 61) - 2.5 + 1.5 * Math.sin(x / 23);
    const rimW = Math.max(1.01 / d, 0.3 + 0.9 * prox);
    const rimS = 0.18 + 0.82 * prox;
    for (let Y = Math.max(0, Math.floor(Math.min(nearTop, farTop) * d)); Y < bottom; Y++) {
      const y = (Y + 0.5) / d;
      let i: number;
      if (y >= nearTop) {
        const depth = y - nearTop;
        if (depth < rimW) i = pick(rim, Math.floor(rimS * 5.99 * (1 - (0.5 * depth) / rimW)));
        else {
          const v = 4.6 - depth * 0.27 + (noise2(x, y, 2.4, 31) - 0.5) * 1.7 + prox * 0.9;
          i = pick(near, dq(v, X, Y, 0.45));
        }
      } else if (y >= farTop) {
        const depth = y - farTop;
        const v = depth < 1.01 / d ? 4.6 + prox : 2.8 + prox * 1.7 - depth * 0.3 + (noise2(x, y, 4, 37) - 0.5) * 0.8;
        i = pick(far, dq(v, X, Y, 0.45));
      } else continue;
      c.px[Y * W + X] = i;
    }
  }
}

/** The far bank: the 1× strip with reeds and low bushes on its edge, two lit windows and a bright waterline. */
function paintLakeBank(c: BgCanvas, waterTop: number): void {
  const d = c.d;
  const top = LAKE_HORIZON - 4;
  const inkI = ix(PAL_HD.ink[1]);
  const deep = ix(PAL_HD.ink[0]);
  const edge = ix(PAL.navy[0]);
  const lit = ix(PAL_HD.navy[3]);
  c.rect(0, top, VW, 1, edge);
  c.rect(0, top + 1, VW, 4, inkI);
  c.rect(0, top + 3, VW, 2, deep);
  // Bushes (a lit top toward the sun) and reeds.
  for (let i = 0; i < 70; i++) {
    const x = hash2(i, 1, 51) * VW;
    if (hash2(i, 2, 51) < 0.45) {
      const r = 0.8 + hash2(i, 3, 51) * 1.4;
      c.disc(x, top + 0.4, r, r * 0.75, (_X, _Y, u, v) => (v < -0.45 && u > -0.4 ? edge : u + v < -0.9 ? lit : inkI));
    } else {
      const hgt = 1 + hash2(i, 4, 51) * 2.2;
      const lean = (hash2(i, 5, 51) - 0.5) * 1.2;
      c.line(x, top + 0.5, x + lean, top - hgt, inkI, 1);
      c.dot(Math.round((x + lean) * d), Math.round((top - hgt) * d), edge);
    }
  }
  // Two farmhouses with a lit window each.
  const glow = ix(PAL_HD.gold[6]);
  const warm = ix(PAL_HD.orange[4]);
  for (const hx of [58, 171]) {
    c.poly([[hx - 2.5, top + 1], [hx - 2.5, top - 2], [hx, top - 4], [hx + 2.5, top - 2], [hx + 2.5, top + 1]], deep);
    c.rect(hx - 1, top - 1.5, 0.5, 0.5, glow);
    c.rect(hx + 0.75, top - 1.5, 0.5, 0.5, warm);
  }
  // The waterline catches the glow of the sky (brightest under the sun).
  const line = idx(hdPath(LAKE_WATER, 9));
  const Y = waterTop * d - 1;
  for (let X = 0; X < c.W; X++) {
    const x = (X + 0.5) / d;
    const prox = Math.exp(-(((x - LAKE_SUN_X) / 90) ** 2));
    c.dot(X, Y, pick(line, Math.floor(5 + prox * 3.99 - (hash2(X, 7, 53) < 0.18 ? 2 : 0))));
  }
}

/** A lens-shaped ripple from x0 (logical) of length len, centred on row y, `th` logical px thick. */
function lens(c: BgCanvas, x0: number, y: number, len: number, th: number, paint: (X: number, Y: number, upper: boolean, core: boolean) => void, trough?: (X: number, Y: number) => void): void {
  const d = c.d;
  const X0 = Math.floor(x0 * d);
  const X1 = Math.ceil((x0 + len) * d);
  for (let X = X0; X < X1; X++) {
    const u = ((X + 0.5) / d - x0) / len;
    if (u <= 0 || u >= 1) continue;
    const half = (th / 2) * Math.sqrt(1 - (2 * u - 1) ** 2);
    let Y0 = Math.round((y - half) * d);
    let Y1 = Math.round((y + half) * d);
    if (Y1 <= Y0) {
      if (half * 2 * d < 0.45) continue;
      Y0 = Math.floor(y * d);
      Y1 = Y0 + 1;
    }
    const mid = (Y0 + Y1) / 2;
    const core = Math.abs(2 * u - 1) < 0.45;
    for (let Y = Y0; Y < Y1; Y++) paint(X, Y, Y + 0.5 <= mid, core && Y === Y0);
    if (trough && Y1 - Y0 >= 2) trough(X, Y1);
  }
}

/** A painted sky: a gradient through `keys`, a glow round the light, the sun or the moon, stars. */
interface SkyLook {
  /** Logical rows [0, y1) are painted. */
  y1: number;
  /** Top → horizon; the gradient reaches the last key at y1 / stretch. */
  keys: readonly Color[];
  stretch: number;
  /** Tones past the last key toward the glow's core (warm for a sun, cool for the moon). */
  hot: readonly Color[];
  glow: { x: number; y: number; rx: number; ry: number; power: number } | null;
  sun: { x: number; y: number; r: number; moon?: boolean } | null;
  stars: number;
  /** Stars stay above this logical row. */
  starsTo: number;
  seed: number;
}

/** Paint a sky (SkyLook) into logical rows [0, y1) of the canvas; the dither only at band borders. */
function paintSky(c: BgCanvas, o: SkyLook): void {
  const d = c.d;
  const W = c.W;
  const base = hdPath(o.keys, o.keys.length * 3);
  const tones = idx([...base, ...o.hot]);
  const nb = base.length - 1;
  const top = tones.length - 1;
  const Y1 = Math.min(c.H, Math.round(o.y1 * d));
  const g = o.glow;
  const gx = new Float32Array(W);
  if (g) for (let X = 0; X < W; X++) gx[X] = (((X + 0.5) / d - g.x) / g.rx) ** 2;
  const glowAt = (x: number, y: number): number => (g ? Math.exp(-(((x - g.x) / g.rx) ** 2) - ((y - g.y) / g.ry) ** 2) : 0);
  for (let Y = 0; Y < Y1; Y++) {
    const y = (Y + 0.5) / d;
    const v0 = Math.min(1, (y / o.y1) * o.stretch) * nb + 0.5;
    const gy = g ? ((y - g.y) / g.ry) ** 2 : 0;
    const row = Y * W;
    for (let X = 0; X < W; X++) {
      const v = g ? v0 + Math.exp(-gx[X] - gy) * g.power : v0;
      const q = dq(v, X, Y, 0.6);
      c.px[row + X] = tones[q < 0 ? 0 : q > top ? top : q];
    }
  }
  // Stars: dim single art px, a few brighter with short rays; none in the glow.
  const dim = [ix(PAL_HD.navy[4]), ix(PAL_HD.snow[0]), ix(PAL_HD.slate[5])];
  const bright = ix(PAL_HD.snow[4]);
  for (let i = 0; i < o.stars; i++) {
    const x = hash2(i, 1, o.seed) * VW;
    const y = hash2(i, 2, o.seed) ** 1.3 * o.starsTo;
    if (glowAt(x, y) > 0.2) continue;
    const X = Math.floor(x * d);
    const Y = Math.floor(y * d);
    if (hash2(i, 3, o.seed) < 0.86) c.dot(X, Y, dim[i % 3]);
    else {
      c.dot(X, Y, bright);
      for (let k = 1; k <= d >> 1; k++) {
        c.dot(X + k, Y, dim[1]);
        c.dot(X - k, Y, dim[1]);
        c.dot(X, Y + k, dim[1]);
        c.dot(X, Y - k, dim[1]);
      }
    }
  }
  const s = o.sun;
  if (!s) return;
  if (s.moon) {
    // The moon: a lit sphere (light from the upper left), a cool shade, three craters.
    const lit = idx([PAL_HD.snow[1], PAL_HD.snow[2], PAL_HD.snow[3], PAL_HD.snow[4], PAL_HD.snow[5], PAL_HD.snow[6]]);
    const craters = [[-0.3, -0.15, 0.22], [0.25, 0.3, 0.17], [0.05, -0.45, 0.12]] as const;
    c.disc(s.x, s.y, s.r, s.r, (X, Y, u, v) => {
      let t = 3.6 - 1.9 * (u * 0.7 + v * 0.7) - 1.2 * (u * u + v * v);
      for (const [cu, cv, cr] of craters) {
        const k = ((u - cu) ** 2 + (v - cv) ** 2) / (cr * cr);
        if (k < 1) t += k < 0.55 ? -1.1 : (u - cu) + (v - cv) < 0 ? -1.4 : 0.6;
      }
      return pick(lit, dq(t, X, Y, 0.4));
    });
    return;
  }
  // The sun: a near-white core, a gold body and an orange rim.
  const core = idx([PAL_HD.orange[4], PAL_HD.gold[5], PAL_HD.gold[6], PAL_HD.gold[7]]);
  c.disc(s.x, s.y, s.r, s.r, (X, Y, u, v) => pick(core, dq(3.9 - 3 * Math.sqrt(u * u + v * v) ** 1.6, X, Y, 0.5)));
}

/** A light's path on the water: short dashes round its x, in far / near colours (each [base, crest]). */
interface WaterPath {
  far: readonly [Color, Color];
  near: readonly [Color, Color];
  hot: Color;
  /** Rows (logical, from the water's top) painted in the far colours. */
  farRows: number;
  /** Half width at the top and its growth per logical row down. */
  hw0: number;
  grow: number;
}

/** A painted water surface (rows [top, VH)). */
interface WaterLook {
  top: number;
  /** The water's tones, dark → light (light at the horizon). */
  keys: readonly Color[];
  /** The light's x, the brightening under it at the horizon (tones) and its width. */
  lightX: number;
  glow: number;
  glowW: number;
  /** A skyline (per logical x; its foot at `ridgeFoot`) reflected under the far bank (60 % of its height). */
  ridge: Float32Array | null;
  ridgeFoot: number;
  path: WaterPath | null;
  spark: readonly Color[];
  seed: number;
}

/**
 * Water: lighter at the horizon (the glow of the sky, brightest under the light), deeper toward
 * the viewer; a skyline's reflection under the bank, broken by the waves; ripples on a
 * perspective grid (thin and close at the horizon, long and thick near the viewer) with lit crests
 * and dark troughs; rare sparkles; and the light's path, a shimmering column of short dashes.
 */
function paintWater(c: BgCanvas, o: WaterLook): void {
  const d = c.d;
  const W = c.W;
  const waterTop = o.top;
  const tones = idx(hdPath(o.keys, 11));
  const n = tones.length;
  const Y0 = Math.round(waterTop * d);
  const span = VH - waterTop;
  const k = new Int8Array(W * (c.H - Y0));
  const ridge = o.ridge;
  for (let Y = Y0; Y < c.H; Y++) {
    const y = (Y + 0.5) / d;
    const t = (y - waterTop) / span;
    const base = (n - 1) * (0.86 - t * 0.8);
    for (let X = 0; X < W; X++) {
      const x = (X + 0.5) / d;
      const prox = Math.exp(-(((x - o.lightX) / o.glowW) ** 2));
      let v = base + o.glow * prox * (1 - t) ** 3;
      if (ridge) {
        // The skyline's reflection, its edge broken by the waves.
        const wob = 0.7 * Math.sin((Y * 1.9) / d + x * 0.07) * (0.3 + t * 3);
        const R = (o.ridgeFoot - profileAt(ridge, x + wob)) * 0.6;
        const ry = y - waterTop;
        if (ry < R) v -= 2.6 * (1 - ry / R) ** 0.5 * (1 - 0.55 * prox);
      }
      const q = dq(v, X, Y, 0.55);
      const kk = q < 0 ? 0 : q >= n ? n - 1 : q;
      k[(Y - Y0) * W + X] = kk;
      c.px[Y * W + X] = tones[kk];
    }
  }
  const toneAt = (X: number, Y: number): number => k[(Y - Y0) * W + c.wx(X)];
  const spark = o.spark.map(ix);
  const sd = o.seed;
  // Ripples on the perspective grid.
  const rows: [number, number][] = [];
  let y = waterTop + 0.6;
  for (let r = 0; y < VH + 1; r++) {
    const t = (y - waterTop) / span;
    const th = 0.22 + 0.95 * t ** 1.2;
    rows.push([y, th]);
    const L = 3 + 24 * t;
    const cells = Math.ceil(VW / L) + 1;
    for (let j = 0; j < cells; j++) {
      if (hash2(j, r, sd + 41) > 0.62) continue;
      const x0 = j * L + hash2(j, r, sd + 42) * L * 0.5;
      const len = L * (0.3 + 0.55 * hash2(j, r, sd + 43));
      lens(
        c,
        x0,
        y,
        len,
        th,
        (X, Y, upper) => {
          if (Y < Y0 || Y >= c.H) return;
          const lift = upper ? 2 : 1;
          c.dot(X, Y, hash2(X, Y, sd + 61) < 0.01 * (1 - t) && upper ? spark[hash2(X, Y, sd + 62) < 0.5 ? 0 : spark.length - 1] : pick(tones, toneAt(X, Y) + lift));
        },
        (X, Y) => {
          if (Y >= Y0 && Y < c.H) c.dot(X, Y, pick(tones, toneAt(X, Y) - 1));
        },
      );
    }
    y += 0.55 + 3.3 * t ** 1.25 + hash2(r, 9, sd + 44) * 0.3;
  }
  const p = o.path;
  if (!p) return;
  // The light's path: short dashes inside its column, far colours near the horizon.
  const farB = ix(p.far[0]);
  const farC = ix(p.far[1]);
  const nearB = ix(p.near[0]);
  const nearC = ix(p.near[1]);
  const hot = ix(p.hot);
  rows.forEach(([ry, th], r) => {
    const t = (ry - waterTop) / span;
    const hw = p.hw0 + (ry - waterTop) * p.grow;
    const pieces = 2 + Math.floor(hash2(r, 1, sd + 71) * 3);
    const far = ry < waterTop + p.farRows;
    for (let q = 0; q < pieces; q++) {
      const cx = o.lightX + (hash2(r, q, sd + 72) * 2 - 1) * hw * 0.9;
      const len = hw * (0.3 + 0.5 * hash2(r, q, sd + 73));
      lens(c, cx - len / 2, ry, len, th * 1.15, (X, Y, upper, core) => {
        if (Y < Y0 || Y >= c.H) return;
        const isHot = core && t < 0.25 && hash2(X, Y, sd + 74) < 0.5;
        c.dot(X, Y, isHot ? hot : far ? (upper ? farC : farB) : upper ? nearC : nearB);
      });
    }
  });
}

/** The UHD lake (see the module comment): 384 × 216 at density d. */
function lakeHd(d: Den): Frame {
  const waterTop = LAKE_HORIZON + 1;
  const c = new BgCanvas(VW, VH, d);
  paintSky(c, LAKE_SKY_HD);
  const ridge = ridgeOf();
  paintLakeHills(c, ridge);
  paintLakeBank(c, waterTop);
  paintWater(c, { ...LAKE_WATER_HD, ridge });
  return topLeft(c.finish());
}

/** The lake's dusk sky: the 1× bands, a warm glow round the low sun (behind the hills), stars. */
const LAKE_SKY_HD: SkyLook = {
  y1: LAKE_HORIZON + 4,
  keys: LAKE_DUSK,
  stretch: 1.14,
  hot: [PAL_HD.orange[4], PAL_HD.gold[5], PAL_HD.gold[6]],
  glow: { x: LAKE_SUN_X, y: LAKE_HORIZON - 2, rx: 95, ry: 24, power: 3.4 },
  sun: { x: LAKE_SUN_X, y: LAKE_HORIZON - 2, r: 11 },
  stars: 46,
  starsTo: 84,
  seed: 7,
};

const LAKE_WATER_HD: WaterLook = {
  top: LAKE_HORIZON + 1,
  keys: LAKE_WATER,
  lightX: LAKE_SUN_X,
  glow: 1.8,
  glowW: 60,
  ridge: null,
  ridgeFoot: LAKE_HORIZON,
  path: { far: [PAL_HD.gold[5], PAL_HD.gold[6]], near: [PAL_HD.orange[3], PAL_HD.orange[4]], hot: PAL_HD.gold[7], farRows: 29, hw0: 2.1, grow: 1 / 9 },
  spark: [PAL_HD.pink[5], PAL_HD.snow[5]],
  seed: 0,
};

/** A water glint (1×: a len × 1 dash; HD: a tapered streak with a bright core line). */
const GLINT_LENS = [3, 5, 7, 9];
const GLINT_COLS = [PAL.purple[2], PAL.pink[2]];

function glintFrames(d: 1 | Den): Frame[] {
  const out: Frame[] = [];
  for (const len of GLINT_LENS) {
    for (const col of GLINT_COLS) {
      const b = new PixelBuffer(len * d, d);
      if (d === 1) b.rect(0, 0, len, 1, col);
      else {
        const hot = step(col, 2);
        for (let X = 0; X < len * d; X++) {
          const u = (X + 0.5) / (len * d);
          const thick = Math.max(1, Math.round(Math.sin(Math.PI * u) * d * 0.75));
          const y0 = (d - thick) >> 1;
          for (let Y = y0; Y < y0 + thick; Y++) b.set(X, Y, Y === y0 && u > 0.2 && u < 0.8 ? hot : col);
        }
      }
      out.push(topLeft(b));
    }
  }
  return out;
}

// ------------------------------------------------------------------------------------ the campaign's backdrops

/** The sea's waterline in THE LAST NOTE and SPLASHDOWN; the parade street's house line. */
export const ENDING_WATER_Y = 176;
export const ENDING_STREET_Y = 166;

/** The 1× sea backdrops (the night of THE LAST NOTE, the dawn of SPLASHDOWN), as before the UHD wave. */
function seaOne(sky: Color[], water: Color[], sun: { x: number; y: number; r: number } | null, stars: number, seed: number, moon = false): PixelBuffer {
  const b = new PixelBuffer(VW, VH);
  if (hasBgGenerator('sky-gradient')) b.blit(getBgGenerator('sky-gradient')(VW, ENDING_WATER_Y + 2, { colors: sky, dither: 0.35, stars, y1: ENDING_WATER_Y, moon, ...(sun ? { sun } : {}) }, seed), 0, 0);
  else b.gradient(0, 0, VW, ENDING_WATER_Y + 2, sky);
  if (hasBgGenerator('sea')) b.blit(getBgGenerator('sea')(VW, VH, { ramp: water, y: ENDING_WATER_Y, sparkle: 0.6, foam: water[water.length - 1] }, seed + 1), 0, 0);
  else b.gradient(0, ENDING_WATER_Y, VW, VH - ENDING_WATER_Y, water);
  return b;
}

const NIGHT_SKY: Color[] = [PAL.ink[1], PAL.navy[0], PAL.navy[0], PAL.navy[1], PAL.purple[0]];
const NIGHT_WATER: Color[] = [PAL.ink[1], PAL.navy[0], PAL.navy[1], PAL.purple[0], PAL.purple[1]];
const DAWN_SKY: Color[] = [PAL.navy[1], PAL.purple[1], PAL.pink[1], PAL.orange[2], PAL.gold[3]];
const DAWN_WATER: Color[] = [PAL.navy[0], PAL.navy[1], PAL.purple[1], PAL.pink[1], PAL.orange[2]];
const MOON = { x: Math.round(VW * 0.18), y: 34, r: 7 };
const DAWN_SUN = { x: Math.round(VW * 0.7), y: ENDING_WATER_Y - 2, r: 14 };

function seaNightOne(): Frame {
  return topLeft(seaOne(NIGHT_SKY, NIGHT_WATER, { x: 0.18, y: 34, r: 7 }, 40, 3, true));
}

function seaDawnOne(): Frame {
  return topLeft(seaOne(DAWN_SKY, DAWN_WATER, { x: 0.7, y: ENDING_WATER_Y - 2, r: 14 }, 6, 5));
}

/**
 * The night sea of THE LAST NOTE: a deep sky with fine stars, the moon (a lit sphere with craters)
 * in a cool halo, and the sea with a silver moon path.
 */
function seaNightHd(d: Den): Frame {
  const c = new BgCanvas(VW, VH, d);
  paintSky(c, {
    y1: ENDING_WATER_Y + 2,
    keys: NIGHT_SKY,
    stretch: 1,
    hot: [PAL_HD.slate[4], PAL_HD.slate[5]],
    glow: { x: MOON.x, y: MOON.y, rx: 20, ry: 15, power: 1.3 },
    sun: { ...MOON, moon: true },
    stars: 150,
    starsTo: 150,
    seed: 3,
  });
  paintWater(c, {
    top: ENDING_WATER_Y,
    keys: NIGHT_WATER,
    lightX: MOON.x,
    glow: 1.2,
    glowW: 40,
    ridge: null,
    ridgeFoot: 0,
    path: { far: [PAL_HD.slate[5], PAL_HD.snow[3]], near: [PAL_HD.slate[4], PAL_HD.snow[2]], hot: PAL_HD.snow[5], farRows: 10, hw0: 2.5, grow: 0.22 },
    spark: [PAL_HD.slate[6], PAL_HD.snow[4]],
    seed: 300,
  });
  return topLeft(c.finish());
}

/** The dawn sea of SPLASHDOWN: the sun half up on the horizon in a wide warm glow, a broad gold path. */
function seaDawnHd(d: Den): Frame {
  const c = new BgCanvas(VW, VH, d);
  paintSky(c, {
    y1: ENDING_WATER_Y + 2,
    keys: DAWN_SKY,
    stretch: 1,
    hot: [PAL_HD.gold[5], PAL_HD.gold[6], PAL_HD.gold[7]],
    glow: { x: DAWN_SUN.x, y: DAWN_SUN.y, rx: 95, ry: 30, power: 2.2 },
    sun: DAWN_SUN,
    stars: 8,
    starsTo: 40,
    seed: 5,
  });
  paintWater(c, {
    top: ENDING_WATER_Y,
    keys: DAWN_WATER,
    lightX: DAWN_SUN.x,
    glow: 2.4,
    glowW: 70,
    ridge: null,
    ridgeFoot: 0,
    path: { far: [PAL_HD.gold[6], PAL_HD.gold[7]], near: [PAL_HD.orange[4], PAL_HD.gold[5]], hot: PAL_HD.gold[7], farRows: 16, hw0: 11, grow: 0.35 },
    spark: [PAL_HD.gold[6], PAL_HD.snow[5]],
    seed: 500,
  });
  return topLeft(c.finish());
}

// The parade street: a day sky, a far skyline (parallax 0.3) and the wrapping house fronts.

const STREET_SKY_COLS: Color[] = [PAL.sky[1], PAL.sky[2], PAL.sky[3], PAL.snow[2]];
const CITY_RAMP: Color[] = [PAL.sky[0], PAL.sky[1], PAL.steel[2], PAL.steel[3], PAL.snow[1]];
/** The far skyline layer's height (it starts at the top of the screen). */
export const STREET_CITY_H = 150;

function streetSkyOne(): Frame {
  const sky = new PixelBuffer(VW, VH);
  if (hasBgGenerator('sky-gradient')) sky.blit(getBgGenerator('sky-gradient')(VW, VH, { colors: STREET_SKY_COLS, dither: 0.3 }, 9), 0, 0);
  else sky.gradient(0, 0, VW, VH, STREET_SKY_COLS);
  return topLeft(sky);
}

function streetCityOne(): Frame {
  const p = { ramp: CITY_RAMP, y: 0.6, height: 0.4, night: false, lit: 0.2 };
  return topLeft(hasBgGenerator('city') ? getBgGenerator('city')(VW, STREET_CITY_H, p, 21) : new PixelBuffer(VW, STREET_CITY_H));
}

/** The day sky: the 1× gradient, a soft bright glow in the upper left where the light comes from. */
function streetSkyHd(d: Den): Frame {
  const c = new BgCanvas(VW, VH, d);
  paintSky(c, {
    y1: VH,
    keys: STREET_SKY_COLS,
    stretch: 1,
    hot: [PAL_HD.sky[6], PAL_HD.sky[7]],
    glow: { x: 20, y: -10, rx: 150, ry: 70, power: 1.6 },
    sun: null,
    stars: 0,
    starsTo: 0,
    seed: 9,
  });
  return topLeft(c.finish());
}

/**
 * The far skyline in the day haze: the 1× layout (the same buildings, windows and roof details,
 * from the same hashes), each block lit from the left with a bright lip and a shade edge, its wall
 * paler toward the top (haze), windows with a reflection and a sill, an antenna with a red light,
 * round water tanks on legs, stepped tops.
 */
function streetCityHd(d: Den): Frame {
  const c = new BgCanvas(VW, STREET_CITY_H, d);
  const seed = 21;
  const top = 90;
  const height = 60;
  const ground = top + height;
  const walls = [hdOf(PAL.sky[1]), hdOf(PAL.steel[2])];
  const glass = idx([PAL_HD.sky[3], PAL_HD.sky[4], PAL_HD.sky[5], PAL_HD.sky[6]]);
  const warm = idx([PAL_HD.gold[3], PAL_HD.gold[4], PAL_HD.gold[5], PAL_HD.gold[6]]);
  const W = c.W;
  const e = 1 / d;
  let x0 = 0;
  for (let i = 0; x0 < VW; i++) {
    let bw = 14 + Math.floor(hash2(i, 1, seed) * 26);
    if (VW - (x0 + bw) < 14) bw = VW - x0;
    const bh = Math.round(height * (0.35 + hash2(i, 2, seed) * 0.65));
    const by = ground - bh;
    const tone = Math.floor(hash2(i, 3, seed) * 2);
    const w = walls[tone];
    const b = w.i;
    const R = idx(w.ramp);
    // The wall: lit left face, shade edge, a lit lip and a shadow under it, paler toward the top.
    for (let Y = Math.max(0, by * d); Y < c.H; Y++) {
      const y = (Y + 0.5) / d;
      const haze = 0.7 * (1 - (y - by) / (ground - by + 1));
      for (let X = x0 * d; X < (x0 + bw) * d; X++) {
        const x = (X + 0.5) / d - x0;
        let v = b + haze - 0.25;
        if (x < 1) v = b + 1.2 + (x < e ? 0.8 : 0);
        else if (x > bw - 1) v = b - 1;
        if (y - by < 1) v = b + 1.6;
        else if (y - by < 1 + e * Math.max(1, d >> 1)) v = b - 0.8;
        c.dot(X, Y, pick(R, dq(v + 0.5, X, Y, 0.4)));
      }
    }
    // Windows: 2 × 2 on a 4 × 5 grid; the lit ones warm, the others reflecting the sky.
    for (let y = by + 3; y < ground - 2; y += 5) {
      for (let x = x0 + 2; x < x0 + bw - 3; x += 4) {
        const on = hash2(x, y, seed) < 0.2;
        const g = on ? warm : glass;
        for (let Y = y * d; Y < (y + 2) * d; Y++) {
          for (let X = x * d; X < (x + 2) * d; X++) {
            const u = (X - x * d + 0.5) / (2 * d);
            const v = (Y - y * d + 0.5) / (2 * d);
            let t = on ? 2.4 - v * 1.4 : 1.6 - v * 1.4 + (u + v < 0.7 ? 1.5 : 0);
            if (Y === y * d) t -= 1;
            c.dot(X, Y, pick(g, Math.round(t)));
          }
        }
        // The sill: one art row of the lit wall under the window.
        c.rect(x, y + 2, 2, e, pick(R, b + 2));
      }
    }
    // Roof details: an antenna, a water tank or a stepped top.
    const roof = hash2(i, 4, seed);
    const mid = x0 + Math.floor(bw / 2);
    const steel = idx(PAL_HD.steel);
    if (roof < 0.3) {
      c.rect(mid + 0.5 - e / 2, by - 7, e, 7, pick(steel, 4));
      c.rect(mid + 0.5 - e, by - 7.5, 2 * e, e * 2, ix(PAL_HD.steel[6]));
      c.disc(mid + 0.5, by - 8 + 0.5, 0.55, 0.55, (_X, _Y, u, v) => (u + v < -0.4 ? ix(PAL_HD.red[7]) : ix(PAL_HD.red[5])));
    } else if (roof < 0.55 && bw > 18) {
      // A round water tank on two legs: a cylinder lit from the left, a cone lid.
      const tank = idx(PAL_HD.brown);
      for (let Y = (by - 5) * d; Y < (by - 1) * d; Y++) {
        for (let X = (mid - 3) * d; X < (mid + 4) * d; X++) {
          const u = ((X + 0.5) / d - (mid - 3)) / 7;
          const band = Math.floor(((Y + 0.5) / d - (by - 5)) * 1.2) % 2 === 0 ? 0 : -0.4;
          c.dot(X, Y, pick(tank, dq(5.2 - 3.6 * Math.abs(u - 0.32) * 1.6 + band, X, Y, 0.4)));
        }
      }
      c.poly([[mid - 3.4, by - 5], [mid + 0.5, by - 6.6], [mid + 4.4, by - 5]], (X) => pick(tank, (X + 0.5) / d < mid ? 6 : 4));
      c.rect(mid - 2, by - 1, 1, 1, pick(tank, 1));
      c.rect(mid + 2, by - 1, 1, 1, pick(tank, 1));
    } else if (roof < 0.75 && bw > 20) {
      for (let Y = (by - 4) * d; Y < by * d; Y++) {
        for (let X = (x0 + 3) * d; X < (x0 + bw - 3) * d; X++) {
          const x = (X + 0.5) / d - (x0 + 3);
          const y = (Y + 0.5) / d - (by - 4);
          const v = x < 1 ? b + 1.4 : y < 1 ? b + 1.2 : b + 0.2 - (y > 3 ? 0.5 : 0);
          c.dot(X, Y, pick(R, Math.round(v)));
        }
      }
    }
    x0 += bw;
  }
  void W;
  return topLeft(c.finish());
}

/** The HD home (ramp indices) of a 1× colour. */
function hdOf(col: Color): { ramp: Ramp; i: number } {
  return homeRamp(col);
}

/** The house fronts' wall colours (1×), left to right. */
const HOUSE_WALLS: readonly (readonly Color[])[] = [PAL.sand, PAL.gold, PAL.teal, PAL.snow, PAL.orange, PAL.sky, PAL.red, PAL.stone];
const HOUSE_W = 48;
const houseTop = (i: number): number => 112 + ((i * 37) % 3) * 6;
/** The windows of a house (two rows of two, the lower right one is the door's place). */
function houseWindows(x: number, top: number): [number, number][] {
  const out: [number, number][] = [];
  for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) if (!(row === 1 && col === 1)) out.push([x + 8 + col * 22, top + 10 + row * 28]);
  return out;
}
/** The bunting's height at a pin (every 6 px). */
const buntingY = (bx: number): number => Math.round(Math.sin((bx / VW) * Math.PI * 4) * 3) + 100;
const BUNTING: readonly Color[] = [PAL.red[2], PAL.gold[3], PAL.snow[3]];

/** Eight narrow house fronts (wrapping tile, 384 wide): plaster, roofs, windows, flower boxes, bunting (1×). */
function houseFronts(): PixelBuffer {
  const b = new PixelBuffer(VW, VH);
  const ground = ENDING_STREET_Y;
  let x = 0;
  for (let i = 0; i < 8; i++) {
    const w = HOUSE_W;
    const top = houseTop(i);
    const ramp = HOUSE_WALLS[i];
    // Wall with a lit left edge, a gable roof, a door and two rows of windows.
    b.rect(x, top, w, ground - top, ramp[2]);
    b.rect(x, top, 2, ground - top, ramp[3]);
    b.rect(x + w - 2, top, 2, ground - top, ramp[1]);
    b.poly([x - 2, top, x + w / 2, top - 18, x + w + 2, top], PAL.red[1]);
    b.line(x - 2, top, x + w / 2, top - 18, PAL.red[2]);
    b.rect(x - 2, top, w + 4, 2, PAL.brown[1]);
    for (const [wx, wy] of houseWindows(x, top)) {
      b.rect(wx - 1, wy - 1, 12, 14, INK);
      b.rect(wx, wy, 10, 12, PAL.navy[1]);
      b.rect(wx, wy, 10, 1, PAL.sky[2]);
      b.rect(wx + 4, wy, 1, 12, ramp[3]);
      // A flower box under the window.
      b.rect(wx - 1, wy + 13, 12, 3, PAL.brown[1]);
      for (let f = 0; f < 4; f++) b.set(wx + 1 + f * 3, wy + 12, f % 2 ? PAL.red[3] : PAL.gold[3]);
    }
    b.rect(x + 30, ground - 22, 12, 22, INK);
    b.rect(x + 31, ground - 21, 10, 21, PAL.brown[1]);
    b.set(x + 39, ground - 11, PAL.gold[3]);
    b.rect(x + w, top + 4, 1, ground - top - 4, PAL.ink[1]);
    x += w;
  }
  // Bunting across the street: crimson, gold and white flags on a string.
  for (let bx = 0; bx < VW; bx += 6) {
    const sag = buntingY(bx);
    b.set(bx, sag, PAL.ink[1]);
    const c = BUNTING[(bx / 6) % 3];
    b.rect(bx + 1, sag + 1, 4, 1, c);
    b.rect(bx + 2, sag + 2, 2, 2, c);
  }
  // Pavement and kerb, then the road.
  b.rect(0, ground, VW, 8, PAL.stone[2]);
  for (let px = 0; px < VW; px += 12) b.rect(px, ground, 1, 8, PAL.stone[1]);
  b.rect(0, ground + 8, VW, 2, PAL.stone[3]);
  b.rect(0, ground + 10, VW, VH - ground - 10, PAL.stone[1]);
  for (let px = 4; px < VW; px += 32) b.rect(px, 194, 14, 2, PAL.snow[1]);
  return b;
}

function streetFrontOne(): Frame {
  return topLeft(houseFronts());
}

/**
 * The parade's house fronts at density d (the 1× layout): plaster walls lit from the left with a
 * mottled texture, hairline cracks, rain stains under the flower boxes and a damp plinth; the
 * cornice's shadow; clay-tile roofs in courses with a lit eave; windows in dark reveals with a sky
 * reflection, a shine streak, a frame cross and (some) a curtain; planked flower boxes with leaves
 * and blossoms; panelled doors with a brass knob; the bunting on a sagging string; paving slabs
 * with lit edges, the kerb and the asphalt road with worn lane marks.
 */
function streetFrontHd(d: Den): Frame {
  const c = new BgCanvas(VW, VH, d);
  const ground = ENDING_STREET_Y;
  const e = 1 / d;
  const ink0 = ix(PAL_HD.ink[0]);
  const ink1 = ix(PAL_HD.ink[1]);
  const red = idx(PAL_HD.red);
  const brown = idx(PAL_HD.brown);
  const glassR = idx(PAL_HD.glass);
  const cloth = idx(PAL_HD.cloth);
  const leaf = idx([PAL_HD.green[2], PAL_HD.green[3], PAL_HD.green[4]]);
  const gold = idx(PAL_HD.gold);
  for (let i = 0; i < 8; i++) {
    const x = i * HOUSE_W;
    const w = HOUSE_W;
    const top = houseTop(i);
    const home = homeRamp(HOUSE_WALLS[i][2]);
    const R = idx(home.ramp);
    const b = home.i;
    const wins = houseWindows(x, top);
    // The wall.
    for (let Y = top * d; Y < ground * d; Y++) {
      const y = (Y + 0.5) / d;
      const ly = y - top;
      for (let X = x * d; X < (x + w) * d; X++) {
        const lx = (X + 0.5) / d - x;
        let v = b + 0.2 - lx * 0.008 + (noise2(lx + i * 50, y, 6, 101) - 0.5) * 0.9;
        if (lx < 2) v = b + 1 + (lx < e ? 0.6 : 0) + (noise2(lx, y, 6, 102) - 0.5) * 0.4;
        else if (lx > w - 2) v = b - 1 + (noise2(lx, y, 6, 103) - 0.5) * 0.4;
        if (ly >= 2 && ly < 3.2) v -= 0.9;
        const damp = ground - y;
        if (damp < 6) v -= ((6 - damp) / 6) * 1.3;
        for (const [wx, wy] of wins) {
          const sy = y - (wy + 16);
          if (sy >= 0 && sy < 10 && lx + x >= wx && lx + x < wx + 10 && hash2(Math.floor((lx + x) * 2), i, 107) < 0.45) v -= 0.75 * (1 - sy / 10);
        }
        c.dot(X, Y, pick(R, dq(v + 0.5, X, Y, 0.5)));
      }
    }
    // Hairline cracks in the plaster (short random walks).
    for (let k = 0; k < 3; k++) {
      let cx = (x + 4 + hash2(i, k, 111) * 40) * d;
      let cy = (top + 8 + hash2(i, k, 112) * 34) * d;
      const n = (4 + hash2(i, k, 113) * 6) * d;
      for (let s = 0; s < n; s++) {
        c.dot(Math.round(cx), Math.round(cy), pick(R, b - 2));
        cy += 1;
        cx += hash2(s, k + i * 7, 114) < 0.33 ? -1 : hash2(s, k + i * 7, 115) < 0.5 ? 1 : 0;
      }
    }
    // The roof: clay tiles in courses, lit toward the left, a lit eave and a dark right edge.
    const peak = x + w / 2;
    c.poly([[x - 2, top], [peak, top - 18], [x + w + 2, top]], (X, Y) => {
      const lx = (X + 0.5) / d;
      const ry = top - (Y + 0.5) / d;
      const course = Math.floor(ry / 2);
      const fy = ry / 2 - course;
      const off = (course % 2) * 1.5;
      let v = 3 + (lx < peak ? 0.35 : -0.25) + (noise2(lx, ry, 5, 121) - 0.5) * 0.5;
      if (fy < 0.5 / d + 0.01) v = 2;
      else if (fy > 1 - 1 / d - 0.01) v = 4.3;
      else if ((((lx + off) % 3) + 3) % 3 < 1 / d) v = 2.2;
      return pick(red, Math.round(v));
    });
    c.line(x - 2, top, peak, top - 18, red[5], Math.max(1, d >> 1));
    c.line(peak, top - 18, x + w + 2, top, red[2], 1);
    // The cornice: a wooden board, lit on top, dark below.
    for (let Y = top * d; Y < (top + 2) * d; Y++) {
      const fy = (Y - top * d + 0.5) / (2 * d);
      c.span((x - 2) * d, (x + w + 2) * d, Y, pick(brown, fy < 0.25 ? 4 : fy > 0.8 ? 1 : 2 + (fy < 0.5 ? 1 : 0)));
    }
    // Windows: a dark reveal, glass with the sky's reflection and a shine streak, the frame cross,
    // some with a curtain; under each a planked flower box with leaves and blossoms.
    wins.forEach(([wx, wy], k) => {
      c.rect(wx - 1, wy - 1, 12, 14, ink1);
      c.rect(wx - 1, wy - 1, 12, 1, ink0);
      c.rect(wx - 1, wy - 1, 1, 14, ink0);
      for (let Y = wy * d; Y < (wy + 12) * d; Y++) {
        const v = (Y + 0.5) / d - wy;
        for (let X = wx * d; X < (wx + 10) * d; X++) {
          const u = (X + 0.5) / d - wx;
          let t = 2.6 - v * 0.17;
          const diag = u + v * 0.6;
          if ((diag > 2.2 && diag < 3.4) || (diag > 4 && diag < 4.5)) t += 1.6;
          if (v < 1) t = 4.6 - v;
          c.dot(X, Y, pick(glassR, dq(t, X, Y, 0.3)));
        }
      }
      if (hash2(i, k, 131) < 0.5) {
        // A curtain drawn to one side, its folds as light and shade.
        const left = hash2(i, k, 132) < 0.5;
        const cx0 = left ? wx : wx + 7;
        for (let Y = (wy + 1) * d; Y < (wy + 12) * d; Y++) {
          for (let X = cx0 * d; X < (cx0 + 3) * d; X++) {
            const u = (X + 0.5) / d - cx0;
            c.dot(X, Y, pick(cloth, Math.round(3.4 + Math.sin(u * 3.6) * 0.9 - ((Y + 0.5) / d - wy) * 0.04)));
          }
        }
      }
      // The frame cross: a mullion and a transom in the wall's light tone, lit on the left.
      c.rect(wx + 4, wy, 1, 12, pick(R, b + 1));
      c.rect(wx + 4, wy, e, 12, pick(R, b + 2));
      c.rect(wx, wy + 4, 10, 1, pick(R, b + 1));
      c.rect(wx, wy + 4, 10, e, pick(R, b + 2));
      // The flower box.
      for (let Y = (wy + 13) * d; Y < (wy + 16) * d; Y++) {
        const fy = (Y + 0.5) / d - (wy + 13);
        const v = fy < e ? 4 : fy > 3 - e ? 0 : Math.abs(fy - 1.5) < e / 2 + 0.01 ? 1 : 2;
        c.span((wx - 1) * d, (wx + 11) * d, Y, pick(brown, v));
      }
      c.rect(wx - 1, wy + 13, e, 3, pick(brown, 3));
      // Leaves along the box, the blossoms on top.
      for (let f = 0; f < 7; f++) {
        const lx = wx - 0.5 + f * 1.7;
        c.disc(lx + 0.8, wy + 12.6, 0.95, 0.6, (_X, _Y, u, v) => pick(leaf, u + v < -0.3 ? 2 : u + v > 0.6 ? 0 : 1));
      }
      for (let f = 0; f < 4; f++) {
        const col = f % 2 ? homeRamp(PAL.red[3]) : homeRamp(PAL.gold[3]);
        const fr = idx(col.ramp);
        c.disc(wx + 1.5 + f * 3, wy + 12.2, 0.85, 0.75, (_X, _Y, u, v) => pick(fr, u * u + v * v < 0.12 ? col.i - 2 : u + v < -0.2 ? col.i + 1 : col.i));
      }
    });
    // The door: a dark reveal, a panelled leaf with grain, a brass knob.
    c.rect(x + 30, ground - 22, 12, 22, ink1);
    c.rect(x + 30, ground - 22, 12, 1, ink0);
    c.rect(x + 30, ground - 22, 1, 22, ink0);
    const panels: [number, number, number, number][] = [[x + 32.5, ground - 19.5, 7, 7], [x + 32.5, ground - 10.5, 7, 8]];
    for (let Y = (ground - 21) * d; Y < ground * d; Y++) {
      const y = (Y + 0.5) / d;
      for (let X = (x + 31) * d; X < (x + 41) * d; X++) {
        const lx = (X + 0.5) / d;
        let v = 2.4 + (noise2(lx * 4, y * 0.25, 1, 141) - 0.5) * 0.9;
        if (lx - (x + 31) < e) v = 3.6;
        for (const [px0, py0, pw, ph] of panels) {
          const u = lx - px0;
          const q = y - py0;
          if (u < 0 || q < 0 || u >= pw || q >= ph) continue;
          v = u < 2 * e || q < 2 * e ? 3.8 : u > pw - 2 * e || q > ph - 2 * e ? 1 : 2.2 + (noise2(lx * 4, y * 0.25, 1, 142) - 0.5) * 0.6;
        }
        c.dot(X, Y, pick(brown, Math.round(v)));
      }
    }
    c.disc(x + 39.5, ground - 10.5, 0.8, 0.8, (_X, _Y, u, v) => pick(gold, u + v < -0.6 ? 7 : u + v > 0.5 ? 2 : 5));
    // The seam to the next house.
    c.rect(x + w, top + 4, 1, ground - top - 4, ink1);
  }
  // The bunting: a sagging string between the pins, pennants lit on the left.
  const str = ix(PAL_HD.ink[1]);
  for (let X = 0; X < c.W; X++) {
    const x = (X + 0.5) / d;
    const bx = Math.floor(x / 6) * 6;
    const f = (x - bx) / 6;
    const y = buntingY(bx) * (1 - f) + buntingY(bx + 6 >= VW ? 0 : bx + 6) * f + 0.6 * Math.sin(Math.PI * f) + 0.5;
    c.dot(X, Math.floor(y * d), str);
  }
  for (let bx = 0; bx < VW; bx += 6) {
    const sag = buntingY(bx);
    const col = homeRamp(BUNTING[(bx / 6) % 3]);
    const fr = idx(col.ramp);
    c.poly([[bx + 1, sag + 1], [bx + 5, sag + 1], [bx + 3, sag + 4.2]], (X, Y) => {
      const u = (X + 0.5) / d - (bx + 3);
      const v = (Y + 0.5) / d - (sag + 1);
      return pick(fr, v < e ? col.i - 1 : v > 2.4 ? col.i - 1 : u < 0 ? col.i : col.i - (col.i > 5 ? 1 : 0.5) | 0);
    });
  }
  // The pavement: two rows of slabs with lit top-left edges and dark joints, a little wear.
  const stone = idx(PAL_HD.stone);
  for (let Y = ground * d; Y < (ground + 8) * d; Y++) {
    const y = (Y + 0.5) / d - ground;
    const row = y < 4 ? 0 : 1;
    const ry = y - row * 4;
    for (let X = 0; X < c.W; X++) {
      const x = (X + 0.5) / d + row * 6;
      const slab = Math.floor(x / 12);
      const sx = x - slab * 12;
      let v = 3 + (hash2(slab, row, 151) - 0.5) * 0.9 + (noise2(x, y, 3, 152) - 0.5) * 0.5;
      if (sx < e || ry < e) v = 4.4;
      if (sx > 12 - e || ry > 4 - e) v = 1.6;
      if (hash2(X >> 1, Y >> 1, 153) < 0.025) v -= 1;
      c.dot(X, Y, pick(stone, dq(v + 0.5, X, Y, 0.3)));
    }
  }
  // The kerb: a lit top, its face, a shadow line on the road.
  for (let Y = (ground + 8) * d; Y < (ground + 10) * d; Y++) {
    const fy = (Y + 0.5) / d - (ground + 8);
    c.span(0, c.W, Y, pick(stone, fy < 0.5 ? 6 : fy > 2 - e ? 3 : 5));
  }
  // The road: asphalt with a slow mottle and clustered grit, a gutter shade, worn lane marks.
  const cell = Math.max(1, d >> 1);
  for (let Y = (ground + 10) * d; Y < c.H; Y++) {
    const y = (Y + 0.5) / d;
    for (let X = 0; X < c.W; X++) {
      const x = (X + 0.5) / d;
      let v = 2 + (noise2(x, y, 9, 161) - 0.5) * 0.9;
      if (y < ground + 13) v -= ((ground + 13 - y) / 3) * 0.9;
      const g = hash2(Math.floor(X / cell), Math.floor(Y / cell), 162);
      if (g < 0.035) v += 1;
      else if (g < 0.06) v -= 1;
      c.dot(X, Y, pick(stone, dq(v + 0.5, X, Y, 0.35)));
    }
  }
  const paint = idx(PAL_HD.snow);
  for (let px = 4; px < VW; px += 32) {
    for (let Y = 194 * d; Y < 196 * d; Y++) {
      for (let X = px * d; X < (px + 14) * d; X++) {
        const edge = X - px * d < d || (px + 14) * d - X <= d || Y === 194 * d || Y === 196 * d - 1;
        if (edge && hash2(X, Y, 171) < 0.4) continue;
        if (hash2(X >> 1, Y >> 1, 172) < 0.06) continue;
        c.dot(X, Y, pick(paint, Y < 194 * d + Math.max(1, d >> 1) ? 3 : 2));
      }
    }
  }
  return topLeft(c.finish());
}

// ------------------------------------------------------------------------------------ the credits night

/**
 * The night of the first-person route's credits: the 1× flat night colour stays behind the roll
 * (the text keeps its contrast); a deeper zenith with fine stars above, and at the bottom a low
 * ridge with pines against the dull red glow of the fire the embers rise from.
 */
function nightHd(d: Den): Frame {
  const c = new BgCanvas(VW, VH, d);
  const mid = PAL.navy[0];
  hdGradient(c, 0, 56, [PAL_HD.navy[0], mid], 0.7);
  c.rect(0, 56, VW, 110, ix(mid));
  hdGradient(c, 166, VH, [mid, PAL_HD.purple[0], PAL_HD.red[0], PAL_HD.red[1]], 0.7);
  // Stars: dim single art px, a few brighter with short rays (fewer toward the glow).
  const dim = [ix(PAL_HD.navy[4]), ix(PAL_HD.snow[0]), ix(PAL_HD.slate[4])];
  const bright = ix(PAL_HD.snow[3]);
  for (let i = 0; i < 110; i++) {
    const x = hash2(i, 1, 81) * VW;
    const y = hash2(i, 2, 81) ** 1.4 * 180;
    const X = Math.floor(x * d);
    const Y = Math.floor(y * d);
    if (hash2(i, 3, 81) < 0.9) c.dot(X, Y, dim[i % 3]);
    else {
      c.dot(X, Y, bright);
      for (let k = 1; k < d; k++) {
        c.dot(X + k, Y, dim[1]);
        c.dot(X - k, Y, dim[1]);
        c.dot(X, Y + k, dim[1]);
        c.dot(X, Y - k, dim[1]);
      }
    }
  }
  // The ridge with pines, its edge lit by the glow behind it.
  const black = ix(PAL_HD.ink[0]);
  const rim = ix(PAL_HD.red[1]);
  const W = c.W;
  for (let X = 0; X < W; X++) {
    const x = (X + 0.5) / d;
    let top = 203 + 5 * noise2(x, 1, 60, 83) + 2 * Math.sin(x / 17);
    const j = Math.floor(x / 9);
    if (hash2(j, 4, 85) < 0.45) {
      const cx = j * 9 + 2 + hash2(j, 5, 85) * 5;
      const hgt = 6 + hash2(j, 6, 85) * 8;
      const halfW = 1.2 + hgt * 0.22;
      const dx = Math.abs(x - cx);
      if (dx < halfW) top = Math.min(top, top - hgt * (1 - dx / halfW) + (Math.floor((x - cx + 9) * 1.5) % 2) * 0.4);
    }
    const Yt = Math.max(0, Math.round(top * d));
    if (Yt < c.H) c.dot(X, Yt, rim);
    for (let Y = Yt + 1; Y < c.H; Y++) c.px[Y * W + X] = black;
  }
  return topLeft(c.finish());
}

/** The embers' colours (the 1× scene's EMBER_COLS) and frames: 1× one px; HD a spark with a hot core. */
export const EMBER_COLORS: readonly Color[] = [PAL.red[2], PAL.gold[2], PAL.gold[3], PAL.red[3]];

function emberFrames(d: 1 | Den): Frame[] {
  return EMBER_COLORS.map((col) => {
    const b = new PixelBuffer(d, d);
    if (d === 1) b.set(0, 0, col);
    else if (d === 2) {
      b.rect(0, 0, 2, 2, col);
      b.set(0, 0, step(col, 2));
    } else {
      const hot = step(col, 2);
      const edge = step(col, -1);
      for (let y = 0; y < d; y++) {
        for (let x = 0; x < d; x++) {
          const r = Math.hypot(x + 0.5 - d / 2, y + 0.5 - d / 2) / (d / 2);
          if (r < 0.5) b.set(x, y, hot);
          else if (r < 0.85) b.set(x, y, col);
          else if (r < 1.1) b.set(x, y, edge);
        }
      }
    }
    return topLeft(b);
  });
}

// ------------------------------------------------------------------------------------ the victory stage

/** The spotlight's box: 72 × 106 from (156, 44); the 1× beam widens from 12 px to 72 px. */
export const BEAM_BOX = { x: 156, y: 44, w: 72, h: 106 } as const;

function beamOne(): Frame {
  const b = new PixelBuffer(BEAM_BOX.w, BEAM_BOX.h);
  for (let y = 44; y < 150; y += 2) {
    const half = 6 + Math.round(((y - 44) / 106) * 30);
    b.rect(36 - half, y - 44, half * 2, 2, PAL.gold[3]);
  }
  return topLeft(b);
}

/** The HD beam (drawn additively): smooth edges, a hot core that fades to the rim, dust in the light. */
function beamHd(d: Den): Frame {
  const c = new BgCanvas(BEAM_BOX.w, BEAM_BOX.h, d);
  const ramp = idx([PAL_HD.orange[2], PAL_HD.gold[3], PAL_HD.gold[4], PAL_HD.gold[5], PAL_HD.gold[6], PAL_HD.gold[7]]);
  const W = c.W;
  for (let Y = 0; Y < c.H; Y++) {
    const y = (Y + 0.5) / d;
    const half = 6 + (y / 106) * 30;
    const fade = Math.min(1, y / 8);
    for (let X = 0; X < W; X++) {
      const a = Math.abs((X + 0.5) / d - 36) / half;
      if (a >= 1) continue;
      const v = (1 - a * a) * 5.2 * (0.5 + 0.5 * fade) + 0.3;
      c.px[Y * W + X] = pick(ramp, dq(v, X, Y, 0.5));
    }
  }
  const mote = ix(PAL_HD.gold[7]);
  for (let i = 0; i < 26; i++) {
    const y = 10 + hash2(i, 1, 91) * 92;
    const half = 6 + (y / 106) * 30;
    const x = 36 + (hash2(i, 2, 91) * 2 - 1) * half * 0.8;
    c.dot(Math.floor(x * d), Math.floor(y * d), mote);
  }
  return topLeft(c.finish());
}

function stageOne(): Frame {
  const b = new PixelBuffer(80, 3);
  b.rect(0, 0, 80, 3, PAL.stone[1]);
  return topLeft(b);
}

/** The little stage: lit board edges with the spotlight's warm pool in the middle, a planked front. */
function stageHd(d: Den): Frame {
  const c = new BgCanvas(80, 3, d);
  const edge = idx([PAL_HD.stone[2], PAL_HD.stone[3], PAL_HD.stone[4], PAL_HD.sand[5], PAL_HD.sand[6]]);
  const face = idx([PAL_HD.stone[0], PAL_HD.stone[1], PAL_HD.stone[2], PAL_HD.stone[3]]);
  const seam = ix(PAL_HD.ink[1]);
  const W = c.W;
  const top = Math.max(1, d >> 1);
  for (let Y = 0; Y < c.H; Y++) {
    const y = (Y + 0.5) / d;
    for (let X = 0; X < W; X++) {
      const x = (X + 0.5) / d;
      const pool = Math.exp(-(((x - 40) / 20) ** 2));
      let i: number;
      if (Y < top) i = pick(edge, dq(1 + pool * 3.6, X, Y, 0.6));
      else if (Y >= c.H - Math.max(1, d >> 1)) i = face[0];
      else if (x % 10 < 1 / d || Math.abs((x % 10) - 5) < 0.5 / d) i = seam;
      else i = pick(face, dq(1.6 + pool * 1.6 - y * 0.3 + (noise2(x * 3, y, 2, 93) - 0.5) * 0.8, X, Y, 0.5));
      c.px[Y * W + X] = i;
    }
  }
  return topLeft(c.finish());
}

// ------------------------------------------------------------------------------------ high-score heads

/** The head icons painted at density d: the squad from their select faces, the others from the rig. */
const HEAD_IDS: readonly string[] = [...new Set(['legion', 'recruit', ...Object.keys(HERO_STYLES)])];

/** The bust and crop a character's 1× portrait was made from (portrait.art.ts / human-sprites.ts `portrait`). */
function bustOf(id: string, style: HumanStyle): { pose: Pose; sx: number; sy: number } {
  const cfg = PORTRAITS[id];
  const pose: Pose = { armN: { sh: 4, el: 10 }, armF: { sh: -4, el: 10 }, expr: cfg?.expr ?? 'normal', ...cfg?.pose };
  const bust = renderHuman(style, pose, 'upper');
  const head = bust.pts.head ?? [0, -14];
  if (!cfg) return { pose, sx: bust.ox + head[0] - 8, sy: bust.oy + head[1] - 8 };
  const top = bust.buf.trimBounds()?.y ?? bust.oy + head[1] - 8;
  return { pose, sx: bust.ox + head[0] - 8 + (cfg.dx ?? 0), sy: top - 1 + (cfg.dy ?? 0) };
}

/** Clear the panel colours that touch the region's border (flood fill), keeping the same colours inside the head. */
function dropPanel(b: PixelBuffer): void {
  const { w, h, data } = b;
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const bg = (i: number): boolean => (data[i] & 255) === 0 || HEAD_BACKGROUND.has(data[i] >>> 0);
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop() as number;
    if (seen[i] || !bg(i)) continue;
    seen[i] = 1;
    data[i] = 0;
    const x = i % w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w);
    if (i < w * (h - 1)) stack.push(i + w);
  }
  b.touch();
}

/**
 * The Legion shako at density d, painted natively inside the 1× design's cells (the same
 * silhouette): a white plume lit from the upper left with feather strokes, a black lacquered
 * cylinder with a sheen streak and a cool rim on the right, a lit crown, a gold badge with a
 * specular, the crimson band and chin strap as lit cylinders, a round face with two eyes
 * (a catchlight at 4×), outline A.
 */
function legionHd(d: Den): PixelBuffer {
  const { rows } = LEGION_HEAD;
  const b = new PixelBuffer((rows[0].length + 2) * d, (rows.length + 2) * d);
  const snow = PAL_HD.snow;
  const black = PAL_HD.black;
  const red = PAL_HD.red;
  const gold = PAL_HD.gold;
  const skin = PAL_HD.skinA;
  const ink = PAL_HD.ink[0];
  const at = (r: Ramp, t: number): Color => r[Math.max(0, Math.min(r.length - 1, Math.round(t)))];
  for (let Y = d; Y < b.h - d; Y++) {
    const y = (Y + 0.5) / d - 1;
    for (let X = d; X < b.w - d; X++) {
      const x = (X + 0.5) / d - 1;
      const cell = rows[Math.floor(y)][Math.floor(x)];
      const fx = x - Math.floor(x);
      const fy = y - Math.floor(y);
      let c: Color | null = null;
      if (cell === 'w') {
        const u = (x - 3) / 2;
        const v = y / 2;
        c = at(snow, 6.6 - 1.4 * u - 0.6 * v + (Math.sin((x - 3) * 7 + v * 4) > 0.55 ? -0.9 : 0));
      } else if ((cell === 'k' || cell === '.') && y >= 8 && y < 9 && x >= 3 && x < 5) {
        // The eyes: one per cell (at 4× a smaller oval in the face with a catchlight).
        const inEye = d < 4 || ((fx - 0.5) / 0.32) ** 2 + ((fy - 0.5) / 0.45) ** 2 < 1;
        c = !inEye ? at(skin, 5) : d >= 4 && fx < 0.5 && fx > 0.25 && fy < 0.5 && fy > 0.25 ? snow[6] : ink;
      } else if (cell === 'k' || (cell === 'g' && (Math.hypot(fx - 0.5, fy - 0.5) > 0.42))) {
        const u = (x - 2) / 4;
        let t = 1.4 - Math.abs(u - 0.45) * 1.6;
        if (u > 0.17 && u < 0.3) t += 3;
        if (u > 0.86) t += 1.6;
        if (y < 2.5) t += 2;
        if (y > 5.6) t -= 1;
        c = at(black, t);
      } else if (cell === 'g') {
        const r2 = (fx - 0.5) ** 2 + (fy - 0.5) ** 2;
        c = fx + fy < 0.75 && r2 < 0.12 ? gold[7] : at(gold, 6 - r2 * 10 - (fx + fy > 1.1 ? 2 : 0));
      } else if (cell === 'r') {
        const u = y < 7 ? (x - 1) / 6 : y >= 10 ? (x - 3) / 2 : fx;
        c = at(red, 4.2 - Math.abs(u - 0.35) * 3 + (u < 0.3 ? 1 : 0) + (fy < 0.3 && y < 7 ? 1.5 : 0) - (fy > 0.75 ? 0.8 : 0));
      } else if (cell === 's') {
        const r2 = ((x - 4) / 2.4) ** 2 + ((y - 8.4) / 1.8) ** 2;
        c = at(skin, 5.6 - r2 * 1.8 - (x - 3.6) * 0.35 - (y > 9.5 ? 0.6 : 0));
      }
      if (c === null) continue;
      b.set(X, Y, c);
    }
  }
  return inkRing(b.touch(), d);
}

/** The HD ramp holding a colour and its index there. */
function homeRamp(c: Color): { ramp: Ramp; i: number } {
  const hit = HD_HOME.get(c >>> 0);
  if (hit) return hit;
  const r: Ramp = [c];
  return { ramp: r, i: 0 };
}

const HD_HOME = (() => {
  const m = new Map<number, { ramp: Ramp; i: number }>();
  for (const ramp of Object.values(PAL_HD) as Ramp[]) ramp.forEach((c, i) => m.has(c >>> 0) || m.set(c >>> 0, { ramp, i }));
  return m;
})();

/** A head icon at density d: the 1× icon's crop painted natively (the same logical size). */
function headHd(id: string, d: Den): Frame {
  const one = headIcon(id);
  if (!one) return topLeft(new PixelBuffer(d, d));
  if (id === 'legion') return topLeft(legionHd(d));
  const crop = headCrop(id);
  const style = HERO_STYLES[id] ?? (id === 'recruit' ? RECRUIT_STYLE : null);
  const out = new PixelBuffer(one.w * d, one.h * d);
  if (!crop) return topLeft(out);
  let region: PixelBuffer;
  if (isSquad(id)) {
    // The select face at half the icon's density: one icon px is two portrait px.
    const p = d === 4 ? 2 : 1;
    region = smallPortrait(id, p).crop(p * (1 + 2 * crop.x), p * (1 + 2 * crop.y), crop.w * d, crop.h * d);
  } else if (style) {
    const { pose, sx, sy } = bustOf(id, style);
    region = renderHuman(style, pose, 'upper', d).buf.crop((sx + crop.x) * d, (sy + crop.y) * d, crop.w * d, crop.h * d);
  } else return topLeft(out);
  dropPanel(region);
  out.blit(region, d, d);
  return topLeft(inkRing(out, d));
}

function headOne(id: string): Frame {
  return topLeft(headIcon(id) ?? new PixelBuffer(1, 1));
}

/** Every backdrop and effect of the ending flow (their 4× frames are dropped when the flow ends). */
export const ENDING_ART: readonly string[] = [LAKE_ID, GLINT_ID, NIGHT_ID, EMBER_ID, BEAM_ID, STAGE_ID, SEA_NIGHT_ID, SEA_DAWN_ID, STREET_SKY_ID, STREET_CITY_ID, STREET_ID];

function defineEndingHdArt(): void {
  defineSprite(LAKE_ID, () => topLeft(lakeBackdrop(VW, VH)), { ...BACKDROP, hd: (d) => lakeHd(d) });
  defineSprite(GLINT_ID, () => glintFrames(1), { ...BACKDROP, hd: (d) => glintFrames(d) });
  defineSprite(NIGHT_ID, () => topLeft(new PixelBuffer(VW, VH).fill(PAL.navy[0])), { ...BACKDROP, hd: (d) => nightHd(d) });
  defineSprite(EMBER_ID, () => emberFrames(1), { ...BACKDROP, hd: (d) => emberFrames(d) });
  defineSprite(BEAM_ID, beamOne, { ...BACKDROP, hd: (d) => beamHd(d) });
  defineSprite(STAGE_ID, stageOne, { ...BACKDROP, hd: (d) => stageHd(d) });
  defineSprite(SEA_NIGHT_ID, seaNightOne, { ...BACKDROP, hd: (d) => seaNightHd(d) });
  defineSprite(SEA_DAWN_ID, seaDawnOne, { ...BACKDROP, hd: (d) => seaDawnHd(d) });
  defineSprite(STREET_SKY_ID, streetSkyOne, { ...BACKDROP, hd: (d) => streetSkyHd(d) });
  defineSprite(STREET_CITY_ID, streetCityOne, { ...BACKDROP, hd: (d) => streetCityHd(d) });
  defineSprite(STREET_ID, streetFrontOne, { ...BACKDROP, hd: (d) => streetFrontHd(d) });
  for (const id of HEAD_IDS) defineSprite(headSpriteId(id), () => headOne(id), { ...BACKDROP, hd: (d) => headHd(id, d) });
}
