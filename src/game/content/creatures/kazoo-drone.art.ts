/**
 * `creature/kazoo-drone/…` — the Kazoo Drone (GDD §9.3): a flying brass kazoo (a fat tube with a
 * wide buzzing bell at the front and a narrow mouthpiece at the back) with a crimson paint band, a
 * tin membrane cap on top that doubles as its one lamp eye, and two tiny propellers on struts.
 * 16×12 in flight, centre anchor, facing right (the bell leads).
 *
 * Strips: idle (2), walk (4, flying: the props spin), tell (4: it buzzes higher, shakes and glows,
 * notes puff from the bell), attack (2: the dive, nose down), die (4: pops into confetti),
 * die-blast, die-burn, die-crush, note (2: its note bullet, centre anchor).
 */
import { INK, PAL } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineSprite } from '../../../engine/sprites';
import { BLAST_TIMING, BURN_TIMING, CRUSH_TIMING, FLAT, Sketch, blastStrip, burnStrip, crushStrip, xEye } from './draw';

const TIN = PAL.steel;
const PAINT = PAL.red;
const BRASS = PAL.gold;

export interface DronePose {
  /** Propeller phase 0..3 (0 / 2 wide, 1 / 3 edge-on). */
  prop?: number;
  /** Shake (px) and bob (px down). */
  shake?: number;
  bob?: number;
  eye?: 'lamp' | 'glow' | 'x' | 'angry';
  /** The bell flares (buzzing): 0 or 1. */
  buzz?: number;
  /** Nose down (the dive). */
  dive?: boolean;
  /** Props broken off (death). */
  noProps?: boolean;
}

const W = 26;
const H = 22;
const OX = 13;
const OY = 12;

/** One drone frame (facing right, centre anchor). */
export function drone(p: DronePose = {}): Frame {
  const sx = p.shake ?? 0;
  const by = p.bob ?? 0;
  const buzz = p.buzz ?? 0;
  const s = new Sketch(W, H, OX, OY);
  const X0 = sx;
  const Y0 = by;
  // Props behind the body first: struts and blades over the back and the front.
  if (!p.noProps) {
    const ph = (p.prop ?? 0) & 3;
    const span = [3, 1, 3, 0][ph];
    const span2 = [0, 3, 1, 3][ph];
    for (const [px, sp] of [[-5, span], [4, span2]] as const) {
      s.add(TIN, (b, X, Y) => b.rect(X(X0 + px), Y(Y0 - 6), 1, 3, FLAT), { base: 1, hi: 0 });
      s.add(BRASS, (b, X, Y) => b.rect(X(X0 + px - sp), Y(Y0 - 7), sp * 2 + 1, 1, FLAT), { glint: true, lo: 0 });
    }
  }
  // Mouthpiece: a narrow brass tube at the back.
  s.add(BRASS, (b, X, Y) => b.roundRect(X(X0 - 8), Y(Y0 - 2), 5, 4, 1, FLAT), { base: 1 });
  // Main tube: fat brass body widening into the bell at the front.
  s.add(BRASS, (b, X, Y) => {
    b.roundRect(X(X0 - 5), Y(Y0 - 3), 10, 6, 2, FLAT);
    b.rect(X(X0 + 4), Y(Y0 - 4 - buzz), 3, 8 + buzz * 2, FLAT);
  }, { glint: true });
  // Crimson paint band and the bell's dark mouth.
  s.detail((b, X, Y) => {
    b.rect(X(X0 - 3), Y(Y0 - 2), 2, 5, PAINT[2]);
    b.vline(X(X0 - 3), Y(Y0 - 2), Y(Y0 + 2), PAINT[3]);
    b.vline(X(X0 + 6), Y(Y0 - 3 - buzz), Y(Y0 + 3 + buzz), BRASS[0]);
    b.vline(X(X0 + 5), Y(Y0 - 2), Y(Y0 + 2), BRASS[3]);
    b.set(X(X0 - 7), Y(Y0 - 1), BRASS[3]);
  });
  // The tin membrane cap with its lamp eye, on top of the tube.
  s.add(TIN, (b, X, Y) => b.ellipse(X(X0 - 1), Y(Y0 - 6), 6, 5, FLAT), { glint: true, base: 2 });
  s.detail((b, X, Y) => {
    const ex = X0 + 2;
    const ey = Y0 - 5;
    const e = p.eye ?? 'lamp';
    if (e === 'x') xEye(b, X(ex), Y(ey));
    else {
      const glow = e === 'glow';
      b.rect(X(ex - 1), Y(ey - 1), 2, 2, glow ? PAL.red[3] : PAL.sky[2]);
      b.set(X(ex - 1), Y(ey - 1), PAL.snow[3]);
      // A cross brow: the drone means business.
      if (e === 'angry' || glow) b.line(X(ex - 2), Y(ey - 3), X(ex), Y(ey - 2), INK);
    }
  });
  const f = s.frame({ muzzle: [8 + sx, by], head: [1 + sx, by - 8] });
  if (!p.dive) return f;
  // Nose down for the dive: rotate 35° clockwise around the anchor.
  const r = f.buf.rotated(0.6, { quality: 'fast' });
  return { buf: r, ox: r.w >> 1, oy: r.h >> 1, pts: f.pts };
}

