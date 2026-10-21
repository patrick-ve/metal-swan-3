/**
 * The church interior's painter kit (CHURCH, wave B; docs/ART_GUIDE.md "UHD art"): the
 * registration of the church's sprites and background generators (1×, 2× and 4× from ONE
 * density-generic drawer each; the geometry of a dense frame is its 1× frame's), and the shared
 * materials of the nave and the crypt: Bentheimer sandstone (block courses, weather streaks,
 * grain and soot), dark oak, wrought iron, brass and gilt, linen, candle flames, stained glass.
 *
 * Built on the town kit (missions/oldenzaal/art-kit.ts: `Pen`, `T`, `F`, `mx`, `dim`, `tones`,
 * `pick`, `dq`, `outlineC`, `archPointed`, `archRound`), but with its own registries
 * (`OZ_CHURCH_SPRITES`, `OZ_CHURCH_BGS`), so the town's lists stay the town's.
 *
 * The light inside: a cold moon ambient from the upper left (the aisle windows), warm candle
 * light low down where the candles stand. The darkness itself is the light pass's (the section
 * light configs); the art is painted at a moderate key so the pass can darken it.
 *
 * Same input, same pixels: no randomness except the hashes callers pass.
 */
import type { Color } from '../../../../engine/color';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { defineBgGenerator } from '../../../art/art-registry';
import { archPointed, archRound, dim, dq, F, h2, mx, num, outlineA, outlineC, Pen, pick, snap, str, T, tinyText, tinyWidth, tones, type Dn, type Params, type Rn } from '../../missions/oldenzaal/art-kit';

export { archPointed, archRound, dim, dq, F, h2, mx, num, outlineA, outlineC, Pen, pick, snap, str, T, tinyText, tinyWidth, tones, type Dn, type Params, type Rn };

// ------------------------------------------------------------------------------------ registration

/** Every sprite id the church registers (tests). */
export const OZ_CHURCH_SPRITES: string[] = [];
/** Every background generator id the church registers (tests). */
export const OZ_CHURCH_BGS: string[] = [];

export interface FrameGeom {
  w: number;
  h: number;
  ox: number;
  oy: number;
}

export type Draw = (p: Pen, frame: number) => void;

/** Register sprite `id`: one frame per geometry, each drawn by `draw(pen, i)` at d 1, 2 and 4. */
export function regC(id: string, geoms: readonly FrameGeom[], draw: Draw, o: { defer?: boolean; ticksPerFrame?: number } = {}): void {
  const frames = (d: Dn): Frame[] =>
    geoms.map((g, i) => {
      const p = new Pen(g.w, g.h, d);
      draw(p, i);
      return p.frame(g.ox, g.oy);
    });
  defineSprite(id, () => frames(1), { hd: (d) => frames(d), defer: o.defer, ticksPerFrame: o.ticksPerFrame ?? 8 });
  OZ_CHURCH_SPRITES.push(id);
}

/** n frames of the same geometry. */
export function same(n: number, g: FrameGeom): FrameGeom[] {
  return Array.from({ length: n }, () => g);
}

export type BgDraw = (p: Pen, params: Params, seed: number) => void;

/** Register a background generator (1× and HD from one drawer; the pen wraps in x, layers tile). */
export function regCBg(id: string, draw: BgDraw): void {
  const gen = (w: number, h: number, params: Params, seed: number, d: Dn) => {
    const p = new Pen(w, h, d, true);
    draw(p, params, seed);
    return p.finish();
  };
  defineBgGenerator(id, (w, h, params, seed) => gen(w, h, params, seed, 1), { hd: (w, h, params, seed, d) => gen(w, h, params, seed, d) });
  OZ_CHURCH_BGS.push(id);
}

// ------------------------------------------------------------------------------------ grades

/** The cold air of the dark church (the moon ambient): every material is graded toward it a little. */
export const COLD: Color = T('night', 2, 2);
/** The warm candle air (the low warm bounce near the candles). */
export const WARM: Color = T('candle', 2, 2);

