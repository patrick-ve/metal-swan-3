/**
 * Mission ams — the route split and the canal cruise (docs/design/ams-extras.md §3–§5):
 *
 * - c ends with the parking scan car in a locked arena (`C_ARENA`); after it both exits open:
 *   BRUG ↑ (`brug` → c1) and RONDVAART ↓ (`rondvaart` → c2). The bot takes c1 with the route
 *   `upper` and c2 with `lower`; both routes reach d.
 * - Hostages: the same total on both routes; every section's tourists (visible plus the hidden
 *   ones of its secrets) match `MissionDef.hostages`.
 * - Secrets: at least one per section, at least 6, exactly one hides the 1UP.
 * - The cruise (c2): the boat holds the camera and stops for its waves; a low bridge never kills a
 *   standing roof rider before it has been in view `LOW_BRIDGE.warn` ticks; a crouching rider
 *   passes under it.
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import { loadContent } from '../../src/game/content/index';
import { AmsCruiseBoat, AmsLowBridge, CRUISE, LOW_BRIDGE } from '../../src/game/content/missions/ams/cruise';
import { AMS } from '../../src/game/content/missions/ams/index';
import { AMS_SECRETS, AmsSecret, HIDDEN_TOURISTS, secretArt } from '../../src/game/content/missions/ams/secrets';
import { C_ARENA } from '../../src/game/content/missions/ams/terrain';
import { Boss } from '../../src/game/boss';
import { buttonMask } from '../../src/engine/input';
import { createHeadlessGame } from '../../src/sim/index';
import { FLOOR, TestWorld } from './helpers';

await loadContent();

describe('ams route split: layout', () => {
  it('c opens BRUG ↑ (c1) and RONDVAART ↓ (c2); both lead on to d', () => {
    const c = AMS.sections.c;
    expect(Object.fromEntries((c.exits ?? []).map((e) => [e.id, e.to]))).toEqual({ brug: 'c1', rondvaart: 'c2' });
    expect(c.exits?.every((e) => e.disabled)).toBe(true);
    expect(AMS.sections.c1.exits?.map((e) => e.to)).toEqual(['d']);
    expect(AMS.sections.c2.exits?.map((e) => e.to)).toEqual(['d']);
    // The beer bike never goes on the water; the Swan swims alongside the cruise.
    expect(AMS.sections.c2.vehicles).toEqual(['swan']);
  });

  it('the same hostage total on both routes; the hidden tourists count', () => {
    const h = AMS.hostages ?? {};
    const base = (h.a ?? 0) + (h.b ?? 0) + (h.c ?? 0);
    expect(base + (h.c1 ?? 0)).toBe(base + (h.c2 ?? 0));
    expect(HIDDEN_TOURISTS.a + HIDDEN_TOURISTS.b).toBeGreaterThanOrEqual(2);
  });

  it('secrets: one or more per section, at least 6, exactly one hidden 1UP', () => {
    for (const id of Object.keys(AMS.sections)) expect(AMS_SECRETS[id]?.length ?? 0, id).toBeGreaterThan(0);
    const all = Object.values(AMS_SECRETS).flat();
    expect(all.length).toBeGreaterThanOrEqual(6);
    expect(all.filter((s) => s.hides === '1up').length).toBe(1);
    // Every section lists its secrets' art for the tier-4 working set.
    for (const id of Object.keys(AMS.sections)) for (const a of secretArt(id)) expect(AMS.sections[id].art, `${id} ${a}`).toContain(a);
  });
});

/** Run a section with the bot (god) until it changes; the hostages it spawned and the sections seen. */
async function runSection(id: string, route: 'upper' | 'lower', seed = 2): Promise<{ seen: string[]; hostages: number; hidden: number; locked: boolean; scanBeaten: boolean }> {
  const g = await createHeadlessGame({ missionId: 'ams', sectionId: id, seed, players: 1, god: true, bot: { route }, captureConsole: true });
  const seen: string[] = [id];
  let hostages = 0;
  let hidden = 0;
  let locked = false;
  let scan: Entity | null = null;
  const watch = (): (() => void) =>
    g.world!.events.on('spawn', (e: { entity?: Entity } | Entity) => {
      const ent = (e as { entity?: Entity }).entity ?? (e as Entity);
      if (ent?.type === 'hostage') hostages++;
      if (ent?.type === 'ams-scan-car') scan = ent;
    });
  let off = watch();
  let world = g.world;
  for (let t = 0; t < 30000 && !g.done; t += 30) {
    g.step(30);
    const cam = g.world?.camera;
    // Hidden tourists still in their secret (a revealed one spawned as a hostage).
    if (g.runner?.section.id === id) hidden = (g.world?.entities ?? []).filter((e) => e instanceof AmsSecret && !e.removed && !e.revealed && e.hides === 'hostage').length;
    if (g.runner?.section.id === 'c' && cam?.locked && cam.left >= C_ARENA[0] - 1 && cam.left <= C_ARENA[0] + 1) locked = true;
    const s = g.runner?.section.id;
    if (s && s !== seen[seen.length - 1]) {
      seen.push(s);
      break;
    }
    if (g.world !== world && g.world) {
      off();
      world = g.world;
      off = watch();
    }
  }
  off();
  expect(g.report().errors.map((e) => e.message)).toEqual([]);
  const beaten = scan !== null && (scan as Entity) instanceof Boss && (scan as unknown as Boss).defeated;
  g.dispose();
  return { seen, hostages, hidden, locked, scanBeaten: beaten };
}

