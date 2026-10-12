/**
 * The fleet's numbers in one place: GDD §6.3, §8.1, §8.3–§8.6 values (marked "GDD") and the
 * geometry that the logic (./sundae.ts, ./bandwagon.ts, ./trumpeter.ts) and the art
 * (./*.art.ts) share, so a muzzle, a seat or a turret pivot can never drift between them.
 *
 * Units: px, ticks (60 per second), px/tick, px/tick². Body space: the vehicle's anchor is
 * (0, 0), x points forward (sprites face right), y points down. Values without a GDD mark were
 * chosen here because the GDD is silent; each says so in its comment.
 */

const DEG = Math.PI / 180;

/** Shared ground-vehicle rules (GDD §8.1). */
export const GROUND = {
  /** GDD §8.1: Legion infantry within 64 px of a moving player vehicle panic (30 %, once per 60 ticks). */
  panicRange: 64,
  panicChance: 0.3,
  panicEvery: 60,
  /** GDD §4.11 rule 6: a panic lasts 40 ticks. */
  panicTicks: 40,
  /** "Moving" for the panic rule (chosen: faster than a walk). */
  panicMinSpeed: 0.5,
  /** GDD §14.2: STRIKE! = 6 windup-bots crushed in one vehicle run, +1,000. */
  strikeCount: 6,
  strikeScore: 1000,
  /** A run ends after this many ticks below `strikeMinSpeed` (chosen). */
  strikeStopTicks: 30,
  strikeMinSpeed: 0.5,
  /** Squash damage (GDD §8.3: 100, `crush`). */
  squashDamage: 100,
  /** Deep water sinks a ground vehicle when its wheels are this far under the surface (chosen). */
  sinkDepth: 16,
  /** Left empty this long, a parked vehicle plays its gag (chosen), then every `gagEvery`. */
  gagDelay: 300,
  gagEvery: 420,
  gagTicks: 90,
  /** Hit flash: after a hit the vehicle flashes for 60 ticks (GDD §8.1); 2 of every 6 ticks white. */
  hitFlashTicks: 60,
} as const;

// ---------------------------------------------------------------------------------------------
// SUNDAE DRIVER (GDD §8.3, §6.3)
// ---------------------------------------------------------------------------------------------

export const SUNDAE = {
  /** GDD: van 80×44 (80×68 with the cone), hurtbox 76×36 (the cone is not a hurtbox). */
  width: 80,
  height: 44,
  hurt: { x: -38, y: -38, w: 76, h: 36 },
  /**
   * Physics body (chosen): narrower than the art so the van rolls over 1:2 dune crests and 24×16
   * rocks without catching its corners; the view clamp still uses the full width.
   */
  body: { w: 48, h: 40 },
  /** Hatch (mount zone): the top 16 px of the van body (GDD §8.1). */
  seat: { x: -32, y: -46, w: 64, h: 16 },
  /** The pilot pops out of the roof hatch here (chosen). */
  hatch: [-2, -46] as const,
  /** Where the driver's `mount` frame 1 is drawn: his head and shoulders fill the cab window. */
  driverDraw: [22, 2] as const,
  /** The driver's anchor (enemy AI reads it as his feet): on the ground line under the cab. */
  driverAnchor: [22, 0] as const,
  /** Cab window (x, y, w, h), where the driver shows (a hole in the body art). */
  window: { x: 14, y: -35, w: 14, h: 13 },
  /** GDD: 3 cells, 10 shells. */
  cells: 3,
  shells: 10,
  /** GDD: accelerate 0.08, max 2.4, brake 0.15; hop vy −3.0 (apex ≈ 35 px). */
  accel: 0.08,
  speed: 2.4,
  brake: 0.15,
  jump: -3.0,
  /** GDD: squash infantry when driving FASTER than 1.6 px/tick. */
  squashSpeed: 1.6,
  squashInclusive: false,
  /** GDD: ram 2.8 px/tick for up to 200 px; the blast is the shared 400 in r 40 (§8.1). */
  ramSpeed: 2.8,
  ramDistance: 200,
  ramDamage: 400,
  ramRadius: 40,
  /** Wheels (GDD: four round wheels, 14 px): centres in body space, radius (15 px drawn). */
  wheels: [-24, 24] as const,
  wheelY: -7,
  wheelR: 7,
  /** The cone turret pivot on the roof, and its length to the top of the cherry. */
  pivot: [-12, -45] as const,
  /** GDD: 24 px tall cone. The muzzle is the top scoop (sprinkles leave it), 22 px out. */
  coneLength: 24,
  muzzleOut: 22,
  /** GDD: the cone turns 15° per 2 ticks; 13 angles 0° … −180° (forward → up → back). */
  turretStepDeg: 15,
  turretSteps: 12,
  turretTicks: 2,
  /**
   * Chosen (GDD silent): down (+ forward) dips the cone one step to +15° forward-down, down + back
   * to the mirrored back-down step 13. The roof muzzle sits 45 px up, so a level stream flies over
   * a standing soldier (36 px); the dipped stream crosses chest height 50–180 px ahead of the van.
   */
  turretMin: -1,
  turretMax: 13,
} as const;

