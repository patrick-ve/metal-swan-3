/**
 * The perspective floor's WebGL2 program in headless Chromium (docs/design/floor.md §3.3, §8 item 1;
 * docs/api/floor.md §7): the real `gl-floor.browser.ts`, bundled with Vite from
 * tests/media/browser/floor-entry.ts (no content in the bundle), fed with frames that node captures
 * from real section floors (tests/media/browser/floor-snap.ts) — the frame the CPU raster draws as the
 * reference. Without `--gpu` Chromium runs WebGL2 on SwiftShader (Playwright enables it), as in CI.
 *
 * - the program compiles and links; a frame renders at (384·d) × (bandH·d), one draw call;
 * - GL vs CPU, the same frame (spec §3.3: mean difference ≤ 3/255, 99th percentile ≤ 24/255, over
 *   every pixel either draws): the debug floor on `ams` a (the lane and kerbs; the bridge's hump;
 *   the side canal with its drifting water and quay walls seen from both sides) and on oz-a, at
 *   densities 1 and 2, a fractional camera and a shake; every kit's own floor (each section with a
 *   floor joins by itself, one test each; `ams` a and oz-a must be there: a missing floor fails), at
 *   the start and on the house stretches (their kerbs at a band row: `EXTRA_X`);
 * - THE PAN TEST on the GL path: every row of a level surface of the GL band (R = 4) — the flat walk
 *   plane, else a cut's level (c1: the white bridge's deck; c2: the river) — moves s(y)·Δ within one
 *   backbuffer px on every kit's own floor (one test each);
 * - THE CRACK TEST: the GL band of every kit's own floor has no crack pixel (a hole between two
 *   opaque neighbours) over a fine pan at the lines the mesh weld split (the T-junctions a GPU's
 *   vertex snap opened: region ends such as b's passage mouths and pool ends), at R 5 and 8;
 * - THE GPU BUDGET (spec §3.2, §8 gate 7): the chunk layers and the tile atlas of every kit's own
 *   floor stay ≤ 16 MiB at tier 4 over a walk, and no tile falls back to a lower density (the atlas
 *   is bounded by what the layers leave of the budget: a tile over it is drawn at 2×);
 * - at the backbuffer res (R = 2·d, the game's mode) against the CPU raster at that density with
 *   the same textures;
 * - a still frame draws the same bytes twice and uploads nothing the second time;
 * - context loss: `render` returns null without an exception while lost (the CPU raster draws),
 *   the same picture after the restore; `?floorgl=0` makes no context; no page errors.
 * Skips (with a warning) when Chromium cannot start.
 */
import { fileURLToPath } from 'node:url';
import type { Browser, Page } from 'playwright';
import { chromium } from 'playwright';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Terrain } from '../../src/engine/terrain';
import { loadContent } from '../../src/game/content/index';
import { debugFloorDef, floorOf } from '../../src/game/mission/floor/index';
import { SectionFloor } from '../../src/game/mission/floor/section-floor';
import type { FloorDef } from '../../src/game/mission/floor/types';
import type { SectionDef } from '../../src/game/mission/types';
import { getMission, listMissions } from '../../src/game/registry';
import { heightAt } from '../../src/engine/floor/mesh';
import type { FloorShot, FloorTestApi, Snap } from './browser/floor-entry';
import { captureFrame, compareBands, cpuAt, type BandDiff, type Captured } from './browser/floor-snap';

// The sections with a floor are known at collection time (one test per section).
await loadContent();

let browser: Browser | null = null;
let page: Page | null = null;
const pageErrors: string[] = [];

async function bundle(): Promise<string> {
  const entry = fileURLToPath(new URL('./browser/floor-entry.ts', import.meta.url));
  const out = await build({
    configFile: false,
    logLevel: 'silent',
    build: { write: false, minify: false, lib: { entry, name: 'FloorTestBundle', formats: ['iife'], fileName: 'floor-test' } },
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
  await loadContent();
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
    console.warn('[browser-floor.test] skipped: cannot run Chromium —', err);
    await browser?.close();
    browser = null;
    page = null;
  }
}, 120_000);

afterAll(async () => {
  await browser?.close();
});

type Win = { FloorTest: FloorTestApi };

