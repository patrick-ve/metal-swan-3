/**
 * Bot autopilot (docs/ARCHITECTURE.md §9): an `InputSource` that plays a player slot.
 *
 * Each tick it reads the running mission (world, terrain, camera, entities) and reports a held
 * button mask, exactly like a keyboard would. Modes (picked every tick from the player's state):
 * - ON FOOT: moves in the section's scroll direction ('right', 'up', 'down', 'free'), toward the
 *   chosen exit when a route opens (`route: 'upper' | 'lower'`), to pickups, walking hostages,
 *   empty vehicles and cable cars nearby; fires constantly, aims up at targets above, turns to
 *   face targets behind; jumps walls, steps, gaps and deadly hazards (a jump is only taken when
 *   its predicted landing is safe; moving platforms are waited for), climbs platform staircases
 *   toward goals above (air steering predicts the drift: no air drag), drops through platforms
 *   and walks off solid floors toward goals below; rides cable cars and moving platforms to the
 *   far side and steps off; throws bombs; dodges shots; stuck detector.
 * - FLIGHT (the Trumpeter, m5-a): bot-flight.ts — dodges shots and bodies, lines up with targets,
 *   collects pickups, dive-bombs targets below; never bails out.
 * - SWAN (a ridden Swan, m1-c / m3-a): bot-swan.ts — runs, jumps walls and enemies (stomps),
 *   swims, glides over long gaps, taps the beak gun without ever making a SWAN DIVE or an eject.
 * - GROUND VEHICLES: forward, fire, cannon at bosses, hop gaps; eject only at 0 cells.
 * Menus: presses start on the continue screen and fire to skip the tally.
 * Deterministic: no randomness, decisions only depend on the game state.
 */
import { BUTTON_BIT, type InputContext, type InputSource, type PlayerSlot } from '../engine/input';
import type { Entity } from '../engine/entity';
import type { Scene } from '../engine/scene';
import type { World } from '../engine/world';
import type { MissionRunner } from '../game/mission/runner';
import type { ExitDef } from '../game/mission/types';
import { Boss } from '../game/boss';
import type { Player } from '../game/player/player';
import { ContinueScene } from '../game/scenes/continue';
import { GameplayScene } from '../game/scenes/gameplay';
import { MissionCompleteScene } from '../game/scenes/mission-complete';
import { PauseScene } from '../game/scenes/pause';
import { TitleScene } from '../game/scenes/title';
import { Vehicle } from '../game/vehicle';
import {
  deadlyAt,
  dynamicLedges,
  edgeDistance,
  floorAt,
  isRide,
  pathEnd,
  predictLanding,
  steerOnto,
  terrainLedges,
  type Landing,
  type Ledge,
} from './bot-nav';
import { FlightPilot } from './bot-flight';
import { SwanRider } from './bot-swan';

export { steerOnto } from './bot-nav';

export type BotRoute = 'upper' | 'lower';

export interface BotOptions {
  /** Which exit to take when a section offers several (default 'lower'). */
  route?: BotRoute;
  /** Throw bombs at bosses and enemy groups (default true). */
  bombs?: boolean;
  /** Ride vehicles found on the way (default true). */
  vehicles?: boolean;
  /** Dodge enemy shots (default true). */
  dodge?: boolean;
}

/** What the bot needs from the game: the current top scene and the running mission. */
export interface BotHost {
  readonly topScene: Scene | null;
  readonly runner: MissionRunner | null;
}

/** The navigation goal of the tick (reused object). */
export interface BotGoal {
  x: number;
  y: number;
  kind: string;
}

const L = BUTTON_BIT.left;
const R = BUTTON_BIT.right;
const UP = BUTTON_BIT.up;
const DOWN = BUTTON_BIT.down;
const FIRE = BUTTON_BIT.fire;
const JUMP = BUTTON_BIT.jump;
/** A thin boss contact lane (a lash) as a moving threat: its trailing length and front speed. */
const BOSS_LANE_LEAD = 100;
const BOSS_LANE_SPEED = 12;
const BOSS_LANE_MEMO = 16;
const BOMB = BUTTON_BIT.bomb;
const START = BUTTON_BIT.start;

/** Highest reach of a jump above the feet (apex ≈ 47 px), with a margin. */
const JUMP_REACH = 44;
/** A player's run jump: take-off speed (run 1.5 × boost 1.33, capped 2.0), vy, gravity. */
const RUN_JUMP_VX = 2;
const JUMP_VY = -3.5;
const GRAVITY = 0.13;
const MAX_FALL = 4;

const NO_PLATFORMS = { platforms: false } as const;

export class Bot implements InputSource {
  readonly slot: PlayerSlot;
  readonly opts: Required<BotOptions>;
  private readonly host: BotHost;
  private mask = 0;
  private t = 0;
  private lastTop: Scene | null = null;
  private quiet = 0;
  // Navigation memory.
  /** Best progress along the scroll axis so far (stuck detector). */
  private best = -Infinity;
  private stuckT = 0;
  /** Where an airborne jump should land (steered toward while airborne): y and the x span. */
  private airTarget = { active: false, y: 0, lo: 0, hi: 0 };
  /** Direction held during a dodge jump (null = steer normally). */
  private airDir: number | null = null;
  private backoff = 0;
  private jumpHold = 0;
  private lastBomb = -1000;
  private lastWorld: World | null = null;
  /** Ticks spent waiting at a gap for a moving platform. */
  private waitT = 0;
  /** Walking direction while looking for a ledge in reach (vertical climbs). */
  private patrolDir: 1 | -1 = 1;
  /** Walk-off direction chosen toward a goal below a solid floor (kept until airborne). */
  private dropCommit = 0;
  /** Dynamic ledges of the tick (pooled). */
  private readonly dyn: Ledge[] = [];
  private dynCount = 0;
  private readonly landing: Landing = { ok: false, x: 0, y: 0, t: 0, box: null };
  private readonly endPt = { x: 0, y: 0 };
  /** Where to shoot: the target centre or the lowest open boss part (set by `aimPoint`). */
  private readonly aimPt = { x: 0, y: 0 };
  /** The fighting boss's lowest open part (arena stand-off), when there is one. */
  private readonly bossPt = { x: 0, y: 0, ok: false };
  /** Boss part choice: the boss, the part aimed at, since when it took no damage, skipped parts. */
  private bossRef: Boss | null = null;
  private bossPart = -1;
  private bossHpMark = 0;
  private bossMarkT = 0;
  private bossSkip = 0;
  /** Ticks spent standing under a target to shoot straight up (capped, then walk on). */
  private overheadT = 0;
  /** Vehicles that threw this bot's player out (a body wall, 0 cells): never boarded again. */
  private readonly leftVehicles = new WeakSet<object>();
  /** Mode helpers. */
  private readonly flight = new FlightPilot();
  private readonly swan = new SwanRider();
  /** Debug: the last goal (world x, y) and what it was. */
  goalX = 0;
  goalY = 0;
  goalKind = '';
  /** Debug: why the bot last wanted a jump, and the mode of the tick. */
  jumpWhy = '';
  mode: 'menu' | 'foot' | 'flight' | 'swan' | 'drive' | 'idle' = 'idle';

