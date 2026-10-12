/**
 * Mission m1 background generators (GDD §15.5, custom per mission):
 *
 * - `town-rooftops` — Puddlewick's red-brown pitched roofs, cream walls with small windows,
 *   chimneys and regatta bunting strung from gable to gable. Params: `y` (roof tops, 0.45),
 *   `height` (0.4), `bunting` (true), `tone` (0 normal, 1 = paler, for far rows).
 * - `sewer-brick` — dark teal brick vaults: arches, horizontal pipes with drips. Params: `dark`
 *   (false: the far, darker wall), `arch` (arch spacing in px, 96).
 * - `far-bank` — the far bank of the river Wend: a grass strip, cottages, the church spire, a
 *   strip of cheering crowd (tiny heads and waving arms) and the river below it. Params: `y`
 *   (bank top, 0.5).
 * - `reeds` — a front layer: sparse reed clumps and cat-tails standing up from the bottom edge of
 *   a short buffer (use `height: 36`, `offsetY: 180`, `front: true`). Params: `density` (0.35).
 *
 * Every generator is exactly w × h, deterministic per seed, palette-only and seamless (shapes come
 * from period-w functions and wrap with `setW`).
 */
import type { Color } from '../../../../engine/color';
import { PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import { defineBgGenerator, type BgGenerator } from '../../../art/art-registry';
import { bayer, hash2, noise1 } from '../../../art/paint';

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

/** Set a pixel with horizontal wrap (seamless tiles). */
function setW(b: PixelBuffer, x: number, y: number, c: Color): void {
  if (y < 0 || y >= b.h) return;
  const w = b.w;
  b.data[y * w + (((Math.round(x) % w) + w) % w)] = c >>> 0;
}

function rectW(b: PixelBuffer, x: number, y: number, w: number, h: number, c: Color): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setW(b, xx, yy, c);
}

// ------------------------------------------------------------------------------------ town-rooftops

