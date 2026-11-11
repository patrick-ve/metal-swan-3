/**
 * `enemy/fatbike-youth…` — the Amsterdam fatbike youths' looks 1–3 and the pairs (docs/design/
 * amsterdam.md §2): baked 40 px sets (docs/design/ams40.md wave 4 stage 2; drawn offline by
 * tools/art40/chars/fatbike-youth-{1a,2a,3a}/ and fatbike-youth-pair-{0a..3a}/ with the shared
 * tools/art40/chars/fatbike-youth-pair-kit/, `npm run art40 -- <slug>`). Look 0 solo is
 * fatbike-youth.art.ts (stage 1); the delivery rider is delivery-rider.art.ts.
 *
 * - Looks are part swaps on the same animation (plan rule 6): the stage-1 strips with the look's
 *   colours and heads. 1 purple hood, stone trackpants, sky-blue bike; 2 white cap, teal hoodie,
 *   navy trackpants, buzz cut, stone-grey bike; 3 orange hood, black trackpants, blond, green bike.
 * - Skins b and c are palette variants of each set (`-<look>b`, `-<look>c`).
 * - A pair (`fatbike-youth-pair-<look><skin>`) is the rider of that look with a passenger of look
 *   (look + 2) % 4 on the speaker box (skin a → c, b → a, c → b), with his own secondary motion on
 *   every bike strip; the rider-only strips are the solo twin's pictures; `passenger-flee` is his
 *   run at 2.2 px/tick (FatbikeYouth.deathEffects). Budget 40 (two youths and the bike, plan D1).
 * - One 1× picture at every art tier (plan rule 7): no dense art, no dense aliases.
 * - Strips, frame counts and logic times: the stage-1 set's (fatbike-youth.art.ts), KICK_HIT the
 *   same frame; no `cap` (only enemy/fatbike-youth holds the tumbling cap). `die` and `die-knife`
 *   never play for a youth (deathEffects starts `die-seat` in the same tick): one frame each, the
 *   same total ticks.
 */
import { defineBakedSet, type BakedSet } from '../../../engine/baked';
import { SET as LOOK1 } from '../art40/fatbike-youth-1a.gen';
import { SET as LOOK2 } from '../art40/fatbike-youth-2a.gen';
import { SET as LOOK3 } from '../art40/fatbike-youth-3a.gen';
import { SET as PAIR0 } from '../art40/fatbike-youth-pair-0a.gen';
import { SET as PAIR1 } from '../art40/fatbike-youth-pair-1a.gen';
import { SET as PAIR2 } from '../art40/fatbike-youth-pair-2a.gen';
import { SET as PAIR3 } from '../art40/fatbike-youth-pair-3a.gen';

/** The youth looks (0–3): the game picks one at random (FatbikeYouth). */
export const YOUTH_LOOKS: readonly string[] = [
  'black cap, red hoodie, grey trackpants, gold bike',
  'purple hood, stone trackpants, sky-blue bike',
  'white cap, teal hoodie, navy trackpants, stone-grey bike',
  'orange hood, black trackpants, green bike',
];

/** The skins (palette variants of every set). */
export const SKIN_KEYS = ['a', 'b', 'c'] as const;
export type SkinKey = (typeof SKIN_KEYS)[number];

/** Youth set id for a look (0–3), a skin and pair mode. */
export function youthSet(look: number, skin: SkinKey, pair: boolean): string {
  const base = pair ? 'fatbike-youth-pair' : 'fatbike-youth';
  return look === 0 && skin === 'a' && !pair ? 'fatbike-youth' : `${base}-${look}${skin}`;
}

/** The passenger of a pair: look (look + 2) % 4 and the next skin (a → c, b → a, c → b). */
export function passengerOf(look: number, skin: SkinKey): { look: number; skin: SkinKey } {
  return { look: (look + 2) % YOUTH_LOOKS.length, skin: skin === 'a' ? 'c' : skin === 'b' ? 'a' : 'b' };
}

/** The baked sets of the solo looks 1–3 (index look − 1). */
export const YOUTH_LOOK_SETS: readonly BakedSet[] = [LOOK1, LOOK2, LOOK3];
/** The baked sets of the pairs, rider looks 0–3. */
export const YOUTH_PAIR_SETS: readonly BakedSet[] = [PAIR0, PAIR1, PAIR2, PAIR3];

for (const set of [...YOUTH_LOOK_SETS, ...YOUTH_PAIR_SETS]) defineBakedSet(set);
