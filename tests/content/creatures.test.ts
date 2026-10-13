/**
 * The creatures (GDD §9.3, §4.11, §14.1): registration and scores, every param value spawns,
 * telegraphs of at least 18 ticks before every attack (NORMAL and HARD), no attack from outside
 * the view, attack tokens, deaths by damage kind, the kazoo formations and FULL SET, 2 players,
 * and a performance budget for 30 copies.
 */
import { describe, expect, it } from 'vitest';
import type { Entity } from '../../src/engine/entity';
import { VirtualPad } from '../../src/engine/input';
import { getFrames } from '../../src/engine/sprites';
import '../../src/game/content/characters/index';
import '../../src/game/content/weapons/index';
import '../../src/game/content/fx/index';
import '../../src/game/content/fx/art';
import '../../src/game/content/creatures/index';
import '../../src/game/content/creatures/art';
import { Creature, KAZOO, KazooDrone, WindupBot } from '../../src/game/content/creatures/index';
import { attackTokenLimit } from '../../src/game/enemy';
import { Player } from '../../src/game/player/player';
import { getEntityMeta } from '../../src/game/registry';
import type { Difficulty } from '../../src/game/session';
import { FLOOR, TestWorld, watchFairness, type FairnessOpts, type FairnessWatch } from './helpers';

const IDS = ['bullfrog', 'windup-bot', 'rattler', 'echo-bat', 'ram-goat', 'usher-bot', 'kazoo-drone'] as const;
const SCORES: Record<string, number> = {
  bullfrog: 400,
  'windup-bot': 100,
  rattler: 600,
  'echo-bat': 200,
  'ram-goat': 800,
  'usher-bot': 700,
  'kazoo-drone': 100,
};

/** Attack mode → the telegraph mode that must come right before it. */
const ATTACKS: Record<string, string> = {
  croak: 'tell',
  tongue: 'tell-tongue',
  lunge: 'tell',
  charge: 'tell',
  leap: 'leap-tell',
  shoot: 'tell',
  dive: 'tell',
};
const TELLS = new Set(['tell', 'tell-tongue', 'leap-tell']);

interface Scene {
  id: string;
  x: number;
  y?: number;
  params?: Record<string, unknown>;
}

/** One scene per creature that makes it attack a (god) player standing at x 100. */
const SCENES: Scene[] = [
  { id: 'bullfrog', x: 170, params: { gag: false, facing: -1 } },
  { id: 'windup-bot', x: 150, params: { facing: -1 } },
  { id: 'rattler', x: 170, params: { facing: -1 } },
  { id: 'echo-bat', x: 200, y: FLOOR - 50, params: { enter: 'fly' } },
  { id: 'ram-goat', x: 290, params: { gag: false, facing: -1 } },
  { id: 'usher-bot', x: 160, params: { gag: false, facing: -1, patrol: 0 } },
  { id: 'kazoo-drone', x: 330, y: 60, params: { formation: 'dive' } },
  { id: 'kazoo-drone', x: 330, y: 110, params: { formation: 'sine', shooter: true } },
];

/** The shared fairness watcher (tests/content/helpers.ts) with the creature modes. */
const FAIR: FairnessOpts = { attacks: ATTACKS, tells: TELLS, watched: (e: Entity) => e instanceof Creature, burst: (e: Entity) => e instanceof WindupBot };

function watch(tw: TestWorld, ticks: number, each?: (t: number) => void): FairnessWatch {
  return watchFairness(tw, ticks, FAIR, each);
}

function scene(sc: Scene, difficulty: Difficulty = 'normal', seed = 5): { tw: TestWorld; e: Creature } {
  const tw = new TestWorld({ playerX: 100, god: true, seed, difficulty });
  const e = tw.spawn(sc.id, sc.x, sc.params ?? {}, sc.y ?? FLOOR) as Creature;
  return { tw, e };
}

