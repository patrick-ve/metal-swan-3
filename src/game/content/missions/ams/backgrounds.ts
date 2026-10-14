/**
 * Mission `ams` background generators (docs/design/amsterdam.md §5). Every one takes `light`
 * (`morning` | `noon` | `golden` | `sunset`, default `morning`) and is exactly w × h, deterministic
 * per seed, palette-only and horizontally seamless (shapes wrap with `setW` / `blitW`).
 *
 * - `ams-skyline` — the far city: hazy gables, church spires, a crane and the Westertoren (a tall
 *   brick tower with the blue-and-gold crown) once per tile. Params: `y` (skyline base, 0.62),
 *   `tower` (true).
 * - `ams-canal-houses` — a row of canal houses (the shared `paintHouse`: step / neck / bell / spout
 *   / flat gables, white cornices, sash windows, hoist beams, a lean) on a quay with small elms,
 *   and the canal below with the houses' wobbly reflections and moored boats. Params: `y` (quay
 *   line, 0.7), `s` (storey px, 12), `haze` (0 = full colour, 1 = aerial far row), `water` (true).
 * - `ams-elms` — a near row of elms along the canal with lamp posts and parked bikes under them.
 *   Params: `y` (canopy middle, 0.3), `spacing` (px, 112), `bikes` (true).
 * - `ams-plein` — Museumplein: the Rijksmuseum's back far away, the lawn, the long pool, plane
 *   trees, tourists and a white-blue tram. Params: `y` (lawn line, 0.72).
 */
import type { Color } from '../../../../engine/color';
import { INK, PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import { defineBgGenerator, type BgGenerator } from '../../../art/art-registry';
import { bayer, hash2, noise1 } from '../../../art/paint';
import { applyLight, drawBike, isLight, paintHouse, type Gable, type HouseSpec, type Light, type Wall } from './art';

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

function lightOf(p: Params): Light {
  return isLight(p.light) ? p.light : 'morning';
}

function setW(b: PixelBuffer, x: number, y: number, c: Color): void {
  if (y < 0 || y >= b.h) return;
  const w = b.w;
  b.data[y * w + (((Math.round(x) % w) + w) % w)] = c >>> 0;
}

function rectW(b: PixelBuffer, x: number, y: number, w: number, h: number, c: Color): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setW(b, xx, yy, c);
}

/** Copy the opaque pixels of `src` to (dx, dy) with horizontal wrap. */
function blitW(b: PixelBuffer, src: PixelBuffer, dx: number, dy: number): void {
  for (let y = 0; y < src.h; y++) {
    const ty = dy + y;
    if (ty < 0 || ty >= b.h) continue;
    for (let x = 0; x < src.w; x++) {
      const c = src.data[y * src.w + x];
      if ((c & 255) !== 0) setW(b, dx + x, ty, c);
    }
  }
}

export function lum(c: number): number {
  return ((c >>> 24) * 3 + ((c >>> 16) & 255) * 6 + ((c >>> 8) & 255)) / 2550;
}

/** Map every opaque pixel by brightness onto `ramp` (aerial perspective, reflections). */
export function remap(b: PixelBuffer, ramp: readonly Color[], x0 = 0, y0 = 0, w = b.w, h = b.h): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = y * b.w + x;
      const c = b.data[i];
      if ((c & 255) === 0) continue;
      const k = Math.min(ramp.length - 1, Math.floor(lum(c) * ramp.length * 1.05));
      b.data[i] = ramp[k] >>> 0;
    }
  }
}

