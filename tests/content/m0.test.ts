/**
 * Mission m0 (test range) data: sections, exits, terrain features the tools and the bot rely on.
 */
import { describe, expect, it } from 'vitest';
import { Terrain } from '../../src/engine/terrain';
import { M0 } from '../../src/game/content/missions/m0/index';
import { getMission } from '../../src/game/registry';

describe('mission m0', () => {
  it('is registered with sections a, b1, b2, c and a boss section', () => {
    expect(getMission('m0')).toBe(M0);
    expect(Object.keys(M0.sections).sort()).toEqual(['a', 'b1', 'b2', 'c']);
    expect(M0.start).toBe('a');
    expect(M0.bossSection).toBe('c');
  });

  it.each(Object.keys(M0.sections))('section %s has a valid layout', (id) => {
    const s = M0.sections[id];
    expect(s.id).toBe(id);
    expect(s.height).toBeGreaterThanOrEqual(216);
    const t = new Terrain(s.terrain);
    // The player starts on a floor.
    const floor = t.surfaceY(s.playerStart.x, s.playerStart.y - 4, s.playerStart.y + 4);
    expect(floor).toBe(s.playerStart.y);
    // Exits lead somewhere real and lie inside the section.
    for (const ex of s.exits ?? []) {
      expect(ex.to === 'complete' || ex.to in M0.sections, `${id} → ${ex.to}`).toBe(true);
      expect(ex.rect.x + ex.rect.w).toBeLessThanOrEqual(s.width);
      expect(ex.rect.x).toBeGreaterThanOrEqual(0);
    }
  });

  it('section a offers the route choice (both exits open only after the arena)', () => {
    const a = M0.sections.a;
    const exits = a.exits ?? [];
    expect(exits.map((e) => e.to).sort()).toEqual(['b1', 'b2']);
    expect(exits.every((e) => e.disabled)).toBe(true);
    const upper = exits.find((e) => e.to === 'b1');
    const lower = exits.find((e) => e.to === 'b2');
    expect(upper && lower && upper.rect.y + upper.rect.h < lower.rect.y).toBe(true);
  });

  it('section a has a slope, a plateau with platforms, a pit and solid stairs', () => {
    const t = new Terrain(M0.sections.a.terrain);
    expect(t.groundY(200)).toBe(176);
    expect(t.groundY(700)).toBe(128);
    expect(t.groundSlope(440)).toBeLessThan(0);
    expect(t.groundY(1260)).toBe(Infinity);
    expect(t.hazards.some((h) => h.kind === 'pit')).toBe(true);
    expect(M0.sections.a.terrain.solids.length).toBeGreaterThanOrEqual(3);
    expect(M0.sections.a.terrain.platforms.length).toBeGreaterThanOrEqual(4);
  });

  it('both routes rejoin in the boss section', () => {
    for (const id of ['b1', 'b2']) expect(M0.sections[id].exits?.map((e) => e.to)).toEqual(['c']);
  });
});
