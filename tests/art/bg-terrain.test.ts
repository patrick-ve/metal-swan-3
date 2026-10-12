/**
 * Background generators tile seamlessly and are deterministic; the terrain painter is
 * seamless across chunk borders (chunked painting equals one-piece painting, pixel for pixel).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { inPalette } from '../../src/engine/palette';
import type { PixelBuffer } from '../../src/engine/pixel';
import { terrain as terrainBuilder, Terrain } from '../../src/engine/terrain';
import { getBgGenerator, getTerrainPainter, hasBgGenerator } from '../../src/game/art/art-registry';
import type { TerrainStyleDef } from '../../src/game/art/art-registry';

let BG_IDS: readonly string[] = [];
let demo: typeof import('../../src/game/art/demo-art');

beforeAll(async () => {
  BG_IDS = (await import('../../src/game/art/bg')).BG_GENERATOR_IDS;
  await import('../../src/game/art/terrain-art');
  demo = await import('../../src/game/art/demo-art');
});

/** Fraction of rows where two columns differ. */
function colDiff(b: PixelBuffer, x0: number, x1: number): number {
  let d = 0;
  for (let y = 0; y < b.h; y++) if (b.get(x0, y) !== b.get(x1, y)) d++;
  return d / b.h;
}

describe('background generators', () => {
  it('registers every standard generator', () => {
    for (const id of ['sky-gradient', 'clouds', 'mountains', 'hills', 'treeline', 'jungle', 'city', 'ruins', 'dunes', 'ice-peaks', 'sea']) {
      expect(hasBgGenerator(id), id).toBe(true);
      expect(BG_IDS).toContain(id);
    }
  });

  it('return exactly w × h, use palette colours and are deterministic per seed', () => {
    for (const id of BG_IDS) {
      const gen = getBgGenerator(id);
      const a = gen(256, 160, {}, 7);
      const b = gen(256, 160, {}, 7);
      expect(a.w, id).toBe(256);
      expect(a.h, id).toBe(160);
      expect(Array.from(a.data), id).toEqual(Array.from(b.data));
      expect(a.countOpaque(), `${id} draws something`).toBeGreaterThan(0);
      for (const c of a.data) if ((c & 255) !== 0) expect(inPalette(c), id).toBe(true);
    }
  });

  it('seeds change the noise-based layers', () => {
    for (const id of ['clouds', 'mountains', 'hills', 'treeline', 'jungle', 'city', 'ruins', 'ice-peaks']) {
      const gen = getBgGenerator(id);
      expect(Array.from(gen(256, 160, {}, 1).data), id).not.toEqual(Array.from(gen(256, 160, {}, 2).data));
    }
  });

  it('tile horizontally without a seam', () => {
    // The seam (last column → first column of the next tile) must not differ more than the
    // most different pair of neighbouring columns inside the tile.
    for (const id of BG_IDS) {
      for (const seed of [3, 11]) {
        const b = getBgGenerator(id)(256, 160, {}, seed);
        let worst = 0;
        for (let x = 0; x + 1 < b.w; x++) worst = Math.max(worst, colDiff(b, x, x + 1));
        const seam = colDiff(b, b.w - 1, 0);
        expect(seam, `${id} seed ${seed}: seam ${seam.toFixed(2)} vs worst inner ${worst.toFixed(2)}`).toBeLessThanOrEqual(worst + 1e-9);
      }
    }
  });

  it('honour colour params', () => {
    const red = getBgGenerator('hills')(128, 96, { ramp: 'red' }, 1);
    let reds = 0;
    for (const c of red.data) if ((c & 255) !== 0) reds++;
    expect(reds).toBeGreaterThan(0);
    const sky = getBgGenerator('sky-gradient')(32, 64, { colors: [0x2b5ea6ff, 0xc3e5f9ff], dither: 0 }, 1);
    expect(sky.get(0, 0)).toBe(0x2b5ea6ff);
    expect(sky.get(0, 63)).toBe(0xc3e5f9ff);
  });
});

