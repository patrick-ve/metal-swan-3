/**
 * 2× background layers of mission `ams` (docs/ART_GUIDE.md "2x art (mission ams)", "2x backgrounds
 * and terrain"): `ams-skyline`, the far city. It is the 1× generator (backgrounds.ts) drawn on the
 * 2× grid: the same hashes give the same houses, spires, crane and Westertoren at the same logical
 * places, so the layer reads exactly as before; the finer grid gives slim sash windows with sills,
 * a 1 hi-res px lit edge along every gable, smoother spire tapers, a lattice crane and a Westertoren
 * with brick courses, arched windows and finer crown ribs. The lit left edge of each house stays
 * 2 hi-res px (one logical px), as outlines do in all 2× art.
 *
 * Contract (art-registry.ts defineHiBgGenerator): the same logical (w, h, params, seed) as the 1×
 * generator, a (2·w) × (2·h) buffer, palette only and seamless (every shape wraps at 2·w).
 */
import type { Color } from '../../../../engine/color';
import { PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import { defineHiBgGenerator, type BgGenerator } from '../../../art/art-registry';
import { hash2, noise1 } from '../../../art/paint';
import { isLight, type Light } from './art';
import { SKYLINE } from './backgrounds';

type Params = Readonly<Record<string, unknown>>;

function num(p: Params, k: string, d: number): number {
  const v = p[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

/** A logical px value; numbers in (0, 1] are fractions of `of` (as in backgrounds.ts). */
function px(p: Params, k: string, d: number, of: number): number {
  const v = num(p, k, d);
  return Math.abs(v) <= 1 && v !== 0 ? Math.round(v * of) : Math.round(v);
}

function lightOf(p: Params): Light {
  return isLight(p.light) ? p.light : 'morning';
}

/** Set a hi-res pixel, wrapping x into the tile. */
function setW(b: PixelBuffer, x: number, y: number, c: Color): void {
  if (y < 0 || y >= b.h) return;
  const w = b.w;
  b.data[y * w + (((Math.round(x) % w) + w) % w)] = c >>> 0;
}

/** A rect in hi-res px, wrapping in x. */
function rectH(b: PixelBuffer, x: number, y: number, w: number, h: number, c: Color): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setW(b, xx, yy, c);
}

/** A rect in logical px (each becomes 2 × 2 hi-res px). */
function rectL(b: PixelBuffer, x: number, y: number, w: number, h: number, c: Color): void {
  rectH(b, x * 2, y * 2, w * 2, h * 2, c);
}

/** The Westertoren on the 2× grid (logical layout of backgrounds.ts `westertoren`). */
function westertorenHi(b: PixelBuffer, cx: number, base: number, fill: Color, edge: Color): void {
  // Brick base with a lit left face and brick courses every 3 hi-res rows.
  rectL(b, cx - 6, base - 46, 12, 46, PAL.rust[1]);
  for (let Y = (base - 46) * 2 + 2; Y < base * 2; Y += 3) rectH(b, (cx - 4) * 2, Y, 20, 1, PAL.rust[0]);
  rectL(b, cx - 6, base - 46, 2, 46, PAL.rust[2]);
  // Arched windows: the 1× 3 × 5 slots with rounded tops.
  for (let y = base - 40; y < base; y += 9) {
    rectL(b, cx - 2, y, 3, 5, PAL.ink[1]);
    setW(b, (cx - 2) * 2, y * 2, PAL.rust[1]);
    setW(b, (cx + 1) * 2 - 1, y * 2, PAL.rust[1]);
    rectH(b, cx * 2 - 1, y * 2 + 3, 1, 6, PAL.rust[0]);
  }
  rectL(b, cx - 7, base - 48, 14, 2, PAL.stone[3]);
  rectH(b, (cx - 7) * 2, (base - 47) * 2 + 1, 28, 1, PAL.stone[2]);
  // Stone stages.
  rectL(b, cx - 5, base - 62, 10, 14, PAL.stone[2]);
  rectL(b, cx - 5, base - 62, 2, 14, PAL.stone[3]);
  rectL(b, cx - 2, base - 59, 3, 7, PAL.ink[1]);
  setW(b, (cx - 2) * 2, (base - 59) * 2, PAL.stone[2]);
  setW(b, (cx + 1) * 2 - 1, (base - 59) * 2, PAL.stone[2]);
  rectL(b, cx - 6, base - 64, 12, 2, PAL.stone[3]);
  rectH(b, (cx - 6) * 2, (base - 63) * 2 + 1, 24, 1, PAL.stone[2]);
  rectL(b, cx - 4, base - 74, 8, 10, PAL.stone[2]);
  rectL(b, cx - 4, base - 74, 1, 10, PAL.stone[3]);
  rectL(b, cx - 1, base - 72, 2, 5, PAL.ink[1]);
  setW(b, (cx - 1) * 2, (base - 72) * 2, PAL.stone[2]);
  setW(b, (cx + 1) * 2 - 1, (base - 72) * 2, PAL.stone[2]);
  // The crown: blue with gold ribs on every other hi-res column and a gold rim.
  rectL(b, cx - 5, base - 76, 10, 2, PAL.gold[2]);
  rectH(b, (cx - 5) * 2, (base - 76) * 2, 20, 1, PAL.gold[3]);
  for (let y = 0; y < 7; y++) {
    const half = 4 - Math.floor(y / 3);
    for (let X = (cx - half) * 2; X < (cx + half + 1) * 2; X++) {
      const Y = (base - 77 - y) * 2;
      const c = ((X - cx * 2) & 1) === 0 ? PAL.gold[2] : PAL.sky[0];
      setW(b, X, Y, c);
      setW(b, X, Y + 1, c);
    }
  }
  rectL(b, cx, base - 84, 1, 1, PAL.gold[3]);
  // The slim spire: 1 hi-res px wide above the orb, a gold vane at the top.
  rectL(b, cx, base - 94, 1, 10, PAL.stone[2]);
  rectH(b, cx * 2, (base - 101) * 2, 1, 14, PAL.steel[2]);
  rectH(b, cx * 2, (base - 102) * 2, 2, 2, PAL.gold[3]);
  rectH(b, cx * 2 + 2, (base - 101) * 2, 2, 1, PAL.gold[2]);
  // A soft edge so it sits in the haze.
  rectL(b, cx - 7, base - 1, 1, 1, fill);
  rectL(b, cx + 7, base - 1, 1, 1, edge);
}

const amsSkylineHi: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w * 2, h * 2);
  const light = lightOf(p);
  const base = px(p, 'y', 0.62, h);
  const [fill, edge, win] = SKYLINE[light];
  // Gables: the same seamless chain of narrow houses as 1× (same hashes, logical px).
  let x0 = 0;
  let i = 0;
  while (x0 < w) {
    let hw = 7 + Math.floor(hash2(i, 1, seed) * 7);
    if (w - (x0 + hw) < 7) hw = w - x0;
    const top = base - 14 - Math.floor(noise1(x0, 60, w, seed) * 14) - Math.floor(hash2(i, 2, seed) * 6);
    rectL(b, x0, top, hw, h - top, fill);
    const g = Math.floor(hash2(i, 3, seed) * 3);
    for (let y = 1; y <= 4; y++) {
      const inset = g === 0 ? y : g === 1 ? Math.floor(y / 2) * 2 : 0;
      if (g === 2 && y > 1) break;
      rectL(b, x0 + inset, top - y, Math.max(1, hw - inset * 2), 1, fill);
    }
    // A 1 hi-res px lit edge along the top of the gable: every step, neck and cornice.
    for (let X = x0 * 2; X < (x0 + hw) * 2; X++) {
      for (let Y = (top - 5) * 2; Y < top * 2 + 2; Y++) {
        if (b.data[Y * b.w + X] === fill >>> 0) {
          b.data[Y * b.w + X] = edge >>> 0;
          break;
        }
      }
    }
    // Sash windows: slim 1 × 2 hi-res panes with a lit sill below.
    for (let y = top + 3; y < base + 10; y += 5) {
      for (let x = x0 + 2; x < x0 + hw - 1; x += 3) {
        if (hash2(x, y, seed) >= 0.6) continue;
        rectH(b, x * 2, y * 2, 1, 2, win);
        setW(b, x * 2 + 1, y * 2 + 1, win);
        rectH(b, x * 2, y * 2 + 2, 2, 1, edge);
      }
    }
    rectL(b, x0, top, 1, h - top, edge);
    x0 += hw;
    i++;
  }
  // Church spires (smooth tapers on the 2× grid) and the crane.
  for (const [fx, tall] of [[0.12, 30], [0.58, 24], [0.82, 36]] as const) {
    const cx = Math.round(w * fx);
    rectL(b, cx - 3, base - tall, 6, tall, fill);
    rectH(b, cx * 2 - 1, (base - tall) * 2 + 6, 2, 5, win);
    const top = (base - tall - 16) * 2;
    for (let Y = 0; Y < 32; Y++) {
      const half = Math.max(0, Math.floor((32 - Y) / 6 - 1));
      rectH(b, cx * 2 - half, top + Y, 2 + half * 2, 1, edge);
    }
  }
  const kx = Math.round(w * 0.45);
  const jibY = (base - 70) * 2;
  // The mast: two chords and a zigzag lattice between them.
  rectH(b, kx * 2, jibY, 1, 140, win);
  rectH(b, kx * 2 + 3, jibY, 1, 140, win);
  for (let Y = jibY; Y < jibY + 140; Y++) setW(b, kx * 2 + 1 + ((Y >> 1) & 1), Y, win);
  // The jib: top and bottom chords, diagonal lattice, lit joints where 1× has its dots.
  rectH(b, (kx - 14) * 2, jibY, 88, 1, win);
  rectH(b, (kx - 14) * 2, jibY + 3, 88, 1, win);
  for (let X = (kx - 14) * 2; X < (kx + 30) * 2; X++) {
    const m = (((X - (kx - 14) * 2) % 4) + 4) % 4;
    if (m === 1) setW(b, X, jibY + 1, win);
    if (m === 2) setW(b, X, jibY + 2, win);
  }
  for (let x = kx - 12; x < kx + 28; x += 4) setW(b, (x + 1) * 2, jibY + 2, edge);
  if (p.tower !== false) westertorenHi(b, Math.round(w * 0.3), base + 2, fill, edge);
  return b.touch();
};

defineHiBgGenerator('ams-skyline', amsSkylineHi);
