/**
 * `machine/subway-train/…` — the Legion metro (GDD §9.5, m4-c1): crimson cars with a gold
 * stripe, a cream window band with lit windows (shako-wearing passengers inside), a black
 * underframe on two bogies. The head car has a rounded nose at +x with a big headlight, the
 * driver's window, a gold crest and a brass bell on the roof.
 *
 * Feet anchor = the rail under the middle of the car; every car is 100 px long and 40 px tall
 * (its roof line is the station platform line), so cars drawn 100 px apart touch.
 * Strips: `head` (2, wheel spokes turn, the headlight flickers), `car` (2).
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { wheel } from '../../../art/machines';
import { bell, crest, frame, slab } from './kit.art';

const A = 'machine/subway-train';
const W = 102;
const H = 46;
const OX = 51;
/** The rail row (feet); the outline sits on it. */
const OY = H - 1;
const X = (x: number): number => OX + x;
const Y = (y: number): number => OY + y;

/** Window x positions (local, left edge) of a plain car; the head car skips the nose ones. */
const WINDOWS = [-44, -32, -10, 2, 24, 36] as const;

/** A passenger in a lit window: head, shako, sometimes holding a strap. */
function passenger(b: PixelBuffer, x: number, y: number, k: number): void {
  b.rect(x, y + 3, 3, 3, PAL.skinA[1]);
  b.rect(x, y, 3, 3, PAL.black[1]);
  b.set(x + 1, y - 1, PAL.gold[1]);
  b.rect(x - 1, y + 6, 5, 2, PAL.red[0]);
  if (k % 3 === 1) b.vline(x + 4, y - 2, y + 2, PAL.steel[1]); // the strap
}

function carBody(head: boolean, phase: number): PixelBuffer {
  const b = new PixelBuffer(W, H);
  const red = PAL.red;
  const gold = PAL.gold;
  const left = -50;
  const right = head ? 40 : 49;
  // Underframe and bogies.
  b.rect(X(-46), Y(-9), 92, 3, PAL.black[1]);
  b.hline(X(-46), X(45), Y(-9), PAL.black[2]);
  // Body: crimson box, rounded roof corners.
  slab(b, X(left), Y(-40), right - left + 1, 32, 'red', 2);
  if (head) {
    // The nose: a rounded front that leans back above the window line.
    for (let y = -40; y <= -8; y++) {
      const t = (y + 40) / 32;
      const reach = Math.round(40 + 9 * Math.sqrt(Math.min(1, t * 1.6)));
      for (let x = 41; x <= reach; x++) b.set(X(x), Y(y), x === reach ? red[1] : y < -36 ? red[3] : red[2]);
    }
  }
  // Roof: a darker cap with a gold rivet line; a vent box on plain cars.
  b.hline(X(left + 2), X(right - 2), Y(-40), red[3]);
  b.hline(X(left + 1), X(right - 1), Y(-38), red[1]);
  for (let x = left + 4; x < right - 2; x += 8) b.set(X(x), Y(-39), gold[3]);
  // Window band (cream) with lit windows.
  b.rect(X(left + 1), Y(-34), right - left - 1, 12, PAL.cloth[1]);
  b.hline(X(left + 1), X(right - 1), Y(-34), PAL.cloth[3]);
  b.hline(X(left + 1), X(right - 1), Y(-23), PAL.cloth[0]);
  let k = 0;
  for (const wx of WINDOWS) {
    if (head && wx > 30) continue;
    b.rect(X(wx), Y(-32), 9, 8, gold[3]);
    b.rect(X(wx), Y(-28), 9, 4, gold[2]);
    b.hline(X(wx), X(wx + 8), Y(-32), PAL.snow[3]);
    if (k % 3 !== 2) passenger(b, X(wx + 3), Y(-30), k);
    k++;
  }
  // Double doors in the middle: gold frame, small windows.
  b.rect(X(-20), Y(-34), 8, 25, red[2]);
  b.strokeRect(X(-21), Y(-35), 10, 27, gold[2]);
  b.vline(X(-16), Y(-34), Y(-9), red[0]);
  b.rect(X(-19), Y(-31), 2, 6, PAL.sky[2]);
  b.rect(X(-15), Y(-31), 2, 6, PAL.sky[2]);
  b.rect(X(13), Y(-34), 8, 25, red[2]);
  b.strokeRect(X(12), Y(-35), 10, 27, gold[2]);
  b.vline(X(17), Y(-34), Y(-9), red[0]);
  b.rect(X(14), Y(-31), 2, 6, PAL.sky[2]);
  b.rect(X(18), Y(-31), 2, 6, PAL.sky[2]);
  // The gold stripe under the windows and a thin one along the skirt.
  b.hline(X(left + 1), X(right - 1), Y(-21), gold[3]);
  b.hline(X(left + 1), X(right - 1), Y(-20), gold[1]);
  b.hline(X(left + 1), X(right - 1), Y(-12), gold[2]);
  // Couplers at the ends.
  b.rect(X(-51), Y(-14), 2, 3, PAL.steel[1]);
  if (!head) b.rect(X(49), Y(-14), 2, 3, PAL.steel[1]);
  if (head) {
    // Driver's window, crest, headlight, buffer and a brass bell on the roof.
    b.poly(
      [
        [X(36), Y(-33)],
        [X(45), Y(-33)],
        [X(48), Y(-24)],
        [X(36), Y(-24)],
      ],
      PAL.sky[2],
    );
    b.line(X(38), Y(-32), X(41), Y(-25), PAL.snow[3]);
    b.rect(X(40), Y(-30), 3, 3, PAL.black[1]); // the driver's shako
    b.set(X(41), Y(-31), gold[2]);
    crest(b, X(42), Y(-17));
    const lamp = phase === 0 ? PAL.snow[3] : gold[3];
    b.circle(X(47), Y(-14), 2, gold[1]);
    b.circle(X(47), Y(-14), 1, lamp);
    b.rect(X(44), Y(-9), 6, 2, PAL.steel[2]);
    b.hline(X(44), X(49), Y(-9), PAL.steel[3]);
    b.vline(X(30), Y(-44), Y(-41), PAL.steel[2]);
    bell(b, X(30), Y(-45), 5, 3);
  }
  // Bogies: a dark frame over two wheels each.
  for (const cx of [-32, 30]) {
    b.rect(X(cx - 10), Y(-9), 21, 3, PAL.black[0]);
    for (const dx of [-6, 6]) b.blit(wheel(4, phase, { tyre: 'steel', rim: 'gold' }), X(cx + dx - 4), Y(-9));
  }
  return b;
}

function carFrame(head: boolean, phase: number): Frame {
  return frame(carBody(head, phase).outline(INK), OX, OY);
}

export function defineTrainArt(): void {
  defineSprite(`${A}/head`, () => [carFrame(true, 0), carFrame(true, 1)], { ticksPerFrame: 3 });
  defineSprite(`${A}/car`, () => [carFrame(false, 0), carFrame(false, 1)], { ticksPerFrame: 3 });
}
