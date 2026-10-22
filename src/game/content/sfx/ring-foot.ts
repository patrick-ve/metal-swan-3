// Synth sounds of mission ring, revision R (docs/design/ring.md §R.4, §R.5, §R.8): owner JAM+FOOT
// (the final jam, the alight scene, rf-a DE FILE and the ring gangs on foot). Spread into SFX in
// sfx/index.ts. Synth recipes only (no samples, no generated audio in wave A; wave B may add takes).
//
// The jam and the alight: `ring/foot/door` (a wagon door's latch and a hollow clunk: a hero climbs
// out), `ring/foot/land` (a hero's boots on the asphalt after the jump), `ring/foot/honk` (one
// driver in the standing queue leans on the horn: the jam's ambience in rf-a).
// The gangs on foot (telegraphs start on the first tell tick, GDD §4.11 rule 2; the riders reuse
// RING_ROAD's `ring/pistol-cock` and `ring/bottle-tell`, the couriers RING_GANGS' `ring/parcel-lift`):
// `ring/foot/pistol` (a small dry pistol shot), `ring/foot/pump` (the van crew racks the shotgun:
// its tell), `ring/foot/shotgun` (the burst: a wide low crack), `ring/foot/crowbar-tell` (the crowbar
// scraped up off the asphalt), `ring/foot/crowbar` (the swing: a whoosh and a steel clang),
// `ring/foot/tumble` (a beaten gang member rolls over the asphalt: soft thumps), `ring/foot/dazed`
// (the little spinning-stars warble while he sits dazed), `ring/foot/tape` (the police tape snaps
// and flutters at the end of rf-a).
import { BP, clack, fmBell, hits, HP, LP, noise, tone, type Recipes } from './kit';

export const RING_FOOT: Recipes = {
  'ring/foot/door': {
    vol: 0.85,
    voices: 2,
    gap: 0.2,
    layers: [
      ...clack(1300, 0.45, 0, 0.015),
      tone('triangle', 190, 110, 0.15, 0.8, { delay: 0.03, filter: LP(1400) }),
      noise(0.07, 0.4, BP(650, 380, 1.2), { delay: 0.03 }),
    ],
  },
  'ring/foot/land': {
    vol: 0.8,
    voices: 2,
    gap: 0.08,
    layers: [tone('sine', 120, 55, 0.1, 0.9), noise(0.06, 0.6, LP(1100)), noise(0.05, 0.3, BP(2600, 1800, 1.4), { delay: 0.01 })],
  },
  'ring/foot/honk': {
    vol: 0.4,
    voices: 1,
    gap: 1.2,
    layers: [
      { wave: 'square', freq: 415, env: { a: 0.01, d: 0.03, s: 0.85, hold: 0.32, r: 0.05 }, vol: 0.5, filter: BP(1200, undefined, 0.9) },
      { wave: 'square', freq: 523, env: { a: 0.01, d: 0.03, s: 0.85, hold: 0.32, r: 0.05 }, vol: 0.4, filter: BP(1400, undefined, 0.9) },
    ],
  },
  'ring/foot/pistol': {
    vol: 0.7,
    voices: 3,
    gap: 0.06,
    layers: [noise(0.05, 1, BP(2400, 900, 0.9)), tone('sine', 180, 60, 0.07, 0.7), noise(0.12, 0.25, HP(3500), { delay: 0.02 })],
  },
  'ring/foot/pump': {
    vol: 1.2,
    voices: 2,
    gap: 0.2,
    layers: [...clack(900, 0.55, 0, 0.025), noise(0.08, 0.4, BP(1500, 900, 1.4), { delay: 0.02 }), ...clack(1100, 0.6, 0.14, 0.025)],
  },
  'ring/foot/shotgun': {
    vol: 0.8,
    voices: 2,
    gap: 0.1,
    drive: 0.4,
    layers: [noise(0.09, 1, BP(1200, 400, 0.7)), tone('sine', 110, 40, 0.16, 0.9), noise(0.3, 0.3, LP(2400, 600), { delay: 0.03 })],
  },
  'ring/foot/crowbar-tell': {
    vol: 1.1,
    voices: 2,
    gap: 0.3,
    layers: [noise(0.26, 0.7, BP(3200, 1800, 3), { env: { a: 0.03, d: 0.05, s: 0.7, hold: 0.12, r: 0.06 } }), ...fmBell(1760, 0.12, 0.15, { ratio: 2.9, index: 1.4, delay: 0.18 })],
  },
  'ring/foot/crowbar': {
    vol: 0.9,
    voices: 2,
    gap: 0.12,
    layers: [noise(0.14, 0.8, BP(600, 2600, 1.6)), ...fmBell(1180, 0.25, 0.3, { ratio: 2.76, index: 2.5, delay: 0.1 }), ...clack(2400, 0.3, 0.1, 0.02)],
  },
  'ring/foot/tumble': {
    vol: 0.75,
    voices: 2,
    gap: 0.15,
    layers: hits(3, 0, 0.09, 1.2).map((t, i) => tone('sine', 140 - i * 20, 60, 0.08, 0.7 - i * 0.15, { delay: t })),
  },
  'ring/foot/dazed': {
    vol: 0.7,
    voices: 1,
    gap: 0.8,
    layers: hits(4, 0, 0.11).map((t, i) => ({ wave: 'sine' as const, freq: i % 2 ? 1568 : 2093, bend: [[0, 0], [0.08, -3]] as [number, number][], env: { a: 0.005, d: 0.02, s: 0.6, hold: 0.05, r: 0.03 }, vol: 0.5, delay: t })),
  },
  'ring/foot/tape': {
    vol: 0.8,
    voices: 1,
    gap: 0.3,
    layers: [noise(0.06, 0.7, HP(2500)), noise(0.35, 0.35, BP(1800, 900, 1.6), { delay: 0.04, tremolo: { rate: 24, depth: 0.8, shape: 'sine' } })],
  },
};
