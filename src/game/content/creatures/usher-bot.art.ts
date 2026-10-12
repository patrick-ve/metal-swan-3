/**
 * `creature/usher-bot/…` — the Usher-Bot (GDD §9.3): a tin robot theatre usher in a crimson
 * Legion uniform with gold buttons and an epaulette, black trousers with gold piping, a crimson
 * pillbox hat, a tin head with two lamp eyes and a grille mouth, a flashlight arm (near) and a
 * brass ticket-punch arm (far). 24×36, anchored at the feet.
 *
 * Strips: idle (2), walk (4), tell (2: SHHH! — the punch at its grille, eyes red), attack (2: the
 * punch thrust forward), alert (2), gag-ticket (4: checks an imaginary ticket), gag-polish (4:
 * polishes its flashlight), photo-pose, die (12: the head spins, it prints a long `ADMIT NONE`
 * receipt and folds up), die-left (the same with pre-mirrored receipt letters, for a usher
 * facing left), die-blast, die-burn, die-crush, ticket-dart (the projectile, centre
 * anchor). The flashlight cone is drawn by the game (usher-bot.ts) so it stops at the floor.
 * Points: `lamp` (the flashlight lens), `muzzle` (the ticket punch), `head`.
 */
import type { Color } from '../../../engine/color';
import { drawText } from '../../../engine/font';
import { INK, PAL } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineSprite } from '../../../engine/sprites';
import { BLAST_TIMING, BURN_TIMING, CRUSH_TIMING, FLAT, Sketch, blastStrip, burnStrip, crushStrip, xEye } from './draw';

const TIN = PAL.steel;
const COAT = PAL.red;
const BRASS = PAL.gold;
const PANTS = PAL.black;

const W = 48;
const H = 50;
const OX = 22;
const OY = 46;


export type UsherLegs = 'stand' | 'stepA' | 'stepB';
export type UsherArm = 'down' | 'forward' | 'shush' | 'ticket' | 'polish' | 'wave';
export type UsherEyes = 'lamp' | 'red' | 'x' | 'happy' | 'squint';

export interface UsherPose {
  legs?: UsherLegs;
  /** The far (ticket-punch) arm. */
  punch?: UsherArm;
  /** Flashlight raised to the chest (polish gag) instead of held forward. */
  lampUp?: boolean;
  /** Polishing hand offset (px) for the rub animation. */
  rub?: number;
  eyes?: UsherEyes;
  /** Head spin: 0 face right, 1 face front, 2 back, 3 face left. */
  spin?: number;
  /** Hat lifted off the head (px). */
  hatUp?: number;
  /** Collapse: 0 standing … 3 a folded heap. */
  fold?: number;
  /** Whole-figure bob (px down). */
  bob?: number;
  /** A sparkle on the lamp (polished). */
  sparkle?: boolean;
  /** Receipt printed from the chest slot: length (px), or -1 none; `drape` lets it hang down. */
  receipt?: number;
  /** Pre-flip the receipt's letters (the `die-left` strip, drawn flipped on screen). */
  mirrored?: boolean;
  drape?: boolean;
}

type XY = (v: number) => number;

/** Feet (x offsets) for the far and near leg. */
function feet(l: UsherLegs): [number, number] {
  return l === 'stepA' ? [-5, 3] : l === 'stepB' ? [-1, -1] : [-3, 2];
}

