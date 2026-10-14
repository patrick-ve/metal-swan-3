/**
 * Player, item and hostage sounds (GDD §12.1 "Player, items, hostages").
 * The player plays its own sounds through `Player.sfx`, so Helium Head pitches them up (× 1.6).
 */
import { BP, clack, click, fmBell, HP, hz, LP, note, noise, seq, tone, type Recipes } from './kit';

export const PLAYER: Recipes = {
  // A footfall on cobbles (2026-10-14, missions with `footsteps`): a soft low-passed scuff and a
  // tiny heel thump, 45 ms. Very quiet: it repeats every 14 ticks at a run.
  'player/step': {
    vol: 1.2,
    voices: 2,
    gap: 0.06,
    jitter: 0.06,
    layers: [noise(0.035, 0.6, LP(1500, 500)), tone('sine', 140, 80, 0.03, 0.5)],
  },
  // The player wades into (or drops into) canal water (2026-10-14): a slap, a wash and droplets, 0.32 s.
  'player/splash': {
    vol: 1.2,
    voices: 2,
    gap: 0.12,
    layers: [
      noise(0.08, 0.8, LP(1400, 400)),
      { wave: 'noise', env: { a: 0.004, d: 0.2 }, vol: 0.4, filter: BP(800, 1700, 1.2) },
      tone('sine', 140, 70, 0.06, 0.4),
      ...[0.05, 0.09, 0.14, 0.2].map((d, i) => tone('sine', 900 + i * 260, (900 + i * 260) * 1.6, 0.03, 0.2, { delay: d })),
    ],
  },
  // Soft pulse 300 → 500 Hz, 60 ms.
  'player/jump': {
    vol: 0.674,
    voices: 2,
    gap: 0.05,
    layers: [tone('pulse', 300, 500, 0.06, 0.6, { duty: 0.25, filter: LP(2500) }), noise(0.02, 0.15, BP(1500, 3000, 1))],
  },
  // Soft noise thump, 40 ms.
  'player/land': {
    vol: 0.894,
    voices: 2,
    gap: 0.06,
    layers: [noise(0.04, 0.8, LP(700)), tone('sine', 95, 50, 0.04, 0.6)],
  },
  // Pulse slide 800 → 100 Hz over 500 ms, ending in a spring "boing" (triangle wobble).
  'player/die': {
    vol: 0.854,
    voices: 2,
    gap: 0.2,
    layers: [
      tone('pulse', 800, 100, 0.5, 0.45, { duty: 0.25, filter: LP(3000) }),
      { wave: 'triangle', freq: 230, env: { a: 0.004, d: 0.4 }, vol: 0.7, delay: 0.42, vibrato: { rate: 13, depth: 3.5 } },
    ],
  },
  // A feather "fwump" and a small rising 3-note arpeggio.
  'player/spawn': {
    vol: 0.663,
    voices: 2,
    gap: 0.2,
    layers: [
      noise(0.12, 0.6, LP(900, 400)),
      { wave: 'pulse', duty: 0.25, freq: hz('D5'), arp: [0, 4, 7], arpTime: 0.06, env: { a: 0.003, s: 0.7, hold: 0.12, r: 0.06, d: 0.02 }, vol: 0.4, delay: 0.05 },
      { wave: 'triangle', freq: hz('D4'), arp: [0, 4, 7], arpTime: 0.06, env: { a: 0.003, s: 0.7, hold: 0.12, r: 0.06, d: 0.02 }, vol: 0.4, delay: 0.05 },
    ],
  },
  // Rising balloon squeal (pulse 400 → 1600 Hz, vibrato, 300 ms).
  'player/helium-on': {
    vol: 0.691,
    voices: 1,
    gap: 0.2,
    layers: [{ wave: 'pulse', duty: 0.25, freq: 400, to: 1600, env: { a: 0.01, d: 0.29 }, vol: 0.55, vibrato: { rate: 9, depth: 0.7 }, filter: LP(4500) }],
  },
  // A big noise BANG (150 ms) and a confetti sparkle.
  'player/helium-pop': {
    vol: 0.59,
    voices: 1,
    gap: 0.2,
    layers: [
      noise(0.15, 0.9, LP(5000, 900), { drive: 1.2 }),
      tone('sine', 120, 50, 0.08, 0.5),
      ...fmBell(2600, 0.09, 0.2, { delay: 0.06 }),
      ...fmBell(3300, 0.08, 0.18, { delay: 0.12 }),
      ...fmBell(2100, 0.09, 0.18, { delay: 0.17 }),
    ],
    drive: 0.6,
  },
  // A long "pffft": band-passed noise sweeping down + a pulse wobble, 500 ms.
  'player/helium-deflate': {
    vol: 0.903,
    voices: 1,
    gap: 0.2,
    layers: [
      { wave: 'noise', env: { a: 0.02, d: 0.48 }, vol: 0.7, filter: BP(2500, 500, 2) },
      { wave: 'pulse', duty: 0.25, freq: 700, to: 250, env: { a: 0.01, d: 0.49 }, vol: 0.3, vibrato: { rate: 14, depth: 1.5 }, filter: LP(2500) },
    ],
  },
  // Time-up yawn: a falling pulse with vibrato, 600 ms.
  'player/yawn': {
    vol: 0.5,
    voices: 1,
    gap: 0.3,
    layers: [
      { wave: 'pulse', duty: 0.5, freq: 520, to: 260, env: { a: 0.06, s: 0.7, hold: 0.32, r: 0.18, d: 0.04 }, vol: 0.45, vibrato: { rate: 5, depth: 0.5 }, filter: LP(1600) },
      { wave: 'noise', env: { a: 0.1, s: 0.6, hold: 0.25, r: 0.2, d: 0.05 }, vol: 0.15, filter: BP(900, 500, 1.5) },
    ],
  },
};

