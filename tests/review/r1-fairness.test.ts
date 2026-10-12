/**
 * Review round 1: enemy fairness rules (GDD 4.11). Regression tests: each asserts the correct behaviour (they were `it.fails` until the fix).
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import '../../src/game/content/characters/index';
import '../../src/game/content/characters/art';
import '../../src/game/content/weapons/index';
import '../../src/game/content/infantry/index';
import '../../src/game/content/infantry/art';
import type { Rifleman } from '../../src/game/content/infantry/index';
import { TestWorld } from '../content/helpers';

describe('review r1: fairness', () => {
  // R1-16: Rifleman checks muzzleOnScreen() only when it STARTS an attack (thinkMove /
  // thinkCrouch); thinkAim() fires 18 ticks later without a new check. A player running right
  // scrolls the view ~27 px during the telegraph, so soldiers behind him fire from outside the
  // view (seen: shot origin up to 20 px and the soldier up to 31 px beyond the left edge — fully
  // invisible). GDD 4.11 rule 3: attack only while the muzzle is inside the view (8 px margin).
  it('R1-16: no rifleman shot leaves from outside the view while the player runs past', () => {
    let shots = 0;
    let offscreen = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const tw = new TestWorld({ playerX: 150, god: true, seed, width: 4000 });
      const cam = tw.world.camera;
      tw.run(2);
      for (const dx of [120, 200, 260]) tw.spawn('rifleman', 150 + dx, { gag: false, facing: -1, grenades: false });
      tw.world.events.on('spawn', (e: Entity) => {
        if (e.type !== 'rifleman-shot') return;
        shots++;
        if (!cam.containsPoint(e.x, e.y, -8)) offscreen++;
      });
      tw.hold('right').run(900);
    }
    expect(shots).toBeGreaterThan(50);
    expect(offscreen).toBe(0); // today: 24 of 132
  });

  // R1-25: the rifleman's crouch hitbox is 14×18 (CROUCH_BOX, as GDD 9.0 says), but the crouched
  // sprite is 32 px tall (≈ 27 without the shako). The player's standing shot flies 21–25 px
  // above the feet, i.e. visibly THROUGH the crouched soldier's head, without hitting. Soldiers
  // are crouched ~30 % of their combat time (measured: 585 of ~2000 standing shots passed through
  // them), and a hiding ('popup') soldier cannot be hit by standing shots at all.
  it('R1-25: a standing shot never passes through a crouched rifleman', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    // Hiding behind (imaginary) cover 200 px away: outside his 190 px notice range.
    const r = tw.spawn('rifleman', 300, { entry: 'popup', facing: -1, hp: 1e9 }) as Rifleman & { hits: number };
    r.hits = 0;
    tw.world.events.on('hit', (e) => {
      if (e.target === r && r.crouching) r.hits++;
    });
    tw.run(2);
    let crossedWhileCrouched = 0;
    const lastX = new Map<Entity, number>();
    for (let t = 0; t < 6 * 12 + 40; t++) {
      if (t < 6 * 12 && t % 12 === 0) tw.hold('fire');
      else tw.hold();
      tw.run(1);
      for (const e of tw.world.entities) {
        if (e.type !== 'pistol' || e.removed) continue;
        const px = lastX.get(e);
        if (px !== undefined && px < r.x && e.x >= r.x && r.crouching) crossedWhileCrouched++;
        lastX.set(e, e.x);
      }
    }
    expect(crossedWhileCrouched).toBe(0); // was: 6 — every bullet flew through his head
    expect(r.hits).toBeGreaterThan(0);
  });
});
