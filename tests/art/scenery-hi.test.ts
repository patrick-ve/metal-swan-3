/**
 * 2× scenery (docs/ARCHITECTURE.md §3, docs/ART_GUIDE.md "2x backgrounds and terrain"): background
 * layers with a 2× generator and terrain with 2× materials, drawn only by a view of density 2
 * (mission ams) at res ≥ 2.
 *
 * - The 1× scenery of every mission is byte-identical to before (hashes in
 *   fixtures/scenery-1x.json: every layer buffer, every terrain chunk, and drawn frames at res 1
 *   and res 2 — ams also at density 2 on res 1, where the 1× scenery is drawn). Regenerate only
 *   on purpose: UPDATE_SCENERY_FIXTURE=1 npx vitest run tests/art/scenery-hi.test.ts.
 * - The ams 2× layer and terrain material have the 1× geometry (size, opaque footprint), are
 *   palette-only and deterministic, and no 2× scenery falls back to 1× (hiSceneryErrors).
 * - Renderers: a density-2 parallax layer tiles by its logical size and at res 1 shows lowRes.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { INK, PAL } from '../../src/engine/palette';
import { PixelBuffer } from '../../src/engine/pixel';
import { lowRes } from '../../src/engine/render-common';
import { SoftRenderer } from '../../src/engine/render-soft';
import {
  artPreloadActive,
  cancelArtJobs,
  pendingArtJobs,
  preloadSprites,
  queueArtJob,
  runArtJobs,
  setDeferHiArt,
  setHiArt,
  withArtDensity,
} from '../../src/engine/sprites';
import { Terrain } from '../../src/engine/terrain';
import {
  getBgGenerator,
  getTerrainPainter,
  hasHiBgGenerator,
  hasHiTerrain,
  hiSceneryErrors,
  listHiBgGenerators,
  makeHiBgLayer,
  makeHiTerrain,
} from '../../src/game/art/art-registry';
import { loadContent } from '../../src/game/content/index';
import { CHUNK, SectionView } from '../../src/game/mission/view';
import type { SectionDef } from '../../src/game/mission/types';
import { getMission, listMissions } from '../../src/game/registry';

const FIXTURE = join(__dirname, 'fixtures', 'scenery-1x.json');

/** Background generators with 2× art (every one must build without a 1× fallback). */
const HI_BG = ['ams-skyline'];

function hash(bufs: readonly (PixelBuffer | null)[]): string {
  const h = createHash('sha1');
  for (const b of bufs) {
    if (!b) {
      h.update('null;');
      continue;
    }
    h.update(`${b.w}x${b.h};`);
    h.update(new Uint8Array(b.data.buffer, b.data.byteOffset, b.data.byteLength));
  }
  return h.digest('hex').slice(0, 16);
}

/** Every palette colour (and INK). */
function paletteSet(): Set<number> {
  const s = new Set<number>([INK >>> 0]);
  for (const r of Object.values(PAL)) if (Array.isArray(r)) for (const c of r) s.add((c as number) >>> 0);
  return s;
}

/** Logical opaque mask of a buffer of density d: a logical pixel is opaque if any sub-pixel is. */
function mask(b: PixelBuffer, d: number): Uint8Array {
  const w = b.w / d;
  const h = b.h / d;
  const m = new Uint8Array(w * h);
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if ((b.data[y * b.w + x] & 255) !== 0) m[Math.floor(y / d) * w + Math.floor(x / d)] = 1;
  return m;
}

/** The section without decor (scenery only: decor sprites have their own 2× tests). */
function bare(def: SectionDef): SectionDef {
  return { ...def, decor: [] };
}

/** A view's private layer buffers (1×). */
function layerBufs(view: SectionView): (PixelBuffer | null)[] {
  const v = view as unknown as { layers: unknown[]; layerBuf(i: number): PixelBuffer | null };
  return v.layers.map((_, i) => v.layerBuf(i));
}

function drawHash(view: SectionView, res: number, density: number, x: number, y: number): string {
  const r = new SoftRenderer(undefined, undefined, undefined, { res });
  r.begin(view.sky);
  r.setCamera(x, y);
  withArtDensity(density, () => {
    view.drawBack(r, 77);
    view.drawFront(r, 77);
  });
  r.end();
  return hash([r.target]);
}

