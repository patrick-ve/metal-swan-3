/**
 * Crate sprites (GDD §7.1: a 24×20 wooden supply crate with rope bands and a white swan
 * stencil). All feet-anchored (they rest on the ground) unless noted.
 *
 * - `item/crate` (1 frame), `item/crate-hit` (2: squash, recover), `item/crate-break` (4: it
 *   bursts, planks fly, settle);
 * - `item/crate-legion` (+ `-hit`, `-break`): a captured Legion crate, crimson planks with brass
 *   straps and a white note stencil (crate param `variant: 'legion'`);
 * - `item/crate-chute` (2, anchor = bottom centre on the crate's top edge): the supply parachute
 *   with its four lines; `item/crate-chute-fold` (5, centre anchor): the canopy collapses and
 *   drifts away when the crate lands or breaks.
 *
 * HD art (2× and 4×, mission ams): the supply crate, its hit and break strips (`crateStripHd`).
 */
import { ascii } from '../../../engine/ascii';
import type { Color } from '../../../engine/color';
import { PixelBuffer, type Ramp } from '../../../engine/pixel';
import { INK, PAL } from '../../../engine/palette';
import type { Frame } from '../../../engine/render';
import { PAL_HD } from '../../../engine/palette-hd';
import { defineHdSprite, defineSprite } from '../../../engine/sprites';
import { wood as woodTex } from '../../art/hd/index';
import { hdStrip, type HdCanvas } from '../fx/hd/kit';
import { hash2 } from '../../art/paint';

/** Crate size including the outline (GDD §7.1). */
export const CRATE_W = 24;
export const CRATE_H = 20;

/** The swan stencil (9×7, beak to the right): an S-neck, a boat-shaped body, the tail up. */
const SWAN = [
  '......##.',
  '......###',
  '.....##..',
  '#....#...',
  '##..##...',
  '#######..',
  '.#####...',
];

/** The swan stencil drawn on a half-px grid (18 × 14: a rounder S-neck and head) for the HD crate. */
const SWAN_HD = [
  '............###...',
  '...........#####..',
  '...........#######',
  '...........###....',
  '..........###.....',
  '..........##......',
  '#.........##......',
  '##........##......',
  '###......###......',
  '####....####......',
  '#############.....',
  '##############....',
  '.############.....',
  '...#########......',
];

/** The Legion's note stencil (an eighth note, 5×7). */
const NOTE = ['..##.', '..#.#', '..#..', '..#..', '###..', '###..', '.#...'];

interface CrateLook {
  /** Planks. */
  wood: Ramp;
  /** Bands round the crate (rope or brass straps). */
  band: Ramp;
  /** Stencil colour and shape. */
  mark: Color;
  stencil: readonly string[];
  /** Bands are twisted rope (true) or flat straps with rivets. */
  rope: boolean;
}

const SUPPLY: CrateLook = { wood: PAL.brown, band: PAL.sand, mark: PAL.snow[2], stencil: SWAN, rope: true };
const LEGION: CrateLook = { wood: PAL.red, band: PAL.brass, mark: PAL.snow[2], stencil: NOTE, rope: false };

/** x of the two bands from the crate's left edge (inside the outline). */
const BAND_X = [4, 17] as const;

/**
 * The crate (24×20 with outline). `squash` widens and flattens it (hit frames), `cracks` adds
 * split seams (the bursting frame).
 */
