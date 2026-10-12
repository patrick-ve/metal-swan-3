/**
 * Content category "infantry": enemy foot soldiers (docs/GAME_DESIGN.md §9.0, §9.1).
 * Registers at import time: `rifleman` (the Brass Private).
 *
 * `rifleman` — a lively arcade soldier:
 *   idle / patrol / comedy gag → notices a player (double-take, alert hop, "!", sound)
 *   → keeps 80–160 px away, hides behind crates, crouches at random → shoots slow chest-high
 *   bullets after a clear 18-tick telegraph (muzzle glint), lobs grenades at medium range, swings
 *   the rifle butt when a player is right on top of him, backs off or panics up close, panics
 *   when a player grenade lands near him. Deaths by damage kind (shot, blast, burn, knife swoon).
 *
 * Fairness (GDD §4.11): telegraphs ≥ 18 ticks, attacks only with the muzzle inside the view,
 * attack tokens cap how many enemies attack at once (3 / 4 / 6 by difficulty), gags are free time.
 * Squad feel: every timer and choice comes from `world.rng`, so 3–6 soldiers never act in
 * lockstep, and runs stay reproducible.
 *
 * Rifleman spawn params: `entry` (see below; ctx.enter's `enter: side` means `run`, `enter: 'top'`
 * means `drop`), `gag` (true / a gag name / false; default: 40 % of soldiers placed in the
 * level), `patrol` (px), `range` (preferred distance), `grenades` (bool), `crouch` (start
 * crouched), `outfit`, `column`, `march`, `carrier`, plus the Enemy params `hp`, `drop`, `facing`,
 * `tag`.
 *
 * ┌─ SHARED SOLDIER PIECES (for every infantry type: rhythm/, winds/) ──────────────────────────
 * │ Gameplay — import from this file:
 * │ `abstract class Soldier extends Enemy` — the shared soldier rules of GDD §9.0 / §4.11. Subclass
 * │   it: `super(world, x, y, params, { art: 'enemy/<id>', hp, w, h, gags: ['polish', …], … })`
 * │   (`SoldierOpts`: Enemy opts + `gags`, `sideEntry`, `walk`, `run`, `crouchH`, `hatY`,
 * │   `gagChance`, `combatMode`) and implement `fight()` — the AI after the alert. The base does:
 * │   · outfits: `params.outfit` (parade | deck | desert | snow | night) → art
 * │     `enemy/<id>-<outfit>` when that set is drawn (`outfitArt`); skin tone per spawn
 * │     (`params.skin` a | b | c, else random, cosmetic rng) → `…-skin<x>` when drawn (`skinArt`);
 * │   · entries: `params.entry` = walk (calm, notices on the way) | run (alerted: skips gag and
 * │     alert) | drop | parachute (0.6 px/tick, the canopy floats away) | popup (crouched until
 * │     a player is near) | window (crouches in the opening, hops out) | chimney (rises out of
 * │     the `emerge` strip, sooty face 60 ticks) | manhole (lid slides aside, rises, hops out) |
 * │     truck (hops off the tailgate, alerted) | rowboat / float (`anchored`: never walks; with
 * │     `params.carrier` = an Entity he rides along with it) | ski (slides in at 2.0, crashes
 * │     into the snow 20 ticks) | skate (glides, slides while fighting; one skater of the world
 * │     falls flat every 90 ticks). `ctx.enter` from a side = `opts.sideEntry` (default 'run'),
 * │     from the top = drop;
 * │   · gags: `params.gag` (a name | true = random of `opts.gags` | false; placed soldiers
 * │     without the param: `gagChance`, 40 %) → strip `gag-<name>` (else `gag-<gags[0]>`, else
 * │     `gag`). Notice (rule 1): a player 160 px ahead / 48 behind, a player shot or blast within
 * │     48 px, an ally's shout (96 px) → the double-take (36 / 24 / 12 ticks, strip
 * │     `double-take`, sfx `enemy/double-take`), then '!' + `alert` 12 ticks. Killed in the gag
 * │     or the double-take: CAUGHT NAPPING +100. Idle soldiers see 220 px ahead / 64 behind;
 * │     gag props: `cards` throws cards up, `snowman` leaves its snowman (`<art>/snowman`; it
 * │     loses its head, `<art>/snowman-head`, when he dies), `ice-cream` drops `<art>/cone`;
 * │   · parade columns: `params.column` (+ `march` px/tick; default 0.6, a drummers-only column
 * │     0.5): members march in step (one step per 30-tick beat, `stepFrame`) and notice players
 * │     only within 160 px; when a `setsTempo` member (the drummer) dies, the rest stumble 60;
 * │   · panic: a player grenade within 36 px (rule 6) → 40 ticks at 1.6 px/tick, no attacks
 * │     (not while the soldier holds an attack token);
 * │   · reactions (Enemy protocol): every reaction first calls `cancelAttack()`; salute,
 * │     confused ('?' bubble), queue (walks to the JINGLE van and lines up with a coin), ears,
 * │     photo-pose, stumble, frozen, panic (with pit checks); after a reaction a soldier in a gag
 * │     wakes up (except after salute / photo);
 * │   · deaths: the anim by damage kind (Enemy.deathAnim: die, die-blast, die-burn, die-knife,
 * │     die-crush, die-shatter) + a yelp or the knife aria (a rising note per knife combo),
 * │     the hat pops 24 px and lands (`<art>/hat`), laser kills glow white and leave 4 rising
 * │     notes, fire kills run a small circle first.
 * │   Fields: `mode` / `modeT` (base modes: enter drop emerge slide crash fallen hide idle gag
 * │   notice march panic; after the alert the base switches to `combatMode` ('fight'); every
 * │   other mode name is yours and runs `fight()`), `cool` (ticks to the next attack, counts
 * │   down), `holdsToken`, `anchored`, `crouching`, `walkSpeed`, `runSpeed`, `gagName`,
 * │   `columnId`, `setsTempo`, `outfit`, `entry`.
 * │   Hooks: `fight()` (abstract) · `cancelAttack()` (drop your telegraph; call super) ·
 * │   `idleThink()` (before any notice; default: stand / patrol / glide) · `gagThink()` ·
 * │   `onGagEnd()` · `marchThink()` · `tick()` (every tick, alive) · `onDeath(d)` and `draw(r)`
 * │   (call super first) · `hatSprite()`.
 * │   Helpers: `setMode(m)`, `walk(dir, speed)` → moving (pits, 24 px steps, anchored),
 * │   `keepRange(t, min, max, speed?)` → moving, `clampToView(x)`, `takeToken()` /
 * │   `releaseToken()` (rule 4), `tele(base)` (× difficulty, ≥ 18), `recovery(base)`
 * │   (× difficulty), `turnToPlayer()` (every 30 ticks), `onScreenAt(x, y)` (rule 3: test it AT
 * │   the shot), `sees(front, behind)`, `disturbed()`, `startNotice(len, take?)`,
 * │   `startPanic(from)`, `grenadeNearby()`, `setCrouched(on)`, `playStep(anim)` /
 * │   `stepFrame(n)` (in step with the beat), `slip()`.
 * │ `SOLDIER` (shared numbers), `SoldierEntry`, `SoldierOutfit`, `SOLDIER_OUTFITS`, `outfitArt`.
 * │ `SoldierProp.spawn(world, { sprite, x, y, vx, vy, spin, hang, roll, rollDist, bounce, rest })`
 * │   — pooled props that fly, hang, land, roll and rest (hats, drums, cymbals, batons …).
 * │ `playOnce(frame?, ticks?)`, `playHold(frame)` — PlayOpts helpers (no allocation).
 * │ `takeAttackToken` / `releaseAttackToken` / `attackTokenLimit` (re-exported from enemy.ts).
 * │ Art — import from ./art.ts (see its header): outfit styles and the extra soldier strips.
 * └──────────────────────────────────────────────────────────────────────────────────────────────
 */
import { Entity, type Damage } from '../../../engine/entity';
import { TRANSPARENT } from '../../../engine/color';
import type { Rect } from '../../../engine/math';
import { INK, PAL } from '../../../engine/palette';
import { PixelBuffer } from '../../../engine/pixel';
import { jump, sweep, type Contact } from '../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../engine/render';
import { frameCount, hasSprite, type PlayOpts } from '../../../engine/sprites';
import type { ParticlePreset } from '../../../engine/particles';
import { makeRayHit } from '../../../engine/terrain';
import type { World } from '../../../engine/world';
import { hudOf } from '../../context';
import { awardScore } from '../../events';
import {
  Enemy,
  caughtNapping,
  doubleTakeTicks,
  findFloor,
  floorY,
  knifeComboStep,
  listenForBlasts,
  noticesPlayer,
  offscreenX,
  playerNoiseNear,
  releaseAttackToken,
  shoutToAllies,
  takeAttackToken,
  telegraphTicks,
  type EnemyOpts,
  type ReactionKind,
  type Side,
} from '../../enemy';
import { dust, FxEntity } from '../../fx';
import { Grenade, type GrenadeOpts } from '../../grenade';
import { Projectile } from '../../projectile';
import { isPlayer } from '../../player/player';
import { acquire, release } from '../../pool';
import { defineEntity, paramBool, paramNum, paramStr, type SpawnParams } from '../../registry';

/** Death yelps (sfx/index.ts) and the major-scale pitch steps of the knife-combo swoon note. */
const DIE_SFX: readonly string[] = ['enemy/die-1', 'enemy/die-2', 'enemy/die-3'];
/** Where the `snowman` gag's snowman stands in front of him (= SNOWMAN_X of rifleman-gags.art.ts). */
export const SNOWMAN_X = 15;
const ARIA_STEPS: readonly number[] = [0, 2, 4, 5, 7, 9, 11, 12].map((n) => Math.pow(2, n / 12));

// ---------------------------------------------------------------------------------------------
// Shared infantry rules live in the game layer (enemy.ts); re-exported for older imports.
// ---------------------------------------------------------------------------------------------

export { attackTokenLimit, releaseAttackToken, takeAttackToken } from '../../enemy';

/** Which soldier hides behind which piece of cover (one per crate, so squads spread out). */
const coverClaims = new WeakMap<Entity, Entity>();

// ---------------------------------------------------------------------------------------------
// Enemy grenade: lob, land, blink for 30 ticks, small blast. Knifeable / shootable while it lies.
// ---------------------------------------------------------------------------------------------

const rayHit = makeRayHit();
const blinkOpts: DrawOpts = {};

export class LobGrenade extends Grenade {
  landed = false;
  fuseTicks = 0;

  constructor(world: World) {
    super(world);
  }

  override init(o: GrenadeOpts): void {
    super.init({ ...o, contacts: 999, fuse: o.fuse ?? 300, type: o.type ?? 'enemy-grenade' });
    this.landed = false;
    this.fuseTicks = 0;
  }

  override update(): void {
    this.t++;
    if (this.landed) {
      if (--this.fuseTicks <= 0) this.explode();
      return;
    }
    this.vy = Math.min(this.vy + this.gravity, this.maxFall);
    const x1 = this.x + this.vx;
    const y1 = this.y + this.vy;
    const h = sweep(this.world.terrain, this.x, this.y, x1, y1, true, this.world, rayHit);
    if (!h) {
      this.x = x1;
      this.y = y1;
    } else {
      this.x = h.x + h.nx * 0.5;
      this.y = h.y + h.ny * 0.5;
      if (h.ny < -0.3) this.land();
      else if (Math.abs(h.nx) > 0.5) this.vx = -this.vx * 0.5;
      else this.vy = Math.abs(this.vy) * 0.3;
    }
    if (this.t >= this.life) this.expire();
    else if (!this.world.camera.containsPoint(this.x, this.y, this.offscreen)) this.remove();
  }