// ---------------------------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------------------------

/**
 * The Cygnet hook (GDD §12.2; `CYGNET_HOOK` in music/index.ts: F♯ D | E D B A G, dotted) as
 * [semitones above F♯, rows]. `item/1up` plays it fast, an octave up, on a pulse.
 */
const CYGNET: readonly (readonly [number, number])[] = [
  [0, 4],
  [8, 12],
  [10, 3],
  [8, 1],
  [5, 3],
  [3, 1],
  [1, 6],
];

export const ITEMS: Recipes = {
  // Bombs picked up while riding (2026-10-14, the RELOAD! line): a magazine slides in and a
  // breech clacks shut, 0.32 s.
  'weapon/reload': {
    vol: 0.78,
    voices: 2,
    gap: 0.1,
    layers: [
      ...clack(1700, 0.6, 0, 0.02),
      { wave: 'noise', env: { a: 0.01, d: 0.1 }, vol: 0.35, delay: 0.03, filter: BP(1800, 3400, 2) },
      ...clack(2300, 0.8, 0.2, 0.025),
      tone('triangle', 260, 180, 0.05, 0.4, { delay: 0.2 }),
    ],
  },
  // Generic pickup: a bright two-note blip.
  'item/pickup': {
    vol: 0.647,
    voices: 3,
    gap: 0.04,
    layers: [
      { wave: 'pulse', duty: 0.25, freq: hz('A5'), arp: [0, 7], arpTime: 0.05, env: { a: 0.002, s: 0.7, hold: 0.07, r: 0.05, d: 0.01 }, vol: 0.45 },
      { wave: 'triangle', freq: hz('A4'), arp: [0, 7], arpTime: 0.05, env: { a: 0.002, s: 0.7, hold: 0.07, r: 0.05, d: 0.01 }, vol: 0.45 },
    ],
  },
  // Weapon: a quick 3-note arpeggio up (pulse 25 %).
  'item/weapon': {
    vol: 0.585,
    voices: 2,
    gap: 0.08,
    layers: [
      { wave: 'pulse', duty: 0.25, freq: hz('D5'), arp: [0, 4, 7], arpTime: 0.055, env: { a: 0.002, s: 0.75, hold: 0.15, r: 0.08, d: 0.01 }, vol: 0.4 },
      { wave: 'triangle', freq: hz('D4'), arp: [0, 4, 7], arpTime: 0.055, env: { a: 0.002, s: 0.8, hold: 0.15, r: 0.08, d: 0.01 }, vol: 0.5 },
    ],
    echo: { delay: 0.08, feedback: 0.2, mix: 0.25 },
  },
  // Bombs: two low "thunk" notes.
  'item/bombs': {
    vol: 0.863,
    voices: 2,
    gap: 0.08,
    layers: [
      tone('triangle', hz('G3'), 160, 0.09, 0.8),
      noise(0.03, 0.35, LP(800)),
      tone('triangle', hz('D3'), 120, 0.11, 0.8, { delay: 0.1 }),
      noise(0.03, 0.35, LP(700), { delay: 0.1 }),
    ],
  },
  // Score items: a short sparkle.
  'item/score': {
    vol: 0.623,
    voices: 3,
    gap: 0.04,
    layers: [...fmBell(hz('E6'), 0.12, 0.55, { ratio: 3.5, index: 2.5 }), ...fmBell(hz('A6'), 0.16, 0.45, { ratio: 3.5, index: 2.5, delay: 0.06 })],
  },
  // Food: "nom" (a triangle blip + noise, twice).
  'item/food': {
    vol: 1.046,
    voices: 2,
    gap: 0.06,
    layers: [tone('triangle', 440, 330, 0.07, 0.7), noise(0.03, 0.3, LP(1500)), tone('triangle', 520, 380, 0.07, 0.6, { delay: 0.09 }), noise(0.025, 0.25, LP(1500), { delay: 0.09 })],
  },
  // Gems: two high sparkly FM bell notes (the items code may pitch it up with the value).
  'item/gem': {
    vol: 0.451,
    voices: 3,
    gap: 0.04,
    layers: [...fmBell(hz('B5'), 0.16, 0.6, { ratio: 3.5, index: 3, octave: 0.2 }), ...fmBell(hz('F#6'), 0.24, 0.55, { ratio: 3.5, index: 3, octave: 0.2, delay: 0.07 })],
  },
  // Extra life: the Cygnet hook played fast on a pulse (22 ms per row), over a triangle.
  'item/1up': {
    vol: 0.439,
    voices: 1,
    gap: 0.3,
    layers: [
      ...seq(
        CYGNET.map(([semi, rows]) => [hz('F#5') * Math.pow(2, semi / 12), rows * 0.022] as const),
        (f, len, delay) => note('pulse', f, Math.max(0.02, len - 0.03), 0.42, delay, { duty: 0.25 }),
      ),
      ...seq(
        CYGNET.map(([semi, rows]) => [hz('F#4') * Math.pow(2, semi / 12), rows * 0.022] as const),
        (f, len, delay) => note('triangle', f, Math.max(0.02, len - 0.03), 0.35, delay),
      ),
    ],
  },
  // Repair: ratchet clicks, then a rising two-tone.
  'item/repair': {
    vol: 0.577,
    voices: 1,
    gap: 0.2,
    layers: [
      ...[0, 0.04, 0.08, 0.12].map((d) => click(1500, 0.4, d)),
      note('pulse', hz('E5'), 0.08, 0.35, 0.18, { duty: 0.25 }),
      note('pulse', hz('A5'), 0.12, 0.35, 0.28, { duty: 0.25 }),
    ],
  },
  // Wood crack of a breaking crate: noise + a square click, and splinters.
  'item/crate-break': {
    vol: 0.884,
    voices: 3,
    gap: 0.05,
    layers: [
      noise(0.12, 0.85, BP(1500, 700, 0.9), { drive: 0.8 }),
      tone('square', 190, 90, 0.07, 0.4, { filter: LP(1500) }),
      click(2400, 0.3, 0.04),
      click(1800, 0.25, 0.09),
      noise(0.06, 0.3, LP(600), { delay: 0.1 }),
    ],
  },
};

