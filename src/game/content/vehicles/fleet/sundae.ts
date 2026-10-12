/**
 * `sundae-driver` — the SUNDAE DRIVER, Mrs. Dollop's armed ice-cream van (GDD §8.3, §6.3).
 *
 * - Drive: accelerate 0.08, max 2.4, brake 0.15, suspension hop vy −3.0; it faces its direction
 *   of travel (holding the other way brakes first). 3 cells, 10 shells. Deep water sinks it.
 * - Turret: the giant ice-cream cone on the roof turns 15° per 2 ticks toward the held direction
 *   (forward, forward-up, up, back-up, back) and keeps its angle when nothing is held. Turning
 *   the van keeps the cone's world direction.
 * - `sundae-sprinkle-gun` (fire): rainbow `sprinkle`s, 1 per 4 ticks, 10 damage, speed 8.
 * - `sundae-mortar` (bomb): a `sundae-shell` lobbed from the cone (vx 2.5 × facing + van vx,
 *   vy −4.0, gravity 0.15): 150 in r 24 and Legion infantry inside frozen 90 ticks (it freezes
 *   before it hits, so the soldiers it kills shatter). Cooldown 36.
 * - `sundae-jingle` (fire + bomb): the jingle; Legion infantry within 200 px queue at the van
 *   for 120 ticks (`reactInArea(…, 'queue', 120)`). Cooldown 900, no shell cost.
 * - Contact: faster than 1.6 px/tick it squashes soft enemies (100 `crush`, no damage to it).
 * - Ram (fire + jump): the empty van rolls at 2.8 px/tick for up to 200 px playing the jingle
 *   slowed down, then bursts into scoops and sprinkles (400 in r 40).
 */
import type { SfxOpts } from '../../../../engine/audio';
import type { Entity } from '../../../../engine/entity';
import type { VirtualPad } from '../../../../engine/input';
import type { ParticlePreset } from '../../../../engine/particles';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { reactInArea } from '../../../enemy';
import type { EjectMode } from '../../../events';
import { blast, FxEntity } from '../../../fx';
import { Projectile } from '../../../projectile';
import { defineEntity, defineWeapon, type SpawnParams } from '../../../registry';
import { aimAngle, aimDirOf, type FireContext } from '../../../weapons';
import { drawDriver, GroundVehicle } from './common';
import { ART, coneAngle, coneMuzzle, JINGLE, MORTAR, SPRINKLE, SUNDAE, SUNDAE_HATCH_CENTRE, SUNDAE_NAME_CENTRE } from './numbers';

const A = ART.sundae;
/** Sprite ids, built once (no string building while drawing). */
const ID = {
  cab: `${A}/cab`,
  body: `${A}/body`,
  wheels: `${A}/wheels`,
  special: `${A}/special`,
  turret: `${A}/turret`,
  cherry: `${A}/cherry`,
  wreck: `${A}/wreck`,
  gag: `${A}/empty-gag`,
  name: `${A}/name`,
  note: `${A}/note`,
  scoop: `${A}/scoop`,
  splat: `${A}/splat`,
  bits: `${A}/bits`,
} as const;

const pt: [number, number] = [0, 0];
const mz: [number, number] = [0, 0];
const opts: DrawOpts = {};
const plain: DrawOpts = {};
const tint: DrawOpts = { tint: 0xff3020ff, alpha: 0.45 };
const SLOW_JINGLE: SfxOpts = { pitch: 0.7 };

/** Ice-cream crumbs and sprinkles: random frames of `bits` (pink, vanilla, chocolate, sprinkles). */
const CRUMBS: ParticlePreset = { kind: 'sprite', sprite: ID.bits, randomFrames: 6, ticksPerFrame: 0, life: [18, 34], gravity: 0.12, drag: 0.97, ground: 'stop' };
const SPRINKLE_SHOWER: ParticlePreset = {
  kind: 'sprite',
  sprite: ID.bits,
  frame: 3,
  randomFrames: 3,
  ticksPerFrame: 0,
  life: [24, 44],
  gravity: 0.1,
  drag: 0.98,
  ground: 'bounce',
  bounce: 0.4,
};