/** Aerial haze ramps (dark → light) per light. */
export const HAZE: Readonly<Record<Light, readonly Color[]>> = {
  morning: [PAL.steel[2], PAL.steel[3], PAL.sky[2], PAL.snow[1], PAL.snow[2]],
  noon: [PAL.steel[2], PAL.steel[3], PAL.sky[2], PAL.snow[1], PAL.snow[2]],
  golden: [PAL.stone[2], PAL.sand[2], PAL.sand[3], PAL.gold[3], PAL.skinA[3]],
  sunset: [PAL.purple[1], PAL.pink[1], PAL.purple[2], PAL.pink[2], PAL.skinA[2]],
};
/** The far skyline colours (fill, light edge, windows) per light. */
export const SKYLINE: Readonly<Record<Light, readonly [Color, Color, Color]>> = {
  morning: [PAL.sky[2], PAL.sky[3], PAL.sky[1]],
  noon: [PAL.sky[2], PAL.sky[3], PAL.sky[1]],
  golden: [PAL.sand[3], PAL.skinA[3], PAL.sand[2]],
  sunset: [PAL.purple[2], PAL.pink[2], PAL.purple[1]],
};
/** Canal water (reflection ramp dark → light) per light. */
export const WATER: Readonly<Record<Light, readonly Color[]>> = {
  morning: [PAL.navy[0], PAL.teal[0], PAL.teal[1], PAL.sky[1], PAL.sky[2]],
  noon: [PAL.navy[0], PAL.teal[0], PAL.teal[1], PAL.sky[1], PAL.sky[2]],
  golden: [PAL.navy[0], PAL.teal[0], PAL.teal[1], PAL.sand[2], PAL.gold[3]],
  sunset: [PAL.navy[0], PAL.purple[0], PAL.purple[1], PAL.pink[1], PAL.orange[2]],
};

export const GABLES: readonly Gable[] = ['step', 'neck', 'bell', 'spout', 'flat', 'neck', 'bell'];
export const WALLS_CYCLE: readonly Wall[] = ['brown', 'rust', 'darkred', 'ink', 'red', 'green', 'cream', 'brown', 'grey', 'rust'];

// ------------------------------------------------------------------------------------ ams-skyline

/** The Westertoren: brick base, stone stages, the blue-and-gold crown and a slim spire. */
function westertoren(b: PixelBuffer, cx: number, base: number, fill: Color, edge: Color): void {
  rectW(b, cx - 6, base - 46, 12, 46, PAL.rust[1]);
  rectW(b, cx - 6, base - 46, 2, 46, PAL.rust[2]);
  for (let y = base - 40; y < base; y += 9) rectW(b, cx - 2, y, 3, 5, PAL.ink[1]);
  rectW(b, cx - 7, base - 48, 14, 2, PAL.stone[3]);
  rectW(b, cx - 5, base - 62, 10, 14, PAL.stone[2]);
  rectW(b, cx - 5, base - 62, 2, 14, PAL.stone[3]);
  rectW(b, cx - 2, base - 59, 3, 7, PAL.ink[1]);
  rectW(b, cx - 6, base - 64, 12, 2, PAL.stone[3]);
  rectW(b, cx - 4, base - 74, 8, 10, PAL.stone[2]);
  rectW(b, cx - 1, base - 72, 2, 5, PAL.ink[1]);
  // The crown: blue with gold ribs and a gold rim.
  rectW(b, cx - 5, base - 76, 10, 2, PAL.gold[2]);
  for (let y = 0; y < 7; y++) {
    const half = 4 - Math.floor(y / 3);
    for (let x = -half; x <= half; x++) setW(b, cx + x, base - 77 - y, x % 2 === 0 ? PAL.gold[2] : PAL.sky[0]);
  }
  setW(b, cx, base - 84, PAL.gold[3]);
  for (let y = 85; y < 102; y++) setW(b, cx, base - y, y < 95 ? PAL.stone[2] : PAL.steel[2]);
  setW(b, cx, base - 102, PAL.gold[3]);
  setW(b, cx + 1, base - 101, PAL.gold[2]);
  // A soft edge so it sits in the haze.
  setW(b, cx - 7, base - 1, fill);
  setW(b, cx + 7, base - 1, edge);
}

