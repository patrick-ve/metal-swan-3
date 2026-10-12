/**
 * Fanfare Legion infantry sounds (GDD §12.1 "Enemies", §9.0–§9.1). Every attack telegraph is a
 * sound the player learns (GDD §4.11 rule 2), so telegraph sounds last their telegraph:
 * windup T 50, drumroll T 30, tuba-inhale T 36, cymbal-raise T 32, whistle T 20,
 * piccolo-whistle T 45, bassoon-aim T 40, grenade fuse T 20 (ticks at 60 Hz).
 */
import type { SfxRecipe } from '../../../engine/synth';
import { BP, clack, click, fmBell, hits, HP, hz, LP, note, noise, tone, type Recipes } from './kit';

/** A comic, voice-like yelp: a pulse through a vocal band, with a fast vibrato (death yelps). */
function yelp(vol: number, from: number, peak: number, to: number, len: number, wobble: number): SfxRecipe {
  return {
    vol,
    voices: 3,
    gap: 0.06,
    layers: [
      { wave: 'pulse', duty: 0.3, freq: from, to: peak, sweep: len * 0.3, env: { a: 0.004, s: 0.8, hold: len * 0.3, r: 0.02, d: 0.01 }, vol: 0.55, vibrato: { rate: wobble, depth: 0.6 }, filter: BP(1300, undefined, 0.8) },
      { wave: 'pulse', duty: 0.3, freq: peak, to, delay: len * 0.32, env: { a: 0.004, d: len * 0.7 }, vol: 0.55, vibrato: { rate: wobble, depth: 0.9 }, filter: BP(1100, undefined, 0.8) },
    ],
  };
}

/** A 40 ms blip: a 2 ms attack, 30 ms held, an 8 ms release (no click). */
const BLIP_40MS = { a: 0.002, d: 0.004, s: 0.85, hold: 0.026, r: 0.008 };

