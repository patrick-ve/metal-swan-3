/**
 * The wagon: the players' vehicle on the ring (docs/design/ring.md §3, §9; docs/api/ring.md §5).
 * Owner: the WAGON builder.
 *
 * `Wagon extends Vehicle`: `cells` are the armour (`cellDamage`, `repair`, `mount`, the HUD's
 * vehicle panel; `shells` mirror the hero's grenades for the HUD); it overrides `control` and
 * `physics` (no terrain: it moves in the plane) and its whole `update`. The hero (`RingHero`)
 * never leaves it (spec §0 row 15). Two liveries (content/ring/wagon/geometry.ts `liveryOf`): 1P
 * and P1 white, P2 green.
 *
 * - Steer (FIRE released): up / down = toward the next lane (a press picks the next lane, holding
 *   keeps going lane by lane; a lane change takes `RING.laneChangeTicks`; on release the change
 *   finishes in that lane); left / right = forward / back on screen inside the band
 *   `RING.screenMinX … screenMaxX` (the wagon's centre). A forward push tilts the nose up, a
 *   brake dips it, a lane change leans the car (body poses).
 * - Steer lock (FIRE held): lane and screen x hold; the hero reads the D-pad as his 8-way aim.
 * - JUMP = swerve: one lane toward the held up / down (else away from the nearest threat in the
 *   lane, else away from the near / far edge) in `RING.swerveTicks`, `swerveInvuln` ticks without
 *   damage, then `swerveCooldown`. A swerve into a small vehicle (tag `ring-small`, or a
 *   `ring-scooter` / `ring-handhaver-moto`) is a SIDE RAM: `SIDE_RAM` damage tagged
 *   `ram` + `side-ram` (it knocks the rider off) and no cost to the wagon.
 * - Armour: `RING.wagonCells` cells. A bullet ½, a thrown object / bump / explosion 1, a ram
 *   (Damage tag 'ram') 2, crush or a 'hazard' all; Damage tag `bump-light` ½; `RING.wagonHitInvuln`
 *   ticks after a hit; god mode costs nothing. Damage states: dents (≤ 7.5) → broken glass (≤ 5)
 *   → smoke (≤ 2.5) → fire (≤ 1.5). 0 cells: `wreck()` — the wagon spins out onto the hard
 *   shoulder (spin frames), the hero and the driver tumble out (no harm shown), the hero loses a
 *   life (`RingHero.wrecked`); `RING.respawnTicks` later a fresh wagon with the same driver drives
 *   in from the left (`spawnWagon(hero, 'respawn')`) with `RING.driveInBlink` blinking ticks.
 * - `bump(o)`: traffic and road things push the wagon (the ROAD builder's civilians call it): a
 *   shove in x and / or a lane bounce, the cost in cells (default 1), a driver line. Two wagons
 *   bump each other by themselves (a push, no damage, spec §9).
 * - The driver: one squad hero per player for the whole level (`driverId`), drawn behind the front
 *   door glass with his own `ride-*` strips; he talks (`say(event)`: content/ring/wagon/lines.ts).
 * - Scripted (`scripted`): the boarding scene and the exit (boarding.ts) place the wagon, its
 *   facing ('left' shows the never-mirrored left side) and its spin frame themselves.
 * - States (Vehicle's): 'driven' (with `arriving` during a drive-in), 'wreck'; 'idle' only when
 *   spawned without a hero (the content tests): it parks.
 */
import { damageHas, type Damage, type Entity } from '../../engine/entity';
import type { VirtualPad } from '../../engine/input';
import { approach, overlaps, type Rect } from '../../engine/math';
import type { DrawOpts, Renderer } from '../../engine/render';
import { frameCount, getFrame, hasSprite, type Frame } from '../../engine/sprites';
import type { World } from '../../engine/world';
import { CABIN_LEFT, ID, liveryOf, POSE, SEAT, type BodyPose, type BodyState, type Livery } from '../content/ring/wagon/geometry';
import { ALWAYS, driverLine, LINE_GAP, type DriverEvent } from '../content/ring/wagon/lines';
import { hudOf } from '../context';
import type { EjectMode } from '../events';
import { dust, smokeTrail } from '../fx';
import type { Player } from '../player/player';
import { NO_PARAMS, type SpawnParams } from '../registry';
import type { SlotIndex } from '../session';
import { Vehicle } from '../vehicle';
import { ringOf, slabBoxes, slabCache, type RingDrawable } from './entity';
import { clampLane, DEPTH_HALF, LANE_GAP, laneY, nearestLane, SHOULDER_TOP } from './lanes';
import { RING } from './types';

/**
 * The world x at or below which a driven wagon cannot give way to a road thing that pushes it
 * back: the left end of its band (`RING.screenMinX`, 2 px slack), or, queued in its lane in front
 * of a wagon that is already at that end (2P: both behind one car), one queue gap ahead of that
 * wagon. A road thing that would push it further back is shoved ahead of it instead (wave B's
 * rule), so every wagon stays fully on screen. With one wagon: the band end.
 */