const townRooftops: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  const top = px(p, 'y', 0.45, h);
  const height = px(p, 'height', 0.4, h);
  const tone = num(p, 'tone', 0);
  const bunting = bool(p, 'bunting', true);
  const base = top + height;
  // Far houses lean toward the sky colours (aerial perspective).
  const roof = tone > 0 ? [PAL.rust[1], PAL.rust[2], PAL.red[1], PAL.rust[3]] : [PAL.rust[0], PAL.rust[1], PAL.red[1], PAL.rust[2]];
  const wall = tone > 0 ? [PAL.sand[2], PAL.snow[1], PAL.snow[2]] : [PAL.sand[1], PAL.sand[2], PAL.snow[1]];
  const peaks: number[] = [];
  const peakY: number[] = [];
  let x0 = 0;
  let i = 0;
  while (x0 < w) {
    let hw = 28 + Math.floor(hash2(i, 1, seed) * 22);
    if (w - (x0 + hw) < 28) hw = w - x0;
    const wallTop = base - Math.round(height * (0.32 + hash2(i, 2, seed) * 0.25));
    const roofH = Math.round(hw * (0.32 + hash2(i, 3, seed) * 0.12));
    const mid = x0 + hw / 2;
    const wt = Math.floor(hash2(i, 4, seed) * 2);
    // Wall.
    for (let y = wallTop; y < h; y++) {
      for (let x = x0; x < x0 + hw; x++) {
        let v = wt + 1;
        if (x === x0) v = 2;
        if (x === x0 + hw - 1) v = 0;
        setW(b, x, y, wall[Math.max(0, Math.min(2, v))]);
      }
    }
    // Windows: 3×4 navy panes with a cream sill, two or three per storey.
    for (let y = wallTop + 5; y < base - 4; y += 11) {
      for (let x = x0 + 4; x < x0 + hw - 6; x += 9) {
        if (hash2(x, y, seed + 7) < 0.25) continue;
        rectW(b, x, y, 4, 5, PAL.navy[1]);
        setW(b, x, y, PAL.sky[1]);
        rectW(b, x - 1, y + 5, 6, 1, PAL.snow[2]);
        // Window boxes with red flowers under some of them.
        if (hash2(x, y, seed + 9) < 0.3) {
          rectW(b, x, y + 6, 4, 1, PAL.green[1]);
          setW(b, x + 1, y + 6, PAL.red[2]);
          setW(b, x + 3, y + 6, PAL.red[3]);
        }
      }
    }
    // Pitched roof: a triangle over the wall with tile rows.
    for (let y = wallTop - roofH; y < wallTop + 2; y++) {
      const t = (y - (wallTop - roofH)) / roofH;
      const half = Math.min(hw / 2 + 2, (hw / 2 + 2) * t);
      for (let x = Math.ceil(mid - half); x <= Math.floor(mid + half); x++) {
        let v = 1;
        if ((y - wallTop) % 3 === 0) v = 0; // tile courses
        if (x < mid - half + 2) v = 3; // lit left eave
        else if (x < mid) v = Math.max(v, 2);
        setW(b, x, y, roof[v]);
      }
    }
    // Chimney on most roofs.
    if (hash2(i, 5, seed) < 0.7) {
      const cx = Math.round(mid + (hash2(i, 6, seed) - 0.5) * hw * 0.4);
      const ct = wallTop - Math.round(roofH * 0.8) - 4;
      rectW(b, cx, ct, 4, wallTop - ct - 2, PAL.red[1]);
      setW(b, cx, ct + 1, PAL.red[2]);
      rectW(b, cx - 1, ct, 6, 1, PAL.stone[1]);
    }
    peaks.push(Math.round(mid));
    peakY.push(wallTop - roofH);
    x0 += hw;
    i++;
  }
  // Bunting: a sagging string between neighbouring gables with little pennants.
  if (bunting) {
    const flags = [PAL.red[2], PAL.gold[2], PAL.sky[2], PAL.snow[3]];
    for (let k = 0; k < peaks.length; k++) {
      const ax = peaks[k];
      const ay = peakY[k] + 2;
      const bx = k + 1 < peaks.length ? peaks[k + 1] : peaks[0] + w;
      const by = k + 1 < peaks.length ? peakY[k + 1] + 2 : peakY[0] + 2;
      const span = bx - ax;
      for (let s = 0; s <= span; s++) {
        const t = s / span;
        const y = Math.round(ay + (by - ay) * t + Math.sin(t * Math.PI) * 6);
        setW(b, ax + s, y, PAL.ink[1]);
        if (s % 6 === 3) {
          const c = flags[(s / 6 + k) % 4 | 0];
          setW(b, ax + s - 1, y + 1, c);
          setW(b, ax + s, y + 1, c);
          setW(b, ax + s + 1, y + 1, c);
          setW(b, ax + s, y + 2, c);
        }
      }
    }
  }
  return b.touch();
};

// ------------------------------------------------------------------------------------ sewer-brick

