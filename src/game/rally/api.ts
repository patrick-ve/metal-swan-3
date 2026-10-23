/**
 * The race's types (docs/design/rally.md §2, §12.3, §12.5; docs/api/rally.md "A. Wave A
 * contracts"). Pure: the sim, the scenes, the content and the tools share them.
 *
 * Space (engine/view3d.ts): y up, metres, radians; yaw + = a left turn; forward(yaw) =
 * (sin yaw, 0, cos yaw). Speeds in metres per second, distances along the track in metres.
 */
import type { Spline3 } from '../../engine/r3/spline';
import type { Vec3 } from '../../engine/r3/vec';
import type { Cam3, DrawItem, Mesh3, TexturePage } from '../../engine/view3d';
import type { Difficulty } from '../session';
import type { BodyKind, RallyCam } from './ids';
import type { SignTable } from './signs';

/**
 * How a car drives (spec §6: mass, top speed, grip). The fields after `grip` are OPTIONAL (DRIVE,
 * additive): absent = the defaults of `handlingOf` (rally/physics.ts).
 */
export interface CarSpec {
  readonly id: string;
  /** The team name (a rival's livery text; the estates: '1P' / '2P' squads). */
  readonly team: string;
  /** The model id (registry.ts `rallyModel`). */
  readonly model: string;
  /** A palette swap of the model (a CLUT row of its page); absent = the model's own. */
  readonly clutRow?: number;
  /** kg. */
  readonly mass: number;
  /** m/s (220 km/h ≈ 61 m/s). */
  readonly topSpeed: number;
  /** m/s² at standstill under full gas. */
  readonly accel: number;
  /** 0..1 (1 = the estates). */
  readonly grip: number;
  /** W/kg: the power-to-weight above the traction limit (default `accel` × 0.4 × `topSpeed`). */
  readonly power?: number;
  /** m/s² at full brake (default 11). */
  readonly brake?: number;
  /** Lateral grip of the front and rear axle (m/s²; default 10.5 × `grip`, the rear 5 % more). */
  readonly gripFront?: number;
  readonly gripRear?: number;
  /** Front-wheel drive (the estates; default true): full gas costs front grip (understeer). */
  readonly fwd?: boolean;
  /** The body (m): length, width, wheelbase (default 4.7, 1.8, 2.7). */
  readonly length?: number;
  readonly width?: number;
  readonly wheelbase?: number;
}

/** A CarSpec resolved for the physics (rally/physics.ts `handlingOf`); every field set. */
export interface Handling {
  readonly mass: number;
  readonly topSpeed: number;
  /** m/s²: the traction limit (full gas at low speed). */
  readonly accel: number;
  /** W/kg. */
  readonly power: number;
  /** a = −drag · v·|v| (1/m; from the power and the top speed). */
  readonly drag: number;
  /** m/s²: rolling resistance. */
  readonly roll: number;
  readonly brake: number;
  /** m/s²: the handbrake's own deceleration. */
  readonly handbrake: number;
  readonly gripFront: number;
  readonly gripRear: number;
  readonly fwd: boolean;
  readonly wheelbase: number;
  readonly halfLen: number;
  readonly halfWid: number;
  /** kg·m²: the yaw inertia (collisions). */
  readonly inertia: number;
  /** 1/s: how fast the yaw rate follows the wheel (heavier = slower). */
  readonly yawResp: number;
  /** How much slipstream this body gives a car behind it (1 = a car; a lorry more). */
  readonly wake: number;
}

/**
 * The physics state of a body (rally/physics.ts; DRIVE). Mutable; the sim owns it. Everything here
 * is deterministic (it may feed the state hash); `pitch`, `roll`, `rev` and `gear` are only drawn
 * or heard.
 */
