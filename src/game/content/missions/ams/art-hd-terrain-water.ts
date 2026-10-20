/**
 * HD canal water of mission `ams` (UHD art, docs/ART_GUIDE.md "UHD art"): the three ids of every
 * `waterDecor` piece (art.ts `waterSprite`: `decor/ams/water-<w>x<h>` 4-frame surface line,
 * `…-back` opaque canal body behind the actors, `…-tint` body in front at alpha 0.45) drawn natively
 * at d ∈ {2, 4} with PAL_HD by one density-generic drawer each, with the 1× sizes, frame counts and
 * anchors. Painted, no outline; ordered dither only at band borders.
 *
 * - back: the 1× depth bands (teal near the surface, navy in the deep) as a dithered gradient;
 *   broken ripples (a lit crest over a dark trough, short dashes, smaller and denser far away, at
 *   the top), warm reflections of the far quay's houses in broken vertical streaks near the
 *   surface, near-white sky glints, faint long swells in the deep
 * - tint: the body seen through, a teal gradient with swell lines; its top rows are clear (a soft
 *   dithered start), so what floats ON the water — the tour boat's and the ducks' reflections, the
 *   back's ripples — is not tinted as if it were under the surface
 * - surface: the waterline as at 1× (the same crests moving 3 px per frame): a lit band with white
 *   crest lenses, a row of sky-lit crest faces over the trough, then only sparse glints (clear
 *   between them, so the reflections under the waterline show)
 *
 * The ids are registered here, before the section files make their 1× twins, for exactly the
 * piece sizes the sections cut (WATER_PIECE as in art.ts); tests/art/ams-terrain-hd.test.ts checks
 * that every `decor/ams/water-…` id has HD art.
 */
import type { Color } from '../../../../engine/color';
import { PAL_HD } from '../../../../engine/palette-hd';
import { PixelBuffer, type Ramp } from '../../../../engine/pixel';
import { defineHdSprite } from '../../../../engine/sprites';
import { hash2, noise2x } from '../../../art/paint';
import { WATER_Y } from './art';
import { A_CANAL, C2_RIVER, C_AMSTEL, C_CANAL } from './terrain';

const TEAL = PAL_HD.teal;
const NAVY = PAL_HD.navy;
const SKY = PAL_HD.sky;
const WARM: Ramp = [PAL_HD.brickDark[1], PAL_HD.brickDark[2], PAL_HD.brickDark[3], PAL_HD.brickDark[4], PAL_HD.brickDark[5]];

/** The deep band starts at this logical row (the 1× navy bands start at row 18). */
const DEEP_Y = 18;
/**
 * As art.ts `waterDecor`: water decor is cut into pieces this wide. Every pattern is periodic in
 * x with this period, so the pieces of a canal (128, 128, …, the rest) join without a seam.
 */
const WATER_PIECE = 128;

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/**
 * A band tone with a dashed transition: the fraction of t picks the upper band per short
 * horizontal dash (water reads in dashes, never in a checker).
 */
function dash(r: Ramp, t: number, X: number, Y: number, seg: number, d: number, seed: number): number {
  const k0 = Math.floor(t);
  // Flat bands; only the last third of a band mixes in the next tone.
  const f = (t - k0 - 0.68) / 0.32;
  const k = f > hash2(mod(Math.floor((X + (Y & 7) * 3) / seg), (WATER_PIECE * d) / seg), Y, seed) ? k0 + 1 : k0;
  return r[k < 0 ? 0 : k >= r.length ? r.length - 1 : k] >>> 0;
}

/** Ripple rows of a water body h logical rows deep at density d: per art row 1 = crest, −1 = trough. */
function rippleRows(h: number, d: number): { kind: Int8Array; line: Int16Array } {
  const kind = new Int8Array(h * d);
  const line = new Int16Array(h * d).fill(-1);
  let y = 1.6;
  for (let n = 0; y < h - 0.5; n++) {
    const Y = Math.floor(y * d);
    // A crest of 1 art px (2 near the viewer at 4×), its trough under it.
    const ch = d === 4 && y > 14 ? 2 : 1;
    for (let j = 0; j < ch && Y + j < h * d; j++) {
      kind[Y + j] = 1;
      line[Y + j] = n;
    }
    for (let j = ch; j < ch + Math.max(1, d >> 1) && Y + j < h * d; j++) {
      kind[Y + j] = -1;
      line[Y + j] = n;
    }
    y += 1.7 + y * 0.13;
  }
  return { kind, line };
}

