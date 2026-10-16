import { describe, expect, it } from 'vitest';
import { AreaMap } from '../../../src/engine/ray/areas';
import { DoorTable, RayGrid } from '../../../src/engine/ray/grid';

/**
 *   #########
 *   #..#..#.#
 *   #..D..D.#
 *   #..#..#.#
 *   #H#######
 *   #.......#
 *   #########
 */
const MAP = ['#########', '#..#..#.#', '#..D..D.#', '#..#..#.#', '#H#######', '#.......#', '#########'];

function level(): { g: RayGrid; d: DoorTable; doors: number[] } {
  const g = new RayGrid(MAP[0].length, MAP.length);
  const d = new DoorTable();
  const doors: number[] = [];
  MAP.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '#') g.setWall(x, y, 0);
      else if (ch === 'D') doors.push(d.place(g, x, y, true, 0));
      else if (ch === 'H') doors.push(d.place(g, x, y, false, 0));
    }),
  );
  return { g, d, doors };
}

describe('AreaMap', () => {
  it('floods areas split by doors and links them', () => {
    const { g, d, doors } = level();
    const m = new AreaMap(g, d);
    expect(m.count).toBe(4);
    const A = g.area[g.idx(1, 1)];
    const B = g.area[g.idx(4, 2)];
    const C = g.area[g.idx(7, 3)];
    const S = g.area[g.idx(5, 5)];
    expect(new Set([A, B, C, S]).size).toBe(4);
    expect(g.area[g.idx(3, 2)]).toBe(0); // door cell
    expect(g.area[g.idx(0, 0)]).toBe(0); // wall
    expect([m.doorArea(doors[0], 0), m.doorArea(doors[0], 1)]).toEqual([A, B]);
    expect([m.doorArea(doors[2], 0), m.doorArea(doors[2], 1)]).toEqual([A, S]);
  });

  it('recomputes reach when doors open and close', () => {
    const { g, d, doors } = level();
    const m = new AreaMap(g, d);
    const A = g.area[g.idx(1, 1)];
    const B = g.area[g.idx(4, 2)];
    const C = g.area[g.idx(7, 3)];
    const S = g.area[g.idx(5, 5)];
    m.computeReach(A);
    expect([m.reached(A), m.reached(B), m.reached(C), m.reached(S)]).toEqual([true, false, false, false]);
    m.setDoorOpen(doors[0], true);
    m.computeReach(A);
    expect([m.reached(B), m.reached(C)]).toEqual([true, false]);
    m.setDoorOpen(doors[1], true);
    m.computeReach(A);
    expect(m.reached(C)).toBe(true);
    m.computeReach(C);
    expect([m.reached(A), m.reached(S)]).toEqual([true, false]);
    m.setDoorOpen(doors[0], false);
    m.computeReach(C);
    expect([m.reached(B), m.reached(A)]).toEqual([true, false]);
    m.setDoorOpen(doors[2], true);
    m.computeReach(S);
    expect([m.reached(A), m.reached(B)]).toEqual([true, false]);
    expect(m.reached(0)).toBe(false);
  });

  it('starts with doors that are already open', () => {
    const { g, d, doors } = level();
    d.open[doors[0]] = 1;
    const m = new AreaMap(g, d);
    m.computeReach(g.area[g.idx(1, 1)]);
    expect(m.reached(g.area[g.idx(4, 2)])).toBe(true);
  });
});
