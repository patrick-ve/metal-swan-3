// Synth sounds of mission rally, the cars (docs/design/rally.md §8 "Synth"; docs/api/rally.md
// "C.S"): the tyres, the barrier, the bumps, the recovery blink, the gear change, the wind and the
// passing whoosh. Spread into SFX in sfx/index.ts. Synth recipes only (no samples, no generated
// audio); the engines are not recipes but the parametric engine voice (`AudioOut.engine`), driven by
// src/game/rally/sound.ts. Owner: SFX (wave C).
//
// - Loops (`sfxLoop`, vol / pitch / pan live): `rally/squeal` (tyre squeal from the slip, the
//   handbrake and hard braking), `rally/scrape` (metal along the barrier while a car touches it),
//   `rally/wind` (the air at high speed).
// - One-shots: `rally/scrape-hit` (the first touch of a barrier), `rally/bump` / `rally/bump-hard`
//   (car–car or car–traffic), `rally/crash` (a hard hit on traffic: crunch and glass),
//   `rally/recover` (the car is put back: two rising blips under the blink), `rally/handbrake` (the
//   lever's ratchet and a tyre chirp), `rally/shift` (an estate's gear change: a clunk and the turbo's
//   blow-off), `rally/whoosh` / `rally/whoosh-big` (a car / a lorry or coach passing close: a swept
//   band of air that falls in pitch).
import { BP, clack, click, fmBell, hits, HP, LP, loopRecipe, noise, tone, type Recipes } from './kit';

