/**
 * The parcel van's continue gag (docs/design/ring.md §9; GDD §4.6; docs/research/mechanics.md §23):
 * while every player is out, the van's courier steps out of the cab with a NIET THUIS card, walks
 * to the wreck and sticks the card on it (when the wreck is gone already — it is removed after its
 * spin-out — on the near crash barrier's rail where the wagon went off), gives it a pat and waits:
 * his own business, no pointing, no laughing. When a hero drops back in he ducks
 * (the cower), then hurries back into his cab (or off along the shoulder when the van is gone). The
 * card drops off when the hold ends. Both are drawn only: no hurt box, no contact, never scored.
 */
import { Entity } from '../../../../engine/entity';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { ringOf, type RingDrawable } from '../../../ring/entity';
import { SHOULDER_TOP } from '../../../ring/lanes';
import { tumbleOff } from '../traffic/road-kit';
import { GANG_IDS, VAN, VAN_ART } from './geometry';

/** The van the courier belongs to (the parts it reads). */
export interface CourierVan extends Entity {
  readonly reaction: string | null;
}

export type CourierState = 'out' | 'walk' | 'stick' | 'wait' | 'cower' | 'back';

/** Tuning (ticks, px/tick). */
export const COURIER = {
  out: 10,
  walk: 1.3,
  run: 2,
  stickTicks: 42,
  /** The card is pressed on at this tick of 'stick'. */
  stickAt: 16,
  cowerTicks: 40,
  maxTicks: 1500,
} as const;

const drawOpts: DrawOpts = {};

/** The plane y and the lift of a card on the near crash barrier's rail (its lower edge behind the rail). */
const RAIL_Y = SHOULDER_TOP + 7;
const RAIL_LIFT = 14;

/** Find what the card goes on: a wreck near the spot (null: the barrier rail at the spot). */
function cardTarget(world: World, spot: Entity): Entity | null {
  const list = world.byTag('ring-wagon');
  let best: Entity | null = null;
  let bd = 170;
  for (let i = 0; i < list.length; i++) {
    const w = list[i] as Entity & { state?: string };
    if (w.removed || w.state !== 'wreck') continue;
    const d = Math.abs(w.x - spot.x);
    if (d < bd) {
      bd = d;
      best = w;
    }
  }
  return best;
}

export class RingCourier extends Entity implements RingDrawable {
  state: CourierState = 'out';
  stateT = 0;
  shadowW = 12;
  readonly van: CourierVan;
  readonly spot: Entity;
  /** The wreck the card goes on (null: the barrier rail at `railX`). */
  target: Entity | null;
  railX: number;
  card: RingCard | null = null;
  private t = 0;

  constructor(world: World, van: CourierVan, spot: Entity) {
    super(world, van.x + VAN.cabDoor, van.y + 1);
    this.van = van;
    this.spot = spot;
    this.target = cardTarget(world, spot);
    const cam = world.camera;
    // Well inside the view (the road still eases to a stop when the gloat starts).
    this.railX = Math.max(cam.x + 72, Math.min(cam.right - 48, spot.x));
    this.type = 'ring-parcel-courier';
    this.team = 'neutral';
    this.z = 35;
    this.facing = 1;
    this.hitbox = { x: -7, y: -32, w: 14, h: 32 };
    this.despawnMargin = 64;
  }

  /** The x the card goes to (the wreck's, else the rail spot). */
  private get cardX(): number {
    const t = this.target;
    return t && !t.removed ? t.x : this.railX;
  }

  /** Where he stands to stick the card: just beside the wreck, or on the shoulder by the rail spot. */
  private goal(out: [number, number]): [number, number] {
    const t = this.target && !this.target.removed ? this.target : null;
    const cx = this.cardX;
    const side = cx >= this.x ? -1 : 1;
    out[0] = cx + side * (t ? 26 : 13);
    out[1] = t ? Math.min(SHOULDER_TOP + 4, t.y + 1) : SHOULDER_TOP + 3;
    return out;
  }

  private set(s: CourierState): void {
    this.state = s;
    this.stateT = 0;
  }

