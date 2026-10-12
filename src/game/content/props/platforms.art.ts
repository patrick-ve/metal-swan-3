/**
 * Art of the platform props: `prop/spring-awning/<variant>-<w>` (sized on demand),
 * `prop/duck-float/…`, `prop/lily-pad/idle`, `prop/cable-car/car`, `prop/bellows-platform/body`.
 * Every platform frame is anchored on its standing surface (the duck: on the water line).
 */
import type { Color } from '../../../engine/color';
import { ascii } from '../../../engine/ascii';
import { PixelBuffer } from '../../../engine/pixel';
import { INK, PAL } from '../../../engine/palette';
import type { Frame } from '../../../engine/render';
import { defineSprite, hasSprite } from '../../../engine/sprites';
import { hash2 } from '../../art/paint';

// ------------------------------------------------------------------------------------ spring-awning

/** Height of the canvas (or the net's top rope) at x: dips (sag > 0) or bulges (sag < 0) in the middle. */
function curve(x: number, w: number, sag: number): number {
  const u = (x - w / 2) / (w / 2);
  return Math.round(sag * (1 - u * u));
}

/**
 * A striped shop awning stretched between two brass posts on coil springs, with a scalloped
 * valance (crimson and cream). `sag`: 0 rest, 4 pressed, −2 rebounding.
 */
function awningFrame(w: number, sag: number): Frame {
  const W = w + 6;
  const H = 20;
  const top = 4;
  const b = new PixelBuffer(W, H);
  const red = PAL.red;
  const cream = [PAL.stone[3], PAL.snow[1], PAL.snow[2], PAL.snow[3]];
  // Posts (behind the canvas ends).
  for (const px of [1, W - 3]) {
    b.rect(px, top - 1, 2, H - top, PAL.gold[1]);
    b.vline(px, top - 1, H - 2, PAL.gold[2]);
    b.set(px, top - 2, PAL.gold[3]);
  }
  for (let x = 3; x < W - 3; x++) {
    const i = x - 3;
    const y = top + curve(i, w, sag);
    const stripe = Math.floor(i / 6) % 2 === 0;
    const c = stripe ? red : cream;
    b.set(x, y, c[3]);
    b.set(x, y + 1, c[2]);
    b.set(x, y + 2, c[2]);
    b.set(x, y + 3, c[1]);
    // Scalloped valance: a half disc every 6 px.
    const k = i % 6;
    const drop = k === 0 || k === 5 ? 1 : k === 1 || k === 4 ? 2 : 3;
    for (let d = 0; d < drop; d++) b.set(x, y + 4 + d, d === drop - 1 ? c[0] : c[1]);
  }
  // Coil springs where the canvas meets the posts.
  for (const [sx, dir] of [
    [3, 1],
    [W - 4, -1],
  ] as const) {
    const y = top + curve(sx - 3, w, sag);
    for (let k = 0; k < 3; k++) {
      b.set(sx + dir * k, y - 1 + (k % 2), PAL.steel[3]);
      b.set(sx + dir * k, y + 2 + (k % 2), PAL.steel[1]);
    }
  }
  b.outline(INK);
  return { buf: b, ox: W >> 1, oy: top };
}

/**
 * A Legion training net: a crimson top rope with gold whipping, a brown diamond mesh hanging
 * below it and gold posts with crimson-and-gold tassels. `sag` as for the awning.
 */
function netFrame(w: number, sag: number): Frame {
  const W = w + 6;
  const H = 20;
  const top = 4;
  const b = new PixelBuffer(W, H);
  for (const px of [1, W - 3]) {
    b.rect(px, top - 2, 2, H - top + 1, PAL.gold[1]);
    b.vline(px, top - 2, H - 2, PAL.gold[2]);
    b.set(px, top - 3, PAL.gold[3]);
    b.set(px + (px === 1 ? 2 : -1), top + 2, PAL.red[2]);
    b.set(px + (px === 1 ? 2 : -1), top + 3, PAL.gold[2]);
  }
  // Mesh: two families of diagonals under the rope, 7 px deep.
  for (let x = 3; x < W - 3; x++) {
    const i = x - 3;
    const y = top + curve(i, w, sag);
    for (let d = 2; d <= 8; d++) {
      const a = (i + d) % 6 === 0;
      const c = (i - d + 60) % 6 === 0;
      if (a || c) b.set(x, y + d, d === 8 ? PAL.brown[1] : PAL.brown[2]);
    }
    b.set(x, y + 9, (i % 6 === 2 || i % 6 === 3) ? PAL.brown[1] : 0);
  }
  for (let x = 3; x < W - 3; x++) {
    const i = x - 3;
    const y = top + curve(i, w, sag);
    b.set(x, y, PAL.red[3]);
    b.set(x, y + 1, i % 8 === 0 ? PAL.gold[2] : PAL.red[1]);
  }
  b.outline(INK);
  return { buf: b, ox: W >> 1, oy: top };
}

