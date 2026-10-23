/**
 * The police of lap 3 (RULES, wave B; docs/design/rally.md §5; docs/api/rally.md "B.R"): 2 / 3 / 4
 * police estates (easy / normal / hard; CARS' `police` model, our own livery, `POLITIE` in our
 * lettering) join one by one `POLICE_GAP` ticks apart once the event lap is 3.
 *
 * - **The pick:** each police car takes the racer (players AND rivals) with the most fines who was
 *   not stopped yet and is not hunted by another one (a tie: the better place). A racer with no fine
 *   is never picked (a player who braked for the cameras meets fewer police).
 * - **The on-ramp:** it joins on the hard shoulder at an S-exit 180–900 m behind its racer that is
 *   at least 160 m from every player (out of sight), already at speed, blue lights on.
 * - **The chase:** far back it drives like a fast rival (rally/ai.ts `drive`: lanes, passing) at its
 *   higher top speed; within `APPROACH` m it drives its own line one lane beside the racer (left of
 *   it, or right of a racer in the left lane) and matches its speed to sit `BOX_AHEAD` m ahead — the
 *   `STOP POLITIE` display shows (the scenery). Traffic in its line slows it down.
 * - **The stop:** beside and just ahead for `BOX_TICKS` (2 s) → `pulledOver`: both glide onto the
 *   hard shoulder (a short forced stop, no contact meanwhile) and the racer stands there
 *   `HOLD_TICKS` (3 s, its hazards on) → `released`: it drives on. One police car stops one racer,
 *   once; a racer is stopped once.
 * - **Shaking it off:** speed, braking and weaving through traffic break the box (the count falls
 *   back); after `CHASE_MAX` ticks, or with its racer `LOSE_GAP` m ahead, it gives up, drives off and
 *   may come back later for the next racer on the list.
 * - **Never hurt:** bumps only (it never spins; it never chases into a wall: a stuck police car
 *   leaves).
 *
 * The police cars are a pool of bodies (`kind` 'police'), parked hidden and ghost while idle.
 * Deterministic: no randomness; nothing allocates per tick.
 */
import { splineSample } from '../../../engine/r3/spline';
import { angleDiff, wrapAngle } from '../../../engine/r3/trig';
import { emptyRallyInput, type CarSpec, type CarState, type RallyBody, type RallyEventsB, type RallyInput } from '../api';
import { drive, newDriver, pedalsTo, steerTo, type Driver } from '../ai';
import { BODY_LIGHT, RALLY_MODEL } from '../ids';
import { DT, dsOf, frontGrip, handlingOf, newPhys, stepBody, yawOf } from '../physics';
import { envelope, trackInfo } from '../track-info';
import { ahead, signLaneAt, wrapOff } from './plan';
import type { CarRules, RallyRules } from './rules';

