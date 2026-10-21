/**
 * Mission oldenzaal's sound, AUDIO's part (docs/design/oldenzaal.md §11; docs/api/oldenzaal.md §10):
 * - the four songs of ids.ts `OZ_SONG` register (content manifest 'music/oldenzaal'), parse, keep
 *   their tempo, grid and form, stay in range and loop seamlessly; the TO BE CONTINUED sting plays
 *   once and fits the card;
 * - the town sfx ('oz/env/…', content/sfx/oldenzaal.ts) render inside the level guides; the
 *   ambience loops are seamless loops that sit under the shots;
 * - the sample group 'mission:oldenzaal' is a known group of the engine and the audio tools.
 */
import { describe, expect, it } from 'vitest';
import type { SongDef } from '../../src/engine/music';
import { getSong, hasSong, midiToFreq, parseSong, patternRows, songError, songEvents, songLength } from '../../src/engine/music';
import { SAMPLE_GROUPS } from '../../src/engine/samples';
import { renderSfx, SAMPLE_RATE, sfxIsLoop } from '../../src/engine/synth';
import { loadContent } from '../../src/game/content/index';
import { MISSION_SONGS } from '../../src/game/content/music/missions';
import { OZ_BAR, OZ_SONGS, OZ_THEME_RISE_SLOT } from '../../src/game/content/music/oldenzaal';
import { OZ_AMBIENCE, OZ_AUDIO_GROUP, OZ_SONG } from '../../src/game/content/missions/oldenzaal/ids';
import { OZ_ENV_SFX } from '../../src/game/content/sfx/oldenzaal';
import '../../src/game/content/sfx/index';
import { TBC_TICKS } from '../../src/game/scenes/to-be-continued';
import { GROUP_DIRS, LAZY_GROUPS } from '../../tools/audio/lib';
import { momentaryMax, peak } from '../../tools/audio/loudness';

// ------------------------------------------------------------------------------------------ songs

interface Form {
  bpm: number;
  slots: readonly (readonly [string, number])[];
  loop: number | null;
  /** Loop length range in seconds (the whole song for a sting). */
  sec: readonly [number, number];
}

const FORMS: Readonly<Record<string, Form>> = {
  [OZ_SONG.theme]: { bpm: 76, slots: [['intro', 4], ['A', 8], ['B', 8], ['C', 8]], loop: 1, sec: [60, 90] },
  [OZ_SONG.boss]: { bpm: 100, slots: [['intro', 2], ['A', 8], ['B', 8], ['C', 8]], loop: 1, sec: [40, 70] },
  [OZ_SONG.tower]: { bpm: 168, slots: [['intro', 2], ['A', 8], ['A+3', 8], ['B', 8], ['C', 8]], loop: 1, sec: [40, 70] },
  [OZ_SONG.tbc]: { bpm: 96, slots: [['A', 2]], loop: null, sec: [4, 6] },
};
const IDS = Object.keys(FORMS);

const slotName = (s: string): string => s.replace(/[+-]\d+$/, '');

function slotRows(def: SongDef, name: string): number[] {
  return def.channels.filter((c) => c.patterns[name] !== undefined).map((c) => patternRows(c.patterns[name]).length);
}

