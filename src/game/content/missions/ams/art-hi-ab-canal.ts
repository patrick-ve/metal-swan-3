/**
 * Mission `ams` 2× canal and Museumplein decor (docs/ART_GUIDE.md "2x art (mission ams)"): the
 * twins of the art.ts bridges (`bridge-rail-<len>x<h>`, `bridge-face-<len>x<h>`, `drawbridge`),
 * houseboats (`houseboat-…`), canal water (`water-<w>x<h>`, `…-back`, `…-tint`), the Rijksmuseum
 * and the Museumplein lawn and pool (`rijksmuseum`, `lawn-<w>`, `pool-<w>`). The 1× recipes on the
 * 2× grid with its finer detail: brick with 1-px joints and voussoirs, railing bars and chains,
 * portholes with a glint, ripples and sparkles on single 2× pixels, slate courses, window tracery
 * and clock hands, blades of grass. Palette only, light from the top-left.
 */
import type { Color } from '../../../../engine/color';
import { PAL } from '../../../../engine/palette';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { hash2 } from '../../../art/paint';
import { BIKE_COLOURS, BOAT_COLOURS, hillY, TULIPS } from './art';
import { Q } from './art-hi-ab-kit';
import { brickHi } from './art-hi-ab-houses';
import { drawBikeHi, postHi } from './art-hi-ab-street';

// =============================================================================================
// Bridges
// =============================================================================================

export function bridgeRailHi(len: number, h: number): Frame {
  const top = 30;
  const q = new Q(len + 2, top + 2);
  const deck = (x: number): number => top + Math.round(hillY(x, len, h));
  for (const x of [2, len - 6]) {
    q.rect(x, deck(x) - 18, 6, 18, PAL.stone[2]);
    q.vline(x, deck(x) - 18, deck(x) - 1, PAL.stone[3]);
    q.fineCol(x + 5.5, deck(x) - 17, deck(x) - 1, PAL.stone[1]);
    for (let y = deck(x) - 14; y < deck(x); y += 4) q.fineRow(x + 1, x + 5, y, PAL.stone[1]);
    q.rect(x - 1, deck(x) - 20, 8, 3, PAL.stone[3]);
    q.fineRow(x - 1, x + 6, deck(x) - 20, PAL.snow[2]);
    q.fineRow(x - 1, x + 6, deck(x) - 17.5, PAL.stone[1]);
  }
  for (let x = 8; x < len - 6; x++) {
    const d = deck(x);
    q.set(x, d - 14, PAL.ink[1]);
    q.set(x, d - 13, PAL.green[0]);
    q.dot(x, d - 13, PAL.green[1]).dot(x + 0.5, d - 13, PAL.green[1]);
    q.set(x, d - 6, PAL.ink[1]);
    if (x % 4 === 0) {
      q.vline(x, d - 13, d - 1, PAL.ink[1]);
      q.dot(x, d - 12, PAL.green[0]);
    }
    if (x % 16 === 8) {
      q.circle(x + 2, d - 9, 2, PAL.ink[1], false);
      q.dot(x + 2, d - 9, PAL.green[0]).dot(x + 2.5, d - 9.5, PAL.green[0]);
    }
  }
  for (let x = 14, i = 0; x < len - 30; x += 22 + (i % 3) * 6, i++) {
    drawBikeHi(q, x, deck(x + 10), BIKE_COLOURS[(i * 5 + 1) % BIKE_COLOURS.length], i % 2 === 0);
    // A chain lock from the frame to the railing.
    q.fine(x + 10, deck(x + 10) - 7, x + 11.5, deck(x + 10) - 9, PAL.steel[3]);
  }
  q.outline();
  return q.frame(1, top + 1);
}