const amsSkyline: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  const light = lightOf(p);
  const base = px(p, 'y', 0.62, h);
  const [fill, edge, win] = SKYLINE[light];
  // Gables: a seamless chain of narrow houses of varying height.
  let x0 = 0;
  let i = 0;
  while (x0 < w) {
    let hw = 7 + Math.floor(hash2(i, 1, seed) * 7);
    if (w - (x0 + hw) < 7) hw = w - x0;
    const top = base - 14 - Math.floor(noise1(x0, 60, w, seed) * 14) - Math.floor(hash2(i, 2, seed) * 6);
    rectW(b, x0, top, hw, h - top, fill);
    const g = Math.floor(hash2(i, 3, seed) * 3);
    for (let y = 1; y <= 4; y++) {
      const inset = g === 0 ? y : g === 1 ? Math.floor(y / 2) * 2 : 0;
      if (g === 2 && y > 1) break;
      rectW(b, x0 + inset, top - y, Math.max(1, hw - inset * 2), 1, fill);
    }
    for (let y = top + 3; y < base + 10; y += 5) for (let x = x0 + 2; x < x0 + hw - 1; x += 3) if (hash2(x, y, seed) < 0.6) setW(b, x, y, win);
    rectW(b, x0, top, 1, h - top, edge);
    x0 += hw;
    i++;
  }
  // Church spires and a crane.
  for (const [fx, tall] of [[0.12, 30], [0.58, 24], [0.82, 36]] as const) {
    const cx = Math.round(w * fx);
    rectW(b, cx - 3, base - tall, 6, tall, fill);
    for (let y = 0; y < 16; y++) for (let x = -Math.floor((16 - y) / 6); x <= Math.floor((16 - y) / 6); x++) setW(b, cx + x, base - tall - 16 + y, edge);
  }
  const kx = Math.round(w * 0.45);
  rectW(b, kx, base - 70, 2, 70, win);
  rectW(b, kx - 14, base - 70, 44, 2, win);
  for (let x = kx - 12; x < kx + 28; x += 4) setW(b, x + 1, base - 69, edge);
  if (bool(p, 'tower', true)) westertoren(b, Math.round(w * 0.3), base + 2, fill, edge);
  return b.touch();
};

// ------------------------------------------------------------------------------------ ams-canal-houses

/** A small round quay tree (far scale). */
function smallTree(b: PixelBuffer, cx: number, foot: number, r: number, seed: number, light: Light): void {
  rectW(b, cx, foot - r - 6, 2, r + 6, PAL.brown[1]);
  const lit = light === 'golden' ? PAL.gold[2] : light === 'sunset' ? PAL.green[2] : PAL.green[3];
  for (let y = -r; y <= r; y++) {
    for (let x = -r - 2; x <= r + 2; x++) {
      const d = Math.sqrt((x * x) / 1.4 + y * y);
      if (d > r) continue;
      if (d > r - 1.5 && hash2(cx + x, y, seed) < 0.4) continue;
      const v = -x - y + (hash2(cx + x, foot + y, seed + 1) - 0.5) * 4;
      setW(b, cx + x, foot - r - 8 + y, v > r * 0.6 ? lit : v > -r * 0.3 ? PAL.green[2] : PAL.green[1]);
    }
  }
}

