/**
 * Mission `ams` UHD decor kit of sections a and b (docs/ART_GUIDE.md "UHD art"): small helpers the
 * density-generic decor drawers share (art-hd-ab-*.ts). Every drawer takes d ∈ {2, 4}, draws on
 * an HdCanvas in LOGICAL px (the 1× frame's size) and returns a frame with the 1× anchor.
 *
 * - materials: `face` (walls, trims: soft wrap, no rim), `deco` (street furniture: lit like a
 *   sprite, outline C at render), `glow` (lamps, lit glass: no light).
 * - `sash`: a canal-house window (white frame, glass reflecting the sky, glazing bars, lace or
 *   drapes, a sill casting its shadow).
 * - `lettering`: crisp sign lettering at d from the 1× bitmap fonts (rounded corners, filled
 *   inner corners, a gilded bevel and a drop shadow): FABEL FRIET, the shop fasciae, HOTDOGS.
 * - `shearRows`: the lean of a canal house (whole storeys shift; the G-buffer moves before the
 *   render, so light, shadows and the outline follow the leaning shape).
 * - `lightHd`: the section light (golden, sunset) as an HD ramp remap (morning and noon keep it).
 *
 * Deterministic: hashes only, no Math.random.
 */
import type { Color } from '../../../../engine/color';
import { drawText, getFont, measure } from '../../../../engine/font';
import { PAL_HD, hdHome } from '../../../../engine/palette-hd';
import { PixelBuffer, type Ramp } from '../../../../engine/pixel';
import type { FontId, Frame } from '../../../../engine/render';
import type { DenseDensity } from '../../../../engine/sprites';
import { HdCanvas, type HdMaterial } from '../../../art/hd/index';
import { hash2 } from '../../../art/paint';
import type { Light } from './art';

export type D = DenseDensity;
export type P = readonly [number, number];

/** A dense frame with the 1× anchor (logical px). */
export function fr(buf: PixelBuffer, ox: number, oy: number, d: number): Frame {
  return { buf, ox, oy, density: d };
}

/** A hash in 0..1 of up to three integers. */
export function h01(a: number, b = 0, seed = 0): number {
  return hash2(a, b, seed);
}

/** Facade material: walls, trims, stone (soft wrap, no rim light). */
export function face(c: HdCanvas, ramp: Ramp, o: Partial<HdMaterial> = {}): number {
  return c.material({ ramp, wrap: 0.1, rim: 0, ...o });
}

/** Street-furniture material: lit like a sprite (crisp terminator, a little rim). */
export function deco(c: HdCanvas, ramp: Ramp, o: Partial<HdMaterial> = {}): number {
  return c.material({ ramp, wrap: 0.05, rim: 0.15, ...o });
}

/** No light: the tone alone picks the band (lamps, lit glass, water, painted signs). */
export function glow(c: HdCanvas, ramp: Ramp, o: Partial<HdMaterial> = {}): number {
  return c.material({ ramp, flat: true, lo: 0, hi: ramp.length - 1, ...o });
}

/** The HD ramp of a 1× palette colour's material (painted doors, shop fasciae, bike frames). */
export function rampOf(c: Color, fallback: Ramp = PAL_HD.steel): Ramp {
  return hdHome(c)?.ramp ?? fallback;
}

/** Cut the facade open over (x, y, w, h): what is drawn there goes, so a recessed part (glass, a door) shows. */
export function hole(c: HdCanvas, x: number, y: number, w: number, h: number): void {
  c.erase(x, y, w, h, () => true);
}

/**
 * A frame of thickness t round the rectangle (x, y, w, h) (outer size), as one bevelled part:
 * window and door frames, so what sits inside (glass, a door leaf) stays visible.
 */
export function ring(c: HdCanvas, x: number, y: number, w: number, h: number, t: number, o: { mat: number; z: number; bevel?: number; part?: number; open?: 'bottom' }): number {
  const part = o.part ?? c.newPart();
  const b = { mat: o.mat, z: o.z, part, bevel: o.bevel ?? Math.min(0.45, t * 0.5) };
  c.box(x, y, w, t, b);
  if (o.open !== 'bottom') c.box(x, y + h - t, w, t, b);
  c.box(x, y, t, h, b);
  c.box(x + w - t, y, t, h, b);
  return part;
}

