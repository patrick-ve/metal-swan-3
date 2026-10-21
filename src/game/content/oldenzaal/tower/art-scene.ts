/**
 * The tower's scenery art (oz-f, docs/design/oldenzaal.md §8, §10.1: the storm): the background
 * layers, the roof backdrop and the interior decor. Owner: TOWER. One drawer per id makes the 1×,
 * 2× and 4× art (art-kit.ts). Backgrounds and the roof backdrop are painted without ink (ordered
 * dither only on the sky); the interior decor is static playfield decor with outline C.
 *
 * - `oz-tower-storm` (layer, screen-fixed): the storm sky seen through the openings: heavy night
 *   clouds, a cold lit edge, rain sheets.
 * - `oz-tower-wall` (layer, world-locked, tiles in y every 288 px): the inner face of the tower's
 *   walls: Bentheimer sandstone ashlar, dark with soot and damp, a string course, putlog holes and
 *   two narrow lancet openings (cut out: the storm layer shows through).
 * - `decor/oz-tower/top`: the roof backdrop (the storm sky, the small spire with its clock dial and
 *   the open lantern of the big bell, the corner pinnacles, the far parapet).
 * - `decor/oz-tower/landing` (3), `stair`, `door`, `lantern` (3, flicker), `clock`, `pendulum` (8),
 *   `braces` (2), `rope`, `louvre`, `frame` (the oak bell frame), `roof` (the slab under the
 *   walkway), `wall` (3: the walls' cut faces, the top one with the parapet coping), `floor`.
 *
 * Respect (docs/ORIGINALITY.md): the spire carries a plain iron cross at its tip; nothing in the
 * church is broken or burned on purpose (the tower is old and worn, not damaged).
 */
import type { Color } from '../../../../engine/color';
import { BELLS, TOWER } from './layout';
import { ladder } from '../../missions/oldenzaal/art-kit';
import { bay, dq, fbm, h2, lit, mx, outlineC, Pen, R, reg, regBg, same, shadeBall, shadeCyl, sstep, T, type Any, type Dn } from './art-kit';

// ------------------------------------------------------------------------------------ helpers

/** Periodic value noise (period px, py in lattice cells of s logical px). */
function pnoise(X: number, Y: number, d: number, s: number, px: number, py: number, seed: number): number {
  const x = X / (d * s);
  const y = Y / (d * s);
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const w = (i: number, n: number): number => ((i % n) + n) % n;
  const a = h2(w(xi, px), w(yi, py), seed);
  const b = h2(w(xi + 1, px), w(yi, py), seed);
  const c = h2(w(xi, px), w(yi + 1, py), seed);
  const e = h2(w(xi + 1, px), w(yi + 1, py), seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + e) * ux * uy;
}

/** The art px centre in logical units. */
const L = (X: number, d: number): number => (X + 0.5) / d;

/** Aged oak: sooty black-brown in the shade → warm brown → a dusty grey-brown where the light catches it. */
const OAK_STOPS: readonly Color[] = [0x221a28ff, 0x3d1f14ff, 0x5b3828ff, 0x85583cff, 0x938570ff];
const oakCache = new Map<number, readonly Color[]>();

/** Aged oak: light l 0 … 1 (a fine ladder through `OAK_STOPS`, snapped to the palette of d). */
function oak(l: number, d: Dn): Color {
  let lad = oakCache.get(d);
  if (!lad) {
    lad = ladder(OAK_STOPS, 3, d);
    oakCache.set(d, lad);
  }
  const k = Math.max(0, Math.min(lad.length - 1, Math.floor(l * (lad.length - 0.01))));
  return lad[k];
}

/**
 * A squared oak beam from (x0, y0) to (x1, y1), w logical px thick, with form: the lit upper face,
 * the body, the shaded underside, the grain along it and a few checks (cracks).
 */
function beam(p: Pen, x0: number, y0: number, x1: number, y1: number, w: number, seed: number): void {
  const d = p.d;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const L0 = Math.hypot(dx, dy) || 1;
  const ux = dx / L0;
  const uy = dy / L0;
  // The normal pointing up (toward the light).
  let nx = -uy;
  let ny = ux;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  const h = w / 2;
  p.poly(
    [
      [x0 + nx * h, y0 + ny * h],
      [x1 + nx * h, y1 + ny * h],
      [x1 - nx * h, y1 - ny * h],
      [x0 - nx * h, y0 - ny * h],
    ],
    (X, Y) => {
      const x = (X + 0.5) / d - x0;
      const y = (Y + 0.5) / d - y0;
      const along = x * ux + y * uy;
      const q = (x * nx + y * ny) / h; // +1 = the upper (lit) face, −1 = the underside
      let l = q > 0.62 ? 0.82 : q < -0.55 ? 0.12 : 0.42 + q * 0.12;
      l += (pnoise(Math.round(along * d), Math.round(q * 6), 1, 4, 4096, 4096, seed) - 0.5) * 0.22;
      if (d > 1 && Math.abs(q) < 0.5 && pnoise(Math.round(along * d), Math.round(q * 20), 1, 6, 4096, 4096, seed + 1) > 0.82) l -= 0.3;
      return oak(l, d);
    },
  );
}

