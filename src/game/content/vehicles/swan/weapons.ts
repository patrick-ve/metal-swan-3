/**
 * The Swan's weapons (GDD §6.3, §8.2; docs/design/swan-mount/feel.md §7.4–§7.6) and their
 * projectiles. Registers at import time:
 *
 * - `swan-beak-gun` — tap = a 5-round burst, hold = a stream: 1 round per 4 ticks, 10 damage,
 *   8 px/tick, ±1 px jitter, 60 ticks, max 24 on screen, infinite. Rounds: `beak-bullet`.
 * - `swan-beak-shell` — a shell from the beak tip along the neck angle: 4 px/tick plus her
 *   horizontal speed (×1), gravity 0.06; 200 to the hit target and 100 to others in r 24.
 *   Cooldown 30; the Swan counts the shells. Projectile: `beak-shell`.
 * - `swan-honk` — the HONK shockwave: a ring that grows from 0 to 128 px in 16 ticks around the
 *   point it is fired from, 80 damage to every enemy part it touches (once), erases every enemy
 *   projectile inside it and makes infantry cover their ears (reaction 'ears', 60 ticks). The Swan
 *   pays the 3 shells and runs the 10-tick wind-up before it fires this. Entity: `honk-ring`.
 *
 * The weapons fire from whatever point the vehicle passes (the Swan: her body frame's `neck`
 * point plus the neck frame's `muzzle` / `cannon`). Sprites: `weapon/beak-bullet` and
 * `weapon/beak-shell` when drawn, else the generic `weapon/vulcan-bullet` / `weapon/shell`;
 * `vehicle/swan/beak-flash` (= `fx/muzzle-swan-beak-gun`, round) when drawn, else the shared
 * heavy flash. The ring is drawn in code. Sounds: `swan/fire`, `weapon/cannon`, `swan/honk`, `explosion/m`.
 */
import { Entity, hostile, type Damage } from '../../../../engine/entity';
import { distToRect } from '../../../../engine/math';
import { PAL } from '../../../../engine/palette';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import { hasSprite } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import { Enemy } from '../../../enemy';
import { explosion, FxEntity, muzzleFlash, type FxOpts, type MuzzleOpts } from '../../../fx';
import { eraseEnemyShots, Projectile, type ProjectileOpts } from '../../../projectile';
import { defineEntity, defineWeapon, paramFacing, paramNum } from '../../../registry';
import { shootBullet, type BulletOpts, type FireContext } from '../../../weapons';
import { SWAN } from './constants';

const G = SWAN.gun;
const SH = SWAN.shell;
const HK = SWAN.honk;

/** Damage tags of the HONK (a 'sonic' hit, like the tuba ring; GDD §6 damage table). */
const SONIC: readonly string[] = Object.freeze(['sonic']);

/** First registered sprite of a list (the last one is used even when missing). */
function pick(a: string, b: string): string {
  return hasSprite(a) ? a : b;
}

// ---------------------------------------------------------------------------------------------
// BEAK GUN
// ---------------------------------------------------------------------------------------------

/** Scratch options, reused for every round (no allocation per shot). */
const roundOpts: BulletOpts = { speed: G.speed, damage: G.damage, sprite: '', life: G.life, w: 6, h: 4, offset: 0 };
const flashOpts: FxOpts = { sprite: 'vehicle/swan/beak-flash', x: 0, y: 0, follow: null, blend: 'add' };
const heavyFlash: MuzzleOpts = { kind: 'heavy', follow: null };

/** One beak round along the aim; alternating ±1 px across it (the jitter). */
function fireBeakRound(ctx: FireContext): void {
  roundOpts.sprite = pick('weapon/beak-bullet', 'weapon/vulcan-bullet');
  roundOpts.offset = ctx.shotIndex % 2 === 0 ? -G.jitter : G.jitter;
  const p = shootBullet(ctx, roundOpts);
  p.type = 'beak-bullet';
  // Her own round flash fits every aim; else the shared heavy flash.
  if (hasSprite(flashOpts.sprite)) {
    flashOpts.x = ctx.x;
    flashOpts.y = ctx.y;
    flashOpts.follow = ctx.shooter;
    FxEntity.spawn(ctx.world, flashOpts);
    flashOpts.follow = null;
  } else shellFlash(ctx);
}

/** The shared heavy muzzle flash at the beak tip, stuck to her for its short life. */
function shellFlash(ctx: FireContext): void {
  heavyFlash.follow = ctx.shooter;
  muzzleFlash(ctx.world, ctx.x, ctx.y, ctx.angle, heavyFlash);
  heavyFlash.follow = null;
}

defineWeapon({
  id: 'swan-beak-gun',
  name: 'BEAK GUN',
  kind: 'vehicle',
  ammo: Infinity,
  pose: 'heavy',
  cooldown: G.cooldown,
  auto: true,
  burst: G.burst,
  sweep: true,
  maxShotsOnScreen: G.maxOnScreen,
  sfx: 'swan/fire',
  fire: fireBeakRound,
});

// ---------------------------------------------------------------------------------------------
// BEAK SHELL
// ---------------------------------------------------------------------------------------------

