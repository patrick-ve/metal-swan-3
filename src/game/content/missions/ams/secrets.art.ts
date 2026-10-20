/**
 * Art of the ams secrets (docs/design/ams-extras.md §5), 1×, 2× and 4×: the hint glint and the
 * reveal props of `ams-secret` (secrets.ts). Every prop strip has 3 frames — 0 hidden, 1 the
 * reveal, 2 revealed (it stays) — drawn at 1× in the 64-colour palette with the 1-px ink outline,
 * and at 2× / 4× by ONE density-generic drawer per id (PAL_HD, outline A: a secret can be hit),
 * with the 1× frame's logical size and anchor.
 *
 * | id | size | anchor | look |
 * |---|---|---|---|
 * | `decor/ams/secret-glint` | 7 × 7 | centre | the hint: a 4-frame twinkle (a light: no outline) |
 * | `decor/ams/secret-hoist` | 16 × 26 | top centre = the hook of a gable hoist beam | a crate in a rope sling · it bursts · the empty sling |
 * | `decor/ams/secret-tree-bike` | 30 × 26 | feet | a black omafiets caught on a branch · it slips · the bare branch |
 * | `decor/ams/secret-museum-crate` | 32 × 24 | feet | a pine museum crate `NIET OPENEN` · the front falls · open, straw inside |
 * | `decor/ams/secret-canal-bike` | 26 × 19 | feet | a rusty bike fished out of the canal, weed in its basket · the weed tips out · empty |
 * | `decor/ams/secret-hatch` | 16 × 14 | feet = the cabin roof | a houseboat roof hatch · it flips up · open |
 * | `decor/ams/secret-chest` | 20 × 17 | feet | an iron-banded flea-market chest · the lid lifts, gold light · open, coins inside |
 *
 * Section art: a section that places secrets lists `SECRET_ART` ids of its looks (and the glint)
 * in its `SectionDef.art`, so the 4× frames join the tier-4 working set only there.
 * Deterministic: hashes only.
 */
import type { Color } from '../../../../engine/color';
import { INK, PAL } from '../../../../engine/palette';
import { PAL_HD } from '../../../../engine/palette-hd';
import { PixelBuffer, type Ramp } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite, type DenseDensity } from '../../../../engine/sprites';
import { HdCanvas, leaves, wood, type TexSample } from '../../../art/hd/index';
import { hash2 } from '../../../art/paint';
import { drawGlows, Xf, type Glow } from '../../fx/hd/shapes';
import { drawBike } from './art';
import { bikeHd, bikeMatsHd, type BikeMats } from './art-hd-ab-street';
import { metalMat, propMat } from './art-hd-cd-kit';

const D = 'decor/ams/';

/** The prop looks of `ams-secret` (`spot` has no art: a hit area on existing decor). */
export const SECRET_PROPS = ['hoist', 'tree-bike', 'museum-crate', 'canal-bike', 'hatch', 'chest'] as const;
export type SecretProp = (typeof SECRET_PROPS)[number];

/** The glint's sprite id. */
export const SECRET_GLINT = `${D}secret-glint`;
/** The sprite id of a prop look. */
export function secretSprite(look: SecretProp): string {
  return `${D}secret-${look}`;
}

/** Frames of every prop strip: 0 hidden, 1 the reveal, 2 revealed. */
export const SECRET_FRAMES = 3;

type Draw1 = (b: PixelBuffer, f: number) => void;
type DrawHd = (c: HdCanvas, f: number) => PixelBuffer;

/** Frame size and anchor of each prop (the same at every density). */
const GEOM: Readonly<Record<SecretProp, { w: number; h: number; ox: number; oy: number }>> = {
  hoist: { w: 16, h: 26, ox: 8, oy: 0 },
  'tree-bike': { w: 30, h: 26, ox: 15, oy: 26 },
  'museum-crate': { w: 32, h: 24, ox: 16, oy: 24 },
  'canal-bike': { w: 26, h: 19, ox: 13, oy: 19 },
  hatch: { w: 16, h: 14, ox: 8, oy: 14 },
  chest: { w: 20, h: 17, ox: 10, oy: 17 },
};

// ============================================================================== glint

/** Arm length of the twinkle per frame (1× px). */
const GLINT_ARMS = [0, 1, 2, 1] as const;

function glint1(): Frame[] {
  return GLINT_ARMS.map((a) => {
    const b = new PixelBuffer(7, 7);
    for (let k = 1; k <= a; k++) {
      const c = k === a && a > 1 ? PAL.gold[2] : PAL.gold[3];
      b.set(3 - k, 3, c);
      b.set(3 + k, 3, c);
      b.set(3, 3 - k, c);
      b.set(3, 3 + k, c);
    }
    b.set(3, 3, PAL.snow[3]);
    return { buf: b, ox: 3, oy: 3 };
  });
}

