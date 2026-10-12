/**
 * Mission m3 — THE HIGH NOTE (GDD §11.3): registration, section layouts and exits, the custom
 * background generators and decor, every spawned id registered, headless runs of every section
 * script (god mode, bot), SHE TOOK THE LIFT (the swan record from m3-a to m3-c), the Swan-only wall
 * and both routes end to end.
 */
import { describe, expect, it } from 'vitest';
import { hasSprite } from '../../src/engine/sprites';
import { Terrain } from '../../src/engine/terrain';
import { hasBgGenerator } from '../../src/game/art/art-registry';
import { loadContent } from '../../src/game/content/index';
import { M3 } from '../../src/game/content/missions/m3/index';
import { A_IDS, GLIDE_TRAIL, K_BLUE, K_RED, LIP, POND, SWAN_WALL_X } from '../../src/game/content/missions/m3/section-a';
import { B1_IDS, CAR } from '../../src/game/content/missions/m3/section-b1';
import { B2_IDS, ORGAN_X } from '../../src/game/content/missions/m3/section-b2';
import { C_IDS, HUT, LIFT_X } from '../../src/game/content/missions/m3/section-c';
import { LIFT_KEY, liftRecord } from '../../src/game/content/missions/m3/helpers';
import { isSwan, type Swan } from '../../src/game/content/vehicles/swan/swan';
import { Boss } from '../../src/game/boss';
import { getMission, hasEntity } from '../../src/game/registry';
import { createHeadlessGame } from '../../src/sim/index';

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
  const game = await createHeadlessGame({ missionId: 'm3', sectionId: o.section, seed: 1, god: true, bot: { route: o.route ?? 'lower' }, bossRush: o.bossRush });
  try {
    for (let t = 0; t < o.ticks && !game.done; t++) game.step(1);
    return game.report();
  } finally {
    game.dispose();
  }
}

