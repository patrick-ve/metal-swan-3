/**
 * Mission oldenzaal — the meal (docs/design/oldenzaal.md §4.3; docs/api/oldenzaal.md "WUGHOST",
 * "ZOMBIES"). Owner: WUGHOST → ZOMBIES (revision 2: the frikandel's blast is a big explosion, R2-11).
 * Art in ./art.ts; the statuses in characters/snack-power.ts.
 *
 * | id | category | what |
 * |---|---|---|
 * | `pickup-oz-meal` | item | the paper tray `PATAT MAYO MET 2 FRIKANDELLEN`: snack power + 2 frikandels (`eatMeal`). A hero who has snack power already leaves it lying (2P: one meal per hero). Tossed by Meneer Wu (`tossTo`) |
 * | `oz-frikandel` | (weapon, kind 'bomb') + other | the bomb-button weapon of `snack-frikandel` AND its projectile: a frikandel in a high arc that flies through people and pops on its first floor contact (or on touching a dead soldier in sight, or after 150 ticks) into the holy-mayo explosion. Spawn params `vx`, `vy`, `owner` |
 * | `oz-frikandel-blast` | fx | the holy-mayo explosion (R2-11): on its first tick `frikandelExplosion` (radius `r`, default `FRIKANDEL_BLAST.radius` 60); a fireball with a cream-white burst and a warm glow, a light (`LIGHT_TAG`). Params `owner` (−1), `r` |
 * | `oz-mayo-splat` | fx | the white splash when the mayo takes a hit (snack power). Param `facing` |
 *
 * THE EXPLOSION (revision 2, R2-11; `frikandelExplosion(world, x, y, owner, r)`, also exported as
 * `holyMayoBlast`): heavy damage to every dead soldier within r (`FRIKANDEL_BLAST.damage` 150 at the
 * centre → `edge` 80 at r; `Zombie.blast`: damage + a heavy stagger). Revision 2 has no souls (R2-6):
 * wave A's soul contract went with the possessed (INTEGRATE). Nobody else is hurt (heroes, neutrals, other enemies). Returns the number of enemies hit.
 */
import { Entity } from '../../../../engine/entity';
import { distToRect, type Rect } from '../../../../engine/math';
import { PAL } from '../../../../engine/palette';
import { PAL_HD_OZ } from '../../../../engine/palette-hd';
import type { ParticlePreset } from '../../../../engine/particles';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import type { World } from '../../../../engine/world';
import { Grenade } from '../../../grenade';
import { Pickup } from '../../../pickup';
import { isPlayer } from '../../../player/player';
import { defineEntity, defineWeapon, paramNum } from '../../../registry';
import { throwStart, type FireContext } from '../../../weapons';
import { eatMeal } from '../../characters/snack-power';
import { OZ_STATUS_SNACK, OZ_WUGHOST } from '../../missions/oldenzaal/ids';
import { isZombie } from '../zombies/api';
import { FRIKANDEL_BLAST } from '../zombies/numbers';
import { explosion } from '../../../fx';
import { SNACK_POWER_CALLOUT } from '../../missions/oldenzaal/lines';
import { LIGHT_TAG, type LightSource, type LightSpot } from '../kit/light-api';

export { eatMeal, frikandelsLeft, OZ_STATUS_FRIKANDEL, SNACK, snackTicks, splatReady } from '../../characters/snack-power';

/** The frikandel throw and the holy-mayo blast (spec §4.3; tuned numbers). */
export const FRIKANDEL = {
  /** The high arc: speed forward / up (up held: steeper), gravity. Apex ≈ 32 px, reach ≈ 70 px. */
  vx: 1.7,
  vy: -3.6,
  upVx: 0.8,
  upVy: -4.4,
  crouchVx: 2.1,
  crouchVy: -2.4,
  gravity: 0.2,
  fuse: 150,
  cooldown: 24,
  inAir: 2,
  /** The explosion's radius (px; a grenade's is 24; R2-11: wide). */
  radius: FRIKANDEL_BLAST.radius,
  /** Visual life of the blast fx (ticks). */
  blastTicks: 36,
  splatTicks: 24,
} as const;

