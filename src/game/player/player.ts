/**
 * The player soldier (docs/ARCHITECTURE.md §6, §6.1, mechanics.md §2–§9).
 *
 * States: 'play' (control) · 'spawn' (dropping in) · 'dead' (death animation) · 'out' (no lives
 * left, waiting for a continue) · 'mounted' (inside a vehicle) · 'victory' (mission end pose).
 *
 * Split body: the legs animation (`<art>/legs-*`) is drawn at the feet; the torso
 * (`<art>/torso-<pose>-*`, anchored at the hip) is drawn at the legs frame's 'hip' point.
 * Bullets leave from the torso frame's 'muzzle' point, bombs from the throw frame's 'hand' point.
 * Missing points (art not ready) fall back to TUNING.player.fallback*.
 *
 * Controls: run, crouch / crouch-walk, fixed-height jump with air control, coyote time and a
 * jump buffer, drop-through (down + jump on a one-way platform), aim forward / up / down (down
 * only in the air), shoot (WeaponDef via a Gun), automatic knife when a soft enemy is within
 * reach, bombs. One hit kills unless invulnerable (or god mode); on death the special weapon,
 * extra bombs and the rescued-hostage count are lost; the player drops in again at a safe spot
 * near the death point and blinks invulnerable for ~2 s.
 *
 * Persistent data (lives, score, weapon + ammo, bombs, hostages) lives in the session
 * `PlayerSlot`, so a new section continues where the last one ended.
 */
import { Entity, type Damage } from '../../engine/entity';
import type { HazardDef } from '../../engine/terrain';
import { VirtualPad } from '../../engine/input';
import { approach, clamp, strideRate, type Rect } from '../../engine/math';
import { Body, dropThrough, jump, moveBody, pushX, settle } from '../../engine/physics';
import type { Color } from '../../engine/color';
import { PAL } from '../../engine/palette';
import type { DrawOpts, Renderer } from '../../engine/render';
import { Animator, frameCount, framePoint, getFrame, getFrames, hasSprite, spriteAnim, type PlayOpts } from '../../engine/sprites';
import type { World } from '../../engine/world';
import { difficultyOf, gameOf, hudOf, iceAt, sessionOf } from '../context';
import { awardScore, type DeathCause } from '../events';
import { dust, splash } from '../fx';
import { eraseEnemyShots } from '../projectile';
import { getCharacter, getStatus, getWeapon, hasWeapon, type CharacterDef } from '../registry';
import type { PlayerSlot, SlotIndex } from '../session';
import { TUNING } from '../tuning';
import { waterSurfaceAt } from '../water';
import {
  BUILTIN_GRENADE,
  BUILTIN_KNIFE,
  Gun,
  aimAngle,
  aimDirOf,
  meleeBox,
  meleeTargetIn,
  type AimDir,
  type FireArgs,
  type MeleeBox,
  type WeaponDef,
  type WeaponPose,
} from '../weapons';
import { CHUTE_COLLAPSE_SPRITE, drawChute, INTRO_DROP, INTRO_DROP_ID } from './intro-drop';
import { StatusEffects } from './status';

export type PlayerState = 'play' | 'spawn' | 'dead' | 'out' | 'mounted' | 'victory';

/**
 * Rider poses of an open-seat mount (the Swan; ARCHITECTURE §6.1, look.md §6.3–§6.5): strips
 * `<art>/ride-<pose>`, upper body only, anchored at the hip.
 */
export type RidePose = 'sit' | 'lean' | 'up' | 'hunch' | 'hold' | 'brace' | 'duck' | 'ears' | 'cheer';
export const RIDE_POSES: readonly RidePose[] = ['sit', 'lean', 'up', 'hunch', 'hold', 'brace', 'duck', 'ears', 'cheer'];
/** `drawRide` falls back to `mount` frame 1 drawn this far below the hip (its hip point is (0, −17)). */
const MOUNT_HIP_DROP = 17;

/** Something a player can climb into (vehicles implement this). */
export interface Mountable extends Entity {
  /** Can this player enter right now (seat free, touching the seat …)? */
  canMount(p: Player): boolean;
  mount(p: Player): void;
}

function isMountable(e: Entity): e is Mountable {
  const m = e as unknown as Partial<Mountable>;
  return typeof m.canMount === 'function' && typeof m.mount === 'function';
}

export interface PlayerOpts {
  /** Input pad of this player. */
  pad: VirtualPad;
  /** Slot index (default 0). */
  index?: SlotIndex;
  /** Persistent state (default: the session slot of `index`). */
  slot?: PlayerSlot;
  /** Character id (default: the slot's character). */
  character?: string;
}

export interface DismountOpts {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  invuln?: number;
}

type TorsoAction =
  | 'idle'
  | 'shoot'
  | 'up'
  | 'shoot-up'
  | 'down'
  | 'shoot-down'
  | 'diag-up'
  | 'shoot-diag-up'
  | 'diag-down'
  | 'shoot-diag-down'
  | 'throw'
  | 'knife'
  // Draw-only twins (outside the Helium loop; gameplay points read the base actions above).
  | 'run'
  | 'crouch'
  | 'crouch-shoot'
  | 'crouch-throw'
  | 'crouch-knife'
  | 'knife-b';
const TORSO_ACTIONS: readonly TorsoAction[] = [
  'idle',
  'shoot',
  'up',
  'shoot-up',
  'down',
  'shoot-down',
  'diag-up',
  'shoot-diag-up',
  'diag-down',
  'shoot-diag-down',
  'throw',
  'knife',
  'run',
  'crouch',
  'crouch-shoot',
  'crouch-throw',
  'crouch-knife',
  'knife-b',
];
/** Crouched twin of a forward torso action (draw-only). */
const CROUCH_TWIN: Partial<Record<TorsoAction, TorsoAction>> = {
  idle: 'crouch',
  shoot: 'crouch-shoot',
  throw: 'crouch-throw',
  knife: 'crouch-knife',
  'knife-b': 'crouch-knife',
};
/** The base action a draw-only twin falls back to under a status art (Helium) or without art. */
const BASE_ACTION: Partial<Record<TorsoAction, TorsoAction>> = {
  run: 'idle',
  crouch: 'idle',
  'crouch-shoot': 'shoot',
  'crouch-throw': 'throw',
  'crouch-knife': 'knife',
  'knife-b': 'knife',
};
/** Elevations from 22.5° to 67.5° use the diagonal torso frames (machine-gun sweep), when drawn. */
const DIAG_MIN = Math.PI / 8 - 1e-6;
const DIAG_MAX = (3 * Math.PI) / 8 + 1e-6;
const LEGS = ['idle', 'run', 'jump', 'fall', 'land', 'crouch', 'crouch-walk', 'dangle', 'crouch-in', 'crouch-out'] as const;
type LegsAnim = (typeof LEGS)[number];
const FULL = ['die', 'die-burn', 'die-blast', 'die-drown', 'die-flat', 'victory', 'spawn', 'bored', 'mount', 'flip', 'mount-hop', 'fidget-a', 'fidget-b', 'timeout-yawn', 'timeout-sleep'] as const;
type FullAnim = (typeof FULL)[number];

const HALF_PI = Math.PI / 2;
const QUARTER_PI = Math.PI / 4;
const drawOpts: DrawOpts = {};
const tintOpts: DrawOpts = {};
const PICKUP_TINT = PAL.fire[PAL.fire.length - 1];
const hipPt: [number, number] = [0, 0];
const headPt: [number, number] = [0, 0];
/** The time-out snore (rule 15), drawn at the sleeper's head. */
const SNORE_SPRITE = 'fx/snore';
const pt: [number, number] = [0, 0];
const rectScratch: Rect = { x: 0, y: 0, w: 0, h: 0 };
const hazardList: HazardDef[] = [];
/** Lethal hazard hits (they kill through invulnerability; only god mode protects). */
const HAZARD_HIT: Damage = { amount: 1e6, kind: 'impact', dirX: 0 };
const HAZARD_BURN: Damage = { amount: 1e6, kind: 'fire', dirX: 0 };

// Shared Animator options (filled per call, so animation changes never allocate).
const playOpts: PlayOpts = {};

/** Play once (non-looping); `restart` from `frame`. */
function once(restart: boolean, ticksPerFrame?: number, frame = 0): PlayOpts {
  playOpts.restart = restart;
  playOpts.loop = false;
  playOpts.ticksPerFrame = ticksPerFrame;
  playOpts.frame = frame;
  return playOpts;
}

/** Loop at a given speed (keeps running if already playing). */
function looping(ticksPerFrame?: number): PlayOpts {
  playOpts.restart = false;
  playOpts.loop = true;
  playOpts.ticksPerFrame = ticksPerFrame;
  playOpts.frame = 0;
  return playOpts;
}

/** Loop, restarting from the first frame. */
function loopFrom0(): PlayOpts {
  looping();
  playOpts.restart = true;
  return playOpts;
}
/** Reused trigger arguments (Gun.fire copies them into its context). */
const args: FireArgs = { x: 0, y: 0, angle: 0, facing: 1 };
/** A pad that is never pressed: the player's input while a status takes control away. */
const NO_INPUT = new VirtualPad();
const pitchOpts: { pitch: number } = { pitch: 1 };
const poofCircle = { x: 0, y: 0, r: 64 };

