/**
 * The Amsterdam floor's tiles (docs/design/floor.md §4.1, §3.5; docs/api/floor.md §4): the
 * repeating materials of faces, water and top faces, registered by id.
 *
 * - `ams/kerb-face`: the granite face of a raised pavement (a lit arris, a shaded foot).
 * - `ams/quay-wall`: a canal's quay wall: a granite coping, brick courses, a dark wet foot.
 * - `ams/water`, `ams/water-glint`: the canal seen from above (spec §4.1: a world-anchored ripple that
 *   moves with time, the sky's reflection): two layers the floor drifts against each other.
 * - `ams/arch/<bridge>` (`ensureArchTile`): the near face of a bridge deck: brick courses level in
 *   the world, the arch over the canal with its voussoirs, the dark water under it (the old 2D arch
 *   face, now on the deck's face).
 * - top faces: `ams/boat-deck` (planks), `ams/boat-roof` (tarred roof), `ams/counter-top`
 *   (FABEL FRIET's counter), `ams/ledge` (a stone slab under a gable balcony), `ams/beam` (a gable's
 *   hoist beam), and
 *   `ensureCanopyTile` (a striped awning canopy in the awning sprite's colours and stripe phase).
 *
 * Tile coordinates (registry.ts): faces a = along the face (world u, or v at a u end), b = px below
 * the face's top edge; tops (a, b) = (u, v); quads a = u, b across. Seamless, hashes only.
 */
import type { Color } from '../../../../../engine/color';
import { PAL_HD } from '../../../../../engine/palette-hd';
import type { Ramp } from '../../../../../engine/pixel';
import { hash2 } from '../../../../art/paint';
import { defineFloorTile, hasFloorTile } from '../../../../mission/floor/registry';
import { archTileId, WATER_LEVEL, type Bridge } from './layout';
import { band, BRICK, BRICK_DARK, dt, mod, SAND, STONE } from './mat';
import { hillAt } from './painter';

const TEAL = PAL_HD.teal;
const SKY = PAL_HD.sky;
const CANAL = PAL_HD.canal;

/** Integer texel coordinates of a tile sample at density d (for the world-anchored dither). */
function tx(a: number, d: number): number {
  return Math.floor(a * d);
}

defineFloorTile('ams/kerb-face', {
  w: 26,
  h: 4,
  paint: (a, b, d) => {
    const X = tx(a, d);
    const Y = tx(b, d);
    if (mod(a, 26) < 0.7) return dt(STONE, 1.6, X, Y);
    const t = b < 0.45 ? 5.6 : b < 1.1 ? 3.6 : 2.4;
    return dt(STONE, t + (hash2(X, Y, 61) - 0.5) * 0.7 + (hash2(Math.floor(a / 26), 1, 62) - 0.5) * 0.5, X, Y);
  },
});

/** Brick courses of a wall at height z (world px, level in the world) and along x: [ramp, tone] or a joint (null). */
function brickAt(x: number, z: number, X: number, Y: number, d: number): Color {
  const Db = 2.4;
  const Lb = 6;
  const r = Math.floor(z / Db);
  const lz = z - r * Db;
  const xx = x + (r & 1) * Lb * 0.5;
  const k = Math.floor(xx / Lb);
  const lx = xx - k * Lb;
  const jw = Math.max(0.45, 1 / d);
  if (lz < jw * 0.8 || lx < jw) return dt(SAND, 1.4, X, Y);
  const h = hash2(k, r, 63);
  const ramp: Ramp = h < 0.55 ? BRICK_DARK : BRICK;
  const t = (h < 0.55 ? 3.6 : 2.4) + (hash2(k, r, 64) - 0.5) * 0.8 + (hash2(X, Y, 65) - 0.5) * 0.5;
  return dt(ramp, t, X, Y);
}

