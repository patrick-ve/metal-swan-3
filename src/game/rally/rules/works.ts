/**
 * The road works of lap 2 (RULES, wave B; docs/design/rally.md §4 "lap 2", §5; docs/api/rally.md
 * "B.R"): TRACK's three zones (`A10Track.roadworks`: the closed lanes and the 70 limit); the seed
 * picks 2 or 3 of them (RING WEST always: it shares the average-speed zone). On the event lap 2 a
 * zone stands (when no player is near it: no pop-in) and on lap 3 it is cleared again.
 *
 * A standing zone is, for the sim, a row of standing bodies (`kind` 'prop', no model: the drawing is
 * the rules' scenery, content/rally/props/roadworks.ts): the arrow-board truck at its start in the
 * first closed lane and a barrier every `BARRIER_GAP` m in every closed lane. They are heavy: a car
 * that drives into them loses its speed. The drivers see them like any standing car (they pass in a
 * free lane), and the rules keep the AI drivers (the rivals, the finished cars, the debug
 * autopilot) out of the closed lanes from `GUIDE_AHEAD` m before a zone. The props are a pool: added
 * once, parked (`hidden`, `phys.ghost`) while their zone is down; a prop that would overlap a body
 * when its zone goes up stays a ghost until that body is clear.
 */
import { splineSample } from '../../../engine/r3/spline';
import type { Rng } from '../../../engine/rng';
import type { CarSpec, RallyBody } from '../api';
import { dsOf, handlingOf, newPhys, recoverBody, yawOf } from '../physics';
import { ahead, inRange, wrapOff, type WorksPlan } from './plan';
import type { RallyRules } from './rules';

/** The arrow-board truck and a barrier (standing props; heavy). */
export const WORKS_TRUCK: CarSpec = { id: 'rw-truck', team: 'WERK', model: '', mass: 9000, topSpeed: 25, accel: 1, grip: 1, length: 7.4, width: 2.3, wheelbase: 4.2 };
export const WORKS_BARRIER: CarSpec = { id: 'rw-barrier', team: 'WERK', model: '', mass: 20000, topSpeed: 1, accel: 1, grip: 1, length: 2, width: 2, wheelbase: 1 };
/** A cone of the taper (a weighted base: a car that hits one barely slows; the drivers steer round them). */
export const WORKS_CONE: CarSpec = { id: 'rw-cone', team: 'WERK', model: '', mass: 400, topSpeed: 1, accel: 1, grip: 1, length: 0.6, width: 0.6, wheelbase: 0.4 };
/** The taper before a zone: its length (m) and a cone body every `TAPER_STEP` m on it (the drawn cones stand between them too). */
export const TAPER_LEN = 100;
export const TAPER_STEP = 10;
/** A car that stands this long right behind the works (ticks, 2 s) is put in a free lane (spec §2 "Recovery"). */
export const STUCK_TICKS = 120;
/** Below this speed (m/s, about 9 km/h: creeping against a cone counts) a car stands for the safety net (integrator, wave B). */
export const STUCK_SPEED = 2.5;
/** A barrier every this many metres in a closed lane (from `BARRIER_FROM` m into the zone). */
export const BARRIER_GAP = 30;
export const BARRIER_FROM = 26;
/** The truck stands this far into the zone (m). */
export const TRUCK_AT = 4;
/** The AI leaves a closed lane from this far before its zone (m). */
export const GUIDE_AHEAD = 420;
/** Fixer (wave B): an AI driver keeps off the hard shoulder from this far before a gantry with a red X over it (m). */
export const SHOULDER_X_AHEAD = 300;

/** One zone and its props. */
export interface WorksZone {
  readonly plan: WorksPlan;
  /** The seed picked it (2–3 of the zones stand on lap 2). */
  readonly enabled: boolean;
  /** Its props stand (lap 2). */
  active: boolean;
  /** Index 0 the truck, then the barriers. */
  readonly props: RallyBody[];
  /** Per prop: its lap offset, lane and side (where it stands), its spec. */
  readonly at: readonly { readonly off: number; readonly lane: number; readonly side: number; readonly spec: CarSpec }[];
  /** Per prop: x, y, z, yaw where it stands (reset every tick: a push never moves it). */
  readonly home: Float64Array;
}

/** The side of the taper's cone `o` m from a zone's start (−TAPER_LEN … 0): from the far edge to the cones' line. */
export function taperSide(w: WorksPlan, o: number): number {
  const k = Math.max(0, Math.min(1, (o + TAPER_LEN) / TAPER_LEN));
  return w.edge + (w.cones - w.edge) * k;
}

export class RoadWorks {
  readonly zones: WorksZone[] = [];
  private readonly rules: RallyRules;
  /** Per race car (by `rules.cars` index): ticks it stood right behind the works. */
  private stuck = new Int32Array(16);
  private readonly tmp = splineSample();
  private readonly recoverEv = { car: '', slot: -1 };

