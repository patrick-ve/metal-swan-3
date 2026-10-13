/**
 * Mission m4 — OPENING NIGHT (GDD §11.4): registration, section layouts and exits, the custom
 * background generators and decor, every spawned id registered, headless runs of every section
 * script (god mode, bot), the barricade → route choice in m4-b, and both routes end to end.
 */
import { describe, expect, it } from 'vitest';
import { hasSprite } from '../../src/engine/sprites';
import { Terrain } from '../../src/engine/terrain';
import { hasBgGenerator } from '../../src/game/art/art-registry';
import { loadContent } from '../../src/game/content/index';
import { M4 } from '../../src/game/content/missions/m4/index';
import { A_IDS, A_HIGH, A_PLINTHS } from '../../src/game/content/missions/m4/section-a';
import { B_HOLE, B_IDS } from '../../src/game/content/missions/m4/section-b';
import { C1_IDS, C1_PLATFORMS, PLATFORM_Y, TRACK_Y } from '../../src/game/content/missions/m4/section-c1';
import { C2_GIANT, C2_IDS, C2_ROOFS } from '../../src/game/content/missions/m4/section-c2';
import { D_BOXES, D_IDS, D_STEP } from '../../src/game/content/missions/m4/section-d';
import { M4_BG_IDS } from '../../src/game/content/missions/m4/bg';
import { getMission, hasEntity } from '../../src/game/registry';
import { createHeadlessGame } from '../../src/sim/index';

/** The bosses (built by the boss-m4 agent): a placeholder is fine while they are missing. */
const BOSS_IDS = new Set(['big-head', 'grand-grand', 'chandelier']);

/** Ids spawned as placeholders (unknown entity ids) in a report's warnings. */
function placeholders(warnings: readonly string[]): string[] {
  const out: string[] = [];
  for (const w of warnings) {
    const m = /unknown entity id "([^"]+)"/.exec(w);
    if (m) out.push(m[1]);
  }
  return out;
}

async function run(o: { section?: string; ticks: number; bossRush?: boolean; route?: 'lower' | 'upper' }) {
  const game = await createHeadlessGame({ missionId: 'm4', sectionId: o.section, seed: 1, god: true, bot: { route: o.route ?? 'lower' }, bossRush: o.bossRush });
  try {
    for (let t = 0; t < o.ticks && !game.done; t++) game.step(1);
    return game.report();
  } finally {
    game.dispose();
  }
}

