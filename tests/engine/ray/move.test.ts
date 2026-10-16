import { describe, expect, it } from 'vitest';
import { CELL_PROP, DoorTable, RayGrid, type PushWall } from '../../../src/engine/ray/grid';
import { MOVE_SKIN, newBlockers, tryMove, type MoveBox } from '../../../src/engine/ray/move';

function box(w: number, h: number): RayGrid {
  const g = new RayGrid(w, h);
  for (let x = 0; x < w; x++) {
    g.setWall(x, 0, 1);
    g.setWall(x, h - 1, 1);
  }
  for (let y = 0; y < h; y++) {
    g.setWall(0, y, 1);
    g.setWall(w - 1, y, 1);
  }
  return g;
}

const R = 0.25;
const near = (a: number, b: number): void => expect(Math.abs(a - b)).toBeLessThan(1e-6);

describe('tryMove', () => {
  it('moves freely and stops flush at a wall', () => {
    const g = box(8, 8);
    const d = new DoorTable();
    const b: MoveBox = { x: 3.5, y: 3.5, r: R };
    expect(tryMove(g, d, null, b, 0.3, 0.2)).toBe(3);
    near(b.x, 3.8);
    near(b.y, 3.7);
    b.x = 6.5;
    expect(tryMove(g, d, null, b, 0.5, 0) & 1).toBe(1);
    near(b.x, 7 - R - MOVE_SKIN);
    // Pressing on: no more movement on x.
    expect(tryMove(g, d, null, b, 0.5, 0)).toBe(0);
    b.x = 1.4;
    tryMove(g, d, null, b, -0.5, 0);
    near(b.x, 1 + R + MOVE_SKIN);
  });

  it('slides along a wall when moving diagonally into it', () => {
    const g = box(8, 8);
    const d = new DoorTable();
    const b: MoveBox = { x: 6.7, y: 3.5, r: R };
    const m = tryMove(g, d, null, b, 0.2, 0.2);
    expect(m).toBe(3);
    near(b.x, 7 - R - MOVE_SKIN);
    near(b.y, 3.7);
  });

  it('blocks at an outside corner but lets the box pass a corner it clears', () => {
    const g = box(10, 10);
    const d = new DoorTable();
    g.setWall(5, 5, 1);
    // Box at y 4.8 overlaps row 5 (4.55..5.05): blocked by cell (5, 5).
    const b: MoveBox = { x: 4.5, y: 4.8, r: R };
    tryMove(g, d, null, b, 0.5, 0);
    near(b.x, 5 - R - MOVE_SKIN);
    // Box at y 4.74 clears row 5 (top edge 4.99): passes.
    const c: MoveBox = { x: 4.5, y: 4.74, r: R };
    tryMove(g, d, null, c, 0.5, 0);
    near(c.x, 5);
    // A box touching the cell edge exactly (y + r = 5) does not count as overlapping.
    const e: MoveBox = { x: 4.5, y: 4.75, r: R };
    tryMove(g, d, null, e, 0.5, 0);
    near(e.x, 5);
  });

  it('blocks on doors until fully open, and on props', () => {
    const g = box(10, 10);
    const d = new DoorTable();
    d.place(g, 5, 4, true, 2);
    const b: MoveBox = { x: 3.5, y: 4.5, r: R };
    tryMove(g, d, null, b, 2, 0);
    near(b.x, 5 - R - MOVE_SKIN);
    d.open[0] = 0.99;
    tryMove(g, d, null, b, 1, 0);
    near(b.x, 5 - R - MOVE_SKIN);
    d.open[0] = 1;
    tryMove(g, d, null, b, 1, 0);
    near(b.x, 6 - R - MOVE_SKIN);
    g.flags[g.idx(7, 4)] |= CELL_PROP;
    tryMove(g, d, null, b, 2, 0);
    near(b.x, 7 - R - MOVE_SKIN);
  });

  it('blocks on both cells of the active push wall', () => {
    const g = box(10, 10);
    const d = new DoorTable();
    const push: PushWall = { active: true, x: 5, y: 4, dx: 1, dy: 0, offset: 0.5, tex: 1 };
    const b: MoveBox = { x: 6.5, y: 2.5, r: R };
    tryMove(g, d, push, b, 0, 2);
    near(b.y, 4 - R - MOVE_SKIN);
  });

  it('stops at blockers, skips self, and never traps an overlapping box', () => {
    const g = box(10, 10);
    const d = new DoorTable();
    const bl = newBlockers(4);
    bl.count = 2;
    bl.x[0] = 5;
    bl.y[0] = 4.5;
    bl.r[0] = 0.3;
    bl.x[1] = 3;
    bl.y[1] = 4.5;
    bl.r[1] = R;
    const b: MoveBox = { x: 3, y: 4.5, r: R };
    tryMove(g, d, null, b, 2, 0, bl, 1);
    near(b.x, 5 - 0.3 - R - MOVE_SKIN);
    // Without `self`, blocker 1 sits exactly on the box: it overlaps, so it does not block.
    const c: MoveBox = { x: 3, y: 4.5, r: R };
    tryMove(g, d, null, c, -0.5, 0, bl);
    near(c.x, 2.5);
    // A blocker beside the path (no cross-axis overlap) does not block.
    const e: MoveBox = { x: 3, y: 4.5 - 0.55 - 1e-6, r: R };
    tryMove(g, d, null, e, 1, 0, bl, 1);
    near(e.x, 4);
  });

  it('is exact for the same inputs', () => {
    const run = (): number[] => {
      const g = box(12, 12);
      g.setWall(6, 6, 1);
      const d = new DoorTable();
      const b: MoveBox = { x: 2.5, y: 2.5, r: 0.3 };
      for (let i = 0; i < 200; i++) tryMove(g, d, null, b, Math.cos(i * 0.37) * 0.11, Math.sin(i * 0.53) * 0.11);
      return [b.x, b.y];
    };
    expect(run()).toEqual(run());
  });
});
