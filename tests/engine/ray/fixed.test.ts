import { describe, expect, it } from 'vitest';
import { ANG_FULL, angDelta, angleTo, angNorm, COS, degToAng, SIN } from '../../../src/engine/ray/fixed';

describe('ray fixed angles', () => {
  it('has exact cardinal values and symmetric tables', () => {
    expect([COS[0], SIN[0]]).toEqual([1, 0]);
    expect([COS[1024], SIN[1024]]).toEqual([0, 1]);
    expect([COS[2048], SIN[2048]]).toEqual([-1, 0]);
    expect([COS[3072], SIN[3072]]).toEqual([0, -1]);
    for (let a = 0; a < ANG_FULL; a++) {
      expect(SIN[a] + SIN[(ANG_FULL - a) & 4095] === 0).toBe(true);
      expect(COS[a]).toBe(COS[(ANG_FULL - a) & 4095]);
      expect(Math.round(SIN[a] * 65536)).toBe(SIN[a] * 65536);
    }
  });

  it('normalises and measures signed turns', () => {
    expect(angNorm(-1)).toBe(4095);
    expect(angNorm(4096 * 3 + 5)).toBe(5);
    expect(angDelta(0, 1024)).toBe(1024);
    expect(angDelta(0, 3072)).toBe(-1024);
    expect(angDelta(4000, 100)).toBe(196);
    expect(angDelta(0, 2048)).toBe(2048);
    expect(angDelta(1, 2048)).toBe(2047);
    expect(angDelta(2049, 0)).toBe(2047);
  });

  it('angleTo inverts the tables for every angle', () => {
    for (let a = 0; a < ANG_FULL; a++) expect(angleTo(COS[a] * 3, SIN[a] * 3)).toBe(a);
    expect(angleTo(0, 0)).toBe(0);
    expect(angleTo(1, 1)).toBe(512);
    expect(angleTo(-1, -1)).toBe(2560);
    expect(angleTo(0, -5)).toBe(3072);
  });

  it('converts degrees (0 east, 90 south)', () => {
    expect(degToAng(90)).toBe(1024);
    expect(degToAng(-90)).toBe(3072);
    expect(degToAng(360)).toBe(0);
    expect(degToAng(45)).toBe(512);
  });
});
