/**
 * `beer-bike` — the rideable beer bike (docs/design/ams-extras.md §2.3): what is left of a stag
 * party's bike once its riders are down (content/stag `stag-beer-bike`), or parked by a script.
 *
 * - 3 cells, the vehicle rules of GDD §8.1 (mount, eject, cells, DANGER, doomed, ram,
 *   carry-over: the id goes into a section's `vehicles` list). HUD name `BIERFIETS`.
 * - Pedal drive (a `GroundVehicle`): accel 0.08 to 1.4 px/tick, brake 0.12, a small hop (vy −2.6),
 *   no glide, no squash. It cannot swim: deep water destroys it at once and throws the pilot up,
 *   like a pit (GroundVehicle.checkWater).
 * - Gun (fire): the CORK CANNON, the brass tap of the keg on the roof: it aims in 22.5° steps (one
 *   step per 2 ticks) from forward (0°) to straight up (−90°): up = −90°, up + forward = −45°.
 *   10 damage, speed 7, cooldown 6, unlimited.
 * - Bomb: the KEG ROLL (shells: 10 at the start, +10 per bomb pickup): a keg rolls along the floor
 *   at 2.5 px/tick, drops down steps, and explodes on an enemy, at a wall or after 120 ticks
 *   (150 in r 24); into deep water it just splashes.
 * - Special (fire + bomb): FOAM SPRAY — a foam cone in front (64 px): soft enemies in it are
 *   knocked back 12 px and enemy shots in it are erased (for 16 ticks); 3 shells, cooldown 240.
 * - Ram (fire + jump): the pilot jumps off, the bike rolls on at 3.0 px/tick and crashes
 *   (400 in r 40); the bike is lost.
 * - 2P: the bar counter's top is a one-way platform (`world.addSolid`) the partner can ride on
 *   while the bike is driven (an empty bike has none: jump at it and you land by the seat).
 * - Parked and empty: the bell rings now and then (the empty gag).
 */
import { Entity } from '../../../../engine/entity';
import type { VirtualPad } from '../../../../engine/input';
import { overlaps, type Rect } from '../../../../engine/math';
import { Body, moveBody, pushX, SolidBox } from '../../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import type { EjectMode } from '../../../events';
import { explosion, FxEntity, splash } from '../../../fx';
import { eraseEnemyShots, Projectile } from '../../../projectile';
import { defineEntity, defineWeapon, type SpawnParams } from '../../../registry';
import { aimAngle, aimDirOf } from '../../../weapons';
import { waterSurfaceAt } from '../../../water';
import { drawDriver, GroundVehicle, isSquashable } from '../fleet/common';
import { ART } from './art';
import { BEER_BIKE as G, TURRET_STEPS, turretAngle, turretMuzzle } from './geometry';

/** Beer-bike numbers (NORMAL). */
export const BIKE = {
  name: 'BIERFIETS',
  cells: 3,
  shells: 10,
  speed: 1.4,
  accel: 0.08,
  brake: 0.12,
  jump: -2.6,
  /** Ticks per 22.5° turret step. */
  turretTicks: 2,
  cannon: { damage: 10, speed: 7, cooldown: 6, w: 6, h: 4, life: 70 },
  keg: { speed: 2.5, life: 120, damage: 150, radius: 24, cooldown: 30 },
  foam: { reach: 64, half: 14, push: 12, cost: 3, cooldown: 240, eraseTicks: 16 },
  /** `front`: the crash blast's centre ahead of the anchor (the nose is at +46). */
  ram: { speed: 3.0, distance: 200, damage: 400, radius: 40, front: 26 },
  /** The empty gag: a bell now and then. */
  bellEvery: 240,
} as const;

const ID = {
  body: `${ART}/body`,
  posts: `${ART}/posts`,
  turret: `${ART}/turret`,
  wheel: `${ART}/wheel`,
  far: `${ART}/wheel-far`,
  wreck: `${ART}/wreck`,
  keg: `${ART}/keg`,
  cork: `${ART}/cork`,
  foam: `${ART}/foam`,
} as const;

const pt: [number, number] = [0, 0];
const opts: DrawOpts = {};
const plain: DrawOpts = {};
const tint: DrawOpts = { tint: 0xff3020ff, alpha: 0.45 };
const foamRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

// ---------------------------------------------------------------------------------------------
// The rolling keg (bomb)
// ---------------------------------------------------------------------------------------------

/** A keg rolling along the floor (see the header): explodes on an enemy, a wall or its timer. */
export class RollingKeg extends Entity {
  readonly owner: number;
  t = 0;
  private rolled = 0;

