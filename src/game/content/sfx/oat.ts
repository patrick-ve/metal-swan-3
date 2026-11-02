/**
 * Sound effects of mission `oat` (level 2, OAT OF CONTROL; docs/design/oat.md §9.1, §9.3): every
 * 'oat/…' synth recipe, registered at import (content manifest id 'sfx/oat', LAZY with the oat
 * chunk: content/index.ts `isOatContent`). Owner: AUDIO. The ElevenLabs takes of the sample group
 * 'mission:oat' (wave C; tools/audio/spec.ts) replace them when loaded; these stay the fallback, so
 * the mission plays fully without a generated file.
 *
 * This module holds the section ambience loops (ids.ts `OAT_AMBIENCE`) and the stings; the props,
 * traffic and bosses are in oat-day.ts (a, b, the shops) and oat-night.ts (c1, d, e). Builders take
 * their ids from `OAT_SFX`, never inline strings.
 *
 * - Ambience (loops; the runner plays them at 0.8, `setAmbience`; no gulls): `oat/env/morning` a
 *   quiet street at 09:30 (a far city hum, sparrows, a far bicycle bell); `oat/env/noon` the busy
 *   street (a crowd murmur, far traffic, a far tram bell); `oat/env/quay` the canal in the
 *   afternoon (water lapping on stone, a far work site's clank); `oat/env/chase` the canal at speed
 *   (wind and water); `oat/env/night` De Wallen at 22:30 (the muffled bass of a bar, a far crowd, a
 *   neon hum); `oat/env/taxi` the taxi's cabin (the road's rumble and the engine).
 * - Stings: `oat/env/carillon` the tower bell strikes three (03:00; §6.9); `oat/neon/off` the
 *   power-down (a relay, a falling hum, tubes ticking as they cool); `oat/receipt/print` (loop) the
 *   kassabon's thermal printer (§7.6); `oat/receipt/stamp` its OVERSCHOT / TEKORT stamp.
 *
 * Levels: every ambience loop sits at least 4 LU (momentary max) under the pistol and the enemy
 * shot at the gain the game plays it (tests/content/oat-audio.test.ts).
 */
import { defineSfx } from '../../../engine/synth';
import { BP, clack, fmBell, hits, HP, hz, loopRecipe, LP, noise, scatter, tone, type Recipes } from './kit';
import type { SfxLayer } from '../../../engine/synth';
import { OAT_DAY } from './oat-day';
import { OAT_NIGHT } from './oat-night';

const MORNING_LEN = 6;
const NOON_LEN = 6;
const QUAY_LEN = 6;
const CHASE_LEN = 4;
const NIGHT_LEN = 6;
const TAXI_LEN = 4;
const PRINT_LEN = 0.5;

/** A sparrow's chirp: two or three quick high sweeps (a synth bird; never a sampled animal). */
function chirp(delay: number, vol: number, up = true): SfxLayer[] {
  return [0, 0.07, 0.13].map((d, i) => tone('sine', up ? 3800 + i * 300 : 5200 - i * 300, up ? 5600 - i * 200 : 4200 - i * 200, 0.045, vol * (1 - i * 0.2), { delay: delay + d }));
}

/** Far, soft steps on cobbles (passers-by). */
function steps(n: number, len: number, seed: number, vol: number): SfxLayer[] {
  return scatter(n, seed).map((u, i) => noise(0.04, vol * (0.6 + (i % 3) * 0.2), BP(700 + (i % 4) * 90, undefined, 1.3), { delay: u * (len - 0.1) }));
}

/** Water lapping against stone: soft low slaps at fixed pseudo-random times. */
function laps(n: number, len: number, seed: number, vol: number): SfxLayer[] {
  return scatter(n, seed).map((u, i) => ({ wave: 'noise' as const, env: { a: 0.04, d: 0.28 }, vol: vol * (0.6 + (i % 3) * 0.2), delay: u * (len - 0.35), filter: BP(420 + (i % 4) * 60, undefined, 1.1) }));
}