describe('2× scenery', () => {
  beforeAll(async () => {
    await loadContent();
  });

  it('keeps the 1× scenery of every mission byte-identical', { timeout: 120_000 }, () => {
    const prevHi = setHiArt(false);
    const got: Record<string, string> = {};
    try {
      for (const mid of listMissions()) {
        const m = getMission(mid);
        if (!m) continue;
        for (const [sid, def0] of Object.entries(m.sections)) {
          const def = bare(def0);
          const view = new SectionView(def, new Terrain(def.terrain), 4242);
          got[`${mid}/${sid}/layers`] = hash(layerBufs(view));
          const chunks: (PixelBuffer | null)[] = [];
          for (let cy = 0; cy * CHUNK < def.height + CHUNK; cy++) for (let cx = 0; cx * CHUNK < def.width + CHUNK; cx++) chunks.push(view.chunk(cx, cy));
          got[`${mid}/${sid}/chunks`] = hash(chunks);
          const x = Math.max(0, def.width * 0.4 + 0.37);
          const y = Math.max(0, def.height - 216) * 0.5 + 0.5;
          got[`${mid}/${sid}/draw@1`] = drawHash(view, 1, 1, x, y);
          got[`${mid}/${sid}/draw@2`] = drawHash(view, 2, 1, x, y);
        }
      }
    } finally {
      setHiArt(prevHi);
    }
    // ams at density 2 on res 1 draws its 1× scenery (the exact image), with 2× art switched on.
    const ams = getMission('ams');
    expect(ams).toBeDefined();
    for (const [sid, def0] of Object.entries(ams?.sections ?? {})) {
      const def = bare(def0);
      const view = new SectionView(def, new Terrain(def.terrain), 4242, 2);
      const x = Math.max(0, def.width * 0.4 + 0.37);
      const y = Math.max(0, def.height - 216) * 0.5 + 0.5;
      expect(drawHash(view, 1, 2, x, y), `ams/${sid} density 2 at res 1`).toBe(got[`ams/${sid}/draw@1`]);
    }
    if (process.env.UPDATE_SCENERY_FIXTURE === '1' || !existsSync(FIXTURE)) {
      writeFileSync(FIXTURE, JSON.stringify(got, null, 1) + '\n');
    }
    const want = JSON.parse(readFileSync(FIXTURE, 'utf8')) as Record<string, string>;
    expect(got).toEqual(want);
  });

  it('lists the ams 2× background layers', () => {
    for (const id of HI_BG) expect(hasHiBgGenerator(id), id).toBe(true);
    expect(listHiBgGenerators()).toEqual(expect.arrayContaining(HI_BG));
  });

  it('2× layers: twice the size, the 1× footprint, palette only, deterministic, seamless', () => {
    const pal = paletteSet();
    for (const id of HI_BG) {
      for (const light of ['morning', 'noon', 'golden', 'sunset']) {
        const params = { light, y: 0.52 };
        const one = getBgGenerator(id)(768, 216, params, 9);
        const hi = makeHiBgLayer(id, 768, 216, params, 9);
        expect(hi, id).not.toBeNull();
        if (!hi) continue;
        expect([hi.w, hi.h]).toEqual([1536, 432]);
        expect(Array.from(hi.data)).toEqual(Array.from((makeHiBgLayer(id, 768, 216, params, 9) as PixelBuffer).data));
        for (const c of hi.data) if ((c & 255) !== 0) expect(pal.has(c >>> 0), `${id} colour ${(c >>> 0).toString(16)}`).toBe(true);
        // Same design: the logical opaque footprints agree almost everywhere.
        const a = mask(one, 1);
        const b = mask(hi, 2);
        let same = 0;
        for (let i = 0; i < a.length; i++) if (a[i] === b[i]) same++;
        expect(same / a.length, `${id} ${light} footprint`).toBeGreaterThan(0.99);
        // Real 2× detail: some 2 × 2 blocks are not flat.
        const flat = hi.downsampled(2).scaled(2);
        let diff = 0;
        for (let i = 0; i < hi.data.length; i++) if (hi.data[i] !== flat.data[i]) diff++;
        expect(diff, `${id} has 2× detail`).toBeGreaterThan(500);
        // Seamless: the wrap seam differs no more than the busiest column pair inside.
        const col = (x: number, x2: number): number => {
          let n = 0;
          for (let y = 0; y < hi.h; y++) if (hi.get(x, y) !== hi.get(x2, y)) n++;
          return n;
        };
        let worst = 0;
        for (let x = 0; x + 1 < hi.w; x++) worst = Math.max(worst, col(x, x + 1));
        expect(col(hi.w - 1, 0)).toBeLessThanOrEqual(worst);
      }
    }
  });

  it('2× terrain (ams klinker): the exact 1× geometry, palette only, finer detail', () => {
    const pal = paletteSet();
    const ams = getMission('ams');
    let built = 0;
    for (const [sid, def] of Object.entries(ams?.sections ?? {})) {
      const style = def.terrainStyle;
      expect(style && hasHiTerrain(style), `ams/${sid} has 2× terrain`).toBe(true);
      if (!style) continue;
      const t = new Terrain(def.terrain);
      const sample = (x: number, y: number) => t.cellAt(x, y);
      // Two chunks around the ground line of the section start.
      for (const [cx, cy] of [[0, Math.floor((def.height - 40) / CHUNK)], [1, Math.floor((def.height - 40) / CHUNK)]]) {
        const one = getTerrainPainter()(sample, style, cx * CHUNK, cy * CHUNK, CHUNK, CHUNK);
        const hi = makeHiTerrain(sample, style, cx * CHUNK, cy * CHUNK, CHUNK, CHUNK);
        if (one.countOpaque() === 0) continue;
        expect(hi, `ams/${sid} chunk ${cx},${cy}`).not.toBeNull();
        if (!hi) continue;
        built++;
        expect([hi.w, hi.h]).toEqual([CHUNK * 2, CHUNK * 2]);
        // Geometry (and so collision art) is exactly the 1× one: every 2 × 2 block is fully
        // opaque where the 1× pixel is opaque and fully clear where it is clear.
        for (let y = 0; y < CHUNK; y++) {
          for (let x = 0; x < CHUNK; x++) {
            const o = (one.data[y * CHUNK + x] & 255) !== 0;
            for (let s = 0; s < 4; s++) {
              const c = hi.data[(y * 2 + (s >> 1)) * hi.w + x * 2 + (s & 1)];
              if (((c & 255) !== 0) !== o) throw new Error(`ams/${sid} ${x},${y}: 2× opacity differs from 1×`);
            }
          }
        }
        for (const c of hi.data) if ((c & 255) !== 0) expect(pal.has(c >>> 0)).toBe(true);
        const flat = hi.downsampled(2).scaled(2);
        let diff = 0;
        for (let i = 0; i < hi.data.length; i++) if (hi.data[i] !== flat.data[i]) diff++;
        expect(diff, 'has 2× detail').toBeGreaterThan(1000);
      }
    }
    expect(built).toBeGreaterThan(3);
    // Styles without 2× materials get no 2× painter work at all.
    expect(hasHiTerrain({ ground: 'dirt', edge: 'grass', platform: 'metal', solid: 'crate' })).toBe(false);
  });

  it('a density-2 view draws the 2× scenery at res 2, with no 1× fallback', () => {
    const def = bare(getMission('ams')?.sections.a as SectionDef);
    const one = new SectionView(def, new Terrain(def.terrain), 7, 1);
    const two = new SectionView(def, new Terrain(def.terrain), 7, 2);
    const a = drawHash(one, 2, 2, 300.5, 0);
    const b = drawHash(two, 2, 2, 300.5, 0);
    expect(b).not.toBe(a);
    expect(two.hiGenerated).toBeGreaterThan(0);
    expect(one.hiGenerated).toBe(0);
    // With 2× art switched off (shot --art 1) the density-2 view draws the 1× image.
    const prev = setHiArt(false);
    try {
      const off = new SectionView(def, new Terrain(def.terrain), 7, 2);
      expect(drawHash(off, 2, 2, 300.5, 0)).toBe(a);
    } finally {
      setHiArt(prev);
    }
    expect(hiSceneryErrors()).toEqual([]);
  });

  it('deferred: 2× scenery becomes art jobs; 1× is drawn until they ran', () => {
    const def = bare(getMission('ams')?.sections.b as SectionDef);
    const prev = setDeferHiArt(true);
    try {
      const view = new SectionView(def, new Terrain(def.terrain), 3, 2);
      view.prepare(0, 0);
      expect(pendingArtJobs()).toBeGreaterThan(0);
      expect(view.hiGenerated).toBe(0);
      // dispose() drops the view's queued jobs.
      view.dispose();
      expect(pendingArtJobs()).toBe(0);
      const v2 = new SectionView(def, new Terrain(def.terrain), 3, 2);
      v2.prepare(0, 0);
      const first = drawHash(v2, 2, 2, 0, 0);
      // The draw itself ran jobs within its budget (no preload is running); finish the rest.
      while (pendingArtJobs() > 0) runArtJobs(1000);
      expect(v2.hiGenerated).toBeGreaterThan(0);
      const later = drawHash(v2, 2, 2, 0, 0);
      const fresh = new SectionView(def, new Terrain(def.terrain), 3, 1);
      expect(drawHash(fresh, 2, 2, 0, 0)).toBe(first);
      expect(later).not.toBe(first);
      cancelArtJobs('');
    } finally {
      setDeferHiArt(prev);
    }
  });
});

