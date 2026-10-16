import { beforeAll, describe, expect, it } from 'vitest';
import { NullAudio } from '../../../src/engine/audio';
import { ACTION_BIT as B } from '../../../src/engine/input-actions';
import { PAL } from '../../../src/engine/palette';
import {
  ACTOR_TYPES,
  ActorPool,
  MAX_ACTORS,
  ST_CHASE,
  ST_DEAD,
  ST_DIE,
  ST_STAND,
  ST_TELL,
  type ActorFrame,
} from '../../../src/game/fps/actors';
import { damageActor, MIN_TELL } from '../../../src/game/fps/ai';
import { FpsGame } from '../../../src/game/fps/game';
import { parseFloor } from '../../../src/game/fps/map';
import { getFpsFloor } from '../../../src/game/fps/registry';
import type { FpsFloorDef, FpsInput } from '../../../src/game/fps/types';
import { WEAPON_MG } from '../../../src/game/fps/types';
import { PlayerSlot, type Difficulty } from '../../../src/game/session';

beforeAll(async () => {
  await import('../../../src/game/content/fps/index');
});

function makeGame(rows: string[], o: { difficulty?: Difficulty; seed?: number; god?: boolean } = {}): FpsGame {
  const def: FpsFloorDef = { id: 'fps-test', number: 9, name: 'TEST', par: 60, secrets: 0, rows, ceil: PAL.steel[0], floor: PAL.stone[1], music: 'fps-floor' };
  const g = new FpsGame({ floor: def, difficulty: o.difficulty ?? 'normal', seed: o.seed ?? 1, slot: new PlayerSlot(0), carry: null, audio: new NullAudio(), god: o.god });
  g.skipUnfold();
  return g;
}
const idle = (): FpsInput => ({ held: 0, pressed: 0, turn: 0, moveX: 0, moveY: 0 });

describe('enemy numbers (§4.3)', () => {
  it('HP, speeds, tells ≥ 18, scores and drops per type', () => {
    const t = ACTOR_TYPES;
    expect([t.guard.hp[1], t.officer.hp[1], t.ss.hp[1], t.dog.hp[1]]).toEqual([25, 50, 100, 1]);
    expect([t.guard.score, t.officer.score, t.ss.score, t.dog.score]).toEqual([100, 400, 500, 200]);
    expect([t.guard.chase, t.officer.chase, t.ss.chase, t.dog.chase]).toEqual([0.027, 0.046, 0.036, 0.053]);
    expect([t.guard.tell, t.officer.tell, t.ss.tell, t.dog.tell]).toEqual([24, 18, 20, 18]);
    for (const d of Object.values(t)) expect(d.tell).toBeGreaterThanOrEqual(MIN_TELL);
    expect([t.ss.burst, t.ss.burstGap]).toEqual([3, 6]);
    expect([t.guard.drop, t.officer.drop, t.ss.drop, t.dog.drop]).toEqual(['clip', 'clip', 'ss', 'none']);
    expect([t.guard.radius, t.dog.radius]).toEqual([0.4, 0.3]);
  });
});

describe('the actor pool', () => {
  it('is preallocated (128) and reused', () => {
    const pool = new ActorPool();
    pool.reset(20, 20);
    const first = pool.actors[0];
    for (let k = 0; k < MAX_ACTORS; k++) expect(pool.spawn('guard', k % 20, (k / 20) | 0, 0, 'normal')).not.toBeNull();
    expect(pool.spawn('guard', 0, 19, 0, 'normal')).toBeNull();
    pool.reset(20, 20);
    expect(pool.count).toBe(0);
    expect(pool.spawn('dog', 3, 3, 0, 'hard')).toBe(first);
    expect(pool.cellTaken(3, 3)).toBe(true);
  });

  it('floor 0 holds one of every enemy type and every pickup (§6.0)', () => {
    const def = getFpsFloor('fps-0')!;
    const map = parseFloor(def, 'normal');
    expect(new Set(map.actors.map((a) => a.type))).toEqual(new Set(['guard', 'officer', 'ss', 'dog']));
    const ids = new Set(map.items.map((i) => i.id));
    for (const id of ['first-aid', 'food', 'ration', 'blood-pool', 'clip', 'mg', 'chaingun', 'one-up', 'key-gold', 'key-silver', 'pocket-watch', 'tuning-fork', 'gold-bars', 'music-box', 'golden-record']) {
      expect(ids.has(id), id).toBe(true);
    }
    expect(map.actors.find((a) => a.type === 'ss')!.ambush).toBe(true);
    expect(map.actors.find((a) => a.type === 'guard')!.patrol).toBe(true);
    expect(map.warnings).toEqual([]);
  });
});