/** One usher-bot frame (facing right). */
export function usher(p: UsherPose = {}): Frame {
  const s = new Sketch(W, H, OX, OY);
  const fold = p.fold ?? 0;
  // Leg length shrinks as it folds; the upper body sinks with it.
  const legH = [11, 7, 3, 1][fold];
  const sink = 11 - legH + (p.bob ?? 0);
  const [farX, nearX] = feet(p.legs ?? 'stand');
  const lift = (p.legs === 'stepA' || p.legs === 'stepB') ? 1 : 0;
  const top = -12 + (11 - legH); // hip line
  // Far leg and shoe.
  s.add(PANTS, (b, X, Y) => b.rect(X(farX), Y(top), 3, legH, FLAT), { shift: -1, base: 1 });
  s.add(TIN, (b, X, Y) => b.rect(X(farX - 1), Y(-2 - (p.legs === 'stepB' ? lift : 0)), 5, 2, FLAT), { shift: -1, glint: true });
  // Far arm: the brass ticket punch.
  const punch = p.punch ?? 'down';
  const sh: [number, number] = [-1, -23 + sink];
  const hand: [number, number] =
    punch === 'forward' ? [11, -16 + sink] : punch === 'shush' ? [5, -28 + sink] : punch === 'ticket' ? [8, -31 + sink] : punch === 'polish' ? [7 + (p.rub ?? 0), -22 + sink] : punch === 'wave' ? [-3, -36 + sink] : [-8, -15 + sink];
  s.add(TIN, (b: PixelBuffer, X: XY, Y: XY) => b.thickLine(X(sh[0]), Y(sh[1]), X(hand[0]), Y(hand[1]), 2, FLAT), { shift: -1, base: 1 });
  s.add(BRASS, (b, X, Y) => {
    if (punch === 'forward') {
      b.rect(X(hand[0]), Y(hand[1] - 1), 4, 3, FLAT);
      b.rect(X(hand[0] + 4), Y(hand[1]), 2, 1, FLAT);
    } else b.rect(X(hand[0] - 1), Y(hand[1] - 1), 3, 4, FLAT);
  }, { glint: true });
  if (punch === 'ticket') {
    // The imaginary ticket: a small cream stub with a crimson stripe.
    s.flat(PAL.cloth[2], (b, X, Y) => b.rect(X(hand[0] + 1), Y(hand[1] - 4), 4, 3, FLAT));
    s.detail((b, X, Y) => b.hline(X(hand[0] + 1), X(hand[0] + 4), Y(hand[1] - 3), COAT[2]));
  }
  // Near leg and shoe.
  s.add(PANTS, (b, X, Y) => b.rect(X(nearX), Y(top), 3, legH, FLAT), { base: 1 });
  s.detail((b, X, Y) => b.vline(X(nearX + 2), Y(top), Y(top + legH - 1), BRASS[1]));
  s.add(TIN, (b, X, Y) => b.rect(X(nearX - 1), Y(-2 - (p.legs === 'stepA' ? lift : 0)), 5, 2, FLAT), { glint: true });
  // Jacket: a crimson tunic with short tails, gold buttons, piping and an epaulette.
  const jy = -25 + sink;
  s.add(COAT, (b, X, Y) => {
    b.roundRect(X(-7), Y(jy), 14, 14, 2, FLAT);
    b.rect(X(-8), Y(jy + 11), 5, 3, FLAT);
  }, { glint: true });
  s.detail((b, X, Y) => {
    for (const by of [3, 6, 9]) b.set(X(4), Y(jy + by), BRASS[3]);
    b.hline(X(-6), X(5), Y(jy + 12), BRASS[1]);
    b.rect(X(-3), Y(jy), 5, 2, BRASS[2]);
    b.hline(X(-3), X(1), Y(jy + 1), BRASS[1]);
    // The ticket slot on the chest (the receipt comes out here).
    b.hline(X(1), X(5), Y(jy + 7), INK);
    // White collar.
    b.hline(X(-2), X(4), Y(jy - 1), PAL.snow[2]);
  });
  // Head: a tin box with rounded corners, a dark visor, two lamp eyes and a grille.
  const hy = -35 + sink;
  const spin = (p.spin ?? 0) & 3;
  s.add(TIN, (b, X, Y) => b.roundRect(X(-6), Y(hy), 12, 10, 3, FLAT), { glint: true, base: 3 });
  s.detail((b, X, Y) => {
    const eyes = p.eyes ?? 'lamp';
    if (spin === 2) {
      // The back of the head: a panel and a winding screw.
      b.rect(X(-3), Y(hy + 3), 6, 4, TIN[1]);
      b.set(X(0), Y(hy + 5), BRASS[2]);
      return;
    }
    const fx = spin === 0 ? 0 : spin === 1 ? -3 : -6;
    b.rect(X(fx), Y(hy + 2), 6, 4, PAL.navy[0]);
    const eye = (ex: number): void => {
      if (eyes === 'x') xEye(b, X(ex), Y(hy + 4), PAL.snow[3]);
      else if (eyes === 'happy') {
        b.set(X(ex - 1), Y(hy + 4), BRASS[3]);
        b.set(X(ex), Y(hy + 3), BRASS[3]);
        b.set(X(ex + 1), Y(hy + 4), BRASS[3]);
      } else if (eyes === 'squint') b.hline(X(ex - 1), X(ex), Y(hy + 4), BRASS[3]);
      else {
        const c: Color = eyes === 'red' ? COAT[3] : BRASS[3];
        b.rect(X(ex - 1), Y(hy + 3), 2, 2, c);
        b.set(X(ex - 1), Y(hy + 3), PAL.snow[3]);
      }
    };
    eye(fx + 2);
    eye(fx + 5);
    // Grille mouth.
    const mx = fx + 2;
    for (let i = 0; i < 3; i++) b.set(X(mx + i), Y(hy + 7), i === 1 && p.punch === 'shush' ? INK : TIN[0]);
    b.set(X(mx + 1), Y(hy + 8), TIN[1]);
  });
  // Pillbox hat: crimson with a gold band and a gold button.
  const up = p.hatUp ?? 0;
  s.add(COAT, (b, X, Y) => b.rect(X(-5), Y(hy - 4 - up), 8, 5, FLAT), { glint: true });
  s.detail((b, X, Y) => {
    b.hline(X(-5), X(2), Y(hy - up), BRASS[2]);
    b.set(X(-1), Y(hy - 5 - up), BRASS[3]);
  });
  // Near arm and the flashlight (held forward, or up at the chest to be polished).
  const lampUp = !!p.lampUp;
  const lh: [number, number] = lampUp ? [4, -20 + sink] : [9, -19 + sink];
  // A crimson sleeve with a gold cuff, then the tin forearm.
  const el: [number, number] = lampUp ? [3, -16 + sink] : [5, -19 + sink];
  s.add(TIN, (b, X, Y) => b.thickLine(X(el[0]), Y(el[1]), X(lh[0]), Y(lh[1]), 2, FLAT), { base: 2 });
  s.add(COAT, (b, X, Y) => b.thickLine(X(1), Y(-22 + sink), X(el[0]), Y(el[1]), 3, FLAT), { glint: true });
  s.detail((b, X, Y) => b.set(X(el[0]), Y(el[1]), BRASS[2]));
  const fl = lampUp ? [lh[0] - 1, lh[1] - 6] : [lh[0], lh[1] - 1];
  s.add(PAL.slate, (b, X, Y) => {
    if (lampUp) b.rect(X(fl[0]), Y(fl[1]), 3, 7, FLAT);
    else b.rect(X(fl[0]), Y(fl[1]), 7, 3, FLAT);
  }, { glint: true });
  s.add(BRASS, (b, X, Y) => {
    if (lampUp) b.rect(X(fl[0] - 1), Y(fl[1] - 2), 5, 2, FLAT);
    else b.rect(X(fl[0] + 7), Y(fl[1] - 1), 2, 5, FLAT);
  }, { glint: true });
  s.detail((b, X, Y) => {
    if (lampUp) b.hline(X(fl[0]), X(fl[0] + 2), Y(fl[1] - 3), PAL.snow[3]);
    else b.vline(X(fl[0] + 9), Y(fl[1]), Y(fl[1] + 2), PAL.snow[3]);
    if (p.sparkle) {
      const sx = lampUp ? fl[0] + 4 : fl[0] + 11;
      const sy = lampUp ? fl[1] - 5 : fl[1] - 3;
      b.set(X(sx), Y(sy), PAL.snow[3]);
      b.set(X(sx - 1), Y(sy + 1), PAL.snow[2]);
      b.set(X(sx + 1), Y(sy + 1), PAL.snow[2]);
      b.set(X(sx), Y(sy + 2), PAL.snow[3]);
    }
  });
  const lamp: [number, number] = lampUp ? [fl[0] + 1, fl[1] - 4] : [fl[0] + 10, fl[1] + 1];
  const f = s.frame({ lamp, muzzle: punch === 'forward' ? [hand[0] + 6, hand[1]] : [12, -16 + sink], head: [0, hy - 2] });
  return p.receipt !== undefined && p.receipt >= 0 ? withReceipt(f, p.receipt, sink, !!p.drape, !!p.mirrored) : f;
}

