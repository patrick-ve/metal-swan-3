import { describe, expect, it } from 'vitest';
import { Spline3, splineSample } from '../../../src/engine/r3/spline';

/** n points on a circle of radius R (y 0), driven so that the right vector points inside (the stub track turns right). */
function circle(R: number, n = 12): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(Math.cos((i * 2 * Math.PI) / n) * R, 0, Math.sin((i * 2 * Math.PI) / n) * R);
  return out;
}

describe('r3 closed spline (arc length)', () => {
  it('a circle of control points: the length is close to 2πR, samples wrap', () => {
    const sp = new Spline3(circle(100));
    expect(Math.abs(sp.length - 2 * Math.PI * 100) / (2 * Math.PI * 100)).toBeLessThan(0.01);
    const a = sp.sample(10);
    const b = sp.sample(10 + sp.length);
    const c = sp.sample(10 - 3 * sp.length);
    for (let k = 0; k < 3; k++) {
      expect(b.p[k]).toBeCloseTo(a.p[k], 6);
      expect(c.p[k]).toBeCloseTo(a.p[k], 6);
    }
  });

  it('the tangent is a unit vector; the right vector is horizontal, unit and perpendicular', () => {
    const sp = new Spline3(circle(80));
    const s = splineSample();
    for (let d = 0; d < sp.length; d += sp.length / 37) {
      sp.sample(d, s);
      expect(Math.hypot(s.t[0], s.t[1], s.t[2])).toBeCloseTo(1, 9);
      expect(s.r[1]).toBe(0);
      expect(Math.hypot(s.r[0], s.r[2])).toBeCloseTo(1, 9);
      expect(s.r[0] * s.t[0] + s.r[2] * s.t[2]).toBeCloseTo(0, 9);
      // Right turns all the way: the right vector points to the inside of the loop.
      expect(s.r[0] * s.p[0] + s.r[2] * s.p[2]).toBeLessThan(0);
    }
  });

  it('nearest finds the arc length of a point on (or beside) the curve, with and without a hint', () => {
    const sp = new Spline3(circle(120, 10));
    const s = splineSample();
    for (const d of [3, 100, 377, sp.length - 2]) {
      sp.sample(d, s);
      const x = s.p[0] + s.r[0] * 4;
      const z = s.p[2] + s.r[2] * 4;
      const near = (u: number): number => Math.min(Math.abs(u - d), sp.length - Math.abs(u - d));
      expect(near(sp.nearest(x, z))).toBeLessThan(0.5);
      expect(near(sp.nearest(x, z, d + 6))).toBeLessThan(0.5);
    }
  });

  it('is deterministic: the same points give the same table', () => {
    const a = new Spline3(circle(50, 9));
    const b = new Spline3(circle(50, 9));
    expect(a.length).toBe(b.length);
    expect([...a.tableX]).toEqual([...b.tableX]);
  });
});
