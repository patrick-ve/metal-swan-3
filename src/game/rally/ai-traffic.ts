/**
 * The traffic (FIELD, wave B; docs/design/rally.md §2, §4, §6; docs/api/rally.md "B.F"): the
 * motorway's other road users around the players — a deterministic spawner, a driver per car, the
 * lights, the reaction to a hit, the horns, the near misses and lap 3's jams. Installed by the lazy
 * content (content/rally/traffic) as FIELD's system 'traffic'.
 *
 * - **Pools:** every traffic type (`TrafficType`: a model, its handling, its lanes, its weight) has a
 *   pool of bodies, added to the runner ONCE at install (`addBody`); a parked body is `hidden` and a
 *   `ghost` (no contact, not drawn). Nothing is added or removed during the race (the scene's list
 *   stays), a spawn only changes the body's colour (`clutRow`).
 * - **The spawner** keeps `density(lap, difficulty)` cars in each player's window (`WINDOW_BEHIND`
 *   m behind to `WINDOW_AHEAD` m ahead): new cars appear `SPAWN_AHEAD` m ahead (beyond the fog;
 *   never within `SPAWN_SAFE` m ahead of any player, never close behind one), or behind a player who
 *   is slow; cars that fall out of every window are parked. Light on lap 1, medium on lap 2, rush hour
 *   on lap 3 (× the difficulty).
 * - **The driver:** lanes with their own speeds (`LANE_KMH`: 80–110 km/h, slower on the right; each
 *   car ± 5 %; lorries and coaches slower and never in the left lane), a time gap behind the car
 *   ahead (brake lights), a lane change to pass a slower car (left, when the lane is free behind and
 *   ahead) or back to the right when there is room — always with the indicator on `SIGNAL` ticks
 *   (about 1 s) before it moves; the road works of lap 2 (their closed lanes, merged out of early; the
 *   limit) and the spitsstrook of lap 3 (the right-lane cars use the hard shoulder in the stretches).
 * - **A hit** (a car's bump that spins it or costs it `HIT_DV` m/s): it brakes to a stop with its
 *   hazard lights on, stands `STOP_TICKS`, turns back along the road and drives on (`crash` when a
 *   racer hit it).
 * - **Horns:** a racer that cuts in close in front of a traffic car that has to brake hard gets a
 *   honk (`honk { car: the traffic car, slot: the racer's slot }`).
 * - **Near misses:** a player who passes a traffic car with less than `NEAR_GAP` m between them
 *   (`nearMiss { car, slot, other, speed }`; the score counts those above 150 km/h).
 * - **Jams** (lap 3): `JAMS[difficulty]` zones of `JAM_LEN` m along lap 3; when a player comes within
 *   `JAM_ARM` m the zone fills with a slow cluster across the lanes (stop-and-go, brake lights) and
 *   `jam { section }` is sent; it clears when every player is through.
 *
 * Pure and deterministic (§12.4): `runner.rng.fork('traffic')` for every random choice; r3 maths
 * only; no allocation per tick (the payload objects are reused).
 */
import { splineSample } from '../../engine/r3/spline';
import { angleDiff, atan2T, wrapAngle } from '../../engine/r3/trig';
import type { Rng } from '../../engine/rng';
import type { Difficulty } from '../session';
import { emptyRallyInput, type CarState, type RallyBody, type RallyInput, type RallyTrack } from './api';
import { AI_CORRIDOR, AI_GRIP, laneRoom, lookAhead, newDriver, pedalsTo, sideClear, steerTo, type Driver } from './ai';
import { BODY_LIGHT } from './ids';
import { dsOf, frontGrip, handlingOf, laneSide, newPhys, stepBody, yawOf, type CarSpecB } from './physics';
import { inRange, wrapOff } from './rules/plan';
import { rulesOf } from './rules/rules';
import type { RallyRunner } from './runner';
import { envelope, trackInfo } from './track-info';

/** A traffic type: its car (model, handling), where it drives, how often it comes. */
export interface TrafficType {
  readonly spec: CarSpecB;
  /** Its colour variants (the model's CLUT rows: clutRow 0 … rows − 1). */
  readonly rows: number;
  /** The spawn weight. */
  readonly weight: number;
  /** The lanes it may use (0 = the left lane). */
  readonly lanes: readonly number[];
  /** × the lane's speed (a lorry 0.85). */
  readonly pace: number;
  /** Its speed cap (km/h; a lorry 85). */
  readonly maxKmh: number;
  /** Bodies in its pool per player. */
  readonly pool: number;
}

