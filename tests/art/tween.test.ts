/** Pose tween helper (src/game/art/tween.ts, plan F1): the field rules. */
import { describe, expect, it } from 'vitest';
import { poseJoints, type Pose } from '../../src/game/art/humanoid';
import * as P from '../../src/game/art/poses';
import { EASE, inbetween, tween } from '../../src/game/art/tween';
import { RECRUIT_STYLE as S } from '../../src/game/content/characters/art';

describe('inbetween', () => {
  it('returns the keys at t 0 and 1', () => {
    expect(inbetween(S, P.STAND, P.LAND, 0)).toBe(P.STAND);
    expect(inbetween(S, P.STAND, P.LAND, 1)).toBe(P.LAND);
  });

  it('lerps numbers with neutral 0 and omits fields neither key has', () => {
    const m = inbetween(S, { lean: 10, bob: 2 }, { bob: 0 }, 0.5);
    expect(m.lean).toBe(5);
    expect(m.bob).toBe(1);
    expect('hunch' in m).toBe(false);
    expect('rot' in m).toBe(false);
  });

  it('takes the shortest arc for angles and lerps rot literally', () => {
    const m = inbetween(S, { lean: 170, rot: 0 }, { lean: -170, rot: 360 }, 0.5);
    expect(((m.lean ?? 0) + 360) % 360).toBeCloseTo(180);
    expect(m.rot).toBe(180);
    const l = inbetween(S, { legN: { hip: 350, knee: 10 } }, { legN: { hip: 10, knee: 10 } }, 0.5);
    expect(((l.legN?.hip ?? 0) + 360) % 360).toBeCloseTo(0);
  });

  it('derives legScale from crouch when one key lacks it', () => {
    const m = inbetween(S, { crouch: 1 }, { legScale: 1 }, 0.5);
    expect(m.legScale).toBeCloseTo((0.55 + 1) / 2);
  });

  it('never synthesizes arms, flutter, heldAngle or gunAngle: holds the nearer key', () => {
    const a: Pose = { armN: { sh: 40, el: 10 }, flutter: 2, heldAngle: -90, gunAngle: 20 };
    expect(inbetween(S, a, {}, 0.3)).toMatchObject({ armN: { sh: 40, el: 10 }, flutter: 2, heldAngle: -90, gunAngle: 20 });
    const b = inbetween(S, a, {}, 0.7);
    for (const k of ['armN', 'flutter', 'heldAngle', 'gunAngle'] as const) expect(b[k]).toBeUndefined();
  });

  it('switches discrete fields at t >= 0.5 or holds by option', () => {
    const a: Pose = { aim: 'fwd', expr: 'normal', held: 'knife', hat: true };
    const b: Pose = { aim: 'up', expr: 'shout', held: 'none', hat: false };
    expect(inbetween(S, a, b, 0.49)).toMatchObject(a);
    expect(inbetween(S, a, b, 0.5)).toMatchObject(b);
    expect(inbetween(S, a, b, 0.9, { hold: 'a' })).toMatchObject(a);
    expect(inbetween(S, a, b, 0.1, { hold: 'b' })).toMatchObject(b);
  });

  it('mixes FK and IK arms through poseJoints so the hand moves continuously', () => {
    const fk: Pose = { armN: { sh: 10, el: 30 } };
    const ik: Pose = { armN: { to: [8, 2] } };
    const wr = (p: Pose): [number, number] => poseJoints(S, p).wrN;
    const m = inbetween(S, fk, ik, 0.5);
    expect(m.armN?.sh).toBeTypeOf('number');
    expect(m.armN?.to).toBeUndefined();
    const [a, b, c] = [wr(fk), wr(m), wr(ik)];
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const bc = Math.hypot(c[0] - b[0], c[1] - b[1]);
    expect(Math.abs(ab - bc)).toBeLessThan(Math.max(ab, bc));
    // An IK key converted to FK lands where the IK put the hand.
    const end = inbetween(S, fk, ik, 0.999);
    const e = wr(end);
    expect(Math.hypot(e[0] - c[0], e[1] - c[1])).toBeLessThan(0.5);
  });

  it('snaps small head tilts to 0 or 8', () => {
    expect(inbetween(S, { head: { tilt: 0 } }, { head: { tilt: 8 } }, 0.25).head?.tilt).toBe(0);
    expect(inbetween(S, { head: { tilt: 0 } }, { head: { tilt: 8 } }, 0.6).head?.tilt).toBe(8);
    expect(inbetween(S, { head: { tilt: 0 } }, { head: { tilt: -16 } }, 0.5).head?.tilt).toBe(-8);
  });

  it('airborne in-betweens lerp the pelvis between the solved heights when grounded differs', () => {
    const a = P.LAND;
    const b = P.JUMP[1];
    const ya = poseJoints(S, a).pelvis[1];
    const yb = poseJoints(S, b).pelvis[1];
    const m = inbetween(S, a, b, 0.5);
    expect(m.grounded).toBe(false);
    const y = poseJoints(S, m).pelvis[1];
    expect(y).toBeGreaterThanOrEqual(Math.min(ya, yb) - 0.01);
    expect(y).toBeLessThanOrEqual(Math.max(ya, yb) + 0.01);
    expect(poseJoints(S, inbetween(S, a, b, 0.001)).pelvis[1]).toBeCloseTo(ya, 0);
  });
});

describe('tween', () => {
  it('places keys and in-betweens per pair, wrapping in loop mode', () => {
    const keys = [P.STAND, P.LAND, P.FALL];
    expect(tween(S, keys, { counts: 2 })).toHaveLength(3 + 2 * 2);
    const per = tween(S, keys, { perKey: [1, 3] });
    expect(per).toHaveLength(3 + 4);
    expect(per[0]).toBe(P.STAND);
    expect(per[2]).toBe(P.LAND);
    expect(per[6]).toBe(P.FALL);
    const loop = tween(S, keys, { counts: 1, loop: true });
    expect(loop).toHaveLength(6);
    expect(loop[5]).not.toBe(P.STAND);
  });

  it('eases: inOut moves slowly near the keys, outBack overshoots', () => {
    expect(EASE.inOut(0.1)).toBeLessThan(0.1);
    expect(EASE.out(0.1)).toBeGreaterThan(0.1);
    expect(Math.max(...[0.6, 0.7, 0.8, 0.9].map(EASE.outBack))).toBeGreaterThan(1);
    expect(EASE.outBack(1)).toBeCloseTo(1);
    const lean = tween(S, [{ lean: 0 }, { lean: 30 }], { counts: 3, ease: 'linear' }).map((p) => p.lean ?? 0);
    expect(lean.map((v) => Math.round(v * 10) / 10)).toEqual([0, 7.5, 15, 22.5, 30]);
  });

  it('is deterministic', () => {
    const k = [P.STAND, P.JUMP[0], P.FALL, P.LAND];
    expect(JSON.stringify(tween(S, k, { counts: 2, loop: true }))).toBe(JSON.stringify(tween(S, k, { counts: 2, loop: true })));
  });
});
