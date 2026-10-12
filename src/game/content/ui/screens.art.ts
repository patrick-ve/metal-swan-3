/**
 * Art for the flow screens (GDD §13): the tally newspaper and its stamp, Brigadier Gusto's
 * radio portrait, the title lake scene (a stand-in swan until `vehicle/swan/swim` exists, the
 * tiny Legion parade on the far bank), and the props of the continue gag. Original designs,
 * palette ramps only, 1 px ink outlines, light from the top left.
 */
import type { Color } from '../../../engine/color';
import { drawText } from '../../../engine/font';
import { INK, PAL } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineSprite } from '../../../engine/sprites';
import { portrait } from '../../art/human-sprites';
import type { HumanStyle } from '../../art/humanoid';

const topLeft = { anchor: 'top-left' as const };

// ---------------------------------------------------------------------------------------------
// The newspaper (GDD §13.11)
// ---------------------------------------------------------------------------------------------

/** Paper size: the page covers the screen but a 12 px / 6 px border. */
export const PAPER_W = 360;
export const PAPER_H = 204;

/**
 * The tally page of THE LOWMERE LISTENER: warm paper with a faint fibre, a drop shadow, the
 * masthead rules and a little ivory swan emblem at each side of the masthead. Text is drawn by
 * the scene on top.
 */
function newspaper(): Frame[] {
  const w = PAPER_W;
  const h = PAPER_H;
  const b = new PixelBuffer(w + 3, h + 3);
  // Shadow, paper, fibre speckle (ordered, sparse), a darker edge.
  b.rect(3, 3, w, h, PAL.ink[1]);
  b.rect(0, 0, w, h, PAL.snow[2]);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (((x * 7 + y * 13) % 29 === 0 && (x + y) % 3 === 0) || (y % 37 === 0 && x % 5 === 0)) b.set(x, y, PAL.snow[1]);
  b.strokeRect(0, 0, w, h, PAL.stone[2]);
  b.rect(1, h - 2, w - 2, 1, PAL.snow[1]);
  // Masthead rules: a thick and a thin line under the title block, a thin one under the headline.
  b.rect(10, 30, w - 20, 2, INK);
  b.rect(10, 33, w - 20, 1, INK);
  b.rect(10, 50, w - 20, 1, PAL.stone[1]);
  // Ivory swan emblems left and right of the masthead.
  const emblem = swanEmblem();
  b.blit(emblem, 14, 6);
  b.blit(emblem, w - 14 - emblem.w, 6, { flipX: true });
  // Small print under the rules: price and date boxes.
  drawText(b, 'PRICE: ONE KAZOO', 12, 22, { font: 'small', color: PAL.stone[0] });
  drawText(b, 'EVENING EXTRA', w - 12, 22, { font: 'small', color: PAL.stone[0], align: 'right' });
  return [{ buf: b, ox: 0, oy: 0 }];
}

/** A 14×13 swan silhouette in ink (the paper's emblem). */
function swanEmblem(): PixelBuffer {
  const rows = ['.....##.......', '....####......', '....##.##.....', '....##........', '.....##.......', '......##......', '......##....#.', '.....###...##.', '..########.##.', '.############.', '############..', '.##########...', '..#######.....'];
  const b = new PixelBuffer(14, 13);
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) if (r[x] === '#') b.set(x, y, INK);
  });
  return b;
}

