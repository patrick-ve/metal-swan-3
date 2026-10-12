/**
 * `machine/baton-copter/…` — the Baton Copter (GDD §9.2): a one-seat gyrocopter. An egg-shaped
 * crimson pod with a gold stripe and the Legion crest, an open cockpit with the pilot (leather
 * flying helmet with a white plume), a gold mast, and for a rotor a giant spinning conductor's
 * baton (a white stick with a cork grip). A brass bell under the pod is the gun (the notes come
 * out of it); two skids, a short tail boom with a fin.
 *
 * Centre anchor (the hull centre), facing right, about 48 × 36 (`COPTER.w/h`); the bell mouth at
 * x +3, y +15 (`COPTER.gunDx/gunDy`); the skids at y +18 (`COPTER.skids`).
 * Strips: `body` (8: the baton turns), `tell` (8: the pilot raises his stick), `fire` (2: the
 * bell flashes), `body-dmg` / `tell-dmg`, `spin` (8: the empty copter spinning down like a
 * sycamore seed), `note-bullet` (2, centre: a gold eighth note).
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { glass } from '../../../art/machines';
import type { Pose } from '../../../art/humanoid';
import { pilotSeated } from './crew.art';
import { crest, dented, frame } from './kit.art';

const A = 'machine/baton-copter';
const W = 60;
const H = 52;
const CX = 30;
const CY = 31;
const X = (x: number): number => CX + x;
const Y = (y: number): number => CY + y;

/** Rotor hub height (local y) and half length of the baton. */
const HUB = -27;
const HALF = 22;

/** The spinning baton: phase 0..7 = 0°..315° of a turn; the cork grip is at one end. */
function baton(b: PixelBuffer, phase: number): void {
  const ang = ((phase & 7) * Math.PI) / 4;
  const k = Math.cos(ang);
  // Blur: a faint dotted line over the whole sweep.
  for (let x = -HALF; x <= HALF; x++) if (((x + phase) & 3) === 0) b.set(X(x), Y(HUB), PAL.snow[1]);
  // The stick: from the grip end (at +k·HALF) to the thin tip (at −k·HALF).
  const grip = Math.round(k * HALF);
  const tip = -grip;
  const lo = Math.min(grip, tip);
  const hi = Math.max(grip, tip);
  for (let x = lo; x <= hi; x++) {
    b.set(X(x), Y(HUB), PAL.snow[3]);
    if (Math.abs(x - grip) < Math.abs(grip - tip) * 0.45) b.set(X(x), Y(HUB) + 1, PAL.snow[1]);
  }
  // The cork grip: a fat brown bulb at its end (seen as a dot when edge-on).
  const gx = X(grip);
  const gs = Math.abs(k) > 0.3 ? Math.sign(k) : 0;
  b.rect(gx - 1 - (gs < 0 ? 1 : 0), Y(HUB) - 1, 3, 3, PAL.brown[2]);
  b.set(gx - (gs < 0 ? 1 : 0), Y(HUB) - 1, PAL.brown[3]);
  b.set(gx + (gs < 0 ? 0 : 1), Y(HUB) + 1, PAL.brown[1]);
  // Hub.
  b.rect(X(-1), Y(HUB) - 1, 3, 3, PAL.gold[2]);
  b.set(X(-1), Y(HUB) - 1, PAL.gold[3]);
}

/** Inside test for the egg-shaped pod (local coordinates). */
function inPod(x: number, y: number): boolean {
  const u = (x - 1) / 14;
  const v = (y - 5) / (y < 5 ? 8 : 7.5);
  return u * u + v * v <= 1 && y >= -1;
}

