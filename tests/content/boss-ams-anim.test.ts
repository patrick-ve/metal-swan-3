/**
 * MECHA HASLEMA motion (docs/design/ams40.md wave 6, the user's pilot review: her attack animations
 * must clearly improve on today's): the baked strips have the role counts of the bake; every attack
 * plays a full sequence INSIDE its unchanged telegraph, hit and recovery windows (geometry.ts,
 * decision D7):
 * - the stamp slam: the dip, the coil, a 2-step rise, the overshoot, the trembling hold, the 2-frame
 *   smear on the last telegraph ticks, then the impact squash, the recoil, the settle, the lift;
 * - the chain whip: the wind-up, the 8-step flail whirl, the release while the lash is out, the
 *   snap at full reach, the pull back, the catch;
 * - the shield fan: the core charges and pulses, flashes at the volley; the stomp: half squat,
 *   squat, push-off, tuck, reach, landing squash; the shout, the hatch, the blink, the death.
 * Frames next to each other in a sequence are never identical.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Renderer } from '../../src/engine/render';
import { frameCount, getFrames } from '../../src/engine/sprites';
import * as G from '../../src/game/content/art40/ams-mayor.gen';
import '../../src/game/content/locals/index';
import { AmsMayor, MAYOR } from '../../src/game/content/bosses/ams/index';
import { loadContent } from '../../src/game/content/index';
import { FLOOR, TestWorld } from './helpers';

const ART = 'boss/ams-mayor';
const DOOR = 620;

beforeAll(async () => {
  await loadContent();
});

function same(id: string, a: number, b: number): boolean {
  const fs = getFrames(id, 1);
  const x = fs[a];
  const y = fs[b];
  if (x.buf.w !== y.buf.w || x.buf.h !== y.buf.h || x.ox !== y.ox || x.oy !== y.oy) return false;
  for (let i = 0; i < x.buf.data.length; i++) if (x.buf.data[i] !== y.buf.data[i]) return false;
  return true;
}

function differ(id: string, seq: readonly number[]): void {
  for (let i = 0; i + 1 < seq.length; i++) expect(same(id, seq[i], seq[i + 1]), `${id} ${seq[i]}→${seq[i + 1]}`).toBe(false);
}

/** The sprite calls of one draw: id and frame. */
function calls(boss: AmsMayor): Array<[string, number]> {
  const out: Array<[string, number]> = [];
  const r = { sprite: (id: string, f: number) => out.push([id, f]), line: () => undefined } as unknown as Renderer;
  boss.draw(r);
  return out;
}

/** The frame of one strip in this tick's draw (-1: not drawn). */
function shown(boss: AmsMayor, id: string): number {
  const c = calls(boss).find(([i]) => i === id);
  return c ? c[1] : -1;
}

/** The distinct runs of a per-tick record (a, a, b, b, a → a, b, a). */
function runs(seq: readonly number[]): number[] {
  return seq.filter((v, i) => i === 0 || v !== seq[i - 1]);
}

/** `want` appears in `seq` in this order (a subsequence). */
function inOrder(seq: readonly number[], want: readonly number[]): boolean {
  let k = 0;
  for (const v of seq) if (v === want[k]) k++;
  return k === want.length;
}

function arena(params: Record<string, unknown> = {}): { tw: TestWorld; boss: AmsMayor } {
  const tw = new TestWorld({ width: 1200, god: true, playerX: 300 });
  const boss = tw.spawn('ams-mayor', DOOR, params, FLOOR) as AmsMayor;
  return { tw, boss };
}

