/**
 * The x-ray of a covered wagon (src/game/ring/xray.ts; readability, integrator wave B): while more
 * than 40 % of a driven player wagon's body is behind nearer vehicles, its outline is drawn over
 * the cover in the player's colour; a low car does not trigger it; it is never drawn for enemies;
 * drawing it changes no game state.
 */
import { describe, expect, it } from 'vitest';
import { SoftRenderer } from '../../../src/engine/render-soft';
import '../../../src/game/content/ring/traffic/index';
import '../../../src/game/content/ring/traffic/art';
import '../../../src/game/content/ring/wagon/art';
import { laneY } from '../../../src/game/ring/lanes';
import { XRAY } from '../../../src/game/ring/xray';
import { RingRig } from './ring-helpers';

function settled(): RingRig {
  const rig = new RingRig({ god: true });
  rig.until(() => !rig.wagon.arriving && rig.wagon.state === 'driven', 600);
  // Into lane 2: a nearer lane (3) is free for the cover.
  rig.hold(['up']).run(60).release().run(30);
  return rig;
}

describe('the x-ray of a covered wagon', () => {
  it('a tall vehicle in the nearer lane over the wagon: its outline is drawn over the cover', () => {
    const rig = settled();
    const w = rig.wagon;
    const lane = Math.round((w.y - laneY(1)) / (laneY(2) - laneY(1))) + 1;
    const truck = rig.spawnAt('ring-car', w.x - rig.world.camera.x, laneY(lane + 1), { model: 'box-truck', rel: 0 });
    rig.world.flush();
    const xray = rig.runner.xray;
    expect(xray.coverOf(w, rig.world.entities)).toBeGreaterThan(XRAY.cover);
    const r = new SoftRenderer();
    const before = JSON.stringify([w.x, w.y, w.cells, truck.x, rig.world.tick, rig.world.entities.length]);
    rig.runner.draw(r);
    expect(xray.shown).toBe(1);
    // Cosmetic only: no game state moved.
    expect(JSON.stringify([w.x, w.y, w.cells, truck.x, rig.world.tick, rig.world.entities.length])).toBe(before);
  });

  it('a low car beside it covers too little; nothing covers a wagon in the nearest lane from the far side', () => {
    const rig = settled();
    const w = rig.wagon;
    const lane = Math.round((w.y - laneY(1)) / (laneY(2) - laneY(1))) + 1;
    rig.spawnAt('ring-car', w.x - rig.world.camera.x, laneY(lane + 1), { model: 'hatch', rel: 0 });
    // A far-lane camper is drawn BEFORE the wagon: it never covers it.
    rig.spawnAt('ring-car', w.x - rig.world.camera.x, laneY(Math.max(1, lane - 1)), { model: 'camper', rel: 0 });
    expect(rig.runner.xray.coverOf(w, rig.world.entities)).toBeLessThan(XRAY.cover);
    rig.runner.draw(new SoftRenderer());
    expect(rig.runner.xray.shown).toBe(0);
  });
});
