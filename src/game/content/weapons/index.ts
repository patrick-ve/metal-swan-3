/**
 * Content category "weapons" (GDD §5, §6): the nine player weapons, the grenade (bomb button),
 * the knife (automatic melee), generic vehicle guns, and the projectile entity ids of GDD
 * §15.2 for scripts. Registers at import time (docs/ARCHITECTURE.md §7).
 *
 * | id | crate | ammo | numbers |
 * |---|---|---|---|
 * | `pistol` | — | ∞ | 10 dmg, tap 8 (crouch 6) / hold 10, 8 px/tick, 16 on screen |
 * | `machine-gun` | M | 200 / +150 | 10 per round, 1 per 4 ticks, 4-round tap burst, ±1.5 px jitter, aim sweep, 24 on screen |
 * | `shotgun` | S | 30 / +10 | 150 to each target in a 72 px cone (16 → 40 px tall, 6 ticks), every 28, kick 2 px |
 * | `rocket-launcher` | R | 30 / +20 | 30 hit + 50 in r 16, 2 → 7 px/tick, steers ≤ 1 px/tick, every 20, max 2 |
 * | `flamethrower` | F | 30 / +15 | 10 per 2 ticks per target (≤ 12 per press), 96 px stream for 24 ticks, every 24, max 1 |
 * | `laser` | L | 200 / +150 | 8 per 2 ticks per target, beam to 384 px, 1 ammo per 4 ticks, tap = 12-tick pulse, sweep |
 * | `homing` | H | 40 / +20 | 2 missiles per press, 30 hit + 10 in r 8, 4 px/tick, 4°/tick, every 20, max 4 |
 * | `tuba` | T | 25 / +15 | 60 per ring (each enemy once), 12 → 40 px ring at 2.5 px/tick, erases enemy shots, every 30, max 3 |
 * | `bounce-mine` | B | 30 / +10 | 30 hit + 40 in r 20, thrown 3 / −2, 4 landings or 150 ticks, every 20, max 3 |
 * | `grenade` (bomb) | — | 10 per life | 100 direct + 100 in r 24, 2 in the air, every 10 |
 * | `knife` (melee) | — | — | 30, every 20, 26 px ahead × 28 (crouched 18) |
 *
 * Damage kind and tags (docs/api/game.md §6): shotgun `bullet` + `spread`; rocket, homing,
 * mines, grenade `explosion`; flamethrower `fire`; laser `laser`; tuba `impact` + `sonic`;
 * knife `knife`. Sounds (GDD §15.7): `weapon/<id>` (the rocket `weapon/rocket`, the flame
 * `weapon/flame`, the laser loops), mine bounces `weapon/mine-bounce`, knife variants per
 * character. Sprites (weapons/art.ts): `weapon/<shot>` strips, `fx/muzzle-<id>` flashes,
 * `ui/icon-<id>` HUD icons.
 */
import { Entity, type Team } from '../../../engine/entity';
import { hasSfx } from '../../../engine/synth';
import type { World } from '../../../engine/world';
import { explosion, muzzleFlash, musicNotes } from '../../fx';
import { Grenade, type GrenadeOpts } from '../../grenade';
import { Projectile } from '../../projectile';
import { defineEntity, defineWeapon, paramFacing, paramNum, paramStr, type SpawnParams } from '../../registry';
import { TUNING } from '../../tuning';
import { kickBack, meleeBoxFor, meleeStrike, shootBullet, throwGrenade, weaponSfx, type FireContext, type MeleeBox } from '../../weapons';
import { FLAME, HOMING, LASER, MINE, ROCKET, SHOTGUN, TUBA, VOICE, KNIFE_SFX } from './stats';
import {
  FlameStream,
  fireFlame,
  fireHoming,
  fireLaser,
  fireMine,
  fireRocket,
  fireShotgun,
  fireTuba,
  HomingMissile,
  LaserBeam,
  MineDisc,
  Rocket,
  ShotgunBlast,
  TubaRing,
  type MineOpts,
} from './shots';

