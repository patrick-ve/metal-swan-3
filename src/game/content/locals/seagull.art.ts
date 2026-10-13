/**
 * `enemy/seagull/…` — the aggressive herring gull (docs/design/amsterdam.md §2): a big white body,
 * a pale grey back and wings with black tips (white mirror spots), a yellow beak with a red spot,
 * a mean yellow eye under a frown, pink legs.
 *
 * Flying frames are anchored at the body centre; perched frames (perch, gag, gag-fries, alert)
 * at the feet; death strips at the feet (the game moves the anchor down when it dies).
 *
 * Strips: walk (4: the flap cycle), idle (4), perch (2), gag (2: asleep, head tucked), gag-fries
 * (4: pecking a stolen fries cone), alert (2: perched, head up), tell (2: wings up, KAW),
 * attack (2: the dive, wings folded back), die (3), die-blast, die-burn, die-crush, photo-pose,
 * feather (4: a falling feather, centre anchor).
 */
import { INK, PAL } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineSprite } from '../../../engine/sprites';
import { BLAST_TIMING, BURN_TIMING, CRUSH_TIMING, FLAT, Sketch, blastStrip, burnStrip, crushStrip, reground, xEye } from '../creatures/draw';

const W = 44;
const H = 40;
const OX = 22;
const OY = 20;

const WHITE = PAL.snow;
const GREY = PAL.steel;
const TIP = PAL.black;
const BEAK = PAL.gold;

export type GullWings = 'up' | 'mid' | 'down' | 'wide' | 'folded' | 'rest';
export type GullFace = 'open' | 'shut' | 'kaw' | 'x' | 'happy' | 'dive';

export interface GullPose {
  wings?: GullWings;
  face?: GullFace;
  /** Standing on its feet (anchor = feet). */
  perched?: boolean;
  /** Head tucked into the back (asleep). */
  tucked?: boolean;
  /** Head dipped down (pecking). */
  peck?: number;
  /** A fries cone in front (0 = none, 1 = in the beak, 2 = on the ground). */
  fries?: number;
}

