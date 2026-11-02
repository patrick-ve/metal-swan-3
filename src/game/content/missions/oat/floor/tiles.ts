/**
 * The floor tiles of the oat streets (STREET-A, wave A; docs/design/oat.md §8.7 a 6, §8.7 d 5,
 * §8.8, §8.10; docs/api/floor.md §4): the faces the height field builds (the granite kerb's face,
 * the brick quay walls of the canal cuts, the brick arch of each bridge as its deck's near face). The
 * canal's water surface is LIGHT-WATER's (light/water.ts `OAT_WATER`).
 *
 * - Faces: (a, b) = (world u along the face, px below its top edge). Tops: (a, b) = (u, v).
 * - Under the arches the canal is the water ramp's deep end (spec §8.8: darker under bridges).
 * - Density rule (spec §8.10): joints and ripples are fine at 4×, 2 × 2 clusters at 2×, only tone at
 *   1× (the tiles' v-mips and the store's box filter calm the far rows).
 *
 * Every colour comes from the kit's ladders (PAL_HD ∪ PAL_HD_OAT at 2× / 4×, PAL at 1×).
 */
import type { Color } from '../../../../../engine/color';
import { defineFloorTile, hasFloorTile } from '../../../../mission/floor/registry';
import { bay, humpAt, ladder, mx, T, type Dn } from '../art/kit';
import { cellHash, dayMats, nightMats } from './mat';

function dn(d: number): Dn {
  return d >= 4 ? 4 : d >= 2 ? 2 : 1;
}

/** Art px of a coordinate at density d. */
function tx(a: number, d: number): number {
  return Math.floor(a * d);
}

