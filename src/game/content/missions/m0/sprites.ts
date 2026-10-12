/**
 * Mission m0 (test range) sprites: the test boss CRATE COLOSSUS and a few range props.
 * Procedural pixel art from the palette and the machines kit (docs/ART_GUIDE.md §6).
 *
 * - `boss/crate-colossus/body`   3 frames = damage states 0 / 1 / 2 (feet anchor, faces right)
 * - `boss/crate-colossus/hatch`  3 frames = closed / half open / open (same anchor as the body)
 * - `boss/crate-colossus/turret` 6 frames = barrel elevation −15°, 0°, 22.5° … 90°
 *                                (anchor = the base of the dome, which sits on the body's roof)
 * - `decor/m0/sign`              4 frames: UPPER ↑, LOWER →, TEST RANGE, BOSS →
 * - `decor/m0/target`            a range target on a stand
 */
import { drawText, measure } from '../../../../engine/font';
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { barrel, damage, hazard, plate, rivet } from '../../../art/machines';

/** Body size and the turret mount (relative to the feet anchor, facing right). */
export const COLOSSUS = {
  w: 80,
  h: 66,
  /** Roof of the crate (the turret stands on it). */
  roofY: -58,
  /** Turret pivot above the roof and barrel length (for muzzle positions). */
  pivotY: -8,
  barrelLen: 26,
  /** Front hatch box (relative to the feet anchor, facing right). */
  hatch: { x: 10, y: -42, w: 16, h: 24 },
  /** Elevation of turret frame i (degrees, + = up). */
  turretAngles: [-15, 0, 22.5, 45, 67.5, 90] as readonly number[],
} as const;

const W = COLOSSUS.w;
const H = COLOSSUS.h;

/** The crate body: wooden planks, steel straps, a crimson panel with a gold crest, a steel door. */
function body(state: number): Frame {
  const b = new PixelBuffer(W, H);
  const wood = PAL.brown;
  // Skids.
  b.blit(plate(20, 6, 'steel', { rivets: 'none' }), 8, 58);
  b.blit(plate(20, 6, 'steel', { rivets: 'none' }), 52, 58);
  // Crate box 72×50 with a lit top face.
  b.rect(4, 8, 72, 50, wood[2]);
  b.rect(4, 8, 72, 3, wood[3]);
  for (let y = 18; y < 56; y += 8) b.hline(5, 74, y, wood[1]);
  for (let x = 22; x < 74; x += 18) for (let y = 11; y < 56; y += 8) b.vline(x + ((y >> 3) % 2) * 6, y + 1, Math.min(y + 7, 56), wood[1]);
  b.vline(75, 8, 57, wood[0]);
  b.hline(4, 75, 57, wood[0]);
  // Steel straps with rivets (top rim, bottom rim, two uprights).
  const steel = PAL.steel;
  for (const [x, y, w, h] of [[4, 8, 72, 3], [4, 53, 72, 4], [8, 8, 4, 49], [68, 8, 4, 49]] as const) {
    b.rect(x, y, w, h, steel[2]);
    b.hline(x, x + w - 1, y, steel[3]);
    b.hline(x, x + w - 1, y + h - 1, steel[1]);
  }
  for (let y = 14; y < 52; y += 7) {
    rivet(b, 9, y, steel);
    rivet(b, 69, y, steel);
  }
  for (let x = 14; x < 66; x += 8) rivet(b, x, 54, steel);
  // Crimson panel with a gold crest (a round horn crossed with a baton).
  b.rect(16, 16, 26, 32, PAL.red[1]);
  b.rect(17, 17, 24, 30, PAL.red[2]);
  b.hline(17, 40, 17, PAL.red[3]);
  b.vline(17, 18, 46, PAL.red[3]);
  b.circle(29, 31, 7, PAL.gold[2], false);
  b.circle(29, 31, 4, PAL.gold[1], false);
  b.circle(29, 31, 1, PAL.gold[3]);
  b.line(21, 40, 38, 23, PAL.gold[3]);
  b.line(22, 40, 39, 23, PAL.gold[1]);
  // Warning stripes under the roof, a hazard band on the door.
  b.blit(hazard(22, 3, { stripe: 2 }), 44, 12);
  // The front door (the hatch overlay replaces it when it opens).
  b.blit(plate(16, 24, 'steel', { rivets: 'corners' }), 50, 24);
  b.rect(53, 29, 10, 2, INK);
  b.blit(hazard(16, 2, { stripe: 2 }), 50, 44);
  let out = b.outline(INK);
  if (state > 0) out = damage(out, state === 1 ? 0.35 : 0.85, 17 + state);
  return { buf: out, ox: W >> 1, oy: H };
}

/** Hatch overlay: 0 = nothing (closed door is part of the body), 1 = half open, 2 = open. */
function hatch(state: number): Frame {
  const b = new PixelBuffer(W, H);
  if (state > 0) {
    // Dark interior with a glowing core.
    b.rect(50, 24, 16, 24, PAL.ink[0]);
    b.rect(51, 25, 14, 22, PAL.navy[0]);
    b.circle(58, 36, 4, PAL.gold[1]);
    b.circle(58, 36, 2, PAL.gold[3]);
    if (state === 1) {
      // Door swinging out (seen narrow).
      b.blit(plate(7, 24, 'steel', { rivets: 'none' }), 64, 24);
    } else {
      // Door folded down into a ramp.
      b.blit(plate(16, 5, 'steel', { rivets: 'none' }), 62, 55);
      b.blit(hazard(14, 2, { stripe: 2 }), 63, 56);
    }
  }
  return { buf: state > 0 ? b.outline(INK) : b, ox: W >> 1, oy: H };
}

