/**
 * UHD `ams-canal-houses` (docs/ART_GUIDE.md "UHD art"): a row of canal houses on a quay, the canal
 * below with their reflections, at 2× and 4× from ONE density-generic generator.
 *
 * Same design as the 1× layer (backgrounds.ts): the same hashes give every house the same width,
 * storeys, gable, wall, lean and place (the 1× `paintHouse` geometry in far mode: storey height
 * `s`, ground floor s + 4, gable heights, window grid, door side, the storey-wise lean), the same
 * quay trees, quay edge, canal and moored boats. Painted, not outlined (style decision):
 *
 * - façades: brick with mortar courses and bricks a tone lighter or darker (4× fine courses;
 *   the far row only faint courses), painted walls with a dithered light gradient and rain streaks
 *   under the sills; a lit left corner, a deep seam to the next house, the ground floor darker
 *   toward the quay (ambient occlusion);
 * - gables in white stone: step copings with a cast shadow, neck gables with sandstone claws and a
 *   pediment, bell and spout gables with lit and shaded trim, flat cornices with dentils (4×) and a
 *   shadow on the wall below; loading doors, hoist beams and hooks;
 * - sash windows: white frames lit top-left, glass that reflects the sky (lighter at the top, a
 *   diagonal sheen, dark under the head of the frame), the sash bar, glazing bars at 4×, lintels,
 *   sills with a cast shadow; now and then a lit window;
 * - front doors with a fanlight, panels (4×), a brass knob and stone stoop steps;
 * - quay trees of leaf clusters; the quay cap of stone blocks with a lit edge, the quay wall with
 *   moss at the waterline;
 * - the canal: the 1× wobbly reflections (2× compressed, whole logical px wobble) mapped onto an HD
 *   water ramp per light, darker toward the viewer (dithered), broken by ripple dashes, a few
 *   near-white sky glints; sloepen with a lit gunwale, a waterline and a dark reflection.
 *
 * Atmospheric perspective: every colour goes through the layer's `Air` (the far row, `haze` 1:
 * lighter, cooler, lower contrast; the near row a touch of haze).
 */
import type { Color } from '../../../../engine/color';
import { PAL } from '../../../../engine/palette';
import { PAL_HD } from '../../../../engine/palette-hd';
import { defineHdBgGenerator, type HdBgGenerator } from '../../../art/art-registry';
import { hash2 } from '../../../art/paint';
import { BRICK, WALLS, type HouseSpec } from './art';
import { GABLES, WALLS_CYCLE, WATER } from './backgrounds';
import { airOf, BAYER8, BgCanvas, bool, dq, hdPath, homeOf, lightOf, num, oklab, pick, px, rampI, tableOf, type Air, type Den } from './art-hd-bg-kit';
import { leafMass, trunk } from './art-hd-bg-trees';

/** The materials of one layer (palette indices through its Air). */
interface Mats {
  air: Air;
  trim: Uint8Array;
  glass: Uint8Array;
  stone: Uint8Array;
  sand: Uint8Array;
  wood: Uint8Array;
  gold: Uint8Array;
  steel: Uint8Array;
  leaf: Uint8Array;
  bark: Uint8Array;
  moss: Uint8Array;
  /** The far row (haze): fewer fine details. */
  far: boolean;
}

function mats(air: Air, far: boolean): Mats {
  return {
    air,
    trim: rampI(air, PAL_HD.gable),
    glass: rampI(air, PAL_HD.glass),
    stone: rampI(air, PAL_HD.stone),
    sand: rampI(air, PAL_HD.sand),
    wood: rampI(air, PAL_HD.wood),
    gold: rampI(air, PAL_HD.gold),
    steel: rampI(air, PAL_HD.steel),
    leaf: rampI(air, PAL_HD.green),
    bark: rampI(air, PAL_HD.brown.slice(1, 7)),
    moss: rampI(air, PAL_HD.moss),
    far,
  };
}

/** The HD ramp of a 1× colour through the Air, and the colour's index in it. */
function homeI(air: Air, c: Color): { r: Uint8Array; m: number } {
  const h = homeOf(c);
  return { r: rampI(air, h.ramp), m: h.i };
}

// ------------------------------------------------------------------------------------ one house

/** A painted house (local canvas, the 1× paintHouse buffer layout) and what the blit needs. */
interface HouseArt {
  c: BgCanvas;
  H: number;
  gf: number;
  S: number;
}

