/**
 * Review round 1 (part 2): player controls and feel. Regression tests: each asserts the correct behaviour (they were `it.fails` until the fix).
 */
import { describe, expect, it } from 'vitest';
import '../../src/game/content/characters/art';
import '../../src/game/content/weapons/art';
import { FLOOR, Rig } from '../game/helpers';

describe('review r1: player controls (2)', () => {
  // R1-17: the knife only replaces a press when meleeGun.ready. Knife action 14 ticks, knife
  // cooldown 20: a press buffered during the slash comes out as a PISTOL SHOT in the 6-tick gap.
  // Mashing fire next to a soft enemy alternates knife / bullet 50 % (any mash rate 4–12 ticks),
  // so knife kills (×5 score) need luck. GDD 4.4: near a knifeable enemy, fire = knife.
  it('R1-17: mashing fire next to a soft enemy only knifes', () => {
    const rig = new Rig();
    rig.run(2);
    const d = rig.dummy(rig.p.x + 22, { hp: 100000 });
    for (let i = 0; i < 120; i++) {
      if (i % 8 === 0) rig.hold(['fire']);
      else rig.release();
      rig.run(1);
    }
    const knives = d.hits.filter((h) => h.kind === 'knife').length;
    const bullets = d.hits.filter((h) => h.kind === 'bullet').length;
    expect(knives).toBeGreaterThan(3);
    expect(bullets).toBe(0); // today: 6 knives, 6 bullets
  });

  // R1-18: the crouch body (16 px) is 2 px wider than the standing body (14 px). setCrouch()
  // widens it in place, so a player who crouches while touching a solid (wall, the m0 stairs,
  // a solid crate) overlaps it by 1 px; every crouch-walk sub-step then fails fits() and is
  // undone. The player is frozen until he lets go of down.
  it('R1-18: crouch-walking away from a wall the player touches', () => {
    const rig = new Rig({ build: (t) => t.solid(200, FLOOR - 60, 40, 60) });
    rig.hold(['right']).run(80); // blocked by the wall at x = 193
    rig.hold(['down']).run(5);
    const x0 = rig.p.x;
    rig.hold(['down', 'left']).run(40);
    expect(rig.p.x - x0).toBeLessThan(-20); // today: 0 px
  });

  // R1-19: dropThrough() ignores one-way surfaces only above dropY + 2 px. On a sloped platform
  // that goes down in the running direction the platform under the feet is lower than that after
  // a few px, so the player lands on the SAME platform again (4 ticks later at 1.5 px/tick on a
  // 0.3 slope). Down + jump does nothing while running downhill.
  it('R1-19: dropping through a downhill sloped platform while running', () => {
    const rig = new Rig({ build: (t) => t.platforms().at(100, 100).slope(200, 60) });
    rig.p.placeAt(130, 109, 0);
    rig.run(3);
    expect(rig.p.body.onOneWay).toBe(true);
    rig.hold(['down', 'right']).run(3);
    rig.hold(['down', 'right', 'jump']).run(1);
    rig.hold(['right']).run(40);
    expect(rig.p.y).toBeGreaterThan(FLOOR - 5); // today: back on the platform (y ≈ 127)
  });

  // R1-20: the throw hand is ~9 px in front of the feet centre (body half-width 7). Standing
  // against a wall taller than the release height, the grenade spawns INSIDE the wall; the sweep
  // reports a hit at t = 0 with normal (0,-1) twice → it explodes in the player's hand on the
  // first tick (harmless to him, but the bomb is wasted and its blast reaches through thin
  // walls). GDD 6.1: walls bounce it back (vx × −0.5).
  it('R1-20: a grenade thrown against a wall bounces instead of exploding at once', () => {
    const rig = new Rig({ build: (t) => t.solid(110, FLOOR - 80, 40, 80) });
    rig.hold(['right']).run(10).release().run(2);
    let explodedAt = -1;
    rig.world.events.on('explosion', () => {
      if (explodedAt < 0) explodedAt = rig.world.tick;
    });
    const t0 = rig.world.tick;
    rig.tap(['bomb']);
    rig.run(20);
    expect(explodedAt < 0 || explodedAt - t0 > 15).toBe(true); // today: explodes on tick 0
  });

  // R1-26: GDD 6.1 — grenade blast: circle r 24, 100 'explosion' damage to every enemy inside.
  // TUNING.grenade uses splash 20 with the default 0.5 falloff (10–20 damage, r 30), and the
  // direct hit is a 'bullet' hit (no die-blast animation). Riflemen (10 HP) still die, but the
  // GDD's tougher infantry (drummer / cymbalist 30, bassoonist 40, oompah 60, baton-major 100)
  // standing next to the target survive a grenade.
  it('R1-26: a grenade blast kills every 30-HP soldier within 24 px', () => {
    const rig = new Rig();
    rig.run(2);
    const ds = [rig.dummy(196, { hp: 30 }), rig.dummy(210, { hp: 30 }), rig.dummy(218, { hp: 30 })];
    rig.tap(['bomb']);
    rig.run(80);
    expect(ds[0].hits[0]?.kind).toBe('explosion'); // today: 'bullet'
    expect(ds.map((d) => d.alive)).toEqual([false, false, false]); // today: [false, true, true]
  });
});
