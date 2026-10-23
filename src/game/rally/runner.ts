/**
 * RallyRunner — the race (docs/design/rally.md §2, §6, §7.6, §10, §12.3; docs/api/rally.md "A.8"
 * and "A.D"). PREP's frozen interface; DRIVE's race state, physics, input channel and cameras behind
 * it; wave B (FIELD, RULES) adds the rally teams, traffic, police and the rules through `addBody`,
 * `addSystem` and the events.
 *
 * Pure and deterministic (§12.4): a fixed 60 Hz `step()`; `rng` for gameplay, `fxRng` for
 * cosmetics; no allocation per tick (event payloads aside). Like `RingRunner` it calls
 * `session.startMission('rally')`, fills `session.completed`, and has `report()`, `nextMission() →
 * null`, `artDensity` and `hud.banner` (the glitch bridge's `BridgeRunner`), plus what the play
 * controls need (`PlayHostRunner`: `players`, `player`, `continueTicks`, `continuePlayer`,
 * `joinPlayer`).
 *
 * The race:
 * - **The grid** (`phase` 'grid', `COUNTDOWN_TICKS`): 8 cars two-wide behind the line (the player
 *   estates first, then the rivals: 7 in 1P, 6 in 2P; `gridBack`: the rivals first). The countdown
 *   3-2-1 (`countdown`); a jump start only creeps (`PHYS.creep`).
 * - **A join** (spec §10; the field stays at 8): on the grid player 2 takes the second grid slot (the
 *   rivals move one slot back, the last one leaves); during the race the last rival leaves and the
 *   green estate starts behind the last car (its first lap is a partial one: `partLaps`).
 * - **The race** ('race'): the players drive through their race channel (rally/input.ts), the
 *   rivals through their drivers (rally/ai.ts), every body through the same physics (physics.ts):
 *   the barriers, car–car contact, the slipstream, the recovery (3 s the wrong way or stuck → back
 *   on the track). Laps at `lap · length` metres from the start line; the place by lap, then
 *   distance (finished cars by their time). The camera switch and the look back per slot.
 * - **The finish:** after `laps` laps a car is finished: it cruises on in the right lane as a ghost
 *   (no contact), and its player's camera circles it (the results orbit). When every player car has
 *   finished, the rivals still racing get a projected time from their pace ('finish'); the results
 *   hold `FINISH_HOLD` ticks, then 'complete'. `finishNow()` (debug F4) ends the race at once.
 */
import type { AudioOut } from '../../engine/audio';
import { EventBus } from '../../engine/events';
import type { VirtualPad } from '../../engine/input';
import { splineSample, type SplineSample } from '../../engine/r3/spline';
import { Rng } from '../../engine/rng';
import type { Cam3 } from '../../engine/view3d';
import { HudState } from '../context';
import type { Difficulty, GameSession, SlotIndex } from '../session';
import type { GameSettings } from '../settings';
import { emptyRallyInput, type CarSpec, type CarState, type RaceState, type RallyBody, type RallyEventsB, type RallyInput, type RallyOpts, type RallyReport, type RallyTrack } from './api';
import { drive, newDriver, type Driver } from './ai';
import { bindRig, newRig, rallyCam, stepRig, type CamRig } from './camera';
import { RALLY_ID, RALLY_LAPS, RALLY_MODEL, type RallyCam } from './ids';
import { readRaceInput } from './input';
import { Collider, draftStep, dsOf, handlingOf, laneOf, laneSide, newPhys, PHYS, recoverBody, stepBody, stuckStep, yawOf } from './physics';
import { rallySystems, rallyTeams, rallyTrack } from './registry';
import { bestLapTicks, linesTotal, raceLines, raceStars, ScoreBook, type RallyLine } from './score';
import { gridPlan } from './grid';
import { gantriesOf, SignTable } from './signs';
import { trackInfo, type TrackInfo } from './track-info';

/** The countdown before GO (3, 2, 1: one second each). */
export const COUNTDOWN_TICKS = 180;
/** The results hold this long after the race before 'complete' (the orbit, the standings). */
export const FINISH_HOLD = 300;
/** The rivals: 7 in 1P, 6 in 2P (spec §0 item 20: 8 cars on the grid). */
export const RIVALS_1P = 7;
export const RIVALS_2P = 6;
/** PREP's name (kept): the rivals of a 1P race. */
export const STUB_RIVALS = RIVALS_1P;
/** A finished car cruises at this share of its top speed in the right lane. */
export const CRUISE_PACE = 0.5;

/** The estates (spec §6): heavy, front-wheel drive, understeer at speed, about 220 km/h. */
/** The body follows CARS' models (docs/api/rally.md A.C.1: the estates 4.84–5.08 × 1.76 m, wheelbase 2.68). */
export const ESTATE_WHITE: CarSpec = { id: 'white', team: 'ROZZERS', model: RALLY_MODEL.white, mass: 1500, topSpeed: 61, accel: 6.5, grip: 1, fwd: true, length: 4.9, width: 1.76, wheelbase: 2.68 };
export const ESTATE_GREEN: CarSpec = { id: 'green', team: 'SAFARI', model: RALLY_MODEL.green, mass: 1500, topSpeed: 61, accel: 6.5, grip: 1, fwd: true, length: 4.9, width: 1.76, wheelbase: 2.68 };
/** The stub rival (CARS' `rival` model, the hearse: 5.65 × 1.84 m; FIELD replaces the field with the rally teams). */
export const STUB_RIVAL: CarSpec = { id: 'rival', team: 'RIVAL', model: RALLY_MODEL.rival, mass: 1350, topSpeed: 59, accel: 6.6, grip: 0.97, length: 5.6, width: 1.84, wheelbase: 3.2 };