export function wagonBandEnd(w: Wagon): number {
  const end = w.world.camera.x + RING.screenMinX + 2;
  let out = end;
  const list = w.world.byTag('ring-wagon');
  for (let i = 0; i < list.length; i++) {
    const o = list[i];
    if (o === w || !(o instanceof Wagon) || !o.alive || o.state !== 'driven' || o.scripted) continue;
    if (Math.abs(o.y - w.y) >= DEPTH_HALF * 2 || o.x > end || o.x > w.x || (o.x === w.x && o.slot > w.slot)) continue;
    out = Math.max(out, o.x + QUEUE_GAP + 2);
  }
  return out;
}

/** How a wagon comes into play. */
export type WagonMode = 'start' | 'respawn' | 'continue' | 'join';

/** Body size (spec §3: about 92 × 28, wheelbase 52). */
export const WAGON_W = 92;
export const WAGON_H = 28;
/** Centre to centre of two wagons queued in one lane (they push apart to this). */
export const QUEUE_GAP = WAGON_W - 2;
/** The hero's window (the near rear door): his anchor sits this far from the wagon's centre … */
export const WINDOW_DX = SEAT.heroX;
/** … and his hip this high above the road (drawn only). */
export const WINDOW_LIFT = -SEAT.heroY;

/** Damage of a swerve into a small vehicle (spec §3: a side ram knocks the rider off). */
export const SIDE_RAM = 120;
/** Ids that count as small vehicles for the side ram (besides the tag `ring-small`). */
/** Ticks the wreck spins before the people tumble out onto the shoulder. */
export const WRECK_SPIN = 30;
/** The spin turns 13 eighths (1⅝ turns) and rests turned 225° (the left side and the tailgate). */
const SPIN_EIGHTHS = 13;

const SMALL_IDS: ReadonlySet<string> = new Set(['ring-scooter', 'ring-handhaver-moto']);

/** What the wagon needs of its hero (RingHero implements it; duck-typed to keep the import one-way). */
export interface WagonRider extends Player {
  /** The wagon wrecked: the hero loses a life (and waits for a fresh wagon). */
  wrecked(w: Wagon): void;
  /** The drive-in ended: the hero is in play ('mounted'). */
  arrive(): void;
  /** Draw the hero in the window (hip at x, y; `flip` = the car faces left). */
  drawInWindow(r: Renderer, x: number, y: number, flip?: boolean): void;
}

function isRider(p: Player | null): p is WagonRider {
  return p !== null && typeof (p as unknown as Partial<WagonRider>).wrecked === 'function';
}

export interface WagonOpts {
  /** Player slot (the livery: 0 white, 1 green). */
  slot?: SlotIndex;
  /** Squad hero id of the driver (a hero nobody plays), or null. */
  driver?: string | null;
}

/** A shove from traffic or a road thing (`Wagon.bump`). */
export interface BumpOpts {
  /** Screen push in x (px/tick of side speed; + forward). */
  dx?: number;
  /** Lane bounce: −1 toward the far lanes, +1 toward the near lanes, 0 none. */
  dy?: number;
  /** Armour cost in cells (default 1; 0 = a free push). */
  cost?: number;
  source?: Entity | null;
}

/** The driver's ride strip by mood. */
type DriverPose = 'sit' | 'hold' | 'brace' | 'duck' | 'cheer';
const DRIVER_STRIPS: readonly DriverPose[] = ['sit', 'hold', 'brace', 'duck', 'cheer'];

/** The body state of an armour level (dents → broken glass → smoke → fire). */
export function bodyStateOf(cells: number, max: number = RING.wagonCells): BodyState {
  const k = cells / Math.max(1, max);
  if (k > 0.75) return 0;
  if (k > 0.5) return 1;
  if (k > 0.25) return 2;
  return 3;
}

const drawOpts: DrawOpts = {};
const flipOpts: DrawOpts = { flipX: true };
const clipSrc = { x: 0, y: 0, w: 0, h: 0 };
const clipOpts: DrawOpts = { src: clipSrc };
const clipFlipOpts: DrawOpts = { src: clipSrc, flipX: true };
const tintOpts: DrawOpts = { tint: 0xffffffff, alpha: 0.55 };
const ramRect: Rect = { x: 0, y: 0, w: 0, h: 0 };
const bubbleTip: [number, number] = [SEAT.driverX + 2, -29];

/** The wheels' x on the body (rear, front). */
const WHEEL_XS: readonly number[] = [-24.6, 27.4];

/** Ticks of quiet after a driver's bubble before the other driver may talk. */
const TALK_PAUSE = 6;
const talkTurns = new WeakMap<World, { who: Wagon | null; until: number }>();

/** Whose turn it is to talk in this world (the drivers take turns). */
function talkTurn(world: World): { who: Wagon | null; until: number } {
  let t = talkTurns.get(world);
  if (!t) {
    t = { who: null, until: 0 };
    talkTurns.set(world, t);
  }
  return t;
}