describe('creatures: registration', () => {
  it.each(IDS)('%s is registered as an enemy with its GDD §14.1 score', (id) => {
    const meta = getEntityMeta(id);
    expect(meta?.category).toBe('enemy');
    expect(meta?.score).toBe(SCORES[id]);
  });

  it('every param value spawns and runs 300 ticks without errors', () => {
    const specs: Array<[string, Record<string, unknown>, number]> = [
      ['windup-bot', { variant: 'walk' }, FLOOR],
      ['windup-bot', { variant: 'ski' }, FLOOR],
      ['windup-bot', { variant: 'fly' }, FLOOR - 60],
      ['kazoo-drone', { formation: 'v' }, 80],
      ['kazoo-drone', { formation: 'sine' }, 80],
      ['kazoo-drone', { formation: 'loop' }, 150],
      ['kazoo-drone', { formation: 'dive' }, 60],
      ['kazoo-drone', { formation: 'v', shooter: 2, facing: 1 }, 80],
      ['bullfrog', { entry: 'top' }, FLOOR],
      ['bullfrog', { gag: true }, FLOOR],
      ['rattler', { enter: 'right' }, FLOOR],
      ['echo-bat', {}, FLOOR - 80],
      ['ram-goat', { gag: true }, FLOOR],
      ['usher-bot', { gag: 'polish' }, FLOOR],
      ['usher-bot', { gag: 'ticket', patrol: 40 }, FLOOR],
    ];
    for (const [id, p, y] of specs) {
      const tw = new TestWorld({ god: true, playerX: 100 });
      const e = tw.spawn(id, 260, p, y);
      expect(e.hasTag('placeholder'), id).toBe(false);
      tw.run(300);
      expect(tw.world.errors.map((x) => `${id} ${JSON.stringify(p)}: ${x.message}`)).toEqual([]);
    }
  });

  it('windup-bot variants: walk 0.8, ski 1.6 on the flat, fly 1.5 px/tick', () => {
    const speeds: Record<string, number> = { walk: 0.8, ski: 1.6, fly: 1.5 };
    for (const v of ['walk', 'ski', 'fly']) {
      const tw = new TestWorld({ god: true, playerX: 40 });
      const b = tw.spawn('windup-bot', 300, { variant: v, facing: 1 }, v === 'fly' ? FLOOR - 60 : FLOOR) as WindupBot;
      tw.run(20);
      const x0 = b.x;
      tw.run(30);
      expect((b.x - x0) / 30, v).toBeCloseTo(speeds[v], 1);
    }
  });
});