/** The wave A field: seven stub rivals with a little spread in mass, power, top speed and grip. */
export const RIVAL_SPECS: readonly CarSpec[] = [
  { ...STUB_RIVAL, id: 'rival-1', team: 'RIVAL 1', mass: 1650, topSpeed: 60, accel: 6.2, grip: 0.95, fwd: false },
  { ...STUB_RIVAL, id: 'rival-2', team: 'RIVAL 2', mass: 1250, topSpeed: 58, accel: 7.0, grip: 0.98 },
  { ...STUB_RIVAL, id: 'rival-3', team: 'RIVAL 3', mass: 1400, topSpeed: 59, accel: 6.6, grip: 0.97 },
  { ...STUB_RIVAL, id: 'rival-4', team: 'RIVAL 4', mass: 1150, topSpeed: 57, accel: 7.2, grip: 1.0 },
  { ...STUB_RIVAL, id: 'rival-5', team: 'RIVAL 5', mass: 1800, topSpeed: 60, accel: 5.8, grip: 0.93, fwd: false },
  { ...STUB_RIVAL, id: 'rival-6', team: 'RIVAL 6', mass: 1300, topSpeed: 58.5, accel: 6.8, grip: 0.97 },
  { ...STUB_RIVAL, id: 'rival-7', team: 'RIVAL 7', mass: 1450, topSpeed: 59.5, accel: 6.4, grip: 0.96 },
];

/** The rivals' pace by difficulty (spec §2: easy −6 %, normal 0, hard +4 %). */
export const PACE: Readonly<Record<Difficulty, number>> = { easy: 0.94, normal: 1, hard: 1.04 };
/** Each rival's own share of that pace (the field spreads out). */
const RIVAL_PACE: readonly number[] = [0.955, 0.94, 0.95, 0.93, 0.945, 0.935, 0.925];

/** The runner's events: wave A's below, wave B's from api.ts `RallyEventsB` (PREP, additive). */
export interface RallyRunnerEvents extends RallyEventsB {
  /** GO (the countdown is over). */
  start: { tick: number };
  /** A car finished a lap (`lap` = the lap just finished; `ticks` its race ticks). */
  lap: { car: string; slot: number; lap: number; ticks: number };
  /** A player car's place changed. */
  place: { car: string; slot: number; place: number };
  /** A car finished (or got its projected time). */
  finish: { car: string; slot: number; place: number; ticks: number; projected: boolean };
  /** The results are over: the scene shows the tally. */
  complete: { mission: string };
  /** A body touched a barrier (the start of a scrape; sparks, the sound). The payload is reused. */
  scrape: { car: string; slot: number; side: number; speed: number };
  /** Two bodies bumped (`dv`: the larger speed change, m/s). The payload is reused. */
  bump: { a: string; b: string; slotA: number; slotB: number; dv: number };
  /** A car was put back on the track (the blink starts). */
  recover: { car: string; slot: number };
}

export interface RallyRunnerOptions extends RallyOpts {
  session: GameSession;
  pads: readonly [VirtualPad, VirtualPad];
  audio?: AudioOut;
  settings?: GameSettings;
  /** A ready track (tests); default the registered one (registry.ts `rallyTrack`). */
  track?: RallyTrack;
}

/** A player as the play controls see it. */
interface RallyPlayer {
  readonly index: number;
  state: 'racing' | 'out';
}

/** Something wave B adds to the race (traffic, police, the rules): stepped every race tick. */
export interface RallySystem {
  /** After the cars moved, before the contacts. */
  step(r: RallyRunner): void;
}