export { FlameStream, HomingMissile, LaserBeam, MineDisc, Rocket, ShotgunBlast, TubaRing } from './shots';
export { FLAME, HOMING, LASER, MINE, ROCKET, SHOTGUN, TUBA, VOICE, KNIFE_SFX } from './stats';

const W = TUNING.weapons;

/** A shell casing flying out of the gun (cosmetic). */
function casing(ctx: FireContext): void {
  ctx.world.particles.casing(ctx.x - ctx.dirX * 6, ctx.y, ctx.facing);
}

// ---------------------------------------------------------------------------------------------
// Player weapons (GDD §5)
// ---------------------------------------------------------------------------------------------

// The default weapon: unlimited, one shot per press (holding repeats slower).
defineWeapon({
  id: 'pistol',
  name: 'PISTOL',
  ammo: Infinity,
  pose: 'pistol',
  cooldown: W.pistol.cooldown,
  crouchCooldown: W.pistol.crouchCooldown,
  auto: false,
  maxShotsOnScreen: W.pistol.maxOnScreen,
  sfx: 'weapon/pistol',
  fire(ctx) {
    shootBullet(ctx, { speed: W.pistol.speed, damage: W.pistol.damage, sprite: 'weapon/bullet', life: W.pistol.life, w: 6, h: 4 });
    muzzleFlash(ctx.world, ctx.x, ctx.y, ctx.angle, { weapon: 'pistol', follow: ctx.shooter });
  },
});

// Rapid fire; 4 rounds per tap; the aim sweeps through the diagonals while firing (GDD §4.3).
defineWeapon({
  id: 'machine-gun',
  name: 'MACHINE GUN',
  letter: 'M',
  ammo: W.machineGun.ammo,
  ammoAgain: W.machineGun.ammoAgain,
  pose: 'heavy',
  cooldown: W.machineGun.cooldown,
  auto: true,
  burst: W.machineGun.burst,
  sweep: true,
  maxShotsOnScreen: 24,
  sfx: 'weapon/machine-gun',
  voice: VOICE['machine-gun'][0],
  voiceAgain: VOICE['machine-gun'][1],
  fire(ctx) {
    const mg = W.machineGun;
    shootBullet(ctx, {
      speed: mg.speed,
      damage: mg.damage,
      sprite: 'weapon/mg-bullet',
      life: mg.life,
      w: 8,
      h: 4,
      offset: ctx.shotIndex % 2 === 0 ? -mg.jitter : mg.jitter,
    });
    muzzleFlash(ctx.world, ctx.x, ctx.y, ctx.angle, { kind: 'heavy', weapon: 'machine-gun', follow: ctx.shooter });
    casing(ctx);
  },
});

// The crowd-clearer: an instant cone that hits every target in it once; the player is kicked back.
defineWeapon({
  id: 'shotgun',
  name: 'SHOTGUN',
  letter: 'S',
  ammo: SHOTGUN.ammo,
  ammoAgain: SHOTGUN.ammoAgain,
  pose: 'heavy',
  cooldown: SHOTGUN.cooldown,
  auto: true,
  maxShotsOnScreen: SHOTGUN.maxOnScreen,
  sfx: 'weapon/shotgun',
  voice: VOICE.shotgun[0],
  voiceAgain: VOICE.shotgun[1],
  fire(ctx) {
    fireShotgun(ctx);
    muzzleFlash(ctx.world, ctx.x, ctx.y, ctx.angle, { kind: 'heavy', weapon: 'shotgun', follow: ctx.shooter });
    if (Math.abs(ctx.dirX) > 0.5) kickBack(ctx.shooter, -Math.sign(ctx.dirX) * SHOTGUN.kick);
  },
});

// Rockets that accelerate and follow targets up and down (never back).
defineWeapon({
  id: 'rocket-launcher',
  name: 'ROCKET LAUNCHER',
  letter: 'R',
  ammo: ROCKET.ammo,
  ammoAgain: ROCKET.ammoAgain,
  pose: 'heavy',
  cooldown: ROCKET.cooldown,
  auto: true,
  maxShotsOnScreen: ROCKET.maxOnScreen,
  sfx: 'weapon/rocket',
  voice: VOICE['rocket-launcher'][0],
  voiceAgain: VOICE['rocket-launcher'][1],
  fire(ctx) {
    fireRocket(ctx);
    muzzleFlash(ctx.world, ctx.x, ctx.y, ctx.angle, { kind: 'heavy', weapon: 'rocket-launcher', follow: ctx.shooter });
  },
});

