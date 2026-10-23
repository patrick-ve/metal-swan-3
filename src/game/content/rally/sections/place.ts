/**
 * Placing the scenery along the A10 (WORLD, wave B): frames at a track distance and a side offset,
 * the clearance from the road (both carriageways, their verges and slopes) and from the keep-outs
 * (rivers, pitches, landmark footprints), and the filler makers of the sections (offices, towers,
 * flats, houses, sheds, farms, trees, billboards). Setup code; pure and deterministic.
 */
import type { Rng } from '../../../../engine/rng';
import { cosT, sinT } from '../../../../engine/r3/trig';
import type { A10Track } from '../track/types';
import { TF } from '../track/types';
import { Frame, WorldBatch, type Rgb, type V3 } from './batch';
import type { FacadeKind } from './pages';
import { billboard, block, building, tree, type TreeKind } from './pieces';

/** The middle of both carriageways (m right of our centre line) and their half-width with the verges. */
const MID = -7.8;
const ROAD_CLEAR = 27;

export class Placer {
  readonly track: A10Track;
  private readonly xs: Float64Array;
  private readonly zs: Float64Array;
  private readonly keep: { x: number; z: number; r: number }[] = [];
  private readonly smp;

  constructor(track: A10Track) {
    this.track = track;
    const n = Math.ceil(track.length / 8);
    this.xs = new Float64Array(n);
    this.zs = new Float64Array(n);
    const t = track.sample(0);
    this.smp = t;
    for (let i = 0; i < n; i++) {
      track.sample((i * track.length) / n, t);
      this.xs[i] = t.pos[0] + t.right[0] * MID;
      this.zs[i] = t.pos[2] + t.right[2] * MID;
    }
  }

  /** The track's frame at distance s (wrapped), moved `side` m to the right, at height y. */
  frame(s: number, side: number, y = 0): Frame {
    const t = this.track.sample(this.wrap(s), this.smp);
    return new Frame(t.pos[0] + t.right[0] * side, y, t.pos[2] + t.right[2] * side, t.fwd[0], t.fwd[2]);
  }

  /** The road's height at s. */
  height(s: number): number {
    return this.track.sample(this.wrap(s), this.smp).pos[1];
  }

  flags(s: number): number {
    return this.track.flagsAt(this.wrap(s));
  }

  wrap(s: number): number {
    const L = this.track.length;
    return s - Math.floor(s / L) * L;
  }

