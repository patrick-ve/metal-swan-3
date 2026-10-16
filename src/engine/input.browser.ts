/**
 * Browser input sources (docs/ARCHITECTURE.md §5.2). Import only from src/main.ts or other
 * *.browser.ts files.
 *
 * ```ts
 * const input = new InputManager(parseBindings(store.get('bindings')));
 * input.addSource(new KeyboardSource(window, { isBound: (c) => input.isBound(c) }));
 * input.addSource(new GamepadSource());
 * // every tick: input.update(); then read input.pad(0).pressed('jump') …
 * ```
 *
 * First-person mode (`input.fpsMode`, docs/design/fps.md §2): the keyboard also reports actions
 * through the fixed `FpsKeyMap`, and every gamepad feeds slot 0's actions and analog (left stick
 * move / strafe, right stick X turn). The pointer-lock mouse lives in pointer.browser.ts.
 */
import {
  actionsFromKeys,
  actionsFromPadButtons,
  type AnalogState,
  defaultFpsKeyMap,
  defaultFpsPadMap,
  FPS_KEY_CODES,
  type FpsKeyMap,
  stickMove as stickMoveInto,
  stickTurn,
} from './input-actions';
import {
  BUTTON_BIT,
  type InputContext,
  type InputSource,
  keySetFor,
  maskFromKeys,
  maskFromPad,
  padButtonCode,
  type PlayerSlot,
} from './input';

export interface KeyboardOptions {
  /** Keys for which the browser default is prevented (bound keys, reserved debug keys). */
  isBound?: (code: string) => boolean;
}

/**
 * Keyboard via KeyboardEvent.code (layout independent). Short taps that start and end between
 * two ticks still count as held for one tick. All keys are released on blur / tab hide.
 * In `fpsMode` it also reports first-person actions (`fpsKeys`, all slot 0) and prevents the
 * browser default of every first-person key (Space would scroll the page).
 */
export class KeyboardSource implements InputSource {
  private readonly held = new Set<string>();
  /** Keys pressed since the last tick (so very short taps are not lost). */
  private readonly latched = new Set<string>();
  private readonly queue: string[] = [];
  private readonly target: EventTarget;
  private readonly isBound: (code: string) => boolean;
  /** The first-person key map (fixed in this wave). */
  readonly fpsKeys: FpsKeyMap = defaultFpsKeyMap();
  /** `ctx.fpsMode` of the last update (the key handlers run between ticks). */
  private fpsMode = false;
  private readonly isDown = (code: string): boolean => this.held.has(code) || this.latched.has(code);

  private shouldPrevent(code: string): boolean {
    return this.isBound(code) || (this.fpsMode && FPS_KEY_CODES.has(code));
  }

  private readonly onDown = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    const code = e.code;
    if (!code) return;
    if (this.shouldPrevent(code) && !e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
    if (e.repeat || this.held.has(code)) return;
    this.held.add(code);
    this.latched.add(code);
    if (this.queue.length < 32) this.queue.push(code);
  };

