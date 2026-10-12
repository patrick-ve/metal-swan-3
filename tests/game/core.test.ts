import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../../src/engine/storage';
import { World } from '../../src/engine/world';
import { awardScore } from '../../src/game/events';
import { attachGame, difficultyOf, HudState } from '../../src/game/context';
import { parseLaunchParams } from '../../src/game/params';
import {
  NO_PARAMS,
  defineCharacter,
  defineEntity,
  gameEntityFactory,
  getCharacter,
  getEntityMeta,
  listEntities,
  paramFacing,
  paramNum,
  paramSpawn,
  toSpawnSpec,
} from '../../src/game/registry';
import { DIFFICULTY, GameSession, HighScoreTable } from '../../src/game/session';
import { Dummy } from './helpers';

describe('session', () => {
  it('starts with 3 lives, 10 bombs and the pistol; scores per slot', () => {
    const s = new GameSession({ characters: ['recruit', 'recruit'] });
    expect(s.activeCount).toBe(2);
    const p1 = s.slots[0];
    expect(p1.lives).toBe(3);
    expect(p1.bombs).toBe(10);
    expect(p1.weapon).toBe('pistol');
    expect(p1.ammo).toBe(Infinity);
    s.addScore(0, 150);
    s.addScore(5, 999); // ignored
    expect(p1.score).toBe(150);
    expect(s.slots[1].score).toBe(0);
  });

  it('loses lives, goes game over, continues with credits', () => {
    const s = new GameSession({ credits: 1 });
    const p = s.slots[0];
    expect(p.loseLife()).toBe(false);
    expect(p.loseLife()).toBe(false);
    expect(p.loseLife()).toBe(true);
    p.gameOver = true;
    expect(s.allOut).toBe(true);
    expect(s.continueSlot(0)).toBe(true);
    expect(p.lives).toBe(3);
    expect(p.continues).toBe(1);
    expect(s.continueSlot(0)).toBe(false); // out of credits
  });

  it('exposes difficulty multipliers to entities through the world', () => {
    const w = new World();
    attachGame(w, new GameSession({ difficulty: 'hard' }), new HudState());
    expect(difficultyOf(w)).toBe(DIFFICULTY.hard);
    expect(difficultyOf(new World())).toBe(DIFFICULTY.normal);
  });

  it('awardScore credits the slot and emits a score event', () => {
    const w = new World();
    const s = new GameSession();
    attachGame(w, s);
    const got: number[] = [];
    w.events.on('score', (e) => got.push(e.points));
    awardScore(w, 0, 500);
    awardScore(w, -1, 500);
    awardScore(w, undefined, 500);
    expect(s.slots[0].score).toBe(500);
    expect(got).toEqual([500]);
  });

  it('keeps a sorted top-10 high score table in the store', () => {
    const store = new MemoryStore();
    const t = HighScoreTable.load(store);
    expect(t.entries.length).toBe(10);
    expect(t.qualifies(1)).toBe(false);
    expect(t.qualifies(1_000_000)).toBe(true);
    expect(t.submit({ name: 'ZED', score: 1_000_000, mission: 'm2', character: 'recruit', continues: 0 })).toBe(0);
    t.save(store);
    const back = HighScoreTable.load(store);
    expect(back.entries[0].name).toBe('ZED');
    expect(back.entries.length).toBe(10);
    store.set('highscores', '{broken');
    expect(HighScoreTable.load(store).entries.length).toBe(10);
  });
});

describe('registry', () => {
  it('spawns registered entities through the world factory with common params', () => {
    defineEntity('core-dummy', (w, x, y, p) => new Dummy(w, x, y, p), { category: 'enemy', score: 300, description: 'test' });
    const w = new World({ factory: gameEntityFactory });
    const e = w.spawn('core-dummy', 10, 20, { facing: 'right', tag: ['wave9', 'extra'], hp: 40 });
    expect(e).toBeInstanceOf(Dummy);
    expect(e.type).toBe('core-dummy');
    expect(e.facing).toBe(1);
    expect(e.hasTag('wave9') && e.hasTag('extra')).toBe(true);
    expect(e.hp).toBe(40);
    expect(getEntityMeta('core-dummy')?.score).toBe(300);
    expect(listEntities('enemy')).toContain('core-dummy');
    // Unknown ids: the World's magenta placeholder.
    expect(w.spawn('nope-not-here', 0, 0).hasTag('placeholder')).toBe(true);
  });

  it('reads spawn params safely', () => {
    expect(paramNum({ hp: 5 }, 'hp', 1)).toBe(5);
    expect(paramNum({ hp: 'x' }, 'hp', 1)).toBe(1);
    expect(paramFacing({ facing: 'left' }, 1)).toBe(-1);
    expect(paramFacing(NO_PARAMS, 1)).toBe(1);
    expect(paramSpawn({ drop: 'pickup-bombs' }, 'drop')).toEqual({ id: 'pickup-bombs' });
    expect(toSpawnSpec({ id: 'pickup-weapon', params: { weapon: 'machine-gun' } })).toEqual({ id: 'pickup-weapon', params: { weapon: 'machine-gun' } });
    expect(toSpawnSpec(42)).toBe(null);
    const w = new World({ seed: 3 });
    expect(['a', 'b']).toContain(toSpawnSpec(['a', 'b'], w)?.id);
  });

  it('characters: recruit is registered; unknown ids fall back to it', () => {
    expect(getCharacter('recruit').art).toBe('char/recruit');
    expect(getCharacter('nobody').id).toBe('recruit');
    defineCharacter({ id: 'core-char', name: 'CORE', art: 'char/core', stats: { speed: 1.2 } });
    expect(getCharacter('core-char').stats?.speed).toBe(1.2);
  });
});

describe('launch params', () => {
  it('parses the documented URL parameters', () => {
    const p = parseLaunchParams('?mission=m1&section=b&god=1&debug=1&seed=42&players=2&char=recruit&weapon=machine-gun&boss=1&mute=1&difficulty=hard');
    expect(p).toEqual({
      mission: 'm1',
      section: 'b',
      god: true,
      debug: true,
      seed: 42,
      players: 2,
      char: 'recruit',
      weapon: 'machine-gun',
      boss: true,
      mute: true,
      difficulty: 'hard',
    });
  });

  it('ignores junk', () => {
    const p = parseLaunchParams('mission=<script>&seed=abc&players=7&god=0&difficulty=insane');
    expect(p.mission).toBe(null);
    expect(p.seed).toBe(null);
    expect(p.players).toBe(1);
    expect(p.god).toBe(false);
    expect(p.difficulty).toBe(null);
  });
});
