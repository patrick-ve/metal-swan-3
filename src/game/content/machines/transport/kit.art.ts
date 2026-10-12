/**
 * Transport machines: a small local art kit on top of `src/game/art/machines.ts` (frozen for
 * this sub-area). Brass horns and bells, parade bunting, gold fringes, the Legion crest, wood
 * planks, burnt and dented copies of finished machines. Every helper draws palette colours only,
 * lit from the top-left, WITHOUT an outline (outline the finished machine once: leave a 1-px
 * margin, `buf.outline(INK)`).
 */
import type { Color } from '../../../../engine/color';
import { luma } from '../../../../engine/color';
import type { Ramp } from '../../../../engine/pixel';
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import type { Frame } from '../../../../engine/render';
import { bayer, hash2, R, type RampLike } from '../../../art/paint';
import { damage } from '../../../art/machines';

/** A frame from a buffer: the anchor pixel (ox, oy) and optional points (relative to it). */
export function frame(buf: PixelBuffer, ox: number, oy: number, pts?: Record<string, readonly [number, number]>): Frame {
  return pts ? { buf, ox, oy, pts } : { buf, ox, oy };
}

/** Ramp index for a light amount −1..1 (+ = toward the top-left light). */
function lit(l: number, n: number): number {
  const top = n - 1;
  if (l > 0.45) return top;
  if (l > -0.15) return Math.max(0, top - 1);
  if (l > -0.65) return Math.max(0, top - 2);
  return Math.max(0, top - 3);
}

export interface HornOpts {
  ramp?: RampLike;
  /** Colours inside the mouth (upper, lower). */
  inside?: readonly [Color, Color];
  /** How fast the bell flares (higher = a narrow tube that opens late). Default 2.6. */
  flare?: number;
  /** Half-depth of the mouth ellipse along the axis (default 2). */
  depth?: number;
}

/**
 * A brass horn: a tube from (x0, y0) along `ang` (0 = right, −π/2 = up), `len` px to the
 * centre of the mouth, radius r0 at the mouthpiece, r1 at the bell. The tube is shaded like a
 * lit cylinder; the mouth is an ellipse with a bright rim and a dark inside.
 */
export function horn(b: PixelBuffer, x0: number, y0: number, ang: number, len: number, r0: number, r1: number, o: HornOpts = {}): void {
  const ramp = R(o.ramp ?? 'gold');
  const inside = o.inside ?? [PAL.brown[0], PAL.gold[0]];
  const flare = o.flare ?? 2.6;
  const depth = o.depth ?? 2;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  // The across-axis unit vector and how much it faces the light (top-left).
  const nx = -sa;
  const ny = ca;
  const toLight = nx * -0.6 + ny * -0.8;
  const ext = Math.ceil(len + r1 + depth + 2);
  for (let y = Math.max(0, Math.floor(y0 - ext)); y <= Math.min(b.h - 1, Math.ceil(y0 + ext)); y++) {
    for (let x = Math.max(0, Math.floor(x0 - ext)); x <= Math.min(b.w - 1, Math.ceil(x0 + ext)); x++) {
      const px = x - x0;
      const py = y - y0;
      const u = px * ca + py * sa;
      const v = px * nx + py * ny;
      const mu = (u - len) / depth;
      const mv = v / r1;
      const k = mu * mu + mv * mv;
      if (k <= 1) {
        if (k > 0.4 || mu > 0.3) b.set(x, y, ramp[lit((v / r1) * toLight, ramp.length)]);
        else b.set(x, y, v * toLight > 0 ? inside[1] : inside[0]);
        continue;
      }
      if (u < 0 || u > len) continue;
      const t = u / len;
      const hw = r0 + (r1 - r0) * Math.pow(t, flare);
      if (Math.abs(v) > hw + 0.3) continue;
      b.set(x, y, ramp[lit((v / Math.max(0.5, hw)) * toLight, ramp.length)]);
    }
  }
}

