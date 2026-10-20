// Synth sounds of mission ams, area 'stag' (docs/design/ams-extras.md §2, §8): the stag party and
// the beer bike. Spread into SFX in sfx/index.ts.
//
// - `ams/cork-shake` — the partier's TELL 24: a bottle shaken hard (glass knocks in a rhythm that
//   speeds up) over a rising fizz, 0.4 s (24 ticks; start it on the first tell tick).
// - `ams/cork-pop` — the cork leaves: a hollow pop with a short foam spray.
// - `ams/cork-cannon` — the beer bike's tap gun (cooldown 6): a short, quiet pop.
// - `ams/clink` — two bottles clink (the `toast` gag).
// - `ams/foam` — the foam spray (fire + bomb) and a partier's bottle foaming over.
// - `ams/keg-roll` — a keg rolling over cobbles (thumps and a hollow wooden rumble).
// - `ams/beer-bell` — the bike's handlebar bell (the empty gag).
// - `ams/beer-creak` — the wooden bike creaks and rattles (the ram's run).
import { BP, fmBell, HP, LP, noise, tone, type Recipes } from './kit';

/** One glass knock of the shake (a damped bottle thunk + a bright tick). */
const knock = (delay: number, vol: number) => [
  tone('sine', 520, 380, 0.035, vol, { delay }),
  noise(0.012, vol * 0.5, BP(3200, undefined, 2), { delay }),
];

export const AMS_STAG: Recipes = {
  'ams/cork-shake': {
    vol: 0.6,
    voices: 2,
    gap: 0.2,
    layers: [
      // The fizz rising under the hand.
      { wave: 'noise', env: { a: 0.08, d: 0.05, s: 0.8, hold: 0.22, r: 0.05 }, vol: 0.45, filter: HP(2400, 5200) },
      // Knocks that speed up: 7 in 0.38 s.
      ...[0, 0.075, 0.14, 0.195, 0.245, 0.29, 0.33].flatMap((t, i) => knock(t, 0.55 + i * 0.05)),
    ],
  },
  'ams/cork-pop': {
    vol: 0.75,
    voices: 3,
    gap: 0.06,
    layers: [
      // The pop: a hollow sine drop with a sharp transient.
      tone('sine', 900, 180, 0.07, 1, { sweep: 0.03 }),
      noise(0.012, 0.8, BP(2200, undefined, 1.2)),
      // Foam hiss after it.
      { wave: 'noise', env: { a: 0.01, d: 0.18 }, vol: 0.35, delay: 0.03, filter: HP(3000, 6000) },
    ],
  },
  'ams/cork-cannon': {
    vol: 0.45,
    voices: 3,
    gap: 0.05,
    layers: [tone('sine', 820, 240, 0.05, 0.9, { sweep: 0.02 }), noise(0.01, 0.6, BP(2600, undefined, 1.4))],
  },
  'ams/clink': {
    vol: 0.5,
    voices: 2,
    gap: 0.15,
    layers: [...fmBell(2350, 0.22, 0.6, { ratio: 2.4, index: 2.5, octave: 0.3 }), ...fmBell(2620, 0.18, 0.4, { ratio: 2.7, index: 2, delay: 0.012 })],
  },
  'ams/foam': {
    vol: 0.55,
    voices: 2,
    gap: 0.1,
    layers: [
      { wave: 'noise', env: { a: 0.01, d: 0.08, s: 0.6, hold: 0.14, r: 0.12 }, vol: 0.8, filter: HP(1800, 4200) },
      // Bubbles: a few quick blips.
      ...[0.04, 0.11, 0.17, 0.26].map((t, i) => tone('sine', 1400 + i * 260, 2200 + i * 200, 0.025, 0.25, { delay: t })),
    ],
  },
  'ams/keg-roll': {
    vol: 0.6,
    voices: 2,
    gap: 0.12,
    layers: [
      tone('sine', 95, 70, 0.12, 0.9),
      { wave: 'noise', env: { a: 0.005, d: 0.14 }, vol: 0.45, filter: LP(700) },
      tone('triangle', 180, 150, 0.06, 0.35, { delay: 0.1 }),
      noise(0.03, 0.3, BP(500, undefined, 1.5), { delay: 0.1 }),
    ],
  },
  'ams/beer-bell': {
    vol: 0.32,
    voices: 1,
    gap: 0.3,
    layers: [...fmBell(1850, 0.35, 0.7, { ratio: 3.2, index: 3 }), ...fmBell(1850, 0.4, 0.75, { ratio: 3.2, index: 3, delay: 0.14 })],
  },
  'ams/beer-creak': {
    vol: 0.9,
    voices: 1,
    gap: 0.3,
    layers: [
      { wave: 'saw', freq: 140, to: 210, sweep: 0.35, env: { a: 0.04, d: 0.1, s: 0.6, hold: 0.2, r: 0.08 }, vol: 1.0, filter: BP(900, 1300, 1.2), tremolo: { rate: 22, rateTo: 14, depth: 0.8, shape: 'saw' } },
      { wave: 'noise', env: { a: 0.01, d: 0.3 }, vol: 0.8, filter: BP(1600, undefined, 1.2), tremolo: { rate: 18, depth: 0.9, shape: 'square' } },
    ],
  },
};
