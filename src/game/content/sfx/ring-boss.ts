// Synth sounds of mission ring, area 'boss' (docs/design/ring.md §6, §11; wave B): the test
// mid-boss `ring-lorry` and its adds. Spread into SFX in sfx/index.ts. Synth recipes only (no
// samples, no generated audio). Owner: the BOSS builder.
//
// Telegraphs start on the first tell tick (GDD §4.11 rule 2): `ring/lorry-door` + `ring/lorry-brake`
// (the cargo dump: the rear door bangs open, the air brakes hiss), `ring/lorry-blink` (the weave:
// the indicator's relay ticks; a short `ring/lorry-horn` near its end), `ring/forklift-beep` (the
// forklift's reverse beeper before its charge).
// Cues: `ring/lorry-horn` (the air horns: two deep trumpets a fourth apart, on its arrival),
// `ring/lorry-roll` (a drum lands and rolls: a hollow boom and a rumble), `ring/lorry-thud` (a
// crate / the forklift lands), `ring/lorry-barrel` (a drum bursts: a ringing clang and a slosh),
// `ring/lorry-crate` (a crate smashes: a wood crack), `ring/lorry-panel` (the side panel lets go:
// a creak and the chains rattling out), `ring/lorry-slam` (the panel or the container hits the
// road: a heavy steel slam), `ring/lorry-scrape` (the rims / the ramp drag: a grinding screech),
// `ring/lorry-screech` (the jackknife: locked tyres, long), `ring/forklift-whine` (its electric
// drive winding up).
import { BP, clack, fmBell, hits, HP, LP, noise, scatter, tone, type Recipes } from './kit';

/** One air-horn trumpet: a bright saw and a square an octave down through a horn band. */
function trumpet(f: number, delay: number, len: number, vol: number) {
  const env = { a: 0.03, d: 0.04, s: 0.9, hold: len, r: 0.12 };
  return [
    { wave: 'saw' as const, freq: f, env, vol, delay, filter: BP(f * 2.4, undefined, 0.8), bend: [[0, -1.2], [0.06, 0]] as const },
    { wave: 'square' as const, freq: f / 2, env, vol: vol * 0.6, delay, filter: LP(f * 3) },
  ];
}

const RATTLE = scatter(14, 61);

