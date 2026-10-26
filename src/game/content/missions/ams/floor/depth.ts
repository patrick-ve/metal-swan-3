/**
 * Depth rules for the `ams` decor on a perspective floor (docs/design/floor.md §1.3, §3.7): where
 * each kind of decor stands in depth (the kits' DEPTH unit, docs/api/floor.md §2).
 *
 * - The house fronts (canal houses, FABEL FRIET and its neighbour, its hanging sign) stand at the
 *   facade's depth (FACADE, 14 px) on a house stretch.
 * - The old 2D bridge pieces are replaced: the arch face is the deck's near face (tiles.ts), the
 *   back railing a row, the front railing a front decor sprite (props.ts) → hidden here.
 * - Street furniture on an open quay stands on the far pavement (QUAY_PAVEMENT, ~24 px); on a house
 *   stretch on the narrow pavement in front of the facades (HOUSE_PAVEMENT).
 * - What a hittable entity sits on (a lamp with a perched gull, an elm with a secret in its crown)
 *   stays in the walk plane (0): art and hitbox must agree at v = 0 (spec §3.7). The section file
 *   sets those per item (`DecorDef.depth` wins over these rules).
 */
import type { DecorDef } from '../../../../mission/types';
import { FACADE } from './layout';

/** Street furniture on an open quay's far pavement and on a house stretch's narrow pavement. */
export const QUAY_PAVEMENT = 24;
export const HOUSE_PAVEMENT = 10;

const D = 'decor/ams/';
const FACADES = [`${D}house-`, `${D}fabel-friet-`, `${D}neighbour-`, `${D}fabel-sign`];
const REPLACED = [`${D}bridge-rail-`, `${D}bridge-face-`];

/** The default depth of an `ams` decor item (null = hidden; undefined = the floor's default). */
export function amsDecorDepth(d: DecorDef): number | null | undefined {
  const s = d.sprite;
  if (REPLACED.some((p) => s.startsWith(p))) return null;
  if (FACADES.some((p) => s.startsWith(p))) return FACADE;
  return undefined;
}

/** The decor items with a depth: `items.map(atDepth(14))`. */
export function atDepth(depth: number | null): (d: DecorDef) => DecorDef {
  return (d) => ({ ...d, depth });
}
