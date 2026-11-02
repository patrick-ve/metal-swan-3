/**
 * The MATCHA-MOMENT's slow world (docs/design/oat.md §6.2): for a while every non-player entity and
 * enemy shot steps on even ticks only (a fixed pattern, so it stays deterministic). The mission
 * runner implements it (`MissionRunner.slowWorld`, an additive opt-in); content asks through this
 * helper, which does nothing in a world without a runner (unit tests, the fps floors).
 *
 * ```ts
 * slowWorld(world, 360);       // 6 s of slow motion (a second call extends it, never stacks)
 * slowWorldLeft(world);        // ticks left (0 = off)
 * ```
 */
import type { World } from '../../engine/world';
import { gameOf } from '../context';

/** What the helper needs from the mission runner. */
export interface SlowWorldHost {
  slowWorld(ticks: number): void;
  readonly slowTicks: number;
}

function hostOf(world: World): SlowWorldHost | null {
  const r = gameOf(world).runner as Partial<SlowWorldHost> | null;
  return r && typeof r.slowWorld === 'function' ? (r as SlowWorldHost) : null;
}

/** Slow the world for `ticks` (the longer of the running and the new time). */
export function slowWorld(world: World, ticks: number): void {
  hostOf(world)?.slowWorld(ticks);
}

/** Ticks of slow world left (0 = off, or no runner). */
export function slowWorldLeft(world: World): number {
  return hostOf(world)?.slowTicks ?? 0;
}
