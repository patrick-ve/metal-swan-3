/**
 * The Amsterdam street layout (docs/design/floor.md §4.2–§4.4): a section's floor as DATA — the two
 * kerb lines (open quay and house stretches, bending between them over ≥ 32 px), the street
 * surfaces along u (the bike lane, the cobbles, the fan of a square, a bridge deck), the kerb
 * crossings where the lane meets the cobbles, the canal bridges (a deck over a canal that runs in
 * depth: water and quay walls in front of and behind it) and the side canals (a water cut over the
 * whole band). The painter (painter.ts) reads it; `streetFeatures` and `poleRows` compile it into
 * the FloorDef's height field and rows, so the painted kerbs, the height field and the rows always
 * agree. Written for every `ams` section (wave B adds b, c, c1, c2, d from the same parts).
 *
 * Units: u = world x; depths are the kits' DEPTH (screen px behind the walk line on flat ground,
 * docs/api/floor.md §2): 0 the walk line, > 0 behind it, < 0 in front.
 */
import type { DepthLine, FloorFeature, FloorSurface, PropRowDef } from '../../../../mission/floor/types';
import type { Light } from '../art';

/** The open quay (spec §4.4): far kerb (lane's far edge) and near kerb (where the near pavement starts). */
export const QUAY_FAR = 17;
export const QUAY_NEAR = -12.3;
/** The house stretch: facades at 14, a narrow pavement, the kerbs. */
export const FACADE = 14;
export const HOUSE_FAR = 5;
export const HOUSE_NEAR = -16.3;
/** Pole rows: on the far kerb top (quay 156.6 / house ~168.5 on screen) and on the near pavement (192.5 / ~197). */
export const QUAY_BACK_ROW = 18;
export const QUAY_FRONT_ROW = -18.4;
export const HOUSE_BACK_ROW = 6;
export const HOUSE_FRONT_ROW = -23;
/** The poles' size: 1.1 × their row's perspective scale (an Amsterdammertje of ~1.15 m by a 1.8 m hero). */
export const POLE_SCALE = 1.1;
/** Height of the pavements and the quays over the street (world px: a low Amsterdam kerb). */
export const KERB_H = 1.6;
/** The canal's water surface under the walk plane (G − WATER_Y). */
export const WATER_LEVEL = -4;
/** Depth px of the kerb's granite top behind the far kerb line / in front of the near one. */
export const FAR_KERB_TOP = 1.8;
export const NEAR_KERB_TOP = 2.3;
/** Depth px of the quay coping at the back edge of an open quay. */
export const COPING = 2.4;
/** The crossing's granite band (world px along u) and its angle from the depth axis (spec §4.2: about 30°). */
export const CROSS_BAND = 4;
export const CROSS_TAN = Math.tan((30 * Math.PI) / 180);
/** The rows' gap around a crossing (spec §4.2: about 24 px) and before a bridge or a canal. */
export const ROW_GAP = 24;
export const ROW_STOP = 12;

/** What the street between the kerbs is made of. */
export type StreetKind = 'lane' | 'cobbles' | 'fan' | 'deck';

/** One piece of street: from `u0` to the next piece's u0. */
export interface StreetPiece {
  readonly u0: number;
  readonly kind: StreetKind;
}

/**
 * A kerb crossing (spec §4.2) at the boundary `u` between a lane piece and a cobble piece: the
 * granite band crosses the street at 30° from the depth axis through (u, the street's middle).
 * `dir` +1: the lane is on the left (lane → cobbles going right); −1: mirrored.
 */
export interface Crossing {
  readonly u: number;
  readonly dir: 1 | -1;
}

/**
 * A canal bridge over a `hill(len, h)` of the walk profile (spec §1.2 "bridge decks over water"):
 * the deck is the street band (depths `far` … `near`) over x0 … x0 + len; the canal under it runs
 * in depth over `water` (u range), with water and quay walls behind and in front of the deck and the
 * abutment quays (pavement height) beside it. Its arch shows in the deck's near face.
 */
export interface Bridge {
  readonly x0: number;
  readonly len: number;
  readonly h: number;
  readonly water: readonly [number, number];
  readonly far: number;
  readonly near: number;
}

/**
 * A pavement bulb (spec §11 R2: things stand where they would in a real street): the far pavement
 * widens past the walk line round what stands there in the walk plane (a lamp a gull sleeps on, a
 * tree with a secret, a stall, a counter, a bike rack), and the lane or the cobbles swerve round it
 * in perspective over ≥ 32 px bends; the near kerb gives way. FLUSH with the street: the whole far
 * pavement over [u0, u3) lies at street level (the walk line stays on the physics surface, gate 4),
 * edged by the kerb's granite band. `far` / `near`: the kerb lines' [u, depth] points over it.
 */
