/**
 * UHD art of the menus (docs/ART_GUIDE.md "UHD art"; content/ui/{logo,military,screens}.art.ts,
 * scenes/base.ts): the night base, the logo, the military furniture and stencil titles, Gusto's
 * radio portrait and box and the continue-gag props have native 2× and 4× art with exactly their
 * 1× geometry, PAL_HD colours only, new art (not the 1× or 2× frames scaled), deterministic; their
 * 1× frames are unchanged. The screens draw a group of sprites at the art tier once it is built
 * (`screenArt`: never generated on the main thread when a pool is there), at 1× on a res-1
 * backbuffer, and a mission start drops the 4× screen art except the chosen heroes' strips.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ArtPool, createArtWorkerHandler, inProcessPort } from '../../src/engine/art-pool';
import { InputManager } from '../../src/engine/input';
import { inHdPalette } from '../../src/engine/palette-hd';
import type { DrawOpts, Frame } from '../../src/engine/render';
import { artDensity, clearSpriteCache, getFrames, hasFramesAt, hasHiSprite, releaseDense, setArtTier, spriteErrors } from '../../src/engine/sprites';
import { MemoryStore } from '../../src/engine/storage';
import { createApp, newCampaign } from '../../src/game/app';
import { loadContent } from '../../src/game/content/index';
import { contourCells, insideDist, STENCIL_GOLD, STENCIL_TITLES, stencilId } from '../../src/game/content/ui/military.art';
import { DEFAULT_PARAMS } from '../../src/game/params';
import { keepForHeroes, MENU_ART, releaseScreenArt, screenArt, screenArtBytes, screenTier, setScreenArtPool } from '../../src/game/scenes/base';
import { CharacterSelectScene } from '../../src/game/scenes/character-select';
import { ControlsScene } from '../../src/game/scenes/controls';
import { MissionIntroScene } from '../../src/game/scenes/mission-intro';
import { ModeSelectScene } from '../../src/game/scenes/mode-select';
import { TitleScene } from '../../src/game/scenes/title';
import { GameSession } from '../../src/game/session';
import { SimAudio } from '../../src/sim/stats';
import { RecordingRenderer } from '../engine/helpers';

const BASE = ['ui/base/sky', 'ui/base/land', 'ui/base/net', 'ui/base/puff', 'ui/base/wall'];
const MIL = ['ui/mil/bolt', 'ui/mil/frame', 'ui/mil/shutter', 'ui/mil/hazard', 'ui/mil/badge-off', 'ui/mil/badge-p1', 'ui/mil/badge-p2', 'ui/mil/plate', 'ui/mil/preview', 'ui/mil/emblem'];
const STENCILS = [...STENCIL_TITLES, ...STENCIL_GOLD].map(stencilId);
const SCREENS = ['ui/logo', 'ui/portrait-gusto', 'ui/radio'];
const IDS = [...BASE, ...MIL, ...STENCILS, ...SCREENS];

/** FNV-1a of a sprite's 1× frames (size, anchor, pixels). */
function hash1x(id: string): string {
  const fnv = (h: number, v: number): number => Math.imul(h ^ v, 16777619) >>> 0;
  let h = 2166136261;
  for (const f of getFrames(id, 1)) {
    h = fnv(h, f.buf.w);
    h = fnv(h, f.buf.h);
    h = fnv(h, f.ox);
    h = fnv(h, f.oy);
    for (const c of f.buf.data) h = fnv(h, c);
  }
  return h.toString(16).padStart(8, '0');
}

/** The 1× frames as they were before the UHD wave (the menus' look since 2026-10-16). */
const ONE_X: Readonly<Record<string, string>> = {
  'ui/base/land': '8a2aa630',
  'ui/base/net': '5ca39c1d',
  'ui/base/puff': '27b54f51',
  'ui/base/sky': 'ecb994cd',
  'ui/base/wall': '160b6a30',
  'ui/mil/badge-off': '792f5f83',
  'ui/mil/bolt': '7f96efc0',
  'ui/mil/badge-p1': '1e0c5883',
  'ui/mil/badge-p2': '1cff6383',
  'ui/mil/emblem': '36ff5eed',
  'ui/mil/frame': '1b5631cd',
  'ui/mil/hazard': '7c263193',
  'ui/mil/plate': '787cb13b',
  'ui/mil/preview': '22440a85',
  'ui/mil/shutter': '4c6003b5',
  'ui/mil/stencil-enter-your-initials': '2a73e756',
  'ui/mil/stencil-hall-of-fame': 'd7d8c17c',
  'ui/mil/stencil-how-to-play': '2c07a8a9',
  'ui/mil/stencil-options': 'e82b61c4',
  'ui/mil/stencil-press-start': '09f1332a',
  'ui/mil/stencil-report-for-duty': '31ea17f9',
  'ui/mil/stencil-select-operation': '070ad83d',
  'ui/logo': '441cf07e',
  'ui/portrait-gusto': '8ff3d4d5',
};

