import { beforeAll, describe, expect, it } from 'vitest';
import { PAL } from '../../../src/engine/palette';
import { FPS_EPISODE_ID } from '../../../src/game/content/fps/episode';
import { parseFloor, type ParsedFloor } from '../../../src/game/fps/map';
import { TREASURE_SCORE } from '../../../src/game/fps/pickups';
import { fpsFloorByNumber, getFpsEpisode, getFpsFloor } from '../../../src/game/fps/registry';
import type { Difficulty } from '../../../src/game/session';

beforeAll(async () => {
  await import('../../../src/game/content/fps/index');
  await import('../../../src/game/content/fps/floors');
});

function counts(m: ParsedFloor): Record<string, number> {
  const c: Record<string, number> = { guard: 0, officer: 0, ss: 0, dog: 0, boss: 0 };
  for (const a of m.actors) c[a.type]++;
  return c;
}

const DIFFS: readonly Difficulty[] = ['easy', 'normal', 'hard'];

describe('floor 1 "SUPPLY DEPOT" (§6.1)', () => {
  const def = () => getFpsFloor('fps-1')!;

  it('is registered with its numbers', () => {
    const d = def();
    expect(fpsFloorByNumber(1)).toBe(d);
    expect(d).toMatchObject({ number: 1, name: 'SUPPLY DEPOT', par: 210, secrets: 5, music: 'fps-floor', ceil: PAL.steel[0], floor: PAL.stone[1] });
    expect(d.rows.length).toBe(48);
    for (const r of d.rows) expect(r.length).toBe(48);
  });

  it('enemy totals per difficulty: 22 / 34 / 46 (guards, dogs, officers, SS)', () => {
    const want = {
      easy: { guard: 12, dog: 4, officer: 3, ss: 3, boss: 0 },
      normal: { guard: 18, dog: 6, officer: 5, ss: 5, boss: 0 },
      hard: { guard: 22, dog: 8, officer: 8, ss: 8, boss: 0 },
    };
    for (const d of DIFFS) {
      const m = parseFloor(def(), d);
      expect(m.warnings, d).toEqual([]);
      expect(counts(m), d).toEqual(want[d]);
    }
  });

  it('holds 12 treasures worth 20,300 points, both keys, 5 push walls and the switch', () => {
    const m = parseFloor(def(), 'normal');
    const treasure = m.items.filter((i) => i.id in TREASURE_SCORE);
    expect(treasure.length).toBe(12);
    expect(treasure.reduce((s, i) => s + TREASURE_SCORE[i.id], 0)).toBe(20300);
    expect(m.items.filter((i) => i.id === 'golden-record').map((i) => [i.x, i.y])).toEqual([[28, 11]]);
    expect(m.items.find((i) => i.id === 'key-gold')).toMatchObject({ x: 27, y: 15 });
    expect(m.items.find((i) => i.id === 'key-silver')).toMatchObject({ x: 2, y: 27 });
    expect(m.pushes.map((p) => `${p.x},${p.y}`).sort()).toEqual(['27,4', '27,45', '30,8', '4,32', '43,43'].sort());
    expect(m.switches).toEqual([{ x: 45, y: 6 }]);
    expect(Math.floor(m.start.x)).toBe(5);
    expect(Math.floor(m.start.y)).toBe(44);
  });

  it('patrols and ambushes come from things[]', () => {
    const m = parseFloor(def(), 'normal');
    expect(m.actors.filter((a) => a.patrol).length).toBe(2);
    expect(m.actors.filter((a) => a.ambush).length).toBe(2);
    expect(m.turns.length).toBe(4);
  });
});

describe('floor 2 "HANGAR" (§6.2)', () => {
  const def = () => getFpsFloor('fps-2')!;

  it('is the boss floor with its numbers', () => {
    const d = def();
    expect(d).toMatchObject({ number: 2, name: 'HANGAR', par: 150, secrets: 2, boss: true, music: 'fps-floor', ceil: PAL.navy[0], floor: PAL.steel[1] });
    expect(d.rows.length).toBe(32);
    for (const r of d.rows) expect(r.length).toBe(32);
  });

  it('enemies (not the boss) 3 / 5 / 8, one MechaHitler facing south, spawns 2 / 3 / 4', () => {
    const want: Record<Difficulty, number> = { easy: 3, normal: 5, hard: 8 };
    const spawns: Record<Difficulty, number> = { easy: 2, normal: 3, hard: 4 };
    const rank: Record<Difficulty, number> = { easy: 0, normal: 1, hard: 2 };
    for (const d of DIFFS) {
      const m = parseFloor(def(), d);
      expect(m.warnings, d).toEqual([]);
      const c = counts(m);
      expect(c.guard + c.officer + c.ss + c.dog, d).toBe(want[d]);
      expect(c.boss).toBe(1);
      expect(m.spawns.filter((s) => rank[s.minDiff] <= rank[d]).length).toBe(spawns[d]);
    }
    const boss = parseFloor(def()).actors.find((a) => a.type === 'boss')!;
    expect(boss).toMatchObject({ x: 15, y: 4, facing: 'S' });
  });

  it('has no keys and no elevator; the golden record and the music box sit in the secrets', () => {
    const m = parseFloor(def(), 'normal');
    expect(m.items.some((i) => i.id.startsWith('key-'))).toBe(false);
    expect(m.switches).toEqual([]);
    expect(m.items.find((i) => i.id === 'golden-record')).toMatchObject({ x: 1, y: 30 });
    expect(m.items.find((i) => i.id === 'music-box')).toMatchObject({ x: 25, y: 30 });
    expect(m.items.find((i) => i.id === 'chaingun')).toMatchObject({ x: 4, y: 26 });
  });
});

describe('the episode', () => {
  it('plays floor 1, then floor 2', () => {
    expect(getFpsEpisode(FPS_EPISODE_ID)?.floors).toEqual(['fps-1', 'fps-2']);
  });
});
