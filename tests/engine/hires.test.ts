/**
 * High-resolution backbuffer safety net (docs/ARCHITECTURE.md §3):
 * - invariant: with mode 'pixel', sub-pixel 'off' and a whole-pixel camera, a frame at res k is
 *   exactly the res-1 frame enlarged by nearest neighbour — on synthetic draws and on real game
 *   frames (mission ams, sections a–c and the d boss);
 * - footprint: a sprite covers exactly its 1× rectangle times k in every mode, flipped or not;
 * - sub-pixel placement: the camera moves in 1/k steps, world draws follow the policy;
 * - sprite geometry (sizes, anchors, points) is unchanged (the art stays 1×).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PixelBuffer } from '../../src/engine/pixel';
import { INK, PAL } from '../../src/engine/palette';
import type { Renderer } from '../../src/engine/render';
import { chooseRes, filtersId, KMAX, modeAtRes, spriteFilter, type SubpixelMode } from '../../src/engine/render-common';
import { SoftRenderer } from '../../src/engine/render-soft';
import { clearSpriteCache, defineSprite, hasSprite, setHiArt } from '../../src/engine/sprites';
import { setHalfPxJoints } from '../../src/game/art/humanoid';
import { upscaleFactor, UPSCALE_MODES, type UpscaleMode } from '../../src/engine/upscale';
import { loadContent } from '../../src/game/content/index';
import { createHeadlessGame, type HeadlessGame } from '../../src/sim/index';
import { drawBlendScene, drawOpaqueScene, registerSceneSprites } from '../media/browser/scene';
import { spriteGeometrySample } from './hires-sample';

const KS = [2, 3, 5];

function soft(res: number, mode: UpscaleMode = 'pixel', subpixel: SubpixelMode = 'off'): SoftRenderer {
  return new SoftRenderer(384, 216, undefined, { res, mode, subpixel });
}

/** First differing pixel of `big` against `small` enlarged k×, or '' when equal. */
function nearestDiff(small: PixelBuffer, big: PixelBuffer, k: number): string {
  if (big.w !== small.w * k || big.h !== small.h * k) return `size ${big.w}×${big.h} vs ${small.w}×${small.h} × ${k}`;
  const up = small.scaled(k);
  for (let i = 0; i < up.data.length; i++) {
    if (up.data[i] !== big.data[i]) {
      const x = i % big.w;
      const y = Math.floor(i / big.w);
      return `(${x},${y}) = logical (${Math.floor(x / k)},${Math.floor(y / k)}): ${big.data[i].toString(16)} vs ${up.data[i].toString(16)}`;
    }
  }
  return '';
}

function sky(w: number, h: number): PixelBuffer {
  return new PixelBuffer(w, h).gradient(0, 0, w, h, PAL.sky, { reverse: true });
}

/** Extra draws: parallax tiling in both axes from negative origins, long clipped lines, world text. */
function drawEdgeScene(r: Renderer): void {
  registerSceneSprites();
  r.begin(PAL.navy[0]);
  r.setCamera(1000, -37);
  r.parallax(sky(37, 23), 0.37, 0.61, -11, -5, { repeatX: true, repeatY: true });
  r.parallax(sky(50, 20), 1.3, 0, -70, 150, { repeatX: true });
  r.parallax(sky(60, 30), 0.5, 0, 25, 40, { repeatX: false, alpha: 0.6 });
  r.line(-50_000, -20_000, 60_000, 30_000, PAL.gold[2]);
  r.line(1100, -3000, 1150, 9000, PAL.red[2], { alpha: 0.5 });
  r.line(900, -40, 1400, 200, PAL.teal[2], { blend: 'add' });
  r.line(5, 5, 5, 5, PAL.snow[3], { screen: true });
  r.text('world\ncentre', 1150, 30, { screen: false, align: 'center', outline: INK, shadow: PAL.red[1], scale: 2 });
  r.text('odd', 1101, 60, { screen: false, align: 'center', color: PAL.gold[3] });
  r.sprite('parity/hero', 0, 1050, 80, { flipX: true, tint: PAL.red[2], alpha: 0.5 });
  r.sprite('parity/glow', 0, 1120, 90, { blend: 'add', flipY: true });
  r.sprite('parity/hero', 1, 1200, 100, { src: { x: -3, y: 4, w: 12, h: 30 }, flipX: true, flipY: true });
  r.image(sky(12, 9), 1300, 40, { flash: true, flipX: true });
  r.rect(1250, 120, -5, 10, PAL.red[2]);
  r.rect(1250.4, 120.6, 7.4, 3.5, PAL.green[3], { alpha: 0.7 });
  r.fade(PAL.red[1], 0.25);
  r.end();
}