function crateBuf(look: CrateLook, squash = 0, cracks = 0): PixelBuffer {
  const w = CRATE_W - 2 + squash;
  const h = CRATE_H - 2 - squash;
  const b = new PixelBuffer(w + 2, h + 2);
  const wd = look.wood;
  // Lid (lit top face, 3 px) and the front face.
  b.rect(1, 1, w, 3, wd[3]);
  b.hline(1, w, 1, look === LEGION ? wd[3] : PAL.sand[2]);
  b.rect(1, 4, w, h - 3, wd[2]);
  b.hline(1, w, 4, wd[1]);
  // Planks: dark seams with a lit row under each, and the two frame boards at the sides.
  for (let y = 9; y < h; y += 5) {
    b.hline(3, w - 2, y, wd[1]);
    b.hline(3, w - 2, y + 1, wd[3]);
  }
  b.rect(1, 5, 2, h - 4, wd[3]);
  b.rect(w - 1, 5, 2, h - 4, wd[1]);
  b.hline(1, w, h, wd[0]);
  // Nail heads at the plank ends.
  for (let y = 7; y < h; y += 5) {
    b.set(3, y, wd[0]);
    b.set(w - 2, y, wd[0]);
  }
  // Stencil in the middle, between the bands.
  const st = ascii(look.stencil, { '#': look.mark });
  b.blit(st, Math.floor((w + 2 - st.w) / 2), 6 + Math.max(0, Math.floor((h - 18) / 2)));
  // Bands: over the lid and down the front.
  const bx0 = Math.round((BAND_X[0] * w) / 22);
  const bx1 = Math.round((BAND_X[1] * w) / 22);
  for (const bx of [bx0, bx1]) drawBand(b, look, bx, h);
  // A knot on the left band (rope) or a buckle (straps).
  if (look.rope) {
    b.rect(bx0 - 1, 4, 4, 3, look.band[2]);
    b.set(bx0 - 1, 4, look.band[3]);
    b.set(bx0 + 2, 6, look.band[1]);
    b.set(bx0 + 1, 7, look.band[1]);
    b.set(bx0 + 1, 8, look.band[1]);
  } else {
    b.rect(bx0 - 1, 9, 4, 3, PAL.steel[3]);
    b.set(bx0, 10, PAL.steel[1]);
    b.set(bx0 + 1, 10, PAL.steel[1]);
  }
  // Cracks for the bursting frame (deterministic).
  for (let i = 0; i < cracks; i++) {
    let x = 5 + Math.floor(hash2(i, 1, 9) * (w - 8));
    let y = 5;
    for (let k = 0; k < h - 6; k++) {
      b.set(x, y, wd[0]);
      y++;
      if (hash2(i, k, 4) > 0.6) x += hash2(k, i, 2) > 0.5 ? 1 : -1;
    }
  }
  return b.outline(INK);
}

/** One band (2 px wide) from the lid's back edge to the crate's bottom. */
function drawBand(b: PixelBuffer, look: CrateLook, x: number, h: number): void {
  const r = look.band;
  for (let y = 1; y <= h; y++) {
    if (look.rope) {
      // Twisted rope: the light strand crosses over every 2 px.
      const tw = (y >> 1) & 1;
      b.set(x, y, tw ? r[3] : r[2]);
      b.set(x + 1, y, tw ? r[1] : r[2]);
    } else {
      b.set(x, y, r[2]);
      b.set(x + 1, y, r[1]);
    }
  }
  if (!look.rope) for (const y of [2, h - 1]) b.set(x, y, r[3]);
}

/** A loose plank for the breaking frames. */
function plank(look: CrateLook, len: number, vertical: boolean): PixelBuffer {
  const wd = look.wood;
  const b = new PixelBuffer(vertical ? 5 : len + 2, vertical ? len + 2 : 5);
  if (vertical) {
    b.rect(1, 1, 3, len, wd[2]);
    b.vline(1, 1, len, wd[3]);
    b.vline(3, 1, len, wd[1]);
  } else {
    b.rect(1, 1, len, 3, wd[2]);
    b.hline(1, len, 1, wd[3]);
    b.hline(1, len, 3, wd[1]);
  }
  return b.outline(INK);
}

/** A short bit of band (rope or strap) for the breaking frames. */
function bandBit(look: CrateLook, len: number): PixelBuffer {
  const b = new PixelBuffer(len + 2, 4);
  for (let x = 1; x <= len; x++) {
    b.set(x, 1, ((x >> 1) & 1) === 0 || !look.rope ? look.band[3] : look.band[2]);
    b.set(x, 2, look.band[1]);
  }
  return b.outline(INK);
}

function idleFrames(look: CrateLook): Frame[] {
  const b = crateBuf(look);
  return [{ buf: b, ox: CRATE_W >> 1, oy: CRATE_H }];
}

