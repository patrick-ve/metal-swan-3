/**
 * Mission oat's sound, AUDIO's part (docs/design/oat.md §9.1, §9.3; wave A: no takes yet, the synth
 * plays every id):
 * - the five songs of ids.ts `OAT_SONG` register (content manifest 'music/oat'), parse, keep their
 *   tempo, grid and form, stay in range and loop seamlessly; the part slots (`from`) point at the
 *   parts the spec names; each take form maps every synth slot;
 * - the 'oat/…' sfx (content/sfx/oat*.ts) render inside the level guides; the ambience loops are
 *   seamless and sit under the shots; the two key-ring rattles are clearly apart;
 * - the sample group 'mission:oat' is a known group of the engine and the audio tools, and its
 *   registration merges the ams sfx and voices without the ams songs.
 */
import { describe, expect, it } from 'vitest';
import type { SongDef } from '../../src/engine/music';
import { getSong, hasSong, midiToFreq, parseSong, patternRows, songError, songEvents, songLength } from '../../src/engine/music';
import { getSampleGroup, SAMPLE_GROUPS, type SampleGroup } from '../../src/engine/samples';
import { hasSfx, renderSfx, SAMPLE_RATE, sfxIsLoop } from '../../src/engine/synth';
import { isOatContent } from '../../src/game/content/index';
import { OAT } from '../../src/game/content/missions/oat/index';
import { OAT_AMBIENCE, OAT_AUDIO_GROUP, OAT_SFX_PREFIX, OAT_SONG } from '../../src/game/content/missions/oat/ids';
import { MISSION_SONGS } from '../../src/game/content/music/missions';
import {
  OAT_B_QUEUE_SLOT,
  OAT_BAR,
  OAT_BOSS_HUISJESMELKER_SLOT,
  OAT_BOSS_MAKELAAR_SLOT,
  OAT_C_CHASE_SLOT,
  OAT_D_LATE_SLOT,
  OAT_SONGS,
  OAT_TAKES,
  OAT_WALTZ_BAR,
  takeBeats,
  takeLoopBeat,
  takeSlotBeats,
} from '../../src/game/content/music/oat';
import { SAMPLE_MANIFEST } from '../../src/game/content/samples/manifest';
import { OAT_SAMPLE_GROUP, oatSampleGroup } from '../../src/game/content/samples/oat';
import '../../src/game/content/sfx/index';
import { OAT_SFX, OAT_SFX_IDS } from '../../src/game/content/sfx/oat';
import { GROUP_DIRS, LAZY_GROUPS } from '../../tools/audio/lib';
import { momentaryMax, peak } from '../../tools/audio/loudness';

// ------------------------------------------------------------------------------------------ songs

interface Form {
  bpm: number;
  /** [slot, bars, rows per bar]. */
  slots: readonly (readonly [string, number, number?])[];
  loop: number;
  /** Loop length range in seconds. */
  sec: readonly [number, number];
}

const FORMS: Readonly<Record<string, Form>> = {
  [OAT_SONG.a]: { bpm: 116, slots: [['intro', 2], ['A', 8], ['B', 8], ['C', 8]], loop: 1, sec: [45, 60] },
  [OAT_SONG.b]: { bpm: 108, slots: [['intro', 2], ['A', 8], ['A2', 8], ['B', 8], ['B2', 8]], loop: 1, sec: [60, 80] },
  [OAT_SONG.c]: { bpm: 144, slots: [['intro', 2], ['A', 8], ['A2', 8], ['A', 8], ['A2', 8], ['B', 8], ['B2', 8], ['B3', 8]], loop: 5, sec: [35, 45] },
  [OAT_SONG.d]: { bpm: 104, slots: [['intro', 2], ['A', 8], ['B', 8], ['A2', 8], ['C', 8], ['C2', 8]], loop: 1, sec: [85, 100] },
  [OAT_SONG.boss]: {
    bpm: 132,
    slots: [['intro', 2], ['A', 8], ['A2', 8], ['A+2', 8], ['A2+2', 8], ['Bi', 2, OAT_WALTZ_BAR], ['B', 16, OAT_WALTZ_BAR], ['B2', 16, OAT_WALTZ_BAR]],
    loop: 6,
    sec: [40, 50],
  },
};
const IDS = Object.keys(FORMS);

const slotName = (s: string): string => s.replace(/[+-]\d+$/, '');