// ---------------------------------------------------------------------------------------------
// Weapons and projectiles
// ---------------------------------------------------------------------------------------------

/** One rainbow sprinkle along the cone (the colour cycles with the world clock). */
function fireSprinkle(ctx: FireContext): void {
  const p = Projectile.spawn(ctx.world, {
    team: ctx.team,
    x: ctx.x,
    y: ctx.y,
    vx: ctx.dirX * SPRINKLE.speed,
    vy: ctx.dirY * SPRINKLE.speed,
    damage: SPRINKLE.damage,
    kind: 'bullet',
    owner: ctx.owner,
    shooter: ctx.shooter,
    life: SPRINKLE.life,
    w: SPRINKLE.w,
    h: SPRINKLE.h,
    sprite: ART.sprinkles[(ctx.world.tick >> 2) % ART.sprinkles.length],
    type: 'sprinkle',
    weapon: 'sundae-sprinkle-gun',
  });
  ctx.gun.track(p);
}

defineWeapon({
  id: 'sundae-sprinkle-gun',
  name: 'SPRINKLE GUN',
  kind: 'vehicle',
  ammo: Infinity,
  pose: 'heavy',
  cooldown: SPRINKLE.cooldown,
  auto: true,
  burst: SPRINKLE.burst,
  maxShotsOnScreen: SPRINKLE.maxOnScreen,
  sfx: 'weapon/machine-gun',
  fire: fireSprinkle,
});

/**
 * The mortar splat: freeze Legion infantry in r 24 for 90 ticks, then 150 to every enemy in
 * r 24 (each once, no falloff). Ice-cream crumbs instead of fire.
 */
export function sundaeSplat(p: Projectile, _target: Entity | null, x: number, y: number): void {
  const w = p.world;
  reactInArea(w, { x, y, r: MORTAR.radius }, 'freeze', MORTAR.freezeTicks, { tags: ['legion'], source: p.shooter });
  blast(w, x, y, MORTAR.radius, MORTAR.damage, p.team, { kind: 'explosion', owner: p.damage.owner, source: p, falloff: 0, weapon: 'sundae-mortar' });
  FxEntity.spawn(w, { sprite: ID.splat, x, y: y - 8, ticksPerFrame: 4, z: 60 });
  w.particles.burst(CRUMBS, x, y - 4, 14, 0.8, 2.6, -Math.PI / 2, 2.6);
  w.camera.shake(2, 8);
  w.audio.sfx('explosion/s');
  w.events.emit('explosion', { x, y, r: MORTAR.radius, team: p.team, owner: p.damage.owner ?? -1, size: 's' });
}

defineWeapon({
  id: 'sundae-mortar',
  name: 'SUNDAE MORTAR',
  kind: 'vehicle',
  ammo: Infinity,
  pose: 'heavy',
  cooldown: MORTAR.cooldown,
  auto: false,
  holdRepeat: null,
  sfx: 'sundae/mortar',
  icon: 'ui/icon-shell',
  fire(ctx) {
    Projectile.spawn(ctx.world, {
      team: ctx.team,
      x: ctx.x,
      y: ctx.y,
      vx: MORTAR.vx * ctx.facing + ctx.vx,
      vy: MORTAR.vy,
      gravity: MORTAR.gravity,
      damage: MORTAR.damage,
      kind: 'explosion',
      owner: ctx.owner,
      shooter: ctx.shooter,
      life: MORTAR.life,
      w: MORTAR.w,
      h: MORTAR.h,
      sprite: ART.sundaeShell,
      look: 'anim',
      ticksPerFrame: 4,
      impact: 'none',
      onImpact: sundaeSplat,
      offscreen: 64,
      type: 'sundae-shell',
      weapon: 'sundae-mortar',
    });
  },
});

