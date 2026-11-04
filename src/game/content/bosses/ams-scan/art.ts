/**
 * The parking scan car fight — the registration of every strip of `boss/ams-scan/` (geometry.ts
 * `ID`). Every strip is a baked 40 px set (docs/design/ams40.md wave 6; drawn offline by
 * tools/art40/chars/<slug>/, `npm run art40 -- <slug>`): one 1× picture at every art tier (plan
 * rule 7), no 2× / 4× drawers.
 *
 * The car and its driver (`ams-scan.gen.ts`, tools/art40/chars/ams-scan/): the strips share the car
 * anchor (the floor point under its middle, facing right); car.ts draws them back to front:
 * scanner, body, cabin, lettering, wheels, lamp glows. Frame roles are the gen file's constants.
 * - `body-<0|1|2>` (damage stage) — the compact, tall white electric hatchback in the city's livery
 *   with its tinted glass: BODY_LEVEL, BODY_SQUAT (nose up: the rev, the launch), BODY_DIVE (nose
 *   down: the brake), a column shear (BODY_TILT_MILLI) that car.ts repeats for the overlays.
 * - `cabin` — the officer behind the glass by role (CAB_*), the airbag popping and full.
 * - `scanner-<0|1|2>` — the white box on its rack by role (SCAN_*: the rise, the red sweep, the
 *   lock, the print kick and recoil); `scanner-gone` — the bent rack.
 * - `text` (4, never mirrored) — letter-like print marks (front door, rear door per facing, the box
 *   number); never readable.
 * - `wheel` (4 turn steps), `blink` (BLINK_HAZARD amber, BLINK_REVERSE white, BLINK_BRAKE red).
 * - `wreck` (deferred) — the tumble onto its roof per facing (WRECK_*), never flipped.
 * - `reticle` (RETICLE_*: tracking, the snap, locked) and `ticket` (the printed strip, TICKET_FRAMES).
 */
import { defineBakedSet } from '../../../../engine/baked';
import { SET as SCAN_SET } from '../../art40/ams-scan.gen';
import { SET as TOW_SET } from '../../art40/ams-tow-truck.gen';
import { SET as CLAMP_SET } from '../../art40/ams-wheel-clamp.gen';
import { ID } from './geometry';

/** Every strip of the fight (section c's art list wants them all; `SCAN_DEFERRED_IDS` are rare). */
export const SCAN_ART_IDS: readonly string[] = [
  ...ID.body,
  ...ID.scanner,
  ID.scannerGone,
  ID.text,
  ID.cabin,
  ID.wheel,
  ID.blink,
  ID.wreck,
  ID.reticle,
  ID.ticket,
  ID.truck,
  ID.hook,
  ID.clamp,
  ID.clampFoot,
];
/** Strips drawn only at the end of the fight. */
export const SCAN_DEFERRED_IDS: readonly string[] = [ID.wreck];

// The car with its driver, the scanner, the lettering, the lamps, the wreck, the SCAN LOCK reticle and
// the printed strip (tools/art40/chars/ams-scan).
defineBakedSet(SCAN_SET);
// The tow truck and its hook, the wheel clamp and the clamp on a boot: baked 40 px sets of the shared
// prefix (tools/art40/chars/ams-tow-truck, ams-wheel-clamp; 1× at every tier, plan rule 7).
defineBakedSet(TOW_SET);
defineBakedSet(CLAMP_SET);