  /** Touched down: stop, blink for 30 ticks; it no longer hits on contact but can be knifed or shot. */
  private land(): void {
    this.landed = true;
    this.fuseTicks = 30;
    this.vx = 0;
    this.vy = 0;
    this.y -= 2;
    this.removeTag('shot');
    this.addTag('shootable');
    this.addTag('soft');
    this.hp = 1;
    this.world.audio.sfx('weapon/grenade-bounce', { vol: 0.7 });
  }

  /** Shot or knifed by a player while lying: defused (50 points), no blast. */
  override die(d?: Damage): void {
    if (this.dead || this.removed) return;
    this.dead = true;
    if (d && d.owner !== undefined) awardScore(this.world, d.owner, 50, this.x, this.y - 8);
    this.world.particles.sparks(this.x, this.y - 2, 6, 0);
    this.world.audio.sfx('hit/metal');
    this.remove();
  }

  override draw(r: Renderer): void {
    super.draw(r);
    if (this.landed && this.fuseTicks % 6 < 3) {
      blinkOpts.tint = this.fuseTicks % 12 < 6 ? PAL.red[3] : PAL.snow[3];
      blinkOpts.alpha = 0.8;
      blinkOpts.blend = 'normal';
      r.sprite(this.sprite, 0, Math.round(this.x), Math.round(this.y), blinkOpts);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Animation option helpers (shared PlayOpts objects: state changes never allocate)
// ---------------------------------------------------------------------------------------------

const playOpts: PlayOpts = {};
const stepOpts: PlayOpts = { restart: true, loop: true };
/**
 * Uniform frame durations (cached per value). A sprite's own `durations` win over a
 * `ticksPerFrame` override in the Animator, so timing overrides pass `durations`.
 */
const uniform = new Map<number, readonly number[]>();
function frames(ticks: number): readonly number[] {
  let d = uniform.get(ticks);
  if (!d) {
    d = [ticks];
    uniform.set(ticks, d);
  }
  return d;
}
/** Play once from `frame`; `ticks` per frame overrides the sprite's timing. */
function once(frame = 0, ticks?: number): PlayOpts {
  playOpts.restart = true;
  playOpts.loop = false;
  playOpts.frame = frame;
  playOpts.ticksPerFrame = undefined;
  playOpts.durations = ticks ? frames(ticks) : undefined;
  return playOpts;
}
/** Hold one frame of a strip (keeps holding if already playing). */
function still(frame: number): PlayOpts {
  playOpts.restart = false;
  playOpts.loop = false;
  playOpts.frame = frame;
  playOpts.ticksPerFrame = undefined;
  playOpts.durations = frames(9999);
  return playOpts;
}

/** PlayOpts: play once from `frame`; `ticks` per frame overrides the strip's own timing. */
export function playOnce(frame = 0, ticks?: number): PlayOpts {
  return once(frame, ticks);
}

/** PlayOpts: hold frame `frame` of a strip (keeps holding when it already plays). */
export function playHold(frame: number): PlayOpts {
  return still(frame);
}

// ---------------------------------------------------------------------------------------------
// Shared soldier numbers, entries and outfits (GDD §9.0, §4.11)
// ---------------------------------------------------------------------------------------------

/** Shared soldier numbers (NORMAL; telegraphs and cooldowns scale by difficulty in code). */
export const SOLDIER = {
  walk: 0.6,
  run: 1.2,
  panicSpeed: 1.6,
  panicTicks: 40,
  /** Highest step a soldier hops onto (GDD §9.0: "never climb more than 24 px"). */
  climb: 24,
  /** Deepest drop a soldier walks off. */
  drop: 40,
  /** Gag notice ranges (rule 1), ordinary sight, the alert after a double-take. */
  noticeFront: 160,
  noticeBehind: 48,
  noticeShot: 48,
  shoutRange: 96,
  sightFront: 220,
  sightBehind: 64,
  alertTicks: 12,
  /** A player grenade this close makes him panic (rule 6). */
  grenadeRadius: 36,
  /** Turn to face the nearest player this often (GDD §9.0). */
  faceEvery: 30,
  /** Entries. */
  parachuteFall: 0.6,
  skiSpeed: 2.0,
  skiCrash: 20,
  skateSpeed: 0.8,
  skateAccel: 0.03,
  skateFallEvery: 90,
  skateFallTicks: 40,
  sootTicks: 60,
  /** Parade columns: march speed, the drummer's beat, the notice range while performing. */
  columnSpeed: 0.6,
  drumColumnSpeed: 0.5,
  beat: 30,
  columnNotice: 160,
  stumbleTicks: 60,
  /** The JINGLE queue: distance of the first in line from the van, spacing of the line. */
  queueFront: 28,
  queueGap: 16,
  /** Placed soldiers without a `gag` param start in a gag this often. */
  gagChance: 0.4,
} as const;

export type SoldierEntry =
  | 'walk'
  | 'run'
  | 'drop'
  | 'parachute'
  | 'popup'
  | 'window'
  | 'chimney'
  | 'manhole'
  | 'truck'
  | 'rowboat'
  | 'ski'
  | 'skate'
  | 'float';

export type SoldierOutfit = 'parade' | 'deck' | 'desert' | 'snow' | 'night';
export const SOLDIER_OUTFITS: readonly SoldierOutfit[] = ['parade', 'deck', 'desert', 'snow', 'night'];

/** Art prefix for an outfit: `<base>-<outfit>` when that set is drawn, else `<base>`. */
export function outfitArt(base: string, outfit: string): string {
  return outfit && outfit !== 'parade' && hasSprite(`${base}-${outfit}/idle`) ? `${base}-${outfit}` : base;
}

/** Skin tones of the infantry rig (GDD §9.0: `skinA` fair, `skinB` tan, `skinC` deep). */
export const SOLDIER_SKINS = ['a', 'b', 'c'] as const;
export type SoldierSkin = (typeof SOLDIER_SKINS)[number];

/**
 * Art prefix for a skin tone (GDD §9.0: picked per spawn): `<base>-skin<a|b|c>` when that set is
 * drawn, else `<base>` (the type's own tone). `params.skin` ('a' | 'b' | 'c' or 'skinB' …) picks
 * one; otherwise a random tone. Cosmetic, so it draws from `world.fxRng` and never shifts the
 * gameplay rng; types without skin sets draw nothing.
 */
export function skinArt(base: string, p: SpawnParams, world: World): string {
  let any = false;
  for (const s of SOLDIER_SKINS) if (hasSprite(`${base}-skin${s}/idle`)) any = true;
  if (!any) return base;
  const raw = paramStr(p, 'skin', '').toLowerCase().replace('skin', '');
  const skin = (SOLDIER_SKINS as readonly string[]).includes(raw) ? raw : SOLDIER_SKINS[world.fxRng.int(0, SOLDIER_SKINS.length - 1)];
  return hasSprite(`${base}-skin${skin}/idle`) ? `${base}-skin${skin}` : base;
}

/** The entry of a soldier: the `entry` param, else from ctx.enter's `enter` side / top. */
function entryOf(p: SpawnParams, sideEntry: SoldierEntry): SoldierEntry | '' {
  const entry = paramStr(p, 'entry', '');
  if (entry) return entry as SoldierEntry;
  if (p.enter === 'top') return 'drop';
  if (p.enter === 'left' || p.enter === 'right') return sideEntry;
  return '';
}

export interface SoldierOpts extends EnemyOpts {
  /** Gags of this type (`gag-<name>` strips); a random one is picked for `gag: true`. */
  gags?: readonly string[];
  /** Entry for `ctx.enter(id, 'left' | 'right')` without an `entry` param (default 'run'). */
  sideEntry?: SoldierEntry;
  /** Walk and run speeds (GDD §9.0: 0.6 / 1.2). */
  walk?: number;
  run?: number;
  /** Crouched hurtbox height (default: the standing height). */
  crouchH?: number;
  /** Height of the hat above the feet, where it pops off on death (px). */
  hatY?: number;
  /** Placed soldiers without a `gag` param start in a gag this often (default 0.4). */
  gagChance?: number;
  /** Mode set after the alert (default 'fight'). */
  combatMode?: string;
}

/** Modes the Soldier base runs itself; every other mode runs the subclass's `fight()`. */
const BASE_MODES: ReadonlySet<string> = new Set(['enter', 'drop', 'emerge', 'slide', 'crash', 'fallen', 'hide', 'idle', 'gag', 'notice', 'march', 'panic']);
/** Modes in which a shout or a reaction finds the soldier unaware. */
const CALM_MODES: ReadonlySet<string> = new Set(['gag', 'idle', 'hide', 'march']);

// --------------------------------------------------------------------------- parade columns

interface Column {
  members: Soldier[];
  /** Explicit march speed (`params.march`), 0 = by members. */
  speed: number;
}
const columnRegistry = new WeakMap<World, Map<string, Column>>();

function columnOf(world: World, id: string): Column {
  let map = columnRegistry.get(world);
  if (!map) {
    map = new Map();
    columnRegistry.set(world, map);
  }
  let c = map.get(id);
  if (!c) {
    c = { members: [], speed: 0 };
    map.set(id, c);
  }
  return c;
}

/** Column speed: the explicit `march` param, else 0.5 for a line of drummers, else 0.6. */
function columnSpeed(c: Column): number {
  if (c.speed > 0) return c.speed;
  let drums = 0;
  let others = 0;
  for (const m of c.members) {
    if (!m.alive || m.followsColumn) continue;
    if (m.setsTempo) drums++;
    else others++;
  }
  return drums > 0 && others === 0 ? SOLDIER.drumColumnSpeed : SOLDIER.columnSpeed;
}

// --------------------------------------------------------------------------- skaters

interface SkateRink {
  next: number;
  list: Soldier[];
}
const rinks = new WeakMap<World, SkateRink>();

/** Every 90 ticks one skater in the view falls flat (GDD §9.0 entry `skate`). */
function skateClock(s: Soldier): void {
  const w = s.world;
  const rink = rinks.get(w);
  if (!rink || w.tick < rink.next) return;
  rink.next = w.tick + SOLDIER.skateFallEvery;
  let n = 0;
  for (let i = rink.list.length - 1; i >= 0; i--) {
    const k = rink.list[i];
    if (k.removed) rink.list.splice(i, 1);
    else if (k.canSlip()) n++;
  }
  if (n === 0) return;
  let pick = w.rng.int(0, n - 1);
  for (const k of rink.list) {
    if (!k.canSlip()) continue;
    if (pick-- === 0) {
      k.slip();
      return;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// SoldierProp: hats, drums, cymbals, batons … that fly off, hang, land, roll and rest
// ---------------------------------------------------------------------------------------------

export interface SoldierPropOpts {
  /** Sprite (feet-anchored frames; frame 0 = upright); drawn only when registered. */
  sprite?: string;
  /** Or a ready image (top-left = x − w/2, y − h). */
  image?: PixelBuffer | null;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  /** px/tick² (default 0.14; negative floats up). */
  gravity?: number;
  /** Ticks per frame while flying or rolling (tumbling); 0 = hold `frame`. */
  spin?: number;
  frame?: number;
  /** Ticks it hangs still at the top of its rise before it drops. */
  hang?: number;
  /** After landing: roll along the floor at this speed (px/tick) for `rollDist` px. */
  roll?: number;
  rollDist?: number;
  /** Bounce on landing: vy × −bounce while the fall is faster than 1 px/tick. */
  bounce?: number;
  /** Ticks it rests on the floor before it blinks out (the last 20 blink; default 40). */
  rest?: number;
  /** Frame while resting (default: the frame it landed on). */
  restFrame?: number;
  /** Removed after this many ticks whatever it does (default: none). */
  life?: number;
  /** Falls through the terrain (never lands). */
  ghost?: boolean;
  /** Lands on this y instead of the terrain (a baton on a fallen officer's chest). */
  landY?: number;
  flipX?: boolean;
  z?: number;
}

const propDraw: DrawOpts = {};

/** A small pooled prop with simple terrain landing (no physics Body). */
export class SoldierProp extends Entity {
  sprite = '';
  image: PixelBuffer | null = null;
  frame = 0;
  spin = 0;
  gravity = 0.14;
  hang = 0;
  roll = 0;
  rollLeft = 0;
  bounce = 0;
  rest = 40;
  restFrame = -1;
  life = Infinity;
  ghost = false;
  /** Lands on this y instead of the terrain (NaN = the terrain). */
  landY = NaN;
  flipX = false;
  phase: 'fly' | 'roll' | 'rest' = 'fly';
  t = 0;
  private restT = 0;
  private frames = 1;

  constructor(world: World) {
    super(world);
    this.z = 31;
    this.hitbox = { x: -6, y: -10, w: 12, h: 10 };
    this.despawnMargin = 64;
  }

  static spawn(world: World, o: SoldierPropOpts): SoldierProp {
    const p = acquire(world, SoldierProp);
    p.init(o);
    return world.add(p);
  }

  init(o: SoldierPropOpts): void {
    this.type = 'soldier-prop';
    this.sprite = o.sprite ?? '';
    this.image = o.image ?? null;
    this.frames = this.sprite && hasSprite(this.sprite) ? frameCount(this.sprite) : 1;
    this.x = this.prevX = o.x;
    this.y = this.prevY = o.y;
    this.vx = o.vx ?? 0;
    this.vy = o.vy ?? 0;
    this.gravity = o.gravity ?? 0.14;
    this.spin = o.spin ?? 0;
    this.frame = o.frame ?? 0;
    this.hang = o.hang ?? 0;
    this.roll = o.roll ?? 0;
    this.rollLeft = o.rollDist ?? 0;
    this.bounce = o.bounce ?? 0;
    this.rest = o.rest ?? 40;
    this.restFrame = o.restFrame ?? -1;
    this.life = o.life ?? Infinity;
    this.ghost = o.ghost ?? false;
    this.landY = o.landY ?? NaN;
    this.flipX = o.flipX ?? false;
    this.z = o.z ?? 31;
    this.phase = 'fly';
    this.t = 0;
    this.restT = 0;
  }

  override update(): void {
    this.t++;
    if (this.t >= this.life) {
      this.remove();
      return;
    }
    if (this.phase === 'rest') {
      if (++this.restT >= this.rest) this.remove();
      return;
    }
    if (this.spin > 0 && this.t % this.spin === 0) this.frame = (this.frame + 1) % this.frames;
    if (this.phase === 'roll') return this.rollOn();
    if (this.hang > 0 && this.vy >= 0) {
      // Hanging at the top of the rise (the officer's hat).
      this.hang--;
      return;
    }
    this.vy += this.gravity;
    const ny = this.y + this.vy;
    if (this.vy > 0 && ny >= this.landY) {
      // A fixed landing line (a chest): settle there and rest.
      this.x += this.vx;
      this.y = this.landY;
      this.vy = 0;
      return this.toRest();
    }
    if (!this.ghost && this.vy > 0) {
      const floor = this.world.terrain.surfaceY(this.x + this.vx, this.y - 2, ny + 1);
      if (Number.isFinite(floor)) {
        this.x += this.vx;
        this.y = floor;
        return this.land();
      }
    }
    this.x += this.vx;
    this.y = ny;
    if (this.y > this.world.terrain.killY) this.remove();
  }

  private land(): void {
    if (this.bounce > 0 && this.vy > 1) {
      this.vy = -this.vy * this.bounce;
      this.vx *= 0.7;
      return;
    }
    this.vy = 0;
    if (this.roll !== 0 && this.rollLeft > 0) {
      this.phase = 'roll';
      return;
    }
    this.toRest();
  }

  private toRest(): void {
    this.phase = 'rest';
    this.vx = 0;
    this.vy = 0;
    if (this.restFrame >= 0) this.frame = this.restFrame;
  }

  /** Roll along the floor (follows slopes; falls off ledges; stops at walls). */
  private rollOn(): void {
    const nx = this.x + this.roll;
    const t = this.world.terrain;
    const floor = t.surfaceY(nx, this.y - 6, this.y + 10);
    if (!Number.isFinite(floor)) {
      // Off a ledge: fly again (and land, rest, below).
      this.phase = 'fly';
      this.vx = this.roll;
      this.roll = 0;
      return;
    }
    if (floor < this.y - 5) return this.toRest();
    this.x = nx;
    this.y = floor;
    this.rollLeft -= Math.abs(this.roll);
    if (this.rollLeft <= 0) this.toRest();
  }

  override draw(r: Renderer): void {
    if (this.phase === 'rest' && this.rest - this.restT < 20 && this.restT % 4 < 2) return;
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    if (this.image) {
      propDraw.flipX = this.flipX;
      r.image(this.image, x - (this.image.w >> 1), y - this.image.h, propDraw);
      return;
    }
    if (!this.sprite || !hasSprite(this.sprite)) return;
    propDraw.flipX = this.flipX;
    r.sprite(this.sprite, this.frame, x, y, propDraw);
  }

  override onRemove(): void {
    this.image = null;
    release(this);
  }
}

// ---------------------------------------------------------------------------------------------
// Soldier: the shared base class of every Legion foot soldier
// ---------------------------------------------------------------------------------------------

const canopyOpts: DrawOpts = {};
const sootOpts: DrawOpts = {};
let canopy: PixelBuffer | null = null;

/**
 * Stand-in parachute canopy (34×16, built once): a crimson dome with darker panel seams and a
 * gold hem. Used until an `fx/parachute` sprite is registered.
 */
function canopyArt(): PixelBuffer {
  if (canopy) return canopy;
  const b = new PixelBuffer(34, 16);
  b.ellipse(1, 1, 32, 26, PAL.red[2]);
  b.ellipse(4, 2, 12, 10, PAL.red[3]);
  b.rect(0, 14, 34, 2, TRANSPARENT);
  for (const sx of [9, 17, 25]) for (let y = 0; y < 14; y++) if (b.get(sx, y) !== TRANSPARENT) b.set(sx, y, PAL.red[1]);
  for (let x = 0; x < 34; x++) if (b.get(x, 13) !== TRANSPARENT) b.set(x, 13, PAL.gold[2]);
  canopy = b.outline(INK);
  return canopy;
}

const headPt: [number, number] = [0, 0];

/** Playing cards thrown up when a card game is interrupted (white and red 2×3 flakes). */
const CARD_WHITE: ParticlePreset = { kind: 'rect', w: 2, h: 3, life: [34, 46], gravity: 0.08, drag: 0.98, colors: [PAL.snow[3], PAL.snow[2]], ground: 'stop' };
const CARD_RED: ParticlePreset = { kind: 'rect', w: 2, h: 3, life: [34, 46], gravity: 0.08, drag: 0.98, colors: [PAL.red[2], PAL.red[1]], ground: 'stop' };

export abstract class Soldier extends Enemy {
  /** Current mode (base modes, see BASE_MODES; anything else is the subclass's). */
  mode = 'idle';
  /** Ticks spent in the current mode. */
  modeT = 0;
  /** Ticks until the next attack choice (counts down every tick). */
  cool = 0;
  /** Holds an attack token (rule 4). */
  holdsToken = false;
  /** Never walks (rowboats, parade floats, prone snipers). */
  anchored = false;
  /** Sets a parade column's tempo (the drummer): when he dies the column stumbles. */
  setsTempo = false;
  /** Follows the column at a distance instead of marching in it (the officer). */
  followsColumn = false;
  /** The gag he plays ('' = none). */
  gagName = '';
  readonly outfit: string;
  readonly entry: SoldierEntry | '';
  readonly columnId: string;
  readonly walkSpeed: number;
  readonly runSpeed: number;
  protected readonly gags: readonly string[];
  protected readonly combatMode: string;
  protected readonly patrol: number;
  protected readonly homeX: number;
  protected faceT = 0;
  protected enterStop = 40;
  protected walkIn = false;
  protected parachute = false;
  protected noticeLen = 24;
  /** Length of the double-take of a soldier woken from a gag (0 = he was not in a gag). */
  protected doubleTake = 0;
  protected panicked = false;
  /** Alerted by a shouting ally: notice after this many ticks (-1 = none). */
  protected shoutIn = -1;
  /** Physics paused: inside a window / chimney / manhole, or riding a carrier. */
  protected held = false;
  private crouched = false;
  private readonly standBox: Rect;
  private readonly crouchBox: Rect;
  private readonly hatY: number;
  private gagAnim = 'gag';
  private emergeKind = '';
  private hopVx = 0;
  private sootLeft = 0;
  private lidT = -1;
  private lidX = 0;
  private lidY = 0;
  private skating = false;
  private skateVx = 0;
  private resumeMode = 'idle';
  private carrier: Entity | null = null;
  private carryDx = 0;
  private carryDy = 0;
  private laserT = -1;
  private burnT = -1;

  constructor(world: World, x: number, y: number, p: SpawnParams, o: SoldierOpts) {
    super(world, x, y, p, o);
    // Outfit variants (GDD §9.0) are sprite sets `enemy/<id>-<outfit>/…` when drawn.
    this.outfit = paramStr(p, 'outfit', 'parade');
    this.art = outfitArt(o.art, this.outfit);
    // Skin tone per spawn (GDD §9.0): `enemy/<id>[-<outfit>]-skin<a|b|c>/…` when drawn.
    this.art = skinArt(this.art, p, world);
    // Never spawn outside the section (a soldier running in at the section's end).
    const b = world.terrain.bounds;
    this.x = this.prevX = Math.max(b.x + 8, Math.min(b.x + b.w - 8, x));
    const w = o.w ?? 14;
    const h = o.h ?? 28;
    const ch = o.crouchH ?? h;
    this.standBox = { x: -w / 2, y: -h, w, h };
    this.crouchBox = { x: -w / 2, y: -ch, w, h: ch };
    this.hitbox = { ...this.standBox };
    this.gags = o.gags ?? [];
    this.combatMode = o.combatMode ?? 'fight';
    this.walkSpeed = o.walk ?? SOLDIER.walk;
    this.runSpeed = o.run ?? SOLDIER.run;
    this.hatY = o.hatY ?? 34;
    this.homeX = this.x;
    this.patrol = Math.max(0, paramNum(p, 'patrol', 0));
    this.columnId = paramStr(p, 'column', '');
    const rng = world.rng;
    this.cool = rng.int(20, 70);
    this.faceT = rng.int(0, 29);
    this.addTag('legion');
    listenForBlasts(world);
    const carrier = p.carrier;
    if (carrier instanceof Entity) {
      this.carrier = carrier;
      this.carryDx = this.x - carrier.x;
      this.carryDy = this.y - carrier.y;
    }
    if (this.columnId) {
      const c = columnOf(world, this.columnId);
      c.members.push(this);
      const m = paramNum(p, 'march', 0);
      if (m > 0) c.speed = m;
    }
    this.entry = entryOf(p, o.sideEntry ?? 'run');
    this.startEntry(p, o.gagChance ?? SOLDIER.gagChance);
  }

  // ------------------------------------------------------------------------------- entries

  private startEntry(p: SpawnParams, gagChance: number): void {
    const rng = this.world.rng;
    switch (this.entry) {
      case 'walk':
      case 'run':
      case 'ski': {
        const side: Side = p.enter === 'left' || p.enter === 'right' ? p.enter : this.facing > 0 ? 'left' : 'right';
        this.facing = side === 'left' ? 1 : -1;
        this.enterStop = rng.int(24, 72);
        if (this.entry === 'ski') return this.setMode('slide');
        if (this.columnId) return this.setMode('march'); // a parade column marches in, unaware
        this.walkIn = this.entry === 'walk';
        if (this.entry === 'run') this.alerted = true;
        return this.setMode('enter');
      }
      case 'drop':
      case 'parachute':
        this.parachute = this.entry === 'parachute';
        return this.setMode('drop');
      case 'truck':
        // Hops off the tailgate ready to fight (no gag, a short alert on landing).
        this.alerted = true;
        this.hopVx = this.facing * 1.1;
        this.vy = -2.4;
        return this.setMode('drop');
      case 'window':
      case 'chimney':
      case 'manhole':
        this.emergeKind = this.entry;
        this.held = true;
        if (this.entry === 'manhole') {
          this.lidT = 0;
          this.lidX = this.x;
          this.lidY = this.y;
        }
        return this.setMode('emerge');
      case 'popup':
        this.setCrouched(true);
        return this.setMode('hide');
      case 'skate': {
        this.skating = true;
        let rink = rinks.get(this.world);
        if (!rink) {
          rink = { next: this.world.tick + SOLDIER.skateFallEvery, list: [] };
          rinks.set(this.world, rink);
        }
        rink.list.push(this);
        break;
      }
      case 'rowboat':
      case 'float':
        this.anchored = true;
        if (this.carrier) this.held = true;
        break;
      default:
        break;
    }
    // Placed soldiers: a column marches, a gag plays, or he stands guard.
    if (this.columnId) return this.setMode('march');
    const gag = p.gag;
    const doGag = gag === undefined ? rng.chance(gagChance) : gag !== false && gag !== 'none';
    if (doGag) {
      const name = typeof gag === 'string' && gag !== 'true' ? gag : this.gags.length > 0 ? rng.pick(this.gags) : '';
      return this.startGag(name);
    }
    if (paramBool(p, 'crouch', false)) this.setCrouched(true);
    this.setMode('idle');
  }

  private startGag(name: string): void {
    this.gagName = name;
    const first = this.gags.length > 0 ? `gag-${this.gags[0]}` : 'gag';
    this.gagAnim = name && this.hasAnim(`gag-${name}`) ? `gag-${name}` : this.hasAnim(first) ? first : 'gag';
    this.setMode('gag');
    // Gags start at a random frame so a group never moves in sync.
    this.play(this.gagAnim, { restart: true, frame: this.world.rng.int(0, 3) });
  }

  // ------------------------------------------------------------------------------- helpers

  setMode(m: string): void {
    this.mode = m;
    this.modeT = 0;
  }

  /** Crouched hurtbox on / off (the crouched figure is ~27 px tall). */
  setCrouched(on: boolean): void {
    if (this.crouched === on) return;
    this.crouched = on;
    const b = on ? this.crouchBox : this.standBox;
    this.hitbox.x = b.x;
    this.hitbox.y = b.y;
    this.hitbox.w = b.w;
    this.hitbox.h = b.h;
  }

  /** Crouched right now (smaller stance, crouch-height shots). */
  get crouching(): boolean {
    return this.crouched;
  }

  /** A telegraph length scaled by difficulty, never below 18 ticks (rule 2). */
  tele(base: number): number {
    return telegraphTicks(this.world, base);
  }

  /** A recovery / cooldown length scaled by difficulty (EASY ×1.3, HARD ×0.8). */
  recovery(base: number): number {
    return Math.round(base * this.mods.enemyFireInterval);
  }

  /** Take an attack token before a telegraph (rule 4); false = keep moving and try later. */
  takeToken(): boolean {
    if (this.holdsToken) return true;
    if (!takeAttackToken(this.world, this)) return false;
    this.holdsToken = true;
    return true;
  }

  /** Give the token back (after the recovery, or when the attack is cancelled). */
  releaseToken(): void {
    if (!this.holdsToken) return;
    this.holdsToken = false;
    releaseAttackToken(this.world, this);
  }

  /** Rule 3 (8 px margin): is this point inside the view? Test it at the shot, not at the wind-up. */
  onScreenAt(x: number, y: number): boolean {
    return this.world.camera.containsPoint(x, y, -8);
  }

  /** Every 30 ticks turn to the nearest player (GDD §9.0); returns the nearest player. */
  turnToPlayer(): Entity | null {
    if (++this.faceT >= SOLDIER.faceEvery) {
      this.faceT = 0;
      return this.facePlayer();
    }
    return this.target();
  }

  /**
   * Walk / run toward `dir` unless a pit or a wall is right in front, or he is anchored. Any
   * floor from a climbable step (24 px) above down to a 40 px drop counts, so walkable slopes
   * (up to 1:1) are walked; a step of 5–24 px is hopped onto (GDD §9.0). Returns true if moving.
   */
  walk(dir: number, speed: number): boolean {
    if (dir === 0 || this.anchored) {
      this.vx = 0;
      return false;
    }
    const t = this.world.terrain;
    const ahead = this.x + dir * 10;
    const floor = t.surfaceY(ahead, this.y - SOLDIER.climb, this.y + SOLDIER.drop);
    if (!Number.isFinite(floor)) {
      this.vx = 0;
      return false;
    }
    this.facing = dir > 0 ? 1 : -1;
    this.vx = dir * speed;
    this.hopStep(dir);
    return true;
  }

  /** Blocked by a step (a wall last tick): hop onto it when its top is within 24 px. */
  private hopStep(dir: number): void {
    const b = this.body;
    if (!b || !b.onGround || !b.contact.hitWall || b.contact.wallDir !== dir) return;
    const top = this.world.terrain.surfaceY(this.x + dir * (b.w / 2 + 3), this.y - SOLDIER.climb, this.y - b.stepUp);
    if (!Number.isFinite(top)) return;
    // Enough lift to clear the step with a little room: v = √(2·g·(h + 6)).
    jump(this, -Math.sqrt(2 * b.gravity * (this.y - top + 6)));
  }

  /** Walk to stay `min`–`max` px from `t` (goals kept inside the view); true while moving. */
  keepRange(t: Entity, min: number, max: number, speed: number = this.walkSpeed): boolean {
    const dx = t.x - this.x;
    const dist = Math.abs(dx);
    const away = Math.sign(dx) || this.facing;
    let goal = this.x;
    if (dist > max) goal = t.x - away * max;
    else if (dist < min) goal = t.x - away * min;
    goal = this.clampToView(goal);
    const g = goal - this.x;
    if (Math.abs(g) <= 4) {
      this.vx = 0;
      return false;
    }
    return this.walk(Math.sign(g), speed);
  }

  /** Keep a combat position inside the view so locked arenas never lose their soldiers. */
  clampToView(x: number): number {
    const cam = this.world.camera;
    return Math.max(cam.left + 20, Math.min(cam.right - 20, x));
  }

  /** A player grenade landing (or falling) within 36 px (rule 6). */
  grenadeNearby(): boolean {
    const shots = this.world.byTag('shot');
    for (let i = 0; i < shots.length; i++) {
      const s = shots[i];
      if (!s.alive || s.team !== 'player' || !(s instanceof Grenade)) continue;
      if (Math.abs(s.x - this.x) < SOLDIER.grenadeRadius && s.y > this.y - 40 && s.y < this.y + 8 && s.vy >= 0) return true;
    }
    return false;
  }

  /** A player shot or explosion within 48 px (wakes gag soldiers). */
  disturbed(): boolean {
    return playerNoiseNear(this, SOLDIER.noticeShot);
  }

  /** Can a player be seen: in front within `front`, behind within `behind`, roughly level. */
  sees(front: number, behind: number): Entity | null {
    return noticesPlayer(this, front, behind, 110);
  }

  /** Frame of an n-frame step cycle (two steps per cycle, one step per 30-tick beat), in step with the world clock. */
  stepFrame(n: number): number {
    const cycle = SOLDIER.beat * 2;
    return Math.floor(((this.world.tick % cycle) / cycle) * n) % n;
  }

  /** Play `anim` in step with the beat (column members all move their legs together). */
  playStep(anim: string): void {
    const id = this.spriteId(anim);
    if (!hasSprite(id)) return this.play(anim);
    const f = this.stepFrame(frameCount(id));
    if (this.anim.id === id && this.anim.index === f) return;
    stepOpts.frame = f;
    stepOpts.durations = frames(9999);
    this.anim.play(id, stepOpts);
  }

  // ------------------------------------------------------------------------------- noticing

  /**
   * Start noticing a player: the double-take first when `take` > 0 (a soldier woken from a gag;
   * strip `double-take`), then '!' and the `alert` hop; after `len` ticks in all he is alerted.
   */
  startNotice(len: number, take = 0): void {
    this.vx = 0;
    this.noticeLen = Math.max(len, take + 1);
    this.doubleTake = take;
    this.setCrouched(false);
    this.setMode('notice');
    this.facePlayer();
    if (take > 0 && this.hasAnim('double-take')) {
      const n = Math.max(1, frameCount(this.spriteId('double-take')));
      this.play('double-take', once(0, Math.max(2, Math.floor(take / n))));
      this.world.audio.sfx('enemy/double-take');
    } else this.raiseAlert(this.noticeLen);
  }

  /** '!' bubble, the alert hop and its sound. */
  private raiseAlert(ticks: number): void {
    this.play('alert', once());
    this.world.audio.sfx('enemy/alert');
    // A gag bubble: SPEECH BUBBLES OFF hides it.
    hudOf(this.world).bubble(this, '!', { ticks: Math.max(12, ticks), kind: 'gag' });
  }

  /** Allies within shout range notice a little later (random, so they never move as one). */
  protected shout(): void {
    shoutToAllies(this, SOLDIER.shoutRange);
  }

  /** Called by a shouting ally (any enemy type that shouts, see enemy.ts `shoutToAllies`). */
  hearShout(delay: number): void {
    if (CALM_MODES.has(this.mode) && this.shoutIn < 0) this.shoutIn = delay;
  }

  protected override onAlert(): void {
    this.shout();
  }

  // ------------------------------------------------------------------------------- AI

  protected override think(): void {
    this.modeT++;
    if (this.cool > 0) this.cool--;
    if (this.sootLeft > 0) this.sootLeft--;
    if (this.lidT >= 0) this.lidT++;
    if (this.skating) skateClock(this);
    this.tick();
    if (this.shoutIn > 0 && --this.shoutIn === 0) {
      this.shoutIn = -1;
      // Only if he has not noticed anything by himself in the meantime.
      if (CALM_MODES.has(this.mode)) {
        if (this.mode === 'gag') {
          const take = doubleTakeTicks(this.world);
          this.startNotice(take + SOLDIER.alertTicks, take);
          this.onGagEnd();
        } else this.startNotice(this.world.rng.int(10, 16));
      }
    }
    switch (this.mode) {
      case 'enter':
        return this.thinkEnter();
      case 'drop':
        return this.thinkDrop();
      case 'emerge':
        return this.thinkEmerge();
      case 'slide':
        return this.thinkSlide();
      case 'crash':
        return this.thinkCrash();
      case 'fallen':
        return this.thinkFallen();
      case 'hide':
        return this.thinkHide();
      case 'idle':
        return this.thinkIdle();
      case 'gag':
        return this.thinkGag();
      case 'notice':
        return this.thinkNotice();
      case 'march':
        return this.thinkMarch();
      case 'panic':
        return this.thinkPanic();
      default:
        if (!this.holdsToken && this.grenadeNearby()) return this.startPanic(this.target());
        return this.fight();
    }
  }

  /** The AI after the alert: runs every tick in `combatMode` and in the subclass's own modes. */
  protected abstract fight(): void;

  /** Hook: every tick while alive and not reacting (timers, buffs). */
  protected tick(): void {}

  /** Run (or walk) in from off-screen until a random spot inside the view. */
  private thinkEnter(): void {
    const speed = this.walkIn ? this.walkSpeed : this.runSpeed;
    this.vx = this.facing * speed;
    this.play(this.walkIn ? 'walk' : 'run');
    const cam = this.world.camera;
    const inside = this.facing > 0 ? this.x - cam.left : cam.right - this.x;
    // A calm soldier walking in can notice a player on the way.
    if (this.walkIn && inside > 8 && (this.sees(SOLDIER.sightFront, SOLDIER.sightBehind) || this.disturbed())) {
      this.walkIn = false;
      return this.startNotice(this.world.rng.int(12, 20));
    }
    if (inside >= this.enterStop || this.body?.contact.hitWall || this.modeT > 420) {
      this.vx = 0;
      if (this.walkIn) {
        this.walkIn = false;
        this.setMode('idle');
      } else {
        this.alert();
        this.setMode(this.combatMode);
      }
    }
  }

  /** Falling in from above (a canopy, a hop off a truck or out of a window), then the alert. */
  private thinkDrop(): void {
    this.vx = this.hopVx;
    if (this.parachute && this.vy > SOLDIER.parachuteFall) this.vy = SOLDIER.parachuteFall;
    if (this.body?.onGround && this.modeT > 1) {
      dust(this.world, this.x, this.y, 4);
      if (this.parachute) this.releaseCanopy();
      this.parachute = false;
      this.hopVx = 0;
      this.vx = 0;
      this.startNotice(this.alerted ? 8 : 12);
      return;
    }
    this.play('alert', still(0));
  }

  /** Window: crouched in the opening, then a hop; chimney / manhole: rise out, then a hop. */
  private thinkEmerge(): void {
    this.vx = 0;
    if (this.emergeKind === 'window') {
      this.play('crouch');
      if (this.modeT >= 12) this.hopOut(0.9, -2.0);
      return;
    }
    this.play(this.hasAnim('emerge') ? 'emerge' : 'crouch');
    if (this.emergeKind === 'chimney' && this.modeT === 1) {
      this.sootLeft = SOLDIER.sootTicks + 20;
      if (hasSprite('fx/soot-cloud')) FxEntity.spawn(this.world, { sprite: 'fx/soot-cloud', x: this.x, y: this.y - 6, vy: -0.3 });
    }
    if (this.modeT >= 20) this.hopOut(0.8, -2.6);
  }

  private hopOut(vx: number, vy: number): void {
    this.held = false;
    this.hopVx = this.facing * vx;
    jump(this, vy);
    this.setMode('drop');
  }

  /** Ski entry: slides in at 2.0 px/tick, then crashes into the snow for 20 ticks. */
  private thinkSlide(): void {
    this.vx = this.facing * SOLDIER.skiSpeed;
    this.play(this.hasAnim('ski') ? 'ski' : 'run');
    const cam = this.world.camera;
    const inside = this.facing > 0 ? this.x - cam.left : cam.right - this.x;
    if (inside >= this.enterStop || this.body?.contact.hitWall || this.modeT > 300) {
      this.vx = 0;
      this.setMode('crash');
      this.play(this.hasAnim('ski-crash') ? 'ski-crash' : 'crouch', once());
      if (hasSprite('fx/snow-puff')) FxEntity.spawn(this.world, { sprite: 'fx/snow-puff', x: this.x + this.facing * 8, y: this.y - 6 });
      else dust(this.world, this.x + this.facing * 8, this.y, 8);
    }
  }

  private thinkCrash(): void {
    this.vx = 0;
    if (this.modeT >= SOLDIER.skiCrash) this.startNotice(10);
  }

  /** A skater fell flat (40 ticks, no attacks), then he gets up and goes on. */
  private thinkFallen(): void {
    this.vx = 0;
    if (this.modeT >= SOLDIER.skateFallTicks) this.setMode(this.resumeMode);
  }

  /** Can this skater fall now (on screen, upright, not busy)? */
  canSlip(): boolean {
    return this.alive && !this.reacting && this.mode !== 'fallen' && this.mode !== 'drop' && this.mode !== 'notice' && this.body?.onGround === true && this.onScreen(-8);
  }

  /** Fall flat on the ice (the skating gag): cancels any attack. */
  slip(): void {
    this.cancelAttack();
    this.setCrouched(false);
    this.resumeMode = BASE_MODES.has(this.mode) ? this.mode : this.combatMode;
    this.setMode('fallen');
    this.play(this.hasAnim('slip') ? 'slip' : 'crouch', once());
    this.world.audio.sfx('player/land', { vol: 0.6 });
  }

  /** Pop-up: crouched behind cover until a player comes close, then up and fighting. */
  private thinkHide(): void {
    this.vx = 0;
    this.play('crouch');
    const t = this.target();
    if (t && Math.abs(t.x - this.x) < 190 && this.onScreen(-8)) {
      this.setCrouched(false);
      this.startNotice(10);
    }
  }

  private thinkIdle(): void {
    this.idleThink();
    if (this.sees(SOLDIER.sightFront, SOLDIER.sightBehind) || this.disturbed()) this.startNotice(this.world.rng.int(12, 20));
  }

  /** Idle behaviour before any notice: glide on skates, patrol, or stand. Override to taste. */
  protected idleThink(): void {
    if (this.skating) {
      if (Math.abs(this.x - this.homeX) > 120) this.facing = this.x > this.homeX ? -1 : 1;
      if (!this.walk(this.facing, SOLDIER.skateSpeed)) this.facing = this.facing > 0 ? -1 : 1;
      this.play(this.hasAnim('skate') ? 'skate' : 'walk');
      return;
    }
    if (this.patrol > 0) {
      if (this.x > this.homeX + this.patrol) this.facing = -1;
      else if (this.x < this.homeX - this.patrol) this.facing = 1;
      if (!this.walk(this.facing, this.walkSpeed) || this.body?.contact.hitWall) this.facing = this.facing > 0 ? -1 : 1;
      this.play('walk');
      return;
    }
    this.vx = 0;
    this.play(this.crouched ? 'crouch' : 'idle');
  }

  private thinkGag(): void {
    this.vx = 0;
    this.play(this.gagAnim);
    this.gagThink();
    if (this.mode !== 'gag') return;
    if (this.sees(SOLDIER.noticeFront, SOLDIER.noticeBehind) || this.disturbed()) {
      // The double-take: 36 / 24 / 12 ticks by difficulty, then the 12-tick alert.
      const take = doubleTakeTicks(this.world);
      this.startNotice(take + SOLDIER.alertTicks, take);
      this.onGagEnd();
    }
  }

  /** Hook: every tick of the gag (sounds, props). */
  protected gagThink(): void {}

  /** Hook: the gag just ended (cards fly up, the cone drops …). */
  protected onGagEnd(): void {
    if (this.gagName === 'cards') this.throwCards();
    else if (this.gagName === 'snowman') this.leaveSnowman(false);
    else if (this.gagName === 'ice-cream') this.dropCone();
  }

  /** The snowman of Fanfaroni he built (a resting prop; pooled: check `sprite` before use). */
  // (It stands SNOWMAN_X px in front of him, as drawn in rifleman-gags.art.ts.)
  private snowman: SoldierProp | null = null;

  /**
   * The `snowman` gag's snowman stays where he built it (GDD §9.0); `headless`: it loses its
   * head (he was hit), which rolls away. Drawn as `<art>/snowman` (0 whole, 1 headless) and
   * `<art>/snowman-head`.
   */
  private leaveSnowman(headless: boolean): void {
    const id = this.spriteId('snowman');
    if (!hasSprite(id)) return;
    const x = this.x + this.facing * SNOWMAN_X;
    let s = this.snowman && !this.snowman.removed && this.snowman.sprite === id ? this.snowman : null;
    if (!s) s = this.snowman = SoldierProp.spawn(this.world, { sprite: id, x, y: this.y, rest: 900, frame: 0, flipX: this.facing < 0, z: 29 });
    if (!headless || s.frame === 1) return;
    s.frame = 1;
    SoldierProp.spawn(this.world, { sprite: this.spriteId('snowman-head'), x: s.x, y: s.y - 15, vx: this.facing * 0.8, vy: -2.2, spin: 5, bounce: 0.3, roll: this.facing * 0.8, rollDist: 30, rest: 240, restFrame: 0 });
    if (hasSprite('fx/snow-puff')) FxEntity.spawn(this.world, { sprite: 'fx/snow-puff', x: s.x, y: s.y - 14 });
  }

  /** The stolen cone (gag `ice-cream`) tumbles to the ground. */
  private dropCone(): void {
    const id = this.spriteId('cone');
    if (hasSprite(id)) SoldierProp.spawn(this.world, { sprite: id, x: this.x + this.facing * 7, y: this.y - 22, vx: this.facing * 0.6, vy: -1.6, spin: 4, rest: 90, restFrame: 2 });
  }

  /** The cards fly up on alert (GDD §9.0 gag `cards`). */
  private throwCards(): void {
    const w = this.world;
    for (let i = 0; i < 5; i++) {
      w.particles.emit(i % 2 === 0 ? CARD_WHITE : CARD_RED, this.x + this.facing * 6, this.y - 20, w.fxRng.range(-1.2, 1.2), w.fxRng.range(-2.6, -1.4));
    }
  }

  private thinkNotice(): void {
    this.vx = 0;
    if (this.doubleTake > 0 && this.modeT === this.doubleTake && this.playing('double-take')) this.raiseAlert(this.noticeLen - this.doubleTake);
    if (this.modeT >= this.noticeLen) {
      this.alert();
      this.setMode(this.combatMode);
      this.cool = Math.max(this.cool, this.world.rng.int(10, 40));
    }
  }

  /** A parade column member: march in step with the beat until he notices a player within 160 px. */
  private thinkMarch(): void {
    const c = this.columnId ? columnOf(this.world, this.columnId) : null;
    const speed = c ? columnSpeed(c) : this.walkSpeed;
    if (!this.walk(this.facing, speed)) this.vx = 0;
    this.playStep('walk');
    this.marchThink();
    if (this.mode !== 'march') return;
    if (this.sees(SOLDIER.columnNotice, SOLDIER.noticeBehind) || this.disturbed()) this.startNotice(this.world.rng.int(12, 20));
  }

  /** Hook: every tick of the column march (the drummer's beat). */
  protected marchThink(): void {}

  /** Run away from `from` (the grenade's thrower side) for 40 ticks, no attacks. */
  startPanic(from: Entity | null): void {
    this.releaseToken();
    this.panicked = true;
    this.setCrouched(false);
    this.facing = from ? (from.x > this.x ? -1 : 1) : this.facing > 0 ? -1 : 1;
    this.setMode('panic');
    this.world.audio.sfx('enemy/panic');
  }

  private thinkPanic(): void {
    this.play('panic');
    if (!this.walk(this.facing, SOLDIER.panicSpeed)) this.vx = 0;
    if (this.modeT >= SOLDIER.panicTicks) {
      this.vx = 0;
      this.cool = Math.max(this.cool, 20);
      this.setMode(this.alerted ? this.combatMode : 'idle');
    }
  }

  /**
   * Drop any attack in progress (a reaction, a panic, a slip, the muzzle left the view):
   * frees the token and goes back to `combatMode`. Override to reset your telegraph; call super.
   */
  protected cancelAttack(): void {
    this.releaseToken();
    if (!BASE_MODES.has(this.mode) && this.mode !== this.combatMode) this.setMode(this.combatMode);
  }

  // ------------------------------------------------------------------------------- physics

  protected override physics(): Contact | null {
    if (this.carrier) {
      if (this.carrier.alive) {
        // Riding a boat or a float: keep the offset to it.
        this.x = this.carrier.x + this.carryDx;
        this.y = this.carrier.y + this.carryDy;
        this.vx = 0;
        this.vy = 0;
        return null;
      }
      this.carrier = null;
      this.held = false;
    }
    if (this.held) {
      this.vx = 0;
      this.vy = 0;
      return null;
    }
    if (this.skating && this.body?.onGround) {
      // Skates: the AI's speed is a wish; the real speed glides toward it.
      const step = Math.abs(this.vx) < Math.abs(this.skateVx) ? SOLDIER.skateAccel * 0.5 : SOLDIER.skateAccel;
      this.skateVx += Math.max(-step, Math.min(step, this.vx - this.skateVx));
      this.vx = this.skateVx;
    } else this.skateVx = this.vx;
    return super.physics();
  }

  // ------------------------------------------------------------------------------- reactions

  /** A reaction stops any telegraph and frees the attack token (no attacks while it lasts). */
  protected override onReact(kind: ReactionKind, ticks: number, _source: Entity | null): void {
    if (kind === 'buff') return;
    this.cancelAttack();
    this.setCrouched(false);
    const hud = hudOf(this.world);
    if (kind === 'confused') hud.bubble(this, '?', { ticks, kind: 'gag' });
    else hud.clearBubble(this);
    if (kind === 'salute' && this.onScreen(0)) this.world.audio.sfx('enemy/salute', { vol: 0.5 });
  }

  protected override onReactionEnd(kind: ReactionKind): void {
    if (kind === 'buff') return;
    this.cool = Math.max(this.cool, this.world.rng.int(10, 30));
    // A gag does not survive a HONK, a queue or a freeze: he wakes up.
    if (this.alive && this.mode === 'gag' && kind !== 'salute' && kind !== 'photo') this.startNotice(8);
  }

  /** Walking reactions: the JINGLE queue, a careful panic; the rest stand and pose. */
  protected override thinkReaction(kind: ReactionKind): void {
    if (kind === 'queue') return this.thinkQueue();
    if (kind === 'panic') {
      const src = this.reactionSource ?? this.target();
      const dir = src ? (src.x > this.x ? -1 : 1) : -this.facing;
      if (!this.walk(dir, SOLDIER.panicSpeed)) this.vx = 0;
      this.play('panic');
      return;
    }
    if (kind === 'stumble' && !this.hasAnim('stumble')) {
      this.vx = 0;
      this.play(this.hasAnim('confused') ? 'confused' : 'idle');
      return;
    }
    super.thinkReaction(kind);
  }

  /** Queue at the van: walk to a place in the line, face the van, hold out a coin. */
  private thinkQueue(): void {
    const src = this.reactionSource;
    if (!src || !src.alive || this.anchored) {
      this.vx = 0;
      this.play(this.hasAnim('queue') ? 'queue' : 'idle');
      return;
    }
    const side = this.x >= src.x ? 1 : -1;
    const d = Math.abs(this.x - src.x);
    // Everyone queueing on this side nearer to the van stands in front of him.
    let rank = 0;
    const list = this.world.byTag('legion');
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e === this || !e.alive || !(e instanceof Enemy) || e.reaction !== 'queue' || e.reactionSource !== src) continue;
      if ((e.x >= src.x ? 1 : -1) === side && Math.abs(e.x - src.x) < d) rank++;
    }
    const goal = src.x + side * (SOLDIER.queueFront + rank * SOLDIER.queueGap);
    const g = goal - this.x;
    if (Math.abs(g) > 3 && this.walk(Math.sign(g), this.runSpeed)) {
      this.play('walk');
      return;
    }
    this.vx = 0;
    this.facing = side > 0 ? -1 : 1;
    this.play(this.hasAnim('queue') ? 'queue' : 'idle');
  }

  /** Frozen in ice (the sundae-mortar's `freeze`): any player hit shatters him, whatever his HP (GDD §6.3). */
  override onHit(d: Damage, part = 0): boolean {
    if (this.reaction === 'freeze' && this.alive && d.amount > 0 && d.kind !== 'crush') {
      this.hp = 0;
      this.die(d);
      return true;
    }
    return super.onHit(d, part);
  }

  // ------------------------------------------------------------------------------- death

  protected override onDeath(d: Damage): void {
    this.releaseToken();
    // Killed in a gag or before the double-take ended (GDD §4.11 rule 1).
    const napping = this.mode === 'gag' || (this.mode === 'notice' && this.modeT < this.doubleTake);
    this.held = false;
    this.carrier = null;
    this.setCrouched(false);
    super.onDeath(d);
    const w = this.world;
    if (d.kind === 'knife') w.audio.sfx('enemy/aria', { pitch: ARIA_STEPS[knifeComboStep(w)] });
    else w.audio.sfx(DIE_SFX[w.fxRng.int(0, DIE_SFX.length - 1)]);
    if (napping) caughtNapping(this, d);
    // Gag props: killed while building, the snowman loses its head; the cone drops.
    if (this.gagName === 'snowman' && (this.mode === 'gag' || this.snowman)) this.leaveSnowman(true);
    else if (this.gagName === 'ice-cream' && this.mode === 'gag') this.dropCone();
    hudOf(w).clearBubble(this);
    if (d.kind === 'laser') this.laserT = 0;
    else if (d.kind === 'fire') this.burnT = 0;
    if (d.kind !== 'fire' && d.kind !== 'laser' && d.kind !== 'crush' && this.reaction !== 'freeze') this.popHat(d);
    if (this.setsTempo && this.columnId) this.stumbleColumn();
  }

  /**
   * The hat that pops off on death: `<art>/hat` when drawn (feet-anchored, 4 tumble frames),
   * else the shared `fx/flying-shako`; '' = none. Override for bare-headed types.
   */
  protected hatSprite(): string {
    const own = this.spriteId('hat');
    if (hasSprite(own)) return own;
    return hasSprite('fx/flying-shako') ? 'fx/flying-shako' : '';
  }

  /** The hat pops up 24 px, tumbles and lands (GDD §9.0). */
  private popHat(d: Damage): void {
    const id = this.hatSprite();
    if (!id) return;
    const dir = d.dirX || -this.facing;
    SoldierProp.spawn(this.world, { sprite: id, x: this.x, y: this.y - this.hatY, vx: dir * 0.7, vy: -2.6, spin: 4, rest: 50, restFrame: 0, flipX: this.facing < 0 });
  }

  /** The drummer died: the rest of his column stumbles for 60 ticks (no attacks). */
  private stumbleColumn(): void {
    const c = columnOf(this.world, this.columnId);
    for (const m of c.members) if (m !== this && m.alive) m.react('stumble', SOLDIER.stumbleTicks, this);
  }

  protected override updateDeath(): void {
    if (this.laserT >= 0) {
      // Laser: glow white, then dissolve into 4 rising notes.
      this.flashTicks = 2;
      if (++this.laserT >= 18) {
        this.laserNotes();
        this.remove();
        return;
      }
    }
    if (this.burnT >= 0 && this.burnT < 30) {
      // On fire: a small panicked circle before the soot statue.
      this.burnT++;
      this.vx = Math.cos((this.burnT / 30) * Math.PI * 2) * 0.9;
      if (Math.abs(this.vx) > 0.2) this.facing = this.vx > 0 ? 1 : -1;
    }
    super.updateDeath();
  }

  private laserNotes(): void {
    const w = this.world;
    const sprite = hasSprite('fx/music-note') ? 'fx/music-note' : 'enemy/legion/note';
    if (!hasSprite(sprite)) return;
    for (let i = 0; i < 4; i++) {
      FxEntity.spawn(w, { sprite, x: this.x - 6 + i * 4, y: this.y - 8 - i * 6, vx: w.fxRng.range(-0.3, 0.3), vy: -0.7 - i * 0.12, life: 50, loop: true });
    }
  }

  override onRemove(): void {
    this.releaseToken();
    super.onRemove();
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    if (this.lidT >= 0 && this.lidT < 900) this.drawManhole(r);
    if (this.mode === 'drop' && this.parachute && !this.dead) this.drawCanopy(r);
    super.draw(r);
    if (this.dead) return;
    if (this.sootLeft > 0 && (this.sootLeft > 16 || this.sootLeft % 4 < 2)) this.drawSoot(r);
  }

  /** The canopy (the `fx/parachute` sprite when the art exists) and its cords. */
  protected drawCanopy(r: Renderer): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    const top = y - 72;
    if (hasSprite('fx/parachute')) r.sprite('fx/parachute', 0, x, top + 8);
    else {
      const c = canopyArt();
      r.image(c, x - (c.w >> 1), top, canopyOpts);
    }
    r.line(x - 14, top + 14, x - 3, y - 33, PAL.stone[3], canopyOpts);
    r.line(x + 14, top + 14, x + 3, y - 33, PAL.stone[3], canopyOpts);
  }

  /** Landed: the empty canopy floats away. */
  private releaseCanopy(): void {
    SoldierProp.spawn(this.world, { image: canopyArt(), x: this.x, y: this.y - 56, vx: this.world.fxRng.range(-0.5, 0.5), vy: -0.2, gravity: -0.004, ghost: true, life: 120, z: 29 });
  }

  /** Chimney soot on the face: a dark mask with two white eyes. */
  private drawSoot(r: Renderer): void {
    this.point('head', 2, -30, headPt);
    const hx = Math.round(headPt[0]);
    const hy = Math.round(headPt[1]);
    const f = this.facing;
    const x0 = f > 0 ? hx - 1 : hx - 5;
    r.rect(x0, hy - 2, 7, 5, PAL.ink[1], sootOpts);
    r.rect(hx + f * 2, hy - 1, 1, 2, PAL.snow[3], sootOpts);
    r.rect(hx + f * 4, hy - 1, 1, 2, PAL.snow[3], sootOpts);
  }

  /** The open manhole and its lid sliding aside. */
  private drawManhole(r: Renderer): void {
    const x = Math.round(this.lidX);
    const y = Math.round(this.lidY);
    r.rect(x - 7, y - 1, 14, 2, INK, sootOpts);
    const slide = Math.min(1, this.lidT / 10) * 15;
    const lx = x - 7 + Math.round(slide) * this.facing;
    r.rect(lx, y - 3, 14, 3, PAL.steel[1], sootOpts);
    r.rect(lx + 1, y - 3, 12, 1, PAL.steel[3], sootOpts);
  }
}

// ---------------------------------------------------------------------------------------------
// Rifleman
// ---------------------------------------------------------------------------------------------

type ShotKind = 'stand' | 'crouch' | 'up';

/** Rifleman numbers (GDD §9.1; NORMAL, scaled by difficulty in code). */
export const RIFLEMAN = {
  walk: 0.6,
  run: 1.2,
  panicSpeed: 1.6,
  hp: 10,
  /** Shot: telegraph, recovery, gap between shots, bullet. */
  aimTicks: 18,
  recoverTicks: 30,
  fireInterval: 90,
  bulletSpeed: 2.5,
  bulletDamage: 10,
  /**
   * Chest height of a standing shot (GDD §9.0: 24 px), with a 1 px tall hitbox: it passes
   * 3.5 px over a crouched player (20 px), so ducking still works on a step or a slope. A crouch
   * shot flies this low (jump it).
   */
  chestY: 24,
  shotH: 1,
  lowY: 11,
  /** Highest step a soldier hops onto (GDD §9.0: "never climb more than 24 px"). */
  climb: 24,
  /** Grenade: telegraph, cooldown, range band, flight time used to aim the lob. */
  throwTicks: 20,
  grenadeCooldown: 180,
  grenadeMin: 40,
  grenadeMax: 140,
  grenadeChance: 0.25,
  /** Butt swing: telegraph, active ticks, recovery, reach. */
  swingWindup: 50,
  swingActive: 6,
  swingRecover: 30,
  swingReach: 18,
  /** Up-shots: player more than this far above and within this far sideways. */
  upShotDy: 40,
  upShotDx: 120,
  panicTicks: 40,
  /** Gag notice ranges (GDD §4.11 rule 1). */
  noticeFront: 160,
  noticeBehind: 48,
  noticeShot: 48,
  shoutRange: 96,
  /** Ordinary (non-gag) sight. */
  sightFront: 220,
  sightBehind: 64,
} as const;

/** Gags available to the rifleman (sprites `gag-<name>`; the default `gag` strip otherwise). */
export const RIFLEMAN_GAGS: readonly string[] = ['cards', 'kazoo', 'shine', 'rehearse', 'nap', 'newspaper'];

const muzzle: [number, number] = [0, 0];
const shotPt: [number, number] = [0, 0];
const hand: [number, number] = [0, 0];
const glowOpts: DrawOpts = { blend: 'add', alpha: 1 };
const noteOpts: DrawOpts = {};

export class Rifleman extends Soldier {
  /** IN STEP! buff: cooldowns run 30 % faster while > 0. */
  private buffTicks = 0;
  private readonly prefRange: number;
  private readonly crouchChance: number;
  private readonly grenades: boolean;
  private shotKind: ShotKind = 'stand';
  private burstLeft = 0;
  private telegraph = 18;
  private crouchLeft = 0;
  private swingHit = false;

  constructor(world: World, x: number, y: number, p: SpawnParams) {
    super(world, x, y, p, { art: 'enemy/rifleman', hp: RIFLEMAN.hp, w: 14, h: 28, crouchH: 26, gags: RIFLEMAN_GAGS, combatMode: 'move', hatY: 34 });
    this.prefRange = paramNum(p, 'range', world.rng.int(80, 160));
    this.crouchChance = 0.3;
    this.grenades = paramBool(p, 'grenades', true);
  }

  // ------------------------------------------------------------------------------- helpers

  private muzzleOnScreen(): boolean {
    this.point('muzzle', 13, -RIFLEMAN.chestY, muzzle);
    return this.world.camera.containsPoint(muzzle[0], muzzle[1], -8);
  }

  /** Where the next shot of `kind` leaves from (fills `shotPt`). */
  private shotPoint(kind: ShotKind): [number, number] {
    this.point('muzzle', 13, kind === 'crouch' ? -13 : -RIFLEMAN.chestY, muzzle);
    shotPt[0] = muzzle[0];
    shotPt[1] = kind === 'crouch' ? this.y - RIFLEMAN.lowY : kind === 'up' ? this.y - RIFLEMAN.chestY - 3 : this.y - RIFLEMAN.chestY;
    return shotPt;
  }

  /** GDD §4.11 rule 3: no attack leaves from outside the view (8 px margin) — checked at the shot. */
  private shotOnScreen(kind: ShotKind): boolean {
    const p = this.shotPoint(kind);
    return this.onScreenAt(p[0], p[1]);
  }

  /** The attack cannot happen (muzzle off-screen, a reaction): drop it and wait a moment. */
  protected override cancelAttack(): void {
    super.cancelAttack();
    this.setCrouched(false);
    this.cool = Math.max(this.cool, this.world.rng.int(10, 30));
  }

  // ------------------------------------------------------------------------------- AI

  protected override tick(): void {
    if (this.buffTicks > 0) {
      this.buffTicks--;
      // ×0.7 cooldowns: three extra ticks off every seven (the cooldown runs 10/7 ≈ 1/0.7 as fast).
      if (this.cool > 0 && this.buffTicks % 7 < 3) this.cool--;
    }
  }

  protected fight(): void {
    switch (this.mode) {
      case 'crouch':
        return this.thinkCrouch();
      case 'aim':
        return this.thinkAim();
      case 'recover':
        return this.thinkRecover();
      case 'windup':
        return this.thinkWindup();
      case 'swing':
        return this.thinkSwing();
      default:
        return this.thinkMove();
    }
  }

  /** The main combat state: keep the preferred range, use cover, pick attacks. */
  private thinkMove(): void {
    const t = this.target();
    if (!t) {
      this.vx = 0;
      this.play('idle');
      return;
    }
    if (++this.faceT >= 30) {
      this.faceT = 0;
      this.facePlayer();
    }
    const dx = t.x - this.x;
    const dist = Math.abs(dx);
    const close = Math.abs(t.y - this.y) < 30;
    // Right on top of him: swing the rifle butt, or panic / back off.
    if (close && dist < RIFLEMAN.swingReach + 8 && this.cool <= 0 && this.takeToken()) return this.startSwing(dx);
    if (close && dist < 40) {
      if (!this.panicked && this.world.rng.chance(0.02)) return this.startPanic(t);
      if (!this.walk(dx > 0 ? -1 : 1, RIFLEMAN.walk)) this.vx = 0;
      this.play('walk');
      return;
    }
    // Attack when ready (muzzle on screen, a token free).
    if (this.cool <= 0 && this.body?.onGround && this.muzzleOnScreen()) {
      if (this.takeToken()) {
        this.facePlayer();
        const lob = this.grenades && dist >= RIFLEMAN.grenadeMin && dist <= RIFLEMAN.grenadeMax && close && this.world.rng.chance(RIFLEMAN.grenadeChance);
        if (lob) return this.startWindup();
        const crouch = this.world.rng.chance(this.crouchChance) && t.y - this.y > -RIFLEMAN.upShotDy;
        return this.startAim(crouch ? 'crouch' : this.upShot(t) ? 'up' : 'stand');
      }
      this.cool = this.world.rng.int(10, 30);
    }
    // Cover: a crate between him and the player, close by → get behind it and crouch.
    const cover = this.findCover(dx);
    let goal = this.x;
    if (cover !== null) goal = cover;
    else if (dist > this.prefRange + 24) goal = t.x - Math.sign(dx) * this.prefRange;
    else if (dist < this.prefRange - 24) goal = t.x - Math.sign(dx) * this.prefRange;
    if (cover === null) goal = this.spread(goal);
    goal = this.clampToView(goal);
    const gdx = goal - this.x;
    if (Math.abs(gdx) > 4) {
      const fast = Math.abs(gdx) > 200 && !this.crouching;
      if (this.walk(Math.sign(gdx), fast ? RIFLEMAN.run : RIFLEMAN.walk)) {
        this.setCrouched(false);
        this.play(fast ? 'run' : 'walk');
        return;
      }
    }
    this.vx = 0;
    if (cover !== null) {
      this.facePlayer();
      return this.startCrouch(this.world.rng.int(90, 200));
    }
    if (this.modeT > 20 && this.world.rng.chance(0.004)) return this.startCrouch(this.world.rng.int(60, 150));
    this.play('idle');
  }

  /** x of a hiding spot behind a crate between him and the player (or null). Claims the crate. */
  private findCover(dxToPlayer: number): number | null {
    const dir = Math.sign(dxToPlayer);
    if (dir === 0 || Math.abs(dxToPlayer) < 48 || this.anchored) return null;
    const list = this.world.byTag('cover');
    let best: Entity | null = null;
    let bestD = 64;
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (!c.alive || Math.abs(c.y - this.y) > 6) continue;
      const owner = coverClaims.get(c);
      if (owner && owner !== this && owner.alive) continue;
      const d = (c.x - this.x) * dir;
      // The crate must lie toward the player and not past him.
      if (d < -20 || d > bestD || Math.abs(c.x - this.x) >= Math.abs(dxToPlayer) - 24) continue;
      bestD = d;
      best = c;
    }
    if (!best) return null;
    coverClaims.set(best, this);
    return best.x - dir * 16;
  }

  /** Nudge a goal x away from other riflemen standing there (squads spread out). */
  private spread(goal: number): number {
    const list = this.world.byTag('enemy');
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e === this || !e.alive || !(e instanceof Rifleman) || Math.abs(e.y - this.y) > 8) continue;
      if (Math.abs(e.x - goal) < 22) return goal + (this.id < e.id ? -26 : 26);
    }
    return goal;
  }

