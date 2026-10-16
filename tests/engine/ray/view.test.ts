import { describe, expect, it } from 'vitest';
import { PAL } from '../../../src/engine/palette';
import { PixelBuffer } from '../../../src/engine/pixel';
import { degToAng } from '../../../src/engine/ray/fixed';
import { DoorTable, RayGrid } from '../../../src/engine/ray/grid';
import { defineRayBillboard, defineRayTexture, getRayBillboard, rayTextureIndex } from '../../../src/engine/ray/textures';
import { RAY_VIEW_H, RAY_VIEW_W, RayView, renderView, type RayScene, type RaySprite } from '../../../src/engine/ray/view';
import { buildTestLevel, hash32 } from './fixture';

defineRayTexture('tv/stripes', () => {
  const b = new PixelBuffer(64, 64);
  for (let y = 0; y < 64; y++) b.rect(0, y, 64, 1, [PAL.steel[1], PAL.steel[3], PAL.red[1]][y % 3]);
  return b;
});
defineRayBillboard('tv/block', { yaws: 1, frames: 1, gen: () => new PixelBuffer(64, 64).rect(16, 0, 32, 64, PAL.gold[2]) });

function room(w: number, h: number): RayScene {
  const g = new RayGrid(w, h);
  const t = rayTextureIndex('tv/stripes');
  for (let x = 0; x < w; x++) {
    g.setWall(x, 0, t);
    g.setWall(x, h - 1, t);
  }
  for (let y = 0; y < h; y++) {
    g.setWall(0, y, t);
    g.setWall(w - 1, y, t);
  }
  return { grid: g, doors: new DoorTable(), push: null, ceil: PAL.stone[0], floor: PAL.stone[2], sprites: [], spriteCount: 0 };
}

function mirrored(buf: PixelBuffer): boolean {
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w >> 1; x++) if (buf.data[y * buf.w + x] !== buf.data[y * buf.w + buf.w - 1 - x]) return false;
  }
  return true;
}

