/**
 * SWAN-3 numbers (docs/design/swan-mount/feel.md §14) and the art fallbacks the logic needs while
 * a sprite frame has no named point (look.md §8, §10, §11.3, §13.7). The Swan keeps her own
 * numbers here: `src/game/tuning.ts` asks content to keep its numbers in its own module (no
 * `TUNING.swan` block). Points and boxes are (x, y[, w, h]) from her feet anchor with her facing
 * right (+x forward, −y up); they are mirrored when she faces left.
 *
 * Engine maths (semi-implicit Euler: vy += g, then y += vy): the jump vy −5.9 with gravity 0.18
 * peaks 93.8 px up (formula 5.9² / 0.36 = 96.7 px) after 32 ticks and lands after 65 ticks.
 */

type Box = readonly [number, number, number, number];
type Pt = readonly [number, number];

function deepFreeze<T extends object>(o: T): T {
  for (const v of Object.values(o)) if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v as object);
  return Object.freeze(o);
}

export const SWAN = deepFreeze({
  // ---- ground (feel §3)
  /** Top run speed and the trot that ends the fast first stage of the start. */
  runMax: 2.6,
  trotSpeed: 1.5,
  /** 0 → 1.5 in 6 ticks, then 1.5 → 2.6 in 18.3 ticks (full sprint after 25 ticks, 45 px). */
  accel: 0.25,
  accelHigh: 0.06,
  /** No direction held: 2.6 → 0 in 13 ticks, 17 px. */
  brake: 0.2,
  /** A reverse at ≥ 1.6 px/tick is a SKID: 2.6 → 0.5 at 0.3 (7 ticks, 10.9 px), then she flips. */
  skidMin: 1.6,
  skidDecel: 0.3,
  skidEnd: 0.5,
  /** Up + back: facing locked, back-pedal. */
  backpedalMax: 1.2,
  /** Down + left/right: the waddle; a crouch at a sprint is a belly slide down to it. */
  crouchSpeed: 0.8,
  /** Brake and skid on `iceRanges` (m3, in socks): 2.6 → 0 in 52 ticks, 68 px. */
  iceDecel: 0.05,
  stepUp: 12,
  snapDown: 8,
  bodyW: 28,
  bodyH: 48,
  crouchBodyH: 20,

  // ---- jump (feel §4)
  gravity: 0.18,
  maxFall: 5.0,
  jumpVelocity: -5.9,
  /** The press commits her: a 4-tick squat (8-tick paddle-up from water), take-off on the next tick. */
  squatTicks: 4,
  waterSquatTicks: 8,
  airAccel: 0.1,
  /** Air speed cap = clamp(|vx at take-off|, 1.5, 2.6): hopping never beats running. */
  airCapMin: 1.5,
  coyoteTicks: 4,
  jumpBufferTicks: 6,
  /** A fall of this many px or more lands with `swan/land`, a dust ring and a 1 px shake for 4 ticks. */
  landShakeFall: 60,
  landTicks: 4,
  /** Eject = jump pressed within this many ticks after down (a jump from a held crouch is a jump). */
  ejectDownTicks: 4,

  // ---- STOMP (feel §4.5)
  stompMinVy: 1.5,
  stompBox: [-14, -6, 28, 10] as Box,
  stompTopBand: 12,
  stompDamage: 100,
  /** 3.4² / 0.36 = 32 px [30], 37 ticks; refreshes the glide. */
  stompBounceVy: -3.4,
  /** Stomps without touching the ground before she waggles her tail and honks (feel §12). */
  stompGag: 3,

  // ---- GLIDE (feel §5)
  glideFlapVy: -0.4,
  glideGravity: 0.06,
  glideMaxFall: 1.0,
  glideSpeed: 2.2,
  glideDrag: 0.05,
  glideTicks: 60,
  glideTireTicks: 12,
  /** A press within max(16, 6 × vy) px above the landing surface buffers a jump instead. */
  glideBufferMin: 16,
  glideBufferPerVy: 6,
  /** Landing from a glide: she skis in on her paddles (skid f1, no flip). */
  glideLandTicks: 6,

  // ---- water (feel §6)
  /** Float line = surface + 16: her feet ride it, the hull on the surface. */
  swimDepth: 16,
  swimMax: 2.0,
  swimAccel: 0.08,
  swimDrag: 0.08,
  swimReverse: 0.15,
  swimBackMax: 1.0,
  duckSink: 8,
  duckSpeed: 1.0,
  bobAmp: 1,
  bobPeriod: 48,
  plungePerVy: 2,
  plungeMax: 10,
  plungeTicks: 16,
  /** The water catch (8.2): from tick 30 to tick 90 after an eject in water. */
  catchFrom: 30,
  catchTicks: 90,

  // ---- aim (feel §7; radians, 0 = facing, negative = up)
  neckMin: Math.PI / 4,
  neckMax: (-3 * Math.PI) / 4,
  neckStep: Math.PI / 8,
  neckStepTicks: 2,
  neckRelaxTicks: 40,

  // ---- weapons (feel §7.4–§7.6, GDD §6.3)
  gun: { damage: 10, speed: 8, cooldown: 4, burst: 5, jitter: 1, maxOnScreen: 24, life: 60 },
  /** maxOnScreen and life are not in the GDD: chosen so a −45° shell (314 px, ~100 ticks) lives. */
  shell: { speed: 4.0, gravity: 0.06, direct: 200, splash: 100, radius: 24, cooldown: 30, inheritVx: 1, maxOnScreen: 3, life: 240 },
  shells: 10,
  /** HONK: wind-up 10 ticks, then a ring 0 → 128 px in 16 ticks; strip 20 ticks (look.md §10.8). */
  honk: { windup: 10, radius: 128, growTicks: 16, damage: 80, stunTicks: 60, cost: 3, cooldown: 240, stripTicks: 20 },

  // ---- armour
  cells: 3,

  // ---- SWAN DIVE (feel §9.2)
  dive: {
    hissTicks: 6,
    speed: 3.4,
    accel: 0.25,
    distance: 192,
    /** Safety stop for a charge that cannot advance (63 ticks is a full run). */
    maxTicks: 120,
    damage: 400,
    radius: 40,
    trample: 100,
    cellCost: 1,
    bounceVx: -1.5,
    bounceVy: -3.0,
    /** Impact → dazed until impact + 180, then `right` 12, `shake` 8, `sit-down` 20. */
    dazedTicks: 180,
    rightingTicks: 12,
    shakeTicks: 8,
    bashTicks: 6,
    tumbleTicks: 8,
    migrateVx: 1.0,
    migrateVy: -1.5,
    /** Removed this far above the view top. */
    migrateGone: 32,
    shake: 4,
    shakeTicks2: 20,
  },

  // ---- co-op PERCH (feel §10): x, width, height; its top follows the hull top
  perch: [-26, 14, 4] as const,

  // ---- camera while any followed player rides a Swan (GDD §4.12)
  cameraLead: 64,
  cameraMaxSpeed: 4,

  // ---- presentation timings (look.md §9–§10)
  riseTicks: 12,
  /** After an eject on land she stands and looks around, then sits down. */
  standTicks: 20,
  sitTicks: 20,
  /** Left empty this long, she lays her nervous egg (once). */
  eggAfter: 600,
  /** The `empty-lay` strip and the frame on which the egg appears (f5 = 20+10+10+6+6 ticks in). */
  layDurations: [20, 10, 10, 6, 6, 8, 20, 30] as const,
  layEggAt: 52,
  /** Neck `-hurt` after a hit or a refusal, the 1 px jolt, `-fire` / `-shell` frames. */
  hurtTicks: 12,
  joltTicks: 4,
  fireFaceTicks: 2,
  shellFaceTicks: 6,
  /** The eye follows the nearest player on foot within this range while she is parked. */
  lookRange: 96,
});