/** The muffled bass of a bar through a wall: a kick on every beat (120 bpm: 12 in 6 s). */
function barBass(len: number, vol: number): SfxLayer[] {
  return hits(Math.round(len * 2), 0, 0.5).map((t, i) => tone('sine', 70, 48, 0.16, vol * (i % 2 === 0 ? 1 : 0.8), { delay: t }));
}

const STINGS: Recipes = {
  // --- Ambience (ids.ts OAT_AMBIENCE)
  'oat/env/morning': loopRecipe(
    MORNING_LEN,
    0.7,
    [
      // A far, soft city hum and a light breeze between the houses.
      { wave: 'noise', vol: 0.45, filter: LP(380), tremolo: { rate: 1 / MORNING_LEN, depth: 0.3 } },
      { wave: 'noise', vol: 0.08, filter: BP(1700, undefined, 1.5), tremolo: { rate: 2 / MORNING_LEN, depth: 0.6 } },
    ],
    [
      ...chirp(0.6, 0.05),
      ...chirp(2.3, 0.04, false),
      ...chirp(4.4, 0.045),
      // A far bicycle bell.
      ...hits(3, 3.3, 0.04).flatMap((t) => fmBell(hz('E6'), 0.25, 0.03, { delay: t, ratio: 2.76, index: 3, decay: 0.05 })),
      ...steps(6, MORNING_LEN, 17, 0.06),
    ],
  ),
  'oat/env/noon': loopRecipe(
    NOON_LEN,
    0.7,
    [
      // A crowd's murmur (a vowel band that wavers) over a far traffic bed.
      { wave: 'noise', vol: 0.35, filter: BP(600, undefined, 1.6), tremolo: { rate: 3 / NOON_LEN, depth: 0.35 } },
      { wave: 'noise', vol: 0.2, filter: BP(1100, undefined, 2.5), tremolo: { rate: 5 / NOON_LEN, depth: 0.5 } },
      { wave: 'noise', vol: 0.4, filter: LP(300), tremolo: { rate: 1 / NOON_LEN, depth: 0.25 } },
    ],
    [
      // A far tram bell, twice.
      ...fmBell(hz('C6'), 0.4, 0.04, { delay: 2.1, ratio: 2.76, index: 2 }),
      ...fmBell(hz('C6'), 0.4, 0.035, { delay: 2.4, ratio: 2.76, index: 2 }),
      ...steps(10, NOON_LEN, 23, 0.07),
      ...chirp(4.7, 0.03),
    ],
  ),
  'oat/env/quay': loopRecipe(
    QUAY_LEN,
    0.8,
    [
      { wave: 'noise', vol: 0.35, filter: LP(450), tremolo: { rate: 1 / QUAY_LEN, depth: 0.35 } },
      { wave: 'noise', vol: 0.06, filter: BP(1500, undefined, 2), tremolo: { rate: 2 / QUAY_LEN, depth: 0.6 } },
    ],
    [
      ...laps(9, QUAY_LEN, 61, 0.22),
      // A far work site: two metal clanks and a short generator drone.
      ...clack(520, 0.05, 1.4, 0.03),
      ...clack(560, 0.04, 3.9, 0.03),
      { wave: 'saw', freq: 75, env: { a: 0.3, d: 0.2, s: 0.8, hold: 1.0, r: 0.4 }, vol: 0.02, delay: 2.2, filter: LP(400) },
      ...chirp(5.2, 0.03, false),
    ],
  ),
  'oat/env/chase': loopRecipe(
    CHASE_LEN,
    0.24,
    [
      // Wind past the ears and water rushing (whole LFO cycles in 4 s).
      { wave: 'noise', vol: 0.5, filter: BP(700, undefined, 0.7), tremolo: { rate: 2 / CHASE_LEN, depth: 0.35 } },
      { wave: 'noise', vol: 0.25, filter: HP(2200), tremolo: { rate: 3 / CHASE_LEN, depth: 0.4 } },
      { wave: 'noise', vol: 0.35, filter: LP(180), tremolo: { rate: 1 / CHASE_LEN, depth: 0.3 } },
    ],
    laps(6, CHASE_LEN, 67, 0.12),
  ),
  'oat/env/night': loopRecipe(
    NIGHT_LEN,
    0.65,
    [
      // A far crowd (lower and thinner than noon) and the neon's 100 Hz hum (whole cycles in 6 s).
      { wave: 'noise', vol: 0.25, filter: BP(520, undefined, 1.8), tremolo: { rate: 2 / NIGHT_LEN, depth: 0.45 } },
      { wave: 'noise', vol: 0.3, filter: LP(260), tremolo: { rate: 1 / NIGHT_LEN, depth: 0.3 } },
      { wave: 'sine', freq: 100, vol: 0.025 },
    ],
    [...barBass(NIGHT_LEN, 0.12), ...steps(5, NIGHT_LEN, 71, 0.05), ...laps(3, NIGHT_LEN, 73, 0.08)],
  ),
  'oat/env/taxi': loopRecipe(TAXI_LEN, 0.55, [
    // The road's rumble under the cabin, the engine at cruise (40 Hz: whole cycles in 4 s), tyre hiss.
    { wave: 'noise', vol: 0.55, filter: LP(220), tremolo: { rate: 3 / TAXI_LEN, depth: 0.2 } },
    { wave: 'saw', freq: 40, vol: 0.18, filter: LP(350, undefined, 1.2), tremolo: { rate: 8 / TAXI_LEN, depth: 0.15 } },
    { wave: 'noise', vol: 0.12, filter: BP(2500, undefined, 0.9), tremolo: { rate: 2 / TAXI_LEN, depth: 0.3 } },
  ]),

  // --- Stings
  'oat/env/carillon': {
    vol: 0.7,
    voices: 1,
    gap: 3,
    length: 4.2,
    // The tower's hour bell strikes three (a big, slow FM bell with a hum a tenth below).
    layers: hits(3, 0, 1.25).flatMap((t) => [
      noise(0.04, 0.25, BP(1900, undefined, 1.2), { delay: t }),
      ...fmBell(hz('G3'), 2.2, 0.5, { delay: t, ratio: 1.41, index: 4, decay: 0.6, octave: 0.25 }),
      { wave: 'sine' as const, freq: hz('Eb2'), env: { a: 0.01, d: 2.2 }, vol: 0.22, delay: t },
    ]),
  },
  'oat/neon/off': {
    vol: 0.7,
    voices: 1,
    gap: 2,
    length: 1.5,
    layers: [
      // The main relay clunks, the hum drops away, the cooling tubes tick.
      tone('sine', 120, 60, 0.12, 0.7),
      ...clack(500, 0.5, 0, 0.04),
      { wave: 'square', freq: 100, to: 30, sweep: 0.9, env: { a: 0.002, d: 0.9 }, vol: 0.3, filter: BP(1400, 200, 1.2) },
      { wave: 'sine', freq: 200, to: 40, sweep: 1, env: { a: 0.002, d: 1 }, vol: 0.2 },
      ...hits(4, 0.6, 0.18).map((t, i) => tone('sine', 4200 - i * 300, 4100 - i * 300, 0.03, 0.12, { delay: t })),
    ],
  },
  'oat/receipt/print': loopRecipe(PRINT_LEN, 0.4, [
    // A thermal printer: a fast stepper buzz (200 Hz and a 16 Hz line feed: whole cycles in 0.5 s).
    { wave: 'square', freq: 200, vol: 0.2, filter: BP(2600, undefined, 2), tremolo: { rate: 16, depth: 0.6 } },
    { wave: 'noise', vol: 0.15, filter: BP(4500, undefined, 1.5), tremolo: { rate: 16, depth: 0.5 } },
  ]),
  'oat/receipt/stamp': {
    vol: 0.75,
    voices: 1,
    gap: 0.4,
    layers: [tone('sine', 130, 55, 0.18, 0.9), noise(0.08, 0.5, LP(900)), ...clack(600, 0.3, 0, 0.03), noise(0.05, 0.2, HP(2500), { delay: 0.01 })],
  },
};

