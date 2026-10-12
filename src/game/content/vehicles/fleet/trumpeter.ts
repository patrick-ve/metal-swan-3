/**
 * `trumpeter` — SWAN-3 flight mode "TRUMPETER" (GDD §8.5, §6.3; look: swan-mount/look.md §14),
 * the ship of the m5-a shoot-em-up. Players start mounted (`SectionDef.startVehicle`) and get a
 * new one on every respawn (the mission runner spawns it and calls `mount`).
 *
 * - Flight: free 8-way at 2.0 px/tick (1.4 per axis on diagonals), no gravity, always facing
 *   right, kept 4 px inside the view (the whole ship with its rider). 3 cells; touching a small
 *   enemy destroys it and costs ½ cell. Hurtbox: the hull only, 28×14.
 * - The driver's anchor is 15 px below the hull centre (`syncDriver`, ARCHITECTURE §6.1), so enemy
 *   shots aimed at a target's centre (y − 15) fly at the hull. The rider sits astride the seat pad
 *   (`ride-lean`; `ride-hold` on a dive bomb or a hard bank; `ride-ears` on HONK; `ride-cheer`
 *   when a boss dies).
 * - `trumpeter-twin-gun` (fire): 2 parallel `twin-bullet`s 4 px apart every 6 ticks, 10 damage
 *   each, speed 9. `trumpeter-dive-bomb` (bomb): a `dive-bomb` dropped with the ship's speed,
 *   gravity 0.2, 150 in r 20, cooldown 20, 20 bombs. `trumpeter-honk` (fire + bomb): a 10-tick
 *   wind-up (she hangs still), then a ring 0 → 128 px in 16 ticks: 80 to every enemy part it
 *   touches (once), erases enemy shots, infantry cover their ears 60 ticks. 3 bombs, cooldown 240;
 *   with fewer than 3 bombs a sad `swan/squeak`.
 * - BAIL OUT (down + jump, or fire + jump): the pilot somersaults off under a swan parachute
 *   (status `swan-parachute`: falls 0.5 px/tick, invulnerable, pistol only); the empty ship flies
 *   on as a missile at 4 px/tick (400 in r 40). 60 ticks later a backup Trumpeter swoops in from
 *   the left and picks him up with 1 cell and 5 bombs; the next bail-out waits 900 ticks.
 * - Destroyed: the last cell costs the pilot a life (`pilotDiesWithVehicle`). A respawned pilot
 *   flies in from the left edge (3 cells, 20 bombs, 120 invulnerable ticks from the runner).
 * - Pickups: `pickup-bombs` +10, `pickup-repair` +1 cell, and every weapon pickup +10 dive bombs.
 *
 * Mission API: `flyTo(x, y, speed?)` / `arrived` / `releaseAutopilot()` (e.g. into the landing
 * hatch at the end of m5-a), `cheer(ticks?)`, `variant` ('ivory' | 'mute'; spawn param
 * `variant: 'mute'`, else P2 gets the Mute).
 */
import type { SfxOpts } from '../../../../engine/audio';
import { Entity, hostile, type Damage } from '../../../../engine/entity';
import type { VirtualPad } from '../../../../engine/input';
import { approach, clamp, distToRect, overlaps, type Rect } from '../../../../engine/math';
import { PAL } from '../../../../engine/palette';
import type { ParticlePreset } from '../../../../engine/particles';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { hudOf } from '../../../context';
import { Enemy } from '../../../enemy';
import type { EjectMode } from '../../../events';
import { explosion, FxEntity } from '../../../fx';
import type { Player, RidePose } from '../../../player/player';
import type { StatusEffectDef } from '../../../player/status';
import { eraseEnemyShots, Projectile, type ProjectileOpts } from '../../../projectile';
import { defineEntity, defineStatus, defineWeapon, paramBool, paramStr, type SpawnParams } from '../../../registry';
import { TUNING } from '../../../tuning';
import { Vehicle } from '../../../vehicle';
import { ART, DIVE_BOMB, HONK, TRUMPETER, TWIN } from './numbers';

/** What the ship is doing (on top of the base Vehicle state). */
export type TrumpeterMode = 'fly' | 'flyin' | 'honk' | 'auto' | 'backup-wait' | 'backup' | 'leave';
export type TrumpeterVariant = 'ivory' | 'mute';

interface SkinIds {
  readonly idle: string;
  readonly front: string;
  readonly jet: string;
  readonly special: string;
  readonly specialFront: string;
  readonly dive: string;
  readonly wreck: string;
  readonly gag: string;
  readonly feather: string;
}
function skin(prefix: string): SkinIds {
  return {
    idle: `${prefix}/idle`,
    front: `${prefix}/front`,
    jet: `${prefix}/jet`,
    special: `${prefix}/special`,
    specialFront: `${prefix}/special-front`,
    dive: `${prefix}/dive`,
    wreck: `${prefix}/wreck`,
    gag: `${prefix}/empty-gag`,
    feather: `${prefix}/feather`,
  };
}
const SKINS: Readonly<Record<TrumpeterVariant, SkinIds>> = { ivory: skin(ART.trumpeter), mute: skin(ART.trumpeterMute) };
const PARACHUTE_SPRITE = `${ART.trumpeter}/parachute`;

