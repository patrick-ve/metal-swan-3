// Synth sounds of mission oldenzaal owned by TOWER (docs/design/oldenzaal.md §8, §9, §11): the
// tower climb ('oz/tower/…') and the jet Swan ('oz/swan/…'). Spread into SFX in sfx/index.ts.
// Synth recipes only (wave B: no generated audio). The bells reuse AUDIO's 'oz/env/bell' and
// 'oz/env/bell-creak' (the small bells at a higher pitch); the wind and rain are the storm ambience.
//
// - `oz/tower/tide`        (loop, 4 s) the horde climbing the tower: a low massed groan that swells
//                          and sinks, boots and nails scraping on wood and stone, helmets knocking.
// - `oz/tower/tide-surge`  the tide starts: a rising groan of many throats (no scream), a rumble.
// - `oz/tower/tide-recoil` the last toll drives it back: a falling groan and a hiss of grit.
// - `oz/tower/toll-last`   the big bell's toll in the spire (deeper and longer than 'oz/env/bell',
//                          with a shimmer on top).
// - `oz/tower/creak`       an old landing creaks under a step (wood stick-slip).
// - `oz/swan/ignite`       the rocket units light: a soft thump, a rising turbine whine.
// - `oz/swan/jet`          (loop, 2 s) the two units burning: a hiss, a roar, a steady whine.
// - `oz/swan/flyby`        she turns and goes: a roar that swells and falls away (a doppler drop).
import { BP, HP, hz, loopRecipe, LP, noise, scatter, tone, type Recipes } from './kit';

const TIDE_LEN = 2.4;
const JET_LEN = 2;

/** A groaning throat: a detuned saw through a vowel band, slow pitch wander (whole cycles in the loop). */
function groan(f: number, vol: number, rate: number, vowel: number) {
  return { wave: 'saw' as const, freq: f, vol, filter: BP(vowel, undefined, 2.2), vibrato: { rate, depth: 1.6 }, tremolo: { rate: rate * 2, depth: 0.5 } };
}

/** Knocks of helmets and boots in the mass: short dull clicks at fixed pseudo-random times. */
function knocks(n: number, len: number, seed: number, vol: number) {
  const t = scatter(n, seed);
  const f = scatter(n, seed + 3);
  return t.map((u, i) => noise(0.03, vol * (0.5 + f[i] * 0.5), BP(380 + f[i] * 500, undefined, 3), { delay: u * (len - 0.05) }));
}