export interface CarPhys {
  readonly h: Handling;
  /** m/s sideways in the car's frame (+ = sliding to the right). */
  slip: number;
  /** rad/s (+ = turning left). */
  yawRate: number;
  /** The body: pitch (+ = nose up, the road's slope) and roll (+ = right side down, the lean). */
  pitch: number;
  roll: number;
  /** Lateral acceleration of the last tick (m/s², + = to the left). */
  lat: number;
  /** Ticks in contact with a barrier (> 0; 1 = a new scrape), or < 0: ticks to go before a touch is a new scrape; 0 free. The side: −1 left, 1 right, 0 none. */
  scrape: number;
  scrapeSide: number;
  /** Ticks since the last car–car bump (the event's cooldown). */
  bumpT: number;
  /** Ticks stuck (standing still while trying to move, or facing the wrong way): a recovery at 180. */
  stuck: number;
  /** Ticks left of the recovery blink (no car–car contact; the scene may blink the car). */
  blink: number;
  /** Ticks left of the recovery hold (the input is ignored, the car stands). */
  hold: number;
  /** Ticks left of a spin after a hard hit (the yaw rate dies out slowly). */
  spin: number;
  /** The slipstream 0..1 (behind a car in the same lane). */
  draft: number;
  /** No car–car contact (a finished car, a car in its recovery blink). */
  ghost: boolean;
  /** Cosmetic: engine revs 0..1 and the gear 1..5 (wave C's engine sound; −1 = reverse). */
  rev: number;
  gear: number;
  /** The road's slope along the heading (sin; + = uphill) under the body last tick (gravity). */
  grade: number;
  /** Ticks pressed against the car ahead (+1 per contact tick, −1 per free one): the locked recovery at 180 (physics.ts `PHYS.lockTicks`). */
  lock: number;
  /** Counters for the report: barrier scrapes, car–car bumps, recoveries; the top speed (m/s). */
  scrapes: number;
  bumps: number;
  recoveries: number;
  vmax: number;
}

/**
 * Anything that drives on the road and collides (rally/physics.ts): the race cars (`CarState`) and,
 * from wave B, traffic and police (`RallyRunner.addBody`).
 */
export interface RallyBody {
  readonly id: string;
  /** World position (the centre of the body on the road). */
  readonly pos: Vec3;
  yaw: number;
  /** m/s along its forward vector (negative = reversing). */
  speed: number;
  /** The steering wheel −1 (full right) … 1 (full left), after the steering rate. */
  steer: number;
  /** The arc length of the spline under the body (0..length). */
  s: number;
  /** The lateral offset from the centre line (m, + = right). */
  side: number;
  /** Metres driven along the track (signed progress; laps for the race cars). */
  dist: number;
  readonly phys: CarPhys;
  /**
   * Wave B (PREP, additive; docs/api/rally.md "B.3"): what it is. Absent on the race cars (the
   * scene reads `slot`: 'player' or 'rival'); FIELD's traffic 'traffic', RULES' police 'police' and
   * road works 'prop'.
   */
  kind?: BodyKind;
  /** Wave B: the model the scene draws for a body that is not a race car (registry.ts `rallyModel`). */
  model?: string;
  /** Wave B: a palette swap of that model (a CLUT row; the traffic's colours). */
  clutRow?: number;
  /** Wave B: the lamps (ids.ts `BODY_LIGHT` bits; 0 / absent = none). */
  lights?: number;
  /** Wave B: a parked body of a pool (not drawn; its owner also sets `phys.ghost`: no contact). */
  hidden?: boolean;
}

/** One car in the race (mutable; the runner owns it). */
export interface CarState extends RallyBody {
  readonly id: string;
  /** The player slot that drives it: 0 / 1, or −1 for an AI car. */
  readonly slot: number;
  readonly team: string;
  readonly spec: CarSpec;
  /** World position (the centre of the car on the road). */
  readonly pos: Vec3;
  yaw: number;
  /** m/s along its forward vector (negative = reversing). */
  speed: number;
  /** The steering wheel −1 (full right) … 1 (full left), after the steering rate. */
  steer: number;
  /** The current lap (1-based; laps + 1 once finished). */
  lap: number;
  /** Metres driven along the track from the start line (negative on the grid). */
  dist: number;
  /** The arc length of the spline under the car (0..length). */
  s: number;
  /** The lateral offset from the centre line (m, + = right). */
  side: number;
  /** 1-based place (by lap, then distance; finished cars by their time). */
  place: number;
  finished: boolean;
  /** Race ticks at the finish (−1 = not yet; projected for a car stopped by the end of the race). */
  finishTicks: number;
  /** The finish was projected (the race ended before the car crossed the line). */
  projected: boolean;
  /** Race ticks of each finished lap. */
  readonly lapTicks: number[];
  /** The race tick its current lap started (GO = 0; a mid-race join: the join tick). */
  lapStart: number;
  /** The leading entries of `lapTicks` that are partial laps (a mid-race join): no lap record (score.ts `bestLapTicks`). */
  partLaps: number;
  /** Fines (wave B: cameras, red X). */
  fines: number;
  /** The physics state (DRIVE; additive). */
  readonly phys: CarPhys;
}

export type RacePhase = 'grid' | 'race' | 'finish' | 'done';

