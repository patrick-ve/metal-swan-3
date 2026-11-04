/**
 * `npc/ams/ams-staff/<look>/<anim>` — the FABEL FRIET crew, looks 0–2: baked 40 px sets
 * (docs/design/ams40.md wave 5; drawn offline by tools/art40/chars/ams-staff/ with the looks in
 * ams-staff-0/, -1/, -2/, `npm run art40 -- ams-staff-0`). One animation, three looks as part swaps
 * (plan rule 6): 0 the blond ponytail and freckles in the white crew shirt, 1 black curls under the
 * shop cap in the teal shirt, 2 a dark bob and round glasses in the red shirt; the shop apron, belt,
 * trousers and shoes are shared.
 *
 * Strips (one 1× picture at every art tier, plan rule 7; facing right, feet anchor):
 * - idle 4 (breathing; 15 / 17 / 19 ticks a frame for looks 0 / 1 / 2), walk 12 × 3 ticks (drawn
 *   for PERSON_WALK_SPEED 0.8: a 28.8 px stride, the planted foot keeps still on the floor), clap 6 (the impact with a
 *   spark; 12 ticks, look 1: 16), cheer 8 (a hop for joy, 32 ticks), wave 6 (the palm trails the
 *   swing, 20 ticks);
 * - in-clap, in-cheer, in-wave 2 × PERSON_TR_TICKS and turn 2 × PERSON_TURN_TICKS (the entity plays
 *   them, entities.ts `AmsPerson.draw`).
 */
import { defineBakedSet, type BakedSet } from '../../../../engine/baked';
import { SET as CREW_0 } from '../../art40/ams-staff-0.gen';
import { SET as CREW_1 } from '../../art40/ams-staff-1.gen';
import { SET as CREW_2 } from '../../art40/ams-staff-2.gen';

/** The crew sets by look (`npc/ams/ams-staff/<look>`). */
export const STAFF_SETS: readonly BakedSet[] = [CREW_0, CREW_1, CREW_2];
/** Number of crew looks (the `look` spawn param is clamped to 0 … STAFF_LOOKS − 1). */
export const STAFF_LOOKS = STAFF_SETS.length;

for (const set of STAFF_SETS) defineBakedSet(set);