/** The lanes' speeds (km/h, left → right; spec §6: 80–110, slower on the right), the hard shoulder's. */
export const LANE_KMH: readonly number[] = [108, 98, 86];
export const SHOULDER_KMH = 88;
/** Each car's own speed spread (±). */
export const VARY = 0.05;
/** The traffic window around a player (m). */
export const WINDOW_BEHIND = 240;
export const WINDOW_AHEAD = 500;
/** New cars appear this far ahead of a player (+ up to `SPAWN_JITTER`), and never this close ahead of another player. */
export const SPAWN_AHEAD = 450;
export const SPAWN_JITTER = 50;
export const SPAWN_SAFE = 440;
/** A car parks when it is this far beyond every window (m). */
const PARK_BEHIND = WINDOW_BEHIND + 30;
const PARK_AHEAD = WINDOW_AHEAD + 160;
/** Cars per player window by lap (1, 2, 3: light, medium, rush hour) at normal; × `DENSITY_K` by difficulty. */
export const DENSITY: readonly number[] = [5, 8, 12];
export const DENSITY_K: Readonly<Record<Difficulty, number>> = { easy: 0.75, normal: 1, hard: 1.2 };
/** × the density of each window in a 2P race. */
export const DENSITY_2P = 0.85;
/** The indicator blinks this long before a lane change (about 1 s). */
export const SIGNAL = 60;
/** The side line's speed during a lane change (m per tick: about 2 s for a lane). */
const CHANGE_RATE = 0.03;
/** Ticks between two lane decisions of a car. */
const DECIDE = 30;
/** A hit: this much speed lost in a bump (m/s), or a spin; it then stands this long (ticks). */
export const HIT_DV = 4;
export const STOP_TICKS = 120;
/** The deadlock breaker (integrator, wave B): a car that stood this long while it wanted to drive goes ghost this long. */
export const DEADLOCK_TICKS = 300;
export const UNLOCK_TICKS = 150;
/** The hazards stay on this long after it drives on. */
export const HAZARD_AFTER = 90;
/** A near miss: less than this between the bodies' sides (m) when a player passes. */
export const NEAR_GAP = 0.9;
/** A honk: the racer ahead within this gap (m) makes it brake by more than `HONK_DV` m/s. */
const HONK_GAP = 14;
const HONK_DV = 5;
const HONK_COOL = 240;
/** Jams on lap 3 (spec §4): zones per difficulty, their length (m), armed this far ahead of a player, the cars, the speed. */
export const JAMS: Readonly<Record<Difficulty, number>> = { easy: 1, normal: 2, hard: 2 };
export const JAM_LEN = 110;
export const JAM_ARM = 520;
export const JAM_CARS = 7;
/** Traffic slows toward a jam from this far before it (m). Integrator (wave B momentum): 170 m / 45 km/h / 90 m cost a bot 20–25 s per jam; now about 6–9 s. */
export const JAM_APPROACH = 60;
export const JAM_KMH = 60;
/** A traffic car makes way for a faster one from up to this far behind (m); its mirror looks this many seconds back. */
const PRESS_BACK = 150;
const MIRROR = 3.5;
/** No new car where two bodies already stand within this many metres (any lane): no walls across the road. */
const ACROSS = 40;
/** × the road works' limit for the right lane and for the other lanes (traffic only). */
export const WORKS_RIGHT = 0.86;
export const WORKS_LEFT = 1.04;
/** The road works' limit (km/h) when the track gives none. */
const WORKS_KMH = 70;

/** One car of the pool. */
export interface TrafficCar {
  readonly body: RallyBody;
  readonly type: TrafficType;
  readonly d: Driver;
  readonly inp: RallyInput;
  active: boolean;
  /** Its own speed factor. */
  vary: number;
  /** 'drive', 'hit' (braking to a stop), 'stopped'. */
  state: 'drive' | 'hit' | 'stopped';
  stateT: number;
  /** Ticks of the indicator before it moves (> 0), the direction (−1 left, 1 right). */
  signal: number;
  signalDir: number;
  /** The lane it moves to (the indicator stays on until it is there; −1 none), and the lane it left. */
  moving: number;
  from: number;
  /** Ticks to its next lane decision. */
  decideT: number;
  /** Hazard lights left on (ticks) after it drove on. */
  hazardT: number;
  honkT: number;
  /** Its bump counter and speed last tick (the hit check). */
  bumps: number;
  lastSpeed: number;
  /** The jam zone it belongs to (−1 none). */
  jam: number;
  /**
   * Integrator (wave B): the deadlock breaker. Ticks it stood while it wanted to drive; past
   * `DEADLOCK_TICKS` it turns a ghost for `UNLOCK_TICKS` and drives on through what blocks it (it
   * turns solid again once no body overlaps it). A rush-hour knot of cars across the lanes never
   * holds the race for minutes.
   */
  standT: number;
  ghostT: number;
  /** Per player slot: the arc offset from that player last tick (near misses). */
  readonly prevDs: [number, number];
}

/** A jam zone of lap 3. */
export interface JamZone {
  /** Its start along the race (m from the start line, lap 3) and its arc length. */
  readonly dist: number;
  readonly s0: number;
  state: 'waiting' | 'active' | 'over';
}

/** What the traffic needs of the track's anchors (TRACK's A10; a test track has none). */
interface TrafficTrack {
  readonly roadworks?: readonly { readonly s0: number; readonly s1: number; readonly closed: readonly number[]; readonly limit?: number; readonly section?: number }[];
  readonly spits?: readonly { readonly s0: number; readonly s1: number }[];
  readonly sections?: readonly { readonly id: string }[];
  readonly sectionAt?: (s: number) => number;
}

/** The traffic of one race (the system's state; tests read it). */
export class Traffic {
  readonly runner: RallyRunner;
  readonly cars: TrafficCar[] = [];
  readonly jams: JamZone[] = [];
  readonly rng: Rng;
  /** The density factor (the difficulty × the 2P factor; recomputed when a second player joins). */
  k: number;
  private readonly types: readonly TrafficType[];
  /** Fixer (wave B): the players the pools are sized for, and the runner's roster seen last. */
  private players: number;
  private seenRoster = -1;
  private readonly tmp = splineSample();
  private readonly shoulder: boolean;
  private readonly t: TrafficTrack;
  private readonly ev = {
    honk: { car: '', slot: -1 },
    crash: { car: '', slot: -1, other: '' },
    nearMiss: { car: '', slot: -1, other: '', speed: 0 },
    jam: { section: '' },
  };
  private spawnT = 0;
  /** Spawns and parks so far (tests, the report). */
  spawned = 0;
  parked = 0;