// ---------------------------------------------------------------------------- the explosion

const zcause = { owner: -1, damage: 0, x: 0, y: 0, weapon: OZ_WUGHOST.frikandel as string, stagger: FRIKANDEL_BLAST.stagger };
const area: Rect = { x: 0, y: 0, w: 0, h: 0 };
const found: Entity[] = [];

/**
 * The holy-mayo explosion at (x, y) (R2-11; see the module comment): the dead soldiers take heavy
 * damage and a stagger. Returns the hits.
 */
export function frikandelExplosion(world: World, x: number, y: number, owner = -1, r: number = FRIKANDEL.radius, _source: Entity | null = null): number {
  area.x = x - r;
  area.y = y - r;
  area.w = r * 2;
  area.h = r * 2;
  found.length = 0;
  world.query(area, undefined, found);
  zcause.owner = owner;
  zcause.x = x;
  zcause.y = y;
  let n = 0;
  for (let i = 0; i < found.length; i++) {
    const e = found[i];
    if (!e.alive || e.removed || isPlayer(e)) continue;
    const dist = distToRect(x, y, e.hitRect());
    if (dist >= r) continue;
    try {
      if (isZombie(e)) {
        zcause.damage = FRIKANDEL_BLAST.damage + (FRIKANDEL_BLAST.edge - FRIKANDEL_BLAST.damage) * Math.min(1, dist / r);
        if (e.blast(zcause)) n++;
      }
    } catch (err) {
      world.reportError(`${e.type}.frikandel`, err);
    }
  }
  found.length = 0;
  return n;
}

/** Wave A's name for the blast (kept: scripts and tests call it). */
export const holyMayoBlast = frikandelExplosion;

// ---------------------------------------------------------------------------- the frikandel

/** Is `e` something the frikandel pops on (a dead soldier in sight)? */
function popsOn(e: Entity): boolean {
  return e.alive && isZombie(e) && !e.hidden;
}

const near: Entity[] = [];
const touch: Rect = { x: 0, y: 0, w: 0, h: 0 };

/**
 * The thrown frikandel: a Grenade that flies THROUGH people (no 'shot' tag: no direct damage)
 * and pops on its first floor contact, on touching a dead soldier, or when
 * its fuse runs out: the holy-mayo explosion (`oz-frikandel-blast`).
 */
export class FrikandelBomb extends Grenade {
  private popped = false;

  override init(o: Parameters<Grenade['init']>[0]): void {
    super.init({ contacts: 1, fuse: FRIKANDEL.fuse, bounceSfx: '', blastDamage: 0, ...o });
    this.removeTag('shot');
    this.popped = false;
    this.addTag('oz-frikandel');
  }

  override update(): void {
    super.update();
    if (this.popped || this.removed) return;
    touch.x = this.x - 4;
    touch.y = this.y - 4;
    touch.w = 8;
    touch.h = 8;
    near.length = 0;
    this.world.query(touch, popsOn, near);
    const hit = near.length > 0;
    near.length = 0;
    if (hit) this.explode();
  }

  override explode(): void {
    if (this.popped) return;
    this.popped = true;
    this.world.spawn(OZ_WUGHOST.blast, this.x, this.y, { owner: this.damage.owner ?? -1 });
    this.remove();
  }
}