/** The awning / net strip for a width, registered on first use (3 frames: rest, pressed, rebound). */
export function awningSprite(variant: 'awning' | 'net', w: number): string {
  const id = `prop/spring-awning/${variant}-${w}`;
  if (!hasSprite(id)) {
    const draw = variant === 'net' ? netFrame : awningFrame;
    defineSprite(id, () => [draw(w, 0), draw(w, 4), draw(w, -2)], { loop: false });
  }
  return id;
}

// ------------------------------------------------------------------------------------ duck-float

/** A tiny race number "7" for the duck's regatta bib (3×5). */
const SEVEN = ascii(['###', '..#', '.#.', '.#.', '.#.'], { '#': PAL.navy[1] });

/**
 * A giant rubber regatta duck facing right, 32 wide, its back 18 px above the water line (the
 * anchor), head and beak up front, a white race bib with a navy 7 on its side. `squint`: the
 * eye squeezed shut (somebody stepped on it).
 */
function duck(squint: boolean): Frame {
  const W = 38;
  const H = 34;
  const wl = 30; // water line row in the buffer
  const b = new PixelBuffer(W, H);
  const g = PAL.gold;
  // Body: a long oval, cut a little under the water line.
  b.ellipse(2, wl - 19, 32, 24, g[2]);
  for (let y = wl + 3; y < H; y++) b.hline(0, W - 1, y, 0);
  // Tail flick at the back.
  b.poly(
    [
      [2, wl - 13],
      [1, wl - 19],
      [6, wl - 15],
    ],
    g[2],
  );
  // Shading: lit top-left, the belly darker toward the water.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (b.get(x, y) !== g[2]) continue;
      const above = y > 0 ? b.get(x, y - 1) : 0;
      if ((above & 255) === 0) b.set(x, y, g[3]);
      else if (y > wl - 4) b.set(x, y, g[1]);
      else if (x > 30 && y > wl - 10) b.set(x, y, g[1]);
    }
  }
  // Wing: a curved crease with a lit edge.
  for (let x = 9; x <= 22; x++) {
    const y = wl - 9 + Math.round(((x - 15.5) * (x - 15.5)) / 14);
    b.set(x, y, g[1]);
    b.set(x, y - 1, g[3]);
  }
  b.set(8, wl - 7, g[1]);
  // Head.
  b.circle(26, wl - 25, 6, g[2]);
  b.circle(25, wl - 26, 4, g[3]);
  b.circle(26, wl - 25, 3, g[2]);
  b.set(23, wl - 28, PAL.snow[3]);
  // Beak.
  b.poly(
    [
      [31, wl - 25],
      [36, wl - 23],
      [31, wl - 21],
    ],
    PAL.orange[1],
  );
  b.hline(32, 35, wl - 23, PAL.orange[0]);
  b.set(32, wl - 25, PAL.orange[2]);
  // Eye.
  if (squint) {
    b.set(27, wl - 27, INK);
    b.set(28, wl - 26, INK);
    b.set(27, wl - 25, INK);
  } else {
    b.rect(27, wl - 27, 2, 3, INK);
    b.set(27, wl - 27, PAL.snow[3]);
  }
  // Race bib with the number.
  b.circle(14, wl - 8, 3, PAL.snow[3]);
  b.set(16, wl - 6, PAL.snow[1]);
  b.blit(SEVEN, 13, wl - 10);
  b.outline(INK);
  return { buf: b, ox: 18, oy: wl };
}