  constructor(runner: RallyRunner, types: readonly TrafficType[]) {
    this.runner = runner;
    this.types = types;
    this.rng = runner.rng.fork('traffic');
    // Two players: two windows that often overlap (each a little lighter: the road is shared).
    this.k = DENSITY_K[runner.difficulty] * (runner.cars.filter((c) => c.slot >= 0).length > 1 ? DENSITY_2P : 1);
    const track = runner.track;
    this.t = track as unknown as TrafficTrack;
    this.shoulder = laneSide(track, track.lanes, 0) < track.halfWidth - 0.8 && laneSide(track, track.lanes, 0) > laneSide(track, track.lanes - 1, 0) + 2;
    const players = Math.max(1, runner.cars.filter((c) => c.slot >= 0).length);
    this.players = players;
    // The pools (every body added once).
    for (const type of types) {
      const h = handlingOf(type.spec);
      for (let i = 0; i < type.pool * players; i++) this.addCar(type, h, i);
    }
    // Lap 3's jams: zones spread over the lap (deterministic from the seed).
    const L = track.length;
    const nj = JAMS[runner.difficulty];
    for (let j = 0; j < nj; j++) {
      const off = L * ((j + 0.6) / (nj + 0.4)) + this.rng.range(-150, 150);
      this.jams.push({ dist: 2 * L + off, s0: track.spline.wrap(track.startS + off), state: 'waiting' });
    }
    // The road ahead of the grid already has its traffic (beyond the start).
    this.fillAtStart();
  }

  /** One pooled traffic car (parked: hidden, a ghost) of a type, the `i`-th of its pool. */
  private addCar(type: TrafficType, h: ReturnType<typeof handlingOf>, i: number): void {
    const runner = this.runner;
    const track = runner.track;
    const body: RallyBody = {
      id: `${type.spec.id}-${i + 1}`,
      pos: [0, 0, 0],
      yaw: 0,
      speed: 0,
      steer: 0,
      s: 0,
      side: 1000,
      dist: 0,
      phys: newPhys(h),
      kind: 'traffic',
      model: type.spec.model,
      clutRow: 0,
      lights: 0,
      hidden: true,
    };
    body.phys.ghost = true;
    const car: TrafficCar = {
      body,
      type,
      d: newDriver(track, 0, 0, 1, false),
      inp: emptyRallyInput(),
      active: false,
      vary: 1,
      state: 'drive',
      stateT: 0,
      signal: 0,
      signalDir: 0,
      moving: -1,
      from: 0,
      decideT: 0,
      hazardT: 0,
      honkT: 0,
      bumps: 0,
      lastSpeed: 0,
      jam: -1,
      standT: 0,
      ghostT: 0,
      prevDs: [Infinity, Infinity],
    };
    this.cars.push(car);
    runner.addBody(body);
  }

  /**
   * Fixer (wave B): a second player who joins after the start (on the grid, in the intro or during the
   * race) gets the 2P traffic: the pools grow to two players' size and the density takes the 2P factor.
   */
  private syncPlayers(): void {
    const runner = this.runner;
    this.seenRoster = runner.roster;
    let n = 0;
    for (const c of runner.cars) if (c.slot >= 0) n++;
    if (n <= this.players) return;
    this.k = DENSITY_K[runner.difficulty] * DENSITY_2P;
    for (const type of this.types) {
      const h = handlingOf(type.spec);
      for (let i = type.pool * this.players; i < type.pool * n; i++) this.addCar(type, h, i);
    }
    this.players = n;
    this.seenRoster = runner.roster;
  }

  /** The cars a player's window wants now (by its lap, × the difficulty). */
  density(lap: number): number {
    const i = lap < 1 ? 0 : lap > 3 ? 2 : lap - 1;
    return Math.round(DENSITY[i] * this.k);
  }

  /** The lap that sets a player's density (1..3; the race's start lap counts). */
  private lapOf(c: CarState): number {
    return c.finished ? 3 : c.lap < 1 ? 1 : c.lap > 3 ? 3 : c.lap;
  }

  /** Lap 2's road works are on while a player races lap 2 (RULES' event; TRACK's anchors). */
  roadworksOn(): boolean {
    // RULES' zones when the rules run (the seed may leave one out; a zone switches only while no player is near).
    const rules = rulesOf(this.runner);
    if (rules) {
      for (const z of rules.works.zones) if (z.active) return true;
      return false;
    }
    for (const c of this.runner.cars) if (c.slot >= 0 && !c.finished && c.lap === 2) return true;
    return false;
  }

  /** Lap 3's spitsstrook is open while a player races lap 3. */
  spitsOpen(): boolean {
    if (!this.shoulder) return false;
    for (const c of this.runner.cars) if (c.slot >= 0 && !c.finished && c.lap >= 3) return true;
    return false;
  }