export class Player extends Entity {
  readonly index: SlotIndex;
  readonly slot: PlayerSlot;
  pad: VirtualPad;
  readonly character: CharacterDef;
  /** Sprite prefix ('char/recruit'). */
  readonly art: string;
  override body = new Body({ w: TUNING.player.bodyW, h: TUNING.player.bodyH });
  state: PlayerState = 'play';
  readonly status: StatusEffects;
  /** Main weapon trigger, bomb trigger, knife trigger. */
  readonly gun: Gun;
  readonly bombGun: Gun;
  readonly meleeGun: Gun;
  /** The vehicle being driven (state 'mounted'). */
  vehicle: Mountable | null = null;
  /**
   * Respawn point when no safe floor is in view near the death point (the mission runner
   * points this at the last checkpoint). Return the feet position, or null.
   */
  respawnAt: ((p: Player) => { x: number; y: number } | null) | null = null;
  /**
   * Section respawn rule, asked first (SectionDef.respawn; the runner sets it): return the floor
   * spot to drop onto (`y` Infinity = no floor, e.g. a flyer section), or null for the default.
   */
  respawnRule: ((p: Player) => { x: number; y: number } | null) | null = null;

  readonly legs = new Animator();
  readonly torso = new Animator();
  readonly full = new Animator();

  crouching = false;
  /** Aim elevation relative to the facing: −π/2 up … +π/2 down (current / wanted). */
  elev = 0;
  elevTarget = 0;
  /** Ticks since the last aim-sweep step (sweep weapons, GDD §4.3). */
  private sweepT = 0;
  /** How the player died last. */
  cause: DeathCause = 'bullet';
  /** Standing in shallow water. */
  wading = false;
  /**
   * The mission ended (or the boss died) while this player rode a vehicle: `victory()` keeps him
   * mounted, so an open-seat mount reads this to show `ride-cheer` (look.md §6.3).
   */
  cheering = false;

  private jumpBuffer = 0;
  private jumped = false;
  private standingJump = false;
  private landLock = 0;
  private landTicks = 0;
  /** Ticks to the next footstep sound (missions with `footsteps`; 0 = a step on the next run tick). */
  private stepT = 0;
  private shootTicks = 0;
  private action: 'none' | 'throw' | 'knife' = 'none';
  private actionTicks = 0;
  private deathTimer = 0;
  private remountTicks = 0;
  /** After leaving a vehicle: no new mount until the pilot has landed once. */
  private mountLock = false;
  /** Status-effect art variants (`<art>/<infix>-<anim>`) resolved per sprite id. */
  private altInfix = '';
  private readonly altIds = new Map<string, string>();
  private idleTicks = 0;
  /** Idle fidgets played so far (fidget-a / fidget-b alternate). */
  private fidgetCount = 0;
  /** Knife slashes so far (knife / knife-b alternate). */
  private knifeCount = 0;
  /** Legs playback rate this tick (strideRate while running / crouch-walking). */
  private legsRate = 1;
  /** Draw-only crouch transition: ticks left and direction (legs-crouch-in / -out). */
  private crouchT = 0;
  private crouchIn = true;
  /** Draw-only aim: steps toward `elev` one 45° step every 2 ticks (fwd -> diag -> up). */
  aimVis = 0;
  private aimVisT = 0;
  private spawnFloor = Infinity;
  /** The running drop-in is a continue (`continueGame`): its landing emits `continueLanded`. */
  private continued = false;
  /** Ticks left of the running-jump somersault (`<art>/flip`, draw-only; any action cancels it). */
  private flipT = 0;
  /** checkMount armed the Swan mount-hop; enterVehicle stores its start point and tick. */
  private hopArmed = false;
  private hopTick = -1;
  private hopX = 0;
  private hopY = 0;
  /** Draw-only pick-up flash (ticks left). */
  private pickupT = 0;
  /** Water surface of a drowning (die-drown is drawn on it). */
  private drownY = 0;
  /** Intro parachute drop: the floor to land on (Infinity = no drop) and the fall speed. */
  private dropFloor = Infinity;
  private dropVy = 0;
  /** Where and when the intro chute collapsed (draw-only). */
  private collapseTick = -1;
  private collapseX = 0;
  private collapseY = 0;
  private readonly legIds: Record<LegsAnim, string>;
  private readonly fullIds: Record<FullAnim, string>;
  private readonly rideIds: Record<RidePose, string>;
  private readonly torsoIds: Record<WeaponPose, Record<TorsoAction, string>>;

  constructor(world: World, x: number, y: number, o: PlayerOpts) {
    super(world, x, y);
    this.index = o.index ?? 0;
    this.slot = o.slot ?? sessionOf(world).slots[this.index];
    this.pad = o.pad;
    this.character = getCharacter(o.character ?? this.slot.character);
    this.art = this.character.art;
    this.type = 'player';
    this.team = 'player';
    this.z = 40;
    this.despawnMargin = Infinity;
    this.hitbox = { x: -TUNING.player.bodyW / 2, y: -TUNING.player.bodyH, w: TUNING.player.bodyW, h: TUNING.player.bodyH };
    this.status = new StatusEffects(this);
    this.legIds = Object.fromEntries(LEGS.map((n) => [n, `${this.art}/legs-${n}`])) as Record<LegsAnim, string>;
    this.fullIds = Object.fromEntries(FULL.map((n) => [n, `${this.art}/${n}`])) as Record<FullAnim, string>;
    this.rideIds = Object.fromEntries(RIDE_POSES.map((n) => [n, `${this.art}/ride-${n}`])) as Record<RidePose, string>;
    const torso = (pose: WeaponPose): Record<TorsoAction, string> =>
      Object.fromEntries(TORSO_ACTIONS.map((a) => [a, `${this.art}/torso-${pose}-${a}`])) as Record<TorsoAction, string>;
    this.torsoIds = { pistol: torso('pistol'), heavy: torso('heavy') };
    this.gun = new Gun(world, this, getWeapon(this.slot.weapon), 'player', this.index);
    this.bombGun = new Gun(world, this, this.bombDef, 'player', this.index);
    this.meleeGun = new Gun(world, this, this.meleeDef, 'player', this.index);
    this.addTag('player', 'shootable');
    this.legs.play(this.legIds.idle);
    this.torso.play(this.torsoIds.pistol.idle);
    world.events.on('pickup', (e) => {
      if (e.player === this) this.pickupT = TUNING.life.pickupFlashTicks;
    });
  }

  // ------------------------------------------------------------------------------- weapons

  /** Current main weapon (a status effect may override the slot's weapon). */
  get weapon(): WeaponDef {
    return getWeapon(this.status.weapon ?? this.slot.weapon);
  }

  get bombDef(): WeaponDef {
    const id = this.slot.bombType || this.character.stats?.bomb || 'grenade';
    return hasWeapon(id) ? getWeapon(id) : BUILTIN_GRENADE;
  }

  get meleeDef(): WeaponDef {
    const id = this.character.stats?.melee ?? 'knife';
    return hasWeapon(id) ? getWeapon(id) : BUILTIN_KNIFE;
  }

  /** Weapon the player starts each life with. */
  get startWeapon(): string {
    return this.character.stats?.weapon ?? 'pistol';
  }

  /** Grenades at each life start: the character's number, else the difficulty's (10, EASY 15). */
  get startBombs(): number {
    return this.character.stats?.bombs ?? difficultyOf(this.world).grenades;
  }

  /**
   * Give a weapon: the same weapon again adds `ammoAgain` (or `ammo`), a different one replaces
   * the current weapon. Shows the name in the HUD and plays the weapon's announcer line.
   */
  giveWeapon(id: string, ammo?: number, announce = true): void {
    const def = getWeapon(id);
    const s = this.slot;
    const max = def.maxAmmo ?? TUNING.weapons.maxAmmo;
    const mul = this.character.stats?.ammo ?? 1;
    const again = s.weapon === def.id && def.ammo !== Infinity;
    if (def.ammo === Infinity) {
      s.weapon = def.id;
      s.ammo = Infinity;
    } else if (s.weapon === def.id) {
      s.ammo = Math.min(max, s.ammo + Math.round((ammo ?? def.ammoAgain ?? def.ammo) * mul));
    } else {
      s.weapon = def.id;
      s.ammo = Math.min(max, Math.round((ammo ?? def.ammo) * mul));
    }
    this.gun.setWeapon(this.weapon);
    this.gun.lock = 0;
    this.pickupT = TUNING.life.pickupFlashTicks;
    this.world.events.emit('weaponChanged', { player: this, slot: this.index, weapon: def.id });
    if (announce) {
      hudOf(this.world).message(this.index, def.name);
      const line = again ? (def.voiceAgain ?? `MORE ${def.name}!`) : def.voice;
      if (line) this.world.audio.voice(line);
    }
  }

  /** Add bombs (capped). */
  addBombs(n: number): void {
    this.slot.bombs = clamp(this.slot.bombs + n, 0, TUNING.grenade.cap);
  }

  /** Extra lives (capped at 9 in reserve). Returns how many were added. */
  addLife(n = 1): number {
    return this.slot.addLife(n);
  }

  /** Play a sound of this player (status effects may pitch it: Helium Head × 1.6). */
  sfx(id: string): void {
    const pitch = this.status.sfxPitch;
    if (pitch === 1) this.world.audio.sfx(id);
    else {
      pitchOpts.pitch = pitch;
      this.world.audio.sfx(id, pitchOpts);
    }
  }

