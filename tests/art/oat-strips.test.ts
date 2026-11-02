/**
 * The façade strips (docs/design/oat.md §8.6 "The strips", §8.9 the two bakes, §8.12 the memory; the
 * store: src/game/mission/strips/store.ts, the view: src/game/mission/view.ts). STRIPS, wave A.
 *
 * - the strip space (strip x ↔ world x on the façade plane; the same place as a decor item there);
 * - chunks and jobs: one art job per band of the source's `bands`, bands tile the chunk, a 1× stand-in
 *   on screen until the dense chunk is painted, every placeholder job under STRIP_JOB_MS, the per-frame
 *   budget is the shared HI_ART_FRAME_BUDGET_MS = STRIP_FRAME_MS;
 * - prefetch by scroll speed: at tier 4 the oat-c1 auto-scroll (1.0 → 1.2 px/tick) and the taxi's 3
 *   px/tick never catch a chunk that is not painted at 4×, with a slow source and the floor's jobs
 *   competing in the same queue;
 * - eviction (two behind, the far prefetch), rebuild on return, dispose;
 * - the memory numbers (≈ 3.5 MB per 4× chunk, ≈ 5 resident ≤ 18 MB, the dark set ≤ 11 MB, both
 *   inside oat's 84 MB reserve with the layers and the terrain);
 * - the light sets (the dark bake from darkFrom, the cross-fade, the lit chunks dropped at 1);
 * - fail soft; no strips = no store and no draw (every existing section);
 * - the view: the chunks drawn 1:1 where a decor item at the façade depth stands, the cross-fade
 *   draw, the live binding (`setStripDarkMix`), and no allocation per frame in the draw path.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { makeFloorCam, sAtDepth, shiftX } from '../../src/engine/floor/cam';
import { PAL } from '../../src/engine/palette';
import { inHdPalette } from '../../src/engine/palette-hd';
import type { PixelBuffer } from '../../src/engine/pixel';
import type { DrawOpts, Frame, Renderer } from '../../src/engine/render';
import { VIEW_W } from '../../src/engine/render';
import { cancelArtJobs, HI_ART_FRAME_BUDGET_MS, hasArtJob, pendingArtJobs, queueArtJob, runArtJobs, setArtTier, setDeferHiArt, setHiArt } from '../../src/engine/sprites';
import { Terrain } from '../../src/engine/terrain';
import { debugFloorDef } from '../../src/game/mission/floor/debug';
import {
  chunksOfRange,
  createStripStore,
  defineStripSource,
  definePlaceholderStrips,
  liveStripStore,
  PLACEHOLDER_STRIP_SOURCE,
  setStripDarkMix,
  stripBandRows,
  stripChunkOfU,
  stripDrawX,
  stripXOfU,
  uOfStripX,
  STRIP_BUDGET_BYTES,
  STRIP_CHUNK,
  STRIP_DARK_BUDGET_BYTES,
  STRIP_FRAME_MS,
  STRIP_JOB_MS,
  STRIP_KEEP_BEHIND,
  STRIP_MAX_H,
  type SectionStripsDef,
  type StripDensity,
  type StripLightSet,
  type StripPlan,
  type StripStore,
} from '../../src/game/mission/strips/index';
import type { SectionDef } from '../../src/game/mission/types';
import { SectionView } from '../../src/game/mission/view';

definePlaceholderStrips();

const MB = 1024 * 1024;
/** oat-a's façade plane (depth 16 at yh 60: s = 0.862, spec §8.2). */
const S_A = sAtDepth(makeFloorCam({ yh: 60, f: 210, back: 160 }), 16);

afterEach(() => {
  setDeferHiArt(false);
  cancelArtJobs('');
});

/** A strips def over [0, w) (placeholder source unless given). */
function stripsDef(w: number, extra: Partial<SectionStripsDef> = {}): SectionStripsDef {
  return { source: PLACEHOLDER_STRIP_SOURCE, depth: 16, height: 216, rows: [{ u0: 0, u1: w, sheet: '9-straatjes' }], ...extra };
}

/** A plain section (no floor unless `floor`): flat ground at 176. */
function section(id: string, w: number, strips?: SectionStripsDef): SectionDef {
  return {
    id,
    width: w,
    height: 216,
    scroll: 'right',
    background: { sky: PAL.navy[1], layers: [] },
    terrain: { bounds: { x: 0, y: 0, w, h: 216 }, ground: [[[0, 176], [w, 176]]], platforms: [], solids: [], hazards: [] },
    terrainStyle: { ground: 'dirt' },
    playerStart: { x: 48, y: 176 },
    strips,
    *script() {},
  };
}

