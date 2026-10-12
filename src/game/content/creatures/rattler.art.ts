/**
 * `creature/rattler/…` — the Maraca Rattler (GDD §9.3): a big desert snake, sand with an orange
 * diamond pattern, a crimson maraca for a tail rattle and a small crimson Legion scarf. Coiled
 * 28×24 (the telegraph), stretched 48×16 (the lunge); anchored at the coil centre on the ground.
 *
 * Strips: hidden (3: a sand mound, two eyes and a twitching maraca), idle (2: coiled), rise (3),
 * tell (4: coiled, rattling), attack (2: the lunge, stretched, jaws open), dizzy (2, tongue out),
 * burrow (4: sinking into the sand), walk (4: slithering), alert, die (6: ties itself in a knot,
 * one last rattle), die-blast, die-burn, die-crush, photo-pose.
 * Points: `head` (stars / bubbles), `mouth` (the lunge's leading edge).
 */
import { INK, PAL } from '../../../engine/palette';
import type { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineSprite } from '../../../engine/sprites';
import { BLAST_TIMING, BURN_TIMING, CRUSH_TIMING, FLAT, Sketch, blastStrip, burnStrip, crushStrip, swirlEye, xEye } from './draw';

const SCALE = PAL.sand;
const W = 72;
const H = 44;
const OX = 36;
const OY = 40;

type P = readonly [number, number];

/** Thick body along a path (capsules between the points). */
function path(b: PixelBuffer, X: (x: number) => number, Y: (y: number) => number, pts: readonly P[], thick: number): void {
  for (let i = 0; i + 1 < pts.length; i++) b.capsule(X(pts[i][0]), Y(pts[i][1]), X(pts[i + 1][0]), Y(pts[i + 1][1]), thick, FLAT);
}

/** Orange diamonds along the top of a path, every `step` px (only where `mask` has body pixels). */
function diamonds(mask: PixelBuffer, b: PixelBuffer, X: (x: number) => number, Y: (y: number) => number, pts: readonly P[], step: number, up: number): void {
  let acc = step / 2;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    for (; acc < len; acc += step) {
      const t = acc / len;
      const cx = X(x0 + (x1 - x0) * t);
      const cy = Y(y0 + (y1 - y0) * t) - up;
      if ((mask.get(cx, cy) & 255) === 0 || (mask.get(cx, cy + 1) & 255) === 0) continue;
      b.set(cx, cy - 1, PAL.orange[2]);
      b.set(cx - 1, cy, PAL.orange[1]);
      b.set(cx, cy, PAL.rust[1]);
      b.set(cx + 1, cy, PAL.orange[1]);
      b.set(cx, cy + 1, PAL.rust[2]);
    }
    acc -= len;
  }
}

/** The maraca: a crimson bulb with gold stripes on a short brass handle (handle toward hx, hy). */
function maraca(s: Sketch, cx: number, cy: number, hx: number, hy: number): void {
  s.add(PAL.gold, (b, X, Y) => b.capsule(X(hx), Y(hy), X(cx), Y(cy), 2, FLAT), { base: 1 });
  s.add(PAL.red, (b, X, Y) => b.circle(X(cx), Y(cy), 3, FLAT), { glint: true });
  s.detail((b, X, Y) => {
    b.vline(X(cx), Y(cy - 3), Y(cy + 3), PAL.gold[2]);
    b.set(X(cx - 2), Y(cy), PAL.gold[3]);
    b.set(X(cx + 2), Y(cy), PAL.gold[1]);
  });
}

