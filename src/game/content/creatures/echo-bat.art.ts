/**
 * `creature/echo-bat/…` — the Echo Bat (GDD §9.3): a small purple bat with enormous ears, big
 * cartoon eyes and a tiny crimson Legion scarf. Body 20×14, wings 24 wide.
 *
 * Flying frames are anchored at the body centre. Hanging frames are anchored at the feet that
 * grip the ceiling (the art hangs below the anchor). Death strips are anchored at the feet (the
 * game moves the anchor down when the bat dies, so it lands on the floor).
 *
 * Strips: walk (4: the flap cycle), idle (4, = flying), hang (2: asleep upside down), gag (4:
 * hanging, singing little notes), alert (2: wakes up, still hanging), tell (2: wings wide,
 * screech; the game flashes it white), attack (2: diving, wings folded), die (3: X eyes, falling),
 * die-blast, die-burn, die-crush, photo-pose, note (2: a sung note, centre anchor).
 */
import { INK, PAL } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineSprite } from '../../../engine/sprites';
import { BLAST_TIMING, BURN_TIMING, CRUSH_TIMING, FLAT, Sketch, blastStrip, burnStrip, crushStrip, eye, reground, xEye } from './draw';

const FUR = PAL.purple;
const W = 36;
const H = 34;
const OX = 18;
const OY = 17;

export type BatWings = 'up' | 'mid' | 'down' | 'wide' | 'folded' | 'wrap';
export type BatFace = 'open' | 'shut' | 'sing' | 'screech' | 'x' | 'happy' | 'wide';

export interface BatPose {
  wings?: BatWings;
  face?: BatFace;
  /** Ears swept back (diving). */
  earsBack?: boolean;
  /** Scarf tail flap (0 / 1). */
  flap?: number;
}

/** A bat wing polygon from the shoulder (sx, sy) to the tip, with a scalloped trailing edge. */
function wing(b: PixelBuffer, X: (x: number) => number, Y: (y: number) => number, sx: number, sy: number, tipX: number, tipY: number, dir: number): void {
  // Scallops: three finger points along the trailing edge between the tip and the body.
  const f1x = sx + (tipX - sx) * 0.75;
  const f2x = sx + (tipX - sx) * 0.42;
  const drop = dir; // the trailing edge sags below (dir 1) or above (dir −1) the leading edge
  b.poly([
    X(sx), Y(sy),
    X(tipX), Y(tipY),
    X(f1x), Y(tipY + 4 * drop + (sy - tipY) * 0.3),
    X(f1x - 1), Y(tipY + 2 * drop + (sy - tipY) * 0.45),
    X(f2x), Y(sy + 4 * drop),
    X(f2x - 1), Y(sy + 2 * drop),
    X(sx), Y(sy + 3 * drop),
  ], FLAT);
}

