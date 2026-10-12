/**
 * `creature/windup-bot/…` — the Wind-Up Bandbot (GDD §9.3): a tin toy robot with a big brass
 * wind-up key on its back, a tiny crimson drum on its chest and two drumsticks; one lamp eye under
 * a crimson-painted dome. 16×18, anchored at the feet. Variants share one body: `ski-*` strips add
 * tiny skis (m3), `fly-*` strips turn the key into a propeller on its head (m5).
 *
 * Strips: idle (2), walk (4, marching in step), tell (4: the key spins, it shakes, the eye glows),
 * attack (2: about to burst), dance (4: the anthem), alert, die (5: the head pops up on a spring,
 * cogs fly), die-blast, die-burn, die-crush, ski (2), ski-tell (4), fly (4), fly-die (3),
 * key (4: the key spinning away), cog (2: a small cog particle).
 */
import { INK, PAL } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineSprite } from '../../../engine/sprites';
import { BLAST_TIMING, BURN_TIMING, CRUSH_TIMING, FLAT, Sketch, blastStrip, burnStrip, crushStrip, xEye } from './draw';

const TIN = PAL.steel;
const PAINT = PAL.red;
const BRASS = PAL.gold;

export type BotLegs = 'stand' | 'stepL' | 'stepR' | 'ski' | 'dangle' | 'kickL' | 'kickR';
export type BotKey = 'back' | 'top' | 'none';

export interface BotPose {
  legs?: BotLegs;
  /** Key turn phase 0..3 (0 / 2 wide, 1 / 3 edge-on). */
  key?: number;
  keyAt?: BotKey;
  /** Drumstick: 0 raised, 1 on the drum. */
  stick?: number;
  /** Both arms up (dance) — 0 none, 1 left up, 2 right up. */
  dance?: number;
  /** Whole-body shake offset (px) and bob (px down). */
  shake?: number;
  bob?: number;
  eye?: 'lamp' | 'glow' | 'x' | 'shut';
  /** Death: the head rises on a spring by this many px. */
  spring?: number;
  /** Lean forward (skiing). */
  lean?: number;
}

const W = 34;
const H = 34;
const OX = 17;
const OY = 31;

