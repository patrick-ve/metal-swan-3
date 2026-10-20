/**
 * Input model (docs/ARCHITECTURE.md §5.2). Pure TS — the DOM sources live in input.browser.ts.
 *
 * Flow per simulation tick: `InputManager.update()` asks every `InputSource` which buttons are
 * held for each player slot (a bitmask), ORs them, and feeds the result to that slot's
 * `VirtualPad`, which does the edge detection (pressed / released / heldTicks).
 * Sources only ever report a raw "held" mask.
 *
 * First-person mode (docs/design/fps.md §2): while `fpsMode` is on, slot 0 also gets a 16-bit
 * action pad (`actions`) and an analog channel (`analog`), see input-actions.ts.
 *
 * Gamepads (pads.ts, docs/api/input.md): `useGamepads` registers the one `PadSource`; the slot
 * claims, the free pads, the lost-pad check, the per-pad labels and rumble go through it (the
 * helpers below answer "no pad" when there is none, as in the headless sims).
 */
import type { PadInfo, PadSource } from './pads';
import {
  ActionPad,
  actionsFromPad,
  type AnalogState,
  clampAnalog,
  clearAnalog,
  newAnalog,
} from './input-actions';

export type Button = 'left' | 'right' | 'up' | 'down' | 'fire' | 'jump' | 'bomb' | 'start';

export const BUTTONS: readonly Button[] = [
  'left',
  'right',
  'up',
  'down',
  'fire',
  'jump',
  'bomb',
  'start',
];

/** Bit of each button in a held mask. */
export const BUTTON_BIT: Readonly<Record<Button, number>> = {
  left: 1,
  right: 2,
  up: 4,
  down: 8,
  fire: 16,
  jump: 32,
  bomb: 64,
  start: 128,
};

/** fire + jump + bomb + start: what `suppress(ACTION_BUTTONS)` hides (directions stay held). */
export const ACTION_BUTTONS = 16 | 32 | 64 | 128;

/** Index 0..7 of each button (bit = 1 << index). */
const BUTTON_INDEX: Readonly<Record<Button, number>> = {
  left: 0,
  right: 1,
  up: 2,
  down: 3,
  fire: 4,
  jump: 5,
  bomb: 6,
  start: 7,
};

export type PlayerSlot = 0 | 1;

/** Anything that can describe held buttons: a mask, one button, or a list of buttons. */
export type HeldSpec = number | Button | readonly Button[] | null | undefined;

export function toMask(spec: HeldSpec): number {
  if (spec === null || spec === undefined) return 0;
  if (typeof spec === 'number') return spec & 0xff;
  if (typeof spec === 'string') return BUTTON_BIT[spec] ?? 0;
  let m = 0;
  for (const b of spec) m |= BUTTON_BIT[b] ?? 0;
  return m;
}

/** Mask of the given buttons, e.g. `buttonMask('right', 'fire')`. */
export function buttonMask(...buttons: Button[]): number {
  return toMask(buttons);
}

// ---------------------------------------------------------------------------------------------
// VirtualPad
// ---------------------------------------------------------------------------------------------

/** One player's buttons with edge detection. Updated exactly once per tick. */
export class VirtualPad {
  private cur = 0;
  private prev = 0;
  /** Buttons hidden until they are released (see `suppress`). */
  private suppressed = 0;
  private readonly ticks = new Uint32Array(8);

  /** Feed this tick's raw held mask. */
  update(mask: number): void {
    this.suppressed &= mask; // a released button is no longer suppressed
    const m = mask & ~this.suppressed & 0xff;
    this.prev = this.cur;
    this.cur = m;
    for (let i = 0; i < 8; i++) {
      if (m & (1 << i)) this.ticks[i]++;
      else this.ticks[i] = 0;
    }
  }

  held(b: Button): boolean {
    return (this.cur & BUTTON_BIT[b]) !== 0;
  }

  /** Went down this tick. */
  pressed(b: Button): boolean {
    const bit = BUTTON_BIT[b];
    return (this.cur & bit) !== 0 && (this.prev & bit) === 0;
  }

