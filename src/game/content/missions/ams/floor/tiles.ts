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
 * Wave B (spec §12.2): `riverSurface(light)` (river water over the whole band, the crests in the
 * light's sky), `ams/rim-face` / `ams/rim-inner` (a pool's stone rim, outside and in), `ams/step-face`
 * / `ams/step-tread` (a stair in the height field), `ams/pontoon-top` (a steel pontoon's deck, a face
 * group's top), `ensurePassageWallTile` and `ams/passage-ceiling` (the museum passage's tiled walls
 * and its vault).
 *
 * Tile coordinates (registry.ts): faces a = along the face (world u, or v at a u end), b = px below
 * the face's top edge; tops (a, b) = (u, v); quads a = u, b across. Face groups' tiles (sides.ts):
 * a = down the face, b = back in depth. Seamless, hashes only.
 */
import type { Color } from '../../../../../engine/color';
import { PAL_HD } from '../../../../../engine/palette-hd';
import type { Ramp } from '../../../../../engine/pixel';
import { hash2 } from '../../../../art/paint';
import { defineFloorTile, hasFloorTile } from '../../../../mission/floor/registry';
import type { FloorSurface } from '../../../../mission/floor/types';
import type { Light } from '../art';
import { archTileId, WATER_LEVEL, type Bridge } from './layout';
import { band, BRICK, BRICK_DARK, dt, mod, SAND, STONE } from './mat';
import { hillAt } from './painter';

export const TEAL = PAL_HD.teal;
const SKY = PAL_HD.sky;
export const CANAL = PAL_HD.canal;

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

// ------------------------------------------------------------------------------- wave B tiles (spec §4.1, §12.2)

/** The sky the river reflects per time of day (its crests) and the body's ramp shift. */
export const RIVER_SKY: Readonly<Record<Light, { sky: Ramp; t: number; body: number }>> = {
  morning: { sky: SKY, t: 4.2, body: 0 },
  noon: { sky: SKY, t: 4.8, body: 0.2 },
  golden: { sky: PAL_HD.gold, t: 5, body: -0.15 },
  sunset: { sky: PAL_HD.orange, t: 4.4, body: -0.35 },
};

/** The river's ripple at tile px (a, b): period 96 along a, 32 along b; above 0.66 a crest that holds the sky. */
export function riverRipple(a: number, b: number): number {
  const p = (Math.PI * 2) / 96;
  const q = (Math.PI * 2) / 32;
  return Math.sin(b * q * 2 + Math.sin(a * p * 2) * 1.4 + Math.sin(a * p * 5 + 0.7) * 0.4) * 0.6 + Math.sin(b * q * 5 - a * p * 3) * 0.28;
}

/** The river's glint field at tile px (a, b): period 64 along a, 16 along b; above 0.8 a glint, under −0.62 a dark trough. */
export function riverGlint(a: number, b: number): number {
  const p = (Math.PI * 2) / 64;
  const q = (Math.PI * 2) / 16;
  return Math.sin(b * q * 2 + Math.sin(a * p * 3) * 2.2) * 0.7 + Math.sin(a * p * 5 - b * q) * 0.3;
}

/**
 * River water over the whole band (spec §12.2: c's canal, c1's Amstel, c2's river): a broader,
 * slower ripple than the side canal's, the crests holding the sky of the section's time of day (gold
 * in the late afternoon), and a glint layer drifting against it — world-anchored, it moves with time
 * (`du`, `dv`), never with the camera. Use it as a cut's `surface` (`riverSurface(light)`).
 */
export function riverSurface(light: Light = 'morning'): FloorSurface {
  const base = `ams/river/${light}`;
  const glint = `ams/river-glint/${light}`;
  if (!hasFloorTile(base)) {
    const L = RIVER_SKY[light];
    defineFloorTile(base, {
      w: 96,
      h: 32,
      paint: (a, b, d) => {
        const X = tx(a, d);
        const Y = tx(b, d);
        const r = riverRipple(a, b);
        if (r > 0.66) return dt(L.sky, L.t + (r - 0.66) * 3, X, Y);
        return dt(TEAL, 1.85 + L.body + r * 0.85, X, Y);
      },
    });
    defineFloorTile(glint, {
      w: 64,
      h: 16,
      paint: (a, b, d) => {
        const X = tx(a, d);
        const Y = tx(b, d);
        const g = riverGlint(a, b);
        if (g > 0.8) return dt(L.sky, L.t + 1, X, Y);
        if (g < -0.62) return dt(CANAL, 1.5, X, Y);
        return dt(TEAL, 2.2 + L.body + g * 0.5, X, Y);
      },
    });
  }
  return { tile: base, du: 0.045, dv: 0.01, over: { tile: glint, du: -0.035, alpha: 0.34 } };
}

/** A pool's (or a fountain's) stone rim from outside: a lit granite coping over a short dressed face (a = along, b = down). */
defineFloorTile('ams/rim-face', {
  w: 22,
  h: 4,
  paint: (a, b, d) => {
    const X = tx(a, d);
    const Y = tx(b, d);
    if (mod(a, 22) < 0.6) return dt(STONE, 2.2, X, Y);
    return dt(STONE, (b < 0.5 ? 6.2 : b < 1.2 ? 4.8 : 3.4) + (hash2(X, Y, 120) - 0.5) * 0.5, X, Y);
  },
});

