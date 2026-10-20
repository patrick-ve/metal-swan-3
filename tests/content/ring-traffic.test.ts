/**
 * Civilian traffic of the ring (`ring-car`, docs/design/ring.md §8; docs/api/ring.md "Entities"):
 * registration, a plain spawn that runs, cover both ways only in its own lane, dents without a death,
 * bumps that cost ½ – 1 cell and push, the lane speeds, the merge out of a closed lane and the
 * hostage van's open door slab.
 */
import { describe, expect, it } from 'vitest';
import { Projectile } from '../../src/game/projectile';
import { hasEntity } from '../../src/game/registry';
import '../../src/game/content/ring/hazards/index';
import '../../src/game/content/ring/items/index';
import { BUMP_HARD, LANE_REL, RingCar } from '../../src/game/content/ring/traffic/car';
import { CAR_GEO, CAR_MODELS, carColour, HOSTAGE_VAN } from '../../src/game/content/ring/traffic/geometry';
import '../../src/game/content/ring/traffic/index';
import { RING_CAR_MODELS } from '../../src/game/ring/ids';
import { laneY } from '../../src/game/ring/lanes';
import { RingRig } from '../game/ring/ring-helpers';
import { TestWorld } from './helpers';

/** A rig in play (the start banner over, the wagon driven). */
function rig(): RingRig {
  const r = new RingRig();
  r.run(2);
  return r;
}

describe('ring-car', () => {
  it('is registered with every model of the shared ids', () => {
    expect(hasEntity('ring-car')).toBe(true);
    expect([...CAR_MODELS].sort()).toEqual([...RING_CAR_MODELS].sort());
    for (const m of RING_CAR_MODELS) {
      const g = CAR_GEO[m];
      expect(g.len).toBeGreaterThan(50);
      expect(g.colours.length).toBeGreaterThan(0);
      // Any colour index maps into the model's paints.
      for (let i = 0; i < 12; i++) expect(g.colours).toContain(carColour(m, i));
    }
  });

  it('spawns with {} and runs 600 ticks without errors, in the ring and in a plain world', () => {
    const r = rig();
    const errors: unknown[] = [];
    r.world.events.on('error', (e) => errors.push(e));
    r.spawnAt('ring-car', 250, laneY(2));
    r.run(600);
    const tw = new TestWorld();
    tw.world.events.on('error', (e) => errors.push(e));
    tw.spawn('ring-car', 300);
    tw.run(600);
    expect(errors).toEqual([]);
  });

  it('drives slower in the near lanes and faster in the far lanes (you overtake the near ones)', () => {
    expect(LANE_REL[0]).toBeGreaterThan(0);
    expect(LANE_REL[3]).toBeLessThan(0);
    const r = rig();
    const far = r.spawnAt<RingCar>('ring-car', 200, laneY(1));
    const near = r.spawnAt<RingCar>('ring-car', 200, laneY(4), { rel: -0.75 });
    const cam0 = r.world.camera.x;
    const f0 = far.x;
    const n0 = near.x;
    r.run(60);
    const moved = r.world.camera.x - cam0;
    expect(far.x - f0).toBeGreaterThan(moved);
    expect(near.x - n0).toBeLessThan(moved);
  });

  it('is cover both ways, only in its own lane, and never dies (dents instead)', () => {
    const r = rig();
    const lane = r.wagon.laneTarget;
    const car = r.spawnAt<RingCar>('ring-car', r.wagon.screenX + 120, laneY(lane), { model: 'estate', rel: 0 });
    r.run(1);
    // Player shots stop at it.
    for (let i = 0; i < 16; i++) {
      Projectile.spawn(r.world, { team: 'player', x: car.x - 70, y: laneY(lane), vx: 6, vy: 0, damage: 10, owner: 0 });
      r.run(6);
    }
    expect(car.alive).toBe(true);
    expect(car.hits).toBeGreaterThanOrEqual(14);
    expect(car.dents).toBe(2);
    // An enemy shot from ahead stops at it before the wagon.
    const cells = r.wagon.cells;
    Projectile.spawn(r.world, { team: 'enemy', x: car.x + 70, y: laneY(lane), vx: -5, vy: 0, damage: 10 });
    r.run(60);
    expect(r.wagon.cells).toBe(cells);
    // A shot one lane over flies past it.
    const before = car.hits;
    Projectile.spawn(r.world, { team: 'player', x: car.x - 70, y: laneY(lane - 1), vx: 6, vy: 0, damage: 10, owner: 0 });
    r.run(30);
    expect(car.hits).toBe(before);
  });

  it('a wagon that drives into its rear is pushed back and pays ½ – 1 cell', () => {
    const r = rig();
    const lane = r.wagon.laneTarget;
    const w = r.wagon;
    // A slow car right ahead of the wagon; the wagon keeps driving forward.
    const car = r.spawnAt<RingCar>('ring-car', w.screenX + 80, laneY(lane), { model: 'hatch', rel: -1.6 });
    r.hold(['right']);
    r.until(() => w.cells < w.maxCells, 200);
    r.release();
    const cost = w.maxCells - w.cells;
    expect(cost).toBeGreaterThanOrEqual(0.5);
    expect(cost).toBeLessThanOrEqual(1);
    // Out of the car's slab, behind it.
    expect(w.x + 46).toBeLessThanOrEqual(car.x - car.geo.len / 2 + 2);
    expect(BUMP_HARD).toBeGreaterThan(1);
  });

  it('merges out of a lane that is closed ahead', () => {
    const r = rig();
    const car = r.spawnAt<RingCar>('ring-car', 330, laneY(4), { model: 'hatch', rel: 0 });
    r.spawnAt('ring-closure', 560, laneY(4));
    r.run(140);
    expect(Math.abs(car.y - laneY(3))).toBeLessThan(1);
  });

  it('the hostage van carries a tied hostage and leaves its door slab free of cover', () => {
    const r = rig();
    const van = r.spawnAt<RingCar>('ring-car', 300, laneY(2), { hostage: true, model: 'hatch' });
    expect(van.model).toBe('van');
    r.run(1);
    const hostage = r.world.byTag('ring-hostage')[0];
    expect(hostage).toBeDefined();
    expect(van.box.x).toBeCloseTo(van.x + HOSTAGE_VAN.door[1], 5);
    expect(hostage.hurtboxes()[0].x).toBeCloseTo(van.x + HOSTAGE_VAN.door[0], 5);
  });
});
