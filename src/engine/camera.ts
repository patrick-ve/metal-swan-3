/**
 * Scrolling camera (docs/ARCHITECTURE.md §5.8).
 *
 * - `follow(targets)`: 1–2 targets (players). The camera centres on their average position plus
 *   a lead in the facing direction, and keeps every target inside the view.
 * - `scroll`: 'right' never scrolls back left, 'up' never back down, 'down' never back up
 *   (the ratchet); 'free' moves both ways.
 * - Clamped to `bounds` (the section). `lock(minX, maxX)` confines the view to an arena; the
 *   camera eases into the range and eases back out after `unlock()`.
 * - Vertical follow uses a dead zone so small jumps do not move the view.
 * - `shake(amount, ticks)` is a deterministic offset (seeded rng) applied only when rendering:
 *   `renderer.setCamera(camera.viewX, camera.viewY)`. The renderer snaps that position to its own
 *   grid: whole pixels at res 1, 1/res steps with a sub-pixel backbuffer (render-common.ts).
 *   The camera itself (x, y, the follow logic) is the same at every resolution.
 * `x, y` is the top-left corner of the view in world pixels.
 */
import { clamp, type Rect } from './math';
import { VIEW_H, VIEW_W } from './render';
import { Rng } from './rng';

export type ScrollMode = 'right' | 'up' | 'down' | 'free';

/** Entities fit this structurally. Dead targets are ignored. */
export interface CameraTarget {
  readonly x: number;
  readonly y: number;
  readonly facing?: number;
  readonly dead?: boolean;
}

export class Camera {
  /** Top-left of the view (world px). */
  x = 0;
  y = 0;
  readonly w: number;
  readonly h: number;
  /** Section rect the view must stay inside. */
  bounds: Rect;
  scroll: ScrollMode = 'right';
  /** Look-ahead in the facing direction (px); 38 keeps a right-facing target at 40 % of a 384 px view. */
  lead = 38;
  /** How fast the look-ahead changes when a target turns (px/tick). */
  leadSpeed = 1;
  /** The camera centres on the feet y minus this (px), so more is visible above the player. */
  offsetY = 54;
  /** Half-height of the vertical dead zone around the view centre (px). */
  deadZoneY = 24;
  /** Fraction of the remaining distance moved per tick (1 = no smoothing). */
  smoothing = 0.2;
  /** Speed limit (px/tick), e.g. when catching up after an arena unlock. */
  maxSpeed = 3;
  /** Targets are kept at least this far inside the view horizontally (px). */
  margin = 12;
  /** Multiplier for all shakes (0 disables shaking, e.g. an accessibility option). */
  shakeScale = 1;
  /** Current shake offset in whole pixels. */
  shakeX = 0;
  shakeY = 0;

  private targets: readonly CameraTarget[] = [];
  private leadX = 0;
  private isLocked = false;
  private lockMinX = -Infinity;
  private lockMaxX = Infinity;
  private lockMinY = -Infinity;
  private lockMaxY = Infinity;
  private shakeAmp = 0;
  private shakeTicks = 0;
  private shakeTotal = 0;
  private readonly rng: Rng;
  private tx = 0;
  private ty = 0;

  constructor(w = VIEW_W, h = VIEW_H, rng: Rng = new Rng('camera')) {
    this.w = w;
    this.h = h;
    this.bounds = { x: 0, y: 0, w, h };
    this.rng = rng;
  }

  setBounds(r: Rect): void {
    this.bounds = { x: r.x, y: r.y, w: r.w, h: r.h };
  }

  /** Targets to follow (usually the players). Pass null to stop following. */
  follow(targets: CameraTarget | readonly CameraTarget[] | null): void {
    if (!targets) this.targets = [];
    else if (Array.isArray(targets)) this.targets = targets;
    else this.targets = [targets as CameraTarget];
  }