  constructor(host: BotHost, slot: PlayerSlot = 0, opts: BotOptions = {}) {
    this.host = host;
    this.slot = slot;
    this.opts = { route: opts.route ?? 'lower', bombs: opts.bombs ?? true, vehicles: opts.vehicles ?? true, dodge: opts.dodge ?? true };
  }

  update(_ctx: InputContext): void {
    this.t++;
    const top = this.host.topScene;
    if (top !== this.lastTop) {
      // Scenes suppress held buttons until they are released: let go for a moment.
      this.lastTop = top;
      this.quiet = 2;
    }
    if (this.quiet > 0) {
      this.quiet--;
      this.mask = 0;
      return;
    }
    if (top instanceof ContinueScene) this.mask = this.t % 20 === 0 ? START : 0;
    else if (top instanceof MissionCompleteScene) this.mask = this.t % 12 === 0 ? FIRE : 0;
    else if (top instanceof TitleScene) this.mask = this.t % 30 === 0 ? START : 0;
    else if (top instanceof PauseScene) this.mask = 0;
    else if (top instanceof GameplayScene) this.mask = this.play();
    else this.mask = 0;
    if (!(top instanceof GameplayScene)) this.mode = 'menu';
  }

  read(slot: PlayerSlot): number {
    return slot === this.slot ? this.mask : 0;
  }

  // ------------------------------------------------------------------------------- gameplay

  private play(): number {
    const runner = this.host.runner;
    if (!runner || runner.state !== 'playing') return 0;
    const p = runner.player(this.slot);
    if (!p) return 0;
    const world = runner.world;
    if (world !== this.lastWorld) {
      this.lastWorld = world;
      this.best = -Infinity;
      this.stuckT = 0;
      this.backoff = 0;
      this.waitT = 0;
      this.dropCommit = 0;
      this.airTarget.active = false;
      this.flight.reset();
      this.swan.reset();
      world.events.on('vehicleEjected', (ev) => {
        if (ev.slot === this.slot) this.leftVehicles.add(ev.vehicle);
      });
    }
    if (p.state === 'mounted') {
      const v = p.vehicle as (Entity & Vehicle) | null;
      this.airTarget.active = false;
      if (v && v.type === 'trumpeter') {
        this.mode = 'flight';
        return this.flight.update(this, runner, p, v);
      }
      if (v && v.type === 'swan') {
        this.mode = 'swan';
        return this.swan.update(this, runner, p, v);
      }
      this.mode = 'drive';
      return this.drive(runner, p);
    }
    if (p.state !== 'play') {
      this.mode = 'idle';
      return 0;
    }
    this.mode = 'foot';
    return this.walk(runner, p);
  }

