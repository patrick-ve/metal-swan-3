/**
 * `creature/ram-goat/…` — the Avalanche Goat (GDD §9.3): a white mountain goat with thick curling
 * horns, a beard, a golden eye with a bar pupil and a crimson knitted Legion scarf. 36×32,
 * anchored at the feet.
 *
 * Strips: idle (2: chewing), walk (4: trot), tell (4: paws the ground and snorts), attack (4:
 * the charge, head down), leap (2), land (1), stun (2: dizzy after a wall), alert, gag (4: chews a
 * Legion flag), die (6: tumbles, horns stuck in the snow, legs kicking), die-blast, die-burn,
 * die-crush, photo-pose. Points: `head` (stars), `horns` (the charge's leading edge).
 */
import { INK, PAL } from '../../../engine/palette';
import type { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineSprite } from '../../../engine/sprites';
import { BLAST_TIMING, BURN_TIMING, CRUSH_TIMING, FLAT, Sketch, blastStrip, burnStrip, crushStrip, reground, swirlEye, xEye } from './draw';

const COAT = PAL.snow;
const HORN = PAL.sand;
const W = 52;
const H = 46;
const OX = 26;
const OY = 42;

export type GoatLegs = 'stand' | 'trotA' | 'trotB' | 'gallopA' | 'gallopB' | 'paw0' | 'paw1' | 'tuck' | 'splay';

export interface GoatPose {
  legs?: GoatLegs;
  /** 0 head up … 1 head down, horns forward (charge, paw). */
  headDown?: number;
  eye?: 'open' | 'swirl' | 'x' | 'shut' | 'happy';
  /** Jaw open (chewing, bleating). */
  jaw?: boolean;
  /** A Legion flag in the mouth: 0 none, 1–3 shorter as it is eaten. */
  flag?: number;
  /** Snort puff at the nose. */
  puff?: boolean;
  /** Scarf end flap (0 / 1). */
  flap?: number;
  /** Body lifted off the ground (leaping). */
  lift?: number;
}

type Leg = readonly [number, number, number, number];

/** Feet per leg (x, y offsets from the hip column) for each leg pose: near-front, far-front, near-back, far-back. */
function legFeet(l: GoatLegs): readonly Leg[] {
  // [hipX, footX, footY, kneeBend] — footY 0 = on the ground.
  switch (l) {
    case 'trotA':
      return [[5, 9, -2, 1], [3, 1, 0, 1], [-9, -12, 0, -1], [-11, -7, -2, -1]];
    case 'trotB':
      return [[5, 3, 0, 1], [3, 7, -2, 1], [-9, -5, -2, -1], [-11, -13, 0, -1]];
    case 'gallopA':
      return [[5, 12, -4, 1], [3, 10, -2, 1], [-9, -16, -2, -1], [-11, -15, -1, -1]];
    case 'gallopB':
      return [[5, 2, -3, 1], [3, 0, -1, 1], [-9, -3, -3, -1], [-11, -5, -1, -1]];
    case 'paw0':
      return [[5, 10, -6, 1], [3, 3, 0, 1], [-9, -10, 0, -1], [-11, -11, 0, -1]];
    case 'paw1':
      return [[5, 2, -1, 1], [3, 3, 0, 1], [-9, -10, 0, -1], [-11, -11, 0, -1]];
    case 'tuck':
      return [[5, 9, -5, 1], [3, 7, -5, 1], [-9, -6, -5, -1], [-11, -8, -5, -1]];
    case 'splay':
      return [[5, 11, -1, 0], [3, 8, 0, 0], [-9, -14, -1, 0], [-11, -12, 0, 0]];
    default:
      return [[5, 6, 0, 1], [3, 3, 0, 1], [-9, -9, 0, -1], [-11, -11, 0, -1]];
  }
}

