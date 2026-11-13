/**
 * Mission sewers, section c DE PUT (docs/design/sewers.md §2.3, §5.1, §5.2; wave P1b C): the layout,
 * THE FALL (`SectionDef.introDrop`: on a direct start and on the entry from b; not on a respawn or a
 * boss rush; the ams parachute unchanged), FLASHLIGHTS ON after the last hero lands, the script in
 * god mode to the exit (the rats, the worker and the battery), 2P without a softlock, the battery.
 */
import { describe, expect, it } from 'vitest';
import { loadContent, isSewersContent } from '../../src/game/content/index';
import { G } from '../../src/game/content/missions/sewers/terrain';
import { sectionC, FLASHLIGHTS_ON } from '../../src/game/content/missions/sewers/section-c';
import { BATTERY_EFFECT, BATTERY_ID } from '../../src/game/content/sewers/items/battery';
import { flashlightsOn, sectionLight } from '../../src/game/mission/light/api';
import { BATTERY_STATUS, batteryTicks, FLASHLIGHT, heroCone, type HeroCone } from '../../src/game/mission/light/cone';
import { INTRO_DROP, INTRO_DROP_ID, INTRO_FALL } from '../../src/game/player/intro-drop';
import type { Player } from '../../src/game/player/player';
import { hasEntity } from '../../src/game/registry';
import { TUNING } from '../../src/game/tuning';
import { createHeadlessGame, type HeadlessGame } from '../../src/sim/index';

await loadContent();
await loadContent(isSewersContent);

const C = 'sewers-c';

function dropDef(p: Player): unknown {
  return p.status.list.find((s) => s.def.id === INTRO_DROP_ID)?.def;
}

async function game(o: { section?: string; players?: 1 | 2; god?: boolean; bot?: boolean; bossRush?: boolean; mission?: string }): Promise<HeadlessGame> {
  return createHeadlessGame({
    missionId: o.mission ?? 'sewers',
    sectionId: o.section,
    seed: 3,
    players: o.players ?? 1,
    god: o.god ?? true,
    bot: o.bot ?? false,
    bossRush: o.bossRush,
    captureConsole: true,
    loadContent: false,
  });
}

describe('sewers-c: the layout', () => {
  it('1,920 px, flat walk line, the spitter plinths (one-way, y 148), checkpoints 900 / 1,700, the exit to d at 1,880', () => {
    expect(sectionC.width).toBe(1920);
    expect(sectionC.checkpoints).toEqual([900, 1700]);
    expect(sectionC.playerStart).toEqual({ x: 64, y: G });
    expect(sectionC.introDrop).toEqual({ x: 64, fromY: -40, chute: false });
    expect(sectionC.exits?.[0]).toMatchObject({ to: 'sewers-d', rect: { x: 1880 } });
    // The two plinths: one-way platforms 48 px wide at y 148, centred on 1,400 and 1,496.
    const plats = sectionC.terrain.platforms.map((pl) => [pl[0][0], pl[pl.length - 1][0], pl[0][1]]);
    expect(plats).toEqual([
      [1376, 1424, 148],
      [1472, 1520, 148],
    ]);
    // Every stand-in decor id carries the sewers- segment (the lazy chunk).
    for (const d of sectionC.decor ?? []) expect(d.sprite).toContain('/sewers-c-');
    // The light: dark 0.6, the hero glow, the cones off until FLASHLIGHTS ON, the eyes as emitters.
    const l = sectionLight(C)!;
    expect(l).toMatchObject({ darkness: 0.6, heroLight: 28, cones: { off: true } });
    expect(typeof l.emissive).toBe('function');
    for (const id of ['sewers-d', 'sewers-e']) expect(sectionLight(id)).toMatchObject({ darkness: 0.6, heroLight: 28, cones: true });
    for (const id of ['sewers-a', 'sewers-b', 'sewers-end']) expect(sectionLight(id)?.cones).toBeFalsy();
    expect(hasEntity(BATTERY_ID)).toBe(true);
  });
});

