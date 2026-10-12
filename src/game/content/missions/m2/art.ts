/**
 * Mission m2 (DUNE BUGLE) decor sprites, procedural from the palette (docs/ART_GUIDE.md):
 *
 * - `decor/m2/parasol`   a crimson-and-ivory beach parasol with a cool box (the `nap` gag, m2-a)
 * - `decor/m2/palm`      an oasis palm tree (feet anchor)
 * - `decor/m2/shed`      Mrs. Dollop's pastel ice-cream shed, 64×48: frame 0 doors shut, 1 open
 * - `decor/m2/sign`      wooden signs, small font: 0 `CANYON ↓`, 1 `MESA ↑`, 2 `QUARRY →`,
 *                        3 `RATTLEBONE FLATS`, 4 `DOLLOP'S`
 * - `decor/m2/derrick`   a Legion oil derrick; the anchor is the TIP of its top beam (where the
 *                        roadie's cage rope hangs) at ground level: beam 116 px above the feet
 * - `decor/m2/signpost`  a mesa signpost; anchor = the tip of its arm at ground level, arm 70 px up
 * - `decor/m2/sandbags`  a 24×12 sandbag wall (drawn over the solid block)
 * - `decor/m2/bridge-post` a rope-bridge post with the hand rope stub (feet anchor)
 * - `decor/m2/bridge`    a rope bridge (deck + hand ropes): frame 0 = 140, 1 = 160 px; anchor =
 *                        the left end of the deck top
 * - `decor/m2/scaffold`  steel scaffold legs under the quarry platforms: frame 0 = 120 px, 1 = 100 px
 *                        wide, 56 px tall (top-left anchor = the platform's left end)
 * - `decor/m2/skull`, `decor/m2/cactus` small desert dressing
 * - `decor/m2/net`       the Legion training-net frame poles (drawn behind the net prop)
 */
import type { Color } from '../../../../engine/color';
import { drawText, measure } from '../../../../engine/font';
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';

export const SIGN = { canyon: 0, mesa: 1, quarry: 2, flats: 3, dollop: 4 } as const;
const SIGN_TEXT = ['CANYON ↓', 'MESA ↑', 'QUARRY →', 'RATTLEBONE FLATS', "DOLLOP'S"];

/** Derrick beam height above the feet (the cage rope top is ground − this). */
export const DERRICK_BEAM = 116;
/** Rope-bridge lengths: `decor/m2/bridge` frame i is BRIDGE_WIDTHS[i] px long (m2-c2 gaps). */
export const BRIDGE_WIDTHS = [140, 160] as const;
/** Signpost arm height above the feet. */
export const SIGNPOST_ARM = 70;

function sign(text: string): Frame {
  const w = Math.max(36, (measure(text, 'small') + 9) & ~1);
  const b = new PixelBuffer(w + 2, 30);
  b.rect(w / 2 - 1, 13, 3, 16, PAL.brown[1]);
  b.vline(w / 2 - 1, 13, 28, PAL.brown[2]);
  b.rect(1, 1, w, 13, PAL.brown[2]);
  b.hline(1, w, 1, PAL.brown[3]);
  b.hline(1, w, 13, PAL.brown[0]);
  // Two nail heads and a sun-bleached plank seam.
  b.set(3, 4, PAL.stone[1]);
  b.set(w - 2, 4, PAL.stone[1]);
  b.hline(2, w - 1, 7, PAL.brown[1]);
  drawText(b, text, 1 + w / 2, 4, { font: 'small', color: PAL.snow[3], align: 'center' });
  return { buf: b.outline(INK), ox: (w + 2) >> 1, oy: 30 };
}

