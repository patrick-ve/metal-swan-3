/**
 * ROBO-HALSEMA (`ams-mayor`, docs/design/amsterdam.md §3): spawn and intro, every attack after its
 * telegraph, the parts breaking in order (the medallion armoured until the stamp arm and the
 * chain are gone), the add caps, a won fight with the pistol (forward, then the 45° diagonal) and
 * grenades (time to kill measured), the death sequence and 'bossDefeated', no errors.
 */
import { describe, expect, it } from 'vitest';
import { buttonMask, type Button } from '../../src/engine/input';
import type { ScriptGen } from '../../src/engine/script';
import '../../src/game/content/locals/index';
import { AmsMayor, MAYOR } from '../../src/game/content/bosses/ams/index';
import { FLOOR, TestWorld } from './helpers';

const DOOR = 620;
const HOME = DOOR - MAYOR.intro.step;

type Diff = 'easy' | 'normal' | 'hard';

function arena(o: { god?: boolean; difficulty?: Diff; playerX?: number; params?: Record<string, unknown> } = {}): { tw: TestWorld; boss: AmsMayor } {
  const tw = new TestWorld({ width: 1200, god: o.god ?? true, difficulty: o.difficulty, playerX: o.playerX ?? 420 });
  const boss = tw.spawn('ams-mayor', DOOR, o.params ?? {}, FLOOR) as AmsMayor;
  return { tw, boss };
}

/** A fight without the intro or the phase patterns: the attacks are run one by one. */
function bare(o: { difficulty?: Diff; phase?: 1 | 2 | 3; god?: boolean } = {}): { tw: TestWorld; boss: AmsMayor } {
  const a = arena({ difficulty: o.difficulty, playerX: 380, god: o.god });
  const b = a.boss;
  b.autoStart = false;
  b.state = 'fight';
  b.x = HOME;
  return a;
}

function runAttack(tw: TestWorld, boss: AmsMayor, gen: ScriptGen): void {
  tw.world.scripts.run(gen, { owner: boss });
}