export class Wagon extends Vehicle implements RingDrawable {
  readonly slot: SlotIndex;
  /** The driver hero's id (spec §0 row 23: one driver per player for the whole level). */
  readonly driverId: string | null;
  readonly livery: Livery;
  lift = 0;
  shadowW = WAGON_W - 6;
  /** The hero's shots leave from his window (the hero sets his own per aim). */
  shotLift = RING.heroGunLift;
  /** Lane the wagon is in or heading to (1 far … 4 near). */
  laneTarget: number;
  /** Screen speed from the stick (px/tick; world vx = road speed + this). */
  sideV = 0;
  /** Drive-in: ticks left, and the screen x it started from / ends at. */
  arriveT = 0;
  private arriveFrom = 0;
  private arriveTo = 0;
  /** Swerve: ticks left of the dodge, and of its cooldown. */
  swerveT = 0;
  swerveCool = 0;
  /** Ticks left of the spin-out (state 'wreck'). */
  private spinT = 0;
  /** Drawing: which side shows, the spin frame, the body pose and the wheels' turn. */
  view: 'right' | 'left' | 'spin' = 'right';
  spinFrame = 0;
  pose: BodyPose = 'level';
  private poseT = 0;
  private wheelTurn = 0;
  /** The boarding scene / the exit drive the wagon (no input, no plane physics). */
  scripted = false;
  /** The exit's autopilot: no input; the lane and the screen speed are steered by boarding.ts. */
  autopilot = false;
  /** The driver's mood strip and how long it holds. */
  private driverPose: DriverPose = 'sit';
  private driverPoseT = 0;
  private lineCool = 0;
  /** A line waiting for the other driver's bubble to end (see `say`). */
  private queuedLine: { event: DriverEvent; ticks: number; at: number } | null = null;
  private lowSaid = false;
  /** The people tumbling out of a wreck (draw-only): ticks since. */
  private tumbleT = -1;
  private readonly hurtSlab = slabCache();
  private readonly contactSlab = slabCache();
  private readonly art4: (typeof ID)['green'];
  private readonly driverIds: Readonly<Record<DriverPose, string>> | null;
  private readonly loopKey: string;

  constructor(world: World, x: number, y: number, params: SpawnParams = NO_PARAMS, o: WagonOpts = {}) {
    super(world, x, y, params, {
      art: 'ring/wagon',
      name: 'WAGON',
      w: WAGON_W,
      h: WAGON_H,
      seat: { x: WINDOW_DX - 8, y: -WAGON_H, w: 16, h: 12 },
      seatPoint: [WINDOW_DX, 0],
      cells: RING.wagonCells,
      jump: 0,
    });
    this.slot = o.slot ?? 0;
    this.driverId = o.driver ?? null;
    this.livery = liveryOf(this.slot);
    this.art4 = ID[this.livery];
    this.driverIds = this.driverId ? (Object.fromEntries(DRIVER_STRIPS.map((s) => [s, `char/${this.driverId}/ride-${s}`])) as Record<DriverPose, string>) : null;
    this.loopKey = `ring-wagon-${this.slot}`;
    this.laneTarget = nearestLane(y);
    this.body = null;
    this.facing = 1;
    this.canTurn = false;
    this.addTag('ring-wagon');
  }

  /** The hero driving with it (null when parked or wrecked). */
  get hero(): WagonRider | null {
    return isRider(this.driver) ? this.driver : null;
  }

  /** Driving in from the left (the hero is in state 'spawn'). */
  get arriving(): boolean {
    return this.arriveT > 0;
  }

  /** Screen x of the wagon's centre. */
  get screenX(): number {
    return this.x - this.world.camera.x;
  }

  /** The damage state of the body (0 clean … 3 smoke and fire). */
  get bodyState(): BodyState {
    return bodyStateOf(this.cells, this.maxCells);
  }

  override hurtboxes(): readonly Rect[] {
    return slabBoxes(this, this.hurtSlab);
  }

  override contactBoxes(): readonly Rect[] {
    return slabBoxes(this, this.contactSlab);
  }

  /** Start a drive-in from the left edge to screen x `to` (a fresh wagon, a continue, a join). */
  driveIn(to: number): void {
    this.arriveFrom = -WAGON_W;
    this.arriveTo = to;
    this.arriveT = RING.driveInTicks;
    this.x = this.prevX = this.world.camera.x + this.arriveFrom;
    this.invulnTicks = Math.max(this.invulnTicks, RING.driveInBlink);
  }

  // ------------------------------------------------------------------------------- tick

  override update(): void {
    if (this.swerveCool > 0) this.swerveCool--;
    if (this.lineCool > 0) this.lineCool--;
    if (this.queuedLine) this.sayQueued();
    if (this.driverPoseT > 0 && --this.driverPoseT === 0) this.driverPose = 'sit';
    switch (this.state) {
      case 'driven':
        this.updateDriven();
        break;
      case 'wreck':
        this.updateSpin();
        break;
      default:
        // Parked (no hero): it rolls to a stop where it stands.
        this.vx = approach(this.vx, 0, 0.1);
        this.x += this.vx;
        break;
    }
    this.wheelTurn += Math.abs(this.vx);
    this.anim.update();
  }

