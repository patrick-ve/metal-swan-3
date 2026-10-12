/**
 * Shared visual effects (docs/ARCHITECTURE.md §5.12): one-shot sprite animations (`FxEntity`)
 * and helpers every content module uses — `explosion`, `muzzleFlash`, `impactPuff`, `hitSpark`,
 * `dust`, `splash`, `debris`, `smokeTrail`, `poof` — plus `blast()` (area damage).
 *
 * The comedy set of GDD §15.6 (sprites in content/fx/art.ts): `confetti`, `musicNotes`,
 * `steamPuff`, `snowPuff`, `iceShatter`, `tinFeathers`, `dizzyStars`, `tumble` (a flying shako,
 * a stick-on moustache …), `heliumCloud`, and two draw helpers for telegraphs: `drawShadow`
 * (a shadow that grows under a falling thing) and `drawAimLine` (a sniper's dotted line).
 *
 * All cosmetic randomness comes from `world.fxRng` (through the particle system), so effects
 * never change gameplay. FX sprites (`fx/…`) are anchored at their centre. While an fx sprite is
 * not registered yet, explosions and muzzle flashes draw a small procedural stand-in and the
 * other helpers show particles only (no magenta boxes in the middle of the action).
 * Everything is pooled (FxEntity, particles): no allocation per call after warm-up.
 */
import { Entity, hostile, type Damage, type DamageKind, type Team } from '../engine/entity';
import { TRANSPARENT, withAlpha, type Color } from '../engine/color';
import { distToRect } from '../engine/math';
import { PAL } from '../engine/palette';
import type { ParticlePreset } from '../engine/particles';
import { PixelBuffer } from '../engine/pixel';
import type { DrawOpts, Renderer } from '../engine/render';
import { Animator, frameCount, hasSprite, type PlayOpts } from '../engine/sprites';
import type { World } from '../engine/world';
import { acquire, release } from './pool';

// ---------------------------------------------------------------------------------------------
// FxEntity
// ---------------------------------------------------------------------------------------------

/** Draws an effect whose sprite is not registered. */
export type FxFallback = (r: Renderer, fx: FxEntity) => void;

export interface FxOpts {
  sprite: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  /** px/tick² (negative rises). */
  gravity?: number;
  /** Velocity multiplier per tick (1 = none). */
  drag?: number;
  flipX?: boolean;
  flipY?: boolean;
  /** Animation speed (default: the sprite's own). */
  ticksPerFrame?: number;
  /** Loop the animation for `life` ticks instead of playing it once. */
  loop?: boolean;
  /** Lifetime in ticks (default: one pass of the animation; 20 when the sprite is missing). */
  life?: number;
  /** Draw order (default 60 = fx). */
  z?: number;
  blend?: 'normal' | 'add';
  alpha?: number;
  /** Stick to an entity, keeping the current offset from its anchor. */
  follow?: Entity | null;
  /** Drawn instead of the sprite while its id is not registered. */
  fallback?: FxFallback | null;
  /** Direction / size hints for fallbacks. */
  angle?: number;
  scale?: number;
  /** Sideways sway in px (rising notes, falling leaves); 0 = none. */
  wobble?: number;
  /** Ticks per full sway (default 32). */
  wobbleTicks?: number;
  /** First frame of the animation (default 0). */
  frame?: number;
}

const fxDraw: DrawOpts = {};
const playOpts: PlayOpts = { restart: true };

/** A pooled one-shot (or timed looping) sprite animation. Create with `FxEntity.spawn`. */
export class FxEntity extends Entity {
  sprite = '';
  readonly anim = new Animator();
  gravity = 0;
  drag = 1;
  life = 20;
  loop = false;
  flipX = false;
  flipY = false;
  blend: 'normal' | 'add' = 'normal';
  alpha = 1;
  angle = 0;
  scale = 1;
  /** Ticks since spawn. */
  t = 0;
  follow: Entity | null = null;
  offX = 0;
  offY = 0;
  fallback: FxFallback | null = null;
  /** The sprite was registered when spawned. */
  hasArt = false;
  wobble = 0;
  wobbleTicks = 32;
  /** Current sway offset (already added to x). */
  private wobX = 0;

  constructor(world: World) {
    super(world);
    this.z = 60;
    this.hitbox = { x: -8, y: -8, w: 16, h: 16 };
    this.despawnMargin = 96;
  }

  static spawn(world: World, o: FxOpts): FxEntity {
    const fx = acquire(world, FxEntity);
    fx.init(o);
    return world.add(fx);
  }