describe('MECHA HASLEMA: the baked strips', () => {
  it('has the role counts of the bake (the attacks: 20 stamp roles, 24 far-arm roles, 6 lash frames)', () => {
    expect(G.ARM_FRAMES).toBe(20);
    for (const s of [0, 1, 2]) expect(frameCount(`${ART}/stamp-arm-${s}`)).toBe(2 * G.ARM_FRAMES);
    expect(frameCount(`${ART}/stamp-arm-gone`)).toBe(G.STUMP_FRAMES);
    expect(frameCount(`${ART}/arm-back`)).toBe(G.BACK_CATCH + 1);
    expect(G.BACK_WHIRL_STEPS).toBe(8);
    expect(frameCount(`${ART}/legs`)).toBe(G.MAYOR_WALK + G.LEGS_WALK_FRAMES);
    expect(G.LEGS_WALK_FRAMES).toBe(12);
    expect(frameCount(`${ART}/lash`)).toBe(6);
    expect(frameCount(`${ART}/wig`)).toBe(G.WIG_FRAMES);
    expect(frameCount(`${ART}/head-0`)).toBe(10);
    expect(frameCount(`${ART}/medallion-0`)).toBe(7);
  });

  it('every legs frame carries the hip point; a squat lowers it, the push-off lifts it', () => {
    const fs = getFrames(`${ART}/legs`, 1);
    for (const f of fs) expect(f.pts?.hip).toBeDefined();
    const y = (i: number): number => fs[i].pts!.hip[1];
    expect(y(G.LEGS_SQUAT)).toBeGreaterThan(y(G.LEGS_HALF_SQUAT));
    expect(y(G.LEGS_HALF_SQUAT)).toBeGreaterThan(y(G.LEGS_STAND));
    expect(y(G.LEGS_LAND)).toBeGreaterThanOrEqual(y(G.LEGS_SQUAT));
    expect(y(G.LEGS_PUSH_OFF)).toBeLessThan(y(G.LEGS_STAND));
    // D7: the upper body follows the hip, her part hurtboxes do not. In the fight (every role but
    // the death's GIVE and SIT) the drawn medallion, head and stamp stay within 2 px of their boxes.
    for (let i = 0; i < fs.length; i++) {
      if (i === G.LEGS_GIVE || i === G.LEGS_SIT) continue;
      expect(Math.abs(y(i) - y(G.LEGS_STAND)), `legs ${i}`).toBeLessThanOrEqual(2);
    }
  });

  it('no two neighbouring frames of a sequence are identical', () => {
    const A = G.ARM_FRAMES;
    const slam = [G.ARM_LOW, G.ARM_ANTICIPATION, G.ARM_COIL, G.ARM_RISE_A, G.ARM_RISE_B, G.ARM_OVERSHOOT, G.ARM_RAISED, G.ARM_TREMBLE, G.ARM_RAISED, G.ARM_SMEAR, G.ARM_SMEAR_LOW, G.ARM_IMPACT, G.ARM_SLAM, G.ARM_RECOIL, G.ARM_SETTLE, G.ARM_SLAM, G.ARM_LIFT, G.ARM_LOWER, G.ARM_LOW];
    for (const s of [0, 1, 2]) {
      differ(`${ART}/stamp-arm-${s}`, slam);
      differ(`${ART}/stamp-arm-${s}`, slam.map((f) => f + A));
    }
    const whirl = (p0: number, w0: number): number[] => [p0, ...Array.from({ length: 7 }, (_, i) => w0 + i), p0];
    differ(`${ART}/arm-back`, [G.BACK_REST, G.BACK_WIND_HIGH, ...whirl(G.BACK_HIGH, G.BACK_WHIRL_HIGH), G.BACK_RELEASE_HIGH, G.BACK_PULL_HIGH, G.BACK_CATCH, G.BACK_REST]);
    differ(`${ART}/arm-back`, [G.BACK_REST, G.BACK_WIND_LOW, ...whirl(G.BACK_LOW, G.BACK_WHIRL_LOW), G.BACK_RELEASE_LOW, G.BACK_PULL_LOW, G.BACK_CATCH]);
    differ(`${ART}/lash`, [G.LASH_OUT_A, G.LASH_OUT_B, G.LASH_OUT_A, G.LASH_SNAP_A, G.LASH_SNAP_B, G.LASH_BACK_A, G.LASH_BACK_B]);
    differ(`${ART}/legs`, [...Array.from({ length: 12 }, (_, i) => G.MAYOR_WALK + i), G.MAYOR_WALK]);
    differ(`${ART}/legs`, [G.LEGS_STAND, G.LEGS_HALF_SQUAT, G.LEGS_SQUAT, G.LEGS_PUSH_OFF, G.LEGS_AIR, G.LEGS_REACH, G.LEGS_LAND, G.LEGS_SQUAT, G.LEGS_HALF_SQUAT, G.LEGS_STAND]);
    differ(`${ART}/legs`, [G.LEGS_STAND, G.LEGS_REEL, G.LEGS_BRACE, G.LEGS_REEL, G.LEGS_STAND, G.LEGS_GIVE, G.LEGS_SIT]);
    differ(`${ART}/stamp-arm-gone`, [0, 1, 0]);
    differ(`${ART}/wig`, [0, 1, 2, 3, 4, 5, 6, 7, 0]);
  });

  it('the pre-mirrored stamp frames are the right-facing frames turned round (the label alone is re-lettered)', () => {
    for (const k of [G.ARM_LOW, G.ARM_RAISED, G.ARM_IMPACT]) {
      const r = getFrames(`${ART}/stamp-arm-0`, 1)[k];
      const l = getFrames(`${ART}/stamp-arm-0`, 1)[k + G.ARM_FRAMES];
      expect([l.buf.w, l.buf.h, l.oy]).toEqual([r.buf.w, r.buf.h, r.oy]);
      expect(l.ox).toBe(r.buf.w - r.ox);
    }
  });
});

