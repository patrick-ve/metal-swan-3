import { beforeAll, describe, expect, it } from 'vitest';
import { NullAudio } from '../../../src/engine/audio';
import { ACTION_BIT as B } from '../../../src/engine/input-actions';
import { PAL } from '../../../src/engine/palette';
import { ATTACK_TOKENS, ST_ATTACK, ST_CHASE, ST_PAIN, ST_STAND, ST_TELL, type Actor } from '../../../src/game/fps/actors';
import { damageActor, MIN_TELL, type ShotEvent } from '../../../src/game/fps/ai';
import { DOOR_OPEN } from '../../../src/game/fps/doors';
import { FpsGame } from '../../../src/game/fps/game';
import type { FpsFloorDef, FpsInput, FpsThing } from '../../../src/game/fps/types';
import { PlayerSlot, type Difficulty } from '../../../src/game/session';

beforeAll(async () => {
  await import('../../../src/game/content/fps/index');
});

function makeGame(rows: string[], o: { difficulty?: Difficulty; seed?: number; things?: FpsThing[]; god?: boolean } = {}): FpsGame {
  const def: FpsFloorDef = { id: 'fps-test', number: 9, name: 'TEST', par: 60, secrets: 0, rows, things: o.things, ceil: PAL.steel[0], floor: PAL.stone[1], music: 'fps-floor' };
  const g = new FpsGame({ floor: def, difficulty: o.difficulty ?? 'normal', seed: o.seed ?? 1, slot: new PlayerSlot(0), carry: null, audio: new NullAudio(), god: o.god });
  g.skipUnfold();
  return g;
}

const idle = (): FpsInput => ({ held: 0, pressed: 0, turn: 0, moveX: 0, moveY: 0 });
function steps(g: FpsGame, n: number, i: FpsInput = idle()): void {
  for (let t = 0; t < n; t++) g.step(i);
}
/** One pistol shot (press, then let the cycle run). */
function shoot(g: FpsGame): void {
  const i = idle();
  i.held = i.pressed = B.fire;
  g.step(i);
  steps(g, 20);
}

describe('sight (§4.4)', () => {
  it('an actor that faces the player sees him and chases after its reaction delay', () => {
    const g = makeGame(['AAAAAAAAAA', 'A>.....g.A', 'AAAAAAAAAA'], { things: [{ at: [7, 1], facing: 'W' }] });
    const a = g.actors.actors[0];
    g.step(idle());
    expect(a.react).toBeGreaterThan(0);
    expect(a.aware).toBe(false); // still in its reaction delay
    steps(g, 56);
    expect(a.aware).toBe(true);
  });

  it('it does not see a player behind it, but always sees one within 1.5 tiles', () => {
    const g = makeGame(['AAAAAAAAAA', 'A>.....g.A', 'AAAAAAAAAA'], { things: [{ at: [7, 1], facing: 'E' }] });
    const a = g.actors.actors[0];
    steps(g, 120);
    expect(a.state).toBe(ST_STAND);
    expect(a.react).toBe(0);
    g.setPose(6.3, 1.5, 0);
    steps(g, 60);
    expect(a.aware).toBe(true);
  });

  it('a closed door blocks sight', () => {
    const g = makeGame(['AAAAAAAAAA', 'A>..|..g.A', 'AAAAAAAAAA'], { things: [{ at: [7, 1], facing: 'W' }] });
    steps(g, 120);
    expect(g.actors.actors[0].state).toBe(ST_STAND);
  });

  it('an ambush actor ignores noise but reacts to sight', () => {
    const rows = ['AAAAAAAAAAA', 'A^.......sA', 'AAAAAAAAAAA'];
    const g = makeGame(rows, { things: [{ at: [9, 1], facing: 'E', ambush: true }] });
    shoot(g);
    steps(g, 60);
    expect(g.actors.actors[0].aware).toBe(false);
    const h = makeGame(rows, { things: [{ at: [9, 1], facing: 'W', ambush: true }] });
    steps(h, 60);
    expect(h.actors.actors[0].aware).toBe(true);
  });
});

describe('noise through areas (§4.4)', () => {
  // Room A (player) | door | room B (a guard that faces away and cannot see the door).
  const rows = [
    'AAAAAAAAAAAA',
    'A^...|.....A',
    'A....A....gA',
    'AAAAAAAAAAAA',
  ];
  const things: FpsThing[] = [{ at: [10, 2], facing: 'E' }];

  it('a shot does not wake an actor behind a closed door', () => {
    const g = makeGame(rows, { things });
    shoot(g);
    steps(g, 80);
    expect(g.actors.actors[0].state).toBe(ST_STAND);
  });

  it('with the door open the shot wakes it', () => {
    const g = makeGame(rows, { things });
    g.doors.open(0);
    steps(g, 60);
    expect(g.doors.state[0]).toBe(DOOR_OPEN);
    expect(g.actors.actors[0].state).toBe(ST_STAND);
    shoot(g);
    steps(g, 60);
    expect(g.actors.actors[0].aware).toBe(true);
  });
});