export function bridgeFaceHi(len: number, h: number): Frame {
  const top = h + 2;
  const H = top + 40;
  const q = new Q(len, H);
  const cx = len / 2;
  const ar = len * 0.3;
  const archDepth = H - top - 12;
  q.each(0, 0, len - 1, H - 1, (X, Y, x, y) => {
    const d = top + Math.round(hillY(x, len, h)) + 2;
    if (y < d) return;
    const row = y - d;
    // Bricks 8 × 4 logical px (as at 1×) with 1-px joints, each brick one tone, a few lit on top.
    const course = Y >> 3;
    const col = X + (course & 1) * 8;
    const joint = (Y & 7) === 7 || (col & 15) === 0;
    const hb = hash2(col >> 4, course, 6);
    let c: Color = joint ? PAL.rust[0] : hb > 0.7 ? PAL.rust[2] : PAL.rust[1];
    if (!joint && (Y & 7) === 0 && hb > 0.45) c = hb > 0.7 ? PAL.rust[3] : PAL.rust[2];
    if (row === 0) c = Y & 1 ? PAL.stone[3] : PAL.snow[1];
    else if (row === 1) c = Y & 1 ? PAL.stone[1] : PAL.stone[2];
    // The arch on the 2× grid: dark water under it, a ring of voussoirs around it.
    const dx = ((X + 0.5) / 2 - cx) / ar;
    if (Math.abs(dx) < 1) {
      const archTop = H - 2 - Math.sqrt(Math.max(0, 1 - dx * dx)) * archDepth;
      const yy = (Y + 0.5) / 2;
      if (yy >= archTop) {
        c = yy >= H - 8 ? ((((X >> 1) + (Y >> 1)) & 3) === 0 ? PAL.teal[1] : PAL.teal[0]) : PAL.ink[1];
        if (yy >= H - 8 && Y % 6 === 0 && hash2(X >> 2, Y, 7) > 0.6) c = PAL.teal[2];
        if (yy < archTop + 2) c = PAL.snow[2];
        if (yy < archTop + 0.5) c = PAL.snow[3];
        if (yy >= archTop + 1.5 && yy < archTop + 2) c = PAL.stone[3];
      } else if (yy >= archTop - 3 && row > 1) {
        // Voussoirs: radial joints in the brick ring over the arch.
        const ang = Math.atan2(yy - (H - 2), ((X + 0.5) / 2 - cx) * (archDepth / ar));
        c = Math.round(ang * 14) % 2 === 0 ? PAL.rust[2] : PAL.rust[1];
        if (Math.abs(ang * 14 - Math.round(ang * 14)) < 0.08) c = PAL.rust[0];
      }
    }
    q.b.set(X, Y, c);
  });
  return q.frame(0, top);
}

export function drawbridgeHi(): Frame {
  const W = 70;
  const H = 150;
  const q = new Q(W, H);
  const white = [PAL.steel[3], PAL.snow[1], PAL.snow[2], PAL.snow[3]];
  postHi(q, 8, 30, H - 1, 4, white);
  postHi(q, 40, 30, H - 1, 4, white);
  for (const x of [8, 40]) for (let y = 36; y < H - 4; y += 12) q.dot(x + 2, y, PAL.steel[3]).dot(x + 2, y + 0.5, PAL.steel[2]);
  q.rect(4, 26, 44, 5, PAL.snow[2]);
  q.hline(4, 47, 26, PAL.snow[3]);
  q.fineRow(4, 47, 30.5, PAL.steel[3]);
  for (let x = 6; x < 47; x += 4) q.dot(x, 28.5, PAL.steel[3]);
  q.line(10, 30, 42, 50, PAL.snow[2]);
  q.line(42, 30, 10, 50, PAL.snow[2]);
  q.fine(10, 30.5, 42, 50.5, PAL.steel[3]);
  q.thickLine(12, 22, 64, 6, 3, PAL.snow[2]);
  q.line(12, 21, 64, 5, PAL.snow[3]);
  q.fine(12, 23.5, 64, 7.5, PAL.snow[1]);
  q.rect(52, 10, 14, H - 18, PAL.snow[1]);
  q.vline(52, 10, H - 9, PAL.snow[3]);
  for (let y = 16; y < H - 10; y += 8) {
    q.hline(53, 65, y, PAL.steel[3]);
    q.fineRow(53, 65, y + 0.5, PAL.snow[2]);
  }
  // Deck planks seen end-on: 1-px seams.
  for (let x = 55; x < 65; x += 3) q.fineCol(x, 11, H - 10, PAL.snow[2]);
  q.line(64, 6, 64, 10, PAL.ink[1]);
  // The chain: links on the 2× grid.
  for (let k = 0; k <= 12; k++) {
    const x = 46 + k;
    const y = 30 - (k * 16) / 12;
    q.dot(x, y, PAL.ink[1]).dot(x + 0.5, y - 0.5, PAL.ink[1]);
    if (k % 2 === 0) q.dot(x + 0.5, y, PAL.steel[1]);
  }
  for (let y = 12; y < H - 10; y++) q.set(66, y, ((y >> 2) & 1) === 0 ? PAL.red[2] : PAL.snow[3]);
  q.fineCol(66.5, 12, H - 11, PAL.stone[3]);
  q.rect(1, H - 3, W - 2, 3, PAL.stone[2]);
  q.fineRow(1, W - 2, H - 3, PAL.stone[3]);
  q.fineRow(1, W - 2, H - 1.5, PAL.stone[1]);
  return q.outline().feet();
}

