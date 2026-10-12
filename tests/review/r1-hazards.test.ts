/**
 * Review round 1: hazards. Regression tests: each asserts the correct
 * behaviour (they were `it.fails` until the fix).
 */
import { describe, expect, it } from 'vitest';
import { FLOOR, Rig } from '../game/helpers';

describe('review r1: hazards', () => {
  // R1-13: Player.checkHazards() sends 'spikes', 'kill' and 'lava' through world.damage(), so
  // Player.onHit() ignores them while invulnerable (respawn blink, mount / eject i-frames). GDD
  // 4.2 / 4.5: pit, kill, spikes and lava kill "also through invulnerability". Today a blinking
  // player walks over spikes, lava and kill zones (e.g. the GDD m3-b2 rising-water kill rect) and
  // only dies when the blink ends.
  for (const kind of ['kill', 'spikes', 'lava'] as const) {
    it(`R1-13: a '${kind}' hazard kills an invulnerable player`, () => {
      const rig = new Rig({ build: (t) => t.hazard(kind, 160, FLOOR - 8, 40, 8) });
      rig.p.invulnTicks = 120;
      rig.hold(['right']).run(45); // walks into the hazard at x ≈ 153
      expect(rig.p.state).toBe('dead');
    });
  }

  // R1-14: the deep-water test is `hazard.y <= player.y - body.h + 2` with the CURRENT body
  // height. Standing (h 30) in water 18–27 px deep only wades, but crouching (h 20) there drowns
  // the player at once — a defensive input kills him (GDD m1-c riverbank slopes into water).
  it('R1-14: crouching in knee-deep water does not drown the player', () => {
    const rig = new Rig({ build: (t) => t.hazard('water', 0, FLOOR - 20, 3000, 40) });
    rig.run(5);
    expect(rig.p.wading).toBe(true); // standing in 20 px of water: wading is fine
    rig.p.invulnTicks = 0;
    rig.hold(['down']).run(10);
    expect(rig.p.state).toBe('play'); // today: 'dead' (drown)
  });
});
