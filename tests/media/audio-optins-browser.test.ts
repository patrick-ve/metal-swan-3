/**
 * Rally wave C (PREP): the new Web Audio nodes in headless Chromium (the Playwright pattern of
 * tests/content/music-finale.test.ts). Offline renders measure the engine voice (its firing
 * frequency, load, pan) and the car radio's chain (the speaker band-pass, the tunnel muffle, the
 * signal and the static); a live WebAudioOut (autoplay allowed) plays a STREAMED song once to its
 * end (the song-end event and the song state), falls back to the synth when a stream is missing,
 * keeps at most four engine voices, pans a loop and clears it all on stopAll.
 */
import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'playwright';
import { chromium } from 'playwright';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const RATE = 22050;
const ORIGIN = 'http://ms3-audio.test';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const ENTRY = `
import { WebAudioOut, unlock, renderEngineOffline, renderRadioOffline } from '${ROOT}src/engine/audio.browser.ts';
import { defineSampleGroup } from '${ROOT}src/engine/samples.ts';
import { defineSong } from '${ROOT}src/engine/music.ts';
import { defineSfx } from '${ROOT}src/engine/synth.ts';

/** Goertzel magnitude of channel c at frequency f (normalised by the length). */
function tone(buf, f, c = 0) {
  const d = buf.getChannelData(c);
  const w = (2 * Math.PI * f) / buf.sampleRate;
  const k = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  const from = Math.floor(d.length / 4);
  for (let i = from; i < d.length; i++) { const s0 = d[i] + k * s1 - s2; s2 = s1; s1 = s0; }
  const n = d.length - from;
  return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - k * s1 * s2)) / n;
}
function rms(buf, c = 0) {
  const d = buf.getChannelData(c);
  let sq = 0, finite = true;
  const from = Math.floor(d.length / 4);
  for (let i = from; i < d.length; i++) { if (!Number.isFinite(d[i])) finite = false; sq += d[i] * d[i]; }
  return finite ? Math.sqrt(sq / (d.length - from)) : NaN;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms) { const t0 = performance.now(); while (!fn() && performance.now() - t0 < ms) await sleep(20); return fn(); }

window.OptinTest = {
  async engine(rate) {
    const e = async (o) => renderEngineOffline([{ at: 0, o }], 1, rate);
    const a = await e({ rpm: 3000, load: 0.5, rough: 0 });
    const b = await e({ rpm: 6000, load: 0.5, rough: 0 });
    const idle = await e({ rpm: 3000, load: 0, rough: 0 });
    const full = await e({ rpm: 3000, load: 1, rough: 0 });
    const left = await e({ rpm: 3000, load: 0.5, pan: -1, rough: 0 });
    // A step: 3000 rpm, then 6000 from 0.5 s (the glide follows).
    const step = await renderEngineOffline([{ at: 0, o: { rpm: 3000, load: 0.5, rough: 0 } }, { at: 0.3, o: { rpm: 6000, load: 0.5, rough: 0 } }], 1, rate);
    return {
      a100: tone(a, 100), a137: tone(a, 137), a200: tone(a, 200),
      b200: tone(b, 200), b100: tone(b, 100), b273: tone(b, 273),
      step200: tone(step, 200), step100: tone(step, 100),
      idle: rms(idle), full: rms(full),
      leftL: rms(left, 0), leftR: rms(left, 1), centreL: rms(a, 0), centreR: rms(a, 1),
    };
  },
  async radio(rate) {
    const r = async (o, input) => renderRadioOffline(o, 1, rate, input);
    const flat = await r(null, 'tones');
    const speaker = await r({ speaker: 1 }, 'tones');
    const tunnel = await r({ speaker: 0, muffle: 1 }, 'tones');
    const dead = await r({ speaker: 0, signal: 0 }, 'tones');
    const hiss = await r({ speaker: 1, signal: 0, static: 1 });
    const quiet = await r({ speaker: 1, static: 1 }, 'silence');
    const m = (b) => ({ lo: tone(b, 60), mid: tone(b, 1000), hi: tone(b, 8000), rms: rms(b) });
    return { flat: m(flat), speaker: m(speaker), tunnel: m(tunnel), dead: m(dead), hiss: m(hiss), quiet: m(quiet) };
  },
  async live() {
    const out = new WebAudioOut({ autoUnlock: false, autoSuspend: false, speech: false });
    const ctx = await unlock();
    if (!ctx || ctx.state !== 'running') return { skip: 'no running AudioContext: ' + (ctx ? ctx.state : 'none') };
    defineSong('t-fallback', { bpm: 120, order: ['A'], loop: 0, channels: [{ inst: 'bass', patterns: { A: 'C2 . . . . . . . . . . . . . . .' } }] });
    defineSfx('t/loop', { layers: [{ wave: 'sine', freq: 330 }], length: 0.5, vol: 0.3 });
    defineSampleGroup('t-stream', {
      music: {
        't-song': { file: 'test/song.wav', loopStart: null, duration: 1.2, stream: true },
        't-fallback': { file: 'test/missing.wav', loopStart: 0, loopEnd: 1, duration: 1.2, stream: true },
      },
    });
    await out.loadSamples('t-stream');
    const res = { readyStream: out.samples.stream('t-song') !== null, decoded: out.samples.song('t-song') !== null };
    const ends = [];
    const off = out.onSongEnd((id) => ends.push(id));
    out.music('t-song', { once: true });
    res.source = out.songSource;
    await until(() => (out.songState()?.position ?? 0) > 0.3, 3000);
    const st = out.songState();
    res.mid = st ? { id: st.id, source: st.source, position: st.position, duration: st.duration, ended: st.ended } : null;
    await until(() => ends.length > 0, 5000);
    res.ends = ends.slice();
    res.endedState = out.songState()?.ended ?? null;
    off();
    out.music('t-fallback', { restart: true });
    await until(() => out.songSource === 'synth', 4000);
    res.fallback = out.songSource;
    res.fallbackState = out.samples.state('music', 't-fallback');
    for (let i = 0; i < 6; i++) out.engine('e' + i, { rpm: 1000 + 500 * i, load: i / 5, vol: 0.2 + i * 0.15 });
    res.engines = out.engineKeys.slice().sort();
    out.engine('e5', { rpm: 6000, load: 1, pan: -1 });
    out.stopEngine('e5');
    res.enginesAfterStop = out.engineKeys.length;
    out.setRadio({ speaker: 1, muffle: 1, signal: 0.1, static: 0.6 });
    out.sfxLoop('pan', 't/loop', { vol: 0.5, pan: 0 });
    out.sfxLoop('pan', 't/loop', { vol: 0.5, pan: 0.8 });
    out.sfxLoop('pan', 't/loop', { vol: 0.5, pan: -0.8 });
    await sleep(100);
    out.setRadio(null);
    out.stopAll();
    res.enginesAfterStopAll = out.engineKeys.length;
    res.songAfterStopAll = out.songState();
    return res;
  },
};
`;