function hitFrames(look: CrateLook): Frame[] {
  // Squash and recover (the game adds the white flash).
  const s = crateBuf(look, 2, 0);
  return [
    { buf: s, ox: (s.w >> 1), oy: s.h },
    { buf: crateBuf(look), ox: CRATE_W >> 1, oy: CRATE_H },
  ];
}

/** Break frames 1–3: [x, y (top-left from the anchor), length, vertical] per plank. */
const BREAK_PLANKS: ReadonlyArray<ReadonlyArray<readonly [number, number, number, boolean]>> = [
  [[-15, -24, 13, false], [-2, -28, 11, false], [-17, -16, 10, true], [10, -17, 10, true], [-9, -10, 15, false], [4, -21, 7, false]],
  [[-21, -27, 13, false], [-1, -33, 11, false], [-23, -13, 10, true], [15, -13, 10, true], [-10, -7, 15, false], [9, -25, 7, false]],
  [[-24, -5, 13, false], [-7, -6, 11, false], [-26, -9, 10, true], [17, -9, 10, true], [4, -5, 15, false], [13, -5, 7, false]],
];

/** Break frames 1–3: top-left of the two band bits. */
const BREAK_BITS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[-8, -30], [6, -12]],
  [[-12, -38], [12, -8]],
  [[-14, -4], [20, -4]],
];
/** Break frame size (anchor at the bottom centre, x 33). */
const BREAK_W = 66;
const BREAK_H = 42;

/** It bursts: split seams, then planks, bands and the stencilled board fly apart and settle. */
function breakFrames(look: CrateLook): Frame[] {
  const out: Frame[] = [];
  const burst = crateBuf(look, 1, 3);
  out.push({ buf: burst, ox: burst.w >> 1, oy: burst.h });
  const W = BREAK_W;
  const H = BREAK_H;
  BREAK_PLANKS.forEach((lay, i) => {
    const b = new PixelBuffer(W, H);
    for (const [x, y, len, v] of lay) b.blit(plank(look, len, v), 33 + x, H + y);
    for (const [x, y] of BREAK_BITS[i]) b.blit(bandBit(look, 7), 33 + x, H + y);
    out.push({ buf: b, ox: 33, oy: H });
  });
  return out;
}

// ------------------------------------------------------------------------------------ parachute

/**
 * The supply parachute: an ivory canopy with olive gores and four lines down to the crate's
 * top corners. Anchor: bottom centre = the middle of the crate's top edge. `phase` 1 breathes
 * (the canopy flattens by a pixel and the hem swings out).
 */
function chuteBuf(phase: number): Frame {
  const cw = 30;
  const ch = 12 - phase;
  const lines = 16;
  const W = cw + 2;
  const H = ch + lines + 1;
  const b = new PixelBuffer(W, H);
  // Canopy: the upper half of an ellipse with a scalloped hem.
  const dome = new PixelBuffer(W, ch + 2);
  dome.ellipse(1, 1, cw, ch * 2, PAL.snow[2]);
  for (let y = ch + 1; y < dome.h; y++) for (let x = 0; x < W; x++) dome.set(x, y, 0);
  for (let y = 1; y <= ch; y++) {
    for (let x = 1; x <= cw; x++) {
      if ((dome.get(x, y) & 255) === 0) continue;
      const gore = Math.floor(((x - 1) / cw) * 5);
      if (gore % 2 === 1) dome.set(x, y, y < 4 ? PAL.olive[3] : PAL.olive[2]);
      else dome.set(x, y, y < 4 ? PAL.snow[3] : PAL.snow[2]);
    }
  }
  // Hem shadow and scallops.
  for (let x = 1; x <= cw; x++) {
    if ((dome.get(x, ch) & 255) === 0) continue;
    const g = Math.floor(((x - 1) / cw) * 5) % 2 === 1;
    dome.set(x, ch, g ? PAL.olive[1] : PAL.snow[1]);
  }
  dome.outline(INK);
  // Lines from the hem to the crate's top corners (x ±11) and two inner ones.
  const cx = W >> 1;
  const top = ch + 1;
  const bottom = H - 1;
  const lineColor = PAL.stone[3];
  b.line(2, top, cx - 11, bottom, lineColor);
  b.line(W - 3, top, cx + 10, bottom, lineColor);
  b.line(cx - 6, top, cx - 4, bottom, PAL.stone[2]);
  b.line(cx + 5, top, cx + 3, bottom, PAL.stone[2]);
  b.blit(dome, 0, 0);
  return { buf: b, ox: cx, oy: H };
}