describe('res k = nearest enlargement of res 1 (pixel mode, no sub-pixel)', () => {
  const scenes: Array<[string, (r: Renderer) => void]> = [
    ['opaque', drawOpaqueScene],
    ['blend', drawBlendScene],
    ['edges', drawEdgeScene],
  ];
  for (const [name, draw] of scenes) {
    it(`synthetic scene "${name}" at res ${KS.join(', ')}`, () => {
      const r1 = soft(1);
      draw(r1);
      for (const k of KS) {
        const rk = soft(k);
        draw(rk);
        expect(nearestDiff(r1.target, rk.target, k), `res ${k}`).toBe('');
      }
    });
  }

  it('an integer camera gives the same frame with sub-pixel camera or off', () => {
    const a = soft(3, 'pixel', 'off');
    const b = soft(3, 'pixel', 'camera');
    for (const r of [a, b]) {
      registerSceneSprites();
      r.begin(PAL.navy[0]);
      r.setCamera(40, 3);
      r.sprite('parity/hero', 0, 100.4, 150);
      r.rect(50.6, 60, 10, 10, PAL.red[2]);
      r.end();
    }
    expect(nearestDiff(a.target, b.target, 1)).toBe('');
  });

  // 2× art adds detail above res 1 by design, so this invariant is about the 1× art: the 2× frames
  // are switched off here (their own checks: tests/engine/hires-density.test.ts).
  it('real game frames (mission ams a, b, c, d boss, 1× art) at res 2, 3 and 5', async () => {
    const hiArt = setHiArt(false);
    const cases: Array<{ section: string; boss?: boolean; ticks: number[] }> = [
      { section: 'a', ticks: [90, 420] },
      { section: 'b', ticks: [200] },
      { section: 'c', ticks: [200] },
      { section: 'd', boss: true, ticks: [150, 400] },
    ];
    let frames = 0;
    for (const c of cases) {
      const game: HeadlessGame = await createHeadlessGame({ missionId: 'ams', sectionId: c.section, bossRush: c.boss, seed: 1, god: true, bot: true });
      try {
        for (const t of c.ticks) {
          game.step(t - game.ticks);
          const draw = (r: Renderer): void => {
            r.begin();
            game.app.scenes.draw(r);
            r.end();
          };
          expect(game.runner?.section.id, `ams-${c.section} t${t}`).toBe(c.section);
          const r1 = soft(1);
          draw(r1);
          expect(new Set(r1.target.data).size, `ams-${c.section} t${t} colours`).toBeGreaterThan(40);
          // Drawing has no side effects on the image: twice at res 1 gives the same frame.
          const again = soft(1);
          draw(again);
          expect(nearestDiff(r1.target, again.target, 1), `ams-${c.section} t${t} redraw`).toBe('');
          for (const k of KS) {
            const rk = soft(k);
            draw(rk);
            expect(nearestDiff(r1.target, rk.target, k), `ams-${c.section} t${t} res ${k}`).toBe('');
          }
          frames++;
        }
        expect(game.report().errors).toEqual([]);
      } finally {
        game.dispose();
      }
    }
    setHiArt(hiArt);
    expect(frames).toBe(6);
  }, 240_000);
});