/** The HD twinkle: a white-hot core and four tapering gold rays (flat glow, no outline). */
function glintHd(d: DenseDensity): Frame[] {
  return GLINT_ARMS.map((a) => {
    const c = new HdCanvas(7, 7, d);
    const g: Glow[] = [];
    const arm = a === 0 ? 0 : a + 0.6;
    if (arm > 0) for (const [u, v] of [[arm, 0], [-arm, 0], [0, arm], [0, -arm]] as const) g.push({ k: 'spike', u0: 0, v0: 0, u1: u, v1: v, r0: 0.42, r1: 0.1, h0: 0.85, h1: 0.3 });
    g.push({ k: 'blob', u: 0, v: 0, ru: a === 0 ? 0.5 : 0.62, h: 1.1, fall: 0.25 });
    drawGlows(c, Xf.at(3.5, 3.5), g, { glow: c.material({ ramp: PAL_HD.gold, flat: true, lo: 2, hi: 7 }), part: c.newPart() });
    return { buf: c.render({ outline: 'none', sep: false, ao: 0 }), ox: 3, oy: 3, density: d };
  });
}

// ============================================================================== 1× helpers

/** A wooden board: fill, a lit top row and a dark bottom row. */
function board(b: PixelBuffer, x: number, y: number, w: number, h: number, r: readonly Color[]): void {
  b.rect(x, y, w, h, r[2]);
  b.hline(x, x + w - 1, y, r[3]);
  if (h > 1) b.hline(x, x + w - 1, y + h - 1, r[1]);
}

/** The crate stencil's own 5-px letters (the game's small font is too wide for the crate). */
const STENCIL: Readonly<Record<string, readonly string[]>> = {
  N: ['X..X', 'XX.X', 'X.XX', 'X..X', 'X..X'],
  I: ['X', 'X', 'X', 'X', 'X'],
  E: ['XXX', 'X..', 'XX.', 'X..', 'XXX'],
  T: ['XXX', '.X.', '.X.', '.X.', '.X.'],
  O: ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'],
  P: ['XXX', 'X.X', 'XXX', 'X..', 'X..'],
};

/** Width of a stencil word (1 px between letters). */
function stencilW(s: string): number {
  let w = -1;
  for (const ch of s) w += (STENCIL[ch]?.[0].length ?? 3) + 1;
  return w;
}

/** Every stencil px of `s` centred on cx, top at y (logical px). */
function stencilPx(s: string, cx: number, y: number, out: (x: number, y: number) => void): void {
  let x = cx - (stencilW(s) >> 1);
  for (const ch of s) {
    const g = STENCIL[ch];
    if (!g) {
      x += 4;
      continue;
    }
    for (let r = 0; r < g.length; r++) for (let k = 0; k < g[r].length; k++) if (g[r][k] === 'X') out(x + k, y + r);
    x += g[0].length + 1;
  }
}

// ============================================================================== HD helpers

/** Render options of every prop frame (outline A, the thin cool rim of sprites). */
function done(c: HdCanvas): PixelBuffer {
  return c.render({ outline: 'A', ao: 0.3, sepZ: 0.3, rimLight: 1 });
}

const discs = new Map<number, Int8Array>();
/** Offsets of a disc of radius r (the outline ring). */
function disc(r: number): Int8Array {
  let o = discs.get(r);
  if (o) return o;
  const list: number[] = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if ((dx || dy) && dx * dx + dy * dy <= r * r + r * 0.5) list.push(dx, dy);
  o = Int8Array.from(list);
  discs.set(r, o);
  return o;
}

/**
 * Outline A on a buffer rendered with outline 'none': ink 1 logical px (d art px) round the
 * silhouette, except in the empty px where `skip` holds (the open insides of spoked wheels).
 */
function outlineA(b: PixelBuffer, d: number, skip: (X: number, Y: number) => boolean): PixelBuffer {
  const W = b.w;
  const H = b.h;
  const src = b.data.slice();
  const offs = disc(d);
  const ink = PAL_HD.ink[0];
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const i = Y * W + X;
      if ((src[i] & 255) !== 0 || skip(X, Y)) continue;
      for (let q = 0; q < offs.length; q += 2) {
        const XX = X + offs[q];
        const YY = Y + offs[q + 1];
        if (XX < 0 || YY < 0 || XX >= W || YY >= H) continue;
        if ((src[YY * W + XX] & 255) === 0) continue;
        b.data[i] = ink;
        break;
      }
    }
  }
  return b.touch();
}

/** Skip predicate: the open insides of wheels centred `wheels` (logical px), radius r. */
function holes(wheels: readonly (readonly [number, number])[], d: number, r = 4.2): (X: number, Y: number) => boolean {
  return (X, Y) => {
    const x = (X + 0.5) / d;
    const y = (Y + 0.5) / d;
    for (const [wx, wy] of wheels) if ((x - wx) ** 2 + (y - wy) ** 2 < r * r) return true;
    return false;
  };
}

/** A bike prop frame: rendered without outline, then outline A that leaves the wheels open. */
function bikeDone(c: HdCanvas, wheels: readonly (readonly [number, number])[]): PixelBuffer {
  return outlineA(c.render({ outline: 'none', ao: 0.3, sepZ: 0.3, rimLight: 1 }), c.d, holes(wheels, c.d));
}