/** The canopy folds up and drifts off (centre anchor): sagging, half-folded, a crumpled sheet. */
function chuteFoldFrames(): Frame[] {
  const out: Frame[] = [];
  const shapes: Array<{ w: number; h: number; tilt: number }> = [
    { w: 30, h: 10, tilt: 0 },
    { w: 26, h: 9, tilt: 1 },
    { w: 20, h: 9, tilt: 2 },
    { w: 14, h: 8, tilt: 3 },
    { w: 10, h: 6, tilt: 3 },
  ];
  for (const s of shapes) {
    const W = s.w + 8;
    const H = s.h + 8;
    const b = new PixelBuffer(W, H);
    // A sagging cloth: ellipse dome pulled down at one side.
    const cx = W >> 1;
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + (i / 10) * Math.PI;
      pts.push([Math.round(cx + Math.cos(a) * (s.w / 2)), Math.round(H / 2 + Math.sin(a) * (s.h / 2) + (i / 10) * s.tilt)]);
    }
    pts.push([cx + Math.round(s.w / 2) - 2, H / 2 + s.tilt + 2]);
    pts.push([cx - Math.round(s.w / 2) + 2, H / 2 + 2]);
    b.poly(pts, PAL.snow[2]);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if ((b.get(x, y) & 255) === 0) continue;
        const gore = Math.floor(((x - (cx - s.w / 2)) / s.w) * 5);
        if (gore % 2 === 1) b.set(x, y, PAL.olive[2]);
        else if (y < H / 2 - s.h / 4) b.set(x, y, PAL.snow[3]);
      }
    }
    b.outline(INK);
    out.push({ buf: b, ox: cx, oy: H >> 1 });
  }
  return out;
}

// ------------------------------------------------------------------------------------ HD (2× and 4×, ams)

/** The swan stencil as a smooth mask at logical (x, y) relative to its top-left (bilinear). */
function stencilAt(rows: readonly string[], x: number, y: number): number {
  const fx = x - 0.5;
  const fy = y - 0.5;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const g = (X: number, Y: number): number => (rows[Y]?.[X] === '#' ? 1 : 0);
  return (g(ix, iy) * (1 - tx) + g(ix + 1, iy) * tx) * (1 - ty) + (g(ix, iy + 1) * (1 - tx) + g(ix + 1, iy + 1) * tx) * ty;
}

/** Shared HD materials of a crate canvas. */
function crateMats(c: HdCanvas): { wood: number; paint: number; rope: number; steel: number } {
  return {
    wood: c.material({ ramp: PAL_HD.wood, spec: 0.25, shine: 12, lo: 1, hi: 6, wrap: 0.05 }),
    paint: c.material({ ramp: PAL_HD.cloth, spec: 0.2, shine: 10, lo: 2, hi: 5 }),
    rope: c.material({ ramp: PAL_HD.sand, spec: 0.2, shine: 10, lo: 1, hi: 6 }),
    steel: c.material({ ramp: PAL_HD.steel, spec: 1, shine: 34, lo: 2, hi: 6 }),
  };
}

/** A twisted rope from (x, y0) down to y1 (2 logical px wide): strands as diagonal ridges. */
function ropeHd(c: HdCanvas, mat: number, x: number, y0: number, y1: number, z: number): void {
  c.cylinder(x, y0, 2, y1 - y0, {
    mat,
    z,
    tex: (s) => {
      const t = (s.y * 1.25 + s.x * 0.9) % 1;
      s.ny += Math.sin(t * Math.PI * 2) * 0.55;
      s.tone += t < 0.18 ? -0.35 : 0;
    },
  });
}

/**
 * The HD crate (2× and 4×): a grained plank front with dark seams and lit board edges, a lit lid,
 * side boards, nail heads, the worn white swan stencil painted on the planks, twisted rope bands
 * with a knot and a hanging loop; `squash` widens and flattens it, `cracks` splits the boards.
 */
