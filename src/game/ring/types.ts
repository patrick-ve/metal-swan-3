/**
 * Data types and tuning of mission `ring` (docs/design/ring.md §2–§4, §13; docs/api/ring.md §2).
 *
 * Coordinates: the ring simulates a top-down plane. World x = road distance (traffic drives
 * right), world y = the PLANE Y: the line where a thing touches the road on screen (its depth;
 * lanes.ts). Height above the road is only drawn (`lift`). The camera moves right at `roadSpeed`
 * all the time; the PLAN DISTANCE `planDist` (the plan coordinate of the view's left edge)
 * advances with it except while the plan is locked (a boss) or held (every player out).
 *
 * `RingPlan` is FROZEN at the end of the core stage: the generator (GEN) may only add optional
 * fields. Every spawn decision is in the plan (`world.rng` only drives AI), so a P2 join never
 * changes the ring.
 */
import type { Difficulty } from '../session';
import type { RingLandmarkId, RingRoute } from './ids';

export type { RingLandmarkId } from './ids';

/** Chunk types (spec §13). `bridge` and `tunnel` only at their landmarks. */
export type RingChunkType =
  | 'cruise'
  | 'traffic'
  | 'jam'
  | 'roadworks'
  | 'gantry'
  | 'speedcam'
  | 'avgzone'
  | 'convoy'
  | 'caravan'
  | 'parcel'
  | 'merge'
  | 'rest'
  | 'bridge'
  | 'tunnel';

/** A fixed landmark set piece (spec §4). */
export interface RingLandmark {
  readonly id: RingLandmarkId;
  /** Scenery district of the skyline layers ('oost', 'zuid', 'port', 'tunnel' …). */
  readonly district: string;
  /** Plan distance (px) where the set piece begins, and its length (px). */
  readonly start: number;
  readonly length: number;
  /** Open lanes along the set piece: 3 = the near lane (lane 4) is closed (tunnels). */
  readonly lanes: 3 | 4;
  /** A tunnel (Coentunnel, Zeeburgertunnel): darkness, light bands, 3 lanes, no gantries. */
  readonly tunnel?: boolean;
  /** Exit numbers on its signs, e.g. ['S113', 'S112'] (scenery flavour). */
  readonly exits?: readonly string[];
  // ---- GEN additions (optional; landmarks.ts fills them) --------------------------------------
  /** Display name ('A10 OOST', 'COENTUNNEL'). */
  readonly name?: string;
  /** Skyline district of the generated road after the set piece (the stretch's road). */
  readonly roadDistrict?: string;
  /** Hectometre km at the set-piece start (0 … 32.3; the posts wrap to 0 at Coenplein). */
  readonly km?: number;
  /** Speed limit on its signs (km/h): 80 on A10 West, else 100. */
  readonly limit?: 80 | 100;
  /** The motorway that joins at its interchange ('A2', 'A4', 'A8'). */
  readonly junction?: string;
  /** Names of its bridge / tunnel (scenery signs). */
  readonly bridge?: string;
  readonly tunnelName?: string;
}

/**
 * A stretch: a landmark plus the generated road after it, up to the next landmark. Its id is the
 * landmark id; it is also the tier-4 art section (art-def.ts).
 */
export interface RingStretch {
  readonly id: RingLandmarkId;
  readonly index: number;
  /** Plan distance of its first and one past its last pixel. */
  readonly start: number;
  readonly end: number;
  // ---- GEN additions (optional) ----------------------------------------------------------------
  /** Skyline district of its generated road (= its landmark's `roadDistrict`). */
  readonly district?: string;
  /** Planned ticks of the stretch at the planned speeds (director.ts `chunkTicks`). */
  readonly ticks?: number;
}

/**
 * One chunk of road (about 512 px). The generator's chunks cover [0, length) without gaps: the
 * landmark set pieces are chunks too (`setPiece: true`, typed `bridge` / `tunnel` / `cruise` /
 * `merge` with a `part` name), the generated road between them follows the grammar of
 * director.ts.
 */
