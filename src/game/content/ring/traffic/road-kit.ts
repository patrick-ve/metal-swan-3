/**
 * Shared helpers of the ROAD content (traffic, hazards, items, scooter; docs/design/ring.md §5,
 * §7, §8), on the core's entity helpers (src/game/ring/entity.ts):
 *
 * - `drivenWagons(world)`: the wagons in play (driven, not driving in), a reused array.
 * - `wagonSlab(w, out)` / `slabsTouch(a, b)`: the depth-slab test every road thing uses (x AND
 *   depth overlap, spec §2).
 * - `RingLayer`: a child entity that draws one layer of its owner at another depth (a gantry's far
 *   post behind lane 1, its near post in front of lane 4; a closure's yellow lines on the road).
 * - `PlaneTumbler`: something knocked into the air over the plane (a cone, a rider, a cage door):
 *   it flies with a drawn lift, bounces on the road, lies there and fades.
 * - The jam state (`jamOf`): the jam controller (hazards/jam.ts) sets its level 0 … 1; civilian
 *   cars brake with it (traffic/car.ts).
 * - `ringRng(seed)`: a deterministic stream for content that expands its own plan entry (the jam's
 *   cars), so the result depends on the plan only, never on combat.
 */
import { Entity } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import { Rng } from '../../../../engine/rng';
import { frameCount, hasSprite } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import { FX_SPARK } from '../../../fx';
import type { RingDrawable } from '../../../ring/entity';
import { GROUND_Y } from '../../../ring/lanes';
import type { Wagon } from '../../../ring/wagon';

// ---------------------------------------------------------------------------------------------
// Wagons
// ---------------------------------------------------------------------------------------------

/** What the road reads from a wagon (the core's `Wagon`; duck-typed reads keep the tests light). */
export type RoadWagon = Wagon;

const wagonsOut: Wagon[] = [];

/**
 * The wagons in play: driven, with a hero, not driving in, not scripted (the boarding, the exit)
 * — a reused array: copy to keep it.
 */
export function drivenWagons(world: World): readonly Wagon[] {
  wagonsOut.length = 0;
  const list = world.byTag('ring-wagon');
  for (let i = 0; i < list.length; i++) {
    const w = list[i] as Wagon;
    if (!w.alive || w.state !== 'driven' || w.arriving || w.scripted || !w.driver) continue;
    wagonsOut.push(w);
  }
  return wagonsOut;
}

/** The hero slot of a wagon (−1 without a hero). */
export function wagonSlot(w: Wagon): number {
  return w.driver ? w.driver.index : -1;
}

/** The depth slab of a wagon (its hurt box). */
export function wagonSlab(w: Wagon): Rect {
  return w.hurtboxes()[0];
}

