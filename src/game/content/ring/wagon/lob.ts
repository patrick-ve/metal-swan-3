/**
 * BOMB = lob (docs/design/ring.md §3): the hero's grenade arcs over the road into the aimed lane
 * and blasts an area in x and depth. It flies in the plane (x = road distance, y = plane y) with a
 * drawn `lift` (a parabola over its flight) and a shrinking shadow; it hits nothing in the air, so
 * it flies over the other wagon and over traffic (spec §9). On landing: one blast `LOB.w` wide and
 * `LOB.h` deep (a car in the next lane is safe), the explosion fx, freed hostages next to it.
 *
 * Aim → target: forward aims land `LOB.ahead` px ahead on screen, back aims `LOB.behind` behind,
 * straight across (far / near) at the wagon's own screen x; far aims one lane toward the median,
 * near aims one lane toward the shoulder (clamped to the open lanes).
 */
import { Entity } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import { frameCount, hasSprite } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import { explosion } from '../../../fx';
import { defineEntity } from '../../../registry';
import { ringOf, type RingDrawable } from '../../../ring/entity';
import { aimsBack, clampLane, laneY, nearestLane, type Aim8 } from '../../../ring/lanes';

export const LOB = Object.freeze({
  /** Flight time (ticks) and the arc's height over its start (px). */
  ticks: 34,
  arc: 30,
  /** Landing distance on screen ahead / behind (px). */
  ahead: 112,
  behind: 72,
  /** Blast box: width (x) and depth (y) — a lane is ≥ 21 px from the next. */
  w: 56,
  h: 14,
  /** Damage of the blast (the grenade's splash). */
  damage: 100,
});

export const LOB_ID = 'ring-lob';

export interface LobOpts {
  aim: Aim8;
  /** Player slot (score, hostages). */
  owner: number;
  /** Height of the hand above the road at the throw. */
  lift: number;
  /** The thrower (excluded from nothing: the blast only hurts enemies). */
  shooter?: Entity | null;
  damage?: number;
}

const blastBox: Rect = { x: 0, y: 0, w: 0, h: 0 };
const opts: DrawOpts = {};

/** The lobbed grenade. Spawn it with `lob(world, x, y, o)`. */
export class RingLob extends Entity implements RingDrawable {
  lift = 0;
  shadowW = 6;
  readonly owner: number;
  readonly damage: number;
  private t = 0;
  private readonly lift0: number;
  private readonly y0: number;
  private readonly y1: number;
  /** Screen speed (px/tick) on top of the road speed. */
  private readonly rel: number;

  constructor(world: World, x: number, y: number, o: LobOpts) {
    super(world, x, y);
    this.type = LOB_ID;
    this.team = 'player';
    this.owner = o.owner;
    this.damage = o.damage ?? LOB.damage;
    this.lift0 = this.lift = o.lift;
    this.y0 = y;
    this.z = 70;
    this.hitbox = { x: -2, y: -4, w: 4, h: 4 };
    this.despawnMargin = 200;
    const open = ringOf(world)?.lanesOpenAt(x) ?? 4;
    const lane = nearestLane(y, 1, clampLane(4, open));
    const far = o.aim === 'far' || o.aim === 'forward-far' || o.aim === 'back-far';
    const near = o.aim === 'near' || o.aim === 'forward-near' || o.aim === 'back-near';
    this.y1 = laneY(clampLane(lane + (far ? -1 : near ? 1 : 0), open));
    const across = o.aim === 'far' || o.aim === 'near';
    this.rel = across ? 0 : aimsBack(o.aim) ? -LOB.behind / LOB.ticks : LOB.ahead / LOB.ticks;
    this.addTag('ring-lob');
  }

  /** The target lane's plane y. */
  get targetY(): number {
    return this.y1;
  }

  override update(): void {
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    this.t++;
    const k = Math.min(1, this.t / LOB.ticks);
    this.vx = road + this.rel;
    this.x += this.vx;
    this.y = this.y0 + (this.y1 - this.y0) * k;
    // A parabola from the hand down to the road.
    this.lift = this.lift0 * (1 - k) + 4 * LOB.arc * k * (1 - k);
    if (this.t >= LOB.ticks) this.land();
  }

  /** The blast on the road: a box in x and depth (one lane), the fx, then gone. */
  private land(): void {
    const w = this.world;
    blastBox.x = this.x - LOB.w / 2;
    blastBox.y = this.y - LOB.h / 2;
    blastBox.w = LOB.w;
    blastBox.h = LOB.h;
    w.damageArea(blastBox, { amount: this.damage, kind: 'explosion', dirX: 1, source: this, owner: this.owner, weapon: 'grenade' }, 'player');
    explosion(w, this.x, this.y, 'm', { team: 'player', owner: this.owner, damage: 0, radius: 12, lift: 10, source: this });
    this.remove();
  }

  override draw(r: Renderer): void {
    const id = 'weapon/grenade';
    const x = Math.round(this.x);
    const y = Math.round(this.y - this.lift);
    if (hasSprite(id)) r.sprite(id, Math.floor(this.t / 3) % frameCount(id), x, y, opts);
    else r.rect(x - 2, y - 3, 4, 4, 0x3b4457ff, opts);
  }
}

/** Throw a lob from (x, plane y). Returns it. */
export function lob(world: World, x: number, y: number, o: LobOpts): RingLob {
  const e = new RingLob(world, x, y, o);
  world.add(e);
  world.audio.sfx('bomb/throw');
  return e;
}

defineEntity(LOB_ID, (w, x, y, p) => new RingLob(w, x, y, { aim: (p.aim as Aim8) ?? 'forward', owner: typeof p.owner === 'number' ? p.owner : 0, lift: typeof p.lift === 'number' ? p.lift : 20 }), {
  category: 'projectile',
  description: 'the ring lob: a grenade arcing into the aimed lane',
});
