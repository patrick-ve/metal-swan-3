/**
 * The side faces of the Oldenzaal town props (docs/design/floor.md §11 R1; the engine's face groups,
 * docs/api/floor.md §8): what was a flat 2D edge shows its side in perspective.
 *
 * - **Shop fronts** (`shopSides`): at a row's end and on both sides of every alley (the RUIN openings
 *   are in the fronts, not gaps), and where a front is taller than its neighbour, the side wall in the
 *   front's own brick or plaster (graded for the mood like the fronts), a cornice band, a plinth, a
 *   dark window or two, and the side of its roof receding from the fronts' depth: the tiled slope of
 *   an eaves roof, the slate of a mansard, the pitched roof behind a gable or a stepped gable; a flat
 *   top shows its parapet. Shapes measured from the fronts (art-street.ts `drawRoof`).
 * - **Cars** (`carSides`): the body's tail and nose from the walk plane back to the car's depth.
 * - **Low walls** (`wallSides`): the brick ends under their coping.
 * - **Awnings and balconies** (`overhangSides`): the awning's canvas cheek from the front to its
 *   valance, the balcony slab's end and its railing's side.
 *
 * Nothing red that could read as blood (the level's rule): the bricks keep to their upper tones, the
 * shade is a cold grey-blue. Tiles: a = down the face, b = back in depth (the foreshortened direction).
 */
import type { Color } from '../../../../../engine/color';
import { sAtDepth, vAtDepth, type FloorCam } from '../../../../../engine/floor/cam';
import { hash2 } from '../../../../art/paint';
import { capFace, quadFace, slopeFace, wallFace, type FaceSide } from '../../../../mission/floor/faces';
import { defineFloorTile, hasFloorTile } from '../../../../mission/floor/registry';
import type { FaceDef, FaceGroupDef } from '../../../../mission/floor/types';
import { SHOPS, shopWallH, type ShopSpec, type WallKind } from '../art-street';
import type { Rn } from '../art-kit';
import { G, type OzCar } from '../terrain';
import { dn, jointW, moodShift, moodTones, OZ_FLOOR_IDS, toneAt, type OzLight } from './kit';
import { BRICK_DARK_MIN, BRICK_MIN } from './town';

/** The fronts' wall ramps and base tones (art-street.ts `WALL_RAMP`). */
const WALL_RAMP: Readonly<Record<WallKind, readonly [Rn, number, boolean]>> = {
  red: ['brick', 2.6, true],
  dark: ['brickDark', 3.1, true],
  brown: ['brown', 2.7, true],
  plaster: ['plaster', 3.1, false],
  grey: ['stone', 3.3, false],
  cream: ['sand', 3.6, false],
};

/** The shade of a side: the fronts face the camera; the sides turn from the dusk sky. */
const SIDE_SHADE: Readonly<Record<FaceSide, number>> = { [-1]: -0.45, [1]: -0.85 } as Record<FaceSide, number>;

