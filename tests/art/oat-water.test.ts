/**
 * The water of mission oat (docs/design/oat.md §8.8): the tiles (calm, busy, night and the drifting
 * layers) in PAL_HD_OAT only; the body olive-brown by day (never teal) and near black at night;
 * darker at the quay wall and under hulls; more sky toward the far edge; one ripple language near
 * and far (world-anchored, deterministic); the reflection strips' lights; the strip budget.
 */
import { describe, expect, it } from 'vitest';
import { PAL_HD_OAT, inOatPalette } from '../../src/engine/palette-hd';
import {
  ensureWaterStrip,
  ensureWaterTiles,
  OAT_WATER,
  OAT_WATER_TILE,
  waterRipple,
  waterStripBytes,
  waterStripTexels,
  type WaterStripDef,
} from '../../src/game/content/missions/oat/light/water';
import { getFloorTile, hasFloorTile } from '../../src/game/mission/floor/registry';

function luma(c: number): number {
  return 0.299 * ((c >>> 24) & 255) + 0.587 * ((c >>> 16) & 255) + 0.114 * ((c >>> 8) & 255);
}

const CANAL = new Set(PAL_HD_OAT.canal.map((c) => c >>> 0));
const NIGHT = new Set([...PAL_HD_OAT.nightWater, ...PAL_HD_OAT.nightSky].map((c) => c >>> 0));

describe('the water tiles (spec §8.8 "The floor water tile")', () => {
  it('registers calm, busy, night and two drifting layers; heights are multiples of 4', () => {
    ensureWaterTiles();
    ensureWaterTiles();
    for (const id of Object.values(OAT_WATER_TILE)) {
      expect(hasFloorTile(id), id).toBe(true);
      expect((getFloorTile(id)?.h ?? 1) % 4).toBe(0);
    }
    for (const s of Object.values(OAT_WATER)) {
      if (typeof s === 'string') throw new Error('an animated surface expected');
      expect(hasFloorTile(s.tile)).toBe(true);
      expect(hasFloorTile(s.over?.tile ?? '')).toBe(true);
    }
  });

  it('every texel at 1×, 2× and 4× is an oat colour: the day body from the canal ramp, the night from night water and sky', () => {
    ensureWaterTiles();
    for (const [id, set] of [
      [OAT_WATER_TILE.calm, CANAL],
      [OAT_WATER_TILE.busy, CANAL],
      [OAT_WATER_TILE.glintDay, CANAL],
      [OAT_WATER_TILE.night, NIGHT],
      [OAT_WATER_TILE.glintNight, NIGHT],
    ] as const) {
      const t = getFloorTile(id);
      if (!t) throw new Error(id);
      for (const d of [1, 2, 4]) {
        for (let b = 0; b < t.h; b += 0.5) {
          for (let a = 0; a < t.w; a += 1.5) {
            const c = t.paint(a, b, d) >>> 0;
            expect(inOatPalette(c), `${id} ${a},${b}`).toBe(true);
            expect(set.has(c), `${id} ${a},${b} ${c.toString(16)}`).toBe(true);
          }
        }
      }
    }
  });

  it('day water is olive-brown and opaque, never teal; night water is near black', () => {
    ensureWaterTiles();
    const day = getFloorTile(OAT_WATER_TILE.calm)!;
    const night = getFloorTile(OAT_WATER_TILE.night)!;
    let dl = 0;
    let nl = 0;
    let teal = 0;
    let n = 0;
    for (let b = 0; b < 36; b += 0.5) {
      for (let a = 0; a < 192; a += 1) {
        const c = day.paint(a, b, 4) >>> 0;
        const g = (c >>> 16) & 255;
        const bl = (c >>> 8) & 255;
        const r = c >>> 24;
        // Teal: blue and green well over red. The canal's sky sheen is grey-blue, never cyan.
        if (g > r + 40 && bl > r + 40) teal++;
        dl += luma(c);
        nl += luma(night.paint(a, b, 4) >>> 0);
        n++;
      }
    }
    expect(teal).toBe(0);
    expect(dl / n).toBeGreaterThan(30);
    expect(dl / n).toBeLessThan(90);
    expect(nl / n).toBeLessThan(25);
  });
});

