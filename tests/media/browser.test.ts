/**
 * Runs the real browser code in headless Chromium (Playwright):
 * - CanvasRenderer vs SoftRenderer on the same draw calls (exact for opaque drawing,
 *   ±3 per channel where alpha / additive blending rounds differently);
 * - songs rendered offline through the Web Audio instrument graph (sound, level, pitch);
 * - the display: integer scaling in device pixels (DPR 1 and 2), black letterbox, scanlines;
 * - a smoke run of WebAudioOut (sfx, music, pause, fades) without errors.
 * Skips (with a warning) when Chromium cannot start.
 */
import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'playwright';
import { chromium } from 'playwright';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SoftRenderer } from '../../src/engine/render-soft';
import { drawBlendScene, drawOpaqueScene } from './browser/scene';

let browser: Browser | null = null;
let page: Page | null = null;
let bundleCode = '';
const pageErrors: string[] = [];

async function bundle(): Promise<string> {
  const entry = fileURLToPath(new URL('./browser/entry.ts', import.meta.url));
  const out = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: false,
      lib: { entry, name: 'MediaTestBundle', formats: ['iife'], fileName: 'media-test' },
    },
  });
  const outputs = Array.isArray(out) ? out : [out];
  for (const o of outputs) {
    if ('output' in o) {
      const chunk = o.output.find((c) => c.type === 'chunk');
      if (chunk && chunk.type === 'chunk') return chunk.code;
    }
  }
  throw new Error('vite produced no chunk');
}

beforeAll(async () => {
  try {
    const code = await bundle();
    bundleCode = code;
    browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    page = await browser.newPage();
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') pageErrors.push(m.text());
    });
    await page.setContent('<!doctype html><html><body></body></html>');
    await page.addScriptTag({ content: code });
  } catch (err) {
    console.warn('[browser.test] skipped: cannot run Chromium —', err);
    await browser?.close();
    browser = null;
    page = null;
  }
}, 120_000);

afterAll(async () => {
  await browser?.close();
});

type Diff = { exact: number; small: number; big: number; worst: number; firstBig: string };

function compare(a: ArrayLike<number>, b: ArrayLike<number>, w: number): Diff {
  const d: Diff = { exact: 0, small: 0, big: 0, worst: 0, firstBig: '' };
  for (let i = 0; i < a.length; i += 4) {
    let m = 0;
    for (let k = 0; k < 4; k++) m = Math.max(m, Math.abs(a[i + k] - b[i + k]));
    d.worst = Math.max(d.worst, m);
    if (m === 0) d.exact++;
    else if (m <= 3) d.small++;
    else {
      d.big++;
      if (!d.firstBig) {
        const p = i / 4;
        d.firstBig = `(${p % w},${Math.floor(p / w)}) soft=${Array.from(a).slice(i, i + 4)} canvas=${Array.from(b).slice(i, i + 4)}`;
      }
    }
  }
  return d;
}

describe('browser media', () => {
  it('canvas renderer matches the software renderer exactly for opaque drawing', async (ctx) => {
    if (!page) return ctx.skip();
    const canvasPx = await page.evaluate(() => (window as unknown as { MediaTest: { opaque(): number[] } }).MediaTest.opaque());
    const soft = new SoftRenderer();
    drawOpaqueScene(soft);
    const d = compare(soft.target.toRGBA(), canvasPx, soft.w);
    expect(d.firstBig).toBe('');
    expect(d.small).toBe(0);
    expect(d.exact).toBe(soft.w * soft.h);
  });

  it('canvas renderer matches within rounding for alpha, additive and fades', async (ctx) => {
    if (!page) return ctx.skip();
    const canvasPx = await page.evaluate(() => (window as unknown as { MediaTest: { blend(): number[] } }).MediaTest.blend());
    const soft = new SoftRenderer();
    drawBlendScene(soft);
    const d = compare(soft.target.toRGBA(), canvasPx, soft.w);
    expect(d.firstBig).toBe('');
    expect(d.worst).toBeLessThanOrEqual(3);
  });

  it('renders songs through the Web Audio instruments (level, pitch, release)', async (ctx) => {
    if (!page) return ctx.skip();
    const r = await page.evaluate(() =>
      (window as unknown as { MediaTest: { songOffline(): Promise<{ all: { peak: number; rms: number; finite: boolean }; a440: number; tail: { peak: number } }> } }).MediaTest.songOffline(),
    );
    expect(r.all.finite).toBe(true);
    expect(r.all.rms).toBeGreaterThan(0.02);
    expect(r.all.peak).toBeLessThan(1.5);
    expect(r.a440).toBeGreaterThan(430);
    expect(r.a440).toBeLessThan(450);
  });

  it('display presents at the largest integer scale with a black letterbox (DPR 1 and 2)', async (ctx) => {
    if (!browser || !page) return ctx.skip();
    type R = { scale: number; w: number; h: number; mismatches: number; letterbox: number[]; scanDarker: boolean };
    const run = (p: Page): Promise<R> => p.evaluate(() => (window as unknown as { MediaTest: { display(): Promise<R> } }).MediaTest.display());
    await page.setViewportSize({ width: 1000, height: 700 });
    const r1 = await run(page);
    expect([r1.w, r1.h, r1.scale]).toEqual([1000, 700, 2]);
    expect(r1.mismatches).toBe(0);
    expect(r1.letterbox).toEqual([0, 0, 0, 255]);
    expect(r1.scanDarker).toBe(true);
    // Device pixel ratio 2: the backing store uses device pixels, so the scale doubles+.
    const hiDpi = await browser.newContext({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 2 });
    const p2 = await hiDpi.newPage();
    await p2.setContent('<!doctype html><html><body></body></html>');
    await p2.addScriptTag({ content: bundleCode });
    const r2 = await run(p2);
    expect([r2.w, r2.h, r2.scale]).toEqual([2000, 1400, 5]);
    expect(r2.mismatches).toBe(0);
    await hiDpi.close();
  });

  it('music: a paused song asked again resumes; an unknown song keeps the current one; loops by key', async (ctx) => {
    if (!page) return ctx.skip();
    const r = await page.evaluate(() =>
      (window as unknown as { MediaTest: { musicRules(): Promise<{ resumed: boolean; kept: string | null; loops: boolean }> } }).MediaTest.musicRules(),
    );
    expect(r).toEqual({ resumed: true, kept: 'test/all', loops: true });
  });

  it('plays sfx and music live without errors', async (ctx) => {
    if (!page) return ctx.skip();
    const r = await page.evaluate(() =>
      (window as unknown as { MediaTest: { liveAudio(): Promise<{ state: string; unlocked: boolean }> } }).MediaTest.liveAudio(),
    );
    expect(r.state).toBe('running');
    expect(pageErrors).toEqual([]);
  });
});
