/**
 * The ring bot (docs/design/ring.md §15; FIRST VERSION — the integrator grows it): an autopilot
 * for one wagon on the A10, an `InputSource` like the side-scrolling `Bot` (src/sim/bot.ts).
 *
 * Every tick it reads the RingRunner (never the plan: it plays what it sees) and sets one button
 * mask for its slot:
 *
 * - A LANE SAFETY MAP: a danger score per lane (1 far … 4 near): closed or missing lanes (tunnels,
 *   the plan's closures ahead), enemy shots coming at the wagon's x, things ahead in the lane
 *   (civilian cover, hazards, enemies close by), a pull toward crates and pickups ahead (the
 *   wagon picks them up by driving over them), a small cost for each lane away from the current.
 * - Lane changes: FIRE released (the steer lock is off), up / down held until the wagon's
 *   `laneTarget` is the chosen lane.
 * - Shooting: FIRE held (the steer lock) with the D-pad aimed at the nearest hostile target on
 *   screen and on the road band (8 plane aims: along the lane, the ±20° diagonals, straight across); FIRE is let go
 *   for a tick now and then (a fresh press).
 * - Civilian cars: a car beside the wagon (x spans overlap, with a margin that grows with the
 *   closing speed) blocks its lane for a lane change; a car ahead or behind that closes in adds
 *   danger by its time to contact; a lane change counts every lane on the way. With the lane ahead
 *   blocked and no way out it backs off on screen.
 * - Bottles in flight (`ring-bottle`: `landX`, `landY`, `ticksLeft`): the landing lane gets danger
 *   when the wagon will be there; too late for a lane change (≤ `BOTTLE_SWERVE` ticks) → a swerve.
 * - JUMP = swerve when an enemy shot is about to reach the wagon in its lane (toward the safer
 *   neighbouring lane).
 * - BOMB (the lob) at a boss now and then.
 * - The screen x: it keeps to the rear half (speed cameras fine the front third).
 * - The in-world continue: START while its slot's countdown runs.
 *
 * No allocations per tick (fixed arrays); deterministic (no randomness).
 */
import type { Entity } from '../engine/entity';
import { BUTTON_BIT, type InputContext, type InputSource, type PlayerSlot } from '../engine/input';
import type { Scene } from '../engine/scene';
import type { World } from '../engine/world';
import type { RingHero } from '../game/ring/hero';
import { inRoadBand, laneAt, LANE_COUNT, laneY, nearestLane } from '../game/ring/lanes';
import type { RingRunner } from '../game/ring/runner';
import { RING } from '../game/ring/types';
import type { Wagon } from '../game/ring/wagon';

const L = BUTTON_BIT.left;
const R = BUTTON_BIT.right;
const UP = BUTTON_BIT.up;
const DOWN = BUTTON_BIT.down;
const FIRE = BUTTON_BIT.fire;
const JUMP = BUTTON_BIT.jump;
const BOMB = BUTTON_BIT.bomb;
const START = BUTTON_BIT.start;

/** What the ring bot needs from the game: the running ring (null between plays) and the top scene. */
export interface RingBotHost {
  readonly runner: RingRunner | null;
  readonly topScene?: Scene | null;
}

export interface RingBotOptions {
  /** Swerve (JUMP) from enemy shots (default true). */
  swerve?: boolean;
  /** Lob bombs at bosses (default true). */
  bombs?: boolean;
  /** Steer onto crates and pickups ahead (default true). */
  pickups?: boolean;
  /** The screen x the bot keeps its wagon at (default 120: the rear half; spec §7.4 fines the front third). */
  screenX?: number;
}

