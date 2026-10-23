/**
 * The A10's rules (RULES, wave B; docs/design/rally.md §4, §5, §9, §10; docs/api/rally.md "B.R"): one
 * `RallyRules` per race, installed into the runner by the lazy content (content/rally/rules/index.ts
 * → registry.ts `defineRallySystem`). Every tick, after the cars moved and before the contacts:
 *
 * 1. **The event director** (spec §4): the event lap is the leading PLAYER's lap (the time of day's
 *    clock, daylight.ts `raceProgress`): lap 1 the speed cameras and the matrix signs; lap 2 the road
 *    works (2–3 zones, the seed picks); lap 3 the spitsstrook opens (green arrows) and the police
 *    join (2 / 3 / 4 by difficulty). A zone switches only while no player is near it (no pop-in).
 * 2. **The signs director**: every gantry's signs per lane from the event state — the start
 *    countdown (then GO, then dark: the finish line), the limits (100; 80 in the tunnel sections), around active road works the merge
 *    arrows and 80 (the arrow gantry), the red X over the closed lanes and 70 (the red-X gantry and
 *    the gantries inside), 'end' after; the shoulder's red X over a shut spitsstrook (laps 1–2) and
 *    the green arrow on lap 3. `posted[g]` is the limit a car takes from gantry g.
 * 3. **The road works** (works.ts): the props (the arrow-board truck, barriers) as standing bodies,
 *    the AI kept out of the closed lanes.
 * 4. **The police** (police.ts).
 * 5. **Enforcement** for every race car (players and rivals): a gantry passed under a red X → `redx`,
 *    `flash`, `fine`; a speed camera passed above the last posted limit (+ `CAMERA_TOLERANCE`) →
 *    `flash`, `fine`; the average-speed zone's average above the limit at its end → `flash`, `fine`.
 *    A jump of more than `MAX_STEP` m in one tick (a debug teleport) checks nothing.
 * 6. **Race events**: `overtake` (a player passes a rival, once per rival per lap), `bestLap`,
 *    `tunnelIn` / `tunnelOut`, `roadworksAhead`, `spitsstrookOpen`, `policeActive`.
 *
 * Pure and deterministic (spec §12.4): + − × ÷, sqrt, floor/round/abs/min/max, the r3 tables; the
 * seed's choices from `runner.rng.fork('rules')`. No allocation per tick (event payloads are reused;
 * the per-car tables are rebuilt only when `runner.roster` changes).
 */
import type { CarState, RallyBody, RallyEventsB } from '../api';
import { raceProgress } from '../daylight';
import { BODY_LIGHT } from '../ids';
import { dsOf } from '../physics';
import type { RallyRunner } from '../runner';
import { fineEuros } from '../score';
import { countdownSign, GO_SIGN_TICKS, SIGN_LANES, SIGN_SHOULDER, signLimit, type SignState } from '../signs';
import { ahead, inRange, rulesPlan, sectionAt, signLaneAt, wrapOff, type CameraPlan, type RulesPlan, type WorksPlan } from './plan';
import { PoliceForce } from './police';
import { RoadWorks } from './works';

/** A camera flashes a car this far above the limit (km/h; the usual correction). */
export const CAMERA_TOLERANCE = 3;
/** A car that moved more than this in one tick was put there (a debug teleport): nothing is checked (m). */
export const MAX_STEP = 20;
/** The HUD warns of a speed camera this far ahead (m). */
export const FLITSER_AHEAD = 250;
/** Fixer (wave B): a fixed camera within this distance before standing road works (or in them) enforces the works' step-down limit (m). */
export const WORKS_CAMERA_LEAD = 300;
/** Fixer (wave B): the red X warning also counts a lane this close to the car's side (m). */
export const REDX_EDGE = 1;
/** A road-works zone switches on or off only while no player car is within this distance before it (m) … */
export const SWITCH_CLEAR_BEFORE = 520;
/** … or within it or this distance after it. */
export const SWITCH_CLEAR_AFTER = 60;
/** The police per difficulty (spec §5). */
export const POLICE_BY_DIFFICULTY = { easy: 2, normal: 3, hard: 4 } as const;
/** A join avoids these stretches (TF tunnel 1, cutting 2: the tubes and their ramps). */
export const JOIN_AVOID = 1 | 2;

