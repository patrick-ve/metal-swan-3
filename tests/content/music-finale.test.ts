/**
 * Songs of the last mission and the finale (src/game/content/music/finale.ts, GDD §12.2):
 * - every id of GDD §15.8 this module owns registers and parses without errors;
 * - tempo, length in bars and the loop bar are the GDD's numbers;
 * - the leitmotifs are where the GDD puts them (the Cygnet hook's shape in m5-sky, ending and
 *   credits; the anthem with its one wrong note in boss-final and as the ending's bell line);
 * - `boss-final-fast` is its own song, not boss-final played faster;
 * - rendered through the real Web Audio graph (headless Chromium), every song is finite, sits in
 *   the loudness family of the other songs and stays below the peak ceiling. This part skips with
 *   a warning when Chromium cannot start.
 */
import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'playwright';
import { chromium } from 'playwright';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getSong, hasSong, noteToMidi, parseSong, patternRows, songError, songLength } from '../../src/engine/music';
import type { ParsedSong, SongDef } from '../../src/engine/music';
import { hasSfx } from '../../src/engine/synth';
import { FINALE_SONGS } from '../../src/game/content/music/finale';
import { anthemLine, CYGNET_HOOK } from '../../src/game/content/music/index';

/** GDD §12.2: bpm, bars of one pass of the order, the bar the loop returns to (null = once). */
const SPEC: Readonly<Record<string, { bpm: number; bars: number; loopBar: number | null }>> = {
  'm5-sky': { bpm: 160, bars: 8 + 16 + 16 + 8, loopBar: 8 },
  'm5-organ': { bpm: 108, bars: 16 + 16, loopBar: 0 },
  'mini-boss': { bpm: 150, bars: 16, loopBar: 0 },
  'boss-final': { bpm: 168, bars: 8 + 16 + 16 + 16, loopBar: 8 },
  'boss-final-fast': { bpm: 200, bars: 16, loopBar: 0 },
  ending: { bpm: 116, bars: 32, loopBar: null },
  credits: { bpm: 100, bars: 32, loopBar: 0 },
};
const IDS = Object.keys(SPEC);

const parsed = (id: string): ParsedSong => parseSong(FINALE_SONGS[id], id);
const rowsPerBar = (p: ParsedSong): number => p.rowsPerBeat * 4;

/** Rows of one order slot ('C+2' → pattern 'C'). */
function slotRows(def: SongDef, slot: string): number {
  const name = slot.replace(/[+-]\d+$/, '');
  const pat = def.channels.map((c) => c.patterns[name]).find((p) => p !== undefined);
  return pat === undefined ? 0 : patternRows(pat).length;
}

/** MIDI notes of a melodic pattern in order (the first note of a chord). */
function melody(pattern: string): number[] {
  return patternRows(pattern)
    .filter((t) => t !== '.' && t !== '-')
    .map((t) => noteToMidi(t.split('+')[0].replace(/^~/, '').replace(/(!|:[1-9])$/, '')) ?? -1);
}

/** Successive intervals in semitones. */
const intervals = (notes: readonly number[]): number[] => notes.slice(1).map((n, i) => n - notes[i]);

/** The Cygnet hook's interval shape (a wide leap up, a dotted walk down). */
const HOOK_SHAPE = intervals(melody(CYGNET_HOOK));

/** A channel's pattern by its instrument object and slot name (first match). */
function patternOf(id: string, slot: string, pick: (ch: SongDef['channels'][number]) => boolean): string {
  const ch = FINALE_SONGS[id].channels.find((c) => pick(c) && c.patterns[slot] !== undefined);
  if (!ch) throw new Error(`${id}: no channel plays "${slot}"`);
  return ch.patterns[slot];
}