/** Every 'oat/…' recipe of this module and its two parts, by id. */
const RECIPES: Recipes = { ...STINGS, ...OAT_DAY, ...OAT_NIGHT };

/** Every 'oat/…' sfx id AUDIO registers (the audio spec and the tests list them). */
export const OAT_SFX_IDS: readonly string[] = Object.keys(RECIPES);

/**
 * The oat sound ids for the builders (waves B and C): play them with `ctx.sfx(OAT_SFX.binBurst)` /
 * `audio.sfxLoop(key, OAT_SFX.neonBuzz)`. The ambience ids are ids.ts `OAT_AMBIENCE`.
 */
export const OAT_SFX = {
  // Statiegeld bins (PIECES)
  binHit: 'oat/bin/hit',
  binBurst: 'oat/bin/burst',
  can: 'oat/bin/can',
  bottle: 'oat/bin/bottle',
  deposit: 'oat/bin/deposit',
  // DE HAVERBAR, de conceptstore (PIECES)
  pay: 'oat/shop/pay',
  refuse: 'oat/shop/refuse',
  steam: 'oat/shop/steam',
  inflation: 'oat/shop/inflation',
  shopBell: 'oat/shop/bell',
  glass: 'oat/conceptstore/glass',
  // The enemies (CAST-DAY, CAST-NIGHT)
  brammobielMotor: 'oat/brammobiel/motor',
  brammobielHorn: 'oat/brammobiel/horn',
  ringLight: 'oat/influencer/ring-light',
  bakfietsBell: 'oat/bakfiets/bell',
  lakschade: 'oat/bakfiets/lakschade',
  bakfietsThump: 'oat/bakfiets/thump',
  taxiMeter: 'oat/taxi/meter',
  taxiHorn: 'oat/taxi/horn',
  taxiDoor: 'oat/taxi/door',
  taxiRev: 'oat/taxi/rev',
  taxiSkid: 'oat/taxi/skid',
  dealerSwipe: 'oat/dealer/swipe',
  // The set pieces (PIECES, QUEUE-B, KADE, NIGHT)
  envelopeRip: 'oat/envelope/rip',
  refund: 'oat/envelope/refund',
  aanslag: 'oat/envelope/aanslag',
  hoistRope: 'oat/hoist/rope',
  piano: 'oat/hoist/piano',
  sofa: 'oat/hoist/sofa',
  organWaltz: 'oat/organ/waltz',
  organStop: 'oat/organ/stop',
  queueStep: 'oat/queue/step',
  queueNumber: 'oat/queue/number',
  queuePush: 'oat/queue/push',
  kadeCrack: 'oat/kade/crack',
  kadeRumble: 'oat/kade/rumble',
  kadeSplash: 'oat/kade/splash',
  sinkhole: 'oat/kade/sinkhole',
  swanWake: 'oat/swan/wake',
  craneBeep: 'oat/crane/beep',
  craneSwing: 'oat/crane/swing',
  neonBuzz: 'oat/neon/buzz',
  neonFlicker: 'oat/neon/flicker',
  neonOff: 'oat/neon/off',
  shutter: 'oat/shutter/down',
  carillon: 'oat/env/carillon',
  // The bosses (MAKELAAR, HUISJESMELKER)
  paddle: 'oat/makelaar/paddle',
  signHit: 'oat/makelaar/sign',
  doorbell: 'oat/makelaar/doorbell',
  viewersRush: 'oat/makelaar/rush',
  courtage: 'oat/makelaar/courtage',
  keysTell: 'oat/huisjesmelker/keys-tell',
  keysLow: 'oat/huisjesmelker/keys-low',
  keysHigh: 'oat/huisjesmelker/keys-high',
  mould: 'oat/huisjesmelker/mould',
  rentBoard: 'oat/huisjesmelker/rent-board',
  microwave: 'oat/huisjesmelker/microwave',
  // The taxi ride (TAXIRIT)
  tunnel: 'oat/taxi/tunnel',
  scooterBuzz: 'oat/scooter/buzz',
  scooterTicket: 'oat/scooter/ticket',
  // The kassabon (BUDGET)
  receiptPrint: 'oat/receipt/print',
  receiptStamp: 'oat/receipt/stamp',
} as const;

for (const [id, recipe] of Object.entries(RECIPES)) defineSfx(id, recipe);
