/**
 * The flashlight test of mission `sewers` (docs/design/sewers.md §5.1): `isLit(world, x, y)` is true
 * inside any living hero's cone or glow circle (the union over all players). The rats read it ONLY
 * to pick their art state (the whole body, or the eyes only); it never changes a hit, a speed, a
 * timing or an rng draw.
 *
 * Owner: wave P1b C (the stub was P1a RATS's). The geometry is the light pass's own
 * (mission/light/cone.ts `litByHeroes`: the cone from the muzzle along the aim, the battery's longer
 * cone, the hero glow r `heroLight`), so what a rat shows matches what the pass lights. A section
 * whose light config has no `cones` (a, b, the end, every other mission, a test world without a
 * pass) is lit everywhere: true. While a section's cones are off (c before FLASHLIGHTS ON) only the
 * hero glows light. `setLitOverride` is the test hook of spec §5.1 gate 1 (the sims run the same
 * with the light forced on and forced off). Pure: no allocation, no rng, no state written.
 */
import type { World } from '../../../engine/world';
import { flashlightsOn, lightControl } from '../../mission/light/api';
import { litByHeroes } from '../../mission/light/cone';

/** A test hook (no URL flag): null = the normal test, true / false = forced lit / dark everywhere. */
let litOverride: boolean | null = null;

/** Force every `isLit` answer (tests only); null restores the normal test. */
export function setLitOverride(v: boolean | null): void {
  litOverride = v;
}

/** The forced answer, or null (tests read it back). */
export function litOverrideOf(): boolean | null {
  return litOverride;
}

/**
 * Is world point (x, y) inside a living hero's flashlight cone or glow circle? True everywhere in a
 * section without cones (a, b) and in a world without a light pass.
 */
export function isLit(world: World, x: number, y: number): boolean {
  if (litOverride !== null) return litOverride;
  const cfg = lightControl(world)?.cfg;
  if (!cfg || !cfg.cones || cfg.day === true || cfg.darkness <= 0) return true;
  return litByHeroes(world, x, y, cfg.heroLight ?? 0, flashlightsOn(world));
}
