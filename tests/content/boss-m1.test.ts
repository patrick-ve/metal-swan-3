/**
 * THE ENCORE (m1 boss, GDD §10.1): spawn, every attack after its telegraph, parts breaking in
 * order, a won fight with the pistol and grenades (time to kill measured), the death sequence
 * and the 'bossDefeated' event, no errors.
 */
import { describe, expect, it } from 'vitest';
import { buttonMask, type Button } from '../../src/engine/input';
import type { ScriptGen } from '../../src/engine/script';
import '../../src/game/content/infantry/index';
import { Encore } from '../../src/game/content/bosses/m1/index';
import type { Barrel } from '../../src/game/content/bosses/m1/shots';
import { ENC, ENCORE } from '../../src/game/content/bosses/m1/geometry';
import { FLOOR, TestWorld } from './helpers';

const BOW = 520;
/** The upper floating crate of the m1 arena (2760, 136) relative to the bow (2848) and the pontoon (176). */
const CRATE_X = BOW - 88;
const CRATE_Y = FLOOR - 40;

function arena(o: { god?: boolean; difficulty?: 'easy' | 'normal' | 'hard'; playerX?: number } = {}): { tw: TestWorld; boss: Encore } {
  const tw = new TestWorld({
    width: 1400,
    god: o.god ?? true,
    difficulty: o.difficulty,
    playerX: o.playerX ?? 300,
    build: (t) => {
      t.platform(CRATE_X - 16, CRATE_Y, 32);
    },
  });
  const boss = tw.spawn('encore', BOW, {}, FLOOR) as Encore;
  return { tw, boss };
}

/** Start a fight without the intro, phases or patterns: the attacks are run one by one. */
function bare(o: { difficulty?: 'easy' | 'normal' | 'hard'; turned?: boolean } = {}): { tw: TestWorld; boss: Encore } {
  const a = arena({ ...o, playerX: 420 });
  a.boss.autoStart = false;
  a.boss.state = 'fight';
  if (o.turned) {
    // Phases 2–3: stern first, the wheel where the bow was.
    a.boss.facing = 1;
    a.boss.x = BOW + ENC.len;
  }
  return a;
}

const TURNED = new Set(['paddle-wave', 'barrel', 'soot-ball', 'brass-pellet']);

/** Run an attack script; returns the ticks until the first projectile of `type` exists. */
function firstShot(tw: TestWorld, boss: Encore, gen: ScriptGen, type: string, max = 300): number {
  tw.world.scripts.run(gen, { owner: boss });
  return tw.until(() => tw.ofType(type).length > 0, max);
}

