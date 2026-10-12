/**
 * Mission m3 (THE HIGH NOTE) custom background generators (GDD §15.5, docs/ART_GUIDE.md §7):
 *
 * - `chalets`    a row of wooden alpine chalets with snowy roofs, lit windows and crimson Legion
 *                banners, pines between them, snow drifts to the bottom (m3-a near layer, 0.55).
 *                Params: `y` (eave line of the tallest chalet, 0.5), `base` (chalet feet, 0.8),
 *                `count` (per tile, 3), `pines` (true), `dim` (one shade darker: farther away).
 * - `ice-cave`   blue-violet crystal walls with softly glowing crystal clusters (m3-b2).
 *                Params: `dark` (the far layer: bigger, dimmer shapes), `count` (clusters per
 *                256 px of height, 3), `glow` (true).
 * - `cable-cars` cable-car pylons with two sagging cables and small cabins hanging from them
 *                (m3-c, 0.5). Params: `y` (cable height at the pylons, 0.3), `sag` (px, 26),
 *                `cars` (per span, 2), `base` (pylon feet, 0.85).
 *
 * Every generator returns exactly w × h, tiles horizontally without a seam (period-w noise,
 * shapes that cross the right edge are drawn again at x − w) and is deterministic per seed.
 */
import type { Color } from '../../../../engine/color';
import { PixelBuffer, type Ramp } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import { defineBgGenerator, type BgGenerator } from '../../../art/art-registry';
import { bayer, fbm1, hash2, noise2 } from '../../../art/paint';

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

/** Ramp colour for a continuous index with ordered dither. */
function dz(r: Ramp, v: number, x: number, y: number, spread = 1): Color {
  const k = Math.floor(v + (bayer(x, y) - 0.5) * spread);
  return r[k < 0 ? 0 : k >= r.length ? r.length - 1 : k];
}

/** Set a pixel with horizontal wrap (seamless tiling) and vertical clipping. */
function setW(b: PixelBuffer, x: number, y: number, c: Color): void {
  y = Math.round(y);
  if (y < 0 || y >= b.h) return;
  const w = b.w;
  b.data[y * w + ((((Math.round(x) % w) + w) % w) >>> 0)] = c >>> 0;
}

function getW(b: PixelBuffer, x: number, y: number): Color {
  if (y < 0 || y >= b.h) return 0;
  const w = b.w;
  return b.data[y * w + ((((Math.round(x) % w) + w) % w) >>> 0)];
}

function rectW(b: PixelBuffer, x: number, y: number, w: number, h: number, c: Color): void {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) setW(b, x + i, y + j, c);
}

function lineW(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number, c: Color): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) setW(b, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
}

/**
 * 1-px outline (colour c) around every opaque pixel of `src`, drawn into `b` with wrap; then the
 * opaque pixels of `src` are copied over. The outline mask is computed first (two passes), so a
 * new outline pixel never spreads the outline further.
 */
function outlineInto(b: PixelBuffer, src: PixelBuffer, c: Color): void {
  const w = src.w;
  const h = src.h;
  const d = src.data;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[y * w + x] !== 0) continue;
      const l = d[y * w + ((x - 1 + w) % w)];
      const r = d[y * w + ((x + 1) % w)];
      const u = y > 0 ? d[(y - 1) * w + x] : 0;
      const dn = y < h - 1 ? d[(y + 1) * w + x] : 0;
      if (l !== 0 || r !== 0 || u !== 0 || dn !== 0) mask[y * w + x] = 1;
    }
  }
  for (let i = 0; i < d.length; i++) {
    if (mask[i]) b.data[i] = c >>> 0;
    else if (d[i] !== 0) b.data[i] = d[i];
  }
}

// ------------------------------------------------------------------------------------ chalets

/** One snowy pine (triangle tiers) into `b`, centred at cx with its foot at `foot`. */
function pine(b: PixelBuffer, cx: number, foot: number, hgt: number, r: Ramp): void {
  const tiers = 3;
  const tierH = hgt / tiers;
  for (let t = 0; t < tiers; t++) {
    const top = foot - hgt + t * tierH * 0.8;
    const bottom = top + tierH * 1.25;
    for (let y = Math.floor(top); y <= bottom; y++) {
      const half = ((y - top) / (bottom - top)) * (hgt * 0.28 + t * 2);
      for (let x = Math.floor(cx - half); x <= cx + half; x++) {
        const lit = x < cx - half * 0.2;
        const snowy = y - top < 2 + (hash2(x, t, 9) > 0.5 ? 1 : 0) || (y === Math.floor(bottom) && hash2(x, y, 3) > 0.4);
        setW(b, x, y, snowy ? PAL.snow[2] : lit ? r[2] : r[1]);
      }
    }
  }
  rectW(b, cx - 1, foot - 3, 2, 3, PAL.brown[0]);
}