function section(mission: string, id: string): SectionDef {
  const s = Object.values(getMission(mission)?.sections ?? {}).find((x) => x.id === id);
  if (!s) throw new Error(`no section ${mission}/${id}`);
  return s;
}

/**
 * More cameras for GL = CPU besides the start: the house stretches (facades at 14, their kerbs where a
 * face's edge meets a band row at density 1 — the start of a is the open quay).
 */
const EXTRA_X: Readonly<Record<string, readonly number[]>> = {
  'ams/a': [2000, 2900],
  'ams/b': [2300],
  'ams/c': [1800],
  // c1: the white bridge's deck and the Blauwbrug's hump with the quay; c2: mid-river (the boats' band).
  'ams/c1': [400, 1004],
  'ams/c2': [1200],
  'ams/d': [400],
};

/**
 * THE CRACK TEST's cameras besides the welded lines (the u lines where the weld split quads: the
 * region ends that were T-junctions): b's passage mouths and the long pool's ends.
 */
const CRACK_U: Readonly<Record<string, readonly number[]>> = {
  'ams/b': [400, 720, 1240, 1737],
};

/** The u lines where the weld split quads (a quad with a repeated corner), at least 24 px apart. */
function weldLines(f: SectionFloor): number[] {
  const m = f.mesh;
  const us: number[] = [];
  for (let q = 0; q < m.quadCount; q++) {
    const b = q * 4;
    if (m.quads[b + 1] !== m.quads[b + 2] && m.quads[b + 3] !== m.quads[b]) continue;
    for (const u of [m.quadU0[q], m.quadU1[q]]) if (!us.some((x) => Math.abs(x - u) < 24)) us.push(u);
  }
  return us.sort((a, b) => a - b);
}

/** Every [mission, section id] with a kit floor (the registry: wave B joins by itself). */
function ownFloors(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const m of listMissions()) for (const s of Object.values(getMission(m)?.sections ?? {})) if (floorOf(s) && !out.some(([mm, id]) => mm === m && id === s.id)) out.push([m, s.id]);
  return out;
}

/** The level surfaces of a floor: the walk plane (h 0) first, then every cut's level (floor-sections.test.ts). */
function levelsOf(f: SectionFloor): number[] {
  const out = [0];
  for (const ft of f.def.features ?? []) if (ft.kind === 'cut' && !out.includes(ft.level ?? -4)) out.push(ft.level ?? -4);
  return out;
}

/** The scale of screen row y on a level surface h: (y − yh)/(yw − yh − h). */
function sLevel(f: SectionFloor, y: number, h: number): number {
  return (y - f.cam.yh) / (f.cam.yw - f.cam.yh - h);
}

/**
 * Is the level surface h at screen row y seen across the view at camX? Nothing nearer may rise into the
 * line of sight (a raised deck hides the river behind it): for screen columns every 16 px and nearer
 * depths up to the mesh's front, the floor stays under the ray's height (yw − yh) − (y − yh)/s there.
 */
function seen(floor: SectionFloor, camX: number, y: number, h: number): boolean {
  const c = floor.cam;
  const k = c.yw - c.yh;
  const s0 = sLevel(floor, y, h);
  const sFront = c.f / (c.f - c.vFront);
  for (let xs = -192; xs <= 192; xs += 16) {
    for (let s = s0 + 0.005; s <= sFront; s += 0.005) {
      const v = c.f * (1 - 1 / s);
      const ray = k - (y - c.yh) / s;
      if (heightAt(floor.field, camX + 192 + xs / s, v) > ray + 1e-6) return false;
    }
  }
  return true;
}

