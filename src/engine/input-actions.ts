/**
 * First-person input actions (docs/design/fps.md §2). Pure TS, no DOM.
 *
 * The 8-bit `Button` pad (input.ts) stays as it is for menus, the side-scroller, the bot and key
 * rebinding. The first-person mode reads a second, wider channel that `InputManager` fills for
 * slot 0 while `input.fpsMode` is on:
 *
 * - `input.actions` — an `ActionPad`: a 16-bit held mask with edges and held-tick counts.
 * - `input.analog` — an `AnalogState` `{ turn, moveX, moveY }` of integers, cleared every tick.
 *
 * Sources that know the mode implement `readActions` / `readAnalog` (keyboard via the fixed
 * `FpsKeyMap`, gamepads, the pointer-lock mouse, `ScriptedSource` with actions); any other source
 * is mapped from its 8-button mask through `actionsFromPad`.
 */

export type FpsAction =
  | 'forward'
  | 'back'
  | 'turnLeft'
  | 'turnRight'
  | 'strafeLeft'
  | 'strafeRight'
  | 'strafe'
  | 'run'
  | 'fire'
  | 'use'
  | 'weapon1'
  | 'weapon2'
  | 'weapon3'
  | 'weapon4'
  | 'weaponNext'
  | 'weaponPrev';

/** Every action in bit order (bit i = 1 << i). */
export const FPS_ACTIONS: readonly FpsAction[] = [
  'forward',
  'back',
  'turnLeft',
  'turnRight',
  'strafeLeft',
  'strafeRight',
  'strafe',
  'run',
  'fire',
  'use',
  'weapon1',
  'weapon2',
  'weapon3',
  'weapon4',
  'weaponNext',
  'weaponPrev',
];

/** Bit index 0..15 of each action. */
export const ACTION_INDEX: Readonly<Record<FpsAction, number>> = Object.freeze(
  Object.fromEntries(FPS_ACTIONS.map((a, i) => [a, i])) as Record<FpsAction, number>,
);

/** Mask bit of each action (`ACTION_BIT.fire === 1 << 8`). */
export const ACTION_BIT: Readonly<Record<FpsAction, number>> = Object.freeze(
  Object.fromEntries(FPS_ACTIONS.map((a, i) => [a, 1 << i])) as Record<FpsAction, number>,
);

/** All 16 actions. */
export const ALL_ACTIONS = 0xffff;

/** Mask of the given actions, e.g. `actionMask('forward', 'fire')`. */
export function actionMask(...actions: FpsAction[]): number {
  let m = 0;
  for (const a of actions) m |= ACTION_BIT[a] ?? 0;
  return m;
}

/** An action by name, or by its bit index 0..15. */
export type ActionRef = FpsAction | number;

function indexOf(a: ActionRef): number {
  return typeof a === 'number' ? a & 15 : ACTION_INDEX[a];
}

// ---------------------------------------------------------------------------------------------
// ActionPad
// ---------------------------------------------------------------------------------------------

/** The 16 actions of one player with edge detection. Updated exactly once per tick. */
export class ActionPad {
  private cur = 0;
  private prev = 0;
  /** Actions hidden until they are released (see `suppress`). */
  private suppressed = 0;
  private readonly ticks = new Uint32Array(16);

  /** Feed this tick's raw held mask. */
  update(mask: number): void {
    const raw = mask & ALL_ACTIONS;
    this.suppressed &= raw; // a released (or never held) action is no longer suppressed
    const m = raw & ~this.suppressed;
    this.prev = this.cur;
    this.cur = m;
    for (let i = 0; i < 16; i++) {
      if (m & (1 << i)) this.ticks[i]++;
      else this.ticks[i] = 0;
    }
  }

  held(a: ActionRef): boolean {
    return (this.cur & (1 << indexOf(a))) !== 0;
  }

  /** Went down this tick. */
  pressed(a: ActionRef): boolean {
    const bit = 1 << indexOf(a);
    return (this.cur & bit) !== 0 && (this.prev & bit) === 0;
  }

  /** Went up this tick. */
  released(a: ActionRef): boolean {
    const bit = 1 << indexOf(a);
    return (this.cur & bit) === 0 && (this.prev & bit) !== 0;
  }

  /** Ticks the action has been held: 1 on the tick it was pressed, 0 when up. */
  heldTicks(a: ActionRef): number {
    return this.ticks[indexOf(a)];
  }

  /** Held mask of this tick. */
  get mask(): number {
    return this.cur;
  }

  /** Mask of the actions that went down this tick. */
  get pressedMask(): number {
    return this.cur & ~this.prev;
  }

  /** Mask of the actions that went up this tick. */
  get releasedMask(): number {
    return this.prev & ~this.cur;
  }

  anyPressed(): boolean {
    return (this.cur & ~this.prev) !== 0;
  }