/** Centres of the unflipped overlays: the serving hatch (the gag's OPEN sign) and the painted name. */
export const SUNDAE_HATCH_CENTRE = [-18, -29] as const;
export const SUNDAE_NAME_CENTRE = [-3, -18] as const;

/** GDD §8.3 SPRINKLE GUN, §6.3 SUNDAE MORTAR, §8.3 JINGLE. */
export const SPRINKLE = {
  /** GDD: 1 per 4 ticks, 10 damage, speed 8, infinite. */
  cooldown: 4,
  damage: 10,
  speed: 8,
  /** Chosen: a tap fires a 4-sprinkle scoop (like the other vehicle guns' bursts); hold = stream. */
  burst: 4,
  life: 60,
  maxOnScreen: 24,
  /** Hitbox (chosen). */
  w: 6,
  h: 4,
} as const;

export const MORTAR = {
  /** GDD: vx 2.5 × facing + van vx, vy −4.0, gravity 0.15. */
  vx: 2.5,
  vy: -4.0,
  gravity: 0.15,
  /** GDD: 150 in r 24; Legion infantry inside frozen 90 ticks (any hit shatters them). */
  damage: 150,
  radius: 24,
  freezeTicks: 90,
  /** GDD: cooldown 36. */
  cooldown: 36,
  life: 240,
  w: 8,
  h: 8,
} as const;

export const JINGLE = {
  /** GDD: Legion infantry within 200 px queue for 120 ticks; cooldown 900; no shell cost. */
  range: 200,
  queueTicks: 120,
  cooldown: 900,
  /** The reaction circle is centred this high on the van (game.md recipe: y − 20). */
  centreY: -20,
  /** The loudspeaker plays (animation, notes) this long (chosen). */
  playTicks: 90,
} as const;

// ---------------------------------------------------------------------------------------------
// THE BANDWAGON (GDD §8.4, §6.3)
// ---------------------------------------------------------------------------------------------

export const BANDWAGON = {
  /** GDD: truck 96×56; hurtbox cab 32×36 + flatbed 64×24. */
  width: 96,
  height: 56,
  cab: { x: 16, y: -36, w: 32, h: 36 },
  bed: { x: -48, y: -24, w: 64, h: 24 },
  /** Union of the two boxes (hitRect: pickups, exits, the RIDE? bubble). */
  hurt: { x: -48, y: -36, w: 96, h: 36 },
  /** Physics body (chosen; see SUNDAE.body). */
  body: { w: 56, h: 30 },
  /** Hatch (mount zone): over the podium where the pilot stands (GDD §8.1 "top 16 px"). */
  seat: { x: -22, y: -48, w: 34, h: 16 },
  /** The pilot pops out of the podium here (chosen). */
  hatch: [-6, -40] as const,
  /** The pilot (rig `mount` frame 1) stands behind the podium; his anchor is the ground line. */
  driverDraw: [-6, -14] as const,
  driverAnchor: [-6, 0] as const,
  /** GDD: 4 cells, 10 shells. */
  cells: 4,
  shells: 10,
  /** GDD: accelerate 0.06, max 1.8; hop vy −2.4 (apex ≈ 22 px). Brake chosen (GDD silent): 0.1. */
  accel: 0.06,
  speed: 1.8,
  brake: 0.1,
  jump: -2.4,
  /** GDD: squash infantry when driving at 1.0 px/tick OR MORE. */
  squashSpeed: 1.0,
  squashInclusive: true,
  /** GDD: ram 2.4 px/tick for up to 240 px, 500 damage in r 48. */
  ramSpeed: 2.4,
  ramDistance: 240,
  ramDamage: 500,
  ramRadius: 48,
  wheels: [-30, 31] as const,
  wheelY: -7,
  wheelR: 7,
  /** The sousaphone bell pivot (at the pilot's hands) and the bell length to its mouth. */
  pivot: [3, -34] as const,
  bellLength: 15,
  /** GDD: 5 bell angles; one step per 6 ticks. */
  bellAngles: [0, -30, -60, -90, -120] as const,
  bellTicks: 6,
  /** The bass drum on the stage (centre, radius) and the stage platform for a co-op partner. */
  drum: [-31, -35] as const,
  drumR: 13,
  /** GDD co-op: the stage is a moving one-way platform (top y, x range in body space). */
  stage: { x: -46, y: -24, w: 58, h: 4 },
  /** The cymbal wall stands here in front of the cab (body space). */
  cymbals: { x: 47, y: -58, w: 14, h: 58 },
} as const;

