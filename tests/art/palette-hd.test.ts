import { describe, expect, it } from 'vitest';
import { chB, chG, chR, luma } from '../../src/engine/color';
import { PAL, PALETTE, RAMP_NAMES } from '../../src/engine/palette';
import { HD_PALETTE, HD_RAMP_NAMES, PAL_HD, hdHome, hdRampOf, hdTone, inHdPalette } from '../../src/engine/palette-hd';

describe('PAL_HD (UHD palette)', () => {
  it('has at most 256 unique colours', () => {
    const all = new Set<number>();
    for (const n of HD_RAMP_NAMES) for (const c of PAL_HD[n]) all.add(c);
    expect(all.size).toBe(HD_PALETTE.length);
    expect(HD_PALETTE.length).toBeLessThanOrEqual(256);
    expect(HD_PALETTE.length).toBeGreaterThan(150);
  });

  it('every ramp has 6–8 tones (ink: 2) and strictly rising luma, dark → light', () => {
    for (const n of HD_RAMP_NAMES) {
      const r = PAL_HD[n];
      if (n === 'ink') expect(r.length).toBe(2);
      else {
        expect(r.length, n).toBeGreaterThanOrEqual(6);
        expect(r.length, n).toBeLessThanOrEqual(8);
      }
      for (let i = 1; i < r.length; i++) expect(luma(r[i]), `${n}[${i}]`).toBeGreaterThan(luma(r[i - 1]));
      for (const c of r) expect(c & 255, n).toBe(255);
    }
  });

  it('every 64-palette swatch is in PAL_HD', () => {
    for (const c of PALETTE) expect(inHdPalette(c), c.toString(16)).toBe(true);
  });

  it('hdRampOf maps each PAL ramp to an HD ramp holding its colours in the same order', () => {
    for (const name of RAMP_NAMES) {
      const hd = hdRampOf(PAL[name]);
      expect(hdRampOf(name)).toBe(hd);
      if (name === 'ui') continue; // an accent ramp across sky / teal: maps to sky
      let last = -1;
      for (const c of PAL[name]) {
        const i = hd.indexOf(c);
        expect(i, `${name} ${c.toString(16)}`).toBeGreaterThan(last);
        last = i;
      }
    }
    expect(hdRampOf('brick')).toBe(PAL_HD.brick);
    // A custom ramp of PAL colours goes to the HD ramp holding most of them.
    expect(hdRampOf([PAL.skinA[1], PAL.skinA[2], PAL.ink[0]])).toBe(PAL_HD.skinA);
  });

  it('hdHome finds every 64 swatch in a ramp that contains it', () => {
    for (const c of PALETTE) {
      const h = hdHome(c);
      expect(h).not.toBeNull();
      expect(h!.ramp[h!.i]).toBe(c);
    }
    expect(hdTone('steel', 0)).toBe(PAL_HD.steel[0]);
    expect(hdTone(PAL_HD.steel, 1)).toBe(PAL_HD.steel[7]);
  });

  it('shadows lean cool, highlights lean warm (hue drifts towards yellow at the light end)', () => {
    const hue = (c: number): number => {
      const r = chR(c) / 255;
      const g = chG(c) / 255;
      const b = chB(c) / 255;
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      if (mx - mn < 0.02) return -1;
      let h = mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn);
      h *= 60;
      return h < 0 ? h + 360 : h;
    };
    /** Circular distance of a hue from warm yellow (60°); achromatic (white) counts as warm. */
    const fromWarm = (c: number): number => {
      const h = hue(c);
      if (h < 0) return 0;
      const dd = Math.abs(h - 60) % 360;
      return dd > 180 ? 360 - dd : dd;
    };
    let ok = 0;
    let n = 0;
    for (const name of HD_RAMP_NAMES) {
      const r = PAL_HD[name];
      if (r.length < 6) continue;
      n++;
      if (fromWarm(r[r.length - 1]) <= fromWarm(r[0])) ok++;
    }
    expect(ok / n).toBeGreaterThan(0.85);
  });
});
