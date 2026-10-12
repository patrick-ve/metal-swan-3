/**
 * Mission m1 art (GDD §11.1, §15.6): decor of Puddlewick (town, rooftops, storm drain, river) and
 * the mission-local entities' strips. Procedural pixel art from the palette, light from the top
 * left, 1-px INK outlines.
 *
 * Decor (`decor/m1/…`, feet anchor unless noted):
 * - `banner` (PUDDLEWICK DUCK REGATTA with a crimson MILITARY PARADE patch over DUCK), `poster`
 *   (SALUTE HIS LOUDNESS), `lamp`, `flowers`, `ducks` (a bucket of rubber ducks), `crate` (0 a market
 *   crate 24×20, 1 a stack 24×40), `bandstand` (posts and canopy under the 116-px roof platform),
 *   `balcony` (60 px railing, top-left), `awning-<w>` (top-left at the platform), `house-<w>x<h>`
 *   (a facade; frame 0 cream, 1 brick), `crane`, `quay-steps` (top-left), `bollard`, `window`
 * - b1: `chimney`, `laundry-<w>` (top-left at the line), `vane`, `drainpipe`, `antenna`
 * - b2: `pipe-mouth` (top anchor), `sluice`, `ladder`, `pipe-run` (top-left), `duck-small` (2 frames)
 * - c: `sign-no-diving`, `judges-box` (feet at the island top; the box floor is 56 px up),
 *   `sign-timpani`, `note`, `fishing-post`, `post` (jetty pile), `pontoon-drum`, `float-crate`
 * - entities: `sign` (0 ROOFTOPS ↑, 1 DRAIN ↓), `hatch` (0 closed, 1 sliding, 2 open), `drain-head`
 * - `water-<w>x<h>` (surface line, 4 frames, top-left), `…-back` (opaque body), `…-tint` (front body
 *   drawn at alpha)
 *
 * Props: `prop/drum-mine` (2 frames: the bob), `prop/mk1-head` (0 idle, 1 blink, 2 surfaced, 3 honk).
 */
import type { Color } from '../../../../engine/color';
import { drawText, measure } from '../../../../engine/font';
import { INK, PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite, hasSprite } from '../../../../engine/sprites';

type Ramp = readonly Color[];

function feet(b: PixelBuffer): Frame {
  return { buf: b, ox: b.w >> 1, oy: b.h };
}

/** A wooden plank board with a lit top edge. */
function board(b: PixelBuffer, x: number, y: number, w: number, h: number, ramp: Ramp = PAL.brown): void {
  b.rect(x, y, w, h, ramp[2]);
  b.hline(x, x + w - 1, y, ramp[3]);
  b.hline(x, x + w - 1, y + h - 1, ramp[1]);
  b.vline(x + w - 1, y, y + h - 1, ramp[1]);
}

/** A vertical post 'w' wide from y0 to y1. */
function post(b: PixelBuffer, x: number, y0: number, y1: number, w: number, ramp: Ramp): void {
  b.rect(x, y0, w, y1 - y0 + 1, ramp[1]);
  b.vline(x, y0, y1, ramp[2]);
  if (w > 2) b.vline(x + w - 1, y0, y1, ramp[0]);
}

/** A small rubber duck (8×7) facing right at (x, y) top-left. */
function duck(b: PixelBuffer, x: number, y: number, look = 0): void {
  b.ellipse(x, y + 3, 7, 4, PAL.gold[2]);
  b.hline(x + 1, x + 5, y + 3, PAL.gold[3]);
  b.circle(x + 5, y + 2, 2, PAL.gold[2]);
  b.set(x + 5, y + 1, PAL.gold[3]);
  b.set(x + 6, y + 1, INK);
  b.set(x + 7 + look, y + 2, PAL.orange[1]);
  b.set(x + 8 + look, y + 2, PAL.orange[1]);
}

// ------------------------------------------------------------------------------------ water

/**
 * Registers `decor/m1/water-<w>x<h>` (4-frame surface line, 2 px), `…-back` (opaque water body)
 * and `…-tint` (the body seen through, drawn in front at alpha) once per size; returns the id.
 */
