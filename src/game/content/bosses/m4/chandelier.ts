/**
 * `chandelier` (GDD §9.5 prop, §10.4): a crystal chandelier 32 × 24 hanging on a chain from the top
 * of the view. THE GRAND GRAND's High C and Grand Aria drop it: it shakes and its shadow shows on
 * the floor below (the telegraph), falls, crushes everything in a 48 × 24 impact zone, then lies on
 * the stage as a solid 32 × 16 for 300 ticks (players may stand on it) and blinks out.
 *
 * Spawn: `world.spawn('chandelier', x, y)` — x = the middle, y = the top of the crystal (GDD: the
 * chandeliers hang at y 0–30, so y 6). The boss looks for `chandelier`s inside its arena and hangs
 * its own three (GDD x 1460, 1580, 1700 = view 60, 180, 300) when there are none.
 */
import { Entity, type Damage } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import { SolidBox } from '../../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { debris, drawShadow, dust, explosion } from '../../../fx';
import { defineEntity, type SpawnParams } from '../../../registry';
import { BOSS_TAGS, hitPlayersInRect } from './shots';

export const CHANDELIER = { w: 32, h: 24, impactW: 48, impactH: 24, solidW: 32, solidH: 16, solidTicks: 300 } as const;

export type ChandelierState = 'hang' | 'shake' | 'fall' | 'down' | 'gone';

const opts: DrawOpts = {};

export class Chandelier extends Entity {
  state: ChandelierState = 'hang';
  /** Ticks left in the current state (shake: the telegraph; down: the solid's life). */
  timer = 0;
  /** The floor it falls onto (found when the telegraph starts). */
  floorY = 176;
  /** The top of its hanging spot. */
  readonly hangY: number;
  private shakeTotal = 1;
  private box: SolidBox | null = null;
  private readonly impactRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly hit: Entity[] = [];
  readonly dmg: Damage = { amount: 10, kind: 'impact', dirX: 0, tags: BOSS_TAGS };

  constructor(world: World, x: number, y: number, _p: SpawnParams) {
    super(world, x, y);
    this.hangY = y;
    this.team = 'neutral';
    this.z = 28;
    this.despawnMargin = Infinity;
    this.hitbox = { x: -CHANDELIER.w / 2, y: 0, w: CHANDELIER.w, h: CHANDELIER.h };
    this.addTag('prop', 'chandelier');
    this.dmg.source = this;
  }

  /** Still hanging (High C may pick it). */
  get available(): boolean {
    return this.state === 'hang';
  }

  /** The floor under the chandelier (platforms count: it lands on a balcony box). */
  findFloor(): number {
    const f = this.world.terrain.surfaceY(this.x, this.hangY + CHANDELIER.h + 2);
    return Number.isFinite(f) ? f : 176;
  }

  /** Start the telegraph: it shakes for `ticks` and its shadow shows; then it falls. */
  drop(ticks: number): void {
    if (this.state !== 'hang') return;
    this.state = 'shake';
    this.timer = Math.max(1, ticks);
    this.shakeTotal = this.timer;
    this.floorY = this.findFloor();
    this.world.audio.sfx('enemy/triangle', { vol: 0.6, pitch: 1.9 });
  }

  /** The charging piano rolls through it: it shatters at once. */
  shatter(): void {
    if (this.state !== 'down') return;
    this.clearSolid();
    debris(this.world, this.x, this.y - 8, 'metal', 6);
    this.world.audio.sfx('enemy/triangle', { vol: 0.6, pitch: 2.4 });
    this.state = 'gone';
    this.remove();
  }

  override update(): void {
    switch (this.state) {
      case 'hang':
        return;
      case 'shake':
        if (this.timer % 12 === 0) this.world.audio.sfx('enemy/triangle', { vol: 0.35, pitch: 2.2 });
        if (--this.timer <= 0) {
          this.state = 'fall';
          this.vy = 1;
        }
        return;
      case 'fall': {
        this.vy = Math.min(this.vy + 0.4, 8);
        this.y += this.vy;
        // The impact zone travels with the crystal for the last part of the fall.
        const r = this.impactRect;
        r.w = CHANDELIER.impactW;
        r.h = CHANDELIER.impactH;
        r.x = this.x - r.w / 2;
        r.y = Math.min(this.floorY, this.y + CHANDELIER.h) - r.h;
        if (this.y + CHANDELIER.h >= this.floorY - r.h) hitPlayersInRect(this.world, r, this.dmg, this.hit);
        if (this.y + CHANDELIER.h >= this.floorY) this.land();
        return;
      }
      case 'down':
        if (--this.timer <= 0) {
          this.clearSolid();
          this.state = 'gone';
          dust(this.world, this.x, this.floorY, 3);
          this.remove();
        }
        return;
      default:
        return;
    }
  }

