/**
 * Mission m1 — BRASS ON THE RIVERBANK: registration, section layouts and routes (GDD §11.1), every
 * section's script in god mode (no errors, no placeholder entities except a missing boss) and the
 * mission-local entities (drum-mine chain, mk1-head gag, drain hatch).
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import { Terrain } from '../../src/engine/terrain';
import { loadContent } from '../../src/game/content/index';
import { M1 } from '../../src/game/content/missions/m1/index';
import { DrumMine, M1Hatch, Mk1Head } from '../../src/game/content/missions/m1/entities';
import { MINES, PADS } from '../../src/game/content/missions/m1/section-c';
import { getMission } from '../../src/game/registry';
import { createHeadlessGame } from '../../src/sim/index';
import { FLOOR, TestWorld } from './helpers';

await loadContent();

describe('mission m1', () => {
  it('is registered with sections a, b1, b2, c, the boss section and the songs', () => {
    expect(getMission('m1')).toBe(M1);
    expect(Object.keys(M1.sections).sort()).toEqual(['a', 'b1', 'b2', 'c']);
    expect(M1.start).toBe('a');
    expect(M1.bossSection).toBe('c');
    expect(M1.music).toBe('m1');
    expect(M1.bossMusic).toBe('boss');
    // 10 hostages per route: a 4, b1 / b2 3, c 3.
    expect(M1.hostages).toEqual({ a: 4, b1: 3, b2: 3, c: 3 });
  });

  it.each(Object.keys(M1.sections))('section %s builds with a valid layout', (id) => {
    const s = M1.sections[id];
    expect(s.id).toBe(id);
    expect(s.height).toBe(216);
    const t = new Terrain(s.terrain);
    expect(t.surfaceY(s.playerStart.x, s.playerStart.y - 4, s.playerStart.y + 4)).toBe(s.playerStart.y);
    for (const ex of s.exits ?? []) {
      expect(ex.to in M1.sections, `${id} → ${ex.to}`).toBe(true);
      expect(ex.rect.x).toBeGreaterThanOrEqual(0);
      expect(ex.rect.x + ex.rect.w).toBeLessThanOrEqual(s.width);
    }
    // A checkpoint about every 1,200 px (GDD §11.0; m1-a has its first at 1400).
    const cps = [0, ...(s.checkpoints ?? []), s.width - 384];
    for (let i = 1; i < cps.length; i++) expect(cps[i] - cps[i - 1]).toBeLessThanOrEqual(1400);
  });

  it('exits lead where the GDD says (a → b1 / b2, both → c; c ends with the boss)', () => {
    const a = M1.sections.a.exits ?? [];
    expect(a.map((e) => e.to).sort()).toEqual(['b1', 'b2']);
    expect(a.every((e) => e.disabled)).toBe(true);
    const up = a.find((e) => e.to === 'b1')!;
    const down = a.find((e) => e.to === 'b2')!;
    expect(up.rect).toEqual({ x: 2520, y: 40, w: 40, h: 60 });
    expect(down.rect).toEqual({ x: 2364, y: 196, w: 32, h: 52 });
    // The drain exit is a drop-in hole: a gap in the street.
    expect(new Terrain(M1.sections.a.terrain).groundY(2380)).toBe(Infinity);
    expect(M1.sections.b1.exits?.map((e) => e.to)).toEqual(['c']);
    expect(M1.sections.b2.exits?.map((e) => e.to)).toEqual(['c']);
    expect(M1.sections.c.exits ?? []).toEqual([]);
    expect(M1.sections.c.vehicles).toEqual(['swan']);
  });

  it('m1-c: the river has no pits and its on-foot path has no gap wider than 48 px', () => {
    const c = M1.sections.c;
    const t = new Terrain(c.terrain);
    expect(c.terrain.hazards.every((h) => h.kind === 'water')).toBe(true);
    // Standing spans along the river: slipway end, pads, jetties, islands, the box ladder, the duck range, pontoon.
    const spans: [number, number][] = [[0, 900], ...PADS.map((x): [number, number] => [x, x + 24]), [980, 1120], [1160, 1300], [1380, 1500], [1790, 1960], [2100, 2300], [2424, 2536], [2616, 2840]];
    spans.sort((p, q) => p[0] - q[0]);
    let reach = spans[0][1];
    for (const [x0, x1] of spans.slice(1)) {
      expect(x0 - reach, `gap before ${x0}`).toBeLessThanOrEqual(48);
      reach = Math.max(reach, x1);
    }
    expect(t.groundY(899)).toBeCloseTo(200, 0);
    // The mines stay ≥ 17 px from the pad edges (pad 2380–2404 and 2560–2584).
    expect(MINES[0] - 9 - 2404).toBeGreaterThanOrEqual(17);
    expect(2560 - (MINES[MINES.length - 1] + 9)).toBeGreaterThanOrEqual(17);
  });
});

describe('m1 scripts in god mode', () => {
  it.each(['a', 'b1', 'b2', 'c'])('section %s runs its whole script without errors or unknown ids', async (id) => {
    const g = await createHeadlessGame({ missionId: 'm1', sectionId: id, seed: 3, players: 1, god: true, bot: true, captureConsole: true });
    const unknown = new Set<string>();
    const ids = new Set<string>();
    const off = g.world!.events.on('spawn', (e: { entity?: Entity } | Entity) => {
      const ent = (e as { entity?: Entity }).entity ?? (e as Entity);
      if (!ent || !ent.type) return;
      ids.add(ent.type);
      if (ent.hasTag('placeholder') && ent.type !== 'encore') unknown.add(ent.type);
    });
    g.step(1200);
    // Walk the camera through the rest of the section so every trigger fires.
    const w = M1.sections[id].width;
    for (let x = 400; x < w; x += 300) {
      g.teleport(x);
      g.step(60);
    }
    g.step(300);
    off();
    const r = g.report();
    expect(r.errors.map((e) => e.message)).toEqual([]);
    expect([...unknown]).toEqual([]);
    for (const t of ['rifleman', 'hostage']) if (id !== 'c' || t !== 'hostage') expect(ids.has(t), t).toBe(true);
    g.dispose();
  }, 60000);
});

describe('m1 routes', () => {
  it('after the Quay Gate fight a player who drops into the open drain lands in b2', async () => {
    const g = await createHeadlessGame({ missionId: 'm1', sectionId: 'a', seed: 1, players: 1, god: true, bot: false, captureConsole: true });
    for (let x = 400; x <= 2500; x += 300) {
      g.teleport(x);
      g.step(30);
    }
    g.teleport(2440);
    // Stand in for the players' guns: clear the Quay Gate.
    for (let i = 0; i < 40 && !g.runner!.isExitOpen('drain'); i++) {
      for (const e of [...g.world!.byTag('enemy')]) if (e.alive) g.world!.damage(e, { amount: 1000, kind: 'explosion', dirX: 1, owner: 0 });
      g.step(30);
    }
    expect(g.runner!.isExitOpen('drain')).toBe(true);
    expect(g.runner!.isExitOpen('rooftops')).toBe(true);
    g.teleport(2380);
    g.runUntil((gg) => gg.runner!.section.id === 'b2', 200);
    expect(g.runner!.section.id).toBe('b2');
    g.dispose();
  }, 60000);

  it.each([['upper', ['a', 'b1', 'c']], ['lower', ['a', 'b2', 'c']]] as const)('the bot reaches c on its own (%s route)', async (route, path) => {
    // Integration fixes: the drain is a shallow shaft with a floor (the bot walks into it instead of
    // jumping the hole) and the [N] overflow-chamber metronome hangs where a straight-up shot from
    // the chamber's left half reaches it.
    const g = await createHeadlessGame({ missionId: 'm1', sectionId: 'a', seed: 2, players: 1, god: true, bot: { route }, captureConsole: true });
    g.runUntil((gg) => gg.runner!.section.id === 'c', 12000);
    expect(g.report().sectionsVisited).toEqual(path);
    expect(g.report().errors).toEqual([]);
    g.dispose();
  }, 60000);

  it('the drain exit sits low in the hole, over a hidden floor below the view', async () => {
    const a = M1.sections.a;
    const drain = (a.exits ?? []).find((e) => e.id === 'drain')!;
    expect(drain.rect.x).toBe(2364);
    expect(drain.rect.y + 8).toBeGreaterThan(176 + 24); // the bot aims 8 px into the rect: well below the street
    expect(drain.rect.y + drain.rect.h).toBeLessThanOrEqual(216 + 32); // above killY
    const g = await createHeadlessGame({ missionId: 'm1', sectionId: 'a', seed: 1, players: 1, god: true, bot: false, captureConsole: true });
    g.step(2);
    // Below the view (not seen; > 64 px under the street, so the hole still reads as a gap to
    // cross) and above killY: a walk-off into the open drain has a landing to plan for.
    const floor = g.world!.solids.find((s) => s.y > 216 && s.y < 248 && s.x <= 2364 && s.x + s.w >= 2396);
    expect(floor).toBeDefined();
    expect(floor!.y - 176).toBeGreaterThan(64);
    expect(floor!.y).toBeLessThan(drain.rect.y + drain.rect.h); // feet on it are inside the exit
    g.dispose();
  });
});

describe('m1 mission-local entities', () => {
  it('drum-mine: one shot sets off the whole barrage, 6 ticks apart, owned by the shooter', () => {
    const tw = new TestWorld({ god: true, playerX: 60 });
    const mines = MINES.map((x) => tw.spawn('drum-mine', x - 2200, {}, FLOOR) as DrumMine);
    tw.run(2);
    tw.world.damage(mines[0], { amount: 10, kind: 'bullet', dirX: 1, owner: 0 });
    tw.run(2);
    expect(mines[0].alive).toBe(false);
    expect(mines[4].alive).toBe(true);
    tw.run(40);
    expect(mines.every((m) => !m.alive)).toBe(true);
    const chain = mines[0].chain!;
    expect(chain.byShot).toBe(true);
    expect(chain.count).toBe(5);
    expect(mines.every((m) => m.chain === chain)).toBe(true);
  });

  it('drum-mine: a player walking into it sets it off (enemy shots pass through)', () => {
    const tw = new TestWorld({ god: false, playerX: 200 });
    const mine = tw.spawn('drum-mine', 230, {}, FLOOR) as DrumMine;
    tw.run(2);
    expect(mine.hasTag('shootable')).toBe(true);
    expect(mine.team).toBe('enemy');
    tw.hold('right').run(30);
    expect(mine.alive).toBe(false);
    expect(mine.chain?.byShot).toBe(false);
  });

  it('mk1-head: three hits (or one stomp) and it honks and floats up a bomb pickup', () => {
    const tw = new TestWorld({ god: true, playerX: 60 });
    const head = tw.spawn('mk1-head', 300, {}, FLOOR) as Mk1Head;
    tw.run(2);
    for (let i = 0; i < 3; i++) tw.world.damage(head, { amount: 10, kind: 'bullet', dirX: 1, owner: 0 });
    expect(head.mode).toBe('surface');
    tw.run(30);
    expect(tw.ofType('pickup-bombs').length).toBe(1);
    const head2 = tw.spawn('mk1-head', 500, {}, FLOOR) as Mk1Head;
    tw.run(2);
    tw.world.damage(head2, { amount: 100, kind: 'crush', dirX: 1, owner: 0 });
    expect(head2.mode).toBe('surface');
  });

  it('m1-hatch blocks the drain until it opens', () => {
    const tw = new TestWorld({ god: true, playerX: 60, noFloor: true, build: (t) => t.ground().at(0, FLOOR).flat(300).gap(32).flat(300) });
    const hatch = tw.spawn('m1-hatch', 300, { w: 32 }, FLOOR) as M1Hatch;
    tw.run(2);
    expect(tw.world.terrain.groundY(316)).toBe(Infinity);
    tw.player!.placeAt(316, FLOOR - 20, 0);
    tw.run(40);
    expect(tw.player!.y).toBeCloseTo(FLOOR, 0);
    hatch.open();
    tw.run(40);
    expect(tw.player!.y).toBeGreaterThan(FLOOR + 10);
  });
});