/** Rope: a lit hemp cord with a twist at 4×. */
function ropeTex(s: TexSample): void {
  if (s.d >= 4 && (((s.x + s.y) * 2.2) % 1 + 1) % 1 < 0.3) s.tone -= 0.22;
}

function woodMat(c: HdCanvas, ramp: Ramp = PAL_HD.wood, lo = 1, hi = 6): number {
  return propMat(c, ramp, { lo, hi, spec: 0.25, shine: 12 });
}

/** A nail head (a tiny lit steel dome). */
function nail(c: HdCanvas, x: number, y: number, steel: number, z: number): void {
  c.ellipsoid(x, y, 0.42, 0.42, { mat: steel, z });
}

// ============================================================================== hoist

/** The gable-hoist crate (1×): rope from the beam's hook, a shackle, a two-leg sling, the crate. */
const hoist1: Draw1 = (b, f) => {
  const rope = PAL.sand;
  for (let y = 0; y <= 7; y++) b.set(8, y, y % 2 === 0 ? rope[2] : rope[1]);
  b.set(7, 8, PAL.steel[3]);
  b.set(8, 8, PAL.steel[3]);
  b.set(9, 8, PAL.steel[2]);
  if (f === 2) {
    // The empty sling: two loose legs hanging from the shackle, frayed at the ends.
    b.vline(7, 9, 15, rope[1]);
    b.vline(9, 9, 14, rope[1]);
    b.set(6, 16, rope[2]);
    b.set(10, 15, rope[2]);
    return;
  }
  b.line(7, 9, 3, 13, rope[1]);
  b.line(9, 9, 12, 13, rope[1]);
  const W = PAL.brown;
  if (f === 0) {
    board(b, 2, 13, 12, 11, W);
    for (const y of [16, 19, 22]) b.hline(3, 12, y, W[1]);
    b.strokeRect(2, 13, 12, 11, W[1]);
    b.hline(3, 12, 14, W[3]);
    b.line(3, 22, 12, 15, W[3]);
    b.line(4, 22, 12, 16, W[1]);
    for (const [x, y] of [[3, 14], [12, 14], [3, 22], [12, 22]] as const) b.set(x, y, PAL.steel[2]);
    return;
  }
  // Bursting: the two halves lean apart, the gold of what it hid shows in the gap, planks fly.
  board(b, 1, 14, 6, 10, W);
  board(b, 9, 14, 6, 10, W);
  b.strokeRect(1, 14, 6, 10, W[1]);
  b.strokeRect(9, 14, 6, 10, W[1]);
  b.hline(2, 5, 15, W[3]);
  b.hline(10, 13, 15, W[3]);
  b.rect(7, 16, 2, 4, PAL.gold[2]);
  b.set(7, 16, PAL.gold[3]);
  b.hline(0, 1, 25, W[2]);
  b.hline(14, 15, 25, W[2]);
};

const hoistHd: DrawHd = (c, f) => {
  const rope = propMat(c, PAL_HD.sand, { lo: 2, hi: 6, spec: 0.15 });
  const steel = metalMat(c);
  const wd = woodMat(c);
  const batten = woodMat(c, PAL_HD.wood, 1, 5);
  const gold = metalMat(c, PAL_HD.gold, { lo: 2, hi: 7 });
  c.capsule(8.5, -0.3, 8.5, 7.9, 0.48, 0.48, { mat: rope, z: 1, tex: ropeTex });
  c.ellipsoid(8.5, 8.6, 1.25, 0.75, { mat: steel, z: 1.4 });
  if (f === 2) {
    c.capsule(7.6, 9.2, 7.5, 15.4, 0.42, 0.36, { mat: rope, z: 1.2, tex: ropeTex });
    c.capsule(9.4, 9.2, 9.6, 14.6, 0.42, 0.36, { mat: rope, z: 1.2, tex: ropeTex });
    c.ellipsoid(7.0, 16.2, 0.55, 0.45, { mat: rope, z: 1.2, tone: 0.2 });
    c.ellipsoid(10.1, 15.3, 0.55, 0.45, { mat: rope, z: 1.2, tone: 0.2 });
    return done(c);
  }
  c.capsule(7.8, 9.1, 3.4, 13.4, 0.4, 0.4, { mat: rope, z: 1.2, tex: ropeTex });
  c.capsule(9.2, 9.1, 12.6, 13.4, 0.4, 0.4, { mat: rope, z: 1.2, tex: ropeTex });
  if (f === 0) {
    c.box(2, 13, 12, 11, { mat: wd, z: 2, bevel: 0.3, tex: wood({ seed: 41, plank: 2.75 }) });
    // Battens round the face and the diagonal brace.
    for (const [x, y, w, h] of [[2, 13, 12, 1.2], [2, 22.8, 12, 1.2], [2, 13, 1.2, 11], [12.8, 13, 1.2, 11]] as const) c.box(x, y, w, h, { mat: batten, z: 2.5, bevel: 0.35, tex: wood({ seed: 43 }) });
    c.poly([[3.2, 22.2], [4.6, 22.8], [12.8, 15.1], [11.4, 14.4]], { mat: batten, z: 2.6, tex: wood({ seed: 44 }) });
    for (const [x, y] of [[2.6, 13.6], [13.4, 13.6], [2.6, 23.4], [13.4, 23.4]] as const) nail(c, x, y, steel, 2.9);
    return done(c);
  }
  // Bursting: two halves lean apart, the gold of the hidden thing in the gap, two planks flying.
  c.poly([[1.2, 14.2], [6.8, 13.6], [7.2, 23.6], [0.8, 24.2]], { mat: wd, z: 2, tex: wood({ seed: 45, plank: 2.75 }) });
  c.poly([[9.2, 13.6], [14.8, 14.2], [15.2, 24.2], [8.8, 23.6]], { mat: wd, z: 2, tex: wood({ seed: 46, plank: 2.75 }) });
  c.box(1.2, 14.2, 5.6, 1.1, { mat: batten, z: 2.4, bevel: 0.3 });
  c.box(9.2, 14.2, 5.6, 1.1, { mat: batten, z: 2.4, bevel: 0.3 });
  c.ellipsoid(8, 18, 1.1, 2.1, { mat: gold, z: 1.6 });
  c.box(0.2, 24.8, 2.6, 0.9, { mat: batten, z: 2.4 });
  c.box(13.2, 24.8, 2.6, 0.9, { mat: batten, z: 2.4 });
  return done(c);
};

