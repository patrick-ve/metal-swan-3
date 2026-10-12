import { afterEach, describe, expect, it, vi } from 'vitest';
import { ascii } from '../../src/engine/ascii';
import { luma, MAGENTA } from '../../src/engine/color';
import { INK, inPalette, nearest, PAL, PALETTE, ramp, RAMP_NAMES, shade, stepShade, SWATCHES } from '../../src/engine/palette';
import { mask } from './util';

afterEach(() => vi.restoreAllMocks());

describe('ascii', () => {
  it('maps characters and keeps . and space transparent', () => {
    const b = ascii(['#o.', ' #'], { '#': 0x111111ff, o: 0x222222ff });
    expect([b.w, b.h]).toEqual([3, 2]);
    expect(b.get(0, 0)).toBe(0x111111ff);
    expect(b.get(1, 0)).toBe(0x222222ff);
    expect(b.get(2, 0)).toBe(0);
    expect(b.get(0, 1)).toBe(0);
    expect(b.get(1, 1)).toBe(0x111111ff);
  });

  it('dedents template strings', () => {
    const b = ascii(
      `
        .#.
        ###
      `,
      { '#': 0xffffffff },
    );
    expect(mask(b)).toEqual(['.#.', '###']);
  });

  it('draws unknown characters magenta and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const b = ascii(['zz'], {});
    expect(b.get(0, 0)).toBe(MAGENTA);
    ascii(['z'], {});
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('palette', () => {
  it('has 48–64 unique colours, all opaque', () => {
    expect(PALETTE.length).toBeGreaterThanOrEqual(48);
    expect(PALETTE.length).toBeLessThanOrEqual(64);
    expect(new Set(PALETTE).size).toBe(PALETTE.length);
    expect(new Set(SWATCHES.map((s) => s.name)).size).toBe(SWATCHES.length);
    for (const c of PALETTE) expect(c & 255).toBe(255);
  });

  it('ramps only use palette colours and run dark → light', () => {
    for (const name of RAMP_NAMES) {
      const r = PAL[name];
      expect(r.length, name).toBeGreaterThanOrEqual(2);
      r.forEach((c, i) => {
        expect(inPalette(c), `${name}[${i}]`).toBe(true);
        if (i > 0) expect(luma(c), `${name}[${i}] lighter than [${i - 1}]`).toBeGreaterThan(luma(r[i - 1]));
      });
    }
  });

  it('covers the requested material families', () => {
    for (const n of ['ink', 'steel', 'stone', 'olive', 'sand', 'brown', 'rust', 'red', 'orange', 'gold', 'green', 'teal', 'sky', 'navy', 'purple', 'pink', 'snow', 'skinA', 'skinB', 'skinC', 'hairA', 'hairB', 'hairC', 'ui', 'fire']) {
      expect(RAMP_NAMES).toContain(n);
    }
    expect(INK).toBe(PAL.ink[0]);
  });

  it('shade clamps; ramp resolves aliases; stepShade walks the home ramp', () => {
    expect(shade('olive', -3)).toBe(PAL.olive[0]);
    expect(shade(PAL.olive, 99)).toBe(PAL.olive[PAL.olive.length - 1]);
    expect(shade('sky', 1.4)).toBe(PAL.sky[1]);
    expect(ramp('khaki')).toBe(PAL.sand);
    expect(ramp('foliage')).toBe(PAL.green);
    expect(stepShade(PAL.red[1], 1)).toBe(PAL.red[2]);
    expect(stepShade(PAL.red[0], -1)).toBe(PAL.red[0]);
    expect(stepShade(0x123456ff, 1)).toBe(0x123456ff);
  });

  it('warns once for an unknown ramp and falls back to steel', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(ramp('plaid')).toBe(PAL.steel);
    ramp('plaid');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('nearest maps to palette colours and keeps alpha', () => {
    for (const c of PALETTE) expect(nearest(c)).toBe(c);
    expect(inPalette(nearest(0x7f7f7f80 | 0))).toBe(true);
    expect(nearest(0x7f7f7f80) & 255).toBe(0x80);
  });
});