export interface RingChunk {
  readonly type: RingChunkType;
  readonly start: number;
  readonly length: number;
  /** The stretch it belongs to. */
  readonly stretch: RingLandmarkId;
  /** Open lanes (default 4; 3 = lane 4 closed). */
  readonly lanes?: 3 | 4;
  /** Lanes (1 far … 4 near) closed for its length (a gantry's red X, road works). */
  readonly closed?: readonly number[];
  /** Threat budget the director spent on it. */
  readonly budget?: number;
  // ---- GEN additions (optional) ----------------------------------------------------------------
  /** Planned road speed (px/tick) over it; default `RING.cruiseSpeed` (a jam crawls). */
  readonly speed?: number;
  /** Planned ticks the road stands still inside it (a jam's stop) and where (px from `start`). */
  readonly hold?: number;
  readonly holdAt?: number;
  /**
   * Sub-part name: set pieces ('boarding', 'interchange', 'rozenoordbrug', 'coentunnel',
   * 'offramp' …), multi-chunk set-ups ('warn' / 'closure' of a gantry, 'jam-warn' before a jam),
   * the stretch's last chunk 'run-in' (a calm start for `?section=`).
   */
  readonly part?: string;
  /** Inside a landmark's fixed set piece (not generated). */
  readonly setPiece?: boolean;
  /** A scene (the boarding, the off-ramp): no enemies, outside the 4-second rule. */
  readonly scene?: boolean;
  /** The last (highest) chunk of a phrase; a `rest` follows it. */
  readonly peak?: boolean;
  /** Tier of its budget (0 … 3): the chunk types and wave templates it may hold. */
  readonly tier?: number;
  /** Skyline district (scenery). */
  readonly district?: string;
  /** Speed limit on its signs (km/h). */
  readonly limit?: 80 | 100;
  // ---- Revision R (optional) -------------------------------------------------------------------
  /**
   * A fixed chunk AFTER the stretch's generated road (landmarks.ts `tail`; the short route's `zuid`:
   * the boss chunk `part: 'boss'` and the `final-jam` scene chunk). Outside the 4-second rule, no
   * plan waves, hostages or direction signs in it.
   */
  readonly tail?: boolean;
}

/** A direction sign spot (scenery): the S-shield of `exit` at plan distance `at`. */
export interface RingExitSign {
  readonly at: number;
  /** 'S113' … */
  readonly exit: string;
  /** The place name on the sign ('WATERGRAAFSMEER'), '' when none. */
  readonly name: string;
  readonly stretch: RingLandmarkId;
}

/**
 * A plan entry (spec §13: the plan holds every spawn decision).
 * - from 'road' (default): the entity belongs at road point `at`; it is spawned when that point is
 *   `RING.spawnAhead` px beyond the view's right edge (or at once when a start lands past it) at
 *   world x = the world x of `at`.
 * - from 'behind': it enters from behind: spawned when the view's LEFT edge reaches `at`, at
 *   `RING.spawnBehind` px left of the view.
 * `lane` (1 far … 4 near) or an exact plane `y`; `params` go to `world.spawn` unchanged.
 * Ids that are not registered are skipped (counted in `RingReport.skipped`), never an error.
 */
export interface RingSpawn {
  readonly at: number;
  readonly id: string;
  readonly lane?: number;
  readonly y?: number;
  readonly from?: 'road' | 'behind';
  readonly params?: Readonly<Record<string, unknown>>;
}

/** A boss slot: at `at` the boss spawns (registered ids only) and locks the plan until it is gone. */
export interface RingBossSlot {
  readonly at: number;
  readonly id: string;
  readonly landmark: RingLandmarkId;
  /** Lane of the spawn (default 1) and params. */
  readonly lane?: number;
  readonly params?: Readonly<Record<string, unknown>>;
}

/** The whole generated ring (`planRing(seed, difficulty)`, a pure function of its arguments). */
export interface RingPlan {
  readonly seed: number;
  readonly difficulty: Difficulty;
  /** Plan length (px): reaching it ends the ring (the exit hook, then MISSION COMPLETE). */
  readonly length: number;
  /** Every landmark of the plan, in order (a stub plan may hold fewer than the ten). */
  readonly landmarks: readonly RingLandmark[];
  /** One per landmark, in order, covering [0, length). */
  readonly stretches: readonly RingStretch[];
  readonly chunks: readonly RingChunk[];
  readonly spawns: readonly RingSpawn[];
  readonly bosses: readonly RingBossSlot[];
  /**
   * Driver order: squad hero ids shuffled by the plan rng. The runner gives each slot the first
   * one nobody plays and the other slot does not drive (spec §0 row 23: one driver per player for
   * the whole level).
   */
  readonly drivers: readonly string[];
  /** Plan distance of the one golden record (a spawn in `spawns`); -1 = none. */
  readonly goldenRecord: number;
  /** Hostages per stretch id (the tally's `MissionDef.hostages` over the route). */
  readonly hostages: Readonly<Record<string, number>>;
  // ---- GEN additions (optional) ----------------------------------------------------------------
  /** Planned ticks of the whole ring at the planned speeds (normalised to 9:00 ± 5 %). */
  readonly ticks?: number;
  /** Direction-sign spots with their S-exits (scenery). */
  readonly exitSigns?: readonly RingExitSign[];
  /** The content wave the plan was made for ('A' = wave-A ids only, 'B' = wave-B templates too). */
  readonly wave?: 'A' | 'B';
  // ---- Revision R (optional) -------------------------------------------------------------------
  /** The route (docs/design/ring.md §R.2); absent = 'full' (plans made before revision R). */
  readonly route?: RingRoute;
}

