/**
 * The ring's lanes and depth slabs (docs/design/ring.md §2, §3, §15): the layout, the 8 aims, a
 * forward shot stays in its lane, a diagonal crosses lanes, a civilian (a SolidBox over its depth
 * slab) stops shots both ways and only in its own lane.
 */
import { describe, expect, it } from 'vitest';
import { overlaps } from '../../../src/engine/math';
import { Projectile } from '../../../src/game/projectile';
import { slabRect } from '../../../src/game/ring/entity';
import {
  aimOf,
  DEPTH_HALF,
  DIAG_ANGLE,
  GROUND_Y,
  LANE_Y,
  laneAt,
  laneSlab,
  laneY,
  nearestLane,
  planeAngle,
  ROAD_BOTTOM,
  ROAD_TOP,
} from '../../../src/game/ring/lanes';
import { RING } from '../../../src/game/ring/types';
import { RingRig, type TestCivilian, type TestTarget } from './ring-helpers';

describe('ring layout', () => {
  it('has four lanes with their feet lines inside the road band, far to near', () => {
    expect([1, 2, 3, 4].map(laneY)).toEqual([124, 145, 167, 190]);
    for (const y of LANE_Y) {
      expect(y).toBeGreaterThan(ROAD_TOP);
      expect(y).toBeLessThan(ROAD_BOTTOM);
    }
    expect(GROUND_Y).toBeGreaterThanOrEqual(ROAD_BOTTOM);
    expect([nearestLane(120), nearestLane(150), nearestLane(170), nearestLane(205)]).toEqual([1, 2, 3, 4]);
    expect(nearestLane(190, 1, 3)).toBe(3);
    expect([laneAt(110), laneAt(124), laneAt(145), laneAt(167), laneAt(190), laneAt(204)]).toEqual([0, 1, 2, 3, 4, 0]);
  });

  it('slabs of neighbouring lanes never touch', () => {
    const a = { x: 0, y: 0, w: 0, h: 0 };
    const b = { x: 0, y: 0, w: 0, h: 0 };
    for (let l = 1; l < 4; l++) {
      laneSlab(0, 100, laneY(l), a);
      laneSlab(0, 100, laneY(l + 1), b);
      expect(overlaps(a, b), `lanes ${l} and ${l + 1}`).toBe(false);
    }
    expect(DEPTH_HALF * 2).toBeLessThan(LANE_Y[1] - LANE_Y[0]);
  });

  it('maps the D-pad to the 8 plane aims (diagonals about 20°: one lane per about 60 px)', () => {
    expect(aimOf(1, 0)).toBe('forward');
    expect(aimOf(1, -1)).toBe('forward-far');
    expect(aimOf(0, -1)).toBe('far');
    expect(aimOf(1, 1)).toBe('forward-near');
    expect(aimOf(0, 1)).toBe('near');
    expect(aimOf(-1, 0)).toBe('back');
    expect(aimOf(-1, -1)).toBe('back-far');
    expect(aimOf(-1, 1)).toBe('back-near');
    expect(aimOf(0, 0)).toBeNull();
    expect(planeAngle('forward')).toBe(0);
    expect(planeAngle('far')).toBeCloseTo(-Math.PI / 2);
    expect(planeAngle('near')).toBeCloseTo(Math.PI / 2);
    expect(planeAngle('forward-far')).toBeCloseTo(-DIAG_ANGLE);
    const perLane = (LANE_Y[1] - LANE_Y[0]) / Math.tan(DIAG_ANGLE);
    expect(perLane).toBeGreaterThan(50);
    expect(perLane).toBeLessThan(70);
  });

  it('a ring entity hurts through its slab while its hitbox stays the visual box', () => {
    const rig = new RingRig();
    const t = rig.spawnAt<TestTarget>('test-ring-target', 250, laneY(2));
    const slab = t.hurtboxes()[0];
    expect(slab.h).toBe(DEPTH_HALF * 2);
    expect(slab.y + DEPTH_HALF).toBe(laneY(2));
    expect(t.hitRect().h).toBe(40);
    expect(slabRect(t, { x: 0, y: 0, w: 0, h: 0 })).toEqual(slab);
  });
});