/** A renderer that records the frames drawn (top-left in world px, the buffer, the alpha) and draws nothing. */
interface Spy {
  r: Renderer & { camX: number; camY: number };
  draws: { x: number; y: number; buf: PixelBuffer; alpha: number }[];
}
function spy(res: number, camX: number): Spy {
  const draws: Spy['draws'] = [];
  const r = {
    res,
    subpixel: 'all',
    camX,
    camY: 0,
    frame(f: Frame, x: number, y: number, o?: DrawOpts) {
      draws.push({ x: x - f.ox, y: y - f.oy, buf: f.buf, alpha: o?.alpha ?? 1 });
    },
    sprite() {},
    surface() {},
    line() {},
    rect() {},
    image() {},
    parallax() {},
  } as unknown as Renderer & { camX: number; camY: number };
  return { r, draws };
}

/** The draws of a store's chunk buffers (lit or dark, any density), in draw order. */
function stripDraws(sp: Spy, store: StripStore): Spy['draws'] {
  const bufs = new Set<PixelBuffer>();
  for (let cx = store.c0; cx <= store.c1; cx++) {
    for (const d of [1, 2, 4] as StripDensity[]) {
      for (const set of ['lit', 'dark'] as StripLightSet[]) {
        const b = store.has(cx, d, set) ? store.chunk(cx, d, set) : null;
        if (b) bufs.add(b);
      }
    }
  }
  return sp.draws.filter((d) => bufs.has(d.buf));
}

/**
 * A source of a given cost: each band advances a fake clock by `bandMs` (and paints one opaque row
 * per band so the chunk is visibly built). Counts its paints.
 */
function costSource(id: string, bandMs: number, bands: number, clock: { t: number }, height = 216): { paints: string[] } {
  const log = { paints: [] as string[] };
  defineStripSource(id, {
    plan(): StripPlan {
      return {
        height,
        covers: () => true,
        bands: () => bands,
        paint(cx, d, set, b, out) {
          clock.t += bandMs;
          log.paints.push(`${cx}:${d}:${set}:${b}`);
          const rows = stripBandRows(b, bands, out.h);
          for (let x = 0; x < out.w; x++) out.data[rows.r0 * out.w + x] = PAL.stone[2];
        },
      };
    },
  });
  return log;
}

describe('the strip space (types.ts "THE STRIP SPACE", space.ts)', () => {
  it('strip x ↔ world x are inverse; chunk ranges; bands tile a chunk with no gap or overlap', () => {
    expect(S_A).toBeCloseTo(0.862, 3);
    for (const u of [-300, 0, 192, 544, 1568, 4607.5]) expect(uOfStripX(stripXOfU(u, S_A), S_A)).toBeCloseTo(u, 9);
    expect(stripXOfU(192, S_A)).toBe(192);
    expect(stripXOfU(1000, 1)).toBe(1000);
    // A chunk is 256 strip px ≈ 297 world px at s 0.862.
    expect(uOfStripX(STRIP_CHUNK, S_A) - uOfStripX(0, S_A)).toBeCloseTo(297, 0);
    const r = chunksOfRange(544, 1568, S_A);
    expect(r.c0).toBe(stripChunkOfU(544, S_A));
    expect(r.c1).toBe(stripChunkOfU(1567.999, S_A));
    expect(chunksOfRange(10, 10, S_A).c1).toBeLessThan(chunksOfRange(10, 10, S_A).c0);
    for (const n of [1, 2, 3, 4, 7]) {
      for (const H of [216, 672, 864, 701]) {
        let next = 0;
        for (let b = 0; b < n; b++) {
          const rows = stripBandRows(b, n, H);
          expect(rows.r0).toBe(next);
          next = rows.r1;
        }
        expect(next).toBe(H);
      }
    }
  });

  it('a strip px is drawn exactly where a decor item at the façade depth and that world x stands (floor/cam.ts shiftX)', () => {
    const cam = makeFloorCam({ yh: 60, f: 210, back: 160 });
    for (const camX of [0, 37.25, 1234.5, 4000]) {
      for (const u of [0, 300, 1111, 4096]) {
        const p = stripXOfU(u, S_A);
        expect(stripDrawX(p, S_A, camX)).toBeCloseTo(shiftX(cam, u, 16, camX), 9);
      }
    }
  });
});