/** The rubber stamp that drops the headline: a wooden knob on a crimson pad; frame 1 squashed. */
function stampFrames(): Frame[] {
  const out: Frame[] = [];
  for (let i = 0; i < 2; i++) {
    const b = new PixelBuffer(22, 26);
    const squash = i;
    // Knob and handle (wood), the base block (wood), the ink pad (crimson).
    b.ellipse(7, 1 + squash, 8, 7, PAL.brown[2]);
    b.rect(9, 7 + squash, 4, 7 - squash, PAL.brown[2]);
    b.rect(2, 14, 18, 6, PAL.brown[2]);
    b.rect(1, 20, 20, 4 - squash, PAL.red[2]);
    b.bevel(PAL.brown, { light: 'tl', depth: 1 });
    b.rect(1, 20, 20, 1, PAL.red[3]);
    b.rect(1, 23 - squash, 20, 1, PAL.red[1]);
    out.push({ buf: b.padded(1).outline(INK), ox: 12, oy: 26 });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Brigadier Lionel Gusto (GDD §13.6): big, red-faced, peaked cap, moustache, microphone in hand
// ---------------------------------------------------------------------------------------------

const GUSTO_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: 'stone',
  hairStyle: 'short',
  headgear: 'cap',
  gear: 'olive',
  accent: 'gold',
  top: 'olive',
  topType: 'tunic',
  pants: 'olive',
  boots: 'black',
  gloves: null,
  belt: 'brown',
  build: 'heavy',
  accessories: ['epaulettes'],
  face: ['moustache', 'blush'],
};

function gustoPortrait(): Frame[] {
  const b = portrait(GUSTO_STYLE);
  // A gold cap badge, then the microphone: a black grille ball on a steel stem in his fist,
  // its cable curling out of the frame (drawn in 2×2 blocks to match the portrait's scale).
  const px = (x: number, y: number, c: Color): void => {
    b.rect(x, y, 2, 2, c);
  };
  px(14, 5, PAL.gold[3]);
  const fist = PAL.skinA[2];
  for (const [x, y] of [[22, 24], [24, 24], [22, 26], [24, 26], [26, 26]] as const) px(x, y, fist);
  px(22, 28, PAL.skinA[1]);
  px(24, 28, PAL.skinA[1]);
  px(24, 22, PAL.steel[3]);
  px(24, 20, PAL.steel[2]);
  for (const [x, y, c] of [[22, 16, PAL.black[2]], [24, 16, PAL.black[3]], [22, 18, PAL.black[1]], [24, 18, PAL.black[2]], [26, 16, PAL.black[1]], [26, 18, PAL.black[1]], [24, 14, PAL.black[1]], [22, 14, PAL.black[1]]] as const) px(x, y, c);
  b.set(24, 16, PAL.steel[4]);
  b.strokeRect(0, 0, 32, 32, INK);
  return [{ buf: b, ox: 0, oy: 0 }];
}

// ---------------------------------------------------------------------------------------------
// Title lake scene (GDD §13.3)
// ---------------------------------------------------------------------------------------------

/**
 * A stand-in for the swimming SWAN-3 until the vehicle art exists: ivory boat hull on the water
 * (navy waterline stripe, gold rivets, a navy '3'), an upturned tail of three blades, the far
 * wing arched behind the seat, the S-neck and her head with the lens eye and the orange beak.
 * Anchor = the float line (feet), 16 px under the surface; point `seat` = the rider's hip.
 * Two frames: the hull bobs 1 px.
 */
function titleSwanFrames(): Frame[] {
  const out: Frame[] = [];
  for (let f = 0; f < 2; f++) {
    const w = 82;
    const h = 64;
    const ax = 40; // anchor x (feet centre) in the buffer
    const surf = h - 16; // the water surface row
    const b = new PixelBuffer(w, h);
    const dy = f;
    // Under water: paddling legs in water colours (look.md §5.8).
    const under = new PixelBuffer(w, h);
    under.thickLine(ax - 6, surf + 2, ax - 10 + f * 6, h - 4, 3, PAL.navy[1]);
    under.thickLine(ax + 4, surf + 2, ax + 8 - f * 6, h - 5, 3, PAL.steel[1]);
    under.ellipse(ax - 15 + f * 6, h - 5, 8, 3, PAL.teal[1]);
    under.ellipse(ax + 3 - f * 6, h - 6, 8, 3, PAL.teal[2]);
    under.rect(ax - 24, surf, 44, 4, PAL.sky[1]);
    under.outline(PAL.navy[0]);
    b.blit(under, 0, 0);
    // Far wing arch behind the seat.
    const top = new PixelBuffer(w, h);
    top.poly([ax - 20, surf - 14 + dy, ax - 6, surf - 26 + dy, ax + 6, surf - 22 + dy, ax + 2, surf - 13 + dy], PAL.snow[1]);
    top.rect(ax - 7, surf - 25 + dy, 6, 2, PAL.navy[1]);
    // Tail blades (upturned) and the hull: a long low boat shape riding the surface.
    top.poly([ax - 30, surf - 10 + dy, ax - 38, surf - 22 + dy, ax - 33, surf - 21 + dy, ax - 25, surf - 12 + dy], PAL.snow[2]);
    top.poly([ax - 30, surf - 8 + dy, ax - 40, surf - 15 + dy, ax - 35, surf - 15 + dy, ax - 26, surf - 9 + dy], PAL.snow[1]);
    top.rect(ax - 37, surf - 21 + dy, 3, 6, PAL.navy[1]);
    top.poly([ax - 30, surf - 14 + dy, ax + 18, surf - 16 + dy, ax + 24, surf - 10 + dy, ax + 18, surf + 2 + dy, ax - 24, surf + 2 + dy, ax - 31, surf - 6 + dy], PAL.snow[2]);
    top.bevel(PAL.snow, { light: 'tl', depth: 1 });
    // Waterline stripe, rivets, the bow number, the seat pad and the brass handles.
    top.rect(ax - 26, surf - 2 + dy, 46, 2, PAL.navy[1]);
    for (let x = ax - 22; x < ax + 16; x += 6) top.set(x, surf - 12 + dy, PAL.gold[3]);
    drawText(top, '3', ax + 12, surf - 11 + dy, { font: 'small', color: PAL.navy[1] });
    top.rect(ax - 12, surf - 17 + dy, 12, 3, PAL.navy[1]);
    top.rect(ax - 11, surf - 17 + dy, 10, 1, PAL.navy[2]);
    top.rect(ax + 1, surf - 21 + dy, 2, 5, PAL.gold[2]);
    // The S-neck (rings on a hose) and the head.
    const neck = [ax + 16, surf - 14, ax + 22, surf - 22, ax + 20, surf - 30, ax + 16, surf - 37, ax + 18, surf - 43, ax + 23, surf - 45];
    for (let i = 0; i + 3 < neck.length; i += 2) top.thickLine(neck[i], neck[i + 1] + dy, neck[i + 2], neck[i + 3] + dy, 5, PAL.snow[2]);
    top.ellipse(ax + 19, surf - 50 + dy, 10, 8, PAL.snow[3]);
    top.bevel(PAL.snow, { light: 'tl', depth: 1, only: PAL.snow[2] });
    for (let i = 0; i < 4; i++) top.set(ax + 21 - (i % 2), surf - 24 - i * 5 + dy, PAL.snow[0]);
    // Lens eye, navy face patch, orange beak with a steel nail.
    top.set(ax + 23, surf - 48 + dy, PAL.gold[2]);
    top.set(ax + 24, surf - 48 + dy, INK);
    top.set(ax + 25, surf - 47 + dy, PAL.navy[0]);
    top.set(ax + 26, surf - 46 + dy, PAL.navy[0]);
    for (let i = 0; i < 9; i++) {
      top.set(ax + 27 + i, surf - 46 + dy, i < 8 ? PAL.orange[3] : PAL.steel[3]);
      if (i < 7) top.set(ax + 27 + i, surf - 45 + dy, PAL.orange[1]);
    }
    top.outline(INK);
    b.blit(top, 0, 0);
    // Foam at the waterline and a bow wave.
    for (let x = ax - 28; x < ax + 24; x += 2) b.set(x, surf + 2 + dy, (x + f) % 4 === 0 ? PAL.snow[3] : PAL.sky[3]);
    b.rect(ax + 22, surf + dy, 3, 1, PAL.snow[3]);
    out.push({ buf: b, ox: ax, oy: h, pts: { seat: [-6, -30 + dy], neck: [16, -30 + dy] } });
  }
  return out;
}

/** Tiny Legion bandsmen for the far bank (6 × 11): crimson tunic, white trousers, black shako. */
function paradeFrames(): Frame[] {
  const frames = [
    ['..w..', '.kk..', '.kk..', '.ss..', 'rRgr.', '.RRr.', '.rr..', '.ww..', 'w..w.', 'k..k.'],
    ['..w..', '.kk..', '.kk..', '.ss..', 'rRgr.', '.RRr.', '.rr..', '.ww..', '.ww..', '.kk..'],
  ];
  return frames.map((rows) => {
    const b = new PixelBuffer(5, rows.length);
    const key: Readonly<Record<string, Color>> = { w: PAL.snow[3], k: INK, s: PAL.skinA[2], r: PAL.red[1], R: PAL.red[2], g: PAL.gold[3] };
    rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) if (key[r[x]] !== undefined) b.set(x, y, key[r[x]]);
    });
    return { buf: b, ox: 2, oy: rows.length };
  });
}

