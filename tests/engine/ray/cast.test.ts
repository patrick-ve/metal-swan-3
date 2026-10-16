import { describe, expect, it } from 'vitest';
import { castRay, lineOfSight, newRayHit } from '../../../src/engine/ray/cast';
import { DoorTable, RayGrid, type PushWall } from '../../../src/engine/ray/grid';

/** A closed box w × h with walls (texture 3) on the border. */
function box(w: number, h: number): RayGrid {
  const g = new RayGrid(w, h);
  for (let x = 0; x < w; x++) {
    g.setWall(x, 0, 3);
    g.setWall(x, h - 1, 3);
  }
  for (let y = 0; y < h; y++) {
    g.setWall(0, y, 3);
    g.setWall(w - 1, y, 3);
  }
  return g;
}

const hit = newRayHit();
const close = (a: number, b: number): void => expect(Math.abs(a - b)).toBeLessThan(1e-9);

describe('castRay', () => {
  const g = box(10, 10);
  const d = new DoorTable();

  it('hits axis walls with the right side, cell, distance and u', () => {
    expect(castRay(g, d, null, 2.5, 4.25, 1, 0, hit)).toBe(true);
    expect([hit.cellX, hit.cellY, hit.side, hit.tex, hit.door]).toEqual([9, 4, 0, 3, -1]);
    close(hit.dist, 6.5);
    close(hit.u, 0.25); // facing east: u = frac(y)
    castRay(g, d, null, 2.5, 4.25, -1, 0, hit);
    expect([hit.cellX, hit.side]).toEqual([0, 0]);
    close(hit.dist, 1.5);
    close(hit.u, 0.75); // facing west: flipped
    castRay(g, d, null, 2.25, 4.5, 0, 1, hit);
    expect([hit.cellX, hit.cellY, hit.side]).toEqual([2, 9, 1]);
    close(hit.dist, 4.5);
    close(hit.u, 0.75); // facing south: flipped
    castRay(g, d, null, 2.25, 4.5, 0, -1, hit);
    expect([hit.cellY, hit.side]).toEqual([0, 1]);
    close(hit.u, 0.25);
  });

  it('hits diagonally; t is the distance for a unit vector', () => {
    const s = Math.SQRT1_2;
    expect(castRay(g, d, null, 5.5, 5.25, s, s, hit)).toBe(true);
    // From (5.5, 5.25) at 45°: x reaches 9 at t·s = 3.5, y reaches 9 at t·s = 3.75 → the x wall first.
    expect([hit.cellX, hit.side]).toEqual([9, 0]);
    close(hit.dist, 3.5 / s);
  });

  it('gives the perpendicular distance for camera rays (no fisheye)', () => {
    // Facing east, plane (0, 1): every column hits the east wall at x = 9 → t = 9 − 2.5.
    for (const k of [-0.6, -0.3, 0, 0.2, 0.6]) {
      expect(castRay(g, d, null, 2.5, 5, 1, k, hit)).toBe(true);
      close(hit.dist, 6.5);
    }
  });

  it('respects maxDist', () => {
    expect(castRay(g, d, null, 2.5, 4.5, 1, 0, hit, 6)).toBe(false);
    expect(castRay(g, d, null, 2.5, 4.5, 1, 0, hit, 6.5)).toBe(true);
  });

  it('treats the outside as a wall with the fallback texture', () => {
    const open = new RayGrid(4, 4);
    expect(castRay(open, d, null, 1.5, 1.5, 1, 0, hit)).toBe(true);
    expect([hit.cellX, hit.tex]).toEqual([4, 0]);
    close(hit.dist, 2.5);
  });
});

