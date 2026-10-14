/**
 * `swan` — SWAN-3 "Metal Swan", the ridden robot swan (GDD §8.2; docs/design/swan-mount/feel.md
 * for every number, look.md for the sprite contract, decisions.md for the choices between them).
 *
 * She is a `Vehicle` with an open seat: the rider sits astride her back (drawn with
 * `Player.drawRide`), the `seat` point is his hip, and the driver's anchor is HER feet anchor
 * (`syncDriver`), so enemy AI reads a grounded target. Her numbers live in `SWAN` (constants.ts).
 *
 * Ridden (`state` 'driven' / 'doomed'), by medium:
 * - ground: two-stage run to 2.6 px/tick; a reverse at ≥ 1.6 is a 7-tick SKID; up locks her facing
 *   (up + back back-pedals at 1.2); down = crouch (20 px tall), waddle 0.8, belly slide; ice =
 *   brake / skid at 0.05. Jump = a 4-tick squat, then vy −5.9 with her own gravity 0.18 (apex
 *   93.8 px in the engine), air cap clamp(take-off speed, 1.5, 2.6), coyote 4, buffer 6.
 * - air: hold jump while falling = the GLIDE (flap vy ≤ −0.4, gravity 0.06, fall ≤ 1.0, speed ≤
 *   2.2, 60 ticks, one per airtime; release folds the wings until a landing). Falling at ≥ 1.5
 *   onto the top 12 px of a soft target = the STOMP (100 crush, bounce vy −3.4, the glide back).
 * - water: her feet ride the float line 16 px under the surface (a one-way floor only she uses;
 *   ground above it wins). Swim 2.0, pivot turns, duck (down), 8-tick paddle-up then the same jump.
 * Weapons: the neck aims in 9 steps (+45° … −135°) at 22.5° per 2 ticks; the BEAK GUN and the
 * BEAK SHELL leave from the body frame's `neck` point plus the neck frame's `muzzle` / `cannon`.
 * Combos: fire + bomb = HONK (3 shells, cooldown 240, 10-tick wind-up); fire + jump on the same
 * tick or fire 1 tick before jump = SWAN DIVE (only on ground or a platform; refused in water;
 * in the air there is no combo). Eject = jump within 4 ticks after down (ground or water only).
 *
 * Riderless (`phase`): after an eject she stands 20 ticks, sits down and parks (the RIDE? bubble,
 * her eye follows players, a nervous egg after 600 ticks); in water she floats and catches her
 * own pilot (30–90 ticks after an eject). The SWAN DIVE is `state` 'ram': hiss 6 → charge (3.4
 * px/tick, 192 px, tramples soft enemies; a hard enemy, a wall, water or the view edge ahead ends
 * it) → BEAK BASH (400 in r 40) → −1 cell and a 180-tick
 * daze on her back (then she rights herself and sits down), or with 1 cell left she migrates
 * (lost). At 0 cells (the shared doomed window) her wings fold at once; the wreck's blast ends in
 * a sooty migration instead of a wreck. At ≤ 1 cell she smokes, sparks and limps (cosmetic).
 *
 * Co-op: the PERCH, a 14×4 one-way SolidBox on her tail (off from the squat to the landing of a
 * jump over land; on through jumps that start over water). Camera: lead 64 / max speed 4 while
 * any player rides a swan.
 *
 * Spawn params: `variant` ('ivory' | 'mute'; default: the first rider picks, P2 = the Mute),
 * `socks` (m3 knitted socks), `cells`, `shells`, `facing`.
 */
import { damageHas, type Damage, type Entity } from '../../../../engine/entity';
import type { VirtualPad } from '../../../../engine/input';
import { approach, clamp, overlaps, rectAt, type Rect } from '../../../../engine/math';
import { PAL } from '../../../../engine/palette';
import type { ParticlePreset } from '../../../../engine/particles';
import { Body, jump, moveBody, SolidBox, type Contact } from '../../../../engine/physics';
import type { DrawOpts, Renderer } from '../../../../engine/render';
import { framePoint, getFrame, hasSprite, type PlayOpts } from '../../../../engine/sprites';
import type { World } from '../../../../engine/world';
import { hudOf, iceAt } from '../../../context';
import type { EjectMode } from '../../../events';
import { blast, debris, dust, explosion, FX_SPARK, FX_TRAIL, smokeTrail, splash } from '../../../fx';
import type { Player, RidePose } from '../../../player/player';
import { getWeapon, hasWeapon, NO_PARAMS, paramBool, paramStr, type SpawnParams } from '../../../registry';
import { TUNING } from '../../../tuning';
import { Vehicle } from '../../../vehicle';
import { overWaterAt, waterRectAt, waterSurfaceAt } from '../../../water';
import { aimAngle, aimDirOf, Gun } from '../../../weapons';
import {
  BUBBLE_TIP,
  CROUCH_STRIPS,
  DIVE_BOX,
  EGG_POINT,
  HULL_DY,
  HURT,
  MUZZLE_REL,
  PERCH_TOP,
  REST,
  SEAT_ZONE,
  SWAN,
} from './constants';
import { SwanEgg } from './egg';
import { spawnHonkRing } from './weapons';

export type SwanMedium = 'ground' | 'air' | 'water';
export type GlideState = 'ready' | 'open' | 'folded';
/**
 * What she does without a rider: 'ride' (ridden), 'stand' / 'sit' / 'parked' / 'lay' (land),
 * 'float' (water), 'drop' (empty in the air); the dive: 'hiss' 'dive' 'bash' 'tumble' 'dazed'
 * 'right' 'shake'; 'migrate' (lost: she flies away).
 */
export type SwanPhase =
  | 'ride'
  | 'stand'
  | 'sit'
  | 'parked'
  | 'lay'
  | 'float'
  | 'drop'
  | 'hiss'
  | 'dive'
  | 'bash'
  | 'tumble'
  | 'dazed'
  | 'right'
  | 'shake'
  | 'migrate';
type Posture = 'land' | 'water' | 'crouch' | 'duck';

const S = SWAN;
const HK = SWAN.honk;
const D = SWAN.dive;

/** Body strips with a rider and a `<anim>-front` overlay (look.md §9, column R). */
const RIDER_STRIPS: ReadonlySet<string> = new Set([
  'idle', 'run', 'move', 'squat', 'jump', 'fall', 'stomp', 'land', 'flap', 'glide', 'glide-tired', 'fold', 'skid', 'crouch',
  'waddle', 'slide', 'settle', 'swim', 'water-duck', 'paddle-up', 'honk', 'honk-air', 'honk-swim', 'rise', 'wreck',
]);
/** `<anim>-front` overlay names of the rider strips (built once). */
const FRONT: ReadonlyMap<string, string> = new Map([...RIDER_STRIPS].map((n) => [n, `${n}-front`]));
/** Strips that contain the neck and head themselves (no neck sprite on top; look.md §7). */
const SELF_CONTAINED: ReadonlySet<string> = new Set([
  'rise', 'wreck', 'sit-down', 'empty', 'empty-look', 'empty-lay', 'hiss', 'dive', 'bash', 'tumble', 'dazed', 'right', 'shake',
  'migrate', 'migrate-soot',
]);
/** Strips tilted by 3° or less: the scuffs decal is not rotated (look.md §12.3). */
const LOW_TILT: ReadonlySet<string> = new Set([
  'idle', 'run', 'move', 'fall', 'glide', 'glide-tired', 'crouch', 'slide', 'swim', 'water-duck', 'squat', 'settle', 'flap',
]);

const SQUAT_D: readonly number[] = [2, 2];
/** The limp at ≤ 1 cell: extra ticks on every 4th contact frame (look.md §10.2). */
const LIMP_TICKS = 3;
const LAND_D: readonly number[] = [2, 2];
const HONK_D: readonly number[] = [4, 3, 3, 4, 6];
const HONK_NECK: readonly number[] = [0, 0, 0, 1, 2];
const RISE_D: readonly number[] = [4, 4, 4];
const SIT_D: readonly number[] = [6, 6, 8];
const HISS_D: readonly number[] = [3, 3];
const TRIPLE_4: readonly number[] = [4, 4, 4];
const DOUBLE_4: readonly number[] = [4, 4];

/** Frame of a non-looping strip `elapsed` ticks after it started (holds the last frame). */
function frameAt(durations: readonly number[], elapsed: number): number {
  let t = elapsed;
  for (let i = 0; i < durations.length; i++) {
    t -= durations[i];
    if (t < 0) return i;
  }
  return durations.length - 1;
}

/** Frame of an `n`-frame loop at `tpf` ticks per frame. */
function loopFrame(n: number, tpf: number, tick: number): number {
  return Math.floor(tick / tpf) % n;
}

function mod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

/** The Animator never advances by itself: the Swan picks every body frame (odometers, timers). */
const HOLD: PlayOpts = { ticksPerFrame: 1e9, loop: true };
const drawOpts: DrawOpts = {};
const tintOpts: DrawOpts = { tint: 0xff3020ff, alpha: 0.45 };
const pt: [number, number] = [0, 0];
const pt2: [number, number] = [0, 0];
const stompRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
const bandRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
const diveRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
const seatScratch: Rect = { x: 0, y: 0, w: 0, h: 0 };
const footRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

function relRect(b: readonly [number, number, number, number]): Rect {
  return { x: b[0], y: b[1], w: b[2], h: b[3] };
}
const STOMP_REL = relRect(S.stompBox);
const DIVE_REL = relRect(DIVE_BOX);
const HURT_REL = {
  stand: HURT.stand.map(relRect),
  crouch: HURT.crouch.map(relRect),
  swim: HURT.swim.map(relRect),
  duck: HURT.duck.map(relRect),
};
const ZONE_REL = { parked: relRect(SEAT_ZONE.parked), water: relRect(SEAT_ZONE.water), stand: relRect(SEAT_ZONE.stand) };

/** Stiff stamped tin feathers (her only feathers: look.md §2); `fx/tin-feather` when drawn. */
const FEATHER_SPRITE: ParticlePreset = {
  kind: 'sprite',
  sprite: 'fx/tin-feather',
  randomFrames: 4,
  ticksPerFrame: 6,
  life: [40, 60],
  gravity: 0.02,
  drag: 0.95,
  randomFlip: true,
};
const FEATHER_RECT: ParticlePreset = {
  kind: 'rect',
  w: 3,
  h: 1,
  life: [40, 60],
  gravity: 0.02,
  drag: 0.95,
  colors: [PAL.snow[3], PAL.snow[2], PAL.navy[1]],
  fadeFrom: 0.7,
};
/** One slow feather after the migration (120 ticks). */
const FEATHER_SLOW: ParticlePreset = { ...FEATHER_RECT, life: 120, gravity: 0.01, drag: 0.97, fadeFrom: 0.8 };

