/**
 * Mission m5 — SWAN SONG (GDD §11.5): registration, section headers and terrain, the custom
 * background generators and decor, every spawned id registered (the final-boss stages may be
 * placeholders while bosses/m5 is not registered yet), headless runs of every section script in
 * god mode, the exits a → b → c, the Trumpeter start, the m5-b door and the m5-c stage hand-over.
 */
import { describe, expect, it } from 'vitest';
import { hasSprite } from '../../src/engine/sprites';
import { Terrain } from '../../src/engine/terrain';
import { getBgGenerator, hasBgGenerator } from '../../src/game/art/art-registry';
import { loadContent } from '../../src/game/content/index';
import { M5 } from '../../src/game/content/missions/m5/index';
import { A_IDS, ARENA_X } from '../../src/game/content/missions/m5/section-a';
import { B_IDS, BELLOWS_K, EXIT_RECT, FLOOR_Y, ledgeX, ledgeY, LEDGES } from '../../src/game/content/missions/m5/section-b';
import type { GrampsShip } from '../../src/game/content/missions/m5/finale';
import { C_IDS, TIERS } from '../../src/game/content/missions/m5/section-c';
import { trumpeterOf } from '../../src/game/content/vehicles/fleet/trumpeter';
import { getMission, hasEntity } from '../../src/game/registry';
import { createHeadlessGame } from '../../src/sim/index';

/** The final-boss stages (built by bosses/m5; placeholders are tolerated until they register). */
const BOSS_IDS = ['grand-organ', 'organ-console', 'maestro', 'wreck-block'];

/** Ids spawned as placeholders (unknown entity ids) in a report's warnings. */
function placeholders(warnings: readonly string[]): string[] {
  const out: string[] = [];
  for (const w of warnings) {
    const m = /unknown entity id "([^"]+)"/.exec(w);
    if (m) out.push(m[1]);
  }
  return out;
}

/** Placeholders other than the boss stages that are not registered yet. */
function badPlaceholders(warnings: readonly string[]): string[] {
  return placeholders(warnings).filter((id) => !(BOSS_IDS.includes(id) && !hasEntity(id)));
}

async function run(o: { section?: string; ticks: number; bot?: boolean }) {
  const game = await createHeadlessGame({ missionId: 'm5', sectionId: o.section, seed: 1, god: true, bot: o.bot ?? true });
  try {
    for (let t = 0; t < o.ticks && !game.done; t++) game.step(1);
    return game.report();
  } finally {
    game.dispose();
  }
}

