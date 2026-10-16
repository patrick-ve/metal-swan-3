/**
 * Pointer-lock mouse for the first-person mode (docs/design/fps.md §2.3). Import only from
 * src/main.ts or other *.browser.ts files.
 *
 * While the canvas holds the pointer lock: movementX → whole `turn` angle units per tick
 * (0.6 × sensitivity units per pixel, the fractional rest carries over), left button → `fire`,
 * right button → `use`, wheel down → `weaponNext`, wheel up → `weaponPrev`. Mouse Y is ignored.
 * Without the lock it reports nothing, so the click that takes the lock never fires.
 * It never reports 8-button masks (menus and the side-scroller ignore the mouse).
 *
 * ```ts
 * const pointer = new PointerLockSource(canvas);
 * input.addSource(pointer);
 * canvas.addEventListener('click', () => pointer.request());
 * pointer.onLockChange = (locked) => { … };
 * ```
 */
import { ACTION_BIT, type AnalogState, TurnAccumulator } from './input-actions';
import type { InputSource, PlayerSlot } from './input';

/** Wheel travel (px) for one weapon step; a mouse notch is about 100, trackpads send less. */
const WHEEL_STEP = 100;

export class PointerLockSource implements InputSource {
  /** MOUSE LOOK setting: when false the source reports nothing. */
  enabled = true;
  /** Called when the lock is taken (true) or lost (false). */
  onLockChange: ((locked: boolean) => void) | null = null;
  private readonly el: HTMLElement;
  private readonly acc = new TurnAccumulator();
  private turnNow = 0;
  /** Buttons down now / pressed since the last tick (latched, so short clicks count). */
  private buttons = 0;
  private latched = 0;
  private wheel = 0;
  private wheelPulse = 0;
  private wasLocked = false;

  private readonly onMove = (ev: Event): void => {
    if (!this.locked) return;
    this.acc.add((ev as MouseEvent).movementX);
  };

  private readonly onButtonDown = (ev: Event): void => {
    if (!this.locked) return;
    const bit = buttonBit((ev as MouseEvent).button);
    if (!bit) return;
    ev.preventDefault();
    this.buttons |= bit;
    this.latched |= bit;
  };

  private readonly onButtonUp = (ev: Event): void => {
    const bit = buttonBit((ev as MouseEvent).button);
    this.buttons &= ~bit;
  };

  private readonly onWheel = (ev: Event): void => {
    if (!this.locked) return;
    const e = ev as WheelEvent;
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * WHEEL_STEP : e.deltaY;
    if (!Number.isFinite(dy) || dy === 0) return;
    if (Math.sign(dy) !== Math.sign(this.wheel)) this.wheel = 0; // direction change: start over
    this.wheel += dy;
    if (Math.abs(this.wheel) >= WHEEL_STEP) {
      this.wheelPulse = this.wheel > 0 ? ACTION_BIT.weaponNext : ACTION_BIT.weaponPrev;
      this.wheel = 0;
    }
  };

  private readonly onContextMenu = (ev: Event): void => {
    if (this.locked) ev.preventDefault();
  };

  private readonly onLockEvent = (): void => {
    const locked = this.locked;
    if (locked === this.wasLocked) return;
    this.wasLocked = locked;
    this.releaseAll();
    this.onLockChange?.(locked);
  };

  constructor(el: HTMLElement) {
    this.el = el;
    document.addEventListener('mousemove', this.onMove);
    el.addEventListener('mousedown', this.onButtonDown);
    window.addEventListener('mouseup', this.onButtonUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });
    el.addEventListener('contextmenu', this.onContextMenu);
    document.addEventListener('pointerlockchange', this.onLockEvent);
    document.addEventListener('pointerlockerror', this.onLockEvent);
  }

  /** The element holds the pointer lock right now. */
  get locked(): boolean {
    return document.pointerLockElement === this.el;
  }

  /** settings.mouseSensitivity (1..10). */
  get sensitivity(): number {
    return this.acc.sensitivity;
  }

  set sensitivity(v: number) {
    this.acc.sensitivity = v;
  }

  /** Ask for the lock (must run inside a click handler). Failures (too soon after Esc) are ignored. */
  request(): void {
    if (this.locked || !this.el.requestPointerLock) return;
    try {
      const p = this.el.requestPointerLock() as unknown;
      if (p && typeof (p as Promise<void>).catch === 'function') (p as Promise<void>).catch(() => undefined);
    } catch {
      // Not allowed here (no user gesture, sandboxed frame): the keyboard still works.
    }
  }

  /** Give the lock back. */
  exit(): void {
    if (this.locked) document.exitPointerLock?.();
  }

  update(): void {
    // Whole units this tick; the fraction stays in the accumulator.
    if (this.enabled && this.locked) {
      this.turnNow = this.acc.take();
    } else {
      this.turnNow = 0;
      this.acc.reset();
    }
  }

  read(): number {
    return 0;
  }

  readActions(slot: PlayerSlot): number {
    if (slot !== 0 || !this.enabled || !this.locked) return 0;
    return this.buttons | this.latched | this.wheelPulse;
  }

  readAnalog(slot: PlayerSlot, out: AnalogState): void {
    if (slot === 0) out.turn += this.turnNow;
  }

  endTick(): void {
    this.latched = 0;
    this.wheelPulse = 0;
  }

  /** Forget held buttons and pending movement (lock lost). */
  releaseAll(): void {
    this.buttons = 0;
    this.latched = 0;
    this.wheel = 0;
    this.wheelPulse = 0;
    this.turnNow = 0;
    this.acc.reset();
  }

  dispose(): void {
    this.exit();
    document.removeEventListener('mousemove', this.onMove);
    this.el.removeEventListener('mousedown', this.onButtonDown);
    window.removeEventListener('mouseup', this.onButtonUp);
    this.el.removeEventListener('wheel', this.onWheel);
    this.el.removeEventListener('contextmenu', this.onContextMenu);
    document.removeEventListener('pointerlockchange', this.onLockEvent);
    document.removeEventListener('pointerlockerror', this.onLockEvent);
    this.releaseAll();
  }
}

/** Left button → fire, right button → use. */
function buttonBit(button: number): number {
  return button === 0 ? ACTION_BIT.fire : button === 2 ? ACTION_BIT.use : 0;
}
