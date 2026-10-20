/**
 * Ring entity helpers (docs/design/ring.md §2, §13; docs/api/ring.md §4).
 *
 * - DEPTH SLABS: a ring entity keeps `hitbox` as its VISUAL box (bubbles, popups, despawn, the
 *   view checks) and overrides `hurtboxes()` / `contactBoxes()` with a thin slab of ±`DEPTH_HALF`
 *   px around its plane y. The world's shot pass, `damageArea` and the contact pass then need
 *   overlap in x and in depth, unchanged. `RingEntity` does this; subclasses of `Enemy`,
 *   `Vehicle`, `Boss` call `slabBoxes` from their own overrides.
 * - LIFT: height above the road, drawn only (`y` stays the plane y). An entity draws itself at
 *   `y - lift`; the runner draws its shadow at `y`, smaller and lighter the higher it is.
 * - SHOT LIFT: an entity with a numeric `shotLift` gives the shots it fires (their `shooter`)
 *   that lift: the runner draws them raised by it (spec §13).
 * - MOTION: world x is road distance and the camera moves at the road speed, so an entity's
 *   world `vx` is its own road speed; its screen speed is `vx - roadSpeed` (`screenVx`).
 *   `keepPace(rel)` holds a screen speed. A thing lying on the road has vx 0 and drifts left.
 */
import { Entity } from '../../engine/entity';
import type { Rect } from '../../engine/math';
import type { Renderer } from '../../engine/render';
import type { World } from '../../engine/world';
import { gameOf } from '../context';
import { drawShadow } from '../fx';
import { DEPTH_HALF } from './lanes';

/** Optional members the runner's draw reads from any entity (duck-typed). */
export interface RingDrawable {
  /** Height above the road (px), drawn only. */
  lift?: number;
  /** Width of the soft road shadow (px); 0 / undefined = no shadow. */
  shadowW?: number;
  /** Height of this entity's gun above the road: its shots are drawn this much higher. */
  shotLift?: number;
}

/**
 * What entities may read from (and ask of) the running ring. `ringOf(world)` returns it, or null
 * outside the ring (the content tests spawn every entity in a plain world: fail soft there).
 */
export interface RingHost {
  readonly isRing: true;
  /** Camera speed (px/tick). */
  readonly roadSpeed: number;
  /** Plan distance of the view's left edge. */
  readonly planDist: number;
  /** Runner ticks. */
  readonly ticks: number;
  /** Every player is out: the scroll and the plan hold (the continue). */
  readonly held: boolean;
  /** The plan is locked (a boss): the road scrolls, the plan does not. */
  readonly planLocked: boolean;
  /** Open lanes at a world x (3 = lane 4 closed: tunnels; from the plan). */
  lanesOpenAt(worldX: number): number;
  /** Plan distance of a world x near the view, and back. */
  planX(worldX: number): number;
  worldX(planX: number): number;
  /** A speed fine for a slot (−points, never below 0; `BOETE!`; the 'fine' event). */
  fine(slot: number, reason?: string, points?: number): void;
  /** Cap the road speed under key `key` (the jam controller); null removes the cap. */
  limitSpeed(key: string, max: number | null): void;
  /** Lock / unlock the plan cursor under a key (a boss: the road keeps scrolling). */
  lockPlan(key: string): void;
  unlockPlan(key: string): void;
}

/** The running ring of this world, or null (not a ring world). */
export function ringOf(world: World): RingHost | null {
  const r = gameOf(world).runner as Partial<RingHost> | null;
  return r && r.isRing === true ? (r as RingHost) : null;
}

/** Road speed of the world's ring (0 outside the ring). */
export function roadSpeedOf(world: World): number {
  return ringOf(world)?.roadSpeed ?? 0;
}

/**
 * The depth slab of `e`: the x range of its (mirrored) hitbox, plane y ± `half`. Fills `out`.
 */
export function slabRect(e: Entity, out: Rect, half = DEPTH_HALF): Rect {
  const hb = e.hitbox;
  out.x = e.facing < 0 ? e.x - hb.x - hb.w : e.x + hb.x;
  out.y = e.y - half;
  out.w = hb.w;
  out.h = half * 2;
  return out;
}

/** Fill a one-box cache with `e`'s slab and return it (for `hurtboxes()` / `contactBoxes()` overrides). */
export function slabBoxes(e: Entity, cache: Rect[], half = DEPTH_HALF): readonly Rect[] {
  if (cache.length === 0) cache.push({ x: 0, y: 0, w: 0, h: 0 });
  slabRect(e, cache[0], half);
  return cache;
}

/** A fresh one-box cache for `slabBoxes`. */
export function slabCache(): Rect[] {
  return [{ x: 0, y: 0, w: 0, h: 0 }];
}

const shotLifts = new WeakMap<Entity, number>();

/** Draw lift of a shot (set by the runner from its shooter's `shotLift`); 0 when none. */
export function shotLiftOf(e: Entity): number {
  return shotLifts.get(e) ?? 0;
}

/** Set the draw lift of a shot (the runner does this on spawn; content may override it). */
export function setShotLift(e: Entity, lift: number): void {
  if (lift > 0) shotLifts.set(e, lift);
  else shotLifts.delete(e);
}

/** Lift of any entity (its `lift` member when it has one). */
export function liftOf(e: Entity): number {
  const l = (e as Entity & RingDrawable).lift;
  return typeof l === 'number' && l > 0 ? l : 0;
}

/**
 * The soft road shadow of an entity at its plane y (the runner's shadow pass): `shadowW` wide,
 * smaller and lighter while lifted (an airborne thing gets a shrinking shadow).
 */
export function drawRingShadow(r: Renderer, e: Entity): void {
  const w0 = (e as Entity & RingDrawable).shadowW;
  if (typeof w0 !== 'number' || w0 <= 0) return;
  const lift = liftOf(e);
  const k = Math.max(0.4, 1 - lift / 64);
  drawShadow(r, e.x, e.y, w0 * k, 0.4 * Math.max(0.3, 1 - lift / 96));
}

/**
 * Base class for simple ring things (crates, hazards, civilians, scooters): slab hurt / contact
 * boxes, `lift`, `shadowW`, and the road-speed helpers. `hitbox` stays the visual box.
 */
export class RingEntity extends Entity implements RingDrawable {
  lift = 0;
  shadowW = 0;
  /** Half-height of the slab (default DEPTH_HALF). */
  depthHalf = DEPTH_HALF;
  private readonly hurtSlab = slabCache();
  private readonly contactSlab = slabCache();

  constructor(world: World, x: number, y: number) {
    super(world, x, y);
  }

  override hurtboxes(): readonly Rect[] {
    return slabBoxes(this, this.hurtSlab, this.depthHalf);
  }

  override contactBoxes(): readonly Rect[] {
    return slabBoxes(this, this.contactSlab, this.depthHalf);
  }

  /** Road speed of the ring (0 outside it). */
  get roadSpeed(): number {
    return roadSpeedOf(this.world);
  }

  /** Speed on screen (px/tick): own road speed minus the camera's. */
  get screenVx(): number {
    return this.vx - roadSpeedOf(this.world);
  }

  /** Hold a screen speed `rel` (px/tick): own speed = road speed + rel. */
  keepPace(rel = 0): void {
    this.vx = roadSpeedOf(this.world) + rel;
  }
}