/** The copter. `pilot` = the pose of the pilot (null = the seat is empty), `flash` = the bell glows. */
function copterBody(phase: number, pilot: Pose | null, flash: boolean, stick?: 'up' | 'down'): PixelBuffer {
  const b = new PixelBuffer(W, H);
  const red = PAL.red;
  const gold = PAL.gold;

  // Mast (gold pole) behind the pilot.
  b.vline(X(-3), Y(HUB), Y(0), gold[1]);
  b.vline(X(-2), Y(HUB), Y(0), gold[2]);
  b.set(X(-3), Y(HUB + 6), gold[3]);

  // The tail boom and the fin.
  b.rect(X(-24), Y(3), 12, 3, red[1]);
  b.hline(X(-24), X(-13), Y(3), red[3]);
  b.poly(
    [
      [X(-27), Y(6)],
      [X(-27), Y(-6)],
      [X(-23), Y(-6)],
      [X(-20), Y(3)],
      [X(-20), Y(6)],
    ],
    red[2],
  );
  b.vline(X(-27), Y(-6), Y(5), red[3]);
  b.hline(X(-26), X(-21), Y(-2), gold[2]);

  // The pilot (upper body, hip at y +4), then the pod over his lap.
  if (pilot) {
    const f = pilotSeated(pilot, stick);
    b.blit(f.buf, X(1) - f.ox, Y(4) - f.oy);
  }
  for (let y = -2; y <= 13; y++) {
    for (let x = -14; x <= 16; x++) {
      if (!inPod(x, y)) continue;
      const top = !inPod(x, y - 1);
      const left = !inPod(x - 1, y);
      const bottom = !inPod(x, y + 1);
      const right = !inPod(x + 1, y);
      let c = red[2];
      if (top || left) c = red[3];
      else if (bottom || right || y > 9) c = red[1];
      b.set(X(x), Y(y), c);
    }
  }
  // The cockpit rim (gold), the windscreen, the stripe, the crest.
  b.hline(X(-9), X(10), Y(-1), gold[3]);
  b.hline(X(-9), X(10), Y(0), gold[1]);
  b.blit(glass(4, 6, { bars: 0 }), X(9), Y(-6));
  b.hline(X(-12), X(14), Y(7), gold[2]);
  crest(b, X(-4), Y(4));

  // The brass bell under the pod (its mouth at y +15): it glows white-gold when it fires.
  for (let y = 0; y < 5; y++) {
    const half = y < 2 ? 1 : y < 4 ? 2 : 3;
    for (let x = -half; x <= half; x++) b.set(X(3) + x, Y(11) + y, x < 0 ? gold[3] : x === half ? gold[1] : gold[2]);
  }
  if (flash) {
    b.hline(X(1), X(5), Y(15), PAL.snow[3]);
    b.hline(X(2), X(4), Y(16), gold[3]);
  } else b.hline(X(1), X(5), Y(15), PAL.brown[0]);

  // Skids on two struts.
  b.line(X(-7), Y(11), X(-9), Y(17), PAL.steel[1]);
  b.line(X(9), Y(11), X(11), Y(17), PAL.steel[1]);
  b.hline(X(-13), X(13), Y(17), PAL.steel[2]);
  b.set(X(14), Y(16), PAL.steel[2]);
  b.set(X(-14), Y(16), PAL.steel[2]);

  baton(b, phase);
  return b;
}

const FLY: Pose = { armN: { to: [7, 2], hand: 'grip' }, armF: { to: [8, 3], hand: 'grip' }, lean: 6 };
/** The telegraph: the pilot raises his stick high (it looks like a conductor's upbeat). */
const RAISE: Pose = { armN: { sh: 110, el: 30, hand: 'grip' }, armF: { to: [8, 3], hand: 'grip' }, lean: -4, expr: 'shout' };
/** The volley: the stick comes down, pointing at the ground. */
const DOWNBEAT: Pose = { armN: { to: [9, 6], hand: 'point' }, armF: { to: [8, 3], hand: 'grip' }, lean: 8, expr: 'shout' };

function copterFrame(phase: number, pilot: Pose | null, flash = false, stick?: 'up' | 'down'): Frame {
  return frame(copterBody(phase, pilot, flash, stick).outline(INK), CX, CY);
}

/** The empty copter turning round its centre (the death spin). */
function spinFrames(): Frame[] {
  const base = copterBody(2, null, false).outline(INK);
  const out: Frame[] = [];
  for (let k = 0; k < 8; k++) {
    const r = dented(base, 0.9, 30 + k).rotated((k * Math.PI) / 4);
    out.push(frame(r, r.w >> 1, r.h >> 1));
  }
  return out;
}

/** The note-bullet: a gold eighth note (head, stem, flag), brighter than player shots. */
function noteFrames(): Frame[] {
  return [0, 1].map((i) => {
    const b = new PixelBuffer(11, 13);
    b.ellipse(1, 7, 6, 4, PAL.gold[2]);
    b.set(2, 8, PAL.snow[3]);
    b.set(3, 8, PAL.gold[3]);
    b.vline(6, 2, 9, PAL.gold[2]);
    // The flag waves.
    b.line(7, 2, 9, 4 + i, PAL.gold[3]);
    b.line(7, 3, 8, 5 + i, PAL.gold[1]);
    b.set(9, 5 + i, PAL.gold[2]);
    const buf = b.outline(INK);
    return frame(buf, 5, 7);
  });
}

export function defineCopterArt(): void {
  const P8 = [0, 1, 2, 3, 4, 5, 6, 7];
  defineSprite(`${A}/body`, () => P8.map((p) => copterFrame(p, FLY)), { ticksPerFrame: 1 });
  defineSprite(`${A}/tell`, () => P8.map((p) => copterFrame(p, RAISE, false, 'up')), { ticksPerFrame: 1 });
  defineSprite(`${A}/fire`, () => [copterFrame(0, DOWNBEAT, true, 'down'), copterFrame(1, DOWNBEAT, true, 'down')], { ticksPerFrame: 2 });
  defineSprite(`${A}/body-dmg`, () => P8.map((p) => frame(dented(copterFrame(p, FLY).buf, 0.7, 6), CX, CY)), { ticksPerFrame: 1 });
  defineSprite(`${A}/tell-dmg`, () => P8.map((p) => frame(dented(copterFrame(p, RAISE, false, 'up').buf, 0.7, 6), CX, CY)), { ticksPerFrame: 1 });
  defineSprite(`${A}/spin`, spinFrames, { ticksPerFrame: 3 });
  defineSprite(`${A}/note-bullet`, noteFrames, { ticksPerFrame: 6 });
}
