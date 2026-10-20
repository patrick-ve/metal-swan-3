// Synth sounds of mission ams, area 'scan' (docs/design/ams-extras.md §3, §8): the parking scan
// car, its tow truck and the wheel clamps. Spread into SFX in sfx/index.ts. Synth recipes only.
//
// Telegraphs last their telegraph (GDD §4.11 rule 2; start them on the first tell tick):
// - `ams/scan-beep` — SCAN LOCK's freeze (24 ticks): six quickening lock-on beeps rising to a long
//   tone, 0.4 s. Played at pitch 0.6 when the reticle appears (a slow sweep), at 1 when it freezes.
// - `ams/rev` — RAM's rev (24 ticks): a small petrol engine revved hard, 0.42 s.
// - `ams/reverse-beep` — the tow truck backing in: two reversing beeps, 0.62 s (every 40 ticks).
// Cues: `ams/scan-up` (the scanner bar's servo rises, 1 s), `ams/ticket-print` (the printer
// chatters a fine strip out, 0.3 s), `ams/clamp-clunk` (a clamp lands, snaps shut or pops off: a
// heavy steel clunk, 0.22 s), `ams/airbag` (the airbag pops: a bang, a whoosh, a fabric flop, 0.5 s).
import { BP, clack, fmBell, HP, hits, LP, noise, tone, type Recipes } from './kit';

/** One lock-on beep (a bright square through a band, a short ping). */
function beep(delay: number, f: number, d: number, vol: number) {
  return { wave: 'square' as const, freq: f, env: { a: 0.002, d: 0.01, s: 0.8, hold: d, r: 0.012 }, vol, delay, filter: BP(f * 1.2, undefined, 1.1) };
}

export const AMS_SCAN: Recipes = {
  // SCAN LOCK freeze: beeps that quicken (6 in 0.3 s), then a steady lock tone.
  'ams/scan-beep': {
    vol: 0.62,
    voices: 2,
    gap: 0.1,
    layers: [
      ...hits(6, 0, 0.07, 0.82).map((t, i) => beep(t, 1760 + i * 60, 0.025, 0.55)),
      beep(0.32, 2093, 0.06, 0.6),
      { wave: 'sine', freq: 2093, env: { a: 0.004, d: 0.01, s: 0.6, hold: 0.06, r: 0.012 }, vol: 0.3, delay: 0.32 },
    ],
  },
  // The scanner bar rises: a servo whine climbing for 0.9 s, a latch click at the top.
  'ams/scan-up': {
    vol: 0.75,
    voices: 1,
    gap: 0.5,
    layers: [
      { wave: 'saw', freq: 180, to: 420, sweep: 0.85, env: { a: 0.05, d: 0.02, s: 0.8, hold: 0.76, r: 0.06 }, vol: 0.45, filter: BP(900, 1600, 2), vibrato: { rate: 28, depth: 0.25 } },
      { wave: 'noise', env: { a: 0.05, d: 0.02, s: 0.5, hold: 0.76, r: 0.06 }, vol: 0.12, filter: BP(2400, 3200, 1.5) },
      ...clack(1300, 0.55, 0.88, 0.03),
    ],
  },
  // RAM rev: a small engine revved twice, the second higher, a tyre chirp at the end.
  'ams/rev': {
    vol: 0.5,
    voices: 1,
    gap: 0.3,
    drive: 0.8,
    layers: [
      { wave: 'saw', freq: 70, bend: [[0, 0], [0.12, 9], [0.18, 4], [0.34, 14], [0.42, 12]], env: { a: 0.01, d: 0.02, s: 0.9, hold: 0.36, r: 0.04 }, vol: 0.6, filter: LP(900, 2200, 1.2), tremolo: { rate: 38, rateTo: 70, depth: 0.5, shape: 'saw', width: 0.5 } },
      { wave: 'square', freq: 35, bend: [[0, 0], [0.12, 9], [0.18, 4], [0.34, 14], [0.42, 12]], env: { a: 0.01, d: 0.02, s: 0.8, hold: 0.36, r: 0.04 }, vol: 0.35, filter: LP(400) },
      noise(0.42, 0.18, BP(1200, 2600, 1.2), { env: { a: 0.02, d: 0.02, s: 0.7, hold: 0.34, r: 0.04 } }),
      noise(0.08, 0.3, BP(3800, 2600, 2), { delay: 0.34 }),
    ],
  },
  // The tow truck reversing: two beeps (1 kHz), each 0.2 s with a 0.22 s gap.
  'ams/reverse-beep': {
    vol: 0.5,
    voices: 1,
    gap: 0.3,
    layers: [
      { wave: 'square', freq: 1046, env: { a: 0.004, d: 0.01, s: 0.85, hold: 0.18, r: 0.02 }, vol: 0.5, filter: BP(1300, undefined, 1.3) },
      { wave: 'square', freq: 1046, env: { a: 0.004, d: 0.01, s: 0.85, hold: 0.18, r: 0.02 }, vol: 0.5, delay: 0.42, filter: BP(1300, undefined, 1.3) },
    ],
  },
  // A wheel clamp: a heavy steel clunk with a short ring.
  'ams/clamp-clunk': {
    vol: 0.5,
    voices: 3,
    gap: 0.05,
    layers: [
      tone('sine', 160, 70, 0.12, 0.8),
      noise(0.05, 0.6, LP(1800, 500)),
      ...clack(700, 0.7, 0, 0.03),
      ...fmBell(1240, 0.2, 0.18, { ratio: 2.4, index: 1.6, delay: 0.01 }),
    ],
  },
  // The ticket printer: a dot-matrix chatter that runs a strip out, a tear at the end.
  'ams/ticket-print': {
    vol: 0.6,
    voices: 2,
    gap: 0.12,
    layers: [
      { wave: 'square', freq: 520, env: { a: 0.004, d: 0.01, s: 0.8, hold: 0.22, r: 0.02 }, vol: 0.3, filter: BP(2600, undefined, 1.6), tremolo: { rate: 46, depth: 1, shape: 'square', width: 0.4 } },
      { wave: 'noise', env: { a: 0.004, d: 0.01, s: 0.7, hold: 0.22, r: 0.02 }, vol: 0.4, filter: HP(3000), tremolo: { rate: 46, depth: 1, shape: 'square', width: 0.35 } },
      noise(0.05, 0.45, BP(4200, 2400, 1.4), { delay: 0.25 }),
    ],
  },
  // The airbag pops: a sharp bang, an air whoosh and a fabric flop.
  'ams/airbag': {
    vol: 0.6,
    voices: 1,
    gap: 0.4,
    layers: [
      tone('sine', 140, 45, 0.16, 1),
      noise(0.04, 0.9, BP(1600, 800, 0.9)),
      { wave: 'noise', env: { a: 0.01, d: 0.05, s: 0.6, hold: 0.16, r: 0.12 }, vol: 0.45, delay: 0.02, filter: BP(900, 3000, 0.9) },
      noise(0.1, 0.35, LP(700, 300), { delay: 0.34 }),
    ],
  },
};