describe('doors', () => {
  function doorLevel(vertical: boolean): { g: RayGrid; d: DoorTable } {
    const g = box(10, 10);
    const d = new DoorTable();
    d.edgeTex = 7;
    if (vertical) {
      for (let y = 1; y < 9; y++) if (y !== 4) g.setWall(5, y, 3);
      d.place(g, 5, 4, true, 6);
    } else {
      for (let x = 1; x < 9; x++) if (x !== 4) g.setWall(x, 5, 3);
      d.place(g, 4, 5, false, 6);
    }
    return { g, d };
  }

  it('hits a closed door at the tile centre with u along the plane', () => {
    const { g, d } = doorLevel(true);
    expect(castRay(g, d, null, 2.5, 4.3, 1, 0, hit)).toBe(true);
    expect([hit.cellX, hit.cellY, hit.door, hit.tex, hit.side]).toEqual([5, 4, 0, 6, 0]);
    close(hit.dist, 3);
    close(hit.u, 0.3);
  });

  it('lets rays through the open fraction (u < open) and offsets u on the panel', () => {
    const { g, d } = doorLevel(true);
    d.open[0] = 0.5;
    castRay(g, d, null, 2.5, 4.3, 1, 0, hit);
    expect(hit.cellX).toBe(9); // through the gap
    castRay(g, d, null, 2.5, 4.7, 1, 0, hit);
    expect(hit.door).toBe(0);
    close(hit.u, 0.2);
    d.open[0] = 1;
    castRay(g, d, null, 2.5, 4.99, 1, 0, hit);
    expect(hit.cellX).toBe(9);
  });

  it('works for horizontal doors (side 1) and from inside the door cell', () => {
    const { g, d } = doorLevel(false);
    castRay(g, d, null, 4.25, 2.5, 0, 1, hit);
    expect([hit.door, hit.side]).toEqual([0, 1]);
    close(hit.dist, 3);
    close(hit.u, 0.25);
    // Standing in the door cell north of the plane, looking south.
    castRay(g, d, null, 4.5, 5.2, 0, 1, hit);
    expect(hit.door).toBe(0);
    close(hit.dist, 0.3);
  });

  it('draws the jamb texture on the walls seen from inside the door cell', () => {
    const { g, d } = doorLevel(true);
    d.open[0] = 1;
    castRay(g, d, null, 5.5, 4.5, 0, -1, hit);
    expect([hit.cellX, hit.cellY, hit.tex]).toEqual([5, 3, 7]);
    castRay(g, d, null, 2.5, 4.5, 1, 0, hit);
    expect(hit.tex).toBe(3); // the far wall keeps its texture
  });
});

describe('push wall', () => {
  it('draws the block shifted by its offset and ignores its grid cells', () => {
    const g = box(10, 10);
    const d = new DoorTable();
    g.setWall(5, 4, 3);
    const push: PushWall = { active: true, x: 5, y: 4, dx: 1, dy: 0, offset: 0.25, tex: 9 };
    castRay(g, d, push, 2.5, 4.5, 1, 0, hit);
    expect([hit.tex, hit.side, hit.cellX]).toEqual([9, 0, 5]);
    close(hit.dist, 2.75);
    // A ray north of the block's row passes; a ray into the vacated part of (5, 4) from the north.
    castRay(g, d, push, 5.1, 1.5, 0, 1, hit);
    expect(hit.cellY).toBe(9); // x 5.1 < 5.25: the vacated strip
    castRay(g, d, push, 5.5, 1.5, 0, 1, hit);
    expect([hit.tex, hit.side]).toEqual([9, 1]);
    close(hit.dist, 2.5);
    close(hit.u, 1 - 0.25); // facing south: flipped, relative to the block
    // Into the target cell (6, 4).
    castRay(g, d, push, 6.1, 1.5, 0, 1, hit);
    expect(hit.tex).toBe(9);
    castRay(g, d, push, 6.5, 1.5, 0, 1, hit);
    expect(hit.cellY).toBe(9); // x 6.5 > 6.25: beyond the block
    // Inactive: the grid wall is back.
    push.active = false;
    castRay(g, d, push, 5.1, 1.5, 0, 1, hit);
    expect([hit.cellX, hit.cellY, hit.tex]).toEqual([5, 4, 3]);
  });
});

describe('lineOfSight', () => {
  it('is blocked by walls and closed doors, open through gaps', () => {
    const g = box(10, 10);
    const d = new DoorTable();
    for (let y = 1; y < 9; y++) if (y !== 4) g.setWall(5, y, 3);
    d.place(g, 5, 4, true, 6);
    expect(lineOfSight(g, d, null, 2.5, 4.5, 4.5, 4.5)).toBe(true);
    expect(lineOfSight(g, d, null, 2.5, 4.5, 7.5, 4.5)).toBe(false);
    expect(lineOfSight(g, d, null, 2.5, 2.5, 7.5, 2.5)).toBe(false);
    d.open[0] = 1;
    expect(lineOfSight(g, d, null, 2.5, 4.5, 7.5, 4.5)).toBe(true);
    expect(lineOfSight(g, d, null, 7.5, 4.5, 2.5, 4.5)).toBe(true);
    expect(lineOfSight(g, d, null, 2.5, 2.5, 7.5, 6.5)).toBe(false);
    // Target just in front of the door plane: sight reaches it even when closed.
    d.open[0] = 0;
    expect(lineOfSight(g, d, null, 2.5, 4.5, 5.3, 4.5)).toBe(true);
    expect(lineOfSight(g, d, null, 3, 3, 3, 3)).toBe(true);
  });
});