describe('sprite footprint at every res and mode', () => {
  defineSprite('hires/block', () => {
    const b = new PixelBuffer(9, 13).fill(PAL.red[2]);
    b.rect(2, 3, 4, 4, PAL.gold[3]);
    return { buf: b, ox: 2, oy: 12 };
  });
  defineSprite('hires/shape', () => {
    const b = new PixelBuffer(15, 11);
    b.circle(7, 5, 5, PAL.green[2]).outline(INK);
    return { buf: b, ox: 11, oy: 10 };
  });

  /** Bounding box of non-transparent pixels. */
  function bbox(t: PixelBuffer): [number, number, number, number] | null {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < t.h; y++) {
      for (let x = 0; x < t.w; x++) {
        if ((t.data[y * t.w + x] & 255) === 0) continue;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
    return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1];
  }

  it('an opaque frame covers exactly its 1× rectangle times k; a shaped one stays inside it', () => {
    for (const mode of UPSCALE_MODES) {
      for (const k of [1, 2, 3, 4, 5, 6]) {
        for (const flipX of [false, true]) {
          for (const flipY of [false, true]) {
            for (const id of ['hires/block', 'hires/shape']) {
              const r1 = new SoftRenderer(64, 48, undefined, { res: 1 });
              const rk = new SoftRenderer(64, 48, undefined, { res: k, mode, subpixel: 'camera' });
              for (const r of [r1, rk]) {
                r.begin(0);
                r.setCamera(-3, 2);
                r.sprite(id, 0, 20.3, 30.6, { flipX, flipY });
              }
              const want = bbox(r1.target);
              const got = bbox(rk.target);
              const label = `${id} ${mode} res ${k} flip ${flipX}/${flipY}`;
              expect(want, label).not.toBeNull();
              if (!want || !got) throw new Error(`nothing drawn: ${label}`);
              const scaled = want.map((v) => v * k);
              if (id === 'hires/block') expect(got, label).toEqual(scaled);
              else {
                expect(got[0], label).toBeGreaterThanOrEqual(scaled[0]);
                expect(got[1], label).toBeGreaterThanOrEqual(scaled[1]);
                expect(got[2], label).toBeLessThanOrEqual(scaled[2]);
                expect(got[3], label).toBeLessThanOrEqual(scaled[3]);
              }
            }
          }
        }
      }
    }
  });

  it('src slices land inside the footprint of the slice', () => {
    for (const mode of UPSCALE_MODES) {
      const k = 4;
      const r = new SoftRenderer(64, 48, undefined, { res: k, mode });
      r.begin(0);
      r.sprite('hires/block', 0, 20, 30, { src: { x: 1, y: 2, w: 5, h: 3 }, flipX: true });
      // 1×: left = 20 − (9 − 1 − 2) = 14, top = 18; the slice x 1..6 flipped sits at 14 + 9 − 6 = 17.
      expect(bbox(r.target), mode).toEqual([17 * k, 20 * k, 22 * k, 23 * k]);
    }
  });

  it('the UI prefix list and buffers without an id are never filtered', () => {
    expect(filtersId(undefined)).toBe(false);
    expect(filtersId('ui/cursor')).toBe(false);
    expect(filtersId('ui/logo')).toBe(false);
    expect(filtersId('ui/newspaper')).toBe(false);
    expect(filtersId('char/recruit/idle')).toBe(true);
  });

  it('never filters the exact ids of the visual review; filters character art under ui/', () => {
    // Exact ids, not prefixes: the small explosions stay filtered.
    expect(filtersId('fx/explosion-l')).toBe(false);
    expect(filtersId('fx/explosion-xl')).toBe(false);
    expect(filtersId('decor/ams/fabel-sign')).toBe(false);
    expect(filtersId('fx/explosion-m')).toBe(true);
    expect(filtersId('fx/explosion-s')).toBe(true);
    expect(filtersId('decor/ams/stopera')).toBe(true);
    // The ending parade: leaders and townsfolk get one look.
    for (const id of ['ui/leader-blare', 'ui/horse', 'ui/fanfaroni', 'ui/ending-organ', 'ui/title-swan', 'ui/portrait-gusto', 'ui/loudspeaker']) {
      expect(filtersId(id), id).toBe(true);
    }
    expect(spriteFilter('fx/explosion-xl', 'smooth', 5)).toBe('pixel');
  });

  it("a filter whose factor is above k steps down ('xbr' → 'smooth' → 'pixel')", () => {
    expect(modeAtRes('xbr', 4)).toBe('xbr');
    expect(modeAtRes('xbr', 3)).toBe('smooth');
    expect(modeAtRes('xbr', 2)).toBe('smooth');
    expect(modeAtRes('xbr', 1)).toBe('pixel');
    expect(modeAtRes('smooth', 1)).toBe('pixel');
    expect(modeAtRes('pixel', 6)).toBe('pixel');
    expect(spriteFilter('char/recruit/idle', 'xbr', 3)).toBe('smooth');
    expect(spriteFilter('char/recruit/idle', 'xbr', 5)).toBe('xbr');
    expect(spriteFilter(undefined, 'xbr', 5)).toBe('pixel');
  });

  it("'xbr' draws decor with MMPX: palette-exact, binary alpha, no seam between tiles of a strip", () => {
    // A lawn-like strip tile: grass blades (transparent gaps) on a solid band. xBR's
    // 'transparent outside' edge rule rounds the band ends, which shows as a notch where two
    // tiles meet (visual review F1).
    defineSprite('decor/test/strip', () => {
      const b = new PixelBuffer(8, 6);
      b.rect(0, 2, 8, 4, PAL.green[2]);
      for (let x = 0; x < 8; x += 2) b.set(x, 1, PAL.green[3]);
      b.rect(0, 5, 8, 1, PAL.green[1]);
      return { buf: b, ox: 0, oy: 5 };
    });
    expect(spriteFilter('decor/test/strip', 'xbr', 5)).toBe('smooth');
    const k = 4;
    const r = new SoftRenderer(32, 16, undefined, { res: k, mode: 'xbr', subpixel: 'off' });
    r.begin(0);
    r.sprite('decor/test/strip', 0, 8, 10);
    r.sprite('decor/test/strip', 0, 16, 10);
    const colours = new Set([0, PAL.green[1] >>> 0, PAL.green[2] >>> 0, PAL.green[3] >>> 0]);
    for (const c of r.target.data) expect(colours.has(c >>> 0), c.toString(16)).toBe(true);
    // The solid band (logical rows 7..9) is unbroken across the joint (logical x 15 | 16).
    for (let y = 7 * k; y < 10 * k; y++) {
      for (let x = 15 * k; x < 17 * k; x++) expect(r.target.data[y * r.target.w + x] >>> 0, `${x},${y}`).toBe(PAL.green[2] >>> 0);
    }
  });
});