defineFloorTile('ams/quay-wall', {
  w: 48,
  h: 8,
  paint: (a, b, d) => {
    const X = tx(a, d);
    const Y = tx(b, d);
    // The granite coping (the quay's edge stone), then brick, then the wet line at the water.
    if (b < 1.2) {
      if (mod(a, 24) < 0.7) return dt(STONE, 2.4, X, Y);
      return dt(STONE, (b < 0.4 ? 6 : 4.4) + (hash2(X, Y, 66) - 0.5) * 0.6, X, Y);
    }
    if (b > 4.6) return dt(PAL_HD.moss, 1.4 + (hash2(X, Y, 67) - 0.5) * 0.8, X, Y);
    const c = brickAt(a, 8 - b, X, Y, d);
    return b < 1.7 ? dt(BRICK_DARK, 1.2, X, Y) : c;
  },
});

/** The canal's ripple field (period 64 × 24): crests and troughs elongated along u. */
function ripple(a: number, b: number): number {
  const p = (Math.PI * 2) / 64;
  const q = (Math.PI * 2) / 24;
  return Math.sin(b * q * 3 + Math.sin(a * p * 2) * 1.6 + Math.sin(a * p * 5 + 1.3) * 0.5) * 0.6 + Math.sin(b * q * 7 - a * p * 3) * 0.25;
}

defineFloorTile('ams/water', {
  w: 64,
  h: 24,
  paint: (a, b, d) => {
    const X = tx(a, d);
    const Y = tx(b, d);
    const r = ripple(a, b);
    // Teal body, darker troughs, the sky in the crests.
    if (r > 0.62) return dt(SKY, 3.4 + (r - 0.62) * 4, X, Y);
    return dt(TEAL, 2.05 + r * 0.9, X, Y);
  },
});

defineFloorTile('ams/water-glint', {
  w: 48,
  h: 16,
  paint: (a, b, d) => {
    const X = tx(a, d);
    const Y = tx(b, d);
    const p = (Math.PI * 2) / 48;
    const q = (Math.PI * 2) / 16;
    const g = Math.sin(b * q * 2 + Math.sin(a * p * 3) * 2) * 0.7 + Math.sin(a * p * 4 - b * q) * 0.3;
    if (g > 0.78) return dt(SKY, 5.6, X, Y);
    if (g < -0.6) return dt(CANAL, 1.6, X, Y);
    return dt(TEAL, 2.4 + g * 0.6, X, Y);
  },
});

/**
 * The deck face tile of a bridge (spec §4.4: the arch face cannot stay in the walk plane, so it is
 * the deck's near face): a = world u, b = px below the deck's top edge, so the height is
 * z = hill(u) − b. A granite cornice under the deck edge, brick courses level in the world, the arch
 * over the canal (an ellipse from the water up to 8 px under the crown) with a ring of voussoirs,
 * and the dark canal under the bridge with a lit line at the water.
 */
export function ensureArchTile(b: Bridge): string {
  const id = archTileId(b);
  if (hasFloorTile(id)) return id;
  const [w0, w1] = b.water;
  const cu = (w0 + w1) / 2;
  // The arch springs 5 px inside the quay walls (brick piers in the water at both sides).
  const R = (w1 - w0) / 2 - 5;
  // The arch's crown 8 px under the deck's crown: brick spandrels round it.
  const top = b.h - 8 - WATER_LEVEL;
  defineFloorTile(id, {
    w: b.len,
    h: 4 * Math.ceil((b.h - WATER_LEVEL + 4) / 4),
    paint: (a, bb, d) => {
      const u = b.x0 + mod(a - b.x0, b.len);
      const X = tx(a, d);
      const Y = tx(bb, d);
      const z = hillAt(b, u) - bb;
      if (bb < 1.1) return dt(STONE, (bb < 0.45 ? 6.1 : 4.6) + (hash2(X, Y, 71) - 0.5) * 0.6, X, Y);
      if (bb < 1.6) return band(STONE, 2);
      // The arch: an ellipse over the canal (its springs at the water line).
      const x = (u - cu) / R;
      const archZ = x * x < 1 ? WATER_LEVEL + top * Math.sqrt(1 - x * x) : -Infinity;
      if (z < archZ) {
        // Under the bridge: the dark canal and the light from the far side.
        const depth = archZ - z;
        if (z < WATER_LEVEL + 0.8) return dt(TEAL, 1.6 + (hash2(X >> 1, Y, 72) - 0.5), X, Y);
        return dt(PAL_HD.navy, 0.6 + Math.max(0, 1.4 - depth * 0.25), X, Y);
      }
      if (z < archZ + 1.8) {
        // The voussoir ring: radial bricks round the arch.
        const ang = Math.atan2(z - WATER_LEVEL, (u - cu) * (top / R));
        const k = Math.floor(ang / 0.16);
        if (Math.abs(ang / 0.16 - k - 0.5) > 0.4) return dt(SAND, 1.2, X, Y);
        return dt(BRICK_DARK, 4.2 + (hash2(k, 3, 73) - 0.5) * 0.8, X, Y);
      }
      return brickAt(u, z + 40, X, Y, d);
    },
  });
  return id;
}