/**
 * One chalet: log walls, a steep snowy gable roof with deep eaves, two lit windows with
 * shutters, a balcony rail and a crimson Legion banner with a gold bugle-bell emblem.
 */
function chalet(b: PixelBuffer, cx: number, foot: number, ww: number, wallH: number, dim: number, seed: number, i: number): void {
  const wood: Ramp = dim ? [PAL.ink[1], PAL.brown[0], PAL.brown[1], PAL.brown[2]] : PAL.brown;
  const x0 = Math.round(cx - ww / 2);
  const top = foot - wallH;
  // Walls: horizontal logs, lit on the left half.
  for (let y = top; y < foot; y++) {
    for (let x = x0; x < x0 + ww; x++) {
      const seam = (y - top) % 4 === 3;
      const lit = x < x0 + 3;
      setW(b, x, y, seam ? wood[0] : lit ? wood[3] : wood[2]);
    }
  }
  // Log ends at the corners.
  for (let y = top + 1; y < foot; y += 4) {
    setW(b, x0 - 1, y, wood[3]);
    setW(b, x0 + ww, y, wood[1]);
  }
  // Windows with shutters and a warm light.
  const wy = top + Math.max(4, Math.floor(wallH * 0.3));
  const nWin = ww >= 46 ? 2 : 1;
  for (let k = 0; k < nWin; k++) {
    const wx = nWin === 1 ? cx - 3 : x0 + Math.round(ww * (k === 0 ? 0.25 : 0.75)) - 3;
    rectW(b, wx - 2, wy, 2, 8, PAL.red[1]);
    rectW(b, wx + 6, wy, 2, 8, PAL.red[1]);
    rectW(b, wx, wy, 6, 8, INK);
    rectW(b, wx + 1, wy + 1, 4, 6, dim ? PAL.gold[1] : PAL.gold[2]);
    rectW(b, wx + 1, wy + 1, 2, 3, dim ? PAL.gold[2] : PAL.gold[3]);
    setW(b, wx + 3, wy + 4, INK);
    setW(b, wx + 3, wy + 5, INK);
  }
  // Balcony rail under the windows.
  const by = wy + 10;
  for (let x = x0 - 2; x < x0 + ww + 2; x++) {
    setW(b, x, by, wood[1]);
    if ((x - x0) % 3 === 0) {
      setW(b, x, by + 1, wood[1]);
      setW(b, x, by + 2, wood[1]);
    }
  }
  // Door.
  rectW(b, cx - 3, foot - 10, 7, 10, wood[0]);
  rectW(b, cx - 2, foot - 9, 5, 9, wood[1]);
  // Roof: a steep gable with deep eaves, dark underside, snow on top.
  const eave = 5;
  const roofH = Math.round(ww * 0.42);
  for (let j = 0; j <= roofH; j++) {
    const y = top - j;
    const half = ((roofH - j) / roofH) * (ww / 2 + eave);
    for (let x = Math.floor(cx - half); x <= cx + half; x++) {
      const edge = Math.abs(x - cx) > half - 2;
      const snow = j > 2 || edge;
      setW(b, x, y, snow ? (x < cx ? PAL.snow[3] : PAL.snow[2]) : wood[0]);
    }
  }
  // The roof's underside and its shadow on the wall.
  for (let x = x0 - eave; x < x0 + ww + eave; x++) {
    setW(b, x, top, wood[0]);
    setW(b, x, top + 1, PAL.snow[1]);
  }
  for (let x = x0; x < x0 + ww; x++) setW(b, x, top + 2, wood[0]);
  // Snow lumps dripping off the eaves.
  for (let k = 0; k < 4; k++) {
    const sx = x0 - eave + 2 + Math.floor(hash2(i, k, seed) * (ww + eave * 2 - 4));
    setW(b, sx, top + 2, PAL.snow[2]);
  }
  // Chimney with a snow cap.
  const chx = cx + Math.round(ww * 0.22);
  const chTop = top - Math.round(roofH * 0.62);
  rectW(b, chx, chTop, 4, Math.round(roofH * 0.35), PAL.stone[1]);
  rectW(b, chx - 1, chTop - 1, 6, 2, PAL.snow[3]);
  // The crimson banner hanging from the gable: a gold bell emblem, a swallowtail end.
  const bx = cx - 4;
  const bTop = top - Math.round(roofH * 0.45);
  for (let y = bTop; y < bTop + 20; y++) {
    for (let x = bx; x < bx + 8; x++) {
      const tail = y >= bTop + 16 && Math.abs(x - (bx + 3.5)) < y - (bTop + 15);
      if (tail) continue;
      setW(b, x, y, x === bx ? PAL.red[3] : x === bx + 7 ? PAL.red[1] : PAL.red[2]);
    }
  }
  rectW(b, bx - 1, bTop - 1, 10, 1, PAL.gold[1]);
  // Emblem: a little bell of a horn (original shape: a cone with a round mouth).
  setW(b, bx + 3, bTop + 4, PAL.gold[3]);
  setW(b, bx + 4, bTop + 4, PAL.gold[3]);
  rectW(b, bx + 2, bTop + 5, 4, 2, PAL.gold[2]);
  rectW(b, bx + 1, bTop + 7, 6, 2, PAL.gold[2]);
  setW(b, bx + 1, bTop + 7, PAL.gold[3]);
}

