/**
 * Areas: connected open regions of the grid, split by doors (and walls). Each door links the two
 * areas on either side of its passage; `computeReach` floods over the doors marked open. Used for
 * sound propagation (gunfire wakes the areas it reaches). No allocations after construction.
 */
import { CELL_DOOR, CELL_OPAQUE, type DoorTable, type RayGrid } from './grid';

export const MAX_AREAS = 255;

export class AreaMap {
  /** Number of areas (ids 1..count). */
  readonly count: number;
  private readonly g: RayGrid;
  private readonly d: DoorTable;
  /** Per door: the two linked areas (0 = none) and whether the game counts it as open. */
  private readonly linkA: Uint8Array;
  private readonly linkB: Uint8Array;
  private readonly doorOpen: Uint8Array;
  private readonly reach: Uint8Array;
  private readonly queue: Uint8Array;
  private readonly stack: Int32Array;

  /** Floods `g.area` (0 = wall / door; open cells and props get 1..255) and links the doors. */
  constructor(g: RayGrid, d: DoorTable) {
    this.g = g;
    this.d = d;
    this.linkA = new Uint8Array(d.max);
    this.linkB = new Uint8Array(d.max);
    this.doorOpen = new Uint8Array(d.max);
    this.reach = new Uint8Array(MAX_AREAS + 1);
    this.queue = new Uint8Array(MAX_AREAS + 1);
    this.stack = new Int32Array(g.w * g.h);
    this.count = this.flood();
    this.link();
  }

  private flood(): number {
    const g = this.g;
    const n = g.w * g.h;
    g.area.fill(0);
    let next = 0;
    let warned = false;
    for (let start = 0; start < n; start++) {
      if (g.area[start] !== 0 || (g.flags[start] & (CELL_OPAQUE | CELL_DOOR)) !== 0) continue;
      let id: number;
      if (next < MAX_AREAS) id = ++next;
      else {
        id = MAX_AREAS;
        if (!warned) {
          console.warn(`[ray] more than ${MAX_AREAS} areas — the rest share area ${MAX_AREAS}`);
          warned = true;
        }
      }
      let sp = 0;
      this.stack[sp++] = start;
      g.area[start] = id;
      while (sp > 0) {
        const i = this.stack[--sp];
        const x = i % g.w;
        const y = (i / g.w) | 0;
        if (x > 0) sp = this.visit(i - 1, id, sp);
        if (x < g.w - 1) sp = this.visit(i + 1, id, sp);
        if (y > 0) sp = this.visit(i - g.w, id, sp);
        if (y < g.h - 1) sp = this.visit(i + g.w, id, sp);
      }
    }
    return next;
  }

  private visit(i: number, id: number, sp: number): number {
    const g = this.g;
    if (g.area[i] !== 0 || (g.flags[i] & (CELL_OPAQUE | CELL_DOOR)) !== 0) return sp;
    g.area[i] = id;
    this.stack[sp] = i;
    return sp + 1;
  }

  private areaAt(x: number, y: number): number {
    return this.g.inside(x, y) ? this.g.area[this.g.idx(x, y)] : 0;
  }

  private link(): void {
    const d = this.d;
    for (let i = 0; i < d.count; i++) {
      const x = d.x[i];
      const y = d.y[i];
      if (d.vertical[i] === 1) {
        this.linkA[i] = this.areaAt(x - 1, y);
        this.linkB[i] = this.areaAt(x + 1, y);
      } else {
        this.linkA[i] = this.areaAt(x, y - 1);
        this.linkB[i] = this.areaAt(x, y + 1);
      }
      this.doorOpen[i] = d.open[i] > 0 ? 1 : 0;
    }
  }

  /** An area a door links: side 0 = west / north, 1 = east / south (0 = a wall there). */
  doorArea(door: number, side: 0 | 1): number {
    if (door < 0 || door >= this.d.count) return 0;
    return side === 0 ? this.linkA[door] : this.linkB[door];
  }

  /** Mark a door as open (sound passes) or closed. The current reach is not recomputed. */
  setDoorOpen(door: number, open: boolean): void {
    if (door < 0 || door >= this.d.count) return;
    this.doorOpen[door] = open ? 1 : 0;
  }

  /** BFS from area `from` over the open doors; read the result with `reached`. */
  computeReach(from: number): void {
    const reach = this.reach;
    reach.fill(0);
    if (from <= 0 || from > MAX_AREAS) return;
    const d = this.d;
    let head = 0;
    let tail = 0;
    reach[from] = 1;
    this.queue[tail++] = from;
    while (head < tail) {
      const a = this.queue[head++];
      for (let i = 0; i < d.count; i++) {
        if (this.doorOpen[i] === 0) continue;
        const la = this.linkA[i];
        const lb = this.linkB[i];
        const other = la === a ? lb : lb === a ? la : 0;
        if (other !== 0 && reach[other] === 0) {
          reach[other] = 1;
          this.queue[tail++] = other;
        }
      }
    }
  }

  /** True when the last `computeReach` reached `area` (area 0 is never reached). */
  reached(area: number): boolean {
    return area > 0 && area <= MAX_AREAS && this.reach[area] === 1;
  }
}