/** Our own police estate (CARS' `police` model): faster than the racers (about 260 km/h, more grip): it must catch up. */
export const POLICE_SPEC: CarSpec = { id: 'police', team: 'POLITIE', model: RALLY_MODEL.police, mass: 1600, topSpeed: 72, accel: 8.5, grip: 1.12, fwd: true, length: 4.9, width: 1.76, wheelbase: 2.68 };
/** The police cars join this many ticks apart (from the start of the event lap 3). */
export const POLICE_GAP = 420;
/** The police's centre this far ahead of its racer's (m): "beside and just ahead". */
export const BOX_AHEAD = 3.5;
/** The box: the police within this of `BOX_AHEAD` (m) and one lane beside (m). */
export const BOX_SLACK = 3;
export const BOX_SIDE_MIN = 1.9;
export const BOX_SIDE_MAX = 5;
/** Ticks in the box before the racer is pulled over (2 s), and on the shoulder (3 s). */
export const BOX_TICKS = 120;
export const HOLD_TICKS = 180;
/** It gives up after this many ticks of chasing, or with its racer this far ahead (m). */
export const CHASE_MAX = 3600;
export const LOSE_GAP = 600;
/** Within this distance of its racer it drives its own line beside it (m). */
export const APPROACH = 22;
/** It goes back to the lanes (passing) beyond this distance behind its racer (m), or when traffic blocks its line (for `LANES_TICKS`). */
export const DROP_BACK = 40;
export const LANES_TICKS = 60;
/** The on-ramp: this far behind the racer (m), this far from every player. */
export const SPAWN_MIN = 130;
export const SPAWN_MAX = 900;
export const SPAWN_CLEAR = 160;
/** A player sees the road this far ahead of its car (the fog) and this far behind it (the chase camera) (m). */
export const SEEN_AHEAD = 430;
export const SEEN_BEHIND = 40;
/** Unseen by every player and still far from its racer, it catches up this much faster (m/s; a ghost on its lane). */
export const CATCH_GAIN = 15;
/** An on-ramp further back than this is used only when the shoulder nearer is in a player's sight (m). */
export const SPAWN_NEAR = 450;
/** A pulled-over car's glide: the most ticks it takes; the share of speed lost per tick (at least `PULL_DECEL` m/s); the side speed (m per tick). */
export const PULL_MAX = 150;
export const PULL_DECAY = 0.035;
export const PULL_DECEL = 0.3;
export const PULL_SIDE = 0.12;
/** Its pace (of its top speed and grip) while it catches up through the lanes (siren on: faster than anyone). */
export const CATCH_PACE = 1.12;
/** It joins this much faster than its racer (m/s): it arrives from the on-ramp at speed. */
export const SPAWN_GAIN = 6;
/** With traffic beside the racer on both sides it tails it this far behind (m). */
export const TAIL_GAP = 12;
/** It waits this long before it chases again after giving up (ticks). */
export const RETRY_TICKS = 600;
/** Fixer (wave B): ahead of its racer and in its line, it drives at least this much faster than the racer (m/s): never a brake check. */
export const AHEAD_PULL = 1.5;
/** Fixer (wave B): a police car ahead nearer than this sideways to its racer (m) is in the racer's line (`BOX_SIDE_MIN`: never in the box). */
export const IN_LINE = BOX_SIDE_MIN;
/** A police car that leaves hides once every player is this far from it (m). */
export const HIDE_GAP = 320;

export type PolicePhase = 'idle' | 'chase' | 'pull' | 'hold' | 'leave' | 'done';

export interface PoliceCar {
  readonly index: number;
  readonly body: RallyBody;
  readonly driver: Driver;
  readonly inp: RallyInput;
  phase: PolicePhase;
  /** The racer it is after (or stops). */
  target: CarRules | null;
  chaseT: number;
  /** Ticks in the box (falls back outside it). */
  boxT: number;
  pullT: number;
  holdT: number;
  /** Ticks before it may join (or join again). */
  waitT: number;
  leaveT: number;
  /** Its own line beside the racer (m, + = right). */
  side: number;
  /** It drives its own line (within `APPROACH` m), else the driver's lanes. */
  close: boolean;
  /** It stopped its racer (it never chases again). */
  stopped: boolean;
  /** Leaving along the shoulder after a stop (a ghost, kinematic), else driving off in the lanes. */
  shoulder: boolean;
  /** Ticks it has been nearly standing while chasing. */
  slowT: number;
  /** The racer's speed in the glide onto the shoulder (m/s). */
  pv: number;
  /** Ticks left of driving the lanes (passing traffic) before it takes its own line again. */
  lanesT: number;
}

export class PoliceForce {
  readonly cars: PoliceCar[] = [];
  /** The police of this difficulty (the rest of the pool never joins). */
  readonly count: number;
  private readonly rules: RallyRules;
  private readonly tmp = splineSample();
  /**
   * Integrator (wave B): released racers still a ghost because a body overlapped them; each turns
   * solid once nothing overlaps it (lap 3's spitsstrook traffic passes the shoulder where they stood).
   */
  private readonly unghost: CarState[] = [];
  private readonly ev = {
    pulled: { car: '', slot: -1, police: '' } as RallyEventsB['pulledOver'],
    released: { car: '', slot: -1 } as RallyEventsB['released'],
  };