  /** The input this tick (no buttons while a status takes control away, e.g. a dizzy spin). */
  private get input(): VirtualPad {
    return this.status.noControl ? NO_INPUT : this.pad;
  }

  /**
   * The sprite id to use for `id` under the active status art (`char/x/legs-run` →
   * `char/x/helium-legs-run` while Helium Head is on), when that variant is registered.
   */
  private alt(id: string): string {
    const infix = this.status.art;
    if (!infix) return id;
    if (infix !== this.altInfix) {
      this.altIds.clear();
      this.altInfix = infix;
    }
    let a = this.altIds.get(id);
    if (a === undefined) {
      const slash = id.lastIndexOf('/');
      const cand = `${id.slice(0, slash + 1)}${infix}-${id.slice(slash + 1)}`;
      a = hasSprite(cand) ? cand : id;
      this.altIds.set(id, a);
    }
    return a;
  }

  /** Points for this player (with a floating-score position). */
  addScore(points: number): void {
    awardScore(this.world, this.index, points, this.x, this.y - 40);
  }

  // ------------------------------------------------------------------------------- state queries

  get mounted(): boolean {
    return this.state === 'mounted';
  }

  /** Can take input and act (alive and on foot). */
  get controllable(): boolean {
    return this.state === 'play';
  }

  get onGround(): boolean {
    return this.body.onGround;
  }

  /** Throwing or knifing (the torso is busy). */
  get busy(): boolean {
    return this.actionTicks > 0;
  }

  get aim(): AimDir {
    return aimDirOf(this.elev);
  }

  /** Current aim angle in world space (radians). */
  get aimAngle(): number {
    return aimAngle(this.facing, this.elev);
  }

  // ------------------------------------------------------------------------------- tick

  override update(): void {
    if (this.state !== 'out') this.status.update();
    if (this.remountTicks > 0) this.remountTicks--;
    if (this.pickupT > 0) this.pickupT--;
    if (this.flipT > 0) this.flipT--;
    if (this.crouchT > 0) this.crouchT--;
    switch (this.state) {
      case 'play':
        this.updatePlay();
        break;
      case 'spawn':
        this.updateSpawn();
        break;
      case 'dead':
        this.updateDead();
        break;
      case 'victory':
        this.updateVictory();
        break;
      case 'mounted':
      case 'out':
        break;
    }
    this.legs.update(this.legsRate);
    this.legsRate = 1;
    this.torso.update();
    this.full.update();
  }

  private updatePlay(): void {
    const T = TUNING.player;
    const pad = this.input;
    const st = this.status;
    const b = this.body;
    let ax = pad.axisX() as number;
    if (st.invert) ax = -ax;
    const up = pad.held('up');
    const down = pad.held('down') && !up;
    const speedMul = st.speed * (this.character.stats?.speed ?? 1) * (this.wading ? 0.75 : 1);

    // Crouch on the ground while down is held (stays crouched under a low ceiling).
    this.setCrouch(b.onGround && down && !st.noCrouch);

    // Horizontal movement: near-instant on the ground (slippery on ice), momentum + air control
    // in the air.
    if (b.onGround) {
      const top = (this.crouching ? T.crawlSpeed : T.runSpeed) * speedMul;
      if (ax !== 0) this.facing = ax as 1 | -1;
      // Diagonal aim (up + left/right) plants the feet: the side only turns the player.
      const move = up && !this.crouching ? 0 : ax;
      const ice = iceAt(this.world, this.x);
      const braking = move === 0 || move * this.vx < 0;
      this.vx = approach(this.vx, move * top, ice ? (braking ? T.iceDecel : T.iceAccel) : T.runAccel);
    } else if (ax !== 0) {
      this.facing = ax as 1 | -1;
      const top = T.airMaxSpeed * speedMul;
      if (this.vx * ax < top) this.vx = approach(this.vx, ax * top, T.airAccel);
    }

    // Jump: buffered presses, coyote time, drop-through with down + jump (never into deep water:
    // over a water rect down + jump is a normal jump, GDD §4.2).
    if (pad.pressed('jump')) this.jumpBuffer = T.jumpBufferTicks;
    if (this.jumpBuffer > 0) {
      if (down && b.onGround && b.onOneWay && !this.overWater()) {
        this.jumpBuffer = 0;
        this.setCrouch(false);
        dropThrough(this);
        // Dropping counts as a jump: no coyote jump back up while falling through.
        this.jumped = true;
      } else if (!st.noJump && !this.jumped && b.ticksSinceGrounded <= T.coyoteTicks) {
        this.doJump(speedMul);
      } else this.jumpBuffer--;
    }
    if (b.onGround && this.vy >= 0) this.jumped = false;

    // Standing jumps hang a little at the apex (mechanics.md §2). Status effects can change
    // gravity, and float a falling player while jump is held (Helium Head).
    const hang = this.standingJump && !b.onGround && Math.abs(this.vy) < T.apexHangVy;
    const floating = !b.onGround && this.vy > 0 && pad.held('jump');
    b.gravity = floating && st.fallGravity !== null ? st.fallGravity : TUNING.physics.gravity * st.gravity * (hang ? T.apexHangGravity : 1);
    b.maxFall = floating && st.maxFall !== null ? st.maxFall : TUNING.physics.maxFall;

    if (this.dropFloor !== Infinity) this.vy = this.dropVy;
    const c = moveBody(this, this.world.terrain, this.world);
    if (c.landed) this.onLanded();
    else if (this.dropFloor !== Infinity && this.y >= this.dropFloor) this.landDrop();
    this.clampToView();
    if (this.checkHazards()) return;

    this.updateAim(up, down, ax);
    this.updateAimVis();
    // The legs strip first: shots leave from the hip of THIS tick's pose (crouch + fire together).
    const legs = this.updateLegs(ax);
    this.footsteps(legs);
    this.updateArms();
    if (this.state !== 'play') return;
    this.checkMount();
    this.updateTorso(legs);
    if (this.landLock > 0) this.landLock--;
    if (this.landTicks > 0) this.landTicks--;
  }

  private doJump(speedMul: number): void {
    const T = TUNING.player;
    this.jumpBuffer = 0;
    this.jumped = true;
    // Stand up for the jump only where the head has room (in a crouch tunnel: a crouched hop).
    if (this.crouching) this.setCrouch(false);
    this.standingJump = Math.abs(this.vx) < 0.2;
    if (!this.standingJump) {
      const top = T.airMaxSpeed * speedMul;
      this.vx = Math.sign(this.vx) * Math.min(top, Math.abs(this.vx) * T.takeoffBoost);
    }
    jump(this, T.jumpVelocity * this.status.jump * (this.character.stats?.jump ?? 1));
    this.legs.play(this.alt(this.legIds.jump), once(true));
    if (!this.standingJump) this.startFlip();
    this.sfx('player/jump');
  }

  /** The somersault of a running jump / vehicle bail (draw-only; not under a status art). */
  private startFlip(): void {
    const id = this.fullIds.flip;
    if (this.status.art || !hasSprite(id)) return;
    this.flipT = stripTicks(id);
    this.full.play(id, once(true));
  }

  /**
   * Is there deep water under the feet (a 'water' rect below them with no ground above its
   * surface)? Lily pads, jetties, floats and the pontoon stand over such water (GDD §4.2).
   */
  private overWater(): boolean {
    const surface = waterSurfaceAt(this, this.x, this.y);
    return Number.isFinite(surface) && this.world.terrain.groundY(this.x) >= surface;
  }

  /** Ticks of the landing legs (`legs-land` strip length; 6 without art). */
  private landLength(): number {
    const id = this.alt(this.legIds.land);
    return hasSprite(id) ? stripTicks(id) : 6;
  }

  private onLanded(): void {
    this.flipT = 0;
    this.jumped = false;
    this.standingJump = false;
    this.landLock = TUNING.player.landFireLockTicks;
    this.landTicks = this.landLength();
    this.mountLock = false;
    dust(this.world, this.x, this.y, 2);
    this.sfx('player/land');
  }

  /**
   * Crouch / stand up. Standing up needs head room unless `force`. Returns the new state.
   * Only the height of the collision body changes (its width stays `bodyW`, so crouching next to
   * a wall never pushes the body into it); the hurtbox uses the crouch size (16×20).
   */
  setCrouch(on: boolean, force = false): boolean {
    if (on === this.crouching) return on;
    if (!on && !force && !this.canStand()) return true;
    const T = TUNING.player;
    this.crouching = on;
    const tr = on ? this.legIds['crouch-in'] : this.legIds['crouch-out'];
    this.crouchIn = on;
    this.crouchT = !force && this.body.onGround && !this.status.art && hasSprite(tr) ? stripTicks(tr) : 0;
    const w = on ? T.crouchBodyW : T.bodyW;
    const h = on ? T.crouchBodyH : T.bodyH;
    this.body.w = T.bodyW;
    this.body.h = h;
    this.hitbox.x = -w / 2;
    this.hitbox.y = -h;
    this.hitbox.w = w;
    this.hitbox.h = h;
    return on;
  }

  /** Room for the standing body above the feet? */
  private canStand(): boolean {
    const T = TUNING.player;
    const x0 = this.x - T.bodyW / 2;
    const x1 = this.x + T.bodyW / 2;
    const y0 = this.y - T.bodyH;
    const y1 = this.y - T.crouchBodyH;
    if (this.world.terrain.solidOverlaps(x0, y0, x1, y1)) return false;
    const solids = this.world.solids;
    for (let i = 0; i < solids.length; i++) {
      const s = solids[i];
      if (!s.enabled || s.oneWay || s.owner === this) continue;
      if (x0 < s.x + s.w && x1 > s.x && y0 < s.y + s.h && y1 > s.y) return false;
    }
    return true;
  }

