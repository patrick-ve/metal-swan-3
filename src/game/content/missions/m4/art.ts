/**
 * Mission m4 (OPENING NIGHT) decor sprites, `decor/m4/<id>` (GDD §15.6). Procedural pixel art,
 * palette colours only, ink outlines.
 *
 * | id | anchor | what |
 * |---|---|---|
 * | `sign` | feet (post bottom) | 6 frames: SUBWAY ↓ · ROOFTOPS ↑ · NOW UNDER NEW MANAGEMENT · CLOAKROOM · EXIT ↑ · ZIP-LINE → |
 * | `lamp-post` | feet (pole bottom) | street lamp, 120 tall; the arm reaches 24 px to the right at 116 px up (a cage rope hangs there) |
 * | `banner` | top-left | crimson Legion banner 14×40 with the gold crest |
 * | `billboard-44` `billboard-60` `billboard-48` `billboard-100` | top-left (the platform top) | rooftop billboards 80 wide (giant 100) down to the roof |
 * | `water-tower` | top-left | 32×48 water tower over the solid block |
 * | `pillar` | top-left | tiled subway pillar 16×112 (ceiling y 40 → platform y 152) |
 * | `bench` | feet | station bench 30×12 |
 * | `stairs-up` | feet (platform line) | exit stairs at the station end, 40 wide |
 * | `fire-escape` | top-left | ladder and rails behind the m4-b fire-escape platforms, 72×108 |
 * | `subway-globe` | feet | the subway entrance lamp post (m4-b) |
 * | `critics-box` | feet | a theatre box (gold frame, crimson drape) around a hostage, 44×52 |
 * | `curtain` | top-left | stage curtain 28×176 (frame 0 left, 1 right) |
 * | `pit-rail` | feet | orchestra-pit brass rail 72×14 |
 * | `zip-pole` | feet | zip-line pole with the cable going down to the right |
 * | `hatch` | top-left | the subway hatch lid 40×8 (frames: closed, half, open) |
 */
import { drawText, measure } from '../../../../engine/font';
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { plate } from '../../../art/machines';
import { fanfaroniFace } from './paint';

export const SIGN_FRAMES = ['SUBWAY ↓', 'ROOFTOPS ↑', 'NOW UNDER\nNEW MANAGEMENT', 'CLOAKROOM', 'EXIT ↑', 'ZIP-LINE →'] as const;
export const SIGN = { subway: 0, rooftops: 1, management: 2, cloakroom: 3, exit: 4, zipline: 5 } as const;

/** A sign on a post: a navy enamel plate with a gold rim. */
function sign(text: string): Frame {
  const lines = text.split('\n').length;
  const w = measure(text, 'small') + 10;
  const ph = lines * 10 + 4;
  const post = 26;
  const b = new PixelBuffer(w + 2, ph + post + 2);
  const cx = (w + 2) >> 1;
  b.rect(cx - 1, ph, 3, post + 1, PAL.steel[1]);
  b.vline(cx - 1, ph, ph + post, PAL.steel[2]);
  b.rect(1, 1, w, ph, PAL.navy[1]);
  b.strokeRect(1, 1, w, ph, PAL.gold[2]);
  b.hline(2, w - 1, 2, PAL.sky[0]);
  drawText(b, text, 1 + w / 2, 4, { font: 'small', color: PAL.snow[3], align: 'center' });
  return { buf: b.outline(INK), ox: cx, oy: ph + post + 2 };
}

