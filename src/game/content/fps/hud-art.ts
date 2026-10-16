/**
 * The first-person status bar pieces (docs/design/fps.md §8.5, layout §8.6): `fps/hud/bar`
 * (384 × 40), `fps/hud/weapon` (48 × 20, 4 frames: knife, pistol, mg, chaingun) and
 * `fps/hud/key` (8 × 14, 2 frames: gold, silver). Top-left anchors. Our own layout: the face
 * porthole at the left edge, recessed panels for the middle and weapon blocks.
 */
import type { Color } from '../../../engine/color';
import { INK, PAL } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import { defineSprite } from '../../../engine/sprites';
import { hash2 } from '../../art/paint';

export const BAR_W = 384;
export const BAR_H = 40;

function rivet(b: PixelBuffer, x: number, y: number): void {
  b.set(x, y, PAL.steel[3]);
  b.set(x + 1, y, PAL.steel[2]);
  b.set(x, y + 1, PAL.steel[2]);
  b.set(x + 1, y + 1, PAL.navy[0]);
}

/** A recessed panel: dark inside, shadow top / left, light lip bottom / right. */
function recess(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number): void {
  b.rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, PAL.navy[0]);
  b.hline(x0, x1, y0, INK);
  b.vline(x0, y0, y1, INK);
  b.hline(x0 + 1, x1, y0 + 1, PAL.ink[1]);
  b.hline(x0, x1, y1, PAL.steel[2]);
  b.vline(x1, y0, y1, PAL.steel[2]);
}

export function barArt(): PixelBuffer {
  const b = new PixelBuffer(BAR_W, BAR_H);
  // brushed navy-steel plate
  for (let y = 0; y < BAR_H; y++) {
    for (let x = 0; x < BAR_W; x++) {
      const n = hash2(x >> 3, y, 5);
      b.data[y * BAR_W + x] = n < 0.12 ? PAL.slate[0] : n > 0.9 ? PAL.slate[2] : PAL.slate[1];
    }
  }
  b.hline(0, BAR_W - 1, 0, PAL.steel[3]);
  b.hline(0, BAR_W - 1, 1, PAL.slate[2]);
  b.hline(0, BAR_W - 1, BAR_H - 1, INK);
  b.hline(0, BAR_W - 1, BAR_H - 2, PAL.navy[0]);
  // block dividers
  for (const x of [48, 116, 240, 256]) {
    b.vline(x, 2, BAR_H - 3, PAL.navy[0]);
    b.vline(x + 1, 2, BAR_H - 3, PAL.slate[2]);
  }
  // health block, middle block, key slots, weapon block
  recess(b, 50, 3, 113, 36);
  recess(b, 118, 3, 238, 36);
  recess(b, 243, 4, 253, 20);
  recess(b, 243, 21, 253, 37);
  recess(b, 258, 3, 381, 36);
  // the weapon block's silhouette window and divider
  b.vline(310, 4, 35, PAL.ink[1]);
  // the porthole at the left: a brass ring with bolts around a dark glass
  const cx = 26;
  const cy = 20;
  for (let y = 0; y < BAR_H; y++) {
    for (let x = 2; x < 50; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > 19.5) continue;
      let c: Color;
      if (d <= 16) c = PAL.navy[0];
      else if (d <= 17) c = INK;
      else {
        const lit = (x - cx) * -0.6 + (y - cy) * -0.8;
        c = lit > 6 ? PAL.brass[3] : lit > 0 ? PAL.brass[2] : lit > -8 ? PAL.brass[1] : PAL.brass[0];
      }
      b.data[y * BAR_W + x] = c;
    }
  }
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.round(cx + Math.cos(a) * 18.2 - 0.5);
    const y = Math.round(cy + Math.sin(a) * 18.2 - 0.5);
    b.set(x, y, PAL.brown[0]);
  }
  // rivets along the plate
  for (let x = 60; x < BAR_W - 4; x += 32) {
    if (x > 112 && x < 120) continue;
    rivet(b, x, 1);
  }
  for (const x of [114, 241, 254]) {
    rivet(b, x, 4);
    rivet(b, x, 34);
  }
  rivet(b, BAR_W - 3, 4);
  rivet(b, BAR_W - 3, 34);
  return b.touch();
}

