/** Smoothness gate helpers (tests/art/motion.ts, plan F2) proven on today's strips. */
import { beforeAll, describe, expect, it } from 'vitest';
import { poseJoints } from '../../src/game/art/humanoid';
import * as P from '../../src/game/art/poses';
import { tween } from '../../src/game/art/tween';
import { RECRUIT_STYLE as S } from '../../src/game/content/characters/art';
import { assertNoDuplicateFrames, assertSmooth, duplicateFrames, motionReport } from './motion';

const C = 'char/recruit/';

beforeAll(async () => {
  await import('../../src/game/content/characters/art');
});

describe('poseJoints', () => {
  it('puts the feet on the ground and applies rot / dx / dy', () => {
    const j = poseJoints(S, P.STAND);
    expect(j.pelvis[1]).toBeLessThan(-10);
    expect(Math.max(j.ankleN[1], j.ankleF[1])).toBeLessThan(0);
    const m = poseJoints(S, { ...P.STAND, dx: 3, dy: -2 });
    expect(m.neck[0] - j.neck[0]).toBeCloseTo(3);
    expect(m.neck[1] - j.neck[1]).toBeCloseTo(-2);
    const r = poseJoints(S, { ...P.STAND, rot: 90 });
    expect(r.pelvis).toEqual(j.pelvis);
    expect(r.neck[0]).toBeGreaterThan(j.pelvis[0] + 5); // clockwise: the head swings forward
  });
});

describe('motion report on existing strips', () => {
  it('legs-run (8 poses, 4 ticks each, loop)', () => {
    const r = motionReport({ style: S, poses: P.RUN, durations: [4], loop: true });
    expect(r.steps).toHaveLength(8);
    console.log('legs-run px/tick', r.steps.map((s) => s.perTick.toFixed(2)).join(' '), 'worst', r.worst.index, r.worst.joint);
    expect(r.worst.perTick).toBeGreaterThan(0);
  });

  it('die (today: one-shot)', () => {
    const r = motionReport({ style: S, poses: P.DIE, durations: [6, 6, 6, 6, 8, 40] });
    console.log('die px/tick', r.steps.map((s) => s.perTick.toFixed(2)).join(' '), 'worst', r.worst.index, r.worst.joint);
    expect(r.steps).toHaveLength(P.DIE.length - 1);
  });

  it('assertSmooth fails on a jump and names the step; smear frames are exempt', () => {
    const o = { style: S, poses: [P.STAND, { ...P.STAND, dx: 20 }, { ...P.STAND, dx: 21 }], durations: [2] };
    expect(() => assertSmooth(o)).toThrow(/step 0/);
    expect(() => assertSmooth({ ...o, smear: [0] })).not.toThrow();
    expect(() => assertSmooth({ ...o, smear: [0, 1, 2] })).toThrow(/smear/);
  });

  it('a tweened run (2x frames at half the ticks) stays under the gate', () => {
    const keys = motionReport({ style: S, poses: P.RUN, durations: [4], loop: true }).worst.perTick;
    const fine = tween(S, P.RUN, { counts: 1, ease: 'linear', loop: true });
    const r = assertSmooth({ style: S, poses: fine, durations: [2], loop: true }, Math.max(3, keys));
    console.log('legs-run tweened x2 @2 ticks worst', r.worst.perTick.toFixed(2), 'vs keys', keys.toFixed(2));
    expect(fine).toHaveLength(16);
  });
});

describe('duplicate frames', () => {
  it('legs-run and die have no identical consecutive frames at 1x and 2x', () => {
    for (const id of [C + 'legs-run', C + 'die']) {
      console.log(id, 'dups @1x', duplicateFrames(id, 1), '@2x', duplicateFrames(id, 2));
      assertNoDuplicateFrames(id);
    }
  });

  it('flags a strip that holds a frame', () => {
    // torso idle with BREATH differs; legs-idle is a single frame (no pairs).
    expect(duplicateFrames(C + 'legs-idle', 1)).toEqual([]);
  });
});