describe('finale songs: registry and structure', () => {
  it('this module defines exactly its GDD §15.8 ids', () => {
    expect(Object.keys(FINALE_SONGS).sort()).toEqual([...IDS].sort());
  });

  it.each(IDS)('%s registers and parses without errors', (id) => {
    expect(hasSong(id)).toBe(true);
    expect(songError(id)).toBeNull();
    expect(getSong(id)).not.toBeNull();
    const p = parsed(id);
    expect(p.notes.length).toBeGreaterThan(300);
    for (const n of p.notes) {
      if (n.drum) expect(hasSfx(n.drum), `${id}: drum ${n.drum}`).toBe(true);
      else expect(n.midi >= 24 && n.midi <= 96, `${id}: note ${n.midi} at row ${n.row}`).toBe(true);
    }
    for (const c of p.channels) expect(c.vol).toBeLessThanOrEqual(1.5);
    expect(p.vol).toBeLessThanOrEqual(1);
  });

  it.each(IDS)('%s has the GDD tempo, length and loop bar', (id) => {
    const p = parsed(id);
    const spec = SPEC[id];
    expect(p.bpm).toBe(spec.bpm);
    expect(p.totalRows % rowsPerBar(p)).toBe(0);
    expect(p.totalRows / rowsPerBar(p)).toBe(spec.bars);
    expect(p.loopRow === null ? null : p.loopRow / rowsPerBar(p)).toBe(spec.loopBar);
  });

  it('sections have the GDD lengths in bars', () => {
    const bars = (id: string): number[] => {
      const def = FINALE_SONGS[id];
      const per = (def.rowsPerBeat ?? 4) * 4;
      return def.order.map((s) => slotRows(def, s) / per);
    };
    expect(bars('m5-sky')).toEqual([8, 16, 16, 8]);
    expect(FINALE_SONGS['m5-sky'].order[3]).toBe('C+2'); // C: a whole step up
    expect(bars('m5-organ')).toEqual([16, 16]);
    expect(bars('boss-final')).toEqual([8, 16, 16, 16]);
    expect(bars('boss-final-fast')).toEqual([8, 8]);
    expect(bars('mini-boss').reduce((a, b) => a + b, 0)).toBe(16);
    expect(bars('ending').reduce((a, b) => a + b, 0)).toBe(32);
    expect(bars('credits').reduce((a, b) => a + b, 0)).toBe(32);
  });

  it('loop lengths suit the scenes (m5-sky ≈ 1 min, boss loops 15–75 s, ending plays once ≈ 1 min)', () => {
    const body = (id: string): number => {
      const p = parsed(id);
      return (p.totalRows - (p.loopRow ?? 0)) * p.rowDur;
    };
    expect(body('m5-sky')).toBeCloseTo(60, 0);
    expect(body('boss-final')).toBeGreaterThan(15);
    expect(body('boss-final')).toBeLessThan(75);
    expect(body('boss-final-fast')).toBeGreaterThan(15);
    expect(body('mini-boss')).toBeGreaterThan(15);
    // The parade runs 900 ticks + captions; the ending song plays once and hands over to credits.
    expect(songLength(parsed('ending'))).toBeGreaterThan(55);
    expect(songLength(parsed('ending'))).toBeLessThan(75);
  });

  it('boss-final-fast is its own song, not boss-final played faster', () => {
    const slow = new Set(FINALE_SONGS['boss-final'].channels.flatMap((c) => Object.values(c.patterns)));
    const fast = FINALE_SONGS['boss-final-fast'].channels.flatMap((c) => Object.values(c.patterns));
    expect(fast.filter((p) => slow.has(p))).toEqual([]);
    expect(FINALE_SONGS['boss-final-fast'].order).toEqual(['A', 'B']);
  });
});

describe('finale songs: leitmotifs', () => {
  it('the Cygnet hook keeps its shape in m5-sky (F major), the ending (D major) and the credits (G major)', () => {
    const lead = (id: string, slot: string): string => FINALE_SONGS[id].channels[0].patterns[slot];
    for (const [id, slot, tonicNote] of [
      ['m5-sky', 'A', 'F#4'],
      ['ending', 'A', 'F#4'],
      ['credits', 'A', 'B3'],
    ] as const) {
      const notes = melody(lead(id, slot));
      expect(intervals(notes.slice(0, HOOK_SHAPE.length + 1)), `${id} ${slot}`).toEqual(HOOK_SHAPE);
      // m5-sky's hook is the D-major hook a minor third up (F major); the others start as written.
      const start = noteToMidi(tonicNote) as number;
      expect(notes[0], id).toBe(id === 'm5-sky' ? start + 3 : start);
    }
  });

  it('boss-final quotes the anthem in C minor with its 7th note a semitone flat', () => {
    const quote = melody(patternOf('boss-final', 'C', (c) => typeof c.inst === 'object' && c.inst.kind === 'pulse' && c.inst.duty === 0.5));
    const inTune = melody(anthemLine({ transpose: 2, minor: true, inTune: true }));
    expect(quote.length).toBe(inTune.length);
    const diffs = quote.map((n, i) => n - inTune[i]);
    expect(diffs.filter((d) => d !== 0)).toEqual([-1]);
    expect(diffs[6]).toBe(-1);
  });

  it('the ending carries the anthem as a bell counter-line: in tune except its one wrong note', () => {
    const bell = melody(patternOf('ending', 'G', (c) => c.inst === 'bell'));
    const inTune = melody(anthemLine({ transpose: 4, inTune: true }));
    const diffs = bell.map((n, i) => n - inTune[i]);
    expect(diffs.filter((d) => d !== 0)).toEqual([-1]);
    expect(diffs[6]).toBe(-1);
  });

  it('the ending resolves on D (the hook finally lands on the tonic), then one late triangle note', () => {
    const p = parsed('ending');
    const melodic = p.notes.filter((n) => !n.drum);
    const last = melodic[melodic.length - 1];
    const lead = p.notes.filter((n) => n.ch === 0);
    expect(lead[lead.length - 1].midi % 12).toBe(2); // D
    // Fanfaroni's one note comes after the final chord, on its own.
    const finalChordRow = Math.max(...p.notes.filter((n) => n.ch === 0).map((n) => n.row));
    expect(last.row).toBeGreaterThan(finalChordRow);
    expect(melodic.filter((n) => n.row === last.row)).toHaveLength(1);
  });
});