const chalets: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  const base = px(p, 'base', 0.8, h);
  const eaveY = px(p, 'y', 0.5, h);
  const count = Math.max(1, Math.round(num(p, 'count', 3)));
  const dim = bool(p, 'dim', false) ? 1 : 0;
  const pineR: Ramp = dim ? [PAL.ink[1], PAL.teal[0], PAL.green[0], PAL.green[1]] : [PAL.teal[0], PAL.green[0], PAL.green[1], PAL.green[2]];
  // Pines first (behind the chalets).
  if (bool(p, 'pines', true)) {
    const n = count * 3;
    for (let i = 0; i < n; i++) {
      const cx = ((i + 0.5 + (hash2(i, 1, seed) - 0.5) * 0.6) / n) * w;
      const hgt = 26 + hash2(i, 2, seed) * 22;
      pine(b, cx, base + 2, hgt, pineR);
    }
  }
  const shape = new PixelBuffer(w, h);
  for (let i = 0; i < count; i++) {
    const cx = ((i + 0.5 + (hash2(i, 3, seed) - 0.5) * 0.3) / count) * w;
    const ww = 40 + Math.floor(hash2(i, 4, seed) * 20);
    const wallH = Math.max(22, base - eaveY - Math.floor(hash2(i, 5, seed) * 10));
    chalet(shape, cx, base, ww, wallH, dim, seed, i);
  }
  // Pines and chalets get one ink outline (the chalets read as separate houses).
  for (let i = 0; i < b.data.length; i++) if (shape.data[i] !== 0) b.data[i] = shape.data[i];
  const sil = new PixelBuffer(w, h);
  sil.data.set(b.data);
  outlineInto(b, sil, dim ? PAL.ink[0] : INK);
  // Snow drifts to the bottom (covers the feet; the valley shows it below the ground line).
  const snow: Ramp = [PAL.steel[2], PAL.steel[3], PAL.snow[0], PAL.snow[1], PAL.snow[2]];
  for (let x = 0; x < w; x++) {
    const top = base - 2 + Math.round((fbm1(x, 40, w, seed + 11, 2) - 0.5) * 6);
    for (let y = Math.max(0, top); y < h; y++) {
      const d = y - top;
      b.data[y * w + x] = (d === 0 ? PAL.snow[3] : dz(snow, 4 - d / 10 - dim, x, y, 0.8)) >>> 0;
    }
  }
  return b.touch();
};

// ------------------------------------------------------------------------------------ ice cave