/** The receipt's printed text (GDD §9.3). */
const RECEIPT = 'ADMIT NONE';

/**
 * The paper strip with `ADMIT NONE`, cut to `len` px (printed so far). `mirrored` pre-flips the
 * letters for the `die-left` strip: a usher facing left is drawn flipped, so its receipt must
 * still read left to right on screen.
 */
function receiptStrip(len: number, mirrored = false): PixelBuffer {
  const full = new PixelBuffer(64, 11);
  full.rect(0, 0, 64, 11, PAL.cloth[3]);
  full.hline(0, 63, 10, PAL.cloth[1]);
  // Perforation dots along the top edge.
  for (let x = 1; x < 64; x += 3) full.set(x, 0, PAL.cloth[1]);
  if (!mirrored) drawText(full, RECEIPT, 4, 2, { color: INK });
  else {
    const text = new PixelBuffer(60, 8);
    drawText(text, RECEIPT, 0, 0, { color: INK });
    full.blit(text, 4, 2, { flipX: true });
  }
  const cut = Math.max(1, Math.min(64, Math.round(len)));
  const out = new PixelBuffer(cut + 2, 13);
  out.blit(full.crop(64 - cut, 0, cut, 11), 1, 1);
  out.outline(INK);
  return out;
}

/** Add the receipt to a frame: out of the chest slot (straight), or draped down to the floor. */
function withReceipt(f: Frame, len: number, sink: number, drape: boolean, mirrored: boolean): Frame {
  const strip = receiptStrip(len, mirrored);
  const padR = strip.w + 4;
  const buf = f.buf.padded(0, 0, padR, 0);
  const slotX = f.ox + 5;
  if (!drape) buf.blit(strip, slotX, f.oy - 25 + sink + 6, {});
  else buf.blit(strip, slotX + 2, f.oy - strip.h + 1, {});
  return { buf, ox: f.ox, oy: f.oy, pts: f.pts };
}