/** Tower stone (Bentheimer sandstone, dark inside): light l 0 … 1. */
function stone(l: number, d: Dn): Color {
  return lit('sandstone', l, d, 1, 6);
}

/** Wood grain shade along x (planks / beams): a small tone wobble by a stretched noise. */
function grain(X: number, Y: number, d: number, seed: number): number {
  return (pnoise(X, Y * 6, d, 3, 4096, 4096, seed) - 0.5) * 0.28;
}

// ------------------------------------------------------------------------------------ layers

const STORM_SKY: Any[] = ['night'];
void STORM_SKY;

/** The storm sky (screen-fixed): heavy clouds, a cold lit edge, rain sheets (dithered). */
regBg('oz-tower-storm', (p, _params, seed) => {
  const d = p.d;
  const W = p.w;
  const H = p.h;
  p.fill(0, 0, W, H, (X, Y) => {
    const x = L(X, d);
    const y = L(Y, d);
    const n = fbm(X, Y, d, 22, seed + 3) * 0.7 + fbm(X, Y, d, 7, seed + 9) * 0.3;
    // Cloud mass: darker above, a lit band low in the sky (a far flash), rain sheets slanting.
    let v = 1.1 + n * 2.6 - (y / H) * 0.6 + sstep(0.5, 0.75, y / H) * 0.7 * (1 - sstep(0.8, 1, y / H));
    const sheet = Math.sin((x + y * 0.35) * 0.18 + n * 4);
    if (sheet > 0.6) v -= 0.5;
    if (n > 0.62) v += (n - 0.62) * 3.2;
    return R('night', dq(v, X, Y, 1), d);
  });
});

/** Tile height of the wall layer (a whole number of courses). */
export const WALL_TILE_H = 288;
const COURSE = 12;

/** The inner face of the tower's walls (world-locked, repeats in y). */
regBg('oz-tower-wall', (p, _params, seed) => {
  const d = p.d;
  const W = p.w;
  const H = p.h;
  // Two lancet openings per tile (x, top y, width, height): narrow, round-headed.
  const slits: Array<[number, number, number, number]> = [
    [86, 40, 8, 42],
    [286, 182, 8, 42],
  ];
  const inSlit = (x: number, y: number, grow: number): number => {
    for (let i = 0; i < slits.length; i++) {
      const [sx, sy, sw, sh] = slits[i];
      const cx = sx + sw / 2;
      const r = sw / 2 + grow;
      if (x < cx - r || x > cx + r || y > sy + sh + grow) continue;
      if (y >= sy + r - grow * 0.2) return i + 1;
      const dy = y - (sy + r);
      if ((x - cx) ** 2 + dy * dy <= r * r) return i + 1;
    }
    return 0;
  };
  p.fill(0, 0, W, H, (X, Y) => {
    const x = L(X, d);
    const y = L(Y, d);
    // The opening itself: clear (the storm layer behind shows).
    if (inSlit(x, y, 0)) return 0;
    // The deep splayed reveal round it: the lit left jamb, the dark right one, the sill.
    const rv = inSlit(x, y, 4.5);
    if (rv) {
      const [sx, , sw] = slits[rv - 1];
      const cx = sx + sw / 2;
      const left = x < cx;
      const wet = pnoise(X, Y, d, 2, 4096, 4096, seed + 31) > 0.66;
      return wet ? R('r2:soot', 3, d) : stone(left ? 0.62 : 0.12, d);
    }
    // The ashlar: courses of 12, blocks 20–34 wide (by course), joints dark.
    const row = Math.floor(y / COURSE);
    const vy = y - row * COURSE;
    const off = h2(row % (H / COURSE), 1, seed) * 30;
    const bw = 20 + Math.floor(h2(row % (H / COURSE), 2, seed) * 14);
    const xx = (((x + off) % W) + W) % W;
    const col = Math.floor(xx / bw);
    const u = xx - col * bw;
    const jw = d === 1 ? 1 : 0.75;
    // The string course (a projecting band) once per tile.
    if (row === 13) {
      if (vy < 1.2) return stone(0.85, d);
      if (vy > COURSE - 2.2) return R('ink', 1, d);
      return stone(0.45 + (pnoise(X, Y, d, 3, (W * d) / 3, 4096, seed + 4) - 0.5) * 0.25, d);
    }
    if (vy < jw || u < jw) return R('sandstone', 0, d);
    // Putlog holes (the scaffold holes of the builders) in one course.
    if (row === 4 && (Math.floor(xx / 64) % 2 === 0) && Math.abs((xx % 64) - 30) < 2.2 && vy > 3 && vy < 8) return R('ink', 0, d);
    const bh = h2(col, row % (H / COURSE), seed + 7);
    let l = 0.22 + bh * 0.22;
    if (vy < 2) l += 0.16; // the lit top arris
    if (vy > COURSE - 2.5) l -= 0.12;
    if (u < 2) l += 0.08;
    // Weathering: pits and the grain of the sandstone (finer at 4×), soot and damp streaks running down.
    const g = pnoise(X, Y, d, 1.2, (W * d) / 1.2 / d, (H * d) / 1.2 / d, seed + 11);
    if (d >= 2 && g > 0.82) l -= 0.18;
    const streak = pnoise(X, Math.floor(Y / 6), d, 5, Math.round(W / 5), Math.round(H / 30), seed + 13);
    const damp = pnoise(X, Y, d, 9, Math.round(W / 9), Math.round(H / 9), seed + 17);
    if (streak > 0.7) return mx(stone(l, d), R('r2:soot', 1, d), 0.55, d);
    if (damp > 0.74 && y % H > 0) return mx(stone(l, d), R('moss', 1, d), 0.35, d);
    return stone(l, d);
  });
  void bay;
});

