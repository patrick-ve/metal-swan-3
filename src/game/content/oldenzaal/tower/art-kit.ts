/**
 * The tower's paint kit (oz-f; docs/ART_GUIDE.md "UHD art"). Owner: TOWER.
 *
 * ONE drawer per id makes the 1×, 2× and 4× art: the town kit's `Pen` (missions/oldenzaal/art-kit.ts,
 * the ring's scenery pen) at d ∈ {1, 2, 4}; colours by ramp NAME (`T`: PAL_HD + PAL_HD_OZ; `R`: the
 * revision-2 ramps rot / fieldGrey / rust / soot), snapped to the 64-colour `PAL` at d 1. Geometry is
 * law: a frame has the same logical size, anchor and points at every density.
 *
 * - `reg(id, geoms, draw, o)`: a sprite (one frame per geometry) — its own list `TOWER_SPRITES`
 *   (the town's lists stay the town's).
 * - `regBg(id, draw)`: a background generator (`TOWER_BGS`).
 * - `lit(n, l, d)`: the tone of ramp n for a light value l (0 = the deepest shade … 1 = the
 *   highlight) between the ramp's `lo` and `hi` bands: form shading for volumes (cylinders, the
 *   bells, the pods, beams).
 * - `shadeCyl(u, v)`: a light value for a cylinder seen side-on (u ∈ [−1, 1] across it), lit from
 *   the upper left (the key light of the UHD kit), with a cool bounce on the right edge.
 */
import type { Color } from '../../../../engine/color';
import { PAL_HD_OZ_R2, type HdOzR2RampName } from '../../../../engine/palette-hd';
import type { Frame } from '../../../../engine/render';
import { defineSprite } from '../../../../engine/sprites';
import { defineBgGenerator } from '../../../art/art-registry';
import { bay, dim, dq, F, h2, mx, outlineA, outlineC, Pen, rampOf, snap, T, type Dn, type Rn } from '../../missions/oldenzaal/art-kit';

export { bay, dim, dq, F, h2, mx, outlineA, outlineC, Pen, snap, T, type Dn, type Rn };

/** Any ramp name the tower paints with. */
export type Any = Rn | `r2:${HdOzR2RampName}`;

/** The ramp of a name (`r2:rot` … for the revision-2 ramps). */
export function rampAny(n: Any): readonly Color[] {
  if (n.startsWith('r2:')) return PAL_HD_OZ_R2[n.slice(3) as HdOzR2RampName];
  return rampOf(n as Rn);
}

/** Tone k (0 = deepest; clamped, rounded) of any ramp at density d (at 1: the nearest PAL colour). */
export function R(n: Any, k: number, d: Dn): Color {
  const r = rampAny(n);
  const c = r[Math.max(0, Math.min(r.length - 1, Math.round(k)))] >>> 0;
  return d === 1 ? snap(c, 1) : c;
}

/** The number of tones of a ramp. */
export function len(n: Any): number {
  return rampAny(n).length;
}

/** Light l (0 … 1) → the tone between bands lo and hi (default 1 … n − 2), at density d. */
export function lit(n: Any, l: number, d: Dn, lo = 1, hi = len(n) - 2): Color {
  const v = lo + Math.max(0, Math.min(1, l)) * (hi - lo);
  return R(n, Math.floor(v + 0.5), d);
}

/** A cylinder's light across u ∈ [−1, 1] (lit upper left, deep core right of centre, cool bounce at the right rim). */
export function shadeCyl(u: number, top = 0): number {
  const n = Math.max(-1, Math.min(1, u));
  // A Lambert term for a normal (n, 0, √(1 − n²)) against a light from the left and in front.
  const z = Math.sqrt(Math.max(0, 1 - n * n));
  let l = 0.15 + 0.85 * Math.max(0, -0.62 * n + 0.62 * z + 0.28 * top);
  if (n > 0.78) l += 0.16 * (n - 0.78) / 0.22; // the bounce on the shadow rim
  return Math.max(0, Math.min(1, l));
}

/** A sphere's light at (u, v) ∈ unit disc (lit upper left). */
export function shadeBall(u: number, v: number): number {
  const z = Math.sqrt(Math.max(0, 1 - u * u - v * v));
  const l = 0.12 + 0.88 * Math.max(0, -0.55 * u - 0.5 * v + 0.67 * z);
  return Math.max(0, Math.min(1, l));
}

// ------------------------------------------------------------------------------------ registration

/** Every sprite id the tower registers (tests). */
export const TOWER_SPRITES: string[] = [];
/** Every background generator id the tower registers (tests). */
export const TOWER_BGS: string[] = [];

export interface FrameGeom {
  w: number;
  h: number;
  ox: number;
  oy: number;
  pts?: Readonly<Record<string, readonly [number, number]>>;
}

export type Draw = (p: Pen, frame: number) => void;

/** Register sprite `id`: one frame per geometry, each drawn by `draw(pen, i)` at d 1, 2 and 4. */
export function reg(id: string, geoms: readonly FrameGeom[], draw: Draw, o: { defer?: boolean; ticksPerFrame?: number; durations?: readonly number[] } = {}): void {
  const frames = (d: Dn): Frame[] =>
    geoms.map((g, i) => {
      const p = new Pen(g.w, g.h, d);
      draw(p, i);
      const f = p.frame(g.ox, g.oy);
      return g.pts ? { ...f, pts: g.pts } : f;
    });
  defineSprite(id, () => frames(1), { hd: (d) => frames(d as Dn), defer: o.defer, ticksPerFrame: o.ticksPerFrame ?? 8, durations: o.durations });
  TOWER_SPRITES.push(id);
}

/** n frames of the same geometry. */
export function same(n: number, g: FrameGeom): FrameGeom[] {
  return Array.from({ length: n }, () => g);
}

export type Params = Readonly<Record<string, unknown>>;
export type BgDraw = (p: Pen, params: Params, seed: number) => void;

/** Register background generator `id` (1× and HD from one drawer; the pen wraps in x, so layers tile). */
export function regBg(id: string, draw: BgDraw): void {
  const gen = (w: number, h: number, params: Params, seed: number, d: Dn) => {
    const p = new Pen(w, h, d, true);
    draw(p, params, seed);
    return p.finish();
  };
  defineBgGenerator(id, (w, h, params, seed) => gen(w, h, params, seed, 1), { hd: (w, h, params, seed, d) => gen(w, h, params, seed, d as Dn) });
  TOWER_BGS.push(id);
}

// ------------------------------------------------------------------------------------ helpers

/** Smooth step. */
export function sstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Value noise in [0, 1) on a lattice of `s` logical px (pure; art px X, Y at density d). */
export function vnoise(X: number, Y: number, d: number, s: number, seed: number): number {
  const x = X / (d * s);
  const y = Y / (d * s);
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = h2(xi, yi, seed);
  const b = h2(xi + 1, yi, seed);
  const c = h2(xi, yi + 1, seed);
  const e = h2(xi + 1, yi + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + e) * ux * uy;
}

/** Two octaves of value noise. */
export function fbm(X: number, Y: number, d: number, s: number, seed: number): number {
  return vnoise(X, Y, d, s, seed) * 0.65 + vnoise(X, Y, d, s / 2.3, seed + 17) * 0.35;
}

/** The px centre of art px X at density d, in logical units. */
export function lx(X: number, d: number): number {
  return (X + 0.5) / d;
}
