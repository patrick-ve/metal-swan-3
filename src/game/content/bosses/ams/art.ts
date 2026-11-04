/**
 * MECHA HASLEMA — the registration of every strip of `boss/ams-mayor/`. Every strip is the baked
 * 40 px high-fidelity set (docs/design/ams40.md "The mayor", wave 6; drawn offline by
 * tools/art40/chars/ams-mayor/, `npm run art40 -- ams-mayor`): one 1× picture at every art tier
 * (plan rule 7), no 2× / 4× drawers.
 *
 * The pieces share one anchor (0, 0) = the floor point between her feet, drawn facing right;
 * mayor.ts composes them per tick (back to front: the far arm at rest, the legs, the body, the
 * head, the chain, the medallion, the far arm in front, the stamp arm, the lash). Frame roles are
 * the gen file's constants:
 * - `legs` — LEGS_* (stand, the stomp hop, the stagger, the death sit) and the 12-frame walk from
 *   MAYOR_WALK; the point `hip` on every frame (the upper body follows it down).
 * - `stamp-arm-<stage>` — ARM_* × 2: ARM_FRAMES roles facing right, then the same pre-mirrored
 *   (the GESLOTEN label reads either way); `stamp-arm-gone` — the sparking stump (STUMP_FRAMES).
 * - `arm-back` — BACK_*: rest, the chain flail whirled high / low (BACK_WHIRL_STEPS), the wind-up,
 *   the release, the pull back, the catch.
 * - `lash` — LASH_*: out, the snap, back (mayor.ts shows the last lashLen + 4 px).
 * - `head-<stage>` HEAD_*, `medallion-<stage>` MED_*, `body-<stage>`, `chain-<stage>`,
 *   `chain-gone`, `wig` (WIG_FRAMES), `spring`, `shadow` and the shots `noise-letter`,
 *   `shield-shot`, `stamp-wave` (shots.ts).
 */
import { defineBakedSet } from '../../../../engine/baked';
import { SET } from '../../art40/ams-mayor.gen';

defineBakedSet(SET);