// ------------------------------------------------------------------------------------ the roof backdrop

/** The spire's place in the backdrop (logical px of the 384 × 120 sprite = world px at y 0). */
const SPIRE = { cx: 192, arcadeTop: 26, arcadeBot: 66, half: 30, base: 120, dialY: 90, dialR: 8, apex: 6 } as const;

reg('decor/oz-tower/top', [{ w: TOWER.w, h: TOWER.roofY, ox: 0, oy: 0 }], (p) => {
  const d = p.d;
  const W = TOWER.w;
  const H = TOWER.roofY;
  const S = SPIRE;
  // The sky: heavy storm clouds, rain streaks, a cold flash-lit underside of the clouds.
  p.fill(0, 0, W, H, (X, Y) => {
    const x = L(X, d);
    const y = L(Y, d);
    const n = fbm(X, Y, d, 18, 211) * 0.75 + fbm(X, Y, d, 6, 219) * 0.25;
    let v = 0.9 + n * 2.8 + sstep(60, 110, y) * 0.5;
    if (n > 0.6) v += (n - 0.6) * 4;
    const rain = (Math.floor((x + y * 0.34) * 1.7) % 9 === 0) && h2(Math.floor(x + y * 0.34), 5, 3) > 0.55;
    if (rain && d > 1) v += 0.9;
    return R('night', dq(v, X, Y, 1), d);
  });
  // The far parapet of the roof (behind the heroes) and the lead walkway's far edge.
  p.fill(0, 102, W, 18, (X, Y) => {
    const x = L(X, d);
    const y = L(Y, d) - 102;
    const blk = Math.floor(x / 22);
    const u = x - blk * 22;
    if (y < 2) return stone(0.7, d);
    if (u < 0.8) return R('sandstone', 0, d);
    if (y > 15) return R('slate', 2, d);
    return stone(0.3 + h2(blk, 3, 41) * 0.15 - y * 0.012, d);
  });
  // The corner pinnacles over the walls.
  for (const cx of [12, W - 12]) {
    p.poly([[cx - 8, 102], [cx - 8, 84], [cx - 5, 84], [cx, 66], [cx + 5, 84], [cx + 8, 84], [cx + 8, 102]], (X, Y) => {
      const u = (L(X, d) - cx) / 8;
      const y = L(Y, d);
      return stone(shadeCyl(u, y < 84 ? 0.4 : 0) * 0.85, d);
    });
  }
  // The spire's base (the clock stage) down to the roof.
  const bx = S.cx - S.half;
  p.fill(bx, S.arcadeBot, S.half * 2, S.base - S.arcadeBot, (X, Y) => {
    const x = L(X, d) - bx;
    const y = L(Y, d) - S.arcadeBot;
    const u = (x - S.half) / S.half;
    const row = Math.floor(y / 7);
    const off = row % 2 ? 6 : 0;
    const col = Math.floor((x + off) / 12);
    if ((y % 7 < 0.7 && d > 1) || ((x + off) % 12 < 0.7 && d > 1)) return R('sandstone', 1, d);
    let l = 0.42 - u * 0.25 + (h2(col, row, 77) - 0.5) * 0.12;
    if (y < 3) l += 0.25; // the cornice under the arcade
    return stone(l, d);
  });
  // The clock dial (cream face, dark numerals as ticks, iron hands at ten to nine... it stopped).
  p.disc(S.cx, S.dialY, S.dialR + 1.2, S.dialR + 1.2, (_X, _Y, u, v) => lit('gold', 0.35 + shadeBall(u, v) * 0.4, d, 1, 5));
  p.disc(S.cx, S.dialY, S.dialR, S.dialR, (X, Y, u, v) => {
    const x = L(X, d) - S.cx;
    const y = L(Y, d) - S.dialY;
    const r = Math.hypot(x, y);
    const a = Math.atan2(y, x);
    // Hour ticks.
    if (r > S.dialR - 1.6 && r < S.dialR - 0.4) {
      const k = Math.round((a / (Math.PI * 2)) * 12);
      if (Math.abs(a - (k * Math.PI * 2) / 12) * r < 0.45) return R('ink', 1, d);
    }
    // The hands: the hour hand to IX, the minute hand to X (the clock stopped at ten to nine).
    const hand = (ang: number, lenH: number, w: number): boolean => {
      const ux = Math.cos(ang);
      const uy = Math.sin(ang);
      const t = x * ux + y * uy;
      const q = Math.abs(-x * uy + y * ux);
      return t > -0.6 && t < lenH && q < w;
    };
    if (hand(Math.PI, S.dialR * 0.55, 0.65) || hand((7 * Math.PI) / 6, S.dialR * 0.82, 0.45)) return R('ink', 0, d);
    const l = 0.55 + shadeBall(u, v) * 0.4 - (r > S.dialR - 0.8 ? 0.2 : 0);
    // Old and damp: a stain runs down from the centre.
    const stain = fbm(X, Y, d, 2.5, 301) > 0.66 && y > 0;
    return stain ? lit('sand', l * 0.6, d, 2, 6) : lit('sand', l, d, 2, 7);
  });
  // The open lantern: two stone piers and a centre column, round arches, the dark inside.
  const ax = S.cx - S.half + 2;
  const aw = S.half * 2 - 4;
  p.fill(ax, S.arcadeTop, aw, S.arcadeBot - S.arcadeTop, (X, Y) => {
    const x = L(X, d) - ax;
    const y = L(Y, d) - S.arcadeTop;
    const pierW = 5;
    const midX = aw / 2;
    const inPier = x < pierW || x > aw - pierW || Math.abs(x - midX) < 2;
    // The arch heads of the two openings.
    const openW = (aw - pierW * 2 - 4) / 2;
    const oc = [pierW + openW / 2, aw - pierW - openW / 2];
    let inside = false;
    for (const c of oc) {
      const rr = openW / 2;
      if (Math.abs(x - c) <= rr && (y > 6 + rr || (x - c) ** 2 + (y - 6 - rr) ** 2 <= rr * rr) && y < S.arcadeBot - S.arcadeTop - 4) inside = true;
    }
    if (!inPier && inside) return R('night', 1 + (y > 30 ? 1 : 0), d);
    let l = 0.4 - (x / aw - 0.5) * 0.4;
    if (y < 4) l += 0.2;
    if (y > S.arcadeBot - S.arcadeTop - 4) l += 0.15; // the sill
    return stone(l, d);
  });
  // The small slate spire, pointed, on top; a plain iron cross at its tip.
  p.poly([[S.cx - S.half - 3, S.arcadeTop + 1], [S.cx, S.apex + 6], [S.cx + S.half + 3, S.arcadeTop + 1]], (X, Y) => {
    const x = L(X, d) - S.cx;
    const y = L(Y, d);
    // Slates in rows; the left face lit by the flashes, the right in shade.
    const row = Math.floor(y / 2.2);
    const lft = x < 0;
    let l = lft ? 0.55 : 0.18;
    if (Math.abs(x) < 0.6) l += 0.25; // the hip
    if ((y % 2.2) < 0.45) l -= 0.18;
    l += (h2(Math.floor(x / 3), row, 5) - 0.5) * 0.15;
    return lit('slate', l, d, 1, 5);
  });
  p.rect(S.cx - 0.6, S.apex - 6, 1.2, 12, R('steel', 1, d));
  p.rect(S.cx - 3, S.apex - 3, 6, 1.2, R('steel', 1, d));
  p.rect(S.cx - 0.6, S.apex - 6, 0.6, 12, R('steel', 3, d));
});