describe('chunks and jobs (spec §8.6: ≤ 16 ms per job, ≤ 8 ms of jobs per frame, the lower density meanwhile)', () => {
  it('a deferred chunk is one art job per band; a 1× stand-in is drawn until all bands ran; then it is released', () => {
    setDeferHiArt(true);
    const store = createStripStore(stripsDef(1024), { id: 'jobs', width: 1024, seed: 1 }, { jobKey: 'test-strips/' });
    store.prepare(0, 0, 4);
    // On screen at camX 0: chunks 0 and 1 (384 px); one ahead: 2. 4 bands each at 4× (placeholder).
    for (const cx of [0, 1]) {
      expect(store.has(cx, 1), `stand-in ${cx}`).toBe(true);
      expect(store.pending(cx, 4)).toBe(true);
      expect(store.frameOf(cx, 4)?.density).toBe(1);
    }
    expect(store.has(2, 1)).toBe(false);
    expect(store.pending(2, 4)).toBe(true);
    expect(store.stats.sync).toBe(2);
    for (let b = 0; b < 4; b++) expect(hasArtJob(`test-strips/0:4:0:${b}`)).toBe(true);
    expect(hasArtJob('test-strips/0:4:0:4')).toBe(false);
    // Three bands run: still the stand-in.
    for (let k = 0; k < 3; k++) runArtJobs(0);
    expect(store.has(0, 4)).toBe(false);
    expect(store.frameOf(0, 4)?.density).toBe(1);
    runArtJobs(0);
    expect(store.has(0, 4)).toBe(true);
    expect(store.has(0, 1), 'the stand-in is released').toBe(false);
    expect(store.frameOf(0, 4)?.density).toBe(4);
    while (runArtJobs(1e9) > 0);
    for (const cx of [0, 1, 2]) expect(store.has(cx, 4)).toBe(true);
    expect(store.stats.jobs).toBe(3 * 4 + 2);
    // Painted in bands = painted at once (the bands tile the chunk).
    const once = createStripStore(stripsDef(1024), { id: 'jobs', width: 1024, seed: 1 }, { deferred: () => false });
    once.prepare(0, 0, 4);
    expect(once.chunk(0, 4)?.data).toEqual(store.chunk(0, 4)?.data);
    store.dispose();
    once.dispose();
  });

  it('a prefetched chunk the view catches before its jobs ran gets a stand-in (no gap); 1× is painted at once', () => {
    setDeferHiArt(true);
    const store = createStripStore(stripsDef(2048), { id: 'catch', width: 2048, seed: 1 }, { jobKey: 'catch/' });
    store.prepare(0, 0, 4);
    expect(store.pending(2, 4)).toBe(true);
    // A jump (no job ran): chunk 2 is on screen now.
    store.prepare(300, 0, 4);
    expect(store.frameOf(2, 4)?.density).toBe(1);
    // At 1× nothing is ever queued (small; res 1 or dense art off).
    const one = createStripStore(stripsDef(2048), { id: 'one', width: 2048, seed: 1 }, { jobKey: 'one/' });
    one.prepare(0, 0, 1);
    for (const cx of [0, 1, 2]) expect(one.has(cx, 1)).toBe(true);
    expect(pendingArtJobs()).toBeGreaterThan(0);
    cancelArtJobs('catch/');
    expect(pendingArtJobs()).toBe(0);
    store.dispose();
    one.dispose();
  });

  it('every placeholder job stays under STRIP_JOB_MS at 4× (216 px high); the frame budget is the shared one', () => {
    expect(HI_ART_FRAME_BUDGET_MS).toBe(STRIP_FRAME_MS);
    expect(STRIP_JOB_MS).toBe(16);
    let best = Infinity;
    for (let k = 0; k < 3; k++) {
      const store = createStripStore(stripsDef(1024), { id: 'ms', width: 1024, seed: k, scale: S_A }, { deferred: () => false, now: () => performance.now() });
      store.prepare(0, 0, 4);
      best = Math.min(best, store.stats.maxJobMs);
      store.dispose();
    }
    expect(best).toBeLessThan(STRIP_JOB_MS);
  });

  it('the shared queue runs at most one job past the frame budget (STRIP_FRAME_MS)', () => {
    const clock = { t: 0 };
    costSource('cost-frame', 3, 8, clock);
    setDeferHiArt(true);
    const store = createStripStore({ ...stripsDef(1024), source: 'cost-frame' }, { id: 'f', width: 1024, seed: 1 }, { jobKey: 'f/' });
    store.prepare(0, 0, 4);
    const t0 = clock.t;
    const n = runArtJobs(STRIP_FRAME_MS, () => clock.t);
    expect(n).toBe(3);
    expect(clock.t - t0).toBeLessThanOrEqual(STRIP_FRAME_MS + 3);
    store.dispose();
  });
});