export function waterSprite(w: number, h: number): string {
  const id = `decor/m1/water-${w}x${h}`;
  if (hasSprite(id)) return id;
  const depth = [PAL.sky[1], PAL.sky[0], PAL.navy[1], PAL.navy[0]];
  defineSprite(
    `${id}-back`,
    () => {
      const b = new PixelBuffer(w, h);
      for (let y = 0; y < h; y++) b.rect(0, y, w, 1, depth[Math.min(depth.length - 1, Math.floor(y / 10))]);
      for (let y = 5; y < h; y += 6) for (let x = 0; x < w; x++) if (((x + y * 7) & 31) < 5) b.set(x, y, PAL.sky[2]);
      return b;
    },
    { anchor: 'top-left' },
  );
  defineSprite(
    `${id}-tint`,
    () => {
      const b = new PixelBuffer(w, Math.max(1, h - 2));
      for (let y = 0; y < b.h; y++) b.rect(0, y, w, 1, y < 6 ? PAL.sky[1] : PAL.sky[0]);
      return b;
    },
    { anchor: 'top-left' },
  );
  defineSprite(
    id,
    () =>
      [0, 1, 2, 3].map((f) => {
        const b = new PixelBuffer(w, 3);
        for (let x = 0; x < w; x++) {
          const k = (x + f * 3) & 15;
          b.set(x, 0, k < 5 ? PAL.snow[3] : PAL.sky[3]);
          b.set(x, 1, k >= 8 && k < 11 ? PAL.snow[2] : PAL.sky[2]);
          if (((x * 7 + f * 5) & 31) === 3) b.set(x, 2, PAL.sky[3]);
        }
        return b;
      }),
    { anchor: 'top-left', ticksPerFrame: 8 },
  );
  return id;
}

// ------------------------------------------------------------------------------------ m1-a town

function banner(): Frame {
  const left = 'PUDDLEWICK';
  const patch = 'MILITARY PARADE';
  const right = 'REGATTA';
  const lw = measure(left, 'small');
  const pw = measure(patch, 'small') + 8;
  const rw = measure(right, 'small');
  const cloth = lw + pw + rw + 20;
  const W = cloth + 8;
  const H = 60;
  const b = new PixelBuffer(W, H);
  // Poles.
  post(b, 1, 2, H - 1, 3, PAL.steel);
  post(b, W - 4, 2, H - 1, 3, PAL.steel);
  b.circle(2, 2, 2, PAL.gold[2]);
  b.circle(W - 3, 2, 2, PAL.gold[2]);
  // Cream cloth with a red-and-gold hem, slight sag.
  const cy = 8;
  b.rect(4, cy, cloth, 15, PAL.snow[2]);
  b.hline(4, 3 + cloth, cy, PAL.snow[3]);
  b.hline(4, 3 + cloth, cy + 14, PAL.sand[2]);
  b.hline(4, 3 + cloth, cy + 15, PAL.red[2]);
  b.hline(4, 3 + cloth, cy + 16, PAL.gold[2]);
  for (let x = 6; x < 2 + cloth; x += 8) b.tri(x, cy + 17, x + 6, cy + 17, x + 3, cy + 21, x % 16 < 8 ? PAL.sky[2] : PAL.gold[2]);
  // Words: PUDDLEWICK [patch over DUCK] REGATTA.
  let x = 10;
  drawText(b, left, x, cy + 4, { font: 'small', color: PAL.navy[1] });
  x += lw + 5;
  drawText(b, 'DUCK', x + (pw - measure('DUCK', 'small')) / 2, cy + 4, { font: 'small', color: PAL.navy[1] });
  // The pasted patch: crimson paper, a little crooked, its corners lifting.
  b.rect(x, cy + 1, pw, 13, PAL.red[1]);
  b.hline(x, x + pw - 1, cy + 1, PAL.red[2]);
  b.set(x + pw - 1, cy + 1, PAL.snow[2]);
  b.set(x, cy + 13, PAL.snow[2]);
  b.vline(x + pw - 1, cy + 2, cy + 13, PAL.red[0]);
  drawText(b, patch, x + 4, cy + 4, { font: 'small', color: PAL.gold[3] });
  x += pw + 5;
  drawText(b, right, x, cy + 4, { font: 'small', color: PAL.navy[1] });
  return feet(b.outline(INK));
}

function poster(): Frame {
  const b = new PixelBuffer(58, 52);
  post(b, 8, 30, 51, 3, PAL.brown);
  post(b, 47, 30, 51, 3, PAL.brown);
  // Notice board with the pasted Legion poster.
  board(b, 1, 1, 56, 36, PAL.brown);
  b.rect(4, 3, 50, 31, PAL.red[1]);
  b.rect(5, 4, 48, 29, PAL.red[2]);
  b.hline(5, 52, 4, PAL.red[3]);
  b.rect(5, 31, 48, 2, PAL.gold[2]);
  // A gold megaphone emblem.
  b.tri(9, 9, 9, 15, 15, 12, PAL.gold[2]);
  b.rect(6, 11, 3, 3, PAL.gold[1]);
  drawText(b, 'SALUTE', 34, 6, { font: 'small', color: PAL.gold[3], align: 'center' });
  drawText(b, 'HIS', 34, 14, { font: 'small', color: PAL.snow[3], align: 'center' });
  drawText(b, 'LOUDNESS', 29, 22, { font: 'small', color: PAL.gold[3], align: 'center' });
  // A torn corner showing the old regatta poster under it.
  b.tri(48, 28, 53, 28, 53, 33, PAL.sky[2]);
  return feet(b.outline(INK));
}

