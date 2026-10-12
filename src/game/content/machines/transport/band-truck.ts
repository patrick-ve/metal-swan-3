/**
 * `band-truck` — Band Truck, the Legion troop carrier (GDD §9.2).
 *
 * A crimson parade lorry with gold trim; its back is a small stage where the cargo sits as a
 * row of seated bandsmen. It drives in at 2.0 px/tick (from the right unless `from: 'left'`)
 * to its `stopX` (brake screech), unloads its `cargo` one soldier every 20 ticks (they stand up
 * on the stage and jump off: spawned with `entry: 'truck'`), honks its two-tone horn, and 300
 * ticks after the stop reverses out at 1.5 px/tick. Contact while moving kills (`impact`, a
 * big hit for vehicles). No weapon. Spawn armour (shots ping off) until the stop or for 240
 * ticks. Death: explosions, instruments rain down (the triangle "tings"), a burnt wreck stays
 * 300 ticks; drop table `truck` (bombs 50 % · nothing 50 %).
 *
 * Params: `stopX` (default: 112 px inside the view from the entry edge), `cargo` (list of ids /
 * `{ id, params }` / a count map; default 3 `rifleman` + 1 `cymbalist`), `from` ('right' |
 * 'left'; `ctx.enter`'s `enter` works too), `speed` (2.0; the m2-b overtake uses 3), `outfit`
 * and `tag(s)` (passed on to the cargo), `ram: true` (m4-b "Battle of the Bands": no stop, no
 * cargo by default; it drives head-on, honks in rhythm every 30 ticks, and if it reaches a
 * driven player vehicle it rams it — a big hit — and explodes; spawn armour until it is fully
 * in view), plus the Enemy params `hp`, `drop`, `facing`.
 */
