// Synth sounds of mission ring, revision R wave B (docs/design/ring.md §R.6, §R.7, §R.8): owner
// BLOCKADE+BOAT — rf-b DE BLOKKADE ('ring/blok/…') and the pink boat DE LAATSTE DRUPPEL
// ('ring/boot/…'). Spread into SFX in sfx/index.ts. Every id has a synth recipe (AUDIO-2 may add
// ElevenLabs takes later, with these as the fallbacks). Telegraphs start on their first tell tick
// (GDD §4.11 rule 2).
//
// The blockade: `ring/blok/chant` (the sitting crowd's wordless chant: a few rising "oh-oh" vowel
// tones and hand claps, ambience), `ring/blok/van` (the parked police van's two-tone whoop, once),
// `ring/blok/tape` (the police tape snaps as a hero walks through).
// The boat: `ring/boot/megaphone` (the leader's megaphone rings: a tap, a hum and a feedback whistle:
// the wave call's tell), `ring/boot/balloon-lift` (a rubber squeak and a slosh: the lob's tell),
// `ring/boot/splat` (a wet paint balloon bursting), `ring/boot/drum-tell` (the sticks clicked together
// twice: the beat's tell), `ring/boot/drum` (the bass drum and the snare together), `ring/boot/shock`
// (the low rumble of the ground shock), `ring/boot/boom-creak` (the boom's gooseneck creaks: its
// tell), `ring/boot/boom` (the boom's whoosh), `ring/boot/feedback` (a loudspeaker's squeal),
// `ring/boot/speaker-break` (a horn crunching), `ring/boot/crack` (the hull cracks: a splintering of
// wood), `ring/boot/mast-fall` (the mast's long creak and the thump), `ring/boot/settle` (the boat
// sags onto its trailer, a tyre hisses), `ring/boot/slide` (the leader slides down the hull: a
// squeaky rub).
import { BP, clack, fmBell, hits, HP, LP, noise, note, tone, type Recipes } from './kit';