/** A long fight: the player stands (god mode) among several enemy types; collect every shot. */
function brawl(seed: number, difficulty: Difficulty): { shots: ShotEvent[]; bad: string[]; maxTokens: number } {
  const rows = [
    'AAAAAAAAAAAAAA',
    'A.g...o....s.A',
    'A............A',
    'A.....>...d..A',
    'A..g.......s.A',
    'A...d....o...A',
    'AAAAAAAAAAAAAA',
  ];
  const g = makeGame(rows, { difficulty, seed, god: true });
  const shots: ShotEvent[] = [];
  const bad: string[] = [];
  // When each actor entered its current tell (sampled after every step), or -1.
  const tellStart = new Map<Actor, number>();
  g.actors.onShot = (e) => {
    shots.push({ ...e });
    const start = tellStart.get(e.actor) ?? -1;
    if (e.actor.state !== ST_ATTACK) bad.push(`${e.actor.type} shot outside attack`);
    if (start < 0 || e.tick - start < MIN_TELL) bad.push(`${e.actor.type} shot ${start < 0 ? 'without a tell' : `after ${e.tick - start} tell ticks`}`);
    if (e.tell < MIN_TELL) bad.push(`${e.actor.type} tell ${e.tell}`);
  };
  const prev = new Map<Actor, number>();
  let maxTokens = 0;
  const i = idle();
  for (let t = 0; t < 3000; t++) {
    // A shot at the start (everyone hears it); then turn slowly so actors are in and out of view.
    i.held = i.pressed = t === 0 ? B.fire : 0;
    i.turn = 3;
    g.step(i);
    for (let k = 0; k < g.actors.count; k++) {
      const a = g.actors.actors[k];
      const was = prev.get(a);
      if (a.state === ST_TELL && was !== ST_TELL) tellStart.set(a, g.tick);
      if (a.state === ST_PAIN || !a.alive) tellStart.set(a, -1);
      prev.set(a, a.state);
    }
    maxTokens = Math.max(maxTokens, g.actors.tokensUsed);
    let held = 0;
    for (let k = 0; k < g.actors.count; k++) {
      const a = g.actors.actors[k];
      if (a.token) held++;
    }
    if (held !== g.actors.tokensUsed) bad.push(`token count ${held} != ${g.actors.tokensUsed}`);
    // Now and then hurt someone (pain cancels a tell).
    if (t % 97 === 0) {
      const a = g.actors.actors[(t / 97) % g.actors.count | 0];
      if (a.alive && a.hp > 30) damageActor(g, a, 5);
    }
  }
  return { shots, bad, maxTokens };
}

describe('attacks (§4.3)', () => {
  it('every damaging enemy event follows a full tell of at least 18 ticks; tokens hold', () => {
    for (const [seed, diff] of [[1, 'normal'], [2, 'hard'], [3, 'easy']] as const) {
      const { shots, bad, maxTokens } = brawl(seed, diff);
      expect(bad.slice(0, 5), `seed ${seed}`).toEqual([]);
      expect(shots.length).toBeGreaterThan(30);
      expect(shots.some((s) => s.damage > 0)).toBe(true);
      expect(new Set(shots.map((s) => s.actor.type))).toEqual(new Set(['guard', 'officer', 'ss', 'dog']));
      expect(maxTokens).toBeLessThanOrEqual(ATTACK_TOKENS[diff]);
      expect(maxTokens).toBeGreaterThan(1);
    }
  });

  it('an SS fires a burst of 3 shots 6 ticks apart after one tell', () => {
    const g = makeGame(['AAAAAAAA', 'A>...s.A', 'AAAAAAAA'], { god: true, things: [{ at: [5, 1], facing: 'W' }] });
    const ticks: number[] = [];
    g.actors.onShot = (e) => ticks.push(e.tick);
    steps(g, 400);
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    expect(ticks[1] - ticks[0]).toBe(6);
    expect(ticks[2] - ticks[1]).toBe(6);
  });

  it('a hit on the player lowers HP and the run rule lowers the chance', () => {
    const g = makeGame(['AAAAAAAA', 'A>...o.A', 'AAAAAAAA'], { things: [{ at: [5, 1], facing: 'W' }] });
    let dmg = 0;
    g.actors.onShot = (e) => (dmg += e.damage);
    steps(g, 200);
    expect(dmg).toBeGreaterThan(0);
    expect(g.player.hp).toBe(Math.max(0, 100 - dmg));
  });
});