/** How far ahead (px) the bot looks for things in a lane, and behind. */
const LOOK_AHEAD = 220;
const LOOK_BEHIND = 40;
/** An enemy shot this close (px, along x) in the wagon's lane makes it swerve. */
const SWERVE_REACH = 70;
/** Ticks FIRE is held before a one-tick release (a fresh press). */
const FIRE_HOLD = 40;
/** Ticks between two lobs at a boss. */
const BOMB_EVERY = 120;
/** Half the wagon's length (px; wagon.ts WAGON_W / 2) and the gap it keeps to a car beside it. */
const WAGON_HALF = 46;
const CAR_MARGIN = 14;
/** A car that closes in within this many ticks makes its lane dangerous. */
const CAR_TTC = 90;
/** A bottle lands within this x of the wagon's middle (its smash ±10 + the wagon's half). */
const BOTTLE_REACH = WAGON_HALF + 16;
/** Bottle ticks left at which a lane change is too late: a swerve then. */
const BOTTLE_SWERVE = 16;
/** Danger of a closed lane 0, 96, 192, 288 and 384 px ahead of the wagon's middle. */
const CLOSURE_DANGER = [5000, 4000, 2000, 1200, 800] as const;
/** The front third of the screen (speed cameras fine a wagon there; spec §7.4). */
const FINE_X = 256;
/** Danger of a lane a car blocks beside the wagon (a lane change into it is a bump). */
const BLOCKED = 3000;

export class RingBot implements InputSource {
  readonly slot: PlayerSlot;
  readonly opts: Required<RingBotOptions>;
  private readonly host: RingBotHost;
  /** The mask of this tick (read by `read`). */
  private mask = 0;
  private t = 0;
  /** Ticks to stay quiet after a scene change (a scene suppresses held buttons until they are released). */
  private quiet = 0;
  private lastTop: Scene | null | undefined = undefined;
  private fireT = 0;
  private lastBomb = -BOMB_EVERY;
  /** Danger score per lane (index 1 … 4). */
  private readonly danger = new Float64Array(LANE_COUNT + 1);
  /** What it did this tick (traces, the shot tool's labels). */
  goal = 'idle';
  /** The lane it heads for (0 = none). */
  targetLane = 0;
  /** Its current target (null = none). */
  target: Entity | null = null;

  constructor(host: RingBotHost, slot: PlayerSlot, opts: RingBotOptions = {}) {
    this.host = host;
    this.slot = slot;
    this.opts = { swerve: opts.swerve ?? true, bombs: opts.bombs ?? true, pickups: opts.pickups ?? true, screenX: opts.screenX ?? 120 };
  }

  update(_ctx: InputContext): void {
    this.t++;
    const top = this.host.topScene;
    if (top !== undefined && top !== this.lastTop) {
      this.lastTop = top;
      this.quiet = 2;
    }
    if (this.quiet > 0) {
      this.quiet--;
      this.mask = 0;
      return;
    }
    this.mask = this.think();
  }

  read(slot: PlayerSlot, _ctx: InputContext): number {
    return slot === this.slot ? this.mask : 0;
  }

