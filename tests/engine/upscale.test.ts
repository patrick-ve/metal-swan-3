/**
 * Pixel-art upscalers (src/engine/upscale.ts): sizes, the 'pixel' identity, palette-exact
 * 'smooth', mirror symmetry (the renderers draw flipped variants by transform), determinism,
 * simple shapes, and a speed smoke test on real sprites.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { PixelBuffer, seededRand } from '../../src/engine/pixel';
import { getFrames, listSprites } from '../../src/engine/sprites';
import { UPSCALE_MODES, upscale, upscaleFactor, type UpscaleMode } from '../../src/engine/upscale';

const MODES = UPSCALE_MODES;
const FILTERS: readonly UpscaleMode[] = ['smooth', 'xbr'];

/** 30 real sprites from mission ams and the shared sets (id, frame). */
const REAL: ReadonlyArray<readonly [string, number]> = [
  ['boss/ams-mayor/head-0', 0],
  ['boss/ams-mayor/head-2', 3],
  ['boss/ams-mayor/body-0', 0],
  ['boss/ams-mayor/stamp-arm-0', 2],
  ['boss/ams-mayor/legs', 1],
  ['boss/ams-mayor/medallion-0', 0],
  ['boss/ams-mayor/lash', 0],
  ['boss/ams-mayor/noise-letter', 2],
  ['char/recruit/torso-pistol-idle', 0],
  ['char/recruit/torso-heavy-shoot-diag-up', 1],
  ['char/recruit/legs-run', 3],
  ['char/recruit/portrait', 0],
  ['char/recruit/die', 4],
  ['char/recruit/ride-cheer', 1],
  ['enemy/fatbike-youth-0b/idle', 0],
  ['enemy/fatbike-youth-0b/bike', 2],
  ['enemy/fatbike-youth-0b/die-crush', 5],
  ['enemy/seagull/idle', 1],
  ['enemy/seagull/feather', 0],
  ['enemy/seagull/gag-fries', 2],
  ['enemy/handhaver/walk', 2],
  ['enemy/handhaver/throw', 1],
  ['enemy/handhaver-b/tell', 0],
  ['item/crate', 0],
  ['item/crate-break', 2],
  ['item/crate-chute', 1],
  ['item/pickup-f', 0],
  ['item/pickup-1up', 2],
  ['item/pickup-bombs', 0],
  ['item/crate-legion-hit', 1],
];

let real: PixelBuffer[] = [];

beforeAll(async () => {
  await import('../../src/game/content/characters/art');
  await import('../../src/game/content/items/art');
  await import('../../src/game/content/locals/art');
  await import('../../src/game/content/bosses/ams/art');
  await import('../../src/game/content/bosses/ams/art-shots');
  real = REAL.map(([id, i]) => {
    expect(listSprites(id), `${id} is registered`).toContain(id);
    return getFrames(id)[i].buf;
  });
}, 60_000);

/** Random sprite: a few palette colours in blobs, lines and dither on transparency. */
function randomSprite(seed: number, w = 24, h = 20): PixelBuffer {
  const rand = seededRand(seed);
  const pal = [0x101418ff, 0xd04030ff, 0xf0e8c8ff, 0x3060a0ff, 0x58b040ff];
  const b = new PixelBuffer(w, h);
  for (let k = 0; k < 6; k++) {
    const c = pal[Math.floor(rand() * pal.length)];
    const x = Math.floor(rand() * w);
    const y = Math.floor(rand() * h);
    switch (k % 3) {
      case 0:
        b.circle(x, y, 1 + Math.floor(rand() * 5), c);
        break;
      case 1:
        b.line(x, y, Math.floor(rand() * w), Math.floor(rand() * h), c);
        break;
      default:
        b.dither(x, y, 6, 5, c, 0.5);
    }
  }
  // A few transparent pixels with stray colour bits (must count as plain transparency).
  b.set(0, 0, 0x12345600);
  return b;
}

function sameBuffer(a: PixelBuffer, b: PixelBuffer): boolean {
  if (a.w !== b.w || a.h !== b.h) return false;
  for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) return false;
  return true;
}

/** Input colours, with every transparent pixel as 0. */
function palette(b: PixelBuffer): Set<number> {
  const s = new Set<number>();
  for (const c of b.data) s.add((c & 255) === 0 ? 0 : c);
  return s;
}

describe('upscale: sizes and identity', () => {
  it('has integer factors: 1 for pixel, 2..4 for the filters', () => {
    expect(upscaleFactor('pixel')).toBe(1);
    for (const m of FILTERS) {
      const f = upscaleFactor(m);
      expect(Number.isInteger(f)).toBe(true);
      expect(f).toBeGreaterThanOrEqual(2);
      expect(f).toBeLessThanOrEqual(4);
    }
  });

  it('returns size × factor, also for empty and 1×1 buffers', () => {
    for (const m of MODES) {
      const f = upscaleFactor(m);
      for (const [w, h] of [[0, 0], [0, 3], [4, 0], [1, 1], [1, 5], [7, 1], [7, 3], [24, 20]]) {
        const src = new PixelBuffer(w, h).fill(0xd04030ff);
        const out = upscale(src, m);
        expect([out.w, out.h], `${m} ${w}×${h}`).toEqual([w * f, h * f]);
        if (w * h > 0) expect(out.data.every((c) => c === 0xd04030ff), `${m} ${w}×${h} solid`).toBe(true);
      }
    }
  });

  it("'pixel' returns the input buffer itself", () => {
    const b = randomSprite(1);
    expect(upscale(b, 'pixel')).toBe(b);
  });
});