/** The beak shell: arcs under gravity 0.06 and explodes on contact or terrain (or at its end). */
export class BeakShell extends Projectile {
  constructor(world: World) {
    super(world);
  }

  /** The direct hit (200, 'explosion') is the projectile's own damage; the blast spares that target. */
  override onImpact(target: Entity | null, x: number, y: number): void {
    super.onImpact(target, x, y);
    this.burst(x, y, target);
  }

  override expire(): void {
    if (!this.removed) this.burst(this.x, this.y, null);
    super.expire();
  }

  private burst(x: number, y: number, target: Entity | null): void {
    explosion(this.world, x, y, 'm', {
      damage: SH.splash,
      radius: SH.radius,
      falloff: 0,
      team: this.team,
      owner: this.damage.owner,
      exclude: target,
      weapon: 'swan-beak-shell',
      debris: 'metal',
    });
  }
}

const shellOpts: ProjectileOpts = { team: 'player', x: 0, y: 0, vx: 0, vy: 0, damage: 0 };

/** Spawn a beak shell at (x, y) moving (vx, vy). */
export function spawnBeakShell(world: World, x: number, y: number, vx: number, vy: number, owner = -1, shooter: Entity | null = null): BeakShell {
  const o = shellOpts;
  o.team = 'player';
  o.x = x;
  o.y = y;
  o.vx = vx;
  o.vy = vy;
  o.gravity = SH.gravity;
  o.damage = SH.direct;
  o.kind = 'explosion';
  o.owner = owner;
  o.shooter = shooter;
  o.life = SH.life;
  o.w = 6;
  o.h = 6;
  o.sprite = pick('weapon/beak-shell', 'weapon/shell');
  o.impact = 'none';
  o.offscreen = 48;
  o.type = 'beak-shell';
  o.weapon = 'swan-beak-shell';
  const p = BeakShell.spawn(world, o);
  o.shooter = null;
  return p;
}

defineWeapon({
  id: 'swan-beak-shell',
  name: 'BEAK SHELL',
  kind: 'vehicle',
  ammo: Infinity,
  pose: 'heavy',
  cooldown: SH.cooldown,
  auto: false,
  holdRepeat: null,
  maxShotsOnScreen: SH.maxOnScreen,
  sfx: 'weapon/cannon',
  icon: 'ui/icon-shell',
  fire(ctx) {
    // Along the neck angle, plus her horizontal speed: a 0° shell always lands 113 px ahead of her.
    const vx = ctx.dirX * SH.speed + ctx.vx * SH.inheritVx;
    const vy = ctx.dirY * SH.speed;
    ctx.gun.track(spawnBeakShell(ctx.world, ctx.x, ctx.y, vx, vy, ctx.owner, ctx.shooter));
    shellFlash(ctx);
    ctx.world.camera.shake(1, 6);
  },
});

// ---------------------------------------------------------------------------------------------
// HONK
// ---------------------------------------------------------------------------------------------

/** Unit circle for drawing the ring (64 directions). */
const RING_N = 64;
const RING_COS = new Float32Array(RING_N);
const RING_SIN = new Float32Array(RING_N);
for (let i = 0; i < RING_N; i++) {
  RING_COS[i] = Math.cos((i / RING_N) * Math.PI * 2);
  RING_SIN[i] = Math.sin((i / RING_N) * Math.PI * 2);
}
const ringOpts: DrawOpts = { alpha: 1 };
const ringDim: DrawOpts = { alpha: 0.5 };
/** The ring fades this many ticks after it reached its full radius. */
const RING_FADE = 8;

/**
 * The HONK shockwave (`honk-ring`): grows from 0 to `radius` in `growTicks` around a fixed point.
 * Every enemy part it touches takes `damage` once; enemy shots inside it are erased; infantry
 * inside cover their ears. Team 'player', credited to `owner`.
 */
export class HonkRing extends Entity {
  r = 0;
  t = 0;
  maxR: number = HK.radius;
  growTicks: number = HK.growTicks;
  damageAmount: number = HK.damage;
  stunTicks: number = HK.stunTicks;
  owner = -1;
  /** Who honked (the reaction source). */
  source: Entity | null = null;
  /** Targets already hit, with a bit mask of their parts. */
  private readonly hitList: Entity[] = [];
  private readonly hitMask: number[] = [];
  private readonly heard: Entity[] = [];
  /** The erase circle (reused every tick). */
  private readonly circle = { x: 0, y: 0, r: 0 };

  constructor(world: World, x: number, y: number) {
    super(world, x, y);
    this.type = 'honk-ring';
    this.team = 'player';
    this.z = 60;
    this.despawnMargin = Infinity;
    this.hitbox = { x: -1, y: -1, w: 2, h: 2 };
  }

  override update(): void {
    this.t++;
    this.r = Math.min(this.maxR, (this.t * this.maxR) / this.growTicks);
    if (this.t <= this.growTicks) this.sweep();
    if (this.t >= this.growTicks + RING_FADE) this.remove();
  }

