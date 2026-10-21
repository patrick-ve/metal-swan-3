// Synth sounds of the church interior of mission oldenzaal, owned by CHURCH (wave B;
// docs/design/oldenzaal.md §7, §11): the nave (oz-d) and the crypt (oz-e), 'oz/church/…'.
// Spread into SFX in sfx/index.ts. Synth recipes only (no generated audio in wave B); the audio
// spec (tools/audio/spec.ts) lists them for a later ElevenLabs pass. Respect: the church sounds
// are plain and calm; the organ only moans (no tune of any real hymn); nothing breaks or burns
// except the old grave slabs the dead break out of.
//
// - `oz/church/doors-slam`   the heavy red west doors slam shut: a deep wooden boom, the iron
//                            latch, the hall answering in long echoes (1.8 s).
// - `oz/church/organ-moan`   the organ moans by itself: a low, wavering minor cluster on reedy
//                            pipes, swelling and sighing away, wind noise in the pipes (2.8 s).
// - `oz/church/candles`      a row of candles flickers in a cold draught (0.8 s).
// - `oz/church/slab-crack`   a grave slab cracks from below: stone ticks and a dull knock (0.6 s).
// - `oz/church/slab-break`   it breaks up: a stony crunch, chips skittering (0.8 s).
// - `oz/church/lid-grind`    a tomb lid grinds a little: stone dragging on stone (0.7 s).
// - `oz/church/lid-fall`     the lid slides off and drops: a long grind, a heavy stone thud (1.1 s).
// - `oz/church/grille-rattle` the chapel's iron grille rattles in its lock (0.6 s).
// - `oz/church/gate-creak`   an old iron gate swings open on rusty hinges (1.2 s).
// - `oz/church/drip`         water drips somewhere in the crypt, with its echo (0.7 s).
import { BP, clack, HP, LP, noise, tone, type Recipes } from './kit';

