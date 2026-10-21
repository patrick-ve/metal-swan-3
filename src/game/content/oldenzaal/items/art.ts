/**
 * Mission oldenzaal — the meal's art (docs/design/oldenzaal.md §4.3). Owner: WUGHOST. Manifest
 * id 'oldenzaal/items/art'. Prefixes 'item/pickup-oz-meal', 'weapon/oz-frikandel', 'fx/oz/mayo/',
 * 'ui/icon-oz-'.
 *
 * - `item/pickup-oz-meal` (2: the glint; feet anchor, 1× 18 × 12): a white paper tray, a heap of
 *   golden fries with a dollop of mayo, two glossy frikandellen. Outline A.
 * - `weapon/oz-frikandel` (4: spinning end over end; centre anchor, 1× 12 × 12): one frikandel,
 *   a stripe of mayo. Outline A.
 * - `fx/oz/mayo/splat` (5; centre anchor, 1× 22 × 18): the white splash of the mayo that takes a
 *   hit, drips flying; a pale cream rim (an fx: no ink).
 * - `fx/oz/mayo/blast` (6; anchor at the floor centre, 1× 72 × 56; defer): the holy-mayo blast — a
 *   white flash that blooms into a cream-white dome with soft lumps and a gold rim, a ring of
 *   drops, then thin wisps. Drawn twice by the entity (normal + additive glow).
 * - `ui/icon-oz-meal` (13: the countdown ring with 0 … 12 lit segments; 1× 13 × 13): the HUD
 *   status icon of snack power, a little tray of fries inside a ring that empties as it runs.
 * - `ui/icon-oz-frikandel` (1; 1× 11 × 7): the HUD bomb-slot icon while a hero has frikandels.
 *
 * ONE density-generic drawer per id: each shape is a function of LOGICAL coordinates painted at
 * d ∈ {1, 2, 4} (`paintAt`), with tones from the 64-colour `PAL` ramp at 1× and the matching
 * `PAL_HD` ramp at 2× / 4× (`tone`); outline A = 1 logical px of ink (d art px). Same logical size
 * and anchor at every density (geometry is law).
 */
import type { Color } from '../../../../engine/color';
import { INK, PAL } from '../../../../engine/palette';
import { PAL_HD } from '../../../../engine/palette-hd';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';

type Ramp = readonly Color[];
type RampName = 'gold' | 'rust' | 'snow' | 'cloth' | 'sand' | 'brown' | 'stone' | 'steel' | 'orange' | 'red' | 'ink';

/** Tone t (0 = deepest … 1 = lightest) of a ramp at density d (PAL at 1, PAL_HD at 2 / 4). */
function tone(name: RampName, t: number, d: number): Color {
  const r: Ramp = d === 1 ? (PAL as unknown as Record<string, Ramp>)[name] : (PAL_HD as unknown as Record<string, Ramp>)[name];
  const k = Math.max(0, Math.min(r.length - 1, Math.floor(Math.max(0, Math.min(0.999, t)) * r.length)));
  return r[k];
}

/** A logical w × h canvas at density d: `fn(x, y)` (logical px centre) returns a colour or 0. */
function paintAt(w: number, h: number, d: number, fn: (x: number, y: number) => Color | 0): PixelBuffer {
  const b = new PixelBuffer(w * d, h * d);
  for (let Y = 0; Y < h * d; Y++) {
    for (let X = 0; X < w * d; X++) {
      const c = fn((X + 0.5) / d, (Y + 0.5) / d);
      if (c) b.set(X, Y, c);
    }
  }
  return b;
}

/** Outline A: 1 logical px of ink round the shape (d art px). */
function ink(b: PixelBuffer, d: number): PixelBuffer {
  for (let i = 0; i < d; i++) b.outline(INK);
  return b;
}

function frame(buf: PixelBuffer, ox: number, oy: number, d: number): Frame {
  return d === 1 ? { buf, ox, oy } : { buf, ox, oy, density: d };
}

