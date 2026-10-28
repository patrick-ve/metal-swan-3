/**
 * The Amsterdam floor's props (docs/design/floor.md §3.6, §4.4):
 *
 * - `ams/pole`: an Amsterdammertje for the pole rows (`defineFloorProp`): the rust-brown bollard with
 *   its three white crosses (the `decor/ams/bollard` look, art-hd-ab-street.ts `bollardHd`), drawn at
 *   its row's final scale and density, not resampled — and slimmer than the 9-px sprite, so the
 *   front row keeps the front-row rule (≤ 8 px wide at the row's scale, §3.6).
 * - `ensureFrontRail`: the low iron railing on a bridge deck's near edge (spec §4.4 "railings at the
 *   back and the front replace the pole rows"): a front decor SPRITE pre-scaled for its depth (the
 *   bridge's hump at that depth is the walk-plane hump × s, so the scaled art sits on the deck).
 *   Front decor is drawn over the world at its depth's shift and speed, unscaled (docs/api/floor.md
 *   §5): hence the pre-scaled art. 1× in the 64-colour palette, 2× / 4× on an HdCanvas in PAL_HD.
 *   (The back railing is the old `bridge-rail` sprite in a back row: the row scales it once.)
 * - `ams/lawn-post` + `lawnChainRow` (wave B): the Museumplein's knee-high posts with their chains,
 *   the low front row along a lawn.
 */
import type { Color } from '../../../../../engine/color';
import { PAL } from '../../../../../engine/palette';
import { PAL_HD } from '../../../../../engine/palette-hd';
import { PixelBuffer } from '../../../../../engine/pixel';
import type { Frame } from '../../../../../engine/render';
import { defineSprite, hasSprite, type DenseDensity } from '../../../../../engine/sprites';
import { HdCanvas, grime } from '../../../../art/hd/index';
import { defineFloorProp } from '../../../../mission/floor/registry';
import type { PropRowDef } from '../../../../mission/floor/types';
import { scaleFrame } from '../../../../mission/floor/scale';
import { deco, fr, type P } from '../art-hd-ab-kit';
import type { Bridge } from './layout';
import { hillAt } from './painter';

/** The pole's width and height at scale 1 (logical px; the sprite is 9 × 21). */
const POLE_W = 5.2;
const POLE_H = 21;

/** An Amsterdammertje at scale k and density d (feet anchor at the base's centre). */
export function poleFrame(k: number, d: number): Frame {
  const W = Math.max(3, Math.ceil(POLE_W * k + 1));
  const H = Math.max(6, Math.ceil(POLE_H * k));
  // 1×: drawn at 2× and boxed down (the HdCanvas wants a dense grid for its light and outline).
  const dd = d >= 2 ? d : 2;
  const c = new HdCanvas(W, H, dd);
  const iron = deco(c, PAL_HD.rust, { lo: 0, hi: 3, spec: 0.5, shine: 16 });
  const cx = W / 2;
  const K = (a: number): number => a * k;
  const foot = H - 0.5;
  c.cylinder(cx - K(2.05), foot - K(16.2), K(4.1), K(14.6), { mat: iron, z: 1, tex: grime(5, 0.35, 2) });
  c.ellipsoid(cx, foot - K(17), K(2.45), K(2.3), { mat: iron, z: 1.3 });
  c.cylinder(cx - K(2.6), foot - K(2), K(5.2), K(2), { mat: iron, z: 1.2, cap: 0.6, tone: -0.1 });
  // XXX: three Andreas crosses on the round front.
  const cross = PAL_HD.snow[5];
  const lw = dd >= 4 ? 0.36 : 0.5;
  for (let q = 0; q < 3; q++) {
    const yc = foot - K(12.5 - q * 3.6);
    const r = K(1.25);
    c.paint(cx - r, yc - r, 2 * r, 2 * r, (x, y) => {
      const dx = x - cx;
      const dy = y - yc;
      return Math.abs(Math.abs(dx) - Math.abs(dy)) < lw && Math.abs(dx) < r ? cross : 0;
    });
  }
  const f = fr(c.render({ outline: 'C', sep: true, ao: 0.25, rimLight: 1 }), cx, H, dd);
  return d >= 2 ? f : scaleFrame(f, 1, 1);
}