/** One bandbot frame (facing right). */
export function bot(p: BotPose = {}): Frame {
  const legs = p.legs ?? 'stand';
  const sx = p.shake ?? 0;
  const bob = (p.bob ?? 0) + (legs === 'ski' ? 2 : 0) + (legs === 'dangle' ? -3 : 0);
  const spring = p.spring ?? 0;
  const lean = p.lean ?? 0;
  const s = new Sketch(W, H, OX, OY);
  const body = -4 + bob;
  const keyAt = p.keyAt ?? 'back';
  // Key behind the body (on the back).
  if (keyAt === 'back') {
    const ph = (p.key ?? 0) & 3;
    s.add(BRASS, (b, X, Y) => {
      b.rect(X(-9 + sx), Y(body - 6), 4, 2, FLAT);
      if (ph === 0 || ph === 2) {
        b.ellipse(X(-13 + sx), Y(body - 12), 5, 6, FLAT);
        b.ellipse(X(-13 + sx), Y(body - 5), 5, 6, FLAT);
      } else {
        b.rect(X(-12 + sx), Y(body - 11), 2, 11, FLAT);
      }
    }, { glint: true });
    if (ph === 0 || ph === 2) {
      s.detail((b, X, Y) => {
        b.rect(X(-12 + sx), Y(body - 10), 3, 2, BRASS[0]);
        b.rect(X(-12 + sx), Y(body - 3), 3, 2, BRASS[0]);
      });
    }
  }
  // Far leg / far arm.
  const legY = 0;
  const legX = (side: number, phase: BotLegs): [number, number, number] => {
    // returns [x, top, bottom] of a leg
    const up = (phase === 'stepL' && side < 0) || (phase === 'stepR' && side > 0) ? 2 : 0;
    const kick = (phase === 'kickL' && side < 0) || (phase === 'kickR' && side > 0) ? 3 : 0;
    return [side * 2 + kick + sx, body, legY - up - (phase === 'dangle' ? 1 : 0)];
  };
  const drawLeg = (side: number, shift: number): void => {
    const [x, top, bot] = legX(side, legs);
    s.add(TIN, (b, X, Y) => {
      if (legs === 'ski') {
        b.rect(X(x - 1), Y(top), 3, 2, FLAT);
        b.rect(X(x - 2 + side), Y(top + 1), 3, 2, FLAT);
      } else b.rect(X(x - 1), Y(top), 3, bot - top, FLAT);
    }, { shift, base: 1 });
    s.add(PAL.black, (b, X, Y) => {
      if (legs === 'dangle') b.rect(X(x - 1), Y(bot - 1), 3, 2, FLAT);
      else b.rect(X(x - 1), Y(Math.min(bot, legs === 'ski' ? top + 4 : bot) - 2), 4, 2, FLAT);
    }, { shift, glint: true });
  };
  drawLeg(-1, -1);
  // Skis under the feet: a long red plank with an upturned tip.
  if (legs === 'ski') {
    s.add(PAINT, (b, X, Y) => {
      b.rect(X(-9 + sx), Y(-2 + bob - 2), 18, 2, FLAT);
      b.rect(X(9 + sx), Y(-5 + bob - 2), 2, 3, FLAT);
    }, { base: 2 });
  }
  drawLeg(1, 0);
  // Body: a tin barrel with a crimson paint band and gold rivets.
  const bx = -6 + sx + lean;
  s.add(TIN, (b, X, Y) => b.roundRect(X(bx), Y(body - 10), 12, 10, 2, FLAT), { glint: true, base: 2 });
  s.detail((b, X, Y) => {
    b.rect(X(bx + 1), Y(body - 7), 10, 3, PAINT[2]);
    b.hline(X(bx + 1), X(bx + 10), Y(body - 7), PAINT[3]);
    b.hline(X(bx + 1), X(bx + 10), Y(body - 5), PAINT[1]);
    b.set(X(bx + 2), Y(body - 9), BRASS[2]);
    b.set(X(bx + 9), Y(body - 9), BRASS[1]);
    b.set(X(bx + 2), Y(body - 2), BRASS[1]);
  });
  // The tiny drum on the chest (shell, hoops, white head facing forward).
  const dx = bx + 9;
  s.add(PAINT, (b, X, Y) => b.rect(X(dx), Y(body - 9), 4, 6, FLAT), { base: 2 });
  s.detail((b, X, Y) => {
    b.hline(X(dx), X(dx + 3), Y(body - 9), BRASS[2]);
    b.hline(X(dx), X(dx + 3), Y(body - 4), BRASS[1]);
  });
  s.add(PAL.snow, (b, X, Y) => b.rect(X(dx + 4), Y(body - 9), 2, 6, FLAT), { base: 2, ring: false });
  // Head: a tin dome with a crimson painted brim, a gold knob and one lamp eye.
  const hy = body - 10 - spring;
  if (spring > 0) {
    s.detail((b, X, Y) => {
      for (let y = hy; y < body - 10; y++) b.set(X(sx + (y % 2 === 0 ? -1 : 1)), Y(y), PAL.steel[3]);
    });
  }
  s.add(TIN, (b, X, Y) => b.ellipse(X(-6 + sx + lean), Y(hy - 8), 13, 10, FLAT), { glint: true, base: 2 });
  s.detail((b, X, Y) => {
    b.hline(X(-6 + sx + lean), X(6 + sx + lean), Y(hy - 2), PAINT[2]);
    b.hline(X(-5 + sx + lean), X(5 + sx + lean), Y(hy - 1), PAINT[1]);
    // Eye: a round glass lamp.
    const ex = 2 + sx + lean;
    const ey = hy - 5;
    const e = p.eye ?? 'lamp';
    if (e === 'x') xEye(b, X(ex), Y(ey));
    else if (e === 'shut') b.hline(X(ex - 1), X(ex + 1), Y(ey), INK);
    else {
      b.rect(X(ex - 1), Y(ey - 1), 4, 3, e === 'glow' ? PAL.red[3] : PAL.sky[2]);
      b.set(X(ex - 1), Y(ey - 1), PAL.snow[3]);
      b.hline(X(ex), X(ex + 2), Y(ey + 1), e === 'glow' ? PAL.red[1] : PAL.sky[0]);
    }
  });
  if (keyAt !== 'top') {
    s.add(BRASS, (b, X, Y) => b.circle(X(sx + lean), Y(hy - 9), 1, FLAT), { glint: true });
  } else {
    // Propeller key on top: a shaft and blades in a turning blur.
    const ph = (p.key ?? 0) & 3;
    const span = [7, 4, 7, 2][ph];
    s.add(BRASS, (b, X, Y) => {
      b.rect(X(-1 + sx), Y(hy - 11), 2, 4, FLAT);
      b.rect(X(-span + sx), Y(hy - 12), span * 2 + 1, 2, FLAT);
    }, { glint: true });
  }
  // Near arm and drumstick (or arms up for the dance).
  const stick = p.stick ?? 0;
  const dance = p.dance ?? 0;
  s.add(TIN, (b, X, Y) => {
    const sy = body - 8;
    if (dance === 1 || dance === 2) {
      const up = dance === 1 ? -1 : 1;
      b.capsule(X(-3 + sx), Y(sy), X(-5 + sx), Y(sy - 6 + up), 2, FLAT);
      b.capsule(X(3 + sx), Y(sy), X(5 + sx), Y(sy - 6 - up), 2, FLAT);
    } else b.capsule(X(1 + sx + lean), Y(sy), X(5 + sx + lean), Y(sy + 1 - stick), 2, FLAT);
  }, { base: 2 });
  s.detail((b, X, Y) => {
    const sy = body - 8;
    if (dance === 0) {
      // Gold drumstick from the hand to the drum head (down) or raised (up).
      const hx = 5 + sx + lean;
      const hy2 = sy + 1 - stick;
      if (stick > 0) b.line(X(hx), Y(hy2), X(hx + 3), Y(hy2 - 3), BRASS[2]);
      else b.line(X(hx), Y(hy2), X(hx + 2), Y(hy2 - 4), BRASS[2]);
    }
  });
  return s.frame({ head: [1 + sx, hy - 4], hand: [5 + sx, body - 7], muzzle: [8 + sx, body - 6] });
}

