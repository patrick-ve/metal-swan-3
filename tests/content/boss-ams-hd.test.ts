/**
 * ROBO-HALSEMA — UHD art (docs/ART_GUIDE.md "UHD art"; plan: cast BOSS): every
 * `boss/ams-mayor/…` strip has ONE density-generic HD drawer (art-hd.ts, art-shots.ts) that the
 * registry accepts at 2× and 4× with exactly the 1× geometry (frame count, logical size, anchor,
 * points; nothing cut outside the 1× frame), PAL_HD colours only, real new art (more tones than
 * 1×, never a scaled frame), the key light from the upper left, deterministic pixels, and the
 * game-read spots (the medallion core, the hatch) where the 1× art has them. The 1× frames stay
 * byte-identical (pinned hash).
 */
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { luma } from '../../src/engine/color';
import { PAL } from '../../src/engine/palette';
import { inHdPalette } from '../../src/engine/palette-hd';
import { getFrames, hasHiSprite, listSprites, setHiArt, spriteErrors } from '../../src/engine/sprites';
import { HD_IDS, headHd, legsHd, medallionHd, stampArmHd } from '../../src/game/content/bosses/ams/art-hd';
import { ARM_FRAMES } from '../../src/game/content/bosses/ams/art';
import { MAYOR } from '../../src/game/content/bosses/ams/geometry';
import '../../src/game/content/bosses/ams/index';

const PREFIX = 'boss/ams-mayor/';
const SHOTS = ['noise-letter', 'shield-shot', 'stamp-wave'].map((s) => PREFIX + s);

/** Distinct opaque colours of a buffer. */
function colours(data: Uint32Array): number {
  const s = new Set<number>();
  for (const c of data) if ((c & 255) !== 0) s.add(c >>> 0);
  return s.size;
}

