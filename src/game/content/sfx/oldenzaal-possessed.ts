// Synth sounds of mission oldenzaal, the possessed (docs/design/oldenzaal.md §3, §11; ids.ts
// `OZ_SFX.possessed`). Spread into SFX in sfx/index.ts. Synth recipes only in wave A (the
// ElevenLabs takes come in wave B; these stay as the fallbacks). Owner: POSSESSED.
//
// Hosts: `oz/possessed/groan` (a low, hollow moan through a closed mouth: the gloat, a rise),
// `oz/possessed/grab-tell` (the shambler's tell: a rising rasp and a cloth rustle as the hands come
// up), `oz/possessed/claw` (the swipe: a short whoosh and a dull grab), `oz/possessed/flinch` (the
// cower: a sharp intake and a ghostly shiver), `oz/possessed/rifle-tell` (the ghost rifle glows: a
// rising glassy shimmer), `oz/possessed/rifle` (the spectral shot: a hollow airy puff with a
// falling glassy ring, no gunpowder crack), `oz/possessed/brute-tell` (a deep snort and a boot
// scraping the stones), `oz/possessed/brute-charge` (a heavy roar-less rumble of feet),
// `oz/possessed/brute-thud` (he hits a wall: a dull body thump).
// Souls: `oz/possessed/wail` (the soul's wail: a thin falling voice-like whine with vibrato),
// `oz/possessed/eject` (the soul torn out: a breathy whoosh up and a glassy ring), `oz/possessed/
// soul-burst` (a soul bursts into mist: a soft airy pop and a sigh), `oz/possessed/emerge` (out of
// a drain / chimney: a hollow rising draught), `oz/possessed/swoop` (a swoop: a doppler whoosh),
// `oz/possessed/circle` (circling a townsperson: a low whispering swirl), `oz/possessed/dive` (the
// dive: a falling whistle), `oz/possessed/possess` (the soul goes in: a muffled thump and a gasp of
// breath). Bloodless, no screams.
import { BP, HP, LP, noise, tone, type Recipes } from './kit';