  /** The distance from (x, z) to the middle line of both carriageways (m). */
  roadDist(x: number, z: number): number {
    let best = Infinity;
    const X = this.xs, Z = this.zs;
    for (let i = 0; i < X.length; i++) {
      const dx = X[i] - x, dz = Z[i] - z;
      const d = dx * dx + dz * dz;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }

  /** Free for a footprint of radius r: clear of the road (both carriageways and verges + `margin`) and of the keep-outs. */
  clear(x: number, z: number, r: number, margin = 0): boolean {
    if (this.roadDist(x, z) < ROAD_CLEAR + r + margin) return false;
    for (const k of this.keep) {
      const dx = k.x - x, dz = k.z - z;
      if (dx * dx + dz * dz < (k.r + r) * (k.r + r)) return false;
    }
    return true;
  }

  /** Reserve a round footprint (a river's width, a pitch, a landmark). */
  keepOut(x: number, z: number, r: number): void {
    this.keep.push({ x, z, r });
  }

  /** Reserve a strip along a frame's z (a river): circles every r m. */
  keepStrip(fr: Frame, z0: number, z1: number, halfW: number): void {
    for (let z = z0; z <= z1; z += halfW) {
      const p = fr.p(0, 0, z);
      this.keepOut(p[0], p[2], halfW);
    }
  }
}

/** The context the section dressers share. */
export interface DressCtx {
  readonly track: A10Track;
  readonly b: WorldBatch;
  readonly place: Placer;
  /** The section's own rng (a fork of the world's: the same scenery every load). */
  rng: Rng;
  /** The start of the section (m). */
  s0: number;
}

/** A filler maker: picks its size, then builds at a frame (null: it does not fit). */
export type Maker = (c: DressCtx, fr: Frame, r: Rng) => number;

/** A slight tint around white (façade variety). */
export function tint(r: Rng, amount = 14, warm = 0): Rgb {
  const k = r.range(-amount, amount);
  return [Math.round(128 + k + warm), Math.round(128 + k), Math.round(128 + k - warm)];
}

/** A pitched roof (ridge along z) over a w × d box at height h, `rise` m high, tinted. */
export function gableRoof(b: WorldBatch, fr: Frame, w: number, d: number, h: number, rise: number, col: Rgb, sw: 'red' | 'dark' | 'orange' = 'red'): void {
  const uv = (k: 'red' | 'dark' | 'orange'): readonly number[] => {
    const f = flatUv[k];
    return [f[0], f[1], f[2], f[1], f[2], f[3], f[0], f[3]];
  };
  const P = (x: number, y: number, z: number): V3 => fr.p(x, y, z);
  const e = 0.4;
  const x0 = -w / 2 - e, x1 = w / 2 + e, z0 = -d / 2 - e, z1 = d / 2 + e;
  const top = h + rise;
  b.poly('props', 'both', [P(x0, h, z0), P(0, top, z0), P(0, top, z1), P(x0, h, z1)], uv(sw), col, fr.d(-rise, w / 2, 0));
  b.poly('props', 'both', [P(0, top, z0), P(x1, h, z0), P(x1, h, z1), P(0, top, z1)], uv(sw), col, fr.d(rise, w / 2, 0));
  const wall = flatUv.wall;
  b.tri('props', 'near', P(-w / 2, h, -d / 2), P(w / 2, h, -d / 2), P(0, top, -d / 2), [wall[0], wall[1], wall[2], wall[1], wall[0], wall[3]], [120, 92, 80], fr.d(0, 0, -1));
  b.tri('props', 'near', P(w / 2, h, d / 2), P(-w / 2, h, d / 2), P(0, top, d / 2), [wall[0], wall[1], wall[2], wall[1], wall[0], wall[3]], [120, 92, 80], fr.d(0, 0, 1));
}

/** Flat uv rectangles used by the roofs (filled by `initPlace`). */
const flatUv: Record<'red' | 'dark' | 'orange' | 'wall', readonly [number, number, number, number]> = { red: [0, 0, 0, 0], dark: [0, 0, 0, 0], orange: [0, 0, 0, 0], wall: [0, 0, 0, 0] };

export function initPlace(flat: (n: 'red' | 'dark' | 'orange' | 'sand') => readonly [number, number, number, number]): void {
  flatUv.red = flat('red');
  flatUv.dark = flat('dark');
  flatUv.orange = flat('orange');
  flatUv.wall = flat('sand');
}

/**
 * Lay filler along a section stretch: from `from` to `to` (m from the section's start), on `side`
 * (+1 right, −1 left), at `d0`…`d1` m from our centre line, every `g0`…`g1` m, picking makers by
 * weight. A pick that does not fit (the road, a keep-out) is skipped.
 */
export function zone(c: DressCtx, side: 1 | -1, from: number, to: number, d0: number, d1: number, g0: number, g1: number, makers: readonly (readonly [Maker, number])[]): void {
  const r = c.rng;
  const total = makers.reduce((a, m) => a + m[1], 0);
  let s = c.s0 + from + r.range(0, g0);
  while (s < c.s0 + to) {
    if ((c.place.flags(s) & (TF.tunnel | TF.water)) === 0) {
      let pick = r.next() * total;
      let k = 0;
      while (k < makers.length - 1 && pick >= makers[k][1]) pick -= makers[k++][1];
      const lat = side * r.range(d0, d1);
      const fr = c.place.frame(s, lat);
      makers[k][0](c, fr, r);
    } else r.next();
    s += r.range(g0, g1);
  }
}

/** Fits a footprint of radius `rad` at the frame (and reserves it). */
export function fits(c: DressCtx, fr: Frame, rad: number): boolean {
  if (!c.place.clear(fr.ox, fr.oz, rad)) return false;
  c.place.keepOut(fr.ox, fr.oz, rad * 0.8);
  c.b.at(fr.ox, fr.oz);
  return true;
}

// ---------------------------------------------------------------------------------------------
// The filler makers
// ---------------------------------------------------------------------------------------------

/** Turn a frame by a small random angle (buildings not quite parallel to the road). */
export function skew(fr: Frame, r: Rng, max = 0.12): Frame {
  const a = r.range(-max, max);
  return fr.turned(sinT(a), cosT(a));
}

export const office = (kinds: readonly FacadeKind[] = ['stone', 'glass', 'modern'], h0 = 14, h1 = 40): Maker => (c, fr, r) => {
  const w = r.range(16, 28), d = r.range(16, 32), h = r.range(h0, h1);
  if (!fits(c, fr, Math.sqrt(w * w + d * d) / 2)) return 0;
  const k = kinds[r.int(0, kinds.length - 1)];
  building(c.b, skew(fr, r), w, d, h, k, tint(r, 12, k === 'stone' ? 6 : 0), { vOff: r.int(0, 40), uOff: r.int(0, 3) });
  return 1;
};

export const tower = (kinds: readonly FacadeKind[] = ['glass', 'stone'], h0 = 50, h1 = 85): Maker => (c, fr, r) => {
  const w = r.range(20, 28), d = r.range(20, 30), h = r.range(h0, h1);
  if (!fits(c, fr, Math.sqrt(w * w + d * d) / 2 + 4)) return 0;
  const k = kinds[r.int(0, kinds.length - 1)];
  const f = skew(fr, r, 0.3);
  const col = tint(r, 10);
  building(c.b, f, w, d, h, k, col, { vOff: r.int(0, 40) });
  // A setback crown or a plant room on top.
  if (r.chance(0.6)) building(c.b, f, w * 0.7, d * 0.7, h + r.range(4, 10), k, col, { vOff: r.int(0, 40), lit: false }, h);
  else block(c.b, 'props', 'both', f, -w * 0.3, h, -d * 0.3, w * 0.3, h + 3, d * 0.3, 'grey', [118, 118, 118]);
  return 1;
};

export const flats = (h0 = 4, h1 = 10, along = true): Maker => (c, fr, r) => {
  const len = r.range(50, 90), thick = r.range(11, 13), storeys = r.int(h0, h1);
  const w = along ? thick : len, d = along ? len : thick;
  if (!fits(c, fr, Math.sqrt(w * w + d * d) / 2)) return 0;
  building(c.b, skew(fr, r, 0.05), w, d, storeys * 2.9 + 0.6, 'flats', tint(r, 10), { vOff: r.int(0, 40), uOff: r.int(0, 2) });
  return 1;
};

export const houses = (): Maker => (c, fr, r) => {
  const w = 9, d = r.range(24, 48);
  const hh = r.range(6.5, 9.5);
  if (!fits(c, fr, d / 2 + 2)) return 0;
  const f = skew(fr, r, 0.06);
  building(c.b, f, w, d, hh, 'brick', tint(r, 10, 0), { vOff: r.int(0, 40), uOff: r.int(0, 3), roof: false });
  gableRoof(c.b, f, w, d, hh, r.range(3, 4.5), r.chance(0.7) ? [128, 118, 112] : [110, 110, 120], r.chance(0.7) ? 'red' : 'dark');
  return 1;
};

const SHED_TINTS: readonly Rgb[] = [
  [112, 122, 136],
  [118, 128, 118],
  [132, 128, 116],
  [124, 124, 126],
  [128, 116, 112],
];

export const shed = (): Maker => (c, fr, r) => {
  const w = r.range(24, 44), d = r.range(30, 60), h = r.range(7, 12);
  if (!fits(c, fr, Math.sqrt(w * w + d * d) / 2)) return 0;
  building(c.b, skew(fr, r, 0.08), w, d, h, 'shed', SHED_TINTS[r.int(0, SHED_TINTS.length - 1)], { uOff: 0 });
  return 1;
};

export const farm = (): Maker => (c, fr, r) => {
  if (!fits(c, fr, 22)) return 0;
  const f = skew(fr, r, 0.3);
  const house = f.moved(-8, 0, -6);
  building(c.b, house, 8, 11, 5.5, 'brick', tint(r, 8, 4), { vOff: r.int(0, 40), roof: false });
  gableRoof(c.b, house, 8, 11, 5.5, 4.5, [120, 120, 124], 'dark');
  const barn = f.moved(6, 0, 6);
  building(c.b, barn, 15, 24, 5, 'shed', [118, 110, 100], { lit: false, roof: false });
  gableRoof(c.b, barn, 15, 24, 5, 6, [110, 110, 116], 'dark');
  for (let k = 0; k < 4; k++) {
    const p = f.p(r.range(-16, 16), 0, r.range(-16, 16));
    tree(c.b, p[0], p[2], 0, r.range(8, 13), r.chance(0.5) ? 'A' : 'B', r.next(), 0.95);
  }
  return 1;
};

export const trees = (kinds: readonly TreeKind[] = ['A', 'B'], n0 = 3, n1 = 7, h0 = 8, h1 = 15): Maker => (c, fr, r) => {
  const n = r.int(n0, n1);
  let placed = 0;
  for (let k = 0; k < n; k++) {
    const x = fr.ox + r.range(-9, 9), z = fr.oz + r.range(-9, 9);
    if (!c.place.clear(x, z, 2, -8)) continue;
    c.b.at(x, z);
    tree(c.b, x, z, 0, r.range(h0, h1), kinds[r.int(0, kinds.length - 1)], r.next(), r.range(0.85, 1.05));
    placed++;
  }
  return placed;
};

export const billboardAt = (): Maker => (c, fr, r) => {
  if (!c.place.clear(fr.ox, fr.oz, 4, -12)) return 0;
  c.b.at(fr.ox, fr.oz);
  billboard(c.b, fr, r.int(0, 5));
  return 1;
};

/** A row of trees along the road at a fixed side offset (the polder's windbreaks). */
export function treeRow(c: DressCtx, side: number, from: number, to: number, every: number, kind: TreeKind, h0: number, h1: number): void {
  const r = c.rng;
  for (let s = c.s0 + from; s < c.s0 + to; s += every * r.range(0.8, 1.2)) {
    if ((c.place.flags(s) & (TF.tunnel | TF.water | TF.bridge)) !== 0) continue;
    const fr = c.place.frame(s, side + r.range(-1, 1));
    if (!c.place.clear(fr.ox, fr.oz, 2, -8)) continue;
    c.b.at(fr.ox, fr.oz);
    tree(c.b, fr.ox, fr.oz, 0, r.range(h0, h1), kind, r.next(), r.range(0.9, 1.05));
  }
}
