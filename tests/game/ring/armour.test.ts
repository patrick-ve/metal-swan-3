/**
 * The wagon's armour (docs/design/ring.md §3, §15): ½ cell per bullet, 1 per thrown object /
 * bump, 2 per ram; invulnerable ticks between hits; god mode costs nothing; at 0 the wagon wrecks,
 * the hero loses a life, and a fresh wagon with the same driver drives in from the left.
 */
import { describe, expect, it } from 'vitest';
import type { Damage } from '../../../src/engine/entity';
import { RING } from '../../../src/game/ring/types';
import { RingRig } from './ring-helpers';

const BULLET: Damage = { amount: 10, kind: 'bullet', dirX: -1 };
const THROWN: Damage = { amount: 10, kind: 'impact', dirX: -1 };
const RAM: Damage = { amount: 10, kind: 'impact', dirX: -1, tags: ['ram'] };

describe('wagon armour', () => {
  it('has the ring cells and costs ½ / 1 / 2 cells with invulnerability between hits', () => {
    const rig = new RingRig();
    rig.run(2);
    const w = rig.wagon;
    expect(w.maxCells).toBe(RING.wagonCells);
    w.invulnTicks = 0;
    rig.world.damage(w, BULLET);
    expect(w.cells).toBe(RING.wagonCells - 0.5);
    // Invulnerable right after a hit: the next one is absorbed for free.
    rig.world.damage(w, THROWN);
    expect(w.cells).toBe(RING.wagonCells - 0.5);
    w.invulnTicks = 0;
    rig.world.damage(w, THROWN);
    expect(w.cells).toBe(RING.wagonCells - 1.5);
    w.invulnTicks = 0;
    rig.world.damage(w, RAM);
    expect(w.cells).toBe(RING.wagonCells - 3.5);
    w.repair(1);
    expect(w.cells).toBe(RING.wagonCells - 2.5);
  });

  it('costs nothing in god mode, and the hero himself is never hit', () => {
    const rig = new RingRig({ god: true });
    rig.run(2);
    const w = rig.wagon;
    w.invulnTicks = 0;
    rig.world.damage(w, RAM);
    expect(w.cells).toBe(RING.wagonCells);
    expect(rig.hero.hasTag('shootable')).toBe(false);
    expect(rig.world.damage(rig.hero, BULLET)).toBe(true);
    expect(rig.hero.state).toBe('mounted');
  });

  it('wrecks at 0 cells: a life is lost, then a fresh wagon with the same driver drives in', () => {
    const rig = new RingRig();
    rig.run(2);
    const hero = rig.hero;
    const w = rig.wagon;
    const driver = w.driverId;
    expect(driver).not.toBeNull();
    const lives = hero.slot.lives;
    let wrecked = 0;
    rig.world.events.on('vehicleDestroyed', () => wrecked++);
    while (w.cells > 0) {
      w.invulnTicks = 0;
      rig.world.damage(w, RAM);
    }
    expect(w.state).toBe('wreck');
    expect(wrecked).toBe(1);
    expect(hero.state).toBe('dead');
    expect(hero.slot.lives).toBe(lives - 1);
    expect(hero.wagon).toBeNull();
    // The fresh wagon comes after RING.respawnTicks and drives in from the left edge.
    rig.run(RING.respawnTicks + 1);
    expect(hero.state).toBe('spawn');
    const fresh = hero.wagon;
    expect(fresh).not.toBeNull();
    expect(fresh).not.toBe(w);
    expect(fresh!.driverId).toBe(driver);
    expect(fresh!.cells).toBe(RING.wagonCells);
    expect(fresh!.screenX).toBeLessThan(0);
    expect(fresh!.invulnTicks).toBeGreaterThan(0);
    rig.until(() => hero.state === 'mounted', RING.driveInTicks + 5);
    expect(fresh!.screenX).toBeGreaterThanOrEqual(RING.screenMinX);
    expect(fresh!.invulnTicks).toBeGreaterThan(0);
    // The wreck spins out and is gone.
    rig.run(RING.wreckTicks);
    expect(w.removed).toBe(true);
    expect(rig.runner.report().wrecks).toBe(1);
  });

  it('a hit in the drive-in blink costs nothing', () => {
    const rig = new RingRig();
    rig.run(2);
    const w = rig.wagon;
    while (w.cells > 0) {
      w.invulnTicks = 0;
      rig.world.damage(w, RAM);
    }
    rig.run(RING.respawnTicks + 1);
    const fresh = rig.hero.wagon!;
    rig.world.damage(fresh, RAM);
    expect(fresh.cells).toBe(RING.wagonCells);
  });
});

describe('wagon steering', () => {
  it('changes lanes in about 14 ticks, settles in the lane, and keeps inside the screen band', () => {
    const rig = new RingRig();
    rig.run(2);
    const w = rig.wagon;
    const lane = w.laneTarget;
    rig.tap(['up']);
    expect(w.laneTarget).toBe(lane - 1);
    const t = rig.until(() => Math.abs(w.y - [124, 145, 167, 190][lane - 2]) < 0.01, 40);
    expect(t).toBeLessThanOrEqual(RING.laneChangeTicks + 2);
    rig.hold(['right']);
    rig.run(400);
    expect(w.screenX).toBe(RING.screenMaxX);
    rig.hold(['left']);
    rig.run(400);
    expect(w.screenX).toBe(RING.screenMinX);
    rig.release();
  });

  it('swerves one lane in a few ticks with a short invulnerability and a cooldown', () => {
    const rig = new RingRig();
    rig.run(2);
    const w = rig.wagon;
    const lane = w.laneTarget;
    w.invulnTicks = 0;
    rig.hold(['jump', 'down']);
    rig.run(1);
    rig.release();
    expect(w.laneTarget).toBe(lane + 1);
    expect(w.invulnTicks).toBeGreaterThan(0);
    rig.run(RING.swerveTicks);
    expect(Math.abs(w.y - [124, 145, 167, 190][lane])).toBeLessThan(0.01);
    // Cooldown: a second swerve right away does nothing.
    rig.tap(['jump']);
    expect(w.laneTarget).toBe(lane + 1);
    expect(w.swerveCool).toBeGreaterThan(0);
  });
});