/**
 * Is ripple line n on at logical x (a broken dash, longer near the viewer)? `lift` shortens the
 * dash at both ends (the crest is shorter than its trough).
 */
function rippleOn(x: number, n: number, y: number, lift: number, seed: number): boolean {
  const nseg = Math.max(1, Math.round(WATER_PIECE / ((3.5 + y * 0.32) * (0.8 + hash2(n, 0, seed) * 0.5))));
  const u = (x * nseg) / WATER_PIECE + hash2(n, 1, seed) * 7;
  const seg = Math.floor(u);
  const sm = mod(seg, nseg);
  if (hash2(sm, n, seed + 2) < 0.42) return false;
  const f = u - seg;
  const m = 0.12 + lift + hash2(sm, n, seed + 4) * 0.12;
  return f > m && f < 1 - m;
}

/** The opaque canal body behind the actors (w × h logical). */
export function waterBackHd(w: number, h: number, d: number): PixelBuffer {
  const b = new PixelBuffer(w * d, h * d);
  const data = b.data;
  const seed = 31;
  const { kind, line } = rippleRows(h, d);
  for (let Y = 0; Y < h * d; Y++) {
    const y = (Y + 0.5) / d;
    const rk = kind[Y];
    const n = line[Y];
    for (let X = 0; X < w * d; X++) {
      const x = (X + 0.5) / d;
      // The teal surface layer meets the navy deep in dashes over three rows.
      const top = y < DEEP_Y + (hash2(mod(Math.floor((X + (Y & 7) * 5) / (4 * d)), WATER_PIECE / 4), Y, seed + 30) - 0.5) * 3;
      const on = rk !== 0 && rippleOn(x, n, y, rk > 0 ? 0.08 : 0, seed);
      if (top) {
        // Reflections of the far quay's houses: warm vertical streaks, broken by the ripples.
        const wob = n >= 0 && (n & 1) === 1 ? 0.5 : 0;
        const col = mod(Math.floor(x + wob), WATER_PIECE);
        const len = 5 + hash2(col >> 2, 3, seed + 23) * 8;
        const gap = hash2(mod(Math.floor((X + (Y & 3) * d) / (2 * d)), WATER_PIECE / 2), Math.floor(Y / d), seed + 22) <= 0.22;
        if (!on && !gap && y > 1.2 && y < len && noise2x(col, 0, 3, WATER_PIECE, seed + 21) > 0.6) {
          const tw = 2.3 - (y / len) * 1.5 + (hash2(col >> 1, Math.floor(y / 2.5), seed + 25) - 0.5) * 0.9;
          data[Y * b.w + X] = dash(WARM, tw, X, Y, 4 * d, d, seed + 26);
          continue;
        }
        let t = 2.55 - (y / DEEP_Y) * 1.4;
        if (on) {
          if (rk > 0) {
            // Sky glints on the far crests: near white.
            if (y < 7 && hash2(mod(Math.floor(x / 4), WATER_PIECE / 4), n, seed + 27) > 0.55) {
              data[Y * b.w + X] = (y < 4 ? PAL_HD.snow[6] : SKY[6]) >>> 0;
              continue;
            }
            t += 1.2;
          } else t -= 0.8;
        }
        data[Y * b.w + X] = dash(TEAL, t, X, Y, 2 * d, d, seed + 28);
      } else {
        let t = 2.9 - (Math.max(0, y - DEEP_Y) / Math.max(1, h - DEEP_Y)) * 1.9;
        if (on) t += rk > 0 ? 0.9 : -0.5;
        data[Y * b.w + X] = dash(NAVY, t, X, Y, 4 * d, d, seed + 29);
      }
    }
  }
  return b.touch();
}

/**
 * The body seen through, drawn in front at alpha 0.45 (w × (h − 2) logical, from 2 rows under the
 * surface): the back's own pixels, so the water keeps its contrast and a submerged actor takes the
 * water's colours; the top rows are clear, with a soft dashed start.
 */