/** The rules' view of one race car. */
export interface CarRules {
  readonly car: CarState;
  /** Its `dist` last tick (NaN: not seen yet). */
  prev: number;
  /** The limit of the last sign it passed (km/h; 0 = none yet). */
  posted: number;
  /** Fixer (wave B): the base limit of the last sign gantry it passed (100, 80 in a tunnel section; 0 = none yet). */
  postedBase: number;
  /** The average-speed zone: the race tick and dist at its entry (−1 = not in it) and the limit then. */
  zoneT0: number;
  zoneD0: number;
  zoneLimit: number;
  /** The tunnel it is in (−1 = none). */
  tunnel: number;
  /** It was pulled over once (the police never pick it again). */
  stopped: boolean;
  /** A police car is after it (the index into `police.cars`; −1 = none). */
  hunted: number;
  /** It is being pulled over or stands on the shoulder (the police's index; −1 = no). */
  pulled: number;
  /** Its best full lap so far (ticks; −1 = none). */
  best: number;
}

/** The rules of a race (one per runner). */
export class RallyRules {
  readonly runner: RallyRunner;
  readonly plan: RulesPlan;
  /** The event lap (1..3): the leading player's lap. */
  lap = 1;
  /** The race tick lap 3 began (−1 = not yet). */
  lap3Tick = -1;
  /** The spitsstrook is open (lap 3). */
  spitsOpen = false;
  /** The limit each gantry posts now (km/h; 0 = none: an exit sign). */
  readonly posted: number[];
  readonly works: RoadWorks;
  readonly police: PoliceForce;
  /** The rules of every race car (in `runner.cars` order; rebuilt when the roster changes). */
  cars: CarRules[] = [];
  private readonly byCar = new Map<CarState, CarRules>();
  private roster = -1;
  private signKey = -1;
  /** The section of the average-speed zone (the flash's `where`). */
  private readonly zoneWhere: string;
  /** `zoneAverage`'s answer (reused: the HUD asks every frame). */
  private readonly zoneOut = { avg: 0, limit: 0 };
  /** Overtakes: per player car index (into `cars`) × car index: the other was ahead last tick; the lap it was last counted. */
  private ahead: Uint8Array = new Uint8Array(0);
  private counted: Int16Array = new Int16Array(0);
  private readonly ev = {
    flash: { car: '', slot: -1, speed: 0, limit: 0, where: '', kind: 'camera' } as RallyEventsB['flash'],
    fine: { car: '', slot: -1, kind: 'camera', euros: 0 } as RallyEventsB['fine'],
    redx: { car: '', slot: -1, gantry: 0, lane: 0 } as RallyEventsB['redx'],
    overtake: { car: '', slot: -1, other: '' } as RallyEventsB['overtake'],
    tunnel: { car: '', slot: -1, name: '' } as RallyEventsB['tunnelIn'],
    best: { car: '', slot: -1, ticks: 0 } as RallyEventsB['bestLap'],
  };

  constructor(runner: RallyRunner) {
    this.runner = runner;
    this.plan = rulesPlan(runner.track);
    this.posted = this.plan.gantries.map((g) => (g.signs ? g.base : 0));
    this.zoneWhere = this.plan.zone ? sectionAt(this.plan, this.plan.zone.off0) : '';
    const rng = runner.rng.fork('rules');
    this.works = new RoadWorks(this, rng);
    this.police = new PoliceForce(this, POLICE_BY_DIFFICULTY[runner.difficulty] ?? 3);
    this.syncCars();
    runner.events.on('lap', (e) => this.onLap(e.car, e.ticks));
  }

