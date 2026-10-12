/**
 * Background generators (docs/ARCHITECTURE.md §6.2, docs/ART_GUIDE.md §7). Registered with
 * defineBgGenerator at import time:
 *
 *   sky-gradient, clouds, mountains, hills, treeline, jungle, city, ruins, dunes, ice-peaks, sea
 *
 * Contract: gen(w, h, params, seed) → PixelBuffer of exactly w × h. Every generator tiles
 * horizontally without a seam (all shapes come from functions with period w, and anything
 * that crosses the right edge is drawn again at x − w) and is deterministic per seed.
 *
 * Common params (all optional):
 * - `ramp`: palette ramp name ('green', 'stone' …) or an array of colours, dark → light.
 * - `y`: top of the feature (px, or a fraction 0..1 of h when ≤ 1).
 * - `height`: feature height (px, or a fraction of h when ≤ 1).
 * Generator-specific params are listed on each generator below.
 */
import type { Color } from '../../engine/color';
import { lerpColor } from '../../engine/color';
import { PixelBuffer } from '../../engine/pixel';
import type { Ramp } from '../../engine/pixel';
import { nearest, PAL, ramp as rampByName } from '../../engine/palette';
import { defineBgGenerator } from './art-registry';
import type { BgGenerator } from './art-registry';
import { bayer, fbm1, hash1, hash2, noise1, noise2x } from './paint';

type Params = Readonly<Record<string, unknown>>;

// ------------------------------------------------------------------------------------ params

function num(p: Params, k: string, d: number): number {
  const v = p[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

/** A px value; numbers in [0, 1] are fractions of `of`. */
function px(p: Params, k: string, d: number, of: number): number {
  const v = num(p, k, d);
  return Math.abs(v) <= 1 && v !== 0 ? Math.round(v * of) : Math.round(v);
}

function bool(p: Params, k: string, d: boolean): boolean {
  const v = p[k];
  return typeof v === 'boolean' ? v : d;
}

/** Ramp param: a palette ramp name or a colour array (dark → light). */
function rampParam(p: Params, k: string, d: Ramp): Ramp {
  const v = p[k];
  if (typeof v === 'string') return rampByName(v);
  if (Array.isArray(v) && v.length > 0 && v.every((c) => typeof c === 'number')) return v as Ramp;
  return d;
}

function colorParam(p: Params, k: string, d: Color): Color {
  const v = p[k];
  return typeof v === 'number' ? v >>> 0 : d;
}

/** Draw a pixel with horizontal wrap (seamless tiling). */
function setW(b: PixelBuffer, x: number, y: number, c: Color): void {
  const w = b.w;
  b.set(((Math.round(x) % w) + w) % w, y, c);
}

function getW(b: PixelBuffer, x: number, y: number): Color {
  const w = b.w;
  return b.get(((Math.round(x) % w) + w) % w, y);
}

/** Colour from a ramp for a continuous index with ordered dither (anchored to x, y). */
function dz(r: Ramp, v: number, x: number, y: number, spread = 1): Color {
  const k = Math.floor(v + (bayer(x, y) - 0.5) * spread);
  return r[k < 0 ? 0 : k >= r.length ? r.length - 1 : k];
}

// ------------------------------------------------------------------------------------ sky

/**
 * sky-gradient — vertical banded gradient with dithered transitions.
 * Params: `colors` (top → bottom) | `ramp` + `reverse` (default 'sky', light at the bottom) |
 * `top` + `bottom` (colours; bands picked from the palette), `bands`, `dither` (0..0.5),
 * `stars` (count), `sun` ({ x, y, r } fractions/px; a sun or moon disc with a halo),
 * `moon` (true = pale moon).
 */
const skyGradient: BgGenerator = (w, h, p, seed) => {
  let colors: Color[];
  const listed = p.colors;
  if (Array.isArray(listed) && listed.length > 0) {
    colors = listed.filter((c): c is number => typeof c === 'number');
  } else if (typeof p.top === 'number' && typeof p.bottom === 'number') {
    const n = Math.max(2, num(p, 'bands', 5));
    colors = [];
    for (let i = 0; i < n; i++) {
      const c = nearest(lerpColor(p.top, p.bottom, i / (n - 1)));
      if (colors[colors.length - 1] !== c) colors.push(c);
    }
  } else {
    const r = rampParam(p, 'ramp', PAL.sky);
    colors = bool(p, 'reverse', false) ? [...r].reverse() : [...r];
  }
  const b = new PixelBuffer(w, h);
  const n = colors.length;
  const z = Math.max(0, Math.min(0.5, num(p, 'dither', 0.3)));
  const y0 = px(p, 'y0', 0, h);
  const y1 = px(p, 'y1', h, h);
  for (let y = 0; y < h; y++) {
    const u = Math.max(0, Math.min(n - 1e-6, ((y - y0 + 0.5) / Math.max(1, y1 - y0)) * n));
    for (let x = 0; x < w; x++) {
      const band = Math.floor(u);
      const f = u - band;
      let k = band;
      const thr = bayer(x, y);
      if (z > 0) {
        if (f > 1 - z && band + 1 < n && (f - (1 - z)) / (2 * z) > thr) k = band + 1;
        else if (f < z && band > 0 && (z - f) / (2 * z) > thr) k = band - 1;
      }
      b.data[y * w + x] = colors[k] >>> 0;
    }
  }
  const stars = num(p, 'stars', 0);
  for (let i = 0; i < stars; i++) {
    const x = Math.floor(hash2(i, 1, seed) * w);
    const y = Math.floor(hash2(i, 2, seed) ** 1.6 * h * 0.7);
    const bright = hash2(i, 3, seed) > 0.8;
    b.set(x, y, bright ? PAL.snow[3] : PAL.snow[1]);
    if (bright && hash2(i, 4, seed) > 0.5) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) setW(b, x + dx, y + dy, PAL.sky[2]);
    }
  }
  const sun = p.sun as { x?: number; y?: number; r?: number } | undefined;
  if (sun && typeof sun === 'object') {
    const sx = (sun.x ?? 0.7) <= 1 ? (sun.x ?? 0.7) * w : (sun.x ?? 0);
    const sy = (sun.y ?? 0.3) <= 1 ? (sun.y ?? 0.3) * h : (sun.y ?? 0);
    const sr = sun.r ?? 10;
    const moon = bool(p, 'moon', false);
    const core = moon ? PAL.snow[2] : PAL.gold[3];
    const rim = moon ? PAL.snow[0] : PAL.gold[2];
    for (let y = Math.floor(sy - sr * 2.2); y <= sy + sr * 2.2; y++) {
      for (let x = Math.floor(sx - sr * 2.2); x <= sx + sr * 2.2; x++) {
        const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy) / sr;
        if (d < 0.8) setW(b, x, y, core);
        else if (d < 1) setW(b, x, y, rim);
        else if (d < 1.9 && bayer(x, y) < (1.9 - d) * 0.35) setW(b, x, y, moon ? PAL.snow[0] : PAL.gold[3]);
      }
    }
    if (moon) {
      // Craters.
      setW(b, sx - sr * 0.3, sy - sr * 0.2, PAL.snow[0]);
      setW(b, sx + sr * 0.25, sy + sr * 0.3, PAL.snow[0]);
    }
  }
  return b;
};