  /** Went up this tick. */
  released(b: Button): boolean {
    const bit = BUTTON_BIT[b];
    return (this.cur & bit) === 0 && (this.prev & bit) !== 0;
  }

  /** Ticks the button has been held, 1 on the tick it was pressed, 0 when up. */
  heldTicks(b: Button): number {
    return this.ticks[BUTTON_INDEX[b]];
  }

  /** -1 (left), 0, or 1 (right). Both or neither → 0. */
  axisX(): -1 | 0 | 1 {
    const l = this.held('left');
    const r = this.held('right');
    return l === r ? 0 : l ? -1 : 1;
  }

  /** -1 (up), 0, or 1 (down). Both or neither → 0. */
  axisY(): -1 | 0 | 1 {
    const u = this.held('up');
    const d = this.held('down');
    return u === d ? 0 : u ? -1 : 1;
  }

  /** Held mask of this tick. */
  get mask(): number {
    return this.cur;
  }

  /** Mask of buttons that went down this tick. */
  get pressedMask(): number {
    return this.cur & ~this.prev;
  }

  anyPressed(): boolean {
    return (this.cur & ~this.prev) !== 0;
  }

  /**
   * Hide the buttons held right now until they are released. Call on scene changes so that a
   * held "fire" used to confirm a menu does not start shooting in the next scene. `mask` limits
   * it to some buttons (e.g. `ACTION_BUTTONS`, so a direction held through a pause keeps working).
   */
  suppress(mask = 0xff): void {
    const m = this.cur & mask;
    this.suppressed |= m;
    this.cur &= ~m;
    this.prev &= ~m;
    for (let i = 0; i < 8; i++) if (mask & (1 << i)) this.ticks[i] = 0;
  }

  /** Forget everything (all buttons up, no suppression). */
  reset(): void {
    this.cur = 0;
    this.prev = 0;
    this.suppressed = 0;
    this.ticks.fill(0);
  }
}

// ---------------------------------------------------------------------------------------------
// Bindings
// ---------------------------------------------------------------------------------------------

/** KeyboardEvent.code values per button. */
export type KeyMap = Record<Button, string[]>;
/** Gamepad button indices (standard mapping) per button. */
export type PadMap = Record<Button, number[]>;
export type KeySetName = 'solo' | 'p1' | 'p2';

/** Serialisable control bindings. */
export interface Bindings {
  version: 1;
  /** 1-player mode: these keys drive player 1. Defaults merge both layouts (arrows + Z/X/C and WASD + J/K/L). */
  solo: KeyMap;
  /** 2-player mode, player 1. */
  p1: KeyMap;
  /** 2-player mode, player 2. */
  p2: KeyMap;
  /** Pause keys (every mode). */
  pause: string[];
  /** Gamepad buttons (standard indices) of player 1's pad, and of every pad in 1-player mode (P1 PAD). */
  pad: PadMap;
  /** Gamepad buttons of player 2's pad in 2-player mode (P2 PAD; added 2026-10-20, older saves copy `pad`). */
  pad2: PadMap;
  /** Gamepad pause buttons. */
  padPause: number[];
}

export function defaultBindings(): Bindings {
  return {
    version: 1,
    solo: {
      left: ['ArrowLeft', 'KeyA'],
      right: ['ArrowRight', 'KeyD'],
      up: ['ArrowUp', 'KeyW'],
      down: ['ArrowDown', 'KeyS'],
      fire: ['KeyZ', 'KeyJ'],
      jump: ['KeyX', 'KeyK'],
      bomb: ['KeyC', 'KeyL'],
      start: ['Enter', 'NumpadEnter'],
    },
    p1: {
      left: ['KeyA'],
      right: ['KeyD'],
      up: ['KeyW'],
      down: ['KeyS'],
      fire: ['KeyF'],
      jump: ['KeyG'],
      bomb: ['KeyH'],
      start: ['Digit1'],
    },
    p2: {
      left: ['ArrowLeft'],
      right: ['ArrowRight'],
      up: ['ArrowUp'],
      down: ['ArrowDown'],
      fire: ['Comma', 'Numpad1'],
      jump: ['Period', 'Numpad2'],
      bomb: ['Slash', 'Numpad3'],
      start: ['Enter', 'NumpadEnter'],
    },
    pause: ['Escape', 'KeyP'],
    // Standard mapping: 0 A/Cross, 1 B/Circle, 2 X/Square, 3 Y/Triangle, 8 Back, 9 Start, 12-15 d-pad.
    pad: defaultPadMap(),
    pad2: defaultPadMap(),
    padPause: [8],
  };
}

