/**
 * Boss and mini-boss sounds (GDD §12.1 "Bosses, environment, UI", §9.4, §10). Telegraph sounds
 * last their telegraph: calliope-scale T 40, foghorn 50, trombone-pull 30, beater-pull 40,
 * piano-rattle 40, piano-gliss 36, harp-charge 45, goose-wiggle 50 (ticks).
 * `boss/bagpipe-drone` is a loop (the WINDBAG's drones; `sfxLoop`, stop it when they are gone).
 * `boss/warning` is an alias of `ui/warning` (index.ts).
 */
import { BLAST_M } from './weapons';
import { BP, fmBell, HP, honk, hz, LP, loopRecipe, noise, scatter, seq, type Recipes } from './kit';

export const BOSSES: Recipes = {
  // A boss part breaks: a heavy metal crunch on top of `explosion/m`.
  'boss/part-break': {
    vol: 0.523,
    voices: 2,
    gap: 0.08,
    layers: [
      ...BLAST_M,
      ...fmBell(220, 0.32, 0.5, { ratio: 1.41, index: 6, decay: 0.06 }),
      noise(0.12, 0.6, BP(1800, 600, 0.8), { drive: 1.5 }),
    ],
    drive: 0.8,
    length: 0.5,
  },
  // ENCORE Steam Scale (T 40): 6 rising steam-whistle notes (pulse 50 % + breath noise).
  'boss/calliope-scale': {
    vol: 0.431,
    voices: 1,
    gap: 0.3,
    layers: seq(
      [hz('D5'), hz('E5'), hz('F#5'), hz('A5'), hz('B5'), hz('D6')].map((f) => [f, 0.111] as const),
      (f, len, delay) => [
        { wave: 'pulse', duty: 0.5, freq: f, bend: [[0, -1], [0.025, 0]], env: { a: 0.01, d: 0.02, s: 0.8, hold: len - 0.03, r: 0.04 }, vol: 0.35, delay, filter: LP(3500) },
        { wave: 'sine', freq: f, bend: [[0, -1], [0.025, 0]], env: { a: 0.01, d: 0.02, s: 0.8, hold: len - 0.03, r: 0.04 }, vol: 0.35, delay, vibrato: { rate: 9, depth: 0.12 } },
        { wave: 'noise', env: { a: 0.01, d: len + 0.02 }, vol: 0.3, delay, filter: BP(f * 2, undefined, 4) },
        { wave: 'noise', env: { a: 0.005, d: 0.05 }, vol: 0.2, delay, filter: HP(4500) },
      ],
    ),
  },
  // ENCORE Foghorn (T 50): a deep horn (saw 55 Hz + 110 Hz), a rising toot.
  'boss/foghorn': {
    vol: 0.587,
    voices: 1,
    gap: 0.3,
    layers: [
      { wave: 'saw', freq: 55, bend: [[0, -2], [0.15, 0]], env: { a: 0.08, d: 0.05, s: 0.85, hold: 0.52, r: 0.16 }, vol: 0.7, filter: LP(450, 900) },
      { wave: 'saw', freq: 110, bend: [[0, -2], [0.15, 0]], env: { a: 0.08, d: 0.05, s: 0.85, hold: 0.52, r: 0.16 }, vol: 0.45, filter: LP(700, 1400) },
      { wave: 'square', freq: 110.6, bend: [[0, -2], [0.15, 0]], env: { a: 0.1, d: 0.05, s: 0.8, hold: 0.5, r: 0.16 }, vol: 0.15, filter: BP(600, undefined, 2) },
      { wave: 'noise', env: { a: 0.05, d: 0.25 }, vol: 0.2, filter: BP(400, undefined, 1) },
    ],
  },
  // ENCORE Slide Shot (T 30): a slide-up "wwwoop".
  'boss/trombone-pull': {
    vol: 0.784,
    voices: 1,
    gap: 0.2,
    layers: [
      { wave: 'saw', freq: hz('G2'), bend: [[0.02, 0], [0.42, 12]], env: { a: 0.03, d: 0.02, s: 0.85, hold: 0.38, r: 0.06 }, vol: 0.6, filter: BP(450, 1800, 1.3), drive: 0.8 },
      { wave: 'pulse', duty: 0.35, freq: hz('G2'), bend: [[0.02, 0], [0.42, 12]], env: { a: 0.03, d: 0.02, s: 0.8, hold: 0.38, r: 0.06 }, vol: 0.25, filter: LP(500, 2400) },
    ],
  },
  // BA-DUM Hi-Hat Crush: the cymbals open, "chick".
  'boss/hihat-open': {
    vol: 0.88,
    voices: 2,
    gap: 0.1,
    layers: [
      noise(0.025, 0.7, BP(4200, undefined, 1.2)),
      { wave: 'metal', freq: 26000, env: { a: 0.001, d: 0.2 }, vol: 0.6, filter: HP(6500) },
      noise(0.15, 0.4, HP(7500)),
    ],
  },
  // BA-DUM Kick Boom (T 40): the pedal beater pulls back with a low creak.
  // (A creak is a slowing train of clicks through wood resonances: a narrow pulse at 34 → 22 Hz.)
  'boss/beater-pull': {
    vol: 0.593,
    voices: 1,
    gap: 0.2,
    layers: [
      { wave: 'pulse', duty: 0.06, freq: 34, to: 22, env: { a: 0.04, d: 0.02, s: 0.85, hold: 0.5, r: 0.08 }, vol: 0.9, filter: BP(700, undefined, 4) },
      { wave: 'pulse', duty: 0.06, freq: 34, to: 22, env: { a: 0.04, d: 0.02, s: 0.85, hold: 0.5, r: 0.08 }, vol: 0.5, filter: BP(1700, undefined, 6) },
      { wave: 'saw', freq: 55, bend: [[0, 0], [0.6, 3]], env: { a: 0.04, d: 0.02, s: 0.8, hold: 0.5, r: 0.08 }, vol: 0.3, filter: LP(300) },
    ],
    drive: 0.6,
  },
  // WINDBAG drones (loop, 1 s): a nasal drone, saw 110 + 165 Hz (with 1 Hz-detuned partners),
  // band-passed.
  'boss/bagpipe-drone': loopRecipe(1.0, 0.667, [
    { wave: 'saw', freq: 110, vol: 0.5, filter: BP(900, undefined, 2) },
    { wave: 'saw', freq: 111, vol: 0.3, filter: BP(900, undefined, 2) },
    { wave: 'saw', freq: 165, vol: 0.4, filter: BP(1100, undefined, 2.2) },
    { wave: 'saw', freq: 166, vol: 0.25, filter: BP(1100, undefined, 2.2) },
    { wave: 'triangle', freq: 55, vol: 0.25 },
  ]),
  // The WINDBAG dies: the drone chord slides down and sputters as it runs out of air.
  'boss/bagpipe-die': {
    vol: 0.661,
    voices: 1,
    gap: 1,
    layers: [
      { wave: 'saw', freq: 110, bend: [[0.2, 0], [2.0, -14]], env: { a: 0.01, d: 0.1, s: 0.8, hold: 1.4, r: 0.5 }, vol: 0.6, filter: BP(900, 400, 1.2), tremolo: { rate: 3, rateTo: 15, depth: 0.6 } },
      { wave: 'saw', freq: 165, bend: [[0.3, 0], [2.0, -17]], env: { a: 0.01, d: 0.1, s: 0.8, hold: 1.3, r: 0.5 }, vol: 0.5, filter: BP(1100, 500, 1.4), tremolo: { rate: 4, rateTo: 17, depth: 0.6 } },
      { wave: 'triangle', freq: 55, bend: [[0.2, 0], [2.0, -10]], env: { a: 0.01, d: 0.1, s: 0.8, hold: 1.4, r: 0.5 }, vol: 0.35 },
      { wave: 'noise', env: { a: 0.3, d: 0.1, s: 0.6, hold: 1.1, r: 0.5 }, vol: 0.3, filter: BP(1600, 700, 1.5) },
    ],
    drive: 0.6,
  },
  // GRAND GRAND Chomp (T 40): the keys rattle (scattered high wooden ticks over a clatter).
  'boss/piano-rattle': {
    vol: 1.132,
    voices: 1,
    gap: 0.2,
    layers: [
      ...scatter(16, 0x91a7).map((r, i) => fmBell(600 + r * 1800, 0.05, 0.35, { ratio: 1, index: 1.5, decay: 0.02, delay: i * 0.04 + r * 0.01 })).flat(),
      { wave: 'noise', env: { a: 0.01, d: 0.02, s: 0.8, hold: 0.55, r: 0.08 }, vol: 0.5, filter: BP(1500, undefined, 1.5), tremolo: { rate: 24, depth: 0.85, shape: 'saw' } },
    ],
  },
  // GRAND GRAND Glissando (T 36): a rising run (12 piano notes up the scale).
  'boss/piano-gliss': {
    vol: 0.661,
    voices: 1,
    gap: 0.2,
    layers: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5'].flatMap((n, i) =>
      fmBell(hz(n), 0.24, 0.45, { ratio: 1, index: 2, decay: 0.05, delay: i * 0.045 }),
    ),
  },
  // GRAND GRAND Harp Strings (T 45): a glittering arpeggio up (FM bells) with a shimmer.
  'boss/harp-charge': {
    vol: 0.446,
    voices: 1,
    gap: 0.3,
    layers: [
      ...['D5', 'F#5', 'A5', 'D6', 'F#6', 'A6', 'D7'].flatMap((n, i) => fmBell(hz(n), 0.42, 0.45, { ratio: 3.5, index: 2.5, decay: 0.06, delay: i * 0.09 })),
      { wave: 'noise', env: { a: 0.3, d: 0.4 }, vol: 0.2, filter: HP(8000), tremolo: { rate: 11, depth: 0.7 } },
    ],
  },
  // Organ attacks: a big pad chord (D minor), with a slow organ tremolo.
  'boss/organ-chord': {
    vol: 0.517,
    voices: 2,
    gap: 0.2,
    layers: [
      ...['D2', 'D3', 'F3', 'A3', 'D4', 'A4'].flatMap((n, i) => [
        { wave: 'saw' as const, freq: hz(n) * (1 + (i % 2 ? 0.002 : -0.002)), env: { a: 0.04, d: 0.06, s: 0.85, hold: 0.5, r: 0.3 }, vol: i === 0 ? 0.4 : 0.26, filter: LP(2400), tremolo: { rate: 6, depth: 0.12 } },
      ]),
      { wave: 'square', freq: hz('D3'), env: { a: 0.04, d: 0.06, s: 0.85, hold: 0.5, r: 0.3 }, vol: 0.2, filter: LP(1200) },
      noise(0.05, 0.2, HP(3000)),
    ],
    drive: 0.3,
  },
  // GOLDEN GOOSE Honk Ring (T 50): a rattling wobble (the chest puffs).
  'boss/goose-wiggle': {
    vol: 0.577,
    voices: 1,
    gap: 0.3,
    layers: [
      { wave: 'triangle', freq: 180, env: { a: 0.03, d: 0.02, s: 0.85, hold: 0.68, r: 0.1 }, vol: 0.6, vibrato: { rate: 12, depth: 3 } },
      { wave: 'noise', env: { a: 0.03, d: 0.02, s: 0.8, hold: 0.68, r: 0.1 }, vol: 0.45, filter: BP(3000, undefined, 2), tremolo: { rate: 18, depth: 0.95, shape: 'saw' } },
      { wave: 'square', freq: 360, env: { a: 0.03, d: 0.02, s: 0.8, hold: 0.68, r: 0.1 }, vol: 0.1, vibrato: { rate: 12, depth: 3 }, filter: LP(1500) },
    ],
  },
  // GOLDEN GOOSE: the swan's honk detuned down (a fourth) and distorted.
  'boss/goose-honk': {
    vol: 0.387,
    voices: 1,
    gap: 0.2,
    layers: honk({ base: 165, len: 0.45, scoop: 3, drive: 2.5, formant: 1000 }),
    drive: 1.6,
  },
  // THE MAESTRO's BRAVISSIMO: noise + a saw formant sweep, 1.2 s.
  'boss/scream': {
    vol: 0.904,
    voices: 1,
    gap: 1,
    layers: [
      { wave: 'saw', freq: 340, bend: [[0, -2], [0.2, 0], [1.2, 3]], env: { a: 0.08, d: 0.05, s: 0.9, hold: 0.9, r: 0.17 }, vol: 0.55, vibrato: { rate: 7, depth: 0.6, delay: 0.2 }, filter: BP(700, 2600, 2.5), drive: 2 },
      { wave: 'saw', freq: 340, bend: [[0, -2], [0.2, 0], [1.2, 3]], env: { a: 0.08, d: 0.05, s: 0.9, hold: 0.9, r: 0.17 }, vol: 0.3, vibrato: { rate: 7, depth: 0.6, delay: 0.2 }, filter: BP(1800, 3600, 3) },
      { wave: 'noise', env: { a: 0.1, d: 0.05, s: 0.8, hold: 0.85, r: 0.2 }, vol: 0.35, filter: BP(2500, 4000, 1.5) },
      { wave: 'sine', freq: 340, bend: [[0, -2], [0.2, 0], [1.2, 3]], env: { a: 0.08, d: 0.05, s: 0.9, hold: 0.9, r: 0.17 }, vol: 0.2 },
    ],
  },
  // The last scream cracks: a tiny squeak (pulse 2 kHz, 80 ms).
  'boss/voice-crack': {
    vol: 0.948,
    voices: 1,
    gap: 0.2,
    layers: [{ wave: 'pulse', duty: 0.25, freq: 2000, bend: [[0, -2], [0.03, 1], [0.08, -1]], env: { a: 0.004, d: 0.076 }, vol: 0.6, filter: LP(5000) }],
  },
  // THE BIG HEAD deflates: a long raspberry (saw 90 Hz with 30 Hz AM, falling pitch), 1.5 s.
  'boss/deflate': {
    vol: 0.837,
    voices: 1,
    gap: 1,
    layers: [
      { wave: 'saw', freq: 90, to: 55, sweep: 1.5, env: { a: 0.02, d: 0.05, s: 0.85, hold: 1.1, r: 0.33 }, vol: 0.65, filter: BP(500, 350, 1), tremolo: { rate: 30, depth: 0.85, shape: 'square' }, drive: 2 },
      { wave: 'noise', env: { a: 0.04, d: 0.05, s: 0.7, hold: 1.05, r: 0.36 }, vol: 0.3, filter: BP(800, 400, 1.2), tremolo: { rate: 30, depth: 0.7, shape: 'square' } },
    ],
    // A light master drive only: more would bend the lopsided band-passed saw into a DC offset.
    drive: 0.35,
  },
};