describe('art jobs', () => {
  it('a budgeted 2× preload runs the queued jobs before its sprite ids, in its budget', async () => {
    await loadContent();
    const ran: string[] = [];
    let active = false;
    let t = 0;
    queueArtJob('test/a', () => {
      ran.push('a');
      t += 5;
    });
    queueArtJob('test/b', () => {
      ran.push('b');
      active = artPreloadActive();
      t += 5;
    });
    // A key already queued keeps its first job.
    queueArtJob('test/a', () => ran.push('dup'));
    let yields = 0;
    const rep = await preloadSprites('item/crate', undefined, {
      density: 2,
      timeBudgetMs: 8,
      now: () => t,
      yieldFn: async () => {
        yields++;
        t += 1;
      },
    });
    expect(ran).toEqual(['a', 'b']);
    expect(active).toBe(true);
    expect(artPreloadActive()).toBe(false);
    expect(pendingArtJobs()).toBe(0);
    // The two jobs filled the first slice: the ids waited for the next one.
    expect(yields).toBeGreaterThan(0);
    expect(rep.failed).toEqual([]);
  });

  it('runArtJobs runs at least one job and stops at the budget', () => {
    let t = 0;
    const ran: number[] = [];
    for (let i = 0; i < 5; i++) {
      queueArtJob(`test/r${i}`, () => {
        ran.push(i);
        t += 3;
      });
    }
    expect(runArtJobs(5, () => t)).toBe(2);
    expect(runArtJobs(0, () => t)).toBe(1);
    cancelArtJobs('test/');
    expect(pendingArtJobs()).toBe(0);
    expect(ran).toEqual([0, 1, 2]);
  });
});