function parasol(): Frame {
  const b = new PixelBuffer(40, 40);
  // Pole.
  b.vline(20, 10, 38, PAL.stone[2]);
  b.vline(21, 10, 38, PAL.stone[1]);
  // Canopy: a flat dome with 6 alternating crimson / ivory panels.
  for (let y = 0; y < 10; y++) {
    const half = Math.round(4 + y * 1.6);
    for (let x = -half; x <= half; x++) {
      const panel = Math.floor(((x + half) / (2 * half + 1)) * 6);
      const crimson = panel % 2 === 0;
      const lit = y < 3;
      const c = crimson ? (lit ? PAL.red[3] : PAL.red[2]) : lit ? PAL.snow[3] : PAL.snow[2];
      b.set(20 + x, 1 + y, c);
    }
  }
  // Scalloped hem.
  for (let x = 4; x <= 36; x++) if ((x & 3) !== 0) b.set(x, 11, (Math.floor((x - 4) / 5.5) & 1) === 0 ? PAL.red[1] : PAL.stone[2]);
  // Cool box at the foot.
  b.rect(26, 31, 11, 8, PAL.sky[2]);
  b.hline(26, 36, 31, PAL.snow[3]);
  b.rect(26, 33, 11, 1, PAL.sky[1]);
  b.rect(29, 30, 5, 1, PAL.stone[2]);
  return { buf: b.padded(1).outline(INK), ox: 21, oy: 40 };
}

function palm(): Frame {
  const b = new PixelBuffer(56, 76);
  // Curved trunk with ring segments.
  for (let y = 18; y < 76; y++) {
    const t = (76 - y) / 58;
    const cx = Math.round(26 + Math.sin(t * 1.4) * 8);
    const half = y > 66 ? 3 : 2;
    for (let x = -half; x <= half; x++) b.set(cx + x, y, x <= -half + 1 ? PAL.brown[3] : x >= half ? PAL.brown[0] : (y % 5 === 0 ? PAL.brown[1] : PAL.brown[2]));
  }
  // Fronds: arcs out of the crown.
  const crownX = Math.round(26 + Math.sin(1.4) * 8);
  const crownY = 18;
  const fronds: readonly (readonly [number, number])[] = [[-1, -0.35], [-1, 0.25], [-0.6, 0.7], [1, -0.4], [1, 0.2], [0.6, 0.75], [-0.2, -1]];
  for (const [dx, dy] of fronds) {
    for (let i = 0; i < 22; i++) {
      const x = crownX + Math.round(dx * i);
      const y = crownY + Math.round(dy * i + (i * i) / 36);
      const c = i < 6 ? PAL.green[3] : i < 14 ? PAL.green[2] : PAL.green[1];
      b.set(x, y, c);
      b.set(x, y + 1, PAL.green[1]);
      // Leaflets hang down from each frond.
      if (i > 3 && i % 2 === 0) b.set(x, y + 2, PAL.green[0]);
    }
  }
  // Coconuts.
  b.circle(crownX - 2, crownY + 3, 2, PAL.brown[1]);
  b.circle(crownX + 3, crownY + 3, 2, PAL.brown[0]);
  return { buf: b.padded(1).outline(INK), ox: 28, oy: 78 };
}

