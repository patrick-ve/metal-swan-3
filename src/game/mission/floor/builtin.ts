/**
 * The floor's built-in tiles (docs/api/floor.md §3): the pit under a gap of the ground
 * (`floor/pit`, `floor/pit-wall`: the 2D pit shaft's navy → ink bands), a neutral stone slab
 * (`floor/slab`) and the awning stripes (`ensureAwningTile`: two colours). The kits register their own looks; these only make an undressed floor fail soft.
 */
import type { Color } from '../../../engine/color';
import { PAL } from '../../../engine/palette';
import { hash2 } from '../../art/paint';
import { defineFloorTile, hasFloorTile } from './registry';

let done = false;

/** Shade a packed colour by k (< 1 darker, > 1 lighter), opaque. */
export function shade(c: Color, k: number): Color {
  const r = Math.max(0, Math.min(255, Math.round((c >>> 24) * k)));
  const g = Math.max(0, Math.min(255, Math.round(((c >>> 16) & 255) * k)));
  const b = Math.max(0, Math.min(255, Math.round(((c >>> 8) & 255) * k)));
  return ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
}

/** Register the built-in tiles (once). */
export function ensureBuiltinTiles(): void {
  if (done) return;
  done = true;
  // The pit's floor: ink with a faint navy mottle.
  defineFloorTile('floor/pit', {
    w: 32,
    h: 32,
    paint: (a, b) => (hash2(Math.floor(a), Math.floor(b), 71) < 0.2 ? PAL.navy[0] : PAL.ink[0]) >>> 0,
  });
  // The pit's walls: the 2D shaft's bands from the rim down (navy 4 px, navy 8 px, then ink).
  defineFloorTile('floor/pit-wall', {
    w: 32,
    h: 48,
    paint: (_a, b) => (b < 4 ? PAL.navy[1] : b < 12 ? PAL.navy[0] : b < 26 ? PAL.ink[1] : PAL.ink[0]) >>> 0,
  });
  // A plain stone slab (the default of slabs and roofs without a tile).
  defineFloorTile('floor/slab', {
    w: 16,
    h: 8,
    paint: (a, b) => {
      const joint = Math.floor(a) % 16 === 0 || Math.floor(b) % 8 === 0;
      const n = hash2(Math.floor(a / 2), Math.floor(b / 2), 13);
      return (joint ? PAL.steel[1] : n < 0.3 ? PAL.steel[2] : PAL.steel[3]) >>> 0;
    },
  });
}

/**
 * The stripe tile of an awning: stripes `stripe` world px wide along u in two colours, running in
 * depth (from the facade to the platform line). Registered on first use.
 */
export function ensureAwningTile(colors: readonly [Color, Color], stripe: number): string {
  const id = `floor/awning/${(colors[0] >>> 0).toString(16)}/${(colors[1] >>> 0).toString(16)}/${stripe}`;
  if (hasFloorTile(id)) return id;
  const w = Math.max(2, Math.round(stripe)) * 2;
  defineFloorTile(id, {
    w,
    h: 4,
    paint: (a) => {
      const first = ((a % w) + w) % w < w / 2;
      return first ? colors[0] >>> 0 : colors[1] >>> 0;
    },
  });
  return id;
}