/** Worlds whose camera runs the Swan rule now (so a parked swan never resets a camera it did not set). */
const swanCameras = new WeakSet<World>();

/** GDD §4.12: lead 64 / max speed 4 while any player rides a Swan; 38 / 3 again after the last ride. */
function refreshSwanCamera(world: World): void {
  const swans = world.byTag('swan');
  let ridden = false;
  for (let i = 0; i < swans.length && !ridden; i++) {
    const s = swans[i];
    ridden = s instanceof Swan && !s.removed && s.driver !== null;
  }
  const cam = world.camera;
  if (ridden) {
    cam.lead = S.cameraLead;
    cam.maxSpeed = S.cameraMaxSpeed;
    swanCameras.add(world);
  } else if (swanCameras.has(world)) {
    cam.lead = TUNING.camera.lead;
    cam.maxSpeed = TUNING.camera.maxSpeed;
    swanCameras.delete(world);
  }
}

export class Swan extends Vehicle {
  // ---- body and look
  private readonly b: Body;
  private readonly socks: boolean;
  /** Paint chosen by the spawn param (null: the first rider picks it, P2 = the Mute). */
  private muteChoice: boolean | null;
  /** Painted as the Mute (P2's swan: black neck, head and beak). */
  mute = false;
  private bodyPrefix = 'vehicle/swan';
  private colorPrefix = 'vehicle/swan';
  private readonly stripIds = new Map<string, string>();
  /** Overlay and neck strip ids by name (colour prefix only). */
  private readonly colorIds = new Map<string, string>();

  // ---- where she is
  medium: SwanMedium = 'ground';
  /** Her feet are on the float line. */
  swimming = false;
  /** Standing in water shallower than the float line (she wades at full speed). */
  wading = false;
  crouching = false;
  /** Down in water: 8 px lower, the rider hunches. */
  ducking = false;
  skidding = false;

  // ---- jump and glide
  /** Ticks left of the take-off squat (ground) / paddle-up (water); she takes off at 0. */
  squatT = 0;
  paddleT = 0;
  jumpBuffer = 0;
  /** This airtime started with a jump (no coyote jump; the perch rule). */
  jumped = false;
  /** Air speed cap = clamp(|vx at take-off|, 1.5, 2.6). */
  airCap: number = S.airCapMin;
  glide: GlideState = 'ready';
  glideT = 0;
  /** The jump that started this airtime began over a water rect (the perch stays on). */
  overWaterJump = false;
  /** Stomps since she last touched the ground. */
  stompChain = 0;
  private foldT = 0;
  /** The jump button held now is a buffered jump press, not a glide. */
  private bufferHold = false;
  private airTopY = 0;
  private stompT = 0;
  private jumpT = 0;
  private landT = 0;
  private glideLandT = 0;
  private settleT = 0;
  /** settle forward (into the water) or backward (onto a bank). */
  private settleIn = true;
  private plungeT = 0;
  private plungeDepth = 0;
  private skidT = 0;

  // ---- aim, weapons, reactions
  /** Neck angle relative to her facing (radians; 0 forward, negative up, +π/4 forward-down). */
  neckAngle = 0;
  private neckTarget = 0;
  private neckT = 0;
  /** Ridden ticks without input: the relaxed S-neck after 40. */
  private idleT = 0;
  /** HONK strip time (−1 = none); the ring leaves at the end of the 10-tick wind-up. */
  honkT = -1;
  honkCool = 0;
  /** The HONK started in the air: she hangs still for its wind-up (a take-off already running keeps its jump). */
  private honkHang = false;
  private hurtT = 0;
  private joltT = 0;
  private fireFaceT = 0;
  private shellFaceT = 0;
  private blinkT = 0;
  private nextBlink = 120;
  private downAt = -1000;
  private riseT = 0;
  /** The boss died while she was ridden: the rider cheers from now on. */
  private bossCheer = false;
  private readonly honkGun: Gun | null;

  // ---- riderless
  phase: SwanPhase = 'parked';
  phaseT = 0;
  private emptyT = 0;
  private laid = false;
  private diveStartX = 0;
  private impactT = 0;
  private soot = false;
  private readonly trampled: Entity[] = [];
  /** The water catch: her last pilot, ticks since the eject. */
  private catchPilot: Player | null = null;
  private catchT = 0;
  private lastX: number;

  // ---- what animate() picked for draw()
  private bodyName = 'idle';
  private bodyFrame = 0;
  private neckName = '';
  private neckFrame = 0;
  private riderPose: RidePose = 'sit';
  private riderFrame = -1;
  private riderShown = false;
  private overlay = false;
  /** Distance run along her facing (the run odometer: one frame per 6 px). */
  private odo = 0;
  private swimClock = 0;
  private lastRunFrame = -1;
  private lastSwimFrame = -1;
  /** Foot contacts on the run, and the limp at ≤ 1 cell: every 4th contact frame holds 3 ticks longer. */
  private contacts = 0;
  private limpT = 0;
  private limpFrame = 0;

  // ---- co-op, events, scratch
  /** The co-op PERCH on her tail: a moving one-way platform (feel §10). */
  readonly perch: SolidBox;
  private readonly offBoss: () => void;
  private readonly offLoops: () => void;
  /** Audio key of her engine loop while ridden (`swan-engine-<slot>`, so a carried Swan keeps it), or null. */
  private engineKey: string | null = null;
  private readonly radioSpot = { x: 0, y: 0, hitbox: { y: 0 }, removed: false };
  private readonly loopKey: string;
  private readonly hurt3: Rect[] = [{ x: 0, y: 0, w: 0, h: 0 }, { x: 0, y: 0, w: 0, h: 0 }, { x: 0, y: 0, w: 0, h: 0 }];
  private readonly hurt2: Rect[] = [{ x: 0, y: 0, w: 0, h: 0 }, { x: 0, y: 0, w: 0, h: 0 }];
  private readonly hurt1: Rect[] = [{ x: 0, y: 0, w: 0, h: 0 }];

  constructor(world: World, x: number, y: number, params: SpawnParams = NO_PARAMS) {
    super(world, x, y, params, {
      art: 'vehicle/swan',
      name: 'SWAN-3',
      w: S.bodyW,
      h: S.bodyH,
      seat: { ...ZONE_REL.parked },
      seatPoint: [-4, -20],
      gunPoint: [40, -24],
      cannonPoint: [40, -24],
      cells: S.cells,
      mainGun: 'swan-beak-gun',
      cannon: 'swan-beak-shell',
      shells: S.shells,
      specialCost: HK.cost,
      speed: S.runMax,
      accel: S.accel,
      jump: S.jumpVelocity,
      ramSpeed: D.speed,
      ramDistance: D.distance,
      ramDamage: D.damage,
      ramRadius: D.radius,
      iceFriction: false,
    });
    const b = this.body as Body;
    this.b = b;
    b.gravity = S.gravity;
    b.maxFall = S.maxFall;
    b.stepUp = S.stepUp;
    b.snapDown = S.snapDown;
    this.setBodyHeight(S.crouchBodyH);
    const v = paramStr(params, 'variant', '');
    this.muteChoice = v === 'mute' ? true : v === 'ivory' ? false : null;
    this.socks = paramBool(params, 'socks', false);
    this.setPaint(this.muteChoice ?? false);
    this.honkGun = hasWeapon('swan-honk') ? new Gun(world, this, getWeapon('swan-honk'), 'player') : null;
    this.offscreenMarker = true;
    this.lastX = x;
    this.loopKey = `swan-glide-${this.id}`;
    this.addTag('swan');
    this.perch = world.addSolid(new SolidBox(x + S.perch[0], y + PERCH_TOP.crouch, S.perch[1], S.perch[2], true, this));
    this.offBoss = world.events.on('bossDefeated', () => {
      if (this.driver) this.bossCheer = true;
    });
    this.offLoops = world.events.on('stopLoops', (e) => this.engine(null, e.fadeTicks));
    this.show('empty', 0);
  }

  // ------------------------------------------------------------------------------- look

  private setPaint(mute: boolean): void {
    this.mute = mute;
    this.colorPrefix = mute ? 'vehicle/swan-mute' : 'vehicle/swan';
    this.bodyPrefix = this.colorPrefix + (this.socks ? '-socks' : '');
    this.stripIds.clear();
    this.colorIds.clear();
  }

  /** Body strip id: the painted variant when drawn, else plainer ones (vehicle/swan last). */
  private bodyId(name: string): string {
    let id = this.stripIds.get(name);
    if (id !== undefined) return id;
    const cands = [`${this.bodyPrefix}/${name}`, `${this.colorPrefix}/${name}`, `vehicle/swan${this.socks ? '-socks' : ''}/${name}`, `vehicle/swan/${name}`];
    id = cands.find((c) => hasSprite(c)) ?? cands[cands.length - 1];
    this.stripIds.set(name, id);
    return id;
  }

  /** Overlay and neck strips use only the colour prefix (socks never show in them). */
  private colorId(name: string): string {
    let id = this.colorIds.get(name);
    if (id !== undefined) return id;
    const own = `${this.colorPrefix}/${name}`;
    id = hasSprite(own) ? own : `vehicle/swan/${name}`;
    this.colorIds.set(name, id);
    return id;
  }

  private show(name: string, frame: number): void {
    const id = this.bodyId(name);
    if (this.anim.id !== id) this.anim.play(id, HOLD);
    this.anim.index = frame;
    this.bodyName = name;
    this.bodyFrame = frame;
  }

  /** Hull offset dy of the shown body frame (look.md §10). */
  private hullDy(): number {
    const t = HULL_DY[this.bodyName];
    return t && t.length > 0 ? t[mod(this.bodyFrame, t.length)] : 0;
  }

  /**
   * A hull-attached point of the shown body frame relative to her anchor (mirrored): the
   * frame's own point, else the rest position moved by the frame's hull offset.
   */
  private bodyPoint(name: 'seat' | 'neck' | 'hull' | 'smoke', out: [number, number]): [number, number] {
    const flip = this.facing < 0;
    const p = this.anim.id ? framePoint(getFrame(this.anim.id, this.anim.index), name, flip, false, out) : undefined;
    if (p) return p;
    const rest = REST[name];
    out[0] = flip ? -rest[0] : rest[0];
    out[1] = rest[1] + this.hullDy() + (name === 'seat' && CROUCH_STRIPS.has(this.bodyName) ? 4 : 0);
    return out;
  }

  // ------------------------------------------------------------------------------- body size