const scratch: Rect = { x: 0, y: 0, w: 0, h: 0 };
const scratch2: Rect = { x: 0, y: 0, w: 0, h: 0 };
const opts: DrawOpts = {};
const tint: DrawOpts = { tint: 0xff3020ff, alpha: 0.45 };
const lineOpts: DrawOpts = {};
const SONIC: readonly string[] = ['sonic'];
const FLAP_SOFT: SfxOpts = { vol: 0.6 };
const FLAP_FRAMES = 4;

/** Jet exhaust sparks (cosmetic). */
const EXHAUST: ParticlePreset = { kind: 'pixel', life: [6, 12], drag: 0.9, colors: [PAL.fire[5], PAL.fire[3], PAL.fire[1]], additive: true };

// ---------------------------------------------------------------------------------------------
// Weapons and projectiles
// ---------------------------------------------------------------------------------------------

/** Reused projectile options (Projectile.init copies what it needs). */
const twinSpec: ProjectileOpts = {
  team: 'player',
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  damage: TWIN.damage,
  kind: 'bullet',
  life: TWIN.life,
  w: TWIN.w,
  h: TWIN.h,
  sprite: ART.twinBullet,
  type: 'twin-bullet',
  weapon: 'trumpeter-twin-gun',
};

defineWeapon({
  id: 'trumpeter-twin-gun',
  name: 'TWIN BEAK GUN',
  kind: 'vehicle',
  ammo: Infinity,
  pose: 'heavy',
  cooldown: TWIN.cooldown,
  auto: true,
  maxShotsOnScreen: TWIN.maxOnScreen,
  sfx: 'swan/fire',
  fire(ctx) {
    // One bore in each half of the split bill: two bullets 4 px apart.
    for (let k = -1; k <= 1; k += 2) {
      twinSpec.team = ctx.team;
      twinSpec.x = ctx.x;
      twinSpec.y = ctx.y + (k * TWIN.gap) / 2;
      twinSpec.vx = ctx.dirX * TWIN.speed;
      twinSpec.vy = ctx.dirY * TWIN.speed;
      twinSpec.owner = ctx.owner;
      twinSpec.shooter = ctx.shooter;
      ctx.gun.track(Projectile.spawn(ctx.world, twinSpec));
    }
    twinSpec.shooter = null;
  },
});

/** A dive bomb's blast: 150 in r 20 (each target once, no falloff). */
function bombBlast(p: Projectile, target: Entity | null, x: number, y: number): void {
  explosion(p.world, x, y, 'm', {
    damage: DIVE_BOMB.damage,
    radius: DIVE_BOMB.radius,
    falloff: 0,
    team: p.team,
    owner: p.damage.owner,
    weapon: 'trumpeter-dive-bomb',
    debris: target ? 'metal' : 'dirt',
  });
}

const bombSpec: ProjectileOpts = {
  team: 'player',
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  damage: DIVE_BOMB.damage,
  kind: 'explosion',
  gravity: DIVE_BOMB.gravity,
  life: DIVE_BOMB.life,
  w: DIVE_BOMB.w,
  h: DIVE_BOMB.h,
  sprite: ART.diveBomb,
  impact: 'none',
  offscreen: 24,
  type: 'dive-bomb',
  weapon: 'trumpeter-dive-bomb',
};

function dropBomb(world: World, team: ProjectileOpts['team'], x: number, y: number, vx: number, vy: number, owner: number, shooter: Entity | null): Projectile {
  bombSpec.team = team;
  bombSpec.x = x;
  bombSpec.y = y;
  bombSpec.vx = vx;
  bombSpec.vy = vy;
  bombSpec.owner = owner;
  bombSpec.shooter = shooter;
  bombSpec.onImpact = bombBlast;
  const p = Projectile.spawn(world, bombSpec);
  bombSpec.shooter = null;
  bombSpec.onImpact = null;
  return p;
}

defineWeapon({
  id: 'trumpeter-dive-bomb',
  name: 'DIVE BOMB',
  kind: 'vehicle',
  ammo: Infinity,
  pose: 'heavy',
  cooldown: DIVE_BOMB.cooldown,
  auto: false,
  holdRepeat: null,
  sfx: 'weapon/grenade-throw',
  icon: 'ui/icon-shell',
  fire(ctx) {
    // Dropped with the ship's speed (GDD §6.3).
    dropBomb(ctx.world, ctx.team, ctx.x, ctx.y, ctx.vx, ctx.vy, ctx.owner, ctx.shooter);
    if (ctx.shooter instanceof Trumpeter) ctx.shooter.holdOn();
  },
});

defineWeapon({
  id: 'trumpeter-honk',
  name: 'HONK',
  kind: 'vehicle',
  ammo: Infinity,
  pose: 'heavy',
  cooldown: HONK.cooldown,
  auto: false,
  holdRepeat: null,
  fire(ctx) {
    if (ctx.shooter instanceof Trumpeter) ctx.shooter.startHonk();
  },
});