/** Is `hi` just `lo` scaled by an integer factor? */
function scaledCopy(hi: Frame, lo: Frame, k: number): boolean {
  const s = lo.buf.scaled(k).data;
  return hi.buf.data.length === s.length && hi.buf.data.every((c, i) => c === s[i]);
}

/** A recording renderer with backbuffer `res` that also records the density of the frame each sprite call draws. */
class DensityRecorder extends RecordingRenderer {
  readonly drawn: Array<[string, number]> = [];
  constructor(res: number) {
    super();
    (this as unknown as { res: number }).res = res;
  }
  override sprite(id: string, frameIndex: number, x: number, y: number, o?: DrawOpts): void {
    this.drawn.push([id, getFrames(id, artDensity())[0]?.density ?? 1]);
    super.sprite(id, frameIndex, x, y, o);
  }
  densityOf(id: string): number[] {
    return [...new Set(this.drawn.filter(([i]) => i === id).map(([, d]) => d))];
  }
}

function app() {
  const a = createApp({ input: new InputManager(), audio: new SimAudio(), store: new MemoryStore(), params: { ...DEFAULT_PARAMS, players: 1 } });
  a.session = new GameSession({ characters: ['vincent'], seed: 7 });
  a.campaign = newCampaign();
  return a;
}

describe('UHD art of the menus', () => {
  beforeAll(async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await loadContent();
    warn.mockRestore();
  }, 120_000);
  afterEach(() => {
    setArtTier(1);
    setScreenArtPool(null);
  });

  it('keeps every 1× frame as it was', () => {
    for (const [id, h] of Object.entries(ONE_X)) expect(hash1x(id), id).toBe(h);
  });

  it('has 2× and 4× art for every menu id with exactly the 1× geometry', () => {
    for (const id of IDS) {
      const lo = getFrames(id, 1);
      for (const d of [2, 4] as const) {
        expect(hasHiSprite(id, d), `${id}@${d}x`).toBe(true);
        const hi = getFrames(id, d);
        expect(hi.length, `${id}@${d}x frames`).toBe(lo.length);
        hi.forEach((f, i) => {
          expect(f.density, `${id}@${d}x #${i}`).toBe(d);
          expect([f.buf.w, f.buf.h], `${id}@${d}x #${i} size`).toEqual([lo[i].buf.w * d, lo[i].buf.h * d]);
          expect([f.ox, f.oy], `${id}@${d}x #${i} anchor`).toEqual([lo[i].ox, lo[i].oy]);
          expect(f.pts ?? null).toEqual(lo[i].pts ?? null);
        });
      }
    }
    expect(spriteErrors().filter((e) => IDS.includes(e.id))).toEqual([]);
  }, 60_000);

  it('draws in PAL_HD only, as new art (not the lower frames scaled)', () => {
    for (const id of IDS) {
      const lo = getFrames(id, 1);
      const two = getFrames(id, 2);
      const four = getFrames(id, 4);
      for (const f of [...two, ...four]) {
        let bad = 0;
        for (const c of f.buf.data) if ((c & 255) !== 0 && !inHdPalette(c)) bad++;
        expect(bad, `${id}: colours outside PAL_HD`).toBe(0);
      }
      // A blank frame (the fully raised shutter) is the same at every density.
      two.forEach((f, i) => {
        if (lo[i].buf.data.some((c) => (c & 255) !== 0)) expect(scaledCopy(f, lo[i], 2), `${id}@2x #${i} = 1× scaled`).toBe(false);
      });
      four.forEach((f, i) => {
        if (lo[i].buf.data.some((c) => (c & 255) !== 0)) expect(scaledCopy(f, two[i], 2), `${id}@4x #${i} = 2× scaled`).toBe(false);
      });
    }
  }, 60_000);

  it('is deterministic', () => {
    for (const id of ['ui/logo', 'ui/mil/frame', 'ui/mil/shutter', 'ui/portrait-gusto', 'ui/radio', stencilId('PRESS START')]) {
      const a = getFrames(id, 4).map((f) => f.buf.data.slice());
      clearSpriteCache(id);
      const b = getFrames(id, 4).map((f) => f.buf.data);
      expect(a.length).toBe(b.length);
      a.forEach((x, i) => expect(Buffer.from(x.buffer).equals(Buffer.from(b[i].buffer)), `${id} #${i}`).toBe(true));
    }
  }, 60_000);

  it('lettering: one-cell stairs become 45° edges, real corners stay square', () => {
    // A 2 × 2 diagonal (cells (0,0) and (1,1)) and an L (cells (0,0), (0,1), (1,1)).
    const diag = (x: number, y: number): boolean => (x === 0 && y === 0) || (x === 1 && y === 1);
    const m = contourCells(diag, 2, 2, 4);
    // The two cells join across the corner (the concave corners fill), the outer corners of the
    // stair are cut.
    expect(m[3 * 8 + 4]).toBe(1);
    expect(m[4 * 8 + 3]).toBe(1);
    expect(m[0 * 8 + 3]).toBe(0);
    expect(m[7 * 8 + 4]).toBe(0);
    const square = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < 3 && y < 3;
    const s = contourCells(square, 3, 3, 4);
    expect(s[0]).toBe(1);
    expect(s[12 * 12 - 1]).toBe(1);
    const dist = insideDist(s, 12, 12);
    expect(dist[0]).toBe(1);
    expect(dist[6 * 12 + 6]).toBeCloseTo(6, 0);
  });

  describe('screen art at the tier', () => {
    it('screenTier: the art tier where the backbuffer can show it', () => {
      setArtTier(1);
      expect(screenTier({ res: 8 })).toBe(1);
      setArtTier(4);
      expect(screenTier({ res: 8 })).toBe(4);
      expect(screenTier({ res: 6 })).toBe(2);
      expect(screenTier({ res: 1 })).toBe(1);
      setArtTier(2);
      expect(screenTier({ res: 8 })).toBe(2);
    });

    it('draws a group at 1× until the pool delivers it, never building it on this thread', async () => {
      const ids = ['ui/mil/plate', 'ui/mil/hazard'];
      releaseDense(ids, 4);
      releaseDense(ids, 2);
      const pool = new ArtPool([inProcessPort(createArtWorkerHandler(async () => {}))]);
      setScreenArtPool(() => pool);
      setArtTier(4);
      const r = new DensityRecorder(8);
      // In-process ports build the frames into this registry (as a worker's pack would install).
      expect(screenArt(r, ids)).toBeLessThan(4);
      await vi.waitFor(() => expect(screenArt(r, ids)).toBe(4), { timeout: 20_000 });
      expect(ids.every((id) => hasFramesAt(id, 4))).toBe(true);
    }, 30_000);

    it('a mission start drops the 4× screen art but the chosen heroes and the vehicles', () => {
      setScreenArtPool(() => null);
      setArtTier(4);
      const r = new DensityRecorder(8);
      const hero = ['char/vincent/legs-idle', 'char/vincent/torso-pistol-idle'];
      expect(screenArt(r, ['ui/mil/plate', 'ui/logo'])).toBe(4);
      expect(screenArt(r, hero)).toBe(4);
      expect(screenArtBytes()).toBeGreaterThan(0);
      const freed = releaseScreenArt(keepForHeroes(['vincent']));
      expect(freed).toBeGreaterThan(0);
      expect(hasFramesAt('ui/mil/plate', 4)).toBe(false);
      expect(hasFramesAt('ui/logo', 4)).toBe(false);
      expect(hero.every((id) => hasFramesAt(id, 4))).toBe(true);
      expect(screenArtBytes()).toBe(0);
      expect(MENU_ART.length).toBeGreaterThan(0);
    });
  });

  describe('the screens', () => {
    it('title: the logo at 1× on a res-1 backbuffer, at 4× at tier 4 on res 8', () => {
      setScreenArtPool(() => null);
      const a = app();
      const s = new TitleScene(a);
      const r1 = new DensityRecorder(1);
      setArtTier(4);
      s.draw(r1);
      expect(r1.densityOf('ui/logo')).toEqual([1]);
      expect(r1.densityOf('ui/base/sky')).toEqual([1]);
      const r8 = new DensityRecorder(8);
      s.draw(r8);
      expect(r8.densityOf('ui/logo')).toEqual([4]);
      expect(r8.densityOf('ui/base/sky')).toEqual([4]);
      expect(r8.densityOf('ui/base/wall')).toEqual([4]);
      expect(r8.densityOf(stencilId('PRESS START')).every((d) => d === 4)).toBe(true);
    }, 30_000);

    it('select: furniture and the preview at the tier, portraits at their densest art', () => {
      setScreenArtPool(() => null);
      setArtTier(4);
      const a = app();
      const s = new CharacterSelectScene(a, 1);
      a.scenes.reset(s);
      for (let i = 0; i < 120; i++) a.scenes.update();
      const r = new DensityRecorder(8);
      s.draw(r);
      expect(r.densityOf('ui/mil/frame')).toEqual([4]);
      expect(r.densityOf('ui/mil/plate')).toEqual([4]);
      // The select portraits have 4× art too (polish wave): at tier 4 they draw at 4×.
      expect(r.densityOf('char/vincent/select')).toEqual([4]);
      // Tier 2: everything at 2×.
      setArtTier(2);
      const r2 = new DensityRecorder(8);
      s.draw(r2);
      expect(r2.densityOf('ui/mil/frame')).toEqual([2]);
      // Res 1: as before.
      const r1 = new DensityRecorder(1);
      s.draw(r1);
      expect(r1.densityOf('ui/mil/frame')).toEqual([1]);
      // The portraits keep their 2× art at screen tier 1 (its reduction at res 1), as before the wave.
      expect(r1.densityOf('char/vincent/select')).toEqual([2]);
      setArtTier(1);
      const r8t1 = new DensityRecorder(8);
      s.draw(r8t1);
      expect(r8t1.densityOf('char/vincent/select')).toEqual([2]);
      expect(r8t1.densityOf('ui/mil/frame')).toEqual([1]);
    }, 30_000);

    it('menus draw the swan cursor at the tier (mode select, controls)', () => {
      setScreenArtPool(() => null);
      setArtTier(4);
      for (const s of [new ModeSelectScene(app()), new ControlsScene(app())]) {
        const r8 = new DensityRecorder(8);
        s.draw(r8);
        expect(r8.densityOf('ui/cursor-swan')).toEqual([4]);
        const r1 = new DensityRecorder(1);
        s.draw(r1);
        expect(r1.densityOf('ui/cursor-swan')).toEqual([1]);
      }
    }, 30_000);

    it('the HD netting holds the parked Swan where the 1× netting has her', () => {
      const [lo0, lo1] = getFrames('ui/base/net', 1);
      const W = lo0.buf.w;
      const H = lo0.buf.h;
      // The 1× box of the parked Swan: where frame 1 differs from frame 0 (2 logical px of slack).
      let x0 = W;
      let y0 = H;
      let x1 = -1;
      let y1 = -1;
      let swanPx = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (lo0.buf.data[y * W + x] === lo1.buf.data[y * W + x]) continue;
          swanPx++;
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
      }
      expect(swanPx).toBeGreaterThan(200);
      for (const d of [2, 4]) {
        const [e, p] = getFrames('ui/base/net', d);
        let inside = 0;
        for (let Y = 0; Y < H * d; Y++) {
          for (let X = 0; X < W * d; X++) {
            if (e.buf.data[Y * W * d + X] === p.buf.data[Y * W * d + X]) continue;
            const x = X / d;
            const y = Y / d;
            // Every px the Swan adds lies in her 1× box …
            expect(x >= x0 - 2 && x <= x1 + 3 && y >= y0 - 2 && y <= y1 + 3, `net@${d}x px ${X},${Y} outside the Swan's box`).toBe(true);
            inside++;
          }
        }
        // … and she shows (not hidden or cut away): at least half her 1× area at density d.
        expect(inside, `net@${d}x`).toBeGreaterThan(swanPx * d * d * 0.5);
      }
    }, 30_000);

    it('mission intro: the HD radio box at the tier, the 1× panel at res 1; entering drops the 4× menu art', () => {
      setScreenArtPool(() => null);
      setArtTier(4);
      const a = app();
      const r0 = new DensityRecorder(8);
      expect(screenArt(r0, ['ui/mil/frame'])).toBe(4);
      const s = new MissionIntroScene(a, 'ams');
      s.enter();
      expect(hasFramesAt('ui/mil/frame', 4)).toBe(false);
      const r = new DensityRecorder(8);
      s.draw(r);
      expect(r.densityOf('ui/radio')).toEqual([4]);
      expect(r.densityOf('ui/portrait-gusto')).toEqual([4]);
      const r1 = new DensityRecorder(1);
      s.draw(r1);
      expect(r1.densityOf('ui/radio')).toEqual([]);
      expect(r1.densityOf('ui/portrait-gusto')).toEqual([1]);
      s.exit();
    }, 30_000);
  });
});