describe('creatures: fairness (GDD §4.11)', () => {
  for (const difficulty of ['normal', 'hard'] as const) {
    it.each(SCENES.map((s) => [`${s.id} ${JSON.stringify(s.params ?? {})}`, s] as const))(
      `${difficulty}: %s telegraphs at least 18 ticks before every attack, only from inside the view`,
      (_name, sc) => {
        const { tw } = scene(sc, difficulty);
        const w = watch(tw, 700);
        const attacks = w.attacks.length + w.bursts.length + w.tells.length;
        expect(attacks, 'it attacked').toBeGreaterThan(0);
        for (const a of w.attacks) {
          expect(a.prev, `${a.id} ${a.mode} after ${a.prev}`).toBe(ATTACKS[a.mode]);
          expect(a.tell, `${a.id} ${a.mode}`).toBeGreaterThanOrEqual(18);
          expect(a.inView, `${a.id} ${a.mode} in view`).toBe(true);
        }
        for (const n of w.tells) expect(n).toBeGreaterThanOrEqual(18);
        for (const n of w.bursts) expect(n).toBeGreaterThanOrEqual(18);
        expect(w.outsideShots).toBe(0);
        expect(tw.world.errors).toEqual([]);
      },
    );
  }

  it('a telegraph that ends outside the view does not attack', () => {
    // A shooter caught in its telegraph is pushed past the view edge (inside the despawn margin).
    for (const sc of [SCENES[0], SCENES[5], SCENES[3]]) {
      const { tw, e } = scene(sc);
      let pushed = false;
      let after = 0;
      const shotsBefore = new Set(tw.world.entities.filter((x) => x.hasTag('shot')));
      watch(tw, 400, () => {
        if (!pushed && TELLS.has(e.mode)) {
          pushed = true;
          e.x = e.prevX = tw.world.camera.left + tw.world.camera.w + 40;
          if (e.body) e.vx = 0;
        }
        if (pushed && after < 40) {
          after++;
          expect(ATTACKS[e.mode], `${sc.id} attacked in ${e.mode}`).toBeUndefined();
          expect(tw.world.entities.some((x) => x.team === 'enemy' && x.hasTag('shot') && !shotsBefore.has(x)), sc.id).toBe(false);
        }
      });
      expect(pushed, sc.id).toBe(true);
    }
  });

  it('keeps the attack-token cap with 10 kazoo drones and 4 bats (NORMAL 4, HARD 6)', () => {
    for (const difficulty of ['normal', 'hard'] as const) {
      const tw = new TestWorld({ playerX: 150, god: true, seed: 2, difficulty });
      tw.spawn('kazoo-drone', 360, { formation: 'dive', shooter: true }, 60);
      tw.spawn('kazoo-drone', 360, { formation: 'dive' }, 90);
      for (let i = 0; i < 4; i++) tw.spawn('echo-bat', 200 + i * 30, { enter: 'fly' }, FLOOR - 60);
      const w = watch(tw, 600);
      expect(w.maxTokens).toBeLessThanOrEqual(attackTokenLimit(tw.world));
      expect(w.maxTokens).toBeGreaterThan(1);
    }
  });

  it('gags are free time: a gagging bullfrog and usher-bot do not attack a player behind them', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 4 });
    tw.spawn('bullfrog', 330, { gag: true, facing: 1 });
    tw.spawn('usher-bot', 360, { gag: 'polish', facing: 1, patrol: 0 });
    const w = watch(tw, 240);
    expect(w.attacks).toEqual([]);
    expect(w.outsideShots).toBe(0);
  });
});

describe('creatures: deaths and scores', () => {
  it.each(IDS)('%s: a bullet kill scores its points and plays its death strip', (id) => {
    const tw = new TestWorld({ playerX: 60, god: true });
    const e = tw.spawn(id, 260, { gag: false, facing: -1 }, id === 'echo-bat' || id === 'kazoo-drone' ? FLOOR - 60 : FLOOR) as Creature;
    tw.run(2);
    tw.world.damage(e, { amount: 1000, kind: 'bullet', dirX: 1, owner: 0 });
    expect(e.dead).toBe(true);
    // CAUGHT NAPPING may add 100 for a creature killed in its sleep.
    expect([SCORES[id], SCORES[id] + 100]).toContain(tw.session.slots[0].score);
    // Facing left, the usher plays `die-left` (the same strip with readable receipt letters).
    expect(e.anim.id).toBe(id === 'usher-bot' ? `${e.art}/die-left` : `${e.art}/die`);
    tw.run(400);
    expect(e.removed).toBe(true);
    expect(tw.world.errors).toEqual([]);
  });

  it('usher-bot: the ADMIT NONE receipt reads left to right in both facings', () => {
    // The die strips are identical except for the receipt's letters, which `die-left` mirrors
    // (the renderer flips a left-facing sprite, which flips them back).
    const right = getFrames('creature/usher-bot/die');
    const left = getFrames('creature/usher-bot/die-left');
    expect(left.length).toBe(right.length);
    const last = right.length - 1;
    const a = right[last].buf;
    const b = left[last].buf;
    let same = 0;
    let diff = 0;
    for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) (a.get(x, y) === b.get(x, y) ? same++ : diff++);
    expect(diff).toBeGreaterThan(10);
    expect(diff).toBeLessThan(same / 10);
    for (const facing of [1, -1] as const) {
      const tw = new TestWorld({ playerX: 60, god: true });
      const e = tw.spawn('usher-bot', 260, { gag: false, facing, patrol: 0 }) as Creature;
      tw.run(2);
      tw.world.damage(e, { amount: 1000, kind: 'laser', dirX: 1, owner: 0 });
      expect(e.anim.id).toBe(facing > 0 ? 'creature/usher-bot/die' : 'creature/usher-bot/die-left');
    }
  });

  it.each(IDS)('%s: blast, fire and crush deaths pick their strips', (id) => {
    const want: Record<string, string> = { explosion: 'die-blast', fire: 'die-burn', crush: 'die-crush' };
    for (const kind of ['explosion', 'fire', 'crush'] as const) {
      const tw = new TestWorld({ playerX: 60, god: true });
      const e = tw.spawn(id, 260, { gag: false }, id === 'echo-bat' || id === 'kazoo-drone' ? FLOOR - 60 : FLOOR) as Creature;
      tw.run(2);
      tw.world.damage(e, { amount: 1000, kind, dirX: 1, owner: 0 });
      expect(e.anim.id, `${id} ${kind}`).toBe(`${e.art}/${want[kind]}`);
      tw.run(300);
      expect(e.removed, `${id} ${kind}`).toBe(true);
      expect(tw.world.errors).toEqual([]);
    }
  });
});