/** Rows (band px at res R) of the level surface h across the view at camX (no kerb, step, cut or deck edge within ±2.5 px). */
function glLevelRows(f: SectionFloor, camX: number, R: number, h: number): number[] {
  const cam = f.cam;
  const out: number[] = [];
  for (let j = 0; j < f.bandH * R; j++) {
    const y = f.bandTop + (j + 0.5) / R;
    if (y > 214) continue;
    let level = true;
    for (const dy of [-2.5, 0, 2.5]) {
      const sl = sLevel(f, y + dy, h);
      const v = cam.f * (1 - 1 / sl);
      if (!(sl > 0) || v < cam.vBack + 1e-3) {
        level = false;
        break;
      }
      const half = 196 / sl;
      for (let u = camX + 192 - half; u <= camX + 192 + half && level; u += 6) if (Math.abs(heightAt(f.field, u, v) - h) > 1e-6) level = false;
      if (!level) break;
    }
    // A cut's level (not the walk plane: its rows are as before) only where nothing nearer hides it.
    if (level && h !== 0 && !seen(f, camX, y, h)) level = false;
    if (level) out.push(j);
  }
  return out;
}

/**
 * The GL pan test's camera and level: the start (x − 120) on the walk plane as before when it shows
 * flat rows there; else the camera and cut level with the most rows (the river sections).
 */
function glLevelCamera(f: SectionFloor, s: SectionDef): { x: number; h: number } {
  const x0 = Math.max(0, s.playerStart.x - 120);
  if (glLevelRows(f, x0, 1, 0).length > 0) return { x: x0, h: 0 };
  let best = { x: x0, h: 0 };
  let bestN = 0;
  for (const h of levelsOf(f)) {
    for (let x = 0; x <= Math.max(0, s.width - 384); x += 64) {
      const n = glLevelRows(f, x, 1, h).length;
      if (n > bestN) {
        bestN = n;
        best = { x, h };
      }
    }
  }
  return best;
}

/** The sub-pixel shift k (px) that best maps row A onto row B: B[x] ≈ A[x − k] (floor-raster.test.ts). */
function rowShift(a: Float64Array, b: Float64Array, maxK: number): number {
  const n = a.length;
  const m = maxK + 2;
  const ssd = (k: number): number => {
    let sum = 0;
    for (let x = m + 8; x < n - m - 8; x++) {
      const d = b[x] - a[x - k];
      sum += d * d;
    }
    return sum;
  };
  let best = 0;
  let bv = Infinity;
  for (let k = -maxK; k <= maxK; k++) {
    const v = ssd(k);
    if (v < bv) {
      bv = v;
      best = k;
    }
  }
  const l = ssd(best - 1);
  const r = ssd(best + 1);
  const den = l - 2 * bv + r;
  return den > 1e-9 ? best + (0.5 * (l - r)) / den : best;
}

const floors = new Map<string, SectionFloor>();

/** The section's floor: its kit's (`own`) or the debug floor. */
function floorFor(mission: string, id: string, own: boolean): SectionFloor | null {
  const key = `${mission}/${id}/${own}`;
  let f = floors.get(key);
  if (f) return f;
  const s = section(mission, id);
  const def: FloorDef | undefined = own ? floorOf(s) : debugFloorDef(s, mission);
  if (!def) return null;
  f = new SectionFloor(s, def, new Terrain(s.terrain), 1, `floor-gl-test/${key}/`);
  floors.set(key, f);
  return f;
}

/** Send a captured frame to the page; its frame id there. */
async function load(c: Captured): Promise<number> {
  for (const t of [...Object.values(c.snap.chunks), ...Object.values(c.snap.tiles)]) sentTex.add(`${c.snap.mesh.id}/${t.key}`);
  return page!.evaluate((s) => (window as unknown as Win).FloorTest.load(s), c.snap);
}

/** Texture keys the page holds (it decodes a key once per mesh: `floor-entry.ts` texCache). */
const sentTex = new Set<string>();

/** `load` without the texture levels the page already holds (a fine pan sends each texture once). */
async function loadSlim(c: Captured): Promise<number> {
  const strip = (rec: Snap['chunks']): Snap['chunks'] => {
    const o: Snap['chunks'] = {};
    for (const [i, t] of Object.entries(rec)) {
      const key = `${c.snap.mesh.id}/${t.key}`;
      o[i] = sentTex.has(key) ? { ...t, levels: [] } : t;
      sentTex.add(key);
    }
    return o;
  };
  const snap: Snap = { ...c.snap, chunks: strip(c.snap.chunks), tiles: strip(c.snap.tiles) };
  return page!.evaluate((x) => (window as unknown as Win).FloorTest.load(x), snap);
}