  constructor(rules: RallyRules, count: number) {
    this.rules = rules;
    this.count = count;
    const runner = rules.runner;
    const track = runner.track;
    for (let i = 0; i < count; i++) {
      const body: RallyBody = {
        id: `${POLICE_SPEC.id}-${i + 1}`,
        pos: [0, 0, 0],
        yaw: 0,
        speed: 0,
        steer: 0,
        s: 0,
        side: 0,
        dist: 0,
        phys: newPhys(handlingOf(POLICE_SPEC)),
        kind: 'police',
        model: POLICE_SPEC.model,
        lights: 0,
        hidden: true,
      };
      body.phys.ghost = true;
      const p: PoliceCar = {
        index: i,
        body,
        driver: newDriver(track, 0, 0, 1, true),
        inp: emptyRallyInput(),
        phase: 'idle',
        target: null,
        chaseT: 0,
        boxT: 0,
        pullT: 0,
        holdT: 0,
        waitT: 0,
        leaveT: 0,
        side: 0,
        close: false,
        stopped: false,
        shoulder: false,
        slowT: 0,
        pv: 0,
        lanesT: 0,
      };
      this.park(p);
      this.cars.push(p);
      runner.addBody(body);
    }
  }

  /** The police on the road now (chasing, stopping, holding). */
  get active(): number {
    let n = 0;
    for (const p of this.cars) if (p.phase === 'chase' || p.phase === 'pull' || p.phase === 'hold') n++;
    return n;
  }

  /** The police car after a racer (chasing it), or null. */
  hunting(car: CarState): PoliceCar | null {
    for (const p of this.cars) if (p.phase === 'chase' && p.target?.car === car) return p;
    return null;
  }

  /** One tick of every police car. */
  step(): void {
    for (let i = this.unghost.length - 1; i >= 0; i--) {
      const c = this.unghost[i];
      if (c.finished || this.clearOf(c)) {
        if (!c.finished) c.phys.ghost = false;
        this.unghost.splice(i, 1);
      }
    }
    for (const p of this.cars) {
      p.body.phys.spin = 0;
      switch (p.phase) {
        case 'idle':
          this.idle(p);
          break;
        case 'chase':
          this.chase(p);
          break;
        case 'pull':
          this.pull(p);
          break;
        case 'hold':
          this.hold(p);
          break;
        case 'leave':
          this.leave(p);
          break;
        default:
          break;
      }
    }
  }

  // -- idle: join when its turn comes ---------------------------------------------------------

  private idle(p: PoliceCar): void {
    const rules = this.rules;
    const race = rules.runner.race;
    if (p.waitT > 0) {
      p.waitT--;
      return;
    }
    if (rules.lap < 3 || race.phase !== 'race' || rules.lap3Tick < 0 || p.stopped) return;
    if (race.raceTick < rules.lap3Tick + POLICE_GAP * p.index) return;
    const target = this.pick();
    if (!target) {
      p.waitT = 60;
      return;
    }
    if (!this.spawn(p, target)) p.waitT = 30;
  }

  /** The racer with the most fines who was not stopped and is not hunted (a tie: the better place). */
  private pick(): CarRules | null {
    let best: CarRules | null = null;
    for (const cr of this.rules.cars) {
      const c = cr.car;
      if (c.finished || cr.stopped || cr.hunted >= 0 || cr.pulled >= 0 || c.fines <= 0) continue;
      if (!best || c.fines > best.car.fines || (c.fines === best.car.fines && c.place < best.car.place)) best = cr;
    }
    return best;
  }