  /**
   * The view edges are walls. A moving edge (a lock easing in, auto-scroll) pushes the player like
   * walking: up slopes and steps, never into terrain (pushX stops at walls).
   */
  private clampToView(): void {
    const cam = this.world.camera;
    const dx = cam.clampX(this.x, this.body.w / 2) - this.x;
    if (dx !== 0) {
      pushX(this, dx, this.world.terrain, this.world);
      if (dx * this.vx < 0) this.vx = 0; // running into the edge, like a wall
    }
    if (cam.scroll === 'up' && this.y > cam.bottom + TUNING.player.fallOutMargin) this.kill('pit');
  }

  /**
   * Pits, spikes, lava, kill zones, water (GDD §4.2). They kill through invulnerability and
   * status shields; only debug god mode protects (pits and deep water kill even then).
   * Returns true when the player died.
   */
  private checkHazards(): boolean {
    const t = this.world.terrain;
    if (t.hazards.length === 0) {
      this.wading = false;
      return false;
    }
    hazardList.length = 0;
    t.hazardsAt(this.hitRect(rectScratch), hazardList);
    let wading = false;
    const god = this.world.god;
    for (const h of hazardList) {
      switch (h.kind) {
        case 'pit':
          if (this.y > h.y + 4) return this.kill('pit');
          break;
        case 'water':
          // Deep water = the surface above a STANDING head (crouching in knee-deep water is safe).
          if (h.y <= this.y - TUNING.player.bodyH + 2) {
            this.drownY = h.y;
            return this.kill('drown');
          }
          wading = true;
          break;
        case 'spikes':
        case 'kill':
          if (!god) return this.kill('impact', HAZARD_HIT);
          break;
        case 'lava':
          if (!god) return this.kill('fire', HAZARD_BURN);
          break;
      }
    }
    if (wading && !this.wading) {
      splash(this.world, this.x, this.y, 6);
      this.sfx('player/splash');
    }
    this.wading = wading;
    return false;
  }

  // ------------------------------------------------------------------------------- aiming & arms

  /**
   * Aim rule (GDD §4.3): up + left/right aims 45° up (the player keeps walking), up alone aims
   * straight up, down in the air aims straight down. Crouched, up stands the player up first.
   */
  private updateAim(up: boolean, down: boolean, ax: number): void {
    this.elevTarget = up && !this.crouching ? (ax !== 0 ? -QUARTER_PI : -HALF_PI) : down && !this.body.onGround ? HALF_PI : 0;
    const sweeping = this.weapon.sweep === true && this.gun.active(this.input.held('fire'));
    if (!sweeping || this.elev === this.elevTarget) {
      this.elev = this.elevTarget;
      this.sweepT = 0;
      return;
    }
    // Aim sweep (GDD §4.3): while a sweep weapon fires, the gun turns one 22.5° step every
    // `sweepTicks` toward the held aim (forward → up in 8 ticks); rounds fired meanwhile leave
    // at the in-between angles.
    if (++this.sweepT >= TUNING.fire.sweepTicks) {
      this.sweepT = 0;
      this.elev = approach(this.elev, this.elevTarget, TUNING.fire.sweepStep);
    }
  }

  /** Draw-only aim (rule 11): one 45° step toward `elev` now, then one every 2 ticks. */
  private updateAimVis(): void {
    if (this.aimVis === this.elev) {
      this.aimVisT = 0;
      return;
    }
    if (this.aimVisT > 0) {
      this.aimVisT--;
      return;
    }
    this.aimVis = approach(this.aimVis, this.elev, QUARTER_PI);
    this.aimVisT = this.aimVis === this.elev ? 0 : 1;
  }

  /** An action cancels every cosmetic transition (control first). */
  private cancelCosmetic(): void {
    this.flipT = 0;
    this.crouchT = 0;
    this.aimVis = this.elev;
    this.aimVisT = 0;
  }

  private updateArms(): void {
    const pad = this.input;
    const st = this.status;
    const busy = this.actionTicks > 0;
    this.gun.setWeapon(this.weapon);
    this.bombGun.setWeapon(this.bombDef);
    this.gun.pitch = this.bombGun.pitch = this.meleeGun.pitch = st.sfxPitch;
    if (!st.noFire && pad.pressed('fire')) this.gun.press();
    if (!st.noBomb && pad.pressed('bomb')) this.bombGun.press();
    // Fire next to a knifeable target always means the knife (GDD §4.4): a press made during a
    // slash waits for the knife to be ready instead of coming out as a point-blank shot.
    const knifeReach = !st.noFire && this.knifeTargetInReach();
    this.gun.tick(busy || (knifeReach && this.gun.pending));
    this.bombGun.tick(busy);
    this.meleeGun.tick();
    if (this.shootTicks > 0) this.shootTicks--;
    if (this.actionTicks > 0) {
      if (--this.actionTicks === 0) this.action = 'none';
      return;
    }
    if (this.landLock <= 0 && !st.noFire) {
      if (knifeReach) {
        // A press or a held trigger (hold = repeat at the knife's own rate); never the gun.
        if (this.meleeGun.ready && (this.gun.pending || pad.held('fire'))) {
          this.gun.buffer = 0;
          this.gun.burstLeft = 0;
          this.knife();
          return;
        }
      } else if (this.gun.wants(pad.held('fire'))) this.shoot();
    }
    if (this.bombGun.pending) {
      if (this.slot.bombs <= 0) {
        this.bombGun.buffer = 0;
        this.sfx('weapon/empty');
      } else if (this.bombGun.wants(false)) this.throwBomb();
    }
  }

  private shoot(): void {
    const def = this.gun.def;
    const m = this.muzzleWorld(pt);
    this.gun.fire(this.fireArgs(m[0], m[1], aimAngle(this.facing, this.elev), aimDirOf(this.elev)));
    this.slot.stats.shots++;
    this.cancelCosmetic();
    this.shootTicks = TUNING.fire.shootAnimTicks * 2;
    this.torso.play(this.drawTorsoId(this.aimAction(true)), once(true, TUNING.fire.shootAnimTicks));
    // Ammo (status-effect weapons are free).
    if (def.ammo !== Infinity && !this.status.weapon) {
      this.slot.ammo -= def.ammoPerShot ?? 1;
      if (this.slot.ammo <= 0) this.outOfAmmo();
    }
  }

  /** The special weapon ran dry: back to the start weapon, which takes a moment to draw. */
  private outOfAmmo(): void {
    this.slot.weapon = this.startWeapon;
    this.slot.ammo = Infinity;
    this.gun.setWeapon(this.weapon);
    this.gun.lock = TUNING.fire.drawTicks;
    this.gun.reset();
    this.sfx('weapon/empty');
    this.world.events.emit('weaponChanged', { player: this, slot: this.index, weapon: this.slot.weapon });
  }

  private knifeBox(): Rect {
    const def = this.meleeDef;
    const box: MeleeBox = def.melee ?? BUILTIN_KNIFE.melee!;
    return meleeBox(this.x, this.y, this.facing, this.body.w, box, this.crouching, rectScratch);
  }

  /** A soft enemy (or slow projectile) inside the knife box. */
  knifeTargetInReach(): boolean {
    return meleeTargetIn(this.world, this.knifeBox(), 'player');
  }

  private knife(): void {
    const box = this.knifeBox();
    this.meleeGun.setWeapon(this.meleeDef);
    this.meleeGun.fire(this.fireArgs(box.x + box.w / 2, box.y + box.h / 2, this.facing > 0 ? 0 : Math.PI, 'forward'));
    this.action = 'knife';
    this.cancelCosmetic();
    this.actionTicks = TUNING.fire.knifeTicks;
    // Alternate slashes (rule 12): knife, knife-b, knife … by a per-player counter.
    const id = this.drawTorsoId(this.knifeCount++ % 2 === 1 ? 'knife-b' : 'knife');
    this.torso.play(id, once(true, Math.max(1, Math.floor(TUNING.fire.knifeTicks / Math.max(1, frameCount(id))))));
  }

  private throwBomb(): void {
    const h = this.handWorld(pt);
    // Bombs keep the high 'up' lob whenever up is held (also with up + forward, GDD §4.3).
    const elev = this.elevTarget < 0 ? -HALF_PI : this.elevTarget;
    this.bombGun.fire(this.fireArgs(h[0], h[1], aimAngle(this.facing, elev), aimDirOf(elev)));
    this.slot.bombs--;
    this.slot.stats.bombsThrown++;
    this.action = 'throw';
    this.cancelCosmetic();
    this.actionTicks = TUNING.fire.throwTicks;
    // The bomb leaves at once (input never waits), so the animation starts at the release frame
    // (of the drawn strip; the bomb itself leaves from the standing strip's hand, handWorld).
    const id = this.drawTorsoId('throw');
    const release = releaseFrame(id);
    const n = Math.max(1, frameCount(id) - release.index);
    this.torso.play(id, once(true, Math.max(1, Math.floor(TUNING.fire.throwTicks / n)), release.index));
    this.sfx('bomb/throw');
  }

