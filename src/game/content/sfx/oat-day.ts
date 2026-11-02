/**
 * Sound effects of mission `oat`, the day (docs/design/oat.md §9.1; sections oat-a and oat-b, the
 * shops of c): the synth recipes AUDIO owns for the props, the traffic and De Makelaar. Registered by
 * content/sfx/oat.ts (manifest id 'sfx/oat'); the ElevenLabs takes of the sample group 'mission:oat'
 * (wave C) replace them when loaded, and these stay the fallback. Ids: `OAT_SFX` in oat.ts.
 *
 * - Statiegeld bins (§6.1): `oat/bin/hit` a hollow plastic thunk; `oat/bin/burst` the lid flies,
 *   the bin cracks, cans and bottles clatter out; `oat/bin/can` an aluminium can bouncing on
 *   clinkers; `oat/bin/bottle` a plastic bottle's hollow bounce; `oat/bin/deposit` the pickup
 *   (+€ 0,15): a deposit machine's bleep and a coin.
 * - DE HAVERBAR (§6.2): `oat/shop/pay` the pin terminal's two rising beeps; `oat/shop/refuse`
 *   GEWEIGERD, two low buzzer beeps; `oat/shop/steam` the milk frother; `oat/shop/inflation` a
 *   price-tag ratchet that climbs; `oat/shop/bell` the shop door's bell on its spring.
 * - `oat/conceptstore/glass` (§6.6): the glass case shatters.
 * - The brommobiel influencer (§3): `oat/brammobiel/motor` (loop) the tiny two-stroke buzz;
 *   `oat/brammobiel/horn` a thin beep-beep; `oat/influencer/ring-light` the ring light's flash.
 * - The bakfiets-ouder (§3): `oat/bakfiets/bell` ring-ring; `oat/bakfiets/lakschade` a paint
 *   scrape (LAKSCHADE!); `oat/bakfiets/thump` a shot on the wooden box.
 * - The taxi (§3): `oat/taxi/meter` the meter's tick; `oat/taxi/horn` a long angry blast;
 *   `oat/taxi/door` the door swung open (the tell of the door swing); `oat/taxi/rev` the engine
 *   revving (the tell of the ram); `oat/taxi/skid` a tyre squeal.
 * - The blauwe envelop (§6.3): `oat/envelope/rip`; `oat/envelope/refund` (TERUGGAAF) a till's
 *   ring and a happy arpeggio; `oat/envelope/aanslag` (AANSLAG) a stamp and a sad slide.
 * - The hijsbalk (§6.4): `oat/hoist/rope` creak and snap; `oat/hoist/piano` a piano landing (a
 *   wooden crash and a ringing cluster of strings); `oat/hoist/sofa` a soft heavy thump with springs.
 * - Het draaiorgel (§6.5): `oat/organ/waltz` the 8 s waltz (our own tune: a reedy pipe melody over
 *   oom-pah-pah); `oat/organ/stop` the bellows run out.
 * - DE RIJ (§6.7): `oat/queue/step` the queue shuffles forward; `oat/queue/number` the number
 *   display's ding-dong; `oat/queue/push` a line-cutter's shove.
 * - De Makelaar (§4): `oat/makelaar/paddle` a `+10%` paddle swung and slapped; `oat/makelaar/sign`
 *   a shot on a `VERKOCHT` board; `oat/makelaar/doorbell` the ding-dong before the viewing;
 *   `oat/makelaar/rush` the viewers' stampede (wordless); `oat/makelaar/courtage` a coin that slips
 *   away (the 1.5 % on a pickup).
 *
 * Levels follow sfx/index.ts: frequent sounds (cans, ticks) low, tells and pickups in the middle,
 * crashes on top; peaks ≤ 0.92. Every melody here was written for METAL SWAN 3.
 */
import { BP, clack, fmBell, hits, HP, hz, loopRecipe, LP, noise, note, scatter, seq, tone, type Recipes } from './kit';
import type { SfxLayer } from '../../../engine/synth';

/** Bright metal clinks at fixed pseudo-random times (cans tumbling out of a bin). */
function clinks(n: number, t0: number, span: number, seed: number, vol: number): SfxLayer[] {
  const t = scatter(n, seed);
  const f = scatter(n, seed + 3);
  return t.flatMap((u, i) => [
    tone('sine', 2600 + f[i] * 1900, 2500 + f[i] * 1800, 0.05, vol * (1 - u * 0.5), { delay: t0 + u * span }),
    noise(0.02, vol * 0.5 * (1 - u * 0.5), BP(5200, undefined, 1.5), { delay: t0 + u * span }),
  ]);
}