  private setBodyHeight(h: number): void {
    this.b.h = h;
    this.hitbox.x = -S.bodyW / 2;
    this.hitbox.y = -h;
    this.hitbox.w = S.bodyW;
    this.hitbox.h = h;
  }

  /** Room for the 48 px body above the feet (no solid rect or dynamic solid in the way)? */
  private canStand(): boolean {
    const x0 = this.x - S.bodyW / 2;
    const x1 = this.x + S.bodyW / 2;
    const y0 = this.y - S.bodyH;
    const y1 = this.y - S.crouchBodyH;
    if (this.world.terrain.solidOverlaps(x0, y0, x1, y1)) return false;
    const solids = this.world.solids;
    for (let i = 0; i < solids.length; i++) {
      const s = solids[i];
      if (!s.enabled || s.oneWay || s.owner === this) continue;
      if (x0 < s.x + s.w && x1 > s.x && y0 < s.y + s.h && y1 > s.y) return false;
    }
    return true;
  }

  /** Stand tall (48) or low (20: crouched, parked). Standing up needs head room. */
  private setLow(low: boolean): boolean {
    const h = low ? S.crouchBodyH : S.bodyH;
    if (this.b.h === h) return true;
    if (!low && !this.canStand()) return false;
    this.setBodyHeight(h);
    return true;
  }

  private setCrouch(on: boolean): void {
    if (on === this.crouching) return;
    if (!this.setLow(on)) return;
    this.crouching = on;
  }

  // ------------------------------------------------------------------------------- mounting

  /** The top 16 px of her back: 32 px up while she sits, higher while she stands, in water 44. */
  override seatRect(): Rect {
    const zone = this.swimming ? ZONE_REL.water : this.b.h === S.bodyH ? ZONE_REL.stand : ZONE_REL.parked;
    return rectAt(this.x, this.y, zone, this.facing < 0, seatScratch);
  }

  override canMount(p: Player): boolean {
    if (this.phase === 'migrate' || this.state !== 'idle') return false;
    return super.canMount(p);
  }

  override mount(p: Player): void {
    if (this.driver) return;
    if (this.muteChoice === null) {
      // No paint given (a carried-over or start vehicle): the first rider picks it, then it stays.
      this.muteChoice = p.index === 1;
      this.setPaint(this.muteChoice);
    }
    const inWater = this.swimming;
    super.mount(p);
    if (this.honkGun) this.honkGun.owner = p.index;
    this.phase = 'ride';
    this.phaseT = 0;
    this.catchPilot = null;
    this.resetRide();
    // No head room to stand (parked under a low roof): she starts crouched.
    if (!this.setLow(false)) this.crouching = true;
    if (!inWater && this.medium === 'ground' && !this.crouching) this.riseT = S.riseTicks;
    this.engine(p.index);
    refreshSwanCamera(this.world);
  }

  /**
   * Her engine loop (`swan/engine`) while ridden: started on a mount under the rider's slot key,
   * stopped on an eject, her removal and 'stopLoops' (a section or the mission ends).
   */
  private engine(slot: number | null, fadeTicks = 8): void {
    const key = slot === null ? null : `swan-engine-${slot}`;
    if (key === this.engineKey) return;
    if (this.engineKey) this.world.audio.stopSfx?.(this.engineKey, fadeTicks);
    this.engineKey = key;
    if (key) this.world.audio.sfxLoop?.(key, 'swan/engine', { vol: 0.7 });
  }

  override eject(mode: EjectMode = 'exit'): void {
    const p = this.driver;
    if (!p) return;
    const inWater = this.swimming;
    super.eject(mode);
    this.engine(null);
    this.resetRide();
    if (mode === 'ram') {
      this.phase = 'hiss';
      this.phaseT = 0;
      this.setLow(false);
      this.world.audio.sfx('swan/hiss');
    } else if (this.state === 'idle') {
      this.enterEmpty(inWater);
      if (inWater && mode === 'exit' && this.cells > 0) {
        // She stops at once and catches her pilot if his somersault comes down on her (8.2 Water).
        this.vx = 0;
        this.catchPilot = p;
        this.catchT = 0;
      }
    }
    refreshSwanCamera(this.world);
  }

  /** Forget the ride (timers, glide, crouch): after a mount or an eject. */
  private resetRide(): void {
    this.squatT = this.paddleT = this.jumpBuffer = 0;
    this.jumped = false;
    if (this.glide === 'open') this.world.audio.stopSfx?.(this.loopKey);
    this.glide = 'ready';
    this.glideT = this.foldT = this.stompT = this.landT = this.glideLandT = 0;
    this.bufferHold = this.skidding = this.ducking = false;
    this.crouching = false;
    this.stompChain = 0;
    this.honkT = -1;
    this.riseT = this.hurtT = 0;
    this.neckAngle = this.neckTarget = 0;
    this.neckT = this.idleT = 0;
    this.downAt = -1000;
  }

  /** Riderless again: stand and look around on land, float in water, fall in the air. */
  private enterEmpty(inWater: boolean): void {
    this.phaseT = 0;
    this.emptyT = 0;
    if (inWater || this.swimming) this.phase = 'float';
    else if (this.medium === 'air') this.phase = 'drop';
    else {
      this.phase = 'stand';
      this.setLow(false);
    }
  }

  /** The driver's anchor is her feet anchor, not the seat (look.md §6.6): AI sees a grounded target. */
  protected override syncDriver(): void {
    const p = this.driver;
    if (!p) return;
    p.x = p.prevX = this.x;
    p.y = p.prevY = this.y;
    p.facing = this.facing;
    p.vx = this.vx;
    p.vy = this.vy;
  }

  /** The rider's hip: the frame's 'seat' point, else per pose (standing −48, crouched −16, swimming −30 …). */
  protected override seatWorld(out: [number, number]): [number, number] {
    this.bodyPoint('seat', out);
    out[0] += this.x;
    out[1] += this.y;
    return out;
  }

  protected override rideBubbleTip(out: [number, number]): [number, number] {
    const tip = this.swimming ? BUBBLE_TIP.water : this.phase === 'stand' ? BUBBLE_TIP.stand : BUBBLE_TIP.parked;
    out[0] = this.x + tip[0] * this.facing;
    out[1] = this.y + tip[1];
    return out;
  }

  /** Her hull or rider top (the HUD marker shows while it is above the view). */
  override markerTop(): number {
    const s = this.seatWorld(pt2);
    return s[1] - (this.driver ? 24 : 4);
  }

  // ------------------------------------------------------------------------------- tick

  /** Lost: flying away (after a last dive or the 0-cell wreck). */
  get migrating(): boolean {
    return this.phase === 'migrate';
  }

  override update(): void {
    if (this.migrating) {
      this.updateMigrate();
      this.animate();
      return;
    }
    switch (this.state) {
      case 'driven':
        this.updateDriven();
        break;
      case 'doomed':
        this.tickTimers();
        this.updateDoomed();
        break;
      case 'ram':
        this.updateRam();
        break;
      case 'wreck':
        this.updateWreck();
        break;
      case 'idle':
        this.updateEmpty();
        break;
    }
    if (this.migrating) return;
    this.animate();
    if (this.state === 'driven') this.fireWeapons();
    this.updatePerch();
    this.lastX = this.x;
  }

  private updateDriven(): void {
    const p = this.driver;
    if (!p || p.state !== 'mounted') {
      // The driver left by other means (a script, a time-out): she is empty again.
      this.driver = null;
      this.despawnMargin = 320;
      this.removeTag('shootable');
      this.state = 'idle';
      this.resetRide();
      this.enterEmpty(this.swimming);
      refreshSwanCamera(this.world);
      return;
    }
    this.tickTimers();
    this.control(p.pad);
    if (this.state !== 'driven') return; // ejected, diving or doomed by a hazard
    this.physics();
    this.keepInView();
    if (this.checkHazards()) return;
    this.syncDriver();
    this.lowCellWarning();
    this.panicInfantry();
  }

  /** Count down the ride's timers (and fire the HONK ring at the end of its wind-up). */
  private tickTimers(): void {
    if (this.honkT >= 0) {
      this.honkT++;
      if (this.honkT === HK.windup && this.state === 'driven') this.fireHonk();
      if (this.honkT >= HK.stripTicks) this.honkT = -1;
    }
    if (this.honkCool > 0) this.honkCool--;
    if (this.landT > 0) this.landT--;
    if (this.glideLandT > 0) this.glideLandT--;
    if (this.settleT > 0) this.settleT--;
    if (this.plungeT > 0) this.plungeT--;
    if (this.stompT > 0) this.stompT--;
    if (this.foldT > 0) this.foldT--;
    if (this.hurtT > 0) this.hurtT--;
    if (this.joltT > 0) this.joltT--;
    if (this.fireFaceT > 0) this.fireFaceT--;
    if (this.shellFaceT > 0) this.shellFaceT--;
    this.jumpT++;
    if (this.blinkT > 0) this.blinkT--;
    else if (--this.nextBlink <= 0) {
      this.blinkT = 6;
      this.nextBlink = this.world.fxRng.int(90, 220);
    }
  }

  /** In the air the HONK wind-up holds her still (vy 0); it is not the glide. */
  private get windingUp(): boolean {
    return this.honkT >= 0 && this.honkT < HK.windup;
  }

  // ------------------------------------------------------------------------------- control

  protected override control(pad: VirtualPad): void {
    const t = this.world.tick;
    if (pad.pressed('fire')) this.pressedAt.fire = t;
    if (pad.pressed('jump')) this.pressedAt.jump = t;
    if (pad.pressed('bomb')) this.pressedAt.bomb = t;
    if (pad.pressed('down')) this.downAt = t;
    const driver = this.driver;
    if (driver?.cheering) {
      this.coast();
      this.neckTarget = 0;
      return;
    }
    if (this.riseT > 0) {
      this.riseT--;
      this.coast();
      return;
    }
    // Take-offs started on earlier ticks: the press committed her.
    if (this.squatT > 0 && --this.squatT === 0) this.launch();
    if (this.paddleT > 0 && --this.paddleT === 0) this.launch();

    const up = pad.held('up');
    const down = pad.held('down') && !up;
    const ax = pad.axisX();
    const jumpPressed = pad.pressed('jump');
    const busy = this.squatT > 0 || this.paddleT > 0;

    // Eject: jump within 4 ticks after down, on the ground or in water. A jump from a held
    // crouch or water duck is a jump (down pressed again with jump leaves her).
    if (jumpPressed && pad.held('down') && t - this.downAt <= S.ejectDownTicks && this.medium !== 'air' && !busy) {
      this.eject('exit');
      return;
    }
    // SWAN DIVE: jump now with fire now or 1 tick before. A jump that came first is a jump (its
    // squat started) and the fire is a shot. Only on ground or a platform; in water she shakes
    // her head; in the air fire + jump is no combo (jump = the glide, fire = a shot).
    if (jumpPressed && !busy && t - this.pressedAt.fire <= TUNING.vehicle.comboWindow) {
      if (this.medium === 'ground' && this.cells > 0) {
        this.pressedAt.fire = this.pressedAt.jump = -1000;
        this.eject('ram');
        return;
      }
      if (this.medium === 'water') this.refuse();
    }
    // HONK: fire + bomb on the same tick or 1 tick apart.
    let comboUsed = false;
    if (this.combo('fire', 'bomb')) {
      this.pressedAt.fire = this.pressedAt.bomb = -1000;
      this.trySpecial();
      comboUsed = true;
    }

    if (this.medium === 'water') this.swimControl(ax, up, down, busy);
    else if (this.medium === 'air') this.airControl(ax, up);
    else this.groundControl(ax, up, down, busy);
    this.jumpControl(pad, jumpPressed);
    this.aimControl(ax, up, down);

    const active = ax !== 0 || up || down || jumpPressed || pad.held('fire') || pad.held('bomb') || Math.abs(this.vx) > 0.1;
    this.idleT = active ? 0 : this.idleT + 1;
    if (!comboUsed) {
      if (pad.pressed('bomb')) this.cannonGun.press();
      if (pad.pressed('fire')) this.mainGun.press();
    }
  }

