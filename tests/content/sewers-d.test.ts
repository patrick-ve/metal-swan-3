/**
 * sewers-d HET RIOOL (docs/design/sewers.md §2.4, §5.4, L7, L8; wave P1b D): the section builds
 * (the plinths, the decor stand-ins, the checkpoints), THE FATBERG (`sewers-fatberg`: a
 * breakable-wall, hp 1,200, fire ×2, the crack stages at 75 / 50 / 25 / 0 %, 4 runners and 1
 * spitter out of its rat holes at each of the first three, the slump opens the way), the small
 * secret one (hp 150, not solid, tagged secret, reveals the golden record), the script in god mode
 * to its exit (1P and 2P: the lock opens, the worker is freed and gives the flamethrower, no
 * softlock), and ALL GOLDEN RECORDS: the record in d is reachable and counts on the route.
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import { getFrames, listSprites } from '../../src/engine/sprites';
import { Terrain } from '../../src/engine/terrain';
import { loadContent, isSewersContent } from '../../src/game/content/index';
import { D_DECOR } from '../../src/game/content/missions/sewers/d-kit';
import { isSewersSpriteId } from '../../src/game/content/missions/sewers/ids';
import { D_SCRIPT, D_TAG, dFatberg } from '../../src/game/content/missions/sewers/section-d';
import { G, SEWERS_D } from '../../src/game/content/missions/sewers/terrain';
import { LEAPER, PLINTH } from '../../src/game/content/sewers/rats/index';
import { FATBERG, FATBERG_ART, FATBERG_SIZE, Fatberg } from '../../src/game/content/sewers/set-pieces/fatberg';
import { BreakableWall } from '../../src/game/content/props/breakables';
import { newCampaign } from '../../src/game/app';
import { getMission } from '../../src/game/registry';
import { FPS_ROUTE, goldenRecordRoute } from '../../src/game/scenes/flow-data';
import { createHeadlessGame, type HeadlessGame } from '../../src/sim/index';
import { TestWorld } from './helpers';

await loadContent();
await loadContent(isSewersContent);
const SEC = getMission('sewers')!.sections['sewers-d'];

/** A flat arena with a big fatberg at 600 (rats out of its holes unless `rats: false`). */
function bergArena(params: Record<string, unknown> = {}): { tw: TestWorld; berg: Fatberg } {
  const tw = new TestWorld({ width: 1200, seed: 5, playerX: 200, god: true });
  const berg = tw.spawn('sewers-fatberg', 600, params) as Fatberg;
  return { tw, berg };
}

const bullet = (amount: number, owner = 0) => ({ amount, kind: 'bullet' as const, dirX: 1, owner });

describe('sewers-d: the section', () => {
  it('the spec layout: walkway y 176, the plinths (one-way, y 148) at 500/596, 800/896 and 1,560/1,656, checkpoints 1,300 and 2,300', () => {
    const t = new Terrain(SEC.terrain);
    for (let x = 4; x < SEC.width; x += 32) expect(t.surfaceY(x, 170, 182), `ground ${x}`).toBe(G);
    expect(SEWERS_D.plinthY).toBe(PLINTH.y);
    expect(SEWERS_D.plinthW).toBe(PLINTH.w);
    expect(SEWERS_D.plinthGap).toBe(PLINTH.gap);
    for (const x of [500, 596, 800, 896, 1560, 1656]) expect(t.surfaceY(x, 140, 160), `plinth ${x}`).toBe(148);
    expect(t.surfaceY(700, 140, 160)).toBe(Infinity);
    expect(SEC.checkpoints).toEqual([1300, 2300]);
    expect(SEWERS_D.pipes).toEqual([2000, 2150, 2300]);
    expect(SEWERS_D.lock).toEqual([2432, 2816]);
    expect(SEC.exits![0]).toMatchObject({ to: 'sewers-e', disabled: true });
    expect(SEC.exits![0].rect.x).toBe(2800);
  });

  it('the stand-in decor and the fatberg frames: sewers- ids, sizes as the play numbers', () => {
    const ids = [...listSprites(`${D_DECOR}/`), ...listSprites(`${FATBERG_ART}/`)];
    expect(ids.length).toBe(7);
    for (const id of ids) {
      expect(isSewersSpriteId(id), id).toBe(true);
      expect(getFrames(id).length, id).toBeGreaterThan(0);
    }
    expect(getFrames(`${FATBERG_ART}/big`).length).toBe(4);
    expect(getFrames(`${FATBERG_ART}/big-slump`).length).toBe(6);
    expect(getFrames(`${D_DECOR}/plinth`)[0].buf.w).toBe(PLINTH.w);
    for (const d of SEC.decor ?? []) expect(isSewersSpriteId(d.sprite), d.sprite).toBe(true);
    // The pipe stubs' mouths sit on the leaper's lurk point (x, 150).
    expect(LEAPER.pipeY).toBe(150);
  });
});