/** Death: the head pops up on its spring and cogs fly, then the bot slumps. */
function dieFrames(): Frame[] {
  const cogs = (f: Frame, pts: ReadonlyArray<readonly [number, number]>): Frame => {
    const b = f.buf.clone();
    for (const [x, y] of pts) {
      b.circle(f.ox + x, f.oy + y, 1, BRASS[2]);
      b.set(f.ox + x, f.oy + y, BRASS[0]);
    }
    return { ...f, buf: b };
  };
  const slump = (): Frame => {
    const f = bot({ eye: 'x', spring: 4, key: 1 });
    const b = f.buf.rotated(Math.PI / 2 - 0.35, { quality: 'fast' });
    const out = new PixelBuffer(b.w, b.h);
    out.blit(b, 0, 0);
    const t = out.trimBounds();
    return t ? { buf: out, ox: t.x + (t.w >> 1), oy: t.y + t.h } : f;
  };
  return [
    bot({ eye: 'x', shake: 1 }),
    cogs(bot({ eye: 'x', spring: 5, key: 1 }), [[6, -24], [-7, -20]]),
    cogs(bot({ eye: 'x', spring: 8, key: 2 }), [[9, -29], [-10, -26], [3, -31]]),
    cogs(bot({ eye: 'x', spring: 3, key: 3 }), [[11, -20], [-12, -16]]),
    slump(),
  ];
}

/** The key flying off (centre anchor): 4 turning frames. */
function keyFrames(): Frame[] {
  return [0, 1, 2, 3].map((i) => {
    const b = new PixelBuffer(13, 13);
    const k = new PixelBuffer(11, 5);
    k.ellipse(0, 0, 5, 5, BRASS[2]);
    k.ellipse(6, 0, 5, 5, BRASS[2]);
    k.set(2, 2, 0);
    k.set(8, 2, 0);
    k.set(1, 1, BRASS[3]);
    k.set(7, 1, BRASS[3]);
    const r = k.rotated((i * Math.PI) / 4, { quality: 'fast' });
    b.blit(r, 6 - (r.w >> 1), 6 - (r.h >> 1));
    b.outline(INK);
    return { buf: b, ox: 6, oy: 6 };
  });
}

