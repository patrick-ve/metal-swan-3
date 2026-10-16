/**
 * Push walls (secrets, docs/design/fps.md §4.7): use on a push-wall cell → it slides in the
 * facing cardinal direction, 110 ticks per tile, at most 2 tiles; it stops early at a cell that
 * is not free (a solid cell, a door, a thing or an actor). It does not move when the first cell
 * behind it is not free. Each push wall is one secret; it counts when it starts to move. One
 * moves at a time. After it stops it is a normal wall. No allocations per tick.
 */
import { CELL_PUSH, type PushWall, type RayGrid } from '../../engine/ray';
import { DIR_DX, DIR_DY } from './map';

export const PUSH_TICKS_PER_TILE = 110;
export const PUSH_MAX_TILES = 2;

export type PushUse = 'moved' | 'blocked' | 'busy' | 'none';

/** `free(x, y)`: the cell can take the wall (floor, no thing, no actor, inside the grid). */
export type CellFree = (x: number, y: number) => boolean;

export class PushSystem {
  readonly grid: RayGrid;
  /** The engine's view of the moving wall (pass it to castRay / renderView / tryMove). */
  readonly push: PushWall = { active: false, x: 0, y: 0, dx: 0, dy: 0, offset: 0, tex: 0 };
  /** Tiles moved by the active wall. */
  tiles = 0;
  /** Ticks into the current tile. */
  ticks = 0;
  /** Secrets found on this floor. */
  found = 0;

  constructor(grid: RayGrid) {
    this.grid = grid;
  }

  isPushCell(x: number, y: number): boolean {
    const g = this.grid;
    return g.inside(x, y) && (g.flags[g.idx(x, y)] & CELL_PUSH) !== 0;
  }

  /** Use the push wall at (x, y) toward cardinal `dir` (0 E, 1 S, 2 W, 3 N). */
  use(x: number, y: number, dir: number, free: CellFree): PushUse {
    if (!this.isPushCell(x, y)) return 'none';
    if (this.push.active) return 'busy';
    const dx = DIR_DX[dir & 3];
    const dy = DIR_DY[dir & 3];
    if (!free(x + dx, y + dy)) return 'blocked';
    const g = this.grid;
    const i = g.idx(x, y);
    g.flags[i] &= ~CELL_PUSH;
    const p = this.push;
    p.active = true;
    p.x = x;
    p.y = y;
    p.dx = dx;
    p.dy = dy;
    p.offset = 0;
    p.tex = g.wall[i] > 0 ? g.wall[i] - 1 : 0;
    this.tiles = 0;
    this.ticks = 0;
    this.found++;
    return 'moved';
  }

  /** One tick. Returns true on the tick the wall stops (the caller rebuilds its AreaMap). */
  step(free: CellFree): boolean {
    const p = this.push;
    if (!p.active) return false;
    this.ticks++;
    if (this.ticks < PUSH_TICKS_PER_TILE) {
      p.offset = this.ticks / PUSH_TICKS_PER_TILE;
      return false;
    }
    // One tile done: the old cell is floor now, the block sits in the next cell.
    const g = this.grid;
    g.clearCell(p.x, p.y);
    p.x += p.dx;
    p.y += p.dy;
    g.setWall(p.x, p.y, p.tex);
    p.offset = 0;
    this.ticks = 0;
    this.tiles++;
    if (this.tiles < PUSH_MAX_TILES && free(p.x + p.dx, p.y + p.dy)) return false;
    p.active = false;
    return true;
  }
}
