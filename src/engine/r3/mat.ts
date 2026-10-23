/**
 * 4×4 matrices, COLUMN-MAJOR (the WebGL layout: element (row r, column c) at m[c·4 + r]), for the
 * 3D view and the race sim (docs/design/rally.md §12.1). Every function writes into `out` (no
 * allocation) and returns it; `out` may alias an input. Trig comes from `r3/trig.ts` only.
 *
 * Conventions (view3d.ts): y up, metres, radians; yaw is a right-handed turn about +y (+ = left,
 * counter-clockwise seen from above); forward(yaw) = (sin yaw, 0, cos yaw). A camera looks along
 * forward(yaw) tilted by pitch (+ = up); roll + = the right side down. View space is the GL one
 * (x right, y up, looking down −z); clip space is the GL one (z in −w..w).
 */
import type { Cam3 } from '../view3d';
import { cosT, sinT } from './trig';
import type { Vec3 } from './vec';

export type Mat4 = Float32Array | Float64Array;

/** A new identity matrix (setup code only). */
export function mat4(): Float32Array {
  return mat4Identity(new Float32Array(16));
}

export function mat4Identity<M extends Mat4>(out: M): M {
  out.fill(0);
  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[15] = 1;
  return out;
}

export function mat4Copy<M extends Mat4>(out: M, a: Mat4): M {
  for (let i = 0; i < 16; i++) out[i] = a[i];
  return out;
}

/** out = a · b (b applies first). `out` may alias a or b. */
export function mat4Multiply<M extends Mat4>(out: M, a: Mat4, b: Mat4): M {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
    out[c * 4] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
    out[c * 4 + 1] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
    out[c * 4 + 2] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
    out[c * 4 + 3] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
  }
  return out;
}

/** A translation. */
export function mat4Translate<M extends Mat4>(out: M, x: number, y: number, z: number): M {
  mat4Identity(out);
  out[12] = x;
  out[13] = y;
  out[14] = z;
  return out;
}

/** A scale. */
export function mat4Scale<M extends Mat4>(out: M, x: number, y: number, z: number): M {
  mat4Identity(out);
  out[0] = x;
  out[5] = y;
  out[10] = z;
  return out;
}

/** A turn about +x (right-handed: + tips +y toward +z). */
export function mat4RotateX<M extends Mat4>(out: M, a: number): M {
  const c = cosT(a);
  const s = sinT(a);
  mat4Identity(out);
  out[5] = c;
  out[6] = s;
  out[9] = -s;
  out[10] = c;
  return out;
}

/** A turn about +y (right-handed: + turns +z toward +x, a left turn seen from above). */
export function mat4RotateY<M extends Mat4>(out: M, a: number): M {
  const c = cosT(a);
  const s = sinT(a);
  mat4Identity(out);
  out[0] = c;
  out[2] = -s;
  out[8] = s;
  out[10] = c;
  return out;
}

/** A turn about +z (right-handed: + turns +x toward +y). */
export function mat4RotateZ<M extends Mat4>(out: M, a: number): M {
  const c = cosT(a);
  const s = sinT(a);
  mat4Identity(out);
  out[0] = c;
  out[1] = s;
  out[4] = -s;
  out[5] = c;
  return out;
}

/** A model pose: translate(x, y, z) · rotateY(yaw) (a car on flat ground). */
export function mat4Pose<M extends Mat4>(out: M, x: number, y: number, z: number, yaw: number): M {
  mat4RotateY(out, yaw);
  out[12] = x;
  out[13] = y;
  out[14] = z;
  return out;
}

/**
 * A model pose with pitch and roll: translate · rotateY(yaw) · rotateX(−pitch) · rotateZ(roll)
 * (pitch + = nose up, roll + = the right side down, for a model whose nose points +z).
 */