describe("upscale: 'smooth' is palette-exact", () => {
  it('keeps the palette and binary alpha on random sprites', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const b = randomSprite(seed);
      const pal = palette(b);
      for (const c of upscale(b, 'smooth').data) {
        expect(pal.has(c), `seed ${seed}: colour ${c.toString(16)}`).toBe(true);
        expect((c & 255) === 0 || (c & 255) === 255).toBe(true);
      }
    }
  });

  it('keeps the palette and binary alpha on real sprites', () => {
    real.forEach((b, k) => {
      const pal = palette(b);
      const bad = [...upscale(b, 'smooth').data].filter((c) => !pal.has(c) || ((c & 255) !== 0 && (c & 255) !== 255));
      expect(bad.length, REAL[k][0]).toBe(0);
    });
  });
});

describe('upscale: mirror symmetry, determinism, purity', () => {
  it('is mirror-symmetric in X and in Y for every mode (real sprites)', () => {
    for (const m of MODES) {
      real.forEach((b, k) => {
        const u = upscale(b, m);
        expect(sameBuffer(upscale(b.flipped(true, false), m), u.flipped(true, false)), `${m} ${REAL[k][0]} flipX`).toBe(true);
        expect(sameBuffer(upscale(b.flipped(false, true), m), u.flipped(false, true)), `${m} ${REAL[k][0]} flipY`).toBe(true);
      });
    }
  });

  it('is mirror-symmetric on random sprites and fully opaque buffers', () => {
    for (const m of FILTERS) {
      for (let seed = 1; seed <= 20; seed++) {
        const b = randomSprite(seed, 17, 13);
        if (seed % 4 === 0) b.data.forEach((c, i) => (b.data[i] = (c & 255) === 0 ? 0x223344ff : c));
        const u = upscale(b, m);
        expect(sameBuffer(upscale(b.flipped(true, false), m), u.flipped(true, false)), `${m} ${seed} x`).toBe(true);
        expect(sameBuffer(upscale(b.flipped(false, true), m), u.flipped(false, true)), `${m} ${seed} y`).toBe(true);
      }
    }
  });

  it('is deterministic and never mutates the input', () => {
    for (const m of FILTERS) {
      for (const b of real.slice(0, 8)) {
        const before = b.data.slice();
        const version = b.version;
        const a = upscale(b, m);
        const c = upscale(b, m);
        expect(a).not.toBe(b);
        expect(sameBuffer(a, c)).toBe(true);
        expect(b.version).toBe(version);
        expect(b.data).toEqual(before);
      }
    }
  });
});

describe('upscale: shapes', () => {
  it('keeps a solid block solid and does not bleed outside it', () => {
    const c = 0x336699ff;
    const b = new PixelBuffer(10, 9);
    b.rect(2, 2, 6, 5, c);
    for (const m of FILTERS) {
      const f = upscaleFactor(m);
      const u = upscale(b, m);
      for (let y = 0; y < u.h; y++) {
        for (let x = 0; x < u.w; x++) {
          const sx = Math.floor(x / f);
          const sy = Math.floor(y / f);
          const inside = sx >= 2 && sx < 8 && sy >= 2 && sy < 7;
          const corner = (sx === 2 || sx === 7) && (sy === 2 || sy === 6);
          const v = u.data[y * u.w + x];
          if (!inside) expect(v, `${m} outside ${x},${y}`).toBe(0);
          // MMPX keeps square corners; xBR rounds the four corner pixels only.
          else if (!corner || m === 'smooth') expect(v, `${m} inside ${x},${y}`).toBe(c);
        }
      }
    }
  });

  it('turns a 1-px diagonal into a smooth diagonal (steps of 1 output pixel)', () => {
    for (const col of [0x202020ff, 0xf0f0f0ff]) {
      const b = new PixelBuffer(8, 8);
      for (let i = 0; i < 8; i++) b.set(i, i, col);
      for (const m of FILTERS) {
        const f = upscaleFactor(m);
        const u = upscale(b, m);
        // Leftmost mostly-opaque pixel per row, away from the line ends.
        const left: number[] = [];
        for (let y = f; y < u.h - f; y++) {
          let x = 0;
          while (x < u.w && (u.data[y * u.w + x] & 255) < 128) x++;
          left.push(x);
        }
        for (let k = 1; k < left.length; k++) expect(left[k] - left[k - 1], `${m} row ${k}`).toBe(1);
      }
    }
    // Nearest neighbour, for contrast, steps by the whole factor.
    const n = new PixelBuffer(4, 4);
    for (let i = 0; i < 4; i++) n.set(i, i, 0x202020ff);
    expect(n.scaled(2).get(2, 2)).toBe(0x202020ff);
    expect(n.scaled(2).get(2, 1)).toBe(0);
  });

  it("'xbr' antialiases: new colours and partial alpha at edges", () => {
    const u = upscale(real[0], 'xbr');
    const pal = palette(real[0]);
    expect([...u.data].some((c) => !pal.has(c))).toBe(true);
    expect([...u.data].some((c) => (c & 255) > 0 && (c & 255) < 255)).toBe(true);
  });
});

describe('upscale: speed smoke test', () => {
  it('filters the loaded sprite sets quickly (generous limit: 1 µs per source pixel)', () => {
    const bufs: PixelBuffer[] = [];
    for (const id of listSprites('')) for (const f of getFrames(id)) bufs.push(f.buf);
    const px = bufs.reduce((s, b) => s + b.w * b.h, 0);
    expect(px).toBeGreaterThan(100_000);
    for (const m of FILTERS) {
      const t0 = performance.now();
      for (const b of bufs) upscale(b, m);
      const ms = performance.now() - t0;
      expect(ms, `${m}: ${ms.toFixed(0)} ms for ${(px / 1e6).toFixed(2)} Mpx`).toBeLessThan(px / 1000);
    }
  });
});
