/**
 * Mission `ams` UHD canal houses and FABEL FRIET (docs/ART_GUIDE.md "UHD art"): one density-generic
 * drawer per id for the 2× and the 4× art, with the 1× frame's size and anchor (art.ts
 * `paintHouse`, `fabelFriet`, `neighbour`, `fabelSign`, `fabelCounter`).
 *
 * A house is the 1× recipe (same storeys, windows, doors, gables, shops at the same logical px)
 * painted as a lit facade: brick bond with mortar, damp at the foot and soot under the cornice,
 * rain streaks under the sills, or plaster with cracks and stains; white trims, copings, cornices
 * with dentils and claw pieces in sandstone; sash windows reflecting the sky with lace or drapes;
 * panelled front doors with fanlights and stoops; shop fasciae with gilded lettering and the
 * goods of the shop in the window. Whole storeys lean as at 1× (the G-buffer shifts before the
 * render). Outline C (static facade decor in the playfield).
 */
import type { Color } from '../../../../engine/color';
import { PAL } from '../../../../engine/palette';
import { PAL_HD } from '../../../../engine/palette-hd';
import type { Ramp } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { HdCanvas, brick, grime, plaster, texAll, wood, type Texture } from '../../../art/hd/index';
import { hash2, noise2 } from '../../../art/paint';
import { FABEL_SCRIPT, TULIPS, type HouseSpec, type Light, type Wall } from './art';
import { deco, face, fr, glow, h01, lettering, lightHd, hole, ring, rampOf, rowsMask, sash, shearRows, textMask, winMats, type D, type P, type WinMats } from './art-hd-ab-kit';

interface WallLook {
  ramp: Ramp;
  lo: number;
  hi: number;
  kind: 'brick' | 'painted' | 'plaster';
  mortar: Ramp;
  mlo: number;
  mhi: number;
}

/** The 1× wall colours as HD materials (colour families kept). */
const WALL_HD: Readonly<Record<Wall, WallLook>> = {
  brown: { ramp: PAL_HD.brown, lo: 1, hi: 6, kind: 'brick', mortar: PAL_HD.stone, mlo: 1, mhi: 4 },
  rust: { ramp: PAL_HD.rust, lo: 1, hi: 5, kind: 'brick', mortar: PAL_HD.stone, mlo: 1, mhi: 4 },
  red: { ramp: PAL_HD.red, lo: 3, hi: 6, kind: 'brick', mortar: PAL_HD.stone, mlo: 1, mhi: 4 },
  darkred: { ramp: PAL_HD.red, lo: 1, hi: 4, kind: 'brick', mortar: PAL_HD.stone, mlo: 1, mhi: 3 },
  green: { ramp: PAL_HD.green, lo: 1, hi: 4, kind: 'painted', mortar: PAL_HD.green, mlo: 1, mhi: 2 },
  ink: { ramp: PAL_HD.black, lo: 1, hi: 5, kind: 'painted', mortar: PAL_HD.black, mlo: 1, mhi: 2 },
  cream: { ramp: PAL_HD.plaster, lo: 2, hi: 6, kind: 'plaster', mortar: PAL_HD.plaster, mlo: 1, mhi: 3 },
  grey: { ramp: PAL_HD.stone, lo: 2, hi: 6, kind: 'plaster', mortar: PAL_HD.stone, mlo: 1, mhi: 3 },
};

/** Painted front doors (the 1× door colours). */
const DOOR_HD: readonly Ramp[] = [PAL_HD.green, PAL_HD.navy, PAL_HD.red, PAL_HD.black];

/** The facade materials of one canvas. */
interface FacadeMats extends WinMats {
  trim: number;
  stone: number;
  sandstone: number;
  beam: number;
  iron: number;
  rope: number;
  brass: number;
  boxGreen: number;
  leaf: number;
  dark: number;
  tulips: readonly number[];
}

function facadeMats(c: HdCanvas): FacadeMats {
  const w = winMats(c);
  return {
    ...w,
    trim: w.frame,
    stone: face(c, PAL_HD.stone, { lo: 2, hi: 7 }),
    sandstone: face(c, PAL_HD.sand, { lo: 2, hi: 7, spec: 0.1 }),
    beam: face(c, PAL_HD.wood, { lo: 1, hi: 5 }),
    iron: deco(c, PAL_HD.black, { lo: 0, hi: 4, spec: 0.6, shine: 18 }),
    rope: face(c, PAL_HD.sand, { lo: 2, hi: 5 }),
    brass: deco(c, PAL_HD.gold, { lo: 2, hi: 6, spec: 1, shine: 20 }),
    boxGreen: face(c, PAL_HD.green, { lo: 1, hi: 4 }),
    leaf: deco(c, PAL_HD.green, { lo: 2, hi: 6 }),
    dark: glow(c, PAL_HD.brickDark, { lo: 0, hi: 3 }),
    tulips: [PAL_HD.red, PAL_HD.pink, PAL_HD.gold, PAL_HD.orange].map((r) => deco(c, r, { lo: 2, hi: r.length - 2 })),
  };
}

/** A 1× tulip colour → one of the tulip materials. */
function tulipMat(m: FacadeMats, col: Color): number {
  const i = col === PAL.pink[2] || col === PAL.pink[1] ? 1 : col === PAL.gold[2] ? 2 : col === PAL.orange[2] ? 3 : 0;
  return m.tulips[i];
}

/** A wall texture: brick bond (or plaster), damp at the foot, soot near the top. */
function wallTex(look: WallLook, mortar: number, seed: number, foot: number, top: number): Texture {
  const base =
    look.kind === 'plaster'
      ? plaster({ seed, cracks: 0.35, stains: 0.45 })
      : look.kind === 'painted'
        ? texAll(brick({ mortar, bw: 3, bh: 1.5, joint: 0.35, wear: 0.2, seed }), grime(seed, 0.2, 6))
        : brick({ mortar, bw: 3, bh: 1.5, joint: 0.5, wear: 0.55, seed });
  return (s) => {
    base(s);
    // Rising damp at the foot of the wall, soot under the cornice: soft, broken bands.
    if (s.y > foot - 6) s.tone -= ((s.y - (foot - 6)) / 6) * (0.12 + noise2(s.x, s.y, 4, seed + 31) * 0.12);
    else if (s.y < top + 5) s.tone -= ((top + 5 - s.y) / 5) * 0.12 * noise2(s.x, s.y, 4, seed + 31);
  };
}

/** Rain streaks running down the wall under a sill (tone only, on the wall part). */
function streaks(c: HdCanvas, x: number, y: number, w: number, len: number, part: number, seed: number): void {
  c.shade(x, y, w, len, (px, py) => {
    const col = Math.floor(px * 2);
    if (h01(col, 0, seed) > 0.42) return 0;
    const f = 1 - (py - y) / (len * (0.45 + h01(col, 1, seed) * 0.55));
    return f > 0 ? -0.16 * f : 0;
  }, part);
}

/** Small tulips with leaves in a row (flower boxes, planters): heads at y, stems down to y0. */
function tulipRow(c: HdCanvas, m: FacadeMats, x0: number, x1: number, y: number, y0: number, z: number, seed: number, step = 2): void {
  for (let x = x0, k = 0; x < x1; x += step, k++) {
    const col = TULIPS[(x + seed + k) % TULIPS.length];
    const hx = x + 0.5 + (h01(k, 1, seed) - 0.5) * 0.4;
    const hy = y + (h01(k, 2, seed) - 0.5) * 0.6;
    c.capsule(hx, y0, hx, hy + 0.6, 0.2, 0.18, { mat: m.leaf, z });
    if (k % 2 === 0) c.ellipsoid(hx + 0.6, y0 - 0.5, 0.65, 0.3, { mat: m.leaf, z: z + 0.1 });
    c.ellipsoid(hx, hy, 0.6, 0.75, {
      mat: tulipMat(m, col),
      z: z + 0.2,
      tex: (s) => {
        if (s.v < -0.6 && Math.abs(s.u) < 0.3) s.cut = true;
      },
    });
  }
}