  /** Initial traffic ahead of the grid (from 250 m past the leader to the window's end). */
  private fillAtStart(): void {
    const r = this.runner;
    for (const p of r.cars) {
      if (p.slot < 0) continue;
      const want = this.density(this.lapOf(p));
      let lead = -Infinity;
      for (const c of r.cars) if (c.dist > lead) lead = c.dist;
      const base = lead - p.dist + 250;
      for (let k = 0; k < want; k++) {
        const ahead = base + ((WINDOW_AHEAD - base) * (k + this.rng.next())) / want;
        if (ahead > WINDOW_AHEAD) continue;
        this.spawnAt(p, ahead, -1);
      }
    }
  }

  /** Pick a type with a free body (by weight); null when every pool is busy. */
  private pickType(): TrafficType | null {
    let total = 0;
    for (const t of this.types) if (this.freeOf(t)) total += t.weight;
    if (total <= 0) return null;
    let x = this.rng.next() * total;
    for (const t of this.types) {
      if (!this.freeOf(t)) continue;
      x -= t.weight;
      if (x <= 0) return t;
    }
    return null;
  }

  private freeOf(t: TrafficType): TrafficCar | null {
    for (const c of this.cars) if (!c.active && c.type === t) return c;
    return null;
  }

  /** The cruise of a car in a lane (m/s). */
  private cruise(c: TrafficCar, lane: number): number {
    const kmh = lane >= LANE_KMH.length ? SHOULDER_KMH : LANE_KMH[lane < 0 ? 0 : lane];
    const v = kmh * c.type.pace * c.vary;
    return (v > c.type.maxKmh ? c.type.maxKmh : v) / 3.6;
  }

  /** Is a spot (arc length, side) free of active bodies within `room` m in its lane, and not a wall across the road (≤ 1 body within `ACROSS` m)? */
  private spotFree(s: number, side: number, room: number): boolean {
    const L = this.runner.track.length;
    let near = 0;
    for (const o of this.runner.bodies) {
      if (o.phys.ghost) continue;
      const ds = Math.abs(dsOf(s, o.s, L));
      if (ds < room && Math.abs(o.side - side) < 2.6) return false;
      if (ds < ACROSS && ++near > 1) return false;
    }
    return true;
  }

  /** Can a body appear at arc length s without a player seeing it pop in? */
  private unseen(s: number): boolean {
    const L = this.runner.track.length;
    for (const q of this.runner.cars) {
      if (q.slot < 0) continue;
      const dq = dsOf(q.s, s, L);
      if (dq > -60 && dq < SPAWN_SAFE) return false;
    }
    return true;
  }

  /**
   * Spawn a car `ahead` m from player `p` (negative = behind) in a lane (−1 = by weight); `jam` its
   * jam zone. False when no body or no free spot.
   */
  spawnAt(p: CarState, ahead: number, lane: number, jam = -1, speed = -1): boolean {
    const r = this.runner;
    const track = r.track;
    const type = this.pickType();
    if (!type) return false;
    const c = this.freeOf(type)!;
    const s = track.spline.wrap(p.s + ahead);
    let ln = lane;
    if (ln < 0 || !type.lanes.includes(ln)) {
      // The right lanes more often (spec §6: the slow lane is the busy one): weight 1 + the lane.
      let tot = 0;
      for (const l of type.lanes) tot += 1 + l;
      let x = this.rng.next() * tot;
      ln = type.lanes[type.lanes.length - 1];
      for (const l of type.lanes) {
        x -= 1 + l;
        if (x <= 0) {
          ln = l;
          break;
        }
      }
    }
    if (this.worksClosed(ln, s)) ln = this.openLane(c, ln, s);
    const side = laneSide(track, ln, s);
    if (!this.spotFree(s, side, (type.spec.length ?? 5) + 12)) return false;
    const b = c.body;
    const sp = track.spline.sample(s, this.tmp);
    b.pos[0] = sp.p[0] + sp.r[0] * side;
    b.pos[1] = sp.p[1];
    b.pos[2] = sp.p[2] + sp.r[2] * side;
    b.yaw = yawOf(sp.t[0], sp.t[2]);
    b.s = s;
    b.side = side;
    b.dist = p.dist + ahead;
    b.steer = 0;
    b.clutRow = type.rows > 1 ? this.rng.int(0, type.rows - 1) : 0;
    b.hidden = false;
    b.lights = 0;
    const ph = b.phys;
    ph.ghost = false;
    ph.slip = 0;
    ph.yawRate = 0;
    ph.spin = 0;
    ph.stuck = 0;
    c.standT = 0;
    c.ghostT = 0;
    ph.lock = 0;
    ph.draft = 0;
    ph.scrape = 0;
    c.vary = 1 + this.rng.range(-VARY, VARY);
    c.state = 'drive';
    c.stateT = 0;
    c.signal = 0;
    c.signalDir = 0;
    c.moving = -1;
    c.from = ln;
    c.decideT = this.rng.int(0, DECIDE);
    c.hazardT = 0;
    c.honkT = 0;
    c.bumps = ph.bumps;
    c.jam = jam;
    c.prevDs[0] = c.prevDs[1] = Infinity;
    c.d.lane = ln;
    c.d.side = side;
    b.speed = speed >= 0 ? speed : this.cruise(c, ln);
    c.lastSpeed = b.speed;
    c.active = true;
    this.spawned++;
    return true;
  }