/** Death: hit, the head spins once, the receipt prints, it folds up with the receipt on the floor. */
function dieFrames(mirrored = false): Frame[] {
  return dieParts().map((p) => usher(p.receipt !== undefined ? { ...p, mirrored } : p));
}

/** The 12 death poses (shared by `die` and `die-left`). */
function dieParts(): UsherPose[] {
  return [
    { eyes: 'x', hatUp: 3, punch: 'wave' },
    { eyes: 'x', spin: 1, hatUp: 2 },
    { eyes: 'x', spin: 2, hatUp: 1 },
    { eyes: 'x', spin: 3 },
    { eyes: 'x', spin: 0, receipt: 10 },
    { eyes: 'x', receipt: 28 },
    { eyes: 'x', receipt: 46 },
    { eyes: 'x', receipt: 64 },
    { eyes: 'x', receipt: 64, fold: 1 },
    { eyes: 'x', receipt: 64, fold: 2, drape: true },
    { eyes: 'x', receipt: 64, fold: 3, drape: true, hatUp: -1 },
    { eyes: 'x', receipt: 64, fold: 3, drape: true, hatUp: -1 },
  ];
}

/** The ticket dart: a cream stub with a crimson stripe and a brass tip. */
function ticketDart(): Frame {
  const b = new PixelBuffer(9, 6);
  b.rect(1, 1, 6, 4, PAL.cloth[3]);
  b.vline(3, 1, 4, COAT[2]);
  b.rect(7, 2, 1, 2, BRASS[3]);
  b.set(1, 1, PAL.cloth[1]);
  b.set(1, 4, PAL.cloth[1]);
  b.outline(INK);
  return { buf: b.padded(1), ox: 5, oy: 4 };
}