  constructor(rules: RallyRules, rng: Rng) {
    this.rules = rules;
    const runner = rules.runner;
    const plan = rules.plan;
    const track = runner.track;
    const n = plan.works.length;
    // 2 or 3 zones (spec §4): the seed may leave one out (never the first: RING WEST, the average-speed zone).
    let skip = -1;
    if (n >= 3 && rng.chance(0.5)) skip = rng.int(1, n - 1);
    const tmp = splineSample();
    for (const w of plan.works) {
      const at: { off: number; lane: number; side: number; spec: CarSpec }[] = [];
      const firstLane = w.closed.find((l) => l < track.lanes) ?? w.closed[0] ?? 0;
      const lx = (lane: number): number => plan.laneX[Math.min(3, lane)];
      at.push({ off: wrapOff(w.off0 + TRUCK_AT, plan.L), lane: firstLane, side: lx(firstLane), spec: WORKS_TRUCK });
      for (const lane of w.closed) for (let o = BARRIER_FROM; o < w.len - 8; o += BARRIER_GAP) at.push({ off: wrapOff(w.off0 + o, plan.L), lane, side: lx(lane), spec: WORKS_BARRIER });
      // The taper: cones from the far edge of the closed lanes to the cones' line (the drivers leave the lane before it).
      for (let o = -TAPER_LEN; o <= 0; o += TAPER_STEP) at.push({ off: wrapOff(w.off0 + o, plan.L), lane: firstLane, side: taperSide(w, o), spec: WORKS_CONE });
      const props: RallyBody[] = [];
      const home = new Float64Array(at.length * 4);
      at.forEach((a, k) => {
        const spec = a.spec;
        const s = track.spline.wrap(track.startS + a.off);
        const sp = track.spline.sample(s, tmp);
        const side = a.side;
        const b: RallyBody = {
          id: `${spec.id}-${w.index}-${k}`,
          pos: [sp.p[0] + sp.r[0] * side, sp.p[1], sp.p[2] + sp.r[2] * side],
          yaw: yawOf(sp.t[0], sp.t[2]),
          speed: 0,
          steer: 0,
          s,
          side,
          dist: a.off,
          phys: newPhys(handlingOf(spec)),
          kind: 'prop',
          lights: 0,
          hidden: true,
        };
        b.phys.ghost = true;
        home[k * 4] = b.pos[0];
        home[k * 4 + 1] = b.pos[1];
        home[k * 4 + 2] = b.pos[2];
        home[k * 4 + 3] = b.yaw;
        props.push(b);
        runner.addBody(b);
      });
      this.zones.push({ plan: w, enabled: w.index !== skip, active: false, props, at, home });
    }
  }

  /** The active zones as bits (the signs director's key). */
  mask(): number {
    let m = 0;
    for (let i = 0; i < this.zones.length; i++) if (this.zones[i].active) m |= 1 << i;
    return m;
  }

  /** One tick: zones up on lap 2 and down after it (only while no player is near), the props, the AI. */
  step(): void {
    const rules = this.rules;
    const runner = rules.runner;
    for (const z of this.zones) {
      const want = z.enabled && rules.lap === 2;
      if (want !== z.active && rules.clearOfPlayers(z.plan.off0, z.plan.len)) {
        z.active = want;
        for (const p of z.props) {
          p.hidden = !want;
          p.phys.ghost = true;
        }
        if (want) runner.events.emit('roadworksAhead', { section: z.plan.section, lanes: z.plan.closed });
      }
      if (z.active) this.holdProps(z);
    }
    this.guide();
    this.unstick();
  }

  /**
   * The safety net (spec §2 "Recovery": a car that stands still for a while is put back): a race car
   * that stands `STUCK_TICKS` right behind a standing prop of the works (the truck, a barrier, a cone)
   * is put on the nearest free open lane, standing, with the recovery's blink.
   */
  private unstick(): void {
    const rules = this.rules;
    const runner = rules.runner;
    const cars = rules.cars;
    if (this.stuck.length < cars.length) this.stuck = new Int32Array(cars.length + 8);
    if (runner.race.phase !== 'race') return;
    const L = rules.plan.L;
    for (let i = 0; i < cars.length; i++) {
      const cr = cars[i];
      const car = cr.car;
      if (car.finished || cr.pulled >= 0 || Math.abs(car.speed) > STUCK_SPEED || car.phys.hold > 0) {
        this.stuck[i] = 0;
        continue;
      }
      let behind = false;
      for (const z of this.zones) {
        if (!z.active) continue;
        for (const p of z.props) {
          if (p.phys.ghost) continue;
          const ds = dsOf(car.s, p.s, L);
          if (ds > 0 && ds < 16 && Math.abs(p.side - car.side) < 2.8) behind = true;
        }
      }
      this.stuck[i] = behind ? this.stuck[i] + 1 : 0;
      if (this.stuck[i] < STUCK_TICKS) continue;
      this.stuck[i] = 0;
      const off = rules.offOf(car.dist);
      const lane = this.freeLane(car, off);
      const side = rules.plan.laneX[lane];
      recoverBody(car, runner.track, side, this.tmp);
      const d = runner.drivers[runner.cars.indexOf(car)];
      if (d) {
        d.lane = lane;
        d.side = side;
        d.blockT = 0;
        d.pullOut = 0;
      }
      const e = this.recoverEv;
      e.car = car.id;
      e.slot = car.slot;
      runner.events.emit('recover', e);
    }
  }