export const OZ_TOWER_SFX: Recipes = {
  'oz/tower/tide': loopRecipe(
    TIDE_LEN,
    1,
    [
      // The massed groan (several throats a little apart; tones and rates are whole cycles in the loop).
      groan(55, 0.22, 1 / TIDE_LEN, 520),
      groan(158 / TIDE_LEN, 0.18, 2 / TIDE_LEN, 700),
      groan(198 / TIDE_LEN, 0.12, 3 / TIDE_LEN, 420),
      // Scraping on wood and stone.
      { wave: 'noise', vol: 0.35, filter: BP(1400, undefined, 1.2), tremolo: { rate: 6 / TIDE_LEN, depth: 0.6 } },
      // A low rumble of the mass.
      { wave: 'noise', vol: 0.4, filter: LP(160), tremolo: { rate: 1 / TIDE_LEN, depth: 0.4 } },
    ],
    knocks(12, TIDE_LEN, 211, 0.4),
  ),
  'oz/tower/tide-surge': {
    vol: 1,
    voices: 1,
    gap: 1,
    length: 2.2,
    layers: [
      { wave: 'saw', freq: hz('G1'), to: hz('D2'), env: { a: 0.5, d: 1.4 }, vol: 0.7, filter: BP(480, 820, 2), vibrato: { rate: 3, depth: 1.5 } },
      { wave: 'saw', freq: hz('A#1'), to: hz('F2'), env: { a: 0.6, d: 1.3 }, vol: 0.55, delay: 0.08, filter: BP(640, 980, 2), vibrato: { rate: 2.4, depth: 1.8 } },
      { wave: 'noise', env: { a: 0.5, d: 1.5 }, vol: 0.8, filter: LP(220, 120) },
      noise(1.2, 0.5, BP(1500, undefined, 1), { env: { a: 0.4, d: 0.8 } }),
    ],
  },
  'oz/tower/tide-recoil': {
    vol: 0.8,
    voices: 1,
    gap: 1,
    length: 1.8,
    layers: [
      { wave: 'saw', freq: hz('D2'), to: hz('F1'), env: { a: 0.02, d: 1.6 }, vol: 0.45, filter: BP(600, 300, 2), vibrato: { rate: 4, depth: 1.2 } },
      noise(1.2, 0.4, HP(1800, 900), { env: { a: 0.05, d: 1.1 } }),
      tone('sine', 55, 38, 1.4, 0.4),
    ],
  },
  'oz/tower/toll-last': {
    vol: 0.85,
    voices: 2,
    gap: 0.6,
    length: 2.9,
    layers: [
      noise(0.05, 0.4, BP(1600, undefined, 1.2)),
      // A deep bell: the hum, the prime, the tierce (a minor third) and the nominal, slow decays.
      { wave: 'sine', freq: hz('D2'), env: { a: 0.01, d: 2.85 }, vol: 0.38 },
      { wave: 'sine', freq: hz('D3'), env: { a: 0.005, d: 2.6 }, vol: 0.3 },
      { wave: 'sine', freq: hz('F3') * 1.004, env: { a: 0.005, d: 2.2 }, vol: 0.22 },
      { wave: 'sine', freq: hz('A3'), env: { a: 0.004, d: 2.2 }, vol: 0.14 },
      { wave: 'sine', freq: hz('D4') * 1.002, env: { a: 0.003, d: 1.6 }, vol: 0.16 },
      // The shimmer: beating partials high up.
      { wave: 'sine', freq: hz('A5'), env: { a: 0.002, d: 0.9 }, vol: 0.05, tremolo: { rate: 5, depth: 0.6 } },
    ],
  },
  'oz/tower/creak': {
    vol: 1,
    voices: 2,
    gap: 0.3,
    layers: [{ wave: 'saw', freq: 140, bend: [[0, 0], [0.3, 2], [0.7, -1]], env: { a: 0.03, d: 0.5 }, vol: 0.95, filter: BP(950, undefined, 4), tremolo: { rate: 31, depth: 0.8 }, drive: 1 }],
  },
  'oz/swan/ignite': {
    vol: 0.8,
    voices: 1,
    gap: 0.5,
    length: 1.6,
    layers: [
      tone('sine', 90, 48, 0.25, 0.6),
      noise(0.3, 0.5, LP(900, 300)),
      { wave: 'saw', freq: 300, to: 1400, env: { a: 0.4, d: 1.1 }, vol: 0.12, filter: BP(1800, 3200, 2) },
      { wave: 'noise', env: { a: 0.5, d: 1 }, vol: 0.4, filter: HP(2200) },
    ],
  },
  'oz/swan/jet': loopRecipe(JET_LEN, 0.29, [
    { wave: 'noise', vol: 0.45, filter: HP(2600) },
    { wave: 'noise', vol: 0.6, filter: LP(420), tremolo: { rate: 6 / JET_LEN, depth: 0.25 } },
    { wave: 'saw', freq: 1300, vol: 0.05, filter: BP(2600, undefined, 3), vibrato: { rate: 2 / JET_LEN, depth: 0.3 } },
    { wave: 'sine', freq: 70, vol: 0.12 },
  ]),
  'oz/swan/flyby': {
    vol: 0.9,
    voices: 1,
    gap: 1,
    length: 2.4,
    layers: [
      { wave: 'noise', env: { a: 0.45, d: 1.9 }, vol: 0.7, filter: BP(2200, 600, 0.9) },
      { wave: 'noise', env: { a: 0.3, d: 1.6 }, vol: 0.5, filter: LP(500, 160) },
      { wave: 'saw', freq: 1500, to: 700, env: { a: 0.3, d: 1.8 }, vol: 0.08, filter: BP(2400, 1200, 3) },
    ],
  },
};

/** Every id of this module (the spec test and the API doc list them). */
export const OZ_TOWER_SFX_IDS: readonly string[] = Object.keys(OZ_TOWER_SFX);
