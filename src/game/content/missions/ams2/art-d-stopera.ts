/**
 * The Stopera of section d at sunset (docs/design/ams2.md §3), one long drawing on the middle plane:
 * the curved theatre, the red-brick city hall wing with its stair tower, a second, lower curved wing,
 * and the entrance block with the big glass doors the boss steps out of. A wall never runs longer
 * than one bay of the same kind, so the eye does not catch a repeat.
 *
 * Canvas x is band x on the plane `S_BLD`. All rows are the rows of the view: the plane stands on row
 * 150 and the far floor band covers it from row 143 on.
 */
import { addMargin, rectMask, S, kitTier, text, textW } from '../../../art/herokit/canvas';
import { pyRound } from '../../../art/herokit/canvas-math';
import { cornice, slateRoof, wallBlock } from '../../../art/herokit/masonry';
import { KM, K, R } from '../../../art/herokit/palette';
import { tube } from '../../../art/herokit/props';
import { rngf } from '../../../art/herokit/rng';
import { window_ } from '../../../art/herokit/walls';

/** The speed of the Stopera's plane. */
export const S_BLD = 0.62;
/** Width of the plane: past the right edge of the view at the locked camera (896 · S_BLD + 384 = 939.52). */
export const MID_W = 960;
/** Rows of the band. */
export const MID_ROWS: readonly [number, number] = [0, 152];
/** The foot row of the plane. */
const FOOT = 150;

/** The centre of the glass doors on the plane: screen x 294 at the locked camera 896, as `DOORS_X` − 896. */
export const DOOR_BAND_X = Math.round(294 + 896 * S_BLD);

const frac = (v: number): number => v - Math.floor(v);

interface DrumOpts {
  /** The storeys of glass and marble. */
  st: number;
  /** The height of one storey. */
  sh: number;
  /** The height of a marble band. */
  mb: number;
  /** The fly tower behind (the theatre has one). */
  tower: boolean;
  /** The columns under the lowest ring. */
  columns: number;
}