/** One flying bat (facing right), anchored at the body centre. */
export function bat(p: BatPose = {}): Frame {
  const s = new Sketch(W, H, OX, OY);
  const wings = p.wings ?? 'mid';
  const tips: Record<BatWings, readonly [number, number]> = {
    up: [-9, -14],
    mid: [-15, -3],
    down: [-11, 8],
    wide: [-16, -9],
    folded: [-11, 2],
    wrap: [0, 0],
  };
  const [tx, ty] = tips[wings];
  const drop = wings === 'down' ? -1 : 1;
  // Far wing (behind, darker) and far ear.
  if (wings !== 'wrap') {
    s.add(FUR, (b, X, Y) => wing(b, X, Y, 0, -3, tx + 4, ty - (wings === 'up' ? 3 : 2), drop), { base: 0, hi: 0, lo: 0 });
  }
  s.add(FUR, (b, X, Y) => {
    if (p.earsBack) b.poly([X(-3), Y(-3), X(-9), Y(-7), X(-1), Y(-6)], FLAT);
    else b.poly([X(-4), Y(-3), X(-5), Y(-14), X(0), Y(-5)], FLAT);
  }, { base: 0, hi: 0 });
  // Body: a round fuzzy ball.
  s.add(FUR, (b, X, Y) => b.circle(X(0), Y(0), 5, FLAT), { glint: true, base: 1 });
  s.detail((b, X, Y) => {
    b.rect(X(0), Y(1), 4, 3, PAL.pink[2]);
    b.rect(X(1), Y(2), 2, 2, PAL.pink[1]);
  });
  // Near ear: enormous, with a pink inside.
  s.add(FUR, (b, X, Y) => {
    if (p.earsBack) b.poly([X(-1), Y(-4), X(-10), Y(-10), X(2), Y(-6)], FLAT);
    else b.poly([X(-1), Y(-4), X(2), Y(-17), X(5), Y(-4)], FLAT);
  }, { base: 1 });
  s.detail((b, X, Y) => {
    if (p.earsBack) b.line(X(-2), Y(-6), X(-8), Y(-9), PAL.pink[1]);
    else {
      b.line(X(2), Y(-13), X(2), Y(-6), PAL.pink[1]);
      b.line(X(3), Y(-11), X(3), Y(-6), PAL.pink[0]);
    }
  });
  // Face: a big eye and a little mouth.
  s.detail((b, X, Y) => {
    const face = p.face ?? 'open';
    if (face === 'x') xEye(b, X(3), Y(-1));
    else if (face === 'shut') b.hline(X(2), X(4), Y(-1), INK);
    else if (face === 'happy') {
      b.hline(X(2), X(4), Y(-2), INK);
      b.set(X(1), Y(-1), INK);
      b.set(X(5), Y(-1), INK);
    } else eye(b, X(3), Y(-1), face === 'wide' || face === 'screech' ? 3 : 2, 1, 0);
    if (face === 'sing') {
      b.rect(X(4), Y(2), 2, 2, PAL.red[0]);
    } else if (face === 'screech') {
      b.rect(X(3), Y(2), 3, 3, PAL.red[0]);
      b.set(X(4), Y(2), PAL.snow[3]);
    } else b.set(X(4), Y(2), INK);
  });
  // Tiny crimson scarf under the chin, tail fluttering back.
  s.add(PAL.red, (b, X, Y) => {
    b.rect(X(-2), Y(3), 5, 2, FLAT);
    b.rect(X(-5), Y(4 + (p.flap ?? 0)), 3, 2, FLAT);
  }, { glint: true });
  // Near wing in front: a membrane with finger bones and a lit leading edge.
  if (wings === 'wrap') {
    s.add(FUR, (b, X, Y) => b.ellipse(X(-6), Y(-3), 9, 11, FLAT), { base: 0 });
  } else {
    s.add(FUR, (b, X, Y) => wing(b, X, Y, -2, -1, tx, ty, drop), { base: 1, hi: 0, lo: 0 });
    s.detail((b, X, Y) => {
      b.line(X(-2), Y(-1), X(tx), Y(ty), FUR[2]);
      const f1x = -2 + (tx + 2) * 0.75;
      const f2x = -2 + (tx + 2) * 0.42;
      b.line(X(-2), Y(-1), X(f1x), Y(ty + 4 * drop + (-1 - ty) * 0.3), FUR[0]);
      b.line(X(-2), Y(-1), X(f2x), Y(-1 + 4 * drop), FUR[0]);
    });
  }
  // Feet.
  s.detail((b, X, Y) => {
    b.set(X(-1), Y(5), INK);
    b.set(X(1), Y(5), INK);
  });
  return s.frame({ head: [2, -4], mouth: [5, 2] });
}

/** Hanging upside down from a ceiling, wings wrapped: anchored at the feet (the art hangs below). */
function hanging(p: BatPose): Frame {
  const s = new Sketch(W, H, OX, 2);
  // Far ear (behind), hanging down.
  s.add(FUR, (b, X, Y) => b.poly([X(-3), Y(16), X(-5), Y(25), X(0), Y(17)], FLAT), { base: 0, hi: 0 });
  // Wrapped wings: an egg-shaped cloak with fold lines.
  s.add(FUR, (b, X, Y) => b.ellipse(X(-5), Y(2), 10, 13, FLAT), { base: 1, glint: true });
  s.detail((b, X, Y) => {
    b.vline(X(-2), Y(4), Y(12), FUR[0]);
    b.vline(X(2), Y(5), Y(12), FUR[0]);
    b.vline(X(-4), Y(5), Y(10), FUR[2]);
  });
  // Head at the bottom, the near ear pointing down.
  s.add(FUR, (b, X, Y) => b.circle(X(1), Y(17), 4, FLAT), { base: 1, glint: true });
  s.add(FUR, (b, X, Y) => b.poly([X(-1), Y(19), X(1), Y(29), X(4), Y(20)], FLAT), { base: 1 });
  s.detail((b, X, Y) => {
    b.line(X(1), Y(21), X(1), Y(26), PAL.pink[1]);
    const face = p.face ?? 'shut';
    if (face === 'shut') b.hline(X(2), X(4), Y(16), INK);
    else eye(b, X(3), Y(16), face === 'wide' ? 2 : 1, 1, 0);
    if (face === 'sing') b.rect(X(4), Y(18), 2, 2, PAL.red[0]);
    else b.set(X(4), Y(18), INK);
  });
  // Scarf between the cloak and the head, its tail hanging.
  s.add(PAL.red, (b, X, Y) => {
    b.rect(X(-2), Y(13), 6, 2, FLAT);
    b.rect(X(-4), Y(14), 2, 3 + (p.flap ?? 0), FLAT);
  }, { glint: true });
  // Feet gripping the ceiling.
  s.detail((b, X, Y) => {
    b.vline(X(-1), Y(0), Y(2), INK);
    b.vline(X(1), Y(0), Y(2), INK);
  });
  return s.frame({ head: [2, 17] });
}