  private updateDriven(): void {
    const p = this.driver;
    if (!p || (p.state !== 'mounted' && p.state !== 'spawn' && p.state !== 'victory')) {
      this.driver = null;
      this.state = 'idle';
      this.despawnMargin = 160;
      this.removeTag('shootable');
      this.stopEngine();
      return;
    }
    if (this.scripted) {
      // The boarding scene / the exit place the wagon themselves (boarding.ts).
      this.syncDriver();
      this.engine();
      return;
    }
    const cam = this.world.camera;
    if (this.arriveT > 0) {
      // Drive-in: eased from the left edge to the start x; the lane holds.
      this.arriveT--;
      const t = 1 - this.arriveT / RING.driveInTicks;
      const e = t * t * (3 - 2 * t);
      const sx = this.arriveFrom + (this.arriveTo - this.arriveFrom) * e;
      this.vx = cam.x + sx - this.x;
      this.x = cam.x + sx;
      this.settleLane();
      this.posePick(0);
      if (this.arriveT === 0 && isRider(p)) {
        p.arrive();
        this.say('arrive');
      }
    } else {
      const before = this.sideV;
      if (p.state === 'mounted' && !this.autopilot) this.control(p.pad);
      else if (!this.autopilot) this.sideV = approach(this.sideV, 0, RING.wagonSideAccel);
      this.physics();
      this.posePick(this.sideV - before);
      this.sideRam();
      this.bumpWagons();
    }
    this.syncDriver();
    this.mirrorBombs();
    this.damageFx();
    this.engine();
  }

  /** Driver input: steer, steer lock, swerve (see the file header). */
  protected override control(pad: VirtualPad): void {
    const up = pad.held('up');
    const down = pad.held('down') && !up;
    const open = ringOf(this.world)?.lanesOpenAt(this.x) ?? 4;
    if (pad.pressed('jump') && this.swerveCool <= 0 && this.swerveT <= 0) this.swerve(up ? -1 : down ? 1 : 0, open);
    if (pad.held('fire')) {
      // Steer lock: the lane and the screen x hold (the hero aims).
      this.sideV = 0;
      return;
    }
    const dir = up ? -1 : down ? 1 : 0;
    if (dir !== 0 && this.swerveT <= 0) {
      if (pad.pressed(up ? 'up' : 'down')) {
        // A press: the next lane from where the car is now, unless it already heads further
        // that way (a press against a running change turns it back).
        const cur = nearestLane(this.y);
        const heading = Math.sign(laneY(this.laneTarget) - this.y);
        if (heading !== dir || this.laneTarget === cur) this.laneTarget = clampLane(cur + dir, open);
      } else if (Math.abs(this.y - laneY(this.laneTarget)) < 2) {
        // Held: on to the next lane once this one is reached.
        this.laneTarget = clampLane(this.laneTarget + dir, open);
      }
    }
    this.sideV = approach(this.sideV, pad.axisX() * RING.wagonSideSpeed, RING.wagonSideAccel);
  }

  /**
   * JUMP = swerve: one lane toward `dir` (−1 far, +1 near); 0 = away from the nearest threat in
   * the lane ahead / behind, else away from the edge. Returns true when the wagon swerved.
   */
  swerve(dir: number, open = ringOf(this.world)?.lanesOpenAt(this.x) ?? 4): boolean {
    const last = clampLane(4, open);
    const cur = nearestLane(this.y, 1, last);
    let d = dir;
    if (d === 0) d = this.threatSide(cur, last);
    const to = clampLane(cur + d, open);
    if (to === cur) return false;
    this.laneTarget = to;
    this.swerveT = RING.swerveTicks;
    this.swerveCool = RING.swerveCooldown;
    this.invulnTicks = Math.max(this.invulnTicks, RING.swerveInvuln);
    this.world.audio.sfx('ring/wagon-swerve');
    for (let i = 0; i < 3; i++) dust(this.world, this.x - 26 + i * 10, this.y, 2);
    return true;
  }

  /** The side to dodge to: away from the nearest enemy shot or hostile in the lane; else off the edge. */
  private threatSide(cur: number, last: number): number {
    if (cur <= 1) return 1;
    if (cur >= last) return -1;
    const shots = this.world.byTag('shot');
    let best = Infinity;
    let side = 0;
    for (let i = 0; i < shots.length; i++) {
      const s = shots[i];
      if (!s.alive || s.team === 'player' || Math.abs(s.y - this.y) > LANE_GAP * 1.5) continue;
      const dx = Math.abs(s.x - this.x);
      if (dx < best) {
        best = dx;
        side = s.y <= this.y ? 1 : -1;
      }
    }
    if (side !== 0) return side;
    // Toward the middle of the road.
    return cur <= 2 ? 1 : -1;
  }

  /** Plane motion: road speed + the stick on screen, the lane toward its target, the screen band. */
  protected override physics(): void {
    const cam = this.world.camera;
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    this.settleLane();
    this.vx = road + this.sideV;
    this.x += this.vx;
    const sx = this.x - cam.x;
    if (sx < RING.screenMinX) {
      this.x = cam.x + RING.screenMinX;
      if (this.sideV < 0) this.sideV = 0;
    } else if (sx > RING.screenMaxX) {
      this.x = cam.x + RING.screenMaxX;
      if (this.sideV > 0) this.sideV = 0;
    }
  }

  /** Move the plane y toward the target lane (a lane change, a swerve, a closed lane). */
  private settleLane(): void {
    const open = ringOf(this.world)?.lanesOpenAt(this.x) ?? 4;
    this.laneTarget = clampLane(this.laneTarget, open);
    const ty = laneY(this.laneTarget);
    const speed = this.swerveT > 0 ? LANE_GAP / RING.swerveTicks : LANE_GAP / RING.laneChangeTicks;
    if (this.swerveT > 0) this.swerveT--;
    const dy = ty - this.y;
    this.vy = Math.abs(dy) <= speed ? dy : Math.sign(dy) * speed;
    this.y += this.vy;
  }

