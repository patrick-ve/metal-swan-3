/**
 * Bosses of m4 (GDD §10.4, §9.4): THE GRAND GRAND (+ the `chandelier` prop) and the mini-boss
 * THE BIG HEAD. Spawn, every attack after its telegraph, parts and phases in order, a fight won
 * with the pistol + grenades from a fair spot (time to kill printed), the defeat sequence and the
 * 'bossDefeated' event, 3000 quiet ticks.
 */
import { describe, expect, it } from 'vitest';
import type { Button } from '../../src/engine/input';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/items/index';
import '../../src/game/content/infantry/index';
import '../../src/game/content/bosses/m4/index';
import { BigHead } from '../../src/game/content/bosses/m4/big-head';
import { Chandelier } from '../../src/game/content/bosses/m4/chandelier';
import { FIRST_CHARGE_LEAD, GrandGrand } from '../../src/game/content/bosses/m4/grand-grand';
import { CrystalShard, HarpBeam } from '../../src/game/content/bosses/m4/shots';
import type { Player } from '../../src/game/player/player';
import { FLOOR, TestWorld } from './helpers';

const BALCONY_Y = 108; // GDD §10.4: two balcony boxes at y 108, the crate step at y 144
const STEP_Y = 144;

/** The m4-d stage at x 0 … 384 (locked view): crate step, two balcony boxes, the wall on the right. */
function stageArena(o: { god?: boolean; difficulty?: 'easy' | 'normal' | 'hard'; playerX?: number | null } = {}): TestWorld {
  const tw = new TestWorld({
    width: 400,
    god: o.god,
    difficulty: o.difficulty,
    playerX: o.playerX === undefined ? 40 : o.playerX,
    build: (t) => {
      t.platform(8, BALCONY_Y, 72);
      t.platform(140, BALCONY_Y, 72);
      t.platform(100, STEP_Y, 48);
      t.solid(384, 0, 16, FLOOR);
    },
  });
  tw.world.camera.lock(0, 384);
  tw.world.camera.snap();
  return tw;
}

function spawnGrand(tw: TestWorld, params: Record<string, unknown> = {}): GrandGrand {
  return tw.spawn('grand-grand', 290, { arenaLeft: 0, ...params }) as GrandGrand;
}

const fightOf = (b: { state: string }) => b.state === 'fight';
const count = (tw: TestWorld, type: string) => tw.ofType(type).length;

/** Run a pattern of the boss on its own and return the tick the probe first held (−1: never). */
function runAttack(tw: TestWorld, boss: GrandGrand | BigHead, gen: Generator<unknown, void, unknown>, probe: () => boolean, max = 400): number {
  tw.world.scripts.run(gen as never, { owner: boss });
  for (let i = 0; i < max; i++) {
    tw.run(1);
    if (probe()) return i + 1;
  }
  return -1;
}

function quietBoss(tw: TestWorld, boss: GrandGrand | BigHead): void {
  boss.phases = [];
  tw.until(() => fightOf(boss), 1200);
  tw.run(2);
}

const hitPart = (b: GrandGrand | BigHead, part: string, amount: number) =>
  b.onHit({ amount, kind: 'explosion', dirX: 1, owner: 0 }, b.part(part)!.index);

