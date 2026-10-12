/**
 * Mission m3 (THE HIGH NOTE) decor sprites, procedural from the palette (docs/ART_GUIDE.md).
 * Anchors are the feet (bottom centre) unless noted.
 *
 * GDD decor (§11.3):
 * - `decor/m3/sign-piste-closed` a crimson Legion board `PISTE CLOSED` on two posts
 * - `decor/m3/k-line-blue`, `decor/m3/k-line-red` frame 0 = the marker pole with a pennant
 *    (back decor, feet anchor), frame 1 = the line painted across the snow (front decor; anchor =
 *    the ground surface, the paint runs 12 px down)
 * - `decor/m3/judges-stand` a small wooden stand with three cardboard judges: frame 0 cards
 *    down, 1 cards up (`9.5`)
 * - `decor/m3/snow-mound` a soft snow mound (48×14)
 * - `decor/m3/cable-car-cabin` a 64×40 red cabin with its doors open, hanging from its hanger
 *
 * Mission dressing:
 * - `decor/m3/chalet-wall` front decor exactly over a solid chalet (64×40, top-left anchor)
 * - `decor/m3/chalet-roof` a snowy roof slab over a solid chalet; frame 0 = 16 px (roof y 120),
 *    1 = 26 px (roof y 110); the anchor is the roof top at the platform's left end
 * - `decor/m3/chalet` the large decor chalet (80 wide, feet anchor)
 * - `decor/m3/tent` a crimson Legion tent with an open flap
 * - `decor/m3/lift-pylon` a ski-lift pylon; the anchor is the TIP of its arm at ground level
 *    (the arm is LIFT_ARM px above the feet: a cage rope hangs from there)
 * - `decor/m3/ice` a 120×6 strip of pond ice laid over the snow (top-left anchor; front decor:
 *    it lies under the actors' feet)
 * - `decor/m3/cliff` the base-camp cliff face with the cave mouth (64×176, top-left anchor)
 * - `decor/m3/rope-ladder` a rope ladder (top anchor), frame 0 = 64 px
 * - `decor/m3/pine` a snowy pine (feet anchor), frames 0 small / 1 tall
 * - `decor/m3/sign` route signs, small font: 0 `NORTH FACE ↑`, 1 `CAVES →`, 2 `YODEL VALLEY`
 * - `decor/m3/cargo-chute` the Swan's cargo parachute (anchor = where the lines meet)
 * - `decor/m3/waterfall` an underground waterfall strip (16×160, top anchor, 3 frames)
 * - `decor/m3/hut` front decor over the summit station hut (40×40 solid, top-left anchor)
 * - `decor/m3/snow-pile` front decor over a 24×16 snow pile solid (top-left anchor)
 * - `decor/m3/station` the summit station house under its roof (100×56, top-left anchor)
 * - `decor/m3/rock-face` the rock outcrop at the foot of the base-camp climb
 * - `decor/m3/crystal-wall` a crystal wall strip (24×120, top-left anchor; front decor over the
 *    m3-b2 wall solids): frame 0 the left wall, 1 the right wall
 */
import type { Color } from '../../../../engine/color';
import { drawText, measure } from '../../../../engine/font';
import { PixelBuffer, type Ramp } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { hash2, noise2 } from '../../../art/paint';

export const SIGN = { northFace: 0, caves: 1, valley: 2 } as const;
const SIGN_TEXT = ['NORTH FACE ↑', 'CAVES →', 'YODEL VALLEY'];
/** Height of the lift pylon's arm above its feet (m3-a: 176 − 116 = rope top y 60). */
export const LIFT_ARM = 116;
/** Pond ice strip width (decor is culled by its left edge, keep pieces short). */
export const ICE_PIECE = 120;

const WOOD = PAL.brown;

// ------------------------------------------------------------------------------------ signs

function routeSign(text: string): Frame {
  const w = Math.max(40, (measure(text, 'small') + 9) & ~1);
  const b = new PixelBuffer(w + 2, 32);
  b.rect(w / 2 - 1, 13, 3, 18, WOOD[1]);
  b.vline(w / 2 - 1, 13, 30, WOOD[2]);
  b.rect(1, 1, w, 13, WOOD[2]);
  b.hline(1, w, 1, WOOD[3]);
  b.hline(1, w, 13, WOOD[0]);
  b.hline(2, w - 1, 7, WOOD[1]);
  // Snow cap on the board.
  for (let x = 1; x <= w; x++) if (hash2(x, 1, 31) > 0.25) b.set(x, 0, PAL.snow[3]);
  drawText(b, text, 1 + w / 2, 4, { font: 'small', color: PAL.snow[3], align: 'center' });
  return { buf: b.outline(INK), ox: (w + 2) >> 1, oy: 32 };
}