describe('ams route split: the bot plays both routes', () => {
  it('c: the scan car fight locks the arena; the bot beats it and takes RONDVAART (lower) to c2', async () => {
    const r = await runSection('c', 'lower');
    expect(r.locked).toBe(true);
    expect(r.scanBeaten).toBe(true);
    expect(r.seen).toEqual(['c', 'c2']);
  }, 120000);

  it('c: a player who runs ahead of the quay squad stays in the arena view; the scan car parks inside it', async () => {
    // No bot: the player holds RIGHT (fire tapped) from the shop quay past the arena, then LEFT.
    const g = await createHeadlessGame({ missionId: 'ams', sectionId: 'c', seed: 1, god: true, bot: false, captureConsole: true, input: (t) => (t < 820 ? buttonMask('right') : buttonMask('left')) | (t % 2 === 0 ? buttonMask('fire') : 0) });
    g.step(1);
    g.teleport(1450);
    let maxX = 0;
    let checked = 0;
    for (let t = 0; t < 1400; t++) {
      g.step(1);
      const w = g.world!;
      const p = g.player(0)!;
      maxX = Math.max(maxX, p.x);
      const car = w.byTag('scan-car')[0] as Boss | undefined;
      if (car && car.state === 'fight') {
        // The car parks inside the locked view; the hero is in it too.
        expect(car.x, `t ${t}`).toBeGreaterThan(C_ARENA[0] + 40);
        expect(car.x, `t ${t}`).toBeLessThan(C_ARENA[1] - 40);
        if (w.camera.left >= C_ARENA[0] - 1) {
          expect(p.x).toBeGreaterThanOrEqual(w.camera.left);
          expect(p.x).toBeLessThanOrEqual(w.camera.right);
          checked++;
        }
      }
    }
    expect(maxX).toBeLessThanOrEqual(C_ARENA[1]);
    expect(checked).toBeGreaterThan(100);
    expect(g.report().errors.map((e) => e.message)).toEqual([]);
    g.dispose();
  }, 120000);

  it.each([4, 7])('a, normal, seed %i: the bot leaves the beer-bike lock (off the awning to the riders\' floor)', async (seed) => {
    const g = await createHeadlessGame({ missionId: 'ams', sectionId: 'a', seed, players: 1, god: false, bot: { route: 'lower' }, difficulty: 'normal', captureConsole: true });
    let reached = false;
    for (let t = 0; t < 20000 && !g.done; t += 60) {
      g.step(60);
      if (g.runner?.section.id === 'b') {
        reached = true;
        break;
      }
    }
    expect(reached).toBe(true);
    expect(g.report().timeouts).toBe(0);
    g.dispose();
  }, 120000);

  it('c: with the route upper the bot takes BRUG ↑ to c1', async () => {
    const r = await runSection('c', 'upper');
    expect(r.seen).toEqual(['c', 'c1']);
  }, 120000);

  it.each(['c1', 'c2'])('%s leads to d', async (id) => {
    const r = await runSection(id, 'lower');
    expect(r.seen).toEqual([id, 'd']);
  }, 120000);

  it('every section spawns its hostages: the visible ones plus the hidden tourists = MissionDef.hostages', async () => {
    for (const id of ['a', 'b', 'c', 'c1', 'c2']) {
      const r = await runSection(id, 'lower');
      // The bot does not look for secrets (a stray shot may reveal one: its tourist then spawns).
      expect(r.hostages + r.hidden, id).toBe(AMS.hostages?.[id]);
    }
  }, 240000);
});

