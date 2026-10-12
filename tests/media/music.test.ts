import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SongDef } from '../../src/engine/music';
import {
  defineSong,
  getSong,
  hasSong,
  listSongs,
  localRow,
  midiToFreq,
  noteToMidi,
  parseSong,
  rowTime,
  songError,
  songEvents,
  songLength,
} from '../../src/engine/music';
import { hasSfx } from '../../src/engine/synth';

afterEach(() => vi.restoreAllMocks());

const base = (over: Partial<SongDef> = {}): SongDef => ({
  bpm: 120,
  rowsPerBeat: 4,
  order: ['A'],
  channels: [{ inst: 'pulse25', patterns: { A: 'C4 - - . | E4 . G4 -' } }],
  ...over,
});

describe('notes', () => {
  it('converts names to MIDI and frequencies', () => {
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('C#4')).toBe(61);
    expect(noteToMidi('Bb2')).toBe(46);
    expect(noteToMidi('H4')).toBeNull();
    expect(midiToFreq(69)).toBe(440);
  });
});

describe('parseSong', () => {
  it('flattens patterns: holds extend notes, rests end them', () => {
    const s = parseSong(base());
    expect(s.rowDur).toBeCloseTo(0.125, 9);
    expect(s.totalRows).toBe(8);
    expect(s.notes.map((n) => `${n.row}:${n.midi}x${n.rows}`)).toEqual(['0:60x3', '4:64x1', '6:67x2']);
  });

  it('supports chords, velocities, transposition and octave presets', () => {
    const s = parseSong(base({ channels: [{ inst: 'pulse25', transpose: 12, patterns: { A: 'C4+E4:5 . G4! .' } }] }));
    expect(s.notes.map((n) => [n.row, n.midi, n.vel])).toEqual([
      [0, 72, 0.8],
      [0, 76, 0.5],
      [2, 79, 1],
    ]);
  });

  it('parses drums with accents and combos', () => {
    const s = parseSong(base({ channels: [{ inst: 'drums', patterns: { A: 'k . s . K+h . c .' } }] }));
    expect(s.notes.map((n) => `${n.row}:${n.drum}@${n.vel}`)).toEqual([
      '0:drum/kick@0.8',
      '2:drum/snare@0.8',
      '4:drum/kick@1',
      '4:drum/hat@0.8',
      '6:drum/crash@0.8',
    ]);
    for (const d of ['kick', 'snare', 'hat', 'ohat', 'crash', 'tom', 'clap', 'rim']) expect(hasSfx(`drum/${d}`)).toBe(true);
  });

  it('lets drum channels map extra letters to any sound', () => {
    const s = parseSong(base({ channels: [{ inst: 'drums', kit: { x: 'env/thunder', k: 'drum/tom' }, patterns: { A: 'x . k . X . r .' } }] }));
    expect(s.notes.map((n) => `${n.drum}@${n.vel}`)).toEqual(['env/thunder@0.8', 'drum/tom@0.8', 'env/thunder@1', 'drum/rim@0.8']);
    expect(() => parseSong(base({ channels: [{ inst: 'drums', patterns: { A: 'z' } }] }))).toThrow(/letters: c h k o p r s t/);
  });

  it('slides: ~ into a held note, automatic glide for legato notes', () => {
    const s = parseSong(base({ channels: [{ inst: 'lead', patterns: { A: 'C4 - ~G4 - . ~E4 C4+E4 ~D4' } }] }));
    const by = s.notes.map((n) => `${n.row}:${n.midi}${n.from !== undefined ? `<${n.from}@${n.glide}` : ''}`);
    // ~E4 after a rest has nothing to slide from; ~D4 after a chord does not slide either.
    expect(by).toEqual(['0:60', '2:67<60@0.06', '5:64', '6:60', '6:64', '7:62']);
    const g = parseSong(
      base({ channels: [{ inst: { kind: 'saw', env: { a: 0.01, d: 0.1, s: 0.8, r: 0.1 }, glide: 0.1 }, patterns: { A: 'C3 D3 . E3' } }] }),
    );
    expect(g.notes.map((n) => n.from)).toEqual([undefined, 48, undefined]);
    expect(g.notes[1].glide).toBe(0.1);
    const ev = songEvents(g, 0, 0.3);
    expect(ev[1]).toMatchObject({ midi: 50, from: 48, glide: 0.1 });
  });

  it('transposes order slots with A+N / A-N', () => {
    const s = parseSong(
      base({
        order: ['A', 'A+2', 'A-12'],
        channels: [
          { inst: 'pulse25', patterns: { A: 'C4 . . .' } },
          { inst: 'drums', patterns: { A: 'k . . .' } },
        ],
      }),
    );
    expect(s.notes.filter((n) => !n.drum).map((n) => n.midi)).toEqual([60, 62, 48]);
    expect(s.notes.filter((n) => n.drum).length).toBe(3);
    expect(() => parseSong(base({ order: ['B+2'] }))).toThrow(/order\[0\] uses pattern "B\+2"/);
  });

  it('lets a hold continue across a pattern boundary', () => {
    const s = parseSong(base({ order: ['A', 'B'], channels: [{ inst: 'bass', patterns: { A: 'C2 -', B: '- .' } }] }));
    expect(s.notes).toHaveLength(1);
    expect(s.notes[0].rows).toBe(3);
  });

  it('gives clear errors', () => {
    expect(() => parseSong(base({ channels: [{ inst: 'pulse25', patterns: { A: 'C4 H4' } }] }), 'm1')).toThrow(
      /song "m1": channel 0 pattern "A" row 1: "H4" is not a note/,
    );
    expect(() =>
      parseSong(base({ channels: [{ inst: 'pulse25', patterns: { A: 'C4 .' } }, { inst: 'bass', patterns: { A: 'C2 . .' } }] })),
    ).toThrow(/has 2 rows in one channel but 3 in channel 1/);
    expect(() => parseSong(base({ order: ['A', 'Z'] }))).toThrow(/order\[1\] uses pattern "Z"/);
    expect(() => parseSong(base({ bpm: 0 }))).toThrow(/bpm/);
    expect(() => parseSong(base({ loop: 3 }))).toThrow(/loop must be an order index/);
    expect(() => parseSong(base({ channels: [{ inst: 'kazoo' as never, patterns: { A: 'C4' } }] }))).toThrow(/unknown instrument "kazoo"/);
    expect(() => parseSong(base({ channels: [{ inst: 'drums', patterns: { A: 'k x' } }] }))).toThrow(/"x" is not a drum/);
  });
});