// The point-blank killer: a stream that follows the gun for 24 ticks per press.
defineWeapon({
  id: 'flamethrower',
  name: 'FLAMETHROWER',
  letter: 'F',
  ammo: FLAME.ammo,
  ammoAgain: FLAME.ammoAgain,
  pose: 'heavy',
  cooldown: FLAME.cooldown,
  auto: true,
  maxShotsOnScreen: FLAME.maxOnScreen,
  sfx: 'weapon/flame',
  voice: VOICE.flamethrower[0],
  voiceAgain: VOICE.flamethrower[1],
  fire(ctx) {
    fireFlame(ctx);
    muzzleFlash(ctx.world, ctx.x, ctx.y, ctx.angle, { kind: 'heavy', weapon: 'flamethrower', follow: ctx.shooter });
  },
});

// A beam that stays on while fire is held (1 ammo per 4 ticks); a tap is a 12-tick pulse.
defineWeapon({
  id: 'laser',
  name: 'LASER',
  letter: 'L',
  ammo: LASER.ammo,
  ammoAgain: LASER.ammoAgain,
  pose: 'heavy',
  cooldown: LASER.cooldown,
  auto: true,
  burst: LASER.burst,
  sweep: true,
  // The beam plays its own loop ('weapon/laser'); no per-shot sound.
  voice: VOICE.laser[0],
  voiceAgain: VOICE.laser[1],
  fire(ctx) {
    fireLaser(ctx);
  },
});

// Two missiles per press that find their own seats.
defineWeapon({
  id: 'homing',
  name: 'HOMING MISSILES',
  letter: 'H',
  ammo: HOMING.ammo,
  ammoAgain: HOMING.ammoAgain,
  ammoPerShot: HOMING.perPress,
  pose: 'heavy',
  cooldown: HOMING.cooldown,
  auto: true,
  // A press needs room for both missiles: with 3 or more in the air it waits (max 4 in the air).
  maxShotsOnScreen: HOMING.maxMissiles - HOMING.perPress + 1,
  sfx: 'weapon/homing',
  voice: VOICE.homing[0],
  voiceAgain: VOICE.homing[1],
  fire(ctx) {
    fireHoming(ctx);
    muzzleFlash(ctx.world, ctx.x, ctx.y, ctx.angle, { kind: 'heavy', weapon: 'homing', follow: ctx.shooter });
  },
});

// Captured Legion tech: sonic rings that erase enemy shots (the only weapon that defends).
defineWeapon({
  id: 'tuba',
  name: 'TUBA',
  letter: 'T',
  ammo: TUBA.ammo,
  ammoAgain: TUBA.ammoAgain,
  pose: 'heavy',
  cooldown: TUBA.cooldown,
  auto: true,
  maxShotsOnScreen: TUBA.maxOnScreen,
  sfx: 'weapon/tuba',
  voice: VOICE.tuba[0],
  voiceAgain: VOICE.tuba[1],
  fire(ctx) {
    fireTuba(ctx);
    muzzleFlash(ctx.world, ctx.x, ctx.y, ctx.angle, { kind: 'heavy', weapon: 'tuba', follow: ctx.shooter });
    if (ctx.shotIndex % 3 === 0) musicNotes(ctx.world, ctx.x - ctx.dirX * 6, ctx.y - 8, 1);
  },
});

// Disc mines that hop along the floor: the answer to crawlers, creatures and shafts.
defineWeapon({
  id: 'bounce-mine',
  name: 'BOUNCE MINES',
  letter: 'B',
  ammo: MINE.ammo,
  ammoAgain: MINE.ammoAgain,
  pose: 'heavy',
  cooldown: MINE.cooldown,
  auto: true,
  maxShotsOnScreen: MINE.maxOnScreen,
  sfx: 'weapon/bounce-mine',
  voice: VOICE['bounce-mine'][0],
  voiceAgain: VOICE['bounce-mine'][1],
  fire(ctx) {
    fireMine(ctx);
    muzzleFlash(ctx.world, ctx.x, ctx.y, ctx.angle, { kind: 'heavy', weapon: 'bounce-mine', follow: ctx.shooter });
  },
});