  private upShot(t: Entity): boolean {
    return this.y - t.y > RIFLEMAN.upShotDy && Math.abs(t.x - this.x) < RIFLEMAN.upShotDx;
  }

  private startCrouch(ticks: number): void {
    this.vx = 0;
    this.crouchLeft = ticks;
    this.setCrouched(true);
    this.setMode('crouch');
  }

  private thinkCrouch(): void {
    this.vx = 0;
    this.play('crouch');
    const t = this.target();
    if (!t) return;
    if (++this.faceT >= 30) {
      this.faceT = 0;
      this.facePlayer();
    }
    if (Math.abs(t.x - this.x) < 40 && Math.abs(t.y - this.y) < 30) {
      this.setCrouched(false);
      this.setMode('move');
      return;
    }
    if (this.cool <= 0 && this.muzzleOnScreen() && !this.upShot(t)) {
      if (this.takeToken()) {
        this.facePlayer();
        return this.startAim('crouch');
      }
      this.cool = this.world.rng.int(10, 30);
    }
    if (--this.crouchLeft <= 0) {
      this.setCrouched(false);
      this.setMode('move');
    }
  }

  /** Shot telegraph: the rifle comes up, a click, a glint on the last 2 ticks. */
  private startAim(kind: ShotKind): void {
    this.vx = 0;
    this.shotKind = kind;
    this.setCrouched(kind === 'crouch');
    this.telegraph = this.tele(RIFLEMAN.aimTicks);
    this.burstLeft = this.mods.id === 'hard' ? 2 : 1;
    this.setMode('aim');
    this.play(kind === 'crouch' ? 'crouch-shoot' : 'shoot', once(1));
    this.world.audio.sfx('enemy/aim', { vol: 0.8 });
  }