/** A mood's tone ladder of a ramp per density, made once. */
const ladders = new Map<string, readonly Color[]>();
function ladder(n: Rn, light: OzLight, d: number): readonly Color[] {
  const key = `${n}|${light}|${dn(d)}`;
  let l = ladders.get(key);
  if (!l) {
    l = moodTones(n, light, dn(d));
    ladders.set(key, l);
  }
  return l;
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** Tile px of depth between two depths in the px of a sprite drawn at `front`. */
function depthPx(cam: FloorCam, front: number, back: number): number {
  return Math.abs(vAtDepth(cam, front) - vAtDepth(cam, back)) * sAtDepth(cam, front);
}

const r4 = (x: number): number => Math.max(4, Math.ceil(x / 4) * 4);

// ------------------------------------------------------------------------------- tiles

/** A shop's side wall: its brick or plaster, the cornice (top 4 px), a plinth, a dark window or two. */
function ensureShopWall(light: OzLight, s: ShopSpec, side: FaceSide, h: number, l: number): string {
  const id = `oz/${light}/side-wall/${s.wall}/${side < 0 ? 'l' : 'r'}/${h}x${l}/${s.seed}`;
  if (hasFloorTile(id)) return id;
  const [n, k0, brick] = WALL_RAMP[s.wall];
  const sh = moodShift(light) + SIDE_SHADE[side];
  // A window on some storeys (a from the top: the upper storeys' window bands), near the front.
  const wins: number[] = [];
  for (let f = 1; f < s.floors; f++) if (hash2(f, 3, s.seed) < 0.5) wins.push(h - (40 + f * 24) + 4);
  const wb = 5 + Math.floor(hash2(7, 1, s.seed) * Math.max(1, l - 16));
  defineFloorTile(id, {
    w: h,
    h: l,
    paint: (a, b, d) => {
      const T = ladder(n, light, d);
      const S = ladder('sandstone', light, d);
      // The cornice band at the wall's top, the plinth at its foot.
      if (a < 4) return toneAt(S, (a < 0.8 ? 4.4 : a > 3.2 ? 1.8 : 3.4) + sh);
      if (a > h - 3) return toneAt(ladder('stone', light, d), 2.2 + sh);
      for (const wa of wins) {
        const da = a - wa;
        const db = b - wb;
        if (da >= 0 && da < 11 && db >= 0 && db < 6) {
          if (da < 1 || da > 10 || db < 1 || db > 5) return toneAt(S, 3.2 + sh);
          return toneAt(ladder('night', light, d), 1.2 + (da < 3 && db < 2.5 ? 1 : 0));
        }
      }
      let k = k0 + sh;
      if (brick) {
        const bh = d >= 2 ? 1.5 : 3;
        const bw = d >= 2 ? 3 : 6;
        const row = Math.floor(a / bh);
        const bb = b + (row & 1 ? bw / 2 : 0);
        const j = jointW(d);
        if (a - row * bh < j || mod(bb, bw) < j) return toneAt(ladder('stone', light, d), 1.6 + sh);
        k += (hash2(Math.floor(bb / bw), row, s.seed) - 0.5) * 0.7;
        // Bricks keep to their upper tones (no wine-dark reds: the no-blood rule; the street's minima).
        return toneAt(T, Math.max(k, n === 'brick' ? BRICK_MIN : n === 'brickDark' ? BRICK_DARK_MIN : 1.2));
      }
      k += (hash2(Math.floor(b / 4), Math.floor(a / 3), s.seed) - 0.5) * 0.5;
      if (hash2(Math.floor(b * d), Math.floor(a * d), s.seed + 1) > 0.97) k -= 0.6;
      return toneAt(T, k);
    },
  });
  return id;
}

/** A roof's side: tiles (eaves, gables) or slate (mansards), courses along the depth. */
function ensureShopRoof(light: OzLight, slate: boolean, side: FaceSide): string {
  const id = `oz/${light}/side-roof/${slate ? 'slate' : 'tiles'}/${side < 0 ? 'l' : 'r'}`;
  if (hasFloorTile(id)) return id;
  const sh = moodShift(light) + SIDE_SHADE[side] * 0.6;
  defineFloorTile(id, {
    w: 10,
    h: 8,
    paint: (a, b, d) => {
      const T = ladder(slate ? 'slate' : 'brickDark', light, d);
      const row = Math.floor(a / 2.5);
      if (a - row * 2.5 < jointW(d)) return toneAt(T, 1.2 + sh);
      const bb = b + (row & 1 ? 1.5 : 0);
      if (mod(bb, 3) < jointW(d) * 0.8) return toneAt(T, 1.6 + sh);
      const t = (slate ? 2.6 : 2.3) + (hash2(Math.floor(bb / 3), row, 51) - 0.5) * 0.6 + sh;
      // The tiles' deeper reds read as wine under the dusk: a tile is dark brown (joint tones) or at least the street's darkest brick.
      return toneAt(T, slate ? t : t < 2 ? t : Math.max(t, BRICK_DARK_MIN));
    },
  });
  return id;
}

/** A low brick wall's end under its coping. */
function ensureWallEnd(light: OzLight, side: FaceSide): string {
  const id = `oz/${light}/wall-end/${side < 0 ? 'l' : 'r'}`;
  if (hasFloorTile(id)) return id;
  const sh = moodShift(light) + SIDE_SHADE[side];
  defineFloorTile(id, {
    w: 16,
    h: 8,
    paint: (a, b, d) => {
      if (a < 2) return toneAt(ladder('brick', light, d), 4.2 + sh);
      const row = Math.floor(a / 2);
      if (a - row * 2 < jointW(d) || mod(b + (row & 1 ? 1.5 : 0), 3) < jointW(d)) return toneAt(ladder('sand', light, d), 1.4 + sh);
      const dark = hash2(Math.floor(b / 3), row, 37) < 0.3;
      return toneAt(ladder(dark ? 'brickDark' : 'brick', light, d), Math.max(dark ? BRICK_DARK_MIN : BRICK_MIN, 3.2 + sh));
    },
  });
  return id;
}

/** An iron railing seen from its side: bars along the depth, the top rail, see-through between. */
function ensureRailing(light: OzLight): string {
  const id = `oz/${light}/railing-side`;
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: 10,
    h: 4,
    paint: (a, b, d) => {
      const I = ladder('black', light, d);
      if (a < 1.1) return toneAt(I, a < 0.4 ? 4 : 2.6);
      if (mod(b, 2.5) < Math.max(0.5, 1 / d)) return toneAt(I, 2.2);
      return 0;
    },
  });
  return id;
}

