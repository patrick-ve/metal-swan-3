/**
 * Runs the real browser code in headless Chromium (Playwright):
 * - CanvasRenderer vs SoftRenderer on the same draw calls (exact for opaque drawing,
 *   ±3 per channel where alpha / additive blending rounds differently);
 * - songs rendered offline through the Web Audio instrument graph (sound, level, pitch);
 * - the display: integer scaling in device pixels (DPR 1 and 2), black letterbox, scanlines;
 * - a smoke run of WebAudioOut (sfx, music, pause, fades) without errors, and sampled audio
 *   (a fetched group replaces the synth; voice samples duck the music).
 * Skips (with a warning) when Chromium cannot start.
 */
import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'playwright';
import { chromium } from 'playwright';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PixelBuffer } from '../../src/engine/pixel';
import type { Renderer } from '../../src/engine/render';
import { SoftRenderer } from '../../src/engine/render-soft';
import { getFrame } from '../../src/engine/sprites';
import type { SubpixelMode } from '../../src/engine/render-common';
import type { UpscaleMode } from '../../src/engine/upscale';
import { drawBlendScene, drawHiScene, drawOpaqueScene } from './browser/scene';

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

// ---------------------------------------------------------------- stream scene (DrawOpts.stream)
// The same JS source runs in the page (bundled with the real CanvasRenderer) and in Node (on the
// SoftRenderer), so both sides draw exactly the same calls. Opaque and fully transparent pixels
// only: the comparison is exact.
const STREAM_W = 120;
const STREAM_H = 80;
const STREAM_SCENE = `
  const d = buf.data;
  const w = buf.w;
  const h = buf.h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const hole = (x + 2 * y + step * 5) % 13 === 0;
      const rr = (x * 7 + y * 13 + step * 29) & 255;
      const gg = (x * 3 + step * 50) & 255;
      const bb = (y * 5 + step * 17) & 255;
      d[y * w + x] = hole ? 0 : ((rr << 24) | (gg << 16) | (bb << 8) | 255) >>> 0;
    }
  }
  buf.touch();
  r.begin(0x203040ff);
  r.setCamera(13.4, 7.7);
  r.rect(10, 10, 100, 50, 0xc04020ff, { screen: true });
  r.image(buf, 0, 0, { screen: true, stream: true });
  r.image(buf, 230, 120, { stream: true });
  r.frame({ buf, ox: 60, oy: 40 }, 300, 60, { screen: true, stream: true });
  r.end();
`;
const streamScene = new Function('r', 'buf', 'step', STREAM_SCENE) as (r: Renderer, buf: PixelBuffer, step: number) => void;

let streamCode: string | null = null;

