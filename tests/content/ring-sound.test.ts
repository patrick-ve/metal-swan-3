/**
 * Mission ring's sound (docs/design/ring.md §3, §11; wave B SOUND):
 * - the stage theme `ring` and the test boss song `ring-boss` register (through music/index.ts),
 *   parse, keep their tempo, grid and form, stay in range and loop seamlessly;
 * - the ring plays them: `ringMission` names them, `ringSong` no longer falls back to the ams
 *   songs, a started RingRunner plays `ring`, and the cue listener switches to `ring-boss` for a
 *   boss slot, back to the theme's A after the boss, and lifts the theme in a tunnel;
 * - every driver has a line for every event (≤ 24 characters per line, ≤ 2 lines, the small font
 *   has every glyph, no laugh), with a second variant where it helps;
 * - the mix: the engine hum and the tunnel bed sit under the shots and the telegraphs.
 */
import { describe, expect, it } from 'vitest';
import { NullAudio, type EchoOpts } from '../../src/engine/audio';
import { getFont } from '../../src/engine/font';
import type { SongDef } from '../../src/engine/music';
import { getSong, hasSong, midiToFreq, parseSong, patternRows, songError, songEvents, songLength } from '../../src/engine/music';
import { renderSfx, SAMPLE_RATE, sfxIsLoop } from '../../src/engine/synth';
import '../../src/game/content/music/index';
import { MISSION_SONGS } from '../../src/game/content/music/missions';
import { RING_BAR, RING_LIFT_SLOT, RING_SONGS } from '../../src/game/content/music/ring';
import { DRIVER_EVENTS, DRIVER_LINES, driverLine } from '../../src/game/content/ring/wagon/lines';
import '../../src/game/content/sfx/index';
import { attachRingCues, TUNNEL_BED, TUNNEL_ECHO } from '../../src/game/ring/cues';
import { ringMission, ringSong } from '../../src/game/ring/mission';
import { planRing } from '../../src/game/ring/plan';
import { RING_ZWAAN, RING_ZWAAN_PART_TAG } from '../../src/game/ring/ids';
import type { RingChunk } from '../../src/game/ring/types';
import { RingRig, tinyPlan } from '../game/ring/ring-helpers';

// ------------------------------------------------------------------------------------------ songs

interface Form {
  bpm: number;
  slots: readonly (readonly [string, number])[];
  loop: number;
  /** Loop length range in seconds. */
  loopSec: readonly [number, number];
}

const FORMS: Readonly<Record<string, Form>> = {
  ring: { bpm: 140, slots: [['intro', 4], ['A', 16], ['B', 16], ['C+2', 8], ['D', 8]], loop: 1, loopSec: [60, 90] },
  'ring-boss': { bpm: 152, slots: [['intro', 2], ['A', 8], ['B', 8], ['C', 8]], loop: 1, loopSec: [30, 60] },
};
const IDS = Object.keys(FORMS);

const slotName = (s: string): string => s.replace(/[+-]\d+$/, '');

function slotRows(def: SongDef, name: string): number[] {
  return def.channels.filter((c) => c.patterns[name] !== undefined).map((c) => patternRows(c.patterns[name]).length);
}