/** Tones of ramp n graded toward the cold church air by t. */
export function ct(n: Rn, d: Dn, t = 0.16): readonly Color[] {
  return tones(n, d, COLD, t);
}

/** Tones of ramp n graded toward the warm candle air by t. */
export function wt(n: Rn, d: Dn, t = 0.12): readonly Color[] {
  return tones(n, d, WARM, t);
}

// ------------------------------------------------------------------------------------ sandstone

export interface StoneOpts {
  /** The base tone (sandstone ramp, 0 … 7). */
  k: number;
  /** Hash seed. */
  seed: number;
  /** Block size (logical px). */
  bw?: number;
  bh?: number;
  /** Draw the course / block joints (default true). */
  joints?: boolean;
  /** Tone change per logical px down (a light from above: negative = darker lower down). */
  grad?: number;
  /** The rect's top y (for `grad`). */
  y0?: number;
  /** The rect's left x (block grid origin). */
  x0?: number;
  /** Soot and damp (0 … 1): darker blotches and streaks. */
  grime?: number;
  /** The grade toward the cold air. */
  air?: number;
}

/**
 * The Bentheimer sandstone face shader (ashlar): blocks bw × bh with joints, a tone per block,
 * dark weather and soot streaks, grain at 4×, tiny chips. Returns a shader for `Pen.fill`.
 */
export function ashlar(p: Pen, o: StoneOpts): (X: number, Y: number) => Color {
  const d = p.d;
  const st = ct('sandstone', d, o.air ?? 0.16);
  const bw = (o.bw ?? 12) * d;
  const bh = (o.bh ?? 6) * d;
  const x0 = (o.x0 ?? 0) * d;
  const y0 = (o.y0 ?? 0) * d;
  const grad = (o.grad ?? 0) / d;
  const grime = o.grime ?? 0.3;
  const joints = o.joints ?? true;
  const seed = o.seed;
  return (X: number, Y: number): Color => {
    const yy = Y - y0;
    const row = Math.floor(yy / bh);
    const xx = X - x0 + (row & 1 ? bw >> 1 : 0);
    const col = Math.floor(xx / bw);
    const u = xx - col * bw;
    const v = yy - row * bh;
    let k = o.k + (h2(col, row, seed) - 0.5) * 1.1 + yy * grad;
    if (joints) {
      if (d === 1) {
        if (v === bh - 1 || u === 0) return pick(st, k - 1.3);
      } else {
        if (v >= bh - 1 || u < 1) return pick(st, k - 1.35);
        if (v === 0 || u === 1) k += 0.55; // the lit arris (light from the upper left)
        if (d >= 4 && (v === bh - 2 || u === bw - 1)) k -= 0.45;
      }
    }
    // Weather and soot streaks running down the face, damp blotches.
    const s = h2(Math.floor(X / (3 * d)), 3, seed + 17);
    if (s > 1 - grime * 0.35) k -= (s - (1 - grime * 0.35)) * 6 * (0.6 + 0.4 * Math.sin(Y / (9 * d) + s * 7));
    // Damp: a soft darkening of a few whole blocks, fading down them (never a square hole).
    if (grime > 0 && h2(col, row, seed + 23) > 1 - grime * 0.25) k -= 0.35 + 0.35 * (v / bh);
    if (d >= 4) {
      const g = h2(X, Y, seed + 5);
      if (g > 0.93) k -= 0.6;
      else if (g < 0.035) k += 0.5;
    }
    return pick(st, dq(k, X, Y, 0.7));
  };
}

/**
 * A round shaft (a column or a pillar's drum) between logical x0 and x0 + w: tone k at its lit
 * side (u ≈ 0.3), darker to the right edge; `rough` sandstone grain; course joints every `bh`.
 */