/** A hanging frame with a sung note floating up beside it (gag). */
function singing(i: number): Frame {
  const f = hanging({ face: i % 2 === 0 ? 'sing' : 'shut' });
  const out = new PixelBuffer(f.buf.w + 10, f.buf.h);
  out.blit(f.buf, 0, 0);
  if (i >= 1) {
    // ♪ drifting to the side as it rises.
    const x = f.ox + 7 + i;
    const y = f.oy + 10 - i * 3;
    out.rect(x, y + 3, 2, 2, PAL.gold[2]);
    out.vline(x + 1, y, y + 3, PAL.gold[2]);
    out.set(x + 2, y, PAL.gold[1]);
  }
  return { buf: out, ox: f.ox, oy: f.oy, pts: f.pts };
}

/** Feet-anchored copy (death strips: the bat lands on the floor). */
function grounded(f: Frame): Frame {
  return reground(f.buf.clone(), f.pts);
}

/** A sung note (centre anchor). */
function noteFrames(): Frame[] {
  return [0, 1].map((i) => {
    const b = new PixelBuffer(9, 10);
    b.rect(1, 6 - i, 3, 2, PAL.gold[2]);
    b.vline(3, 1 - i, 6 - i, PAL.gold[2]);
    b.hline(3, 5, 1 - i + 0, PAL.gold[2]);
    b.set(5, 2 - i, PAL.gold[1]);
    b.set(1, 6 - i, PAL.gold[3]);
    b.outline(INK);
    return { buf: b, ox: 4, oy: 5 };
  });
}

const A = 'creature/echo-bat/';
const FLAP: BatWings[] = ['up', 'mid', 'down', 'mid'];

defineSprite(A + 'walk', () => FLAP.map((wings, i) => bat({ wings, flap: i % 2 })), { ticksPerFrame: 4 });
defineSprite(A + 'idle', () => FLAP.map((wings, i) => bat({ wings, flap: i % 2 })), { ticksPerFrame: 5 });
defineSprite(A + 'hang', () => [hanging({ face: 'shut' }), hanging({ face: 'shut', flap: 1 })], { ticksPerFrame: 30 });
defineSprite(A + 'gag', () => [0, 1, 2, 3].map(singing), { durations: [14, 10, 10, 18] });
defineSprite(A + 'alert', () => [hanging({ face: 'wide' }), hanging({ face: 'open' })], { ticksPerFrame: 6 });
defineSprite(A + 'tell', () => [bat({ wings: 'wide', face: 'screech' }), bat({ wings: 'wide', face: 'screech', flap: 1 })], { ticksPerFrame: 3 });
defineSprite(A + 'attack', () => [bat({ wings: 'folded', earsBack: true, face: 'wide' }), bat({ wings: 'folded', earsBack: true, face: 'wide', flap: 1 })], { ticksPerFrame: 4 });
defineSprite(A + 'die', () => [grounded(bat({ wings: 'up', face: 'x' })), grounded(bat({ wings: 'down', face: 'x' })), grounded(bat({ wings: 'folded', face: 'x' }))], { durations: [6, 6, 40], loop: false });
defineSprite(A + 'die-blast', () => blastStrip(grounded(bat({ wings: 'wide', face: 'x' })), null), { durations: [...BLAST_TIMING], loop: false });
defineSprite(A + 'die-burn', () => burnStrip(grounded(bat({ wings: 'folded', face: 'shut' })), null), { durations: [...BURN_TIMING], loop: false });
defineSprite(A + 'die-crush', () => crushStrip(grounded(bat({ wings: 'wide', face: 'x' }))), { durations: [...CRUSH_TIMING], loop: false });
defineSprite(A + 'photo-pose', () => bat({ wings: 'wide', face: 'happy' }));
defineSprite(A + 'note', noteFrames, { ticksPerFrame: 8 });
