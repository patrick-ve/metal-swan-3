/**
 * `ring-parcel` — a parcel thrown out of a parcel van's open rear (docs/design/ring.md §5.2). It
 * flies over everything (its shadow runs along the road to the spot), lands in the target's lane
 * with a thud, tumbles back along the lane as its speed dies and then lies on the road (world vx
 * 0: it drifts back at the road speed) as an obstacle: a wagon that drives into it loses 1 cell
 * (a thrown object) and it bursts. A wagon it lands on loses the same. Shot (one pistol shot) it
 * breaks open (cardboard and paper flying); one in four holds an item (a `ring-crate`). A civilian
 * car rolls it over (it bursts, no harm). Bloodless, no fire.
 *
 * Params (all optional; `{}` = a parcel lying still on the road): `lift` (start height), `ty`
 * (the plane y it lands on), `vx` (its world speed in flight), `ticks` (flight time), `arc`.
 * The bot reads `landX`, `landY`, `ticksLeft` (as the scooter's bottle) and `lying`.
 */
import type { Damage } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { awardScore } from '../../../events';
import { debris, dust } from '../../../fx';
import { defineEntity, NO_PARAMS, paramNum, type SpawnParams } from '../../../registry';
import { RingEntity, ringOf } from '../../../ring/entity';
import { RING_ENTITY } from '../../../ring/ids';
import { drivenWagons, slabsTouch, wagonSlab } from '../traffic/road-kit';
import { GANG_IDS, VAN_ART } from './geometry';

export type ParcelState = 'fly' | 'tumble' | 'lie';

/** Tuning (ticks, px, px/tick). */
export const PARCEL_AI = {
  hp: 10,
  score: 50,
  /** A wagon that drives into it (or that it lands on) loses this much armour. */
  cells: 1,
  /** Chance that a shot parcel holds an item (a ring crate). */
  dropChance: 0.25,
  /** Above this lift it flies over everything (no hurt box, no contact). */
  overLift: 7,
  /** The tumble after landing: the world speed keeps this much per tick; bounce, gravity. */
  slow: 0.86,
  vlift: 1.8,
  gravity: 0.32,
} as const;

const NO_BOXES: readonly Rect[] = [];
const drawOpts: DrawOpts = {};
const PARCEL_SPRITE = `${VAN_ART}/parcel`;