// =============================================================================================
// Houseboats
// =============================================================================================

export function houseboatHi(w: number, deck: number, cx: number, cw: number, colour: number): Frame {
  const r = BOAT_COLOURS[colour % BOAT_COLOURS.length];
  const H = deck + 26;
  const q = new Q(w + 2, H + 1);
  const roof = 1;
  const hullTop = roof + deck;
  q.rect(1, hullTop, w, H - hullTop, r[0]);
  q.rect(1, hullTop + 12, w, H - hullTop - 12, PAL.ink[1]);
  q.rect(1, hullTop, w, 3, r[1]);
  q.hline(1, w, hullTop, r[2]);
  q.fineRow(1, w, hullTop, r[3]);
  q.fineRow(1, w, hullTop + 2.5, r[0]);
  q.hline(1, w, hullTop + 11, PAL.red[1]);
  q.fineRow(1, w, hullTop + 11, PAL.red[2]);
  // Hull plates: 1-px seams and rivets.
  for (let x = 10; x < w - 4; x += 18) q.fineCol(x, hullTop + 3, hullTop + 10, PAL.ink[1]);
  for (let x = 6; x < w - 4; x += 9) {
    q.circle(x, hullTop + 7, 1, PAL.steel[2]);
    q.dot(x - 0.5, hullTop + 6.5, PAL.steel[3]).dot(x + 0.5, hullTop + 7.5, PAL.ink[1]);
  }
  // Ripples on the dark hull below the waterline.
  for (let x = 3; x < w - 4; x += 7) q.fineRow(x, x + 2, hullTop + 14 + (x % 3), PAL.navy[0]);
  for (let y = hullTop + 3; y < H; y++) {
    q.set(w, y, 0);
    if (y > hullTop + 6) q.set(w - 1, y, 0);
  }
  // A rounded bow on the 2× grid.
  for (let y = hullTop + 3; y < H; y++) if (y > hullTop + 4) q.dot(w - 1.5, y, 0);
  q.dot(w - 0.5, hullTop + 2.5, 0);
  if (cw > 0) {
    const x0 = 1 + cx;
    q.rect(x0, roof + 2, cw, deck - 2, r[2]);
    // Clapboard: 1-px lines along the cabin.
    for (let y = roof + 4; y < hullTop - 1; y += 2) q.fineRow(x0 + 1, x0 + cw - 2, y + 0.5, r[1]);
    q.vline(x0, roof + 2, hullTop - 1, r[3]);
    q.vline(x0 + cw - 1, roof + 2, hullTop - 1, r[0]);
    q.rect(x0 - 2, roof, cw + 4, 3, PAL.brown[2]);
    q.hline(x0 - 2, x0 + cw + 1, roof, PAL.brown[3]);
    q.fineRow(x0 - 2, x0 + cw + 1, roof + 2.5, PAL.brown[0]);
    for (let x = x0 + 4; x < x0 + cw - 8; x += 12) {
      q.rect(x, roof + 5, 8, Math.max(4, deck - 10), PAL.snow[3]);
      q.rect(x + 1, roof + 6, 6, Math.max(2, deck - 12), PAL.navy[1]);
      q.set(x + 1, roof + 6, PAL.sky[2]);
      q.vline(x + 1, roof + 6, roof + 7, PAL.gold[3]);
      // Curtains: a gold one, a fine tie-back; the glazing bar.
      q.fineCol(x + 1.5, roof + 6, roof + 6 + Math.max(2, deck - 12) - 1, PAL.gold[2]);
      q.fineCol(x + 4, roof + 6, roof + 6 + Math.max(2, deck - 12) - 1, PAL.snow[2]);
      q.dot(x + 6, roof + 6, PAL.sky[1]);
    }
    q.rect(x0 + 2, roof - 1, 3, 1, PAL.green[2]);
    q.dot(x0 + 2, roof - 1, PAL.green[3]).dot(x0 + 4.5, roof - 0.5, PAL.green[1]);
    q.set(x0 + 3, roof - 2, PAL.red[2]);
    q.dot(x0 + 3, roof - 2, PAL.red[3]);
    q.rect(x0 + cw - 8, roof - 6, 2, 6, PAL.steel[1]);
    q.fineCol(x0 + cw - 8, roof - 6, roof - 1, PAL.steel[2]);
    q.hline(x0 + cw - 9, x0 + cw - 6, roof - 6, PAL.steel[2]);
    q.fineRow(x0 + cw - 9, x0 + cw - 6, roof - 6, PAL.steel[3]);
  }
  for (let x = 3; x < w - 2; x += 10) q.vline(x, hullTop - 4, hullTop - 1, PAL.snow[2]);
  for (let x = 2; x < w - 1; x++) if (x < 1 + cx - 2 || x > cx + cw + 2) q.set(x, hullTop - 4, PAL.snow[2]);
  if (cx > 24) drawBikeHi(q, 3, hullTop, BIKE_COLOURS[colour % BIKE_COLOURS.length]);
  if (w - cx - cw > 12) {
    const px = cx + cw + 6;
    q.rect(px, hullTop - 3, 4, 3, PAL.rust[2]);
    q.fineRow(px, px + 3, hullTop - 3, PAL.rust[3]);
    q.rect(px, hullTop - 6, 4, 3, PAL.green[3]);
    q.dot(px + 0.5, hullTop - 5.5, PAL.green[4]).dot(px + 2.5, hullTop - 4.5, PAL.green[2]);
    q.set(px + 1, hullTop - 7, TULIPS[colour % TULIPS.length]);
    q.dot(px + 2.5, hullTop - 6.5, TULIPS[(colour + 2) % TULIPS.length]);
  }
  q.outline();
  return q.frame(1, roof);
}

