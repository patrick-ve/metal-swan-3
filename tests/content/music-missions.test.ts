/**
 * Songs of music/missions.ts (GDD §12.2): `select`, `briefing`, `m1`–`m4`, `anthem`, `high-score`.
 * - every id registers and parses; tempo, rows per beat and form (bars per section, loop bar)
 *   follow the GDD table;
 * - the scheduler gives finite note times across the loop seam (no NaN), every note is in range;
 * - the leitmotifs: the anthem's 7th melody note is a semitone flat, the Cygnet hook is in `select`;
 * - rendered through the real Web Audio graph in headless Chromium: no NaN, a peak ceiling,
 *   levels in one family with the songs of music/index.ts, no gap at the loop seam.
 *   That part skips (with a warning) when Chromium cannot start.
 */
import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'playwright';
import { chromium } from 'playwright';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { SongDef } from '../../src/engine/music';
import { getSong, hasSong, midiToFreq, noteToMidi, parseSong, patternRows, songError, songEvents, songLength } from '../../src/engine/music';
import { anthemLine, CYGNET_HOOK } from '../../src/game/content/music/index';
import { MISSION_SONGS } from '../../src/game/content/music/missions';

interface Form {
  bpm: number;
  rowsPerBeat: number;
  rowsPerBar: number;
  /** Pattern name and length in bars, in play order. */
  slots: readonly (readonly [string, number])[];
  /** Order index the song loops to; null = plays once. */
  loop: number | null;
  swing?: number;
}

/** GDD §12.2, one row per song (m1 is 6/8 at 3 rows per beat; m4 swings 8ths at 2 rows per beat). */
const FORMS: Readonly<Record<string, Form>> = {
  select: { bpm: 128, rowsPerBeat: 4, rowsPerBar: 16, slots: [['A', 16]], loop: 0 },
  briefing: { bpm: 96, rowsPerBeat: 4, rowsPerBar: 16, slots: [['A', 8]], loop: 0 },
  m1: { bpm: 132, rowsPerBeat: 3, rowsPerBar: 6, slots: [['intro', 4], ['A', 16], ['B', 16], ['A2', 16]], loop: 1 },
  m2: { bpm: 140, rowsPerBeat: 4, rowsPerBar: 16, slots: [['intro', 8], ['A', 16], ['B', 16], ['A2', 16]], loop: 1 },
  m3: { bpm: 120, rowsPerBeat: 4, rowsPerBar: 16, slots: [['intro', 8], ['A', 16], ['B', 16], ['A2', 16]], loop: 1 },
  m4: { bpm: 150, rowsPerBeat: 2, rowsPerBar: 8, slots: [['A', 16], ['B', 16], ['break', 8], ['A2', 16]], loop: 0, swing: 0.3 },
  anthem: { bpm: 84, rowsPerBeat: 4, rowsPerBar: 16, slots: [['A', 8]], loop: null },
  'high-score': { bpm: 132, rowsPerBeat: 4, rowsPerBar: 16, slots: [['A', 8]], loop: 0 },
};

const IDS = Object.keys(FORMS);

/** Rows of a slot (the first channel that defines the pattern). */
function slotRows(def: SongDef, name: string): number {
  const ch = def.channels.find((c) => c.patterns[name] !== undefined);
  return ch ? patternRows(ch.patterns[name]).length : -1;
}

/** MIDI notes of one melodic channel in play order (one pass; chords give their first note). */
function lineOf(id: string, ch: number): number[] {
  const p = parseSong(MISSION_SONGS[id], id);
  const out: number[] = [];
  let lastRow = -1;
  for (const n of p.notes) {
    if (n.ch !== ch || n.row === lastRow) continue;
    out.push(n.midi);
    lastRow = n.row;
  }
  return out;
}

function intervals(midis: readonly number[]): number[] {
  return midis.slice(1).map((m, i) => m - midis[i]);
}

