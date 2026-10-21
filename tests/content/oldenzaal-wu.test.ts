/**
 * Mission oldenzaal, WUGHOST (docs/design/oldenzaal.md §4, §6; docs/api/oldenzaal.md "WUGHOST"):
 * Meneer Wu and his scene, the meal (snack power, the frikandel bombs, the holy-mayo blast, the
 * mayo splat) and Mevrouw Winkel (never a target).
 */
import { describe, expect, it } from 'vitest';
import { hasSfx } from '../../src/engine/audio';
import type { Damage } from '../../src/engine/entity';
import type { Entity } from '../../src/engine/entity';
import { buttonMask, VirtualPad } from '../../src/engine/input';
import { getFrames, hasSprite, listSprites } from '../../src/engine/sprites';
import { loadContent } from '../../src/game/content/index';
import { eatMeal, FRIKANDEL, frikandelsLeft, holyMayoBlast, OZ_STATUS_FRIKANDEL, SNACK, splatReady } from '../../src/game/content/oldenzaal/items/index';
import { OzWinkel, OzWu, WU_SCENE, wuScene } from '../../src/game/content/oldenzaal/npcs/index';
import { OZ_SPRITES, OZ_STATUS_SNACK, OZ_WUGHOST } from '../../src/game/content/missions/oldenzaal/ids';
import { WU_LINES } from '../../src/game/content/missions/oldenzaal/lines';
import type { SectionContext } from '../../src/game/mission/index';
import { Player } from '../../src/game/player/player';
import { getEntityMeta, getStatus, getWeapon, hasEntity, hasWeapon } from '../../src/game/registry';
import { createHeadlessGame } from '../../src/sim/index';
import { FLOOR, TestWorld } from './helpers';

await loadContent();

function playerAs(tw: TestWorld, character: string, x = 100): Player {
  const p = new Player(tw.world, x, FLOOR, { pad: tw.pad, index: 0, character });
  tw.world.add(p);
  p.placeAt(x, FLOOR, 0);
  tw.world.flush();
  return p;
}

describe('WUGHOST registration', () => {
  it('registers the entities, the weapon, the statuses and the sounds', () => {
    expect(getEntityMeta(OZ_WUGHOST.wu)?.category).toBe('npc');
    expect(getEntityMeta(OZ_WUGHOST.winkel)?.category).toBe('npc');
    expect(getEntityMeta(OZ_WUGHOST.meal)?.category).toBe('item');
    expect(getEntityMeta(OZ_WUGHOST.blast)?.category).toBe('fx');
    expect(getEntityMeta(OZ_WUGHOST.splat)?.category).toBe('fx');
    expect(hasEntity(OZ_WUGHOST.frikandel)).toBe(true);
    expect(hasWeapon(OZ_WUGHOST.frikandel)).toBe(true);
    expect(getWeapon(OZ_WUGHOST.frikandel).kind).toBe('bomb');
    expect(getStatus(OZ_STATUS_SNACK)?.fireRate).toBe(1.5);
    expect(getStatus(OZ_STATUS_FRIKANDEL)?.bomb?.weapon).toBe(OZ_WUGHOST.frikandel);
    for (const id of ['oz/wu/fryer', 'oz/wu/paper', 'oz/wu/toss', 'oz/meal/catch', 'oz/meal/eat', 'oz/meal/throw', 'oz/meal/splat', 'oz/meal/blast', 'oz/ghost/whisper', 'oz/ghost/shriek', 'oz/ghost/laugh', 'oz/ghost/appear', 'oz/ghost/vanish']) {
      expect(hasSfx(id), id).toBe(true);
    }
  });

  it('every WUGHOST sprite has 1× art and 2× / 4× art with the same logical geometry', () => {
    const ids = OZ_SPRITES.wughost.flatMap((pre) => listSprites(pre));
    expect(ids.length).toBeGreaterThanOrEqual(20);
    for (const id of ['npc/oz-wu/idle', 'npc/oz-wu/toss', 'npc/oz-winkel/stand', 'item/pickup-oz-meal', 'weapon/oz-frikandel', 'fx/oz/mayo/blast', 'fx/oz/mayo/splat', 'ui/icon-oz-meal', 'ui/icon-oz-frikandel']) expect(hasSprite(id), id).toBe(true);
    for (const id of ids) {
      const f1 = getFrames(id, 1);
      for (const d of [2, 4] as const) {
        const fd = getFrames(id, d);
        expect(fd.length, `${id}@${d}`).toBe(f1.length);
        fd.forEach((f, i) => {
          expect(f.density, `${id}@${d}#${i}`).toBe(d);
          expect([f.buf.w / d, f.buf.h / d, f.ox, f.oy], `${id}@${d}#${i}`).toEqual([f1[i].buf.w, f1[i].buf.h, f1[i].ox, f1[i].oy]);
        });
      }
    }
  });
});

