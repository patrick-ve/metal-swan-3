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
 * Turns: every facing change (U-turn, circle end, wall) plays the 3-frame `turn` strip (narrowing
 * with the old facing, widening with the new) — a draw-only timer; the logic facing flips at once.
 * A tell or kick cancels it on the same tick.
 * Deaths: the rider tumbles off (`die*` strips), the bike skids away as an fx (`<art>/bike`).
 */
import type { Damage } from '../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../engine/render';
import { rectAt, type Rect } from '../../../engine/math';
import type { World } from '../../../engine/world';
import { hudOf } from '../../context';
import { FxEntity } from '../../fx';
import { paramStr, type SpawnParams } from '../../registry';
import { Creature, contactHit, entryParam } from '../creatures/common';

/**
 * A gag bubble over `e`, unless another live gag bubble already hangs within 56 × 32 px (two
 * riders side by side would print their lines on top of each other). Returns false when skipped.
 * A shown line is voiced by its `speaker`'s sample when one is loaded (`HudState.onBubble`).
 */
export function gagBubble(world: World, e: { x: number; y: number }, text: string, ticks: number, speaker = ''): boolean {
  const list = hudOf(world).bubbles;
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (b.kind !== 'gag' || b.ticks <= 0 || b.target === e) continue;
    if (Math.abs(b.target.x - e.x) < 56 && Math.abs(b.target.y - e.y) < 32) return false;
  }
  hudOf(world).bubble(e, text, { ticks, kind: 'gag', speaker: speaker || undefined });
  return true;
}

/** The kick box relative to the anchor (facing right; flipped with the facing). */
export const KICK_BOX: Readonly<Rect> = { x: 4, y: -22, w: 20, h: 16 };
/** Rider hurtbox (bike + rider, 24 × 34). */
export const RIDER_BOX = { w: 24, h: 34 } as const;

/** Turn strip: frames and ticks per frame (the strip plays forward, then backward). */
export const RIDER_TURN = { frames: 3, ticksPerFrame: 2 } as const;
const TURN_TICKS = 2 * RIDER_TURN.frames * RIDER_TURN.ticksPerFrame;
const turnOpts: DrawOpts = {};

export interface RiderOpts {
  art: string;
  hp: number;
  score: number;
}

export abstract class Rider extends Creature {
  /** One sprite per draw: drawn at the sub-pixel position (Enemy.fineDraw). */
  protected override fineDraw = true;

  protected readonly kickHit: Damage;
  protected readonly touch: Damage;
  private readonly kickBoxes: Rect[] = [{ x: 0, y: 0, w: 0, h: 0 }];
  private readonly noBoxes: Rect[] = [];
  /** Ticks of the running telegraph (difficulty-scaled). */
  protected telegraph = 20;
  /** Who speaks the rider's lines (the voice sample's speaker). */
  protected speaker = '';
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

  /** Draw-only turn timer (ticks left), the facing it turns from, last tick's facing. */
  private turnT = 0;
  private turnFrom: 1 | -1 = 1;
  private lastFacing: 1 | -1 | 0 = 0;

  override update(): void {
    super.update();
    if (this.dead || this.mode === 'tell' || this.mode === 'kick') {
      this.turnT = 0;
    } else if (this.lastFacing !== 0 && this.facing !== this.lastFacing && this.hasAnim('turn')) {
      this.turnFrom = this.lastFacing;
      this.turnT = TURN_TICKS;
    } else if (this.turnT > 0) this.turnT--;
    this.lastFacing = this.facing < 0 ? -1 : 1;
  }

  /** The turn frame index (0..frames − 1) and its facing, or −1 when not turning. */
  turnFrame(): number {
    if (this.turnT <= 0) return -1;
    const k = Math.floor((TURN_TICKS - this.turnT) / RIDER_TURN.ticksPerFrame);
    return k < RIDER_TURN.frames ? k : 2 * RIDER_TURN.frames - 1 - k;
  }

  override draw(r: Renderer): void {
    const i = this.turnFrame();
    if (i < 0) return super.draw(r);
    const k = Math.floor((TURN_TICKS - this.turnT) / RIDER_TURN.ticksPerFrame);
    turnOpts.flipX = (k < RIDER_TURN.frames ? this.turnFrom : this.facing) < 0;
    turnOpts.flash = this.flashTicks > 0;
    r.sprite(this.spriteId('turn'), i, this.x, this.y, turnOpts);
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
    gagBubble(this.world, this, bubble, Math.min(40, this.telegraph + 10), this.speaker);
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
    this.world.audio.sfx('ams/rider-crash');
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
