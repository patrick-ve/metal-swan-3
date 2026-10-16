/**
 * Mission ams — THE FRYING DUTCHMAN (docs/design/amsterdam.md §6–§8): registration and campaign
 * place, section layouts, exits a → b → c → d → complete, every section script in god mode with
 * the bot (no errors, no placeholder ids), THE BRIEFING (input lock incl. a player 2 who joins
 * mid-briefing, timer pause / resume, the toss), the vendor and the Swan in b, and the boss
 * section ending in MISSION COMPLETE well inside the section timer.
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import { measure } from '../../src/engine/font';
import { PAL } from '../../src/engine/palette';
import { getFrames } from '../../src/engine/sprites';
import { Terrain } from '../../src/engine/terrain';
import { loadContent } from '../../src/game/content/index';
import { AMS } from '../../src/game/content/missions/ams/index';
import { AmsBaker } from '../../src/game/content/missions/ams/entities';
import { BRIEFING, CLEAR_DIST, COUNTER_X, LINE_TICKS, briefing } from '../../src/game/content/missions/ams/section-a';
import { B_VENDOR, SWAN_X } from '../../src/game/content/missions/ams/section-b';
import type { SectionContext } from '../../src/game/mission/index';
import type { Player } from '../../src/game/player/player';
import { getMission, hasEntity } from '../../src/game/registry';
import { firstMission } from '../../src/game/scenes/gameplay';
import { CAMPAIGN_MISSIONS, missionCard } from '../../src/game/scenes/flow-data';
import { FxEntity } from '../../src/game/fx';
import { Projectile } from '../../src/game/projectile';
import { createHeadlessGame } from '../../src/sim/index';

await loadContent();

describe('mission ams', () => {
  it('is registered, comes first in the campaign and leads to m1', () => {
    expect(getMission('ams')).toBe(AMS);
    expect(firstMission()).toBe('ams');
    expect(CAMPAIGN_MISSIONS[0]).toBe('ams');
    expect(Object.keys(AMS.sections).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(AMS.start).toBe('a');
    expect(AMS.bossSection).toBe('d');
    expect(AMS.next).toBe('m1');
    // After the boss: the glitch bridge into the first-person mode (docs/design/fps.md §1.1).
    expect(AMS.after).toBe('fps');
    expect(AMS.music).toBe('ams');
    expect(AMS.bossMusic).toBe('ams-boss');
    expect(AMS.hostages).toEqual({ a: 4, b: 3, c: 3 });
    const card = missionCard('ams');
    expect(card.label).toBe('MISSION 1');
    expect(card.name).toBe('THE FRYING DUTCHMAN');
    expect(card.map?.dot[1]).toBeGreaterThan(54);
    expect(card.map?.dot[1]).toBeLessThan(120);
  });

  it.each(['a', 'b', 'c', 'd'])('section %s builds with a valid layout', (id) => {
    const s = AMS.sections[id];
    expect(s.id).toBe(id);
    expect(s.height).toBe(216);
    const t = new Terrain(s.terrain);
    expect(t.surfaceY(s.playerStart.x, s.playerStart.y - 4, s.playerStart.y + 4)).toBe(s.playerStart.y);
    const cps = [0, ...(s.checkpoints ?? []), s.width - 384];
    for (let i = 1; i < cps.length; i++) expect(Math.abs(cps[i] - cps[i - 1]), `${id} checkpoint ${i}`).toBeLessThanOrEqual(1400);
    for (const ex of s.exits ?? []) {
      expect(ex.rect.x).toBeGreaterThanOrEqual(0);
      expect(ex.rect.x + ex.rect.w).toBeLessThanOrEqual(s.width);
    }
  });

  it('exits lead a → b → c → d (opened by the scripts); d ends with the boss', () => {
    expect(AMS.sections.a.exits?.map((e) => e.to)).toEqual(['b']);
    expect(AMS.sections.b.exits?.map((e) => e.to)).toEqual(['c']);
    expect(AMS.sections.c.exits?.map((e) => e.to)).toEqual(['d']);
    for (const id of ['a', 'b', 'c']) expect(AMS.sections[id].exits?.every((e) => e.disabled)).toBe(true);
    expect(AMS.sections.d.exits ?? []).toEqual([]);
    expect(AMS.sections.d.bossStart).toBeDefined();
    expect(AMS.sections.c.vehicles).toEqual(['swan']);
    expect(AMS.sections.d.vehicles).toEqual(['swan']);
  });
});

/** Every id the ams section scripts spawn (crates, hostages, pickups and the enemies and props). */
const SCRIPT_IDS = [
  'ams-baker', 'ams-bike-rack', 'ams-boat-platform', 'ams-cyclist-bg', 'ams-herring-cart', 'ams-hotdog-vendor', 'ams-market-stall',
  'ams-mayor', 'ams-pigeons', 'ams-staff', 'ams-tour-boat', 'ams-tulip-stall', 'ams-window-waver', 'delivery-rider', 'fatbike-youth',
  'handhaver', 'pickup-gem', 'pickup-weapon', 'seagull', 'swan', 'crate', 'hostage',
];