/** The ice-cream shed: pastel pink walls, a striped mint awning, big double doors. */
function shed(open: boolean): Frame {
  const W = 64;
  const H = 48;
  const b = new PixelBuffer(W + 2, H + 15);
  const pink = PAL.pink;
  const ox = 1;
  const oy = 15;
  // Walls.
  b.rect(ox, oy + 6, W, H - 6, pink[2]);
  for (let y = oy + 10; y < oy + H; y += 6) b.hline(ox + 1, ox + W - 2, y, pink[1]);
  b.vline(ox, oy + 6, oy + H - 1, PAL.snow[3]);
  b.vline(ox + W - 1, oy + 6, oy + H - 1, pink[0]);
  // Roof (a flat slab) and the striped awning.
  b.rect(ox - 1, oy, W + 2, 4, PAL.stone[2]);
  b.hline(ox - 1, ox + W, oy, PAL.snow[2]);
  for (let x = 0; x < W; x++) {
    const mint = ((x >> 2) & 1) === 0;
    for (let y = 4; y < 9; y++) b.set(ox + x, oy + y, mint ? (y === 4 ? PAL.teal[3] : PAL.teal[2]) : PAL.snow[3]);
    if ((x & 3) === 1) b.set(ox + x, oy + 9, mint ? PAL.teal[1] : PAL.snow[1]);
  }
  // A giant cone on the roof (the shop sign).
  const cx = ox + 12;
  for (let y = 0; y < 8; y++) {
    const half = Math.round(y / 2);
    b.hline(cx - half, cx + half, oy - 1 - y, PAL.gold[2]);
  }
  b.circle(cx, oy - 9, 4, PAL.pink[2]);
  b.circle(cx - 1, oy - 10, 1, PAL.snow[3]);
  b.set(cx + 1, oy - 14, PAL.red[2]);
  // Door frame (centre) — 30×30.
  const dx = ox + 26;
  const dy = oy + H - 30;
  b.rect(dx - 1, dy - 1, 32, 31, PAL.brown[1]);
  if (open) {
    b.rect(dx, dy, 30, 30, PAL.ink[1]);
    b.rect(dx + 2, dy + 22, 26, 8, PAL.ink[0]);
    // The doors swung against the wall.
    b.rect(dx - 6, dy, 5, 30, PAL.teal[2]);
    b.rect(dx + 31, dy, 5, 30, PAL.teal[1]);
  } else {
    b.rect(dx, dy, 15, 30, PAL.teal[2]);
    b.rect(dx + 15, dy, 15, 30, PAL.teal[1]);
    b.vline(dx + 15, dy, dy + 29, PAL.teal[0]);
    b.hline(dx, dx + 29, dy + 14, PAL.teal[0]);
    b.set(dx + 12, dy + 16, PAL.gold[3]);
    b.set(dx + 17, dy + 16, PAL.gold[3]);
  }
  // A small window with a cone sticker.
  b.rect(ox + 6, oy + 18, 12, 10, PAL.sky[2]);
  b.hline(ox + 6, ox + 17, oy + 18, PAL.snow[3]);
  b.rect(ox + 5, oy + 28, 14, 2, PAL.snow[3]);
  drawText(b, "DOLLOP'S", ox + W / 2, oy + 10, { font: 'small', color: PAL.red[1], align: 'center' });
  return { buf: b.padded(1).outline(INK), ox: 2 + W / 2, oy: H + 16 };
}

/** Legion oil derrick: a crimson lattice tower with a beam to the right (anchor = beam tip). */
function derrick(): Frame {
  const H = DERRICK_BEAM + 6;
  const W = 52;
  const b = new PixelBuffer(W, H + 2);
  const red = PAL.red;
  const top = 6;
  const bottom = H;
  // Two legs leaning in, cross braces.
  for (let y = top; y <= bottom; y++) {
    const t = (y - top) / (bottom - top);
    const l = Math.round(10 - t * 8);
    const r = Math.round(22 + t * 8);
    b.set(l, y, red[1]);
    b.set(l + 1, y, red[2]);
    b.set(r, y, red[1]);
    b.set(r - 1, y, red[0]);
    if ((y - top) % 14 === 0) b.hline(l, r, y, red[1]);
    const k = (y - top) % 14;
    b.set(l + 1 + Math.round(((r - l - 2) * k) / 14), y, red[0]);
  }
  // Top beam out to the right with a pulley.
  b.rect(6, top - 4, W - 6, 4, PAL.steel[2]);
  b.hline(6, W - 1, top - 4, PAL.steel[3]);
  b.hline(6, W - 1, top - 1, PAL.steel[0]);
  b.circle(W - 4, top + 1, 3, PAL.steel[1]);
  b.circle(W - 4, top + 1, 1, PAL.steel[3]);
  // Pump box and a gold crest plate.
  b.rect(4, bottom - 14, 26, 14, PAL.stone[1]);
  b.hline(4, 29, bottom - 14, PAL.stone[3]);
  b.circle(17, bottom - 7, 4, PAL.gold[2]);
  b.circle(17, bottom - 7, 2, red[2]);
  // An oil puddle.
  b.hline(0, 34, bottom + 1, PAL.ink[1]);
  return { buf: b.padded(1).outline(INK), ox: W - 3, oy: H + 3 };
}

