/**
 * Mission m2 — DUNE BUGLE (GDD §11.2): registration, section layouts and exits, the custom
 * background generators and decor, and headless runs of every section script (god mode, bot)
 * plus both routes end to end (bosses included), and the integration fixes (the CANYON exit
 * rect, the Behemoth's entrance wall).
 */
import { describe, expect, it } from 'vitest';
import { Terrain } from '../../src/engine/terrain';
import { hasSprite } from '../../src/engine/sprites';
import { hasBgGenerator } from '../../src/game/art/art-registry';
import { loadContent } from '../../src/game/content/index';
import { M2 } from '../../src/game/content/missions/m2/index';
import { getMission } from '../../src/game/registry';
import { createHeadlessGame } from '../../src/sim/index';
import { BUTTON_BIT } from '../../src/engine/input';
import { Boss } from '../../src/game/boss';
import { BEHEMOTH } from '../../src/game/content/bosses/m2/geom';

const BOSS_IDS = new Set<string>();

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
  const game = await createHeadlessGame({
    missionId: 'm2',
    sectionId: o.section,
    seed: 1,
    god: true,
    bot: { route: o.route ?? 'lower' },
    bossRush: o.bossRush,
  });
  try {
    for (let t = 0; t < o.ticks && !game.done; t++) game.step(1);
    return game.report();
  } finally {
    game.dispose();
  }
}