const amsCanalHouses: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  const light = lightOf(p);
  const quay = px(p, 'y', 0.7, h);
  const S = Math.max(8, Math.round(num(p, 's', 12)));
  const haze = num(p, 'haze', 0);
  const water = bool(p, 'water', true);
  // Houses along the quay (feet on the quay line).
  let x0 = 0;
  let i = 0;
  const minW = Math.round(S * 2.1);
  while (x0 < w) {
    let hw = minW + 2 * Math.floor(hash2(i, 1, seed) * S * 0.75);
    if (w - (x0 + hw) < minW) hw = w - x0;
    const spec: HouseSpec = {
      w: hw,
      floors: 2 + Math.floor(hash2(i, 2, seed) * 3),
      gable: GABLES[Math.floor(hash2(i, 3, seed) * GABLES.length)],
      wall: WALLS_CYCLE[Math.floor(hash2(i, 4, seed) * WALLS_CYCLE.length)],
      lean: Math.floor(hash2(i, 5, seed) * 3) - 1,
      seed: seed + i * 13,
      s: S,
      flowers: hash2(i, 6, seed) < 0.5,
    };
    const f = paintHouse(spec);
    blitW(b, f.buf, x0 + (hw >> 1) - f.ox, quay - f.oy);
    x0 += hw;
    i++;
  }
  // Quay trees in front of the houses.
  const nt = Math.max(1, Math.round(w / 88));
  for (let k = 0; k < nt; k++) {
    const cx = Math.round((k + 0.5) * (w / nt) + (hash2(k, 7, seed) - 0.5) * 20);
    smallTree(b, cx, quay, Math.round(S * 0.9), seed + k, light);
  }
  applyLight(b, light);
  if (haze > 0) remap(b, HAZE[light], 0, 0, w, Math.min(h, quay + 1));
  // The quay edge.
  for (let x = 0; x < w; x++) {
    setW(b, x, quay, PAL.stone[3]);
    setW(b, x, quay + 1, PAL.stone[2]);
    setW(b, x, quay + 2, (x & 7) === 0 ? PAL.ink[1] : PAL.stone[1]);
    setW(b, x, quay + 3, PAL.ink[1]);
  }
  if (haze > 0) remap(b, HAZE[light], 0, quay, w, Math.min(4, h - quay));
  if (!water) return b.touch();
  // The canal: wobbly reflections of what stands on the quay, darker with depth.
  const wr = WATER[light];
  const top = quay + 4;
  for (let y = top; y < h; y++) {
    const d = y - top;
    const wob = Math.round(Math.sin((d * 2 * Math.PI) / 7) * 1.5);
    const sy = quay - 1 - d * 2;
    for (let x = 0; x < w; x++) {
      let c: Color = 0;
      if (sy >= 0) c = b.data[sy * w + ((((x + wob) % w) + w) % w)];
      let k: number;
      if ((c & 255) === 0) k = wr.length - 2;
      else k = Math.min(wr.length - 2, Math.floor(lum(c) * (wr.length - 1)));
      k -= Math.floor(d / 12);
      if (bayer(x, y) < 0.25 && d % 3 === 0) k += 1;
      const ripple = (d % 4 === 1 && noise1(x + d * 31, 9, w, seed + d) > 0.7) || hash2(x, y, seed + 3) > 0.995;
      if (ripple) k = wr.length - 1;
      b.data[y * w + x] = wr[Math.max(0, Math.min(wr.length - 1, k))] >>> 0;
    }
  }
  // Moored boats (sloepen) along the quay.
  const nb = Math.max(1, Math.round(w / 200));
  for (let k = 0; k < nb; k++) {
    const bx = Math.round((k + 0.3) * (w / nb) + hash2(k, 9, seed) * 40);
    const len = 18 + Math.floor(hash2(k, 10, seed) * 10);
    const col = [PAL.green[1], PAL.navy[1], PAL.red[1], PAL.brown[2]][k % 4];
    rectW(b, bx, top + 1, len, 3, col);
    rectW(b, bx, top + 1, len, 1, PAL.snow[2]);
    rectW(b, bx + 1, top + 4, len - 2, 1, PAL.ink[1]);
    rectW(b, bx + 4, top, 3, 1, PAL.red[2]);
  }
  return b.touch();
};

// ------------------------------------------------------------------------------------ ams-elms

