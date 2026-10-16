/**
 * The first-person mode's synth fallbacks (docs/design/fps.md §9; group fps-sound):
 * - every §9.1 `fps/*` id is registered by the lazy entry `fps/sound`, and only those;
 * - every sound renders cleanly (finite, audible, under the ceiling, no DC, sane length) inside
 *   the game's loudness plan, deterministically, and fast repeats fit their voice limits;
 * - the tell sounds last their tell (§4.3, §7.2);
 * - the four §9.2 songs register, parse, have their tempo, grid and form, and loop seamlessly.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { SongDef } from '../../src/engine/music';
import { getSong, hasSong, midiToFreq, parseSong, patternRows, songError, songEvents, songLength } from '../../src/engine/music';
import { getSfxRecipe, hashSeed, hasSfx, listSfx, recipeLength, renderRecipe, renderSfx, SAMPLE_RATE, sfxLimits, type SfxRecipe } from '../../src/engine/synth';
import { loadContent } from '../../src/game/content/index';
import { FPS_SONG_BAR, FPS_SONGS } from '../../src/game/content/fps/music';
import { FPS_SFX, FPS_TELLS } from '../../src/game/content/fps/sfx';

// ------------------------------------------------------------------------------------------ spec

const SPEC = readFileSync(new URL('../../docs/design/fps.md', import.meta.url), 'utf8');

function section(start: string, end: string): string {
  const a = SPEC.indexOf(start);
  const b = SPEC.indexOf(end, a);
  return SPEC.slice(a, b);
}

/** The §9.1 sound ids, read from the spec itself (so the list never drifts). */
const SPEC_SFX = [...new Set([...section('### 9.1', '### 9.2').matchAll(/`(fps\/[a-z0-9/-]+)`/g)].map((m) => m[1]))].sort();
/** The §9.2 song ids. */
const SPEC_SONGS = [...new Set([...section('### 9.2', '### 9.3').matchAll(/`(fps-[a-z]+)`/g)].map((m) => m[1]))].sort();

beforeAll(async () => {
  const report = await loadContent((id) => id === 'fps/sound');
  expect(report.failed).toEqual([]);
});

// ------------------------------------------------------------------------------------------ helpers

function peakOf(s: Float32Array): number {
  let p = 0;
  for (let i = 0; i < s.length; i++) p = Math.max(p, Math.abs(s[i]));
  return p;
}

/** One RBJ / BS.1770 biquad as a closure. */
function biquad(b0: number, b1: number, b2: number, a1: number, a2: number): (x: number) => number {
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  return (x) => {
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return y;
  };
}