function lamp(): Frame {
  const b = new PixelBuffer(14, 64);
  post(b, 6, 12, 60, 3, PAL.green);
  b.rect(4, 59, 7, 4, PAL.green[1]);
  b.hline(4, 10, 59, PAL.green[2]);
  // Lantern.
  b.rect(3, 4, 9, 8, PAL.gold[3]);
  b.rect(4, 5, 7, 6, PAL.snow[3]);
  b.hline(2, 12, 3, PAL.green[1]);
  b.tri(4, 2, 10, 2, 7, 0, PAL.green[2]);
  b.hline(2, 12, 12, PAL.green[1]);
  // A little regatta pennant.
  b.tri(9, 20, 9, 26, 13, 23, PAL.red[2]);
  return feet(b.outline(INK));
}

function flowers(): Frame {
  const b = new PixelBuffer(26, 14);
  board(b, 1, 6, 24, 7, PAL.brown);
  for (let x = 2; x < 24; x += 3) {
    b.vline(x + 1, 3, 6, PAL.green[2]);
    b.set(x + 1, 2, x % 2 ? PAL.red[2] : PAL.gold[2]);
    b.set(x, 3, PAL.green[3]);
  }
  return feet(b.outline(INK));
}

function ducks(): Frame {
  const b = new PixelBuffer(20, 20);
  // Galvanised bucket.
  b.poly([[3, 8], [16, 8], [14, 19], [5, 19]], PAL.steel[2]);
  b.hline(3, 16, 8, PAL.steel[4]);
  b.vline(4, 9, 18, PAL.steel[3]);
  b.hline(4, 15, 13, PAL.steel[1]);
  duck(b, 2, 2);
  duck(b, 9, 1, 0);
  duck(b, 6, 4);
  return feet(b.outline(INK));
}

function crateArt(tall: boolean): Frame {
  const h = tall ? 40 : 20;
  const b = new PixelBuffer(26, h + 2);
  for (let y = 1; y < h; y += 20) {
    board(b, 1, y, 24, 20, PAL.brown);
    b.strokeRect(1, y, 24, 20, PAL.brown[1]);
    b.line(3, y + 2, 22, y + 17, PAL.brown[1]);
    b.hline(2, 23, y + 10, PAL.brown[1]);
    drawText(b, 'FISH', 6, y + 3, { font: 'small', color: PAL.brown[0] });
  }
  return { buf: b.outline(INK), ox: 13, oy: h + 1 };
}

/** Bandstand: canopy, posts and railing; the canopy rim is the roof platform (y 112), base 160. */
function bandstand(): Frame {
  const W = 120;
  const H = 82;
  const b = new PixelBuffer(W, H);
  const rim = H - 49; // y 112 when the feet (row H − 1) are at 160
  // Posts.
  for (const x of [8, 40, 76, 108]) post(b, x, rim + 4, H - 6, 3, PAL.snow);
  // Railing.
  b.hline(4, W - 5, H - 14, PAL.snow[2]);
  for (let x = 6; x < W - 5; x += 6) b.vline(x, H - 13, H - 7, PAL.snow[1]);
  // Canopy: crimson and cream stripes rising to a gold finial.
  for (let y = 8; y < rim; y++) {
    const t = (y - 8) / (rim - 8);
    const half = Math.round(10 + t * 50);
    for (let x = 60 - half; x <= 60 + half; x++) {
      const stripe = Math.floor((x - 60) / 8 + 100) % 2 === 0;
      b.set(x, y, stripe ? PAL.red[2] : PAL.snow[2]);
    }
  }
  b.circle(60, 5, 3, PAL.gold[2]);
  b.set(59, 4, PAL.gold[3]);
  // Rim (the standable roof edge) and scalloped valance.
  b.rect(1, rim, W - 2, 3, PAL.gold[2]);
  b.hline(1, W - 2, rim, PAL.gold[3]);
  for (let x = 2; x < W - 2; x += 6) b.ellipse(x, rim + 3, 6, 4, PAL.red[1]);
  return { buf: b.outline(INK), ox: W >> 1, oy: H - 1 };
}

function balcony(): Frame {
  const b = new PixelBuffer(64, 20);
  b.rect(1, 1, 62, 3, PAL.stone[2]);
  b.hline(1, 62, 1, PAL.stone[3]);
  for (let x = 3; x < 62; x += 5) b.vline(x, 4, 14, PAL.ink[1]);
  b.hline(2, 61, 14, PAL.ink[1]);
  b.tri(4, 4, 12, 4, 4, 14, PAL.stone[1]);
  b.tri(60, 4, 52, 4, 60, 14, PAL.stone[1]);
  return { buf: b.outline(INK), ox: 1, oy: 1 };
}

/** Striped shop awning: top-left at the platform's left end and top. */
function awning(w: number): Frame {
  const b = new PixelBuffer(w + 2, 16);
  for (let x = 1; x <= w; x++) {
    const c = Math.floor((x - 1) / 6) % 2 === 0 ? PAL.red[2] : PAL.snow[2];
    b.vline(x, 1, 7, c);
    if ((x - 1) % 6 < 5) b.set(x, 8, c);
  }
  b.hline(1, w, 1, PAL.snow[3]);
  b.hline(1, w, 2, PAL.red[3]);
  // Iron brackets.
  b.line(3, 9, 8, 14, PAL.ink[1]);
  b.line(w - 2, 9, w - 7, 14, PAL.ink[1]);
  return { buf: b.outline(INK), ox: 1, oy: 1 };
}