  /** Park a car (hidden, a ghost, out of every corridor). */
  park(c: TrafficCar): void {
    const b = c.body;
    c.active = false;
    b.hidden = true;
    b.phys.ghost = true;
    b.speed = 0;
    b.side = 1000;
    b.lights = 0;
    c.jam = -1;
    this.parked++;
  }

  /** Is lane `lane` closed by active road works at arc length s (or within 280 m before them)? */
  worksClosed(lane: number, s: number): boolean {
    const rules = rulesOf(this.runner);
    if (rules) return rules.works.closedAt(wrapOff(s - this.runner.track.startS, rules.plan.L), lane, 280);
    const rw = this.t.roadworks;
    if (!rw || rw.length === 0 || !this.roadworksOn()) return false;
    const L = this.runner.track.length;
    for (const w of rw) {
      if (!w.closed.includes(lane)) continue;
      const a = dsOf(w.s0, s, L);
      const len = dsOf(w.s0, w.s1, L);
      if (a > -280 && a < len) return true;
    }
    return false;
  }

  /** The road works' limit at s (m/s), or Infinity. */
  private worksLimit(s: number): number {
    const rules = rulesOf(this.runner);
    if (rules) {
      const L = rules.plan.L;
      const off = wrapOff(s - this.runner.track.startS, L);
      for (const z of rules.works.zones) if (z.active && inRange(off, wrapOff(z.plan.off0 - 120, L), z.plan.len + 120, L)) return z.plan.limit / 3.6;
      return Infinity;
    }
    const rw = this.t.roadworks;
    if (!rw || !this.roadworksOn()) return Infinity;
    const L = this.runner.track.length;
    for (const w of rw) {
      const a = dsOf(w.s0, s, L);
      if (a > -120 && a < dsOf(w.s0, w.s1, L)) return (w.limit ?? WORKS_KMH) / 3.6;
    }
    return Infinity;
  }

  /** In a spitsstrook stretch (and how far to its end, m), or −1. */
  private spitsLeft(s: number): number {
    const sp = this.t.spits;
    if (!sp || !this.spitsOpen()) return -1;
    const L = this.runner.track.length;
    for (const z of sp) {
      const a = dsOf(z.s0, s, L);
      const len = dsOf(z.s0, z.s1, L);
      if (a >= 0 && a < len) return len - a;
    }
    return -1;
  }

  /** The nearest lane this car may use that is not closed at s. */
  private openLane(c: TrafficCar, from: number, s: number): number {
    let best = from;
    let bd = Infinity;
    for (const l of c.type.lanes) {
      if (this.worksClosed(l, s)) continue;
      const d = Math.abs(l - from);
      if (d < bd) {
        bd = d;
        best = l;
      }
    }
    return best;
  }

  /** The jam speed at arc length s (m/s; stop and go), or Infinity outside an active jam. */
  private jamSpeed(s: number, tick: number): number {
    const L = this.runner.track.length;
    for (const j of this.jams) {
      if (j.state !== 'active') continue;
      const a = dsOf(j.s0, s, L);
      if (a > -JAM_APPROACH && a < JAM_LEN) {
        // Stop and go: a slow wave along the queue.
        const ph = (tick + Math.floor(a * 3)) % 240;
        const wave = ph < 120 ? ph / 120 : (240 - ph) / 120;
        const v = (JAM_KMH / 3.6) * (0.45 + 0.75 * wave);
        // Coming up to the queue: slow down toward it.
        return a < 0 ? v + (-a / JAM_APPROACH) * 12 : v;
      }
    }
    return Infinity;
  }

  /** One tick (FIELD's system): the jams, the spawner, every active car, the events. */
  step(): void {
    const r = this.runner;
    const track = r.track;
    const L = track.length;
    const bodies = r.bodies;
    if (r.roster !== this.seenRoster) this.syncPlayers();
    const n = bodies.length;
    this.stepJams();
    if (--this.spawnT <= 0) {
      this.spawnT = 8;
      this.spawnAndPark();
    }
    const works = this.roadworksOn();
    for (let i = 0; i < this.cars.length; i++) {
      const c = this.cars[i];
      if (!c.active) continue;
      this.driveCar(c, track, bodies, n, works);
      stepBody(c.body, c.inp, track, this.tmp);
      this.afterStep(c, L);
      this.unlock(c, bodies, n, L);
    }
  }

  /** The deadlock breaker (see `TrafficCar.standT`). */
  private unlock(c: TrafficCar, bodies: readonly RallyBody[], n: number, L: number): void {
    const b = c.body;
    if (!c.active) return;
    if (c.ghostT > 0) {
      if (--c.ghostT > 0) return;
      // Solid again only once nothing overlaps it (else a little longer).
      const h = b.phys.h;
      for (let i = 0; i < n; i++) {
        const o = bodies[i];
        if (o === b || o.phys.ghost) continue;
        if (Math.abs(dsOf(b.s, o.s, L)) < h.halfLen + o.phys.h.halfLen + 1 && Math.abs(o.side - b.side) < h.halfWid + o.phys.h.halfWid + 0.3) {
          c.ghostT = 10;
          return;
        }
      }
      b.phys.ghost = false;
      c.standT = 0;
      return;
    }
    if (c.state === 'drive' && b.speed < 0.5) c.standT++;
    else c.standT = 0;
    if (c.standT < DEADLOCK_TICKS) return;
    c.standT = 0;
    c.ghostT = UNLOCK_TICKS;
    b.phys.ghost = true;
    // Back to the middle of its lane (a car stuck half across two lanes).
    c.d.lane = nearestLaneOf(this.runner.track, c.type.lanes, b.side, b.s);
    c.moving = -1;
    c.signal = 0;
  }

