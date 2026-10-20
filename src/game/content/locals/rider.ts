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
 * Water: a rider (or its body) whose bike leaves the ground over deep water falls in — a splash,
 * gone, no score of its own (docs/design/ams-extras.md §7.4).
 * Vehicles: a driven player vehicle that touches a rider breaks it (GDD §8.5), in reactions too.
 * The gloat (every player out, docs/design/ams-extras.md §1): `gloatRideIn` keeps a rider in view,
 * `floorAhead` keeps it on its own floor; the subclasses wheelie (fatbike) or circle and check the
 * phone (delivery).
 */
import type { Damage, Entity } from '../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../engine/render';
import { rectAt, type Rect } from '../../../engine/math';
import type { World } from '../../../engine/world';
import { gagBubble, type ReactionKind } from '../../enemy';
import { FxEntity, splash } from '../../fx';
import { waterRectAt } from '../../water';
import { paramStr, type SpawnParams } from '../../registry';
import { Creature, contactHit, entryParam } from '../creatures/common';

/** The shared gag bubble (enemy.ts): no line over another live gag bubble within 56 × 32 px. */
export { gagBubble };

/** The kick box relative to the anchor (facing right; flipped with the facing). */
export const KICK_BOX: Readonly<Rect> = { x: 4, y: -22, w: 20, h: 16 };
/** Rider hurtbox (bike + rider, 24 × 34). */
export const RIDER_BOX = { w: 24, h: 34 } as const;

/** The gloat: a rider keeps this far (px) inside the view edges; a deep water rect is this deep or more. */
export const RIDER_GLOAT = { edge: 24, inSpeed: 0.8, deep: 16, sink: 4 } as const;

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
    if (this.removed || this.fallsInWater()) return;
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

  /**
   * A rider or its body whose bike left the ground over deep water (its feet `sink` px under the
   * surface of a water rect at least `deep` px deep) falls in: a splash, removed. It scores nothing
   * itself (a player's hit that killed it already scored). Returns true when it fell in.
   */
  private fallsInWater(): boolean {
    const b = this.body;
    if (!b || b.onGround) return false;
    const h = waterRectAt(this.world, this.x, this.y);
    if (!h || h.h < RIDER_GLOAT.deep || this.y < h.y + RIDER_GLOAT.sink) return false;
    splash(this.world, this.x, h.y, 10);
    this.world.audio.sfx('env/water-splash', { vol: 0.8 });
    this.remove();
    return true;
  }

  /** A reaction (SAY CHEESE, the gloat, the cower) never stops a driven vehicle breaking the rider. */
  protected override thinkReaction(kind: ReactionKind): void {
    if (this.bumpVehicles()) return;
    super.thinkReaction(kind);
  }

  /**
   * Is there floor at the rider's own height `dist` px ahead in `dir` (no wall, no drop, no water)?
   * The gloat moves only over such floor.
   */
  protected floorAhead(dir: number, dist = 16): boolean {
    const t = this.world.terrain;
    const ax = this.x + dir * dist;
    if (t.isSolid(ax, this.y - 12)) return false;
    const f = t.surfaceY(ax, this.y - 6, this.y + 6);
    return Number.isFinite(f) && Math.abs(f - this.y) <= 3 && waterRectAt(this.world, ax, f - 1) === null;
  }

  /**
   * The gloat keeps a rider in view: within `RIDER_GLOAT.edge` px of a view edge it rides slowly
   * in (over its own floor). Returns true while it rides in.
   */
  protected gloatRideIn(): boolean {
    const cam = this.world.camera;
    const dir = this.x < cam.left + RIDER_GLOAT.edge ? 1 : this.x > cam.right - RIDER_GLOAT.edge ? -1 : 0;
    if (dir === 0 || !this.floorAhead(dir)) return false;
    this.facing = dir;
    this.pedal(RIDER_GLOAT.inSpeed);
    return true;
  }

  /** The default gloat of a rider: in view, stopped, facing the spot, its `gloat` strip. */
  protected override thinkGloat(spot: Entity | null, t: number): void {
    if (this.gloatRideIn()) return;
    super.thinkGloat(spot, t);
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