export function mat4PoseYPR<M extends Mat4>(out: M, x: number, y: number, z: number, yaw: number, pitch: number, roll: number): M {
  const cy = cosT(yaw), sy = sinT(yaw);
  const cp = cosT(pitch), sp = sinT(pitch);
  const cr = cosT(roll), sr = sinT(roll);
  // Forward (model +z), up (model +y) and the model's +x axis (its LEFT side) in world space.
  const fx = sy * cp, fy = sp, fz = cy * cp;
  // The left axis before the roll (horizontal), then the up axis = forward × left.
  const lx = cy, ly = 0, lz = -sy;
  const ux = fy * lz - fz * ly, uy = fz * lx - fx * lz, uz = fx * ly - fy * lx;
  // Roll: + = the right side down = the left side up.
  const Lx = lx * cr + ux * sr, Ly = ly * cr + uy * sr, Lz = lz * cr + uz * sr;
  const Ux = ux * cr - lx * sr, Uy = uy * cr - ly * sr, Uz = uz * cr - lz * sr;
  out[0] = Lx; out[1] = Ly; out[2] = Lz; out[3] = 0;
  out[4] = Ux; out[5] = Uy; out[6] = Uz; out[7] = 0;
  out[8] = fx; out[9] = fy; out[10] = fz; out[11] = 0;
  out[12] = x; out[13] = y; out[14] = z; out[15] = 1;
  return out;
}

/** A GL perspective projection (fovY radians, aspect w / h, near and far > 0). */
export function mat4Perspective<M extends Mat4>(out: M, fovY: number, aspect: number, near: number, far: number): M {
  const half = fovY / 2;
  const f = cosT(half) / sinT(half);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

/** The view matrix of a camera (world → view space). */
export function mat4View<M extends Mat4>(out: M, cam: Readonly<Cam3>): M {
  const cy = cosT(cam.yaw), sy = sinT(cam.yaw);
  const cp = cosT(cam.pitch), sp = sinT(cam.pitch);
  const cr = cosT(cam.roll), sr = sinT(cam.roll);
  const fx = sy * cp, fy = sp, fz = cy * cp;
  // Right (horizontal) and up before the roll.
  const rx = -cy, ry = 0, rz = sy;
  const ux = -sy * sp, uy = cp, uz = -cy * sp;
  // Roll: + = the right side down.
  const Rx = rx * cr - ux * sr, Ry = ry * cr - uy * sr, Rz = rz * cr - uz * sr;
  const Ux = ux * cr + rx * sr, Uy = uy * cr + ry * sr, Uz = uz * cr + rz * sr;
  const [px, py, pz] = cam.pos;
  out[0] = Rx; out[4] = Ry; out[8] = Rz; out[12] = -(Rx * px + Ry * py + Rz * pz);
  out[1] = Ux; out[5] = Uy; out[9] = Uz; out[13] = -(Ux * px + Uy * py + Uz * pz);
  out[2] = -fx; out[6] = -fy; out[10] = -fz; out[14] = fx * px + fy * py + fz * pz;
  out[3] = 0; out[7] = 0; out[11] = 0; out[15] = 1;
  return out;
}

/** out = m · (x, y, z, 1), without the divide (an affine transform). */
export function mat4TransformPoint(out: Vec3, m: Mat4, x: number, y: number, z: number): Vec3 {
  out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
  out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  return out;
}

/** out = m · (x, y, z, 1) as clip coordinates (x, y, z, w). */
export function mat4TransformPoint4(out: number[] | Float64Array | Float32Array, m: Mat4, x: number, y: number, z: number): typeof out {
  out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
  out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
  out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
  out[3] = m[3] * x + m[7] * y + m[11] * z + m[15];
  return out;
}

/** The forward vector of a yaw (and pitch): (sin yaw · cos pitch, sin pitch, cos yaw · cos pitch). */
export function forward(out: Vec3, yaw: number, pitch = 0): Vec3 {
  const cp = cosT(pitch);
  out[0] = sinT(yaw) * cp;
  out[1] = sinT(pitch);
  out[2] = cosT(yaw) * cp;
  return out;
}