/** The race as a whole. */
export interface RaceState {
  /** Ticks since the runner started (the countdown included). */
  tick: number;
  /** Ticks since GO (−1 during the countdown). */
  raceTick: number;
  phase: RacePhase;
  readonly laps: number;
  readonly cars: readonly CarState[];
  /** The cars by place (index 0 = the leader). */
  readonly order: readonly CarState[];
  /**
   * Wave B (PREP, additive; docs/api/rally.md "B.2"): the matrix signs of every gantry (RULES sets
   * them, WORLD draws them). The runner always makes it; optional only for hand-made states.
   */
  readonly signs?: SignTable;
}

/** Wave B: what a fine was for (spec §5). */
export type FineKind = 'camera' | 'zone' | 'redx';

/**
 * Wave B (PREP, additive; docs/api/rally.md "B.4"): the payloads of the wave-B events on the
 * runner's one emitter (`runner.events`; runner.ts `RallyRunnerEvents` extends this). `car` / `other`
 * / `police` are body ids; `slot` the player slot of `car` (−1 = an AI car). Sections are the track's
 * section ids ('zuidas', 'ring-west', …). The radio (wave C) and the HUD listen; the sim never reads
 * them back (emit nothing that the state depends on).
 */
export interface RallyEventsB {
  /** A speed camera, the average-speed zone's end gantry or a red X caught a car (the white flash). km/h. */
  flash: { car: string; slot: number; speed: number; limit: number; where: string; kind: FineKind };
  /** A fine (after a flash; `CarState.fines` is already counted). */
  fine: { car: string; slot: number; kind: FineKind; euros: number };
  /** A car drove under a red X (its lane closed ahead): the fine follows. */
  redx: { car: string; slot: number; gantry: number; lane: number };
  /** A police car pulled a racer over (3 s on the hard shoulder). */
  pulledOver: { car: string; slot: number; police: string };
  /** The pulled-over racer drives on. */
  released: { car: string; slot: number };
  /** The police joined (lap 3): how many are on the road now. */
  policeActive: { count: number };
  /** Road works ahead (lap 2): the section and its closed lanes (0 = the left lane). */
  roadworksAhead: { section: string; lanes: readonly number[] };
  /** The spitsstrook opened (lap 3: green arrows over the hard shoulder). */
  spitsstrookOpen: { lap: number };
  /** A jam formed (lap 3's rush hour). */
  jam: { section: string };
  /** A racer passed a rival (once per rival per lap: the emitter checks it). */
  overtake: { car: string; slot: number; other: string };
  /** A racer passed traffic close at speed (km/h; above 150 km/h it scores). */
  nearMiss: { car: string; slot: number; other: string; speed: number };
  /** A racer's new best lap (race ticks). */
  bestLap: { car: string; slot: number; ticks: number };
  /** A car entered / left a tunnel tube (the radio's static). */
  tunnelIn: { car: string; slot: number; name: string };
  tunnelOut: { car: string; slot: number; name: string };
  /** A body honked (traffic at a racer, a team horn). */
  honk: { car: string; slot: number };
  /** A hard hit on traffic (the big speed loss, the spin; the traffic car stops with its hazards). */
  crash: { car: string; slot: number; other: string };
}

/** What a race starts with (the URL / the card / the sim). */
export interface RallyOpts {
  seed: number;
  difficulty: Difficulty;
  players: 1 | 2;
  /** `?lap=`: start at this lap (its time of day, traffic and event). Default 1. */
  lap?: 1 | 2 | 3;
  /** `?cam=`: the starting camera. Default chase. */
  cam?: RallyCam;
  /**
   * Additive opt-in (off by default; the sims' overtaking gate, `npm run sim -- --grid-back`): the
   * player estates start at the back of the grid, behind the rivals.
   */
  gridBack?: boolean;
}

/**
 * The race input of one slot (spec §12.5): the bot and the pads drive through it. Steer −127 (full
 * right) … 127 (full left), gas and brake 0…127, the handbrake held, the camera switch (pressed this
 * tick) and the look back (held). The engine's race channel (`VirtualPad.race`, engine/race-input.ts
 * `RaceInput`) has the same shape.
 */
export interface RallyInput {
  steer: number;
  gas: number;
  brake: number;
  handbrake: boolean;
  camera: boolean;
  lookBack: boolean;
}

export function emptyRallyInput(): RallyInput {
  return { steer: 0, gas: 0, brake: 0, handbrake: false, camera: false, lookBack: false };
}

/** The drivable band at one arc length: the barrier faces, m from the centre line (+ = right). */
export interface TrackBounds {
  /** ≤ 0: the left barrier (the central reservation). */
  left: number;
  /** ≥ 0: the right barrier (the outer edge). */
  right: number;
}

