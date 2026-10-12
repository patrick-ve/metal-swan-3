/**
 * Weapon, explosion and hit sounds (GDD §12.1 "Weapons and bombs", "Explosions and hits").
 * The game layer plays `explosion/{s,m,l,xl}` (fx.ts), `hit/armor` (alias of `hit/metal`),
 * `bomb/throw|bounce` (aliases); the Gun plays `WeaponDef.sfx` once per shot.
 *
 * `weapon/laser` is a seamless loop (GDD: "loops while held"): start it with
 * `audio.sfxLoop(key, 'weapon/laser')` while the beam is on and `stopSfx(key)` when it ends.
 */
import { BP, clack, click, fmBell, HP, LP, loopRecipe, noise, tone, type Recipes } from './kit';

export const WEAPONS: Recipes = {
  // Short "pew": pulse 25 %, 1200 → 400 Hz in 60 ms, a tiny noise click and a little body.
  'weapon/pistol': {
    vol: 0.681,
    voices: 6,
    gap: 0.03,
    jitter: 0.02,
    layers: [
      { wave: 'pulse', duty: 0.25, freq: 1200, to: 400, sweep: 0.06, env: { a: 0.001, d: 0.06 }, vol: 0.55, filter: LP(6000) },
      noise(0.012, 0.5, HP(3000)),
      tone('triangle', 260, 120, 0.05, 0.35),
    ],
  },
  // Tight noise burst + low pulse thump, 40 ms; ±5 % random pitch (`jitter`).
  'weapon/mg': {
    vol: 0.728,
    voices: 6,
    gap: 0.02,
    jitter: 0.05,
    layers: [
      noise(0.04, 0.7, LP(4200, 1500), { drive: 0.8 }),
      tone('pulse', 160, 80, 0.04, 0.55, { duty: 0.5, filter: LP(1200) }),
      click(2000, 0.25),
    ],
  },
  // Vehicle gun (not a GDD id; the weapons slice uses it): heavier and lower than the machine gun.
  'weapon/vulcan': {
    vol: 0.718,
    voices: 6,
    gap: 0.025,
    jitter: 0.04,
    layers: [
      noise(0.06, 0.7, LP(2600, 900), { drive: 1 }),
      tone('pulse', 120, 60, 0.065, 0.6, { duty: 0.5, filter: LP(900) }),
      click(1200, 0.25),
    ],
  },
  // Wide blast (low-pass 6 kHz → 800 Hz, 180 ms) and a saw thump at 90 Hz; a two-click pump at 300 ms.
  'weapon/shotgun': {
    vol: 0.662,
    voices: 3,
    gap: 0.05,
    layers: [
      noise(0.18, 0.85, LP(6000, 800), { drive: 1.2 }),
      tone('saw', 90, 45, 0.16, 0.6, { filter: LP(500) }),
      noise(0.01, 0.4, HP(2500)),
      ...clack(900, 0.4, 0.3),
      ...clack(650, 0.45, 0.36),
    ],
  },
  // Launch "fwoosh": band-passed noise rising 400 Hz → 2 kHz, 300 ms, over a low kick.
  'weapon/rocket': {
    vol: 1.522,
    voices: 3,
    gap: 0.05,
    layers: [
      { wave: 'noise', env: { a: 0.02, d: 0.28 }, vol: 1, filter: BP(400, 2000, 1.2), drive: 0.6 },
      { wave: 'noise', env: { a: 0.04, d: 0.24 }, vol: 0.35, filter: BP(800, 4000, 2) },
      tone('sine', 160, 70, 0.1, 0.32),
      noise(0.04, 0.3, HP(3000)),
    ],
  },
  // Flame roar: noise low-passed at 1.2 kHz with a slow tremolo, 400 ms (re-triggered per press),
  // over a low rumble and a few crackles.
  'weapon/flame': {
    vol: 0.674,
    voices: 3,
    gap: 0.06,
    layers: [
      { wave: 'noise', env: { a: 0.025, d: 0.02, s: 0.85, hold: 0.29, r: 0.065 }, vol: 0.85, filter: LP(1200, undefined, 0.9), tremolo: { rate: 7, depth: 0.45 }, drive: 0.6 },
      { wave: 'noise', freq: 600, env: { a: 0.03, d: 0.02, s: 0.8, hold: 0.28, r: 0.07 }, vol: 0.5, filter: LP(350) },
      { wave: 'noise', freq: 3000, env: { a: 0.01, d: 0.37 }, vol: 0.3, filter: HP(2500), tremolo: { rate: 13, depth: 0.85, shape: 'saw' } },
    ],
  },
  // Laser beam (loop while held): saw 880 Hz with a 30 Hz vibrato and light FM. 0.2 s holds whole
  // cycles of 880 Hz, the 885 Hz partner, the 1760 Hz modulator and the 30 Hz vibrato.
  'weapon/laser': loopRecipe(0.2, 0.303, [
    { wave: 'saw', freq: 880, vibrato: { rate: 30, depth: 0.5 }, fm: { ratio: 2, index: 0.6 }, vol: 0.5, filter: LP(4500) },
    { wave: 'saw', freq: 885, vibrato: { rate: 30, depth: 0.4 }, vol: 0.3, filter: LP(3000) },
    { wave: 'sine', freq: 440, vol: 0.3 },
    { wave: 'noise', vol: 0.06, filter: HP(6000) },
  ]),
  // Two quick rising chirps (pulse 12.5 %, 600 → 1800 Hz, 80 ms each).
  'weapon/homing': {
    vol: 1.03,
    voices: 3,
    gap: 0.05,
    layers: [
      tone('pulse', 600, 1800, 0.08, 0.45, { duty: 0.125, filter: LP(5000) }),
      tone('pulse', 600, 1800, 0.08, 0.45, { duty: 0.125, delay: 0.09, filter: LP(5000) }),
      noise(0.05, 0.25, BP(1200, 2400, 1)),
    ],
  },
  // Fat "OOM-PAH": saw 70 Hz with a quick blip up a fifth and back, low-pass, 220 ms.
  'weapon/tuba': {
    vol: 0.702,
    voices: 3,
    gap: 0.05,
    layers: [
      { wave: 'saw', freq: 70, arp: [0, 7, 0], arpTime: 0.07, env: { a: 0.006, d: 0.03, s: 0.75, hold: 0.14, r: 0.045 }, vol: 0.75, filter: LP(950, 500) },
      { wave: 'saw', freq: 70.6, arp: [0, 7, 0], arpTime: 0.07, env: { a: 0.006, d: 0.03, s: 0.7, hold: 0.14, r: 0.045 }, vol: 0.35, filter: LP(700) },
      { wave: 'pulse', duty: 0.5, freq: 140, arp: [0, 7, 0], arpTime: 0.07, env: { a: 0.006, d: 0.21 }, vol: 0.22, filter: LP(1300) },
      noise(0.03, 0.3, BP(500, undefined, 1.2)),
    ],
  },
  // Low "thunk" launch (triangle 140 Hz, 60 ms).
  'weapon/bounce-mine': {
    vol: 1.097,
    voices: 3,
    gap: 0.05,
    layers: [tone('triangle', 140, 110, 0.06, 0.85), noise(0.025, 0.35, LP(900))],
  },
  // Triangle "plink" 1200 Hz, 30 ms, on every bounce.
  'weapon/mine-bounce': {
    vol: 0.921,
    voices: 6,
    gap: 0.02,
    layers: [tone('triangle', 1200, 1150, 0.03, 0.7), tone('sine', 2400, 2350, 0.018, 0.25)],
  },
  // Dry click, then a comic deflating squeak (pulse 600 → 200 Hz, 120 ms).
  'weapon/empty': {
    vol: 0.989,
    voices: 2,
    gap: 0.12,
    layers: [
      click(2200, 0.6),
      noise(0.015, 0.4, BP(3000, undefined, 2)),
      tone('pulse', 600, 200, 0.12, 0.35, { duty: 0.25, delay: 0.03, filter: LP(2500) }),
    ],
  },
  // Short whoosh of a throw.
  'weapon/grenade-throw': {
    vol: 2.083,
    voices: 4,
    layers: [{ wave: 'noise', env: { a: 0.03, d: 0.12 }, vol: 0.9, filter: BP(700, 2600, 1.4) }],
  },
  // "Tonk" of a bouncing grenade (triangle 300 Hz, 40 ms).
  'weapon/grenade-bounce': {
    vol: 0.952,
    voices: 4,
    gap: 0.03,
    layers: [tone('triangle', 300, 260, 0.04, 0.85), noise(0.012, 0.3, BP(1500))],
  },
  // Knife swish: a high-passed noise sweep, 80 ms.
  'weapon/knife': {
    vol: 0.481,
    voices: 3,
    gap: 0.04,
    layers: [
      { wave: 'noise', env: { a: 0.02, d: 0.06 }, vol: 1, filter: HP(1200, 5500, 1.2) },
      { wave: 'noise', env: { a: 0.02, d: 0.05 }, vol: 0.4, filter: BP(2500, 6000, 2) },
    ],
  },
  // Grace's umbrella: a soft "fwip" (cloth through the air).
  'weapon/knife-umbrella': {
    vol: 2.225,
    voices: 3,
    gap: 0.04,
    layers: [
      { wave: 'noise', env: { a: 0.012, d: 0.075 }, vol: 1, filter: BP(700, 1900, 1.3) },
      { wave: 'noise', freq: 4000, env: { a: 0.012, d: 0.05 }, vol: 0.3, filter: LP(900), tremolo: { rate: 60, depth: 0.6, shape: 'saw' } },
    ],
  },
  // Mittens' knitting needles: "tik-tik" (two tiny metal ticks).
  'weapon/knife-needles': {
    vol: 0.871,
    voices: 3,
    gap: 0.04,
    layers: [
      ...fmBell(2900, 0.03, 0.55, { ratio: 3.5, index: 2, decay: 0.008 }),
      noise(0.006, 0.3, HP(5000)),
      ...fmBell(3400, 0.03, 0.55, { ratio: 3.5, index: 2, decay: 0.008, delay: 0.05 }),
      noise(0.006, 0.3, HP(5000), { delay: 0.05 }),
    ],
  },
  // Pip's frying pan: "BONK" (triangle 220 Hz + a bell partial, 150 ms).
  'weapon/knife-pan': {
    vol: 0.843,
    voices: 3,
    gap: 0.04,
    layers: [
      tone('triangle', 220, 205, 0.15, 0.8),
      ...fmBell(220 * 2.7, 0.12, 0.3, { ratio: 1.41, index: 2, decay: 0.03 }),
      noise(0.015, 0.35, BP(1200, undefined, 1)),
    ],
  },
  // Gramps' wrench: "CLANG" (FM bell 400 Hz, 250 ms).
  'weapon/knife-wrench': {
    vol: 0.565,
    voices: 3,
    gap: 0.04,
    layers: [...fmBell(400, 0.25, 0.75, { ratio: 1.41, index: 6, decay: 0.05, octave: 0.25 }), noise(0.02, 0.35, HP(3000))],
  },
};