// ------------------------------------------------------------------------------------ interior decor

/** A landing's beam, joists and brackets (176 × 16; anchor the centre of its top; the wall end at x 0). */
reg('decor/oz-tower/landing', same(3, { w: TOWER.ledgeW, h: 16, ox: TOWER.ledgeW / 2, oy: 0 }), (p, f) => {
  const d = p.d;
  const W = TOWER.ledgeW;
  // The main beam under the planks (y 3 … 10), a little sagging toward its free end.
  p.fill(0, 3, W, 9, (X, Y) => {
    const x = L(X, d);
    const y = L(Y, d) - 3;
    const sag = (x / W) * 0.8;
    if (y < sag || y > 7 + sag) return 0;
    const v = (y - sag) / 7;
    let l = v < 0.18 ? 0.8 : v > 0.82 ? 0.08 : 0.42 - v * 0.2;
    l += grain(X, Y, d, 30 + f);
    // Checks (cracks along the grain) and an old split.
    if (pnoise(X, Y * 4, d, 4, 4096, 4096, 50 + f) > 0.8 && v > 0.3 && v < 0.7) l -= 0.3;
    return oak(l, d);
  });
  // The joists' ends showing along the front, every 16 px.
  for (let x = 10; x < W - 6; x += 16) p.fill(x, 2.5, 3.2, 3, (_X, Y) => oak(L(Y, d) < 3.4 ? 0.7 : 0.3, d));
  // Iron straps and bolts.
  for (const x of [22, W / 2 + (f === 1 ? 14 : 0), W - 30]) {
    p.rect(x, 3, 1.6, 8, R('steel', 2, d));
    if (d > 1) p.rect(x + 0.4, 4, 0.8, 0.8, R('steel', 5, d));
  }
  // The stone corbel at the wall end and a knee brace down to the wall.
  p.fill(0, 3, 9, 10, (X, Y) => {
    const x = L(X, d);
    const y = L(Y, d) - 3;
    if (x > 9 - y * 0.6) return 0;
    return stone(y < 1.5 ? 0.75 : 0.35 - x * 0.02, d);
  });
  beam(p, 1, 15, 22 + f * 4, 10, 2, 40 + f);
  // A cobweb in the corner (variant 1), a hanging rope end (variant 2).
  if (f === 1 && d > 1) for (let k = 0; k < 4; k++) p.line(9, 12 + k * 0.8, 9 + 5 - k, 15.5, R('slate', 5, d), 1);
  if (f === 2) p.rect(W - 46, 10, 0.9, 6, R('brown', 3, d));
  outlineC(p);
});