/** A flower box under a window: green planks, tulips peeping over the sill. */
function flowerBox(c: HdCanvas, m: FacadeMats, x: number, y: number, w: number, seed: number): void {
  c.box(x, y, w, 2, { mat: m.boxGreen, z: 1.6, bevel: 0.35, tex: wood({ seed, dir: 'h', plank: 1 }) });
  tulipRow(c, m, x + 1, x + w - 1, y - 1.2, y + 0.3, 1.4, seed);
}

/** The goods of a shop in its display window (x, y, w, h: the glass), by the fascia word. */
function shopGoods(c: HdCanvas, word: string, x: number, y: number, w: number, h: number, seed: number): void {
  const z = -1.3;
  const shelf = face(c, PAL_HD.wood, { lo: 1, hi: 5 });
  const by = y + h - 0.2;
  c.box(x, by - 1, w, 1, { mat: shelf, z: z + 0.05, bevel: 0.25 });
  if (word === 'KAAS') {
    // Cheese wheels: yellow rind, stacked; a red waxed one now and then.
    const yel = deco(c, PAL_HD.gold, { lo: 3, hi: 6 });
    const red = deco(c, PAL_HD.red, { lo: 3, hi: 6, spec: 0.5 });
    for (let cx = x + 1.6, k = 0; cx < x + w - 1.4; cx += 3.1, k++) {
      const mat = h01(k, 0, seed) < 0.25 ? red : yel;
      c.cylinder(cx - 1.4, by - 2.6, 2.8, 1.6, { mat, z: z + 0.2, axis: 'h', cap: 0 });
      if (k % 2 === 0) c.cylinder(cx - 1.2, by - 4, 2.4, 1.4, { mat: yel, z: z + 0.15, axis: 'h' });
    }
  } else if (word === 'BLOEMEN') {
    const bucket = deco(c, PAL_HD.steel, { lo: 2, hi: 6, spec: 0.8 });
    const leaf = deco(c, PAL_HD.green, { lo: 2, hi: 6 });
    const cols = [PAL_HD.red, PAL_HD.gold, PAL_HD.pink, PAL_HD.orange, PAL_HD.purple].map((r) => deco(c, r, { lo: 2, hi: r.length - 2 }));
    for (let cx = x + 2, k = 0; cx < x + w - 1.5; cx += 3.4, k++) {
      c.cylinder(cx - 1.2, by - 2.4, 2.4, 2.2, { mat: bucket, z: z + 0.3 });
      for (let j = 0; j < 4; j++) {
        const fx = cx - 1 + j * 0.7;
        const fy = by - 3.6 - h01(k, j, seed) * 1.6;
        c.capsule(fx, by - 2.3, fx, fy, 0.15, 0.15, { mat: leaf, z: z + 0.2 });
        c.ellipsoid(fx, fy, 0.55, 0.6, { mat: cols[(k + j) % cols.length], z: z + 0.35 });
      }
    }
  } else if (word === 'KOFFIE') {
    const jar = deco(c, PAL_HD.glass, { lo: 1, hi: 5, spec: 1, shine: 30 });
    const beans = face(c, PAL_HD.brown, { lo: 1, hi: 4 });
    const sack = face(c, PAL_HD.sand, { lo: 2, hi: 6 });
    for (let cx = x + 1.8, k = 0; cx < x + w - 1.5; cx += 3.2, k++) {
      if (k % 3 === 2) {
        c.blob([[cx - 1.4, by - 1], [cx - 1.2, by - 3.6], [cx, by - 4.2], [cx + 1.2, by - 3.6], [cx + 1.4, by - 1]], 0.8, { mat: sack, z: z + 0.3 });
      } else {
        c.box(cx - 1.1, by - 3.4, 2.2, 2.4, { mat: beans, z: z + 0.2, bevel: 0.3, tex: (s) => { s.tone += (hash2(Math.floor(s.x * 3), Math.floor(s.y * 3), seed) - 0.5) * 0.3; } });
        c.box(cx - 1.2, by - 3.6, 2.4, 2.6, { mat: jar, z: z + 0.1, bevel: 0.5, r: 0.3 });
      }
    }
  } else if (word === 'BOEKEN') {
    const spines = [PAL_HD.red, PAL_HD.navy, PAL_HD.green, PAL_HD.gold, PAL_HD.brown, PAL_HD.purple].map((r) => face(c, r, { lo: 1, hi: r.length - 2 }));
    for (const row of [0, 1]) {
      const ry = by - 1 - row * 3.2;
      if (row === 1) c.box(x, ry, w, 0.6, { mat: shelf, z: z + 0.05 });
      let bx = x + 0.4;
      for (let k = 0; bx < x + w - 0.6; k++) {
        const bw = 0.6 + h01(k, row, seed) * 0.5;
        const bh = 2 + h01(k, row + 7, seed) * 0.8;
        c.box(bx, ry - bh, bw, bh, { mat: spines[Math.floor(h01(k, row + 3, seed) * spines.length)], z: z + 0.15, bevel: 0.2 });
        bx += bw + 0.1;
      }
    }
  } else if (word === 'FIETSEN') {
    const tyre = deco(c, PAL_HD.ink, { lo: 0, hi: 1 });
    const rim = deco(c, PAL_HD.steel, { lo: 2, hi: 6, spec: 1, shine: 26 });
    const frm = deco(c, PAL_HD.purple, { lo: 2, hi: 5, spec: 0.6 });
    for (let cx = x + 3, k = 0; cx < x + w - 2.5; cx += 6, k++) {
      const wy = by - 2.4;
      c.plane(cx - 2.2, wy - 2.2, 4.4, 4.4, { mat: tyre, z: z + 0.2, mask: (px, py) => { const q = Math.hypot(px - cx, py - wy); return q < 2.2 && q > 1.6; } });
      c.plane(cx - 1.7, wy - 1.7, 3.4, 3.4, { mat: rim, z: z + 0.15, mask: (px, py) => { const q = Math.hypot(px - cx, py - wy); return q < 1.7 && q > 1.35; } });
      c.capsule(cx, wy, cx + 2.6, wy - 2.4, 0.3, 0.3, { mat: frm, z: z + 0.3 });
    }
  } else {
    // Generic: coloured parcels (the 1× goods).
    for (let gx = x + 1, k = 0; gx < x + w - 2; gx += 3, k++) {
      c.box(gx, by - 3, 2, 3, { mat: deco(c, rampOf(TULIPS[(Math.round(gx) + seed) % TULIPS.length]), { lo: 2, hi: 5 }), z: z + 0.2, bevel: 0.3 });
    }
  }
  // The glass in front of the goods: reflected streaks on whatever stands behind it.
  c.shade(x, y, w, h, (px, py) => {
    const k = (px - x + (py - y) * 0.7) % 6;
    return k < 0.5 ? 0.22 : k < 0.9 ? 0.1 : 0;
  });
}

// ============================================================================== canal house