defineFloorProp('ams/pole', (scale, d) => poleFrame(scale, d));

// ------------------------------------------------------------------------------- the front railing

/** Railing heights over the deck (world px): the top rail, the lower rail, the stone end posts. */
const RAIL_TOP = 8.5;
const RAIL_LOW = 2.2;
const POST_H = 10.5;
/** The stone end posts' width (world px) and the balusters' pitch. */
const POST_W = 5;
/** The end posts' size (their side faces: sides.ts `railPostSides`). */
export const RAIL_POST_W = POST_W;
export const RAIL_POST_H = POST_H;
const BAR_PITCH = 4;

/** The sprite id of a bridge's front railing at scale s (the deck's near edge). */
export function frontRailId(b: Bridge, s: number): string {
  return `decor/ams/floor-rail-${b.len}x${b.h}-${Math.round(s * 1000)}`;
}

/** The railing frame's logical size and anchor (top-left at the bridge start, the anchor on the ground line). */
function railBox(b: Bridge, s: number): { W: number; H: number; ox: number; oy: number } {
  const W = Math.ceil(b.len * s) + 2;
  const H = Math.ceil((b.h + POST_H + 1) * s) + 2;
  return { W, H, ox: 1, oy: H - 1 };
}

/** The 1× railing: crisp palette pixels (green iron, stone posts). */
function rail1x(b: Bridge, s: number): Frame {
  const { W, H, ox, oy } = railBox(b, s);
  const buf = new PixelBuffer(W, H);
  const iron: readonly Color[] = PAL.green;
  const stone: readonly Color[] = PAL.stone;
  for (let X = 0; X < W; X++) {
    const u = (X + 0.5 - ox) / s;
    if (u < 0 || u > b.len) continue;
    const base = hillAt(b, b.x0 + u);
    const post = u < POST_W || u > b.len - POST_W;
    for (let Y = 0; Y < H; Y++) {
      const z = (oy - (Y + 0.5)) / s - base;
      let col: Color = 0;
      if (post) {
        if (z >= 0 && z < POST_H) col = z > POST_H - 1.4 ? stone[3] : (u < 1 || b.len - u < 1) ? stone[0] : stone[2];
      } else if (z >= 0) {
        if (Math.abs(z - RAIL_TOP) < 0.7 / s) col = iron[3];
        else if (Math.abs(z - RAIL_LOW) < 0.6 / s) col = iron[1];
        else if (z < RAIL_TOP && ((u % BAR_PITCH) + BAR_PITCH) % BAR_PITCH < 0.9 / s) col = iron[1];
      }
      if (col) buf.data[Y * W + X] = col >>> 0;
    }
  }
  buf.touch();
  return { buf, ox, oy };
}

/** The 2× / 4× railing: an HdCanvas (lit iron, bevelled stone posts, outline C). */
function railHd(b: Bridge, s: number, d: DenseDensity): Frame {
  const { W, H, ox, oy } = railBox(b, s);
  const c = new HdCanvas(W, H, d);
  const iron = deco(c, PAL_HD.green, { lo: 0, hi: 3, spec: 0.6, shine: 18 });
  const stone = deco(c, PAL_HD.stone, { lo: 2, hi: 7, wrap: 0.1 });
  const X = (u: number): number => ox + u * s;
  const Y = (u: number, z: number): number => oy - (hillAt(b, b.x0 + u) + z) * s;
  const pts = (z: number): P[] => {
    const out: P[] = [];
    for (let u = POST_W; u <= b.len - POST_W + 0.01; u += 2) out.push([X(u), Y(u, z)]);
    return out;
  };
  c.stroke(pts(RAIL_TOP), 0.55 * s, 0.55 * s, { mat: iron, z: 1.6 });
  c.stroke(pts(RAIL_LOW), 0.4 * s, 0.4 * s, { mat: iron, z: 1.5 });
  for (let u = POST_W + BAR_PITCH / 2; u < b.len - POST_W; u += BAR_PITCH) c.capsule(X(u), Y(u, RAIL_TOP), X(u), Y(u, 0.2), 0.25 * s, 0.25 * s, { mat: iron, z: 1.4 });
  for (const u0 of [0, b.len - POST_W]) {
    const yb = Y(u0 + POST_W / 2, 0);
    c.box(X(u0), yb - POST_H * s, POST_W * s, POST_H * s, { mat: stone, z: 2, bevel: 0.5 });
    c.box(X(u0) - 0.4 * s, yb - (POST_H + 0.8) * s, (POST_W + 0.8) * s, 1.6 * s, { mat: stone, z: 2.4, bevel: 0.6, n: [0, -0.3, 0.95] });
  }
  return fr(c.render({ outline: 'C', sep: true, ao: 0.25, rimLight: 1 }), ox, oy, d);
}