// ------------------------------------------------------------------------------------ clouds

/**
 * clouds — puffy clouds with flat bottoms, lit from the top-left.
 * Params: `ramp` (default snow), `y` (cloud band centre, 0.25), `spread` (vertical jitter px),
 * `count` (per tile, 5), `size` (puff radius px, 9), `shadow` (colour of the flat underside).
 */
const clouds: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  const r = rampParam(p, 'ramp', PAL.snow);
  const yc = px(p, 'y', 0.25, h);
  const spread = num(p, 'spread', 18);
  const count = Math.max(1, Math.round(num(p, 'count', 5)));
  const size = num(p, 'size', 9);
  for (let i = 0; i < count; i++) {
    const cx = ((i + hash2(i, 1, seed) * 0.6) / count) * w;
    const cy = yc + (hash2(i, 2, seed) - 0.5) * spread * 2;
    const len = size * (2.2 + hash2(i, 3, seed) * 2.5);
    const puffs = 3 + Math.floor(hash2(i, 4, seed) * 4);
    const base = Math.round(cy + size * 0.5);
    for (let k = 0; k < puffs; k++) {
      const t = puffs === 1 ? 0.5 : k / (puffs - 1);
      const pxc = cx - len / 2 + t * len;
      const pr = size * (0.6 + Math.sin(t * Math.PI) * 0.7) * (0.8 + hash2(i, k + 10, seed) * 0.4);
      const pyc = base - pr * 0.75;
      for (let y = Math.floor(pyc - pr); y <= base; y++) {
        for (let x = Math.floor(pxc - pr); x <= pxc + pr; x++) {
          const d = Math.hypot(x + 0.5 - pxc, y + 0.5 - pyc) / pr;
          if (d > 1 || y < 0 || y >= h) continue;
          // Light: top-left of each puff; the flat underside is shaded.
          const lx = (x + 0.5 - pxc) / pr;
          const ly = (y + 0.5 - pyc) / pr;
          let v = (r.length - 1) * 0.65 - (lx + ly) * 0.9;
          if (y >= base - 1) v = 0.4;
          const c = dz(r, v, x, y, 0.8);
          // Keep the lighter colour where puffs overlap (soft unions).
          const old = getW(b, x, y);
          if ((old & 255) === 0 || r.indexOf(c) > r.indexOf(old)) setW(b, x, y, c);
        }
      }
    }
  }
  return b;
};