/**
 * The positional default of every pad (standard indices): south jump, west fire, east bomb,
 * START start, the D-pad moves (the left stick too).
 */
export function defaultPadMap(): PadMap {
  return { left: [14], right: [15], up: [12], down: [13], fire: [2], jump: [0], bomb: [1], start: [9] };
}

function cleanStrings(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback.slice();
  const out = v.filter((s): s is string => typeof s === 'string' && s.length > 0 && s.length < 64);
  return out.slice(0, 8);
}

function cleanNumbers(v: unknown, fallback: number[]): number[] {
  if (!Array.isArray(v)) return fallback.slice();
  const out = v.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 64);
  return out.slice(0, 8);
}

function cleanKeyMap(v: unknown, fallback: KeyMap): KeyMap {
  const src = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const out = {} as KeyMap;
  for (const b of BUTTONS) out[b] = cleanStrings(src[b], fallback[b]);
  return out;
}

function cleanPadMap(v: unknown, fallback: PadMap): PadMap {
  const src = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  const out = {} as PadMap;
  for (const b of BUTTONS) out[b] = cleanNumbers(src[b], fallback[b]);
  return out;
}

export function serializeBindings(b: Bindings): string {
  return JSON.stringify(b);
}

/** Parse stored bindings. Missing or invalid parts fall back to the defaults; never throws. */
export function parseBindings(json: string | null | undefined): Bindings {
  const def = defaultBindings();
  if (!json) return def;
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return def;
  }
  if (!raw || typeof raw !== 'object') return def;
  const r = raw as Record<string, unknown>;
  const pad = cleanPadMap(r.pad, def.pad);
  return {
    version: 1,
    solo: cleanKeyMap(r.solo, def.solo),
    p1: cleanKeyMap(r.p1, def.p1),
    p2: cleanKeyMap(r.p2, def.p2),
    pause: cleanStrings(r.pause, def.pause),
    pad,
    // Saves from before the per-player pad maps: player 2's pad starts as the shared one.
    pad2: cleanPadMap(r.pad2, pad),
    padPause: cleanNumbers(r.padPause, def.padPause),
  };
}

/** Held mask for a key map, given a predicate that says whether a key code is down. */
export function maskFromKeys(map: KeyMap, isDown: (code: string) => boolean): number {
  let m = 0;
  for (const b of BUTTONS) {
    const codes = map[b];
    for (let i = 0; i < codes.length; i++) {
      if (isDown(codes[i])) {
        m |= BUTTON_BIT[b];
        break;
      }
    }
  }
  return m;
}

/** Held mask for a pad map, given a predicate that says whether a pad button index is down. */
export function maskFromPad(map: PadMap, isDown: (index: number) => boolean): number {
  let m = 0;
  for (const b of BUTTONS) {
    const idx = map[b];
    for (let i = 0; i < idx.length; i++) {
      if (isDown(idx[i])) {
        m |= BUTTON_BIT[b];
        break;
      }
    }
  }
  return m;
}

/**
 * Which key set drives a slot (null = no keyboard for that slot). `split` (default: 2 players)
 * splits the keyboard into the 2-player sets; a player 2 who joined with a pad leaves it whole:
 * the solo set drives player 1.
 */
export function keySetFor(slot: PlayerSlot, players: 1 | 2, split: boolean = players === 2): KeySetName | null {
  if (players === 1 || !split) return slot === 0 ? 'solo' : null;
  return slot === 0 ? 'p1' : 'p2';
}

/** Raw code reported by gamepads for button `index` (used by menus and rebinding). */
export function padButtonCode(index: number): string {
  return `GamepadB${index}`;
}