describe('ROBO-HALSEMA (ams-mayor)', () => {
  it('spawns with the parts, HP and score from the brief; the intro steps her out of the doors', () => {
    const { tw, boss } = arena();
    expect(boss).toBeInstanceOf(AmsMayor);
    expect(boss.parts.map((p) => p.name)).toEqual(['stamp-arm', 'chain', 'medallion', 'head', 'legs', 'torso']);
    expect(boss.parts.slice(0, 4).map((p) => p.maxHp)).toEqual([MAYOR.hp.arm, MAYOR.hp.chain, MAYOR.hp.medallion, MAYOR.hp.head]);
    expect(boss.parts.slice(0, 4).map((p) => p.required)).toEqual([true, true, true, false]);
    expect(boss.part('medallion')?.armored).toBe(true);
    expect(boss.maxHp).toBe(MAYOR.hp.arm + MAYOR.hp.chain + MAYOR.hp.medallion);
    expect(boss.scoreValue()).toBe(MAYOR.score);
    expect(boss.y).toBe(FLOOR);
    expect(boss.facing).toBe(-1);
    // The medallion centre is 76 px over the floor.
    const m = MAYOR.box.medallion;
    expect(-(m.y + m.h / 2)).toBe(76);
    tw.run(2);
    expect(boss.state).toBe('intro');
    expect(boss.x).toBe(DOOR);
    // Invulnerable entrance.
    boss.onHit({ amount: 100, kind: 'bullet', dirX: 1, owner: 0 }, 0);
    expect(boss.part('stamp-arm')!.hp).toBe(MAYOR.hp.arm);
    const t = tw.until(() => boss.state === 'fight', MAYOR.intro.total + 10);
    expect(t).toBeGreaterThan(MAYOR.intro.total - 10);
    expect(boss.x).toBe(HOME);
    expect(boss.phase).toBe(0);
    expect(tw.world.errors).toEqual([]);
  });

  it('spawns and runs with {} params on a flat floor with no player in reach', () => {
    const tw = new TestWorld({ width: 900, playerX: 60, god: true });
    const boss = tw.spawn('ams-mayor', 500, {}) as AmsMayor;
    tw.run(600);
    expect(boss.removed).toBe(false);
    expect(tw.world.errors).toEqual([]);
  });

  describe.each(['easy', 'normal', 'hard'] as const)('on %s every attack starts after its telegraph (≥ 18 ticks)', (difficulty) => {
    const cases: Array<[string, (b: AmsMayor) => ScriptGen, (tw: TestWorld, b: AmsMayor) => boolean, number]> = [
      ['A stamp slam', (b) => b.stampSlam(), (tw) => tw.ofType('stamp-wave').length > 0, MAYOR.stamp.tele],
      ['B letter rain', (b) => b.letterRain(), (tw) => tw.ofType('noise-letter').length > 0, MAYOR.letters.tele],
      ['C chain whip (high)', (b) => b.chainWhip('high'), (_tw, b) => b.contactBoxes().length > 0, MAYOR.whip.tele],
      ['C chain whip (low)', (b) => b.chainWhip('low'), (_tw, b) => b.contactBoxes().length > 0, MAYOR.whip.tele],
      ['D shield fan', (b) => b.shieldFan(), (tw) => tw.ofType('shield-shot').length > 0, MAYOR.fan.tele],
      ['E stomp', (b) => b.stomp(1), (_tw, b) => b.contactBoxes().length > 0, MAYOR.stomp.tele],
    ];
    it.each(cases)('%s', (_name, attack, fired, tele) => {
      const { tw, boss } = bare({ difficulty });
      runAttack(tw, boss, attack(boss));
      const t = tw.until(() => fired(tw, boss), 200);
      expect(t).toBeGreaterThanOrEqual(18);
      expect(t).toBeGreaterThanOrEqual(boss.telegraphFor(tele));
      expect(t).toBeLessThanOrEqual(boss.telegraphFor(tele) + (_name.startsWith('E') ? MAYOR.stomp.air + 2 : 3));
      expect(tw.world.errors).toEqual([]);
    });
  });

  // The fan's safe lanes (geometry.ts MAYOR.fan): px in front of the muzzle (anchor − 8).
  const LANES: Array<[string, Diff, number, boolean, boolean]> = [
    ['normal: standing 170 px out is safe', 'normal', 170, false, false],
    ['normal: crouching 75 px out is safe', 'normal', 75, true, false],
    ['normal: crouching 200 px out is safe', 'normal', 200, true, false],
    ['normal: standing 75 px out is hit', 'normal', 75, false, true],
    ['hard: standing 170 px out is safe', 'hard', 170, false, false],
    ['hard: crouching 75 px out is hit (6th shot)', 'hard', 75, true, true],
  ];
  it.each(LANES)('shield fan lanes — %s', (_name, difficulty, d, crouch, hit) => {
    const { tw, boss } = bare({ difficulty, god: false });
    const p = tw.player!;
    p.x = boss.x - 8 - d;
    if (crouch) tw.hold('down');
    tw.run(4);
    runAttack(tw, boss, boss.shieldFan());
    let touched = false;
    for (let t = 0; t < 260 && !touched; t++) {
      tw.run(1);
      if (p.state !== 'play') touched = true;
    }
    expect(touched).toBe(hit);
  });

  it.each(['easy', 'normal', 'hard'] as const)('on %s the ams/stamp creak starts the slam telegraph and its baked-in slam (0.5 s) lands on the slam', (difficulty) => {
    const { tw, boss } = bare({ difficulty });
    const log: Array<{ id: string; tick: number; pitch: number }> = [];
    const audio = tw.world.audio as { sfx: (id: string, o?: { pitch?: number }) => unknown };
    const orig = audio.sfx.bind(audio);
    audio.sfx = (id: string, o?: { pitch?: number }) => {
      log.push({ id, tick: tw.world.tick, pitch: o?.pitch ?? 1 });
      return orig(id, o);
    };
    const t0 = tw.world.tick;
    runAttack(tw, boss, boss.stampSlam());
    const t = tw.until(() => tw.ofType('stamp-wave').length > 0, 200);
    const stamps = log.filter((e) => e.id === 'ams/stamp');
    expect(stamps.length).toBe(1);
    const slamTick = t0 + t;
    // 0.5 s = 30 ticks at rate 1; at rate r the slam is heard 30 / r ticks after the start.
    const heard = stamps[0].tick + 30 / stamps[0].pitch;
    expect(Math.abs(heard - slamTick)).toBeLessThanOrEqual(2);
  });

  it('volleys: two stamp waves (HARD four), 4–6 letters (HARD +1), a 5-shield fan (HARD 6)', () => {
    const count = (difficulty: Diff, attack: (b: AmsMayor) => ScriptGen, type: string): number => {
      const { tw, boss } = bare({ difficulty });
      let n = 0;
      tw.world.events.on('spawn', (e) => {
        if (e.type === type) n++;
      });
      runAttack(tw, boss, attack(boss));
      tw.run(200);
      return n;
    };
    // The slam itself is a stamp-wave too (the 56 × 22 impact).
    expect(count('normal', (b) => b.stampSlam(), 'stamp-wave')).toBe(3);
    expect(count('hard', (b) => b.stampSlam(), 'stamp-wave')).toBe(5);
    const letters = count('normal', (b) => b.letterRain(), 'noise-letter');
    expect(letters).toBeGreaterThanOrEqual(4);
    expect(letters).toBeLessThanOrEqual(6);
    expect(count('normal', (b) => b.shieldFan(), 'shield-shot')).toBe(5);
    expect(count('hard', (b) => b.shieldFan(), 'shield-shot')).toBe(6);
  });

  it('dodges: the stamp wave is jumped, the high lash crouched, the low lash jumped; the stomp only hurts under her feet', () => {
    const { tw, boss } = bare();
    runAttack(tw, boss, boss.stampSlam());
    tw.until(() => tw.ofType('stamp-wave').length >= 3, 120);
    const waves = tw.ofType('stamp-wave').filter((w) => w.vx !== 0);
    expect(waves.length).toBe(2);
    for (const w of waves) {
      expect(w.y + w.hitbox.y + w.hitbox.h).toBe(FLOOR);
      // A jump (apex 47 px) clears it.
      expect(w.hitbox.h).toBeLessThanOrEqual(16);
    }
    expect(waves.some((w) => w.vx < 0) && waves.some((w) => w.vx > 0)).toBe(true);
    for (const lane of ['high', 'low'] as const) {
      const b = bare();
      runAttack(b.tw, b.boss, b.boss.chainWhip(lane));
      b.tw.until(() => b.boss.contactBoxes().length > 0, 100);
      b.tw.run(MAYOR.whip.out);
      const r = b.boss.contactBoxes()[0];
      const top = FLOOR - r.y;
      const bottom = FLOOR - (r.y + r.h);
      if (lane === 'high') {
        // Over a crouching player (20 px), into a standing one.
        expect(bottom).toBeGreaterThanOrEqual(21);
        expect(top).toBeLessThanOrEqual(40);
      } else {
        expect(bottom).toBe(0);
        expect(top).toBeLessThanOrEqual(16);
      }
      // The lash reaches toward the players (left of her).
      expect(r.x + r.w).toBeLessThanOrEqual(b.boss.x - 20);
      expect(r.w).toBe(MAYOR.whip.reach);
    }
    runAttack(tw, boss, boss.stomp(1));
    tw.until(() => boss.contactBoxes().length > 0, 100);
    const feet = boss.contactBoxes()[0];
    expect(Math.abs(feet.x + feet.w / 2 - boss.x)).toBeLessThan(1);
    expect(feet.y + feet.h).toBe(FLOOR);
    expect(boss.x).toBe(HOME - MAYOR.stomp.dist);
    expect(boss.shadowX).toBe(HOME - MAYOR.stomp.dist);
    expect(tw.world.errors).toEqual([]);
  });

  it('parts break in order: the medallion stays armoured until the stamp arm and the chain are broken', () => {
    const { tw, boss } = arena();
    tw.until(() => boss.state === 'fight', 400);
    const med = boss.part('medallion')!;
    const shot = { amount: 10, kind: 'bullet' as const, dirX: 1, owner: 0 };
    const big = { amount: 5000, kind: 'bullet' as const, dirX: 1, owner: 0 };
    boss.onHit({ ...shot }, med.index);
    expect(med.hp).toBe(med.maxHp);
    boss.onHit({ ...big }, boss.part('stamp-arm')!.index);
    expect(boss.part('stamp-arm')!.destroyed).toBe(true);
    expect(boss.phase).toBe(1);
    expect(med.armored).toBe(true);
    boss.onHit({ ...shot }, med.index);
    expect(med.hp).toBe(med.maxHp);
    tw.run(MAYOR.phaseIntermission + 5);
    boss.onHit({ ...big }, boss.part('chain')!.index);
    expect(boss.part('chain')!.destroyed).toBe(true);
    expect(boss.phase).toBe(2);
    expect(med.armored).toBe(false);
    tw.run(MAYOR.phaseIntermission + 5);
    boss.onHit({ ...shot }, med.index);
    expect(med.hp).toBe(med.maxHp - 10);
    // Legs and torso only ping; a blast against the legs reaches the medallion (within 48 px).
    boss.onHit({ ...shot }, boss.part('legs')!.index);
    expect(med.hp).toBe(med.maxHp - 10);
    const src = { x: boss.x - 10, y: FLOOR - 40 } as never;
    boss.onHit({ amount: 50, kind: 'explosion', dirX: 1, owner: 0, source: src }, boss.part('legs')!.index);
    expect(med.hp).toBe(med.maxHp - 60);
    expect(tw.world.errors).toEqual([]);
  });

  it('a broken head stops the letter rain', () => {
    const { tw, boss } = bare();
    boss.onHit({ amount: 5000, kind: 'bullet', dirX: 1, owner: 0 }, boss.part('head')!.index);
    expect(boss.part('head')!.destroyed).toBe(true);
    runAttack(tw, boss, boss.letterRain());
    tw.run(120);
    expect(tw.ofType('noise-letter').length).toBe(0);
  });

  it('adds respect their caps: ≤ 3 handhavers (phase 1), one gull flock at a time (2), ≤ 1 rider (3)', () => {
    // The player stands far off and never shoots; god mode keeps him alive.
    for (const phase of [1, 2, 3] as const) {
      const { tw, boss } = arena({ playerX: 300, params: { phase } });
      tw.until(() => boss.state === 'fight', 400);
      let max = 0;
      let spawned = 0;
      const type = phase === 1 ? 'handhaver' : phase === 2 ? 'seagull' : 'delivery-rider';
      tw.world.events.on('spawn', (e) => {
        if (e.type === type) spawned++;
      });
      for (let i = 0; i < 2400; i++) {
        tw.run(1);
        const n = tw.world.entities.filter((e) => e.type === type && e.alive).length;
        max = Math.max(max, n);
      }
      expect(spawned).toBeGreaterThan(0);
      expect(max).toBeLessThanOrEqual(phase === 1 ? 3 : phase === 2 ? MAYOR.adds.flock : 1);
      expect(tw.world.errors).toEqual([]);
    }
  });

  it('adds come in from alternating sides in every phase (bug 7.1)', () => {
    for (const phase of [1, 2, 3] as const) {
      const { tw, boss } = arena({ playerX: 300, params: { phase } });
      tw.until(() => boss.state === 'fight', 400);
      const type = phase === 1 ? 'handhaver' : phase === 2 ? 'seagull' : 'delivery-rider';
      const sides: number[] = [];
      let lastTick = -1;
      tw.world.events.on('spawn', (e) => {
        if (e.type !== type || tw.world.tick === lastTick) return;
        lastTick = tw.world.tick;
        const mid = tw.world.camera.left + 192;
        sides.push(e.x < mid ? -1 : 1);
      });
      for (let i = 0; i < 3000; i++) {
        tw.run(1);
        // Clear the adds at once so the caps never hold the next one back.
        for (const e of tw.world.entities) if (e.type === type && e.alive && !e.removed) e.remove();
      }
      expect(sides.length, `phase ${phase}`).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < sides.length; i++) expect(sides[i], `phase ${phase} add ${i}`).toBe(-sides[i - 1]);
      expect(tw.world.errors).toEqual([]);
    }
  });

  describe('a stagger never leaves a live attack (bug 7.2)', () => {
    /** Ticks with a live attack box of hers (lash, landing) during the stagger. */
    const hotTicks = (tw: TestWorld, boss: AmsMayor): number => {
      let hot = 0;
      while (boss.staggering) {
        tw.run(1);
        if (boss.staggering && boss.contactBoxes().length > 0) hot++;
      }
      return hot;
    };

    it('the stamp slam lands on its baked-in sound, then she holds: arm, glow and shadow at rest, no new stamp sound', () => {
      const { tw, boss } = arena({ playerX: 300 });
      tw.until(() => boss.state === 'fight', 400);
      const audio = tw.world.audio as unknown as { log: string[] };
      tw.until(() => boss.armPose === 1 && boss.glowT > 0, 400);
      const soundAt = tw.world.tick - 1;
      expect(audio.log.at(-1) ?? '').toContain('ams/stamp');
      const waves = () => tw.world.entities.filter((e) => e.type === 'stamp-wave' && !e.removed).length;
      tw.run(4);
      boss.stagger(60);
      expect(boss.staggering).toBe(true);
      // The creak runs on to its slam: the slam comes on time, with the sound's baked-in slam.
      const slamWait = tw.until(() => waves() > 0, 60);
      const slamAt = tw.world.tick - 1;
      expect(slamAt - soundAt).toBe(MAYOR.stamp.tele);
      expect(slamWait).toBeGreaterThan(0);
      tw.run(1);
      expect(boss.armPose).toBe(0);
      expect(boss.glowT).toBe(0);
      expect(boss.shadowT).toBe(0);
      const logged = audio.log.length;
      expect(hotTicks(tw, boss)).toBe(0);
      expect(audio.log.slice(logged).filter((l) => l.includes('ams/stamp'))).toEqual([]);
      // Her phase runs on: the next tell comes.
      tw.until(() => boss.glowT > 0, 400);
      expect(tw.world.errors).toEqual([]);
    });

    it('the chain lash: out at the stagger, it goes off at once and stays off; the next whip follows', () => {
      const { tw, boss } = arena({ playerX: 300, params: { phase: 2 } });
      tw.until(() => boss.state === 'fight' && boss.phase === 1, 600);
      tw.until(() => boss.lashHot, 600);
      expect(boss.contactBoxes().length).toBe(1);
      boss.stagger(60);
      tw.run(1);
      expect(boss.lashHot).toBe(false);
      expect(boss.lashLen).toBe(0);
      expect(boss.backArm).toBe(0);
      expect(hotTicks(tw, boss)).toBe(0);
      tw.until(() => boss.lashHot, 600);
      expect(boss.lashHot).toBe(true);
      expect(tw.world.errors).toEqual([]);
    });

    it('the stomp: a stagger in mid-air waits for the landing, which is harmless; then she holds', () => {
      const { tw, boss } = arena({ playerX: 300, params: { phase: 3 } });
      tw.until(() => boss.state === 'fight' && boss.phase === 2, 600);
      tw.until(() => boss.lift > 0, 900);
      boss.stagger(60);
      let hot = 0;
      tw.until(() => {
        if (boss.contactBoxes().length > 0) hot++;
        return boss.lift === 0;
      }, 60);
      expect(hot).toBe(0);
      expect(boss.stompHot).toBe(0);
      expect(hotTicks(tw, boss)).toBe(0);
      // A stagger during the stomp tell cuts it (no hop, no shadow).
      tw.until(() => boss.shadowT > 0 && boss.shadowFrame === 1 && boss.lift === 0, 900);
      const x = boss.x;
      boss.stagger(40);
      tw.run(1);
      expect(boss.shadowT).toBe(0);
      expect(hotTicks(tw, boss)).toBe(0);
      expect(boss.x).toBe(x);
      // She runs on (home again first when the cut left her out).
      tw.run(400);
      expect(tw.world.errors).toEqual([]);
    });

    it('the stagger look stays: the shout face shake; the adds are held', () => {
      const { tw, boss } = arena({ playerX: 300 });
      tw.until(() => boss.state === 'fight', 400);
      tw.run(20);
      boss.stagger(60);
      expect(boss.holdAdds).toBe(true);
      expect(boss.staggering).toBe(true);
      tw.run(61);
      expect(boss.staggering).toBe(false);
    });
  });

  it('is won with the pistol (forward, then the 45° diagonal) and grenades; the death sequence ends with bossDefeated', () => {
    const { tw, boss } = arena({ playerX: 300 });
    const p = tw.player!;
    const order: string[] = [];
    let defeated = 0;
    tw.world.events.on('bossDefeated', () => defeated++);
    tw.until(() => boss.state === 'fight', 400);
    const start = tw.world.tick;
    let grenades = 0;
    const bulletHits = new Map<string, number>();
    tw.world.events.on('hit', (e) => {
      if (e.target !== boss || e.damage.kind !== 'bullet') return;
      const name = boss.parts[e.part ?? 0]?.name ?? '?';
      bulletHits.set(name, (bulletHits.get(name) ?? 0) + 1);
    });
    for (let i = 0; i < 20000 && !boss.dead; i++) {
      // Phase 1: shoot the stamp forward from 110 px. Then the 45° diagonal: the chain from
      // 105 px, the medallion from 64 px (the player follows her stomps).
      const diag = boss.partAlive('stamp-arm') ? 0 : 1;
      const dist = diag === 0 ? 110 : boss.partAlive('chain') ? 105 : 64;
      const btn: Button[] = ['right'];
      if (diag) btn.push('up');
      if (i % 2 === 0) btn.push('fire');
      if (i % 100 === 50 && p.slot.bombs > 0) {
        btn.push('bomb');
        grenades++;
      }
      tw.pad.update(buttonMask(...btn));
      tw.world.update();
      p.x = boss.x - dist;
      for (const part of boss.parts) if (part.destroyed && !order.includes(part.name)) order.push(part.name);
    }
    const fightTicks = tw.world.tick - start;
    expect(boss.dead).toBe(true);
    expect(order.slice(0, 2)).toEqual(['stamp-arm', 'chain']);
    expect(order).toContain('medallion');
    // The chain and the medallion took pistol bullets (only the diagonal reaches them).
    expect(bulletHits.get('chain') ?? 0).toBeGreaterThan(20);
    expect(bulletHits.get('medallion') ?? 0).toBeGreaterThan(20);
    console.info(`[boss-ams] time to kill: ${fightTicks} ticks (${(fightTicks / 60).toFixed(1)} s), grenades thrown ${grenades}, parts ${order.join(' → ')}`);
    expect(fightTicks).toBeLessThan(120 * 60);
    const dt = tw.until(() => boss.defeated, MAYOR.death + 30);
    expect(dt).toBeGreaterThan(MAYOR.death - 20);
    expect(defeated).toBe(1);
    tw.run(2);
    expect(boss.removed).toBe(true);
    expect(tw.world.errors).toEqual([]);
  });

  it('the 45° diagonal (up + toward) reaches the chain and, later, the medallion from a fair distance', () => {
    /** Distances (player x → her anchor) at which diagonal shots hit `part` within 90 ticks. */
    const reach = (phase: 1 | 2 | 3, part: string): number[] => {
      const out: number[] = [];
      for (let d = 30; d <= 160; d += 6) {
        const { tw, boss } = arena({ playerX: 200, params: { phase } });
        tw.until(() => boss.state === 'fight', 400);
        tw.run(MAYOR.phaseIntermission + 2);
        boss.autoStart = false;
        let hit = 0;
        tw.world.events.on('hit', (e) => {
          if (e.target === boss && e.damage.kind === 'bullet' && boss.parts[e.part ?? 0]?.name === part) hit++;
        });
        const p = tw.player!;
        const x = boss.x;
        for (let i = 0; i < 90; i++) {
          tw.pad.update(buttonMask('right', 'up', ...(i % 2 === 0 ? (['fire'] as Button[]) : [])));
          // Hold her still (no stomp) and the player at the distance.
          boss.x = x;
          tw.world.update();
          p.x = x - d;
        }
        if (hit > 0) out.push(d);
      }
      return out;
    };
    const chain = reach(2, 'chain');
    const med = reach(3, 'medallion');
    console.info(`[boss-ams] diagonal reach: chain ${chain[0]}–${chain[chain.length - 1]} px, medallion ${med[0]}–${med[med.length - 1]} px`);
    expect(chain.length).toBeGreaterThan(3);
    expect(med.length).toBeGreaterThan(3);
    expect(med.some((d) => d >= 60 && d <= 80)).toBe(true);
  });

  it('runs 4000 ticks against a mortal, idle player without errors', () => {
    const { tw, boss } = arena({ god: false, playerX: 380 });
    tw.run(4000);
    expect(tw.world.errors).toEqual([]);
    expect(boss.removed).toBe(false);
  });

  it('all three phases and the death run 4000 ticks without errors (hard, sandbox phase param)', () => {
    for (const phase of [1, 2, 3]) {
      const { tw, boss } = arena({ difficulty: 'hard', params: { phase } });
      tw.run(1500);
      expect(boss.phase).toBe(phase - 1);
      boss.kill(0);
      tw.run(400);
      expect(boss.removed).toBe(true);
      expect(tw.world.errors).toEqual([]);
    }
  });
});