  init(o: FxOpts): void {
    this.type = 'fx';
    this.sprite = o.sprite;
    this.x = this.prevX = o.x;
    this.y = this.prevY = o.y;
    this.vx = o.vx ?? 0;
    this.vy = o.vy ?? 0;
    this.gravity = o.gravity ?? 0;
    this.drag = o.drag ?? 1;
    this.flipX = o.flipX ?? false;
    this.flipY = o.flipY ?? false;
    this.loop = o.loop ?? false;
    this.z = o.z ?? 60;
    this.blend = o.blend ?? 'normal';
    this.alpha = o.alpha ?? 1;
    this.angle = o.angle ?? 0;
    this.scale = o.scale ?? 1;
    this.follow = o.follow ?? null;
    this.offX = this.follow ? o.x - this.follow.x : 0;
    this.offY = this.follow ? o.y - this.follow.y : 0;
    this.fallback = o.fallback ?? null;
    this.wobble = o.wobble ?? 0;
    this.wobbleTicks = Math.max(2, o.wobbleTicks ?? 32);
    this.wobX = 0;
    this.t = 0;
    this.hasArt = hasSprite(o.sprite);
    if (this.hasArt) {
      playOpts.loop = this.loop;
      playOpts.ticksPerFrame = o.ticksPerFrame;
      playOpts.frame = o.frame;
      this.anim.play(o.sprite, playOpts);
      playOpts.frame = undefined;
      this.life = o.life ?? (this.loop ? 60 : this.anim.length);
    } else {
      this.anim.id = '';
      this.life = o.life ?? 20;
    }
  }

  override update(): void {
    if (this.follow) {
      this.x = this.follow.x + this.offX;
      this.y = this.follow.y + this.offY;
    } else {
      this.vy += this.gravity;
      if (this.drag !== 1) {
        this.vx *= this.drag;
        this.vy *= this.drag;
      }
      this.x += this.vx;
      this.y += this.vy;
    }
    if (this.wobble !== 0) {
      const w = Math.sin(((this.t + 1) / this.wobbleTicks) * Math.PI * 2) * this.wobble;
      this.x += w - this.wobX;
      this.wobX = w;
    }
    if (this.hasArt) this.anim.update();
    this.t++;
    if (this.t >= this.life || (this.hasArt && !this.loop && this.anim.done)) this.remove();
  }

  override draw(r: Renderer): void {
    if (this.hasArt) {
      fxDraw.flipX = this.flipX;
      fxDraw.flipY = this.flipY;
      fxDraw.alpha = this.alpha;
      fxDraw.blend = this.blend;
      r.sprite(this.anim.id, this.anim.index, Math.round(this.x), Math.round(this.y), fxDraw);
    } else if (this.fallback) {
      this.fallback(r, this);
    }
  }

  /** 0..1 progress through the lifetime (handy for fallbacks). */
  get progress(): number {
    return this.life > 0 ? Math.min(1, this.t / this.life) : 1;
  }

  override onRemove(): void {
    this.follow = null;
    release(this);
  }
}

// ---------------------------------------------------------------------------------------------
// Particle presets (palette colours)
// ---------------------------------------------------------------------------------------------

export const FX_SPARK: ParticlePreset = {
  kind: 'rect',
  w: 1,
  h: 1,
  life: [6, 14],
  gravity: 0.08,
  drag: 0.9,
  colors: [PAL.fire[6], PAL.gold[3], PAL.fire[3], PAL.fire[1]],
  additive: true,
};

export const FX_FLAME: ParticlePreset = {
  kind: 'rect',
  w: 3,
  h: 3,
  life: [8, 16],
  gravity: -0.04,
  drag: 0.86,
  colors: [PAL.fire[6], PAL.fire[5], PAL.fire[3], PAL.fire[1]],
  additive: true,
  fadeFrom: 0.5,
};

export const FX_SMOKE: ParticlePreset = {
  kind: 'rect',
  w: 4,
  h: 4,
  life: [30, 54],
  gravity: -0.018,
  drag: 0.93,
  colors: [withAlpha(PAL.stone[2], 0xd0), withAlpha(PAL.stone[1], 0xb0), withAlpha(PAL.stone[0], 0x90)],
  fadeFrom: 0.4,
};

export const FX_TRAIL: ParticlePreset = {
  kind: 'rect',
  w: 3,
  h: 3,
  life: [14, 24],
  gravity: -0.01,
  drag: 0.9,
  colors: [withAlpha(PAL.snow[2], 0xc0), withAlpha(PAL.stone[3], 0xa0), withAlpha(PAL.stone[2], 0x80)],
  fadeFrom: 0.3,
};

export const FX_EMBER: ParticlePreset = {
  kind: 'pixel',
  life: [20, 40],
  gravity: -0.03,
  drag: 0.97,
  colors: [PAL.gold[3], PAL.fire[4], PAL.fire[2], PAL.red[0]],
  additive: true,
  fadeFrom: 0.6,
};

export const FX_DUST: ParticlePreset = {
  kind: 'rect',
  w: 2,
  h: 2,
  life: [12, 24],
  gravity: -0.01,
  drag: 0.88,
  colors: [withAlpha(PAL.sand[3], 0xc0), withAlpha(PAL.sand[2], 0xa0), withAlpha(PAL.sand[1], 0x80)],
  fadeFrom: 0.3,
};

export const FX_WATER: ParticlePreset = {
  kind: 'rect',
  w: 2,
  h: 2,
  life: [16, 30],
  gravity: 0.16,
  colors: [PAL.snow[3], PAL.sky[3], PAL.sky[2]],
  fadeFrom: 0.6,
  ground: 'die',
};

/** Snow kicked up (snow hits, ski stops, the avalanche). */
export const FX_SNOW: ParticlePreset = {
  kind: 'rect',
  w: 2,
  h: 2,
  life: [14, 28],
  gravity: 0.12,
  drag: 0.94,
  colors: [PAL.snow[3], PAL.snow[2], PAL.snow[1]],
  fadeFrom: 0.6,
  ground: 'die',
};

