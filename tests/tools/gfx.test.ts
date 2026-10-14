import { describe, expect, it } from 'vitest';
import { resolveGfx } from '../../tools/lib/gfx';

describe('shot / arena --res and --gfx', () => {
  it('defaults to pixel (the GRAPHICS default) at every res', () => {
    expect(resolveGfx(1, null)).toEqual({ mode: 'pixel', note: '', warning: null });
    expect(resolveGfx(5, null)).toEqual({ mode: 'pixel', note: '  res 5 pixel', warning: null });
    expect(resolveGfx(5, 'smooth')).toEqual({ mode: 'smooth', note: '  res 5 smooth', warning: null });
    expect(resolveGfx(5, 'xbr').warning).toBe(null);
  });

  it('warns instead of falling back silently, and the title names the filter drawn', () => {
    const r1 = resolveGfx(1, 'xbr');
    expect(r1.mode).toBe('pixel');
    expect(r1.warning).toMatch(/no effect at --res 1/);
    const r3 = resolveGfx(3, 'xbr');
    expect(r3.note).toBe('  res 3 xbr (drawn as smooth)');
    expect(r3.warning).toMatch(/needs --res 4/);
    expect(resolveGfx(1, 'pixel').warning).toBe(null);
  });
});