/** Curved rings of marble and glass round a drum, lit from the right, every band a hard tone. */
function drum(W: number, H: number, seed: number, o: DrumOpts): S {
  const s = new S(W, H);
  const r = rngf(seed);
  const cx = W * 0.5;
  const Rd = W * 0.44;
  const { st, sh, mb } = o;
  const h0 = H - 14;
  const fine = kitTier() >= 2;
  const [m0, m1, m2, m3] = R.marble;
  const [g0, g1, g2, g3] = R.glass;
  const ring = (n: number, u: number): number => h0 - n * sh + u * u * (n * 9.5 + 3) + (1 - Math.sqrt(Math.max(1 - u * u, 0))) * (n * 5);
  if (o.tower) {
    const tx0 = Math.trunc(W * 0.3);
    const tx1 = Math.trunc(W * 0.7);
    const top = h0 - st * sh - 22;
    const ft = Math.max(top - 14, 0);
    const [ra, rb, rc, rd] = R.roof;
    s.use(5, 0.5);
    s.rect(rb, tx0, ft, tx1 - tx0, 46);
    for (let x = tx0; x < tx1; x += 9) {
      s.vl(rd, x, ft + 2, 44);
      s.vl(x > (tx0 + tx1) / 2 ? ra : rc, x + 1, ft + 2, 44);
    }
    s.rect(rc, tx0, ft + 2, 8, 44);
    s.use(6, 0.6);
    s.hl(m0, tx0 - 1, ft, tx1 - tx0 + 2);
    s.hl(m2, tx0 - 1, ft + 1, tx1 - tx0 + 2);
    s.hl(m3, tx0 - 1, ft + 2, tx1 - tx0 + 2);
  }
  for (let x = 0; x < W; x++) {
    const u = (x - cx) / Rd;
    if (Math.abs(u) >= 1) continue;
    const a = Math.asin(u);
    const lit = u > 0.32 ? 0 : u > -0.38 ? 1 : 2;
    for (let n = st; n > 0; n--) {
      const y0 = Math.trunc(pyRound(ring(n, u)));
      const y1 = Math.trunc(pyRound(ring(n - 1, u)));
      for (let y = y0; y < Math.min(y1, H); y++) {
        if (y < 0) continue;
        const i = y * W + x;
        const j = y - y0;
        if (j < mb) {
          let tone = j === 0 ? (lit === 0 ? m0 : m1) : j < mb - 3 ? (lit === 0 ? m1 : m2) : j < mb - 1 ? (lit < 2 ? m2 : m3) : m3;
          if (frac(a * 30) < 0.06 && j > 0 && j < mb - 1) tone = lit === 2 || fine ? m3 : m2;
          s.c[i] = tone;
          s.p[i] = 20 + n;
          s.z[i] = 2;
        } else {
          const gy = j - mb;
          const q = (x * 0.6 + y * 1.2 + n * 23) % 47;
          let tone = gy < 2 ? g3 : g2;
          if (q < 6) tone = g1;
          if (q < 2) tone = g0;
          const f = frac(a * 18);
          if (gy === 5 && f > 0.3 && f < 0.75) tone = R.glow[1];
          // The finer tiers: a glazing bar through each storey.
          if (fine && gy === sh - mb - 9) tone = lit === 2 ? g3 : m3;
          if (f < Math.max(0.1, 0.1 / Math.max(Math.cos(a), 0.3))) tone = lit === 0 ? m1 : lit === 1 ? m2 : m3;
          s.c[i] = tone;
          s.p[i] = 30 + n;
          s.z[i] = 1;
        }
      }
    }
    // The top cornice.
    const yt = Math.trunc(pyRound(ring(st, u)));
    for (let y = yt - 2; y < yt; y++) {
      if (y >= 0) {
        const i = y * W + x;
        s.c[i] = lit < 2 ? m0 : m1;
        s.p[i] = 25;
        s.z[i] = 2.5;
      }
    }
    for (let y = h0; y < H; y++) {
      const i = y * W + x;
      s.c[i] = R.hull[3];
      s.p[i] = 40;
      s.z[i] = 0.8;
    }
  }
  // People behind the glass.
  for (let n = 1; n <= st; n++) {
    for (let k = 0; k < 9; k++) {
      const a = r.uniform(-1.1, 1.1);
      const x = Math.trunc(cx + Math.sin(a) * Rd);
      const u = (x - cx) / Rd;
      const yb = Math.trunc(pyRound(ring(n - 1, u)));
      for (let q = x; q < x + 2; q++) {
        for (let y = yb - 6; y < yb; y++) {
          if (q >= 0 && q < W && s.p[y * W + q] === 30 + n) s.c[y * W + q] = R.hull[3];
        }
      }
      if (s.p[(yb - 7) * W + x] === 30 + n) {
        s.c[(yb - 7) * W + x] = R.hull[3];
        s.c[(yb - 7) * W + x + 1] = R.hull[3];
      }
    }
  }
  for (let k = 0; k < o.columns; k++) {
    const a = -1.2 + (2.4 * k) / (o.columns - 1);
    const x = Math.trunc(cx + Math.sin(a) * Rd);
    const w = Math.max(3, Math.trunc(7 * Math.cos(a)));
    s.use(50 + Math.trunc(a * 10), 3);
    tube(s, 'marble', x, h0, w, H - h0);
  }
  s.use(70, 3.5);
  for (let x = 0; x < W; x++) {
    const u = (x - cx) / Rd;
    if (Math.abs(u) < 1) {
      s.px(R.stone[1], x, H - 2);
      s.px(R.stone[3], x, H - 1);
    }
  }
  return s;
}

/** The roof of a lower curved wing: slates that follow its top ring, a hard lit side. */
function drumCap(s: S, st: number, sh: number): void {
  const W = s.w;
  const cx = W * 0.5;
  const Rd = W * 0.44;
  const h0 = s.h - 14;
  const [a, b, c, d] = R.roof;
  for (let x = 0; x < W; x++) {
    const u = (x - cx) / Rd;
    if (Math.abs(u) >= 0.97) continue;
    const yt = Math.trunc(pyRound(h0 - st * sh + u * u * (st * 9.5 + 3) + (1 - Math.sqrt(Math.max(1 - u * u, 0))) * (st * 5))) - 2;
    const lift = Math.trunc(pyRound(9 * Math.sqrt(Math.max(1 - u * u, 0))));
    for (let k = 1; k <= lift; k++) {
      const y = yt - k;
      if (y < 0) continue;
      const i = y * W + x;
      const row = k % 3 === 0;
      const tone = k === lift ? (u > 0 ? a : b) : row ? d : u > 0.32 ? b : u > -0.38 ? c : d;
      s.c[i] = tone;
      s.p[i] = 19;
      s.z[i] = 0.7;
    }
  }
}