  /** Join from an on-ramp behind the racer, out of every player's sight. False when there is no such place now. */
  private spawn(p: PoliceCar, target: CarRules): boolean {
    const rules = this.rules;
    const plan = rules.plan;
    const L = plan.L;
    const runner = rules.runner;
    const tOff = rules.offOf(target.car.dist);
    let best = -1;
    let bd = Infinity;
    for (const e of plan.exits) {
      const d = ahead(e.off, tOff, L);
      if (d < SPAWN_MIN || d > SPAWN_MAX || d >= bd || !this.clearOfPlayers(e.off)) continue;
      best = Math.round(d);
      bd = d;
    }
    let back = best <= SPAWN_NEAR ? best : -1;
    if (back < 0) {
      // No on-ramp near: join from the shoulder 200–300 m behind (out of sight), else the far on-ramp.
      for (let d = 170; d <= 320 && back < 0; d += 50) if (this.clearOfPlayers(wrapOff(tOff - d, L))) back = d;
      if (back < 0) back = best;
      if (back < 0) return false;
    }
    const body = p.body;
    const shoulder = plan.laneX[3];
    // Not on top of another body.
    for (let k = 0; k < 6 && this.blocked(wrapOff(tOff - back, L), shoulder); k++) back += 14;
    const off = wrapOff(tOff - back, L);
    this.place(body, off, shoulder);
    body.dist = target.car.dist - back;
    body.speed = Math.max(25, Math.abs(target.car.speed) + SPAWN_GAIN);
    body.hidden = false;
    body.phys.ghost = false;
    body.lights = BODY_LIGHT.blue;
    p.phase = 'chase';
    p.target = target;
    target.hunted = p.index;
    p.chaseT = 0;
    p.boxT = 0;
    p.slowT = 0;
    p.close = false;
    p.side = shoulder;
    const d = p.driver;
    d.lane = runner.track.lanes - 1;
    d.side = shoulder;
    d.laneT = 60;
    d.blockT = 0;
    d.pullOut = 0;
    d.pace = CATCH_PACE;
    d.overtake = true;
    runner.events.emit('policeActive', { count: this.active });
    return true;
  }

  /** No player sees a lap offset: it is not within `SEEN_AHEAD` m ahead of a player car, nor `SEEN_BEHIND` m behind one. */
  private clearOfPlayers(off: number): boolean {
    const rules = this.rules;
    const L = rules.plan.L;
    for (const c of rules.runner.cars) {
      if (c.slot < 0) continue;
      const ds = dsOf(rules.offOf(c.dist), off, L);
      if (ds > -SEEN_BEHIND && ds < SEEN_AHEAD) return false;
    }
    return true;
  }

  /** Is a body (not a ghost) within 10 m of a lap offset on this side line? */
  private blocked(off: number, side: number): boolean {
    const rules = this.rules;
    const t = rules.runner.track;
    const s = t.spline.wrap(t.startS + off);
    for (const b of rules.runner.bodies) if (!b.phys.ghost && Math.abs(dsOf(s, b.s, rules.plan.L)) < 10 && Math.abs(b.side - side) < 2.6) return true;
    return false;
  }

  /**
   * Fixer (wave B): the speed of the slowest body (not a ghost) ahead of a police car in its line,
   * within 10 m plus 2 s of closing on it (Infinity when none).
   */
  private aheadCap(p: RallyBody): number {
    const bodies = this.rules.runner.bodies;
    const L = this.rules.plan.L;
    let cap = Infinity;
    for (let i = 0; i < bodies.length; i++) {
      const o = bodies[i];
      if (o === p || o.phys.ghost || Math.abs(o.side - p.side) >= 2.6) continue;
      const ds = dsOf(p.s, o.s, L);
      if (ds <= 0) continue;
      const dv = p.speed - o.speed;
      if (ds < 10 + (dv > 0 ? dv * 2 : 0) && o.speed < cap) cap = o.speed;
    }
    return cap;
  }

  // -- chase: catch up, come alongside, box the racer in ----------------------------------------

