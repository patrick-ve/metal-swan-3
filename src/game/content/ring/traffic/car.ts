/**
 * `ring-car` — civilian traffic on the ring (docs/design/ring.md §8, §2; docs/api/ring.md §4).
 *
 * - COVER: a neutral `SolidBox` over the car's DEPTH SLAB (not its visual box), so the World's shot
 *   pass stops both teams' shots at it, only in its own lane.
 * - DENTS: the shots that end on its box are counted (the World's contact pass runs right after the
 *   shot pass and asks every entity with contact damage for its boxes: a zero-damage probe makes
 *   that call our hook, `contactBoxes()` returns no boxes). 5 hits → dented, 14 → battered (glass
 *   cracked). Never destroyed, no penalty.
 * - MOTION: world vx = road speed + its own screen speed `rel` (default by lane: the near lanes
 *   slower, you overtake them; the far lanes faster). A car spawned ahead drives into view slower
 *   than the road, one from behind faster. It keeps a gap to whatever is ahead in its lane (cars,
 *   wagons, closures) and merges out of a lane that is closed ahead (a closure, a tunnel's near
 *   lane). It brakes with the jam (`jamOf(world).level`: its own speed fades to the road's).
 * - BUMPS: a wagon that drives into it (rear or side) is pushed back out of the slab and gets
 *   `Wagon.bump` (a shove, a lane bounce, the cost: ½ cell for a light bump, 1 for a hard one — a
 *   closing speed over `BUMP_HARD` px/tick or a swerve; the sound, the shake and the driver's line
 *   are the wagon's). Slow contact (the jam: lane changes only into gaps) just blocks, for free.
 * - THE HOSTAGE VAN (`hostage: true`, always a van): its rear doors stand open, a tied hostage
 *   (`ring-hostage`, items/hostage.ts) rides in the hold behind a cage door; the van is the
 *   hostage's carrier (`HostageCarrier`): its cover leaves the door's slab free, so shots there hit
 *   the cage door.
 *
 * Params: `model` (hatch | estate | van | taxi | camper | box-truck; default hatch), `colour`
 * (an index or a colour name; geometry.ts), `rel` (screen speed, px/tick), `hostage` (bool),
 * `item` (the hostage's gift: a drop value), `stopAt` (a jam car: drives in to this screen x and
 * stands until the jam clears).
 */
import type { Damage } from '../../../../engine/entity';
import type { Rect } from '../../../../engine/math';
import { SolidBox } from '../../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { debris, hitSpark } from '../../../fx';
import { defineEntity, NO_PARAMS, paramNum, type SpawnParams } from '../../../registry';
import { ringOf, RingEntity } from '../../../ring/entity';
import { RING_CAR_MODELS, RING_ENTITY, type RingCarModel } from '../../../ring/ids';
import { clampLane, LANE_GAP, lastLane, laneY, nearestLane } from '../../../ring/lanes';
import { wagonBandEnd, WAGON_W } from '../../../ring/wagon';
import type { HostageCarrier, SeatOut } from '../items/carrier';
import { CAR_GEO, carColour, carSprite, HOSTAGE_VAN, WHEEL_R, type CarGeo } from './geometry';
import { drivenWagons, jamOf, slabsTouch, wagonSlab } from './road-kit';

/** Default screen speed per lane (px/tick): far lanes faster, near lanes slower (spec §8). */
export const LANE_REL: readonly number[] = [0.7, 0.3, -0.35, -0.75];
/** Shots that end on a car before it shows dents / is battered. */
export const DENT_HITS: readonly number[] = [5, 14];
/** Closing speed (px/tick) above which a bump costs a full cell; below `BUMP_SOFT` it only blocks. */
export const BUMP_HARD = 1.4;
export const BUMP_SOFT = 0.45;
/** Gap a car keeps to the thing ahead in its lane (px). */
export const FOLLOW_GAP = 16;
/** Ticks between two bumps of one car (the wagon's own hit invulnerability spaces them too). */
export const BUMP_COOL = 20;
/**
 * Held back below this share of its own speed by a thing ahead in its lane for `STUCK_TICKS`, a
 * car changes lanes around it (an enemy van that stands and gloats while every player is out;
 * user 2026-10-21: "the traffic shouldn't come to a standstill").
 */
export const STUCK_SHARE = 0.4;
export const STUCK_TICKS = 30;
/**
 * A wagon wedged beside a car while its own lane closes (a tunnel's near lane): the car moves on
 * along its lane at this many px/tick and the wagon eases the other way at `WEDGE_EASE`.
 */