describe('sewers-d: THE FATBERG (spec §5.4)', () => {
  it('extends breakable-wall: a solid prop, hp 1,200, no enemy tag, blocks the walkway', () => {
    const { tw, berg } = bergArena();
    expect(berg).toBeInstanceOf(BreakableWall);
    expect(berg.maxHp).toBe(FATBERG.hp);
    expect(berg.hasTag('shootable') && berg.hasTag('prop') && berg.hasTag('wall')).toBe(true);
    expect(berg.hasTag('enemy')).toBe(false);
    expect(berg.box).not.toBeNull();
    expect(berg.w).toBe(FATBERG_SIZE.big.w);
    expect(berg.h).toBe(FATBERG_SIZE.big.h);
    // Taller than a jump (≈ 47 px): the heroes cannot get over it.
    expect(berg.h).toBeGreaterThan(80);
    // A hero walking right stops at its left face.
    const p = tw.player!;
    p.x = 520;
    tw.world.camera.snap();
    tw.hold('right').run(120);
    expect(p.x).toBeLessThanOrEqual(600 - FATBERG_SIZE.big.w / 2);
  });

  it('fire does double damage', () => {
    const a = bergArena({ rats: false });
    a.tw.world.damage(a.berg, { amount: 100, kind: 'fire', dirX: 1, owner: 0 });
    expect(a.berg.hp).toBe(FATBERG.hp - 200);
    const b = bergArena({ rats: false });
    b.tw.world.damage(b.berg, bullet(100));
    expect(b.berg.hp).toBe(FATBERG.hp - 100);
  });

  it('4 crack stages at 75 / 50 / 25 / 0 %; 4 runners + 1 spitter out of the holes at each of the first three; the slump opens the way', () => {
    const { tw, berg } = bergArena({ ratTag: 'berg-rats' });
    const rats = (): Entity[] => tw.world.entities.filter((e) => e.hasTag('berg-rats') && !e.removed);
    const stages: number[] = [];
    let total = 0;
    for (let i = 0; i < 4; i++) {
      tw.world.damage(berg, bullet(FATBERG.hp * 0.25));
      tw.world.flush();
      stages.push(berg.broken ? 4 : berg.stage);
      if (i < 3) {
        total += FATBERG.runners + FATBERG.spitters;
        const out = rats();
        expect(out.length, `stage ${i + 1}`).toBe(total);
        expect(out.filter((e) => e.type === 'sewers-rat-spitter').length).toBe(i + 1);
        // Out of the holes: left of the solid face, rising (the rise is their tell, 24 ticks).
        for (const r of out) expect(r.x).toBeLessThan(berg.x - berg.w / 2);
      }
      // P2: the rats leave their holes before the last hit (a rat still waiting at the slump never comes).
      if (i === 2) tw.run(80);
    }
    expect(stages).toEqual([1, 2, 3, 4]);
    expect(berg.broken).toBe(true);
    expect(berg.box).toBeNull();
    expect(tw.world.solids.some((b) => b.owner === berg)).toBe(false);
    expect(rats().length).toBe(15);
    // A slump with rats still waiting in the holes: those never rise (P2).
    const quick = bergArena({ ratTag: 'quick-rats' });
    for (let i = 0; i < 4; i++) {
      quick.tw.world.damage(quick.berg, bullet(FATBERG.hp * 0.25));
      quick.tw.world.flush();
    }
    expect(quick.tw.world.entities.filter((e) => e.hasTag('quick-rats') && !e.removed).length).toBe(0);
    // The rats come out and land on the walkway, left of the slick.
    tw.run(200);
    for (const r of rats()) if (r.alive) expect(r.y).toBe(176);
    // The way is open: the hero walks through.
    const p = tw.player!;
    p.x = 540;
    tw.world.camera.snap();
    for (const r of rats()) r.remove();
    tw.hold('right').run(120);
    expect(p.x).toBeGreaterThan(650);
  });

  it('the secret one sits above the standing shot line: straight shots pass under it, a jump-shot opens it', () => {
    const tw = new TestWorld({ width: 1200, seed: 5, playerX: 520, god: true });
    const s = tw.spawn('sewers-fatberg', 600, { small: true }, SEWERS_D.secretY) as Fatberg;
    tw.player!.facing = 1;
    for (let i = 0; i < 8; i++) tw.hold('fire').run(4).hold().run(4);
    expect(s.hp).toBe(FATBERG.smallHp);
    for (let i = 0; i < 12 && !s.broken; i++) tw.hold('jump').run(14).hold('jump', 'fire').run(4).hold().run(40);
    expect(s.hp).toBeLessThan(FATBERG.smallHp);
  });

  it('the small secret one: hp 150, not solid, tagged secret, reveals the golden record onto the floor', () => {
    const tw = new TestWorld({ width: 1200, seed: 5, playerX: 200, god: true });
    const s = tw.spawn('sewers-fatberg', 600, { small: true, reveal: { id: 'pickup-gem', params: { kind: 'golden-record' } } }, SEWERS_D.secretY) as Fatberg;
    expect(s.maxHp).toBe(FATBERG.smallHp);
    expect(s.box).toBeNull();
    expect(s.hasTag('secret')).toBe(true);
    // Its box (y 112–148) sits above a standing hero's shot line (stray fire passes under it) and
    // inside a jump-shot's reach (the hero's chest at the jump's peak, ~47 px up).
    expect(s.y).toBeLessThanOrEqual(150);
    expect(s.y).toBeGreaterThan(176 - 26 - 47);
    tw.world.damage(s, bullet(100));
    expect(s.broken).toBe(false);
    tw.world.damage(s, bullet(60));
    expect(s.broken).toBe(true);
    tw.world.flush();
    const rec = tw.ofType('pickup-gem');
    expect(rec.length).toBe(1);
    expect(tw.world.entities.filter((e) => e.hasTag('enemy')).length).toBe(0);
    tw.run(90);
    expect(rec[0].y).toBe(176);
  });
});

