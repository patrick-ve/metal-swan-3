/**
 * Items the player collects by touch (docs/ARCHITECTURE.md §6, GDD §7.1): weapon medallions,
 * bomb crates, food, treasure, extra lives, repair kits. A Pickup rests on the ground and bobs
 * (2 px over 40 ticks), drifts toward a player inside its small magnet radius, and on touch
 * applies its effect, plays a sound, scores and emits 'pickup'. Dropped items (spawn param
 * `dropped: true`) pop up (vy −2.0), land, blink during their last 120 ticks and vanish after
 * 720 ticks; level-placed items stay.
 *
 * Spec options for special items: `gravity: false` (hangs where it is placed: the floating
 * glide-trail notes), `fall` (feather-light fall: golden notes), `bounce` (the weapon medallion
 * bounces when it lands), `hover` (drawn above the floor), `waddle` (walks toward the nearest
 * player: the tin cygnet 1UP), `sparkle` (a glitter burst on collect), `tags` ('food' …).
 * `tossTo(player)` throws an item at a player (a parachuting hostage's gift, GDD §7.2 balloon).
 *
 * ```ts
 * defineEntity('pickup-bombs', (w, x, y, p) => new Pickup(w, x, y, {
 *   sprite: 'item/pickup-bombs', effect: bombsEffect(10), score: 500, message: 'BOMBS +10',
 * }, p), { category: 'item' });
 * ```
 */
import type { SfxOpts } from '../engine/audio';
import { Entity } from '../engine/entity';
import { overlaps, type Rect } from '../engine/math';
import { PAL } from '../engine/palette';
import type { ParticlePreset } from '../engine/particles';
import { Body, moveBody } from '../engine/physics';
import type { DrawOpts, Renderer } from '../engine/render';
import { Animator, hasSprite } from '../engine/sprites';
import type { World } from '../engine/world';
import { hudOf } from './context';
import { awardScore } from './events';
import { isPlayer, type Player } from './player/player';
import { NO_PARAMS, paramBool, type SpawnParams } from './registry';
import { TUNING } from './tuning';
import type { Vehicle } from './vehicle';

/**
 * Item rules of GDD §7.1 (the GDD numbers win over TUNING.pickup where they differ): dropped
 * items pop up at vy −2.0, vanish after 720 ticks and blink during the last 120; everything
 * bobs 2 px over 40 ticks.
 */
export const ITEM_RULES = {
  popVy: -2.0,
  dropLifetime: 720,
  blinkTicks: 120,
  bobAmp: 2,
  bobPeriod: 40,
  /** Speed of an item thrown at a player (`tossTo`), px/tick, and how long it homes in. */
  tossSpeed: 2.6,
  tossTicks: 150,
} as const;

export interface PickupSpec {
  /** Sprite id (feet anchor). */
  sprite: string;
  /** Apply the effect. Return false to leave the item where it is (cannot use it now). */
  effect(player: Player, item: Pickup): boolean | void;
  /** When the player is driving: default = `effect` on the driver. */
  vehicleEffect?(vehicle: Vehicle, player: Player, item: Pickup): boolean | void;
  /** Sound on collect (default 'item/pickup'). */
  sfx?: string;
  /** Pitch of that sound (treasure rings higher the more it is worth). */
  sfxPitch?: number;
  /** Announcer line on collect. */
  voice?: string;
  /** Points on collect. */
  score?: number;
  /** Pop-up line in the player's HUD panel. */
  message?: string;
  /** Magnet radius (px, default TUNING.pickup.magnet; 0 = off). */
  magnet?: number;
  /** Bob amplitude (px, default 2). */
  bob?: number;
  /** Ticks before it vanishes (0 = never). Dropped items default to 720. */
  lifetime?: number;
  /** Hitbox size (default 14×14), bottom centre on the anchor. */
  w?: number;
  h?: number;
  /** Falls onto the ground (default true). false: hangs where it is placed (no body). */
  gravity?: boolean;
  /** A light, slow fall (golden notes): body gravity and fall speed limit. */
  fall?: { readonly gravity: number; readonly maxFall: number };
  /** Bounce factor on landing, 0..1 (the weapon medallion bounces when it lands). */
  bounce?: number;
  /** Drawn this many px above the floor (a floating note). */
  hover?: number;
  /** Walks toward the nearest player at this speed while on the ground (never into a gap). */
  waddle?: number;
  /** A glitter burst where it is collected (treasure). */
  sparkle?: boolean;
  /** Extra tags ('food' lets the player show a chew face). */
  tags?: readonly string[];
}

const drawOpts: DrawOpts = {};
const sfxOpts: SfxOpts = {};

/** Glitter for treasure pickups (GDD §7.1 "sparkle fx"). */
export const SPARKLE: ParticlePreset = {
  kind: 'rect',
  w: 1,
  h: 1,
  life: [12, 22],
  drag: 0.86,
  gravity: -0.01,
  colors: [PAL.snow[3], PAL.gold[3], PAL.gold[2]],
  additive: true,
};