  private thinkAim(): void {
    this.vx = 0;
    if (this.modeT < this.telegraph) return;
    // The view may have scrolled during the telegraph: never fire from outside it.
    if (!this.shotOnScreen(this.shotKind)) return this.cancelAttack();
    this.fire();
    if (--this.burstLeft > 0) {
      // HARD: a second shot 10 ticks later.
      this.telegraph = this.modeT + 10;
      return;
    }
    this.setMode('recover');
  }

  private fire(): void {
    const kind = this.shotKind;
    this.play(kind === 'crouch' ? 'crouch-shoot' : 'shoot', once());
    const p = this.shotPoint(kind);
    const up = kind === 'up';
    const angle = up ? (this.facing > 0 ? -Math.PI / 4 : (-3 * Math.PI) / 4) : this.facing > 0 ? 0 : Math.PI;
    this.shoot({
      speed: RIFLEMAN.bulletSpeed,
      damage: RIFLEMAN.bulletDamage,
      sprite: 'enemy/bullet',
      angle,
      x: p[0],
      y: p[1],
      w: 6,
      h: kind === 'stand' ? RIFLEMAN.shotH : 3,
      life: 300,
    });
    this.world.audio.sfx('enemy/rifle');
    this.world.particles.smoke(muzzle[0] + this.facing * 2, muzzle[1], 1);
  }