// ------------------------------------------------------------------------------- the shops

/** The outline of a front's side at its left edge (sprite px): the wall's top, the roof's slope to its ridge (null: a flat top). */
function shopOutline(s: ShopSpec): { wall: number; ridge: readonly [number, number] | null; slate: boolean } {
  const wh = shopWallH(s);
  switch (s.roof) {
    case 'eaves':
      return { wall: wh + 1, ridge: [8, wh + 16], slate: false };
    case 'mansard':
      return { wall: wh + 3, ridge: [4, wh + 15], slate: true };
    case 'flat':
      return { wall: wh + 8, ridge: null, slate: false };
    case 'step':
      return { wall: wh + 6, ridge: [s.w / 2, wh + Math.round(s.w * 0.48) - 2], slate: false };
    case 'gable':
      return { wall: wh + 1, ridge: [s.w / 2, wh + Math.round(s.w * 0.44) - 1], slate: false };
  }
}

/** Options of `shopSides`: the mood, the fronts' depth and the depth the sides recede to. */
export interface ShopSidesOpts {
  light: OzLight;
  cam: FloorCam;
  facade: number;
  back: number;
  /** A taller front shows its side above a neighbour this much lower (px). Default 10. */
  step?: number;
}

/**
 * The side faces of a row of shop fronts (`rowShops` items: frame, left x): every row end and both
 * sides of every alley in full, a taller front above its neighbour. One face group per side.
 */
export function shopSides(shops: ReadonlyArray<{ frame: number; x: number }>, o: ShopSidesOpts): FaceGroupDef[] {
  const sorted = [...shops].sort((a, b) => a.x - b.x);
  const l = r4(depthPx(o.cam, o.facade, o.back));
  const step = o.step ?? 10;
  const out: FaceGroupDef[] = [];
  sorted.forEach((sh, i) => {
    const s = SHOPS[sh.frame];
    const ol = shopOutline(s);
    for (const side of [-1, 1] as const) {
      const nb = side < 0 ? sorted[i - 1] : sorted[i + 1];
      const touching = nb !== undefined && Math.abs(side < 0 ? sh.x - (nb.x + SHOPS[nb.frame].w) : nb.x - (sh.x + s.w)) < 1;
      const from = touching ? shopOutline(SHOPS[nb.frame]).wall : 0;
      if (touching && ol.wall < from + step) continue;
      const kx = side < 0 ? 0.5 : s.w - 0.5;
      const wallTile = ensureShopWall(o.light, s, side, Math.round(ol.wall), l);
      const faces: FaceDef[] = [wallFace(kx, from, ol.wall, o.facade, o.back, side, wallTile, l)];
      if (ol.ridge) {
        const rx = side < 0 ? ol.ridge[0] : s.w - ol.ridge[0];
        faces.push(slopeFace(kx, ol.wall, rx, ol.ridge[1], o.facade, o.back, side, ensureShopRoof(o.light, ol.slate, side), l));
      }
      out.push({ name: `shop side #${sh.frame} @${sh.x} ${side < 0 ? 'L' : 'R'}`, x: sh.x, y: G, depth: o.facade, faces });
    }
  });
  return out;
}

// ------------------------------------------------------------------------------- the walk plane

/** The cars' end heights (ruin/art.ts `carBody` frames, measured: tail and nose tops over the street; the burnt car is lower). */
const CAR_ENDS: ReadonlyArray<{ x0: number; x1: number; y0: number; tail: number; nose: number }> = [
  { x0: 2.5, x1: 63.5, y0: 3, tail: 14, nose: 14 },
  { x0: 2.5, x1: 63.5, y0: 3, tail: 21, nose: 14 },
  { x0: 2.5, x1: 61.5, y0: 3, tail: 11, nose: 10 },
];

