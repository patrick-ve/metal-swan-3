/**
 * Floor 2 — `fps-2` "HANGAR" (docs/design/fps.md §6.2): 32 × 32, the boss floor. An original
 * layout. No keys and no elevator: the floor ends when MechaHitler dies (boss.ts, the death-cam).
 *
 * Lift (start) → antechamber (supply room west with the chaingun, locker room east) → the arena
 * (18 × 18, four 2 × 2 pillars, four alcoves, MechaHitler at (15, 4) facing south). The spawn
 * bays west and east hold the reinforcement points (2 / 3 / 4 SS at 50 % suit HP). Secrets: S1
 * (3, 28) south from the supply room (golden record, 1UP), S2 (27, 28) south from the locker
 * room (music box, clips). A clip in the lift (a restart with pistol + 8 is not hopeless); two
 * cover clips behind the south pillars (one on HARD). Enemies (not the boss) E / N / H: 3 / 5 / 8. Par 2:30. Music
 * `fps-floor` until the boss wakes (then `fps-boss`). Checked by validate.ts (rules 1–11).
 */
import { PAL } from '../../../engine/palette';
import { defineFpsFloor } from '../../fps/registry';

export const FLOOR_2 = defineFpsFloor({
  id: 'fps-2',
  number: 2,
  name: 'HANGAR',
  par: 150,
  secrets: 2,
  ceil: PAL.navy[0],
  floor: PAL.steel[1],
  music: 'fps-floor',
  boss: true,
  rows: [
    'JJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ',
    'JJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ',
    'JJJJJJJ..................JJJJJJJ',
    'JJJJJJJ.U..............U.JJJJJJJ',
    'JJJJJJ+........@.........cJJJJJJ',
    'JJJJJJJ..................JJJJJJJ',
    'JJJJJJJ...KK........KK...JJJJJJJ',
    'JJJJJJJ...KK........KK...JJJJJJJ',
    'JJJJJJJ..........."......JJJJJJJ',
    'JJJ...J..................J...JJJ',
    'JJJ...|...c..........c...|...JJJ',
    'JJJ...J..................J...JJJ',
    'JJJJJJJ......"...........JJJJJJJ',
    'JJJJJJJ..................JJJJJJJ',
    'JJJJJJJ...KK........KK...JJJJJJJ',
    'JJJJJJJ...KK........KK...JJJJJJJ',
    'JJJJJJc....c........c....+JJJJJJ',
    'JJJJJJJ..................JJJJJJJ',
    'JJJJJJJ.U.....c..c.....U.JJJJJJJ',
    'JJJJJJJ..................JJJJJJJ',
    'PPPPPPJJJJJJJJJ-JJJJJJJJJJOOOOOO',
    'PccccccnHU............UH......cO',
    'P.......H...c....i.....H....q.cO',
    'P..e....H...\'......\'g..H......cO',
    'P.......|..g...........|...o...O',
    'P.......H....t.....u...H.......O',
    'P...y...H.c..........c.H.......O',
    'P+...c.+HHHHHYY_YYYHHHHHn......O',
    'PPP*PPPPPJJJJY....YJJJJOOOO*OOOO',
    'N......NJJJJJY.^.cYJJJJN......cN',
    'N9....1NJJJJJY....YJJJJN.8....cN',
    'NNNNNNNNJJJJJYJJJJYJJJJNNNNNNNNN',
  ],
  things: [
    { at: [15, 4], facing: 'S' },
    // One more clip on HARD (rule 8 holds on every difficulty without the floor-1 carry).
    { at: [5, 27], minDiff: 'hard' },
    // The arena's cover clips south of the south pillars (lead decision 2026-10-16): both on EASY
    // and NORMAL, the west one only on HARD. The lift clip (17, 29) is on every difficulty.
    { at: [20, 16], maxDiff: 'normal' },
    // Reinforcement points (spec §7.2): 2 / 3 / 4 by difficulty.
    { at: [4, 10], spawn: 'ss', minDiff: 'easy' },
    { at: [27, 10], spawn: 'ss', minDiff: 'easy' },
    { at: [4, 9], spawn: 'ss', minDiff: 'normal' },
    { at: [27, 11], spawn: 'ss', minDiff: 'hard' },
  ],
});