function leg(b: PixelBuffer, X: (x: number) => number, Y: (y: number) => number, [hx, fx, fy, bend]: Leg, lift: number): void {
  const hipY = -12 - lift;
  const footY = fy - lift;
  const kx = (hx + fx) / 2 + bend * 2;
  const ky = (hipY + footY) / 2;
  b.taper(X(hx), Y(hipY), X(kx), Y(ky), 4, 3, FLAT);
  b.taper(X(kx), Y(ky), X(fx), Y(footY - 1), 3, 2, FLAT);
}

/** One goat frame (facing right). */
export function goat(p: GoatPose = {}): Frame {
  const s = new Sketch(W, H, OX, OY);
  const legs = legFeet(p.legs ?? 'stand');
  const lift = p.lift ?? 0;
  const hd = p.headDown ?? 0;
  const hx = 12 + Math.round(hd * 3);
  const hy = -25 - lift + Math.round(hd * 7);
  // Far legs (darker), then the body.
  for (const i of [1, 3]) {
    s.add(COAT, (b, X, Y) => leg(b, X, Y, legs[i], lift), { shift: -1 });
    s.add(PAL.black, (b, X, Y) => b.rect(X(legs[i][1] - 1), Y(legs[i][2] - lift - 2), 3, 2, FLAT), { base: 1 });
  }
  // Scarf end flapping behind the shoulder (behind the body).
  s.add(PAL.red, (b, X, Y) => {
    b.rect(X(-1), Y(-21 - lift + (p.flap ?? 0)), 7, 3, FLAT);
  }, { shift: -1 });
  s.detail((b, X, Y) => {
    b.set(X(-1), Y(-20 - lift + (p.flap ?? 0)), PAL.gold[2]);
    b.set(X(-1), Y(-19 - lift + (p.flap ?? 0)), PAL.gold[1]);
  });
  // Body: shaggy white coat with a zigzag fringe underneath, a short tail tuft.
  s.add(COAT, (b, X, Y) => {
    b.ellipse(X(-14), Y(-23 - lift), 24, 13, FLAT);
    for (let x = -12; x <= 8; x += 3) b.tri(X(x), Y(-13 - lift), X(x + 3), Y(-13 - lift), X(x + 1), Y(-9 - lift), FLAT);
    b.ellipse(X(-17), Y(-23 - lift), 5, 4, FLAT);
  }, { glint: true, base: 2 });
  s.detail((b, X, Y) => {
    // Shaggy fur strokes (2-px clusters).
    for (const [x, y] of [[-8, -19], [-3, -21], [2, -18], [-11, -16]] as const) b.hline(X(x), X(x + 1), Y(y - lift), COAT[1]);
  });
  // Near legs.
  for (const i of [0, 2]) {
    s.add(COAT, (b, X, Y) => leg(b, X, Y, legs[i], lift), { base: 2 });
    s.add(PAL.black, (b, X, Y) => b.rect(X(legs[i][1] - 1), Y(legs[i][2] - lift - 2), 3, 2, FLAT), { base: 2, glint: true });
  }
  // Neck and head.
  s.add(COAT, (b, X, Y) => {
    b.taper(X(4), Y(-17 - lift), X(hx - 2), Y(hy + 2), 8, 6, FLAT);
    b.poly([X(hx - 4), Y(hy - 3), X(hx + 2), Y(hy - 4), X(hx + 8), Y(hy + 2), X(hx + 8), Y(hy + 4), X(hx + 4), Y(hy + 5), X(hx - 3), Y(hy + 3)], FLAT);
  }, { glint: true, base: 2 });
  // Beard tuft under the chin.
  s.add(COAT, (b, X, Y) => b.tri(X(hx + 1), Y(hy + 4), X(hx + 5), Y(hy + 4), X(hx + 2), Y(hy + 9), FLAT), { base: 1 });
  // Ear pointing back.
  s.add(COAT, (b, X, Y) => b.poly([X(hx - 2), Y(hy - 2), X(hx - 7), Y(hy), X(hx - 2), Y(hy + 1)], FLAT), { base: 1 });
  // Horns: a thick curl from the top of the head, back and round.
  s.add(HORN, (b, X, Y) => {
    b.ellipse(X(hx - 7), Y(hy - 8), 9, 9, FLAT);
  }, { glint: true, base: 2 });
  s.detail((b, X, Y) => {
    // The curl's inner hole and ridges.
    b.ellipse(X(hx - 5), Y(hy - 6), 4, 4, HORN[0]);
    b.set(X(hx - 4), Y(hy - 5), COAT[2]);
    b.set(X(hx - 1), Y(hy - 7), HORN[0]);
    b.set(X(hx - 6), Y(hy - 8), HORN[0]);
    b.set(X(hx - 7), Y(hy - 3), HORN[0]);
    // Eye: gold with a black bar pupil (or dizzy / knocked out).
    const e = p.eye ?? 'open';
    const ex = hx + 1;
    const ey = hy - 1;
    if (e === 'x') xEye(b, X(ex), Y(ey));
    else if (e === 'swirl') swirlEye(b, X(ex), Y(ey));
    else if (e === 'shut') b.hline(X(ex - 1), X(ex + 1), Y(ey), INK);
    else if (e === 'happy') {
      b.hline(X(ex - 1), X(ex + 1), Y(ey - 1), INK);
      b.set(X(ex - 2), Y(ey), INK);
      b.set(X(ex + 2), Y(ey), INK);
    } else {
      b.rect(X(ex - 1), Y(ey - 1), 3, 2, PAL.gold[2]);
      b.hline(X(ex - 1), X(ex + 1), Y(ey), INK);
      b.set(X(ex - 2), Y(ey - 2), INK);
      b.hline(X(ex - 1), X(ex), Y(ey - 2), COAT[0]);
    }
    // Nostril and mouth.
    b.set(X(hx + 7), Y(hy + 2), COAT[0]);
    if (p.jaw) {
      b.hline(X(hx + 4), X(hx + 7), Y(hy + 4), PAL.red[0]);
    } else b.hline(X(hx + 4), X(hx + 6), Y(hy + 4), COAT[0]);
  });
  // The knitted scarf round the neck: crimson stripes, a gold band.
  s.add(PAL.red, (b, X, Y) => b.taper(X(3), Y(-18 - lift), X(8 + Math.round(hd * 2)), Y(-19 - lift + Math.round(hd * 4)), 6, 5, FLAT), { glint: true });
  s.detail((b, X, Y) => {
    for (let x = 3; x <= 8; x += 2) b.set(X(x + Math.round(hd)), Y(-18 - lift + Math.round(hd * 2)), PAL.red[1]);
    b.set(X(5 + Math.round(hd)), Y(-20 - lift + Math.round(hd * 2)), PAL.gold[2]);
    b.set(X(6 + Math.round(hd)), Y(-20 - lift + Math.round(hd * 2)), PAL.gold[2]);
  });
  // A Legion flag in the mouth (gag): crimson with a gold emblem, shorter as it is chewed.
  const flag = p.flag ?? 0;
  if (flag > 0) {
    const fl = [0, 9, 6, 3][flag];
    s.add(PAL.red, (b, X, Y) => b.rect(X(hx + 6), Y(hy + 3), fl, 6, FLAT), { glint: true });
    s.detail((b, X, Y) => {
      if (fl >= 6) b.rect(X(hx + 8), Y(hy + 5), 2, 2, PAL.gold[2]);
      b.vline(X(hx + 6 + fl - 1), Y(hy + 3), Y(hy + 8), PAL.gold[1]);
    });
  }
  // Snort puff.
  if (p.puff) {
    s.add(PAL.snow, (b, X, Y) => {
      b.circle(X(hx + 11), Y(hy + 3), 2, FLAT);
      b.circle(X(hx + 14), Y(hy + 1), 1, FLAT);
    }, { base: 3, ring: false });
  }
  return s.frame({ head: [hx, hy - 4], horns: [hx + 8, hy + 1] });
}