// ------------------------------------------------------------------------------------ ranges

/** Ridge profile 0..1 (periodic in w): peaks from ridged fractal noise. */
function ridge(x: number, w: number, scale: number, seed: number, sharp: number, octaves = 3): number {
  let v = 0;
  let amp = 1;
  let norm = 0;
  let s = scale;
  for (let o = 0; o < octaves; o++) {
    const n = noise1(x, s, w, seed + o * 31);
    const rg = 1 - Math.abs(n * 2 - 1);
    v += Math.pow(rg, sharp) * amp;
    norm += amp;
    amp *= 0.38;
    s = Math.max(4, s / 2.3);
  }
  return v / norm;
}


/**
 * Facet test for side-view ranges: a pixel `depth` px below the ridge at column x is on a
 * lit face when the ridge k px to its left is lower than k px to its right (the slope rises
 * toward the upper-left light). k grows with depth, so facet borders run diagonally down from
 * each peak instead of straight down.
 */
function litFacet(prof: Float64Array, x: number, depth: number, spread: number): boolean {
  const w = prof.length;
  const k = Math.max(1, Math.round(depth * spread));
  const wrap = (i: number): number => ((i % w) + w) % w;
  return prof[wrap(x - k)] > prof[wrap(x + k)];
}

interface RangeOpts {
  ramp: Ramp;
  top: number;
  height: number;
  scale: number;
  sharp: number;
  snowLine: number; // 0..1 of the height from the bottom; > 1 = no snow
  snow: Ramp;
}

/**
 * Fill a mountain range: clean lit faces (ground rising to the right faces the top-left
 * light) and shadow faces, decided from the smoothed large-scale ridge so each peak splits
 * into two clear facets; light gully streaks on lit faces; ragged snow caps.
 */
function drawRange(b: PixelBuffer, o: RangeOpts, seed: number): void {
  const { w, h } = b;
  const prof = new Float64Array(w);
  const coarse = new Float64Array(w);
  for (let x = 0; x < w; x++) {
    // Broad smooth massifs plus ridged peaks: no cup-shaped valleys or vertical walls.
    const broad = fbm1(x, o.scale * 1.6, w, seed + 77, 2);
    prof[x] = o.top + (1 - (0.5 * broad + 0.5 * ridge(x, w, o.scale, seed, o.sharp, 3))) * o.height;
    coarse[x] = o.top + (1 - (0.5 * broad + 0.5 * ridge(x, w, o.scale, seed, o.sharp, 1))) * o.height;
  }
  const n = o.ramp.length;
  const streakK = Math.max(1, Math.round(w / 9));
  for (let x = 0; x < w; x++) {
    const yTop = Math.round(prof[x]);
    for (let y = Math.max(0, yTop); y < h; y++) {
      const depth = y - yTop;
      // The light / shadow border leans down to the right from each peak (light from the upper
      // left), so broad massifs get sloped flanks instead of vertical walls.
      const lit = litFacet(coarse, x - Math.round(depth * 0.55), depth + 2, 0.8);
      const streak = lit && Math.sin((x / w) * Math.PI * 2 * streakK + depth * 0.6) > 0.9;
      const fall = depth / (o.height * 0.9);
      let v = (lit ? n - 1.6 : 1.1) - fall * 1.3;
      if (streak && depth < o.height * 0.22 && depth > 1) v += 0.7;
      if (depth === 0 && lit) v += 0.8;
      let c = dz(o.ramp, v, x, y, 0.35);
      const alt = 1 - (y - o.top) / o.height;
      if (alt > o.snowLine && depth < o.height * 0.3 + (noise1(x, 6, w, seed + 3) - 0.5) * 10) {
        const sv = lit ? o.snow.length - 1.2 : o.snow.length * 0.35;
        c = dz(o.snow, sv - depth * 0.03, x, y, 0.4);
      }
      b.data[y * w + x] = c >>> 0;
    }
  }
  b.touch();
}

/**
 * mountains — layered mountain silhouettes with optional snow caps.
 * Params: `ramp` (default stone), `y` (highest peaks, 0.2), `height` (0.55), `layers` (1–3;
 * farther layers are lighter), `scale` (peak spacing px, 90), `snow` (true or a snow line
 * 0..1 of the height, default false), `snowRamp`.
 */
