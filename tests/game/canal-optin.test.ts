/**
 * The canal opt-in (docs/api/canal.md): a section without `canal` draws exactly as before whatever
 * the canal state; with it, the switch off (`setCanal(false)`, `?canal=0`) and a missing file both
 * draw the old scenery (a missing file: one warning); a canal section builds none of the old
 * scenery (background layers, terrain chunks, floor textures, row frames) and holds only its tiles;
 * the tier-4 working set of a canal section leaves out the decor sprites the scene paints.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SoftRenderer } from '../../src/engine/render-soft';
import { setArtTier, setDeferHiArt, setHiArt } from '../../src/engine/sprites';
import { Terrain } from '../../src/engine/terrain';
import { isAms2Content, isLazyContent, loadContent } from '../../src/game/content/index';
import { canalBytes, drawnArt, resetCanalStore, setCanal, setCanalSource, type CanalSource } from '../../src/game/mission/canal/index';
import type { SectionDef } from '../../src/game/mission/types';
import { SectionView } from '../../src/game/mission/view';
import { getMission } from '../../src/game/registry';
import { DENSE_BUDGET_BYTES } from '../../src/game/scenes/gameplay';
import { nodeCanalSource } from '../../tools/lib/canal-source';

function frame(def: SectionDef, camX: number, res = 1): Uint32Array {
  const view = new SectionView(def, new Terrain(def.terrain), 7, 4);
  const r = new SoftRenderer(384, 216, undefined, { res });
  r.setCamera(camX, 0);
  view.prepare(camX, 0);
  r.begin();
  view.drawBack(r, 0);
  view.drawFront(r, 0);
  r.end();
  view.dispose();
  return r.target.data.slice();
}

const same = (a: Uint32Array, b: Uint32Array): boolean => a.length === b.length && a.every((v, i) => v === b[i]);

function section(id: string): SectionDef {
  const def = getMission('ams')?.sections[id];
  if (!def) throw new Error(`no ams section ${id}`);
  return def;
}

describe('canal opt-in', () => {
  beforeAll(async () => {
    await loadContent((id) => !isLazyContent(id) || isAms2Content(id));
    setHiArt(true);
    setDeferHiArt(false);
  });
  afterEach(() => {
    setCanal(true);
    setCanalSource(null);
    resetCanalStore();
    setArtTier(2);
  });

  it('every ams section opts in; sections without it draw the same with a source, without one and with the switch off (ams2 a, c2; oldenzaal oz-a)', () => {
    for (const id of ['a', 'b', 'c', 'c1', 'c2', 'd']) expect(section(id).canal?.scene).toBe(`ams/${id}`);
    setArtTier(2);
    const defs = [getMission('ams2')?.sections.a, getMission('ams2')?.sections.c2, getMission('oldenzaal')?.sections['oz-a']] as SectionDef[];
    for (const def of defs) {
      expect(def).toBeTruthy();
      expect(def.canal).toBeUndefined();
      setCanalSource(null);
      const plain = frame(def, 600, 2);
      setCanalSource(nodeCanalSource());
      expect(same(frame(def, 600, 2), plain)).toBe(true);
      setCanal(false);
      expect(same(frame(def, 600, 2), plain)).toBe(true);
      setCanal(true);
    }
  });

  it('ams a: the switch off and no source both draw the old scenery; on, the scene', () => {
    setArtTier(2);
    const a = section('a');
    expect(a.canal?.scene).toBe('ams/a');
    const old = frame(a, 600, 2);
    setCanalSource(nodeCanalSource());
    const scene = frame(a, 600, 2);
    expect(same(scene, old)).toBe(false);
    setCanal(false);
    expect(same(frame(a, 600, 2), old)).toBe(true);
  });

  it('a missing file: the old scenery and one warning', () => {
    setArtTier(1);
    const a = section('a');
    const old = frame(a, 0);
    const base = nodeCanalSource();
    const broken: CanalSource = {
      read: base.read,
      readSync: (p) => {
        if (p.includes('-w0-')) throw new Error(`ENOENT ${p}`);
        return (base.readSync as (p: string) => Uint8Array)(p);
      },
      inflateSync: base.inflateSync,
    };
    setCanalSource(broken);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(same(frame(a, 0), old)).toBe(true);
      expect(same(frame(a, 0), old)).toBe(true);
      expect(warn.mock.calls.filter((c) => String(c[0]).startsWith('[canal]')).length).toBe(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('ams a at tier 4 builds none of the old scenery and holds only its window of tiles', () => {
    setArtTier(4);
    setCanalSource(nodeCanalSource());
    const a = section('a');
    const view = new SectionView(a, new Terrain(a.terrain), 7, 4);
    const r = new SoftRenderer(384, 216, undefined, { res: 4 });
    let peak = 0;
    for (let cx = 0; cx <= 3200; cx += 32) {
      r.setCamera(cx, 0);
      if (cx === 0) view.prepare(cx, 0);
      r.begin();
      view.drawBack(r, cx);
      view.drawFront(r, cx);
      peak = Math.max(peak, canalBytes().cpu);
    }
    expect(view.canal?.failed).toBe(false);
    // No terrain chunk, no dense layer or chunk, no floor texture, no row frame was built.
    expect(view.generated).toBe(0);
    expect(view.hiGenerated).toBe(0);
    const floor = view.floor;
    expect(floor).not.toBeNull();
    const rowPx = (floor?.rows ?? []).reduce((n, row) => n + [...row.frames.values()].reduce((m, e) => m + (e.f ? e.f.buf.w * e.f.buf.h : 0), 0), 0);
    expect(rowPx).toBe(0);
    // The floor's store holds the entity kinds' face tiles only (the entity passes), never a chunk.
    for (let k = -1; k <= Math.ceil(a.width / 256) + 1; k++) for (const d of [1, 2, 4]) expect(floor?.store.hasChunk(k, d)).toBe(false);
    expect(floor?.store.bytes() ?? 0).toBeLessThan(1024 * 1024);
    // The window: well under the whole section (23.8 M px at tier 4) and inside the budget's room.
    console.log(`[canal] ams a tier 4: peak resident tiles ${(peak / 1e6).toFixed(1)} MB (CPU buffers, headless)`);
    // Measured 2026-11-11: 13.4 M px (51 MiB) with AHEAD 384; the bound leaves the section agents room.
    expect(peak).toBeLessThan(80 * 1024 * 1024);
    expect(peak).toBeLessThan(DENSE_BUDGET_BYTES / 3);
    view.dispose();
    expect(canalBytes().cpu).toBe(0);
  });

  it('the art a canal section draws leaves out its decor sprites, keeps its entities', () => {
    const a = section('a');
    setCanalSource(nodeCanalSource());
    const art = drawnArt(a);
    expect(art).toContain('decor/ams/ams-bike-rack');
    expect(art).toContain('decor/ams/ams-tulip-stall');
    expect(art).not.toContain('decor/ams/elm');
    expect(art).not.toContain('decor/ams/lamp');
    setCanal(false);
    expect(drawnArt(a)).toEqual(a.art);
    setCanal(true);
    // A decor sprite the scene lists as a canal sprite stays: b's vendor draws the stand front over himself.
    const b = section('b');
    expect(b.decor?.some((d) => d.sprite === 'decor/ams/hotdog-front')).toBe(true);
    expect(drawnArt(b)).toContain('decor/ams/hotdog-front');
    expect(drawnArt(b)).not.toContain('decor/ams/hotdog-stand');
    // Sections without a scene: their art.
    for (const def of [getMission('ams2')?.sections.b, getMission('oldenzaal')?.sections['oz-a']] as SectionDef[]) expect(drawnArt(def)).toEqual(def.art);
  });
});
