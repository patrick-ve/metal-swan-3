/**
 * Sliding doors (docs/design/fps.md §4.6): 54 ticks to open or close, 258 ticks open, then they
 * close; a door that is blocked (the player or a living actor in its cell) opens again while
 * closing and waits while open. Use on an open door closes it; locked doors need their key.
 * Progress is an integer tick count, so the state is exact and deterministic. No allocations.
 */
import type { AreaMap, DoorTable } from '../../engine/ray';
import { LOCK_GOLD, LOCK_SILVER } from './map';

export const DOOR_MOVE_TICKS = 54;
export const DOOR_OPEN_TICKS = 258;

export const DOOR_CLOSED = 0;
export const DOOR_OPENING = 1;
export const DOOR_OPEN = 2;
export const DOOR_CLOSING = 3;

/** Key bits (`FpsPlayer.keys`). */
export const KEY_GOLD = 1;
export const KEY_SILVER = 2;

export type DoorUse = 'opened' | 'closed' | 'reopened' | 'locked-gold' | 'locked-silver' | 'busy' | 'blocked';

/** Sound hook: 'fps/door-open' | 'fps/door-close' | 'fps/door-locked' for door `index`. */
export type DoorSfx = (id: string, index: number) => void;

export class DoorSystem {
  readonly doors: DoorTable;
  readonly lock: Uint8Array;
  /** DOOR_CLOSED / OPENING / OPEN / CLOSING per door. */
  readonly state: Uint8Array;
  /** Move progress 0..DOOR_MOVE_TICKS (open = prog / DOOR_MOVE_TICKS). */
  readonly prog: Int16Array;
  /** Ticks left before an open door closes. */
  readonly timer: Int32Array;
  areas: AreaMap | null;
  sfx: DoorSfx | null = null;

  constructor(doors: DoorTable, lock: Uint8Array, areas: AreaMap | null = null) {
    this.doors = doors;
    this.lock = lock;
    this.areas = areas;
    this.state = new Uint8Array(doors.max);
    this.prog = new Int16Array(doors.max);
    this.timer = new Int32Array(doors.max);
    for (let i = 0; i < doors.count; i++) doors.open[i] = 0;
  }

  get count(): number {
    return this.doors.count;
  }

  /** Start opening; a closed door now links its two areas (sound passes). */
  private startOpening(i: number): void {
    if (this.state[i] === DOOR_CLOSED) this.areas?.setDoorOpen(i, true);
    this.state[i] = DOOR_OPENING;
    this.sfx?.('fps/door-open', i);
  }

  /**
   * The player uses door `i` with `keys` (KEY_* bits). `blocked` = something stands in the door
   * cell (an open door then cannot close).
   */
  use(i: number, keys: number, blocked = false): DoorUse {
    if (i < 0 || i >= this.doors.count) return 'busy';
    switch (this.state[i]) {
      case DOOR_CLOSED: {
        const l = this.lock[i];
        if (l === LOCK_GOLD && (keys & KEY_GOLD) === 0) {
          this.sfx?.('fps/door-locked', i);
          return 'locked-gold';
        }
        if (l === LOCK_SILVER && (keys & KEY_SILVER) === 0) {
          this.sfx?.('fps/door-locked', i);
          return 'locked-silver';
        }
        this.startOpening(i);
        return 'opened';
      }
      case DOOR_OPEN:
        if (blocked) return 'blocked';
        this.state[i] = DOOR_CLOSING;
        this.sfx?.('fps/door-close', i);
        return 'closed';
      case DOOR_CLOSING:
        this.startOpening(i);
        return 'reopened';
      default:
        return 'busy';
    }
  }

  /** Open door `i` without a key check (actors, debug). */
  open(i: number): void {
    if (i < 0 || i >= this.doors.count) return;
    const s = this.state[i];
    if (s === DOOR_CLOSED || s === DOOR_CLOSING) this.startOpening(i);
    else if (s === DOOR_OPEN) this.timer[i] = DOOR_OPEN_TICKS;
  }

  /** One tick. `blocked(i)` = the cell of door i holds the player or a living actor. */
  step(blocked: (i: number) => boolean): void {
    const d = this.doors;
    for (let i = 0; i < d.count; i++) {
      switch (this.state[i]) {
        case DOOR_OPENING:
          if (++this.prog[i] >= DOOR_MOVE_TICKS) {
            this.prog[i] = DOOR_MOVE_TICKS;
            this.state[i] = DOOR_OPEN;
            this.timer[i] = DOOR_OPEN_TICKS;
          }
          break;
        case DOOR_OPEN:
          if (this.timer[i] > 0) this.timer[i]--;
          if (this.timer[i] <= 0 && !blocked(i)) {
            this.state[i] = DOOR_CLOSING;
            this.sfx?.('fps/door-close', i);
          }
          break;
        case DOOR_CLOSING:
          if (blocked(i)) {
            this.startOpening(i);
            break;
          }
          if (--this.prog[i] <= 0) {
            this.prog[i] = 0;
            this.state[i] = DOOR_CLOSED;
            this.areas?.setDoorOpen(i, false);
          }
          break;
      }
      d.open[i] = this.prog[i] / DOOR_MOVE_TICKS;
    }
  }
}