import type { Damage } from '../../../../engine/entity';
import type { Entity } from '../../../../engine/entity';
import { overlaps } from '../../../../engine/math';
import type { Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { explosion, FX_TRAIL, dust } from '../../../fx';
import { defineEntity, paramBool, paramNum, type SpawnParams, type SpawnSpec } from '../../../registry';
import { FallingProp } from './props';
import { parseSpecs, riderParams, TransportMachine, travelDir } from './machine';

/** Band truck numbers (GDD §9.2; NORMAL). */
export const TRUCK = {
  hp: 500,
  score: 2000,
  /** Hurtbox (the art is 88×48 with the seated bandsmen). */
  w: 88,
  h: 40,
  speed: 2.0,
  reverse: 1.5,
  armour: 240,
  unloadEvery: 20,
  /** Ticks after the stop before it reverses out. */
  stay: 300,
  /** Ticks of the brake nod before the first soldier stands up. */
  brake: 12,
  /** Stage floor above the ground: where the cargo stands up. */
  deckY: 20,
  /** Seat x on the stage (unflipped, the cab is at +x), rearmost first: the unload order. */
  seats: [-34, -23, -12, -1] as readonly number[],
  /** The jump off the stage (vx away from the cab). */
  hopVx: 0.8,
  hopVy: -2.4,
  contact: 100,
  /** Ram mode: a honk every 30 ticks ("in rhythm with the music", ~120 bpm). */
  honkEvery: 30,
  wreckTicks: 300,
  /** Default stop: this far inside the view from the edge it enters by. */
  stopInset: 112,
} as const;

export const TRUCK_ART = 'machine/band-truck';
/** Seated bandsman strips drawn on the stage for the cargo still aboard (2 frames each). */
export const BANDSMAN_SPRITES: readonly string[] = [`${TRUCK_ART}/bandsman-horn`, `${TRUCK_ART}/bandsman-drum`];
/** Instruments thrown out of the wreck (4 tumbling frames each). */
export const INSTRUMENT_SPRITES: readonly string[] = [
  `${TRUCK_ART}/drum`,
  `${TRUCK_ART}/horn`,
  `${TRUCK_ART}/cymbal`,
  `${TRUCK_ART}/horn`,
  `${TRUCK_ART}/drum`,
  `${TRUCK_ART}/triangle`,
];

const DEFAULT_CARGO: readonly SpawnSpec[] = [{ id: 'rifleman' }, { id: 'rifleman' }, { id: 'rifleman' }, { id: 'cymbalist' }];

export type TruckState = 'drive' | 'brake' | 'unload' | 'wait' | 'reverse' | 'ram';

export class BandTruck extends TransportMachine {
  state: TruckState;
  stateT = 0;
  /** Travel direction while driving in (-1 = right to left). */
  readonly dir: 1 | -1;
  /** Where it stops (NaN until known: the default is picked on the first tick). */
  stopX: number;
  readonly cargo: SpawnSpec[];
  /** Soldiers already off the truck. */
  unloaded = 0;
  readonly ram: boolean;
  /** The soldiers it unloaded (for scripts and tests). */
  readonly crew: Entity[] = [];
  private readonly speed: number;
  private readonly contact: Damage;
  private readonly ramHit: Damage;
  private honkT = 0;
  private honkHigh = true;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: TRUCK_ART, hp: TRUCK.hp, w: TRUCK.w, h: TRUCK.h, armour: TRUCK.armour });
    this.dir = travelDir(p, -1);
    this.facing = this.dir;
    this.ram = paramBool(p, 'ram', false);
    this.speed = Math.max(0.2, paramNum(p, 'speed', TRUCK.speed));
    this.stopX = paramNum(p, 'stopX', NaN);
    this.cargo = parseSpecs(p.cargo, this.ram ? [] : DEFAULT_CARGO);
    this.state = this.ram ? 'ram' : 'drive';
    this.smokeX = 22;
    this.smokeY = -30;
    this.contact = { amount: TRUCK.contact, kind: 'impact', dirX: this.dir, source: this };
    this.ramHit = { amount: TRUCK.contact, kind: 'impact', dirX: this.dir, source: this, tags: ['heavy'] };
    this.play('move');
  }

  /** Soldiers still sitting on the stage. */
  get aboard(): number {
    return this.cargo.length - this.unloaded;
  }

  /** Moving (and therefore deadly to touch)? */
  get moving(): boolean {
    return this.vx !== 0;
  }

  private setState(s: TruckState): void {
    this.state = s;
    this.stateT = 0;
  }

  /** Follow the road: the floor under x within a step of the current height. */
  private followFloor(): void {
    const g = this.world.terrain.surfaceY(this.x, this.y - 24, this.y + 24);
    if (Number.isFinite(g)) this.y = g;
  }

  // ------------------------------------------------------------------------------- AI

  protected override think(): void {
    this.stateT++;
    if (Number.isNaN(this.stopX)) {
      const cam = this.world.camera;
      this.stopX = this.dir < 0 ? cam.right - TRUCK.stopInset : cam.left + TRUCK.stopInset;
    }
    switch (this.state) {
      case 'drive':
        this.vx = this.dir * this.speed;
        if ((this.x + this.vx - this.stopX) * this.dir >= 0) {
          // Already past the stop (spawned inside the view): stop where it is, never jump back.
          if ((this.x - this.stopX) * this.dir > 0) this.stopX = this.x;
          this.arrive();
        }
        break;
      case 'brake':
        this.vx = 0;
        this.drawDy = this.stateT < 6 ? 1 : 0; // the nose dips under the brakes
        if (this.stateT >= TRUCK.brake) this.setState('unload');
        break;
      case 'unload':
        this.vx = 0;
        if (this.unloaded < this.cargo.length && (this.stateT - 1) % TRUCK.unloadEvery === 0) this.unloadNext();
        if (this.unloaded >= this.cargo.length && (this.stateT - 1) % TRUCK.unloadEvery === TRUCK.unloadEvery - 1) {
          this.world.audio.sfx('machine/truck-horn');
          this.setState('wait');
        }
        break;
      case 'wait':
        this.vx = 0;
        // 300 ticks after the stop (GDD §9.2), counted from the brake.
        if (this.stateT + TRUCK.brake + this.cargo.length * TRUCK.unloadEvery >= TRUCK.stay) this.setState('reverse');
        break;
      case 'reverse':
        this.vx = -this.dir * TRUCK.reverse;
        break;
      case 'ram':
        this.vx = this.dir * this.speed;
        this.thinkRam();
        if (this.dead) return; // it rammed a vehicle and blew up
        break;
    }
    this.x += this.vx;
    this.followFloor();
    this.contactDamage = this.vx !== 0 ? this.contact : null;
    this.play(this.vx !== 0 ? 'move' : 'idle');
    // Exhaust puffs from the tail pipe (cosmetic).
    if (this.age % (this.vx !== 0 ? 8 : 20) === 0) {
      this.world.particles.emit(FX_TRAIL, this.x - this.facing * 44, this.y - 4, -this.facing * 0.3, -0.2);
    }
  }

  private arrive(): void {
    this.x = this.stopX;
    this.vx = 0;
    this.armourTicks = 0;
    this.setState('brake');
    this.world.audio.sfx('machine/brake');
    dust(this.world, this.x - 26 * this.facing, this.y, 3);
    dust(this.world, this.x + 26 * this.facing, this.y, 3);
  }

  /** The next soldier stands up from his seat and jumps off the back of the stage. */
  private unloadNext(): void {
    const i = this.unloaded++;
    const spec = this.cargo[i];
    const seat = TRUCK.seats[Math.min(i, TRUCK.seats.length - 1)];
    const t = this.target();
    const face = t ? (t.x < this.x ? -1 : 1) : this.facing;
    const params = riderParams(this.params, { entry: 'truck', gag: false, facing: face });
    const e = this.world.spawn(spec.id, this.x + seat * this.facing, this.y - TRUCK.deckY, { ...params, ...spec.params });
    // A hop off the stage, away from the cab (an AI that knows `entry: 'truck'` keeps it).
    e.vx = -this.facing * TRUCK.hopVx;
    e.vy = TRUCK.hopVy;
    this.crew.push(e);
  }

  /** Ram mode: armour until fully in view, a honk every beat, ram a driven player vehicle. */
  private thinkRam(): void {
    const cam = this.world.camera;
    if (this.armourTicks > 0 && this.x - TRUCK.w / 2 >= cam.left && this.x + TRUCK.w / 2 <= cam.right) this.armourTicks = 0;
    if (++this.honkT >= TRUCK.honkEvery) {
      this.honkT = 0;
      this.world.audio.sfx('machine/truck-horn', { pitch: this.honkHigh ? 1 : 0.84 });
      this.honkHigh = !this.honkHigh;
    }
    const me = this.hitRect();
    const list = this.world.byTag('vehicle');
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      if (!v.alive || v.team !== 'player' || !v.hasTag('shootable')) continue;
      const boxes = v.hurtboxes();
      for (let k = 0; k < boxes.length; k++) {
        if (!overlaps(me, boxes[k])) continue;
        this.world.damage(v, this.ramHit, k);
        // It explodes with the impact: no points for anyone.
        this.die({ amount: this.hp, kind: 'impact', dirX: 0 });
        return;
      }
    }
  }

  // ------------------------------------------------------------------------------- death

  protected override defaultDrop(): void {
    // Drop table `truck` (GDD §7.3): bombs 50 · nothing 50.
    if (this.world.rng.chance(0.5)) {
      const e = this.world.spawn('pickup-bombs', this.x, this.y - 24, { dropped: true });
      e.vy = -3;
    }
  }

  protected override onDeath(_d: Damage): void {
    const w = this.world;
    this.vx = 0;
    this.drawDy = 0;
    explosion(w, this.x, this.y - 18, 'l', { team: 'enemy', debris: 'metal' });
    // Instruments rain down (cosmetic); the triangle tings when it lands.
    for (let i = 0; i < INSTRUMENT_SPRITES.length; i++) {
      const sprite = INSTRUMENT_SPRITES[i];
      const side = i % 2 === 0 ? -1 : 1;
      FallingProp.spawn(w, this.x + w.fxRng.range(-30, 30), this.y - 30, {
        sprite,
        vx: side * w.fxRng.range(0.5, 2.2),
        vy: -w.fxRng.range(3.0, 5.2),
        spin: w.fxRng.int(3, 5),
        sfx: sprite.endsWith('/triangle') ? 'enemy/triangle' : '',
      });
    }
    this.play('wreck');
  }

  protected override updateDeath(): void {
    this.deadT++;
    const w = this.world;
    // Two follow-up blasts, then a smoking wreck that blinks out (GDD §9.2).
    if (this.deadT === 10) explosion(w, this.x - 24 * this.facing, this.y - 12, 'm', { team: 'enemy', debris: null });
    if (this.deadT === 22) explosion(w, this.x + 20 * this.facing, this.y - 20, 's', { team: 'enemy' });
    if (this.deadT % 10 === 0 && this.deadT < TRUCK.wreckTicks) {
      w.particles.emit(FX_TRAIL, this.x + w.fxRng.range(-20, 20), this.y - 24, 0, -0.4);
    }
    if (this.deadT >= TRUCK.wreckTicks + 30) this.remove();
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    if (this.dead) {
      if (this.deadT > TRUCK.wreckTicks && this.deadT % 4 < 2) return;
      this.drawStrip(r, `${TRUCK_ART}/wreck`, 0, 0, 0, false);
      return;
    }
    // Seated bandsmen behind the stage rail: one per soldier still aboard (up to 4 seats).
    const seats = Math.min(TRUCK.seats.length, this.cargo.length);
    const bob = Math.floor(this.age / 12) % 2;
    for (let i = this.unloaded; i < seats; i++) {
      this.drawStrip(r, BANDSMAN_SPRITES[i % BANDSMAN_SPRITES.length], (bob + i) % 2, TRUCK.seats[i], -TRUCK.deckY - 2, false);
    }
    super.draw(r);
  }
}

defineEntity('band-truck', (w, x, y, p) => new BandTruck(w, x, y, p), {
  category: 'enemy',
  score: TRUCK.score,
  description: 'Band Truck: drives in to stopX, unloads its cargo (entry truck), reverses out. Params stopX, cargo, from, speed, ram.',
});
