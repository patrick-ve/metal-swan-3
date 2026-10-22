/**
 * Seams of the ring runtime for the builders (docs/api/ring.md §6). A builder sets a hook from
 * its own module at import time (this leaf module has no imports at run time, so there is no
 * import cycle); the runner calls it. Null = the core's default.
 */
import type { MissionDef } from '../mission/types';
import type { RingRunner } from './runner';
import type { RingPlan } from './types';

export interface RingHooks {
  /**
   * The mission starts (WAGON: the boarding scene at the on-ramp, spec §10). Called after the
   * heroes and wagons exist and the camera stands at the start. Return true when the hook took
   * over the start (it places / animates the wagons itself); false or null = the wagons stand in
   * their start lanes at once.
   */
  boarding: ((runner: RingRunner) => boolean) | null;
  /**
   * The plan cursor reached the plan's end (after the end-boss slot, spec §10): the matrix shows
   * the exit, the wagons take the off-ramp … then the hook calls `runner.completeMission()`.
   * Default: `completeMission()` at once.
   */
  planEnd: ((runner: RingRunner) => void) | null;
  /**
   * Revision R (docs/design/ring.md §R.4): the plan cursor reached the end of the SHORT route (the
   * end of the `final-jam` chunk; the full route calls `planEnd`). The alight scene: the road stands
   * (`runner.limitSpeed('alight', 0)`), the heroes climb out of the windows and jump down, the
   * drivers stay at the wheel; then the hook calls `runner.handOver()` (→ the on-foot part, `rf-a`).
   * Default (null): `handOver()` at once. Owner: JAM+FOOT (ring/alight.ts sets it at import time).
   */
  alight: ((runner: RingRunner) => void) | null;
  /**
   * Revision R: the on-foot part's def for a play (content/ring/foot/index.ts `ringFootDef` sets it
   * at import time). A hook, not an import: the foot content registers sprites and entities, and
   * the scene modules (ring-route.ts, art-def.ts) are in every mission's static import graph.
   */
  footDef: ((plan: (Pick<RingPlan, 'hostages'> & Partial<Pick<RingPlan, 'drivers'>>) | null) => MissionDef) | null;
}

export const RING_HOOKS: RingHooks = {
  boarding: null,
  planEnd: null,
  alight: null,
  footDef: null,
};

/** The foot def of a play (the hook above); throws when the `ring/foot` content is not loaded. */
export function ringFootDefOf(plan: (Pick<RingPlan, 'hostages'> & Partial<Pick<RingPlan, 'drivers'>>) | null): MissionDef {
  const f = RING_HOOKS.footDef;
  if (!f) throw new Error('ring: the on-foot content (ring/foot) is not loaded');
  return f(plan);
}