// =============================================================================================
// Canal water
// =============================================================================================

const DEPTH: readonly Color[] = [PAL.teal[1], PAL.teal[0], PAL.navy[1], PAL.navy[0]];

export function waterBackHi(w: number, h: number): PixelBuffer {
  const q = new Q(w, h);
  for (let y = 0; y < h; y++) q.rect(0, y, w, 1, DEPTH[Math.min(DEPTH.length - 1, Math.floor(y / 9))]);
  // Ripples: short 1-px dashes, finer than the 1× logical dashes.
  for (let y = 4; y < h; y += 5) {
    for (let x = 0; x < w; x++) {
      if (((x + y * 7) & 31) < 4) q.fineRow(x, x, y + 0.5, PAL.teal[2]);
      if (((x + y * 7) & 31) === 1) q.dot(x, y, PAL.teal[2]);
    }
  }
  // Reflected house colours in streaks near the top, broken by the ripples.
  for (let x = 0; x < w; x++) {
    if (((x * 5) & 31) < 3) {
      for (let Y = 6; Y <= Math.min(h - 1, 9) * 2 + 1; Y++) {
        if (Y % 5 === 4) continue;
        q.b.set(x * 2, Y, PAL.rust[0]);
        q.b.set(x * 2 + 1, Y, Y % 3 === 0 ? PAL.rust[1] : PAL.rust[0]);
      }
    }
  }
  return q.b;
}