// ---------------------------------------------------------------------------------------------
// Bomb and melee (GDD §6)
// ---------------------------------------------------------------------------------------------

// The bomb button: an arcing grenade that bounces once and explodes (max 2 in the air).
defineWeapon({
  id: 'grenade',
  name: 'GRENADE',
  kind: 'bomb',
  ammo: Infinity,
  pose: 'pistol',
  cooldown: TUNING.grenade.cooldown,
  auto: false,
  holdRepeat: null,
  maxShotsOnScreen: TUNING.grenade.inAir,
  icon: 'ui/icon-bomb',
  fire(ctx) {
    const g = TUNING.grenade;
    throwGrenade(ctx, { sprite: 'weapon/grenade', damage: g.direct, blastDamage: g.splash, blastRadius: g.radius, blastFalloff: g.falloff });
  },
});

/**
 * The knife's reach (GDD §6.2): 26 px ahead of the hitbox front edge × 28 px from the feet
 * (crouched 26 × 18). The box starts `TUNING.knife.overlap` px inside the body, so it is that
 * much wider.
 */
export const KNIFE: MeleeBox = {
  w: 26 + TUNING.knife.overlap,
  h: TUNING.knife.h,
  crouchH: 18,
  damage: TUNING.knife.damage,
};

/** Character data may name its own knife sound (any of these fields; read once per strike). */
interface KnifeLook {
  knifeSfx?: string;
  knife?: { sfx?: string } | string;
  meleeSfx?: string;
}

/**
 * The knife sound for a shooter: the character's own variant (its def, then GDD §15.7 by id:
 * umbrella, needles, pan, wrench), else `weapon/knife`; a variant that has no recipe falls back
 * to `weapon/knife`.
 */
export function knifeSfx(shooter: Entity | null): string {
  const c = (shooter as (Entity & { character?: { id?: string } & KnifeLook }) | null)?.character;
  let id: string | undefined;
  if (c) {
    id = c.knifeSfx ?? c.meleeSfx ?? (typeof c.knife === 'string' ? undefined : c.knife?.sfx);
    if (!id && c.id) id = KNIFE_SFX[c.id];
  }
  if (!id) return 'weapon/knife';
  return hasSfx(id) || !hasSfx('weapon/knife') ? id : 'weapon/knife';
}

// Automatic melee: used instead of a shot when a soft enemy is within reach.
defineWeapon({
  id: 'knife',
  name: 'KNIFE',
  kind: 'melee',
  ammo: Infinity,
  pose: 'pistol',
  cooldown: TUNING.knife.cooldown,
  auto: false,
  holdRepeat: null,
  melee: KNIFE,
  // The sound depends on the character (played in fire).
  fire(ctx) {
    weaponSfx(ctx, knifeSfx(ctx.shooter));
    meleeStrike(ctx, meleeBoxFor(ctx, KNIFE), KNIFE.damage);
  },
});

// ---------------------------------------------------------------------------------------------
// Generic vehicle guns (content vehicles may use their own)
// ---------------------------------------------------------------------------------------------

// Generic vehicle main gun: 5-round bursts.
defineWeapon({
  id: 'vulcan',
  name: 'VULCAN',
  kind: 'vehicle',
  ammo: Infinity,
  pose: 'heavy',
  cooldown: W.vulcan.cooldown,
  auto: true,
  burst: W.vulcan.burst,
  sfx: 'weapon/vulcan',
  fire(ctx) {
    const v = W.vulcan;
    shootBullet(ctx, {
      speed: v.speed,
      damage: v.damage,
      sprite: 'weapon/vulcan-bullet',
      life: v.life,
      w: 8,
      h: 4,
      offset: ctx.shotIndex % 2 === 0 ? -1 : 1,
    });
    muzzleFlash(ctx.world, ctx.x, ctx.y, ctx.angle, { kind: 'heavy', follow: ctx.shooter });
  },
});