describe('mission m5 SWAN SONG', () => {
  it('is registered with sections a, b, c, the boss sections a + c and the final songs', () => {
    expect(getMission('m5')).toBe(M5);
    expect(Object.keys(M5.sections).sort()).toEqual(['a', 'b', 'c']);
    expect(M5.start).toBe('a');
    expect(M5.bossSection).toBe('c');
    expect(M5.bossSections).toEqual(['a', 'c']);
    expect(M5.next).toBeUndefined(); // the last mission: flow.missionDone → EndingScene
    expect(M5.music).toBe('m5-sky');
    expect(M5.sections.b.music).toBe('m5-organ');
    expect(M5.bossMusic).toBe('boss-final');
    expect(M5.announce).toBe('FINAL MISSION. FLY GRACEFULLY, CYGNETS!');
  });

  it('places 6 hostages (a 2 on balloons, b 4 incl. the composer)', () => {
    const h = M5.hostages ?? {};
    expect((h.a ?? 0) + (h.b ?? 0) + (h.c ?? 0)).toBe(6);
    expect(h.a).toBe(2);
    expect(h.b).toBe(4);
  });

  it('matches the GDD section headers (size, scroll, checkpoints, vehicles, timer)', () => {
    const spec: Record<string, [number, number, string, number[]]> = {
      a: [4400, 216, 'right', [1200, 2400, 3600, 4016]],
      b: [384, 1800, 'down', [700, 1400]],
      c: [384, 216, 'right', []],
    };
    for (const [id, [w, h, scroll, cps]] of Object.entries(spec)) {
      const s = M5.sections[id];
      expect(s.width, id).toBe(w);
      expect(s.height, id).toBe(h);
      expect(s.scroll, id).toBe(scroll);
      expect(s.checkpoints ?? [], id).toEqual(cps);
      expect(s.timeLimit ?? 60, id).toBe(60);
    }
    expect(M5.sections.a.startVehicle).toBe('trumpeter');
    expect(M5.sections.a.vehicles).toEqual(['trumpeter']);
    for (const id of ['b', 'c']) expect(M5.sections[id].vehicles ?? [], id).toEqual([]);
    expect(ARENA_X).toBe(4016);
  });

  it('exits lead where the GDD says: a → b (scripted) → c (the bottom door) → the ending', () => {
    expect(M5.sections.a.exits ?? []).toEqual([]);
    const b = M5.sections.b.exits ?? [];
    expect(b.map((e) => e.to)).toEqual(['c']);
    expect(b[0].rect).toEqual({ x: 150, y: 1760, w: 84, h: 24 });
    expect(b[0].disabled).toBe(true);
    expect(EXIT_RECT).toEqual(b[0].rect);
    expect(M5.sections.c.exits ?? []).toEqual([]);
  });

  it('m5-b / m5-c terrain: pipe walls, the hatch floor, 34 zig-zag ledges with two bellows gaps, the floor', () => {
    const b = new Terrain(M5.sections.b.terrain);
    expect(b.isSolid(10, 900)).toBe(true);
    expect(b.isSolid(370, 900)).toBe(true);
    expect(b.platformY(192, 66, 78)).toBe(72);
    for (let k = 0; k < LEDGES; k++) {
      const y = ledgeY(k);
      const x = ledgeX(k) + 100;
      if (BELLOWS_K.includes(k)) expect(b.platformY(192, y - 4, y + 4), `k ${k}`).toBe(Infinity);
      else expect(b.platformY(x, y - 4, y + 4), `k ${k}`).toBe(y);
    }
    expect(ledgeY(33)).toBe(1704);
    expect(b.surfaceY(192, FLOOR_Y - 8, FLOOR_Y + 8)).toBe(FLOOR_Y);
    const c = new Terrain(M5.sections.c.terrain);
    expect(c.groundY(10)).toBe(176);
    expect(c.groundY(370)).toBe(176);
    expect(TIERS.map((t) => [t.x0, t.x1, t.y])).toEqual([[120, 300, 148], [150, 300, 116], [180, 300, 84]]);
    const s = M5.sections.b;
    expect(b.surfaceY(s.playerStart.x, s.playerStart.y - 4, s.playerStart.y + 4)).toBe(s.playerStart.y);
  });

  it('registers the custom generators, the decor and every spawned id', async () => {
    await loadContent();
    for (const id of ['organ-deep', 'organ-pipes', 'console-room']) {
      expect(hasBgGenerator(id), id).toBe(true);
      const buf = getBgGenerator(id)!(384, 384, {}, 7);
      expect([buf.w, buf.h]).toEqual([384, 384]);
    }
    for (const id of ['organ-distant', 'hatch', 'door', 'tier-180', 'tier-150', 'tier-120']) expect(hasSprite(`decor/m5/${id}`), id).toBe(true);
    for (const id of ['organ-distant', 'm5-dusk', 'm5-door', 'm5-console-tier']) expect(hasEntity(id), id).toBe(true);
    for (const id of [...A_IDS, ...B_IDS, ...C_IDS]) {
      if (BOSS_IDS.includes(id)) continue;
      expect(hasEntity(id), id).toBe(true);
    }
  });

  it.each(['a', 'b', 'c'])('section %s script runs 1200 ticks in god mode without errors', async (id) => {
    const r = await run({ section: id, ticks: 1200 });
    expect(r.errors).toEqual([]);
    expect(badPlaceholders(r.warnings)).toEqual([]);
  });

  it('m5-a: players start mounted at view x 64 (y 80 / 130) and the view auto-scrolls 1 px/tick', async () => {
    const game = await createHeadlessGame({ missionId: 'm5', sectionId: 'a', seed: 1, god: true, bot: false, players: 2 });
    try {
      game.step(2);
      const runner = game.runner!;
      const ships = runner.players.map((p) => trumpeterOf(p));
      expect(ships.every((s) => s !== null)).toBe(true);
      const cam = runner.world.camera;
      const x0 = cam.left;
      game.step(100);
      expect(cam.left - x0).toBeGreaterThanOrEqual(99);
      expect(cam.left - x0).toBeLessThanOrEqual(101);
      const ys = runner.players.map((p) => Math.round(p.y - cam.top)).sort((a, b) => a - b);
      expect(ys).toEqual([80, 130]);
    } finally {
      game.dispose();
    }
  });

  it('m5-a: the auto-scroll stops in the boss lock 4016–4400', async () => {
    const game = await createHeadlessGame({ missionId: 'm5', sectionId: 'a', seed: 1, god: true, bot: true });
    try {
      for (let i = 0; i < 4300 && game.runner!.section.id === 'a'; i++) game.step(1);
      const cam = game.runner!.world.camera;
      if (game.runner!.section.id === 'a') expect(cam.left).toBe(ARENA_X);
      expect(game.report().errors).toEqual([]);
    } finally {
      game.dispose();
    }
  });

  it('m5-b: the bottom door opens after the last group and leads to c', async () => {
    const game = await createHeadlessGame({ missionId: 'm5', sectionId: 'b', seed: 1, god: true, bot: true });
    try {
      const runner = game.runner!;
      for (let i = 0; i < 6000 && runner.section.id === 'b'; i++) game.step(1);
      expect(runner.section.id).toBe('c');
      expect(game.report().errors).toEqual([]);
    } finally {
      game.dispose();
    }
  });

  it('m5-c: the tiers stand until stage 2 is over, then fall; the wreck blocks land; the mission completes', async () => {
    const game = await createHeadlessGame({ missionId: 'm5', sectionId: 'c', seed: 1, god: true, bot: true });
    try {
      game.step(20);
      const world = () => game.runner!.world;
      const tiers = () => world().entities.filter((e) => e.type === 'm5-console-tier' && e.alive);
      expect(tiers().length).toBe(3);
      for (let i = 0; i < 20000 && !game.missionComplete; i++) {
        game.step(1);
        const boss = world().entities.find((e) => (e.type === 'organ-console' || e.type === 'maestro') && e.alive) as { kill?: (o?: number) => void; state?: string } | undefined;
        if (boss && typeof boss.kill === 'function' && boss.state === 'fight') boss.kill(0);
      }
      expect(game.missionComplete).toBe(true);
      const r = game.report();
      expect(r.errors).toEqual([]);
      expect(badPlaceholders(r.warnings)).toEqual([]);
    } finally {
      game.dispose();
    }
  }, 60000);

  it('m5-c finale (GDD 10.5): the players auto-run into Gramps\' Trumpeter, it flies off, then the mission completes', async () => {
    for (const o of [{ players: 1 as const, char: undefined, pilot: 'gramps' }, { players: 2 as const, char: 'gramps', pilot: 'gusto' }]) {
      const game = await createHeadlessGame({ missionId: 'm5', sectionId: 'c', seed: 1, god: true, bot: true, players: o.players, characterId: o.char });
      try {
        const world = () => game.runner!.world;
        let ship: GrampsShip | null = null;
        for (let i = 0; i < 20000 && !game.missionComplete; i++) {
          game.step(1);
          const boss = world().entities.find((e) => (e.type === 'organ-console' || e.type === 'maestro') && e.alive) as { kill?: (o?: number) => void; state?: string } | undefined;
          if (boss && typeof boss.kill === 'function' && boss.state === 'fight') boss.kill(0);
          ship ??= (world().entities.find((e) => e.type === 'm5-gramps-ship') as GrampsShip | undefined) ?? null;
        }
        expect(game.missionComplete).toBe(true);
        expect(ship).not.toBeNull();
        expect(ship!.pilot).toBe(o.pilot);
        // Every player rode out in the ship (none was left on the floor).
        expect(ship!.passengers.length).toBe(o.players);
        for (const p of game.runner!.players) expect(p.state).toBe('mounted');
        expect(ship!.mode).toBe('leave');
        expect(game.report().errors).toEqual([]);
      } finally {
        game.dispose();
      }
    }
  }, 90000);

  it('m5-c finale: the auto-run hops the wreck blocks and boards without help (no patience timeout)', async () => {
    const game = await createHeadlessGame({ missionId: 'm5', sectionId: 'c', seed: 2, god: true, bot: false });
    try {
      const world = () => game.runner!.world;
      let ship: GrampsShip | null = null;
      let hoverTicks = 0;
      for (let i = 0; i < 20000 && !game.missionComplete; i++) {
        game.step(1);
        const boss = world().entities.find((e) => (e.type === 'organ-console' || e.type === 'maestro') && e.alive) as { kill?: (o?: number) => void; state?: string } | undefined;
        if (boss && typeof boss.kill === 'function' && boss.state === 'fight') boss.kill(0);
        ship ??= (world().entities.find((e) => e.type === 'm5-gramps-ship') as GrampsShip | undefined) ?? null;
        if (ship && ship.mode === 'hover' && ship.passengers.length === 0) hoverTicks++;
      }
      expect(game.missionComplete).toBe(true);
      expect(ship!.passengers.length).toBe(1);
      // The idle player (x 48, left of all three wreck blocks) ran and jumped in well
      // before the script's patience (300 ticks) would have seated him.
      expect(hoverTicks).toBeLessThan(200);
    } finally {
      game.dispose();
    }
  }, 60000);
});