  private readonly onUp = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    if (!e.code) return;
    this.held.delete(e.code);
    if (this.shouldPrevent(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
  };

  private readonly onBlur = (): void => this.releaseAll();

  private readonly onVisibility = (): void => {
    if (document.hidden) this.releaseAll();
  };

  constructor(target: EventTarget = window, opts: KeyboardOptions = {}) {
    this.target = target;
    this.isBound = opts.isBound ?? (() => false);
    target.addEventListener('keydown', this.onDown);
    target.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  update(ctx: InputContext): void {
    this.fpsMode = ctx.fpsMode === true;
  }

  read(slot: PlayerSlot, ctx: InputContext): number {
    const set = keySetFor(slot, ctx.players);
    return set ? maskFromKeys(ctx.bindings[set], this.isDown) : 0;
  }

  /** First-person actions: the whole keyboard drives slot 0 (spec §1.10). */
  readActions(slot: PlayerSlot): number {
    return slot === 0 ? actionsFromKeys(this.fpsKeys, this.isDown) : 0;
  }

  drainPressed(out: string[]): void {
    for (let i = 0; i < this.queue.length; i++) out.push(this.queue[i]);
    this.queue.length = 0;
  }

  endTick(): void {
    this.latched.clear();
  }

  /** Forget every held key (focus lost). */
  releaseAll(): void {
    this.held.clear();
    this.latched.clear();
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onDown);
    this.target.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.releaseAll();
  }
}

/** sin(22.5°): splits the stick circle into 8 equal direction sectors. */
const SECTOR = 0.3827;

/**
 * Gamepads with the standard mapping (other mappings are read with the same indices).
 * 1-player mode: every pad drives player 1. 2-player mode: the first connected pad drives
 * player 1, the second player 2. D-pad buttons and the left stick (with a radial dead zone)
 * both move. Hot-plug works because pads are polled every tick.
 *
 * In `fpsMode` every connected pad also feeds slot 0's first-person channel: buttons through the
 * fixed `FpsPadMap` (OR-ed over the pads), the left stick → `moveX` / `moveY` and the right stick
 * X → `turn` (0.2 dead zone, integers). Per stick axis the pad with the largest value wins.
 */
export class GamepadSource implements InputSource {
  /** Radial dead zone of the left stick (0..1). */
  deadZone = 0.3;
  /** Dead zone of both sticks in the first-person mode (spec §2.2). */
  fpsDeadZone = 0.2;
  private readonly fpsPad = defaultFpsPadMap();
  private fpsActions = 0;
  private readonly fpsAnalog: AnalogState = { turn: 0, moveX: 0, moveY: 0 };
  private readonly stick: AnalogState = { turn: 0, moveX: 0, moveY: 0 };
  private readonly masks = [0, 0];
  private readonly prevRaw = new Map<number, number>();
  private readonly queue: string[] = [];
  private cur: Gamepad | null = null;
  private readonly isPadDown = (i: number): boolean => {
    const b = this.cur?.buttons[i];
    return !!b && (b.pressed || b.value > 0.5);
  };
  private readonly onConnect = (ev: Event): void => {
    const gp = (ev as GamepadEvent).gamepad;
    console.info(`[input] gamepad ${gp.index} connected: ${gp.id} (${gp.mapping || 'non-standard'} mapping)`);
  };
  private readonly onDisconnect = (ev: Event): void => {
    const gp = (ev as GamepadEvent).gamepad;
    this.prevRaw.delete(gp.index);
    console.info(`[input] gamepad ${gp.index} disconnected`);
  };

  constructor() {
    window.addEventListener('gamepadconnected', this.onConnect);
    window.addEventListener('gamepaddisconnected', this.onDisconnect);
  }

  update(ctx: InputContext): void {
    this.masks[0] = 0;
    this.masks[1] = 0;
    const fps = ctx.fpsMode === true;
    const fa = this.fpsAnalog;
    this.fpsActions = 0;
    fa.turn = fa.moveX = fa.moveY = 0;
    let pads: readonly (Gamepad | null)[] = [];
    try {
      pads = navigator.getGamepads ? navigator.getGamepads() : [];
    } catch {
      pads = [];
    }
    let order = 0;
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      const slot = ctx.players === 1 ? 0 : order < 2 ? order : -1;
      order++;
      this.cur = gp;
      let m = maskFromPad(ctx.bindings.pad, this.isPadDown);
      const ax = gp.axes[0] ?? 0;
      const ay = gp.axes[1] ?? 0;
      const mag = Math.hypot(ax, ay);
      if (mag >= this.deadZone) {
        const nx = ax / mag;
        const ny = ay / mag;
        if (nx < -SECTOR) m |= BUTTON_BIT.left;
        if (nx > SECTOR) m |= BUTTON_BIT.right;
        if (ny < -SECTOR) m |= BUTTON_BIT.up;
        if (ny > SECTOR) m |= BUTTON_BIT.down;
      }
      if (slot >= 0) this.masks[slot] |= m;
      if (fps) this.readFps(gp);
      // Raw button presses (menus, rebinding, pause).
      let now = 0;
      const nb = Math.min(gp.buttons.length, 31);
      for (let i = 0; i < nb; i++) if (this.isPadDown(i)) now |= 1 << i;
      const edges = now & ~(this.prevRaw.get(gp.index) ?? 0);
      if (edges) for (let i = 0; i < nb; i++) if (edges & (1 << i) && this.queue.length < 32) this.queue.push(padButtonCode(i));
      this.prevRaw.set(gp.index, now);
    }
    this.cur = null;
  }