/** A marble poster case with a poster and three lines of text. */
function poster(s: S, x: number, y: number, col: string, part: number): void {
  s.use(part, 3);
  s.rect(R.pole[2], x, y, 11, 17);
  s.rect(R.cloth[0], x + 1, y + 1, 9, 15);
  s.rect(R[col][1], x + 2, y + 2, 7, 3);
  for (let j = 0; j < 3; j++) s.hl(K, x + 2, y + 7 + j * 3, 4 + j);
}

/** A round-headed ground-floor bay in a marble frame: glass, a blind, a lamp inside. */
function arcadeBay(s: S, x: number, y: number, w: number, h: number, part: number, seed: number): void {
  const [m0, m1, m2, m3] = R.marble;
  const [g0, g1, g2, g3] = R.glass;
  const r = rngf(seed);
  s.use(part, 3);
  const ah = w >> 1;
  for (let i = 0; i < w; i++) {
    const u = ((i + 0.5) / w) * 2 - 1;
    const top = y + Math.trunc(pyRound((1 - Math.sqrt(Math.max(1 - u * u, 0))) * ah));
    s.rect(i >= w / 2 ? m1 : m2, x + i, top, 1, y + h - top);
    s.px(i >= w / 2 ? m0 : m1, x + i, top);
  }
  s.vl(m3, x, y + ah, h - ah);
  s.vl(m0, x + w - 1, y + ah, h - ah);
  s.use(part + 1, 3.2);
  const gw = w - 6;
  const gx = x + 3;
  for (let i = 0; i < gw; i++) {
    const u = ((i + 0.5) / gw) * 2 - 1;
    const top = y + 3 + Math.trunc(pyRound((1 - Math.sqrt(Math.max(1 - u * u, 0))) * (gw >> 1)));
    s.rect(g2, gx + i, top, 1, y + h - top);
    s.px(g3, gx + i, top);
  }
  const lit = r.int(0, 3);
  if (lit === 0) s.rect(R.lit[1], gx + 2, y + h - 12, gw - 4, 5);
  s.line(g1, gx + gw - 2, y + (gw >> 1) + 1, gx + 2, y + h - 3);
  s.line(g0, gx + gw - 2, y + (gw >> 1) + 4, gx + 5, y + h - 3);
  s.vl(m2, x + (w >> 1), y + 3, h - 3);
  s.hl(m3, x, y + h - 1, w);
}

/** A long banner on the wall: the three crosses. */
function banner(s: S, x: number, y: number, w: number, h: number, part: number): void {
  const [c0, c1, c2] = R.dred;
  s.use(part, 3.6);
  s.rect(c1, x, y, w, h);
  s.vl(c2, x, y, h);
  s.vl(c0, x + w - 1, y, h);
  s.rect(R.hull[2], x + (w >> 1) - 2, y, 4, h);
  for (let k = 0; k < 3; k++) {
    const cy = y + 9 + k * Math.floor((h - 18) / 2);
    for (let d = -2; d <= 2; d++) {
      s.px(R.xw[0], x + (w >> 1) + d, cy + d);
      s.px(R.xw[0], x + (w >> 1) - d, cy + d);
    }
  }
  s.hl(R.pole[1], x - 1, y - 1, w + 2);
  for (let i = 0; i < w; i += 2) s.px(c2, x + i, y + h);
}

/** The window of the wall with its lintel and the shade it throws, as the reference's city hall. */
function hallWindow(s: S, x: number, y: number, w: number, h: number, part: number, r: ReturnType<typeof rngf>, o: { mat?: string; arch?: boolean; lintel?: boolean } = {}): void {
  const mat = R[o.mat ?? 'brickr'];
  s.retone(rectMask(s.h, s.w, x - 1, y + 1, w + 1, h + 1), [
    [mat[1], mat[2]],
    [mat[0], mat[1]],
  ]);
  window_(s, x, y, w, h, r, part, { z: 3, arch: o.arch });
  if (o.lintel !== false) {
    s.use(part + 2, 2.5);
    s.hl(R.stone[0], x - 1, y - 2, w + 2);
    s.hl(R.stone[2], x - 1, y - 1, w + 2);
  }
}

/** Stones along the foot of a wall. */
function footStones(s: S, H: number): void {
  s.use(11, 3);
  s.rect(R.stone[1], 0, H - 6, s.w, 6);
  s.hl(R.stone[0], 0, H - 6, s.w);
  s.hl(R.stone[3], 0, H - 1, s.w);
  for (let x = 0; x < s.w; x += 11) s.vl(R.stone[3], x, H - 5, 4);
}

