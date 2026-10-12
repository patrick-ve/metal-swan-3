/**
 * Legion machine and creature sounds (GDD §12.1 "Machines and creatures", §9.2–§9.3).
 *
 * Loops (play with `audio.sfxLoop(key, id)`, stop with `stopSfx(key)` in `onRemove`):
 * `machine/tank-move` (treads), `machine/copter` (rotor; raise its `pitch` for the note-spread
 * telegraph), `creature/kazoo` (one loop per formation, not per drone).
 * Telegraph sounds last their telegraph: tank-charge T 45, scratch 20, piano-whistle 50,
 * pipe-charge 30, anthem-crackle 30, croak-build 40, windup 30, rattle 45, bat-screech 20,
 * shush 30 (ticks).
 */
import { BP, clack, fmBell, HP, hz, LP, loopRecipe, noise, seq, tone, type Recipes } from './kit';

export const MACHINES: Recipes = {
  // Tread rumble (loop, 0.5 s): a chugging engine, clanking track links and a low growl.
  'machine/tank-move': loopRecipe(0.5, 0.24, [
    { wave: 'saw', freq: 50, vol: 0.55, filter: LP(220), tremolo: { rate: 6, depth: 0.3 } },
    { wave: 'noise', vol: 0.6, filter: BP(900, undefined, 1.5), tremolo: { rate: 12, depth: 0.9, shape: 'saw' } },
    { wave: 'noise', freq: 300, vol: 0.5, filter: LP(250) },
    { wave: 'noise', vol: 0.15, filter: BP(2400, undefined, 6), tremolo: { rate: 4, depth: 0.85 } },
  ]),
  // Bell-shell telegraph (T 45): a rising hum.
  'machine/tank-charge': {
    vol: 0.577,
    voices: 2,
    gap: 0.2,
    layers: [
      { wave: 'saw', freq: 90, to: 270, sweep: 0.75, env: { a: 0.5, d: 0.25 }, vol: 0.6, filter: LP(400, 2600), vibrato: { rate: 7, depth: 0.3 } },
      { wave: 'pulse', duty: 0.25, freq: 180, to: 540, sweep: 0.75, env: { a: 0.5, d: 0.25 }, vol: 0.25, filter: LP(1800) },
    ],
  },
  // The tank's death: three slow descending notes on pulse 50 % with a wobble (an original
  // phrase: down a minor third, then a fourth, the last note sagging).
  'machine/sad-notes': {
    vol: 0.499,
    voices: 1,
    gap: 0.5,
    layers: [
      ...seq(
        [
          [hz('G4'), 0.3],
          [hz('E4'), 0.3],
          [hz('B3'), 0.55],
        ],
        (f, len, delay, i) => [
          {
            wave: 'pulse',
            duty: 0.5,
            freq: f,
            bend: i === 2 ? [[0.2, 0], [0.5, -1.5]] : undefined,
            env: { a: 0.02, d: 0.04, s: 0.75, hold: len - 0.1, r: 0.06 },
            vol: 0.42,
            delay,
            vibrato: { rate: 5.5, depth: i === 2 ? 0.8 : 0.35, delay: 0.05 },
            filter: LP(1700),
          },
          { wave: 'triangle', freq: f / 2, env: { a: 0.02, d: 0.04, s: 0.75, hold: len - 0.1, r: 0.06 }, vol: 0.4, delay, vibrato: { rate: 5.5, depth: 0.35, delay: 0.05 } },
        ],
      ),
    ],
  },
  // The band truck's plain two-tone horn: "HONK-HONK" (a major third, E♭4 + G4).
  'machine/truck-horn': {
    vol: 0.252,
    voices: 1,
    gap: 0.3,
    layers: [0, 0.24].flatMap((delay) => [
      { wave: 'square' as const, freq: hz('Eb4'), env: { a: 0.006, d: 0.02, s: 0.85, hold: 0.15, r: 0.03 }, vol: 0.4, delay, filter: LP(2400), drive: 0.6 },
      { wave: 'saw' as const, freq: hz('G4'), env: { a: 0.006, d: 0.02, s: 0.85, hold: 0.15, r: 0.03 }, vol: 0.35, delay, filter: LP(2600), drive: 0.6 },
    ]),
  },
  // The truck stops: a tyre screech (high band-passed noise).
  'machine/brake': {
    vol: 0.608,
    voices: 1,
    gap: 0.3,
    layers: [
      { wave: 'noise', env: { a: 0.01, d: 0.03, s: 0.8, hold: 0.32, r: 0.12 }, vol: 0.9, filter: BP(2500, 1900, 5), tremolo: { rate: 28, depth: 0.35 } },
      { wave: 'sine', freq: 2150, to: 1750, env: { a: 0.02, d: 0.03, s: 0.7, hold: 0.3, r: 0.1 }, vol: 0.3, vibrato: { rate: 23, depth: 0.25 }, tremolo: { rate: 28, depth: 0.3 } },
      { wave: 'pulse', duty: 0.3, freq: 2150, to: 1750, env: { a: 0.02, d: 0.03, s: 0.7, hold: 0.3, r: 0.1 }, vol: 0.1, filter: BP(2000, undefined, 3) },
      noise(0.3, 0.3, LP(500)),
    ],
  },
  // Metronome turret: wood clicks at two pitches (tick high, tock low).
  'machine/metronome-tick': {
    vol: 0.951,
    voices: 2,
    gap: 0.05,
    layers: [...fmBell(1900, 0.035, 0.8, { ratio: 1.5, index: 1.4, decay: 0.006 }), noise(0.008, 0.45, BP(3200, undefined, 1.5))],
  },
  'machine/metronome-tock': {
    vol: 0.974,
    voices: 2,
    gap: 0.05,
    layers: [...fmBell(1250, 0.045, 0.85, { ratio: 1.5, index: 1.4, decay: 0.008 }), noise(0.009, 0.45, BP(2200, undefined, 1.5))],
  },
  // Gramophone telegraph (20 ticks): a needle drop, then a record scratch (pitch up and down).
  'machine/scratch': {
    vol: 0.524,
    voices: 1,
    gap: 0.2,
    layers: [
      tone('sine', 90, 50, 0.04, 0.5),
      noise(0.02, 0.35, HP(2000)),
      {
        wave: 'saw',
        freq: 320,
        bend: [[0.04, -10], [0.12, 4], [0.2, -9], [0.29, 3]],
        env: { a: 0.01, d: 0.02, s: 0.8, hold: 0.24, r: 0.04 },
        vol: 0.5,
        delay: 0.03,
        filter: BP(1400, undefined, 1),
        drive: 1.2,
      },
      {
        wave: 'noise',
        freq: 9000,
        bend: [[0.04, -10], [0.12, 4], [0.2, -9], [0.29, 3]],
        env: { a: 0.01, d: 0.02, s: 0.8, hold: 0.24, r: 0.04 },
        vol: 0.4,
        delay: 0.03,
        filter: BP(2200, undefined, 0.9),
      },
    ],
  },
  // Piano drop telegraph (T 50): a falling whistle, 2 kHz → 600 Hz over 50 ticks.
  'machine/piano-whistle': {
    vol: 0.287,
    voices: 2,
    gap: 0.3,
    layers: [
      { wave: 'sine', freq: 2000, to: 600, sweep: 0.833, env: { a: 0.04, d: 0.02, s: 0.85, hold: 0.72, r: 0.05 }, vol: 0.7, vibrato: { rate: 5, depth: 0.15 } },
      { wave: 'triangle', freq: 2000, to: 600, sweep: 0.833, env: { a: 0.04, d: 0.02, s: 0.85, hold: 0.72, r: 0.05 }, vol: 0.2 },
      { wave: 'noise', env: { a: 0.1, d: 0.02, s: 0.6, hold: 0.62, r: 0.1 }, vol: 0.1, filter: BP(1600, 700, 2) },
    ],
  },
  // "PLONK": a 5-note cluster on FM bells (piano-like ratio 1) over a wooden crash, 600 ms.
  'machine/piano-crash': {
    vol: 0.549,
    voices: 2,
    gap: 0.1,
    layers: [
      ...[hz('C3'), hz('Db3'), hz('G3'), hz('Ab3'), hz('D4')].flatMap((f, i) => fmBell(f, 0.6, 0.3, { ratio: 1, index: 2.5, decay: 0.09, delay: i * 0.004 })),
      noise(0.25, 0.8, LP(3200, 400), { drive: 1 }),
      tone('sine', 75, 38, 0.18, 0.4),
      { wave: 'saw', freq: 55, env: { a: 0.002, d: 0.5 }, vol: 0.18, filter: LP(300) },
    ],
    drive: 0.6,
  },
  // Rotor chop (loop, 0.5 s): noise gated at 12 Hz over a low engine and a turbine whine.
  'machine/copter': loopRecipe(0.5, 0.489, [
    { wave: 'noise', vol: 0.8, filter: LP(1400), tremolo: { rate: 12, depth: 0.9, shape: 'saw' } },
    { wave: 'noise', freq: 2000, vol: 0.35, filter: LP(300), tremolo: { rate: 12, depth: 0.6, shape: 'saw' } },
    { wave: 'saw', freq: 60, vol: 0.3, filter: LP(220) },
    { wave: 'pulse', duty: 0.125, freq: 400, vol: 0.06, filter: LP(1400) },
  ]),
  // Pipe battery (a pipe glows 30 ticks): an organ-pipe swell, a pad with a rising filter.
  'machine/pipe-charge': {
    vol: 0.652,
    voices: 3,
    gap: 0.1,
    layers: [
      ...[hz('D4'), hz('A4'), hz('D5')].map((f, i) => ({
        wave: 'saw' as const,
        freq: f * (1 + (i - 1) * 0.003),
        env: { a: 0.38, d: 0.12 },
        vol: 0.3,
        filter: LP(300, 3200),
      })),
      { wave: 'square', freq: hz('D3'), env: { a: 0.38, d: 0.12 }, vol: 0.25, filter: LP(300, 1600) },
      { wave: 'noise', env: { a: 0.3, d: 0.2 }, vol: 0.12, filter: HP(3000) },
    ],
  },
  // Anthem speaker (30 ticks before the anthem): loudspeaker crackle, hum and a feedback squeal.
  'machine/anthem-crackle': {
    vol: 1.084,
    voices: 1,
    gap: 0.3,
    layers: [
      { wave: 'noise', freq: 2500, env: { a: 0.005, s: 0.8, hold: 0.42, r: 0.06, d: 0.01 }, vol: 0.6, filter: BP(1800, undefined, 1.2), tremolo: { rate: 17, rateTo: 31, depth: 1, shape: 'saw' } },
      { wave: 'noise', env: { a: 0.005, s: 0.5, hold: 0.42, r: 0.06, d: 0.01 }, vol: 0.2, filter: BP(1200, undefined, 2) },
      { wave: 'square', freq: 100, env: { a: 0.02, s: 0.8, hold: 0.42, r: 0.06, d: 0.01 }, vol: 0.18, filter: BP(300, undefined, 1.5) },
      { wave: 'sine', freq: 2700, to: 2900, env: { a: 0.04, d: 0.16 }, vol: 0.12, delay: 0.05 },
      ...clack(1500, 0.3),
    ],
  },
};

