/**
 * UHD art (2× and 4×) of the decor of mission ams sections c and d, the Amsterdam breakables and
 * the canal boats (src/game/content/missions/ams/art-hd-cd*.ts, docs/ART_GUIDE.md "UHD art"):
 * every id of `CD_HD` draws at d 2 and 4 with exactly its 1× frame's logical size, anchor and
 * points, deterministically, in PAL_HD only, as new art (not the lower density scaled), with the
 * decided outlines (A for what can be shot or carries you, C for static decor, none for the
 * painted arch face), the wrecks differing from the intact breakables, and the light from the
 * upper left. The registry serves exactly these frames at d 2 and 4.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PAL_HD, inHdPalette } from '../../src/engine/palette-hd';
import type { PixelBuffer } from '../../src/engine/pixel';
import type { Frame } from '../../src/engine/render';
import { getFrames, hasHiSprite } from '../../src/engine/sprites';
import { bridgeFaceSprite, houseboatSprite } from '../../src/game/content/missions/ams/art';
import '../../src/game/content/missions/ams/npc.art';
import { CD_HD } from '../../src/game/content/missions/ams/art-hd-cd';
import { A_BOATS, C_BOATS, DECK_Y, ROOF_Y } from '../../src/game/content/missions/ams/terrain';

const D = 'decor/ams/';
const INK = PAL_HD.ink[0];

/** Every id this file group must draw (the c / d decor, the breakables, the boats). */
const MUST = [
  'stopera',
  'market-stall',
  'white-bridge',
  'white-portal',
  'blauwbrug-lamp',
  'bridge-face-200x16',
  'ams-herring-cart',
  'ams-tulip-stall',
  'ams-market-stall',
  'ams-bike-rack',
  'ams-boat-platform',
  ...[...A_BOATS, ...C_BOATS].map((b) => `houseboat-${b.w}x${DECK_Y - ROOF_Y}-${b.cx - b.x0}-${b.cw}-${b.colour}`),
].map((id) => `${D}${id}`);

/** Outline A: things that can be shot or that carry the player. */
const OUTLINE_A = ['ams-herring-cart', 'ams-tulip-stall', 'ams-market-stall', 'ams-bike-rack'].map((id) => `${D}${id}`);
/** Outline C: static decor. */
const OUTLINE_C = ['stopera', 'market-stall', 'white-bridge', 'white-portal', 'blauwbrug-lamp'].map((id) => `${D}${id}`);

// The sized 1× ids the section files register (bridge face, houseboats).
bridgeFaceSprite(200, 16);
for (const b of [...A_BOATS, ...C_BOATS]) houseboatSprite(b.w, DECK_Y - ROOF_Y, b.cx - b.x0, b.cw, b.colour);

