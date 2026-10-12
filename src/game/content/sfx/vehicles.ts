/**
 * Vehicle sounds (GDD §12.1 "Vehicles", §8, docs/design/swan-mount/feel.md §12): the shared
 * vehicle cues, the ridden SWAN-3 and the fleet (Sundae Driver, Bandwagon, Trumpeter).
 *
 * Swan timing notes (feel.md): `swan/step` plays on every foot contact (every 8–12 ticks at a
 * run), `swan/paddle` every 12 ticks while she swims (32 at rest), `swan/fire` every 4 ticks in a
 * stream, `swan/jump` at the start of the 4-tick squat (its "chunk" lands on the take-off tick),
 * `swan/glide` is a loop (`sfxLoop`) for at most 60 ticks, `swan/tired` in the last 12.
 */
import { BP, clack, click, fmBell, HP, honk, hz, LP, loopRecipe, noise, note, scatter, seq, tone, type Recipes } from './kit';

// ---------------------------------------------------------------------------------------------
// Shared vehicle cues (vehicle.ts plays mount / eject / hit / ram / warning / alarm)
// ---------------------------------------------------------------------------------------------

export const VEHICLES: Recipes = {
  // Hatch clunk, then a rising engine whine.
  'vehicle/enter': {
    vol: 1.061,
    voices: 2,
    gap: 0.2,
    layers: [
      noise(0.06, 0.7, LP(900)),
      tone('square', 120, 80, 0.06, 0.35, { filter: LP(800) }),
      ...clack(1400, 0.3, 0.01),
      { wave: 'saw', freq: 80, to: 230, env: { a: 0.05, d: 0.45 }, vol: 0.45, delay: 0.05, filter: LP(1100) },
      { wave: 'pulse', duty: 0.25, freq: 160, to: 460, env: { a: 0.05, d: 0.4 }, vol: 0.12, delay: 0.05, filter: LP(2200) },
    ],
  },
  // Spring "boing" and a hatch pop.
  'vehicle/exit': {
    vol: 0.7,
    voices: 2,
    gap: 0.2,
    layers: [
      click(1300, 0.4),
      noise(0.03, 0.35, BP(1800, undefined, 1.5)),
      { wave: 'triangle', freq: 210, env: { a: 0.003, d: 0.32 }, vol: 0.75, delay: 0.02, vibrato: { rate: 14, depth: 4 } },
    ],
  },
  // Metal clang (FM, 300 Hz) and a crunch.
  'vehicle/hit': {
    vol: 0.624,
    voices: 3,
    gap: 0.05,
    layers: [
      ...fmBell(300, 0.24, 0.7, { ratio: 1.41, index: 5, decay: 0.05 }),
      noise(0.18, 0.6, LP(2600, 500), { drive: 1.2 }),
      noise(0.012, 0.4, HP(3000)),
    ],
  },
  // Vehicle cannon (not a GDD id; `weapon/cannon` is its alias): a deep boom.
  'vehicle/cannon': {
    vol: 0.584,
    voices: 3,
    gap: 0.05,
    layers: [
      tone('sine', 120, 40, 0.32, 0.5),
      tone('saw', 140, 50, 0.25, 0.35, { filter: LP(700) }),
      noise(0.3, 0.8, LP(2400, 350), { drive: 1.3 }),
      click(900, 0.3),
    ],
    drive: 0.6,
    echo: { delay: 0.1, feedback: 0.2, mix: 0.2 },
  },
  // Two-tone beep (pulse 880 and 660 Hz), played every 60 ticks at ≤ 1 cell.
  'vehicle/warning': {
    vol: 0.495,
    voices: 1,
    gap: 0.3,
    layers: [note('pulse', 880, 0.08, 0.45, 0, { duty: 0.5, filter: LP(3000) }), note('pulse', 660, 0.08, 0.45, 0.12, { duty: 0.5, filter: LP(3000) })],
  },
  // Fast alternating two-tone (880 / 660 Hz at 8 Hz: 62.5 ms per tone) for the last 60 ticks.
  // One play covers the whole second; the long gap swallows the repeats vehicle.ts asks for.
  'vehicle/alarm': {
    vol: 0.416,
    voices: 1,
    gap: 0.9,
    layers: [
      { wave: 'pulse', duty: 0.5, freq: 880, arp: [0, -5], arpTime: 0.0625, env: { a: 0.003, s: 0.85, hold: 0.95, r: 0.04, d: 0.01 }, vol: 0.45, filter: LP(2800) },
      { wave: 'triangle', freq: 440, arp: [0, -5], arpTime: 0.0625, env: { a: 0.003, s: 0.85, hold: 0.95, r: 0.04, d: 0.01 }, vol: 0.3 },
    ],
  },
  // Ram: a rising, wobbling siren (the blast itself is `explosion/l`, played on impact).
  'vehicle/ram': {
    vol: 0.628,
    voices: 1,
    gap: 0.3,
    layers: [
      { wave: 'saw', freq: 380, to: 1250, sweep: 0.75, env: { a: 0.02, s: 0.85, hold: 0.62, r: 0.12, d: 0.02 }, vol: 0.45, vibrato: { rate: 7, depth: 0.5 }, filter: LP(3200) },
      { wave: 'square', freq: 190, to: 625, sweep: 0.75, env: { a: 0.02, s: 0.85, hold: 0.62, r: 0.12, d: 0.02 }, vol: 0.18, vibrato: { rate: 7, depth: 0.5 }, filter: LP(1800) },
      noise(0.08, 0.4, LP(1200)),
    ],
  },
  // The Sundae Driver's jingle: 8 original music-box notes (FM bell + pulse 12.5 %) that stop on
  // an open note (D after a C-major descent).
  'vehicle/jingle': {
    vol: 0.563,
    voices: 1,
    gap: 1,
    layers: [hz('C6'), hz('A5'), hz('F5'), hz('A5'), hz('G5'), hz('E5'), hz('C5'), hz('D5')].flatMap((f, i) => [
      ...fmBell(f, i === 7 ? 0.5 : 0.24, 0.42, { ratio: 3.0, index: 2.2, decay: 0.05, delay: i * 0.11 }),
      note('pulse', f, i === 7 ? 0.22 : 0.05, 0.14, i * 0.11, { duty: 0.125, filter: LP(4000) }),
    ]),
  },
};

