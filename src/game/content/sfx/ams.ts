/**
 * Sounds of mission `ams`, THE FRYING DUTCHMAN (docs/design/amsterdam.md §2–§4, GDD §15.7):
 * bike bells, fatbike speakers, gulls, the enforcement officers' tickets and ROBO-HALSEMA.
 *
 * Telegraphs last their telegraph (GDD §4.11 rule 2; start them on the first tell tick):
 * - `ams/bell` — delivery rider TELL 20: two bike-bell dings, ringing to 0.36 s.
 * - `ams/bass-thump` — fatbike youth TELL 24: two sub thumps and a muffled speaker beat, 0.42 s.
 * - `ams/gull` — seagull TELL 20: a rising-falling "KAW!", 0.36 s.
 * - `ams/chain` — the mayor's CHAIN WHIP (telegraph 26): a metallic rattle that speeds up, 0.45 s.
 * - `ams/stamp` — the mayor's STAMP SLAM (telegraph 30): the arm creaks up for 0.5 s (30 ticks),
 *   then the heavy wooden slam lands exactly on tick 30 (one sound covers tell + hit).
 * Attacks / cues: `ams/kick` (the youth's kick: whoosh + thud), `ams/ticket` (a thrown `BOETE`
 * ticket: a paper flutter).
 */
import type { SfxLayer } from '../../../engine/synth';
import { BP, clack, fmBell, HP, hits, LP, noise, tone, type Recipes } from './kit';

/** One bike-bell ding: two bright FM partials a little apart (the classic "tring" shimmer). */
function ding(delay: number, vol: number): SfxLayer[] {
  return [
    ...fmBell(2350, 0.3, vol, { ratio: 2.76, index: 2.4, decay: 0.05, delay }),
    ...fmBell(2420, 0.24, vol * 0.6, { ratio: 3.1, index: 1.8, decay: 0.04, delay: delay + 0.002 }),
    // The striker's metallic tick.
    noise(0.012, vol * 0.5, BP(5200, undefined, 2), { delay }),
  ];
}

/** STAMP SLAM: the creak lasts the 30-tick telegraph, the slam lands at 0.5 s. */
const SLAM = 0.5;