/** A mesa signpost with an arm to the right (anchor = arm tip at ground level). */
function signpost(): Frame {
  const H = SIGNPOST_ARM + 8;
  const b = new PixelBuffer(40, H);
  b.rect(4, 6, 4, H - 6, PAL.brown[2]);
  b.vline(4, 6, H - 1, PAL.brown[3]);
  b.vline(7, 6, H - 1, PAL.brown[0]);
  b.rect(4, 6, 34, 3, PAL.brown[2]);
  b.hline(4, 37, 6, PAL.brown[3]);
  b.line(8, 18, 18, 9, PAL.brown[1]);
  // A little board on the post.
  b.rect(0, 26, 14, 8, PAL.sand[2]);
  b.hline(0, 13, 26, PAL.sand[3]);
  b.set(3, 29, INK);
  b.set(6, 29, INK);
  b.set(9, 29, INK);
  return { buf: b.padded(1).outline(INK), ox: 38, oy: H + 1 };
}

function sandbags(): Frame {
  const b = new PixelBuffer(26, 14);
  for (let row = 0; row < 3; row++) {
    const y = 1 + (2 - row) * 4;
    const off = row % 2 === 0 ? 0 : 4;
    for (let x = off; x < 24 - (row === 2 ? 4 : 0); x += 8) {
      b.rect(1 + x, y, 8, 4, PAL.sand[2]);
      b.hline(2 + x, 7 + x, y, PAL.sand[3]);
      b.hline(1 + x, 8 + x, y + 3, PAL.sand[0]);
      b.set(1 + x, y + 1, PAL.sand[1]);
    }
  }
  return { buf: b.outline(INK), ox: 13, oy: 13 };
}

function bridgePost(): Frame {
  const b = new PixelBuffer(10, 26);
  b.rect(3, 2, 4, 23, PAL.brown[2]);
  b.vline(3, 2, 24, PAL.brown[3]);
  b.vline(6, 2, 24, PAL.brown[0]);
  b.hline(2, 7, 2, PAL.brown[3]);
  // Rope coil.
  b.hline(2, 7, 9, PAL.sand[3]);
  b.hline(2, 7, 11, PAL.sand[2]);
  return { buf: b.outline(INK), ox: 5, oy: 25 };
}

/**
 * A rope bridge over a mesa gap, `w` px long: plank deck (its top = the walk surface, the anchor
 * y) on two under-ropes, sagging hand ropes from post to post with suspenders. Anchor = the left
 * end of the deck top.
 */
function bridge(w: number): Frame {
  const DECK = 22;
  const b = new PixelBuffer(w, DECK + 8);
  // Hand rope (sags 9 px in the middle) and the suspenders down to the deck.
  const ropeY = (x: number): number => {
    const u = (2 * x) / (w - 1) - 1;
    return Math.round(3 + 9 * (1 - u * u));
  };
  for (let x = 0; x < w; x++) {
    const y = ropeY(x);
    b.set(x, y, PAL.sand[2]);
    b.set(x, y + 1, PAL.brown[1]);
    if (x % 12 === 6) b.vline(x, y + 2, DECK - 1, PAL.sand[1]);
  }
  // Planks: 5 px boards with a 1 px gap, alternating shades, nail heads.
  for (let x = 0; x < w; x += 6) {
    const shade = (x / 6) % 2 === 0 ? PAL.brown[2] : PAL.brown[1];
    b.rect(x, DECK, 5, 4, shade);
    b.hline(x, x + 4, DECK, PAL.brown[3]);
    b.set(x + 2, DECK + 1, PAL.stone[1]);
  }
  // Two under-ropes, sagging a little.
  for (let x = 0; x < w; x++) {
    const u = (2 * x) / (w - 1) - 1;
    const sag = Math.round(2 * (1 - u * u));
    b.set(x, DECK + 4 + sag, PAL.sand[1]);
  }
  return { buf: b.outline(INK), ox: 0, oy: DECK };
}