  override update(): void {
    this.t++;
    this.stateT++;
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    const vanGone = this.van.removed || !this.van.alive;
    // The hold ended (a hero is back): duck, then back to the cab.
    const held = ringOf(this.world)?.held ?? true;
    if (!held && (this.state === 'walk' || this.state === 'stick' || this.state === 'wait' || this.state === 'out')) this.set('cower');
    if (this.van.reaction === 'cower' && this.state !== 'cower' && this.state !== 'back') this.set('cower');
    let rel = 0;
    let dy = 0;
    switch (this.state) {
      case 'out':
        if (this.stateT >= COURIER.out) this.set('walk');
        break;
      case 'walk': {
        const g = this.goal(goalScratch);
        const dx = g[0] - this.x;
        const gy = g[1] - this.y;
        const dist = Math.hypot(dx, gy);
        if (dist < 2 || this.stateT > 600) {
          this.facing = this.cardX >= this.x ? 1 : -1;
          this.set('stick');
          break;
        }
        rel = (dx / dist) * COURIER.walk;
        dy = (gy / dist) * COURIER.walk;
        this.facing = dx >= 0 ? 1 : -1;
        break;
      }
      case 'stick':
        if (this.stateT === COURIER.stickAt) this.stickCard();
        if (this.stateT >= COURIER.stickTicks) this.set('wait');
        break;
      case 'wait':
        break;
      case 'cower':
        if (this.stateT >= COURIER.cowerTicks) this.set('back');
        break;
      case 'back': {
        if (vanGone) {
          rel = -COURIER.run;
          this.facing = -1;
          break;
        }
        const tx = this.van.x + VAN.cabDoor;
        const dx = tx - this.x;
        const gy = this.van.y + 1 - this.y;
        const dist = Math.hypot(dx, gy);
        if (dist < 4) {
          this.remove();
          return;
        }
        rel = (dx / dist) * COURIER.run + (this.van.vx - road);
        dy = (gy / dist) * COURIER.run;
        this.facing = dx >= 0 ? 1 : -1;
        break;
      }
    }
    this.vx = road + rel;
    this.x += this.vx;
    this.y += dy;
    if (this.t > COURIER.maxTicks || (this.state === 'back' && !this.onScreen(40))) this.remove();
  }

  /** The card goes on the wreck, or on the rail (a slap). */
  private stickCard(): void {
    const t = this.target && !this.target.removed ? this.target : null;
    this.card = t ? new RingCard(this.world, t, t.x >= this.x ? -12 : 12, 16) : new RingCard(this.world, null, this.railX, RAIL_LIFT, RAIL_Y);
    this.world.add(this.card);
    this.world.audio.sfx('ring/card-slap');
  }

  override draw(r: Renderer): void {
    let id: string;
    let f: number;
    if (this.state === 'walk' || this.state === 'back' || this.state === 'out') {
      id = `${VAN_ART}/courier/walk`;
      f = Math.floor(this.t / (this.state === 'back' ? 4 : 6)) & 3;
    } else if (this.state === 'cower') {
      id = `${VAN_ART}/courier/cower`;
      f = Math.floor(this.t / 4) & 1;
    } else {
      id = `${VAN_ART}/courier/stick`;
      f = this.state === 'wait' ? 2 : Math.min(2, Math.floor(this.stateT / 14));
    }
    drawOpts.flipX = this.facing < 0;
    r.sprite(id, f, Math.round(this.x), Math.round(this.y), drawOpts);
  }
}

const goalScratch: [number, number] = [0, 0];

/**
 * The NIET THUIS card stuck on a wreck (it rides along) or on the barrier rail (`on` null: at world
 * x `dx`, plane y `y`); when the hold ends, or the wreck goes, it drops off onto the road and fades.
 */
export class RingCard extends Entity implements RingDrawable {
  lift: number;
  readonly on: Entity | null;
  private readonly dx: number;

  constructor(world: World, on: Entity | null, dx: number, lift: number, y = SHOULDER_TOP + 4) {
    super(world, on ? on.x + dx : dx, on ? on.y + 0.5 : y);
    this.on = on;
    this.dx = dx;
    this.lift = lift;
    this.type = GANG_IDS.card;
    this.team = 'neutral';
    this.z = 37;
    this.hitbox = { x: -12, y: -8, w: 24, h: 16 };
    this.despawnMargin = 64;
  }

  override update(): void {
    const held = ringOf(this.world)?.held ?? true;
    if (!held || (this.on && this.on.removed)) {
      tumbleOff(this.world, this.x, this.y, { sprite: `${VAN_ART}/card`, vx: 0, vy: 0.2, lift: this.lift, vlift: 0.6, bounces: 0, rest: 50, tpf: 99, z: 32, shadowW: 8 });
      this.remove();
      return;
    }
    if (!this.on) {
      this.vx = 0;
      return;
    }
    this.x = this.on.x + this.dx;
    this.y = this.on.y + 0.5;
    this.vx = this.on.vx;
  }

  override draw(r: Renderer): void {
    drawOpts.flipX = false;
    r.sprite(`${VAN_ART}/card`, 0, Math.round(this.x), Math.round(this.y - this.lift), drawOpts);
  }
}