function paintHouseHd(h: HouseSpec, M: Mats, d: Den): HouseArt {
  const S = h.s ?? 20;
  const w = h.w;
  const { r: wr, m } = homeI(M.air, WALLS[h.wall][2]);
  // Painted brick (green, black): the courses show through the paint at 4×, the bricks do not vary.
  const painted = d === 4 && !M.far && (h.wall === 'green' || h.wall === 'ink');
  const brick = BRICK.has(h.wall) || painted;
  const gf = S + 4;
  const bodyH = gf + h.floors * S;
  const gableH = h.gable === 'flat' ? Math.max(4, Math.round(S * 0.35)) : h.gable === 'spout' ? Math.round(S * 1.1) : Math.round(S * 1.35);
  const W = w + 2;
  const H = bodyH + gableH + 3;
  const c = new BgCanvas(W, H, d);
  const yT = H - bodyH;
  const cx = 1 + (w >> 1);
  const hs = (a: number, k: number): number => hash2(a, k, h.seed);
  const { trim, glass, stone } = M;
  const pxs = c.px;
  const CW = c.W;
  const far = M.far;
  // Brick courses (art rows per course incl. one mortar row) and brick length (art px).
  const cH = far ? 2 * d : d === 4 ? 4 : 3;
  const bl = d === 4 ? 9 : 6;
  const gTop = (yT - gableH) * d;
  const yBot = H * d;

  /** Wall texture across art px [X0, X1) of art row Y. */
  const wall = (X0: number, X1: number, Y: number): void => {
    if (X1 <= X0) return;
    // Light: a little lighter up high, darker toward the quay (ambient occlusion on the ground floor).
    const ty = (Y - gTop) / (yBot - gTop);
    const vRow = painted ? m - (ty > 0.9 ? 1 : 0) : m + 0.42 - ty * 0.5 - (ty > 0.86 ? (ty - 0.86) * 5 : 0);
    const row = Y * CW;
    const rB = yBot - 1 - Y;
    const ci = Math.floor(rB / cH);
    if (brick && rB % cH === cH - 1) {
      c.span(X0, X1, Y, pick(wr, Math.round(vRow) - 1));
      return;
    }
    if (!brick || far) {
      // Painted walls (and the far row) are one flat tone: no dithered gradient over a whole
      // façade (it reads as a mesh); only the ambient occlusion toward the quay, in a narrow band.
      const v = m + 0.5 - (ty > 0.86 ? (ty - 0.86) * 5 : 0);
      const fr = v - Math.floor(v);
      if (fr > 0.3 && fr < 0.7) c.span(X0, X1, Y, pick(wr, Math.floor(v)));
      else for (let X = X0; X < X1; X++) pxs[row + X] = pick(wr, Math.floor(v + (BAYER8[((Y & 7) << 3) | (X & 7)] - 0.5) * 0.6));
      if (!brick) return;
    }

    if (far) return;
    const off = ci & 1 ? bl >> 1 : 0;
    const base = Math.round(vRow);
    const joint = pick(wr, base - 1);
    let X = X0;
    while (X < X1) {
      const bi = Math.floor((X + off) / bl);
      const end = Math.min(X1, bi * bl + bl - off);
      const j = painted ? 0.5 : hash2(bi, ci, h.seed);
      const v = pick(wr, base + (j < 0.13 ? 1 : j > 0.84 ? -1 : 0));
      // Head joints at 4×.
      if (d === 4 && X === bi * bl - off) pxs[row + X++] = joint;
      for (; X < end; X++) pxs[row + X] = v;
    }
  };
  /** Wall across logical columns [x0, x1] (inclusive, as in paintHouse) on every art row of logical row y. */
  const wallL = (x0: number, x1: number, y: number): void => {
    const a = Math.max(1, x0) * d;
    const b = (Math.min(w, x1) + 1) * d;
    for (let k = 0; k < d; k++) wall(a, b, y * d + k);
  };

  // Body.
  for (let Y = yT * d; Y < H * d; Y++) wall(d, (w + 1) * d, Y);

  // Gable.
  const g0 = yT - gableH;
  const coping = (x0: number, x1: number, y: number): void => {
    // A stone slab one logical px high: lit top, shaded underside, a shadow on the wall below.
    c.rect(x0, y, x1 - x0, 1, trim[4]);
    c.rect(x0, y, x1 - x0, 0.25, trim[6]);
    c.rect(x0, y + 0.75, x1 - x0, 0.25, trim[2]);
    c.rect(x0, y, 0.5, 1, trim[5]);
  };
  if (h.gable === 'step') {
    const k = w >= 40 ? 4 : 3;
    const sh = Math.max(3, Math.floor(gableH / (k + 1)));
    const stepW = Math.max(2, Math.floor(w / 2 / (k + 1.6)));
    for (let i = 0; i <= k; i++) {
      const half = (w >> 1) - i * stepW;
      const ya = yT - (i + 1) * sh;
      const yb = yT - i * sh - 1;
      for (let y = Math.max(g0, ya); y <= yb; y++) wallL(cx - half, cx + half - 1, y);
    }
    for (let i = 0; i <= k; i++) {
      const half = (w >> 1) - i * stepW;
      const ya = Math.max(g0, yT - (i + 1) * sh);
      coping(cx - half, cx + half, ya);
      c.rect(cx - half + 0.5, ya + 1, 2 * half - 0.5, 0.25, pick(wr, m - 2));
    }
    const tip = yT - (k + 1) * sh;
    c.rect(cx - 1, tip - 2, 2, 2, trim[5]);
    c.rect(cx - 1, tip - 2, 0.5, 2, trim[6]);
    c.rect(cx + 0.5, tip - 2, 0.5, 2, trim[3]);
    c.rect(cx - 0.5, tip - 2.5, 1, 0.5, trim[4]);
  } else if (h.gable === 'neck') {
    const nw = Math.max(6, Math.round(w * 0.46));
    const nx0 = cx - (nw >> 1);
    for (let y = g0 + 3; y < yT; y++) wallL(nx0, nx0 + nw - 1, y);
    // Sandstone claws: scrolls two px wide on a smooth curve, the inside open to the sky.
    const ch = Math.round(gableH * 0.6);
    const sand = M.sand;
    for (let Y = (yT - ch) * d; Y < yT * d; Y++) {
      const t = (yT * d - 1 - Y) / (ch * d);
      const reach = (nx0 - 1) * (1 - t * t);
      const la = Math.round((nx0 - reach) * d);
      const ra = Math.round((nx0 + nw + reach) * d);
      for (let X = la; X < nx0 * d; X++) {
        const e = (X - la) / d;
        if (e < 2 || X >= (nx0 - 1) * d) pxs[Y * CW + X] = sand[e < 0.5 ? 6 : e < 1.5 ? 5 : 4];
      }
      for (let X = (nx0 + nw) * d; X < ra; X++) {
        const e = (ra - 1 - X) / d;
        if (e < 2 || X < (nx0 + nw + 1) * d) pxs[Y * CW + X] = sand[e < 0.5 ? 2 : e < 1.5 ? 3 : 4];
      }
    }
    // Volutes: a curl at the foot of each claw.
    c.disc(nx0 - 2.5, yT - 3.5, 1.2, 1.2, (_X, _Y, u, v) => sand[u + v < -0.4 ? 6 : u + v > 0.6 ? 3 : 5]);
    c.disc(nx0 + nw + 2.5, yT - 3.5, 1.2, 1.2, (_X, _Y, u, v) => sand[u + v < -0.4 ? 4 : u + v > 0.6 ? 2 : 3]);
    // Pediment: lit on its left slope.
    c.poly([[nx0 - 1, g0 + 3.5], [cx + 0.5, g0], [nx0 + nw + 1, g0 + 3.5]], (X) => (X < (cx + 0.5) * d ? trim[5] : trim[4]));
    c.rect(nx0 - 1, g0 + 3, nw + 2, 0.5, trim[2]);
    c.rect(nx0, g0 + 3.5, nw, 0.25, pick(wr, m - 2));
  } else if (h.gable === 'bell' || h.gable === 'spout') {
    const bell = h.gable === 'bell';
    for (let Y = g0 * d; Y < yT * d; Y++) {
      const t = (yT * d - 1 - Y) / (gableH * d - 1);
      const f = bell
        ? t < 0.45
          ? 0.55 + 0.45 * Math.cos((Math.PI * t) / 0.45 / 2) ** 0.8
          : 0.55 * Math.sqrt(Math.max(0, 1 - ((t - 0.45) / 0.55) ** 2))
        : 1 - t + 2 / w;
      const half = Math.max(1, (w / 2) * f);
      const a = Math.round((cx - half) * d);
      const b = Math.round((cx + half) * d);
      wall(a, b, Y);
      const tw = Math.max(1, d >> 1);
      for (let k = 0; k < tw; k++) {
        pxs[Y * CW + a + k] = trim[k === 0 ? 6 : 5];
        pxs[Y * CW + b - 1 - k] = trim[k === 0 ? 2 : 3];
      }
    }
    if (bell) {
      c.rect(cx - 2, g0, 4, 1, trim[5]);
      c.rect(cx - 2, g0, 4, 0.25, trim[6]);
      c.rect(cx - 1, g0 - 2, 2, 2, trim[4]);
      c.rect(cx - 1, g0 - 2, 0.5, 2, trim[6]);
    }
  } else {
    // Flat cornice: a deep white cornice with dentils (4×), a crest, its shadow on the wall.
    const cy = yT - gableH;
    c.rect(1, cy, w, gableH, trim[4]);
    c.rect(1, cy, w, 0.5, trim[6]);
    c.rect(1, cy + gableH - 1, w, 1, trim[2]);
    if (d === 4 && !far) for (let x = 2; x < w; x += 1.5) c.rect(x, cy + gableH - 2, 0.75, 0.75, trim[2]);
    c.rect(1, cy + gableH, w, 0.5, pick(wr, m - 2));
    c.rect(cx - 3, cy - 3, 6, 3, trim[4]);
    c.rect(cx - 3, cy - 3, 6, 0.5, trim[6]);
    c.rect(cx - 3, cy - 3, 0.5, 3, trim[5]);
    c.rect(cx + 2.5, cy - 3, 0.5, 3, trim[2]);
  }

  // Loading door and hoist beam in the gable (not on flat tops).
  const beam = (bx: number, by: number, hook: number): void => {
    c.rect(bx, by, 3, 2, M.wood[3]);
    c.rect(bx, by, 3, 0.5, M.wood[5]);
    c.rect(bx + 2.5, by, 0.5, 2, M.wood[1]);
    c.rect(bx + 0.5, by + 2, 2.5, 0.5, pick(wr, m - 2));
    c.rect(bx + 2, by + 2, 1 / d, hook, M.steel[5]);
    c.rect(bx + 1.75, by + 2 + hook, 0.75, 0.5, M.steel[3]);
  };
  if (h.gable !== 'flat') {
    const dw = 3;
    const dh = Math.max(3, Math.round(gableH * 0.38));
    const dy = yT - dh - 1;
    const door = homeI(M.air, h.wall === 'green' ? PAL.navy[1] : PAL.green[1]);
    c.rect(cx - (dw >> 1) - 1, dy - 1, dw + 2, dh + 1, trim[4]);
    c.rect(cx - (dw >> 1) - 1, dy - 1, dw + 2, 0.5, trim[6]);
    c.rect(cx - (dw >> 1) - 1, dy - 1, 0.5, dh + 1, trim[5]);
    c.rect(cx - (dw >> 1), dy, dw, dh, door.r[door.m]);
    c.rect(cx - (dw >> 1), dy, dw, 0.5, door.r[door.m - 1]);
    c.rect(cx - (dw >> 1), dy + 0.5, 0.5, dh - 0.5, door.r[door.m + 1]);
    c.rect(cx - 0.5 + (d === 4 ? 0.25 : 0), dy + 0.5, 1 / d, dh - 0.5, door.r[door.m - 1]);
    beam(cx - 1, Math.max(g0 + 1, dy - 3), 1.5);
  } else beam(cx - 1, yT + 1, 2.5);

  // Upper floors: sash windows, lintels (brick), sills with a cast shadow, rain streaks (plaster).
  const n = w >= 44 ? 3 : w >= 24 ? 2 : 1;
  const cw = w / n;
  for (let f = 0; f < h.floors; f++) {
    const top = H - gf - (f + 1) * S;
    const ww = Math.max(3, Math.round(cw * 0.42));
    const wh = Math.max(4, Math.round(S * (0.68 - f * 0.05)));
    const wy = top + Math.max(2, ((S - wh) >> 1) - 1);
    for (let i = 0; i < n; i++) {
      const wx = 1 + Math.round(cw * i + (cw - ww) / 2);
      sash(c, M, wx, wy, ww, wh, hs(f * 7 + i, 3) > 0.94);
      if (BRICK.has(h.wall)) {
        c.rect(wx - 1, wy - 1, ww + 2, 1, trim[3]);
        c.rect(wx - 1, wy - 1, ww + 2, 0.25, trim[5]);
      } else if (!far && d === 4 && hs(f * 7 + i, 5) < 0.6) {
        // A rain streak under the sill.
        const sx = wx + 0.5 + hs(f * 7 + i, 6) * (ww - 1);
        for (let Y = (wy + wh + 1) * d; Y < (wy + wh + 3.5) * d; Y++) {
          if (dq(1.6 - (Y - (wy + wh + 1) * d) / (2.5 * d), Math.round(sx * d), Y, 1) >= 1) c.rect(sx, Y / d, 0.5, 1 / d, pick(wr, m - 1));
        }
      }
      c.rect(wx - 1, wy + wh, ww + 2, 1, stone[4]);
      c.rect(wx - 1, wy + wh, ww + 2, 0.25, stone[6]);
      c.rect(wx - 0.5, wy + wh + 1, ww + 1.5, 0.25 + 0.25 * (d === 2 ? 1 : 0), pick(wr, m - 2));
    }
  }

  // Ground floor: a plinth line, a raised door with a fanlight and stoop steps, a window.
  const gy = H - gf;
  c.rect(1, gy, w, 1, trim[4]);
  c.rect(1, gy, w, 0.25, trim[6]);
  c.rect(1, gy + 1, w, 0.5, stone[1]);
  const left = hs(1, 9) < 0.5;
  const dw = 4;
  const dx = left ? 3 : w - dw - 2;
  const dTop = gy + 3;
  c.rect(dx - 1, dTop - 2, dw + 2, H - 3 - dTop + 2, trim[4]);
  c.rect(dx - 1, dTop - 2, dw + 2, 0.25, trim[6]);
  c.rect(dx - 1, dTop - 2, 0.5, H - 3 - dTop + 2, trim[5]);
  // The fanlight: glass under the frame head, bars at 4×.
  c.rect(dx, dTop - 1.5, dw, 1.25, glass[3]);
  c.rect(dx, dTop - 1.5, dw, 0.25, glass[1]);
  if (d === 4) for (let x = dx + 1; x < dx + dw; x += 1) c.rect(x, dTop - 1.25, 0.25, 1, trim[4]);
  const doorC = [PAL.green[1], PAL.navy[1], PAL.red[1], PAL.ink[1]][Math.floor(hs(2, 9) * 4)];
  const door = homeI(M.air, doorC);
  const dm = Math.max(1, Math.min(door.r.length - 2, door.m));
  c.rect(dx, dTop, dw, H - 3 - dTop, door.r[dm]);
  c.rect(dx, dTop, 0.5, H - 3 - dTop, door.r[dm + 1]);
  c.rect(dx, dTop, dw, 0.5, door.r[dm - 1]);
  if (d === 4 && !far) {
    // Two raised panels: lit top-left edges, shaded bottom-right.
    for (const py of [dTop + 1, dTop + 1 + (H - 4 - dTop) / 2]) {
      const ph = (H - 6 - dTop) / 2;
      c.rect(dx + 0.75, py, dw - 1.5, ph, door.r[dm]);
      c.rect(dx + 0.75, py, dw - 1.5, 0.25, door.r[dm + 1]);
      c.rect(dx + 0.75, py + ph - 0.25, dw - 1.5, 0.25, door.r[dm - 1]);
    }
  }
  c.rect(dx + dw - 1, dTop + 3, 0.5, 0.5, M.gold[6]);
  // Stoop: two stone steps with lit treads.
  c.rect(dx - 2, H - 3, dw + 4, 3, stone[3]);
  c.rect(dx - 2, H - 3, dw + 4, 0.5, stone[6]);
  c.rect(dx - 2, H - 1.5, dw + 4, 0.5, stone[5]);
  c.rect(dx - 2, H - 2.5, dw + 4, 0.25, stone[2]);
  c.rect(dx + dw + 1.5, H - 3, 0.5, 3, stone[1]);
  const ww = Math.max(4, w - dw - 8);
  const wx = left ? dx + dw + 3 : 3;
  sash(c, M, wx, gy + 4, Math.min(ww, 10), gf - 6, false);
  c.rect(wx - 1, gy + 4 + gf - 6, Math.min(ww, 10) + 2, 0.75, stone[4]);
  c.rect(wx - 1, gy + 4 + gf - 6, Math.min(ww, 10) + 2, 0.25, stone[6]);

  // The lit left corner and the deep seam to the next house.
  c.rect(1, yT, 0.5, bodyH, pick(wr, m + 1));
  c.rect(w + 0.5, yT, 0.5, bodyH, pick(wr, m - 2));
  return { c, H, gf, S };
}