defineWeapon({
  id: 'sundae-jingle',
  name: 'JINGLE',
  kind: 'vehicle',
  ammo: Infinity,
  pose: 'heavy',
  cooldown: JINGLE.cooldown,
  auto: false,
  holdRepeat: null,
  sfx: 'vehicle/jingle',
  fire(ctx) {
    const v = ctx.shooter;
    reactInArea(ctx.world, { x: v.x, y: v.y + JINGLE.centreY, r: JINGLE.range }, 'queue', JINGLE.queueTicks, { tags: ['legion'], source: v });
    if (v instanceof SundaeDriver) v.playJingle();
  },
});

/** `facing` spawn param as ±1 (projectiles spawned by id fly that way). */
function dirOf(p: SpawnParams): 1 | -1 {
  return p.facing === -1 || p.facing === 'left' ? -1 : 1;
}

// The projectile ids of GDD §15.2 also spawn by id (tests, tools, scripted set pieces).
defineEntity(
  'sprinkle',
  (w, x, y, p) =>
    Projectile.spawn(w, {
      team: 'player',
      x,
      y,
      vx: dirOf(p) * SPRINKLE.speed,
      vy: 0,
      damage: SPRINKLE.damage,
      life: SPRINKLE.life,
      w: SPRINKLE.w,
      h: SPRINKLE.h,
      sprite: ART.sprinkles[0],
      type: 'sprinkle',
      weapon: 'sundae-sprinkle-gun',
    }),
  { category: 'projectile', description: 'SUNDAE DRIVER sprinkle (10 damage, speed 8).' },
);
defineEntity(
  'sundae-shell',
  (w, x, y, p) =>
    Projectile.spawn(w, {
      team: 'player',
      x,
      y,
      vx: dirOf(p) * MORTAR.vx,
      vy: MORTAR.vy,
      gravity: MORTAR.gravity,
      damage: MORTAR.damage,
      kind: 'explosion',
      life: MORTAR.life,
      w: MORTAR.w,
      h: MORTAR.h,
      sprite: ART.sundaeShell,
      look: 'anim',
      impact: 'none',
      onImpact: sundaeSplat,
      offscreen: 64,
      type: 'sundae-shell',
      weapon: 'sundae-mortar',
    }),
  { category: 'projectile', description: 'SUNDAE MORTAR shell (150 in r 24, freezes infantry 90 ticks).' },
);

// ---------------------------------------------------------------------------------------------
// The van
// ---------------------------------------------------------------------------------------------

export class SundaeDriver extends GroundVehicle {
  /** Cone step −1..13: 0 forward, 6 up, 12 back (15° each, relative to the facing); −1 / 13 dipped. */
  coneStep = 0;
  /** Ticks the loudspeaker plays (the JINGLE, the ram's slowed jingle). */
  jingleT = 0;
  private coneT = 0;

  constructor(world: World, x: number, y: number, params: SpawnParams) {
    super(world, x, y, params, {
      art: A,
      name: 'SUNDAE',
      w: SUNDAE.body.w,
      h: SUNDAE.body.h,
      hurt: SUNDAE.hurt,
      seat: SUNDAE.seat,
      seatPoint: SUNDAE.driverDraw,
      cells: SUNDAE.cells,
      shells: SUNDAE.shells,
      mainGun: 'sundae-sprinkle-gun',
      cannon: 'sundae-mortar',
      special: 'sundae-jingle',
      speed: SUNDAE.speed,
      accel: SUNDAE.accel,
      jump: SUNDAE.jump,
      brake: SUNDAE.brake,
      ramSpeed: SUNDAE.ramSpeed,
      ramDistance: SUNDAE.ramDistance,
      ramDamage: SUNDAE.ramDamage,
      ramRadius: SUNDAE.ramRadius,
      squashSpeed: SUNDAE.squashSpeed,
      squashInclusive: SUNDAE.squashInclusive,
      halfWidth: SUNDAE.width / 2,
      hatch: SUNDAE.hatch,
      driverAnchor: SUNDAE.driverAnchor,
    });
  }