/** GDD §8.4 BRASS CANNON, §6.3 DRUM BOOM, §8.4 CYMBAL WALL. */
export const BRASS = {
  /** GDD: a sonic ring every 12 ticks, grows 10 → 24 px, speed 4, 30 damage, pierces, erases bullets. */
  cooldown: 12,
  sizeFrom: 10,
  sizeTo: 24,
  speed: 4,
  damage: 30,
  /** Chosen: it reaches full size after 20 ticks (80 px) and lives 72 ticks (288 px). */
  growTicks: 20,
  life: 72,
  maxOnScreen: 6,
} as const;

export const DRUM = {
  /** GDD: a ground shockwave both ways, 96 px each way, 12 px tall, 3 px/tick; 100 to grounded enemies. */
  reach: 96,
  height: 12,
  speed: 3,
  damage: 100,
  /** GDD: cooldown 45. */
  cooldown: 45,
  /** Chosen: a wave hugs the ground; a rise or drop of more than this ends it (a wall, a pit). */
  maxStep: 12,
  /** The wave's width (its hitbox along the ground, chosen). */
  w: 12,
} as const;

export const CYMBAL = {
  /** GDD: 60 ticks; blocks every projectile from the front; 100 to anything the truck touches, once. */
  ticks: 60,
  damage: 100,
  cooldown: 300,
  /** Swing-up and swing-down animation ticks (chosen). */
  swing: 8,
} as const;

// ---------------------------------------------------------------------------------------------
// TRUMPETER (GDD §8.5, §6.3, docs/design/swan-mount/look.md §14)
// ---------------------------------------------------------------------------------------------

export const TRUMPETER = {
  /**
   * GDD: hurtbox 28×14, the hull only. The anchor is the bottom centre of that box, so the hull
   * centre is (0, −7) and the driver's anchor (15 px below the hull centre, ARCHITECTURE §6.1)
   * is (0, +8): enemy shots aimed at a target's centre (y − 15) fly at the hull.
   */
  hull: { x: -14, y: -14, w: 28, h: 14 },
  hullCentreY: -7,
  driverDy: 8,
  /** The rider's hip on the seat pad (walker seat (−4, −48) moved by WALKER_TO_FLIGHT). */
  seatPoint: [-1, -17] as const,
  /** Mount zone over the seat pad (an empty Trumpeter can be boarded by falling onto it). */
  seat: { x: -10, y: -24, w: 20, h: 12 },
  /** GDD: 3 cells, 20 dive bombs. */
  cells: 3,
  shells: 20,
  /** GDD: free 8-way flight at 2.0 px/tick (1.4 per axis on diagonals). Accel chosen: 0.5. */
  speed: 2.0,
  accel: 0.5,
  /**
   * GDD: the ship stays 4 px inside the view. Its box (body space, measured on the art): tail tip
   * −41, beak tip +49, the rider's head −42, the keel and trailing paddles +13. Only the wing tips
   * of the top and bottom of a beat (a few ticks each) reach past it (chosen).
   */
  viewMargin: 4,
  viewBox: { left: -41, right: 49, top: -42, bottom: 13 },
  /** GDD: bail-out missile 4 px/tick, 400 in r 40; flies until it hits or leaves the view. */
  ramSpeed: 4,
  ramDistance: 640,
  ramDamage: 400,
  ramRadius: 40,
  /** GDD: the backup swoops in 60 ticks after a bail-out with 1 cell and 5 dive bombs. */
  backupDelay: 60,
  backupCells: 1,
  backupShells: 5,
  /** Chosen: the backup flies at 3.5 px/tick and grabs the pilot within 6 px of the seat. */
  backupSpeed: 3.5,
  backupReach: 6,
  /** GDD: the bail-out is available again 900 ticks after the pick-up. */
  bailLock: 900,
  /** GDD: the parachute falls 0.5 px/tick. */
  chuteFall: 0.5,
  /** Chosen: the somersault lasts 14 ticks before the canopy opens. */
  chuteOpen: 14,
  /** Chosen: the bail-out pops the pilot up at vy −2.5 (≈ 20 px), not the shared ram's −4.0. */
  bailVy: -2.5,
  /** Chosen: under the canopy his feet stay at least 56 px under the view top (canopy in view). */
  chuteTop: 56,
  /** GDD: a respawned pilot flies in from the left edge (3 cells, 20 bombs, 120 invulnerable ticks). */
  flyInSpeed: 3,
  flyInX: 64,
  /** GDD m5-a: players start at view y 80 (P1) and 130 (P2). */
  startY: [80, 130] as const,
  /** GDD: touching a small enemy destroys it and costs ½ cell. "Small" (chosen): ≤ 40 HP, ≤ 32×32. */
  smallHp: 40,
  smallSize: 32,
  /** The neck is stretched forward: the head centre and the split bill's two bores (body space). */
  head: [35, -14] as const,
  muzzles: [
    [47, -16],
    [47, -12],
  ] as const,
  /** Where a dive bomb leaves the belly. */
  bombPoint: [2, 2] as const,
  /** The open ends of the two jet nozzles, piped from the flank vents (look.md §5.1) under the keel. */
  jets: [
    [7, 4],
    [11, 4],
  ] as const,
  /** The rider holds on tight after a dive bomb or in a hard bank (|vy| ≥ this) for a few ticks. */
  holdTicks: 12,
  bankVy: 1.4,
  /** The rider cheers this long when a boss dies (chosen). */
  cheerTicks: 300,
} as const;