  /**
   * Hide the actions in `mask` that are held (now or on the next update) until they are
   * released, like `VirtualPad.suppress`. Actions in `mask` that are not held on the next
   * update are simply not suppressed. So it also works when the pad was not polled before
   * (`fpsMode` was off): a fire key held through a scene change never fires.
   */
  suppress(mask = ALL_ACTIONS): void {
    const m = mask & ALL_ACTIONS;
    this.suppressed |= m;
    this.cur &= ~m;
    this.prev &= ~m;
    for (let i = 0; i < 16; i++) if (m & (1 << i)) this.ticks[i] = 0;
  }

  /** Forget everything (all actions up, no suppression). */
  reset(): void {
    this.cur = 0;
    this.prev = 0;
    this.suppressed = 0;
    this.ticks.fill(0);
  }
}

// ---------------------------------------------------------------------------------------------
// Analog channel
// ---------------------------------------------------------------------------------------------

/**
 * Analog input of one tick (slot 0, `fpsMode` only). All integers; cleared every tick.
 * `turn`: angle units this tick (mouse + right stick; + = clockwise = to the right, the angle
 * grows: 0 east, 1024 south), clamped to ±`TURN_MAX`. `moveX`: strafe, + = right. `moveY`:
 * + = forward. Both −`MOVE_MAX`..`MOVE_MAX`.
 */
export interface AnalogState {
  turn: number;
  moveX: number;
  moveY: number;
}

/**
 * Half a turn per tick: a sanity cap only. A fast mouse flick (sensitivity 10, ~340 px in one
 * tick) still turns in full; the old ±512 lost the turn of quick flicks (polish-fix 2026-10-16).
 */
export const TURN_MAX = 2048;
export const MOVE_MAX = 127;
/** Dead zone of both sticks (0..1); the rest of the range is rescaled to 0..1. */
export const STICK_DEAD_ZONE = 0.2;
/** Right stick fully over: angle units per tick (`round(48 × s² × sign)`). */
export const STICK_TURN_MAX = 48;

export function newAnalog(): AnalogState {
  return { turn: 0, moveX: 0, moveY: 0 };
}

export function clearAnalog(a: AnalogState): void {
  a.turn = 0;
  a.moveX = 0;
  a.moveY = 0;
}

function clampInt(v: number, lim: number): number {
  const n = Math.round(v);
  return n > lim ? lim : n < -lim ? -lim : n;
}

/** Round and clamp every field to its range (InputManager does this after all sources). */
export function clampAnalog(a: AnalogState): void {
  a.turn = clampInt(a.turn, TURN_MAX);
  a.moveX = clampInt(a.moveX, MOVE_MAX);
  a.moveY = clampInt(a.moveY, MOVE_MAX);
}

/** One stick axis value −1..1 after the dead zone, rescaled so the edge of the zone is 0. */
export function deadZoneAxis(v: number, dead = STICK_DEAD_ZONE): number {
  const a = Math.abs(v);
  if (!(a > dead)) return 0; // also NaN
  const s = Math.min(1, (a - dead) / (1 - dead));
  return v < 0 ? -s : s;
}

/**
 * Left stick (raw axes, y down) → `out.moveX` / `out.moveY` (radial dead zone, rescaled, × 127,
 * integers; stick up = + forward). Overwrites the two fields.
 */
export function stickMove(ax: number, ay: number, out: AnalogState, dead = STICK_DEAD_ZONE): void {
  const mag = Math.hypot(ax, ay);
  if (!(mag > dead)) {
    out.moveX = 0;
    out.moveY = 0;
    return;
  }
  const s = Math.min(1, (mag - dead) / (1 - dead)) / mag;
  out.moveX = clampInt(ax * s * MOVE_MAX, MOVE_MAX) || 0;
  out.moveY = clampInt(-ay * s * MOVE_MAX, MOVE_MAX) || 0;
}

/** Right stick X (raw −1..1) → angle units this tick: `round(48 × s² × sign)` after the dead zone. */
export function stickTurn(x: number, dead = STICK_DEAD_ZONE): number {
  const s = deadZoneAxis(x, dead);
  return Math.round(STICK_TURN_MAX * s * s) * Math.sign(s) || 0;
}

/** Stick speed scale `m = min(1, hypot(moveX, moveY) / 127)` (spec §2.2). */
export function stickScale(moveX: number, moveY: number): number {
  return Math.min(1, Math.hypot(moveX, moveY) / MOVE_MAX);
}

/**
 * Move speed from the stick: walk × m, or run × m when `run` is held or m > 0.9 (spec §2.2).
 * 0 when the stick is centred.
 */
export function stickSpeed(moveX: number, moveY: number, runHeld: boolean, walk: number, run: number): number {
  const m = stickScale(moveX, moveY);
  if (m === 0) return 0;
  return (runHeld || m > 0.9 ? run : walk) * m;
}

// ---------------------------------------------------------------------------------------------
// Mouse turn
// ---------------------------------------------------------------------------------------------

export const SENSITIVITY_MIN = 1;
export const SENSITIVITY_MAX = 10;
export const SENSITIVITY_DEFAULT = 5;

/** Angle units per mouse pixel at a sensitivity 1..10 (0.6 × s; 5 → 3 units/px). */
export function turnPerPixel(sensitivity: number): number {
  return 0.6 * sensitivity;
}

