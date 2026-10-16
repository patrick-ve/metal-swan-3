/**
 * Floor 1 — `fps-1` "SUPPLY DEPOT" (docs/design/fps.md §6.1): 48 × 48, three bands (north
 * y 1–12, middle y 14–29, south y 31–46). An original layout.
 *
 * The forced key loop: freight car (start) → rail yard → barracks → mess hall → fuel store →
 * motor pool (gold key) → gold door → warehouse (silver key; its second gold door opens back to
 * the yard) → officers' wing → silver door → corridor → elevator (switch `X` at (45, 6)).
 * Five secrets (push walls): S1 (4, 32) west, S2 (27, 45) east, S3 (43, 43) east, S4 (30, 8)
 * south with the golden record, S5 (27, 4) north with the music box and the chaingun.
 *
 * Enemies E / N / H: 22 / 34 / 46 (lower-case letters by difficulty: g h i guards, o p q
 * officers, s t u SS, d e f dogs). A dog patrols the yard along y 36; two barracks guards sleep
 * (ambush); a warehouse guard patrols y 20. Par 3:30. Checked by validate.ts (rules 1–9).
 */
import { PAL } from '../../../engine/palette';
import { defineFpsFloor } from '../../fps/registry';

export const FLOOR_1 = defineFpsFloor({
  id: 'fps-1',
  number: 1,
  name: 'SUPPLY DEPOT',
  par: 210,
  secrets: 5,
  ceil: PAL.steel[0],
  floor: PAL.stone[1],
  music: 'fps-floor',
  rows: [
    'AAAAAAAAAAAAAABAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    'A.........F............AA8...yAAAAAAAAAAAAAAAAAA',
    'A.6..T...6F....c.......AA.....AAAAAAAAAAAAAAAAAA',
    'A.........G.......o....AA.....AAAAAAAAYYYYYYYYAA',
    'A......p..F..V......V..AAAA*AAAABAAAAAY......YAA',
    'A.........F............A...........f..Y......YAA',
    'AFFFF-FFFFF............:....d....t....]......XAA',
    'A......................A..............Y......YAA',
    'A......................AAAAAAA*AAAABAAY......YAA',
    'B...q...........s......AAAAA.....AAAAAYYYYYYYYAA',
    'A.......u..............BAAAA.....AAAAAAAAAAAAAAA',
    'A...........h.......n..AAAAA9...cAAAAAAAAAAAAAAA',
    'A......................AAAAAAAAAAAAAAAAAAAAAAAAA',
    'AAAAAAAAAAAA-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    'A................q..+A............A............A',
    'A....c....h........7.A.....k......A..........w.A',
    'A....................A..Q....g...cA...i........A',
    'A..RRRRRRR..RRRRRRR..A............A............A',
    'A....................A...d......Q.A....ZZ...h..A',
    'A....................A......R.....A............A',
    'A.....g..............A......R.d...|............A',
    'A....................A............A.......s....A',
    'A....................!............A...........+A',
    'A..RRRRRRR..RRRRRRR..A..e......p..A............A',
    'A....................A............A........ZZ..A',
    'A...............s....A.....d......A.....g......A',
    'A...t..........g.....A.i.......f..A..u.........A',
    'A.l.......o..........A....Z.......A............A',
    'A.................c..A.rr.......7.A.c.........ZA',
    'A....................A............A............A',
    'AAAAAAAAA=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA-AAAAAAA',
    'Ac..A............A....T...T....A..............cA',
    'A...*............A..5........5.A...............A',
    'Ac5.A...g...RR...A.............A......6.\'......A',
    'AAAAA............A.......q.....A...............A',
    'A.............g..A.............A.........g.....A',
    'A........e.......A..g.......g..|...TTT......o..A',
    'A................|.............A...............A',
    'A..h..QQ....c....A.T...........A....g..........A',
    'A................A....T...T..i.A...............A',
    'ALLLL-LLLL.....i.A.c...........A...TTT.....AAAAA',
    'ALr......L.,..,..A......g......A...........A..1A',
    'AL.....c.L.......A.............A..h.....\'..A...A',
    'AL.,.....L.,.g,..A.........AAAAA...........*...A',
    'AL...^.,.L.....c.A.h.......A..+A.......u...A...A',
    'AL.......L.,.....A.........*...A..n.n......A...A',
    'ALLLLLLLLL....n..A......+..A6.7A...........An.nA',
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  ],
  things: [
    // R2 rail yard: the dog patrols y 36 between the turn markers.
    { at: [9, 36], facing: 'E', patrol: true },
    { at: [3, 36], turn: 'E' },
    { at: [15, 36], turn: 'W' },
    // R3 barracks: two guards asleep in their bunks.
    { at: [20, 36], ambush: true },
    { at: [28, 36], ambush: true },
    // R6 warehouse: a guard patrols the middle aisle (y 20).
    { at: [6, 20], facing: 'E', patrol: true },
    { at: [2, 20], turn: 'E' },
    { at: [19, 20], turn: 'W' },
  ],
});