describe('ring songs', () => {
  it('defines exactly ring and ring-boss, registered through music/index.ts, outside MISSION_SONGS', () => {
    expect(Object.keys(RING_SONGS).sort()).toEqual([...IDS].sort());
    for (const id of IDS) {
      expect(MISSION_SONGS[id]).toBeUndefined();
      expect(hasSong(id), id).toBe(true);
      expect(songError(id), id).toBeNull();
      expect(getSong(id), id).not.toBeNull();
    }
  });

  it.each(IDS)('%s has its tempo, grid and form; every channel of a slot has the same length', (id) => {
    const f = FORMS[id];
    const def = RING_SONGS[id];
    expect(def.bpm).toBe(f.bpm);
    expect(def.rowsPerBeat ?? 4).toBe(4);
    expect(def.order).toEqual(f.slots.map(([n]) => n));
    expect(def.loop).toBe(f.loop);
    for (const [slot, barsLong] of f.slots) {
      const lens = slotRows(def, slotName(slot));
      expect(lens.length, `${id} ${slot}`).toBeGreaterThan(0);
      for (const n of lens) expect(n, `${id} ${slot}`).toBe(barsLong * RING_BAR);
    }
    const p = parseSong(def, id);
    const totalBars = f.slots.reduce((s, [, b]) => s + b, 0);
    expect(p.totalRows).toBe(totalBars * RING_BAR);
    expect(p.loopRow).toBe(f.slots[0][1] * RING_BAR);
    const loopSec = (p.totalRows - (p.loopRow ?? 0)) * p.rowDur;
    expect(loopSec).toBeGreaterThanOrEqual(f.loopSec[0]);
    expect(loopSec).toBeLessThanOrEqual(f.loopSec[1]);
  });

  it('the theme lifts a whole step at C (the tunnels jump there); the lift is the loudest section', () => {
    expect(RING_SONGS.ring.order[RING_LIFT_SLOT]).toBe('C+2');
    const p = parseSong(RING_SONGS.ring, 'ring');
    // More notes per bar in the lift than in A (the octave double, the 16th bass, the arpeggio).
    const bar = (r: number): number => Math.floor(r / RING_BAR);
    const perBar = new Map<number, number>();
    for (const n of p.notes) perBar.set(bar(n.row), (perBar.get(bar(n.row)) ?? 0) + 1);
    const avg = (b0: number, b1: number): number => {
      let s = 0;
      for (let b = b0; b < b1; b++) s += perBar.get(b) ?? 0;
      return s / (b1 - b0);
    };
    const A = avg(4, 20);
    const C = avg(36, 44);
    const D = avg(44, 48);
    expect(C).toBeGreaterThan(A * 1.3);
    // The breakdown's first half is the sparsest stretch of the loop.
    expect(D).toBeLessThan(A);
  });

  it.each(IDS)('%s: notes in range, every channel plays', (id) => {
    const p = parseSong(RING_SONGS[id], id);
    for (const n of p.notes) {
      expect(n.rows).toBeGreaterThanOrEqual(1);
      expect(n.vel > 0 && n.vel <= 1).toBe(true);
      if (!n.drum) expect(n.midi >= 24 && n.midi <= 96, `${id} note ${n.midi}`).toBe(true);
    }
    expect(new Set(p.notes.map((n) => n.ch)).size).toBe(p.channels.length);
  });

  it.each(IDS)('%s schedules finite notes and loops seamlessly', (id) => {
    const p = parseSong(RING_SONGS[id], id);
    const pass = songLength(p);
    const ev = songEvents(p, 0, pass + 4);
    expect(ev.length).toBeGreaterThan(400);
    for (const e of ev) {
      expect(Number.isFinite(e.time) && Number.isFinite(e.dur) && e.dur > 0).toBe(true);
      if (!e.drum) expect(Number.isFinite(midiToFreq(e.midi))).toBe(true);
    }
    const loopT = (p.loopRow ?? 0) * p.rowDur;
    const key = (t0: number) => songEvents(p, t0, t0 + 2).map((e) => `${e.ch}:${e.midi}:${e.drum ?? ''}:${(e.time - t0).toFixed(4)}`);
    expect(key(pass)).toEqual(key(loopT));
  });
});

// ------------------------------------------------------------------------------------------ the ring plays them

