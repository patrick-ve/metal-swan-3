import { beforeAll, describe, expect, it } from 'vitest';
import { NullAudio } from '../../../src/engine/audio';
import { PAL } from '../../../src/engine/palette';
import { degToAng } from '../../../src/engine/ray';
import { Rng } from '../../../src/engine/rng';
import { ST_CHASE, ST_DIE, ST_PAIN } from '../../../src/game/fps/actors';
import { damageActor } from '../../../src/game/fps/ai';
import { FpsGame } from '../../../src/game/fps/game';
import {
  aimWidth,
  bandDist,
  biteDamage,
  bossDamage,
  enemyDamage,
  enemyHitChance,
  findTarget,
  playerDamage,
} from '../../../src/game/fps/hitscan';
import type { FpsFloorDef, FpsThing } from '../../../src/game/fps/types';
import { WEAPON_CHAINGUN, WEAPON_KNIFE, WEAPON_PISTOL } from '../../../src/game/fps/types';
import { PlayerSlot, type Difficulty } from '../../../src/game/session';

beforeAll(async () => {
  await import('../../../src/game/content/fps/index');
});

function makeGame(rows: string[], o: { difficulty?: Difficulty; seed?: number; things?: FpsThing[] } = {}): FpsGame {
  const def: FpsFloorDef = { id: 'fps-test', number: 9, name: 'TEST', par: 60, secrets: 0, rows, things: o.things, ceil: PAL.steel[0], floor: PAL.stone[1], music: 'fps-floor' };
  const g = new FpsGame({ floor: def, difficulty: o.difficulty ?? 'normal', seed: o.seed ?? 1, slot: new PlayerSlot(0), carry: null, audio: new NullAudio() });
  g.skipUnfold();
  return g;
}

/** Sample `n` values. */
function sample(n: number, f: () => number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(f());
  return out;
}
const mean = (v: number[]): number => v.reduce((a, b) => a + b, 0) / v.length;

describe('player damage bands (§4.2, seeded)', () => {
  const N = 20000;

  it('d < 2: 1..63 every bullet; 2 ≤ d < 4: 1..42', () => {
    const rng = new Rng(11);
    const near = sample(N, () => playerDamage(rng, WEAPON_PISTOL, 1.5));
    expect(Math.min(...near)).toBe(1);
    expect(Math.max(...near)).toBe(63);
    expect(mean(near)).toBeCloseTo(32, 0);
    const mid = sample(N, () => playerDamage(rng, WEAPON_CHAINGUN, 3.9));
    expect(Math.min(...mid)).toBe(1);
    expect(Math.max(...mid)).toBe(42);
    expect(mean(mid)).toBeCloseTo(21.5, 0);
  });

  it('d ≥ 4: hit when rng ≥ 12 × floor(d) (at least 32/256), then 1..42', () => {
    const rng = new Rng(12);
    const at6 = sample(N, () => playerDamage(rng, WEAPON_PISTOL, 6.4));
    const hit6 = at6.filter((v) => v > 0);
    expect(hit6.length / N).toBeCloseTo(1 - 72 / 256, 1);
    expect(Math.max(...hit6)).toBe(42);
    const far = sample(N, () => playerDamage(rng, WEAPON_PISTOL, 40));
    expect(far.filter((v) => v > 0).length / N).toBeCloseTo(32 / 256, 1);
  });

  it('knife: 1..16 within d ≤ 1.25, else a miss', () => {
    const rng = new Rng(13);
    const k = sample(N, () => playerDamage(rng, WEAPON_KNIFE, 1.2));
    expect(Math.min(...k)).toBe(1);
    expect(Math.max(...k)).toBe(16);
    expect(playerDamage(rng, WEAPON_KNIFE, 1.3)).toBe(0);
  });

  it('the same seed gives the same rolls', () => {
    const a = new Rng(5);
    const b = new Rng(5);
    expect(sample(50, () => playerDamage(a, WEAPON_PISTOL, 5))).toEqual(sample(50, () => playerDamage(b, WEAPON_PISTOL, 5)));
  });
});

describe('enemy hit chance and damage (§4.3, §7.2)', () => {
  it('chance = clamp(base − k × floor(d), 16, 256)', () => {
    expect(enemyHitChance(0.5, false, true)).toBe(256);
    expect(enemyHitChance(3.7, false, true)).toBe(256 - 48);
    expect(enemyHitChance(3.7, false, false)).toBe(256 - 24);
    expect(enemyHitChance(3.7, true, true)).toBe(160 - 48);
    expect(enemyHitChance(40, false, true)).toBe(16);
    expect(enemyHitChance(2, false, true, 208, 112)).toBe(208 - 32);
  });

  it('damage bands per distance; EASY × 0.5 rounded up', () => {
    const rng = new Rng(21);
    const N = 5000;
    const near = sample(N, () => enemyDamage(rng, 1, 'normal'));
    expect([Math.min(...near), Math.max(...near)]).toEqual([8, 40]);
    const mid = sample(N, () => enemyDamage(rng, 3, 'hard'));
    expect([Math.min(...mid), Math.max(...mid)]).toEqual([4, 24]);
    const far = sample(N, () => enemyDamage(rng, 9, 'normal'));
    expect([Math.min(...far), Math.max(...far)]).toEqual([2, 12]);
    const easy = sample(N, () => enemyDamage(rng, 1, 'easy'));
    expect([Math.min(...easy), Math.max(...easy)]).toEqual([4, 20]);
    const boss = sample(N, () => bossDamage(rng, 1, 'normal'));
    expect([Math.min(...boss), Math.max(...boss)]).toEqual([4, 20]);
  });

  it('a bite hits 180/256 of the time for 4..16', () => {
    const rng = new Rng(22);
    const b = sample(20000, () => biteDamage(rng, 'normal'));
    const hits = b.filter((v) => v > 0);
    expect(hits.length / b.length).toBeCloseTo(180 / 256, 1);
    expect([Math.min(...hits), Math.max(...hits)]).toEqual([4, 16]);
  });
});

