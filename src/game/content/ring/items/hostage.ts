/**
 * `ring-hostage` — a tied hostage riding on a carrier (docs/design/ring.md §8; docs/api/ring.md
 * "Entities"; GDD §7.2). Wave A's carrier is the hostage van (`ring-car` with `hostage: true`);
 * wave B's parcel vans and caravans use the same hook (items/carrier.ts).
 *
 * Flow:
 * 1. 'tied' — it sits in the carrier's hold behind the door (the tourist on a chair; a wriggle and an
 *    MMF! now and then). It is a `shootable` on the enemy team whose only hurt box is the DOOR's
 *    depth slab: player shots and blasts there cost the door hp (`doorHp`, default 6 pistol shots'
 *    worth); the carrier's cover leaves that slab free. Below half the door is dented.
 * 2. Door open → the rescue counts at once (+500, +1 in the freeing player's hostage tally and the
 *    mission's `hostagesFreed`, 'hostageFreed' and 'hostageRescued'), the door tumbles off, the
 *    hostage stretches ('freed').
 * 3. 'jump' — it leaps onto the roof of the freeing player's wagon (else the nearest driven wagon;
 *    with none it hops onto the hard shoulder), a ballistic arc that follows the moving wagon.
 * 4. 'roof' — a curtain-call bow on the roof (hostages never salute: docs/ORIGINALITY.md, mechanics
 *    §23.2), then 'give': it drops its gift into the window (the item is applied to the hero at
 *    once: `giveItem`), then 'leave': a hop off onto the hard shoulder, a run back, gone.
 *    On the shoulder (no wagon) the gift becomes a `ring-crate` in lane 4.
 * If the carrier leaves the world while the hostage is tied, the hostage is gone too (missed).
 *
 * Params: `carrier` (the carrying entity; without one the factory makes a hostage van, which then
 * spawns its hostage), `item` (the gift: any drop value; default the ring roll), `doorHp`, `art`
 * (hostage strips prefix, default the tourist: `item/hostage/tourist`).
 */
import type { Damage } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import { Animator, frameCount, framePoint, getFrame, hasSprite } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import { hudOf, sessionOf } from '../../../context';
import { awardScore } from '../../../events';
import { hitSpark } from '../../../fx';
import { HOSTAGE_FREE_SCORE } from '../../../hostage';
import { defineEntity, NO_PARAMS, paramNum, paramStr, type SpawnParams, type SpawnSpec } from '../../../registry';
import { liftOf, RingEntity } from '../../../ring/entity';
import { RING_ENTITY } from '../../../ring/ids';
import { laneY, SHOULDER_TOP } from '../../../ring/lanes';
import { WAGON_H, type Wagon } from '../../../ring/wagon';
import { makeCar } from '../traffic/car';
import { doorBox, doorFallAnchor, DOOR_FALL, HOSTAGE_VAN } from '../traffic/geometry';
import { drivenWagons, nearestWagon, tumbleOff } from '../traffic/road-kit';
import { isCarrier, type DoorFallOut, type HostageCarrier, type SeatOut } from './carrier';
import { armourLow, giveItem, pickupOf, ringContents, RING_WEAPONS } from './crate';
import { roll } from '../../items/drops';

export type RingHostageState = 'tied' | 'freed' | 'jump' | 'roof' | 'give' | 'leave' | 'gone';

/** Tuning (ticks, px). */
export const RING_HOSTAGE = {
  /** Door hp (a pistol shot is 10). */
  doorHp: 60,
  /** The wriggle / MMF! interval while tied. */
  wriggleEvery: 150,
  freedTicks: 20,
  jumpTicks: 34,
  jumpHeight: 26,
  bowTicks: 24,
  giveTicks: 24,
  /** The gift is applied this many ticks into 'give' (it falls into the window first). */
  giveAt: 12,
  leaveTicks: 30,
  /** Where it stands on the roof: behind the window, on the roof line. */
  roofDx: -24,
  roofLift: WAGON_H + 2,
} as const;

