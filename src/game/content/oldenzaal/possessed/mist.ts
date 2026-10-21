/**
 * Mission oldenzaal — the pale mist puff of the possessed (bloodless: a hit soul, an eject, a burst
 * ghost shot). Owner: POSSESSED.
 */
import type { World } from '../../../../engine/world';
import { FxEntity, type FxOpts } from '../../../fx';

const mistOpts: FxOpts = { sprite: 'fx/oz/soul/mist', x: 0, y: 0, vy: -0.25, ticksPerFrame: 5, alpha: 0.85, z: 61 };

/** A pale mist puff at (x, y) (one reused options record; an event, not per tick). */
export function mistAt(world: World, x: number, y: number, alpha = 0.85): void {
  mistOpts.x = x;
  mistOpts.y = y;
  mistOpts.alpha = alpha;
  FxEntity.spawn(world, mistOpts);
}