function crateHd(c: HdCanvas, look: CrateLook, squash: number, cracks: number): void {
  const w = CRATE_W - 2 + squash;
  const h = CRATE_H - 2 - squash;
  const m = crateMats(c);
  const grain = woodTex({ seed: 5 });
  const st = look.stencil;
  const sx = Math.floor((w + 2 - st[0].length) / 2);
  const sy = 6 + Math.max(0, Math.floor((h - 18) / 2));
  // Crack paths (deterministic): a wandering line per crack, as x offsets per logical row.
  const crackX: number[][] = [];
  for (let i = 0; i < cracks; i++) {
    let x = 5 + Math.floor(hash2(i, 1, 9) * (w - 8)) + 0.5;
    const row: number[] = [];
    for (let k = 0; k < h - 6; k++) {
      row.push(x);
      if (hash2(i, k, 4) > 0.6) x += hash2(k, i, 2) > 0.5 ? 1 : -1;
    }
    crackX.push(row);
  }
  // The lid: the top face, lit.
  c.box(1, 1, w, 3, { mat: m.wood, z: 0.5, bevel: 0.4, n: [0, -0.62, 0.78], tex: grain });
  // The front: planks with seams every 5 px from the lid, the stencil, cracks.
  c.box(1, 4, w, h - 3, {
    mat: m.wood,
    z: 0,
    tex: (s) => {
      grain(s);
      const f = (((s.y - 4) % 5) + 5) % 5;
      const e = 1 / s.d;
      if (f < e) s.tone -= 0.55;
      else if (f < e * 2) s.tone += 0.18;
      if (s.y > h) s.tone -= 0.4;
      const v = look.rope ? stencilAt(SWAN_HD, (s.x - sx) * 2, (s.y - sy) * 2) : stencilAt(st, s.x - sx, s.y - sy);
      if (v > 0.5 && hash2(Math.floor(s.x * 2), Math.floor(s.y * 2), 13) > 0.16) {
        s.mat = m.paint;
        s.tone += (v - 0.5) * 0.3;
      }
      for (const row of crackX) {
        // A thin split through the boards: the row offsets joined smoothly.
        const fy = s.y - 5.5;
        const k = Math.floor(fy);
        if (k < 0 || k >= row.length) continue;
        const x = row[k] + (row[Math.min(row.length - 1, k + 1)] - row[k]) * (fy - k);
        if (Math.abs(s.x - x) < 0.42) {
          s.tone -= 0.95;
          s.mat = m.wood;
        } else if (s.x > x && s.x - x < 0.85) s.tone += 0.2;
      }
    },
  });
  // Side boards.
  c.box(1, 4.2, 2, h - 3.2, { mat: m.wood, z: 0.45, bevel: 0.45, tone: 0.12, tex: woodTex({ seed: 6, dir: 'v' }) });
  c.box(w - 1, 4.2, 2, h - 3.2, { mat: m.wood, z: 0.45, bevel: 0.45, tone: -0.12, tex: woodTex({ seed: 7, dir: 'v' }) });
  // Nail heads at the plank ends.
  for (let y = 7; y < h; y += 5) {
    for (const x of [3.5, w - 1.5]) c.ellipsoid(x, y + 0.5, 0.42, 0.42, { mat: m.steel, z: 1 });
  }
  // Bands: over the lid and down the front.
  const bx0 = Math.round((BAND_X[0] * w) / 22);
  const bx1 = Math.round((BAND_X[1] * w) / 22);
  if (look.rope) {
    for (const bx of [bx0, bx1]) ropeHd(c, m.rope, bx, 1, h + 1, 1.2);
    // The knot and its loop.
    c.ellipsoid(bx0 + 1, 5.3, 1.9, 1.35, { mat: m.rope, z: 2, tex: (s) => { s.ny += Math.sin((s.x + s.y) * 3) * 0.35; } });
    c.stroke([[bx0 + 2.2, 6.2], [bx0 + 2.6, 7.6], [bx0 + 1.6, 8.6]], 0.45, 0.4, { mat: m.rope, z: 1.8 });
  } else {
    const brass = c.material({ ramp: PAL_HD.gold, spec: 1, shine: 30, lo: 2, hi: 6 });
    for (const bx of [bx0, bx1]) c.box(bx, 1, 2, h, { mat: brass, z: 1.2, bevel: 0.4 });
    c.box(bx0 - 1, 9, 4, 3, { mat: m.steel, z: 2, bevel: 0.5, r: 0.3 });
  }
}