  /**
   * Confine the view to x ∈ [minX, maxX] (and optionally y ∈ [minY, maxY]) — e.g. an arena
   * exactly one screen wide: `lock(1200, 1200 + 384)`. The camera eases into the range.
   */
  lock(minX: number, maxX: number, minY = -Infinity, maxY = Infinity): void {
    this.isLocked = true;
    this.lockMinX = minX;
    this.lockMaxX = maxX;
    this.lockMinY = minY;
    this.lockMaxY = maxY;
  }

  /** Release a lock; the camera eases back to following (the ratchet holds from here). */
  unlock(): void {
    this.isLocked = false;
    this.lockMinX = -Infinity;
    this.lockMaxX = Infinity;
    this.lockMinY = -Infinity;
    this.lockMaxY = Infinity;
  }

  get locked(): boolean {
    return this.isLocked;
  }

  /** Jump straight to the follow position (section start, respawn). */
  snap(): void {
    let f = 0;
    let n = 0;
    for (const t of this.targets) {
      if (t.dead) continue;
      f += t.facing ?? 0;
      n++;
    }
    this.leadX = n ? (f / n) * this.lead : 0;
    this.computeTarget(true);
    this.x = this.tx;
    this.y = this.ty;
  }

  /** Advance one tick (the World calls this after the entity passes). */
  update(): void {
    this.computeTarget(false);
    const prevX = this.x;
    const prevY = this.y;
    let nx = prevX + clamp((this.tx - prevX) * this.smoothing, -this.maxSpeed, this.maxSpeed);
    let ny = prevY + clamp((this.ty - prevY) * this.smoothing, -this.maxSpeed, this.maxSpeed);
    if (Math.abs(this.tx - nx) < 0.01) nx = this.tx;
    if (Math.abs(this.ty - ny) < 0.01) ny = this.ty;
    if (!this.isLocked) {
      if (this.scroll === 'right' && nx < prevX) nx = prevX;
      if (this.scroll === 'up' && ny > prevY) ny = prevY;
      if (this.scroll === 'down' && ny < prevY) ny = prevY;
    }
    this.x = nx;
    this.y = ny;
    this.updateShake();
  }

  /** Shake the view by up to `amount` px, fading out over `ticks`. Weaker shakes do not override stronger ones. */
  shake(amount: number, ticks: number): void {
    const remaining = this.shakeTicks > 0 ? (this.shakeAmp * this.shakeTicks) / this.shakeTotal : 0;
    if (amount < remaining) return;
    this.shakeAmp = amount;
    this.shakeTicks = Math.max(1, Math.floor(ticks));
    this.shakeTotal = this.shakeTicks;
  }

  /** Camera x for drawing, rounded to whole pixels (shake included). */
  get renderX(): number {
    return Math.round(this.x + this.shakeX);
  }

  get renderY(): number {
    return Math.round(this.y + this.shakeY);
  }

  /**
   * Camera x for `Renderer.setCamera`, not rounded (shake included, whole px): the renderer
   * snaps it to its grid, so a high-resolution backbuffer scrolls in 1/res steps.
   */
  get viewX(): number {
    return this.x + this.shakeX;
  }

  get viewY(): number {
    return this.y + this.shakeY;
  }

  get left(): number {
    return this.x;
  }

  get right(): number {
    return this.x + this.w;
  }

  get top(): number {
    return this.y;
  }

  get bottom(): number {
    return this.y + this.h;
  }

  get centerX(): number {
    return this.x + this.w / 2;
  }

  get centerY(): number {
    return this.y + this.h / 2;
  }

  /** The visible rect (without shake), optionally grown by `margin`. */
  view(margin = 0, out?: Rect): Rect {
    const o = out ?? { x: 0, y: 0, w: 0, h: 0 };
    o.x = this.x - margin;
    o.y = this.y - margin;
    o.w = this.w + margin * 2;
    o.h = this.h + margin * 2;
    return o;
  }

