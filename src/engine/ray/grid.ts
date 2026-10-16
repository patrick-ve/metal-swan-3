/**
 * The tile grid of a raycaster floor (structure of arrays), its sliding doors and the one moving
 * push wall. Pure data: the game writes it, `castRay`, `renderView`, `tryMove` and `AreaMap` read it.
 *
 * Cell (x, y) covers [x, x+1) × [y, y+1); y grows downward (south). Cells outside the grid count
 * as solid, opaque walls.
 */

/** Blocks movement. */
export const CELL_SOLID = 1;
/** Stops rays (a wall); drawn with `wall[i] − 1` as its texture index. */
export const CELL_OPAQUE = 2;
/** A sliding door cell; `door[i]` is its index in the `DoorTable`. */
export const CELL_DOOR = 4;
/** A push-wall cell (a secret). For rays it is a normal wall until the game makes it the active `PushWall`. */
export const CELL_PUSH = 8;
/** A solid prop (blocks movement, not rays). */
export const CELL_PROP = 16;

export class RayGrid {
  readonly w: number;
  readonly h: number;
  /** Texture index + 1 per cell (0 = none). */
  readonly wall: Uint16Array;
  /** CELL_* bits. */
  readonly flags: Uint8Array;
  /** Area id 1..255 (0 = wall / door); `AreaMap` fills it. */
  readonly area: Uint8Array;
  /** Door index or −1. */
  readonly door: Int16Array;

  constructor(w: number, h: number) {
    this.w = Math.max(1, w | 0);
    this.h = Math.max(1, h | 0);
    const n = this.w * this.h;
    this.wall = new Uint16Array(n);
    this.flags = new Uint8Array(n);
    this.area = new Uint8Array(n);
    this.door = new Int16Array(n).fill(-1);
  }

  idx(x: number, y: number): number {
    return y * this.w + x;
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  /** CELL_SOLID or CELL_PROP set, or outside the grid. Doors are not resolved here (see `tryMove`). */
  solidAt(x: number, y: number): boolean {
    if (!this.inside(x, y)) return true;
    return (this.flags[y * this.w + x] & (CELL_SOLID | CELL_PROP)) !== 0;
  }

  /** CELL_OPAQUE set, or outside the grid. */
  opaqueAt(x: number, y: number): boolean {
    if (!this.inside(x, y)) return true;
    return (this.flags[y * this.w + x] & CELL_OPAQUE) !== 0;
  }

  /** Convenience for builders and tests: a solid, opaque wall with texture index `tex`. */
  setWall(x: number, y: number, tex: number): void {
    if (!this.inside(x, y)) return;
    const i = y * this.w + x;
    this.wall[i] = tex + 1;
    this.flags[i] = (this.flags[i] & ~(CELL_DOOR | CELL_PROP)) | CELL_SOLID | CELL_OPAQUE;
    this.door[i] = -1;
  }

  /** Convenience: make the cell empty floor (no wall, no flags, no door). */
  clearCell(x: number, y: number): void {
    if (!this.inside(x, y)) return;
    const i = y * this.w + x;
    this.wall[i] = 0;
    this.flags[i] = 0;
    this.door[i] = -1;
  }
}

export class DoorTable {
  count = 0;
  readonly max: number;
  readonly x: Int16Array;
  readonly y: Int16Array;
  /** 1 = the door plane runs north–south (you pass east–west). */
  readonly vertical: Uint8Array;
  /** 0 closed .. 1 open (the game writes it). */
  readonly open: Float64Array;
  /** Texture index of the door face. */
  readonly tex: Uint16Array;
  /**
   * Texture index of the door jamb: the wall faces seen from inside a door cell (the two walls
   * next to the door). −1 = those walls keep their own texture.
   */
  edgeTex = -1;

  constructor(max = 64) {
    this.max = Math.max(1, max | 0);
    this.x = new Int16Array(this.max);
    this.y = new Int16Array(this.max);
    this.vertical = new Uint8Array(this.max);
    this.open = new Float64Array(this.max);
    this.tex = new Uint16Array(this.max);
  }

  /** Add a closed door; returns its index, or −1 (with a warning) when the table is full. */
  add(x: number, y: number, vertical: boolean, tex: number): number {
    if (this.count >= this.max) {
      console.warn(`[ray] DoorTable full (${this.max}) — door at ${x},${y} ignored`);
      return -1;
    }
    const i = this.count++;
    this.x[i] = x;
    this.y[i] = y;
    this.vertical[i] = vertical ? 1 : 0;
    this.open[i] = 0;
    this.tex[i] = tex;
    return i;
  }

  /** Convenience: add a door and mark its grid cell (CELL_DOOR, `grid.door`). Returns the index or −1. */
  place(g: RayGrid, x: number, y: number, vertical: boolean, tex: number): number {
    const i = this.add(x, y, vertical, tex);
    if (i < 0 || !g.inside(x, y)) return i;
    const c = g.idx(x, y);
    g.wall[c] = 0;
    g.flags[c] = CELL_DOOR;
    g.door[c] = i;
    return i;
  }
}

/**
 * The one moving push wall. While `active`, the block is drawn shifted by `offset` (0..1) in
 * (dx, dy) from cell (x, y): it covers parts of (x, y) and (x + dx, y + dy), and both cells block
 * movement. The engine ignores the grid's own wall in those two cells while `active`; the game
 * moves `x, y` cell by cell (offset back to 0) and writes the wall into the grid when it stops.
 */
export interface PushWall {
  active: boolean;
  x: number;
  y: number;
  dx: number;
  dy: number;
  offset: number;
  tex: number;
}