describe('renderers: density-2 parallax layers', () => {
  it('tile by the logical size; res 1 draws lowRes, res 2 the 2× pixels', () => {
    const hi = new PixelBuffer(8, 4);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) hi.set(x, y, x % 2 === 0 ? PAL.red[2] : PAL.sky[2]);
    const r1 = new SoftRenderer(16, 4, undefined, { res: 1 });
    r1.begin(0x000000ff);
    r1.parallax(hi, 0, 0, 0, 0, { density: 2 });
    const low = lowRes(hi, 2);
    for (let x = 0; x < 16; x++) expect(r1.target.get(x, 0)).toBe(low.get(x % 4, 0));
    const r2 = new SoftRenderer(16, 4, undefined, { res: 2 });
    r2.begin(0x000000ff);
    r2.parallax(hi, 0, 0, 0, 0, { density: 2 });
    for (let x = 0; x < 32; x++) expect(r2.target.get(x, 0)).toBe(hi.get(x % 8, 0));
    // Offsets stay logical: one logical px moves the layer by two 2× px at res 2.
    r2.begin(0x000000ff);
    r2.parallax(hi, 0, 0, 1, 0, { density: 2 });
    for (let x = 2; x < 32; x++) expect(r2.target.get(x, 0)).toBe(hi.get((x - 2) % 8, 0));
  });
});
