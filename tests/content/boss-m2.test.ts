/**
 * Bosses of m2 (GDD §10.2, §9.4): THE BA-DUM BEHEMOTH and the mini-boss THE GOLDEN GOOSE.
 * Spawn, every attack after its telegraph, parts and phases in order, a fight won with the
 * pistol + grenades from a fair spot (time to kill printed), the defeat sequence, 3000 quiet ticks.
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import type { Button } from '../../src/engine/input';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/items/index';
import '../../src/game/content/bosses/m2/index';
import { BaDumBehemoth } from '../../src/game/content/bosses/m2/behemoth';
import { GoldenGoose } from '../../src/game/content/bosses/m2/goose';
import type { Player } from '../../src/game/player/player';
import { FLOOR, TestWorld } from './helpers';

const LEDGE_Y = FLOOR - 44; // 132: the arena's sandstone ledges (GDD §11.2 m2-d)

/** The m2-d arena at x 0 … 384 (locked view): two ledges, the quarry wall on the right. */
function behemothArena(o: { god?: boolean; difficulty?: 'easy' | 'normal' | 'hard'; playerX?: number | null } = {}): TestWorld {
  const tw = new TestWorld({
    width: 400,
    god: o.god,
    difficulty: o.difficulty,
    playerX: o.playerX === undefined ? 60 : o.playerX,
    build: (t) => {
      t.platform(24, LEDGE_Y, 64);
      t.platform(140, LEDGE_Y, 64);
      t.solid(384, 0, 16, FLOOR);
    },
  });
  tw.world.camera.lock(0, 384);
  tw.world.camera.snap();
  return tw;
}

function spawnBehemoth(tw: TestWorld, x = 520): BaDumBehemoth {
  return tw.spawn('ba-dum-behemoth', x, { arenaLeft: 0 }) as BaDumBehemoth;
}

const fightOf = (b: { state: string }) => b.state === 'fight';

/** Run a pattern of the boss on its own (no phase scripts) and return what happened when. */
function runAttack(tw: TestWorld, boss: BaDumBehemoth | GoldenGoose, gen: Generator<unknown, void, unknown>, probe: () => boolean, max = 400): number {
  tw.world.scripts.run(gen as never, { owner: boss });
  for (let i = 0; i < max; i++) {
    tw.run(1);
    if (probe()) return i + 1;
  }
  return -1;
}

function quietBoss(tw: TestWorld, boss: BaDumBehemoth | GoldenGoose): void {
  boss.phases = [];
  tw.until(() => fightOf(boss), 400);
  tw.run(2);
}

const count = (tw: TestWorld, type: string) => tw.ofType(type).length;