describe('mission and menu songs: registry and form (GDD §12.2)', () => {
  it('defines exactly the ids of this module', () => {
    expect(Object.keys(MISSION_SONGS).sort()).toEqual([...IDS].sort());
  });

  it.each(IDS)('%s is registered without errors', (id) => {
    expect(hasSong(id)).toBe(true);
    expect(songError(id)).toBeNull();
    expect(getSong(id)).not.toBeNull();
  });

  it.each(IDS)('%s has the GDD tempo, grid and form, and loops at the right bar', (id) => {
    const f = FORMS[id];
    const def = MISSION_SONGS[id];
    expect(def.bpm).toBe(f.bpm);
    expect(def.rowsPerBeat ?? 4).toBe(f.rowsPerBeat);
    expect(def.swing ?? 0).toBe(f.swing ?? 0);
    expect(def.order).toEqual(f.slots.map(([name]) => name));
    for (const [name, barsLong] of f.slots) expect(slotRows(def, name), `${id} ${name}`).toBe(barsLong * f.rowsPerBar);

    const p = parseSong(def, id);
    const totalBars = f.slots.reduce((sum, [, b]) => sum + b, 0);
    expect(p.totalRows).toBe(totalBars * f.rowsPerBar);
    if (f.loop === null) {
      expect(p.loopRow).toBeNull();
    } else {
      const loopBar = f.slots.slice(0, f.loop).reduce((sum, [, b]) => sum + b, 0);
      expect(p.loopRow).toBe(loopBar * f.rowsPerBar);
    }
  });

  it.each(IDS)('%s: every note is in range and every channel plays', (id) => {
    const p = parseSong(MISSION_SONGS[id], id);
    for (const n of p.notes) {
      expect(n.rows).toBeGreaterThanOrEqual(1);
      expect(n.vel > 0 && n.vel <= 1).toBe(true);
      if (!n.drum) expect(n.midi >= 24 && n.midi <= 96, `${id} note ${n.midi}`).toBe(true);
    }
    const used = new Set(p.notes.map((n) => n.ch));
    expect(used.size).toBe(p.channels.length);
  });

  it.each(IDS)('%s schedules finite notes across the loop seam (no NaN)', (id) => {
    const p = parseSong(MISSION_SONGS[id], id);
    const pass = songLength(p);
    const ev = songEvents(p, 0, pass + 4);
    expect(ev.length).toBeGreaterThan(50);
    for (const e of ev) {
      expect(Number.isFinite(e.time) && Number.isFinite(e.dur) && e.dur > 0).toBe(true);
      if (!e.drum) expect(Number.isFinite(midiToFreq(e.midi))).toBe(true);
    }
    if (p.loopRow === null) {
      expect(ev.every((e) => e.time < pass)).toBe(true);
    } else {
      // The loop restarts on its first row exactly at the end of the pass: same notes, same order.
      const loopT = p.loopRow * p.rowDur;
      const firstPass = songEvents(p, loopT, loopT + 2).map((e) => `${e.ch}:${e.midi}:${e.drum ?? ''}:${(e.time - loopT).toFixed(4)}`);
      const afterSeam = songEvents(p, pass, pass + 2).map((e) => `${e.ch}:${e.midi}:${e.drum ?? ''}:${(e.time - pass).toFixed(4)}`);
      expect(afterSeam).toEqual(firstPass);
      expect(afterSeam.some((s) => s.endsWith(':0.0000'))).toBe(true);
    }
  });
});

