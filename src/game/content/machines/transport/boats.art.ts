/**
 * `machine/rowboat/…` and `machine/tank-barge/…` — the Legion's river craft (GDD §9.5).
 *
 * Both float with their keel 6 px under the water surface (the game draws only the rows above
 * the water), so the readable part is the top: a gold gunwale and a crimson stripe on the boat,
 * a row of lashed logs on the raft, and a pennant on a pole that sticks up high.
 *
 * Feet anchor = the keel, facing right (the bow at +x).
 * - `machine/rowboat/{idle,row,sink,idle-dmg,row-dmg}`: 48×12 hull. `idle` (2, the shipped oar
 *   rocks), `row` (4, an oar sweeps through the water), `sink` (3, cracked, the bow rises).
 * - `machine/tank-barge/body` (2, the pennant flutters): 96×12 raft of logs, two log rows; its
 *   deck (the top of the upper logs) is 9 px above the keel.
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { hash2 } from '../../../art/paint';
import { bell, crest, dented, frame } from './kit.art';

// ------------------------------------------------------------------------------------ rowboat

const BOAT = 'machine/rowboat';
const BW = 56;
const BH = 30;
const BOX = 28;
/** The keel (feet) row; the outline sits on it, the hull above it. */
const BOY = BH - 1;
const bx = (x: number): number => BOX + x;
const by = (y: number): number => BOY + y;

/** Hull bottom (local y, negative = up) at local x: flat in the middle, rising at both ends. */
function keelY(x: number): number {
  const t = Math.abs(x) / 24;
  const rise = x > 0 ? 9 : 6; // the bow lifts more than the stern
  return -1 - Math.round(rise * Math.pow(t, 2.4));
}

/** Gunwale (top) line at local x: a gentle sheer up toward the bow. */
function sheerY(x: number): number {
  return -12 - (x > 14 ? Math.round((x - 14) / 4) : 0);
}

/**
 * The rowboat hull, without the outline. `oar`: −1 = shipped along the gunwale, 0–3 = a stroke
 * phase (pull, pull, lift, return).
 */
function boatBody(oar: number, rock: number): PixelBuffer {
  const b = new PixelBuffer(BW, BH);
  const br = PAL.brown;
  const red = PAL.red;
  const gold = PAL.gold;
  // Hull: planks below the stripe, crimson stripe, gold gunwale; lit at the top-left.
  for (let x = -24; x <= 23; x++) {
    const top = sheerY(x);
    const bot = keelY(x);
    for (let y = top; y <= bot; y++) {
      const d = y - top;
      let c: number;
      if (d === 0) c = gold[3];
      else if (d === 1) c = gold[1];
      else if (d <= 4) c = d === 2 ? red[3] : red[2];
      else if (d === 5) c = red[1];
      else {
        const seam = (y - top) % 3 === 2;
        c = seam ? br[0] : hash2(x >> 2, y, 3) > 0.9 ? br[1] : x < -16 ? br[3] : br[2];
      }
      b.set(bx(x), by(y), c);
    }
  }
  // The stern transom (dark) and the bow stem (gold cap).
  b.vline(bx(-24), by(sheerY(-24)), by(keelY(-24)), br[1]);
  b.vline(bx(23), by(sheerY(23) - 1), by(keelY(23)), gold[1]);
  b.set(bx(23), by(sheerY(23) - 1), gold[3]);
  // The Legion crest on the stripe, rivet studs along it.
  crest(b, bx(4), by(-9));
  for (let x = -20; x <= 18; x += 6) if (Math.abs(x - 4) > 4) b.set(bx(x), by(sheerY(x) + 3), gold[2]);
  // Pennant pole at the bow with a crimson pennant edged in gold; a brass bell at the stern.
  const px = bx(20);
  b.vline(px, by(-27), by(sheerY(20) - 1), PAL.brown[3]);
  b.set(px, by(-28), gold[3]);
  for (let k = 0; k < 7; k++) {
    const half = Math.round(2.5 * (1 - k / 7));
    const sway = rock !== 0 && k > 3 ? rock : 0;
    for (let j = -half; j <= half; j++) b.set(px + 1 + k, by(-24 + j + sway), j === -half ? gold[2] : j === half ? red[1] : red[2]);
  }
  b.vline(bx(-21), by(-17), by(sheerY(-21) - 1), PAL.steel[2]);
  b.hline(bx(-23), bx(-21), by(-17), PAL.steel[2]);
  bell(b, bx(-23), by(-16), 4, 3);
  // The oar (an oarlock in the middle of the gunwale).
  const ox = bx(-2);
  const oy = by(sheerY(-2) - 1);
  b.set(ox, oy, PAL.steel[2]);
  if (oar < 0) {
    // Shipped: lying along the gunwale, the blade up at the stern.
    const lift = rock;
    b.line(bx(-16), by(-14 - lift), bx(12), by(-13), br[3]);
    b.rect(bx(-20), by(-15 - lift), 4, 2, br[2]);
    b.hline(bx(-20), bx(-17), by(-15 - lift), br[3]);
  } else {
    // A stroke: the blade end dips into the water behind the oarlock (and lifts on the return).
    const tips: readonly (readonly [number, number])[] = [
      [-14, 2],
      [-6, 4],
      [4, 0],
      [-4, -6],
    ];
    const [tx, ty] = tips[oar & 3];
    const hx = -2 - Math.round((tx + 2) * 0.35);
    const hy = sheerY(-2) - 1 - Math.round((ty - sheerY(-2)) * 0.25);
    b.line(bx(hx), by(hy), bx(tx), by(ty), br[3]);
    b.line(bx(hx), by(hy) + 1, bx(tx), by(ty) + 1, br[1]);
    b.rect(bx(tx) - 1, by(ty) - 1, 3, 3, br[2]);
    b.set(bx(tx) - 1, by(ty) - 1, br[3]);
  }
  return b;
}

