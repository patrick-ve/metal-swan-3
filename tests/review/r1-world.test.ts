/**
 * Review round 1: collision passes. Regression tests: each asserts the correct behaviour (they were `it.fails` until the fix).
 */
import { describe, expect, it } from 'vitest';
import type { World } from '../../src/engine/world';
import { explosion } from '../../src/game/fx';
import { Player } from '../../src/game/player/player';
import { defineEntity, type SpawnParams } from '../../src/game/registry';
import { Vehicle } from '../../src/game/vehicle';
import { FLOOR, Rig } from '../game/helpers';

class ReviewTank extends Vehicle {
  constructor(world: World, x: number, y: number, p: SpawnParams = {}) {
    super(world, x, y, p, { art: 'vehicle/review-tank', w: 36, h: 26, seat: { x: -10, y: -34, w: 20, h: 14 }, seatPoint: [0, -20] });
  }
}
defineEntity('review-r1-tank', (w, x, y, p) => new ReviewTank(w, x, y, p), { category: 'vehicle' });

describe('review r1: collision passes', () => {
  // R1-06: fx.blast() (also World.damageArea and the contact pass) loops over the LIVE
  // 'shootable' tag array. Vehicle.destroy() → eject() calls removeTag('shootable') inside that
  // loop, the array shifts left and the next target is skipped. With cells = 3 (no destroy) the
  // same blast kills player 2.
  it('R1-06: a blast that destroys a vehicle still hits the next target', () => {
    const rig = new Rig({ x: 100 });
    const tank = rig.world.spawn('review-r1-tank', 200, FLOOR) as ReviewTank;
    rig.world.flush();
    rig.p.placeAt(200, 120, 0);
    rig.p.y = 120;
    rig.p.body.onGround = false;
    rig.until(() => rig.p.state === 'mounted', 60);
    // Player 2 joins later (like MissionRunner.joinPlayer), so it is indexed after the tank.
    const p2 = new Player(rig.world, 230, FLOOR, { pad: rig.pads[1], index: 1 });
    rig.world.add(p2);
    p2.placeAt(230, FLOOR, 0);
    rig.world.flush();
    rig.run(1);
    tank.invulnTicks = 0;
    tank.cells = 1;
    p2.invulnTicks = 0;
    explosion(rig.world, 215, FLOOR - 10, 'm', { damage: 50, team: 'enemy', radius: 40 });
    // The blast took the last cell (the vehicle drops 'shootable' inside the blast loop) …
    expect(tank.cells).toBe(0);
    expect(tank.hasTag('shootable')).toBe(false);
    expect(p2.state).toBe('dead'); // … and the next target was still hit (was: skipped)
  });
});