/** A tiny cog particle (centre anchor). */
function cogFrames(): Frame[] {
  return [0, 1].map((i) => {
    const b = new PixelBuffer(7, 7);
    b.circle(3, 3, 2, BRASS[2]);
    b.set(3, 3, BRASS[0]);
    const teeth = i === 0 ? [[3, 0], [0, 3], [6, 3], [3, 6]] : [[1, 1], [5, 1], [1, 5], [5, 5]];
    for (const [x, y] of teeth) b.set(x, y, BRASS[1]);
    b.outline(INK);
    return { buf: b, ox: 3, oy: 3 };
  });
}

const A = 'creature/windup-bot/';
const MARCH: BotLegs[] = ['stepL', 'stand', 'stepR', 'stand'];

defineSprite(A + 'idle', () => [bot({ key: 0 }), bot({ key: 1, eye: 'shut' })], { durations: [40, 6] });
defineSprite(A + 'walk', () => MARCH.map((legs, i) => bot({ legs, key: i, stick: i % 2, bob: legs === 'stand' ? 0 : -1 })), { ticksPerFrame: 8 });
defineSprite(A + 'tell', () => [0, 1, 2, 3].map((i) => bot({ key: i, shake: i % 2 === 0 ? 1 : -1, eye: i % 2 ? 'glow' : 'lamp', stick: 1 })), { ticksPerFrame: 2 });
defineSprite(A + 'attack', () => [bot({ key: 0, eye: 'glow', bob: -1 }), bot({ key: 2, eye: 'glow', shake: 1 })], { ticksPerFrame: 3 });
defineSprite(A + 'alert', () => [bot({ key: 0, bob: -2 }), bot({ key: 1 })], { ticksPerFrame: 6 });
defineSprite(A + 'dance', () => [bot({ dance: 1, legs: 'kickL', key: 0 }), bot({ dance: 2, bob: 1, key: 1 }), bot({ dance: 2, legs: 'kickR', key: 2 }), bot({ dance: 1, bob: 1, key: 3 })], { ticksPerFrame: 8 });
defineSprite(A + 'die', dieFrames, { durations: [4, 5, 6, 6, 24], loop: false });
defineSprite(A + 'die-blast', () => blastStrip(bot({ eye: 'x' }), [2, -19]), { durations: [...BLAST_TIMING], loop: false });
defineSprite(A + 'die-burn', () => burnStrip(bot({ eye: 'shut' }), [1, -19]), { durations: [...BURN_TIMING], loop: false });
defineSprite(A + 'die-crush', () => crushStrip(bot({ eye: 'x' })), { durations: [...CRUSH_TIMING], loop: false });
defineSprite(A + 'ski', () => [bot({ legs: 'ski', key: 0, lean: 1 }), bot({ legs: 'ski', key: 1, lean: 1, bob: 1 })], { ticksPerFrame: 10 });
defineSprite(A + 'ski-tell', () => [0, 1, 2, 3].map((i) => bot({ legs: 'ski', key: i, shake: i % 2 === 0 ? 1 : -1, eye: i % 2 ? 'glow' : 'lamp' })), { ticksPerFrame: 2 });
defineSprite(A + 'fly', () => [0, 1, 2, 3].map((i) => bot({ legs: 'dangle', keyAt: 'top', key: i, bob: i % 2 })), { ticksPerFrame: 3 });
defineSprite(A + 'fly-die', () => [bot({ legs: 'dangle', keyAt: 'top', key: 0, eye: 'x' }), bot({ legs: 'dangle', keyAt: 'top', key: 2, eye: 'x', shake: 1 }), bot({ legs: 'dangle', keyAt: 'none', eye: 'x' })], { durations: [6, 6, 30], loop: false });
defineSprite(A + 'key', keyFrames, { ticksPerFrame: 3 });
defineSprite(A + 'cog', cogFrames, { ticksPerFrame: 4 });
// SAY CHEESE: one arm up, the other on the drum, the key at rest.
defineSprite(A + 'photo-pose', () => [bot({ dance: 1, key: 0, bob: -1 })], { ticksPerFrame: 60 });