const TW = 64;
const PIVOT_X = 32;
const PIVOT_Y = 32;

/** Turret: a brass dome with a crimson band and a bell-mouthed barrel at `deg` elevation. */
function turret(deg: number): Frame {
  // Barrel drawn pointing right from the pivot, then rotated about the buffer centre.
  const g = new PixelBuffer(TW, TW);
  g.blit(barrel(COLOSSUS.barrelLen - 3, 4, 'steel'), PIVOT_X, PIVOT_Y - 3);
  // Brass bell flare at the muzzle.
  const fx = PIVOT_X + COLOSSUS.barrelLen - 4;
  g.rect(fx, PIVOT_Y - 5, 2, 10, PAL.gold[2]);
  g.rect(fx + 2, PIVOT_Y - 6, 2, 12, PAL.gold[3]);
  g.vline(fx + 3, PIVOT_Y - 5, PIVOT_Y + 4, PAL.gold[1]);
  const rot = deg === 0 ? g : g.rotated((-deg * Math.PI) / 180, { quality: 'smooth' });
  const b = new PixelBuffer(TW, TW);
  // A rotated buffer can be larger than the source: keep the centres (the pivot) aligned.
  b.blit(rot, (TW - rot.w) >> 1, (TW - rot.h) >> 1);
  // Dome (drawn over the barrel root) on a steel ring.
  b.ellipse(PIVOT_X - 15, PIVOT_Y - 8, 31, 18, PAL.gold[1]);
  b.ellipse(PIVOT_X - 14, PIVOT_Y - 8, 29, 16, PAL.gold[2]);
  b.ellipse(PIVOT_X - 11, PIVOT_Y - 7, 14, 7, PAL.gold[3]);
  b.rect(PIVOT_X - 16, PIVOT_Y + 1, 33, 3, PAL.red[2]);
  b.hline(PIVOT_X - 16, PIVOT_X + 16, PIVOT_Y + 1, PAL.red[3]);
  b.rect(PIVOT_X - 17, PIVOT_Y + 4, 35, 4, PAL.steel[2]);
  b.hline(PIVOT_X - 17, PIVOT_X + 17, PIVOT_Y + 4, PAL.steel[3]);
  b.hline(PIVOT_X - 17, PIVOT_X + 17, PIVOT_Y + 7, PAL.steel[1]);
  // Clear everything below the ring (the rotated barrel must not poke through the roof).
  b.rect(0, PIVOT_Y + 8, TW, TW - PIVOT_Y - 8, 0);
  return { buf: b.outline(INK), ox: PIVOT_X, oy: PIVOT_Y + 8 };
}

/** A wooden sign on a post with small-font text. */
function sign(text: string): Frame {
  const w = Math.max(36, (measure(text, 'small') + 9) & ~1);
  const b = new PixelBuffer(w + 2, 30);
  b.rect(w / 2 - 1, 13, 3, 16, PAL.brown[1]);
  b.vline(w / 2 - 1, 13, 28, PAL.brown[2]);
  b.rect(1, 1, w, 13, PAL.brown[2]);
  b.hline(1, w, 1, PAL.brown[3]);
  b.hline(1, w, 13, PAL.brown[0]);
  drawText(b, text, 1 + w / 2, 4, { font: 'small', color: PAL.snow[3], align: 'center' });
  return { buf: b.outline(INK), ox: (w + 2) >> 1, oy: 30 };
}

/** A round range target on two legs. */
function target(): Frame {
  const b = new PixelBuffer(26, 34);
  b.line(7, 20, 4, 33, PAL.brown[1]);
  b.line(18, 20, 21, 33, PAL.brown[1]);
  b.circle(12, 12, 10, PAL.snow[2]);
  b.circle(12, 12, 8, PAL.red[2]);
  b.circle(12, 12, 6, PAL.snow[3]);
  b.circle(12, 12, 4, PAL.red[2]);
  b.circle(12, 12, 1, PAL.gold[3]);
  return { buf: b.padded(1).outline(INK), ox: 14, oy: 36 };
}

defineSprite('boss/crate-colossus/body', () => [0, 1, 2].map(body), { ticksPerFrame: 60 });
defineSprite('boss/crate-colossus/hatch', () => [0, 1, 2].map(hatch), { ticksPerFrame: 60 });
defineSprite('boss/crate-colossus/turret', () => COLOSSUS.turretAngles.map(turret), { ticksPerFrame: 60 });
defineSprite('decor/m0/sign', () => ['UPPER ↑', 'LOWER →', 'TEST RANGE', 'BOSS →'].map(sign), { ticksPerFrame: 60 });
defineSprite('decor/m0/target', () => [target()], { ticksPerFrame: 60 });