export const RING_BOOT: Recipes = {
  // ------------------------------------------------------------------------------- the blockade
  'ring/blok/chant': {
    vol: 0.78,
    voices: 1,
    gap: 2,
    layers: [
      // Two vowel tones ("oh-OH") per bar, a crowd of slightly detuned voices through a vowel filter.
      ...[0, 0.55, 1.1, 1.65].flatMap((t, i) => [
        note('saw', i % 2 ? 247 : 196, 0.38, 0.35, t, { filter: BP(700, undefined, 2.2), vibrato: { rate: 5, depth: 0.012 } }),
        note('saw', i % 2 ? 249.5 : 198, 0.38, 0.28, t + 0.01, { filter: BP(1100, undefined, 2.4) }),
        note('saw', i % 2 ? 165 : 131, 0.38, 0.22, t + 0.02, { filter: BP(520, undefined, 2) }),
      ]),
      // Hand claps on the off-beats.
      ...hits(4, 0.27, 0.55).flatMap((t) => [noise(0.05, 0.5, BP(1400, undefined, 1.4), { delay: t }), noise(0.03, 0.3, HP(3000), { delay: t + 0.008 })]),
    ],
  },
  'ring/blok/van': {
    vol: 0.35,
    voices: 1,
    gap: 2,
    layers: [
      { wave: 'triangle', freq: 660, to: 990, sweep: 0.3, env: { a: 0.02, d: 0.05, s: 0.9, hold: 0.28, r: 0.05 }, vol: 0.6, filter: LP(2600) },
      { wave: 'triangle', freq: 990, to: 660, sweep: 0.3, env: { a: 0.02, d: 0.05, s: 0.9, hold: 0.28, r: 0.08 }, vol: 0.6, delay: 0.34, filter: LP(2600) },
    ],
  },
  'ring/blok/tape': {
    vol: 1.15,
    voices: 1,
    gap: 0.3,
    layers: [noise(0.04, 0.9, BP(2600, undefined, 1.6)), noise(0.25, 0.4, BP(3800, 1600, 3), { delay: 0.03 })],
  },
  // ------------------------------------------------------------------------------- the boat
  'ring/boot/megaphone': {
    vol: 0.6,
    voices: 1,
    gap: 0.3,
    layers: [
      ...clack(900, 0.5, 0, 0.02),
      ...clack(900, 0.45, 0.11, 0.02),
      { wave: 'square', freq: 120, env: { a: 0.01, d: 0.05, s: 0.6, hold: 0.18, r: 0.05 }, vol: 0.25, delay: 0.2, filter: BP(900, undefined, 2) },
      { wave: 'sine', freq: 2400, to: 3100, sweep: 0.25, env: { a: 0.05, d: 0.05, s: 0.8, hold: 0.12, r: 0.06 }, vol: 0.35, delay: 0.24, vibrato: { rate: 9, depth: 0.01 } },
    ],
  },
  'ring/boot/balloon-lift': {
    vol: 0.9,
    voices: 2,
    gap: 0.2,
    layers: [
      { wave: 'square', freq: 900, to: 1500, sweep: 0.08, env: { a: 0.005, d: 0.09 }, vol: 0.8, filter: BP(1600, undefined, 3) },
      noise(0.18, 1, LP(700, 300), { delay: 0.05, env: { a: 0.04, d: 0.14 } }),
    ],
  },
  'ring/boot/splat': {
    vol: 0.75,
    voices: 3,
    gap: 0.05,
    layers: [noise(0.03, 1, BP(1800, undefined, 1)), noise(0.16, 0.6, LP(1200, 300), { delay: 0.01 }), tone('sine', 220, 90, 0.08, 0.4)],
  },
  'ring/boot/drum-tell': {
    // 1.0 (was 0.7): the shock's audible tell must stand out over the boat song (AUDIO-2's mix check).
    vol: 1.0,
    voices: 1,
    gap: 0.25,
    layers: [...clack(2200, 0.6, 0, 0.012), ...clack(2300, 0.6, 0.13, 0.012)],
  },
  'ring/boot/drum': {
    vol: 0.75,
    voices: 2,
    gap: 0.1,
    layers: [
      tone('sine', 110, 46, 0.32, 0.55),
      noise(0.03, 0.6, LP(500)),
      noise(0.14, 0.55, BP(2600, 1800, 0.8), { delay: 0.005 }),
      tone('triangle', 230, 180, 0.06, 0.35, { delay: 0.005 }),
    ],
  },
  'ring/boot/shock': {
    vol: 0.8,
    voices: 2,
    gap: 0.15,
    drive: 0.3,
    layers: [noise(0.5, 0.7, LP(260, 90)), tone('sine', 55, 38, 0.45, 0.6)],
  },
  'ring/boot/boom-creak': {
    vol: 1.25,
    voices: 1,
    gap: 0.4,
    layers: [
      { wave: 'saw', freq: 180, to: 240, sweep: 0.4, env: { a: 0.04, d: 0.05, s: 0.7, hold: 0.3, r: 0.05 }, vol: 0.4, filter: BP(900, undefined, 4), vibrato: { rate: 23, depth: 0.05 } },
      ...clack(700, 0.3, 0.38, 0.02),
    ],
  },
  'ring/boot/boom': {
    vol: 1.1,
    voices: 1,
    gap: 0.3,
    layers: [noise(0.38, 0.8, BP(500, 2200, 1.4), { env: { a: 0.08, d: 0.3 } }), noise(0.2, 0.3, LP(400), { delay: 0.1 })],
  },
  'ring/boot/feedback': {
    vol: 0.4,
    voices: 1,
    gap: 0.3,
    layers: [{ wave: 'sine', freq: 2900, to: 3700, sweep: 0.4, env: { a: 0.02, d: 0.05, s: 0.9, hold: 0.3, r: 0.08 }, vol: 0.6, vibrato: { rate: 12, depth: 0.015 } }],
  },
  'ring/boot/speaker-break': {
    vol: 0.75,
    voices: 2,
    gap: 0.1,
    layers: [...fmBell(780, 0.25, 0.4, { ratio: 1.4, index: 3 }), noise(0.12, 0.7, BP(2200, 700, 1)), ...clack(1200, 0.4, 0.06, 0.03)],
  },
  'ring/boot/crack': {
    vol: 0.8,
    voices: 1,
    gap: 0.4,
    drive: 0.3,
    layers: [
      ...hits(6, 0, 0.05, 0.9).flatMap((t, i) => clack(1400 - i * 120, 0.7 - i * 0.07, t, 0.03)),
      noise(0.5, 0.5, BP(900, 300, 0.9), { delay: 0.04 }),
      tone('sine', 90, 45, 0.3, 0.6),
    ],
  },
  'ring/boot/mast-fall': {
    vol: 0.85,
    voices: 1,
    gap: 0.6,
    layers: [
      { wave: 'saw', freq: 140, to: 95, sweep: 0.5, env: { a: 0.04, d: 0.05, s: 0.7, hold: 0.42, r: 0.04 }, vol: 0.35, filter: BP(700, undefined, 4), vibrato: { rate: 18, depth: 0.06 } },
      tone('sine', 80, 40, 0.3, 0.9, { delay: 0.5 }),
      noise(0.25, 0.6, LP(600, 200), { delay: 0.5 }),
    ],
  },
  'ring/boot/settle': {
    vol: 0.6,
    voices: 1,
    gap: 0.5,
    layers: [tone('sine', 70, 48, 0.3, 0.6), noise(0.6, 0.35, HP(2500, 5000), { delay: 0.05, env: { a: 0.02, d: 0.55 } })],
  },
  'ring/boot/slide': {
    vol: 0.72,
    voices: 1,
    gap: 0.3,
    layers: [{ wave: 'square', freq: 520, to: 340, sweep: 0.42, env: { a: 0.01, d: 0.05, s: 0.6, hold: 0.36, r: 0.04 }, vol: 0.25, filter: BP(1400, undefined, 3), vibrato: { rate: 30, depth: 0.04 } }, tone('sine', 120, 60, 0.12, 0.5, { delay: 0.46 })],
  },
};