const amsElms: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  const light = lightOf(p);
  const mid = px(p, 'y', 0.3, h);
  const spacing = Math.max(64, num(p, 'spacing', 112));
  const n = Math.max(1, Math.round(w / spacing));
  const step = w / n;
  const leaf = [PAL.green[0], PAL.green[1], PAL.green[2], PAL.green[3], PAL.green[4]];
  for (let k = 0; k < n; k++) {
    const cx = Math.round(k * step + step / 2 + (hash2(k, 1, seed) - 0.5) * step * 0.3);
    const r = 22 + Math.floor(hash2(k, 2, seed) * 10);
    const cy = mid + Math.floor(hash2(k, 3, seed) * 10) - 5;
    // Trunk and two branches.
    for (let y = cy; y < h; y++) {
      const tw = y > cy + 40 ? 5 : 4;
      for (let x = 0; x < tw; x++) setW(b, cx - 2 + x, y, x === 0 ? PAL.brown[2] : x === tw - 1 ? PAL.brown[0] : PAL.brown[1]);
    }
    for (let t = 0; t < 22; t++) {
      setW(b, cx - 2 - t, cy + 14 - Math.round(t * 0.7), PAL.brown[1]);
      setW(b, cx + 2 + t, cy + 12 - Math.round(t * 0.8), PAL.brown[1]);
    }
    // Canopy clusters, lit from the top left, with holes.
    for (let c = 0; c < 7; c++) {
      const bx = cx + Math.round((hash2(k, 10 + c, seed) - 0.5) * r * 1.5);
      const by = cy + Math.round((hash2(k, 20 + c, seed) - 0.6) * r * 0.9);
      const br = Math.round(r * (0.45 + hash2(k, 30 + c, seed) * 0.25));
      for (let y = -br; y <= br; y++) {
        for (let x = -br; x <= br; x++) {
          const d = Math.sqrt(x * x + y * y);
          if (d > br) continue;
          if (d > br - 3 && hash2(bx + x, by + y, seed + 5) < 0.5) continue;
          const v = (-x - y) / br + (hash2(bx + x, by + y, seed + 6) - 0.5) * 0.6;
          const i = v > 0.9 ? 4 : v > 0.2 ? 3 : v > -0.5 ? 2 : 1;
          setW(b, bx + x, by + y, d > br - 1 ? PAL.green[0] : leaf[i]);
        }
      }
    }
    // A lamp post between the trees and bikes leaning on the trunk.
    const lx = Math.round(cx + step / 2);
    rectW(b, lx, h - 70, 2, 70, PAL.ink[1]);
    rectW(b, lx - 2, h - 76, 6, 6, PAL.gold[3]);
    rectW(b, lx - 3, h - 77, 8, 1, PAL.ink[1]);
    if (bool(p, 'bikes', true)) {
      const bike = new PixelBuffer(24, 17);
      drawBike(bike, 1, 16, [PAL.ink[1], PAL.red[1], PAL.sky[0], PAL.green[1]][k % 4], k % 2 === 0);
      bike.outline(INK);
      blitW(b, bike, cx + 3, h - 17 - 40);
    }
  }
  applyLight(b, light);
  return b.touch();
};

// ------------------------------------------------------------------------------------ ams-plein

