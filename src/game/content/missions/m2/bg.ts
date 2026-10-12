/**
 * Mission m2 (DUNE BUGLE) custom background generators (GDD §15.5, docs/ART_GUIDE.md §7):
 *
 * - `cacti`           saguaro silhouettes in dark green-brown (m2-a/b near layer, 0.8).
 *                     Params: `ramp` (dark → light, default [ink1, teal0, green0, olive1]),
 *                     `base` (y of the cactus feet, px or fraction, 0.86), `count` (per tile, 3),
 *                     `height` (tallest, px, 54), `skulls` (bleached cow skulls at the feet, true).
 * - `canyon-walls`    striped red-orange rock walls with a ragged rim, strata and cracks.
 *                     Params: `ramp` (default rust/orange stripes), `y` (rim, 0.1), `rough` (rim
 *                     wobble px, 18), `dark` (shift every stripe 1 shade darker: the near wall).
 * - `rock-pillars`    sparse dark rock pillars for the front layer (front: true, factor > 1).
 *                     Params: `ramp` (default [ink0, ink1, brown0, rust0]), `count` (per tile, 1),
 *                     `width` (px, 22), `y` (top of the tallest, 0.15).
 * - `quarry-terraces` stepped orange rock terraces, two cranes and a giant crimson drum banner.
 *                     Params: `ramp` (default orange/sand), `y` (top terrace, 0.3), `steps` (4),
 *                     `cranes` (true), `banner` (true).
 *
 * Every generator returns exactly w × h, tiles horizontally without a seam (period-w noise,
 * shapes that cross the right edge are drawn again at x − w) and is deterministic per seed.
 */
import type { Color } from '../../../../engine/color';
import { PixelBuffer, type Ramp } from '../../../../engine/pixel';
import { INK, PAL, ramp as rampByName } from '../../../../engine/palette';
import { defineBgGenerator, type BgGenerator } from '../../../art/art-registry';
import { bayer, fbm1, hash1, hash2, noise1 } from '../../../art/paint';

type Params = Readonly<Record<string, unknown>>;

function num(p: Params, k: string, d: number): number {
  const v = p[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

/** A px value; numbers in (0, 1] are fractions of `of`. */
function px(p: Params, k: string, d: number, of: number): number {
  const v = num(p, k, d);
  return Math.abs(v) <= 1 && v !== 0 ? Math.round(v * of) : Math.round(v);
}

function bool(p: Params, k: string, d: boolean): boolean {
  const v = p[k];
  return typeof v === 'boolean' ? v : d;
}

function rampParam(p: Params, k: string, d: Ramp): Ramp {
  const v = p[k];
  if (typeof v === 'string') return rampByName(v);
  if (Array.isArray(v) && v.length > 0 && v.every((c) => typeof c === 'number')) return v as Ramp;
  return d;
}

/** Ramp colour for a continuous index with ordered dither. */
function dz(r: Ramp, v: number, x: number, y: number, spread = 1): Color {
  const k = Math.floor(v + (bayer(x, y) - 0.5) * spread);
  return r[k < 0 ? 0 : k >= r.length ? r.length - 1 : k];
}

/** Set a pixel with horizontal wrap (seamless tiling) and vertical clipping. */
function setW(b: PixelBuffer, x: number, y: number, c: Color): void {
  if (y < 0 || y >= b.h) return;
  const w = b.w;
  b.data[y * w + ((((Math.round(x) % w) + w) % w) >>> 0)] = c >>> 0;
}

function rectW(b: PixelBuffer, x: number, y: number, w: number, h: number, c: Color): void {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) setW(b, x + i, y + j, c);
}

/** 1-px INK outline around every opaque pixel, wrapping horizontally. */
function outlineW(b: PixelBuffer, c: Color = INK): void {
  const w = b.w;
  const h = b.h;
  const src = b.data.slice();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (src[y * w + x] !== 0) continue;
      const l = src[y * w + ((x + w - 1) % w)];
      const r = src[y * w + ((x + 1) % w)];
      const u = y > 0 ? src[(y - 1) * w + x] : 0;
      const d = y < h - 1 ? src[(y + 1) * w + x] : 0;
      if (l !== 0 || r !== 0 || u !== 0 || d !== 0) b.data[y * w + x] = c >>> 0;
    }
  }
}

// ------------------------------------------------------------------------------------ cacti