describe('oldenzaal songs', () => {
  it('defines exactly the four OZ_SONG ids, registered at import, outside MISSION_SONGS', () => {
    expect(Object.keys(OZ_SONGS).sort()).toEqual(Object.values(OZ_SONG).sort());
    for (const id of IDS) {
      expect(MISSION_SONGS[id], id).toBeUndefined();
      expect(hasSong(id), id).toBe(true);
      expect(songError(id), id).toBeNull();
      expect(getSong(id), id).not.toBeNull();
    }
  });

  it('the content manifest loads them (music/oldenzaal)', async () => {
    const report = await loadContent((id) => id === 'music/oldenzaal' || id === 'sfx/oldenzaal');
    expect(report.failed).toEqual([]);
    expect(report.loaded.sort()).toEqual(['music/oldenzaal', 'sfx/oldenzaal']);
  });

  it.each(IDS)('%s has its tempo, grid and form; every channel of a slot has the same length', (id) => {
    const f = FORMS[id];
    const def = OZ_SONGS[id];
    expect(def.bpm).toBe(f.bpm);
    expect(def.rowsPerBeat ?? 4).toBe(4);
    expect(def.order).toEqual(f.slots.map(([n]) => n));
    expect(def.loop).toBe(f.loop);
    for (const [slot, bars] of f.slots) {
      const lens = slotRows(def, slotName(slot));
      expect(lens.length, `${id} ${slot}`).toBeGreaterThan(0);
      for (const n of lens) expect(n, `${id} ${slot}`).toBe(bars * OZ_BAR);
    }
    const p = parseSong(def, id);
    expect(p.totalRows).toBe(f.slots.reduce((s, [, b]) => s + b, 0) * OZ_BAR);
    const sec = f.loop === null ? songLength(p) : (p.totalRows - (p.loopRow ?? 0)) * p.rowDur;
    if (f.loop !== null) expect(p.loopRow).toBe(f.slots[0][1] * OZ_BAR);
    expect(sec).toBeGreaterThanOrEqual(f.sec[0]);
    expect(sec).toBeLessThanOrEqual(f.sec[1]);
  });

  it.each(IDS)('%s: notes in range, every channel plays', (id) => {
    const p = parseSong(OZ_SONGS[id], id);
    for (const n of p.notes) {
      expect(n.rows).toBeGreaterThanOrEqual(1);
      expect(n.vel > 0 && n.vel <= 1).toBe(true);
      if (!n.drum) expect(n.midi >= 24 && n.midi <= 96, `${id} note ${n.midi}`).toBe(true);
    }
    expect(new Set(p.notes.map((n) => n.ch)).size).toBe(p.channels.length);
  });

  it.each(IDS.filter((id) => FORMS[id].loop !== null))('%s schedules finite notes and loops seamlessly', (id) => {
    const p = parseSong(OZ_SONGS[id], id);
    const pass = songLength(p);
    const ev = songEvents(p, 0, pass + 4);
    expect(ev.length).toBeGreaterThan(300);
    for (const e of ev) {
      expect(Number.isFinite(e.time) && Number.isFinite(e.dur) && e.dur > 0).toBe(true);
      if (!e.drum) expect(Number.isFinite(midiToFreq(e.midi))).toBe(true);
    }
    const loopT = (p.loopRow ?? 0) * p.rowDur;
    const key = (t0: number) => songEvents(p, t0, t0 + 2).map((e) => `${e.ch}:${e.midi}:${e.drum ?? ''}:${(e.time - t0).toFixed(4)}`);
    expect(key(pass)).toEqual(key(loopT));
  });

  it('the theme rises in B: the choir enters, the pedal climbs a semitone a bar, the heartbeat doubles', () => {
    const def = OZ_SONGS[OZ_SONG.theme];
    expect(def.order[OZ_THEME_RISE_SLOT]).toBe('B');
    const p = parseSong(def, OZ_SONG.theme);
    const bar = (r: number): number => Math.floor(r / OZ_BAR);
    // Channel 4 is the pedal: in B (bars 12–19) its roots climb F2 … C3 one semitone a bar.
    const pedal = p.notes.filter((n) => n.ch === 4 && bar(n.row) >= 12 && bar(n.row) < 20 && n.row % OZ_BAR === 0).map((n) => n.midi);
    expect(pedal).toEqual([41, 42, 43, 44, 45, 46, 47, 48]);
    const hearts = (b0: number, b1: number): number => p.notes.filter((n) => n.drum === 'drum/oz-heart' && bar(n.row) >= b0 && bar(n.row) < b1).length;
    expect(hearts(12, 19)).toBe(2 * hearts(4, 11));
    // The choir (channel 3) sings only in the rise and the climax.
    const choirBars = new Set(p.notes.filter((n) => n.ch === 3).map((n) => bar(n.row)));
    expect(Math.min(...choirBars)).toBe(12);
  });

  it('the TO BE CONTINUED sting plays once and ends inside the card', () => {
    const p = parseSong(OZ_SONGS[OZ_SONG.tbc], OZ_SONG.tbc);
    expect(p.loopRow).toBeNull();
    expect(songLength(p)).toBeLessThanOrEqual(TBC_TICKS / 60);
  });
});