const mountains: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  const r = rampParam(p, 'ramp', PAL.stone);
  const top = px(p, 'y', 0.2, h);
  const height = px(p, 'height', 0.55, h);
  const layers = Math.max(1, Math.min(3, Math.round(num(p, 'layers', 1))));
  const snowV = p.snow;
  const snowLine = snowV === true ? 0.62 : typeof snowV === 'number' ? snowV : 9;
  const snow = rampParam(p, 'snowRamp', PAL.snow);
  for (let l = layers - 1; l >= 0; l--) {
    // Farther layers: lighter shades, lower and smaller.
    const shift = l;
    const ramp = r.map((_, i) => r[Math.min(r.length - 1, i + shift)]);
    drawRange(
      b,
      {
        ramp,
        top: top + l * height * 0.18,
        height: height * (1 - l * 0.2),
        scale: num(p, 'scale', 90) * (1 - l * 0.25),
        sharp: 1.3,
        snowLine,
        snow,
      },
      seed + l * 101,
    );
  }
  return b;
};

/**
 * ice-peaks — sharp crystalline peaks: snow faces with blue shadows and glinting edges.
 * Params: `ramp` (default [navy1, sky0, sky1, sky2, snow1, white]), `y`, `height`, `scale`.
 */
const icePeaks: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  const r = rampParam(p, 'ramp', [PAL.navy[1], PAL.sky[0], PAL.sky[1], PAL.sky[2], PAL.snow[1], PAL.snow[3]]);
  const top = px(p, 'y', 0.15, h);
  const height = px(p, 'height', 0.6, h);
  const scale = num(p, 'scale', 70);
  const prof = new Float64Array(w);
  const coarse = new Float64Array(w);
  for (let x = 0; x < w; x++) {
    const broad = fbm1(x, scale * 1.5, w, seed + 77, 2);
    prof[x] = top + (1 - (0.35 * broad + 0.65 * ridge(x, w, scale, seed, 1.8, 2))) * height;
    coarse[x] = top + (1 - (0.35 * broad + 0.65 * ridge(x, w, scale, seed, 1.8, 1))) * height;
  }
  const n = r.length;
  const k = Math.max(1, Math.round(w / 23));
  for (let x = 0; x < w; x++) {
    const yTop = Math.round(prof[x]);
    for (let y = Math.max(0, yTop); y < h; y++) {
      const depth = y - yTop;
      const lit = litFacet(coarse, x, depth + 1, 0.6);
      let v = (lit ? n - 1.5 : 2.2) - depth / (height * 0.8);
      // A few crystal cleavage lines on the lit faces.
      if (lit && depth > 3 && depth < height * 0.4 && Math.sin((x / w) * Math.PI * 2 * k + y * 0.5) > 0.97) v -= 1;
      let c = dz(r, v, x, y, 0.35);
      if (depth === 0) c = lit ? PAL.snow[3] : r[Math.max(0, n - 3)];
      b.data[y * w + x] = c >>> 0;
    }
  }
  return b.touch();
};

/**
 * hills — smooth rolling hills with a lit rim and scattered bushes.
 * Params: `ramp` (default green), `y` (0.55), `height` (0.25), `scale` (120), `bushes` (true).
 */
const hills: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  const r = rampParam(p, 'ramp', PAL.green);
  const top = px(p, 'y', 0.55, h);
  const height = px(p, 'height', 0.25, h);
  const scale = num(p, 'scale', 120);
  const n = r.length;
  const prof = new Float64Array(w);
  for (let x = 0; x < w; x++) prof[x] = top + (1 - fbm1(x, scale, w, seed, 3)) * height;
  for (let x = 0; x < w; x++) {
    const yTop = Math.round(prof[x]);
    const slope = prof[(x + 1) % w] - prof[(x - 1 + w) % w];
    for (let y = Math.max(0, yTop); y < h; y++) {
      const depth = y - yTop;
      let v = (n - 1) * 0.55 + (depth < 2 ? 1.2 : 0) + (slope > 0.3 ? 0.5 : slope < -0.3 ? -0.5 : 0) - depth / 40;
      v += (noise2x(x, y, 5, w, seed + 5) - 0.5) * 0.6;
      b.data[y * w + x] = dz(r, v, x, y, 0.9) >>> 0;
    }
  }
  if (bool(p, 'bushes', true)) {
    const count = Math.round(w / 40);
    for (let i = 0; i < count; i++) {
      const bx = Math.floor(hash2(i, 1, seed) * w);
      const by = Math.round(prof[bx]) + 2 + Math.floor(hash2(i, 2, seed) * 10);
      const br = 2 + Math.floor(hash2(i, 3, seed) * 3);
      for (let y = by - br; y <= by + br; y++) {
        for (let x = bx - br; x <= bx + br; x++) {
          const d = Math.hypot(x - bx, y - by) / br;
          if (d <= 1 && y >= 0 && y < h) setW(b, x, y, dz(r, 1 + (-(x - bx) - (y - by)) / br, x, y, 0.8));
        }
      }
    }
  }
  return b.touch();
};