// ============================================================================== tree bike

/** Bike wheel row per frame (it slips 1 px down and right in the reveal). */
const TREE_BIKE_AT: readonly (readonly [number, number] | null)[] = [[4, 22], [5, 23], null];
/** A red omafiets (it reads against the leaves and the sky better than a black one). */
const TREE_BIKE_COLOUR = PAL.red[1];

const treeBike1: Draw1 = (b, f) => {
  const at = TREE_BIKE_AT[f];
  if (at) drawBike(b, at[0], at[1], TREE_BIKE_COLOUR);
  // The branch the bars and the saddle caught on, a twig up, leaves.
  b.thickLine(0, 7, 29, 12, 2, PAL.brown[1]);
  b.line(0, 6, 29, 11, PAL.brown[2]);
  b.line(19, 9, 24, 2, PAL.brown[1]);
  if (f === 2) {
    // A snapped twig hanging where the bike was; two loose leaves.
    b.line(12, 9, 13, 14, PAL.brown[1]);
    b.set(10, 17, PAL.green[3]);
    b.set(17, 20, PAL.green[2]);
  }
  for (const [x, y, r] of [[2, 5, 3], [27, 9, 3], [23, 2, 2]] as const) {
    b.circle(x, y, r, PAL.green[2]);
    b.set(x - 1, y - 1, PAL.green[4]);
    b.set(x, y - 1, PAL.green[3]);
    b.set(x + 1, y + 1, PAL.green[1]);
  }
};

const treeBikeHd: DrawHd = (c, f) => {
  const bark = propMat(c, PAL_HD.brown, { lo: 1, hi: 5, spec: 0.1 });
  const leaf = propMat(c, PAL_HD.green, { lo: 2, hi: 7, spec: 0.2 });
  const at = TREE_BIKE_AT[f];
  const wheels: (readonly [number, number])[] = [];
  if (at) wheels.push(...bikeHd(c, bikeMatsHd(c), at[0], at[1], TREE_BIKE_COLOUR, false, 1));
  c.stroke([[-0.5, 7.4], [10, 9.2], [20, 11], [30.5, 12.6]], 1.25, 0.85, { mat: bark, z: 3, tex: wood({ seed: 51, dir: 'h' }) });
  c.capsule(19.5, 9.6, 24.4, 2.4, 0.6, 0.35, { mat: bark, z: 2.9 });
  if (f === 2) {
    c.capsule(12.5, 9.4, 13.4, 14.6, 0.45, 0.25, { mat: bark, z: 2.8 });
    c.ellipsoid(10.5, 17.5, 0.8, 0.5, { mat: leaf, z: 3 });
    c.ellipsoid(17.5, 20.5, 0.8, 0.5, { mat: leaf, z: 3 });
  }
  for (const [x, y, r, s] of [[2.5, 5.5, 3.3, 52], [27.5, 9.5, 3.3, 53], [23.5, 2.6, 2.4, 54]] as const) c.ellipsoid(x, y, r, r * 0.9, { mat: leaf, z: 3.5, tex: leaves({ size: 1.6, seed: s, ragged: 0.6 }) });
  return bikeDone(c, wheels);
};

// ============================================================================== museum crate