// ------------------------------------------------------------------------------------------ the town sfx

/** Loudness as the game plays it: loops over two cycles, at the gain the game passes. */
function lu(id: string, gain = 1): number {
  const s = renderSfx(id) as Float32Array;
  let o = s;
  if (sfxIsLoop(id)) {
    o = new Float32Array(s.length * 2);
    o.set(s, 0);
    o.set(s, s.length);
  }
  return momentaryMax([o], SAMPLE_RATE) + 20 * Math.log10(gain);
}

/** The runner plays the ambience at this gain (runner.ts `setAmbience`). */
const AMBIENCE_GAIN = 0.8;

describe('the town sfx (oz/env/)', () => {
  it('every id renders, peaks inside the guides and is not silent; the one-shots are short', () => {
    expect(OZ_ENV_SFX.length).toBe(15);
    for (const id of OZ_ENV_SFX) {
      const s = renderSfx(id);
      expect(s, id).not.toBeNull();
      const pk = peak([s as Float32Array]);
      // A loop is a bed of noise under the game: a low peak is right for it.
      expect(pk, id).toBeGreaterThan(sfxIsLoop(id) ? 0.05 : 0.15);
      expect(pk, id).toBeLessThanOrEqual(0.92);
      if (!sfxIsLoop(id)) expect((s as Float32Array).length / SAMPLE_RATE, id).toBeLessThanOrEqual(3.5);
    }
  });

  it('the ambience, rain, wind and storm are seamless loops (the seam is no louder than the body)', () => {
    for (const id of [...Object.values(OZ_AMBIENCE), 'oz/env/rain', 'oz/env/wind']) {
      expect(sfxIsLoop(id), id).toBe(true);
      const s = renderSfx(id) as Float32Array;
      // The last and the first 5 ms join without a jump bigger than the signal's own steps.
      const jump = Math.abs(s[0] - s[s.length - 1]);
      let step = 0;
      for (let i = 1; i < s.length; i++) step = Math.max(step, Math.abs(s[i] - s[i - 1]));
      expect(jump, id).toBeLessThanOrEqual(step + 1e-6);
    }
  });

  it('the ambience and the weather loops sit under the shots', () => {
    for (const amb of Object.values(OZ_AMBIENCE)) {
      const bed = lu(amb, AMBIENCE_GAIN);
      for (const id of ['weapon/pistol', 'weapon/machine-gun', 'enemy/shot']) expect(lu(id) - bed, `${id} over ${amb}`).toBeGreaterThanOrEqual(4);
    }
    // The rain and wind loops (LIGHT's weather may play them at full gain) sit under the shots too.
    for (const bed of ['oz/env/rain', 'oz/env/wind']) for (const id of ['weapon/pistol', 'enemy/shot']) expect(lu(id) - lu(bed), `${id} over ${bed}`).toBeGreaterThanOrEqual(4);
  });
});

// ------------------------------------------------------------------------------------------ the sample group

describe("the sample group 'mission:oldenzaal'", () => {
  it('is a known group of the engine and of the audio tools (files under public/audio/oldenzaal, lazy in the manifest)', () => {
    expect(SAMPLE_GROUPS as readonly string[]).toContain(OZ_AUDIO_GROUP);
    expect(GROUP_DIRS[OZ_AUDIO_GROUP]).toBe('oldenzaal');
    expect(LAZY_GROUPS.has(OZ_AUDIO_GROUP)).toBe(true);
    // Every group has its own folder.
    expect(new Set(Object.values(GROUP_DIRS)).size).toBe(SAMPLE_GROUPS.length);
  });
});