describe('snack power', () => {
  it('lasts 20 s (Patrick 30 s), then ends; the frikandels stay until thrown', () => {
    const tw = new TestWorld({ playerX: null, god: false });
    const p = playerAs(tw, 'vincent');
    expect(eatMeal(p)).toBe(true);
    expect(p.status.ticksLeft(OZ_STATUS_SNACK)).toBe(SNACK.ticks);
    expect(frikandelsLeft(p)).toBe(2);
    tw.run(SNACK.ticks - 1);
    expect(p.status.has(OZ_STATUS_SNACK)).toBe(true);
    tw.run(2);
    expect(p.status.has(OZ_STATUS_SNACK)).toBe(false);
    expect(frikandelsLeft(p)).toBe(2);
    const tw2 = new TestWorld({ playerX: null });
    const pat = playerAs(tw2, 'patrick');
    eatMeal(pat);
    expect(pat.status.ticksLeft(OZ_STATUS_SNACK)).toBe(SNACK.patrickTicks);
    expect(SNACK.patrickTicks).toBe(1800);
  });

  it('fires 1.5× as often with the trigger held', () => {
    const shots = (snack: boolean): number => {
      const tw = new TestWorld({ playerX: null });
      const p = playerAs(tw, 'vincent');
      if (snack) eatMeal(p);
      tw.run(2);
      const before = p.slot.stats.shots;
      tw.hold('fire').run(600);
      return p.slot.stats.shots - before;
    };
    const base = shots(false);
    const fast = shots(true);
    expect(base).toBeGreaterThan(10);
    expect(fast / base).toBeGreaterThan(1.35);
    expect(fast / base).toBeLessThan(1.65);
  });

  it('absorbs exactly one hit with a mayo splat', () => {
    const tw = new TestWorld({ playerX: null, god: false });
    const p = playerAs(tw, 'vincent');
    tw.run(130);
    eatMeal(p);
    expect(splatReady(p)).toBe(true);
    const hit: Damage = { amount: 10, kind: 'bullet', dirX: 1 };
    tw.world.damage(p, hit);
    tw.world.flush();
    expect(p.state).not.toBe('dead');
    expect(splatReady(p)).toBe(false);
    expect(tw.ofType(OZ_WUGHOST.splat).length).toBe(1);
    expect(p.invulnTicks).toBeGreaterThan(0);
    tw.run(SNACK.splatInvuln + 2);
    tw.world.damage(p, hit);
    expect(['dead', 'out']).toContain(p.state);
    // Death ends both statuses: a continue gives no new meal.
    expect(p.status.has(OZ_STATUS_SNACK)).toBe(false);
    expect(frikandelsLeft(p)).toBe(0);
  });
});