export function waterTintHi(w: number, h: number): PixelBuffer {
  const q = new Q(w, Math.max(1, h - 2));
  for (let y = 0; y < q.h; y++) q.rect(0, y, w, 1, y < 6 ? PAL.teal[1] : PAL.teal[0]);
  // A soft step between the two depths and a few long, faint swell lines in the deep part.
  for (let x = 0; x < w; x++) if (((x * 3) & 15) < 7) q.dot(x, 5.5, PAL.teal[0]).dot(x + 0.5, 5.5, PAL.teal[0]);
  for (let y = 10; y < q.h; y += 7) for (let x = 0; x < w; x++) if (((x + y * 5) & 31) < 9) q.fineRow(x, x, y + 0.5, PAL.teal[1]);
  return q.b;
}

export function waterSurfaceHi(w: number): PixelBuffer[] {
  return [0, 1, 2, 3].map((f) => {
    const q = new Q(w, 3);
    for (let x = 0; x < w; x++) {
      const k = (x + f * 3) & 15;
      // Crest: a white crest line on top, the lit face under it.
      q.set(x, 0, k < 4 ? PAL.snow[3] : PAL.teal[2]);
      if (k < 4) q.dot(x, 0.5, k === 0 || k === 3 ? PAL.teal[3] : PAL.snow[2]);
      if (k >= 4 && k < 6) q.dot(x, 0, PAL.teal[3]);
      q.set(x, 1, k >= 8 && k < 11 ? PAL.sky[3] : PAL.teal[1]);
      if (k === 11) q.dot(x, 1, PAL.sky[3]);
      if (((x * 7 + f * 5) & 31) === 3) q.set(x, 2, PAL.teal[2]);
      if (((x * 7 + f * 5) & 31) === 4) q.dot(x, 2.5, PAL.teal[2]);
    }
    return q.b;
  });
}

// =============================================================================================
// Section b: the Rijksmuseum and Museumplein
// =============================================================================================