  /** One tick (the runner's system): the director, the signs, the works, the police, enforcement, events. */
  step(): void {
    const r = this.runner;
    if (r.roster !== this.roster) this.syncCars();
    this.direct();
    this.signsStep();
    this.works.step();
    this.police.step();
    if (r.race.phase === 'race') {
      for (const cr of this.cars) this.enforce(cr);
      this.overtakes();
    } else for (const cr of this.cars) cr.prev = cr.car.dist;
  }

  /** The rules of a race car (null for a body that is not one). */
  of(car: RallyBody): CarRules | null {
    return this.byCar.get(car as CarState) ?? null;
  }

  /** The lap offset (m past the start line within its lap) of a dist. */
  offOf(dist: number): number {
    return wrapOff(dist, this.plan.L);
  }

  // -- the event director ---------------------------------------------------------------------

  private direct(): void {
    const r = this.runner;
    const race = r.race;
    const p = raceProgress(race, r.track.length);
    const lap = Math.max(r.startLap, Math.min(r.laps, 1 + Math.floor(p)));
    if (lap !== this.lap) this.lap = lap;
    if (lap >= 3 && race.phase === 'race' && this.lap3Tick < 0) this.lap3Tick = race.raceTick;
    if (lap >= 3 && !this.spitsOpen && race.phase === 'race' && this.plan.spits.length > 0) {
      this.spitsOpen = true;
      r.events.emit('spitsstrookOpen', { lap });
    }
  }

  /** Is no player car near a stretch (`off0` .. `off0 + len`, with the switch margins)? */
  clearOfPlayers(off0: number, len: number): boolean {
    const L = this.plan.L;
    const from = wrapOff(off0 - SWITCH_CLEAR_BEFORE, L);
    const span = len + SWITCH_CLEAR_BEFORE + SWITCH_CLEAR_AFTER;
    for (const c of this.runner.cars) if (c.slot >= 0 && inRange(this.offOf(c.dist), from, span, L)) return false;
    return true;
  }

  // -- the signs ------------------------------------------------------------------------------

  /** The countdown state of the start gantry: 0..3 the count, 4 'go', 5 over. */
  private countState(): number {
    const race = this.runner.race;
    if (race.phase === 'grid') {
      const s = countdownSign(this.runner.countdown, -1);
      return s === 'count-3' ? 0 : s === 'count-2' ? 1 : s === 'count-1' ? 2 : 3;
    }
    return race.raceTick >= 0 && race.raceTick < GO_SIGN_TICKS ? 4 : 5;
  }

  private signsStep(): void {
    const cs = this.countState();
    const key = this.lap + 4 * this.works.mask() + 64 * cs;
    if (key === this.signKey) return;
    this.signKey = key;
    this.setSigns(cs);
  }

  /** Every gantry's signs from the event state (only when that state changed). */
  private setSigns(cs: number): void {
    const t = this.runner.signs;
    const plan = this.plan;
    const lap3 = this.lap >= 3;
    for (let g = 0; g < plan.gantries.length; g++) {
      const gp = plan.gantries[g];
      if (!gp.signs) {
        t.setGantry(g, 'blank');
        continue;
      }
      const base = limitSign(gp.base);
      for (let l = 0; l < 3; l++) t.setSign(g, l, base);
      t.setSign(g, SIGN_SHOULDER, gp.spits ? (lap3 ? 'arrow-down' : 'x') : 'blank');
    }
    // Around the active road works: 'end' after, the merge arrows and 80 before, the red X and 70 at and in them.
    const act = this.works.zones;
    for (const z of act) if (z.active && z.plan.end >= 0 && plan.gantries[z.plan.end].signs) t.setGantry(z.plan.end, 'end', 3);
    for (const z of act) if (z.active && z.plan.arrow >= 0) this.arrowGantry(z.plan);
    for (const z of act) {
      if (!z.active) continue;
      if (z.plan.x >= 0) this.xGantry(z.plan, z.plan.x);
      for (const g of z.plan.inside) this.xGantry(z.plan, g);
    }
    // The start gantry: the countdown, then GO (green arrows), then dark (the finish line; signs.ts `countdownSign`).
    const sg = plan.start;
    if (sg >= 0) {
      const st: SignState = cs === 0 ? 'count-3' : cs === 1 ? 'count-2' : cs === 2 ? 'count-1' : cs === 3 || cs === 4 ? 'go' : 'blank';
      t.setGantry(sg, st, 3);
      t.setSign(sg, SIGN_SHOULDER, 'blank');
    }
    // The posted limits (what a car takes from a gantry it passes).
    for (let g = 0; g < plan.gantries.length; g++) {
      const gp = plan.gantries[g];
      if (!gp.signs) {
        this.posted[g] = 0;
        continue;
      }
      let lim = 0;
      for (let l = 0; l < 3; l++) lim = Math.max(lim, signLimit(t.sign(g, l)));
      this.posted[g] = lim > 0 ? lim : gp.base;
    }
  }

