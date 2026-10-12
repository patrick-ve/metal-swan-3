/**
 * Shared runtime additions for the mission wave: live terrain hazards, music start index
 * (MusicOpts.from), sfx pitch jitter.
 */
import { describe, expect, it } from 'vitest';
import { NullAudio, jitterPitch, orderTime } from '../../src/engine/audio';
import { parseSong, rowTime } from '../../src/engine/music';
import { defineSfx, sfxJitter } from '../../src/engine/synth';
import { Terrain, terrain, type HazardDef } from '../../src/engine/terrain';

describe('Terrain.addHazard / removeHazard', () => {
  it('adds a live rect that every reader sees, moves with it, and removes it', () => {
    const t = terrain(400, 216);
    t.ground().at(0, 176).flat(400);
    t.hazard('water', 300, 180, 100, 36);
    const tr = new Terrain(t.build());
    expect(tr.hazards.length).toBe(1);
    const h: HazardDef = { kind: 'kill', x: 40, y: 100, w: 20, h: 76 };
    const probe = { x: 45, y: 150, w: 4, h: 4 };
    expect(tr.hazardAt(probe)).toBeNull();
    expect(tr.addHazard(h)).toBe(true);
    expect(tr.addHazard(h)).toBe(false); // no duplicate
    expect(tr.hazards.length).toBe(2);
    expect(tr.hazardAt(probe)).toBe(h);
    h.x = 200; // moved in place
    expect(tr.hazardAt(probe)).toBeNull();
    expect(tr.hazardAt({ x: 205, y: 150, w: 4, h: 4 })).toBe(h);
    expect(tr.removeHazard(h)).toBe(true);
    expect(tr.removeHazard(h)).toBe(false);
    expect(tr.hazards.length).toBe(1);
    expect(tr.hazards[0].kind).toBe('water');
  });
});

describe('music start index', () => {
  const song = parseSong({
    bpm: 120,
    channels: [{ inst: 'pulse25', patterns: { A: 'C4 . . .', B: 'D4 . E4 . F4 . G4 .' } }],
    order: ['A', 'B', 'A'],
  });

  it('orderRows / orderTime give the start of each order slot', () => {
    expect(song.orderRows).toEqual([0, 4, 12]);
    expect(orderTime(song, 0)).toBe(0);
    expect(orderTime(song, 1)).toBeCloseTo(rowTime(song, 4), 9);
    expect(orderTime(song, 2)).toBeCloseTo(rowTime(song, 12), 9);
    expect(orderTime(song, 99)).toBeCloseTo(rowTime(song, 12), 9); // clamped
    expect(orderTime(song, -3)).toBe(0);
  });

  it('NullAudio logs the start index', () => {
    const a = new NullAudio();
    a.music('stage', { from: 2 });
    a.music('stage');
    a.music(null, { from: 1 });
    expect(a.log).toEqual(['music:stage@2', 'music:stage', 'music:stop']);
  });
});

describe('sfx jitter', () => {
  it('jitterPitch spreads ±jitter around the base pitch', () => {
    expect(jitterPitch(1, 0, 0.9)).toBe(1);
    expect(jitterPitch(1, 0.1, 0)).toBeCloseTo(0.9, 9);
    expect(jitterPitch(1, 0.1, 0.5)).toBeCloseTo(1, 9);
    expect(jitterPitch(2, 0.1, 0.999999)).toBeCloseTo(2.2, 4);
  });

  it('sfxJitter reads the recipe (clamped to 0.5)', () => {
    defineSfx('test/jitter-a', { jitter: 0.08, layers: [{ wave: 'square', freq: 440, env: { d: 0.02 } }] });
    defineSfx('test/jitter-b', { jitter: 3, layers: [{ wave: 'square', freq: 440, env: { d: 0.02 } }] });
    expect(sfxJitter('test/jitter-a')).toBe(0.08);
    expect(sfxJitter('test/jitter-b')).toBe(0.5);
    expect(sfxJitter('test/none')).toBe(0);
  });
});