describe('terrain painter', () => {
  const STYLES: TerrainStyleDef[] = [
    { ground: 'dirt', edge: 'grass', platform: 'wood', solid: 'crate', seed: 1 },
    { ground: 'sand', edge: 'sand', platform: 'rock', solid: 'brick', seed: 2 },
    { ground: 'snow', edge: 'snow', platform: 'ice', solid: 'rock', seed: 3 },
    { ground: 'rock', edge: 'moss', platform: 'rock', solid: 'concrete', seed: 4 },
    { ground: 'metal', edge: 'rust', platform: 'metal', solid: 'metal', seed: 5 },
    { ground: 'concrete', edge: 'tiles', platform: 'metal', solid: 'brick', seed: 6 },
    { ground: 'mud', platform: 'wood', solid: 'crate', seed: 7 },
    { ground: 'ice', edge: 'snow', platform: 'ice', solid: 'metal', seed: 8 },
  ];

  it('is registered', () => {
    expect(getTerrainPainter().name).not.toBe('fallbackTerrainPainter');
  });

  it('is seamless across chunk borders (chunked equals one piece, exactly)', () => {
    const t = demo.demoTerrain();
    for (const style of STYLES) {
      const whole = demo.paintTerrainArea(t, style, 0, 0, 256, 128, 256);
      for (const chunk of [64, 50, 37]) {
        const parts = demo.paintTerrainArea(t, style, 0, 0, 256, 128, chunk);
        expect(Array.from(parts.data), `${style.ground}/${style.edge} chunk ${chunk}`).toEqual(Array.from(whole.data));
      }
      // Vertical split: top and bottom halves painted separately.
      const painter = getTerrainPainter();
      const sample = (x: number, y: number): 0 | 1 | 2 | 3 => t.cellAt(x, y);
      const top = painter(sample, style, 0, 0, 256, 61);
      const bottom = painter(sample, style, 0, 61, 256, 67);
      for (let y = 0; y < 128; y++) {
        for (let x = 0; x < 256; x += 3) {
          const c = y < 61 ? top.get(x, y) : bottom.get(x, y - 61);
          expect(c, `${style.ground} (${x},${y})`).toBe(whole.get(x, y));
        }
      }
    }
  });

  it('paints every cell type, leaves open air mostly clear, palette colours only', () => {
    const t = demo.demoTerrain();
    for (const style of STYLES) {
      const b = demo.paintTerrainArea(t, style, 0, 0, 256, 128, 64);
      let solidPainted = 0;
      let solidTotal = 0;
      let airPainted = 0;
      let airTotal = 0;
      for (let y = 0; y < 128; y++) {
        for (let x = 0; x < 256; x++) {
          const cell = t.cellAt(x, y);
          const c = b.get(x, y);
          if (cell === 0) {
            airTotal++;
            if ((c & 255) !== 0) airPainted++;
          } else {
            solidTotal++;
            if ((c & 255) !== 0) solidPainted++;
          }
          if ((c & 255) !== 0) expect(inPalette(c)).toBe(true);
        }
      }
      expect(solidPainted, style.ground).toBe(solidTotal);
      expect(airPainted / airTotal, style.ground).toBeLessThan(0.03);
    }
  });

  it('gets darker deeper underground', () => {
    const tb = terrainBuilder(64, 160);
    tb.ground().at(0, 20).flat(64);
    const t = new Terrain(tb.build());
    const b = demo.paintTerrainArea(t, { ground: 'dirt', edge: 'grass', seed: 1 }, 0, 0, 64, 160, 64);
    const lum = (y: number): number => {
      let s = 0;
      for (let x = 0; x < 64; x++) {
        const c = b.get(x, y);
        s += ((c >>> 24) & 255) + ((c >>> 16) & 255) + ((c >>> 8) & 255);
      }
      return s / 64;
    };
    expect(lum(110)).toBeLessThan(lum(32));
  });
});