  constructor(world: World, x: number, y: number, dir: 1 | -1, owner: number) {
    super(world, x, y);
    this.type = 'beer-keg';
    this.team = 'player';
    this.owner = owner;
    this.facing = dir;
    this.z = 45;
    this.body = new Body({ w: 8, h: 9 });
    this.hitbox = { x: -5, y: -10, w: 10, h: 10 };
    this.vx = dir * BIKE.keg.speed;
    this.despawnMargin = 64;
    this.addTag('keg');
  }

  override update(): void {
    this.t++;
    const c = moveBody(this, this.world.terrain, this.world);
    // It keeps rolling (no friction); in the air it falls and drops down steps.
    this.vx = this.facing * BIKE.keg.speed;
    this.rolled += Math.abs(this.vx);
    if (this.t % 18 === 1 && c.onGround) this.world.audio.sfx('ams/keg-roll', { vol: 0.4 });
    const surface = waterSurfaceAt(this, this.x, this.y - 32);
    if (Number.isFinite(surface) && this.y > surface + 4) {
      splash(this.world, this.x, surface, 8);
      this.remove();
      return;
    }
    if (c.hitWall || this.t >= BIKE.keg.life || this.touchesEnemy()) this.burst();
  }

  private touchesEnemy(): boolean {
    const box = this.hitRect();
    const list = this.world.byTag('shootable');
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive || e.team !== 'enemy') continue;
      const hb = e.hurtboxes();
      for (let k = 0; k < hb.length; k++) if (overlaps(box, hb[k])) return true;
    }
    return false;
  }

  /** 150 in r 24 (no falloff), credited to the pilot who rolled it. */
  burst(): void {
    if (this.removed) return;
    explosion(this.world, this.x, this.y - 5, 's', { damage: BIKE.keg.damage, radius: BIKE.keg.radius, falloff: 0, team: 'player', owner: this.owner, source: this, weapon: 'beer-keg-roll' });
    this.dead = true;
    this.remove();
  }

  override draw(r: Renderer): void {
    plain.flipX = this.facing < 0;
    plain.flash = false;
    r.sprite(ID.keg, Math.floor(this.rolled / 4) % 4, this.x, this.y - 6, plain);
  }
}

// ---------------------------------------------------------------------------------------------
// Weapons
// ---------------------------------------------------------------------------------------------

defineWeapon({
  id: 'beer-cork-cannon',
  name: 'CORK CANNON',
  kind: 'vehicle',
  ammo: Infinity,
  pose: 'heavy',
  cooldown: BIKE.cannon.cooldown,
  auto: true,
  sfx: 'ams/cork-cannon',
  fire(ctx) {
    const p = Projectile.spawn(ctx.world, {
      team: ctx.team,
      x: ctx.x,
      y: ctx.y,
      vx: ctx.dirX * BIKE.cannon.speed,
      vy: ctx.dirY * BIKE.cannon.speed,
      damage: BIKE.cannon.damage,
      kind: 'bullet',
      owner: ctx.owner,
      shooter: ctx.shooter,
      life: BIKE.cannon.life,
      w: BIKE.cannon.w,
      h: BIKE.cannon.h,
      sprite: ID.cork,
      look: 'anim',
      ticksPerFrame: 3,
      type: 'beer-cork',
      weapon: 'beer-cork-cannon',
    });
    ctx.gun.track(p);
  },
});

defineWeapon({
  id: 'beer-keg-roll',
  name: 'KEG ROLL',
  kind: 'vehicle',
  ammo: Infinity,
  pose: 'heavy',
  cooldown: BIKE.keg.cooldown,
  auto: false,
  holdRepeat: null,
  sfx: 'ams/keg-roll',
  icon: 'ui/icon-shell',
  fire(ctx) {
    ctx.world.add(new RollingKeg(ctx.world, ctx.x, ctx.y, ctx.facing, ctx.owner));
  },
});

// ---------------------------------------------------------------------------------------------
// The bike
// ---------------------------------------------------------------------------------------------

export class BeerBike extends GroundVehicle {
  /** Cork-cannon step 0 (forward) … 4 (up). */
  step = 0;
  private stepT = 0;
  /** Foam spray: cooldown left, and ticks it still erases shots. */
  foamCool = 0;
  foamT = 0;
  /** The partner's perch on the bar counter (one-way platform). */
  readonly perch: SolidBox;
  private perchFacing: 1 | -1;