  private thinkRecover(): void {
    this.vx = 0;
    if (this.modeT < Math.round(RIFLEMAN.recoverTicks * this.mods.enemyFireInterval)) return;
    this.releaseToken();
    this.cool = this.fireInterval(RIFLEMAN.fireInterval, 25);
    if (this.shotKind === 'crouch') this.startCrouch(this.world.rng.int(30, 90));
    else this.setMode('move');
  }

  /** Grenade telegraph: the arm goes back with a lit fuse (hiss), the lob leaves on tick 20. */
  private startWindup(): void {
    this.vx = 0;
    this.setCrouched(false);
    this.telegraph = this.tele(RIFLEMAN.throwTicks);
    this.setMode('windup');
    this.play('throw', once(0, Math.ceil(this.telegraph / 2)));
    this.world.audio.sfx('enemy/grenade');
  }

  private thinkWindup(): void {
    this.vx = 0;
    if (this.modeT === this.telegraph) {
      this.point('hand', 9, -31, hand);
      if (!this.onScreenAt(hand[0], hand[1])) return this.cancelAttack();
      this.lob();
    }
    if (this.modeT >= this.telegraph + 24) {
      this.releaseToken();
      this.cool = this.fireInterval(RIFLEMAN.grenadeCooldown, 30);
      this.setMode('move');
    }
  }

