/**
 * The WebGL2 3D view in headless Chromium (docs/design/rally.md §7.1, §12.2, §14 item 5; docs/api/
 * rally.md "A.GL The 3D view"): the real `gl3d.browser.ts` with the test scenes of
 * tests/media/browser/gl3d-entry.ts, bundled with Vite (an IIFE, the pattern of browser.test.ts);
 * the rally models through a second bundle (gl3d-orbit-entry.ts, with the content) in its own page.
 * Without `--gpu` Chromium runs WebGL2 on SwiftShader (Playwright enables it), as in CI.
 *
 * - the PS1 program and the sky pass compile and link; a road scene draws (1P and 2P);
 * - the DITHER: a flat grey shows the 4×4 pattern of the era at the 1× grid at every density
 *   (exactly the reference `ps1Cut`), a smooth gradient falls on 15-bit levels;
 * - the FOG darkens toward fogFar; the SNAP moves an edge in whole 1× pixels; the AFFINE warp bends
 *   a steep floor (and changes nothing on a quad that faces the camera);
 * - back faces, the blend modes of the era, the split-screen viewports, densities 1 / 2 / 4 agree
 *   at the 1× grid; the rally models draw with no missing page or bad mesh;
 * - context loss (WEBGL_lose_context) and restore: `ok` false with a reason while lost, no
 *   exception, the same picture after the restore; no page errors.
 * Skips (with a warning) when Chromium cannot start.
 */
import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'playwright';
import { chromium } from 'playwright';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PS1_LEVELS, ps1Cut, ps1Level8 } from '../../src/engine/r3/ps1';
import type { Gl3dStats } from '../../src/engine/gl3d.browser';

let browser: Browser | null = null;
let page: Page | null = null;
const pageErrors: string[] = [];

async function bundle(file = 'gl3d-entry.ts'): Promise<string> {
  const entry = fileURLToPath(new URL(`./browser/${file}`, import.meta.url));
  const out = await build({
    configFile: false,
    logLevel: 'silent',
    build: { write: false, minify: false, lib: { entry, name: 'Gl3dTestBundle', formats: ['iife'], fileName: 'gl3d-test' } },
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
  // A bundle that does not build is a failure, not a skip (only a Chromium that will not start skips).
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
    console.warn('[browser-3d.test] skipped: cannot run Chromium —', err);
    await browser?.close();
    browser = null;
    page = null;
  }
}, 120_000);

afterAll(async () => {
  await browser?.close();
});

interface Opts {
  d?: 1 | 2 | 4;
  affineNear?: number;
  ps1?: Partial<{ snap: boolean; affine: boolean; dither: boolean; fog: boolean }>;
  t?: number;
  players?: 1 | 2;
  blend?: string;
}

interface RawShot {
  w: number;
  h: number;
  rgba: string;
  points: [number, number][];
  stats: Gl3dStats;
  warnings: string[];
}

class Img {
  readonly w: number;
  readonly h: number;
  readonly px: Buffer;
  readonly d: number;
  readonly points: [number, number][];
  readonly stats: Gl3dStats;
  readonly warnings: string[];
  constructor(s: RawShot) {
    this.w = s.w;
    this.h = s.h;
    this.px = Buffer.from(s.rgba, 'base64');
    this.d = s.w / 384;
    this.points = s.points;
    this.stats = s.stats;
    this.warnings = s.warnings;
  }
  /** RGB of the screen pixel (x, y). */
  at(x: number, y: number): [number, number, number] {
    const i = (y * this.w + x) * 4;
    return [this.px[i], this.px[i + 1], this.px[i + 2]];
  }
  /** RGB at the centre of the 1× pixel (lx, ly). */
  at1(lx: number, ly: number): [number, number, number] {
    const h = this.d >> 1;
    return this.at(lx * this.d + h, ly * this.d + h);
  }
  /** Is every d×d block one colour? */
  blocksUniform(): boolean {
    const d = this.d;
    for (let ly = 0; ly < this.h / d; ly++) {
      for (let lx = 0; lx < this.w / d; lx++) {
        const c = this.at(lx * d, ly * d);
        for (let y = 0; y < d; y++) for (let x = 0; x < d; x++) if (this.at(lx * d + x, ly * d + y).some((v, k) => v !== c[k])) return false;
      }
    }
    return true;
  }
}

