/**
 * Mission m5 custom background generators (GDD §15.5):
 *
 * - `organ-deep`   — dim far pipes inside the Grand Organ (m5-b, far layer). Seamless in x and y.
 * - `organ-pipes`  — rows of brass pipes on dark wooden rank boards with gears (m5-b, near layer).
 *                    Seamless in x and y (one rank every `rank` px; the buffer height must be a
 *                    multiple of it).
 * - `console-room` — the console hall: giant dim pipes, gold trim, crimson drapes and a stained-glass
 *                    window of Fanfaroni (m5-c, one screen).
 *
 * Contract (ART_GUIDE §7): exactly w × h, palette colours only, deterministic per seed. Everything
 * here is drawn with wrap-around writes so the vertical layers tile in both directions.
 */
import type { Color } from '../../../../engine/color';
import { PixelBuffer } from '../../../../engine/pixel';
import { INK, PAL } from '../../../../engine/palette';
import { defineBgGenerator, type BgGenerator } from '../../../art/art-registry';
import { bayer, hash1, hash2 } from '../../../art/paint';

type Params = Readonly<Record<string, unknown>>;

function num(p: Params, k: string, d: number): number {
  const v = p[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

/** Write with wrap-around in both directions (seamless tiles). */
function put(b: PixelBuffer, x: number, y: number, c: Color): void {
  const w = b.w;
  const h = b.h;
  b.data[((((y | 0) % h) + h) % h) * w + ((((x | 0) % w) + w) % w)] = c >>> 0;
}

function box(b: PixelBuffer, x: number, y: number, w: number, h: number, c: Color): void {
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) put(b, x + xx, y + yy, c);
}

function hl(b: PixelBuffer, x0: number, x1: number, y: number, c: Color): void {
  for (let x = x0; x <= x1; x++) put(b, x, y, c);
}

function vl(b: PixelBuffer, x: number, y0: number, y1: number, c: Color): void {
  for (let y = y0; y <= y1; y++) put(b, x, y, c);
}

/**
 * One organ pipe standing on `foot` (its bottom), `len` tall, `w` wide, lit from the left.
 * Ramp = [shadow, body, lit, glint]. A mouth (the dark slit with a lip) sits `mouth` px above the
 * foot; the top is a short cone.
 */
function pipe(b: PixelBuffer, x: number, foot: number, w: number, len: number, ramp: readonly Color[], mouth: number, dark: Color): void {
  const top = foot - len;
  for (let y = top; y < foot; y++) {
    // Conical top: 3 rows narrowing by 1 px each side.
    const inset = y - top < 3 ? 3 - (y - top) : 0;
    for (let i = inset; i < w - inset; i++) {
      let c = ramp[1];
      if (i <= inset) c = ramp[2];
      else if (i === inset + 1 && w > 6) c = ramp[3];
      else if (i >= w - inset - 2) c = ramp[0];
      put(b, x + i, y, c);
    }
  }
  // Rim at the top and a collar ring every 40 px.
  hl(b, x + 1, x + w - 2, top + 3, ramp[0]);
  // Mouth: a dark arch with a lit lower lip.
  const my = foot - mouth;
  const mw = Math.max(2, Math.floor(w / 2) - 1);
  const mx = x + Math.floor((w - mw) / 2);
  box(b, mx, my - 4, mw, 4, dark);
  hl(b, mx, mx + mw - 1, my, ramp[3]);
  hl(b, mx - 1, mx + mw, my + 1, ramp[2]);
  // The foot cone: narrows into the board.
  for (let k = 0; k < 4; k++) {
    const y = foot - 4 + k;
    hl(b, x + k, x + w - 1 - k, y, k === 0 ? ramp[2] : ramp[0]);
  }
}

/** A gear: a toothed brass disc with a dark hub (static frame; the near layer only). */
function gear(b: PixelBuffer, cx: number, cy: number, r: number, ramp: readonly Color[], seed: number): void {
  const teeth = 8 + Math.round(r / 3);
  const rot = hash1(seed) * Math.PI;
  for (let y = -r - 3; y <= r + 3; y++) {
    for (let x = -r - 3; x <= r + 3; x++) {
      const d = Math.hypot(x, y);
      const a = Math.atan2(y, x) + rot;
      const tooth = Math.cos(a * teeth) > 0.3;
      const edge = r + (tooth ? 2 : 0);
      if (d > edge) continue;
      let c = ramp[1];
      if (d > r - 2) c = x + y < 0 ? ramp[2] : ramp[0];
      if (d < r * 0.35) c = INK;
      else if (d < r * 0.5) c = ramp[3];
      // Spokes.
      else if (d < r - 3 && Math.abs(Math.sin(a * 3)) < 0.18) c = ramp[0];
      else if (d < r - 3 && d > r * 0.5) c = PAL.brown[0];
      put(b, cx + x, cy + y, c);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// organ-deep — far dim pipes
// ---------------------------------------------------------------------------------------------

/** Params: `slot` (px between pipes, 16), `beam` (px between wooden beams, 128; divides h). */
const organDeep: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  b.fill(PAL.brown[0]);
  // A faint dark gradient behind the pipes (dithered with the inner shadow).
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (bayer(x, y) < 0.25) b.data[y * w + x] = PAL.ink[1] >>> 0;
  const slot = Math.max(8, num(p, 'slot', 16));
  const n = Math.max(1, Math.floor(w / slot));
  const dim: Color[] = [PAL.ink[1], PAL.brown[0], PAL.brown[1], PAL.gold[0]];
  for (let i = 0; i < n; i++) {
    const pw = 6 + 2 * Math.floor(hash1(i, seed) * 4);
    const x = i * slot + Math.floor((slot - pw) / 2);
    // Full-height pipes: two mouths per tile height at a per-pipe offset (periodic in y).
    const off = Math.floor(hash1(i, seed + 3) * h);
    for (let y = 0; y < h; y++) {
      for (let k = 0; k < pw; k++) {
        let c = dim[1];
        if (k === 0) c = dim[2];
        else if (k === 1 && pw > 6) c = dim[3];
        else if (k >= pw - 2) c = dim[0];
        put(b, x + k, y, c);
      }
    }
    for (let m = 0; m < 2; m++) {
      const my = off + (m * h) / 2;
      const mw = Math.max(2, pw / 2 - 1);
      box(b, x + (pw - mw) / 2, my - 4, mw, 4, PAL.ink[0]);
      hl(b, x + (pw - mw) / 2, x + (pw - mw) / 2 + mw - 1, my, dim[3]);
    }
  }
  // Wooden beams with a thin brass trim.
  const beam = Math.max(32, num(p, 'beam', 128));
  for (let y0 = 0; y0 < h; y0 += beam) {
    box(b, 0, y0, w, 10, PAL.brown[1]);
    hl(b, 0, w - 1, y0, PAL.brown[2]);
    hl(b, 0, w - 1, y0 + 9, PAL.ink[1]);
    for (let x = 0; x < w; x += 4) if (((x / 4) | 0) % 2 === 0) put(b, x + 1, y0 + 4, PAL.gold[0]);
    hl(b, 0, w - 1, y0 + 10, PAL.ink[0]);
  }
  return b;
};

// ---------------------------------------------------------------------------------------------
// organ-pipes — near rows of brass pipes, dark wood, gears
// ---------------------------------------------------------------------------------------------

/** Params: `rank` (px between rank boards, 192; divides h). */
const organPipes: BgGenerator = (w, h, p, seed) => {
  const b = new PixelBuffer(w, h);
  const rank = Math.max(96, num(p, 'rank', 192));
  const brass: Color[] = [PAL.brown[1], PAL.gold[0], PAL.gold[1], PAL.gold[2]];
  const dimBrass: Color[] = [PAL.brown[0], PAL.brown[1], PAL.gold[0], PAL.gold[1]];
  for (let r0 = 0; r0 < h; r0 += rank) {
    const board = r0 + rank - 26; // rank board top
    const ri = Math.floor(r0 / rank);
    // Gears behind the pipes (half hidden), 2 per rank.
    for (let g = 0; g < 2; g++) {
      const gx = Math.floor(((g + 0.25 + hash2(ri, g, seed) * 0.5) / 2) * w);
      const gy = board - 30 - Math.floor(hash2(ri, g + 7, seed) * 60);
      gear(b, gx, gy, 14 + Math.floor(hash2(ri, g + 3, seed) * 8), dimBrass, ri * 11 + g);
    }
    // Pipes: groups of 7 in an arch (tallest in the middle), 12 px apart.
    const step = 12;
    const groupW = step * 7 + 12;
    const groups = Math.max(1, Math.floor(w / groupW));
    const pad = Math.floor((w - groups * groupW) / 2);
    for (let g = 0; g < groups; g++) {
      const gx = pad + g * groupW + 6;
      const tall = 70 + Math.floor(hash2(ri, g, seed + 9) * 50);
      for (let j = 0; j < 7; j++) {
        const arch = 1 - Math.abs(j - 3) / 4;
        const len = Math.round(tall * (0.45 + 0.55 * arch));
        pipe(b, gx + j * step, board, 10, len, j % 2 === 0 ? brass : dimBrass, 16 + (j % 3) * 4, INK);
      }
    }
    // The rank board: dark walnut with a brass rail and carved panels.
    box(b, 0, board, w, 26, PAL.brown[1]);
    hl(b, 0, w - 1, board, PAL.gold[1]);
    hl(b, 0, w - 1, board + 1, PAL.gold[0]);
    hl(b, 0, w - 1, board + 25, PAL.ink[0]);
    for (let x = 0; x < w; x += 32) {
      box(b, x + 3, board + 6, 26, 14, PAL.brown[0]);
      hl(b, x + 3, x + 28, board + 19, PAL.brown[2]);
      vl(b, x + 28, board + 6, board + 19, PAL.brown[2]);
      put(b, x + 16, board + 12, PAL.gold[1]);
      put(b, x + 16, board + 13, PAL.gold[0]);
    }
  }
  // Fill what is still empty with the dark interior (a dithered walnut wall).
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if ((b.data[i] & 255) !== 0) continue;
      b.data[i] = (bayer(x, y) < 0.5 ? PAL.ink[1] : PAL.brown[0]) >>> 0;
    }
  }
  return b;
};

// ---------------------------------------------------------------------------------------------
// console-room — the final hall
// ---------------------------------------------------------------------------------------------

/**
 * The window's lead-glass picture: Fanfaroni (bicorne with plumes, crimson coat, gold epaulettes,
 * the baton raised) on a navy-and-purple field. Pane cell colours by a tiny map. Original design.
 */
function stainedGlass(b: PixelBuffer, x0: number, y0: number, w: number, h: number): void {
  const cx = x0 + w / 2;
  const archH = w / 2;
  const inside = (x: number, y: number): boolean => {
    if (x < x0 || x >= x0 + w || y < y0 || y >= y0 + h) return false;
    if (y < y0 + archH) {
      // Pointed arch: two circle arcs.
      const r = w * 0.85;
      const dl = Math.hypot(x - (x0 + w - r), y - (y0 + archH));
      const dr = Math.hypot(x - (x0 + r), y - (y0 + archH));
      return dl <= r && dr <= r;
    }
    return true;
  };
  for (let y = y0 - 3; y < y0 + h + 3; y++) {
    for (let x = x0 - 3; x < x0 + w + 3; x++) {
      const inn = inside(x, y);
      // Gold frame around the arch.
      if (!inn) {
        let near = false;
        for (let d = 1; d <= 3 && !near; d++) if (inside(x + d, y) || inside(x - d, y) || inside(x, y + d) || inside(x, y - d)) near = true;
        if (near) b.set(x, y, y < y0 + 4 ? PAL.gold[2] : PAL.gold[1]);
        continue;
      }
      // Field: navy / purple diamonds with lead lines.
      const u = x - x0;
      const v = y - y0;
      const lead = (u + v) % 10 === 0 || (u - v + 1000) % 10 === 0;
      let c: Color = ((Math.floor((u + v) / 10) + Math.floor((u - v + 1000) / 10)) & 1) === 0 ? PAL.navy[1] : PAL.purple[0];
      if (v > h - 14) c = PAL.purple[1];
      if (lead) c = INK;
      b.set(x, y, c);
    }
  }
  // The figure (relative to the window centre and bottom).
  const fx = Math.round(cx);
  const base = y0 + h - 4;
  const fig = (x: number, y: number, ww: number, hh: number, c: Color): void => {
    b.rect(x, y, ww, hh, c);
  };
  // Rays of glory behind him (lead lines in gold).
  for (let k = -2; k <= 2; k++) b.line(fx, base - 46, fx + k * 10, y0 + 6, PAL.gold[0]);
  // Coat (crimson), with gold buttons and a sash.
  fig(fx - 9, base - 34, 18, 34, PAL.red[1]);
  fig(fx - 8, base - 34, 6, 34, PAL.red[2]);
  b.line(fx - 9, base - 30, fx + 8, base - 12, PAL.sky[1]);
  for (let k = 0; k < 4; k++) b.set(fx + 3, base - 28 + k * 6, PAL.gold[3]);
  // Epaulettes.
  fig(fx - 13, base - 35, 6, 3, PAL.gold[2]);
  fig(fx + 7, base - 35, 6, 3, PAL.gold[2]);
  // Head.
  fig(fx - 4, base - 44, 8, 9, PAL.skinA[2]);
  b.set(fx - 2, base - 41, INK);
  b.set(fx + 2, base - 41, INK);
  fig(fx - 3, base - 37, 6, 1, PAL.red[0]); // the open mouth (he is always singing)
  // Bicorne hat with plumes.
  b.ellipse(fx - 7, base - 59, 6, 10, PAL.snow[2]);
  b.ellipse(fx - 2, base - 62, 6, 12, PAL.red[2]);
  b.ellipse(fx + 3, base - 58, 6, 10, PAL.snow[2]);
  b.ellipse(fx - 11, base - 51, 23, 7, INK);
  b.hline(fx - 10, fx + 10, base - 46, PAL.gold[2]);
  // Raised arm with the baton.
  b.line(fx + 9, base - 32, fx + 15, base - 44, PAL.red[1]);
  b.line(fx + 15, base - 44, fx + 20, base - 58, PAL.snow[3]);
  b.set(fx + 20, base - 59, PAL.gold[3]);
}

const consoleRoom: BgGenerator = (w, h, _p, seed) => {
  const b = new PixelBuffer(w, h);
  b.fill(PAL.brown[0]);
  // Giant dim pipes across the whole hall (tall columns, rounded tops).
  const cols = Math.floor(w / 24);
  for (let i = 0; i < cols; i++) {
    const pw = 14 + 2 * Math.floor(hash1(i, seed) * 3);
    const x = i * 24 + Math.floor((24 - pw) / 2);
    const top = 6 + Math.floor(Math.abs(Math.sin((i / cols) * Math.PI * 2)) * 24 + hash1(i, seed + 1) * 10);
    for (let y = top; y < h; y++) {
      for (let k = 0; k < pw; k++) {
        const inset = y - top < 3 ? 3 - (y - top) : 0;
        if (k < inset || k >= pw - inset) continue;
        let c: Color = PAL.brown[1];
        if (k === inset || k === inset + 1) c = PAL.gold[0];
        else if (k >= pw - inset - 3) c = PAL.ink[1];
        b.set(x + k, y, c);
      }
    }
    // Mouth.
    const my = top + 40 + Math.floor(hash1(i, seed + 2) * 30);
    b.rect(x + 4, my - 5, pw - 8, 5, INK);
    b.hline(x + 4, x + pw - 5, my, PAL.gold[1]);
  }
  // A gallery rail with gold trim across the hall.
  const rail = 112;
  b.rect(0, rail, w, 8, PAL.brown[1]);
  b.hline(0, w - 1, rail, PAL.gold[2]);
  b.hline(0, w - 1, rail + 1, PAL.gold[1]);
  b.hline(0, w - 1, rail + 7, INK);
  for (let x = 4; x < w; x += 12) b.rect(x, rail + 3, 2, 3, PAL.gold[0]);
  // Lower wainscot: dark wood panels with gold.
  b.rect(0, 150, w, h - 150, PAL.brown[0]);
  b.hline(0, w - 1, 150, PAL.gold[1]);
  for (let x = 0; x < w; x += 48) {
    b.rect(x + 4, 156, 40, 18, PAL.ink[1]);
    b.strokeRect(x + 4, 156, 40, 18, PAL.brown[2]);
  }
  // Crimson velvet drapes at both sides (gathered folds).
  for (const [x0, dir] of [[0, 1], [w - 36, -1]] as const) {
    for (let x = 0; x < 36; x++) {
      const fold = Math.sin((x / 36) * Math.PI * 4) > 0.2;
      const len = 120 + Math.round(Math.sin((x / 36) * Math.PI) * 10) * dir;
      for (let y = 0; y < len; y++) b.set(x0 + x, y, fold ? PAL.red[1] : PAL.red[0]);
    }
    b.rect(x0, 0, 36, 5, PAL.gold[1]);
    b.hline(x0, x0 + 35, 5, PAL.gold[0]);
  }
  // The stained-glass window of Fanfaroni (left of the console, above the player's floor).
  stainedGlass(b, 54, 12, 62, 92);
  return b;
};

defineBgGenerator('organ-deep', organDeep);
defineBgGenerator('organ-pipes', organPipes);
defineBgGenerator('console-room', consoleRoom);