describe('THE ENCORE (encore)', () => {
  it('spawns with the GDD parts, HP and score, on the waterline', () => {
    const { tw, boss } = arena();
    expect(boss).toBeInstanceOf(Encore);
    expect(boss.parts.map((p) => p.name)).toEqual(['horn', 'calliope', 'wheel', 'hull']);
    expect(boss.parts.slice(0, 3).map((p) => p.maxHp)).toEqual([1100, 1300, 1600]);
    expect(boss.parts.slice(0, 3).every((p) => p.required)).toBe(true);
    expect(boss.part('wheel')?.enabled).toBe(false);
    expect(boss.maxHp).toBe(4000);
    expect(boss.scoreValue()).toBe(30000);
    expect(boss.y).toBe(FLOOR);
    expect(boss.stageY).toBe(FLOOR);
    expect(boss.facing).toBe(-1);
    // Intro: steams in from the right, invulnerable, then the fight starts at the spawn x.
    tw.run(2);
    expect(boss.state).toBe('intro');
    expect(boss.x).toBeGreaterThan(BOW + 200);
    tw.until(() => boss.state === 'fight', ENCORE.intro + 10);
    expect(boss.x).toBe(BOW);
    expect(boss.phase).toBe(0);
  });

  it('snaps to the water surface under the bow', () => {
    const tw = new TestWorld({ width: 1200, playerX: 200, build: (t) => t.hazard('water', 400, 180, 800, 60) });
    const boss = tw.spawn('encore', 600, {}, 140) as Encore;
    expect(boss.y).toBe(180);
    expect(boss.waterY).toBe(180);
  });

  it.each([
    ['A Steam Scale', (b: Encore) => b.steamScale(), 'steam-note', ENCORE.steam.tele],
    ['B Foghorn', (b: Encore) => b.foghorn(), 'foghorn-wave', ENCORE.foghorn.tele],
    ['D Paddle Wave', (b: Encore) => b.paddleWave(), 'paddle-wave', ENCORE.paddle.tele],
    ['E Barrel Roll', (b: Encore) => b.barrelRoll(), 'barrel', ENCORE.barrels.tele],
    ['F Smoke Stack', (b: Encore) => b.smokeStack(), 'soot-ball', ENCORE.soot.tele],
    ['G Slide Shot', (b: Encore) => b.slideShot(), 'brass-pellet', ENCORE.slide.tele],
  ] as const)('%s fires after its telegraph', (_name, attack, type, tele) => {
    const { tw, boss } = bare({ turned: TURNED.has(type) });
    const t = firstShot(tw, boss, attack(boss), type);
    expect(t).toBeGreaterThanOrEqual(Math.max(18, tele));
    expect(t).toBeLessThanOrEqual(tele + 4);
    expect(tw.world.errors).toEqual([]);
  });

  it('volleys: 6 notes leave steam puffs, 3 barrels roll, 4 soot balls, 3 pellets (HARD +1)', () => {
    const count = (difficulty: 'normal' | 'hard', attack: (b: Encore) => ScriptGen, type: string): number => {
      const { tw, boss } = bare({ difficulty, turned: TURNED.has(type) });
      let n = 0;
      tw.world.events.on('spawn', (e) => {
        if (e.type === type) n++;
      });
      tw.world.scripts.run(attack(boss), { owner: boss });
      tw.run(260);
      return n;
    };
    expect(count('normal', (b) => b.steamScale(), 'steam-note')).toBe(6);
    expect(count('normal', (b) => b.steamScale(), 'steam-puff')).toBe(6);
    expect(count('hard', (b) => b.steamScale(), 'steam-note')).toBe(7);
    expect(count('normal', (b) => b.barrelRoll(), 'barrel')).toBe(3);
    expect(count('normal', (b) => b.smokeStack(), 'soot-ball')).toBe(4);
    expect(count('normal', (b) => b.slideShot(), 'brass-pellet')).toBe(3);
    expect(count('hard', (b) => b.slideShot(), 'brass-pellet')).toBe(4);
  });

  it('the foghorn wave is a jump (low) or crouch (high) band; the paddle wave hugs the stage', () => {
    const { tw, boss } = bare();
    const bottoms = new Set<number>();
    for (let k = 0; k < 6; k++) {
      tw.world.scripts.run(boss.foghorn(), { owner: boss });
      const t = tw.until(() => tw.ofType('foghorn-wave').length > 0, 120);
      expect(t).toBeGreaterThanOrEqual(18);
      for (const w of tw.ofType('foghorn-wave')) {
        bottoms.add(Math.round(w.y + w.hitbox.y + w.hitbox.h));
        expect(w.vx).toBeLessThan(0);
        w.remove();
      }
      tw.run(80);
    }
    for (const b of bottoms) expect([FLOOR, FLOOR - 22]).toContain(b);
    boss.facing = 1;
    boss.x = BOW + ENC.len;
    tw.world.scripts.run(boss.paddleWave(), { owner: boss });
    tw.until(() => tw.ofType('paddle-wave').length > 0, 120);
    const pw = tw.ofType('paddle-wave')[0];
    tw.run(10);
    expect(pw.y + pw.hitbox.y + pw.hitbox.h).toBe(FLOOR);
    expect(pw.hitbox.h).toBe(24);
  });

  it('barrels are knifeable 20-HP shots that roll toward the stage', () => {
    const { tw, boss } = bare({ turned: true });
    tw.world.scripts.run(boss.barrelRoll(), { owner: boss });
    tw.until(() => tw.ofType('barrel').length > 0, 120);
    const b = tw.ofType('barrel')[0];
    tw.until(() => (b as Barrel).rolling, 120);
    expect(b.vx).toBeCloseTo(-1.2, 5);
    expect(b.hp).toBe(20);
    expect(b.hasTag('shootable') && b.hasTag('soft')).toBe(true);
  });

  it('All Hands: 2 deck riflemen land on the stage in front of the bow every 600 ticks (not on EASY)', () => {
    const { tw, boss } = arena();
    tw.until(() => boss.state === 'fight', 400);
    tw.run(ENCORE.allHands.every + 2);
    const crew = tw.world.entities.filter((e) => e.type === 'rifleman' && !e.removed);
    expect(crew.length).toBe(2);
    tw.run(90);
    for (const c of crew) {
      expect(c.x).toBeLessThan(BOW);
      expect(Math.abs(c.y - FLOOR)).toBeLessThan(1);
    }
    const easy = arena({ difficulty: 'easy' });
    easy.tw.until(() => easy.boss.state === 'fight', 400);
    easy.tw.run(ENCORE.allHands.every + 2);
    expect(easy.tw.world.entities.filter((e) => e.type === 'rifleman').length).toBe(0);
  });

  it('a blast against the hull reaches the nearest live part; bullets on the hull only ping', () => {
    const { boss } = bare();
    const horn = boss.part('horn')!;
    const hull = boss.parts.length - 1;
    const src = { x: boss.wx(-20), y: boss.wy(-40) } as never;
    boss.onHit({ amount: 100, kind: 'explosion', dirX: 1, owner: 0, source: src }, hull);
    expect(horn.hp).toBe(1000);
    boss.onHit({ amount: 10, kind: 'bullet', dirX: 1, owner: 0 }, hull);
    expect(boss.hp).toBe(3900);
  });

  it('is won with the pistol and grenades from a safe spot; parts break horn → calliope → wheel; the death sequence ends with bossDefeated', () => {
    const { tw, boss } = arena({ playerX: CRATE_X });
    const p = tw.player!;
    p.placeAt(CRATE_X, CRATE_Y, 0);
    const order: string[] = [];
    let defeated = 0;
    tw.world.events.on('bossDefeated', () => defeated++);
    tw.until(() => boss.state === 'fight', 400);
    const start = tw.world.tick;
    let fightTicks = 0;
    let onFloor = false;
    let grenades = 0;
    for (let i = 0; i < 20000 && !boss.dead; i++) {
      // Phase 2+: the wheel sits low at the stern; step down to the stage in front of it.
      if (boss.phase >= 1 && !onFloor && boss.invulnTicks <= 0) {
        p.placeAt(BOW - 60, FLOOR, 0);
        onFloor = true;
      }
      const btn: Button[] = ['right'];
      if (i % 2 === 0) btn.push('fire');
      if (i % 100 === 50 && p.slot.bombs > 0) {
        btn.push('bomb');
        grenades++;
      }
      tw.pad.update(buttonMask(...btn));
      tw.world.update();
      for (const part of boss.parts) if (part.destroyed && !order.includes(part.name)) order.push(part.name);
      // Hold still (the 'right' press only faces the boss).
      if (onFloor) p.x = BOW - 60;
      else p.x = CRATE_X;
    }
    fightTicks = tw.world.tick - start;
    expect(boss.dead).toBe(true);
    expect(order).toEqual(['horn', 'calliope', 'wheel']);
    // A fair fight: under 90 s of fighting with the starting pistol and 10 grenades.
    expect(fightTicks).toBeLessThan(90 * 60);
    console.info(`[boss-m1] time to kill: ${fightTicks} ticks (${(fightTicks / 60).toFixed(1)} s), grenades thrown ${grenades}`);
    // The death sequence: 300 ticks, then 'bossDefeated' once and Blare paddles off in a ring.
    const dt = tw.until(() => boss.defeated, ENCORE.death + 30);
    expect(dt).toBeGreaterThan(ENCORE.death - 20);
    expect(defeated).toBe(1);
    tw.run(2);
    expect(tw.ofType('encore-blare-ring').length).toBe(1);
    expect(boss.removed).toBe(true);
    expect(tw.world.errors).toEqual([]);
  });

  it('runs 3000 ticks of a full fight against a mortal, idle player without errors', () => {
    const { tw, boss } = arena({ god: false, playerX: 300 });
    let phases = 0;
    tw.world.events.on('bossPhase', () => phases++);
    tw.run(3000);
    expect(tw.world.errors).toEqual([]);
    expect(phases).toBeGreaterThanOrEqual(1);
    expect(boss.removed).toBe(false);
  });

  it('phases: the turn-around puts the stern (wheel) where the bow was; phase 3 starts below half the wheel', () => {
    const { tw, boss } = arena();
    tw.until(() => boss.state === 'fight', 400);
    const d = { amount: 5000, kind: 'explosion' as const, dirX: 1, owner: 0 };
    boss.onHit({ ...d }, 0);
    boss.onHit({ ...d }, 1);
    expect(boss.phase).toBe(1);
    tw.run(ENCORE.turnTicks + 4);
    expect(boss.facing).toBe(1);
    expect(boss.frontX()).toBe(BOW);
    expect(boss.part('wheel')?.enabled).toBe(true);
    const wheel = boss.part('wheel')!;
    boss.onHit({ ...d, amount: 700 }, 2);
    expect(boss.phase).toBe(1);
    boss.onHit({ ...d, amount: 200 }, 2);
    expect(boss.phase).toBe(2);
    expect(wheel.hp).toBe(700);
    tw.run(ENCORE.encoreTicks + 300);
    expect(boss.blareAt).toBe('rail');
    expect(boss.sink).toBeGreaterThan(0);
    expect(tw.world.errors).toEqual([]);
    expect(ENC.len).toBe(288);
  });
});