// ------------------------------------------------------------------------------------ foliage

/**
 * One round, lumpy tree crown with clean top-left shading. `base` = ramp index of the mid tone.
 */
function crown(b: PixelBuffer, cx: number, cy: number, cr: number, r: Ramp, base: number, seed: number, id: number): void {
  const h = b.h;
  for (let y = Math.floor(cy - cr); y <= cy + cr; y++) {
    if (y < 0 || y >= h) continue;
    for (let x = Math.floor(cx - cr); x <= cx + cr; x++) {
      const dx = (x + 0.5 - cx) / cr;
      const dy = (y + 0.5 - cy) / cr;
      // Lumpy edge: 7 bumps around the crown.
      const a = Math.atan2(dy, dx);
      const edge = 1 + Math.sin(a * 7 + id) * 0.06 + (hash2(Math.round(a * 4), id, seed) - 0.5) * 0.1;
      const d2 = dx * dx + dy * dy;
      if (d2 > edge * edge) continue;
      // Light from the top-left plus a darker rim at the bottom-right.
      let v = base - (dx + dy) * 1.0 + (d2 < 0.3 ? 0.2 : 0);
      if (d2 > 0.75 && dx + dy > 0.3) v -= 0.6;
      setW(b, x, y, dz(r, v, x, y, 0.5));
    }
  }
}

/**
 * treeline — a band of round tree crowns over a dark forest base.
 * Params: `ramp` (default green), `y` (crown tops, 0.5), `height` (band height, 0.3),
 * `size` (crown radius px, 9), `trunks` (true).
 */
const treeline: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  const r = rampParam(p, 'ramp', PAL.green);
  const top = px(p, 'y', 0.5, h);
  const height = px(p, 'height', 0.3, h);
  const size = num(p, 'size', 9);
  const n = r.length;
  // Dark mass under the crowns.
  const base = top + Math.round(size * 1.3);
  for (let y = base; y < h; y++) for (let x = 0; x < w; x++) b.data[y * w + x] = dz(r, 0.9 - (y - base) / 70, x, y, 0.6) >>> 0;
  const count = Math.max(4, Math.round(w / (size * 1.3)));
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < count; i++) {
      const cx = ((i + hash2(i, pass, seed) * 0.8) / count) * w;
      const cr = size * (0.75 + hash2(i, 5 + pass, seed) * 0.6);
      const cy = top + cr + (pass === 0 ? 0 : height * 0.25) + hash2(i, 9 + pass, seed) * height * 0.3;
      if (bool(p, 'trunks', true) && pass === 1) {
        for (let y = Math.round(cy); y < Math.min(h, cy + height); y++) setW(b, cx, y, PAL.brown[0]);
      }
      crown(b, cx, cy, cr, r, (n - 1) * (pass === 0 ? 0.45 : 0.62), seed, i + pass * 50);
    }
  }
  return b;
};

/**
 * jungle — dense layered foliage: big dark canopy crowns, lighter mid crowns, drooping
 * fronds and hanging vines.
 * Params: `ramp` (default green), `y` (top of the canopy, 0.05), `height` (0.85),
 * `vines` (true), `fronds` (per tile, w / 26).
 */
