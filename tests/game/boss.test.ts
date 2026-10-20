import { describe, expect, it } from 'vitest';
import type { Damage } from '../../src/engine/entity';
import type { ScriptGen } from '../../src/engine/script';
import type { World } from '../../src/engine/world';
import { Boss } from '../../src/game/boss';
import { defineEntity, type SpawnParams } from '../../src/game/registry';
import { DIFFICULTY } from '../../src/game/session';
import { FLOOR, Rig } from './helpers';

class TestBoss extends Boss {
  readonly log: string[] = [];
  introDone = false;

  constructor(world: World, x: number, y: number, p: SpawnParams = {}) {
    super(world, x, y, p, { art: 'boss/test', name: 'TEST TITAN', hp: 1000, score: 5000 });
    this.addPart('body', { box: { x: -30, y: -60, w: 60, h: 60 } });
    this.addPart('eye', { box: { x: 10, y: -80, w: 12, h: 12 }, multiplier: 2 });
    this.addPart('shield', { box: { x: -50, y: -50, w: 10, h: 50 }, armored: true });
    this.addPart('cannon', { box: { x: -40, y: -90, w: 20, h: 14 }, hp: 100 });
    this.phases = [
      { at: 1, name: 'calm', pattern: (b) => b.pattern('calm'), resume: (b) => b.pattern('calm-resume') },
      { at: 0.5, name: 'rage', pattern: (b) => b.pattern('rage') },
    ];
  }

  /** Test switch: end the attack cleanly on a stagger (`cutAttack` true). */
  cuts = false;
  cutCount = 0;

  protected override cutAttack(): boolean {
    if (!this.cuts) return false;
    this.cutCount++;
    return true;
  }

  override *intro(): ScriptGen {
    yield 10;
    this.introDone = true;
  }

  *pattern(name: string): ScriptGen {
    try {
      for (;;) {
        this.log.push(name);
        yield 20;
      }
    } finally {
      this.log.push(`${name}:end`);
    }
  }
}
defineEntity('test-boss', (w, x, y, p) => new TestBoss(w, x, y, p), { category: 'boss' });

const hit = (amount: number, owner = 0): Damage => ({ amount, kind: 'bullet', dirX: 1, owner });

function setup(): { rig: Rig; boss: TestBoss } {
  const rig = new Rig();
  const boss = rig.world.spawn('test-boss', 300, FLOOR) as TestBoss;
  rig.world.flush();
  return { rig, boss };
}