// ---------------------------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------------------------

/** What a source needs to translate devices into buttons. `InputManager` implements it. */
export interface InputContext {
  readonly players: 1 | 2;
  readonly bindings: Bindings;
  /** First-person mode is on (sources then also report actions and analog for slot 0). */
  readonly fpsMode?: boolean;
  /** 2 players on the 2-player key sets (default: `players === 2`; see `keySetFor`). */
  readonly keySplit?: boolean;
  /**
   * A 1-player game watches for player 2 (GameplayScene): the START of a pad that is not player
   * 1's does not reach slot 0 (it asks to join).
   */
  readonly joinWatch?: boolean;
  /**
   * A menu is open over a 2-player game (PauseScene): pads that no player holds also drive slot 0,
   * so any pad navigates the menu (play is frozen under it).
   */
  readonly menuPads?: boolean;
}

export interface InputSource {
  /** Called once per tick before any `read` (poll devices here). */
  update?(ctx: InputContext): void;
  /** Held mask for a player slot this tick. */
  read(slot: PlayerSlot, ctx: InputContext): number;
  /** Append raw codes pressed since the last tick (KeyboardEvent.code or `GamepadB<n>`). */
  drainPressed?(out: string[]): void;
  /** Called once per tick after all reads (clear short-tap latches here). */
  endTick?(): void;
  /**
   * First-person action mask (input-actions.ts) for a slot; only asked for slot 0 while
   * `fpsMode` is on. A source without it is mapped through `actionsFromPad(read(slot))`.
   */
  readActions?(slot: PlayerSlot, ctx: InputContext): number;
  /** Add this tick's analog input for a slot to `out` (slot 0, `fpsMode` only). */
  readAnalog?(slot: PlayerSlot, out: AnalogState, ctx: InputContext): void;
}

/** Optional first-person channel of a `ScriptedSource` (functions of the source's tick). */
export interface ScriptedActions {
  /** Held action mask (input-actions.ts `ACTION_BIT`) at a tick. */
  actions?: (tick: number) => number;
  /** Write the analog input of a tick into `out` (starts cleared each tick). */
  analog?: (tick: number, out: AnalogState) => void;
}

export type ScriptedFn = (tick: number) => HeldSpec;

/**
 * Headless source for tests, the bot and attract mode: a function of the source's own tick
 * counter (0 on the first update after it was added) → held buttons for one slot.
 */
export class ScriptedSource implements InputSource {
  /** Ticks since this source started; advanced once per InputManager update. */
  tick = 0;
  readonly slot: PlayerSlot;
  private readonly fn: ScriptedFn;
  private mask = 0;
  private actMask = 0;
  private readonly fps: ScriptedActions | null;
  private readonly scratch: AnalogState = newAnalog();
  /** Present only when the script gives `actions` (else the 8-button fallback applies). */
  readonly readActions?: (slot: PlayerSlot) => number;
  /** Present only when the script gives `analog`. */
  readonly readAnalog?: (slot: PlayerSlot, out: AnalogState) => void;

  constructor(fn: ScriptedFn | InputTimeline, slot: PlayerSlot = 0, fps?: ScriptedActions) {
    this.fn = fn instanceof InputTimeline ? fn.fn() : fn;
    this.slot = slot;
    this.fps = fps ?? null;
    if (fps?.actions) this.readActions = (s) => (s === this.slot ? this.actMask : 0);
    if (fps?.analog) {
      this.readAnalog = (s, out) => {
        if (s !== this.slot) return;
        const a = this.scratch;
        clearAnalog(a);
        this.fps!.analog!(this.tick, a);
        out.turn += a.turn;
        out.moveX += a.moveX;
        out.moveY += a.moveY;
      };
    }
  }

  update(): void {
    this.mask = toMask(this.fn(this.tick));
    const act = this.fps?.actions;
    if (act) this.actMask = act(this.tick) & 0xffff;
  }

  read(slot: PlayerSlot): number {
    return slot === this.slot ? this.mask : 0;
  }

  endTick(): void {
    this.tick++;
  }
}

interface TimelineStep {
  start: number;
  end: number;
  mask: number;
}