  /** Fill the shared trigger arguments for a shot / throw / stab from (x, y). */
  private fireArgs(x: number, y: number, angle: number, aim: AimDir): FireArgs {
    args.x = x;
    args.y = y;
    args.angle = angle;
    args.facing = this.facing;
    args.aim = aim;
    args.crouching = this.crouching;
    args.airborne = !this.body.onGround;
    args.vx = this.vx;
    args.vy = this.vy;
    return args;
  }

  // ------------------------------------------------------------------------------- body points

  private get pose(): WeaponPose {
    return this.weapon.pose === 'heavy' ? 'heavy' : 'pistol';
  }

  private torsoId(action: TorsoAction): string {
    return this.alt(this.torsoIds[this.pose][action]);
  }

  /**
   * The torso strip the animator plays for `action` (draw-only twins): crouched twins while
   * crouching, the alternate knife; under a status art (Helium) or without the twin's art, the
   * base action's (status) strip. Gameplay points (muzzleWorld, handWorld) keep `torsoId`.
   */
  private drawTorsoId(action: TorsoAction): string {
    const ids = this.torsoIds[this.pose];
    const art = this.status.art !== '';
    let a = action;
    if (this.crouching) a = CROUCH_TWIN[a] ?? a;
    if (a !== action && (art || !hasSprite(ids[a]))) a = action;
    const base = BASE_ACTION[a];
    if (base && (art || !hasSprite(ids[a]))) a = base;
    return this.torsoId(a);
  }

  private aimAction(shooting: boolean, elev = this.elev): TorsoAction {
    const a = Math.abs(elev);
    if (a >= DIAG_MIN && a <= DIAG_MAX) {
      const up = elev < 0;
      const diag: TorsoAction = up ? (shooting ? 'shoot-diag-up' : 'diag-up') : shooting ? 'shoot-diag-down' : 'diag-down';
      if (hasSprite(this.torsoIds[this.pose][diag])) return diag;
    }
    const d = aimDirOf(elev);
    if (d === 'up') return shooting ? 'shoot-up' : 'up';
    if (d === 'down') return shooting ? 'shoot-down' : 'down';
    return shooting ? 'shoot' : 'idle';
  }

  /** Hip position relative to the feet (from the current legs frame). */
  private hip(out: [number, number]): [number, number] {
    const flip = this.facing < 0;
    const p = this.legs.id ? framePoint(getFrame(this.legs.id, this.legs.index), 'hip', flip, false, out) : undefined;
    if (p) return p;
    const f = this.crouching ? TUNING.player.fallbackHipCrouch : TUNING.player.fallbackHip;
    out[0] = flip ? -f[0] : f[0];
    out[1] = f[1];
    return out;
  }

  /** World position of the gun muzzle for the current aim. */
  muzzleWorld(out: [number, number] = [0, 0]): [number, number] {
    const flip = this.facing < 0;
    const hip = this.hip(hipPt);
    const f = getFrame(this.torsoId(this.aimAction(true)), 0);
    let m = framePoint(f, 'muzzle', flip, false, out);
    if (!m) {
      const d = aimDirOf(this.elev);
      const T = TUNING.player;
      const fb = d === 'up' ? T.fallbackMuzzleUp : d === 'down' ? T.fallbackMuzzleDown : T.fallbackMuzzle;
      out[0] = fb[0];
      out[1] = fb[1];
      // No diagonal frame: halfway between the forward and the up / down muzzle.
      const a = Math.abs(this.elev);
      if (a >= DIAG_MIN && a <= DIAG_MAX) {
        const o = this.elev < 0 ? T.fallbackMuzzleUp : T.fallbackMuzzleDown;
        out[0] = Math.round((T.fallbackMuzzle[0] + o[0]) / 2);
        out[1] = Math.round((T.fallbackMuzzle[1] + o[1]) / 2);
      }
      if (flip) out[0] = -out[0];
      m = out;
    }
    out[0] = this.x + hip[0] + m[0];
    out[1] = this.y + hip[1] + m[1];
    return out;
  }

  /** World position of the throwing hand at the moment of release. */
  handWorld(out: [number, number] = [0, 0]): [number, number] {
    const flip = this.facing < 0;
    const hip = this.hip(hipPt);
    const r = releaseFrame(this.torsoId('throw'));
    const h = r.hand ?? TUNING.player.fallbackHand;
    out[0] = this.x + hip[0] + (flip ? -h[0] : h[0]);
    out[1] = this.y + hip[1] + h[1];
    return out;
  }

  // ------------------------------------------------------------------------------- vehicles

  private checkMount(): void {
    if (this.remountTicks > 0 || this.mountLock || this.status.noMount) return;
    const list = this.world.byTag('vehicle');
    for (let i = 0; i < list.length; i++) {
      const v = list[i];
      if (v.alive && isMountable(v) && v.canMount(this)) {
        // Only the Swan has a mount-hop (start and carried vehicles never come through here).
        this.hopArmed = v.hasTag('swan') && hasSprite(this.fullIds['mount-hop']);
        v.mount(this);
        this.hopArmed = false;
        return;
      }
    }
  }

  /** Called by a vehicle when this player climbs in. */
  enterVehicle(v: Mountable, invuln: number = TUNING.vehicle.mountInvulnTicks): void {
    this.state = 'mounted';
    this.vehicle = v;
    this.flipT = 0;
    this.endDrop(false);
    this.hopTick = this.hopArmed ? this.world.tick : -1;
    this.hopX = this.x;
    this.hopY = this.y;
    this.hopArmed = false;
    this.setCrouch(false, true);
    this.vx = 0;
    this.vy = 0;
    this.body.collide = false;
    this.body.onGround = false;
    this.removeTag('shootable');
    this.gun.reset();
    this.bombGun.reset();
    this.action = 'none';
    this.actionTicks = 0;
    this.invulnTicks = Math.max(this.invulnTicks, invuln);
  }

  /** Called by a vehicle when this player leaves it. */
  leaveVehicle(o: DismountOpts): void {
    this.state = 'play';
    this.vehicle = null;
    this.x = this.prevX = o.x;
    this.y = this.prevY = o.y;
    this.vx = o.vx ?? 0;
    this.vy = o.vy ?? TUNING.vehicle.ejectVy;
    this.body.collide = true;
    this.body.onGround = false;
    this.jumped = true;
    this.standingJump = false;
    this.addTag('shootable');
    this.invulnTicks = Math.max(this.invulnTicks, o.invuln ?? TUNING.vehicle.ejectInvulnTicks);
    this.remountTicks = TUNING.vehicle.remountTicks;
    this.mountLock = true;
    this.hopTick = -1;
    this.legs.play(this.alt(this.legIds.jump), once(true));
    this.startFlip();
  }

  /** Draw the seated driver (the vehicle calls this with its 'seat' point). */
  drawSeated(r: Renderer, x: number, y: number, flipX: boolean): void {
    if (this.invulnTicks > 0 && Math.floor(this.world.tick / TUNING.life.respawnBlinkTicks) % 2 === 1) return;
    drawOpts.flipX = flipX;
    drawOpts.flash = false;
    r.sprite(this.alt(this.fullIds.mount), Math.floor(this.world.tick / 16), Math.round(x), Math.round(y), drawOpts);
  }

  /**
   * Draw the rider of an open-seat mount (the Swan, look.md §6.5): `<art>/ride-<pose>` with its hip
   * on (x, y) — the mount's 'seat' point. `frame` omitted = the strip's own timing on `world.tick`.
   * Blinks while invulnerable, like `drawSeated`. Missing art falls back to `ride-sit`, then to
   * `mount` frame 1 drawn 17 px lower (its hip point is (0, −17)).
   */
  drawRide(r: Renderer, x: number, y: number, flipX: boolean, pose: RidePose, frame?: number): void {
    drawOpts.flash = false;
    // The hop never blinks: the mount invulnerability (20 ticks) would hide half of its frames.
    if (this.hopTick >= 0 && this.drawHop(r, x, y, flipX)) return;
    if (this.invulnTicks > 0 && Math.floor(this.world.tick / TUNING.life.respawnBlinkTicks) % 2 === 1) return;
    drawOpts.flipX = flipX;
    let id = this.rideIds[pose] ?? this.rideIds.sit;
    if (!hasSprite(id)) id = this.rideIds.sit;
    if (hasSprite(id)) {
      // Unrounded: the Swan passes her own (sub-pixel) position plus the seat point.
      r.sprite(id, frame ?? stripFrame(id, this.world.tick), x, y, drawOpts);
      return;
    }
    r.sprite(this.fullIds.mount, 1, x, y + MOUNT_HIP_DROP, drawOpts);
  }

  /**
   * The Swan mount-hop (draw-only): `<art>/mount-hop` from the boarding spot toward the CURRENT
   * seat (hip) point, eased, so a moving Swan never leaves him behind. The last frame's `hip`
   * lands on the seat. Returns false when the hop is over (then the ride pose draws).
   */
  private drawHop(r: Renderer, x: number, y: number, flipX: boolean): boolean {
    const id = this.fullIds['mount-hop'];
    const age = this.world.tick - this.hopTick;
    const total = hasSprite(id) ? stripTicks(id) : 0;
    if (age < 0 || age >= total) {
      this.hopTick = -1;
      return false;
    }
    const n = frameCount(id);
    const hip = framePoint(getFrame(id, n - 1), 'hip', flipX, false, pt);
    // Feet target: the seat hip minus the last frame's hip offset (mirrored when flipped).
    const tx = x - (hip ? hip[0] : 0);
    const ty = y - (hip ? hip[1] : 0);
    const t = age / total;
    const e = t * t * (3 - 2 * t);
    // Up and over the hull, then down into the seat (a straight line would pass through her body).
    const lift = HOP_ARC * 4 * t * (1 - t);
    drawOpts.flipX = flipX;
    r.sprite(id, onceFrame(id, age), this.hopX + (tx - this.hopX) * e, this.hopY + (ty - this.hopY) * e - lift, drawOpts);
    return true;
  }

