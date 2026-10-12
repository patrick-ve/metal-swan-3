/**
 * Sample scenes for the art tools (`npm run sprites -- demo`):
 * - demo/bg         full background stacks (sky + parallax layers), one per frame
 * - demo/bg-layers  every background generator on its own
 * - demo/terrain    one small level per terrain style, painted in two chunks (a seam would show)
 * Also exports `renderBackground` and `paintTerrainArea`, used by tests and tools.
 */
import { PixelBuffer } from '../../engine/pixel';
import { PAL } from '../../engine/palette';
import { defineSprite } from '../../engine/sprites';
import { terrain as terrainBuilder, Terrain } from '../../engine/terrain';
import { getBgGenerator, getTerrainPainter } from './art-registry';
import type { BackgroundDef, TerrainStyleDef } from './art-registry';

/** Composite a background stack into a w × h view at camera x (no entities). */
export function renderBackground(bg: BackgroundDef, w: number, h: number, camX = 0, seed = 1): PixelBuffer {
  const out = new PixelBuffer(w, h).fill(bg.sky);
  bg.layers.forEach((L, i) => {
    if (L.front) return;
    const lw = L.width ?? 512;
    const lh = L.height ?? 216;
    const buf = getBgGenerator(L.gen)(lw, lh, L.params ?? {}, seed + i * 17);
    const ox = Math.round((L.offsetX ?? 0) - camX * L.factorX);
    const oy = Math.round(L.offsetY ?? 0);
    if (L.repeatX === false) {
      out.blit(buf, ox, oy);
      return;
    }
    let x = ((ox % lw) + lw) % lw;
    if (x > 0) x -= lw;
    for (; x < w; x += lw) out.blit(buf, x, oy);
  });
  return out;
}

/** Paint a terrain area with the registered painter in vertical chunks of `chunk` px. */
export function paintTerrainArea(t: Terrain, style: TerrainStyleDef, x0: number, y0: number, w: number, h: number, chunk = 64): PixelBuffer {
  const painter = getTerrainPainter();
  const sample = (x: number, y: number): 0 | 1 | 2 | 3 => t.cellAt(x, y);
  const out = new PixelBuffer(w, h);
  for (let cx = 0; cx < w; cx += chunk) {
    const cw = Math.min(chunk, w - cx);
    out.blit(painter(sample, style, x0 + cx, y0, cw, h), cx, 0);
  }
  return out;
}

/** A compact test level: slopes, a step, a pit, platforms and solid blocks. */
export function demoTerrain(): Terrain {
  const t = terrainBuilder(256, 128);
  t.ground().at(0, 96).flat(40).slope(30, -22).flat(26).step(-10).flat(20).slope(24, 30).flat(14).gap(18).flat(30).slope(20, -14).flat(40);
  t.platform(70, 46, 40).platform(176, 52, 44);
  t.platforms().at(120, 30).to(150, 24).to(170, 24);
  t.solid(206, 58, 32, 26).solid(10, 64, 18, 18);
  return new Terrain(t.build());
}

const STYLES: readonly TerrainStyleDef[] = [
  { ground: 'dirt', edge: 'grass', platform: 'wood', solid: 'crate', seed: 1 },
  { ground: 'sand', edge: 'sand', platform: 'rock', solid: 'brick', seed: 2 },
  { ground: 'snow', edge: 'snow', platform: 'ice', solid: 'rock', seed: 3 },
  { ground: 'rock', edge: 'moss', platform: 'rock', solid: 'concrete', seed: 4 },
  { ground: 'metal', edge: 'rust', platform: 'metal', solid: 'metal', seed: 5 },
  { ground: 'concrete', edge: 'tiles', platform: 'metal', solid: 'brick', seed: 6 },
  { ground: 'mud', edge: 'grass', platform: 'wood', solid: 'crate', seed: 7 },
  { ground: 'ice', edge: 'snow', platform: 'ice', solid: 'metal', seed: 8 },
];

