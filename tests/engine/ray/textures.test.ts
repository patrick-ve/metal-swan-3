import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAGENTA } from '../../../src/engine/color';
import { INK, PAL, stepShade } from '../../../src/engine/palette';
import { PixelBuffer } from '../../../src/engine/pixel';
import {
  billboardColumns,
  billboardSpans,
  billboardYaw,
  defineRayBillboard,
  defineRayTexture,
  getRayBillboard,
  hasRayTexture,
  listRayBillboards,
  listRayTextures,
  prepareRayAssets,
  RAY_TEX,
  rayTextureColumns,
  rayTextureIndex,
} from '../../../src/engine/ray/textures';

const colors = [PAL.steel[1], PAL.steel[2], PAL.red[1], PAL.gold[2], PAL.green[2], PAL.sky[1]];

function patterned(): PixelBuffer {
  const b = new PixelBuffer(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) b.data[y * 64 + x] = colors[(x * 7 + y * 3) % colors.length];
  return b;
}

afterEach(() => vi.restoreAllMocks());

describe('ray textures', () => {
  it('stores textures column-major with a dark variant and stable indices', () => {
    defineRayTexture('tt/a', patterned);
    defineRayTexture('tt/b', patterned);
    const ia = rayTextureIndex('tt/a');
    const ib = rayTextureIndex('tt/b');
    expect(ia).toBeGreaterThan(0);
    expect(ib).toBe(ia + 1);
    defineRayTexture('tt/a', patterned); // redefining keeps the index
    expect(rayTextureIndex('tt/a')).toBe(ia);
    const src = patterned();
    const cols = rayTextureColumns(ia);
    const dark = rayTextureColumns(ia, true);
    for (let u = 0; u < RAY_TEX; u++) {
      for (let v = 0; v < RAY_TEX; v++) {
        expect(cols[u * 64 + v]).toBe(src.data[v * 64 + u]);
        expect(dark[u * 64 + v]).toBe(stepShade(src.data[v * 64 + u], -1) >>> 0);
      }
    }
    expect(hasRayTexture('tt/a')).toBe(true);
    expect(listRayTextures()).toEqual(expect.arrayContaining(['tt/a', 'tt/b']));
  });

  it('falls back to a magenta checker for unknown ids and failing generators, warning once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(rayTextureIndex('tt/missing')).toBe(0);
    expect(rayTextureIndex('tt/missing')).toBe(0);
    expect(warn).toHaveBeenCalledTimes(1);
    const fb = rayTextureColumns(0);
    expect(fb[0]).toBe(MAGENTA);
    expect(fb[8 * 64]).toBe(INK); // u 8, v 0: the next checker square
    defineRayTexture('tt/broken', () => {
      throw new Error('boom');
    });
    const cols = rayTextureColumns(rayTextureIndex('tt/broken'));
    expect(cols[0]).toBe(MAGENTA);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(rayTextureColumns(9999)[0]).toBe(MAGENTA);
  });

  it('fills transparent texels with ink and resizes a wrong size', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    defineRayTexture('tt/holes', () => new PixelBuffer(64, 64).rect(0, 0, 64, 32, PAL.red[2]));
    const cols = rayTextureColumns(rayTextureIndex('tt/holes'));
    expect(cols[0]).toBe(PAL.red[2]);
    expect(cols[40]).toBe(INK);
    defineRayTexture('tt/small', () => new PixelBuffer(32, 32).fill(PAL.gold[2]));
    expect(rayTextureColumns(rayTextureIndex('tt/small'))[64 * 64 - 1]).toBe(PAL.gold[2]);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('ray billboards', () => {
  it('builds spans per column and mirrors yaws 5..7 from 3..1', () => {
    const calls: string[] = [];
    defineRayBillboard('tb/man', {
      yaws: 8,
      frames: 2,
      gen: (f, k) => {
        calls.push(`${f}/${k}`);
        const b = new PixelBuffer(64, 64);
        b.rect(10 + k, 20 + f, 3, 30, colors[k]); // columns 10+k..12+k, rows 20+f..49+f
        return b;
      },
    });
    const bb = getRayBillboard('tb/man');
    expect([bb.size, bb.yaws, bb.frames, bb.worldW, bb.worldH]).toEqual([64, 8, 2, 1, 1]);
    const s0 = billboardSpans(bb, 0, 0);
    expect(s0[9]).toBe(0xffff);
    expect(s0[10]).toBe((20 << 8) | 49);
    expect(billboardSpans(bb, 1, 0)[10]).toBe((21 << 8) | 50);
    expect(calls.sort()).toEqual(['0/0', '0/1', '0/2', '0/3', '0/4', '1/0', '1/1', '1/2', '1/3', '1/4']);
    for (const [k, m] of [[3, 5], [2, 6], [1, 7]]) {
      const a = billboardColumns(bb, 0, k);
      const b = billboardColumns(bb, 0, m);
      const sa = billboardSpans(bb, 0, k);
      const sb = billboardSpans(bb, 0, m);
      for (let u = 0; u < 64; u++) {
        expect(sb[u]).toBe(sa[63 - u]);
        for (let v = 0; v < 64; v++) expect(b[u * 64 + v]).toBe(a[(63 - u) * 64 + v]);
      }
    }
    // Frames wrap; yaw is masked.
    expect(billboardColumns(bb, 2, 8)).toBe(billboardColumns(bb, 0, 0));
  });

  it('keeps one yaw for yaws: 1 and honours size and world size', () => {
    defineRayBillboard('tb/mech', { size: 96, yaws: 1, frames: 1, worldH: 1.25, gen: () => new PixelBuffer(96, 96).fill(PAL.steel[2]) });
    const bb = getRayBillboard('tb/mech');
    expect([bb.size, bb.worldW, bb.worldH]).toEqual([96, 1.5, 1.25]);
    expect(billboardColumns(bb, 0, 5)).toBe(billboardColumns(bb, 0, 0));
    expect(billboardSpans(bb, 0, 3)[0]).toBe((0 << 8) | 95);
    expect(listRayBillboards()).toEqual(expect.arrayContaining(['tb/man', 'tb/mech']));
  });

  it('falls back to magenta for unknown ids and failing frames', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fb = getRayBillboard('tb/missing');
    getRayBillboard('tb/missing');
    expect(warn).toHaveBeenCalledTimes(1);
    expect([fb.size, fb.yaws, fb.frames]).toEqual([64, 1, 1]);
    expect(billboardColumns(fb, 0, 0)[0]).toBe(MAGENTA);
    defineRayBillboard('tb/bad', { yaws: 1, frames: 2, gen: (f) => {
      if (f === 1) throw new Error('nope');
      return new PixelBuffer(64, 64);
    } });
    const bad = getRayBillboard('tb/bad');
    expect(billboardSpans(bad, 0, 0)[0]).toBe(0xffff);
    expect(billboardColumns(bad, 1, 0)[0]).toBe(MAGENTA);
  });

  it('picks the yaw from the actor angle and the viewer position', () => {
    // Actor at (5, 5); viewer south of it at (5, 8).
    expect(billboardYaw(3072, 5, 5, 5, 8)).toBe(4); // faces north: its back
    expect(billboardYaw(1024, 5, 5, 5, 8)).toBe(0); // faces the viewer
    expect(billboardYaw(2048, 5, 5, 5, 8)).toBe(2); // faces west = the viewer's left
    expect(billboardYaw(0, 5, 5, 5, 8)).toBe(6);
    expect(billboardYaw(1024 + 512, 5, 5, 5, 8)).toBe(1);
    expect(billboardYaw(1024 + 255, 5, 5, 5, 8)).toBe(0);
    expect(billboardYaw(1024 - 257, 5, 5, 5, 8)).toBe(7);
  });
});

describe('prepareRayAssets', () => {
  it('builds in time slices, reports progress and failures, never rejects', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (let i = 0; i < 6; i++) defineRayTexture(`tp/t${i}`, patterned);
    defineRayTexture('tp/fail', () => {
      throw new Error('x');
    });
    defineRayBillboard('tp/bb', { yaws: 8, frames: 1, gen: () => new PixelBuffer(64, 64) });
    let t = 0;
    let yields = 0;
    const progress: [number, number][] = [];
    const r = await prepareRayAssets(['tp/'], (d, n) => progress.push([d, n]), {
      timeBudgetMs: 10,
      now: () => (t += 4),
      yieldFn: async () => {
        yields++;
      },
    });
    expect(r.failed).toEqual(['tp/fail']);
    expect(progress.at(-1)).toEqual([8, 8]);
    expect(yields).toBe(progress.length - 1);
    expect(yields).toBeGreaterThan(1);
    for (let i = 1; i < progress.length; i++) expect(progress[i][0]).toBeGreaterThan(progress[i - 1][0]);
    const empty: [number, number][] = [];
    await prepareRayAssets(['nothing/'], (d, n) => empty.push([d, n]));
    expect(empty).toEqual([[0, 0]]);
  });
});