describe('ams scripts in god mode', () => {
  it.each(['a', 'b', 'c', 'd'])('section %s runs its whole script with the bot: no errors, only registered ids', async (id) => {
    const g = await createHeadlessGame({ missionId: 'ams', sectionId: id, seed: 3, players: 1, god: true, bot: true, captureConsole: true });
    const ids = new Set<string>();
    const placeholders = new Set<string>();
    let world = g.world;
    const watch = (): (() => void) =>
      g.world!.events.on('spawn', (e: { entity?: Entity } | Entity) => {
        const ent = (e as { entity?: Entity }).entity ?? (e as Entity);
        if (!ent || !ent.type) return;
        if (!(ent instanceof Projectile) && !(ent instanceof FxEntity)) ids.add(ent.type);
        if (ent.hasTag('placeholder')) placeholders.add(ent.type);
      });
    let off = watch();
    const start = g.runner!.section.id;
    for (let t = 0; t < 30000 && !g.done && g.runner?.section.id === start; t += 60) {
      g.step(60);
      if (g.world !== world && g.world) {
        off();
        world = g.world;
        off = watch();
      }
    }
    off();
    const r = g.report();
    expect(r.errors.map((e) => e.message)).toEqual([]);
    expect([...placeholders]).toEqual([]);
    for (const t of SCRIPT_IDS) expect(hasEntity(t), t).toBe(true);
    for (const t of ['fatbike-youth', 'delivery-rider', 'seagull']) expect(ids.has(t), t).toBe(true);
    // The section was finished: the next section (or MISSION COMPLETE for d).
    if (id === 'd') expect(g.missionComplete).toBe(true);
    else expect(g.runner?.section.id).toBe(String.fromCharCode(id.charCodeAt(0) + 1));
    g.dispose();
  }, 120000);

  it('the bot plays the whole mission a → b → c → d → MISSION COMPLETE', async () => {
    const g = await createHeadlessGame({ missionId: 'ams', sectionId: 'a', seed: 1, players: 1, god: true, bot: true, captureConsole: true });
    const seen: string[] = [];
    g.runUntil((gg) => {
      const s = gg.runner?.section.id;
      if (s && seen[seen.length - 1] !== s) seen.push(s);
      return gg.missionComplete;
    }, 60000);
    expect(seen).toEqual(['a', 'b', 'c', 'd']);
    expect(g.missionComplete).toBe(true);
    expect(g.report().errors).toEqual([]);
    g.dispose();
  }, 120000);

  it('the boss section: the bot (god) beats ROBO-HALSEMA well inside the section timer', async () => {
    const g = await createHeadlessGame({ missionId: 'ams', sectionId: 'd', seed: 2, players: 1, god: true, bot: true, captureConsole: true });
    g.runUntil((gg) => gg.missionComplete, 15000);
    expect(g.missionComplete).toBe(true);
    expect(g.report().timeouts).toBe(0);
    g.dispose();
  }, 120000);
});