// -------------------------------------------------------------------------------------------
// Rendered through Web Audio (headless Chromium)
// -------------------------------------------------------------------------------------------

/** Sample rate of the check renders (low keeps the test fast; levels match 44.1 kHz closely). */
const RATE = 16000;
/** Peak ceiling of a full mix before the master compressor (the other songs peak 0.45–0.71). */
const PEAK_CEILING = 0.85;

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ENTRY = `
import { renderSongOffline } from '${ROOT}src/engine/audio.browser.ts';
import { getSong, songLength } from '${ROOT}src/engine/music.ts';
import '${ROOT}src/game/content/music/finale.ts';
window.FinaleTest = {
  async render(id, rate) {
    const song = getSong(id);
    if (!song) return null;
    const secs = songLength(song) + (song.loopRow === null ? 2 : 0);
    const buf = await renderSongOffline(id, secs, rate);
    let peak = 0, sq = 0, finite = true;
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < d.length; i++) {
        const a = d[i];
        if (!Number.isFinite(a)) finite = false;
        const m = Math.abs(a);
        if (m > peak) peak = m;
        sq += a * a;
      }
    }
    return { secs, peak, finite, rms: Math.sqrt(sq / (buf.length * buf.numberOfChannels)) };
  },
};
`;

let browser: Browser | null = null;
let page: Page | null = null;
const pageErrors: string[] = [];

async function bundle(): Promise<string> {
  const out = await build({
    configFile: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'finale-test-entry',
        enforce: 'pre' as const,
        resolveId: (id: string) => (id.endsWith('finale-test-entry') ? '\0finale-test-entry' : null),
        load: (id: string) => (id === '\0finale-test-entry' ? ENTRY : null),
      },
    ],
    build: { write: false, minify: false, lib: { entry: 'finale-test-entry', name: 'FinaleTest', formats: ['iife'], fileName: 'finale-test' } },
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
    console.warn('[music-finale.test] render checks skipped: cannot run Chromium —', err);
    await browser?.close();
    browser = null;
    page = null;
  }
}, 120_000);

afterAll(async () => {
  await browser?.close();
});

describe('finale songs: rendered mix', () => {
  for (const id of IDS) it(`${id} renders finite, in the loudness family and below the peak ceiling`, async (ctx) => {
    if (!page) return ctx.skip();
    type R = { secs: number; peak: number; finite: boolean; rms: number } | null;
    const r = await page.evaluate(
      ([i, rate]) => (window as unknown as { FinaleTest: { render(id: string, rate: number): Promise<R> } }).FinaleTest.render(i, rate),
      [id, RATE] as [string, number],
    );
    expect(r).not.toBeNull();
    if (!r) return;
    const rmsDb = 20 * Math.log10(r.rms || 1e-9);
    expect(r.finite, `${id}: NaN or Infinity in the mix`).toBe(true);
    expect(r.peak, `${id} peak`).toBeLessThan(PEAK_CEILING);
    expect(r.peak, `${id} peak`).toBeGreaterThan(0.2);
    // The other songs sit at −23 … −20 dB RMS; a song may be a little hotter or quieter.
    expect(rmsDb, `${id} RMS`).toBeGreaterThan(-24);
    expect(rmsDb, `${id} RMS`).toBeLessThan(-18);
    expect(pageErrors).toEqual([]);
  });
});