export class RallyRunner {
  readonly mission = { id: RALLY_ID, hostages: {} as Readonly<Record<string, number>> };
  readonly session: GameSession;
  readonly seed: number;
  readonly difficulty: Difficulty;
  readonly laps: number = RALLY_LAPS;
  /** `?lap=`: the lap the race starts at (1..3). */
  readonly startLap: number;
  readonly track: RallyTrack;
  readonly info: TrackInfo;
  readonly events = new EventBus<RallyRunnerEvents>();
  readonly hud = new HudState();
  /** The glitch bridge snapshots the tally page at this density (2: the glitch density; crisp at 2×). */
  readonly artDensity = 2;
  /** Gameplay randomness (traffic, events: wave B). */
  readonly rng: Rng;
  /** Cosmetic randomness (radio, sparks). */
  readonly fxRng: Rng;
  readonly race: RaceState;
  /** Wave B (PREP, additive): the matrix signs of every gantry (also `race.signs`; RULES sets, WORLD draws). */
  readonly signs: SignTable;
  /** Wave B (PREP, additive): the race's counters (overtakes, near misses, fines' euros) from the events. */
  readonly book = new ScoreBook();
  readonly cars: CarState[] = [];
  /** Everything on the road that collides: the cars first, then the bodies of `addBody`. */
  readonly bodies: RallyBody[] = [];
  /** The camera of each player view (`switchCam`, the race channel's camera button). */
  readonly cams: [RallyCam, RallyCam];
  /** The camera state of each player view (stepped every tick; `camera(slot, out, split)`). */
  readonly rigs: [CamRig, CamRig] = [newRig(), newRig()];
  readonly players: RallyPlayer[] = [];
  readonly continueTicks: number[] = [-1, -1];
  /** This tick's input of each car (by index in `cars`). */
  readonly inputs: RallyInput[] = [];
  /** Each car's driver (the rivals; the players' cruise after the finish). */
  readonly drivers: Driver[] = [];
  private readonly pads: readonly [VirtualPad, VirtualPad];
  private readonly order: CarState[] = [];
  private readonly padIn: [RallyInput, RallyInput] = [emptyRallyInput(), emptyRallyInput()];
  private readonly idle: RallyInput = emptyRallyInput();
  private readonly tmp: SplineSample = splineSample();
  private readonly collider = new Collider();
  private readonly systems: RallySystem[] = [];
  private readonly scrapeEv = { car: '', slot: -1, side: 0, speed: 0 };
  private readonly bumpEv = { a: '', b: '', slotA: -1, slotB: -1, dv: 0 };
  private finishT = 0;
  /** Counts every change of `cars` and (wave B) of the other bodies: the scene rebuilds its draw list on a change. */
  roster = 0;
  private started = false;
  private completed = false;
  /** `RallyOpts.gridBack` (FIELD: the join's grid keeps it). */
  private readonly gridBack: boolean;
  /**
   * DEBUG (tools/shot3d.ts, the console; never the game's own input, never the sims): the player
   * slots whose car its driver drives (`setAutopilot`). Off by default.
   */
  readonly autopilot: [boolean, boolean] = [false, false];
  /**
   * Wave B (RULES, additive): where a player who joins during the race starts — `back` m behind the
   * last car in lane `lane` (the next safe point: no tunnel, no road works, a free lane); null (or no
   * hook) = wave A's 15 m behind it, in a lane away from it.
   */
  joinAt: ((last: CarState) => { back: number; lane: number } | null) | null = null;

  constructor(o: RallyRunnerOptions) {
    this.session = o.session;
    this.seed = o.seed >>> 0;
    this.difficulty = o.difficulty;
    this.startLap = Math.max(1, Math.min(RALLY_LAPS, o.lap ?? 1));
    this.track = o.track ?? rallyTrack();
    this.info = trackInfo(this.track);
    this.pads = o.pads;
    this.rng = new Rng(this.seed);
    this.fxRng = this.rng.fork('fx');
    this.gridBack = o.gridBack === true;
    const cam = o.cam ?? 'chase';
    this.cams = [cam, cam];
    this.signs = new SignTable(gantriesOf(this.track).length);
    this.race = { tick: 0, raceTick: -1, phase: 'grid', laps: this.laps, cars: this.cars, order: this.order, signs: this.signs };
    this.book.listen(this.events);
    // The grid (1P / P1 white, P2 green; FIELD grid.ts `gridPlan`): the estates among the rivals (`gridBack`: behind them).
    const slots = this.session.slots.filter((s) => s.joined).map((s) => s.index);
    const rivals = slots.length > 1 ? RIVALS_2P : RIVALS_1P;
    const pace = PACE[this.difficulty];
    // Wave B: FIELD's rally teams when registered (registry.ts `defineRallyTeams`), else the stub rivals.
    const teams = rallyTeams()?.rivals(rivals) ?? null;
    const addRival = (i: number): void => {
      if (teams && teams.length > 0) {
        const e = teams[i % teams.length];
        this.addCar(e.spec, -1, this.cars.length, pace * e.pace);
      } else this.addCar(RIVAL_SPECS[i % RIVAL_SPECS.length], -1, this.cars.length, pace * RIVAL_PACE[i % RIVAL_PACE.length]);
    };
    // FIELD (wave B, grid.ts): 1P starts 6th, 2P the estates 5th and 6th; `gridBack` behind every rival.
    let ri = 0;
    let pi = 0;
    for (const k of gridPlan(slots.length, rivals, this.gridBack)) {
      if (k === 'p') {
        const slot = slots[pi++];
        this.addCar(slot === 1 ? ESTATE_GREEN : ESTATE_WHITE, slot, this.cars.length);
      } else addRival(ri++);
    }
    this.sortPlaces();
    // Wave B: the lazy content's systems (traffic, the rules, the police) install themselves.
    for (const def of rallySystems()) def.install(this);
  }