export class Pickup extends Entity {
  readonly spec: PickupSpec;
  readonly anim = new Animator();
  /** Ticks left (Infinity = never vanishes). */
  life: number;
  readonly params: SpawnParams;
  /** Ticks alive (bob phase). */
  protected t = 0;
  private collected = false;
  /** `tossTo`: the player it flies to and the ticks of homing left. */
  private tossTarget: Player | null = null;
  private tossLeft = 0;

  constructor(world: World, x: number, y: number, spec: PickupSpec, params: SpawnParams = NO_PARAMS) {
    super(world, x, y);
    this.spec = spec;
    this.params = params;
    this.team = 'neutral';
    this.z = 20;
    this.despawnMargin = 240;
    this.facing = 1;
    const w = spec.w ?? 14;
    const h = spec.h ?? 14;
    this.hitbox = { x: -w / 2, y: -h, w, h };
    if (spec.gravity !== false) {
      // A waddler sets its own ground speed every tick (no friction eating into it).
      this.body = new Body({ w, h, groundFriction: spec.waddle ? 1 : 0.85, bounce: spec.bounce ?? 0 });
      if (spec.fall) {
        this.body.gravity = spec.fall.gravity;
        this.body.maxFall = spec.fall.maxFall;
      }
    }
    const dropped = paramBool(params, 'dropped', false);
    const life = spec.lifetime ?? (dropped ? ITEM_RULES.dropLifetime : 0);
    this.life = life > 0 ? life : Infinity;
    this.addTag('item');
    for (const tag of spec.tags ?? []) this.addTag(tag);
    if (hasSprite(spec.sprite)) this.anim.play(spec.sprite);
  }

  /** Was it picked up already? */
  get taken(): boolean {
    return this.collected;
  }

  /**
   * Throw the item at a player: it flies straight to them (no gravity) for up to 150 ticks,
   * then falls as usual. A parachuting hostage throws its gift up to the rider this way.
   */
  tossTo(p: Player | null): void {
    if (!p) return;
    this.tossTarget = p;
    this.tossLeft = ITEM_RULES.tossTicks;
  }

  override update(): void {
    this.t++;
    if (this.tossLeft > 0 && this.homeIn()) {
      // Flying to its catcher: no physics.
      this.x += this.vx;
      this.y += this.vy;
    } else {
      this.magnetize();
      if (this.spec.waddle && this.body?.onGround) this.waddle(this.spec.waddle);
      if (this.body) moveBody(this, this.world.terrain, this.world);
      else {
        // Hanging items keep their place; a push (a pop on spawn) dies away.
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.8;
        this.vy *= 0.8;
      }
    }
    this.anim.update();
    this.checkCollect();
    if (this.life !== Infinity && --this.life <= 0) this.remove();
  }

  /** Steer toward the toss target; false when the toss is over. */
  private homeIn(): boolean {
    const p = this.tossTarget;
    this.tossLeft--;
    if (!p || !p.alive || p.removed || (p.state !== 'play' && p.state !== 'mounted')) {
      this.tossLeft = 0;
      return false;
    }
    const v: Entity = p.state === 'mounted' && p.vehicle ? p.vehicle : p;
    const tx = v.x;
    const ty = v.y - 12;
    const dx = tx - this.x;
    const dy = ty - (this.y - 6);
    const d = Math.hypot(dx, dy) || 1;
    const s = ITEM_RULES.tossSpeed;
    this.vx = (dx / d) * s;
    this.vy = (dy / d) * s;
    return true;
  }

  /** Drift toward the nearest player in range. */
  private magnetize(): void {
    const range = this.spec.magnet ?? TUNING.pickup.magnet;
    if (range <= 0) return;
    const p = this.world.nearestPlayer(this.x, this.y - 6);
    if (!p) return;
    const dx = p.x - this.x;
    const dy = p.y - 12 - (this.y - 6);
    if (dx * dx + dy * dy > range * range) return;
    const s = TUNING.pickup.magnetSpeed;
    this.vx = Math.sign(dx) * Math.min(Math.abs(dx), s);
  }

  /** Walk toward the nearest player along the floor; stop at gaps, hazards and walls. */
  private waddle(speed: number): void {
    const p = this.world.nearestPlayer(this.x, this.y - 6);
    if (!p) {
      this.vx = 0;
      return;
    }
    const dx = p.x - this.x;
    if (Math.abs(dx) < 2) {
      this.vx = 0;
      return;
    }
    const dir: 1 | -1 = dx < 0 ? -1 : 1;
    this.facing = dir;
    this.vx = safeStep(this.world, this.x, this.y, dir, 6) ? dir * speed : 0;
  }

