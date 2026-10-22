// Synth sounds of mission ring, revision R (docs/design/ring.md §R.8): owner TRAIN-1 (the ZWAAN
// train's controller and kit, the container trailer, the cab ZWARE JONGEN). Spread into SFX in
// sfx/index.ts. Synth recipes only (no samples, no generated audio in wave A). Ids: zwaan/kit.ts
// `ZWAAN_SFX`.
//
// Kit cues (every part): `ring/zwaan-clank` (the coupling lets go: a heavy steel clank and a long
// ring), `ring/zwaan-snap` (the drawbar's pin pops: a sharp crack and a spring), `ring/zwaan-tip`
// (a part tips onto the hard shoulder: a deep crunch, then a long grinding scrape).
// The cab: `ring/zwaan-horn` (its air horn on every lane change: three deep trumpets in a minor
// chord, longer and lower than the container's), telegraph `ring/zwaan-window` (the sleeper window
// slides open and the gun is cocked: the gunner's tell), `ring/zwaan-gunner` (his shots: a dry
// crack), `ring/zwaan-squeal` (the brake check: a high brake squeal over the air hiss).
import { BP, clack, fmBell, hits, HP, LP, noise, tone, type Recipes } from './kit';

/** One air-horn trumpet (a bright saw and a square an octave down through a horn band). */
function trumpet(f: number, delay: number, len: number, vol: number) {
  const env = { a: 0.04, d: 0.05, s: 0.9, hold: len, r: 0.16 };
  return [
    { wave: 'saw' as const, freq: f, env, vol, delay, filter: BP(f * 2.2, undefined, 0.7), bend: [[0, -1.5], [0.08, 0]] as const },
    { wave: 'square' as const, freq: f / 2, env, vol: vol * 0.55, delay, filter: LP(f * 2.8) },
  ];
}

export const RING_ZWAAN_A: Recipes = {
  'ring/zwaan-clank': {
    vol: 0.75,
    voices: 2,
    gap: 0.2,
    drive: 0.5,
    layers: [
      // The jaw opens: a heavy knock, a low boom, the steel rings on.
      ...clack(380, 0.8, 0, 0.035),
      tone('sine', 85, 45, 0.3, 0.9),
      ...fmBell(210, 0.9, 0.3, { ratio: 1.41, index: 4 }),
      ...fmBell(530, 0.5, 0.12, { ratio: 2.1, index: 2, delay: 0.01 }),
      noise(0.12, 0.45, BP(1100, 500, 0.9)),
    ],
  },
  'ring/zwaan-snap': {
    vol: 0.7,
    voices: 2,
    gap: 0.15,
    layers: [
      // The pin pops: a sharp crack, a short spring twang, the air lines whip.
      ...clack(2400, 0.7, 0, 0.012),
      { wave: 'triangle', freq: 640, to: 420, sweep: 0.18, env: { a: 0.002, d: 0.04, s: 0.4, hold: 0.06, r: 0.12 }, vol: 0.35, vibrato: { rate: 38, depth: 1.2 } },
      { wave: 'noise', env: { a: 0.003, d: 0.05, s: 0.5, hold: 0.12, r: 0.16 }, vol: 0.45, filter: HP(3500, 6000) },
    ],
  },
  'ring/zwaan-tip': {
    vol: 0.8,
    voices: 1,
    gap: 0.5,
    drive: 0.7,
    layers: [
      // It lands on its side: a deep crunch, metal folding, then the long scrape on the asphalt.
      tone('sine', 60, 30, 0.6, 1),
      noise(0.6, 0.7, LP(1300, 250)),
      ...hits(4, 0.02, 0.06, 1.3).flatMap((t, i) => clack(600 + i * 260, 0.4, t, 0.03)),
      ...fmBell(110, 1, 0.22, { ratio: 1.41, index: 6 }),
      { wave: 'noise', env: { a: 0.08, d: 0.05, s: 0.7, hold: 0.7, r: 0.3 }, vol: 0.55, delay: 0.15, filter: BP(2300, 1500, 1.4), tremolo: { rate: 19, depth: 0.5 } },
    ],
  },
  'ring/zwaan-horn': {
    vol: 0.6,
    voices: 1,
    gap: 0.7,
    drive: 0.5,
    // ZWARE JONGEN's horn: three trumpets (a minor chord), deeper and longer than the container's.
    layers: [...trumpet(147, 0, 0.75, 0.3), ...trumpet(175, 0.015, 0.74, 0.26), ...trumpet(220, 0.03, 0.72, 0.22)],
    filter: HP(70),
  },
  'ring/zwaan-window': {
    vol: 0.7,
    voices: 1,
    gap: 0.4,
    layers: [
      // The window slides in its rubber track (a squeaky swish), then the slide of a pistol racks.
      { wave: 'noise', env: { a: 0.02, d: 0.04, s: 0.6, hold: 0.16, r: 0.06 }, vol: 0.4, filter: BP(1800, 900, 1.2) },
      { wave: 'triangle', freq: 1500, to: 1100, sweep: 0.2, env: { a: 0.01, d: 0.03, s: 0.5, hold: 0.14, r: 0.05 }, vol: 0.12, vibrato: { rate: 26, depth: 0.6 } },
      ...clack(2600, 0.6, 0.26, 0.015),
      ...clack(1800, 0.65, 0.33, 0.018),
    ],
  },
  'ring/zwaan-gunner': {
    vol: 0.55,
    voices: 3,
    gap: 0.06,
    layers: [
      // A dry crack from the cab, the shot's tail swallowed by the road noise.
      ...clack(1700, 0.8, 0, 0.012),
      noise(0.09, 0.8, BP(2200, 900, 0.8)),
      tone('sine', 140, 60, 0.07, 0.6),
    ],
  },
  'ring/zwaan-squeal': {
    vol: 0.6,
    voices: 1,
    gap: 0.5,
    layers: [
      // The brake check: a high squeal that wavers, over the air brakes' hiss.
      { wave: 'saw', freq: 2900, to: 2500, sweep: 0.4, env: { a: 0.02, d: 0.05, s: 0.7, hold: 0.32, r: 0.12 }, vol: 0.2, vibrato: { rate: 11, depth: 0.5 }, filter: BP(2800, undefined, 4) },
      { wave: 'noise', env: { a: 0.005, d: 0.05, s: 0.6, hold: 0.3, r: 0.2 }, vol: 0.5, filter: HP(3200, 5200) },
      tone('sine', 80, 50, 0.1, 0.4),
    ],
  },
};