export class RingParcel extends RingEntity {
  state: ParcelState;
  t = 0;
  private readonly lift0: number;
  private readonly y0: number;
  private readonly ty: number;
  private readonly ticks: number;
  private readonly arc: number;
  private vlift = 0;
  private spin = 0;
  private readonly slab: Rect[] = [{ x: 0, y: 0, w: 0, h: 0 }];

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    this.lift = this.lift0 = Math.max(0, paramNum(p, 'lift', 0));
    this.y0 = y;
    this.ty = paramNum(p, 'ty', y);
    this.ticks = Math.max(1, Math.round(paramNum(p, 'ticks', 0)));
    this.arc = paramNum(p, 'arc', 0);
    this.vx = paramNum(p, 'vx', 0);
    this.state = paramNum(p, 'ticks', 0) > 0 ? 'fly' : 'lie';
    this.team = 'enemy';
    this.hp = this.maxHp = PARCEL_AI.hp;
    this.z = 33;
    this.shadowW = 10;
    this.depthHalf = 6;
    this.hitbox = { x: -6, y: -9, w: 12, h: 9 };
    this.despawnMargin = 48;
    this.addTag(GANG_IDS.parcel, 'shootable', 'ring-obstacle');
  }

  /** Lying still on the road (an obstacle drifting back). */
  get lying(): boolean {
    return this.state === 'lie';
  }

  /** Where and when it lands (the bot): the plane y, the world x, ticks left of the flight. */
  get landY(): number {
    return this.ty;
  }

  get landX(): number {
    return this.state === 'fly' ? this.x + this.vx * (this.ticks - this.t) : this.x;
  }

  get ticksLeft(): number {
    return this.state === 'fly' ? this.ticks - this.t : 0;
  }

  /** In the air above the wagons' roofs: no hurt box, no contact. */
  private get high(): boolean {
    return this.lift > PARCEL_AI.overLift;
  }

  override hurtboxes(): readonly Rect[] {
    if (this.dead || this.high) return NO_BOXES;
    const b = this.slab[0];
    b.x = this.x - 6;
    b.w = 12;
    b.y = this.y - this.depthHalf;
    b.h = this.depthHalf * 2;
    return this.slab;
  }

  override contactBoxes(): readonly Rect[] {
    return NO_BOXES;
  }

  override update(): void {
    this.t++;
    if (this.state === 'fly') this.fly();
    else if (this.state === 'tumble') this.tumble();
    else this.vx = 0;
    this.x += this.vx;
    if (!this.high) this.touch();
  }

  private fly(): void {
    const T = this.ticks;
    const k = Math.min(1, this.t / T);
    this.y = this.y0 + (this.ty - this.y0) * k;
    this.lift = Math.max(0, this.lift0 * (1 - k) + Math.sin(k * Math.PI) * this.arc);
    this.spin = Math.floor(this.t / 4);
    if (this.t >= T) this.land();
  }

  /** It lands: a thud; on a wagon it bursts (1 cell); else it tumbles back along the lane. */
  private land(): void {
    this.lift = 0;
    this.y = this.ty;
    this.world.audio.sfx('ring/parcel-thud');
    dust(this.world, this.x, this.y, 2);
    if (this.hitWagon()) return;
    this.state = 'tumble';
    this.t = 0;
    this.vlift = PARCEL_AI.vlift;
  }

  private tumble(): void {
    this.vx *= PARCEL_AI.slow;
    this.vlift -= PARCEL_AI.gravity;
    this.lift = Math.max(0, this.lift + this.vlift);
    if (this.lift <= 0 && this.vlift < 0) this.vlift = Math.abs(this.vlift) > 1 ? -this.vlift * 0.35 : 0;
    this.spin = Math.floor(this.t / 3);
    if (Math.abs(this.vx) < 0.15 && this.lift <= 0 && this.vlift === 0) {
      this.state = 'lie';
      this.vx = 0;
    }
  }

  /** A driven wagon that touches it loses a cell; a civilian car rolls it over. */
  private touch(): void {
    if (this.hitWagon()) return;
    const cars = this.world.byTag('ring-car');
    const mine = this.hurtboxes()[0];
    if (!mine) return;
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      if (!c.alive) continue;
      const cb = c.hurtboxes()[0];
      if (cb && slabsTouch(cb, mine)) {
        this.burst(false);
        return;
      }
    }
  }

  private hitWagon(): boolean {
    const mine = this.hurtboxes()[0];
    if (!mine) return false;
    const list = drivenWagons(this.world);
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      if (!slabsTouch(wagonSlab(w), mine)) continue;
      this.world.damage(w, { amount: PARCEL_AI.cells, kind: 'impact', dirX: -1, source: this, tags: ['thrown'] });
      this.burst(false);
      return true;
    }
    return false;
  }

  /** Shot: it breaks open; one in four holds an item. */
  override onHit(d: Damage): boolean {
    if (this.dead || this.removed || this.high) return false;
    this.hp -= d.amount;
    this.flashTicks = 4;
    if (this.hp <= 0) {
      awardScore(this.world, d.owner, PARCEL_AI.score, this.x, this.y - 12);
      if (this.world.rng.chance(PARCEL_AI.dropChance)) {
        this.world.spawn(RING_ENTITY.crate, this.x, this.y, { contains: 'auto', dropped: true, vx: (ringOf(this.world)?.roadSpeed ?? 0) * 0.3, lift: 6, vlift: 2 });
      }
      this.burst(true);
    }
    return true;
  }

  /** Cardboard and paper flying; gone. */
  private burst(shot: boolean): void {
    if (this.dead) return;
    this.dead = true;
    debris(this.world, this.x, this.y - 4 - this.lift, 'wood', shot ? 6 : 4);
    debris(this.world, this.x, this.y - 6 - this.lift, 'cloth', 3);
    this.world.audio.sfx('ring/parcel-tear');
    this.remove();
  }

  override draw(r: Renderer): void {
    const f = this.state === 'lie' ? 4 : this.spin & 3;
    drawOpts.flash = this.flashTicks > 0;
    r.sprite(PARCEL_SPRITE, f, Math.round(this.x), Math.round(this.y - this.lift - 4), drawOpts);
    drawOpts.flash = false;
  }
}

defineEntity(GANG_IDS.parcel, (w, x, y, p) => new RingParcel(w, x, y, p), {
  category: 'enemy',
  description: 'A parcel thrown out of a parcel van: lands in a lane and tumbles back as an obstacle (1 cell); shot it breaks, some hold a crate (params lift, ty, vx, ticks, arc).',
});
