// Synth sounds of mission ams, area 'route' (docs/design/ams-extras.md §4, §8): the canal cruise
// of section c2. Spread into SFX in sfx/index.ts.
//
// - `ams/route-horn`: the tour boat's horn (departure; a low bridge comes into view): two short
//   blasts of a reedy two-tone horn, 1.1 s.
// - `ams/route-bell`: the Magere Brug's warning bell (it opens): a fast electric bell ringing for
//   1.4 s.
// - `ams/route-creak`: the bascule lifting: a wooden creak and groan over a motor hum, 1.6 s.
// - `ams/route-bump`: the boat docks at the Waterlooplein jetty: a soft hull thud on the
//   fenders and a rope creak, 0.6 s.
import { BP, clack, hits, LP, noise, tone, type Recipes } from './kit';

/** One horn blast at `delay`: two detuned reedy saws a minor third apart, a breathy onset. */
function blast(delay: number, len: number): Recipes[string]['layers'] {
  return [
    { wave: 'saw', freq: 196, env: { a: 0.03, d: 0.05, s: 0.85, hold: len, r: 0.08 }, vol: 0.32, delay, filter: LP(1200) },
    { wave: 'saw', freq: 233, env: { a: 0.03, d: 0.05, s: 0.85, hold: len, r: 0.08 }, vol: 0.26, delay, filter: LP(1200) },
    { wave: 'square', freq: 98, env: { a: 0.04, d: 0.05, s: 0.7, hold: len, r: 0.08 }, vol: 0.14, delay, filter: LP(500) },
    noise(0.08, 0.18, BP(900, undefined, 1.2), { delay }),
  ];
}

export const AMS_ROUTE: Recipes = {
  'ams/route-horn': {
    vol: 0.6,
    voices: 1,
    gap: 1,
    layers: [...blast(0, 0.28), ...blast(0.5, 0.42)],
  },
  'ams/route-bell': {
    vol: 0.6,
    voices: 1,
    gap: 1.2,
    // A striker hammering a small gong at ~16 Hz, swelling in and out.
    layers: hits(22, 0, 0.062).flatMap((t, i) => [
      tone('sine', 1760, 1740, 0.07, 0.35 * Math.sin(((i + 1) / 23) * Math.PI), { delay: t }),
      tone('sine', 4210, 4180, 0.04, 0.12 * Math.sin(((i + 1) / 23) * Math.PI), { delay: t }),
    ]),
  },
  'ams/route-creak': {
    vol: 0.8,
    voices: 1,
    gap: 1.4,
    layers: [
      { wave: 'saw', freq: 55, to: 62, sweep: 1.5, env: { a: 0.2, d: 0.2, s: 0.8, hold: 1.0, r: 0.3 }, vol: 0.2, filter: LP(300) },
      { wave: 'noise', env: { a: 0.3, d: 0.2, s: 0.6, hold: 0.9, r: 0.3 }, vol: 0.12, filter: BP(240, undefined, 2) },
      // The wooden groans: slow pitch-bent squeaks.
      tone('square', 180, 140, 0.35, 0.12, { delay: 0.2, filter: BP(700, undefined, 3) }),
      tone('square', 150, 205, 0.4, 0.1, { delay: 0.8, filter: BP(650, undefined, 3) }),
      ...clack(420, 0.3, 1.35, 0.03),
    ],
  },
  'ams/route-bump': {
    vol: 0.55,
    voices: 1,
    gap: 0.5,
    layers: [
      tone('sine', 90, 55, 0.18, 0.6),
      noise(0.12, 0.35, LP(400)),
      tone('square', 260, 210, 0.22, 0.08, { delay: 0.18, filter: BP(800, undefined, 3) }),
    ],
  },
};
