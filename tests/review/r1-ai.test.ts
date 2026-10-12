/**
 * Review round 1: rifleman AI and fairness. Regression tests: each asserts the correct behaviour (they were `it.fails` until the fix).
 */
import { describe, expect, it } from 'vitest';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/infantry/index';
import '../../src/game/content/infantry/art';
import type { Rifleman } from '../../src/game/content/infantry/index';
import { FLOOR, TestWorld } from '../content/helpers';

describe('review r1: rifleman', () => {
  // R1-07: Rifleman.walk() treats the floor 10 px ahead as a pit unless it lies within
  // [y - 6, y + 40]. A 1:1 slope (walkable for every body) rises 10 px there, so soldiers stop at
  // the foot of every slope steeper than ~0.6 (m0 section a: 420–468) and wait there forever.
  it('R1-07: a rifleman walks up a walkable 1:1 slope toward his goal', () => {
    const tw = new TestWorld({
      noFloor: true,
      playerX: 100,
      god: true,
      build: (t) => t.ground().at(0, FLOOR).flat(300).slope(48, -48).flat(1252),
    });
    const p = tw.player!;
    p.placeAt(420, FLOOR - 48, 0);
    tw.world.camera.snap();
    const r = tw.spawn('rifleman', 285, { gag: false, facing: 1, grenades: false, range: 30 }) as Rifleman;
    tw.run(600);
    expect(r.x).toBeGreaterThan(310); // today he stops at x ≈ 296, 4 px before the slope
  });

  // R1-08: the standing shot flies 23 px above the shooter's feet (3 px tall) and the crouched
  // hitbox is 20 px: a 1.5 px margin. A crouched player whose feet are 2 px higher than the
  // soldier's (slopes, 2 px steps, sloped platforms) is killed by a shot the rule says to duck.
  it('R1-08: crouching dodges the chest shot when the player stands 2 px higher', () => {
    let standingShots = 0;
    let deaths = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const tw = new TestWorld({
        noFloor: true,
        playerX: 100,
        seed,
        build: (t) => t.ground().at(0, FLOOR - 2).flat(150).step(2).flat(1450),
      });
      const p = tw.player!;
      p.placeAt(100, FLOOR - 2, 0);
      tw.hold('down');
      tw.run(5);
      const r = tw.spawn('rifleman', 260, { gag: false, facing: -1, grenades: false }) as Rifleman;
      let kind = '';
      for (let t = 0; t < 400 && p.state !== 'dead'; t++) {
        tw.run(1);
        if (r.mode === 'aim') kind = (r as unknown as { shotKind: string }).shotKind;
        if (r.mode === 'recover' && kind === 'stand') break;
      }
      if (kind !== 'stand') continue;
      standingShots++;
      for (let t = 0; t < 120 && p.state !== 'dead'; t++) tw.run(1);
      if (p.state === 'dead') deaths++;
    }
    expect(standingShots).toBeGreaterThan(0);
    expect(deaths).toBe(0); // today: every standing shot kills the crouched player
  });
});