export const OZ_CHURCH_SFX_RECIPES: Recipes = {
  'oz/church/doors-slam': {
    vol: 0.7,
    voices: 1,
    gap: 0.6,
    length: 1.8,
    echo: { delay: 0.23, feedback: 0.45, mix: 0.4 },
    layers: [
      noise(0.08, 0.7, LP(900), { drive: 0.8 }),
      tone('sine', 72, 40, 0.5, 0.9),
      tone('triangle', 110, 60, 0.25, 0.4),
      ...clack(1400, 0.25, 0.05),
      { wave: 'noise', env: { a: 0.02, d: 0.9 }, vol: 0.3, delay: 0.04, filter: LP(260, 120) },
    ],
  },
  'oz/church/organ-moan': {
    vol: 0.5,
    voices: 1,
    gap: 2,
    length: 2.8,
    layers: [
      // A low minor cluster on reedy pipes (D2, F2, A♭2 a little out of tune), swelling, wavering.
      { wave: 'saw', freq: 73.4, env: { a: 0.9, d: 0.2, s: 0.8, hold: 0.7, r: 0.9 }, vol: 0.28, filter: LP(700, 380), vibrato: { rate: 4.6, depth: 0.25 }, tremolo: { rate: 0.9, depth: 0.35 } },
      { wave: 'square', freq: 87.3 * 1.004, env: { a: 1, d: 0.2, s: 0.7, hold: 0.5, r: 0.9 }, vol: 0.14, filter: LP(600, 300), vibrato: { rate: 3.9, depth: 0.3 } },
      { wave: 'saw', freq: 103.8 * 0.993, env: { a: 1.1, d: 0.2, s: 0.6, hold: 0.4, r: 0.9 }, vol: 0.14, filter: LP(800, 350), tremolo: { rate: 1.3, depth: 0.4 } },
      // The pitch sags at the end (the wind runs out).
      { wave: 'sine', freq: 36.7, to: 33, sweep: 2.6, env: { a: 0.8, d: 0.2, s: 0.8, hold: 0.7, r: 0.9 }, vol: 0.3 },
      // The wind in the pipes.
      { wave: 'noise', env: { a: 0.6, d: 0.3, s: 0.6, hold: 0.8, r: 0.9 }, vol: 0.12, filter: BP(1200, 700, 1.4) },
    ],
  },
  'oz/church/candles': {
    vol: 0.75,
    voices: 1,
    gap: 0.5,
    length: 0.8,
    layers: [
      { wave: 'noise', env: { a: 0.1, d: 0.1, s: 0.8, hold: 0.35, r: 0.2 }, vol: 1, filter: BP(700, 400, 0.8), tremolo: { rate: 11, depth: 0.5 } },
      ...[0.05, 0.19, 0.33, 0.46].map((t, i) => noise(0.01, 0.25 - i * 0.03, HP(3200), { delay: t })),
    ],
  },
  'oz/church/slab-crack': {
    vol: 0.75,
    voices: 2,
    gap: 0.3,
    length: 0.6,
    layers: [
      tone('sine', 120, 70, 0.18, 0.6),
      ...clack(2600, 0.3, 0.02, 0.012),
      ...clack(2100, 0.25, 0.17, 0.012),
      ...clack(3000, 0.2, 0.31, 0.01),
      noise(0.25, 0.25, BP(1800, 900, 1.2), { delay: 0.03 }),
    ],
  },
  'oz/church/slab-break': {
    vol: 0.8,
    voices: 2,
    gap: 0.3,
    length: 0.8,
    layers: [
      noise(0.18, 0.7, LP(1400), { drive: 0.6 }),
      tone('sine', 90, 45, 0.3, 0.7),
      noise(0.5, 0.3, BP(2600, 1500, 1), { delay: 0.08, tremolo: { rate: 26, depth: 0.7 } }),
      ...clack(3400, 0.2, 0.3, 0.01),
      ...clack(2900, 0.16, 0.45, 0.01),
    ],
  },
  'oz/church/lid-grind': {
    vol: 1,
    voices: 2,
    gap: 0.3,
    length: 0.7,
    layers: [
      { wave: 'noise', env: { a: 0.05, d: 0.1, s: 0.8, hold: 0.35, r: 0.15 }, vol: 0.6, filter: BP(420, 300, 2.4), tremolo: { rate: 17, depth: 0.6 } },
      { wave: 'saw', freq: 52, env: { a: 0.05, d: 0.1, s: 0.7, hold: 0.35, r: 0.15 }, vol: 0.2, filter: LP(300) },
    ],
  },
  'oz/church/lid-fall': {
    vol: 0.85,
    voices: 1,
    gap: 0.5,
    length: 1.1,
    layers: [
      { wave: 'noise', env: { a: 0.03, d: 0.1, s: 0.8, hold: 0.4, r: 0.1 }, vol: 0.55, filter: BP(380, 260, 2.2), tremolo: { rate: 21, depth: 0.6 } },
      noise(0.12, 0.7, LP(700), { delay: 0.58, drive: 0.5 }),
      tone('sine', 64, 36, 0.45, 0.9, { delay: 0.58 }),
      noise(0.3, 0.2, BP(1900, 1100, 1), { delay: 0.62 }),
    ],
  },
  'oz/church/grille-rattle': {
    vol: 0.85,
    voices: 2,
    gap: 0.2,
    length: 0.6,
    layers: [
      { wave: 'noise', env: { a: 0.01, d: 0.1, s: 0.8, hold: 0.3, r: 0.1 }, vol: 1, filter: BP(2000, undefined, 2), tremolo: { rate: 14, depth: 0.8 } },
      ...[0, 0.07, 0.15, 0.21, 0.3, 0.37].flatMap((t, i) => [
      ...clack(1700 + (i % 3) * 300, 0.22, t, 0.014),
      tone('triangle', 2200 + (i % 2) * 400, 2100, 0.06, 0.05, { delay: t }),
      ]),
    ],
  },
  'oz/church/gate-creak': {
    vol: 0.8,
    voices: 1,
    gap: 0.6,
    length: 1.2,
    layers: [
      { wave: 'saw', freq: 300, bend: [[0, 0], [0.3, 3], [0.6, -2], [0.9, 4]], env: { a: 0.05, d: 0.1, s: 0.8, hold: 0.7, r: 0.2 }, vol: 0.9, filter: BP(1300, undefined, 2.5), tremolo: { rate: 28, depth: 0.7 } },
      { wave: 'square', freq: 520, bend: [[0, 0], [0.5, -3], [1, 2]], env: { a: 0.1, d: 0.1, s: 0.5, hold: 0.6, r: 0.2 }, vol: 0.2, filter: BP(2100, undefined, 6), tremolo: { rate: 35, depth: 0.8 } },
      ...clack(900, 0.3, 1.0, 0.03),
    ],
  },
  'oz/church/drip': {
    vol: 1,
    voices: 3,
    gap: 0.15,
    length: 0.7,
    layers: [
      tone('sine', 1500, 900, 0.09, 0.9),
      tone('sine', 1500, 900, 0.09, 0.45, { delay: 0.23 }),
      tone('sine', 1500, 900, 0.09, 0.2, { delay: 0.46 }),
    ],
  },
};