describe('THE BA-DUM BEHEMOTH', () => {
  it('rolls in from the right, then fights with the GDD parts', () => {
    const tw = behemothArena();
    const boss = spawnBehemoth(tw);
    expect(boss.parts.map((p) => p.name)).toEqual(['crash-shield', 'hihat-arm', 'tom-left', 'tom-right', 'bass-drum', 'tread']);
    expect(boss.part('bass-drum')!.required).toBe(true);
    expect(boss.part('crash-shield')!.required).toBe(false);
    const t = tw.until(() => fightOf(boss), 400);
    expect(t).toBeGreaterThan(60);
    expect(boss.x).toBeLessThanOrEqual(290);
    expect(boss.x).toBeGreaterThanOrEqual(230);
    expect(tw.world.errors).toEqual([]);
  });

  it('fires every attack only after its telegraph (≥ 18 ticks)', () => {
    const tw = behemothArena({ god: true });
    const boss = spawnBehemoth(tw, 290);
    quietBoss(tw, boss);
    // A Hi-Hat Crush: 45 ticks before the head drops; it lands near the player.
    const tA = runAttack(tw, boss, boss.hihatCrush(), () => boss.hhSlamming);
    expect(tA).toBeGreaterThanOrEqual(45);
    tw.until(() => boss.hhDown, 60);
    expect(Math.abs(boss.hhX - tw.player!.x)).toBeLessThan(4);
    tw.until(() => boss.hhAttached, 200);
    // B Tom Volley: 30 ticks, then 2 shells per tom.
    const tB = runAttack(tw, boss, boss.tomVolley(), () => count(tw, 'tom-shell') > 0);
    expect(tB).toBeGreaterThanOrEqual(30);
    tw.run(14);
    expect(count(tw, 'tom-shell')).toBe(4);
    tw.run(120);
    // D Kick Boom: 40 ticks, a ground wave each way; the shield is aside.
    const tD = runAttack(tw, boss, boss.kickBoom(1), () => count(tw, 'boss-wave') > 0);
    expect(tD).toBeGreaterThanOrEqual(40);
    expect(tw.ofType('boss-wave').some((w) => w.vx < 0)).toBe(true); // the right one dies in the quarry wall
    expect(boss.shieldInFront()).toBe(false);
    tw.run(80);
    // E Drum-Roll Charge: 40 ticks of spinning treads, then the tread front stops at view 130.
    const x0 = boss.x;
    const tE = runAttack(tw, boss, boss.charge(), () => boss.x < x0 - 1);
    expect(tE).toBeGreaterThanOrEqual(40);
    tw.until(() => boss.x - 100 <= 130.01, 200);
    expect(boss.x - 100).toBeGreaterThanOrEqual(129);
    tw.until(() => boss.move === 'patrol', 300);
    // F Stick Storm: 6 shadows at once, nothing falls for 40 ticks.
    const before = tw.world.camera.top;
    const tF = runAttack(tw, boss, boss.stickStorm(), () => tw.ofType('drumstick').some((s) => s.y > before));
    expect(tF).toBeGreaterThanOrEqual(40);
    tw.run(160);
    // G Cymbal Saw: 30 ticks, then the saw flies and comes back.
    const tG = runAttack(tw, boss, boss.cymbalSaw(), () => count(tw, 'cymbal-saw') > 0);
    expect(tG).toBeGreaterThanOrEqual(30);
    tw.until(() => count(tw, 'cymbal-saw') === 0, 400);
    expect(tw.world.errors).toEqual([]);
  });

  it('breaks its parts in order: 2 of 3 arm / tom parts, then the bass drum', () => {
    const tw = behemothArena({ god: true, playerX: 40 });
    const boss = spawnBehemoth(tw, 290);
    tw.until(() => fightOf(boss), 400);
    const hit = (part: string, amount: number) => boss.onHit({ amount, kind: 'explosion', dirX: 1, owner: 0 }, boss.part(part)!.index);
    const bass = boss.part('bass-drum')!;
    // Phase 1: the bass drum only pings (the shield takes shots aimed at it while in front).
    boss.shieldK = 3;
    boss.shieldTarget = 3;
    tw.run(1);
    hit('bass-drum', 500);
    expect(bass.hp).toBe(bass.maxHp);
    const hp0 = boss.hp;
    hit('hihat-arm', 5000);
    expect(boss.part('hihat-arm')!.destroyed).toBe(true);
    expect(boss.hp).toBeLessThan(hp0);
    expect(boss.phase).toBe(0);
    hit('tom-left', 5000);
    expect(boss.phase).toBe(1);
    tw.run(70); // intermission
    hit('bass-drum', 600);
    expect(bass.hp).toBe(bass.maxHp - 600);
    expect(boss.phase).toBe(1);
    hit('bass-drum', 500);
    expect(boss.phase).toBe(2);
    expect(boss.standing).toBe(true);
    let defeated = 0;
    tw.world.events.on('bossDefeated', () => defeated++);
    tw.run(70);
    hit('bass-drum', 5000);
    expect(boss.state).toBe('dying');
    const t = tw.until(() => boss.defeated, 400);
    expect(t).toBeGreaterThanOrEqual(200);
    expect(defeated).toBe(1);
    tw.run(60);
    expect(boss.removed).toBe(false); // the wreck stays
    expect(tw.world.errors).toEqual([]);
  });

  it('can be won with the pistol and grenades from the ledges (time to kill)', () => {
    const tw = behemothArena({ god: true, playerX: 165 });
    const p = tw.player as Player;
    p.placeAt(165, LEDGE_Y, 0);
    const boss = spawnBehemoth(tw);
    let ticks = 0;
    // A simple player: on ledge 2 shoot up at the toms (and the hi-hat); once phase 2 starts,
    // stand on ledge 1 and shoot the bass drum, jumping now and then, a grenade every 4 s.
    const policy = (t: number): Button[] => {
      const phase2 = boss.phase >= 1;
      const want = phase2 ? 56 : boss.partAlive('tom-right') ? boss.x - 64 : boss.x - 114;
      const wantX = Math.max(phase2 ? 30 : 146, Math.min(phase2 ? 82 : 198, want));
      const b: Button[] = [];
      if (Math.abs(p.x - wantX) > 6) b.push(p.x < wantX ? 'right' : 'left');
      else if (p.facing < 0) b.push('right'); // face the boss again
      if (!phase2) b.push('up');
      if (t % 2 === 0) b.push('fire');
      if (t % 240 === 120) b.push('bomb');
      if (phase2 && t % 90 === 45) b.push('jump');
      if (!phase2 && p.y > LEDGE_Y + 4 && t % 30 === 0) b.push('jump');
      return b;
    };
    while (!boss.defeated && ticks < 14000) {
      tw.hold(...policy(ticks));
      tw.run(1);
      ticks++;
    }
    const fight = boss.defeated ? ticks : -1;
    if (!boss.defeated) console.log('[boss-m2] not defeated:', boss.state, boss.phase, boss.x, p.x, p.y, boss.parts.map((q) => q.hp).join(' '));
    console.log(`[boss-m2] BA-DUM BEHEMOTH: defeated after ${fight} ticks (${(fight / 60).toFixed(1)} s) with the pistol + grenades`);
    expect(boss.defeated).toBe(true);
    expect(ticks).toBeLessThan(12000);
    expect(tw.world.errors).toEqual([]);
  });

  it('runs 3000 ticks without errors on HARD with a player that keeps moving', () => {
    const tw = behemothArena({ difficulty: 'hard' });
    spawnBehemoth(tw);
    for (let i = 0; i < 3000; i++) {
      tw.hold(...(((i / 50) | 0) % 2 ? ['left', 'fire'] : ['right', 'fire']) as Button[]);
      if (i % 70 === 0) tw.hold('jump');
      tw.run(1);
    }
    expect(tw.world.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// THE GOLDEN GOOSE
// ---------------------------------------------------------------------------------------------

function gooseArena(o: { god?: boolean; difficulty?: 'easy' | 'normal' | 'hard'; playerX?: number } = {}): TestWorld {
  const tw = new TestWorld({
    width: 400,
    god: o.god,
    difficulty: o.difficulty,
    playerX: o.playerX ?? 60,
    build: (t) => t.solid(384, 0, 16, FLOOR),
  });
  tw.world.camera.lock(0, 384);
  tw.world.camera.snap();
  return tw;
}

function spawnGoose(tw: TestWorld, x = 392): GoldenGoose {
  return tw.spawn('golden-goose', x, { arenaLeft: 0, facing: -1 }) as GoldenGoose;
}

describe('THE GOLDEN GOOSE', () => {
  it('walks in and fights with the parts neck and hull', () => {
    const tw = gooseArena();
    const g = spawnGoose(tw);
    expect(g.parts.map((p) => p.name)).toEqual(['neck', 'hull']);
    expect(g.part('hull')!.required).toBe(true);
    tw.until(() => fightOf(g), 400);
    expect(Math.abs(g.x - 300)).toBeLessThan(2);
    expect(tw.world.errors).toEqual([]);
  });

  it('fires every attack only after its telegraph', () => {
    const tw = gooseArena({ god: true, playerX: 200 });
    const g = spawnGoose(tw);
    quietBoss(tw, g);
    const tA = runAttack(tw, g, g.eggDrop(), () => count(tw, 'golden-egg') > 0);
    expect(tA).toBeGreaterThanOrEqual(40);
    tw.run(40);
    expect(count(tw, 'golden-egg')).toBe(3);
    tw.run(200);
    const tB = runAttack(tw, g, g.neckLash(), () => count(tw, 'goose-pellet') > 0);
    expect(tB).toBeGreaterThanOrEqual(30);
    tw.run(60);
    expect(count(tw, 'goose-pellet') + 0).toBeGreaterThan(0);
    tw.run(200);
    const tC = runAttack(tw, g, g.gooseStep(), () => count(tw, 'boss-wave') > 0);
    expect(tC).toBeGreaterThanOrEqual(20);
    tw.run(200);
    const tD = runAttack(tw, g, g.honkRing(), () => count(tw, 'goose-note') > 0);
    expect(tD).toBeGreaterThanOrEqual(50);
    expect(count(tw, 'goose-note')).toBe(8);
    expect(tw.world.errors).toEqual([]);
  });

  it('loses Neck Lash and Honk Ring with its neck; the hull ends the fight; the egg pops two items', () => {
    const tw = gooseArena({ god: true });
    const g = spawnGoose(tw);
    tw.until(() => fightOf(g), 400);
    const hit = (part: string, amount: number) => g.onHit({ amount, kind: 'explosion', dirX: 1, owner: 0 }, g.part(part)!.index);
    hit('neck', 5000);
    expect(g.part('neck')!.destroyed).toBe(true);
    expect(g.state).toBe('fight');
    tw.run(1);
    const notes = count(tw, 'goose-note');
    runAttack(tw, g, g.honkRing(), () => false, 120);
    expect(count(tw, 'goose-note')).toBe(notes);
    let defeated = 0;
    tw.world.events.on('bossDefeated', () => defeated++);
    hit('hull', 5000);
    expect(g.state).toBe('dying');
    tw.until(() => g.defeated, 400);
    expect(defeated).toBe(1);
    tw.run(30);
    const items = tw.world.entities.filter((e: Entity) => !e.removed && (e.type === 'pickup-repair' || e.type === 'pickup-bombs'));
    expect(items.length).toBe(2);
    expect(tw.world.errors).toEqual([]);
  });

  it('dropMaxX: dying, it staggers left so its last egg (and the two items) land left of that x', () => {
    const tw = gooseArena({ god: true, playerX: 40 });
    const g = tw.spawn('golden-goose', 392, { arenaLeft: 0, facing: -1, dropMaxX: 200 }) as GoldenGoose;
    tw.until(() => fightOf(g), 400);
    const x0 = g.x;
    g.onHit({ amount: 5000, kind: 'explosion', dirX: 1, owner: 0 }, g.part('hull')!.index);
    tw.until(() => g.defeated, 700);
    expect(g.x).toBeLessThan(x0);
    const items = tw.world.entities.filter((e: Entity) => !e.removed && (e.type === 'pickup-repair' || e.type === 'pickup-bombs'));
    expect(items.length).toBe(2);
    for (const it of items) expect(it.x).toBeLessThanOrEqual(206);
    expect(tw.world.errors).toEqual([]);
  });

  it('can be won with the pistol and grenades from a fair spot (time to kill)', () => {
    const tw = gooseArena({ god: true, playerX: 120 });
    const p = tw.player as Player;
    const g = spawnGoose(tw);
    let ticks = 0;
    while (!g.defeated && ticks < 9000) {
      const b: Button[] = [];
      if (ticks % 2 === 0) b.push('fire');
      if (ticks % 240 === 120) b.push('bomb');
      if (ticks % 80 === 40) b.push('jump');
      if (p.x > 150) b.push('left');
      tw.hold(...b);
      tw.run(1);
      ticks++;
    }
    console.log(`[boss-m2] GOLDEN GOOSE: defeated after ${ticks} ticks (${(ticks / 60).toFixed(1)} s) with the pistol + grenades`);
    expect(g.defeated).toBe(true);
    expect(tw.world.errors).toEqual([]);
  });

  it('runs 3000 ticks without errors on HARD', () => {
    const tw = gooseArena({ difficulty: 'hard' });
    spawnGoose(tw);
    for (let i = 0; i < 3000; i++) {
      tw.hold(...(((i / 40) | 0) % 2 ? ['left', 'fire'] : ['right', 'fire']) as Button[]);
      if (i % 60 === 0) tw.hold('jump');
      tw.run(1);
    }
    expect(tw.world.errors).toEqual([]);
  });
});