/** IIFE bundle exposing window.StreamTest.run(k) (CanvasRenderer + the stream scene). */
async function streamBundle(): Promise<string> {
  if (streamCode !== null) return streamCode;
  const src = (p: string): string => JSON.stringify(fileURLToPath(new URL(p, import.meta.url)));
  const VIRTUAL = 'virtual:stream-test';
  const entry = `
    import { CanvasRenderer } from ${src('../../src/engine/render-canvas.browser.ts')};
    import { PixelBuffer } from ${src('../../src/engine/pixel.ts')};
    function scene(r, buf, step) {${STREAM_SCENE}}
    function base64(bytes) {
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(s);
    }
    function pick(t) {
      return { streams: t.streams, streamUploads: t.streamUploads };
    }
    window.StreamTest = {
      run(k) {
        const r = new CanvasRenderer(undefined, undefined, undefined, { res: k, mode: 'pixel' });
        const buf = new PixelBuffer(${STREAM_W}, ${STREAM_H});
        const frames = [];
        const stats = [];
        for (let step = 0; step < 3; step++) {
          scene(r, buf, step);
          frames.push(base64(r.ctx.getImageData(0, 0, r.canvas.width, r.canvas.height).data));
          stats.push({ ...pick(r.textureStats()), entries: r.textureStats().entries });
        }
        r.begin();
        r.image(buf, 0, 0, { screen: true, stream: true });
        r.end();
        const idle = pick(r.textureStats());
        for (let i = 0; i < 121; i++) { r.begin(); r.end(); }
        const evicted = pick(r.textureStats());
        return { w: r.canvas.width, h: r.canvas.height, frames, stats, idle, evicted };
      },
    };
  `;
  const out = await build({
    configFile: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'stream-test-entry',
        resolveId: (id) => (id === VIRTUAL ? '\0' + VIRTUAL : null),
        load: (id) => (id === '\0' + VIRTUAL ? entry : null),
      },
    ],
    build: {
      write: false,
      minify: false,
      rollupOptions: { input: VIRTUAL, output: { format: 'iife', name: 'StreamTestBundle' } },
    },
  });
  const outputs = Array.isArray(out) ? out : [out];
  for (const o of outputs) {
    if ('output' in o) {
      const chunk = o.output.find((c) => c.type === 'chunk');
      if (chunk && chunk.type === 'chunk') return (streamCode = chunk.code);
    }
  }
  throw new Error('vite produced no stream chunk');
}

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
    const d = compare(soft.target.toRGBA(), canvasPx, soft.target.w);
    expect(d.firstBig).toBe('');
    expect(d.small).toBe(0);
    expect(d.exact).toBe(soft.target.w * soft.target.h);
  });

  type Hires = { w: number; h: number; rgba: string };
  const hires = (p: Page, k: number, mode: UpscaleMode, sub: SubpixelMode, blend: boolean): Promise<Hires> =>
    p.evaluate(
      ([k, mode, sub, blend]) =>
        (window as unknown as { MediaTest: { hires(k: number, m: string, s: string, b: boolean): Hires } }).MediaTest.hires(k, mode, sub, blend),
      [k, mode, sub, blend] as const,
    );

  // k a multiple of the filter factor: exact. xbr needs k ≥ 4 (below it draws smooth), so its
  // case runs at k 4.
  for (const [k, mode, sub] of [
    [2, 'pixel', 'off'],
    [2, 'pixel', 'camera'],
    [2, 'smooth', 'parallax'],
    [2, 'smooth', 'all'],
    [4, 'xbr', 'parallax'],
    [4, 'xbr', 'all'],
  ] as const) {
    it(`res ${k} backbuffer (${mode}, sub-pixel ${sub}): canvas matches the software renderer`, async (ctx) => {
      if (!page) return ctx.skip();
      for (const blend of [false, true]) {
        const c = await hires(page, k, mode, sub, blend);
        const soft = new SoftRenderer(384, 216, undefined, { res: k, mode, subpixel: sub });
        (blend ? drawBlendScene : drawOpaqueScene)(soft);
        expect([c.w, c.h]).toEqual([soft.target.w, soft.target.h]);
        const d = compare(soft.target.toRGBA(), Buffer.from(c.rgba, 'base64'), c.w);
        expect(d.firstBig, `${mode} blend ${blend}`).toBe('');
        // xBR's partial alpha goes through Canvas' premultiplied storage: ±1 per channel.
        if (blend || mode === 'xbr') expect(d.worst).toBeLessThanOrEqual(3);
        else expect(d.exact, `${mode} opaque`).toBe(c.w * c.h);
      }
    });
  }

  // k not a multiple of the filter factor (smooth at k 3 / 5, xbr at k 5 / 6): Canvas and the
  // software renderer may pick the other source pixel on a nearest-neighbour tie, so a few
  // rows / columns of filtered pixels differ by more than rounding. Recorded tolerance: at most
  // 0.1 % of the backbuffer. Measured (opaque / blend scene): smooth k 3: 88 / 115 px, k 5:
  // 103 / 149; xbr k 5: 981 / 1302 (0.063 %), k 6: 986 / 1313. Blends differ by ±3 elsewhere.
  for (const [k, mode] of [
    [3, 'smooth'],
    [5, 'smooth'],
    [5, 'xbr'],
    [6, 'xbr'],
  ] as const) {
    it(`res ${k} backbuffer (${mode}): canvas matches the software renderer up to nearest ties`, async (ctx) => {
      if (!page) return ctx.skip();
      for (const blend of [false, true]) {
        const c = await hires(page, k, mode, 'camera', blend);
        const soft = new SoftRenderer(384, 216, undefined, { res: k, mode, subpixel: 'camera' });
        (blend ? drawBlendScene : drawOpaqueScene)(soft);
        const d = compare(soft.target.toRGBA(), Buffer.from(c.rgba, 'base64'), c.w);
        expect(d.big, `${mode} k ${k} blend ${blend}`).toBeLessThanOrEqual(Math.ceil(c.w * c.h * 0.001));
      }
    });
  }

  // 2× art (density 2, never filtered, so 'smooth' must not change it): exact at res 1 (the
  // reduction) and where 2 divides the res; at odd res > 1 the 2× buffer is enlarged by k / 2 and
  // Canvas may pick the other pixel on a nearest tie (same tolerance as above). At res 1, 2, 4
  // and 8 (art tier 4's k) the scene also draws 4× art (density 4): exact as its 1× / 2×
  // reduction at res 1 / 2 and as 4 | k blocks at res 4 and 8.
  for (const k of [1, 2, 3, 4, 5, 6, 8]) {
    it(`2× art at res ${k}: canvas matches the software renderer`, async (ctx) => {
      if (!page) return ctx.skip();
      const c = await page.evaluate(
        (k) => (window as unknown as { MediaTest: { hiScene(k: number): Hires } }).MediaTest.hiScene(k),
        k,
      );
      const soft = new SoftRenderer(384, 216, undefined, { res: k, mode: 'smooth' });
      drawHiScene(soft);
      // The scene really draws 2× frames (a failing 2× generator would fall back to 1×).
      expect(getFrame('parity/hero2', 0, 2).density).toBe(2);
      expect(getFrame('parity/hero4', 0, 4).density).toBe(4);
      expect([c.w, c.h]).toEqual([soft.target.w, soft.target.h]);
      const d = compare(soft.target.toRGBA(), Buffer.from(c.rgba, 'base64'), c.w);
      if (k % 2 === 0 || k === 1) expect(d.exact, `res ${k}: ${d.firstBig}`).toBe(c.w * c.h);
      else expect(d.big, `res ${k}`).toBeLessThanOrEqual(Math.ceil(c.w * c.h * 0.001));
    });
  }

  // DrawOpts.stream: one slot per buffer, refilled in place on a version change; the pixels
  // must equal the software renderer (which ignores the flag) after every change.
  for (const k of [1, 3]) {
    it(`streamed buffer changed 3 times at res ${k}: canvas = software, one stream slot`, async (ctx) => {
      if (!browser) return ctx.skip();
      const p = await browser.newPage();
      try {
        await p.setContent('<!doctype html><html><body></body></html>');
        await p.addScriptTag({ content: await streamBundle() });
        type R = { w: number; h: number; frames: string[]; stats: Array<{ streams: number; streamUploads: number; entries: number }>; idle: { streams: number; streamUploads: number }; evicted: { streams: number } };
        const r = await p.evaluate(
          (k) => (window as unknown as { StreamTest: { run(k: number): R } }).StreamTest.run(k),
          k,
        );
        const soft = new SoftRenderer(384, 216, undefined, { res: k, mode: 'pixel' });
        const buf = new PixelBuffer(STREAM_W, STREAM_H);
        for (let step = 0; step < 3; step++) {
          streamScene(soft, buf, step);
          expect([r.w, r.h]).toEqual([soft.target.w, soft.target.h]);
          const d = compare(soft.target.toRGBA(), Buffer.from(r.frames[step], 'base64'), r.w);
          expect(d.firstBig, `res ${k} step ${step}`).toBe('');
          expect(d.exact, `res ${k} step ${step}`).toBe(r.w * r.h);
          // One slot, reused; one upload per change; the stream never enters the texture cache.
          expect(r.stats[step]).toEqual({ streams: 1, streamUploads: step + 1, entries: 0 });
        }
        // A frame without a change uploads nothing; 120+ unused frames drop the slot.
        expect(r.idle).toEqual({ streams: 1, streamUploads: 3 });
        expect(r.evicted.streams).toBe(0);
        expect(pageErrors).toEqual([]);
      } finally {
        await p.close();
      }
    });
  }

  it('canvas renderer matches within rounding for alpha, additive and fades', async (ctx) => {
    if (!page) return ctx.skip();
    const canvasPx = await page.evaluate(() => (window as unknown as { MediaTest: { blend(): number[] } }).MediaTest.blend());
    const soft = new SoftRenderer();
    drawBlendScene(soft);
    const d = compare(soft.target.toRGBA(), canvasPx, soft.target.w);
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

  it('display chooses the backbuffer resolution per filter and presents a res-k backbuffer crisply', async (ctx) => {
    if (!browser) return ctx.skip();
    type R = { scale: number; res: number; back: number[]; mismatches: number; uneven: number };
    const cases: Array<[number, number, number, UpscaleMode, number, number]> = [
      // viewport w, h, DPR, filter → expected scale, res
      [1000, 700, 1, 'smooth', 2, 2],
      [1920, 1080, 1, 'smooth', 5, 5],
      [1920, 1080, 1, 'xbr', 5, 5],
      [3840, 2160, 1, 'smooth', 10, 6],
      [3840, 2160, 1, 'xbr', 10, 4],
      // 16-inch MacBook Pro fullscreen (3456 × 2234 device px): was res 3.
      [1728, 1117, 2, 'smooth', 9, 6],
      [1728, 1117, 2, 'xbr', 9, 4],
    ];
    for (const [w, h, dpr, mode, scale, res] of cases) {
      const label = `${w}x${h}@${dpr} ${mode}`;
      const c = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
      const p = await c.newPage();
      await p.setContent('<!doctype html><html><body></body></html>');
      await p.addScriptTag({ content: bundleCode });
      const r = await p.evaluate(
        (m) => (window as unknown as { MediaTest: { displayHires(m: string): Promise<R> } }).MediaTest.displayHires(m),
        mode,
      );
      await c.close();
      expect([r.scale, r.res], label).toEqual([scale, res]);
      expect(r.back).toEqual([384 * res, 216 * res]);
      expect(r.mismatches, label).toBe(0);
      expect(r.uneven, label).toBe(0);
    }
  });

  it('music: a paused song asked again resumes; an unknown song keeps the current one; loops by key', async (ctx) => {
    if (!page) return ctx.skip();
    const r = await page.evaluate(() =>
      (window as unknown as { MediaTest: { musicRules(): Promise<{ resumed: boolean; kept: string | null; loops: boolean; loopPaused: number; loopResumed: number }> } }).MediaTest.musicRules(),
    );
    expect({ resumed: r.resumed, kept: r.kept, loops: r.loops }).toEqual({ resumed: true, kept: 'test/all', loops: true });
    expect(r.loopPaused).toBeLessThan(0.05);
    expect(r.loopResumed).toBeGreaterThan(0.9);
  });

  it('samples: a loaded group replaces the synth song, sfx and announcer line; speech ducks the music', async (ctx) => {
    if (!page) return ctx.skip();
    type R = { before: string | null; after: string | null; sfx: boolean; voiceReady: boolean; ducked: number; speaking: boolean; resumed: boolean; afterStop: boolean; silentDuck: number; silentSpeech: boolean };
    const r = await page.evaluate(() => (window as unknown as { MediaTest: { samples(): Promise<R> } }).MediaTest.samples());
    expect(r.before).toBe('synth');
    expect(r.after).toBe('sample');
    expect(r.sfx).toBe(true);
    expect(r.voiceReady).toBe(true);
    expect(r.speaking).toBe(true);
    expect(r.ducked).toBeLessThan(0.6);
    expect(r.resumed).toBe(true);
    expect(r.afterStop).toBe(true);
    // VOICE VOLUME 0 neither speaks nor ducks the music.
    expect(r.silentSpeech).toBe(false);
    expect(r.silentDuck).toBeGreaterThan(0.99);
    expect(pageErrors).toEqual([]);
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