describe('prefetch by scroll speed at tier 4 (spec §8.6, §8.12: "the c1 prefetch keeps ahead of 1.2 px/tick")', () => {
  /**
   * Scroll a deferred store through a section at `speed` px per tick, one frame per tick, the view
   * running ≤ STRIP_FRAME_MS of jobs per frame (a fake clock: the source's band cost; plus a floor that
   * queues a 42 ms chunk in 32 slices every 256 world px). Returns the frames whose on-screen chunks
   * were not all at 4× after the start, and the stand-ins made after it.
   */
  function scroll(width: number, speed: number, bandMs: number, bands: number, prefetch: number | undefined, accel?: [number, number]) {
    const clock = { t: 0 };
    const id = `cost-${speed}-${bandMs}-${bands}-${prefetch}`;
    costSource(id, bandMs, bands, clock);
    setDeferHiArt(true);
    const store = createStripStore({ ...stripsDef(width), source: id, prefetch }, { id, width, seed: 1, scale: S_A }, { jobKey: `${id}/` });
    const now = (): number => clock.t;
    let camX = 0;
    let lastFloor = -1;
    let floorN = 0;
    let late = 0;
    let startSync = -1;
    let frame = 0;
    let v = speed;
    while (camX < width - VIEW_W) {
      if (accel && camX >= accel[0]) v = accel[1];
      // The floor's chunk jobs (a 4× floor chunk: 42 ms in 32 slices), queued every 256 world px.
      const fk = Math.floor(camX / 256);
      if (fk !== lastFloor) {
        lastFloor = fk;
        for (let k = 0; k < 32; k++) queueArtJob(`floor-sim/${floorN}/${k}`, () => (clock.t += 42 / 32));
        floorN++;
      }
      store.prepare(camX, v, 4);
      if (frame === 120) startSync = store.stats.sync;
      if (frame >= 120) {
        const p0 = camX * store.scale;
        for (let cx = Math.floor(p0 / STRIP_CHUNK); cx <= Math.floor((p0 + VIEW_W) / STRIP_CHUNK); cx++) {
          if (store.covers(cx) && store.frameOf(cx, 4)?.density !== 4) late++;
        }
      }
      runArtJobs(STRIP_FRAME_MS, now);
      clock.t += 16.7 - STRIP_FRAME_MS;
      camX += v;
      frame++;
    }
    const after = store.stats.sync - startSync;
    const peak = store.stats.peakLitBytes;
    store.dispose();
    cancelArtJobs('floor-sim/');
    return { late, after, peak };
  }

  it('oat-c1 (4,096 px, 1.0 → 1.2 px/tick, prefetch 2): every chunk on screen is 4× (a source at 14 ms and at 4 × 16 ms per chunk)', () => {
    for (const [bandMs, bands] of [
      [3.5, 4],
      [16, 4],
    ] as const) {
      const r = scroll(4096, 1.0, bandMs, bands, 2, [2048, 1.2]);
      expect(r.late, `${bandMs} ms × ${bands}`).toBe(0);
      expect(r.after).toBe(0);
      expect(r.peak).toBeLessThanOrEqual(STRIP_BUDGET_BYTES);
    }
  });

  it('the taxi ride (6,144 px at 3 px/tick) and a fast run at 1.5 px/tick stay ahead too (the speed rule adds chunks)', () => {
    expect(scroll(6144, 3, 16, 4, 2).late).toBe(0);
    expect(scroll(4608, 1.5, 16, 4, undefined).late).toBe(0);
  });
});