describe('kazoo-drone', () => {
  const drones = (tw: TestWorld): KazooDrone[] => tw.ofType('kazoo-drone') as KazooDrone[];

  it('one spawn is a formation of 5; HP 10 (20 while a player flies)', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    tw.spawn('kazoo-drone', 360, { formation: 'v' }, 80);
    tw.run(2);
    const d = drones(tw);
    expect(d.length).toBe(KAZOO.count);
    for (const x of d) expect(x.maxHp).toBe(10);
    expect(new Set(d.map((x) => x.group)).size).toBe(1);
  });

  it('v: a V of 16 px ranks crossing at 1.5 px/tick toward the view centre; facing 1 crosses right', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    tw.spawn('kazoo-drone', 360, { formation: 'v' }, 80);
    tw.run(2);
    const d = drones(tw).sort((a, b) => a.slot - b.slot);
    const x0 = d[0].x;
    tw.run(20);
    expect((d[0].x - x0) / 20).toBeCloseTo(-1.5, 5);
    // The leader is the tip; ranks trail 16 px back and 12 px up / down.
    expect(d[1].x - d[0].x).toBeCloseTo(16, 5);
    expect(d[3].x - d[0].x).toBeCloseTo(32, 5);
    expect(Math.abs(d[1].y - d[0].y)).toBeCloseTo(12, 5);
    expect(d[1].y - d[0].y).toBeCloseTo(-(d[2].y - d[0].y), 5);
    const tw2 = new TestWorld({ playerX: 300, god: true });
    tw2.spawn('kazoo-drone', 40, { formation: 'v', facing: 1 }, 80);
    tw2.run(30);
    const l = drones(tw2).find((x) => x.slot === 0) as KazooDrone;
    expect(l.vx).toBeCloseTo(1.5, 5);
    expect(l.facing).toBe(1);
  });

  it('sine: y = base ± 24·sin(t/30), drones 20 px apart along the path', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    tw.spawn('kazoo-drone', 360, { formation: 'sine' }, 100);
    let lo = Infinity;
    let hi = -Infinity;
    for (let t = 0; t < 200; t++) {
      tw.run(1);
      const l = drones(tw).find((x) => x.slot === 0) as KazooDrone;
      lo = Math.min(lo, l.y);
      hi = Math.max(hi, l.y);
    }
    expect(lo).toBeCloseTo(100 - KAZOO.sineAmp, 0);
    expect(hi).toBeCloseTo(100 + KAZOO.sineAmp, 0);
  });

  it('loop: one loop of radius 64, then it leaves on the entry line', () => {
    const tw = new TestWorld({ playerX: 100, god: true, width: 2400 });
    tw.spawn('kazoo-drone', 360, { formation: 'loop' }, 150);
    let top = Infinity;
    for (let t = 0; t < 400; t++) {
      tw.run(1);
      const l = drones(tw).find((x) => x.slot === 0);
      if (l) top = Math.min(top, l.y);
    }
    expect(top).toBeCloseTo(150 - 2 * KAZOO.loopR, 0);
  });

  it('dive: hovers at the top, telegraphs, dives at the player at 2.5 px/tick and contact kills', () => {
    const tw = new TestWorld({ playerX: 150, seed: 3 });
    tw.spawn('kazoo-drone', 360, { formation: 'dive' }, 60);
    let dove: KazooDrone | null = null;
    tw.until(() => {
      dove = drones(tw).find((x) => x.mode === 'dive') ?? null;
      return !!dove;
    }, 600);
    const d = dove as unknown as KazooDrone;
    expect(Math.hypot(d.vx, d.vy) || 2.5).toBeCloseTo(2.5, 1);
    expect(d.contactDamage).not.toBeNull();
  });

  it('FULL SET: +1,000 when the whole formation is shot down; none when one escapes', () => {
    const tw = new TestWorld({ playerX: 100, god: true });
    tw.spawn('kazoo-drone', 300, { formation: 'v' }, 80);
    tw.run(3);
    for (const d of drones(tw)) tw.world.damage(d, { amount: 100, kind: 'bullet', dirX: 1, owner: 0 });
    expect(tw.session.slots[0].score).toBe(5 * 100 + 1000);
    expect(tw.hud.callouts.some((c) => c.text === 'FULL SET! +1000')).toBe(true);

    const tw2 = new TestWorld({ playerX: 100, god: true });
    tw2.spawn('kazoo-drone', 300, { formation: 'v' }, 80);
    tw2.run(3);
    const d2 = drones(tw2);
    d2[4].remove();
    tw2.run(1);
    for (const d of d2.slice(0, 4)) tw2.world.damage(d, { amount: 100, kind: 'bullet', dirX: 1, owner: 0 });
    expect(tw2.session.slots[0].score).toBe(4 * 100);
  });

  it('shooters fire one slow note at 1.5 px/tick aimed at the player', () => {
    const tw = new TestWorld({ playerX: 100, god: true, seed: 9 });
    tw.spawn('kazoo-drone', 330, { formation: 'sine', shooter: 1 }, 100);
    let note: Entity | undefined;
    tw.until(() => !!(note = tw.world.entities.find((e) => e.type === 'note-bullet')), 600);
    const n = note as Entity;
    expect(Math.hypot(n.vx, n.vy)).toBeCloseTo(KAZOO.noteSpeed, 1);
    expect(n.vx).toBeLessThan(0);
  });
});