  constructor(world: World, x: number, y: number, params: SpawnParams) {
    super(world, x, y, params, {
      art: ART,
      name: BIKE.name,
      w: G.body.w,
      h: G.body.h,
      hurt: G.hurt,
      seat: { x: 10, y: -34, w: 24, h: 26 },
      seatPoint: G.driver,
      cells: BIKE.cells,
      shells: BIKE.shells,
      mainGun: 'beer-cork-cannon',
      cannon: 'beer-keg-roll',
      specialCost: BIKE.foam.cost,
      speed: BIKE.speed,
      accel: BIKE.accel,
      jump: BIKE.jump,
      brake: BIKE.brake,
      ramSpeed: BIKE.ram.speed,
      ramDistance: BIKE.ram.distance,
      ramDamage: BIKE.ram.damage,
      ramRadius: BIKE.ram.radius,
      squashSpeed: 99,
      squashInclusive: false,
      halfWidth: G.halfWidth,
      hatch: [G.driver[0], -32],
      driverAnchor: [G.driver[0], 0],
    });
    this.perchFacing = this.facing;
    this.perch = world.addSolid(new SolidBox(this.perchX(), y + G.counter.top, G.counter.x1 - G.counter.x0, 4, true, this));
  }

  /** World x of the perch's left edge for the current facing. */
  private perchX(): number {
    return this.facing > 0 ? this.x + G.counter.x0 : this.x - G.counter.x1;
  }

  override update(): void {
    super.update();
    if (this.foamCool > 0) this.foamCool--;
    if (this.foamT > 0) {
      this.foamT--;
      eraseEnemyShots(this.world, this.foamBox());
    }
    this.updatePerch();
  }

  /**
   * The perch follows the counter (riders are carried); only while somebody drives (an empty bike
   * has none: a player who jumps at it lands by the seat and mounts, not on the counter), off while
   * the bike rams or burns.
   */
  private updatePerch(): void {
    const box = this.perch;
    box.enabled = !this.removed && (this.state === 'driven' || this.state === 'doomed');
    const tx = this.perchX();
    const ty = this.y + G.counter.top;
    if (this.facing !== this.perchFacing) {
      // A turn moves the counter to the other side of the anchor: no carry (no 30 px jump).
      this.perchFacing = this.facing;
      box.x = tx;
      box.y = ty;
      return;
    }
    const dx = tx - box.x;
    const dy = ty - box.y;
    if (dx !== 0 || dy !== 0) this.world.moveSolid(box, dx, dy);
  }

  /** The cork cannon steps toward up (−90°) or up + forward (−45°), one step per 2 ticks. */
  protected override updateAim(pad: VirtualPad): void {
    const ax = pad.axisX();
    let target = 0;
    if (pad.held('up')) target = ax !== 0 && ax === this.facing ? 2 : TURRET_STEPS - 1;
    if (target !== this.step) {
      if (++this.stepT >= BIKE.turretTicks) {
        this.stepT = 0;
        this.step += target > this.step ? 1 : -1;
      }
    } else this.stepT = 0;
    this.aimElev = turretAngle(this.step);
  }

  /** World muzzle of the cork cannon. */
  muzzleWorld(out: [number, number]): [number, number] {
    turretMuzzle(this.step, out);
    out[0] = this.x + out[0] * this.facing;
    out[1] = this.y + out[1];
    return out;
  }

  protected override fireMain(): void {
    const m = this.muzzleWorld(pt);
    this.mainGun.fire(this.fireArgs(m[0], m[1], aimAngle(this.facing, this.aimElev), aimDirOf(this.aimElev)));
  }

  protected override fireCannon(): void {
    const x = this.x + G.kegStart[0] * this.facing;
    this.cannonGun.fire(this.fireArgs(x, this.y + G.kegStart[1], this.facing > 0 ? 0 : Math.PI, 'forward'));
  }

  /** The foam cone in front (world rect). */
  foamBox(): Rect {
    const x0 = this.x + G.foamStart[0] * this.facing;
    foamRect.x = this.facing > 0 ? x0 : x0 - BIKE.foam.reach;
    foamRect.y = this.y + G.foamStart[1] - BIKE.foam.half;
    foamRect.w = BIKE.foam.reach;
    foamRect.h = BIKE.foam.half * 2;
    return foamRect;
  }