// ---------------------------------------------------------------------------------------------
// Explosions: noise bursts with low-pass sweeps and a saw sub-drop; 200 / 400 / 900 ms
// ---------------------------------------------------------------------------------------------

/** The medium blast's layers (shared by `explosion/part` and `boss/part-break`). */
export const BLAST_M = [
  noise(0.4, 0.95, LP(4400, 360), { drive: 1.6 }),
  tone('saw', 120, 40, 0.34, 0.42, { filter: LP(520) }),
  tone('sine', 110, 42, 0.36, 0.35, { sweep: 0.25 }),
  noise(0.015, 0.35, HP(2500)),
];

export const EXPLOSIONS: Recipes = {
  'explosion/s': {
    vol: 0.618,
    voices: 4,
    gap: 0.03,
    layers: [
      noise(0.2, 0.9, LP(3600, 500), { drive: 1.4 }),
      tone('saw', 150, 55, 0.16, 0.4, { filter: LP(600) }),
      tone('sine', 140, 55, 0.18, 0.35),
      click(800, 0.3),
    ],
    drive: 0.8,
  },
  'explosion/m': {
    vol: 0.497,
    voices: 4,
    gap: 0.04,
    layers: BLAST_M,
    drive: 0.8,
    echo: { delay: 0.07, feedback: 0.18, mix: 0.2 },
    length: 0.5,
  },
  // The large blast adds a rumble tail (slow sample-and-hold noise is a low growl).
  'explosion/l': {
    vol: 0.524,
    voices: 3,
    gap: 0.06,
    layers: [
      noise(0.55, 0.95, LP(3400, 220), { drive: 1.8 }),
      tone('saw', 100, 32, 0.5, 0.42, { filter: LP(420) }),
      tone('sine', 90, 35, 0.6, 0.35, { sweep: 0.4 }),
      { wave: 'noise', freq: 260, env: { a: 0.08, d: 0.78 }, vol: 0.6, delay: 0.1, filter: LP(320) },
      noise(0.015, 0.35, HP(2500)),
    ],
    drive: 0.8,
    echo: { delay: 0.1, feedback: 0.2, mix: 0.2 },
    length: 0.95,
  },
  // Extra-large (not a GDD id; fx.ts plays it for the biggest blasts): two bursts and a long growl.
  'explosion/xl': {
    vol: 0.47,
    voices: 2,
    gap: 0.1,
    layers: [
      noise(0.9, 0.95, LP(3200, 180), { drive: 2 }),
      noise(0.7, 0.6, LP(2400, 160), { drive: 1.5, delay: 0.14 }),
      tone('saw', 90, 26, 0.85, 0.42, { filter: LP(380) }),
      tone('sine', 80, 28, 1.0, 0.4, { sweep: 0.6 }),
      { wave: 'noise', freq: 200, env: { a: 0.1, d: 1.2 }, vol: 0.6, delay: 0.15, filter: LP(260) },
    ],
    drive: 0.9,
    echo: { delay: 0.14, feedback: 0.25, mix: 0.22 },
    length: 1.45,
  },
  // A boss part bursting: `explosion/m` plus metal tinkles (FM bells at high, scattered pitches).
  'explosion/part': {
    vol: 0.522,
    voices: 3,
    gap: 0.05,
    layers: [
      ...BLAST_M,
      ...fmBell(2350, 0.14, 0.22, { delay: 0.08 }),
      ...fmBell(3150, 0.12, 0.18, { delay: 0.15 }),
      ...fmBell(1900, 0.15, 0.2, { delay: 0.23 }),
      ...fmBell(2750, 0.12, 0.16, { delay: 0.31 }),
    ],
    drive: 0.6,
    length: 0.5,
  },
};

