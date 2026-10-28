/**
 * Fail soft (docs/ARCHITECTURE.md §2 rule 7; docs/design/floor.md §3.1): the kit builds a section's
 * FloorDef and its floor-only decor while the section module loads (tiles, faces, rows). A kit that
 * throws there must not take the mission down: `kitFloor` logs once and gives no floor (the section
 * draws as a section without one), `kitDecor` logs once and gives no items.
 *
 * Floor-only decor (`floorOnly`, wave B): the items a section adds for its floor alone are marked
 * `DecorDef.floorOnly`, so every no-floor path (the switch on but the floor failed, `--floor-off`)
 * skips them and draws the flat section exactly as before the floor.
 */
import type { FloorDef } from '../../../../mission/floor/types';
import type { DecorDef } from '../../../../mission/types';

/** The FloorDef `build` makes, or none (logged) when it throws. */
export function kitFloor(key: string, build: () => FloorDef): FloorDef | undefined {
  try {
    return build();
  } catch (err) {
    console.warn(`[floor] the floor of ${key} failed to build; the section draws without it:`, err);
    return undefined;
  }
}

/** The floor-only decor `build` makes, or none (logged) when it throws. */
export function kitDecor(key: string, build: () => DecorDef[]): DecorDef[] {
  try {
    return build();
  } catch (err) {
    console.warn(`[floor] the floor decor of ${key} failed to build; left out:`, err);
    return [];
  }
}

/** Marks `items` floor-only (`DecorDef.floorOnly`: drawn only while the section has a floor) and returns them. */
export function floorOnly(items: DecorDef[]): DecorDef[] {
  for (const d of items) d.floorOnly = true;
  return items;
}