function pisteClosed(): Frame {
  const text = 'PISTE CLOSED';
  const w = (measure(text, 'small') + 12) & ~1;
  const b = new PixelBuffer(w + 4, 40);
  // Two posts with snow at the foot.
  for (const px of [6, w - 4]) {
    b.rect(px, 18, 3, 22, WOOD[1]);
    b.vline(px, 18, 39, WOOD[2]);
  }
  // Crimson board, gold rim, a bugle-bell emblem at each end.
  b.rect(2, 3, w, 16, PAL.red[2]);
  b.strokeRect(2, 3, w, 16, PAL.gold[1]);
  b.hline(3, w, 4, PAL.red[3]);
  b.hline(3, w, 17, PAL.red[1]);
  drawText(b, text, 2 + w / 2, 7, { font: 'small', color: PAL.snow[3], align: 'center' });
  // Snow lumps on the board top.
  for (let x = 2; x < w + 2; x++) if (hash2(x, 2, 77) > 0.3) b.set(x, 2, PAL.snow[3]);
  b.rect(3, 37, w - 2, 3, PAL.snow[2]);
  return { buf: b.outline(INK), ox: (w + 4) >> 1, oy: 40 };
}

// ------------------------------------------------------------------------------------ K-lines

/** A K-line marker pole with a pennant (frame 0, back decor; anchor = its foot). */
function kPole(paint: Ramp): Frame {
  const b = new PixelBuffer(14, 26);
  b.vline(6, 2, 24, PAL.snow[3]);
  b.vline(7, 2, 24, PAL.steel[2]);
  for (let y = 2; y < 12; y++) {
    const len = 6 - Math.abs(y - 7) * 0.6;
    for (let x = 8; x < 8 + len; x++) b.set(x, y, y < 5 ? paint[3] : paint[2]);
  }
  for (const [x, y] of [[9, 5], [9, 6], [9, 7], [9, 8], [10, 6], [11, 5], [11, 8]] as const) b.set(x, y, PAL.snow[3]);
  return { buf: b.outline(INK), ox: 6, oy: 25 };
}

/**
 * The K-line painted across the snow (frame 1, FRONT decor: it lies on the ground surface, under
 * the actors' feet). Anchor = the ground surface; the paint runs 12 px down and is 6 px wide.
 */
function kPaint(paint: Ramp): Frame {
  const b = new PixelBuffer(6, 12);
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 6; x++) {
      if (hash2(x, y, 5) < 0.1) continue;
      b.set(x, y, x === 0 || x === 5 ? paint[1] : y < 2 ? paint[3] : paint[2]);
    }
  }
  return { buf: b, ox: 3, oy: 0 };
}

// ------------------------------------------------------------------------------------ judges

function judge(b: PixelBuffer, x: number, y: number, k: number, up: boolean): void {
  const suit = [PAL.navy[1], PAL.red[1], PAL.olive[1]][k % 3];
  const skin = [PAL.skinA[2], PAL.skinB[2], PAL.skinC[2]][k % 3];
  // Cardboard cut-out on a stick: body, head, a scarf.
  b.rect(x - 4, y - 14, 9, 12, suit);
  b.vline(x - 4, y - 14, y - 3, PAL.snow[1]);
  b.circle(x, y - 18, 4, skin);
  b.hline(x - 2, x + 2, y - 22, PAL.hairB[1]);
  b.set(x - 1, y - 18, INK);
  b.set(x + 1, y - 18, INK);
  b.rect(x - 4, y - 14, 9, 2, PAL.gold[2]);
  // The card: down at the chest or raised over the head.
  const cy = up ? y - 34 : y - 10;
  const cx = x + (up ? 0 : 3);
  b.rect(cx - 7, cy, 15, 9, PAL.snow[3]);
  b.strokeRect(cx - 7, cy, 15, 9, PAL.stone[1]);
  if (up) {
    drawText(b, '9.5', cx + 1, cy + 1, { font: 'small', color: PAL.red[1], align: 'center' });
    b.vline(cx, cy + 9, y - 22, skin);
  }
}