describe('eviction and the memory numbers (spec §8.6 "about 5 resident ≈ 18 MB at 4×, flat"; §8.12, decision 50)', () => {
  it('a 4× chunk of 216 px is ≈ 3.5 MB; the budgets add up inside oat’s 84 MB reserve', async () => {
    const store = createStripStore(stripsDef(1024), { id: 'mem', width: 1024, seed: 1 });
    expect(store.chunkBytes(4)).toBe(1024 * 864 * 4);
    expect(store.chunkBytes(4) / MB).toBeCloseTo(3.375, 3);
    expect(store.chunkBytes(2)).toBe(512 * 432 * 4);
    // Five resident fit the lit budget; the dark set is three.
    expect(5 * store.chunkBytes(4)).toBeLessThanOrEqual(STRIP_BUDGET_BYTES);
    expect(6 * store.chunkBytes(4)).toBeGreaterThan(STRIP_BUDGET_BYTES);
    expect(3 * store.chunkBytes(4)).toBeLessThanOrEqual(STRIP_DARK_BUDGET_BYTES);
    // Spec §8.12: strips 18 + layers 50 + the dark set 11 + terrain 5 = the 84 MB reserve.
    const { OAT_SCENERY_RESERVE } = await import('../../src/game/content/missions/oat/index');
    expect(STRIP_BUDGET_BYTES + 50 * MB + STRIP_DARK_BUDGET_BYTES + 5 * MB).toBe(OAT_SCENERY_RESERVE);
    expect(STRIP_MAX_H).toBe(216);
    store.dispose();
  });

  it('walking a 4,608 px street at 4×: ≤ 5 resident, ≤ 18 MB at every frame, flat for any length; two behind released (one behind while the budget has room); back again rebuilds', () => {
    for (const width of [4608, 12288]) {
      const store = createStripStore(stripsDef(width), { id: 'walk', width, seed: 1, scale: S_A }, { deferred: () => false });
      let peak = 0;
      for (let x = 0; x <= width - VIEW_W; x += 1.5) {
        store.prepare(x, 1.5, 4);
        peak = Math.max(peak, store.count('lit'));
        expect(store.bytes).toBeLessThanOrEqual(STRIP_BUDGET_BYTES);
        const cL = Math.floor((x * store.scale) / STRIP_CHUNK);
        expect(store.has(cL - STRIP_KEEP_BEHIND, 4)).toBe(false);
      }
      expect(peak).toBe(5);
      expect(store.stats.peakLitBytes).toBeLessThanOrEqual(STRIP_BUDGET_BYTES);
      expect(store.stats.overBudget).toBe(0);
      // Back to the start: the chunks there are rebuilt.
      const built = store.stats.built[2];
      store.prepare(0, 0, 4);
      expect(store.has(0, 4)).toBe(true);
      expect(store.stats.built[2]).toBeGreaterThan(built);
      store.dispose();
      expect(store.bytes).toBe(0);
      expect(store.count()).toBe(0);
    }
  });

  it('a tight budget squeezes behind first, refuses the far prefetch, and still builds what is on screen', () => {
    const store = createStripStore(stripsDef(4096), { id: 'tight', width: 4096, seed: 1 }, { deferred: () => false, budgetBytes: 2.5 * 1024 * 864 * 4 });
    for (let x = 0; x <= 2000; x += 4) store.prepare(x, 4, 4);
    expect(store.stats.squeezed + store.stats.refused).toBeGreaterThan(0);
    const cL = Math.floor(2000 / STRIP_CHUNK);
    const cR = Math.floor((2000 + VIEW_W) / STRIP_CHUNK);
    for (let cx = cL; cx <= cR; cx++) expect(store.has(cx, 4)).toBe(true);
    store.dispose();
  });

  it('a lower draw density releases the denser chunks (a res or tier change)', () => {
    const store = createStripStore(stripsDef(2048), { id: 'tier', width: 2048, seed: 1 }, { deferred: () => false });
    store.prepare(0, 0, 4);
    expect(store.has(0, 4)).toBe(true);
    store.prepare(0, 0, 2);
    expect(store.has(0, 4)).toBe(false);
    expect(store.has(0, 2)).toBe(true);
    expect(store.bytes).toBe(store.count('lit') * store.chunkBytes(2));
    store.dispose();
  });
});