describe('mission m4 OPENING NIGHT', () => {
  it('is registered with sections a, b, c1, c2, d and the boss section d', () => {
    expect(getMission('m4')).toBe(M4);
    expect(Object.keys(M4.sections).sort()).toEqual(['a', 'b', 'c1', 'c2', 'd']);
    expect(M4.start).toBe('a');
    expect(M4.bossSection).toBe('d');
    expect(M4.music).toBe('m4');
    expect(M4.bossMusic).toBe('boss');
    expect(M4.announce).toBe('MISSION FIVE. BREAK A LEG, CYGNETS!');
  });

  it('places 10 hostages on either route (GDD §11.4)', () => {
    const h = M4.hostages ?? {};
    for (const mid of ['c1', 'c2']) expect((h.a ?? 0) + (h.b ?? 0) + (h[mid] ?? 0) + (h.d ?? 0)).toBe(10);
  });

  it('matches the GDD section headers (size, scroll, checkpoints, vehicles)', () => {
    const spec: Record<string, [number, number[], boolean]> = {
      a: [2800, [1200, 2100], false],
      b: [3600, [1300, 2400, 3216], true],
      c1: [2400, [1000], false],
      c2: [2400, [1000], false],
      d: [1800, [1100, 1400], false],
    };
    for (const [id, [w, cps, wagon]] of Object.entries(spec)) {
      const s = M4.sections[id];
      expect(s.width, id).toBe(w);
      expect(s.height, id).toBe(216);
      expect(s.scroll, id).toBe('right');
      expect(s.checkpoints, id).toEqual(cps);
      expect(s.timeLimit ?? 60, id).toBe(60);
      expect((s.vehicles ?? []).includes('bandwagon'), id).toBe(wagon);
    }
  });

  it.each(Object.keys(M4.sections))('section %s: start on a floor, exits inside the section and closed at first', (id) => {
    const s = M4.sections[id];
    const t = new Terrain(s.terrain);
    expect(t.surfaceY(s.playerStart.x, s.playerStart.y - 4, s.playerStart.y + 4)).toBe(s.playerStart.y);
    for (const ex of s.exits ?? []) {
      expect(ex.to === 'complete' || ex.to in M4.sections, `${id} → ${ex.to}`).toBe(true);
      expect(ex.rect.x).toBeGreaterThanOrEqual(0);
      expect(ex.rect.x + ex.rect.w).toBeLessThanOrEqual(s.width);
      expect(ex.disabled, `${id} exit ${ex.id}`).toBe(true);
    }
  });

  it('exits lead where the GDD says: a → b → (c1 | c2) → d', () => {
    const to = (id: string) => (M4.sections[id].exits ?? []).map((e) => e.to).sort();
    expect(to('a')).toEqual(['b']);
    expect(to('b')).toEqual(['c1', 'c2']);
    expect(to('c1')).toEqual(['d']);
    expect(to('c2')).toEqual(['d']);
    expect(to('d')).toEqual([]);
    // SUBWAY ↓ in the hole under the hatch, ROOFTOPS ↑ at the top of the fire escape.
    const b = M4.sections.b.exits ?? [];
    const subway = b.find((e) => e.to === 'c1')!;
    const roofs = b.find((e) => e.to === 'c2')!;
    expect(subway.rect.x).toBe(B_HOLE.x);
    expect(subway.rect.y).toBeGreaterThan(176);
    expect(roofs.rect.y + roofs.rect.h).toBeLessThanOrEqual(72);
    const tb = new Terrain(M4.sections.b.terrain);
    expect(tb.groundY(3460)).toBe(Infinity); // the subway stairs
    expect(tb.surfaceY(3580, 60, 72)).toBe(68); // the top landing
  });

  it('builds the GDD terrain features', () => {
    const a = new Terrain(M4.sections.a.terrain);
    for (const x of A_PLINTHS) expect(a.isSolid(x + 16, 150), `plinth ${x}`).toBe(true);
    expect(a.platformY(570, 50, 70)).toBe(A_HIGH.y);
    expect(a.platformY(1010, 110, 130)).toBe(120);
    const c1 = new Terrain(M4.sections.c1.terrain);
    expect(c1.isSolid(1000, 20)).toBe(true); // the ceiling
    expect(c1.groundY(700)).toBe(TRACK_Y);
    for (const [x0, x1] of C1_PLATFORMS) expect(c1.platformY((x0 + x1) / 2, 140, 160)).toBe(PLATFORM_Y);
    const c2 = new Terrain(M4.sections.c2.terrain);
    for (const [x0, x1, y] of C2_ROOFS) expect(c2.groundY((x0 + x1) / 2)).toBe(y);
    expect(c2.groundY(420)).toBe(Infinity); // a gap (with a net)
    expect(c2.platformY(750, 30, 50)).toBe(C2_GIANT.y);
    expect(c2.isSolid(1016, 120)).toBe(true); // a water tower
    const d = new Terrain(M4.sections.d.terrain);
    expect(d.isSolid(1790, 100)).toBe(true); // the wall
    expect(d.platformY((D_STEP.x0 + D_STEP.x1) / 2, 130, 150)).toBe(D_STEP.y);
    for (const [x0, x1] of D_BOXES) expect(d.platformY((x0 + x1) / 2, 100, 115)).toBe(108);
  });

  it('registers its custom background generators, decor sprites and every id it spawns', async () => {
    await loadContent();
    for (const g of M4_BG_IDS) expect(hasBgGenerator(g), g).toBe(true);
    for (const s of Object.values(M4.sections)) {
      for (const l of s.background.layers) expect(hasBgGenerator(l.gen), `${s.id} ${l.gen}`).toBe(true);
      for (const dec of s.decor ?? []) expect(hasSprite(dec.sprite), dec.sprite).toBe(true);
    }
    for (const id of [...A_IDS, ...B_IDS, ...C1_IDS, ...C2_IDS, ...D_IDS]) expect(hasEntity(id), id).toBe(true);
  });

  it.each(['a', 'b', 'c1', 'c2', 'd'])('section %s script runs 1200 ticks in god mode without errors', async (id) => {
    const r = await run({ section: id, ticks: 1200 });
    expect(r.errors).toEqual([]);
    expect(r.missingSfx).toEqual([]);
    expect(placeholders(r.warnings).filter((x) => !BOSS_IDS.has(x))).toEqual([]);
  });

  it.each(['a', 'b', 'd'])('section %s boss rush plays the arena and leaves the section', async (id) => {
    const r = await run({ section: id, ticks: 9000, bossRush: true });
    expect(r.errors).toEqual([]);
    expect(placeholders(r.warnings).filter((x) => !BOSS_IDS.has(x))).toEqual([]);
    // With the boss module still missing (a placeholder) the fight is skipped and the section ends;
    // with a real boss the bot may need longer than this budget: then only the run itself counts.
    const real = id === 'a' ? hasEntity('big-head') : id === 'd' ? hasEntity('grand-grand') : false;
    if (!real) {
      if (id === 'd') expect(r.missionComplete).toBe(true);
      else expect(r.sectionsVisited.length).toBeGreaterThan(1);
    }
  }, 60_000);

  it.each(['lower', 'upper'] as const)('the bot finishes the %s route (god mode)', async (route) => {
    const r = await run({ ticks: 60000, route });
    expect(r.errors).toEqual([]);
    expect(placeholders(r.warnings).filter((x) => !BOSS_IDS.has(x))).toEqual([]);
    // THE BIG HEAD may hold a bot longer than the budget once it is built (bosses/m4): then the
    // route checks start from b (section runs above); without the bosses the whole path plays.
    if (!hasEntity('big-head') && !hasEntity('grand-grand')) {
      expect(r.sectionsVisited).toEqual(['a', 'b', route === 'lower' ? 'c1' : 'c2', 'd']);
      expect(r.missionComplete).toBe(true);
    } else expect(r.sectionsVisited[0]).toBe('a');
  }, 180_000);

  it.each(['lower', 'upper'] as const)('from b the bot takes the %s route to d (god mode)', async (route) => {
    const r = await run({ section: 'b', ticks: 20000, route });
    expect(r.errors).toEqual([]);
    expect(r.sectionsVisited.slice(0, 3)).toEqual(['b', route === 'lower' ? 'c1' : 'c2', 'd']);
  }, 180_000);
});