function slotRows(def: SongDef, name: string): number[] {
  return def.channels.filter((c) => c.patterns[name] !== undefined).map((c) => patternRows(c.patterns[name]).length);
}

describe('oat songs (content/music/oat.ts)', () => {
  it('defines exactly the five OAT_SONG ids, registered at import, outside MISSION_SONGS', () => {
    expect(Object.keys(OAT_SONGS).sort()).toEqual(Object.values(OAT_SONG).sort());
    expect(IDS.sort()).toEqual(Object.values(OAT_SONG).sort());
    for (const id of IDS) {
      expect(MISSION_SONGS[id], id).toBeUndefined();
      expect(hasSong(id), id).toBe(true);
      expect(songError(id), id).toBeNull();
      expect(getSong(id), id).not.toBeNull();
    }
  });

  it.each(IDS)('%s has its tempo, grid and form; every channel of a slot has the same length', (id) => {
    const f = FORMS[id];
    const def = OAT_SONGS[id];
    expect(def.bpm).toBe(f.bpm);
    expect(def.rowsPerBeat ?? 4).toBe(4);
    expect(def.order).toEqual(f.slots.map(([n]) => n));
    expect(def.loop).toBe(f.loop);
    for (const [slot, bars, rows = OAT_BAR] of f.slots) {
      const lens = slotRows(def, slotName(slot));
      expect(lens.length, `${id} ${slot}`).toBeGreaterThan(0);
      for (const n of lens) expect(n, `${id} ${slot}`).toBe(bars * rows);
    }
    const p = parseSong(def, id);
    expect(p.totalRows).toBe(f.slots.reduce((s, [, b, r = OAT_BAR]) => s + b * r, 0));
    const before = f.slots.slice(0, f.loop).reduce((s, [, b, r = OAT_BAR]) => s + b * r, 0);
    expect(p.loopRow).toBe(before);
    const sec = (p.totalRows - before) * p.rowDur;
    expect(sec).toBeGreaterThanOrEqual(f.sec[0]);
    expect(sec).toBeLessThanOrEqual(f.sec[1]);
  });

  it.each(IDS)('%s: notes in range, every channel plays', (id) => {
    const p = parseSong(OAT_SONGS[id], id);
    for (const n of p.notes) {
      expect(n.rows).toBeGreaterThanOrEqual(1);
      expect(n.vel > 0 && n.vel <= 1).toBe(true);
      if (!n.drum) expect(n.midi >= 24 && n.midi <= 96, `${id} note ${n.midi}`).toBe(true);
    }
    expect(new Set(p.notes.map((n) => n.ch)).size).toBe(p.channels.length);
  });

  it.each(IDS)('%s schedules finite notes and loops seamlessly', (id) => {
    const p = parseSong(OAT_SONGS[id], id);
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

  it('the part slots point at the spec parts (b: the queue; c: the chase; d: after 02:00; the boss: A Makelaar, B Huisjesmelker)', () => {
    expect(OAT_SONGS[OAT_SONG.b].order[OAT_B_QUEUE_SLOT]).toBe('B');
    expect(OAT_SONGS[OAT_SONG.c].order[OAT_C_CHASE_SLOT]).toBe('B');
    // The chase loops on itself (c1 and the taxi ride never fall back to the quiet quay).
    expect(OAT_SONGS[OAT_SONG.c].loop).toBe(OAT_C_CHASE_SLOT);
    expect(OAT_SONGS[OAT_SONG.d].order[OAT_D_LATE_SLOT]).toBe('C');
    expect(OAT_BOSS_MAKELAAR_SLOT).toBe(0);
    expect(OAT_SONGS[OAT_SONG.boss].order[OAT_BOSS_HUISJESMELKER_SLOT]).toBe('Bi');
    // The waltz loops on itself: the final fight never falls back to De Makelaar's strut.
    expect(OAT_SONGS[OAT_SONG.boss].loop).toBe(OAT_BOSS_HUISJESMELKER_SLOT + 1);
    // De Makelaar's part (once) lasts about a minute before the waltz starts.
    const p = parseSong(OAT_SONGS[OAT_SONG.boss], OAT_SONG.boss);
    expect(p.orderRows?.[OAT_BOSS_HUISJESMELKER_SLOT] ?? 0).toBeGreaterThan((55 / p.rowDur) | 0);
  });

  it('every take form maps each synth slot to a part start, and its loop starts on a whole bar', () => {
    expect(Object.keys(OAT_TAKES).sort()).toEqual(IDS.sort());
    for (const id of IDS) {
      const form = OAT_TAKES[id];
      const def = OAT_SONGS[id];
      expect(form.bpm, id).toBe(def.bpm);
      const beats = takeSlotBeats(id);
      expect(beats.length, id).toBe(def.order.length);
      expect(beats[0], id).toBe(0);
      // The loop slot of the synth song enters the take's loop part.
      expect(beats[def.loop ?? 0], id).toBe(takeLoopBeat(id));
      const meter = form.parts.find((x) => x.name === form.loopFrom)!.beatsPerBar;
      expect(Number.isInteger(takeLoopBeat(id) / meter), id).toBe(true);
      for (const b of beats) expect(b, id).toBeLessThan(takeBeats(id));
    }
  });
});

// ------------------------------------------------------------------------------------------ sfx

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

/** Zero crossings per second (a rough brightness: the high key ring crosses far more often). */
function zcr(s: Float32Array): number {
  let n = 0;
  for (let i = 1; i < s.length; i++) if (s[i - 1] < 0 !== s[i] < 0) n++;
  return n / (s.length / SAMPLE_RATE);
}

describe('oat sfx (content/sfx/oat*.ts)', () => {
  it("every id is under 'oat/', unique, and `OAT_SFX` names exactly them", () => {
    expect(OAT_SFX_IDS.length).toBeGreaterThanOrEqual(55);
    expect(new Set(OAT_SFX_IDS).size).toBe(OAT_SFX_IDS.length);
    for (const id of OAT_SFX_IDS) expect(id.startsWith(OAT_SFX_PREFIX), id).toBe(true);
    const table = Object.values(OAT_SFX);
    expect(new Set(table).size).toBe(table.length);
    // The table holds every id but the section ambience (ids.ts OAT_AMBIENCE).
    const ambience = new Set(Object.values(OAT_AMBIENCE));
    expect([...table].sort()).toEqual(OAT_SFX_IDS.filter((id) => !ambience.has(id)).sort());
  });

  it('every id renders, peaks inside the guides and is not silent; the one-shots are short', () => {
    for (const id of OAT_SFX_IDS) {
      expect(hasSfx(id), id).toBe(true);
      const s = renderSfx(id);
      expect(s, id).not.toBeNull();
      const pk = peak([s as Float32Array]);
      expect(pk, id).toBeGreaterThan(sfxIsLoop(id) ? 0.05 : 0.15);
      expect(pk, id).toBeLessThanOrEqual(0.92);
      // The 8 s draaiorgel waltz is the one long sting.
      if (!sfxIsLoop(id)) expect((s as Float32Array).length / SAMPLE_RATE, id).toBeLessThanOrEqual(id === OAT_SFX.organWaltz ? 8.5 : 4.5);
    }
  });

  it('the section ambience and the other loops are seamless loops (the seam is no louder than the body)', () => {
    const loops = OAT_SFX_IDS.filter((id) => sfxIsLoop(id));
    expect(loops.sort()).toEqual([...Object.values(OAT_AMBIENCE), OAT_SFX.brammobielMotor, OAT_SFX.swanWake, OAT_SFX.neonBuzz, OAT_SFX.scooterBuzz, OAT_SFX.receiptPrint].sort());
    for (const id of loops) {
      const s = renderSfx(id) as Float32Array;
      const jump = Math.abs(s[0] - s[s.length - 1]);
      let step = 0;
      for (let i = 1; i < s.length; i++) step = Math.max(step, Math.abs(s[i] - s[i - 1]));
      expect(jump, id).toBeLessThanOrEqual(step + 1e-6);
    }
  });

  it('the ambience sits at least 4 LU under the shots', () => {
    for (const amb of Object.values(OAT_AMBIENCE)) {
      const bed = lu(amb, AMBIENCE_GAIN);
      for (const id of ['weapon/pistol', 'weapon/machine-gun', 'enemy/shot']) expect(lu(id) - bed, `${id} over ${amb}`).toBeGreaterThanOrEqual(4);
    }
  });

  it("De Huisjesmelker's two key-ring rattles are clearly apart (low is darker and heavier than high)", () => {
    const low = renderSfx(OAT_SFX.keysLow) as Float32Array;
    const high = renderSfx(OAT_SFX.keysHigh) as Float32Array;
    expect(zcr(high)).toBeGreaterThan(zcr(low) * 2);
    expect(low.length).toBeGreaterThan(high.length);
  });
});

// ------------------------------------------------------------------------------------------ the sample group

describe("the sample group 'mission:oat' (content/samples/oat.ts)", () => {
  it('is a known group of the engine and of the audio tools (files under public/audio/oat, lazy in the manifest)', () => {
    expect(OAT_SAMPLE_GROUP).toBe(OAT_AUDIO_GROUP);
    expect(SAMPLE_GROUPS as readonly string[]).toContain(OAT_AUDIO_GROUP);
    expect(GROUP_DIRS[OAT_AUDIO_GROUP]).toBe('oat');
    expect(LAZY_GROUPS.has(OAT_AUDIO_GROUP)).toBe(true);
    expect(new Set(Object.values(GROUP_DIRS)).size).toBe(SAMPLE_GROUPS.length);
  });

  it("the mission's songs and every section's song and ambience are registered by these modules", () => {
    expect(OAT.audioGroup).toBe(OAT_AUDIO_GROUP);
    for (const id of [OAT.music, OAT.bossMusic]) expect(hasSong(id ?? ''), id).toBe(true);
    for (const sec of Object.values(OAT.sections)) {
      expect(hasSong(sec.music ?? ''), `${sec.id} music ${sec.music}`).toBe(true);
      expect(hasSfx(sec.ambience ?? ''), `${sec.id} ambience ${sec.ambience}`).toBe(true);
      expect(sec.ambience, sec.id).toBe(OAT_AMBIENCE[sec.id as keyof typeof OAT_AMBIENCE]);
    }
  });

  it('the audio modules load lazily with the oat chunk (their manifest names pass isOatContent)', () => {
    for (const id of ['music/oat', 'sfx/oat', 'samples/oat']) expect(isOatContent(id), id).toBe(true);
  });

  it('registers at import: the ams sfx and voices (the reused handhaver and rider takes) without the ams songs', () => {
    const g = getSampleGroup(OAT_AUDIO_GROUP);
    expect(g).toBeDefined();
    const ams = SAMPLE_MANIFEST['mission:ams'];
    expect(Object.keys(g?.voice ?? {}).length).toBeGreaterThanOrEqual(Object.keys(ams?.voice ?? {}).length);
    for (const k of Object.keys(ams?.voice ?? {})) expect(g?.voice?.[k], k).toBe(ams?.voice?.[k]);
    for (const k of Object.keys(ams?.sfx ?? {})) expect(g?.sfx?.[k], k).toBe(ams?.sfx?.[k]);
    for (const k of Object.keys(ams?.music ?? {})) expect(g?.music?.[k], k).toBeUndefined();
  });

  it("oat's own takes win on a shared id, and its long songs stream", () => {
    const amsVoice = { files: ['ams/voice/x-1.mp3'], duration: 1 };
    const oatVoice = { files: ['oat/voice/x-1.mp3'], duration: 1.2 };
    const manifest: Record<string, SampleGroup> = {
      'mission:ams': { voice: { x: amsVoice }, music: { ams: { file: 'ams/music/ams-1.mp3', loopStart: 0, duration: 90 } } },
      'mission:oat': {
        voice: { x: oatVoice },
        music: { 'oat-a': { file: 'oat/music/oat-a-1.mp3', loopStart: 4, duration: 56, marks: [0, 4, 20, 37] }, sting: { file: 'oat/music/s.mp3', loopStart: null, duration: 5 } },
      },
    };
    const g = oatSampleGroup(manifest);
    expect(g.voice?.x).toBe(oatVoice);
    expect(g.music?.ams).toBeUndefined();
    expect(g.music?.['oat-a']?.stream).toBe(true);
    expect(g.music?.['oat-a']?.marks).toEqual([0, 4, 20, 37]);
    expect(g.music?.sting?.stream).toBeUndefined();
    // No manifest group of its own yet (wave A): the ams half alone, no songs.
    const bare = oatSampleGroup({ 'mission:ams': manifest['mission:ams'] });
    expect(bare.voice?.x).toBe(amsVoice);
    expect(bare.music).toBeUndefined();
  });
});
