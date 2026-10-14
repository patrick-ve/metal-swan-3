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
 *
 * Added 2026-10-14 with the sampled audio (docs/ARCHITECTURE.md, audio exception for ams): these
 * are the quiet synth fallbacks of the new ids; the ElevenLabs takes replace them when loaded.
 * - Deaths: `ams/rider-crash` (a bike skids into the street), `ams/handhaver-down` (the officer
 *   topples, his tickets flutter).
 * - Life: `ams/duck` (a quack when a player comes near), `ams/pigeon` (the flock takes off),
 *   `env/ams-carillon` (a church carillon now and then, sections a–c).
 * - The boss: `ams/mayor-intro` (ROBO-HALSEMA's doors open and she steps out).
 * - Loops (`sfxLoop`): `env/ams-canal` and `env/ams-street` (the section ambience under the key
 *   'ambience'), `ams/tour-boat` (a tour boat's diesel while it is in view), `ams/mayor-babble`
 *   (ROBO-HALSEMA's wordless robot chatter while a bubble of hers is up: a placeholder, she has no
 *   voice — docs/ORIGINALITY.md).
 */
import type { SfxLayer } from '../../../engine/synth';
import { BP, clack, fmBell, HP, hits, hz, LP, loopRecipe, noise, scatter, seq, tone, type Recipes } from './kit';

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

/** Loop lengths (s): the LFO rates below make whole cycles in them. */
const CANAL_LEN = 2.4;
const STREET_LEN = 2.8;
const BOAT_LEN = 1.0;
const BABBLE_LEN = 1.6;

/** A soft water lap: a low sine "plop" and a short low-passed slosh. */
function lap(delay: number, f: number, vol: number): SfxLayer[] {
  return [
    { wave: 'sine', freq: f, to: f * 0.65, sweep: 0.09, env: { a: 0.01, d: 0.14 }, vol, delay },
    { wave: 'noise', env: { a: 0.02, d: 0.12 }, vol: vol * 0.7, delay, filter: LP(700, 300) },
  ];
}

/** The carillon tune (a falling and rising phrase over 2.2 s; Ab major, like a far church tower). */
const CARILLON: readonly (readonly [number, number])[] = [
  [hz('Eb5'), 0.22],
  [hz('C5'), 0.22],
  [hz('Db5'), 0.22],
  [hz('Ab4'), 0.44],
  [hz('Ab4'), 0.22],
  [hz('Db5'), 0.22],
  [hz('Eb5'), 0.22],
  [hz('C5'), 0.6],
];

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

  // ---- added 2026-10-14 (synth fallbacks of the sampled ams sounds) ----
  // A delivery rider's or a fatbike's crash: the bike clatters over the cobbles (metal clacks),
  // a bent bell "dunk" and a body thud, 0.55 s.
  'ams/rider-crash': {
    vol: 0.62,
    voices: 3,
    gap: 0.08,
    layers: [
      tone('sine', 110, 50, 0.16, 0.8),
      noise(0.08, 0.7, LP(1200, 300)),
      ...hits(5, 0.02, 0.07, 0.9).flatMap((t, i) => clack(1500 + (i % 3) * 380, 0.5 - i * 0.06, t, 0.025)),
      ...fmBell(1900, 0.3, 0.18, { ratio: 2.2, index: 2, delay: 0.06 }),
      noise(0.18, 0.25, BP(2400, 900, 1.2), { delay: 0.3 }),
    ],
  },
  // A handhaver goes down: a falling "whee-oo" whistle, a thud and his ticket book fluttering, 0.6 s.
  'ams/handhaver-down': {
    vol: 0.6,
    voices: 2,
    gap: 0.12,
    layers: [
      { wave: 'triangle', freq: 1100, to: 380, sweep: 0.32, env: { a: 0.01, d: 0.02, s: 0.8, hold: 0.24, r: 0.06 }, vol: 0.4, vibrato: { rate: 9, depth: 0.4 } },
      tone('sine', 120, 55, 0.14, 0.9, { delay: 0.32 }),
      noise(0.06, 0.6, LP(900), { delay: 0.32 }),
      { wave: 'noise', env: { a: 0.01, d: 0.03, s: 0.7, hold: 0.12, r: 0.06 }, vol: 0.3, delay: 0.36, filter: HP(2400), tremolo: { rate: 24, depth: 1, shape: 'saw', width: 0.5 } },
    ],
  },
  // Ducks on the canal: one nasal "quack" (a pulse scooping down through a duck formant), 0.2 s.
  'ams/duck': {
    vol: 0.5,
    voices: 2,
    gap: 0.25,
    jitter: 0.05,
    layers: [
      { wave: 'pulse', duty: 0.2, freq: 520, bend: [[0, 2], [0.05, 0], [0.18, -5]], env: { a: 0.006, d: 0.03, s: 0.8, hold: 0.11, r: 0.05 }, vol: 0.6, filter: BP(1100, undefined, 2.5) },
      { wave: 'saw', freq: 520, bend: [[0, 2], [0.05, 0], [0.18, -5]], env: { a: 0.006, d: 0.03, s: 0.7, hold: 0.11, r: 0.05 }, vol: 0.3, filter: BP(2300, undefined, 3) },
      { wave: 'noise', env: { a: 0.004, d: 0.04 }, vol: 0.15, filter: BP(1600, undefined, 1.5) },
    ],
  },
  // The pigeon flock takes off: a burst of wing claps (fast-gated noise) over a startled coo, 0.45 s.
  'ams/pigeon': {
    vol: 0.9,
    voices: 2,
    gap: 0.3,
    layers: [
      { wave: 'noise', env: { a: 0.01, d: 0.05, s: 0.8, hold: 0.24, r: 0.12 }, vol: 0.6, filter: BP(1300, 900, 1.1), tremolo: { rate: 17, rateTo: 12, depth: 1, shape: 'saw', width: 0.35 } },
      { wave: 'noise', env: { a: 0.02, d: 0.05, s: 0.6, hold: 0.2, r: 0.1 }, vol: 0.25, delay: 0.05, filter: BP(2600, undefined, 2), tremolo: { rate: 21, depth: 1, shape: 'saw', width: 0.3 } },
      { wave: 'sine', freq: 380, bend: [[0, 3], [0.1, 0]], env: { a: 0.02, d: 0.04, s: 0.6, hold: 0.08, r: 0.06 }, vol: 0.3, vibrato: { rate: 14, depth: 0.6 }, filter: LP(1200) },
    ],
  },
  // A church carillon far off over the canals (now and then in sections a–c): eight bell notes, 2.4 s.
  'env/ams-carillon': {
    vol: 0.25,
    voices: 1,
    gap: 2,
    layers: seq(CARILLON, (f, _len, delay) => fmBell(f, 0.7, 0.5, { ratio: 2, index: 2.2, decay: 0.12, delay, octave: 0.25 })),
    filter: LP(3200),
  },
  // ROBO-HALSEMA steps out of the Stopera doors: a pneumatic door hiss, a heavy latch clank and a
  // servo whirr that rises with her first step, 1.0 s.
  'ams/mayor-intro': {
    vol: 0.66,
    voices: 1,
    gap: 1,
    layers: [
      ...clack(420, 0.7, 0, 0.04),
      tone('sine', 80, 45, 0.25, 0.7),
      { wave: 'noise', env: { a: 0.02, d: 0.1, s: 0.6, hold: 0.3, r: 0.2 }, vol: 0.4, delay: 0.04, filter: HP(1800, 3600) },
      { wave: 'saw', freq: 180, to: 420, sweep: 0.5, env: { a: 0.05, d: 0.05, s: 0.8, hold: 0.4, r: 0.1 }, vol: 0.3, delay: 0.35, filter: BP(900, 1600, 2) },
      { wave: 'square', freq: 90, to: 140, sweep: 0.5, env: { a: 0.05, d: 0.05, s: 0.7, hold: 0.4, r: 0.1 }, vol: 0.15, delay: 0.35, filter: LP(500) },
    ],
  },
  // Canal ambience (loop, 2.4 s; the sections on the water): water lapping at the quay walls and
  // a soft low wash. The tremolo rates make whole cycles in the loop.
  'env/ams-canal': loopRecipe(
    CANAL_LEN,
    0.8,
    [
      { wave: 'noise', vol: 0.5, filter: LP(420), tremolo: { rate: 3 / CANAL_LEN, depth: 0.35 } },
      { wave: 'noise', vol: 0.1, filter: BP(1300, undefined, 2), tremolo: { rate: 5 / CANAL_LEN, depth: 0.7 } },
    ],
    scatter(4, 0xca7a1).flatMap((r, i) => lap(0.15 + i * 0.5 + r * 0.15, 150 + r * 90, 0.35)),
  ),
  // Street ambience (loop, 2.8 s; the streets and squares): a far crowd murmur, the city's low
  // rumble and one far bike bell.
  'env/ams-street': loopRecipe(
    STREET_LEN,
    1.3,
    [
      { wave: 'noise', vol: 0.4, filter: BP(650, undefined, 1.4), tremolo: { rate: 7 / STREET_LEN, depth: 0.4 } },
      { wave: 'noise', vol: 0.18, filter: BP(1400, undefined, 2.5), tremolo: { rate: 11 / STREET_LEN, depth: 0.6 } },
      { wave: 'noise', vol: 0.35, filter: LP(180) },
    ],
    [...fmBell(2350, 0.25, 0.05, { ratio: 2.76, index: 2, delay: 1.2 }), ...fmBell(2350, 0.25, 0.05, { ratio: 2.76, index: 2, delay: 1.33 })],
  ),
  // A canal tour boat's diesel (loop, 1 s, while it is in view): eight putter thumps over a low
  // drone and a little wash. The thumps sit between the seam's ends, so the loop wraps level.
  'ams/tour-boat': loopRecipe(
    BOAT_LEN,
    0.5,
    [
      { wave: 'noise', vol: 0.25, filter: LP(380) },
      { wave: 'pulse', duty: 0.2, freq: 50, vol: 0.15, filter: LP(260) },
      { wave: 'noise', vol: 0.12, filter: BP(900, undefined, 1.5), tremolo: { rate: 2, depth: 0.3 } },
    ],
    hits(8, 0.03, BOAT_LEN / 8).flatMap((t) => [noise(0.07, 0.6, LP(380), { delay: t }), tone('sine', 70, 50, 0.06, 0.4, { delay: t })]),
  ),
  // ROBO-HALSEMA's robot chatter (loop, 1.6 s, while one of her bubbles is up): square blips that
  // jump around like syllables over a faint servo hum. No words; a placeholder for a voice.
  'ams/mayor-babble': loopRecipe(
    BABBLE_LEN,
    0.6,
    [{ wave: 'saw', freq: 110, vol: 0.05, filter: LP(500), tremolo: { rate: 5 / BABBLE_LEN, depth: 0.5 } }],
    scatter(14, 0xba6b1e).map((r, i) => {
      const f = 420 + r * 520;
      return tone('square', f, f * (r < 0.5 ? 1.25 : 0.8), 0.07, 0.3, { delay: 0.04 + i * 0.105, filter: LP(2600) });
    }),
  ),
};