async function shot(id: number, res = 0): Promise<FloorShot & { px: Uint8Array }> {
  const s = await page!.evaluate(([i, r]) => (window as unknown as Win).FloorTest.shot(i, r), [id, res] as const);
  expect(s.threw).toBe('');
  return { ...s, px: new Uint8Array(Buffer.from(s.rgba, 'base64')) };
}

/**
 * GL vs CPU on one frame (at R = d, or `res`); returns the difference. The GL floor uploads one new
 * chunk texture per frame while a stand-in of that chunk is resident: the frame is drawn again until
 * it draws the textures it was handed (as the game does over the next frames).
 */
async function compare(c: Captured, res = 0): Promise<BandDiff> {
  const id = await load(c);
  let g = await shot(id, res);
  for (let i = 0; i < 8 && g.stats.standIns > 0; i++) g = await shot(id, res);
  expect(g.none).toBe(false);
  expect(g.stats.standIns).toBe(0);
  expect(g.stats.missing).toBe(0);
  const cpu = res ? cpuAt(c, res) : c.cpu;
  return compareBands(cpu, { w: g.w, h: g.h, rgba: g.px });
}

/** The spec's limits (§3.3), in /255. */
function withinSpec(d: BandDiff, what: string): void {
  expect(d.n, `${what}: pixels`).toBeGreaterThan(1000);
  expect(d.mean, `${what}: mean ${d.mean.toFixed(3)} (p99 ${d.p99}, max ${d.max}, coverage ${d.coverage})`).toBeLessThanOrEqual(3);
  expect(d.p99, `${what}: p99 (mean ${d.mean.toFixed(3)})`).toBeLessThanOrEqual(24);
}

