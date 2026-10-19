/**
 * Art tier 4 and density-4 frames (UHD art, docs/ARCHITECTURE.md §3):
 * - tier selection: `chooseTier` / `chooseTierRes` for integer display scales 1–16 in AUTO and
 *   with a forced tier (KMAX 8 at tier 4, 6 otherwise; tier 4 keeps 4 | k);
 * - the sprite registry at d 4: fallback 4 → 2 → 1 (never an upscale), one density-generic
 *   generator (`defineHdSprite`), generic validation labelled 'id@4x', the non-generating peek,
 *   tier-4 deferral (queue instead of generating) and `releaseDense`;
 * - the renderers: a 4× frame at k 8 is exact 2 × 2 blocks, at k 2 its 2× reduction, at k 1 its
 *   1× reduction (`drawDensity`, `reducedFor`);
 * - dense scenery registry at d 4, the runner's draw density min(mission, tier), packs at d 4,
 *   the frame-time governor, `?art=` and ART DETAIL.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { PixelBuffer, seededRand } from '../../src/engine/pixel';
import { PAL } from '../../src/engine/palette';
import type { Frame } from '../../src/engine/render';
import {
  chooseRes,
  chooseTier,
  chooseTierRes,
  drawDensity,
  FrameGovernor,
  KMAX,
  KMAX_TIER4,
  reducedFor,
  tierAtRes,
} from '../../src/engine/render-common';
import { SoftRenderer } from '../../src/engine/render-soft';
import { decodeSpritePack, encodeSpritePack } from '../../src/engine/sprite-pack';
import {
  artDensity,
  artTier,
  defineHdSprite,
  defineHiSprite,
  defineSprite,
  denseBytes,
  framesDensityAt,
  getFrame,
  getFrames,
  hasFramesAt,
  hasHiSprite,
  installFrames,
  listHiSprites,
  readyFrames,
  releaseDense,
  setArtDensity,
  setArtTier,
  setDeferDense,
  spriteErrors,
  takeDenseQueue,
  withArtDensity,
} from '../../src/engine/sprites';
import {
  bgDensityFor,
  defineBgGenerator,
  defineHdBgGenerator,
  defineHiBgGenerator,
  hasHiBgGenerator,
  hasHiTerrain,
  hiSceneryErrors,
  listHiBgGenerators,
  makeHiBgLayer,
  setHdTerrainPainter,
  terrainDensityFor,
} from '../../src/game/art/art-registry';
import { Terrain } from '../../src/engine/terrain';
import { CHUNK, SectionView } from '../../src/game/mission/view';
import type { SectionDef } from '../../src/game/mission/types';
import { parseLaunchParams } from '../../src/game/params';
import { artDetailHint, OPTION_ROWS, optionValue, stepOption } from '../../src/game/scenes/options';
import { artDetailTier, DEFAULT_SETTINGS, loadSettings } from '../../src/game/settings';
import { createHeadlessGame } from '../../src/sim/index';
import { MemoryStore } from '../../src/engine/storage';

const COLORS = [PAL.red[2], PAL.gold[3], PAL.navy[1], PAL.green[2], PAL.snow[3], PAL.sky[2]];

function noise(w: number, h: number, seed: number): PixelBuffer {
  const rnd = seededRand(seed);
  const b = new PixelBuffer(w, h);
  for (let i = 0; i < b.data.length; i++) b.data[i] = COLORS[Math.floor(rnd() * COLORS.length)] >>> 0;
  return b.touch();
}

afterEach(() => {
  setArtTier(2);
  setDeferDense(false);
  setArtDensity(1);
  takeDenseQueue();
});

describe('tier selection', () => {
  it('AUTO: tier 4 with k 8 from scale 8, tier 2 with k ≤ 6 from scale 2, tier 1 below', () => {
    const table: Array<[number, number, number]> = [];
    for (let s = 1; s <= 16; s++) {
      const r = chooseTierRes(s);
      table.push([s, r.tier, r.k]);
    }
    expect(table).toEqual([
      [1, 1, 1],
      [2, 2, 2],
      [3, 2, 3],
      [4, 2, 4],
      [5, 2, 5],
      [6, 2, 6],
      [7, 2, 6],
      [8, 4, 8],
      [9, 4, 8],
      [10, 4, 8],
      [11, 4, 8],
      [12, 4, 8],
      [13, 4, 8],
      [14, 4, 8],
      [15, 4, 8],
      [16, 4, 8],
    ]);
    expect(chooseTier(0.6)).toBe(1);
    expect(KMAX).toBe(6);
    expect(KMAX_TIER4).toBe(8);
  });

  it('forced tiers: 2× keeps k ≤ 6 at every scale; 4× keeps 4 | k and falls back 4 → 2 below scale 4', () => {
    for (let s = 1; s <= 16; s++) {
      const two = chooseTierRes(s, 2);
      expect(two.k, `2× s ${s}`).toBe(chooseRes(s, KMAX));
      expect(two.tier, `2× s ${s}`).toBe(s >= 2 ? 2 : 1);
      const four = chooseTierRes(s, 4);
      const k = s >= 8 ? 8 : s >= 4 ? 4 : s;
      expect([four.tier, four.k], `4× s ${s}`).toEqual([s >= 4 ? 4 : s >= 2 ? 2 : 1, k]);
      const one = chooseTierRes(s, 1);
      expect(one.tier).toBe(1);
    }
    // The GRAPHICS filter's factor still divides k at tier 4 (xbr 4 at k 8).
    expect(chooseTierRes(10, 0, 4).k).toBe(8);
    // A ?kmax cap.
    expect(chooseTierRes(10, 0, 1, 6)).toEqual({ tier: 2, k: 6 });
    expect(tierAtRes(4, 8)).toBe(4);
    expect(tierAtRes(4, 6)).toBe(2);
    expect(tierAtRes(4, 1)).toBe(1);
    expect(tierAtRes(2, 8)).toBe(2);
  });

  it('drawDensity: d > k falls back to the next lower density, not straight to 1', () => {
    expect([1, 2, 3, 4, 5, 6, 8].map((k) => drawDensity(4, k))).toEqual([1, 2, 2, 4, 4, 4, 4]);
    expect([1, 2, 3].map((k) => drawDensity(2, k))).toEqual([1, 2, 2]);
    const b = noise(16, 8, 3);
    expect(reducedFor(b, 4, 8)).toBe(b);
    const r2 = reducedFor(b, 4, 2);
    expect([r2.w, r2.h]).toEqual([8, 4]);
    expect(r2.get(3, 1)).toBe(b.get(6, 2));
    const r1 = reducedFor(b, 4, 1);
    expect([r1.w, r1.h]).toEqual([4, 2]);
    expect(r1.get(3, 1)).toBe(b.get(12, 4));
  });
});

describe('density-4 frames', () => {
  it('fallback 4 → 2 → 1, never an upscale; one generator serves d 2 and 4', () => {
    defineSprite('d4/only1', () => new PixelBuffer(4, 4).fill(PAL.red[2]));
    defineSprite('d4/two', () => new PixelBuffer(4, 4).fill(PAL.red[2]));
    defineHiSprite('d4/two', () => new PixelBuffer(8, 8).fill(PAL.gold[3]));
    const seen: number[] = [];
    defineSprite('d4/hd', () => new PixelBuffer(5, 3).fill(PAL.red[2]), { anchor: 'top-left', pts: { tip: [4, 1] } });
    defineHdSprite('d4/hd', (d) => {
      seen.push(d);
      return { buf: noise(5 * d, 3 * d, d), ox: 0, oy: 0, pts: { tip: [4, 1] } };
    });
    expect(getFrame('d4/only1', 0, 4).density ?? 1).toBe(1);
    expect(getFrame('d4/two', 0, 4).density).toBe(2);
    expect(getFrame('d4/two', 0, 2).density).toBe(2);
    const f4 = getFrame('d4/hd', 0, 4);
    const f2 = getFrame('d4/hd', 0, 2);
    expect([f4.density, f4.buf.w, f4.buf.h, f4.pts?.tip]).toEqual([4, 20, 12, [4, 1]]);
    expect([f2.density, f2.buf.w, f2.buf.h]).toEqual([2, 10, 6]);
    expect(seen.sort()).toEqual([2, 4]);
    expect(hasHiSprite('d4/hd', 4) && hasHiSprite('d4/hd', 2)).toBe(true);
    expect(hasHiSprite('d4/two', 4)).toBe(false);
    expect(listHiSprites(4, 'd4/')).toEqual(['d4/hd']);
    expect(listHiSprites('d4/', 4)).toEqual(['d4/hd']);
    expect(listHiSprites('d4/')).toEqual(['d4/hd', 'd4/two']);
    // The art density 4 is the default for getFrame while set (as the runner does at tier 4).
    withArtDensity(4, () => {
      expect(artDensity()).toBe(4);
      expect(getFrame('d4/hd', 0).density).toBe(4);
    });
  });

  it('validation is generic and labelled id@4x; a broken 4× generator falls back to the 2× frames', () => {
    defineSprite('d4/bad-size', () => new PixelBuffer(4, 4));
    defineHiSprite('d4/bad-size', () => new PixelBuffer(8, 8).fill(PAL.red[2]));
    defineHiSprite('d4/bad-size', () => new PixelBuffer(18, 16), 4);
    defineSprite('d4/bad-count', () => [new PixelBuffer(4, 4), new PixelBuffer(4, 4)]);
    defineHiSprite('d4/bad-count', () => [new PixelBuffer(16, 16)], 4);
    defineSprite('d4/bad-pts', () => ({ buf: new PixelBuffer(4, 4), ox: 2, oy: 4, pts: { a: [1, -2] } }));
    defineHiSprite('d4/bad-pts', () => ({ buf: new PixelBuffer(16, 16), ox: 2, oy: 4, pts: { a: [1, -3] }, density: 4 }), 4);
    expect(getFrame('d4/bad-size', 0, 4).density).toBe(2);
    expect(getFrame('d4/bad-count', 0, 4).density ?? 1).toBe(1);
    expect(getFrame('d4/bad-pts', 0, 4).density ?? 1).toBe(1);
    const errs = new Map(spriteErrors().map((e) => [e.id, e.error]));
    expect(errs.get('d4/bad-size@4x')).toMatch(/multiple of 4/);
    expect(errs.get('d4/bad-count@4x')).toMatch(/1 frames, the 1× sprite has 2/);
    expect(errs.get('d4/bad-pts@4x')).toMatch(/points differ/);
    expect(errs.has('d4/bad-size@2x')).toBe(false);
    // The peek knows the 4× art fell back.
    expect(framesDensityAt('d4/bad-size', 4)).toBe(2);
  });

  it('a 4× frame keeps the 1× logical geometry (re-framed, stray pixels cut)', () => {
    defineSprite('d4/geo', () => ({ buf: new PixelBuffer(6, 5), ox: 3, oy: 5 }));
    defineHiSprite('d4/geo', () => ({ buf: new PixelBuffer(32, 28).fill(PAL.red[2]), ox: 4, oy: 6, density: 4 }), 4);
    const base = getFrame('d4/geo', 0, 1);
    const f = getFrame('d4/geo', 0, 4);
    expect([f.buf.w / 4, f.buf.h / 4, f.ox, f.oy]).toEqual([base.buf.w, base.buf.h, base.ox, base.oy]);
  });

  it('peek, tier-4 deferral and release', () => {
    defineSprite('d4/lazy', () => new PixelBuffer(3, 3).fill(PAL.red[2]));
    let built4 = 0;
    defineHdSprite('d4/lazy', (d) => {
      if (d === 4) built4++;
      return noise(3 * d, 3 * d, 7 + d);
    });
    expect(hasFramesAt('d4/lazy', 4)).toBe(false);
    expect(hasFramesAt('d4/lazy', 2)).toBe(false);
    expect(framesDensityAt('d4/lazy', 4)).toBe(4);
    setDeferDense(true);
    expect(framesDensityAt('d4/lazy', 4)).toBe(2);
    // Deferred: the 2× frame is drawn and the id queued; no 4× generation.
    expect(getFrame('d4/lazy', 0, 4).density).toBe(2);
    expect(getFrame('d4/lazy', 0, 4).density).toBe(2);
    expect(built4).toBe(0);
    expect(takeDenseQueue()).toEqual(['d4/lazy']);
    expect(takeDenseQueue()).toEqual([]);
    // The pool installs the 4× frames (any density).
    const frames: Frame[] = [{ buf: noise(12, 12, 1), ox: 1, oy: 3, density: 4 }];
    expect(installFrames('d4/lazy', 4, frames)).toBe(true);
    expect(installFrames('d4/lazy', 4, frames)).toBe(false);
    expect(hasFramesAt('d4/lazy', 4)).toBe(true);
    expect(getFrame('d4/lazy', 0, 4)).toBe(frames[0]);
    expect(readyFrames('d4/lazy', 4)).toBe(frames);
    expect(built4).toBe(0);
    const before = denseBytes(4);
    expect(releaseDense(['d4/lazy', 'd4/none'], 4)).toBe(12 * 12 * 4);
    expect(denseBytes(4)).toBe(before - 12 * 12 * 4);
    expect(hasFramesAt('d4/lazy', 4)).toBe(false);
    expect(hasFramesAt('d4/lazy', 2)).toBe(true);
    setDeferDense(false);
    expect(getFrame('d4/lazy', 0, 4).density).toBe(4);
    expect(built4).toBe(1);
  });

  it('sprite packs carry density-4 frames', async () => {
    defineSprite('d4/pack', () => new PixelBuffer(3, 2));
    defineHiSprite('d4/pack', () => ({ buf: noise(12, 8, 9), ox: 1, oy: 2, pts: undefined, density: 4 }), 4);
    const frames = getFrames('d4/pack', 4);
    const gz = await encodeSpritePack('t', 4, [['d4/pack', frames]], async () => {});
    const pack = await decodeSpritePack(gz);
    expect(pack.density).toBe(4);
    const [id, got] = pack.sprites[0];
    expect(id).toBe('d4/pack');
    expect(got[0].density).toBe(4);
    expect(Array.from(got[0].buf.data)).toEqual(Array.from(frames[0].buf.data));
  });
});

describe('renderers at density 4', () => {
  it('k 8: every 4× pixel is a 2 × 2 block; k 2 and k 1 draw the 2× / 1× reduction', () => {
    const hi = noise(16, 12, 11);
    const f4: Frame = { buf: hi, ox: 1, oy: 3, density: 4 };
    for (const flipX of [false, true]) {
      const r = new SoftRenderer(24, 16, undefined, { res: 8, subpixel: 'all' });
      r.begin(0);
      r.frame(f4, 5, 6, { flipX });
      // Expected: the 4× buffer enlarged 2× with its anchor pixel on (5, 6) · 8.
      const want = new SoftRenderer(24, 16, undefined, { res: 8, subpixel: 'all' });
      want.begin(0);
      want.frame({ buf: hi.resized(32, 24), ox: 1, oy: 3, density: 8 }, 5, 6, { flipX });
      expect(Array.from(r.target.data)).toEqual(Array.from(want.target.data));
    }
    for (const k of [1, 2]) {
      const a = new SoftRenderer(24, 16, undefined, { res: k });
      const b = new SoftRenderer(24, 16, undefined, { res: k });
      a.begin(0);
      b.begin(0);
      a.frame(f4, 5, 6, { flipY: true });
      b.frame({ buf: hi.downsampled(4 / k), ox: 1, oy: 3, density: k }, 5, 6, { flipY: true });
      expect(Array.from(a.target.data), `k ${k}`).toEqual(Array.from(b.target.data));
    }
  });
});

describe('scenery at density 4', () => {
  it('per-density background generators: exact density, fallback order, size check labelled @4x', () => {
    defineBgGenerator('d4bg/a', (w, h) => new PixelBuffer(w, h));
    defineHdBgGenerator('d4bg/a', (w, h, _p, _s, d) => new PixelBuffer(w * d, h * d).fill(d === 4 ? PAL.red[2] : PAL.gold[3]));
    defineBgGenerator('d4bg/b', (w, h) => new PixelBuffer(w, h), { hi: (w, h) => new PixelBuffer(2 * w, 2 * h) });
    defineHiBgGenerator('d4bg/c', (w, h) => new PixelBuffer(w * 3, h * 4), 4);
    expect(hasHiBgGenerator('d4bg/a', 4) && hasHiBgGenerator('d4bg/a', 2)).toBe(true);
    expect([bgDensityFor('d4bg/a', 4), bgDensityFor('d4bg/b', 4), bgDensityFor('d4bg/b', 1), bgDensityFor('d4bg/none', 4)]).toEqual([4, 2, 1, 1]);
    expect(listHiBgGenerators(4).filter((id) => id.startsWith('d4bg/'))).toEqual(['d4bg/a', 'd4bg/c']);
    const l4 = makeHiBgLayer('d4bg/a', 10, 6, {}, 1, 4);
    expect([l4?.w, l4?.h, l4?.get(0, 0)]).toEqual([40, 24, PAL.red[2] >>> 0]);
    expect(makeHiBgLayer('d4bg/b', 10, 6, {}, 1, 4)).toBeNull();
    expect(makeHiBgLayer('d4bg/c', 10, 6, {}, 1, 4)).toBeNull();
    expect(hiSceneryErrors().find((e) => e.id === 'bg:d4bg/c@4x')?.error).toMatch(/expected 40×24/);
  });
});

describe('SectionView at density 4', () => {
  const W = CHUNK * 6;
  const def: SectionDef = {
    id: 'd4',
    width: W,
    height: 216,
    scroll: 'right',
    background: { sky: PAL.sky[2], layers: [{ gen: 'd4view/bg', factorX: 0.5, width: 64, height: 40 }] },
    terrain: { bounds: { x: 0, y: 0, w: W, h: 216 }, ground: [[[0, 180], [W, 180]]], platforms: [], solids: [], hazards: [] },
    terrainStyle: { ground: 'd4view-ground' },
    playerStart: { x: 40, y: 180 },
    *script() {},
  };
  it('draws 4× layers and chunks at tier 4 on k 8, 2× / 1× below; releases chunks behind the camera', () => {
    defineBgGenerator('d4view/bg', (w, h) => new PixelBuffer(w, h).fill(PAL.navy[1]));
    defineHdBgGenerator('d4view/bg', (w, h, _p, _s, d) => new PixelBuffer(w * d, h * d).fill(d === 4 ? PAL.red[2] : PAL.gold[3]));
    // 4× terrain only (a style without 2× terrain falls back to 1× at tier 2).
    setHdTerrainPainter(
      (sample, _style, x0, y0, w, h, d) => {
        const b = new PixelBuffer(w * d, h * d);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (sample(x0 + x, y0 + y) !== 0) b.rect(x * d, y * d, d, d, PAL.green[2]);
        return b;
      },
      (style, d) => style.ground === 'd4view-ground' && d === 4,
      [4],
    );
    const style = def.terrainStyle;
    expect([hasHiTerrain(style, 4), hasHiTerrain(style, 2), terrainDensityFor(style, 4), terrainDensityFor(style, 2)]).toEqual([true, false, 4, 1]);
    const view = new SectionView(def, new Terrain(def.terrain), 5, 4);
    const shot = (k: number, x: number): SoftRenderer => {
      const r = new SoftRenderer(undefined, undefined, undefined, { res: k });
      r.begin(view.sky);
      r.setCamera(x, 0);
      view.drawBack(r, 0);
      view.drawFront(r, 0);
      r.end();
      return r;
    };
    setArtTier(4);
    expect(view.drawDensity()).toBe(4);
    let r = shot(8, 0);
    // Layer at 4× (red), terrain at 4× (green, from the 4× painter).
    expect(r.target.get(5, 5)).toBe(PAL.red[2] >>> 0);
    expect(r.target.get(5, 200 * 8)).toBe(PAL.green[2] >>> 0);
    expect(view.hiChunkCount(4)).toBeGreaterThan(0);
    // k 6 cannot show 4×: the 2× layer (gold); terrain has no 2× art → 1×.
    r = shot(6, 0);
    expect(r.target.get(5, 5)).toBe(PAL.gold[3] >>> 0);
    setArtTier(2);
    expect(view.drawDensity()).toBe(2);
    r = shot(8, 0);
    expect(r.target.get(5, 5)).toBe(PAL.gold[3] >>> 0);
    // Scrolling forward releases the dense chunks behind the camera.
    setArtTier(4);
    for (let x = 0; x <= CHUNK * 4; x += CHUNK / 2) shot(8, x);
    expect(view.evicted).toBeGreaterThan(0);
  });
});

describe('the mission draws at min(artDensity, tier)', () => {
  it('ams is a tier-4 mission; tier 2 (default) draws 2×, tier 4 draws 4×; logic sees 1', async () => {
    expect(artTier()).toBe(2);
    const game = await createHeadlessGame({ missionId: 'ams', sectionId: 'a', seed: 1, god: true });
    try {
      const runner = game.runner;
      expect(runner?.maxArtDensity).toBe(4);
      expect(runner?.artDensity).toBe(2);
      setArtTier(4);
      expect(runner?.artDensity).toBe(4);
      setArtTier(1);
      expect(runner?.artDensity).toBe(1);
      setArtTier(4);
      game.step(5);
      expect(artDensity()).toBe(1);
    } finally {
      game.dispose();
    }
  }, 60_000);
});

describe('governor, ?art= and ART DETAIL', () => {
  it('the governor trips once when tier-4 frames average over 8 ms for 2 s', () => {
    const g = new FrameGovernor();
    let t = 0;
    // Fast frames: never trips.
    for (let i = 0; i < 300; i++) expect(g.sample(3, (t += 16.7), 4)).toBe(false);
    // Slow frames at tier 2 do not count.
    for (let i = 0; i < 300; i++) expect(g.sample(20, (t += 16.7), 2)).toBe(false);
    let trips = 0;
    for (let i = 0; i < 300; i++) if (g.sample(12, (t += 16.7), 4)) trips++;
    expect(trips).toBe(1);
    expect(g.tripped).toBe(true);
    expect(g.trippedMs).toBeGreaterThan(8);
    for (let i = 0; i < 300; i++) expect(g.sample(30, (t += 16.7), 4)).toBe(false);
  });

  it('?art=1|2|4 and the ART DETAIL option', () => {
    expect(parseLaunchParams('?art=4').art).toBe(4);
    expect(parseLaunchParams('?art=2').art).toBe(2);
    expect(parseLaunchParams('?art=3').art).toBeUndefined();
    expect('art' in parseLaunchParams('?mission=ams')).toBe(false);
    expect(DEFAULT_SETTINGS.artDetail).toBe('auto');
    const s = { ...DEFAULT_SETTINGS };
    expect(OPTION_ROWS.map((r) => r.id)).toContain('artDetail');
    const seen = [optionValue(s, 'artDetail')];
    for (let i = 0; i < 4; i++) {
      stepOption(s, 'artDetail', 1);
      seen.push(optionValue(s, 'artDetail'));
    }
    expect(seen).toEqual(['AUTO', '4X', '2X', '1X', 'AUTO']);
    expect([artDetailTier('auto'), artDetailTier(4)]).toEqual([0, 4]);
    expect(artDetailHint('auto', 4)).toBe('AUTO: 4X ART');
    expect(artDetailHint(4, 2)).toBe('4X NEEDS A LARGER WINDOW: 2X');
    expect(artDetailHint(2, 4)).toBe('');
    // Saved and repaired.
    const store = new MemoryStore();
    store.set('settings', JSON.stringify({ artDetail: 4 }));
    expect(loadSettings(store).artDetail).toBe(4);
    store.set('settings', JSON.stringify({ artDetail: 3 }));
    expect(loadSettings(store).artDetail).toBe('auto');
  });
});

describe('preload at density 4', () => {
  it('makes each id at the highest density it has; deferred 4× ids are queued with their 2× frames made', async () => {
    defineSprite('d4pre/a', () => new PixelBuffer(2, 2).fill(PAL.red[2]));
    defineHdSprite('d4pre/a', (d) => new PixelBuffer(2 * d, 2 * d).fill(PAL.red[2]));
    defineSprite('d4pre/b', () => new PixelBuffer(2, 2).fill(PAL.red[2]));
    defineHiSprite('d4pre/b', () => new PixelBuffer(4, 4).fill(PAL.red[2]));
    const { preloadSprites } = await import('../../src/engine/sprites');
    setDeferDense(true);
    const rep = await preloadSprites('d4pre/', undefined, { density: 4, yieldFn: async () => {} });
    expect(rep).toEqual({ total: 2, failed: [] });
    expect([hasFramesAt('d4pre/a', 4), hasFramesAt('d4pre/a', 2), hasFramesAt('d4pre/b', 2)]).toEqual([false, true, true]);
    expect(takeDenseQueue()).toEqual(['d4pre/a']);
    setDeferDense(false);
    await preloadSprites('d4pre/', undefined, { density: 4, yieldFn: async () => {} });
    expect(hasFramesAt('d4pre/a', 4)).toBe(true);
  });
});

describe('4× through the art pool', () => {
  it('UHD kit frames built by the pool (in-process port, deferral on) are byte-identical to main-thread frames', async () => {
    const { ArtPool, createArtWorkerHandler, inProcessPort } = await import('../../src/engine/art-pool');
    const { HdCanvas } = await import('../../src/game/art/hd/index');
    const { PAL_HD } = await import('../../src/engine/palette-hd');
    const draw = (d: number): Frame => {
      const c = new HdCanvas(12, 16, d);
      const skin = c.material({ ramp: PAL_HD.skinA, spec: 0.4 });
      const cloth = c.material({ ramp: PAL_HD.olive });
      c.capsule(6, 7, 6, 14, 2.6, 2.2, { mat: cloth });
      c.ellipsoid(6, 4, 3.2, 3.4, { mat: skin });
      return { buf: c.render({ outline: 'A' }), ox: 6, oy: 16, pts: { head: [6, 4] } };
    };
    defineSprite('d4pool/kit', () => ({ buf: new PixelBuffer(12, 16).fill(PAL.red[2]), ox: 6, oy: 16, pts: { head: [6, 4] } }));
    defineHdSprite('d4pool/kit', draw);
    const ref4 = getFrame('d4pool/kit', 0, 4);
    const ref2 = getFrame('d4pool/kit', 0, 2);
    expect([ref4.density, ref4.buf.w, ref4.buf.h]).toEqual([4, 48, 64]);
    const want4 = Array.from(ref4.buf.data);
    const want2 = Array.from(ref2.buf.data);
    releaseDense(['d4pool/kit'], 4);
    releaseDense(['d4pool/kit'], 2);
    // The browser at tier 4 defers on the main thread; the worker side must still build.
    setDeferDense(true);
    const pool = new ArtPool([inProcessPort(createArtWorkerHandler(async () => {}))]);
    const r = await pool.build(['d4pool/kit'], 4);
    expect(r.failed).toEqual([]);
    expect(r.installed).toBe(1);
    expect(hasFramesAt('d4pool/kit', 4)).toBe(true);
    const got = readyFrames('d4pool/kit', 4)![0];
    expect([got.density, got.ox, got.oy, got.pts?.head]).toEqual([4, 6, 16, [6, 4]]);
    expect(Array.from(got.buf.data)).toEqual(want4);
    await pool.build(['d4pool/kit'], 2);
    expect(Array.from(readyFrames('d4pool/kit', 2)![0].buf.data)).toEqual(want2);
    // Drawing at tier 4 now uses the installed 4× frame and queues nothing.
    expect(getFrame('d4pool/kit', 0, 4).density).toBe(4);
    expect(takeDenseQueue()).toEqual([]);
    setDeferDense(false);
    pool.close();
  });
});
