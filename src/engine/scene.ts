/**
 * Scene stack with fade transitions (docs/ARCHITECTURE.md §5.13).
 *
 * Only the top scene updates. Drawing starts at the highest scene that is not `transparent`
 * and goes up, so an overlay (pause menu) can draw over the frozen scene below it.
 * Transitions with `fade` ticks: fade to `color` over the first half, swap scenes at full
 * cover, fade back in over the second half. During a transition `busy` is true (scenes may
 * ignore input then); the top scene keeps updating.
 */
import type { Color } from './color';
import type { Renderer } from './render';

export interface Scene {
  /** Pushed or swapped in. */
  enter?(): void;
  /** Popped or swapped out. */
  exit?(): void;
  /** Another scene was pushed on top of this one. */
  pause?(): void;
  /** The scene on top of this one was popped. */
  resume?(): void;
  update(): void;
  draw(r: Renderer): void;
  /** Draw the scene below first (overlays). Default false. */
  transparent?: boolean;
}

export interface TransitionOpts {
  /** Total fade length in ticks (out + in). 0 or missing = instant. */
  fade?: number;
  /** Fade colour (default opaque black). */
  color?: Color;
}

type Action =
  | { kind: 'push'; scene: Scene }
  | { kind: 'pop' }
  | { kind: 'replace'; scene: Scene }
  | { kind: 'reset'; scene: Scene };

export class SceneManager {
  private readonly stack: Scene[] = [];
  private action: Action | null = null;
  private fadeTotal = 0;
  private fadeTick = 0;
  private fadeColor: Color = 0x000000ff;
  private swapped = false;

  get top(): Scene | null {
    return this.stack.length ? this.stack[this.stack.length - 1] : null;
  }

  get depth(): number {
    return this.stack.length;
  }

  /** True while a fade transition runs. */
  get busy(): boolean {
    return this.action !== null;
  }

  push(scene: Scene, t?: TransitionOpts): void {
    this.start({ kind: 'push', scene }, t);
  }

  pop(t?: TransitionOpts): void {
    this.start({ kind: 'pop' }, t);
  }

  replace(scene: Scene, t?: TransitionOpts): void {
    this.start({ kind: 'replace', scene }, t);
  }

  /** Clear the whole stack and start over with one scene. */
  reset(scene: Scene, t?: TransitionOpts): void {
    this.start({ kind: 'reset', scene }, t);
  }

  update(): void {
    if (this.action) {
      this.fadeTick++;
      const half = Math.max(1, Math.floor(this.fadeTotal / 2));
      if (!this.swapped && this.fadeTick >= half) {
        this.apply(this.action);
        this.swapped = true;
      }
      if (this.fadeTick >= this.fadeTotal) this.action = null;
    }
    this.top?.update();
  }

  draw(r: Renderer): void {
    const s = this.stack;
    let first = s.length - 1;
    while (first > 0 && s[first].transparent) first--;
    for (let i = Math.max(0, first); i < s.length; i++) s[i].draw(r);
    if (this.action) {
      const half = Math.max(1, Math.floor(this.fadeTotal / 2));
      const a = this.fadeTick < half ? this.fadeTick / half : 1 - (this.fadeTick - half) / Math.max(1, this.fadeTotal - half);
      if (a > 0) r.fade(this.fadeColor, Math.min(1, a));
    }
  }

  private start(action: Action, t?: TransitionOpts): void {
    const fade = Math.max(0, Math.floor(t?.fade ?? 0));
    if (this.action) {
      // A transition is running: finish it at once, then start this one.
      if (!this.swapped) this.apply(this.action);
      this.action = null;
    }
    if (fade < 2) {
      this.apply(action);
      return;
    }
    this.action = action;
    this.fadeTotal = fade;
    this.fadeTick = 0;
    this.fadeColor = t?.color ?? 0x000000ff;
    this.swapped = false;
  }

  private apply(a: Action): void {
    const s = this.stack;
    switch (a.kind) {
      case 'push':
        s[s.length - 1]?.pause?.();
        s.push(a.scene);
        a.scene.enter?.();
        break;
      case 'pop': {
        const old = s.pop();
        old?.exit?.();
        s[s.length - 1]?.resume?.();
        break;
      }
      case 'replace': {
        const old = s.pop();
        old?.exit?.();
        s.push(a.scene);
        a.scene.enter?.();
        break;
      }
      case 'reset':
        while (s.length) s.pop()?.exit?.();
        s.push(a.scene);
        a.scene.enter?.();
        break;
    }
  }
}