defineEntity(
  'twin-bullet',
  (w, x, y, p) => {
    twinSpec.x = x;
    twinSpec.y = y;
    twinSpec.vx = (p.facing === -1 || p.facing === 'left' ? -1 : 1) * TWIN.speed;
    twinSpec.vy = 0;
    twinSpec.owner = -1;
    twinSpec.team = 'player';
    return Projectile.spawn(w, twinSpec);
  },
  { category: 'projectile', description: 'TRUMPETER twin beak gun bullet (10 damage, speed 9).' },
);
defineEntity('dive-bomb', (w, x, y) => dropBomb(w, 'player', x, y, 0, 0, -1, null), {
  category: 'projectile',
  description: 'TRUMPETER dive bomb (gravity 0.2, 150 in r 20).',
});

// ---------------------------------------------------------------------------------------------
// HONK ring
// ---------------------------------------------------------------------------------------------

/**
 * The HONK shockwave (as the Swan's, GDD §8.2): a ring that grows 8 px/tick to 128 px around the
 * point where the wind-up ended. 80 to every enemy part it touches (once each), erases enemy
 * shots inside it, and Legion infantry it reaches cover their ears for 60 ticks.
 */
export class HonkRing extends Entity {
  radius = 0;
  owner: number;
  private t = 0;
  private readonly hitE: Entity[] = [];
  private readonly hitP: number[] = [];
  private readonly heard: Entity[] = [];
  private readonly source: Entity | null;
  private readonly circle = { x: 0, y: 0, r: 0 };

  constructor(world: World, x: number, y: number, owner: number, source: Entity | null) {
    super(world, x, y);
    this.type = 'trumpeter-honk';
    this.team = 'player';
    this.owner = owner;
    this.source = source;
    this.z = 60;
    this.despawnMargin = Infinity;
  }

  override update(): void {
    this.t++;
    if (this.t > HONK.maxRadius / HONK.grow + 6) {
      this.remove();
      return;
    }
    this.radius = Math.min(HONK.maxRadius, this.t * HONK.grow);
    const circle = this.circle;
    circle.x = this.x;
    circle.y = this.y;
    circle.r = this.radius;
    eraseEnemyShots(this.world, circle);
    const list = this.world.snapshotTag('shootable');
    try {
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive || !hostile(this.team, e.team)) continue;
        const hb = e.hurtboxes();
        for (let k = 0; k < hb.length; k++) {
          if (distToRect(this.x, this.y, hb[k]) > this.radius || this.wasHit(e, k)) continue;
          this.hitE.push(e);
          this.hitP.push(k);
          const d: Damage = { amount: HONK.damage, kind: 'impact', dirX: e.x < this.x ? -1 : 1, owner: this.owner, source: this, weapon: 'trumpeter-honk', tags: SONIC };
          this.world.damage(e, d, k);
          if (!e.alive) break;
        }
        if (e instanceof Enemy && e.alive && !this.heard.includes(e)) {
          this.heard.push(e);
          e.react('ears', HONK.earsTicks, this.source);
        }
      }
    } finally {
      this.world.releaseSnapshot();
    }
  }

  private wasHit(e: Entity, part: number): boolean {
    for (let i = 0; i < this.hitE.length; i++) if (this.hitE[i] === e && this.hitP[i] === part) return true;
    return false;
  }

  override draw(r: Renderer): void {
    const R = this.radius;
    if (R <= 0) return;
    const fade = this.t > HONK.maxRadius / HONK.grow ? 0.5 : 1;
    ring(r, this.x, this.y, R, PAL.snow[3], fade);
    if (R > 6) ring(r, this.x, this.y, R - 3, PAL.gold[2], fade * 0.8);
    if (R > 14) ring(r, this.x, this.y, R - 8, PAL.gold[1], fade * 0.45);
  }
}

/** A 1-px circle of short lines (no sprite for a ring up to 257 px across). */
function ring(r: Renderer, cx: number, cy: number, R: number, c: number, alpha: number): void {
  const n = Math.max(12, Math.min(64, Math.round(R / 2)));
  lineOpts.alpha = alpha;
  let x0 = cx + R;
  let y0 = cy;
  for (let i = 1; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x1 = cx + Math.cos(a) * R;
    const y1 = cy + Math.sin(a) * R;
    r.line(Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), c, lineOpts);
    x0 = x1;
    y0 = y1;
  }
}

// ---------------------------------------------------------------------------------------------
// The swan parachute (a player status while bailed out)
// ---------------------------------------------------------------------------------------------

const chuteOpts: DrawOpts = {};
const CHUTE_TICKS = 600;

/**
 * Under the swan-shaped parachute (GDD §8.5): a short somersault, then a 0.5 px/tick fall;
 * invulnerable; the pistol only, fired forward. Never below the view (the backup is coming).
 * The backup removes it on the pick-up (the 600 ticks are only a safety net).
 */