/** Small things of the finer tiers on a wall: anchors, a downpipe, a street plate. */
function wallExtras(s: S, top: number, H: number, xs: readonly number[], pipeX: number): void {
  if (kitTier() < 2) return;
  s.use(90, 2.2);
  for (const x of xs) {
    for (const y of [top + 5, top + 33, top + 61]) {
      if (y >= H) continue;
      s.px(R.iron[3], x, y - 1);
      s.px(R.iron[3], x, y + 1);
      s.px(R.hull[3], x, y);
      s.px(R.hull[3], x - 1, y);
      s.px(R.hull[3], x + 1, y);
    }
  }
  s.use(91, 2.4);
  tube(s, 'hull', pipeX, top + 2, 2, H - top - 8);
}

/** The city hall wing of the reference from its rows: windows, ground-floor bays, a stair tower. */
function hallWing(W: number, H: number, seed: number): S {
  const s = new S(W, H);
  const r = rngf(seed);
  const top = H - 126;
  wallBlock(s, 0, top, W, H - top, 'brickr', 1, 1, seed);
  cornice(s, 0, top, W, 2, 2);
  let pid = 10;
  for (let y = top + 9; y < H - 58; y += 28) {
    for (let x = 10; x < W - 14; x += 28) {
      hallWindow(s, x, y, 16, 20, pid, r);
      pid += 3;
    }
  }
  // The foot of the wing: stone, posters, four bays in marble.
  const dx = (W >> 1) - 44;
  footStones(s, H);
  [
    [dx - 34, 'dred'],
    [dx - 20, 'navy'],
    [dx + 94, 'yellow'],
    [dx + 110, 'dred'],
  ].forEach(([x, col], i) => poster(s, x as number, H - 36, col as string, 120 + i));
  for (let i = 0; i < 4; i++) arcadeBay(s, dx + i * 23 - 2, H - 46, 19, 40, 130 + i * 2, seed + i);
  // A belt of stone over the ground floor.
  s.use(150, 2.5);
  s.hl(R.stone[0], dx - 6, H - 50, 100);
  s.hl(R.stone[2], dx - 6, H - 49, 100);
  // The stair tower: higher, darker, one tall strip of glass.
  const tx = W - 76;
  const tw = 40;
  const ty = top - 15;
  wallBlock(s, tx, ty, tw, H - ty - 6, 'brickd', 160, 2.7, seed + 9);
  cornice(s, tx - 1, ty, tw + 2, 161, 2.9);
  s.use(162, 3);
  const g = R.glass;
  s.rect(g[2], tx + 12, ty + 10, 16, H - ty - 26);
  s.vl(g[3], tx + 12, ty + 10, H - ty - 26);
  for (let q = ty + 10; q < H - 16; q += 6) s.hl(R.pole[2], tx + 12, q, 16);
  for (let q = 0; q < 6; q++) s.line(g[1], tx + 27 - q, ty + 16 + q * 18, tx + 15 - q, ty + 30 + q * 18);
  s.vl(R.pole[1], tx + 20, ty + 10, H - ty - 26);
  s.use(163, 3.1);
  s.rect(R.marble[1], tx + 10, H - 16, 20, 3);
  s.hl(R.marble[0], tx + 10, H - 16, 20);
  wallExtras(s, top, H, [24, 136, 192], 94);
  const o = addMargin(s);
  o.finish(KM);
  return o;
}

/** The low wing left of the doors: two rows of narrow windows under a slate roof. Over it stands the sun at the locked camera. */
function lowWing(W: number, H: number, seed: number): S {
  const s = new S(W, H);
  const r = rngf(seed);
  const top = 88;
  slateRoof(
    s,
    [
      [2, top],
      [8, top - 9],
      [W - 1, top - 9],
      [W - 1, top],
    ],
    seed,
    2,
    0.8,
  );
  wallBlock(s, 0, top, W, H - top, 'brickr_1', 1, 1, seed);
  cornice(s, 0, top, W, 3, 2);
  let pid = 10;
  for (const y of [top + 9, top + 33]) {
    for (let x = 7; x < W - 12; x += 22) {
      hallWindow(s, x, y, 12, 17, pid, r, { mat: 'brickr_1', arch: y === top + 9 });
      pid += 3;
    }
  }
  footStones(s, H);
  s.use(50, 2.5);
  s.hl(R.stone[0], 0, top + 56, W);
  s.hl(R.stone[2], 0, top + 57, W);
  poster(s, 8, H - 26, 'navy', 60);
  poster(s, 22, H - 26, 'yellow', 61);
  poster(s, 58, H - 26, 'dred', 62);
  poster(s, 72, H - 26, 'navy', 63);
  wallExtras(s, top, H - 30, [40, 62], 3);
  const o = addMargin(s);
  o.finish(KM);
  return o;
}