/**
 * The hostage's gift roll (gameplay rng): weapon 40 · bombs 25 · repair 15 (40 while a wagon's
 * armour is low) · gem 20.
 */
export function hostageGiftRoll(world: World): SpawnSpec {
  const pick = roll(world, [
    ['weapon', 40],
    ['bombs', 25],
    ['repair', armourLow(world) ? 40 : 15],
    ['gem', 20],
  ] as const);
  if (pick === 'weapon') return { id: 'pickup-weapon', params: { weapon: roll(world, RING_WEAPONS) ?? 'machine-gun' } };
  if (pick === 'repair') return { id: 'pickup-repair' };
  if (pick === 'gem') return { id: 'pickup-gem', params: { kind: roll(world, [['gem', 60], ['medal', 40]] as const) ?? 'gem' } };
  return { id: 'pickup-bombs' };
}

const drawOpts: DrawOpts = {};
const NO_BOXES: readonly Rect[] = [];
const seat: SeatOut = { x: 0, y: 0, lift: 0 };
const door = { x0: 0, x1: 0 };
const fall: DoorFallOut = { sprite: '', ax: 0, ay: 0, h: 0 };

/** The hostage van's cage door fall (a carrier without `hostageDoorFall`). */
function defaultFall(out: DoorFallOut): void {
  const b = doorBox(HOSTAGE_VAN.hold);
  const a = doorFallAnchor(b);
  out.sprite = 'ring/car/cage-fall';
  out.ax = a.ax;
  out.ay = a.ay;
  out.h = b[3] - b[1];
}
const hand: [number, number] = [0, 0];