describe('the light sets (spec §8.9: the arena of oat-d has a lit and a dark bake)', () => {
  const darkDef = (): SectionStripsDef => stripsDef(4352, { height: 176, dark: [3968, 4480], darkFrom: 3500 });

  it('the dark bake is prefetched once the view passes darkFrom, within its 11 MB; at darkMix 1 the lit chunks inside go', () => {
    const store = createStripStore(darkDef(), { id: 'oat-d', width: 4352, seed: 1, scale: S_A }, { deferred: () => false });
    const range = chunksOfRange(3968, 4480, S_A);
    let x = 2800;
    for (; x + VIEW_W / 2 < 3500; x += 2) store.prepare(x, 2, 4);
    expect(store.count('dark')).toBe(0);
    for (; x <= 3400; x += 2) store.prepare(x, 2, 4);
    let darkChunks = 0;
    for (let cx = range.c0; cx <= range.c1; cx++) {
      if (!store.hasDark(cx)) continue;
      darkChunks++;
      expect(store.has(cx, 4, 'dark'), `dark ${cx}`).toBe(true);
    }
    expect(darkChunks).toBeGreaterThanOrEqual(2);
    expect(darkChunks).toBeLessThanOrEqual(3);
    expect(store.setBytes(1)).toBeLessThanOrEqual(STRIP_DARK_BUDGET_BYTES);
    expect(store.stats.peakLitBytes).toBeLessThanOrEqual(STRIP_BUDGET_BYTES);
    // Lit and dark differ (the placeholder's night: black brick, warm windows).
    const cx = range.c0 + 1;
    expect(store.chunk(cx, 4, 'dark')?.data).not.toEqual(store.chunk(cx, 4, 'lit')?.data);
    // The arena (3,968–4,352 plus 128): the cross-fade, then dark only.
    for (; x <= 3968; x += 2) store.prepare(x, 2, 4);
    store.darkMix = 0.5;
    store.prepare(x, 0, 4);
    const p0 = x * store.scale;
    const inside: number[] = [];
    for (let k = Math.floor(p0 / STRIP_CHUNK); k <= Math.floor((p0 + VIEW_W) / STRIP_CHUNK); k++) {
      if (store.hasDark(k)) inside.push(k);
      expect(store.frameOf(k, 4, 'lit'), `lit ${k} during the fade`).not.toBeNull();
    }
    expect(inside.length).toBeGreaterThan(0);
    store.darkMix = 1;
    store.prepare(x, 0, 4);
    const pStart = stripXOfU(3968, S_A);
    const pEnd = stripXOfU(4480, S_A);
    for (const k of inside) {
      expect(store.frameOf(k, 4, 'dark')).not.toBeNull();
      const wholly = k * STRIP_CHUNK >= pStart && (k + 1) * STRIP_CHUNK <= pEnd;
      expect(store.has(k, 4, 'lit'), `lit ${k} after the fade`).toBe(!wholly);
    }
    store.dispose();
  });

  it('a section without `dark` never paints a dark chunk', () => {
    const asked: StripLightSet[] = [];
    defineStripSource('lit-only', {
      plan: () => ({ height: 100, covers: () => true, bands: () => 1, paint: (_cx, _d, set) => void asked.push(set) }),
    });
    const store = createStripStore({ ...stripsDef(2048), source: 'lit-only' }, { id: 'lit', width: 2048, seed: 1 }, { deferred: () => false });
    store.darkMix = 1;
    for (let x = 0; x < 1600; x += 8) store.prepare(x, 8, 2);
    expect(asked.length).toBeGreaterThan(0);
    expect(asked.every((s) => s === 'lit')).toBe(true);
    store.dispose();
  });
});

describe('fail soft (an unknown or broken source never breaks the section)', () => {
  it('a band that throws stays empty (counted, warned once); a broken covers() gives no chunk', () => {
    let n = 0;
    defineStripSource('throws-band', {
      plan: () => ({
        height: 64,
        covers: () => true,
        bands: () => 2,
        paint(_cx, _d, _s, b, out) {
          n++;
          if (b === 1) throw new Error('band');
          out.data[0] = PAL.stone[2];
        },
      }),
    });
    const store = createStripStore({ ...stripsDef(512), source: 'throws-band' }, { id: 'tb', width: 512, seed: 1 }, { deferred: () => false });
    store.prepare(0, 0, 2);
    expect(n).toBeGreaterThan(0);
    expect(store.stats.failed).toBeGreaterThan(0);
    expect(store.has(0, 2)).toBe(true);
    store.dispose();
    defineStripSource('throws-covers', {
      plan: () => ({
        height: 64,
        covers: () => {
          throw new Error('covers');
        },
        bands: () => 1,
        paint() {},
      }),
    });
    const none = createStripStore({ ...stripsDef(512), source: 'throws-covers' }, { id: 'tc', width: 512, seed: 1 }, { deferred: () => false });
    none.prepare(0, 0, 2);
    expect(none.count()).toBe(0);
    none.dispose();
  });
});

describe('the placeholder source (until GRAMMAR’s `oat-facade` lands)', () => {
  it('palette-exact at 2× / 4× (PAL_HD ∪ PAL_HD_OAT), transparent above the gables, the same pixels every run', () => {
    for (const d of [2, 4] as StripDensity[]) {
      const a = createStripStore(stripsDef(1024, { height: 168 }), { id: 'oat-a', width: 1024, seed: 7, scale: S_A }, { deferred: () => false });
      const b = createStripStore(stripsDef(1024, { height: 168 }), { id: 'oat-a', width: 1024, seed: 7, scale: S_A }, { deferred: () => false });
      a.prepare(0, 0, d);
      b.prepare(0, 0, d);
      const buf = a.chunk(1, d) as PixelBuffer;
      expect(buf.data).toEqual(b.chunk(1, d)?.data);
      let clear = 0;
      for (const c of buf.data) {
        if (c === 0) clear++;
        else expect(inHdPalette(c), c.toString(16)).toBe(true);
      }
      expect(clear).toBeGreaterThan(0);
      // The base row is opaque (the houses stand on it).
      for (let x = 0; x < buf.w; x++) expect(buf.data[(buf.h - 1) * buf.w + x]).not.toBe(0);
      a.dispose();
      b.dispose();
    }
  });
});