/** A house facade w×h (feet anchor). variant 0 cream render, 1 red brick. */
function house(w: number, h: number, variant: number): Frame {
  const b = new PixelBuffer(w, h);
  const wall = variant === 0 ? [PAL.sand[0], PAL.sand[1], PAL.sand[1], PAL.sand[2]] : [PAL.brown[0], PAL.rust[1], PAL.rust[1], PAL.rust[2]];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let c = wall[2];
      if (variant === 1 && (y % 5 === 4 || (x + ((y / 5) | 0) * 4) % 9 === 0)) c = wall[1];
      b.set(x, y, c);
    }
  }
  b.vline(0, 0, h - 1, wall[3]);
  b.vline(w - 1, 0, h - 1, wall[1]);
  // Cornice and a stone plinth.
  b.rect(0, 0, w, 3, PAL.stone[2]);
  b.hline(0, w - 1, 0, PAL.stone[3]);
  b.rect(0, h - 6, w, 6, PAL.stone[1]);
  b.hline(0, w - 1, h - 6, PAL.stone[2]);
  // Windows (navy panes, cream frames, shutters) in a grid, a door at the bottom.
  for (let y = 10; y < h - 30; y += 26) {
    for (let x = 10; x < w - 16; x += 30) {
      b.rect(x - 1, y - 1, 12, 15, PAL.stone[2]);
      b.rect(x, y, 10, 13, PAL.navy[0]);
      b.rect(x + 1, y + 1, 3, 4, PAL.navy[1]);
      b.vline(x + 5, y, y + 12, PAL.stone[1]);
      b.hline(x, x + 9, y + 6, PAL.stone[1]);
      b.rect(x - 4, y - 1, 3, 15, PAL.green[1]);
      b.rect(x + 12, y - 1, 3, 15, PAL.green[1]);
    }
  }
  const dx = (w >> 1) - 7;
  b.rect(dx - 1, h - 30, 16, 24, PAL.stone[3]);
  b.rect(dx, h - 29, 14, 23, PAL.green[1]);
  b.vline(dx + 7, h - 29, h - 7, PAL.green[0]);
  b.set(dx + 10, h - 18, PAL.gold[3]);
  return feet(b.outline(INK));
}

function crane(): Frame {
  const b = new PixelBuffer(64, 124);
  // Lattice mast at the left, the arm reaching right; the hook end at x 52, y 6.
  post(b, 6, 4, 122, 4, PAL.gold);
  for (let y = 8; y < 120; y += 8) b.line(6, y, 9, y + 8, PAL.gold[1]);
  b.rect(2, 2, 58, 4, PAL.gold[2]);
  b.hline(2, 59, 2, PAL.gold[3]);
  for (let x = 12; x < 58; x += 6) b.line(x, 6, x + 3, 2, PAL.gold[1]);
  b.line(9, 24, 40, 6, PAL.steel[2]);
  b.rect(54, 3, 4, 5, PAL.steel[1]);
  b.rect(1, 112, 14, 10, PAL.steel[1]);
  b.hline(1, 14, 112, PAL.steel[3]);
  return { buf: b.outline(INK), ox: 8, oy: 122 };
}

/** Stone quay steps: top-left at (2440, 100); the platforms sit on the two tops. */
function quaySteps(): Frame {
  const b = new PixelBuffer(104, 78);
  // Upper step block 2460–2540 (x 20–100) from y 0; lower block 2440–2520 from y 40.
  const stone = (x: number, y: number, w: number, h: number): void => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) b.set(xx, yy, (yy - y) % 8 === 7 || (xx + ((yy - y) >> 3) * 6) % 16 === 0 ? PAL.stone[1] : PAL.stone[2]);
    b.hline(x, x + w - 1, y, PAL.stone[3]);
  };
  stone(21, 1, 80, 76);
  stone(1, 41, 80, 36);
  return { buf: b.outline(INK), ox: 1, oy: 1 };
}

function bollard(): Frame {
  const b = new PixelBuffer(12, 14);
  b.rect(2, 4, 8, 9, PAL.ink[1]);
  b.ellipse(1, 1, 10, 5, PAL.steel[1]);
  b.vline(3, 5, 12, PAL.steel[1]);
  return feet(b.outline(INK));
}

/** A window opening (for `entry: 'window'` soldiers); feet = the sill. */
function windowArt(): Frame {
  const b = new PixelBuffer(24, 34);
  b.rect(1, 1, 22, 32, PAL.snow[2]);
  b.rect(3, 3, 18, 28, PAL.ink[1]);
  b.rect(3, 3, 3, 28, PAL.navy[0]);
  b.rect(1, 30, 22, 3, PAL.stone[2]);
  b.hline(1, 22, 30, PAL.stone[3]);
  return feet(b.outline(INK));
}