/** Run a headless game of sewers-d until it leaves the section; returns the ticks in d. */
function runD(g: HeadlessGame, max = 12000): { ticks: number; lockSeen: boolean; bergBroken: boolean; worker: boolean } {
  let lockSeen = false;
  let bergBroken = false;
  let t = 0;
  for (; t < max && !g.done && g.runner?.section.id === 'sewers-d'; t++) {
    g.step(1);
    const r = g.runner;
    if (!r || r.section.id !== 'sewers-d') break;
    const cam = r.world.camera;
    if (cam.x >= SEWERS_D.lock[0] && cam.x <= SEWERS_D.lock[0] + 1) lockSeen = true;
    const b = dFatberg(r);
    if (b?.broken) bergBroken = true;
  }
  const worker = (g.report().hostages ?? 0) >= 1;
  return { ticks: t, lockSeen, bergBroken, worker };
}

describe('sewers-d: the script', () => {
  it.each([1, 2] as const)('god mode, %iP: runs to the exit without errors; the lock holds until the fatberg slumps; the worker is freed', async (players) => {
    const g = await createHeadlessGame({ missionId: 'sewers', sectionId: 'sewers-d', seed: 7, players, god: true, bot: true, captureConsole: true, loadContent: false });
    try {
      const r = runD(g);
      expect(g.runner?.section.id).toBe('sewers-e');
      expect(r.lockSeen).toBe(true);
      expect(r.bergBroken).toBe(true);
      expect(r.worker).toBe(true);
      expect(r.ticks).toBeGreaterThan(2000);
      expect(r.ticks).toBeLessThan(9000);
      const rep = g.report();
      expect(rep.errors).toEqual([]);
      expect(rep.maxEntities).toBeLessThanOrEqual(300);
      // Every hero arrived in sewers-e (no one stuck behind in d).
      for (const p of g.runner!.world.players) if (p.alive) expect(p.x).toBeLessThan(400);
    } finally {
      g.dispose();
    }
  }, 120_000);

  it('the lock: the exit opens only after the fatberg slumped and its rats are gone', async () => {
    const g = await createHeadlessGame({ missionId: 'sewers', sectionId: 'sewers-d', seed: 3, players: 1, god: true, bot: true, loadContent: false });
    try {
      let bergAt = -1;
      let exitAt = -1;
      for (let t = 0; t < 12000 && g.runner?.section.id === 'sewers-d'; t++) {
        g.step(1);
        const r = g.runner;
        if (!r || r.section.id !== 'sewers-d') break;
        const b = dFatberg(r);
        if (bergAt < 0 && b?.broken) bergAt = t;
        // The way on opens (the camera unlocks) only once the fatberg's rats are gone too.
        if (exitAt < 0 && bergAt >= 0 && r.world.countAlive(D_TAG.berg) === 0) exitAt = t;
        if (bergAt < 0) {
          // Nobody passes the fatberg while it stands.
          for (const p of r.world.players) expect(p.x).toBeLessThan(SEWERS_D.fatbergX);
        }
      }
      expect(bergAt).toBeGreaterThan(0);
      expect(exitAt).toBeGreaterThanOrEqual(bergAt);
      expect(g.runner?.section.id).toBe('sewers-e');
    } finally {
      g.dispose();
    }
  }, 120_000);
});