/** One canal house of `HOUSE_VARIANTS` (art.ts `paintHouse`) at density d. */
export function houseHd(h: HouseSpec, d: D): Frame {
  const S = h.s ?? 20;
  const w = h.w;
  const look = WALL_HD[h.wall];
  const gf = S + 8;
  const bodyH = gf + h.floors * S;
  const gableH = h.gable === 'flat' ? Math.max(4, Math.round(S * 0.35)) : h.gable === 'spout' ? Math.round(S * 1.1) : Math.round(S * 1.35);
  const Wb = w + 2;
  const Hb = bodyH + gableH + 3;
  const lean = Math.round(h.lean);
  const L = Math.abs(lean);
  const OW = Wb + L + 2;
  const OH = Hb + 1;
  // b (1× drawing) coordinates → out (frame) logical px: x + off, y + 1 (before the lean).
  const off = 1 + (lean < 0 ? L : 0);
  const X = (xb: number): number => xb + off;
  const Y = (yb: number): number => yb + 1;
  const cxb = 1 + (w >> 1);
  const hs = (a: number, k: number): number => hash2(a, k, h.seed);
  const c = new HdCanvas(OW, OH, d);
  const m = facadeMats(c);
  const wallM = face(c, look.ramp, { lo: look.lo, hi: look.hi });
  const mortarM = face(c, look.mortar, { lo: look.mlo, hi: look.mhi });
  const wallPart = c.newPart();
  const yTb = Hb - bodyH;
  const g0b = yTb - gableH;
  const gyb = Hb - gf;
  const foot = Y(Hb);
  const tex = wallTex(look, mortarM, h.seed, foot - 3, Y(g0b));

  // ---- Wall body and gable silhouette (one surface). ----
  const top: P[] = [];
  if (h.gable === 'step') {
    const k = w >= 40 ? 4 : 3;
    const sh = Math.max(3, Math.floor(gableH / (k + 1)));
    const stepW = Math.max(2, Math.floor(w / 2 / (k + 1.6)));
    const pts: P[] = [[X(1), Y(yTb)]];
    const right: P[] = [];
    for (let i = 0; i <= k; i++) {
      const half = (w >> 1) - i * stepW;
      const ya = Y(Math.max(g0b, yTb - (i + 1) * sh));
      pts.push([X(cxb - half), Y(yTb - i * sh)], [X(cxb - half), ya]);
      right.unshift([X(cxb + half), ya], [X(cxb + half), Y(yTb - i * sh)]);
      // Stone coping on each step (a slab overhanging a little).
      c.box(X(cxb - half) - 0.3, ya - 0.2, 2 * half + 0.6, 1.1, { mat: m.trim, z: 1.2, bevel: 0.35, n: [0, -0.35, 0.94] });
    }
    pts.push(...right, [X(w + 1), Y(yTb)]);
    top.push(...pts);
    const tip = yTb - (k + 1) * sh;
    // A stone finial on the top step.
    c.box(X(cxb - 1), Y(tip - 2) - 0.2, 2, 2.2, { mat: m.trim, z: 1.4, bevel: 0.45, r: 0.3 });
  } else if (h.gable === 'neck') {
    const nw = Math.max(6, Math.round(w * 0.46));
    const nx0 = cxb - (nw >> 1);
    top.push([X(1), Y(yTb)], [X(nx0), Y(yTb)], [X(nx0), Y(g0b + 3)], [X(nx0 + nw), Y(g0b + 3)], [X(nx0 + nw), Y(yTb)], [X(w + 1), Y(yTb)]);
    // Claw pieces: sandstone scrolls filling the shoulders, curling up to the neck.
    const ch = Math.round(gableH * 0.6);
    for (const side of [-1, 1]) {
      const curve: P[] = [];
      for (let i = 0; i <= ch; i++) {
        const t = i / ch;
        const reach = (nx0 - 1) * (1 - t * t);
        const x = side < 0 ? X(nx0 - reach) + 0.9 : X(nx0 + nw + reach) - 0.9;
        curve.push([x, Y(yTb - i) + 0.4]);
      }
      c.stroke(curve, 0.95, 0.75, { mat: m.sandstone, z: 1 });
      // The bottom bar along the wall top and the inner edge against the neck.
      const xa = side < 0 ? X(1) + 0.5 : X(nx0 + nw) + 0.5;
      c.capsule(xa, Y(yTb) - 0.6, xa + (nx0 - 2), Y(yTb) - 0.6, 0.6, 0.6, { mat: m.sandstone, z: 1.1 });
      const xn = side < 0 ? X(nx0) - 0.5 : X(nx0 + nw) + 0.5;
      c.capsule(xn, Y(yTb) - 0.5, xn, Y(yTb - ch) + 0.5, 0.5, 0.45, { mat: m.sandstone, z: 1.05 });
      // A volute near the foot.
      c.ellipsoid(side < 0 ? X(nx0 - 3) + 0.5 : X(nx0 + nw + 2) + 0.5, Y(yTb - 4) + 0.5, 1.4, 1.4, { mat: m.sandstone, z: 1.5, round: 0.8 });
    }
    // Pediment: a white triangle with a moulded edge.
    const pa: P = [X(nx0 - 1), Y(g0b + 3) + 0.4];
    const pb: P = [X(nx0 + nw + 1), Y(g0b + 3) + 0.4];
    const pc: P = [X(cxb) + 0.5, Y(g0b)];
    c.poly([pa, pb, pc], { mat: m.trim, z: 1.1, n: [0, -0.2, 0.98] });
    c.stroke([pa, pc, pb], 0.45, 0.45, { mat: m.trim, z: 1.4 });
    c.box(pa[0], pa[1] - 0.3, pb[0] - pa[0], 1, { mat: m.trim, z: 1.3, bevel: 0.3, n: [0, 0.35, 0.94] });
  } else if (h.gable === 'bell' || h.gable === 'spout') {
    const half = (yb: number): number => {
      const t = Math.max(0, Math.min(1, (yTb - yb) / gableH));
      if (h.gable === 'spout') return (w / 2) * (1 - t) + 1;
      const f = t < 0.45 ? 0.55 + 0.45 * Math.cos((Math.PI * t) / 0.45 / 2) ** 0.8 : 0.55 * Math.sqrt(Math.max(0, 1 - ((t - 0.45) / 0.55) ** 2));
      return Math.max(1, (w / 2) * f);
    };
    const left: P[] = [];
    const right: P[] = [];
    const n = Math.ceil(gableH * 2);
    for (let i = 0; i <= n; i++) {
      const yb = yTb - (gableH * i) / n;
      const hw = half(yb);
      left.push([X(cxb) - hw, Y(yb)]);
      right.unshift([X(cxb) + hw, Y(yb)]);
    }
    top.push([X(1), Y(yTb)], ...left, ...right, [X(w + 1), Y(yTb)]);
    // The white trim band along the gable edge (a raised moulding).
    for (const edge of [left, right]) c.stroke(edge, 0.55, 0.55, { mat: m.trim, z: 1 });
    if (h.gable === 'bell') {
      c.box(X(cxb - 2), Y(g0b) - 0.3, 4, 1, { mat: m.trim, z: 1.3, bevel: 0.35 });
      c.box(X(cxb - 1), Y(g0b - 2), 2, 2, { mat: m.trim, z: 1.4, bevel: 0.45, r: 0.4 });
    } else c.box(X(cxb) - 1.3, Y(g0b) - 0.4, 2.6, 1, { mat: m.trim, z: 1.3, bevel: 0.35 });
  } else {
    // Flat cornice (lijstgevel): a deep white cornice with dentils and a crest.
    top.push([X(1), Y(yTb)], [X(w + 1), Y(yTb)]);
    const cy = Y(yTb - gableH);
    c.box(X(1) - 0.2, cy, w + 0.4, gableH, { mat: m.trim, z: 1.5, bevel: 0.5, n: [0, 0.3, 0.95] });
    c.box(X(1) - 0.4, cy - 0.2, w + 0.8, 1.4, { mat: m.trim, z: 2, bevel: 0.45, n: [0, -0.5, 0.86] });
    for (let x = 3; x < w - 1; x += 3) c.box(X(x) - 0.1, cy + gableH - 2.2, 1.2, 1.2, { mat: m.trim, z: 1.9, bevel: 0.3 });
    c.box(X(1), cy + gableH - 1, w, 1, { mat: m.stone, z: 1.2, n: [0, 0.6, 0.8] });
    c.box(X(cxb - 3), cy - 3, 6, 3.2, { mat: m.trim, z: 1.6, bevel: 0.45, r: 0.3 });
  }
  // The body as a box, the gable as a polygon over its own rows (point tests only up there).
  c.box(X(1), Y(yTb), w, bodyH, { mat: wallM, z: 0, part: wallPart, tex });
  if (top.length > 2) c.poly([...top, [X(w + 1), Y(yTb) + 0.25], [X(1), Y(yTb) + 0.25]], { mat: wallM, z: 0, part: wallPart, tex });
  // The lit left edge and the darker right edge of the facade (the 1× r[3] / r[0] columns).
  c.shade(X(1), Y(yTb), 0.8, bodyH, () => 0.12, wallPart);
  c.shade(X(w), Y(yTb), 1, bodyH, () => -0.18, wallPart);

  // ---- Loading door and hoist beam in the gable (a hoist beam under a flat cornice). ----
  if (h.gable !== 'flat') {
    const dw = 6;
    const dh = Math.max(3, Math.round(gableH * 0.38));
    const dyb = yTb - dh - 1;
    const doorRamp = h.wall === 'green' ? PAL_HD.navy : PAL_HD.green;
    const doorM = face(c, doorRamp, { lo: 1, hi: doorRamp.length - 2, spec: 0.3 });
    ring(c, X(cxb - (dw >> 1) - 1), Y(dyb - 1), dw + 2, dh + 1, 1, { mat: m.trim, z: 0.3, open: 'bottom' });
    hole(c, X(cxb - (dw >> 1)), Y(dyb), dw, dh);
    c.box(X(cxb - (dw >> 1)), Y(dyb), dw, dh, { mat: doorM, z: -0.5, tex: wood({ seed: h.seed, dir: 'v', plank: 1 }) });
    c.shade(X(cxb) - 0.25, Y(dyb), 0.5, dh, () => -0.4);
    const byb = Math.max(g0b + 1, dyb - 6);
    c.box(X(cxb - 1), Y(byb), 3, 2, { mat: m.beam, z: 3, bevel: 0.4, tex: wood({ seed: 2, dir: 'h' }) });
    c.capsule(X(cxb + 1) + 0.5, Y(byb + 2), X(cxb + 1) + 0.5, Y(byb + 4) + 0.6, 0.22, 0.22, { mat: m.rope, z: 2.8 });
    c.capsule(X(cxb + 1) + 0.5, Y(byb + 4) + 0.8, X(cxb) + 0.6, Y(byb + 5) + 0.6, 0.25, 0.25, { mat: m.iron, z: 2.8 });
  } else {
    c.box(X(cxb - 1), Y(yTb + 1), 3, 2, { mat: m.beam, z: 3, bevel: 0.4 });
    c.capsule(X(cxb + 1) + 0.5, Y(yTb + 3), X(cxb + 1) + 0.5, Y(yTb + 5) + 0.6, 0.22, 0.22, { mat: m.rope, z: 2.8 });
  }

  // ---- Upper floors: sash windows (smaller toward the top), lintels, sills, flower boxes. ----
  const n = w >= 44 ? 3 : w >= 24 ? 2 : 1;
  const cw = w / n;
  const brickish = look.kind !== 'plaster';
  for (let f = 0; f < h.floors; f++) {
    const topb = Hb - gf - (f + 1) * S;
    const ww = Math.min(10, Math.max(6, Math.round(cw * 0.5)));
    const wh = Math.max(4, Math.round(S * (0.68 - f * 0.05)));
    const wyb = topb + Math.max(2, ((S - wh) >> 1) - 1);
    for (let i = 0; i < n; i++) {
      const wxb = 1 + Math.round(cw * i + (cw - ww) / 2);
      const lit = hs(f * 7 + i, 3) > 0.94;
      const seed = h.seed * 31 + f * 7 + i;
      if (brickish) c.box(X(wxb - 1) - 0.2, Y(wyb - 1) - 0.2, ww + 2.4, 1.2, { mat: m.trim, z: 0.5, bevel: 0.3 });
      sash(c, m, X(wxb), Y(wyb), ww, wh, { seed, lit, bars: f === h.floors - 1 ? 'sash' : 'six', sill: false });
      c.box(X(wxb - 1) - 0.2, Y(wyb + wh), ww + 2.4, 1, { mat: m.sill, z: 1, bevel: 0.35, n: [0, -0.45, 0.89] });
      streaks(c, X(wxb - 1), Y(wyb + wh + 1), ww + 2, 5, wallPart, seed);
      if (h.flowers && f === 0) flowerBox(c, m, X(wxb - 1), Y(wyb + wh + 1), ww + 2, seed);
    }
    if (look.kind === 'brick' && f === 0) c.box(X(1), Y(topb + S - 1) + 0.15, w, 0.75, { mat: m.trim, z: 0.4, bevel: 0.25 });
  }

  // ---- Ground floor. ----
  c.box(X(1), Y(gyb) - 0.1, w, 1.2, { mat: m.trim, z: 1, bevel: 0.35, n: [0, -0.3, 0.95] });
  c.box(X(1), Y(gyb + 1), w, 1, { mat: m.stone, z: 0.6, n: [0, 0.5, 0.86] });
  if (h.shop) {
    const sr0 = rampOf(h.shopRamp?.[1] ?? PAL.green[1], PAL_HD.green);
    const sr = sr0.length < 5 ? PAL_HD.black : sr0;
    const fasc = face(c, sr, { lo: 1, hi: sr.length - 2, spec: 0.35, shine: 14 });
    const fh = 8;
    c.box(X(1), Y(gyb + 2), w, fh, { mat: fasc, z: 0.8, bevel: 0.5, tex: wood({ seed: h.seed, dir: 'h' }) });
    c.box(X(1), Y(gyb + 2), w, 0.8, { mat: fasc, z: 1.1, bevel: 0.3, tone: 0.15 });
    const k = textMask(h.shop, 'small');
    lettering(c, k, X(cxb) - k.w / 2 + 0.5, Y(gyb + 1) + 0.5, { ramp: PAL_HD.gold, shadow: PAL_HD.ink[0], lo: 2, hi: 7 });
    const doorW = 9;
    const wyb = gyb + 2 + fh + 1;
    const wx1 = w - doorW - 3;
    // Display window: frame, glass, goods; the shop door at the right.
    ring(c, X(2), Y(wyb), wx1 - 2, Hb - 3 - wyb, 1, { mat: m.trim, z: 0.3 });
    const gx = X(3);
    const gy = Y(wyb + 1);
    const gw = wx1 - 4;
    const gh = Hb - 5 - wyb;
    hole(c, gx, gy, gw, gh);
    c.plane(gx, gy, gw, gh, {
      mat: m.glass,
      z: -1.4,
      tex: (s) => {
        const u = (s.x - gx) / gw;
        const v = (s.y - gy) / gh;
        s.tone = -0.3 + (1 - v) * 0.25;
        if (Math.abs(u + v * 0.5 - 0.4) < 0.05) s.tone += 0.35;
      },
    });
    shopGoods(c, h.shop, gx, gy, gw, gh, h.seed);
    c.box(gx + gw / 2 - 0.3, gy, 0.6, gh, { mat: m.trim, z: -0.3 });
    const doorM = face(c, PAL_HD[DOOR_KEY(sr)], { lo: 1, hi: 4, spec: 0.3 });
    ring(c, X(wx1 + 1), Y(wyb), doorW, Hb - 1 - wyb, 1, { mat: m.trim, z: 0.3, open: 'bottom' });
    hole(c, X(wx1 + 2), Y(wyb + 1), doorW - 2, Hb - 2 - wyb);
    c.box(X(wx1 + 2), Y(wyb + 1), doorW - 2, Hb - 2 - wyb, { mat: doorM, z: -0.6, bevel: 0.3, tex: wood({ seed: 4, dir: 'v' }) });
    sash(c, m, X(wx1 + 3) - 0.5, Y(wyb + 2) - 0.5, doorW - 3, 9, { seed: h.seed + 5, bars: 'none', sill: false, curtain: 0, z: -0.4, fw: 0.5 });
    c.ellipsoid(X(wx1 + 3) + 0.4, Y(wyb + 14), 0.45, 0.45, { mat: m.brass, z: 0.2 });
    c.box(X(1), Y(Hb - 3), w, 3, { mat: m.stone, z: 0.5, bevel: 0.5, n: [0, -0.2, 0.98], tex: brick({ mortar: mortarM, bw: 6, bh: 3, joint: 0.35, wear: 0.6, seed: h.seed + 9 }) });
  } else {
    const left = hs(1, 9) < 0.5;
    const dw = 9;
    const dxb = left ? 3 : w - dw - 2;
    const dTop = gyb + 6;
    // Stone door frame, the fanlight with radial bars, the panelled door, the stoop.
    ring(c, X(dxb - 1), Y(dTop - 5), dw + 2, Hb - 3 - dTop + 5, 1, { mat: m.trim, z: 0.4, open: 'bottom' });
    const fx = X(dxb);
    const fy = Y(dTop - 4);
    hole(c, fx, fy, dw, Hb - 3 - dTop + 4);
    c.plane(fx, fy, dw, 3, {
      mat: m.glass,
      z: -1.2,
      tex: (s) => {
        s.tone = -0.05 + (1 - (s.y - fy) / 3) * 0.2;
      },
    });
    for (let k = 0; k < 5; k++) {
      const a = Math.PI * (0.1 + (k / 4) * 0.8);
      c.capsule(fx + dw / 2, fy + 3, fx + dw / 2 - Math.cos(a) * 4.2, fy + 3 - Math.sin(a) * 2.8, 0.2, 0.2, { mat: m.trim, z: -0.6 });
    }
    c.box(fx, fy + 2.7, dw, 0.7, { mat: m.trim, z: -0.4 });
    const doorRamp = DOOR_HD[Math.floor(hs(2, 9) * 4)];
    const doorM = face(c, doorRamp, { lo: 1, hi: Math.min(doorRamp.length - 2, 5), spec: 0.4, shine: 16 });
    const dy = Y(dTop);
    const dh = Hb - 3 - dTop;
    const dp = c.newPart();
    c.box(fx, dy, dw, dh, { mat: doorM, z: -0.8, part: dp });
    for (const lx of [0, dw / 2]) {
      for (const [py, ph] of [[1, dh * 0.42], [dh * 0.5, dh * 0.42]] as const) {
        c.box(fx + lx + 0.8, dy + py, dw / 2 - 1.6, ph, { mat: doorM, z: -0.6, part: dp, bevel: 0.45 });
      }
    }
    c.shade(fx + dw / 2 - 0.25, dy, 0.5, dh, () => -0.45, dp);
    c.ellipsoid(X(dxb + dw - 2) + 0.5, Y(dTop + 8) + 0.5, 0.45, 0.45, { mat: m.brass, z: 0.2 });
    c.box(fx + 1, dy + dh * 0.47, dw / 2 - 2, 0.6, { mat: m.brass, z: -0.4 });
    c.box(X(dxb - 2), Y(Hb - 3), dw + 4, 3, { mat: m.stone, z: 0.6, bevel: 0.4 });
    c.box(X(dxb - 2), Y(Hb - 3), dw + 4, 1, { mat: m.stone, z: 0.9, bevel: 0.35, n: [0, -0.6, 0.8] });
    c.box(X(dxb - 1), Y(Hb - 1.5), dw + 2, 1.5, { mat: m.stone, z: 0.8, bevel: 0.3, n: [0, -0.5, 0.86] });
    // The window beside the door, maybe with a cat on the sill inside.
    const ww = Math.max(4, w - dw - 12);
    const wxb = left ? dxb + dw + 4 : 3;
    const wwin = Math.min(ww, 22);
    const whin = gf - 10;
    sash(c, m, X(wxb), Y(gyb + 4), wwin, whin, { seed: h.seed * 13, bars: 'six', sill: false });
    c.box(X(wxb - 1) - 0.2, Y(gyb + 4 + whin), wwin + 2.4, 1, { mat: m.sill, z: 1, bevel: 0.35, n: [0, -0.45, 0.89] });
    if (hs(4, 9) < 0.25) {
      const kx = X(wxb + 3);
      const ky = Y(gyb + 4 + gf - 14);
      const fur = face(c, PAL_HD.black, { lo: 0, hi: 3, wrap: 0.3 });
      c.ellipsoid(kx + 2, ky + 2, 2.2, 1.6, { mat: fur, z: -1.2 });
      c.ellipsoid(kx + 0.9, ky + 0.2, 1.2, 1.1, { mat: fur, z: -1.1 });
      c.poly([[kx - 0.1, ky - 0.2], [kx + 0.3, ky - 1.5], [kx + 0.9, ky - 0.6]], { mat: fur, z: -1.05 });
      c.poly([[kx + 1.2, ky - 0.6], [kx + 1.8, ky - 1.5], [kx + 2.1, ky - 0.1]], { mat: fur, z: -1.05 });
      c.paint(kx + 0.2, ky - 0.1, 1.6, 0.8, (px, py) => (Math.hypot(px - (kx + 0.55), py - (ky + 0.25)) < 0.26 || Math.hypot(px - (kx + 1.35), py - (ky + 0.25)) < 0.26 ? PAL_HD.gold[5] : 0));
    }
    // Plinth stones along the foot of the facade.
    c.box(X(1), Y(Hb - 2), w, 2, { mat: m.stone, z: 0.2, tex: brick({ mortar: mortarM, bw: 5, bh: 2, joint: 0.35, wear: 0.7, seed: h.seed + 9 }) });
  }

  // ---- The lean: whole storeys shift (the ground floor stays, the gable leans most). ----
  if (lean !== 0) {
    const levels = h.floors + 2;
    shearRows(c, (Yart) => {
      const yb = (Yart + 0.5) / d - 1;
      const level = yb >= Hb - gf ? 0 : Math.min(levels - 1, 1 + Math.floor((Hb - gf - 1 - yb) / S));
      return Math.round(((lean * level) / (levels - 1)) * d);
    });
  }
  const buf = c.render({ outline: 'C', sep: true, sepZ: 0.7, ao: 0.3, shadow: 0.32, shadowMax: 2.5 });
  return fr(buf, cxb + (lean < 0 ? L : 0) + 1, OH, d);
}

