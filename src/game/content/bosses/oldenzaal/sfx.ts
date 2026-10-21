// Synth sounds of St. Plechelmus, the statue mini-boss of mission oldenzaal (docs/design/oldenzaal.md
// §5, §11): 'oz/statue/…'. Owner: STATUE. Spread into SFX by content/sfx/index.ts (one import line).
// Synth recipes only (no samples, no generated audio); the AUDIO spec lists every id.
//
// - `oz/statue/crack`    the stone cracks open (the wake, the phase change): a dry splitting crack
//                        with a grinding tail and a low thump.
// - `oz/statue/tell`     an attack's glow: a cold rising shimmer with a stony rumble under it.
// - `oz/statue/sweep`    the crozier sweeps low: a heavy whoosh with a stone scrape on the pavers.
// - `oz/statue/wrench`   a block is torn off the plinth: a grinding crunch and a crack.
// - `oz/statue/throw`    the block leaves the hand: a heavy airy whoosh.
// - `oz/statue/shatter`  the block shatters on the pavers: a stone crash with rattling pieces.
// - `oz/statue/bit`      a small stone bounces: a short dry clack.
// - `oz/statue/step`     a stone footfall: a low, short thud with grit.
// - `oz/statue/slam`     the ground slam: a deep boom with a cracking rumble.
// - `oz/statue/hook`     the crozier shoots out: a stony whip-crack and a rising whirr.
// - `oz/statue/caught`   a hero is caught: a hollow knock and a grinding pull.
// - `oz/statue/free`     a hero breaks free: a snap and a short scrape.
// - `oz/statue/break`    the crozier breaks: a sharp crack and falling pieces.
// - `oz/statue/chip`     a shot chips the still statue: a tiny tick of grit.
// - `oz/statue/tear`     the ghost is torn out of the stone: a deep wrench under an airy rush.
// - `oz/statue/heal`     the cracks close: a soft, warm rising chime (calm, never triumphant noise).
// - `oz/statue/sit`      he sits back down on the plinth: a heavy settling grind and a thud.
// - `oz/statue/doors`    the basilica's red doors creak open: a long wooden creak and a low knock.
import { BP, HP, LP, noise, note, tone, type Recipes } from '../../sfx/kit';

/** A stone crack: a bright band-passed noise snap. */
function snap(f: number, vol: number, delay = 0, d = 0.03) {
  return noise(d, vol, BP(f, f * 0.6, 1.6), { delay });
}