// ---------------------------------------------------------------------------------------------
// SWAN-3 (the ridden robot swan)
// ---------------------------------------------------------------------------------------------

/** The beak gun: the machine-gun recipe a major third (×1.26) higher. */
const THIRD = 1.26;

export const SWAN: Recipes = {
  // A webbed-paddle slap with a light hydraulic tick: a short low noise burst + a saw 60 Hz blip,
  // 50 ms. Quiet (it repeats every 8–12 ticks); the waddle plays it at a lower `vol`.
  'swan/step': {
    vol: 1.402,
    voices: 3,
    gap: 0.05,
    jitter: 0.04,
    layers: [
      noise(0.035, 0.75, LP(900, 300)),
      tone('saw', 60, 45, 0.045, 0.6, { filter: LP(400) }),
      noise(0.008, 0.18, HP(5000), { delay: 0.006 }),
      tone('square', 2200, 1600, 0.006, 0.08, { delay: 0.004, filter: LP(5000) }),
    ],
    // A short saw pluck starts on its low half: the high-pass keeps the slap free of DC.
    filter: HP(40),
  },
  // Swimming: a fast watery flutter (band-passed noise in 16th pulses) with two tiny droplets.
  'swan/paddle': {
    vol: 0.85,
    voices: 2,
    gap: 0.1,
    layers: [
      { wave: 'noise', env: { a: 0.002, s: 0.9, hold: 0.13, r: 0.05, d: 0.005 }, vol: 0.9, filter: BP(850, 1500, 2), tremolo: { rate: 22, depth: 1, shape: 'saw' } },
      { wave: 'noise', freq: 12000, env: { a: 0.002, s: 0.8, hold: 0.1, r: 0.04, d: 0.005 }, vol: 0.4, filter: BP(2400, undefined, 3), tremolo: { rate: 22, depth: 1, shape: 'saw', delay: 0.02 } },
      tone('sine', 1500, 2300, 0.022, 0.3, { delay: 0.06 }),
      tone('sine', 1900, 2900, 0.018, 0.25, { delay: 0.13 }),
    ],
  },
  // Beak gun: like `weapon/machine-gun`, a third higher.
  'swan/fire': {
    vol: 0.719,
    voices: 6,
    gap: 0.02,
    jitter: 0.05,
    layers: [
      noise(0.04, 0.7, LP(4200 * THIRD, 1500 * THIRD), { drive: 0.8 }),
      tone('pulse', 160 * THIRD, 80 * THIRD, 0.04, 0.55, { duty: 0.5, filter: LP(1200 * THIRD) }),
      click(2000 * THIRD, 0.25),
    ],
  },
  // THE signature sound: saw + pulse at 220 Hz through a nasal 1.2 kHz band-pass, a pitch scoop up,
  // 400 ms (kit `honk`). The mission-complete jingle also plays it.
  'swan/honk': {
    vol: 0.83,
    voices: 2,
    gap: 0.15,
    layers: honk({ base: 220, len: 0.4 }),
    drive: 0.6,
  },
  // No shells for a HONK: a thin, sad squeak that tries to rise and gives up.
  'swan/squeak': {
    vol: 0.811,
    voices: 1,
    gap: 0.2,
    layers: [
      { wave: 'pulse', duty: 0.18, freq: 880, bend: [[0, -3], [0.05, 0], [0.09, 0.5], [0.2, -4]], env: { a: 0.006, d: 0.03, s: 0.7, hold: 0.1, r: 0.07 }, vol: 0.55, filter: BP(1900, undefined, 2.5), vibrato: { rate: 11, depth: 0.4, delay: 0.06 } },
      { wave: 'noise', env: { a: 0.01, d: 0.12 }, vol: 0.25, delay: 0.1, filter: BP(2600, 1200, 1.5) },
    ],
  },
  // Take-off: a hydraulic "ka-chunk" (two low square clicks + a saw 80 Hz blip; the "chunk" is on
  // the take-off tick, 4 ticks after the press) and a steam hiss (high-passed noise, 150 ms).
  'swan/jump': {
    vol: 0.782,
    voices: 2,
    gap: 0.08,
    layers: [
      tone('square', 190, 120, 0.025, 0.4, { filter: LP(1400) }),
      noise(0.015, 0.3, BP(1600, undefined, 1.5)),
      tone('square', 150, 90, 0.03, 0.5, { delay: 0.066, filter: LP(1200) }),
      tone('saw', 80, 55, 0.06, 0.6, { delay: 0.066, filter: LP(500) }),
      { wave: 'noise', env: { a: 0.01, d: 0.14 }, vol: 0.4, delay: 0.07, filter: HP(4200) },
    ],
  },
  // A landing after a fall of ≥ 60 px: a heavy thump (low-passed noise + a saw 50 Hz pitch drop)
  // and a metal clank (FM bell 300 Hz), 200 ms.
  'swan/land': {
    vol: 0.567,
    voices: 2,
    gap: 0.1,
    layers: [
      noise(0.12, 0.85, LP(1100, 250), { drive: 0.8 }),
      tone('saw', 50, 32, 0.15, 0.6, { filter: LP(300) }),
      tone('sine', 90, 40, 0.12, 0.3),
      ...fmBell(300, 0.2, 0.5, { ratio: 1.41, index: 4, decay: 0.04, delay: 0.012 }),
    ],
    drive: 0.6,
  },
  // Skid start: a webbed-foot screech (band-passed noise 3 kHz → 1 kHz) over a hydraulic hiss,
  // 10 ticks.
  'swan/skid': {
    vol: 1.193,
    voices: 1,
    gap: 0.1,
    layers: [
      { wave: 'noise', env: { a: 0.006, s: 0.85, hold: 0.11, r: 0.045, d: 0.005 }, vol: 0.9, filter: BP(3000, 1000, 5), tremolo: { rate: 34, depth: 0.35 } },
      { wave: 'pulse', duty: 0.2, freq: 1500, to: 600, env: { a: 0.006, s: 0.8, hold: 0.1, r: 0.05, d: 0.01 }, vol: 0.08, filter: BP(1400, undefined, 2) },
      { wave: 'noise', env: { a: 0.01, d: 0.16 }, vol: 0.25, filter: HP(5000) },
    ],
  },
  // The glide opens: a deep wing whump (low-passed noise burst), a latch clack and a servo whirr
  // (pulse 12.5 %, 300 → 600 Hz), 150 ms.
  'swan/flap': {
    vol: 1.06,
    voices: 1,
    gap: 0.1,
    layers: [
      { wave: 'noise', freq: 6000, env: { a: 0.012, d: 0.12 }, vol: 0.9, filter: LP(700, 220) },
      tone('sine', 110, 60, 0.1, 0.4),
      ...clack(1800, 0.25),
      { wave: 'pulse', duty: 0.125, freq: 300, to: 600, sweep: 0.13, env: { a: 0.01, s: 0.8, hold: 0.09, r: 0.04, d: 0.01 }, vol: 0.16, filter: LP(2400) },
    ],
  },
  // The wings fold: a short clack (two square clicks, 30 ms).
  'swan/fold': {
    vol: 1.307,
    voices: 1,
    gap: 0.05,
    layers: [...clack(1600, 0.5, 0, 0.012), ...clack(1200, 0.45, 0.015, 0.014)],
  },
  // Loop while she glides: soft wind (band-passed noise around 800 Hz with a slow tremolo).
  // 0.8 s: the tremolo makes 2 and 1 whole cycles.
  'swan/glide': loopRecipe(0.8, 0.467, [
    { wave: 'noise', vol: 0.9, filter: BP(800, undefined, 1.3), tremolo: { rate: 2.5, depth: 0.7 } },
    { wave: 'noise', vol: 0.45, filter: BP(1700, undefined, 2), tremolo: { rate: 1.25, depth: 0.8 } },
    { wave: 'noise', freq: 800, vol: 0.2, filter: LP(400) },
  ]),
  // The last 12 glide ticks: a falling wheeze (noise + pulse 600 → 200 Hz, 200 ms).
  'swan/tired': {
    vol: 0.836,
    voices: 1,
    gap: 0.2,
    layers: [
      { wave: 'noise', env: { a: 0.02, d: 0.18 }, vol: 0.6, filter: BP(1600, 700, 1.4) },
      { wave: 'pulse', duty: 0.25, freq: 600, to: 200, env: { a: 0.015, d: 0.185 }, vol: 0.4, vibrato: { rate: 13, depth: 0.6 }, filter: LP(1800) },
    ],
  },
  // A stomp: a spring "boing" (triangle with a fast wobble) and a crunch (short noise burst).
  'swan/stomp': {
    vol: 0.771,
    voices: 2,
    gap: 0.08,
    layers: [
      noise(0.07, 0.8, LP(2600, 600), { drive: 1 }),
      tone('square', 160, 90, 0.04, 0.3, { filter: LP(900) }),
      { wave: 'triangle', freq: 240, to: 300, sweep: 0.25, env: { a: 0.003, d: 0.28 }, vol: 0.75, delay: 0.015, vibrato: { rate: 16, depth: 3 } },
    ],
  },
  // Landing in water: a water slap (low noise burst) and droplets (random high pulse blips), 250 ms.
  'swan/splash': {
    vol: 1.348,
    voices: 2,
    gap: 0.1,
    layers: [
      noise(0.09, 0.85, LP(1300, 350)),
      { wave: 'noise', env: { a: 0.004, d: 0.16 }, vol: 0.45, filter: BP(700, 1500, 1.2) },
      tone('sine', 120, 60, 0.07, 0.4),
      // Droplets: short rising blips at fixed pseudo-random pitches and times.
      ...scatter(6, 0x5a1a54).map((r, i) =>
        tone('pulse', 1500 + r * 1800, (1500 + r * 1800) * 1.5, 0.025, 0.32, { duty: 0.125, delay: 0.045 + i * 0.03 + r * 0.012, filter: LP(5000) }),
      ),
    ],
  },
  // SWAN DIVE wind-up: an angry hiss (high-passed noise with a fast tremolo), 6 ticks.
  'swan/hiss': {
    vol: 0.53,
    voices: 1,
    gap: 0.1,
    layers: [
      { wave: 'noise', env: { a: 0.008, s: 0.9, hold: 0.06, r: 0.03, d: 0.004 }, vol: 0.85, filter: HP(3200), tremolo: { rate: 42, depth: 0.55 } },
      { wave: 'noise', env: { a: 0.008, s: 0.8, hold: 0.06, r: 0.03, d: 0.004 }, vol: 0.4, filter: BP(2400, undefined, 3), drive: 1.5 },
    ],
  },
  // The daze after a dive: three wobbly falling notes (triangle with vibrato).
  'swan/dazed': {
    vol: 0.404,
    voices: 1,
    gap: 0.3,
    layers: seq(
      [
        [hz('A5'), 0.17],
        [hz('F5'), 0.17],
        [hz('C#5'), 0.3],
      ],
      (f, len, delay) => ({ wave: 'triangle', freq: f, to: f * 0.94, sweep: len, env: { a: 0.004, d: 0.02, s: 0.75, hold: len - 0.04, r: 0.05 }, vol: 0.75, delay, vibrato: { rate: 7, depth: 0.7 } }),
    ),
  },
  // She flies away: the honk sliding down a fourth and fading out over 1 s.
  'swan/migrate': {
    vol: 0.75,
    voices: 1,
    gap: 0.5,
    layers: honk({ base: 220, len: 1.0, slide: -5, fade: true }),
    drive: 0.6,
  },
};

