/**
 * Review round 1: player vehicles (base class). Regression tests: each asserts the correct
 * behaviour (they were `it.fails` until the fix).
 */
import { describe, expect, it } from 'vitest';
import type { World } from '../../src/engine/world';
import { defineEntity, type SpawnParams } from '../../src/game/registry';
import { Vehicle } from '../../src/game/vehicle';
import { FLOOR, Rig } from '../game/helpers';

class ReviewBuggy extends Vehicle {
  constructor(world: World, x: number, y: number, p: SpawnParams = {}) {
    super(world, x, y, p, { art: 'vehicle/review-buggy', w: 36, h: 26, seat: { x: -10, y: -34, w: 20, h: 14 }, seatPoint: [0, -20] });
  }
}
defineEntity('review-r1-buggy', (w, x, y, p) => new ReviewBuggy(w, x, y, p), { category: 'vehicle' });

/** A rig with player 0 driving a test vehicle at x. */
function driving(x: number): { rig: Rig; car: ReviewBuggy } {
  const rig = new Rig({ x });
  const car = rig.world.spawn('review-r1-buggy', x + 40, FLOOR) as ReviewBuggy;
  rig.world.flush();
  rig.p.placeAt(x + 40, 120, 0);
  rig.p.y = 120;
  rig.p.body.onGround = false;
  rig.until(() => rig.p.state === 'mounted', 60);
  rig.run(30);
  return { rig, car };
}

describe('review r1: vehicles', () => {
  // R1-12: a driven vehicle is not kept inside the view (only Player.updatePlay clamps to the
  // view) and keeps despawnMargin 320. Driving back against the ratchet (or out of a locked
  // arena) takes it > 320 px off-screen, the world removes it WHILE DRIVEN, and nothing ejects
  // the driver: the player stays in state 'mounted' — invisible, invulnerable, no control, eject
  // impossible — until the section timer kills him (forever in a section without a timer).
  it('R1-12a: driving left out of the view never strands the driver (scroll right)', () => {
    const { rig, car } = driving(1200);
    rig.hold(['left']).run(600); // today the vehicle is removed after ~313 ticks
    rig.hold(['down', 'jump']).run(2).release().run(60); // eject
    expect(car.removed && rig.p.state === 'mounted').toBe(false);
    expect(rig.p.state).toBe('play');
  });

  it('R1-12b: driving out of a locked arena never strands the driver', () => {
    const { rig } = driving(1200);
    const cam = rig.world.camera;
    cam.lock(cam.x, cam.x + cam.w);
    rig.hold(['right']).run(600);
    rig.hold(['down', 'jump']).run(2).release().run(60);
    expect(rig.p.state).toBe('play');
    expect(rig.p.x).toBeLessThanOrEqual(cam.x + cam.w);
  });
});