// ------------------------------------------------------------------------------------ m1-b1 roofs

function chimney(): Frame {
  const b = new PixelBuffer(18, 26);
  for (let y = 4; y < 26; y++) for (let x = 1; x < 17; x++) b.set(x, y, y % 4 === 3 || (x + ((y >> 2) % 2) * 3) % 6 === 0 ? PAL.red[0] : PAL.red[1]);
  b.rect(0, 1, 18, 4, PAL.stone[2]);
  b.hline(0, 17, 1, PAL.stone[3]);
  b.rect(3, 0, 12, 2, PAL.ink[1]);
  return feet(b.outline(INK));
}

function laundry(w: number): Frame {
  const b = new PixelBuffer(w + 2, 26);
  const cols = [PAL.sky[2], PAL.snow[2], PAL.red[2], PAL.gold[2], PAL.green[2], PAL.pink[2]];
  let i = 0;
  for (let x = 4; x < w - 10; x += 14 + (i % 3) * 3, i++) {
    const c = cols[i % cols.length];
    const sag = Math.round(Math.sin(((x + 6) / w) * Math.PI) * 3);
    if (i % 3 === 0) {
      // A shirt.
      b.rect(x, 3 + sag, 10, 12, c);
      b.rect(x - 2, 3 + sag, 14, 4, c);
      b.vline(x + 5, 4 + sag, 14 + sag, PAL.ink[1]);
    } else if (i % 3 === 1) {
      // Long johns.
      b.rect(x, 3 + sag, 8, 6, c);
      b.rect(x, 9 + sag, 3, 10, c);
      b.rect(x + 5, 9 + sag, 3, 10, c);
    } else {
      // A tea towel.
      b.rect(x, 3 + sag, 9, 9, c);
      b.hline(x, x + 8, 6 + sag, PAL.snow[3]);
    }
    b.set(x + 1, 2 + sag, PAL.brown[2]);
    b.set(x + 7, 2 + sag, PAL.brown[2]);
  }
  return { buf: b.outline(INK), ox: 1, oy: 0 };
}

function vane(): Frame {
  const b = new PixelBuffer(28, 40);
  post(b, 13, 8, 39, 2, PAL.steel);
  b.hline(4, 24, 18, PAL.steel[2]);
  drawText(b, 'N', 12, 9, { font: 'small', color: PAL.gold[2] });
  // A brass duck on top (the regatta's weather duck).
  b.ellipse(7, 2, 14, 6, PAL.gold[2]);
  b.circle(19, 2, 2, PAL.gold[2]);
  b.set(22, 2, PAL.orange[1]);
  b.set(19, 1, INK);
  return feet(b.outline(INK));
}

function drainpipe(): Frame {
  const b = new PixelBuffer(12, 80);
  b.rect(3, 4, 6, 76, PAL.steel[1]);
  b.vline(4, 4, 79, PAL.steel[3]);
  b.rect(1, 1, 10, 4, PAL.steel[2]);
  for (let y = 16; y < 80; y += 20) b.rect(2, y, 8, 2, PAL.steel[0]);
  return feet(b.outline(INK));
}

function antenna(): Frame {
  const b = new PixelBuffer(20, 30);
  b.vline(10, 2, 29, PAL.steel[2]);
  for (let i = 0; i < 4; i++) b.hline(3 + i, 17 - i, 4 + i * 5, PAL.steel[3]);
  return feet(b.outline(INK));
}

// ------------------------------------------------------------------------------------ m1-b2 drain

function pipeMouth(): Frame {
  const b = new PixelBuffer(20, 18);
  b.rect(5, 1, 10, 10, PAL.steel[1]);
  b.vline(6, 1, 10, PAL.steel[3]);
  b.rect(2, 10, 16, 6, PAL.steel[2]);
  b.rect(5, 12, 10, 4, PAL.ink[0]);
  b.hline(2, 17, 10, PAL.steel[3]);
  b.set(9, 16, PAL.teal[2]);
  return { buf: b.outline(INK), ox: 10, oy: 1 };
}

function sluice(): Frame {
  const b = new PixelBuffer(48, 64);
  post(b, 2, 1, 62, 5, PAL.steel);
  post(b, 41, 1, 62, 5, PAL.steel);
  b.rect(7, 18, 34, 44, PAL.rust[2]);
  for (let y = 22; y < 62; y += 8) b.hline(8, 40, y, PAL.rust[1]);
  b.rect(20, 4, 8, 14, PAL.steel[2]);
  b.circle(24, 8, 6, PAL.red[2], false);
  drawText(b, 'SLUICE', 7, 26, { font: 'small', color: PAL.gold[3] });
  return feet(b.outline(INK));
}