describe('shots in the plane', () => {
  it('a forward shot stays in its lane (a car in the next lane overlaps on screen but is not hit)', () => {
    const rig = new RingRig();
    rig.run(2);
    expect(rig.hero.state).toBe('mounted');
    const lane = rig.wagon.laneTarget;
    expect(lane).toBe(RING.startLane[0]);
    const sx = rig.wagon.screenX;
    // The far-lane target's 40 px visual box covers the shot's line on screen.
    const far = rig.spawnAt<TestTarget>('test-ring-target', sx + 90, laneY(lane - 1));
    const same = rig.spawnAt<TestTarget>('test-ring-target', sx + 170, laneY(lane));
    expect(far.hitRect().y + far.hitRect().h).toBeGreaterThan(laneY(lane) - 30);
    rig.tap(['fire']);
    rig.run(40);
    expect(same.hits.length).toBeGreaterThan(0);
    expect(far.hits.length).toBe(0);
  });

  it('a diagonal (FIRE + forward + up) crosses into the far lane', () => {
    const rig = new RingRig();
    rig.run(2);
    const lane = rig.wagon.laneTarget;
    const sx = rig.wagon.screenX;
    // The shot leaves the window (hero x + 8) and climbs one lane in about 60 px.
    const dx = (laneY(lane) - laneY(lane - 1)) / Math.tan(DIAG_ANGLE);
    const hx = rig.hero.x - rig.world.camera.x + 8;
    const diag = rig.spawnAt<TestTarget>('test-ring-target', hx + dx, laneY(lane - 1), { w: 30 });
    const ahead = rig.spawnAt<TestTarget>('test-ring-target', sx + 200, laneY(lane));
    rig.hold(['fire', 'right', 'up']);
    rig.run(1);
    expect(rig.hero.aim8).toBe('forward-far');
    rig.release();
    rig.run(40);
    expect(diag.hits.length).toBeGreaterThan(0);
    expect(ahead.hits.length).toBe(0);
    // The steer lock: FIRE held kept the lane (up did not change it).
    expect(rig.wagon.laneTarget).toBe(lane);
  });

  it('a shot that leaves the road band is removed', () => {
    const rig = new RingRig();
    rig.run(2);
    rig.hold(['fire', 'up']);
    rig.run(1);
    rig.release();
    const shots = (): number => rig.world.byTag('shot').filter((s) => s.alive).length;
    expect(shots()).toBeGreaterThan(0);
    rig.run(30);
    expect(shots()).toBe(0);
  });

  it('a civilian stops shots in its own lane both ways, never in the next lane', () => {
    const rig = new RingRig();
    rig.run(2);
    const lane = rig.wagon.laneTarget;
    const sx = rig.wagon.screenX;
    const civ = rig.spawnAt<TestCivilian>('test-ring-civ', sx + 110, laneY(lane));
    const behind = rig.spawnAt<TestTarget>('test-ring-target', sx + 190, laneY(lane));
    const next = rig.spawnAt<TestTarget>('test-ring-target', sx + 160, laneY(lane - 1));
    // The player's shot stops at the civilian.
    rig.tap(['fire']);
    rig.run(40);
    expect(behind.hits.length).toBe(0);
    // An enemy shot from beyond the civilian toward the wagon stops at it too.
    const cells = rig.wagon.cells;
    Projectile.spawn(rig.world, { team: 'enemy', x: behind.x - 16, y: laneY(lane), vx: -4, vy: 0, damage: 10 });
    rig.run(60);
    expect(rig.wagon.cells).toBe(cells);
    // The civilian does not cover the next lane: a shot there flies past it.
    Projectile.spawn(rig.world, { team: 'player', x: civ.x - 40, y: laneY(lane - 1), vx: 6, vy: 0, damage: 1, owner: 0 });
    rig.run(30);
    expect(next.hits.length).toBeGreaterThan(0);
    // Civilians are never hurt (neutral team).
    expect(civ.alive).toBe(true);
  });

  it('an enemy shot in the wagon lane hits the wagon; one in another lane passes', () => {
    const rig = new RingRig();
    rig.run(2);
    const lane = rig.wagon.laneTarget;
    const w = rig.wagon;
    Projectile.spawn(rig.world, { team: 'enemy', x: w.x + 120, y: laneY(lane - 1), vx: -4, vy: 0, damage: 10 });
    rig.run(60);
    expect(w.cells).toBe(w.maxCells);
    Projectile.spawn(rig.world, { team: 'enemy', x: w.x + 120, y: laneY(lane), vx: -4, vy: 0, damage: 10 });
    rig.run(60);
    expect(w.cells).toBe(w.maxCells - 0.5);
  });
});