// ---------------------------------------------------------------------------------------------
// Boxes (feel §2, GDD §8.2 Size)
// ---------------------------------------------------------------------------------------------

/** Hurtboxes per pose: standing (legs, hull, rider), crouched, swimming, ducked in water. */
export const HURT = deepFreeze({
  stand: [[-8, -28, 16, 28], [-22, -48, 40, 20], [-10, -66, 12, 18]] as readonly Box[],
  crouch: [[-22, -20, 40, 20]] as readonly Box[],
  swim: [[-22, -30, 40, 16], [-10, -48, 12, 18]] as readonly Box[],
  duck: [[-22, -24, 40, 12], [-10, -37, 12, 15]] as readonly Box[],
});

/** Seat (mount) zones: the top 16 px of her back. */
export const SEAT_ZONE = deepFreeze({
  parked: [-10, -32, 20, 16] as Box,
  water: [-10, -44, 20, 16] as Box,
  /** Standing for 20 ticks after an eject (the deck is at −48). */
  stand: [-10, -60, 20, 16] as Box,
});

/** The rider's hip (`seat`) per posture when the body frame has no 'seat' point. */
export const SEAT_POINT = deepFreeze({
  stand: [-4, -48] as Pt,
  crouch: [-4, -16] as Pt,
  swim: [-4, -30] as Pt,
  duck: [-4, -22] as Pt,
  parked: [-4, -20] as Pt,
});