/** A small brass hand bell hanging from (cx, top): `w` wide at the lip, `h` tall. */
export function bell(b: PixelBuffer, cx: number, top: number, w: number, h: number): void {
  const g = PAL.gold;
  for (let y = 0; y < h; y++) {
    const t = y / Math.max(1, h - 1);
    const half = Math.round(1 + (w / 2 - 1) * Math.pow(t, 1.6));
    for (let x = -half; x <= half; x++) {
      const edge = x === -half ? 3 : x === half ? 1 : x < 0 ? 2 : x > half - 2 ? 1 : 2;
      b.set(cx + x, top + y, g[edge]);
    }
  }
  b.set(cx, top + h, g[1]); // the clapper
  b.set(cx - 1, top + 1, g[3]);
}

/** Pennants on crimson paintwork (crimson ones would vanish) and on anything else. */
export const PENNANTS_ON_RED: readonly Color[] = [PAL.gold[2], PAL.snow[3], PAL.black[1]];
export const PENNANTS: readonly Color[] = [PAL.red[2], PAL.gold[2], PAL.snow[3]];

/** One shade darker along the colour's own ramp. */
export function darker(c: Color): Color {
  for (const r of [PAL.red, PAL.gold, PAL.snow, PAL.black, PAL.steel, PAL.brown, PAL.sky, PAL.navy] as readonly Ramp[]) {
    const i = r.indexOf(c);
    if (i > 0) return r[i - 1];
    if (i === 0) return INK;
  }
  return c;
}

/**
 * Parade bunting: a cord from x0 to x1 at y, sagging `sag` px in the middle, with a little
 * triangular pennant (5 wide, 3 tall) every `gap` px. `phase` shifts the sway of the tips.
 */
export function bunting(b: PixelBuffer, x0: number, x1: number, y: number, sag: number, colors: readonly Color[] = PENNANTS, gap = 6, phase = 0): void {
  const cordY = (x: number): number => {
    const t = (x - x0) / Math.max(1, x1 - x0);
    return y + Math.round(sag * 4 * t * (1 - t));
  };
  for (let x = x0; x <= x1; x++) b.set(x, cordY(x), PAL.stone[3]);
  let k = 0;
  for (let x = x0 + 3; x <= x1 - 2; x += gap, k++) {
    const c = colors[k % colors.length];
    const d = darker(c);
    const cy = cordY(x);
    const sway = (k + phase) % 4 === 1 ? 1 : (k + phase) % 4 === 3 ? -1 : 0;
    b.hline(x - 2, x + 2, cy + 1, c);
    b.hline(x - 1, x + 1, cy + 2, c);
    b.set(x + sway, cy + 3, c);
    b.set(x + 1, cy + 2, d);
    b.set(x + 2, cy + 1, d);
  }
}

/** A gold tassel fringe hanging from y between x0 and x1 (`len` px long; sways with phase). */
export function fringe(b: PixelBuffer, x0: number, x1: number, y: number, len: number, phase = 0): void {
  const g = PAL.gold;
  b.hline(x0, x1, y, g[3]);
  b.hline(x0, x1, y + 1, g[1]);
  for (let x = x0; x <= x1; x += 2) {
    const sway = (((x >> 1) + phase) & 3) === 0 ? 1 : 0;
    for (let k = 2; k < len; k++) b.set(x + (k === len - 1 ? sway : 0), y + k, k === len - 1 ? g[1] : g[2]);
  }
}

/** The Legion crest: a gold medallion (r 3) with a crimson heart and a white glint. */
export function crest(b: PixelBuffer, cx: number, cy: number): void {
  b.circle(cx, cy, 3, PAL.gold[1]);
  b.circle(cx, cy, 2, PAL.gold[2]);
  b.set(cx - 1, cy - 2, PAL.gold[3]);
  b.set(cx - 2, cy - 1, PAL.gold[3]);
  b.set(cx - 1, cy, PAL.red[2]);
  b.set(cx + 1, cy, PAL.red[2]);
  b.hline(cx - 1, cx + 1, cy + 1, PAL.red[1]);
  b.set(cx, cy, PAL.red[3]);
}