  private chase(p: PoliceCar): void {
    const rules = this.rules;
    const runner = rules.runner;
    const track = runner.track;
    const body = p.body;
    const tr = p.target!;
    const tc = tr.car;
    p.chaseT++;
    const gap = tc.dist - body.dist;
    if (tc.finished || tr.pulled >= 0 || p.chaseT > CHASE_MAX || gap > LOSE_GAP || gap < -250) {
      this.giveUp(p);
      return;
    }
    if (Math.abs(body.speed) < 2) p.slowT++;
    else p.slowT = 0;
    if (p.slowT > 180) {
      this.giveUp(p);
      return;
    }
    const inp = p.inp;
    // Unseen and far from its racer: it catches up along its lane as a ghost (no player can tell).
    if (!p.close && gap > APPROACH + 10 && this.clearOfPlayers(rules.offOf(body.dist))) {
      body.phys.ghost = true;
      const lane = signLaneAt(rules.plan, body.side);
      const line = rules.plan.laneX[lane > 2 ? 2 : lane];
      this.glide(body, Math.min(POLICE_SPEC.topSpeed, Math.max(body.speed, tc.speed + CATCH_GAIN)), toward(body.side, line, 0.05));
      p.driver.side = body.side;
      p.driver.lane = lane > 2 ? runner.track.lanes - 1 : lane;
      p.boxT = 0;
      p.slowT = 0;
      return;
    }
    if (body.phys.ghost) {
      // Seen again: solid once nothing overlaps it. Fixer (wave B): and only at a speed it can hold
      // behind the body ahead in its line (a ghost catching up fast turned solid into a car's tail).
      const cap = this.aheadCap(body);
      if (this.blocked(rules.offOf(body.dist), body.side) || cap < body.speed - 1) {
        this.glide(body, Math.max(0, Math.min(tc.speed, cap)), body.side);
        return;
      }
      body.phys.ghost = false;
    }
    if (p.lanesT > 0) p.lanesT--;
    if (!p.close && gap < APPROACH && p.lanesT === 0) {
      p.close = true;
      p.side = body.side;
    } else if (p.close && gap > DROP_BACK) this.toLanes(p, 0);
    if (!p.close) {
      drive(body, p.driver, track, runner.bodies, runner.bodies.length, inp);
    } else {
      // Its own line one lane beside the racer (the freer side; the left on a tie), `BOX_AHEAD` m ahead of
      // it. With traffic in both lines it tails the racer `TAIL_GAP` m behind and waits for a gap.
      const lx = rules.plan.laneX;
      const lane = lx[1] - lx[0];
      const leftSide = tc.side - lane;
      const rightSide = tc.side + lane;
      const fl = leftSide >= lx[0] - 0.6 ? this.lineSpeed(p, tc, leftSide, true) : -1;
      const fr = rightSide <= lx[2] + 0.6 ? this.lineSpeed(p, tc, rightSide, true) : -1;
      const best = fl >= fr ? fl : fr;
      let want: number;
      let v: number;
      // Fixer (wave B): ahead of its racer (gap < −1) it never takes the racer's line and never brakes in front of it.
      const aheadOf = gap < -1;
      if (best >= tc.speed - 1) {
        want = fl >= fr ? leftSide : rightSide;
        const err = gap + BOX_AHEAD;
        v = tc.speed + (err > 0 ? Math.min(14, err * 0.7) : Math.max(-10, err * 0.7));
      } else if (aheadOf) {
        // Both lines beside busy while it is ahead: it holds its own line at the racer's pace (a touch faster) and waits for a gap.
        want = p.side;
        v = tc.speed + AHEAD_PULL;
      } else {
        want = tc.side;
        const err = gap - TAIL_GAP;
        v = tc.speed + (err > 0 ? Math.min(10, err * 0.5) : Math.max(-12, err * 0.8));
      }
      if (aheadOf && Math.abs(body.side - tc.side) < IN_LINE && v < tc.speed + AHEAD_PULL) v = tc.speed + AHEAD_PULL;
      const ds = want - p.side;
      p.side += ds > 0.08 ? 0.08 : ds < -0.08 ? -0.08 : ds;
      // Never into the traffic ahead in its line (bumps only); stuck behind it, it drives the lanes and passes.
      const safe = this.lineSpeed(p, tc, p.side, false);
      if (safe < v) v = safe;
      if (safe < tc.speed - 3 && gap > TAIL_GAP + 4) {
        this.toLanes(p, LANES_TICKS);
        drive(body, p.driver, track, runner.bodies, runner.bodies.length, inp);
        stepBody(body, inp, track, this.tmp);
        p.boxT = Math.max(0, p.boxT - 2);
        return;
      }
      const h = body.phys.h;
      const u = body.speed;
      const aLat = frontGrip(h, u, 0.5) * 0.92;
      const env = envelope(trackInfo(track), body.s, aLat, h.brake * 0.8, h.topSpeed);
      if (env < v) v = env;
      pedalsTo(body, v > 0 ? v : 0, inp);
      inp.steer = Math.round(steerTo(body, track, p.side) * 127);
      inp.handbrake = false;
    }
    stepBody(body, inp, track, this.tmp);
    // The box: beside and just ahead.
    const dside = Math.abs(body.side - tc.side);
    const ahead2 = body.dist - tc.dist;
    const inBox = Math.abs(ahead2 - BOX_AHEAD) < BOX_SLACK && dside >= BOX_SIDE_MIN && dside <= BOX_SIDE_MAX && Math.abs(tc.speed) > 4 && tr.pulled < 0;
    p.boxT = inBox ? p.boxT + 1 : Math.max(0, p.boxT - 2);
    if (p.boxT >= BOX_TICKS) this.startPull(p);
  }