// Generic vehicle cannon: a heavy shell on a shallow arc that explodes on impact.
defineWeapon({
  id: 'cannon',
  name: 'CANNON',
  kind: 'vehicle',
  ammo: Infinity,
  pose: 'heavy',
  cooldown: W.cannon.cooldown,
  auto: false,
  holdRepeat: null,
  maxShotsOnScreen: 2,
  sfx: 'weapon/cannon',
  icon: 'ui/icon-shell',
  fire(ctx) {
    const c = W.cannon;
    const p = Projectile.spawn(ctx.world, {
      team: ctx.team,
      x: ctx.x,
      y: ctx.y,
      vx: ctx.facing * c.speed + ctx.vx * 0.5,
      vy: c.vy,
      gravity: c.gravity,
      damage: c.damage,
      kind: 'explosion',
      owner: ctx.owner,
      shooter: ctx.shooter,
      life: c.life,
      w: 8,
      h: 6,
      sprite: 'weapon/shell',
      impact: 'none',
      offscreen: 48,
      type: 'cannon',
      onImpact: (shell, target, x, y) =>
        explosion(ctx.world, x, y, 'm', { damage: 40, team: shell.team, owner: shell.damage.owner, exclude: target }),
    });
    ctx.gun.track(p);
    muzzleFlash(ctx.world, ctx.x, ctx.y, ctx.angle, { kind: 'heavy', follow: ctx.shooter });
    ctx.world.camera.shake(1, 6);
  },
});

// ---------------------------------------------------------------------------------------------
// Projectile entities (GDD §15.2) for scripts: `ctx.spawn('rocket', x, y, { facing: -1 })`
// ---------------------------------------------------------------------------------------------

/**
 * Common spawn params: `team` ('player' | 'enemy', default 'player'), `facing` (1 / −1),
 * `angle` (degrees from the facing, −90 = up; default 0), `owner` (player slot, default −1).
 */
function spawnAim(p: SpawnParams): { team: Team; angle: number; facing: 1 | -1; owner: number } {
  const facing = paramFacing(p, 1);
  const team: Team = paramStr(p, 'team', 'player') === 'enemy' ? 'enemy' : 'player';
  const elev = (paramNum(p, 'angle', 0) * Math.PI) / 180;
  const angle = facing > 0 ? elev : Math.PI - elev;
  return { team, angle, facing, owner: paramNum(p, 'owner', -1) };
}

/** Script-spawned shots come out 16 px above the given (feet) point, like a gun at the hip. */
const SPAWN_LIFT = 16;

function spawnBullet(w: World, x: number, y: number, p: SpawnParams, weapon: string, sprite: string, speed: number): Entity {
  const a = spawnAim(p);
  return Projectile.spawn(w, {
    team: a.team,
    x,
    y: y - SPAWN_LIFT,
    vx: Math.cos(a.angle) * speed,
    vy: Math.sin(a.angle) * speed,
    damage: 10,
    owner: a.owner,
    sprite,
    life: 60,
    w: 6,
    h: 4,
    weapon,
    type: weapon,
  });
}

