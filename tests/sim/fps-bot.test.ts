import { describe, expect, it } from 'vitest';
import { createHeadlessFps, runFps } from '../../src/sim/headless-fps';

describe('the fps bot (§10)', () => {
  for (const floor of [1, 2]) {
    for (const seed of [1, 2, 3]) {
      it(`clears floor ${floor} with god on seed ${seed}`, async () => {
        const r = await runFps({ floor, seed, god: true, bot: true, maxTicks: 15000 });
        expect(r.errors).toEqual([]);
        expect(r.complete).toBe(true);
        expect(r.deaths).toBe(0);
        expect(r.kills).toBeGreaterThan(0);
        if (floor === 2) {
          expect(r.bossPhase).toBe(2);
          expect(r.bossDead).toBe(true);
        }
        expect(r.missingSfx).toEqual([]);
      }, 60000);
    }
  }

  it('is deterministic (same seed → same state hash and ticks)', async () => {
    const a = await runFps({ floor: 1, seed: 7, god: true, bot: true, maxTicks: 1500 });
    const b = await runFps({ floor: 1, seed: 7, god: true, bot: true, maxTicks: 1500 });
    expect(a.stateHash).toBe(b.stateHash);
    expect(a.kills).toBe(b.kills);
  }, 60000);

  it('fights MechaHitler like a player: closes in, so a bullet does ≥ 12 damage on average (§5.3 rule 11 assumes 19)', async () => {
    const h = await createHeadlessFps({ floor: 2, seed: 1, god: true, bot: true });
    let shots = 0;
    let dealt = 0;
    let ammo = -1;
    let hp = -1;
    try {
      for (let t = 0; t < 15000 && !h.complete; t++) {
        h.step(1);
        const g = h.game!;
        const b = g.boss!;
        if (b.awake && ammo >= 0) {
          if (g.player.ammo < ammo) shots += ammo - g.player.ammo;
          if (b.actor.hp < hp) dealt += hp - b.actor.hp;
        }
        ammo = g.player.ammo;
        hp = b.actor.hp;
      }
    } finally {
      h.dispose();
    }
    expect(h.complete).toBe(true);
    expect(shots).toBeGreaterThan(0);
    expect(dealt / shots).toBeGreaterThanOrEqual(12);
  }, 60000);
});
