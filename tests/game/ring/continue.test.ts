/**
 * The ring's in-world continue (GDD §4.6; docs/design/ring.md §9, §15): with every hero out the
 * plan and the road speed hold and the enemies on screen gloat; START brings a fresh wagon in from
 * the left; its arrival makes them cower and the world runs on. The countdown running out is
 * GAME OVER. With two players one hero out holds nothing.
 */
import { describe, expect, it } from 'vitest';
import type { Damage } from '../../../src/engine/entity';
import { RING } from '../../../src/game/ring/types';
import { laneY } from '../../../src/game/ring/lanes';
import { TUNING } from '../../../src/game/tuning';
import { RingRig, tinyPlan, type TestFoe } from './ring-helpers';

const RAM: Damage = { amount: 10, kind: 'impact', dirX: -1, tags: ['ram'] };

function wreck(rig: RingRig, slot = 0): void {
  const w = rig.runner.player(slot)!.wagon!;
  while (w.cells > 0) {
    w.invulnTicks = 0;
    rig.world.damage(w, RAM);
  }
}

describe('ring continue', () => {
  it('holds the plan and the scroll, gloats, and a START brings a fresh wagon that makes them cower', () => {
    // A plan entry far ahead: it must not spawn while the world holds.
    const plan = tinyPlan({ length: 20000, spawns: [{ at: 3000, id: 'test-ring-target', lane: 1 }] });
    const rig = new RingRig({ plan, lives: 1 });
    const events: string[] = [];
    rig.runner.events.on('playerOut', () => events.push('out'));
    rig.runner.events.on('allOut', () => events.push('allOut'));
    rig.run(2);
    const foe = rig.spawnAt<TestFoe>('test-ring-foe', 300, laneY(1));
    wreck(rig);
    rig.run(RING.respawnTicks + 1);
    const hero = rig.hero;
    expect(hero.state).toBe('out');
    expect(events).toEqual(['out', 'allOut']);
    expect(rig.runner.countdownHeld).toBe(true);
    expect(rig.runner.countdownNumber).toBe(TUNING.continues.seconds - 1);
    // The road speed eases to 0 and the plan cursor stands.
    rig.run(60);
    expect(rig.runner.roadSpeed).toBe(0);
    const d = rig.runner.planDist;
    rig.run(60);
    expect(rig.runner.planDist).toBe(d);
    expect(rig.world.entities.filter((e) => e.type === 'test-ring-target').length).toBe(0);
    // The enemies on screen gloat (never a laugh or a point).
    expect(foe.reactions).toContain('gloat');
    expect(foe.reactions).not.toContain('cower');
    // START: a credit, a fresh wagon drives in from the left.
    rig.tap(['start']);
    expect(hero.state).toBe('spawn');
    expect(hero.wagon).not.toBeNull();
    expect(hero.slot.continues).toBe(1);
    expect(rig.runner.countdownHeld).toBe(true);
    rig.until(() => hero.state === 'mounted', RING.driveInTicks + 5);
    rig.run(1);
    expect(foe.reactions).toContain('cower');
    expect(rig.runner.countdownHeld).toBe(false);
    // The scroll and the plan come back.
    rig.run(120);
    expect(rig.runner.roadSpeed).toBeGreaterThan(2);
    expect(rig.runner.planDist).toBeGreaterThan(d);
  });

  it('is GAME OVER when the countdown runs out', () => {
    const rig = new RingRig({ lives: 1 });
    let over = 0;
    rig.runner.events.on('gameOver', () => over++);
    rig.run(2);
    wreck(rig);
    rig.run(RING.respawnTicks + 1);
    expect(rig.hero.state).toBe('out');
    rig.run(TUNING.continues.seconds * TUNING.continues.ticksPerCount + 2);
    expect(over).toBe(1);
    expect(rig.runner.state).toBe('gameover');
    // A continue after GAME OVER is not possible from the runner (the scene shows GAME OVER).
    expect(rig.runner.continueTicks).toEqual([-1, -1]);
  });

  it('with two players one hero out holds nothing; his countdown runs in his corner', () => {
    const rig = new RingRig({ players: 2, lives: 1 });
    rig.run(2);
    expect(rig.runner.players.length).toBe(2);
    // Two different drivers, neither of them a playing hero.
    const [d0, d1] = rig.runner.drivers;
    expect(d0).not.toBeNull();
    expect(d1).not.toBeNull();
    expect(d0).not.toBe(d1);
    expect(['vincent', 'grace']).not.toContain(d0);
    expect(['vincent', 'grace']).not.toContain(d1);
    wreck(rig, 0);
    rig.run(RING.respawnTicks + 1);
    expect(rig.runner.player(0)!.state).toBe('out');
    expect(rig.runner.countdownHeld).toBe(false);
    expect(rig.runner.continueTicks[0]).toBeGreaterThan(0);
    expect(rig.runner.continueTicks[1]).toBe(-1);
    const d = rig.runner.planDist;
    rig.run(30);
    expect(rig.runner.planDist).toBeGreaterThan(d);
  });
});