  private arrowGantry(w: WorksPlan): void {
    const t = this.runner.signs;
    const g = w.arrow;
    const lim = limitSign(Math.min(this.plan.gantries[g].base, 80));
    for (let l = 0; l < 3; l++) {
      if (w.closed.includes(l)) t.setSign(g, l, w.open < l ? 'merge-left' : 'merge-right');
      else t.setSign(g, l, lim);
    }
  }

  private xGantry(w: WorksPlan, g: number): void {
    const t = this.runner.signs;
    const lim = limitSign(w.limit);
    for (let l = 0; l < 3; l++) t.setSign(g, l, w.closed.includes(l) ? 'x' : lim);
    if (w.closed.includes(SIGN_SHOULDER)) t.setSign(g, SIGN_SHOULDER, 'x');
  }

  // -- the race cars --------------------------------------------------------------------------

  private syncCars(): void {
    const r = this.runner;
    this.roster = r.roster;
    const next: CarRules[] = [];
    for (const car of r.cars) {
      let cr = this.byCar.get(car);
      if (!cr) {
        cr = { car, prev: Number.NaN, posted: 0, postedBase: 0, zoneT0: -1, zoneD0: 0, zoneLimit: 0, tunnel: -1, stopped: false, hunted: -1, pulled: -1, best: -1 };
        this.byCar.set(car, cr);
      }
      next.push(cr);
    }
    for (const [car] of this.byCar) if (!r.cars.includes(car)) this.byCar.delete(car);
    this.cars = next;
    // The overtake tables: who is ahead of whom now (no event for a join).
    const n = next.length;
    this.ahead = new Uint8Array(n * n);
    this.counted = new Int16Array(n * n).fill(-1);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) this.ahead[i * n + j] = next[j].car.dist > next[i].car.dist ? 1 : 0;
  }

  /** One car's checks for this tick (the anchors it passed since the last tick). */
  private enforce(cr: CarRules): void {
    const car = cr.car;
    const d0 = cr.prev;
    const d1 = car.dist;
    cr.prev = d1;
    if (car.finished || cr.pulled >= 0) return;
    const plan = this.plan;
    const L = plan.L;
    // Tunnels (the radio's static): by where it is now.
    const o1 = wrapOff(d1, L);
    let tun = -1;
    for (let i = 0; i < plan.tunnels.length; i++) if (inRange(o1, plan.tunnels[i].off0, plan.tunnels[i].len, L)) tun = i;
    if (tun !== cr.tunnel) {
      const e = this.ev.tunnel;
      e.car = car.id;
      e.slot = car.slot;
      if (cr.tunnel >= 0) {
        e.name = plan.tunnels[cr.tunnel].name;
        this.runner.events.emit('tunnelOut', e);
      }
      cr.tunnel = tun;
      if (tun >= 0) {
        e.name = plan.tunnels[tun].name;
        this.runner.events.emit('tunnelIn', e);
      }
    }
    if (!(d1 > d0) || d1 - d0 > MAX_STEP) return;
    const o0 = wrapOff(d0, L);
    const span = d1 - d0;
    // The gantries: a red X over its lane; the limit it posts.
    for (let g = 0; g < plan.gantries.length; g++) {
      const gp = plan.gantries[g];
      if (!gp.signs || !crossed(o0, span, gp.off, L)) continue;
      const lane = signLaneAt(plan, car.side);
      if (this.runner.signs.sign(g, lane) === 'x') this.redX(cr, g, lane);
      if (this.posted[g] > 0) {
        cr.posted = this.posted[g];
        cr.postedBase = gp.base;
      }
    }
    // The average-speed zone (trajectcontrole): the clock starts at its start, the average is judged at its end.
    const z = plan.zone;
    if (z) {
      if (crossed(o0, span, z.off0, L)) {
        cr.zoneT0 = this.runner.race.raceTick;
        cr.zoneD0 = d1;
        cr.zoneLimit = cr.posted > 0 ? cr.posted : z.limit;
      }
      if (crossed(o0, span, wrapOff(z.off0 + z.len, L), L) && cr.zoneT0 >= 0) {
        const dt = this.runner.race.raceTick - cr.zoneT0;
        const dd = d1 - cr.zoneD0;
        cr.zoneT0 = -1;
        if (dt > 0 && dd > z.len * 0.5 && dd < z.len * 1.5) {
          const avg = Math.round(((dd * 60) / dt) * 3.6);
          if (avg > cr.zoneLimit + CAMERA_TOLERANCE) this.fine(cr, 'zone', avg, cr.zoneLimit, this.zoneWhere);
        }
      }
    }
    // The speed cameras (the fixed ones every lap; a road works' mobile one while the works stand).
    for (const c of plan.cameras) {
      if (c.works >= 0 && !this.works.zones[c.works]?.active) continue;
      if (!crossed(o0, span, c.off, L)) continue;
      const limit = this.cameraLimitOf(cr, c);
      const kmh = Math.round(Math.abs(car.speed) * 3.6);
      if (kmh > limit + CAMERA_TOLERANCE) this.fine(cr, 'camera', kmh, limit, c.where);
    }
  }

  private redX(cr: CarRules, g: number, lane: number): void {
    const car = cr.car;
    const e = this.ev.redx;
    e.car = car.id;
    e.slot = car.slot;
    e.gantry = g;
    e.lane = lane;
    this.runner.events.emit('redx', e);
    this.fine(cr, 'redx', Math.round(Math.abs(car.speed) * 3.6), 0, this.plan.gantries[g].section);
  }

  /** A fine: `CarState.fines` + 1, then `flash` and `fine` (the book adds the euros). */
  private fine(cr: CarRules, kind: 'camera' | 'zone' | 'redx', kmh: number, limit: number, where: string): void {
    const car = cr.car;
    car.fines++;
    const f = this.ev.flash;
    f.car = car.id;
    f.slot = car.slot;
    f.speed = kmh;
    f.limit = limit;
    f.where = where;
    f.kind = kind;
    this.runner.events.emit('flash', f);
    const e = this.ev.fine;
    e.car = car.id;
    e.slot = car.slot;
    e.kind = kind;
    e.euros = fineEuros(kind, kmh - limit);
    this.runner.events.emit('fine', e);
  }

  /** Overtakes (spec §9): a player passes a rival — once per rival per lap of the player. */
  private overtakes(): void {
    const cs = this.cars;
    const n = cs.length;
    for (let i = 0; i < n; i++) {
      const p = cs[i].car;
      if (p.slot < 0) continue;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const o = cs[j].car;
        const k = i * n + j;
        const was = this.ahead[k];
        const now = o.dist > p.dist ? 1 : 0;
        this.ahead[k] = now;
        if (o.slot >= 0 || was !== 1 || now !== 0 || p.finished || o.finished) continue;
        if (this.counted[k] === p.lap) continue;
        this.counted[k] = p.lap;
        const e = this.ev.overtake;
        e.car = p.id;
        e.slot = p.slot;
        e.other = o.id;
        this.runner.events.emit('overtake', e);
      }
    }
  }

  /** A car finished a lap: a new best full lap → `bestLap`. */
  private onLap(id: string, ticks: number): void {
    const cr = this.cars.find((c) => c.car.id === id);
    if (!cr) return;
    const car = cr.car;
    // A partial lap (a mid-race join) is no lap record.
    if (car.lapTicks.length <= car.partLaps) return;
    if (cr.best >= 0 && ticks >= cr.best) return;
    cr.best = ticks;
    const e = this.ev.best;
    e.car = car.id;
    e.slot = car.slot;
    e.ticks = ticks;
    this.runner.events.emit('bestLap', e);
  }

  // -- queries for the HUD, the scenery and other owners ------------------------------------------

  /** The next anchor of the cameras that are live ahead of a car within `range` m (−1 = none): its distance. */
  cameraAhead(car: CarState, range = FLITSER_AHEAD): number {
    const plan = this.plan;
    const o = this.offOf(car.dist);
    let best = -1;
    for (const c of plan.cameras) {
      if (c.works >= 0 && !this.works.zones[c.works]?.active) continue;
      const d = ahead(o, c.off, plan.L);
      if (d < range && (best < 0 || d < best)) best = d;
    }
    return best;
  }

  /**
   * Fixer (wave B): the limit a camera enforces on a car: the last posted limit (else the table's);
   * a fixed camera more than `WORKS_CAMERA_LEAD` m before standing road works keeps the base limit
   * (the works' step-down 80 / 70 is posted far ahead of them, and is enforced only at the works).
   */
  private cameraLimitOf(cr: CarRules, c: CameraPlan): number {
    const posted = cr.posted > 0 ? cr.posted : c.limit;
    if (c.works >= 0 || cr.postedBase <= posted) return posted;
    const L = this.plan.L;
    for (const z of this.works.zones) {
      if (z.active && inRange(c.off, wrapOff(z.plan.off0 - WORKS_CAMERA_LEAD, L), z.plan.len + WORKS_CAMERA_LEAD, L)) return posted;
    }
    return cr.postedBase;
  }

  /** Fixer (wave B): the limit the next camera within `range` m ahead of a car enforces on it (km/h; −1 = none). */
  cameraLimit(car: CarState, range = FLITSER_AHEAD): number {
    const plan = this.plan;
    const cr = this.of(car);
    if (!cr) return -1;
    const o = this.offOf(car.dist);
    let best = -1;
    let lim = -1;
    for (const c of plan.cameras) {
      if (c.works >= 0 && !this.works.zones[c.works]?.active) continue;
      const d = ahead(o, c.off, plan.L);
      if (d < range && (best < 0 || d < best)) {
        best = d;
        lim = this.cameraLimitOf(cr, c);
      }
    }
    return lim;
  }

  /**
   * The next gantry ahead within `range` m that shows a red X over the car's lane: its distance (−1 =
   * none). Fixer (wave B): a lane within `REDX_EDGE` m of the car's side counts too (a car on the
   * border of the shoulder is warned about the shoulder's X).
   */
  redXAhead(car: CarState, range = 300): number {
    const plan = this.plan;
    const o = this.offOf(car.dist);
    const lane = signLaneAt(plan, car.side);
    const left = signLaneAt(plan, car.side - REDX_EDGE);
    const right = signLaneAt(plan, car.side + REDX_EDGE);
    const signs = this.runner.signs;
    let best = -1;
    for (let g = 0; g < plan.gantries.length; g++) {
      if (!plan.gantries[g].signs) continue;
      const d = ahead(o, plan.gantries[g].off, plan.L);
      if (d >= range || (best >= 0 && d >= best)) continue;
      if (signs.sign(g, lane) === 'x' || signs.sign(g, left) === 'x' || signs.sign(g, right) === 'x') best = d;
    }
    return best;
  }

  /** Fixer (wave B): does a gantry within `range` m ahead of a lap offset show a red X over the hard shoulder? */
  shoulderX(off: number, range: number): boolean {
    const plan = this.plan;
    const signs = this.runner.signs;
    for (let g = 0; g < plan.gantries.length; g++) {
      if (!plan.gantries[g].signs) continue;
      if (ahead(off, plan.gantries[g].off, plan.L) < range && signs.sign(g, SIGN_SHOULDER) === 'x') return true;
    }
    return false;
  }

  /** The average-speed zone around a car: its running average and limit (km/h), or null outside it. */
  zoneAverage(car: CarState): Readonly<{ avg: number; limit: number }> | null {
    const cr = this.of(car);
    if (!cr || cr.zoneT0 < 0) return null;
    const dt = this.runner.race.raceTick - cr.zoneT0;
    const z = this.zoneOut;
    z.avg = dt <= 30 ? Math.round(Math.abs(car.speed) * 3.6) : Math.round((((car.dist - cr.zoneD0) * 60) / dt) * 3.6);
    z.limit = cr.zoneLimit;
    return z;
  }

  /**
   * The next safe point behind the last car for a player who joins during the race (spec §10): the
   * first place 15–600 m behind it (10 m steps) out of the tunnels and their ramps, clear of standing
   * road works, with a lane (the right one first) that has no body within 30 m. Null: none (the
   * runner's default).
   */
  joinPoint(last: CarState): { back: number; lane: number } | null {
    const r = this.runner;
    const track = r.track;
    const plan = this.plan;
    const L = plan.L;
    const flagsAt = (track as { flagsAt?(s: number): number }).flagsAt;
    for (let back = 15; back <= 600; back += 10) {
      const s = track.spline.wrap(last.s - back);
      const off = this.offOf(last.dist - back);
      if (flagsAt) {
        let bad = false;
        for (let k = -40; k <= 40 && !bad; k += 20) if ((flagsAt.call(track, track.spline.wrap(s + k)) & JOIN_AVOID) !== 0) bad = true;
        if (bad) continue;
      }
      let works = false;
      for (const z of this.works.zones) if (z.active && inRange(off, wrapOff(z.plan.off0 - 140, L), z.plan.len + 180, L)) works = true;
      if (works) continue;
      for (let lane = track.lanes - 1; lane >= 0; lane--) {
        const side = plan.laneX[lane];
        let free = true;
        for (const b of r.bodies) if (!b.phys.ghost && Math.abs(dsOf(s, b.s, L)) < 30 && Math.abs(b.side - side) < 2.6) free = false;
        if (free) return { back, lane };
      }
    }
    return null;
  }

  /** Is lane `lane` (0..2, 3 the shoulder) closed by active road works at a lap offset or within `look` m after it? */
  laneClosed(off: number, lane: number, look = 0): boolean {
    return this.works.closedAt(off, lane, look);
  }
}