  /** Does the rect overlap the view grown by `margin`? */
  inView(r: Rect, margin = 0): boolean {
    return (
      r.x < this.x + this.w + margin &&
      r.x + r.w > this.x - margin &&
      r.y < this.y + this.h + margin &&
      r.y + r.h > this.y - margin
    );
  }

  containsPoint(px: number, py: number, margin = 0): boolean {
    return (
      px >= this.x - margin && px < this.x + this.w + margin && py >= this.y - margin && py < this.y + this.h + margin
    );
  }

  /**
   * Keep an x (e.g. a player's anchor) inside the view: the view edges act as walls.
   * `halfWidth` is half the entity's width.
   */
  clampX(x: number, halfWidth: number): number {
    return clamp(x, this.x + halfWidth, this.x + this.w - halfWidth);
  }

  /** Keep a y inside the view (`above` px of the entity above y, `below` px below). */
  clampY(y: number, above: number, below = 0): number {
    return clamp(y, this.y + above, this.y + this.h - below);
  }

  // ------------------------------------------------------------------------------- internals

  private computeTarget(instant: boolean): void {
    let n = 0;
    let sx = 0;
    let sy = 0;
    let sf = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const t of this.targets) {
      if (t.dead) continue;
      n++;
      sx += t.x;
      sy += t.y;
      sf += t.facing ?? 0;
      if (t.x < minX) minX = t.x;
      if (t.x > maxX) maxX = t.x;
      if (t.y < minY) minY = t.y;
      if (t.y > maxY) maxY = t.y;
    }
    let tx = this.x;
    let ty = this.y;
    if (n > 0) {
      // Look-ahead eases toward the average facing.
      const want = (sf / n) * this.lead;
      if (!instant) {
        const d = want - this.leadX;
        this.leadX += clamp(d, -this.leadSpeed, this.leadSpeed);
      }
      tx = sx / n + this.leadX - this.w / 2;
      // Keep every target inside the view (by `margin`).
      const lo = maxX + this.margin - this.w;
      const hi = minX - this.margin;
      tx = lo <= hi ? clamp(tx, lo, hi) : (lo + hi) / 2;

      // Vertical: move only when the focus leaves the dead zone.
      const focus = sy / n - this.offsetY;
      const cy = this.y + this.h / 2;
      if (instant) ty = focus - this.h / 2;
      else if (focus < cy - this.deadZoneY) ty = focus + this.deadZoneY - this.h / 2;
      else if (focus > cy + this.deadZoneY) ty = focus - this.deadZoneY - this.h / 2;
      // Feet stay visible; heads (about 40 px above the feet) too.
      const loY = maxY + this.margin - this.h;
      const hiY = minY - 40 - this.margin;
      if (loY <= hiY) ty = clamp(ty, loY, hiY);
    }
    if (this.isLocked) {
      tx = clampRange(tx, this.lockMinX, this.lockMaxX - this.w);
      ty = clampRange(ty, this.lockMinY, this.lockMaxY - this.h);
    }
    const b = this.bounds;
    this.tx = clampRange(tx, b.x, b.x + b.w - this.w);
    this.ty = clampRange(ty, b.y, b.y + b.h - this.h);
  }

  private updateShake(): void {
    if (this.shakeTicks > 0) {
      const a = ((this.shakeAmp * this.shakeTicks) / this.shakeTotal) * this.shakeScale;
      this.shakeX = Math.round(this.rng.range(-a, a)) || 0; // `|| 0` turns -0 into 0
      this.shakeY = Math.round(this.rng.range(-a, a)) || 0;
      this.shakeTicks--;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }
}

/** Clamp into [lo, hi]; when the range is inverted (smaller than the view), centre in it. */
function clampRange(v: number, lo: number, hi: number): number {
  if (lo > hi) return (lo + hi) / 2;
  return v < lo ? lo : v > hi ? hi : v;
}
