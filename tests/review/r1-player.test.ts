/**
 * Review round 1 (simulation correctness and feel): player, physics and camera bugs.
 * Regression tests: each asserts the correct behaviour (they were `it.fails` until the fix).
 */
import { describe, expect, it } from 'vitest';
import { FLOOR, Rig } from '../game/helpers';

/** Does the player's collision body overlap a solid rect? */
function insideSolid(rig: Rig): boolean {
  const p = rig.p;
  const half = p.body.w / 2 - 0.01;
  return rig.world.terrain.solidOverlaps(p.x - half, p.y - p.body.h + 0.01, p.x + half, p.y - 0.01);
}

describe('review r1: player and physics', () => {
  // R1-01: doJump() force-stands a crouched player (setCrouch(false, true)) even under a low
  // ceiling; the rising sub-step only finds ceilings whose bottom is crossed, so the head rises
  // through the block and the player lands standing inside it, unable to walk.
  it('R1-01a: a crouched jump in a crouch tunnel never puts the body inside the ceiling', () => {
    // Ceiling block FLOOR-60 .. FLOOR-24: a 24 px tunnel (crouch body 20 fits, standing 30 does not).
    const rig = new Rig({ build: (t) => t.solid(80, FLOOR - 60, 160, 36) });
    rig.p.placeAt(150, FLOOR, 0);
    rig.p.setCrouch(true, true);
    rig.hold(['down']).run(5);
    rig.hold(['down', 'jump']).run(1);
    let inside = 0;
    for (let i = 0; i < 70; i++) {
      rig.hold(['jump']).run(1);
      if (insideSolid(rig)) inside++;
    }
    expect(inside).toBe(0);
    // And the player can still leave the tunnel by just walking.
    const x0 = rig.p.x;
    rig.hold(['right']).run(60);
    expect(rig.p.x - x0).toBeGreaterThan(20);
  });

  it('R1-01b: a crouched jump cannot pass up through a thin roof', () => {
    // An 8 px roof over a 24 px tunnel: today the player pops out on top of it.
    const rig = new Rig({ build: (t) => t.solid(80, FLOOR - 32, 160, 8) });
    rig.p.placeAt(150, FLOOR, 0);
    rig.p.setCrouch(true, true);
    rig.hold(['down']).run(5);
    rig.hold(['down', 'jump']).run(1);
    rig.release().run(80);
    expect(rig.p.y).toBeCloseTo(FLOOR, 5); // still in the tunnel, not on the roof (y 138)
  });

  // R1-02: Player.safeSpot() takes terrain.surfaceY(x, cam.top + 8, …), which skips a solid whose
  // top is above that line and returns the ground under it; the drop-in falls with collisions
  // off and lands inside the wall. The player can then neither walk nor jump out (softlock;
  // a time-out respawns him at the same spot).
  it('R1-02a: respawn after a pit death never lands inside a tall wall next to the pit', () => {
    const rig = new Rig({
      noFloor: true,
      build: (t) => {
        t.ground().at(0, FLOOR).flat(200).gap(60).flat(2740);
        t.solid(262, 0, 60, FLOOR); // full-height wall right of the pit
        t.hazard('pit', 200, FLOOR + 10, 60, 80);
      },
    });
    rig.p.placeAt(150, FLOOR, 0);
    rig.world.camera.snap();
    rig.p.x = rig.p.prevX = 254; // falling into the pit near its right rim
    rig.p.y = rig.p.prevY = 150;
    rig.p.body.onGround = false;
    rig.until(() => rig.p.state === 'dead', 200);
    rig.until(() => rig.p.state === 'play', 400);
    expect(insideSolid(rig)).toBe(false);
    const x0 = rig.p.x;
    rig.hold(['left']).run(30);
    expect(rig.p.x).not.toBe(x0);
  });

  it('R1-02b: respawn near the left view edge never lands inside a wall', () => {
    // Death 18 px from the view edge: the respawn x is clamped 48 px inside, into the wall.
    const rig = new Rig({ build: (t) => t.solid(36, 0, 60, FLOOR) });
    rig.p.placeAt(18, FLOOR, 0);
    rig.world.camera.snap();
    rig.p.kill('bullet');
    rig.until(() => rig.p.state === 'play', 400);
    expect(insideSolid(rig)).toBe(false);
  });

  // R1-03: dropThrough() leaves `jumped` false and ticksSinceGrounded restarts at 0, so a jump
  // pressed within the 4 coyote ticks after a drop-through is a full mid-air jump.
  it('R1-03: no mid-air (coyote) jump right after dropping through a platform', () => {
    const rig = new Rig({ build: (t) => t.platform(60, FLOOR - 60, 200) });
    rig.p.placeAt(150, FLOOR - 60, 0);
    rig.run(3);
    rig.hold(['down', 'jump']).run(1);
    rig.release().run(2);
    expect(rig.p.body.onGround).toBe(false);
    rig.hold(['jump']).run(1);
    expect(rig.p.vy).toBeGreaterThanOrEqual(0); // today: -3.37, a new jump from mid-air
  });

  // R1-04: clampToView() pushes with displace(dx, 0), which refuses any spot where the feet would
  // be below the ground. On an up-slope the push never moves the player, so a moving lock (GDD
  // m5-a auto-scroll, a lock that eases in) leaves him outside the view.
  it('R1-04: the camera left edge pushes a player who stands on an up-slope', () => {
    const rig = new Rig({ noFloor: true, build: (t) => t.ground().at(0, FLOOR).flat(200).slope(200, -100).flat(2600) });
    rig.p.placeAt(260, FLOOR - 30, 0);
    rig.world.camera.snap();
    const cam = rig.world.camera;
    let lx = cam.x;
    for (let i = 0; i < 200; i++) {
      lx += 1; // auto-scroll at 1 px/tick
      cam.lock(lx, lx + cam.w);
      rig.run(1);
    }
    expect(rig.p.x - rig.p.body.w / 2).toBeGreaterThanOrEqual(cam.x - 1);
  });

  // R1-10: respawn() turns body.collide off for the drop-in and only finishSpawn() turns it back
  // on. victory() (boss killed while a player drops in) and kill() during the drop leave it off,
  // so the player / corpse falls through the floor and out of the world.
  it('R1-10: a mission completed during the respawn drop leaves the player on the floor', () => {
    const rig = new Rig();
    rig.p.kill('bullet');
    rig.until(() => rig.p.state === 'spawn', 200);
    rig.run(3);
    rig.p.victory();
    rig.run(120);
    expect(rig.p.y).toBeCloseTo(FLOOR, 5); // today: y ≈ 411 and still falling
  });

  // R1-05: the knife needs a fresh press (gun.pending); the tap-weapon hold-repeat then fires
  // pistol shots point-blank into the soft enemy instead of stabbing (GDD 4.4: fire near a
  // knifeable enemy = knife).
  it('R1-05: holding fire next to a soft enemy keeps knifing', () => {
    const rig = new Rig();
    rig.run(2);
    const d = rig.dummy(rig.p.x + 22, { hp: 1000 });
    rig.hold(['fire']).run(60);
    expect(d.hits.length).toBeGreaterThan(1);
    expect(d.hits.every((h) => h.kind === 'knife')).toBe(true); // today: knife, then bullets
  });
});