/** Water ripples around the duck's water line (3 frames, 44 wide). */
function ripple(frame: number): Frame {
  const W = 44;
  const b = new PixelBuffer(W, 4);
  for (let x = 0; x < W; x++) {
    const k = (x + frame * 2) % 7;
    if (k === 0 || k === 1) b.set(x, 1, PAL.snow[3]);
    else if (k === 3) b.set(x, 2, PAL.sky[3]);
  }
  for (let x = 0; x < 6; x++) {
    b.set(x, 1, 0);
    b.set(W - 1 - x, 1, x < 3 ? 0 : b.get(W - 1 - x, 1));
  }
  return { buf: b, ox: 22, oy: 1 };
}

// ------------------------------------------------------------------------------------ lily-pad

/** A lily pad seen nearly edge-on (24×6): 0 plain, 1 with a pink flower, 2 with a curled rim. */
function lilyPad(variant: number): Frame {
  const W = 26;
  const H = 13;
  const top = 7;
  const b = new PixelBuffer(W, H);
  b.ellipse(1, top, 24, 5, PAL.green[2]);
  // Top lit, rim dark, a notch on the right.
  for (let x = 1; x < 25; x++) {
    let first = true;
    for (let y = top; y < top + 5; y++) {
      if ((b.get(x, y) & 255) === 0) continue;
      if (first) {
        b.set(x, y, PAL.green[3]);
        first = false;
      }
    }
  }
  b.hline(3, 22, top + 4, PAL.green[1]);
  b.set(19, top + 1, 0);
  b.set(20, top + 1, 0);
  b.set(20, top + 2, 0);
  b.set(18, top + 2, PAL.green[1]);
  for (let x = 6; x < 16; x += 3) b.set(x, top + 2, PAL.green[1]);
  if (variant === 2) {
    // The left rim curls up, showing its pale underside.
    b.rect(1, top - 1, 3, 2, PAL.olive[3]);
    b.set(1, top - 2, PAL.olive[3]);
  }
  if (variant === 1) {
    // A water lily: pink petals with white tips round a gold heart.
    const fx = 8;
    const fy = top - 3;
    b.rect(fx - 3, fy, 7, 3, PAL.pink[1]);
    b.set(fx - 3, fy - 1, PAL.pink[2]);
    b.set(fx + 3, fy - 1, PAL.pink[2]);
    b.set(fx - 1, fy - 2, PAL.pink[2]);
    b.set(fx + 1, fy - 2, PAL.pink[2]);
    b.set(fx, fy - 3, PAL.snow[3]);
    b.set(fx - 2, fy - 2, PAL.snow[3]);
    b.set(fx + 2, fy - 2, PAL.snow[3]);
    b.set(fx, fy, PAL.gold[2]);
    b.set(fx - 1, fy, PAL.gold[3]);
  }
  b.outline(INK);
  return { buf: b, ox: 13, oy: top };
}

// ------------------------------------------------------------------------------------ cable-car

/**
 * The cable-car cabin floor (64×8): a plank deck on a steel beam with a crimson skirt and gold
 * trim, low end rails, and the hanger: a steel bar up to the grip (two pulley wheels on a crimson
 * housing) 50 px above the deck. Anchored on the deck's top centre.
 */