/** A mono 16-bit WAV of `seconds` of a 440 Hz sine at `rate`. */
function wav(seconds: number, rate = 22050): Buffer {
  const n = Math.round(seconds * rate);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 8000), 44 + i * 2);
  return b;
}

let browser: Browser | null = null;
let page: Page | null = null;
const pageErrors: string[] = [];

async function bundle(): Promise<string> {
  const out = await build({
    configFile: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'optin-test-entry',
        enforce: 'pre' as const,
        resolveId: (id: string) => (id.endsWith('optin-test-entry') ? '\0optin-test-entry' : null),
        load: (id: string) => (id === '\0optin-test-entry' ? ENTRY : null),
      },
    ],
    build: { write: false, minify: false, lib: { entry: 'optin-test-entry', name: 'OptinTest', formats: ['iife'], fileName: 'optin-test' } },
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
    browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    page = await browser.newPage();
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    page.on('console', (m) => {
      // The missing stream's 404 is on purpose (the synth fallback).
      if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) pageErrors.push(m.text());
    });
    const song = wav(1.2);
    await page.route(`${ORIGIN}/**`, (route) => {
      const url = route.request().url();
      if (url.endsWith('/audio/test/song.wav')) return route.fulfill({ status: 200, contentType: 'audio/wav', body: song });
      if (url.includes('/audio/')) return route.fulfill({ status: 404, body: 'missing' });
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body></body></html>' });
    });
    await page.goto(`${ORIGIN}/index.html`);
    await page.addScriptTag({ content: code });
  } catch (err) {
    console.warn('[audio-optins-browser.test] skipped: cannot run Chromium —', err);
    await browser?.close();
    browser = null;
    page = null;
  }
}, 120_000);

afterAll(async () => {
  await browser?.close();
});

type T = Record<string, number>;
const call = <R>(p: Page, fn: string, ...args: unknown[]): Promise<R> =>
  p.evaluate(([f, a]) => (window as unknown as { OptinTest: Record<string, (...x: unknown[]) => Promise<unknown>> }).OptinTest[f as string](...(a as unknown[])), [fn, args] as [string, unknown[]]) as Promise<R>;