  // ------------------------------------------------------------------------------- damage & death

  /** One hit kills, unless invulnerable (crush kills anyway) or a status effect absorbs it. */
  override onHit(d: Damage): boolean {
    if (this.state !== 'play' && this.state !== 'spawn') return false;
    if (this.invulnTicks > 0 && d.kind !== 'crush') return false;
    if (this.status.onHit(d)) return true;
    this.kill(d.kind, d);
    return true;
  }

  override die(d?: Damage): void {
    this.kill(d?.kind ?? 'impact', d);
  }

  /** Kill the player now (pits and time-outs call this directly; it ignores invulnerability). */
  kill(cause: DeathCause, d?: Damage): boolean {
    if (this.state === 'dead' || this.state === 'out' || this.state === 'victory') return false;
    if (this.state === 'mounted') return false; // the vehicle protects its driver
    this.state = 'dead';
    this.dead = true;
    this.cause = cause;
    this.flipT = 0;
    this.endDrop();
    this.deathTimer = cause === 'pit' ? TUNING.life.pitDeathTicks : TUNING.life.deathAnimTicks;
    this.setCrouch(false, true);
    this.status.clear();
    this.gun.reset();
    this.bombGun.reset();
    this.action = 'none';
    this.actionTicks = 0;
    this.body.gravity = TUNING.physics.gravity;
    this.body.maxFall = TUNING.physics.maxFall;
    if (cause === 'explosion' && d) {
      this.vx = (d.dirX || -this.facing) * 1;
      jump(this, -2.2);
    } else this.vx = 0;
    if (cause === 'drown') {
      splash(this.world, this.x, Math.min(this.y - 8, this.drownY || this.y), 12);
      this.sfx('player/splash');
    }
    this.full.play(this.deathAnim(cause), once(true));
    // Time-out (rule 15): yawn, then two sleep loops before the respawn.
    if (this.full.id === this.fullIds['timeout-yawn']) {
      const sleep = this.fullIds['timeout-sleep'];
      this.deathTimer = stripTicks(this.full.id) + (hasSprite(sleep) ? 2 * stripTicks(sleep) : 0);
    }
    // The hostage tally drops by the difficulty rule (GDD §4.10: EASY keeps the checkpoint count).
    const keep = difficultyOf(this.world).hostageLoss === 'checkpoint' ? this.slot.checkpointRescued : 0;
    this.slot.loseLife(keep);
    this.sfx(cause === 'timeout' ? 'player/yawn' : 'player/die');
    this.world.events.emit('playerDied', { player: this, slot: this.index, cause });
    return true;
  }

  /** Death animation by cause: burn for fire, the soot look for explosions (when drawn). */
  private deathAnim(cause: DeathCause): string {
    const burn = this.alt(this.fullIds['die-burn']);
    const blast = this.alt(this.fullIds['die-blast']);
    if (cause === 'fire' && hasSprite(burn)) return burn;
    if (cause === 'explosion' && hasSprite(blast)) return blast;
    if (cause === 'drown' && hasSprite(this.fullIds['die-drown'])) return this.fullIds['die-drown'];
    if (cause === 'crush' && hasSprite(this.fullIds['die-flat'])) return this.fullIds['die-flat'];
    if (cause === 'timeout' && hasSprite(this.fullIds['timeout-yawn'])) return this.fullIds['timeout-yawn'];
    return this.alt(this.fullIds.die);
  }

  private updateDead(): void {
    if (this.continueDrop()) {
      // Killed while dropping in (time-out, crush): the body still lands on the chosen floor.
    } else if (this.cause !== 'pit' && this.cause !== 'drown' && this.y < this.world.terrain.killY) {
      const c = moveBody(this, this.world.terrain, this.world);
      if (c.onGround) this.vx = 0;
    }
    const yawn = this.fullIds['timeout-yawn'];
    if (this.full.id === yawn && this.full.done && hasSprite(this.fullIds['timeout-sleep'])) {
      this.full.play(this.fullIds['timeout-sleep'], loopFrom0());
    }
    if (--this.deathTimer > 0) return;
    if (this.slot.lives > 0) this.respawn();
    else {
      this.state = 'out';
      this.slot.gameOver = true;
      this.world.events.emit('playerOut', { player: this, slot: this.index });
    }
  }

  /** Below the world: pits kill (even when invulnerable); dead bodies just stay there. */
  override onOutOfWorld(): void {
    if (this.state === 'play' || this.state === 'spawn' || this.state === 'victory') this.kill('pit');
  }

  /** Crushed by a moving solid: lethal even when invulnerable (unless driving). */
  override onCrushed(): void {
    if (this.state === 'mounted') return;
    this.kill('crush');
  }

  // ------------------------------------------------------------------------------- (re)spawning

  /** Put the player at (x, y) on the floor, ready to play (section start). */
  placeAt(x: number, y: number, invuln = 60): void {
    this.x = this.prevX = x;
    this.y = this.prevY = y;
    this.vx = 0;
    this.vy = 0;
    this.dead = false;
    this.state = 'play';
    this.body.collide = true;
    settle(this, this.world.terrain, this.world);
    this.invulnTicks = Math.max(this.invulnTicks, invuln);
    this.addTag('shootable');
  }

  /**
   * Drop in from the top of the view near the last position (the nearest spot in view with a
   * floor and no hazard; else `respawnAt`, e.g. the last checkpoint), with blinking
   * invulnerability. A new life starts with the start weapon and bombs.
   */
  respawn(): void {
    const L = TUNING.life;
    const cam = this.world.camera;
    const spot =
      this.respawnRule?.(this) ?? this.safeSpot(clamp(this.x, cam.left + L.respawnEdge, cam.right - L.respawnEdge)) ?? this.respawnAt?.(this) ?? null;
    const x = spot ? spot.x : cam.centerX;
    const floor = spot ? spot.y : Infinity;
    this.x = this.prevX = x;
    this.y = this.prevY = Math.min(cam.top - L.respawnHeight, Number.isFinite(floor) ? floor - 8 : cam.top);
    this.spawnFloor = floor;
    this.vx = 0;
    this.vy = L.respawnFallSpeed;
    this.facing = 1;
    this.dead = false;
    this.flipT = 0;
    this.endDrop(false);
    this.state = 'spawn';
    this.body.collide = !Number.isFinite(floor);
    this.setCrouch(false, true);
    this.slot.resetLife(this.startBombs, this.startWeapon);
    this.gun.setWeapon(this.weapon);
    this.gun.reset();
    this.gun.lock = 0;
    this.elev = this.elevTarget = 0;
    this.aimVis = 0;
    this.invulnTicks = L.respawnInvulnTicks + L.respawnDropTicks;
    this.addTag('shootable');
    if (hasSprite(this.fullIds.spawn)) this.full.play(this.alt(this.fullIds.spawn), once(true));
    this.world.events.emit('playerSpawned', { player: this, slot: this.index, respawn: true });
  }

  /** A continue was used: full lives, drop in, optional gift weapon; the landing emits `continueLanded`. */
  continueGame(giftWeapon: string | null = TUNING.continues.giftWeapon): void {
    this.respawn();
    this.continued = true;
    if (giftWeapon && hasWeapon(giftWeapon)) this.giveWeapon(giftWeapon);
  }

  /**
   * Nearest spot (within the view, searching outward from x0) with a floor where the standing
   * body fits (no solid rect or dynamic solid inside it) and no hazard. At each x the topmost
   * free floor wins (the drop-in falls straight through everything above it).
   */
  private safeSpot(x0: number): { x: number; y: number } | null {
    const cam = this.world.camera;
    const t = this.world.terrain;
    const lo = cam.left + 16;
    const hi = cam.right - 16;
    const bottom = cam.bottom + 32;
    for (let d = 0; d <= cam.w; d += 8) {
      for (let k = d === 0 ? 1 : 0; k < 2; k++) {
        const x = x0 + (k === 0 ? -d : d);
        if (x < lo || x > hi) continue;
        let y = t.surfaceY(x, cam.top + 8, bottom);
        while (Number.isFinite(y) && !this.standsFree(x, y)) y = t.surfaceY(x, y + 1, bottom);
        if (!Number.isFinite(y)) continue;
        // The feet must land inside the view, and no dynamic solid (a closed hatch, a lift) may
        // cover the spot: the drop-in falls through it and the player would be sealed below.
        if (y > cam.bottom - 8 || this.roofedBySolid(x, y)) continue;
        rectScratch.x = x - 8;
        rectScratch.y = y - 30;
        rectScratch.w = 16;
        rectScratch.h = 32;
        if (t.hazardAt(rectScratch)) continue;
        return { x, y };
      }
    }
    return null;
  }

  /** Is there an enabled dynamic solid (not one-way, not ours) above the feet at (x, y)? */
  private roofedBySolid(x: number, y: number): boolean {
    const half = TUNING.player.bodyW / 2;
    const solids = this.world.solids;
    for (let i = 0; i < solids.length; i++) {
      const s = solids[i];
      if (!s.enabled || s.oneWay || s.owner === this) continue;
      if (x - half < s.x + s.w && x + half > s.x && s.y + s.h <= y && s.y + s.h >= this.world.camera.top) return true;
    }
    return false;
  }