/** Small music notes puffing from the bell (telegraph). */
function withNotes(f: Frame, n: number): Frame {
  const b = f.buf.clone();
  const x = f.ox + 9 + n;
  const y = f.oy - 4 - n * 2;
  if (x + 2 < b.w && y - 3 >= 0) {
    b.rect(x, y, 2, 2, PAL.snow[3]);
    b.vline(x + 2, y - 3, y + 1, PAL.snow[3]);
    b.outline(INK);
  }
  return { ...f, buf: b };
}

/** Pop: the drone bursts into a ring of confetti scraps (the confetti particles fly on). */
function popFrames(): Frame[] {
  const colors = [PAINT[3], BRASS[3], PAL.snow[3], PAL.sky[2], PAL.pink[2]];
  const ring = (r: number, dots: number): Frame => {
    const b = new PixelBuffer(W, H);
    for (let i = 0; i < dots; i++) {
      const a = (i / dots) * Math.PI * 2 + r * 0.2;
      const x = Math.round(OX + Math.cos(a) * r);
      const y = Math.round(OY + Math.sin(a) * r * 0.8);
      b.rect(x, y, 2, 1, colors[i % colors.length]);
    }
    return { buf: b, ox: OX, oy: OY };
  };
  const flash = (): Frame => {
    const f = drone({ eye: 'x', buzz: 1, noProps: true });
    const b = f.buf.clone();
    b.replace(BRASS[2], BRASS[3]);
    b.replace(BRASS[1], BRASS[2]);
    return { ...f, buf: b };
  };
  return [flash(), ring(5, 8), ring(8, 10), ring(10, 10)];
}

/** The note bullet (centre anchor): an eighth note in gold, wobbling. */
function noteFrames(): Frame[] {
  return [0, 1].map((i) => {
    const b = new PixelBuffer(9, 11);
    b.ellipse(1, 6 + i, 4, 3, BRASS[2]);
    b.set(2, 6 + i, BRASS[3]);
    b.vline(4, 1 + i, 7 + i, BRASS[2]);
    b.line(5, 1 + i, 7, 3 + i, BRASS[2]);
    b.outline(INK);
    return { buf: b, ox: 4, oy: 6 };
  });
}

const A = 'creature/kazoo-drone/';
const FLY = [0, 1, 2, 3];

defineSprite(A + 'idle', () => [drone({ prop: 0 }), drone({ prop: 1, bob: 1 })], { ticksPerFrame: 4 });
defineSprite(A + 'walk', () => FLY.map((i) => drone({ prop: i, bob: i === 1 || i === 2 ? 1 : 0, eye: 'angry' })), { ticksPerFrame: 3 });
defineSprite(A + 'tell', () => FLY.map((i) => withNotes(drone({ prop: i, shake: i % 2 ? 1 : -1, eye: 'glow', buzz: i % 2 }), i % 2)), { ticksPerFrame: 2 });
defineSprite(A + 'attack', () => [drone({ prop: 0, eye: 'glow', dive: true }), drone({ prop: 2, eye: 'glow', dive: true, buzz: 1 })], { ticksPerFrame: 3 });
defineSprite(A + 'die', popFrames, { durations: [3, 3, 3, 3], loop: false });
defineSprite(A + 'die-blast', () => blastStrip(drone({ eye: 'x', noProps: true }), [2, -5]), { durations: [...BLAST_TIMING], loop: false });
defineSprite(A + 'die-burn', () => burnStrip(drone({ eye: 'x', noProps: true }), [2, -5]), { durations: [...BURN_TIMING], loop: false });
defineSprite(A + 'die-crush', () => crushStrip(drone({ eye: 'x', noProps: true })), { durations: [...CRUSH_TIMING], loop: false });
defineSprite(A + 'note', noteFrames, { ticksPerFrame: 8 });
// SAY CHEESE: it stops in mid-air and flashes a brass grin (the bell flared, props idling).
defineSprite(A + 'photo-pose', () => [drone({ prop: 1, buzz: 1 })], { ticksPerFrame: 60 });