  override update(): void {
    super.update();
    if (this.jingleT <= 0) return;
    this.jingleT--;
    // Notes float out of the roof loudspeaker while it plays.
    if (this.jingleT % 10 === 0 && !this.removed) this.puffNote();
  }

  private puffNote(): void {
    const w = this.world;
    FxEntity.spawn(w, {
      sprite: ID.note,
      x: this.x + 24 * this.facing,
      y: this.y - 46,
      vx: this.facing * 0.3,
      vy: -0.55,
      life: 44,
      ticksPerFrame: 11,
      loop: true,
      wobble: 2,
      frame: w.fxRng.int(0, 1),
      z: 60,
    });
  }

  /** The turret: one 15° step every 2 ticks toward the held direction (GDD §8.3). */
  protected override updateAim(pad: VirtualPad): void {
    const ax = pad.axisX();
    const S = SUNDAE.turretSteps;
    let target = NaN;
    if (pad.held('up')) target = ax === 0 ? S / 2 : ax === this.facing ? S / 4 : (3 * S) / 4;
    else if (pad.held('down')) target = ax !== 0 && ax !== this.facing ? SUNDAE.turretMax : SUNDAE.turretMin;
    else if (ax !== 0) target = ax === this.facing ? 0 : S;
    if (!Number.isNaN(target) && target !== this.coneStep) {
      if (++this.coneT >= SUNDAE.turretTicks) {
        this.coneT = 0;
        this.coneStep += target > this.coneStep ? 1 : -1;
      }
    } else this.coneT = 0;
    this.aimElev = coneAngle(this.coneStep);
  }

  /** The van turned around: the cone keeps pointing the same way in the world. */
  protected override onTurn(): void {
    this.coneStep = SUNDAE.turretSteps - this.coneStep;
    this.aimElev = coneAngle(this.coneStep);
  }

  /** World position of the cone's top scoop (sprinkles and the mortar leave it). */
  coneMuzzleWorld(out: [number, number]): [number, number] {
    coneMuzzle(this.coneStep, mz);
    out[0] = this.x + (SUNDAE.pivot[0] + mz[0]) * this.facing;
    out[1] = this.y + SUNDAE.pivot[1] + mz[1];
    return out;
  }

  protected override fireMain(): void {
    const m = this.coneMuzzleWorld(pt);
    this.mainGun.fire(this.fireArgs(m[0], m[1], aimAngle(this.facing, this.aimElev), aimDirOf(this.aimElev)));
  }

  protected override fireCannon(): void {
    const m = this.coneMuzzleWorld(pt);
    this.cannonGun.fire(this.fireArgs(m[0], m[1], this.facing > 0 ? 0 : Math.PI, 'forward'));
  }

  /** The JINGLE started: the loudspeaker plays and notes rise. */
  playJingle(): void {
    this.jingleT = JINGLE.playTicks;
  }

  /** The ram: the empty van rolls off playing the jingle slowed down (GDD §8.3). */
  override eject(mode: EjectMode = 'exit'): void {
    super.eject(mode);
    if (this.state === 'ram') {
      this.jingleT = JINGLE.playTicks;
      this.world.audio.sfx('vehicle/jingle', SLOW_JINGLE);
    }
  }

