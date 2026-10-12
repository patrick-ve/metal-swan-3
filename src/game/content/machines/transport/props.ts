/**
 * Cosmetic actors of the transport machines (no gameplay effect, `world.fxRng` only):
 * - `FallingProp`: an instrument (or a float topper) thrown out of a wreck. It tumbles through
 *   its strip, bounces once, lies still, blinks and goes; an optional sound on the first landing
 *   (the band truck's triangle "tings", GDD §9.2).
 * - `Parachutist`: the baton-copter pilot who bails out holding his hat (GDD §9.2): he pops up,
 *   floats down under a canopy at 0.6 px/tick, then scurries off to the nearest view edge.
 * Neither is shootable, neither holds a wave.
 */
import { Entity } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import { frameCount } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import { dust, poof } from '../../../fx';

const drawOpts: DrawOpts = {};

export interface FallingPropOpts {
  sprite: string;
  vx: number;
  vy: number;
  gravity?: number;
  /** Ticks per frame of the tumble (default 4). */
  spin?: number;
  /** Played on the first landing. */
  sfx?: string;
  /** Ticks it lies still before blinking out (default 70). */
  rest?: number;
}

export class FallingProp extends Entity {
  readonly sprite: string;
  private readonly gravity: number;
  private readonly spin: number;
  private readonly sfx: string;
  private readonly rest: number;
  private bounces = 0;
  private restT = 0;
  private frame = 0;
  private t = 0;

  constructor(world: World, x: number, y: number, o: FallingPropOpts) {
    super(world, x, y);
    this.type = 'machine-debris';
    this.sprite = o.sprite;
    this.vx = o.vx;
    this.vy = o.vy;
    this.gravity = o.gravity ?? 0.2;
    this.spin = o.spin ?? 4;
    this.sfx = o.sfx ?? '';
    this.rest = o.rest ?? 70;
    this.z = 32;
    this.despawnMargin = 64;
    this.hitbox = { x: -4, y: -8, w: 8, h: 8 };
  }

  static spawn(world: World, x: number, y: number, o: FallingPropOpts): FallingProp {
    return world.add(new FallingProp(world, x, y, o));
  }

  override update(): void {
    this.t++;
    if (this.bounces >= 2) {
      if (++this.restT >= this.rest + 24) this.remove();
      return;
    }
    this.vy = Math.min(this.vy + this.gravity, 6);
    const nx = this.x + this.vx;
    const ny = this.y + this.vy;
    const floor = this.vy > 0 ? this.world.terrain.surfaceY(nx, this.y - 1, ny) : Infinity;
    this.x = nx;
    if (Number.isFinite(floor)) {
      this.y = floor;
      this.bounces++;
      if (this.bounces === 1 && this.sfx) this.world.audio.sfx(this.sfx, { vol: 0.8 });
      dust(this.world, this.x, this.y, 2);
      this.vy = this.bounces >= 2 ? 0 : -Math.abs(this.vy) * 0.35;
      this.vx *= 0.5;
    } else this.y = ny;
    if (this.spin > 0 && this.t % this.spin === 0) this.frame++;
    if (this.y > this.world.camera.bottom + 64) this.remove();
  }

  override draw(r: Renderer): void {
    // Blink out at the end of the rest.
    if (this.bounces >= 2 && this.restT > this.rest && this.restT % 4 < 2) return;
    const n = frameCount(this.sprite);
    const f = this.bounces >= 2 ? 0 : this.frame % n;
    drawOpts.flipX = this.vx < 0;
    r.sprite(this.sprite, f, Math.round(this.x), Math.round(this.y), drawOpts);
  }
}

/** The baton-copter pilot under his parachute (sprites `<art>/pilot-chute`, `<art>/pilot-run`). */
export class Parachutist extends Entity {
  private readonly art: string;
  private readonly chute: string;
  private readonly run: string;
  private landed = false;
  private t = 0;
  private landT = 0;
  private readonly sway: number;

  constructor(world: World, x: number, y: number, art: string, facing: 1 | -1) {
    super(world, x, y);
    this.type = 'machine-pilot';
    this.art = art;
    this.chute = `${art}/pilot-chute`;
    this.run = `${art}/pilot-run`;
    this.facing = facing;
    this.vx = -facing * 0.5;
    this.vy = -1.6;
    this.z = 31;
    this.despawnMargin = 48;
    this.hitbox = { x: -6, y: -26, w: 12, h: 26 };
    this.sway = world.fxRng.range(0, Math.PI * 2);
  }

  override update(): void {
    this.t++;
    const w = this.world;
    if (!this.landed) {
      // Pop up, then the canopy opens: a slow, swaying fall (GDD §9.0 parachute: 0.6 px/tick).
      this.vy = this.t < 14 ? this.vy + 0.15 : Math.min(this.vy + 0.05, 0.6);
      this.vx *= 0.97;
      this.x += this.vx + Math.sin(this.t / 18 + this.sway) * 0.35;
      const ny = this.y + this.vy;
      const floor = this.vy > 0 ? w.terrain.surfaceY(this.x, this.y - 1, ny) : Infinity;
      if (Number.isFinite(floor)) {
        this.y = floor;
        this.landed = true;
        dust(w, this.x, this.y, 3);
        // Run off toward the nearer view edge.
        this.facing = this.x < w.camera.centerX ? -1 : 1;
      } else this.y = ny;
      if (this.y > w.camera.bottom + 48) this.remove();
      return;
    }
    this.landT++;
    this.x += this.facing * 1.4;
    if (this.landT > 150) {
      poof(w, this.x, this.y - 12);
      this.remove();
    }
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = this.facing < 0;
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    if (this.landed) r.sprite(this.run, Math.floor(this.landT / 4), x, y, drawOpts);
    else r.sprite(this.chute, Math.floor(this.t / 20), x, y, drawOpts);
  }

  /** Sprite prefix (for tests). */
  get artPrefix(): string {
    return this.art;
  }
}
