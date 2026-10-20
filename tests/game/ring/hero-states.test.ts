/**
 * Spec §16 risk: `RingHero` depends on Player internals. Every PlayerState the hero can reach (and
 * the ones it should never be in) is safe: it updates and draws without errors and ends in a ring
 * state (mounted, spawn, dead, out); the Player APIs other code calls on a player keep working.
 */
import { describe, expect, it } from 'vitest';
import { SoftRenderer } from '../../../src/engine/render-soft';
import type { PlayerState } from '../../../src/game/player/player';
import { RING } from '../../../src/game/ring/types';
import { RingRig } from './ring-helpers';

const RING_STATES: readonly PlayerState[] = ['mounted', 'spawn', 'dead', 'out'];
const ALL: readonly PlayerState[] = ['play', 'spawn', 'dead', 'out', 'mounted', 'victory'];

function drawFrames(rig: RingRig, n: number): void {
  const r = new SoftRenderer();
  for (let i = 0; i < n; i++) {
    rig.run(1);
    r.begin(rig.runner.sky);
    rig.runner.draw(r);
    r.end();
  }
}

describe('RingHero states', () => {
  it.each(ALL)('forced into %s: no errors, back in a ring state', (state) => {
    const rig = new RingRig({ seed: 5 });
    rig.run(3);
    const hero = rig.hero;
    hero.state = state;
    hero.dead = state === 'dead';
    // Some input through it all (fire, steer, jump, bomb).
    rig.hold(['fire', 'up', 'right']);
    drawFrames(rig, 30);
    rig.hold(['jump', 'down', 'bomb']);
    drawFrames(rig, 30);
    rig.release();
    drawFrames(rig, RING.respawnTicks + RING.driveInTicks + 10);
    expect(rig.world.errors.map((e) => `${e.where}: ${e.message}`)).toEqual([]);
    expect(RING_STATES).toContain(hero.state);
    if (state !== 'out') expect(hero.state).toBe('mounted');
  });

  it('keeps the Player APIs working: weapons, bombs, lives, victory, kill, placeAt, leaveVehicle', () => {
    const rig = new RingRig({ seed: 6 });
    rig.run(3);
    const hero = rig.hero;
    hero.giveWeapon('machine-gun', undefined, false);
    expect(hero.slot.weapon).toBe('machine-gun');
    hero.addBombs(3);
    expect(hero.addLife(1)).toBe(1);
    // A pickup weapon fires on the plane and runs dry back to the start weapon.
    hero.slot.ammo = 2;
    rig.hold(['fire']);
    rig.run(30);
    rig.release();
    rig.run(2);
    expect(hero.slot.weapon).toBe(hero.startWeapon);
    // placeAt only moves the anchor; introDrop does nothing; the hero is never shootable.
    hero.placeAt(hero.x, hero.y);
    hero.introDrop();
    expect(hero.state).toBe('mounted');
    expect(hero.hasTag('shootable')).toBe(false);
    // A forced exit or a kill wrecks the wagon (a life lost), never puts the hero on foot.
    const lives = hero.slot.lives;
    hero.leaveVehicle({ x: hero.x, y: hero.y });
    expect(hero.state).toBe('dead');
    expect(hero.slot.lives).toBe(lives - 1);
    rig.until(() => hero.state === 'mounted', RING.respawnTicks + RING.driveInTicks + 10);
    expect(hero.kill('bullet')).toBe(true);
    expect(hero.state).toBe('dead');
    expect(hero.slot.lives).toBe(lives - 2);
    rig.until(() => hero.state === 'mounted', RING.respawnTicks + RING.driveInTicks + 10);
    // The victory is a cheer from the window.
    hero.victory();
    expect(hero.state).toBe('mounted');
    expect(hero.cheering).toBe(true);
    expect(rig.world.errors).toEqual([]);
  });

  it('a status that takes control away (or swaps the weapon) is safe in the wagon', () => {
    const rig = new RingRig({ seed: 7 });
    rig.run(3);
    const hero = rig.hero;
    hero.status.add({ id: 'test-dizzy', ticks: 40, noControl: true, weapon: 'machine-gun' });
    rig.hold(['fire', 'down']);
    drawFrames(rig, 50);
    rig.release();
    expect(rig.world.errors).toEqual([]);
    expect(hero.state).toBe('mounted');
  });
});