export const PARACHUTE: StatusEffectDef = defineStatus({
  id: 'swan-parachute',
  ticks: CHUTE_TICKS,
  gravity: 0,
  weapon: 'pistol',
  noBomb: true,
  noMount: true,
  noJump: true,
  noCrouch: true,
  onHit: () => true,
  onTick(p, left) {
    const age = CHUTE_TICKS - left;
    if (age < TRUMPETER.chuteOpen) p.vy += TUNING.physics.gravity;
    else p.vy = approach(p.vy, TRUMPETER.chuteFall, 0.3);
    // Stay in the view: the canopy (52 px over his feet) under the top edge, his feet above the bottom.
    const cam = p.world.camera;
    const top = cam.top + TRUMPETER.chuteTop;
    if (p.y < top) {
      p.y = top;
      if (p.vy < 0) p.vy = 0;
    }
    const bottom = cam.bottom - 6;
    if (p.y > bottom) {
      p.y = bottom;
      if (p.vy > 0) p.vy = 0;
    }
  },
  onDraw(p, r, left) {
    const age = CHUTE_TICKS - left;
    if (age < TRUMPETER.chuteOpen || p.state !== 'play') return;
    const x = Math.round(p.x);
    const top = Math.round(p.y) - 52;
    const sway = Math.round(Math.sin(age / 14) * 1.5);
    lineOpts.alpha = 1;
    r.line(x - 13 + sway, top + 13, x - 3, Math.round(p.y) - 22, PAL.stone[3], lineOpts);
    r.line(x + 13 + sway, top + 13, x + 3, Math.round(p.y) - 22, PAL.stone[3], lineOpts);
    chuteOpts.flipX = false;
    r.sprite(PARACHUTE_SPRITE, (age >> 4) & 1, x + sway, top + 14, chuteOpts);
  },
});

// ---------------------------------------------------------------------------------------------
// The ship
// ---------------------------------------------------------------------------------------------


export class Trumpeter extends Vehicle {
  mode: TrumpeterMode = 'fly';
  variant: TrumpeterVariant;
  /** Ticks until the next bail-out is allowed (900 after a backup pick-up). */
  bailLock = 0;
  /** Rider pose timers (ticks left). */
  holdT = 0;
  earsT = 0;
  cheerT = 0;
  /** HONK wind-up ticks left (she hangs still meanwhile). */
  honkT = 0;
  /** Ticks of the white hit flicker left (60 after a hit, GDD §8.1). */
  hitFlashT = 0;
  /**
   * Flight velocity relative to the view (px/tick). The view's own movement (the auto-scroll)
   * is added on top, so a ship with the stick released keeps its place on screen, as in every
   * shoot-em-up; `vx` / `vy` are the resulting world velocity (dive bombs inherit it).
   */
  flyVx = 0;
  flyVy = 0;
  /** The locked view's movement during the last tick (the auto-scroll), px/tick. */
  scrollVx = 0;
  scrollVy = 0;
  private lastCamX = Number.NaN;
  private lastCamY = Number.NaN;
  /** Blinking after a respawn fly-in. */
  private respawnBlink = false;
  private modeT = 0;
  private fetch: Player | null = null;
  private autoX = 0;
  private autoY = 0;
  private autoSpeed = 2;
  private variantFixed: boolean;
  /** The pilot's weapon before a pickup (a weapon pickup becomes dive bombs instead). */
  private keptWeapon = '';
  private keptAmmo = 0;
  private readonly offs: Array<() => void> = [];

  constructor(world: World, x: number, y: number, params: SpawnParams) {
    super(world, x, y, params, {
      art: ART.trumpeter,
      name: 'TRUMPETER',
      w: TRUMPETER.hull.w,
      h: TRUMPETER.hull.h,
      seat: TRUMPETER.seat,
      seatPoint: TRUMPETER.seatPoint,
      gunPoint: [TRUMPETER.muzzles[0][0], TRUMPETER.head[1]],
      cannonPoint: TRUMPETER.bombPoint,
      cells: TRUMPETER.cells,
      shells: TRUMPETER.shells,
      mainGun: 'trumpeter-twin-gun',
      cannon: 'trumpeter-dive-bomb',
      special: 'trumpeter-honk',
      specialCost: HONK.cost,
      speed: TRUMPETER.speed,
      accel: TRUMPETER.accel,
      jump: 0,
      ramSpeed: TRUMPETER.ramSpeed,
      ramDistance: TRUMPETER.ramDistance,
      ramDamage: TRUMPETER.ramDamage,
      ramRadius: TRUMPETER.ramRadius,
      pilotDiesWithVehicle: true,
      iceFriction: false,
    });
    this.hitbox = { ...TRUMPETER.hull };
    const b = this.body;
    if (b) {
      // A flyer: no gravity, no stepping or snapping, through one-way platforms.
      b.gravity = 0;
      b.maxFall = 8;
      b.stepUp = 0;
      b.snapDown = 0;
      b.platforms = false;
    }
    this.facing = 1;
    const v = paramStr(params, 'variant', '');
    this.variantFixed = v === 'mute' || v === 'ivory';
    this.variant = v === 'mute' ? 'mute' : 'ivory';
    if (paramBool(params, 'backup', false)) this.mode = 'backup-wait';
    this.offs.push(
      world.events.on('bossDefeated', () => {
        if (this.state === 'driven') this.cheer();
      }),
      world.events.on('pickup', (e) => {
        if (e.player === this.driver && e.item.type === 'pickup-weapon') this.weaponToBombs(e.player);
      }),
    );
  }

  // ------------------------------------------------------------------------------- mounting