  /**
   * A car on grid slot `g` (or behind the last car when the grid is full); `pace` for its driver;
   * `at`: its index in `cars` (default the end).
   */
  private addCar(spec: CarSpec, slot: number, g: number, pace = 1, at = this.cars.length): CarState {
    const t = this.track;
    const car: CarState = {
      id: spec.id,
      slot,
      team: spec.team,
      spec,
      pos: [0, 0, 0],
      yaw: 0,
      speed: 0,
      steer: 0,
      lap: this.startLap,
      dist: 0,
      s: 0,
      side: 0,
      place: g + 1,
      finished: false,
      finishTicks: -1,
      projected: false,
      lapTicks: [],
      lapStart: 0,
      partLaps: 0,
      fines: 0,
      phys: newPhys(handlingOf(spec)),
    };
    const driver = newDriver(t, 0, 0, slot >= 0 ? CRUISE_PACE : pace);
    this.cars.splice(at, 0, car);
    this.order.push(car);
    // Bodies: the cars stay in front of the wave B bodies (in the same order as `cars`).
    this.bodies.splice(at, 0, car);
    this.inputs.splice(at, 0, emptyRallyInput());
    this.drivers.splice(at, 0, driver);
    this.toGrid(car, driver, g);
    this.roster++;
    if (slot >= 0) {
      if (!this.players.some((p) => p.index === slot)) this.players.push({ index: slot, state: 'racing' });
      const rig = this.rigs[slot === 1 ? 1 : 0];
      rig.ready = false;
      rig.orbit = false;
      bindRig(car, rig);
    }
    return car;
  }

  /** Put a standing car on grid slot `g` (or behind the last slot when the grid is full). */
  private toGrid(car: CarState, d: Driver, g: number): void {
    const t = this.track;
    const grid = t.grid[g] ?? { s: t.grid[t.grid.length - 1].s - 8 * (g - t.grid.length + 1), side: g % 2 === 0 ? -2.5 : 2.5 };
    const sp = t.spline.sample(grid.s, this.tmp);
    const L = t.length;
    let off = grid.s - t.startS;
    off -= Math.floor(off / L + 0.5) * L;
    car.pos[0] = sp.p[0] + sp.r[0] * grid.side;
    car.pos[1] = sp.p[1];
    car.pos[2] = sp.p[2] + sp.r[2] * grid.side;
    car.yaw = yawOf(sp.t[0], sp.t[2]);
    car.speed = 0;
    car.steer = 0;
    car.dist = (this.startLap - 1) * L + off;
    car.s = t.spline.wrap(grid.s);
    car.side = grid.side;
    car.phys.slip = 0;
    car.phys.yawRate = 0;
    d.lane = laneOf(t, grid.side, car.s);
    d.side = grid.side;
  }

  /**
   * FIELD (grid.ts): put `cars` (and the index-aligned `bodies`, `inputs`, `drivers`) in the grid
   * order of `gridPlan` — the player estates by slot, the rivals in their order. The caller places
   * the cars that moved (`toGrid`).
   */
  private regrid(): void {
    const cars = this.cars;
    const players = cars.filter((c) => c.slot >= 0).sort((a, b) => a.slot - b.slot);
    const rivals = cars.filter((c) => c.slot < 0);
    const plan = gridPlan(players.length, rivals.length, this.gridBack);
    let pi = 0;
    let ri = 0;
    const order = plan.map((k) => (k === 'p' ? players[pi++] : rivals[ri++]));
    const idx = order.map((c) => cars.indexOf(c));
    const inputs = idx.map((i) => this.inputs[i]);
    const drivers = idx.map((i) => this.drivers[i]);
    for (let i = 0; i < order.length; i++) {
      cars[i] = order[i];
      this.bodies[i] = order[i];
      this.inputs[i] = inputs[i];
      this.drivers[i] = drivers[i];
    }
  }

  /** Take car i out of the race (a rival that gives its place to a joining player). */
  private removeCar(i: number): void {
    const car = this.cars[i];
    bindRig(car, null);
    this.cars.splice(i, 1);
    this.bodies.splice(i, 1);
    this.inputs.splice(i, 1);
    this.drivers.splice(i, 1);
    const o = this.order.indexOf(car);
    if (o >= 0) this.order.splice(o, 1);
    this.roster++;
  }

  /** The index of the last rival still racing (by distance; −1 when none). */
  private lastRival(): number {
    let best = -1;
    for (let i = 0; i < this.cars.length; i++) {
      const c = this.cars[i];
      if (c.slot >= 0 || c.finished) continue;
      if (best < 0 || c.dist < this.cars[best].dist) best = i;
    }
    return best;
  }

  get tick(): number {
    return this.race.tick;
  }

  get phase(): RaceState['phase'] {
    return this.race.phase;
  }

  /** Ticks left in the countdown (0 once the race runs). */
  get countdown(): number {
    return this.race.phase === 'grid' ? Math.max(0, COUNTDOWN_TICKS - this.race.tick) : 0;
  }

  /** The car of a player slot (null when that slot does not race). */
  carOf(slot: number): CarState | null {
    for (const c of this.cars) if (c.slot === slot) return c;
    return null;
  }

  player(slot: number): RallyPlayer | undefined {
    return this.players.find((p) => p.index === slot);
  }

  /** The race has no lives: nobody is ever out, so there is no continue. */
  continuePlayer(_slot: SlotIndex): boolean {
    return false;
  }