/** A grid slot: an arc length and a lateral offset (m, + = right). */
export interface GridSlot {
  readonly s: number;
  readonly side: number;
}

/**
 * The track (content/rally/track `buildTrack`): the centre-line spline and the meshes. Wave A
 * TRACK fills it from the A10 table; the stub is an oval. Fields may be ADDED (segments, AI lines,
 * tunnels); the ones below stay.
 */
export interface RallyTrack {
  readonly id: string;
  readonly spline: Spline3;
  /** = spline.length (m). */
  readonly length: number;
  /** From the centre line to the barrier face on each side (m). */
  readonly halfWidth: number;
  readonly lanes: number;
  readonly laneWidth: number;
  /** The start / finish line (an arc length). */
  readonly startS: number;
  /** 8 grid slots, pole first (behind the line). */
  readonly grid: readonly GridSlot[];
  /** The par lap (ticks) for the tally's TIME line. */
  readonly parLapTicks: number;
  /** Everything static the view draws (wave A: all of it; TRACK adds segments and culling). */
  readonly meshes: readonly Mesh3[];
  readonly pages: readonly TexturePage[];
  readonly items: readonly DrawItem[];
  /**
   * OPTIONAL (TRACK; DRIVE reads it): the barrier faces at arc length s. Absent = ±`halfWidth`
   * everywhere. Must be pure and allocation-free (the physics calls it every tick for every car).
   */
  bounds?(s: number, out: TrackBounds): TrackBounds;
  /**
   * OPTIONAL (TRACK): the side offset (m, + = right) of lane `i` (0 = the leftmost, `lanes` − 1 =
   * the rightmost) at arc length s. Absent = `lanes` lanes of `laneWidth` centred on the centre line.
   */
  laneSide?(i: number, s: number): number;
  /** OPTIONAL (TRACK's A10 has it): the side offset of lane `i`'s centre (0 = the left lane); used when `laneSide` is absent. */
  laneOffset?(lane: number): number;
  /** OPTIONAL (TRACK's A10 has it): the racing line's side offset at s (the sim bot follows it on straights and bends). */
  racingAt?(s: number): number;
  /**
   * OPTIONAL (TRACK's A10 has it; INTEGRATE's scene uses it): a culler for one view. The scene makes
   * one per view; `fill` writes the visible static items (near → far; the level of detail by
   * distance) into `out` from index `from`, sets `out.length` and returns the count. Absent = the
   * scene draws every item of `items` (the stub track).
   */
  createView?(): RallyTrackView;
}

/** A view's culler of the track (`RallyTrack.createView`; TRACK's `TrackView`). Allocation-free per frame. */
export interface RallyTrackView {
  fill(cam: Readonly<Cam3>, aspect: number, far: number, out: DrawItem[], from?: number): number;
  /** The last fill's triangles and draw items. */
  readonly tris: number;
  readonly draws: number;
}

/** A car model (content/rally/models): its meshes (all drawn with the car's matrix) and pages. */
export interface RallyModel {
  readonly id: string;
  readonly meshes: readonly Mesh3[];
  readonly pages: readonly TexturePage[];
  /** The mesh ids drawn for one car, in order (body, wheels, ...). */
  readonly parts: readonly string[];
  /** Triangles of one car (the budget, spec §7.3). */
  readonly tris: number;
}

/** What the runner reports (the sim adds errors, warnings and timing: src/sim/headless-rally.ts). */
export interface RallyReport {
  seed: number;
  ticks: number;
  complete: boolean;
  players: 1 | 2;
  difficulty: Difficulty;
  laps: number;
  /** Per joined player slot: the place (0 = not placed). */
  places: number[];
  /** Per joined player slot: the race ticks of each lap. */
  lapTicks: number[][];
  /** Per joined player slot: the race ticks at the finish (−1 = not finished). */
  finishTicks: number[];
  fines: number[];
  /** Per joined player slot: the race score (the tally's lines, before the difficulty). */
  score: number[];
  /** A hash of every car's state (the same seed gives the same hash; drawing never changes it). */
  stateHash: number;
  /** DRIVE (additive), per joined player slot: the best lap (race ticks; −1 none), the top speed (km/h), barrier scrapes, car–car bumps, recoveries. */
  bestLap?: number[];
  topKmh?: number[];
  scrapes?: number[];
  bumps?: number[];
  recoveries?: number[];
  /** Wave B (PREP, additive), per joined player slot: overtakes, near misses, the fines in euros (score.ts `ScoreBook`). */
  overtakes?: number[];
  nearMisses?: number[];
  finesEuros?: number[];
}
