// Synth sounds of mission ring, revision R (docs/design/ring.md §R.3, §R.8): owner TRAIN-2 — the
// ZWAAN train's car transporter, tanker and livestock trailer. Spread into SFX in sfx/index.ts.
// Synth recipes only (no samples, no generated audio in wave A; wave B may add takes with these as
// the fallbacks).
//
// Tells (they start on the first tell tick, GDD §4.11 rule 2): `ring/zwaan/hydraulic` (the ramp /
// the upper deck: a pump whine and a hiss), `ring/zwaan/creak` (a broken ram's deck: a strained
// creak), `ring/zwaan/valve` (the tanker's dump valve / a hot valve: a squeal and a hiss),
// `ring/zwaan/gate` (the livestock gate unlatching: a clank and a rattle), `ring/zwaan/farm-throw`
// (the farmhand's grunt and the swing).
// Cues: `ring/zwaan/car-roll` (a car rolls off: tyres on steel, a rumble), `ring/zwaan/car-bounce`
// (a car lands: a body thump, a rattle), `ring/zwaan/ram-snap` (a ram bursts: a crack and a gush),
// `ring/zwaan/fat-hiss` (frying fat sizzling), `ring/zwaan/fat-spray` (the hose's jet),
// `ring/zwaan/fat-skid` (a wagon slides on the slick: a squeal), `ring/zwaan/flame-whoosh` (the
// flame trail catches), `ring/zwaan/fireball` (the tanker's end: a deep whump and the roar),
// `ring/zwaan/moo`, `ring/zwaan/oink`, `ring/zwaan/hooves` (a few clops), `ring/zwaan/bale-thud`
// (a hay bale lands), `ring/zwaan/churn-clang` (a milk churn lands: a ring and a splash).
import { BP, clack, fmBell, hits, HP, LP, noise, scatter, tone, type Recipes } from './kit';

const RATTLE = scatter(8, 23);