/** Wisps of steam (vents, kettles, a hissing Swan): white, rising, fading. */
export const FX_STEAM: ParticlePreset = {
  kind: 'rect',
  w: 3,
  h: 3,
  life: [16, 30],
  gravity: -0.03,
  drag: 0.9,
  colors: [withAlpha(PAL.snow[3], 0xd0), withAlpha(PAL.snow[2], 0xa0), withAlpha(PAL.snow[1], 0x70)],
  fadeFrom: 0.3,
};

/** Cosmetic shotgun pellets: hot dots that fly out and fade (the cone does the damage). */
export const FX_PELLET: ParticlePreset = {
  kind: 'rect',
  w: 2,
  h: 2,
  life: [9, 13],
  drag: 0.97,
  colors: [PAL.fire[6], PAL.gold[3], PAL.fire[4], PAL.fire[3]],
  fadeFrom: 0.55,
  additive: true,
  ground: 'die',
};

/** Confetti bits (helium pops, kazoo drones, parades): random colours, slow flutter. */
export const FX_CONFETTI: ParticlePreset = {
  kind: 'sprite',
  sprite: 'fx/confetti-bit',
  randomFrames: 12,
  life: [40, 70],
  gravity: 0.05,
  drag: 0.93,
  fadeFrom: 0.75,
  ground: 'stop',
};

/** Fallback confetti while the sprite is missing: plain gold and red specks. */
const FX_CONFETTI_PLAIN: ParticlePreset = {
  kind: 'rect',
  w: 2,
  h: 1,
  life: [40, 70],
  gravity: 0.05,
  drag: 0.93,
  colors: [PAL.gold[3], PAL.red[3], PAL.sky[3], PAL.pink[2]],
  fadeFrom: 0.75,
};

/** Ice cubes of a shattered frozen enemy: tumbling, bouncing once. */
export const FX_ICE: ParticlePreset = {
  kind: 'sprite',
  sprite: 'fx/ice-cubes',
  randomFrames: 4,
  ticksPerFrame: 0,
  life: [36, 56],
  gravity: 0.2,
  fadeFrom: 0.7,
  ground: 'bounce',
  bounce: 0.4,
  friction: 0.6,
  randomFlip: true,
};

/** The Swan's stamped tin feather plates: they tumble rigidly (4 turning frames). */
export const FX_FEATHER: ParticlePreset = {
  kind: 'sprite',
  sprite: 'fx/tin-feather',
  randomFrames: 4,
  ticksPerFrame: 4,
  life: [40, 64],
  gravity: 0.06,
  drag: 0.95,
  fadeFrom: 0.7,
  ground: 'stop',
  randomFlip: true,
};

export type DebrisKind = 'metal' | 'wood' | 'rock' | 'dirt' | 'glass' | 'plant' | 'snow' | 'cloth';

const DEBRIS_COLORS: Readonly<Record<DebrisKind, readonly Color[]>> = {
  metal: [PAL.steel[1], PAL.steel[2], PAL.steel[3]],
  wood: [PAL.brown[1], PAL.brown[2], PAL.brown[3]],
  rock: [PAL.stone[0], PAL.stone[1], PAL.stone[2]],
  dirt: [PAL.brown[0], PAL.brown[1], PAL.sand[1]],
  glass: [PAL.sky[2], PAL.sky[3], PAL.snow[2]],
  plant: [PAL.green[1], PAL.green[2], PAL.green[3]],
  snow: [PAL.snow[1], PAL.snow[2], PAL.snow[3]],
  cloth: [PAL.olive[1], PAL.olive[2], PAL.sand[2]],
};

const DEBRIS_PRESET: ParticlePreset = {
  kind: 'rect',
  w: 2,
  h: 2,
  life: [40, 70],
  gravity: 0.2,
  colors: [PAL.stone[1]],
  fadeFrom: 0.75,
  ground: 'bounce',
  bounce: 0.35,
  friction: 0.6,
};

/** Sprite debris (random frames of `fx/debris-<kind>`), used when that sprite exists. */
const debrisSpritePresets = new Map<string, ParticlePreset>();

function debrisSpritePreset(kind: string): ParticlePreset {
  let p = debrisSpritePresets.get(kind);
  if (!p) {
    p = { ...DEBRIS_PRESET, kind: 'sprite', sprite: `fx/debris-${kind}`, randomFrames: 4, randomFlip: true };
    debrisSpritePresets.set(kind, p);
  }
  return p;
}

// ---------------------------------------------------------------------------------------------
// Explosions and area damage
// ---------------------------------------------------------------------------------------------

export type ExplosionSize = 's' | 'm' | 'l' | 'xl';

export interface ExplosionSizeInfo {
  /** Damage radius (px) when the explosion hurts. */
  radius: number;
  shake: number;
  shakeTicks: number;
  sparks: number;
  smoke: number;
  embers: number;
  debris: number;
}

/** Shake per size follows GDD §4.12: explosions 2 px / 8 ticks, big ones 4 px / 20 ticks. */
export const EXPLOSION_SIZES: Readonly<Record<ExplosionSize, ExplosionSizeInfo>> = {
  s: { radius: 12, shake: 1, shakeTicks: 6, sparks: 6, smoke: 3, embers: 3, debris: 0 },
  m: { radius: 24, shake: 2, shakeTicks: 8, sparks: 10, smoke: 6, embers: 6, debris: 4 },
  l: { radius: 40, shake: 4, shakeTicks: 20, sparks: 16, smoke: 10, embers: 10, debris: 8 },
  xl: { radius: 64, shake: 6, shakeTicks: 30, sparks: 24, smoke: 16, embers: 16, debris: 14 },
};