/** The head: a flat wedge (12×7, snout to the right) with a small eye under a brow, mouth, tongue. */
function head(s: Sketch, hx: number, hy: number, o: { eye?: 'open' | 'x' | 'swirl' | 'shut' | 'happy'; mouth?: 'shut' | 'open' | 'wide'; tongue?: number; droop?: boolean }): void {
  const open = o.mouth === 'open' || o.mouth === 'wide';
  const gap = o.mouth === 'wide' ? 4 : open ? 2 : 0;
  s.add(SCALE, (b, X, Y) => {
    b.poly([X(hx - 4), Y(hy - 2), X(hx), Y(hy - 4), X(hx + 4), Y(hy - 4), X(hx + 8), Y(hy - 1), X(hx + 8), Y(hy + 1), X(hx), Y(hy + 2), X(hx - 4), Y(hy + 2)], FLAT);
    if (open) b.poly([X(hx - 1), Y(hy + 1), X(hx + 6), Y(hy + 1 + gap), X(hx + 1), Y(hy + 3 + gap)], FLAT);
  }, { glint: true });
  s.detail((b, X, Y) => {
    if (open) {
      b.line(X(hx), Y(hy + 1), X(hx + 6), Y(hy + 1 + gap), PAL.red[0]);
      b.line(X(hx), Y(hy + 2), X(hx + 4), Y(hy + 1 + gap), PAL.pink[1]);
    } else b.hline(X(hx + 1), X(hx + 7), Y(hy + 1), SCALE[0]);
    b.set(X(hx + 6), Y(hy - 1), SCALE[0]);
    const e = o.eye ?? 'open';
    const ex = hx + 1;
    const ey = hy - 2;
    if (e === 'x') xEye(b, X(ex), Y(ey));
    else if (e === 'swirl') swirlEye(b, X(ex), Y(ey));
    else if (e === 'shut') b.hline(X(ex - 1), X(ex + 1), Y(ey), INK);
    else if (e === 'happy') {
      b.hline(X(ex - 1), X(ex + 1), Y(ey - 1), INK);
      b.set(X(ex - 2), Y(ey), INK);
      b.set(X(ex + 2), Y(ey), INK);
    } else {
      b.rect(X(ex - 1), Y(ey), 3, 2, PAL.gold[3]);
      b.set(X(ex + 1), Y(ey), INK);
      b.set(X(ex + 1), Y(ey + 1), INK);
      // A stern brow over the eye.
      b.hline(X(ex - 2), X(ex + 1), Y(ey - 1), INK);
      b.set(X(ex + 2), Y(ey), INK);
    }
    // Forked tongue.
    const t = o.tongue ?? 0;
    if (t > 0) {
      const tx = X(hx + 8);
      const ty = Y(hy + (o.droop ? 3 : 0));
      b.hline(tx, tx + t, ty, PAL.red[2]);
      b.set(tx + t + 1, ty - 1, PAL.red[2]);
      b.set(tx + t + 1, ty + 1, PAL.red[2]);
    }
  });
}

/** The crimson scarf (a band round the neck and a short tail flapping back). */
function scarf(s: Sketch, x: number, y: number, flap: number): void {
  s.add(PAL.red, (b, X, Y) => {
    b.rect(X(x - 2), Y(y - 1), 5, 3, FLAT);
    b.rect(X(x - 5), Y(y + flap), 4, 2, FLAT);
  }, { glint: true });
  s.detail((b, X, Y) => b.set(X(x), Y(y), PAL.gold[2]));
}

export interface CoilPose {
  /** Maraca shake offset (−1..1) and head sway (px). */
  shake?: number;
  sway?: number;
  /** 0 = only the coils show (rising), 1 = fully reared. */
  rear?: number;
  tongue?: number;
  eye?: 'open' | 'x' | 'swirl' | 'shut' | 'happy';
  mouth?: 'shut' | 'open' | 'wide';
}

/** Coiled and reared (facing right). */
export function coiled(p: CoilPose = {}): Frame {
  const s = new Sketch(W, H, OX, OY);
  const rear = p.rear ?? 1;
  const sway = p.sway ?? 0;
  const shake = p.shake ?? 0;
  // Tail rising at the back with the maraca.
  const tail: P[] = [[-11, -4], [-15, -8], [-15 + shake, -13]];
  s.add(SCALE, (b, X, Y) => path(b, X, Y, tail, 4));
  maraca(s, -15 + shake * 2, -18 - Math.abs(shake), -15 + shake, -14);
  // Coils: a big ring on the ground and a smaller one on top.
  s.add(SCALE, (b, X, Y) => b.ellipse(X(-13), Y(-9), 26, 9, FLAT), { glint: true });
  s.add(SCALE, (b, X, Y) => b.ellipse(X(-9), Y(-14), 18, 8, FLAT), { glint: true });
  s.detail((b, X, Y) => {
    diamonds(s.buf, b, X, Y, [[-11, -6], [11, -6]], 6, 1);
    diamonds(s.buf, b, X, Y, [[-7, -11], [7, -11]], 6, 0);
    b.hline(X(-10), X(9), Y(-2), SCALE[3]);
  });
  // Neck rising to the head.
  const top = Math.round(-14 - 8 * rear);
  const hx = 8 + sway;
  const hy = top - 4;
  const neck: P[] = [[4, -11], [8, -14], [6 + sway, top + 1], [hx - 1, hy + 1]];
  s.add(SCALE, (b, X, Y) => path(b, X, Y, neck, 5), { glint: true });
  s.detail((b, X, Y) => {
    diamonds(s.buf, b, X, Y, neck, 5, 1);
    // Belly scales along the front of the neck.
    b.vline(X(9 + Math.round(sway / 2)), Y(top + 2), Y(-13), SCALE[3]);
  });
  scarf(s, 7 + Math.round(sway / 2), top + 3, shake > 0 ? 1 : 0);
  head(s, hx, hy, { eye: p.eye, mouth: p.mouth, tongue: p.tongue });
  return s.frame({ head: [hx + 1, hy - 3], mouth: [hx + 6, hy] });
}