function judgesStand(up: boolean): Frame {
  const b = new PixelBuffer(56, 60);
  // A little platform with a rail and a striped skirt.
  b.rect(2, 44, 52, 4, WOOD[2]);
  b.hline(2, 53, 44, WOOD[3]);
  for (let x = 2; x < 54; x++) for (let y = 48; y < 58; y++) b.set(x, y, Math.floor(x / 6) % 2 === 0 ? PAL.red[2] : PAL.snow[2]);
  b.vline(4, 48, 59, WOOD[1]);
  b.vline(51, 48, 59, WOOD[1]);
  for (let k = 0; k < 3; k++) judge(b, 12 + k * 16, 44, k, up);
  return { buf: b.outline(INK), ox: 28, oy: 60 };
}

// ------------------------------------------------------------------------------------ snow

function snowMound(): Frame {
  const b = new PixelBuffer(48, 14);
  for (let x = 0; x < 48; x++) {
    const t = (x - 24) / 24;
    const top = Math.round(2 + 11 * t * t + (hash2(x, 0, 9) - 0.5) * 1.5);
    for (let y = Math.max(0, top); y < 14; y++) b.set(x, y, y === top ? PAL.snow[3] : y - top < 3 ? PAL.snow[2] : PAL.snow[1]);
  }
  return { buf: b.outline(PAL.steel[2]), ox: 24, oy: 14 };
}

function snowPile(): Frame {
  const b = new PixelBuffer(24, 16);
  for (let x = 0; x < 24; x++) {
    const t = (x - 12) / 12;
    const top = Math.round(1 + 4 * t * t);
    for (let y = top; y < 16; y++) {
      const shade = x > 16 ? 1 : y - top < 2 ? 3 : 2;
      b.set(x, y, PAL.snow[shade]);
    }
  }
  // A shovel stuck in the pile.
  b.vline(8, 0, 6, WOOD[2]);
  b.rect(7, 6, 3, 3, PAL.steel[2]);
  return { buf: b, ox: 0, oy: 0 };
}

// ------------------------------------------------------------------------------------ chalets

/** Log wall of a solid chalet: exactly the solid's rect (front decor, nothing stands inside it). */
function chaletWall(w: number, h: number, door: boolean): Frame {
  const b = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const seam = y % 5 === 4;
      b.set(x, y, seam ? WOOD[0] : x < 4 ? WOOD[3] : WOOD[2]);
    }
  }
  // Shuttered windows with a warm light.
  for (const wx of [10, w - 20]) {
    b.rect(wx - 3, 8, 3, 12, PAL.red[1]);
    b.rect(wx + 10, 8, 3, 12, PAL.red[1]);
    b.rect(wx, 8, 10, 12, INK);
    b.rect(wx + 1, 9, 8, 10, PAL.gold[2]);
    b.rect(wx + 1, 9, 3, 4, PAL.gold[3]);
    b.vline(wx + 5, 9, 18, INK);
    b.hline(wx + 1, wx + 8, 13, INK);
    // A window box with snow.
    b.rect(wx - 1, 20, 12, 3, WOOD[1]);
    b.hline(wx - 1, wx + 10, 20, PAL.snow[3]);
  }
  if (door) {
    b.rect((w >> 1) - 5, h - 18, 10, 18, WOOD[0]);
    b.rect((w >> 1) - 4, h - 17, 8, 17, WOOD[1]);
    b.set((w >> 1) + 2, h - 9, PAL.gold[2]);
  }
  // Snow drift along the foot.
  for (let x = 0; x < w; x++) {
    const d = 2 + Math.round(hash2(x >> 2, 3, 41) * 2);
    for (let y = h - d; y < h; y++) b.set(x, y, y === h - d ? PAL.snow[3] : PAL.snow[2]);
  }
  b.strokeRect(0, 0, w, h, INK);
  return { buf: b, ox: 0, oy: 0 };
}