  /**
   * Player 2 joins (spec §10; §0 item 20: the field stays at 8 cars): the green estate. On the grid
   * it takes the second grid slot (the rivals move one slot back and the last rival leaves: the grid
   * of a 2P start). During the race the last rival still racing leaves, and the green estate starts
   * behind the last car, on the track, with a blink; its first lap is a partial one (`partLaps`: no
   * lap record), timed from the join.
   */
  joinPlayer(slot: SlotIndex, character: string): CarState | null {
    const had = this.carOf(slot);
    if (had) return had;
    if (this.race.phase === 'finish' || this.race.phase === 'done') return null;
    this.session.join(slot, character);
    const spec = slot === 1 ? ESTATE_GREEN : ESTATE_WHITE;
    const drop = this.cars.length >= RIVALS_1P + 1 ? this.lastRival() : -1;
    if (this.race.phase === 'grid') {
      // The last rival on the grid leaves; the player takes the second slot; the rivals move back.
      const was = this.cars.slice();
      if (drop >= 0) {
        let lastG = -1;
        for (let i = 0; i < this.cars.length; i++) if (this.cars[i].slot < 0) lastG = i;
        this.removeCar(lastG);
      }
      const car = this.addCar(spec, slot, this.cars.length);
      // FIELD (grid.ts): the grid of a 2P start (the estates on their slots, `gridBack` behind the
      // rivals); every car whose grid slot changed moves to its new slot (the grid cars stand).
      this.regrid();
      for (let i = 0; i < this.cars.length; i++) {
        const c = this.cars[i];
        if (was.indexOf(c) !== i) this.toGrid(c, this.drivers[i], i);
      }
      this.sortPlaces();
      return car;
    }
    // The last rival still racing leaves (the field stays at 8).
    if (drop >= 0) this.removeCar(drop);
    // Behind the last car, on the track (no teleport into the field), in a lane away from it — or
    // (RULES, wave B: `joinAt`) at the next safe point behind it (no tunnel, no road works, a free lane).
    let last = this.cars[0];
    for (const c of this.cars) if (c.dist < last.dist) last = c;
    const at = this.joinAt?.(last) ?? null;
    const back = at ? at.back : 15;
    const lane = at ? at.lane : last.side > 0 ? 0 : this.track.lanes - 1;
    const car = this.addCar(spec, slot, this.cars.length);
    const s = this.track.spline.wrap(last.s - back);
    const sp = this.track.spline.sample(s, this.tmp);
    const side = laneSide(this.track, lane, s);
    car.pos[0] = sp.p[0] + sp.r[0] * side;
    car.pos[1] = sp.p[1];
    car.pos[2] = sp.p[2] + sp.r[2] * side;
    car.yaw = yawOf(sp.t[0], sp.t[2]);
    car.s = s;
    car.side = side;
    car.dist = last.dist - back;
    car.lap = Math.max(1, 1 + Math.floor(car.dist / this.track.length));
    car.speed = Math.max(0, last.speed * 0.8);
    car.phys.blink = PHYS.recoverBlink;
    // Its lap clock starts now; the lap it joins in is a partial one (no lap record).
    car.lapStart = Math.max(0, this.race.raceTick);
    car.partLaps = 1;
    const d = this.drivers[this.cars.length - 1];
    d.side = side;
    d.lane = lane;
    this.sortPlaces();
    return car;
  }

  /** The race starts (the scene's enter): the session's mission. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.session.startMission(RALLY_ID);
  }

  /** Add a body to the road (wave B: traffic, police); it collides with the cars from the next tick. */
  addBody(b: RallyBody): void {
    if (this.bodies.includes(b)) return;
    this.bodies.push(b);
    this.roster++;
  }

  removeBody(b: RallyBody): void {
    const i = this.bodies.indexOf(b);
    if (i < this.cars.length) return;
    this.bodies.splice(i, 1);
    this.roster++;
  }

  /** Add a system that steps every race tick (after the cars moved, before the contacts). */
  addSystem(sys: RallySystem): void {
    this.systems.push(sys);
  }

  /**
   * DEBUG (captures along the lap; never the sims): the car of player `slot` drives itself through
   * its driver at `pace` (of its top speed; on the racing line), or (`on` false) the pad again.
   */
  setAutopilot(slot: number, on: boolean, pace = 0.94): void {
    const i = this.cars.findIndex((c) => c.slot === slot);
    if (i < 0) return;
    this.autopilot[slot === 1 ? 1 : 0] = on;
    const d = this.drivers[i];
    d.pace = on ? pace : CRUISE_PACE;
    d.racing = on;
  }

