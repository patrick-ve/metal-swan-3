// Synth sounds of mission ring, area 'road' (docs/design/ring.md §7, §8, §11): the traffic, the
// hazards, the items and the scooter gang. Spread into SFX in sfx/index.ts. Synth recipes only (no
// samples, no generated audio). Owner: the ROAD builder.
//
// Telegraphs start on the first tell tick (GDD §4.11 rule 2): `ring/bottle-tell` (a glass clink as
// the pillion lifts the bottle), `ring/pistol-cock` (the slide racked), `ring/cam-beep` (the speed
// camera's warning chirp while a wagon is in the front third).
// Cues: `ring/matrix-click` (a sign switches: a relay clack and the LED panel's buzz),
// `ring/flash` (the camera: a charge whine, the flash pop, the shutter), `ring/horns` (the jam: car
// horns overlapping), `ring/cone` (a cone knocked: a hollow plastic whack), `ring/crash` (the
// crash-absorber hit), `ring/dent` (a shot dents a car: a short sheet-metal tock), `ring/crate` (a
// crate driven over: a wooden knock and a bright pick-up chime), `ring/cage-hit` (the cage door
// rings), `ring/hop` (a hostage's leap), `ring/scooter-whine` (a two-stroke pass-by), `ring/scooter-
// honk` (its squeaky horn), `ring/throw` (a bottle whooshes), `ring/bottle` (it smashes),
// `ring/scooter-crash` / `ring/scooter-down` (knocked off / falling over: a scrape and a clatter).
import { BP, clack, click, fmBell, hits, HP, LP, noise, scatter, tone, type Recipes } from './kit';

/** A dual-tone car horn (two square tones a minor third apart through a horn band). */
function horn(f: number, delay: number, len: number, vol: number) {
  const env = { a: 0.01, d: 0.02, s: 0.85, hold: len, r: 0.04 };
  return [
    { wave: 'square' as const, freq: f, env, vol, delay, filter: BP(f * 2.2, undefined, 0.9) },
    { wave: 'square' as const, freq: f * 1.19, env, vol: vol * 0.8, delay, filter: BP(f * 2.6, undefined, 0.9) },
  ];
}

const GLASS = scatter(10, 77);