  /** Lap 3's jams: arm, fill and clear the zones. */
  private stepJams(): void {
    const r = this.runner;
    for (let j = 0; j < this.jams.length; j++) {
      const z = this.jams[j];
      if (z.state === 'over') continue;
      let near: CarState | null = null;
      let allThrough = true;
      let any = false;
      for (const p of r.cars) {
        if (p.slot < 0 || p.finished) continue;
        any = true;
        if (p.dist < z.dist + JAM_LEN + 60) allThrough = false;
        if (p.dist > z.dist - JAM_ARM && p.dist < z.dist) near = p;
      }
      if (z.state === 'waiting' && near) {
        z.state = 'active';
        // The cluster: across the lanes along the zone (out of sight: beyond the fog).
        for (let k = 0; k < JAM_CARS; k++) {
          const ahead = z.dist - near.dist + 10 + (k * (JAM_LEN - 20)) / JAM_CARS + this.rng.range(0, 8);
          if (!this.unseen(near.s + ahead)) continue;
          this.spawnAt(near, ahead, k % 3, j, JAM_KMH / 3.6);
        }
        const t = this.t;
        const sec = t.sectionAt && t.sections ? t.sections[t.sectionAt(z.s0)]?.id ?? '' : '';
        this.ev.jam.section = sec;
        r.events.emit('jam', this.ev.jam);
      } else if (z.state === 'active' && (allThrough || !any)) {
        z.state = 'over';
        for (const c of this.cars) if (c.jam === j) c.jam = -1;
      }
    }
  }

  /** Keep each player's window filled; park the cars no window holds. */
  private spawnAndPark(): void {
    const r = this.runner;
    const L = r.track.length;
    // Park.
    for (const c of this.cars) {
      if (!c.active) continue;
      let keep = false;
      for (const p of r.cars) {
        if (p.slot < 0) continue;
        const ds = dsOf(p.s, c.body.s, L);
        if (ds > -PARK_BEHIND && ds < PARK_AHEAD) keep = true;
      }
      if (!keep) this.park(c);
    }
    // Spawn: one per player and check.
    for (const p of r.cars) {
      if (p.slot < 0 || p.finished) continue;
      let count = 0;
      let behind = 0;
      for (const c of this.cars) {
        if (!c.active) continue;
        const ds = dsOf(p.s, c.body.s, L);
        if (ds > -WINDOW_BEHIND && ds < WINDOW_AHEAD) {
          count++;
          if (ds < -40) behind++;
        }
      }
      if (count >= this.density(this.lapOf(p))) continue;
      const ahead = SPAWN_AHEAD + this.rng.range(0, SPAWN_JITTER);
      if (this.unseen(p.s + ahead)) this.spawnAt(p, ahead, -1);
      else if (p.speed < 18 && behind < 2 && this.unseen(p.s - WINDOW_BEHIND + 20)) this.spawnAt(p, -WINDOW_BEHIND + 20, this.rng.int(0, 1));
    }
  }

