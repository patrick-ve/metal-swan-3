/**
 * The shared base of the convoy enemies (docs/design/ring.md §5.3; GDD §4.11 fairness), on the
 * scooter's pattern (content/ring/scooter/scooter.ts): an `Enemy` with `body: false` that moves in
 * the plane itself (world x = road distance, its own road speed; `ringOf(world)` null in a plain
 * world: inert-safe), hurt through its depth slab, attacks only with its whole body on screen and an
 * attack token, a tell of at least 18 ticks (`telegraphTicks`), modes named `tell-<x>` → `<x>` (the
 * sim's fairness watch), leaves after its stay (an unshot enemy never piles up), drops a ring crate,
 * gloats without pointing or laughing and cowers when a hero drops back in.
 *
 * Big vehicles (the scan car, the tow truck) are tagged `ring-block` (civilians keep a gap behind
 * them, scooters do not change lanes into them) and shove a wagon that drives into them out again
 * with a light bump (`pushWagons`).
 */
import type { Entity } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import type { World } from '../../../../engine/world';
import { Enemy, releaseAttackToken, takeAttackToken, type EnemyOpts, type ReactionKind } from '../../../enemy';
import { hitSpark } from '../../../fx';
import { NO_PARAMS, type SpawnParams } from '../../../registry';
import { ringOf, slabBoxes, slabCache, type RingDrawable } from '../../../ring/entity';
import { RING_ENTITY } from '../../../ring/ids';
import { clampLane, LANE_COUNT, laneY, nearestLane } from '../../../ring/lanes';
import { wagonBandEnd, WAGON_W, type Wagon } from '../../../ring/wagon';
import { drivenWagons, nearestWagon, slabsTouch, wagonSlab } from '../traffic/road-kit';
import { CONVOY_TAG } from './geometry';

const NO_BOXES: readonly Rect[] = [];

/** What blocks a lane beside a convoy vehicle and its lane ahead. */
const BLOCK_TAGS: readonly string[] = ['ring-car', 'ring-closure', 'ring-block', 'ring-wagon'];

/** A rear-ending this fast (px/tick closing) costs ½ cell (traffic/car.ts uses 1.4 for its hard bump). */
const BUMP_HARD = 1.4;

