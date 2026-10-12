/**
 * Environment sounds (GDD §12.1 "Bosses, environment, UI": `env/*`): crowds, jokes, water, wind,
 * radio, snow, trees, trains and the anthem loudspeaker.
 *
 * Loops (`sfxLoop`): `env/radio-static` (under the briefing text), `env/ice-melt` (while the
 * meltwater rises), `env/wind` (the air jet's hiss; one pass is also one whole m3 gust: 60 streak
 * ticks + the 120-tick push) and `env/avalanche` (the roar while the avalanche set piece chases).
 * Everything else is a one-shot; `env/anthem-sting` covers the speaker's 180-tick anthem.
 */
import type { SfxLayer, SfxRecipe } from '../../../engine/synth';
import { BP, clack, fmBell, HP, hz, LP, loopRecipe, noise, scatter, tone, type Recipes } from './kit';

/**
 * Crowd applause: twelve "clappers" (noise bursts gated by a short saw LFO at their own drifting
 * rates and starts, each a band of its own) over a soft low-passed bed; the crowd swells and thins.
 */
function applause(vol: number): SfxRecipe {
  const clappers = scatter(36, 0xc1a9);
  const layers: SfxLayer[] = [
    { wave: 'noise', env: { a: 0.35, d: 0.1, s: 0.7, hold: 0.95, r: 0.6 }, vol: 0.2, filter: LP(900) },
  ];
  for (let i = 0; i < 12; i++) {
    const [r, p, q] = [clappers[i * 3], clappers[i * 3 + 1], clappers[i * 3 + 2]];
    const rate = 5 + r * 4.5;
    const start = q * 0.25;
    layers.push({
      wave: 'noise',
      delay: start,
      env: { a: 0.15, d: 0.1, s: 0.8, hold: 1.0 + p * 0.3, r: 0.45 },
      vol: 0.55,
      filter: BP(900 + p * 1800, undefined, 1.2),
      tremolo: { rate, rateTo: rate * (0.9 + q * 0.2), depth: 1, shape: 'saw', width: 0.16 },
    });
  }
  return { vol, voices: 1, gap: 1, layers };
}

/** The anthem's first bar (`ANTHEM_THEME` in music/index.ts): [note, rows] at 84 bpm, 4 rows a beat. */
const ANTHEM_BAR: readonly (readonly [string, number])[] = [
  ['Bb4', 3],
  ['F5', 1],
  ['D5', 4],
  ['C5', 3],
  ['G5', 1],
  ['Eb5', 4],
];
const ANTHEM_ROW = 60 / 84 / 4;

/** Loop lengths (s): one pass of the wind is one m3 gust (60 + 120 ticks); the avalanche's GDD 3 s roar. */
const WIND_LEN = 2.9;
const AVALANCHE_LEN = 2.9;

/** Melody and chords of the anthem's first bar, built for the loudspeaker filter. */
function anthemBar(): SfxLayer[] {
  const layers: SfxLayer[] = [];
  let t = 0;
  for (const [n, rows] of ANTHEM_BAR) {
    const len = rows * ANTHEM_ROW;
    const env = { a: 0.012, d: 0.04, s: 0.8, hold: Math.max(0.02, len - 0.07), r: 0.04 };
    layers.push(
      { wave: 'pulse', duty: 0.5, freq: hz(n), env, vol: 0.4, delay: t, vibrato: { rate: 5.5, depth: 0.15, delay: 0.1 } },
      { wave: 'saw', freq: hz(n) / 2, env, vol: 0.28, delay: t },
    );
    t += len;
  }
  // Pompous chords under it: B♭ major for two beats, then E♭ major.
  const half = 8 * ANTHEM_ROW;
  for (const [notes, at] of [
    [['Bb3', 'D4', 'F4'], 0],
    [['Bb3', 'Eb4', 'G4'], half],
  ] as const) {
    for (const n of notes) layers.push({ wave: 'saw', freq: hz(n), env: { a: 0.03, d: 0.05, s: 0.8, hold: half - 0.1, r: 0.06 }, vol: 0.13, delay: at });
  }
  // The speaker's crackle and hum.
  layers.push(
    { wave: 'noise', freq: 2500, env: { a: 0.01, s: 0.6, hold: 2.8, r: 0.05 }, vol: 0.08, filter: HP(1500), tremolo: { rate: 13, depth: 1, shape: 'saw' } },
    { wave: 'square', freq: 100, env: { a: 0.01, s: 0.6, hold: 2.8, r: 0.05 }, vol: 0.05 },
  );
  return layers;
}