/** A steep wooden stair (a ladder stair) from a landing up to the next (36 px), anchor bottom centre. */
reg('decor/oz-tower/stair', [{ w: 40, h: 44, ox: 20, oy: 40 }], (p) => {
  const d = p.d;
  // Two stringers from the lower right to the upper left (flipX turns it).
  const sx0 = 30;
  const sy0 = 40;
  const sx1 = 8;
  const sy1 = 4;
  // Treads between the stringers.
  for (let k = 1; k < 7; k++) {
    const t = k / 7;
    const x = sx0 + (sx1 - sx0) * t;
    const y = sy0 + (sy1 - sy0) * t;
    p.fill(x - 4.2, y - 0.6, 8, 1.6, (_X, Y) => oak(L(Y, d) < y ? 0.75 : 0.32, d));
  }
  beam(p, sx0 + 3.5, sy0, sx1 + 3.5, sy1, 2.2, 31);
  beam(p, sx0 - 3.5, sy0, sx1 - 3.5, sy1, 2.2, 32);
  // The handrail (a pole on two posts).
  p.line(sx0 + 5, sy0 - 12, sx1 + 5, sy1 - 2, oak(0.6, d), Math.max(1, Math.round(d * 1.2)));
  p.line(sx0 + 5, sy0 - 12, sx0 + 5, sy0, oak(0.3, d), Math.max(1, Math.round(d * 1.1)));
  outlineC(p);
});

/** The tower door at the foot (round-headed oak, iron studs), anchor bottom left. */
reg('decor/oz-tower/door', [{ w: 30, h: 52, ox: 0, oy: 52 }], (p) => {
  const d = p.d;
  p.fill(0, 0, 30, 52, (X, Y) => {
    const x = L(X, d);
    const y = L(Y, d);
    const cx = 15;
    // The stone arch round the door.
    const r = 13;
    const inArch = (y > 2 + r || (x - cx) ** 2 + (y - 2 - r) ** 2 <= r * r) && Math.abs(x - cx) <= r;
    if (!inArch) return 0;
    const r2 = 10;
    const inDoor = (y > 5 + r2 || (x - cx) ** 2 + (y - 5 - r2) ** 2 <= r2 * r2) && Math.abs(x - cx) <= r2;
    if (!inDoor) {
      const a = Math.atan2(y - 2 - r, x - cx);
      const vous = Math.floor((a + Math.PI) * 4);
      if (y < 2 + r && (vous % 2 === 0) && d > 1 && Math.abs(Math.hypot(x - cx, y - 2 - r) - 11.5) < 0.4) return R('sandstone', 1, d);
      return stone(x < cx ? 0.62 : 0.3, d);
    }
    // Planks, studs, two strap hinges; it stands ajar (a dark gap on the right).
    if (x > cx + r2 - 2.2) return R('ink', 0, d);
    const plank = Math.floor((x - cx + r2) / 4);
    let l = 0.35 + (h2(plank, 1, 9) - 0.5) * 0.18 + grain(X, Y, d, 70);
    if ((x - cx + r2) % 4 < 0.5) l -= 0.25;
    for (const hy of [20, 40]) if (Math.abs(y - hy) < 1) return R('steel', 2, d);
    if (d > 1 && Math.round(x) % 4 === 1 && Math.round(y) % 6 === 3 && (X % d === 0) && (Y % d === 0)) return R('steel', 4, d);
    return oak(l, d);
  });
  outlineC(p);
});