export interface Bulb {
  readonly u0: number;
  readonly u3: number;
  readonly far: readonly (readonly [number, number])[];
  readonly near: readonly (readonly [number, number])[];
}

/** The bulb's far edge (3 depth px in front of the walk line) and how far the near kerb gives way. */
export const BULB_FAR = -3;
export const BULB_NEAR_QUAY = -17;
export const BULB_NEAR_HOUSE = -20;
/** Front decor (a bike rack) on the near pavement along a quay bulb, clear of the kerb that gave way. */
export const BULB_FRONT_DECOR = -24;

/**
 * A symmetric bulb: flat over [u1, u2] at `far` / `near`, bending from and back to the stretch's kerb
 * lines (`far0`, `near0`) over [u0, u1] and [u2, u3].
 */
export function bulb(u0: number, u1: number, u2: number, u3: number, far0: number, near0: number, near = BULB_NEAR_QUAY, far = BULB_FAR): Bulb {
  return {
    u0,
    u3,
    far: [[u0, far0], [u1, far], [u2, far], [u3, far0]],
    near: [[u0, near0], [u1, near], [u2, near], [u3, near0]],
  };
}

/** A kerb line with bulbs: the base line's points outside every bulb, each bulb's own points over it. */
export function withBulbs(base: DepthLine, bulbs: readonly Bulb[], side: 'far' | 'near'): [number, number][] {
  const pts: [number, number][] = typeof base === 'number' ? [] : base.map(([u, d]): [number, number] => [u, d]);
  const out = pts.filter(([u]) => !bulbs.some((b) => u >= b.u0 && u <= b.u3));
  if (typeof base === 'number' && bulbs.length === 0) out.push([0, base]);
  for (const b of bulbs) for (const [u, d] of side === 'far' ? b.far : b.near) out.push([u, d]);
  out.sort((a, b) => a[0] - b[0]);
  // Outside the points the line is constant: keep the base's value at both ends.
  if (typeof base === 'number') {
    out.unshift([out[0][0] - 1, base]);
    out.push([out[out.length - 1][0] + 1, base]);
  }
  return out;
}

/** A stop line across the lane (spec §11 R2: a raised bridge): its u and which half it closes. */
export interface StopLine {
  readonly u: number;
  readonly half: 'near' | 'far' | 'both';
}

/**
 * A raised leaf's hinge pit (spec §11 R2, the lead's rule: no solid part of the leaf in the heroes'
 * walk depth): the leaf stands up over the lane's far half only (u0 … u1, from the far kerb to the
 * lane's centre line `far`, a depth); in front of it, from that line to the near kerb, the bank lies
 * open — the pit's steel edge at the water.
 */
export interface HingePit {
  readonly u0: number;
  readonly u1: number;
  readonly far: number;
}

/** The street layout of a section (the painter's params; `light` is the section's time of day). */
export interface StreetLayout {
  readonly light: Light;
  /** The far kerb line (the lane's far edge) and the near kerb line (the near pavement's edge). */
  readonly far: DepthLine;
  readonly near: DepthLine;
  /** Street pieces, sorted by u0 (the first one runs from −∞). */
  readonly street: readonly StreetPiece[];
  readonly crossings: readonly Crossing[];
  /** u ranges of open quay (the coping at the back edge); elsewhere a house stretch (tiles to the back). */
  readonly quays: readonly (readonly [number, number])[];
  readonly bridges: readonly Bridge[];
  /** Water cuts over the whole band (a side canal: the ground has a gap there). */
  readonly canals: readonly (readonly [number, number])[];
  /** Bike symbols: one every `every` px per half (near half at `phase`, far half `every / 2` later). */
  readonly bikes: { readonly every: number; readonly phase: number };
  /** Pavement bulbs (their kerb points must be in `far` / `near` too: `withBulbs`). */
  readonly bulbs?: readonly Bulb[];
  /** Stop lines across the lane, and the landings of a raised bridge's leaf (a steel strip across the street at a bank's edge, u). */
  readonly stops?: readonly StopLine[];
  readonly landings?: readonly number[];
  /** The hinge pits in front of raised leaves (the leaf itself is a face group: drawbridge.ts). */
  readonly hingePits?: readonly HingePit[];
}