  /** The body pose: a lane change leans, a push forward tilts the nose up, a brake dips it. */
  private posePick(accel: number): void {
    let want: BodyPose = 'level';
    if (this.vy < -0.4) want = 'far';
    else if (this.vy > 0.4) want = 'near';
    else if (accel > 0.05 || (this.sideV > 0.6 && accel >= 0)) want = 'up';
    else if (accel < -0.05 || (this.sideV < -0.6 && accel <= 0)) want = 'down';
    if (want !== 'level') {
      this.pose = want;
      this.poseT = want === 'far' || want === 'near' ? 4 : 6;
    } else if (this.poseT > 0) this.poseT--;
    else this.pose = 'level';
  }

  /** The hero rides at the window: his anchor on the wagon's plane line (lift is drawn only). */
  protected override syncDriver(): void {
    const p = this.driver;
    if (!p) return;
    const left = this.view === 'left';
    p.x = p.prevX = this.x + (left ? -WINDOW_DX : WINDOW_DX);
    p.y = p.prevY = this.y;
    p.facing = 1;
    p.vx = this.vx;
    p.vy = this.vy;
  }

  /** The HUD shows a vehicle's shells as the bomb count: the hero's grenades (lobs). */
  private mirrorBombs(): void {
    const p = this.driver;
    if (p) this.shells = Math.max(0, p.slot.bombs);
  }

  // ------------------------------------------------------------------------------- contacts