  /** Burst into a cloud of scoops and sprinkles on top of the blast. */
  override explode(damage = this.wreckDamage, radius = this.wreckRadius): void {
    if (this.removed) return;
    const w = this.world;
    const cx = this.x;
    const cy = this.y - 24;
    for (let i = 0; i < 6; i++) {
      FxEntity.spawn(w, {
        sprite: ID.scoop,
        x: cx + w.fxRng.range(-20, 20),
        y: cy + w.fxRng.range(-10, 6),
        vx: w.fxRng.range(-1.6, 1.6),
        vy: w.fxRng.range(-3.2, -1.6),
        gravity: 0.12,
        life: 50,
        // One frame per flavour: hold it (the strip is chocolate, vanilla, strawberry).
        loop: true,
        ticksPerFrame: 1000,
        frame: i % 3,
        z: 61,
      });
    }
    w.particles.burst(SPRINKLE_SHOWER, cx, cy, 40, 1, 3.4, -Math.PI / 2, 3);
    super.explode(damage, radius);
  }

  /** The empty gag: the serving hatch opens with an OPEN sign and the speaker hums a note. */
  protected override onGag(): void {
    this.puffNote();
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const flip = this.facing < 0;
    const f = this.facing;
    opts.flipX = flip;
    tint.flipX = flip;
    if (this.state === 'wreck') {
      opts.flash = this.world.tick % 4 < 2;
      r.sprite(ID.wreck, 0, x, y, opts);
      return;
    }
    const t = this.world.tick;
    const moving = this.state === 'driven' && Math.abs(this.vx) > 0.2;
    // Suspension bob while driving; a drunken wobble while it rams.
    const bob = this.state === 'ram' ? ((t >> 2) & 1) * 2 - 1 : moving ? (t >> 3) & 1 : 0;
    const by = y - bob;
    const flash = this.flashOn();
    // 1. Cab interior, 2. the driver in the window, 3. the body over them (the window is a hole).
    opts.flash = flash;
    r.sprite(ID.cab, 0, x, by, opts);
    if (this.driver) drawDriver(r, this.driver, x + SUNDAE.driverDraw[0] * f, by + SUNDAE.driverDraw[1], flip);
    opts.flash = flash;
    const damaged = this.cells <= 1 ? 1 : 0;
    r.sprite(ID.body, damaged, x, by, opts);
    // Painted name and the gag's OPEN sign: drawn unflipped, so the letters always read.
    plain.flash = flash;
    r.sprite(ID.name, 0, x + SUNDAE_NAME_CENTRE[0] * f, by + SUNDAE_NAME_CENTRE[1], plain);
    if (this.gagT > 0) r.sprite(ID.gag, Math.min(11, Math.floor(this.gagT / 8)), x + SUNDAE_HATCH_CENTRE[0] * f, by + SUNDAE_HATCH_CENTRE[1], plain);
    // 4. Wheels: they roll with the distance driven.
    const turn = Math.floor(this.roll / 3) * f;
    const frame = ((turn % 4) + 4) % 4;
    for (let i = 0; i < SUNDAE.wheels.length; i++) r.sprite(ID.wheels, frame, x + SUNDAE.wheels[i] * f, y + SUNDAE.wheelY, opts);
    // 5. The roof loudspeaker (it shakes while it plays) and the cone turret with its cherry.
    r.sprite(ID.special, this.jingleT > 0 ? 1 + ((t >> 2) & 1) : 0, x, by, opts);
    const px = x + SUNDAE.pivot[0] * f;
    const py = by + SUNDAE.pivot[1];
    const cf = this.coneStep - SUNDAE.turretMin;
    r.sprite(ID.turret, cf, px, py, opts);
    if (!flash && t % 40 < 20) r.sprite(ID.cherry, cf, px, py, opts);
    if (this.redTint()) {
      r.sprite(ID.body, damaged, x, by, tint);
      r.sprite(ID.turret, cf, px, py, tint);
    }
  }
}

defineEntity('sundae-driver', (w, x, y, p) => new SundaeDriver(w, x, y, p), {
  category: 'vehicle',
  description: 'SUNDAE DRIVER: armed ice-cream van (3 cells; sprinkle gun, sundae mortar, JINGLE).',
});