  override mount(p: Player): void {
    const respawn = p.state === 'spawn';
    if (!this.variantFixed) {
      this.variantFixed = true;
      if (p.index === 1) this.variant = 'mute';
    }
    // A fresh ship placed at the pilot's start: keep the pilot where the section put him.
    if (this.age === 0 && !respawn && this.mode === 'fly') this.y = this.prevY = p.y - TRUMPETER.driverDy;
    super.mount(p);
    this.facing = 1;
    this.flyVx = this.flyVy = 0;
    p.status.remove(PARACHUTE.id);
    this.keptWeapon = p.slot.weapon;
    this.keptAmmo = p.slot.ammo;
    if (respawn) this.startFlyIn(p);
  }

  /** The driver's anchor is 15 px below the hull centre (ARCHITECTURE §6.1, GDD §8.5). */
  protected override syncDriver(): void {
    const p = this.driver;
    if (!p) return;
    p.x = p.prevX = this.x;
    p.y = p.prevY = this.y + TRUMPETER.driverDy;
    p.facing = 1;
    p.vx = this.vx;
    p.vy = this.vy;
  }

  /** GDD §8.5: respawned in a new Trumpeter that flies in from the left edge. */
  private startFlyIn(p: Player): void {
    const cam = this.world.camera;
    this.mode = 'flyin';
    this.respawnBlink = true;
    this.x = this.prevX = cam.left - TRUMPETER.viewBox.right - 8;
    this.y = this.prevY = cam.top + TRUMPETER.startY[p.index === 1 ? 1 : 0] - TRUMPETER.driverDy;
    this.vx = TRUMPETER.flyInSpeed;
    this.vy = 0;
    this.syncDriver();
    this.world.audio.sfx('trumpeter/flap');
  }

  // ------------------------------------------------------------------------------- tick

  override update(): void {
    this.trackScroll();
    if (this.bailLock > 0) this.bailLock--;
    if (this.holdT > 0) this.holdT--;
    if (this.earsT > 0) this.earsT--;
    if (this.cheerT > 0) this.cheerT--;
    if (this.hitFlashT > 0) this.hitFlashT--;
    if (this.respawnBlink && this.invulnTicks <= 0) this.respawnBlink = false;
    if (this.mode === 'backup-wait' || this.mode === 'backup') {
      this.updateBackup();
      return;
    }
    if (this.mode === 'leave') {
      this.updateLeave();
      return;
    }
    super.update();
    if (this.removed) return;
    if (this.state === 'driven') {
      this.hitSmallEnemies();
      if (this.driver) {
        this.keptWeapon = this.driver.slot.weapon;
        this.keptAmmo = this.driver.slot.ammo;
      }
    }
    // Jet exhaust from the two nozzles under the wing roots.
    if ((this.state === 'driven' || this.state === 'ram') && this.world.tick % 3 === 0) {
      const j = TRUMPETER.jets[(this.world.tick / 3) & 1];
      this.world.particles.emit(EXHAUST, this.x + j[0] - 3, this.y + j[1] + 2, -1.2 - this.world.fxRng.next(), 0.4);
    }
  }

  /**
   * The view's movement during the last tick while the camera is locked (the auto-scroll moves
   * the lock window). An unlocked camera follows the players, so nothing is carried then (that
   * would feed back into the follow).
   */
  private trackScroll(): void {
    const cam = this.world.camera;
    if (cam.locked && Number.isFinite(this.lastCamX)) {
      this.scrollVx = clamp(cam.x - this.lastCamX, -4, 4);
      this.scrollVy = clamp(cam.y - this.lastCamY, -4, 4);
    } else this.scrollVx = this.scrollVy = 0;
    this.lastCamX = cam.x;
    this.lastCamY = cam.y;
  }

  /** Flight controls (replaces the ground-vehicle drive). */
  protected override control(pad: VirtualPad): void {
    if (this.mode === 'flyin' || this.mode === 'auto') {
      this.autopilot();
      return;
    }
    this.facing = 1;
    if (this.honkT > 0) {
      // She hangs still on screen for the wind-up, then the ring goes off where she is.
      this.flyVx = this.flyVy = 0;
      this.applyFlight();
      if (--this.honkT <= 0) this.releaseHonk();
      this.tickGuns(false);
      return;
    }
    const ax = pad.axisX();
    const ay = pad.axisY();
    const s = this.speed * (ax !== 0 && ay !== 0 ? Math.SQRT1_2 : 1);
    this.flyVx = approach(this.flyVx, ax * s, this.accel);
    this.flyVy = approach(this.flyVy, ay * s, this.accel);
    this.applyFlight();

    const tick = this.world.tick;
    if (pad.pressed('fire')) this.pressedAt.fire = tick;
    if (pad.pressed('jump')) this.pressedAt.jump = tick;
    if (pad.pressed('bomb')) this.pressedAt.bomb = tick;
    // BAIL OUT: down + jump, or fire + jump on the same tick or 1 tick apart (GDD §4.1, §8.5).
    if ((pad.pressed('jump') && pad.held('down')) || this.combo('fire', 'jump')) {
      this.pressedAt.fire = this.pressedAt.jump = -1000;
      if (this.bailLock > 0) this.world.audio.sfx('weapon/empty');
      else {
        this.eject('ram');
        return;
      }
    }
    let comboUsed = false;
    if (this.combo('fire', 'bomb')) {
      this.pressedAt.fire = this.pressedAt.bomb = -1000;
      this.trySpecial();
      comboUsed = true;
    }
    if (!comboUsed) {
      if (pad.pressed('bomb')) this.cannonGun.press();
      if (pad.pressed('fire')) this.mainGun.press();
    }
    this.tickGuns(this.honkT <= 0 && pad.held('fire'));
  }