  /** On foot. */
  private walk(runner: MissionRunner, p: Player): number {
    const world = runner.world;
    this.dynCount = dynamicLedges(world, this.dyn);
    let mask = 0;
    const target = this.pickTarget(world, p);
    this.findBossPart(world);
    const goal = this.goal(runner, p);
    this.goalX = goal.x;
    this.goalY = goal.y;
    this.goalKind = goal.kind;
    const scroll = runner.section.scroll;

    // ---- where to go
    let dir = Math.abs(goal.x - p.x) > 6 ? Math.sign(goal.x - p.x) : 0;
    let jump = false;
    const air = this.airTarget;
    if (p.onGround) {
      air.active = false;
      this.airDir = null;
    }
    const support = p.onGround ? p.body.supportSolid : null;
    let riding = false;
    if (this.airDir !== null) {
      // A dodge jump keeps its direction until it lands (it was checked for pits).
      dir = this.airDir;
    } else if (air.active) {
      // Airborne on a planned jump: steer so the drift comes down on the target span.
      dir = steerOnto(p, air.y, air.lo, air.hi);
    } else if (support && this.rideOn(support, goal, scroll)) {
      // On a cable car / lift that still goes our way: stay on board, keep to its middle.
      riding = true;
      const cx = support.x + support.w / 2;
      dir = Math.abs(cx - p.x) > support.w / 2 - 14 ? Math.sign(cx - p.x) : 0;
      this.waitT = 0;
    } else if (goal.y < p.y - 8 && p.onGround && goal.kind.startsWith('exit') && p.y - goal.y <= JUMP_REACH && Math.abs(goal.x - p.x) < 40) {
      // An exit rect just above (the top of a climb): jump into it.
      jump = true;
      this.jumpWhy = 'exit';
    } else if (goal.y < p.y - 20 && p.onGround) {
      const climb = this.climbPlan(world, p, goal.x);
      if (!climb && (scroll === 'up' || goal.kind === 'up') && Math.abs(goal.x - p.x) < 8) {
        // Nothing in reach straight up: walk along the floor (turning at walls) until a ledge is.
        if (this.obstacle(world, p, this.patrolDir) === 'wall' || !this.edgeOk(world, p, this.patrolDir)) this.patrolDir = -this.patrolDir as 1 | -1;
        dir = this.patrolDir;
      }
      if (climb) {
        dir = climb.dir;
        jump = climb.jump;
        if (jump) {
          const l = climb.ledge;
          const margin = Math.min(10, Math.max(2, (l.x1 - l.x0) / 2 - 4));
          this.aim(l.y, l.x0 + margin, l.x1 - margin);
          this.jumpWhy = 'climb';
        }
      }
    } else if (goal.y > p.y + 24 && p.onGround && !p.body.onOneWay && (Math.abs(goal.x - p.x) < 24 || this.dropCommit !== 0)) {
      // A goal below a solid floor: walk off the nearer edge that drops onto something safe
      // (the choice is kept until the feet leave the floor: no dithering at the edge).
      if (this.dropCommit === 0) this.dropCommit = this.dropDir(world, p, goal.x);
      dir = this.dropCommit || dir;
    }
    if (!p.onGround || goal.y <= p.y + 24) this.dropCommit = 0;
    if (this.backoff > 0) {
      this.backoff--;
      dir = -Math.sign(goal.x - p.x) || -1;
      if (this.backoff === 0) this.jumpHold = 10;
    }

    // ---- an empty vehicle right here: touch its seat with down held, else hop onto it
    if (goal.kind === 'vehicle' && Math.abs(goal.x - p.x) < 14 && p.onGround) {
      if (this.t % 40 < 14) return DOWN;
      jump = true;
      this.jumpWhy = 'mount';
    }

    // ---- terrain probes in the move direction
    if (dir !== 0 && p.onGround && !riding && !jump) {
      const need = this.obstacle(world, p, dir);
      if (need === 'wall') {
        jump = true;
        this.jumpWhy = 'terrain';
      } else if (need === 'gap') {
        const wantDown = goal.y > p.y + 24 || scroll === 'down';
        const plan = this.gapPlan(world, p, dir, wantDown);
        if (plan === 'jump') {
          jump = true;
          this.jumpWhy = 'gap';
        } else if (plan === 'wait') {
          dir = 0;
          this.waitT++;
        }
        // 'drop': walk on and fall onto the floor below.
      }
    }
    if (riding && this.waitT === 0 && support) {
      // Off a ride that reached its end is handled by rideOn; nothing to do here.
    }
    // Drop through a one-way platform when the goal is well below.
    if (p.onGround && p.body.onOneWay && !riding && goal.y > p.y + 24 && Math.abs(goal.x - p.x) < 200 && this.safeBelow(world, p)) {
      if (this.t % 4 === 0) return DOWN | JUMP;
      return DOWN;
    }

    // ---- facing: turn toward a target behind (on the ground only)
    let press = dir;
    /** Toward the target at about 45° (up + toward = the diagonal, GDD §4.3). */
    let diagSide = 0;
    if (target) {
      const a = this.aimPoint(target);
      const tdx = a.x - p.x;
      const s = Math.sign(tdx);
      const behind = s !== 0 && s !== p.facing && Math.abs(tdx) > 10;
      const free = p.onGround && this.airDir === null && !riding && !jump;
      // Turn only on the ground (pressing back in the air would cut a jump short over a pit),
      // and never step off a ride or a ledge edge to do it.
      if (behind && p.onGround && this.airDir === null && !riding && this.edgeOk(world, p, s)) press = s;
      // Aim up at targets above (GDD §4.3): straight up only while standing still, so stop
      // under a target nearly overhead (a while, then walk on); up + toward fires at 45°.
      const dy = p.y - 22 - a.y;
      const adx = Math.abs(tdx);
      if (dy > 16 && adx < 24) {
        // Already holding still (an arena spot, a reached goal, a goal close by): no cap.
        if (free && (dir === 0 || Math.abs(goal.x - p.x) < 24 || this.overheadT < 60)) {
          this.overheadT++;
          dir = 0;
          // Straight up needs the feet planted right under it (up + a side would be the
          // diagonal), so first step in under the target, then hold up.
          if (adx > 6 && this.edgeOk(world, p, s)) press = s;
          else {
            press = 0;
            mask |= UP;
          }
        }
      } else {
        this.overheadT = 0;
        if (dy > adx * 0.5 && dy < adx * 2 && adx < 240) {
          if (free && dir === 0 && this.edgeOk(world, p, s)) {
            // Holding a spot: step toward the target on the firing ticks only (no drift away).
            press = this.t % 2 === 0 || p.facing !== s ? s : 0;
            diagSide = s;
          } else if (press === s && (!p.onGround || Math.abs(goal.x - p.x) < 32 || this.t % 6 < 2)) {
            // Walking on: on the ground the diagonal plants the feet (GDD §4.3), so aim it in
            // short bursts and keep moving in between; near the goal (an arena spot, often up
            // against a body wall) plant and fire; in the air it never stops the player.
            diagSide = s;
          }
          if (diagSide !== 0) mask |= UP;
        }
      }
    } else this.overheadT = 0;

    // ---- dodging: pick a move that no incoming shot hits
    if (this.opts.dodge && p.onGround && !jump && !air.active && !riding) {
      const d = this.planDodge(world, p, press);
      if (d) {
        press = d.press;
        if (d.crouch) mask = (mask & ~UP) | DOWN;
        // A dodge away from the target: no diagonal the wrong way.
        if (diagSide !== 0 && press !== diagSide) mask &= ~UP;
        if (d.jump) {
          jump = true;
          this.jumpWhy = 'dodge';
          this.airDir = d.press;
        }
      }
    }
    if (press < 0) mask |= L;
    else if (press > 0) mask |= R;

    // ---- stuck detector (only while really trying to move on)
    this.watchProgress(runner, p, riding || this.waitT > 0 ? 0 : dir);
    if (this.jumpHold > 0 && !riding) {
      this.jumpHold--;
      jump = true;
      this.jumpWhy = 'stuck';
    }
    if (dir !== 0) this.waitT = 0;

    // Jump presses need an edge: press, then release on the next tick if still airborne.
    if (jump && (p.onGround || p.body.ticksSinceGrounded <= 3)) mask |= JUMP;

    // ---- fire constantly: taps for tap weapons, a held trigger for automatic ones
    if (p.weapon.auto) mask |= FIRE;
    else if (this.t % 2 === 0) mask |= FIRE;

    // ---- bombs
    if (this.opts.bombs && p.slot.bombs > 0 && this.t - this.lastBomb > 40 && this.wantsBomb(world, p)) {
      this.lastBomb = this.t;
      mask |= BOMB;
    }
    return mask;
  }

  /** Plan the airborne steering of the jump started now. */
  private aim(y: number, lo: number, hi: number): void {
    const a = this.airTarget;
    a.active = true;
    a.y = y;
    a.lo = lo;
    a.hi = Math.max(lo, hi);
  }

  /**
   * Stay on this dynamic solid? Yes while it is a ride (cable car / lift with a path) that has
   * not reached its end and whose end is nearer the goal than where it is now.
   */
  private rideOn(box: NonNullable<Player['body']['supportSolid']>, goal: BotGoal, scroll: string): boolean {
    if (!isRide(box)) return false;
    const end = pathEnd(box.owner, this.endPt);
    if (!end) return false;
    const cx = box.x + box.w / 2;
    const now = this.progressOf(scroll, cx, box.y, goal);
    const then = this.progressOf(scroll, end.x, end.y, goal);
    return then > now + 4;
  }

