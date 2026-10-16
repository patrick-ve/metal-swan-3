/**
 * Floor 0 — `fps-0` "TEST RANGE" (docs/design/fps.md §6.0): a 20 × 12 starting map. Room A
 * (start) shows every wall texture `A`–`P` along its north and west walls; room B holds the gold
 * key (plain door), room C the silver key (plain door from B, gold-door shortcut from A), the
 * east room is behind the silver door, the elevator behind the lift door (switch `X` at (19, 2)).
 * The push wall at (3, 9) slides west into a closet with the golden record (`secrets: 1`).
 * Group actors adds one of every enemy type and pickup (hand-over, spec §11).
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
    'L.......C.....H....X',
    'M..Q....|.....H....Y',
    'N.......C..+..H....Y',
    'O>......C.....HY_YYA',
    'P.......CCC-CCH....A',
    'A.......C..l..H..w.A',
    'AAAA....!.....H....A',
    'A..*....C.....:....A',
    'A.9A..c.C.....H.n..A',
    'AAAAAAAAAAAAAAAAAAAA',
  ],
});