// ============================================================================== windows

export interface WinMats {
  /** White painted frame and glazing bars. */
  frame: number;
  glass: number;
  /** Warm lit glass (a lamp inside). */
  lit: number;
  /** Lace (light cloth). */
  lace: number;
  /** Drapes (velvet, one ramp per look). */
  drapes: readonly number[];
  /** Stone sill. */
  sill: number;
}

/** The window materials of a facade canvas. */
export function winMats(c: HdCanvas): WinMats {
  return {
    frame: face(c, PAL_HD.gable, { lo: 3, hi: 6, spec: 0.15, shine: 10 }),
    glass: glow(c, PAL_HD.glass),
    lit: glow(c, PAL_HD.gold, { lo: 3, hi: 7 }),
    lace: face(c, PAL_HD.cloth, { lo: 2, hi: 5, wrap: 0.3 }),
    drapes: [face(c, PAL_HD.red, { lo: 1, hi: 5, wrap: 0.3 }), face(c, PAL_HD.green, { lo: 1, hi: 5, wrap: 0.3 }), face(c, PAL_HD.purple, { lo: 1, hi: 4, wrap: 0.3 })],
    sill: face(c, PAL_HD.stone, { lo: 2, hi: 7 }),
  };
}

export interface SashOpts {
  seed: number;
  /** Depth of the wall face (logical px; the glass sits 1.4 px behind it). */
  z?: number;
  /** Warm light inside. */
  lit?: boolean;
  /** Glazing bars: 'sash' (one transom, an upright when wide), 'six' (six panes), 'none'. */
  bars?: 'sash' | 'six' | 'none';
  /** Curtain: 0 none, 1 lace valance, 2 drapes; default from the seed. */
  curtain?: 0 | 1 | 2;
  /** Draw the stone sill (default true). */
  sill?: boolean;
  /** Frame width in logical px (default 1, the 1× frame). */
  fw?: number;
}

/**
 * A canal-house sash window over the 1× rectangle (x, y, w, h) (frame included): white frame,
 * glass reflecting the sky (lighter at the top, a diagonal sheen), glazing bars, lace or drapes
 * behind the glass, a stone sill that casts its shadow down the wall.
 */
