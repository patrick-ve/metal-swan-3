import { beforeAll, describe, expect, it, vi } from 'vitest';
import { CELL_DOOR, CELL_OPAQUE, CELL_PROP, CELL_PUSH, CELL_SOLID, rayTextureIndex } from '../../../src/engine/ray';
import { PAL } from '../../../src/engine/palette';
import { isLazyContent } from '../../../src/game/content/index';
import { cardinalAngle, LOCK_GOLD, LOCK_LIFT, LOCK_NONE, LOCK_SILVER, parseFloor, WALL_TEXTURES } from '../../../src/game/fps/map';
import { getFpsFloor } from '../../../src/game/fps/registry';
import type { FpsFloorDef } from '../../../src/game/fps/types';
import { parseLaunchParams } from '../../../src/game/params';

beforeAll(async () => {
  await import('../../../src/game/content/fps/index');
});

function def(rows: string[], extra: Partial<FpsFloorDef> = {}): FpsFloorDef {
  return { id: `t-${rows.join('/')}`, number: 9, name: 'T', par: 60, secrets: 0, rows, ceil: PAL.steel[0], floor: PAL.stone[1], music: 'fps-floor', ...extra };
}

describe('parseFloor — floor 0 (TEST RANGE)', () => {
  it('is registered and parses without warnings', () => {
    const f = getFpsFloor('fps-0');
    expect(f).toBeDefined();
    const m = parseFloor(f!, 'normal');
    expect(m.warnings).toEqual([]);
    expect([m.w, m.h]).toEqual([20, 12]);
    expect(m.start).toEqual({ x: 1.5, y: 5.5, angle: 0 });
  });

  it('shows every wall texture A–P, has a closed border and the elevator switch', () => {
    const f = getFpsFloor('fps-0')!;
    const letters = new Set(f.rows.join(''));
    for (const l of 'ABCDEFGHIJKLMNOP') expect(letters.has(l), l).toBe(true);
    const m = parseFloor(f);
    const g = m.grid;
    for (let x = 0; x < m.w; x++) {
      expect(g.opaqueAt(x, 0)).toBe(true);
      expect(g.opaqueAt(x, m.h - 1)).toBe(true);
    }
    for (let y = 0; y < m.h; y++) {
      expect(g.opaqueAt(0, y)).toBe(true);
      expect(g.opaqueAt(m.w - 1, y)).toBe(true);
    }
    expect(m.switches).toEqual([{ x: 19, y: 2 }]);
    expect(g.wall[g.idx(19, 2)] - 1).toBe(rayTextureIndex(WALL_TEXTURES.X));
  });

  it('places the doors with their planes and locks', () => {
    const m = parseFloor(getFpsFloor('fps-0')!);
    const doors: Array<[number, number, number, number]> = [];
    for (let i = 0; i < m.doors.count; i++) doors.push([m.doors.x[i], m.doors.y[i], m.doors.vertical[i], m.doorLock[i]]);
    expect(doors).toEqual([
      [8, 3, 1, LOCK_NONE],
      [16, 5, 0, LOCK_LIFT],
      [11, 6, 0, LOCK_NONE],
      [8, 8, 1, LOCK_GOLD],
      [14, 9, 1, LOCK_SILVER],
    ]);
    const g = m.grid;
    expect(g.flags[g.idx(8, 3)]).toBe(CELL_DOOR);
    expect(g.door[g.idx(8, 8)]).toBe(3);
    expect(m.doors.edgeTex).toBe(rayTextureIndex('fps/door/edge'));
    expect(m.doors.tex[3]).toBe(rayTextureIndex('fps/door/gold'));
  });

  it('has one push wall, the keys, the record and a solid barrel', () => {
    const m = parseFloor(getFpsFloor('fps-0')!);
    expect(m.pushes).toHaveLength(1);
    expect(m.pushes[0]).toMatchObject({ x: 3, y: 9, letter: 'A', tex: rayTextureIndex('fps/wall/concrete') });
    const g = m.grid;
    expect(g.flags[g.idx(3, 9)] & (CELL_PUSH | CELL_SOLID | CELL_OPAQUE)).toBe(CELL_PUSH | CELL_SOLID | CELL_OPAQUE);
    const at = (id: string) => m.items.filter((i) => i.id === id).map((i) => [i.x, i.y]);
    expect(at('key-gold')).toEqual([[10, 1]]);
    expect(at('key-silver')).toEqual([[11, 7]]);
    expect(at('golden-record')).toEqual([[2, 10]]);
    expect(m.props).toEqual([{ id: 'barrel', x: 3, y: 3, solid: true }]);
    expect(g.flags[g.idx(3, 3)]).toBe(CELL_PROP);
    expect(getFpsFloor('fps-0')!.secrets).toBe(m.pushes.length);
  });
});