  private lob(): void {
    const t = this.target();
    this.point('hand', 9, -31, hand);
    const dx = t ? Math.abs(t.x - this.x) : 80;
    // Flight time of the arc ≈ 2·3.0 / 0.15 = 40 ticks: pick vx so it lands near the player.
    const vx = Math.max(0.9, Math.min(3.2, (dx / 40) * this.world.rng.range(0.85, 1.1)));
    LobGrenade.spawn(this.world, {
      team: 'enemy',
      x: hand[0],
      y: hand[1],
      vx: vx * this.facing,
      vy: -3.0,
      gravity: 0.15,
      damage: 10,
      sprite: 'enemy/grenade',
      w: 6,
      h: 6,
      blastSize: 's',
      blastDamage: 30,
      blastRadius: 14,
      shooter: this,
      offscreen: 64,
    } as GrenadeOpts);
    this.world.audio.sfx('weapon/grenade-throw', { vol: 0.8 });
  }

  /** Butt swing: a long wind-up (rifle overhead), a short hit, a recovery. */
  private startSwing(dx: number): void {
    this.vx = 0;
    this.facing = dx >= 0 ? 1 : -1;
    this.setCrouched(false);
    this.swingHit = false;
    this.telegraph = this.tele(RIFLEMAN.swingWindup);
    this.setMode('swing');
    this.play('throw', once(1, 9999));
    this.world.audio.sfx('enemy/windup');
  }