  /** How far along (higher = better) a point is toward the goal / scroll direction. */
  private progressOf(scroll: string, x: number, y: number, goal: BotGoal): number {
    if (goal.kind.startsWith('exit') || goal.kind === 'end' || goal.kind === 'car') return -Math.hypot(goal.x - x, (goal.y - y) * 1.5);
    if (scroll === 'up') return -y;
    if (scroll === 'down') return y;
    return x;
  }

  /**
   * The point to shoot at: the lowest alive, unarmoured part of a boss (the one a player on the
   * floor reaches), else the target's centre.
   */
  private aimPoint(target: Entity): { x: number; y: number } {
    const a = this.aimPt;
    if (target === this.bossRef && this.bossPt.ok) {
      a.x = this.bossPt.x;
      a.y = this.bossPt.y;
      return a;
    }
    a.x = target.x + target.hitbox.x + target.hitbox.w * 0.5;
    a.y = target.y + target.hitbox.y + target.hitbox.h * 0.5;
    return a;
  }

  /**
   * Index of the lowest hittable, unarmoured part of a boss (centre into `out`) that is not in
   * the `skip` bit mask; -1 if none.
   */
  private lowestPart(b: Boss, skip: number, out: { x: number; y: number }): number {
    let found = -1;
    for (let i = 0; i < b.parts.length; i++) {
      const part = b.parts[i];
      if (!part.enabled || part.destroyed || part.armored || (i < 31 && (skip & (1 << i)) !== 0)) continue;
      const r = b.partRect(part);
      if (r.w <= 0) continue;
      const cy = r.y + r.h * 0.5;
      if (found < 0 || cy > out.y) {
        out.x = r.x + r.w * 0.5;
        out.y = cy;
        found = i;
      }
    }
    return found;
  }

  private readonly spot = { x: 0, y: 0 };

  /**
   * Nearest terrain ledge spot (into `spot`) with a clear 45° or straight-up line to the boss
   * part `b` (balconies, crate steps); false if none.
   */
  private ledgeSpot(world: World, p: { x: number; y: number }, b: { x: number; y: number }, lo: number, hi: number): boolean {
    const ls = terrainLedges(world.terrain);
    let best = Infinity;
    for (let i = 0; i < ls.length; i++) {
      const l = ls[i];
      const eye = l.y - 22;
      if (eye < b.y - 16 || l.x1 < lo || l.x0 > hi || l.y > p.y + 40) continue;
      const a = Math.max(lo, l.x0 + 6);
      const z = Math.min(hi, l.x1 - 6);
      if (z < a) continue;
      const d = eye - b.y;
      // Straight up, 45° from either side, or level with it (a forward shot from the ledge end).
      for (let k = 0; k < 4; k++) {
        if (k < 3 && d < 12) continue;
        if (k === 3 && d > 16) continue;
        const x = k === 0 ? b.x : k === 3 ? Math.max(a, Math.min(z, b.x)) : b.x + (k === 1 ? -d : d);
        const ey = k === 3 ? b.y : eye;
        if (x < a || x > z || Math.abs(x - b.x) < 8 && k === 3 || !this.lineClear(x, ey, b.x, b.y)) continue;
        const cost = Math.abs(x - p.x) + Math.abs(l.y - p.y) * 2;
        if (cost < best) {
          best = cost;
          this.spot.x = x;
          this.spot.y = l.y;
        }
      }
    }
    return best < Infinity;
  }