// ---------------------------------------------------------------------------------------------
// Hostages
// ---------------------------------------------------------------------------------------------

export const HOSTAGES: Recipes = {
  // Rope snap, then a two-note chirp.
  'hostage/free': {
    vol: 0.622,
    voices: 2,
    gap: 0.1,
    layers: [noise(0.03, 0.7, HP(3000)), click(1800, 0.3), note('pulse', hz('C6'), 0.05, 0.35, 0.05, { duty: 0.125 }), note('pulse', hz('E6'), 0.08, 0.35, 0.12, { duty: 0.125 })],
  },
  // Two-note "ta-da" up.
  'hostage/give': {
    vol: 0.455,
    voices: 2,
    gap: 0.1,
    layers: [
      note('pulse', hz('G5'), 0.06, 0.4, 0, { duty: 0.25 }),
      note('pulse', hz('C6'), 0.2, 0.4, 0.09, { duty: 0.25 }),
      note('triangle', hz('C5'), 0.26, 0.4, 0),
    ],
  },
  // A sad 3-note slide down (triangle).
  'hostage/faint': {
    vol: 0.385,
    voices: 2,
    gap: 0.1,
    layers: [
      {
        wave: 'triangle',
        freq: hz('C5'),
        arp: [0, -2, -5],
        arpTime: 0.12,
        bend: [[0.3, 0], [0.42, -1.5]],
        env: { a: 0.003, s: 0.8, hold: 0.32, r: 0.08, d: 0.02 },
        vol: 0.8,
        vibrato: { rate: 6, depth: 0.25, delay: 0.1 },
      },
    ],
  },
  // The hidden composer: four FM bell notes, an original falling-then-rising figure.
  'hostage/composer': {
    vol: 0.477,
    voices: 1,
    gap: 0.3,
    layers: [
      ...fmBell(hz('A5'), 0.32, 0.5, { ratio: 3.5, index: 3 }),
      ...fmBell(hz('E5'), 0.32, 0.5, { ratio: 3.5, index: 3, delay: 0.16 }),
      ...fmBell(hz('F#5'), 0.32, 0.5, { ratio: 3.5, index: 3, delay: 0.32 }),
      ...fmBell(hz('B5'), 0.55, 0.55, { ratio: 3.5, index: 3, delay: 0.48, octave: 0.2 }),
    ],
  },
  // The tourist's camera: a shutter click and a short flash whine.
  'hostage/camera': {
    vol: 0.979,
    voices: 1,
    gap: 0.2,
    layers: [click(2500, 0.6), click(1800, 0.5, 0.05), noise(0.01, 0.3, HP(4000), { delay: 0.05 }), tone('sine', 2000, 4200, 0.25, 0.25, { delay: 0.06 })],
  },
};