/** A thick snow-laden roof slab (the standable part is its flat top). */
function chaletRoof(w: number, rh: number): Frame {
  const eave = 4;
  const W = w + eave * 2;
  const b = new PixelBuffer(W, rh + 1);
  for (let y = 0; y <= rh; y++) {
    const inset = Math.max(0, Math.round((y / rh) * 2));
    for (let x = inset; x < W - inset; x++) {
      const snow = y < 5;
      const c = snow ? (y === 0 ? PAL.snow[3] : PAL.snow[2]) : y >= rh - 2 ? WOOD[0] : (x + y) % 6 === 0 ? WOOD[1] : WOOD[2];
      b.set(x, y, c);
    }
  }
  // A crimson banner hanging from the gable.
  const bx = (W >> 1) - 4;
  if (rh > 18) {
    b.rect(bx, 6, 8, rh - 9, PAL.red[2]);
    b.vline(bx, 6, rh - 4, PAL.red[3]);
    b.rect(bx + 3, 9, 2, 3, PAL.gold[2]);
  }
  // Chimney with a snow cap.
  const out = b.padded(0, 6, 0, 0);
  out.rect(W - 16, 0, 5, 7, PAL.stone[1]);
  out.rect(W - 17, 0, 7, 2, PAL.snow[3]);
  return { buf: out.outline(INK), ox: eave, oy: 6 };
}

/** The large decor chalet (pitched roof, balcony, banner); its back door is a breakable wall. */
function bigChalet(): Frame {
  const W = 96;
  const H = 104;
  const b = new PixelBuffer(W, H);
  const x0 = 8;
  const ww = 80;
  const wallTop = 56;
  for (let y = wallTop; y < H; y++) {
    for (let x = x0; x < x0 + ww; x++) b.set(x, y, (y - wallTop) % 5 === 4 ? WOOD[0] : x < x0 + 4 ? WOOD[3] : WOOD[2]);
  }
  // Windows upstairs, a balcony.
  for (const wx of [x0 + 12, x0 + ww - 22]) {
    b.rect(wx, wallTop + 6, 10, 11, INK);
    b.rect(wx + 1, wallTop + 7, 8, 9, PAL.gold[2]);
    b.vline(wx + 5, wallTop + 7, wallTop + 15, INK);
  }
  for (let x = x0 - 2; x < x0 + ww + 2; x++) {
    b.set(x, wallTop + 20, WOOD[1]);
    if ((x - x0) % 3 === 0) b.vline(x, wallTop + 20, wallTop + 24, WOOD[1]);
  }
  b.hline(x0 - 2, x0 + ww + 1, wallTop + 25, WOOD[0]);
  // Ground floor: a front window right of the door gap (the door is the breakable wall).
  b.rect(x0 + 54, wallTop + 32, 14, 10, INK);
  b.rect(x0 + 55, wallTop + 33, 12, 8, PAL.gold[1]);
  b.rect(x0 + 18, wallTop + 26, 28, 22, WOOD[0]); // the dark door frame behind the door prop
  // Steep pitched roof with deep eaves and snow.
  const roofH = 46;
  for (let j = 0; j <= roofH; j++) {
    const y = wallTop - j;
    const half = ((roofH - j) / roofH) * (W / 2);
    for (let x = Math.floor(W / 2 - half); x <= W / 2 + half; x++) {
      const edge = Math.abs(x - W / 2) > half - 3;
      b.set(x, y, j < 3 ? WOOD[0] : edge || j > 4 ? (x < W / 2 ? PAL.snow[3] : PAL.snow[2]) : WOOD[1]);
    }
  }
  // Banner.
  b.rect(W / 2 - 5, wallTop - 30, 10, 22, PAL.red[2]);
  b.vline(W / 2 - 5, wallTop - 30, wallTop - 9, PAL.red[3]);
  b.rect(W / 2 - 2, wallTop - 26, 4, 4, PAL.gold[2]);
  // Snow drift at the foot.
  for (let x = x0; x < x0 + ww; x++) b.vline(x, H - 3, H - 1, PAL.snow[2]);
  return { buf: b.outline(INK), ox: W >> 1, oy: H };
}