const A = 'creature/usher-bot/';

defineSprite(A + 'idle', () => [usher(), usher({ bob: 1 })], { ticksPerFrame: 24 });
defineSprite(A + 'walk', () => [usher({ legs: 'stepA' }), usher({ legs: 'stand', bob: 1 }), usher({ legs: 'stepB' }), usher({ legs: 'stand', bob: 1 })], { ticksPerFrame: 10 });
defineSprite(A + 'tell', () => [usher({ punch: 'shush', eyes: 'red' }), usher({ punch: 'shush', eyes: 'red', bob: 1 })], { ticksPerFrame: 6 });
defineSprite(A + 'attack', () => [usher({ punch: 'forward', eyes: 'red' }), usher({ punch: 'forward', eyes: 'lamp', bob: 1 })], { ticksPerFrame: 8, loop: false });
defineSprite(A + 'alert', () => [usher({ eyes: 'lamp', hatUp: 2 }), usher({ eyes: 'lamp' })], { ticksPerFrame: 6 });
defineSprite(A + 'gag-ticket', () => [usher({ punch: 'ticket' }), usher({ punch: 'ticket', eyes: 'squint' }), usher({ punch: 'ticket', eyes: 'squint', bob: 1 }), usher({ punch: 'ticket', eyes: 'happy' })], { durations: [24, 18, 18, 22] });
defineSprite(A + 'gag-polish', () => [usher({ punch: 'polish', lampUp: true, rub: -2 }), usher({ punch: 'polish', lampUp: true, rub: 1 }), usher({ punch: 'polish', lampUp: true, rub: -2 }), usher({ lampUp: true, eyes: 'happy', sparkle: true })], { durations: [8, 8, 8, 30] });
defineSprite(A + 'gag', () => [usher({ punch: 'ticket' }), usher({ punch: 'ticket', eyes: 'squint' }), usher({ punch: 'ticket', eyes: 'squint', bob: 1 }), usher({ punch: 'ticket', eyes: 'happy' })], { durations: [24, 18, 18, 22] });
defineSprite(A + 'photo-pose', () => usher({ punch: 'wave', eyes: 'happy' }));
const DIE_DURATIONS = [6, 4, 4, 4, 4, 4, 4, 10, 6, 6, 10, 2];
defineSprite(A + 'die', () => dieFrames(), { durations: DIE_DURATIONS, loop: false });
// The same death for a usher facing left: the receipt's letters are pre-mirrored.
defineSprite(A + 'die-left', () => dieFrames(true), { durations: DIE_DURATIONS, loop: false });
defineSprite(A + 'die-blast', () => blastStrip(usher({ eyes: 'x', hatUp: 4 }), [2, -32]), { durations: [...BLAST_TIMING], loop: false });
defineSprite(A + 'die-burn', () => burnStrip(usher({ eyes: 'squint' }), [2, -32]), { durations: [...BURN_TIMING], loop: false });
defineSprite(A + 'die-crush', () => crushStrip(usher({ eyes: 'x' })), { durations: [...CRUSH_TIMING], loop: false });
defineSprite(A + 'ticket-dart', ticketDart);