function scaffold(w: number): Frame {
  const H = 56;
  const b = new PixelBuffer(w, H);
  const c: Color = PAL.steel[1];
  const hi: Color = PAL.steel[3];
  for (let x = 4; x < w; x += 36) {
    b.vline(x, 0, H - 1, hi);
    b.vline(x + 1, 0, H - 1, c);
  }
  b.vline(w - 5, 0, H - 1, hi);
  b.vline(w - 4, 0, H - 1, c);
  for (let x = 4; x + 36 <= w; x += 36) {
    b.line(x + 1, 4, x + 36, 28, PAL.steel[2]);
    b.line(x + 1, 52, x + 36, 28, PAL.steel[2]);
  }
  b.hline(4, w - 4, 28, PAL.steel[2]);
  // Yellow-black hazard wrap on the feet.
  for (let x = 4; x < w; x += 36) {
    b.set(x, H - 3, PAL.gold[2]);
    b.set(x + 1, H - 2, INK);
  }
  return { buf: b, ox: 0, oy: 0 };
}

function skull(): Frame {
  const b = new PixelBuffer(14, 9);
  b.rect(3, 2, 8, 5, PAL.snow[2]);
  b.hline(4, 9, 2, PAL.snow[3]);
  b.rect(4, 7, 6, 1, PAL.stone[2]);
  b.set(5, 4, INK);
  b.set(8, 4, INK);
  b.set(1, 1, PAL.snow[2]);
  b.set(2, 2, PAL.snow[2]);
  b.set(12, 1, PAL.snow[2]);
  b.set(11, 2, PAL.snow[2]);
  return { buf: b.padded(1).outline(INK), ox: 8, oy: 10 };
}

function cactus(): Frame {
  const b = new PixelBuffer(16, 24);
  b.rect(6, 2, 4, 22, PAL.green[2]);
  b.vline(6, 2, 23, PAL.green[3]);
  b.vline(9, 2, 23, PAL.green[0]);
  b.rect(1, 9, 5, 3, PAL.green[2]);
  b.rect(1, 5, 3, 5, PAL.green[2]);
  b.rect(10, 12, 4, 3, PAL.green[1]);
  b.rect(12, 7, 3, 6, PAL.green[1]);
  b.set(7, 1, PAL.pink[2]);
  return { buf: b.padded(1).outline(INK), ox: 9, oy: 25 };
}

/** Two poles of a training net (the net itself is the spring-awning prop). */
function netPoles(): Frame {
  const b = new PixelBuffer(8, 22);
  b.rect(2, 1, 3, 21, PAL.olive[2]);
  b.vline(2, 1, 21, PAL.olive[3]);
  b.set(3, 0, PAL.red[2]);
  return { buf: b.outline(INK), ox: 4, oy: 22 };
}

defineSprite('decor/m2/parasol', () => [parasol()]);
defineSprite('decor/m2/palm', () => [palm()]);
defineSprite('decor/m2/shed', () => [shed(false), shed(true)], { ticksPerFrame: 60 });
defineSprite('decor/m2/sign', () => SIGN_TEXT.map(sign), { ticksPerFrame: 60 });
defineSprite('decor/m2/derrick', () => [derrick()]);
defineSprite('decor/m2/signpost', () => [signpost()]);
defineSprite('decor/m2/sandbags', () => [sandbags()]);
defineSprite('decor/m2/bridge-post', () => [bridgePost()]);
defineSprite('decor/m2/bridge', () => BRIDGE_WIDTHS.map(bridge), { ticksPerFrame: 60 });
defineSprite('decor/m2/scaffold', () => [scaffold(120), scaffold(100)], { ticksPerFrame: 60 });
defineSprite('decor/m2/skull', () => [skull()]);
defineSprite('decor/m2/cactus', () => [cactus()]);
defineSprite('decor/m2/net-pole', () => [netPoles()]);