describe('THE GRAND GRAND', () => {
  it('spawns behind the curtain, raises it and fights with the GDD parts', () => {
    const tw = stageArena();
    const boss = spawnGrand(tw);
    expect(boss.parts.map((p) => p.name)).toEqual(['lid', 'keyboard', 'front-legs', 'strings', 'case']);
    expect(boss.part('lid')!.required).toBe(true);
    expect(boss.part('strings')!.required).toBe(true);
    expect(boss.part('keyboard')!.required).toBe(false);
    expect(boss.part('front-legs')!.knifeable).toBe(true);
    tw.run(2);
    expect(boss.curtain?.down).toBe(1);
    expect(tw.ofType('chandelier').length).toBe(3);
    const t = tw.until(() => fightOf(boss), 600);
    expect(t).toBeGreaterThan(90);
    expect(boss.curtain?.down).toBe(0);
    expect(boss.maxHp).toBe(4000);
    expect(tw.world.errors).toEqual([]);
  });

  it('uses the chandeliers the arena already has', () => {
    const tw = stageArena();
    for (const x of [60, 180, 300]) tw.world.spawn('chandelier', x, 6, {});
    tw.world.flush();
    const boss = spawnGrand(tw);
    tw.until(() => fightOf(boss), 600);
    expect(tw.ofType('chandelier').length).toBe(3);
    expect(boss.chandeliers.length).toBe(3);
  });

  it('fires every attack only after its telegraph (≥ 18 ticks)', () => {
    const tw = stageArena({ god: true, playerX: 60 });
    const boss = spawnGrand(tw);
    quietBoss(tw, boss);
    // A Chomp: 40 ticks of an open, rattling lid, then the lunge (64 px) and the bite.
    const x0 = boss.x;
    const tA = runAttack(tw, boss, boss.chomp(), () => boss.x < x0 - 1);
    expect(tA).toBeGreaterThanOrEqual(40);
    tw.until(() => boss.x <= x0 - 63.9, 30);
    tw.run(140);
    // B Glissando: 36 ticks, then 12 felt hammers.
    const tB = runAttack(tw, boss, boss.glissando(), () => count(tw, 'felt-hammer') > 0);
    expect(tB).toBeGreaterThanOrEqual(36);
    tw.run(24);
    expect(count(tw, 'felt-hammer')).toBe(12);
    tw.run(200);
    // C High C: the chandelier over the player shakes 40 ticks, then falls and stays as a solid.
    const ch = boss.pickChandelier()!;
    expect(Math.abs(ch.x - 60)).toBeLessThan(2);
    const tC = runAttack(tw, boss, boss.highC(), () => ch.state === 'fall');
    expect(tC).toBeGreaterThanOrEqual(40);
    tw.until(() => ch.state === 'down', 120);
    expect(tw.world.solids.length).toBeGreaterThan(0);
    tw.run(100);
    // D Harp Strings: 5 preview lines at once, the beams fire 45 ticks later; ≥ 24 px floor gaps.
    boss.setPart('strings', true);
    const tD = runAttack(tw, boss, boss.harpStrings(), () => (tw.ofType('harp-beam') as HarpBeam[]).some((b) => b.firing));
    expect(tD).toBeGreaterThanOrEqual(45);
    const beams = tw.ofType('harp-beam') as HarpBeam[];
    expect(beams.length).toBe(5);
    const ends = beams.map((b) => b.x1).sort((a, b) => a - b);
    for (let i = 1; i < ends.length; i++) expect(ends[i] - ends[i - 1] - 4).toBeGreaterThanOrEqual(24);
    tw.run(120);
    // E Pedal Stomp: 30 ticks of lifted legs, then a ground wave each way.
    const tE = runAttack(tw, boss, boss.pedalStomp(), () => count(tw, 'pedal-wave') > 0);
    expect(tE).toBeGreaterThanOrEqual(30);
    expect(count(tw, 'pedal-wave')).toBe(2);
    tw.run(160);
    // F Castor Charge (folded): 40 ticks of squealing castors, then it rolls to the far side and back.
    boss.foldTarget = 1;
    tw.run(30);
    const x1 = boss.x;
    const tF = runAttack(tw, boss, boss.castorCharge(), () => boss.x < x1 - 1);
    expect(tF).toBeGreaterThanOrEqual(40);
    let minX = boss.x;
    tw.until(() => {
      minX = Math.min(minX, boss.x);
      return boss.mode === 'hold';
    }, 600);
    expect(minX - 106).toBeLessThanOrEqual(8);
    expect(Math.abs(boss.x - 290)).toBeLessThan(1);
    tw.run(80);
    // G Grand Aria: the remaining chandeliers shake 60 ticks, then all fall.
    const hanging = boss.chandeliers.filter((c) => c.available);
    expect(hanging.length).toBe(2);
    const tG = runAttack(tw, boss, boss.grandAria(), () => hanging.some((c) => c.state === 'fall'));
    expect(tG).toBeGreaterThanOrEqual(60);
    expect(hanging.every((c) => c.state === 'fall')).toBe(true);
    tw.run(200);
    // G with no chandelier left: 6 crystal shards fall onto their shadows after 60 ticks.
    const top = tw.world.camera.top;
    const tG2 = runAttack(tw, boss, boss.grandAria(), () => (tw.ofType('crystal-shard') as CrystalShard[]).some((s) => s.y > top));
    expect(tG2).toBeGreaterThanOrEqual(60);
    expect(count(tw, 'crystal-shard')).toBe(6);
    expect(tw.world.errors).toEqual([]);
  });

  it('breaks its parts in order: lid → costume change → strings; the optional parts end their attacks', () => {
    const tw = stageArena({ god: true, playerX: 40 });
    const boss = spawnGrand(tw);
    tw.until(() => fightOf(boss), 600);
    // The strings take no damage while the lid is on.
    hitPart(boss, 'strings', 500);
    expect(boss.part('strings')!.hp).toBe(2500);
    // The optional parts: their score, the bar does not move.
    const hp0 = boss.hp;
    hitPart(boss, 'keyboard', 5000);
    hitPart(boss, 'front-legs', 5000);
    expect(boss.brokenCount(['keyboard', 'front-legs'])).toBe(2);
    expect(boss.hp).toBe(hp0);
    tw.run(1);
    const hammers = count(tw, 'felt-hammer');
    runAttack(tw, boss, boss.glissando(), () => false, 80);
    expect(count(tw, 'felt-hammer')).toBe(hammers);
    // The lid: phase 2 after the 60-tick intermission (curtain down, the strings exposed).
    expect(boss.phase).toBe(0);
    hitPart(boss, 'lid', 5000);
    expect(boss.phase).toBe(1);
    tw.run(20);
    expect(boss.curtain!.down).toBeGreaterThan(0.9);
    tw.run(50);
    expect(boss.curtain!.down).toBeLessThan(0.1);
    expect(boss.part('strings')!.enabled).toBe(true);
    expect(boss.tall).toBe(true);
    // Strings below half: phase 3, the legs fold.
    hitPart(boss, 'strings', 1300);
    expect(boss.phase).toBe(2);
    tw.run(70);
    expect(boss.fold).toBe(1);
    let defeated = 0;
    tw.world.events.on('bossDefeated', () => defeated++);
    hitPart(boss, 'strings', 5000);
    expect(boss.state).toBe('dying');
    const t = tw.until(() => boss.defeated, 500);
    expect(t).toBeGreaterThanOrEqual(280);
    expect(defeated).toBe(1);
    tw.run(80);
    expect(boss.removed).toBe(false); // the wreck and the fainted Countess stay
    expect(boss.curtain!.down).toBe(1); // the curtain falls on the show
    expect(tw.world.errors).toEqual([]);
  });

  it('can be won with the pistol and grenades from the balconies and the crate step (time to kill)', () => {
    const tw = stageArena({ god: true, playerX: 44 });
    const p = tw.player as Player;
    p.placeAt(44, BALCONY_Y, 0);
    const boss = spawnGrand(tw);
    let ticks = 0;
    // A simple player: on the left balcony, facing the piano, jump-shooting at the lid / the strings;
    // in phase 3 on the crate step (the folded strings are at its gun height). A grenade every 4 s.
    while (!boss.defeated && ticks < 20000) {
      const finale = boss.phase >= 2;
      const wantX = finale ? 120 : 44;
      const wantY = finale ? STEP_Y : BALCONY_Y;
      const b: Button[] = [];
      if (Math.abs(p.x - wantX) > 4) b.push(p.x < wantX ? 'right' : 'left');
      else if (p.facing < 0) b.push('right');
      if (ticks % 2 === 0) b.push('fire');
      if (ticks % 240 === 120) b.push('bomb');
      // Back up onto the platform when knocked off; jump-shoot now and then.
      if ((p.y > wantY + 4 && ticks % 30 === 0) || (!finale && ticks % 50 === 25)) b.push('jump');
      tw.hold(...b);
      tw.run(1);
      ticks++;
    }
    if (!boss.defeated) console.log('[boss-m4] not defeated:', boss.state, boss.phase, boss.x, p.x, p.y, boss.parts.map((q) => q.hp).join(' '));
    console.log(`[boss-m4] GRAND GRAND: defeated after ${ticks} ticks (${(ticks / 60).toFixed(1)} s) with the pistol + grenades`);
    expect(boss.defeated).toBe(true);
    expect(ticks).toBeLessThan(15000);
    expect(tw.world.errors).toEqual([]);
  });

  it('runs 3000 ticks without errors on HARD with a player that keeps moving', () => {
    const tw = stageArena({ difficulty: 'hard' });
    spawnGrand(tw);
    for (let i = 0; i < 3000; i++) {
      tw.hold(...(((i / 50) | 0) % 2 ? ['left', 'fire'] : ['right', 'fire']) as Button[]);
      if (i % 70 === 0) tw.hold('jump');
      tw.run(1);
    }
    expect(tw.world.errors).toEqual([]);
  });

  it('the finale\'s first Castor Charge has a lead-in: a player on the stage floor reaches a balcony in time (fairness)', () => {
    // Integrator regression: the only safe spots from the charge are the balconies, two jumps away
    // via the crate step. With the bare 40-tick telegraph a player on the floor at the phase change
    // could not escape; the first charge after the fold now telegraphs FIRST_CHARGE_LEAD longer.
    const tw = stageArena({ playerX: 60 });
    const p = tw.player as Player;
    const boss = spawnGrand(tw);
    quietBoss(tw, boss);
    boss.setPart('lid', false);
    tw.run(200); // past the spawn blink
    boss.finale();
    tw.run(30);
    p.placeAt(60, FLOOR, 0);
    let died = 0;
    tw.world.events.on('playerDied', () => died++);
    const x0 = boss.x;
    tw.world.scripts.run(boss.castorCharge() as never, { owner: boss });
    // A player who climbs: to the crate step (stand still, jump straight up), then left to the balcony.
    let tele = -1;
    let onStep = false;
    for (let t = 0; t < 360; t++) {
      const b: Button[] = [];
      if (!p.onGround) {
        b.push('jump');
        if (onStep) b.push('left');
        else if (Math.abs(p.x - 124) > 3) b.push(p.x < 124 ? 'right' : 'left');
      } else if (p.y > 150) {
        if (Math.abs(p.x - 124) > 10) b.push(p.x < 124 ? 'right' : 'left');
        else b.push('jump');
      } else if (p.y > 120) {
        onStep = true;
        if (p.x > 108) b.push('left');
        else b.push('jump', 'left');
      } else if (p.x > 44) b.push('left');
      tw.hold(...b);
      tw.run(1);
      if (tele < 0 && boss.x < x0 - 1) tele = t;
    }
    expect(tele).toBeGreaterThanOrEqual(40 + FIRST_CHARGE_LEAD - 2);
    expect(died).toBe(0);
    expect(p.y).toBe(BALCONY_Y);
    // The next charge is back to the GDD's 40 ticks.
    const x1 = boss.x;
    const t2 = runAttack(tw, boss, boss.castorCharge(), () => boss.x < x1 - 1);
    expect(t2).toBeGreaterThanOrEqual(40);
    expect(t2).toBeLessThan(40 + FIRST_CHARGE_LEAD);
  });

  it('a falling chandelier crushes the player under it and leaves a solid for 300 ticks; over a balcony it lands on the balcony', () => {
    const tw = stageArena({ playerX: 300 });
    tw.run(240); // past the spawn blink
    const ch = tw.world.spawn('chandelier', 300, 6, {}) as Chandelier;
    tw.world.flush();
    ch.drop(20);
    let died = 0;
    tw.world.events.on('playerDied', () => died++);
    tw.until(() => ch.state === 'down', 200);
    expect(died).toBe(1);
    tw.run(299);
    expect(ch.state).toBe('down');
    tw.run(2);
    expect(ch.removed).toBe(true);
    const over = tw.world.spawn('chandelier', 180, 6, {}) as Chandelier;
    tw.world.flush();
    over.drop(20);
    tw.until(() => over.state === 'down', 200);
    expect(over.y).toBe(BALCONY_Y);
  });
});