/**
 * Builder for scripted input. Steps are placed one after another from a cursor; `at(t)` moves
 * the cursor so steps can overlap (overlapping steps are ORed).
 *
 * ```ts
 * const tl = timeline().hold('right', 60).hold(['right', 'jump'], 10).idle(20).tap('fire', 3);
 * input.addSource(new ScriptedSource(tl));
 * ```
 */
export class InputTimeline {
  private readonly steps: TimelineStep[] = [];
  private cursor = 0;
  /** Furthest tick the cursor has reached (trailing idle time counts). */
  private end = 0;
  private loopLen = 0;

  /** Hold buttons for `ticks` ticks. */
  hold(buttons: HeldSpec, ticks: number): this {
    const n = Math.max(0, Math.floor(ticks));
    if (n > 0) this.steps.push({ start: this.cursor, end: this.cursor + n, mask: toMask(buttons) });
    this.cursor += n;
    if (this.cursor > this.end) this.end = this.cursor;
    return this;
  }

  /** Hold nothing for `ticks` ticks. */
  idle(ticks: number): this {
    this.cursor += Math.max(0, Math.floor(ticks));
    if (this.cursor > this.end) this.end = this.cursor;
    return this;
  }

  /** Press and release `times` times: down for `down` ticks, then up for `up` ticks each time. */
  tap(buttons: HeldSpec, times = 1, down = 1, up = 1): this {
    for (let i = 0; i < times; i++) this.hold(buttons, down).idle(up);
    return this;
  }

  /** Move the cursor to an absolute tick (to layer steps on top of earlier ones). */
  at(tick: number): this {
    this.cursor = Math.max(0, Math.floor(tick));
    return this;
  }

  /** Repeat the whole timeline forever after its last step. */
  loop(): this {
    this.loopLen = this.length;
    return this;
  }

  /** Length in ticks: up to the end of the last step or idle. */
  get length(): number {
    return this.end;
  }

  maskAt(tick: number): number {
    const t = this.loopLen > 0 ? tick % this.loopLen : tick;
    let m = 0;
    for (const s of this.steps) if (t >= s.start && t < s.end) m |= s.mask;
    return m;
  }

  fn(): ScriptedFn {
    return (tick) => this.maskAt(tick);
  }
}

export function timeline(): InputTimeline {
  return new InputTimeline();
}

// ---------------------------------------------------------------------------------------------
// InputManager
// ---------------------------------------------------------------------------------------------

/** Maps sources to the two player pads; call `update()` once per simulation tick. */
export class InputManager implements InputContext {
  readonly pads: readonly [VirtualPad, VirtualPad] = [new VirtualPad(), new VirtualPad()];
  /** First-person actions of slot 0 (all up while `fpsMode` is off). */
  readonly actions = new ActionPad();
  /** First-person analog input of slot 0 this tick (cleared every tick; zero while `fpsMode` is off). */
  readonly analog: AnalogState = newAnalog();
  /** First-person mode: poll `actions` and `analog` for slot 0 (the fps scene turns it on). */
  fpsMode = false;
  /**
   * The keyboard is split into the 2-player key sets (`keySetFor`). Setting `players` sets it to
   * `players === 2`; a player 2 who joins a 1-player game with a pad sets it back to false (the
   * solo keys keep driving player 1).
   */
  keySplit = false;
  /** See `InputContext.joinWatch` (GameplayScene sets it while a game plays). */
  joinWatch = false;
  /** See `InputContext.menuPads` (PauseScene sets it while it is open). */
  menuPads = false;
  bindings: Bindings;
  /** Extra key codes the keyboard source should swallow (e.g. debug F-keys). */
  readonly reserved = new Set<string>();
  /** The gamepads (null: none registered, e.g. headless). */
  gamepads: PadSource | null = null;
  private playerCount: 1 | 2 = 1;
  private readonly sources: InputSource[] = [];
  private readonly raw: string[] = [];
  private pauseEdge = false;
  /** Slots whose buttons are hidden after the next update (a pad just claimed them). */
  private readonly hideNext = [false, false];
  private device: 'none' | 'keys' | 'pad' = 'none';