/** A wall lantern on an iron bracket (the bracket from the wall at the left; flipX for the right wall), 3 flicker frames. */
reg('decor/oz-tower/lantern', same(3, { w: 18, h: 26, ox: 8, oy: 0 }), (p, f) => {
  const d = p.d;
  // The bracket arm from the wall (x 0) with a scroll, the hook.
  p.line(0, 3, 10, 3, R('steel', 2, d), Math.max(1, Math.round(d * 1.2)));
  p.line(0, 9, 7, 3, R('steel', 1, d), Math.max(1, Math.round(d * 0.9)));
  p.rect(9.4, 3, 1, 4, R('steel', 2, d));
  // The lantern: a cap, glass panes glowing warm, a dark frame, the flame.
  const cx = 10;
  p.poly([[cx - 3.5, 9], [cx, 6.5], [cx + 3.5, 9]], R('steel', 1, d));
  p.fill(cx - 3.5, 9, 7, 9, (X, Y) => {
    const x = L(X, d) - cx;
    const y = L(Y, d) - 9;
    if (Math.abs(x) > 3.3 - (y > 7 ? (y - 7) * 0.6 : 0)) return 0;
    if (Math.abs(x) > 2.6 || y < 0.8 || y > 8 || Math.abs(x) < 0.35) return R('steel', 1, d);
    const flame = Math.abs(x + (f - 1) * 0.3) < 0.9 - (y - 3) * 0.1 && y > 2.5 + f * 0.3 && y < 6.5;
    if (flame) return T('candle', 6, d);
    const g = 1 - Math.hypot(x, y - 5) / 4.5;
    return lit('candle', 0.25 + g * 0.6 + (f === 2 ? 0.05 : 0), d, 2, 5);
  });
  p.rect(cx - 2, 18, 4, 1.2, R('steel', 2, d));
  outlineC(p);
}, { ticksPerFrame: 7 });

/** The clock works: an oak frame with a cast-iron and brass gear train, the weights on chains (160 × 130, top left). */
reg('decor/oz-tower/clock', [{ w: 160, h: 130, ox: 0, oy: 0 }], (p) => {
  const d = p.d;
  // The oak frame: two posts, three rails.
  for (const [x, y, w, h] of [
    [8, 0, 7, 130],
    [145, 0, 7, 130],
    [8, 6, 144, 6],
    [8, 70, 144, 5],
    [8, 122, 144, 6],
  ] as const) {
    p.fill(x, y, w, h, (X, Y) => {
      const u = w > h ? (L(Y, d) - y) / h : (L(X, d) - x) / w;
      return oak(shadeCyl(u * 2 - 1) * 0.8 + grain(X, Y, d, 90), d);
    });
  }
  // A gear: a toothed rim, spokes, a hub; iron or brass.
  const gear = (cx: number, cy: number, r: number, teeth: number, brass: boolean, spokes: number, rot: number): void => {
    const n: Any = brass ? 'gold' : 'steel';
    p.fill(cx - r - 1.5, cy - r - 1.5, r * 2 + 3, r * 2 + 3, (X, Y) => {
      const x = L(X, d) - cx;
      const y = L(Y, d) - cy;
      const q = Math.hypot(x, y);
      const a = Math.atan2(y, x) + rot;
      const tooth = Math.cos(a * teeth) > 0.1 ? 1.3 : 0;
      if (q > r + tooth) return 0;
      const rim = q > r * 0.78;
      const hub = q < r * 0.2;
      const spoke = Math.abs(Math.sin((a * spokes) / 2)) < 0.12 + 0.6 / Math.max(1, q);
      if (!rim && !hub && !spoke) return 0;
      // Light from the upper left on the rim's bevel.
      const nx = q > 0 ? x / q : 0;
      const ny = q > 0 ? y / q : 0;
      let l = 0.45 - (nx * 0.35 + ny * 0.3) * (rim ? 1 : 0.4);
      if (hub) l = 0.3 + shadeBall(x / (r * 0.2), y / (r * 0.2)) * 0.6;
      if (q > r - 0.4 && q < r + 0.1) l -= 0.25;
      return brass ? lit(n, l * 0.85, d, 1, 5) : lit(n, l * 0.8, d, 1, 5);
    });
  };
  gear(58, 40, 24, 22, false, 6, 0.1);
  gear(100, 30, 13, 14, true, 4, 0.3);
  gear(118, 52, 9, 10, false, 4, 0);
  gear(84, 96, 18, 18, false, 5, 0.2);
  gear(124, 98, 8, 9, true, 3, 0.4);
  gear(40, 98, 6, 8, true, 3, 0);
  // The winding drum with its cable.
  p.fill(22, 76, 34, 12, (X, Y) => {
    const v = (L(Y, d) - 76) / 12;
    const coil = (L(X, d) * 1.4) % 2 < 0.6;
    return lit('steel', shadeCyl(v * 2 - 1, 0) * 0.7 + (coil ? -0.15 : 0), d);
  });
  // Arbors (axles) and the escapement's anchor at the top.
  for (const [x, y] of [[58, 40], [100, 30], [118, 52], [84, 96], [124, 98]] as const) p.disc(x, y, 1.6, 1.6, R('steel', 5, d));
  p.poly([[96, 14], [104, 14], [108, 22], [100, 18], [92, 22]], R('steel', 3, d));
  // The rod up to the dials and the chains with the weights down.
  p.rect(99.5, 0, 1.4, 12, R('steel', 2, d));
  for (const x of [26, 50]) {
    for (let y = 88; y < 128; y += 2) p.rect(x - 0.6, y, 1.2, 1.2, R('steel', (y >> 1) % 2 ? 3 : 1, d));
  }
  p.fill(21, 112, 10, 16, (X) => lit('steel', shadeCyl(((L(X, d) - 21) / 10) * 2 - 1) * 0.7, d));
  outlineC(p);
});