/** The weapon of the BOMB button while a hero has frikandels (snack-frikandel's `bomb`). */
export function throwFrikandel(ctx: FireContext): FrikandelBomb {
  const F = FRIKANDEL;
  let vx = ctx.facing * F.vx;
  let vy: number = F.vy;
  if (ctx.aim === 'up') {
    vx = ctx.facing * F.upVx;
    vy = F.upVy;
  } else if (ctx.crouching) {
    vx = ctx.facing * F.crouchVx;
    vy = F.crouchVy;
  }
  vx += ctx.vx * 0.5;
  const start = throwStart(ctx, vx);
  const b = FrikandelBomb.spawn(ctx.world, {
    team: ctx.team,
    x: start.x,
    y: start.y,
    vx: start.vx,
    vy,
    damage: 0,
    gravity: F.gravity,
    w: 8,
    h: 6,
    sprite: 'weapon/oz-frikandel',
    type: OZ_WUGHOST.frikandel,
    weapon: OZ_WUGHOST.frikandel,
    owner: ctx.owner,
    shooter: ctx.shooter,
  });
  ctx.gun.track(b);
  return b;
}

defineWeapon({
  id: OZ_WUGHOST.frikandel,
  name: 'FRIKANDEL',
  kind: 'bomb',
  ammo: Infinity,
  pose: 'pistol',
  cooldown: FRIKANDEL.cooldown,
  auto: false,
  holdRepeat: null,
  maxShotsOnScreen: FRIKANDEL.inAir,
  icon: 'ui/icon-oz-frikandel',
  sfx: 'oz/meal/throw',
  fire(ctx) {
    throwFrikandel(ctx);
  },
});

defineEntity(
  OZ_WUGHOST.frikandel,
  (w, x, y, p) => {
    const b = new FrikandelBomb(w);
    b.init({
      team: 'player',
      x,
      y,
      vx: paramNum(p, 'vx', 0),
      vy: paramNum(p, 'vy', 0),
      damage: 0,
      gravity: FRIKANDEL.gravity,
      w: 8,
      h: 6,
      sprite: 'weapon/oz-frikandel',
      type: OZ_WUGHOST.frikandel,
      weapon: OZ_WUGHOST.frikandel,
      owner: paramNum(p, 'owner', -1),
    });
    return b;
  },
  { category: 'other', description: 'oldenzaal: a thrown frikandel (pops into the holy-mayo blast).' },
);

// ---------------------------------------------------------------------------- the blast

/** Cream drops and pale sparkles of the blast (cosmetic). */
const CREAM: ParticlePreset = {
  kind: 'rect',
  w: 2,
  h: 2,
  life: [18, 30],
  gravity: 0.1,
  drag: 0.96,
  colors: [PAL.snow[3], PAL.cloth[3], PAL.cloth[2]],
  fadeFrom: 0.6,
  ground: 'stop',
};
const SPARKLE: ParticlePreset = {
  kind: 'rect',
  w: 1,
  h: 1,
  life: [20, 34],
  gravity: -0.03,
  drag: 0.93,
  colors: [PAL.snow[3], PAL.gold[3], PAL.cloth[3]],
  additive: true,
};

const blastOpts: DrawOpts = {};
const glowOpts: DrawOpts = { blend: 'add', alpha: 0.5 };

/** The holy-mayo explosion fx: runs `frikandelExplosion` on its first tick, then shows the fireball and the burst. */
export class OzFrikandelBlast extends Entity implements LightSource {
  t = 0;
  readonly owner: number;
  readonly r: number;
  /** The dead soldiers the blast hit (set on its first tick). */
  hits = 0;

  constructor(world: World, x: number, y: number, owner: number, r: number) {
    super(world, x, y);
    this.owner = owner;
    this.r = r;
    this.z = 62;
    this.team = 'neutral';
    this.despawnMargin = Infinity;
    this.hitbox = { x: -r, y: -r, w: r * 2, h: r * 2 };
    this.addTag('fx');
    this.addTag(LIGHT_TAG);
  }

  override update(): void {
    if (this.t === 0) {
      const w = this.world;
      this.hits = frikandelExplosion(w, this.x, this.y - 8, this.owner, this.r, this);
      // A real explosion (R2-11): the fireball, smoke and debris (no damage of its own: the hits are above).
      explosion(w, this.x, this.y, 'm', { damage: 0, owner: this.owner, shake: 4, silent: false });
      w.audio.sfx('oz/meal/blast');
      w.particles.burst(CREAM, this.x, this.y - 6, 26, 1.2, 3.8, -Math.PI / 2, 2.8);
      w.particles.burst(SPARKLE, this.x, this.y - 12, 18, 0.4, 1.9);
    }
    if (++this.t >= FRIKANDEL.blastTicks) this.remove();
  }