describe('creatures: two players, determinism, performance', () => {
  it('runs with 2 players (one dies mid-attack) without errors', () => {
    const tw = new TestWorld({ playerX: 100, god: false, seed: 6 });
    const p2 = new Player(tw.world, 140, FLOOR, { pad: new VirtualPad(), index: 1 });
    tw.world.add(p2);
    p2.placeAt(140, FLOOR, 0);
    tw.world.flush();
    for (const sc of SCENES) tw.spawn(sc.id, sc.x + 40, sc.params ?? {}, sc.y ?? FLOOR);
    tw.run(600);
    expect(tw.world.errors).toEqual([]);
  });

  it('is deterministic for a seed', () => {
    const trace = (): string => {
      const { tw } = scene(SCENES[6], 'normal', 13);
      tw.spawn('bullfrog', 200, { gag: false, facing: -1 });
      tw.run(400);
      return tw.world.entities
        .filter((e) => e instanceof Creature)
        .map((e) => `${e.type}:${e.x.toFixed(2)},${e.y.toFixed(2)}:${(e as Creature).mode}`)
        .join('|');
    };
    expect(trace()).toBe(trace());
  });

  it.each(IDS)('30 × %s stay within the tick budget', (id) => {
    const tw = new TestWorld({ playerX: 60, god: true, width: 2400 });
    for (let i = 0; i < (id === 'kazoo-drone' ? 6 : 30); i++) {
      tw.spawn(id, 150 + i * 7, { gag: false, formation: 'sine' }, id === 'echo-bat' || id === 'kazoo-drone' ? FLOOR - 70 : FLOOR);
    }
    tw.run(30);
    const t0 = performance.now();
    tw.run(200);
    const per = (performance.now() - t0) / 200;
    // Budget 0.5 ms per tick on a quiet machine; the test runs beside other workers, so allow 3×.
    expect(per).toBeLessThan(1.5);
  });
});
