/**
 * 3-vectors for the race sim and the 3D view (docs/design/rally.md §12.1, §12.4): plain mutable
 * tuples; every operation writes into an `out` the caller owns (no allocation in hot paths) and
 * returns it. Only + − × ÷ and Math.sqrt.
 */

export type Vec3 = [number, number, number];

/** A new vector (setup code only, not per tick). */
export function vec3(x = 0, y = 0, z = 0): Vec3 {
  return [x, y, z];
}

export function v3set(out: Vec3, x: number, y: number, z: number): Vec3 {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

export function v3copy(out: Vec3, a: Readonly<Vec3>): Vec3 {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  return out;
}

export function v3add(out: Vec3, a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];
  return out;
}

export function v3sub(out: Vec3, a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
  return out;
}

export function v3scale(out: Vec3, a: Readonly<Vec3>, s: number): Vec3 {
  out[0] = a[0] * s;
  out[1] = a[1] * s;
  out[2] = a[2] * s;
  return out;
}

/** out = a + b·s. */
export function v3addScaled(out: Vec3, a: Readonly<Vec3>, b: Readonly<Vec3>, s: number): Vec3 {
  out[0] = a[0] + b[0] * s;
  out[1] = a[1] + b[1] * s;
  out[2] = a[2] + b[2] * s;
  return out;
}

export function v3dot(a: Readonly<Vec3>, b: Readonly<Vec3>): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** out = a × b (out may alias a or b). */
export function v3cross(out: Vec3, a: Readonly<Vec3>, b: Readonly<Vec3>): Vec3 {
  const x = a[1] * b[2] - a[2] * b[1];
  const y = a[2] * b[0] - a[0] * b[2];
  const z = a[0] * b[1] - a[1] * b[0];
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}

export function v3len(a: Readonly<Vec3>): number {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
}

export function v3dist(a: Readonly<Vec3>, b: Readonly<Vec3>): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** out = a / |a| (a zero vector stays zero). */
export function v3normalize(out: Vec3, a: Readonly<Vec3>): Vec3 {
  const l = v3len(a);
  if (l === 0) return v3set(out, 0, 0, 0);
  return v3scale(out, a, 1 / l);
}

/** out = a + (b − a)·t. */
export function v3lerp(out: Vec3, a: Readonly<Vec3>, b: Readonly<Vec3>, t: number): Vec3 {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}