/** The door ramp of a shop: a darker sibling of its fascia ramp. */
function DOOR_KEY(r: Ramp): 'navy' | 'green' | 'black' | 'red' | 'purple' {
  return r === PAL_HD.sky || r === PAL_HD.navy ? 'navy' : r === PAL_HD.green ? 'green' : r === PAL_HD.red ? 'red' : r === PAL_HD.purple || r === PAL_HD.pink ? 'purple' : 'black';
}

// ============================================================================== Fabel Friet

const FABEL = rowsMask(FABEL_SCRIPT);

/** Brick upper floors of a shop building (the 1× bond rows, at d). */
function brickWall(c: HdCanvas, x: number, y: number, w: number, h: number, ramp: Ramp, lo: number, hi: number, seed: number, part: number): number {
  const wallM = face(c, ramp, { lo, hi });
  const mortar = face(c, PAL_HD.stone, { lo: 1, hi: 4 });
  c.box(x, y, w, h, { mat: wallM, z: 0, part, tex: wallTex({ ramp, lo, hi, kind: 'brick', mortar: PAL_HD.stone, mlo: 1, mhi: 4 }, mortar, seed, y + h + 4, y) });
  return wallM;
}

/** FABEL FRIET (art.ts `fabelFriet`): 98 × 150, anchor (49, 150). */
export function fabelFrietHd(light: Light, d: D): Frame {
  const W = 98;
  const H = 150;
  const base = H - 1;
  const shopTop = base - 46;
  const c = new HdCanvas(W, H, d);
  const m = facadeMats(c);
  const wp = c.newPart();
  brickWall(c, 1, 12, W - 2, shopTop - 12, PAL_HD.red, 2, 5, 77, wp);
  c.shade(1, 12, 0.8, shopTop - 12, () => 0.12, wp);
  // White windows with stone lintels.
  for (const fy of [22, 56]) {
    for (const wx of fy === 56 ? [10, 42] : [10, 42, 74]) {
      c.box(wx - 2, fy - 2, 16, 1.1, { mat: m.trim, z: 0.7, bevel: 0.3 });
      c.box(wx - 1, fy - 1, 14, 1.2, { mat: m.trim, z: 0.5, bevel: 0.3, tone: -0.1 });
      sash(c, m, wx, fy, 12, 22, { seed: wx * 7 + fy, bars: 'six', sill: false });
      c.box(wx - 1.2, fy + 22, 14.4, 1, { mat: m.sill, z: 1, bevel: 0.35, n: [0, -0.45, 0.89] });
      streaks(c, wx - 1, fy + 23, 14, 6, wp, wx + fy);
    }
  }
  // The cornice on top with dentils and the crest.
  c.box(1, 6, W - 2, 6, { mat: m.trim, z: 1.5, bevel: 0.5, n: [0, 0.3, 0.95] });
  c.box(0.6, 5.8, W - 1.2, 1.4, { mat: m.trim, z: 2, bevel: 0.45, n: [0, -0.5, 0.86] });
  for (let x = 3; x < W - 2; x += 3) c.box(x - 0.1, 9.4, 1.2, 1.2, { mat: m.trim, z: 1.9, bevel: 0.3 });
  c.box(1, 11, W - 2, 1, { mat: m.stone, z: 1.2, n: [0, 0.6, 0.8] });
  c.box(30, 1, 38, 5, { mat: m.trim, z: 1.4, bevel: 0.5, r: 0.4 });
  // --- the cream wooden shopfront ---
  const cream = face(c, PAL_HD.sand, { lo: 3, hi: 7, spec: 0.2, shine: 12 });
  const sp = c.newPart();
  c.box(1, shopTop, W - 2, base - shopTop + 1, { mat: cream, z: 0.4, part: sp, tex: wood({ seed: 5, dir: 'v' }) });
  // Deep cornice: a moulded white top, a frieze with dentils, a shadow line.
  c.box(0, shopTop, W, 2.4, { mat: m.trim, z: 2, bevel: 0.5, n: [0, -0.45, 0.89] });
  c.box(0, shopTop + 2.2, W, 1.2, { mat: cream, z: 1.8, bevel: 0.3 });
  for (let x = 2; x < W - 1; x += 3) c.box(x - 0.2, shopTop + 3.6, 1.4, 1.4, { mat: cream, z: 1.7, bevel: 0.35 });
  c.box(0, shopTop + 5.2, W, 1.6, { mat: cream, z: 1.6, bevel: 0.4, n: [0, 0.5, 0.86] });
  // Pilasters with capitals.
  for (const px of [1, 56, W - 4]) {
    c.box(px, shopTop + 7, 3, base - shopTop - 7, { mat: m.trim, z: 1.2, bevel: 0.6 });
    c.box(px - 0.4, shopTop + 7, 3.8, 1.4, { mat: m.trim, z: 1.4, bevel: 0.4 });
  }
  // Display window: dark glass, the gold script, spaced FRIET, potatoes.
  const wx0 = 5;
  const wx1 = 54;
  const wy0 = shopTop + 10;
  const wy1 = base - 6;
  ring(c, wx0 - 1, wy0 - 1, wx1 - wx0 + 3, wy1 - wy0 + 3, 1, { mat: m.trim, z: 0.8 });
  const night = glow(c, PAL_HD.navy, { lo: 0, hi: 4 });
  hole(c, wx0, wy0, wx1 - wx0 + 1, wy1 - wy0 + 1);
  c.plane(wx0, wy0, wx1 - wx0 + 1, wy1 - wy0 + 1, {
    mat: night,
    z: -1.2,
    tex: (s) => {
      const u = s.x - wx0 + (s.y - wy0) * 0.8;
      s.tone = -0.35 + (1 - (s.y - wy0) / (wy1 - wy0)) * 0.2;
      const k = ((u % 7) + 7) % 7;
      if (k < 0.6) s.tone += 0.35;
      else if (k < 1.1) s.tone += 0.15;
    },
  });
  const potato = face(c, PAL_HD.sand, { lo: 2, hi: 6 });
  for (let k = 0; k < 40; k++) {
    const px = wx0 + 1 + h01(k, 1, 9) * (wx1 - wx0 - 1);
    const py = wy1 - 1 - h01(k, 2, 9) * 4.5;
    c.ellipsoid(px, py, 1.1 + h01(k, 3, 9) * 0.5, 0.8 + h01(k, 4, 9) * 0.3, { mat: potato, z: -1 + h01(k, 5, 9) * 0.2, tone: (h01(k, 6, 9) - 0.5) * 0.2 });
  }
  lettering(c, FABEL, wx0 + 9, wy0 + 2, { ramp: PAL_HD.gold, shadow: PAL_HD.gold[0], slant: 1 / 3, lo: 2, hi: 7 });
  c.capsule(wx0 + 6 + 0.5, wy0 + 2 + FABEL.h + 1.5, wx0 + 24 + 0.5, wy0 + 2 + FABEL.h + 1.2, 0.35, 0.25, { mat: m.brass, z: 1 });
  const fr1 = textMask('FRIET', 'small', 3);
  lettering(c, fr1, (wx0 + wx1) / 2 + 1 - fr1.w / 2 + 0.5, wy0 + 13, { ramp: PAL_HD.gold, shadow: PAL_HD.gold[0], lo: 2, hi: 7 });
  c.box(wx0, wy1 + 1, wx1 - wx0 + 1, 1, { mat: m.trim, z: 0.9, bevel: 0.3 });
  // Panelled stall riser under the window.
  for (let x = wx0; x < wx1; x += 12) c.box(x + 1.2, wy1 + 2.4, 9.6, base - wy1 - 3.6, { mat: cream, z: 0.8, part: sp, bevel: 0.6 });
  // The open door: the dark shop inside, the white leaf swung open at the right.
  const dx0 = 61;
  const dx1 = 79;
  const dy0 = shopTop + 10;
  ring(c, dx0 - 1, dy0 - 1, dx1 - dx0 + 3, base - dy0 + 2, 1, { mat: m.trim, z: 0.8, open: 'bottom' });
  const inside = face(c, PAL_HD.brickDark, { lo: 0, hi: 3 });
  hole(c, dx0, dy0, dx1 - dx0 + 1, base - dy0 + 1);
  const inMortar = face(c, PAL_HD.ink, { lo: 0, hi: 1 });
  c.box(dx0, dy0, dx1 - dx0 + 1, base - dy0 + 1, { mat: inside, z: -3, tex: brick({ mortar: inMortar, bw: 3, bh: 1.5, joint: 0.4, wear: 0.6, seed: 61 }) });
  c.shade(dx0, dy0, dx1 - dx0 + 1, base - dy0 + 1, (_x, y) => -Math.max(0, 0.5 - (y - dy0) * 0.04));
  const fryer = deco(c, PAL_HD.steel, { lo: 2, hi: 6, spec: 1, shine: 26 });
  c.box(dx0 + 2, dy0 + 6, 7, 4, { mat: fryer, z: -2, bevel: 0.5 });
  c.box(dx0 + 10, dy0 + 7, 6, 3, { mat: fryer, z: -2, bevel: 0.4, tone: -0.1 });
  c.paint(dx0 + 2.5, dy0 + 5, 6, 1, (px, py) => (h01(Math.floor(px * 2), Math.floor(py * 2), 3) > 0.7 ? PAL_HD.snow[4] : 0), -1.9);
  const leafM = face(c, PAL_HD.cloth, { lo: 3, hi: 6 });
  c.box(dx1 + 1, dy0, 5, base - dy0 + 1, { mat: leafM, z: 0.9, bevel: 0.4, n: [0.35, 0, 0.94] });
  c.plane(dx1 + 2, dy0 + 2, 3, 14, { mat: m.glass, z: 0.6, tex: (s) => { s.tone = 0.05 + (1 - (s.y - dy0) / 16) * 0.25; } });
  c.box(dx1 + 2, dy0 + 19, 3, base - dy0 - 21, { mat: cream, z: 1, bevel: 0.45 });
  c.box(dx0, shopTop + 8, dx1 - dx0 + 1, 1, { mat: cream, z: 0.9 });
  c.box(dx0 - 2, base - 1, dx1 - dx0 + 5, 2, { mat: m.stone, z: 1, bevel: 0.4, n: [0, -0.5, 0.86] });
  // The curly wrought-iron bracket for the hanging sign.
  const by = shopTop - 42;
  c.box(94, by - 3, 2, 8, { mat: m.iron, z: 2, bevel: 0.4 });
  c.capsule(76.5, by + 0.5, 95, by + 0.5, 0.5, 0.5, { mat: m.iron, z: 2.2 });
  c.capsule(80.5, by + 1.5, 94.5, by + 10, 0.4, 0.4, { mat: m.iron, z: 2.1 });
  for (const [x, y, r] of [[90.5, by + 4.5, 2], [82.5, by + 3.5, 1.1], [77.5, by - 1.5, 1.1]] as const) {
    c.plane(x - r - 0.5, y - r - 0.5, 2 * r + 1, 2 * r + 1, {
      mat: m.iron,
      z: 2.2,
      mask: (px, py) => {
        const q = Math.hypot(px - x, py - y);
        return q < r + 0.4 && q > r - 0.4;
      },
      normal: (px, py, n) => {
        n[0] = (px - x) * 0.4;
        n[1] = (py - y) * 0.4;
        n[2] = 0.8;
      },
    });
  }
  const buf = lightHd(c.render({ outline: 'C', sep: true, sepZ: 0.7, ao: 0.3, shadow: 0.32, shadowMax: 2.5 }), light);
  return fr(buf, 49, H, d);
}