const EXPLOSION_SPRITES: Readonly<Record<ExplosionSize, string>> = {
  s: 'fx/explosion-s',
  m: 'fx/explosion-m',
  l: 'fx/explosion-l',
  xl: 'fx/explosion-xl',
};
const EXPLOSION_SOUNDS: Readonly<Record<ExplosionSize, string>> = {
  s: 'explosion/s',
  m: 'explosion/m',
  l: 'explosion/l',
  xl: 'explosion/xl',
};

export interface ExplosionOpts {
  /** Damage to hostile shootables in the radius (0 / undefined = harmless). */
  damage?: number;
  /** Team of the explosion (default 'player'): it hurts the other side only. */
  team?: Team;
  /** Player slot credited for kills. */
  owner?: number;
  source?: Entity;
  kind?: DamageKind;
  /** Override the size's damage radius. */
  radius?: number;
  /** Only hurt soft targets (infantry): the reference grenade splash rule. */
  softOnly?: boolean;
  /** Damage at the edge is reduced by this fraction (default 0.5). */
  falloff?: number;
  /** Do not damage this entity (e.g. the target already hit directly). */
  exclude?: Entity | null;
  /** No sound. */
  silent?: boolean;
  /** Override the shake amount (0 = none). */
  shake?: number;
  /** Debris kind thrown up (default 'dirt' for m and bigger; null = none). */
  debris?: DebrisKind | null;
  /** Weapon id and tags carried by the blast's Damage. */
  weapon?: string;
  tags?: readonly string[];
  /**
   * Draw the fireball this many px above (x, y) (blasts on the ground rise from it instead of
   * being half buried). Default 0; `explosion()` uses ~0.6 × radius when (x, y) sits on a floor.
   */
  lift?: number;
}

/** Entities that react to blasts without being shootable (hostages): duck-typed. */
interface BlastListener {
  onBlast?(x: number, y: number, r: number, owner: number): void;
}

/**
 * Area damage: every alive hostile 'shootable' entity whose hurtbox is within `r` of (x, y) is
 * hit once (its closest part). Returns the number of entities hit. Neutral entities tagged
 * 'hostage' get `onBlast()` when a player-team blast reaches them (frees them).
 */
export interface BlastOpts {
  kind?: DamageKind;
  owner?: number;
  source?: Entity;
  softOnly?: boolean;
  /** Damage at the edge is reduced by this fraction (default 0.5; 0 = full damage everywhere). */
  falloff?: number;
  exclude?: Entity | null;
  /** Weapon id and tags carried by the Damage (see engine Damage.weapon / tags). */
  weapon?: string;
  tags?: readonly string[];
}

export function blast(world: World, x: number, y: number, r: number, damage: number, team: Team, o: BlastOpts = {}): number {
  let hits = 0;
  if (damage > 0) {
    // A copy of the target list: a hit may change tags (a destroyed vehicle drops 'shootable').
    const targets = world.snapshotTag('shootable');
    const falloff = o.falloff ?? 0.5;
    try {
      for (let i = 0; i < targets.length; i++) {
        const t = targets[i];
        if (!t.alive || t === o.exclude || !hostile(team, t.team)) continue;
        if (o.softOnly && !t.hasTag('soft')) continue;
        const boxes = t.hurtboxes();
        let part = -1;
        let best = Infinity;
        for (let k = 0; k < boxes.length; k++) {
          const d = distToRect(x, y, boxes[k]);
          if (d < r && d < best) {
            best = d;
            part = k;
          }
        }
        if (part < 0) continue;
        const b = boxes[part];
        const amount = damage * (1 - falloff * Math.min(1, best / r));
        const d: Damage = {
          amount,
          kind: o.kind ?? 'explosion',
          dirX: Math.sign(b.x + b.w / 2 - x) || 1,
          source: o.source,
          owner: o.owner,
          weapon: o.weapon,
          tags: o.tags,
        };
        if (world.damage(t, d, part)) hits++;
      }
    } finally {
      world.releaseSnapshot();
    }
  }
  if (team === 'player' || team === 'neutral') {
    const hostages = world.byTag('hostage');
    for (let i = 0; i < hostages.length; i++) {
      const h = hostages[i] as Entity & BlastListener;
      if (!h.alive || !h.onBlast) continue;
      const box = h.hitRect();
      if (distToRect(x, y, box) < r) h.onBlast(x, y, r, o.owner ?? -1);
    }
  }
  return hits;
}

/**
 * An explosion: animated `fx/explosion-<size>` + sparks, smoke, embers and debris + camera
 * shake + `explosion/<size>` sound + optional area damage. Returns the fx entity.
 */