type V = readonly [number, number];
const lerp = (a: V, b: V, t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** A long gull wing from the shoulder: grey arm, black tip with a white mirror spot. */
function wingParts(s: Sketch, sh: V, tip: V, far: boolean): void {
  const lead: V = [sh[0] + 4, sh[1]];
  const trail: V = [sh[0] - 9, sh[1] + 2];
  const mid = lerp(lead, tip, 0.62);
  const midT = lerp(trail, tip, 0.62);
  s.add(GREY, (b, X, Y) => b.poly([X(lead[0]), Y(lead[1]), X(mid[0]), Y(mid[1]), X(midT[0]), Y(midT[1]), X(trail[0]), Y(trail[1])], FLAT), { base: far ? 2 : 3, shift: 0 });
  s.add(TIP, (b, X, Y) => b.poly([X(mid[0]), Y(mid[1]), X(tip[0]), Y(tip[1]), X(midT[0]), Y(midT[1])], FLAT), { base: 1 });
  s.detail((b, X, Y) => {
    const m = lerp(mid, tip, 0.45);
    b.set(X(m[0]), Y(m[1]), PAL.snow[3]);
  });
}

/** One gull facing right. Flying: anchor at the body centre; perched: anchor at the feet. */
export function gull(p: GullPose = {}): Frame {
  const perched = p.perched === true;
  const oy = perched ? H - 2 : OY;
  const s = new Sketch(W, H, OX, oy);
  const by = perched ? -11 : 0;
  const wings = p.wings ?? (perched ? 'rest' : 'mid');
  const tips: Record<GullWings, V> = {
    up: [-8, -20],
    mid: [-21, -5],
    down: [-12, 13],
    wide: [-3, -22],
    folded: [-15, 0],
    rest: [-13, 1],
  };
  const tip = tips[wings];
  const sh: V = [1, by - 3];
  // Far wing (behind, only when the wings are spread).
  if (wings === 'up' || wings === 'wide' || wings === 'mid') wingParts(s, sh, [tip[0] + 5, tip[1] - 2], true);
  // Legs (perched): pink, with webbed feet.
  if (perched) {
    s.add(PAL.pink, (b, X, Y) => {
      b.vline(X(-2), Y(-6), Y(-1), FLAT);
      b.vline(X(1), Y(-6), Y(-1), FLAT);
      b.hline(X(-4), X(0), Y(-1), FLAT);
      b.hline(X(-1), X(3), Y(-1), FLAT);
    }, { hi: 0, lo: 0, base: 1 });
  }
  // Tail (white, a little dark edge under it).
  s.add(WHITE, (b, X, Y) => b.poly([X(-8), Y(by - 2), X(-15), Y(by - 1 + (perched ? 3 : 0)), X(-14), Y(by + 2 + (perched ? 3 : 0)), X(-7), Y(by + 3)], FLAT), { base: 2 });
  // Body: a big white teardrop, grey on the back.
  s.add(WHITE, (b, X, Y) => b.ellipse(X(-9), Y(by - 5), 18, 10, FLAT), { base: 3, glint: true });
  s.add(GREY, (b, X, Y) => b.ellipse(X(-8), Y(by - 5), 13, 4, FLAT), { base: 3, lo: 0 });
  // Head and neck.
  const hx = p.tucked ? 2 : p.face === 'dive' ? 8 : 6;
  const hy = by + (p.tucked ? -3 : p.face === 'dive' ? 1 : -6) + (p.peck ?? 0);
  s.add(WHITE, (b, X, Y) => {
    b.circle(X(hx), Y(hy), 4, FLAT);
    if (!p.tucked) b.thickLine(X(3), Y(by - 2), X(hx), Y(hy), 4, FLAT);
  }, { base: 3, glint: true });
  // Beak: yellow, hooked, a red spot near the tip.
  const face = p.face ?? 'open';
  if (!p.tucked) {
    const down = face === 'dive' ? 2 : 0;
    s.add(BEAK, (b, X, Y) => {
      if (face === 'kaw') {
        b.poly([X(hx + 3), Y(hy - 1), X(hx + 10), Y(hy - 4), X(hx + 9), Y(hy - 2), X(hx + 4), Y(hy)], FLAT);
        b.poly([X(hx + 3), Y(hy + 1), X(hx + 9), Y(hy + 3), X(hx + 4), Y(hy + 2)], FLAT);
      } else {
        b.poly([X(hx + 3), Y(hy - 1), X(hx + 10), Y(hy + down), X(hx + 10), Y(hy + 2 + down), X(hx + 3), Y(hy + 2)], FLAT);
      }
    }, { hi: 0, lo: 0, base: 2 });
    s.detail((b, X, Y) => {
      if (face === 'kaw') {
        b.set(X(hx + 6), Y(hy + 2), PAL.red[2]);
        b.set(X(hx + 5), Y(hy), PAL.red[0]);
      } else b.set(X(hx + 8), Y(hy + 1 + down), PAL.red[2]);
      b.set(X(hx + 10), Y(hy + 1 + down), BEAK[0]);
    });
  }
  // Eye: a mean yellow eye with a frown (x when dead, a line when asleep).
  s.detail((b, X, Y) => {
    if (p.tucked) {
      b.hline(X(hx), X(hx + 1), Y(hy), INK);
      return;
    }
    if (face === 'x') xEye(b, X(hx + 1), Y(hy - 1));
    else if (face === 'shut') b.hline(X(hx), X(hx + 2), Y(hy - 1), INK);
    else if (face === 'happy') {
      b.set(X(hx), Y(hy - 1), INK);
      b.set(X(hx + 1), Y(hy - 2), INK);
      b.set(X(hx + 2), Y(hy - 1), INK);
    } else {
      b.set(X(hx + 1), Y(hy - 1), PAL.gold[3]);
      b.set(X(hx + 2), Y(hy - 1), INK);
      // The frown: a dark brow slanting down to the beak.
      b.set(X(hx), Y(hy - 3), INK);
      b.set(X(hx + 1), Y(hy - 3), INK);
      b.set(X(hx + 2), Y(hy - 2), INK);
    }
  });
  // Near wing in front.
  if (wings === 'rest' || wings === 'folded') {
    s.add(GREY, (b, X, Y) => b.poly([X(2), Y(by - 4), X(-6), Y(by - 5), X(tip[0]), Y(by + tip[1] - 1), X(-4), Y(by + 1)], FLAT), { base: 2 });
    s.add(TIP, (b, X, Y) => b.poly([X(-8), Y(by - 3), X(tip[0] - 1), Y(by + tip[1] - 1), X(-8), Y(by)], FLAT), { base: 1 });
    s.detail((b, X, Y) => b.set(X(-10), Y(by - 1), PAL.snow[3]));
  } else wingParts(s, [sh[0] - 1, sh[1] + 1], tip, false);
  // Flying feet tucked under the tail.
  if (!perched) s.detail((b, X, Y) => b.hline(X(-6), X(-4), Y(4), PAL.pink[1]));
  // Fries: a red-and-white paper cone with yellow sticks.
  if (p.fries) {
    const fx = p.fries === 1 ? hx + 9 : 12;
    const fy = p.fries === 1 ? hy + 3 : -1;
    s.add(PAL.red, (b, X, Y) => b.poly([X(fx - 3), Y(fy - 6), X(fx + 3), Y(fy - 6), X(fx), Y(fy)], FLAT), { base: 2 });
    s.detail((b, X, Y) => {
      b.vline(X(fx - 1), Y(fy - 6), Y(fy - 3), PAL.snow[3]);
      b.vline(X(fx + 1), Y(fy - 6), Y(fy - 3), PAL.snow[3]);
      for (let k = -2; k <= 2; k++) b.vline(X(fx + k), Y(fy - 9 + (k & 1)), Y(fy - 7), PAL.gold[3]);
    });
  }
  return s.frame({ head: [hx, hy], mouth: [hx + 9, hy + 1] });
}

/** Feet-anchored copy (death strips: the gull lands on the floor). */
function grounded(f: Frame): Frame {
  return reground(f.buf.clone(), f.pts);
}

/** A white feather (4 turning frames, centre anchor). */
function featherFrames(): Frame[] {
  return [0, 1, 2, 3].map((i) => {
    const b = new PixelBuffer(9, 9);
    const pts = [
      [1, 4, 7, 4],
      [2, 6, 6, 2],
      [4, 1, 4, 7],
      [2, 2, 6, 6],
    ][i];
    b.line(pts[0], pts[1], pts[2], pts[3], PAL.snow[3]);
    b.set(pts[2], pts[3], PAL.steel[3]);
    b.outline(PAL.steel[2]);
    return { buf: b, ox: 4, oy: 4 };
  });
}

const A = 'enemy/seagull/';
const FLAP: GullWings[] = ['up', 'mid', 'down', 'mid'];

defineSprite(A + 'walk', () => FLAP.map((wings) => gull({ wings })), { ticksPerFrame: 5 });
defineSprite(A + 'idle', () => FLAP.map((wings) => gull({ wings })), { ticksPerFrame: 6 });
defineSprite(A + 'perch', () => [gull({ perched: true }), gull({ perched: true, peck: 1 })], { durations: [40, 10] });
defineSprite(A + 'gag', () => [gull({ perched: true, tucked: true }), gull({ perched: true, tucked: true, peck: 1 })], { ticksPerFrame: 30 });
defineSprite(A + 'gag-fries', () => [gull({ perched: true, fries: 2 }), gull({ perched: true, fries: 2, peck: 4 }), gull({ perched: true, fries: 1 }), gull({ perched: true, fries: 1, peck: 1 })], { durations: [14, 8, 16, 8] });
defineSprite(A + 'alert', () => [gull({ perched: true, face: 'kaw' }), gull({ perched: true, wings: 'up', face: 'open' })], { ticksPerFrame: 6 });
defineSprite(A + 'tell', () => [gull({ wings: 'wide', face: 'kaw' }), gull({ wings: 'up', face: 'kaw' })], { ticksPerFrame: 3 });
defineSprite(A + 'attack', () => [gull({ wings: 'folded', face: 'dive' }), gull({ wings: 'folded', face: 'dive', peck: 1 })], { ticksPerFrame: 4 });
defineSprite(A + 'die', () => [grounded(gull({ wings: 'up', face: 'x' })), grounded(gull({ wings: 'down', face: 'x' })), grounded(gull({ wings: 'rest', face: 'x' }))], { durations: [6, 6, 40], loop: false });
defineSprite(A + 'die-blast', () => blastStrip(grounded(gull({ wings: 'rest', face: 'x' })), null), { durations: [...BLAST_TIMING], loop: false });
defineSprite(A + 'die-burn', () => burnStrip(grounded(gull({ wings: 'rest', face: 'shut' })), null), { durations: [...BURN_TIMING], loop: false });
defineSprite(A + 'die-crush', () => crushStrip(grounded(gull({ wings: 'wide', face: 'x' }))), { durations: [...CRUSH_TIMING], loop: false });
defineSprite(A + 'photo-pose', () => gull({ wings: 'wide', face: 'happy' }));
defineSprite(A + 'feather', featherFrames, { ticksPerFrame: 6 });