  constructor(bindings: Bindings = defaultBindings()) {
    this.bindings = bindings;
  }

  /** 1 = the solo key set drives pad 0 (and every gamepad); 2 = per-player key sets and gamepads. */
  get players(): 1 | 2 {
    return this.playerCount;
  }

  set players(n: 1 | 2) {
    this.playerCount = n;
    this.keySplit = n === 2;
  }

  /** Register the gamepad source (also added as a source); returns its remover. */
  useGamepads(src: PadSource): () => void {
    this.gamepads = src;
    const remove = this.addSource(src);
    return () => {
      remove();
      if (this.gamepads === src) this.gamepads = null;
    };
  }

  /** Add a source; returns a function that removes it again. */
  addSource(src: InputSource): () => void {
    this.sources.push(src);
    return () => this.removeSource(src);
  }

  removeSource(src: InputSource): void {
    const i = this.sources.indexOf(src);
    if (i >= 0) this.sources.splice(i, 1);
  }

  /** Poll every source and advance both pads by one tick. */
  update(): void {
    const srcs = this.sources;
    for (let i = 0; i < srcs.length; i++) srcs[i].update?.(this);
    for (let s = 0; s <= 1; s++) {
      const slot = s as PlayerSlot;
      let m = 0;
      for (let i = 0; i < srcs.length; i++) m |= srcs[i].read(slot, this);
      this.pads[slot].update(m);
      if (this.hideNext[s]) {
        this.hideNext[s] = false;
        this.pads[slot].suppress();
      }
    }
    this.updateActions();
    this.raw.length = 0;
    for (let i = 0; i < srcs.length; i++) srcs[i].drainPressed?.(this.raw);
    for (let i = 0; i < srcs.length; i++) srcs[i].endTick?.();
    this.pauseEdge = this.computePause();
    const raw = this.raw;
    if (raw.length > 0) this.device = raw[raw.length - 1].startsWith('Gamepad') ? 'pad' : 'keys';
  }

  private updateActions(): void {
    const a = this.analog;
    clearAnalog(a);
    let m = 0;
    if (this.fpsMode) {
      const srcs = this.sources;
      for (let i = 0; i < srcs.length; i++) {
        const src = srcs[i];
        m |= src.readActions ? src.readActions(0, this) : actionsFromPad(src.read(0, this));
        src.readAnalog?.(0, a, this);
      }
      clampAnalog(a);
    }
    this.actions.update(m);
  }

  private computePause(): boolean {
    const raw = this.raw;
    if (raw.length === 0) return false;
    const b = this.bindings;
    for (let i = 0; i < raw.length; i++) {
      const code = raw[i];
      if (b.pause.includes(code)) return true;
      for (const idx of b.padPause) if (code === padButtonCode(idx)) return true;
    }
    return false;
  }

  pad(slot: PlayerSlot): VirtualPad {
    return this.pads[slot];
  }

  /** Raw codes pressed this tick (KeyboardEvent.code or `GamepadB<n>`), in press order. */
  get rawPressed(): readonly string[] {
    return this.raw;
  }

  /** Was this raw key code pressed this tick? (menus, rebinding, debug F-keys) */
  keyPressed(code: string): boolean {
    return this.raw.includes(code);
  }

  /** A pause key or pad pause button went down this tick. */
  get pausePressed(): boolean {
    return this.pauseEdge;
  }

  /** Any button on any pad, or any raw key, went down this tick ("press any key"). */
  anyPressed(): boolean {
    return this.raw.length > 0 || this.pads[0].anyPressed() || this.pads[1].anyPressed();
  }

  /** Is this key code used by any binding, pause key or reserved key? */
  isBound(code: string): boolean {
    if (this.reserved.has(code)) return true;
    const b = this.bindings;
    if (b.pause.includes(code)) return true;
    for (const set of [b.solo, b.p1, b.p2]) {
      for (const btn of BUTTONS) if (set[btn].includes(code)) return true;
    }
    return false;
  }

