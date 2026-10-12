/**
 * `ui/logo` (GDD §13.3): METAL / SWAN in chunky riveted ivory-and-steel letters and a large gold
 * 3 whose top curls into a swan's neck and head with an orange beak. Top-left anchored, about
 * 196 × 64 px (it sits at C, y 20–84 on the title).
 */
import type { Color } from '../../../engine/color';
import { drawText, measureText } from '../../../engine/font';
import { INK, PAL } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import type { Frame } from '../../../engine/render';
import { defineSprite } from '../../../engine/sprites';

const MASK: Color = 0xff00ffff;

/** Shade a mask of letters: ivory plates lit from the top left, a steel seam, steel rivets. */
function plateLetters(text: string, scale: number): PixelBuffer {
  const size = measureText(text, { font: 'big', scale });
  const b = new PixelBuffer(size.w + 2, size.h + 2);
  drawText(b, text, 1, 1, { font: 'big', scale, color: MASK });
  const m = b.clone();
  const on = (x: number, y: number): boolean => m.get(x, y) === MASK;
  const glyphH = 8 * scale;
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (!on(x, y)) continue;
      const row = y - 1;
      // Ivory body, lighter toward the top of each letter; edges bevelled.
      let c: Color = row < glyphH * 0.4 ? PAL.snow[3] : row < glyphH * 0.75 ? PAL.snow[2] : PAL.snow[1];
      if (!on(x - 1, y) || !on(x, y - 1)) c = PAL.snow[3];
      if (!on(x + 1, y) || !on(x, y + 1)) c = PAL.steel[2];
      else if (!on(x + 2, y) || !on(x, y + 2)) c = row < glyphH * 0.5 ? PAL.snow[1] : PAL.steel[3];
      b.set(x, y, c);
    }
  }
  // The steel seam across each letter at mid height, with a lit line under it.
  const seam = 1 + Math.round(glyphH * 0.5);
  for (let x = 0; x < b.w; x++) {
    if (on(x, seam) && on(x - 1, seam) && on(x + 1, seam)) b.set(x, seam, PAL.steel[1]);
    if (on(x, seam + 1) && on(x, seam) && on(x - 1, seam + 1) && on(x + 1, seam + 1)) b.set(x, seam + 1, PAL.snow[3]);
  }
  // Rivets: on solid stroke centres along two bands above and below the seam.
  const step = 2 * scale;
  for (const ry of [1 + scale + 1, seam + scale + 1]) {
    for (let x = scale; x < b.w - 1; x += step) {
      let solid = true;
      for (let dy = -1; dy <= 1 && solid; dy++) for (let dx = -1; dx <= 1 && solid; dx++) solid = on(x + dx, ry + dy);
      if (!solid) continue;
      b.set(x, ry, PAL.steel[4]);
      b.set(x + 1, ry + 1, PAL.steel[1]);
    }
  }
  return b;
}

/**
 * The gold 3: two bowls of thick strokes; the top stroke's left end rises into an S-curved
 * neck and a head looking right, with an orange beak and an ink eye.
 */
function swanThree(): PixelBuffer {
  const w = 54;
  const h = 66;
  const m = new PixelBuffer(w, h);
  const stroke = (pts: readonly number[], width: number): void => {
    for (let i = 0; i + 3 < pts.length; i += 2) m.thickLine(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], width, MASK);
  };
  // Top bowl (from the neck root round to the middle notch) and the bottom bowl.
  stroke([12, 26, 20, 20, 30, 19, 38, 22, 41, 29, 37, 35, 28, 39, 22, 40], 9);
  stroke([22, 40, 31, 41, 39, 45, 43, 52, 40, 59, 31, 63, 20, 63, 10, 59], 9);
  // The neck: up from the top bowl's left end in an S, thinner toward the head.
  stroke([12, 26, 8, 20, 7, 14, 10, 9], 7);
  stroke([10, 9, 15, 6], 6);
  // Head (a round dome) facing right.
  m.ellipse(13, 1, 11, 9, MASK);
  const b = new PixelBuffer(w, h);
  const on = (x: number, y: number): boolean => m.get(x, y) === MASK;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!on(x, y)) continue;
      // Gold, lit from the top left; a dark rim on the bottom right; a warm core.
      let c: Color = PAL.gold[2];
      if (!on(x - 1, y) || !on(x, y - 1) || !on(x - 1, y - 1)) c = PAL.gold[3];
      else if (!on(x - 2, y) || !on(x, y - 2)) c = PAL.gold[3];
      if (!on(x + 1, y) || !on(x, y + 1)) c = PAL.orange[1];
      else if (!on(x + 2, y) || !on(x, y + 2) || !on(x + 1, y + 1)) c = PAL.gold[1];
      b.set(x, y, c);
    }
  }
  // Glints on the bowls.
  b.set(23, 20, PAL.snow[3]);
  b.set(24, 20, PAL.snow[3]);
  b.set(33, 42, PAL.snow[3]);
  // The beak: orange, from the dome's front to a steel tip; an ink eye with a gold lens ring.
  for (let i = 0; i < 9; i++) {
    const x = 23 + i;
    b.set(x, 5, i < 8 ? PAL.orange[3] : PAL.steel[3]);
    if (i < 7) b.set(x, 6, PAL.orange[2]);
    if (i < 4) b.set(x, 7, PAL.orange[1]);
  }
  b.set(19, 4, PAL.navy[0]);
  b.set(20, 5, PAL.navy[0]);
  b.set(21, 5, PAL.navy[0]);
  b.set(17, 3, PAL.gold[3]);
  b.set(18, 3, INK);
  b.set(17, 4, INK);
  b.set(18, 4, PAL.snow[3]);
  return b;
}

/** A drop shadow: the silhouette of `src` in `c`, `d` px down and right, under `src`. */
function withShadow(src: PixelBuffer, c: Color, d: number): PixelBuffer {
  const out = new PixelBuffer(src.w + d, src.h + d);
  out.blit(src, d, d, { solid: c });
  out.blit(src, 0, 0);
  return out;
}

function logo(): Frame[] {
  const metal = plateLetters('METAL', 3);
  const swan = plateLetters('SWAN', 3);
  const three = swanThree();
  const gap = 4;
  const left = Math.max(metal.w, swan.w);
  const w = left + gap + three.w + 6;
  const h = 66;
  const b = new PixelBuffer(w, h);
  // METAL over SWAN (SWAN centred under METAL), the 3 at the right spanning both lines.
  const top = h - (metal.h + 3 + swan.h) - 1;
  b.blit(metal, 1, top);
  b.blit(swan, 1 + ((metal.w - swan.w) >> 1), top + metal.h + 3);
  b.blit(three, left + gap, 0);
  b.outline(INK);
  return [{ buf: withShadow(b, PAL.navy[0], 2), ox: 0, oy: 0 }];
}

export function defineLogoArt(): void {
  defineSprite('ui/logo', logo, { anchor: 'top-left' });
}