/** The perch deck top per posture (feel §10): standing, crouched / parked, swimming, ducked. */
export const PERCH_TOP = deepFreeze({ stand: -48, crouch: -20, swim: -30, duck: -22 });

// ---------------------------------------------------------------------------------------------
// Art fallbacks (look.md §8, §10, §11.3): used only while a frame has no such point
// ---------------------------------------------------------------------------------------------

/** Rest positions of the hull-attached points; a frame's hull offset dy moves them down. */
export const REST = deepFreeze({
  neck: [16, -45] as Pt,
  hull: [-3, -38] as Pt,
  smoke: [-20, -50] as Pt,
  seat: [-4, -48] as Pt,
});

/** Hull offset dy per frame of each body strip (look.md §10); missing strips use 0. */
export const HULL_DY: Readonly<Record<string, readonly number[]>> = deepFreeze({
  idle: [0, 1],
  run: [0, 2, 1, -1, 0, 2, 1, -1],
  move: [0, 2, 1, -1, 0, 2, 1, -1],
  squat: [3, 6],
  jump: [-2, 0],
  fall: [0, 0],
  stomp: [3],
  land: [6, 2],
  flap: [0, -1],
  glide: [0, 0],
  'glide-tired': [0, 0],
  fold: [0],
  skid: [2, 3],
  crouch: [28, 29],
  waddle: [28, 27, 28, 28, 27, 28],
  slide: [28, 28],
  settle: [6, 12],
  swim: [18, 19, 18, 17],
  'water-duck': [26, 26],
  'paddle-up': [15, 10, 5, 0],
  honk: [1, 2, 0, -2, -1],
  'honk-air': [1, 2, 0, -2, -1],
  'honk-swim': [19, 20, 18, 16, 17],
  rise: [20, 10, 2],
  wreck: [6, 6],
  'sit-down': [6, 16, 28],
  empty: [28, 29],
  'empty-look': [28, 28, 28, 28, 28],
  'empty-lay': [28, 28, 28, 26, 26, 27, 28, 28],
});

/** Strips whose rider sits 4 px deeper (lying flat in the crouch, look.md §6.1). */
export const CROUCH_STRIPS: ReadonlySet<string> = new Set(['crouch', 'waddle', 'slide']);

/**
 * Beak tip (`muzzle` = `cannon`) relative to the neck socket per posture and neck frame
 * i = 0..8 (θ = +45° − 22.5°·i), look.md §11.3 "Muzzle (rel.)". Water frames 0–1 equal frame 2;
 * crouch and water duck aim 0° only.
 */
export const MUZZLE_REL = deepFreeze({
  land: [[21, 31], [26, 27], [28, 21], [28, 3], [19, -13], [11, -25], [-2, -31], [-16, -36], [-28, -33]] as readonly Pt[],
  water: [[26, 4], [26, 4], [26, 4], [24, -11], [19, -13], [11, -25], [-2, -31], [-16, -36], [-28, -33]] as readonly Pt[],
  crouch: [[22, 3]] as readonly Pt[],
  duck: [[24, 1]] as readonly Pt[],
});

/** The neck socket per posture at rest (look.md §11.3): land, water, crouch, water duck. */
export const SOCKET = deepFreeze({
  land: [16, -45] as Pt,
  water: [16, -27] as Pt,
  crouch: [16, -17] as Pt,
  duck: [16, -19] as Pt,
});

/** Tail tip of the `RIDE?` bubble: 8 px above the pad (look.md §13.8). */
export const BUBBLE_TIP = deepFreeze({ parked: [-4, -29] as Pt, water: [-4, -39] as Pt, stand: [-4, -57] as Pt });

/** Where the nervous egg lands (`empty-lay` f5–f7). */
export const EGG_POINT: Pt = Object.freeze([-30, 0] as const);

/** Contact box of the empty Swan's charge: from her rear legs to the hissing beak. */
export const DIVE_BOX: Box = Object.freeze([-14, -48, 54, 48] as const);