  private checkCollect(): void {
    if (this.collected) return;
    const box = this.hitRect();
    const list = this.world.byTag('player');
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      if (!isPlayer(p) || !p.alive) continue;
      if (p.state === 'play') {
        if (overlaps(box, p.hitRect())) {
          this.collect(p);
          return;
        }
      } else if (p.state === 'mounted' && p.vehicle && overlaps(box, p.vehicle.hitRect())) {
        this.collect(p);
        return;
      }
    }
  }

  /** Apply the effect for this player (also usable from scripts). */
  collect(p: Player): boolean {
    if (this.collected) return false;
    const spec = this.spec;
    const v = p.state === 'mounted' ? (p.vehicle as Vehicle | null) : null;
    const res = v && spec.vehicleEffect ? spec.vehicleEffect(v, p, this) : spec.effect(p, this);
    if (res === false) return false;
    this.collected = true;
    if (spec.sfxPitch && spec.sfxPitch !== 1) {
      sfxOpts.pitch = spec.sfxPitch;
      this.world.audio.sfx(spec.sfx ?? 'item/pickup', sfxOpts);
    } else this.world.audio.sfx(spec.sfx ?? 'item/pickup');
    if (spec.voice) this.world.audio.voice(spec.voice);
    if (spec.score) awardScore(this.world, p.index, spec.score, this.x, this.y - 16);
    if (spec.message) hudOf(this.world).message(p.index, spec.message);
    if (spec.sparkle) this.world.particles.burst(SPARKLE, this.x, this.y - 6, 10, 0.4, 1.6);
    p.slot.stats.pickups++;
    this.world.events.emit('pickup', { player: p, slot: p.index, item: this });
    this.remove();
    return true;
  }

  override draw(r: Renderer): void {
    if (this.life !== Infinity && this.life < ITEM_RULES.blinkTicks && this.t % 6 < 3) return;
    const amp = this.spec.bob ?? ITEM_RULES.bobAmp;
    const resting = !this.body || this.body.onGround;
    const bob = amp > 0 && resting ? Math.round(Math.sin((this.t / ITEM_RULES.bobPeriod) * Math.PI * 2) * amp) - amp : 0;
    const hover = resting ? (this.spec.hover ?? 0) : 0;
    drawOpts.flipX = this.facing < 0;
    const id = this.anim.id || this.spec.sprite;
    r.sprite(id, this.anim.index, this.x, this.y + bob - hover, drawOpts);
  }
}

// ---------------------------------------------------------------------------------------------
// Walking helpers (pickups and hostages never walk into pits)
// ---------------------------------------------------------------------------------------------

const probe: Rect = { x: 0, y: 0, w: 0, h: 0 };

/**
 * Is it safe to walk one step from (x, y) in `dir`? True when there is floor 10 px ahead
 * (terrain or a dynamic solid) no deeper than `maxDrop` px below the feet and no higher than a
 * step, and no hazard there. Used by the waddling 1UP and by hostages.
 */
export function safeStep(world: World, x: number, y: number, dir: 1 | -1, maxDrop = 8, ahead = 10): boolean {
  const ax = x + dir * ahead;
  let floor = world.terrain.surfaceY(ax, y - 6, y + maxDrop);
  const solids = world.solids;
  for (let i = 0; i < solids.length; i++) {
    const s = solids[i];
    if (!s.enabled || ax < s.x || ax > s.x + s.w) continue;
    if (s.y >= y - 6 && s.y <= y + maxDrop && s.y < floor) floor = s.y;
  }
  if (!Number.isFinite(floor)) return false;
  probe.x = ax - 4;
  probe.y = Math.min(y, floor) - 8;
  probe.w = 8;
  probe.h = 8;
  return world.terrain.hazardAt(probe) === null;
}

// ---------------------------------------------------------------------------------------------
// Ready-made effects
// ---------------------------------------------------------------------------------------------

/** Give a weapon (same weapon again = more ammo). While driving, it waits in the slot for later. */
export function weaponEffect(weaponId: string, ammo?: number): PickupSpec['effect'] {
  return (p) => {
    p.giveWeapon(weaponId, ammo);
  };
}

/** +n bombs; while driving +n vehicle shells instead. Full bombs: points instead. */
export function bombsEffect(n = 10): PickupSpec['effect'] {
  return (p) => {
    const v = p.state === 'mounted' ? (p.vehicle as Vehicle | null) : null;
    if (v && typeof v.addShells === 'function') v.addShells(n);
    else if (p.slot.bombs >= TUNING.grenade.cap) p.addScore(TUNING.score.unusablePickup);
    else p.addBombs(n);
  };
}

/** Points only (food, treasure); the item's `score` field is usually enough. */
export function scoreEffect(points: number): PickupSpec['effect'] {
  return (p) => {
    p.addScore(points);
  };
}

/** Extra lives; with the lives already full (9 in reserve): 10,000 points instead (GDD §7.1). */
export function lifeEffect(n = 1, fullPoints = 10000): PickupSpec['effect'] {
  return (p) => {
    if (p.slot.livesFull) p.addScore(fullPoints);
    else p.addLife(n);
  };
}

/**
 * Repair the driven vehicle by `cells` (never above its own maximum). On foot or with full
 * cells: 1,000 points instead (GDD §7.1).
 */
export function repairEffect(cells = 1): PickupSpec['effect'] {
  return (p) => {
    const v = p.state === 'mounted' ? (p.vehicle as Vehicle | null) : null;
    if (v && typeof v.repair === 'function' && v.cells < v.maxCells) v.repair(cells);
    else p.addScore(TUNING.score.unusablePickup);
  };
}