// ---------------------------------------------------------------------------------------------
// Continue gag props (GDD §13.9)
// ---------------------------------------------------------------------------------------------

/** A folding chair with a coil of rope on its back (feet anchor). */
function chairFrames(): Frame[] {
  const b = new PixelBuffer(18, 26);
  b.rect(3, 13, 12, 3, PAL.brown[2]); // seat
  b.rect(12, 1, 3, 15, PAL.brown[2]); // back post
  b.rect(11, 2, 5, 6, PAL.brown[2]); // back rest
  b.line(4, 16, 13, 25, PAL.steel[2]);
  b.line(13, 16, 4, 25, PAL.steel[2]);
  b.bevel(PAL.brown, { light: 'tl', depth: 1, only: PAL.brown[2] });
  return [{ buf: b.padded(1).outline(INK), ox: 9, oy: 27 }];
}

/** Ropes wound round the sitter (drawn over the figure): two bands of sand rope. */
function ropeFrames(): Frame[] {
  const b = new PixelBuffer(16, 12);
  for (const y of [1, 7]) {
    b.rect(0, y, 16, 3, PAL.sand[2]);
    for (let x = 0; x < 16; x += 3) b.set(x, y + 1, PAL.sand[1]);
    b.rect(0, y, 16, 1, PAL.sand[3]);
  }
  return [{ buf: b.padded(1).outline(INK), ox: 9, oy: 13 }];
}