  /**
   * DEBUG (captures along the lap; never the sims): put player `slot`'s car `dist` metres past the
   * start line (laps count on: 1.5 laps = 1.5 × length) in lane `lane` (default: the second from the
   * left, P2 the third) at `speed` m/s, its camera behind it. The other cars stay where they are.
   */
  placeCar(slot: number, dist: number, speed = 0, lane = slot === 1 ? 2 : 1): void {
    const i = this.cars.findIndex((c) => c.slot === slot);
    if (i < 0) return;
    const car = this.cars[i];
    const t = this.track;
    const L = t.length;
    const s = t.spline.wrap(t.startS + dist);
    const sp = t.spline.sample(s, this.tmp);
    const ln = Math.max(0, Math.min(t.lanes - 1, lane));
    const side = laneSide(t, ln, s);
    car.pos[0] = sp.p[0] + sp.r[0] * side;
    car.pos[1] = sp.p[1];
    car.pos[2] = sp.p[2] + sp.r[2] * side;
    car.yaw = yawOf(sp.t[0], sp.t[2]);
    car.s = s;
    car.side = side;
    car.dist = dist;
    car.lap = Math.max(1, Math.min(this.laps, 1 + Math.floor(dist / L)));
    car.speed = speed;
    car.steer = 0;
    car.phys.slip = 0;
    car.phys.yawRate = 0;
    car.phys.stuck = 0;
    const d = this.drivers[i];
    d.lane = ln;
    d.side = side;
    const rig = this.rigs[slot === 1 ? 1 : 0];
    rig.ready = false;
    rig.orbit = false;
    this.sortPlaces();
  }

  /** Switch the camera of a player view (chase ↔ bumper; the pause menu, the race channel). */
  switchCam(slot: number): RallyCam {
    const i = slot === 1 ? 1 : 0;
    this.cams[i] = this.cams[i] === 'chase' ? 'bumper' : 'chase';
    return this.cams[i];
  }

  /** Place the camera of a player view (`out`); false when that slot has no car. */
  camera(slot: number, out: Cam3, split: boolean): boolean {
    const car = this.carOf(slot);
    if (!car) return false;
    const i = slot === 1 ? 1 : 0;
    rallyCam(this.cams[i], car, out, split, this.rigs[i]);
    return true;
  }

  /** One 60 Hz tick. */
  step(): void {
    if (!this.started) this.start();
    const race = this.race;
    race.tick++;
    const bodies = this.bodies;
    for (let i = 0; i < bodies.length; i++) {
      const ph = bodies[i].phys;
      if (ph.bumpT < 1e6) ph.bumpT++;
      if (ph.blink > 0) ph.blink--;
    }
    if (race.phase === 'grid') {
      this.moveCars(true);
      if (race.tick >= COUNTDOWN_TICKS) {
        race.phase = 'race';
        race.raceTick = 0;
        this.events.emit('start', { tick: race.tick });
      }
    } else if (race.phase === 'race') {
      race.raceTick++;
      this.moveCars(false);
      this.sortPlaces();
      let playersDone = true;
      for (const c of this.cars) if (c.slot >= 0 && !c.finished) playersDone = false;
      if (playersDone) this.endRace();
    } else {
      // The results (and after 'complete'): every car cruises on.
      this.moveCars(false);
      if (race.phase === 'finish') {
        this.finishT++;
        if (this.finishT >= FINISH_HOLD) this.complete();
      }
    }
    this.stepRigs();
  }

  /** Scenes call `update()` (the RingRunner's name). */
  update(): void {
    this.step();
  }