export const OZ_POSSESSED_SFX: Recipes = {
  'oz/possessed/groan': {
    vol: 0.7,
    voices: 3,
    gap: 0.3,
    jitter: 0.05,
    layers: [
      { wave: 'saw', freq: 92, to: 78, env: { a: 0.12, d: 0.2, s: 0.7, hold: 0.45, r: 0.3 }, vol: 0.5, filter: BP(420, 300, 3), vibrato: { rate: 5, depth: 0.25 } },
      { wave: 'triangle', freq: 184, to: 150, env: { a: 0.15, d: 0.2, s: 0.5, hold: 0.4, r: 0.3 }, vol: 0.25, filter: LP(700) },
      noise(0.9, 0.12, BP(500, 350, 1.5), { env: { a: 0.1, d: 0.8 } }),
    ],
  },
  'oz/possessed/grab-tell': {
    vol: 1,
    voices: 2,
    gap: 0.12,
    layers: [noise(0.3, 0.6, BP(700, 1800, 2)), tone('saw', 110, 160, 0.3, 0.25, { filter: BP(500, 900, 3) }), noise(0.1, 0.35, HP(2500), { delay: 0.12 })],
  },
  'oz/possessed/claw': {
    vol: 0.8,
    voices: 3,
    gap: 0.06,
    layers: [noise(0.14, 0.9, BP(1400, 500, 1.2)), tone('sine', 130, 70, 0.1, 0.5, { delay: 0.08 }), noise(0.06, 0.4, LP(900), { delay: 0.09 })],
  },
  'oz/possessed/flinch': {
    vol: 0.9,
    voices: 2,
    gap: 0.2,
    layers: [noise(0.18, 0.6, BP(2600, 1600, 2)), tone('sine', 660, 990, 0.35, 0.18, { vibrato: { rate: 9, depth: 0.6 }, filter: LP(2400) })],
  },
  'oz/possessed/rifle-tell': {
    vol: 0.6,
    voices: 2,
    gap: 0.3,
    layers: [
      tone('sine', 520, 1040, 0.75, 0.3, { env: { a: 0.3, d: 0.45 }, vibrato: { rate: 7, depth: 0.3 } }),
      tone('triangle', 780, 1560, 0.75, 0.15, { env: { a: 0.35, d: 0.4 } }),
      noise(0.75, 0.15, BP(3000, 5000, 3), { env: { a: 0.3, d: 0.45 } }),
    ],
  },
  'oz/possessed/rifle': {
    vol: 0.8,
    voices: 3,
    gap: 0.08,
    layers: [noise(0.25, 0.8, BP(900, 300, 1)), tone('sine', 1320, 440, 0.5, 0.3, { filter: LP(3000) }), tone('triangle', 220, 110, 0.2, 0.35)],
  },
  'oz/possessed/brute-tell': {
    vol: 0.8,
    voices: 2,
    gap: 0.2,
    drive: 0.3,
    layers: [noise(0.22, 0.8, BP(400, 200, 1.5)), tone('saw', 70, 55, 0.3, 0.4, { filter: LP(400) }), noise(0.3, 0.4, BP(1800, 900, 1.2), { delay: 0.25 })],
  },
  'oz/possessed/brute-charge': {
    vol: 0.8,
    voices: 2,
    gap: 0.2,
    layers: [0, 0.13, 0.26, 0.39].flatMap((t) => [tone('sine', 90, 50, 0.1, 0.6, { delay: t }), noise(0.06, 0.3, LP(700), { delay: t })]),
  },
  'oz/possessed/brute-thud': {
    vol: 0.8,
    voices: 2,
    gap: 0.1,
    layers: [tone('sine', 80, 40, 0.25, 0.9), noise(0.15, 0.5, LP(600))],
  },
  'oz/possessed/wail': {
    vol: 0.6,
    voices: 3,
    gap: 0.25,
    jitter: 0.05,
    layers: [
      { wave: 'sine', freq: 880, to: 520, env: { a: 0.08, d: 0.3, s: 0.6, hold: 0.4, r: 0.35 }, vol: 0.4, vibrato: { rate: 6, depth: 0.5, delay: 0.1 } },
      { wave: 'triangle', freq: 1320, to: 780, env: { a: 0.1, d: 0.3, s: 0.4, hold: 0.35, r: 0.35 }, vol: 0.15, vibrato: { rate: 6.5, depth: 0.5 } },
      noise(1, 0.15, BP(2400, 1200, 2), { env: { a: 0.1, d: 0.9 } }),
    ],
    echo: { delay: 0.18, feedback: 0.35, mix: 0.35 },
  },
  'oz/possessed/eject': {
    vol: 0.75,
    voices: 3,
    gap: 0.08,
    layers: [noise(0.5, 0.7, BP(500, 3000, 1.5)), tone('sine', 440, 1320, 0.5, 0.3), tone('sine', 1760, 1760, 0.6, 0.12, { delay: 0.2 })],
    echo: { delay: 0.14, feedback: 0.3, mix: 0.3 },
  },
  'oz/possessed/soul-burst': {
    vol: 0.7,
    voices: 3,
    gap: 0.06,
    layers: [noise(0.3, 0.8, BP(1200, 400, 1)), tone('sine', 700, 260, 0.35, 0.3), noise(0.4, 0.2, HP(3000), { delay: 0.05 })],
  },
  'oz/possessed/emerge': {
    vol: 0.6,
    voices: 2,
    gap: 0.3,
    layers: [noise(0.7, 0.6, BP(250, 1100, 2), { env: { a: 0.25, d: 0.45 } }), tone('sine', 180, 360, 0.7, 0.25, { env: { a: 0.3, d: 0.4 } })],
  },
  'oz/possessed/swoop': {
    vol: 1,
    voices: 3,
    gap: 0.1,
    layers: [noise(0.4, 0.8, BP(600, 2200, 1.5), { bend: [[0, 0], [0.2, 4], [0.4, -6]] }), tone('sine', 600, 300, 0.4, 0.15)],
  },
  'oz/possessed/circle': {
    vol: 0.85,
    voices: 2,
    gap: 0.3,
    layers: [noise(0.5, 1, BP(1800, 900, 3), { tremolo: { rate: 8, depth: 0.7 } }), tone('sine', 330, 300, 0.5, 0.3, { vibrato: { rate: 4, depth: 0.8 } })],
  },
  'oz/possessed/dive': {
    vol: 0.7,
    voices: 2,
    gap: 0.1,
    layers: [tone('sine', 1400, 300, 0.45, 0.35), noise(0.45, 0.4, BP(2500, 600, 2))],
  },
  'oz/possessed/possess': {
    vol: 0.75,
    voices: 2,
    gap: 0.1,
    layers: [tone('sine', 110, 50, 0.25, 0.8), noise(0.12, 0.5, LP(800)), noise(0.35, 0.35, BP(1600, 900, 2), { delay: 0.15 })],
  },
};