/** Standard background stacks (examples for mission agents). */
export const DEMO_BACKGROUNDS: Readonly<Record<string, BackgroundDef>> = {
  grassland: {
    sky: PAL.sky[3],
    layers: [
      { gen: 'sky-gradient', params: { ramp: 'sky' }, factorX: 0 },
      { gen: 'clouds', params: { y: 0.18, count: 4 }, factorX: 0.05 },
      { gen: 'mountains', params: { ramp: [PAL.steel[2], PAL.steel[3], PAL.sky[2], PAL.snow[0]], y: 0.3, height: 0.45, snow: 0.7, layers: 2 }, factorX: 0.1 },
      { gen: 'hills', params: { y: 0.62, height: 0.18 }, factorX: 0.25 },
      { gen: 'treeline', params: { y: 0.7, size: 8 }, factorX: 0.45 },
    ],
  },
  desert: {
    sky: PAL.sand[3],
    layers: [
      { gen: 'sky-gradient', params: { colors: [PAL.sky[1], PAL.sky[2], PAL.sky[3], PAL.sand[3]] , sun: { x: 0.75, y: 0.22, r: 9 } }, factorX: 0 },
      { gen: 'mountains', params: { ramp: [PAL.rust[1], PAL.sand[0], PAL.sand[1], PAL.sand[2]], y: 0.42, height: 0.3, scale: 140 }, factorX: 0.1 },
      { gen: 'dunes', params: { y: 0.6, height: 0.3 }, factorX: 0.3 },
    ],
  },
  snow: {
    sky: PAL.snow[1],
    layers: [
      { gen: 'sky-gradient', params: { colors: [PAL.steel[2], PAL.steel[3], PAL.snow[0], PAL.snow[1]] }, factorX: 0 },
      { gen: 'ice-peaks', params: { y: 0.2, height: 0.55 }, factorX: 0.08 },
      { gen: 'clouds', params: { y: 0.5, count: 3, ramp: [PAL.steel[3], PAL.snow[0], PAL.snow[1], PAL.snow[3]] }, factorX: 0.12 },
      { gen: 'mountains', params: { ramp: [PAL.navy[1], PAL.steel[1], PAL.steel[2], PAL.steel[3]], y: 0.55, height: 0.35, snow: 0.45 }, factorX: 0.25 },
    ],
  },
  city: {
    sky: PAL.navy[0],
    layers: [
      { gen: 'sky-gradient', params: { colors: [PAL.navy[0], PAL.navy[1], PAL.purple[0], PAL.purple[1]], stars: 40, sun: { x: 0.2, y: 0.18, r: 7 }, moon: true }, factorX: 0 },
      { gen: 'city', params: { y: 0.3, height: 0.5, ramp: [PAL.navy[0], PAL.navy[1], PAL.purple[0], PAL.steel[0], PAL.steel[1]], lit: 0.3 }, factorX: 0.15 },
      { gen: 'city', params: { y: 0.45, height: 0.45, lit: 0.45 }, factorX: 0.35 },
    ],
  },
  jungle: {
    sky: PAL.teal[2],
    layers: [
      { gen: 'sky-gradient', params: { colors: [PAL.teal[1], PAL.teal[2], PAL.green[3]] }, factorX: 0 },
      { gen: 'hills', params: { ramp: [PAL.teal[0], PAL.teal[1], PAL.green[2]], y: 0.35, height: 0.3, bushes: false }, factorX: 0.1 },
      { gen: 'jungle', params: { y: 0.0, height: 0.85 }, factorX: 0.35 },
    ],
  },
  ruins: {
    sky: PAL.orange[2],
    layers: [
      { gen: 'sky-gradient', params: { colors: [PAL.purple[1], PAL.pink[1], PAL.red[3], PAL.orange[2], PAL.gold[2]], sun: { x: 0.6, y: 0.62, r: 14 } }, factorX: 0 },
      { gen: 'ruins', params: { ramp: [PAL.purple[0], PAL.stone[0], PAL.stone[1], PAL.stone[2]], y: 0.3, height: 0.55 }, factorX: 0.2 },
    ],
  },
  sea: {
    sky: PAL.sky[3],
    layers: [
      { gen: 'sky-gradient', params: { ramp: 'sky', y1: 0.6 }, factorX: 0 },
      { gen: 'clouds', params: { y: 0.3, count: 3, size: 11 }, factorX: 0.05 },
      { gen: 'sea', params: { y: 0.58 }, factorX: 0.2 },
    ],
  },
};

const LAYER_SAMPLES: ReadonlyArray<[string, Record<string, unknown>]> = [
  ['sky-gradient', { ramp: 'sky', stars: 12 }],
  ['clouds', { y: 0.4 }],
  ['mountains', { y: 0.2, height: 0.7, snow: true }],
  ['hills', { y: 0.35, height: 0.4 }],
  ['treeline', { y: 0.3 }],
  ['jungle', {}],
  ['city', { y: 0.2, height: 0.7 }],
  ['ruins', { y: 0.2, height: 0.7 }],
  ['dunes', { y: 0.35, height: 0.5 }],
  ['ice-peaks', { y: 0.1, height: 0.8 }],
  ['sea', { y: 0.3 }],
];

export function defineArtDemos(): void {
  defineSprite(
    'demo/bg',
    () => Object.values(DEMO_BACKGROUNDS).map((bg) => renderBackground(bg, 320, 216, 37, 3)),
    { anchor: 'top-left' },
  );
  defineSprite(
    'demo/bg-layers',
    () =>
      LAYER_SAMPLES.map(([id, params], i) => {
        const b = new PixelBuffer(192, 96).fill(PAL.navy[1]);
        // Two copies side by side (the right half starts mid-tile) show the seam at x = 96.
        const tile = getBgGenerator(id)(96, 96, params, 5 + i);
        b.blit(tile, 0, 0).blit(tile, 96, 0);
        return b;
      }),
    { anchor: 'top-left' },
  );
  defineSprite(
    'demo/terrain',
    () => {
      const t = demoTerrain();
      const sky = renderBackground(DEMO_BACKGROUNDS.grassland, 256, 128, 0, 1);
      return STYLES.map((style) => {
        const b = sky.clone();
        b.blit(paintTerrainArea(t, style, 0, 0, 256, 128, 64), 0, 0);
        return b;
      });
    },
    { anchor: 'top-left' },
  );
}
