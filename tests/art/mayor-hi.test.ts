/**
 * 2× art of ROBO-HALSEMA (mission ams boss, docs/ART_GUIDE.md "2x art (mission ams)"): every
 * `boss/ams-mayor/…` strip (the body pieces, the head frames, the wig, the spring, the floor shadow,
 * the lash and her shots) has a 2× generator the registry accepts (no 'id@2x' fallback, no pixels
 * cut outside the 1× frame), with the 1× logical geometry, palette colours only (PAL or, since the UHD
 * wave, PAL_HD) and real 2× detail.
 * The pieces share one anchor, so the medallion centre and the hatch sit where the game reads them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PAL, INK } from '../../src/engine/palette';
import { inHdPalette } from '../../src/engine/palette-hd';
import { getFrames, hasHiSprite, listSprites, spriteErrors } from '../../src/engine/sprites';
import { MAYOR } from '../../src/game/content/bosses/ams/geometry';
import { loadContent } from '../../src/game/content/index';

const PREFIX = 'boss/ams-mayor/';
const EXPECTED = [
  'arm-back',
  'body-0',
  'body-1',
  'body-2',
  'chain-0',
  'chain-1',
  'chain-2',
  'chain-gone',
  'head-0',
  'head-1',
  'head-2',
  'lash',
  'legs',
  'medallion-0',
  'medallion-1',
  'medallion-2',
  'noise-letter',
  'shadow',
  'shield-shot',
  'spring',
  'stamp-arm-0',
  'stamp-arm-1',
  'stamp-arm-2',
  'stamp-arm-gone',
  'stamp-wave',
  'wig',
];

describe('ROBO-HALSEMA: 2× art', () => {
  let warn: { mock: { calls: unknown[][] }; mockRestore: () => void };
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('every mayor id has a 2× generator that the registry accepts, with the 1× geometry and palette colours', async () => {
    await loadContent();
    const ids = listSprites(PREFIX);
    expect(ids.map((id) => id.slice(PREFIX.length)).sort()).toEqual(EXPECTED);
    const palette = new Set<number>([INK >>> 0, ...Object.values(PAL).flatMap((r) => (r as readonly number[]).map((c) => c >>> 0))]);
    for (const id of ids) {
      expect(hasHiSprite(id), id).toBe(true);
      const lo = getFrames(id, 1);
      const hi = getFrames(id, 2);
      expect(hi.length, id).toBe(lo.length);
      let detailed = false;
      for (let i = 0; i < lo.length; i++) {
        const f = hi[i];
        expect(f.density, `${id}[${i}]`).toBe(2);
        expect([f.buf.w, f.buf.h, f.ox, f.oy], `${id}[${i}]`).toEqual([lo[i].buf.w * 2, lo[i].buf.h * 2, lo[i].ox, lo[i].oy]);
        expect(f.pts ?? {}, `${id}[${i}]`).toEqual(lo[i].pts ?? {});
        const odd = new Set<string>();
        for (const c of f.buf.data) if ((c & 255) !== 0 && !palette.has(c >>> 0) && !inHdPalette(c)) odd.add((c >>> 0).toString(16));
        expect([...odd], `${id}[${i}] colours`).toEqual([]);
        const doubled = lo[i].buf.scaled(2).data;
        if (!f.buf.data.every((c, k) => c === doubled[k])) detailed = true;
      }
      // Real 2× art, not the 1× frames doubled.
      expect(detailed, id).toBe(true);
    }
    expect(spriteErrors().filter((e) => e.id.startsWith(PREFIX) && e.id.endsWith('@2x'))).toEqual([]);
    const cut = warn.mock.calls.map((c: unknown[]) => String(c[0])).filter((m: string) => m.includes('outside the 1× frame') && m.includes(PREFIX));
    expect(cut).toEqual([]);
  }, 120_000);

  it('the 2× medallion is centred on MAYOR.medallionC and the hatch sits in the hair, as at 1×', async () => {
    await loadContent();
    const at = (id: string, frame: number, d: number, x: number, y: number): number => {
      const f = getFrames(`${PREFIX}${id}`, d)[frame];
      return f.buf.get((f.ox + x) * d, (f.oy + y) * d) >>> 0;
    };
    const [mx, my] = MAYOR.medallionC;
    // The open core: the white-hot centre pixel at both densities.
    for (const d of [1, 2]) expect(at('medallion-0', 1, d, mx, my), `core d${d}`).toBe(PAL.snow[3] >>> 0);
    const [hx, hy] = MAYOR.hatch;
    for (const d of [1, 2]) expect(at('head-0', 0, d, hx, hy) & 255, `hatch d${d}`).not.toBe(0);
  });
});