/** One saguaro: trunk + up to two arms, lit from the top-left. */
function saguaro(b: PixelBuffer, cx: number, base: number, height: number, arms: number, r: Ramp, seed: number): void {
  const tw = height > 40 ? 8 : 6;
  const top = base - height;
  const lit = r[Math.min(r.length - 1, 2)];
  const mid = r[1];
  const dark = r[0];
  const rib = r[Math.min(r.length - 1, 3)];
  const column = (x0: number, y0: number, y1: number, w: number): void => {
    for (let y = y0; y <= y1; y++) {
      // Rounded cap: the top 2 rows are narrower.
      const inset = y - y0 < 1 ? 2 : y - y0 < 2 ? 1 : 0;
      for (let i = inset; i < w - inset; i++) setW(b, x0 + i, y, i <= 1 ? lit : i >= w - 2 ? dark : mid);
      // A vertical rib line every 3 px.
      if (w >= 6 && y > y0 + 2) setW(b, x0 + (w >> 1), y, (y & 1) === 0 ? rib : lit);
    }
  };
  column(cx - (tw >> 1), top, base + 8, tw);
  for (let a = 0; a < arms; a++) {
    const side = a === 0 ? (hash1(seed, 3) < 0.5 ? -1 : 1) : 0;
    const dir = a === 0 ? side : -(hash1(seed, 3) < 0.5 ? -1 : 1);
    const ay = top + Math.round(height * (0.35 + 0.25 * hash1(seed + a, 5)));
    const aw = tw - 2;
    const reach = 7 + Math.round(4 * hash1(seed + a, 7));
    // The elbow: a horizontal stub out of the trunk, then the arm goes up.
    const x0 = dir < 0 ? cx - (tw >> 1) - reach : cx + (tw >> 1);
    for (let y = ay; y < ay + aw; y++) for (let i = 0; i < reach; i++) setW(b, x0 + i, y, y === ay ? lit : y === ay + aw - 1 ? dark : mid);
    const ax = dir < 0 ? cx - (tw >> 1) - reach : cx + (tw >> 1) + reach - aw;
    const armTop = ay - Math.round(height * (0.2 + 0.2 * hash1(seed + a, 9)));
    column(ax, armTop, ay + aw - 1, aw);
  }
}

/** A bleached cow skull lying in the sand (5 px tall). */
function skull(b: PixelBuffer, x: number, y: number): void {
  const bone = PAL.snow[2];
  const shade = PAL.stone[2];
  rectW(b, x, y - 4, 7, 3, bone);
  rectW(b, x + 1, y - 1, 5, 1, shade);
  setW(b, x + 2, y - 3, INK);
  setW(b, x + 4, y - 3, INK);
  // Horns.
  setW(b, x - 1, y - 5, bone);
  setW(b, x - 2, y - 6, bone);
  setW(b, x + 7, y - 5, bone);
  setW(b, x + 8, y - 6, bone);
}

const cacti: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  const r = rampParam(p, 'ramp', [PAL.ink[1], PAL.teal[0], PAL.green[0], PAL.olive[1]]);
  const base = px(p, 'base', 0.86, h);
  const count = Math.max(1, Math.round(num(p, 'count', 3)));
  const tall = num(p, 'height', 54);
  const skulls = bool(p, 'skulls', true);
  const slot = w / count;
  for (let i = 0; i < count; i++) {
    const x = Math.round(slot * i + slot * (0.2 + 0.6 * hash1(i, seed)));
    const height = Math.round(tall * (0.45 + 0.55 * hash1(i, seed + 11)));
    const arms = height > 30 ? (hash1(i, seed + 13) < 0.7 ? 2 : 1) : hash1(i, seed + 13) < 0.5 ? 1 : 0;
    saguaro(b, x, base + Math.round(4 * hash1(i, seed + 17)), height, arms, r, seed * 31 + i);
    if (skulls && hash1(i, seed + 19) < 0.5) skull(b, x + 14 + Math.round(10 * hash1(i, seed + 23)), base + 2);
  }
  outlineW(b);
  return b.touch();
};

// ------------------------------------------------------------------------------------ canyon walls

