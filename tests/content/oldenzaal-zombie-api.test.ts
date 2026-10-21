/**
 * Mission oldenzaal, revision 2 — THE ZOMBIE API (src/game/content/oldenzaal/zombies/api.ts;
 * docs/api/oldenzaal.md "Revision 2"). The contract the section builders code against, run on
 * the placeholder implementation (ZOMBIES replaces the internals; these tests must stay green):
 * the four kinds and their ids, the five entrances with their tells (hidden = no hurt boxes,
 * a tell ≥ 18 ticks, never on top of a hero, no attack during the entrance), the opening
 * contract (`ZombieOpening`: tell → open, busy), the march column, stagger / blast, the frikandel
 * bridge, and a bloodless death (no soul, no townsperson).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { Entity } from '../../src/engine/entity';
import type { World } from '../../src/engine/world';
import { loadContent } from '../../src/game/content/index';
import { OLDENZAAL_ID, OZ_ZOMBIE_TAG, OZ_ZOMBIES } from '../../src/game/content/missions/oldenzaal/ids';
import { holyMayoBlast } from '../../src/game/content/oldenzaal/items/index';
import {
  ENTRANCE,
  MARCH,
  OZ_OPENING_TAG,
  ZOMBIE_ID,
  ZOMBIE_KINDS,
  isOpening,
  isZombie,
  marchColumn,
  spawnZombie,
  staggerZombiesInArea,
  zombieKindOf,
  zombiesAlive,
  type OpeningKind,
  type ZombieEntity,
  type ZombieOpening,
} from '../../src/game/content/oldenzaal/zombies/api';
import { CRAWLER, GRUNT, GUNNER, RIFLEMAN } from '../../src/game/content/oldenzaal/zombies/numbers';
import type { SectionContext } from '../../src/game/mission/index';
import { getEntityMeta } from '../../src/game/registry';
import { createHeadlessGame, type HeadlessGame } from '../../src/sim/index';

await loadContent();

let g: HeadlessGame | null = null;
afterEach(() => {
  g?.dispose();
  g = null;
});

/** A quiet flat section (oz-c's placeholder square), the hero idle at x 48, god mode. */
async function square(): Promise<{ g: HeadlessGame; w: World; ctx: SectionContext }> {
  g = await createHeadlessGame({ missionId: OLDENZAAL_ID, sectionId: 'oz-c', seed: 3, players: 1, god: true, bot: false, captureConsole: true });
  g.step(2);
  const ctx = (g.runner as unknown as { ctx: SectionContext }).ctx;
  return { g, w: g.world!, ctx };
}

/** A test opening (the contract RUIN / CHURCH implement): records its calls. */
class FakeOpening extends Entity implements ZombieOpening {
  readonly openingKind: OpeningKind = 'door';
  readonly spotX: number;
  readonly floorY: number;
  readonly outDir: -1 | 0 | 1 = -1;
  closed = true;
  busy = false;
  tells: number[] = [];
  opens = 0;
  constructor(w: World, x: number, y: number) {
    super(w, x, y);
    this.spotX = x;
    this.floorY = y;
    this.team = 'neutral';
  }
  tell(ticks: number): void {
    this.tells.push(ticks);
  }
  open(): void {
    this.opens++;
    this.closed = false;
  }
}

function ticksUntil(game: HeadlessGame, pred: () => boolean, max: number): number {
  for (let t = 0; t < max; t++) {
    if (pred()) return t;
    game.step(1);
  }
  return -1;
}