  /** World velocity = flight velocity + the auto-scroll. */
  private applyFlight(): void {
    this.vx = this.flyVx + this.scrollVx;
    this.vy = this.flyVy + this.scrollVy;
  }

  private tickGuns(fireHeld: boolean): void {
    this.mainGun.tick();
    this.cannonGun.tick();
    this.specialGun?.tick();
    if (this.honkT > 0) return;
    if (this.mainGun.wants(fireHeld)) this.fireMain();
    if (this.cannonGun.pending) {
      if (this.shells <= 0) {
        this.cannonGun.buffer = 0;
        this.world.audio.sfx('weapon/empty');
      } else if (this.cannonGun.wants(false)) {
        this.fireCannon();
        this.shells--;
      }
    }
  }

  /** The twin gun fires straight ahead from the split bill (the bullets leave 2 px either side). */
  protected override fireMain(): void {
    const m = TRUMPETER.muzzles;
    this.mainGun.fire(this.fireArgs(this.x + m[0][0], this.y + (m[0][1] + m[1][1]) / 2, 0, 'forward'));
  }

  /** Dive bombs drop from the belly with the ship's velocity. */
  protected override fireCannon(): void {
    const b = TRUMPETER.bombPoint;
    this.cannonGun.fire(this.fireArgs(this.x + b[0], this.y + b[1], Math.PI / 2, 'down'));
  }

  /** The whole ship (with its rider) stays 4 px inside the view (GDD §8.5). */
  protected override keepInView(): void {
    if (this.mode === 'flyin' || this.mode === 'auto') return;
    const cam = this.world.camera;
    const m = TRUMPETER.viewMargin;
    const vb = TRUMPETER.viewBox;
    const nx = clamp(this.x, cam.left + m - vb.left, cam.right - m - vb.right);
    const ny = clamp(this.y, cam.top + m - vb.top, cam.bottom - m - vb.bottom);
    if (nx !== this.x) {
      if ((nx - this.x) * this.flyVx < 0) this.flyVx = 0;
      this.x = nx;
    }
    if (ny !== this.y) {
      if ((ny - this.y) * this.flyVy < 0) this.flyVy = 0;
      this.y = ny;
    }
  }

  /** Flyers do not walk: no animation switching by speed (the draw picks the frames). */
  protected override animate(): void {}

  // ------------------------------------------------------------------------------- autopilot

  /**
   * Fly to a world point at `speed` px/tick, ignoring the pilot's input (mission scripts: the
   * landing hatch at the end of m5-a). `arrived` turns true there; `releaseAutopilot()` hands the
   * ship back.
   */
  flyTo(x: number, y: number, speed = 2): void {
    this.mode = 'auto';
    this.autoX = x;
    this.autoY = y;
    this.autoSpeed = speed;
  }

  get arrived(): boolean {
    return this.mode === 'auto' && Math.abs(this.x - this.autoX) < 1 && Math.abs(this.y - this.autoY) < 1;
  }

  releaseAutopilot(): void {
    if (this.mode !== 'auto') return;
    this.mode = 'fly';
    this.flyVx = this.flyVy = 0;
  }

  private autopilot(): void {
    this.facing = 1;
    if (this.mode === 'flyin') {
      // Catch up with the scrolling view, then hand over at view x 64.
      const cam = this.world.camera;
      const tx = cam.left + TRUMPETER.flyInX;
      this.vx = clamp(tx - this.x, -TRUMPETER.flyInSpeed, TRUMPETER.flyInSpeed + 1);
      this.vy = 0;
      if (Math.abs(tx - this.x) < 2) {
        this.mode = 'fly';
        this.flyVx = this.flyVy = 0;
      }
    } else {
      const dx = this.autoX - this.x;
      const dy = this.autoY - this.y;
      const d = Math.hypot(dx, dy);
      const s = Math.min(this.autoSpeed, d);
      this.vx = d > 0 ? (dx / d) * s : 0;
      this.vy = d > 0 ? (dy / d) * s : 0;
    }
    this.mainGun.tick();
    this.cannonGun.tick();
    this.specialGun?.tick();
  }

  // ------------------------------------------------------------------------------- HONK

  /** fire + bomb: fewer than 3 dive bombs = a sad squeak and nothing else (GDD §8.2). */
  protected override trySpecial(): void {
    if (this.mode !== 'fly' || this.honkT > 0) return;
    if (this.shells < this.specialCost) {
      this.world.audio.sfx('swan/squeak');
      return;
    }
    super.trySpecial();
  }

  /** The HONK weapon fired: wings spread, chest puffed, she hangs still for the wind-up. */
  startHonk(): void {
    this.mode = 'honk';
    this.honkT = HONK.windup;
    this.earsT = HONK.windup + HONK.maxRadius / HONK.grow;
    this.flyVx = this.flyVy = 0;
    this.applyFlight();
    this.world.audio.sfx('trumpeter/flap', FLAP_SOFT);
  }