const cache = new Map<string, Frame[]>();
function hd(id: string, d: 2 | 4): Frame[] {
  const key = `${id}@${d}`;
  let f = cache.get(key);
  if (!f) {
    const gen = CD_HD.get(id);
    if (!gen) throw new Error(`no HD generator for ${id}`);
    f = gen(d);
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

describe('ams decor c / d, breakables and boats: UHD art', () => {
  let warn: { mock: { calls: unknown[][] }; mockRestore: () => void };
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('lists every c / d decor, breakable and boat id', () => {
    for (const id of MUST) expect(CD_HD.has(id), id).toBe(true);
  });

  it('draws every id at d 2 and 4 with the 1× geometry, in PAL_HD only, deterministically', () => {
    for (const id of CD_HD.keys()) {
      const lo = getFrames(id, 1);
      for (const d of [2, 4] as const) {
        const fr = hd(id, d);
        expect(fr.length, `${id}@${d}`).toBe(lo.length);
        for (let i = 0; i < lo.length; i++) {
          const f = fr[i];
          const label = `${id}[${i}]@${d}`;
          expect(f.density, label).toBe(d);
          expect([f.buf.w, f.buf.h, f.ox, f.oy], label).toEqual([lo[i].buf.w * d, lo[i].buf.h * d, lo[i].ox, lo[i].oy]);
          expect(f.pts ?? {}, label).toEqual(lo[i].pts ?? {});
          let bad = 0;
          for (const c of f.buf.data) if ((c & 255) !== 0 && ((c & 255) !== 255 || !inHdPalette(c))) bad++;
          expect(bad, label).toBe(0);
        }
        // Same input, same pixels.
        const again = CD_HD.get(id)!(d);
        for (let i = 0; i < fr.length; i++) expect(Array.from(again[i].buf.data).every((c, k) => c === fr[i].buf.data[k]), `${id}[${i}]@${d} deterministic`).toBe(true);
      }
    }
  }, 120_000);

  it('is new art at each density: 2× is not the 1× doubled, 4× is not the 2× doubled, and 4× has more tones', () => {
    for (const id of CD_HD.keys()) {
      const lo = getFrames(id, 1);
      const f2 = hd(id, 2);
      const f4 = hd(id, 4);
      for (let i = 0; i < lo.length; i++) {
        const up1 = scaledData(lo[i].buf, 2);
        expect(f2[i].buf.data.every((c, k) => c === up1[k]), `${id}[${i}] 2× ≠ 1× doubled`).toBe(false);
        const up2 = scaledData(f2[i].buf, 2);
        expect(f4[i].buf.data.every((c, k) => c === up2[k]), `${id}[${i}] 4× ≠ 2× doubled`).toBe(false);
        const t1 = new Set(lo[i].buf.data).size;
        const t4 = new Set(f4[i].buf.data).size;
        expect(t4, `${id}[${i}] tones 1× ${t1} → 4× ${t4}`).toBeGreaterThan(t1);
      }
    }
  }, 60_000);

  it('outlines: A (ink ring) round the breakables, C (ink on the shadow side) round static decor', () => {
    for (const id of OUTLINE_A) {
      for (const f of hd(id, 4)) {
        const b = f.buf;
        let edge = 0;
        let ink = 0;
        for (let Y = 0; Y < b.h; Y++) {
          for (let X = 0; X < b.w; X++) {
            if (!opaque(b, X, Y)) continue;
            if (opaque(b, X - 1, Y) && opaque(b, X + 1, Y) && opaque(b, X, Y - 1) && opaque(b, X, Y + 1)) continue;
            // The frame border cuts the ring (as at 1×): count the edge px inside it only.
            if (X < 4 || Y < 4 || X >= b.w - 4 || Y >= b.h - 4) continue;
            edge++;
            if (b.data[Y * b.w + X] === INK) ink++;
          }
        }
        expect(ink / edge, `${id} outline A`).toBeGreaterThan(0.97);
      }
    }
    for (const id of OUTLINE_C) {
      for (const f of hd(id, 4)) {
        const b = f.buf;
        // The rightmost px of each row is ink (shadow side); the leftmost px are mostly not.
        let rows = 0;
        let inkRight = 0;
        let inkLeft = 0;
        for (let Y = 0; Y < b.h; Y++) {
          let x0 = -1;
          let x1 = -1;
          for (let X = 0; X < b.w; X++) {
            if (!opaque(b, X, Y)) continue;
            if (x0 < 0) x0 = X;
            x1 = X;
          }
          if (x0 < 0) continue;
          rows++;
          if (b.data[Y * b.w + x1] === INK) inkRight++;
          if (b.data[Y * b.w + x0] === INK) inkLeft++;
        }
        expect(inkRight / rows, `${id} outline C: ink on the right`).toBeGreaterThan(0.9);
        expect(inkLeft / rows, `${id} outline C: lit side not ink`).toBeLessThan(0.5);
      }
    }
  }, 60_000);

  it('the painted arch face has no ink outline', () => {
    const b = hd(`${D}bridge-face-200x16`, 4)[0].buf;
    let ink = 0;
    for (const c of b.data) if (c === INK) ink++;
    expect(ink).toBe(0);
  });

  it('wrecks differ from the intact breakables and stay inside the frame', () => {
    for (const id of OUTLINE_A) {
      const [a, w] = hd(id, 4);
      expect(a.buf.data.some((c, k) => c !== w.buf.data[k]), id).toBe(true);
      const count = (b: PixelBuffer): number => b.data.reduce((n, c) => n + ((c & 255) !== 0 ? 1 : 0), 0);
      expect(count(w.buf), `${id}: the wreck lies low`).toBeLessThan(count(a.buf));
    }
    const cut = warn.mock.calls.map((c: unknown[]) => String(c[0])).filter((m: string) => m.includes('outside the 1× frame'));
    expect(cut).toEqual([]);
  });

  it('lights the Stopera drum from the upper left: the left of the theatre is lighter than its right', () => {
    const b = hd(`${D}stopera`, 4)[0].buf;
    const luma = (c: number): number => ((c >>> 24) & 255) * 0.3 + ((c >>> 16) & 255) * 0.59 + ((c >>> 8) & 255) * 0.11;
    const avg = (x0: number, x1: number): number => {
      let s = 0;
      let n = 0;
      for (let Y = 60 * 4; Y < 160 * 4; Y++) {
        for (let X = x0 * 4; X < x1 * 4; X++) {
          const c = b.data[Y * b.w + X];
          if ((c & 255) === 0) continue;
          s += luma(c);
          n++;
        }
      }
      return s / n;
    };
    expect(avg(10, 60)).toBeGreaterThan(avg(180, 228) + 20);
  }, 30_000);

  it('the registry serves these frames at d 2 and 4 once the mission content is loaded', async () => {
    const { loadContent } = await import('../../src/game/content/index');
    await loadContent();
    for (const id of CD_HD.keys()) {
      expect(hasHiSprite(id, 4), `${id}@4x`).toBe(true);
      expect(hasHiSprite(id, 2), `${id}@2x`).toBe(true);
      const own = hd(id, 4);
      const reg = getFrames(id, 4);
      expect(reg.length, id).toBe(own.length);
      for (let i = 0; i < own.length; i++) expect(reg[i].buf.data.every((c, k) => c === own[i].buf.data[k]), `${id}[${i}]@4x from the registry`).toBe(true);
      const own2 = hd(id, 2);
      const reg2 = getFrames(id, 2);
      for (let i = 0; i < own2.length; i++) expect(reg2[i].buf.data.every((c, k) => c === own2[i].buf.data[k]), `${id}[${i}]@2x from the registry`).toBe(true);
    }
  }, 120_000);
});