  /** Hand the wheel to the lanes driver (passing traffic) for `ticks`. */
  private toLanes(p: PoliceCar, ticks: number): void {
    const rules = this.rules;
    const body = p.body;
    p.close = false;
    p.lanesT = ticks;
    const d = p.driver;
    d.side = body.side;
    const lane = signLaneAt(rules.plan, body.side);
    d.lane = lane > 2 ? rules.runner.track.lanes - 1 : lane;
    d.laneT = 0;
  }

  /**
   * The speed its line `side` allows: the slowest body ahead in it (but its racer), from its gap (a
   * follow law like the drivers'). `box`: only the stretch up to the box beside the racer counts (is
   * that side free?); else the whole look-ahead (the speed cap). Infinity when free.
   */
  private lineSpeed(p: PoliceCar, tc: CarState, side: number, box: boolean): number {
    const rules = this.rules;
    const body = p.body;
    const bodies = rules.runner.bodies;
    const L = rules.plan.L;
    const u = Math.max(0, body.speed);
    const full = 12 + u * 1.3;
    const look = box ? Math.max(8, Math.min(full, tc.dist - body.dist + BOX_AHEAD + 6)) : full;
    let v = Infinity;
    for (let i = 0; i < bodies.length; i++) {
      const o = bodies[i];
      if (o === body || o === tc || o.phys.ghost) continue;
      const g = dsOf(body.s, o.s, L) - body.phys.h.halfLen - o.phys.h.halfLen;
      if (g < -1 || g > look) continue;
      if (Math.abs(o.side - side) >= 2 && Math.abs(o.side - body.side) >= 2) continue;
      const f = o.speed + (g - 4 - 0.35 * u) * 0.6;
      if (f < v) v = f;
    }
    return v;
  }

  private giveUp(p: PoliceCar): void {
    if (p.target) p.target.hunted = -1;
    p.target = null;
    p.phase = 'leave';
    p.shoulder = false;
    p.leaveT = 0;
    p.boxT = 0;
    const d = p.driver;
    d.side = p.body.side;
    d.lane = this.rules.runner.track.lanes - 1;
    d.pace = 0.75;
    d.overtake = false;
  }

  // -- the stop ---------------------------------------------------------------------------------