/** One crystal (a hexagonal prism seen from the side) with a glowing core. */
function crystal(b: PixelBuffer, cx: number, cy: number, len: number, wid: number, ang: number, r: Ramp, glow: boolean): void {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const n = r.length;
  const reach = len + wid;
  for (let y = Math.floor(cy - reach); y <= cy + reach; y++) {
    for (let x = Math.floor(cx - reach); x <= cx + reach; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const u = dx * ca + dy * sa; // along the crystal (0 = base, len = tip)
      const v = -dx * sa + dy * ca; // across
      if (u < 0 || u > len) continue;
      const half = u > len - wid ? (len - u) : wid;
      if (Math.abs(v) > half) continue;
      // Facets: a lit left facet, a mid face and a dark right facet; the core glows.
      let k = v < -half * 0.35 ? n - 1 : v > half * 0.35 ? 1 : n - 2;
      if (glow && Math.abs(v) < half * 0.25 && u > len * 0.2 && u < len * 0.75) k = n - 1;
      if (Math.abs(v) > half - 1) k = 0;
      setW(b, x, y, r[Math.max(0, Math.min(n - 1, k))]);
    }
  }
}

const iceCave: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  const dark = bool(p, 'dark', false);
  const glow = bool(p, 'glow', true);
  // The rock: deep navy-violet with large soft strata (vertical noise).
  const rock: Ramp = dark ? [PAL.ink[0], PAL.ink[1], PAL.navy[0], PAL.purple[0]] : [PAL.ink[1], PAL.navy[0], PAL.purple[0], PAL.navy[1]];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = noise2((x / w) * 6, y / (dark ? 60 : 36), 1, seed) * 0.6 + noise2((x / w) * 24, y / 14, 1, seed + 4) * 0.4;
      // Seamless in x: blend the noise with its copy one period away.
      const n2 = noise2((x / w) * 6 - 6, y / (dark ? 60 : 36), 1, seed) * 0.6 + noise2((x / w) * 24 - 24, y / 14, 1, seed + 4) * 0.4;
      const t = x / w;
      const v = (n * (1 - t) + n2 * t) * (rock.length - 0.6);
      b.data[y * w + x] = dz(rock, v, x, y, 0.9) >>> 0;
    }
  }
  // Crystal clusters: violet, ice blue and teal; the near layer glows a little.
  const ramps: Ramp[] = dark
    ? [[PAL.navy[0], PAL.purple[0], PAL.purple[1], PAL.purple[2]], [PAL.navy[0], PAL.navy[1], PAL.sky[0], PAL.sky[1]]]
    : [[PAL.navy[0], PAL.purple[1], PAL.purple[2], PAL.pink[1]], [PAL.navy[0], PAL.sky[0], PAL.sky[1], PAL.sky[3]], [PAL.navy[0], PAL.teal[0], PAL.teal[1], PAL.teal[2]]];
  const per = num(p, 'count', 3);
  const clusters = Math.max(1, Math.round((h / 256) * per * (w / 256)));
  const shape = new PixelBuffer(w, h);
  for (let i = 0; i < clusters; i++) {
    const cx = hash2(i, 1, seed) * w;
    const cy = hash2(i, 2, seed) * h;
    const r = ramps[Math.floor(hash2(i, 3, seed) * ramps.length)];
    const spikes = 3 + Math.floor(hash2(i, 4, seed) * 3);
    const big = dark ? 1.8 : 1;
    const up = hash2(i, 9, seed) > 0.5 ? -1 : 1; // growing up from a floor or down from a ceiling
    for (let s = 0; s < spikes; s++) {
      const ang = up * (Math.PI / 2) + (hash2(i, 10 + s, seed) - 0.5) * 1.6;
      const len = (8 + hash2(i, 20 + s, seed) * 16) * big;
      const wid = (2 + hash2(i, 30 + s, seed) * 2.5) * big;
      crystal(shape, cx + (hash2(i, 40 + s, seed) - 0.5) * 10, cy, len, wid, ang, r, glow && !dark);
    }
  }
  const sil = new PixelBuffer(w, h);
  sil.data.set(shape.data);
  // Glow halo around the near layer's crystals (a dithered ring of the rock's lightest tone).
  if (glow && !dark) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (shape.data[y * w + x] !== 0) continue;
        let near = false;
        for (let d = 2; d <= 4 && !near; d += 2) {
          if (getW(shape, x + d, y) || getW(shape, x - d, y) || getW(shape, x, y + d) || getW(shape, x, y - d)) near = true;
        }
        if (near && bayer(x, y) > 0.5) b.data[y * w + x] = PAL.purple[1] >>> 0;
      }
    }
  }
  for (let i = 0; i < shape.data.length; i++) if (shape.data[i] !== 0) b.data[i] = shape.data[i];
  // Ink edges between crystals and rock (only on the near layer, so it stays crisp).
  if (!dark) {
    const out = new PixelBuffer(w, h);
    out.data.set(sil.data);
    outlineInto(b, out, PAL.ink[0]);
  }
  return b.touch();
};

