/**
 * Menu, HUD and mission-flow sounds (GDD §12.1 "Bosses, environment, UI", §13). These redefine
 * the engine's default `ui/move|confirm|cancel|pause` (synth.ts keeps its own recipes as the
 * fallback); `ui/announce` stays the engine's voice-fallback jingle. `boss/warning` and
 * `ui/tally-tick` are aliases (index.ts).
 */
import { BP, fmBell, honk, hits, hz, LP, note, noise, tone, type Recipes } from './kit';

export const UI: Recipes = {
  // The title logo lands (2026-10-14, the first title visit): a low boom under a bright D major
  // stab with an FM bell ring, 1.2 s.
  'ui/title-sting': {
    vol: 0.55,
    voices: 1,
    gap: 1,
    layers: [
      tone('sine', 90, 40, 0.5, 0.9),
      noise(0.12, 0.4, LP(1800, 300)),
      ...[hz('D4'), hz('F#4'), hz('A4'), hz('D5')].map((f) => note('saw', f, 0.22, 0.14, 0.02, { filter: LP(2600, 900) })),
      ...fmBell(hz('D6'), 0.9, 0.22, { ratio: 3.5, index: 3, delay: 0.02, octave: 0.2 }),
      ...fmBell(hz('A5'), 0.7, 0.14, { ratio: 2, index: 2, delay: 0.14 }),
    ],
  },
  // Menu cursor tick.
  'ui/move': {
    vol: 0.5,
    voices: 3,
    gap: 0.03,
    layers: [note('pulse', hz('E6'), 0.025, 0.5, 0, { duty: 0.25, filter: LP(5000) }), note('triangle', hz('E5'), 0.025, 0.5)],
  },
  // Confirm: a quick rising fourth-to-octave figure.
  'ui/confirm': {
    vol: 0.518,
    voices: 2,
    gap: 0.05,
    layers: [
      { wave: 'pulse', duty: 0.25, freq: hz('A5'), arp: [0, 5, 12], arpTime: 0.045, env: { a: 0.002, s: 0.7, hold: 0.11, r: 0.1, d: 0.01 }, vol: 0.45 },
      { wave: 'triangle', freq: hz('A4'), arp: [0, 5, 12], arpTime: 0.045, env: { a: 0.002, s: 0.8, hold: 0.11, r: 0.1, d: 0.01 }, vol: 0.55 },
    ],
    echo: { delay: 0.09, feedback: 0.25, mix: 0.3 },
  },
  'ui/cancel': {
    vol: 0.698,
    voices: 2,
    gap: 0.05,
    layers: [tone('pulse', 622, 311, 0.15, 0.45, { duty: 0.5, sweep: 0.12, filter: LP(3000) }), tone('triangle', 311, 156, 0.14, 0.6, { sweep: 0.12 })],
  },
  'ui/pause': {
    vol: 0.475,
    voices: 1,
    gap: 0.1,
    layers: [...fmBell(hz('A5'), 0.22, 0.6, { ratio: 2, index: 1.5 }), ...fmBell(hz('E5'), 0.3, 0.55, { ratio: 2, index: 1.5, delay: 0.08 }), note('triangle', hz('A4'), 0.12, 0.35)],
  },
  // Credit added: a bright two-note chime.
  'ui/coin': {
    vol: 0.505,
    voices: 2,
    gap: 0.05,
    layers: [note('pulse', hz('B5'), 0.05, 0.4, 0, { duty: 0.25 }), note('pulse', hz('E6'), 0.22, 0.4, 0.07, { duty: 0.25 }), ...fmBell(hz('E6'), 0.3, 0.25, { delay: 0.07 })],
  },
  // One fast tally blip (alias `ui/tally-tick`: every tally line and while a bonus counts up).
  'ui/tally': {
    vol: 0.644,
    voices: 2,
    gap: 0.03,
    layers: [note('pulse', hz('A6'), 0.012, 0.5, 0, { duty: 0.125, filter: LP(6000) }), note('triangle', hz('A5'), 0.012, 0.4)],
  },
  // The tally total: a bright major chord.
  'ui/tally-end': {
    vol: 0.498,
    voices: 1,
    gap: 0.2,
    layers: [
      { wave: 'pulse', duty: 0.25, freq: hz('D5'), arp: [0, 4, 7, 12], arpTime: 0.04, env: { a: 0.002, s: 0.7, hold: 0.35, r: 0.2, d: 0.02 }, vol: 0.35 },
      note('triangle', hz('D4'), 0.4, 0.45),
      ...fmBell(hz('D6'), 0.5, 0.25, { delay: 0.16 }),
    ],
  },
  // Boss klaxon (alias `boss/warning`): square 440 / 554 Hz alternating, 4 times.
  'ui/warning': {
    vol: 0.625,
    voices: 1,
    gap: 0.5,
    layers: [
      { wave: 'square', freq: 440, arp: [0, 4], arpTime: 0.18, env: { a: 0.01, s: 0.85, hold: 1.3, r: 0.1, d: 0.01 }, vol: 0.4, filter: LP(2200) },
      { wave: 'saw', freq: 220, arp: [0, 4], arpTime: 0.18, env: { a: 0.01, s: 0.85, hold: 1.3, r: 0.1, d: 0.01 }, vol: 0.25, filter: LP(1200) },
    ],
  },
  // Timer alarm (not a GDD id; the slice uses it): two short urgent beeps.
  'ui/alarm': {
    vol: 0.5,
    voices: 1,
    gap: 0.3,
    layers: [note('pulse', 1046, 0.07, 0.45, 0, { duty: 0.5, filter: LP(3500) }), note('pulse', 1046, 0.07, 0.45, 0.14, { duty: 0.5, filter: LP(3500) })],
  },
  // ONWARD prompt (not a GDD id): a rising pair.
  'ui/go': {
    vol: 0.493,
    voices: 1,
    gap: 0.3,
    layers: [note('pulse', hz('D5'), 0.06, 0.4, 0, { duty: 0.25 }), note('pulse', hz('A5'), 0.16, 0.4, 0.08, { duty: 0.25 }), note('triangle', hz('D4'), 0.24, 0.4)],
  },
  // One tick per continue number.
  'ui/countdown': {
    vol: 1.174,
    voices: 1,
    gap: 0.1,
    layers: [tone('triangle', 1400, 1300, 0.05, 0.7), ...fmBell(2800, 0.04, 0.2, { ratio: 1.5, index: 1 })],
  },
  // A tick per timer count under 10.
  'ui/timer-warn': {
    vol: 0.607,
    voices: 1,
    gap: 0.1,
    layers: [note('pulse', 1318, 0.03, 0.5, 0, { duty: 0.25, filter: LP(4000) }), note('triangle', 659, 0.03, 0.3)],
  },
  // The review-star "ding".
  'ui/star': {
    vol: 0.442,
    voices: 3,
    gap: 0.05,
    layers: fmBell(hz('A6'), 0.32, 0.8, { ratio: 3.5, index: 2.5, octave: 0.2 }),
  },
  // The newspaper stamp thump.
  'ui/stamp': {
    vol: 0.885,
    voices: 2,
    gap: 0.05,
    layers: [tone('sine', 140, 60, 0.12, 0.6), tone('triangle', 300, 150, 0.04, 0.3), noise(0.06, 0.6, LP(1500)), noise(0.015, 0.3, BP(2500, undefined, 1.5))],
    drive: 0.4,
  },
  // Character chosen: a short drum roll and a honk.
  'ui/select-confirm': {
    vol: 0.859,
    voices: 1,
    gap: 0.3,
    layers: [
      ...hits(6, 0, 0.042).map((delay, i) => noise(0.045, 0.45 + i * 0.05, BP(2200, undefined, 0.8), { delay })),
      ...honk({ base: 220, len: 0.3, delay: 0.25, vol: 0.85 }),
    ],
    drive: 0.4,
  },
  // Name entry: a letter-change blip.
  'ui/name-letter': {
    vol: 0.622,
    voices: 2,
    gap: 0.03,
    layers: [note('pulse', hz('C6'), 0.02, 0.5, 0, { duty: 0.125 })],
  },
  // A short rising chime.
  'mission/checkpoint': {
    vol: 0.593,
    voices: 1,
    gap: 0.3,
    layers: [...fmBell(hz('D6'), 0.25, 0.4, { ratio: 3.5, index: 2.5 }), ...fmBell(hz('A6'), 0.35, 0.4, { ratio: 3.5, index: 2.5, delay: 0.08 })],
  },
  // A yawning buzzer.
  'mission/time-up': {
    vol: 0.685,
    voices: 1,
    gap: 0.5,
    layers: [
      { wave: 'saw', freq: 300, to: 180, env: { a: 0.03, s: 0.8, hold: 0.45, r: 0.15, d: 0.02 }, vol: 0.45, vibrato: { rate: 5, depth: 0.4 }, filter: LP(1400) },
      { wave: 'square', freq: 150, to: 90, env: { a: 0.03, s: 0.8, hold: 0.45, r: 0.15, d: 0.02 }, vol: 0.15, filter: LP(900) },
    ],
  },
};