/** The oval black hanging sign with gold `Fabel` / `FRIET` (4 swing frames); top-left = the hook. */
export function fabelSignHd(d: D): Frame[] {
  return [0, 1, 0, -1].map((swing) => {
    const c = new HdCanvas(42, 36, d);
    const iron = deco(c, PAL_HD.black, { lo: 0, hi: 4, spec: 0.6, shine: 18 });
    const board = deco(c, PAL_HD.black, { lo: 0, hi: 3, spec: 0.35, shine: 12, rimPx: false });
    const gilt = deco(c, PAL_HD.gold, { lo: 2, hi: 6, spec: 1, shine: 22 });
    const cx = 20 + swing;
    c.capsule(20.5, 1, 20.5, 4.5, 0.45, 0.45, { mat: iron, z: 1 });
    c.capsule(20.5, 4.5, cx - 7.5, 8.2, 0.3, 0.3, { mat: iron, z: 0.9 });
    c.capsule(20.5, 4.5, cx + 8.5, 8.2, 0.3, 0.3, { mat: iron, z: 0.9 });
    const ex = cx - 18 + 18.5;
    const ey = 7 + 14;
    c.plane(ex - 18.5, ey - 14, 37, 28, {
      mat: gilt,
      z: 1,
      mask: (px, py) => ((px - ex) / 18.5) ** 2 + ((py - ey) / 14) ** 2 <= 1,
      normal: (px, py, n) => {
        const q = ((px - ex) / 18.5) ** 2 + ((py - ey) / 14) ** 2;
        const k = q > 0.82 ? (q - 0.82) * 4 : 0;
        n[0] = ((px - ex) / 18.5) * k;
        n[1] = ((py - ey) / 14) * k;
        n[2] = 1;
      },
    });
    c.plane(ex - 17.5, ey - 13, 35, 26, {
      mat: board,
      z: 1.3,
      mask: (px, py) => ((px - ex) / 17.5) ** 2 + ((py - ey) / 13) ** 2 <= 1,
      normal: (px, py, n) => {
        n[0] = ((px - ex) / 17.5) * 0.35;
        n[1] = ((py - ey) / 13) * 0.35;
        n[2] = 1;
      },
    });
    lettering(c, FABEL, cx - 13, 11, { ramp: PAL_HD.gold, shadow: PAL_HD.gold[0], slant: 1 / 3, lo: 2, hi: 7 });
    c.capsule(cx - 13 + 6.5, 11 + FABEL.h + 1.5, cx - 13 + 24.5, 11 + FABEL.h + 1.3, 0.3, 0.22, { mat: gilt, z: 1.6 });
    const k = textMask('FRIET', 'small', 1);
    lettering(c, k, cx + 1 - k.w / 2 + 0.5, 22, { ramp: PAL_HD.gold, shadow: PAL_HD.gold[0], lo: 2, hi: 7 });
    return fr(c.render({ outline: 'C', sep: true, ao: 0.25 }), 20, 1, d);
  });
}