describe('mission m3 THE HIGH NOTE', () => {
  it('is registered with sections a, b1, b2, c and the boss section c', () => {
    expect(getMission('m3')).toBe(M3);
    expect(Object.keys(M3.sections).sort()).toEqual(['a', 'b1', 'b2', 'c']);
    expect(M3.start).toBe('a');
    expect(M3.bossSection).toBe('c');
    expect(M3.music).toBe('m3');
    expect(M3.bossMusic).toBe('boss');
    expect(M3.announce).toBe('MISSION THREE. WRAP UP WARM, CYGNETS!');
  });

  it('places 8 hostages on either route (GDD §11.3)', () => {
    const h = M3.hostages ?? {};
    for (const mid of ['b1', 'b2']) expect((h.a ?? 0) + (h[mid] ?? 0) + (h.c ?? 0)).toBe(8);
  });

  it('matches the GDD section headers (size, scroll, checkpoints, vehicles, ice)', () => {
    const spec: Record<string, [number, number, string, number[]]> = {
      a: [3000, 216, 'right', [1300, 2300]],
      b1: [384, 1800, 'up', [900, 400]],
      b2: [384, 1800, 'up', [950, 420]],
      c: [1280, 216, 'right', [880]],
    };
    for (const [id, [w, h, scroll, cps]] of Object.entries(spec)) {
      const s = M3.sections[id];
      expect(s.width, id).toBe(w);
      expect(s.height, id).toBe(h);
      expect(s.scroll, id).toBe(scroll);
      expect(s.checkpoints, id).toEqual(cps);
      expect(s.timeLimit ?? 60, id).toBe(60);
    }
    expect(M3.sections.a.vehicles).toEqual(['swan']);
    for (const id of ['b1', 'b2', 'c']) expect(M3.sections[id].vehicles ?? [], id).toEqual([]);
    expect(M3.sections.a.iceRanges).toEqual([POND]);
    expect(POND).toEqual([1340, 1700]);
  });

  it.each(Object.keys(M3.sections))('section %s: start on a floor, exits inside the section and closed until opened', (id) => {
    const s = M3.sections[id];
    const t = new Terrain(s.terrain);
    expect(t.surfaceY(s.playerStart.x, s.playerStart.y - 4, s.playerStart.y + 4)).toBe(s.playerStart.y);
    for (const ex of s.exits ?? []) {
      expect(ex.to === 'complete' || ex.to in M3.sections, `${id} → ${ex.to}`).toBe(true);
      expect(ex.rect.x).toBeGreaterThanOrEqual(0);
      expect(ex.rect.x + ex.rect.w).toBeLessThanOrEqual(s.width);
      expect(ex.rect.y).toBeGreaterThanOrEqual(0);
      expect(ex.disabled, `${id} exit ${ex.id}`).toBe(true);
    }
  });

  it('exits lead where the GDD says: a → (b1 NORTH FACE ↑ | b2 CAVES →) → c', () => {
    const to = (id: string) => (M3.sections[id].exits ?? []).map((e) => e.to).sort();
    expect(to('a')).toEqual(['b1', 'b2']);
    expect(to('b1')).toEqual(['c']);
    expect(to('b2')).toEqual(['c']);
    expect(to('c')).toEqual([]);
    const a = M3.sections.a.exits ?? [];
    const north = a.find((e) => e.to === 'b1')!;
    const caves = a.find((e) => e.to === 'b2')!;
    // GDD: b1 rect (2930–2970, 40–100), b2 rect (2976–3000, 136–176).
    expect(north.rect).toEqual({ x: 2930, y: 40, w: 40, h: 60 });
    expect(caves.rect).toEqual({ x: 2976, y: 136, w: 24, h: 40 });
    // Both vertical sections exit through the top rect (140–244, 0–24).
    for (const id of ['b1', 'b2']) expect(M3.sections[id].exits![0].rect).toEqual({ x: 140, y: 0, w: 104, h: 24 });
  });

  it('m3-a: the GDD terrain (village, piste, kicker, valley, climb, chalets, ladder steps)', () => {
    const t = new Terrain(M3.sections.a.terrain);
    expect(t.groundY(100)).toBe(176);
    expect(t.groundY(300)).toBeCloseTo(164, 0);
    expect(t.groundY(1500)).toBe(176);
    for (const [x, y] of [[1820, 181], [1850, 173], [1880, 182], [2040, 188], [2200, 195], [2290, 204]] as const) expect(t.groundY(x)).toBeCloseTo(y, 0);
    expect(t.groundY(LIP.x - 1)).toBeCloseTo(190, 0);
    expect(t.groundY(LIP.x + 2)).toBe(204);
    expect(t.groundY(2500)).toBe(204);
    expect(t.groundY(2700)).toBe(176);
    expect(t.platformY(900, 100, 130)).toBe(120);
    expect(t.platformY(1060, 100, 130)).toBe(110);
    expect(t.isSolid(900, 150)).toBe(true);
    expect(t.isSolid(1930, 170)).toBe(true); // the boulder
    expect(t.platformY(2900, 130, 150)).toBe(140);
    expect(t.platformY(2950, 90, 120)).toBe(104);
    expect(K_BLUE).toBe(2420);
    expect(K_RED).toBe(2540);
    expect(SWAN_WALL_X).toBe(2860);
    expect(GLIDE_TRAIL.length).toBe(7);
  });

  it('m3-b1 / m3-b2 / m3-c: ledges, the cable car, the organ and the boss arena', () => {
    const b1 = new Terrain(M3.sections.b1.terrain);
    expect(b1.isSolid(10, 900)).toBe(true);
    expect(b1.isSolid(370, 900)).toBe(true);
    expect(b1.platformY(100, 1730, 1745)).toBe(1740); // k = 1, left
    expect(b1.platformY(300, 1410, 1420)).toBe(1416); // k = 10, right
    expect(b1.platformY(300, 860, 870)).toBe(864); // upper k = 1, right
    expect(b1.platformY(100, 30, 40)).toBe(36); // upper k = 24, left
    expect(b1.platformY(40, 1375, 1385)).toBe(1380); // the secret niche
    expect(CAR.toY).toBe(900);
    const b2 = new Terrain(M3.sections.b2.terrain);
    expect(b2.platformY(100, 40, 1760)).toBe(1740 - 72 * 23); // k = 47 is the highest left ledge
    expect(b2.platformY(300, 40, 60)).toBe(48); // k = 48
    expect(ORGAN_X).toEqual([60, 98, 136, 174, 212, 250, 288, 326]);
    const c = new Terrain(M3.sections.c.terrain);
    expect(c.isSolid(HUT.x + 10, 150)).toBe(true);
    expect(c.isSolid(1046, 170)).toBe(true);
    expect(c.isSolid(1146, 170)).toBe(true);
    expect(c.platformY(820, 110, 130)).toBe(120);
    expect(LIFT_X).toEqual({ ivory: 120, mute: 76 });
  });

  it('registers its custom background generators, decor sprites and every spawned id', async () => {
    await loadContent();
    for (const g of ['chalets', 'ice-cave', 'cable-cars']) expect(hasBgGenerator(g), g).toBe(true);
    for (const s of Object.values(M3.sections)) {
      for (const l of s.background.layers) expect(hasBgGenerator(l.gen), `${s.id} ${l.gen}`).toBe(true);
      for (const dec of s.decor ?? []) expect(hasSprite(dec.sprite), dec.sprite).toBe(true);
    }
    for (const id of ['sign-piste-closed', 'k-line-blue', 'k-line-red', 'judges-stand', 'snow-mound', 'cable-car-cabin']) {
      expect(hasSprite(`decor/m3/${id}`), id).toBe(true);
    }
    for (const id of [...A_IDS, ...B1_IDS, ...B2_IDS, ...C_IDS]) expect(hasEntity(id), id).toBe(true);
  });

  it.each(['a', 'b1', 'b2', 'c'])('section %s script runs 1200 ticks in god mode without errors', async (id) => {
    const r = await run({ section: id, ticks: 1200 });
    expect(r.errors).toEqual([]);
    expect(placeholders(r.warnings)).toEqual([]);
  });

  it('section c boss rush spawns THE WINDBAG; its defeat completes the mission', async () => {
    const game = await createHeadlessGame({ missionId: 'm3', sectionId: 'c', seed: 1, god: true, bot: true, bossRush: true });
    try {
      game.step(400);
      const boss = game.world!.entities.find((e) => e.type === 'windbag');
      expect(boss).toBeInstanceOf(Boss);
      expect(game.runner!.world.camera.left).toBe(896);
      (boss as Boss).kill(0);
      for (let i = 0; i < 2000 && !game.missionComplete; i++) game.step(1);
      expect(game.missionComplete).toBe(true);
      const r = game.report();
      expect(r.errors).toEqual([]);
      expect(placeholders(r.warnings)).toEqual([]);
    } finally {
      game.dispose();
    }
  });

  it('SHE TOOK THE LIFT: m3-a records its swans at the exit, m3-c parks them with their cells', async () => {
    const game = await createHeadlessGame({ missionId: 'm3', sectionId: 'a', seed: 1, god: true, bot: false });
    try {
      game.step(200);
      const runner = game.runner!;
      const swan = game.world!.entities.find((e) => isSwan(e)) as Swan | undefined;
      expect(swan).toBeDefined();
      swan!.cells = 2;
      swan!.shells = 7;
      runner.exitTo('b2');
      for (let i = 0; i < 120 && runner.section.id !== 'b2'; i++) game.step(1);
      expect(runner.section.id).toBe('b2');
      expect(runner.records.get(LIFT_KEY)).toEqual([{ variant: 'ivory', cells: 2, shells: 7 }]);
      runner.exitTo('c');
      for (let i = 0; i < 120 && runner.section.id !== 'c'; i++) game.step(1);
      game.step(10);
      const parked = game.world!.entities.filter((e) => isSwan(e)) as Swan[];
      expect(parked.length).toBe(1);
      expect(parked[0].x).toBeCloseTo(LIFT_X.ivory, 0);
      expect(parked[0].cells).toBe(2);
      expect(parked[0].shells).toBe(7);
      expect(parked[0].mute).toBe(false);
    } finally {
      game.dispose();
    }
  });

  it('SHE TOOK THE LIFT: without a record m3-c has no swan; the record keeps at most 2 (ivory, Mute)', async () => {
    const game = await createHeadlessGame({ missionId: 'm3', sectionId: 'c', seed: 1, god: true, bot: false });
    try {
      game.step(60);
      expect(game.world!.entities.some((e) => isSwan(e))).toBe(false);
    } finally {
      game.dispose();
    }
    const fake = (mute: boolean, cells: number): Swan => ({ mute, cells, shells: 3 }) as unknown as Swan;
    expect(liftRecord([fake(true, 1), fake(false, 3), fake(false, 2)])).toEqual([
      { variant: 'ivory', cells: 3, shells: 3 },
      { variant: 'mute', cells: 2, shells: 3 },
    ]);
  });

  it.each(['lower', 'upper'] as const)('the bot plays the %s route to THE WINDBAG (god mode)', async (route) => {
    // a → b1 / b2 → c takes the bot ~5,000 ticks; the boss fight itself is the boss module's
    // business (the bot needs 20,000+ ticks for it), so the run stops in the arena.
    const r = await run({ ticks: 9000, route });
    expect(r.errors).toEqual([]);
    expect(placeholders(r.warnings)).toEqual([]);
    expect(r.sectionsVisited).toEqual(['a', route === 'lower' ? 'b2' : 'b1', 'c']);
    expect(r.finalX).toBeGreaterThan(896);
  }, 120_000);
});