/** The cars' body ends (spec §11 R1): from the walk plane back to `depth` (they stand at the kerb side of the street). */
export function carSides(cars: readonly OzCar[], light: OzLight, cam: FloorCam, depth: number): FaceGroupDef[] {
  const l = r4(depthPx(cam, 0, depth));
  return cars.map((c) => {
    const e = CAR_ENDS[c.frame] ?? CAR_ENDS[0];
    const tile = OZ_FLOOR_IDS.car(light, c.frame);
    return {
      name: `car ends @${c.x}`,
      x: c.x,
      y: G,
      depth: 0,
      faces: [wallFace(e.x0, e.y0, e.tail, 0, depth, -1, tile, l), wallFace(e.x1, e.y0, e.nose, 0, depth, 1, tile, l)],
    };
  });
}

/** The low walls' ends ([x, y, w, h] blocks; their coping top reaches `depth`). */
export function wallSides(walls: ReadonlyArray<readonly [number, number, number, number]>, light: OzLight, cam: FloorCam, depth: number): FaceGroupDef[] {
  const l = r4(depthPx(cam, 0, depth));
  return walls.map(([x, y, w, h]) => ({
    name: `wall ends @${x}`,
    x,
    y: G,
    depth: 0,
    faces: [wallFace(0, G - y - h, G - y, 0, depth, -1, ensureWallEnd(light, -1), l), wallFace(w, G - y - h, G - y, 0, depth, 1, ensureWallEnd(light, 1), l)],
  }));
}

/** An awning or balcony over a platform [x, y, w] on a front anchored at `anchorX` (its decor x). */
export interface OverhangSideDef {
  kind: 'awning' | 'balcony';
  x: number;
  y: number;
  w: number;
  anchorX: number;
  /** The awning's tile (its canvas); its rise at the facade. */
  tile?: string;
  rise?: number;
}

/**
 * The ends of awnings and balconies (spec §11 R1): an awning's canvas cheek — from the canopy's
 * line (the facade, `rise` higher, to the platform's edge) down to the valance at the front — and a
 * balcony slab's end with its railing's side. The facade's corners are its sprite px (it is drawn
 * at its depth unscaled), the front's are world px (the platform line in the walk plane).
 */
export function overhangSides(items: readonly OverhangSideDef[], light: OzLight, cam: FloorCam, facade: number): FaceGroupDef[] {
  const out: FaceGroupDef[] = [];
  const l = r4(depthPx(cam, 0, facade));
  for (const it of items) {
    const faces: FaceDef[] = [];
    const up = G - it.y;
    for (const side of [-1, 1] as const) {
      const xf = (side < 0 ? it.x : it.x + it.w) - it.anchorX;
      if (it.kind === 'awning') {
        const rise = it.rise ?? 3;
        const tile = it.tile ?? OZ_FLOOR_IDS.slab(light);
        // The cheek: the front's top and valance foot (world px), the facade's top and a little under it (sprite px).
        const nt: readonly [number, number, number, 1] = [xf, up, 0, 1];
        const nb: readonly [number, number, number, 1] = [xf, up - 12, 0, 1];
        const ft: readonly [number, number, number] = [xf, up + rise, facade];
        const fb: readonly [number, number, number] = [xf, up + rise - 3, facade];
        faces.push(side > 0 ? quadFace([nt, ft, fb, nb], [[0, 0], [0, l], [3, l], [12, 0]], tile) : quadFace([nt, nb, fb, ft], [[0, 0], [12, 0], [3, l], [0, l]], tile));
      } else {
        // The slab's end (3 px thick) and the railing's side over it (10 px), from the platform's edge back to the facade.
        faces.push(wallFace(xf, up - 3, up, 0, facade, side, OZ_FLOOR_IDS.slab(light), l, 0, 'front'));
        faces.push(wallFace(xf, up, up + 10, 0, facade, side, ensureRailing(light), l, 0, 'front'));
      }
    }
    out.push({ name: `${it.kind} ends @${it.x}`, x: it.anchorX, y: G, depth: facade, order: facade - 0.05, faces });
  }
  return out;
}

/** A face toward the camera (re-exported for the kits' boxes). */
export { capFace };
