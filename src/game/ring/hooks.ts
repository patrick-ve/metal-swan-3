/**
 * Seams of the ring runtime for the builders (docs/api/ring.md §6). A builder sets a hook from
 * its own module at import time (this leaf module has no imports at run time, so there is no
 * import cycle); the runner calls it. Null = the core's default.
 */
import type { RingRunner } from './runner';

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
}

export const RING_HOOKS: RingHooks = {
  boarding: null,
  planEnd: null,
};
