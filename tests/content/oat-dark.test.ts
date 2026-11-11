/**
 * oat-d's 03:00 dark set (docs/design/oat.md §6.9, §8.9; the smooth review's MAJOR-1): the switch
 * starts once the arena lock holds, so from every camera x the lock allows, every strip chunk on
 * screen has its dark bake; the dark range starts on a lot border (a chunk border never cuts a
 * façade: the lots outside the range keep their lit look in a dark chunk); the dark set stays at
 * three chunks (the tier-4 budget, tests/content/oat-dense-budget.test.ts).
 */
import { describe, expect, it } from 'vitest';
import { makeFloorCam } from '../../src/engine/floor/cam';
import { VIEW_W } from '../../src/engine/render';
import { isOatContent, loadContent } from '../../src/game/content/index';
import { OAT_D_DARK, OAT_STRIPS, sectionLots } from '../../src/game/content/missions/oat/facade/rows';
import { OAT_D } from '../../src/game/content/missions/oat/terrain';
import { chunksOfRange, createStripStore, stripScale, uOfStripX, STRIP_CHUNK } from '../../src/game/mission/strips/index';
import { sectionLight } from '../../src/game/mission/light/api';
import { getMission } from '../../src/game/registry';
import type { FloorDef } from '../../src/game/mission/floor/types';

await loadContent();
await loadContent(isOatContent);

const section = getMission('oat')?.sections['oat-d'];
const def = OAT_STRIPS['oat-d'];

describe('oat-d: the 03:00 dark set covers the arena view', () => {
  const floor = section?.floor as FloorDef;
  const cam = makeFloorCam({ ...floor.camera, yw: 176 });
  const s = stripScale(cam, def.depth);
  const store = createStripStore(def, { id: 'oat-d', width: OAT_D.w, seed: 1, scale: s }, { jobKey: 'test-oat-dark/' });

  it('starts on a lot border at or left of the screen’s left edge at the arena lock', () => {
    expect(def.dark?.[0]).toBe(OAT_D_DARK);
    expect(sectionLots('oat-d').some((l) => l.u0 === OAT_D_DARK)).toBe(true);
    // The façade plane's left screen edge at the lock camera.
    expect(OAT_D_DARK).toBeLessThanOrEqual(uOfStripX(OAT_D.arena[0] * s, s));
  });

  it('every chunk on screen has its dark bake from every locked camera x', () => {
    let checked = 0;
    for (let camX = OAT_D.arena[0]; camX <= OAT_D.arena[1] - VIEW_W; camX += 0.5) {
      const c0 = Math.floor((camX * s) / STRIP_CHUNK);
      const c1 = Math.floor((camX * s + VIEW_W - 1e-6) / STRIP_CHUNK);
      for (let cx = c0; cx <= c1; cx++) {
        if (!store.covers(cx)) continue;
        expect(store.hasDark(cx), `camera ${camX}: chunk ${cx}`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('the light pass’s bake range is the strips’ dark range', () => {
    expect(sectionLight('oat-d')?.bakes).toMatchObject({ x0: OAT_D_DARK, x1: def.dark?.[1] });
  });

  it('keeps the dark set at three chunks (no extra memory)', () => {
    const r = chunksOfRange(def.dark?.[0] ?? 0, def.dark?.[1] ?? 0, s);
    expect(r.c1 - r.c0 + 1).toBe(3);
  });
});