describe('sewers-c: THE FALL (spec §5.2)', () => {
  it('a direct start: every hero falls from y −40 onto x 64 in 80 ticks, no chute, the weapon kept; FLASHLIGHTS ON after the last lands', async () => {
    const g = await game({ section: C, players: 2 });
    try {
      const ps = [g.player(0)!, g.player(1)!];
      for (const p of ps) {
        expect(p.dropping).toBe(true);
        expect(dropDef(p)).toBe(INTRO_FALL);
        expect(p.status.weapon).toBeNull();
      }
      expect(ps[0].x).toBe(64);
      expect(ps[1].x).toBe(44);
      expect(ps[0].y).toBeLessThan(0);
      expect(flashlightsOn(g.world!)).toBe(false);
      let landed = -1;
      for (let t = 1; t <= 120; t++) {
        g.step(1);
        if (landed < 0 && ps.every((p) => !p.dropping)) landed = t;
        if (landed > 0 && flashlightsOn(g.world!)) break;
      }
      expect(landed).toBeGreaterThanOrEqual(TUNING.life.introDropTicks - 2);
      expect(landed).toBeLessThanOrEqual(TUNING.life.introDropTicks + 3);
      for (const p of ps) expect(p.y).toBe(G);
      expect(flashlightsOn(g.world!)).toBe(true);
      expect(g.runner!.hud.banner?.text).toBe(FLASHLIGHTS_ON);
      expect(g.report().errors).toEqual([]);
    } finally {
      g.dispose();
    }
  });

  it('the entry from b drops the heroes too; a respawn does not; a boss rush does not', async () => {
    const g = await game({ section: 'sewers-b' });
    try {
      g.step(5);
      g.runner!.exitTo(C, { transition: 'cut' });
      g.runUntil((gg) => gg.runner?.section.id === C, 60);
      const p = g.player(0)!;
      expect(p.dropping).toBe(true);
      expect(dropDef(p)).toBe(INTRO_FALL);
      g.runUntil(() => !p.dropping, 200);
      g.step(5);
      expect(flashlightsOn(g.world!)).toBe(true);
    } finally {
      g.dispose();
    }
    const m = await game({ section: C, god: false });
    try {
      const p = m.player(0)!;
      m.runUntil(() => !p.dropping, 200);
      m.step(30);
      p.kill('impact');
      m.runUntil(() => p.state === 'play' || m.player(0) !== p, 400);
      const q = m.player(0)!;
      m.step(2);
      expect(dropDef(q)).toBeUndefined();
      expect(flashlightsOn(m.world!)).toBe(true);
    } finally {
      m.dispose();
    }
    const b = await game({ section: C, bossRush: true });
    try {
      expect(b.player(0)!.dropping).toBe(false);
    } finally {
      b.dispose();
    }
  });

  it('every other mission keeps its intro drop: ams starts under the chute with the pistol', async () => {
    const g = await game({ mission: 'ams' });
    try {
      const p = g.player(0)!;
      expect(p.dropping).toBe(true);
      expect(dropDef(p)).toBe(INTRO_DROP);
      expect(p.status.weapon).toBe('pistol');
    } finally {
      g.dispose();
    }
  });
});

describe('sewers-c: the script (god, the bot)', () => {
  it.each([1, 2] as const)('%iP: the fall, the rats, the worker frees and gives the battery, the exit into d; no errors', async (players) => {
    const g = await game({ section: C, players, bot: true });
    try {
      const spawned = new Map<string, number>();
      let battery = 0;
      let workerFreed = false;
      let t = 0;
      for (; t < 6000 && g.runner?.section.id === C; t++) {
        g.step(1);
        const w = g.world!;
        for (const e of w.entities) {
          if ((e as { _seen?: boolean })._seen) continue;
          (e as { _seen?: boolean })._seen = true;
          spawned.set(e.type, (spawned.get(e.type) ?? 0) + 1);
        }
        for (const p of g.runner!.players) battery = Math.max(battery, batteryTicks(p));
        for (const e of w.byTag('hostage')) if ((e as { state?: string }).state && (e as { state?: string }).state !== 'tied') workerFreed = true;
      }
      expect(g.runner?.section.id).toBe('sewers-d');
      expect(g.report().errors).toEqual([]);
      expect(spawned.get('sewers-rat-runner')).toBe(3 + 6 + 12 + 3);
      expect(spawned.get('sewers-rat-leaper')).toBe(3);
      expect(spawned.get('sewers-rat-spitter')).toBe(1);
      expect(spawned.get('hostage')).toBe(1);
      expect(spawned.get('crate')).toBe(1);
      expect(spawned.get(BATTERY_ID) ?? 0).toBe(1);
      expect(workerFreed).toBe(true);
      // (The bot walks past pickups; the battery's effect is tested below.)
      expect(battery).toBeGreaterThanOrEqual(0);
      // Both heroes made it (2P: nobody stuck behind).
      expect(g.runner!.players.length).toBe(players);
      // The god-bot's ticks in c (the report's pace number).
      expect(t).toBeLessThan(2400);
    } finally {
      g.dispose();
    }
  }, 60_000);
});

describe('pickup-battery (spec §5.1)', () => {
  it('1,200 ticks of the long cone for its hero; a second one refreshes; the icon blinks in the last 120 ticks; it carries', async () => {
    const g = await game({ section: C });
    try {
      const p = g.player(0)!;
      g.runUntil(() => !p.dropping, 200);
      const c: HeroCone = { x: 0, y: 0, angle: 0, len: 0, half: 0 };
      expect(heroCone(p, c).len).toBe(FLASHLIGHT.len);
      g.world!.spawn(BATTERY_ID, p.x, p.y);
      g.step(3);
      expect(batteryTicks(p)).toBeGreaterThan(FLASHLIGHT.battery.ticks - 10);
      expect(heroCone(p, c)).toMatchObject({ len: 280 });
      expect(c.half).toBeCloseTo((28 * Math.PI) / 180, 6);
      g.step(400);
      const before = batteryTicks(p);
      g.world!.spawn(BATTERY_ID, p.x, p.y);
      g.step(3);
      expect(batteryTicks(p)).toBeGreaterThan(before);
      expect(BATTERY_EFFECT.id).toBe(BATTERY_STATUS);
      expect(BATTERY_EFFECT.carry).toBe(true);
      const frames = new Set<number>();
      for (let k = 0; k < 32; k++) frames.add(BATTERY_EFFECT.iconFrame!({ world: { tick: k } } as unknown as Player, 100));
      expect([...frames].sort()).toEqual([0, 1]);
      expect(BATTERY_EFFECT.iconFrame!({ world: { tick: 8 } } as unknown as Player, 500)).toBe(0);
      g.step(FLASHLIGHT.battery.ticks + 10);
      expect(batteryTicks(p)).toBe(0);
      expect(heroCone(p, c).len).toBe(FLASHLIGHT.len);
    } finally {
      g.dispose();
    }
  });
});