function ladder(): Frame {
  const b = new PixelBuffer(18, 86);
  b.vline(2, 1, 85, PAL.steel[2]);
  b.vline(15, 1, 85, PAL.steel[2]);
  for (let y = 6; y < 86; y += 8) b.hline(3, 14, y, PAL.steel[3]);
  return feet(b.outline(INK));
}

function pipeRun(w: number): Frame {
  const b = new PixelBuffer(w, 10);
  b.rect(0, 1, w, 8, PAL.steel[1]);
  b.hline(0, w - 1, 2, PAL.steel[3]);
  b.hline(0, w - 1, 8, PAL.steel[0]);
  for (let x = 6; x < w; x += 40) b.rect(x, 0, 3, 10, PAL.steel[2]);
  return { buf: b.outline(INK), ox: 0, oy: 0 };
}

// ------------------------------------------------------------------------------------ m1-c river

function signPost(lines: readonly string[], fg: Color, bg: Ramp, postH: number): Frame {
  const tw = Math.max(...lines.map((l) => measure(l, 'small')));
  const W = tw + 10;
  const bh = lines.length * 9 + 5;
  const b = new PixelBuffer(W, bh + postH);
  post(b, (W >> 1) - 1, bh - 1, bh + postH - 1, 3, PAL.brown);
  b.rect(1, 1, W - 2, bh - 2, bg[2]);
  b.hline(1, W - 2, 1, bg[3]);
  b.hline(1, W - 2, bh - 2, bg[1]);
  lines.forEach((l, i) => drawText(b, l, W >> 1, 4 + i * 9, { font: 'small', color: fg, align: 'center' }));
  return feet(b.outline(INK));
}

function judgesBox(): Frame {
  // Feet = the island top (y 172); the box floor (platform y 116) is 56 px up, 56 wide (1240–1296).
  const W = 64;
  const H = 108;
  const b = new PixelBuffer(W, H);
  const floor = H - 1 - 56;
  // Stilts.
  for (const x of [5, 30, 55]) post(b, x, floor + 2, H - 2, 3, PAL.brown);
  b.line(7, floor + 6, 31, H - 10, PAL.brown[1]);
  b.line(55, floor + 6, 32, H - 10, PAL.brown[1]);
  // Box walls (behind the actors) and the JUDGES banner.
  b.rect(4, floor - 30, 56, 30, PAL.sand[2]);
  b.hline(4, 59, floor - 30, PAL.sand[3]);
  b.rect(4, floor - 40, 56, 10, PAL.red[1]);
  b.hline(4, 59, floor - 40, PAL.red[2]);
  b.hline(4, 59, floor - 31, PAL.gold[2]);
  drawText(b, 'JUDGES', 32, floor - 38, { font: 'small', color: PAL.gold[3], align: 'center' });
  // Roof posts.
  post(b, 4, floor - 44, floor, 2, PAL.brown);
  post(b, 58, floor - 44, floor, 2, PAL.brown);
  b.rect(1, floor - 47, 62, 4, PAL.red[2]);
  b.hline(1, 62, floor - 47, PAL.gold[2]);
  // Three empty chairs.
  for (const x of [14, 28, 42]) {
    b.rect(x, floor - 14, 2, 14, PAL.brown[1]);
    b.rect(x, floor - 7, 9, 2, PAL.brown[2]);
    b.vline(x + 8, floor - 5, floor - 1, PAL.brown[1]);
  }
  // Floor planks (the platform edge).
  b.rect(2, floor, 60, 3, PAL.brown[2]);
  b.hline(2, 61, floor, PAL.brown[3]);
  return { buf: b.outline(INK), ox: 4, oy: H - 1 };
}

function note(): Frame {
  const b = new PixelBuffer(16, 26);
  post(b, 7, 10, 25, 2, PAL.brown);
  b.rect(2, 1, 12, 11, PAL.snow[3]);
  b.tri(11, 1, 13, 1, 13, 3, PAL.snow[1]);
  for (let y = 3; y < 11; y += 2) b.hline(4, 11 - (y % 4), y, PAL.navy[1]);
  b.set(7, 1, PAL.red[2]);
  return feet(b.outline(INK));
}

function fishingPost(): Frame {
  // Feet at the island top; the arm end (rope top) is 72 px up and 16 px right of the post.
  const b = new PixelBuffer(30, 80);
  post(b, 4, 4, 79, 4, PAL.brown);
  b.rect(4, 4, 22, 3, PAL.brown[2]);
  b.hline(4, 25, 4, PAL.brown[3]);
  b.line(7, 18, 18, 7, PAL.brown[1]);
  b.circle(5, 50, 3, PAL.red[2], false);
  return { buf: b.outline(INK), ox: 6, oy: 79 };
}

function pile(): Frame {
  const b = new PixelBuffer(6, 22);
  b.rect(1, 1, 4, 20, PAL.brown[1]);
  b.vline(1, 1, 20, PAL.brown[2]);
  b.hline(1, 4, 14, PAL.green[1]);
  return { buf: b.outline(INK), ox: 3, oy: 1 };
}