export const CREATURES: Recipes = {
  // Croak telegraph (T 40): a rising throat rumble.
  'creature/croak-build': {
    vol: 0.754,
    voices: 2,
    gap: 0.2,
    layers: [
      { wave: 'saw', freq: 45, to: 85, sweep: 0.66, env: { a: 0.52, d: 0.14 }, vol: 0.75, filter: BP(350, 750, 1.2), tremolo: { rate: 14, rateTo: 26, depth: 0.7, shape: 'square' } },
      { wave: 'sine', freq: 45, to: 85, sweep: 0.66, env: { a: 0.52, d: 0.14 }, vol: 0.4 },
    ],
  },
  // "rrribbit": saw 80 Hz with 20 Hz AM, then a short "bit".
  'creature/croak': {
    vol: 1.272,
    voices: 2,
    gap: 0.15,
    layers: [
      { wave: 'saw', freq: 80, env: { a: 0.01, d: 0.02, s: 0.85, hold: 0.16, r: 0.03 }, vol: 0.7, filter: BP(700, undefined, 1.8), tremolo: { rate: 20, depth: 0.95, shape: 'square' } },
      { wave: 'sine', freq: 80, env: { a: 0.01, d: 0.02, s: 0.85, hold: 0.16, r: 0.03 }, vol: 0.45, tremolo: { rate: 20, depth: 0.9, shape: 'square' } },
      { wave: 'saw', freq: 115, to: 125, delay: 0.24, env: { a: 0.006, d: 0.08 }, vol: 0.65, filter: BP(900, undefined, 1.8) },
      { wave: 'sine', freq: 115, delay: 0.24, env: { a: 0.006, d: 0.08 }, vol: 0.35 },
    ],
  },
  // Wind-up bot self-destruct (T 30): ratchet clicks speeding up, over a tightening spring whine.
  'creature/windup': {
    vol: 0.401,
    voices: 2,
    gap: 0.2,
    layers: [
      { wave: 'noise', env: { a: 0.005, s: 0.9, hold: 0.43, r: 0.06, d: 0.01 }, vol: 0.8, filter: HP(2500), tremolo: { rate: 11, rateTo: 46, depth: 1, shape: 'saw' } },
      { wave: 'square', freq: 1300, env: { a: 0.005, s: 0.9, hold: 0.43, r: 0.06, d: 0.01 }, vol: 0.12, filter: LP(3000), tremolo: { rate: 11, rateTo: 46, depth: 1, shape: 'saw' } },
      { wave: 'triangle', freq: 300, to: 950, env: { a: 0.1, s: 0.8, hold: 0.33, r: 0.06, d: 0.02 }, vol: 0.18 },
    ],
  },
  // Rattler lunge telegraph (T 45): maraca "chk-chk" (short noise bursts), three times.
  'creature/rattle': {
    vol: 0.625,
    voices: 2,
    gap: 0.2,
    layers: [0, 0.09, 0.25, 0.34, 0.5, 0.59].flatMap((t, i) => [
      noise(0.05, i % 2 ? 0.6 : 0.8, HP(3500), { delay: t }),
      noise(0.035, 0.3, BP(6500, undefined, 2), { delay: t + 0.004 }),
    ]),
  },
  // Echo bat dive telegraph (T 20): a high pulse squeal (with its own echo).
  'creature/bat-screech': {
    vol: 0.471,
    voices: 2,
    gap: 0.15,
    layers: [
      { wave: 'pulse', duty: 0.18, freq: 2400, to: 3400, sweep: 0.12, bend: [[0.12, 0], [0.2, -5]], env: { a: 0.006, d: 0.02, s: 0.8, hold: 0.13, r: 0.04 }, vol: 0.55, vibrato: { rate: 30, depth: 1 }, filter: LP(6000) },
    ],
    echo: { delay: 0.06, feedback: 0.3, mix: 0.35 },
  },
  // Avalanche goat: a noise snort, then "mehh" (pulse 50 % with an 8 Hz vibrato through two formants).
  'creature/goat': {
    vol: 1.034,
    voices: 2,
    gap: 0.2,
    layers: [
      noise(0.07, 0.6, BP(900, undefined, 1)),
      { wave: 'pulse', duty: 0.5, freq: 300, bend: [[0.08, 1], [0.5, -1]], delay: 0.08, env: { a: 0.02, d: 0.03, s: 0.8, hold: 0.36, r: 0.08 }, vol: 0.5, vibrato: { rate: 8, depth: 1.2 }, filter: BP(750, undefined, 2) },
      { wave: 'pulse', duty: 0.5, freq: 300, bend: [[0.08, 1], [0.5, -1]], delay: 0.08, env: { a: 0.02, d: 0.03, s: 0.8, hold: 0.36, r: 0.08 }, vol: 0.3, vibrato: { rate: 8, depth: 1.2 }, filter: BP(2200, undefined, 3) },
    ],
  },
  // Usher-bot shush (T 30): "SHHH", high-passed noise (3 kHz), 400 ms.
  'creature/shush': {
    vol: 0.261,
    voices: 2,
    gap: 0.2,
    layers: [
      { wave: 'noise', env: { a: 0.04, d: 0.02, s: 0.85, hold: 0.26, r: 0.08 }, vol: 0.8, filter: HP(3000) },
      { wave: 'noise', env: { a: 0.04, d: 0.02, s: 0.85, hold: 0.26, r: 0.08 }, vol: 0.35, filter: BP(4500, undefined, 2) },
    ],
  },
  // Kazoo drones (loop, 0.5 s): a buzzy saw with a heavy vibrato; 520 / 524 Hz beat at 4 Hz.
  'creature/kazoo': loopRecipe(0.5, 0.189, [
    { wave: 'saw', freq: 520, vibrato: { rate: 8, depth: 0.8 }, fm: { ratio: 1, index: 1.2 }, vol: 0.5, filter: BP(1400, undefined, 1.2), drive: 1.5 },
    { wave: 'saw', freq: 524, vibrato: { rate: 8, depth: 0.8 }, vol: 0.3, filter: BP(2600, undefined, 2) },
  ]),
};
