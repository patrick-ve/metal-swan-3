/**
 * UHD art of the Amsterdam people and ambient life (docs/ART_GUIDE.md "UHD art"; cast group,
 * PEOPLE): the baker, the hot-dog vendor, the staff, the counter, the background cyclists, the
 * window waver and cat, pigeons, ducks and the tour boat (`npc/ams/…`), every hostage (`item/hostage/…`)
 * and every bind (`item/bind/…`) have ONE density-generic HD generator. What ams shows (all of
 * `npc/ams/`, the tourist, the camera flash, the chair and sack binds and the cut rope) has 2× and
 * 4× art; the hostages and binds no mission shows at tier 4 have the same drawers at 2× only.
 * Every HD frame keeps the 1× geometry (size × d, anchor, points; no px cut outside the 1× box),
 * uses PAL_HD only, is new art (not the 1× or 2× frame scaled up), and consecutive frames of the
 * ams strips never repeat at 4×. The tourist's and Mrs. Dollop's blush is warm (not their teal
 * accent), the vendor's cap keeps its white band and blue peak, the pigeons' wings fan out in flight.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PAL_HD, inHdPalette } from '../../src/engine/palette-hd';
import type { PixelBuffer } from '../../src/engine/pixel';
import { getFrames, hasHiSprite, listSprites, spriteErrors } from '../../src/engine/sprites';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/items/index';
import '../../src/game/content/items/art';
import '../../src/game/content/props/index';
import { HD4_KINDS } from '../../src/game/content/items/hostage.art';
import { duplicateFrames } from '../art/motion';

/** Ids with 2× and 4× art (what the ams flow shows). */
const AMS = (id: string): boolean =>
  id.startsWith('npc/ams/') ||
  HD4_KINDS.some((k) => id.startsWith(`item/hostage/${k}/`)) ||
  ['item/hostage/flash', 'item/bind/chair-break', 'item/bind/sack-off', 'item/bind/rope-bit'].includes(id);

let warn: { mock: { calls: unknown[][] }; mockRestore: () => void };
let ids: string[] = [];

beforeAll(async () => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  await import('../../src/game/content/missions/ams/index');
  ids = listSprites().filter((id) => id.startsWith('npc/ams/') || id.startsWith('item/hostage') || id.startsWith('item/bind/'));
});
afterAll(() => warn.mockRestore());

const same = (a: PixelBuffer, b: PixelBuffer): boolean => a.w === b.w && a.h === b.h && a.data.every((c, i) => c === b.data[i]);

