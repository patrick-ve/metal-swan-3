/**
 * `stag-beer-bike` — the enemy beer bike (docs/design/ams-extras.md §2.2): a stag party pedals a
 * bar on wheels through the old centre, a sober driver steers. 400 HP (big: scaled by difficulty
 * and co-op), +2,000 when wrecked.
 *
 * - 2–4 `stag-partier` riders sit on its stools (child entities: each has the partier's HP and
 *   score, is shot off on its own and fires corks from the stool; one rider at a time, 40 ticks
 *   apart, with the usual attack tokens).
 * - It rolls at 0.6 px/tick along its facing, stops 140–200 px (one value per bike) from the
 *   nearest player and rolls on when the players move ahead (24 px of hysteresis); a player more
 *   than 70 px behind it for 60 ticks makes it turn round.
 * - The body (chassis, counter panel, wheels: the low box under the riders) is armoured against
 *   bullets, lasers and fire (they ping) but takes explosions, the knife, rams and crushes.
 *   400 HP → wrecked: an `m` explosion, keg debris, the riders still on board are thrown off
 *   (killed, credited to the wrecker) and the driver runs (`MIJN FIETS!`).
 * - Every rider down (or `unload()`): the driver flees (`MIJN FIETS!`), the bike rolls to a stop
 *   and turns into the rideable vehicle `beer-bike` (empty, the `RIDE?` hint) at the same spot and
 *   facing. No score for that: the riders were the points.
 *
 * Params: `riders` (2–4, default 3), `groom` (true: the front rider is the groom), `looks` (a list
 * of look numbers for the riders, front first), `facing`, `enter` / `entry` / `from` (`left` /
 * `right`: rolls in from that side), `stop` (px: a fixed stop distance), + the Enemy params `hp`,
 * `drop`, `tag(s)`. y = the ground.
 */
import type { Damage } from '../../../engine/entity';
import { approach } from '../../../engine/math';
import type { DrawOpts, Renderer } from '../../../engine/render';
import type { World } from '../../../engine/world';
import { hudOf } from '../../context';
import { Enemy, type ReactionKind } from '../../enemy';
import { explosion, FxEntity, hitSpark, tumble } from '../../fx';
import { defineEntity, paramNum, paramStr, type SpawnParams } from '../../registry';
import { entryParam } from '../creatures/common';
import { BEER_BIKE as G } from '../vehicles/beer-bike/geometry';
import { StagPartier, type PartyBike } from './partier';

/** Enemy beer-bike numbers (NORMAL). */
export const PARTY_BIKE = {
  hp: 400,
  score: 2000,
  roll: 0.6,
  accel: 0.03,
  stopMin: 140,
  stopMax: 200,
  /** Rolls on once the player is this much farther than the stop distance. */
  rollOn: 24,
  /**
   * It stops at `stop` only once the whole bike is in view (a camera lock can leave the stop point
   * off-screen, and its riders fire only inside the view); never closer than this to the player.
   */
  minGap: 72,
  /** A player this far behind the middle for `turnAfter` ticks makes it turn. */
  behind: 70,
  turnAfter: 60,
  /** Ticks between two riders' corks. */
  fireGap: 40,
  /** After the last rider: rolls to a stop for this long, then becomes the vehicle. */
  abandonTicks: 36,
  /** The armoured body box (the low part under the riders). */
  box: { x: -48, y: -14, w: 96, h: 14 },
} as const;

const ART = 'vehicle/beer-bike';
const ID = {
  body: `${ART}/body`,
  posts: `${ART}/posts`,
  turret: `${ART}/turret`,
  wheel: `${ART}/wheel`,
  far: `${ART}/wheel-far`,
  wreck: `${ART}/wreck`,
  debris: `${ART}/debris`,
  driver: 'enemy/stag-beer-bike/driver',
  flee: 'enemy/stag-beer-bike/driver-flee',
} as const;