export function waterTintHd(w: number, h: number, d: number): PixelBuffer {
  const back = waterBackHd(w, h, d);
  const th = Math.max(1, h - 2);
  const b = new PixelBuffer(w * d, th * d);
  const data = b.data;
  for (let Y = 0; Y < th * d; Y++) {
    const y = (Y + 0.5) / d;
    if (y < 2.5) continue;
    const src = (Y + 2 * d) * back.w;
    for (let X = 0; X < w * d; X++) {
      if (y < 3.5 && hash2(mod(Math.floor((X + (Y & 7) * 3) / (2 * d)), WATER_PIECE / 2), Y, 43) > y - 2.5) continue;
      data[Y * b.w + X] = Y + 2 * d < back.h ? back.data[src + X] : back.data[(back.h - 1) * back.w + X];
    }
  }
  return b.touch();
}

/** The 4-frame waterline (w × 3 logical): the 1× crests (period 16, 3 px per frame) at d. */
export function waterSurfaceHd(w: number, d: number): PixelBuffer[] {
  const out: PixelBuffer[] = [];
  for (let f = 0; f < 4; f++) {
    const b = new PixelBuffer(w * d, 3 * d);
    const data = b.data;
    for (let Y = 0; Y < 3 * d; Y++) {
      const ly = Math.floor(Y / d);
      const sy = Y - ly * d;
      for (let X = 0; X < w * d; X++) {
        const x = Math.floor(X / d);
        const sx = X - x * d;
        // Position in the 16-px crest period, in logical px with the art px fraction.
        const kk = (((x + f * 3) & 15) + (sx + 0.5) / d) % 16;
        let c: Color = 0;
        if (ly === 0) {
          // The lit band at the waterline; a white crest lens (thickest in its middle).
          const lens = kk < 4 ? 1 - Math.abs(kk - 2) / 2 : -1;
          if (lens >= 0 && sy < Math.max(1, Math.round(d * (0.35 + lens * 0.65)))) c = sy === 0 && lens > 0.3 ? PAL_HD.snow[6] : SKY[6];
          else if (lens >= 0) c = TEAL[4];
          else c = sy === 0 ? TEAL[4] : kk >= 4 && kk < 6 ? TEAL[4] : TEAL[3];
        } else if (ly === 1) {
          // Crest faces lit by the sky over the trough.
          if (kk >= 8 && kk < 11) c = sy === 0 || kk < 10 ? SKY[6] : SKY[5];
          else c = sy >= d - Math.max(1, d >> 2) ? TEAL[1] : TEAL[2];
        } else {
          // Sparse glints below the waterline (clear between them).
          const g = (x * 7 + f * 5) & 31;
          if (g === 3 && sy < Math.max(1, d >> 1)) c = sx === 0 ? TEAL[5] : TEAL[4];
          else if (d === 4 && g === 4 && sy === 1 && hash2(x, f, 5) > 0.5) c = TEAL[3];
        }
        if (c !== 0) data[Y * b.w + X] = c >>> 0;
      }
    }
    out.push(b.touch());
  }
  return out;
}

// ------------------------------------------------------------------------------------ registration

const D = 'decor/ams/';
/** The water body reaches down to y 216 (art.ts `waterDecor`). */
const WATER_H = 216 - WATER_Y;

/** The piece widths the ams sections cut their canals into (a's side canal, c's canal, c1's Amstel, c2's river). */
export function amsWaterWidths(): number[] {
  const ws = new Set<number>();
  for (const [x0, x1] of [A_CANAL, C_CANAL, C_AMSTEL, C2_RIVER]) for (let x = x0; x < x1; x += WATER_PIECE) ws.add(Math.min(WATER_PIECE, x1 - x));
  return [...ws].sort((a, b) => a - b);
}

for (const w of amsWaterWidths()) {
  const id = `${D}water-${w}x${WATER_H}`;
  defineHdSprite(`${id}-back`, (d) => waterBackHd(w, WATER_H, d));
  defineHdSprite(`${id}-tint`, (d) => waterTintHd(w, WATER_H, d));
  defineHdSprite(id, (d) => waterSurfaceHd(w, d));
}