describe('mission m2 DUNE BUGLE', () => {
  it('is registered with sections a, b, c1, c2, d and the boss section d', () => {
    expect(getMission('m2')).toBe(M2);
    expect(Object.keys(M2.sections).sort()).toEqual(['a', 'b', 'c1', 'c2', 'd']);
    expect(M2.start).toBe('a');
    expect(M2.bossSection).toBe('d');
    expect(M2.music).toBe('m2');
    expect(M2.bossMusic).toBe('boss');
    expect(M2.announce).toBe('MISSION TWO. STAY HYDRATED, CYGNETS!');
  });

  it('places 8 hostages on either route (GDD §11.2)', () => {
    const h = M2.hostages ?? {};
    for (const mid of ['c1', 'c2']) expect((h.a ?? 0) + (h.b ?? 0) + (h[mid] ?? 0) + (h.d ?? 0)).toBe(8);
  });

  it('matches the GDD section headers (size, scroll, checkpoints, vehicles)', () => {
    const spec: Record<string, [number, number[], boolean]> = {
      a: [2400, [1200], false],
      b: [3600, [1200, 2400, 3216], true],
      c1: [2200, [900], true],
      c2: [2200, [1000], true],
      d: [2000, [1000, 1600], true],
    };
    for (const [id, [w, cps, van]] of Object.entries(spec)) {
      const s = M2.sections[id];
      expect(s.width, id).toBe(w);
      expect(s.height, id).toBe(216);
      expect(s.scroll, id).toBe('right');
      expect(s.checkpoints, id).toEqual(cps);
      expect((s.vehicles ?? []).includes('sundae-driver'), id).toBe(van);
    }
  });

  it.each(Object.keys(M2.sections))('section %s: start on a floor, exits inside the section', (id) => {
    const s = M2.sections[id];
    const t = new Terrain(s.terrain);
    expect(t.surfaceY(s.playerStart.x, s.playerStart.y - 4, s.playerStart.y + 4)).toBe(s.playerStart.y);
    for (const ex of s.exits ?? []) {
      expect(ex.to === 'complete' || ex.to in M2.sections, `${id} → ${ex.to}`).toBe(true);
      expect(ex.rect.x).toBeGreaterThanOrEqual(0);
      expect(ex.rect.x + ex.rect.w).toBeLessThanOrEqual(s.width);
      // Exits open only after the row that opens them.
      expect(ex.disabled, `${id} exit ${ex.id}`).toBe(true);
    }
  });

  it('exits lead where the GDD says: a → b → (c1 | c2) → d', () => {
    const to = (id: string) => (M2.sections[id].exits ?? []).map((e) => e.to).sort();
    expect(to('a')).toEqual(['b']);
    expect(to('b')).toEqual(['c1', 'c2']);
    expect(to('c1')).toEqual(['d']);
    expect(to('c2')).toEqual(['d']);
    expect(to('d')).toEqual([]);
    // CANYON ↓ at the bottom of the dip, MESA ↑ at the top of the ramp.
    const b = M2.sections.b.exits ?? [];
    const canyon = b.find((e) => e.to === 'c1');
    const mesa = b.find((e) => e.to === 'c2');
    expect(canyon && mesa && mesa.rect.y + mesa.rect.h <= canyon.rect.y + 8).toBe(true);
    const tb = new Terrain(M2.sections.b.terrain);
    expect(tb.groundY(3590)).toBeGreaterThan(190);
    expect(tb.surfaceY(3580, 90, 120)).toBe(104);
  });

  it('builds the GDD terrain features', () => {
    const c1 = new Terrain(M2.sections.c1.terrain);
    expect(c1.groundY(650)).toBe(152);
    expect(c1.isSolid(1100, 50)).toBe(true); // cave ceiling
    expect(c1.isSolid(1100, 120)).toBe(false); // the van fits under it
    const c2 = new Terrain(M2.sections.c2.terrain);
    for (const x of [490, 1180, 1570]) {
      expect(c2.groundY(x)).toBe(Infinity);
      expect(c2.platformY(x, 140, 160)).toBe(150); // rope bridges
    }
    const d = new Terrain(M2.sections.d.terrain);
    expect(d.isSolid(1990, 100)).toBe(true); // the quarry wall
    expect(d.platformY(1650, 120, 140)).toBe(132);
    expect(d.platformY(1770, 120, 140)).toBe(132);
  });

  it('registers its custom background generators and decor sprites', async () => {
    await loadContent();
    for (const g of ['cacti', 'canyon-walls', 'rock-pillars', 'quarry-terraces']) expect(hasBgGenerator(g), g).toBe(true);
    for (const s of Object.values(M2.sections)) {
      for (const l of s.background.layers) expect(hasBgGenerator(l.gen), `${s.id} ${l.gen}`).toBe(true);
      for (const dec of s.decor ?? []) expect(hasSprite(dec.sprite), dec.sprite).toBe(true);
    }
  });

  it.each(['a', 'b', 'c1', 'c2', 'd'])('section %s script runs 1200 ticks in god mode without errors', async (id) => {
    const r = await run({ section: id, ticks: 1200 });
    expect(r.errors).toEqual([]);
    expect(placeholders(r.warnings).filter((x) => !BOSS_IDS.has(x))).toEqual([]);
  });

  it.each(['b', 'd'])('section %s boss rush spawns the boss and finishes the section', async (id) => {
    const r = await run({ section: id, ticks: 3000, bossRush: true });
    expect(r.errors).toEqual([]);
    expect(placeholders(r.warnings).filter((x) => !BOSS_IDS.has(x))).toEqual([]);
    expect(r.sectionsVisited.length).toBeGreaterThan(id === 'b' ? 1 : 0);
  });

  it.each(['lower', 'upper'] as const)('the bot finishes the %s route (god mode)', async (route) => {
    // The bot seldom aims up at the toms, so its Behemoth fight takes ~25,000–30,000 ticks (a
    // scripted player needs ~5,700); the budget covers the whole run.
    const r = await run({ ticks: 45000, route });
    expect(r.errors).toEqual([]);
    expect(placeholders(r.warnings)).toEqual([]);
    expect(r.sectionsVisited).toEqual(['a', 'b', route === 'lower' ? 'c1' : 'c2', 'd']);
    expect(r.bossDefeated).toBe(true);
    expect(r.missionComplete).toBe(true);
  }, 120_000);

  it('m2-b: the CANYON exit only catches feet in the dip, never a player on the ramp', () => {
    const b = M2.sections.b;
    const canyon = (b.exits ?? []).find((e) => e.to === 'c1')!;
    const t = new Terrain(b.terrain);
    for (let x = canyon.rect.x; x < canyon.rect.x + canyon.rect.w; x += 4) {
      const dip = t.groundY(x);
      expect(dip, `dip at ${x}`).toBeGreaterThanOrEqual(canyon.rect.y);
      expect(dip).toBeLessThanOrEqual(canyon.rect.y + canyon.rect.h);
      const ramp = t.platformY(x, 90, 170);
      expect(ramp + 24, `ramp at ${x}`).toBeLessThan(canyon.rect.y);
    }
  });

  it('m2-d: a player who runs right during the Behemoth entrance is pushed back, not killed', async () => {
    const game = await createHeadlessGame({ missionId: 'm2', sectionId: 'd', seed: 1, god: false, bot: false, bossRush: true, input: (t) => (t < 900 ? BUTTON_BIT.right : 0) });
    try {
      let fightAt = -1;
      for (let i = 0; i < 400; i++) {
        game.step(1);
        const boss = game.world?.entities.find((e) => e instanceof Boss) as Boss | undefined;
        if (boss && boss.state === 'fight' && fightAt < 0) fightAt = game.ticks;
        // While it rolls in and for a grace into the fight, nobody stands inside its tread.
        if (boss && (boss.state === 'intro' || (fightAt >= 0 && game.ticks - fightAt < 30))) {
          expect(game.player(0)!.x).toBeLessThan(boss.x + BEHEMOTH.tread.x);
        }
        if (fightAt >= 0 && game.ticks - fightAt >= 30) break;
      }
      expect(fightAt).toBeGreaterThan(0);
      expect(game.report().deaths).toBe(0);
    } finally {
      game.dispose();
    }
  });
});