/** A ladder colour at a continuous index, dithered (ordered, world space) only within ±z/2 of a step. */
function dt(list: readonly Color[], t: number, X: number, Y: number, z = 0.5): Color {
  const k = Math.floor(t + (bay(X, Y) - 0.5) * z);
  return list[k < 0 ? 0 : k >= list.length ? list.length - 1 : k];
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

// ------------------------------------------------------------------------------------ ladders

interface Ladders {
  brick: readonly Color[];
  brickDark: readonly Color[];
  mortar: readonly Color[];
  stone: readonly Color[];
  algae: readonly Color[];
  water: readonly Color[];
  under: readonly Color[];
}

const dayL = new Map<Dn, Ladders>();
const nightL = new Map<Dn, Ladders>();

function day(d: Dn): Ladders {
  let l = dayL.get(d);
  if (l) return l;
  l = {
    brick: ladder([T('oat.brick', 2, d), T('oat.brick', 3, d), T('oat.brick', 4, d), T('oat.brick', 5, d), T('oat.brick', 6, d)], 2, d),
    brickDark: ladder([T('oat.brick', 0, d), T('oat.brick', 1, d), T('oat.brick', 2, d), T('oat.brick', 3, d)], 2, d),
    mortar: ladder([T('oat.mortar', 0, d), T('oat.mortar', 1, d), T('oat.mortar', 2, d)], 2, d),
    stone: dayMats(d).granite.sun,
    algae: ladder([T('oat.canal', 0, d), T('moss', 1, d), T('moss', 2, d), T('olive', 3, d)], 2, d),
    // The water: the deep body → the olive mid → the sky sheen (spec §8.8; research §4).
    water: ladder([T('oat.canal', 0, d), T('oat.canal', 1, d), T('oat.canal', 2, d), mx(T('oat.canal', 2, d), T('oat.canal', 3, d), 0.5, d), T('oat.canal', 3, d)], 2, d),
    under: ladder([T('oat.canal', 0, d), mx(T('oat.canal', 0, d), T('oat.canal', 1, d), 0.5, d), T('oat.canal', 1, d)], 2, d),
  };
  dayL.set(d, l);
  return l;
}

function night(d: Dn): Ladders {
  let l = nightL.get(d);
  if (l) return l;
  const nm = nightMats(d);
  l = {
    brick: ladder([T('oat.nightWater', 1, d), T('oat.brick', 0, d), T('oat.brick', 1, d), T('oat.brick', 2, d)], 2, d),
    brickDark: ladder([T('oat.nightWater', 0, d), T('oat.nightWater', 1, d), T('oat.brick', 0, d)], 2, d),
    mortar: ladder([T('oat.nightWater', 1, d), T('slate', 1, d), T('slate', 2, d)], 2, d),
    stone: nm.coping,
    algae: ladder([T('oat.nightWater', 0, d), T('oat.nightWater', 1, d), T('moss', 0, d)], 2, d),
    water: ladder([T('oat.nightWater', 0, d), mx(T('oat.nightWater', 0, d), T('oat.nightWater', 1, d), 0.5, d), T('oat.nightWater', 1, d)], 2, d),
    under: ladder([T('oat.nightWater', 0, d)], 1, d),
  };
  nightL.set(d, l);
  return l;
}

// ------------------------------------------------------------------------------------ brick in world space

/**
 * Brick courses on a vertical face, level in the world: z = height over the walk plane (px), u along
 * the face. Stretcher bond, courses of 1 px (a brick 21 × 5 cm at 20 px/m ≈ 4.2 × 1), mortar in the
 * bed joints at 4×, tone only at 1×.
 */
function brickAt(L: Ladders, u: number, z: number, X: number, Y: number, d: number, k0: number): Color {
  const row = Math.floor(z);
  const fz = z - row;
  const uu = u / 4.2 + (row & 1 ? 0.5 : 0);
  const col = Math.floor(uu);
  const fu = uu - col;
  if (d >= 4 && (fz > 0.78 || fu < 0.06)) return dt(L.mortar, 0.6 + cellHash(col, row, 5) * 1.2, X, Y);
  const h = cellHash(col, row, 7);
  return dt(L.brick, k0 + h * 3.2 - 1.2 + (cellHash(X, Y, 9) - 0.5) * (d >= 4 ? 0.7 : 0), X, Y);
}

// ------------------------------------------------------------------------------------ the tiles

/** The granite kerb's face (12 cm: the 2-px step between the pavement and the gutter course). */
export const OAT_KERB_FACE = 'oat-kerb-face';
/** The brick quay wall of a canal cut with its stone coping, the wet band and the algae (day / night). */
export const OAT_QUAY_WALL = 'oat-quay-wall';
export const OAT_D_QUAY_WALL = 'oat-d-quay-wall';

defineFloorTile(OAT_KERB_FACE, {
  w: 24,
  h: 4,
  paint: (a, b, d) => {
    const D = dn(d);
    const g = dayMats(D).granite;
    const X = tx(a, d);
    const Y = tx(b, d);
    // The lit arris on top, the worn face, a block joint every 20 px (the kerb stones), the dirt line at the foot.
    if (b < 0.45) return dt(g.sun, g.sun.length - 2.2, X, Y);
    if (d >= 2 && mod(a, 20) < 0.3) return dt(g.joint, 0.4, X, Y);
    if (b > 1.7) return dt(g.shade, 1.5 + cellHash(Math.floor(a / 20), 1, 3) * 1.5, X, Y);
    return dt(g.sun, 3 + cellHash(Math.floor(a / 20), 2, 4) * 2.2 - b * 0.6, X, Y);
  },
});

function quayWall(id: string, nightSet: boolean): void {
  defineFloorTile(id, {
    w: 32,
    h: 12,
    paint: (a, b, d) => {
      const D = dn(d);
      const L = nightSet ? night(D) : day(D);
      const X = tx(a, d);
      const Y = tx(b, d);
      // The coping stone (sandstone-grey, moss in its joints) …
      if (b < 1.3) {
        if (d >= 2 && mod(a, 26) < 0.35) return dt(L.algae, 1.4, X, Y);
        return dt(L.stone, L.stone.length - 1.4 - b * 1.6 + (cellHash(Math.floor(a / 26), 3, 5) - 0.5) * 1.2, X, Y);
      }
      if (b < 1.7) return dt(L.brickDark, 0.8, X, Y);
      // … the brick wall, darker and wet toward the water, the green-black algae band and lime streaks.
      const wet = Math.max(0, (b - 4) / 3.5);
      if (wet > 0.75 && cellHash(Math.floor(a * 1.3), Math.floor(b * 2), 11) < 0.55 + wet * 0.3) return dt(L.algae, 1.2 + cellHash(X, Y, 12) * 1.6, X, Y);
      if (d >= 2 && !nightSet && mod(a + 7, 61) < 0.6 && b < 6) return dt(L.mortar, 2.2, X, Y); // a limescale streak
      return brickAt(L, a, 40 - b, X, Y, d, 3.4 - wet * 2.6);
    },
  });
}
quayWall(OAT_QUAY_WALL, false);
quayWall(OAT_D_QUAY_WALL, true);


/** A bridge of the oat floor: world x and length, its water span and the hump (spec §8.2). */
export interface OatBridge {
  readonly x0: number;
  readonly len: number;
  readonly hump: number;
  readonly water: readonly [number, number];
  readonly name: string;
}

/** The arch tile's id of a bridge. */
export function archTileId(b: OatBridge): string {
  return `oat-a-arch-${b.name}`;
}

/**
 * The brick arch of a bridge (the deck's near face, spec §8.7 a 6: brick arches, 5.6–7.0 m openings):
 * a = world u, b = px below the deck's top edge, so the height is z = hump(u) − b. The granite deck
 * edge under the railing, brick courses level in the world, the segmental arch over the canal with a
 * ring of voussoirs and a sandstone keystone, and the dark canal under it with the far daylight at
 * the water. The water level is the floor's (`level`).
 */
export function ensureArchTile(b: OatBridge, level: number): string {
  const id = archTileId(b);
  if (hasFloorTile(id)) return id;
  const [w0, w1] = b.water;
  const cu = (w0 + w1) / 2;
  // A 5.6–7.0 m opening (spec §8.7 a 6): at most 2 · 62 px, brick spandrels to both sides.
  const R = Math.min((w1 - w0) / 2 - 6, 62);
  // The crown of the arch 5 px under the deck's crown.
  const top = b.hump - 5 - level;
  defineFloorTile(id, {
    w: b.len,
    h: 4 * Math.ceil((b.hump - level + 4) / 4),
    paint: (a, bb, d) => {
      const D = dn(d);
      const L = day(D);
      const g = dayMats(D).granite;
      const u = b.x0 + mod(a - b.x0, b.len);
      const X = tx(a, d);
      const Y = tx(bb, d);
      const z = humpAt((u - b.x0) / b.len, b.hump) - bb;
      // The deck's granite edge (its lit top, its face).
      if (bb < 0.5) return dt(g.sun, g.sun.length - 1.5, X, Y);
      if (bb < 1.3) return dt(g.sun, 2.4 + cellHash(Math.floor(u / 18), 4, 6) * 1.5, X, Y);
      if (bb < 1.7) return dt(g.shade, 1, X, Y);
      // The arch: a flattened ellipse over the canal, springing at the water line.
      const x = (u - cu) / R;
      const archZ = x * x < 1 ? level + top * Math.sqrt(1 - x * x) : -Infinity;
      if (z < archZ) {
        // Under the bridge: the dark canal, the daylight of the far side on the water line.
        if (z < level + 0.9) return dt(L.water, 2.2 + Math.max(0, 1 - Math.abs(x)) * 1.5, X, Y);
        return dt(L.under, Math.max(0, 1.8 - (archZ - z) * 0.4), X, Y);
      }
      if (z < archZ + 1.6) {
        // The voussoirs: radial bricks round the arch, the keystone at the crown.
        const ang = Math.atan2(z - level, (u - cu) * (top / R));
        if (Math.abs(ang - Math.PI / 2) < 0.07) return dt(L.mortar, 2.4, X, Y);
        const k = Math.floor(ang / 0.15);
        if (d >= 4 && Math.abs(ang / 0.15 - k - 0.5) > 0.42) return dt(L.mortar, 0.6, X, Y);
        return dt(L.brickDark, 2 + cellHash(k, 3, 13) * 1.2, X, Y);
      }
      // The spandrel brick (in the sun: the bridges are in full sun, spec §8.4), wetter toward the water.
      const wet = z < level + 2.5 ? 1.4 : 0;
      return brickAt(L, u, z + 40, X, Y, d, 3.6 - wet);
    },
  });
  return id;
}