/**
 * Mouse pixels → whole angle units per tick; the fractional rest carries to the next tick, so
 * slow mouse moves still turn. Kept in tenths of a unit (exact for whole pixels).
 */
export class TurnAccumulator {
  /** 1..10 (settings.mouseSensitivity). */
  sensitivity = SENSITIVITY_DEFAULT;
  /** Carried rest in tenths of an angle unit (|rest| < 10). */
  private rest = 0;
  private px = 0;

  /** Add mouse movement (movementX, px; + = right). */
  add(px: number): void {
    if (Number.isFinite(px)) this.px += px;
  }

  /** Whole angle units for this tick (+ = right); keeps the fraction for later. */
  take(): number {
    const s = Math.max(SENSITIVITY_MIN, Math.min(SENSITIVITY_MAX, this.sensitivity));
    this.rest += this.px * 6 * s;
    this.px = 0;
    const t = Math.trunc(this.rest / 10);
    this.rest -= t * 10;
    return t || 0;
  }

  /** The carried rest in angle units (tests). */
  get remainder(): number {
    return this.rest / 10;
  }

  reset(): void {
    this.rest = 0;
    this.px = 0;
  }
}

// ---------------------------------------------------------------------------------------------
// Keyboard and gamepad maps (fixed in this wave)
// ---------------------------------------------------------------------------------------------

/** KeyboardEvent.code values per action. */
export type FpsKeyMap = Record<FpsAction, string[]>;

/**
 * The default first-person keys (spec §2.1). Never Ctrl or Alt (Ctrl+W closes the tab, Alt +
 * arrows navigate). Enter is not an action; pause stays on the normal pause keys.
 */
export function defaultFpsKeyMap(): FpsKeyMap {
  return {
    forward: ['KeyW', 'ArrowUp'],
    back: ['KeyS', 'ArrowDown'],
    turnLeft: ['ArrowLeft'],
    turnRight: ['ArrowRight'],
    strafeLeft: ['KeyA', 'Comma'],
    strafeRight: ['KeyD', 'Period'],
    strafe: ['KeyC'],
    run: ['ShiftLeft', 'ShiftRight'],
    fire: ['Space'],
    use: ['KeyE', 'KeyF'],
    weapon1: ['Digit1'],
    weapon2: ['Digit2'],
    weapon3: ['Digit3'],
    weapon4: ['Digit4'],
    weaponNext: ['KeyQ'],
    weaponPrev: [],
  };
}

/** Every key code of the default map (KeyboardSource prevents their browser default in fpsMode). */
export const FPS_KEY_CODES: ReadonlySet<string> = new Set(Object.values(defaultFpsKeyMap()).flat());

/** Gamepad buttons (standard mapping) per action. The sticks go to the analog channel. */
export type FpsPadMap = Record<FpsAction, number[]>;

export function defaultFpsPadMap(): FpsPadMap {
  return {
    forward: [12],
    back: [13],
    turnLeft: [14],
    turnRight: [15],
    strafeLeft: [],
    strafeRight: [],
    strafe: [],
    run: [10],
    fire: [7, 2],
    use: [0],
    weapon1: [],
    weapon2: [],
    weapon3: [],
    weapon4: [],
    weaponNext: [5, 3],
    weaponPrev: [4],
  };
}

/** Action mask for a key map, given a predicate that says whether a key code is down. */
export function actionsFromKeys(map: FpsKeyMap, isDown: (code: string) => boolean): number {
  let m = 0;
  for (let i = 0; i < FPS_ACTIONS.length; i++) {
    const codes = map[FPS_ACTIONS[i]];
    for (let j = 0; j < codes.length; j++) {
      if (isDown(codes[j])) {
        m |= 1 << i;
        break;
      }
    }
  }
  return m;
}

/** Action mask for a pad map, given a predicate that says whether a pad button index is down. */
export function actionsFromPadButtons(map: FpsPadMap, isDown: (index: number) => boolean): number {
  let m = 0;
  for (let i = 0; i < FPS_ACTIONS.length; i++) {
    const idx = map[FPS_ACTIONS[i]];
    for (let j = 0; j < idx.length; j++) {
      if (isDown(idx[j])) {
        m |= 1 << i;
        break;
      }
    }
  }
  return m;
}

/**
 * Fallback for a source without `readActions` (scripted timelines, the 2D bot, the touch pad,
 * rebound keys): its 8-button mask → actions. up → forward, down → back, left → turnLeft,
 * right → turnRight, fire → fire, jump → use, bomb → weaponNext, start → nothing.
 * (Button bits: left 1, right 2, up 4, down 8, fire 16, jump 32, bomb 64, start 128.)
 */
export function actionsFromPad(mask: number): number {
  let m = 0;
  if (mask & 4) m |= 1 << 0; // up → forward
  if (mask & 8) m |= 1 << 1; // down → back
  if (mask & 1) m |= 1 << 2; // left → turnLeft
  if (mask & 2) m |= 1 << 3; // right → turnRight
  if (mask & 16) m |= 1 << 8; // fire → fire
  if (mask & 32) m |= 1 << 9; // jump → use
  if (mask & 64) m |= 1 << 14; // bomb → weaponNext
  return m;
}
