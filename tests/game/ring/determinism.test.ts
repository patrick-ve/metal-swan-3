/**
 * Determinism (docs/design/ring.md §13, §15): two runs of one seed with the same input hash
 * equal (every entity's state, the rng streams, the session); the plan is a pure function of its
 * seed; a P2 join never changes the plan.
 */
import { describe, expect, it } from 'vitest';
import { hashString } from '../../../src/engine/rng';
import { buttonMask, type Button } from '../../../src/engine/input';
import { planRing } from '../../../src/game/ring/plan';
import type { RingSpawn } from '../../../src/game/ring/types';
import { RingRig, tinyPlan } from './ring-helpers';

/** A plan with targets and foes in every lane, ahead and from behind. */
function busyPlan(seed: number) {
  const spawns: RingSpawn[] = [];
  for (let i = 0; i < 24; i++) {
    spawns.push({ at: 400 + i * 150, id: i % 3 === 0 ? 'test-ring-foe' : 'test-ring-target', lane: 1 + (i % 4), params: { hp: 30 } });
    if (i % 5 === 0) spawns.push({ at: 300 + i * 150, id: 'test-ring-foe', lane: 1 + ((i + 2) % 4), from: 'behind' });
  }
  return tinyPlan({ length: 5000, spawns, seed });
}

/** Scripted input: steer, aim, fire, swerve, in a fixed pattern. */
function inputAt(t: number): Button[] {
  const phase = Math.floor(t / 40) % 6;
  const b: Button[] = [];
  if (phase === 0) b.push('up');
  if (phase === 1) b.push('fire');
  if (phase === 2) b.push('fire', 'right', 'up');
  if (phase === 3) b.push('down', 'left');
  if (phase === 4 && t % 40 === 0) b.push('jump');
  if (phase === 5) b.push('fire', 'down');
  return b;
}

function runHash(seed: number, ticks: number): { hash: number; report: string } {
  const rig = new RingRig({ seed, plan: busyPlan(seed), players: 2 });
  for (let t = 0; t < ticks; t++) {
    rig.masks[0] = buttonMask(...inputAt(t));
    rig.masks[1] = buttonMask(...inputAt(t + 77));
    rig.run(1);
  }
  const w = rig.world;
  const parts: string[] = [String(w.tick), w.rng.getState().join(','), w.fxRng.getState().join(',')];
  for (const e of w.entities) parts.push(`${e.type}:${e.x.toFixed(3)},${e.y.toFixed(3)},${e.hp},${e.dead ? 1 : 0}`);
  for (const s of rig.session.slots) parts.push(`${s.score}/${s.lives}/${s.stats.shots}/${s.weapon}`);
  const r = rig.runner.report();
  const report = JSON.stringify({ ...r, errors: r.errors.length });
  parts.push(report);
  return { hash: hashString(parts.join('|')), report };
}

describe('ring determinism', () => {
  it('two runs of one seed with the same input hash equal', () => {
    const a = runHash(11, 1500);
    const b = runHash(11, 1500);
    expect(a.report).toBe(b.report);
    expect(a.hash).toBe(b.hash);
    expect(JSON.parse(a.report).errors).toBe(0);
  });

  it('the plan is a pure function of its seed and differs between seeds', () => {
    expect(planRing(5, 'normal')).toEqual(planRing(5, 'normal'));
    expect(JSON.stringify(planRing(5, 'normal'))).not.toBe(JSON.stringify(planRing(6, 'normal')));
  });

  it('a P2 join does not change the plan or what it spawns', () => {
    const solo = new RingRig({ seed: 4, plan: busyPlan(4) });
    const duo = new RingRig({ seed: 4, plan: busyPlan(4) });
    solo.run(100);
    duo.run(100);
    duo.runner.joinPlayer(1, 'grace');
    solo.run(400);
    duo.run(400);
    const types = (rig: RingRig): string[] => rig.world.entities.filter((e) => e.type.startsWith('test-ring')).map((e) => `${e.type}@${Math.round(e.x)}`);
    expect(types(duo)).toEqual(types(solo));
    expect(duo.runner.plan).toEqual(solo.runner.plan);
    expect(duo.runner.player(1)?.state).toBe('mounted');
  });
});