export const RALLY_CAR: Recipes = {
  // Tyre squeal (loop, 0.5 s): two howling partials (1240 / 1560 Hz with 24 / 18 Hz vibrato) over a
  // scrubbing band of noise; every tone and LFO makes whole cycles in 0.5 s. `sfxLoop` vol follows
  // the slip, pitch 0.9 … 1.1 the speed.
  'rally/squeal': loopRecipe(0.5, 0.42, [
    { wave: 'saw', freq: 1240, vol: 0.16, vibrato: { rate: 24, depth: 0.45 }, filter: BP(1300, undefined, 3) },
    { wave: 'sine', freq: 1560, vol: 0.26, vibrato: { rate: 18, depth: 0.55 } },
    { wave: 'noise', vol: 0.3, filter: BP(2600, undefined, 1.6), tremolo: { rate: 14, depth: 0.4 } },
  ]),
  // Metal along the barrier (loop, 0.5 s): a crackling grind (noise bursts at 40 Hz), the body's
  // low judder (96 Hz) and a thin metal shriek.
  'rally/scrape': loopRecipe(0.5, 0.92, [
    { wave: 'noise', vol: 0.5, filter: BP(2200, undefined, 1.2), tremolo: { rate: 40, depth: 0.75, shape: 'saw', width: 0.35 } },
    { wave: 'noise', vol: 0.32, filter: LP(520), tremolo: { rate: 16, depth: 0.5 } },
    { wave: 'square', freq: 96, vol: 0.08, filter: LP(300) },
    { wave: 'sine', freq: 3100, vol: 0.05, vibrato: { rate: 12, depth: 0.6 } },
  ]),
  // The air at speed (loop, 1 s): a low rush with a slow swell, a band of hiss, a thin top.
  'rally/wind': loopRecipe(1, 0.74, [
    { wave: 'noise', vol: 0.6, filter: LP(900), tremolo: { rate: 1, depth: 0.25 } },
    { wave: 'noise', vol: 0.24, filter: BP(2400, undefined, 0.8), tremolo: { rate: 3, depth: 0.4 } },
    { wave: 'noise', vol: 0.07, filter: HP(5000) },
  ]),
  // The first touch of a barrier: a thump, a scraping burst and the guard rail's short ring.
  'rally/scrape-hit': {
    vol: 0.76,
    voices: 2,
    gap: 0.08,
    layers: [
      tone('sine', 140, 60, 0.12, 0.6),
      noise(0.18, 0.55, BP(2400, 1200, 1.1)),
      ...clack(1600, 0.35),
      ...fmBell(520, 0.2, 0.22, { ratio: 1.41, index: 5, decay: 0.04 }),
    ],
  },
  // Car against car: a rubbery thud and a panel knock.
  'rally/bump': {
    vol: 0.6,
    voices: 3,
    gap: 0.06,
    layers: [tone('sine', 120, 60, 0.14, 0.75), noise(0.08, 0.35, LP(900)), tone('triangle', 330, 260, 0.06, 0.15, { delay: 0.01 }), ...clack(900, 0.22, 0.01)],
  },
  // A hard knock: deeper, with crumpling metal.
  'rally/bump-hard': {
    vol: 0.5,
    voices: 2,
    gap: 0.08,
    layers: [
      tone('sine', 100, 42, 0.26, 0.8),
      noise(0.3, 0.7, LP(2800, 400), { drive: 1.1 }),
      ...fmBell(200, 0.22, 0.4, { ratio: 1.47, index: 6, decay: 0.05 }),
      click(600, 0.3),
    ],
  },
  // A hard hit on traffic: a deep thump, crumpling metal, a burst of glass and its tinkle.
  'rally/crash': {
    vol: 0.44,
    voices: 2,
    gap: 0.3,
    layers: [
      tone('sine', 90, 35, 0.4, 0.8),
      noise(0.45, 0.8, LP(3200, 300), { drive: 1.1 }),
      ...fmBell(160, 0.36, 0.45, { ratio: 1.41, index: 7, decay: 0.06 }),
      noise(0.08, 0.5, HP(4000), { delay: 0.05 }),
      ...fmBell(3300, 0.18, 0.18, { ratio: 2.3, index: 1.5, decay: 0.03, delay: 0.1 }),
      ...fmBell(2700, 0.16, 0.16, { ratio: 2.6, index: 1.6, decay: 0.03, delay: 0.19 }),
    ],
  },
  // The car is put back (the blink): two soft rising blips over a short upward sweep.
  'rally/recover': {
    vol: 0.63,
    voices: 1,
    gap: 0.3,
    layers: [
      { wave: 'sine', freq: 600, to: 1400, sweep: 0.25, env: { a: 0.02, d: 0.26 }, vol: 0.22 },
      { wave: 'square', freq: 1319, env: { a: 0.003, s: 1, hold: 0.06, r: 0.03 }, vol: 0.16, filter: LP(4000) },
      { wave: 'square', freq: 1976, env: { a: 0.003, s: 1, hold: 0.08, r: 0.05 }, vol: 0.16, delay: 0.1, filter: LP(4500) },
    ],
  },
  // The handbrake: the lever's ratchet (four quick clacks) and a short tyre chirp.
  'rally/handbrake': {
    vol: 1.05,
    voices: 1,
    gap: 0.2,
    layers: [
      ...hits(4, 0, 0.022).flatMap((t) => clack(2400, 0.3, t, 0.012)),
      tone('sine', 1500, 1200, 0.14, 0.18, { delay: 0.08, vibrato: { rate: 28, depth: 0.5 } }),
      noise(0.12, 0.2, BP(2600, 1800, 1.5), { delay: 0.08 }),
    ],
  },
  // An estate's gear change: a clunk in the gearbox and the turbo's blow-off ("pssh").
  'rally/shift': {
    vol: 0.97,
    voices: 1,
    gap: 0.12,
    layers: [
      ...clack(700, 0.35),
      tone('sine', 160, 110, 0.05, 0.3),
      { wave: 'noise', env: { a: 0.01, d: 0.22 }, vol: 0.35, delay: 0.02, filter: BP(3200, 1800, 1.4) },
    ],
  },
  // A car passing close: a swept band of air falling in pitch, with a faint tonal hint.
  'rally/whoosh': {
    vol: 0.81,
    voices: 3,
    gap: 0.08,
    layers: [
      { wave: 'noise', env: { a: 0.16, d: 0.3 }, vol: 0.7, filter: BP(2600, 700, 1.1) },
      { wave: 'sine', freq: 520, to: 300, env: { a: 0.14, d: 0.26 }, vol: 0.06 },
    ],
  },
  // A lorry or a coach passing close: deeper and longer, with the rumble of its wheels.
  'rally/whoosh-big': {
    vol: 0.76,
    voices: 2,
    gap: 0.15,
    layers: [
      { wave: 'noise', env: { a: 0.24, d: 0.5 }, vol: 0.75, filter: BP(1500, 350, 0.9) },
      { wave: 'noise', env: { a: 0.2, d: 0.5 }, vol: 0.45, filter: LP(220) },
      { wave: 'sine', freq: 110, to: 70, env: { a: 0.2, d: 0.45 }, vol: 0.22 },
    ],
  },
};