describe('frikandel bombs', () => {
  it('replace BOMB twice (no grenade used), then the grenades come back', () => {
    const tw = new TestWorld({ playerX: null });
    const p = playerAs(tw, 'vincent');
    tw.run(130);
    eatMeal(p);
    const bombs = p.slot.bombs;
    for (let k = 0; k < 2; k++) {
      tw.hold('bomb').run(1).hold().run(FRIKANDEL.cooldown + 20);
    }
    expect(p.slot.bombs).toBe(bombs);
    expect(p.slot.stats.bombsThrown).toBe(2);
    expect(frikandelsLeft(p)).toBe(0);
    expect(p.status.has(OZ_STATUS_FRIKANDEL)).toBe(false);
    tw.hold('bomb').run(1).hold().run(5);
    expect(p.slot.bombs).toBe(bombs - 1);
  });

  it('flies in a high arc and pops into the explosion (R2-11), which hits every dead soldier in its radius at once', () => {
    const tw = new TestWorld({ playerX: null });
    const p = playerAs(tw, 'vincent');
    tw.run(130);
    eatMeal(p);
    const near = [tw.spawn('oz-grunt', 150, { facing: -1 }), tw.spawn('oz-grunt', 175, { facing: -1 }), tw.spawn('oz-grunt', 196, { facing: -1 })];
    const far = tw.spawn('oz-grunt', 400, { facing: -1 });
    tw.world.flush();
    const hp0 = (e: Entity): number => (e as unknown as { hp: number }).hp;
    const before = [...near, far].map(hp0);
    let peak = Infinity;
    tw.hold('bomb').run(1).hold();
    const bomb = tw.ofType(OZ_WUGHOST.frikandel)[0];
    expect(bomb).toBeDefined();
    const y0 = bomb.y;
    tw.until(() => {
      if (!bomb.removed) peak = Math.min(peak, bomb.y);
      return tw.ofType(OZ_WUGHOST.blast).length > 0;
    }, 200);
    expect(y0 - peak).toBeGreaterThan(20);
    tw.run(2);
    near.forEach((z, i) => expect(!z.alive || hp0(z) <= before[i] - 80, `grunt at ${z.x}`).toBe(true));
    expect(hp0(far)).toBe(before[3]);
    expect(p.state).not.toBe('dead');
  });

  it('holyMayoBlast (the explosion) hurts only the dead soldiers: plain enemies and players are not hurt', () => {
    const tw = new TestWorld({ playerX: null });
    const p = playerAs(tw, 'vincent', 210);
    tw.run(130);
    const z = tw.spawn('oz-grunt', 200, { facing: -1 });
    const rifle = tw.spawn('rifleman', 205);
    tw.world.flush();
    const hp = (rifle as unknown as { hp: number }).hp;
    const zhp = (z as unknown as { hp: number }).hp;
    const n = holyMayoBlast(tw.world, 200, FLOOR - 8, 0);
    expect(n).toBe(1);
    expect((z as unknown as { hp: number }).hp).toBeLessThan(zhp);
    expect((rifle as unknown as { hp: number }).hp).toBe(hp);
    expect(p.state).not.toBe('dead');
  });
});

describe('Mevrouw Winkel', () => {
  it('has no hurt box, is no target and fades in / glides / possesses / vanishes', () => {
    const tw = new TestWorld({ playerX: 100 });
    const w = tw.spawn(OZ_WUGHOST.winkel, 160, {}, FLOOR - 40) as OzWinkel;
    expect(w).toBeInstanceOf(OzWinkel);
    expect(w.hurtboxes()).toEqual([]);
    expect(w.hasTag('shootable')).toBe(false);
    expect(w.hasTag('enemy')).toBe(false);
    expect(w.team).toBe('neutral');
    expect(w.visible).toBe(false);
    w.appear(30);
    tw.run(31);
    expect(w.fade).toBe(1);
    // Shots pass through her.
    tw.hold('fire').run(60).hold();
    expect(w.removed).toBe(false);
    w.glideTo(220, FLOOR - 50, 2);
    tw.until(() => w.arrived, 120);
    expect(Math.round(w.x)).toBe(220);
    w.shriek(40);
    expect(w.shrieking).toBe(true);
    w.possessInto(300, FLOOR - 20, 4);
    tw.until(() => w.removed, 120);
    expect(w.possessed).toBe(true);
  });

  it('flee and vanish remove her', () => {
    const tw = new TestWorld({ playerX: 100 });
    const w = tw.spawn(OZ_WUGHOST.winkel, 160, { visible: true }, FLOOR - 40) as OzWinkel;
    w.flee(-150, 3);
    tw.until(() => w.removed, 200);
    const w2 = tw.spawn(OZ_WUGHOST.winkel, 160, { visible: true }, FLOOR - 40) as OzWinkel;
    w2.vanish(10);
    tw.run(12);
    expect(w2.removed).toBe(true);
  });
});