/** The Rijksmuseum (480 wide; the passage 80…400 px; the ceiling 80 px up). */
export function rijksmuseumHi(): Frame {
  const W = 480;
  const H = 176;
  const q = new Q(W + 2, H);
  const b = q.b;
  const base = H - 1;
  const ceil = base - 80;
  const rust = [PAL.rust[0], PAL.rust[0], PAL.rust[1], PAL.orange[0]];
  const brick = (X: number, Y: number): Color => brickHi(X, Y, H * 2 - 1, rust, 31);
  const roofY = 58;
  q.each(1, roofY, W, base, (X, Y) => b.set(X, Y, brick(X, Y)));
  // Slate roof: fine courses of staggered slates.
  q.each(1, 44, W, roofY - 1, (X, Y, x, y) => {
    const inset = Math.round((roofY - y) * 0.6);
    if (x < 1 + inset || x > W - inset) return;
    const course = Y >> 2;
    const seam = (Y & 3) === 3 || ((X + (course & 1) * 4) & 7) === 0;
    b.set(X, Y, seam ? PAL.steel[0] : (Y & 3) === 0 ? PAL.steel[2] : PAL.steel[1]);
  });
  for (let x = 20; x < W - 20; x += 40) {
    q.each(x, 48, x + 7, 57, (X, Y) => b.set(X, Y, brick(X, Y)));
    q.tri(x - 1, 48, x + 8, 48, x + 4, 43, PAL.sand[3]);
    q.fine(x + 4.5, 43.5, x + 8, 47.5, PAL.sand[1]);
    q.rect(x + 2, 50, 4, 6, PAL.navy[1]);
    q.fineCol(x + 4, 50, 55, PAL.sand[2]);
    q.dot(x + 2, 50, PAL.sky[2]);
  }
  for (const y of [roofY, roofY + 1, ceil - 2, ceil - 1]) q.hline(1, W, y, y === roofY ? PAL.sand[3] : PAL.sand[2]);
  q.fineRow(1, W, roofY, PAL.snow[2]);
  q.fineRow(1, W, ceil - 0.5, PAL.sand[1]);
  // Tall arched windows with cream frames, tracery and a transom.
  for (let x = 12; x < W - 12; x += 20) {
    const wy = roofY + 6;
    q.rect(x - 1, wy - 1, 10, 24, PAL.sand[3]);
    q.ellipse(x - 1, wy - 2, 10, 8, PAL.sand[3]);
    q.rect(x, wy + 2, 8, 20, PAL.navy[1]);
    q.ellipse(x, wy, 8, 6, PAL.navy[1]);
    q.fineCol(x + 4, wy + 1, wy + 19, PAL.sand[2]);
    q.fineRow(x, x + 7, wy + 10, PAL.sand[2]);
    q.fineRow(x, x + 7, wy + 3, PAL.sand[2]);
    q.dot(x + 1, wy + 4, PAL.sky[2]).dot(x + 1.5, wy + 4, PAL.sky[1]).dot(x + 1, wy + 4.5, PAL.sky[1]);
    q.fineRow(x - 1, x + 8, wy + 22.5, PAL.sand[1]);
  }
  // The passage.
  const p0 = 81;
  const p1 = 400;
  q.each(p0, ceil, p1, base, (X, Y, x, y) => {
    const yy = (Y + 0.5) / 2;
    const depth = y - ceil;
    let c: Color = depth < 6 ? PAL.ink[0] : depth < 14 ? PAL.ink[1] : PAL.brown[0];
    const k = (x - p0) % 40;
    const kk = ((X + 0.5) / 2 - p0) % 40;
    const archTop = ceil + 18 + ((kk - 20) * (kk - 20)) / 40;
    if (k > 4 && k < 36 && yy > archTop + 0.5) c = y > base - 30 ? PAL.rust[0] : PAL.ink[1];
    if (k > 4 && k < 36 && yy > archTop && yy <= archTop + 1.25) c = PAL.sand[1];
    if (y > base - 24 && (k <= 4 || k >= 36)) c = ((X >> 1) + (Y >> 1)) % 4 === 0 ? PAL.sand[1] : (X + Y) % 8 === 0 ? PAL.sand[3] : PAL.sand[2];
    if (y > base - 24 && (k <= 4 || k >= 36) && (Y % 6 === 0 || X % 6 === 0)) c = PAL.sand[1];
    if (y === base - 18) c = (Y & 1) === 0 ? PAL.sky[0] : PAL.sky[1];
    if (k === 20 && y > ceil + 6 && y < ceil + 12) c = PAL.ink[1];
    b.set(X, Y, c);
  });
  for (let x = p0 + 20; x < p1; x += 40) {
    q.circle(x, ceil + 13, 2, PAL.gold[3]);
    q.set(x, ceil + 13, PAL.snow[3]);
    q.dot(x - 1, ceil + 12, PAL.snow[3]);
    q.fineRow(x - 2, x + 2, ceil + 15.5, PAL.gold[1]);
  }
  for (let x = p0; x <= p1; x += 20) {
    q.vline(x, ceil, ceil + 4, PAL.sand[0]);
    q.fineCol(x, ceil, ceil + 4, PAL.sand[1]);
  }
  // Towers.
  for (const tx of [p0 - 20, p1 - 18]) {
    const tw = 38;
    const t0 = 24;
    q.each(tx, t0, tx + tw - 1, base, (X, Y, x, y) => {
      if (y > ceil && x > p0 && x < p1) return;
      b.set(X, Y, brick(X, Y));
    });
    q.vline(tx, t0, ceil, PAL.orange[0]);
    q.vline(tx + tw - 1, t0, ceil, PAL.rust[0]);
    for (const y of [t0, t0 + 1, t0 + 16, ceil - 2]) q.hline(tx, tx + tw - 1, y, PAL.sand[3]);
    q.fineRow(tx, tx + tw - 1, t0 + 16.5, PAL.sand[1]);
    for (const px of [tx - 1, tx + tw - 3]) {
      q.rect(px, t0 - 8, 4, 8, PAL.sand[3]);
      q.fineCol(px + 3.5, t0 - 8, t0 - 1, PAL.sand[1]);
      q.tri(px, t0 - 8, px + 3, t0 - 8, px + 1, t0 - 14, PAL.steel[1]);
      q.fine(px, t0 - 8.5, px + 1, t0 - 13.5, PAL.steel[2]);
    }
    for (const bx of [tx + 6, tx + 22]) {
      q.rect(bx, t0 + 4, 10, 10, PAL.ink[1]);
      q.ellipse(bx, t0 + 2, 10, 6, PAL.ink[1]);
      // Louvres in the belfry openings.
      for (let y = t0 + 5; y < t0 + 13; y += 2) q.fineRow(bx + 1, bx + 8, y + 0.5, PAL.ink[0]);
      q.fineCol(bx + 5, t0 + 3, t0 + 13, PAL.steel[0]);
    }
    q.circle(tx + 19, t0 + 26, 6, PAL.sand[3]);
    q.circle(tx + 19, t0 + 26, 5, PAL.snow[3]);
    // Hour marks and fine clock hands.
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      q.dot(tx + 19.25 + Math.cos(a) * 4.5, t0 + 26.25 + Math.sin(a) * 4.5, k % 3 === 0 ? PAL.ink[1] : PAL.stone[3]);
    }
    q.fine(tx + 19, t0 + 26, tx + 19, t0 + 22, PAL.ink[1]);
    q.fine(tx + 19.5, t0 + 26, tx + 19.5, t0 + 22.5, PAL.ink[1]);
    q.fine(tx + 19, t0 + 26.5, tx + 22, t0 + 27, PAL.ink[1]);
    q.rect(tx + 11, t0 + 40, 16, ceil - t0 - 46, PAL.navy[1]);
    q.ellipse(tx + 11, t0 + 36, 16, 9, PAL.navy[1]);
    q.fineCol(tx + 19, t0 + 37, ceil - 7, PAL.sand[2]);
    q.fineCol(tx + 15, t0 + 39, ceil - 7, PAL.sand[1]);
    q.fineCol(tx + 23, t0 + 39, ceil - 7, PAL.sand[1]);
    for (let y = t0 + 44; y < ceil - 7; y += 8) q.fineRow(tx + 11, tx + 26, y, PAL.sand[1]);
    q.set(tx + 13, t0 + 41, PAL.sky[2]);
    q.dot(tx + 12.5, t0 + 41.5, PAL.sky[1]);
    // The spire per 2× row: slate courses, lit left, a gold vane.
    for (let Y = 0; Y < t0 * 2; Y++) {
      const y = Y / 2;
      const half2 = Math.max(2, Math.round((tw - 6) * Math.pow(y / t0, 1.6)));
      const mid = (tx + tw / 2) * 2;
      for (let X = mid - half2; X < mid + half2; X++) b.set(X, Y, X < mid - 2 ? PAL.steel[2] : PAL.steel[0]);
      if (Y % 12 === 6 || Y % 12 === 7) for (let X = mid - half2; X < mid + half2; X++) if (Y % 12 === 6) b.set(X, Y, PAL.steel[1]);
      if (half2 > 2) b.set(mid - half2, Y, PAL.steel[3]);
    }
    q.vline(tx + tw / 2, 0, 4, PAL.gold[2]);
    q.fineCol(tx + tw / 2, 0, 4, PAL.gold[3]);
    q.set(tx + tw / 2 + 1, 1, PAL.gold[3]);
    q.dot(tx + tw / 2 + 1.5, 1.5, PAL.gold[1]);
  }
  for (const ax of [p0, p1]) {
    q.rect(ax - 3, ceil - 4, 6, base - ceil + 5, PAL.sand[3]);
    q.vline(ax + 2, ceil - 4, base, PAL.sand[1]);
    q.fineCol(ax - 3, ceil - 4, base, PAL.snow[2]);
    for (let y = ceil; y < base; y += 6) q.fineRow(ax - 3, ax + 1, y, PAL.sand[2]);
  }
  for (const x of [8, 30, 430, 452]) {
    q.rect(x - 1, ceil + 6, 12, 40, PAL.sand[3]);
    q.rect(x, ceil + 8, 10, 37, PAL.navy[1]);
    q.ellipse(x, ceil + 5, 10, 8, PAL.navy[1]);
    q.fineCol(x + 5, ceil + 6, ceil + 44, PAL.sand[2]);
    for (let y = ceil + 14; y < ceil + 44; y += 8) q.fineRow(x, x + 9, y, PAL.sand[2]);
    q.set(x + 1, ceil + 9, PAL.sky[2]);
    q.dot(x + 1.5, ceil + 10, PAL.sky[1]);
  }
  for (const [x, c, d] of [[150, PAL.red[2], PAL.red[1]], [310, PAL.gold[2], PAL.gold[1]]] as const) {
    q.rect(x, roofY + 4, 10, 26, c);
    q.tri(x, roofY + 30, x + 9, roofY + 30, x + 5, roofY + 34, c);
    q.vline(x, roofY + 4, roofY + 29, PAL.snow[3]);
    q.fineCol(x + 9.5, roofY + 4, roofY + 29, d);
    // Our own banner motif: a simple white frame and a dot.
    q.fineRow(x + 2, x + 7, roofY + 7, PAL.snow[3]);
    q.fineRow(x + 2, x + 7, roofY + 24, PAL.snow[3]);
    q.circle(x + 5, roofY + 15, 2, PAL.snow[3], false);
    q.fineRow(x + 1, x + 9, roofY + 4, PAL.steel[3]);
  }
  q.outline();
  return q.frame(241, H);
}