export const RING_ZWAAN_B: Recipes = {
  'ring/zwaan/hydraulic': {
    vol: 0.6,
    voices: 2,
    gap: 0.3,
    layers: [
      // The pump's whine rising, the oil's hiss through the valve, a thump at the end of the stroke.
      { wave: 'saw', freq: 180, to: 260, sweep: 0.45, env: { a: 0.04, d: 0.05, s: 0.7, hold: 0.32, r: 0.1 }, vol: 0.28, filter: BP(600, 900, 2) },
      { wave: 'noise', env: { a: 0.02, d: 0.05, s: 0.6, hold: 0.36, r: 0.15 }, vol: 0.45, filter: HP(3000, 4200) },
      tone('sine', 90, 55, 0.1, 0.45, { delay: 0.42 }),
    ],
  },
  'ring/zwaan/creak': {
    vol: 1.0,
    voices: 1,
    gap: 0.4,
    layers: [
      { wave: 'saw', freq: 140, to: 110, sweep: 0.5, env: { a: 0.02, d: 0.02, s: 0.7, hold: 0.4, r: 0.1 }, vol: 0.68, vibrato: { rate: 17, depth: 1.2 }, filter: BP(650, 450, 2.2) },
      noise(0.3, 0.34, LP(600)),
    ],
  },
  'ring/zwaan/car-roll': {
    vol: 0.6,
    voices: 2,
    gap: 0.2,
    layers: [
      // Tyres rumbling down a steel ramp (a ribbed tremolo), a low body rumble.
      { wave: 'noise', env: { a: 0.03, d: 0.05, s: 0.6, hold: 0.55, r: 0.15 }, vol: 0.45, filter: LP(520), tremolo: { rate: 14, rateTo: 22, depth: 0.7 } },
      { wave: 'triangle', freq: 70, to: 55, env: { a: 0.04, d: 0.05, s: 0.7, hold: 0.5, r: 0.15 }, vol: 0.35 },
      ...clack(900, 0.25, 0.05, 0.02),
    ],
  },
  'ring/zwaan/car-bounce': {
    vol: 0.7,
    voices: 3,
    gap: 0.08,
    drive: 0.4,
    layers: [
      tone('sine', 85, 40, 0.22, 0.9),
      noise(0.18, 0.55, LP(1100, 400)),
      ...fmBell(210, 0.3, 0.18, { ratio: 1.41, index: 3 }),
      ...RATTLE.map((t, i) => clack(1500 + (i % 3) * 260, 0.22, 0.04 + t * 0.25, 0.015)).flat(),
    ],
  },
  'ring/zwaan/ram-snap': {
    vol: 0.7,
    voices: 1,
    gap: 0.3,
    drive: 0.5,
    layers: [...clack(1800, 0.8, 0, 0.03), tone('square', 400, 120, 0.08, 0.4), noise(0.5, 0.5, BP(1800, 900, 0.9), { delay: 0.02 })],
  },
  'ring/zwaan/fat-hiss': {
    vol: 0.5,
    voices: 2,
    gap: 0.15,
    layers: [
      // Sizzling: crackly bright noise with fast ticks.
      { wave: 'noise', env: { a: 0.01, d: 0.05, s: 0.6, hold: 0.25, r: 0.12 }, vol: 0.5, filter: HP(4200, 6000), tremolo: { rate: 31, depth: 0.6 } },
      ...hits(5, 0.02, 0.05, 1.3).flatMap((t, i) => clack(3200 + i * 300, 0.15, t, 0.008)),
    ],
  },
  'ring/zwaan/fat-spray': {
    vol: 0.85,
    voices: 1,
    gap: 0.4,
    layers: [
      { wave: 'noise', env: { a: 0.04, d: 0.05, s: 0.75, hold: 0.6, r: 0.2 }, vol: 0.77, filter: BP(1300, 900, 0.7) },
      { wave: 'noise', env: { a: 0.04, d: 0.05, s: 0.5, hold: 0.6, r: 0.2 }, vol: 0.42, filter: LP(300), tremolo: { rate: 7, depth: 0.5 } },
    ],
  },
  'ring/zwaan/fat-skid': {
    vol: 0.9,
    voices: 2,
    gap: 0.3,
    layers: [
      { wave: 'saw', freq: 1300, to: 900, env: { a: 0.02, d: 0.04, s: 0.6, hold: 0.3, r: 0.12 }, vol: 0.4, vibrato: { rate: 19, depth: 0.6 }, filter: BP(1400, 1000, 2.5) },
      noise(0.35, 0.48, BP(2400, 1500, 1.2)),
    ],
  },
  'ring/zwaan/valve': {
    vol: 0.55,
    voices: 2,
    gap: 0.25,
    layers: [
      { wave: 'square', freq: 1500, to: 1150, env: { a: 0.01, d: 0.04, s: 0.5, hold: 0.18, r: 0.08 }, vol: 0.18, filter: BP(1400, undefined, 3) },
      { wave: 'noise', env: { a: 0.01, d: 0.04, s: 0.7, hold: 0.35, r: 0.2 }, vol: 0.5, filter: HP(3500, 5000) },
      ...clack(700, 0.3, 0, 0.02),
    ],
  },
  'ring/zwaan/flame-whoosh': {
    vol: 0.75,
    voices: 2,
    gap: 0.25,
    drive: 0.3,
    layers: [
      { wave: 'noise', env: { a: 0.05, d: 0.1, s: 0.6, hold: 0.35, r: 0.3 }, vol: 0.7, filter: BP(500, 1600, 0.6) },
      { wave: 'noise', env: { a: 0.08, d: 0.1, s: 0.5, hold: 0.4, r: 0.3 }, vol: 0.4, filter: LP(260), tremolo: { rate: 11, depth: 0.5 } },
      tone('sine', 70, 50, 0.3, 0.4),
    ],
  },
  'ring/zwaan/fireball': {
    vol: 0.8,
    voices: 1,
    gap: 0.6,
    drive: 0.8,
    layers: [
      tone('sine', 60, 28, 0.7, 1),
      noise(1.1, 0.75, LP(1800, 200)),
      { wave: 'noise', env: { a: 0.1, d: 0.2, s: 0.5, hold: 0.6, r: 0.5 }, vol: 0.45, filter: BP(400, 200, 0.5), tremolo: { rate: 9, depth: 0.4 } },
    ],
  },
  'ring/zwaan/gate': {
    vol: 0.65,
    voices: 2,
    gap: 0.2,
    layers: [...clack(1100, 0.6, 0, 0.025), ...fmBell(380, 0.35, 0.22, { ratio: 1.41, index: 3, delay: 0.01 }), ...RATTLE.map((t, i) => clack(1700 + (i % 3) * 200, 0.2, 0.06 + t * 0.3, 0.012)).flat()],
  },
  'ring/zwaan/moo': {
    vol: 0.85,
    voices: 2,
    gap: 0.5,
    layers: [
      // A cow's call: a low buzzy voice through two vowel formants, rising then sinking (our own recipe).
      { wave: 'saw', freq: 118, env: { a: 0.08, d: 0.1, s: 0.85, hold: 0.55, r: 0.25 }, vol: 0.65, bend: [[0, -1], [0.18, 1.5], [0.6, -2.5]], vibrato: { rate: 5, depth: 0.25, delay: 0.2 }, filter: BP(520, 380, 2.4) },
      { wave: 'saw', freq: 118, env: { a: 0.08, d: 0.1, s: 0.85, hold: 0.55, r: 0.25 }, vol: 0.39, bend: [[0, -1], [0.18, 1.5], [0.6, -2.5]], filter: BP(900, 700, 3) },
      { wave: 'noise', env: { a: 0.1, d: 0.1, s: 0.4, hold: 0.5, r: 0.2 }, vol: 0.1, filter: BP(1200, 800, 1.5) },
    ],
  },
  'ring/zwaan/oink': {
    vol: 1.0,
    voices: 3,
    gap: 0.25,
    layers: [
      // Two short nasal grunts.
      { wave: 'square', freq: 210, to: 170, env: { a: 0.01, d: 0.03, s: 0.7, hold: 0.07, r: 0.05 }, vol: 0.56, filter: BP(1000, 800, 2.5), duty: 0.3 },
      { wave: 'square', freq: 230, to: 160, env: { a: 0.01, d: 0.03, s: 0.7, hold: 0.09, r: 0.06 }, vol: 0.56, delay: 0.16, filter: BP(950, 700, 2.5), duty: 0.3 },
      noise(0.08, 0.19, BP(1500, undefined, 2)),
      noise(0.1, 0.19, BP(1400, undefined, 2), { delay: 0.16 }),
    ],
  },
  'ring/zwaan/hooves': {
    vol: 0.8,
    voices: 2,
    gap: 0.12,
    layers: hits(4, 0, 0.07, 1.2).flatMap((t, i) => [...clack(900 - (i % 2) * 180, 0.4, t, 0.02), tone('sine', 140, 90, 0.04, 0.25, { delay: t })]),
  },
  'ring/zwaan/farm-throw': {
    vol: 0.95,
    voices: 1,
    gap: 0.3,
    layers: [
      // A grunt (a short voiced burst) and the swish of the swing.
      { wave: 'saw', freq: 160, to: 120, env: { a: 0.01, d: 0.04, s: 0.6, hold: 0.08, r: 0.05 }, vol: 0.48, filter: BP(700, 500, 2) },
      noise(0.2, 0.56, BP(900, 2400, 1), { delay: 0.05 }),
    ],
  },
  'ring/zwaan/bale-thud': {
    vol: 0.6,
    voices: 3,
    gap: 0.08,
    layers: [tone('sine', 80, 50, 0.14, 0.8), noise(0.25, 0.5, LP(900, 400)), noise(0.3, 0.25, HP(3000), { delay: 0.03 })],
  },
  'ring/zwaan/churn-clang': {
    vol: 0.65,
    voices: 3,
    gap: 0.08,
    drive: 0.3,
    layers: [...fmBell(520, 0.5, 0.35, { ratio: 2.76, index: 3 }), ...clack(1300, 0.5, 0, 0.02), noise(0.3, 0.3, BP(900, 500, 0.8), { delay: 0.05 })],
  },
};
