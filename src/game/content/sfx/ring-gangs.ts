// Synth sounds of mission ring, area 'gangs' (docs/design/ring.md §5.2, §5.4, §9, §11; wave B): the
// parcel van and the caravan. Spread into SFX in sfx/index.ts. Synth recipes only (no samples, no
// generated audio). Owner: the GANGS builder.
//
// Telegraphs start on the first tell tick (GDD §4.11 rule 2): `ring/parcel-lift` (cardboard scraped
// up off the hold floor: the thrower's tell), `ring/brake-tell` (the brake-light relay ticks and the
// booster hisses: the brake check is coming), `ring/hitch-creak` (the caravan's drawbar groans: it is
// about to come loose). The gunners reuse `ring/pistol-cock` (RING_ROAD).
// Cues: `ring/van-door` (the rear door's latch and its hollow clunk), `ring/parcel-thud` (a parcel
// lands), `ring/parcel-tear` (it bursts: a tear and a paper rustle), `ring/brake-squeal` (the brake
// check: tyres squealing), `ring/van-limp` (a beaten van sputtering, two backfires), `ring/hitch-snap`
// (the hitch breaks: a crack and a clank), `ring/caravan-scrape` (the drawbar grinding on the road),
// `ring/caravan-tip` (it falls on its side: a crash and the crockery inside), `ring/card-slap` (the
// NIET THUIS card slapped on, the gloat).
import { BP, clack, fmBell, hits, HP, LP, noise, tone, type Recipes } from './kit';

