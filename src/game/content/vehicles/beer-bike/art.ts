/**
 * Art of the beer bike, its driver and the cork (docs/design/ams-extras.md §2.2, §2.3): baked 40 px
 * sets (docs/design/ams40.md wave 3; drawn offline by tools/art40/chars/beer-bike/, stag-beer-bike/
 * and cork/, `npm run art40 -- beer-bike`). One 1× picture at every art tier (plan rule 7).
 *
 * - `vehicle/beer-bike/…` (the enemy bike and the rideable vehicle share it), every strip but the
 *   centre-anchored pieces anchored at the bike's anchor (the floor under its middle), facing right:
 *   `body` (BODY_INTACT / BODY_DAMAGED: the striped canopy, the oak bar counter with glasses and the
 *   tap tower, the red stools, the barrel on the rear deck that feeds the cannon through a hose, the
 *   drive shaft with the pedal hubs, the guide's saddle and bar, the front crate with the lamp),
 *   `posts` (the near roof posts, over the riders), `turret` (TURRET_FRAMES aim steps of the brass
 *   tap, 0 forward … 4 up), `wheel` / `wheel-far` (WHEEL_STEPS turn steps, one per WHEEL_STEP_PX
 *   px of roll), `wreck`, `keg` (KEG_STEPS, one per KEG_STEP_PX px rolled), `cork` (the cannon's
 *   cork), `foam` (the special: one 20-tick pass), `debris` (a plank, a hoop, a cushion, a glass).
 * - `enemy/stag-beer-bike/driver` (PEDAL_FRAMES: one crank turn, picked by the distance rolled,
 *   PEDAL_PX a frame) and `…/driver-flee` (12: the panicked run, `MIJN FIETS!`).
 * - `enemy/cork/fly` (CORK_STEPS frames, CORK_TPF ticks each: the tumbling fizzy-wine cork).
 */
import { defineBakedSet } from '../../../../engine/baked';
import { SET as BIKE, WHEEL_STEP_PX, WHEEL_STEPS } from '../../art40/beer-bike.gen';
import { SET as CORK } from '../../art40/cork.gen';
import { PEDAL_FRAMES, PEDAL_PX, SET as DRIVER } from '../../art40/stag-beer-bike.gen';

export const ART = 'vehicle/beer-bike';

export { BODY_DAMAGED, BODY_INTACT, KEG_STEP_PX, KEG_STEPS, TURRET_FRAMES, WHEEL_STEP_PX, WHEEL_STEPS } from '../../art40/beer-bike.gen';
export { CORK_STEPS, CORK_TPF } from '../../art40/cork.gen';
export { PEDAL_FRAMES, PEDAL_PX } from '../../art40/stag-beer-bike.gen';

/** The wheel strips' frame for a distance rolled along the facing (one step per WHEEL_STEP_PX px). */
export function wheelStep(rollAlongFacing: number): number {
  const k = Math.floor(rollAlongFacing / WHEEL_STEP_PX) % WHEEL_STEPS;
  return Number.isFinite(k) ? (k + WHEEL_STEPS) % WHEEL_STEPS : 0;
}

/** The driver's pedal frame for a distance rolled (either way): the feet keep pace with the bike. */
export function pedalFrame(rolled: number): number {
  const d = Math.abs(rolled);
  return Number.isFinite(d) ? Math.floor(d / PEDAL_PX) % PEDAL_FRAMES : 0;
}

defineBakedSet(BIKE);
defineBakedSet(DRIVER);
defineBakedSet(CORK);