  private releaseHonk(): void {
    this.mode = 'fly';
    this.world.add(new HonkRing(this.world, this.x, this.y + TRUMPETER.hullCentreY, this.lastDriver, this));
    this.world.audio.sfx('swan/honk');
    this.world.camera.shake(2, 8);
  }

  /** A dive bomb or a hard bank: the rider holds on tight. */
  holdOn(): void {
    this.holdT = TRUMPETER.holdTicks;
  }

  /** The boss is down: the rider cheers. */
  cheer(ticks: number = TRUMPETER.cheerTicks): void {
    this.cheerT = ticks;
  }

  // ------------------------------------------------------------------------------- contact

  /** GDD §8.5: touching a small enemy destroys it and costs ½ cell. */
  private hitSmallEnemies(): void {
    const box = this.hitRect(scratch);
    const list = this.world.snapshotTag('enemy');
    try {
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!(e instanceof Enemy) || !e.alive || e.big || e.maxHp > TRUMPETER.smallHp) continue;
        if (e.hitbox.w > TRUMPETER.smallSize || e.hitbox.h > TRUMPETER.smallSize) continue;
        if (!overlaps(box, e.hitRect(scratch2))) continue;
        const kill: Damage = { amount: Math.max(1000, e.hp), kind: 'impact', dirX: 1, owner: this.lastDriver, source: this, weapon: 'trumpeter' };
        this.world.damage(e, kill);
        const bump: Damage = { amount: 10, kind: 'bullet', dirX: -1, source: e };
        this.world.damage(this, bump);
        if (this.state !== 'driven') return;
      }
    } finally {
      this.world.releaseSnapshot();
    }
  }

  override onHit(d: Damage): boolean {
    const before = this.cells;
    const absorbed = super.onHit(d);
    if (this.cells < before) {
      this.hitFlashT = 60;
      this.holdT = TRUMPETER.holdTicks;
    }
    return absorbed;
  }

  // ------------------------------------------------------------------------------- bail out

  /**
   * BAIL OUT: the base eject pops the pilot up off the seat and sends the empty ship charging
   * (`'ram'`: 4 px/tick, 400 in r 40). The pilot opens the swan parachute and a backup is called.
   */
  override eject(mode: EjectMode = 'exit'): void {
    const p = this.driver;
    super.eject(mode);
    if (!p || p.vehicle === this || mode !== 'ram') return;
    this.vy = 0;
    this.mode = 'fly';
    this.honkT = 0;
    this.world.audio.sfx('trumpeter/bail');
    // A short somersault off the seat (the shared ram eject would throw him 60 px up).
    p.vy = TRUMPETER.bailVy;
    p.status.add(PARACHUTE);
    const cam = this.world.camera;
    const b = this.world.spawn('trumpeter', cam.left - 80, p.y, { backup: true, variant: this.variant });
    if (b instanceof Trumpeter) b.startBackup(p);
  }

  /** Called on a fresh backup ship: fetch this pilot 60 ticks from now. */
  startBackup(p: Player): void {
    this.fetch = p;
    this.mode = 'backup-wait';
    this.modeT = 0;
    this.cells = TRUMPETER.backupCells;
    this.shells = TRUMPETER.backupShells;
    this.variantFixed = true;
    this.despawnMargin = Infinity;
  }

  private updateBackup(): void {
    const p = this.fetch;
    const cam = this.world.camera;
    if (!p || p.state !== 'play' || this.state !== 'idle') {
      // The pilot is gone (mounted elsewhere, dead, the mission ended): never mind.
      this.fetch = null;
      if (this.mode === 'backup-wait') this.remove();
      else this.mode = 'leave';
      return;
    }
    this.modeT++;
    if (this.mode === 'backup-wait') {
      // Waiting off-screen at the left edge.
      this.x = this.prevX = cam.left - 80;
      this.y = this.prevY = p.y - TRUMPETER.driverDy + 40;
      if (this.modeT >= TRUMPETER.backupDelay) {
        this.mode = 'backup';
        this.vx = TRUMPETER.backupSpeed;
        this.vy = -1;
        this.world.audio.sfx('trumpeter/flap');
      }
      return;
    }
    // The swoop: steer toward the pilot's seat (a curve from below-left), grab him when close.
    const tx = p.x;
    const ty = p.y - TRUMPETER.driverDy;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d <= TRUMPETER.backupReach) {
      this.mode = 'fly';
      this.fetch = null;
      this.mount(p);
      this.bailLock = TRUMPETER.bailLock;
      return;
    }
    const s = TRUMPETER.backupSpeed;
    this.vx = approach(this.vx, (dx / d) * s, 0.35);
    this.vy = approach(this.vy, (dy / d) * s, 0.35);
    this.x += this.vx;
    this.y += this.vy;
    if (d < s * 2) {
      this.x = tx;
      this.y = ty;
    }
  }

  /** A backup with nobody to fetch flies off up and forward, then is gone. */
  private updateLeave(): void {
    this.vx = approach(this.vx, TRUMPETER.backupSpeed, 0.2);
    this.vy = approach(this.vy, -2, 0.2);
    this.x += this.vx;
    this.y += this.vy;
    if (!this.onScreen(48)) this.remove();
  }

  /** A weapon pickup in flight becomes +10 dive bombs (GDD §5, §8.5). Items may call this. */
  weaponPickup(_weapon?: string): boolean {
    this.addShells(10);
    const p = this.driver;
    if (p) hudOf(this.world).message(p.index, 'DIVE BOMBS +10');
    return true;
  }

  /** Fallback while `pickup-weapon` gives the weapon to the pilot: take it back as dive bombs. */
  private weaponToBombs(p: Player): void {
    const s = p.slot;
    if (s.weapon === this.keptWeapon && s.ammo === this.keptAmmo) return; // already handled
    s.weapon = this.keptWeapon;
    s.ammo = this.keptAmmo;
    p.gun.setWeapon(p.weapon);
    this.weaponPickup();
  }

  // ------------------------------------------------------------------------------- the end

  /** Tin feathers on top of the blast. */
  override explode(damage = this.wreckDamage, radius = this.wreckRadius): void {
    if (this.removed) return;
    const w = this.world;
    const ids = SKINS[this.variant];
    for (let i = 0; i < 5; i++) {
      FxEntity.spawn(w, {
        sprite: ids.feather,
        x: this.x + w.fxRng.range(-12, 12),
        y: this.y - 10,
        vx: w.fxRng.range(-1.4, 1.4),
        vy: w.fxRng.range(-2.6, -1),
        gravity: 0.06,
        drag: 0.98,
        life: 60,
        loop: true,
        ticksPerFrame: 4,
        frame: i & 3,
        z: 61,
      });
    }
    super.explode(damage, radius);
  }

  override onRemove(): void {
    for (const off of this.offs) off();
    this.offs.length = 0;
    super.onRemove();
  }

  // ------------------------------------------------------------------------------- drawing

  /** The rider's pose this tick (look.md §14). */
  riderPose(): RidePose {
    if (this.cheerT > 0 || this.driver?.cheering) return 'cheer';
    if (this.earsT > 0) return 'ears';
    if (this.holdT > 0 || Math.abs(this.flyVy) >= TRUMPETER.bankVy) return 'hold';
    return 'lean';
  }

  /** The wing-beat frame: faster while climbing, held open (glide) while diving. */
  private flapFrame(): number {
    const t = this.world.tick;
    if (this.flyVy > 1) return 3;
    const rate = this.flyVy < -0.5 ? 3 : 5;
    return Math.floor(t / rate) % FLAP_FRAMES;
  }

  override draw(r: Renderer): void {
    if (this.mode === 'backup-wait') return;
    const ids = SKINS[this.variant];
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const t = this.world.tick;
    opts.flipX = false;
    tint.flipX = false;
    if (this.state === 'wreck') {
      opts.flash = t % 4 < 2;
      r.sprite(ids.wreck, (t >> 2) & 1, x, y, opts);
      return;
    }
    if (this.respawnBlink && Math.floor(t / TUNING.life.respawnBlinkTicks) % 2 === 1) return;
    const flash = this.flashTicks > 0 ? t % 2 === 0 : this.hitFlashT > 0 && this.hitFlashT % 6 < 2;
    opts.flash = flash;
    if (this.state === 'ram') {
      r.sprite(ids.dive, (t >> 2) & 1, x, y, opts);
      return;
    }
    const p = this.driver;
    if (!p) {
      // Empty: she hovers and looks back for her rider.
      r.sprite(ids.gag, Math.floor(t / 24) % 3, x, y + ((t >> 4) & 1), opts);
      return;
    }
    const honk = this.honkT > 0 || this.earsT > HONK.maxRadius / HONK.grow;
    const frame = honk ? (this.honkT > 0 ? 0 : 1) : this.flapFrame();
    const bob = honk ? 0 : frame === 1 ? -1 : frame === 3 ? 1 : 0;
    const by = y + bob;
    const body = honk ? ids.special : ids.idle;
    const front = honk ? ids.specialFront : ids.front;
    if (!honk) r.sprite(ids.jet, t % 3, x, by, opts);
    // The last cell blinks red (GDD §8.1): body and front, never the rider between them.
    const red = this.state === 'driven' && this.cells <= 1 && t % 20 < 6;
    r.sprite(body, frame, x, by, opts);
    if (red) r.sprite(body, frame, x, by, tint);
    p.drawRide(r, x + TRUMPETER.seatPoint[0], by + TRUMPETER.seatPoint[1], false, this.riderPose());
    opts.flash = flash;
    r.sprite(front, frame, x, by, opts);
    if (red) r.sprite(front, frame, x, by, tint);
  }

  /** Is the HONK ready (the HUD's ready dot, GDD §13.7)? */
  get specialReady(): boolean {
    const g = this.specialGun;
    return g !== null && g.ready && this.shells >= this.specialCost;
  }
}

defineEntity('trumpeter', (w, x, y, p) => new Trumpeter(w, x, y, p), {
  category: 'vehicle',
  description: 'TRUMPETER: SWAN-3 flight mode for m5-a (3 cells; twin beak gun, dive bomb, HONK, BAIL OUT).',
});

/** The Trumpeter a player is riding, or null. */
export function trumpeterOf(p: Player): Trumpeter | null {
  return p.vehicle instanceof Trumpeter ? p.vehicle : null;
}