/** A rounded rectangle body shaded from the top-left (ramp base 2, lit 3, shadow 1). */
export function slab(b: PixelBuffer, x: number, y: number, w: number, h: number, ramp: RampLike, r = 0): void {
  const rp = R(ramp);
  const l = new PixelBuffer(w, h);
  if (r > 0) l.roundRect(0, 0, w, h, r, rp[2]);
  else l.fill(rp[2]);
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      if ((l.get(xx, yy) & 255) === 0) continue;
      const top = yy === 0 || (l.get(xx, yy - 1) & 255) === 0;
      const left = xx === 0 || (l.get(xx - 1, yy) & 255) === 0;
      const bottom = yy === h - 1 || (l.get(xx, yy + 1) & 255) === 0;
      const right = xx === w - 1 || (l.get(xx + 1, yy) & 255) === 0;
      if ((top || left) && !(bottom || right)) l.set(xx, yy, rp[3]);
      else if (bottom || right) l.set(xx, yy, rp[1]);
    }
  }
  b.blit(l, x, y);
}

/** Horizontal wooden planks (brown) with seams every `plank` px and a few knots. */
export function planks(b: PixelBuffer, x: number, y: number, w: number, h: number, plank = 3, seed = 1): void {
  const br = PAL.brown;
  for (let yy = 0; yy < h; yy++) {
    const row = Math.floor(yy / plank);
    const seam = yy % plank === plank - 1;
    for (let xx = 0; xx < w; xx++) {
      let c = seam ? br[0] : yy % plank === 0 ? br[3] : br[2];
      // Butt joints, offset per plank row.
      if (!seam && (xx + row * 11) % 23 === 0) c = br[1];
      if (!seam && hash2(xx >> 1, row, seed) > 0.93) c = br[1];
      b.set(x + xx, y + yy, c);
    }
  }
}

/** A copy of a finished (outlined) machine with dents, bullet holes and scorch marks. */
export function dented(buf: PixelBuffer, amount = 0.6, seed = 3): PixelBuffer {
  return damage(buf, amount, seed);
}

const BURNT: readonly Color[] = [PAL.ink[1], PAL.black[2], PAL.steel[0], PAL.stone[0], PAL.steel[1]];

/**
 * A burnt wreck of a finished (outlined) machine: every colour sinks to soot greys by its
 * brightness, scorch dither on top, a few glowing embers. Returns a new buffer.
 */
export function burnt(src: PixelBuffer, seed = 5, embers = 6): PixelBuffer {
  const b = src.clone();
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const c = b.get(x, y);
      if ((c & 255) === 0 || c === INK) continue;
      const l = luma(c) / 255;
      let i = Math.min(BURNT.length - 1, Math.floor(l * BURNT.length * 0.95));
      if (bayer(x, y) < 0.3 && hash2(x >> 2, y >> 2, seed) > 0.5) i = Math.max(0, i - 1);
      b.set(x, y, BURNT[i]);
    }
  }
  for (let k = 0; k < embers * 4 && embers > 0; k++) {
    const x = 1 + Math.floor(hash2(k, 7, seed) * (b.w - 3));
    const y = 1 + Math.floor(hash2(k, 9, seed) * (b.h - 3));
    const c = b.get(x, y);
    if ((c & 255) === 0 || c === INK || (b.get(x + 1, y) & 255) === 0 || b.get(x + 1, y) === INK) continue;
    b.set(x, y, PAL.orange[2]);
    b.set(x + 1, y, PAL.red[2]);
    if (--embers <= 0) break;
  }
  return b;
}

/** Recolour a finished buffer with a colour map (e.g. a crimson body to a darker night tone). */
export function swapColors(src: PixelBuffer, map: ReadonlyMap<Color, Color>): PixelBuffer {
  return src.clone().recolor(map);
}
