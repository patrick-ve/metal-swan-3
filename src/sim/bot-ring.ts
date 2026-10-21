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
 * - BOMB (the lob) at a boss now and then: FIRE + the aim + BOMB when a lob's landing spot (ahead,
 *   across or behind, its lane or the one above) is on the boss's box.
 * - The screen x: it keeps to the rear half (speed cameras fine the front third).
 * - The in-world continue: START while its slot's countdown runs.
 * - Wave B (duck-typed fields; it reads what it sees): big vehicles (`ring-block`, `ring-big`) are
 *   blocks like civilian cars; a cone line (`ring-closure` entities) closes its lane over its
 *   extent; a parcel van in `tell-brake` / braking ahead and a caravan that comes loose
 *   (`tell-loose`, `loose`, `tip`) make their lanes dangerous (a swerve when it is too late); a
 *   SCAN LOCK strip (`ring-scan-strip`) makes its lane dangerous over its x range (it changes lanes
 *   out of a lock); a tow truck's `tell-hook` ahead in the lane is danger and a hook on its wagon is
 *   a swerve; a fine sticker on its wagon (`ring-sticker`) is shaken off with a swerve; a moto in
 *   `tell-baton` / `tell-sticker` beside the window gets the side ram (a swerve into its lane);
 *   parcels and the lorry's cargo land like bottles and then lie or roll in their lane
 *   (obstacles by time to contact); the forklift's charge makes its lane dangerous; a boarder on
 *   its bonnet gets the knife (FIRE held at him), or a swerve when he cocks a blow.
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
const BOMB_EVERY = 360;
/** Where a lob lands on screen: ahead / behind the wagon (content/ring/wagon/lob.ts `LOB`). */
const LOB_AHEAD = 112;
const LOB_BEHIND = 72;
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
/** Danger of a lane an attack is about to sweep (a brake check, a loose caravan, a charge, a lock). */
const ATTACK_LANE = 3600;
/** A brake check / hook within this many px ahead of the wagon's nose is too close for a lane change. */
const BRAKE_NEAR = 46;
/** Modes of the wave-B attacks the bot reads (`mode` strings of the content). */
const LOOSE_MODES: ReadonlySet<string> = new Set(['tell-loose', 'loose', 'tip']);
const CHARGE_MODES: ReadonlySet<string> = new Set(['tell-charge', 'charge']);
const MOTO_TELLS: ReadonlySet<string> = new Set(['tell-baton', 'tell-sticker']);