/** Feet shuffling: soft low noise scuffs at fixed pseudo-random times. */
function scuffs(n: number, t0: number, span: number, seed: number, vol: number, freq = 500): SfxLayer[] {
  return scatter(n, seed).map((u, i) => noise(0.05 + (i % 3) * 0.02, vol * (0.6 + (i % 4) * 0.1), BP(freq + (i % 5) * 70, undefined, 1.2), { delay: t0 + u * span }));
}

// ---------------------------------------------------------------------------------------------
// The draaiorgel waltz (8 s, D major, 3/4 at 135 bpm: 6 bars of 3 beats)
// ---------------------------------------------------------------------------------------------

const WALTZ_BEAT = 60 / 135;

/** The tune: [note, beats] (0 = rest). Our own: a lilting climb, a turn, a fall to the tonic. */
const WALTZ_TUNE: readonly (readonly [string, number])[] = [
  ['F#5', 1], ['A5', 1], ['D6', 1],
  ['C#6', 2], ['B5', 1],
  ['A5', 1], ['G5', 1], ['E5', 1],
  ['F#5', 2], ['D5', 1],
  ['E5', 1], ['G5', 1], ['C#6', 1],
  ['D6', 3],
];

/** The oom-pah-pah: bass on 1, chord on 2 and 3, per bar (root, chord notes). */
const WALTZ_BARS: readonly (readonly [string, readonly string[]])[] = [
  ['D3', ['F#4', 'A4']],
  ['A2', ['E4', 'G4']],
  ['G2', ['G4', 'B4']],
  ['D3', ['F#4', 'A4']],
  ['A2', ['E4', 'C#5']],
  ['D3', ['F#4', 'A4']],
];

/** A reedy organ pipe: a pulse and a triangle an octave up, a fast tremulant. */
function pipe(freq: number, len: number, vol: number, delay: number): SfxLayer[] {
  const env = { a: 0.012, d: 0.04, s: 0.8, hold: len * 0.82, r: 0.05 };
  return [
    { wave: 'square', freq, duty: 0.3, env, vol, delay, filter: LP(2800), tremolo: { rate: 7, depth: 0.12 } },
    { wave: 'triangle', freq: freq * 2, env, vol: vol * 0.35, delay, tremolo: { rate: 7, depth: 0.12 } },
  ];
}

function waltz(): SfxLayer[] {
  const tune = seq(
    WALTZ_TUNE.map(([n, b]) => [hz(n), b * WALTZ_BEAT] as const),
    (f, len, d) => pipe(f, len, 0.3, d),
  );
  const accomp = WALTZ_BARS.flatMap(([root, chord], bar) => {
    const t = bar * 3 * WALTZ_BEAT;
    return [
      // The bass pipe on 1 and the drum's thump.
      ...pipe(hz(root), WALTZ_BEAT * 0.9, 0.34, t),
      tone('sine', 110, 60, 0.12, 0.4, { delay: t }),
      // The chord on 2 and 3, short (pah, pah) with a little snare-ish tick.
      ...[1, 2].flatMap((b) => [
        ...chord.flatMap((n) => pipe(hz(n), WALTZ_BEAT * 0.45, 0.12, t + b * WALTZ_BEAT)),
        noise(0.03, 0.08, BP(3000, undefined, 1), { delay: t + b * WALTZ_BEAT }),
      ]),
    ];
  });
  // A glockenspiel doubles the last note.
  return [...tune, ...accomp, ...fmBell(hz('D6'), 1.2, 0.18, { delay: 15 * WALTZ_BEAT, ratio: 3.5, index: 2 })];
}

// ---------------------------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------------------------