  /** One car's driver: the state, the lane plan with its indicator, the speed, the wheel. */
  private driveCar(c: TrafficCar, track: RallyTrack, bodies: readonly RallyBody[], n: number, works: boolean): void {
    const b = c.body;
    const d = c.d;
    const out = c.inp;
    const u = b.speed;
    const h = b.phys.h;
    const L = track.length;
    out.handbrake = false;
    out.camera = false;
    out.lookBack = false;
    if (c.state !== 'drive') {
      // A hit: brake to a stop, stand, then drive on.
      out.gas = 0;
      out.brake = u > 0.6 ? 127 : 0;
      out.steer = 0;
      if (c.state === 'hit' && u < 0.6 && b.phys.spin === 0) {
        c.state = 'stopped';
        c.stateT = STOP_TICKS + this.rng.int(0, 60);
      } else if (c.state === 'stopped' && --c.stateT <= 0) {
        c.state = 'drive';
        c.hazardT = HAZARD_AFTER;
        d.lane = track.lanes - 1 < 0 ? 0 : nearestLaneOf(track, c.type.lanes, b.side, b.s);
        d.side = b.side;
        c.moving = d.lane;
        c.from = d.lane;
      }
      return;
    }
    // The body ahead in its corridor.
    const look = lookAhead(u) * 1.3 + 10;
    let gap = Infinity;
    let gapV = 0;
    let gapBody: RallyBody | null = null;
    // A car the deadlock breaker made a ghost drives on through what blocked it.
    for (let i = c.ghostT > 0 ? n : 0; i < n; i++) {
      const o = bodies[i];
      if (o === b || o.phys.ghost) continue;
      const ds = dsOf(b.s, o.s, L);
      const g = ds - h.halfLen - o.phys.h.halfLen;
      if (g < -1 || g > look || g >= gap) continue;
      if (Math.abs(o.side - d.side) >= AI_CORRIDOR && Math.abs(o.side - b.side) >= AI_CORRIDOR) continue;
      gap = g;
      gapV = o.speed;
      gapBody = o;
    }
    // Its speed: the lane's, the jam's, the road works' limit, the bends.
    const lane = c.moving >= 0 ? c.moving : d.lane;
    let v0 = this.cruise(c, lane);
    const jv = this.jamSpeed(b.s, this.runner.tick);
    if (jv < v0) v0 = jv;
    if (works) {
      // The limit by lane (integrator, wave B): the right lane a little slower, so two cars side by
      // side at exactly the limit do not form a rolling wall through the works for 20 s.
      const wl = this.worksLimit(b.s) * c.vary * (lane >= track.lanes - 1 ? WORKS_RIGHT : WORKS_LEFT);
      if (wl < v0) v0 = wl;
    }
    const info = trackInfo(track);
    // The bends of the compressed ring are tight: traffic takes them near its lane speed (at the grip's 90 %).
    let target = envelope(info, b.s, frontGrip(h, u, 0.3) * AI_GRIP, h.brake * 0.5, v0);
    if (gap < look) {
      const follow = gapV + (gap - (5 + 0.9 * (u > 0 ? u : 0))) * 0.45;
      if (follow < target) target = follow > 0 ? follow : 0;
    }
    // A honk at a racer who cut in close and makes it brake hard.
    if (c.honkT > 0) c.honkT--;
    else if (gapBody && gapBody.kind === undefined && gap < HONK_GAP && u - target > HONK_DV) {
      c.honkT = HONK_COOL;
      this.ev.honk.car = b.id;
      this.ev.honk.slot = (gapBody as CarState).slot;
      this.runner.events.emit('honk', this.ev.honk);
    }
    // The lane plan: an indicator first, then the move.
    if (c.signal > 0) {
      c.signal--;
      if (c.signal === 0) {
        const to = d.lane + c.signalDir;
        const side = laneSide(track, to, b.s);
        if (sideClear(b, track, side, bodies, n, 18, MIRROR)) {
          c.from = d.lane;
          d.lane = to;
          c.moving = to;
        } else c.signalDir = 0;
      }
    } else if (c.moving < 0 && --c.decideT <= 0) {
      c.decideT = DECIDE;
      this.decide(c, track, bodies, n, gap, gapV, v0);
    }
    if (c.moving >= 0 && c.moving !== c.from && !sideClear(b, track, laneSide(track, c.moving, b.s), bodies, n, h.halfLen + 3, 0) && Math.abs(b.side - laneSide(track, c.from, b.s)) < 1.6) {
      // A car came alongside in the lane it moves to: it goes back (the mirror again).
      d.lane = c.from;
      c.moving = c.from;
      c.signalDir = -c.signalDir;
    }
    if (c.moving >= 0) {
      const want = laneSide(track, c.moving, b.s);
      const dd = want - d.side;
      // Integrator (wave B): never squeeze a body alongside against the barrier: hold the line while one is beside on that side.
      if (!this.besideOn(b, dd, bodies, n, L)) d.side += dd > CHANGE_RATE ? CHANGE_RATE : dd < -CHANGE_RATE ? -CHANGE_RATE : dd;
      if (Math.abs(want - b.side) < 0.25) {
        c.moving = -1;
        c.signalDir = 0;
      }
    } else d.side = laneSide(track, d.lane, b.s);
    pedalsTo(b, target, out);
    out.steer = Math.round(steerTo(b, track, d.side) * 127);
  }

  /** Is a body alongside `b` (overlapping lengthwise) close on the side it moves to (dir's sign)? */
  private besideOn(b: RallyBody, dir: number, bodies: readonly RallyBody[], n: number, L: number): boolean {
    if (dir === 0) return false;
    const h = b.phys.h;
    for (let i = 0; i < n; i++) {
      const o = bodies[i];
      if (o === b || o.phys.ghost) continue;
      const ds = dsOf(b.s, o.s, L);
      if (ds > h.halfLen + o.phys.h.halfLen + 1 || ds < -h.halfLen - o.phys.h.halfLen - 1) continue;
      const dl = o.side - b.side;
      if ((dir > 0 ? dl > 0 : dl < 0) && (dl < 0 ? -dl : dl) < h.halfWid + o.phys.h.halfWid + 0.5) return true;
    }
    return false;
  }

  /** A lane decision: out of a closed lane, onto or off the spitsstrook, a pass on the left, back to the right. */
  private decide(c: TrafficCar, track: RallyTrack, bodies: readonly RallyBody[], n: number, gap: number, gapV: number, v0: number): void {
    const b = c.body;
    const d = c.d;
    const lanes = c.type.lanes;
    const cur = d.lane;
    const s = b.s;
    let to = -1;
    if (cur >= track.lanes) {
      // On the spitsstrook: back before it ends.
      if (this.spitsLeft(s) < 140) to = cur - 1;
    } else if (this.worksClosed(cur, s)) to = this.openLane(c, cur, s);
    else {
      const spits = this.spitsLeft(s);
      const right = cur + 1;
      if (spits > 200 && cur === track.lanes - 1 && lanes.includes(cur) && this.rng.chance(0.5)) to = track.lanes;
      else if (right < track.lanes && lanes.includes(right) && !this.worksClosed(right, s) && pressed(b, track, bodies, n)) to = right;
      else if (gap < 70 && gapV < v0 - 2.5 && lanes.includes(cur - 1) && !this.worksClosed(cur - 1, s)) to = cur - 1;
      else if (right < track.lanes && lanes.includes(right) && !this.worksClosed(right, s) && this.rng.chance(0.4)) {
        // Keep right when the right lane has room ahead.
        if (laneRoom(b, track, laneSide(track, right, s), bodies, n, 90) > 60) to = right;
      }
    }
    if (to < 0 || to === cur) return;
    const dir = to > cur ? 1 : -1;
    const side = laneSide(track, cur + dir, s);
    if (!sideClear(b, track, side, bodies, n, 20, MIRROR)) return;
    c.signal = SIGNAL;
    c.signalDir = dir;
  }