export const RING_ROAD: Recipes = {
  'ring/matrix-click': {
    vol: 0.8,
    voices: 2,
    gap: 0.05,
    layers: [...clack(900, 0.6, 0, 0.02), ...clack(1400, 0.35, 0.03, 0.015), { wave: 'square', freq: 100, env: { a: 0.002, d: 0.01, s: 0.5, hold: 0.06, r: 0.02 }, vol: 0.08, delay: 0.02, filter: BP(2400, undefined, 2) }],
  },
  'ring/flash': {
    vol: 0.6,
    voices: 2,
    gap: 0.1,
    layers: [
      // The capacitor charging (a thin whine up), the pop of the flash, the shutter.
      { wave: 'sine', freq: 2200, to: 5200, sweep: 0.16, env: { a: 0.01, d: 0.02, s: 0.7, hold: 0.12, r: 0.02 }, vol: 0.18 },
      noise(0.08, 0.7, HP(2500, 6000), { delay: 0.16 }),
      tone('square', 1800, 600, 0.05, 0.25, { delay: 0.16, filter: LP(5000) }),
      ...clack(2600, 0.4, 0.22, 0.012),
    ],
  },
  'ring/cam-beep': {
    vol: 0.6,
    voices: 1,
    gap: 0.4,
    layers: hits(2, 0, 0.09).map((t) => ({ wave: 'square' as const, freq: 1975, env: { a: 0.002, d: 0.01, s: 0.8, hold: 0.04, r: 0.01 }, vol: 0.4, delay: t, filter: BP(2400, undefined, 1.2) })),
  },
  'ring/horns': {
    vol: 0.45,
    voices: 1,
    gap: 0.8,
    layers: [...horn(392, 0, 0.32, 0.35), ...horn(440, 0.18, 0.5, 0.3), ...horn(349, 0.42, 0.22, 0.28), ...horn(415, 0.62, 0.3, 0.25)],
  },
  'ring/cone': {
    vol: 0.6,
    voices: 3,
    gap: 0.04,
    layers: [tone('triangle', 260, 140, 0.09, 0.6), noise(0.06, 0.5, BP(1400, 700, 1.3)), ...clack(700, 0.3, 0.05, 0.02)],
  },
  'ring/crash': {
    vol: 0.75,
    voices: 2,
    gap: 0.15,
    drive: 0.6,
    layers: [
      tone('sine', 90, 40, 0.3, 0.9),
      noise(0.45, 0.6, BP(1800, 600, 0.8)),
      ...hits(4, 0.04, 0.06, 1.1).flatMap((t, i) => clack(900 + i * 260, 0.35, t, 0.03)),
    ],
  },
  'ring/dent': {
    vol: 0.8,
    voices: 3,
    gap: 0.05,
    layers: [tone('triangle', 620, 380, 0.08, 0.8), noise(0.05, 0.6, BP(3200, undefined, 1.4))],
  },
  'ring/crate': {
    vol: 0.6,
    voices: 2,
    gap: 0.08,
    layers: [tone('sine', 180, 110, 0.07, 0.6), noise(0.04, 0.3, BP(900, undefined, 1.2)), ...fmBell(1318, 0.18, 0.28, { delay: 0.04, ratio: 2, index: 2 }), ...fmBell(1976, 0.22, 0.25, { delay: 0.1, ratio: 2, index: 2 })],
  },
  'ring/cage-hit': {
    vol: 0.45,
    voices: 3,
    gap: 0.04,
    layers: [...fmBell(740, 0.18, 0.4, { ratio: 2.76, index: 3 }), noise(0.03, 0.3, HP(3000))],
  },
  'ring/hop': {
    vol: 0.7,
    voices: 2,
    gap: 0.1,
    layers: [noise(0.14, 0.8, BP(900, 2600, 1.4)), tone('sine', 300, 700, 0.12, 0.45)],
  },
  'ring/scooter-whine': {
    vol: 0.8,
    voices: 2,
    gap: 0.6,
    layers: [
      { wave: 'saw', freq: 170, bend: [[0, 0], [0.35, 6], [0.8, 3]], env: { a: 0.08, d: 0.05, s: 0.8, hold: 0.55, r: 0.15 }, vol: 1, filter: BP(1300, 2000, 0.8), tremolo: { rate: 32, depth: 0.3, shape: 'saw', width: 0.5 } },
      noise(0.8, 0.25, BP(2600, undefined, 1.4), { env: { a: 0.08, d: 0.05, s: 0.7, hold: 0.55, r: 0.15 } }),
    ],
  },
  'ring/scooter-honk': {
    vol: 0.6,
    voices: 1,
    gap: 0.3,
    layers: hits(2, 0, 0.12).map((t) => ({ wave: 'square' as const, freq: 880, env: { a: 0.004, d: 0.01, s: 0.8, hold: 0.07, r: 0.02 }, vol: 0.4, delay: t, filter: BP(1800, undefined, 1.1) })),
  },
  'ring/pistol-cock': {
    vol: 0.8,
    voices: 2,
    gap: 0.1,
    layers: [...clack(1700, 0.5, 0, 0.015), ...clack(1200, 0.55, 0.07, 0.02)],
  },
  'ring/bottle-tell': {
    vol: 0.85,
    voices: 2,
    gap: 0.1,
    layers: [...fmBell(2637, 0.08, 0.3, { ratio: 2.4, index: 2 }), ...fmBell(3136, 0.08, 0.2, { ratio: 2.4, index: 2, delay: 0.05 })],
  },
  'ring/throw': {
    vol: 0.9,
    voices: 2,
    gap: 0.08,
    layers: [noise(0.2, 1, BP(700, 2200, 1.6)), noise(0.12, 0.5, BP(1800, 3200, 2))],
  },
  'ring/bottle': {
    vol: 0.55,
    voices: 3,
    gap: 0.05,
    layers: [
      noise(0.05, 0.7, HP(2000)),
      noise(0.3, 0.3, BP(5200, 3000, 1.2), { delay: 0.02 }),
      ...GLASS.map((r, i) => click(3000 + r * 4000, 0.25 * (1 - i / GLASS.length), 0.02 + i * 0.025)),
    ],
  },
  'ring/scooter-crash': {
    vol: 0.6,
    voices: 2,
    gap: 0.12,
    layers: [tone('sine', 120, 50, 0.18, 0.7), noise(0.5, 0.4, BP(2600, 1200, 1)), ...hits(3, 0.08, 0.09).flatMap((t, i) => clack(1100 + i * 300, 0.3, t, 0.025))],
  },
  'ring/scooter-down': {
    vol: 0.8,
    voices: 2,
    gap: 0.12,
    layers: [noise(0.35, 0.4, BP(2200, 1000, 1.1)), ...clack(900, 0.35, 0.05, 0.03), tone('triangle', 200, 120, 0.1, 0.3, { delay: 0.02 })],
  },
};
