/**
 * Review round 1: hostages. Regression tests: each asserts the correct
 * behaviour (they were `it.fails` until the fix).
 */
import { describe, expect, it } from 'vitest';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/items/index';
import '../../src/game/content/items/art';
import type { Hostage } from '../../src/game/hostage';
import { FLOOR, TestWorld } from '../content/helpers';

describe('review r1: hostages', () => {
  // R1-15: a hostage freed by a shot (or blast / knife) goes to 'walk' = Hostage.wander(): it
  // paces ±32 px around its own spot at 0.5 px/tick until a player TOUCHES it. GDD 7.2 step 3:
  // it walks to the freeing player (0.8 px/tick, ≤ 180 ticks, stops at walls and gaps) and hands
  // over the gift. Today a hostage shot from afar never comes: no gift, no rescue tally, and it is
  // lost once the ratchet camera moves on (despawnMargin 200).
  it('R1-15a: a hostage freed by a shot from 150 px walks to the player and gives', () => {
    const tw = new TestWorld({ playerX: 100 });
    const h = tw.spawn('hostage', 250, { gives: 'bombs' }) as Hostage;
    tw.run(2);
    tw.hold('fire').run(2).hold().run(1);
    tw.until(() => h.state !== 'tied', 120);
    tw.run(400);
    expect(h.rescued).toBe(true); // today: still wandering at x 230–280
  });

  // wander() has no ledge / pit check: a freed hostage walks off platforms and into pits
  // (onOutOfWorld → removed: rescue and gift lost). GDD 7.2: "blocked by a wall or gap: stops".
  it('R1-15b: a freed hostage next to a pit never walks into it', () => {
    const tw = new TestWorld({
      playerX: 420, // across the pit
      noFloor: true,
      build: (t) => t.ground().at(0, FLOOR).flat(280).gap(60).flat(1260),
    });
    const h = tw.spawn('hostage', 266, { gives: 'bombs' }) as Hostage;
    tw.run(2);
    h.free(0); // freed by player 1's shot
    // It walks toward the player across the pit, stops at the rim, gives and runs off-screen
    // to the left (GDD §7.2) — at no time below the floor.
    let lowest = -Infinity;
    let gave = false;
    for (let t = 0; t < 600 && !h.removed; t++) {
      tw.run(1);
      if (!h.removed) lowest = Math.max(lowest, h.y);
      if (h.state === 'give') gave = true;
    }
    expect(gave).toBe(true);
    expect(lowest).toBeLessThanOrEqual(FLOOR + 0.01); // was: walked into the pit and was removed
    expect(tw.world.entities.some((e) => e.type === 'pickup-bombs')).toBe(true);
  });
});
