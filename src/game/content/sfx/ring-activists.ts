// Synth sounds of mission ring, revision R wave B (docs/design/ring.md §R.6, §R.8): owner ACTIVISTS —
// the blockade's people: ids under 'ring/act/…'. Spread into SFX in sfx/index.ts. Every id has a synth
// recipe (AUDIO-2 may add ElevenLabs takes later, with these as the fallbacks).
//
// Tells start on the first tell tick (GDD §4.11 rule 2): `balloon-tell` (a rubber balloon squeaked in
// the hand), `pot-tell` (the glue tin's lid pried off: a tinny pop and a glug), `can-tell` (the soup
// sloshing in a shaken can), `shout-tell` (the megaphone's switch click and a deep breath),
// `squeal-tell` (the megaphone's feedback starting to whine, rising).
// Strikes and impacts: `splat` (a paint balloon bursts: a wet slap), `pot` (the tin cracks on the
// asphalt), `glue-stick` (a hero's boots in the glue: a sticky squelch), `can` (the can clanks on the
// road and the soup splashes), `can-hit` (the can bonks a hero), `shout` (an amplified bark: a buzzy
// formant blast), `push` (the ring knocks a hero back: a soft whump), `squeal` (the full feedback
// squeal, piercing), `squeal-out` (the beaten megafoon's megaphone squeals and drops).
// Exits and the rest: `rip` (the glue lets go: a long tearing rip), `snap` (the chain snaps: a steel
// clank and links rattling), `huff` (an offended "hmph": a short nasal tone), `hum` (a little hummed
// tune with the mouth shut), `sit` (a loper drops onto the asphalt), `glue-slap` (the glue slapped on
// the palm), `whistle` (the police whistle: two trills), `lift` (the police lift: a grunt and a
// creak of a stiff body).
import { BP, clack, HP, LP, noise, note, seq, tone, type Recipes } from './kit';