/** Do two slabs overlap (x and depth)? */
export function slabsTouch(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Nearest driven wagon to (x, y) by plane distance (depth counts triple), or null. */
export function nearestWagon(world: World, x: number, y: number): Wagon | null {
  const list = drivenWagons(world);
  let best: Wagon | null = null;
  let bd = Infinity;
  for (let i = 0; i < list.length; i++) {
    const w = list[i];
    const d = Math.abs(w.x - x) + Math.abs(w.y - y) * 3;
    if (d < bd) {
      bd = d;
      best = w;
    }
  }
  return best;
}

/**
 * An enemy vehicle still entering (mode `enter`) after this many ticks while it is fully off
 * screen gives up and is removed (no score). Traffic boxed it in behind or ahead of the view, the
 * player never saw it, and the director counted it as present (review B, 2026-10-21: vans, motos
 * and tow trucks waited off screen for 5–15 s). A leaving one is removed past either edge.
 */
export const ENTER_GIVE_UP = 300;

// ---------------------------------------------------------------------------------------------
// Layers at another depth
// ---------------------------------------------------------------------------------------------

/** An owner that draws layer `k` for its `RingLayer` children. */
export interface Layered extends Entity {
  drawLayer(r: Renderer, k: number): void;
}

/**
 * A child that draws layer `k` of its owner at plane y `y` (the runner sorts by `y · 100 + z`):
 * it follows the owner's x and leaves with it.
 */
export class RingLayer extends Entity {
  readonly owner: Layered;
  readonly k: number;

  constructor(world: World, owner: Layered, k: number, y: number, z = 10) {
    super(world, owner.x, y);
    this.owner = owner;
    this.k = k;
    this.z = z;
    this.team = 'neutral';
    this.hitbox = { ...owner.hitbox };
    this.despawnMargin = Infinity;
  }

  override update(): void {
    if (this.owner.removed) {
      this.remove();
      return;
    }
    this.x = this.owner.x;
  }

  override draw(r: Renderer): void {
    if (!this.owner.removed) this.owner.drawLayer(r, this.k);
  }
}

// ---------------------------------------------------------------------------------------------
// Tumblers
// ---------------------------------------------------------------------------------------------

export interface TumbleSpec {
  sprite: string;
  /** World velocity (x) and plane velocity (y), px/tick. */
  vx: number;
  vy: number;
  /** Lift and its speed (up = +), gravity on the lift. */
  lift?: number;
  vlift: number;
  gravity?: number;
  /** Bounces left (each keeps `bounce` of the speed). */
  bounces?: number;
  bounce?: number;
  /** Ticks it lies still before it fades (16 ticks of blinking), and its frame while lying. */
  rest?: number;
  restFrame?: number;
  /** A strip it plays while lying instead (a rider sitting up dazed). */
  restSprite?: string;
  /** Ticks per frame of the tumble (loops) while airborne. */
  tpf?: number;
  /** Play the strip once while airborne and hold its last frame (a door tipping flat), not loop. */
  once?: boolean;
  /** A sound on the first touchdown (a door's clang). */
  landSfx?: string;
  /** Sparks while it slides on the road after landing (a steel door): the spark x offset. */
  scrapeAt?: number;
  /** Stop on the hard shoulder (riders) instead of anywhere on the road. */
  shoulder?: boolean;
  /** Draw order tie-break and a road shadow width. */
  z?: number;
  shadowW?: number;
  flipX?: boolean;
}

const tumbleOpts: DrawOpts = {};

/**
 * A thing knocked into the air over the plane (bloodless: riders tumble onto the hard shoulder).
 * World x is road distance: it slows to a stop on the road (vx → 0), so it drifts back on screen.
 */
export class PlaneTumbler extends Entity implements RingDrawable {
  lift: number;
  shadowW: number;
  private vlift: number;
  private readonly s: TumbleSpec;
  private bounces: number;
  private restT = 0;
  private t = 0;
  private landed = false;
  private touched = false;

  constructor(world: World, x: number, y: number, s: TumbleSpec) {
    super(world, x, y);
    this.s = s;
    this.lift = s.lift ?? 0;
    this.vlift = s.vlift;
    this.vx = s.vx;
    this.vy = s.vy;
    this.bounces = s.bounces ?? 1;
    this.shadowW = s.shadowW ?? 10;
    this.z = s.z ?? 33;
    this.team = 'neutral';
    this.hitbox = { x: -8, y: -16, w: 16, h: 16 };
    this.despawnMargin = 48;
  }

  override update(): void {
    this.t++;
    const s = this.s;
    if (!this.landed) {
      this.x += this.vx;
      this.y += this.vy;
      if (s.shoulder && this.y > GROUND_Y - 2) {
        this.y = GROUND_Y - 2;
        this.vy = 0;
      }
      this.vlift -= s.gravity ?? 0.22;
      this.lift += this.vlift;
      if (this.lift <= 0) {
        this.lift = 0;
        if (s.landSfx && !this.touched) this.world.audio.sfx(s.landSfx, { vol: 0.7 });
        this.touched = true;
        if (this.bounces-- > 0 && Math.abs(this.vlift) > 0.8) {
          this.vlift = -this.vlift * (s.bounce ?? 0.4);
          this.vx *= 0.6;
          this.vy *= 0.5;
        } else {
          this.landed = true;
          this.vlift = 0;
        }
      }
      return;
    }
    // Lying on the road: it slides to a stop, waits, then blinks out.
    this.vx *= 0.85;
    this.vy *= 0.7;
    if (s.shoulder && this.y < GROUND_Y - 3) this.vy = 0.6;
    this.x += this.vx;
    this.y += this.vy;
    if (s.scrapeAt !== undefined && this.vx > 0.5 && this.restT % 2 === 0) this.world.particles.burst(FX_SPARK, this.x + s.scrapeAt, this.y - 1, 3, 0.6, 2.2, Math.PI + 0.35, 0.9);
    if (++this.restT > (s.rest ?? 60) + 16) this.remove();
  }

  override draw(r: Renderer): void {
    const s = this.s;
    if (this.landed && this.restT > (s.rest ?? 60) && this.restT % 4 < 2) return;
    const id = this.landed && s.restSprite && hasSprite(s.restSprite) ? s.restSprite : s.sprite;
    if (!hasSprite(id)) return;
    const n = frameCount(id);
    let f: number;
    if (id !== s.sprite) f = Math.floor(this.restT / 30) % n;
    else if (this.landed) f = Math.min(n - 1, s.restFrame ?? 0);
    else f = s.once ? Math.min(n - 1, Math.floor(this.t / (s.tpf ?? 4))) : Math.floor(this.t / (s.tpf ?? 4)) % n;
    tumbleOpts.flipX = s.flipX === true;
    r.sprite(id, f, Math.round(this.x), Math.round(this.y - this.lift), tumbleOpts);
  }
}

/** Throw a tumbler into the world. */
export function tumbleOff(world: World, x: number, y: number, s: TumbleSpec): PlaneTumbler {
  const t = new PlaneTumbler(world, x, y, s);
  world.add(t);
  return t;
}

// ---------------------------------------------------------------------------------------------
// The jam state
// ---------------------------------------------------------------------------------------------

/** The traffic jam's state of a world (hazards/jam.ts writes it). */
export interface JamState {
  /** 0 = free flow … 1 = everything stands still with the road. */
  level: number;
  /** The jam controller running (null when none). */
  owner: Entity | null;
}

const jams = new WeakMap<World, JamState>();

/** The jam state of a world (created on first use). */
export function jamOf(world: World): JamState {
  let j = jams.get(world);
  if (!j) {
    j = { level: 0, owner: null };
    jams.set(world, j);
  }
  return j;
}

// ---------------------------------------------------------------------------------------------
// Plan-side randomness
// ---------------------------------------------------------------------------------------------

/** A deterministic stream for content that expands its plan entry (the same entry → the same stream). */
export function ringRng(seed: number, salt: string): Rng {
  return new Rng(Math.floor(seed) >>> 0).fork(salt);
}