describe('the ring plays its songs', () => {
  it('ringMission names ring / ring-boss; ringSong never falls back to the ams songs', () => {
    const m = ringMission(planRing(1, 'normal'));
    expect(m.music).toBe('ring');
    expect(m.bossMusic).toBe('ring-boss');
    expect(ringSong('ring')).toBe('ring');
    expect(ringSong('ring-boss')).toBe('ring-boss');
    expect(ringSong(null)).toBeNull();
  });

  it('a started ring plays ring', () => {
    const rig = new RingRig();
    const log = (rig.runner.audio as NullAudio).log;
    expect(rig.runner.currentMusic).toBe('ring');
    expect(log).toContain('music:ring');
    expect(log.some((l) => l.startsWith('music:ams'))).toBe(false);
  });

  it('the cues: the ZWAAN slot plays ring-boss, the end of the train brings the theme back at A', () => {
    const rig = new RingRig({ god: true });
    const cues = attachRingCues(rig.runner);
    const log = (rig.runner.audio as NullAudio).log;
    rig.runner.events.emit('bossSlot', { id: RING_ZWAAN.controller, at: 0, spawned: true });
    expect(rig.runner.currentMusic).toBe('ring-boss');
    expect(log[log.length - 1]).toBe('music:ring-boss');
    // A skipped slot (an unknown boss id) changes nothing.
    rig.runner.playMusic('ring');
    rig.runner.events.emit('bossSlot', { id: 'end', at: 0, spawned: false });
    expect(rig.runner.currentMusic).toBe('ring');
    rig.runner.events.emit('bossSlot', { id: RING_ZWAAN.controller, at: 0, spawned: true });
    // A beaten part (tag ring-zwaan-part) keeps the boss song; the train's end brings the theme.
    rig.wagon.addTag(RING_ZWAAN_PART_TAG);
    rig.world.events.emit('bossDefeated', { boss: rig.wagon, player: 0 });
    expect(rig.runner.currentMusic).toBe('ring-boss');
    rig.world.events.emit('ringTrainDone', { controller: rig.wagon });
    expect(rig.runner.currentMusic).toBe('ring');
    expect(log[log.length - 1]).toBe('music:ring@1');
    cues.detach();
    rig.runner.events.emit('bossSlot', { id: RING_ZWAAN.controller, at: 0, spawned: true });
    expect(rig.runner.currentMusic).toBe('ring');
  });

  it('the cues: entering a tunnel tube jumps the theme to its lift, once per tunnel', () => {
    const chunks: RingChunk[] = [
      { type: 'cruise', start: 0, length: 700, stretch: 'oost' },
      { type: 'tunnel', start: 700, length: 600, stretch: 'oost' },
      { type: 'cruise', start: 1300, length: 2700, stretch: 'exit' },
    ];
    const rig = new RingRig({ god: true, plan: { ...tinyPlan({ length: 4000 }), chunks } });
    // The sfx echo (spec §7.3): on in the tube, off at the exit portal.
    const echoes: Array<EchoOpts | null> = [];
    (rig.runner.audio as NullAudio & { setEcho?: (o: EchoOpts | null) => void }).setEcho = (o) => echoes.push(o);
    const cues = attachRingCues(rig.runner);
    const log = (rig.runner.audio as NullAudio).log;
    rig.until(() => rig.runner.view.ambience === TUNNEL_BED, 900);
    rig.run(2);
    expect(cues.lifts).toBe(1);
    expect(log.filter((l) => l === `music:ring@${RING_LIFT_SLOT}`)).toHaveLength(1);
    expect(echoes).toEqual([TUNNEL_ECHO]);
    // Through the tube and out: no second lift; the echo fades out.
    rig.until(() => rig.runner.view.ambience !== TUNNEL_BED, 900);
    rig.run(30);
    expect(cues.lifts).toBe(1);
    expect(echoes).toEqual([TUNNEL_ECHO, null]);
    cues.detach();
    expect(echoes).toHaveLength(2);
  });
});

// ------------------------------------------------------------------------------------------ lines

const SQUAD = ['vincent', 'thom', 'dirk', 'bob', 'patrick'];

describe('driver lines', () => {
  it('every driver has a line for every event: ≤ 24 characters per line, ≤ 2 lines, no repeats', () => {
    for (const id of [...SQUAD, 'default']) {
      const set = DRIVER_LINES[id];
      expect(set, id).toBeDefined();
      const seen = new Set<string>();
      for (const ev of DRIVER_EVENTS) {
        expect(set[ev].length, `${id} ${ev}`).toBeGreaterThan(0);
        for (const line of set[ev]) {
          const rows = line.split('\n');
          expect(rows.length, line).toBeLessThanOrEqual(2);
          for (const r of rows) expect(r.length, line).toBeLessThanOrEqual(24);
          expect(line.trim(), line).toBe(line);
          expect(seen.has(line), `${id} repeats "${line}"`).toBe(false);
          seen.add(line);
        }
      }
    }
  });

  it('the wave-B events have lines (scan, tow, brake, caravan, roadworks, boarder, sticker)', () => {
    for (const ev of ['scan', 'tow', 'brake', 'caravan', 'roadworks', 'boarder', 'sticker'] as const) {
      expect(DRIVER_EVENTS).toContain(ev);
      for (const id of SQUAD) expect(driverLine(id, ev).length, `${id} ${ev}`).toBeGreaterThan(0);
    }
  });

  it('each squad driver has his own lines and a second variant for most events; flash and boss keep one', () => {
    for (const id of SQUAD) {
      const set = DRIVER_LINES[id];
      const two = DRIVER_EVENTS.filter((ev) => set[ev].length >= 2);
      expect(two.length, id).toBeGreaterThanOrEqual(12);
      expect(set.flash.length).toBe(1);
      expect(set.boss.length).toBe(1);
      for (const line of set.board) expect(line, `${id} board`).toContain('STAP IN!');
      // Not a copy of the default set.
      expect(DRIVER_EVENTS.filter((ev) => set[ev][0] === DRIVER_LINES.default[ev][0]).length, id).toBeLessThanOrEqual(3);
    }
    // Different drivers say different things on the same moment.
    for (const ev of DRIVER_EVENTS) expect(new Set(SQUAD.map((id) => DRIVER_LINES[id][ev][0])).size, ev).toBeGreaterThanOrEqual(4);
  });

  it('the small font has every glyph; nobody laughs (docs/research/mechanics.md §23)', () => {
    const codes = new Set(getFont('small').glyphs.map((g) => g.code));
    for (const set of Object.values(DRIVER_LINES))
      for (const list of Object.values(set))
        for (const line of list) {
          for (const c of line.replace(/\n/g, '')) expect(codes.has(c.charCodeAt(0)), `"${c}" in ${line}`).toBe(true);
          expect(/\bHA(HA)+\b|\bLOL\b|\bHAH\b/.test(line), line).toBe(false);
        }
  });

  it('driverLine picks among the variants and falls back to the default set', () => {
    expect(driverLine('vincent', 'bump', 0)).toBe(DRIVER_LINES.vincent.bump[0]);
    expect(driverLine('vincent', 'bump', 0.99)).toBe(DRIVER_LINES.vincent.bump[1]);
    expect(driverLine('nobody', 'tow')).toBe(DRIVER_LINES.default.tow[0]);
    expect(driverLine(null, 'board')).toContain('STAP IN!');
  });
});