describe('bosses', () => {
  it('a stagger (a continued hero landed) holds the attack pattern for its ticks, then it runs on; only in the fight', () => {
    const { rig, boss } = setup();
    rig.run(1);
    boss.stagger(30);
    expect(boss.staggering).toBe(false); // not in the intro
    rig.run(11);
    expect(boss.state).toBe('fight');
    const n = boss.log.length;
    boss.stagger(50);
    expect(boss.staggering).toBe(true);
    expect(boss.holdAdds).toBe(true);
    rig.run(45);
    expect(boss.log.length).toBe(n); // held: two 20-tick beats would have logged
    expect(boss.log).not.toContain('calm:end'); // held, never cancelled
    rig.run(30);
    expect(boss.staggering).toBe(false);
    expect(boss.holdAdds).toBe(false);
    expect(boss.log.length).toBeGreaterThan(n);
    boss.addsHeld = true;
    expect(boss.holdAdds).toBe(true);
  });

  it('a boss that can cut its attack (cutAttack): the stagger cancels the pattern at once and runs the phase resume script after it', () => {
    const { rig, boss } = setup();
    boss.cuts = true;
    rig.run(12);
    expect(boss.state).toBe('fight');
    boss.stagger(40);
    rig.run(1);
    expect(boss.cutCount).toBe(1);
    expect(boss.log).toContain('calm:end'); // cancelled, not paused
    const n = boss.log.length;
    rig.run(30);
    expect(boss.log.length).toBe(n);
    expect(boss.staggering).toBe(true);
    rig.run(12);
    expect(boss.staggering).toBe(false);
    expect(boss.log[n]).toBe('calm-resume'); // the phase runs on with its resume script
    expect(boss.cutCount).toBe(1);
    // A phase entered during a stagger is only held (its intermission), never cut.
    boss.stagger(60);
    rig.run(1);
    expect(boss.cutCount).toBe(2);
    boss.phaseIntermission = 20;
    rig.world.damage(boss, hit(600), 0);
    expect(boss.phase).toBe(1);
    rig.run(5);
    expect(boss.cutCount).toBe(2);
    rig.until(() => boss.log.includes('rage'), 120);
    expect(boss.staggering).toBe(false);
  });

  it('is invulnerable during the intro, then fights in phase 0', () => {
    const { rig, boss } = setup();
    rig.run(1);
    expect(boss.state).toBe('intro');
    expect(rig.world.damage(boss, hit(50), 0)).toBe(true); // absorbed …
    expect(boss.hp).toBe(1000); // … without damage
    rig.run(12);
    expect(boss.introDone).toBe(true);
    expect(boss.state).toBe('fight');
    expect(boss.phase).toBe(0);
    expect(boss.log[0]).toBe('calm');
  });

  it('routes damage by part: multipliers, armour, breakable parts', () => {
    const { rig, boss } = setup();
    rig.run(12);
    rig.world.damage(boss, hit(10), 0);
    expect(boss.hp).toBe(990);
    rig.world.damage(boss, hit(10), 1); // weak point ×2
    expect(boss.hp).toBe(970);
    expect(rig.world.damage(boss, hit(10), 2)).toBe(true); // armour absorbs
    expect(boss.hp).toBe(970);
    rig.world.damage(boss, hit(60), 3);
    rig.world.damage(boss, hit(60), 3);
    const cannon = boss.part('cannon');
    expect(cannon?.destroyed).toBe(true);
    expect(boss.hp).toBe(970); // its own pool
    // A destroyed part cannot be hit any more and reports an off-world box.
    expect(boss.hurtboxes()[3].x).toBeLessThan(-1e8);
    expect(rig.world.damage(boss, hit(10), 3)).toBe(false);
  });

  it('enters the next phase at its HP threshold (pattern switch + event)', () => {
    const { rig, boss } = setup();
    const phases: number[] = [];
    rig.world.events.on('bossPhase', (e) => phases.push(e.phase));
    rig.run(12);
    rig.world.damage(boss, hit(400), 0);
    rig.run(2);
    expect(boss.phase).toBe(0);
    rig.world.damage(boss, hit(150), 0);
    rig.run(2);
    expect(boss.phase).toBe(1);
    expect(phases).toEqual([0, 1]);
    expect(boss.log).toContain('calm:end');
    expect(boss.log[boss.log.length - 1]).toBe('rage');
    expect(boss.damageState).toBe(1);
  });

  it('dies with a chain of explosions, then emits bossDefeated and scores', () => {
    const { rig, boss } = setup();
    let defeated = false;
    let explosions = 0;
    rig.world.events.on('bossDefeated', () => (defeated = true));
    rig.world.events.on('explosion', () => explosions++);
    rig.run(12);
    rig.world.damage(boss, hit(5000), 0);
    expect(boss.state).toBe('dying');
    expect(boss.dead).toBe(true);
    expect(rig.session.slots[0].score).toBe(5000);
    expect(boss.log).toContain('calm:end');
    rig.run(boss.deathTicks + 2);
    expect(defeated).toBe(true);
    expect(boss.defeated).toBe(true);
    expect(explosions).toBeGreaterThan(10);
    expect(boss.removed).toBe(true);
  });

  it('scales HP with difficulty and co-op', () => {
    const rig = new Rig({ players: 2 });
    rig.session.difficulty = 'hard';
    const boss = rig.world.spawn('test-boss', 300, FLOOR) as TestBoss;
    expect(boss.maxHp).toBe(Math.round(1000 * DIFFICULTY.hard.bossHp * 1.5));
  });
});