const crate1: Draw1 = (b, f) => {
  const P = PAL.sand;
  const ink = PAL.ink[1];
  if (f > 0) {
    // The open crate: the dark inside, straw at the bottom, the frame battens round it.
    b.rect(1, 2, 30, 19, PAL.brown[0]);
    b.rect(3, 4, 26, 3, PAL.brown[1]);
    for (let x = 3; x < 29; x++) {
      const h = 3 + Math.floor(hash2(x, 1, 61) * 3);
      b.vline(x, 20 - h, 19, hash2(x, 2, 61) < 0.5 ? PAL.gold[1] : P[1]);
      if (hash2(x, 3, 61) < 0.4) b.set(x, 20 - h, PAL.gold[2]);
    }
    board(b, 1, 2, 30, 2, P);
    board(b, 1, 2, 2, 19, P);
    board(b, 29, 2, 2, 19, P);
  }
  if (f === 0) {
    b.rect(1, 2, 30, 19, P[2]);
    for (const y of [7, 12, 17]) b.hline(3, 28, y, P[1]);
    board(b, 1, 2, 30, 2, P);
    board(b, 1, 19, 30, 2, P);
    b.rect(1, 2, 2, 19, P[1]);
    b.rect(29, 2, 2, 19, P[1]);
    b.vline(1, 2, 20, P[3]);
    stencilPx('NIET', 16, 6, (x, y) => b.set(x, y, ink));
    stencilPx('OPENEN', 16, 13, (x, y) => b.set(x, y, ink));
    for (const [x, y] of [[2, 3], [29, 3], [2, 19], [29, 19]] as const) b.set(x, y, PAL.steel[2]);
  } else if (f === 1) {
    // The front panel falls forward: its lower part still stands, the stencil cut short.
    b.rect(1, 11, 30, 10, P[2]);
    b.hline(1, 30, 11, P[3]);
    b.hline(3, 28, 16, P[1]);
    board(b, 1, 19, 30, 2, P);
    stencilPx('OPENEN', 16, 14, (x, y) => b.set(x, y, ink));
  } else {
    // The front panel lies flat in front.
    board(b, 0, 21, 32, 2, P);
  }
  b.rect(3, 21, 6, 2, PAL.brown[1]);
  b.rect(23, 21, 6, 2, PAL.brown[1]);
  if (f === 2) board(b, 0, 21, 32, 2, P);
};

const crateHd: DrawHd = (c, f) => {
  const pine = woodMat(c, PAL_HD.sand, 2, 7);
  const batten = woodMat(c, PAL_HD.sand, 1, 6);
  const inside = woodMat(c, PAL_HD.wood, 0, 2);
  const straw = propMat(c, PAL_HD.sand, { lo: 3, hi: 7, spec: 0.2 });
  const skid = woodMat(c, PAL_HD.brown, 1, 4);
  const steel = metalMat(c);
  // Sprayed stencil letters: each 1× letter px a d × d block of worn black paint, a darker lower
  // edge; at 4× a few dry-brush specks of the wood show through.
  const textAt = (s: string, y: number): void => {
    const px = new Set<number>();
    stencilPx(s, 16, y, (x, yy) => px.add(yy * 64 + x));
    c.paint(1, y, 30, 5, (_x, _y, X, Y) => {
      const lx = Math.floor(X / c.d);
      const ly = Math.floor(Y / c.d);
      if (!px.has(ly * 64 + lx)) return 0;
      if (c.d >= 4 && hash2(X, Y, 61) > 0.965) return 0;
      return Y % c.d === c.d - 1 && !px.has((ly + 1) * 64 + lx) ? PAL_HD.black[0] : PAL_HD.black[1];
    }, 10);
  };
  if (f > 0) {
    c.box(1, 2, 30, 19, { mat: inside, z: 0.5, tex: wood({ seed: 62, plank: 3 }) });
    // Straw: a soft heap of packing straw, lit on its upper left, a few loose strands.
    c.heightField(3, 13.5, 26, 7, (x, y) => {
      const top = 20 - (3 + hash2(Math.floor(x / 2), 1, 61) * 1.6 + Math.sin(x * 0.9) * 0.7);
      return y < top ? NaN : 0.8 + Math.sin(x * 1.3) * 0.2 - (y - top) * 0.05;
    }, {
      mat: straw,
      z: 1,
      tex: (s) => {
        const k = Math.sin(s.x * 3.1 + s.y * 0.9 + hash2(Math.floor(s.y * 2), 0, 62) * 3);
        s.tone += k * 0.18;
        if (s.d >= 4 && k > 0.85) s.tone += 0.15;
      },
    });
    c.box(1, 2, 30, 2, { mat: batten, z: 2, bevel: 0.4, tex: wood({ seed: 63 }) });
    c.box(1, 2, 2, 19, { mat: batten, z: 2, bevel: 0.4, tex: wood({ seed: 64, dir: 'v' }) });
    c.box(29, 2, 2, 19, { mat: batten, z: 2, bevel: 0.4, tex: wood({ seed: 65, dir: 'v' }) });
  }
  if (f === 0) {
    c.box(1, 2, 30, 19, { mat: pine, z: 1, tex: wood({ seed: 66, plank: 5 }) });
    for (const [x, y, w, h, dir] of [[1, 2, 30, 2, 'h'], [1, 19, 30, 2, 'h'], [1, 2, 2, 19, 'v'], [29, 2, 2, 19, 'v']] as const) c.box(x, y, w, h, { mat: batten, z: 2, bevel: 0.4, tex: wood({ seed: 67 + x + y, dir }) });
    textAt('NIET', 6);
    textAt('OPENEN', 13);
    for (const [x, y] of [[2.5, 3.5], [29.5, 3.5], [2.5, 19.5], [29.5, 19.5]] as const) nail(c, x, y, steel, 2.6);
  } else if (f === 1) {
    c.box(1, 11, 30, 10, { mat: pine, z: 3, bevel: 0.3, n: [0, 0.35, 0.94], tex: wood({ seed: 66, plank: 5 }) });
    c.box(1, 19, 30, 2, { mat: batten, z: 3.5, bevel: 0.4, tex: wood({ seed: 68 }) });
    textAt('OPENEN', 14);
  }
  c.box(3, 21, 6, 2, { mat: skid, z: 1.5, bevel: 0.3 });
  c.box(23, 21, 6, 2, { mat: skid, z: 1.5, bevel: 0.3 });
  if (f === 2) c.box(0, 21, 32, 2, { mat: pine, z: 4, bevel: 0.4, n: [0, -0.6, 0.8], tex: wood({ seed: 69 }) });
  return done(c);
};