  /** A swerve into a small vehicle in the lane it moves into: the side ram (spec §3). */
  private sideRam(): void {
    if (this.swerveT <= 0 || this.vy === 0) return;
    const r = ramRect;
    r.x = this.x - WAGON_W / 2 + 4;
    r.w = WAGON_W - 8;
    r.y = this.y - DEPTH_HALF;
    r.h = DEPTH_HALF * 2;
    const list = this.world.snapshotTag('shootable');
    try {
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!e.alive || e.team !== 'enemy' || (!e.hasTag('ring-small') && !SMALL_IDS.has(e.type))) continue;
        const boxes = e.hurtboxes();
        for (let k = 0; k < boxes.length; k++) {
          if (!overlaps(r, boxes[k])) continue;
          this.world.damage(e, { amount: SIDE_RAM, kind: 'impact', dirX: Math.sign(e.x - this.x) || 1, source: this, owner: this.slot, tags: ['ram', 'side-ram'] }, k);
          this.world.audio.sfx('ring/wagon-bump');
          this.world.camera.shake(2, 6);
          break;
        }
      }
    } finally {
      this.world.releaseSnapshot();
    }
  }

  /**
   * Two wagons in the same lane that overlap push each other apart (no damage, spec §9). Each takes
   * half the overlap; the one behind never goes past the left end of its band (2P polish
   * 2026-10-21: queued behind one car, the rear wagon sat up to half off the screen): then the one
   * in front takes the rest, and road things shove ahead of it (`wagonBandEnd`). Two wagons on the
   * same x part by slot (the lower slot in front).
   */
  private bumpWagons(): void {
    const list = this.world.byTag('ring-wagon');
    const minX = this.world.camera.x + RING.screenMinX;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o === this || !o.alive || !(o instanceof Wagon) || o.state !== 'driven' || o.scripted) continue;
      if (Math.abs(o.y - this.y) >= DEPTH_HALF * 2) continue;
      const dx = this.x - o.x;
      const gap = QUEUE_GAP - Math.abs(dx);
      if (gap <= 0) continue;
      // The faster one bounces back a little.
      const s = dx > 0 ? 1 : dx < 0 ? -1 : this.slot < o.slot ? 1 : -1;
      if (s < 0) this.x = Math.max(Math.min(this.x, minX), this.x - gap / 2);
      else this.x += o.x <= minX + 0.5 ? gap : gap / 2;
      this.sideV = s * Math.max(0.6, Math.abs(this.sideV) * 0.5);
      if (this.slot < o.slot) {
        this.world.audio.sfx('ring/wagon-bump');
        this.driverMood('brace', 20);
      }
    }
  }

  /**
   * A shove from traffic or a road thing (the ROAD builder's civilians call it): a side push, a
   * lane bounce, a cost in cells (default 1, through `world.damage` with the tag 'bump'), a line.
   */
  bump(o: BumpOpts = {}): void {
    if (this.state !== 'driven' || this.scripted) return;
    if (o.dx) this.sideV = Math.max(-RING.wagonSideSpeed * 2, Math.min(RING.wagonSideSpeed * 2, o.dx));
    if (o.dy && this.swerveT <= 0) {
      const open = ringOf(this.world)?.lanesOpenAt(this.x) ?? 4;
      this.laneTarget = clampLane(nearestLane(this.y) + Math.sign(o.dy), open);
    }
    const cost = o.cost ?? 1;
    if (cost > 0) {
      const tags = cost <= 0.5 ? ['bump', 'bump-light'] : cost >= 2 ? ['bump', 'ram'] : ['bump'];
      this.world.damage(this, { amount: cost, kind: 'impact', dirX: o.dx ? Math.sign(o.dx) : -1, source: o.source ?? undefined, tags });
    }
    this.world.audio.sfx('ring/wagon-bump');
    this.world.camera.shake(1, 4);
    this.driverMood('brace', 24);
    this.say('bump');
  }

  // ------------------------------------------------------------------------------- damage

  protected override cellDamage(d: Damage): number {
    if (d.kind === 'crush' || damageHas(d, 'hazard')) return this.cells;
    if (damageHas(d, 'ram')) return 2;
    if (damageHas(d, 'bump-light')) return 0.5;
    if (d.kind === 'bullet' && !damageHas(d, 'heavy') && !damageHas(d, 'boss')) return 0.5;
    return 1;
  }

  /** Hits cost cells (see the header). Returns true (the wagon absorbs the shot) while driven. */
  override onHit(d: Damage): boolean {
    if (this.state !== 'driven' || this.dead) return false;
    // A scripted wagon (the boarding, the exit) and god mode / the victory drive cost nothing.
    if (this.scripted || this.world.god || this.hero?.cheering) return true;
    const lethal = d.kind === 'crush' || damageHas(d, 'hazard');
    if (this.invulnTicks > 0 && !lethal) return true;
    const cost = this.cellDamage(d);
    if (cost <= 0) return true;
    const before = this.bodyState;
    this.cells = Math.max(0, this.cells - cost);
    this.invulnTicks = RING.wagonHitInvuln;
    this.flashTicks = 6;
    this.world.audio.sfx(cost >= 2 ? 'ring/wagon-crunch' : 'ring/wagon-hit');
    this.driverMood('duck', 14);
    if (this.cells <= 0) {
      this.wreck();
      return true;
    }
    if (this.bodyState >= 2 && before < 2) this.world.audio.sfx('ring/wagon-glass');
    if (this.cells <= 2 && this.driver) hudOf(this.world).message(this.driver.index, 'DANGER!', 90, 0xff5040ff);
    if (this.cells <= 3 && !this.lowSaid) {
      this.lowSaid = true;
      this.say('low');
    }
    return true;
  }

  override repair(cells = 1): void {
    super.repair(cells);
    if (this.cells > 3) this.lowSaid = false;
  }

  /**
   * 0 cells: the wagon spins out onto the hard shoulder and is gone after `RING.wreckTicks`; the
   * hero loses a life (`RingHero.wrecked`). Never ejects the hero onto the road.
   */
  wreck(): void {
    if (this.state === 'wreck') return;
    const p = this.driver;
    this.cells = 0;
    this.state = 'wreck';
    this.dead = true;
    this.spinT = RING.wreckTicks;
    this.tumbleT = -1;
    this.driver = null;
    this.scripted = false;
    this.despawnMargin = 160;
    this.view = 'spin';
    this.spinFrame = 0;
    this.removeTag('shootable');
    hudOf(this.world).clearBubble(this);
    this.stopEngine();
    this.world.audio.sfx('ring/wagon-wreck');
    this.world.camera.shake(3, 10);
    if (isRider(p)) p.wrecked(this);
    this.world.events.emit('vehicleDestroyed', { vehicle: this });
  }

  private updateSpin(): void {
    // The car slides to a stop on the hard shoulder (world vx → 0: it drifts back on screen),
    // spinning one and a half turns, then smokes.
    const t = RING.wreckTicks - this.spinT;
    this.vx = approach(this.vx, 0, 0.06);
    this.x += this.vx;
    this.y = approach(this.y, SHOULDER_TOP + 4, 0.7);
    const k = Math.min(1, t / WRECK_SPIN);
    this.spinFrame = Math.floor(SPIN_EIGHTHS * (1 - (1 - k) * (1 - k)) + 1e-6) % 8;
    if (t === WRECK_SPIN) {
      this.tumbleT = 0;
      dust(this.world, this.x, this.y, 6);
    }
    if (this.tumbleT >= 0) this.tumbleT++;
    if (this.spinT % 5 === 0) smokeTrail(this.world, this.x + this.world.fxRng.range(-12, 12), this.y - WAGON_H + 4, true);
    if (t < 30 && t % 3 === 0) dust(this.world, this.x + this.world.fxRng.range(-30, 30), this.y, 2);
    // While every player is out the wreck stays where it lies (the continue's gloat: the courier's
    // NIET THUIS card, the tow truck's hook); the next tick after the hold it goes.
    if (--this.spinT <= 0) {
      if (ringOf(this.world)?.held) this.spinT = 1;
      else this.remove();
    }
  }

  /** Smoke (≤ 2.5 cells) and fire (≤ 1.5) from the bonnet while driven. */
  private damageFx(): void {
    if (this.bodyState < 3) return;
    const t = this.world.tick;
    const f = this.view === 'left' ? -1 : 1;
    if (t % 5 === 0) smokeTrail(this.world, this.x + f * (30 + this.world.fxRng.range(-4, 4)), this.y - 18, true);
    if (this.cells <= 1.5 && t % 60 === 0) this.world.audio.sfx('vehicle/warning');
  }

  // Vehicle paths that would throw the pilot out onto the road: on the ring they wreck instead.
  override destroy(_mode: EjectMode = 'destroyed'): void {
    this.wreck();
  }

  override explode(): void {
    this.wreck();
  }

  override eject(): void {
    // The hero never leaves the wagon (spec §0 row 15).
  }

  override onCrushed(): void {}

  override onOutOfWorld(): void {}

  override onRemove(): void {
    this.driver = null;
    this.stopEngine();
  }

  // ------------------------------------------------------------------------------- the driver

  /**
   * The drivers keep quiet (user 2026-10-21: "I don't want the driver to say anything"): `say`
   * shows no bubble and plays no line. The lines (lines.ts) and the turn-taking stay for a later
   * story; `true` brings them back.
   */
  static talk = false;

  /** The driver says his line for an event (a bubble over the front glass), unless he just spoke. */
  say(event: DriverEvent, ticks = 110): boolean {
    if (!Wagon.talk || !this.driverId || this.state === 'wreck') return false;
    if (this.lineCool > 0 && !ALWAYS.has(event)) return false;
    // The drivers take turns (2P, fix 2026-10-21: both spoke at once and the bubbles covered each
    // other): while the other driver talks, this line waits for its turn (`sayQueued`).
    const turn = talkTurn(this.world);
    if (turn.who && turn.who !== this && turn.who.alive && turn.until > this.world.tick) {
      this.queuedLine = { event, ticks, at: this.world.tick };
      return false;
    }
    const pick = this.world.fxRng.next();
    hudOf(this.world).bubble(this, driverLine(this.driverId, event, pick), { ticks, speaker: this.driverId, tip: this.view === 'left' ? [-bubbleTip[0], bubbleTip[1]] : bubbleTip });
    this.lineCool = LINE_GAP;
    this.driverMood('hold', Math.min(ticks, 60));
    turn.who = this;
    turn.until = this.world.tick + ticks + TALK_PAUSE;
    return true;
  }

  /** A line that waited for the other driver: said when the turn is free, dropped when stale. */
  private sayQueued(): void {
    const q = this.queuedLine;
    if (!q) return;
    if (this.world.tick - q.at > (ALWAYS.has(q.event) ? 240 : 120) || this.state === 'wreck') {
      this.queuedLine = null;
      return;
    }
    const turn = talkTurn(this.world);
    if (turn.who && turn.who !== this && turn.who.alive && turn.until > this.world.tick) return;
    this.queuedLine = null;
    this.lineCool = 0;
    this.say(q.event, q.ticks);
  }

  /** The driver's strip for a while ('hold' talks, 'brace' a bump, 'duck' a hit, 'cheer'). */
  driverMood(pose: DriverPose, ticks: number): void {
    if (pose === 'sit' || this.driverPose === 'cheer') return;
    this.driverPose = pose;
    this.driverPoseT = ticks;
  }

  // ------------------------------------------------------------------------------- sound

  /** The engine hum: its pitch follows the speed on screen (spec §11). */
  private engine(): void {
    if (this.world.tick % 6 !== 0) return;
    const road = ringOf(this.world)?.roadSpeed ?? 0;
    const pitch = 0.75 + Math.min(1, road / RING.cruiseSpeed) * 0.3 + (this.vx - road) * 0.08;
    this.world.audio.sfxLoop?.(this.loopKey, 'ring/wagon-engine', { pitch: Math.max(0.6, Math.min(1.4, pitch)), vol: 0.55 });
  }

  private stopEngine(): void {
    this.world.audio.stopSfx?.(this.loopKey, 10);
  }

  // ------------------------------------------------------------------------------- drawing

  override draw(r: Renderer): void {
    const blink = this.invulnTicks > 0 && this.state === 'driven' && !this.scripted && Math.floor(this.world.tick / 2) % 2 === 1;
    const x = Math.round(this.x);
    const y = Math.round(this.y - this.lift);
    if (this.view === 'spin' || this.state === 'wreck') {
      this.drawSpin(r, x, y);
      return;
    }
    if (blink) return;
    const left = this.view === 'left';
    const state = this.bodyState;
    const pose = left ? 0 : POSE[this.pose];
    // Cabin and wells, the wheels, the driver behind the glass, the body, the hero in the window.
    if (hasSprite(ID.cabin)) r.sprite(ID.cabin, left ? CABIN_LEFT : pose, x, y, drawOpts);
    this.drawWheels(r, x, y, left);
    this.drawDriver(r, x, y, left);
    const bodyId = left ? this.art4.left : this.art4.body[state];
    if (hasSprite(bodyId)) {
      r.sprite(bodyId, left ? (state >= 3 ? 1 : 0) : pose, x, y, drawOpts);
      if (this.flashTicks > 0) r.sprite(bodyId, left ? 0 : pose, x, y, tintOpts);
    }
    const p = this.hero;
    if (p) p.drawInWindow(r, x + (left ? -WINDOW_DX : WINDOW_DX), y + SEAT.heroY, left);
    if (state >= 3 && this.cells <= 1.5 && hasSprite(ID.flame)) {
      const f = Math.floor(this.world.tick / 4) % frameCount(ID.flame);
      r.sprite(ID.flame, f, x + (left ? -33 : 33), y - 16, drawOpts);
    }
  }

  private drawWheels(r: Renderer, x: number, y: number, left: boolean): void {
    const id = this.art4.wheel;
    if (!hasSprite(id)) return;
    const n = frameCount(id);
    const f = Math.floor(this.wheelTurn / 2.1) % n;
    const o = left ? flipOpts : drawOpts;
    for (let k = 0; k < WHEEL_XS.length; k++) {
      const wx = WHEEL_XS[k];
      r.sprite(id, f, x + Math.round(left ? -wx : wx), y - 7, o);
    }
  }

  /** The driver behind the front door glass: his ride strip, clipped to the glass. */
  private drawDriver(r: Renderer, x: number, y: number, left: boolean): void {
    const ids = this.driverIds;
    if (!ids) return;
    const pose: DriverPose = this.hero?.cheering ? 'cheer' : this.driverPose;
    const id = hasSprite(ids[pose]) ? ids[pose] : ids.sit;
    if (!hasSprite(id)) return;
    const n = frameCount(id);
    const f = pose === 'hold' ? Math.floor(this.world.tick / 8) % n : Math.floor(this.world.tick / 20) % n;
    // The glass in frame coordinates: clip the strip's frame to it.
    const hx = x + (left ? -SEAT.driverX : SEAT.driverX);
    const hy = y + SEAT.driverY + (pose === 'duck' ? 2 : 0);
    const [c0, c1, c2, c3] = SEAT.driverClip;
    const gx0 = left ? x - c1 : x + c0;
    const gx1 = left ? x - c0 : x + c1;
    r.sprite(id, f, hx, hy, this.clip(id, f, hx, hy, gx0, gx1, y + c2, y + c3, left));
  }

  /** Draw options that show only the part of a frame inside the screen box (x0…x1, y0…y1). */
  private clip(id: string, f: number, ax: number, ay: number, x0: number, x1: number, y0: number, y1: number, flip: boolean): DrawOpts {
    const fr = getFrameGeom(id, f);
    if (!fr) return flip ? flipOpts : drawOpts;
    // Frame-local box (unflipped buffer px): the frame's top-left is (ax − ox, ay − oy).
    const left = flip ? ax - (fr.w - fr.ox) : ax - fr.ox;
    const top = ay - fr.oy;
    let sx0 = Math.max(0, Math.floor(x0 - left));
    let sx1 = Math.min(fr.w, Math.ceil(x1 - left));
    if (flip) {
      const a = fr.w - sx1;
      const b = fr.w - sx0;
      sx0 = Math.max(0, a);
      sx1 = Math.min(fr.w, b);
    }
    const sy0 = Math.max(0, Math.floor(y0 - top));
    const sy1 = Math.min(fr.h, Math.ceil(y1 - top));
    clipSrc.x = sx0;
    clipSrc.y = sy0;
    clipSrc.w = Math.max(0, sx1 - sx0);
    clipSrc.h = Math.max(0, sy1 - sy0);
    return flip ? clipFlipOpts : clipOpts;
  }

  /** The spin-out (and the boarding turn): the spin strip, then the people on the shoulder. */
  private drawSpin(r: Renderer, x: number, y: number): void {
    const wrecked = this.state === 'wreck';
    const id = this.art4.spin[wrecked ? 3 : 0];
    if (hasSprite(id)) r.sprite(id, this.spinFrame % frameCount(id), x, y, drawOpts);
    if (!wrecked || this.tumbleT < 0 || !this.driverIds) return;
    // The driver tumbles out onto the shoulder and sits up (no harm shown).
    const t = this.tumbleT;
    const k = Math.min(1, t / 16);
    const dx = x + 34 + Math.round(k * 10);
    const dy = y + 6 - Math.round(Math.sin(k * Math.PI) * 10);
    const sit = this.driverIds.sit;
    const duck = this.driverIds.duck;
    const id2 = t < 16 && hasSprite(duck) ? duck : sit;
    if (hasSprite(id2)) r.sprite(id2, 0, dx, dy, drawOpts);
  }

  /** The bubble anchor: the hitbox top is the roof (tips point at the driver's head). */
  override markerTop(): number {
    return this.y - WAGON_H - 6;
  }
}