describe('death, blood and drops (§4.3)', () => {
  it('die frames → a corpse that is not solid, a blood pool, a dropped clip', () => {
    const g = makeGame(['AAAAAAA', 'A>..g.A', 'AAAAAAA']);
    const a = g.actors.actors[0];
    damageActor(g, a, 100);
    expect(a.state).toBe(ST_DIE);
    expect(g.actors.cellTaken(4, 1)).toBe(false);
    expect(g.actors.buildBlockers().count).toBe(0);
    expect(a.pool).toBeGreaterThan(0);
    expect(g.items.id.slice(0, g.items.count)).toEqual(['clip-drop']);
    const f: ActorFrame = { bb: null, frame: 0, yaw: 0 };
    g.actors.frameOf(a, g.player.x, g.player.y, f);
    expect(f.frame).toBe(ACTOR_TYPES.guard.frames.die);
    for (let t = 0; t < 40; t++) g.step(idle());
    expect(a.state).toBe(ST_DEAD);
    g.actors.frameOf(a, g.player.x, g.player.y, f);
    expect(f.frame).toBe(ACTOR_TYPES.guard.frames.dead);
    expect((g.audio as NullAudio).log).toContain('sfx:fps/blood');
  });

  it('an SS drops the MG when the player has none, else a clip; a dog drops nothing', () => {
    const g = makeGame(['AAAAAAAA', 'A>.s.sdA', 'AAAAAAAA']);
    const [s1, s2, dog] = g.actors.actors;
    damageActor(g, s1, 500);
    expect(g.items.id[0]).toBe('mg');
    g.player.weapons |= 1 << WEAPON_MG;
    damageActor(g, s2, 500);
    expect(g.items.id[1]).toBe('clip-drop');
    damageActor(g, dog, 5);
    expect(g.items.count).toBe(2);
    expect(g.actors.kills).toBe(3);
  });

  it('the player cannot walk through a living actor, but through a corpse', () => {
    const g = makeGame(['AAAAAAA', 'A>.d..A', 'AAAAAAA'], { god: true });
    const a = g.actors.actors[0];
    a.angle = 0; // facing away: it stays unaware
    const i = idle();
    i.held = B.forward;
    for (let t = 0; t < 40; t++) g.step(i);
    expect(g.player.x).toBeLessThan(3.5 - 0.3 - 0.34 + 1e-6);
    damageActor(g, a, 5);
    for (let t = 0; t < 40; t++) g.step(i);
    expect(g.player.x).toBeGreaterThan(4);
  });
});

describe('determinism with combat', () => {
  function play(seed: number): number[] {
    const g = makeGame(['AAAAAAAAAAAA', 'A.g...o....A', 'A>.........A', 'A....s...d.A', 'AAAAAAAAAAAA'], { seed });
    const out: number[] = [];
    const i = idle();
    for (let t = 0; t < 900; t++) {
      i.held = (t % 50 < 25 ? B.fire : 0) | (t % 200 < 100 ? B.turnRight : B.turnLeft);
      i.pressed = t % 25 === 0 ? B.fire : 0;
      g.step(i);
      if (t % 100 === 99) out.push(g.stateHash());
    }
    return out;
  }

  it('the same seed and input give the same hashes; another seed differs', () => {
    expect(play(4)).toEqual(play(4));
    expect(play(4)).not.toEqual(play(5));
  });

  it('actors in the hash: a hit changes it', () => {
    const g = makeGame(['AAAAAAA', 'A>..g.A', 'AAAAAAA']);
    const h0 = g.stateHash();
    damageActor(g, g.actors.actors[0], 3);
    expect(g.stateHash()).not.toBe(h0);
  });
});

describe('floor 0 end to end (headless)', () => {
  it('opening room B wakes the guard; the player kills it with the pistol', () => {
    const g = new FpsGame({ floor: getFpsFloor('fps-0')!, difficulty: 'normal', seed: 2, slot: new PlayerSlot(0), carry: null, audio: new NullAudio(), god: true });
    g.skipUnfold();
    const guard = g.actors.actors.find((a) => a.type === 'guard')!;
    expect(guard.state).toBe(ST_STAND + 1); // patrolling
    // Stand at the door of room B (8, 3) and open it.
    g.setPose(7.5, 3.5, 0);
    const i = idle();
    i.pressed = B.use;
    g.step(i);
    i.pressed = 0;
    for (let t = 0; t < 70; t++) g.step(i);
    // Fire until the guard is down (aim at it each tick).
    for (let t = 0; t < 1200 && guard.alive; t++) {
      g.player.angle = Math.round((Math.atan2(guard.y - g.player.y, guard.x - g.player.x) / (2 * Math.PI)) * 4096) & 4095;
      i.pressed = t % 21 === 0 ? B.fire : 0;
      i.held = i.pressed;
      g.step(i);
    }
    expect(guard.alive).toBe(false);
    expect(g.actors.kills).toBeGreaterThanOrEqual(1);
    expect(g.slot.score).toBeGreaterThanOrEqual(100);
    // The noise woke the dog in the same room.
    const dog = g.actors.actors.find((a) => a.type === 'dog')!;
    expect(dog.state === ST_CHASE || dog.state === ST_TELL || dog.state > ST_TELL).toBe(true);
  });
});

describe('positional sound (§9.1)', () => {
  it('pan from the relative angle, volume from distance and reach; tells at least 0.5', async () => {
    const { panVol } = await import('../../../src/game/fps/audio');
    const o = { pan: 0, vol: 0 };
    // Listener at the origin facing east (0); +y is south = the listener's right.
    panVol(o, 0, 0, 0, 0, 5, true);
    expect(o.pan).toBeCloseTo(0.8);
    expect(o.vol).toBeCloseTo(0.75);
    panVol(o, 0, 0, 0, 0, -5, true);
    expect(o.pan).toBeCloseTo(-0.8);
    panVol(o, 0, 0, 0, 10, 0, false);
    expect(o.pan).toBeCloseTo(0);
    expect(o.vol).toBeCloseTo(0.5 * 0.35);
    panVol(o, 0, 0, 0, 40, 0, true);
    expect(o.vol).toBeCloseTo(0.15);
    panVol(o, 0, 0, 0, 40, 0, false, true);
    expect(o.vol).toBe(0.5);
  });

  it('enemy sounds behind a closed door are quieter', () => {
    const g = makeGame(['AAAAAAAAAA', 'A>..|..g.A', 'AAAAAAAAAA']);
    g.step(idle());
    expect(g.sound.reachedCell(2, 1)).toBe(true);
    expect(g.sound.reachedCell(7, 1)).toBe(false);
    g.doors.open(0);
    g.step(idle());
    expect(g.sound.reachedCell(7, 1)).toBe(true);
  });
});