  /** Would a standing body with its feet at (x, y) be clear of solid rects and dynamic solids? */
  private standsFree(x: number, y: number): boolean {
    const T = TUNING.player;
    const x0 = x - T.bodyW / 2 + 0.01;
    const x1 = x + T.bodyW / 2 - 0.01;
    const y0 = y - T.bodyH + 0.01;
    const y1 = y - 0.01;
    if (this.world.terrain.solidOverlaps(x0, y0, x1, y1)) return false;
    const solids = this.world.solids;
    for (let i = 0; i < solids.length; i++) {
      const s = solids[i];
      if (!s.enabled || s.oneWay || s.owner === this) continue;
      if (x0 < s.x + s.w && x1 > s.x && y0 < s.y + s.h && y1 > s.y) return false;
    }
    return true;
  }

  private updateSpawn(): void {
    if (Number.isFinite(this.spawnFloor)) {
      // Fall straight in (through anything above the floor), then land.
      this.continueDrop();
      if (!Number.isFinite(this.spawnFloor)) this.finishSpawn();
    } else {
      const c = moveBody(this, this.world.terrain, this.world);
      if (c.onGround) this.finishSpawn();
    }
    this.legs.play(this.alt(this.legIds.fall));
    this.torso.play(this.torsoId('idle'));
  }

  /**
   * One tick of the scripted drop-in (collisions off, straight down to `spawnFloor`). When the
   * floor is reached, collisions come back on. Returns false when no drop is in progress.
   * Also used when the drop is interrupted (victory, time-out), so nobody falls through the floor.
   */
  private continueDrop(): boolean {
    if (!Number.isFinite(this.spawnFloor)) return false;
    this.y += this.vy;
    this.vy = Math.min(this.vy + 0.4, 10);
    if (this.y >= this.spawnFloor) {
      this.y = this.spawnFloor;
      this.spawnFloor = Infinity;
      this.vy = 0;
      this.body.collide = true;
      settle(this, this.world.terrain, this.world);
    }
    return true;
  }

  private finishSpawn(): void {
    this.state = 'play';
    this.vy = 0;
    this.jumped = false;
    this.landTicks = this.landLength();
    this.mountLock = false;
    dust(this.world, this.x, this.y, 4);
    this.sfx('player/land');
    // GDD §4.5: landing clears every enemy shot within 64 px (POOF).
    poofCircle.x = this.x;
    poofCircle.y = this.y - 15;
    eraseEnemyShots(this.world, poofCircle);
    // The in-world continue: the hero is back (the runner makes the enemies on screen cower).
    if (this.continued) {
      this.continued = false;
      this.world.events.emit('continueLanded', { player: this, slot: this.index });
    }
  }

  // ------------------------------------------------------------------------------- intro drop

  /** Under the intro parachute (MissionDef.introDrop)? */
  get dropping(): boolean {
    return this.dropFloor !== Infinity;
  }

  /**
   * Mission-start parachute drop (the runner calls it after the camera snapped onto the start):
   * lift the player above the view over his current floor spot and let him float down onto it in
   * `TUNING.life.introDropTicks`. Collisions are off until he lands (nothing above the start
   * catches him). Only from 'play' on foot.
   */
  introDrop(): void {
    if (this.state !== 'play' || this.vehicle) return;
    const floor = this.y;
    const top = this.world.camera.top - 2;
    if (top >= floor) return;
    this.dropFloor = floor;
    this.dropVy = (floor - top) / Math.max(1, TUNING.life.introDropTicks);
    this.prevX = this.x;
    this.y = this.prevY = top;
    this.invulnTicks = 0; // the status absorbs hits; no blinking under the chute
    this.vx = 0;
    this.vy = this.dropVy;
    this.body.collide = false;
    this.body.onGround = false;
    this.jumped = true;
    this.status.add(INTRO_DROP);
    this.legs.play(this.alt(this.legIds[this.dangleLegs()]));
  }

  private dangleLegs(): LegsAnim {
    return hasSprite(this.legIds.dangle) ? 'dangle' : 'fall';
  }

  /** The drop reached its floor: collisions back on, the chute collapses, the status ends. */
  private landDrop(): void {
    this.y = this.dropFloor;
    this.vy = 0;
    this.dropFloor = Infinity;
    this.body.collide = true;
    settle(this, this.world.terrain, this.world);
    this.status.remove(INTRO_DROP_ID);
    this.invulnTicks = Math.max(this.invulnTicks, TUNING.life.respawnInvulnTicks / 2);
    if (hasSprite(CHUTE_COLLAPSE_SPRITE)) {
      this.collapseTick = this.world.tick;
      this.collapseX = this.x;
      this.collapseY = this.y;
    }
    this.onLanded();
  }

  /**
   * Stop the intro drop (death, victory, a respawn, a vehicle). `handoff`: the body still falls
   * onto the drop floor through the respawn drop (`continueDrop`), so nobody falls through it.
   */
  private endDrop(handoff = true): void {
    if (this.dropFloor === Infinity) return;
    if (handoff) {
      this.spawnFloor = this.dropFloor;
      this.vy = this.dropVy;
    } else this.body.collide = true;
    this.dropFloor = Infinity;
    this.status.remove(INTRO_DROP_ID);
  }

  // ------------------------------------------------------------------------------- victory

  /**
   * Mission complete: victory pose, no control, invulnerable. A mounted player stays in his
   * vehicle and only raises `cheering` (open-seat mounts show `ride-cheer`).
   */
  victory(): void {
    if (this.state === 'dead' || this.state === 'out') return;
    if (this.state === 'mounted') {
      this.cheering = true;
      return;
    }
    this.flipT = 0;
    this.endDrop();
    this.state = 'victory';
    this.setCrouch(false, true);
    this.vx = 0;
    this.invulnTicks = 1e9;
    this.full.play(this.alt(this.fullIds.victory), loopFrom0());
  }

  private updateVictory(): void {
    if (this.continueDrop()) return; // the mission ended while this player was dropping in
    this.vx = approach(this.vx, 0, TUNING.player.runAccel);
    moveBody(this, this.world.terrain, this.world);
  }

  // ------------------------------------------------------------------------------- animation & drawing

  /**
   * Footsteps (only in missions with `footsteps`, e.g. ams): one `player/step` every 16 ticks
   * while running on dry ground (two per pass of the 8-frame run strip), the first 4 ticks after
   * the run starts. Tick-based: no rng.
   */
  private footsteps(legs: LegsAnim): void {
    if (legs !== 'run' || this.wading || !gameOf(this.world).footsteps) {
      this.stepT = 4;
      return;
    }
    if (--this.stepT > 0) return;
    this.stepT = 16;
    this.sfx('player/step');
  }

  /** Pick the legs strip for this tick's movement (before shooting reads the hip point). */
  private updateLegs(ax: number): LegsAnim {
    const b = this.body;
    let legs: LegsAnim;
    if (this.dropFloor !== Infinity) legs = this.dangleLegs();
    else if (!b.onGround) legs = this.vy < 0 ? 'jump' : 'fall';
    else if (this.crouching) legs = ax !== 0 ? 'crouch-walk' : 'crouch';
    else if (Math.abs(this.vx) > 0.1) legs = 'run';
    else if (this.landTicks > 0) legs = 'land';
    else legs = 'idle';
    const id = this.alt(this.legIds[legs]);
    if (legs === 'jump' || legs === 'land') this.legs.play(id, once(false));
    else if (legs === 'run') this.legs.play(id, looping(TUNING.player.runTicksPerFrame));
    else this.legs.play(id);
    // Stride strips follow the speed (rule 7): no skating at a wading / slowed pace.
    if (legs === 'run') this.legsRate = strideRate(this.vx, TUNING.player.runSpeed);
    else if (legs === 'crouch-walk') this.legsRate = strideRate(this.vx, TUNING.player.crawlSpeed);
    return legs;
  }

  /** Torso idle / aim pose (when not shooting, throwing or knifing) and the idle fidget. */
  private updateTorso(legs: LegsAnim): void {
    if (this.action === 'none' && this.shootTicks <= 0) {
      // Drawn aim (aimVis) eases through the diagonal; a forward-aiming runner swings his arms.
      let act = this.aimAction(false, this.aimVis);
      if (legs === 'run' && act === 'idle') act = 'run';
      this.torso.play(this.drawTorsoId(act));
    }

    // Optional idle fidget.
    const idle = legs === 'idle' && this.action === 'none' && this.shootTicks <= 0 && !this.pad.mask;
    // The fidget ends: the hero may leave a cosmetic status behind (Gramps' squeaky boot).
    if (!idle && this.bored) this.applyBoredStatus();
    this.idleTicks = idle ? this.idleTicks + 1 : 0;
    // Short fidgets (a / b alternate) before the long `bored` one; never under a status art.
    if (this.idleTicks === TUNING.player.fidgetTicks && !this.status.art) {
      const id = this.fullIds[this.fidgetCount % 2 === 0 ? 'fidget-a' : 'fidget-b'];
      if (hasSprite(id)) {
        this.full.play(id, once(true));
        this.fidgetCount++;
      }
    }
    if (this.idleTicks === TUNING.player.boredTicks && hasSprite(this.fullIds.bored)) {
      this.full.play(this.alt(this.fullIds.bored), loopFrom0());
    }
  }