// ------------------------------------------------------------------------------------ cable cars

/** A small cable-car cabin hanging from its hanger at (x, y) on the cable. */
function cabin(b: PixelBuffer, x: number, y: number, body: Ramp, i: number): void {
  lineW(b, x, y, x, y + 6, PAL.steel[1]);
  rectW(b, x - 2, y - 1, 5, 2, PAL.steel[2]);
  const top = y + 7;
  rectW(b, x - 6, top, 13, 10, body[2]);
  rectW(b, x - 6, top, 13, 1, body[3]);
  rectW(b, x - 6, top + 9, 13, 1, body[0]);
  rectW(b, x + 6, top, 1, 10, body[1]);
  // Windows (lit or dark).
  const lit = i % 2 === 0;
  for (let k = 0; k < 3; k++) rectW(b, x - 5 + k * 4, top + 2, 3, 3, lit ? PAL.gold[2] : PAL.navy[1]);
  // Ink outline (local, drawn with wrap).
  for (let yy = top - 1; yy <= top + 10; yy++) {
    setW(b, x - 7, yy, INK);
    setW(b, x + 7, yy, INK);
  }
  for (let xx = x - 7; xx <= x + 7; xx++) {
    setW(b, xx, top - 1, INK);
    setW(b, xx, top + 10, INK);
  }
}

/** A lattice pylon from the cable crossbar at (cx, top) down to `foot`. */
function pylon(b: PixelBuffer, cx: number, top: number, foot: number): void {
  const half = (y: number): number => 2 + ((y - top) / (foot - top)) * 7;
  for (let y = top; y < foot; y++) {
    const hw = half(y);
    setW(b, cx - hw, y, PAL.steel[1]);
    setW(b, cx + hw, y, PAL.steel[0]);
    // Cross-bracing every 8 px.
    const k = (y - top) % 8;
    setW(b, cx - hw + (k / 8) * hw * 2, y, PAL.steel[1]);
  }
  // Crossbar and wheels.
  rectW(b, cx - 12, top - 2, 25, 3, PAL.steel[2]);
  rectW(b, cx - 12, top - 2, 25, 1, PAL.steel[3]);
  rectW(b, cx - 11, top - 4, 3, 2, INK);
  rectW(b, cx + 9, top - 4, 3, 2, INK);
}

const cableCars: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  const cy = px(p, 'y', 0.3, h);
  const sag = num(p, 'sag', 26);
  const perSpan = Math.max(0, Math.round(num(p, 'cars', 2)));
  const foot = px(p, 'base', 0.85, h);
  const spans = 2;
  const span = w / spans;
  // Pylons at the span ends; their feet fade into the snow line (drawn by the near layers).
  for (let s = 0; s < spans; s++) pylon(b, s * span, cy, foot);
  // Two cables per span (up and down line), sagging between the pylons.
  const cableY = (x: number, k: number): number => {
    const t = ((x % span) + span) % span / span;
    return cy - 3 + k * 5 + sag * 4 * t * (1 - t) * (k === 0 ? 1 : 0.85);
  };
  for (let x = 0; x < w; x++) {
    setW(b, x, cableY(x, 0), INK);
    setW(b, x, cableY(x, 1), PAL.ink[1]);
  }
  // Cabins on the cables (red and ivory), placed per span.
  const bodies: Ramp[] = [PAL.red, PAL.cloth, [PAL.navy[0], PAL.navy[1], PAL.sky[1], PAL.sky[2]]];
  let n = 0;
  for (let s = 0; s < spans; s++) {
    for (let c = 0; c < perSpan; c++) {
      const t = (c + 0.5 + (hash2(s, c, seed) - 0.5) * 0.4) / perSpan;
      const x = s * span + t * span;
      const k = (s + c) % 2;
      cabin(b, Math.round(x), Math.round(cableY(x, k)), bodies[(s + c + Math.floor(hash2(c, s, seed) * 3)) % bodies.length], n++);
    }
  }
  return b.touch();
};

defineBgGenerator('chalets', chalets);
defineBgGenerator('ice-cave', iceCave);
defineBgGenerator('cable-cars', cableCars);