export const ENEMIES: Recipes = {
  // "!" blip: pulse 1500 Hz, 40 ms, twice.
  'enemy/alert': {
    vol: 0.676,
    voices: 2,
    gap: 0.08,
    layers: [0, 0.07].map((delay) => ({ wave: 'pulse' as const, duty: 0.25, freq: 1500, env: BLIP_40MS, vol: 0.45, delay })),
  },
  // A rounder, lower "pop" than the player's pistol.
  'enemy/rifle': {
    vol: 0.913,
    voices: 4,
    gap: 0.04,
    jitter: 0.03,
    layers: [tone('square', 620, 190, 0.09, 0.35, { filter: LP(2200) }), noise(0.05, 0.6, LP(2600, 900)), tone('sine', 160, 80, 0.07, 0.5)],
  },
  // Rifle raised (shot telegraph, not a GDD id): a soft metallic double click.
  'enemy/aim': {
    vol: 0.761,
    voices: 3,
    gap: 0.05,
    layers: [...fmBell(1900, 0.03, 0.6, { ratio: 2.3, index: 1.5 }), ...fmBell(1500, 0.04, 0.6, { ratio: 2.3, index: 1.5, delay: 0.06 }), noise(0.01, 0.3, HP(4000))],
  },
  // Three comic death yelps (one is picked per death with fxRng; `enemy/die` = the first).
  'enemy/die-1': yelp(0.516, 700, 1300, 380, 0.26, 18),
  'enemy/die-2': yelp(0.513, 900, 1000, 300, 0.34, 11),
  'enemy/die-3': yelp(0.646, 500, 1500, 600, 0.22, 24),
  // Comic triangle slide up, then down (the gag double-take).
  'enemy/double-take': {
    vol: 0.662,
    voices: 2,
    gap: 0.2,
    layers: [
      { wave: 'triangle', freq: 500, to: 1000, sweep: 0.1, env: { a: 0.003, d: 0.1 }, vol: 0.8 },
      { wave: 'triangle', freq: 1000, to: 500, delay: 0.12, env: { a: 0.003, d: 0.12 }, vol: 0.8 },
    ],
  },
  // The operatic swoon: one sung note, pulse 50 % with a 6 Hz vibrato, 500 ms (the knife combo
  // raises it one major-scale step per kill with the `pitch` option: `ARIA_STEPS`).
  'enemy/aria': {
    vol: 0.398,
    voices: 3,
    gap: 0.05,
    layers: [
      { wave: 'pulse', duty: 0.5, freq: hz('C5'), env: { a: 0.04, d: 0.04, s: 0.8, hold: 0.32, r: 0.1 }, vol: 0.45, vibrato: { rate: 6, depth: 0.45, delay: 0.08 }, filter: LP(2400) },
      { wave: 'triangle', freq: hz('C4'), env: { a: 0.04, d: 0.04, s: 0.8, hold: 0.32, r: 0.1 }, vol: 0.35, vibrato: { rate: 6, depth: 0.45, delay: 0.08 } },
      { wave: 'saw', freq: hz('C5'), env: { a: 0.06, d: 0.04, s: 0.7, hold: 0.3, r: 0.1 }, vol: 0.12, vibrato: { rate: 6, depth: 0.45, delay: 0.08 }, filter: BP(1100, undefined, 3) },
    ],
  },
  // A short falling yelp (deaths only).
  'enemy/scream': yelp(0.534, 1300, 1400, 450, 0.3, 20),
  // Panic (GDD 9.0: the Legion panics quietly): a quick tiptoe patter with a tiny worried hum.
  'enemy/panic': {
    vol: 0.963,
    voices: 2,
    gap: 0.3,
    layers: [
      ...hits(8, 0, 0.055).map((t, i) => noise(0.014, i % 2 ? 0.55 : 0.7, BP(i % 2 ? 2600 : 2100, undefined, 2.5), { delay: t })),
      ...hits(8, 0, 0.055).map((t) => tone('sine', 700, 500, 0.012, 0.18, { delay: t + 0.002 })),
      { wave: 'triangle', freq: hz('E5'), bend: [[0, 0], [0.12, 1], [0.24, 0], [0.36, 1], [0.45, -1]], env: { a: 0.03, d: 0.02, s: 0.7, hold: 0.33, r: 0.08 }, vol: 0.22, vibrato: { rate: 9, depth: 0.35 }, filter: LP(1800) },
    ],
  },
  // Heel click and a tiny two-note fanfare.
  'enemy/salute': {
    vol: 0.499,
    voices: 2,
    gap: 0.2,
    layers: [...clack(2000, 0.5), note('pulse', hz('G5'), 0.06, 0.35, 0.06, { duty: 0.25 }), note('pulse', hz('C6'), 0.14, 0.35, 0.14, { duty: 0.25 })],
  },
  // Butt-swing telegraph (T 50): a rising wind-up whoosh.
  'enemy/windup': {
    vol: 1.428,
    voices: 2,
    gap: 0.2,
    layers: [
      { wave: 'noise', env: { a: 0.6, d: 0.22 }, vol: 0.9, filter: BP(300, 1800, 1.6) },
      { wave: 'noise', env: { a: 0.6, d: 0.2 }, vol: 0.25, filter: BP(600, 3200, 3), tremolo: { rate: 6, rateTo: 14, depth: 0.5 } },
    ],
  },
  // Fuse hiss of a lit grenade (T 20): a crackling high hiss.
  'enemy/grenade': {
    vol: 0.685,
    voices: 2,
    gap: 0.2,
    layers: [
      { wave: 'noise', env: { a: 0.02, d: 0.02, s: 0.7, hold: 0.24, r: 0.06 }, vol: 0.6, filter: BP(5000, 4000, 1.2) },
      { wave: 'noise', freq: 9000, env: { a: 0.02, d: 0.02, s: 0.7, hold: 0.24, r: 0.06 }, vol: 0.35, filter: HP(3000), tremolo: { rate: 23, depth: 0.9, shape: 'saw' } },
    ],
  },
  // OOMPAH telegraph (T 36): a rising breath noise and a low saw swell.
  'enemy/tuba-inhale': {
    vol: 0.779,
    voices: 2,
    gap: 0.2,
    layers: [
      { wave: 'noise', env: { a: 0.45, d: 0.15 }, vol: 0.7, filter: BP(600, 1600, 1.2) },
      { wave: 'saw', freq: 55, to: 70, env: { a: 0.45, d: 0.15 }, vol: 0.45, filter: LP(400) },
    ],
  },
  // Deep saw "BWOMP".
  'enemy/tuba-blast': {
    vol: 0.75,
    voices: 2,
    gap: 0.1,
    layers: [
      { wave: 'saw', freq: 58, bend: [[0, -1], [0.04, 0], [0.3, 0], [0.42, -2]], env: { a: 0.01, s: 0.8, hold: 0.25, r: 0.15, d: 0.03 }, vol: 0.8, filter: LP(700, 300) },
      { wave: 'saw', freq: 87, env: { a: 0.01, d: 0.35 }, vol: 0.35, filter: LP(600) },
      noise(0.04, 0.3, BP(400, undefined, 1)),
    ],
  },
  // Cymbals raised (T 32): shimmering high-passed noise with tremolo.
  'enemy/cymbal-raise': {
    vol: 0.6,
    voices: 2,
    gap: 0.2,
    layers: [
      { wave: 'noise', env: { a: 0.3, d: 0.23 }, vol: 0.6, filter: HP(5000), tremolo: { rate: 9, rateTo: 16, depth: 0.6 } },
      { wave: 'metal', freq: 23000, env: { a: 0.25, d: 0.25 }, vol: 0.3, filter: HP(6500), tremolo: { rate: 12, rateTo: 20, depth: 0.7 } },
    ],
  },
  // CRASH: a bright noise burst with a 600 ms decay.
  'enemy/cymbal-crash': {
    vol: 0.509,
    voices: 2,
    gap: 0.1,
    layers: [noise(0.6, 0.7, HP(3500)), { wave: 'metal', freq: 21000, env: { a: 0.001, d: 0.5 }, vol: 0.35, filter: HP(5000) }, noise(0.02, 0.35, BP(2000, undefined, 1))],
  },
  // A single low drum hit (the drummer's step every 30 ticks).
  'enemy/drum-hit': {
    vol: 0.487,
    voices: 3,
    gap: 0.05,
    layers: [tone('sine', 120, 55, 0.25, 0.7), tone('triangle', 220, 110, 0.08, 0.35), noise(0.05, 0.45, LP(1200))],
    drive: 0.4,
  },
  // Drum-charge telegraph (T 30): snare hits that speed up.
  'enemy/drumroll': {
    vol: 1.197,
    voices: 2,
    gap: 0.2,
    layers: hits(12, 0, 0.07, 1.12).map((delay, i) => ({
      wave: 'noise' as const,
      delay,
      env: { a: 0.001, d: 0.055 },
      vol: 0.42 + i * 0.03,
      filter: BP(2200, undefined, 0.8),
    })),
  },
  // The officer's whistle (T 20): pulse 2.6 kHz with a fast trill.
  'enemy/whistle': {
    vol: 0.378,
    voices: 1,
    gap: 0.2,
    layers: [
      { wave: 'pulse', duty: 0.5, freq: 2600, env: { a: 0.01, d: 0.02, s: 0.8, hold: 0.25, r: 0.05 }, vol: 0.45, vibrato: { rate: 28, depth: 0.7 }, filter: LP(5000) },
      { wave: 'noise', env: { a: 0.01, d: 0.02, s: 0.6, hold: 0.25, r: 0.05 }, vol: 0.12, filter: BP(2600, undefined, 3) },
    ],
  },
  // Piccolo aim (T 45): pitch rising 1.2 → 3 kHz over 45 ticks (0.75 s).
  'enemy/piccolo-whistle': {
    vol: 0.291,
    voices: 2,
    gap: 0.2,
    layers: [
      { wave: 'pulse', duty: 0.25, freq: 1200, to: 3000, sweep: 0.75, env: { a: 0.04, d: 0.02, s: 0.8, hold: 0.64, r: 0.05 }, vol: 0.4, filter: LP(5500) },
      { wave: 'sine', freq: 1200, to: 3000, sweep: 0.75, env: { a: 0.04, d: 0.02, s: 0.8, hold: 0.64, r: 0.05 }, vol: 0.3, vibrato: { rate: 6, depth: 0.1 } },
    ],
  },
  // The piccolo shot: a sharp high crack.
  'enemy/piccolo-shot': {
    vol: 0.854,
    voices: 2,
    gap: 0.05,
    layers: [noise(0.04, 0.7, HP(3000)), tone('pulse', 3000, 1500, 0.05, 0.35, { duty: 0.25, filter: LP(6000) }), click(4000, 0.3)],
  },
  // The alarm "DING": FM bell 2.5 kHz with a long decay.
  'enemy/triangle': {
    vol: 0.358,
    voices: 2,
    gap: 0.1,
    layers: [...fmBell(2500, 0.9, 0.75, { ratio: 2.4, index: 2.5, decay: 0.12, octave: 0.15 }), noise(0.005, 0.25, HP(6000))],
  },
  // Bassoon aim (T 40): a squeaky reed, pulse 12.5 % with a rising wobble.
  'enemy/bassoon-aim': {
    vol: 0.607,
    voices: 2,
    gap: 0.2,
    layers: [
      { wave: 'pulse', duty: 0.125, freq: 220, to: 340, env: { a: 0.04, d: 0.02, s: 0.8, hold: 0.55, r: 0.06 }, vol: 0.5, vibrato: { rate: 6, depth: 0.4 }, tremolo: { rate: 6, rateTo: 11, depth: 0.25 }, filter: LP(1800) },
      { wave: 'noise', env: { a: 0.04, d: 0.02, s: 0.6, hold: 0.55, r: 0.06 }, vol: 0.12, filter: BP(1400, 2200, 3) },
    ],
  },
  // "CLONK": a dropped instrument (wood-block triangle + noise).
  'enemy/fumble': {
    vol: 1.089,
    voices: 2,
    gap: 0.1,
    layers: [tone('triangle', 700, 500, 0.06, 0.8), noise(0.04, 0.4, BP(1400)), tone('triangle', 520, 400, 0.05, 0.5, { delay: 0.08 })],
  },
};