describe('renderView', () => {
  it('has the contract size and reuses its buffers', () => {
    const v = new RayView();
    expect([v.buf.w, v.buf.h, v.zbuf.length, v.focal]).toEqual([RAY_VIEW_W, RAY_VIEW_H, 384, 296]);
    const buf = v.buf;
    const z = v.zbuf;
    const sc = room(9, 9);
    const ver = buf.version;
    renderView(v, sc, { x: 4.5, y: 4.5, angle: 0, eyeZ: 0.5 });
    renderView(v, sc, { x: 4.5, y: 4.5, angle: 100, eyeZ: 0.5 });
    expect(v.buf).toBe(buf);
    expect(v.zbuf).toBe(z);
    expect(buf.version).toBe(ver + 2);
    const v2 = new RayView(384, 176, 2);
    expect([v2.buf.w, v2.buf.h, v2.focal]).toEqual([768, 352, 592]);
  });

  it('is symmetric facing a flat wall, with perpendicular distances (no fisheye)', () => {
    const v = new RayView();
    const sc = room(9, 9);
    renderView(v, sc, { x: 4.5, y: 4.5, angle: 0, eyeZ: 0.5 });
    expect(mirrored(v.buf)).toBe(true);
    for (let x = 0; x < 384; x++) expect(Math.abs(v.zbuf[x] - 3.5)).toBeLessThan(1e-9);
    // Wall height 296 / 3.5 ≈ 84.6 px, centred on y 88 (45.7..130.3): pixel centres in rows 46..129.
    const col = 0;
    expect(v.buf.data[45 * 384 + col]).toBe(PAL.stone[0]);
    expect(v.buf.data[46 * 384 + col]).not.toBe(PAL.stone[0]);
    expect(v.buf.data[129 * 384 + col]).not.toBe(PAL.stone[2]);
    expect(v.buf.data[130 * 384 + col]).toBe(PAL.stone[2]);
    // Every column has the same wall height.
    for (let x = 0; x < 384; x++) expect(v.buf.data[46 * 384 + x]).toBe(v.buf.data[46 * 384]);
    // Facing north: the y-side faces use the dark variant.
    renderView(v, sc, { x: 4.5, y: 4.5, angle: 3072, eyeZ: 0.5 });
    expect(mirrored(v.buf)).toBe(true);
  });

  it('hides a billboard behind a wall and shows it in front', () => {
    const v = new RayView();
    const sc = room(12, 9);
    const t = rayTextureIndex('tv/stripes');
    sc.grid.setWall(6, 4, t);
    const sp: RaySprite = { x: 8.5, y: 4.5, bb: getRayBillboard('tv/block'), frame: 0, yaw: 0 };
    sc.sprites.push(sp);
    const cam = { x: 2.5, y: 4.5, angle: 0, eyeZ: 0.5 };
    sc.spriteCount = 0;
    renderView(v, sc, cam);
    const without = hash32(v.buf.data);
    sc.spriteCount = 1;
    renderView(v, sc, cam);
    expect(hash32(v.buf.data)).toBe(without);
    sp.x = 4.5; // now in front of the wall
    renderView(v, sc, cam);
    expect(v.buf.data[88 * 384 + 192]).toBe(PAL.gold[2]);
    // Behind the camera: not drawn.
    sp.x = 1.5;
    renderView(v, sc, cam);
    expect(hash32(v.buf.data)).toBe(without);
  });

  it('draws sprites far to near', () => {
    defineRayBillboard('tv/red', { yaws: 1, frames: 1, gen: () => new PixelBuffer(64, 64).fill(PAL.red[2]) });
    const v = new RayView();
    const sc = room(12, 9);
    sc.sprites.push(
      { x: 4.5, y: 4.5, bb: getRayBillboard('tv/red'), frame: 0, yaw: 0 },
      { x: 7.5, y: 4.5, bb: getRayBillboard('tv/block'), frame: 0, yaw: 0 },
    );
    sc.spriteCount = 2;
    renderView(v, sc, { x: 2.5, y: 4.5, angle: 0, eyeZ: 0.5 });
    expect(v.buf.data[88 * 384 + 192]).toBe(PAL.red[2]);
  });

  it('squashes around the horizon for the unfold', () => {
    const v = new RayView();
    const sc = room(9, 9);
    renderView(v, sc, { x: 4.5, y: 4.5, angle: 0, eyeZ: 0.5, squash: 0 });
    let rows = 0;
    for (let y = 0; y < 176; y++) if (v.buf.data[y * 384 + 10] !== 0) rows++;
    expect(rows).toBe(1);
    renderView(v, sc, { x: 4.5, y: 4.5, angle: 0, eyeZ: 0.5, squash: 0.5 });
    expect(v.buf.data[43 * 384]).toBe(0);
    expect(v.buf.data[44 * 384]).not.toBe(0);
  });

  it('matches golden hashes at fixed poses (deterministic)', () => {
    const lvl = buildTestLevel();
    const v = new RayView();
    const poses: [number, number, number, number][] = [
      [2.5, 4.5, 0, 0],
      [5.5, 4.5, 0, 0.5],
      [8.5, 4.5, 195, 1],
      [5.5, 6.5, 225, 0],
      [3.3, 7.1, 77, 0],
    ];
    const hashes = poses.map(([x, y, deg, open]) => {
      lvl.doors.open[0] = open;
      renderView(v, lvl.scene, { x, y, angle: degToAng(deg), eyeZ: 0.5 });
      return hash32(v.buf.data).toString(16);
    });
    const again = poses.map(([x, y, deg, open]) => {
      lvl.doors.open[0] = open;
      renderView(v, lvl.scene, { x, y, angle: degToAng(deg), eyeZ: 0.5 });
      return hash32(v.buf.data).toString(16);
    });
    expect(again).toEqual(hashes);
    expect(hashes).toMatchInlineSnapshot(`
      [
        "3ac1457b",
        "f17a0062",
        "f9ae9359",
        "5ae4bd89",
        "f40358d3",
      ]
    `);
  });

  it('renders a 384 × 176 frame fast enough (prints ms per frame)', () => {
    // A 48 × 48 hall with pillars and 40 sprites in view: a heavy pose.
    const sc = room(48, 48);
    const t = rayTextureIndex('tv/stripes');
    for (let y = 6; y < 42; y += 6) for (let x = 6; x < 42; x += 6) sc.grid.setWall(x, y, t);
    const bb = getRayBillboard('tv/block');
    for (let i = 0; i < 40; i++) sc.sprites.push({ x: 10 + (i % 8) * 3.1, y: 18 + Math.floor(i / 8) * 2.3, bb, frame: 0, yaw: 0 });
    sc.spriteCount = 40;
    const v = new RayView();
    const cam = { x: 4.5, y: 24.5, angle: 0, eyeZ: 0.5 };
    for (let i = 0; i < 30; i++) renderView(v, sc, cam);
    const N = 300;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      cam.angle = (i * 3) & 4095;
      renderView(v, sc, cam);
    }
    const ms = (performance.now() - t0) / N;
    console.log(`[ray] renderView 384x176, 40 sprites: ${ms.toFixed(3)} ms/frame`);
    expect(ms).toBeLessThan(25);
  });
});