  /** Apply the ring at its current radius. */
  private sweep(): void {
    const w = this.world;
    const circle = this.circle;
    circle.x = this.x;
    circle.y = this.y;
    circle.r = this.r;
    eraseEnemyShots(w, circle);
    const targets = w.snapshotTag('shootable');
    try {
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        if (!t.alive || !hostile(this.team, t.team) || t.hasTag('shot')) continue;
        const boxes = t.hurtboxes();
        let k = this.hitList.indexOf(t);
        for (let part = 0; part < boxes.length && part < 31; part++) {
          if (!t.alive) break;
          const b = boxes[part];
          if (distToRect(this.x, this.y, b) > this.r) continue;
          if (k >= 0 && (this.hitMask[k] & (1 << part)) !== 0) continue;
          if (k < 0) {
            k = this.hitList.length;
            this.hitList.push(t);
            this.hitMask.push(0);
          }
          this.hitMask[k] |= 1 << part;
          const d: Damage = {
            amount: this.damageAmount,
            kind: 'impact',
            dirX: Math.sign(b.x + b.w / 2 - this.x) || 1,
            source: this,
            owner: this.owner,
            weapon: 'swan-honk',
            tags: SONIC,
          };
          w.damage(t, d, part);
        }
      }
    } finally {
      w.releaseSnapshot();
    }
    // Infantry inside cover their ears (once per enemy; bosses are not Enemies).
    const list = w.snapshotTag('enemy');
    try {
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!(e instanceof Enemy) || !e.alive || this.heard.includes(e)) continue;
        if (distToRect(this.x, this.y, e.hitRect()) > this.r) continue;
        this.heard.push(e);
        e.react('ears', this.stunTicks, this.source);
      }
    } finally {
      w.releaseSnapshot();
    }
  }

  override draw(r: Renderer): void {
    const fade = this.t > this.growTicks ? 1 - (this.t - this.growTicks) / RING_FADE : 1;
    if (fade <= 0 || this.r < 2) return;
    ringOpts.alpha = fade;
    ringDim.alpha = fade * 0.5;
    const cx = this.x;
    const cy = this.y;
    // A bright front edge and a dimmer echo 6 px inside it.
    for (let i = 0; i < RING_N; i++) {
      const c = RING_COS[i];
      const s = RING_SIN[i];
      r.rect(cx + Math.round(c * this.r) - 1, cy + Math.round(s * this.r) - 1, 2, 2, i % 2 === 0 ? PAL.snow[3] : PAL.sky[3], ringOpts);
      if (this.r > 8) r.rect(cx + Math.round(c * (this.r - 6)), cy + Math.round(s * (this.r - 6)), 1, 1, PAL.sky[2], ringDim);
    }
  }

  override onRemove(): void {
    this.source = null;
    this.hitList.length = 0;
    this.hitMask.length = 0;
    this.heard.length = 0;
  }
}

/** Start a HONK ring at (x, y), credited to player slot `owner`. */
export function spawnHonkRing(world: World, x: number, y: number, owner = -1, source: Entity | null = null): HonkRing {
  const ring = new HonkRing(world, x, y);
  ring.owner = owner;
  ring.source = source;
  world.add(ring);
  world.audio.sfx('swan/honk');
  world.camera.shake(2, 8);
  return ring;
}

defineWeapon({
  id: 'swan-honk',
  name: 'HONK',
  kind: 'vehicle',
  ammo: Infinity,
  pose: 'heavy',
  cooldown: HK.cooldown,
  auto: false,
  holdRepeat: null,
  fire(ctx) {
    spawnHonkRing(ctx.world, ctx.x, ctx.y, ctx.owner, ctx.shooter);
  },
});

// ---------------------------------------------------------------------------------------------
// Entity ids (GDD §15.2): spawnable on their own for tools and set pieces
// ---------------------------------------------------------------------------------------------

defineEntity(
  'beak-bullet',
  (w, x, y, p) => {
    const f = paramFacing(p, 1);
    const o: ProjectileOpts = {
      team: 'player',
      x,
      y,
      vx: paramNum(p, 'vx', f * G.speed),
      vy: paramNum(p, 'vy', 0),
      damage: G.damage,
      owner: paramNum(p, 'owner', -1),
      life: G.life,
      w: 6,
      h: 4,
      sprite: pick('weapon/beak-bullet', 'weapon/vulcan-bullet'),
      type: 'beak-bullet',
      weapon: 'swan-beak-gun',
    };
    return Projectile.spawn(w, o);
  },
  { category: 'projectile', description: 'SWAN-3 beak gun round' },
);

defineEntity(
  'beak-shell',
  (w, x, y, p) => {
    const f = paramFacing(p, 1);
    return spawnBeakShell(w, x, y, paramNum(p, 'vx', f * SH.speed), paramNum(p, 'vy', 0), paramNum(p, 'owner', -1));
  },
  { category: 'projectile', description: 'SWAN-3 beak shell' },
);

defineEntity(
  'honk-ring',
  (w, x, y, p) => {
    const ring = new HonkRing(w, x, y);
    ring.owner = paramNum(p, 'owner', -1);
    ring.maxR = paramNum(p, 'radius', HK.radius);
    return ring;
  },
  { category: 'projectile', description: 'SWAN-3 HONK shockwave' },
);