/** Street lamp with an arm to the right and a crimson pennant. */
function lampPost(): Frame {
  const b = new PixelBuffer(34, 124);
  const px = 6;
  b.rect(px - 3, 112, 8, 10, PAL.steel[1]);
  b.rect(px - 1, 6, 3, 108, PAL.steel[1]);
  b.vline(px - 1, 6, 112, PAL.steel[2]);
  // The arm at 116 px up (y 6 in the buffer) to x +24, with a hanging lamp.
  b.rect(px, 5, 26, 2, PAL.steel[1]);
  b.hline(px, px + 25, 5, PAL.steel[2]);
  b.rect(px + 2, 7, 3, 3, PAL.steel[0]);
  b.rect(px + 8, 7, 7, 3, PAL.steel[1]);
  b.rect(px + 9, 10, 5, 3, PAL.gold[3]);
  b.hline(px + 8, px + 14, 13, PAL.gold[2]);
  // Pennant.
  b.rect(px + 2, 30, 8, 22, PAL.red[1]);
  b.vline(px + 2, 30, 51, PAL.red[2]);
  b.tri(px + 2, 52, px + 9, 52, px + 6, 56, PAL.red[1]);
  b.circle(px + 6, 38, 2, PAL.gold[2]);
  return { buf: b.outline(INK), ox: px, oy: 123 };
}

function banner(): Frame {
  const b = new PixelBuffer(16, 44);
  b.rect(0, 0, 16, 3, PAL.gold[1]);
  b.rect(1, 3, 14, 34, PAL.red[1]);
  b.vline(1, 3, 36, PAL.red[2]);
  b.tri(1, 37, 14, 37, 8, 42, PAL.red[1]);
  b.circle(8, 16, 4, PAL.gold[2], false);
  b.line(4, 24, 12, 10, PAL.gold[3]);
  b.hline(3, 12, 30, PAL.gold[1]);
  return { buf: b.outline(INK, { inside: true }), ox: 0, oy: 0 };
}

const SLOGANS = ['LOUDER!', 'APPLAUD', 'ENCORE!', 'HUSH IS\nBANNED'];

/** Rooftop billboard: a painted board on two legs down to the roof. h = platform top → roof. */
function billboard(w: number, h: number, k: number): Frame {
  const b = new PixelBuffer(w, h);
  const bh = Math.min(h - 6, w >= 100 ? 62 : 34);
  // Legs and a cross brace.
  for (const lx of [10, w - 14]) b.rect(lx, bh, 4, h - bh, PAL.steel[0]);
  if (h - bh > 10) b.line(12, bh + 2, w - 12, h - 2, PAL.steel[1]);
  b.rect(0, 0, w, bh, PAL.steel[1]);
  b.rect(2, 3, w - 4, bh - 5, PAL.snow[1]);
  b.rect(2, bh - 8, w - 4, 6, PAL.red[1]);
  const s = w >= 100 ? 2.6 : 1.1;
  fanfaroniFace(b, Math.round(w * 0.3), Math.round(bh * (w >= 100 ? 0.55 : 0.6)), s, k % 2 === 0 ? 1 : -1);
  const slogan = SLOGANS[k % SLOGANS.length];
  drawText(b, slogan, Math.round(w * 0.72), w >= 100 ? 16 : 7, { font: 'small', color: PAL.red[1], align: 'center' });
  // Lamp row on the top edge (the platform walks over it).
  for (let x = 6; x < w - 4; x += 16) b.set(x, 1, PAL.gold[3]);
  return { buf: b.outline(INK, { inside: true }), ox: 0, oy: 0 };
}

function waterTower(): Frame {
  const b = new PixelBuffer(32, 48);
  b.rect(0, 0, 32, 48, PAL.brown[1]);
  for (let x = 3; x < 32; x += 5) b.vline(x, 2, 45, PAL.brown[0]);
  b.rect(0, 0, 32, 3, PAL.brown[2]);
  for (const y of [10, 26, 40]) {
    b.hline(0, 31, y, PAL.steel[2]);
    b.hline(0, 31, y + 1, PAL.steel[0]);
  }
  b.hline(1, 30, 1, PAL.brown[3]);
  return { buf: b.outline(INK, { inside: true }), ox: 0, oy: 0 };
}