function tent(): Frame {
  const W = 52;
  const H = 34;
  const b = new PixelBuffer(W, H);
  for (let y = 0; y < H; y++) {
    const half = 4 + (y / H) * (W / 2 - 4);
    for (let x = Math.floor(W / 2 - half); x <= W / 2 + half; x++) {
      const lit = x < W / 2;
      b.set(x, y, lit ? PAL.red[2] : PAL.red[1]);
    }
  }
  // Open flap: a dark triangle in the middle, the flap folded back.
  for (let y = 12; y < H; y++) {
    const half = ((y - 12) / (H - 12)) * 9;
    for (let x = Math.floor(W / 2 - half); x <= W / 2 + half; x++) b.set(x, y, PAL.ink[1]);
    b.set(Math.floor(W / 2 - half) - 1, y, PAL.red[3]);
  }
  // Snow on the ridge, guy ropes.
  for (let y = 0; y < 8; y++) b.set(W / 2 - 4 + y, y, PAL.snow[3]);
  b.line(2, H - 1, 0, H - 6, PAL.stone[2]);
  b.line(W - 3, H - 1, W - 1, H - 6, PAL.stone[2]);
  // A gold bell emblem.
  b.rect(10, 18, 4, 3, PAL.gold[2]);
  b.rect(9, 21, 6, 2, PAL.gold[2]);
  return { buf: b.padded(1).outline(INK), ox: (W >> 1) + 1, oy: H + 1 };
}

function liftPylon(): Frame {
  const H = LIFT_ARM + 8;
  const W = 52;
  const b = new PixelBuffer(W, H + 2);
  const cx = 14;
  // Lattice tower.
  for (let y = 10; y < H; y++) {
    const half = 2 + ((y - 10) / (H - 10)) * 5;
    b.set(Math.round(cx - half), y, PAL.steel[2]);
    b.set(Math.round(cx + half), y, PAL.steel[0]);
    const k = (y - 10) % 10;
    b.set(Math.round(cx - half + (k / 10) * half * 2), y, PAL.steel[1]);
  }
  // Arm to the right with a wheel at its tip (the cage rope hangs there).
  b.rect(cx - 4, 6, W - cx + 2, 3, PAL.steel[2]);
  b.hline(cx - 4, W - 3, 6, PAL.steel[3]);
  b.circle(W - 4, 9, 2, PAL.steel[1]);
  // Snow on the arm.
  for (let x = cx - 3; x < W - 4; x++) if (hash2(x, 6, 3) > 0.35) b.set(x, 5, PAL.snow[3]);
  b.rect(cx - 8, H, 17, 2, PAL.snow[2]);
  return { buf: b.outline(INK), ox: W - 4, oy: H + 2 };
}

function iceStrip(): Frame {
  const H = 9;
  const b = new PixelBuffer(ICE_PIECE, H);
  for (let x = 0; x < ICE_PIECE; x++) {
    for (let y = 0; y < H; y++) {
      let c: Color = y === 0 ? PAL.snow[3] : y < 3 ? PAL.sky[3] : y < 6 ? PAL.sky[2] : PAL.sky[1];
      // Diagonal glints and a few bubbles.
      if ((x + y * 2) % 29 < 2 && y > 0) c = PAL.snow[3];
      else if (y > 2 && hash2(x, y, 17) > 0.95) c = PAL.snow[2];
      b.set(x, y, c);
    }
  }
  return { buf: b, ox: 0, oy: 0 };
}

function cliff(): Frame {
  const W = 64;
  const H = 176;
  const b = new PixelBuffer(W, H);
  const rock: Ramp = [PAL.stone[0], PAL.stone[1], PAL.stone[2], PAL.stone[3]];
  for (let y = 0; y < H; y++) {
    const edge = Math.round(5 + Math.sin(y / 13) * 3 + noise2(0.5, y / 18, 1, 5) * 5);
    for (let x = edge; x < W; x++) {
      // Vertical strata with soft noise; cracks every few columns; lit on the left.
      const n = noise2(x / 10, y / 26, 1, 11) * 0.7 + noise2(x / 4, y / 9, 1, 12) * 0.3;
      let k = 1 + Math.floor(n * 2.6);
      if (x - edge < 3) k = 3;
      if ((x * 7 + Math.floor(y / 23) * 5) % 17 === 0 && noise2(x / 3, y / 11, 1, 13) > 0.45) k = 0;
      let c = rock[Math.max(0, Math.min(3, k))];
      // Snow caught on small ledges.
      if (y % 31 === 0 && noise2(x / 6, y, 1, 14) > 0.4) c = PAL.snow[3];
      else if (y % 31 === 1 && noise2(x / 6, y - 1, 1, 14) > 0.4) c = PAL.snow[1];
      b.set(x, y, c);
    }
  }
  // The cave mouth at the bottom right (x 34–64 of the sprite = 2970–3000).
  for (let y = 128; y < H; y++) {
    const half = Math.sqrt(Math.max(0, 1 - ((y - H) / 48) ** 2)) * 17;
    for (let x = Math.floor(52 - half); x <= 52 + half; x++) if (x < W) b.set(x, y, y < 134 ? PAL.navy[0] : PAL.ink[0]);
  }
  // Icicles over the cave.
  for (let x = 38; x < 64; x += 4) b.vline(x, 128, 128 + 2 + (x % 3), PAL.sky[3]);
  return { buf: b, ox: 0, oy: 0 };
}

