import { describe, expect, it } from 'vitest';
import { angleDiff, atan2T, cosT, HALF_PI, PI, SIN_TABLE, sinT, tanT, TAU, TRIG_N, wrapAngle } from '../../../src/engine/r3/trig';

describe('r3 trig (docs/design/rally.md §12.4)', () => {
  it('the table is rounded to 1/2^20 and exactly symmetric', () => {
    for (let i = 0; i <= TRIG_N; i += 97) expect(Number.isInteger(SIN_TABLE[i] * 1048576)).toBe(true);
    expect(SIN_TABLE[0]).toBe(0);
    expect(SIN_TABLE[TRIG_N / 4]).toBe(1);
    expect(SIN_TABLE[TRIG_N / 2]).toBe(0);
    expect(SIN_TABLE[(3 * TRIG_N) / 4]).toBe(-1);
    for (let i = 1; i < TRIG_N / 4; i += 13) expect(SIN_TABLE[TRIG_N / 2 - i]).toBe(SIN_TABLE[i]);
  });

  it('sinT / cosT / tanT follow Math within 2e-6 (any angle, negative and large too)', () => {
    let worst = 0;
    for (let k = 0; k < 5000; k++) {
      const a = (k - 2500) * 0.01937;
      worst = Math.max(worst, Math.abs(sinT(a) - Math.sin(a)), Math.abs(cosT(a) - Math.cos(a)));
    }
    expect(worst).toBeLessThan(2e-6);
    expect(cosT(HALF_PI)).toBeCloseTo(0, 6);
    expect(tanT(0.5)).toBeCloseTo(Math.tan(0.5), 5);
  });

  it('atan2T follows Math.atan2 within 1.2e-5 rad in every quadrant', () => {
    let worst = 0;
    for (let k = 0; k < 4000; k++) {
      const a = (k / 4000) * TAU - PI;
      const r = 0.5 + (k % 7);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      worst = Math.max(worst, Math.abs(angleDiff(Math.atan2(y, x), atan2T(y, x))));
    }
    expect(worst).toBeLessThan(1.2e-5);
    expect(atan2T(0, 0)).toBe(0);
    expect(atan2T(0, -1)).toBeCloseTo(PI, 9);
  });

  it('wrapAngle maps to (−π, π]; angleDiff is the short turn', () => {
    for (const a of [-10, -PI, -1, 0, 1, PI, 7, 100]) {
      const w = wrapAngle(a);
      expect(w).toBeGreaterThan(-PI - 1e-12);
      expect(w).toBeLessThanOrEqual(PI);
      expect(Math.abs(Math.sin(w) - Math.sin(a))).toBeLessThan(1e-9);
    }
    expect(wrapAngle(-PI)).toBe(PI);
    expect(angleDiff(3, -3)).toBeCloseTo(TAU - 6, 9);
  });
});