  /** One pad's first-person buttons and sticks, merged into the slot-0 channel. */
  private readFps(gp: Gamepad): void {
    this.fpsActions |= actionsFromPadButtons(this.fpsPad, this.isPadDown);
    const st = this.stick;
    stickMoveInto(gp.axes[0] ?? 0, gp.axes[1] ?? 0, st, this.fpsDeadZone);
    const turn = stickTurn(gp.axes[2] ?? 0, this.fpsDeadZone);
    const fa = this.fpsAnalog;
    if (Math.abs(st.moveX) > Math.abs(fa.moveX)) fa.moveX = st.moveX;
    if (Math.abs(st.moveY) > Math.abs(fa.moveY)) fa.moveY = st.moveY;
    if (Math.abs(turn) > Math.abs(fa.turn)) fa.turn = turn;
  }

  read(slot: PlayerSlot): number {
    return this.masks[slot];
  }

  readActions(slot: PlayerSlot): number {
    return slot === 0 ? this.fpsActions : 0;
  }

  readAnalog(slot: PlayerSlot, out: AnalogState): void {
    if (slot !== 0) return;
    out.turn += this.fpsAnalog.turn;
    out.moveX += this.fpsAnalog.moveX;
    out.moveY += this.fpsAnalog.moveY;
  }

  drainPressed(out: string[]): void {
    for (let i = 0; i < this.queue.length; i++) out.push(this.queue[i]);
    this.queue.length = 0;
  }

  dispose(): void {
    window.removeEventListener('gamepadconnected', this.onConnect);
    window.removeEventListener('gamepaddisconnected', this.onDisconnect);
  }
}

// ---------------------------------------------------------------------------------------------
// Touch: an on-screen pad for phones and tablets
// ---------------------------------------------------------------------------------------------

interface TouchButtonDef {
  label: string;
  bit: number;
  /** CSS position of the button centre (from the bottom-right corner, or the top for START). */
  css: string;
  size: number;
}

const TOUCH_BUTTONS: readonly TouchButtonDef[] = [
  { label: 'FIRE', bit: BUTTON_BIT.fire, css: 'right:118px;bottom:34px', size: 72 },
  { label: 'JUMP', bit: BUTTON_BIT.jump, css: 'right:26px;bottom:74px', size: 72 },
  { label: 'BOMB', bit: BUTTON_BIT.bomb, css: 'right:150px;bottom:126px', size: 56 },
  { label: 'START', bit: BUTTON_BIT.start, css: 'left:50%;top:10px;transform:translateX(-50%)', size: 0 },
];

/**
 * A virtual pad drawn over the game on touch screens (player 1): a stick zone on the left half
 * (drag from where the thumb lands; 8 directions) and FIRE / JUMP / BOMB / START buttons. It
 * stays hidden until the first touch and hides again when a key is pressed. Taps shorter than a
 * tick still count for one tick.
 */
export class TouchSource implements InputSource {
  /** Drag distance (px) before the stick reports a direction. */
  deadZone = 14;
  private buttonsMask = 0;
  private stickMask = 0;
  private latched = 0;
  private stickId: number | null = null;
  private stickX = 0;
  private stickY = 0;
  private readonly byTouch = new Map<number, number>();
  private readonly root: HTMLDivElement;
  private readonly knob: HTMLDivElement;

  private readonly onFirstTouch = (): void => this.show(true);
  private readonly onKey = (): void => this.show(false);