export const OZ_STATUE_SFX: Recipes = {
  'oz/statue/crack': {
    vol: 0.95,
    voices: 2,
    gap: 0.2,
    layers: [
      snap(3200, 0.9),
      snap(2400, 0.7, 0.07),
      snap(2900, 0.6, 0.16, 0.02),
      { wave: 'noise', env: { a: 0.02, d: 0.2, s: 0.5, hold: 0.25, r: 0.2 }, vol: 0.45, filter: BP(500, 300, 1.2), tremolo: { rate: 31, depth: 0.6 } },
      tone('sine', 70, 45, 0.25, 0.7),
    ],
  },
  'oz/statue/tell': {
    vol: 0.7,
    voices: 2,
    gap: 0.25,
    layers: [
      { wave: 'triangle', freq: 330, to: 660, env: { a: 0.08, d: 0.1, s: 0.7, hold: 0.25, r: 0.15 }, vol: 0.35, filter: BP(1500, undefined, 0.8), vibrato: { rate: 7, depth: 0.4 } },
      { wave: 'sine', freq: 990, to: 1320, env: { a: 0.12, d: 0.1, s: 0.5, hold: 0.2, r: 0.15 }, vol: 0.18 },
      { wave: 'noise', env: { a: 0.05, d: 0.2, s: 0.5, hold: 0.25, r: 0.2 }, vol: 0.35, filter: LP(300), tremolo: { rate: 18, depth: 0.5 } },
    ],
  },
  'oz/statue/sweep': {
    vol: 0.9,
    voices: 2,
    gap: 0.2,
    layers: [
      { wave: 'noise', env: { a: 0.06, d: 0.25, s: 0 }, vol: 0.9, filter: BP(400, 1600, 1.1) },
      { wave: 'noise', env: { a: 0.02, d: 0.1, s: 0.6, hold: 0.25, r: 0.15 }, vol: 0.5, delay: 0.15, filter: BP(2200, 1200, 1.4), tremolo: { rate: 40, depth: 0.6 } },
      tone('sine', 110, 60, 0.2, 0.5, { delay: 0.12 }),
    ],
  },
  'oz/statue/wrench': {
    vol: 0.9,
    voices: 2,
    gap: 0.2,
    layers: [
      { wave: 'noise', env: { a: 0.02, d: 0.1, s: 0.7, hold: 0.18, r: 0.08 }, vol: 0.7, filter: BP(700, 400, 1.3), tremolo: { rate: 26, depth: 0.7 } },
      snap(2600, 0.8, 0.22),
      tone('sine', 90, 55, 0.18, 0.55, { delay: 0.22 }),
    ],
  },
  'oz/statue/throw': {
    vol: 0.9,
    voices: 2,
    gap: 0.15,
    layers: [
      { wave: 'noise', env: { a: 0.02, d: 0.08, s: 0.7, hold: 0.06, r: 0.1 }, vol: 1, filter: BP(350, 1300, 1) },
      tone('sine', 140, 90, 0.16, 0.45),
    ],
  },
  'oz/statue/shatter': {
    vol: 0.88,
    voices: 3,
    gap: 0.08,
    layers: [
      tone('sine', 120, 50, 0.18, 0.8),
      noise(0.12, 0.8, BP(1800, 900, 1)),
      snap(3400, 0.6, 0.04),
      snap(2800, 0.45, 0.1, 0.015),
      snap(3800, 0.35, 0.17, 0.012),
      snap(3100, 0.3, 0.24, 0.012),
    ],
  },
  'oz/statue/bit': {
    vol: 1,
    voices: 3,
    gap: 0.05,
    layers: [snap(2600, 1, 0, 0.03), snap(1800, 0.6, 0.01, 0.025), tone('sine', 300, 200, 0.05, 0.5)],
  },
  'oz/statue/step': {
    vol: 0.85,
    voices: 2,
    gap: 0.1,
    layers: [tone('sine', 80, 45, 0.16, 1), noise(0.08, 0.5, LP(600)), snap(1800, 0.25, 0.01, 0.02)],
  },
  'oz/statue/slam': {
    vol: 0.85,
    voices: 2,
    gap: 0.2,
    layers: [
      tone('sine', 65, 30, 0.45, 0.62),
      tone('triangle', 130, 50, 0.25, 0.32),
      noise(0.35, 0.55, LP(900, 200)),
      snap(2600, 0.5, 0.05),
      { wave: 'noise', env: { a: 0.05, d: 0.2, s: 0.4, hold: 0.2, r: 0.25 }, vol: 0.4, delay: 0.1, filter: BP(600, 300, 1.2), tremolo: { rate: 24, depth: 0.6 } },
    ],
  },
  'oz/statue/hook': {
    vol: 0.85,
    voices: 2,
    gap: 0.15,
    layers: [
      snap(2400, 0.7),
      { wave: 'square', freq: 180, to: 520, env: { a: 0.005, d: 0.05, s: 0.6, hold: 0.18, r: 0.06 }, vol: 0.18, filter: LP(1600) },
      { wave: 'noise', env: { a: 0.01, d: 0.1, s: 0.5, hold: 0.15, r: 0.08 }, vol: 0.5, filter: BP(900, 2400, 1.2) },
    ],
  },
  'oz/statue/caught': {
    vol: 0.85,
    voices: 2,
    gap: 0.15,
    layers: [
      tone('sine', 220, 160, 0.08, 0.7),
      note('triangle', 440, 0.06, 0.25),
      { wave: 'noise', env: { a: 0.02, d: 0.1, s: 0.6, hold: 0.3, r: 0.1 }, vol: 0.4, delay: 0.06, filter: BP(600, 350, 1.4), tremolo: { rate: 20, depth: 0.7 } },
    ],
  },
  'oz/statue/free': {
    vol: 1,
    voices: 2,
    gap: 0.1,
    layers: [snap(2400, 1, 0, 0.05), noise(0.16, 0.8, BP(1000, 600, 1.2), { delay: 0.03 }), tone('sine', 200, 120, 0.08, 0.5)],
  },
  'oz/statue/break': {
    vol: 0.85,
    voices: 2,
    gap: 0.2,
    layers: [snap(3600, 0.9), snap(2200, 0.8, 0.04, 0.05), tone('sine', 140, 60, 0.2, 0.6), snap(3200, 0.35, 0.2, 0.015), snap(2700, 0.3, 0.3, 0.015)],
  },
  'oz/statue/chip': {
    vol: 1,
    voices: 3,
    gap: 0.05,
    layers: [snap(3000, 1, 0, 0.03), snap(2000, 0.6, 0.012, 0.025), noise(0.05, 0.5, HP(1800))],
  },
  'oz/statue/tear': {
    vol: 0.92,
    voices: 1,
    gap: 0.5,
    layers: [
      tone('sine', 55, 35, 0.8, 0.9),
      { wave: 'noise', env: { a: 0.15, d: 0.3, s: 0.6, hold: 0.4, r: 0.4 }, vol: 0.6, filter: BP(500, 2600, 0.9) },
      { wave: 'noise', env: { a: 0.02, d: 0.2, s: 0.5, hold: 0.3, r: 0.2 }, vol: 0.5, filter: BP(700, 300, 1.3), tremolo: { rate: 28, depth: 0.7 } },
      snap(3000, 0.6, 0.05),
    ],
  },
  'oz/statue/heal': {
    vol: 0.6,
    voices: 1,
    gap: 0.5,
    layers: [
      note('sine', 392, 0.6, 0.35, 0),
      note('sine', 494, 0.6, 0.3, 0.15),
      note('sine', 587, 0.8, 0.3, 0.3),
      note('triangle', 784, 0.7, 0.12, 0.45),
      { wave: 'noise', env: { a: 0.3, d: 0.3, s: 0.3, hold: 0.3, r: 0.4 }, vol: 0.12, filter: HP(5000) },
    ],
  },
  'oz/statue/sit': {
    vol: 0.95,
    voices: 1,
    gap: 0.3,
    layers: [
      { wave: 'noise', env: { a: 0.05, d: 0.1, s: 0.6, hold: 0.3, r: 0.1 }, vol: 0.5, filter: BP(500, 300, 1.3), tremolo: { rate: 22, depth: 0.6 } },
      tone('sine', 75, 40, 0.3, 0.9, { delay: 0.45 }),
      noise(0.1, 0.4, LP(700), { delay: 0.45 }),
    ],
  },
  'oz/statue/doors': {
    vol: 0.85,
    voices: 1,
    gap: 1,
    layers: [
      { wave: 'saw', freq: 210, to: 160, env: { a: 0.08, d: 0.2, s: 0.7, hold: 0.9, r: 0.3 }, vol: 0.22, filter: BP(900, 600, 2.5), vibrato: { rate: 11, depth: 0.9 }, tremolo: { rate: 13, depth: 0.5 } },
      { wave: 'saw', freq: 330, to: 280, env: { a: 0.3, d: 0.2, s: 0.6, hold: 0.6, r: 0.3 }, vol: 0.12, filter: BP(1400, 1000, 3), vibrato: { rate: 9, depth: 1.2 } },
      tone('sine', 70, 50, 0.3, 0.7, { delay: 1.3 }),
      noise(0.12, 0.35, LP(500), { delay: 1.3 }),
    ],
  },
};