/** Logical size and anchor of a frame (for clipping). */
function getFrameGeom(id: string, f: number): { w: number; h: number; ox: number; oy: number } | null {
  const fr = frameOf(id, f);
  if (!fr) return null;
  const d = fr.density ?? 1;
  return { w: fr.buf.w / d, h: fr.buf.h / d, ox: fr.ox, oy: fr.oy };
}

function frameOf(id: string, f: number): Frame | null {
  try {
    return getFrame(id, f);
  } catch {
    return null;
  }
}

/**
 * A wagon for a hero (the runner calls it at the start, after a wreck, on a continue and on a
 * join). 'start' places it in its start lane at once; the others drive in from the left with
 * the hero in state 'spawn' until `arrive()`. The hero's `driverId` and `slot` pick the driver
 * and the livery.
 */
export function spawnWagon(hero: Player & { driverId: string | null; lane: number }, mode: WagonMode): Wagon {
  const world = hero.world;
  const cam = world.camera;
  const slot = hero.index;
  const open = ringOf(world)?.lanesOpenAt(cam.x + RING.startX[slot]) ?? 4;
  const lane = clampLane(mode === 'start' ? RING.startLane[slot] : hero.lane || RING.startLane[slot], open);
  const sx = RING.startX[slot] ?? RING.startX[0];
  const w = new Wagon(world, cam.x + sx, laneY(lane), NO_PARAMS, { slot, driver: hero.driverId });
  world.add(w);
  w.laneTarget = lane;
  w.mount(hero);
  if (mode !== 'start') {
    w.driveIn(sx);
    hero.state = 'spawn';
  }
  return w;
}