describe('sub-pixel placement', () => {
  defineSprite('hires/dot', () => ({ buf: new PixelBuffer(1, 1).fill(PAL.snow[3]), ox: 0, oy: 0 }));

  function dotX(subpixel: SubpixelMode, camX: number, x: number, screen = false): number {
    const r = new SoftRenderer(32, 4, undefined, { res: 5, subpixel });
    r.begin(0);
    r.setCamera(camX, 0);
    r.sprite('hires/dot', 0, x, 1, { screen });
    for (let i = 0; i < r.target.w; i++) if (r.target.data[r.target.w * 5 + i] !== 0) return i;
    return -1;
  }

  it('snaps the camera to 1/k and world draws by the policy', () => {
    expect(dotX('off', 0.45, 10.3)).toBe(50);
    expect(dotX('camera', 0.45, 10.3)).toBe(50 - 2);
    expect(dotX('all', 0.45, 10.3)).toBe(52 - 2);
    // Screen space ignores the camera and stays on whole pixels.
    expect(dotX('all', 0.45, 10.3, true)).toBe(50);
    expect(dotX('parallax', 0.45, 10.3)).toBe(50);
    const r = new SoftRenderer(32, 4, undefined, { res: 5, subpixel: 'camera' });
    r.setCamera(0.45, 1.33);
    expect([r.camX, r.camY]).toEqual([0.4, 1.4]);
    // 'parallax': the world camera stays on whole pixels.
    const q = new SoftRenderer(32, 4, undefined, { res: 5, subpixel: 'parallax' });
    q.setCamera(0.45, 1.6);
    expect([q.camX, q.camY]).toEqual([0, 2]);
    // 'all' (the default): the camera and world draws move in 1/k steps.
    const p = new SoftRenderer(32, 4, undefined, { res: 5 });
    p.setCamera(0.45, 1.6);
    expect([p.camX, p.camY, p.subpixel]).toEqual([0.4, 1.6, 'all']);
  });

  it("'parallax' and 'all' scroll background layers by the unrounded camera in 1/k steps; factor 1 stays with the world", () => {
    const layer = new PixelBuffer(4, 1).fill(PAL.snow[3]);
    const firstLit = (sub: SubpixelMode, factor: number): number => {
      const r = new SoftRenderer(16, 1, undefined, { res: 5, subpixel: sub });
      r.begin(0);
      r.setCamera(10.45, 0);
      r.parallax(layer, factor, 0, 12, 0, { repeatX: false });
      for (let i = 0; i < r.target.w; i++) if (r.target.data[i] !== 0) return i;
      return -1;
    };
    // Origin 12 − 10.45 · 0.5 = 6.775 → 6.8 at 1/5 (34 px); whole pixels: 12 − 10 · 0.5 = 7.
    expect(firstLit('parallax', 0.5)).toBe(34);
    expect(firstLit('off', 0.5)).toBe(35);
    // Factor 1: 12 − 10 (the world camera) = 2.
    expect(firstLit('parallax', 1)).toBe(10);
    expect(firstLit('camera', 1)).toBe(Math.round((12 - 10.4) * 5));
    // 'all' (the default): layers like 'parallax', factor 1 with the sub-pixel world camera.
    expect(firstLit('all', 0.5)).toBe(34);
    expect(firstLit('all', 1)).toBe(Math.round((12 - 10.4) * 5));
  });

  it('a renderer at res 1 rounds the camera like before', () => {
    const r = new SoftRenderer(32, 4, undefined, { subpixel: 'all' });
    r.setCamera(2.6, 1.4);
    expect([r.camX, r.camY, r.res]).toEqual([3, 1, 1]);
  });

  it('chooses the backbuffer resolution from the display scale and the filter factor', () => {
    expect(chooseRes(0.6)).toBe(1);
    expect(chooseRes(1)).toBe(1);
    expect(chooseRes(5)).toBe(5);
    expect(chooseRes(5, KMAX, 4)).toBe(5);
    expect(chooseRes(6)).toBe(6);
    expect(chooseRes(7)).toBe(6);
    expect(chooseRes(8)).toBe(6);
    expect(chooseRes(10)).toBe(6);
    expect(chooseRes(12, 4)).toBe(4);
    // 16-inch MacBook Pro fullscreen (s 9): was 3 (no xbr, smooth at 1.5); now 6 / 4.
    expect(chooseRes(9)).toBe(6);
    expect(chooseRes(9, KMAX, 2)).toBe(6);
    expect(chooseRes(9, KMAX, 4)).toBe(4);
    // 4K (s 10).
    expect(chooseRes(10, KMAX, 2)).toBe(6);
    expect(chooseRes(10, KMAX, 4)).toBe(4);
  });

  it('above 1×, k never drops below kmax − 2 (the old divisor rule gave 2 at s 14)', () => {
    for (let s = KMAX + 1; s <= 24; s++) {
      for (const f of [1, 2, 4]) expect(chooseRes(s, KMAX, f), `s ${s} f ${f}`).toBeGreaterThanOrEqual(KMAX - 2);
    }
  });

  it('every filtered pixel lands where a direct nearest-neighbour scale to the display puts it', () => {
    // Device px d → backbuffer px (present, nearest) → filtered px (draw, nearest) must equal
    // device px d → filtered px directly, for every display scale and filter factor.
    for (let s = 1; s <= 16; s++) {
      for (const f of [2, 4]) {
        const k = chooseRes(s, KMAX, f);
        if (f > k) continue; // the filter steps down (modeAtRes)
        for (let d = 0; d < 384 * s; d++) {
          const b = Math.floor(((d + 0.5) * k) / s);
          const got = Math.floor(((b + 0.5) * f) / k);
          const want = Math.floor(((d + 0.5) * f) / s);
          if (got !== want) throw new Error(`s ${s} f ${f} k ${k}: device px ${d} shows ${got}, want ${want}`);
        }
      }
    }
  });

  it('the factor of every mode is an integer, 1 for pixel', () => {
    expect(upscaleFactor('pixel')).toBe(1);
    for (const m of UPSCALE_MODES) expect(Number.isInteger(upscaleFactor(m))).toBe(true);
  });
});

describe('sprite geometry is unchanged', () => {
  it('sizes, anchors and points of a sample of every 12th sprite id match the fixture', async () => {
    await loadContent();
    const want = JSON.parse(readFileSync(new URL('./fixtures/sprite-geometry.json', import.meta.url), 'utf8')) as Record<string, string>;
    const ids = Object.keys(want).filter((id) => hasSprite(id));
    expect(ids.length).toBeGreaterThan(400);
    const got = spriteGeometrySample(ids);
    for (const id of ids) expect(got[id], id).toBe(want[id]);
    // The 2× frames (mission ams) have the same logical geometry.
    const hi = spriteGeometrySample(ids, 2);
    for (const id of ids) expect(hi[id], `${id} at density 2`).toBe(want[id]);
    // The HALF_PX_JOINTS spike (default off) keeps the same 2× geometry when it is on.
    const prev = setHalfPxJoints(true);
    clearSpriteCache();
    try {
      const half = spriteGeometrySample(ids, 2);
      for (const id of ids) expect(half[id], `${id} at density 2, half-px joints`).toBe(want[id]);
    } finally {
      setHalfPxJoints(prev);
      clearSpriteCache();
    }
  }, 120_000);
});