// ---------------------------------------------------------------------------------------------
// Hits
// ---------------------------------------------------------------------------------------------

export const HITS: Recipes = {
  // A shot landed on an enemy: a short noise tick + a pulse blip.
  'hit/enemy': {
    vol: 0.828,
    voices: 5,
    gap: 0.025,
    jitter: 0.06,
    layers: [noise(0.03, 0.8, BP(2600, undefined, 1.2)), tone('pulse', 900, 600, 0.045, 0.45, { duty: 0.25, filter: LP(4000) })],
  },
  // FM bell "tink", 1.2 kHz, 60 ms (machines, boss parts, armour: alias `hit/armor`).
  'hit/metal': {
    vol: 0.518,
    voices: 5,
    gap: 0.03,
    jitter: 0.05,
    layers: [...fmBell(1200, 0.06, 0.8, { ratio: 3.5, index: 3, decay: 0.015 }), noise(0.01, 0.35, HP(3500))],
  },
  // A shot hit the ground (not a GDD id; crates and the slice use it).
  'hit/ground': {
    vol: 0.963,
    voices: 5,
    gap: 0.03,
    jitter: 0.06,
    layers: [noise(0.045, 0.85, LP(1400, 600)), tone('sine', 170, 80, 0.045, 0.5)],
  },
  // Dull boom: triangle 90 Hz with a fast pitch drop + noise, 120 ms (the drummer's drum).
  'hit/drum': {
    vol: 0.563,
    voices: 4,
    gap: 0.03,
    layers: [tone('triangle', 90, 50, 0.12, 0.9, { sweep: 0.04 }), tone('sine', 140, 60, 0.05, 0.4), noise(0.05, 0.4, LP(900)), noise(0.02, 0.3, BP(700, undefined, 1))],
    drive: 0.6,
  },
  // Hollow "tonk" (wreck blocks, the crash shield).
  'hit/shield': {
    vol: 1.167,
    voices: 4,
    gap: 0.03,
    layers: [
      tone('triangle', 330, 300, 0.1, 0.7, { filter: BP(700, undefined, 0.8) }),
      tone('triangle', 660, 600, 0.06, 0.35),
      noise(0.012, 0.25, BP(1800, undefined, 1.5)),
    ],
  },
};