  /** FOAM SPRAY: knock soft enemies back 12 px, erase enemy shots for 16 ticks. */
  protected override special(): boolean {
    if (this.foamCool > 0) return false;
    this.foamCool = BIKE.foam.cooldown;
    this.foamT = BIKE.foam.eraseTicks;
    const box = this.foamBox();
    eraseEnemyShots(this.world, box);
    const list = this.world.snapshotTag('soft');
    try {
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!isSquashable(e) || !touchesBox(e, box)) continue;
        const dx = BIKE.foam.push * this.facing;
        if (e.body) pushX(e, dx, this.world.terrain, this.world);
        else e.x += dx;
      }
    } finally {
      this.world.releaseSnapshot();
    }
    FxEntity.spawn(this.world, { sprite: ID.foam, x: this.x + G.foamStart[0] * this.facing, y: this.y + G.foamStart[1], flipX: this.facing < 0, z: 62 });
    this.world.audio.sfx('ams/foam');
    return true;
  }

  /** The HUD's special-ready gem: the spray's cooldown is done and the shells cover it. */
  override get specialReady(): boolean {
    return this.foamCool <= 0 && this.shells >= BIKE.foam.cost;
  }

  /** The empty gag: the bell on the handlebar. */
  protected override onGag(): void {
    if (this.onScreen(0)) this.world.audio.sfx('ams/beer-bell', { vol: 0.5 });
  }

  override eject(mode: EjectMode = 'exit'): void {
    super.eject(mode);
    if (this.state === 'ram') this.world.audio.sfx('ams/beer-creak');
  }

  /**
   * Burst into planks and keg hoops on top of the blast. The ram's crash centres its r 40 on the
   * front half (the nose is 46 px ahead of the anchor: a blast round the anchor missed the very
   * enemy the bike ran into).
   */
  override explode(damage = this.wreckDamage, radius = this.wreckRadius): void {
    if (this.removed) return;
    const w = this.world;
    const ramming = this.state === 'ram';
    for (let i = 0; i < 6; i++) {
      FxEntity.spawn(w, {
        sprite: `${ART}/debris`,
        x: this.x + w.fxRng.range(-30, 30),
        y: this.y - w.fxRng.range(12, 30),
        vx: w.fxRng.range(-1.8, 1.8),
        vy: w.fxRng.range(-3.4, -1.6),
        gravity: 0.14,
        life: 56,
        loop: true,
        ticksPerFrame: 1000,
        frame: i % 4,
        z: 61,
      });
    }
    if (ramming && !this.driver) {
      explosion(w, this.x + BIKE.ram.front * this.facing, this.y + this.hitbox.y / 2, 'l', { damage, radius, falloff: 0, team: 'player', owner: this.lastDriver, debris: 'metal' });
      this.dead = true;
      this.remove();
      return;
    }
    super.explode(damage, radius);
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    const x = this.x;
    const y = this.y;
    const f = this.facing;
    const flip = f < 0;
    opts.flipX = flip;
    plain.flipX = flip;
    tint.flipX = flip;
    const t = this.world.tick;
    const phase = ((Math.floor((this.roll * f) / 3) % 4) + 4) % 4;
    if (this.state === 'wreck') {
      opts.flash = t % 4 < 2;
      for (const w of G.farWheels) r.sprite(ID.far, 0, x + w[0] * f, y + w[1], plain);
      r.sprite(ID.wreck, 0, x, y, opts);
      for (const w of G.nearWheels) r.sprite(ID.wheel, 0, x + w[0] * f, y + w[1], opts);
      return;
    }
    const flash = this.flashOn();
    const moving = Math.abs(this.vx) > 0.2;
    // A creaky sway while pedalling, a drunken wobble while it rams.
    const bob = this.state === 'ram' ? ((t >> 2) & 1) * 2 - 1 : moving ? (t >> 3) & 1 : 0;
    const by = y - bob;
    plain.flash = false;
    for (const w of G.farWheels) r.sprite(ID.far, phase, x + w[0] * f, y + w[1], plain);
    opts.flash = flash;
    const damaged = this.cells <= 1 ? 1 : 0;
    r.sprite(ID.body, damaged, x, by, opts);
    r.sprite(ID.turret, this.step, x, by, opts);
    if (this.driver) drawDriver(r, this.driver, x + G.driver[0] * f, by + G.driver[1], flip);
    r.sprite(ID.posts, 0, x, by, opts);
    for (const w of G.nearWheels) r.sprite(ID.wheel, phase, x + w[0] * f, y + w[1], opts);
    if (this.redTint()) {
      r.sprite(ID.body, damaged, x, by, tint);
      r.sprite(ID.turret, this.step, x, by, tint);
    }
  }
}

function touchesBox(e: Entity, box: Rect): boolean {
  const hb = e.hurtboxes();
  for (let k = 0; k < hb.length; k++) if (overlaps(hb[k], box)) return true;
  return false;
}

defineEntity('beer-bike', (w, x, y, p) => new BeerBike(w, x, y, p), {
  category: 'vehicle',
  description: 'BIERFIETS (ams): the rideable beer bike (3 cells; cork cannon, keg roll, FOAM SPRAY; the counter is a 2P perch; deep water wrecks it).',
});

defineEntity('beer-keg', (w, x, y, p) => new RollingKeg(w, x, y, p.facing === -1 || p.facing === 'left' ? -1 : 1, -1), {
  category: 'projectile',
  description: 'BIERFIETS keg roll: rolls 2.5 px/tick along the floor, 150 in r 24 on an enemy, a wall or after 120 ticks.',
});