describe("Meneer Wu's scene", () => {
  async function scene(players: 1 | 2, skip: boolean) {
    const g = await createHeadlessGame({ missionId: 'oldenzaal', sectionId: 'oz-b', seed: 1, players, god: true, bot: false, captureConsole: true });
    g.step(200);
    g.world!.scripts.cancelAll();
    const runner = g.runner!;
    const ctx = (runner as unknown as { ctx: SectionContext }).ctx;
    const doorX = 600;
    g.teleport(doorX - 120);
    const p1 = g.player(0)!;
    // A private "real" pad for player 1 (fire presses skip lines).
    const real = new VirtualPad();
    p1.pad = real;
    let done = false;
    let wu: OzWu | null = null;
    g.world!.scripts.run(function* test() {
      wu = ctx.spawn(OZ_WUGHOST.wu, doorX, 'ground', {}) as OzWu;
      yield* wuScene(ctx, { doorX, wu });
      done = true;
    });
    let t = 0;
    for (; t < 4000 && !done; t++) {
      real.update(skip && t % 4 === 0 ? buttonMask('fire') : 0);
      g.step(1);
      if (t === 5) expect(runner.timerRunning).toBe(false);
    }
    expect(done).toBe(true);
    expect(p1.pad).toBe(real);
    expect(runner.timerRunning).toBe(true);
    const out = { g, ticks: t, wu: wu as unknown as OzWu };
    return out;
  }

  it('1P: the full scene gives the hero the meal (snack power + 2 frikandels)', async () => {
    const { g, ticks, wu } = await scene(1, false);
    const p = g.player(0)!;
    expect(ticks).toBeGreaterThan(WU_LINES.length * WU_SCENE.lineTicks);
    expect(wu.tossed).toBe(1);
    expect(p.status.has(OZ_STATUS_SNACK) || p.status.has(OZ_STATUS_FRIKANDEL)).toBe(true);
    expect(frikandelsLeft(p)).toBe(2);
    expect(g.world!.entities.filter((e) => e.type === OZ_WUGHOST.meal && !e.removed)).toEqual([]);
    expect(g.report().errors).toEqual([]);
    g.dispose();
  }, 60000);

  it('2P, skipped: both heroes still get one meal each, and it is much shorter', async () => {
    const { g, ticks } = await scene(2, true);
    expect(ticks).toBeLessThan(WU_LINES.length * WU_SCENE.lineTicks);
    for (const slot of [0, 1] as const) {
      const p = g.player(slot)!;
      expect(frikandelsLeft(p), `P${slot + 1}`).toBe(2);
      expect(p.status.has(OZ_STATUS_SNACK), `P${slot + 1}`).toBe(true);
    }
    expect(g.report().errors).toEqual([]);
    g.dispose();
  }, 60000);
});

describe('the meal across a section change and with a hero down', () => {
  it('snack power and the frikandels carry from oz-b into oz-c (StatusEffectDef.carry)', async () => {
    const g = await createHeadlessGame({ missionId: 'oldenzaal', sectionId: 'oz-b', seed: 1, players: 1, god: true, bot: false, captureConsole: true });
    g.step(30);
    const p = g.player(0)!;
    expect(eatMeal(p)).toBe(true);
    expect(frikandelsLeft(p)).toBe(2);
    g.step(60);
    g.runner!.loadSection('oz-c');
    g.step(10);
    const q = g.player(0)!;
    expect(g.runner!.section.id).toBe('oz-c');
    expect(frikandelsLeft(q)).toBe(2);
    expect(q.status.has(OZ_STATUS_SNACK)).toBe(true);
    expect(g.report().errors).toEqual([]);
    g.dispose();
  }, 60000);

  it('2P: P2 dies and is out during the scene; no crash, and only the living hero gets the meal', async () => {
    const g = await createHeadlessGame({ missionId: 'oldenzaal', sectionId: 'oz-b', seed: 1, players: 2, god: true, bot: false, autoContinue: false, captureConsole: true });
    g.step(200);
    g.world!.scripts.cancelAll();
    const ctx = (g.runner as unknown as { ctx: SectionContext }).ctx;
    const doorX = 600;
    g.teleport(doorX - 120);
    let done = false;
    g.world!.scripts.run(function* test() {
      const wu = ctx.spawn(OZ_WUGHOST.wu, doorX, 'ground', {}) as OzWu;
      yield* wuScene(ctx, { doorX, wu });
      done = true;
    });
    const p2 = g.player(1)!;
    let t = 0;
    for (; t < 4000 && !done; t++) {
      if (t === 60) {
        p2.slot.lives = 0;
        expect(p2.kill('impact')).toBe(true);
      }
      g.step(1);
    }
    expect(done).toBe(true);
    expect(p2.state).toBe('out');
    const p1 = g.player(0)!;
    expect(frikandelsLeft(p1)).toBe(2);
    expect(p1.status.has(OZ_STATUS_SNACK)).toBe(true);
    expect(frikandelsLeft(p2)).toBe(0);
    expect(p2.status.has(OZ_STATUS_SNACK)).toBe(false);
    g.step(120);
    expect(g.world!.entities.filter((e) => e.type === OZ_WUGHOST.meal && !e.removed)).toEqual([]);
    expect(g.report().errors).toEqual([]);
    g.dispose();
  }, 60000);
});
