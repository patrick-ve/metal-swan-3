/**
 * The race's sound in headless Chromium (SFX, wave C; the Playwright pattern of
 * tests/media/audio-optins-browser.test.ts): the parametric engine voices of the estates and the
 * teams rendered offline (`renderEngineOffline`) and measured as the ear hears them (K-weighted
 * momentary maximum, LUFS, both channels), then checked against the radio (docs/api/rally.md "C.S"
 * "The mix"): a DJ line ships at −15 LUFS (audio:process) on the voice bus (volume 1), a song at
 * −16 LUFS on the music bus (volume 0.6); the engines go through the sfx bus (volume 0.8) at
 * `MIX.player` / `MIX.rival`. The engines must sit well under the DJ and stay audible.
 * Set SOUND_PRINT=1 to print the numbers.
 */
import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'playwright';
import { chromium } from 'playwright';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CAR_ENGINES, engineRpm, ESTATE_ENGINE, MIX, type EngineVoiceSpec } from '../../../src/game/rally/sound';

const RATE = 44100;
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
/** The output's default volumes (audio.browser.ts `vols`) and the shipped loudness of a DJ line and a song. */
const SFX_VOL = 0.8;
const MUSIC_VOL = 0.6;
const DJ_LUFS = -15;
const SONG_LUFS = -16;

const ENTRY = `
import { renderEngineOffline } from '${ROOT}src/engine/audio.browser.ts';

function biquad(b0, b1, b2, a1, a2) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x) => { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
}
/** BS.1770 K-weighting of one channel. */
function kWeight(d, fs) {
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
  const w = new Float64Array(d.length);
  for (let i = 0; i < d.length; i++) w[i] = rlb(shelf(d[i]));
  return w;
}
/** The momentary maximum (400 ms windows, 50 ms hop) over both channels, skipping the first 0.5 s (the voice settles). */
function lufs(buf) {
  const fs = buf.sampleRate;
  const ws = [];
  for (let c = 0; c < buf.numberOfChannels; c++) ws.push(kWeight(buf.getChannelData(c), fs));
  const win = Math.round(0.4 * fs), hop = Math.round(0.05 * fs);
  let best = -Infinity;
  for (let at = Math.round(0.5 * fs); at + win <= buf.length; at += hop) {
    let sum = 0;
    for (const w of ws) for (let i = at; i < at + win; i++) sum += w[i] * w[i];
    if (sum > 0) best = Math.max(best, -0.691 + 10 * Math.log10(sum / win));
  }
  let peak = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i])); }
  return { lufs: best, peak };
}

window.SoundTest = {
  async measure(cases, rate) {
    const out = {};
    for (const [name, o] of Object.entries(cases)) out[name] = lufs(await renderEngineOffline([{ at: 0, o }], 1.5, rate));
    return out;
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
        name: 'sound-test-entry',
        enforce: 'pre' as const,
        resolveId: (id: string) => (id.endsWith('sound-test-entry') ? '\0sound-test-entry' : null),
        load: (id: string) => (id === '\0sound-test-entry' ? ENTRY : null),
      },
    ],
    build: { write: false, minify: false, lib: { entry: 'sound-test-entry', name: 'SoundTest', formats: ['iife'], fileName: 'sound-test' } },
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
  const code = await bundle();
  try {
    browser = await chromium.launch();
    page = await browser.newPage();
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ content: code });
  } catch (err) {
    console.warn('[sound-browser.test] skipped: cannot run Chromium —', err);
    await browser?.close();
    browser = null;
    page = null;
  }
}, 120_000);

afterAll(async () => {
  await browser?.close();
});

/** The engine opts of a voice at an engine state (vol 1: the mix gain is applied in dB here). */
function opts(v: EngineVoiceSpec, rev: number, speed: number, gas: number): Record<string, number> {
  return { rpm: engineRpm(rev, speed, gas, v), load: speed > 1 ? 0.15 + 0.85 * gas : gas, cyl: v.cyl, pitch: v.pitch, turbo: v.turbo, rough: v.rough, bright: v.bright, vol: 1 };
}

const db = (g: number): number => 20 * Math.log10(g);

describe('the engines against the radio (offline render, K-weighted)', () => {
  it('a player’s estate sits under the DJ and the song, audible at idle; the rivals no louder', async (ctx) => {
    if (!page) return ctx.skip();
    const cases: Record<string, Record<string, number>> = {
      idle: opts(ESTATE_ENGINE, 0.25, 0, 0),
      grid: opts(ESTATE_ENGINE, 0.35, 0, 1),
      cruise: opts(ESTATE_ENGINE, 0.6, 40, 0.5),
      full: opts(ESTATE_ENGINE, 1, 46, 1),
    };
    for (const [id, v] of Object.entries(CAR_ENGINES)) if (v !== ESTATE_ENGINE) cases[id] = opts(v, 1, 46, 1);
    const r = await page.evaluate(([c, rate]) => (window as unknown as { SoundTest: { measure(c: unknown, r: number): Promise<Record<string, { lufs: number; peak: number }>> } }).SoundTest.measure(c, rate as number), [cases, RATE] as const);
    const player = db(MIX.player * SFX_VOL);
    const rival = db(MIX.rival * SFX_VOL);
    const at = (name: string, gain: number): number => r[name].lufs + gain;
    if (process.env.SOUND_PRINT) {
      for (const [k, v] of Object.entries(r)) console.info(`${k.padEnd(14)} raw ${v.lufs.toFixed(1)} LUFS peak ${v.peak.toFixed(2)} → in the mix ${at(k, k in CAR_ENGINES ? rival : player).toFixed(1)} LUFS`);
      console.info(`DJ ${DJ_LUFS} LUFS, song ${(SONG_LUFS + db(MUSIC_VOL)).toFixed(1)} LUFS (ducked under the DJ ${(SONG_LUFS + db(MUSIC_VOL * 0.4)).toFixed(1)})`);
    }
    for (const v of Object.values(r)) {
      expect(Number.isFinite(v.lufs)).toBe(true);
      expect(v.peak).toBeLessThan(1);
    }
    // Louder with revs and load.
    expect(r.full.lufs).toBeGreaterThan(r.idle.lufs + 3);
    expect(r.grid.lufs).toBeGreaterThan(r.idle.lufs);
    // The DJ stays clear: the estate at full load ≥ 7 LU under a DJ line (≥ 10 with the duck), under the song.
    expect(at('full', player)).toBeLessThanOrEqual(DJ_LUFS - 7);
    expect(at('full', player + db(MIX.djDuck))).toBeLessThanOrEqual(DJ_LUFS - 10);
    expect(at('cruise', player)).toBeLessThanOrEqual(SONG_LUFS + db(MUSIC_VOL));
    // 2P: both estates at full load together (+3 dB) still ≥ 7 LU under the DJ.
    expect(at('full', db(MIX.player2p * SFX_VOL)) + 3).toBeLessThanOrEqual(DJ_LUFS - 7);
    // Audible: the idle is not buried (above −40 LUFS in the mix).
    expect(at('idle', player)).toBeGreaterThan(-40);
    // A rival at its loudest (within the reference distance) is no louder than the estate's full load + 2 LU.
    for (const id of Object.keys(CAR_ENGINES)) if (id !== 'white' && id !== 'green') expect(at(id, rival), id).toBeLessThanOrEqual(at('full', player) + 2);
    expect(pageErrors).toEqual([]);
  });
});