  /** No control (rise, cheering): brake on the ground and in water, drift in the air. */
  private coast(): void {
    if (this.medium === 'ground') this.vx = approach(this.vx, 0, S.brake);
    else if (this.medium === 'water') this.vx = approach(this.vx, 0, S.swimDrag);
  }

  /** Two-stage start: 0.25 to the 1.5 trot (also through zero), then 0.06; faster than the target brakes. */
  private accelToward(target: number, brake: number): void {
    const dir = Math.sign(target);
    const top = Math.abs(target);
    const along = this.vx * dir;
    if (along > top) this.vx = approach(this.vx, target, brake);
    else if (along < S.trotSpeed) this.vx = approach(this.vx, dir * Math.min(S.trotSpeed, top), S.accel);
    else this.vx = approach(this.vx, target, S.accelHigh);
  }

  private groundControl(ax: number, up: boolean, down: boolean, busy: boolean): void {
    if (busy) return; // the squat keeps her speed
    const ice = iceAt(this.world, this.x);
    const brake = ice ? S.iceDecel : S.brake;
    const skidDecel = ice ? S.iceDecel : S.skidDecel;
    this.setCrouch(down);
    if (this.crouching) {
      // Waddle at 0.8; at a sprint the crouch is a belly slide that eases to 0.8 at the brake rate.
      this.skidding = false;
      if (ax !== 0) this.facing = ax as 1 | -1;
      if (Math.abs(this.vx) > S.crouchSpeed) this.vx = approach(this.vx, Math.sign(this.vx) * S.crouchSpeed, brake);
      else this.vx = approach(this.vx, ax * S.crouchSpeed, S.accel);
      return;
    }
    if (up) {
      // Facing lock: up + back back-pedals (first slowing at the skid rate without turning).
      this.skidding = false;
      if (ax === -this.facing) {
        if (this.vx * this.facing > 0) this.vx = approach(this.vx, 0, skidDecel);
        else this.vx = approach(this.vx, -this.facing * S.backpedalMax, S.accel);
      } else if (ax === this.facing) this.accelToward(ax * S.runMax, brake);
      else this.vx = approach(this.vx, 0, brake);
      return;
    }
    if (this.skidding) {
      if (ax === -this.facing) {
        this.skidT++;
        this.vx = approach(this.vx, this.facing * S.skidEnd, skidDecel);
        if (this.vx * this.facing <= S.skidEnd + 1e-9) {
          this.skidding = false;
          this.facing = ax as 1 | -1;
        }
        return;
      }
      this.skidding = false;
    }
    if (ax !== 0) {
      if (ax === -this.facing && this.vx * this.facing >= S.skidMin) {
        // The SKID: she plants her paddles, keeps facing (and firing) forward, then flips.
        this.skidding = true;
        this.skidT = 0;
        this.vx = approach(this.vx, this.facing * S.skidEnd, skidDecel);
        this.world.audio.sfx('swan/skid');
        return;
      }
      this.facing = ax as 1 | -1;
      this.accelToward(ax * S.runMax, brake);
    } else this.vx = approach(this.vx, 0, brake);
  }

  private airControl(ax: number, up: boolean): void {
    if (ax !== 0 && !up) this.facing = ax as 1 | -1;
    const gliding = this.glide === 'open';
    const cap = gliding ? Math.min(this.airCap, S.glideSpeed) : this.airCap;
    // Up + back aims back-up and keeps her drift (the facing is locked).
    if (ax !== 0 && !(up && ax === -this.facing) && this.vx * ax < cap) this.vx = approach(this.vx, ax * cap, S.airAccel);
    if (gliding && Math.abs(this.vx) > cap) this.vx = approach(this.vx, Math.sign(this.vx) * cap, S.glideDrag);
  }

  private swimControl(ax: number, up: boolean, down: boolean, busy: boolean): void {
    if (busy) return; // the paddle-up keeps her speed
    this.ducking = down;
    const max = this.ducking ? S.duckSpeed : S.swimMax;
    let target = 0;
    if (up) {
      if (ax === -this.facing) target = -this.facing * S.swimBackMax;
      else if (ax === this.facing) target = ax * max;
    } else if (ax !== 0) {
      this.facing = ax as 1 | -1; // she pivots on the spot
      target = ax * max;
    }
    if (target === 0) this.vx = approach(this.vx, 0, S.swimDrag);
    else if (this.vx * target < 0) this.vx = approach(this.vx, 0, S.swimReverse);
    else if (Math.abs(this.vx) > Math.abs(target)) this.vx = approach(this.vx, target, S.swimDrag);
    else this.vx = approach(this.vx, target, S.swimAccel);
  }

  private jumpControl(pad: VirtualPad, pressed: boolean): void {
    const held = pad.held('jump');
    if (!held) this.bufferHold = false;
    if (this.medium === 'ground' || this.medium === 'water') {
      if (pressed) this.jumpBuffer = S.jumpBufferTicks;
      if (this.jumpBuffer > 0 && this.squatT === 0 && this.paddleT === 0 && !this.windingUp) {
        if (this.medium === 'water') this.startPaddle();
        else this.startSquat();
      } else if (this.jumpBuffer > 0 && !pressed) this.jumpBuffer--;
      return;
    }
    // Air. A coyote jump (run off a ledge, pressed within 4 ticks) takes off at once.
    if (pressed && !this.jumped && this.b.ticksSinceGrounded <= S.coyoteTicks) {
      this.overWaterJump = overWaterAt(this.world, this.x);
      this.launch();
      return;
    }
    if (this.glide === 'open') {
      if (!held || ++this.glideT >= S.glideTicks) this.fold();
      else if (this.glideT === S.glideTicks - S.glideTireTicks) this.world.audio.sfx('swan/tired');
    } else if (this.glide === 'ready' && held && this.vy > 0 && !this.bufferHold && !this.windingUp) {
      // Near the floor a press is a buffered jump, not a glide (feel §5.1).
      if (pressed && this.nearFloor()) {
        this.bufferHold = true;
        this.jumpBuffer = S.jumpBufferTicks;
      } else this.openGlide();
    } else if (pressed) this.jumpBuffer = S.jumpBufferTicks;
    if (this.jumpBuffer > 0 && !pressed) this.jumpBuffer--;
  }

  /** Is a landing surface (ground, platform, solid or her float line) within max(16, 6·vy) below? */
  private nearFloor(): boolean {
    const d = Math.max(S.glideBufferMin, S.glideBufferPerVy * this.vy);
    if (Number.isFinite(this.world.terrain.surfaceY(this.x, this.y, this.y + d))) return true;
    const s = waterSurfaceAt(this, this.x, this.y - S.swimDepth);
    return Number.isFinite(s) && s + S.swimDepth <= this.y + d;
  }

  private startSquat(): void {
    this.squatT = S.squatTicks;
    this.jumpBuffer = 0;
    this.skidding = false;
    this.setCrouch(false);
    this.overWaterJump = overWaterAt(this.world, this.x);
    this.world.particles.burst(FX_TRAIL, this.x, this.y - 18, 3, 0.2, 0.7, -Math.PI / 2, 2);
  }

  private startPaddle(): void {
    this.paddleT = S.waterSquatTicks;
    this.jumpBuffer = 0;
    this.ducking = false;
    this.overWaterJump = true;
    this.world.audio.sfx('swan/paddle');
  }

  /** Take off: vy −5.9 from wherever she stands (or floats). */
  private launch(): void {
    const fromWater = this.swimming;
    this.squatT = this.paddleT = 0;
    this.setCrouch(false);
    jump(this, S.jumpVelocity);
    this.airCap = clamp(Math.abs(this.vx), S.airCapMin, S.runMax);
    this.jumped = true;
    this.glide = 'ready';
    this.bufferHold = false;
    this.medium = 'air';
    this.swimming = false;
    this.ducking = false;
    this.skidding = false;
    this.airTopY = this.y;
    this.jumpT = 0;
    this.world.audio.sfx('swan/jump');
    if (fromWater) splash(this.world, this.x, this.y - S.swimDepth, 8);
    else dust(this.world, this.x, this.y, 4);
  }

  private openGlide(): void {
    this.glide = 'open';
    this.glideT = 0;
    // The flap is her only lift: at the apex it raises her 0.4² / 0.12 = 1.3 px at most.
    this.vy = Math.min(this.vy, S.glideFlapVy);
    this.world.audio.sfx('swan/flap');
    this.world.audio.sfxLoop?.(this.loopKey, 'swan/glide');
    this.feathers(this.x - this.facing * 4, this.y - 46, this.world.fxRng.int(4, 6));
  }

  /** The wings fold (released, tired, a landing, 0 cells): no new glide until she lands. */
  private fold(): void {
    if (this.glide === 'open') {
      this.foldT = 2;
      this.world.audio.sfx('swan/fold');
      this.world.audio.stopSfx?.(this.loopKey);
    }
    this.glide = 'folded';
  }

  private aimControl(ax: number, up: boolean, down: boolean): void {
    let target = 0;
    if (this.crouching || this.ducking) target = 0;
    else if (up) target = ax === this.facing ? -Math.PI / 4 : ax === -this.facing ? S.neckMax : -Math.PI / 2;
    else if (down && this.medium === 'air') target = S.neckMin;
    if (this.medium === 'water' && target > 0) target = 0; // no down-aim in water
    this.neckTarget = target;
    this.turnNeck();
  }

