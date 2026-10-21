/**
 * Mission oldenzaal — the crawler's hold on a hero's feet (spec §3.2). Owner: ZOMBIES.
 *
 * A status (`oz-grabbed`): no running and no jumping while a crawler holds the feet; the hero
 * can still turn, crouch and shoot (a hit on the crawler breaks the hold) and taps JUMP or a
 * direction to break free (the crawler counts the taps). One crawler per hero; the hold ends
 * when the crawler lets go, dies or is removed, when the hero dies, or after `CRAWLER.hold` + a
 * margin (a safety net: never stuck).
 */
import type { Entity } from '../../../../engine/entity';
import { PAL } from '../../../../engine/palette';
import type { Player } from '../../../player/player';
import type { StatusEffectDef } from '../../../player/status';
import { defineStatus } from '../../../registry';
import { CRAWLER } from './numbers';

export const OZ_STATUS_GRABBED = 'oz-grabbed';

/** Who holds whom (one crawler per hero). */
const holders = new WeakMap<Player, Entity>();

export const GRABBED: StatusEffectDef = defineStatus({
  id: OZ_STATUS_GRABBED,
  ticks: CRAWLER.hold + 30,
  speed: 0,
  noJump: true,
  noMount: true,
  tint: PAL.olive[1],
  tintAlpha: 0.18,
  onTick(p) {
    const h = holders.get(p);
    if (!h || !h.alive || h.removed) p.status.remove(OZ_STATUS_GRABBED);
  },
  onEnd(p) {
    holders.delete(p);
  },
});

/** Start a hold (false when the hero is held already). */
export function grab(p: Player, by: Entity): boolean {
  const h = holders.get(p);
  if (h && h !== by && h.alive && !h.removed) return false;
  holders.set(p, by);
  p.status.add(GRABBED);
  return true;
}

/** End the hold of `by` on `p` (no-op when someone else holds it). */
export function release(p: Player, by: Entity): void {
  if (holders.get(p) !== by) return;
  holders.delete(p);
  p.status.remove(OZ_STATUS_GRABBED);
}

/** Is the hero held by a crawler? */
export function isGrabbed(p: Player): boolean {
  return p.status.has(OZ_STATUS_GRABBED);
}