/** Distance from p to the segment a–b, and the position along it (0..1). */
function seg(px: number, py: number, ax: number, ay: number, bx: number, by: number): [number, number] {
  const vx = bx - ax;
  const vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1)));
  return [Math.hypot(px - ax - vx * t, py - ay - vy * t), t];
}

/** Light from the upper left on a round shape: (nx, ny) = the offset from its centre / radius. */
function lit(nx: number, ny: number): number {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  return Math.max(0, -0.55 * nx - 0.6 * ny + 0.58 * nz);
}

/** Small integer hash (stable details). */
function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ------------------------------------------------------------------------------ the meal

/**
 * A frikandel lying from a to b (radius 0.95): a long, slightly bent sausage, glossy brown-red
 * skin with a highlight along the top; `stripe` = a line of mayo along it.
 */
function frikandel(x: number, y: number, ax: number, ay: number, bx: number, by: number, d: number, stripe: boolean): Color | 0 {
  const R = 0.95;
  const [dist, t] = seg(x, y, ax, ay, bx, by);
  if (dist > R) return 0;
  // Normal across the sausage (the side toward the light is lit).
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const nxA = -(by - ay) / len;
  const nyA = (bx - ax) / len;
  const side = ((x - ax) * nxA + (y - ay) * nyA) / R;
  const ends = Math.min(t, 1 - t) * len;
  if (ends < 0.35 && dist > R * 0.7) return 0;
  if (stripe && Math.abs(side + 0.1) < (d === 1 ? 0.45 : 0.3) && Math.sin(t * len * 2.2) > -0.2) return tone('snow', 0.85, d);
  const l = lit(side * nxA * 0.9, side * nyA * 0.9);
  return tone('rust', 0.25 + l * 0.75, d);
}

function mealFrame(i: number, d: number): Frame {
  const W = 18;
  const H = 12;
  const b = paintAt(W, H, d, (x, y) => {
    // The paper tray: a shallow boat 15 × 4 at the bottom (logical 1.5 … 16.5, 7.5 … 11).
    if (y > 7.2 && y < 11 && x > 1.4 + (y - 7.2) * 0.35 && x < 16.6 - (y - 7.2) * 0.35) {
      if (y < 8.2) return tone('snow', 0.95, d);
      const shade = 0.75 - (y - 8.2) * 0.12 - (x > 12 ? 0.08 : 0);
      if (d > 1 && Math.abs(((x - 2) % 3) - 1.5) < 0.12) return tone('cloth', shade - 0.25, d);
      return tone('cloth', shade, d);
    }
    // Two frikandellen on the right, one over the other.
    const f1 = frikandel(x, y, 8.3, 6.2, 15.6, 6.6, d, false);
    if (f1) return f1;
    const f2 = frikandel(x, y, 8.6, 4.4, 15.2, 4.0, d, true);
    if (f2) return f2;
    // The mayo dollop on the fries.
    const mx = (x - 5.2) / 1.6;
    const my = (y - 3.9) / 1.05;
    if (mx * mx + my * my < 1) return tone('snow', 0.55 + lit(mx, my) * 0.45, d);
    // The fries: upright sticks of different heights (left half).
    if (x > 2 && x < 8.6 && y < 8) {
      const col = Math.floor(x * (d === 1 ? 1 : 1.25));
      const top = 2.3 + hash(col, 7) * 2.6;
      if (y > top) return tone('gold', 0.55 + ((col & 1) ? 0.15 : 0.35) - (y < top + 0.6 ? 0.25 : 0), d);
    }
    return 0;
  });
  // The glint (frame 1): a white spark on the top frikandel.
  if (i === 1) {
    const gx = Math.floor(11.5 * d);
    const gy = Math.floor(3.6 * d);
    for (let k = 0; k < Math.max(1, d >> 1); k++) b.set(gx + k, gy, tone('snow', 1, d));
  }
  return frame(ink(b, d), W / 2, H, d);
}

defineSprite('item/pickup-oz-meal', () => [mealFrame(0, 1), mealFrame(1, 1)], { durations: [40, 6], hd: (d) => [mealFrame(0, d), mealFrame(1, d)] });