/** The small counter the baker stands behind (front decor, 30 × 18, feet). */
export function fabelCounterHd(d: D): Frame {
  const c = new HdCanvas(30, 18, d);
  const cream = deco(c, PAL_HD.sand, { lo: 3, hi: 7, spec: 0.2 });
  const top = deco(c, PAL_HD.gable, { lo: 2, hi: 6, spec: 0.3 });
  const paper = deco(c, PAL_HD.cloth, { lo: 2, hi: 6 });
  const fries = deco(c, PAL_HD.gold, { lo: 3, hi: 7 });
  const mayo = deco(c, PAL_HD.snow, { lo: 2, hi: 6, spec: 0.4 });
  c.box(1, 2, 28, 15, { mat: cream, z: 0, tex: wood({ seed: 3, dir: 'v' }) });
  c.box(5, 6.4, 20, 7.2, { mat: cream, z: 0.4, bevel: 0.6 });
  c.box(0, 1, 30, 3, { mat: top, z: 1, bevel: 0.5, n: [0, -0.4, 0.92] });
  // A paper cone of fries and a mayonnaise pot on the top.
  c.poly([[20.5, 1.4], [25.5, 1.4], [23, 0]], { mat: paper, z: 2 });
  for (let k = 0; k < 4; k++) c.capsule(21.4 + k, 0.8, 21.2 + k * 1.1, -0.2 + (k % 2) * 0.2, 0.3, 0.3, { mat: fries, z: 2.2 });
  c.ellipsoid(9, 0.5, 1.2, 0.8, { mat: mayo, z: 2 });
  return fr(c.render({ outline: 'C', sep: true, ao: 0.25 }), 15, 18, d);
}