const canyonWalls: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  const dark = bool(p, 'dark', false);
  const base: Ramp = [PAL.brown[0], PAL.rust[0], PAL.rust[1], PAL.orange[0], PAL.orange[1], PAL.sand[2]];
  const r0 = rampParam(p, 'ramp', base);
  const r: Ramp = dark ? [PAL.ink[1], ...r0.slice(0, r0.length - 1)] : r0;
  const n = r.length;
  const top = px(p, 'y', 0.1, h);
  const rough = num(p, 'rough', 18);
  // Rim profile: big buttes + small notches, periodic in w.
  const rim = new Int16Array(w);
  for (let x = 0; x < w; x++) {
    const big = fbm1(x, 128, w, seed, 2);
    const notch = noise1(x, 16, w, seed + 7);
    rim[x] = Math.round(top + big * rough + (notch > 0.7 ? (notch - 0.7) * 30 : 0));
  }
  // Stratum offsets: each band wobbles a little along x.
  for (let x = 0; x < w; x++) {
    const wob = (fbm1(x, 64, w, seed + 3, 2) - 0.5) * 8;
    // Vertical crack columns (periodic): every crack is a dark 1-px line that wanders.
    const crack = noise1(x, 24, w, seed + 5) > 0.82;
    for (let y = Math.max(0, rim[x]); y < h; y++) {
      const depth = y - rim[x];
      // Stripes: alternate light / dark bands, 6–14 px thick (from a hash of the band index).
      const band = Math.floor((y + wob) / 9);
      const stripe = hash1(band, seed + 9);
      let v = (n - 1) * 0.55 + (stripe - 0.5) * 2.4;
      // Lit rim, a shadow under it, and darker toward the bottom (canyon depth).
      if (depth < 2) v = n - 1;
      else if (depth < 5) v -= 0.6;
      v -= (y / h) * 1.4;
      // Band edges are a darker line.
      if (Math.floor((y + 1 + wob) / 9) !== band) v -= 1;
      if (crack && depth > 6 && hash2(x, y >> 3, seed) < 0.8) v = 0.2;
      b.data[y * w + x] = dz(r, v, x, y, 0.6) >>> 0;
    }
  }
  return b.touch();
};

// ------------------------------------------------------------------------------------ rock pillars

const rockPillars: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  const r = rampParam(p, 'ramp', [PAL.ink[0], PAL.ink[1], PAL.brown[0], PAL.rust[0]]);
  const count = Math.max(1, Math.round(num(p, 'count', 1)));
  const pw = num(p, 'width', 22);
  const top = px(p, 'y', 0.15, h);
  const slot = w / count;
  for (let i = 0; i < count; i++) {
    const cx = Math.round(slot * i + slot * (0.25 + 0.5 * hash1(i, seed)));
    const ptop = top + Math.round(hash1(i, seed + 3) * h * 0.25);
    const width = Math.round(pw * (0.8 + 0.4 * hash1(i, seed + 5)));
    for (let y = ptop; y < h; y++) {
      // The pillar narrows a little toward its top and has lumpy sides.
      const t = (y - ptop) / Math.max(1, h - ptop);
      const half = Math.round((width / 2) * (0.75 + 0.25 * t) + (noise1(y, 8, 512, seed + i) - 0.5) * 3);
      for (let dx = -half; dx <= half; dx++) {
        const edge = dx === -half || dx === -half + 1;
        const c = edge ? r[3] : dx > half - 3 ? r[0] : (y >> 2) % 5 === 0 ? r[2] : r[1];
        setW(b, cx + dx, y, c);
      }
    }
    // A rounded cap.
    for (let dx = -(width >> 2); dx <= width >> 2; dx++) setW(b, cx + dx, ptop - 1, r[2]);
  }
  return b.touch();
};

// ------------------------------------------------------------------------------------ quarry terraces

/** A lattice crane: a mast, a long boom with a hook. */
function crane(b: PixelBuffer, x: number, base: number, height: number, reach: number, c: Color, hi: Color): void {
  const top = base - height;
  for (let y = top; y < base; y++) {
    setW(b, x, y, c);
    setW(b, x + 4, y, c);
    if ((y - top) % 6 === 0) for (let i = 1; i < 4; i++) setW(b, x + i, y, c);
    else setW(b, x + 1 + (((y - top) % 6) >> 1), y, hi);
  }
  // Boom (to the right) and counter-jib (left).
  for (let i = -10; i < reach; i++) {
    setW(b, x + 2 + i, top, c);
    setW(b, x + 2 + i, top + 3, c);
    if (i % 5 === 0) {
      setW(b, x + 2 + i, top + 1, c);
      setW(b, x + 2 + i, top + 2, c);
    }
  }
  rectW(b, x - 8, top + 4, 5, 4, c);
  // Cable and hook.
  const hx = x + 2 + reach - 6;
  for (let y = top + 4; y < top + 30; y++) setW(b, hx, y, c);
  rectW(b, hx - 1, top + 30, 3, 2, hi);
}