const sewerBrick: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  const dark = bool(p, 'dark', false);
  const spacing = Math.max(48, num(p, 'arch', 96));
  const ramp = dark ? [PAL.ink[1], PAL.navy[0], PAL.navy[0], PAL.teal[0]] : [PAL.navy[0], PAL.teal[0], PAL.teal[1], PAL.teal[2]];
  // Bricks 8×4, offset every other row, with dark mortar.
  for (let y = 0; y < h; y++) {
    const row = y >> 2;
    const off = row % 2 === 0 ? 0 : 4;
    for (let x = 0; x < w; x++) {
      const mortar = y % 4 === 3 || (x + off) % 8 === 7;
      const shade = hash2((x + off) >> 3, row, seed) < 0.3 ? 2 : 1;
      b.data[y * w + x] = (mortar ? ramp[0] : ramp[shade]) >>> 0;
    }
  }
  // Arches: dark tunnel mouths with a lit keystone ring. The count divides the tile width.
  const n = Math.max(1, Math.round(w / spacing));
  const step = w / n;
  for (let k = 0; k < n; k++) {
    const cx = Math.round(k * step + step / 2);
    const r = Math.round(step * 0.3);
    const springY = Math.round(h * (dark ? 0.42 : 0.5));
    for (let y = springY - r - 3; y < h; y++) {
      for (let x = cx - r - 3; x <= cx + r + 3; x++) {
        const dx = x - cx;
        const dy = Math.min(0, y - springY);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= r) setW(b, x, y, (bayer(x, y) < 0.25 && d > r - 2) ? ramp[0] : PAL.ink[1]);
        else if (d <= r + 3) setW(b, x, y, d <= r + 1 ? ramp[3] : ramp[2]);
      }
    }
  }
  // Pipes: one or two horizontal runs with flanges and drips.
  const pipeYs = dark ? [Math.round(h * 0.28)] : [Math.round(h * 0.3), Math.round(h * 0.78)];
  for (const py of pipeYs) {
    for (let x = 0; x < w; x++) {
      setW(b, x, py, PAL.steel[2]);
      setW(b, x, py + 1, PAL.steel[1]);
      setW(b, x, py + 2, PAL.steel[1]);
      setW(b, x, py + 3, PAL.steel[0]);
      if (x % 48 === 0) for (let yy = py - 1; yy <= py + 4; yy++) setW(b, x, yy, PAL.steel[3]);
      // Drips under the pipe (short streaks of rust and water).
      if (noise1(x, 6, w, seed + py) > 0.72 && hash2(x, py, seed) < 0.3) {
        const len = 2 + Math.floor(hash2(x, py + 1, seed) * 6);
        for (let yy = 0; yy < len; yy++) setW(b, x, py + 4 + yy, yy < 2 ? PAL.rust[1] : PAL.teal[3]);
      }
    }
  }
  // Moss tufts along the bottom.
  for (let x = 0; x < w; x++) {
    const m = Math.floor(noise1(x, 10, w, seed + 3) * 6);
    for (let yy = 0; yy < m; yy++) setW(b, x, h - 1 - yy, yy === m - 1 ? PAL.green[1] : PAL.green[0]);
  }
  return b.touch();
};

// ------------------------------------------------------------------------------------ far-bank

