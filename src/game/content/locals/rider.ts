/**
 * Shared base of the Amsterdam riders (`fatbike-youth`, `delivery-rider`; docs/design/amsterdam.md
 * §2): a person on a bike, soft (the knife works), with a physics body.
 *
 * Fairness (GDD §4.11): a rider holds an attack token from its telegraph to the end of its kick;
 * the telegraph starts only inside the view (8 px margin) and runs at least 18 ticks; the kick
 * is the ONLY thing that hurts: `contactBoxes()` returns the kick box (ahead of the bike at
 * shin / knee height, y −22 … −6 above the wheels' ground line) and `contactDamage` is set only
 * during the kick's active ticks. Bumping into the bike is harmless; a jump clears the kick.
 *
 * Modes (traced by the arena tool): gag, notice, ride, tell, kick, away, turn.
 * Deaths: the rider tumbles off (`die*` strips), the bike skids away as an fx (`<art>/bike`).
 */
import type { Damage } from '../../../engine/entity';
import { rectAt, type Rect } from '../../../engine/math';
import type { World } from '../../../engine/world';
import { hudOf } from '../../context';
import { FxEntity } from '../../fx';
import { paramStr, type SpawnParams } from '../../registry';
import { Creature, contactHit, entryParam } from '../creatures/common';

/**
 * A gag bubble over `e`, unless another live gag bubble already hangs within 56 × 32 px (two
 * riders side by side would print their lines on top of each other). Returns false when skipped.
 */
export function gagBubble(world: World, e: { x: number; y: number }, text: string, ticks: number): boolean {
  const list = hudOf(world).bubbles;
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (b.kind !== 'gag' || b.ticks <= 0 || b.target === e) continue;
    if (Math.abs(b.target.x - e.x) < 56 && Math.abs(b.target.y - e.y) < 32) return false;
  }
  hudOf(world).bubble(e, text, { ticks, kind: 'gag' });
  return true;
}

/** The kick box relative to the anchor (facing right; flipped with the facing). */
export const KICK_BOX: Readonly<Rect> = { x: 4, y: -22, w: 20, h: 16 };
/** Rider hurtbox (bike + rider, 24 × 34). */
export const RIDER_BOX = { w: 24, h: 34 } as const;

export interface RiderOpts {
  art: string;
  hp: number;
  score: number;
}

export abstract class Rider extends Creature {
  protected readonly kickHit: Damage;
  protected readonly touch: Damage;
  private readonly kickBoxes: Rect[] = [{ x: 0, y: 0, w: 0, h: 0 }];
  private readonly noBoxes: Rect[] = [];
  /** Ticks of the running telegraph (difficulty-scaled). */
  protected telegraph = 20;
  /** Bike speed before death (the wreck carries it on). */
  protected lastSpeed = 0;
  /** Ticks the bike has been blocked by a wall. */
  private stuck = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams, o: RiderOpts) {
    super(world, x, y, p, { art: o.art, hp: o.hp, w: RIDER_BOX.w, h: RIDER_BOX.h, score: o.score });
    this.kickHit = { amount: 10, kind: 'impact', dirX: 1, source: this };
    this.touch = contactHit(this, 'bullet');
    this.corpseTicks = 40;
    const entry = entryParam(p) || paramStr(p, 'from', '');
    const t = world.nearestPlayer(this.x, this.y);
    if (entry === 'left' || entry === 'behind') this.facing = 1;
    else if (entry === 'right') this.facing = -1;
    else if (p.facing === 1 || p.facing === 'right') this.facing = 1;
    else if (p.facing === -1 || p.facing === 'left') this.facing = -1;
    else this.facing = t && t.x < this.x ? -1 : 1;
  }

  /** Only the kick hurts (and only while `contactDamage` is set, during the kick). */
  override contactBoxes(): readonly Rect[] {
    if (!this.contactDamage) return this.noBoxes;
    rectAt(this.x, this.y, KICK_BOX, this.facing < 0, this.kickBoxes[0]);
    return this.kickBoxes;
  }

  /** Signed distance to the target along the facing (+ = ahead), or NaN without a target. */
  protected ahead(): number {
    const t = this.target();
    return t ? (t.x - this.x) * this.facing : NaN;
  }

  /** Is the rider (its upper body) inside the view, 8 px in from the edges (rule 3)? */
  protected visible(): boolean {
    return this.inView(this.x, this.y - 20, -8);
  }

  /** Ride at `speed` along the facing; turn at walls. */
  protected pedal(speed: number, anim = 'ride'): void {
    this.vx = speed * this.facing;
    this.lastSpeed = speed;
    this.play(anim);
    const terr = this.world.terrain;
    if (terr.isSolid(this.x + this.facing * 15, this.y - 12)) {
      if (++this.stuck > 4) {
        this.facing = this.facing > 0 ? -1 : 1;
        this.stuck = 0;
      }
    } else this.stuck = 0;
  }

  /** Start the telegraph: anim, sound, bubble. */
  protected startTell(base: number, sfx: string, bubble: string): void {
    this.telegraph = this.tele(base);
    this.setMode('tell');
    this.play('tell', { restart: true });
    this.world.audio.sfx(sfx);
    gagBubble(this.world, this, bubble, Math.min(40, this.telegraph + 10));
  }

  /** Start the kick (its box is live for `active` ticks, see thinkKick). */
  protected startKick(): void {
    this.setMode('kick');
    this.play('kick', { restart: true });
    this.world.audio.sfx('ams/kick');
  }

  /** One kick tick: the box is live while modeT ≤ active. Returns true when the kick is over. */
  protected thinkKick(active: number, speed: number): boolean {
    this.vx = speed * this.facing;
    if (this.modeT <= active) {
      this.kickHit.dirX = this.facing;
      this.contactDamage = this.kickHit;
    }
    return this.modeT >= active;
  }

  /** A small enemy touching a driven vehicle breaks on it (GDD §8.5). */
  protected bumpVehicles(): boolean {
    this.touch.dirX = this.facing;
    return this.breakOnVehicle(this.touch);
  }

  protected override cancelAttack(): void {
    this.releaseToken();
    this.contactDamage = null;
    if (this.mode === 'tell' || this.mode === 'kick') this.setMode('away');
  }

  // ------------------------------------------------------------------------------- death

  /** Hook for the bike wreck: it skids on along the old heading and fades. */
  protected wreckBike(): void {
    FxEntity.spawn(this.world, {
      sprite: `${this.art}/bike`,
      x: this.x,
      y: this.y,
      vx: this.facing * Math.max(0.8, this.lastSpeed),
      drag: 0.95,
      flipX: this.facing < 0,
      z: 29,
    });
  }
}