/** A sash window in logical px (the 1× frame rect): frame, sky-reflecting glass, bars. */
function sash(c: BgCanvas, M: Mats, x: number, y: number, w: number, h: number, lit: boolean): void {
  const d = c.d;
  const { trim, glass } = M;
  const fw = 0.5;
  c.rect(x, y, w, h, trim[4]);
  c.rect(x, y, w, 0.25, trim[6]);
  c.rect(x, y, 0.25, h, trim[5]);
  c.rect(x + w - 0.25, y, 0.25, h, trim[2]);
  const gx = x + fw;
  const gy = y + fw;
  const gw = w - 2 * fw;
  const gh = h - 2 * fw;
  const X0 = Math.round(gx * d);
  const X1 = Math.round((gx + gw) * d);
  const Y0 = Math.round(gy * d);
  const Y1 = Math.round((gy + gh) * d);
  const pxs = c.px;
  const CW = c.W;
  const head = Math.max(1, d >> 1);
  const reveal = Math.max(1, d >> 2);
  const period = Math.max(1, Math.round(gw * d * 1.6));
  const sheen = d * 0.6;
  for (let Y = Y0; Y < Y1; Y++) {
    const t = (Y - Y0) / Math.max(1, Y1 - Y0);
    const row = Y * CW;
    if (lit) {
      pxs.fill(M.gold[t < 0.4 ? 5 : 4], row + X0, row + X1);
      continue;
    }
    if (Y - Y0 < head) {
      pxs.fill(glass[0], row + X0, row + X1);
      continue;
    }
    // Sky in the glass: lighter at the top, a diagonal sheen; dark under the reveal on the left.
    const v = 3.9 - t * 2.6;
    const brow = (Y & 7) << 3;
    const shift = (Y - Y0) * 0.8;
    for (let X = X0; X < X1; X++) {
      let k = Math.floor(v + (BAYER8[brow | (X & 7)] - 0.5) * 0.5);
      if (t > 0.15 && (X - X0 + shift) % period < sheen && k < 4) k = 4;
      if (X - X0 < reveal) k = 0;
      pxs[row + X] = glass[k < 0 ? 0 : k > 5 ? 5 : k];
    }
  }
  // The sash bar and (4×, wide panes) the glazing bars.
  const mid = y + Math.floor(h / 2);
  c.rect(x, mid, w, 0.5, trim[4]);
  c.rect(x, mid, w, 0.25, trim[5]);
  if (d === 4 && gw >= 2) {
    c.rect(x + w / 2 - 0.125, gy, 0.25, gh, trim[3]);
    if (gh >= 4) {
      c.rect(gx, gy + (mid - gy) / 2, gw, 0.25, trim[3]);
      c.rect(gx, mid + 0.5 + (y + h - fw - mid - 0.5) / 2, gw, 0.25, trim[3]);
    }
  }
}