export const AMS: Recipes = {
  // Delivery rider TELL 20: "tring tring!" — two dings, the second rings out to 0.36 s.
  'ams/bell': {
    vol: 0.31,
    voices: 2,
    gap: 0.2,
    layers: [...ding(0, 0.7), ...ding(0.13, 0.8)],
  },
  // Fatbike TELL 24: the phone speaker on the rack — two sub thumps (boom-boom) and a muffled
  // four-on-the-floor beat with a low-passed synth stab, 0.42 s.
  'ams/bass-thump': {
    vol: 0.37,
    voices: 2,
    gap: 0.25,
    layers: [
      tone('sine', 120, 45, 0.2, 0.9, { sweep: 0.06 }),
      tone('sine', 120, 45, 0.22, 0.9, { sweep: 0.06, delay: 0.2 }),
      noise(0.03, 0.25, LP(500), { delay: 0 }),
      noise(0.03, 0.25, LP(500), { delay: 0.2 }),
      // The muffled beat and stab between and after the thumps.
      ...hits(4, 0.05, 0.1).map((t) => noise(0.025, 0.18, BP(1800, undefined, 1.2), { delay: t })),
      { wave: 'saw', freq: 98, env: { a: 0.004, d: 0.06, s: 0.5, hold: 0.06, r: 0.04 }, vol: 0.3, delay: 0.1, filter: LP(420, undefined, 2) },
      { wave: 'saw', freq: 87.3, env: { a: 0.004, d: 0.06, s: 0.5, hold: 0.08, r: 0.06 }, vol: 0.3, delay: 0.3, filter: LP(420, undefined, 2) },
    ],
    drive: 0.8,
  },
  // Seagull TELL 20: "KAW!" — a nasal pulse that scoops up and falls, through two formants, 0.36 s.
  'ams/gull': {
    vol: 0.375,
    voices: 2,
    gap: 0.25,
    layers: [
      {
        wave: 'pulse',
        duty: 0.3,
        freq: 900,
        bend: [[0, -8], [0.08, 4], [0.32, -10]],
        env: { a: 0.01, d: 0.04, s: 0.85, hold: 0.24, r: 0.07 },
        vol: 0.55,
        vibrato: { rate: 22, depth: 0.5 },
        filter: BP(1700, undefined, 2.2),
        drive: 1.2,
      },
      {
        wave: 'saw',
        freq: 900,
        bend: [[0, -8], [0.08, 4], [0.32, -10]],
        env: { a: 0.01, d: 0.04, s: 0.8, hold: 0.24, r: 0.07 },
        vol: 0.35,
        filter: BP(3100, undefined, 3),
      },
      // A breathy edge on the scream.
      { wave: 'noise', env: { a: 0.02, d: 0.05, s: 0.6, hold: 0.18, r: 0.08 }, vol: 0.12, filter: BP(2600, undefined, 1.5) },
    ],
  },
  // The fatbike youth's kick (ATTACK 8): a whoosh of air, then a soft thud.
  'ams/kick': {
    vol: 1.25,
    voices: 3,
    gap: 0.08,
    layers: [
      { wave: 'noise', env: { a: 0.03, d: 0.1 }, vol: 0.8, filter: BP(900, 2600, 1.4) },
      tone('triangle', 130, 60, 0.1, 0.6, { delay: 0.1, sweep: 0.05 }),
      noise(0.04, 0.4, LP(800), { delay: 0.1 }),
    ],
  },
  // STAMP SLAM (telegraph 30): a wooden creak rising for 0.5 s, then a heavy wooden slam with a
  // low boom and a rubbery "thwap" on tick 30.
  'ams/stamp': {
    vol: 0.85,
    voices: 1,
    gap: 0.6,
    layers: [
      // The creak: a slow saw ratchet through a woody band, rising with the arm.
      {
        wave: 'saw',
        freq: 110,
        to: 190,
        sweep: SLAM,
        env: { a: 0.04, d: 0.02, s: 0.8, hold: SLAM - 0.08, r: 0.02 },
        vol: 0.55,
        filter: BP(700, 1100, 2.5),
        tremolo: { rate: 18, rateTo: 34, depth: 0.85, shape: 'saw', width: 0.4 },
      },
      // The slam.
      tone('sine', 95, 38, 0.38, 1, { delay: SLAM, sweep: 0.12 }),
      tone('triangle', 220, 90, 0.08, 0.6, { delay: SLAM }),
      noise(0.09, 0.8, LP(1400, 300), { delay: SLAM }),
      noise(0.03, 0.5, BP(900, undefined, 1.2), { delay: SLAM }),
      ...clack(420, 0.45, SLAM, 0.03),
    ],
    drive: 0.6,
  },
  // CHAIN WHIP (telegraph 26): the chain of office swung — metal links rattling faster, 0.45 s.
  'ams/chain': {
    vol: 0.83,
    voices: 1,
    gap: 0.35,
    layers: [
      ...hits(10, 0, 0.07, 1.08).flatMap((t, i) => [
        ...clack(2600 + (i % 3) * 420, 0.5 + (i % 2) * 0.15, t, 0.022),
        ...fmBell(3300 + (i % 4) * 260, 0.06, 0.12, { ratio: 1.41, index: 1.5, delay: t }),
      ]),
      // The swing's whoosh under the links.
      { wave: 'noise', env: { a: 0.12, d: 0.05, s: 0.7, hold: 0.26, r: 0.1 }, vol: 0.18, filter: BP(1200, 2800, 1.2) },
    ],
  },
  // A thrown BOETE ticket: a short paper flutter (fast-gated high noise).
  'ams/ticket': {
    vol: 0.67,
    voices: 3,
    gap: 0.1,
    layers: [
      {
        wave: 'noise',
        env: { a: 0.01, d: 0.03, s: 0.8, hold: 0.16, r: 0.06 },
        vol: 0.7,
        filter: HP(2200),
        tremolo: { rate: 26, rateTo: 18, depth: 1, shape: 'saw', width: 0.5 },
      },
      noise(0.02, 0.35, BP(3600, undefined, 2)),
    ],
  },
};