export function shaft(p: Pen, x0: number, y0: number, w: number, h: number, o: { k: number; seed: number; bh?: number; grime?: number; air?: number; warmLow?: number }): void {
  const d = p.d;
  const st = ct('sandstone', d, o.air ?? 0.16);
  const bh = (o.bh ?? 7) * d;
  const seed = o.seed;
  const Y0 = Math.round(y0 * d);
  const Ytot = h * d;
  p.fill(x0, y0, w, h, (X, Y) => {
    const u = ((X + 0.5) / d - x0) / w;
    const shade = Math.cos((u - 0.32) * Math.PI * 0.95);
    let k = o.k - 2.2 + 3 * Math.max(0, shade) + (u < 0.06 ? -0.8 : 0);
    const yy = Y - Y0;
    const row = Math.floor(yy / bh);
    k += (h2(row, 1, seed) - 0.5) * 0.7;
    if (d >= 2 && yy - row * bh >= bh - 1) k -= 1.1;
    if (d === 1 && yy - row * bh === bh - 1) k -= 1;
    const s = h2(Math.floor(X / (2 * d)), 5, seed + 31);
    if (s > 0.86) k -= (s - 0.86) * 7;
    if (o.warmLow && yy > Ytot * 0.7) k += o.warmLow * ((yy - Ytot * 0.7) / (Ytot * 0.3));
    if (d >= 4 && h2(X, Y, seed + 7) > 0.92) k -= 0.5;
    return pick(st, dq(k, X, Y, 0.8));
  });
}

/** A moulding (a horizontal ledge / string course) at logical y: lit top, dark underside. */
export function moulding(p: Pen, x: number, y: number, w: number, h: number, k: number, air = 0.16): void {
  const d = p.d;
  const st = ct('sandstone', d, air);
  p.rect(x, y, w, h, pick(st, k));
  p.rect(x, y, w, d === 1 ? 1 : Math.max(1 / d, h * 0.25), pick(st, k + 1.6));
  p.rect(x, y + h - (d === 1 ? 1 : Math.max(1 / d, h * 0.25)), w, d === 1 ? 1 : Math.max(1 / d, h * 0.25), pick(st, k - 2));
  if (d >= 2) p.rect(x, y + h, w, Math.max(1 / d, h * 0.3), pick(st, k - 3.2));
}

// ------------------------------------------------------------------------------------ wood, iron, brass

/** Dark oak: tone k (wood ramp; 0 … 7), grain along x (`vertical` false) or y. */
export function oak(p: Pen, x: number, y: number, w: number, h: number, k: number, seed: number, o: { vertical?: boolean; air?: number } = {}): void {
  const d = p.d;
  const wd = ct('wood', d, o.air ?? 0.2);
  p.fill(x, y, w, h, (X, Y) => {
    const a = o.vertical ? X : Y;
    const b = o.vertical ? Y : X;
    let kk = k + (h2(Math.floor(a / d), 9, seed) - 0.5) * 0.6;
    if (d >= 2) kk += Math.sin(b / (5 * d) + h2(Math.floor(a / Math.max(1, d >> 1)), 2, seed) * 6) * 0.35;
    if (d >= 4 && h2(X, Y, seed + 3) > 0.94) kk -= 0.6;
    return pick(wd, dq(kk, X, Y, 0.6));
  });
}

/** A lit box of oak: front tone k, a lit top edge and left edge, a dark right and bottom edge. */
export function oakBox(p: Pen, x: number, y: number, w: number, h: number, k: number, seed: number, o: { vertical?: boolean; air?: number } = {}): void {
  const d = p.d;
  const wd = ct('wood', d, o.air ?? 0.2);
  oak(p, x, y, w, h, k, seed, o);
  const e = d === 1 ? 1 : Math.max(1 / d, Math.min(1, w / 8));
  p.rect(x, y, w, e, pick(wd, k + 1.6));
  p.rect(x, y, e, h, pick(wd, k + 0.9));
  p.rect(x + w - e, y, e, h, pick(wd, k - 1.2));
  p.rect(x, y + h - e, w, e, pick(wd, k - 1.6));
}