describe('zombie API: ids and kinds', () => {
  it('four kinds, each a registered enemy; the MG zombie is oz-mg', () => {
    expect([...ZOMBIE_KINDS]).toEqual(['grunt', 'rifleman', 'gunner', 'crawler']);
    expect(ZOMBIE_ID).toEqual({ grunt: OZ_ZOMBIES.grunt, rifleman: OZ_ZOMBIES.rifleman, gunner: 'oz-mg', crawler: OZ_ZOMBIES.crawler });
    // The wave-A possessed gunner's id is never reused.
    expect(ZOMBIE_ID.gunner).not.toBe('oz-gunner');
    for (const k of ZOMBIE_KINDS) {
      expect(getEntityMeta(ZOMBIE_ID[k])?.category, k).toBe('enemy');
      expect(zombieKindOf(ZOMBIE_ID[k])).toBe(k);
    }
    expect(zombieKindOf('oz-shambler')).toBeNull();
  });

  it('tanks (spec R2-1): slow and many hits; the gunner is the heaviest, the crawler the lightest', () => {
    for (const n of [GRUNT, RIFLEMAN, GUNNER, CRAWLER]) {
      expect(n.walk).toBeGreaterThanOrEqual(0.3);
      expect(n.walk).toBeLessThanOrEqual(0.5);
      expect(n.hp).toBeGreaterThanOrEqual(40);
    }
    expect(GUNNER.hp).toBeGreaterThan(GRUNT.hp);
    expect(CRAWLER.hp).toBeLessThan(GRUNT.hp);
    expect(CRAWLER.h).toBeLessThan(16);
    for (const tell of [GRUNT.tell, RIFLEMAN.tell, GUNNER.tell, CRAWLER.tell]) expect(tell).toBeGreaterThanOrEqual(18);
  });
});

describe('zombie API: entrances', () => {
  it("'walk': in play at once, a zombie with the tag and the contract", async () => {
    const { g: game, w, ctx } = await square();
    const z = spawnZombie(ctx, 'grunt', 300, 'ground', 'walk', { tag: 'wave1' });
    game.step(1); // new entities join the tag index on the next tick
    expect(isZombie(z)).toBe(true);
    expect(z.hasTag(OZ_ZOMBIE_TAG)).toBe(true);
    expect(z.hasTag('wave1')).toBe(true);
    expect(z.zombieKind).toBe('grunt');
    expect(z.entering).toBe(false);
    expect(z.hidden).toBe(false);
    expect(z.hp).toBe(GRUNT.hp);
    expect(zombiesAlive(w)).toBe(1);
    expect(zombiesAlive(w, 'wave1')).toBe(1);
    expect(zombiesAlive(w, 'other')).toBe(0);
    // Works from a bare World too.
    const z2 = spawnZombie(w, 'crawler', 330, 'ground');
    expect(isZombie(z2)).toBe(true);
  });

  it("'rise': hidden (no hurt boxes, shots ignored) for a tell of ≥ 18 ticks, then hittable while it climbs; no attack until it stands", async () => {
    const { g: game, w, ctx } = await square();
    const z = spawnZombie(ctx, 'grunt', 260, 'ground', 'rise');
    expect(z.entering).toBe(true);
    expect(z.hidden).toBe(true);
    expect(z.hurtboxes().length).toBe(0);
    const hp = z.hp;
    w.damage(z, { amount: 10, kind: 'bullet', dirX: 1, owner: 0 });
    expect(z.hp).toBe(hp);
    let hiddenFor = 0;
    let attacked = false;
    const t = ticksUntil(
      game,
      () => {
        if (z.hidden) hiddenFor++;
        if (z.contactDamage) attacked = true;
        return !z.hidden;
      },
      300,
    );
    expect(t).toBeGreaterThan(0);
    expect(hiddenFor).toBeGreaterThanOrEqual(ENTRANCE.minTell);
    expect(z.entering).toBe(true);
    expect(z.hurtboxes().length).toBeGreaterThan(0);
    w.damage(z, { amount: 10, kind: 'bullet', dirX: 1, owner: 0 });
    expect(z.hp).toBe(hp - 10);
    ticksUntil(game, () => {
      if (z.contactDamage) attacked = true;
      return !z.entering;
    }, 300);
    expect(z.entering).toBe(false);
    expect(attacked).toBe(false);
  });

  it("'rise' never comes up on top of a hero: the spot moves ≥ ENTRANCE.clear away", async () => {
    const { g: game, ctx } = await square();
    const hero = game.player(0)!;
    const z = spawnZombie(ctx, 'grunt', hero.x + 4, 'ground', 'rise');
    expect(Math.abs(z.x - hero.x)).toBeGreaterThanOrEqual(ENTRANCE.clear);
    expect(Math.abs(z.x - hero.x)).toBeLessThanOrEqual(ENTRANCE.clear + ENTRANCE.maxShift);
  });

  it("'burst' through an opening: waits while a hero stands at it, then tell(≥ 18) → open() once → staggers out; busy while it comes out", async () => {
    const { g: game, w, ctx } = await square();
    const hero = game.player(0)!;
    const door = w.add(new FakeOpening(w, hero.x + 10, hero.y));
    door.addTag(OZ_OPENING_TAG);
    expect(isOpening(door)).toBe(true);
    const z = spawnZombie(ctx, 'grunt', 999, 'ground', { kind: 'burst', target: door });
    expect(z.x).toBe(door.spotX);
    expect(door.busy).toBe(true);
    game.step(60);
    expect(door.tells.length).toBe(0); // the hero blocks the spot
    expect(z.hidden).toBe(true);
    hero.x = door.spotX + 120;
    hero.prevX = hero.x;
    ticksUntil(game, () => door.opens > 0, 300);
    expect(door.tells.length).toBe(1);
    expect(door.tells[0]).toBeGreaterThanOrEqual(ENTRANCE.minTell);
    expect(door.opens).toBe(1);
    expect(z.hidden).toBe(false);
    expect(z.facing).toBe(door.outDir);
    ticksUntil(game, () => !z.entering, 300);
    expect(door.opens).toBe(1);
    expect(door.busy).toBe(false);
  });

  it("'manhole' with an opening uses its spot and opens it", async () => {
    const { g: game, w, ctx } = await square();
    const drain = w.add(new FakeOpening(w, 300, game.player(0)!.y));
    drain.addTag(OZ_OPENING_TAG);
    const z = spawnZombie(ctx, 'crawler', 0, 'ground', { kind: 'manhole', target: drain });
    expect(z.x).toBe(300);
    ticksUntil(game, () => !z.entering, 400);
    expect(drain.opens).toBe(1);
    expect(z.entering).toBe(false);
  });

  it("'march': a column from the far end, spaced, in step with no attacks, until the lead nears a hero", async () => {
    const { g: game, ctx } = await square();
    const col = marchColumn(ctx, ['grunt', 'grunt', 'rifleman', 'gunner'], { tag: 'col' });
    expect(col.length).toBe(4);
    for (let i = 1; i < col.length; i++) expect(col[i].x - col[i - 1].x).toBe(MARCH.spacing);
    expect(col[0].x).toBeGreaterThan(ctx.camera.right);
    for (const z of col) expect(z.entering).toBe(true);
    let attacked = false;
    const hero = game.player(0)!;
    ticksUntil(game, () => {
      for (const z of col) if (z.entering && z.contactDamage) attacked = true;
      return !col[0].entering;
    }, 3000);
    expect(attacked).toBe(false);
    expect(col[0].entering).toBe(false);
    expect(Math.abs(col[0].x - hero.x)).toBeLessThanOrEqual(MARCH.breakAt + 2);
  });
});