export const RING_ACTIVISTS: Recipes = {
  'ring/act/balloon-tell': {
    vol: 1.0,
    voices: 2,
    gap: 0.2,
    layers: [{ wave: 'square', freq: 900, env: { a: 0.01, d: 0.18 }, vol: 0.9, filter: BP(1400, 2200, 1.5), bend: [[0, 0], [0.06, 3], [0.12, -2], [0.18, 4]], duty: 0.2 }],
  },
  'ring/act/splat': {
    vol: 0.8,
    voices: 3,
    gap: 0.06,
    layers: [noise(0.12, 1, LP(1800, 500)), tone('sine', 220, 70, 0.08, 0.6), noise(0.2, 0.35, BP(900, 400, 1.2), { delay: 0.03 })],
  },
  'ring/act/pot-tell': {
    vol: 0.6,
    voices: 2,
    gap: 0.25,
    layers: [...clack(2200, 0.5, 0, 0.012), tone('sine', 300, 180, 0.12, 0.5, { delay: 0.08 }), tone('sine', 260, 160, 0.12, 0.4, { delay: 0.2 })],
  },
  'ring/act/pot': {
    vol: 0.75,
    voices: 2,
    gap: 0.1,
    layers: [...clack(1700, 0.7, 0, 0.03), noise(0.18, 0.5, LP(1200, 400), { delay: 0.02 }), tone('sine', 160, 90, 0.15, 0.4, { delay: 0.02 })],
  },
  'ring/act/glue-stick': {
    vol: 0.7,
    voices: 2,
    gap: 0.2,
    layers: [noise(0.25, 0.7, BP(500, 250, 2)), tone('sine', 140, 90, 0.22, 0.5, { vibrato: { rate: 18, depth: 1.5 } })],
  },
  'ring/act/glue-slap': {
    vol: 1.2,
    voices: 2,
    gap: 0.1,
    layers: [noise(0.07, 1, BP(1200, 600, 1)), noise(0.15, 0.4, LP(700), { delay: 0.04 })],
  },
  'ring/act/can-tell': {
    vol: 1.4,
    voices: 2,
    gap: 0.3,
    layers: [0, 0.09, 0.18].flatMap((t) => [noise(0.08, 1, BP(800, 1200, 1.2), { delay: t }), ...clack(1900, 0.5, t + 0.05, 0.012)]),
  },
  'ring/act/can': {
    vol: 0.8,
    voices: 3,
    gap: 0.08,
    layers: [...clack(2600, 0.8, 0, 0.02), tone('triangle', 1300, 900, 0.12, 0.3), noise(0.18, 0.55, LP(1600, 500), { delay: 0.03 })],
  },
  'ring/act/can-hit': {
    vol: 0.8,
    voices: 2,
    gap: 0.08,
    layers: [tone('triangle', 900, 600, 0.1, 0.6), ...clack(1800, 0.5, 0, 0.02), noise(0.12, 0.4, LP(1400), { delay: 0.02 })],
  },
  'ring/act/shout-tell': {
    vol: 1.2,
    voices: 1,
    gap: 0.4,
    layers: [...clack(3000, 0.4, 0, 0.01), noise(0.35, 0.9, BP(700, 1500, 0.8), { delay: 0.05, env: { a: 0.15, d: 0.2 } })],
  },
  'ring/act/shout': {
    vol: 0.65,
    voices: 2,
    gap: 0.25,
    drive: 2,
    filter: HP(140),
    layers: [
      { wave: 'saw', freq: 190, env: { a: 0.01, d: 0.05, s: 0.8, hold: 0.28, r: 0.06 }, vol: 0.6, filter: BP(900, 700, 1.5), bend: [[0, 2], [0.1, 0], [0.34, -3]] },
      { wave: 'square', freq: 380, env: { a: 0.01, d: 0.05, s: 0.6, hold: 0.28, r: 0.06 }, vol: 0.25, filter: BP(2200, undefined, 2) },
    ],
  },
  'ring/act/push': {
    vol: 0.6,
    voices: 2,
    gap: 0.1,
    layers: [tone('sine', 120, 50, 0.16, 0.8), noise(0.12, 0.35, LP(600))],
  },
  'ring/act/squeal-tell': {
    vol: 0.5,
    voices: 1,
    gap: 0.5,
    layers: [{ wave: 'sine', freq: 1800, to: 3200, sweep: 0.5, env: { a: 0.2, d: 0.05, s: 0.9, hold: 0.25, r: 0.05 }, vol: 0.5, vibrato: { rate: 9, depth: 0.4 } }],
  },
  'ring/act/squeal': {
    vol: 0.4,
    voices: 1,
    gap: 0.4,
    layers: [
      { wave: 'sine', freq: 3300, env: { a: 0.01, d: 0.05, s: 0.9, hold: 0.32, r: 0.1 }, vol: 0.6, vibrato: { rate: 14, depth: 0.6 } },
      { wave: 'square', freq: 1650, env: { a: 0.01, d: 0.05, s: 0.5, hold: 0.3, r: 0.1 }, vol: 0.15, filter: HP(1200), duty: 0.3 },
    ],
  },
  'ring/act/squeal-out': {
    vol: 0.4,
    voices: 1,
    gap: 0.4,
    layers: [{ wave: 'sine', freq: 3000, to: 900, sweep: 0.45, env: { a: 0.01, d: 0.45 }, vol: 0.6, vibrato: { rate: 16, depth: 0.8 } }, ...clack(1500, 0.5, 0.42, 0.03)],
  },
  'ring/act/rip': {
    vol: 0.75,
    voices: 2,
    gap: 0.3,
    layers: [noise(0.38, 0.9, BP(2400, 900, 1.6), { tremolo: { rate: 45, depth: 0.7 } }), noise(0.08, 0.5, HP(3000), { delay: 0.34 })],
  },
  'ring/act/snap': {
    vol: 0.8,
    voices: 2,
    gap: 0.2,
    layers: [...clack(3200, 0.9, 0, 0.02), tone('triangle', 2100, 1500, 0.2, 0.25), ...[0.08, 0.15, 0.21, 0.26].flatMap((t, i) => clack(2600 - i * 200, 0.35, t, 0.012))],
  },
  'ring/act/huff': {
    vol: 0.5,
    voices: 1,
    gap: 0.5,
    layers: [{ wave: 'triangle', freq: 210, env: { a: 0.01, d: 0.04, s: 0.7, hold: 0.12, r: 0.05 }, vol: 0.6, filter: LP(1100), bend: [[0, 2], [0.18, -4]] }, noise(0.14, 0.25, BP(1800, 900, 1))],
  },
  'ring/act/hum': {
    vol: 0.3,
    voices: 1,
    gap: 1.6,
    layers: seq(
      [
        [262, 0.22],
        [294, 0.22],
        [330, 0.3],
        [294, 0.22],
        [262, 0.4],
      ],
      (f, len, delay) => note('triangle', f, len * 0.85, 0.5, delay, { filter: LP(900), vibrato: { rate: 5, depth: 0.15 } }),
    ),
  },
  'ring/act/sit': {
    vol: 0.6,
    voices: 2,
    gap: 0.2,
    layers: [tone('sine', 110, 55, 0.12, 0.8), noise(0.08, 0.45, LP(900))],
  },
  'ring/act/whistle': {
    vol: 0.45,
    voices: 1,
    gap: 0.8,
    layers: [0, 0.22].map((t) => ({ wave: 'sine' as const, freq: 2900, env: { a: 0.01, d: 0.02, s: 0.9, hold: 0.15, r: 0.03 }, vol: 0.6, delay: t, tremolo: { rate: 32, depth: 0.6 } })),
  },
  'ring/act/lift': {
    vol: 0.55,
    voices: 1,
    gap: 0.4,
    layers: [{ wave: 'triangle', freq: 150, env: { a: 0.02, d: 0.04, s: 0.6, hold: 0.12, r: 0.05 }, vol: 0.5, filter: LP(800), bend: [[0, 0], [0.16, 3]] }, noise(0.2, 0.25, BP(400, 300, 3), { delay: 0.1 })],
  },
};