describe('leitmotifs', () => {
  it("the anthem's 7th melody note is one semitone flat, and the saw doubles it an octave down", () => {
    const melody = lineOf('anthem', 0);
    const inTune = parseSong({ bpm: 84, order: ['A'], channels: [{ inst: 'pulse50', patterns: { A: anthemLine({ inTune: true }) } }] }, 'in-tune').notes.map((n) => n.midi);
    expect(melody.length).toBe(inTune.length);
    melody.forEach((m, i) => expect(m, `note ${i + 1}`).toBe(i === 6 ? inTune[i] - 1 : inTune[i]));
    expect(melody[6]).toBe((noteToMidi('D5') ?? 0) - 1);
    expect(lineOf('anthem', 1)).toEqual(melody.map((m) => m - 12));
  });

  it('the Cygnet hook (its intervals) is in the select theme', () => {
    const hook = intervals(parseSong({ bpm: 120, order: ['A'], channels: [{ inst: 'pulse25', patterns: { A: CYGNET_HOOK } }] }, 'hook').notes.map((n) => n.midi));
    const lead = intervals(lineOf('select', 0)).join(',');
    expect(hook.length).toBeGreaterThanOrEqual(5);
    expect(lead.includes(hook.join(','))).toBe(true);
  });

  it('the hook in select (bars 9–12) is answered by a busy bass: a note on every 16th', () => {
    const p = parseSong(MISSION_SONGS.select, 'select');
    const rows = new Set(p.notes.filter((n) => n.ch === 2).map((n) => n.row));
    for (let r = 8 * 16; r < 12 * 16; r++) expect(rows.has(r), `bass row ${r}`).toBe(true);
  });
});

// ------------------------------------------------------------------ Web Audio render (Chromium)

/** Songs of music/index.ts rendered next to ours to keep the levels in one family. */
const REFERENCE = ['title', 'm0', 'boss'];

interface Render {
  pass: number;
  loopAt: number | null;
  peak: number;
  finite: boolean;
  /** RMS per 20 ms window. */
  env: number[];
}

const ENTRY = `
import { renderSongOffline } from ${JSON.stringify(fileURLToPath(new URL('../../src/engine/audio.browser.ts', import.meta.url)))};
import { getSong, songLength } from ${JSON.stringify(fileURLToPath(new URL('../../src/engine/music.ts', import.meta.url)))};
import ${JSON.stringify(fileURLToPath(new URL('../../src/game/content/music/index.ts', import.meta.url)))};
import ${JSON.stringify(fileURLToPath(new URL('../../src/game/content/music/missions.ts', import.meta.url)))};

window.MusicMissionsTest = {
  async render(id, extra, cap) {
    const s = getSong(id);
    if (!s) return null;
    const pass = songLength(s);
    const buf = await renderSongOffline(id, Math.min(cap, pass + extra));
    const a = buf.getChannelData(0);
    const b = buf.getChannelData(1);
    const win = Math.round(buf.sampleRate * 0.02);
    const env = [];
    let peak = 0;
    let finite = true;
    for (let w = 0; w < a.length; w += win) {
      let sq = 0;
      const end = Math.min(a.length, w + win);
      for (let i = w; i < end; i++) {
        const x = a[i];
        const y = b[i];
        if (!Number.isFinite(x) || !Number.isFinite(y)) finite = false;
        peak = Math.max(peak, Math.abs(x), Math.abs(y));
        sq += x * x + y * y;
      }
      env.push(Math.sqrt(sq / (2 * (end - w))));
    }
    return { pass, loopAt: s.loopRow === null ? null : s.loopRow * s.rowDur, peak, finite, env };
  },
};
`;

let browser: Browser | null = null;
let page: Page | null = null;
const pageErrors: string[] = [];
const renders = new Map<string, Render>();

async function bundle(): Promise<string> {
  const VIRTUAL = '\0music-missions-test-entry';
  const out = await build({
    configFile: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'music-missions-test-entry',
        // 'pre' + endsWith: Vite resolves a lib entry against the root before plugins see it.
        enforce: 'pre' as const,
        resolveId: (id: string) => (id.endsWith('music-missions-test-entry') ? VIRTUAL : null),
        load: (id: string) => (id === VIRTUAL ? ENTRY : null),
      },
    ],
    build: { write: false, minify: false, lib: { entry: 'music-missions-test-entry', name: 'MusicMissionsTestBundle', formats: ['iife'], fileName: 'music-missions-test' } },
  });
  for (const o of Array.isArray(out) ? out : [out]) {
    if ('output' in o) {
      const chunk = o.output.find((c) => c.type === 'chunk');
      if (chunk && chunk.type === 'chunk') return chunk.code;
    }
  }
  throw new Error('vite produced no chunk');
}