function cableCar(): Frame {
  const W = 68;
  const H = 66;
  const deck = 58;
  const b = new PixelBuffer(W, H);
  const cx = 34;
  // Hanger: a T-bar with braces down to the deck.
  b.rect(cx - 1, 8, 3, deck - 8, PAL.steel[2]);
  b.vline(cx - 1, 8, deck - 1, PAL.steel[3]);
  b.vline(cx + 1, 8, deck - 1, PAL.steel[1]);
  b.line(cx - 1, deck - 14, cx - 12, deck - 1, PAL.steel[2]);
  b.line(cx + 1, deck - 14, cx + 12, deck - 1, PAL.steel[1]);
  b.rect(cx - 9, 13, 19, 2, PAL.steel[2]);
  b.hline(cx - 9, cx + 9, 13, PAL.steel[3]);
  // Grip housing and its pulleys.
  b.rect(cx - 6, 4, 13, 7, PAL.red[2]);
  b.hline(cx - 6, cx + 6, 4, PAL.red[3]);
  b.hline(cx - 6, cx + 6, 10, PAL.red[1]);
  b.hline(cx - 6, cx + 6, 7, PAL.gold[2]);
  for (const wx of [cx - 4, cx + 4]) {
    b.circle(wx, 2, 2, PAL.steel[2]);
    b.set(wx - 1, 1, PAL.steel[3]);
    b.set(wx, 2, PAL.steel[0]);
  }
  // End rails.
  for (const rx of [2, W - 4]) {
    b.rect(rx, deck - 9, 2, 9, PAL.steel[2]);
    b.vline(rx, deck - 9, deck - 1, PAL.steel[3]);
  }
  b.hline(2, 9, deck - 9, PAL.steel[3]);
  b.hline(W - 10, W - 3, deck - 9, PAL.steel[3]);
  // Deck: planks, beam, skirt with trim.
  for (let x = 2; x < W - 2; x++) {
    const seam = (x - 2) % 8 === 7;
    b.set(x, deck, seam ? PAL.brown[1] : PAL.brown[3]);
    b.set(x, deck + 1, seam ? PAL.brown[1] : PAL.brown[2]);
    b.set(x, deck + 2, PAL.steel[2]);
    b.set(x, deck + 3, PAL.steel[1]);
    b.set(x, deck + 4, PAL.red[2]);
    b.set(x, deck + 5, PAL.gold[2]);
    b.set(x, deck + 6, PAL.red[1]);
  }
  b.outline(INK);
  return { buf: b, ox: cx, oy: deck };
}

// ------------------------------------------------------------------------------------ bellows

/**
 * Organ bellows 64 wide: a riveted brass top plate, pleated leather that stretches with the lift
 * `f` (0..24 px) and a brass base plate with an air pipe stub. Feet anchor under the base plate,
 * so the top plate rises as `f` grows.
 */
function bellows(f: number): Frame {
  const W = 66;
  const leather = 4 + f;
  const H = 4 + leather + 4 + 4 + 2;
  const b = new PixelBuffer(W, H);
  const plate = (y: number): void => {
    for (let x = 1; x < W - 1; x++) {
      b.set(x, y, PAL.gold[3]);
      b.set(x, y + 1, PAL.gold[2]);
      b.set(x, y + 2, PAL.gold[2]);
      b.set(x, y + 3, PAL.gold[1]);
    }
    for (let x = 4; x < W - 3; x += 8) {
      b.set(x, y + 1, PAL.gold[3]);
      b.set(x + 1, y + 2, PAL.gold[0]);
    }
  };
  // Leather: folds of 4 rows, the sides pinched in at every crease.
  const top = 5;
  for (let y = 0; y < leather; y++) {
    const k = y % 4;
    const inset = k === 3 ? 3 : k === 0 ? 1 : 0;
    const c: Color = k === 0 ? PAL.brown[3] : k === 1 ? PAL.brown[2] : k === 2 ? PAL.brown[1] : PAL.brown[0];
    b.hline(2 + inset, W - 3 - inset, top + y, c);
  }
  plate(1);
  plate(top + leather);
  // Air pipe under the base.
  const py = top + leather + 4;
  b.rect(W / 2 - 4, py, 8, 2, PAL.gold[1]);
  b.hline(W / 2 - 4, W / 2 + 3, py, PAL.gold[2]);
  b.outline(INK);
  return { buf: b, ox: W >> 1, oy: top + leather + 4 };
}

// ------------------------------------------------------------------------------------ registration

export function definePlatformSprites(): void {
  for (const v of ['awning', 'net'] as const) for (const w of [40, 44, 48]) awningSprite(v, w);
  defineSprite('prop/duck-float/idle', () => [duck(false), duck(true)], { loop: false });
  defineSprite('prop/duck-float/ripple', () => [0, 1, 2].map(ripple), { ticksPerFrame: 8 });
  defineSprite('prop/lily-pad/idle', () => [0, 1, 2].map(lilyPad), { loop: false });
  defineSprite('prop/cable-car/car', cableCar);
  defineSprite('prop/bellows-platform/body', () => Array.from({ length: 25 }, (_, f) => bellows(f)), { loop: false });
}

/** Deterministic variety helper (kept for future pads; avoids unused imports in small builds). */
export function padVariant(x: number): number {
  return Math.floor(hash2(Math.round(x), 0, 31) * 3);
}