/** The neighbour: orange-brown wooden shop with leaded glass, brick above (66 × 132, feet). */
export function neighbourHd(light: Light, d: D): Frame {
  const W = 66;
  const H = 132;
  const base = H - 1;
  const shopTop = base - 44;
  const c = new HdCanvas(W, H, d);
  const m = facadeMats(c);
  const wp = c.newPart();
  brickWall(c, 1, 14, W - 2, shopTop - 14, PAL_HD.brown, 1, 6, 5, wp);
  c.shade(1, 14, 0.8, shopTop - 14, () => 0.12, wp);
  for (const fy of [24, 58]) {
    for (const wx of [8, 37]) {
      c.box(wx - 1.2, fy - 1.4, 22.4, 1.2, { mat: m.trim, z: 0.6, bevel: 0.3 });
      sash(c, m, wx, fy, 20, 22, { seed: wx + fy * 3, bars: 'six', sill: false });
      c.box(wx - 1.2, fy + 22, 22.4, 1, { mat: m.sill, z: 1, bevel: 0.35, n: [0, -0.45, 0.89] });
      streaks(c, wx - 1, fy + 23, 22, 6, wp, wx * 3 + fy);
    }
  }
  // Cornice with a triangular pediment and an oculus.
  c.box(1, 8, W - 2, 6, { mat: m.trim, z: 1.5, bevel: 0.5, n: [0, 0.3, 0.95] });
  c.box(0.6, 7.8, W - 1.2, 1.3, { mat: m.trim, z: 2, bevel: 0.4, n: [0, -0.5, 0.86] });
  for (let x = 3; x < W - 2; x += 3) c.box(x - 0.1, 11.4, 1.2, 1.2, { mat: m.trim, z: 1.9, bevel: 0.3 });
  c.poly([[20, 8.6], [47, 8.6], [33.5, 1]], { mat: m.trim, z: 1.6, n: [0, -0.15, 0.99] });
  c.stroke([[20, 8.4], [33.5, 1], [47, 8.4]], 0.45, 0.45, { mat: m.trim, z: 1.9 });
  hole(c, 31, 4, 5, 5);
  c.plane(31, 4, 5, 5, {
    mat: m.glass,
    z: 1.2,
    mask: (px, py) => Math.hypot(px - 33.5, py - 6.5) < 2.3,
    tex: (s) => {
      s.tone = -0.1 + (6.5 - s.y) * 0.08;
    },
  });
  // Orange-brown wood shopfront: fascia, pilasters, leaded transom, window, door.
  const woodM = face(c, PAL_HD.rust, { lo: 1, hi: 5, spec: 0.25, shine: 14 });
  const sp = c.newPart();
  c.box(1, shopTop, W - 2, base - shopTop + 1, { mat: woodM, z: 0.4, part: sp, tone: -0.15, tex: wood({ seed: 8, dir: 'v' }) });
  c.box(0, shopTop, W, 5, { mat: woodM, z: 1.6, bevel: 0.5, tex: wood({ seed: 9, dir: 'h' }) });
  c.box(0, shopTop, W, 1, { mat: woodM, z: 1.9, bevel: 0.3, tone: 0.2 });
  for (const px of [1, 40, W - 4]) c.box(px, shopTop + 5, 3, base - shopTop - 5, { mat: woodM, z: 1.2, bevel: 0.6 });
  const lead = face(c, PAL_HD.black, { lo: 0, hi: 2 });
  const amber = glow(c, PAL_HD.gold, { lo: 2, hi: 6 });
  const pale = glow(c, PAL_HD.sky, { lo: 3, hi: 7 });
  hole(c, 5, shopTop + 7, 34, 29);
  c.plane(5, shopTop + 7, 34, 8, {
    mat: amber,
    z: -1,
    tex: (s) => {
      const u = s.x + s.y;
      const v = s.x - s.y;
      const du = Math.abs((((u % 4) + 4) % 4) - 2);
      const dv = Math.abs((((v % 4) + 4) % 4) - 2);
      if (du > 1.72 || dv > 1.72) {
        s.mat = lead;
        s.tone = 0;
        return;
      }
      if ((Math.floor(u / 4) + Math.floor(v / 4)) & 1) s.mat = pale;
      s.tone = 0.05 + (1 - (s.y - shopTop - 7) / 8) * 0.25;
    },
  });
  c.box(5, shopTop + 15, 34, 1, { mat: woodM, z: 0.8 });
  c.plane(5, shopTop + 16, 34, 20, {
    mat: m.glass,
    z: -1.2,
    tex: (s) => {
      const k = (((s.x - 5 + (s.y - shopTop - 16) * 0.65) % 6) + 6) % 6;
      s.tone = -0.28 + (1 - (s.y - shopTop - 16) / 20) * 0.22 + (k < 0.6 ? 0.35 : k < 1.1 ? 0.15 : 0);
    },
  });
  c.box(5, base - 7, 34, 6, { mat: woodM, z: 0.8, bevel: 0.5 });
  const dp = c.newPart();
  c.box(45, shopTop + 7, 16, base - shopTop - 7, { mat: woodM, z: 0.6, part: dp });
  c.box(46.5, shopTop + 26, 13, base - shopTop - 28, { mat: woodM, z: 0.8, part: dp, bevel: 0.6 });
  hole(c, 47, shopTop + 9, 12, 14);
  c.plane(47, shopTop + 9, 12, 14, {
    mat: m.glass,
    z: -0.6,
    tex: (s) => {
      const fy = s.y - (shopTop + 9);
      if ((fy % 3 < 0.35 && fy > 0.5) || Math.abs(s.x - 53.5) < 0.25) {
        s.mat = lead;
        s.tone = 0;
        return;
      }
      s.tone = 0.1 + (1 - fy / 14) * 0.25;
    },
  });
  c.ellipsoid(58.5, shopTop + 26, 0.5, 0.5, { mat: m.brass, z: 1.2 });
  const buf = lightHd(c.render({ outline: 'C', sep: true, sepZ: 0.7, ao: 0.3, shadow: 0.32, shadowMax: 2.5 }), light);
  return fr(buf, W >> 1, H, d);
}