// ------------------------------------------------------------------------------------------ the mix

/** K-weighted (BS.1770) maximum momentary loudness in LUFS (as tests/content/sfx.test.ts). */
function loudness(s: Float32Array): number {
  const biquad = (b0: number, b1: number, b2: number, a1: number, a2: number) => {
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;
    return (x: number): number => {
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = x;
      y2 = y1;
      y1 = y;
      return y;
    };
  };
  const fs = SAMPLE_RATE;
  let k = Math.tan((Math.PI * 1681.974450955533) / fs);
  const vh = Math.pow(10, 3.999843853973347 / 20);
  const vb = Math.pow(vh, 0.4996667741545416);
  let q = 0.7071752369554196;
  let a0 = 1 + k / q + k * k;
  const shelf = biquad((vh + (vb * k) / q + k * k) / a0, (2 * (k * k - vh)) / a0, (vh - (vb * k) / q + k * k) / a0, (2 * (k * k - 1)) / a0, (1 - k / q + k * k) / a0);
  k = Math.tan((Math.PI * 38.13547087602444) / fs);
  q = 0.5003270373238773;
  a0 = 1 + k / q + k * k;
  const rlb = biquad(1, -2, 1, (2 * (k * k - 1)) / a0, (1 - k / q + k * k) / a0);
  const w = new Float64Array(s.length);
  for (let i = 0; i < s.length; i++) w[i] = rlb(shelf(s[i]));
  const win = Math.round(0.4 * fs);
  const hop = Math.round(0.05 * fs);
  let best = -Infinity;
  for (let at = -win + hop; at < w.length; at += hop) {
    let sum = 0;
    for (let i = Math.max(0, at); i < Math.min(w.length, at + win); i++) sum += w[i] * w[i];
    if (sum > 0) best = Math.max(best, -0.691 + 10 * Math.log10(sum / win));
  }
  return best;
}

/** Loudness as the game plays it: loops over two cycles, at the gain the game passes. */
function lu(id: string, gain = 1): number {
  const s = renderSfx(id) as Float32Array;
  let o = s;
  if (sfxIsLoop(id)) {
    o = new Float32Array(s.length * 2);
    o.set(s, 0);
    o.set(s, s.length);
  }
  return loudness(o) + 20 * Math.log10(gain);
}

/** The gains the ring passes to its loops (wagon.ts engine 0.55; runner.ts setAmbience 0.8). */
const ENGINE_GAIN = 0.55;
const AMBIENCE_GAIN = 0.8;

describe('the ring mix', () => {
  it('the engine hum and the tunnel bed sit under the shots and the telegraphs', () => {
    const engine = lu('ring/wagon-engine', ENGINE_GAIN);
    const tunnel = lu('ring/tunnel-bed', AMBIENCE_GAIN);
    for (const id of ['weapon/pistol', 'weapon/machine-gun', 'enemy/shot', 'ring/wagon-hit']) {
      expect(lu(id) - engine, id).toBeGreaterThanOrEqual(5);
      expect(lu(id) - tunnel, id).toBeGreaterThanOrEqual(3);
    }
    for (const id of ['ring/bottle-tell', 'ring/pistol-cock', 'ring/cam-beep']) {
      expect(lu(id) - engine, id).toBeGreaterThanOrEqual(6);
      expect(lu(id) - tunnel, id).toBeGreaterThanOrEqual(5);
    }
  });

  it('a telegraph is never more than 6 LU quieter than its attack; a passing scooter does not bury a shot', () => {
    expect(lu('ring/bottle-tell') - lu('ring/bottle')).toBeGreaterThanOrEqual(-6);
    expect(lu('ring/pistol-cock') - lu('enemy/shot')).toBeGreaterThanOrEqual(-6);
    expect(lu('ring/scooter-whine')).toBeLessThanOrEqual(-19);
  });
});