  /** Inputs, physics, the systems, contacts, slipstream, recovery and laps of one tick. */
  private moveCars(grid: boolean): void {
    const t = this.track;
    const L = t.length;
    const cars = this.cars;
    const bodies = this.bodies;
    const n = bodies.length;
    const racing = this.race.phase === 'race';
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      const inp = this.inputs[i];
      if (car.slot >= 0 && !car.finished && !this.autopilot[car.slot === 1 ? 1 : 0]) {
        const slot = car.slot === 1 ? 1 : 0;
        const pi = readRaceInput(this.pads[slot], this.padIn[slot]);
        if (pi.camera) this.switchCam(slot);
        this.rigs[slot].back = pi.lookBack;
        inp.steer = pi.steer;
        inp.gas = pi.gas;
        inp.brake = pi.brake;
        inp.handbrake = pi.handbrake;
        inp.camera = pi.camera;
        inp.lookBack = pi.lookBack;
      } else if (grid) {
        copyIdle(inp, this.idle);
      } else {
        drive(car, this.drivers[i], t, bodies, n, inp);
      }
      stepBody(car, inp, t, this.tmp, grid ? PHYS.creep : Infinity);
      if (car.phys.scrape === 1) this.emitScrape(car);
      // Stuck (a player or a rival), or a rival that has waited behind a standing car for 3 s.
      const stuck = racing && !car.finished && stuckStep(car, inp, this.tmp);
      if (stuck || (racing && car.slot < 0 && !car.finished && this.drivers[i].blockT >= PHYS.recoverTicks)) this.recover(i);
    }
    for (let k = 0; k < this.systems.length; k++) this.systems[k].step(this);
    const col = this.collider;
    col.collide(bodies, bodies.length, L);
    for (let k = 0; k < col.hits; k++) this.emitBump(col.hitA[k]!, col.hitB[k]!, col.hitDv[k]);
    for (let i = 0; i < cars.length; i++) draftStep(cars[i], bodies, bodies.length, L);
    if (!racing) return;
    // Laps: lap k ends at k·L metres from the start line.
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      while (!car.finished && car.dist >= car.lap * L) {
        const lapT = this.race.raceTick - car.lapStart;
        car.lapStart = this.race.raceTick;
        car.lapTicks.push(lapT);
        this.events.emit('lap', { car: car.id, slot: car.slot, lap: car.lap, ticks: lapT });
        car.lap++;
        if (car.lap > this.laps) this.finishCar(car, this.race.raceTick, false);
      }
    }
  }

  /** Put car i back on the track in the nearest free lane (spec §2 "Recovery"). */
  private recover(i: number): void {
    const car = this.cars[i];
    const t = this.track;
    const L = t.length;
    let best = -1;
    let bd = Infinity;
    for (let lane = 0; lane < t.lanes; lane++) {
      const side = laneSide(t, lane, car.s);
      let free = true;
      for (let k = 0; k < this.bodies.length && free; k++) {
        const o = this.bodies[k];
        if (o === car) continue;
        if (Math.abs(dsOf(car.s, o.s, L)) < 12 && Math.abs(o.side - side) < 2.5) free = false;
      }
      const d = Math.abs(side - car.side);
      if (free && d < bd) {
        bd = d;
        best = lane;
      }
    }
    if (best < 0) best = this.drivers[i].lane;
    const side = laneSide(t, best, car.s);
    recoverBody(car, t, side, this.tmp);
    const d = this.drivers[i];
    d.lane = best;
    d.side = side;
    d.blockT = 0;
    d.pullOut = 0;
    this.events.emit('recover', { car: car.id, slot: car.slot });
  }

  private emitScrape(b: RallyBody): void {
    if (this.events.count('scrape') === 0) return;
    const e = this.scrapeEv;
    e.car = b.id;
    e.slot = slotOf(b);
    e.side = b.phys.scrapeSide;
    e.speed = Math.abs(b.speed);
    this.events.emit('scrape', e);
  }

  private emitBump(a: RallyBody, b: RallyBody, dv: number): void {
    if (this.events.count('bump') === 0) return;
    const e = this.bumpEv;
    e.a = a.id;
    e.b = b.id;
    e.slotA = slotOf(a);
    e.slotB = slotOf(b);
    e.dv = dv;
    this.events.emit('bump', e);
  }

  /** The camera rigs of the player views (cosmetic). */
  private stepRigs(): void {
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      if (car.slot < 0) continue;
      const slot = car.slot === 1 ? 1 : 0;
      const rig = this.rigs[slot];
      stepRig(rig, car, this.info, rig.back && !car.finished, car.finished);
    }
  }

  private finishCar(car: CarState, ticks: number, projected: boolean): void {
    car.finished = true;
    car.finishTicks = ticks;
    car.projected = projected;
    car.lap = this.laps + 1;
    car.phys.ghost = true;
    // Cruise on in the right lane.
    const i = this.cars.indexOf(car);
    const d = this.drivers[i];
    d.pace = CRUISE_PACE;
    d.overtake = false;
    d.lane = this.track.lanes - 1;
    this.sortPlaces();
    this.events.emit('finish', { car: car.id, slot: car.slot, place: car.place, ticks, projected });
  }

  /**
   * The last player crossed the line (or debug F4): every car still racing gets a projected time
   * from its pace so far, in the current order (spec §2 "The finish").
   */
  private endRace(): void {
    const race = this.race;
    const L = this.track.length;
    const now = Math.max(0, race.raceTick);
    let prev = -1;
    for (const c of this.order) {
      if (c.finished) {
        prev = Math.max(prev, c.finishTicks);
        continue;
      }
      const startDist = (this.startLap - 1) * L;
      const done = c.dist - startDist;
      const pace = now > 0 && done > 0 ? done / now : (c.spec.topSpeed * 0.7) / 60;
      const left = this.laps * L - c.dist;
      const t = Math.max(prev + 1, now + Math.ceil(left / Math.max(0.05, pace)));
      prev = t;
      this.finishCar(c, t, true);
    }
    race.phase = 'finish';
    this.finishT = 0;
  }

  /** Debug F4 (and the tools): the race ends at once (places by the current order, projected times). */
  finishNow(): void {
    const race = this.race;
    if (race.phase === 'finish' || race.phase === 'done') return;
    if (race.phase === 'grid') {
      race.phase = 'race';
      race.raceTick = 0;
    }
    this.endRace();
    // The results hold short after a skip (the CI route).
    this.finishT = FINISH_HOLD - 30;
  }

  private complete(): void {
    if (this.completed) return;
    this.completed = true;
    this.race.phase = 'done';
    for (const slot of this.session.slots) {
      if (!slot.joined) continue;
      // The golden record of the race: first prize (PREP decision; wave B RULES may change it).
      const car = this.carOf(slot.index);
      if (car && car.place === 1) slot.mission.goldenRecord = true;
    }
    this.session.completed.push(RALLY_ID);
    this.events.emit('complete', { mission: RALLY_ID });
  }

  /** Is the race over (the results shown, 'complete' sent)? */
  get done(): boolean {
    return this.completed;
  }

  /** Places: finished cars by their time, then by lap and distance (insertion sort, no allocation). */
  private sortPlaces(): void {
    const o = this.order;
    for (let i = 1; i < o.length; i++) {
      const c = o[i];
      let j = i - 1;
      while (j >= 0 && ahead(c, o[j])) {
        o[j + 1] = o[j];
        j--;
      }
      o[j + 1] = c;
    }
    for (let i = 0; i < o.length; i++) {
      const c = o[i];
      if (c.place !== i + 1) {
        c.place = i + 1;
        if (c.slot >= 0) this.events.emit('place', { car: c.id, slot: c.slot, place: c.place });
      }
    }
  }

  /** The par of the whole race (ticks). */
  get parTicks(): number {
    return this.track.parLapTicks * (this.laps - this.startLap + 1);
  }

  /** The tally lines of a player slot (PLACE, TIME; wave B adds the rest). */
  raceLines(slot: number): RallyLine[] {
    return raceLines({ parTicks: this.parTicks, carCount: this.cars.length, parLapTicks: this.track.parLapTicks, book: this.book, cars: this.cars }, this.carOf(slot));
  }

  /** THE CRITICS SAY of a player slot (by place). */
  raceStars(slot: number): number {
    return raceStars(this.carOf(slot));
  }

  /** The mission after the race: none (the glitch bridge follows the tally). */
  nextMission(): string | null {
    return null;
  }

  /** A hash of the race state (every car's numbers and the clock). */
  stateHash(): number {
    let h = hashNum(0x811c9dc5, this.race.tick);
    for (const c of this.cars) {
      h = hashNum(h, c.pos[0]);
      h = hashNum(h, c.pos[1]);
      h = hashNum(h, c.pos[2]);
      h = hashNum(h, c.yaw);
      h = hashNum(h, c.speed);
      h = hashNum(h, c.steer);
      h = hashNum(h, c.phys.slip);
      h = hashNum(h, c.phys.yawRate);
      h = hashNum(h, c.dist);
      h = hashNum(h, c.lap);
      h = hashNum(h, c.place);
      h = hashNum(h, c.finishTicks);
    }
    // Wave B: the other bodies (traffic, police, props) once there are any.
    for (let i = this.cars.length; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      h = hashNum(h, b.pos[0]);
      h = hashNum(h, b.pos[2]);
      h = hashNum(h, b.yaw);
      h = hashNum(h, b.speed);
    }
    return h >>> 0;
  }

  report(): RallyReport {
    const joined = this.session.slots.filter((s) => s.joined);
    const cars = joined.map((s) => this.carOf(s.index));
    return {
      seed: this.seed,
      ticks: this.race.tick,
      complete: this.completed,
      players: (joined.length > 1 ? 2 : 1) as 1 | 2,
      difficulty: this.difficulty,
      laps: this.laps,
      places: cars.map((c) => c?.place ?? 0),
      lapTicks: cars.map((c) => [...(c?.lapTicks ?? [])]),
      finishTicks: cars.map((c) => c?.finishTicks ?? -1),
      fines: cars.map((c) => c?.fines ?? 0),
      score: joined.map((s) => linesTotal(this.raceLines(s.index))),
      stateHash: this.stateHash(),
      bestLap: cars.map((c) => (c ? bestLapTicks(c) : -1)),
      topKmh: cars.map((c) => Math.round((c?.phys.vmax ?? 0) * 3.6)),
      scrapes: cars.map((c) => c?.phys.scrapes ?? 0),
      bumps: cars.map((c) => c?.phys.bumps ?? 0),
      recoveries: cars.map((c) => c?.phys.recoveries ?? 0),
      overtakes: cars.map((c) => (c ? (this.book.peek(c.id)?.overtakes ?? 0) : 0)),
      nearMisses: cars.map((c) => (c ? (this.book.peek(c.id)?.nearMisses ?? 0) : 0)),
      finesEuros: cars.map((c) => (c ? (this.book.peek(c.id)?.finesEuros ?? 0) : 0)),
    };
  }

  /** Nothing to free yet (wave C: the radio and the engine loops). */
  stopLoops(_fade = 0): void {}

  dispose(): void {
    for (const c of this.cars) bindRig(c, null);
  }
}

/** Is car a ahead of car b? */
function ahead(a: CarState, b: CarState): boolean {
  if (a.finished !== b.finished) return a.finished;
  if (a.finished) return a.finishTicks < b.finishTicks;
  return a.dist > b.dist;
}

function slotOf(b: RallyBody): number {
  const s = (b as Partial<CarState>).slot;
  return typeof s === 'number' ? s : -1;
}

function copyIdle(out: RallyInput, a: Readonly<RallyInput>): void {
  out.steer = a.steer;
  out.gas = a.gas;
  out.brake = a.brake;
  out.handbrake = a.handbrake;
  out.camera = false;
  out.lookBack = false;
}

const F64 = new Float64Array(1);
const U32 = new Uint32Array(F64.buffer);

/** FNV-1a over the two 32-bit halves of a float64 (exact: the same value gives the same hash). */
function hashNum(h: number, v: number): number {
  F64[0] = v === 0 ? 0 : v;
  h = Math.imul(h ^ U32[0], 0x01000193);
  h = Math.imul(h ^ U32[1], 0x01000193);
  return h >>> 0;
}