  private land(): void {
    this.state = 'down';
    this.timer = CHANDELIER.solidTicks;
    this.y = this.floorY;
    const w = this.world;
    w.camera.shake(3, 10);
    w.audio.sfx('machine/piano-crash', { vol: 0.7, pitch: 1.5 });
    w.audio.sfx('enemy/triangle', { vol: 0.7, pitch: 2.6 });
    explosion(w, this.x, this.floorY - 6, 's', { silent: true, debris: null, shake: 0 });
    debris(w, this.x, this.floorY - 8, 'metal', 8);
    dust(w, this.x - 12, this.floorY, 3);
    dust(w, this.x + 12, this.floorY, 3);
    // The solid heap: a player standing on the spot is nudged aside (it never crushes).
    const x0 = Math.round(this.x - CHANDELIER.solidW / 2);
    const y0 = Math.round(this.floorY - CHANDELIER.solidH);
    for (const p of w.players) {
      if (!p.alive) continue;
      const half = (p.hitbox.w || 14) / 2;
      if (p.x + half > x0 && p.x - half < x0 + CHANDELIER.solidW && p.y > y0 + 2) {
        p.x = p.x < this.x ? x0 - half - 1 : x0 + CHANDELIER.solidW + half + 1;
      }
    }
    this.box = w.addSolid(new SolidBox(x0, y0, CHANDELIER.solidW, CHANDELIER.solidH, false, this));
    this.hitbox = { x: -CHANDELIER.solidW / 2, y: -CHANDELIER.solidH, w: CHANDELIER.solidW, h: CHANDELIER.solidH };
  }

  private clearSolid(): void {
    if (this.box) this.world.removeSolid(this.box);
    this.box = null;
  }

  override onRemove(): void {
    this.clearSolid();
  }

  override draw(r: Renderer): void {
    const tick = this.world.tick;
    opts.flipX = false;
    opts.flash = false;
    if (this.state === 'down') {
      if (this.timer < 40 && (tick & 2) === 0) return;
      r.sprite('prop/chandelier/fallen', 0, Math.round(this.x), Math.round(this.y), opts);
      return;
    }
    if (this.state === 'gone') return;
    // The telegraph: the shadow grows on the floor below while it shakes.
    if (this.state === 'shake' || this.state === 'fall') {
      const k = this.state === 'fall' ? 1 : 1 - this.timer / this.shakeTotal;
      drawShadow(r, this.x, this.floorY, 16 + Math.round(k * 32), 0.3 + 0.3 * k);
    }
    const sway = this.state === 'shake' ? ((tick >> 1) & 1 ? 2 : -2) : Math.round(Math.sin(tick / 40 + this.x) * 1);
    const x = Math.round(this.x + sway);
    const y = Math.round(this.y);
    // The chain from the top of the view (it stays up when the chandelier falls).
    const top = Math.floor(this.world.camera.top / 8) * 8 - 8;
    const chainEnd = this.state === 'fall' ? this.hangY - 2 : y;
    for (let cy = top; cy < chainEnd; cy += 8) r.sprite('prop/chandelier/chain', 0, this.state === 'fall' ? Math.round(this.x) : x, cy, opts);
    r.sprite('prop/chandelier/idle', (tick >> 5) & 1, x, y, opts);
  }
}

defineEntity('chandelier', (w, x, y, p) => new Chandelier(w, x, y, p), {
  category: 'prop',
  description: 'GRAND GRAND prop: a crystal chandelier 32 × 24 that falls on High C / Grand Aria (impact 48 × 24, then a solid 32 × 16 for 300 ticks).',
});