function pontoonDrum(): Frame {
  const b = new PixelBuffer(28, 12);
  b.ellipse(1, 1, 26, 10, PAL.red[1]);
  b.hline(4, 23, 2, PAL.red[2]);
  b.vline(9, 2, 9, PAL.steel[2]);
  b.vline(18, 2, 9, PAL.steel[2]);
  return { buf: b.outline(INK), ox: 14, oy: 1 };
}

function floatCrate(): Frame {
  const b = new PixelBuffer(34, 20);
  board(b, 1, 1, 32, 17, PAL.brown);
  b.strokeRect(1, 1, 32, 17, PAL.brown[1]);
  b.line(3, 3, 30, 15, PAL.brown[1]);
  drawText(b, 'TEA', 10, 6, { font: 'small', color: PAL.brown[0] });
  return { buf: b.outline(INK), ox: 17, oy: 1 };
}

// ------------------------------------------------------------------------------------ entities

function routeSign(text: string): Frame {
  const W = measure(text, 'small') + 12;
  const b = new PixelBuffer(W, 32);
  post(b, (W >> 1) - 1, 15, 31, 3, PAL.steel);
  b.rect(1, 1, W - 2, 15, PAL.gold[2]);
  b.rect(2, 2, W - 4, 13, PAL.navy[1]);
  drawText(b, text, W >> 1, 5, { font: 'small', color: PAL.snow[3], align: 'center' });
  return feet(b.outline(INK));
}

function hatch(f: number): Frame {
  // Top-left anchor: the lid lies over the drain hole (32×8).
  const b = new PixelBuffer(36, 10);
  const off = f === 0 ? 0 : f === 1 ? 12 : 28;
  if (f > 0) b.rect(2, 2, 32, 6, PAL.ink[0]);
  b.rect(2 + off, 1, 32, 6, PAL.steel[3]);
  b.hline(2 + off, Math.min(35, 33 + off), 1, PAL.snow[1]);
  b.hline(2 + off, Math.min(35, 33 + off), 6, PAL.steel[1]);
  for (let x = 6 + off; x < 32 + off && x < 35; x += 5) b.vline(x, 2, 5, PAL.steel[2]);
  for (const x of [4 + off, 31 + off]) if (x < 35) b.set(x, 3, PAL.gold[2]);
  return { buf: b.outline(INK), ox: 2, oy: 1 };
}

function drainHead(): Frame {
  // A Legion private peeking out: crimson shako with a gold plume and badge, a worried face.
  const b = new PixelBuffer(16, 24);
  b.rect(4, 6, 8, 8, PAL.red[2]);
  b.hline(4, 11, 6, PAL.red[3]);
  b.rect(3, 13, 10, 2, PAL.ink[1]);
  b.rect(6, 1, 3, 5, PAL.gold[2]);
  b.set(8, 9, PAL.gold[3]);
  b.rect(4, 15, 8, 7, PAL.skinA[2]);
  b.set(6, 17, INK);
  b.set(10, 17, INK);
  b.hline(7, 9, 20, PAL.skinA[0]);
  return feet(b.outline(INK));
}

function drumMine(f: number): Frame {
  // The anchor (10, 16) is the waterline under the mine's centre.
  const b = new PixelBuffer(24, 22);
  const dy = f === 0 ? 0 : 1;
  // Copper bowl, dome up.
  b.ellipse(2, 7 + dy, 20, 12, PAL.orange[1]);
  b.rect(2, 13 + dy, 20, 3, PAL.orange[1]);
  b.ellipse(5, 8 + dy, 8, 4, PAL.orange[2]);
  b.hline(4, 19, 15 + dy, PAL.rust[1]);
  // Crimson rim with gold studs.
  b.rect(1, 15 + dy, 22, 3, PAL.red[2]);
  b.hline(1, 22, 15 + dy, PAL.red[3]);
  for (let x = 3; x < 22; x += 5) b.set(x, 16 + dy, PAL.gold[3]);
  // Brass spike.
  b.rect(11, 3 + dy, 2, 5, PAL.gold[2]);
  b.set(11, 2 + dy, PAL.gold[3]);
  b.set(12, 1 + dy, PAL.gold[3]);
  return { buf: b.outline(INK), ox: 12, oy: 17 };
}