export const RING_GANGS: Recipes = {
  'ring/van-door': {
    vol: 0.9,
    voices: 2,
    gap: 0.2,
    layers: [
      ...clack(1500, 0.5, 0, 0.015),
      // The door panel: a hollow sheet-metal clunk with a short ring.
      tone('triangle', 210, 120, 0.16, 0.8, { delay: 0.03, filter: LP(1600) }),
      noise(0.08, 0.45, BP(700, 400, 1.2), { delay: 0.03 }),
      ...fmBell(520, 0.2, 0.12, { delay: 0.04, ratio: 2.76, index: 1.5 }),
      // A short hinge squeak.
      { wave: 'square', freq: 1900, bend: [[0, 0], [0.05, 2], [0.1, -1]], env: { a: 0.01, d: 0.02, s: 0.6, hold: 0.06, r: 0.02 }, vol: 0.12, delay: 0.12, filter: BP(2400, undefined, 3) },
    ],
  },
  'ring/parcel-lift': {
    vol: 1.2,
    voices: 2,
    gap: 0.15,
    layers: [noise(0.22, 0.9, BP(1100, 2400, 1.8), { env: { a: 0.04, d: 0.06, s: 0.7, hold: 0.1, r: 0.06 } }), noise(0.06, 0.4, BP(500, undefined, 1.4), { delay: 0.16 })],
  },
  'ring/parcel-thud': {
    vol: 0.85,
    voices: 3,
    gap: 0.05,
    layers: [tone('sine', 140, 70, 0.12, 1), noise(0.07, 0.6, LP(900)), noise(0.04, 0.25, BP(1500, undefined, 1.2), { delay: 0.01 })],
  },
  'ring/parcel-tear': {
    vol: 0.9,
    voices: 3,
    gap: 0.05,
    layers: [
      noise(0.16, 0.9, BP(2200, 900, 1.2), { tremolo: { rate: 55, depth: 0.7, shape: 'saw' } }),
      noise(0.22, 0.35, HP(4000), { delay: 0.08 }),
      tone('sine', 160, 90, 0.08, 0.5),
    ],
  },
  'ring/brake-tell': {
    vol: 1.1,
    voices: 2,
    gap: 0.4,
    layers: [
      ...hits(2, 0, 0.11).flatMap((t) => clack(2100, 0.45, t, 0.012)),
      noise(0.28, 0.35, HP(3500), { delay: 0.05, env: { a: 0.05, d: 0.05, s: 0.6, hold: 0.12, r: 0.08 } }),
    ],
  },
  'ring/brake-squeal': {
    vol: 0.55,
    voices: 2,
    gap: 0.3,
    layers: [
      { wave: 'square', freq: 1560, bend: [[0, 0], [0.2, -1], [0.5, -2.5]], vibrato: { rate: 13, depth: 0.4 }, env: { a: 0.02, d: 0.05, s: 0.8, hold: 0.38, r: 0.12 }, vol: 0.5, filter: BP(2600, 2000, 2.4) },
      { wave: 'saw', freq: 1180, bend: [[0, 0], [0.5, -2]], env: { a: 0.03, d: 0.05, s: 0.7, hold: 0.36, r: 0.12 }, vol: 0.25, filter: BP(2200, undefined, 3) },
      noise(0.55, 0.4, BP(3000, 1800, 1), { env: { a: 0.02, d: 0.05, s: 0.7, hold: 0.36, r: 0.12 } }),
    ],
  },
  'ring/van-limp': {
    vol: 0.75,
    voices: 2,
    gap: 0.5,
    drive: 0.5,
    layers: [
      // The engine coughing (a gated low saw), two backfire pops.
      { wave: 'saw', freq: 62, to: 44, env: { a: 0.01, d: 0.05, s: 0.8, hold: 0.6, r: 0.15 }, vol: 0.7, filter: LP(700), tremolo: { rate: 9, rateTo: 4, depth: 0.85, shape: 'square' } },
      noise(0.06, 0.9, BP(900, 300, 0.9), { delay: 0.18 }),
      tone('sine', 120, 50, 0.08, 0.7, { delay: 0.18 }),
      noise(0.06, 0.8, BP(800, 300, 0.9), { delay: 0.55 }),
      tone('sine', 110, 45, 0.08, 0.6, { delay: 0.55 }),
    ],
  },
  'ring/hitch-creak': {
    vol: 1,
    voices: 2,
    gap: 0.4,
    layers: [
      // A metal groan: a low saw bending through a narrow band, then two creaks.
      { wave: 'saw', freq: 96, bend: [[0, 0], [0.2, 2], [0.45, -1]], env: { a: 0.04, d: 0.05, s: 0.8, hold: 0.3, r: 0.1 }, vol: 0.8, filter: BP(520, 760, 4) },
      ...clack(900, 0.35, 0.16, 0.03),
      ...clack(700, 0.3, 0.34, 0.03),
    ],
  },
  'ring/hitch-snap': {
    vol: 0.6,
    voices: 2,
    gap: 0.2,
    layers: [
      noise(0.03, 0.8, HP(2500)),
      ...clack(2600, 0.6, 0, 0.02),
      tone('triangle', 330, 150, 0.14, 0.7, { delay: 0.02 }),
      ...fmBell(880, 0.3, 0.22, { delay: 0.03, ratio: 2.76, index: 2.5 }),
      ...clack(600, 0.5, 0.12, 0.03),
    ],
  },
  'ring/caravan-scrape': {
    vol: 0.66,
    voices: 1,
    gap: 0.6,
    layers: [
      noise(0.9, 0.9, BP(2400, 1500, 1.4), { env: { a: 0.03, d: 0.1, s: 0.7, hold: 0.55, r: 0.2 }, tremolo: { rate: 23, depth: 0.45, shape: 'saw' } }),
      { wave: 'saw', freq: 300, bend: [[0, 0], [0.8, -3]], env: { a: 0.03, d: 0.1, s: 0.6, hold: 0.55, r: 0.2 }, vol: 0.25, filter: BP(1200, undefined, 2) },
    ],
  },
  'ring/caravan-tip': {
    vol: 0.6,
    voices: 2,
    gap: 0.3,
    drive: 0.5,
    layers: [
      tone('sine', 85, 38, 0.32, 1),
      noise(0.3, 0.7, BP(1400, 500, 0.8)),
      // The crockery inside: plates and cups rattling.
      ...hits(5, 0.06, 0.045, 1.15).flatMap((t, i) => fmBell(2100 + i * 330, 0.09, 0.14, { delay: t, ratio: 2.4, index: 2 })),
    ],
  },
  'ring/card-slap': {
    vol: 1,
    voices: 2,
    gap: 0.2,
    layers: [noise(0.04, 1, BP(1800, 900, 1.1)), tone('sine', 240, 140, 0.05, 0.5), ...fmBell(1568, 0.12, 0.14, { delay: 0.08, ratio: 2, index: 1.2 })],
  },
};