describe('ams route split: the cruise', () => {
  it('c2: the boat holds the camera while it sails and stops for its waves', async () => {
    const g = await createHeadlessGame({ missionId: 'ams', sectionId: 'c2', seed: 1, players: 1, god: true, bot: true, captureConsole: true });
    let stops = 0;
    let was = '';
    let held = 0;
    let off = 0;
    for (let t = 0; t < 30000 && g.runner?.section.id === 'c2'; t++) {
      g.step(1);
      const boat = g.world?.byTag('cruise-boat')[0] as AmsCruiseBoat | undefined;
      if (!boat) continue;
      if (boat.state === 'stopped' && was !== 'stopped') stops++;
      was = boat.state;
      if (boat.leads && boat.state === 'sailing') {
        held++;
        if (Math.abs(g.world!.camera.left - (boat.fx - CRUISE.sternVx)) > 1) off++;
      }
    }
    expect(g.runner?.section.id).toBe('d');
    expect(stops).toBeGreaterThanOrEqual(4);
    expect(held).toBeGreaterThan(600);
    expect(off).toBe(0);
    expect(g.report().errors).toEqual([]);
    g.dispose();
  }, 120000);

  /** A test world: the cruise boat sailing on, a player on its glass roof, a low bridge ahead. */
  function cruise(crouch: boolean): { tw: TestWorld; bridge: AmsLowBridge } {
    const tw = new TestWorld({ playerX: 120, god: false, seed: 3, width: 2400 });
    const boat = tw.spawn('ams-cruise-boat', 40, {}, FLOOR) as AmsCruiseBoat;
    const p = tw.player!;
    p.placeAt(boat.fx + 100, boat.roofY, 0);
    if (crouch) tw.hold('down');
    tw.run(2);
    boat.depart();
    boat.go();
    const bridge = tw.spawn('ams-low-bridge', 520, {}, LOW_BRIDGE.top) as AmsLowBridge;
    return { tw, bridge };
  }

  it('a low bridge kills a standing roof rider only after LOW_BRIDGE.warn ticks in view', () => {
    const { tw, bridge } = cruise(false);
    tw.until(() => bridge.kills > 0 || !tw.player!.alive, 1500);
    expect(bridge.kills).toBe(1);
    expect(Math.min(...bridge.killWarn)).toBeGreaterThanOrEqual(LOW_BRIDGE.warn);
  });

  it('a crouching roof rider passes under a low bridge', () => {
    const { tw, bridge } = cruise(true);
    const p = tw.player!;
    tw.until(() => p.x > bridge.x + bridge.w, 1500);
    expect(p.x).toBeGreaterThan(bridge.x + bridge.w);
    expect(bridge.kills).toBe(0);
    expect(p.alive).toBe(true);
  });
});