/** Iron tones (the black ramp, cold). */
export function ironT(d: Dn): readonly Color[] {
  return ct('black', d, 0.12);
}

/** Brass / gilt tones (the gold ramp, a little dulled by dust). */
export function brassT(d: Dn): readonly Color[] {
  return ct('gold', d, 0.24);
}

// ------------------------------------------------------------------------------------ flames, glass

/**
 * A small candle flame with its core at logical (cx, cy) (the wick top), height hgt, frame f
 * (flicker: the tip sways), at d: a pale core, an amber body, a red-brown base.
 */
export function flame(p: Pen, cx: number, cy: number, hgt: number, f: number): void {
  const d = p.d;
  const sway = [0, 0.35, -0.3, 0.15][f & 3] * (hgt / 4);
  if (d === 1) {
    p.rect(cx - 0.5, cy - hgt, 1, hgt, T('candle', 5, 1));
    p.rect(cx - 0.5, cy - 1, 1, 1, T('candle', 6, 1));
    return;
  }
  const r = Math.max(0.5, hgt * 0.32);
  p.disc(cx + sway * 0.3, cy - hgt * 0.38, r, hgt * 0.42, (_X, _Y, u, v) => {
    const q = u * u + v * v;
    if (q < 0.25) return T('candle', 6, d);
    if (q < 0.55) return T('candle', 5, d);
    return v > 0.4 ? T('candle', 3, d) : T('candle', 4, d);
  });
  p.poly(
    [
      [cx - r * 0.6 + sway * 0.3, cy - hgt * 0.5],
      [cx + sway, cy - hgt],
      [cx + r * 0.6 + sway * 0.3, cy - hgt * 0.5],
    ],
    T('candle', 4, d),
  );
  p.rect(cx - 0.5 / d, cy - 0.5, 1 / d, 0.5, T('ink', 0, d));
}

/** The stained glass palette of a window (deep, dark-ish: the moon behind; the flash lights them). */
export function glassTones(d: Dn): readonly (readonly Color[])[] {
  return [ct('navy', d, 0.1), ct('red', d, 0.1), ct('gold', d, 0.2), ct('teal', d, 0.15), ct('purple', d, 0.1), ct('sky', d, 0.2)];
}

/**
 * A stained-glass lancet: the pointed light opening at (x, y) w × h filled with lead-lined
 * panes (diamond quarries in the borders, small coloured medallions in the field), tone `lit`
 * (0 = dark glass, 1 = the glass lit from behind). No figures: ornament only (our own design).
 */