  private thinkSwing(): void {
    this.vx = 0;
    const T = this.telegraph;
    if (this.modeT === T) this.play('throw', once(3, 9999));
    if (this.modeT >= T && this.modeT < T + RIFLEMAN.swingActive && !this.swingHit) {
      const x0 = this.facing > 0 ? this.x : this.x - 20;
      const players = this.world.byTag('player');
      for (let i = 0; i < players.length; i++) {
        const p = players[i];
        if (!p.alive || !isPlayer(p)) continue;
        const r = p.hitRect();
        if (r.x < x0 + 20 && r.x + r.w > x0 && r.y < this.y && r.y + r.h > this.y - 20) {
          this.world.damage(p, { amount: 10, kind: 'impact', dirX: this.facing, source: this });
          this.swingHit = true;
        }
      }
    }
    if (this.modeT >= T + RIFLEMAN.swingActive + RIFLEMAN.swingRecover) {
      this.releaseToken();
      this.cool = this.fireInterval(60, 20);
      this.setMode('move');
    }
  }

  // ------------------------------------------------------------------------------- reactions

  /** Legion reactions (salute, ears, queue …) plus IN STEP! ('buff': faster shots). */
  protected override acceptsReaction(kind: ReactionKind): boolean {
    if (kind === 'buff') return true;
    return super.acceptsReaction(kind);
  }