function ropeLadder(h: number): Frame {
  const b = new PixelBuffer(14, h);
  b.vline(1, 0, h - 1, WOOD[1]);
  b.vline(12, 0, h - 1, WOOD[1]);
  for (let y = 4; y < h; y += 8) b.hline(1, 12, y, WOOD[3]);
  b.rect(0, 0, 14, 2, PAL.steel[2]);
  return { buf: b.padded(1).outline(INK), ox: 8, oy: 1 };
}

function pine(h: number): Frame {
  const W = Math.round(h * 0.62);
  const b = new PixelBuffer(W, h);
  const cx = W / 2;
  const tiers = 4;
  for (let t = 0; t < tiers; t++) {
    const top = t * (h * 0.2);
    const bottom = top + h * 0.34;
    for (let y = Math.floor(top); y < Math.min(h - 4, bottom); y++) {
      const half = ((y - top) / (bottom - top)) * (W * 0.18 + t * (W * 0.09));
      for (let x = Math.floor(cx - half); x <= cx + half; x++) {
        const snowy = y - top < 2 || (y >= bottom - 2 && hash2(x, y, 3) > 0.5);
        b.set(x, y, snowy ? PAL.snow[3] : x < cx - half * 0.3 ? PAL.green[2] : PAL.green[1]);
      }
    }
  }
  b.rect(Math.floor(cx) - 1, h - 6, 3, 6, WOOD[1]);
  return { buf: b.padded(1).outline(INK), ox: Math.floor(cx) + 1, oy: h + 1 };
}

/** The Swan's cargo parachute: a striped olive-and-ivory canopy, lines meeting at the anchor. */
function cargoChute(): Frame {
  const W = 64;
  const b = new PixelBuffer(W, 56);
  for (let y = 0; y < 20; y++) {
    const t = y / 20;
    const half = Math.sqrt(Math.max(0, 1 - (1 - t) ** 2)) * (W / 2 - 1);
    for (let x = Math.floor(W / 2 - half); x <= W / 2 + half; x++) {
      const gore = Math.floor(((x - (W / 2 - half)) / (2 * half + 1)) * 6);
      const c = gore % 2 === 0 ? (y < 6 ? PAL.olive[3] : PAL.olive[2]) : y < 6 ? PAL.snow[3] : PAL.snow[2];
      b.set(x, y, c);
    }
  }
  for (let x = 1; x < W - 1; x += 3) b.set(x, 20, PAL.olive[1]);
  // Lines to the harness.
  for (const lx of [2, 14, W - 15, W - 3]) b.line(lx, 20, W / 2, 55, PAL.stone[2]);
  return { buf: b.padded(1).outline(INK), ox: W / 2 + 1, oy: 56 };
}

function waterfall(f: number): Frame {
  const H = 160;
  const b = new PixelBuffer(16, H);
  for (let y = 0; y < H; y++) {
    for (let x = 1; x < 15; x++) {
      const streak = (x * 7 + Math.floor((y + f * 6) / 5)) % 9;
      const c = streak === 0 ? PAL.snow[3] : streak < 3 ? PAL.sky[3] : x < 4 ? PAL.sky[2] : PAL.sky[1];
      b.set(x, y, c);
    }
  }
  // Foam at the foot.
  for (let x = 0; x < 16; x++) for (let y = H - 4; y < H; y++) if (hash2(x, y + f, 4) > 0.3) b.set(x, y, PAL.snow[3]);
  return { buf: b, ox: 8, oy: 0 };
}