/** The giant crimson drum banner hanging from the top terrace (the Legion's drum crest). */
function drumBanner(b: PixelBuffer, x: number, y: number): void {
  const W = 44;
  const H = 64;
  const red = PAL.red;
  const gold = PAL.gold;
  rectW(b, x - 2, y - 2, W + 4, 2, PAL.brown[1]);
  for (let j = 0; j < H; j++) {
    // Swallow-tail cut at the bottom.
    const cut = j > H - 10 ? j - (H - 10) : 0;
    for (let i = 0; i < W; i++) {
      if (cut > 0 && i > (W >> 1) - cut && i < (W >> 1) + cut) continue;
      const c = i < 2 ? red[3] : i > W - 3 ? red[0] : j % 16 === 15 ? red[1] : red[2];
      setW(b, x + i, y + j, c);
    }
  }
  // Gold trim and the drum crest: a bass drum seen from the front with crossed sticks.
  for (let i = 0; i < W; i++) {
    setW(b, x + i, y + 2, gold[2]);
    setW(b, x + i, y + 4, gold[1]);
  }
  const cx = x + (W >> 1);
  const cy = y + 28;
  for (let a = 0; a < 64; a++) {
    const t = (a / 64) * Math.PI * 2;
    for (const rad of [11, 12]) setW(b, cx + Math.round(Math.cos(t) * rad), cy + Math.round(Math.sin(t) * rad), rad === 12 ? gold[1] : gold[2]);
  }
  for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) if (dx * dx + dy * dy <= 81) setW(b, cx + dx, cy + dy, dx + dy < -4 ? PAL.snow[3] : PAL.snow[2]);
  for (let i = -12; i <= 12; i++) {
    setW(b, cx + i, cy - 14 + Math.abs(i) / 3, PAL.brown[2]);
    setW(b, cx + i, cy - 14 - i / 2 + 6, PAL.brown[2]);
  }
  rectW(b, cx - 3, cy - 2, 6, 4, red[2]);
}

const quarryTerraces: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  const r = rampParam(p, 'ramp', [PAL.brown[0], PAL.rust[0], PAL.rust[1], PAL.orange[0], PAL.orange[1], PAL.sand[2]]);
  const n = r.length;
  const top = px(p, 'y', 0.3, h);
  const steps = Math.max(2, Math.round(num(p, 'steps', 4)));
  const stepH = Math.max(8, Math.round((h - top) / (steps + 1)));
  // Each terrace has its own lip profile; lower terraces stick out further (lighter faces).
  for (let s = 0; s < steps; s++) {
    const lipY = top + s * stepH;
    for (let x = 0; x < w; x++) {
      const lip = lipY + Math.round((fbm1(x, 96, w, seed + s * 17, 2) - 0.5) * 8);
      // Every terrace is a lit top ledge (3 px), a vertical cut face with drill marks and a
      // dark foot shadow.
      for (let y = Math.max(0, lip); y < h; y++) {
        const d = y - lip;
        let v: number;
        if (d < 3) v = n - 1 - (s === 0 ? 0 : 0.4);
        else if (d < stepH - 3) {
          v = (n - 1) * 0.55 - s * 0.15 + (((x + s * 7) % 11 === 0 && d > 5) ? -1 : 0);
          v += (hash2(x >> 2, (y + s * 3) >> 2, seed) - 0.5) * 0.8;
        } else v = 0.8;
        b.data[y * w + x] = dz(r, v, x, y, 0.7) >>> 0;
      }
    }
  }
  if (bool(p, 'cranes', true)) {
    crane(b, Math.round(w * 0.12 + hash1(1, seed) * 30), top + 6, Math.round(h * 0.45), 46, PAL.brown[0], PAL.rust[1]);
    crane(b, Math.round(w * 0.68 + hash1(2, seed) * 30), top + stepH + 4, Math.round(h * 0.38), 38, PAL.brown[0], PAL.rust[1]);
  }
  if (bool(p, 'banner', true)) drumBanner(b, Math.round(w * 0.36), top + 3);
  return b.touch();
};

defineBgGenerator('cacti', cacti);
defineBgGenerator('canyon-walls', canyonWalls);
defineBgGenerator('rock-pillars', rockPillars);
defineBgGenerator('quarry-terraces', quarryTerraces);