/** A bridge deck's granite edges (world px of v inside its far and near edge): the railings and their stone end posts (5 px deep) stand on them. */
export const DECK_EDGE_FAR = 4.2;
export const DECK_EDGE_NEAR = 5.4;
/** The lane's centre line sits this far (world px) in front of the middle of its visible width. */
export const LANE_MID_SHIFT = 2;

/**
 * The lane's centre line (world v) between the far kerb line `vF` and the near kerb line `vN` (world v):
 * the near kerb's raised top hides the lane's last px (`KERB_H`, the camera's f and yw − yh), and the
 * line sits `LANE_MID_SHIFT` toward the near half.
 */
export function laneMidV(vF: number, vN: number, f: number, k1: number): number {
  const vis = f - (k1 * (f - vN)) / (k1 - KERB_H);
  return (vF + vis) / 2 + LANE_MID_SHIFT;
}

/**
 * Where nothing may stand at u but traffic (spec §11 R2, the street logic): the lane or the cobbled
 * roadway between the kerb lines (in front of a bulb too), a bridge deck between its granite edges, a
 * raised leaf's hinge pit (the leaf over the far half is the road itself) — as the world-v range
 * [far, near], or null (a square, a canal). `vAt` converts a depth to world v.
 */
export function roadwayAt(l: StreetLayout, u: number, vAt: (depth: number) => number): readonly [number, number] | null {
  for (const b of l.bridges) if (u >= b.x0 && u < b.x0 + b.len) return [vAt(b.far) + DECK_EDGE_FAR, vAt(b.near) - DECK_EDGE_NEAR];
  for (const [a, b] of l.canals) if (u >= a && u < b) return null;
  const kind = pieceAt(l.street, u);
  if (kind !== 'lane' && kind !== 'cobbles') return null;
  const vN = vAt(depthAt(l.near, u));
  for (const p of l.hingePits ?? []) if (u >= p.u0 && u < p.u1) return [vAt(p.far), vN];
  return [vAt(depthAt(l.far, u)), vN];
}

/** The water of the canals (animated, docs/api/floor.md §3): two drifting layers. */
export const WATER: FloorSurface = { tile: 'ams/water', du: 0.06, dv: 0.012, over: { tile: 'ams/water-glint', du: -0.045, alpha: 0.38 } };

/** Value of a [u, depth] line at u (straight between the points, constant beyond the ends). */
export function depthAt(l: DepthLine, u: number): number {
  if (typeof l === 'number') return l;
  const n = l.length;
  if (u <= l[0][0]) return l[0][1];
  if (u >= l[n - 1][0]) return l[n - 1][1];
  for (let i = 1; i < n; i++) {
    const [x1, y1] = l[i];
    if (u <= x1) {
      const [x0, y0] = l[i - 1];
      return x1 === x0 ? y1 : y0 + ((u - x0) * (y1 - y0)) / (x1 - x0);
    }
  }
  return l[n - 1][1];
}

/** The street piece at u (pieces sorted; straight boundaries). */
export function pieceAt(street: readonly StreetPiece[], u: number): StreetKind {
  let k: StreetKind = street[0].kind;
  for (let i = 1; i < street.length; i++) {
    if (u < street[i].u0) break;
    k = street[i].kind;
  }
  return k;
}

/** The arch tile of a bridge's deck face (tiles.ts registers it on first use). */
export function archTileId(b: Bridge): string {
  return `ams/arch/${b.x0}x${b.len}x${b.h}/${b.water[0]}-${b.water[1]}`;
}

/**
 * The height field of a layout (spec §1.2): the raised far and near pavements (kerb faces facing
 * the street), the side canals (water cuts with quay walls), and per bridge the abutment quays,
 * the canal under it (behind and in front of the deck) and the deck (its near face shows the arch).
 * Later features win: the order matters.
 */