/** The inside of a pool's rim down to the water: the coping's lip, dressed stone, the dark wet band at the water (a = along, b = down). */
defineFloorTile('ams/rim-inner', {
  w: 22,
  h: 8,
  paint: (a, b, d) => {
    const X = tx(a, d);
    const Y = tx(b, d);
    if (b < 0.7) return dt(STONE, 5.6, X, Y);
    if (mod(a, 22) < 0.6) return dt(STONE, 2, X, Y);
    if (b > 3.2) return dt(PAL_HD.slate, 2 + (hash2(X, Y, 121) - 0.5) * 0.6, X, Y);
    return dt(STONE, 3.6 - b * 0.25 + (hash2(X, Y, 122) - 0.5) * 0.5, X, Y);
  },
});

/** A stair's riser (the jetty's steps, a face of the height field): a lit granite nosing, the riser in shade, a dark joint at its foot (a = along, b = down). */
defineFloorTile('ams/step-face', {
  w: 24,
  h: 8,
  paint: (a, b, d) => {
    const X = tx(a, d);
    const Y = tx(b, d);
    if (b < 0.6) return dt(STONE, 6.2, X, Y);
    if (mod(a, 24) < 0.6) return dt(STONE, 2, X, Y);
    if (mod(b, 8) > 7.2) return dt(STONE, 1.6, X, Y);
    return dt(STONE, 3.4 + (hash2(Math.floor(a / 24), 3, 123) - 0.5) * 0.6 + (hash2(X, Y, 124) - 0.5) * 0.5, X, Y);
  },
});

/** A stair's treads seen from above (a cut's `surface` on the steps): long granite slabs, a joint every 24 px (a = u, b = v). */
defineFloorTile('ams/step-tread', {
  w: 24,
  h: 8,
  paint: (a, b, d) => {
    const X = tx(a, d);
    const Y = tx(b, d);
    if (mod(a, 24) < Math.max(0.5, 1 / d)) return dt(STONE, 2.6, X, Y);
    return dt(STONE, 4.9 + (hash2(Math.floor(a / 24), Math.floor(b / 8), 125) - 0.5) * 0.6 + (hash2(X, Y, 126) - 0.5) * 0.6, X, Y);
  },
});

/** A steel pontoon's deck seen from above (a face group's top: a = along x, b = depth): tread plate, a lit rim at its far edge, a bollard row's bolts. */
defineFloorTile('ams/pontoon-top', {
  w: 16,
  h: 8,
  paint: (a, b, d) => {
    const X = tx(a, d);
    const Y = tx(b, d);
    // Diamond tread plate: little raised bars on a 2-px lattice, alternating direction.
    const ia = Math.floor(a / 2);
    const ib = Math.floor(b / 2);
    const la = a - ia * 2;
    const lb = b - ib * 2;
    const bar = (ia + ib) & 1 ? Math.abs(la - lb) < 0.45 : Math.abs(la + lb - 2) < 0.45;
    return dt(PAL_HD.steel, (bar && d >= 2 ? 4.6 : 3.6) + (hash2(X >> 2, Y >> 2, 127) - 0.5) * 0.4, X, Y);
  },
});

/**
 * The cycle passage's tiled walls (spec §12.2 b: the museum's passage, a side wall in perspective;
 * a = down from the vault's springing, b = back in depth): glazed cream tiles 4 px square with a
 * blue band at hand height and a darker dado, lit by the bright mouths (lighter toward b = 0).
 */
export function ensurePassageWallTile(side: -1 | 1, h: number, l: number): string {
  const id = `ams/passage-wall/${side < 0 ? 'l' : 'r'}/${h}x${l}`;
  if (hasFloorTile(id)) return id;
  const sh = side < 0 ? 0 : -0.6;
  defineFloorTile(id, {
    w: h,
    h: l,
    paint: (a, b, d) => {
      const X = tx(b, d);
      const Y = tx(a, d);
      const jw = Math.max(0.45, 1 / d);
      const fromFoot = h - a;
      if (mod(a, 4) < jw || mod(b, 4) < jw) return dt(STONE, 3 + sh, X, Y);
      // The dado (the lowest 10 px), the blue band over it, the cream tiles above; the passage darker inside.
      const inside = -Math.min(1.2, b / 20);
      if (fromFoot < 10) return dt(PAL_HD.brickDark, 3.6 + sh + inside + (hash2(Math.floor(a / 4), Math.floor(b / 4), 128) - 0.5) * 0.5, X, Y);
      if (fromFoot < 14) return dt(PAL_HD.sky, 2.6 + sh + inside, X, Y);
      return dt(PAL_HD.plaster, 5 + sh + inside + (hash2(Math.floor(a / 4), Math.floor(b / 4), 129) - 0.5) * 0.4, X, Y);
    },
  });
  return id;
}

/** The passage's vault seen from below (a = along x, b = depth): dark brick between pale stone ribs every 24 px, a lamp's glow now and then. */
defineFloorTile('ams/passage-ceiling', {
  w: 48,
  h: 8,
  paint: (a, b, d) => {
    const X = tx(a, d);
    const Y = tx(b, d);
    const la = mod(a, 24);
    if (la < 2) return dt(STONE, 3.8, X, Y);
    if (mod(a, 48) > 34 && mod(a, 48) < 38 && mod(b, 8) < 3) return dt(PAL_HD.gold, 5.4, X, Y);
    return brickAt(a, b * 3, X, Y, d);
  },
});