function pillar(): Frame {
  const b = new PixelBuffer(16, 112);
  for (let y = 0; y < 112; y++) {
    for (let x = 0; x < 16; x++) {
      const ty = y % 6;
      const tx = (x + ((y / 6) | 0) % 2 * 4) % 8;
      let c = ty === 5 || tx === 7 ? PAL.stone[1] : ty === 0 ? PAL.snow[1] : PAL.snow[0];
      if (y > 80) c = ty === 5 || tx === 7 ? PAL.ink[1] : PAL.teal[1];
      if (y > 74 && y < 79) c = PAL.red[1];
      if (x === 0 || x === 15) c = PAL.stone[1];
      b.set(x, y, c);
    }
  }
  return { buf: b.outline(INK, { inside: true }), ox: 0, oy: 0 };
}

function bench(): Frame {
  const b = new PixelBuffer(32, 14);
  b.rect(1, 1, 30, 3, PAL.brown[2]);
  b.rect(1, 6, 30, 3, PAL.brown[2]);
  b.hline(1, 30, 1, PAL.brown[3]);
  b.hline(1, 30, 6, PAL.brown[3]);
  for (const x of [4, 26]) b.rect(x, 4, 2, 10, PAL.steel[1]);
  return { buf: b.outline(INK), ox: 16, oy: 14 };
}

/** Exit stairs going up out of the station (the exit rect of m4-c1). */
function stairsUp(): Frame {
  const b = new PixelBuffer(42, 64);
  for (let i = 0; i < 6; i++) {
    const y = 63 - (i + 1) * 9;
    b.rect(2 + i * 6, y, 40 - i * 6, 9, i % 2 ? PAL.stone[2] : PAL.stone[1]);
    b.hline(2 + i * 6, 41, y, PAL.stone[3]);
  }
  b.line(2, 40, 38, 4, PAL.gold[2]);
  b.line(2, 41, 38, 5, PAL.gold[1]);
  return { buf: b.outline(INK, { inside: true }), ox: 2, oy: 64 };
}

function fireEscape(): Frame {
  const b = new PixelBuffer(72, 108);
  // Ladder from the ground to the top landing, rails along the landings (y 0 = 68 in the world).
  for (const x of [8, 18]) b.vline(x, 0, 107, PAL.rust[1]);
  for (let y = 4; y < 108; y += 8) b.hline(8, 18, y, PAL.rust[2]);
  for (const [x0, y0] of [[2, 72], [22, 36], [32, 0]] as const) {
    b.hline(x0, 71, y0 - 12, PAL.rust[2]);
    for (let x = x0; x < 72; x += 8) b.vline(x, y0 - 12, y0, PAL.rust[1]);
  }
  return { buf: b.outline(INK, { inside: true }), ox: 0, oy: 0 };
}

function subwayGlobe(): Frame {
  const b = new PixelBuffer(14, 60);
  b.rect(5, 12, 3, 46, PAL.steel[1]);
  b.rect(3, 56, 7, 3, PAL.steel[2]);
  b.circle(6, 6, 5, PAL.gold[2]);
  b.circle(5, 5, 3, PAL.gold[3]);
  b.hline(2, 10, 6, PAL.red[1]);
  return { buf: b.outline(INK), ox: 6, oy: 60 };
}

function criticsBox(): Frame {
  const b = new PixelBuffer(46, 54);
  b.rect(1, 1, 44, 6, PAL.gold[2]);
  b.hline(1, 44, 1, PAL.gold[3]);
  for (const x of [1, 41]) b.rect(x, 7, 4, 46, PAL.gold[1]);
  // Swagged drape.
  for (let x = 5; x < 41; x++) {
    const d = Math.round(4 + 3 * Math.sin(((x - 5) / 36) * Math.PI * 2));
    b.vline(x, 7, 7 + d, PAL.red[2]);
  }
  b.rect(5, 46, 36, 7, PAL.red[1]);
  b.hline(5, 40, 46, PAL.gold[2]);
  drawText(b, 'CRITICS', 23, 47, { font: 'small', color: PAL.gold[3], align: 'center' });
  return { buf: b.outline(INK), ox: 23, oy: 54 };
}