describe('target search (§4.2)', () => {
  const rows = [
    'AAAAAAAAAAAA',
    'A>...g..g..A',
    'A..........A',
    'A......A.g.A',
    'AAAAAAAAAAAA',
  ];

  it('the nearest living actor on the aim line; aim width max(0.35, 0.06 d)', () => {
    const g = makeGame(rows);
    const pool = g.actors;
    expect(pool.count).toBe(3);
    const p = g.player;
    const t = findTarget(pool, g.grid, g.map.doors, g.pushes.push, p.x, p.y, 0);
    expect(t).toBe(pool.actors[0]);
    // Aim 0.3 tiles above the line: still a hit at d = 4 (width 0.35); 0.5 tiles is a miss.
    g.setPose(1.5, 1.8, 0);
    expect(findTarget(pool, g.grid, g.map.doors, g.pushes.push, 1.5, 1.8, 0)).toBe(pool.actors[0]);
    expect(findTarget(pool, g.grid, g.map.doors, g.pushes.push, 1.5, 2.0, 0)).toBe(null);
    expect(aimWidth(2)).toBe(0.35);
    expect(aimWidth(10)).toBeCloseTo(0.6);
    // Dead actors are skipped: the next one in line is the target.
    pool.actors[0].state = ST_DIE;
    expect(findTarget(pool, g.grid, g.map.doors, g.pushes.push, 1.5, 1.5, 0)).toBe(pool.actors[1]);
  });

  it('no target behind a wall', () => {
    const g = makeGame(rows);
    // From (5.5, 3.5) east: the wall at x 7 hides the guard at (9, 3).
    expect(findTarget(g.actors, g.grid, g.map.doors, g.pushes.push, 5.5, 3.5, 0)).toBe(null);
    expect(findTarget(g.actors, g.grid, g.map.doors, g.pushes.push, 9.5, 1.6, degToAng(90))).toBe(g.actors.actors[2]);
  });

  it('the target test uses the actor box half-size: the mech (0.6) is hit on its arms, also past a pillar edge', () => {
    const g = makeGame(['AAAAAAAAAA', 'A........A', 'A>...@...A', 'A........A', 'AAAAAAAAAA']);
    const pool = g.actors;
    const mech = pool.actors[0];
    expect(mech.type).toBe('boss');
    expect(mech.def.radius).toBe(0.6);
    // d 3.5: 0.45 off the centre (an arm) hits; 0.65 misses.
    expect(findTarget(pool, g.grid, g.map.doors, g.pushes.push, 2.5, 2.95, 0)).toBe(mech);
    expect(findTarget(pool, g.grid, g.map.doors, g.pushes.push, 2.5, 3.15, 0)).toBe(null);
    // A guard keeps its 0.4 box: 0.38 off hits, 0.45 misses (aim width 0.35 at this range).
    const h = makeGame(['AAAAAAAAAA', 'A........A', 'A>...g...A', 'A........A', 'AAAAAAAAAA']);
    expect(findTarget(h.actors, h.grid, h.map.doors, h.pushes.push, 2.5, 2.88, 0)).toBe(h.actors.actors[0]);
    expect(findTarget(h.actors, h.grid, h.map.doors, h.pushes.push, 2.5, 2.95, 0)).toBe(null);
    // The mech's centre behind a pillar edge, the aim line clear past it: the seen part is hit.
    const k = makeGame(['AAAAAAAAA', 'A...A.@.A', 'A>......A', 'AAAAAAAAA']);
    const m = k.actors.actors[0];
    expect(findTarget(k.actors, k.grid, k.map.doors, k.pushes.push, 1.5, 2.05, 0)).toBe(m);
  });

  it('bandDist is the Chebyshev distance', () => {
    expect(bandDist(-3, 1.5)).toBe(3);
    expect(bandDist(0.5, -2)).toBe(2);
  });
});

describe('damage to actors (§4.4)', () => {
  it('an unaware actor takes double damage; a hit that does not kill → pain → chase', () => {
    const g = makeGame(['AAAAAAA', 'A>..s.A', 'AAAAAAA'], { things: [{ at: [4, 1], facing: 'E' }] });
    const a = g.actors.actors[0];
    expect(a.aware).toBe(false);
    expect(damageActor(g, a, 20)).toBe(40);
    expect(a.hp).toBe(60);
    expect(a.state).toBe(ST_PAIN);
    // Aware now: a plain hit.
    expect(damageActor(g, a, 20)).toBe(20);
    expect(a.hp).toBe(40);
    for (let t = 0; t < 20; t++) g.step({ held: 0, pressed: 0, turn: 0, moveX: 0, moveY: 0 });
    expect(a.state).toBeGreaterThanOrEqual(ST_CHASE);
  });

  it('a kill pays the score through the slot and counts for kill %', () => {
    const g = makeGame(['AAAAAAA', 'A>..o.A', 'AAAAAAA']);
    const a = g.actors.actors[0];
    damageActor(g, a, 100);
    expect(a.state).toBe(ST_DIE);
    expect(g.slot.score).toBe(400);
    expect(g.actors.kills).toBe(1);
    expect(g.actors.placedTotal).toBe(1);
  });
});
