/**
 * The depth rules of the town's decor on the perspective floor (docs/design/floor.md §1.3, §3.6,
 * §5.1; docs/api/floor.md §3 `decorDepth`, `DecorDef.depth`). DEPTH = screen px behind the walk
 * line on flat ground; a decor item at depth D stands on that floor row and scrolls at its speed.
 *
 * - the fronts (shops, De Smulhoek) and what hangs on them (banners, the flag): the facade depth;
 * - things lying at the fronts' feet (weeds, rubbish, glass under the smashed windows, the toppled
 *   bins and bikes): just in front of the facade, by their old offset below the walk line (an
 *   item that lay k px below the line now lies k px in front of the facade), on the pavement (at
 *   most as far forward as the lamps' row: the street logic, nothing in the gutter);
 * - things standing on the pavement (benches, bins, the wares): just in front of the facade;
 * - the street lamps, the crows on them, the signpost, the emergency sign and the police tape: on
 *   the pavement by the kerb (`lamp`);
 * - the walk plane (depth 0, as before): awnings and balconies (their valance and rail at the
 *   platform's front edge, the canopy / slab from the floor kit), the cars, the planters on the
 *   walls;
 * - blown newspapers: on the street, as far in front of the walk line as they lay below it;
 * - front decor (bike racks, crowd barriers): on the near side by the front post row; the old
 *   front bollards are hidden (the front post row replaces them).
 *
 * An item that lay k px below the walk line keeps its screen spot only with y = G and the depth
 * moved by k (`ozFloorDecor`): the floor draws decor at y − depth with the depth's speed, so a y
 * offset would slide over the floor rows (spec §2: everything in world space).
 */
import type { DecorDef } from '../../../../mission/index';
import { G } from '../terrain';

/** A section's depths (DEPTH units). */
export interface OzDecorDepths {
  /** The shop fronts. */
  facade: number;
  /** The lamps' row on the pavement by the kerb. */
  lamp: number;
  /** The near side: the base of the front decor (crowd barriers, bike racks). */
  front: number;
}

type Rule = 'facade' | 'foot' | 'stand' | 'lamp' | 'walk' | 'street' | 'front' | 'hide';

const RULES: Readonly<Record<string, Rule>> = {
  'decor/oz/shop': 'facade',
  'decor/oz/smulhoek': 'facade',
  'decor/oz-ruin/banner': 'facade',
  'decor/oz/flag': 'facade',
  'decor/oz-ruin/weeds': 'foot',
  'decor/oz-ruin/rubbish': 'foot',
  'decor/oz-ruin/glass': 'foot',
  'decor/oz-ruin/bin': 'foot',
  'decor/oz-ruin/bike': 'foot',
  'decor/oz/bench': 'stand',
  'decor/oz/bin': 'stand',
  'decor/oz/wares': 'stand',
  'decor/oz/menu-board': 'stand',
  'decor/oz/parasol': 'stand',
  'decor/oz/smulhoek-screen': 'stand',
  'decor/oz/lamp': 'lamp',
  'decor/oz-ruin/crow': 'lamp',
  'decor/oz/signpost': 'lamp',
  'decor/oz-ruin/sign': 'lamp',
  'decor/oz-ruin/tape': 'lamp',
  'decor/oz/awning': 'walk',
  'decor/oz/balcony': 'walk',
  'decor/oz/planter': 'walk',
  'decor/oz-ruin/car': 'walk',
  'decor/oz-ruin/paper': 'street',
  'decor/oz/bike-rack': 'front',
  'decor/oz-ruin/barrier': 'front',
  'decor/oz/bollard': 'hide',
};

/** The rule of a sprite (unknown back decor stands at the fronts' feet; unknown front decor in the walk plane). */
function ruleOf(d: DecorDef): Rule {
  return RULES[d.sprite] ?? (d.front ? 'walk' : 'stand');
}

/** How far below the walk line an item was placed (≥ 0; items above it keep their y). */
function below(d: DecorDef): number {
  return Math.max(0, d.y - G);
}

/** The depth of a decor item on the floor (null: hidden). Uses the item's y as placed (see `ozFloorDecor`). */
export function ozDecorDepth(d: DecorDef, o: OzDecorDepths): number | null {
  const k = below(d);
  switch (ruleOf(d)) {
    case 'facade':
      return o.facade;
    case 'foot':
      // On the pavement: never nearer than the lamps' row by the kerb (a fallen bike stays out of the gutter).
      return Math.max(o.lamp, o.facade - Math.max(1, k));
    case 'stand':
      return o.facade - 1.5;
    case 'lamp':
      return o.lamp;
    case 'walk':
      return 0;
    case 'street':
      return -k;
    case 'front':
      return o.front - k;
    case 'hide':
      return null;
  }
}

/**
 * The section's decor list for the floor: every item gets its depth (`DecorDef.depth`), and an
 * item that lay below the walk line moves its offset into the depth (y = G), so it scrolls with
 * the floor row it lies on. Positions along the street (x), sprites, frames and order stay.
 */
export function ozFloorDecor(list: readonly DecorDef[], o: OzDecorDepths): DecorDef[] {
  return list.map((d) => {
    const depth = ozDecorDepth(d, o);
    const fold = depth !== null && below(d) > 0 && ruleOf(d) !== 'walk';
    return { ...d, y: fold ? G : d.y, depth };
  });
}