  private startPull(p: PoliceCar): void {
    const tr = p.target!;
    const tc = tr.car;
    tr.pulled = p.index;
    tr.hunted = -1;
    p.phase = 'pull';
    p.pullT = 0;
    p.pv = Math.abs(tc.speed);
    // From the next tick the racer's own driving stops (the hold); the glide moves it.
    tc.phys.hold = Math.max(tc.phys.hold, 2);
    tc.phys.ghost = true;
    p.body.phys.ghost = true;
    const e = this.ev.pulled;
    e.car = tc.id;
    e.slot = tc.slot;
    e.police = p.body.id;
    this.rules.runner.events.emit('pulledOver', e);
  }

  /** Both glide onto the hard shoulder (kinematic, no contact), the racer slowing to a stop. */
  private pull(p: PoliceCar): void {
    const rules = this.rules;
    const tc = p.target!.car;
    const shoulder = rules.plan.laneX[3];
    p.pullT++;
    let v = p.pv;
    v = Math.max(0, v - Math.max(PULL_DECEL, v * PULL_DECAY));
    p.pv = v;
    const side = toward(tc.side, shoulder, PULL_SIDE);
    this.glide(tc, v, side);
    tc.phys.hold = Math.max(tc.phys.hold, 2);
    tc.steer *= 0.8;
    // The police: on the shoulder ahead of it.
    const pb = p.body;
    const gap = pb.dist - tc.dist;
    const pv = v + Math.max(-4, Math.min(4, (9 - gap) * 0.25));
    this.glide(pb, Math.max(0, pv), toward(pb.side, shoulder, PULL_SIDE));
    if ((v < 0.3 && Math.abs(side - shoulder) < 0.2) || p.pullT >= PULL_MAX) {
      // It stands on the shoulder: 3 s, hazards on.
      this.glide(tc, 0, shoulder);
      tc.speed = 0;
      tc.phys.hold = HOLD_TICKS;
      tc.lights = (tc.lights ?? 0) | BODY_LIGHT.hazard;
      pb.speed = 0;
      p.phase = 'hold';
      p.holdT = 0;
    }
  }

  private hold(p: PoliceCar): void {
    const tr = p.target!;
    const tc = tr.car;
    p.holdT++;
    // The police car creeps onto the shoulder in front of it (a ghost: nothing to hit).
    const pb = p.body;
    const shoulder = this.rules.plan.laneX[3];
    const gap = pb.dist - tc.dist;
    const v = gap < 8.5 || Math.abs(pb.side - shoulder) > 0.2 ? Math.min(4, Math.max(1.5, (9 - gap) * 0.8)) : 0;
    this.glide(pb, v, toward(pb.side, shoulder, 0.05));
    // Standing on the shoulder: both turn solid once nothing overlaps them, so the spitsstrook's
    // traffic of lap 3 sees them (brakes or changes lane) instead of driving through them.
    if (!tc.finished && tc.phys.ghost && this.clearOf(tc)) tc.phys.ghost = false;
    if (v === 0 && pb.phys.ghost && this.clearOf(pb)) pb.phys.ghost = false;
    if (p.holdT < HOLD_TICKS) return;
    // Released: it drives on (from the shoulder); still a ghost while a body overlaps it.
    tc.phys.hold = 0;
    pb.phys.ghost = true;
    if (!tc.finished) {
      if (this.clearOf(tc)) tc.phys.ghost = false;
      else if (!this.unghost.includes(tc)) this.unghost.push(tc);
    }
    tc.lights = (tc.lights ?? 0) & ~BODY_LIGHT.hazard;
    tr.pulled = -1;
    tr.stopped = true;
    const runner = this.rules.runner;
    const i = runner.cars.indexOf(tc);
    const d = runner.drivers[i];
    if (d) {
      d.lane = runner.track.lanes - 1;
      d.side = tc.side;
      d.laneT = 0;
      d.blockT = 0;
    }
    const e = this.ev.released;
    e.car = tc.id;
    e.slot = tc.slot;
    runner.events.emit('released', e);
    p.stopped = true;
    p.target = null;
    p.phase = 'leave';
    p.shoulder = true;
    p.leaveT = 0;
  }