export const RING_BOSS: Recipes = {
  'ring/lorry-horn': {
    vol: 0.62,
    voices: 1,
    gap: 0.6,
    drive: 0.5,
    layers: [...trumpet(185, 0, 0.62, 0.32), ...trumpet(247, 0.02, 0.6, 0.28)],
    filter: HP(90),
  },
  'ring/lorry-door': {
    vol: 0.7,
    voices: 2,
    gap: 0.12,
    drive: 0.4,
    layers: [
      ...clack(420, 0.6, 0, 0.03),
      tone('sine', 120, 60, 0.18, 0.7),
      ...fmBell(310, 0.5, 0.22, { ratio: 1.41, index: 3, delay: 0.005 }),
      noise(0.14, 0.4, BP(900, 400, 0.9)),
    ],
  },
  'ring/lorry-brake': {
    vol: 0.5,
    voices: 1,
    gap: 0.4,
    layers: [
      // The air brakes: a sharp hiss that eases off, a low valve thump.
      { wave: 'noise', env: { a: 0.005, d: 0.05, s: 0.6, hold: 0.22, r: 0.2 }, vol: 0.55, filter: HP(3200, 5200) },
      tone('sine', 90, 60, 0.08, 0.3),
    ],
  },
  'ring/lorry-blink': {
    vol: 0.75,
    voices: 1,
    gap: 0.2,
    // The indicator's relay: tick … tock.
    layers: [...clack(2100, 0.6, 0, 0.02), tone('square', 1700, 1300, 0.035, 0.35, { filter: BP(1800, undefined, 1.5) }), ...clack(1500, 0.55, 0.13, 0.02), tone('square', 1250, 950, 0.035, 0.3, { delay: 0.13, filter: BP(1300, undefined, 1.5) })],
  },
  'ring/lorry-roll': {
    vol: 0.7,
    voices: 3,
    gap: 0.06,
    layers: [
      // The drum hits the asphalt (a hollow boom), then rolls: a rumble with a slow wobble.
      tone('sine', 110, 70, 0.22, 0.8),
      ...fmBell(160, 0.35, 0.25, { ratio: 1.41, index: 2.5 }),
      { wave: 'noise', env: { a: 0.02, d: 0.05, s: 0.5, hold: 0.35, r: 0.15 }, vol: 0.4, delay: 0.05, filter: LP(420), tremolo: { rate: 9, rateTo: 6, depth: 0.6 } },
    ],
  },
  'ring/lorry-thud': {
    vol: 0.7,
    voices: 3,
    gap: 0.05,
    layers: [tone('sine', 95, 50, 0.16, 0.9), noise(0.1, 0.5, LP(700)), ...clack(500, 0.3, 0.01, 0.02)],
  },
  'ring/lorry-barrel': {
    vol: 0.7,
    voices: 3,
    gap: 0.05,
    drive: 0.3,
    layers: [
      ...fmBell(240, 0.45, 0.35, { ratio: 1.41, index: 4 }),
      ...clack(800, 0.5, 0, 0.025),
      // The slosh of what was inside.
      noise(0.3, 0.35, BP(700, 300, 0.8), { delay: 0.03 }),
    ],
  },
  'ring/lorry-crate': {
    vol: 0.7,
    voices: 3,
    gap: 0.05,
    layers: [
      ...clack(650, 0.7, 0, 0.03),
      ...hits(3, 0.02, 0.035).flatMap((t, i) => clack(900 - i * 150, 0.4, t, 0.02)),
      noise(0.2, 0.45, BP(1400, 600, 1)),
      tone('triangle', 180, 90, 0.08, 0.4),
    ],
  },
  'ring/lorry-panel': {
    vol: 0.85,
    voices: 1,
    gap: 0.8,
    layers: [
      // A long creak (the hinges), then the chains paying out (a rattle that speeds up).
      { wave: 'saw', freq: 160, to: 95, sweep: 0.45, env: { a: 0.02, d: 0.02, s: 0.7, hold: 0.32, r: 0.1 }, vol: 0.4, vibrato: { rate: 13, depth: 0.8 }, filter: BP(700, 400, 2) },
      ...RATTLE.map((t, i) => clack(1300 + (i % 4) * 230, 0.32, 0.1 + t * 0.5, 0.016)).flat(),
      { wave: 'noise', env: { a: 0.05, d: 0.05, s: 0.6, hold: 0.4, r: 0.1 }, vol: 0.3, filter: LP(500) },
    ],
  },
  'ring/lorry-slam': {
    vol: 0.68,
    voices: 2,
    gap: 0.2,
    drive: 0.7,
    layers: [
      tone('sine', 70, 35, 0.4, 1),
      noise(0.5, 0.7, LP(1500, 300)),
      ...fmBell(130, 0.8, 0.25, { ratio: 1.41, index: 5 }),
      ...hits(3, 0.03, 0.05, 1.2).flatMap((t, i) => clack(700 + i * 300, 0.35, t, 0.03)),
    ],
  },
  'ring/lorry-scrape': {
    vol: 0.9,
    voices: 1,
    gap: 0.3,
    layers: [
      { wave: 'noise', env: { a: 0.02, d: 0.03, s: 0.7, hold: 0.45, r: 0.15 }, vol: 0.9, filter: BP(2600, 1900, 1.6), tremolo: { rate: 23, depth: 0.5 } },
      { wave: 'saw', freq: 1900, to: 1700, env: { a: 0.02, d: 0.03, s: 0.6, hold: 0.45, r: 0.15 }, vol: 0.25, vibrato: { rate: 31, depth: 0.7 }, filter: BP(2000, undefined, 3) },
      noise(0.12, 0.5, LP(900)),
    ],
  },
  'ring/lorry-screech': {
    vol: 0.6,
    voices: 1,
    gap: 1,
    layers: [
      { wave: 'saw', freq: 1040, to: 820, sweep: 1.4, env: { a: 0.03, d: 0.02, s: 0.85, hold: 1.1, r: 0.3 }, vol: 0.2, vibrato: { rate: 21, depth: 0.6 }, filter: BP(1100, undefined, 3) },
      { wave: 'sine', freq: 1380, to: 1150, sweep: 1.4, env: { a: 0.04, d: 0.02, s: 0.8, hold: 1.1, r: 0.3 }, vol: 0.28, vibrato: { rate: 17, depth: 0.7 } },
      { wave: 'noise', env: { a: 0.02, d: 0.02, s: 0.7, hold: 1.15, r: 0.3 }, vol: 0.45, filter: BP(2300, 1500, 1.5) },
      // The rigs groaning against each other.
      { wave: 'square', freq: 62, to: 48, env: { a: 0.1, d: 0.1, s: 0.6, hold: 0.9, r: 0.3 }, vol: 0.18, filter: LP(300) },
    ],
  },
  'ring/forklift-whine': {
    vol: 0.5,
    voices: 2,
    gap: 0.3,
    layers: [
      { wave: 'square', freq: 520, to: 1250, sweep: 0.45, env: { a: 0.02, d: 0.02, s: 0.7, hold: 0.4, r: 0.12 }, vol: 0.15, filter: BP(1400, 2600, 2) },
      { wave: 'sine', freq: 260, to: 625, sweep: 0.45, env: { a: 0.02, d: 0.02, s: 0.7, hold: 0.4, r: 0.12 }, vol: 0.3 },
      noise(0.5, 0.12, HP(4000)),
    ],
  },
  'ring/forklift-beep': {
    vol: 0.55,
    voices: 1,
    gap: 0.5,
    layers: hits(3, 0, 0.16).map((t) => ({ wave: 'square' as const, freq: 1180, env: { a: 0.003, d: 0.01, s: 0.85, hold: 0.07, r: 0.01 }, vol: 0.35, delay: t, filter: BP(1300, undefined, 1.4) })),
  },
};
