/**
 * UHD art of the Amsterdam locals (docs/ART_GUIDE.md "UHD art"; cast group, LOCALS): the riders
 * (27 sets), the gull, the handhaver and the BOETE ticket have ONE density-generic generator for
 * 2× and 4×. Every frame keeps the 1× geometry (size × d, anchor, points; no px cut outside the
 * 1× box), uses PAL_HD only, is new art (not the 1× or the 2× frame scaled), and is deterministic;
 * the wheels turn in a 4-phase loop, the cranks follow the rider's feet, the cube bag's logo stays
 * mirror-symmetric (the rider is drawn flipped), and consecutive frames never repeat at 4×.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { INK } from '../../src/engine/palette';
import { PAL_HD, inHdPalette } from '../../src/engine/palette-hd';
import type { PixelBuffer } from '../../src/engine/pixel';
import { getFrames, hasHiSprite, listSprites, spriteErrors } from '../../src/engine/sprites';
import '../../src/game/content/locals/index';
import '../../src/game/content/locals/art';
import { gullHd } from '../../src/game/content/locals/seagull.art';
import { BIKE, bikeHd, cubePackHd, wheelHd } from '../../src/game/content/locals/rider.hd';
import { duplicateFrames } from '../art/motion';

const PREFIXES = ['enemy/fatbike-youth', 'enemy/delivery-rider', 'enemy/seagull/', 'enemy/handhaver', 'enemy/boete-ticket/'];

let warn: { mock: { calls: unknown[][] }; mockRestore: () => void };
let ids: string[] = [];

beforeAll(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  ids = listSprites().filter((id) => PREFIXES.some((p) => id.startsWith(p)));
});
afterAll(() => warn.mockRestore());

const same = (a: PixelBuffer, b: PixelBuffer): boolean => a.w === b.w && a.h === b.h && a.data.every((c, i) => c === b.data[i]);

describe('locals: UHD art at 2× and 4×', () => {
  it('every id has 2× and 4× generators with the 1× geometry, PAL_HD only, nothing cut', () => {
    expect(ids.length).toBeGreaterThan(500);
    for (const id of ids) {
      expect(hasHiSprite(id, 2) && hasHiSprite(id, 4), id).toBe(true);
      const lo = getFrames(id, 1);
      for (const d of [2, 4] as const) {
        const hd = getFrames(id, d);
        expect(hd.length, `${id}@${d}`).toBe(lo.length);
        for (let i = 0; i < lo.length; i++) {
          const f = hd[i];
          expect(f.density, `${id}@${d}[${i}]`).toBe(d);
          expect([f.buf.w, f.buf.h, f.ox, f.oy], `${id}@${d}[${i}]`).toEqual([lo[i].buf.w * d, lo[i].buf.h * d, lo[i].ox, lo[i].oy]);
          expect(f.pts ?? {}, `${id}@${d}[${i}]`).toEqual(lo[i].pts ?? {});
          for (const c of f.buf.data) if ((c & 255) !== 0 && !inHdPalette(c)) expect.fail(`${id}@${d}[${i}]: colour ${c.toString(16)} not in PAL_HD`);
        }
      }
    }
    const mine = (e: string): boolean => ids.some((id) => e === `${id}@2x` || e === `${id}@4x`);
    expect(spriteErrors().filter((e) => mine(e.id))).toEqual([]);
    const cut = warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('outside the 1× frame') && ids.some((id) => m.includes(`"${id}"`)));
    expect(cut).toEqual([]);
  }, 240_000);

  it('is new art: no frame is its 1× frame or its 2× frame scaled up', () => {
    let fresh = 0;
    for (const id of ids) {
      const lo = getFrames(id, 1);
      const hi2 = getFrames(id, 2);
      const hi4 = getFrames(id, 4);
      const scaled = lo.every((f, i) => same(f.buf.scaled(4), hi4[i].buf)) || hi2.every((f, i) => same(f.buf.scaled(2), hi4[i].buf));
      if (!scaled) fresh++;
    }
    expect(fresh).toBe(ids.length);
  }, 120_000);

  it('the outline is ink (outline A): the 4× gull, bike and bag silhouettes end in INK', () => {
    const bufs = [gullHd({ wings: 'up' }, 4).buf, gullHd({ perched: true }, 4).buf, cubePackHd(false, 4), getFrames('enemy/fatbike-youth/bike', 4)[0].buf];
    for (const b of bufs) {
      let edge = 0;
      let ink = 0;
      for (let y = 0; y < b.h; y++) {
        for (let x = 0; x < b.w; x++) {
          const c = b.data[y * b.w + x];
          if ((c & 255) === 0) continue;
          const open = x === 0 || y === 0 || x === b.w - 1 || y === b.h - 1 || (b.data[y * b.w + x - 1] & 255) === 0 || (b.data[y * b.w + x + 1] & 255) === 0 || (b.data[(y - 1) * b.w + x] & 255) === 0 || (b.data[(y + 1) * b.w + x] & 255) === 0;
          if (!open) continue;
          edge++;
          if (c >>> 0 === INK >>> 0 || c >>> 0 === PAL_HD.ink[0] >>> 0) ink++;
        }
      }
      expect(ink / edge).toBeGreaterThan(0.85);
    }
  });

  it('is deterministic (same input, same px)', () => {
    expect(same(gullHd({ wings: 'mid', face: 'kaw' }, 4).buf, gullHd({ wings: 'mid', face: 'kaw' }, 4).buf)).toBe(true);
    expect(same(cubePackHd(true, 2), cubePackHd(true, 2))).toBe(true);
  });
});

describe('locals: HD bikes', () => {
  it('the wheels turn: four phases differ and loop (phase 4 = phase 0)', () => {
    for (const kind of ['fat', 'city'] as const) {
      for (const d of [2, 4] as const) {
        const w = [0, 1, 2, 3].map((p) => wheelHd(kind, p, d));
        for (let i = 0; i < 4; i++) expect(same(w[i], w[(i + 1) % 4]), `${kind}@${d} phase ${i}`).toBe(false);
        expect(wheelHd(kind, 4, d)).toBe(w[0]);
        expect(w[0].w).toBe((BIKE[kind].r * 2 + 3) * d);
      }
    }
  });

  it('the cranks follow the rider: the bike under each ride frame differs with the crank angle', () => {
    const rect = { x: 10, y: 14, w: 42, h: 38 };
    const a = bikeHd('fat', { color: 'gold', crank: 0 }, 4, rect).buf;
    const b = bikeHd('fat', { color: 'gold', crank: 0.25 }, 4, rect).buf;
    expect(same(a, b)).toBe(false);
  });

  it('the cube bag logo is mirror-symmetric at 2× and 4× (the rider is drawn flipped)', () => {
    const logo = new Set<number>([...PAL_HD.gold, ...PAL_HD.brown, PAL_HD.green[5], PAL_HD.green[6], PAL_HD.snow[5]].map((c) => c >>> 0));
    for (const d of [2, 4] as const) {
      for (const open of [false, true]) {
        const b = cubePackHd(open, d);
        const y0 = (open ? 8 : 7) * d;
        // The logo columns are symmetric about logical x 7.5 (art px 7.5·d − ½).
        for (let y = y0; y < y0 + 4 * d; y++) {
          for (let x = 3 * d; x < 12 * d; x++) {
            const m = 15 * d - 1 - x;
            const l = (c: number): number => (logo.has(c >>> 0) ? c >>> 0 : 0);
            expect(l(b.get(x, y)), `open ${open} @${d} (${x}, ${y})`).toBe(l(b.get(m, y)));
          }
        }
      }
    }
  });

  it('no two consecutive frames are identical at 4×', () => {
    for (const n of ['ride', 'idle', 'kick', 'tell', 'turn', 'die-seat', 'get-up']) expect(duplicateFrames(`enemy/fatbike-youth/${n}`, 4), n).toEqual([]);
    for (const n of ['ride', 'idle', 'kick']) expect(duplicateFrames(`enemy/delivery-rider/${n}`, 4), n).toEqual([]);
    for (const n of ['walk', 'idle', 'tell', 'attack']) expect(duplicateFrames(`enemy/seagull/${n}`, 4), n).toEqual([]);
    for (const n of ['idle', 'walk', 'throw']) expect(duplicateFrames(`enemy/handhaver/${n}`, 4), n).toEqual([]);
  });
});