const jungle: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  const r = rampParam(p, 'ramp', PAL.green);
  const top = px(p, 'y', 0.05, h);
  const height = px(p, 'height', 0.85, h);
  const n = r.length;
  // Solid canopy mass below a gently waving line, darker deeper in.
  const line = new Float64Array(w);
  for (let x = 0; x < w; x++) line[x] = top + 10 + fbm1(x, 60, w, seed, 2) * 12;
  for (let x = 0; x < w; x++) {
    for (let y = Math.max(0, Math.round(line[x])); y < h; y++) b.data[y * w + x] = dz(r, 1.2 - (y - line[x]) / (height * 0.9), x, y, 0.5) >>> 0;
  }
  // Crowns: a dense back row forming the bumpy top, then lighter clusters inside the mass.
  const rows: Array<[number, number, number, number]> = [
    [Math.round(w / 13), 12, 0, (n - 1) * 0.42],
    [Math.round(w / 11), 11, height * 0.22, (n - 1) * 0.55],
    [Math.round(w / 10), 11, height * 0.42, (n - 1) * 0.66],
    [Math.round(w / 12), 10, height * 0.66, (n - 1) * 0.5],
  ];
  rows.forEach(([count, size, dy, base], row) => {
    for (let i = 0; i < count; i++) {
      const cx = ((i + hash2(i, row, seed) * 0.9) / count) * w;
      const cr = size * (0.8 + hash2(i, row + 7, seed) * 0.45);
      const col = ((Math.round(cx) % w) + w) % w;
      const cy = line[col] + dy + (hash2(i, row + 13, seed) - 0.5) * size * 0.8;
      crown(b, cx, cy, cr, r, base, seed, i + row * 100);
    }
  });
  // Drooping fronds: a thick rib with leaflets on both sides.
  const fronds = Math.round(num(p, 'fronds', w / 26));
  for (let i = 0; i < fronds; i++) {
    const fx = hash2(i, 1, seed) * w;
    const fy = top + height * (0.2 + hash2(i, 2, seed) * 0.6);
    const len = 12 + hash2(i, 3, seed) * 12;
    const dir = hash2(i, 4, seed) > 0.5 ? 1 : -1;
    for (let k = 0; k < len; k++) {
      const t = k / len;
      const x = fx + dir * k;
      const y = Math.round(fy + t * t * len * 0.7);
      if (y < 0 || y >= h) continue;
      setW(b, x, y, r[n - 2]);
      const leaf = Math.round((1 - t) * 3) + 1;
      if (k % 2 === 0) {
        for (let j = 1; j <= leaf; j++) {
          if (y - j >= 0) setW(b, x - dir * j * 0.5, y - j, r[n - 1]);
          if (y + j < h) setW(b, x - dir * j * 0.5, y + j, r[Math.max(0, n - 3)]);
        }
      }
    }
  }
  if (bool(p, 'vines', true)) {
    const vines = Math.round(w / 30);
    for (let i = 0; i < vines; i++) {
      const vx = Math.floor(hash2(i, 7, seed) * w);
      const len = 20 + hash2(i, 8, seed) * height * 0.6;
      for (let y = top; y < Math.min(h, top + len); y++) {
        const x = vx + Math.round(Math.sin(y * 0.15 + i) * 1.2);
        setW(b, x, y, r[1]);
        if (y % 6 === 0) {
          setW(b, x + 1, y, r[3]);
          setW(b, x + 2, y + 1, r[2]);
        }
      }
    }
  }
  return b.touch();
};

// ------------------------------------------------------------------------------------ built

/**
 * city — a skyline of buildings with window grids, roof details and antennas.
 * Params: `ramp` (default [navy0, navy1, steel0, steel1, steel2]), `y` (tallest roofs, 0.25),
 * `height` (0.55), `windows` (lit window colour, gold 2), `lit` (fraction lit, 0.35),
 * `night` (true: dark buildings with lit windows; false: lit facades).
 */
const city: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  const r = rampParam(p, 'ramp', [PAL.navy[0], PAL.navy[1], PAL.steel[0], PAL.steel[1], PAL.steel[2]]);
  const top = px(p, 'y', 0.25, h);
  const height = px(p, 'height', 0.55, h);
  const lit = num(p, 'lit', 0.35);
  const winC = colorParam(p, 'windows', PAL.gold[2]);
  const night = bool(p, 'night', true);
  const n = r.length;
  const ground = top + height;
  // Buildings fill the tile exactly so the skyline wraps.
  let x0 = 0;
  let i = 0;
  while (x0 < w) {
    let bw = 14 + Math.floor(hash2(i, 1, seed) * 26);
    if (w - (x0 + bw) < 14) bw = w - x0;
    const bh = Math.round(height * (0.35 + hash2(i, 2, seed) * 0.65));
    const by = ground - bh;
    const tone = Math.floor(hash2(i, 3, seed) * 2);
    for (let y = Math.max(0, by); y < h; y++) {
      for (let x = x0; x < x0 + bw; x++) {
        let v = 1 + tone;
        if (x === x0) v += 1; // lit left edge
        if (x === x0 + bw - 1) v -= 1;
        if (y === by) v += 1; // roof lip
        b.data[y * w + (x % w)] = r[Math.max(0, Math.min(n - 1, v))] >>> 0;
      }
    }
    // Windows: 2×2 cells on a 4×5 grid.
    for (let y = by + 3; y < ground - 2; y += 5) {
      for (let x = x0 + 2; x < x0 + bw - 3; x += 4) {
        const on = hash2(x, y, seed) < lit;
        const c = on ? winC : night ? r[0] : r[Math.min(n - 1, 3 + tone)];
        for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) b.set((x + xx) % w, y + yy, c);
      }
    }
    // Roof details: antenna, water tank or stepped top.
    const roof = hash2(i, 4, seed);
    const mid = x0 + Math.floor(bw / 2);
    if (roof < 0.3) {
      for (let y = by - 7; y < by; y++) setW(b, mid, y, r[2]);
      setW(b, mid, by - 8, PAL.red[3]);
    } else if (roof < 0.55 && bw > 18) {
      for (let y = by - 6; y < by; y++) for (let x = mid - 3; x <= mid + 3; x++) setW(b, x, y, y === by - 6 ? r[3] : r[2]);
      setW(b, mid - 2, by - 1, r[0]);
      setW(b, mid + 2, by - 1, r[0]);
    } else if (roof < 0.75 && bw > 20) {
      for (let y = by - 4; y < by; y++) for (let x = x0 + 3; x < x0 + bw - 3; x++) setW(b, x, y, x === x0 + 3 ? r[3] : r[2]);
    }
    x0 += bw;
    i++;
  }
  return b;
};