describe('scheduler', () => {
  it('returns the notes that start inside a window', () => {
    const s = parseSong(base());
    const ev = songEvents(s, 0, 0.5);
    expect(ev.map((e) => [e.time, e.midi, e.dur])).toEqual([[0, 60, 0.375]]);
    const later = songEvents(s, 0.5, 1);
    expect(later.map((e) => [e.time, e.midi])).toEqual([
      [0.5, 64],
      [0.75, 67],
    ]);
    // Window edges: [t0, t1) — no duplicates across adjacent windows.
    const a = songEvents(s, 0, 0.75).length;
    const b = songEvents(s, 0.75, 2).length;
    expect(a + b).toBe(songEvents(s, 0, 2).length);
  });

  it('unrolls loops seamlessly from the loop point', () => {
    const s = parseSong(base({ order: ['I', 'L'], loop: 1, channels: [{ inst: 'pulse25', patterns: { I: 'C4 . . .', L: 'D4 . E4 .' } }] }));
    expect([s.totalRows, s.loopRow, songLength(s)]).toEqual([8, 4, 1]);
    expect(localRow(s, 8)).toBe(4);
    expect(localRow(s, 13)).toBe(5);
    const ev = songEvents(s, 0, 2);
    expect(ev.map((e) => `${e.time}:${e.midi}`)).toEqual(['0:60', '0.5:62', '0.75:64', '1:62', '1.25:64', '1.5:62', '1.75:64']);
  });

  it('stops one-shot songs at the end', () => {
    const s = parseSong(base({ loop: null }));
    expect(localRow(s, 8)).toBe(-1);
    expect(songEvents(s, 1, 10)).toHaveLength(0);
  });

  it('applies swing to odd rows', () => {
    const s = parseSong(base({ swing: 0.25, channels: [{ inst: 'drums', patterns: { A: 'h h h h h h h h' } }] }));
    expect(rowTime(s, 1)).toBeCloseTo(0.125 * 1.25, 9);
    const times = songEvents(s, 0, 1).map((e) => e.time);
    expect(times[1]).toBeCloseTo(0.15625, 9);
    expect(times[2]).toBeCloseTo(0.25, 9);
  });

  it('reuses the output array', () => {
    const s = parseSong(base());
    const out = songEvents(s, 0, 0.1, []);
    expect(songEvents(s, 0.5, 0.6, out)).toBe(out);
    expect(out).toHaveLength(2);
  });
});

describe('docs/api/media.md example', () => {
  it('parses and loops', () => {
    const s = parseSong(
      {
        bpm: 150,
        rowsPerBeat: 4,
        order: ['intro', 'a', 'a', 'b'],
        loop: 1,
        swing: 0,
        channels: [
          {
            inst: 'lead',
            vol: 0.9,
            patterns: {
              intro: '. . . . | . . . . | . . . . | . . . .',
              a: 'E5 - - . | G5 - A5 . | B5 - - - | A5 . G5 .',
              b: 'C6! - - - | B5 - A5 - | G5 - - - | - - . .',
            },
          },
          {
            inst: 'bass',
            patterns: {
              intro: 'E2 . E2 . | E2 . E2 . | G2 . G2 . | A2 . B2 .',
              a: 'E2 . E3 . | E2 . E3 . | G2 . G3 . | A2 . A3 .',
              b: 'C3 - - - | D3 - - - | E3 - - - | - - - -',
            },
          },
          {
            inst: 'drums',
            patterns: { intro: 'k . h . s . h . k . h . s . h h', a: 'k . h . s . h . k k h . s . h .', b: 'k+c . h . s . h . k . h . S . o .' },
          },
          {
            inst: 'pad',
            vol: 0.6,
            pan: -0.2,
            patterns: { a: 'E4+G4+B4 - - - - - - - - - - - - - - -', b: 'C4+E4+G4 - - - - - - - D4+F#4+A4 - - - - - - -' },
          },
        ],
      },
      'doc',
    );
    expect([s.totalRows, s.loopRow]).toEqual([64, 16]);
    expect(songEvents(s, 0, songLength(s) * 3).length).toBeGreaterThan(200);
  });
});

describe('registry', () => {
  it('registers valid songs and fails soft on invalid ones', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    defineSong('test/ok', base());
    defineSong('test/bad', base({ bpm: -1 }));
    expect(hasSong('test/ok')).toBe(true);
    expect(getSong('test/ok')?.totalRows).toBe(8);
    expect(getSong('test/bad')).toBeNull();
    expect(songError('test/bad')).toMatch(/bpm/);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(listSongs('test/')).toEqual(['test/bad', 'test/ok']);
  });
});