export function sash(c: HdCanvas, m: WinMats, x: number, y: number, w: number, h: number, o: SashOpts): void {
  const z = o.z ?? 0;
  const fw = o.fw ?? 1;
  const seed = o.seed;
  const gx = x + fw;
  const gy = y + fw;
  const gw = w - 2 * fw;
  const gh = h - 2 * fw;
  // Frame: a bevelled white box; the glass is recessed in it.
  if (gw > 0 && gh > 0) hole(c, gx, gy, gw, gh);
  const fp = ring(c, x, y, w, h, fw, { mat: m.frame, z: z + 0.25 });
  if (gw <= 0 || gh <= 0) return;
  const curtain = o.curtain ?? (h01(seed, 3, 71) < 0.45 ? 1 : h01(seed, 4, 71) < 0.3 ? 2 : 0);
  const sheen = h01(seed, 1, 72);
  const tilt = 0.55 + h01(seed, 2, 72) * 0.5;
  c.plane(gx, gy, gw, gh, {
    mat: o.lit ? m.lit : m.glass,
    z: z - 1.4,
    tex: (s) => {
      const u = (s.x - gx) / gw;
      const v = (s.y - gy) / gh;
      if (o.lit) {
        s.tone = 0.25 + (1 - v) * 0.15 - Math.abs(u - 0.5) * 0.2;
        return;
      }
      // The sky reflected: lighter at the top, darker down; a soft diagonal sheen across some panes.
      s.tone = -0.18 + (1 - v) * 0.22;
      const st = Math.abs(u * tilt + v - 0.35 - sheen * 0.5);
      if (st < 0.07) s.tone += 0.42;
      else if (st < 0.15) s.tone += 0.2;
    },
  });
  // Curtains behind the glass (drawn on the glass plane, so the reflection stays on top of them).
  if (!o.lit && curtain > 0 && gh >= 3) {
    if (curtain === 1) {
      // Lace valance: a light band at the top with a scalloped hem.
      const vh = Math.min(gh * 0.38, 3.2);
      c.plane(gx, gy, gw, vh + 0.6, {
        mat: m.lace,
        z: z - 1.3,
        mask: (px, py) => py - gy < vh + Math.cos(((px - gx) / Math.max(1.4, gw / 3)) * Math.PI * 2) * 0.35,
        tex: (s) => {
          s.ny += 0.25;
          if (s.d >= 4 && h01(Math.floor(s.x * 4), Math.floor(s.y * 4), seed) > 0.8) s.tone -= 0.12;
          s.tone += -(s.y - gy) * 0.05;
        },
      });
    } else {
      const dm = m.drapes[Math.floor(h01(seed, 5, 73) * m.drapes.length)];
      const dw = Math.max(0.8, gw * 0.24);
      for (const side of [0, 1]) {
        const x0 = side === 0 ? gx : gx + gw - dw;
        c.plane(x0, gy, dw, gh, {
          mat: dm,
          z: z - 1.3,
          normal: (px, _py, n) => {
            // Vertical folds: the cloth turns left and right.
            const f = Math.sin(((px - x0) / Math.max(0.6, dw)) * Math.PI * 2.2 + side);
            n[0] = f * 0.45;
            n[1] = 0;
            n[2] = 0.9;
          },
          tex: (s) => {
            s.tone -= 0.05;
          },
        });
      }
    }
  }
  // Glazing bars.
  const bars = o.bars ?? 'sash';
  const bw = Math.max(0.5, Math.min(0.75, fw * 0.6));
  const bar = { mat: m.frame, z: z - 0.4, part: fp, bevel: 0.2 };
  if (bars === 'sash') {
    c.box(gx, gy + gh / 2 - bw / 2, gw, bw, bar);
    if (w >= 7) c.box(gx + gw / 2 - bw / 2, gy, bw, gh, bar);
  } else if (bars === 'six') {
    c.box(gx + gw / 2 - bw / 2, gy, bw, gh, bar);
    for (const t of [1 / 3, 2 / 3]) c.box(gx, gy + gh * t - bw / 2, gw, bw, bar);
  }
  // Sill: a stone slab that stands out of the wall (it throws a short shadow down the wall).
  if (o.sill ?? true) c.box(x - 0.5, y + h - 0.2, w + 1, 1.05, { mat: m.sill, z: z + 1, bevel: 0.35, n: [0, -0.45, 0.89] });
}

// ============================================================================== lettering

export interface Mask {
  w: number;
  h: number;
  m: Uint8Array;
}

const maskCache = new Map<string, Mask>();

/** The 1× bitmap of `text` in `font` (1 = glyph px), trimmed to the glyph rows of the font. */
export function textMask(text: string, font: FontId = 'small', gap = -1): Mask {
  const key = `${font}|${gap}|${text}`;
  const hit = maskCache.get(key);
  if (hit) return hit;
  const f = getFont(font);
  let w = 0;
  if (gap < 0) w = measure(text, font);
  else for (const ch of text) w += measure(ch, font) + gap;
  w = Math.max(1, w + 1);
  const h = f.height;
  const b = new PixelBuffer(w, h);
  if (gap < 0) drawText(b, text, 0, 0, { font, color: 0xffffffff });
  else {
    let x = 0;
    for (const ch of text) {
      drawText(b, ch, x, 0, { font, color: 0xffffffff });
      x += measure(ch, font) + gap;
    }
  }
  const m = new Uint8Array(w * h);
  for (let i = 0; i < m.length; i++) m[i] = (b.data[i] & 255) !== 0 ? 1 : 0;
  const out = { w, h, m };
  maskCache.set(key, out);
  return out;
}

/** A mask from rows of '#' / '.' (the FABEL script). */
export function rowsMask(rows: readonly string[]): Mask {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const m = new Uint8Array(w * h);
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) if (r[x] === '#') m[y * w + x] = 1;
  });
  return { w, h, m };
}

function maskAt(k: Mask, x: number, y: number): number {
  return x < 0 || y < 0 || x >= k.w || y >= k.h ? 0 : k.m[y * k.w + x];
}

/**
 * Is the logical point (lx, ly) (mask px units) inside the lettering? The 1× glyph px with
 * rounded outer corners and filled inner corners, so strokes read smooth and crisp at 2× and 4×.
 */