export function lancet(p: Pen, x: number, y: number, w: number, h: number, seed: number, lit = 0.5): void {
  const d = p.d;
  const gl = glassTones(d);
  const lead = T('ink', 0, d);
  const k0 = 2 + lit * 2.4;
  archPointed(p, x, y, w, h, (X, Y) => {
    const lx = (X + 0.5) / d - x;
    const ly = (Y + 0.5) / d - y;
    // The border band and its quarries.
    const bor = Math.min(lx, w - lx) < Math.max(1, w * 0.18);
    if (bor) {
      const q = (Math.floor((lx + ly) / 2) + Math.floor((ly - lx) / 2)) & 1;
      if (d >= 2 && ((Math.round((lx + ly) * d) % (2 * d) === 0) || Math.round((ly - lx) * d) % (2 * d) === 0)) return lead;
      return pick(gl[q ? 2 : 5], k0 - 0.6 + h2(Math.floor(lx), Math.floor(ly), seed) * 0.8);
    }
    // The field: stacked medallions (a quatrefoil of lead in each) on a ground of small diamond
    // quarries in deep blue with a ruby fleck at the crossings.
    const mh = Math.max(7, w * 1.15);
    const mi = Math.floor(ly / mh);
    const my = ly - mi * mh - mh / 2;
    const mx0 = lx - w / 2;
    const rr = mx0 * mx0 + my * my;
    const R = w * 0.27;
    if (d >= 2 && Math.abs(Math.sqrt(rr) - R) < 0.3) return lead;
    if (rr < R * R) {
      if (d >= 2 && (Math.abs(mx0) < 0.2 || Math.abs(my) < 0.2)) return lead;
      const which = (mi + seed) % 3;
      const g = which === 0 ? gl[1] : which === 1 ? gl[3] : gl[2];
      const petal = (mx0 > 0 ? 1 : 0) + (my > 0 ? 2 : 0);
      const kk = k0 + 0.2 - Math.sqrt(rr) / R + (petal === 1 || petal === 2 ? -0.5 : 0.2) + (h2(Math.floor(lx * 2), Math.floor(ly * 2), seed + mi) - 0.5) * 0.6;
      return pick(g, dq(kk, X, Y, 0.6));
    }
    const qa = lx + ly * 0.8;
    const qb = ly * 0.8 - lx;
    const qs = 2.6;
    if (d >= 2 && (Math.abs(qa / qs - Math.round(qa / qs)) < 0.5 / (qs * d) || Math.abs(qb / qs - Math.round(qb / qs)) < 0.5 / (qs * d))) return lead;
    const cell = h2(Math.floor(qa / qs), Math.floor(qb / qs), seed + 5);
    return pick(cell > 0.9 ? gl[1] : gl[0], dq(k0 - 0.6 + (cell - 0.5) * 1.2, X, Y, 0.6));
  });
}

/** A thin cobweb in a corner: strands from the corner (cx, cy) fanning toward dir (−1 left / 1 right). */
export function cobweb(p: Pen, cx: number, cy: number, r: number, dir: -1 | 1, seed: number): void {
  const d = p.d;
  if (d === 1) {
    p.line(cx, cy, cx + dir * r * 0.8, cy + r * 0.5, T('stone', 1, 1));
    return;
  }
  const silk = mx(T('stone', 4, d), COLD, 0.3, d);
  const silkD = mx(T('stone', 3, d), COLD, 0.4, d);
  for (let i = 0; i < 4; i++) {
    const a = (i / 3) * (Math.PI / 2);
    p.line(cx, cy, cx + dir * Math.cos(a) * r, cy + Math.sin(a) * r, i % 2 ? silkD : silk);
  }
  for (let k = 1; k <= 3; k++) {
    const rr = (r * k) / 3.4;
    let px = cx + dir * rr;
    let py = cy;
    for (let i = 1; i <= 3; i++) {
      const a = (i / 3) * (Math.PI / 2);
      const sag = 0.12 * rr + h2(k, i, seed) * 0.4;
      const nx = cx + dir * Math.cos(a) * rr;
      const ny = cy + Math.sin(a) * rr;
      p.line(px, py, (px + nx) / 2 + dir * -sag * 0.3, (py + ny) / 2 + sag * 0.3, silkD);
      p.line((px + nx) / 2 + dir * -sag * 0.3, (py + ny) / 2 + sag * 0.3, nx, ny, silkD);
      px = nx;
      py = ny;
    }
  }
}

/** Dust on a top surface: a lighter, desaturated speckle on the px of a logical rect that are set. */
export function dustOn(p: Pen, x: number, y: number, w: number, h: number, amount: number, seed: number): void {
  const d = p.d;
  if (d === 1) return;
  const dust = mx(T('stone', 3, d), COLD, 0.25, d);
  p.tint(x, y, w, h, (X, Y, old) => (h2(X, Y, seed) < amount ? mx(old, dust, 0.55, d) : 0));
}

/** The px value v (a tone index) picked from a tone list with dithering (shorthand). */
export function dp(list: readonly Color[], v: number, X: number, Y: number, z = 0.6): Color {
  return pick(list, dq(v, X, Y, z));
}