function hut(): Frame {
  const b = new PixelBuffer(40, 40);
  for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) b.set(x, y, y % 6 === 5 ? PAL.stone[1] : x < 3 ? PAL.stone[3] : PAL.stone[2]);
  // Snow on the roof, a lit window, a door.
  b.rect(0, 0, 40, 3, PAL.snow[3]);
  b.rect(0, 3, 40, 1, PAL.snow[1]);
  b.rect(6, 10, 12, 10, INK);
  b.rect(7, 11, 10, 8, PAL.gold[2]);
  b.vline(12, 11, 18, INK);
  b.rect(24, 16, 10, 24, PAL.red[1]);
  b.rect(25, 17, 8, 23, PAL.red[2]);
  b.set(31, 28, PAL.gold[3]);
  drawText(b, 'SKI', 29, 7, { font: 'small', color: PAL.red[2], align: 'center' });
  b.strokeRect(0, 0, 40, 40, INK);
  return { buf: b, ox: 0, oy: 0 };
}

function station(): Frame {
  const W = 100;
  const H = 56;
  const b = new PixelBuffer(W, H);
  // Roof underside (the roof top band is the terrain's metal platform).
  b.rect(0, 0, W, 6, PAL.steel[1]);
  b.hline(0, W - 1, 5, INK);
  // Back wall (concrete), with the open hall in the middle.
  for (let y = 6; y < H; y++) for (let x = 4; x < W - 4; x++) b.set(x, y, (x + y) % 7 === 0 ? PAL.stone[1] : PAL.stone[2]);
  b.rect(30, 18, 40, H - 18, PAL.ink[1]);
  b.rect(32, 20, 36, H - 20, PAL.navy[0]);
  // Pillars.
  b.rect(0, 6, 5, H - 6, PAL.steel[2]);
  b.rect(W - 5, 6, 5, H - 6, PAL.steel[1]);
  // The station sign.
  b.rect(22, 7, 56, 10, PAL.red[2]);
  drawText(b, 'SUMMIT', 50, 8, { font: 'small', color: PAL.snow[3], align: 'center' });
  // The big cable wheel inside.
  b.circle(50, 34, 10, PAL.steel[2], false);
  b.circle(50, 34, 2, PAL.steel[3]);
  b.line(40, 34, 60, 34, PAL.steel[1]);
  b.line(50, 24, 50, 44, PAL.steel[1]);
  return { buf: b.outline(INK), ox: 0, oy: 0 };
}

function cableCabin(): Frame {
  const W = 64;
  const H = 40;
  const hang = 22;
  const b = new PixelBuffer(W + 2, H + hang + 2);
  const oy = hang + 1;
  // Hanger arm and grip.
  b.rect(W / 2 - 1, 1, 3, hang, PAL.steel[1]);
  b.rect(W / 2 - 6, 0, 13, 3, PAL.steel[2]);
  b.hline(W / 2 - 14, W / 2 + 14, oy, PAL.steel[2]);
  // Body.
  b.rect(1, oy + 1, W, H - 1, PAL.red[2]);
  b.hline(1, W, oy + 1, PAL.red[3]);
  b.rect(1, oy + H - 6, W, 6, PAL.red[1]);
  // Windows and the open doors (dark doorway, door leaves folded back).
  for (const wx of [6, 46]) {
    b.rect(wx, oy + 6, 13, 12, PAL.navy[0]);
    b.rect(wx + 1, oy + 7, 5, 4, PAL.sky[2]);
  }
  b.rect(23, oy + 6, 18, H - 6, PAL.ink[1]);
  b.rect(19, oy + 6, 4, H - 7, PAL.red[3]);
  b.rect(41, oy + 6, 4, H - 7, PAL.red[1]);
  // Snow on the roof.
  for (let x = 1; x <= W; x++) if (hash2(x, 0, 21) > 0.3) b.set(x, oy, PAL.snow[3]);
  return { buf: b.outline(INK), ox: (W >> 1) + 1, oy: H + hang + 2 };
}