// ------------------------------------------------------------------------------ the frikandel

function frikandelFrame(i: number, d: number): Frame {
  const S = 12;
  const a = (i * Math.PI) / 4;
  const c = Math.cos(a) * 3.6;
  const s = Math.sin(a) * 3.6;
  const b = paintAt(S, S, d, (x, y) => frikandel(x, y, 6 - c, 6 - s, 6 + c, 6 + s, d, true));
  return frame(ink(b, d), S / 2, S / 2, d);
}
defineSprite('weapon/oz-frikandel', () => [0, 1, 2, 3].map((i) => frikandelFrame(i, 1)), { ticksPerFrame: 3, hd: (d) => [0, 1, 2, 3].map((i) => frikandelFrame(i, d)) });

// ------------------------------------------------------------------------------ the splat

function splatFrame(i: number, d: number): Frame {
  const W = 22;
  const H = 18;
  const cx = 11;
  const cy = 9;
  const grow = [0.45, 0.8, 1, 0.85, 0.6][i];
  const b = paintAt(W, H, d, (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const ang = Math.atan2(dy, dx);
    const r = Math.hypot(dx, dy);
    // A splash: a lumpy blob with 7 spikes.
    const spikes = 0.5 + 0.5 * Math.cos(ang * 7 + 0.6);
    const R = grow * (4.2 + spikes * spikes * 3.2);
    if (r < R) {
      const l = lit(dx / (R + 1), dy / (R + 1));
      if (r > R - (d === 1 ? 1 : 0.6)) return tone('cloth', 0.45, d);
      return tone('snow', 0.55 + l * 0.45, d);
    }
    // Flying drops (frames 1 … 4), moving out.
    for (let k = 0; k < 6; k++) {
      const da = (k / 6) * Math.PI * 2 + 0.3;
      const dr = 6 + i * 2.2 + (k & 1) * 1.5;
      const px = cx + Math.cos(da) * dr;
      const py = cy + Math.sin(da) * dr + i * i * 0.25;
      if (i > 0 && Math.hypot(x - px, y - py) < 0.9 - i * 0.08) return tone('snow', 0.8, d);
    }
    return 0;
  });
  return frame(b, cx, cy, d);
}
defineSprite('fx/oz/mayo/splat', () => [0, 1, 2, 3, 4].map((i) => splatFrame(i, 1)), { ticksPerFrame: 5, loop: false, hd: (d) => [0, 1, 2, 3, 4].map((i) => splatFrame(i, d)) });

// ------------------------------------------------------------------------------ the blast

/** The blast's billows: [angle (0 = up), distance, radius] in units of the full dome (fixed). */
const BILLOWS: ReadonlyArray<readonly [number, number, number]> = [
  ...Array.from({ length: 13 }, (_, k): readonly [number, number, number] => [-1.45 + (k / 12) * 2.9, k % 2 ? 0.62 : 0.5, k % 3 === 0 ? 0.42 : 0.36]),
  [0, 0, 0.55],
  [-0.7, 0.3, 0.42],
  [0.7, 0.3, 0.42],
];

/** Per frame: [dome size, billow radius factor, rise (px), white core radius, drop ring radius]. */
const BLAST: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [9, 1, 0, 5, 0],
  [18, 1, 0, 8, 20],
  [23, 1, 0, 6, 27],
  [25, 0.85, 2, 2, 31],
  [26, 0.62, 5, 0, 34],
  [26, 0.38, 9, 0, 0],
];