// ---------------------------------------------------------------------------------------------
// THE BIG HEAD
// ---------------------------------------------------------------------------------------------

function plazaArena(o: { god?: boolean; difficulty?: 'easy' | 'normal' | 'hard'; playerX?: number } = {}): TestWorld {
  const tw = new TestWorld({ width: 400, god: o.god, difficulty: o.difficulty, playerX: o.playerX ?? 60, build: (t) => t.solid(384, 0, 16, FLOOR) });
  tw.world.camera.lock(0, 384);
  tw.world.camera.snap();
  return tw;
}

function spawnHead(tw: TestWorld, params: Record<string, unknown> = {}): BigHead {
  return tw.spawn('big-head', 480, { arenaLeft: 0, ...params }, 72) as BigHead;
}

describe('THE BIG HEAD', () => {
  it('floats in, bobs between y 4 and 20 and drifts inside the arena', () => {
    const tw = plazaArena();
    const h = spawnHead(tw);
    expect(h.parts.map((p) => p.name)).toEqual(['moustache-left', 'moustache-right', 'mouth-speaker', 'head']);
    expect(h.part('head')!.required).toBe(true);
    tw.until(() => fightOf(h), 600);
    expect(Math.abs(h.x - 250)).toBeLessThan(1);
    let top = Infinity;
    let bot = -Infinity;
    let minX = Infinity;
    let maxX = -Infinity;
    h.phases = [];
    for (let i = 0; i < 900; i++) {
      tw.run(1);
      top = Math.min(top, h.y - 60);
      bot = Math.max(bot, h.y - 60);
      minX = Math.min(minX, h.x);
      maxX = Math.max(maxX, h.x);
    }
    expect(top).toBeGreaterThanOrEqual(3.9);
    expect(bot).toBeLessThanOrEqual(20.1);
    expect(FLOOR - (h.y + 60)).toBeGreaterThanOrEqual(35.9);
    expect(minX).toBeGreaterThanOrEqual(89);
    expect(maxX).toBeLessThanOrEqual(295);
    expect(tw.world.errors).toEqual([]);
  });

  it('fires every attack only after its telegraph', () => {
    const tw = plazaArena({ god: true, playerX: 200 });
    const h = spawnHead(tw);
    quietBoss(tw, h);
    // A Moustache Volley: 30 ticks, then 3 aimed bullets per tip.
    const tA = runAttack(tw, h, h.moustacheVolley(), () => count(tw, 'enemy-bullet') > 0);
    expect(tA).toBeGreaterThanOrEqual(30);
    tw.run(20);
    expect(count(tw, 'enemy-bullet')).toBe(6);
    tw.run(160);
    // B Propaganda Drop: 24 ticks, then 8 leaflets and 2 leaflet bombs.
    const tB = runAttack(tw, h, h.propagandaDrop(), () => count(tw, 'leaflet') + count(tw, 'leaflet-bomb') > 0);
    expect(tB).toBeGreaterThanOrEqual(24);
    tw.run(40);
    expect(count(tw, 'leaflet')).toBe(8);
    expect(count(tw, 'leaflet-bomb')).toBe(2);
    tw.run(400);
    // C ATTENTION!: 40 ticks, then the cone for 30 ticks.
    const tC = runAttack(tw, h, h.attentionCone(), () => count(tw, 'sonic-cone') > 0);
    expect(tC).toBeGreaterThanOrEqual(40);
    tw.run(32);
    expect(count(tw, 'sonic-cone')).toBe(0);
    expect(tw.world.errors).toEqual([]);
  });

  it('the cone hurts only under the mouth; ATTENTION! is gone with the speaker', () => {
    const tw = plazaArena({ playerX: 40 });
    const h = spawnHead(tw);
    quietBoss(tw, h);
    let died = 0;
    tw.world.events.on('playerDied', () => died++);
    runAttack(tw, h, h.attentionCone(), () => false, 120);
    expect(died).toBe(0);
    const p = tw.player as Player;
    p.placeAt(h.x, FLOOR, 0);
    runAttack(tw, h, h.attentionCone(), () => died > 0, 120);
    expect(died).toBe(1);
    hitPart(h, 'mouth-speaker', 5000);
    tw.run(200);
    runAttack(tw, h, h.attentionCone(), () => false, 120);
    expect(count(tw, 'sonic-cone')).toBe(0);
  });

  it('paratroopers [N] every 600 ticks; none on EASY', () => {
    for (const [difficulty, want] of [
      ['normal', 3],
      ['easy', 0],
    ] as const) {
      const tw = plazaArena({ god: true, difficulty });
      const h = spawnHead(tw);
      quietBoss(tw, h);
      tw.run(660);
      expect(count(tw, 'rifleman')).toBe(want);
    }
  });

  it('the speaker halves the damage to the head; the head ends the fight; it deflates onto the statue', () => {
    const tw = plazaArena({ god: true });
    const h = spawnHead(tw);
    tw.until(() => fightOf(h), 600);
    hitPart(h, 'head', 200);
    expect(h.part('head')!.hp).toBe(1400);
    hitPart(h, 'mouth-speaker', 5000);
    hitPart(h, 'head', 200);
    expect(h.part('head')!.hp).toBe(1200);
    let defeated = 0;
    tw.world.events.on('bossDefeated', () => defeated++);
    hitPart(h, 'head', 5000);
    expect(h.state).toBe('dying');
    tw.until(() => h.defeated, 600);
    expect(defeated).toBe(1);
    expect(h.masked).toBe(true);
    expect(Math.abs(h.x - h.statueX)).toBeLessThan(1);
    expect(tw.world.errors).toEqual([]);
  });

  it('can be won with the pistol and grenades from under it (time to kill)', () => {
    const tw = plazaArena({ god: true, playerX: 200 });
    const p = tw.player as Player;
    const h = spawnHead(tw);
    let ticks = 0;
    // Follow the blimp and shoot up: under the speaker first, then the head beside it.
    while (!h.defeated && ticks < 12000) {
      const wantX = h.partAlive('mouth-speaker') ? h.x : h.x + (h.partAlive('moustache-right') ? 66 : 34);
      // Up + a direction aims 45° (GDD §4.3): walk into place, then stand and aim straight up.
      const b: Button[] = [];
      if (Math.abs(p.x - wantX) > 3) b.push(p.x < wantX ? 'right' : 'left');
      else b.push('up');
      if (ticks % 2 === 0) b.push('fire');
      if (ticks % 240 === 120) b.push('bomb');
      tw.hold(...b);
      tw.run(1);
      ticks++;
    }
    if (!h.defeated) console.log('[boss-m4] big head not defeated:', h.state, h.x, p.x, h.parts.map((q) => q.hp).join(' '));
    console.log(`[boss-m4] BIG HEAD: defeated after ${ticks} ticks (${(ticks / 60).toFixed(1)} s) with the pistol + grenades`);
    expect(h.defeated).toBe(true);
    expect(tw.world.errors).toEqual([]);
  });

  it('runs 3000 ticks without errors on HARD', () => {
    const tw = plazaArena({ difficulty: 'hard' });
    spawnHead(tw);
    for (let i = 0; i < 3000; i++) {
      tw.hold(...(((i / 40) | 0) % 2 ? ['left', 'fire', 'up'] : ['right', 'fire']) as Button[]);
      if (i % 60 === 0) tw.hold('jump');
      tw.run(1);
    }
    expect(tw.world.errors).toEqual([]);
  });
});