  private think(): number {
    const r = this.host.runner;
    this.target = null;
    if (!r) {
      this.goal = 'idle';
      return 0;
    }
    // The in-world continue: START (a press every other tick) while the countdown runs.
    if (r.continueTicks[this.slot] >= 0) {
      this.goal = 'continue';
      return this.t % 2 === 0 ? START : 0;
    }
    if (r.state !== 'playing') {
      this.goal = r.state;
      return 0;
    }
    const p = r.player(this.slot);
    const w = p?.wagon ?? null;
    if (!p || !w || p.state !== 'mounted') {
      this.goal = 'wait';
      return 0;
    }
    const world = r.world;
    const open = Math.max(1, Math.min(LANE_COUNT, r.lanesOpenAt(w.x)));
    this.assess(r, world, w, open);
    const here = nearestLane(w.y);
    // Swerve: an enemy shot is about to reach the wagon in its lane, or a bottle lands on it now.
    if (this.opts.swerve && w.swerveCool <= 0 && w.swerveT <= 0 && (this.incoming(world, w) || this.bottleNow(r, world, w))) {
      const up = here > 1 ? this.danger[here - 1] : Infinity;
      const down = here < open ? this.danger[here + 1] : Infinity;
      if ((up < BLOCKED || down < BLOCKED) && (up < Infinity || down < Infinity)) {
        this.goal = 'swerve';
        this.targetLane = up <= down ? here - 1 : here + 1;
        return JUMP | (up <= down ? UP : DOWN);
      }
    }
    // A target far ahead in another lane (a diagonal would pass it): pull toward its lane.
    const target = this.pickTarget(world, p);
    if (target) {
      const tl = laneAt(target.y);
      const dx = target.x - p.x;
      const dy = Math.abs(target.y - p.y);
      if (tl >= 1 && tl <= open && tl !== here && dx > 4.5 * dy && this.danger[tl] < Infinity) this.danger[tl] -= 80;
    }
    // The safest lane (the current one wins a tie); a change counts every lane on the way.
    const from = w.laneTarget;
    let best = from;
    let bestD = this.danger[best] ?? Infinity;
    for (let l = 1; l <= open; l++) {
      if (l === from) continue;
      let path = 0;
      for (let k = Math.min(l, from); k <= Math.max(l, from); k++) if (k !== from && this.danger[k] > path) path = this.danger[k];
      // A blocked way only to leave something worse (a closure right ahead).
      if (path >= BLOCKED && path >= this.danger[from] - 2500) continue;
      const d = path + Math.abs(l - from) * 12;
      if (d < bestD - 20) {
        best = l;
        bestD = d;
      }
    }
    this.targetLane = best;
    if (best !== from) {
      // A lane change: FIRE released, up / down held until the wagon heads for that lane.
      this.goal = 'lane';
      this.fireT = 0;
      return best < from ? UP : DOWN;
    }
    // A bottle lands on the wagon and no lane is free: forward or back on screen, away from it.
    const dodge = this.bottleDodge(r, world, w);
    if (dodge !== 0) {
      this.goal = 'dodge';
      this.fireT = 0;
      return dodge;
    }
    // Boxed in behind a car that closes in (every way out blocked): back off on screen.
    if (this.carAhead(world, w, from) && w.screenX > RING.screenMinX + 10) {
      this.goal = 'back-off';
      this.fireT = 0;
      return L;
    }
    // Shoot the nearest hostile target on screen (the steer lock holds lane and x).
    if (target) {
      this.target = target;
      this.goal = 'aim';
      if (this.opts.bombs && target.hasTag('boss') && this.t - this.lastBomb >= BOMB_EVERY) {
        this.lastBomb = this.t;
        return BOMB;
      }
      // Where each aim meets the target's lane: fire the one that hits, else move on screen.
      const box = target.hurtboxes()[0];
      const tx = box ? box.x + box.w / 2 : target.x;
      const hw = box ? box.w / 2 : 8;
      const aim = planeAim(tx - p.x, target.y - p.y, target.vx - w.vx, hw);
      if (aim.move !== 0 && this.canMove(w, aim.move)) {
        this.goal = 'line-up';
        this.fireT = 0;
        return aim.move;
      }
      this.fireT++;
      if (this.fireT > FIRE_HOLD) {
        this.fireT = 0;
        return 0;
      }
      return FIRE | aim.mask;
    }
    this.fireT = 0;
    // Nothing to shoot: keep to the screen x (forward / back on screen).
    const sx = w.screenX;
    const want = this.opts.screenX;
    if (sx < want - 8) {
      this.goal = 'forward';
      return R;
    }
    if (sx > want + 8) {
      this.goal = 'back';
      return L;
    }
    this.goal = 'cruise';
    return 0;
  }

