/**
 * `enemy/handhaver…` — the city enforcement officer (docs/design/amsterdam.md §2) and his thrown
 * `enemy/boete-ticket/fly`: baked 40 px sets (docs/design/ams40.md wave 1; drawn offline by
 * tools/art40/chars/handhaver/, handhaver-c/ and boete-ticket/, `npm run art40 -- handhaver`).
 * Navy uniform and peaked cap, the warm hi-vis vest with silver bands, a radio, the ticket book.
 *
 * - `enemy/handhaver` (skin a) and its palette variant `enemy/handhaver-b` (skin b);
 *   `enemy/handhaver-c` (skin c) is a look of its own: curly hair (a part, not a palette swap).
 * - Strips (one 1× picture at every art tier, plan rule 7): idle 4, walk 12 (4 ticks a frame: 48
 *   ticks, 28.8 px a cycle at 0.6 px/tick), turn 2 (the Turner's in-betweens), alert 1, tell 4
 *   (opens the book, licks the pencil, tears the ticket off, the wind-up held: TELL_WINDUP), throw 6
 *   (the flick on frame THROW_RELEASE = 0, follow-through, settle: 20 ticks), photo-pose 6, the
 *   deferred gloat 6 (frame roles GLOAT_WRITE … GLOAT_DONE) and cower 4, die 10, die-knife 10,
 *   die-blast 10, die-burn 8, die-crush 6 (the same total ticks as before).
 * - `enemy/boete-ticket/fly`: 8 frames × TICKET_TPF ticks, the slip tumbling end over end
 *   (TICKET_FLAT: the frame of the page lying on the ground).
 */
import { defineBakedSet } from '../../../engine/baked';
import type { HumanStyle } from '../../art/humanoid';
import { SET as TICKET } from '../art40/boete-ticket.gen';
import { SET as OFFICER_C } from '../art40/handhaver-c.gen';
import { SET as OFFICER } from '../art40/handhaver.gen';

/**
 * The officer's look for the (dormant) ring crew and convoy art, which still draw him with the HD
 * human rig (src/game/content/ring/): not used by the handhaver's own sprites.
 */
export const HANDHAVER_STYLE: HumanStyle = {
  skin: 'skinA', hair: 'hairB', hairStyle: 'short', headgear: 'cap', gear: 'navy', accent: 'gold',
  top: 'gold', topType: 'vest', shirt: 'navy', pants: 'navy', boots: 'black', belt: 'black',
  accessories: ['hivis'], build: 'normal',
};

defineBakedSet(OFFICER);
defineBakedSet(OFFICER_C);
defineBakedSet(TICKET);