  constructor(parent: HTMLElement = document.body) {
    const root = document.createElement('div');
    root.style.cssText = 'position:fixed;inset:0;z-index:5;display:none;pointer-events:none;user-select:none;-webkit-user-select:none;touch-action:none;';
    const zone = document.createElement('div');
    zone.style.cssText = 'position:absolute;left:0;bottom:0;width:45%;height:70%;pointer-events:auto;touch-action:none;';
    this.knob = document.createElement('div');
    this.knob.style.cssText =
      'position:absolute;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;border:2px solid rgba(255,255,255,.35);display:none;';
    zone.appendChild(this.knob);
    zone.addEventListener('touchstart', (e) => this.stickStart(e, zone), { passive: false });
    zone.addEventListener('touchmove', (e) => this.stickMove(e), { passive: false });
    zone.addEventListener('touchend', (e) => this.stickEnd(e), { passive: false });
    zone.addEventListener('touchcancel', (e) => this.stickEnd(e), { passive: false });
    root.appendChild(zone);
    for (const b of TOUCH_BUTTONS) root.appendChild(this.button(b));
    parent.appendChild(root);
    this.root = root;
    window.addEventListener('touchstart', this.onFirstTouch, { passive: true });
    window.addEventListener('keydown', this.onKey);
  }

  private button(b: TouchButtonDef): HTMLDivElement {
    const el = document.createElement('div');
    const round = b.size > 0;
    el.textContent = b.label;
    el.style.cssText =
      `position:absolute;${b.css};pointer-events:auto;touch-action:none;display:flex;align-items:center;justify-content:center;` +
      `font:bold 12px monospace;color:rgba(255,255,255,.8);background:rgba(255,255,255,.12);border:2px solid rgba(255,255,255,.4);` +
      (round ? `width:${b.size}px;height:${b.size}px;border-radius:50%;` : 'padding:6px 14px;border-radius:14px;');
    const press = (e: TouchEvent): void => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) this.byTouch.set(t.identifier, b.bit);
      this.recount();
      this.latched |= b.bit;
      el.style.background = 'rgba(255,220,120,.35)';
    };
    const release = (e: TouchEvent): void => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) this.byTouch.delete(t.identifier);
      this.recount();
      el.style.background = 'rgba(255,255,255,.12)';
    };
    el.addEventListener('touchstart', press, { passive: false });
    el.addEventListener('touchend', release, { passive: false });
    el.addEventListener('touchcancel', release, { passive: false });
    return el;
  }

  private recount(): void {
    let m = 0;
    for (const bit of this.byTouch.values()) m |= bit;
    this.buttonsMask = m;
  }

  private stickStart(e: TouchEvent, zone: HTMLElement): void {
    e.preventDefault();
    if (this.stickId !== null) return;
    const t = e.changedTouches[0];
    if (!t) return;
    this.stickId = t.identifier;
    this.stickX = t.clientX;
    this.stickY = t.clientY;
    const r = zone.getBoundingClientRect();
    this.knob.style.left = `${t.clientX - r.left}px`;
    this.knob.style.top = `${t.clientY - r.top}px`;
    this.knob.style.display = 'block';
  }

  private stickMove(e: TouchEvent): void {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== this.stickId) continue;
      const dx = t.clientX - this.stickX;
      const dy = t.clientY - this.stickY;
      const mag = Math.hypot(dx, dy);
      let m = 0;
      if (mag >= this.deadZone) {
        const nx = dx / mag;
        const ny = dy / mag;
        if (nx < -SECTOR) m |= BUTTON_BIT.left;
        if (nx > SECTOR) m |= BUTTON_BIT.right;
        if (ny < -SECTOR) m |= BUTTON_BIT.up;
        if (ny > SECTOR) m |= BUTTON_BIT.down;
      }
      this.latched |= m;
      this.stickMask = m;
    }
  }

  private stickEnd(e: TouchEvent): void {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier !== this.stickId) continue;
      this.stickId = null;
      this.stickMask = 0;
      this.knob.style.display = 'none';
    }
  }

  /** Show / hide the overlay (shown on the first touch, hidden when a key is used). */
  show(on: boolean): void {
    this.root.style.display = on ? 'block' : 'none';
    if (!on) {
      this.byTouch.clear();
      this.buttonsMask = this.stickMask = 0;
      this.stickId = null;
    }
  }

  read(slot: PlayerSlot): number {
    return slot === 0 ? this.buttonsMask | this.stickMask | this.latched : 0;
  }

  endTick(): void {
    this.latched = 0;
  }

  dispose(): void {
    window.removeEventListener('touchstart', this.onFirstTouch);
    window.removeEventListener('keydown', this.onKey);
    this.root.remove();
  }
}