/** A crystal wall strip (24×120, top-left anchor) drawn in front of a cave wall solid. */
function crystalWall(right: boolean): Frame {
  const W = 24;
  const H = 120;
  const b = new PixelBuffer(W, H);
  const ramps: Ramp[] = [
    [PAL.navy[0], PAL.purple[0], PAL.purple[1], PAL.purple[2]],
    [PAL.navy[0], PAL.navy[1], PAL.sky[0], PAL.sky[1]],
    [PAL.navy[0], PAL.purple[0], PAL.navy[1], PAL.sky[0]],
  ];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Big slanted facets: the facet index from a skewed grid.
      const fx = x + (right ? -y : y) * 0.45;
      const cell = Math.floor(fx / 9) * 7 + Math.floor(y / 17) * 3;
      const r = ramps[((cell % 3) + 3) % 3];
      const u = ((fx % 9) + 9) % 9;
      let k = u < 2 ? 3 : u > 7 ? 0 : 2;
      if (Math.floor(y / 17) !== Math.floor((y + 1) / 17)) k = 0;
      // The face toward the shaft is lit.
      const inner = right ? x < 3 : x > W - 4;
      if (inner && k > 0) k = Math.min(3, k + 1);
      b.set(x, y, r[k]);
    }
  }
  // A few glowing glints.
  for (let i = 0; i < 4; i++) {
    const gx = 4 + Math.floor(hash2(i, right ? 1 : 0, 23) * 16);
    const gy = 6 + Math.floor(hash2(i, 9, 23) * 108);
    b.set(gx, gy, PAL.snow[3]);
    b.set(gx + 1, gy, PAL.sky[3]);
  }
  return { buf: b, ox: 0, oy: 0 };
}

function rockFace(): Frame {
  const W = 56;
  const H = 40;
  const b = new PixelBuffer(W, H);
  for (let x = 0; x < W; x++) {
    const t = (x - W / 2) / (W / 2);
    const top = Math.round(4 + 30 * t * t * (x < W / 2 ? 0.6 : 1) + hash2(x >> 2, 0, 61) * 3);
    for (let y = top; y < H; y++) {
      let c = (Math.floor(y / 6) + Math.floor(x / 9)) % 3 === 0 ? PAL.stone[1] : PAL.stone[2];
      if (x < W / 2 && y - top < 2) c = PAL.stone[3];
      if (y - top < 1 && hash2(x, y, 3) > 0.3) c = PAL.snow[3];
      b.set(x, y, c);
    }
  }
  return { buf: b.outline(INK), ox: W >> 1, oy: H };
}

defineSprite('decor/m3/sign-piste-closed', () => [pisteClosed()]);
const BLUE: Ramp = [PAL.navy[0], PAL.navy[1], PAL.sky[1], PAL.sky[2]];
const RED: Ramp = [PAL.red[0], PAL.red[1], PAL.red[2], PAL.red[3]];
defineSprite('decor/m3/k-line-blue', () => [kPole(BLUE), kPaint(BLUE)], { ticksPerFrame: 60 });
defineSprite('decor/m3/k-line-red', () => [kPole(RED), kPaint(RED)], { ticksPerFrame: 60 });
defineSprite('decor/m3/judges-stand', () => [judgesStand(false), judgesStand(true)], { ticksPerFrame: 60 });
defineSprite('decor/m3/snow-mound', () => [snowMound()]);
defineSprite('decor/m3/cable-car-cabin', () => [cableCabin()]);
defineSprite('decor/m3/chalet-wall', () => [chaletWall(64, 40, true), chaletWall(64, 40, false)], { ticksPerFrame: 60 });
defineSprite('decor/m3/chalet-roof', () => [chaletRoof(64, 16), chaletRoof(64, 26)], { ticksPerFrame: 60 });
defineSprite('decor/m3/chalet', () => [bigChalet()]);
defineSprite('decor/m3/tent', () => [tent()]);
defineSprite('decor/m3/lift-pylon', () => [liftPylon()]);
defineSprite('decor/m3/ice', () => [iceStrip()]);
defineSprite('decor/m3/cliff', () => [cliff()]);
defineSprite('decor/m3/rope-ladder', () => [ropeLadder(64)]);
defineSprite('decor/m3/pine', () => [pine(48), pine(72)], { ticksPerFrame: 60 });
defineSprite('decor/m3/sign', () => SIGN_TEXT.map(routeSign), { ticksPerFrame: 60 });
defineSprite('decor/m3/cargo-chute', () => [cargoChute()]);
defineSprite('decor/m3/waterfall', () => [waterfall(0), waterfall(1), waterfall(2)], { ticksPerFrame: 6 });
defineSprite('decor/m3/hut', () => [hut()]);
defineSprite('decor/m3/snow-pile', () => [snowPile()]);
defineSprite('decor/m3/station', () => [station()]);
defineSprite('decor/m3/rock-face', () => [rockFace()]);
defineSprite('decor/m3/crystal-wall', () => [crystalWall(false), crystalWall(true)], { ticksPerFrame: 60 });