/** K-weighted maximum momentary loudness (400 ms windows, 50 ms hop) in LUFS (as tests/content/sfx.test.ts). */
function loudness(s: Float32Array): number {
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

/** Seconds until the sound last rises above −34 dBFS (0.02). */
function audibleFor(id: string): number {
  const s = renderSfx(id) as Float32Array;
  let last = 0;
  for (let i = 0; i < s.length; i++) if (Math.abs(s[i]) > 0.02) last = i;
  return last / SAMPLE_RATE;
}

// ------------------------------------------------------------------------------------------ sfx

describe('fps sound ids (§9.1)', () => {
  it('reads the §9.1 list from the spec', () => {
    expect(SPEC_SFX.length).toBeGreaterThanOrEqual(44);
    expect(SPEC_SFX).toContain('fps/boss/spin-up');
    expect(SPEC_SFX).toContain('fps/shout-ss');
  });

  it('defines exactly the §9.1 ids, and the lazy entry registers every one', () => {
    expect(Object.keys(FPS_SFX).sort()).toEqual(SPEC_SFX);
    expect(SPEC_SFX.filter((id) => !hasSfx(id))).toEqual([]);
    expect(listSfx('fps/').sort()).toEqual(SPEC_SFX);
  });

  it('reuses the main game sounds the spec names (1UP, tally ticks) instead of redefining them', () => {
    for (const id of ['item/1up', 'ui/tally-tick', 'ui/tally-end']) expect(FPS_SFX[id], id).toBeUndefined();
  });

  it('every tell sound is a §9.1 id', () => {
    for (const id of Object.keys(FPS_TELLS)) expect(SPEC_SFX, id).toContain(id);
  });
});

describe('every fps sound renders cleanly', () => {
  it.each(Object.keys(FPS_SFX).sort())('%s: finite, audible, under the ceiling, no DC, sane length, in the loudness plan', (id) => {
    const s = renderSfx(id) as Float32Array;
    expect(s).not.toBeNull();
    expect(s.every(Number.isFinite), `${id} has NaN / Infinity`).toBe(true);
    const peak = peakOf(s);
    expect(peak, `${id} peak`).toBeGreaterThan(0.18);
    expect(peak, `${id} peak`).toBeLessThanOrEqual(0.9);
    let mean = 0;
    for (let i = 0; i < s.length; i++) mean += s[i];
    expect(Math.abs(mean / s.length), `${id} DC offset`).toBeLessThan(0.02);
    const seconds = s.length / SAMPLE_RATE;
    expect(seconds, `${id} length`).toBeGreaterThanOrEqual(0.025);
    expect(seconds, `${id} length`).toBeLessThan(3);
    expect(recipeLength(getSfxRecipe(id) as SfxRecipe)).toBeCloseTo(seconds, 3);
    // docs/api/sfx.md §4: −27 (frequent) … −10 (big) LUFS momentary maximum.
    const lu = loudness(s);
    expect(lu, `${id} loudness`).toBeGreaterThanOrEqual(-27);
    expect(lu, `${id} loudness`).toBeLessThanOrEqual(-10);
    // Not a loop: every fps sound is a one-shot.
    expect(FPS_SFX[id].loop).not.toBe(true);
  });

  it('renders deterministically (the noise seed is pinned to the id)', () => {
    for (const id of ['fps/pistol', 'fps/glitch', 'fps/pushwall', 'fps/boss/break']) {
      expect(renderRecipe(FPS_SFX[id], hashSeed(id)), id).toEqual(renderSfx(id));
    }
  });

  it.each([
    ['fps/mg', 10],
    ['fps/chaingun', 5],
    ['fps/boss/chaingun', 4],
    ['fps/enemy/mg', 6],
    ['fps/type', 4],
    ['fps/pistol', 14],
  ] as const)('%s fits its fastest repeat (every %i ticks): the gap is shorter, voices ≥ 2', (id, ticks) => {
    const { voices, gap } = sfxLimits(id);
    expect(gap).toBeLessThan(ticks / 60);
    expect(voices).toBeGreaterThanOrEqual(2);
  });
});

describe('telegraph sounds last their tell', () => {
  it.each(Object.entries(FPS_TELLS))('%s stays audible for its %i-tick tell (and at least 18 ticks)', (id, ticks) => {
    expect(audibleFor(id)).toBeGreaterThanOrEqual(Math.max(18, ticks) / 60);
  });

  it('the boss spin-up rises for the full 0.5 s and stops at its peak (no tail past 0.55 s)', () => {
    const s = renderSfx('fps/boss/spin-up') as Float32Array;
    expect(s.length / SAMPLE_RATE).toBeLessThan(0.56);
    expect(audibleFor('fps/boss/spin-up')).toBeGreaterThanOrEqual(0.48);
  });

  it('the push wall grinds for about one tile (1.8 s) and the boss break ends on its clunk (about 2 s)', () => {
    expect(audibleFor('fps/pushwall')).toBeGreaterThanOrEqual(1.7);
    expect(audibleFor('fps/boss/break')).toBeGreaterThanOrEqual(1.9);
  });
});

// ------------------------------------------------------------------------------------------ songs

interface Form {
  bpm: number;
  rowsPerBeat: number;
  slots: readonly (readonly [string, number])[];
  order: readonly string[];
  loop: number | null;
  /** Seconds of the looped part (or of the whole song when it does not loop). */
  loopSec: readonly [number, number];
}

const FORMS: Readonly<Record<string, Form>> = {
  'fps-floor': { bpm: 100, rowsPerBeat: 4, slots: [['A', 8], ['B', 8], ['C', 8], ['D', 8]], order: ['A', 'B', 'C', 'D'], loop: 0, loopSec: [60, 90] },
  'fps-boss': {
    bpm: 140,
    rowsPerBeat: 4,
    slots: [['intro', 2], ['A', 8], ['B', 8], ['C', 4]],
    order: ['intro', 'A', 'B', 'C', 'C+2', 'C+3', 'C+5'],
    loop: 1,
    loopSec: [50, 65],
  },
  'fps-tally': { bpm: 120, rowsPerBeat: 4, slots: [['A', 4]], order: ['A'], loop: null, loopSec: [6, 8.5] },
  'fps-bridge': { bpm: 60, rowsPerBeat: 8, slots: [['sting', 1], ['drone', 4]], order: ['sting', 'drone'], loop: 1, loopSec: [15, 17] },
};
const IDS = Object.keys(FORMS).sort();

function slotRows(def: SongDef, name: string): number[] {
  return def.channels.filter((c) => c.patterns[name] !== undefined).map((c) => patternRows(c.patterns[name]).length);
}

describe('fps songs (§9.2)', () => {
  it('defines exactly the §9.2 songs', () => {
    expect(SPEC_SONGS).toEqual(IDS);
    expect(Object.keys(FPS_SONGS).sort()).toEqual(IDS);
  });

  it.each(IDS)('%s is registered without errors', (id) => {
    expect(hasSong(id)).toBe(true);
    expect(songError(id)).toBeNull();
    expect(getSong(id)).not.toBeNull();
  });

  it.each(IDS)('%s has its tempo, grid and form; every channel of a slot has the same length', (id) => {
    const f = FORMS[id];
    const def = FPS_SONGS[id];
    const bar = FPS_SONG_BAR[id];
    expect(def.bpm).toBe(f.bpm);
    expect(def.rowsPerBeat ?? 4).toBe(f.rowsPerBeat);
    expect(bar).toBe(f.rowsPerBeat * 4);
    expect(def.order).toEqual(f.order);
    expect(def.loop).toBe(f.loop);
    for (const [name, barsLong] of f.slots) {
      const lens = slotRows(def, name);
      expect(lens.length, `${id} ${name}`).toBeGreaterThan(0);
      for (const n of lens) expect(n, `${id} ${name}`).toBe(barsLong * bar);
    }
    const p = parseSong(def, id);
    const loopRow = f.loop === null ? 0 : (p.loopRow ?? 0);
    const sec = (p.totalRows - loopRow) * p.rowDur;
    expect(sec).toBeGreaterThanOrEqual(f.loopSec[0]);
    expect(sec).toBeLessThanOrEqual(f.loopSec[1]);
  });

  it('the bridge sting lasts 4 s, then the drone loops', () => {
    const p = parseSong(FPS_SONGS['fps-bridge'], 'fps-bridge');
    expect((p.loopRow ?? 0) * p.rowDur).toBeCloseTo(4, 6);
  });

  it.each(IDS)('%s: notes in range, every channel plays, every drum is a registered sound', (id) => {
    const p = parseSong(FPS_SONGS[id], id);
    for (const n of p.notes) {
      expect(n.rows).toBeGreaterThanOrEqual(1);
      expect(n.vel > 0 && n.vel <= 1).toBe(true);
      if (n.drum) expect(hasSfx(n.drum), `${id} drum ${n.drum}`).toBe(true);
      else expect(n.midi >= 24 && n.midi <= 96, `${id} note ${n.midi}`).toBe(true);
    }
    expect(new Set(p.notes.map((n) => n.ch)).size).toBe(p.channels.length);
  });

  it.each(IDS.filter((id) => FORMS[id].loop !== null))('%s schedules finite notes and loops seamlessly', (id) => {
    const p = parseSong(FPS_SONGS[id], id);
    const pass = songLength(p);
    const ev = songEvents(p, 0, pass + 4);
    expect(ev.length).toBeGreaterThan(50);
    for (const e of ev) {
      expect(Number.isFinite(e.time) && Number.isFinite(e.dur) && e.dur > 0).toBe(true);
      if (!e.drum) expect(Number.isFinite(midiToFreq(e.midi))).toBe(true);
    }
    const loopT = (p.loopRow ?? 0) * p.rowDur;
    const key = (t0: number) => songEvents(p, t0, t0 + 2).map((e) => `${e.ch}:${e.midi}:${e.drum ?? ''}:${(e.time - t0).toFixed(4)}`);
    expect(key(pass)).toEqual(key(loopT));
  });

  it('the tally jingle plays once and ends', () => {
    const p = parseSong(FPS_SONGS['fps-tally'], 'fps-tally');
    expect(p.loopRow).toBeNull();
    const pass = songLength(p);
    expect(songEvents(p, pass, pass + 10)).toEqual([]);
  });
});
