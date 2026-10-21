// Synth sounds of mission ring, area 'convoy' (docs/design/ring.md §5.3, §11; wave B): the scan car,
// the tow truck and the handhaver motorbike. Spread into SFX in sfx/index.ts. Synth recipes only (no
// samples, no generated audio). Owner: the CONVOY builder.
//
// Telegraphs start on the first tell tick (GDD §4.11 rule 2): `ring/scan-beep` (the roof box's
// two-tone chirp; repeated every 10 ticks while the scan line sweeps), `ring/hook-swing` (the hook
// whooshing out on its cable; again at the cast), `ring/baton-draw` (the baton pulled from the belt:
// a leather slide and a snap), `ring/sticker-peel` (the backing peeled off a fine card; also the
// sticker shaken off the glass).
// Cues: `ring/scan-lock` (the strip locks: a falling electronic sweep over a low buzz),
// `ring/indicator` (the tow truck's indicator relay tick-tock before it merges in), `ring/hook-clank`
// (the hook bites the push bar / pops off / clanks on the road), `ring/winch` (the winch motor
// hauling the cable, a ratchet), `ring/cable-snap` (the cable shot through: a twang), `ring/moto-whine`
// (a four-stroke motorbike passing up, lower and rounder than the scooter), `ring/baton-swing` (a
// swish), `ring/sticker-slap` (a wet slap on the glass and a paper crinkle). The breakdown reuses
// `ams/airbag`, the gloat `ams/gloat-scribble`, a rider's fall `ring/scooter-crash` / `-down`.
import { BP, clack, fmBell, hits, HP, LP, noise, tone, type Recipes } from './kit';

export const RING_CONVOY: Recipes = {
  'ring/scan-beep': {
    vol: 0.5,
    voices: 2,
    gap: 0.12,
    layers: hits(2, 0, 0.07).map((t, i) => ({
      wave: 'square' as const,
      freq: i === 0 ? 1568 : 2093,
      env: { a: 0.002, d: 0.01, s: 0.8, hold: 0.04, r: 0.012 },
      vol: 0.5,
      delay: t,
      filter: BP(i === 0 ? 1900 : 2500, undefined, 1.1),
    })),
  },
  'ring/scan-lock': {
    vol: 0.55,
    voices: 1,
    gap: 0.4,
    layers: [
      { wave: 'saw', freq: 1400, to: 380, sweep: 0.32, env: { a: 0.005, d: 0.02, s: 0.8, hold: 0.3, r: 0.05 }, vol: 0.4, filter: BP(1600, 700, 1.4) },
      { wave: 'square', freq: 110, env: { a: 0.02, d: 0.02, s: 0.7, hold: 0.36, r: 0.08 }, vol: 0.22, filter: LP(900), tremolo: { rate: 24, depth: 0.6, shape: 'square', width: 0.5 } },
      ...fmBell(2093, 0.12, 0.2, { ratio: 2, index: 1.5, delay: 0.34 }),
    ],
  },
  'ring/indicator': {
    vol: 1.75,
    voices: 1,
    gap: 0.15,
    layers: [...clack(2200, 0.4, 0, 0.012), ...clack(1500, 0.35, 0.09, 0.014)],
  },
  'ring/hook-swing': {
    vol: 2.2,
    voices: 2,
    gap: 0.1,
    layers: [noise(0.26, 0.8, BP(500, 1500, 1.4)), noise(0.18, 0.35, BP(1400, 2600, 2), { delay: 0.05 }), ...clack(1900, 0.18, 0.02, 0.01)],
  },
  'ring/hook-clank': {
    vol: 0.55,
    voices: 3,
    gap: 0.06,
    layers: [tone('sine', 220, 90, 0.1, 0.7), ...clack(1100, 0.6, 0, 0.025), ...fmBell(1660, 0.24, 0.22, { ratio: 2.76, index: 2.2, delay: 0.01 }), noise(0.04, 0.4, HP(2800))],
  },
  'ring/winch': {
    vol: 0.35,
    voices: 1,
    gap: 0.35,
    drive: 0.5,
    layers: [
      { wave: 'saw', freq: 95, to: 120, sweep: 0.45, env: { a: 0.03, d: 0.02, s: 0.85, hold: 0.42, r: 0.06 }, vol: 0.5, filter: LP(1100, 1500, 1.3), tremolo: { rate: 30, depth: 0.4, shape: 'saw', width: 0.5 } },
      ...hits(6, 0.02, 0.08).flatMap((t) => clack(1800, 0.22, t, 0.01)),
    ],
  },
  'ring/cable-snap': {
    vol: 0.6,
    voices: 2,
    gap: 0.2,
    layers: [
      noise(0.03, 0.8, HP(2500)),
      { wave: 'triangle', freq: 330, bend: [[0, 0], [0.04, 7], [0.4, -5]], env: { a: 0.002, d: 0.05, s: 0.5, hold: 0.12, r: 0.25 }, vol: 0.55, vibrato: { rate: 18, depth: 0.6 } },
      ...clack(900, 0.35, 0.06, 0.02),
    ],
  },
  'ring/moto-whine': {
    vol: 0.26,
    voices: 2,
    gap: 0.6,
    drive: 0.4,
    layers: [
      { wave: 'saw', freq: 92, bend: [[0, 0], [0.3, 5], [0.7, 8], [0.9, 6]], env: { a: 0.08, d: 0.05, s: 0.85, hold: 0.62, r: 0.18 }, vol: 0.8, filter: LP(900, 1500, 1.2), tremolo: { rate: 22, rateTo: 34, depth: 0.45, shape: 'saw', width: 0.5 } },
      { wave: 'square', freq: 46, bend: [[0, 0], [0.3, 5], [0.7, 8], [0.9, 6]], env: { a: 0.08, d: 0.05, s: 0.8, hold: 0.62, r: 0.18 }, vol: 0.3, filter: LP(420) },
      noise(0.85, 0.15, BP(1700, undefined, 1.2), { env: { a: 0.08, d: 0.05, s: 0.6, hold: 0.62, r: 0.18 } }),
    ],
  },
  'ring/baton-draw': {
    vol: 1.7,
    voices: 2,
    gap: 0.12,
    layers: [noise(0.14, 0.6, BP(1200, 2400, 1.6)), ...clack(1500, 0.45, 0.13, 0.015)],
  },
  'ring/baton-swing': {
    vol: 2.0,
    voices: 2,
    gap: 0.08,
    layers: [noise(0.16, 0.9, BP(600, 1800, 1.8)), tone('sine', 180, 120, 0.1, 0.2)],
  },
  'ring/sticker-slap': {
    vol: 0.75,
    voices: 2,
    gap: 0.1,
    layers: [tone('sine', 260, 110, 0.06, 0.7), noise(0.05, 0.8, BP(1100, 600, 0.9)), noise(0.12, 0.3, HP(3600), { delay: 0.05 })],
  },
  'ring/sticker-peel': {
    vol: 1.15,
    voices: 2,
    gap: 0.12,
    layers: [noise(0.16, 0.55, BP(3400, 5200, 1.2)), noise(0.08, 0.3, HP(4500), { delay: 0.1 })],
  },
};