defineFloorTile('ams/boat-deck', {
  w: 32,
  h: 4,
  paint: (a, b, d) => {
    const X = tx(a, d);
    const Y = tx(b, d);
    // Planks along u, 2 px wide (across), butt joints staggered.
    const r = Math.floor(b / 2);
    const lr = b - r * 2;
    if (lr < Math.max(0.35, 1 / d)) return dt(PAL_HD.wood, 1.2, X, Y);
    if (mod(a + r * 11, 32) < 0.6) return dt(PAL_HD.wood, 1.6, X, Y);
    return dt(PAL_HD.wood, 4 + (hash2(Math.floor((a + r * 11) / 32), r, 74) - 0.5) * 0.9 + (hash2(X, Y, 75) - 0.5) * 0.6, X, Y);
  },
});

defineFloorTile('ams/boat-roof', {
  w: 16,
  h: 4,
  paint: (a, b, d) => {
    const X = tx(a, d);
    const Y = tx(b, d);
    // Tarred roofing in strips along u, a seam every 2 px.
    if (mod(b, 2) < Math.max(0.3, 1 / d)) return dt(PAL_HD.black, 1.4, X, Y);
    return dt(PAL_HD.black, 2.6 + (hash2(X, Y, 76) - 0.5) * 0.8, X, Y);
  },
});

defineFloorTile('ams/counter-top', {
  w: 8,
  h: 4,
  paint: (a, b, d) => {
    const X = tx(a, d);
    const Y = tx(b, d);
    // Brushed steel, a lit front lip.
    return dt(PAL_HD.steel, (b < 0.6 ? 6.2 : 4.8) + (hash2(X, Y >> 2, 77) - 0.5) * 0.5, X, Y);
  },
});

defineFloorTile('ams/beam', {
  w: 4,
  h: 4,
  paint: (a, b, d) => {
    const X = tx(a, d);
    const Y = tx(b, d);
    // A tarred oak beam: lit along its left edge.
    return dt(PAL_HD.wood, mod(a, 2) < 0.7 ? 2.6 : 1.6, X, Y);
  },
});

defineFloorTile('ams/ledge', {
  w: 12,
  h: 4,
  paint: (a, b, d) => {
    const X = tx(a, d);
    const Y = tx(b, d);
    if (mod(a, 12) < 0.6) return dt(STONE, 3, X, Y);
    return dt(STONE, 5.2 + (hash2(X, Y, 78) - 0.5) * 0.7 - b * 0.08, X, Y);
  },
});

/**
 * The canopy of a striped awning (spec §3.5): stripes 6 px wide along u in phase with the awning
 * sprite (its first stripe starts at x0), shaded across (b: from the facade to the front edge) like
 * sagging canvas between the ribs.
 */
export function ensureCanopyTile(x0: number, colors: readonly [Ramp, Ramp]): string {
  const phase = mod(x0, 12);
  const id = `ams/canopy/${(colors[0][2] >>> 0).toString(16)}-${(colors[1][2] >>> 0).toString(16)}/${phase}`;
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: 12,
    h: 4,
    paint: (a, b, d) => {
      const X = tx(a, d);
      const Y = tx(b, d);
      const lu = mod(a - phase, 12);
      const r = lu < 6 ? colors[0] : colors[1];
      const f = mod(lu, 6) / 6;
      const t = (r === PAL_HD.snow ? 4.6 : 3.9) + Math.sin(f * Math.PI) * 0.5 - 0.2 + (hash2(X, Y >> 1, 79) - 0.5) * 0.4;
      return dt(r, t, X, Y);
    },
  });
  return id;
}