export function explosion(world: World, x: number, y: number, size: ExplosionSize = 'm', o: ExplosionOpts = {}): FxEntity {
  const info = EXPLOSION_SIZES[size] ?? EXPLOSION_SIZES.m;
  const sprite = EXPLOSION_SPRITES[size] ?? EXPLOSION_SPRITES.m;
  // A blast on the ground rises from it: the fireball, smoke and embers are drawn above the
  // surface (the damage circle stays centred on (x, y)).
  const lift = o.lift ?? (onFloor(world, x, y) ? Math.round(info.radius * 0.55) : 0);
  const vy = y - lift;
  const fo = oneShot(sprite, x, vy);
  fo.fallback = burstFallback;
  fo.scale = info.radius;
  fo.life = hasSprite(sprite) ? undefined : BURST_FRAMES * 3;
  const fx = FxEntity.spawn(world, fo);
  const p = world.particles;
  p.burst(FX_SPARK, x, vy, info.sparks, 1, 3.4);
  p.burst(FX_FLAME, x, vy, Math.ceil(info.sparks / 2), 0.4, 1.6);
  for (let i = 0; i < info.smoke; i++) {
    const a = (i / Math.max(1, info.smoke)) * Math.PI * 2;
    p.emit(FX_SMOKE, x + Math.cos(a) * info.radius * 0.3, vy + Math.sin(a) * info.radius * 0.3, Math.cos(a) * 0.4, -0.3);
  }
  p.burst(FX_EMBER, x, vy, info.embers, 0.3, 1.8, -Math.PI / 2, 2.4);
  const debrisKind = o.debris === undefined ? (size === 's' ? null : 'dirt') : o.debris;
  if (debrisKind && info.debris > 0) debris(world, x, y - 2, debrisKind, info.debris);
  const shake = o.shake ?? info.shake;
  if (shake > 0) world.camera.shake(shake, info.shakeTicks);
  if (!o.silent) world.audio.sfx(EXPLOSION_SOUNDS[size] ?? EXPLOSION_SOUNDS.m);
  const team = o.team ?? 'player';
  const r = o.radius ?? info.radius;
  blast(world, x, y, r, o.damage ?? 0, team, {
    kind: o.kind ?? 'explosion',
    owner: o.owner,
    source: o.source ?? fx,
    softOnly: o.softOnly,
    falloff: o.falloff,
    exclude: o.exclude,
    weapon: o.weapon,
    tags: o.tags,
  });
  world.events.emit('explosion', { x, y, r, team, owner: o.owner ?? -1, size });
  return fx;
}

/** Is (x, y) on (or within a few px above) ground, a platform or a solid top? */
function onFloor(world: World, x: number, y: number): boolean {
  return Number.isFinite(world.terrain.surfaceY(x, y - 2, y + 6));
}

// ---------------------------------------------------------------------------------------------
// Small effects
// ---------------------------------------------------------------------------------------------

export interface MuzzleOpts {
  /** 'heavy' uses `fx/muzzle-heavy…` when registered (bigger flash). */
  kind?: 'pistol' | 'heavy';
  /** Stick to the shooter for the flash's short life. */
  follow?: Entity | null;
  /**
   * Weapon id: use that weapon's own flash `fx/muzzle-<weapon>[-up|-diag]` (GDD §15.6) when it is
   * registered, else the `kind` flash.
   */
  weapon?: string;
}

/** The three flash ids of one family ('' = not registered). Built once per family. */
interface MuzzleSet {
  fwd: string;
  up: string;
  diag: string;
}

const muzzleSets = new Map<string, MuzzleSet>();

/** Flash ids for a family base such as 'fx/muzzle-shotgun' (looked up once, then cached). */
function muzzleSet(base: string): MuzzleSet {
  let s = muzzleSets.get(base);
  if (!s) {
    s = { fwd: base, up: `${base}-up`, diag: `${base}-diag` };
    muzzleSets.set(base, s);
  }
  return s;
}

/** Best registered flash of a family for a direction ('' when the family has none). */
function pickMuzzle(s: MuzzleSet, diag: boolean, vertical: boolean): string {
  if (diag && hasSprite(s.diag)) return s.diag;
  if (vertical && hasSprite(s.up)) return s.up;
  return hasSprite(s.fwd) && !diag && !vertical ? s.fwd : '';
}

/** Reused by the small helpers below (FxEntity.init copies what it needs). */
const fxOpts: FxOpts = { sprite: '', x: 0, y: 0 };

/** Reset the shared options to a plain one-shot at (x, y). */
function oneShot(sprite: string, x: number, y: number): FxOpts {
  const o = fxOpts;
  o.sprite = sprite;
  o.x = x;
  o.y = y;
  o.vx = o.vy = o.gravity = undefined;
  o.drag = o.ticksPerFrame = o.life = o.z = o.alpha = o.angle = o.scale = undefined;
  o.wobble = o.wobbleTicks = o.frame = undefined;
  o.flipX = o.flipY = o.loop = undefined;
  o.blend = undefined;
  o.follow = null;
  o.fallback = null;
  return o;
}

const PISTOL_FLASH = muzzleSet('fx/muzzle');
const HEAVY_FLASH = muzzleSet('fx/muzzle-heavy');

/**
 * Muzzle flash at the gun tip, pointing along the shot. Sprites: `fx/muzzle` (points right,
 * flipped for left), `fx/muzzle-up` (points up, flipped for down) and `fx/muzzle-diag` (points
 * up-right at 45°, flipped for the other diagonals); `fx/muzzle-heavy[-up|-diag]` for heavy
 * weapons, `fx/muzzle-<weapon>[-up|-diag]` with `weapon`. Angles between 22.5° and 67.5° from the
 * horizontal use the diagonal flash.
 */