  /** No other hittable part of the current boss on the line (x0, y0) → (x1, y1) (6 px steps). */
  private lineClear(x0: number, y0: number, x1: number, y1: number): boolean {
    const boss = this.bossRef;
    if (!boss) return true;
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 6));
    for (let k = 1; k < n; k++) {
      const x = x0 + ((x1 - x0) * k) / n;
      const y = y0 + ((y1 - y0) * k) / n;
      for (let i = 0; i < boss.parts.length; i++) {
        if (i === this.bossPart) continue;
        const part = boss.parts[i];
        if (!part.enabled || part.destroyed) continue;
        const r = boss.partRect(part);
        if (r.w > 0 && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return false;
      }
    }
    return true;
  }

  /**
   * The fighting boss's lowest open part (aim point and arena stand-off). A part that takes no
   * damage for 5 s (damped, shielded, out of reach) is skipped for the next one; when every
   * part was skipped the round starts over.
   */
  private findBossPart(world: World): void {
    const b = this.bossPt;
    b.ok = false;
    let boss: Boss | null = null;
    const list = world.byTag('boss');
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e instanceof Boss && e.alive && e.state === 'fight') {
        boss = e;
        break;
      }
    }
    if (boss !== this.bossRef) {
      this.bossRef = boss;
      this.bossPart = -1;
      this.bossSkip = 0;
    }
    if (!boss) return;
    let idx = this.lowestPart(boss, this.bossSkip, b);
    if (idx < 0 && this.bossSkip !== 0) {
      this.bossSkip = 0;
      idx = this.lowestPart(boss, 0, b);
    }
    if (idx < 0) return;
    b.ok = true;
    const part = boss.parts[idx];
    const hp = boss.hp + (Number.isFinite(part.hp) ? part.hp : 0);
    if (idx !== this.bossPart || hp < this.bossHpMark) {
      this.bossPart = idx;
      this.bossHpMark = hp;
      this.bossMarkT = this.t;
    } else if (this.t - this.bossMarkT > 300 && idx < 31) {
      this.bossSkip |= 1 << idx;
      this.bossPart = -1;
    }
  }

  /** Nearest hostile target on screen, preferring the facing side and the same height. */
  pickTarget(world: World, p: { x: number; y: number; facing: number }): Entity | null {
    const list = world.byTag('shootable');
    let best: Entity | null = null;
    let bestScore = Infinity;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive || e.team !== 'enemy' || !world.onScreen(e, -4)) continue;
      const dx = e.x - p.x;
      const dy = Math.abs(e.y - p.y);
      const score = Math.abs(dx) + dy * 0.7 + (Math.sign(dx) === p.facing ? 0 : 40);
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  private readonly goalOut: BotGoal = { x: 0, y: 0, kind: '' };
  private readonly exitKinds = new WeakMap<ExitDef, string>();

  private setGoal(x: number, y: number, kind: string): BotGoal {
    const g = this.goalOut;
    g.x = x;
    g.y = y;
    g.kind = kind;
    return g;
  }

  /** The navigation goal: vehicle, hostage, pickup, cable car, arena spot, exit or section end. */
  goal(runner: MissionRunner, p: { x: number; y: number }, onFoot = true): BotGoal {
    const world = runner.world;
    const cam = world.camera;
    const sec = runner.section;
    if (onFoot) {
      // Empty vehicles nearby.
      if (this.opts.vehicles) {
        const vs = world.byTag('vehicle');
        for (let i = 0; i < vs.length; i++) {
          const v = vs[i];
          if (v instanceof Vehicle && v.alive && v.state === 'idle' && !this.leftVehicles.has(v) && Math.abs(v.x - p.x) < 160 && Math.abs(v.y - p.y) < 60) {
            return this.setGoal(v.x, v.y, 'vehicle');
          }
        }
      }
      // Freed hostages wandering about: touch them for the gift.
      const hs = world.byTag('hostage');
      for (let i = 0; i < hs.length; i++) {
        const h = hs[i] as Entity & { state?: string };
        if (h.alive && h.state === 'walk' && Math.abs(h.x - p.x) < 160 && Math.abs(h.y - p.y) < 50 && world.onScreen(h, -8)) {
          return this.setGoal(h.x, h.y, 'hostage');
        }
      }
    }
    // Pickups within reach.
    const items = world.byTag('item');
    let item: Entity | null = null;
    let bestD = 110;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.alive || Math.abs(it.y - p.y) > 36 || !world.onScreen(it, -8)) continue;
      const d = Math.abs(it.x - p.x);
      if (d < bestD) {
        bestD = d;
        item = it;
      }
    }
    if (item) return this.setGoal(item.x, item.y, 'item');
    // Locked arena: hold a spot left of centre and let the enemies come; against a boss part
    // well above, stand off so it is on a 45° line (up + toward fires at it, GDD §4.3).
    if (cam.locked && sec.scroll !== 'up' && sec.scroll !== 'down') {
      const b = this.bossPt;
      const dy = p.y - 22 - b.y;
      if (b.ok && dy > 40) {
        // A side whose 45° line reaches the part without crossing another part (shots stop at
        // the first part they touch), else straight under it, else the near side anyway.
        const off = Math.min(160, dy);
        const lo = cam.left + 24;
        const hi = cam.right - 24;
        const eyeY = p.y - 22;
        const near = Math.sign(p.x - b.x) || -1;
        let x = NaN;
        for (let k = 0; k < 2 && Number.isNaN(x); k++) {
          const sx = b.x + (k === 0 ? near : -near) * off;
          if (sx >= lo && sx <= hi && this.lineClear(sx, eyeY, b.x, b.y)) x = sx;
        }
        if (Number.isNaN(x) && b.x >= lo && b.x <= hi && this.lineClear(b.x, eyeY, b.x, b.y)) x = b.x;
        if (Number.isNaN(x) && this.ledgeSpot(world, p, b, lo, hi)) return this.setGoal(this.spot.x, this.spot.y, 'arena');
        if (Number.isNaN(x)) {
          const side = b.x + near * off < lo || b.x + near * off > hi ? -near : near;
          x = Math.max(lo, Math.min(hi, b.x + side * off));
        }
        return this.setGoal(x, p.y, 'arena');
      }
      return this.setGoal(cam.left + 120, p.y, 'arena');
    }
    // An open exit: the chosen route.
    const ex = this.pickExit(runner);
    if (ex) {
      let kind = this.exitKinds.get(ex);
      if (!kind) {
        kind = `exit:${ex.to}`;
        this.exitKinds.set(ex, kind);
      }
      // Aim at the exit's floor, or at the player's own height when the rect spans it (tall exits).
      const ey = Math.min(ex.rect.y + ex.rect.h - 2, Math.max(ex.rect.y + 8, p.y));
      return this.setGoal(ex.rect.x + ex.rect.w / 2, ey, kind);
    }
    // A cable car that carries us along the way.
    if (onFoot) {
      const car = this.boardable(world, p, sec.scroll);
      if (car) return this.setGoal(car.x + car.w / 2, car.y, 'car');
    }
    // Otherwise follow the scroll direction.
    if (sec.scroll === 'up') return this.setGoal(p.x, cam.top - 200, 'up');
    if (sec.scroll === 'down') return this.setGoal(p.x, cam.bottom + 200, 'down');
    return this.setGoal(sec.width - 4, p.y, 'end');
  }

  private readonly carOut = { x: 0, y: 0, w: 0 };

  /** A ride (cable car) near the player that has not reached its end and goes our way. */
  private boardable(world: World, p: { x: number; y: number }, scroll: string): { x: number; y: number; w: number } | null {
    const cam = world.camera;
    for (let i = 0; i < this.dynCount; i++) {
      const l = this.dyn[i];
      const box = l.box;
      if (!box || !isRide(box)) continue;
      const cx = box.x + box.w / 2;
      if (cx < cam.left - 32 || cx > cam.right + 32 || box.y < cam.top - 16 || box.y > cam.bottom + 16) continue;
      const end = pathEnd(box.owner, this.endPt);
      if (!end) continue;
      // Ahead of us (or right here) and going further in the scroll direction.
      let gain: number;
      let behind: number;
      if (scroll === 'up') {
        gain = box.y - end.y;
        behind = box.y - p.y;
      } else if (scroll === 'down') {
        gain = end.y - box.y;
        behind = p.y - box.y;
      } else {
        gain = end.x - cx;
        behind = p.x - (box.x + box.w);
      }
      if (gain > 48 && behind < 24 && Math.abs(cx - p.x) < 280) {
        // A car that goes sideways: stand on its leading half (a car that starts level with the
        // floor only leaves when the rider stands on it, not on the floor beside it).
        const lead = scroll === 'up' || scroll === 'down' ? 0 : Math.sign(end.x - cx) * (box.w / 2 - 12);
        const b = this.carOut;
        b.x = box.x + lead;
        b.y = box.y;
        b.w = box.w;
        return b;
      }
    }
    return null;
  }

  /** The enabled exit matching the route (upper = highest rect, lower = lowest). */
  private pickExit(runner: MissionRunner): ExitDef | null {
    const exits = runner.section.exits;
    if (!exits || exits.length === 0) return null;
    let best: ExitDef | null = null;
    for (const ex of exits) {
      if (!runner.isExitOpen(ex)) continue;
      if (!best) best = ex;
      else if (this.opts.route === 'upper' ? ex.rect.y < best.rect.y : ex.rect.y > best.rect.y) best = ex;
    }
    return best;
  }

  /**
   * Climbing toward a goal above: pick the nearest ledge 8–44 px above the feet (terrain or a
   * dynamic solid) and get onto it (one-way: jump from below; solids: jump from the side; from a
   * ledge: jump at its edge toward the next one).
   */
  private readonly climb = { dir: 0, jump: false, ledge: null as unknown as Ledge };

  private plan(dir: number, jump: boolean, ledge: Ledge): { dir: number; jump: boolean; ledge: Ledge } {
    const c = this.climb;
    c.dir = dir;
    c.jump = jump;
    c.ledge = ledge;
    return c;
  }

  private climbPlan(world: World, p: Player, goalX: number): { dir: number; jump: boolean; ledge: Ledge } | null {
    const feet = p.y;
    const toward = Math.sign(goalX - p.x) || 1;
    let best: Ledge | null = null;
    let bestD = Infinity;
    const stat = terrainLedges(world.terrain);
    const own = p.body.supportSolid;
    for (let k = 0, n = stat.length + this.dynCount; k < n; k++) {
      const l = k < stat.length ? stat[k] : this.dyn[k - stat.length];
      if (l.box && l.box === own) continue;
      const rise = feet - l.y;
      if (rise < 8 || rise > JUMP_REACH) continue;
      // Horizontal distance from the player to the ledge span; ledges toward the goal are cheaper.
      const d = p.x < l.x0 ? l.x0 - p.x : p.x > l.x1 ? p.x - l.x1 : 0;
      const side = Math.sign((l.x0 + l.x1) / 2 - p.x);
      const score = d + (side !== 0 && side !== toward ? 60 : 0);
      if (d > 140 || score >= bestD) continue;
      bestD = score;
      best = l;
    }
    if (!best) return null;
    const l = best;
    if (l.oneWay) {
      const lo = l.x0 + 8;
      const hi = l.x1 - 8;
      if (p.x >= lo && p.x <= hi) return this.plan(toward, true, l);
      const dir = p.x < lo ? 1 : -1;
      // Standing on another ledge that ends before this one: jump at its edge.
      const edge = edgeDistance(world, p.x, p.y, dir);
      return this.plan(dir, edge < 10 || Math.abs((dir > 0 ? lo : hi) - p.x) < 40, l);
    }
    // Solid block: run at it and jump just before the side.
    const side = p.x < l.x0 ? l.x0 : l.x1;
    const dir = p.x < l.x0 ? 1 : p.x > l.x1 ? -1 : toward;
    return this.plan(dir, Math.abs(p.x - side) < 22, l);
  }

  /** Walk-off direction toward a goal below a solid floor: the nearer edge with a safe drop. */
  private dropDir(world: World, p: Player, goalX: number): number {
    let bestDir = 0;
    let bestD = Infinity;
    for (let s = -1; s <= 1; s += 2) {
      const d = edgeDistance(world, p.x, p.y, s, 320);
      if (d >= 320) continue;
      const l = predictLanding(world, p.x + s * (d + 6), p.y, 0, 0, GRAVITY, MAX_FALL, this.landing);
      if (!l.ok || deadlyAt(world, l.x, l.y, 24, true)) continue;
      const cost = d + Math.abs(p.x + s * d - goalX) * 0.25;
      if (cost < bestD) {
        bestD = cost;
        bestDir = s;
      }
    }
    return bestDir;
  }

  /** Is the floor below a one-way platform safe to drop onto? */
  private safeBelow(world: World, p: Player): boolean {
    const l = predictLanding(world, p.x, p.y + 6, 0, 0, GRAVITY, MAX_FALL, this.landing, p);
    return l.ok && !deadlyAt(world, l.x, l.y, 24, true);
  }

  /** Floor and no deadly hazard all along the next `dist` px: a jump there lands safely. */
  private safeAhead(world: World, p: Player, dir: number, dist: number): boolean {
    for (let d = 8; d <= dist; d += 8) {
      const x = p.x + dir * d;
      if (!Number.isFinite(floorAt(world, x, p.y - 2, p.y + 64))) return false;
      if (deadlyAt(world, x, p.y, 40, true)) return false;
    }
    return true;
  }

  /** Turning toward `dir` is fine here (not at a ledge edge over a drop). */
  private edgeOk(world: World, p: Player, dir: number): boolean {
    return Number.isFinite(floorAt(world, p.x + dir * 10, p.y - 3, p.y + 64));
  }

  /** What is just ahead: a wall / step (jump), a gap or deadly hazard, or nothing. */
  private obstacle(world: World, p: Player, dir: number): 'wall' | 'gap' | null {
    const t = world.terrain;
    const half = p.body.w / 2;
    // A wall or a step too high to walk onto (one-way platforms are no walls).
    if (this.blocked(world, p.x + dir * (half + 2), p.y) || this.blocked(world, p.x + dir * (half + 8), p.y)) return 'wall';
    if (p.body.contact.hitWall) return 'wall';
    // A pit or a long drop just ahead (no floor within 64 px below).
    if (!Number.isFinite(floorAt(world, p.x + dir * (half + 4), p.y - 2, p.y + 64))) return 'gap';
    // A deadly hazard just ahead.
    if (t.hazards.length > 0) {
      for (let d = half + 2; d <= half + 20; d += 6) if (deadlyAt(world, p.x + dir * d, p.y, 40, true)) return 'gap';
    }
    return null;
  }

  /** Ground or a solid rect rises more than a walkable step at x. */
  private blocked(world: World, x: number, feet: number): boolean {
    const t = world.terrain;
    const step = t.surfaceY(x, feet - JUMP_REACH - 4, feet - 5, NO_PLATFORMS);
    if (Number.isFinite(step) || t.isSolid(x, feet - 10) || t.isSolid(x, feet - 24)) return true;
    // Solid (not one-way) dynamic boxes in the way.
    const solids = world.solids;
    for (let i = 0; i < solids.length; i++) {
      const b = solids[i];
      if (!b.enabled || b.oneWay || x < b.x || x >= b.x + b.w) continue;
      if (b.y < feet - 5 && b.y + b.h > feet - 28) return true;
    }
    return false;
  }

  /**
   * A gap or hazard ahead: 'jump' when a run jump (full speed, or braked in the air) lands safely
   * (the airborne steering is planned), 'wait' when nothing lands but a moving platform may
   * come, 'drop' when the goal is below and walking off lands safely. With no option and no
   * moving platform about, jump anyway (the old behaviour; the stuck detector takes over).
   */
  private gapPlan(world: World, p: Player, dir: number, wantDown: boolean): 'jump' | 'wait' | 'drop' {
    if (wantDown) {
      const l = predictLanding(world, p.x + dir * (p.body.w / 2 + 6), p.y, dir * 1.5, 0, GRAVITY, MAX_FALL, this.landing, p);
      if (l.ok && !deadlyAt(world, l.x, l.y, 24, true)) return 'drop';
    }
    const own = p.body.supportSolid;
    for (let k = 0; k < 4; k++) {
      const vx = dir * (RUN_JUMP_VX - k * 0.5);
      const l = predictLanding(world, p.x, p.y, vx, JUMP_VY, GRAVITY, MAX_FALL, this.landing, own ? own.owner : null);
      if (!l.ok || deadlyAt(world, l.x, l.y, 24, true) || (l.box === null && l.y > p.y + 64 && !wantDown)) continue;
      if (l.box && l.box === own) continue;
      // Steer onto the floor around the landing point.
      const lo = this.spanEnd(world, l.x, l.y, -1, l.box);
      const hi = this.spanEnd(world, l.x, l.y, 1, l.box);
      if (hi - lo < 6) continue;
      const m = Math.min(8, (hi - lo) / 3);
      this.aim(l.y, lo + m, hi - m);
      this.waitT = 0;
      return 'jump';
    }
    // Nothing lands: wait for a moving platform when one is around (up to a while).
    if (this.movingNear(p) && this.waitT < 600) return 'wait';
    this.airTarget.active = false;
    return 'jump';
  }

  /** The x where the floor at (x, y) ends going `dir` (up to 160 px; boxes: their own edge). */
  private spanEnd(world: World, x: number, y: number, dir: number, box: { x: number; w: number; dx: number } | null): number {
    if (box) return dir < 0 ? x - (x - box.x) + 0 : box.x + box.w;
    let d = 0;
    for (; d < 160; d += 4) {
      const fx = x + dir * (d + 4);
      if (!Number.isFinite(world.terrain.surfaceY(fx, y - 3, y + 3)) || deadlyAt(world, fx, y, 24, true)) break;
    }
    return x + dir * d;
  }

  /** A dynamic solid (moving platform, cable car) within 240 px. */
  private movingNear(p: Player): boolean {
    for (let i = 0; i < this.dynCount; i++) {
      const b = this.dyn[i].box;
      if (!b) continue;
      const cx = b.x + b.w / 2;
      if (Math.abs(cx - p.x) < 240 && Math.abs(b.y - p.y) < 120) return true;
    }
    return false;
  }

  // ------------------------------------------------------------------------------- dodging

  /** Incoming threats (reused between ticks). */
  private readonly threats: Array<{ x: number; y: number; vx: number; vy: number; g: number; hw: number; hh: number }> = [];

  /**
   * Predict where enemy shots go over the next 36 ticks and test a few moves against them:
   * the planned one, crouching, stepping toward or away from the shooter, jumping. Returns the
   * first move no shot hits (null when the planned move is already safe), else the move that
   * gets hit last.
   */
  private planDodge(world: World, p: Player, press: number): { press: number; crouch: boolean; jump: boolean } | null {
    const list = world.byTag('shot');
    const threats = this.threats;
    let n = 0;
    let from = 0;
    for (let i = 0; i < list.length && n < 8; i++) {
      const s = list[i] as Entity & { gravity?: number };
      if (!s.alive || s.team !== 'enemy' || Math.abs(s.x - p.x) > 170 || Math.abs(s.y - p.y) > 150) continue;
      const t = threats[n] ?? (threats[n] = { x: 0, y: 0, vx: 0, vy: 0, g: 0, hw: 0, hh: 0 });
      t.x = s.x;
      t.y = s.y;
      t.vx = s.vx;
      t.vy = s.vy;
      t.g = typeof s.gravity === 'number' ? s.gravity : 0;
      // Explosive shots (shells, grenades) hurt around where they land: widen them.
      const blast = (s as Entity & { damage?: { kind?: string } }).damage?.kind === 'explosion' || t.g > 0 ? 20 : 0;
      t.hw = s.hitbox.w / 2 + blast;
      t.hh = s.hitbox.h / 2 + blast;
      if (n === 0) from = Math.sign(-s.vx) || Math.sign(s.x - p.x) || 1;
      n++;
    }
    // Thin boss contact lanes (a lashing chain, a stomp landing): a lash grows toward the
    // player, so each is modelled as a front moving at him.
    const bosses = world.byTag('boss');
    for (let i = 0; i < bosses.length && n < 8; i++) {
      const b = bosses[i];
      if (!(b instanceof Boss) || !b.alive) continue;
      const boxes = b.contactBoxes();
      for (let k = 0; k < boxes.length && n < 8; k++) {
        const r = boxes[k];
        if (r.h > 20) continue;
        // Only a box that is growing (or grew in the last BOSS_LANE_MEMO ticks) is a sweep: a
        // tread, a deck or a stomp landing keeps its size and is left to the normal steering.
        let m = this.laneMemo.get(r);
        if (!m) this.laneMemo.set(r, (m = { w: r.w, grew: -BOSS_LANE_MEMO - 1 }));
        else if (r.w !== m.w) {
          m.w = r.w;
          m.grew = world.tick;
        }
        if (world.tick - m.grew > BOSS_LANE_MEMO) continue;
        if (Math.abs(r.x + r.w / 2 - p.x) > r.w / 2 + 2 * BOSS_LANE_LEAD) continue;
        const t = threats[n] ?? (threats[n] = { x: 0, y: 0, vx: 0, vy: 0, g: 0, hw: 0, hh: 0 });
        // The lane's front (the edge toward the player) sweeps on at BOSS_LANE_SPEED px/tick,
        // trailing a body BOSS_LANE_LEAD px long behind it.
        const side = p.x < b.x ? -1 : 1;
        const front = side < 0 ? r.x : r.x + r.w;
        t.x = front - side * (BOSS_LANE_LEAD / 2);
        t.y = r.y + r.h / 2;
        t.vx = side * BOSS_LANE_SPEED;
        t.vy = 0;
        t.g = 0;
        t.hw = BOSS_LANE_LEAD / 2;
        t.hh = r.h / 2;
        if (n === 0) from = side;
        n++;
      }
    }
    if (n === 0) return null;
    const planned = this.firstHit(p, n, press, 'stand');
    if (planned === Infinity) return null;
    const best = this.dodge;
    best.press = press;
    best.crouch = false;
    best.jump = false;
    this.bestHit = planned;
    if (this.tryMove(world, p, n, 0, 'crouch')) return best;
    if (this.tryMove(world, p, n, from, 'stand')) return best;
    if (this.tryMove(world, p, n, -from, 'stand')) return best;
    if (this.tryMove(world, p, n, press, 'jump')) return best;
    if (this.tryMove(world, p, n, from, 'jump')) return best;
    this.tryMove(world, p, n, -from, 'jump');
    return best;
  }

  private readonly dodge = { press: 0, crouch: false, jump: false };
  /** Last width of each boss contact box and the tick it last changed (sweep detection). */
  private readonly laneMemo = new WeakMap<object, { w: number; grew: number }>();
  private bestHit = 0;

  /** Test one move; keep it in `dodge` when it is hit later than the best so far. True = safe. */
  private tryMove(world: World, p: Player, n: number, dir: number, mode: 'stand' | 'crouch' | 'jump'): boolean {
    if (dir !== 0 && !this.safeAhead(world, p, dir, mode === 'jump' ? 120 : 40)) return false;
    const t = this.firstHit(p, n, dir, mode);
    if (t > this.bestHit) {
      this.bestHit = t;
      this.dodge.press = mode === 'crouch' ? 0 : dir;
      this.dodge.crouch = mode === 'crouch';
      this.dodge.jump = mode === 'jump';
    }
    return t === Infinity;
  }

  /** First tick (≤ 36) at which a threat overlaps the player doing `mode` while pressing `dir`. */
  private firstHit(p: Player, n: number, dir: number, mode: 'stand' | 'crouch' | 'jump'): number {
    const hw = mode === 'crouch' ? 8 : 7;
    const h = mode === 'crouch' ? 20 : 30;
    const speed = mode === 'jump' ? 2 : mode === 'crouch' ? 0 : 1.5;
    for (let t = 1; t <= 36; t++) {
      const px = p.x + dir * speed * t;
      let py = p.y;
      if (mode === 'jump') py = Math.min(p.y, p.y - 3.5 * t + 0.065 * t * t);
      for (let i = 0; i < n; i++) {
        const s = this.threats[i];
        const sx = s.x + s.vx * t;
        const sy = s.y + s.vy * t + 0.5 * s.g * t * t;
        if (Math.abs(sx - px) < hw + s.hw && sy + s.hh > py - h && sy - s.hh < py) return t;
      }
    }
    return Infinity;
  }

  /** A boss in range, or three enemies bunched up ahead. */
  wantsBomb(world: World, p: { x: number; y: number; facing: number }): boolean {
    const bosses = world.byTag('boss');
    for (let i = 0; i < bosses.length; i++) {
      const b = bosses[i];
      const dx = (b.x - p.x) * p.facing;
      if (b.alive && dx > 30 && dx < 200 && world.onScreen(b, 0)) return true;
    }
    const foes = world.byTag('enemy');
    let n = 0;
    for (let i = 0; i < foes.length; i++) {
      const e = foes[i];
      const dx = (e.x - p.x) * p.facing;
      if (e.alive && dx > 20 && dx < 140 && Math.abs(e.y - p.y) < 40) n++;
    }
    return n >= 3;
  }

  /** May the bot throw / fire a bomb now (option on, not too soon after the last one)? Marks it. */
  bombReady(gap: number): boolean {
    if (!this.opts.bombs || this.t - this.lastBomb <= gap) return false;
    return true;
  }

  markBomb(): void {
    this.lastBomb = this.t;
  }

  /** The bot's tick counter (modes time their taps with it). */
  get tick(): number {
    return this.t;
  }

  /** The mask sent last tick (modes check button edges and combos with it). */
  get lastMask(): number {
    return this.mask;
  }

  /** Stuck detector: no new progress for a while → jump; longer → back off, then jump. */
  private watchProgress(runner: MissionRunner, p: Player, dir: number): void {
    const scroll = runner.section.scroll;
    const progress = scroll === 'up' ? -p.y : scroll === 'down' ? p.y : p.x;
    if (progress > this.best + 2) {
      this.best = progress;
      this.stuckT = 0;
      return;
    }
    // Holding still on purpose (arenas, a goal reached, a ride, a wait) is not being stuck.
    if (runner.world.camera.locked || dir === 0) {
      this.stuckT = 0;
      return;
    }
    this.stuckT++;
    if (this.stuckT === 90 || this.stuckT === 150) this.jumpHold = 12;
    if (this.stuckT >= 240) {
      this.stuckT = 60;
      this.backoff = 24;
    }
  }

  // ------------------------------------------------------------------------------- vehicles

  /** Driving: forward, fire, cannon at bosses, jump gaps; never eject. */
  private drive(runner: MissionRunner, p: Player): number {
    const world = runner.world;
    const v = p.vehicle;
    // 0 cells: it stops and blows up — get out (eject = down, then jump with down held).
    if (v instanceof Vehicle && (v.state === 'doomed' || v.cells <= 0)) return this.t % 6 < 3 ? DOWN : DOWN | JUMP;
    let mask = runner.world.camera.locked ? 0 : R;
    if (p.weapon && this.t % 2 === 0) mask |= FIRE;
    if (v instanceof Vehicle) {
      const ahead = v.x + v.facing * (v.hitbox.w / 2 + 6);
      if (!Number.isFinite(floorAt(world, ahead, v.y - 2, v.y + 64, v)) && this.t % 3 === 0) mask |= JUMP;
      const target = this.pickTarget(world, p);
      if (target && target.y + target.hitbox.y + target.hitbox.h / 2 < v.y - 60) mask |= UP;
      if (this.opts.bombs && v.shells > 0 && this.t - this.lastBomb > 45 && this.wantsBomb(world, p)) {
        this.lastBomb = this.t;
        mask |= BOMB;
      }
    }
    return mask;
  }
}