  /** The neck turns 22.5° every 2 ticks toward its target, fire held or not (feel §7.2). */
  private turnNeck(): void {
    if (this.neckAngle === this.neckTarget) {
      this.neckT = 0;
      return;
    }
    if (++this.neckT >= S.neckStepTicks) {
      this.neckT = 0;
      this.neckAngle = clamp(approach(this.neckAngle, this.neckTarget, S.neckStep), S.neckMax, S.neckMin);
    }
  }

  /** Neck frame i (0..8) for the current angle: θ = +45° − 22.5°·i. */
  get neckIndex(): number {
    return clamp(Math.round((S.neckMin - this.neckAngle) / S.neckStep), 0, 8);
  }

  /** The SWAN DIVE (or a swim jump into a dive) is refused: she shakes her head (squint). */
  private refuse(): void {
    this.hurtT = S.hurtTicks;
    this.world.audio.sfx('swan/squeak');
  }

  // ------------------------------------------------------------------------------- weapons

  /** fire + bomb: HONK (3 shells, cooldown 240). With too few shells: a sad squeak, nothing else. */
  protected override trySpecial(): void {
    if (this.honkT >= 0 || this.state !== 'driven') return;
    if (this.shells < HK.cost || this.honkCool > 0) {
      this.refuse();
      return;
    }
    this.shells -= HK.cost;
    this.honkT = 0;
    this.honkCool = HK.cooldown;
    this.honkHang = this.medium === 'air';
  }

  /** The HONK runs through `trySpecial` (the wind-up); the base special weapon is not used. */
  protected override special(): boolean {
    return false;
  }

  /** The end of the wind-up: the ring leaves her hull centre (it does not move with her). */
  private fireHonk(): void {
    const h = this.bodyPoint('hull', pt);
    const x = this.x + h[0];
    const y = this.y + h[1];
    if (this.honkGun) this.honkGun.fire(this.fireArgs(x, y, this.facing > 0 ? 0 : Math.PI, 'forward'));
    else spawnHonkRing(this.world, x, y, this.lastDriver, this);
    if (this.swimming) splash(this.world, this.x, this.y - S.swimDepth, 10);
  }

