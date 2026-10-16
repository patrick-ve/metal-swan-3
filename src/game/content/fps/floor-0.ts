/**
 * Floor 0 — `fps-0` "TEST RANGE" (docs/design/fps.md §6.0): a 20 × 12 starting map. Room A
 * (start) shows every wall texture `A`–`P` along its north and west walls; room B holds the gold
 * key (plain door), room C the silver key (plain door from B, gold-door shortcut from A), the
 * east room is behind the silver door, the elevator behind the lift door (switch `X` at (19, 2)).
 * The push wall at (3, 9) slides west into a closet with the golden record (`secrets: 1`).
 * Group actors added one of every enemy type and pickup (spec §6.0): a patrolling guard and a dog
 * in room B, an officer and the chaingun in room C, an ambush SS in the east room, the other
 * pickups and the four treasures along the south of room A (none in sight of the start: §5.3
 * rule 9).
 */
import { PAL } from '../../../engine/palette';
import { defineFpsFloor } from '../../fps/registry';

export const FLOOR_0 = defineFpsFloor({
  id: 'fps-0',
  number: 0,
  name: 'TEST RANGE',
  par: 60,
  secrets: 1,
  ceil: PAL.steel[0],
  floor: PAL.stone[1],
  music: 'fps-floor',
  rows: [
    'ABDEFGIJAAAAAAAAAAAA',
    'K.......C.k...H....Y',
    'L.......C...g.H....X',
    'M..Q....|.....H....Y',
    'N.......C..+..H....Y',
    'O>......C....dHY_YYA',
    'P.......CCC-CCH....A',
    'A.......C..l..H..w.A',
    'AAAA....!.....H....A',
    'A..*5678C...o.:..s.A',
    'A.9Arbc1C....yH.n..A',
    'AAAAAAAAAAAAAAAAAAAA',
  ],
  things: [
    // The guard patrols room B east–west; the SS waits in ambush in the east room.
    { at: [12, 2], facing: 'W', patrol: true },
    { at: [17, 9], ambush: true },
  ],
});
