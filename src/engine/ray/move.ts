/**
 * Box movement against the tile grid: axis-separated (x, then y), so a box slides along walls.
 * A blocked axis moves up to the contact point (no gap in front of a wall). No allocations.
 */
import { CELL_DOOR, CELL_PROP, CELL_SOLID, type DoorTable, type PushWall, type RayGrid } from './grid';

/** A square box: centre (x, y), half-size r (tiles). */
export interface MoveBox {
  x: number;
  y: number;
  r: number;
}

/** Other boxes that block (actors): centres and half-sizes. `count` entries are used. */
export interface Blockers {
  count: number;
  x: Float64Array;
  y: Float64Array;
  r: Float64Array;
}

/** A Blockers table with room for `max` boxes. */
export function newBlockers(max = 128): Blockers {
  return { count: 0, x: new Float64Array(max), y: new Float64Array(max), r: new Float64Array(max) };
}

/** Gap kept between a box and what it touches (tiles). */
export const MOVE_SKIN = 1e-4;
/** Overlap tolerance on the cross axis (touching edges do not block). */
const EDGE = 1e-9;

/**
 * True when cell (x, y) blocks movement: outside the grid, CELL_SOLID or CELL_PROP, a door that
 * is not fully open (`open < 1`), or one of the two cells of the active push wall.
 */
export function cellBlocks(g: RayGrid, d: DoorTable, push: PushWall | null, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return true;
  if (push !== null && push.active) {
    if ((x === push.x && y === push.y) || (x === push.x + push.dx && y === push.y + push.dy)) return true;
  }
  const i = y * g.w + x;
  const f = g.flags[i];
  if ((f & CELL_DOOR) !== 0) {
    const di = g.door[i];
    return di < 0 || di >= d.count || d.open[di] < 1;
  }
  return (f & (CELL_SOLID | CELL_PROP)) !== 0;
}

/**
 * Axis-separated move (x, then y) of a square box (half-size r) against solid cells, closed or
 * moving doors, props, the active push wall and blockers (`self` = the index in `b` to skip).
 * Mutates `box`; returns bit 1 = moved on x, bit 2 = moved on y. Obstacles the box already
 * overlaps do not block (so it can always walk out).
 */
export function tryMove(
  g: RayGrid,
  d: DoorTable,
  push: PushWall | null,
  box: MoveBox,
  dx: number,
  dy: number,
  b?: Blockers,
  self = -1,
): number {
  let moved = 0;
  if (dx !== 0) {
    S[0] = box.x;
    S[1] = box.y;
    S[2] = box.r;
    S[3] = dx;
    moveAxis(g, d, push, true, b, self);
    if (S[4] !== box.x) {
      box.x = S[4];
      moved |= 1;
    }
  }
  if (dy !== 0) {
    S[0] = box.y;
    S[1] = box.x;
    S[2] = box.r;
    S[3] = dy;
    moveAxis(g, d, push, false, b, self);
    if (S[4] !== box.y) {
      box.y = S[4];
      moved |= 2;
    }
  }
  return moved;
}

/** Scratch (avoids boxing doubles across calls): in a, c, r, delta; out the new position. */
const S = new Float64Array(5);

/**
 * New position on one axis (S[4]). S[0] `a` = the position on the moving axis, S[1] `c` = on the
 * cross axis, S[2] = r, S[3] = delta. `onX` = moving along x (cells (a, c)), else along y (cells (c, a)).
 */
function moveAxis(g: RayGrid, d: DoorTable, push: PushWall | null, onX: boolean, b: Blockers | undefined, self: number): void {
  const a = S[0];
  const c = S[1];
  const r = S[2];
  const delta = S[3];
  let target = a + delta;
  const c0 = Math.floor(c - r + EDGE);
  const c1 = Math.floor(c + r - EDGE);
  if (delta > 0) {
    const edge = a + r; // leading edge now
    const first = Math.floor(edge);
    const lastCol = Math.floor(edge + delta);
    for (let col = first; col <= lastCol; col++) {
      if (col < edge - EDGE) continue; // the column the box is in: never blocks
      let hit = false;
      for (let row = c0; row <= c1 && !hit; row++) {
        hit = onX ? cellBlocks(g, d, push, col, row) : cellBlocks(g, d, push, row, col);
      }
      if (hit) {
        const lim = col - r - MOVE_SKIN;
        if (lim < target) target = lim;
        break;
      }
    }
  } else {
    const edge = a - r;
    const first = Math.floor(edge - EDGE); // the column touched by the edge from the inside
    const lastCol = Math.floor(edge + delta);
    for (let col = first; col >= lastCol; col--) {
      if (col + 1 > edge + EDGE) continue;
      let hit = false;
      for (let row = c0; row <= c1 && !hit; row++) {
        hit = onX ? cellBlocks(g, d, push, col, row) : cellBlocks(g, d, push, row, col);
      }
      if (hit) {
        const lim = col + 1 + r + MOVE_SKIN;
        if (lim > target) target = lim;
        break;
      }
    }
  }
  if (b !== undefined) {
    const bx = onX ? b.x : b.y;
    const by = onX ? b.y : b.x;
    for (let i = 0; i < b.count; i++) {
      if (i === self) continue;
      const br = b.r[i];
      if (Math.abs(by[i] - c) >= br + r - EDGE) continue; // no overlap on the cross axis
      const ba = bx[i];
      if (delta > 0) {
        const face = ba - br; // the blocker's near face
        if (face < a + r - EDGE) continue; // already overlapping or behind
        const lim = face - r - MOVE_SKIN;
        if (lim < target) target = lim;
      } else {
        const face = ba + br;
        if (face > a - r + EDGE) continue;
        const lim = face + r + MOVE_SKIN;
        if (lim > target) target = lim;
      }
    }
  }
  // Never move backward because of a contact limit.
  if (delta > 0 ? target < a : target > a) target = a;
  S[4] = target;
}