export const WEDGE_YIELD = 2;
export const WEDGE_EASE = 1;

const DENT_PROBE: Damage = { amount: 0, kind: 'impact', dirX: 0 };
const NO_BOXES: readonly Rect[] = [];
/** Things a car keeps its gap to (and the jam's "ahead" test). */
const BLOCKER_TAGS = ['ring-car', 'ring-wagon', 'ring-closure', 'ring-block'] as const;

const drawOpts: DrawOpts = {};

function modelOf(p: SpawnParams): RingCarModel {
  if (p.hostage === true) return 'van';
  const m = p.model;
  return typeof m === 'string' && (RING_CAR_MODELS as readonly string[]).includes(m) ? (m as RingCarModel) : 'hatch';
}

export class RingCar extends RingEntity implements HostageCarrier {
  readonly geo: CarGeo;
  readonly model: RingCarModel;
  readonly colour: string;
  readonly sprite: string;
  readonly box: SolidBox;
  /** Own screen speed when traffic flows (px/tick). */
  rel: number;
  /** Shots that ended on the box, and the dent state 0 … 2. */
  hits = 0;
  dents = 0;
  /** The hostage van: the cage door is still shut / dented (0, 1) or gone (−1). */
  cage = -1;
  readonly hostageVan: boolean;
  /** Lane it merges to (0 = none). */
  private mergeTo = 0;
  /** Ticks it has been held back behind a slow thing ahead in its lane (see `STUCK_SHARE`). */
  private stuckT = 0;
  /** Wheel turn (px of road driven). */
  private roll = 0;
  private readonly wheelId: string;
  private readonly params: SpawnParams;
  /** A jam car: the screen x it stands at (NaN = none) and whether it stands there now. */
  private stopAt: number;
  /** A jam car standing at its stand. */
  parked = false;
  private dentSfxT = 0;
  private bumpCool = 0;
  private started = false;

  constructor(world: World, x: number, y: number, p: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    this.params = p;
    this.model = modelOf(p);
    this.geo = CAR_GEO[this.model];
    this.hostageVan = p.hostage === true;
    this.colour = carColour(this.model, p.colour);
    this.sprite = carSprite(this.model, this.colour);
    this.wheelId = `ring/car/wheel-${this.geo.wheel}`;
    const L = this.geo.len;
    this.hitbox = { x: -L / 2, y: -this.geo.height, w: L, h: this.geo.height };
    this.team = 'neutral';
    this.z = 30;
    this.shadowW = L - 6;
    this.despawnMargin = 160;
    const lane = nearestLane(y);
    this.rel = typeof p.rel === 'number' ? p.rel : LANE_REL[lane - 1];
    this.stopAt = paramNum(p, 'stopAt', NaN);
    // The probe that makes the World's contact pass call `contactBoxes()` (the dent hook).
    this.contactDamage = DENT_PROBE;
    this.box = world.addSolid(new SolidBox(0, 0, 0, 0, false, this));
    if (this.hostageVan) this.cage = 0;
    this.addTag(RING_ENTITY.car, 'solid', 'cover');
    this.syncBox();
  }

  // ------------------------------------------------------------------------------- tick

  override update(): void {
    if (!this.started) this.start();
    const ring = ringOf(this.world);
    const road = ring?.roadSpeed ?? 0;
    const jam = jamOf(this.world).level;
    // Its own road speed: the traffic drives on while every player is out (the continue holds the
    // camera, `flowSpeed`; user 2026-10-21). A jam's queue car keeps to the camera's road.
    let base = ring?.flowSpeed ?? road;
    let rel = this.rel * (1 - jam);
    if (!Number.isNaN(this.stopAt)) {
      rel = this.jamRel(road, jam);
      base = road;
      // At a held road speed of 0 a queue car's negative `rel` would drive it backwards into the
      // cars behind: it stands while every player is out.
      if (ring?.held) rel = 0;
    }
    let target = base + rel;
    const follow = this.followSpeed(target);
    if (Number.isNaN(this.stopAt) && jam <= 0.05 && target > 1 && follow < target * STUCK_SHARE) this.stuckT++;
    else this.stuckT = 0;
    target = Math.min(target, follow);
    const accel = target < this.vx ? 0.12 : 0.05;
    this.vx += Math.max(-accel, Math.min(accel, target - this.vx));
    // Never back into a wagon right behind it (a slow car does not push the player off the screen).
    this.vx = Math.max(this.vx, this.wagonFloor());
    this.x += this.vx;
    this.roll += Math.abs(this.vx);
    this.merge(ring?.lanesOpenAt(this.x + 160) ?? 4);
    this.syncBox();
    this.bumpWagons();
    if (this.dentSfxT > 0) this.dentSfxT--;
  }

