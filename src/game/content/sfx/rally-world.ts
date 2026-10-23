// Synth sounds of mission rally, the road (docs/design/rally.md §8 "Synth"; docs/api/rally.md
// "C.S"): the horns, the police, the speed camera, the finish, the road works and the ice-cream
// van. Spread into SFX in sfx/index.ts. Synth recipes only, our own designs (no samples, no
// generated audio, no known tune). Owner: SFX (wave C).
//
// - Team horns `rally/horn/<team id>` (the team specs' `horn` field, content/rally/teams): the hearse
//   deep and solemn, OMA TRUUS a tiny high "meep meep", the stag limo a party arpeggio, the snack van
//   hoarse, the camper wheezy and sagging, ACHTERUIT a horn that sounds played backwards (a swell
//   and a hard stop), the ice-cream van a ding-dong chime over a soft horn.
// - Traffic: `rally/horn/car` (a short annoyed two-tone), `rally/horn/car-long` (leaning on it),
//   `rally/horn/air` (a lorry's or a coach's air-horn chord).
// - Police: `rally/siren` (loop, 1.2 s: the Dutch two-tone, 0.6 s per tone a fourth apart; doppler
//   through the loop's pitch), `rally/whoop` (two yelps: a racer is pulled over).
// - `rally/flitser`: a speed camera catches a car (a double shutter click, the flash's pop and the
//   capacitor's whine as it recharges).
// - `rally/finish` (a two-chord synth-brass sting, any place) and `rally/finish-win` (a rising
//   arpeggio into a bright chord, the winner): cheerful, never mocking.
// - `rally/arrow-beep` (loop, 1 s): the arrow-board truck at the road works (its diesel idling and
//   one warning beep a second).
// - `rally/ijsco-tune` (loop, 2.4 s): DE IJSCOMAN's own tune from its tinny loudspeaker (an original
//   three-bar waltz phrase in F) over the speaker's hum.
import { BP, fmBell, hz, LP, loopRecipe, noise, note, seq, tone, type Recipes } from './kit';
import type { SfxLayer } from '../../../engine/synth';

/** A two-tone car horn: two square tones through a horn band, held `len` s from `delay`. */
function horn(f: number, ratio: number, len: number, vol: number, delay = 0, x: Partial<SfxLayer> = {}): SfxLayer[] {
  const env = { a: 0.01, d: 0.02, s: 0.85, hold: len, r: 0.04 };
  return [
    { wave: 'square', freq: f, env, vol, delay, filter: BP(f * 2.2, undefined, 0.9), ...x },
    { wave: 'square', freq: f * ratio, env, vol: vol * 0.8, delay, filter: BP(f * ratio * 2.4, undefined, 0.9), ...x },
  ];
}

/** The siren's two tones: the low one and a fourth above, 0.6 s each (a short glide between). */
const SIREN_LOW = 450;
const SIREN_BEND: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.57, 0],
  [0.6, 5],
  [1.17, 5],
  [1.2, 0],
];

/** DE IJSCOMAN's tune (an original waltz phrase in F, 0.2 s a beat): [note, beats]. */
const IJSCO_TUNE: readonly (readonly [string, number])[] = [
  ['A4', 1], ['C5', 1], ['F5', 1],
  ['E5', 1], ['C5', 1], ['A4', 1],
  ['Bb4', 1], ['D5', 1], ['G5', 1],
  ['F5', 2],
];
const BEAT = 0.2;