describe('sewers-d: ALL GOLDEN RECORDS can be won on the route (L8)', () => {
  it('the record in the secret fatberg is reachable on the walkway and counts for the slot; sewers is on the record route', async () => {
    const g = await createHeadlessGame({ missionId: 'sewers', sectionId: 'sewers-d', seed: 7, players: 1, god: true, bot: true, loadContent: false });
    try {
      // The bot walks on (it never looks for secrets) until the secret is placed and in view.
      let secret: Fatberg | null = null;
      for (let t = 0; t < 6000 && !secret; t++) {
        g.step(1);
        const w = g.runner!.world;
        for (const e of w.byTag('secret')) if (e instanceof Fatberg && w.onScreen(e, 0)) secret = e;
      }
      expect(secret).not.toBeNull();
      const w = g.runner!.world;
      const p = w.players[0] as Entity & { slot: { mission: { goldenRecord: boolean } } };
      expect(p.slot.mission.goldenRecord).toBe(false);
      // A hero shoots it open (standing shots at chest height reach its box).
      w.damage(secret!, { amount: FATBERG.smallHp, kind: 'bullet', dirX: 1, owner: 0 });
      expect(secret!.broken).toBe(true);
      g.step(60);
      const rec = w.entities.find((e) => e.type === 'pickup-gem' && (e as Entity & { params?: { kind?: string } }).params?.kind === 'golden-record' && !e.removed);
      expect(rec).toBeDefined();
      // It lies on the walkway, inside the section, where a hero walks.
      expect(rec!.y).toBe(176);
      expect(rec!.x).toBeGreaterThan(SEWERS_D.secretX - 32);
      expect(rec!.x).toBeLessThan(SEWERS_D.secretX + 32);
      p.x = rec!.x;
      p.y = rec!.y;
      g.step(10);
      expect(p.slot.mission.goldenRecord).toBe(true);
    } finally {
      g.dispose();
    }
    const c = newCampaign();
    c.missions.push('ams', 'sewers');
    expect(goldenRecordRoute(c)).toBe(FPS_ROUTE);
    expect(goldenRecordRoute(c)).toContain('sewers');
    // The script places the secret with the record (D_SCRIPT keeps the worker and the crate on their spots).
    expect(D_SCRIPT.workerX).toBe(1700);
    expect(D_SCRIPT.crateX).toBe(2460);
  }, 120_000);
});