/**
 * ruins — broken walls with jagged tops, dark window holes and rubble.
 * Params: `ramp` (default stone), `y` (0.35), `height` (0.5), `rebar` (true).
 */
const ruins: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  const r = rampParam(p, 'ramp', PAL.stone);
  const top = px(p, 'y', 0.35, h);
  const height = px(p, 'height', 0.5, h);
  const ground = top + height;
  let x0 = 0;
  let i = 0;
  while (x0 < w) {
    let bw = 18 + Math.floor(hash2(i, 1, seed) * 30);
    const gap = 4 + Math.floor(hash2(i, 6, seed) * 14);
    if (w - (x0 + bw + gap) < 18) {
      bw = Math.max(6, w - x0 - gap);
    }
    const bh = height * (0.3 + hash2(i, 2, seed) * 0.7);
    for (let x = x0; x < x0 + bw; x++) {
      // Jagged broken top.
      const jag = (noise1(x, 4, w, seed + 3) - 0.5) * 14 + (hash1(x, seed) - 0.5) * 3;
      const yTop = Math.round(ground - bh + jag);
      for (let y = Math.max(0, yTop); y < h; y++) {
        let v = 1.5 + (x === x0 ? 1 : 0) - (x === x0 + bw - 1 ? 1 : 0) + (y === yTop ? 1 : 0);
        // Brick courses.
        if ((y - ground) % 6 === 0) v -= 0.6;
        b.data[y * w + (x % w)] = dz(r, v, x, y, 0.7) >>> 0;
      }
    }
    // Window holes and an arch.
    for (let y = Math.round(ground - bh + 10); y < ground - 6; y += 12) {
      for (let x = x0 + 4; x < x0 + bw - 6; x += 9) {
        if (hash2(x, y, seed) < 0.7) for (let yy = 0; yy < 6; yy++) for (let xx = 0; xx < 4; xx++) setW(b, x + xx, y + yy, r[0]);
      }
    }
    if (bool(p, 'rebar', true) && hash2(i, 7, seed) > 0.5) {
      const rx = x0 + Math.floor(bw / 2);
      const ry = Math.round(ground - bh) - 2;
      for (let k = 0; k < 5; k++) setW(b, rx + Math.round(k * 0.4), ry - k, PAL.rust[1]);
    }
    x0 += bw + gap;
    i++;
  }
  // Rubble along the bottom: overlapping lumps, lit from the top-left.
  for (let x = 0; x < w; x++) {
    const yTop = Math.round(ground - 3 - fbm1(x, 14, w, seed + 9, 2) * 8);
    for (let y = Math.max(0, yTop); y < h; y++) b.data[y * w + x] = dz(r, 0.8 - (y - yTop) / 30, x, y, 0.5) >>> 0;
  }
  const lumps = Math.round(w / 9);
  for (let i = 0; i < lumps; i++) {
    const cx = hash2(i, 1, seed + 5) * w;
    const lr = 2 + hash2(i, 2, seed + 5) * 3.5;
    const cy = ground - 2 - hash2(i, 3, seed + 5) * 6;
    for (let y = Math.floor(cy - lr); y <= cy + lr; y++) {
      for (let x = Math.floor(cx - lr); x <= cx + lr; x++) {
        const dx = (x + 0.5 - cx) / lr;
        const dy = (y + 0.5 - cy) / lr;
        if (dx * dx + dy * dy > 1 || y < 0 || y >= h) continue;
        setW(b, x, y, dz(r, 1.6 - (dx + dy) * 1.1, x, y, 0.4));
      }
    }
  }
  return b.touch();
};

