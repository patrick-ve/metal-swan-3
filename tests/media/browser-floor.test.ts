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
 *   floor joins by itself; `ams` a and oz-a must be there: a missing floor fails);
 * - THE PAN TEST on the GL path: every flat row of the GL band (R = 4) moves s(y)·Δ within one
 *   backbuffer px on every kit's own floor;
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
import { sOfY, vOfY } from '../../src/engine/floor/cam';
import { heightAt, profileAt } from '../../src/engine/floor/mesh';
import type { FloorShot, FloorTestApi } from './browser/floor-entry';
import { captureFrame, compareBands, cpuAt, type BandDiff, type Captured } from './browser/floor-snap';

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

/** Every [mission, section id] with a kit floor (the registry: wave B joins by itself). */
function ownFloors(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const m of listMissions()) for (const s of Object.values(getMission(m)?.sections ?? {})) if (floorOf(s) && !out.some(([mm, id]) => mm === m && id === s.id)) out.push([m, s.id]);
  return out;
}

/** Rows (band px at res R) of the flat floor across the view at camX (no kerb, step, cut or deck within ±2.5 px). */
function glFlatRows(f: SectionFloor, camX: number, R: number): number[] {
  const cam = f.cam;
  const out: number[] = [];
  for (let j = 0; j < f.bandH * R; j++) {
    const y = f.bandTop + (j + 0.5) / R;
    if (y < cam.back + 1.5 || y > 214) continue;
    let flat = true;
    for (const dy of [-2.5, 0, 2.5]) {
      const v = vOfY(cam, Math.max(cam.back + 0.01, y + dy));
      const half = 196 / sOfY(cam, y + dy);
      for (let u = camX + 192 - half; u <= camX + 192 + half && flat; u += 6) {
        const h0 = profileAt(f.field, u);
        if (!Number.isFinite(h0) || Math.abs(heightAt(f.field, u, v) - h0) > 1e-6 || Math.abs(h0 - (cam.yw - 176)) > 1e-6) flat = false;
      }
      if (!flat) break;
    }
    if (flat) out.push(j);
  }
  return out;
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
  return page!.evaluate((s) => (window as unknown as Win).FloorTest.load(s), c.snap);
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

  it("GL = CPU on every kit's own floor (each section with a floor joins by itself; ams a and oz-a must be there)", async (ctx) => {
    if (!page) return ctx.skip();
    const list = ownFloors();
    for (const id of ['ams/a', 'oldenzaal/oz-a']) expect(list.map(([m, s]) => `${m}/${s}`), `${id} has no floor`).toContain(id);
    for (const [m, id] of list) {
      const f = floorFor(m, id, true);
      expect(f, `${m}/${id}: its floor`).not.toBeNull();
      if (!f) continue;
      const x = Math.max(0, section(m, id).playerStart.x - 120);
      for (const d of [1, 2]) withinSpec(await compare(captureFrame(f, x, d, 30)), `${id} own floor x ${x} d ${d}`);
    }
  });

  it('THE PAN TEST on the GL path: on every kit\'s own floor every flat row of the GL band moves s(y)·Δ within one backbuffer px (R = 4)', async (ctx) => {
    if (!page) return ctx.skip();
    for (const [m, id] of ownFloors()) {
      const f = floorFor(m, id, true);
      if (!f) continue;
      const R = 4;
      const x0 = Math.max(0, section(m, id).playerStart.x - 120);
      let checked = 0;
      for (const dx of [0.25, 0.75]) {
        const a = await shot(await load(captureFrame(f, x0, 2, 0)), R);
        let b = await shot(await load(captureFrame(f, x0 + dx, 2, 0)), R);
        for (let i = 0; i < 8 && b.stats.standIns > 0; i++) b = await shot(await load(captureFrame(f, x0 + dx, 2, 0)), R);
        const w = a.w;
        for (const j of glFlatRows(f, x0, R)) {
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
          const want = -sOfY(f.cam, y) * dx * R;
          const got = rowShift(ra, rb, Math.ceil(Math.abs(want)) + 3);
          checked++;
          expect(Math.abs(got - want), `${id} GL row y ${y.toFixed(2)} dx ${dx}`).toBeLessThanOrEqual(1);
        }
      }
      expect(checked, `${id}: GL rows checked`).toBeGreaterThan(40);
    }
  });

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