export interface StretchPose {
  /** Body wave phase (slither). */
  phase?: number;
  /** 0 = lying on the sand, 1 = head raised a little (lunging). */
  lift?: number;
  mouth?: 'shut' | 'open' | 'wide';
  eye?: 'open' | 'x' | 'swirl' | 'shut' | 'happy';
  tongue?: number;
  droop?: boolean;
  /** Sink into the sand by this many px (burrow). */
  sink?: number;
}

/** Stretched out along the ground (facing right): the lunge, the daze, slithering. */
export function stretched(p: StretchPose = {}): Frame {
  const s = new Sketch(W, H, OX, OY);
  const ph = p.phase ?? 0;
  const lift = p.lift ?? 0;
  const sink = p.sink ?? 0;
  const pts: P[] = [];
  for (let i = 0; i <= 6; i++) {
    const x = -30 + i * 7;
    const wave = Math.round(Math.sin(i * 1.3 + ph * (Math.PI / 2)) * 1.5);
    pts.push([x, -4 + wave - (i === 6 ? lift * 3 : 0) + sink]);
  }
  maraca(s, -34, -7 + sink, -31, -5 + sink);
  s.add(SCALE, (b, X, Y) => path(b, X, Y, pts, 6), { glint: true });
  s.detail((b, X, Y) => {
    diamonds(s.buf, b, X, Y, pts, 6, 1);
    for (let i = 0; i + 1 < pts.length; i++) b.line(X(pts[i][0]), Y(pts[i][1] + 2), X(pts[i + 1][0]), Y(pts[i + 1][1] + 2), SCALE[3]);
  });
  const neck = pts[pts.length - 1];
  scarf(s, neck[0] - 1, neck[1] - 1, 1);
  head(s, neck[0] + 6, neck[1] - 2 - lift * 2 + (p.droop ? 2 : 0), { eye: p.eye, mouth: p.mouth, tongue: p.tongue, droop: p.droop });
  let f = s.frame({ head: [neck[0] + 7, neck[1] - 6], mouth: [neck[0] + 12, neck[1] - 2] });
  if (sink > 0) f = clipBelow(f, -1);
  return f;
}

/** Erase everything at or below the ground line (y ≥ cut, body space): burrowed parts vanish. */
function clipBelow(f: Frame, cut: number): Frame {
  const b = f.buf.clone();
  const y0 = f.oy + cut + 1;
  for (let y = Math.max(0, y0); y < b.h; y++) for (let x = 0; x < b.w; x++) b.set(x, y, 0);
  // Sand lip where the body meets the ground.
  for (let x = 0; x < b.w; x++) {
    if ((b.get(x, y0 - 1) & 255) !== 0 && b.get(x, y0 - 1) !== INK) b.set(x, y0 - 1, PAL.sand[1]);
  }
  b.outline(INK);
  return { buf: b, ox: f.ox, oy: f.oy, pts: f.pts };
}

/** Hidden in the sand: a mound, two eyes, the maraca tip twitching (frame 0..2). */
function hidden(i: number): Frame {
  const s = new Sketch(W, H, OX, OY);
  const twitch = i === 1 ? -1 : i === 2 ? 1 : 0;
  maraca(s, -10, -9 + twitch, -9, -5);
  s.add(SCALE, (b, X, Y) => b.ellipse(X(-11), Y(-6), 23, 7, FLAT), { base: 2, glint: true });
  s.detail((b, X, Y) => {
    // Sand grains (2×1 clusters) and the eyes peeking out.
    b.hline(X(-6), X(-5), Y(-4), SCALE[1]);
    b.hline(X(-1), X(0), Y(-3), SCALE[1]);
    b.hline(X(6), X(7), Y(-4), SCALE[3]);
    const ex = 2;
    b.rect(X(ex), Y(-7), 2, 2, PAL.snow[3]);
    b.rect(X(ex + 4), Y(-7), 2, 2, PAL.snow[3]);
    b.set(X(ex + 1), Y(-6), INK);
    b.set(X(ex + 5), Y(-6), INK);
  });
  return s.frame({ head: [4, -8], mouth: [6, -5] });
}