/**
 * The giant Legion loudspeaker on a cart (feet anchor): a crimson-and-gold horn on a brass
 * stand, wheels, a big switch. Frame 0 off, 1 on (a wobbling cone and sound rings).
 */
function loudspeakerFrames(): Frame[] {
  const out: Frame[] = [];
  for (let f = 0; f < 3; f++) {
    const w = 44;
    const h = 46;
    const b = new PixelBuffer(w, h);
    const on = f > 0;
    // Cart, wheels, stand.
    b.rect(8, 34, 30, 5, PAL.red[1]);
    b.circle(13, 40, 4, PAL.steel[2]);
    b.circle(33, 40, 4, PAL.steel[2]);
    b.rect(21, 22, 4, 12, PAL.gold[2]);
    // The horn: a cone opening to the left (toward the chair), crimson with gold rims.
    b.poly([24, 14, 38, 8, 38, 30, 24, 24], PAL.red[2]);
    b.poly([4, 2 - (on ? f - 1 : 0), 24, 12, 24, 26, 4, 36 + (on ? f - 1 : 0)], PAL.red[2]);
    b.bevel(PAL.red, { light: 'tl', depth: 1, only: PAL.red[2] });
    b.rect(3, 1, 3, 37, PAL.gold[2]);
    b.rect(3, 1, 1, 37, PAL.gold[3]);
    b.ellipse(1, 12, 6, 14, on ? PAL.snow[2] : PAL.ink[1]);
    // The switch box on the cart.
    b.rect(30, 26, 8, 8, PAL.steel[2]);
    b.rect(33, on ? 27 : 30, 2, 3, on ? PAL.gold[3] : PAL.red[3]);
    b.bevel(PAL.steel, { light: 'tl', depth: 1, only: PAL.steel[2] });
    out.push({ buf: b.padded(1).outline(INK), ox: 23, oy: h + 1 });
  }
  // Frame 3: knocked over onto its back (the continue gag's punch), the horn pointing up.
  const fallen = out[0].buf.rotated(Math.PI / 2, { quality: 'fast' });
  out.push({ buf: fallen, ox: fallen.w >> 1, oy: fallen.h });
  return out;
}

export function defineScreenArt(): void {
  defineSprite('ui/newspaper', newspaper, topLeft);
  defineSprite('ui/stamp', stampFrames);
  defineSprite('ui/portrait-gusto', gustoPortrait, topLeft);
  defineSprite('ui/title-swan', titleSwanFrames, { ticksPerFrame: 30 });
  defineSprite('ui/parade', paradeFrames, { ticksPerFrame: 10 });
  defineSprite('ui/chair', chairFrames);
  defineSprite('ui/rope', ropeFrames);
  defineSprite('ui/loudspeaker', loudspeakerFrames, { ticksPerFrame: 4 });
}