const amsPlein: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  const light = lightOf(p);
  const lawn = px(p, 'y', 0.72, h);
  // The Rijksmuseum's back, far away: the long red-brick palace with cream stone bands, rows of
  // arched windows, steep slate roofs with dormers, end and centre pavilions, the arcade of the
  // passage and the two central towers with tall slate spires and gold tips.
  const mx0 = Math.round(w * 0.12);
  const mw = Math.round(w * 0.76);
  const top = lawn - 50;
  const brick = PAL.rust[1];
  const course = PAL.rust[0];
  const stone = PAL.sand[3];
  const glass = PAL.navy[1];
  const slate = (x0: number, x1: number, y0: number, h2: number): void => {
    // A steep slate roof: rows shrink inward; light on the left slope.
    for (let r = 0; r < h2; r++) {
      const inset = Math.round(r * 0.6);
      const yy = y0 - 1 - r;
      for (let xx = x0 + inset; xx < x1 - inset; xx++) setW(b, xx, yy, r % 3 === 0 ? PAL.steel[0] : xx < (x0 + x1) / 2 ? PAL.steel[2] : PAL.steel[1]);
    }
  };
  const facade = (x0: number, x1: number, t: number): void => {
    rectW(b, x0, t, x1 - x0, lawn - t, brick);
    for (let y = t + 2; y < lawn; y += 3) rectW(b, x0, y, x1 - x0, 1, course);
    // Cream bands: cornice, string courses, plinth.
    rectW(b, x0, t, x1 - x0, 2, stone);
    rectW(b, x0, t + 17, x1 - x0, 2, stone);
    rectW(b, x0, t + 33, x1 - x0, 1, stone);
    rectW(b, x0, lawn - 5, x1 - x0, 5, PAL.sand[2]);
    rectW(b, x0, lawn - 5, x1 - x0, 1, stone);
    // Two rows of tall arched windows with cream frames.
    for (let x = x0 + 3; x + 3 < x1 - 2; x += 6) {
      for (const wy of [t + 5, t + 21]) {
        rectW(b, x, wy + 1, 3, 10, glass);
        setW(b, x + 1, wy, glass);
        setW(b, x, wy, stone);
        setW(b, x + 2, wy, stone);
        setW(b, x + 1, wy - 1, stone);
        setW(b, x + 1, wy + 5, PAL.sky[1]); // a glint on the glass
      }
      rectW(b, x, t + 36, 3, 6, glass);
      setW(b, x + 1, t + 35, stone);
    }
  };
  // The long wings.
  facade(mx0, mx0 + mw, top);
  slate(mx0, mx0 + mw, top, 9);
  for (let x = mx0 + 10; x < mx0 + mw - 10; x += 18) {
    rectW(b, x, top - 6, 4, 5, stone);
    rectW(b, x + 1, top - 5, 2, 3, glass);
  }
  // End pavilions (a little higher, lighter brick, own roofs).
  for (const px0 of [mx0 - 6, mx0 + mw - 34]) {
    facade(px0, px0 + 40, top - 8);
    rectW(b, px0, top - 8, 2, lawn - top + 8, PAL.rust[2]);
    slate(px0, px0 + 40, top - 8, 14);
  }
  // The centre: the passage arcade and the two towers.
  const cx = mx0 + Math.round(mw / 2);
  facade(cx - 46, cx + 46, top - 10);
  slate(cx - 46, cx + 46, top - 10, 10);
  for (let k = -2; k <= 1; k++) {
    const ax = cx + k * 18 + 3;
    rectW(b, ax - 1, lawn - 18, 14, 13, stone);
    rectW(b, ax, lawn - 16, 12, 11, PAL.ink[1]);
    rectW(b, ax + 2, lawn - 17, 8, 1, PAL.ink[1]);
  }
  for (const tx of [cx - 40, cx + 18]) {
    const tw = 22;
    const tt = top - 44;
    rectW(b, tx, tt, tw, top - 10 - tt, brick);
    for (let y = tt + 2; y < top - 10; y += 3) rectW(b, tx, y, tw, 1, course);
    rectW(b, tx, tt, 2, top - 10 - tt, PAL.orange[0]); // the lit left edge
    rectW(b, tx, tt, tw, 2, stone);
    rectW(b, tx, tt + 14, tw, 2, stone);
    rectW(b, tx, tt + 26, tw, 1, stone);
    for (const wx of [tx + 5, tx + 13]) {
      rectW(b, wx, tt + 4, 4, 9, glass);
      setW(b, wx + 1, tt + 3, stone);
      setW(b, wx + 2, tt + 3, stone);
      rectW(b, wx, tt + 18, 4, 7, glass);
    }
    // The clock-lantern stage and the tall slate spire with a gold tip.
    rectW(b, tx + 3, tt - 6, tw - 6, 6, PAL.sand[2]);
    for (let x = tx + 5; x < tx + tw - 5; x += 3) rectW(b, x, tt - 5, 1, 4, PAL.ink[1]);
    for (let y = 0; y < 30; y++) {
      const half = Math.max(1, Math.round(((tw - 6) / 2) * (y / 29)));
      for (let x = -half; x < half; x++) setW(b, tx + 11 + x, tt - 36 + y, x < 0 ? PAL.steel[2] : PAL.steel[0]);
    }
    rectW(b, tx + 10, tt - 41, 2, 5, PAL.gold[2]);
    setW(b, tx + 10, tt - 42, PAL.gold[3]);
    setW(b, tx + 11, tt - 42, PAL.gold[3]);
  }
  // Plane trees in a row in front of the museum.
  for (let k = 0; k < Math.round(w / 48); k++) {
    const cx = Math.round(k * 48 + 24 + (hash2(k, 1, seed) - 0.5) * 12);
    const r = 9 + Math.floor(hash2(k, 2, seed) * 5);
    rectW(b, cx, lawn - 14, 2, 14, PAL.brown[1]);
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y > r * r) continue;
        const v = -x - y + (hash2(cx + x, y, seed) - 0.5) * 6;
        setW(b, cx + x, lawn - 14 - r + y + 4, v > r * 0.5 ? PAL.green[4] : v > -r * 0.4 ? PAL.green[3] : PAL.green[2]);
      }
    }
  }
  // The lawn with mowing stripes, the long pool and tourists.
  for (let y = lawn; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const stripe = Math.floor(x / 24) % 2 === 0;
      setW(b, x, y, y === lawn ? PAL.green[4] : stripe ? PAL.green[3] : PAL.green[2]);
    }
  }
  const py = lawn + 8;
  rectW(b, Math.round(w * 0.1), py, Math.round(w * 0.8), 6, PAL.stone[3]);
  rectW(b, Math.round(w * 0.1) + 2, py + 1, Math.round(w * 0.8) - 4, 4, PAL.sky[1]);
  for (let x = Math.round(w * 0.1) + 2; x < Math.round(w * 0.9) - 2; x++) if (hash2(x, 1, seed) > 0.8) setW(b, x, py + 2, PAL.snow[3]);
  const coats = [PAL.red[2], PAL.gold[2], PAL.sky[1], PAL.pink[2], PAL.snow[3], PAL.green[1], PAL.orange[1]];
  const skins = [PAL.skinA[2], PAL.skinB[2], PAL.skinC[2]];
  for (let x = 2; x < w; x += 5) {
    if (hash2(x, 3, seed) < 0.55) continue;
    const y = lawn + 2 + Math.floor(hash2(x, 4, seed) * 4);
    const c = coats[Math.floor(hash2(x, 5, seed) * coats.length)];
    setW(b, x, y, skins[Math.floor(hash2(x, 6, seed) * 3)]);
    rectW(b, x, y + 1, 2, 3, c);
    setW(b, x, y + 4, PAL.navy[1]);
    if (hash2(x, 7, seed) < 0.2) setW(b, x + 2, y, PAL.snow[3]); // a camera flash
  }
  // A white-blue tram on its track.
  const tx0 = Math.round(w * 0.62);
  const ty = lawn - 13;
  rectW(b, 0, ty + 14, w, 1, PAL.steel[1]);
  rectW(b, tx0, ty, 90, 14, PAL.snow[3]);
  rectW(b, tx0, ty + 9, 90, 3, PAL.sky[0]);
  rectW(b, tx0, ty - 1, 90, 1, PAL.steel[3]);
  for (let x = tx0 + 4; x < tx0 + 86; x += 9) rectW(b, x, ty + 2, 6, 5, PAL.navy[1]);
  for (let x = tx0 + 28; x < tx0 + 90; x += 30) rectW(b, x, ty, 1, 14, PAL.steel[2]);
  rectW(b, tx0 + 30, ty - 8, 1, 7, PAL.ink[1]);
  rectW(b, tx0 + 24, ty - 8, 13, 1, PAL.ink[1]);
  rectW(b, 0, ty - 9, w, 1, PAL.ink[1]); // overhead wire
  applyLight(b, light);
  return b.touch();
};

defineBgGenerator('ams-skyline', amsSkyline);
defineBgGenerator('ams-canal-houses', amsCanalHouses);
defineBgGenerator('ams-elms', amsElms);
defineBgGenerator('ams-plein', amsPlein);

export const AMS_BG_GENERATORS = ['ams-skyline', 'ams-canal-houses', 'ams-elms', 'ams-plein'] as const;