/** Death: the body ties itself into a knot, one last rattle (the poof is spawned by the game). */
function knot(t: number, shake: number): Frame {
  const s = new Sketch(W, H, OX, OY);
  // The body loops round into a figure-eight pretzel as t goes 0 → 1.
  const r = Math.round(4 + 4 * t);
  maraca(s, -14 + Math.round(shake * 2), -10 - Math.round(t * 6), -12, -6 - Math.round(t * 2));
  s.add(SCALE, (b, X, Y) => {
    path(b, X, Y, [[-12, -5], [-6, -4], [0, -4 - Math.round(t * 3)]], 6);
    b.ellipse(X(-r - 1), Y(-r * 2 - 2), r * 2 + 1, r * 2, FLAT);
    b.ellipse(X(2), Y(-r * 2 - 2), r * 2 + 1, r * 2, FLAT);
  }, { glint: true });
  s.detail((b, X, Y) => {
    if (r >= 5) {
      b.ellipse(X(-r + 2), Y(-r * 2 + 1), r * 2 - 5, r * 2 - 6, PAL.ink[1], false);
      b.ellipse(X(5), Y(-r * 2 + 1), r * 2 - 5, r * 2 - 6, PAL.ink[1], false);
    }
    diamonds(s.buf, b, X, Y, [[-12, -5], [0, -5]], 6, 1);
  });
  head(s, 10 + r, -r * 2 - 1, { eye: 'x', mouth: 'open', tongue: 3, droop: true });
  return s.frame({ head: [10 + r, -r * 2 - 4], mouth: [14 + r, -r * 2] });
}

const A = 'creature/rattler/';

defineSprite(A + 'hidden', () => [0, 1, 0, 2].map(hidden), { durations: [40, 6, 30, 6] });
defineSprite(A + 'idle', () => [coiled({ tongue: 0 }), coiled({ tongue: 3, sway: 1 })], { durations: [20, 10] });
defineSprite(A + 'rise', () => [coiled({ rear: 0.2, eye: 'open' }), coiled({ rear: 0.6 }), coiled({ rear: 1, tongue: 2 })], { ticksPerFrame: 4, loop: false });
defineSprite(A + 'tell', () => [coiled({ shake: -1, tongue: 3 }), coiled({ shake: 1, sway: -1 }), coiled({ shake: -1, tongue: 4, sway: -2 }), coiled({ shake: 1, sway: -1, mouth: 'open' })], { ticksPerFrame: 3 });
defineSprite(A + 'alert', () => [coiled({ rear: 1, eye: 'open', sway: 1 }), coiled({ rear: 1, sway: 0 })], { ticksPerFrame: 6 });
defineSprite(A + 'attack', () => [stretched({ lift: 1, mouth: 'wide' }), stretched({ lift: 1, mouth: 'wide', phase: 1 })], { ticksPerFrame: 4 });
defineSprite(A + 'dizzy', () => [stretched({ eye: 'swirl', mouth: 'open', tongue: 3, droop: true }), stretched({ eye: 'swirl', mouth: 'open', tongue: 4, droop: true, phase: 0.5 })], { ticksPerFrame: 12 });
defineSprite(A + 'walk', () => [0, 1, 2, 3].map((ph) => stretched({ phase: ph, tongue: ph === 1 ? 3 : 0 })), { ticksPerFrame: 6 });
defineSprite(A + 'burrow', () => [2, 4, 6, 8].map((sink) => stretched({ sink, eye: 'shut' })), { ticksPerFrame: 15, loop: false });
defineSprite(A + 'die', () => [stretched({ eye: 'x', mouth: 'open' }), knot(0.2, 0), knot(0.6, 0), knot(1, -1), knot(1, 1), knot(1, 0)], { durations: [6, 6, 6, 6, 6, 18], loop: false });
defineSprite(A + 'die-blast', () => blastStrip(coiled({ eye: 'x', mouth: 'open' }), [9, -24]), { durations: [...BLAST_TIMING], loop: false });
defineSprite(A + 'die-burn', () => burnStrip(coiled({ eye: 'shut' }), [8, -24]), { durations: [...BURN_TIMING], loop: false });
defineSprite(A + 'die-crush', () => crushStrip(stretched({ eye: 'x', mouth: 'open' })), { durations: [...CRUSH_TIMING], loop: false });
defineSprite(A + 'photo-pose', () => coiled({ eye: 'happy', mouth: 'open' }));