/**
 * dunes — smooth sand dunes with sharp crests, lit and shaded faces and ripples.
 * Params: `ramp` (default sand), `y` (0.55), `height` (0.3), `waves` (dunes per tile, 3).
 */
const dunes: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  const r = rampParam(p, 'ramp', PAL.sand);
  const top = px(p, 'y', 0.55, h);
  const height = px(p, 'height', 0.3, h);
  const waves = Math.max(1, Math.round(num(p, 'waves', 3)));
  const n = r.length;
  const phase = hash1(1, seed) * Math.PI * 2;
  const prof = new Float64Array(w);
  for (let x = 0; x < w; x++) {
    const a = (x / w) * Math.PI * 2 * waves + phase;
    // Skewed wave: gentle windward slope, steep lee face.
    const s = Math.sin(a + 0.35 * Math.sin(a));
    prof[x] = top + (1 - (s * 0.5 + 0.5)) * height * 0.8 + fbm1(x, 60, w, seed, 2) * height * 0.2;
  }
  for (let x = 0; x < w; x++) {
    const yTop = Math.round(prof[x]);
    for (let y = Math.max(0, yTop); y < h; y++) {
      const depth = y - yTop;
      const lit = litFacet(prof, x, depth + 2, 1.2);
      let v = (n - 1) * 0.55 + (lit ? 0.8 : -0.8) - depth / (height * 2.5);
      // Wind ripples (whole waves per tile, so the pattern wraps).
      const k = Math.max(1, Math.round((w * 0.45) / (Math.PI * 2)));
      v += Math.sin((x / w) * Math.PI * 2 * k + y * 1.17 + noise1(x, 20, w, seed) * 6) > 0.85 ? -0.7 : 0;
      b.data[y * w + x] = dz(r, v, x, y, 0.7) >>> 0;
    }
  }
  return b.touch();
};

/**
 * sea — open water from a horizon line down: banded depth, wave dashes and sun sparkles.
 * Params: `ramp` (default [navy0, navy1, sky0, sky1, sky2]), `y` (horizon, 0.6),
 * `sparkle` (0..1, 0.5), `foam` (colour of wave crests, snow 2).
 */
const sea: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  const r = rampParam(p, 'ramp', [PAL.navy[0], PAL.navy[1], PAL.sky[0], PAL.sky[1], PAL.sky[2]]);
  const top = px(p, 'y', 0.6, h);
  const sparkle = num(p, 'sparkle', 0.5);
  const foam = colorParam(p, 'foam', PAL.snow[2]);
  const n = r.length;
  for (let y = Math.max(0, top); y < h; y++) {
    const t = (y - top) / Math.max(1, h - top);
    for (let x = 0; x < w; x++) {
      // Lighter near the horizon, deeper toward the viewer.
      let v = (n - 1) * (0.85 - t * 0.7);
      // Wave dashes: short light streaks that get longer and further apart near the bottom.
      const row = y - top;
      const spacing = 3 + Math.floor(row / 8);
      const dash = noise1(x + row * 17, 6 + row * 0.4, w, seed + row) > 0.62;
      if (row % spacing === 0 && dash) v += 1.2;
      b.data[y * w + x] = dz(r, v, x, y, 0.6) >>> 0;
      if (row % spacing === 0 && dash && hash2(x, y, seed) < sparkle * 0.08) b.data[y * w + x] = foam >>> 0;
    }
  }
  // Horizon line.
  if (top >= 0 && top < h) for (let x = 0; x < w; x++) b.data[top * w + x] = r[n - 1] >>> 0;
  return b.touch();
};

/** Ids of every generator registered here. */
export const BG_GENERATOR_IDS = [
  'sky-gradient',
  'clouds',
  'mountains',
  'hills',
  'treeline',
  'jungle',
  'city',
  'ruins',
  'dunes',
  'ice-peaks',
  'sea',
] as const;

defineBgGenerator('sky-gradient', skyGradient);
defineBgGenerator('clouds', clouds);
defineBgGenerator('mountains', mountains);
defineBgGenerator('hills', hills);
defineBgGenerator('treeline', treeline);
defineBgGenerator('jungle', jungle);
defineBgGenerator('city', city);
defineBgGenerator('ruins', ruins);
defineBgGenerator('dunes', dunes);
defineBgGenerator('ice-peaks', icePeaks);
defineBgGenerator('sea', sea);