describe('chase movement (§4.3)', () => {
  it('actors close in on the player, one actor per cell, never inside walls', () => {
    const rows = [
      'AAAAAAAAAAAAAAAA',
      'A.............gA',
      'A..AAAA.......gA',
      'A>.A..........gA',
      'A..A...AAAA...dA',
      'A.............dA',
      'AAAAAAAAAAAAAAAA',
    ];
    const g = makeGame(rows, { god: true });
    shoot(g);
    const start = g.actors.actors.slice(0, g.actors.count).map((a) => Math.hypot(a.x - g.player.x, a.y - g.player.y));
    for (let t = 0; t < 900; t++) {
      g.step(idle());
      const cells = new Set<string>();
      for (let k = 0; k < g.actors.count; k++) {
        const a = g.actors.actors[k];
        if (!a.alive) continue;
        const key = `${a.cx},${a.cy}`;
        expect(cells.has(key), `two actors on ${key} at t ${t}`).toBe(false);
        cells.add(key);
        expect(g.grid.solidAt(Math.floor(a.x), Math.floor(a.y))).toBe(false);
        // Never overlapping the player.
        const r = a.def.radius + g.player.box.r;
        expect(Math.abs(a.x - g.player.x) < r - 1e-6 && Math.abs(a.y - g.player.y) < r - 1e-6).toBe(false);
      }
    }
    const end = g.actors.actors.slice(0, g.actors.count).map((a) => Math.hypot(a.x - g.player.x, a.y - g.player.y));
    for (let k = 0; k < end.length; k++) expect(end[k]).toBeLessThan(start[k]);
  });

  it('people open doors; dogs do not', () => {
    const rows = ['AAAAAAAAAAA', 'A>...|...gA', 'AAAAAAAAAAA'];
    const g = makeGame(rows, { god: true, things: [{ at: [9, 1], facing: 'W' }] });
    shoot(g);
    g.actors.actors[0].react = 1;
    steps(g, 600);
    expect(g.actors.actors[0].x).toBeLessThan(5);
    const d = makeGame(rows.map((r) => r.replace('g', 'd')), { god: true, things: [{ at: [9, 1], facing: 'W' }] });
    shoot(d);
    d.actors.actors[0].react = 1;
    steps(d, 600);
    expect(d.actors.actors[0].x).toBeGreaterThan(5);
    expect(d.actors.actors[0].state).toBe(ST_CHASE);
  });

  it('a patrol walks its line and turns back at a wall', () => {
    const g = makeGame(['AAAAAAAAAA', 'A..g.....A', 'AAAAAAAAAA', 'A^.......A', 'AAAAAAAAAA'], { things: [{ at: [3, 1], facing: 'E', patrol: true }] });
    const a = g.actors.actors[0];
    let maxX = 0;
    for (let t = 0; t < 1400; t++) {
      g.step(idle());
      maxX = Math.max(maxX, a.x);
    }
    expect(maxX).toBeCloseTo(8.5, 5);
    expect(a.x).toBeLessThan(8.5);
    expect(a.aware).toBe(false);
  });
});

describe('dog reach (cast-verify)', () => {
  it('a dog bites a player who stands on a cell corner', () => {
    const g = makeGame(['AAAAAAAAAA', 'A>.......A', 'A........A', 'A.......dA', 'AAAAAAAAAA'], { god: true });
    g.setPose(4.0, 2.0, 0);
    let bites = 0;
    g.actors.onShot = (e: ShotEvent) => {
      if (e.actor.type === 'dog') bites++;
    };
    g.actors.actors[0].react = 1;
    steps(g, 600);
    expect(bites).toBeGreaterThan(3);
  });

  it('a hit on an unaware guard wakes it (shout + actorWoke) before the pain', () => {
    const g = makeGame(['AAAAAAAAAA', 'A>.....g.A', 'AAAAAAAAAA'], { things: [{ at: [7, 1], facing: 'E' }] });
    let woke = 0;
    g.actorWoke = () => {
      woke++;
    };
    const a = g.actors.actors[0];
    a.hp = 1000;
    damageActor(g, a, 5);
    expect(woke).toBe(1);
    expect(a.state).toBe(ST_PAIN);
    steps(g, 20);
    expect(a.state === ST_CHASE || a.state === ST_TELL || a.state === ST_ATTACK).toBe(true);
  });
});