  lightOf(out: LightSpot, _tick: number): boolean {
    const k = 1 - this.t / FRIKANDEL.blastTicks;
    if (k <= 0) return false;
    out.x = this.x;
    out.y = this.y - 14;
    out.r = 52 + 40 * (1 - k);
    out.color = PAL_HD_OZ.candle[5];
    out.intensity = k;
    out.flicker = 0;
    return true;
  }

  override draw(r: Renderer): void {
    const frames = 6;
    const i = Math.min(frames - 1, Math.floor((this.t / FRIKANDEL.blastTicks) * frames));
    blastOpts.alpha = this.t > FRIKANDEL.blastTicks - 8 ? (FRIKANDEL.blastTicks - this.t) / 8 : 1;
    r.sprite('fx/oz/mayo/blast', i, this.x, this.y, blastOpts);
    glowOpts.alpha = 0.3 * blastOpts.alpha;
    r.sprite('fx/oz/mayo/blast', i, this.x, this.y, glowOpts);
  }
}

defineEntity(OZ_WUGHOST.blast, (w, x, y, p) => new OzFrikandelBlast(w, x, y, paramNum(p, 'owner', -1), Math.max(8, paramNum(p, 'r', FRIKANDEL.radius))), {
  category: 'fx',
  description: 'oldenzaal: the holy-mayo explosion (R2-11): heavy damage and a stagger to every dead soldier within r.',
});

// ---------------------------------------------------------------------------- the splat

const splatOpts: DrawOpts = {};

/** The mayo splat that took a hit: a white splash on the hero (cosmetic). */
export class OzMayoSplat extends Entity {
  t = 0;
  constructor(world: World, x: number, y: number, facing: number) {
    super(world, x, y);
    this.facing = facing < 0 ? -1 : 1;
    this.z = 64;
    this.team = 'neutral';
    this.despawnMargin = Infinity;
    this.hitbox = { x: -8, y: -8, w: 16, h: 16 };
    this.addTag('fx');
  }

  override update(): void {
    if (++this.t >= FRIKANDEL.splatTicks) this.remove();
  }

  override draw(r: Renderer): void {
    const i = Math.min(4, Math.floor((this.t / FRIKANDEL.splatTicks) * 5));
    splatOpts.flipX = this.facing < 0;
    splatOpts.alpha = this.t > FRIKANDEL.splatTicks - 6 ? (FRIKANDEL.splatTicks - this.t) / 6 : 1;
    r.sprite('fx/oz/mayo/splat', i, this.x, this.y, splatOpts);
  }
}

defineEntity(OZ_WUGHOST.splat, (w, x, y, p) => new OzMayoSplat(w, x, y, paramNum(p, 'facing', 1)), {
  category: 'fx',
  description: 'oldenzaal: the mayo splat (snack power absorbed a hit).',
});

// ---------------------------------------------------------------------------- the meal

defineEntity(
  OZ_WUGHOST.meal,
  (w, x, y, p) =>
    new Pickup(
      w,
      x,
      y,
      {
        sprite: 'item/pickup-oz-meal',
        effect(player) {
          // One meal per hero: a hero who already has snack power leaves it for the other.
          if (player.status.has(OZ_STATUS_SNACK)) return false;
          return eatMeal(player);
        },
        sfx: 'oz/meal/catch',
        score: 500,
        message: SNACK_POWER_CALLOUT,
        w: 16,
        h: 10,
        tags: ['food'],
      },
      p,
    ),
  { category: 'item', description: 'oldenzaal: PATAT MAYO MET 2 FRIKANDELLEN (snack power + 2 frikandel bombs).' },
);