/** Register (once) and return the front railing sprite of a bridge at scale s. */
export function ensureFrontRail(b: Bridge, s: number): string {
  const id = frontRailId(b, s);
  if (!hasSprite(id)) defineSprite(id, () => rail1x(b, s), { hd: (d) => railHd(b, s, d) });
  return id;
}

// ------------------------------------------------------------------------------- the lawn chains (wave B)

/** The lawn post's size at scale 1 (logical px: a knee-high iron post) and its chain's height over the foot. */
const LAWN_POST_W = 3;
const LAWN_POST_H = 9;
const LAWN_CHAIN_UP = 6.5;
/** The chain's colours (dark green iron, light and dark links). */
export const LAWN_CHAIN: readonly [Color, Color] = [PAL_HD.green[2] >>> 0, PAL_HD.green[0] >>> 0];

/**
 * A lawn post (spec §12.2 b: the Museumplein's low chains as the front row): a short dark-green iron
 * post with a ball top and the chain's eye (point `chain`), at its row's final scale and density
 * (feet anchor). Low and thin: a front row of them covers no head or gun.
 */
export function lawnPostFrame(k: number, d: number): Frame {
  const W = Math.max(3, Math.ceil(LAWN_POST_W * k + 1));
  const H = Math.max(4, Math.ceil(LAWN_POST_H * k));
  const dd = d >= 2 ? d : 2;
  const c = new HdCanvas(W, H, dd);
  const iron = deco(c, PAL_HD.green, { lo: 0, hi: 3, spec: 0.5, shine: 18 });
  const cx = W / 2;
  const K = (a: number): number => a * k;
  const foot = H - 0.5;
  c.cylinder(cx - K(0.9), foot - K(7.4), K(1.8), K(7.2), { mat: iron, z: 1 });
  c.ellipsoid(cx, foot - K(7.8), K(1.3), K(1.2), { mat: iron, z: 1.3 });
  c.ellipsoid(cx, foot - K(LAWN_CHAIN_UP), K(1.15), K(0.8), { mat: iron, z: 1.2, tone: -0.2 });
  const f = fr(c.render({ outline: 'C', sep: true, ao: 0.2, rimLight: 1 }), cx, H, dd);
  const out = d >= 2 ? f : scaleFrame(f, 1, 1);
  return { ...out, pts: { chain: [0, -K(LAWN_CHAIN_UP)] } };
}

defineFloorProp('ams/lawn-post', (scale, d) => lawnPostFrame(scale, d));

/** Options of a row of lawn posts with their chains (a front row: keep it thin, ≥ 34 px apart). */
export interface LawnChainRowOpts {
  name?: string;
  depth: number;
  u0: number;
  u1: number;
  spacing?: number;
  offset?: number;
  gaps?: readonly (readonly [number, number])[];
}

/**
 * The low lawn chains of the Museumplein (spec §12.2 b, the low front row): posts every `spacing`
 * (default 36: the front-row rule's ≥ 34 px) with a sagging dark-green chain between neighbours.
 */
export function lawnChainRow(o: LawnChainRowOpts): PropRowDef {
  const spacing = Math.max(34, o.spacing ?? 36);
  return {
    name: o.name ?? 'lawn chains',
    prop: 'ams/lawn-post',
    depth: o.depth,
    u0: o.u0,
    u1: o.u1,
    spacing,
    offset: o.offset ?? spacing / 2,
    gaps: o.gaps,
    link: { sag: 1.6, colors: LAWN_CHAIN, max: spacing * 1.05 },
  };
}
