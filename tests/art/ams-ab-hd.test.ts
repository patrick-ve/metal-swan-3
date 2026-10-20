/**
 * UHD art (2× and 4×) of the decor of mission ams sections a and b and the street decor they share
 * with c and d (src/game/content/missions/ams/art-hd-ab-*.ts, registered by art-hi-ab.ts;
 * docs/ART_GUIDE.md "UHD art"): canal houses, FABEL FRIET, its sign, counter and neighbour,
 * street furniture, flags, smoke, the bridges and drawbridge of section a, the
 * Rijksmuseum, lawn, pool and hot-dog stand set of section b. Every id draws at d 2 and 4 with
 * exactly its 1× frame's logical size, anchor and points, deterministically, in PAL_HD only, as new
 * art (not the lower density scaled), outline C on static decor, lit from the upper left; lawn
 * pieces meet without a seam; the section lights recolour the houses. The boats and breakables
 * belong to art-hd-cd*.ts, the canal water pieces to art-hd-terrain-water.ts.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PAL_HD, inHdPalette } from '../../src/engine/palette-hd';
import type { PixelBuffer } from '../../src/engine/pixel';
import type { Frame } from '../../src/engine/render';
import { getFrames, hasHiSprite, listSprites, spriteErrors } from '../../src/engine/sprites';
import { loadContent } from '../../src/game/content/index';
import { lawnHd } from '../../src/game/content/missions/ams/art-hd-ab-canal';
import { getMission } from '../../src/game/registry';

const D = 'decor/ams/';
const INK = PAL_HD.ink[0] >>> 0;

/** The a / b (and shared street) decor ids that must have UHD art from this file group. */
const MUST = [
  'house-morning',
  'house-noon',
  ...['morning', 'noon', 'golden', 'sunset'].flatMap((l) => [`fabel-friet-${l}`, `neighbour-${l}`]),
  'fabel-sign',
  'fabel-counter',
  'lamp',
  'bollard',
  'bike',
  'bike-rack',
  'bench',
  'elm',
  'tulips',
  'flag-ams',
  'flag-nl',
  'smoke',
  'awning-30',
  'awning-56',
  'awning-60',
  'balustrade-36',
  'drawbridge',
  'bridge-rail-160x14',
  'bridge-face-160x14',
  'rijksmuseum',
  'lawn-128',
  'lawn-56',
  'pool-128',
  'pool-56',
  'hotdog-stand',
  'hotdog-front',
  'flag-red',
  'cabinet',
  'lamp-grey',
].map((id) => `${D}${id}`);

/** Static street decor: outline C (ink on the shadow side only; iron parts are left out: the deepest tone of PAL_HD.black is ink). */
const OUTLINE_C = ['lamp', 'bollard', 'elm', 'cabinet', 'lamp-grey', 'drawbridge', 'house-morning', 'fabel-friet-morning', 'rijksmuseum'].map((id) => `${D}${id}`);

/** Ids drawn by another file group (sections c / d, boats, breakables): never registered here. */
const NOT_MINE = /water-|houseboat-|ams-herring-cart|ams-tulip-stall|ams-bike-rack|ams-market-stall|ams-boat-platform|stopera|market-stall|white-bridge|white-portal|blauwbrug-lamp|bridge-face-200x16/;

// art-hi-ab.ts registers the sized ids the section files made: import it after loadContent.
let AB_HD: ReadonlyMap<string, (d: 2 | 4) => Frame | Frame[]> = new Map();
let sizedHd: (id: string) => ((d: 2 | 4) => Frame | Frame[]) | null = () => null;

const cache = new Map<string, Frame[]>();
function hd(id: string, d: 2 | 4): Frame[] {
  const key = `${id}@${d}`;
  let f = cache.get(key);
  if (!f) {
    const gen = AB_HD.get(id) ?? sizedHd(id);
    if (!gen) throw new Error(`no UHD generator for ${id}`);
    const r = gen(d);
    f = Array.isArray(r) ? r : [r as Frame];
    cache.set(key, f);
  }
  return f;
}

const opaque = (b: PixelBuffer, X: number, Y: number): boolean => X >= 0 && Y >= 0 && X < b.w && Y < b.h && (b.data[Y * b.w + X] & 255) !== 0;

/** Nearest-neighbour upscale of a buffer by k (what "scaled art" would be). */
function scaledData(b: PixelBuffer, k: number): Uint32Array {
  const out = new Uint32Array(b.w * k * b.h * k);
  for (let Y = 0; Y < b.h * k; Y++) for (let X = 0; X < b.w * k; X++) out[Y * b.w * k + X] = b.data[Math.floor(Y / k) * b.w + Math.floor(X / k)];
  return out;
}

function luma(c: number): number {
  return ((c >>> 24) & 255) * 0.3 + ((c >>> 16) & 255) * 0.59 + ((c >>> 8) & 255) * 0.11;
}