export function streetFeatures(l: StreetLayout): FloorFeature[] {
  const out: FloorFeature[] = [
    { kind: 'kerb', to: l.far, dh: KERB_H, face: 'ams/kerb-face' },
    { kind: 'kerb', from: l.near, dh: KERB_H, face: 'ams/kerb-face' },
  ];
  // The bulbs lie flush: the far pavement over each one at street level (the walk line crosses it).
  for (const b of l.bulbs ?? []) out.push({ kind: 'raise', u0: b.u0, u1: b.u3, to: l.far, dh: 0, face: 'ams/kerb-face' });
  for (const [u0, u1] of l.canals) out.push({ kind: 'cut', u0, u1, level: WATER_LEVEL, surface: WATER, face: 'ams/quay-wall' });
  for (const b of l.bridges) {
    const u0 = b.x0;
    const u1 = b.x0 + b.len;
    const [w0, w1] = b.water;
    // The abutment quays at pavement height (the bridge's own u range, behind and in front of the deck)…
    out.push({ kind: 'cut', u0, u1, to: b.far, level: KERB_H, face: 'ams/quay-wall' });
    out.push({ kind: 'cut', u0, u1, from: b.near, level: KERB_H, face: 'ams/quay-wall' });
    // …the canal running in depth under the deck…
    out.push({ kind: 'cut', u0: w0, u1: w1, to: b.far, level: WATER_LEVEL, surface: WATER, face: 'ams/quay-wall' });
    out.push({ kind: 'cut', u0: w0, u1: w1, from: b.near, level: WATER_LEVEL, surface: WATER, face: 'ams/quay-wall' });
    // …and the deck: the walk profile's hump (dh 0) between the railings, its near face the arch.
    out.push({ kind: 'deck', u0, u1, from: b.far, to: b.near, face: archTileId(b) });
  }
  return out;
}

/** The u extent of a crossing's band at a depth (its far end at the far kerb, its near end at the near kerb). */
export function crossingAt(c: Crossing, vAt: (depth: number) => number, far: number, near: number, depth: number): number {
  const vMid = (vAt(far) + vAt(near)) / 2;
  return c.u - c.dir * (vAt(depth) - vMid) * CROSS_TAN;
}

/** Options of a pole row along one stretch. */
export interface PoleRowOpts {
  name: string;
  /** The prop (`defineFloorProp`) and the row's depth. */
  prop: string;
  depth: number;
  /** The stretch [u0, u1) and the spacing / first offset. */
  u0: number;
  u1: number;
  spacing: number;
  offset: number;
  /** No poles in these [a, b] ranges (crossings, bridges, canals, front decor). */
  gaps?: readonly (readonly [number, number])[];
  /** Front rows: keep this far from these u (spawn points, pickups, hostages, doors). */
  clear?: readonly number[];
  clearDist?: number;
  /** Skip a pole now and then (a driveway): the chance per pole (hash of its index; 0 = none). */
  skip?: number;
  /** Extra scale over the row's perspective scale (default POLE_SCALE). */
  scale?: number;
}

/**
 * A row of Amsterdammertjes along a stretch as explicit positions (`at`): regular spacing, minus the
 * gaps and the kept spots; skipping only ever widens a gap, so a front row keeps its ≥ 34 px.
 */
export function poleRow(o: PoleRowOpts): PropRowDef {
  const at: number[] = [];
  const gaps = o.gaps ?? [];
  const clear = o.clear ?? [];
  const cd = o.clearDist ?? 26;
  let n = 0;
  for (let u = o.u0 + o.offset; u < o.u1; u += o.spacing, n++) {
    if (gaps.some(([a, b]) => u >= a && u <= b)) continue;
    if (clear.some((s) => Math.abs(u - s) < cd)) continue;
    if (o.skip && ((n * 2654435761) >>> 0) / 4294967296 < o.skip) continue;
    at.push(u);
  }
  return { name: o.name, prop: o.prop, depth: o.depth, scale: o.scale ?? POLE_SCALE, at };
}

/**
 * The gaps every pole row of a layout keeps (spec §3.6, §4.2, §4.4): around each crossing (its
 * band at the row's depth ± ROW_GAP), over each bridge and canal (± ROW_STOP), where the kerb bends.
 */
export function rowGaps(l: StreetLayout, vAt: (depth: number) => number, depth: number, bends: readonly (readonly [number, number])[]): [number, number][] {
  const out: [number, number][] = [];
  for (const c of l.crossings) {
    const far = depthAt(l.far, c.u);
    const near = depthAt(l.near, c.u);
    const uc = crossingAt(c, vAt, far, near, Math.max(near, Math.min(far, depth)));
    out.push([uc - ROW_GAP, uc + ROW_GAP]);
  }
  for (const b of l.bridges) out.push([b.x0 - ROW_STOP, b.x0 + b.len + ROW_STOP]);
  for (const [u0, u1] of l.canals) out.push([u0 - ROW_STOP, u1 + ROW_STOP]);
  for (const [a, b] of bends) out.push([a - ROW_STOP, b + ROW_STOP]);
  // A back row has no kerb to stand on along a bulb (a front row keeps its kerb: it gives way in front).
  if (depth > 0) for (const b of l.bulbs ?? []) out.push([b.u0 - ROW_STOP, b.u3 + ROW_STOP]);
  return out;
}