export function muzzleFlash(world: World, x: number, y: number, angle: number, m: MuzzleOpts = {}): FxEntity {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const ady = Math.abs(dy);
  const heavy = m.kind === 'heavy';
  const inDiag = ady > 0.38 && ady < 0.93;
  const own = m.weapon ? muzzleSet(`fx/muzzle-${m.weapon}`) : null;
  const generic = heavy ? HEAVY_FLASH : PISTOL_FLASH;
  // The diagonal flash only when some family draws one; else the nearest straight flash.
  const diag = inDiag && ((own !== null && hasSprite(own.diag)) || hasSprite(generic.diag) || hasSprite(PISTOL_FLASH.diag));
  const vertical = !diag && ady > 0.75;
  const sprite =
    (own && pickMuzzle(own, diag, vertical)) ||
    pickMuzzle(generic, diag, vertical) ||
    (diag ? PISTOL_FLASH.diag : vertical ? PISTOL_FLASH.up : PISTOL_FLASH.fwd);
  const o = oneShot(sprite, x, y);
  o.flipX = !vertical && dx < 0;
  o.flipY = (vertical || diag) && dy > 0;
  o.follow = m.follow ?? null;
  o.blend = 'add';
  o.angle = angle;
  o.scale = heavy ? 1.5 : 1;
  o.life = hasSprite(sprite) ? undefined : 3;
  o.fallback = muzzleFallback;
  const fx = FxEntity.spawn(world, o);
  o.follow = null;
  return fx;
}

/** A bullet hit the ground or a wall: `fx/impact` + a few sparks and dust. */
export function impactPuff(world: World, x: number, y: number, nx = 0, ny = -1): void {
  if (hasSprite('fx/impact')) FxEntity.spawn(world, oneShot('fx/impact', x, y));
  const a = Math.atan2(ny, nx);
  world.particles.burst(FX_SPARK, x, y, 3, 0.6, 2, a, 1.6);
  world.particles.burst(FX_DUST, x, y, 2, 0.2, 0.7, a, 1.2);
}

/** A shot hit an enemy: `fx/hit` + sparks flying back toward the shooter. */
export function hitSpark(world: World, x: number, y: number, dirX: number): void {
  if (hasSprite('fx/hit')) {
    const o = oneShot('fx/hit', x, y);
    o.flipX = dirX < 0;
    o.blend = 'add';
    FxEntity.spawn(world, o);
  }
  world.particles.burst(FX_SPARK, x, y, 4, 0.8, 2.4, dirX >= 0 ? Math.PI : 0, 1.6);
}

/** Dust at the feet (landing, sliding, heavy steps). */
export function dust(world: World, x: number, y: number, count = 4): void {
  if (hasSprite('fx/dust')) FxEntity.spawn(world, oneShot('fx/dust', x, y - 3));
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    world.particles.emit(FX_DUST, x + side * (1 + (i >> 1) * 2), y - 1, side * (0.4 + i * 0.15), -0.3);
  }
}

/** Water splash at the surface. */
export function splash(world: World, x: number, y: number, count = 10): void {
  if (hasSprite('fx/splash')) FxEntity.spawn(world, oneShot('fx/splash', x, y - 6));
  world.particles.burst(FX_WATER, x, y - 1, count, 0.8, 2.8, -Math.PI / 2, 1.4);
}

/** Chunks thrown up that bounce on the ground; sprite chunks when `fx/debris-<kind>` exists. */
export function debris(world: World, x: number, y: number, kind: DebrisKind = 'dirt', count = 8): void {
  if (hasSprite(`fx/debris-${kind}`)) {
    world.particles.burst(debrisSpritePreset(kind), x, y, count, 1, 3.6, -Math.PI / 2, 2.2);
  } else {
    world.particles.debris(x, y, count, DEBRIS_COLORS[kind] ?? DEBRIS_COLORS.dirt);
  }
}

/** A small cartoon POOF (an erased shot, a vanishing corpse): `fx/poof` or a smoke burst. */
export function poof(world: World, x: number, y: number): void {
  if (hasSprite('fx/poof')) FxEntity.spawn(world, oneShot('fx/poof', x, y));
  world.particles.burst(FX_TRAIL, x, y, 5, 0.3, 1.1);
}

/** One puff of a smoke trail (call every tick or two from rockets, burning wrecks …). */
export function smokeTrail(world: World, x: number, y: number, dark = false): void {
  world.particles.emit(dark ? FX_SMOKE : FX_TRAIL, x, y, 0, -0.1);
}

// ---------------------------------------------------------------------------------------------
// The comedy set (GDD §15.6): confetti, notes, steam, snow, ice, feathers, stars, flying props
// ---------------------------------------------------------------------------------------------

/** A confetti pop: `fx/confetti` burst + fluttering bits (helium pops, kazoo drones, parades). */
export function confetti(world: World, x: number, y: number, count = 16, power = 2.4): void {
  if (hasSprite('fx/confetti')) FxEntity.spawn(world, oneShot('fx/confetti', x, y));
  const preset = hasSprite('fx/confetti-bit') ? FX_CONFETTI : FX_CONFETTI_PLAIN;
  world.particles.burst(preset, x, y, count, power * 0.35, power, -Math.PI / 2, Math.PI * 1.6);
}