/**
 * What a view (view.ts, light.ts) reads from the runner each tick and frame. The runner passes
 * itself.
 */
export interface RingViewHost {
  readonly plan: RingPlan;
  /** Runner ticks (60 per second). */
  readonly ticks: number;
  /** Camera left edge (world px). */
  readonly camX: number;
  /** Plan distance of the view's left edge. */
  readonly planDist: number;
  /** Camera speed (px/tick). */
  readonly roadSpeed: number;
  /** Index of the current stretch in `plan.stretches`. */
  readonly stretchIndex: number;
  /** Plan distance of a world x near the view. */
  planX(worldX: number): number;
  /** World x of a plan distance near the view. */
  worldX(planX: number): number;
}

/** Tuning of the ring (spec numbers; builders may tune with a note in their report). */
export const RING = Object.freeze({
  /** Camera speed when cruising (px/tick). */
  cruiseSpeed: 3,
  /** The road speed eases toward its target by this much per tick (a jam brakes, it comes back). */
  speedAccel: 0.04,
  /** Every player out: the scroll holds (eases to 0 by this much per tick). */
  holdDecel: 0.15,
  /** Plan entries are spawned this far beyond the right edge … */
  spawnAhead: 64,
  /** … or this far left of the view ('behind'). */
  spawnBehind: 48,
  /** `?section=<landmark>` starts this far before the landmark (a short run-in). */
  runIn: 384,
  /** World length past the plan end kept as road (boss locks keep the road scrolling). */
  roadTail: 200_000,
  /** Wagon armour (cells, spec §3). */
  wagonCells: 10,
  /** Invulnerable ticks after a hit that cost armour. */
  wagonHitInvuln: 30,
  /** A lane change takes about this many ticks (spec §3). */
  laneChangeTicks: 14,
  /** Forward / back on screen (px/tick) and the screen band of the wagon's centre (spec §3: x 24–300). */
  wagonSideSpeed: 1.6,
  wagonSideAccel: 0.25,
  screenMinX: 70,
  screenMaxX: 300,
  /** JUMP = swerve: one lane in this many ticks, no damage for `swerveInvuln`, then a cooldown. */
  swerveTicks: 6,
  swerveInvuln: 8,
  swerveCooldown: 30,
  /** Wreck → a fresh wagon after this many ticks, drives in from the left over `driveInTicks`. */
  respawnTicks: 60,
  driveInTicks: 60,
  /** Blinking invulnerability of a fresh wagon (spec §3). */
  driveInBlink: 120,
  /** Spin-out of a wreck before it is gone (ticks). */
  wreckTicks: 90,
  /** A speed-camera fine (spec §7.4: −500, never below 0). */
  finePoints: 500,
  /** Height of the hero's gun above the road (px): his shots are drawn this much higher. */
  heroGunLift: 30,
  /** Start screen x of each slot's wagon centre and lane. */
  startX: [150, 110] as readonly number[],
  startLane: [3, 4] as readonly number[],
});

// ---- Revision R: the world events of the ZWAAN train (content/ring/zwaan/, docs/api/ring.md) -----
declare module '../../engine/world' {
  interface WorldEvents {
    /**
     * A part of the ZWAAN train: its fight starts (`start`: its first phase) or it is beaten
     * (`beaten`: its death sequence begins). Emitted by the controller (`ring-zwaan`).
     */
    ringTrainPart: { part: string; index: number; phase: 'start' | 'beaten' };
    /**
     * The whole train is beaten (the cab's death): the ring's boss end (`bossEndTick`), the music
     * back to the stage theme, the boss speed bonus. Emitted once by the controller.
     */
    ringTrainDone: { controller: import('../../engine/entity').Entity };
  }
}