// ============================================================================== canal bike

/** Where the weed bundle sits in the basket per frame (x, y of its middle; null = gone). */
const WEED_AT: readonly (readonly [number, number] | null)[] = [[19, 4], [21, 2], null];

/** Rusty colours of the fished-out bike (1×): steel and ink go rust and brown. */
const RUST_MAP: readonly (readonly [Color, Color])[] = [
  [PAL.steel[1], PAL.rust[0]],
  [PAL.steel[2], PAL.rust[1]],
  [PAL.steel[3], PAL.rust[2]],
  [PAL.ink[1], PAL.brown[0]],
  [PAL.ink[0], PAL.brown[0]],
  [PAL.gold[3], PAL.rust[2]],
];

const canalBike1: Draw1 = (b, f) => {
  const bike = new PixelBuffer(26, 19);
  drawBike(bike, 1, 18, PAL.rust[1]);
  for (const [a, z] of RUST_MAP) bike.replace(a, z);
  b.blit(bike, 0, 0);
  // The front basket (wicker) over the front wheel.
  b.rect(17, 5, 6, 4, PAL.brown[1]);
  b.hline(17, 22, 5, PAL.brown[2]);
  for (let x = 18; x < 23; x += 2) b.vline(x, 6, 8, PAL.brown[2]);
  // Weed hanging from the frame, the wheels and the basket; a drip.
  for (const [x, y0, y1, c] of [[5, 9, 12, PAL.green[1]], [9, 12, 15, PAL.green[2]], [16, 13, 16, PAL.green[1]], [21, 9, 11, PAL.green[2]], [3, 14, 16, PAL.green[2]]] as const) b.vline(x, y0, y1, c);
  b.set(9, 17, PAL.sky[2]);
  const w = WEED_AT[f];
  if (w) {
    b.ellipse(w[0] - 3, w[1] - 2, 6, 4, PAL.green[2]);
    b.set(w[0] - 2, w[1] - 2, PAL.green[3]);
    b.set(w[0] - 1, w[1] - 1, PAL.green[4]);
    b.set(w[0] + 1, w[1] + 1, PAL.green[1]);
  }
};

/** Bike materials gone rusty (HD): rust tubes, perished brown tyres, dull rims. */
function rustMats(c: HdCanvas): BikeMats {
  const m = bikeMatsHd(c);
  return {
    ...m,
    tyre: propMat(c, PAL_HD.brown, { lo: 0, hi: 3, spec: 0.1 }),
    rim: propMat(c, PAL_HD.rust, { lo: 1, hi: 5, spec: 0.3 }),
    chrome: propMat(c, PAL_HD.rust, { lo: 2, hi: 6, spec: 0.4 }),
    rack: propMat(c, PAL_HD.rust, { lo: 0, hi: 3 }),
    guard: propMat(c, PAL_HD.rust, { lo: 0, hi: 4 }),
    lamp: propMat(c, PAL_HD.rust, { lo: 3, hi: 6 }),
  };
}

