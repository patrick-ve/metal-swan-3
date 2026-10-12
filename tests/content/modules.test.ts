/**
 * Content manifest smoke tests: every module loads, and every registered entity id spawns and
 * runs 300 ticks on a flat test terrain (next to an invulnerable player) without errors.
 */
import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/game/content/index';
import { getEntityMeta, hasMission, listEntities } from '../../src/game/registry';
import { FLOOR, TestWorld } from './helpers';

const report = await loadContent();
const ids = listEntities();

describe('content modules', () => {
  it('all content modules load', () => {
    expect(report.failed.map((f) => `${f.id}: ${f.error.split('\n')[0]}`)).toEqual([]);
    expect(report.loaded.length).toBeGreaterThan(10);
  });

  it('registers the content-slice ids', () => {
    for (const id of ['rifleman', 'crate', 'hostage', 'pickup-weapon', 'pickup-bombs', 'pickup-food', 'pickup-gem', 'fx-explosion', 'm0-crate-colossus']) {
      expect(ids, id).toContain(id);
    }
    expect(hasMission('m0')).toBe(true);
  });
});

describe('every registered entity', () => {
  it.each(ids)('%s spawns and updates 300 ticks without errors', (id) => {
    const tw = new TestWorld({ god: true, playerX: 100 });
    const category = getEntityMeta(id)?.category;
    // Flyers and bosses may want room above the floor; everything starts on the floor line.
    const e = tw.spawn(id, 230, {}, category === 'boss' ? FLOOR - 1 : FLOOR);
    expect(e.hasTag('placeholder'), `${id} fell back to a placeholder`).toBe(false);
    tw.run(300);
    expect(tw.world.errors.map((x) => `${x.where}: ${x.message}`)).toEqual([]);
  });
});