  /** The danger score of every lane (index 1 … 4; Infinity = closed or missing). */
  private assess(r: RingRunner, world: World, w: Wagon, open: number): void {
    const danger = this.danger;
    danger[0] = Infinity;
    for (let l = 1; l <= LANE_COUNT; l++) danger[l] = l > open ? Infinity : 0;
    // The plan's closures just ahead (gantry red X, road works).
    for (let k = 0; k <= 4; k++) {
      const closed = r.closedLanesAtPlan(r.planX(w.x + k * 96));
      for (let i = 0; i < closed.length; i++) {
        const l = closed[i];
        // Close ahead it is worse than a bump with a car beside (a closure hit costs 2 cells).
        if (l >= 1 && l <= LANE_COUNT) danger[l] += CLOSURE_DANGER[k];
      }
    }
    const list = world.entities;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive || e === w || e === w.driver || e.hasTag('ring-hero') || e.hasTag('ring-wagon')) continue;
      if (e.hasTag('ring-bottle')) {
        // A bottle in flight (its y runs between lanes): where the wagon will be when it lands
        // (the wagon holds its screen x).
        const b = e as Entity & { landX?: number; landY?: number; ticksLeft?: number };
        if (b.landX === undefined || b.landY === undefined || b.ticksLeft === undefined) continue;
        const bl = laneAt(b.landY) || nearestLane(b.landY);
        if (bl < 1 || bl > LANE_COUNT || danger[bl] === Infinity) continue;
        const wx = w.x + r.roadSpeed * b.ticksLeft;
        // Worse the closer it is to landing (never steer back into it).
        if (Math.abs(b.landX - wx) < BOTTLE_REACH + 20) danger[bl] += 1500 + Math.max(0, 34 - b.ticksLeft) * 40;
        continue;
      }
      const l = laneAt(e.y);
      if (l < 1 || l > LANE_COUNT || danger[l] === Infinity) continue;
      const dx = e.x - w.x;
      if (e.hasTag('shot')) {
        if (e.team !== 'enemy') continue;
        // A shot coming at the wagon's x (relative to the wagon).
        const rel = e.vx - w.vx;
        if (Math.abs(dx) < 160 && (dx === 0 || Math.sign(rel) === -Math.sign(dx))) danger[l] += 260 - Math.abs(dx);
        continue;
      }
      if (e.team === 'neutral' && e.hasTag('ring-car')) {
        danger[l] += this.carDanger(e, w);
        continue;
      }
      if (dx < -LOOK_BEHIND || dx > LOOK_AHEAD) continue;
      if (this.opts.pickups && (e.hasTag('item') || e.hasTag('pickup') || e.type === 'ring-crate')) {
        danger[l] -= 120;
        continue;
      }
      if (e.team === 'enemy' && e.hasTag('shootable')) {
        // A foe right beside or just ahead in the lane: a bump or a ram.
        if (Math.abs(dx) < 70) danger[l] += 160;
        continue;
      }
      // Cover, civilians, closures and hazards in the lane ahead: the closer, the worse.
      if (e.team === 'neutral' || e.hasTag('hazard') || e.hasTag('solid')) danger[l] += 60 + Math.max(0, LOOK_AHEAD - Math.max(0, dx));
    }
  }

  /** The danger a civilian car adds to its lane: beside = blocked; closing in = by time to contact. */
  private carDanger(e: Entity, w: Wagon): number {
    const cL = e.x + e.hitbox.x;
    const cR = cL + e.hitbox.w;
    const wL = w.x - WAGON_HALF;
    const wR = w.x + WAGON_HALF;
    const ahead = cL - wR;
    const behind = wL - cR;
    // Closing speeds (px/tick, positive = the gap shrinks).
    const closeAhead = w.vx - e.vx;
    const closeBehind = e.vx - w.vx;
    const margin = CAR_MARGIN + Math.max(0, ahead >= 0 ? closeAhead : closeBehind) * 10;
    if (ahead < margin && behind < margin) return BLOCKED;
    const gap = ahead >= 0 ? ahead : behind;
    const close = ahead >= 0 ? closeAhead : closeBehind;
    const ttc = close > 0.05 ? gap / close : Infinity;
    if (ttc < CAR_TTC) return 300 + 1200 * (1 - ttc / CAR_TTC);
    return ahead >= 0 && ahead < LOOK_AHEAD ? 40 + (LOOK_AHEAD - ahead) * 0.4 : 0;
  }

  /** A car ahead in `lane` the wagon closes in on within 40 ticks (or right on its bumper). */
  private carAhead(world: World, w: Wagon, lane: number): boolean {
    const list = world.byTag('ring-car');
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive || laneAt(e.y) !== lane) continue;
      const gap = e.x + e.hitbox.x - (w.x + WAGON_HALF);
      if (gap < -8 || gap > 160) continue;
      const close = w.vx - e.vx;
      if (gap < 10 || (close > 0.05 && gap / close < 40)) return true;
    }
    return false;
  }

  /** L or R away from a bottle that lands on the wagon in its lane (0: none). */
  private bottleDodge(r: RingRunner, world: World, w: Wagon): number {
    const list = world.byTag('ring-bottle');
    for (let i = 0; i < list.length; i++) {
      const b = list[i] as Entity & { landX?: number; landY?: number; ticksLeft?: number };
      if (!b.alive || b.landX === undefined || b.landY === undefined || b.ticksLeft === undefined) continue;
      if (Math.abs(b.landY - laneY(w.laneTarget)) > 14) continue;
      const wx = w.x + r.roadSpeed * b.ticksLeft;
      const d = b.landX - wx;
      if (Math.abs(d) >= BOTTLE_REACH) continue;
      // Away from the landing spot; at an edge of the band, or with a car there, the other way.
      let back = d > 0 ? w.screenX > RING.screenMinX + 4 : w.screenX >= RING.screenMaxX - 4;
      if (back && this.carNear(world, w, -1)) back = false;
      else if (!back && this.carNear(world, w, 1)) back = true;
      return back ? L : R;
    }
    return 0;
  }

  /** May the wagon line up L / R (inside its band, out of the fine third, no car there)? */
  private canMove(w: Wagon, move: number): boolean {
    const world = w.world;
    if (move === R) return w.screenX < FINE_X - WAGON_HALF && !this.carNear(world, w, 1);
    return w.screenX > RING.screenMinX + 6 && !this.carNear(world, w, -1);
  }

  /** A car in the wagon's lane within 36 px ahead (dir 1) or behind (dir −1). */
  private carNear(world: World, w: Wagon, dir: 1 | -1): boolean {
    const list = world.byTag('ring-car');
    const lane = w.laneTarget;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive || laneAt(e.y) !== lane) continue;
      const gap = dir > 0 ? e.x + e.hitbox.x - (w.x + WAGON_HALF) : w.x - WAGON_HALF - (e.x + e.hitbox.x + e.hitbox.w);
      if (gap > -8 && gap < 36) return true;
    }
    return false;
  }

  /** A bottle about to land on the wagon in its lane (too late to change lanes: swerve). */
  private bottleNow(r: RingRunner, world: World, w: Wagon): boolean {
    const list = world.byTag('ring-bottle');
    for (let i = 0; i < list.length; i++) {
      const b = list[i] as Entity & { landX?: number; landY?: number; ticksLeft?: number };
      if (!b.alive || b.landX === undefined || b.landY === undefined || b.ticksLeft === undefined) continue;
      if (b.ticksLeft > BOTTLE_SWERVE || Math.abs(b.landY - w.y) > 14) continue;
      if (Math.abs(b.landX - (w.x + r.roadSpeed * b.ticksLeft)) < BOTTLE_REACH) return true;
    }
    return false;
  }

  /** An enemy shot in the wagon's lane about to reach it. */
  private incoming(world: World, w: Wagon): boolean {
    const list = world.byTag('shot');
    const lane = nearestLane(w.y);
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (!s.alive || s.team !== 'enemy' || laneAt(s.y) !== lane) continue;
      const dx = s.x - w.x;
      const rel = s.vx - w.vx;
      if (Math.abs(dx) < SWERVE_REACH && Math.sign(rel) === -Math.sign(dx)) return true;
    }
    return false;
  }

  /** The nearest hostile target on screen (bosses and foes; ahead and in the near lanes first). */
  private pickTarget(world: World, p: RingHero): Entity | null {
    const list = world.byTag('shootable');
    let best: Entity | null = null;
    let bestScore = Infinity;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      // Off the road band a shot cannot reach it (the runner removes shots that leave the band).
      if (!e.alive || e.team !== 'enemy' || !world.onScreen(e, -4) || e.hasTag('secret') || !inRoadBand(e.y, 4)) continue;
      const dx = e.x - p.x;
      const dy = Math.abs(e.y - p.y);
      // A hostage door first (the van passes by; the scooters come back).
      const score = Math.abs(dx) + dy * 2 + (dx < 0 ? 60 : 0) - (e.type === 'ring-hostage' ? 220 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }
}