export function inMask(k: Mask, lx: number, ly: number, round = 0.58): boolean {
  const px = Math.floor(lx);
  const py = Math.floor(ly);
  const fx = lx - px;
  const fy = ly - py;
  const qx = fx < 0.5 ? -1 : 1;
  const qy = fy < 0.5 ? -1 : 1;
  const cx = qx < 0 ? fx : 1 - fx;
  const cy = qy < 0 ? fy : 1 - fy;
  const on = maskAt(k, px, py);
  const hN = maskAt(k, px + qx, py);
  const vN = maskAt(k, px, py + qy);
  if (on) return !(hN === 0 && vN === 0 && maskAt(k, px + qx, py + qy) === 0 && cx + cy < round);
  return hN === 1 && vN === 1 && cx + cy < round * 0.85;
}

export interface LetterOpts {
  /** Gilded / painted ramp of the letters (dark → light). */
  ramp: Ramp;
  /** Drop shadow colour (0 = none). */
  shadow?: Color;
  /** Italic slant: logical px to the right per mask row above the baseline. */
  slant?: number;
  /** Size of one mask px in logical px (default 1). */
  scale?: number;
  /** Index range of the ramp used (default 1 .. n − 1). */
  lo?: number;
  hi?: number;
  /** Mirror (a sign seen from behind never happens; for a flipped piece). */
  flip?: boolean;
}

/**
 * Paint a mask as crisp lettering with its top-left at logical (x, y): rounded at the d grid,
 * lit from the upper left (a light top edge, a darker lower right edge), a soft top-to-bottom
 * gilding and a drop shadow ½ px down-right. Fixed colours: the clean-up keeps them.
 */
export function lettering(c: HdCanvas, k: Mask, x: number, y: number, o: LetterOpts): void {
  const sc = o.scale ?? 1;
  const sl = o.slant ?? 0;
  const r = o.ramp;
  const lo = o.lo ?? 1;
  const hi = o.hi ?? r.length - 1;
  const e = 1 / c.d;
  const sh = Math.max(e, 0.5 * sc);
  const W = k.w * sc + Math.abs(sl) * k.h * sc + 2;
  const H = k.h * sc + 2;
  const inside = (px: number, py: number): boolean => {
    const my = (py - y) / sc;
    const mx = (px - x - sl * (k.h - my)) / sc;
    return inMask(k, o.flip ? k.w - mx : mx, my, c.d >= 4 ? 0.62 : 0.58);
  };
  c.paint(x - 1, y - 1, W + 1, H + 1, (px, py) => {
    if (inside(px, py)) {
      const v = (py - y) / (k.h * sc);
      let t = 0.78 - v * 0.55;
      if (!inside(px - e, py - e)) t += 0.3;
      else if (!inside(px + e, py + e)) t -= 0.35;
      const i = Math.max(lo, Math.min(hi, lo + Math.floor(t * (hi - lo + 1))));
      return r[i];
    }
    if (o.shadow && inside(px - sh, py - sh)) return o.shadow;
    return 0;
  });
}

// ============================================================================== lean

/**
 * Shift every art row Y of the canvas G-buffer by `shift(Y)` art px (right when positive):
 * a leaning facade. Px pushed past the edge are dropped (callers leave room).
 */
export function shearRows(c: HdCanvas, shift: (Y: number) => number): void {
  const { W, H } = c;
  const arrays = [c.mat, c.part, c.zb, c.pz, c.nx, c.ny, c.nz, c.tone, c.fix];
  for (let Y = 0; Y < H; Y++) {
    const s = shift(Y);
    if (s === 0) continue;
    const row = Y * W;
    for (const a of arrays) {
      if (s > 0) {
        for (let X = W - 1; X >= s; X--) a[row + X] = a[row + X - s];
        for (let X = 0; X < s; X++) a[row + X] = 0;
      } else {
        for (let X = 0; X < W + s; X++) a[row + X] = a[row + X - s];
        for (let X = W + s; X < W; X++) a[row + X] = 0;
      }
    }
  }
}

// ============================================================================== outline C

const discs = new Map<number, Int8Array>();
/** Offsets of a disc of radius r, nearest first (as the kit's outline ring). */
function disc(r: number): Int8Array {
  let o = discs.get(r);
  if (o) return o;
  const list: [number, number, number][] = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const q = dx * dx + dy * dy;
    if (q > 0 && q <= r * r + (r > 1 ? r * 0.5 : 0)) list.push([dx, dy, q]);
  }
  list.sort((a, b) => a[2] - b[2] || a[1] - b[1] || a[0] - b[0]);
  o = Int8Array.from(list.flatMap(([dx, dy]) => [dx, dy]));
  discs.set(r, o);
  return o;
}