/** A loose HD plank (break frames) with its top-left (1× px incl. outline) at (x, y). */
function plankHd(c: HdCanvas, x: number, y: number, len: number, vertical: boolean, seed: number): void {
  const m = crateMats(c);
  const bw = vertical ? 3 : len;
  const bh = vertical ? len : 3;
  c.box(x + 1, y + 1, bw, bh, {
    mat: m.wood,
    bevel: 0.45,
    tex: (s) => {
      woodTex({ seed, dir: vertical ? 'v' : 'h' })(s);
      // A splintered end.
      const along = vertical ? s.y - y - 1 : s.x - x - 1;
      const across = vertical ? s.x - x - 1 : s.y - y - 1;
      if (along > len - 1.2 && hash2(Math.floor(across * 2), seed, 3) * 1.2 > len - along) s.cut = true;
    },
  });
}

/** A short HD band bit (break frames): twisted rope or a brass strap, top-left at (x, y). */
function bandBitHd(c: HdCanvas, look: CrateLook, x: number, y: number): void {
  const m = crateMats(c);
  c.cylinder(x + 1, y + 1, 7, 2, {
    mat: look.rope ? m.rope : m.steel,
    axis: 'h',
    tex: look.rope
      ? (s) => {
          const t = (s.x * 1.25 + s.y * 0.9) % 1;
          s.nx += Math.sin(t * Math.PI * 2) * 0.55;
        }
      : null,
  });
}

/** HD ids of the crate (the supply crate: the one mission ams uses). */
export const CRATE_HD_IDS = ['item/crate', 'item/crate-hit', 'item/crate-break'];

/** The HD strip of a crate id (`CRATE_HD_IDS`) at density d. */
export function crateStripHd(id: string, d: number): Frame[] {
  const look = SUPPLY;
  const done = (c: HdCanvas): PixelBuffer => c.render({ outline: 'A', ao: 0.3, sep: true, sepZ: 0.3, rimLight: 1 });
  if (id === 'item/crate') return hdStrip(id, d, (c) => (crateHd(c, look, 0, 0), done(c)));
  if (id === 'item/crate-hit') return hdStrip(id, d, (c, i) => (crateHd(c, look, i === 0 ? 2 : 0, 0), done(c)));
  if (id === 'item/crate-break') {
    return hdStrip(id, d, (c, i) => {
      if (i === 0) crateHd(c, look, 1, 3);
      else {
        BREAK_PLANKS[i - 1].forEach(([x, y, len, v], k) => plankHd(c, 33 + x, BREAK_H + y, len, v, i * 10 + k));
        for (const [x, y] of BREAK_BITS[i - 1]) bandBitHd(c, look, 33 + x, BREAK_H + y);
      }
      return done(c);
    });
  }
  throw new Error(`no HD crate "${id}"`);
}

// ------------------------------------------------------------------------------------ register

export function defineCrateSprites(): void {
  for (const [prefix, look] of [['item/crate', SUPPLY], ['item/crate-legion', LEGION]] as const) {
    defineSprite(prefix, () => idleFrames(look), { ticksPerFrame: 60 });
    defineSprite(`${prefix}-hit`, () => hitFrames(look), { ticksPerFrame: 3, loop: false });
    defineSprite(`${prefix}-break`, () => breakFrames(look), { durations: [4, 5, 6, 20], loop: false });
  }
  defineSprite('item/crate-chute', () => [chuteBuf(0), chuteBuf(1)], { ticksPerFrame: 10 });
  defineSprite('item/crate-chute-fold', chuteFoldFrames, { ticksPerFrame: 6, loop: false });
  // HD art (2× and 4×, mission ams only): the supply crate. m0–m5 keep the 1× art.
  for (const id of CRATE_HD_IDS) defineHdSprite(id, (d) => crateStripHd(id, d));
}