function mk1Head(f: number): Frame {
  // Rusty swan head on a neck out of the water: the anchor (16, 30) is the waterline.
  const b = new PixelBuffer(34, 34);
  const rise = f === 2 || f === 3 ? 4 : 0;
  const y0 = 4 - rise + 4;
  // Neck.
  b.rect(12, y0 + 10, 7, 20 + rise, PAL.rust[2]);
  b.vline(13, y0 + 10, 29, PAL.rust[3]);
  for (let y = y0 + 13; y < 30; y += 4) b.hline(12, 18, y, PAL.rust[1]);
  // Head dome with rust patches and river weed.
  b.ellipse(8, y0, 16, 13, PAL.stone[2]);
  b.ellipse(10, y0 + 1, 7, 5, PAL.stone[3]);
  b.set(19, y0 + 7, PAL.rust[2]);
  b.set(18, y0 + 8, PAL.rust[2]);
  b.set(12, y0 + 9, PAL.rust[1]);
  for (const [x, l] of [[9, 4], [12, 6], [15, 3]] as const) b.vline(x, y0 - 1, y0 - 1 + l, PAL.green[2]);
  b.hline(9, 16, y0, PAL.green[1]);
  // Eye (a dim lamp) and the beak.
  if (f === 1) b.hline(18, 20, y0 + 5, PAL.ink[1]);
  else {
    b.circle(19, y0 + 5, 1, PAL.gold[1]);
    b.set(19, y0 + 5, PAL.gold[3]);
  }
  if (f === 3) {
    b.tri(23, y0 + 4, 31, y0 + 2, 23, y0 + 6, PAL.orange[1]);
    b.tri(23, y0 + 8, 31, y0 + 11, 23, y0 + 9, PAL.orange[0]);
  } else {
    b.tri(23, y0 + 5, 31, y0 + 7, 23, y0 + 9, PAL.orange[1]);
    b.hline(23, 29, y0 + 7, PAL.orange[0]);
  }
  // Lifebuoy round the neck: red and white quarters, MK1 stencil.
  const by = y0 + 18;
  b.ellipse(1, by, 32, 10, PAL.snow[2]);
  b.hline(4, 29, by + 1, PAL.snow[3]);
  b.rect(1, by + 2, 5, 6, PAL.red[2]);
  b.rect(28, by + 2, 5, 6, PAL.red[2]);
  drawText(b, 'MK1', 17, by + 2, { font: 'small', color: PAL.ink[1], align: 'center' });
  return { buf: b.outline(INK), ox: 16, oy: 30 };
}

// ------------------------------------------------------------------------------------ registration

const D = 'decor/m1/';
defineSprite(`${D}banner`, banner);
defineSprite(`${D}poster`, poster);
defineSprite(`${D}lamp`, lamp);
defineSprite(`${D}flowers`, flowers);
defineSprite(`${D}ducks`, ducks);
defineSprite(`${D}crate`, () => [crateArt(false), crateArt(true)]);
defineSprite(`${D}bandstand`, bandstand);
defineSprite(`${D}balcony`, balcony);
for (const w of [56, 60, 80]) defineSprite(`${D}awning-${w}`, () => awning(w));
defineSprite(`${D}crane`, crane);
defineSprite(`${D}quay-steps`, quaySteps);
defineSprite(`${D}bollard`, bollard);
defineSprite(`${D}window`, windowArt);
defineSprite(`${D}chimney`, chimney);
for (const w of [120]) defineSprite(`${D}laundry-${w}`, () => laundry(w));
defineSprite(`${D}vane`, vane);
defineSprite(`${D}drainpipe`, drainpipe);
defineSprite(`${D}antenna`, antenna);
defineSprite(`${D}pipe-mouth`, pipeMouth);
defineSprite(`${D}sluice`, sluice);
defineSprite(`${D}ladder`, ladder);
defineSprite(`${D}pipe-run`, () => pipeRun(256));
defineSprite(`${D}duck-small`, () => [0, 1].map((f) => {
  const b = new PixelBuffer(12, 10);
  duck(b, 1, 1 + f);
  return { buf: b.outline(INK), ox: 6, oy: 9 };
}), { ticksPerFrame: 10 });
defineSprite(`${D}sign-no-diving`, () => signPost(['NO', 'DIVING'], PAL.red[1], PAL.snow, 22));
defineSprite(`${D}sign-timpani`, () => signPost(['DANGER:', 'TIMPANI'], PAL.gold[3], PAL.red, 18));
defineSprite(`${D}judges-box`, judgesBox);
defineSprite(`${D}note`, note);
defineSprite(`${D}fishing-post`, fishingPost);
defineSprite(`${D}post`, pile);
defineSprite(`${D}pontoon-drum`, pontoonDrum);
defineSprite(`${D}float-crate`, floatCrate);
defineSprite(`${D}sign`, () => [routeSign('ROOFTOPS ↑'), routeSign('DRAIN ↓')]);
defineSprite(`${D}hatch`, () => [0, 1, 2].map(hatch));
defineSprite(`${D}drain-head`, drainHead);
defineSprite('prop/drum-mine', () => [0, 1].map(drumMine), { ticksPerFrame: 20 });
defineSprite('prop/mk1-head', () => [0, 1, 2, 3].map(mk1Head));

/** House facades used by the m1 sections: `decor/m1/house-<w>x<h>` frames 0 cream, 1 brick. */
export function houseSprite(w: number, h: number): string {
  const id = `${D}house-${w}x${h}`;
  if (!hasSprite(id)) defineSprite(id, () => [house(w, h, 0), house(w, h, 1)]);
  return id;
}