describe('people: UHD art', () => {
  it('every id has HD art (2× and 4× for the ams flow, 2× for the rest) with the 1× geometry, PAL_HD only, nothing cut', () => {
    expect(ids.length).toBeGreaterThan(150);
    let four = 0;
    for (const id of ids) {
      expect(hasHiSprite(id, 2), `${id}@2x`).toBe(true);
      expect(hasHiSprite(id, 4), `${id}@4x`).toBe(AMS(id));
      const lo = getFrames(id, 1);
      for (const d of AMS(id) ? ([2, 4] as const) : ([2] as const)) {
        const hd = getFrames(id, d);
        if (d === 4) four++;
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
    expect(four).toBeGreaterThan(70);
    const mine = (e: string): boolean => ids.some((id) => e === `${id}@2x` || e === `${id}@4x`);
    expect(spriteErrors().filter((e) => mine(e.id))).toEqual([]);
    const cut = warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('outside the 1× frame') && ids.some((id) => m.includes(`"${id}"`)));
    expect(cut).toEqual([]);
  }, 240_000);

  it('is new art: no 4× frame is its 1× or 2× frame scaled up, no 2× frame its 1× frame doubled', () => {
    for (const id of ids) {
      const lo = getFrames(id, 1);
      const hi = getFrames(id, 2);
      for (let i = 0; i < lo.length; i++) {
        // (chair-break's last frame is empty at every density: its sticks settle below the frame.)
        if (!lo[i].buf.data.some((c) => (c & 255) !== 0)) continue;
        expect(same(hi[i].buf, lo[i].buf.scaled(2)), `${id}@2x[${i}] is the 1× frame doubled`).toBe(false);
        if (!AMS(id)) continue;
        const four = getFrames(id, 4)[i].buf;
        expect(same(four, lo[i].buf.scaled(4)), `${id}@4x[${i}] is the 1× frame scaled`).toBe(false);
        expect(same(four, hi[i].buf.scaled(2)), `${id}@4x[${i}] is the 2× frame scaled`).toBe(false);
      }
    }
  });

  it('the ams strips never repeat a frame at 4× (motion gate)', () => {
    // The duck paddle holds two 4-frame cycles; `cheer` loops the shared P.VICTORY keys, whose last pose is its first.
    const skip = (x: string): boolean => x === 'npc/ams/ams-ducks/paddle' || x.endsWith('/cheer');
    for (const id of ids.filter((x) => AMS(x) && !skip(x) && getFrames(x, 1).length > 1)) expect(duplicateFrames(id, 4), `${id}@4x`).toEqual([]);
  });

  it('the tourist and Mrs. Dollop blush warm at 2× and 4× (no teal accent on the face; Dollop keeps her teal collar)', () => {
    for (const id of ['item/hostage/tourist/gag', 'item/hostage/tourist/walk', 'item/hostage/dollop/walk', 'item/hostage/dollop/gag']) {
      for (const d of AMS(id) ? [2, 4] : [2]) {
        for (const f of getFrames(id, d)) {
          const head = f.pts?.head;
          if (!head) continue;
          let teal = 0;
          let pink = 0;
          for (let y = Math.floor((f.oy + head[1]) * d); y < Math.ceil((f.oy + head[1] + 4.5) * d); y++) {
            for (let x = Math.floor((f.ox + head[0] - 2) * d); x < Math.ceil((f.ox + head[0] + 6) * d); x++) {
              const c = f.buf.get(x, y);
              if (PAL_HD.teal.includes(c)) teal++;
              if (PAL_HD.pink.includes(c)) pink++;
            }
          }
          expect(teal, `${id}@${d} teal on the face`).toBe(0);
          expect(pink, `${id}@${d} warm blush`).toBeGreaterThan(0);
        }
      }
    }
    const collar = getFrames('item/hostage/dollop/walk', 2)[0].buf.data.some((c) => PAL_HD.teal.includes(c));
    expect(collar).toBe(true);
  });

  it("the vendor's cap keeps its tricolour at 2× and 4×: red crown, white band, blue peak", () => {
    for (const d of [2, 4]) {
      const f = getFrames('npc/ams/ams-hotdog-vendor/idle', d)[0];
      const head = f.pts?.head ?? [0, -30];
      const yMax = (f.oy + head[1]) * d;
      const has = (r: readonly number[]): boolean => {
        for (let y = 0; y < yMax; y++) for (let x = 0; x < f.buf.w; x++) if (r.includes(f.buf.get(x, y))) return true;
        return false;
      };
      expect(has(PAL_HD.red), `red crown @${d}`).toBe(true);
      expect(has(PAL_HD.snow), `white band @${d}`).toBe(true);
      expect(has(PAL_HD.navy) || has(PAL_HD.sky), `blue peak @${d}`).toBe(true);
    }
  });

  it('the HD props are drawn: the baker holds a scoop of fries, the critic a notepad, the tea lady a teapot (gold, white and navy px beyond the bare figure)', () => {
    const count = (id: string, d: number, r: readonly number[]): number => {
      const fr = getFrames(id, d);
      return fr.reduce((n, f) => n + f.buf.data.filter((c) => r.includes(c)).length, 0) / fr.length;
    };
    // The baker holds the scoop of fries at rest, not on the walk.
    expect(count('npc/ams/ams-baker/idle', 4, PAL_HD.gold)).toBeGreaterThan(count('npc/ams/ams-baker/walk', 4, PAL_HD.gold) + 100);
    expect(count('item/hostage/critic/walk', 2, PAL_HD.navy)).toBeGreaterThan(0);
    expect(count('item/hostage/tea-lady/walk', 2, PAL_HD.navy)).toBeGreaterThan(0);
  });

  it('a pigeon in flight fans its wing above the body (wings-up frame reaches higher than the standing bird)', () => {
    for (const d of [2, 4]) {
      const [stand, , , up] = getFrames('npc/ams/ams-pigeons', d);
      const top = (b: PixelBuffer): number => b.trimBounds()?.y ?? b.h;
      expect(top(up.buf), `@${d}`).toBeLessThan(top(stand.buf));
    }
  });
});