describe('ams-a: THE BRIEFING', () => {
  it('locks the pads (also of a player 2 who joins), pauses the timer, tosses the fries, then restores both', async () => {
    const g = await createHeadlessGame({ missionId: 'ams', sectionId: 'a', seed: 1, players: 1, god: true, bot: false, captureConsole: true });
    g.step(2);
    // Only the briefing (the section script would lock the camera at the PLEINTJE behind us).
    g.world!.scripts.cancelAll();
    g.teleport(3300);
    const runner = g.runner!;
    const ctx = (runner as unknown as { ctx: SectionContext }).ctx;
    ctx.lockCamera(3200, 3584);
    const baker = g.world!.entities.find((e) => e.type === 'ams-baker');
    expect(baker).toBeInstanceOf(AmsBaker);
    expect(g.world!.entities.filter((e) => e.type === 'ams-baker').length).toBe(1);
    const p1 = g.player(0)!;
    const pad1 = p1.pad;
    let done = false;
    g.world!.scripts.run(function* test() {
      yield* briefing(ctx, baker!);
      done = true;
    });
    g.step(3);
    expect(p1.pad).not.toBe(pad1);
    expect(runner.timerRunning).toBe(false);
    // Player 2 joins mid-briefing: locked as well.
    g.step(200);
    const p2 = runner.joinPlayer(1, 'grace') as Player;
    const pad2 = p2.pad;
    g.step(2);
    expect(p2.pad).not.toBe(pad2);
    expect(done).toBe(false);
    g.runUntil(() => done, BRIEFING.length * LINE_TICKS + 1000);
    expect(done).toBe(true);
    expect(p1.pad).toBe(pad1);
    expect(p2.pad).toBe(pad2);
    expect(runner.timerRunning).toBe(true);
    expect((baker as AmsBaker).tossed).toBeGreaterThanOrEqual(1);
    g.dispose();
  }, 60000);

  it('players in the counter step aside (2P: one each side) and each catches their own fries', async () => {
    const g = await createHeadlessGame({ missionId: 'ams', sectionId: 'a', seed: 1, players: 2, god: true, bot: false, captureConsole: true });
    g.step(2);
    g.world!.scripts.cancelAll();
    g.teleport(COUNTER_X);
    const runner = g.runner!;
    const ctx = (runner as unknown as { ctx: SectionContext }).ctx;
    ctx.lockCamera(3200, 3584);
    const baker = g.world!.entities.find((e) => e.type === 'ams-baker')!;
    const p1 = g.player(0)!;
    const p2 = g.player(1)!;
    g.step(30);
    let done = false;
    g.world!.scripts.run(function* test() {
      yield* briefing(ctx, baker);
      done = true;
    });
    g.step(150);
    // Nobody stands in the baker; player 1 left of the counter, player 2 right of it.
    expect(COUNTER_X - p1.x).toBeGreaterThanOrEqual(CLEAR_DIST - 2);
    expect(p2.x - COUNTER_X).toBeGreaterThanOrEqual(CLEAR_DIST - 2);
    g.runUntil(() => done, BRIEFING.length * LINE_TICKS + 1200);
    expect(done).toBe(true);
    g.step(120);
    expect(p1.weapon.id).toBe('flamethrower');
    expect(p2.weapon.id).toBe('flamethrower');
    g.dispose();
  }, 60000);

  it('every briefing line fits a hint bubble (≤ 24 characters, ≤ 2 lines)', () => {
    expect(BRIEFING.length).toBe(8);
    for (const l of BRIEFING) {
      const lines = l.split('\n');
      expect(lines.length).toBeLessThanOrEqual(2);
      for (const s of lines) expect(s.length).toBeLessThanOrEqual(24);
    }
  });
});

describe('ams-b: the hot-dog vendor and THE SWAN', () => {
  it('one vendor in his hatch and the Swan parked next to the stand', async () => {
    const g = await createHeadlessGame({ missionId: 'ams', sectionId: 'b', seed: 1, players: 1, god: true, bot: false, captureConsole: true });
    g.step(3);
    // The Swan parks just before she scrolls into view.
    expect(g.world!.entities.filter((e) => e.type === 'swan').length).toBe(0);
    g.teleport(SWAN_X - 300);
    g.step(30);
    const vendors = g.world!.entities.filter((e) => e.type === 'ams-hotdog-vendor');
    expect(vendors.length).toBe(1);
    expect(vendors[0].x).toBe(B_VENDOR.x);
    const swans = g.world!.entities.filter((e) => e.type === 'swan');
    expect(swans.length).toBe(1);
    expect(Math.abs(swans[0].x - SWAN_X)).toBeLessThan(2);
    g.dispose();
  });

  it('meeting the Swan sets the campaign records m1-c reads', async () => {
    const g = await createHeadlessGame({ missionId: 'ams', sectionId: 'b', seed: 1, players: 1, god: true, bot: true, captureConsole: true });
    g.runUntil((gg) => gg.runner!.records.get('ams/swan-met', false), 6000);
    expect(g.runner!.records.get('ams/swan-met', false)).toBe(true);
    g.dispose();
  }, 60000);
});

describe('ams decor lettering', () => {
  it('STADHUIS on the Stopera sits on a plain dark plaque (only letter white and plaque ink)', () => {
    const f = getFrames('decor/ams/stopera')[0];
    const w = measure('STADHUIS');
    // Text box: centred on x 294, top 168 − 117 (art.ts stopera()), 7 px caps.
    const colors = new Set<number>();
    for (let y = 51; y < 58; y++) for (let x = 294 - (w >> 1); x < 294 - (w >> 1) + w; x++) colors.add(f.buf.get(x, y));
    expect([...colors].sort()).toEqual([PAL.ink[1], PAL.snow[3]].sort());
  });
});
