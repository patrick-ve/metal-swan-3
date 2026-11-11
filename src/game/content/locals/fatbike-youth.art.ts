/**
 * `enemy/fatbike-youth…` look 0 — the hang youth on the gold fat-tyre e-bike (docs/design/amsterdam.md
 * §2): the baked 40 px set (docs/design/ams40.md wave 4; drawn offline by
 * tools/art40/chars/fatbike-youth/, `npm run art40 -- fatbike-youth`). Black cap, red hoodie, grey
 * trackpants, white sneakers; the speaker on the rear rack.
 *
 * - `enemy/fatbike-youth` (look 0, skin a) and its palette variants `enemy/fatbike-youth-0b` and
 *   `-0c` (skins b, c: the same pixels). The tumbling cap `enemy/fatbike-youth/cap` is the base
 *   set's only (the variants have no `cap`, as before: every capped look tumbles this one).
 * - One 1× picture at every art tier (plan rule 7): no dense art, no dense aliases.
 * - Strips: ride 12 (a 20-tick crank turn), idle 4, turn 3 (the U-turn: the bike swings towards
 *   the viewer), alert 1, tell 6 (the wheelie: anticipation, yank, rise, overshoot, the held
 *   balance), kick 6 (chamber, whip, the leg out from tick 3 = frame KICK_HIT, impact, snap back,
 *   the foot back on the pedal), gag 8, the deferred gloat 6 (36 ticks: one rock a thump) and
 *   cower 4, photo-pose 6, die 10, die-knife 11, die-blast 10, die-burn 7, die-crush 5, the
 *   deferred die-seat 12 and get-up 6, flee 12 (2 ticks a frame at 2 px/tick), bike 6 (the
 *   riderless wreck), cap 8. Every logic time the code reads is the old one.
 * - Looks 1–3 and the pairs are still drawn by rider.art.ts (wave 4 stage 2 replaces them).
 */
import { defineBakedSet } from '../../../engine/baked';
import { SET as YOUTH } from '../art40/fatbike-youth.gen';

/** The variant prefixes of look 0 (skins b and c: palette swaps of the base set). */
export const YOUTH0_VARIANTS = ['enemy/fatbike-youth-0b', 'enemy/fatbike-youth-0c'] as const;

/** Every id the look-0 set registers: all strips for skin a, all but `cap` for skins b and c. */
export const YOUTH0_IDS: readonly string[] = [
  ...Object.keys(YOUTH.strips).map((s) => `${YOUTH.prefix}/${s}`),
  ...YOUTH0_VARIANTS.flatMap((v) => Object.keys(YOUTH.strips).filter((s) => s !== 'cap').map((s) => `${v}/${s}`)),
];

defineBakedSet(YOUTH, { only: YOUTH0_IDS });