  // -- leaving ----------------------------------------------------------------------------------

  private leave(p: PoliceCar): void {
    const rules = this.rules;
    const runner = rules.runner;
    const body = p.body;
    p.leaveT++;
    if (p.shoulder) {
      // A short wait, then along the shoulder (a ghost: the released racer passes it).
      const v = p.leaveT < 90 ? 0 : Math.min(28, body.speed + 3 * DT);
      this.glide(body, v, rules.plan.laneX[3]);
    } else {
      drive(body, p.driver, runner.track, runner.bodies, runner.bodies.length, p.inp);
      stepBody(body, p.inp, runner.track, this.tmp);
    }
    // Out of every player's sight: parked (hidden).
    let near = false;
    for (const c of runner.cars) if (c.slot >= 0 && Math.abs(dsOf(c.s, body.s, rules.plan.L)) < HIDE_GAP) near = true;
    if (!near || p.leaveT > 1800) {
      this.park(p);
      p.phase = p.stopped ? 'done' : 'idle';
      p.waitT = p.stopped ? 0 : RETRY_TICKS;
    }
  }

  // -- helpers ----------------------------------------------------------------------------------

  /** No solid body overlaps `b` (with a small margin). */
  private clearOf(b: RallyBody): boolean {
    const L = this.rules.plan.L;
    const h = b.phys.h;
    for (const o of this.rules.runner.bodies) {
      if (o === b || o.phys.ghost || o.hidden) continue;
      if (Math.abs(dsOf(b.s, o.s, L)) < h.halfLen + o.phys.h.halfLen + 0.5 && Math.abs(o.side - b.side) < h.halfWid + o.phys.h.halfWid + 0.3) return false;
    }
    return true;
  }

  /** Park a police car: hidden, no contact, at the start line on the shoulder. */
  private park(p: PoliceCar): void {
    const body = p.body;
    this.place(body, 0, this.rules.plan.laneX[3] + 1.2);
    body.dist = 0;
    body.speed = 0;
    body.hidden = true;
    body.phys.ghost = true;
    body.lights = 0;
    p.close = false;
    p.boxT = 0;
    p.target = null;
  }

  /** Put a body at a lap offset and side, facing along the road. */
  private place(b: RallyBody, off: number, side: number): void {
    const t = this.rules.runner.track;
    const s = t.spline.wrap(t.startS + off);
    const sp = t.spline.sample(s, this.tmp);
    b.pos[0] = sp.p[0] + sp.r[0] * side;
    b.pos[1] = sp.p[1];
    b.pos[2] = sp.p[2] + sp.r[2] * side;
    b.yaw = yawOf(sp.t[0], sp.t[2]);
    b.s = s;
    b.side = side;
    b.steer = 0;
    b.phys.slip = 0;
    b.phys.yawRate = 0;
  }

  /** Move a body along the road at speed v (m/s) on a side line (kinematic: the pull-over, the leave). */
  private glide(b: RallyBody, v: number, side: number): void {
    const t = this.rules.runner.track;
    const step = v * DT;
    const s = t.spline.wrap(b.s + step);
    const sp = t.spline.sample(s, this.tmp);
    b.pos[0] = sp.p[0] + sp.r[0] * side;
    b.pos[1] = sp.p[1];
    b.pos[2] = sp.p[2] + sp.r[2] * side;
    const yaw = yawOf(sp.t[0], sp.t[2]);
    b.yaw = wrapAngle(b.yaw + angleDiff(b.yaw, yaw) * 0.2);
    b.s = s;
    b.side = side;
    b.dist += step;
    b.speed = v;
    b.phys.slip = 0;
    b.phys.yawRate = 0;
  }
}

function toward(a: number, b: number, rate: number): number {
  const d = b - a;
  return a + (d > rate ? rate : d < -rate ? -rate : d);
}