/** Weapon silhouettes for the weapon block (side view, muzzle right). */
export function weaponIcon(i: number): PixelBuffer {
  const b = new PixelBuffer(48, 20);
  const body = PAL.steel[2];
  const lit = PAL.steel[3];
  const dark = PAL.steel[1];
  const wood = PAL.brown[2];
  if (i === 0) {
    // knife
    b.rect(6, 9, 10, 3, wood);
    b.rect(16, 7, 2, 7, dark);
    b.tri(18, 8, 18, 12, 42, 10, body);
    b.hline(18, 38, 9, lit);
  } else if (i === 1) {
    // pistol
    b.rect(14, 5, 22, 5, body);
    b.hline(14, 35, 5, lit);
    b.rect(16, 10, 6, 8, wood);
    b.rect(22, 10, 4, 3, dark);
    b.rect(35, 6, 3, 3, dark);
  } else if (i === 2) {
    // mg: stock, receiver, perforated jacket, folded bipod, drum
    b.rect(2, 8, 10, 6, wood);
    b.rect(12, 6, 14, 6, body);
    b.hline(12, 25, 6, lit);
    b.rect(26, 7, 16, 4, dark);
    for (let x = 27; x < 41; x += 3) b.set(x, 8, INK);
    b.rect(42, 8, 5, 2, body);
    b.rect(16, 12, 6, 5, dark);
    b.line(30, 11, 38, 15, dark);
  } else {
    // chaingun: housing, six barrels, handle, belt
    b.rect(4, 5, 16, 10, body);
    b.hline(4, 19, 5, lit);
    b.rect(8, 2, 8, 3, dark);
    for (let k = 0; k < 3; k++) b.rect(20, 6 + k * 3, 24, 2, k === 1 ? lit : dark);
    b.rect(24, 5, 2, 10, dark);
    b.rect(38, 5, 2, 10, dark);
    for (let x = 5; x < 15; x += 2) b.rect(x, 15, 1, 4, PAL.brass[2]);
  }
  // ink outline
  const src = b.data.slice();
  for (let y = 0; y < 20; y++) {
    for (let x = 0; x < 48; x++) {
      if ((src[y * 48 + x] & 255) !== 0) continue;
      const n = (x > 0 && (src[y * 48 + x - 1] & 255) !== 0) || (x < 47 && (src[y * 48 + x + 1] & 255) !== 0) || (y > 0 && (src[(y - 1) * 48 + x] & 255) !== 0) || (y < 19 && (src[(y + 1) * 48 + x] & 255) !== 0);
      if (n) b.data[y * 48 + x] = INK;
    }
  }
  return b.touch();
}

/** A bit key, upright (bow at the top). */
export function keyIcon(gold: boolean): PixelBuffer {
  const b = new PixelBuffer(8, 14);
  const r = gold ? PAL.gold : [PAL.steel[2], PAL.steel[3], PAL.steel[4], PAL.snow[2]];
  b.circle(3.5, 3, 3, r[1]);
  b.circle(3.5, 3, 3, r[0], false);
  b.rect(3, 2, 2, 2, INK);
  b.set(2, 1, r[3]);
  b.rect(3, 6, 2, 7, r[2]);
  b.vline(3, 6, 12, r[3]);
  b.rect(5, 10, 2, 1, r[1]);
  b.rect(5, 12, 2, 2, r[1]);
  b.set(6, 13, r[0]);
  return b.touch();
}

defineSprite('fps/hud/bar', () => barArt(), { anchor: 'top-left' });
defineSprite('fps/hud/weapon', () => [0, 1, 2, 3].map((i) => weaponIcon(i)), { anchor: 'top-left' });
defineSprite('fps/hud/key', () => [keyIcon(true), keyIcon(false)], { anchor: 'top-left' });