describe('the engine voice (offline render)', () => {
  it('sounds at its firing frequency, follows the rpm, gets louder with load and pans', async (ctx) => {
    if (!page) return ctx.skip();
    const r = await call<T>(page, 'engine', RATE);
    if (process.env.OPTIN_PRINT) console.info('engine', JSON.stringify(r));
    // 3000 rpm, 4 cylinders: 100 Hz (and its harmonics), not between them.
    expect(r.a100).toBeGreaterThan(r.a137 * 5);
    // 6000 rpm: 200 Hz; the half order (the rumble) at 100 Hz is weaker than the firing tone.
    expect(r.b200).toBeGreaterThan(r.b273 * 5);
    expect(r.b200).toBeGreaterThan(r.b100);
    // The step to 6000 rpm glides there.
    expect(r.step200).toBeGreaterThan(r.step100 * 0.5);
    expect(r.full).toBeGreaterThan(r.idle * 1.3);
    expect(Number.isFinite(r.full)).toBe(true);
    // Hard left: the right channel is near silent; the centre is balanced.
    expect(r.leftR).toBeLessThan(r.leftL * 0.05);
    expect(Math.abs(r.centreL - r.centreR)).toBeLessThan(r.centreL * 0.01);
    expect(pageErrors).toEqual([]);
  });
});

describe('the car radio chain (offline render)', () => {
  it('band-passes the speaker, muffles the tunnel, drops the signal and adds the static', async (ctx) => {
    if (!page) return ctx.skip();
    const r = await call<Record<string, T>>(page, 'radio', RATE);
    if (process.env.OPTIN_PRINT) console.info('radio', JSON.stringify(r));
    // The speaker: lows and highs well down, the middle kept.
    expect(r.speaker.hi).toBeLessThan(r.flat.hi * 0.4);
    expect(r.speaker.lo).toBeLessThan(r.flat.lo * 0.4);
    expect(r.speaker.mid).toBeGreaterThan(r.flat.mid * 0.6);
    // The tunnel: 1 kHz and up nearly gone.
    expect(r.tunnel.mid).toBeLessThan(r.flat.mid * 0.2);
    expect(r.tunnel.hi).toBeLessThan(r.flat.hi * 0.05);
    // No signal, no static: silence; the static alone hisses (also over a silent programme).
    expect(r.dead.rms).toBeLessThan(1e-4);
    expect(r.hiss.rms).toBeGreaterThan(0.01);
    expect(r.quiet.rms).toBeGreaterThan(0.01);
    expect(Number.isFinite(r.flat.rms)).toBe(true);
    expect(pageErrors).toEqual([]);
  });
});

describe('a live WebAudioOut: streams, the song-end event, engines, the radio, a panned loop', () => {
  it('streams a song once to its end, falls back to the synth, caps the engines, cleans up', async (ctx) => {
    if (!page) return ctx.skip();
    type Live = {
      skip?: string;
      readyStream: boolean;
      decoded: boolean;
      source: string;
      mid: { id: string; source: string; position: number; duration: number; ended: boolean } | null;
      ends: string[];
      endedState: boolean | null;
      fallback: string;
      fallbackState: string;
      engines: string[];
      enginesAfterStop: number;
      enginesAfterStopAll: number;
      songAfterStopAll: unknown;
    };
    const r = await call<Live>(page, 'live');
    if (process.env.OPTIN_PRINT) console.info('live', JSON.stringify(r));
    if (r.skip) {
      console.warn(`[audio-optins-browser.test] live part skipped: ${r.skip}`);
      return ctx.skip();
    }
    // The streamed song is 'ready' without a decode, and plays through the media element.
    expect(r.readyStream).toBe(true);
    expect(r.decoded).toBe(false);
    expect(r.source).toBe('stream');
    expect(r.mid?.id).toBe('t-song');
    expect(r.mid?.source).toBe('stream');
    expect(r.mid?.position).toBeGreaterThan(0.25);
    expect(r.mid?.duration).toBeCloseTo(1.2, 1);
    expect(r.mid?.ended).toBe(false);
    // Played once: the song-end event, the state says ended.
    expect(r.ends).toEqual(['t-song']);
    expect(r.endedState).toBe(true);
    // A missing stream: the synth takes over and the stream is marked failed.
    expect(r.fallback).toBe('synth');
    expect(r.fallbackState).toBe('failed');
    // Six engines asked, four sound (the two loudest replaced the quietest ones).
    expect(r.engines).toEqual(['e2', 'e3', 'e4', 'e5']);
    expect(r.enginesAfterStop).toBe(3);
    expect(r.enginesAfterStopAll).toBe(0);
    expect(r.songAfterStopAll).toBeNull();
    // The missing file's warning is expected (console.warn); no errors.
    expect(pageErrors).toEqual([]);
  });
});