beforeAll(async () => {
  // A bundling error fails the tests; only a browser that cannot start skips them.
  const code = await bundle();
  try {
    browser = await chromium.launch();
    page = await browser.newPage();
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') pageErrors.push(m.text());
    });
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ content: code });
  } catch (err) {
    console.warn('[music-missions.test] Web Audio checks skipped: cannot run Chromium —', err);
    await browser?.close();
    browser = null;
    page = null;
    return;
  }
  // Our songs: one full pass plus 2 s past the seam. Reference songs: the first 30 s.
  for (const id of [...IDS, ...REFERENCE]) {
    const mine = IDS.includes(id);
    const r = await page.evaluate(
      ([s, extra, cap]) =>
        (window as unknown as { MusicMissionsTest: { render(id: string, extra: number, cap: number): Promise<Render | null> } }).MusicMissionsTest.render(s, extra, cap),
      [id, mine ? 2 : 0, mine ? 1000 : 30] as const,
    );
    if (r) renders.set(id, r);
  }
}, 240_000);

afterAll(async () => {
  await browser?.close();
});

/** RMS in dB of the 20 ms windows in [t0, t1). */
function rmsDb(r: Render, t0: number, t1: number): number {
  const i0 = Math.max(0, Math.floor(t0 / 0.02));
  const i1 = Math.min(r.env.length, Math.ceil(t1 / 0.02));
  let sq = 0;
  for (let i = i0; i < i1; i++) sq += r.env[i] * r.env[i];
  return 10 * Math.log10(sq / Math.max(1, i1 - i0) + 1e-12);
}

describe('mission and menu songs through Web Audio (headless Chromium)', () => {
  // A plain loop, not it.each: it.each does not pass the test context (ctx.skip).
  for (const id of IDS) it(`${id} renders: finite, below the peak ceiling, a sane level`, (ctx) => {
    if (!page) return ctx.skip();
    const r = renders.get(id);
    expect(r, `${id} rendered`).toBeDefined();
    if (!r) return;
    expect(r.finite).toBe(true);
    expect(r.peak, `${id} peak`).toBeLessThan(0.9);
    expect(r.peak, `${id} peak`).toBeGreaterThan(0.2);
    const level = rmsDb(r, 0, Math.min(r.pass, 60));
    expect(level, `${id} rms`).toBeGreaterThan(-27);
    expect(level, `${id} rms`).toBeLessThan(-16);
  });

  for (const id of IDS.filter((i) => FORMS[i].loop !== null)) it(`${id} loops without a gap or a jump in level`, (ctx) => {
    if (!page) return ctx.skip();
    const r = renders.get(id);
    if (!r || r.loopAt === null) throw new Error(`${id}: no render or no loop`);
    // Right after the seam it sounds like the loop start did in the first pass.
    expect(Math.abs(rmsDb(r, r.pass, r.pass + 1) - rmsDb(r, r.loopAt, r.loopAt + 1))).toBeLessThan(4);
    // No silent 20 ms window around the seam.
    for (let t = r.pass - 0.3; t < r.pass + 0.3; t += 0.02) expect(rmsDb(r, t, t + 0.02), `${id} at ${t.toFixed(2)} s`).toBeGreaterThan(-50);
  });

  it('levels stay in one family with the songs of music/index.ts (within 6 dB)', (ctx) => {
    if (!page) return ctx.skip();
    const levels = [...IDS, ...REFERENCE].map((id) => {
      const r = renders.get(id);
      if (!r) throw new Error(`${id}: no render`);
      return rmsDb(r, 0, Math.min(r.pass, 30));
    });
    expect(Math.max(...levels) - Math.min(...levels)).toBeLessThan(6);
  });

  it('the page logged no errors', (ctx) => {
    if (!page) return ctx.skip();
    expect(pageErrors).toEqual([]);
  });
});