/** The pendulum (40 × 96, anchor the pivot at the top centre), 8 frames of a slow swing. */
reg('decor/oz-tower/pendulum', same(8, { w: 40, h: 96, ox: 20, oy: 0 }), (p, f) => {
  const d = p.d;
  const a = Math.sin((f / 8) * Math.PI * 2) * 0.17;
  const len = 82;
  const bx = 20 + Math.sin(a) * len;
  const by = Math.cos(a) * len;
  p.line(20, 0, bx, by, R('steel', 2, d), Math.max(1, Math.round(d * 1.1)));
  p.disc(bx, by, 7, 7, (_X, _Y, u, v) => lit('gold', shadeBall(u, v) * 0.85, d, 1, 6));
  p.disc(bx, by, 2.2, 2.2, (_X, _Y, u, v) => lit('gold', 0.2 + shadeBall(u, v) * 0.3, d, 1, 5));
  outlineC(p);
}, { ticksPerFrame: 12 });

/** Crossed oak braces with a tie beam and bolts (336 × 110, top left), 2 variants. */
reg('decor/oz-tower/braces', same(2, { w: 336, h: 110, ox: 0, oy: 0 }), (p, f) => {
  const d = p.d;
  if (f === 0) {
    beam(p, 2, 104, 168, 8, 5, 11);
    beam(p, 168, 104, 2, 8, 5, 12);
    beam(p, 168, 104, 334, 8, 5, 13);
    beam(p, 334, 104, 168, 8, 5, 14);
  } else {
    beam(p, 40, 104, 140, 63, 5, 15);
    beam(p, 296, 104, 196, 63, 5, 16);
    beam(p, 0, 60, 336, 60, 6, 17);
  }
  // A tie beam at the top.
  p.fill(0, 2, 336, 6, (X, Y) => oak(((L(Y, d) - 2) / 6 < 0.25 ? 0.7 : 0.35) + grain(X, Y, d, 120), d));
  for (let x = 30; x < 336; x += 69) p.disc(x, 5, 1.2, 1.2, R('steel', 3, d));
  outlineC(p);
});

/** A bell rope hanging down (6 × 190; anchor top centre) with a woollen grip (sally). */
reg('decor/oz-tower/rope', [{ w: 6, h: 190, ox: 3, oy: 0 }], (p) => {
  const d = p.d;
  p.fill(1.8, 0, 2.4, 190, (X, Y) => {
    const y = L(Y, d);
    if (y > 120 && y < 150) {
      // The sally: wool in cream and dark blue bands (no red).
      const band = Math.floor((y - 120) / 5) % 2;
      return band ? lit('navy', 0.6, d, 1, 4) : lit('cloth', 0.6, d, 1, 4);
    }
    const twist = (L(X, d) + y * 0.8) % 2 < 0.9;
    return lit('sand', twist ? 0.45 : 0.25, d, 0, 4);
  });
  outlineC(p);
});

/** A louvred opening of the bell chamber (40 × 74): a pointed arch, oak slats, the storm behind. */
reg('decor/oz-tower/louvre', [{ w: 40, h: 74, ox: 0, oy: 0 }], (p) => {
  const d = p.d;
  p.fill(0, 0, 40, 74, (X, Y) => {
    const x = L(X, d) - 20;
    const y = L(Y, d);
    const outer = Math.abs(x) <= 19 && (y > 22 || Math.hypot(Math.abs(x) + 19 - 38, y - 22) <= 38 && y >= 22 - Math.sqrt(Math.max(0, 38 * 38 - (Math.abs(x) + 19) ** 2)));
    const r = 14;
    const inner = Math.abs(x) <= r && y < 70 && (y > 20 || Math.hypot(Math.abs(x) + r - 2 * r, y - 20) <= 2 * r);
    if (inner) {
      // Slats sloping down outward; between them the dark storm with streaks of rain.
      const s = (y + Math.abs(x) * 0.2) % 6;
      if (s < 2.4) return oak(s < 0.7 ? 0.7 : 0.3, d);
      const rain = Math.floor((x + y * 0.3) * 1.5) % 5 === 0;
      return R('night', rain ? 3 : 1, d);
    }
    if (!outer || y > 74) return 0;
    return stone(x < 0 ? 0.55 : 0.2, d);
  });
  outlineC(p);
});