// ---------------------------------------------------------------------------------------------
// The fleet: Sundae Driver, Bandwagon, Trumpeter
// ---------------------------------------------------------------------------------------------

export const FLEET: Recipes = {
  // Cartoon "bloop" lob of the sundae mortar.
  'sundae/mortar': {
    vol: 0.771,
    voices: 3,
    gap: 0.06,
    layers: [
      { wave: 'sine', freq: 170, to: 720, sweep: 0.09, curve: 1.6, env: { a: 0.002, d: 0.13 }, vol: 0.85 },
      { wave: 'triangle', freq: 340, to: 1440, sweep: 0.09, curve: 1.6, env: { a: 0.002, d: 0.08 }, vol: 0.2 },
      noise(0.03, 0.45, LP(1400)),
      tone('sine', 900, 1300, 0.03, 0.18, { delay: 0.12 }),
    ],
  },
  // Brass cannon: a saw chord stab (B♭ major), a brassy filter "blat".
  'bandwagon/brass': {
    vol: 0.253,
    voices: 3,
    gap: 0.06,
    layers: [hz('Bb2'), hz('Bb3'), hz('D4'), hz('F4')].map((f, i) => ({
      wave: 'saw' as const,
      freq: f * 0.985,
      to: f,
      sweep: 0.03,
      env: { a: 0.005, d: 0.03, s: 0.7, hold: 0.08, r: 0.05 },
      vol: i === 0 ? 0.45 : 0.32,
      filter: LP(3400, 900, 1.5),
      drive: 0.8,
    })),
  },
  // Drum boom: a bass-drum boom.
  'bandwagon/drum': {
    vol: 0.74,
    voices: 2,
    gap: 0.08,
    layers: [
      tone('sine', 120, 45, 0.38, 0.6, { sweep: 0.12 }),
      tone('triangle', 200, 90, 0.12, 0.5),
      noise(0.06, 0.5, BP(500, undefined, 1)),
      noise(0.012, 0.35, HP(2500)),
    ],
    drive: 0.5,
  },
  // Cymbal wall: a bright crash with a 600 ms decay.
  'bandwagon/cymbals': {
    vol: 0.545,
    voices: 2,
    gap: 0.1,
    layers: [
      noise(0.6, 0.7, HP(3500)),
      { wave: 'metal', freq: 21000, env: { a: 0.001, d: 0.55 }, vol: 0.32, filter: HP(5000) },
      ...fmBell(1450, 0.6, 0.18, { ratio: 2.76, index: 6, decay: 0.15 }),
      noise(0.02, 0.4, BP(2500, undefined, 1)),
    ],
  },
  // Trumpeter flap: two wing-beat noise whooshes.
  'trumpeter/flap': {
    vol: 1.701,
    voices: 1,
    gap: 0.15,
    layers: [0, 0.14].flatMap((delay, i) => [
      { wave: 'noise' as const, env: { a: 0.035, d: 0.1 }, vol: i === 0 ? 0.9 : 0.75, delay, filter: BP(500, 1300, 1.1) },
      { wave: 'noise' as const, freq: 5000, env: { a: 0.02, d: 0.08 }, vol: 0.45, delay, filter: LP(400) },
    ]),
  },
  // Bail out: a parachute pop and a short honk.
  'trumpeter/bail': {
    vol: 0.712,
    voices: 1,
    gap: 0.3,
    layers: [
      noise(0.05, 0.8, HP(1200)),
      noise(0.09, 0.6, LP(600)),
      tone('sine', 150, 70, 0.08, 0.4),
      ...honk({ base: 233, len: 0.2, delay: 0.1, vol: 0.85 }),
    ],
    drive: 0.4,
  },
};