  /** Replace the key codes of one button in one key set. */
  setKeys(set: KeySetName, button: Button, codes: readonly string[]): void {
    this.bindings[set][button] = codes.slice(0, 8);
  }

  /** Replace the gamepad buttons of one button (player 1's pad map, or player 2's with slot 1). */
  setPadButtons(button: Button, indices: readonly number[], slot: PlayerSlot = 0): void {
    (slot === 0 ? this.bindings.pad : this.bindings.pad2)[button] = indices.slice(0, 8);
  }

  // ------------------------------------------------------------------------------- gamepads

  /** The device that pressed something last: 'keys', 'pad' or 'none' yet (menu labels). */
  get lastDevice(): 'none' | 'keys' | 'pad' {
    return this.device;
  }

  /** The pad that pressed a button last (null: none, or the keyboard was used after it). */
  lastPadInfo(): PadInfo | null {
    const g = this.gamepads;
    return g && this.device === 'pad' ? g.info(g.lastIndex) : null;
  }

  /** The pad of a slot (its claim, connected or lost; null: none). */
  slotPad(slot: PlayerSlot): PadInfo | null {
    return this.gamepads?.claims[slot]?.info ?? null;
  }

  /** The slot has a connected pad. */
  slotHasPad(slot: PlayerSlot): boolean {
    return (this.gamepads?.liveIndex(slot) ?? -1) >= 0;
  }

  /** The slot's pad was claimed and is not connected now (the lost-pad pause). */
  padLost(slot: PlayerSlot): boolean {
    return this.gamepads?.lost(slot) ?? false;
  }

  /** Connected pads that are free (1 player: not player 1's; 2 players: nobody's). */
  freePads(): number {
    return this.gamepads?.freeCount(this.playerCount) ?? 0;
  }

  /** The first free pad that pressed one of these (up to 3) standard buttons this tick (−1: none). */
  freePadPressed(b0: number, b1 = -1, b2 = -1): number {
    return this.gamepads?.freePressedBy(this.playerCount, b0, b1, b2) ?? -1;
  }

  /** The first pad (any) that pressed one of these (up to 3) standard buttons this tick (−1: none). */
  padPressed(b0: number, b1 = -1, b2 = -1): number {
    return this.gamepads?.pressedBy(b0, b1, b2) ?? -1;
  }

  /**
   * Give pad `index` to `slot` (a pad held by the other slot moves). The buttons it holds now are
   * hidden until released (the START that claimed it does not also confirm or pause).
   */
  claimPad(slot: PlayerSlot, index: number): boolean {
    const ok = this.gamepads?.claim(slot, index) ?? false;
    if (ok) this.hideNext[slot] = true;
    return ok;
  }

  /** Forget the slot's pad (the player goes on with the keyboard). */
  releasePad(slot: PlayerSlot): void {
    this.gamepads?.release(slot);
  }

  /**
   * Rumble the slot's pad (`strong` / `weak` 0..1, `ms`); with one player and no claimed pad the
   * pad used last. False when nothing rumbled (no pad, no motor, a stronger effect running).
   */
  rumble(slot: PlayerSlot, strong: number, weak: number, ms: number): boolean {
    return this.gamepads?.rumble(slot, strong, weak, ms, this.playerCount) ?? false;
  }

  /** Rumble the pad that pressed a button last (OPTIONS: RUMBLE ON). */
  rumbleLastPad(strong: number, weak: number, ms: number): boolean {
    const g = this.gamepads;
    return g ? g.rumblePad(g.lastIndex, strong, weak, ms) : false;
  }

  /** Hide held buttons on both pads until released (call on scene changes); `mask` as VirtualPad.suppress. */
  suppress(mask = 0xff): void {
    this.pads[0].suppress(mask);
    this.pads[1].suppress(mask);
    this.actions.suppress(); // every scene change and resume hides the action that confirmed it
  }

  /** Reset both pads (all up). */
  reset(): void {
    this.pads[0].reset();
    this.pads[1].reset();
    this.actions.reset();
    clearAnalog(this.analog);
    this.raw.length = 0;
    this.pauseEdge = false;
    this.hideNext[0] = this.hideNext[1] = false;
  }
}