describe('MECHA HASLEMA: the attack sequences in the fight (inside the same windows)', () => {
  it('the stamp slam: wind-up, trembling hold, the 2-frame smear right before the slam, impact, recoil, settle, lift', () => {
    const { tw, boss } = arena();
    tw.until(() => boss.state === 'fight', 400);
    tw.until(() => boss.armPose === 1 && boss.glowT > 0, 400);
    const id = `${ART}/stamp-arm-0`;
    const off = boss.facing < 0 ? G.ARM_FRAMES : 0;
    const raised: number[] = [shown(boss, id) - off];
    while (boss.armPose === 1) {
      tw.run(1);
      if (boss.armPose === 1) raised.push(shown(boss, id) - off);
    }
    // The telegraph is unchanged and every tick of it shows a wind-up frame.
    expect(raised.length).toBe(MAYOR.stamp.tele);
    // The raise in five in-betweens (no pop from the coil to the top).
    expect(inOrder(runs(raised), [G.ARM_ANTICIPATION, G.ARM_COIL, G.ARM_RISE_LOW, G.ARM_RISE_A, G.ARM_RISE_MID, G.ARM_RISE_B, G.ARM_RISE_HIGH, G.ARM_OVERSHOOT, G.ARM_RAISED, G.ARM_TREMBLE, G.ARM_SMEAR, G.ARM_SMEAR_LOW])).toBe(true);
    expect(raised.slice(-4)).toEqual([G.ARM_SMEAR, G.ARM_SMEAR, G.ARM_SMEAR_LOW, G.ARM_SMEAR_LOW]);
    // The slam: the impact on its first tick, the slam box the whole time.
    const slam: number[] = [shown(boss, id) - off];
    expect(slam[0]).toBe(G.ARM_IMPACT);
    while (boss.armPose === 2) {
      tw.run(1);
      slam.push(shown(boss, id) - off);
    }
    expect(inOrder(runs(slam), [G.ARM_IMPACT, G.ARM_SLAM, G.ARM_RECOIL, G.ARM_SETTLE, G.ARM_SLAM, G.ARM_LIFT])).toBe(true);
    tw.run(10);
    expect(shown(boss, id) - off).toBe(G.ARM_LOW);
    expect(tw.world.errors).toEqual([]);
  });

  it('the chain whip: wind-up, all 8 whirl steps, the release while the lash flies, the snap, the pull, the catch', () => {
    const { tw, boss } = arena({ phase: 2 });
    tw.until(() => boss.state === 'fight' && boss.phase === 1, 600);
    tw.until(() => boss.backArm > 0, 600);
    const back = `${ART}/arm-back`;
    const arms: number[] = [];
    const lash: number[] = [];
    let ticks = 0;
    while (boss.backArm > 0) {
      arms.push(shown(boss, back));
      if (boss.lashLen > 0) lash.push(shown(boss, `${ART}/lash`));
      tw.run(1);
      ticks++;
    }
    const high = arms[0] === G.BACK_WIND_HIGH;
    expect(arms[0]).toBe(high ? G.BACK_WIND_HIGH : G.BACK_WIND_LOW);
    const w0 = high ? G.BACK_WHIRL_HIGH : G.BACK_WHIRL_LOW;
    const steps = new Set(arms.filter((f) => f === (high ? G.BACK_HIGH : G.BACK_LOW) || (f >= w0 && f < w0 + 7)));
    expect(steps.size).toBe(8);
    expect(inOrder(runs(arms), [high ? G.BACK_RELEASE_HIGH : G.BACK_RELEASE_LOW, high ? G.BACK_PULL_HIGH : G.BACK_PULL_LOW])).toBe(true);
    // The whip's windows are unchanged: telegraph + out + hold + back.
    expect(ticks).toBe(MAYOR.whip.tele + MAYOR.whip.out + MAYOR.whip.hold + MAYOR.whip.back);
    expect(inOrder(runs(lash), [G.LASH_OUT_A, G.LASH_SNAP_A, G.LASH_SNAP_B])).toBe(true);
    expect(lash.some((f) => f === G.LASH_BACK_A || f === G.LASH_BACK_B)).toBe(true);
    tw.run(1);
    expect(shown(boss, back)).toBe(G.BACK_CATCH);
    tw.run(10);
    expect(shown(boss, back)).toBe(G.BACK_REST);
    expect(tw.world.errors).toEqual([]);
  });

  it('the shield fan and the stomp: the core charges, pulses and flashes; the hop squats, pushes off, tucks, reaches and lands', () => {
    const { tw, boss } = arena({ phase: 3 });
    tw.until(() => boss.state === 'fight' && boss.phase === 2, 600);
    tw.until(() => boss.medFrame === G.MED_GLOW, 600);
    const med = `${ART}/medallion-0`;
    const meds: number[] = [];
    while (boss.medFrame === G.MED_GLOW) {
      meds.push(shown(boss, med));
      tw.run(1);
    }
    expect(inOrder(runs(meds), [G.MED_CHARGE, G.MED_GLOW, G.MED_CHARGE, G.MED_GLOW, G.MED_FLASH, G.MED_GLOW])).toBe(true);
    tw.until(() => boss.legsFrame === G.LEGS_SQUAT, 400);
    const legs: number[] = [];
    for (let i = 0; i < 90; i++) {
      legs.push(shown(boss, `${ART}/legs`));
      tw.run(1);
    }
    expect(inOrder(runs(legs), [G.LEGS_HALF_SQUAT, G.LEGS_SQUAT, G.LEGS_PUSH_OFF, G.LEGS_AIR, G.LEGS_REACH, G.LEGS_LAND, G.LEGS_SQUAT, G.LEGS_HALF_SQUAT, G.LEGS_STAND])).toBe(true);
    expect(tw.world.errors).toEqual([]);
  });

  it('the death wig flies from her head and lands on the floor (the frame origin is the floor point, not the anchor)', () => {
    for (const facing of [-1, 1]) {
      const { tw, boss } = arena({ facing });
      tw.until(() => boss.state === 'fight', 900);
      tw.run(30);
      boss.kill(0);
      const wig = `${ART}/wig`;
      let first: { x: number; y: number } | null = null;
      let last: { f: number; x: number; y: number } | null = null;
      for (let i = 0; i < 220 && !boss.removed; i++) {
        tw.run(1);
        const out: Array<[string, number, number, number]> = [];
        const r = { sprite: (id: string, f: number, x: number, y: number) => out.push([id, f, x, y]), line: () => undefined } as unknown as Renderer;
        boss.draw(r);
        const c = out.find(([id]) => id === wig);
        if (!c) continue;
        if (!first) first = { x: c[2], y: c[3] };
        last = { f: c[1], x: c[2], y: c[3] };
      }
      expect(first, 'the wig flies').not.toBeNull();
      // The flight starts at her feet origin (the frames keep the boss's floor origin): the wig's
      // pixels sit over her head, inside the view.
      const f0 = getFrames(wig, 1)[0];
      expect(Math.abs((first?.x ?? 0) - boss.x)).toBeLessThanOrEqual(4);
      expect((first?.y ?? 0) - f0.oy).toBeGreaterThanOrEqual(0);
      // Landed: frame 0, its lowest row on the floor (within 2 px).
      expect(last?.f).toBe(0);
      const bottom = (last?.y ?? 0) - f0.oy + f0.buf.h;
      expect(Math.abs(bottom - FLOOR)).toBeLessThanOrEqual(2);
      expect(tw.world.errors).toEqual([]);
    }
  });

  it('the intro walks the 12-frame cycle; the shout breathes in; the hatch opens ajar first', () => {
    const { tw, boss } = arena();
    const legs: number[] = [];
    const heads: number[] = [];
    while (boss.state !== 'fight') {
      legs.push(shown(boss, `${ART}/legs`));
      heads.push(shown(boss, `${ART}/head-0`));
      tw.run(1);
    }
    for (let i = 0; i < 12; i++) expect(legs).toContain(G.MAYOR_WALK + i);
    expect(inOrder(runs(heads), [G.HEAD_SHOUT_IN, G.HEAD_SHOUT, G.HEAD_SMILE])).toBe(true);
    tw.until(() => boss.headFrame === G.HEAD_HATCH, 900);
    tw.run(1);
    expect(shown(boss, `${ART}/head-0`)).toBe(G.HEAD_HATCH_AJAR);
    tw.run(8);
    expect(shown(boss, `${ART}/head-0`)).toBe(G.HEAD_HATCH);
  });
});