export const ENV: Recipes = {
  // Crowd clapping from random noise bursts over a soft low-passed bed, 2 s.
  'env/applause': applause(1.932),
  // "Ba-dum-tss": two drum hits and a cymbal hiss.
  'env/rimshot': {
    vol: 0.622,
    voices: 1,
    gap: 0.5,
    layers: [
      noise(0.12, 0.7, BP(2200, undefined, 0.8)),
      tone('triangle', 240, 160, 0.09, 0.6, { sweep: 0.06 }),
      tone('sine', 150, 85, 0.25, 0.9, { delay: 0.2, sweep: 0.12 }),
      noise(0.04, 0.4, LP(1200), { delay: 0.2 }),
      { wave: 'noise', env: { a: 0.002, d: 0.55 }, vol: 0.55, delay: 0.4, filter: HP(5500) },
      { wave: 'metal', freq: 23000, env: { a: 0.002, d: 0.45 }, vol: 0.3, delay: 0.4, filter: HP(6500) },
    ],
  },
  // Nobody laughs: one cricket, two chirps (pulse 4 kHz, gated).
  'env/cricket': {
    vol: 0.357,
    voices: 1,
    gap: 0.5,
    layers: [0, 0.3].map((delay) => ({
      wave: 'pulse' as const,
      duty: 0.5,
      freq: 4000,
      env: { a: 0.004, s: 1, hold: 0.115, r: 0.01 },
      vol: 0.5,
      delay,
      filter: LP(7000),
      tremolo: { rate: 34, depth: 1, shape: 'square' as const },
    })),
  },
  // Something lands in the water: a slap, a plop and droplets.
  'env/water-splash': {
    vol: 0.955,
    voices: 2,
    gap: 0.1,
    layers: [
      noise(0.12, 0.85, LP(2500, 400)),
      { wave: 'noise', env: { a: 0.004, d: 0.22 }, vol: 0.45, filter: BP(900, 1600, 1.2) },
      tone('sine', 90, 50, 0.1, 0.5),
      ...scatter(7, 0x77e1).map((r, i) => tone('sine', 1200 + r * 1600, (1200 + r * 1600) * 1.6, 0.03, 0.28, { delay: 0.06 + i * 0.04 + r * 0.02 })),
    ],
  },
  // The sluice gate opens (m1-b2): a rush of water with bubbles, 2.5 s.
  'env/water-rush': {
    vol: 0.773,
    voices: 1,
    gap: 1,
    layers: [
      { wave: 'noise', env: { a: 0.35, d: 0.1, s: 0.8, hold: 1.5, r: 0.55 }, vol: 0.75, filter: BP(700, undefined, 0.8), tremolo: { rate: 3, depth: 0.3 } },
      { wave: 'noise', env: { a: 0.35, d: 0.1, s: 0.7, hold: 1.5, r: 0.55 }, vol: 0.35, filter: BP(1800, undefined, 1.5), tremolo: { rate: 5, depth: 0.5 } },
      { wave: 'noise', freq: 400, env: { a: 0.3, d: 0.1, s: 0.8, hold: 1.5, r: 0.6 }, vol: 0.4, filter: LP(300) },
      ...scatter(14, 0x3b0b).map((r, i) => tone('sine', 380 + r * 520, (380 + r * 520) * 1.8, 0.04, 0.16, { delay: 0.25 + i * 0.13 + r * 0.05 })),
    ],
  },
  // The wind (loop, 2.9 s): a steady band-passed bed with one gust per pass. The gust layers start
  // and end silent, so the loop is seamless and a single pass (`sfx`) is one whole m3 gust (60 streak
  // ticks + the 120-tick push) that starts on the soft bed; the air jet loops it as a gusting hiss.
  // Bed LFOs make whole cycles in the 2.9 s pass (6 and 3 cycles).
  'env/wind': loopRecipe(
    WIND_LEN,
    1.146,
    [
      { wave: 'noise', vol: 0.3, filter: BP(600, undefined, 1.2), tremolo: { rate: 6 / WIND_LEN, depth: 0.3 } },
      { wave: 'noise', vol: 0.08, filter: BP(1700, undefined, 3), tremolo: { rate: 3 / WIND_LEN, depth: 0.6 } },
    ],
    [
      { wave: 'noise', env: { a: 0.9, d: 0.3, s: 0.8, hold: 0.7, r: 0.8 }, vol: 0.8, filter: BP(500, 1100, 1.4), tremolo: { rate: 1.3, depth: 0.4 } },
      { wave: 'noise', env: { a: 0.9, d: 0.3, s: 0.7, hold: 0.7, r: 0.8 }, vol: 0.3, filter: BP(1500, 2200, 4), tremolo: { rate: 2.1, depth: 0.6 } },
      { wave: 'noise', env: { a: 0.6, d: 0.3, s: 0.6, hold: 0.8, r: 0.9 }, vol: 0.12, filter: HP(5000) },
    ],
  ),
  // Radio static under the briefing (loop, 1 s): a band-limited hiss, crackles, hum and a faint
  // tuning whine (100 Hz, 1750 Hz and the 3 / 9 Hz LFOs make whole cycles).
  'env/radio-static': loopRecipe(1.0, 0.478, [
    { wave: 'noise', vol: 0.5, filter: BP(2000, undefined, 0.8) },
    { wave: 'noise', freq: 1500, vol: 0.35, filter: HP(2500), tremolo: { rate: 9, depth: 1, shape: 'saw' } },
    { wave: 'square', freq: 100, vol: 0.08, filter: BP(300, undefined, 1.5) },
    { wave: 'sine', freq: 1750, vol: 0.05, vibrato: { rate: 3, depth: 0.3 } },
  ]),
  // AVALANCHE! A long roar (loop, 2.9 s: the set piece loops it while the snow chases and fades
  // it out with `stopSfx`): a low growl, tumbling snow and scattered crunches. LFO rates make whole
  // cycles in the pass (20 and 7 cycles; the 40 Hz sub makes 116).
  'env/avalanche': loopRecipe(
    AVALANCHE_LEN,
    0.6,
    [
      { wave: 'noise', freq: 2000, vol: 0.85, filter: LP(400) },
      { wave: 'noise', vol: 0.55, filter: LP(1000), tremolo: { rate: 20 / AVALANCHE_LEN, depth: 0.35 }, drive: 0.8 },
      { wave: 'sine', freq: 40, vol: 0.5, tremolo: { rate: 7 / AVALANCHE_LEN, depth: 0.4 } },
    ],
    scatter(12, 0xa7a1).map((r, i) => noise(0.08, 0.6, LP(1400), { delay: 0.08 + i * 0.22 + r * 0.1, drive: 1 })),
  ),
  // The willow falls (m1-c, 40 ticks): a creak (saw glide), a crack, then the crash.
  'env/timber': {
    vol: 0.478,
    voices: 1,
    gap: 1,
    layers: [
      { wave: 'pulse', duty: 0.06, freq: 18, to: 30, env: { a: 0.05, d: 0.02, s: 0.8, hold: 0.5, r: 0.06 }, vol: 1, filter: BP(650, undefined, 4) },
      { wave: 'pulse', duty: 0.06, freq: 18, to: 30, env: { a: 0.05, d: 0.02, s: 0.8, hold: 0.5, r: 0.06 }, vol: 0.6, filter: BP(1500, undefined, 6) },
      // The groan under the clicks: a slow saw glide through a woody band.
      { wave: 'saw', freq: 150, to: 105, bend: [[0.3, 0], [0.5, 1.5]], env: { a: 0.08, d: 0.02, s: 0.8, hold: 0.45, r: 0.06 }, vol: 0.22, filter: BP(520, undefined, 3) },
      ...clack(1300, 0.8, 0.55, 0.03),
      noise(0.06, 0.8, HP(1500), { delay: 0.55 }),
      noise(0.5, 0.9, LP(2500, 300), { delay: 0.67, drive: 1.2 }),
      tone('sine', 80, 35, 0.4, 0.45, { delay: 0.67 }),
      noise(0.6, 0.2, HP(4000), { delay: 0.7 }),
    ],
    drive: 0.6,
  },
  // Meltwater (loop, 2 s): dripping plinks (at fixed pseudo-random times) over a low hiss.
  'env/ice-melt': loopRecipe(
    2.0,
    0.522,
    [
      { wave: 'noise', vol: 0.3, filter: LP(800), tremolo: { rate: 0.5, depth: 0.3 } },
      { wave: 'noise', vol: 0.08, filter: HP(4000) },
    ],
    scatter(8, 0x1ce).map((r, i) => {
      const f = 1100 + r * 1700;
      return { wave: 'sine', freq: f, to: f * 1.5, sweep: 0.02, env: { a: 0.001, d: 0.09 }, vol: 0.45, delay: 0.08 + i * 0.235 + r * 0.06 };
    }),
  ),
  // The subway / cable-car bell: "DING DING".
  'env/train-bell': {
    vol: 0.435,
    voices: 1,
    gap: 0.5,
    layers: [0, 0.22].flatMap((delay) => [
      ...fmBell(1320, 0.45, 0.6, { ratio: 2.76, index: 3, decay: 0.06, delay }),
      ...fmBell(1320 * 2.4, 0.2, 0.2, { ratio: 1.5, index: 1, delay }),
    ]),
  },
  // The subway train passes (6 px/tick): a whoosh and a rumble with wheel clatter, 2.6 s.
  'env/train-pass': {
    vol: 0.672,
    voices: 1,
    gap: 1,
    layers: [
      { wave: 'noise', freq: 400, env: { a: 0.6, d: 0.1, s: 0.9, hold: 0.95, r: 0.9 }, vol: 0.8, filter: LP(350) },
      { wave: 'noise', env: { a: 0.6, d: 0.1, s: 0.8, hold: 0.95, r: 0.9 }, vol: 0.45, filter: BP(1200, undefined, 1.2), tremolo: { rate: 8, rateTo: 9.5, depth: 0.8, shape: 'saw' } },
      { wave: 'noise', env: { a: 1.1, d: 0.2 }, vol: 0.45, filter: BP(500, 1600, 1.4) },
      { wave: 'noise', delay: 1.2, env: { a: 0.05, d: 1.2 }, vol: 0.45, filter: BP(1600, 450, 1.4) },
    ],
  },
  // The anthem speaker: the anthem's first bar through a band-pass "loudspeaker" (2.9 s).
  'env/anthem-sting': {
    vol: 0.327,
    voices: 1,
    gap: 2,
    layers: anthemBar(),
    filter: BP(1300, undefined, 0.7),
    drive: 1.2,
  },
};