defineEntity('bullet-pistol', (w, x, y, p) => spawnBullet(w, x, y, p, 'pistol', 'weapon/bullet', W.pistol.speed), {
  category: 'projectile',
  description: 'A pistol bullet (params facing, angle, team, owner).',
});
defineEntity('bullet-mg', (w, x, y, p) => spawnBullet(w, x, y, p, 'machine-gun', 'weapon/mg-bullet', W.machineGun.speed), {
  category: 'projectile',
  description: 'A machine-gun round (params facing, angle, team, owner).',
});
defineEntity(
  'shotgun-blast',
  (w, x, y, p) => {
    const a = spawnAim(p);
    return ShotgunBlast.spawn(w, { team: a.team, owner: a.owner, x, y: y - SPAWN_LIFT, angle: a.angle });
  },
  { category: 'projectile', description: 'One shotgun cone (params facing, angle, team, owner).' },
);
defineEntity(
  'rocket',
  (w, x, y, p) => {
    const a = spawnAim(p);
    return Rocket.spawn(w, {
      team: a.team,
      owner: a.owner,
      x,
      y: y - SPAWN_LIFT,
      vx: Math.cos(a.angle) * ROCKET.speed,
      vy: Math.sin(a.angle) * ROCKET.speed,
      damage: ROCKET.hit,
      sprite: 'weapon/rocket',
      weapon: 'rocket-launcher',
      type: 'rocket',
    });
  },
  { category: 'projectile', description: 'A steering rocket (params facing, angle, team, owner).' },
);
defineEntity(
  'flame-stream',
  (w, x, y, p) => {
    const a = spawnAim(p);
    return FlameStream.spawn(w, { team: a.team, owner: a.owner, x, y: y - SPAWN_LIFT, angle: a.angle, facing: a.facing });
  },
  { category: 'projectile', description: 'One 24-tick flame stream (params facing, angle, team, owner).' },
);
defineEntity(
  'laser-beam',
  (w, x, y, p) => {
    const a = spawnAim(p);
    const b = LaserBeam.spawn(w, { team: a.team, owner: a.owner, x, y: y - SPAWN_LIFT, angle: a.angle });
    // Without a gun: a pulse of `shots` × 4 ticks (default 3 = 12 ticks), as from a tap.
    for (let i = 1; i < Math.max(1, Math.round(paramNum(p, 'shots', 3))); i++) b.onTicks += LASER.cooldown;
    return b;
  },
  { category: 'projectile', description: 'A laser pulse (params facing, angle, team, owner, shots).' },
);
defineEntity(
  'homing-missile',
  (w, x, y, p) => {
    const a = spawnAim(p);
    return HomingMissile.spawn(w, {
      team: a.team,
      owner: a.owner,
      x,
      y: y - SPAWN_LIFT,
      vx: Math.cos(a.angle) * HOMING.speed,
      vy: Math.sin(a.angle) * HOMING.speed,
      damage: HOMING.hit,
      sprite: 'weapon/homing',
      weapon: 'homing',
      type: 'homing-missile',
    });
  },
  { category: 'projectile', description: 'A homing missile (params facing, angle, team, owner).' },
);
defineEntity(
  'tuba-ring',
  (w, x, y, p) => {
    const a = spawnAim(p);
    return TubaRing.spawn(w, {
      team: a.team,
      owner: a.owner,
      x,
      y: y - SPAWN_LIFT,
      vx: Math.cos(a.angle) * TUBA.speed,
      vy: Math.sin(a.angle) * TUBA.speed,
      damage: TUBA.damage,
      weapon: 'tuba',
      type: 'tuba-ring',
    });
  },
  { category: 'projectile', description: 'A sonic tuba ring (params facing, angle, team, owner).' },
);
defineEntity(
  'mine-disc',
  (w, x, y, p) => {
    const a = spawnAim(p);
    const o: MineOpts = {
      team: a.team,
      owner: a.owner,
      x,
      y: y - SPAWN_LIFT,
      vx: a.facing * MINE.vx,
      vy: MINE.vy,
      damage: MINE.hit,
      kind: 'explosion',
      sprite: 'weapon/mine-disc',
      weapon: 'bounce-mine',
      type: 'mine-disc',
      floorY: y,
    };
    return MineDisc.spawn(w, o);
  },
  { category: 'projectile', description: 'A bounce mine (params facing, team, owner).' },
);
defineEntity(
  'grenade',
  (w, x, y, p) => {
    const a = spawnAim(p);
    const g = TUNING.grenade;
    const o: GrenadeOpts = {
      team: a.team,
      owner: a.owner,
      x,
      y: y - 30,
      vx: a.facing * g.vx,
      vy: g.vy,
      gravity: g.gravity,
      damage: g.direct,
      kind: 'explosion',
      sprite: 'weapon/grenade',
      w: 6,
      h: 6,
      blastDamage: g.splash,
      blastRadius: g.radius,
      blastFalloff: g.falloff,
      weapon: 'grenade',
      type: 'grenade',
    };
    return Grenade.spawn(w, o);
  },
  { category: 'projectile', description: 'A thrown grenade (params facing, team, owner).' },
);