describe('parseFloor — legend rules', () => {
  it('warns once on an unknown char and makes it floor', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const m = parseFloor(def(['AAAAA', 'A>.%A', 'A.%.A', 'AAAAA']));
    expect(m.warnings.filter((w) => w.includes('"%"'))).toHaveLength(1);
    expect(m.grid.flags[m.grid.idx(3, 1)]).toBe(0);
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('"%"'))).toHaveLength(1);
    warn.mockRestore();
  });

  it('filters actors by their char and pickups by things min/max difficulty', () => {
    const rows = ['AAAAAAA', 'A>ghi.A', 'A..c+.A', 'AAAAAAA'];
    const things = [{ at: [3, 2] as const, minDiff: 'hard' as const }, { at: [4, 2] as const, maxDiff: 'easy' as const }];
    const count = (d: 'easy' | 'normal' | 'hard') => {
      const m = parseFloor(def(rows, { things }), d);
      return [m.actors.length, m.items.length];
    };
    expect(count('easy')).toEqual([1, 1]);
    expect(count('normal')).toEqual([2, 0]);
    expect(count('hard')).toEqual([3, 1]);
  });

  it('faces actors along the longest free run unless things set a facing', () => {
    const rows = ['AAAAAAA', 'A>....A', 'A.....A', 'A.g...A', 'AAAAAAA'];
    expect(parseFloor(def(rows)).actors[0].facing).toBe('E');
    const m = parseFloor(def(rows, { things: [{ at: [2, 3], facing: 'W', ambush: true, patrol: true }] }));
    expect(m.actors[0]).toMatchObject({ type: 'guard', facing: 'W', ambush: true, patrol: true });
  });

  it('takes the push-wall texture from things.tex or the neighbours (ties N, E, S, W)', () => {
    const rows = ['ACCA', 'A*.A', 'H.>A', 'AAAA'];
    const m = parseFloor(def(rows));
    expect(m.pushes[0].letter).toBe('C'); // N = C, W = A (ties: N first)
    const m2 = parseFloor(def(rows, { things: [{ at: [1, 1], tex: 'M' }] }));
    expect(m2.pushes[0].tex).toBe(rayTextureIndex('fps/wall/tile'));
  });

  it('uses walls overrides, reads all start facings and the turn / spawn markers', () => {
    const m = parseFloor(def(['AAAA', 'Av.A', 'AAAA'], { walls: { A: 'fps/wall/steel' }, things: [{ at: [2, 1], turn: 'S' }, { at: [2, 1], spawn: 'ss', minDiff: 'normal' }] }));
    expect(m.grid.wall[0] - 1).toBe(rayTextureIndex('fps/wall/steel'));
    expect(m.start.angle).toBe(cardinalAngle('S'));
    expect(m.turns).toEqual([{ x: 2, y: 1, dir: 'S' }]);
    expect(m.spawns).toEqual([{ x: 2, y: 1, minDiff: 'normal' }]);
    for (const [ch, c] of [['^', 'N'], ['>', 'E'], ['<', 'W']] as const) {
      expect(parseFloor(def(['AAA', `A${ch}A`, 'AAA'])).start.angle).toBe(cardinalAngle(c));
    }
  });

  it('fails soft on a missing start and ragged rows', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const m = parseFloor(def(['AAAA', 'A..', 'AAAA']));
    expect(m.start).toEqual({ x: 1.5, y: 1.5, angle: 0 });
    expect(m.warnings.some((w) => w.includes('no start'))).toBe(true);
    expect(m.warnings.some((w) => w.includes('row 1'))).toBe(true);
    expect(m.grid.opaqueAt(3, 1)).toBe(true);
    warn.mockRestore();
  });
});

describe('fps launch params and lazy content', () => {
  it('parses ?mode=fps&floor=n and leaves both unset otherwise', () => {
    expect(parseLaunchParams('?mode=fps&floor=0')).toMatchObject({ mode: 'fps', floor: 0 });
    expect(parseLaunchParams('?mode=fps').floor).toBe(1);
    expect(parseLaunchParams('?mode=bridge').mode).toBe('bridge');
    const p = parseLaunchParams('?mission=ams');
    expect('mode' in p).toBe(false);
    expect('floor' in p).toBe(false);
    expect(parseLaunchParams('?mode=xyz&floor=7').mode).toBeUndefined();
  });

  it('marks only the fps entries lazy', () => {
    expect(isLazyContent('fps')).toBe(true);
    expect(isLazyContent('fps/art')).toBe(true);
    expect(isLazyContent('fx/art')).toBe(false);
    expect(isLazyContent('missions/ams')).toBe(false);
  });
});
