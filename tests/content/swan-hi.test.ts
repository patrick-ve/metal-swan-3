/**
 * 2× art of SWAN-3 and the Mute (mission ams, docs/ART_GUIDE.md "2x art (mission ams)"): every
 * `vehicle/swan/…` and `vehicle/swan-mute/…` id (bodies, front overlays, necks, scuffs, egg, beak
 * flash) and the Swan's fx have a 2× generator the registry accepts (no 'id@2x' fallback, no
 * pixels cut by the registry), with the 1× logical geometry and real 2× detail. The m3 sock
 * variants stay 1×.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getFrames, hasHiSprite, listSprites, spriteErrors } from '../../src/engine/sprites';
import { loadContent } from '../../src/game/content/index';
import { hiCut } from '../../src/game/content/vehicles/swan/body.art';
import { neckCut } from '../../src/game/content/vehicles/swan/head.art';

const PREFIXES = ['vehicle/swan/', 'vehicle/swan-mute/'];
const IDS = ['fx/tin-feather', 'fx/muzzle-swan-beak-gun'];

describe('SWAN-3: 2× art', () => {
  let warn: { mock: { calls: unknown[][] }; mockRestore: () => void };
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('every Swan id has a 2× generator that the registry accepts, with the 1× geometry', async () => {
    await loadContent();
    const ids = [...listSprites().filter((id) => PREFIXES.some((p) => id.startsWith(p))), ...IDS];
    expect(ids.length).toBeGreaterThan(170);
    for (const id of ['vehicle/swan/idle', 'vehicle/swan/run-front', 'vehicle/swan-mute/neck', 'vehicle/swan/scuffs', 'vehicle/swan/egg', 'vehicle/swan/beak-flash']) {
      expect(ids.includes(id), id).toBe(true);
    }
    let detailed = 0;
    for (const id of ids) {
      expect(hasHiSprite(id), id).toBe(true);
      const lo = getFrames(id, 1);
      const hi = getFrames(id, 2);
      expect(hi.length, id).toBe(lo.length);
      for (let i = 0; i < lo.length; i++) {
        const f = hi[i];
        expect(f.density, `${id}[${i}]`).toBe(2);
        expect([f.buf.w, f.buf.h, f.ox, f.oy], `${id}[${i}]`).toEqual([lo[i].buf.w * 2, lo[i].buf.h * 2, lo[i].ox, lo[i].oy]);
        expect(f.pts ?? {}, `${id}[${i}]`).toEqual(lo[i].pts ?? {});
      }
      // Real 2× art, not the 1× frame doubled (a 1 × 1 empty front overlay is the same either way).
      if (lo.every((f) => f.buf.w <= 1) || hi.some((f, i) => !f.buf.data.every((c, k) => c === lo[i].buf.scaled(2).data[k]))) detailed++;
    }
    expect(detailed).toBe(ids.length);
    expect(spriteErrors().filter((e) => e.id.endsWith('@2x') && ids.some((id) => e.id === `${id}@2x`))).toEqual([]);
    const cut = warn.mock.calls.map((c: unknown[]) => String(c[0])).filter((m: string) => m.includes('outside the 1× frame') && ids.some((id) => m.includes(`"${id}"`)));
    expect(cut).toEqual([]);
    // The rig places its 2× art in the 1× rectangle itself: only a few stray pixels may fall off
    // (outline pixels of a shape a hair larger than at 1×; the edge is re-outlined).
    expect(neckCut.px).toBe(0);
    expect(hiCut.px).toBeLessThan(400);
  }, 300_000);

  it('the 2× silhouettes keep the 1× weight: slim necks, full-size scuffs', async () => {
    await loadContent();
    // Logical pixels covered by at least 2 of their 4 2× pixels, against the 1× mask.
    const iou = (id: string): number => {
      let both = 0;
      let either = 0;
      const hi = getFrames(id, 2);
      getFrames(id, 1).forEach((f, n) => {
        const h = hi[n].buf;
        for (let y = 0; y < f.buf.h; y++) {
          for (let x = 0; x < f.buf.w; x++) {
            const a = (f.buf.data[y * f.buf.w + x] & 255) !== 0;
            let c = 0;
            for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if ((h.data[(2 * y + dy) * h.w + 2 * x + dx] & 255) !== 0) c++;
            const b = c >= 2;
            if (a && b) both++;
            if (a || b) either++;
          }
        }
      });
      return both / either;
    };
    for (const pre of PREFIXES) {
      for (const name of ['neck', 'neck-fire', 'crouch-neck', 'crouch-neck-fire', 'duck-neck', 'duck-neck-fire', 'swim-neck', 'swim-neck-fire']) {
        expect(iou(`${pre}${name}`), `${pre}${name}`).toBeGreaterThanOrEqual(0.92);
      }
    }
    // Every 1× scuff pixel stays a full 2 × 2 mark at 2× (the damage reads as strongly).
    const lo = getFrames('vehicle/swan/scuffs', 1);
    getFrames('vehicle/swan/scuffs', 2).forEach((f, n) => {
      const b = lo[n].buf;
      for (let y = 0; y < b.h; y++) {
        for (let x = 0; x < b.w; x++) {
          if ((b.data[y * b.w + x] & 255) === 0) continue;
          for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) expect(f.buf.data[(2 * y + dy) * f.buf.w + 2 * x + dx] & 255, `scuffs[${n}] ${x},${y}`).not.toBe(0);
        }
      }
    });
    expect(iou('vehicle/swan/scuffs')).toBe(1);
  }, 120_000);

  it('the m3 sock variants keep only their 1× art', async () => {
    await loadContent();
    expect(hasHiSprite('vehicle/swan-socks/idle')).toBe(false);
    expect(hasHiSprite('vehicle/swan-mute-socks/run')).toBe(false);
  });
});