/**
 * Outline C on a rendered buffer (render with outline 'none' first): ½ logical px round the
 * silhouette, the deepest tone of the neighbour's HD ramp on the lit side (up / left), ink on the
 * shadow side; empty px where `skip(X, Y)` holds stay open (the holes of a spoked wheel).
 */
export function outlineC(b: PixelBuffer, d: number, skip?: (X: number, Y: number) => boolean): PixelBuffer {
  const W = b.w;
  const H = b.h;
  const src = b.data.slice();
  const offs = disc(Math.max(1, d >> 1));
  const ink = PAL_HD.ink[0];
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const i = Y * W + X;
      if ((src[i] & 255) !== 0 || (skip && skip(X, Y))) continue;
      for (let q = 0; q < offs.length; q += 2) {
        const XX = X + offs[q];
        const YY = Y + offs[q + 1];
        if (XX < 0 || YY < 0 || XX >= W || YY >= H) continue;
        const c = src[YY * W + XX];
        if ((c & 255) === 0) continue;
        b.data[i] = offs[q] + offs[q + 1] >= 0 ? (hdHome(c)?.ramp[0] ?? ink) : ink;
        break;
      }
    }
  }
  return b.touch();
}

// ============================================================================== light

/** Ramp pairs of a section light: every tone of `from` moves to the same height in `to`. */
const LIGHT_RAMPS: Readonly<Record<Light, readonly (readonly [Ramp, Ramp])[]>> = {
  morning: [],
  noon: [],
  golden: [
    [PAL_HD.gable, PAL_HD.plaster],
    [PAL_HD.snow, PAL_HD.sand],
    [PAL_HD.cloth, PAL_HD.plaster],
    [PAL_HD.sky, PAL_HD.gold],
  ],
  sunset: [
    [PAL_HD.gable, PAL_HD.skinA],
    [PAL_HD.snow, PAL_HD.skinA],
    [PAL_HD.cloth, PAL_HD.skinA],
    [PAL_HD.plaster, PAL_HD.skinB],
    [PAL_HD.sand, PAL_HD.skinB],
    [PAL_HD.stone, PAL_HD.brickDark],
    [PAL_HD.sky, PAL_HD.orange],
    [PAL_HD.green, PAL_HD.olive],
  ],
};

/** Single colours of a light: the sky reflected in the glass turns gold (golden) or orange and pink (sunset). */
const LIGHT_COLOURS: Readonly<Record<Light, readonly (readonly [number, number])[]>> = {
  morning: [],
  noon: [],
  golden: [
    [PAL_HD.glass[4], PAL_HD.gold[5]],
    [PAL_HD.glass[5], PAL_HD.gold[6]],
  ],
  sunset: [
    [PAL_HD.glass[4], PAL_HD.orange[4]],
    [PAL_HD.glass[5], PAL_HD.pink[5]],
  ],
};

const lightMaps = new Map<Light, Map<number, number>>();

function lightMap(light: Light): Map<number, number> {
  let map = lightMaps.get(light);
  if (map) return map;
  map = new Map();
  for (const [a, b] of LIGHT_COLOURS[light]) map.set(a >>> 0, b >>> 0);
  for (const [from, to] of LIGHT_RAMPS[light]) {
    for (let i = 0; i < from.length; i++) {
      const j = Math.round((i / Math.max(1, from.length - 1)) * (to.length - 1));
      const k = from[i] >>> 0;
      if (!map.has(k)) map.set(k, to[j] >>> 0);
    }
  }
  lightMaps.set(light, map);
  return map;
}

/** Recolour a dense buffer in place for a section's light (PAL_HD to PAL_HD; morning and noon keep it). */
export function lightHd(b: PixelBuffer, light: Light): PixelBuffer {
  if (LIGHT_RAMPS[light].length === 0) return b;
  const map = lightMap(light);
  const d = b.data;
  for (let i = 0; i < d.length; i++) {
    const m = map.get(d[i]);
    if (m !== undefined) d[i] = m;
  }
  return b.touch();
}

