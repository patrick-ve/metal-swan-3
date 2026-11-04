/**
 * MECHA HASLEMA's art is one baked 40 px set (docs/design/ams40.md wave 6, plan rule 7): every
 * `boss/ams-mayor/…` id keeps its name, has 1× frames only (every art tier draws them scaled: no
 * 2× / 4× drawers, no dense alias), and the pieces share the one anchor, so the medallion's core
 * sits on MAYOR.medallionC and the hatch in the hair where the game reads them.
 */
import { describe, expect, it } from 'vitest';
import { bakedSetIds } from '../../src/engine/baked';
import { getFrames, hasHiSprite, listSprites, spriteErrors } from '../../src/engine/sprites';
import { HEAD_HATCH, MED_FLASH, MED_OPEN, SET } from '../../src/game/content/art40/ams-mayor.gen';
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

describe('MECHA HASLEMA: the baked set', () => {
  it('keeps every id; 1× frames at every tier, no dense art', async () => {
    await loadContent();
    const ids = listSprites(PREFIX);
    expect(ids.map((id) => id.slice(PREFIX.length)).sort()).toEqual(EXPECTED);
    expect([...bakedSetIds(SET)].sort()).toEqual(ids);
    for (const id of ids) {
      for (const d of [2, 4] as const) expect(hasHiSprite(id, d), `${id}@${d}x`).toBe(false);
      const lo = getFrames(id, 1);
      expect(lo.length, id).toBeGreaterThan(0);
      expect(getFrames(id, 4).map((f) => [f.buf.w, f.buf.h, f.ox, f.oy])).toEqual(lo.map((f) => [f.buf.w, f.buf.h, f.ox, f.oy]));
    }
    expect(spriteErrors().filter((e) => e.id.startsWith(PREFIX))).toEqual([]);
  });

  it('the medallion core sits on MAYOR.medallionC and the hatch in the hair (the one shared anchor)', async () => {
    await loadContent();
    const at = (id: string, frame: number, x: number, y: number): number => {
      const f = getFrames(`${PREFIX}${id}`, 1)[frame];
      return f.buf.get(f.ox + x, f.oy + y) >>> 0;
    };
    const [mx, my] = MAYOR.medallionC;
    for (const s of [0, 1, 2]) {
      for (const f of [MED_OPEN, MED_FLASH]) expect(at(`medallion-${s}`, f, mx, my) & 255, `medallion-${s}[${f}]`).not.toBe(0);
    }
    const [hx, hy] = MAYOR.hatch;
    for (const s of [0, 1, 2]) expect(at(`head-${s}`, HEAD_HATCH, hx, hy) & 255, `head-${s} hatch`).not.toBe(0);
  });

  it('the pieces stand on the shared floor anchor: no pixel of the legs below it, the stamp lands on it', async () => {
    await loadContent();
    for (const f of getFrames(`${PREFIX}legs`, 1)) expect(f.buf.h - f.oy).toBeLessThanOrEqual(0);
    for (const s of [0, 1, 2]) for (const f of getFrames(`${PREFIX}stamp-arm-${s}`, 1)) expect(f.buf.h - f.oy).toBeLessThanOrEqual(0);
  });
});