describe('ams decor a / b: UHD art', () => {
  let warn: { mock: { calls: unknown[][] }; mockRestore: () => void };
  beforeAll(async () => {
    await loadContent();
    const mod = await import('../../src/game/content/missions/ams/art-hi-ab');
    AB_HD = mod.AB_HD;
    sizedHd = mod.sizedHd;
  }, 120_000);
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('registers every a / b decor id at d 2 and 4, and none of another group', () => {
    for (const id of MUST) {
      expect(listSprites().includes(id), id).toBe(true);
      expect(hasHiSprite(id, 2) && hasHiSprite(id, 4), id).toBe(true);
      expect(AB_HD.has(id) || sizedHd(id) !== null, id).toBe(true);
    }
    for (const id of AB_HD.keys()) expect(NOT_MINE.test(id), id).toBe(false);
  });

  it('has exactly the 1× geometry, PAL_HD only, binary alpha, at d 2 and 4 (registry included)', () => {
    for (const id of MUST) {
      const lo = getFrames(id, 1);
      for (const d of [2, 4] as const) {
        const mine = hd(id, d);
        const served = getFrames(id, d);
        expect(mine.length, `${id}@${d}`).toBe(lo.length);
        expect(served.length, `${id}@${d}`).toBe(lo.length);
        for (let i = 0; i < lo.length; i++) {
          const f = mine[i];
          expect([f.buf.w, f.buf.h, f.ox, f.oy], `${id}[${i}]@${d}`).toEqual([lo[i].buf.w * d, lo[i].buf.h * d, lo[i].ox, lo[i].oy]);
          expect(f.pts ?? {}, `${id}[${i}]@${d}`).toEqual(lo[i].pts ?? {});
          expect(served[i].density, `${id}[${i}]@${d}`).toBe(d);
          expect(served[i].buf.data, `${id}[${i}]@${d} served`).toEqual(f.buf.data);
          const bad = f.buf.data.find((c) => (c & 255) !== 0 && ((c & 255) !== 255 || !inHdPalette(c)));
          expect(bad, `${id}[${i}]@${d}`).toBeUndefined();
        }
      }
    }
    expect(spriteErrors().filter((e) => MUST.some((id) => e.id === `${id}@2x` || e.id === `${id}@4x`))).toEqual([]);
    const cut = warn.mock.calls.map((c: unknown[]) => String(c[0])).filter((m: string) => m.includes('outside the 1× frame') && MUST.some((id) => m.includes(`"${id}"`)));
    expect(cut).toEqual([]);
  }, 120_000);

  it('is new art at each density: not the 1× or the 2× frame scaled', () => {
    for (const id of MUST) {
      const lo = getFrames(id, 1);
      const two = hd(id, 2);
      const four = hd(id, 4);
      const fromLo = two.some((f, i) => {
        const s = scaledData(lo[i].buf, 2);
        return f.buf.data.some((c, k) => c !== s[k]);
      });
      const fromTwo = four.some((f, i) => {
        const s = scaledData(two[i].buf, 2);
        return f.buf.data.some((c, k) => c !== s[k]);
      });
      expect(fromLo && fromTwo, id).toBe(true);
    }
  }, 120_000);

  it('is deterministic', () => {
    for (const id of ['decor/ams/house-morning', 'decor/ams/elm', 'decor/ams/fabel-sign', 'decor/ams/rijksmuseum']) {
      const a = (AB_HD.get(id) ?? sizedHd(id))!(2);
      const b = (AB_HD.get(id) ?? sizedHd(id))!(2);
      const fa = Array.isArray(a) ? a : [a as Frame];
      const fb = Array.isArray(b) ? b : [b as Frame];
      fa.forEach((f, i) => expect(f.buf.data, id).toEqual(fb[i].buf.data));
    }
  }, 60_000);

  it('outlines static decor with C: ink on the right / lower edge, the ramp on the upper / left edge', () => {
    for (const id of OUTLINE_C) {
      for (const d of [2, 4] as const) {
        const f = hd(id, d)[0].buf;
        let right = 0;
        let rightInk = 0;
        let left = 0;
        let leftInk = 0;
        for (let Y = 0; Y < f.h; Y++) {
          for (let X = 0; X < f.w; X++) {
            if (!opaque(f, X, Y)) continue;
            const c = f.data[Y * f.w + X] >>> 0;
            if (!opaque(f, X + 1, Y)) {
              right++;
              if (c === INK) rightInk++;
            }
            if (!opaque(f, X - 1, Y)) {
              left++;
              if (c === INK) leftInk++;
            }
          }
        }
        expect(rightInk / right, `${id}@${d} right edge ink`).toBeGreaterThan(0.75);
        expect(leftInk / left, `${id}@${d} left edge ink`).toBeLessThan(0.35);
      }
    }
  }, 60_000);

  it('is lit from the upper left (round posts: the left half lighter)', () => {
    for (const [id, x0, x1, y0, y1] of [
      ['decor/ams/bollard', 2, 7, 6, 17],
      ['decor/ams/lamp', 6, 9, 20, 60],
      ['decor/ams/lamp-grey', 7, 10, 20, 70],
    ] as const) {
      for (const d of [2, 4] as const) {
        const f = hd(id, d)[0].buf;
        let l = 0;
        let r = 0;
        const mid = ((x0 + x1) / 2) * d;
        for (let Y = y0 * d; Y < y1 * d; Y++) {
          for (let X = x0 * d; X < x1 * d; X++) {
            if (!opaque(f, X, Y)) continue;
            if (X < mid) l += luma(f.data[Y * f.w + X]);
            else r += luma(f.data[Y * f.w + X]);
          }
        }
        expect(l, `${id}@${d}`).toBeGreaterThan(r);
      }
    }
  });

  it('has the material detail of the fidelity targets (tones per facade, lettering, wheels)', () => {
    // A canal house at 4×: many colours (brick, mortar, trims, glass, doors), far beyond the 1× frame.
    const lo = new Set(getFrames('decor/ams/house-morning', 1)[0].buf.data);
    const hi = new Set(hd('decor/ams/house-morning', 4)[0].buf.data);
    expect(hi.size).toBeGreaterThan(lo.size * 2);
    // Spoked wheels stay open at 4×: the hub of a parked bike is surrounded by see-through px.
    const bike = hd('decor/ams/bike', 4)[0].buf;
    let holes = 0;
    for (let Y = 6 * 4; Y < 14 * 4; Y++) for (let X = 2 * 4; X < 9 * 4; X++) if (!opaque(bike, X, Y)) holes++;
    expect(holes).toBeGreaterThan(40);
    // The FABEL FRIET sign carries gilded lettering (gold px) on its black board.
    const sign = hd('decor/ams/fabel-sign', 4)[0].buf;
    const golds = new Set(PAL_HD.gold.map((c) => c >>> 0));
    expect(sign.data.filter((c) => golds.has(c >>> 0)).length).toBeGreaterThan(400);
  });

  it('recolours the houses for the section lights (morning = noon; golden and sunset warmer)', () => {
    const m = hd('decor/ams/house-morning', 2);
    const n = hd('decor/ams/house-noon', 2);
    m.forEach((f, i) => expect(f.buf.data).toEqual(n[i].buf.data));
    const gableWhite = new Set(PAL_HD.gable.map((c) => c >>> 0));
    for (const light of ['golden', 'sunset']) {
      const g = getFrames(`decor/ams/house-${light}`, 2)[0].buf;
      expect(g.data.filter((c) => gableWhite.has(c >>> 0)).length, light).toBeLessThan(m[0].buf.data.filter((c) => gableWhite.has(c >>> 0)).length / 4);
    }
  });

  it('tiles the lawn pieces without a seam (patterns periodic in 128)', () => {
    for (const d of [2, 4] as const) {
      const pairs: readonly (readonly [PixelBuffer, PixelBuffer])[] = [[lawnHd(256, d).buf, lawnHd(128, d).buf]];
      for (const [wide, piece] of pairs) {
        const W = piece.w;
        for (let Y = 0; Y < piece.h; Y++) {
          for (let X = 0; X < W; X++) {
            // The second half of a wide piece is the piece again (so piece | piece meets seamlessly) …
            expect(wide.data[Y * wide.w + X + W], `d${d} (${X}, ${Y})`).toBe(wide.data[Y * wide.w + X]);
          }
        }
        // … and the piece itself is the left half of the wide one.
        for (let Y = 0; Y < piece.h; Y++) for (let X = 0; X < W; X++) expect(piece.data[Y * W + X]).toBe(wide.data[Y * wide.w + X]);
      }
    }
  }, 60_000);
});

describe('ams decor: the tier-4 working set (UHD city verifier)', () => {
  it('takes the decor per section: each section lists the decor it draws, the mission preload none', async () => {
    await loadContent();
    const ams = getMission('ams');
    expect(ams).toBeDefined();
    if (!ams) return;
    // The mission-wide prefixes join every section's 4× set: no decor there.
    expect((ams.preloadFirst ?? []).filter((p) => p.startsWith(D))).toEqual([]);
    expect((ams.preloadLast ?? []).filter((p) => p.startsWith(D))).toEqual([]);
    for (const [sid, s] of Object.entries(ams.sections ?? {})) {
      const art = s.art ?? [];
      for (const d of s.decor ?? []) {
        if (!d.sprite.startsWith(D)) continue;
        expect(art.some((p) => d.sprite.startsWith(p)), `${sid}: ${d.sprite}`).toBe(true);
      }
      // Never the whole decor prefix (every section would hold every decor id at 4×).
      expect(art.filter((p) => D.startsWith(p)), sid).toEqual([]);
    }
  });
});