describe('browser floor (WebGL2, the floor program)', () => {
  it('compiles and links; a frame renders at (384·d) × (bandH·d) in one draw call', async (ctx) => {
    if (!page) return ctx.skip();
    const info = await page.evaluate(() => (window as unknown as Win).FloorTest.info());
    expect(info.reason).toBe('');
    expect(info.ok).toBe(true);
    const f = floorFor('ams', 'a', false)!;
    const c = captureFrame(f, 200, 2);
    const g = await shot(await load(c));
    expect(g.none).toBe(false);
    expect(g.w).toBe(384 * 2);
    expect(g.h).toBe(f.bandH * 2);
    expect(g.stats.draws).toBe(1);
    expect(g.stats.quads).toBe(c.snap.q1 - c.snap.q0);
    expect(g.stats.missing).toBe(0);
  });

  it('GL = CPU on the debug floor of ams a: lane and kerbs, the bridge hump, the canal (both quay walls, drifting water)', async (ctx) => {
    if (!page) return ctx.skip();
    const f = floorFor('ams', 'a', false)!;
    for (const [x, d, tick, camY] of [
      [200, 1, 0, 0],
      [200, 2, 0, 0],
      [200.5, 2, 0, 0],
      [760, 2, 0, 0],
      [1000, 2, 37, 0],
      [1000.25, 1, 91, 0],
      [1000, 2, 12, -2],
    ] as const) {
      withinSpec(await compare(captureFrame(f, x, d, tick, camY)), `ams a debug x ${x} d ${d} tick ${tick} camY ${camY}`);
    }
  });

  it('GL = CPU on the debug floor of oz-a', async (ctx) => {
    if (!page) return ctx.skip();
    const f = floorFor('oldenzaal', 'oz-a', false)!;
    for (const d of [1, 2]) withinSpec(await compare(captureFrame(f, 300, d)), `oz-a debug x 300 d ${d}`);
  });

  it("every kit's own floor joins (each section with a floor by itself; ams a and oz-a must be there)", () => {
    const list = ownFloors().map(([m, id]) => `${m}/${id}`);
    for (const id of ['ams/a', 'oldenzaal/oz-a']) expect(list, `${id} has no floor`).toContain(id);
  });

  for (const [m, id] of ownFloors()) {
    it(`GL = CPU on ${m}/${id}'s own floor (the start${EXTRA_X[`${m}/${id}`] ? ', the house stretches' : ''})`, async (ctx) => {
      if (!page) return ctx.skip();
      const f = floorFor(m, id, true);
      expect(f, `${m}/${id}: its floor`).not.toBeNull();
      if (!f) return;
      const xs = [Math.max(0, section(m, id).playerStart.x - 120), ...(EXTRA_X[`${m}/${id}`] ?? [])];
      for (const x of xs) for (const d of [1, 2]) withinSpec(await compare(captureFrame(f, x, d, 30)), `${id} own floor x ${x} d ${d}`);
    });
  }

  for (const [m, id] of ownFloors()) {
    it(`THE PAN TEST on the GL path, ${m}/${id}: every row of a level surface of the GL band moves s(y)·Δ within one backbuffer px (R = 4)`, async (ctx) => {
      if (!page) return ctx.skip();
      const f = floorFor(m, id, true);
      if (!f) return;
      const R = 4;
      const { x: x0, h } = glLevelCamera(f, section(m, id));
      let checked = 0;
      for (const dx of [0.25, 0.75]) {
        const a = await shot(await load(captureFrame(f, x0, 2, 0)), R);
        let b = await shot(await load(captureFrame(f, x0 + dx, 2, 0)), R);
        for (let i = 0; i < 8 && b.stats.standIns > 0; i++) b = await shot(await load(captureFrame(f, x0 + dx, 2, 0)), R);
        const w = a.w;
        for (const j of glLevelRows(f, x0, R, h)) {
          const ra = new Float64Array(w);
          const rb = new Float64Array(w);
          let mean = 0;
          for (let i = 0; i < w; i++) {
            const p = (j * w + i) * 4;
            ra[i] = (a.px[p] * 3 + a.px[p + 1] * 6 + a.px[p + 2]) / 10;
            rb[i] = (b.px[p] * 3 + b.px[p + 1] * 6 + b.px[p + 2]) / 10;
            mean += ra[i];
          }
          mean /= w;
          let vr = 0;
          for (let i = 0; i < w; i++) vr += (ra[i] - mean) ** 2;
          if (vr / w < 20) continue;
          const y = f.bandTop + (j + 0.5) / R;
          const want = -sLevel(f, y, h) * dx * R;
          const got = rowShift(ra, rb, Math.ceil(Math.abs(want)) + 3);
          checked++;
          expect(Math.abs(got - want), `${id} GL row y ${y.toFixed(2)} level ${h} dx ${dx}`).toBeLessThanOrEqual(1);
        }
      }
      expect(checked, `${id}: GL rows checked (level ${h} at x ${x0})`).toBeGreaterThan(40);
    });
  }

  for (const [m, id] of ownFloors()) {
    it(`THE CRACK TEST, ${m}/${id}: the GL band has no crack pixel (alpha < 255 between two opaque neighbours) at the welded lines over a fine pan, at R 5 and 8`, async (ctx) => {
      if (!page) return ctx.skip();
      const f = floorFor(m, id, true);
      if (!f) return;
      const s = section(m, id);
      const maxX = Math.max(0, s.width - 384);
      const us = [...weldLines(f), ...(CRACK_U[`${m}/${id}`] ?? [])];
      // Each line left and right of the centre column (its faces and slanted edges both ways), in
      // sub-pixel steps; a section without a welded line: its start and its middle.
      const xs: number[] = [];
      const bases = us.length ? us.flatMap((u) => [u - 100, u - 290]) : [Math.max(0, s.playerStart.x - 120), maxX / 2];
      for (const b of bases) for (const dx of [0, 0.37, 0.81]) xs.push(Math.min(maxX, Math.max(0, b + dx)));
      let frames = 0;
      const bad: string[] = [];
      for (const x of xs) {
        const fid = await loadSlim(captureFrame(f, x, 2, 30));
        for (const R of [5, 8]) {
          const c = await page.evaluate(([i, r]) => (window as unknown as Win).FloorTest.cracks(i, r), [fid, R] as const);
          expect(c.none, `${id} x ${x} R ${R}: GL drew`).toBe(false);
          frames++;
          if (c.cracks > 0) bad.push(`x ${x.toFixed(2)} R ${R}: ${c.cracks} px, first at ${c.first.slice(0, 6).join(',')}`);
        }
      }
      expect(bad, `${id}: crack frames of ${frames}`).toEqual([]);
      expect(frames).toBeGreaterThanOrEqual(12);
    });
  }

  for (const [m, id] of ownFloors()) {
    it(`THE GPU BUDGET, ${m}/${id}: the chunk layers and the tile atlas stay ≤ 16 MiB at tier 4 over a walk of the section, every tile at the band's density (none falls back)`, async (ctx) => {
      if (!page) return ctx.skip();
      const f = floorFor(m, id, true);
      if (!f) return;
      const s = section(m, id);
      let peak = 0;
      let frames = 0;
      let at = 0;
      let parts = '';
      for (let x = 0; x <= Math.max(0, s.width - 384); x += 96) {
        const fid = await loadSlim(captureFrame(f, x, 4, 30));
        const st = await page.evaluate(([i, r]) => (window as unknown as Win).FloorTest.stats(i, r), [fid, 4] as const);
        expect(st.none, `${id} x ${x}: GL drew`).toBe(false);
        expect(st.missing, `${id} x ${x}: missing textures`).toBe(0);
        expect(st.tileFallbacks, `${id} x ${x}: tiles over the atlas budget`).toBe(0);
        if (st.texBytes > peak) {
          peak = st.texBytes;
          at = x;
          parts = `layers ${st.layers} × ${st.layerW}×${st.layerH}`;
        }
        frames++;
      }
      console.log(`[gpu budget] ${m}/${id}: texBytes peak ${(peak / 1048576).toFixed(2)} MiB at camX ${at}: ${parts} (${frames} frames at d 4)`);
      expect(peak, `${id}: GPU texture bytes (peak at camX ${at})`).toBeLessThanOrEqual(16 * 1024 * 1024);
      expect(peak).toBeGreaterThan(4 * 1024 * 1024);
    }, 300_000);
  }

  it('at the backbuffer res (R = 2·d): GL = the CPU raster at that density with the same textures', async (ctx) => {
    if (!page) return ctx.skip();
    const f = floorFor('ams', 'a', false)!;
    for (const x of [200.375, 1000]) {
      const c = captureFrame(f, x, 2, 20);
      withinSpec(await compare(c, 4), `ams a debug x ${x} d 2 at R 4`);
    }
  });

  it('a still frame draws the same bytes twice and uploads nothing the second time', async (ctx) => {
    if (!page) return ctx.skip();
    const f = floorFor('ams', 'a', false)!;
    const id = await load(captureFrame(f, 1000, 2, 5));
    const a = await shot(id);
    const b = await shot(id);
    expect(b.stats.uploads).toBe(0);
    expect(Buffer.from(a.px).equals(Buffer.from(b.px))).toBe(true);
  });

  it('survives a context loss: null without an exception while lost, the same picture after the restore', async (ctx) => {
    if (!page) return ctx.skip();
    const f = floorFor('ams', 'a', false)!;
    const id = await load(captureFrame(f, 1000, 2, 5));
    const before = await shot(id);
    const lost = await page.evaluate((i) => (window as unknown as Win).FloorTest.lose(i), id);
    expect(lost.threw).toBe('');
    expect(lost.drew).toBe(false);
    expect(lost.ok).toBe(false);
    expect(lost.reason).toMatch(/lost/);
    const back = await page.evaluate(() => (window as unknown as Win).FloorTest.restore());
    expect(back.reason).toBe('');
    expect(back.ok).toBe(true);
    const after = await shot(id);
    expect(after.none).toBe(false);
    expect(after.stats.uploads).toBeGreaterThan(0);
    expect(Buffer.from(after.px).equals(Buffer.from(before.px))).toBe(true);
  });

  it('?floorgl=0: an off renderer returns null, makes no context, and caps the CPU at 2', async (ctx) => {
    if (!page) return ctx.skip();
    const id = await load(captureFrame(floorFor('ams', 'a', false)!, 200, 1));
    const off = await page.evaluate((i) => (window as unknown as Win).FloorTest.off(i), id);
    expect(off).toEqual({ ok: false, reason: 'off (?floorgl=0)', none: true, canvas: false, cpuCap: 2 });
  });

  it('no page errors', (ctx) => {
    if (!page) return ctx.skip();
    expect(pageErrors).toEqual([]);
  });
});