const canalBikeHd: DrawHd = (c, f) => {
  const weed = propMat(c, PAL_HD.green, { lo: 1, hi: 6, spec: 0.5, shine: 20 });
  const wicker = woodMat(c, PAL_HD.brown, 1, 6);
  const drip = c.material({ ramp: PAL_HD.sky, flat: true, lo: 2, hi: 5 });
  const wheels = bikeHd(c, rustMats(c), 1, 18, PAL.rust[1], false, 1);
  // The wicker basket: woven rows over the front wheel.
  c.box(17, 5, 6, 4, {
    mat: wicker,
    z: 2.5,
    bevel: 0.35,
    tex: (s) => {
      const row = Math.floor((s.y - 5) * 1.5);
      s.tone += ((Math.floor(s.x * 1.2) + row) % 2 === 0 ? 0.12 : -0.12) - (s.d >= 4 && ((s.y - 5) * 1.5) % 1 < 0.2 ? 0.2 : 0);
    },
  });
  // Weed strands: slick green ribbons hanging from the frame, the wheels and the basket.
  for (const [x, y0, y1] of [[5.5, 9.4, 13], [9.5, 12.4, 16], [16.5, 13.4, 17], [21.5, 9.2, 11.8], [3.5, 14.2, 17]] as const) c.capsule(x, y0, x + 0.3, y1, 0.42, 0.22, { mat: weed, z: 2.6 });
  c.ellipsoid(9.5, 17.6, 0.35, 0.45, { mat: drip, z: 2.7, tone: 0.6 });
  const w = WEED_AT[f];
  if (w) {
    // The bundle: a clump of slick weed with a strand dangling over the basket rim.
    c.ellipsoid(w[0], w[1], 3.1, 2.1, { mat: weed, z: 2.8, tex: leaves({ size: 1.3, seed: 71, ragged: 0.7 }) });
    c.capsule(w[0] + 2, w[1] + 1, w[0] + 2.6, w[1] + 4, 0.4, 0.2, { mat: weed, z: 2.9 });
  }
  return bikeDone(c, wheels);
};

// ============================================================================== hatch

const hatch1: Draw1 = (b, f) => {
  const W = PAL.brown;
  if (f === 0) {
    b.rect(2, 8, 12, 2, W[2]);
    b.hline(2, 13, 8, W[3]);
    for (const x of [5, 8, 11]) b.set(x, 9, W[1]);
    b.hline(7, 9, 6, PAL.gold[2]);
    b.set(7, 7, PAL.gold[1]);
    b.set(9, 7, PAL.gold[1]);
  } else if (f === 1) {
    b.rect(2, 9, 12, 1, PAL.ink[1]);
    b.thickLine(2, 9, 10, 1, 2, W[2]);
    b.line(1, 8, 9, 0, W[3]);
  } else {
    b.rect(3, 9, 11, 1, PAL.ink[1]);
    b.rect(1, 0, 2, 10, W[2]);
    b.vline(1, 0, 9, W[3]);
    for (const y of [3, 6]) b.set(2, y, W[1]);
  }
  board(b, 1, 10, 14, 3, W);
};

const hatchHd: DrawHd = (c, f) => {
  const wd = woodMat(c);
  const dark = woodMat(c, PAL_HD.wood, 0, 2);
  const brass = metalMat(c, PAL_HD.gold, { lo: 2, hi: 7 });
  c.box(1, 10, 14, 3, { mat: wd, z: 2, bevel: 0.4, tone: -0.1, tex: wood({ seed: 81 }) });
  if (f === 0) {
    c.box(2, 8, 12, 2, { mat: wd, z: 2.5, bevel: 0.35, n: [0, -0.4, 0.92], tex: wood({ seed: 82, dir: 'v', plank: 3 }) });
    c.stroke([[7.3, 8.1], [7.4, 6.6], [9.6, 6.6], [9.7, 8.1]], 0.38, 0.38, { mat: brass, z: 3 });
    return done(c);
  }
  c.box(2.5, 9.1, 11, 1, { mat: dark, z: 1.5, tone: -0.4 });
  if (f === 1) {
    // The lid at 45°, hinged at the left of the coaming.
    c.poly([[1.9, 9.9], [9.7, 2.1], [11, 3.4], [3.2, 11.2]], { mat: wd, z: 2.6, n: [-0.45, -0.45, 0.77], tex: wood({ seed: 83, dir: 'v', plank: 3 }) });
  } else c.box(1, 0.4, 2, 9.8, { mat: wd, z: 2.6, bevel: 0.35, tex: wood({ seed: 84, dir: 'v', plank: 3 }) });
  return done(c);
};

// ============================================================================== chest

const chest1: Draw1 = (b, f) => {
  const W = PAL.brown;
  // The body: two planks, iron bands, the lock plate.
  b.rect(1, 8, 18, 8, W[1]);
  b.hline(1, 18, 8, W[2]);
  b.hline(2, 17, 11, W[0]);
  b.hline(2, 17, 14, W[0]);
  if (f === 2) {
    // Open: the inside of the lid behind, coins heaped in the chest, a sparkle.
    b.rect(2, 1, 16, 6, W[0]);
    b.vline(4, 1, 6, PAL.steel[1]);
    b.vline(15, 1, 6, PAL.steel[1]);
    b.hline(2, 17, 7, PAL.gold[2]);
    b.hline(3, 16, 8, PAL.gold[3]);
    for (let x = 3; x < 17; x += 3) b.set(x, 7, PAL.gold[3]);
    b.set(11, 5, PAL.snow[3]);
  } else {
    const lift = f === 1 ? 2 : 0;
    b.roundRect(1, 3 - lift, 18, 5, 2, W[2]);
    b.hline(3, 16, 3 - lift, W[3]);
    b.hline(1, 18, 7 - lift, W[1]);
    for (const x of [4, 15]) {
      b.vline(x, 3 - lift, 7 - lift, PAL.steel[2]);
      b.set(x, 3 - lift, PAL.steel[3]);
    }
    if (f === 1) {
      b.hline(2, 17, 6, PAL.gold[3]);
      b.hline(2, 17, 7, PAL.gold[2]);
    }
    b.rect(9, 7, 2, 3, PAL.gold[2]);
    b.set(9, 7, PAL.gold[3]);
    b.set(10, 8, PAL.ink[1]);
  }
  for (const x of [4, 15]) b.vline(x, 8, 15, PAL.steel[2]);
};

