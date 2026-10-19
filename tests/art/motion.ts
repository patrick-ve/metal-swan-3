/**
 * Smoothness gate helpers (docs/ART_GUIDE.md "Motion", plan F2).
 * - motionReport: the largest joint travel per DISPLAYED tick between consecutive poses (1× px,
 *   after rot / dx / dy): the travel of step i (pose i → i + 1) divided by pose i's duration.
 * - assertSmooth: fails with the step index when a non-smear step travels more than maxPerTick.
 * - assertNoDuplicateFrames: no two consecutive rendered frames of a sprite id are identical, at
 *   1× and 2×.
 */
import { expect } from 'vitest';
import { getFrame, frameCount, spriteAnim } from '../../src/engine/sprites';
import { JOINT_NAMES, poseJoints, type HumanStyle, type Pose } from '../../src/game/art/humanoid';

export interface MotionOpts {
  style: HumanStyle;
  poses: readonly Pose[];
  /** Ticks per pose (cycled). */
  durations: readonly number[];
  /** Pose indexes marked smear: their outgoing step may exceed the limit (at most 2 per strip). */
  smear?: readonly number[];
  /** Include the last → first step. */
  loop?: boolean;
}

export interface MotionStep {
  /** Step from pose `index` to the next. */
  index: number;
  /** Largest joint travel in px. */
  travel: number;
  /** travel / duration of pose `index`. */
  perTick: number;
  joint: string;
}

export interface MotionReport {
  steps: MotionStep[];
  worst: MotionStep;
}

export function motionReport(o: MotionOpts): MotionReport {
  const js = o.poses.map((p) => poseJoints(o.style, p));
  const n = js.length;
  const steps: MotionStep[] = [];
  const last = o.loop ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = js[i];
    const b = js[(i + 1) % n];
    let travel = 0;
    let joint: string = JOINT_NAMES[0];
    for (const k of JOINT_NAMES) {
      const d = Math.hypot(b[k][0] - a[k][0], b[k][1] - a[k][1]);
      if (d > travel) {
        travel = d;
        joint = k;
      }
    }
    const dur = o.durations[i % o.durations.length];
    steps.push({ index: i, travel, perTick: travel / dur, joint });
  }
  const worst = steps.reduce((w, s) => (s.perTick > w.perTick ? s : w), steps[0] ?? { index: -1, travel: 0, perTick: 0, joint: '' });
  return { steps, worst };
}

export function assertSmooth(o: MotionOpts, maxPerTick = 3): MotionReport {
  const r = motionReport(o);
  const smear = new Set(o.smear ?? []);
  expect(smear.size, 'at most 2 smear frames per strip').toBeLessThanOrEqual(2);
  for (const s of r.steps) {
    if (smear.has(s.index)) continue;
    expect(s.perTick, `step ${s.index} (${s.joint}) travels ${s.perTick.toFixed(2)} px/tick`).toBeLessThanOrEqual(maxPerTick);
  }
  return r;
}

function same(a: ReturnType<typeof getFrame>, b: ReturnType<typeof getFrame>): boolean {
  if (a.ox !== b.ox || a.oy !== b.oy || a.buf.w !== b.buf.w || a.buf.h !== b.buf.h) return false;
  const x = a.buf.data;
  const y = b.buf.data;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

/** Consecutive frame pairs of `id` that render identically, at density d (loop wraps). */
export function duplicateFrames(id: string, d: number): number[] {
  const n = frameCount(id);
  const loop = spriteAnim(id).loop && n > 1;
  const dup: number[] = [];
  for (let i = 0; i < (loop ? n : n - 1); i++) if (same(getFrame(id, i, d), getFrame(id, (i + 1) % n, d))) dup.push(i);
  return dup;
}

export function assertNoDuplicateFrames(id: string): void {
  for (const d of [1, 2]) expect(duplicateFrames(id, d), `${id} @${d}x identical consecutive frames`).toEqual([]);
}