  /** After the physics: the hit check, the lights, the near misses, the straightening of a stopped car. */
  private afterStep(c: TrafficCar, L: number): void {
    const b = c.body;
    const ph = b.phys;
    const r = this.runner;
    if (ph.bumps !== c.bumps) {
      c.bumps = ph.bumps;
      const dv = c.lastSpeed - b.speed;
      if (c.state === 'drive' && (ph.spin > 0 || dv > HIT_DV || dv < -HIT_DV)) {
        c.state = 'hit';
        c.signal = 0;
        c.moving = -1;
        // Who hit it (the nearest race car)?
        let who: CarState | null = null;
        let wd = 9;
        for (const p of r.cars) {
          const dd = Math.abs(dsOf(b.s, p.s, L)) + Math.abs(p.side - b.side);
          if (dd < wd) {
            wd = dd;
            who = p;
          }
        }
        if (who) {
          const e = this.ev.crash;
          e.car = who.id;
          e.slot = who.slot;
          e.other = b.id;
          r.events.emit('crash', e);
        }
      }
    }
    c.lastSpeed = b.speed;
    if (c.state === 'stopped') {
      // It turns back along the road while it stands (the driver sorts it out).
      const tyaw = atan2T(this.tmp.t[0], this.tmp.t[2]);
      const da = angleDiff(b.yaw, tyaw);
      if (da > 0.03 || da < -0.03) b.yaw = wrapAngle(b.yaw + (da > 0 ? 0.03 : -0.03));
      ph.stuck = 0;
    }
    // The lights (head and tail at night are the drawer's).
    let lights = 0;
    if (c.inp.brake >= 16 || (c.state === 'drive' && c.jam >= 0 && b.speed < 9)) lights |= BODY_LIGHT.brake;
    if (c.state !== 'drive' || c.hazardT > 0) {
      lights |= BODY_LIGHT.hazard;
      if (c.hazardT > 0) c.hazardT--;
    } else {
      const dir = c.signal > 0 ? c.signalDir : c.moving >= 0 ? (laneSide(r.track, c.moving, b.s) < b.side ? -1 : 1) : 0;
      if (dir < 0) lights |= BODY_LIGHT.left;
      else if (dir > 0) lights |= BODY_LIGHT.right;
    }
    b.lights = lights;
    // Near misses: a player passes it close.
    for (const p of r.cars) {
      if (p.slot < 0) continue;
      const k = p.slot === 1 ? 1 : 0;
      const ds = dsOf(p.s, b.s, L);
      const was = c.prevDs[k];
      c.prevDs[k] = ds;
      if (was > 0 && ds <= 0 && ds > -20 && !p.finished && ph.bumpT > 30 && p.phys.bumpT > 30) {
        const clear = Math.abs(p.side - b.side) - p.phys.h.halfWid - ph.h.halfWid;
        if (clear >= 0 && clear < NEAR_GAP && p.speed > 15) {
          const e = this.ev.nearMiss;
          e.car = p.id;
          e.slot = p.slot;
          e.other = b.id;
          e.speed = Math.round(p.speed * 3.6);
          r.events.emit('nearMiss', e);
        }
      }
    }
  }

  /** Active cars (tests, tools). */
  get active(): number {
    let k = 0;
    for (const c of this.cars) if (c.active) k++;
    return k;
  }
}

/** Does a faster body close in on `b` from behind in its lane (within `PRESS_BACK` m, 5 m/s faster)? Keep right, let it by. */
function pressed(b: RallyBody, track: RallyTrack, bodies: readonly RallyBody[], n: number): boolean {
  const L = track.length;
  for (let i = 0; i < n; i++) {
    const o = bodies[i];
    if (o === b || o.phys.ghost) continue;
    const ds = dsOf(b.s, o.s, L);
    if (ds > -4 || ds < -PRESS_BACK) continue;
    if (Math.abs(o.side - b.side) < AI_CORRIDOR + 0.6 && o.speed > b.speed + 5) return true;
  }
  return false;
}

/** The lane of `lanes` nearest a side offset. */
function nearestLaneOf(track: RallyTrack, lanes: readonly number[], side: number, s: number): number {
  let best = lanes[0];
  let bd = Infinity;
  for (const l of lanes) {
    const d = Math.abs(laneSide(track, l, s) - side);
    if (d < bd) {
      bd = d;
      best = l;
    }
  }
  return best;
}

/** The traffic of the runners (tests and tools find a race's traffic here). */
const RACES = new WeakMap<RallyRunner, Traffic>();

/** Install the traffic into a runner (FIELD's system 'traffic'). */
export function installTraffic(runner: RallyRunner, types: readonly TrafficType[]): Traffic {
  const t = new Traffic(runner, types);
  RACES.set(runner, t);
  runner.addSystem({ step: () => t.step() });
  return t;
}

/** The traffic of a race (null when none is installed). */
export function trafficOf(runner: RallyRunner): Traffic | null {
  return RACES.get(runner) ?? null;
}
