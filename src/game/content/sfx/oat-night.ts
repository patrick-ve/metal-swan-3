/**
 * Sound effects of mission `oat`, the afternoon and the night (docs/design/oat.md §9.1; sections
 * oat-c1, oat-d and oat-e): the synth recipes AUDIO owns for the crumbling quay, the chase, the
 * Wallen, De Huisjesmelker and the taxi ride. Registered by content/sfx/oat.ts (manifest id
 * 'sfx/oat'); the ElevenLabs takes of 'mission:oat' (wave C) replace them when loaded.
 *
 * - The quay (§6.10): `oat/kade/crack` the paving cracks (the sinkhole's tell); `oat/kade/rumble`
 *   the wall gives way behind the Swan; `oat/kade/splash` bricks drop into the canal;
 *   `oat/kade/sinkhole` the ground opens, the scan car slides in, a big splash and a gurgle.
 * - The chase (§2.4): `oat/swan/wake` (loop) the water rushing past the Swan's hull;
 *   `oat/crane/beep` the work boat's warning beeps (the tell of the swinging pipe, 30 ticks);
 *   `oat/crane/swing` the chain clank and the pipe's whoosh.
 * - De Wallen (§2.5, §6.9): `oat/neon/buzz` (loop) a neon tube's hum; `oat/neon/flicker` a tube
 *   that stutters; `oat/shutter/down` a roller shutter rattles down (DE BARS SLUITEN);
 *   `oat/dealer/swipe` the pickpocket's quick hand and a jingle of coins.
 * - De Huisjesmelker (§5): `oat/huisjesmelker/keys-tell` the key ring shaken up (the tell);
 *   `oat/huisjesmelker/keys-low` the LOW flail: a heavy, dull jangle; `oat/huisjesmelker/keys-high`
 *   the HIGH flail: a bright, thin jangle (the two are clearly different in pitch and weight);
 *   `oat/huisjesmelker/mould` the mould spray hiss; `oat/huisjesmelker/rent-board` the rent board's
 *   split-flap clatter and a till bell (HUURVERHOGING); `oat/huisjesmelker/microwave` the €1.900
 *   studio's microwave: a hum, then the DING.
 * - The taxi ride (§6.11): `oat/taxi/tunnel` the whoosh into the IJtunnel; `oat/scooter/buzz` (loop)
 *   a handhaver's e-scooter; `oat/scooter/ticket` a ticket flicked from a scooter.
 *
 * Loops follow sfx/kit.ts `loopRecipe` (flat envelopes, whole cycles in the loop).
 */
import { BP, clack, fmBell, hits, HP, hz, loopRecipe, LP, noise, note, scatter, tone, type Recipes } from './kit';
import type { SfxLayer } from '../../../engine/synth';

/** A ring of keys jangling: `n` metal ticks around `freq` over `span` seconds. */
function jangle(n: number, freq: number, span: number, seed: number, vol: number, t0 = 0): SfxLayer[] {
  const t = scatter(n, seed);
  const f = scatter(n, seed + 5);
  return t.flatMap((u, i) => [
    tone('sine', freq * (1 + f[i] * 0.6), freq * (0.98 + f[i] * 0.6), 0.05 + f[i] * 0.04, vol * (1 - u * 0.4), { delay: t0 + u * span }),
    noise(0.012, vol * 0.5, BP(freq * 2.2, undefined, 1.6), { delay: t0 + u * span }),
  ]);
}

/** Water droplets and glugs after a splash. */
function glugs(n: number, t0: number, span: number, seed: number, vol: number): SfxLayer[] {
  return scatter(n, seed).map((u, i) => tone('sine', 380 + (i % 4) * 110, 700 + (i % 4) * 160, 0.07, vol * (1 - u * 0.6), { delay: t0 + u * span }));
}