/** Shot speed the aim solver assumes (px/tick; the pistol's 8, the machine gun's 9). */
const SHOT_SPEED = 8;
const DIAG_DX = Math.cos((20 * Math.PI) / 180);
const DIAG_DY = Math.sin((20 * Math.PI) / 180);

/**
 * The aim at a target (dx, dy) from the gun with the target's speed `rv` against the wagon
 * (px/tick) and its half width `hw`: `mask` the best D-pad aim (along the lane, the ±20°
 * diagonal or straight across, with the target's motion during the shot's flight), `move` L / R
 * when no aim meets the target (forward when it is beyond the diagonal, back when it sits between
 * the straight-across and the diagonal reach), else 0.
 */
export function planeAim(dx: number, dy: number, rv: number, hw: number): { mask: number; move: number } {
  const ax = dx >= 0 ? R : L;
  if (Math.abs(dy) < 6) return { mask: ax, move: 0 };
  const vert = dy < 0 ? UP : DOWN;
  const side = dx >= 0 ? 1 : -1;
  const tol = hw + 4;
  // Straight across: the shot meets the lane after |dy| / speed ticks at the gun's x.
  const tv = Math.abs(dy) / SHOT_SPEED;
  const errV = dx + rv * tv;
  if (Math.abs(errV) < tol) return { mask: vert, move: 0 };
  // The diagonal toward the target's side.
  const td = Math.abs(dy) / (SHOT_SPEED * DIAG_DY);
  const reach = side * SHOT_SPEED * DIAG_DX * td;
  const errD = dx + rv * td - reach;
  if (Math.abs(errD) < tol) return { mask: ax | vert, move: 0 };
  // Neither: line up (forward when the target is beyond the diagonal's reach, else back).
  const move = side * errD > 0 ? (side > 0 ? R : L) : side > 0 ? L : R;
  // Far off (more than a car length): just shoot the nearer miss and let the lane pull work.
  if (Math.abs(errD) > 120 && Math.abs(errV) > 120) return { mask: Math.abs(errD) < Math.abs(errV) ? ax | vert : vert, move: 0 };
  return { mask: Math.abs(errD) < Math.abs(errV) ? ax | vert : vert, move };
}

/**
 * The D-pad for a plane aim at (dx, dy) from the hero (dy < 0 = a far lane): along the lane when
 * the target is in it, straight across when it is about level on screen, else the ±20° diagonal.
 */
export function aimMask(dx: number, dy: number): number {
  const ax = dx >= 0 ? R : L;
  if (Math.abs(dy) < 6) return ax;
  const vert = dy < 0 ? UP : DOWN;
  // About one lane per 60 px along a diagonal (lanes.ts DIAG_ANGLE): steeper than that, straight across.
  if (Math.abs(dx) < Math.abs(dy) * 1.4) return vert;
  return ax | vert;
}

/** The lane band a plane y is in, or the nearest lane (bots, tools). */
export function botLane(y: number): number {
  return laneAt(y) || nearestLane(y);
}

/** The screen x band the wagon may use (for tools and tests). */
export const WAGON_BAND: readonly [number, number] = [RING.screenMinX, RING.screenMaxX];

/** The plane y of a lane (re-exported for the tools). */
export { laneY };