  /** The nearest open lane at a car with no body within 12 m (else the nearest open lane). */
  private freeLane(car: RallyBody, off: number): number {
    const runner = this.rules.runner;
    const L = this.rules.plan.L;
    const lanes = runner.track.lanes;
    let best = -1;
    let bd = Infinity;
    for (let l = 0; l < lanes; l++) {
      if (this.closedAt(off, l, 20)) continue;
      const side = this.rules.plan.laneX[l];
      let free = true;
      for (const b of runner.bodies) if (b !== car && !b.phys.ghost && Math.abs(dsOf(car.s, b.s, L)) < 12 && Math.abs(b.side - side) < 2.3) free = false;
      const d = Math.abs(side - car.side) + (free ? 0 : 100);
      if (d < bd) {
        bd = d;
        best = l;
      }
    }
    return best < 0 ? this.openLane(off, 0, 0) : best;
  }

  /** The props stand where they stand; a ghost one turns solid once no body overlaps it. */
  private holdProps(z: WorksZone): void {
    const bodies = this.rules.runner.bodies;
    const L = this.rules.plan.L;
    for (let k = 0; k < z.props.length; k++) {
      const p = z.props[k];
      p.pos[0] = z.home[k * 4];
      p.pos[1] = z.home[k * 4 + 1];
      p.pos[2] = z.home[k * 4 + 2];
      p.yaw = z.home[k * 4 + 3];
      p.speed = 0;
      p.phys.slip = 0;
      p.phys.yawRate = 0;
      p.phys.spin = 0;
      if (!p.phys.ghost) continue;
      let clear = true;
      for (let i = 0; i < bodies.length && clear; i++) {
        const b = bodies[i];
        if (b === p || b.phys.ghost || b.kind === 'prop') continue;
        if (Math.abs(dsOf(p.s, b.s, L)) < p.phys.h.halfLen + b.phys.h.halfLen + 2 && Math.abs(p.side - b.side) < p.phys.h.halfWid + b.phys.h.halfWid + 0.6) clear = false;
      }
      if (clear) p.phys.ghost = false;
    }
  }

  /** The AI drivers (rivals, finished cars, the debug autopilot) leave a closed lane before its zone. */
  private guide(): void {
    const runner = this.rules.runner;
    const cars = runner.cars;
    let any = false;
    for (const z of this.zones) if (z.active) any = true;
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      if (car.slot >= 0 && !car.finished && !runner.autopilot[car.slot === 1 ? 1 : 0]) continue;
      const d = runner.drivers[i];
      if (!d) continue;
      const off = this.rules.offOf(car.dist);
      // Fixer (wave B): the lanes it may use (the racing line and passing stay inside them).
      this.keepLanes(off, d);
      if (!any) continue;
      const lane = this.openLane(off, d.lane, GUIDE_AHEAD);
      if (lane !== d.lane) d.lane = lane;
    }
  }

  /**
   * Fixer (wave B): write the lanes a driver may use at lap offset `off` into `d.keepLo` / `d.keepHi`:
   * the open lanes of the works closed within `GUIDE_AHEAD` m (its racing line never runs along a
   * taper), and the hard shoulder (lane `track.lanes`) only with no red X over it within `SHOULDER_X_AHEAD` m.
   */
  keepLanes(off: number, d: { keepLo?: number; keepHi?: number }): void {
    const lanes = this.rules.runner.track.lanes;
    let lo = -1;
    let hi = -1;
    for (let l = 0; l < lanes; l++) {
      if (this.closedAt(off, l, GUIDE_AHEAD)) continue;
      if (lo < 0) lo = l;
      hi = l;
    }
    if (lo < 0) {
      lo = 0;
      hi = lanes - 1;
    }
    if (hi === lanes - 1 && !this.rules.shoulderX(off, SHOULDER_X_AHEAD)) hi = lanes;
    d.keepLo = lo;
    d.keepHi = hi;
  }

  /** Is lane `lane` closed at lap offset `off` or within `look` m after it (by a zone that stands)? */
  closedAt(off: number, lane: number, look = 0): boolean {
    const L = this.rules.plan.L;
    for (const z of this.zones) {
      if (!z.active || !z.plan.closed.includes(lane)) continue;
      if (inRange(off, z.plan.off0, z.plan.len, L) || ahead(off, z.plan.off0, L) <= look) return true;
    }
    return false;
  }

  /** The lane a driver in `lane` should keep at `off` (the nearest open one when it is closed within `look` m). */
  openLane(off: number, lane: number, look = GUIDE_AHEAD): number {
    if (!this.closedAt(off, lane, look)) return lane;
    const lanes = this.rules.runner.track.lanes;
    let best = lane;
    let bd = Infinity;
    for (let l = 0; l < lanes; l++) {
      if (this.closedAt(off, l, look)) continue;
      const d = Math.abs(l - lane);
      if (d < bd) {
        bd = d;
        best = l;
      }
    }
    return best;
  }
}