export const RALLY_WORLD: Recipes = {
  // ---- the team horns (content/rally/teams `horn`)
  // DE LAATSTE RIT (the hearse): one long, low, soft minor third.
  'rally/horn/laatste-rit': { vol: 0.37, voices: 1, gap: 0.6, layers: horn(196, 1.19, 0.55, 0.32, 0, { filter: LP(1200) }) },
  // OMA TRUUS (the tiny hatchback): "meep meep", high and short.
  'rally/horn/oma-truus': { vol: 0.65, voices: 1, gap: 0.4, layers: [...horn(740, 1.19, 0.07, 0.3), ...horn(740, 1.19, 0.08, 0.3, 0.15)] },
  // VRIJGEZELLEN (the stag limo): a party horn's rising arpeggio.
  'rally/horn/vrijgezellen': {
    vol: 0.58,
    voices: 1,
    gap: 0.6,
    layers: seq(
      [[hz('C5'), 0.09], [hz('E5'), 0.09], [hz('G5'), 0.09], [hz('C6'), 0.2]],
      (f, len, delay) => ({ wave: 'square', freq: f, env: { a: 0.006, d: 0.02, s: 0.85, hold: len - 0.03, r: 0.03 }, vol: 0.34, delay, filter: BP(f * 2, undefined, 1) }),
    ),
  },
  // DE FRIETBAK (the snack van): a hoarse horn with a rattle.
  'rally/horn/frietbak': { vol: 0.23, voices: 1, gap: 0.5, layers: horn(330, 1.19, 0.34, 0.3, 0, { drive: 1.4, tremolo: { rate: 30, depth: 0.3 } }) },
  // HUISJE OP WIELEN (the camper): a wheezy single note that sags, with a breath of air.
  'rally/horn/huisje': {
    vol: 1.45,
    voices: 1,
    gap: 0.5,
    layers: [
      { wave: 'saw', freq: 300, bend: [[0, 0], [0.12, 0], [0.42, -2]], env: { a: 0.03, d: 0.03, s: 0.8, hold: 0.32, r: 0.06 }, vol: 0.3, filter: BP(800, undefined, 1.2), vibrato: { rate: 7, depth: 0.25 } },
      noise(0.4, 0.12, BP(1800, 1200, 1.5)),
    ],
  },
  // ACHTERUIT (the backwards saloon): a horn played backwards (a slow swell rising into a hard stop).
  'rally/horn/achteruit': {
    vol: 0.77,
    voices: 1,
    gap: 0.6,
    layers: horn(420, 1.19, 0.02, 0.32, 0, {
      env: { a: 0.36, s: 1, hold: 0.02, r: 0.008 },
      bend: [[0, -3], [0.38, 0]],
    }),
  },
  // DE IJSCOMAN (the ice-cream van): a ding-dong chime over a soft horn.
  'rally/horn/ijscoman': {
    vol: 0.56,
    voices: 1,
    gap: 0.6,
    layers: [
      ...fmBell(hz('C6'), 0.35, 0.3, { ratio: 3.5, index: 2.5, decay: 0.08 }),
      ...fmBell(hz('G5'), 0.45, 0.3, { ratio: 3.5, index: 2.5, decay: 0.08, delay: 0.2 }),
      ...horn(262, 1.26, 0.4, 0.12, 0, { filter: LP(1400) }),
    ],
  },
  // ---- traffic
  // A short, annoyed two-tone (a car cut off).
  'rally/horn/car': { vol: 0.58, voices: 2, gap: 0.3, layers: horn(400, 1.25, 0.26, 0.32) },
  // Leaning on the horn (a second car type).
  'rally/horn/car-long': { vol: 0.54, voices: 2, gap: 0.5, layers: [...horn(350, 1.26, 0.12, 0.3), ...horn(350, 1.26, 0.5, 0.3, 0.2)] },
  // A lorry's or a coach's air horn: a low three-tone chord with the valve's hiss.
  'rally/horn/air': {
    vol: 0.87,
    voices: 1,
    gap: 0.8,
    layers: [
      ...[185, 233, 277].map((f, i): SfxLayer => ({ wave: 'saw', freq: f, env: { a: 0.04, d: 0.04, s: 0.85, hold: 0.62, r: 0.1 }, vol: 0.2 - i * 0.03, filter: LP(1800) })),
      noise(0.08, 0.2, BP(3000, 1800, 1.2)),
    ],
  },
  // ---- the police
  // The two-tone (loop, 1.2 s): a brassy square and saw that jump a fourth every 0.6 s.
  'rally/siren': loopRecipe(1.2, 0.53, [
    { wave: 'square', freq: SIREN_LOW, bend: SIREN_BEND, vol: 0.32, filter: BP(1500, undefined, 0.8) },
    { wave: 'saw', freq: SIREN_LOW * 2, bend: SIREN_BEND, vol: 0.12, filter: LP(3200) },
  ]),
  // A racer is pulled over: two quick yelps.
  'rally/whoop': {
    vol: 0.69,
    voices: 1,
    gap: 0.6,
    layers: [0, 0.26].map((d): SfxLayer => ({
      wave: 'square',
      freq: 560,
      bend: [[0, -7], [0.1, 3], [0.22, -4]],
      env: { a: 0.01, d: 0.02, s: 0.85, hold: 0.18, r: 0.03 },
      vol: 0.32,
      delay: d,
      filter: BP(1500, undefined, 0.8),
    })),
  },
  // ---- the speed camera: a double shutter click, the flash's pop, the capacitor's rising whine.
  'rally/flitser': {
    vol: 1.18,
    voices: 2,
    gap: 0.12,
    layers: [
      { wave: 'square', freq: 2800, to: 1400, env: { a: 0.0005, d: 0.012 }, vol: 0.45, filter: LP(7000) },
      { wave: 'square', freq: 2200, to: 1100, env: { a: 0.0005, d: 0.012 }, vol: 0.4, delay: 0.045, filter: LP(7000) },
      noise(0.1, 0.5, BP(5200, 3000, 0.9), { delay: 0.02 }),
      { wave: 'sine', freq: 1800, to: 6200, sweep: 0.32, env: { a: 0.02, d: 0.3 }, vol: 0.09, delay: 0.1 },
    ],
  },
  // ---- the finish
  // Any place: a two-chord synth-brass sting (B♭ then F).
  'rally/finish': {
    vol: 0.98,
    voices: 1,
    gap: 1,
    layers: [
      ...['Bb3', 'D4', 'F4'].map((n): SfxLayer => note('saw', hz(n), 0.16, 0.13, 0, { filter: LP(2400) })),
      ...['A3', 'C4', 'F4'].map((n): SfxLayer => note('saw', hz(n), 0.5, 0.13, 0.24, { filter: LP(2800, 1200) })),
      tone('sine', hz('F2'), hz('F2'), 0.7, 0.3, { delay: 0.24 }),
    ],
  },
  // The winner: a quick rising arpeggio into a bright C chord with a bell on top.
  'rally/finish-win': {
    vol: 0.94,
    voices: 1,
    gap: 1,
    layers: [
      ...seq([[hz('C5'), 0.08], [hz('E5'), 0.08], [hz('G5'), 0.08]], (f, len, delay) => note('square', f, len - 0.02, 0.14, delay, { filter: LP(4000) })),
      ...['C4', 'E4', 'G4', 'C5'].map((n): SfxLayer => note('saw', hz(n), 0.7, 0.1, 0.24, { filter: LP(3600, 1600) })),
      tone('sine', hz('C3'), hz('C3'), 0.9, 0.3, { delay: 0.24 }),
      ...fmBell(hz('C6'), 0.6, 0.12, { ratio: 3.5, index: 2, decay: 0.1, delay: 0.24 }),
    ],
  },
  // ---- the road works: the arrow-board truck (loop, 1 s): its diesel idling and one warning beep.
  'rally/arrow-beep': loopRecipe(
    1,
    0.4,
    [
      { wave: 'saw', freq: 50, vol: 0.32, filter: LP(260), tremolo: { rate: 13, depth: 0.35 } },
      { wave: 'sine', freq: 100, vol: 0.06 },
    ],
    [{ wave: 'square', freq: 1600, env: { a: 0.003, s: 1, hold: 0.14, r: 0.02 }, vol: 0.32, delay: 0.3, filter: BP(1700, undefined, 1.4) }],
  ),
  // ---- DE IJSCOMAN's tune (loop, 2.4 s) from a tinny loudspeaker over its hum.
  'rally/ijsco-tune': loopRecipe(
    2.4,
    0.98,
    [
      { wave: 'sine', freq: 120, vol: 0.08 },
      { wave: 'noise', vol: 0.025, filter: BP(2000, undefined, 0.8) },
    ],
    seq(
      IJSCO_TUNE.map(([n, beats]) => [hz(n), beats * BEAT] as const),
      (f, len, delay) => [
        { wave: 'triangle', freq: f, env: { a: 0.004, d: Math.min(0.32, len * 0.85) }, vol: 0.4, delay, filter: BP(1600, undefined, 0.7), vibrato: { rate: 6, depth: 0.15 } },
        { wave: 'square', freq: f * 2, env: { a: 0.004, d: Math.min(0.16, len * 0.5) }, vol: 0.08, delay, filter: LP(3000) },
      ],
      0.03,
    ),
  ),
};