export const OAT_DAY: Recipes = {
  // --- Statiegeld bins (§6.1)
  'oat/bin/hit': {
    vol: 0.7,
    voices: 3,
    gap: 0.05,
    jitter: 0.06,
    layers: [tone('sine', 150, 90, 0.12, 0.7), noise(0.08, 0.4, BP(700, undefined, 1.4)), tone('square', 320, 260, 0.05, 0.12, { filter: LP(1500) })],
  },
  'oat/bin/burst': {
    vol: 0.75,
    voices: 2,
    gap: 0.2,
    layers: [
      // The plastic cracks, the lid slaps open.
      noise(0.1, 0.7, BP(1200, 600, 1)),
      tone('sine', 120, 60, 0.2, 0.6),
      ...clack(700, 0.45, 0.04, 0.03),
      // Cans and bottles tumble out and clatter.
      ...clinks(12, 0.06, 0.5, 11, 0.22),
      ...scuffs(5, 0.1, 0.4, 5, 0.12, 900),
    ],
  },
  'oat/bin/can': {
    vol: 0.5,
    voices: 4,
    gap: 0.04,
    jitter: 0.12,
    layers: [...[0, 0.07, 0.12].flatMap((d, i) => [tone('sine', 3100 - i * 200, 2950 - i * 200, 0.05, 0.4 / (1 + i), { delay: d }), noise(0.015, 0.25 / (1 + i), HP(4000), { delay: d })])],
  },
  'oat/bin/bottle': {
    vol: 1.4,
    voices: 4,
    gap: 0.04,
    jitter: 0.1,
    layers: [...[0, 0.09, 0.15].flatMap((d, i) => [tone('triangle', 520 - i * 30, 380, 0.06, 0.45 / (1 + i), { delay: d, filter: BP(900, undefined, 2) }), noise(0.02, 0.2 / (1 + i), BP(1800, undefined, 2), { delay: d })])],
  },
  'oat/bin/deposit': {
    vol: 0.5,
    voices: 3,
    gap: 0.05,
    layers: [note('square', hz('E6'), 0.05, 0.2, 0, { filter: LP(5000) }), note('square', hz('B6'), 0.07, 0.2, 0.07, { filter: LP(5000) }), ...fmBell(hz('E7'), 0.22, 0.18, { delay: 0.07, ratio: 2.4, index: 2 })],
  },

  // --- DE HAVERBAR (§6.2)
  'oat/shop/pay': {
    vol: 0.55,
    voices: 2,
    gap: 0.2,
    layers: [note('sine', hz('A5'), 0.08, 0.5), note('sine', hz('E6'), 0.14, 0.5, 0.13), ...clack(1800, 0.15, 0.32)],
  },
  'oat/shop/refuse': {
    vol: 0.6,
    voices: 1,
    gap: 0.4,
    layers: [0, 0.2].flatMap((d) => [note('square', 180, 0.12, 0.35, d, { filter: LP(1400) }), note('square', 186, 0.12, 0.2, d, { filter: LP(1400) })]),
  },
  'oat/shop/steam': {
    vol: 0.55,
    voices: 1,
    gap: 0.4,
    layers: [
      { wave: 'noise', env: { a: 0.04, d: 0.1, s: 0.8, hold: 0.45, r: 0.2 }, vol: 0.6, filter: BP(3800, 2600, 0.9) },
      { wave: 'noise', env: { a: 0.1, d: 0.1, s: 0.6, hold: 0.35, r: 0.2 }, vol: 0.25, filter: LP(500), tremolo: { rate: 18, depth: 0.5 } },
    ],
  },
  'oat/shop/inflation': {
    vol: 0.6,
    voices: 1,
    gap: 0.3,
    // The ratchet climbs: four ticks that rise, then a small "ting" on top.
    layers: [...hits(4, 0, 0.07).flatMap((t, i) => clack(900 + i * 260, 0.35, t)), ...fmBell(hz('C7'), 0.25, 0.2, { delay: 0.3, ratio: 3.5, index: 2 })],
  },
  'oat/shop/bell': {
    vol: 0.5,
    voices: 1,
    gap: 0.5,
    // A brass bell on a spring: three quick strikes that fade.
    layers: hits(4, 0, 0.09).flatMap((t, i) => fmBell(hz('G6'), 0.5, 0.35 / (1 + i * 0.6), { delay: t, ratio: 2.76, index: 3 })),
  },
  'oat/conceptstore/glass': {
    vol: 0.7,
    voices: 1,
    gap: 0.3,
    layers: [
      noise(0.08, 0.8, HP(2500)),
      tone('sine', 1900, 1700, 0.08, 0.3),
      // The shards tinkle down.
      ...scatter(14, 31).map((u, i) => tone('sine', 3500 + (i % 5) * 700, 3400 + (i % 5) * 650, 0.06, 0.18 * (1 - u * 0.6), { delay: 0.05 + u * 0.55 })),
    ],
  },

  // --- The brommobiel influencer (§3)
  'oat/brammobiel/motor': loopRecipe(1, 0.35, [
    // A 45 km/h microcar: a buzzy two-stroke at 50 Hz with a rasp (whole cycles in 1 s).
    { wave: 'saw', freq: 50, vol: 0.5, filter: LP(900, undefined, 1.5) },
    { wave: 'square', freq: 100, vol: 0.18, filter: BP(1300, undefined, 2), tremolo: { rate: 10, depth: 0.4 } },
    { wave: 'noise', vol: 0.12, filter: BP(2200, undefined, 1.5), tremolo: { rate: 25, depth: 0.6 } },
  ]),
  'oat/brammobiel/horn': {
    vol: 0.5,
    voices: 1,
    gap: 0.4,
    layers: [0, 0.16].flatMap((d) => [note('square', 520, 0.09, 0.35, d, { filter: LP(2500) }), note('square', 655, 0.09, 0.25, d, { filter: LP(2500) })]),
  },
  'oat/influencer/ring-light': {
    vol: 0.55,
    voices: 1,
    gap: 0.3,
    layers: [...clack(2600, 0.4, 0), tone('sine', 3200, 6400, 0.25, 0.2, { delay: 0.02 }), noise(0.25, 0.3, HP(5000, 8000), { delay: 0.02 })],
  },

  // --- The bakfiets-ouder (§3)
  'oat/bakfiets/bell': {
    vol: 0.5,
    voices: 1,
    gap: 0.6,
    // Ring-ring: the thumb lever strikes the dome fast, twice.
    layers: [0, 0.3].flatMap((d) => hits(5, d, 0.035).flatMap((t) => fmBell(hz('E6') * 1.02, 0.25, 0.22, { delay: t, ratio: 2.76, index: 3, decay: 0.05 }))),
  },
  'oat/bakfiets/lakschade': {
    vol: 1.1,
    voices: 1,
    gap: 0.4,
    layers: [
      { wave: 'saw', freq: 900, bend: [[0, 0], [0.2, 3], [0.45, -2]], env: { a: 0.01, d: 0.05, s: 0.8, hold: 0.35, r: 0.08 }, vol: 0.3, filter: BP(2400, undefined, 4), tremolo: { rate: 38, depth: 0.7 } },
      { wave: 'noise', env: { a: 0.01, d: 0.05, s: 0.7, hold: 0.35, r: 0.08 }, vol: 0.35, filter: BP(3500, undefined, 2) },
    ],
  },
  'oat/bakfiets/thump': {
    vol: 0.65,
    voices: 3,
    gap: 0.05,
    jitter: 0.05,
    layers: [tone('sine', 130, 75, 0.12, 0.7), noise(0.06, 0.45, BP(900, undefined, 1.5)), ...clack(500, 0.2, 0.005, 0.025)],
  },

  // --- The taxi (§3)
  'oat/taxi/meter': {
    vol: 0.45,
    voices: 2,
    gap: 0.05,
    layers: [...clack(1500, 0.45, 0), ...clack(1100, 0.3, 0.05)],
  },
  'oat/taxi/horn': {
    vol: 0.6,
    voices: 1,
    gap: 0.8,
    layers: [
      { wave: 'saw', freq: 392, env: { a: 0.01, d: 0.05, s: 0.85, hold: 0.45, r: 0.06 }, vol: 0.3, filter: LP(2200) },
      { wave: 'saw', freq: 466, env: { a: 0.01, d: 0.05, s: 0.85, hold: 0.45, r: 0.06 }, vol: 0.25, filter: LP(2200) },
      { wave: 'square', freq: 196, env: { a: 0.01, d: 0.05, s: 0.7, hold: 0.45, r: 0.06 }, vol: 0.1, filter: LP(700) },
    ],
  },
  'oat/taxi/door': {
    vol: 0.65,
    voices: 1,
    gap: 0.3,
    layers: [...clack(1200, 0.4, 0, 0.02), noise(0.22, 0.35, BP(700, 1500, 0.9), { delay: 0.02 }), tone('sine', 110, 70, 0.1, 0.5, { delay: 0.24 }), noise(0.06, 0.3, LP(900), { delay: 0.24 })],
  },
  'oat/taxi/rev': {
    vol: 0.3,
    voices: 1,
    gap: 0.6,
    layers: [
      { wave: 'saw', freq: 45, to: 120, sweep: 0.6, env: { a: 0.04, d: 0.1, s: 0.85, hold: 0.55, r: 0.15 }, vol: 0.55, filter: LP(700, 1600, 1.5), drive: 1 },
      { wave: 'square', freq: 90, to: 240, sweep: 0.6, env: { a: 0.04, d: 0.1, s: 0.7, hold: 0.55, r: 0.15 }, vol: 0.15, filter: BP(1200, undefined, 1.5) },
      { wave: 'noise', env: { a: 0.05, d: 0.1, s: 0.6, hold: 0.5, r: 0.15 }, vol: 0.15, filter: BP(1800, undefined, 1) },
    ],
  },
  'oat/taxi/skid': {
    vol: 1.2,
    voices: 1,
    gap: 0.5,
    layers: [
      { wave: 'saw', freq: 1500, bend: [[0, 0], [0.3, 1.2], [0.6, -0.8]], env: { a: 0.02, d: 0.05, s: 0.8, hold: 0.5, r: 0.12 }, vol: 0.25, filter: BP(2600, undefined, 5), tremolo: { rate: 30, depth: 0.5 } },
      { wave: 'noise', env: { a: 0.02, d: 0.05, s: 0.7, hold: 0.5, r: 0.12 }, vol: 0.35, filter: BP(2000, 1400, 1.2) },
    ],
  },

  // --- The blauwe envelop (§6.3)
  'oat/envelope/rip': {
    vol: 0.6,
    voices: 2,
    gap: 0.1,
    layers: [{ wave: 'noise', env: { a: 0.005, d: 0.25 }, vol: 0.7, filter: BP(2400, 4200, 1), tremolo: { rate: 55, depth: 0.7 } }, noise(0.03, 0.3, HP(3000), { delay: 0.22 })],
  },
  'oat/envelope/refund': {
    vol: 0.55,
    voices: 1,
    gap: 0.5,
    layers: [
      // The till's drawer and bell (ka-ching), then a happy arpeggio.
      ...clack(800, 0.35, 0, 0.03),
      ...fmBell(hz('A6'), 0.35, 0.3, { delay: 0.04, ratio: 2.76, index: 3 }),
      ...seq([[hz('C6'), 0.07], [hz('E6'), 0.07], [hz('G6'), 0.07], [hz('C7'), 0.2]], (f, len, d) => note('square', f, len, 0.18, d, { filter: LP(5000) }), 0.16),
    ],
  },
  'oat/envelope/aanslag': {
    vol: 0.6,
    voices: 1,
    gap: 0.5,
    layers: [
      // A rubber stamp, then a deflating slide down (wah-wah).
      tone('sine', 140, 70, 0.1, 0.7),
      noise(0.05, 0.4, LP(900)),
      { wave: 'square', freq: hz('G4'), bend: [[0.1, 0], [0.3, -1], [0.45, -1], [0.7, -5]], env: { a: 0.02, d: 0.05, s: 0.8, hold: 0.5, r: 0.1 }, vol: 0.22, delay: 0.12, filter: LP(1600), tremolo: { rate: 5, depth: 0.3 } },
    ],
  },

  // --- The hijsbalk (§6.4)
  'oat/hoist/rope': {
    vol: 0.7,
    voices: 1,
    gap: 0.4,
    layers: [
      { wave: 'saw', freq: 140, bend: [[0, 0], [0.3, 2]], env: { a: 0.03, d: 0.05, s: 0.7, hold: 0.3, r: 0.05 }, vol: 0.35, filter: BP(800, undefined, 4), tremolo: { rate: 24, depth: 0.7 } },
      // The snap.
      noise(0.05, 0.7, BP(2200, undefined, 1.2), { delay: 0.4 }),
      tone('sine', 300, 120, 0.12, 0.3, { delay: 0.4 }),
    ],
  },
  'oat/hoist/piano': {
    vol: 0.75,
    voices: 1,
    gap: 1,
    length: 1.6,
    layers: [
      // The crash of the case.
      tone('sine', 85, 40, 0.35, 0.9),
      noise(0.3, 0.7, LP(1200)),
      ...clack(400, 0.4, 0.01, 0.04),
      // Every string rings at once: a jangling cluster that fades.
      ...['C3', 'F#3', 'B3', 'E4', 'Bb4', 'D#5', 'A5'].map((n, i) => ({ wave: 'triangle' as const, freq: hz(n) * (1 + (i % 3) * 0.004), env: { a: 0.002, d: 1.3 - i * 0.1 }, vol: 0.14, delay: 0.02 + i * 0.01 })),
    ],
  },
  'oat/hoist/sofa': {
    vol: 0.7,
    voices: 1,
    gap: 0.6,
    layers: [tone('sine', 95, 50, 0.3, 0.8), noise(0.2, 0.5, LP(500)), tone('sine', 220, 330, 0.25, 0.15, { delay: 0.05, vibrato: { rate: 14, depth: 1.5 } }), tone('sine', 300, 430, 0.2, 0.1, { delay: 0.1, vibrato: { rate: 16, depth: 1.5 } })],
  },

  // --- Het draaiorgel (§6.5)
  'oat/organ/waltz': { vol: 0.36, voices: 1, gap: 4, length: 8.2, layers: waltz() },
  'oat/organ/stop': {
    vol: 0.55,
    voices: 1,
    gap: 1,
    layers: [
      // The bellows run out: the chord sags and wheezes.
      ...['D4', 'F#4', 'A4'].map((n) => ({ wave: 'square' as const, freq: hz(n), duty: 0.3, bend: [[0, 0], [0.6, -4]] as const, env: { a: 0.005, d: 0.1, s: 0.7, hold: 0.5, r: 0.15 }, vol: 0.15, filter: LP(2200, 600) })),
      { wave: 'noise', env: { a: 0.1, d: 0.6 }, vol: 0.25, filter: BP(900, 400, 1) },
    ],
  },

  // --- DE RIJ (§6.7)
  'oat/queue/step': { vol: 1.5, voices: 1, gap: 0.3, layers: scuffs(10, 0, 0.3, 21, 0.4) },
  'oat/queue/number': {
    vol: 0.5,
    voices: 1,
    gap: 0.5,
    layers: [...fmBell(hz('E6'), 0.4, 0.35, { ratio: 2, index: 1.5 }), ...fmBell(hz('C6'), 0.5, 0.35, { ratio: 2, index: 1.5, delay: 0.18 })],
  },
  'oat/queue/push': {
    vol: 0.6,
    voices: 2,
    gap: 0.1,
    layers: [tone('sine', 120, 70, 0.1, 0.6), noise(0.12, 0.5, BP(600, 300, 1)), ...scuffs(3, 0.06, 0.15, 7, 0.25)],
  },

  // --- De Makelaar (§4)
  'oat/makelaar/paddle': {
    vol: 0.6,
    voices: 2,
    gap: 0.15,
    layers: [noise(0.14, 0.4, BP(900, 2400, 1.2)), ...clack(900, 0.5, 0.14, 0.03), tone('sine', 220, 120, 0.06, 0.4, { delay: 0.14 })],
  },
  'oat/makelaar/sign': {
    vol: 0.6,
    voices: 3,
    gap: 0.05,
    jitter: 0.06,
    layers: [tone('triangle', 260, 200, 0.12, 0.5, { filter: BP(700, undefined, 2) }), noise(0.05, 0.4, BP(1500, undefined, 1.3)), tone('sine', 120, 80, 0.08, 0.4)],
  },
  'oat/makelaar/doorbell': {
    vol: 0.5,
    voices: 1,
    gap: 1,
    layers: [...fmBell(hz('E5'), 0.6, 0.4, { ratio: 2, index: 1.2 }), ...fmBell(hz('C5'), 0.7, 0.4, { ratio: 2, index: 1.2, delay: 0.35 })],
  },
  'oat/makelaar/rush': {
    vol: 2,
    voices: 1,
    gap: 1,
    length: 1.4,
    layers: [
      // Many feet stamp out of a door: a stampede of scuffs and a low rumble, a wordless murmur.
      ...scuffs(26, 0, 1.1, 47, 0.45, 450),
      { wave: 'noise', env: { a: 0.15, d: 0.2, s: 0.7, hold: 0.6, r: 0.3 }, vol: 0.3, filter: LP(260) },
      { wave: 'noise', env: { a: 0.2, d: 0.2, s: 0.5, hold: 0.5, r: 0.3 }, vol: 0.15, filter: BP(650, undefined, 2.5), tremolo: { rate: 6, depth: 0.6 } },
    ],
  },
  'oat/makelaar/courtage': {
    vol: 0.8,
    voices: 2,
    gap: 0.08,
    layers: [...fmBell(hz('B6'), 0.18, 0.25, { ratio: 2.4, index: 2 }), tone('square', hz('E6'), hz('E5'), 0.18, 0.15, { delay: 0.05, filter: LP(3000) })],
  },
};
