/**
 * The wave-B sections of the `ams` floor (docs/design/floor.md §12.3): one folder per section, each
 * with its builder's switch. The floor tests read this list (`tests/game/floor-sections.test.ts`
 * EXPECTED_FLOORS): a section whose switch is on must have a floor, so a builder never edits a shared
 * file to enrol one.
 */
import { B_FLOOR_ON } from './b/index';
import { C_FLOOR_ON } from './c/index';
import { C1_FLOOR_ON } from './c1/index';
import { C2_FLOOR_ON } from './c2/index';
import { D_FLOOR_ON } from './d/index';

/** Each wave-B section and whether its floor is on. */
export const AMS_WAVE_B: readonly { readonly id: string; readonly on: boolean }[] = [
  { id: 'b', on: B_FLOOR_ON },
  { id: 'c', on: C_FLOOR_ON },
  { id: 'c1', on: C1_FLOOR_ON },
  { id: 'c2', on: C2_FLOOR_ON },
  { id: 'd', on: D_FLOOR_ON },
];
