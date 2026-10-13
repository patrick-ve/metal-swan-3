/**
 * Songs and sounds of mission `ams` (docs/design/amsterdam.md §4; GDD §12.2, §15.7):
 * - `ams` (a 3/4 street-organ waltz in F major) and `ams-boss` (D minor) register, parse, have
 *   the agreed tempo, grid and form, schedule finite notes across the loop seam;
 * - neither song is part of MISSION_SONGS (that list is pinned by music-missions.test.ts);
 * - the `ams/*` sounds are registered, and the telegraph sounds stay audible for their tell.
 */
import { describe, expect, it } from 'vitest';
import type { SongDef } from '../../src/engine/music';
import { getSong, hasSong, midiToFreq, parseSong, patternRows, songError, songEvents, songLength } from '../../src/engine/music';
import { hasSfx, renderSfx, SAMPLE_RATE } from '../../src/engine/synth';
import { AMS_SONGS, WALTZ_BAR } from '../../src/game/content/music/ams';
import { MISSION_SONGS } from '../../src/game/content/music/missions';
import { SFX } from '../../src/game/content/sfx/index';

interface Form {
  bpm: number;
  rowsPerBeat: number;
  rowsPerBar: number;
  slots: readonly (readonly [string, number])[];
  loop: number;
}

const FORMS: Readonly<Record<string, Form>> = {
  ams: { bpm: 150, rowsPerBeat: 3, rowsPerBar: WALTZ_BAR, slots: [['intro', 4], ['A', 16], ['B', 16], ['A2', 16]], loop: 1 },
  'ams-boss': { bpm: 160, rowsPerBeat: 4, rowsPerBar: 16, slots: [['intro', 4], ['A', 16], ['B', 16], ['C', 8]], loop: 1 },
};
const IDS = Object.keys(FORMS);

function slotRows(def: SongDef, name: string): number[] {
  return def.channels.filter((c) => c.patterns[name] !== undefined).map((c) => patternRows(c.patterns[name]).length);
}

describe('ams songs', () => {
  it('defines exactly ams and ams-boss, outside MISSION_SONGS', () => {
    expect(Object.keys(AMS_SONGS).sort()).toEqual([...IDS].sort());
    for (const id of IDS) expect(MISSION_SONGS[id]).toBeUndefined();
  });

  it.each(IDS)('%s is registered without errors', (id) => {
    expect(hasSong(id)).toBe(true);
    expect(songError(id)).toBeNull();
    expect(getSong(id)).not.toBeNull();
  });

  it.each(IDS)('%s has its tempo, grid and form; every channel of a slot has the same length', (id) => {
    const f = FORMS[id];
    const def = AMS_SONGS[id];
    expect(def.bpm).toBe(f.bpm);
    expect(def.rowsPerBeat ?? 4).toBe(f.rowsPerBeat);
    expect(def.order).toEqual(f.slots.map(([n]) => n));
    expect(def.loop).toBe(f.loop);
    for (const [name, barsLong] of f.slots) {
      const lens = slotRows(def, name);
      expect(lens.length, `${id} ${name}`).toBeGreaterThan(0);
      for (const n of lens) expect(n, `${id} ${name}`).toBe(barsLong * f.rowsPerBar);
    }
    const p = parseSong(def, id);
    const totalBars = f.slots.reduce((s, [, b]) => s + b, 0);
    expect(p.totalRows).toBe(totalBars * f.rowsPerBar);
    expect(p.loopRow).toBe(f.slots[0][1] * f.rowsPerBar);
    // A sane loop: 45–90 s.
    const loopSec = (p.totalRows - (p.loopRow ?? 0)) * p.rowDur;
    expect(loopSec).toBeGreaterThan(45);
    expect(loopSec).toBeLessThan(90);
  });

  it('ams is a waltz: 3 beats of 3 rows per bar, the bass "oom" on every downbeat', () => {
    const def = AMS_SONGS.ams;
    expect(WALTZ_BAR).toBe(9);
    expect((def.rowsPerBeat ?? 4) * 3).toBe(WALTZ_BAR);
    const p = parseSong(def, 'ams');
    const bassCh = def.channels.findIndex((c) => typeof c.inst === 'object' && c.inst.kind === 'triangle');
    expect(bassCh).toBeGreaterThanOrEqual(0);
    const bassRows = p.notes.filter((n) => n.ch === bassCh).map((n) => n.row);
    expect(bassRows.length).toBe(p.totalRows / WALTZ_BAR);
    for (const r of bassRows) expect(r % WALTZ_BAR).toBe(0);
  });

  it.each(IDS)('%s: notes in range, every channel plays', (id) => {
    const p = parseSong(AMS_SONGS[id], id);
    for (const n of p.notes) {
      expect(n.rows).toBeGreaterThanOrEqual(1);
      expect(n.vel > 0 && n.vel <= 1).toBe(true);
      if (!n.drum) expect(n.midi >= 24 && n.midi <= 96, `${id} note ${n.midi}`).toBe(true);
    }
    expect(new Set(p.notes.map((n) => n.ch)).size).toBe(p.channels.length);
  });

  it.each(IDS)('%s schedules finite notes and loops seamlessly', (id) => {
    const p = parseSong(AMS_SONGS[id], id);
    const pass = songLength(p);
    const ev = songEvents(p, 0, pass + 4);
    expect(ev.length).toBeGreaterThan(200);
    for (const e of ev) {
      expect(Number.isFinite(e.time) && Number.isFinite(e.dur) && e.dur > 0).toBe(true);
      if (!e.drum) expect(Number.isFinite(midiToFreq(e.midi))).toBe(true);
    }
    const loopT = (p.loopRow ?? 0) * p.rowDur;
    const key = (t0: number) => songEvents(p, t0, t0 + 2).map((e) => `${e.ch}:${e.midi}:${e.drum ?? ''}:${(e.time - t0).toFixed(4)}`);
    expect(key(pass)).toEqual(key(loopT));
  });
});

/** Seconds until the sound last rises above −34 dBFS (0.02). */
function audibleFor(id: string): number {
  const s = renderSfx(id) as Float32Array;
  let last = 0;
  for (let i = 0; i < s.length; i++) if (Math.abs(s[i]) > 0.02) last = i;
  return last / SAMPLE_RATE;
}

describe('ams sounds', () => {
  const IDS_SFX = ['ams/bell', 'ams/bass-thump', 'ams/gull', 'ams/kick', 'ams/stamp', 'ams/chain', 'ams/ticket'];

  it('registers every ams sound in the SFX table', () => {
    for (const id of IDS_SFX) {
      expect(hasSfx(id), id).toBe(true);
      expect(SFX[id], id).toBeDefined();
    }
  });

  it.each([
    ['ams/bell', 20],
    ['ams/gull', 20],
    ['ams/bass-thump', 24],
    ['ams/chain', 26],
    ['ams/stamp', 30],
  ] as const)('%s stays audible for its %i-tick telegraph (and at least 18 ticks)', (id, ticks) => {
    expect(audibleFor(id)).toBeGreaterThanOrEqual(Math.max(18, ticks) / 60);
  });

  it('the stamp slam lands on tick 30 (the loudest moment is just after 0.5 s)', () => {
    const s = renderSfx('ams/stamp') as Float32Array;
    let at = 0;
    for (let i = 1; i < s.length; i++) if (Math.abs(s[i]) > Math.abs(s[at])) at = i;
    const t = at / SAMPLE_RATE;
    expect(t).toBeGreaterThanOrEqual(0.5);
    expect(t).toBeLessThan(0.62);
  });
});