/** Where the bell frame sprite sits (world y of its top) and its size. */
export const TOWER_FRAME_Y = 168;
const FRAME_H = 136;

/** The oak bell frame: an A-trestle under each small bell's bearing, a heavy beam across the top. */
reg('decor/oz-tower/frame', [{ w: TOWER.w - TOWER.wall * 2, h: FRAME_H, ox: 0, oy: 0 }], (p) => {
  const d = p.d;
  const W = TOWER.w - TOWER.wall * 2;
  p.fill(0, 4, W, 8, (X, Y) => oak(((L(Y, d) - 4) / 8 < 0.2 ? 0.75 : 0.32) + grain(X, Y, d, 140), d));
  for (const b of BELLS) {
    if (b.size !== 'small') continue;
    const bx = b.x - TOWER.wall;
    const by = b.y - TOWER_FRAME_Y;
    // The landing under it is 58 px below the bearing.
    const fy = by + 58;
    beam(p, bx - 22, fy - 2, bx - 3, by + 3, 4, 21);
    beam(p, bx + 22, fy - 2, bx + 3, by + 3, 4, 22);
    beam(p, bx - 15, by + 30, bx + 15, by + 30, 3, 23);
    // The bearing block and its iron cap.
    p.fill(bx - 4, by - 1, 8, 6, (_X, Y) => (L(Y, d) - by < 1.5 ? R('steel', 3, d) : oak(0.5, d)));
  }
  outlineC(p);
});

/** The slab under the roof walkway (336 × 16): lead on top, the vault's stone edge, drips. */
reg('decor/oz-tower/roof', [{ w: TOWER.w - TOWER.wall * 2, h: 16, ox: 0, oy: 0 }], (p) => {
  const d = p.d;
  const W = TOWER.w - TOWER.wall * 2;
  p.fill(0, 3, W, 13, (X, Y) => {
    const x = L(X, d);
    const y = L(Y, d) - 3;
    const blk = Math.floor(x / 18);
    if ((x % 18) < 0.7 && d > 1) return R('sandstone', 0, d);
    let l = 0.4 - y * 0.03 + (h2(blk, 2, 3) - 0.5) * 0.15;
    if (y > 10 && fbm(X, Y, d, 2, 17) > 0.6) l -= 0.3;
    return stone(l, d);
  });
  // A drip line of water from the lead's edge.
  for (let x = 12; x < W; x += 37) p.rect(x, 14, 0.6, 2, R('slate', 4, d));
  outlineC(p);
});

/** The walls' cut faces over the wall solids (24 × 120, anchor top centre; the inner face at the right). */
reg('decor/oz-tower/wall', same(3, { w: TOWER.wall, h: 120, ox: TOWER.wall / 2, oy: 0 }), (p, f) => {
  const d = p.d;
  const W = TOWER.wall;
  p.fill(0, 0, W, 120, (X, Y) => {
    const x = L(X, d);
    const y = L(Y, d);
    // The coping and the parapet top (frame 2): a lit cap stone 6 px tall.
    if (f === 2 && y < 6) return y < 1.4 ? stone(0.9, d) : y > 5 ? R('sandstone', 1, d) : stone(0.55 - x * 0.01, d);
    // The inner face (the last 4 px at the right): lit by the tower's lights, ashlar joints.
    const course = Math.floor((y + f * 5) / 12);
    if (x > W - 4) {
      if ((y + f * 5) % 12 < 0.8) return R('sandstone', 1, d);
      return stone(0.5 + (x - (W - 4)) * 0.06 + (h2(course, 9, 4) - 0.5) * 0.12, d);
    }
    // The section through the wall: rubble core, dark.
    const n = fbm(X, Y, d, 2.5, 60 + f);
    if (n > 0.7) return R('sandstone', 2, d);
    return n < 0.3 ? R('r2:soot', 2, d) : R('sandstone', 1, d);
  });
});

/** The stone floor's cut face under the heroes' feet (384 × 24). */
reg('decor/oz-tower/floor', [{ w: TOWER.w, h: 24, ox: 0, oy: 0 }], (p) => {
  const d = p.d;
  p.fill(0, 0, TOWER.w, 24, (X, Y) => {
    const x = L(X, d);
    const y = L(Y, d);
    if (y < 1.2) return stone(0.85, d);
    const flag = Math.floor(x / 28);
    if (y < 5) return (x % 28) < 0.8 ? R('sandstone', 1, d) : stone(0.5 + (h2(flag, 1, 8) - 0.5) * 0.2, d);
    if (y < 6) return R('ink', 1, d);
    return fbm(X, Y, d, 3, 81) > 0.6 ? R('sandstone', 2, d) : R('sandstone', 1, d);
  });
});

void sstep;