export const OAT_NIGHT: Recipes = {
  // --- The quay (§6.10)
  'oat/kade/crack': {
    vol: 0.7,
    voices: 1,
    gap: 0.4,
    layers: [...hits(5, 0, 0.06, 1.15).flatMap((t, i) => [noise(0.03, 0.5 - i * 0.05, BP(1800 - i * 150, undefined, 1.3), { delay: t }), ...clack(600 - i * 40, 0.25, t, 0.02)]), tone('sine', 90, 50, 0.3, 0.5, { delay: 0.05 })],
  },
  'oat/kade/rumble': {
    vol: 0.75,
    voices: 1,
    gap: 1,
    length: 1.7,
    layers: [
      { wave: 'noise', env: { a: 0.15, d: 1.4 }, vol: 0.9, filter: LP(260, 120), tremolo: { rate: 9, depth: 0.5 } },
      tone('sine', 55, 36, 1.5, 0.6, { env: { a: 0.1, d: 1.4 } }),
      // Stones knock together in the fall.
      ...hits(6, 0.15, 0.17).flatMap((t) => clack(420, 0.25, t, 0.03)),
    ],
  },
  'oat/kade/splash': {
    vol: 0.65,
    voices: 3,
    gap: 0.08,
    jitter: 0.08,
    layers: [tone('sine', 160, 70, 0.08, 0.6), noise(0.3, 0.6, BP(1200, 500, 0.9)), ...glugs(4, 0.1, 0.3, 13, 0.18)],
  },
  'oat/kade/sinkhole': {
    vol: 0.75,
    voices: 1,
    gap: 1.5,
    length: 2,
    layers: [
      // The ground gives: a crunch and a groan of metal as the car tilts.
      noise(0.25, 0.7, LP(1500)),
      tone('sine', 70, 35, 0.6, 0.7),
      { wave: 'saw', freq: 110, bend: [[0, 0], [0.5, -5]], env: { a: 0.05, d: 0.1, s: 0.7, hold: 0.4, r: 0.1 }, vol: 0.25, filter: BP(600, undefined, 3), tremolo: { rate: 12, depth: 0.5 } },
      // The splash, then the gurgle as it settles.
      noise(0.6, 0.7, BP(1000, 400, 0.8), { delay: 0.6 }),
      tone('sine', 120, 45, 0.4, 0.6, { delay: 0.6 }),
      ...glugs(10, 0.9, 0.9, 29, 0.2),
    ],
  },

  // --- The chase (§2.4)
  'oat/swan/wake': loopRecipe(2, 0.45, [
    // Water rushing past the hull: two band-passed noise beds that swell (whole LFO cycles in 2 s).
    { wave: 'noise', vol: 0.6, filter: BP(900, undefined, 0.7), tremolo: { rate: 2, depth: 0.35 } },
    { wave: 'noise', vol: 0.3, filter: HP(2500), tremolo: { rate: 3, depth: 0.5 } },
    { wave: 'noise', vol: 0.35, filter: LP(250), tremolo: { rate: 1, depth: 0.3 } },
  ]),
  'oat/crane/beep': {
    vol: 0.5,
    voices: 1,
    gap: 0.5,
    // Three reversing-alarm beeps inside the 30-tick tell.
    layers: hits(3, 0, 0.17).map((t) => note('square', 1250, 0.09, 0.4, t, { filter: LP(4000) })),
  },
  'oat/crane/swing': {
    vol: 0.65,
    voices: 1,
    gap: 0.4,
    layers: [...hits(4, 0, 0.05).flatMap((t) => clack(1100, 0.3, t, 0.02)), noise(0.5, 0.5, BP(400, 1400, 1.1), { delay: 0.1, env: { a: 0.2, d: 0.35 } })],
  },

  // --- De Wallen (§2.5, §6.9)
  'oat/neon/buzz': loopRecipe(1, 0.25, [
    // Mains hum and the tube's buzz (100 Hz and its harmonics: whole cycles in 1 s).
    { wave: 'sine', freq: 100, vol: 0.3 },
    { wave: 'square', freq: 100, vol: 0.12, filter: BP(1800, undefined, 2), tremolo: { rate: 4, depth: 0.3 } },
    { wave: 'noise', vol: 0.05, filter: BP(6000, undefined, 2) },
  ]),
  'oat/neon/flicker': {
    vol: 0.6,
    voices: 2,
    gap: 0.15,
    layers: [0, 0.09, 0.22].flatMap((d, i) => [{ wave: 'square' as const, freq: 100, env: { a: 0.002, d: 0.05 + i * 0.02 }, vol: 0.35, delay: d, filter: BP(1500, undefined, 1.5) }, ...clack(2800, 0.2, d)]),
  },
  'oat/shutter/down': {
    vol: 0.6,
    voices: 2,
    gap: 0.5,
    length: 1.2,
    layers: [
      // The slats rattle down the rails, faster at the end, then the bottom bar lands.
      ...hits(14, 0, 0.08, 1.04).flatMap((t, i) => [noise(0.04, 0.3, BP(1400 + (i % 3) * 200, undefined, 1.4), { delay: t }), ...clack(700, 0.12, t, 0.02)]),
      tone('sine', 110, 60, 0.15, 0.6, { delay: 0.95 }),
      noise(0.1, 0.5, BP(900, undefined, 1.2), { delay: 0.95 }),
    ],
  },
  'oat/dealer/swipe': {
    vol: 0.9,
    voices: 2,
    gap: 0.2,
    layers: [noise(0.1, 0.5, BP(1500, 3500, 1)), ...jangle(5, 3200, 0.15, 3, 0.18, 0.08)],
  },

  // --- De Huisjesmelker (§5)
  'oat/huisjesmelker/keys-tell': {
    vol: 0.55,
    voices: 1,
    gap: 0.3,
    layers: [...jangle(10, 2200, 0.32, 41, 0.22), ...jangle(6, 1500, 0.3, 43, 0.15)],
  },
  'oat/huisjesmelker/keys-low': {
    vol: 0.75,
    voices: 1,
    gap: 0.2,
    layers: [
      // A heavy swing low: a deep whoosh, then a dull iron jangle (big old keys).
      noise(0.22, 0.45, BP(300, 700, 1.1)),
      ...jangle(9, 700, 0.25, 51, 0.3, 0.16),
      tone('sine', 140, 90, 0.15, 0.4, { delay: 0.18 }),
    ],
  },
  'oat/huisjesmelker/keys-high': {
    vol: 0.6,
    voices: 1,
    gap: 0.2,
    layers: [
      // A quick swing high: a thin whistle and a bright, light jingle.
      noise(0.14, 0.35, BP(2200, 4500, 1.4)),
      ...jangle(9, 4200, 0.2, 53, 0.22, 0.1),
    ],
  },
  'oat/huisjesmelker/mould': {
    vol: 0.6,
    voices: 1,
    gap: 0.4,
    layers: [
      // An aerosol spray: a valve click and a wet, hissing burst.
      ...clack(2400, 0.3, 0),
      { wave: 'noise', env: { a: 0.02, d: 0.1, s: 0.75, hold: 0.55, r: 0.2 }, vol: 0.6, filter: BP(5000, 3500, 0.8), tremolo: { rate: 21, depth: 0.15 } },
      { wave: 'noise', env: { a: 0.05, d: 0.1, s: 0.5, hold: 0.5, r: 0.2 }, vol: 0.2, filter: LP(700) },
    ],
  },
  'oat/huisjesmelker/rent-board': {
    vol: 0.6,
    voices: 1,
    gap: 0.6,
    layers: [
      // The split-flap digits clatter, then a till's bell rings the new rent.
      ...hits(12, 0, 0.035).flatMap((t, i) => clack(1900 + (i % 3) * 300, 0.3, t, 0.012)),
      ...clack(700, 0.35, 0.45, 0.03),
      ...fmBell(hz('E6'), 0.4, 0.3, { delay: 0.47, ratio: 2.76, index: 3 }),
    ],
  },
  'oat/huisjesmelker/microwave': {
    vol: 0.6,
    voices: 1,
    gap: 1,
    length: 1.3,
    layers: [
      { wave: 'sine', freq: 120, env: { a: 0.02, s: 1, hold: 0.7, r: 0.02 }, vol: 0.25 },
      { wave: 'square', freq: 240, env: { a: 0.02, s: 1, hold: 0.7, r: 0.02 }, vol: 0.06, filter: LP(900) },
      ...clack(1500, 0.3, 0.74),
      // The DING.
      ...fmBell(hz('A6'), 0.55, 0.4, { delay: 0.78, ratio: 4, index: 1.2 }),
    ],
  },

  // --- The taxi ride (§6.11)
  'oat/taxi/tunnel': {
    vol: 0.6,
    voices: 1,
    gap: 1,
    length: 1.6,
    layers: [
      { wave: 'noise', env: { a: 0.3, d: 1.2 }, vol: 0.7, filter: BP(500, 2000, 0.7) },
      { wave: 'noise', env: { a: 0.4, d: 1.0 }, vol: 0.3, filter: LP(200) },
    ],
  },
  'oat/scooter/buzz': loopRecipe(1, 0.3, [
    // An e-scooter's motor whine (whole cycles in 1 s) with a little wobble.
    { wave: 'sine', freq: 880, vol: 0.25, vibrato: { rate: 4, depth: 0.15 } },
    { wave: 'saw', freq: 440, vol: 0.08, filter: BP(1800, undefined, 3) },
    { wave: 'noise', vol: 0.12, filter: BP(1200, undefined, 1), tremolo: { rate: 8, depth: 0.5 } },
  ]),
  'oat/scooter/ticket': {
    vol: 0.55,
    voices: 3,
    gap: 0.08,
    jitter: 0.08,
    layers: [{ wave: 'noise', env: { a: 0.003, d: 0.12 }, vol: 0.6, filter: BP(3000, 1500, 1.4), tremolo: { rate: 45, depth: 0.6 } }, noise(0.02, 0.3, HP(4000), { delay: 0.12 })],
  },
};