export abstract class ConvoyEnemy extends Enemy implements RingDrawable {
  /** The AI mode (the sim's watch reads `tell-<x>` → `<x>`). */
  mode = 'enter';
  modeT = 0;
  lift = 0;
  shadowW = 0;
  shotLift = 0;
  /** The attack token is held (fairness watcher). */
  holdsToken = false;
  laneTarget: number;
  /** Ticks in play (its stay). */
  inPlay = 0;
  protected cool = 0;
  protected prey: Wagon | null = null;
  private readonly slab = slabCache();
  private bumpCool = 0;

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS, o: EnemyOpts) {
    super(world, x, y, p, { ...o, body: false });
    this.laneTarget = nearestLane(y);
    this.y = laneY(this.laneTarget);
    this.facing = 1;
    this.addTag(CONVOY_TAG.convoy);
  }

  override hurtboxes(): readonly Rect[] {
    return this.dead ? NO_BOXES : slabBoxes(this, this.slab);
  }

  override contactBoxes(): readonly Rect[] {
    return NO_BOXES;
  }

  // ------------------------------------------------------------------------------- helpers

  /** Road speed (0 outside the ring). */
  protected get road(): number {
    return ringOf(this.world)?.roadSpeed ?? 0;
  }

  /** Open lanes at this x (4 outside the ring). */
  protected openLanes(x = this.x): number {
    return ringOf(this.world)?.lanesOpenAt(x) ?? LANE_COUNT;
  }

  /** Screen x of the middle. */
  get sx(): number {
    return this.x - this.world.camera.x;
  }

  /** The current plane lane. */
  get lane(): number {
    return nearestLane(this.y);
  }

  protected setMode(m: string): void {
    this.mode = m;
    this.modeT = 0;
  }

  /** The whole body (± half its length, `inset` px more) inside the view. */
  protected wholeOnScreen(inset = 6): boolean {
    const cam = this.world.camera;
    const hb = this.hitbox;
    return this.x + hb.x >= cam.x + inset && this.x + hb.x + hb.w <= cam.x + cam.w - inset;
  }

  /** Take an attack token (GDD §4.11 rule 4). */
  protected takeToken(): boolean {
    if (this.holdsToken) return true;
    if (!takeAttackToken(this.world, this)) return false;
    this.holdsToken = true;
    return true;
  }

  protected releaseToken(): void {
    if (this.holdsToken) releaseAttackToken(this.world, this);
    this.holdsToken = false;
  }

  /** Move the plane y toward the lane target (px/tick). */
  protected steerLane(speed: number): void {
    this.laneTarget = clampLane(this.laneTarget, this.openLanes());
    const dy = laneY(this.laneTarget) - this.y;
    this.y += Math.abs(dy) <= speed ? dy : Math.sign(dy) * speed;
  }

  /**
   * Something in lane `lane` overlapping the x range [x0, x1] (a car, a closure, a block, a
   * wagon), other than this one and `except`?
   */
  protected laneBusy(lane: number, x0: number, x1: number, except: Entity | null = null): boolean {
    const y = laneY(lane);
    for (let k = 0; k < BLOCK_TAGS.length; k++) {
      const list = this.world.byTag(BLOCK_TAGS[k]);
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e === this || e === except || !e.alive || Math.abs(e.y - y) > 8) continue;
        const ex = e.facing < 0 ? e.x - e.hitbox.x - e.hitbox.w : e.x + e.hitbox.x;
        if (x1 > ex && x0 < ex + e.hitbox.w) return true;
      }
    }
    return false;
  }

  /** The nearest thing ahead in its own lane: the gap from its front to that thing's rear (Infinity: none within 200 px). */
  protected gapAhead(front: number): number {
    let best = Infinity;
    for (let k = 0; k < BLOCK_TAGS.length; k++) {
      const list = this.world.byTag(BLOCK_TAGS[k]);
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e === this || !e.alive || Math.abs(e.y - this.y) > 9) continue;
        const rear = e.x + e.hitbox.x;
        const gap = rear - (this.x + front);
        if (gap > -4 && gap < 200 && e.x > this.x) best = Math.min(best, gap);
      }
    }
    return best;
  }

  /** The nearest driven wagon (the target). */
  protected findPrey(): Wagon | null {
    this.prey = nearestWagon(this.world, this.x, this.y);
    return this.prey;
  }

  /**
   * A wagon that drives into this vehicle (its slab touches ours) is shoved out, as a civilian car
   * does it (traffic/car.ts): in line → back behind it (or ahead); from the side (a lane change into
   * it) → back to its lane. Only a hard contact costs (½ cell, a cooldown): a rear-ending closing
   * faster than `BUMP_HARD` px/tick, or a swerve into it; slow contact just blocks.
   */
  protected pushWagons(len: number): void {
    if (this.bumpCool > 0) this.bumpCool--;
    const mine = this.hurtboxes()[0];
    if (!mine || !this.wholeOnScreen(-len / 2)) return;
    const list = drivenWagons(this.world);
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      if (w.scripted || !slabsTouch(wagonSlab(w), mine)) continue;
      const dy = w.y - this.y;
      const closing = Math.abs(w.vx - this.vx);
      let hard = w.swerveT > 0;
      if (Math.abs(dy) < 7) {
        hard = hard || closing > BUMP_HARD;
        const end = wagonBandEnd(w);
        if (w.x < this.x && (w.x <= end || this.x - (len / 2 + WAGON_W / 2 + 0.5) < end - 2)) {
          // At the left end of its band the wagon cannot give way: the vehicle is shoved ahead of
          // it (fixer B: wagons were pushed off the screen); a push that would take it past that
          // end takes it only down to it (polish 2026-10-21).
          if (w.x > end) w.x = end - 2;
          this.x = w.x + len / 2 + WAGON_W / 2 + 0.5;
          if (w.sideV > 0) w.sideV = 0;
        } else if (w.x < this.x) {
          w.x = this.x - (len / 2 + WAGON_W / 2 + 0.5);
          if (w.sideV > 0) w.sideV = 0;
        } else {
          w.x = this.x + len / 2 + WAGON_W / 2 + 0.5;
          if (w.sideV < 0) w.sideV = 0;
        }
      } else {
        const open = this.openLanes(w.x);
        w.laneTarget = clampLane(nearestLane(this.y) + (dy < 0 ? -1 : 1), open);
        w.y = this.y + (dy < 0 ? -1 : 1) * 16.5;
      }
      if (!hard || this.bumpCool > 0 || w.invulnTicks > 0) continue;
      this.bumpCool = 40;
      w.bump({ dx: w.x < this.x ? -1.2 : 0.8, cost: 0.5, source: this });
      hitSpark(this.world, (w.x + this.x) / 2, this.y - 10, w.x < this.x ? -1 : 1);
    }
  }

  // ------------------------------------------------------------------------------- reactions

  protected override onReact(_kind: ReactionKind): void {
    this.cancelAttack();
  }

  /** Cancel a running tell or attack (a reaction, the target gone). */
  protected abstract cancelAttack(): void;

  /** Hold its place on screen while it reacts (the road holds while everyone is out). */
  protected override thinkReaction(kind: ReactionKind): void {
    this.facing = 1;
    if (kind === 'gloat') super.thinkReaction(kind);
    else this.react1(kind);
    this.vx = this.road + this.reactRel;
    this.x += this.vx;
    this.reactRel = 0;
  }

  /** Screen speed for this reaction tick (the gloat may move a little toward its spot). */
  protected reactRel = 0;

  /** One tick of a reaction that is not the gloat (default: the cower strip, if any). */
  protected react1(kind: ReactionKind): void {
    if (this.hasAnim(this.reactionAnim(kind))) this.play(this.reactionAnim(kind));
  }

  // ------------------------------------------------------------------------------- death and drops

  /** The drop falls as a ring crate (`drop` param; `always`: a crate with the ring roll when none). */
  protected dropCrate(always: boolean): void {
    const spec = this.drop;
    this.drop = null;
    if (!spec && !always) return;
    const value = spec ? (spec.id === 'loot' ? spec.params?.contains ?? 'auto' : spec.id === RING_ENTITY.crate ? spec.params?.contains : spec) : undefined;
    const p: SpawnParams = { dropped: true, vx: this.road * 0.5, lift: 18, vlift: 2.4 };
    if (value !== undefined) (p as Record<string, unknown>).contains = value;
    this.world.spawn(RING_ENTITY.crate, this.x, this.y, p);
  }

  override onRemove(): void {
    this.releaseToken();
    super.onRemove();
  }
}
