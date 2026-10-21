// Synth sounds of mission oldenzaal owned by WUGHOST (docs/design/oldenzaal.md §4, §6, §11):
// Meneer Wu at De Smulhoek ('oz/wu/…'), the meal ('oz/meal/…') and the ghost of Mevrouw Winkel
// ('oz/ghost/…'). Spread into SFX in sfx/index.ts. Synth recipes only (wave A: no samples, no
// generated audio); AUDIO lists every id in the ElevenLabs spec.
//
// - `oz/wu/fryer`    the fryer behind him: a hot oil sizzle with a few pops (1.2 s).
// - `oz/wu/paper`    the paper tray: a crisp rustle and a fold.
// - `oz/wu/toss`     the tray leaves his hand: a soft airy whoosh.
// - `oz/meal/catch`  a hero catches the meal: a paper rustle and a warm two-note chime.
// - `oz/meal/eat`    snack power starts: three quick munches and a rising sparkle.
// - `oz/meal/throw`  a frikandel thrown in a high arc: a wobbly whoosh.
// - `oz/meal/splat`  the mayo splat takes a hit: a wet slap, a squelch.
// - `oz/meal/blast`  the holy-mayo blast: a soft wet whump that blooms into a bright choir-like
//                    chord (major, airy), a shimmer on top.
// - `oz/ghost/whisper`  her whisper: breathy band-passed noise with a slow flutter.
// - `oz/ghost/shriek`   her shriek: a high wavering wail with a cold noise edge (no scream of a
//                       crowd: one voice).
// - `oz/ghost/laugh`    her laugh: four falling breathy "ha"s with an echo (never played at a
//                       player's death).
// - `oz/ghost/appear`   a cold swell (reverse-like rise) when she fades in.
// - `oz/ghost/vanish`   a falling airy sigh when she fades out.
import { BP, fmBell, HP, LP, noise, note, tone, type Recipes } from './kit';

/** One breathy "ha" of the ghost's laugh: a formant-filtered triangle and a breath of noise. */
function ha(f: number, delay: number, vol: number) {
  return [
    { wave: 'triangle' as const, freq: f, to: f * 0.88, env: { a: 0.01, d: 0.05, s: 0.6, hold: 0.06, r: 0.08 }, vol, delay, filter: BP(f * 3.2, undefined, 1.4), vibrato: { rate: 9, depth: 0.5 } },
    { wave: 'noise' as const, env: { a: 0.01, d: 0.05, s: 0.5, hold: 0.05, r: 0.08 }, vol: vol * 0.5, delay, filter: BP(1800, undefined, 1.2) },
  ];
}