describe('the view (view.ts: the strips at the façade depth; no strips = nothing)', () => {
  it('no section outside oat declares strips, and a view without them has no store and draws none', async () => {
    const { loadContent } = await import('../../src/game/content/index');
    const { getMission, listMissions } = await import('../../src/game/registry');
    await loadContent(() => true);
    let n = 0;
    for (const id of listMissions()) {
      // oat opts in (GRAMMAR's `oat-facade` source); every other mission must not.
      if (id === 'oat') continue;
      for (const s of Object.values(getMission(id)?.sections ?? {})) {
        n++;
        expect(s.strips, `${id}/${s.id}`).toBeUndefined();
      }
    }
    expect(n).toBeGreaterThan(20);
    const view = new SectionView(section('plain', 1024), new Terrain(section('plain', 1024).terrain), 1, 2);
    expect(view.strips).toBeNull();
    expect(liveStripStore('plain')).toBeUndefined();
    const sp = spy(2, 100);
    view.drawBack(sp.r, 0);
    expect(sp.draws.every((d) => d.buf.h !== 168 * 2)).toBe(true);
  });

  it('without a floor: chunks drawn 1:1 at strip x (s 1), the base on the walk line minus the depth; the cross-fade and the live binding', () => {
    const def = section('oat-view-test', 2048, stripsDef(2048, { height: 168, dark: [1024, 2048], darkFrom: 0 }));
    const view = new SectionView(def, new Terrain(def.terrain), 3, 2);
    const store = view.strips as StripStore;
    expect(store.scale).toBe(1);
    expect(liveStripStore('oat-view-test')).toBe(store);
    let sp = spy(2, 700);
    view.drawBack(sp.r, 0);
    // camX 700: strip x 700 … 1,084 = chunks 2, 3 and 4 on screen.
    let drawn = stripDraws(sp, store);
    expect(drawn.map((d) => d.x)).toEqual([512, 768, 1024]);
    for (const d of drawn) {
      expect(d.y).toBe(176 - 16 - 168);
      expect(d.alpha).toBe(1);
    }
    expect(drawn[0].buf).toBe(store.chunk(2, 2));
    // The cross-fade: lit, then the dark bake over it at the mix (inside the dark range only).
    setStripDarkMix('oat-view-test', 0.25);
    expect(store.darkMix).toBe(0.25);
    sp = spy(2, 1100);
    view.drawBack(sp.r, 0);
    drawn = stripDraws(sp, store);
    const at = drawn.map((d) => `${d.x}:${d.alpha}:${d.buf === store.chunk(d.x / 256, 2, 'dark') ? 'dark' : 'lit'}`);
    expect(at).toEqual(['1024:1:lit', '1024:0.25:dark', '1280:1:lit', '1280:0.25:dark']);
    setStripDarkMix('oat-view-test', 7);
    expect(store.darkMix).toBe(1);
    view.dispose();
    expect(liveStripStore('oat-view-test')).toBeUndefined();
    expect(store.bytes).toBe(0);
  });

  it('with a floor: at the floor’s scale for the depth, where a decor item at that depth stands, lifted as the floor lifts it', () => {
    const def = section('oat-floor-test', 3072, stripsDef(3072, { height: 168 }));
    def.floor = debugFloorDef(def, 'oat');
    const view = new SectionView(def, new Terrain(def.terrain), 3, 4);
    const floor = view.floor;
    expect(floor).not.toBeNull();
    const store = view.strips as StripStore;
    expect(store.scale).toBeCloseTo(sAtDepth(floor!.cam, 16), 12);
    for (const camX of [0, 333.25, 1500]) {
      const sp = spy(4, camX);
      view.drawBack(sp.r, 0);
      const strips = stripDraws(sp, store);
      expect(strips.length).toBeGreaterThanOrEqual(2);
      for (const d of strips) {
        const cx = Math.round((d.x - camX * (1 - store.scale)) / STRIP_CHUNK);
        // The chunk's left edge = world x uOfStripX(cx · 256) at the depth (floor/cam.ts shiftX), to the renderer's grid.
        expect(Math.abs(d.x - shiftX(floor!.cam, uOfStripX(cx * STRIP_CHUNK, store.scale), 16, camX))).toBeLessThanOrEqual(1 / 8 + 1e-9);
        expect(Math.abs(d.y - (floor!.cam.yw - 16 - 168 - floor!.liftAt(1536, 16)))).toBeLessThanOrEqual(1 / 8 + 1e-9);
      }
    }
    view.dispose();
  });

  it('the browser start (deferred): `prepare` paints the 1× on screen and queues the dense chunks; the preload completes them', () => {
    setDeferHiArt(true);
    const prevTier = setArtTier(4);
    try {
      const def = section('oat-start-test', 2048, stripsDef(2048, { height: 168 }));
      const view = new SectionView(def, new Terrain(def.terrain), 3, 4);
      view.prepare(0, 0);
      const store = view.strips as StripStore;
      // The 1× on screen now; the dense one queued (at the density the strips drew last: 4, or 2 on a 2× res).
      expect(store.has(0, 1)).toBe(true);
      expect(store.pending(0, 4) || store.pending(0, 2)).toBe(true);
      while (runArtJobs(1e9) > 0);
      expect(store.frameOf(0, 4)?.density).toBeGreaterThanOrEqual(2);
      expect(store.has(0, 1)).toBe(false);
      // The first frame at res 4 queues the 4×.
      view.drawBack(spy(4, 0).r, 0);
      while (runArtJobs(1e9) > 0);
      expect(store.has(0, 4)).toBe(true);
      view.dispose();
    } finally {
      setArtTier(prevTier);
    }
  });

  it('the draw path allocates nothing per frame (Hard Rule 7; the heap-sampling pattern of floor-sections.test.ts)', async () => {
    const { Session } = await import('node:inspector/promises');
    const prevHi = setHiArt(true);
    // A short street whose chunks all stay resident while the camera pans over it: no paint, no eviction.
    const def = section('oat-alloc-test', 640, stripsDef(640, { height: 168, dark: [0, 640], darkFrom: 0 }));
    def.floor = debugFloorDef(def, 'oat');
    const view = new SectionView(def, new Terrain(def.terrain), 3, 2);
    const store = view.strips as StripStore;
    store.darkMix = 0.5;
    const { r } = spy(2, 0);
    const draws: number[] = [];
    (r as unknown as { frame: () => void }).frame = () => void draws.push(0);
    draws.length = 0;
    const drawStrips = (view as unknown as { drawStrips(r: Renderer, d: number): void }).drawStrips.bind(view);
    const pass = (x: number): void => {
      r.camX = x;
      drawStrips(r, 2);
      draws.length = 0;
    };
    const W = 640 - VIEW_W;
    for (let rep = 0; rep < 6; rep++) for (let x = 0; x < W; x += 3.25) pass(x);
    for (let x = W; x > 0; x -= 3.25) pass(x);
    const before = store.stats.built[1];
    type N = { selfSize: number; callFrame: { url: string; functionName: string }; children: N[] };
    let best = Infinity;
    let where: string[] = [];
    for (let attempt = 0; attempt < 3 && best / 600 >= 64; attempt++) {
      const ses = new Session();
      ses.connect();
      await ses.post('HeapProfiler.enable');
      await ses.post('HeapProfiler.startSampling', { samplingInterval: 1024 } as never);
      for (let i = 0; i < 600; i++) pass(((i * 7) % 600) * (W / 600));
      const { profile } = (await ses.post('HeapProfiler.stopSampling')) as unknown as { profile: { head: N } };
      ses.disconnect();
      let bytes = 0;
      const at: string[] = [];
      const walk = (n: N): void => {
        if (n.selfSize > 0 && /mission\/(strips\/|view\.ts|floor\/place\.ts)/.test(n.callFrame.url)) {
          bytes += n.selfSize;
          at.push(`${n.callFrame.functionName} ${n.selfSize}`);
        }
        for (const c of n.children) walk(c);
      };
      walk(profile.head);
      if (bytes < best) {
        best = bytes;
        where = at;
      }
    }
    expect(store.stats.built[1], 'nothing was painted while sampling').toBe(before);
    expect(best / 600, `bytes per frame in the strips' code: ${where.join(', ')}`).toBeLessThan(64);
    view.dispose();
    setHiArt(prevHi);
  }, 120_000);
});