  /** First tick: a hostage van boards its hostage; a car spawned ahead / behind drives into view. */
  private start(): void {
    this.started = true;
    const cam = this.world.camera;
    if (typeof this.params.rel !== 'number' && ringOf(this.world)) {
      if (this.x - this.geo.len / 2 > cam.right && this.rel >= -0.2) this.rel = -0.35;
      else if (this.x + this.geo.len / 2 < cam.x && this.rel <= 0.2) this.rel = 0.45;
    }
    if (this.hostageVan) this.world.spawn(RING_ENTITY.hostage, this.x + HOSTAGE_VAN.seat, this.y, { carrier: this, item: this.params.item });
    // It comes in at speed.
    const ring = ringOf(this.world);
    this.vx = (ring?.flowSpeed ?? ring?.roadSpeed ?? 0) + this.rel * (1 - jamOf(this.world).level);
  }

  /** A jam car drives in to its stand (`stopAt`, screen x), stands while the jam holds, then goes. */
  private jamRel(road: number, jam: number): number {
    const sx = this.x - this.world.camera.x;
    if (!this.parked && jam > 0.2) {
      if (sx <= this.stopAt) this.parked = true;
      else return -Math.min(2.2, 0.5 + (sx - this.stopAt) * 0.04) * (road > 0.2 ? 1 : 0.6);
    }
    if (this.parked && jam > 0.05) return 0;
    if (this.parked) {
      // The jam cleared: drive off with the lane's flow (a little quicker to open the road).
      this.stopAt = NaN;
      return this.rel + 0.3;
    }
    return this.rel;
  }