async function shot(name: string, o: Opts = {}): Promise<Img> {
  const s = await page!.evaluate(([n, opts]) => (window as unknown as { Gl3dTest: { shot(n: string, o: unknown): RawShot | null } }).Gl3dTest.shot(n as string, opts), [name, o] as const);
  if (!s) throw new Error(`${name}: nothing drawn`);
  return new Img(s);
}

const near = (a: readonly number[], b: readonly number[], tol: number): boolean => a.every((v, k) => Math.abs(v - b[k]) <= tol);
const luma = (c: readonly number[]): number => (c[0] + c[1] + c[2]) / 3;

describe('browser 3D view (WebGL2, the PS1 program)', () => {
  it('compiles and links both programs; the road scene draws in 1P and 2P', async (ctx) => {
    if (!page) return ctx.skip();
    const info = await page.evaluate(() => (window as unknown as { Gl3dTest: { info(): { ok: boolean; reason: string; maxDensity: number } } }).Gl3dTest.info());
    expect(info.reason).toBe('');
    expect(info.ok).toBe(true);
    for (const players of [1, 2] as const) {
      const img = await shot('scene', { d: 1, players });
      expect(img.stats.views).toBe(players);
      expect(img.stats.draws).toBeGreaterThan(5 * players);
      expect(img.stats.missing).toBe(0);
      const colours = new Set<number>();
      for (let i = 0; i < img.px.length; i += 4) colours.add((img.px[i] << 16) | (img.px[i + 1] << 8) | img.px[i + 2]);
      expect(colours.size).toBeGreaterThan(40);
      // The sky: darker blue at the top than at the horizon.
      expect(img.at1(192, 1)[2]).toBeGreaterThan(img.at1(192, 1)[0]);
      expect(luma(img.at1(192, 2))).toBeLessThan(luma(img.at1(192, players === 1 ? 70 : 30)));
    }
  });

  it('the DITHER: a flat grey shows the 4×4 pattern of the era at the 1× grid at every density', async (ctx) => {
    if (!page) return ctx.skip();
    for (const d of [1, 2, 4] as const) {
      const img = await shot('flat', { d });
      expect(img.blocksUniform()).toBe(true);
      let bad = 0;
      for (let ly = 0; ly < 216; ly++) {
        for (let lx = 0; lx < 384; lx++) {
          const want = ps1Level8(ps1Cut(102, lx, ly));
          if (img.at1(lx, ly)[0] !== want) bad++;
        }
      }
      expect(bad, `d ${d}`).toBe(0);
      // 102 dithers to two levels (12 and 13), in the pattern of the matrix.
      expect(new Set([img.at1(0, 0)[0], img.at1(0, 1)[0], img.at1(1, 1)[0]])).toEqual(new Set([ps1Level8(12), ps1Level8(13)]));
    }
    const off = await shot('flat', { d: 1, ps1: { dither: false } });
    expect(off.at1(10, 10)).toEqual([102, 102, 102]);
  });

  it('the DITHER: a smooth gradient falls on 15-bit levels (with dither) and is smooth without', async (ctx) => {
    if (!page) return ctx.skip();
    const levels = new Set(PS1_LEVELS);
    const on = await shot('gradient', { d: 2 });
    const off = await shot('gradient', { d: 2, ps1: { dither: false } });
    let onLevels = 0;
    let total = 0;
    const offRow: number[] = [];
    const onRow: number[] = [];
    for (let lx = 0; lx < 384; lx++) {
      const c = on.at1(lx, 108);
      total++;
      if (c.every((v) => levels.has(v))) onLevels++;
      onRow.push(c[0]);
      offRow.push(off.at1(lx, 108)[0]);
    }
    expect(onLevels).toBe(total);
    // Without the cut: many distinct values, never falling; with it: few levels, and the dither
    // makes neighbours step back and forth.
    expect(new Set(offRow).size).toBeGreaterThan(100);
    expect(offRow.every((v, i) => i === 0 || v >= offRow[i - 1])).toBe(true);
    expect(new Set(onRow).size).toBeLessThanOrEqual(33);
    expect(onRow.some((v, i) => i > 0 && v < onRow[i - 1])).toBe(true);
    // The average stays close to the smooth ramp (the dither keeps the tone).
    const mean = (a: number[]): number => a.reduce((s, v) => s + v, 0) / a.length;
    expect(Math.abs(mean(onRow) - mean(offRow))).toBeLessThan(6);
  });

  it('the FOG darkens toward fogFar (and is off without the trait)', async (ctx) => {
    if (!page) return ctx.skip();
    const on = await shot('fog', { d: 1, ps1: { dither: false } });
    const ls = on.points.map(([x, y]) => luma(on.at1(Math.round(x), Math.round(y))));
    expect(ls[0]).toBeGreaterThan(245);
    for (let i = 1; i < ls.length; i++) expect(ls[i], `quad ${i}`).toBeLessThan(ls[i - 1]);
    expect(ls[4]).toBeLessThan(30); // 340 m: all fog (dark grey 0.1)
    const off = await shot('fog', { d: 1, ps1: { dither: false, fog: false } });
    for (const [x, y] of off.points) expect(luma(off.at1(Math.round(x), Math.round(y)))).toBeGreaterThan(245);
  });

  it('the SNAP: a slowly moving edge jumps in whole 1× pixels (and slides without the trait)', async (ctx) => {
    if (!page) return ctx.skip();
    const edge = (img: Img): number => {
      const y = img.h >> 1;
      for (let x = 0; x < img.w; x++) if (img.at(x, y)[0] > 150 && img.at(x, y)[1] < 120) return x;
      return -1;
    };
    const on: number[] = [];
    const off: number[] = [];
    for (let t = 0; t < 10; t++) {
      on.push(edge(await shot('snap', { d: 4, t })));
      off.push(edge(await shot('snap', { d: 4, t, ps1: { snap: false } })));
    }
    expect(on.every((x) => x >= 0 && x % 4 === 0)).toBe(true);
    expect(new Set(on).size).toBeGreaterThanOrEqual(2);
    expect(off.some((x) => x % 4 !== 0)).toBe(true);
    expect(new Set(off).size).toBeGreaterThan(new Set(on).size);
  });

  it('the AFFINE warp bends a steep floor, and changes nothing on a quad that faces the camera', async (ctx) => {
    if (!page) return ctx.skip();
    const diff = (a: Img, b: Img): number => {
      let n = 0;
      for (let i = 0; i < a.px.length; i += 4) if (Math.abs(a.px[i] - b.px[i]) > 24) n++;
      return n / (a.px.length / 4);
    };
    const steepOn = await shot('affine', { d: 1 });
    const steepOff = await shot('affine', { d: 1, ps1: { affine: false } });
    expect(diff(steepOn, steepOff)).toBeGreaterThan(0.1);
    const flatOn = await shot('frontal', { d: 1 });
    const flatOff = await shot('frontal', { d: 1, ps1: { affine: false } });
    expect(diff(flatOn, flatOff)).toBeLessThan(0.002);
    // The near limit: a floor wholly inside PS1_AFFINE_NEAR is perspective-correct; at 0 it warps.
    const nearOn = await shot('nearfloor', { d: 1 });
    const nearOff = await shot('nearfloor', { d: 1, ps1: { affine: false } });
    const nearPure = await shot('nearfloor', { d: 1, affineNear: 0 });
    expect(diff(nearOn, nearOff)).toBeLessThan(0.002);
    expect(diff(nearPure, nearOff)).toBeGreaterThan(0.05);
  });

  it('culls back faces unless two-sided', async (ctx) => {
    if (!page) return ctx.skip();
    const img = await shot('cull', { d: 1, ps1: { dither: false } });
    const [front, back, two] = img.points.map(([x, y]) => img.at1(Math.round(x), Math.round(y)));
    expect(near(front, [0xd0, 0x40, 0x30], 2)).toBe(true);
    expect(near(back, [0xd0, 0x40, 0x30], 40)).toBe(false);
    expect(near(two, [0x30, 0xa0, 0x50], 2)).toBe(true);
  });

  it('a mesh with a depth bias stays in front of a coplanar one, in either list order', async (ctx) => {
    if (!page) return ctx.skip();
    for (const t of [0, 1]) {
      const img = await shot('bias', { d: 2, t, ps1: { dither: false } });
      const [[x, y]] = img.points;
      expect(img.at1(x, y), `order ${t}`).toEqual([0xd0, 0x40, 0x30]);
    }
  });

  it('the blend modes of the era: average, add, sub, quarter', async (ctx) => {
    if (!page) return ctx.skip();
    const want: Record<string, number> = { opaque: 51, average: 76.5, add: 153, sub: 51, quarter: 114.75 };
    for (const [blend, v] of Object.entries(want)) {
      const img = await shot('blend', { d: 1, blend, ps1: { dither: false } });
      const [[cx, cy], [bx, by]] = img.points;
      expect(Math.abs(img.at1(cx, cy)[0] - v), blend).toBeLessThanOrEqual(1.5);
      expect(img.at1(bx, by)[0], `${blend} background`).toBe(102);
    }
  });

  it('2P: two viewports (top, bottom), each with its own sky and items, split at 108', async (ctx) => {
    if (!page) return ctx.skip();
    for (const d of [1, 4] as const) {
      const img = await shot('split', { d });
      let bad = 0;
      for (let ly = 0; ly < 216; ly += 3) {
        for (let lx = 0; lx < 384; lx += 7) {
          const c = img.at1(lx, ly);
          if (ly < 108 ? !near(c, [0xd0, 0x40, 0x30], 9) : !near(c, [48, 160, 79], 9)) bad++;
        }
      }
      expect(bad, `d ${d}`).toBe(0);
      expect(near(img.at(0, 108 * d - 1), [0xd0, 0x40, 0x30], 9)).toBe(true);
      expect(near(img.at(0, 108 * d), [48, 160, 79], 9)).toBe(true);
    }
  });

  it('densities 1, 2 and 4 agree at the 1× grid', async (ctx) => {
    if (!page) return ctx.skip();
    const one = await shot('scene', { d: 1 });
    for (const d of [2, 4] as const) {
      const img = await shot('scene', { d });
      expect(img.w).toBe(384 * d);
      let ok = 0;
      for (let ly = 0; ly < 216; ly++) for (let lx = 0; lx < 384; lx++) if (near(one.at1(lx, ly), img.at1(lx, ly), 9)) ok++;
      expect(ok / (384 * 216), `d ${d}`).toBeGreaterThan(0.85);
      // The sky rows match exactly (the sky is per 1× pixel; the dither cell is one 1× pixel).
      for (let lx = 160; lx < 224; lx += 3) for (const ly of [1, 20, 40]) expect(img.at1(lx, ly), `sky ${lx},${ly}`).toEqual(one.at1(lx, ly));
    }
  });

  it('draws every rally model with no missing page and no bad mesh', async (ctx) => {
    if (!page || !browser) return ctx.skip();
    const code = await bundle('gl3d-orbit-entry.ts');
    const p2 = await browser.newPage();
    p2.on('pageerror', (e) => pageErrors.push(String(e)));
    await p2.setContent('<!doctype html><html><body></body></html>');
    await p2.addScriptTag({ content: code });
    const models = await p2.evaluate(() => (window as unknown as { Gl3dTest: { models(): string[] } }).Gl3dTest.models());
    expect(models.length).toBeGreaterThan(0);
    for (const id of models) {
      const s = await p2.evaluate((m) => (window as unknown as { Gl3dTest: { orbit(id: string, o: unknown): RawShot | null } }).Gl3dTest.orbit(m, { d: 1 }), id);
      expect(s, id).not.toBeNull();
      expect(s!.warnings, id).toEqual([]);
      expect(s!.stats.missing, id).toBe(0);
      expect(s!.stats.draws, id).toBeGreaterThan(0);
      expect(s!.stats.views, id).toBe(8);
    }
    await p2.close();
  });

  it('survives a context loss: ok false with a reason, no exception, the same picture after the restore', async (ctx) => {
    if (!page) return ctx.skip();
    const before = await shot('scene', { d: 2 });
    type T = { Gl3dTest: { lose(): Promise<{ ok: boolean; reason: string; drew: boolean; threw: string }>; restore(): Promise<{ ok: boolean; reason: string }> } };
    const lost = await page.evaluate(() => (window as unknown as T).Gl3dTest.lose());
    expect(lost.threw).toBe('');
    expect(lost.ok).toBe(false);
    expect(lost.reason).toMatch(/lost/);
    expect(lost.drew).toBe(false);
    const back = await page.evaluate(() => (window as unknown as T).Gl3dTest.restore());
    expect(back.reason).toBe('');
    expect(back.ok).toBe(true);
    const after = await shot('scene', { d: 2 });
    expect(after.stats.missing).toBe(0);
    expect(after.px.equals(before.px)).toBe(true);
  });

  it('no page errors', (ctx) => {
    if (!page) return ctx.skip();
    expect(pageErrors).toEqual([]);
  });
});
