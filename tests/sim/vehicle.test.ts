/**
 * The bot boards an empty vehicle it finds on the way and drives on (a test vehicle in a
 * small test mission; the real vehicles come from the vehicles content module).
 */
import { describe, expect, it } from 'vitest';
import type { World } from '../../src/engine/world';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import { terrain, type MissionDef } from '../../src/game/mission/index';
import { defineEntity, defineMission, type SpawnParams } from '../../src/game/registry';
import { Vehicle } from '../../src/game/vehicle';
import { createHeadlessGame } from '../../src/sim/index';

class TestBuggy extends Vehicle {
  constructor(w: World, x: number, y: number, p: SpawnParams) {
    super(w, x, y, p, { art: 'vehicle/test-buggy', w: 40, h: 24, seat: { x: -10, y: -30, w: 20, h: 14 }, speed: 1.8 });
  }
}
defineEntity('test-buggy', (w, x, y, p) => new TestBuggy(w, x, y, p), { category: 'vehicle' });

const t = terrain(1600, 216);
t.ground().at(0, 176).flat(1600);
const MISSION: MissionDef = {
  id: 'test-vehicle',
  name: 'VEHICLE TEST',
  music: '',
  start: 'a',
  sections: {
    a: {
      id: 'a',
      width: 1600,
      height: 216,
      scroll: 'right',
      background: { sky: 0x203048ff, layers: [] },
      terrain: t.build(),
      terrainStyle: { ground: 'dirt' },
      playerStart: { x: 40, y: 176 },
      timeLimit: 0,
      *script(ctx) {
        ctx.spawn('test-buggy', 220, 'ground', { facing: 1 });
        yield ctx.waitPlayerX(1500);
        yield ctx.missionComplete();
      },
    },
  },
};
defineMission(MISSION);

describe('bot and vehicles', () => {
  it('boards an empty vehicle and drives to the end', async () => {
    const game = await createHeadlessGame({ missionId: 'test-vehicle', seed: 1, god: true, bot: true, loadContent: false });
    try {
      let mounted = false;
      game.runUntil((g) => {
        if (g.player(0)?.state === 'mounted') mounted = true;
        return g.done;
      }, 3000);
      expect(mounted).toBe(true);
      expect(game.missionComplete).toBe(true);
      expect(game.report().errors).toEqual([]);
    } finally {
      game.dispose();
    }
  });
});