/** The entrance: marble piers, a marble beam with its name, a canopy, four big glass doors. Centre x = W / 2. */
function entrance(W: number, H: number, seed: number): S {
  const s = new S(W, H);
  const r = rngf(seed);
  const [m0, m1, m2, m3] = R.marble;
  const g = R.glass;
  const top = 78;
  const pier = 8;
  const dx = pier;
  const dw = W - 2 * pier;
  const gt = top + 24;
  // The glass.
  s.use(6, 2);
  s.rect(g[3], dx, gt, dw, H - gt);
  // The hall behind the glass: its far wall, lamps in a row, a stair, a lit desk, people.
  s.use(7, 2);
  const floorY = H - 16;
  s.rect(g[2], dx, gt + 8, dw, floorY - gt - 8);
  s.hl(g[1], dx, gt + 8, dw);
  s.rect(R.hull[3], dx, floorY, dw, H - floorY);
  s.hl(R.hull[1], dx, floorY, dw);
  for (let x = dx + 4; x < dx + dw - 4; x += 9) {
    s.rect(R.lit[0], x, gt + 4, 4, 1);
    s.px(R.lit[1], x + 1, gt + 5);
  }
  for (let k = 0; k < 9; k++) s.rect(R.hull[2], dx + 6 + k * 3, floorY - 3 - k * 3, 30 - k * 3, 3);
  s.line(R.pole[2], dx + 5, floorY - 11, dx + 30, floorY - 36);
  // The desk under a warm light, right of the middle: what stays in view beside the boss.
  const desk = dx + 60;
  const dy = floorY - 28;
  s.rect(R.lit[1], desk, dy, 32, 19);
  s.hl(R.lit[0], desk + 1, dy, 30);
  s.rect(R.lit[0], desk + 19, dy + 2, 11, 5);
  s.vl(R.lit[2], desk, dy, 19);
  s.vl(R.lit[2], desk + 10, dy + 1, 18);
  s.rect(R.white[0], desk + 2, dy + 4, 15, 7);
  s.hl(R.white[2], desk + 2, dy + 10, 15);
  text(s, 'INFO', desk + 3, dy + 5, K, 0);
  s.rect(R.wood[1], desk - 2, floorY - 9, 36, 9);
  s.hl(R.wood[0], desk - 2, floorY - 9, 36);
  s.hl(R.wood[3], desk - 2, floorY - 1, 36);
  for (let x = desk + 2; x < desk + 32; x += 8) s.vl(R.wood[2], x, floorY - 8, 7);
  for (let x = dx + 5; x < dx + dw - 5; x += 13 + r.int(0, 7)) {
    const hh = 13 + r.int(0, 3);
    s.rect(R.hull[3], x, floorY - hh + 2, 4, 5);
    s.rect(R.hull[3], x, floorY - hh + 7, 1, hh - 7);
    s.rect(R.hull[3], x + 2, floorY - hh + 7, 2, hh - 7);
    s.rect(R.hull[3], x + 1, floorY - hh, 2, 2);
  }
  // Long reflections, not two alike.
  const refl: ReadonlyArray<readonly [number, number]> = [
    [20, 40],
    [31, 22],
    [58, 46],
    [84, 20],
    [93, 18],
  ];
  for (const [x0, len] of refl) {
    const ly = gt + 11;
    s.line(g[0], dx + x0, ly, dx + x0 - (len >> 1), ly + len);
    s.line(g[1], dx + x0 + 2, ly, dx + x0 + 2 - (len >> 1), ly + len);
  }
  // The frames.
  s.use(8, 3.5);
  for (let x = dx; x <= dx + dw; x += 25) tube(s, 'pole', x - 1, gt, 3, H - gt);
  s.rect(R.pole[1], dx, gt + 18, dw, 2);
  s.hl(R.pole[0], dx, gt + 18, dw);
  s.hl(R.pole[3], dx, gt + 20, dw);
  // Handles.
  s.use(9, 3.8);
  for (let x = dx; x < dx + dw; x += 50) {
    s.rect(R.brass[1], x + 23, H - 40, 1, 10);
    s.vl(R.brass[0], x + 26, H - 40, 10);
  }
  // The piers: the left in shade, the right lit.
  s.use(10, 3);
  for (const x of [0, W - pier]) {
    const lit = x > 0;
    s.rect(lit ? m1 : m2, x, top, pier, H - top);
    s.vl(lit ? m0 : m1, x + pier - 1, top, H - top);
    s.vl(m3, x, top, H - top);
    for (let y = top + 8; y < H; y += 12) s.hl(lit ? m2 : m3, x, y, pier);
  }
  // The beam with the name.
  s.use(11, 3.2);
  s.rect(m1, 0, top, W, 16);
  s.hl(m0, 0, top, W);
  s.hl(m3, 0, top + 15, W);
  s.vl(m0, W - 1, top, 16);
  s.vl(m3, 0, top, 16);
  for (let x = 2; x < W - 2; x += 7) s.px(m2, x, top + 1);
  const msg = 'STADHUIS';
  s.use(12, 3.4);
  s.rect(m0, (W >> 1) - 22, top + 3, 44, 10);
  s.hl(m2, (W >> 1) - 22, top + 12, 44);
  text(s, msg, (W >> 1) - (textW(msg) >> 1), top + 6, K);
  // The canopy over the doors.
  s.use(13, 3.8);
  s.rect(m1, 2, top + 16, W - 4, 4);
  s.hl(m0, 2, top + 16, W - 4);
  s.hl(m3, 2, top + 19, W - 4);
  s.use(14, 2.2);
  s.rect(g[3], dx, top + 20, dw, 4);
  s.hl(R.hull[3], dx, top + 20, dw);
  // Lamps on the piers.
  s.use(15, 3.6);
  for (const x of [2, W - pier + 2]) {
    s.rect(R.brass[2], x, top + 28, 4, 2);
    s.rect(R.lit[0], x, top + 30, 4, 5);
    s.hl(R.lit[2], x, top + 34, 4);
    s.vl(R.lit[1], x, top + 30, 5);
  }
  const o = addMargin(s);
  o.finish(KM);
  return o;
}