  /** `CharacterDef.boredStatus` (content/characters): a status added when the `bored` fidget ends. */
  private applyBoredStatus(): void {
    const id = (this.character as { boredStatus?: string }).boredStatus;
    const st = id ? getStatus(id) : undefined;
    if (st) this.status.add(st);
  }

  /** A short idle fidget is playing (full body, draw-only). */
  private get fidgeting(): boolean {
    const id = this.full.id;
    return (
      this.idleTicks >= TUNING.player.fidgetTicks &&
      !this.status.art &&
      !this.full.done &&
      (id === this.fullIds['fidget-a'] || id === this.fullIds['fidget-b'])
    );
  }

  private get bored(): boolean {
    return this.idleTicks >= TUNING.player.boredTicks && this.full.id === this.alt(this.fullIds.bored);
  }

  override draw(r: Renderer): void {
    const s = this.state;
    if (s === 'out' || s === 'mounted') return;
    this.drawCollapse(r);
    if (s === 'dead' && (this.cause === 'pit' || (this.cause === 'drown' && this.full.id !== this.fullIds['die-drown']))) return;
    const blinking = this.invulnTicks > 0 && s !== 'victory' && s !== 'dead';
    if (blinking && Math.floor(this.world.tick / TUNING.life.respawnBlinkTicks) % 2 === 1) return;
    // Unrounded: the renderer places the body at 1/res steps; legs, torso and tints share the
    // same fractional part (whole-pixel offsets), so the parts never drift apart.
    const x = this.x;
    const y = this.y;
    drawOpts.flipX = this.facing < 0;
    // Pick-up flash (draw-only): white on ages 0-1 and 4-5, a white tint fading over ages 4-9.
    const pAge = TUNING.life.pickupFlashTicks - this.pickupT;
    drawOpts.flash = this.pickupT > 0 && (pAge < 2 || (pAge >= 4 && pAge < 6));
    let tint = this.status.tint;
    let tintA = this.status.tintAlpha;
    if (this.pickupT > 0 && pAge >= 4 && !drawOpts.flash) {
      tint = PICKUP_TINT;
      tintA = (0.6 * this.pickupT) / Math.max(1, TUNING.life.pickupFlashTicks - 4);
    }
    const flipping = this.flipT > 0 && s === 'play' && !this.status.art && this.full.id === this.fullIds.flip;
    const fullBody = s === 'dead' || s === 'victory' || this.bored || flipping || (s === 'play' && this.fidgeting) || (s === 'spawn' && this.full.id === this.alt(this.fullIds.spawn));
    if (fullBody) {
      // A drowning plays on the water surface (the strip is cropped at its anchor line).
      const fy = s === 'dead' && this.cause === 'drown' ? this.drownY : y;
      r.sprite(this.full.id, this.full.index, x, fy, drawOpts);
      if (tintA > 0) this.drawTint(r, this.full.id, this.full.index, x, fy, tint, tintA);
      // Time-out sleep: the snore letters rise from the head (draw-only, world tick paced).
      if (s === 'dead' && this.full.id === this.fullIds['timeout-sleep'] && hasSprite(SNORE_SPRITE)) {
        const head = framePoint(getFrame(this.full.id, this.full.index), 'head', drawOpts.flipX, false, headPt);
        if (head) {
          const n = frameCount(SNORE_SPRITE);
          const fi = Math.floor(this.world.tick / 8) % Math.max(1, n);
          r.sprite(SNORE_SPRITE, fi, x + head[0] + (drawOpts.flipX ? -2 : 2), fy + head[1] - 3, drawOpts);
        }
      }
    } else {
      // Draw-only crouch transition: the in / out legs, the torso on that frame's hip.
      let legsId = this.legs.id;
      let legsIdx = this.legs.index;
      let hip: [number, number] | undefined;
      const tr = this.crouchLegs();
      if (tr) {
        legsId = tr;
        legsIdx = onceFrame(tr, stripTicks(tr) - this.crouchT);
        hip = framePoint(getFrame(tr, legsIdx), 'hip', drawOpts.flipX, false, hipPt);
      }
      if (!hip) hip = this.hip(hipPt);
      // The run torso swings in step with the legs (same index).
      const tIdx = this.torso.id === this.torsoId('run') ? this.legs.index % Math.max(1, frameCount(this.torso.id)) : this.torso.index;
      r.sprite(legsId, legsIdx, x, y, drawOpts);
      r.sprite(this.torso.id, tIdx, x + hip[0], y + hip[1], drawOpts);
      if (tintA > 0) {
        this.drawTint(r, legsId, legsIdx, x, y, tint, tintA);
        this.drawTint(r, this.torso.id, tIdx, x + hip[0], y + hip[1], tint, tintA);
      }
    }
    drawOpts.flash = false;
    // Status extras on top (a wobbling balloon head, a parachute …).
    if (s !== 'dead') this.status.draw(r);
  }

  /** The crouch-in / crouch-out legs strip to draw this frame, or '' (draw-only `crouchT`). */
  crouchLegs(): string {
    if (this.crouchT <= 0 || this.state !== 'play' || !this.body.onGround) return '';
    if (this.crouchIn) {
      if (!this.crouching || this.legs.id !== this.alt(this.legIds.crouch)) return '';
      return hasSprite(this.legIds['crouch-in']) ? this.legIds['crouch-in'] : '';
    }
    if (this.crouching || this.legs.id !== this.alt(this.legIds.idle)) return '';
    return hasSprite(this.legIds['crouch-out']) ? this.legIds['crouch-out'] : '';
  }

  private drawTint(r: Renderer, id: string, frame: number, x: number, y: number, tint: Color | undefined, alpha: number): void {
    tintOpts.flipX = this.facing < 0;
    tintOpts.tint = tint;
    tintOpts.alpha = alpha;
    r.sprite(id, frame, x, y, tintOpts);
  }

  /** The intro chute folding down where he landed (one-shot, draw-only). */
  private drawCollapse(r: Renderer): void {
    if (this.collapseTick < 0) return;
    const age = this.world.tick - this.collapseTick;
    if (age < 0 || age >= stripTicks(CHUTE_COLLAPSE_SPRITE)) {
      this.collapseTick = -1;
      return;
    }
    drawChute(r, CHUTE_COLLAPSE_SPRITE, onceFrame(CHUTE_COLLAPSE_SPRITE, age), this.collapseX, this.collapseY);
  }
}

interface ReleaseFrame {
  index: number;
  hand: readonly [number, number] | null;
}
const releaseCache = new Map<string, ReleaseFrame>();

/**
 * The release frame of a throw strip: the frame whose 'hand' point is farthest forward and up
 * (the overhand release). Cached per sprite id.
 */
function releaseFrame(id: string): ReleaseFrame {
  let r = releaseCache.get(id);
  if (r) return r;
  r = { index: 0, hand: null };
  if (hasSprite(id)) {
    const frames = getFrames(id);
    let best = -Infinity;
    for (let i = 0; i < frames.length; i++) {
      const h = frames[i].pts?.hand;
      if (h && h[0] - h[1] > best) {
        best = h[0] - h[1];
        r = { index: i, hand: [h[0], h[1]] };
      }
    }
  }
  releaseCache.set(id, r);
  return r;
}

/**
 * The frame of a looping strip at `tick` with the strip's own timing (its `durations`, else
 * `ticksPerFrame`): for strips drawn without an Animator of their own (rider poses).
 */
export function stripFrame(id: string, tick: number): number {
  const n = frameCount(id);
  if (n <= 1) return 0;
  const a = spriteAnim(id);
  const d = a.durations;
  if (!d || d.length === 0) return Math.floor(tick / Math.max(1, a.ticksPerFrame)) % n;
  let total = 0;
  for (let i = 0; i < n; i++) total += Math.max(1, Math.round(d[i % d.length]));
  let t = tick % total;
  for (let i = 0; i < n; i++) {
    t -= Math.max(1, Math.round(d[i % d.length]));
    if (t < 0) return i;
  }
  return n - 1;
}

/** Peak height (px) of the Swan mount-hop arc above the straight boarding line. */
const HOP_ARC = 14;

/** Total ticks of one pass of a strip (its `durations`, else `ticksPerFrame` per frame). */
export function stripTicks(id: string): number {
  const n = frameCount(id);
  const a = spriteAnim(id);
  const d = a.durations;
  if (!d || d.length === 0) return n * Math.max(1, a.ticksPerFrame);
  let total = 0;
  for (let i = 0; i < n; i++) total += Math.max(1, Math.round(d[i % d.length]));
  return total;
}

/** The frame of a one-shot strip `age` ticks after it started (holds the last frame). */
export function onceFrame(id: string, age: number): number {
  const n = frameCount(id);
  if (n <= 1 || age <= 0) return 0;
  const a = spriteAnim(id);
  const d = a.durations;
  if (!d || d.length === 0) return Math.min(n - 1, Math.floor(age / Math.max(1, a.ticksPerFrame)));
  let t = age;
  for (let i = 0; i < n; i++) {
    t -= Math.max(1, Math.round(d[i % d.length]));
    if (t < 0) return i;
  }
  return n - 1;
}

/** Type guard used by items, vehicles and HUD code. */
export function isPlayer(e: Entity | null | undefined): e is Player {
  return e instanceof Player;
}