/** Front strip of lawn (top-left at (x, 172)): blades on the 2× grid, a few flowers. */
export function lawnHi(w: number): PixelBuffer {
  const q = new Q(w, 48);
  const b = q.b;
  for (let X = 0; X < w * 2; X++) {
    const x = X >> 1;
    const tuft = Math.floor(hash2(x, 1, 12) * 4);
    // Blades: each 2× column gets its own tip height within the tuft.
    const tip = (4 - tuft) * 2 + (hash2(X, 2, 12) > 0.5 ? 1 : 0) - (hash2(X, 3, 12) > 0.8 ? 1 : 0);
    for (let Y = Math.max(0, tip); Y < 96; Y++) {
      const y = Y >> 1;
      const d = y - 4;
      let c: Color = d < 1 ? PAL.green[4] : d < 4 ? PAL.green[3] : (x + y * 3) % 7 === 0 && ((X + Y) & 1) === 0 ? PAL.green[1] : PAL.green[2];
      if (d >= 30) c = PAL.green[1];
      if (y < 4) c = (X & 1) === 0 ? PAL.green[3] : PAL.green[4];
      if (d >= 1 && d < 4 && hash2(X, Y, 14) > 0.85) c = PAL.green[4];
      if (d > 8 && hash2(x, y, 13) > 0.985) c = TULIPS[(x + y) % TULIPS.length];
      b.set(X, Y, c);
    }
  }
  return b;
}

