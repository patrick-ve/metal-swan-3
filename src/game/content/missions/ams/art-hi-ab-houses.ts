/**
 * Mission `ams` 2× canal houses (docs/ART_GUIDE.md "2x art (mission ams)"): the twin of art.ts
 * `paintHouse` for the near decor houses (`decor/ams/house-<light>`). The same facade, gable,
 * windows, door and lean on the 2× grid, with the finer detail it allows: brick courses with 1-px
 * mortar joints in stretcher bond, smooth bell / spout / claw curves, sash windows with 1-px
 * glazing bars and a lit edge, stone copings and tulip boxes with single flowers, shop lettering
 * with crisp edges. Palette only, light top-left, the 2-px INK outline.
 */
import type { Color } from '../../../../engine/color';
import { INK, PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { outlineHi } from '../../../art/hi';
import { hash2 } from '../../../art/paint';
import { BRICK, TULIPS, WALLS, type HouseSpec } from './art';
import { Q, textHi } from './art-hi-ab-kit';

/**
 * A 2× brick wall colour at 2× pixel (X, Y) of a wall whose ground row is logical row `base`:
 * courses 3 logical px high (a 1-px joint under each), headers every 6 logical px offset by half
 * a brick per course, a few lit bricks and about one brick in twelve a lighter tint (the 1×
 * wall's bright speckle, as whole bricks).
 *
 * `calm` (the background house rows): only the 1× course lines (2 px, the wall-dark colour), no
 * head joints and no lit bricks, so the far facades stay quieter than the decor houses in front.
 */
export function brickHi(X: number, Y: number, baseY2: number, r: readonly Color[], seed: number, lit = true, calm = false): Color {
  const row2 = baseY2 - Y; // 2× rows above the ground (0 = the lowest 2× row)
  const course = Math.floor(row2 / 6);
  const inCourse = row2 - course * 6;
  if (calm) return inCourse === 0 || inCourse === 5 ? r[1] : r[2];
  if (inCourse === 0) return r[1];
  const off = (course & 1) * 6;
  const col = X + off;
  const brickN = Math.floor(col / 12);
  if (col - brickN * 12 === 0) return r[1];
  const h = hash2(brickN, course, seed);
  // A lighter brick: its face (between the lit top row and the joint) one step up.
  if (lit && h > 0.92 && inCourse >= 2 && inCourse <= 4) return r[3];
  if (inCourse !== 5 && inCourse !== 1) return r[2];
  if (lit && inCourse === 5 && h > 0.55) return r[3];
  // A few burnt bricks: a darker lower edge.
  if (h < 0.12 && inCourse === 1) return r[1];
  return r[2];
}

/** A 2× sash window (art.ts `sashWindow` on the 2× grid; near windows get 1-px glazing bars). */
export function sashWindowHi(q: Q, x: number, y: number, w: number, h: number, near: boolean, lit: boolean): void {
  q.rect(x, y, w, h, PAL.snow[3]);
  const pane = lit ? PAL.gold[2] : PAL.navy[1];
  q.rect(x + 1, y + 1, w - 2, h - 2, pane);
  if (!near) {
    q.dot(x + 1, y + 1, PAL.sky[2]);
    q.dot(x + 1.5, y + 1, PAL.sky[1]);
    return;
  }
  const mid = y + (h >> 1);
  // Meeting rail (the 1× sash bar) and 1-px glazing bars: two panes across, two down per sash.
  q.hline(x, x + w - 1, mid, PAL.snow[2]);
  q.dot(x, mid, PAL.snow[3]);
  if (w >= 7) q.fineCol(x + (w >> 1), y + 1, y + h - 2, PAL.snow[2]);
  else q.fineCol(x + (w >> 1), y + 1, y + h - 2, PAL.snow[1]);
  if (h >= 10) {
    const a = y + 1 + ((mid - y - 1) >> 1);
    const b = mid + 1 + ((y + h - 1 - mid - 1) >> 1);
    q.fineRow(x + 1, x + w - 2, a, PAL.snow[2]);
    q.fineRow(x + 1, x + w - 2, b, PAL.snow[2]);
  }
  // Reflections: a glint in the top-left corner of each sash and a diagonal streak.
  const glint = lit ? PAL.gold[3] : PAL.sky[2];
  const glint2 = lit ? PAL.gold[3] : PAL.sky[1];
  q.dot(x + 1, y + 1, glint).dot(x + 1.5, y + 1, glint).dot(x + 1, y + 1.5, glint).dot(x + 2, y + 1, glint2);
  q.dot(x + 1, mid + 1, glint2).dot(x + 1.5, mid + 1, glint2);
  if (h > 8 && !lit) {
    q.dot(x + w - 2, mid - 2, PAL.sky[0]);
    q.dot(x + w - 2.5, mid - 1.5, PAL.sky[0]);
  }
  // The frame's shadow side.
  q.vline(x + w - 1, y + 1, y + h - 1, PAL.snow[1]);
  q.fineCol(x + w - 0.5, y + 1, y + h - 1, PAL.stone[3]);
}

/**
 * paintHouse on the 2× grid; the same frame geometry (size, anchor) as the 1× house. `calm` = a
 * background row: quiet brick (see `brickHi`).
 */
export function paintHouseHi(h: HouseSpec, calm = false): Frame {
  const S = h.s ?? 20;
  const near = S >= 16;
  const w = h.w;
  const r = WALLS[h.wall];
  const brick = BRICK.has(h.wall);
  const gf = S + (near ? 8 : 4);
  const bodyH = gf + h.floors * S;
  const gableH = h.gable === 'flat' ? Math.max(4, Math.round(S * 0.35)) : h.gable === 'spout' ? Math.round(S * 1.1) : Math.round(S * 1.35);
  const W = w + 2;
  const H = bodyH + gableH + 3;
  const q = new Q(W, H);
  const b = q.b;
  const yT = H - bodyH;
  const cx = 1 + (w >> 1);
  const hs = (a: number, k: number): number => hash2(a, k, h.seed);
  const base2 = H * 2 - 1;

  const wallHi = (X: number, Y: number): Color => {
    if (brick) return brickHi(X, Y, base2, r, h.seed, !calm, calm);
    // Painted brick: a faint 1-px course line every 3 logical rows and a sparse grain.
    const row2 = base2 - Y;
    if (near && row2 % 6 === 0 && ((X >> 3) + (row2 >> 3)) % 3 !== 0) return r[1];
    return near && (X * 7 + Y * 3) % 23 === 0 ? r[1] : r[2];
  };
  /** Fill 2× columns X0..X1 of 2× row Y with wall. */
  const fillWall2 = (X0: number, X1: number, Y: number): void => {
    if (Y < 0 || Y >= b.h) return;
    const row = Y * b.w;
    for (let X = Math.max(2, X0); X <= Math.min(w * 2 + 1, X1); X++) b.data[row + X] = wallHi(X, Y) >>> 0;
  };
  const fillWall = (x0: number, x1: number, y: number): void => {
    for (const v of [0, 1]) fillWall2(x0 * 2, x1 * 2 + 1, y * 2 + v);
  };

  // Body.
  for (let y = yT; y < H; y++) fillWall(1, w, y);
  q.vline(1, yT, H - 1, r[3]);
  q.fineCol(1.5, yT, H - 1, r[2]);
  q.vline(w, yT, H - 1, r[0]);

  // Gable.
  const g0 = yT - gableH;
  const trim = PAL.snow[2];
  if (h.gable === 'step') {
    const k = w >= 40 ? 4 : 3;
    const sh = Math.max(3, Math.floor(gableH / (k + 1)));
    const stepW = Math.max(2, Math.floor(w / 2 / (k + 1.6)));
    for (let i = 0; i <= k; i++) {
      const half = (w >> 1) - i * stepW;
      const ya = yT - (i + 1) * sh;
      const yb = yT - i * sh - 1;
      for (let y = Math.max(g0, ya); y <= yb; y++) fillWall(cx - half, cx + half - 1, y);
      // Stone coping: a lit top, a shadow line under it and a lit left corner.
      const cy = Math.max(g0, ya);
      q.hline(cx - half, cx + half - 1, cy, trim);
      q.fineRow(cx - half, cx + half - 1, cy, PAL.snow[3]);
      q.fineRow(cx - half + 1, cx + half - 1, cy + 0.5, PAL.snow[2]);
      q.fineRow(cx - half, cx + half - 1, cy + 1, PAL.stone[2]);
      q.set(cx - half, cy, PAL.snow[3]);
    }
    const tip = yT - (k + 1) * sh;
    q.rect(cx - 1, tip - 2, 2, 2, PAL.snow[3]);
    q.dot(cx + 0.5, tip - 1.5, PAL.snow[2]).dot(cx + 0.5, tip - 1, PAL.snow[1]).dot(cx, tip - 1, PAL.snow[2]);
    q.fineRow(cx - 1, cx, tip - 2, PAL.snow[3]);
  } else if (h.gable === 'neck') {
    const nw = Math.max(6, Math.round(w * 0.46));
    const nx0 = cx - (nw >> 1);
    for (let y = g0 + 3; y < yT; y++) fillWall(nx0, nx0 + nw - 1, y);
    // Sandstone claws: scroll edges 2 logical px thick, traced per 2× row (a smooth curve).
    const ch = Math.round(gableH * 0.6);
    const top2 = (yT - ch) * 2;
    for (let Y = top2; Y < yT * 2; Y++) {
      const t = (yT * 2 - 1 - Y) / (ch * 2);
      const reach2 = Math.round((nx0 - 1) * 2 * (1 - t * t));
      const bottom = Y >= yT * 2 - 2 && near;
      for (let X = nx0 * 2 - reach2; X < nx0 * 2; X++) {
        const edge = X - (nx0 * 2 - reach2);
        if (edge < 4 || X >= nx0 * 2 - 2 || bottom) b.set(X, Y, edge < 1 ? PAL.sand[3] : edge < 2 && !bottom ? PAL.sand[3] : edge === 3 ? PAL.sand[1] : PAL.sand[2]);
      }
      const R0 = (nx0 + nw) * 2;
      for (let X = R0; X < R0 + reach2; X++) {
        const edge = R0 + reach2 - 1 - X;
        if (edge < 4 || X < R0 + 2 || bottom) b.set(X, Y, edge < 1 ? PAL.sand[1] : edge === 3 ? PAL.sand[3] : PAL.sand[2]);
      }
    }
    if (near) {
      // Volutes: rolled scrolls with a dark eye.
      q.circle(nx0 - 3, yT - 4, 1, PAL.sand[3]);
      q.dot(nx0 - 2.5, yT - 3.5, PAL.sand[1]).dot(nx0 - 3, yT - 3.5, PAL.sand[2]);
      q.circle(nx0 + nw + 2, yT - 4, 1, PAL.sand[2]);
      q.dot(nx0 + nw + 2.5, yT - 3.5, PAL.sand[1]);
    }
    // Pediment with a lit left slope and a cornice line.
    q.tri(nx0 - 1, g0 + 3, nx0 + nw, g0 + 3, cx, g0, PAL.snow[3]);
    q.fine(nx0 - 0.5, g0 + 2.5, cx - 0.5, g0 + 0.5, PAL.snow[3]);
    q.fine(cx + 1, g0 + 1, nx0 + nw, g0 + 3, PAL.snow[1]);
    q.hline(nx0 - 1, nx0 + nw, g0 + 3, PAL.snow[1]);
    q.fineRow(nx0 - 1, nx0 + nw, g0 + 3.5, PAL.stone[3]);
    if (near) q.dot(cx, g0 + 1.5, PAL.stone[3]).dot(cx + 0.5, g0 + 1.5, PAL.stone[3]);
  } else if (h.gable === 'bell') {
    // The bell outline traced per 2× row: a smooth shoulder and a round top.
    for (let Y = g0 * 2; Y < yT * 2; Y++) {
      const t = (yT * 2 - 1 - Y) / (gableH * 2 - 1);
      const f = t < 0.45 ? 0.55 + 0.45 * Math.cos((Math.PI * t) / 0.45 / 2) ** 0.8 : 0.55 * Math.sqrt(Math.max(0, 1 - ((t - 0.45) / 0.55) ** 2));
      const half2 = Math.max(2, Math.round(w * f));
      const L = cx * 2 - half2;
      const R = cx * 2 + half2 - 1;
      fillWall2(L, R, Y);
      b.set(L, Y, PAL.snow[3]);
      b.set(L + 1, Y, PAL.snow[3]);
      b.set(L + 2, Y, PAL.snow[2]);
      b.set(R, Y, PAL.snow[1]);
      b.set(R - 1, Y, PAL.snow[1]);
    }
    q.hline(cx - 2, cx + 1, g0, PAL.snow[3]);
    q.fineRow(cx - 2, cx + 1, g0 + 0.5, PAL.snow[2]);
    q.rect(cx - 1, g0 - 2, 2, 2, trim);
    q.fineRow(cx - 1, cx, g0 - 2, PAL.snow[3]);
    q.dot(cx + 0.5, g0 - 1, PAL.snow[1]);
  } else if (h.gable === 'spout') {
    for (let Y = g0 * 2; Y < yT * 2; Y++) {
      const t = (yT * 2 - 1 - Y) / (gableH * 2 - 1);
      const half2 = Math.max(2, Math.round(w * (1 - t) + 2));
      const L = cx * 2 - half2;
      const R = cx * 2 + half2 - 1;
      fillWall2(L, R, Y);
      b.set(L, Y, PAL.snow[3]);
      b.set(L + 1, Y, PAL.snow[3]);
      b.set(L + 2, Y, PAL.snow[2]);
      b.set(R, Y, PAL.snow[1]);
      b.set(R - 1, Y, PAL.snow[1]);
    }
  } else {
    // Flat cornice: the deep white cornice, a moulding, dentils, its shadow and a crest.
    const cy = yT - gableH;
    q.rect(1, cy, w, gableH, trim);
    q.hline(1, w, cy, PAL.snow[3]);
    q.fineRow(1, w, cy + 1, PAL.snow[3]);
    q.fineRow(1, w, cy + 1.5, PAL.snow[1]);
    if (near) {
      for (let x = 3; x < w - 1; x += 3) {
        q.dot(x, cy + gableH - 2, PAL.snow[1]).dot(x + 0.5, cy + gableH - 2, PAL.snow[1]).dot(x, cy + gableH - 1.5, PAL.snow[1]).dot(x + 0.5, cy + gableH - 1.5, PAL.stone[3]);
        q.dot(x - 0.5, cy + gableH - 2, PAL.snow[3]);
      }
    }
    q.hline(1, w, cy + gableH - 1, PAL.stone[2]);
    q.fineRow(1, w, cy + gableH - 0.5, PAL.stone[1]);
    q.rect(cx - 3, cy - 3, 6, 3, trim);
    q.hline(cx - 3, cx + 2, cy - 3, PAL.snow[3]);
    q.fineRow(cx - 3, cx + 2, cy - 2.5, PAL.snow[2]);
    q.fineCol(cx + 2.5, cy - 3, cy - 1, PAL.snow[1]);
    // An oval cartouche in the crest.
    q.dot(cx - 1, cy - 2, PAL.stone[3]).dot(cx - 0.5, cy - 2, PAL.stone[3]).dot(cx, cy - 2, PAL.stone[3]).dot(cx - 1.5, cy - 1.5, PAL.stone[3]).dot(cx + 0.5, cy - 1.5, PAL.stone[3]);
  }

  // The loading door and the hoist beam.
  if (h.gable !== 'flat') {
    const dw = near ? 6 : 3;
    const dh = Math.max(3, Math.round(gableH * 0.38));
    const dy = yT - dh - 1;
    q.rect(cx - (dw >> 1) - 1, dy - 1, dw + 2, dh + 1, PAL.snow[3]);
    q.fineCol(cx + (dw - (dw >> 1)) + 0.5, dy - 1, dy + dh - 1, PAL.snow[1]);
    const doorC = h.wall === 'green' ? PAL.navy[1] : PAL.green[1];
    const doorD = h.wall === 'green' ? PAL.navy[0] : PAL.green[0];
    q.rect(cx - (dw >> 1), dy, dw, dh, doorC);
    if (near) {
      // Two leaves with sunken panels and a lit edge.
      q.vline(cx, dy, dy + dh - 1, doorD);
      q.fineCol(cx - (dw >> 1), dy, dy + dh - 1, h.wall === 'green' ? PAL.sky[0] : PAL.green[2]);
      for (const px of [cx - (dw >> 1) + 1, cx + 1]) {
        q.fine(px, dy + 1, px + 1.5, dy + 1, doorD);
        q.fine(px, dy + dh - 2, px + 1.5, dy + dh - 2, doorD);
      }
    }
    const by = Math.max(g0 + 1, dy - (near ? 6 : 3));
    q.rect(cx - 1, by, 3, 2, PAL.brown[1]);
    q.set(cx - 1, by, PAL.brown[2]);
    q.fineRow(cx - 1, cx + 1, by, PAL.brown[3]);
    q.fineRow(cx - 1, cx + 1, by + 1.5, PAL.brown[0]);
    // Hoist hook on a fine chain.
    q.fineCol(cx + 1, by + 2, by + (near ? 4 : 3), PAL.steel[3]);
    q.fineCol(cx + 1.5, by + 2, by + (near ? 4 : 3), PAL.steel[1]);
    if (near) {
      q.dot(cx + 0.5, by + 5, PAL.steel[3]).dot(cx + 1, by + 5.5, PAL.steel[3]).dot(cx + 0.5, by + 5.5, PAL.steel[2]);
    }
  } else {
    q.rect(cx - 1, yT + 1, 3, 2, PAL.brown[1]);
    q.fineRow(cx - 1, cx + 1, yT + 1, PAL.brown[3]);
    q.fineCol(cx + 1, yT + 3, yT + 5, PAL.steel[3]);
    q.fineCol(cx + 1.5, yT + 3, yT + 5, PAL.steel[1]);
  }

  // Upper floors.
  const n = w >= 44 ? 3 : w >= 24 ? 2 : 1;
  const cw = w / n;
  for (let f = 0; f < h.floors; f++) {
    const top = H - gf - (f + 1) * S;
    const ww = near ? Math.min(10, Math.max(6, Math.round(cw * 0.5))) : Math.max(3, Math.round(cw * 0.42));
    const wh = Math.max(4, Math.round(S * (0.68 - f * 0.05)));
    const wy = top + Math.max(2, ((S - wh) >> 1) - 1);
    for (let i = 0; i < n; i++) {
      const wx = 1 + Math.round(cw * i + (cw - ww) / 2);
      const lit = hs(f * 7 + i, 3) > 0.94;
      sashWindowHi(q, wx, wy, ww, wh, near, lit);
      if (brick) {
        // A stone lintel with a keystone.
        q.hline(wx - 1, wx + ww, wy - 1, near ? PAL.snow[2] : PAL.snow[1]);
        if (near) {
          q.fineRow(wx - 1, wx + ww, wy - 1, PAL.snow[3]);
          q.dot(wx + (ww >> 1) - 0.5, wy - 1.5, PAL.snow[3]).dot(wx + (ww >> 1), wy - 1.5, PAL.snow[2]);
        }
      }
      // The sill, lit on top.
      q.hline(wx - 1, wx + ww, wy + wh, PAL.stone[3]);
      q.fineRow(wx - 1, wx + ww, wy + wh + 0.5, PAL.stone[2]);
      if (h.flowers && f === 0 && near) {
        q.rect(wx - 1, wy + wh + 1, ww + 2, 2, PAL.green[1]);
        q.hline(wx - 1, wx + ww, wy + wh + 2, PAL.green[0]);
        q.fineRow(wx - 1, wx + ww, wy + wh + 1, PAL.green[2]);
        // Single tulips on stems with leaves, in the box.
        for (let x = wx; x < wx + ww; x += 2) {
          const c = TULIPS[(x + i + h.seed) % TULIPS.length];
          q.dot(x + 0.5, wy + wh - 0.5, PAL.green[3]).dot(x, wy + wh + 0.5, PAL.green[3]).dot(x + 1, wy + wh + 0.5, PAL.green[2]);
          q.dot(x, wy + wh - 1, c).dot(x + 0.5, wy + wh - 1, c).dot(x, wy + wh - 1.5, c).dot(x + 0.5, wy + wh - 1.5, c === PAL.red[2] ? PAL.red[3] : c);
          q.dot(x + 1, wy + wh, PAL.green[2]).dot(x + 1.5, wy + wh + 0.5, PAL.green[3]);
        }
      }
    }
    if (near && brick && f === 0) {
      q.hline(1, w, top + S - 1, PAL.snow[1]);
      q.fineRow(1, w, top + S - 1, PAL.snow[2]);
    }
  }

  // Ground floor.
  const gy = H - gf;
  q.hline(1, w, gy, PAL.snow[2]);
  q.fineRow(1, w, gy, PAL.snow[3]);
  q.hline(1, w, gy + 1, PAL.stone[1]);
  if (h.shop) {
    const ramp = h.shopRamp ?? PAL.green;
    const fh = near ? 8 : 4;
    q.rect(1, gy + 2, w, fh, ramp[1]);
    q.hline(1, w, gy + 2, ramp[2]);
    q.fineRow(1, w, gy + 2, ramp[3]);
    q.fineRow(1, w, gy + 1 + fh + 0.5, ramp[0]);
    if (near) textHi(q, h.shop, cx, gy + 3 - 2, { color: PAL.gold[3], align: 'center' });
    const doorW = near ? 9 : 4;
    const wy = gy + 2 + fh + 1;
    const wx1 = w - doorW - 3;
    q.rect(2, wy, wx1 - 2, H - 3 - wy, PAL.snow[3]);
    q.rect(3, wy + 1, wx1 - 4, H - 5 - wy, PAL.navy[1]);
    if (near) {
      for (let x = 4; x < wx1 - 2; x += 5) q.fine(x, wy + 1, x + 4.5, wy + 6.5, PAL.sky[0]);
      // Goods in the window: cheese wheels, bunches, cups, books (a row of small shapes).
      for (let x = 4; x < wx1 - 2; x += 3) {
        const c = TULIPS[(x + h.seed) % TULIPS.length];
        q.rect(x, H - 9, 2, 3, c);
        q.fineRow(x, x + 1, H - 9, PAL.snow[3]);
        q.fineCol(x + 1.5, H - 9, H - 7, PAL.ink[1]);
      }
      // A shelf line and a 1-px mullion at the window's middle.
      q.fineRow(3, wx1 - 2, H - 6, PAL.snow[1]);
      q.fineCol(2 + ((wx1 - 2) >> 1), wy + 1, H - 10, PAL.snow[2]);
      q.dot(3, wy + 1, PAL.sky[2]).dot(3.5, wy + 1, PAL.sky[1]).dot(3, wy + 1.5, PAL.sky[1]);
    }
    q.rect(wx1 + 1, wy, doorW, H - 1 - wy, PAL.snow[3]);
    q.rect(wx1 + 2, wy + 1, doorW - 2, H - 2 - wy, ramp[0]);
    if (near) {
      q.rect(wx1 + 3, wy + 2, doorW - 4, 8, PAL.navy[1]);
      q.dot(wx1 + 3, wy + 2, PAL.sky[2]).dot(wx1 + 3.5, wy + 2, PAL.sky[1]);
      q.fineRow(wx1 + 3, wx1 + doorW - 2, wy + 6, ramp[0]);
      q.dot(wx1 + doorW - 2.5, wy + 12, PAL.gold[3]);
    }
    q.rect(1, H - 3, w, 3, PAL.stone[2]);
    q.hline(1, w, H - 3, PAL.stone[3]);
    q.fineRow(1, w, H - 2, PAL.stone[1]);
  } else {
    const left = hs(1, 9) < 0.5;
    const dw = near ? 9 : 4;
    const dx = left ? 3 : w - dw - 2;
    const dTop = gy + (near ? 6 : 3);
    q.rect(dx - 1, dTop - (near ? 5 : 2), dw + 2, H - 3 - dTop + (near ? 5 : 2), PAL.snow[3]);
    q.fineCol(dx + dw + 0.5, dTop - (near ? 5 : 2), H - 4, PAL.snow[1]);
    if (near) {
      // Fanlight: a navy transom with 1-px radiating bars.
      q.rect(dx, dTop - 4, dw, 3, PAL.navy[1]);
      const fc = dx + dw / 2;
      for (let k = 0; k < 5; k++) q.fine(fc, dTop - 1.5, dx + 0.5 + k * ((dw - 1) / 4), dTop - 4, PAL.snow[2]);
      q.dot(dx, dTop - 4, PAL.sky[2]).dot(dx + 0.5, dTop - 4, PAL.sky[1]);
    }
    const doorC = [PAL.green[1], PAL.navy[1], PAL.red[1], PAL.ink[1]][Math.floor(hs(2, 9) * 4)];
    const doorL = doorC === PAL.green[1] ? PAL.green[2] : doorC === PAL.navy[1] ? PAL.sky[0] : doorC === PAL.red[1] ? PAL.red[2] : PAL.steel[0];
    q.rect(dx, dTop, dw, H - 3 - dTop, doorC);
    if (near) {
      q.vline(dx + (dw >> 1), dTop, H - 4, PAL.ink[1]);
      // Raised panels on both leaves: a lit top-left edge, a dark lower-right edge.
      for (const px of [dx + 1, dx + (dw >> 1) + 1]) {
        const pw = (dw >> 1) - 2;
        for (const [py, ph] of [[dTop + 1, 5], [dTop + 8, H - 6 - dTop - 8]] as const) {
          if (ph < 2) continue;
          q.fineRow(px, px + pw - 1, py, doorL);
          q.fineCol(px, py, py + ph - 1, doorL);
          q.fineRow(px, px + pw - 1, py + ph - 0.5, PAL.ink[1]);
          q.fineCol(px + pw - 0.5, py, py + ph - 1, PAL.ink[1]);
        }
      }
      q.set(dx + dw - 2, dTop + 8, PAL.gold[3]);
      q.dot(dx + dw - 1.5, dTop + 8.5, PAL.gold[1]);
    }
    q.rect(dx - 2, H - 3, dw + 4, 3, PAL.stone[2]);
    q.hline(dx - 2, dx + dw + 1, H - 3, PAL.stone[3]);
    q.fineRow(dx - 2, dx + dw + 1, H - 2, PAL.stone[3]);
    q.fineRow(dx - 2, dx + dw + 1, H - 1.5, PAL.stone[1]);
    const ww = Math.max(4, w - dw - (near ? 12 : 8));
    const wx = left ? dx + dw + (near ? 4 : 3) : 3;
    sashWindowHi(q, wx, gy + 4, Math.min(ww, near ? 22 : 10), gf - (near ? 10 : 6), near, false);
    if (near && hs(4, 9) < 0.25) {
      // The cat in the window: ears, a round head, a tail over the sill, green eyes.
      const kx = wx + 3;
      const ky = gy + 4 + gf - 14;
      q.rect(kx, ky, 4, 3, PAL.ink[1]);
      q.dot(kx, ky - 1, PAL.ink[1]).dot(kx, ky - 0.5, PAL.ink[1]).dot(kx + 0.5, ky - 0.5, PAL.ink[1]);
      q.dot(kx + 3.5, ky - 1, PAL.ink[1]).dot(kx + 3.5, ky - 0.5, PAL.ink[1]).dot(kx + 3, ky - 0.5, PAL.ink[1]);
      q.dot(kx + 1, ky + 1, PAL.gold[2]).dot(kx + 2.5, ky + 1, PAL.gold[2]);
      q.dot(kx + 4, ky + 2, PAL.ink[1]).dot(kx + 4.5, ky + 2.5, PAL.ink[1]);
    }
  }

  b.touch();
  // Shear for the lean (whole storeys shift by whole logical px), then the outline.
  const lean = Math.round(h.lean);
  const L = Math.abs(lean);
  const OW = (W + L + 2) * 2;
  const out = new PixelBuffer(OW, (H + 1) * 2);
  const levels = h.floors + 2;
  for (let y = 0; y < H; y++) {
    const level = y >= H - gf ? 0 : Math.min(levels - 1, 1 + Math.floor((H - gf - 1 - y) / S));
    const s = (Math.round((lean * level) / (levels - 1)) + (lean < 0 ? L : 0) + 1) * 2;
    for (const v of [0, 1]) {
      const Y = y * 2 + v;
      for (let X = 0; X < W * 2; X++) {
        const c = b.data[Y * W * 2 + X];
        if ((c & 255) !== 0) out.data[(Y + 2) * OW + X + s] = c;
      }
    }
  }
  outlineHi(out, 2, INK);
  return { buf: out, ox: cx + (lean < 0 ? L : 0) + 1, oy: H + 1, density: 2 };
}