function blastFrame(i: number, d: number): Frame {
  const W = 72;
  const H = 56;
  const cx = 36;
  const fy = 52;
  const [size, pf, rise, core, ring] = BLAST[i];
  // The billow circles of this frame (logical px).
  const pufs = BILLOWS.map(([a, dist, rad]) => [cx + Math.sin(a) * dist * size, fy - Math.cos(a) * dist * size * 0.85 - rise * (0.5 + dist), rad * size * pf] as const);
  const b = paintAt(W, H, d, (x, y) => {
    if (y > fy + 1) return 0;
    // The drops flying out on a ring.
    if (ring > 0) {
      for (let k = 0; k < 11; k++) {
        const a = -1.5 + (k / 10) * 3;
        const px = cx + Math.sin(a) * ring;
        const py = fy - Math.cos(a) * ring * 0.8 + (i > 2 ? (i - 2) * 1.5 : 0);
        const rr = 1.1 - i * 0.12;
        if (Math.hypot(x - px, y - py) < rr) return tone(k % 3 === 0 ? 'gold' : 'snow', 0.9, d);
      }
    }
    // The billows: the nearest-to-front (largest depth) billow decides the shading.
    let best = -1;
    let bestK = -1;
    let rim = false;
    for (let k = 0; k < pufs.length; k++) {
      const [px, py, pr] = pufs[k];
      const q = Math.hypot(x - px, y - py) / pr;
      if (q < 1) {
        const depth = 1 - q;
        if (depth > best) {
          best = depth;
          bestK = k;
        }
      } else if (q < 1 + 0.9 / pr) rim = true;
    }
    if (bestK < 0) return rim && i < 5 ? tone('gold', 0.7, d) : 0;
    const [px, py, pr] = pufs[bestK];
    const r0 = Math.hypot(x - cx, y - (fy - size * 0.3));
    if (r0 < core) return tone('snow', 1, d);
    const l = lit((x - px) / pr, (y - py) / pr);
    return tone(l < 0.25 ? 'cloth' : 'snow', l < 0.25 ? 0.55 + l : 0.45 + l * 0.55, d);
  });
  return frame(b, cx, fy, d);
}
defineSprite('fx/oz/mayo/blast', () => BLAST.map((_, i) => blastFrame(i, 1)), { ticksPerFrame: 6, loop: false, defer: true, hd: (d) => BLAST.map((_, i) => blastFrame(i, d)) });

// ------------------------------------------------------------------------------ the HUD icons

export const MEAL_RING_STEPS = 12;

function mealIconFrame(lit12: number, d: number): Frame {
  const S = 13;
  const c = 6.5;
  const b = paintAt(S, S, d, (x, y) => {
    const dx = x - c;
    const dy = y - c;
    const r = Math.hypot(dx, dy);
    // The ring: 12 segments clockwise from the top; the lit ones gold, the spent ones dark.
    if (r > 4.1 && r < 5.5) {
      const a = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2);
      const segF = (a / (Math.PI * 2)) * MEAL_RING_STEPS;
      const s = Math.floor(segF);
      if (d > 1 && segF - s < 0.12) return tone('ink', 0, d);
      return s < lit12 ? tone('gold', r < 4.8 ? 0.95 : 0.7, d) : tone('stone', 0.15, d);
    }
    // The little tray of fries inside.
    if (y > 7 && y < 9 && Math.abs(dx) < 2.8 - (y - 7) * 0.3) return tone('snow', y < 7.8 ? 0.95 : 0.7, d);
    if (y > 4 && y <= 7 && Math.abs(dx) < 2.2) {
      const col = Math.floor(x * (d === 1 ? 1 : 1.5));
      if (y > 4 + hash(col, 3) * 1.4) return tone('gold', (col & 1) ? 0.6 : 0.9, d);
    }
    return 0;
  });
  return frame(ink(b, d), 0, 0, d);
}
defineSprite('ui/icon-oz-meal', () => Array.from({ length: MEAL_RING_STEPS + 1 }, (_, k) => mealIconFrame(k, 1)), {
  hd: (d) => Array.from({ length: MEAL_RING_STEPS + 1 }, (_, k) => mealIconFrame(k, d)),
});

function frikIconFrame(d: number): Frame {
  const b = paintAt(11, 7, d, (x, y) => frikandel(x, y, 2, 4.4, 9, 2.6, d, true));
  return frame(ink(b, d), 0, 0, d);
}
defineSprite('ui/icon-oz-frikandel', () => [frikIconFrame(1)], { hd: (d) => [frikIconFrame(d)] });