export const OZ_WU_SFX: Recipes = {
  'oz/wu/fryer': {
    vol: 0.5,
    voices: 1,
    gap: 0.8,
    layers: [
      { wave: 'noise', env: { a: 0.08, d: 0.1, s: 0.8, hold: 0.8, r: 0.2 }, vol: 0.5, filter: HP(2600, 3400), tremolo: { rate: 23, depth: 0.45 } },
      { wave: 'noise', freq: 9000, env: { a: 0.05, d: 0.1, s: 0.6, hold: 0.8, r: 0.2 }, vol: 0.25, filter: BP(5200, undefined, 0.8) },
      ...[0.12, 0.31, 0.47, 0.66, 0.9].map((t, i) => noise(0.012, 0.5 - i * 0.04, HP(1800), { delay: t })),
    ],
  },
  'oz/wu/paper': {
    vol: 1,
    voices: 2,
    gap: 0.1,
    layers: [
      { wave: 'noise', env: { a: 0.004, d: 0.05, s: 0.6, hold: 0.06, r: 0.04 }, vol: 0.8, filter: BP(3800, 2600, 0.9), tremolo: { rate: 38, depth: 0.5 } },
      noise(0.04, 0.8, BP(2200, undefined, 1.2), { delay: 0.08 }),
    ],
  },
  'oz/wu/toss': {
    vol: 1,
    voices: 2,
    gap: 0.1,
    layers: [{ wave: 'noise', env: { a: 0.05, d: 0.18, s: 0 }, vol: 1, filter: BP(700, 2400, 1.1) }],
  },
  'oz/meal/catch': {
    vol: 0.6,
    voices: 2,
    gap: 0.1,
    layers: [
      noise(0.05, 0.4, BP(3500, undefined, 1)),
      note('triangle', 784, 0.09, 0.45, 0.02),
      note('triangle', 1175, 0.16, 0.42, 0.1),
      note('sine', 2350, 0.12, 0.12, 0.1),
    ],
  },
  'oz/meal/eat': {
    vol: 0.62,
    voices: 2,
    gap: 0.3,
    layers: [
      ...[0, 0.12, 0.24].map((t) => noise(0.05, 0.5, BP(900, 500, 1.4), { delay: t })),
      ...[0, 0.12, 0.24].map((t) => tone('sine', 160, 90, 0.05, 0.4, { delay: t })),
      { wave: 'square', freq: 523, env: { a: 0.002, d: 0.06, s: 0.7, hold: 0.24, r: 0.08 }, vol: 0.18, delay: 0.36, arp: [0, 4, 7, 12], arpTime: 0.06, filter: LP(4000) },
    ],
  },
  'oz/meal/throw': {
    vol: 1,
    voices: 2,
    gap: 0.1,
    layers: [
      { wave: 'noise', env: { a: 0.02, d: 0.2, s: 0 }, vol: 1, filter: BP(500, 1800, 1.3), tremolo: { rate: 14, depth: 0.5 } },
      tone('triangle', 330, 520, 0.16, 0.45),
    ],
  },
  'oz/meal/splat': {
    vol: 0.7,
    voices: 2,
    gap: 0.1,
    layers: [
      noise(0.08, 0.8, LP(1400, 500)),
      tone('sine', 220, 70, 0.1, 0.7),
      { wave: 'noise', env: { a: 0.01, d: 0.12, s: 0 }, vol: 0.35, delay: 0.05, filter: BP(600, 300, 2), tremolo: { rate: 30, depth: 0.8 } },
    ],
  },
  'oz/meal/blast': {
    vol: 0.66,
    voices: 2,
    gap: 0.2,
    layers: [
      // The wet whump.
      tone('sine', 140, 55, 0.25, 0.75),
      noise(0.18, 0.5, LP(900, 300)),
      // The bright bloom: a major chord of soft pads (choir-like vowel band), a shimmer.
      ...[523, 659, 784, 1047].map((f, i) => ({
        wave: 'saw' as const,
        freq: f,
        env: { a: 0.08, d: 0.2, s: 0.5, hold: 0.25, r: 0.45 },
        vol: 0.12,
        delay: 0.04 + i * 0.015,
        filter: BP(f * 2, undefined, 0.9),
        vibrato: { rate: 5, depth: 0.12, delay: 0.1 },
      })),
      ...fmBell(2093, 0.6, 0.12, { ratio: 2.01, index: 1.5, delay: 0.08 }),
    ],
  },
  'oz/ghost/whisper': {
    vol: 0.85,
    voices: 1,
    gap: 0.4,
    layers: [
      { wave: 'noise', env: { a: 0.1, d: 0.2, s: 0.8, hold: 0.5, r: 0.3 }, vol: 0.95, filter: BP(2400, 1600, 1.6), tremolo: { rate: 6, depth: 0.4 } },
      { wave: 'noise', env: { a: 0.15, d: 0.2, s: 0.7, hold: 0.4, r: 0.3 }, vol: 0.6, delay: 0.1, filter: BP(900, 1300, 1.8), tremolo: { rate: 4, depth: 0.4 } },
    ],
  },
  'oz/ghost/shriek': {
    vol: 0.6,
    voices: 1,
    gap: 0.6,
    layers: [
      { wave: 'saw', freq: 880, env: { a: 0.04, d: 0.1, s: 0.8, hold: 0.5, r: 0.35 }, vol: 0.3, filter: BP(2600, 1800, 1.4), vibrato: { rate: 7, depth: 1.2 }, bend: [[0, -5], [0.12, 0], [0.7, 2], [1, -7]] },
      { wave: 'triangle', freq: 1320, env: { a: 0.06, d: 0.1, s: 0.7, hold: 0.45, r: 0.3 }, vol: 0.22, vibrato: { rate: 6.3, depth: 0.9 }, bend: [[0, -5], [0.12, 0], [1, -6]] },
      { wave: 'noise', env: { a: 0.02, d: 0.1, s: 0.5, hold: 0.5, r: 0.35 }, vol: 0.3, filter: HP(3000, 5000) },
    ],
    echo: { delay: 0.11, feedback: 0.35, mix: 0.3 },
  },
  'oz/ghost/laugh': {
    vol: 1,
    voices: 1,
    gap: 1,
    layers: [...ha(520, 0, 0.8), ...ha(490, 0.2, 0.74), ...ha(455, 0.4, 0.68), ...ha(410, 0.62, 0.6)],
    echo: { delay: 0.14, feedback: 0.4, mix: 0.35 },
  },
  'oz/ghost/appear': {
    vol: 0.5,
    voices: 1,
    gap: 0.4,
    layers: [
      { wave: 'noise', env: { a: 0.5, d: 0.05, s: 0.4, hold: 0.05, r: 0.2 }, vol: 0.5, filter: BP(600, 3200, 1.6) },
      { wave: 'sine', freq: 330, to: 660, env: { a: 0.5, d: 0.05, s: 0.5, hold: 0.05, r: 0.25 }, vol: 0.3, vibrato: { rate: 5, depth: 0.3 } },
    ],
  },
  'oz/ghost/vanish': {
    vol: 0.8,
    voices: 1,
    gap: 0.4,
    layers: [
      { wave: 'noise', env: { a: 0.02, d: 0.1, s: 0.5, hold: 0.15, r: 0.35 }, vol: 0.5, filter: BP(2800, 500, 1.6) },
      { wave: 'sine', freq: 700, to: 300, env: { a: 0.02, d: 0.1, s: 0.5, hold: 0.15, r: 0.35 }, vol: 0.25 },
    ],
  },
};
