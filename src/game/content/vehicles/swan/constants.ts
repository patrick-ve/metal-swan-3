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

import { SET as SWAN_ART } from '../../art40/swan.gen';
import { SET as SWAN_WATER_ART } from '../../art40/swan-water.gen';

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

/** The standing deck top (PERCH_TOP.stand): the rest of every baked frame's `perch` point. */
const PERCH_TOP_STAND = -48;

/** The perch deck top per posture (feel §10): standing, crouched / parked, swimming, ducked. */
export const PERCH_TOP = deepFreeze({ stand: PERCH_TOP_STAND, crouch: -20, swim: -30, duck: -22 });

// ---------------------------------------------------------------------------------------------
// Art fallbacks (look.md §8, §10, §11.3): used only while a frame has no such point
// ---------------------------------------------------------------------------------------------

/**
 * Rest positions of the hull-attached points; a frame's hull offset dy moves them down. The 40 px
 * Swan (docs/design/ams40.md wave 7, art only): the neck socket sits at (16, -43) on her breast,
 * the seat at (-3, -48) on the saddle (the seat zones, the hurtboxes and PERCH_TOP stay).
 */
export const REST = deepFreeze({
  neck: [16, -43] as Pt,
  hull: [-3, -38] as Pt,
  smoke: [-20, -50] as Pt,
  seat: [-3, -48] as Pt,
});

/**
 * Hull (deck) offset dy per frame of each body strip (look.md §10); missing strips use 0. The
 * perch deck follows it (feel §10). Every strip comes from the baked 40 px Swan sets
 * (docs/design/ams40.md wave 7: the core `swan` and `swan-water`; the neck strips have no deck):
 * the deck of the drawn frame is its `perch` point − the rest deck PERCH_TOP.stand, one entry per
 * baked frame, so the table follows the art.
 */
export const HULL_DY: Readonly<Record<string, readonly number[]>> = deepFreeze(bakedDecks());

/** The deck offsets of the baked body strips (every frame with a `perch` point). */
function bakedDecks(): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const set of [SWAN_ART, SWAN_WATER_ART]) {
    for (const [name, st] of Object.entries(set.strips)) {
      if (name.endsWith('-front') || !st.frames.every((f) => f.pts?.perch)) continue;
      out[name] = st.frames.map((f) => (f.pts?.perch?.[1] ?? PERCH_TOP_STAND) - PERCH_TOP_STAND);
    }
  }
  return out;
}

/** Strips whose rider sits 4 px deeper (lying flat in the crouch, look.md §6.1). */
export const CROUCH_STRIPS: ReadonlySet<string> = new Set(['crouch', 'waddle', 'slide']);

/**
 * The muzzle (`muzzle` = `cannon`) relative to the neck socket per posture and aim i = 0..8
 * (θ = +45° − 22.5°·i): the tip of the barrel on the drum's hub at rest (docs/design/ams40.md
 * "The Swan", D3; the values of the baked neck strips, tools/art40/chars/swan-neck/draw.py
 * rest_tip). The drum sits low on her flank (hub (5, −27) standing), so the level shot leaves at
 * y −27: inside the 30 px hurtboxes of the people on the street (D7: they still take it). Crouched
 * (her body pressed down) and afloat the drum is strapped higher on her flank (body.py drum_s), so
 * on the water the level shot leaves over the surface (y −18, the surface at −16). Used only while a neck frame lacks the point. Water aims 0–1 shoot level (= aim 2);
 * crouch and water duck aim 0° only.
 */
export const MUZZLE_REL = deepFreeze({
  land: [[1, 28], [5, 23], [6, 16], [5, 9], [1, 4], [-5, 0], [-11, -1], [-18, 0], [-23, 4]] as readonly Pt[],
  water: [[6, 7], [6, 7], [6, 7], [5, 0], [1, -5], [-5, -9], [-11, -10], [-18, -9], [-23, -5]] as readonly Pt[],
  crouch: [[6, 5]] as readonly Pt[],
  duck: [[6, 7]] as readonly Pt[],
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
