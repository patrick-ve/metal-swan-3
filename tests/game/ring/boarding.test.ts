/**
 * The boarding scene and the exit (docs/design/ring.md §10): the hero waits on the hard shoulder,
 * the wagon comes down the on-ramp facing left, makes its handbrake turn, the driver shouts, the
 * hero jumps into the window and the wagon merges into lane 4; START skips it after the first
 * play; at the plan's end the wagons take the off-ramp and the mission completes.
 */
import { afterEach, describe, expect, it } from 'vitest';
import '../../../src/game/content/characters/art';
import { BOARDING, ringBoarding, setBoardingSeen } from '../../../src/game/ring/boarding';
import { driverLine } from '../../../src/game/content/ring/wagon/lines';
import { laneY } from '../../../src/game/ring/lanes';
import { RING } from '../../../src/game/ring/types';
import { RingRig, tinyPlan } from './ring-helpers';

afterEach(() => setBoardingSeen(false));

describe('the boarding scene', () => {
  it('runs in-engine: shoulder, the wagon facing left, the turn, STAP IN!, the jump, lane 4', () => {
    setBoardingSeen(false);
    const rig = new RingRig();
    rig.run(1);
    const hero = rig.hero;
    const w = rig.wagon;
    expect(ringBoarding(rig.world)).toBe(true);
    expect(hero.state).toBe('spawn');
    expect(hero.boarding).toBe(true);
    expect(hero.foot).not.toBeNull();
    expect(w.scripted).toBe(true);
    expect(rig.runner.roadSpeed).toBe(0);
    let left = false;
    let spun = false;
    let shout = false;
    rig.until(() => {
      if (w.view === 'left' && w.screenX < rig.world.camera.w) left = true;
      if (w.view === 'spin') spun = true;
      if (rig.runner.hud.bubbles.some((b) => b.target === w && b.text.includes('STAP IN!'))) shout = true;
      // The road holds while he boards.
      if (hero.boarding) expect(rig.runner.planDist).toBe(0);
      return hero.state === 'mounted';
    }, 400);
    expect(left && spun && shout).toBe(true);
    expect(w.screenX).toBeCloseTo(BOARDING.heroX[0] - (-13), 0);
    rig.until(() => !ringBoarding(rig.world), 200);
    expect(w.laneTarget).toBe(4);
    expect(w.y).toBe(laneY(4));
    rig.run(120);
    expect(rig.runner.roadSpeed).toBeGreaterThan(RING.cruiseSpeed * 0.9);
    expect(rig.world.errors).toEqual([]);
  });

  it('START skips it after the first play, never on the first', () => {
    setBoardingSeen(false);
    const first = new RingRig();
    first.run(5);
    first.tap(['start']);
    expect(first.hero.boarding).toBe(true);
    // From now on it was seen.
    const rig = new RingRig();
    rig.run(5);
    rig.tap(['start']);
    expect(rig.hero.boarding).toBe(false);
    expect(rig.hero.state).toBe('mounted');
    rig.run(40);
    expect(rig.wagon.y).toBe(laneY(4));
    expect(ringBoarding(rig.world)).toBe(false);
  });

  it('two players: both heroes board their own wagons', () => {
    setBoardingSeen(false);
    const rig = new RingRig({ players: 2 });
    rig.until(() => rig.runner.players.every((p) => p.state === 'mounted'), 500);
    const [a, b] = rig.runner.players.map((p) => p.wagon!);
    expect(a.livery).toBe('white');
    expect(b.livery).toBe('green');
    expect(rig.world.errors).toEqual([]);
  });
});

describe('the drivers talk', () => {
  it('a speed fine and a spawned boss make the driver speak (his own line)', () => {
    setBoardingSeen(true);
    const rig = new RingRig();
    rig.run(2);
    rig.tap(['start']);
    rig.run(10);
    const w = rig.wagon;
    const said = (): string => rig.runner.hud.bubbles.find((b) => b.target === w)?.text ?? '';
    // One of his own variants (lines.ts: `pick` 0 … 1 chooses among them).
    const own = (ev: 'flash' | 'boss'): string[] => [0, 0.25, 0.5, 0.75, 0.99].map((k) => driverLine(w.driverId, ev, k));
    rig.runner.fine(0);
    expect(own('flash')).toContain(said());
    rig.runner.events.emit('bossSlot', { id: 'x', at: 0, spawned: true });
    expect(own('boss')).toContain(said());
  });
});

describe('the exit', () => {
  it('at the plan end the wagons take the off-ramp, then MISSION COMPLETE', () => {
    setBoardingSeen(true);
    const rig = new RingRig({ plan: tinyPlan({ length: 500 }) });
    rig.run(2);
    rig.tap(['start']);
    const w = rig.wagon;
    let planEnd = -1;
    rig.runner.events.on('planEnd', () => (planEnd = rig.runner.ticks));
    rig.until(() => planEnd >= 0, 600);
    expect(rig.runner.state).toBe('playing');
    expect(w.autopilot).toBe(true);
    rig.until(() => rig.runner.state === 'victory', 400);
    expect(rig.runner.ticks - planEnd).toBeGreaterThan(30);
    expect(w.screenX).toBeGreaterThan(rig.world.camera.w);
  });
});