const farBank: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  const top = px(p, 'y', 0.5, h);
  const bankBottom = top + 34;
  // River below the bank: lighter near the bank, wave dashes.
  for (let y = bankBottom; y < h; y++) {
    const t = (y - bankBottom) / Math.max(1, h - bankBottom);
    for (let x = 0; x < w; x++) {
      let c: Color = t < 0.3 ? PAL.sky[2] : t < 0.7 ? PAL.sky[1] : PAL.teal[1];
      if ((y - bankBottom) % 4 === 1 && noise1(x + y * 13, 5, w, seed + y) > 0.66) c = PAL.snow[2];
      b.data[y * w + x] = c >>> 0;
    }
  }
  // Grass bank with a darker waterline.
  for (let x = 0; x < w; x++) {
    const bump = Math.round(noise1(x, 40, w, seed) * 3);
    for (let y = top + 20 - bump; y < bankBottom; y++) {
      const c = y >= bankBottom - 2 ? PAL.green[0] : y <= top + 21 - bump ? PAL.green[3] : bayer(x, y) < 0.2 ? PAL.green[1] : PAL.green[2];
      setW(b, x, y, c);
    }
  }
  // Cottages and the church (one per tile, at a fixed spot) behind the crowd.
  let x0 = 4;
  let i = 0;
  const churchX = Math.round(w * 0.62);
  while (x0 < w - 20) {
    const hw = 12 + Math.floor(hash2(i, 1, seed) * 8);
    if (Math.abs(x0 + hw / 2 - churchX) > 22) {
      const wallTop = top + 6 + Math.floor(hash2(i, 2, seed) * 4);
      rectW(b, x0, wallTop, hw, top + 21 - wallTop, PAL.snow[1]);
      setW(b, x0, wallTop, PAL.snow[2]);
      for (let yy = 0; yy < 5; yy++) {
        const half = Math.round((hw / 2 + 1) * (yy / 5));
        for (let xx = -half; xx <= half; xx++) setW(b, x0 + hw / 2 + xx, wallTop - 5 + yy, xx < 0 ? PAL.rust[2] : PAL.rust[1]);
      }
      setW(b, x0 + 3, wallTop + 4, PAL.navy[1]);
      setW(b, x0 + hw - 4, wallTop + 4, PAL.navy[1]);
    }
    x0 += hw + 3 + Math.floor(hash2(i, 3, seed) * 10);
    i++;
  }
  // The church: a cream nave and a tall slate spire with a gold weathercock.
  rectW(b, churchX - 10, top + 4, 20, 17, PAL.snow[2]);
  rectW(b, churchX - 10, top + 4, 1, 17, PAL.snow[3]);
  for (let yy = 0; yy < 6; yy++) for (let xx = -11 + yy; xx <= 11 - yy; xx++) setW(b, churchX + xx, top + 3 - yy, PAL.steel[1]);
  rectW(b, churchX + 4, top - 10, 6, 15, PAL.snow[1]);
  for (let yy = 0; yy < 18; yy++) {
    const half = Math.floor((18 - yy) / 6);
    for (let xx = -half; xx <= half; xx++) setW(b, churchX + 7 + xx, top - 11 - yy, xx < 0 ? PAL.steel[2] : PAL.steel[1]);
  }
  setW(b, churchX + 7, top - 30, PAL.gold[3]);
  setW(b, churchX + 8, top - 31, PAL.gold[2]);
  setW(b, churchX + 6, top - 31, PAL.gold[2]);
  rectW(b, churchX - 3, top + 12, 3, 9, PAL.brown[0]);
  // The crowd: a row of tiny heads (skin tones) with hats and waving arms over the bank.
  const skins = [PAL.skinA[2], PAL.skinB[2], PAL.skinC[2], PAL.skinA[1]];
  const hats = [PAL.red[2], PAL.gold[2], PAL.sky[2], PAL.snow[3], PAL.green[2], PAL.pink[2]];
  for (let x = 0; x < w; x += 3) {
    if (hash2(x, 1, seed + 11) < 0.18) continue;
    const y = top + 16 + Math.floor(hash2(x, 2, seed + 11) * 3);
    const body = hats[Math.floor(hash2(x, 3, seed + 11) * hats.length)];
    setW(b, x, y + 2, body);
    setW(b, x + 1, y + 2, body);
    setW(b, x, y + 3, body);
    setW(b, x + 1, y + 3, body);
    setW(b, x, y, skins[Math.floor(hash2(x, 4, seed + 11) * skins.length)]);
    setW(b, x + 1, y, skins[Math.floor(hash2(x, 4, seed + 11) * skins.length)]);
    setW(b, x, y - 1, hash2(x, 5, seed) < 0.4 ? body : PAL.hairB[1]);
    if (hash2(x, 6, seed + 11) < 0.35) setW(b, x + 2, y - 2, skins[0]); // a waving arm
  }
  return b.touch();
};

// ------------------------------------------------------------------------------------ reeds

const reeds: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  const density = num(p, 'density', 0.35);
  for (let x = 0; x < w; x++) {
    // Clumps: noise decides where reeds stand; each stem is 1 px with a darker base.
    const clump = noise1(x, 22, w, seed);
    if (clump < 1 - density) continue;
    if (hash2(x, 0, seed) < 0.45) continue;
    const tall = Math.round((clump - (1 - density)) / density * (h - 6)) + 4;
    const lean = hash2(x, 1, seed) < 0.5 ? 0 : 1;
    for (let yy = 0; yy < tall; yy++) {
      const y = h - 1 - yy;
      const xx = x + (yy > tall * 0.6 ? lean : 0);
      const c = yy < 4 ? PAL.green[0] : yy > tall - 3 ? PAL.green[3] : PAL.green[1 + ((x + yy) % 3 === 0 ? 1 : 0)];
      setW(b, xx, y, c);
    }
    // Cat-tails on some stems.
    if (tall > 14 && hash2(x, 2, seed) < 0.25) {
      for (let yy = 0; yy < 4; yy++) {
        setW(b, x + lean, h - tall - 1 + yy, PAL.brown[1]);
        setW(b, x + lean + 1, h - tall - 1 + yy, PAL.brown[0]);
      }
    }
  }
  return b.touch();
};

defineBgGenerator('town-rooftops', townRooftops);
defineBgGenerator('sewer-brick', sewerBrick);
defineBgGenerator('far-bank', farBank);
defineBgGenerator('reeds', reeds);

export const M1_BG_GENERATORS = ['town-rooftops', 'sewer-brick', 'far-bank', 'reeds'] as const;