function curtain(side: 0 | 1): Frame {
  const b = new PixelBuffer(28, 176);
  for (let y = 0; y < 176; y++) {
    const pull = side === 0 ? Math.round(14 * (y / 176) ** 2) : 0;
    for (let x = 0; x < 28; x++) {
      const xx = side === 0 ? x : 27 - x;
      if (xx > 27 - pull) continue;
      const f = (xx % 7) / 7;
      b.set(x, y, f < 0.3 ? PAL.red[2] : f < 0.8 ? PAL.red[1] : PAL.red[0]);
    }
  }
  b.rect(0, 0, 28, 6, PAL.gold[1]);
  b.hline(0, 27, 0, PAL.gold[3]);
  // Tie-back cord.
  b.hline(side === 0 ? 0 : 10, side === 0 ? 18 : 27, 110, PAL.gold[2]);
  return { buf: b.outline(INK, { inside: true }), ox: 0, oy: 0 };
}

function pitRail(): Frame {
  const b = new PixelBuffer(72, 14);
  b.hline(0, 71, 1, PAL.gold[3]);
  b.hline(0, 71, 2, PAL.gold[1]);
  for (let x = 2; x < 72; x += 10) b.vline(x, 3, 13, PAL.gold[1]);
  b.rect(0, 8, 72, 6, PAL.ink[1]);
  // Music stands peeking out of the pit.
  for (const x of [14, 38, 60]) {
    b.rect(x - 3, 5, 7, 4, PAL.snow[1]);
    b.vline(x, 9, 13, PAL.steel[1]);
  }
  return { buf: b.outline(INK, { inside: true }), ox: 36, oy: 14 };
}

function zipPole(): Frame {
  const b = new PixelBuffer(24, 130);
  b.rect(2, 10, 4, 120, PAL.steel[1]);
  b.vline(2, 10, 129, PAL.steel[2]);
  b.rect(0, 6, 10, 4, PAL.steel[2]);
  b.line(6, 8, 23, 18, PAL.ink[1]);
  b.rect(5, 12, 6, 4, PAL.gold[2]);
  return { buf: b.outline(INK), ox: 4, oy: 130 };
}

function hatch(state: number): Frame {
  const b = new PixelBuffer(40, 10);
  const open = state === 0 ? 40 : state === 1 ? 22 : 6;
  const p = plate(open, 8, 'steel', { rivets: open >= 12 ? 'corners' : 'none' });
  b.blit(p, 0, 1);
  if (open >= 20) for (let x = 6; x < open - 4; x += 6) b.vline(x, 3, 6, PAL.steel[0]);
  return { buf: b.outline(INK, { inside: true }), ox: 0, oy: 1 };
}

const one = { ticksPerFrame: 60 };
defineSprite('decor/m4/sign', () => SIGN_FRAMES.map(sign), one);
defineSprite('decor/m4/lamp-post', () => [lampPost()], one);
defineSprite('decor/m4/banner', () => [banner()], one);
for (const [h, k] of [[44, 0], [60, 1], [48, 2]] as const) defineSprite(`decor/m4/billboard-${h}`, () => [billboard(80, h, k)], one);
defineSprite('decor/m4/billboard-100', () => [billboard(100, 100, 3)], one);
defineSprite('decor/m4/water-tower', () => [waterTower()], one);
defineSprite('decor/m4/pillar', () => [pillar()], one);
defineSprite('decor/m4/bench', () => [bench()], one);
defineSprite('decor/m4/stairs-up', () => [stairsUp()], one);
defineSprite('decor/m4/fire-escape', () => [fireEscape()], one);
defineSprite('decor/m4/subway-globe', () => [subwayGlobe()], one);
defineSprite('decor/m4/critics-box', () => [criticsBox()], one);
defineSprite('decor/m4/curtain', () => [curtain(0), curtain(1)], one);
defineSprite('decor/m4/pit-rail', () => [pitRail()], one);
defineSprite('decor/m4/zip-pole', () => [zipPole()], one);
defineSprite('decor/m4/hatch', () => [0, 1, 2].map(hatch), { ticksPerFrame: 6, loop: false });
