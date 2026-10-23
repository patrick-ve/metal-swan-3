import { describe, expect, it } from 'vitest';
import { forward, mat4, mat4Multiply, mat4Perspective, mat4Pose, mat4PoseYPR, mat4RotateY, mat4TransformPoint, mat4TransformPoint4, mat4Translate, mat4View } from '../../../src/engine/r3/mat';
import { vec3 } from '../../../src/engine/r3/vec';
import type { Cam3 } from '../../../src/engine/view3d';

const close = (a: ArrayLike<number>, b: ArrayLike<number>, eps = 1e-5): void => {
  for (let i = 0; i < b.length; i++) expect(Math.abs(a[i] - b[i]), `[${i}] ${a[i]} vs ${b[i]}`).toBeLessThan(eps);
};

describe('r3 matrices (column-major; y up, yaw + = left)', () => {
  it('rotateY turns +z into forward(yaw); multiply composes (b first)', () => {
    const yaw = 0.7;
    const p = mat4TransformPoint(vec3(), mat4RotateY(mat4(), yaw), 0, 0, 1);
    close(p, forward(vec3(), yaw));
    const m = mat4Multiply(mat4(), mat4Translate(mat4(), 5, 0, 0), mat4RotateY(mat4(), yaw));
    close(mat4TransformPoint(vec3(), m, 0, 0, 1), [5 + Math.sin(yaw), 0, Math.cos(yaw)]);
    close(mat4Pose(mat4(), 5, 0, 0, yaw), m);
  });

  it('a yaw-only pose with pitch and roll 0 equals mat4Pose', () => {
    close(mat4PoseYPR(mat4(), 1, 2, 3, 0.4, 0, 0), mat4Pose(mat4(), 1, 2, 3, 0.4));
    // Pitch + = nose up; roll + = the right side down (the model's −x side).
    const up = mat4TransformPoint(vec3(), mat4PoseYPR(mat4(), 0, 0, 0, 0, 0.3, 0), 0, 0, 1);
    expect(up[1]).toBeGreaterThan(0.29);
    const right = mat4TransformPoint(vec3(), mat4PoseYPR(mat4(), 0, 0, 0, 0, 0, 0.3), -1, 0, 0);
    expect(right[1]).toBeLessThan(-0.29);
  });

  it('the view matrix: the camera at the origin, looking down −z, right = +x', () => {
    const cam: Cam3 = { pos: [10, 2, -4], yaw: 1.1, pitch: -0.2, roll: 0, fovY: 1, near: 0.5, far: 500 };
    const v = mat4View(mat4(), cam);
    close(mat4TransformPoint(vec3(), v, 10, 2, -4), [0, 0, 0]);
    const f = forward(vec3(), cam.yaw, cam.pitch);
    close(mat4TransformPoint(vec3(), v, 10 + f[0] * 5, 2 + f[1] * 5, -4 + f[2] * 5), [0, 0, -5]);
    // Yaw 0 looks along +z: world −x is on the right.
    const v0 = mat4View(mat4(), { ...cam, pos: [0, 0, 0], yaw: 0, pitch: 0 });
    const p = mat4TransformPoint(vec3(), v0, -1, 0, 3);
    expect(p[0]).toBeCloseTo(1, 6);
    expect(p[2]).toBeCloseTo(-3, 6);
  });

  it('the perspective maps near / far to z = −1 / 1', () => {
    const p = mat4Perspective(mat4(), 1, 16 / 9, 0.5, 500);
    const a = mat4TransformPoint4([0, 0, 0, 0], p, 0, 0, -0.5);
    const b = mat4TransformPoint4([0, 0, 0, 0], p, 0, 0, -500);
    expect(a[2] / a[3]).toBeCloseTo(-1, 5);
    expect(b[2] / b[3]).toBeCloseTo(1, 4);
  });
});