  /** Main gun and shells, after the strips are picked (shots leave from this tick's frames). */
  private fireWeapons(): void {
    const p = this.driver;
    if (!p) return;
    this.mainGun.tick();
    this.cannonGun.tick();
    this.honkGun?.tick();
    if (this.windingUp || this.riseT > 0 || p.cheering) return; // presses stay buffered (6 ticks)
    if (this.mainGun.wants(p.pad.held('fire'))) this.fireMain();
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

  /** The angle a shot leaves at: the neck angle (0 crouched or ducked; never down in water). */
  get shotAngle(): number {
    if (this.crouching || this.ducking) return 0;
    if (this.swimming && this.neckAngle > 0) return 0;
    return this.neckAngle;
  }

  private posture(): Posture {
    if (this.crouching) return 'crouch';
    if (this.ducking && this.swimming) return 'duck';
    return this.swimming ? 'water' : 'land';
  }

  /**
   * The beak tip (world): the body frame's `neck` point plus the neck frame's `muzzle` /
   * `cannon` point, with the look.md §11.3 / §13.7 values for any point the art lacks.
   */
  beakTip(name: 'muzzle' | 'cannon', out: [number, number]): [number, number] {
    const flip = this.facing < 0;
    const socket = this.bodyPoint('neck', pt2);
    const sx = socket[0];
    const sy = socket[1];
    const posture = this.posture();
    const neckId = this.neckName ? this.colorId(this.neckName) : '';
    const tip = neckId && hasSprite(neckId) ? framePoint(getFrame(neckId, this.neckFrame), name, flip, false, out) ?? framePoint(getFrame(neckId, this.neckFrame), 'muzzle', flip, false, out) : undefined;
    if (tip) {
      out[0] = this.x + sx + tip[0];
      out[1] = this.y + sy + tip[1];
      return out;
    }
    const table = MUZZLE_REL[posture];
    const rel = table[Math.min(table.length - 1, posture === 'crouch' || posture === 'duck' ? 0 : this.neckIndex)];
    out[0] = this.x + sx + rel[0] * this.facing;
    out[1] = this.y + sy + rel[1];
    return out;
  }

  protected override fireMain(): void {
    const m = this.beakTip('muzzle', pt);
    const a = this.shotAngle;
    this.mainGun.fire(this.fireArgs(m[0], m[1], aimAngle(this.facing, a), aimDirOf(a)));
    this.fireFaceT = S.fireFaceTicks;
    this.idleT = 0;
  }

  protected override fireCannon(): void {
    const m = this.beakTip('cannon', pt);
    const a = this.shotAngle;
    this.cannonGun.fire(this.fireArgs(m[0], m[1], aimAngle(this.facing, a), aimDirOf(a)));
    this.shellFaceT = S.shellFaceTicks;
    this.idleT = 0;
  }

  // ------------------------------------------------------------------------------- physics

  protected override physics(): Contact {
    const b = this.b;
    const gliding = this.glide === 'open';
    const hang = this.windingUp && this.honkHang && this.medium === 'air';
    b.gravity = hang ? 0 : gliding ? S.glideGravity : S.gravity;
    b.maxFall = gliding ? S.glideMaxFall : S.maxFall;
    if (hang) this.vy = 0;
    const before = this.medium;
    const vyIn = this.vy;
    const x0 = this.x;
    const c = moveBody(this, this.world.terrain, this.world);
    this.odo += (this.x - x0) * this.facing;
    this.swimming = this.floatOnLine();
    this.medium = this.swimming ? 'water' : b.onGround ? 'ground' : 'air';
    this.wading = this.medium === 'ground' && waterRectAt(this.world, this.x, this.y - 1) !== null;
    if (this.medium === 'air') {
      if (before !== 'air') {
        // Ran or walked off a ledge (a jump set these in launch()): her air cap is her speed now.
        this.airTopY = this.y;
        this.airCap = clamp(Math.abs(this.vx), S.airCapMin, S.runMax);
      } else if (this.y < this.airTopY) this.airTopY = this.y;
    }
    const fall = Math.min(vyIn + b.gravity, b.maxFall);
    // A stomp replaces the landing (she may touch the ground on the same tick).
    if (this.state === 'driven' && before === 'air' && !gliding && fall >= S.stompMinVy && this.tryStomp()) return c;
    if (before === 'air' && this.medium === 'ground') this.onLand();
    else if (before !== 'water' && this.medium === 'water') this.onEnterWater(before, fall);
    else if (before === 'water' && this.medium === 'ground') {
      this.settleT = 4;
      this.settleIn = false;
    } else if (before === 'ground' && this.medium === 'air' && this.squatT > 0) this.launch(); // ran off a ledge mid-squat
    return c;
  }

  /**
   * The float line (feel §6.1): a one-way floor 16 px under the surface of every water rect that
   * only she uses. After the move, inside a water rect with y ≥ the line and vy ≥ 0, snap onto it
   * (ground above the line wins: she stands on it and never gets here).
   */
  private floatOnLine(): boolean {
    const w = waterRectAt(this.world, this.x, this.y, S.maxFall + 4);
    if (!w || this.vy < 0) return false;
    const line = w.y + S.swimDepth;
    if (this.y < line - 1e-6) return false;
    this.y = line;
    this.vy = 0;
    this.b.onGround = true;
    this.b.ticksSinceGrounded = 0;
    return true;
  }

  private onLand(): void {
    const fallH = this.y - this.airTopY;
    if (fallH >= S.landShakeFall) {
      this.world.audio.sfx('swan/land');
      dust(this.world, this.x, this.y, 8);
      this.world.camera.shake(1, 4);
    } else dust(this.world, this.x, this.y, 3);
    if (this.state === 'driven') this.landT = S.landTicks;
    if (this.glide === 'open') {
      this.glideLandT = S.glideLandTicks; // she skis in on her paddles
      this.world.audio.stopSfx?.(this.loopKey);
    }
    this.glide = 'ready';
    this.glideT = 0;
    this.jumped = false;
    this.stompChain = 0;
    this.bufferHold = false;
    this.foldT = 0;
  }

  private onEnterWater(before: SwanMedium, fall: number): void {
    if (before === 'air') {
      // The plunge: the sprite dips 2·min(vy, 5) px (max 10) and rises back over 16 ticks.
      this.plungeDepth = Math.min(S.plungeMax, S.plungePerVy * Math.min(Math.max(fall, 0), S.maxFall));
      this.plungeT = S.plungeTicks;
      splash(this.world, this.x, this.y - S.swimDepth, 12);
      this.world.audio.sfx('swan/splash');
    }
    if (this.glide === 'open') this.world.audio.stopSfx?.(this.loopKey);
    this.settleT = 4;
    this.settleIn = true;
    this.glide = 'ready';
    this.glideT = 0;
    this.jumped = false;
    this.stompChain = 0;
    this.bufferHold = false;
    this.crouching = false;
    this.setLow(false);
  }

  /**
   * The STOMP (feel §4.5): falling at ≥ 1.5, her stomp box under the feet touches the top 12 px of
   * soft enemies (infantry, creatures, crates, knifeable slow projectiles; never machines or
   * bosses): 100 'crush' to each (on the topmost touched part), then a bounce that gives the
   * glide back. Returns true when something was stomped.
   */
  private tryStomp(): boolean {
    const box = rectAt(this.x, this.y, STOMP_REL, this.facing < 0, stompRect);
    const list = this.world.snapshotTag('shootable');
    let hits = 0;
    try {
      for (let i = 0; i < list.length; i++) {
        const t = list[i];
        if (!t.alive || t.team !== 'enemy' || !t.hasTag('soft') || t.hasTag('boss')) continue;
        const boxes = t.hurtboxes();
        let part = -1;
        let top = Infinity;
        for (let k = 0; k < boxes.length; k++) {
          const hb = boxes[k];
          bandRect.x = hb.x;
          bandRect.y = hb.y;
          bandRect.w = hb.w;
          bandRect.h = Math.min(S.stompTopBand, hb.h);
          if (hb.y < top && overlaps(box, bandRect)) {
            top = hb.y;
            part = k;
          }
        }
        if (part < 0) continue;
        this.world.damage(t, { amount: S.stompDamage, kind: 'crush', dirX: this.facing, source: this, owner: this.lastDriver, weapon: 'swan-stomp' }, part);
        hits++;
      }
    } finally {
      this.world.releaseSnapshot();
    }
    if (hits === 0) return false;
    jump(this, S.stompBounceVy);
    this.medium = 'air';
    this.swimming = false;
    this.glide = 'ready';
    this.airTopY = this.y;
    this.stompT = 4;
    this.jumpT = 4;
    this.landT = 0;
    this.world.audio.sfx('swan/stomp');
    this.world.camera.shake(2, 6);
    if (++this.stompChain === S.stompGag) {
      // Three stomps without touching the ground: she waggles her tail and honks once.
      this.world.audio.sfx('swan/honk', { vol: 0.6, pitch: 1.2 });
      hudOf(this.world).bubble(this, 'HONK!', { kind: 'gag', ticks: 40 });
    }
    return true;
  }

  // ------------------------------------------------------------------------------- damage

  /** Ground shockwaves miss her while she swims; other hits as GDD §8.1. */
  override onHit(d: Damage): boolean {
    if (this.state !== 'driven' || this.dead) return false;
    if (this.swimming && damageHas(d, 'shockwave')) return false;
    const before = this.cells;
    const absorbed = super.onHit(d);
    if (this.cells < before && this.state === 'driven') {
      // She flinches: a squint, a 1 px jolt backward and two tin feathers.
      this.hurtT = S.hurtTicks;
      this.joltT = S.joltTicks;
      this.feathers(this.x, this.y - 40, 2);
    }
    return absorbed;
  }

  /** 0 cells (8.1): her wings fold at once; a jump press ejects her pilot anywhere (doomed state). */
  protected override cellsGone(): void {
    this.fold();
    this.squatT = this.paddleT = 0;
    this.honkT = -1;
    super.cellsGone();
  }

  protected override lowCellWarning(): void {
    if (this.cells > 1) return;
    const t = this.world.tick;
    if (t % 6 === 0) {
      const s = this.bodyPoint('smoke', pt);
      smokeTrail(this.world, this.x + s[0], this.y + s[1], true);
    }
    if (t % 30 === 0) this.world.particles.burst(FX_SPARK, this.x - this.facing * 4, this.y - 18, 3, 0.5, 1.6);
    if (t % 60 === 0) this.world.audio.sfx('vehicle/warning');
  }

  /** Hurtboxes by pose (GDD §8.2 Size): standing legs + hull + rider; crouched; swimming; ducked. */
  override hurtboxes(): readonly Rect[] {
    const set = this.crouching ? HURT_REL.crouch : this.swimming ? (this.ducking ? HURT_REL.duck : HURT_REL.swim) : HURT_REL.stand;
    const out = set.length === 3 ? this.hurt3 : set.length === 2 ? this.hurt2 : this.hurt1;
    const flip = this.facing < 0;
    for (let i = 0; i < set.length; i++) rectAt(this.x, this.y, set[i], flip, out[i]);
    return out;
  }

  /**
   * The 0-cell wreck (8.1): the blast (200 in r 40), then she bursts out of the smoke, sooty, and
   * flies off (`migrate-soot`): she never dies on screen, but she is lost.
   */
  override explode(damage = this.wreckDamage, radius = this.wreckRadius): void {
    if (this.removed || this.phase === 'migrate') return;
    if (this.driver) this.eject('forced');
    const h = this.bodyPoint('hull', pt);
    explosion(this.world, this.x + h[0], this.y + h[1], 'l', {
      damage,
      radius,
      falloff: 0,
      team: 'player',
      owner: this.lastDriver,
      debris: 'metal',
      weapon: 'swan-wreck',
    });
    this.feathers(this.x, this.y - 30, 6);
    this.startMigrate(true);
  }

  // ------------------------------------------------------------------------------- SWAN DIVE

  /** The ram as phases of the base 'ram' state: hiss → charge → bash → daze (or migrate). */
  protected override updateRam(): void {
    this.phaseT++;
    switch (this.phase) {
      case 'hiss':
        this.vx = approach(this.vx, 0, 0.5);
        this.physics();
        if (this.phaseT >= D.hissTicks) {
          this.phase = 'dive';
          this.phaseT = 0;
          this.diveStartX = this.x;
          this.trampled.length = 0;
          this.odo = 0;
        }
        break;
      case 'dive':
        this.updateCharge();
        break;
      case 'bash':
      case 'tumble':
      case 'dazed':
        this.impactT++;
        if (this.medium !== 'air') this.vx = approach(this.vx, 0, this.medium === 'water' ? S.swimDrag : S.brake);
        this.physics();
        if (this.phase === 'bash' && this.phaseT >= D.bashTicks) this.setPhase('tumble');
        else if (this.phase === 'tumble' && this.phaseT >= D.tumbleTicks) {
          this.setPhase('dazed');
          this.world.audio.sfx('swan/dazed');
        } else if (this.phase === 'dazed' && this.impactT >= D.dazedTicks) this.setPhase('right');
        break;
      case 'right':
        this.vx = approach(this.vx, 0, S.brake);
        this.physics();
        if (this.phaseT >= D.rightingTicks) {
          this.setPhase('shake');
          this.feathers(this.x, this.y - 30, 3);
        }
        break;
      case 'shake':
        this.physics();
        if (this.phaseT >= D.shakeTicks) {
          // Ridable again: she sits down (or floats) and the RIDE? bubble comes back.
          this.state = 'idle';
          this.emptyT = 0;
          this.setPhase(this.swimming ? 'float' : 'sit');
          this.setLow(!this.swimming);
        }
        break;
      default:
        this.physics();
    }
  }

  private setPhase(p: SwanPhase): void {
    this.phase = p;
    this.phaseT = 0;
  }

  /** The charge: 0.25 up to 3.4 px/tick for up to 192 px, trampling soft enemies on the way. */
  private updateCharge(): void {
    // Something pushed her back since the last tick (a body wall like the ENCORE wall): a wall.
    const pushedBack = (this.x - this.lastX) * this.facing < -0.5;
    this.vx = approach(this.vx, this.facing * D.speed, D.accel);
    const c = this.physics();
    if (this.phaseT % 3 === 0) dust(this.world, this.x - this.facing * 10, this.y, 1);
    const box = rectAt(this.x, this.y, DIVE_REL, this.facing < 0, diveRect);
    const list = this.world.snapshotTag('shootable');
    let hard = false;
    try {
      for (let i = 0; i < list.length && !hard; i++) {
        const t = list[i];
        if (!t.alive || t.team !== 'enemy' || t.hasTag('shot')) continue;
        const boxes = t.hurtboxes();
        let part = -1;
        for (let k = 0; k < boxes.length && part < 0; k++) if (overlaps(box, boxes[k])) part = k;
        if (part < 0) continue;
        if (t.hasTag('soft') && !t.hasTag('boss')) {
          if (this.trampled.includes(t)) continue;
          this.trampled.push(t);
          this.world.damage(t, { amount: D.trample, kind: 'crush', dirX: this.facing, source: this, owner: this.lastDriver, weapon: 'swan-dive' }, part);
        } else hard = true;
      }
    } finally {
      this.world.releaseSnapshot();
    }
    const ran = Math.abs(this.x - this.diveStartX);
    const intoWater = this.swimming || (this.medium === 'air' && waterRectAt(this.world, this.x, this.y) !== null);
    // The view edge ahead is a wall too (as for a driven vehicle): she never bashes out of sight.
    const edge = (this.world.camera.clampX(this.x, S.bodyW / 2) - this.x) * this.facing < 0;
    if (hard || pushedBack || c.hitWall || edge || intoWater || ran >= D.distance || this.phaseT >= D.maxTicks) this.bash(intoWater);
  }

  /**
   * BEAK BASH: 400 in r 40 (each target once, no falloff) with tin feathers and bolts instead of
   * fire; −1 cell. With 2 or more cells she bounces back onto her back (dazed); with 1 she
   * migrates and is lost.
   */
  private bash(inWater: boolean): void {
    const bx = this.x + this.facing * 24;
    const by = this.y - 24;
    bashFx(this.world, bx, by, D.damage, D.radius, this.lastDriver);
    this.world.camera.shake(D.shake, D.shakeTicks2);
    const survives = this.cells >= 2;
    this.cells = Math.max(0, this.cells - D.cellCost);
    this.impactT = 0;
    if (!survives) {
      this.startMigrate(false);
      return;
    }
    this.setPhase('bash');
    this.setLow(true);
    if (inWater || this.swimming) this.vx = 0;
    else {
      this.vx = D.bounceVx * this.facing;
      jump(this, D.bounceVy);
      this.medium = 'air';
    }
  }

  /** She flies off up and forward, honking, and is removed above the view (feel §9.2). */
  private startMigrate(soot: boolean): void {
    if (this.driver) this.eject('forced');
    this.phase = 'migrate';
    this.phaseT = 0;
    this.soot = soot;
    this.dead = true;
    this.cells = 0;
    this.removeTag('shootable');
    this.perch.enabled = false;
    this.b.collide = false;
    this.vx = D.migrateVx * this.facing;
    this.vy = D.migrateVy;
    if (this.glide === 'open') this.world.audio.stopSfx?.(this.loopKey);
    this.world.audio.sfx('swan/migrate');
    const spot = this.radioSpot;
    spot.x = clamp(this.x, this.world.camera.left + 70, this.world.camera.right - 70);
    spot.y = this.y - 40;
    hudOf(this.world).bubble(spot, "GRAMPS: SHE'LL BE BACK\nIN SPRING.", { kind: 'radio', ticks: 150, speaker: 'gramps' });
    this.world.particles.emit(FEATHER_SLOW, this.x, this.y - 30, 0.2 * this.facing, -0.3);
    if (!soot) this.world.events.emit('vehicleDestroyed', { vehicle: this });
    refreshSwanCamera(this.world);
  }

  private updateMigrate(): void {
    this.phaseT++;
    this.x += this.vx;
    this.y += this.vy;
    const cam = this.world.camera;
    if (this.y + 4 < cam.top - D.migrateGone || this.x < cam.left - 400 || this.x > cam.right + 400) this.remove();
  }

  // ------------------------------------------------------------------------------- riderless

  private updateEmpty(): void {
    this.tickTimers();
    this.phaseT++;
    if (this.medium === 'ground') this.vx = approach(this.vx, 0, S.brake);
    else if (this.medium === 'water') this.vx = approach(this.vx, 0, S.swimDrag);
    this.physics();
    // Follow the medium she is in.
    if (this.medium === 'water' && this.phase !== 'float') this.setPhase('float');
    else if (this.medium === 'air' && this.phase !== 'drop') this.setPhase('drop');
    else if (this.medium === 'ground' && (this.phase === 'float' || this.phase === 'drop')) {
      this.setPhase('sit');
      this.setLow(true);
    }
    switch (this.phase) {
      case 'stand':
        if (this.phaseT >= S.standTicks) {
          this.setPhase('sit');
          this.setLow(true);
        }
        break;
      case 'sit':
        if (this.phaseT >= S.sitTicks) {
          this.setPhase('parked');
          smokeTrail(this.world, this.x - this.facing * 20, this.y - 26);
        }
        break;
      case 'parked':
        // Left alone long enough, she lays her nervous egg (once).
        if (++this.emptyT >= S.eggAfter && !this.laid) {
          this.laid = true;
          this.setPhase('lay');
        }
        break;
      case 'lay':
        if (this.phaseT === S.layEggAt) this.layEgg();
        if (this.phaseT >= sum(S.layDurations)) this.setPhase('parked');
        break;
      case 'float':
        this.waterCatch();
        break;
    }
    this.showRideHint();
  }

  /**
   * After an eject in water she catches her own pilot (8.2 Water): from tick 30 to 90, while she
   * floats empty and in one piece, when he falls (vy > 0) with his feet in her water seat zone.
   */
  private waterCatch(): void {
    const p = this.catchPilot;
    if (!p) return;
    if (++this.catchT > S.catchTicks || this.cells <= 0 || p.removed) {
      this.catchPilot = null;
      return;
    }
    if (this.catchT < S.catchFrom || p.state !== 'play' || p.vy <= 0 || p.status.noMount) return;
    footRect.x = p.x - 4;
    footRect.y = p.y - 4;
    footRect.w = 8;
    footRect.h = 5;
    if (overlaps(footRect, this.seatRect())) this.mount(p);
  }

  private layEgg(): void {
    const ex = this.x + EGG_POINT[0] * this.facing;
    const ey = this.world.terrain.surfaceY(ex, this.y - 16, this.y + 24);
    this.world.add(new SwanEgg(this.world, ex, Number.isFinite(ey) ? ey : this.y + EGG_POINT[1], this.facing));
    const spot = this.radioSpot;
    spot.x = this.x;
    spot.y = this.y - 30;
    hudOf(this.world).bubble(spot, "SHE DOES THAT WHEN\nSHE'S NERVOUS.", { kind: 'radio', ticks: 150, speaker: 'gramps' });
  }

  // ------------------------------------------------------------------------------- co-op perch

  /** On while she stands, runs, crouches, skids, swims or is parked; off for land jumps and the dive. */
  private perchOn(): boolean {
    if (this.dead || this.state === 'ram' || this.state === 'wreck') return false;
    const jumping = this.squatT > 0 || (this.medium === 'air' && this.jumped);
    return !jumping || this.overWaterJump;
  }

  /** Move the perch with her (`world.moveSolid` carries a partner standing on it). */
  private updatePerch(): void {
    const box = this.perch;
    // Her deck top: the frame's hull offset (the run bob is left out, so a partner rides steady).
    const dy = this.bodyName === 'run' || this.bodyName === 'move' ? 0 : this.hullDy();
    const top = this.swimming ? (this.ducking ? PERCH_TOP.duck : PERCH_TOP.swim) : PERCH_TOP.stand + dy;
    const tx = this.facing > 0 ? this.x + S.perch[0] : this.x - S.perch[0] - S.perch[1];
    const ty = this.y + top;
    if (!this.perchOn()) {
      box.enabled = false;
      box.x = tx;
      box.y = ty;
      return;
    }
    if (!box.enabled) {
      box.x = tx;
      box.y = ty;
      box.enabled = true;
      return;
    }
    this.world.moveSolid(box, tx - box.x, ty - box.y);
  }

  // ------------------------------------------------------------------------------- animation

  protected override animate(): void {
    this.riderShown = false;
    this.overlay = false;
    this.neckName = '';
    this.riderFrame = -1;
    const t = this.world.tick;
    if (this.phase === 'migrate') {
      this.show(this.soot ? 'migrate-soot' : 'migrate', loopFrame(4, 4, t));
      return;
    }
    if (this.state === 'driven' || this.state === 'doomed') this.animateRidden(t);
    else if (this.state === 'ram') this.animateDive(t);
    else if (this.state === 'wreck') this.show('wreck', loopFrame(2, 6, t));
    else this.animateEmpty(t);
    this.overlay = RIDER_STRIPS.has(this.bodyName);
  }

  private animateRidden(t: number): void {
    const rider = this.driver !== null;
    if (this.state === 'doomed') {
      this.show('wreck', loopFrame(2, 6, t));
      this.ridePose('hold', -1, rider);
      return;
    }
    if (this.riseT > 0) {
      this.show('rise', frameAt(RISE_D, S.riseTicks - this.riseT));
      this.ridePose(this.pickPose(), -1, rider);
      return;
    }
    if (this.honkT >= 0) {
      const f = frameAt(HONK_D, this.honkT);
      this.show(this.medium === 'air' ? 'honk-air' : this.medium === 'water' ? 'honk-swim' : 'honk', f);
      this.neckName = 'neck-honk';
      this.neckFrame = HONK_NECK[f];
      this.ridePose(this.pickPose(), -1, rider);
      return;
    }
    if (this.medium === 'water') this.animateSwim(t);
    else if (this.medium === 'air') this.animateAir(t);
    else this.animateGround(t);
    this.pickNeck();
    this.ridePose(this.pickPose(), this.pickRiderFrame(), rider);
  }

  private animateSwim(t: number): void {
    if (this.paddleT > 0) this.show('paddle-up', (S.waterSquatTicks - this.paddleT) >> 1);
    else if (this.settleT > 0) this.show('settle', this.settleIn ? (this.settleT > 2 ? 0 : 1) : 1);
    else if (this.ducking) this.show('water-duck', loopFrame(2, 24, t));
    else this.showSwim(Math.abs(this.vx) > 0.2);
  }

  /** The swim strip: 6 ticks per frame moving, 16 still; a power stroke (f0, f2) paddles. */
  private showSwim(moving: boolean): void {
    this.swimClock += moving ? 1 / 6 : 1 / 16;
    const f = Math.floor(this.swimClock) % 4;
    if (f !== this.lastSwimFrame && (f === 0 || f === 2) && this.driver) this.world.audio.sfx('swan/paddle', moving ? PADDLE_LOUD : PADDLE_SOFT);
    this.lastSwimFrame = f;
    this.show('swim', f);
  }

  private animateAir(t: number): void {
    if (this.glide === 'open') {
      if (this.glideT < 6) this.show('flap', this.glideT < 3 ? 0 : 1);
      else if (this.glideT >= S.glideTicks - S.glideTireTicks) this.show('glide-tired', loopFrame(2, 2, t));
      else this.show('glide', loopFrame(2, 8, t));
      if (t % 4 === 0) this.windStreaks();
    } else if (this.foldT > 0) this.show('fold', 0);
    else if (this.stompT > 0) this.show('stomp', 0);
    else if (this.vy < 0) this.show('jump', this.jumpT < 4 ? 0 : 1);
    else this.show('fall', loopFrame(2, 6, t));
  }

  private animateGround(t: number): void {
    if (this.squatT > 0) this.show('squat', frameAt(SQUAT_D, S.squatTicks - this.squatT));
    else if (this.crouching) {
      const s = Math.abs(this.vx);
      if (s > S.crouchSpeed + 0.05) this.show('slide', loopFrame(2, 3, t));
      else if (s > 0.05) this.show('waddle', mod(Math.floor(this.odo / 3), 6));
      else this.show('crouch', loopFrame(2, 24, t));
    } else if (this.skidding) {
      this.show('skid', this.skidT < 3 ? 0 : 1);
      if (t % 2 === 0) this.world.particles.burst(FX_SPARK, this.x + this.facing * 10, this.y - 1, 2, 0.4, 1.4);
    } else if (this.glideLandT > 0) this.show('skid', 1);
    else if (this.landT > 0) this.show('land', frameAt(LAND_D, S.landTicks - this.landT));
    else if (this.settleT > 0) this.show('settle', this.settleT > 2 ? 1 : 0);
    else if (Math.abs(this.vx) > 0.05) {
      // The run odometer: one frame per 6 px along her facing (backward while back-pedalling).
      const f = mod(Math.floor(this.odo / 6), 8);
      if (f !== this.lastRunFrame && (f === 0 || f === 4)) {
        this.step(f === 0 ? 1 : -1);
        if (this.cells <= 1 && ++this.contacts % 4 === 0) {
          this.limpT = LIMP_TICKS;
          this.limpFrame = f;
        }
      }
      this.lastRunFrame = f;
      // The limp (look.md §10.2): the hitching contact frame stays up after the odometer moved on.
      if (this.limpT > 0 && f !== this.limpFrame) {
        this.limpT--;
        this.show('run', this.limpFrame);
      } else this.show('run', f);
    } else this.show('idle', loopFrame(2, 24, t));
  }

  /** A foot contact: `swan/step` and dust (a splash while she wades). */
  private step(side: number): void {
    const fx = this.x + (side > 0 ? 6 : -4) * this.facing;
    if (this.wading) splash(this.world, fx, this.y, 3);
    else dust(this.world, fx, this.y, 2);
    this.world.audio.sfx('swan/step', STEP_SFX);
  }

  /** The neck strip for the posture and the face (look.md §9, §11). */
  private pickNeck(): void {
    const name = this.bodyName;
    if (SELF_CONTAINED.has(name)) return;
    const posture = CROUCH_STRIPS.has(name) ? 'crouch-neck' : name === 'water-duck' ? 'duck-neck' : this.swimming && this.hullDy() >= 10 ? 'swim-neck' : 'neck';
    const single = posture === 'crouch-neck' || posture === 'duck-neck';
    if (this.idleT >= S.neckRelaxTicks && !single) {
      this.neckName = posture === 'swim-neck' ? 'swim-neck-relax' : 'neck-relax';
      this.neckFrame = this.blinkT > 0 ? 1 : 0;
      return;
    }
    const face = this.shellFaceT > 0 ? '-shell' : this.fireFaceT > 0 ? '-fire' : this.hurtT > 0 ? '-hurt' : this.blinkT > 0 ? '-blink' : '';
    this.neckName = face ? NECK_FACE[posture][face] : posture;
    this.neckFrame = single ? 0 : this.neckIndex;
  }

  /** The rider pose: the first matching rule of look.md §6.3. */
  private pickPose(): RidePose {
    const name = this.bodyName;
    const f = this.bodyFrame;
    const i = this.neckIndex;
    if (this.driver?.cheering || this.bossCheer) return 'cheer';
    if (this.honkT >= 0) return 'ears';
    if (CROUCH_STRIPS.has(name)) return 'duck';
    if (name === 'water-duck') return 'hunch';
    if (i >= 7 && name !== 'rise') return 'hunch';
    if (name === 'squat' || name === 'flap' || name === 'glide-tired' || name === 'wreck' || (name === 'jump' && f === 0) || (name === 'paddle-up' && f <= 2)) return 'hold';
    if ((name === 'land' && f === 0) || name === 'stomp' || (name === 'settle' && f === 0) || this.hurtT > 0) return 'brace';
    if (((i === 5 || i === 6) && name !== 'rise') || name === 'skid') return 'up';
    if (name === 'run' || name === 'glide' || (name === 'jump' && f === 1) || (name === 'paddle-up' && f === 3)) return 'lean';
    return 'sit';
  }

  /** Rider frames synced to the body (look.md §6.3 and §10), else -1 (the strip's own timing). */
  private pickRiderFrame(): number {
    const name = this.bodyName;
    const f = this.bodyFrame;
    if (name === 'run') return f === 1 || f === 5 ? 1 : 0;
    if (name === 'glide' || name === 'glide-tired' || name === 'squat' || name === 'flap') return f & 1;
    if (name === 'paddle-up') return f === 1 ? 1 : 0;
    return -1;
  }

  private ridePose(pose: RidePose, frame: number, shown: boolean): void {
    this.riderPose = pose;
    this.riderFrame = frame;
    this.riderShown = shown;
  }

  private animateDive(t: number): void {
    switch (this.phase) {
      case 'hiss':
        this.show('hiss', frameAt(HISS_D, this.phaseT));
        break;
      case 'dive':
        this.show('dive', mod(Math.floor(this.odo / 8), 8));
        break;
      case 'bash':
        this.show('bash', 0);
        break;
      case 'tumble':
        this.show('tumble', this.phaseT < 4 ? 0 : 1);
        break;
      case 'right':
        this.show('right', frameAt(TRIPLE_4, this.phaseT));
        break;
      case 'shake':
        this.show('shake', frameAt(DOUBLE_4, this.phaseT));
        break;
      default:
        this.show('dazed', loopFrame(4, 8, t));
    }
  }

  private animateEmpty(t: number): void {
    switch (this.phase) {
      case 'stand':
        // She stands and looks around for 20 ticks.
        this.show('idle', loopFrame(2, 24, t));
        this.neckName = 'neck-relax';
        this.neckFrame = this.phaseT > 10 ? 1 : 0;
        break;
      case 'sit':
        this.show('sit-down', frameAt(SIT_D, this.phaseT));
        break;
      case 'lay':
        this.show('empty-lay', frameAt(S.layDurations, this.phaseT));
        break;
      case 'float':
        this.showSwim(Math.abs(this.vx) > 0.2);
        this.neckName = 'swim-neck-relax';
        this.neckFrame = this.blinkT > 0 ? 1 : 0;
        break;
      case 'drop':
        this.show('fall', loopFrame(2, 6, t));
        this.neckName = 'neck-relax';
        this.neckFrame = 0;
        break;
      default:
        this.showParked(t);
    }
  }

  /** Parked: head tucked; her eye follows the nearest player on foot within 96 px. */
  private showParked(t: number): void {
    const p = this.world.nearestPlayer(this.x, this.y);
    if (!p || Math.abs(p.x - this.x) > S.lookRange || Math.abs(p.y - this.y) > S.lookRange) {
      this.show('empty', loopFrame(2, 30, t));
      return;
    }
    if (this.blinkT > 0) {
      this.show('empty-look', 4);
      return;
    }
    const ahead = (p.x - this.x) * this.facing >= 0;
    const high = p.y < this.y - 24;
    this.show('empty-look', (high ? 2 : 0) + (ahead ? 1 : 0));
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    if (!this.anim.id) return;
    const flip = this.facing < 0;
    const tick = this.world.tick;
    // Unrounded (sub-pixel at res > 1): body, scuffs, rider, overlay and neck all add whole-pixel
    // points to this one origin, so they stay locked together.
    let ox = this.x;
    let oy = this.y;
    if (this.joltT > 0) ox -= this.facing;
    if (this.swimming && this.phase !== 'migrate') {
      oy += Math.round(Math.sin((tick / S.bobPeriod) * Math.PI * 2) * S.bobAmp);
      if (this.plungeT > 0) oy += Math.round((this.plungeDepth * this.plungeT) / S.plungeTicks);
    }
    const ridden = this.state === 'driven' || this.state === 'doomed';
    drawOpts.flipX = flip;
    drawOpts.flash = (this.flashTicks > 0 || this.state === 'doomed') && tick % 2 === 0;
    // 1 body · 2 scuffs · 3 rider · 4 front overlay · 5 neck (look.md §7)
    r.sprite(this.anim.id, this.anim.index, ox, oy, drawOpts);
    this.drawScuffs(r, ox, oy, drawOpts);
    if (ridden && this.riderShown && this.driver) {
      const s = this.bodyPoint('seat', pt);
      this.driver.drawRide(r, ox + s[0], oy + s[1], flip, this.riderPose, this.riderFrame >= 0 ? this.riderFrame : undefined);
    }
    this.drawLayers(r, ox, oy, drawOpts);
    // Last armour cell: the red tint on her sprites, never on the rider.
    if (ridden && this.cells <= 1 && tick % 20 < 6) {
      tintOpts.flipX = flip;
      r.sprite(this.anim.id, this.anim.index, ox, oy, tintOpts);
      this.drawLayers(r, ox, oy, tintOpts);
    }
    if (this.phase === 'dazed') this.drawDizzy(r, ox, oy);
  }

  /** The front overlay and the neck (steps 4 and 5). */
  private drawLayers(r: Renderer, ox: number, oy: number, o: DrawOpts): void {
    if (this.overlay) {
      const id = this.colorId(FRONT.get(this.bodyName) ?? this.bodyName);
      if (hasSprite(id)) r.sprite(id, this.anim.index, ox, oy, o);
    }
    if (this.neckName) {
      const n = this.bodyPoint('neck', pt);
      r.sprite(this.colorId(this.neckName), this.neckFrame, ox + n[0], oy + n[1], o);
    }
  }

  private drawScuffs(r: Renderer, ox: number, oy: number, o: DrawOpts): void {
    if (this.cells > 2 || this.dead || !LOW_TILT.has(this.bodyName) || !hasSprite('vehicle/swan/scuffs')) return;
    const h = this.bodyPoint('hull', pt);
    r.sprite('vehicle/swan/scuffs', this.cells <= 1 ? 1 : 0, ox + h[0], oy + h[1], o);
  }

  /** Three tin feathers circle her head while she is dazed. */
  private drawDizzy(r: Renderer, ox: number, oy: number): void {
    const f = this.anim.id ? framePoint(getFrame(this.anim.id, this.anim.index), 'head', this.facing < 0, false, pt) : undefined;
    const hx = ox + (f ? f[0] : this.facing * 24);
    const hy = oy + (f ? f[1] : -12);
    const a0 = this.world.tick * 0.12;
    for (let i = 0; i < 3; i++) {
      const a = a0 + (i * Math.PI * 2) / 3;
      const fx = Math.round(hx + Math.cos(a) * 9);
      const fy = Math.round(hy - 6 + Math.sin(a) * 3);
      if (hasSprite('fx/tin-feather')) r.sprite('fx/tin-feather', (this.world.tick >> 2) + i, fx, fy);
      else {
        r.rect(fx - 1, fy, 3, 1, PAL.snow[3]);
        r.rect(fx + 2, fy, 1, 1, PAL.navy[1]);
      }
    }
  }

  // ------------------------------------------------------------------------------- fx

  private feathers(x: number, y: number, n: number): void {
    const preset = hasSprite('fx/tin-feather') ? FEATHER_SPRITE : FEATHER_RECT;
    this.world.particles.burst(preset, x, y, n, 0.4, 1.6, -Math.PI / 2, 2.4);
  }

  private windStreaks(): void {
    const p = this.world.particles;
    p.emit(WIND, this.x - this.facing * 30, this.y - 54, -this.facing * 1.5, 0);
    p.emit(WIND, this.x + this.facing * 6, this.y - 56, -this.facing * 1.5, 0);
  }

  // ------------------------------------------------------------------------------- leaving

  override onRemove(): void {
    super.onRemove();
    this.world.audio.stopSfx?.(this.loopKey);
    this.engine(null);
    this.offBoss();
    this.offLoops();
    this.catchPilot = null;
    this.radioSpot.removed = true;
    refreshSwanCamera(this.world);
  }
}

/** Neck strip ids with a face (look.md §9): `<posture>-fire|-shell|-blink|-hurt`, built once. */
const NECK_FACE: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze(
  Object.fromEntries(
    ['neck', 'swim-neck', 'crouch-neck', 'duck-neck'].map((p) => [
      p,
      Object.freeze({ '-fire': `${p}-fire`, '-shell': `${p}-shell`, '-blink': `${p}-blink`, '-hurt': `${p}-hurt` }),
    ]),
  ),
);

/** Sound options used every few ticks (no allocation per stroke or step). */
const PADDLE_LOUD = Object.freeze({ vol: 0.8 });
const PADDLE_SOFT = Object.freeze({ vol: 0.4 });
const STEP_SFX = Object.freeze({ vol: 0.7 });

/** 1 px snow wind streaks from her wing tips while she glides. */
const WIND: ParticlePreset = { kind: 'rect', w: 4, h: 1, life: 10, drag: 0.92, colors: [PAL.snow[3], PAL.sky[3]], fadeFrom: 0.3, alpha: 0.8 };

function sum(list: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < list.length; i++) s += list[i];
  return s;
}

/**
 * The BEAK BASH blast: no fireball, but tin feathers, bolts and sparks. Each enemy target is hit
 * once, no falloff; `explosion/l`; the 'explosion' event (gags notice it).
 */
function bashFx(world: World, x: number, y: number, damage: number, radius: number, owner: number): void {
  blast(world, x, y, radius, damage, 'player', { kind: 'explosion', owner, falloff: 0, weapon: 'swan-dive' });
  const p = world.particles;
  p.burst(FX_SPARK, x, y, 14, 1, 3.4);
  p.burst(hasSprite('fx/tin-feather') ? FEATHER_SPRITE : FEATHER_RECT, x, y, 8, 0.6, 2.4, -Math.PI / 2, 2.8);
  p.burst(FX_TRAIL, x, y, 6, 0.3, 1.2);
  debris(world, x, y, 'metal', 8);
  world.audio.sfx('explosion/l');
  world.events.emit('explosion', { x, y, r: radius, team: 'player', owner, size: 'l' });
}

/** Is this entity a SWAN-3? (HUD, title scene, missions) */
export function isSwan(e: Entity | null | undefined): e is Swan {
  return e instanceof Swan;
}