  protected override onReact(kind: ReactionKind, ticks: number, source: Entity | null): void {
    if (kind === 'buff') {
      // The buff does not stop him: it shortens his cooldowns (×0.7) and ends at once.
      this.cool = Math.round(this.cool * 0.7);
      this.buffTicks = this.reactionTicks;
      this.endReaction();
      return;
    }
    super.onReact(kind, ticks, source);
  }

  /** Is the IN STEP! buff running (he bobs in time, notes over his head)? */
  get inStep(): boolean {
    return this.buffTicks > 0;
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    super.draw(r);
    if (this.dead) return;
    if (this.mode === 'aim' && this.telegraph - this.modeT <= 2) {
      // Muzzle glint on the last two telegraph ticks.
      this.point('muzzle', 13, -RIFLEMAN.chestY, muzzle);
      const mx = Math.round(muzzle[0]);
      const my = Math.round(muzzle[1]);
      r.rect(mx - 2, my, 5, 1, PAL.snow[3], glowOpts);
      r.rect(mx, my - 2, 1, 5, PAL.snow[3], glowOpts);
      r.rect(mx - 1, my - 1, 3, 3, PAL.gold[3], glowOpts);
    } else if (this.mode === 'windup' && this.modeT < this.telegraph) {
      // The lit fuse: a flickering spark at the hand.
      this.point('hand', -11, -19, hand);
      if (this.modeT % 4 < 2) r.rect(Math.round(hand[0]) - 1, Math.round(hand[1]) - 4, 2, 2, PAL.fire[5], glowOpts);
    } else if (this.mode === 'swing' && this.modeT < this.telegraph && this.modeT % 8 < 4) {
      this.drawTint(r, PAL.red[3], 0.35);
    }
    if (this.buffTicks > 0) this.drawInStep(r);
  }

  /** IN STEP!: a small note bobbing over his head in time (GDD §9.1 baton-major). */
  private drawInStep(r: Renderer): void {
    const beat = this.world.tick % SOLDIER.beat;
    const x = Math.round(this.x) + (this.facing > 0 ? -2 : 1);
    const y = Math.round(this.y) - 44 - (beat < 15 ? 1 : 0);
    const note = hasSprite('fx/music-note') ? 'fx/music-note' : 'enemy/legion/note';
    if (hasSprite(note)) {
      noteOpts.flipX = false;
      r.sprite(note, 0, x, y, noteOpts);
    } else {
      r.rect(x, y - 4, 1, 5, PAL.gold[2], noteOpts);
      r.rect(x - 2, y, 3, 2, PAL.gold[2], noteOpts);
    }
  }
}

defineEntity('rifleman', (w, x, y, p) => new Rifleman(w, x, y, p), { category: 'enemy', score: 100, description: 'Brass Private: the basic rifle soldier.' });

// The standard enemy projectiles as entities (GDD §15.4; bosses and scripts may spawn them).
// `y` is the shooter's feet: the bullet flies at chest height (24 px up, GDD §9.0) along
// `facing` (or `angle`, degrees); the grenade is lobbed like the rifleman's (vx 1.8 × facing).
defineEntity(
  'enemy-bullet',
  (w, x, y, p) => {
    // `angle` in degrees like the player shot ids (0 = right, −90 = up); default: along `facing`.
    const a = (paramNum(p, 'angle', p.facing === 1 || p.facing === 'right' ? 0 : 180) * Math.PI) / 180;
    const v = paramNum(p, 'speed', RIFLEMAN.bulletSpeed);
    return Projectile.spawn(w, {
      team: 'enemy', x, y: y - RIFLEMAN.chestY, vx: Math.cos(a) * v, vy: Math.sin(a) * v, damage: RIFLEMAN.bulletDamage,
      sprite: 'enemy/bullet', w: 6, h: RIFLEMAN.shotH, life: 300, offscreen: 32, type: 'enemy-bullet',
    });
  },
  { category: 'projectile', description: 'Standard Legion bullet: a brass pellet, 2.5 px/tick, chest high (params facing, angle, speed).' },
);
defineEntity(
  'enemy-grenade',
  (w, x, y, p) => {
    const dir = p.facing === 1 || p.facing === 'right' ? 1 : -1;
    return LobGrenade.spawn(w, {
      team: 'enemy', x, y: y - 20, vx: paramNum(p, 'vx', 1.8) * dir, vy: -3.0, gravity: 0.15, damage: 10,
      sprite: 'enemy/grenade', w: 6, h: 6, blastSize: 's', blastDamage: 30, blastRadius: 14, offscreen: 64,
    } as GrenadeOpts);
  },
  { category: 'projectile', description: 'Legion grenade: lobbed arc, 30-tick blinking fuse on the ground, blast r 14 (params facing, vx).' },
);

// ---------------------------------------------------------------------------------------------
// Spawn helpers for mission scripts
// ---------------------------------------------------------------------------------------------

/** A soldier running in from just outside the view on `side` (skips gag and alert). */
export function riflemanRunIn(world: World, side: Side, params: SpawnParams = {}): Entity {
  const x0 = offscreenX(world, side, 20);
  const spot = findFloor(world, x0, { prefer: side === 'left' ? -1 : 1 });
  const x = spot ? spot.x : x0;
  return world.spawn('rifleman', x, spot ? spot.y : floorY(world, x), { facing: side === 'left' ? 1 : -1, enter: side, entry: 'run', ...params });
}

/** A soldier dropping in from above the view at x (`parachute: true` floats down slowly). */
export function riflemanDrop(world: World, x: number, params: SpawnParams = {}, parachute = false): Entity {
  return world.spawn('rifleman', x, world.camera.top - 40, { entry: parachute ? 'parachute' : 'drop', ...params });
}

/** A soldier crouched behind cover at (x, y) who pops up when a player comes near. */
export function riflemanPopUp(world: World, x: number, y: number, params: SpawnParams = {}): Entity {
  return world.spawn('rifleman', x, y, { entry: 'popup', ...params });
}