/**
 * Music notes that float up and sway (`fx/music-note`): a singing knife kill, a laser kill
 * dissolving, the tuba. `count` notes start `spread` px apart around (x, y).
 */
export function musicNotes(world: World, x: number, y: number, count = 1, spread = 8, life = 50): void {
  if (!hasSprite('fx/music-note')) {
    world.particles.burst(FX_EMBER, x, y, count * 2, 0.2, 0.8, -Math.PI / 2, 1);
    return;
  }
  const frames = frameCount('fx/music-note');
  for (let i = 0; i < count; i++) {
    const off = count > 1 ? (i / (count - 1) - 0.5) * spread * 2 : 0;
    const o = oneShot('fx/music-note', x + off, y - (i % 2) * 4);
    o.vy = -0.45 - (i % 3) * 0.12;
    o.loop = true;
    o.life = life + i * 4;
    o.wobble = 2;
    o.wobbleTicks = 28 + i * 3;
    o.frame = i % frames;
    o.z = 61;
    FxEntity.spawn(world, o);
  }
}

/** A white steam puff rising from (x, y) (`fx/steam-puff` + wisps). Returns the fx (or null). */
export function steamPuff(world: World, x: number, y: number, vx = 0, vy = -0.35): FxEntity | null {
  world.particles.burst(FX_STEAM, x, y, 2, 0.2, 0.6, -Math.PI / 2 + Math.atan2(vx, 1), 1.2);
  if (!hasSprite('fx/steam-puff')) return null;
  const o = oneShot('fx/steam-puff', x, y);
  o.vx = vx;
  o.vy = vy;
  o.drag = 0.97;
  return FxEntity.spawn(world, o);
}

/** Snow thrown up (`fx/snow-puff` + flakes): snow hits, ski stops, the avalanche's spray. */
export function snowPuff(world: World, x: number, y: number, count = 6): void {
  if (hasSprite('fx/snow-puff')) FxEntity.spawn(world, oneShot('fx/snow-puff', x, y - 4));
  world.particles.burst(FX_SNOW, x, y - 2, count, 0.8, 2.4, -Math.PI / 2, 2.2);
}

/** A frozen enemy shatters into tumbling ice cubes (`fx/ice-cubes`). */
export function iceShatter(world: World, x: number, y: number, count = 8): void {
  if (hasSprite('fx/ice-cubes')) world.particles.burst(FX_ICE, x, y, count, 1, 3.2, -Math.PI / 2, 2.4);
  else world.particles.debris(x, y, count, DEBRIS_COLORS.glass);
  world.particles.burst(FX_SNOW, x, y, 4, 0.5, 1.6, -Math.PI / 2, 2.4);
}

/** Stamped tin feather plates of the Swan (`fx/tin-feather`): hits, stomps, the migration. */
export function tinFeathers(world: World, x: number, y: number, count = 3, dirX = 0): void {
  if (!hasSprite('fx/tin-feather')) {
    world.particles.debris(x, y, count, DEBRIS_COLORS.snow);
    return;
  }
  const a = dirX > 0 ? -Math.PI / 4 : dirX < 0 ? (-Math.PI * 3) / 4 : -Math.PI / 2;
  world.particles.burst(FX_FEATHER, x, y, count, 0.6, 2, a, 1.6);
}

/** Dizzy stars circling over an entity's head (`fx/stars-dizzy`), `dy` px above its anchor. */
export function dizzyStars(world: World, target: Entity, dy = -40, ticks = 60): FxEntity {
  const sprite = hasSprite('fx/stars-dizzy') ? 'fx/stars-dizzy' : 'fx/stun-stars';
  const o = oneShot(sprite, target.x, target.y + dy);
  o.follow = target;
  o.loop = true;
  o.life = ticks;
  o.z = 61;
  const fx = FxEntity.spawn(world, o);
  o.follow = null;
  return fx;
}

export interface TumbleOpts {
  gravity?: number;
  life?: number;
  /** Ticks per frame of the tumble (default: the sprite's own). */
  ticksPerFrame?: number;
  z?: number;
  flipX?: boolean;
}

/**
 * A prop that flies off and tumbles under gravity (a flying shako, a stick-on moustache, a
 * dropped baton): plays its strip in a loop for `life` ticks. Returns the fx.
 */
export function tumble(world: World, sprite: string, x: number, y: number, vx: number, vy: number, t: TumbleOpts = {}): FxEntity {
  const o = oneShot(sprite, x, y);
  o.vx = vx;
  o.vy = vy;
  o.gravity = t.gravity ?? 0.14;
  o.loop = true;
  o.life = t.life ?? 60;
  o.ticksPerFrame = t.ticksPerFrame;
  o.z = t.z;
  o.flipX = t.flipX;
  return FxEntity.spawn(world, o);
}

/**
 * The pastel helium cloud of a burst `helium-tank` (GDD §4.13: 48×48, 120 ticks): a churning
 * loop drawn slightly see-through. The prop decides who breathes it.
 */
export function heliumCloud(world: World, x: number, y: number, ticks = 120): FxEntity {
  const o = oneShot('fx/helium-cloud', x, y);
  o.loop = true;
  o.life = ticks;
  o.alpha = 0.85;
  o.z = 62;
  o.fallback = heliumFallback;
  return FxEntity.spawn(world, o);
}