/** The sign of a limit. */
function limitSign(kmh: number): SignState {
  return kmh <= 50 ? 'limit-50' : kmh <= 70 ? 'limit-70' : kmh <= 80 ? 'limit-80' : 'limit-100';
}

/** Did a car that moved `span` m forward from lap offset `o0` pass the anchor at `off`? */
function crossed(o0: number, span: number, off: number, L: number): boolean {
  const a = ahead(o0, off, L);
  return a > 0 && a <= span;
}

/** Lamp bits the rules set on race cars (the hazards of a pulled-over car). */
export const PULLED_LIGHTS = BODY_LIGHT.hazard;
/** The signs per gantry (re-exported for the drawers). */
export const RULES_SIGN_LANES = SIGN_LANES;

const RULES = new WeakMap<RallyRunner, RallyRules>();

/** Install the rules into a runner (the system 'rules'). */
export function installRules(runner: RallyRunner): RallyRules {
  const rules = new RallyRules(runner);
  RULES.set(runner, rules);
  runner.addSystem({ step: () => rules.step() });
  runner.joinAt = (last) => rules.joinPoint(last);
  return rules;
}

/** The rules of a runner (null when the rules content is not installed). */
export function rulesOf(runner: RallyRunner): RallyRules | null {
  return RULES.get(runner) ?? null;
}
