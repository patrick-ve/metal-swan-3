/**
 * UHD wave (group screens, FPS): the ray engine's dense levels (textures at 128² / 256², billboards
 * at size·d), the per-column level choice, the view at density 2, the fps carriers and the UHD
 * wall / HUD / face / view art. The 1× view never reads a dense level (its pixels are law).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { PAL } from '../../src/engine/palette';
import { inHdPalette, PAL_HD } from '../../src/engine/palette-hd';
import { PixelBuffer } from '../../src/engine/pixel';
import { DoorTable, RayGrid } from '../../src/engine/ray/grid';
import {
  billboardLevel,
  defineRayBillboard,
  defineRayTexture,
  getRayBillboard,
  installRayBillboardHd,
  installRayTextureHd,
  RAY_LEVEL_MAG,
  rayBillboardDensities,
  rayHdBytes,
  rayTexDarkHd,
  rayTextureDensities,
  rayTextureIndex,
  rayTextureLevel,
  releaseRayHd,
} from '../../src/engine/ray/textures';
import { RayView, renderView, type RayScene } from '../../src/engine/ray/view';
import { generatedSprites, getFrames, hasFramesAt, releaseDense, setArtTier, setHiArt } from '../../src/engine/sprites';
import { MemoryByteStore } from '../../src/engine/byte-store';
import { ArtCache } from '../../src/game/art-cache';
import { loadContent } from '../../src/game/content/index';
import { faceFramesHd } from '../../src/game/content/fps/faces';
import { barArtHd, BAR_H, BAR_W } from '../../src/game/content/fps/hud-art';
import { carrierOf, installFpsRayHd, listRayArt, rayCarrierIds, rayCarriersMissing } from '../../src/game/content/fps/ray-art';
import { FPS_TEXTURE_IDS } from '../../src/game/content/fps/textures';
import { paintWallHd } from '../../src/game/content/fps/walls-hd';
import { ensureFpsDenseArt, fpsDenseIds, requestFpsDenseArt, setFpsArtPool } from '../../src/game/content/fps/dense-load';
import { fpsViewDensity, FPS_VIEW_MAX_DENSITY } from '../../src/game/scenes/fps';
import { densityAtRes, readyDensity } from '../../src/game/fps/hud';

const T = 64;

function flat(size: number, c: number): PixelBuffer {
  return new PixelBuffer(size, size).fill(c);
}

defineRayTexture('rhd/a', () => flat(T, PAL.stone[2]));
defineRayBillboard('rhd/bb', { yaws: 8, frames: 2, gen: (f, y) => new PixelBuffer(T, T).rect(20 + y, 8, 16, 50 + f, PAL.gold[2]) });

function room(tex: string): RayScene {
  const g = new RayGrid(8, 8);
  const t = rayTextureIndex(tex);
  for (let i = 0; i < 8; i++) {
    g.setWall(i, 0, t);
    g.setWall(i, 7, t);
    g.setWall(0, i, t);
    g.setWall(7, i, t);
  }
  return { grid: g, doors: new DoorTable(), push: null, ceil: PAL.navy[0], floor: PAL.stone[1], sprites: [], spriteCount: 0 };
}

function hash(a: Uint32Array): number {
  let h = 2166136261;
  for (let i = 0; i < a.length; i++) h = Math.imul(h ^ a[i], 16777619) >>> 0;
  return h;
}

describe('dense ray levels', () => {
  it('installs a texture level at 2 and 4, rejects a wrong size or density', () => {
    expect(installRayTextureHd('rhd/a', 2, flat(128, PAL_HD.stone[4]))).toBe(true);
    expect(installRayTextureHd('rhd/a', 4, flat(256, PAL_HD.stone[5]))).toBe(true);
    expect(installRayTextureHd('rhd/a', 2, flat(64, PAL_HD.stone[4]))).toBe(false);
    expect(installRayTextureHd('rhd/a', 3, flat(192, PAL_HD.stone[4]))).toBe(false);
    expect(installRayTextureHd('rhd/none', 2, flat(128, PAL_HD.stone[4]))).toBe(false);
    expect(rayTextureDensities('rhd/a')).toEqual([1, 2, 4]);
  });

  it('picks the level per column: 1× at density 1, else by the column height', () => {
    const i = rayTextureIndex('rhd/a');
    expect(rayTextureLevel(i, 1).size).toBe(64);
    expect(rayTextureLevel(i, 1, 999).size).toBe(64);
    // span 0: the highest density ≤ d
    expect(rayTextureLevel(i, 2).size).toBe(128);
    expect(rayTextureLevel(i, 4).size).toBe(256);
    // a view of density 2: 128² up to RAY_LEVEL_MAG magnification, 256² on near walls
    expect(rayTextureLevel(i, 2, 100).size).toBe(128);
    expect(rayTextureLevel(i, 2, 128 * RAY_LEVEL_MAG).size).toBe(128);
    expect(rayTextureLevel(i, 2, 128 * RAY_LEVEL_MAG + 1).size).toBe(256);
    // the y-side variant: two HD tones down
    const lv = rayTextureLevel(i, 2, 10);
    expect(lv.cols[0]).toBe(PAL_HD.stone[4]);
    expect(lv.dark[0]).toBe(PAL_HD.stone[2]);
  });

  it('installs billboard levels with the engine-made mirrors and spans', () => {
    const bb = getRayBillboard('rhd/bb');
    const frames: PixelBuffer[] = [];
    for (let f = 0; f < 2; f++) for (let y = 0; y < 5; y++) frames.push(new PixelBuffer(128, 128).rect(40 + y * 2, 16, 32, 100 + f, PAL_HD.gold[4]));
    expect(installRayBillboardHd('rhd/bb', 2, frames.slice(1))).toBe(false);
    expect(installRayBillboardHd('rhd/bb', 2, frames)).toBe(true);
    expect(rayBillboardDensities('rhd/bb')).toEqual([1, 2]);
    const lv = billboardLevel(bb, 2);
    expect(lv.size).toBe(128);
    expect(lv.cols.length).toBe(16);
    // yaw 1 (slot 1) and its mirror yaw 7 (slot 7): column u ↔ 127 − u
    const a = lv.cols[1];
    const m = lv.cols[7];
    for (const u of [0, 41, 42, 73, 74, 127]) expect(m[(127 - u) * 128 + 50]).toBe(a[u * 128 + 50]);
    expect(lv.first[1][41]).toBe(0xffff);
    expect(lv.first[1][42]).toBe(16);
    expect(lv.last[1][42]).toBe(115);
    expect(billboardLevel(bb, 1).size).toBe(64);
    expect(billboardLevel(bb, 4).size).toBe(128);
  });

  it('counts and releases the dense levels', () => {
    const before = rayHdBytes(2);
    expect(before).toBeGreaterThan(0);
    expect(rayHdBytes(4)).toBeGreaterThanOrEqual(256 * 256 * 4 * 2);
    expect(releaseRayHd(4)).toBeGreaterThan(0);
    expect(rayTextureDensities('rhd/a')).toEqual([1, 2]);
    expect(rayTexDarkHd(flat(4, PAL_HD.steel[0])).data[0]).toBe(PAL_HD.steel[0]);
  });
});

describe('renderView at density 2', () => {
  it('the 1× view ignores dense levels; the 2× view draws them at the same geometry', () => {
    defineRayTexture('rhd/w', () => flat(T, PAL.red[1]));
    const sc = room('rhd/w');
    const cam = { x: 3.5, y: 3.5, angle: 300, eyeZ: 0.5 };
    const v1 = new RayView();
    renderView(v1, sc, cam);
    const h1 = hash(v1.buf.data);
    const v2 = new RayView(undefined, undefined, 2);
    renderView(v2, sc, cam);
    // nothing installed: the 1× texels, enlarged (the 2× view's wall px are the 1× colours)
    expect(v2.buf.data.includes(PAL.red[1])).toBe(true);
    installRayTextureHd('rhd/w', 2, flat(128, PAL_HD.sky[6]));
    renderView(v1, sc, cam);
    expect(hash(v1.buf.data)).toBe(h1);
    renderView(v2, sc, cam);
    expect(v2.buf.w).toBe(768);
    expect(v2.buf.h).toBe(352);
    expect(v2.buf.data.includes(PAL_HD.sky[6])).toBe(true);
    expect(v2.buf.data.includes(PAL.red[1])).toBe(false);
    // the same wall span: every 1× wall px column has its wall over the same rows at 2×
    for (const x of [10, 100, 200, 300]) {
      let top1 = -1;
      for (let y = 0; y < v1.buf.h; y++) if (v1.buf.data[y * v1.buf.w + x] === PAL.red[1] || v1.buf.data[y * v1.buf.w + x] === PAL.red[0]) {
        top1 = y;
        break;
      }
      let top2 = -1;
      for (let y = 0; y < v2.buf.h; y++) {
        const c = v2.buf.data[y * v2.buf.w + 2 * x];
        if (c === PAL_HD.sky[6] || c === PAL_HD.sky[4]) {
          top2 = y;
          break;
        }
      }
      if (top1 >= 0) expect(Math.abs(top2 / 2 - top1)).toBeLessThanOrEqual(1);
    }
  });

  it('the view density: 2 at tiers 2 and 4 (4 is over the frame budget), 1 below res 2 or with dense art off', () => {
    expect(FPS_VIEW_MAX_DENSITY).toBe(2);
    expect(fpsViewDensity(4, 8)).toBe(2);
    expect(fpsViewDensity(2, 4)).toBe(2);
    expect(fpsViewDensity(2, 1)).toBe(1);
    expect(fpsViewDensity(1, 8)).toBe(1);
    const prev = setHiArt(false);
    expect(fpsViewDensity(4, 8)).toBe(1);
    setHiArt(prev);
    expect(densityAtRes(4, 6)).toBe(2);
    expect(densityAtRes(4, 8)).toBe(4);
    expect(densityAtRes(2, 3)).toBe(2);
  });
});

describe('fps UHD art', () => {
  beforeAll(async () => {
    await loadContent(() => true);
  });

  it('every texture paints at 128² and 256²: opaque, HD palette, deterministic', () => {
    for (const id of FPS_TEXTURE_IDS) {
      for (const d of [2, 4] as const) {
        const { lit, dark } = paintWallHd(id, d);
        expect(lit.w, id).toBe(64 * d);
        expect(dark.h, id).toBe(64 * d);
        for (let i = 0; i < lit.data.length; i += 97) {
          expect(lit.data[i] & 255, id).toBe(255);
          expect(inHdPalette(lit.data[i]), `${id}@${d} ${lit.data[i].toString(16)}`).toBe(true);
        }
      }
    }
    expect(hash(paintWallHd('fps/wall/brick', 2).lit.data)).toBe(hash(paintWallHd('fps/wall/brick', 2).lit.data));
  });

  it('textures tile seamlessly: the design painted 16 px shifted is the texture rolled by 16 px', () => {
    for (const id of FPS_TEXTURE_IDS) {
      const a = paintWallHd(id, 2).lit;
      const b = paintWallHd(id, 2, 16).lit;
      const N = a.w;
      let bad = 0;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (b.data[y * N + ((x + 32) % N)] !== a.data[y * N + x]) bad++;
      expect(bad, id).toBe(0);
    }
  });

  it('every ray asset has a carrier with dense frames of the 1× geometry', () => {
    const ids = listRayArt();
    expect(ids.length).toBeGreaterThan(40);
    for (const id of ['fps/wall/brick', 'fps/guard/move', 'fps/boss/mech/act', 'fps/prop/chains', 'fps/item/pocket-watch']) {
      const c = carrierOf(id);
      const one = getFrames(c, 1);
      const two = getFrames(c, 2);
      expect(two.length, c).toBe(one.length);
      expect(two[0].buf.w, c).toBe(one[0].buf.w * 2);
      expect(two[0].density, c).toBe(2);
    }
    expect(rayCarrierIds('tex').length).toBe(FPS_TEXTURE_IDS.length);
  });

  it('installFpsRayHd hands built carrier frames to the ray registry, never generating', () => {
    const missing = rayCarriersMissing(2);
    const built = missing.filter((c) => hasFramesAt(c, 2)).length;
    const n = installFpsRayHd(2);
    expect(n).toBe(built);
    expect(rayCarriersMissing(2).length).toBe(missing.length - built);
    expect(rayTextureDensities('fps/wall/brick')).toContain(2);
  });

  it('a res-1 display (headless sims, tests) never asks for dense art', () => {
    const before = rayCarriersMissing(2).length;
    let asked = 0;
    requestFpsDenseArt({ res: 1 }, () => {
      asked++;
      return ['recruit'];
    });
    expect(asked).toBe(0);
    expect(rayCarriersMissing(2).length).toBe(before);
  });

  it('the dense load lists only missing ids (walls at 4, everything at 2)', () => {
    setArtTier(4);
    const at4 = fpsDenseIds(4, ['recruit']);
    expect(at4.every((id) => id.startsWith('fps/ray/wall/') || id.startsWith('fps/ray/door/') || id.startsWith('fps/hud/') || id.startsWith('fps/view/') || id === 'fps/face/recruit')).toBe(true);
    expect(at4).toContain('fps/hud/bar');
    setArtTier(1);
  });

  it('the HUD bar, the faces and the weapon views keep the 1× size at 2 and 4', () => {
    for (const d of [2, 4] as const) {
      const bar = barArtHd(d);
      expect([bar.w, bar.h]).toEqual([BAR_W * d, BAR_H * d]);
      const faces = faceFramesHd('vincent', d);
      expect(faces.length).toBe(24);
      expect(faces[0].w).toBe(32 * d);
      for (const id of ['fps/view/pistol', 'fps/hud/weapon', 'fps/hud/key', 'fps/face/recruit']) {
        const one = getFrames(id, 1);
        const dd = getFrames(id, d);
        expect(dd.length, id).toBe(one.length);
        expect(dd[0].buf.w, id).toBe(one[0].buf.w * d);
        expect([dd[0].ox, dd[0].oy], id).toEqual([one[0].ox, one[0].oy]);
      }
    }
    // the HUD draws the highest READY density (never generates)
    expect(readyDensity('fps/view/pistol', 4)).toBe(4);
    expect(readyDensity('fps/hud/nothing', 4)).toBe(1);
  });

  it("the 2× fps art goes to pack 'hd2-fps'; a later visit restores it and builds nothing; carrier copies are released", async () => {
    setFpsArtPool(() => null);
    const store = new MemoryByteStore();
    await ensureFpsDenseArt(2, ['recruit'], new ArtCache(store, 'b', () => {}));
    expect(store.map.has('sprites:hd2-fps')).toBe(true);
    expect(rayCarriersMissing(2)).toEqual([]);
    expect(generatedSprites(2, 'fps/ray/')).toEqual([]);
    // A later visit: no dense level, no 2× fps frame.
    releaseRayHd(2);
    releaseDense(generatedSprites(2, 'fps/'), 2);
    expect(rayCarriersMissing(2).length).toBeGreaterThan(0);
    setFpsArtPool(() => {
      throw new Error('a restored visit must not build');
    });
    const cache = new ArtCache(store, 'b', () => {});
    await ensureFpsDenseArt(2, ['recruit'], cache);
    expect(cache.restored.get('hd2-fps')).toBeGreaterThan(0);
    expect(rayCarriersMissing(2)).toEqual([]);
    expect(hasFramesAt('fps/hud/bar', 2)).toBe(true);
    expect(generatedSprites(2, 'fps/ray/')).toEqual([]);
    setFpsArtPool(null);
  }, 120_000);
});