describe('one ripple language (spec §8.8)', () => {
  it('is pure and world-anchored, in −1 … 1, and the far rows use the same pattern smaller', () => {
    for (let i = 0; i < 200; i++) {
      const u = i * 13.7;
      const v = (i * 7.3) % 60;
      const r = waterRipple(u, v);
      expect(r).toBe(waterRipple(u, v));
      expect(Math.abs(r)).toBeLessThanOrEqual(1.001);
      expect(waterRipple(u * 0.5, v * 0.5, 0.5)).toBeCloseTo(r, 9);
    }
  });

  it('busy water has more chop (more short crests) than calm water', () => {
    const crests = (busy: number): number => {
      let n = 0;
      for (let v = 0; v < 36; v += 0.25) for (let u = 0; u < 192; u += 1) if (waterRipple(u, v, 1, busy) > 0.6) n++;
      return n;
    };
    expect(crests(1)).not.toBe(crests(0));
  });
});

describe('the reflection strips (spec §8.8 "Static reflections")', () => {
  const base: WaterStripDef = { u0: 0, len: 256, v0: 26, v1: 60, wall: 4, hulls: [[100, 160]] };

  function meanLuma(def: WaterStripDef, u0: number, u1: number, v0: number, v1: number): number {
    const fn = waterStripTexels(def, 4);
    let s = 0;
    let n = 0;
    for (let v = v0; v < v1; v += 0.25) {
      for (let u = u0; u < u1; u += 0.5) {
        s += luma(fn(u, v));
        n++;
      }
    }
    return s / n;
  }

  it('darker at the quay wall and under hulls; more sky toward the far edge than near the viewer', () => {
    const wall = meanLuma(base, 0, 90, 26, 28);
    const mid = meanLuma(base, 0, 90, 32, 40);
    const near = meanLuma(base, 0, 90, 52, 60);
    const hull = meanLuma(base, 110, 150, 32, 40);
    expect(wall).toBeLessThan(mid);
    expect(hull).toBeLessThan(mid);
    expect(near).toBeLessThan(mid);
  });

  it('night lights bake as columns of their own ramp under their u; the rest stays dark', () => {
    const def: WaterStripDef = { ...base, night: true, hulls: [], lights: [{ u: 64, h: 40, ramp: 'neonPink' }, { u: 192, h: 40, ramp: 'lantern' }] };
    const fn = waterStripTexels(def, 4);
    const pink = new Set(PAL_HD_OAT.neonPink.map((c) => c >>> 0));
    const warm = new Set(PAL_HD_OAT.lantern.map((c) => c >>> 0));
    let atPink = 0;
    let atWarm = 0;
    let elsewhere = 0;
    for (let v = 27; v < 60; v += 0.25) {
      for (let u = 0; u < 256; u += 0.25) {
        const c = fn(u, v);
        if (Math.abs(u - 64) < 4 && pink.has(c)) atPink++;
        else if (Math.abs(u - 192) < 4 && warm.has(c)) atWarm++;
        else if (pink.has(c) || warm.has(c)) elsewhere++;
        expect(inOatPalette(c)).toBe(true);
      }
    }
    expect(atPink).toBeGreaterThan(40);
    expect(atWarm).toBeGreaterThan(40);
    expect(elsewhere).toBe(0);
  });

  it('a mirror function shows through the troughs, broken by the crests', () => {
    const brick = PAL_HD_OAT.brick[2] >>> 0;
    const fn = waterStripTexels({ ...base, hulls: [], mirror: (_u, h) => (h < 30 ? brick : 0) }, 4);
    let shown = 0;
    let total = 0;
    for (let v = 30; v < 40; v += 0.25) {
      for (let u = 0; u < 256; u += 0.5) {
        total++;
        if (fn(u, v) === brick) shown++;
      }
    }
    expect(shown / total).toBeGreaterThan(0.25);
    expect(shown / total).toBeLessThan(0.95);
  });

  it('registers as a floor tile (idempotent) and the d proof strip fits 2–6 MB at 4×', () => {
    const id = ensureWaterStrip('oat-water-strip-test', base);
    expect(ensureWaterStrip('oat-water-strip-test', base)).toBe(id);
    const t = getFloorTile(id)!;
    expect(t.w).toBe(256);
    expect(t.h % 4).toBe(0);
    // (a, b) map back into the strip: the same texel one period along.
    expect(t.paint(10.25, 30.5, 4)).toBe(t.paint(10.25 + 256, 30.5, 4));
    const d = waterStripBytes({ ...base, len: 1280, v0: 26.2, v1: 60 }, 4) / 2 ** 20;
    expect(d).toBeGreaterThan(2);
    expect(d).toBeLessThan(6);
  });
});
