/**
 * `enemy/seagull/…` — the aggressive herring gull (docs/design/amsterdam.md §2): a baked 40 px set
 * (docs/design/ams40.md wave 4; drawn offline by tools/art40/chars/seagull/, `npm run art40 --
 * seagull`). A big white head and body, silver-grey wings with black tips and white mirror spots,
 * a yellow beak with the red spot, a mean pale eye under a frown, pink legs.
 *
 * Flying strips are anchored at the body centre; the standing strips (perch, gag, gag-fries, alert,
 * gloat) at the feet, the body centre 11 px over them; the take-off at the body centre with the
 * standing feet 11 px under it; the deaths at the feet (the game moves the anchor 7 px down when it
 * dies). One 1× picture at every art tier (plan rule 7).
 *
 * Strips: walk 12 (the flight flap), idle 12 (the hover: a shallow flap, the feet hanging), takeoff 6
 * (10 ticks: TAKEOFF_TIMING), pull-up 6 (6 ticks: PULLUP_TIMING), turn 2 (the Turner's widths,
 * TURN_TICKS a frame), tell 8 (KAW!, 20 ticks), attack 10 (the dive: the wings swept back, the beak
 * snapping), perch 4, gag 8 (asleep), gag-fries 8 (the chip steal), alert 4, photo-pose 6, the
 * deferred gloat 7 (the peck on GLOAT_PECK) and cower 6, die 10, die-blast 10, die-burn 8, die-crush 6
 * (the same total ticks as before), feather 8 (the death puff FX).
 */
import { defineBakedSet } from '../../../engine/baked';
import { SET as GULL } from '../art40/seagull.gen';

export { GLOAT_PECK } from '../art40/seagull.gen';

/** The take-off strip's frame times (the game draws it over the first 10 ticks of the flight). */
export const TAKEOFF_TIMING: readonly number[] = GULL.strips.takeoff.durations;
/** The pull-up strip's frame times (drawn over the first 6 ticks of the climb out of the dive). */
export const PULLUP_TIMING: readonly number[] = GULL.strips['pull-up'].durations;
/** Ticks per turn frame (the Turner's ticksPerFrame). */
export const TURN_TICKS: number = GULL.strips.turn.durations[0];
/** Turn frames (the Turner's widths). */
export const TURN_FRAMES: number = GULL.strips.turn.frames.length;

defineBakedSet(GULL);