/** The tall block right of the doors. */
function tallBlock(W: number, H: number, seed: number): S {
  const s = new S(W, H);
  const r = rngf(seed);
  const top = H - 126;
  wallBlock(s, 0, top, W, H - top, 'brickr_2', 1, 1, seed);
  cornice(s, 0, top, W, 2, 2);
  let pid = 10;
  for (let y = top + 9; y < H - 30; y += 28) {
    for (let x = 18; x < W - 4; x += 26) {
      hallWindow(s, x, y, 16, 20, pid, r, { mat: 'brickr_2' });
      pid += 3;
    }
  }
  footStones(s, H);
  banner(s, 2, top + 8, 11, 70, 80);
  wallExtras(s, top, H - 30, [37], 15);
  const o = addMargin(s);
  o.finish(KM);
  return o;
}

/** The windows of the hall wing on its own canvas (they go on and off: section-d.ts). */
export const WING_WINDOWS: ReadonlyArray<readonly [number, number]> = (() => {
  const out: Array<readonly [number, number]> = [];
  for (let y = 59; y < 118; y += 28) for (let x = 10; x < 286; x += 28) out.push([x, y]);
  return out;
})();

/** The band's canvas. */
export function paintStopera(): S {
  const md = new S(MID_W, 216);
  // The joint between the theatre and the hall wing: dark at street level.
  md.use(1, 0.2);
  md.rect(R.hull[3], 330, 130, 20, 22);
  const th = drum(400, 150, 341, { st: 3, sh: 29, mb: 8, tower: true, columns: 13 });
  const tho = addMargin(th);
  tho.finish(KM);
  md.paste(tho, -40, 2);
  md.paste(hallWing(300, 176, 342), 340, FOOT - 176);
  // The lower curved wing wraps the end of the hall wing.
  const f = drum(158, 124, 343, { st: 3, sh: 25, mb: 7, tower: false, columns: 7 });
  drumCap(f, 3, 25);
  const fo = addMargin(f);
  fo.finish(KM);
  md.paste(fo, 556, FOOT - 124);
  const doorLeft = DOOR_BAND_X - 58;
  const low = lowWing(doorLeft - 700 + 4, 176, 344);
  md.paste(low, 700, FOOT - 176);
  const ent = entrance(116, 176, 345);
  md.paste(ent, doorLeft - 1, FOOT - 176);
  const tall = tallBlock(MID_W - doorLeft - 116 + 2, 176, 346);
  md.paste(tall, doorLeft + 116, FOOT - 176);
  return md;
}
