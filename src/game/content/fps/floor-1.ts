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
    'AAAAAAAAAAAAAABAAAABAAAANNNNNNNAAAAAAAAAAAAAAAAA',
    'A.........F............AN8...yNAAAAAAAAAAAAAAAAA',
    'A.6..T...6F....c.......AN.....NAAAAAAAAAAAAAAAAA',
    'A.........G.......o....AN.....NAAAAAAAYYYYYYYYAA',
    'A......p..F..V......V..AAAA*AAAABAAAAAY......YAA',
    'A.........F............A...........f..Y......YAA',
    'AFFFF-FFFFF............:....d....t....]......XAA',
    'A......................A..............Y......YAA',
    'A......................AAAAAAA*AAAABAAY......YAA',
    'B...q...........s......AAAAN.....NAAAAYYYYYYYYAA',
    'A.......u..............BAAAN.....NAAAAAAAAAAAAAA',
    'A...........h.......n..AAAAN9...cNAAAAAAAAAAAAAA',
    'A......................AAAANNNNNNNAAAAAAAAAAAAAA',
    'AAAAAAAAAAAA-AAAAAAAAHHHHHHHHHHHHHPPPPPPPPPPPPPP',
    'E................q..+H............P............P',
    'E....c....h........7.H.....k......P..........w.P',
    'E....................H..Q....g...cP...i........P',
    'E..RRRRRRR..RRRRRRR..H............P............P',
    'E....................H...d......Q.P....ZZ...h..P',
    'E....................H......R.....P............P',
    'E.....g..............H......R.d...|............P',
    'E....................H............P.......s....P',
    'E....................!............P...........+P',
    'E..RRRRRRR..RRRRRRR..H..e......p..P............P',
    'E....................H............P........ZZ..P',
    'E...............s....H.....d......P.....g......P',
    'E...t..........g.....H.i.......f..P..u.........P',
    'E.l.......o..........H....Z.......P............P',
    'E.................c..H.rr.......7.P.c.........ZP',
    'E....................H............P............P',
    'EEEECCCCC=CCCCCCCFFFFFFFFFFFFFFFMMMMMMMM-MMMMMMM',
    'Nc..C............F....T...T....F..............cM',
    'N...*............F..5........5.F...............M',
    'Nc5.C...g...RR...F.............F......6.\'......M',
    'CCCCC............F.......q.....F...............M',
    'C.............g..F.............F.........g.....M',
    'C........e.......F..g.......g..|...TTT......o..M',
    'C................|.............F...............M',
    'C..h..QQ....c....F.T...........F....g..........M',
    'C................F....T...T..i.F...............M',
    'CLLLL-LLLL.....i.F.c...........F...TTT.....MMMMM',
    'ALr......L.,..,..F......g......F...........M..1N',
    'AL.....c.L.......F.............F..h.....\'..M...N',
    'AL.,.....L.,.g,..F.........FFFFF...........*...N',
    'AL...^.,.L.....c.F.h.......F..+M.......u...M...N',
    'AL.......L.,.....F.........*...M..n.n......M...N',
    'ALLLLLLLLL....n..F......+..F6.7M...........Mn.nN',
    'AAAAAAAAACCCCCCCCFFFFFFFFFFFNNNMMMMMMMMMMMMMNNNN',
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