  /** The highest speed that keeps the gap to the nearest thing ahead in this lane. */
  private followSpeed(want: number): number {
    const front = this.x + this.geo.len / 2;
    let best = Infinity;
    let speed = want;
    for (const tag of BLOCKER_TAGS) {
      const list = this.world.byTag(tag);
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e === this || !e.alive || Math.abs(e.y - this.y) > 11) continue;
        const rear = e.facing < 0 ? e.x - e.hitbox.x - e.hitbox.w : e.x + e.hitbox.x;
        const gap = rear - front;
        if (gap < -4 || gap > 120 || gap >= best) continue;
        best = gap;
        speed = e.vx + (gap - FOLLOW_GAP) * 0.05;
      }
    }
    return best === Infinity ? want : Math.max(0, speed);
  }

  /** The speed of a wagon right behind it in its lane (−Infinity when none). */
  private wagonFloor(): number {
    const rear = this.x - this.geo.len / 2;
    const list = drivenWagons(this.world);
    let floor = -Infinity;
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      const minX = wagonBandEnd(w);
      // Only a wagon that holds back: one that drives into the car bumps it (its own doing). A
      // wagon at the left end of its band cannot give way: the car never pushes it off the screen
      // (fixer B: wagons pushed out behind slow or jam-bound cars ended up past the left edge).
      const atEnd = w.x <= minX && w.x < this.x;
      if (Math.abs(w.y - this.y) > 11 || (w.sideV > 0.2 && !atEnd)) continue;
      const gap = rear - (w.x + WAGON_W / 2);
      if (gap > (atEnd ? -WAGON_W : -6) && gap < 10 && w.vx > floor) floor = w.vx;
    }
    return floor;
  }

  /** Merge out of a lane that is closed ahead (a closure in the lane, a tunnel's near lane). */
  private merge(openAhead: number): void {
    const lane = nearestLane(this.y);
    if (this.mergeTo === 0) {
      let want = 0;
      if (lane > openAhead) want = clampLane(openAhead, openAhead);
      else if (this.closureAhead(lane) || this.stuckT >= STUCK_TICKS) {
        for (const l of [lane - 1, lane + 1]) {
          if (l < 1 || l > openAhead || this.closureAhead(l) || this.laneBusy(l)) continue;
          want = l;
          break;
        }
      }
      if (want !== 0 && want !== lane && !this.laneBusy(want)) this.mergeTo = want;
    }
    if (this.mergeTo !== 0) {
      const ty = laneY(this.mergeTo);
      const step = LANE_GAP / 40;
      const dy = ty - this.y;
      this.y += Math.abs(dy) <= step ? dy : Math.sign(dy) * step;
      if (Math.abs(this.y - ty) < 0.01) this.mergeTo = 0;
    }
  }

  private closureAhead(lane: number): boolean {
    const list = this.world.byTag('ring-closure');
    const y = laneY(lane);
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (!c.alive || Math.abs(c.y - y) > 4) continue;
      const rear = c.x + c.hitbox.x;
      if (rear > this.x && rear - this.x < 240) return true;
      if (this.x >= rear && this.x <= rear + c.hitbox.w) return true;
    }
    return false;
  }

  /** Is a car or a wagon beside this one in lane `lane`? */
  private laneBusy(lane: number): boolean {
    const y = laneY(lane);
    for (const tag of BLOCKER_TAGS) {
      const list = this.world.byTag(tag);
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (e === this || !e.alive || Math.abs(e.y - y) > 9) continue;
        const half = Math.abs(e.hitbox.w) / 2 + this.geo.len / 2 + 10;
        if (Math.abs(e.x - this.x) < half) return true;
      }
    }
    return false;
  }

  /** The cover box over the depth slab (the hostage van leaves its cage door's slab free). */
  private syncBox(): void {
    const b = this.box;
    const L = this.geo.len;
    const x0 = this.hostageVan && this.cage >= 0 ? this.x + HOSTAGE_VAN.door[1] : this.x - L / 2;
    b.x = x0;
    b.w = this.x + L / 2 - x0;
    b.y = this.y - this.depthHalf;
    b.h = this.depthHalf * 2;
  }

  // ------------------------------------------------------------------------------- bumps

  private bumpWagons(): void {
    if (this.bumpCool > 0) this.bumpCool--;
    const list = drivenWagons(this.world);
    if (list.length === 0) return;
    const mine = this.hurtboxes()[0];
    for (let i = 0; i < list.length; i++) {
      const w = list[i];
      if (w.scripted || !slabsTouch(wagonSlab(w), mine)) continue;
      const dy = w.y - this.y;
      const closing = Math.abs(w.vx - this.vx);
      let hard = closing > BUMP_HARD || w.swerveT > 0;
      let soft = closing <= BUMP_SOFT && w.swerveT <= 0;
      let dx = 0;
      let lane = 0;
      if (Math.abs(dy) < 7) {
        // In line: push the wagon out behind (or in front of) the car.
        const end = wagonBandEnd(w);
        if (w.x < this.x && (w.x <= end || this.x - (this.geo.len / 2 + WAGON_W / 2 + 0.5) < end - 2)) {
          // The wagon at the left end of its band (or queued in front of the other wagon there)
          // cannot give way: the car is shoved ahead of it. Polish 2026-10-21: a car standing in a
          // jam too (while the road still rolls, a parked car pushed both wagons off the screen),
          // and a push that would take the wagon past that end takes it only down to it.
          if (w.x > end) w.x = end - 2;
          this.x = w.x + this.geo.len / 2 + WAGON_W / 2 + 0.5;
          this.vx = Math.max(this.vx, w.vx);
          this.syncBox();
          if (soft && w.sideV > 0) w.sideV = 0;
        } else if (w.x < this.x) {
          w.x = this.x - (this.geo.len / 2 + WAGON_W / 2 + 0.5);
          dx = -1.2;
          if (soft && w.sideV > 0) w.sideV = 0;
        } else {
          w.x = this.x + this.geo.len / 2 + WAGON_W / 2 + 0.5;
          dx = 0.8;
          if (soft && w.sideV < 0) w.sideV = 0;
        }
      } else {
        // From the side (a lane change into it): back to its own lane.
        lane = dy < 0 ? -1 : 1;
        const open = ringOf(this.world)?.lanesOpenAt(w.x) ?? 4;
        w.laneTarget = clampLane(nearestLane(this.y) + lane, open);
        w.y = this.y + lane * (this.depthHalf * 2 + 0.5);
        if (nearestLane(this.y) + lane > lastLane(open)) {
          // Its own lane closes here (a tunnel's near lane): it has nowhere to go back to. The car
          // yields along the lane and the wagon eases the other way, so it slips in behind or in
          // front within about 45 ticks, for free (fix 2026-10-21: it rode on the kerb, held between
          // the lanes for as long as the car stayed beside it).
          const ahead = this.x >= w.x ? 1 : -1;
          if (!this.parked) this.x += ahead * WEDGE_YIELD;
          w.sideV = ahead > 0 ? Math.min(w.sideV, -WEDGE_EASE) : Math.max(w.sideV, WEDGE_EASE);
          continue;
        }
        hard = hard || closing > BUMP_HARD;
        soft = soft && closing <= BUMP_SOFT;
      }
      if (soft || this.bumpCool > 0 || w.invulnTicks > 0) continue;
      this.bumpCool = BUMP_COOL;
      w.bump({ dx, dy: lane, cost: hard ? 1 : 0.5, source: this });
      hitSpark(this.world, (w.x + this.x) / 2, this.y - 8, dx < 0 ? -1 : 1);
    }
  }

  // ------------------------------------------------------------------------------- dents

  /** The contact-pass hook (see the header): count the shots that ended on the cover box. */
  override contactBoxes(): readonly Rect[] {
    this.countShots();
    return NO_BOXES;
  }

  private countShots(): void {
    const shots = this.world.byTag('shot');
    if (shots.length === 0) return;
    const b = this.box;
    const e = 0.02;
    for (let i = 0; i < shots.length; i++) {
      const s = shots[i];
      if (!s.removed || s.dead) continue;
      if (s.x < b.x - e || s.x > b.x + b.w + e || s.y < b.y - e || s.y > b.y + b.h + e) continue;
      this.dent(s.x);
    }
  }

  /** One shot ended on the car. */
  dent(x: number): void {
    this.hits++;
    const before = this.dents;
    while (this.dents < DENT_HITS.length && this.hits >= DENT_HITS[this.dents]) this.dents++;
    if (this.dentSfxT <= 0) {
      this.world.audio.sfx('ring/dent');
      this.dentSfxT = 6;
    }
    if (this.dents > before) debris(this.world, x, this.y - this.geo.height * 0.5, this.dents === 2 ? 'glass' : 'metal', 4);
  }

  // ------------------------------------------------------------------------------- the hostage carrier

  hostageSeat(out: SeatOut): void {
    out.x = this.x + HOSTAGE_VAN.seat;
    out.y = this.y;
    out.lift = HOSTAGE_VAN.seatLift;
  }

  hostageDoor(out: { x0: number; x1: number }): void {
    out.x0 = this.x + HOSTAGE_VAN.door[0];
    out.x1 = this.x + HOSTAGE_VAN.door[1];
  }

  hostageDoorState(state: number): void {
    if (this.cage >= 0) this.cage = state;
  }

  hostageOpened(): void {
    this.cage = -1;
    this.syncBox();
  }

  drawHostageDoor(r: Renderer): void {
    if (this.cage < 0) return;
    drawOpts.flipX = false;
    r.sprite('ring/car/cage', this.cage, Math.round(this.x), Math.round(this.y - this.lift), drawOpts);
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    const g = this.geo;
    const x = Math.round(this.x);
    const y = Math.round(this.y - this.lift);
    drawOpts.flipX = false;
    r.sprite(this.sprite, 0, x, y, drawOpts);
    if (this.hostageVan) r.sprite(`ring/car/van-open-${this.colour}`, 0, x, y, drawOpts);
    if (this.dents > 0) {
      const n = this.dents >= 2 ? g.dents.length : 2;
      for (let i = 0; i < n; i++) {
        const [dx, dy, f] = g.dents[i];
        r.sprite('ring/car/dent', f, x + Math.round(dx), y + Math.round(dy), drawOpts);
      }
      if (this.dents >= 2) r.sprite('ring/car/dent', 3, x + Math.round(g.crack[0]), y + Math.round(g.crack[1]), drawOpts);
    }
    const wr = WHEEL_R[g.wheel];
    const f = Math.floor(this.roll / 2.5) & 3;
    const wy = y - Math.round(wr + 0.5);
    for (let i = 0; i < g.wheels.length; i++) r.sprite(this.wheelId, f, x + g.wheels[i], wy, drawOpts);
  }
}

/** Build a car (the `ring-hostage` factory also makes its van here). */
export function makeCar(world: World, x: number, y: number, p: SpawnParams): RingCar {
  const c = new RingCar(world, x, y, p);
  c.type = RING_ENTITY.car;
  return c;
}

defineEntity(RING_ENTITY.car, (w, x, y, p) => makeCar(w, x, y, p), {
  category: 'prop',
  description: 'Civilian traffic on the ring: cover (a SolidBox over its depth slab), dents, never destroyed (params model, colour, rel, hostage, item).',
});