const shadowOpts: DrawOpts = { alpha: 0.45 };

/**
 * Draw a ground shadow `w` px wide centred on (x, y) (`fx/shadow` has one frame per width:
 * 8, 12 … 48). Telegraphs for falling things: grow `w` as the drop comes closer.
 */
export function drawShadow(r: Renderer, x: number, y: number, w: number, alpha = 0.45): void {
  const n = hasSprite('fx/shadow') ? frameCount('fx/shadow') : 0;
  shadowOpts.alpha = alpha;
  if (n > 0) {
    const i = Math.max(0, Math.min(n - 1, Math.round((w - 8) / 4)));
    r.sprite('fx/shadow', i, Math.round(x), Math.round(y), shadowOpts);
    return;
  }
  const h = Math.max(2, Math.round(w / 4));
  r.rect(Math.round(x - w / 2), Math.round(y - h / 2), Math.round(w), h, PAL.ink[0], shadowOpts);
}

const aimOpts: DrawOpts = {};

/**
 * A sniper's aim line (GDD §9.1 `piccolo`): crimson dots on every other pixel from (x0, y0) to
 * (x1, y1); `locked` draws it solid (the shot comes in 12 ticks). `phase` (e.g. world.tick)
 * makes the dots crawl toward the target. World space; no allocation.
 */
export function drawAimLine(r: Renderer, x0: number, y0: number, x1: number, y1: number, locked = false, phase = 0, color: Color = PAL.red[3]): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const n = Math.max(Math.abs(dx), Math.abs(dy));
  if (n < 1) return;
  aimOpts.alpha = 1;
  if (locked) {
    r.line(Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), color, aimOpts);
    return;
  }
  const sx = dx / n;
  const sy = dy / n;
  for (let i = (phase & 1) === 0 ? 0 : 1; i <= n; i += 2) {
    r.rect(Math.round(x0 + sx * i), Math.round(y0 + sy * i), 1, 1, color, aimOpts);
  }
}

// ---------------------------------------------------------------------------------------------
// Procedural stand-ins (used only while fx sprites are missing)
// ---------------------------------------------------------------------------------------------

const BURST_FRAMES = 8;
const burstCache = new Map<number, PixelBuffer[]>();

/** Fireball → smoke ring frames for a radius (generated once per radius). */
function burstFrames(radius: number): PixelBuffer[] {
  const key = Math.max(4, Math.round(radius));
  let frames = burstCache.get(key);
  if (frames) return frames;
  frames = [];
  const size = key * 2 + 3;
  const c = size >> 1;
  for (let i = 0; i < BURST_FRAMES; i++) {
    const t = i / (BURST_FRAMES - 1);
    const b = new PixelBuffer(size, size);
    const rr = Math.max(2, Math.round(key * (0.45 + 0.55 * Math.min(1, t * 2))));
    if (t < 0.6) {
      b.circle(c, c, rr, PAL.fire[1]);
      b.circle(c, c - 1, Math.round(rr * 0.8), PAL.fire[3]);
      b.circle(c, c - 1, Math.round(rr * 0.55), PAL.fire[5]);
      if (t < 0.3) b.circle(c, c - 1, Math.round(rr * 0.3), PAL.fire[6]);
    } else {
      b.circle(c, c, rr, PAL.stone[1]);
      b.circle(c, c - 1, Math.round(rr * 0.6), PAL.stone[2]);
      b.dither(0, 0, size, size, TRANSPARENT, (t - 0.55) / 0.45, { only: 'opaque' });
    }
    frames.push(b);
  }
  burstCache.set(key, frames);
  return frames;
}

const burstFallback: FxFallback = (r, fx) => {
  const frames = burstFrames(fx.scale);
  const f = frames[Math.min(frames.length - 1, Math.floor(fx.progress * frames.length))];
  r.image(f, Math.round(fx.x) - (f.w >> 1), Math.round(fx.y) - (f.h >> 1));
};

const helOpts: DrawOpts = { alpha: 0.6 };

/** A pink blob while `fx/helium-cloud` is missing. */
const heliumFallback: FxFallback = (r, fx) => {
  const s = 18 + ((fx.t >> 3) & 1);
  r.rect(Math.round(fx.x) - s, Math.round(fx.y) - s + 4, s * 2, s * 2 - 8, PAL.pink[2], helOpts);
};

const addOpts: DrawOpts = { blend: 'add', alpha: 1 };

const muzzleFallback: FxFallback = (r, fx) => {
  const dx = Math.cos(fx.angle);
  const dy = Math.sin(fx.angle);
  const s = fx.scale;
  const x = Math.round(fx.x);
  const y = Math.round(fx.y);
  addOpts.alpha = 1 - fx.progress * 0.5;
  const core = Math.round(2 * s);
  r.rect(x - core, y - core, core * 2 + 1, core * 2 + 1, PAL.gold[3], addOpts);
  r.rect(Math.round(x + dx * 4 * s) - 1, Math.round(y + dy * 4 * s) - 1, 3, 3, PAL.fire[6], addOpts);
  r.rect(Math.round(x + dx * 7 * s), Math.round(y + dy * 7 * s), 2, 2, PAL.fire[4], addOpts);
};
