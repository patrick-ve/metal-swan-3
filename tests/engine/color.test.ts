import { describe, expect, it } from 'vitest';
import { chA, chB, chG, chR, hex, rgba, withAlpha } from '../../src/engine/color';
import { loadContent } from '../../src/game/content/index';

describe('color', () => {
  it('packs and unpacks 0xRRGGBBAA', () => {
    const c = rgba(18, 52, 86, 120);
    expect(c).toBe(0x12345678);
    expect([chR(c), chG(c), chB(c), chA(c)]).toEqual([18, 52, 86, 120]);
  });
  it('parses hex strings', () => {
    expect(hex('#fff')).toBe(0xffffffff);
    expect(hex('102030')).toBe(0x102030ff);
    expect(hex('#10203040')).toBe(0x10203040);
    expect(withAlpha(0x102030ff, 0)).toBe(0x10203000);
  });
});

describe('content manifest', () => {
  it('loads every module without failures', async () => {
    const report = await loadContent();
    expect(report.failed).toEqual([]);
    expect(report.loaded.length).toBeGreaterThan(20);
  });
});