const chestHd: DrawHd = (c, f) => {
  const wd = woodMat(c, PAL_HD.wood, 1, 5);
  const inner = woodMat(c, PAL_HD.wood, 0, 2);
  const iron = metalMat(c, PAL_HD.steel, { lo: 1, hi: 5, spec: 0.6 });
  const brass = metalMat(c, PAL_HD.gold, { lo: 2, hi: 7 });
  const light = c.material({ ramp: PAL_HD.gold, flat: true, lo: 3, hi: 6 });
  c.box(1, 8, 18, 8, { mat: wd, z: 2, bevel: 0.35, tex: wood({ seed: 91, plank: 3 }) });
  for (const x of [3.6, 14.6]) c.box(x, 8, 1.2, 8, { mat: iron, z: 2.6, bevel: 0.3 });
  if (f === 2) {
    c.box(2, 1, 16, 6, { mat: inner, z: 1, tex: wood({ seed: 92, dir: 'v', plank: 4 }) });
    for (const x of [3.6, 14.6]) c.box(x, 1, 1.2, 6, { mat: iron, z: 1.3, tone: -0.2 });
    // Coins heaped in the chest, catching the light.
    for (let k = 0; k < 9; k++) c.ellipsoid(3 + k * 1.75, 8.1 - (k % 3) * 0.35, 1.05, 0.75, { mat: brass, z: 2.8 + (k % 2) * 0.1 });
    c.ellipsoid(11.5, 5.5, 0.6, 0.6, { mat: light, z: 3.5, tone: 1 });
    return done(c);
  }
  const lift = f === 1 ? 1.8 : 0;
  if (f === 1) c.box(1.6, 6.2, 16.8, 1.8, { mat: light, z: 1.8, tex: (s) => (s.tone = 0.55 + (1 - Math.abs(s.x - 10) / 9) * 0.45) });
  c.cylinder(1, 3 - lift, 18, 5, { mat: wd, z: 3, axis: 'h', tex: wood({ seed: 93 }) });
  for (const x of [3.6, 14.6]) c.box(x, 3 - lift, 1.2, 5, { mat: iron, z: 3.6, bevel: 0.3 });
  c.box(8.9, 6.8, 2.2, 3, { mat: brass, z: 4, bevel: 0.4 });
  c.dot(10.1, 8.4, PAL_HD.ink[0]);
  return done(c);
};

// ============================================================================== register

const DRAW1: Readonly<Record<SecretProp, Draw1>> = {
  hoist: hoist1,
  'tree-bike': treeBike1,
  'museum-crate': crate1,
  'canal-bike': canalBike1,
  hatch: hatch1,
  chest: chest1,
};

const DRAWHD: Readonly<Record<SecretProp, DrawHd>> = {
  hoist: hoistHd,
  'tree-bike': treeBikeHd,
  'museum-crate': crateHd,
  'canal-bike': canalBikeHd,
  hatch: hatchHd,
  chest: chestHd,
};

/** The 1× strip of a prop: each frame drawn, then the 1-px ink outline. */
export function secretFrames1(look: SecretProp): Frame[] {
  const g = GEOM[look];
  return Array.from({ length: SECRET_FRAMES }, (_, f) => {
    const b = new PixelBuffer(g.w, g.h);
    DRAW1[look](b, f);
    return { buf: b.outline(INK), ox: g.ox, oy: g.oy };
  });
}

/** The 2× / 4× strip of a prop (one density-generic drawer, outline A). */
export function secretFramesHd(look: SecretProp, d: DenseDensity): Frame[] {
  const g = GEOM[look];
  return Array.from({ length: SECRET_FRAMES }, (_, f) => ({ buf: DRAWHD[look](new HdCanvas(g.w, g.h, d), f), ox: g.ox, oy: g.oy, density: d }));
}

/** Every secret sprite id (the glint and the props). */
export const SECRET_ART: readonly string[] = [SECRET_GLINT, ...SECRET_PROPS.map(secretSprite)];

defineSprite(SECRET_GLINT, glint1, { ticksPerFrame: 4, loop: false, hd: glintHd });
for (const look of SECRET_PROPS) defineSprite(secretSprite(look), () => secretFrames1(look), { ticksPerFrame: 8, loop: false, hd: (d) => secretFramesHd(look, d) });