// ------------------------------------------------------------------------------------ the layer

/** The water ramp of a light (dark → light), from the 1× WATER keys. */
function waterRamp(light: keyof typeof WATER): Color[] {
  return hdPath(WATER[light], 9);
}

const amsCanalHousesHd: HdBgGenerator = (w, h, p, seed, d) => {
  const c = new BgCanvas(w, h, d);
  const light = lightOf(p);
  const quay = px(p, 'y', 0.7, h);
  const S = Math.max(8, Math.round(num(p, 's', 12)));
  const haze = Math.max(0, Math.min(1, num(p, 'haze', 0)));
  const water = bool(p, 'water', true);
  const air = airOf(light, 0.08 + 0.44 * haze);
  const M = mats(air, haze > 0.5);
  const pxs = c.px;
  const W = c.W;
  // Houses along the quay (feet on the quay line), the 1× chain.
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
    const art = paintHouseHd(spec, M, d);
    // Blit with the 1× storey-wise lean (whole logical px; the ground floor stays).
    const levels = spec.floors + 2;
    const L = spec.lean;
    const hc = art.c;
    for (let Y = 0; Y < hc.H; Y++) {
      const y = Math.floor(Y / d);
      const level = y >= art.H - art.gf ? 0 : Math.min(levels - 1, 1 + Math.floor((art.H - art.gf - 1 - y) / art.S));
      const s = Math.round((L * level) / (levels - 1));
      const DY = (quay - art.H) * d + Y;
      if (DY < 0 || DY >= c.H) continue;
      const DX = c.wx((x0 - 1 + s) * d);
      const src = Y * hc.W;
      const dst = DY * W;
      for (let X = 0; X < hc.W; X++) {
        const v = hc.px[src + X];
        if (v === 0) continue;
        const x = DX + X;
        pxs[dst + (x >= W ? x - W : x)] = v;
      }
    }
    x0 += hw;
    i++;
  }
  // Quay trees in front of the houses (the 1× places and sizes).
  const nt = Math.max(1, Math.round(w / 88));
  for (let k = 0; k < nt; k++) {
    const cx = Math.round((k + 0.5) * (w / nt) + (hash2(k, 7, seed) - 0.5) * 20);
    const r = Math.round(S * 0.9);
    trunk(c, cx, quay - r - 6, quay, 2, M.bark, seed + k);
    const ky = quay - r - 8 + 0.5;
    leafMass(c, cx + 0.5, ky, r * 1.18 + 0.5, M.leaf, seed + k * 31, { x: cx, y: ky, r }, 0.2, r + 0.5);
  }
  // The quay edge: a cap of stone blocks with a lit edge, the wall below with moss at the waterline.
  const st = M.stone;
  c.rect(0, quay, w, 1, st[5]);
  c.rect(0, quay, w, 0.25, st[6]);
  c.rect(0, quay + 1, w, 1, st[4]);
  c.rect(0, quay + 1.75, w, 0.25, st[2]);
  c.rect(0, quay + 2, w, 1, st[2]);
  c.rect(0, quay + 3, w, 1, st[0]);
  for (let x = 0; x < w; x += 4) {
    c.rect(x, quay, 1 / d, 2, st[2]);
    if ((x & 7) === 0) c.rect(x + 1, quay + 2, 1 / d, 1, st[0]);
  }
  if (!M.far && d === 4) {
    for (let X = 0; X < W; X++) {
      const hv = hash2(X >> 2, 3, seed);
      if (hv < 0.35) c.rectA(X, (quay + 3) * d - 1 - (hv < 0.12 ? 1 : 0), 1, 1 + (hv < 0.12 ? 1 : 0), M.moss[hv < 0.2 ? 3 : 2]);
    }
  }
  if (!water) return c.finish();
  // The canal: the reflections of the houses on an HD water ramp per light. The water mirrors a
  // SOFT copy of the row above the quay (lightness boxed over about 3 logical px and two source
  // rows), so window frames, mullions and bars dissolve into colour blobs; runs of 4-12 logical px
  // are smeared and shifted a logical px left or right; the depth steps break in ripple dashes.
  const wr = waterRamp(light);
  const wi = rampI(air, wr);
  const nW = wi.length;
  // Index → reflected lightness 0 … 250 (the 1× luminance map, highlights compressed: reflections
  // are darker and softer than what they mirror); index 0 (the sky) → a light sky tone.
  const lq = tableOf((col) => Math.round(Math.min(0.8, Math.max(0, (oklab(col)[0] - 0.18) / 0.72)) * 250));
  lq[0] = Math.round(((nW - 1.5) / (nW - 1)) * 250);
  // Lightness → water index per depth step (3 steps darker toward the viewer).
  const lut = new Uint8Array(3 * 256);
  for (let dk = 0; dk < 3; dk++) {
    for (let q = 0; q < 256; q++) {
      const k = Math.min(nW - 2, Math.floor((q / 250) * (nW - 1)));
      lut[(dk << 8) | q] = wi[Math.max(0, k - dk)];
    }
  }
  const top = quay + 4;
  const half = Math.max(1, d >> 1);
  // One prefix-sum row of the soft source (wraps in x).
  const pre = new Float64Array(W + 1);
  const box = Math.round(1.5 * d);
  const inv = 1 / (2 * (2 * box + 1));
  for (let Y = top * d; Y < c.H; Y++) {
    const dd = (Y + 0.5) / d - top;
    const wob = Math.round(Math.sin((Math.floor(dd) * 2 * Math.PI) / 7) * 1.5) * d;
    const sY = quay * d - 1 - 2 * (Y - top * d);
    const row = Y * W;
    const dark = dd / 12;
    const kc = Math.min(2, Math.floor(dark));
    if (sY >= 0) {
      const ra = sY * W;
      const rb = (sY > 0 ? sY - 1 : sY) * W;
      for (let X = 0; X < W; X++) pre[X + 1] = pre[X] + lq[pxs[ra + X]] + lq[pxs[rb + X]];
    }
    // Broken reflections: runs of 4-12 logical px, some shifted a logical px left or right.
    const key = Math.floor(Y / half);
    let X = 0;
    let seg = 0;
    while (X < W) {
      const hv = hash2(seg, key, seed + 17);
      const end = Math.min(W, X + Math.round((4 + hv * 8) * d));
      const off = wob + (hash2(seg, key, seed + 19) < 0.4 ? (hv < 0.5 ? -d : d) : 0) + W;
      // The depth step of this run: its border with the next step breaks in dashes.
      const k = Math.floor(dark + (hash2(seg, key, seed + 23) - 0.5) * 0.7);
      const ko = (k < kc - 1 ? kc - 1 : k < 0 ? 0 : k > 2 ? 2 : k) << 8;
      const tint = Math.round((hash2(seg, key, seed + 29) - 0.5) * 14) + 0.5;
      if (sY < 0) {
        const v = lut[ko | lq[0]];
        for (; X < end; X++) pxs[row + X] = v;
      } else {
        // The box [a, b) over the soft source row, wrapped in x (no modulo per px).
        let a = (X + off - box) % W;
        let b = (X + off + box + 1) % W;
        for (; X < end; X++) {
          const sum = a < b ? pre[b] - pre[a] : pre[W] - pre[a] + pre[b];
          let q = (sum * inv + tint) | 0;
          if (q < 0) q = 0;
          else if (q > 255) q = 255;
          pxs[row + X] = lut[ko | q];
          if (++a === W) a = 0;
          if (++b === W) b = 0;
        }
      }
      seg++;
    }
    // The quay's shadow on the water right under the edge.
    if (dd < 0.75) c.span(0, W, Y, wi[0]);
  }
  // Ripple dashes: lighter and darker breaks across the reflections; a few near-white sky glints.
  const glint = M.trim[6];
  for (let Y = top * d + d; Y < c.H; Y += d) {
    const dd = Y / d - top;
    const rowSeed = Y * 7 + seed;
    let X = Math.floor(hash2(Y, 1, seed) * 6 * d);
    while (X < W) {
      const len = Math.round((1.5 + hash2(X, rowSeed, 2) * 5) * d * (dd < 8 ? 0.7 : 1));
      const kind = hash2(X, rowSeed, 3);
      if (kind < 0.16) c.span(X, X + len, Y, wi[nW - 2]);
      else if (kind < 0.3) c.span(X, X + len, Y, wi[1]);
      else if (kind < 0.315 && (Y & 1) === 0) c.span(X, X + Math.max(2, len >> 1), Y, glint);
      X += len + Math.round((2 + hash2(X, rowSeed, 4) * 9) * d);
    }
  }
  // Moored boats (sloepen) along the quay: a lit gunwale, the hull, a waterline and its reflection.
  const nb = Math.max(1, Math.round(w / 200));
  for (let k = 0; k < nb; k++) {
    const bx = Math.round((k + 0.3) * (w / nb) + hash2(k, 9, seed) * 40);
    const len = 18 + Math.floor(hash2(k, 10, seed) * 10);
    const hull = homeI(air, [PAL.green[1], PAL.navy[1], PAL.red[1], PAL.brown[2]][k % 4]);
    const hm = Math.max(1, Math.min(hull.r.length - 2, hull.m));
    c.poly([[bx, top + 1], [bx + len, top + 1], [bx + len - 1.25, top + 4], [bx + 1, top + 4]], (_X, Y) => {
      const t = (Y + 0.5) / d - (top + 1);
      return hull.r[t < 1 ? hm + 1 : t < 2.2 ? hm : hm - 1];
    });
    c.rect(bx, top + 1, len, 0.5, M.wood[6]);
    c.rect(bx, top + 1.5, len, 0.25, M.wood[4]);
    c.rect(bx + 1, top + 4, len - 2.25, 1, wi[0]);
    for (let x = bx + 2; x < bx + len - 2; x += 3) c.rect(x, top + 4.25 + (x & 1) * 0.25, 1.5, 0.25, hull.r[hm - 1]);
    // A red cushion on the stern seat.
    c.rect(bx + 4, top, 3, 1, air(PAL.red[2]));
    c.rect(bx + 4, top, 3, 0.25, air(PAL.red[3]));
  }
  return c.finish();
};

defineHdBgGenerator('ams-canal-houses', amsCanalHousesHd);