export class RingHostage extends RingEntity {
  state: RingHostageState = 'tied';
  stateT = 0;
  readonly carrier: HostageCarrier | null;
  readonly art: string;
  readonly gift: SpawnSpec;
  doorHp: number;
  readonly doorMax: number;
  /** The freeing player's slot (−1 unknown) and the wagon it rides / jumps to. */
  rescuer = -1;
  rescued = false;
  ride: Wagon | null = null;
  private readonly anim = new Animator();
  private readonly hurt: Rect[] = [{ x: 0, y: 0, w: 0, h: 0 }];
  private wriggleT = 0;
  /** Jump: start point (x, y, lift). */
  private jx = 0;
  private jy = 0;
  private jl = 0;
  private given = false;

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    this.carrier = isCarrier(p.carrier) ? p.carrier : null;
    this.art = paramStr(p, 'art', 'item/hostage/tourist');
    this.gift = p.item !== undefined && p.item !== null ? ringContents(p.item, world) : hostageGiftRoll(world);
    this.doorHp = this.doorMax = paramNum(p, 'doorHp', RING_HOSTAGE.doorHp);
    this.team = 'enemy';
    this.z = 31;
    this.facing = -1;
    this.hitbox = { x: -10, y: -34, w: 20, h: 34 };
    this.despawnMargin = Infinity;
    this.shadowW = 0;
    this.addTag(RING_ENTITY.hostage, 'shootable', 'hostage');
    this.play('tied');
    this.follow();
  }

  /** Full sprite id of a strip of this hostage. */
  private sid(name: string): string {
    return `${this.art}/${name}`;
  }

  private play(name: string, restart = false): void {
    const id = this.sid(name);
    if (hasSprite(id)) this.anim.play(id, { restart, loop: name === 'tied' || name === 'run' || name === 'walk' });
  }

  private set(s: RingHostageState): void {
    this.state = s;
    this.stateT = 0;
  }

  // ------------------------------------------------------------------------------- the door

  override hurtboxes(): readonly Rect[] {
    if (this.state !== 'tied' || !this.carrier) return NO_BOXES;
    this.carrier.hostageDoor(door);
    const b = this.hurt[0];
    b.x = door.x0;
    b.w = door.x1 - door.x0;
    b.y = this.carrier.y - this.depthHalf;
    b.h = this.depthHalf * 2;
    return this.hurt;
  }

  override contactBoxes(): readonly Rect[] {
    return NO_BOXES;
  }

  /** A shot or a blast at the door (hostages themselves are never hurt). */
  override onHit(d: Damage): boolean {
    if (this.state !== 'tied' || !this.carrier) return false;
    this.doorHp -= d.amount;
    this.flashTicks = 4;
    this.world.audio.sfx('ring/cage-hit');
    const b = this.hurt[0];
    hitSpark(this.world, b.x + 2, this.carrier.y - 18, d.dirX || 1);
    this.carrier.hostageDoorState?.(this.doorHp <= this.doorMax / 2 ? 1 : 0);
    if (this.doorHp <= 0) this.open(d.owner ?? -1);
    return true;
  }

  /** The door is shot open by `slot`: the rescue counts at once, the door tumbles off. */
  open(slot: number): void {
    if (this.state !== 'tied') return;
    this.rescuer = slot;
    this.team = 'neutral';
    this.removeTag('shootable');
    this.countRescue(slot);
    awardScore(this.world, slot, HOSTAGE_FREE_SCORE, this.x, this.y - 40);
    this.world.audio.sfx('hostage/free');
    this.world.events.emit('hostageFreed', { hostage: this, slot });
    hudOf(this.world).clearBubble(this);
    const c = this.carrier;
    if (c) {
      // The door falls as a door: it starts upright in the opening (frame 0 lands on the door the
      // carrier drew), tips over toward us about its sill, clangs flat on the road and scrapes to
      // a stop while the carrier drives on (traffic/art.ts `doorFallFrame`).
      fall.sprite = '';
      c.hostageDoorFall?.(fall);
      if (!fall.sprite) defaultFall(fall);
      const q = Math.round(DOOR_FALL.k * fall.h * 0.5);
      tumbleOff(this.world, c.x + fall.ax, c.y + q, {
        sprite: fall.sprite,
        vx: c.vx,
        vy: 0.12,
        lift: liftOf(c) + q - fall.ay,
        vlift: 0.6,
        once: true,
        tpf: 3,
        restFrame: 4,
        rest: 40,
        landSfx: 'ring/cage-hit',
        scrapeAt: -Math.round(fall.h * 0.35),
        z: 32,
        shadowW: Math.round(fall.h * 0.6),
      });
      c.hostageOpened(slot);
    }
    this.set('freed');
    this.play('freed', true);
    this.despawnMargin = 96;
  }

  /** +1 in the freeing player's tally (once), like the on-foot hostages. */
  private countRescue(slotIndex: number): void {
    if (this.rescued) return;
    this.rescued = true;
    const slot = sessionOf(this.world).slot(slotIndex);
    if (slot) {
      slot.rescued++;
      slot.stats.hostages++;
      slot.mission.hostagesFreed++;
    }
    this.world.events.emit('hostageRescued', { hostage: this, slot: slotIndex });
  }

  // ------------------------------------------------------------------------------- tick

  override update(): void {
    this.stateT++;
    switch (this.state) {
      case 'tied':
        this.updateTied();
        break;
      case 'freed':
        this.follow();
        if (this.stateT >= RING_HOSTAGE.freedTicks) this.startJump();
        break;
      case 'jump':
        this.updateJump();
        break;
      case 'roof':
      case 'give':
        this.updateRoof();
        break;
      case 'leave':
        this.updateLeave();
        break;
      default:
        break;
    }
    this.anim.update();
  }

  /** Ride at the carrier's seat. */
  private follow(): void {
    const c = this.carrier;
    if (!c) return;
    c.hostageSeat(seat);
    this.x = seat.x;
    this.y = seat.y;
    this.lift = seat.lift;
    this.vx = c.vx;
  }

  private updateTied(): void {
    const c = this.carrier;
    if (!c || c.removed) {
      this.remove();
      return;
    }
    this.follow();
    if (++this.wriggleT >= RING_HOSTAGE.wriggleEvery) {
      this.wriggleT = 0;
      if (this.onScreen(-24)) hudOf(this.world).bubble(this, 'MMF!', { ticks: 50, kind: 'gag' });
    }
  }

  /** Leap toward the rescuer's wagon (else the nearest; with none: the hard shoulder). */
  private startJump(): void {
    const list = drivenWagons(this.world);
    let w: Wagon | null = null;
    for (let i = 0; i < list.length; i++) if (list[i].driver?.index === this.rescuer) w = list[i];
    w ??= nearestWagon(this.world, this.x, this.y);
    this.ride = w;
    this.jx = this.x;
    this.jy = this.y;
    this.jl = this.lift;
    this.facing = 1;
    // Over the wagon (35) and its hero while it leaps onto the roof and rides there.
    this.z = 36;
    this.set('jump');
    this.play('walk', true);
    this.world.audio.sfx('ring/hop');
  }

  /** Target of the jump now (it follows the moving wagon). */
  private jumpTarget(out: SeatOut): void {
    const w = this.ride;
    if (w && w.alive && w.state === 'driven') {
      out.x = w.x + RING_HOSTAGE.roofDx;
      out.y = w.y;
      out.lift = RING_HOSTAGE.roofLift;
    } else {
      this.ride = null;
      out.x = this.jx - 8;
      out.y = SHOULDER_TOP + 4;
      out.lift = 0;
    }
  }

  private updateJump(): void {
    const T = RING_HOSTAGE.jumpTicks;
    const t = Math.min(1, this.stateT / T);
    this.jumpTarget(seat);
    const e = t * t * (3 - 2 * t);
    this.x = this.jx + (seat.x - this.jx) * e;
    this.y = this.jy + (seat.y - this.jy) * e;
    this.lift = this.jl + (seat.lift - this.jl) * t + Math.sin(t * Math.PI) * RING_HOSTAGE.jumpHeight;
    if (t >= 1) {
      this.set('roof');
      this.facing = 1;
      this.play('bow', true);
      this.world.audio.sfx('ring/hop');
    }
  }

  /** On the roof (or the shoulder): the bow, then the gift into the window. */
  private updateRoof(): void {
    const w = this.ride;
    if (w) {
      if (!w.alive || w.state !== 'driven') {
        // The wagon is gone under it: hop off.
        this.startLeave();
        return;
      }
      this.x = w.x + RING_HOSTAGE.roofDx;
      this.y = w.y;
      this.lift = RING_HOSTAGE.roofLift;
      this.vx = w.vx;
    } else {
      this.vx = 0;
    }
    if (this.state === 'roof' && this.stateT >= RING_HOSTAGE.bowTicks) {
      this.set('give');
      this.play('give', true);
    } else if (this.state === 'give') {
      if (this.stateT === RING_HOSTAGE.giveAt) this.handOver();
      if (this.stateT >= RING_HOSTAGE.giveTicks) this.startLeave();
    }
  }

  /** The gift: into the window of the wagon it rides, else a crate in the near lane. */
  private handOver(): void {
    if (this.given) return;
    this.given = true;
    const w = this.ride;
    const hero = w?.driver ?? null;
    if (w && hero) {
      const item = pickupOf(this.world, this.gift, w.x, w.y - 30);
      giveItem(this.world, this.gift, hero, item);
      this.world.audio.sfx('hostage/give');
      this.world.events.emit('hostageGift', { hostage: this, slot: hero.index, item });
    } else {
      const e = this.world.spawn(RING_ENTITY.crate, this.x + 12, laneY(4), { contains: this.gift.params?.kind ?? this.gift.params?.weapon ?? this.giftValue() });
      this.world.events.emit('hostageGift', { hostage: this, slot: this.rescuer, item: e });
    }
  }

  /** The drop value of the gift spec (for the shoulder crate). */
  private giftValue(): string {
    const id = this.gift.id;
    if (id === 'pickup-bombs') return 'bombs';
    if (id === 'pickup-repair') return 'repair';
    if (id === 'pickup-1up') return '1up';
    return id;
  }

  private startLeave(): void {
    if (!this.given) this.handOver();
    this.ride = null;
    this.jx = this.x;
    this.jy = this.y;
    this.jl = this.lift;
    this.facing = -1;
    this.set('leave');
    this.play('run', true);
  }

  /** Hop down onto the hard shoulder and run back (the road takes it away to the left). */
  private updateLeave(): void {
    const T = 22;
    if (this.stateT <= T) {
      const t = this.stateT / T;
      this.x = this.jx - 10 * t;
      this.y = this.jy + (SHOULDER_TOP + 4 - this.jy) * t;
      this.lift = this.jl * (1 - t) + Math.sin(t * Math.PI) * 10;
      this.vx = 0;
    } else {
      this.lift = 0;
      this.vx = -1.2;
      this.x += this.vx;
    }
    if (this.stateT > RING_HOSTAGE.leaveTicks && !this.onScreen(24)) this.remove();
    if (this.stateT > 600) this.remove();
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    const id = this.anim.id;
    const x = Math.round(this.x);
    const y = Math.round(this.y - this.lift);
    if (id) {
      let f = this.anim.index;
      if (this.state === 'tied' && frameCount(id) >= 3) f = this.wriggleT < 6 ? 2 : this.stateT % 150 < 7 ? 1 : 0;
      drawOpts.flipX = this.facing < 0;
      drawOpts.flash = this.flashTicks > 0 && this.state !== 'tied';
      r.sprite(id, f, x, y, drawOpts);
      drawOpts.flash = false;
      if (this.state === 'give' && this.stateT < RING_HOSTAGE.giveAt) this.drawGift(r, id, f, x, y);
    }
    if (this.state === 'tied') this.carrier?.drawHostageDoor?.(r);
  }

  /** The gift falls from its hand into the window. */
  private drawGift(r: Renderer, id: string, f: number, x: number, y: number): void {
    const sprite = pickupSprite(this.gift);
    if (!sprite || !hasSprite(sprite)) return;
    const p = framePoint(getFrame(id, f), 'hand', this.facing < 0, false, hand);
    const t = this.stateT / RING_HOSTAGE.giveAt;
    const hx = x + (p ? p[0] : 8);
    const hy = y + (p ? p[1] : -14);
    drawOpts.flipX = false;
    r.sprite(sprite, 0, Math.round(hx + t * 12), Math.round(hy + t * t * 16), drawOpts);
  }
}

/** The sprite of a pickup spec (for the falling gift). */
function pickupSprite(spec: SpawnSpec): string {
  const p = spec.params ?? {};
  if (spec.id === 'pickup-weapon') return `item/pickup-weapon/${String(p.weapon ?? 'machine-gun')}`;
  if (spec.id === 'pickup-gem') return `item/pickup-gem/${String(p.kind ?? 'gem')}`;
  if (spec.id === 'pickup-food') return `item/pickup-food/${String(p.kind ?? 'bread')}`;
  if (spec.id === 'pickup-repair') return 'item/pickup-repair';
  if (spec.id === 'pickup-1up') return 'item/pickup-1up';
  return 'item/pickup-bombs';
}

defineEntity(
  RING_ENTITY.hostage,
  (w, x, y, p) => {
    if (isCarrier(p.carrier)) return new RingHostage(w, x, y, p);
    // No carrier: a hostage van that carries it (the van spawns the hostage itself).
    return makeCar(w, x, y, { model: 'van', hostage: true, item: p.item, colour: p.colour });
  },
  { category: 'hostage', description: 'A tied hostage riding on a carrier (param carrier; without one: a hostage van). Shoot the door open: it jumps onto your roof, bows, drops its gift into the window.' },
);