describe('zombie API: stagger, blast, death', () => {
  it('blast() hurts and staggers; staggerZombiesInArea reaches the visible ones only', async () => {
    const { g: game, w, ctx } = await square();
    const a = spawnZombie(ctx, 'gunner', 260, 'ground');
    const b = spawnZombie(ctx, 'grunt', 280, 'ground', 'rise');
    game.step(1);
    const hp = a.hp;
    expect(a.blast({ owner: 0, damage: 30, x: 250, y: a.y - 10 })).toBe(true);
    expect(a.hp).toBe(hp - 30);
    expect(b.blast({ owner: 0, damage: 30, x: 250, y: b.y - 10 })).toBe(false); // hidden
    expect(staggerZombiesInArea(w, 270, a.y - 16, 64)).toBe(1);
  });

  it('the frikandel (wave-A blast, bridged) hurts zombies in its radius', async () => {
    const { g: game, w, ctx } = await square();
    const z = spawnZombie(ctx, 'grunt', 260, 'ground');
    game.step(1);
    const hp = z.hp;
    holyMayoBlast(w, 262, z.y - 8, 0);
    expect(z.hp).toBeLessThan(hp);
  });

  it('death is bloodless and leaves no soul and no townsperson (revision 2)', async () => {
    const { g: game, w, ctx } = await square();
    const z: ZombieEntity = spawnZombie(ctx, 'crawler', 260, 'ground');
    w.damage(z, { amount: 1e6, kind: 'bullet', dirX: 1, owner: 0 });
    game.step(2);
    expect(z.removed).toBe(true);
    expect(w.byTag('oz-town').length).toBe(0);
    expect(w.entities.filter((e) => e.type === 'oz-soul-eject' || e.type === 'oz-townsperson').length).toBe(0);
    expect(zombiesAlive(w)).toBe(0);
    expect(game.report().errors).toEqual([]);
  });
});