/** The long shallow pool (4 frames): a stone rim with a lit edge, glints on single 2× pixels. */
export function poolHi(w: number): PixelBuffer[] {
  return [0, 1, 2, 3].map((f) => {
    const q = new Q(w, 10);
    q.rect(0, 0, w, 10, PAL.stone[3]);
    q.fineRow(0, w - 1, 0, PAL.snow[1]);
    q.fineRow(0, w - 1, 1.5, PAL.stone[2]);
    q.rect(2, 2, w - 4, 6, PAL.sky[1]);
    for (let x = 2; x < w - 2; x++) {
      if (((x + f * 3) & 15) < 3) q.fineRow(x, x, 3, PAL.snow[3]);
      if (((x + f * 3) & 15) === 3) q.dot(x, 3.5, PAL.snow[3]);
      if (((x * 3 + f * 5) & 31) === 7) q.set(x, 6, PAL.sky[3]);
      if (((x * 5 + f * 3) & 31) === 11) q.dot(x, 4.5, PAL.sky[2]);
      q.set(x, 2, PAL.sky[2]);
      q.dot(x, 2.5, PAL.sky[1]);
    }
    q.fineRow(2, w - 3, 7.5, PAL.sky[0]);
    q.hline(0, w - 1, 9, PAL.stone[1]);
    return q.b;
  });
}