/** GDD §8.5 TWIN BEAK GUN, §6.3 DIVE BOMB, §8.5 HONK (as the Swan's, §8.2). */
export const TWIN = {
  /** GDD: 2 parallel bullets 4 px apart every 6 ticks, 10 damage each, speed 9, infinite. */
  cooldown: 6,
  damage: 10,
  speed: 9,
  gap: 4,
  life: 60,
  maxOnScreen: 24,
  w: 6,
  h: 3,
} as const;

export const DIVE_BOMB = {
  /** GDD: dropped with the ship's speed, gravity 0.2; 150 in r 20; cooldown 20. */
  gravity: 0.2,
  damage: 150,
  radius: 20,
  cooldown: 20,
  life: 180,
  w: 6,
  h: 8,
} as const;

export const HONK = {
  /** GDD §8.2: a 10-tick wind-up (she hangs still), then a ring 0 → 128 px in 16 ticks (8 px/tick). */
  windup: 10,
  maxRadius: 128,
  grow: 8,
  /** GDD: 80 to every enemy part it touches (once); infantry inside cover their ears 60 ticks. */
  damage: 80,
  earsTicks: 60,
  /** GDD §8.5: costs 3 dive bombs, cooldown 240. */
  cost: 3,
  cooldown: 240,
} as const;

// ---------------------------------------------------------------------------------------------
// Geometry helpers (shared by art and logic)
// ---------------------------------------------------------------------------------------------

/** Turret angle (radians, relative to the facing; 0 forward, −π/2 up, −π back) of a cone step. */
export function coneAngle(step: number): number {
  return -step * SUNDAE.turretStepDeg * DEG;
}

/** The sprinkle muzzle of a cone step, relative to the pivot (facing right). */
export function coneMuzzle(step: number, out: [number, number]): [number, number] {
  const a = coneAngle(step);
  out[0] = Math.round(Math.cos(a) * SUNDAE.muzzleOut);
  out[1] = Math.round(Math.sin(a) * SUNDAE.muzzleOut);
  return out;
}

/** Bell angle (radians, relative to the facing) of a bell step 0..4. */
export function bellAngle(step: number): number {
  return BANDWAGON.bellAngles[Math.max(0, Math.min(BANDWAGON.bellAngles.length - 1, step))] * DEG;
}

/** The bell's mouth (ring spawn point) of a bell step, relative to the pivot (facing right). */
export function bellMuzzle(step: number, out: [number, number]): [number, number] {
  const a = bellAngle(step);
  out[0] = Math.round(Math.cos(a) * (BANDWAGON.bellLength + 1));
  out[1] = Math.round(Math.sin(a) * (BANDWAGON.bellLength + 1));
  return out;
}

/** Walker (ridden swan, look.md §3) body space → Trumpeter body space: the walker's hull centre (−3, −38) → (0, −7). */
export const WALKER_TO_FLIGHT = [3, 31] as const;

// ---------------------------------------------------------------------------------------------
// Sprite ids (logic and art use the same strings)
// ---------------------------------------------------------------------------------------------

export const ART = {
  sundae: 'vehicle/sundae-driver',
  bandwagon: 'vehicle/bandwagon',
  trumpeter: 'vehicle/trumpeter',
  /** P2's Trumpeter: "the Mute" (black neck, head and beak; grey wing tips; GDD §8.5). */
  trumpeterMute: 'vehicle/trumpeter-mute',
  /** Rainbow sprinkles: one 16-direction strip per colour (ARCHITECTURE §7.1 `weapon/<id>`). */
  sprinkles: ['weapon/sprinkle', 'weapon/sprinkle-lemon', 'weapon/sprinkle-mint', 'weapon/sprinkle-sky', 'weapon/sprinkle-vanilla'],
  sundaeShell: 'weapon/sundae-shell',
  brassRing: 'weapon/brass-ring',
  drumWave: 'weapon/drum-wave',
  twinBullet: 'weapon/twin-bullet',
  diveBomb: 'weapon/dive-bomb',
} as const;