const opts: DrawOpts = {};
const plain: DrawOpts = {};
/** Riders back to front along the facing (stool indices). */
const ORDER_RIGHT = [0, 1, 2, 3] as const;
const ORDER_LEFT = [3, 2, 1, 0] as const;

export class StagBeerBike extends Enemy implements PartyBike {
  mode: 'roll' | 'stop' | 'abandon' | 'wrecked' = 'roll';
  modeT = 0;
  /** Seated riders by stool (null = empty / gone). */
  readonly riders: Array<StagPartier | null> = [null, null, null, null];
  driverOn = true;
  private readonly stopAt: number;
  private behindT = 0;
  private firing: StagPartier | null = null;
  private nextFire = 0;
  /** Distance rolled (the wheels turn with it). */
  roll = 0;
  private converted = false;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: ART, hp: PARTY_BIKE.hp, w: G.body.w, h: 20, score: PARTY_BIKE.score, big: true, soft: true });
    this.hitbox = { ...PARTY_BIKE.box };
    this.z = 29;
    this.corpseTicks = 90;
    this.addTag('beer-bike');
    const entry = entryParam(p) || paramStr(p, 'from', '');
    const t = world.nearestPlayer(x, y);
    if (entry === 'left') this.facing = 1;
    else if (entry === 'right') this.facing = -1;
    else if (p.facing === 1 || p.facing === 'right') this.facing = 1;
    else if (p.facing === -1 || p.facing === 'left') this.facing = -1;
    else this.facing = t && t.x < x ? -1 : 1;
    this.stopAt = paramNum(p, 'stop', world.rng.int(PARTY_BIKE.stopMin, PARTY_BIKE.stopMax));
    this.alerted = true;
    // The riders: stools from the front (seen along the facing) backwards.
    const n = Math.max(2, Math.min(4, Math.round(paramNum(p, 'riders', 3))));
    const looks = Array.isArray(p.looks) ? (p.looks as unknown[]) : [];
    const groom = p.groom === true;
    const stools = [...G.stools].reverse();
    for (let i = 0; i < n; i++) {
      const lk = typeof looks[i] === 'number' ? (looks[i] as number) : world.rng.int(0, 3);
      const r = new StagPartier(world, x, y, { look: lk, groom: groom && i === 0, gag: false });
      r.type = 'stag-partier';
      const k = G.stools.indexOf(stools[i]);
      r.seatOn(this, stools[i]);
      this.riders[k] = r;
      world.add(r);
    }
  }

  // ------------------------------------------------------------------------------- PartyBike

  mayFire(p: StagPartier): boolean {
    if (this.dead || this.mode === 'abandon') return false;
    if (this.firing && this.firing !== p && !this.firing.dead && this.firing.seat === this) return false;
    if (this.world.tick < this.nextFire) return false;
    this.firing = p;
    return true;
  }

  doneFiring(p: StagPartier): void {
    if (this.firing !== p) return;
    this.firing = null;
    this.nextFire = this.world.tick + PARTY_BIKE.fireGap;
  }

  riderGone(p: StagPartier): void {
    const i = this.riders.indexOf(p);
    if (i >= 0) this.riders[i] = null;
    if (this.firing === p) this.doneFiring(p);
  }

  /** Live riders on board. */
  get aboard(): number {
    let n = 0;
    for (const r of this.riders) if (r && !r.dead && !r.removed && r.seat === this) n++;
    return n;
  }

  /** Everybody off (the integrator's briefing stop): the riders walk, the bike is left behind. */
  unload(): void {
    for (let i = 0; i < this.riders.length; i++) {
      const r = this.riders[i];
      if (!r || r.dead) continue;
      this.riders[i] = null;
      r.dismount();
      r.vx = (G.stools[i] < -10 ? -1 : 1) * this.facing * 0.8;
    }
    this.startAbandon();
  }

  // ------------------------------------------------------------------------------- tick

  override update(): void {
    super.update();
    if (!this.dead) {
      this.roll += this.vx;
      for (const r of this.riders) if (r && r.seat === this) r.syncSeat();
    }
  }

  protected override think(): void {
    this.modeT++;
    if (this.mode === 'abandon') return this.thinkAbandon();
    if (this.aboard === 0) return this.startAbandon();
    const t = this.target();
    let want = 0;
    if (t) {
      const ahead = (t.x - this.x) * this.facing;
      if (ahead < -PARTY_BIKE.behind) {
        if (++this.behindT >= PARTY_BIKE.turnAfter && Math.abs(this.vx) < 0.05) {
          this.facing = this.facing > 0 ? -1 : 1;
          this.behindT = 0;
        }
      } else this.behindT = 0;
      if (this.mode === 'roll' && ahead <= this.stopAt && (ahead <= PARTY_BIKE.minGap || this.inView())) this.setMode('stop');
      else if (this.mode === 'stop' && ahead > this.stopAt + PARTY_BIKE.rollOn) this.setMode('roll');
      if (this.mode === 'roll' && ahead > -PARTY_BIKE.behind) want = PARTY_BIKE.roll;
    }
    // Walls, steps up and drops (a canal edge, a step down of more than 8 px) stop it.
    if (want > 0 && !this.roadAhead()) want = 0;
    this.vx = approach(this.vx, want * this.facing, PARTY_BIKE.accel);
  }

  /** The whole bike (canopy overhang included) is inside the view. */
  private inView(): boolean {
    const cam = this.world.camera;
    const half = G.halfWidth + 4;
    return this.x - half >= cam.left && this.x + half <= cam.right;
  }

  /** The street goes on in front of the nose: no wall, no step up, no drop of more than 8 px. */
  private roadAhead(): boolean {
    const t = this.world.terrain;
    // 10 px ahead of the nose: it brakes over 6 px (0.6 px/tick at 0.03).
    const x = this.x + this.facing * (G.halfWidth + 10);
    if (t.isSolid(x, this.y - 8)) return false;
    const floor = t.surfaceY(x, this.y - 6, this.y + 9);
    return Number.isFinite(floor);
  }

  private setMode(m: StagBeerBike['mode']): void {
    this.mode = m;
    this.modeT = 0;
  }

  private startAbandon(): void {
    if (this.mode === 'abandon' || this.dead) return;
    this.setMode('abandon');
    this.driverRuns();
  }

  private thinkAbandon(): void {
    this.vx = approach(this.vx, 0, 0.02);
    if (this.modeT >= PARTY_BIKE.abandonTicks && Math.abs(this.vx) < 0.05) this.convert();
  }

  /** The driver jumps off and runs, away from the nearest player. */
  private driverRuns(): void {
    if (!this.driverOn) return;
    this.driverOn = false;
    const t = this.target();
    const dir = t && t.x > this.x ? -1 : 1;
    const fx = tumble(this.world, ID.flee, this.x + G.driver[0] * this.facing, this.y, dir * 1.7, -1.5, { gravity: 0.15, life: 110, flipX: dir < 0, z: 31 });
    hudOf(this.world).bubble(fx, 'MIJN FIETS!', { ticks: 70, kind: 'gag' });
  }

  /** Every rider is down: the empty bike becomes the rideable `beer-bike`. */
  private convert(): void {
    if (this.converted || this.removed) return;
    this.converted = true;
    const v = this.world.spawn('beer-bike', this.x, this.y, { facing: this.facing });
    v.vx = 0;
    this.remove();
  }

  /**
   * Every reaction (SAY CHEESE, the gloat, the cower): the bike just rolls to a stop and keeps its
   * facing (the riders and the driver react on their own; a 100 px bike never turns on the spot).
   */
  protected override thinkReaction(_kind: ReactionKind): void {
    this.vx = approach(this.vx, 0, PARTY_BIKE.accel * 2);
  }

  // ------------------------------------------------------------------------------- damage

  /** Armour: bullets, lasers and flames ping off the body; blasts, the knife and rams count. */
  override onHit(d: Damage, part = 0): boolean {
    if (this.dead || this.removed) return false;
    if (d.kind === 'bullet' || d.kind === 'laser' || d.kind === 'fire') {
      this.world.audio.sfx('hit/armor');
      if (d.source) hitSpark(this.world, d.source.x, d.source.y, -d.dirX || -this.facing);
      return true;
    }
    return super.onHit(d, part);
  }

  /** Wrecked: the riders are thrown off, the driver runs, a blast and keg debris. */
  protected override onDeath(d: Damage): void {
    this.mode = 'wrecked';
    this.vx = 0;
    for (let i = 0; i < this.riders.length; i++) {
      const r = this.riders[i];
      this.riders[i] = null;
      if (!r || r.dead || r.seat !== this) continue;
      this.world.damage(r, { amount: 1e6, kind: 'explosion', dirX: d.dirX || -this.facing, owner: d.owner, source: this });
    }
    this.driverRuns();
    explosion(this.world, this.x, this.y - 20, 'm', { debris: 'metal' });
    const rng = this.world.fxRng;
    for (let i = 0; i < 7; i++) {
      FxEntity.spawn(this.world, {
        sprite: ID.debris,
        x: this.x + rng.range(-36, 36),
        y: this.y - rng.range(14, 34),
        vx: rng.range(-1.8, 1.8),
        vy: rng.range(-3.4, -1.6),
        gravity: 0.14,
        life: 60,
        loop: true,
        ticksPerFrame: 1000,
        frame: i % 4,
        z: 61,
      });
    }
    this.play('wreck', { restart: true, loop: false });
  }

  override onRemove(): void {
    // Despawned with riders on board: they go too (they never ride on without a bike).
    for (let i = 0; i < this.riders.length; i++) {
      const r = this.riders[i];
      this.riders[i] = null;
      if (r && r.seat === this && !r.dead) r.remove();
    }
    super.onRemove();
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    const x = this.x;
    const y = this.y;
    const f = this.facing;
    const flip = f < 0;
    const t = this.world.tick;
    opts.flipX = flip;
    plain.flipX = flip;
    const phase = ((Math.floor((this.roll * f) / 3) % 4) + 4) % 4;
    if (this.dead) {
      if (this.corpseTicks - this.deathTicks < 20 && this.deathTicks % 4 < 2) return;
      opts.flash = false;
      for (const w of G.farWheels) r.sprite(ID.far, 0, x + w[0] * f, y + w[1], opts);
      r.sprite(ID.wreck, 0, x, y, opts);
      for (const w of G.nearWheels) r.sprite(ID.wheel, 0, x + w[0] * f, y + w[1], opts);
      return;
    }
    opts.flash = this.flashTicks > 0 && t % 2 === 0;
    plain.flash = false;
    for (const w of G.farWheels) r.sprite(ID.far, phase, x + w[0] * f, y + w[1], plain);
    r.sprite(ID.body, this.hp <= this.maxHp / 3 ? 1 : 0, x, y, opts);
    r.sprite(ID.turret, 0, x, y, opts);
    // Riders back to front (along the facing), then the driver.
    const order = f > 0 ? ORDER_RIGHT : ORDER_LEFT;
    for (const i of order) {
      const rd = this.riders[i];
      if (rd && rd.seat === this && !rd.dead) rd.drawSeated(r);
    }
    if (this.driverOn) r.sprite(ID.driver, Math.abs(this.vx) > 0.1 ? (t >> 3) & 1 : 0, x + G.driver[0] * f, y, plain);
    r.sprite(ID.posts, 0, x, y, opts);
    for (const w of G.nearWheels) r.sprite(ID.wheel, phase, x + w[0] * f, y + w[1], opts);
  }
}

defineEntity('stag-beer-bike', (w, x, y, p) => new StagBeerBike(w, x, y, p), {
  category: 'enemy',
  score: PARTY_BIKE.score,
  description: 'Enemy beer bike (ams): 2–4 stag partiers on the stools fire corks in turn; armoured body (400 HP, blasts / knife), +2,000 wrecked; every rider down → the rideable beer-bike.',
});