function boatFrame(oar: number, rock: number): Frame {
  return frame(boatBody(oar, rock).outline(INK), BOX, BOY);
}

/** Sinking: a crack through the hull, then the stern settles and the bow rises (rotated). */
function sinkFrame(k: number): Frame {
  const b = boatBody(-1, 0);
  // The crack: a dark zig-zag down from the gunwale, splinters.
  let x = bx(-6);
  for (let y = by(-12); y <= by(-2); y++) {
    b.set(x, y, INK);
    b.set(x + 1, y, PAL.brown[0]);
    x += (y & 1) === 0 ? 1 : -1;
  }
  const out = b.outline(INK);
  if (k === 0) return frame(out, BOX, BOY);
  const r = out.rotated(-0.16 * k, { quality: 'fast' });
  // Keep the middle of the keel on the anchor.
  return frame(r, BOX + ((r.w - BW) >> 1), BOY + ((r.h - BH) >> 1));
}

// ------------------------------------------------------------------------------------ barge

const BARGE = 'machine/tank-barge';
const GW = 100;
const GH = 34;
const GOX = 50;
const GOY = GH - 1;
const gx = (x: number): number => GOX + x;
const gy = (y: number): number => GOY + y;

/** One long log lying along the raft from x0 to x1 (local), top row y, diameter d. */
function log(b: PixelBuffer, x0: number, x1: number, y: number, d: number, seed: number): void {
  const br = PAL.brown;
  for (let yy = 0; yy < d; yy++) {
    const t = yy / (d - 1);
    const base = t < 0.2 ? br[3] : t < 0.6 ? br[2] : t < 0.85 ? br[1] : br[0];
    for (let x = x0; x <= x1; x++) {
      let c = base;
      // Bark: short dark streaks.
      if (t > 0.15 && t < 0.85 && hash2(x >> 2, yy, seed) > 0.86) c = br[1];
      b.set(gx(x), gy(y + yy), c);
    }
  }
  // Cut ends: pale rings.
  for (const ex of [x0, x1]) {
    for (let yy = 1; yy < d - 1; yy++) b.set(gx(ex), gy(y + yy), yy === 1 ? PAL.sand[3] : PAL.sand[2]);
  }
}

function bargeBody(flap: number): PixelBuffer {
  const b = new PixelBuffer(GW, GH);
  const gold = PAL.gold;
  const red = PAL.red;
  // Lower row (mostly under water) and the upper row the cargo stands on.
  log(b, -46, 45, -5, 4, 7);
  log(b, -47, 46, -10, 5, 2);
  // Rope lashings every 22 px.
  for (const lx of [-36, -14, 8, 30]) {
    for (let y = -10; y <= -2; y++) b.set(gx(lx), gy(y), (y & 1) === 0 ? PAL.sand[3] : PAL.sand[1]);
    b.set(gx(lx + 1), gy(-10), PAL.sand[2]);
  }
  // Crimson bumper boards with gold caps at both ends.
  for (const ex of [-48, 46]) {
    b.rect(gx(ex), gy(-13), 2, 9, red[2]);
    b.vline(gx(ex), gy(-13), gy(-5), red[3]);
    b.rect(gx(ex), gy(-14), 2, 1, gold[3]);
  }
  // A pole at the stern with a long crimson-and-gold pennant and a brass bell; a short bow post.
  const px = gx(-44);
  b.vline(px, gy(-31), gy(-12), PAL.brown[3]);
  b.vline(px + 1, gy(-31), gy(-12), PAL.brown[1]);
  b.rect(px, gy(-32), 2, 1, gold[3]);
  for (let k = 0; k < 12; k++) {
    const half = Math.round(3 * (1 - k / 12));
    const wave = Math.round(Math.sin((k + flap * 3) * 0.7) * (k / 12) * 1.5);
    for (let j = -half; j <= half; j++) {
      const c = j === -half ? gold[3] : j === half ? red[0] : k % 4 === 3 ? gold[2] : red[2];
      b.set(px + 2 + k, gy(-28 + j + wave), c);
    }
  }
  bell(b, px + 4, gy(-22), 5, 4);
  b.hline(px + 2, px + 4, gy(-23), PAL.steel[2]);
  b.vline(gx(44), gy(-17), gy(-12), PAL.brown[2]);
  b.rect(gx(43), gy(-18), 3, 1, gold[3]);
  return b;
}

function bargeFrame(flap: number): Frame {
  return frame(bargeBody(flap).outline(INK), GOX, GOY);
}

export function defineBoatArt(): void {
  defineSprite(`${BOAT}/idle`, () => [boatFrame(-1, 0), boatFrame(-1, 1)], { ticksPerFrame: 24 });
  defineSprite(`${BOAT}/row`, () => [0, 1, 2, 3].map((k) => boatFrame(k, k & 1)), { ticksPerFrame: 8 });
  defineSprite(`${BOAT}/idle-dmg`, () => [0, 1].map((r) => frame(dented(boatFrame(-1, r).buf, 0.7, 6), BOX, BOY)), { ticksPerFrame: 24 });
  defineSprite(`${BOAT}/row-dmg`, () => [0, 1, 2, 3].map((k) => frame(dented(boatFrame(k, k & 1).buf, 0.7, 6), BOX, BOY)), { ticksPerFrame: 8 });
  defineSprite(`${BOAT}/sink`, () => [0, 1, 2].map(sinkFrame), { ticksPerFrame: 20 });
  defineSprite(`${BARGE}/body`, () => [bargeFrame(0), bargeFrame(1)], { ticksPerFrame: 20 });
}