/** The duck-typed fields the bot reads off wave-B entities (never their classes). */
interface Lob extends Entity {
  landX?: number;
  landY?: number;
  ticksLeft?: number;
  lying?: boolean;
  flying?: boolean;
}
interface Moded extends Entity {
  mode?: string;
  braking?: boolean;
  hooked?: Entity | null;
  wagon?: Entity | null;
  aboard?: boolean;
}
interface Strip extends Entity {
  lane: number;
  state: string;
  x0: number;
  x1: number;
}

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
    // Swerve: an enemy shot is about to reach the wagon in its lane, a lob lands on it now, a
    // brake check / a charge / a hook is too close for a lane change, a tow hook or a sticker
    // holds it, or a boarder on the bonnet cocks a blow.
    if (this.opts.swerve && w.swerveCool <= 0 && w.swerveT <= 0) {
      // A moto cocking at the window: the side ram into its lane (it knocks the rider off).
      const moto = this.motoTell(world, w);
      if (moto !== 0) {
        this.goal = 'ram';
        this.targetLane = here + moto;
        return JUMP | (moto < 0 ? UP : DOWN);
      }
      if (this.incoming(world, w) || this.bottleNow(r, world, w) || this.mustSwerve(world, w)) {
        const up = here > 1 ? this.danger[here - 1] : Infinity;
        const down = here < open ? this.danger[here + 1] : Infinity;
        if ((up < BLOCKED || down < BLOCKED) && (up < Infinity || down < Infinity)) {
          this.goal = 'swerve';
          this.targetLane = up <= down ? here - 1 : here + 1;
          return JUMP | (up <= down ? UP : DOWN);
        }
      }
    }
    // A boarder on its bonnet: the knife (FIRE held at him, the steer lock keeps the lane).
    const boarder = this.boarderOn(world, w);
    if (boarder) {
      this.target = boarder;
      this.goal = 'knife';
      this.fireT++;
      if (this.fireT > FIRE_HOLD) {
        this.fireT = 0;
        return 0;
      }
      return FIRE | (boarder.x >= p.x ? R : L);
    }
    // A target far ahead in another lane (a diagonal would pass it): pull toward its lane. Only
    // with the wagon settled in a lane: between two lanes the nearest target changes with the
    // wagon's y and the pull flipped the lane every tick (a stuck lorry fight, seed 5).
    const target = this.pickTarget(world, p);
    const settled = Math.abs(w.y - laneY(w.laneTarget)) < 2;
    if (target && settled) {
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
    // An attack sweeps its lane and no lane is free (a brake check, a loose caravan, a charge):
    // back off on screen (more time, more room).
    if (this.danger[from] >= ATTACK_LANE && w.screenX > RING.screenMinX + 10 && this.attackAhead(world, w)) {
      this.goal = 'evade';
      this.fireT = 0;
      return L;
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
    // A boss on screen: a lob whose landing spot is on it (FIRE + the aim + BOMB in one tick).
    if (this.opts.bombs && p.slot.bombs > 0 && this.t - this.lastBomb >= BOMB_EVERY) {
      const m = this.lobAim(world, w);
      if (m !== 0) {
        this.lastBomb = this.t;
        this.goal = 'lob';
        this.fireT = 0;
        return FIRE | BOMB | m;
      }
    }
    // Shoot the nearest hostile target on screen (the steer lock holds lane and x).
    if (target) {
      this.target = target;
      this.goal = 'aim';
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
      if (isLobInFlight(e)) {
        // A bottle, cone, parcel or cargo in flight (its y runs between lanes): where the wagon
        // will be when it lands (the wagon holds its screen x).
        const b = e as Lob;
        if (b.landX === undefined || b.landY === undefined || b.ticksLeft === undefined) continue;
        const bl = laneAt(b.landY) || nearestLane(b.landY);
        if (bl < 1 || bl > LANE_COUNT || danger[bl] === Infinity) continue;
        const wx = w.x + r.roadSpeed * b.ticksLeft;
        // Worse the closer it is to landing (never steer back into it).
        if (Math.abs(b.landX - wx) < BOTTLE_REACH + 20) danger[bl] += 1500 + Math.max(0, 34 - b.ticksLeft) * 40;
        continue;
      }
      if (e.hasTag('ring-scan-strip')) {
        // SCAN LOCK: its lane over the strip's x range (fixed on screen); a lock is worse.
        const st = e as Strip;
        if (st.state === 'fade' || st.lane < 1 || st.lane > LANE_COUNT || danger[st.lane] === Infinity) continue;
        if (st.x1 > w.x - WAGON_HALF - 24 && st.x0 < w.x + WAGON_HALF + 24) danger[st.lane] += st.state === 'lock' ? ATTACK_LANE + 600 : ATTACK_LANE;
        continue;
      }
      if (e.hasTag('ring-closure') && e.type !== 'ring-closure') {
        // A cone line behind a road-works truck: its lane is closed over its extent.
        const l = laneAt(e.y);
        if (l < 1 || l > LANE_COUNT || danger[l] === Infinity) continue;
        const x0 = e.x + e.hitbox.x;
        const x1 = x0 + e.hitbox.w;
        const front = w.x + WAGON_HALF;
        if (x1 < w.x - WAGON_HALF - 8) continue;
        const ahead = Math.max(0, x0 - front);
        if (ahead < 400) danger[l] += CLOSURE_DANGER[Math.min(4, Math.floor(ahead / 96))];
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
      if ((e.team === 'neutral' && e.hasTag('ring-car')) || e.hasTag('ring-block') || e.hasTag('ring-big')) {
        // Civilian cars and the big vehicles (vans, caravans, the convoy, the road-works truck,
        // the lorry): a block beside, a danger by time to contact ahead or behind.
        danger[l] += this.carDanger(e, w);
        this.attackDanger(e as Moded, w, l, open);
        continue;
      }
      if (e.type === 'ring-parcel' || e.type === 'ring-barrel') {
        // A parcel lying in the lane or a drum rolling back along it: an obstacle that closes in.
        danger[l] += this.carDanger(e, w);
        continue;
      }
      if (e.type === 'ring-forklift') {
        const f = e as Moded;
        // The charge runs back along its lane (2 cells): the lane is no place to be.
        if (f.mode && CHARGE_MODES.has(f.mode) && dx > -WAGON_HALF && dx < 340) danger[l] += ATTACK_LANE;
        else danger[l] += this.carDanger(e, w) * 0.5;
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

  /**
   * The lanes a big vehicle's attack is about to sweep: a parcel van's brake check (its lane, ahead
   * of the wagon), a caravan coming loose (its lane and the lanes beside it, over its reach), a tow
   * truck's hook (its lane, ahead).
   */
  private attackDanger(e: Moded, w: Wagon, l: number, open: number): void {
    const mode = e.mode;
    if (!mode) return;
    const danger = this.danger;
    const gap = e.x + e.hitbox.x - (w.x + WAGON_HALF);
    if ((mode === 'tell-brake' || mode === 'brake' || e.braking) && gap > -20 && gap < 240) danger[l] += ATTACK_LANE;
    else if (mode === 'tell-hook' && gap > -20 && gap < 200) danger[l] += ATTACK_LANE;
    else if (LOOSE_MODES.has(mode)) {
      // A loose caravan drops back at the wagons, swerves one lane toward the median and back,
      // then tips and slides across the near lanes onto the hard shoulder: every lane from the
      // one above it down to the shoulder, while it is not yet behind the wagon.
      const x0 = e.x + e.hitbox.x;
      const x1 = x0 + e.hitbox.w;
      if (x1 + 40 < w.x - WAGON_HALF || x0 - 320 > w.x + WAGON_HALF) return;
      const top = mode === 'tip' ? l : Math.max(1, l - 1);
      for (let k = top; k <= open; k++) if (danger[k] < Infinity) danger[k] += k === l ? ATTACK_LANE : ATTACK_LANE - 600;
    }
  }

  /** Is a swerve the only way out now (a tow hook or a sticker on its wagon, a brake check, a charge or a blow right at it)? */
  private mustSwerve(world: World, w: Wagon): boolean {
    const lane = nearestLane(w.y);
    const list = world.entities;
    for (let i = 0; i < list.length; i++) {
      const e = list[i] as Moded;
      if (!e.alive) continue;
      // The tow hook holds its wagon; a sticker on its glass blocks the back aims.
      if (e.type === 'ring-tow-truck' && e.hooked === w) return true;
      if (e.hasTag('ring-sticker') && e.wagon === w) return true;
      // A boarder on its bonnet cocks a blow.
      if (e.type === 'ring-boarder' && e.wagon === w && e.mode === 'tell-hit') return true;
      if (laneAt(e.y) !== lane) continue;
      const gap = e.x + e.hitbox.x - (w.x + WAGON_HALF);
      const mode = e.mode;
      if (!mode) continue;
      if ((mode === 'brake' || e.braking || mode === 'tell-hook') && gap > -20 && gap < BRAKE_NEAR) return true;
      if (e.type === 'ring-forklift' && mode === 'charge' && e.x + e.hitbox.x + e.hitbox.w > w.x - WAGON_HALF && gap < 70) return true;
      if (LOOSE_MODES.has(mode) && gap < 60 && e.x + e.hitbox.x + e.hitbox.w > w.x - WAGON_HALF) return true;
    }
    return false;
  }

  /**
   * The D-pad of a lob that lands on a boss on screen (0: none fits). A lob lands `LOB_AHEAD`
   * ahead (forward), `LOB_BEHIND` behind (back) or at the wagon's x (straight across), in its own
   * lane or one lane toward the median (content/ring/wagon/lob.ts).
   */
  private lobAim(world: World, w: Wagon): number {
    const list = world.byTag('boss');
    const here = nearestLane(w.y);
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b.alive || !world.onScreen(b, -16)) continue;
      const bl = laneAt(b.y);
      const up = bl === here - 1;
      if (bl !== here && !up) continue;
      const x0 = b.x + b.hitbox.x + 12 - w.x;
      const x1 = b.x + b.hitbox.x + b.hitbox.w - 12 - w.x;
      const v = up ? UP : 0;
      if (LOB_AHEAD >= x0 && LOB_AHEAD <= x1) return R | v;
      if (up && x0 <= 0 && x1 >= 0) return UP;
      if (-LOB_BEHIND >= x0 && -LOB_BEHIND <= x1) return L | v;
    }
    return 0;
  }

  /** A brake check, a loose caravan or a charge ahead of the wagon (backing off helps). */
  private attackAhead(world: World, w: Wagon): boolean {
    const list = world.entities;
    for (let i = 0; i < list.length; i++) {
      const e = list[i] as Moded;
      const mode = e.mode;
      if (!e.alive || !mode) continue;
      const brake = mode === 'tell-brake' || mode === 'brake' || e.braking === true;
      if (!brake && !LOOSE_MODES.has(mode) && !(e.type === 'ring-forklift' && CHARGE_MODES.has(mode))) continue;
      const gap = e.x + e.hitbox.x - (w.x + WAGON_HALF);
      if (gap > -WAGON_HALF && gap < 260) return true;
    }
    return false;
  }

  /** A moto cocking a blow (or a sticker) at the window beside: −1 (far side) / +1 (near side), 0 none. */
  private motoTell(world: World, w: Wagon): number {
    const list = world.byTag('ring-handhaver-moto');
    const lane = nearestLane(w.y);
    for (let i = 0; i < list.length; i++) {
      const m = list[i] as Moded;
      if (!m.alive || !m.mode || !MOTO_TELLS.has(m.mode)) continue;
      const ml = laneAt(m.y);
      if (Math.abs(ml - lane) !== 1 || Math.abs(m.x - w.x) > WAGON_HALF + 20) continue;
      return ml - lane;
    }
    return 0;
  }

  /** A boarder on its bonnet (perched, cocking or hitting). */
  private boarderOn(world: World, w: Wagon): Entity | null {
    const list = world.byTag('ring-boarder');
    for (let i = 0; i < list.length; i++) {
      const b = list[i] as Moded;
      if (b.alive && b.aboard && b.wagon === w) return b;
    }
    return null;
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

  /** L or R away from a bottle (or any lob) that lands on the wagon in its lane (0: none). */
  private bottleDodge(r: RingRunner, world: World, w: Wagon): number {
    const list = world.entities;
    for (let i = 0; i < list.length; i++) {
      const b = list[i] as Lob;
      if (!b.alive || !isLobInFlight(b) || b.landX === undefined || b.landY === undefined || b.ticksLeft === undefined) continue;
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

  /** A bottle (or any lob) about to land on the wagon in its lane (too late to change lanes: swerve). */
  private bottleNow(r: RingRunner, world: World, w: Wagon): boolean {
    const list = world.entities;
    for (let i = 0; i < list.length; i++) {
      const b = list[i] as Lob;
      if (!b.alive || !isLobInFlight(b) || b.landX === undefined || b.landY === undefined || b.ticksLeft === undefined) continue;
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

/**
 * A lob in the air that lands in a lane: a bottle or a road-works cone (`ring-bottle`), a parcel
 * in flight, the lorry's cargo in flight. Read through `landX`, `landY`, `ticksLeft`.
 */
function isLobInFlight(e: Entity): boolean {
  if (e.hasTag('ring-bottle')) return true;
  if (e.type === 'ring-parcel') return (e as Lob).ticksLeft! > 0;
  if (e.type === 'ring-barrel') return (e as Lob).flying === true;
  return false;
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