/** Death: a tumble that ends with the horns stuck in the snow, legs kicking in the air. */
function dieFrames(): Frame[] {
  const tilted = (f: Frame, angle: number): Frame => reground(f.buf.rotated(angle, { quality: 'fast' }).padded(1), f.pts);
  const stuck = (legs: GoatLegs): Frame => tilted(goat({ legs, eye: 'x', headDown: 1 }), Math.PI * 0.62);
  return [
    goat({ eye: 'x', legs: 'splay', jaw: true }),
    tilted(goat({ eye: 'x', legs: 'tuck', headDown: 0.5 }), Math.PI * 0.3),
    stuck('splay'),
    stuck('trotA'),
    stuck('trotB'),
    stuck('splay'),
  ];
}

const A = 'creature/ram-goat/';

defineSprite(A + 'idle', () => [goat({ jaw: false }), goat({ jaw: true, flap: 1 })], { durations: [26, 14] });
defineSprite(A + 'walk', () => [goat({ legs: 'trotA', flap: 1 }), goat({ legs: 'stand' }), goat({ legs: 'trotB', flap: 1 }), goat({ legs: 'stand' })], { ticksPerFrame: 7 });
defineSprite(A + 'tell', () => [goat({ legs: 'paw0', headDown: 0.7 }), goat({ legs: 'paw1', headDown: 0.8, puff: true }), goat({ legs: 'paw0', headDown: 0.7 }), goat({ legs: 'paw1', headDown: 0.8, puff: true, flap: 1 })], { ticksPerFrame: 5 });
defineSprite(A + 'attack', () => [goat({ legs: 'gallopA', headDown: 1, flap: 1 }), goat({ legs: 'gallopB', headDown: 1, lift: 2 }), goat({ legs: 'gallopA', headDown: 1, flap: 1, lift: 1 }), goat({ legs: 'gallopB', headDown: 1 })], { ticksPerFrame: 3 });
defineSprite(A + 'leap', () => [goat({ legs: 'tuck', headDown: 0.6, flap: 1 }), goat({ legs: 'gallopA', headDown: 0.8 })], { ticksPerFrame: 8, loop: false });
defineSprite(A + 'land', () => goat({ legs: 'splay', headDown: 0.4 }), { loop: false });
defineSprite(A + 'stun', () => [goat({ eye: 'swirl', headDown: 0.4, legs: 'splay' }), goat({ eye: 'swirl', headDown: 0.5, legs: 'splay', flap: 1 })], { ticksPerFrame: 10 });
defineSprite(A + 'alert', () => [goat({ eye: 'open', headDown: -0.3 }), goat({ eye: 'open' })], { ticksPerFrame: 6 });
defineSprite(A + 'gag', () => [goat({ flag: 1 }), goat({ flag: 1, jaw: true }), goat({ flag: 2 }), goat({ flag: 3, jaw: true })], { durations: [20, 10, 20, 14] });
defineSprite(A + 'die', dieFrames, { durations: [6, 6, 8, 6, 6, 20], loop: false });
defineSprite(A + 'die-blast', () => blastStrip(goat({ eye: 'x', jaw: true, legs: 'splay' }), [13, -26]), { durations: [...BLAST_TIMING], loop: false });
defineSprite(A + 'die-burn', () => burnStrip(goat({ eye: 'shut' }), [12, -26]), { durations: [...BURN_TIMING], loop: false });
defineSprite(A + 'die-crush', () => crushStrip(goat({ eye: 'x', legs: 'splay' })), { durations: [...CRUSH_TIMING], loop: false });
defineSprite(A + 'photo-pose', () => goat({ eye: 'happy', jaw: true }));