describe('ROBO-HALSEMA: UHD art (2× and 4×)', () => {
  let warn: { mock: { calls: unknown[][] }; mockRestore: () => void };
  beforeEach(() => {
    setHiArt(true);
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('every strip has an HD drawer at 2× and 4× that the registry accepts, with the 1× geometry and PAL_HD colours', () => {
    const ids = listSprites(PREFIX);
    expect(ids.length).toBe(26);
    expect([...HD_IDS, ...SHOTS].sort()).toEqual(ids);
    for (const id of ids) {
      const lo = getFrames(id, 1);
      for (const d of [2, 4] as const) {
        expect(hasHiSprite(id, d), `${id}@${d}x`).toBe(true);
        const hi = getFrames(id, d);
        expect(hi.length, `${id}@${d}x`).toBe(lo.length);
        for (let i = 0; i < lo.length; i++) {
          const f = hi[i];
          expect(f.density, `${id}@${d}x[${i}]`).toBe(d);
          expect([f.buf.w, f.buf.h, f.ox, f.oy], `${id}@${d}x[${i}]`).toEqual([lo[i].buf.w * d, lo[i].buf.h * d, lo[i].ox, lo[i].oy]);
          expect(f.pts ?? {}, `${id}@${d}x[${i}]`).toEqual(lo[i].pts ?? {});
          const odd = new Set<string>();
          for (const c of f.buf.data) if ((c & 255) !== 0 && !inHdPalette(c)) odd.add((c >>> 0).toString(16));
          expect([...odd], `${id}@${d}x[${i}] colours`).toEqual([]);
          expect(f.buf.countOpaque(), `${id}@${d}x[${i}] drawn`).toBeGreaterThan(0);
        }
      }
    }
    expect(spriteErrors().filter((e) => e.id.startsWith(PREFIX))).toEqual([]);
    const cut = warn.mock.calls.map((c: unknown[]) => String(c[0])).filter((m: string) => m.includes(PREFIX));
    expect(cut).toEqual([]);
  }, 120_000);

  it('is new art: more tones than 1×, the 4× frame is not the 2× frame enlarged, the 2× frame not the 1× one', () => {
    for (const id of [...HD_IDS, ...SHOTS]) {
      const lo = getFrames(id, 1);
      const h2 = getFrames(id, 2);
      const h4 = getFrames(id, 4);
      for (let i = 0; i < lo.length; i++) {
        const up2 = lo[i].buf.scaled(2).data;
        expect(h2[i].buf.data.every((c, k) => c === up2[k]), `${id}@2x[${i}] is 1× doubled`).toBe(false);
        const up4 = h2[i].buf.scaled(2).data;
        expect(h4[i].buf.data.every((c, k) => c === up4[k]), `${id}@4x[${i}] is 2× doubled`).toBe(false);
      }
    }
    // The big lit pieces carry far more tones than their 1× frames.
    for (const [id, i] of [['body-0', 0], ['head-0', 0], ['stamp-arm-0', 0], ['medallion-0', 0], ['legs', 0]] as const) {
      const n1 = colours(getFrames(PREFIX + id, 1)[i].buf.data);
      const n4 = colours(getFrames(PREFIX + id, 4)[i].buf.data);
      expect(n4, `${id} tones 1× ${n1} → 4× ${n4}`).toBeGreaterThan(n1 * 1.4);
    }
  }, 120_000);

  it('the key light comes from the upper left: the medallion rim is lighter at 10 o\'clock than at 4 o\'clock', () => {
    const [mx, my] = MAYOR.medallionC;
    for (const d of [2, 4]) {
      const f = getFrames(`${PREFIX}medallion-0`, d)[0];
      const at = (deg: number): number => {
        let sum = 0;
        let n = 0;
        for (let r = 12; r <= 13.5; r += 0.5) {
          for (let k = -10; k <= 10; k += 5) {
            const a = ((deg + k) * Math.PI) / 180;
            const X = Math.floor((f.ox + mx + 0.5 + Math.cos(a) * r) * d);
            const Y = Math.floor((f.oy + my + 0.5 + Math.sin(a) * r) * d);
            sum += luma(f.buf.get(X, Y));
            n++;
          }
        }
        return sum / n;
      };
      expect(at(225), `d${d}`).toBeGreaterThan(at(45));
    }
  });

  it('keeps the game-read spots: the white-hot core centre and the hatch in the hair, as at 1×', () => {
    const at = (id: string, frame: number, d: number, x: number, y: number): number => {
      const f = getFrames(`${PREFIX}${id}`, d)[frame];
      return f.buf.get((f.ox + x) * d, (f.oy + y) * d) >>> 0;
    };
    const [mx, my] = MAYOR.medallionC;
    const [hx, hy] = MAYOR.hatch;
    for (const d of [1, 2, 4]) {
      for (const s of [0, 1, 2]) expect(at(`medallion-${s}`, 1, d, mx, my), `core d${d}`).toBe(PAL.snow[3] >>> 0);
      expect(at('head-0', 0, d, hx, hy) & 255, `hatch d${d}`).not.toBe(0);
    }
  });

  it('mirrored stamp-arm frames read GESLOTEN left to right (the same letter pixels as the right-facing frame)', () => {
    for (const d of [2, 4]) {
      const fs = getFrames(`${PREFIX}stamp-arm-0`, d);
      const red = (i: number): number => fs[i].buf.data.filter((c) => (c >>> 0) === (PAL.red[2] >>> 0)).length;
      for (let f = 0; f < ARM_FRAMES; f++) {
        expect(red(f), `pose ${f}@${d}x`).toBeGreaterThan(40 * d);
        expect(Math.abs(red(f + ARM_FRAMES) - red(f)), `pose ${f}@${d}x mirrored`).toBeLessThanOrEqual(2 * d * d);
      }
    }
  });

  it('is deterministic: the same drawer gives the same pixels twice', () => {
    const same = (a: ReadonlyArray<{ buf: { data: Uint32Array } }>, b: ReadonlyArray<{ buf: { data: Uint32Array } }>): boolean =>
      a.length === b.length && a.every((f, i) => f.buf.data.length === b[i].buf.data.length && f.buf.data.every((c, k) => c === b[i].buf.data[k]));
    expect(same(legsHd(4), legsHd(4))).toBe(true);
    expect(same(headHd(1, 2), headHd(1, 2))).toBe(true);
    expect(same(medallionHd(2, 4), medallionHd(2, 4))).toBe(true);
    expect(same(stampArmHd(2, 2), stampArmHd(2, 2))).toBe(true);
  }, 60_000);

  it('leaves the 1× frames byte-identical', () => {
    const h = createHash('sha1');
    for (const id of listSprites(PREFIX)) {
      for (const f of getFrames(id, 1)) {
        h.update(`${id}:${f.buf.w}x${f.buf.h}:${f.ox},${f.oy};`);
        h.update(Buffer.from(f.buf.data.buffer, f.buf.data.byteOffset, f.buf.data.byteLength));
      }
    }
    expect(h.digest('hex')).toBe('13cae73bc4910c384b3cf6c43c5a824f1cb346b7');
  });
});
