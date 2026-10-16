/**
 * Weapon numbers from GAME_DESIGN.md §5 (the spec): one table per pickup weapon. The pistol,
 * the machine gun, the grenade and the knife keep their numbers in src/game/tuning.ts (the
 * player code reads them too). Units: damage in pistol units ×10, speeds px/tick, times ticks.
 *
 * Where the GDD is silent, the value is marked "(ours)".
 */

const DEG = Math.PI / 180;

/** `shotgun` — an instant cone of damage (GDD §5). */
export const SHOTGUN = {
  ammo: 30,
  ammoAgain: 10,
  damage: 150,
  cooldown: 28,
  /** Damage area: 72 px long, 16 px tall at the muzzle, 40 px at the tip, active 6 ticks. */
  length: 72,
  nearH: 16,
  farH: 40,
  activeTicks: 6,
  /** Cosmetic pellets fly 6 px/tick and fade. */
  pelletSpeed: 6,
  pellets: 7,
  /** The shooter is kicked back 2 px. */
  kick: 2,
  maxOnScreen: 1,
} as const;

/** `rocket-launcher` (GDD §5). */
export const ROCKET = {
  ammo: 30,
  ammoAgain: 20,
  hit: 30,
  blast: 50,
  radius: 16,
  cooldown: 20,
  speed: 2,
  accel: 0.3,
  maxSpeed: 7,
  /** Sideways steering toward the nearest enemy ahead: at most 1 px/tick. */
  steer: 1,
  /** How fast the sideways speed changes (ours). */
  steerAccel: 0.12,
  /** Sideways speed per px of offset to the target (ours): a gentle curve, no wobble. */
  steerGain: 0.08,
  /** Lifetime (ours): long enough to cross the view at full speed. */
  life: 110,
  maxOnScreen: 2,
} as const;

/** `flamethrower` (GDD §5). */
export const FLAME = {
  ammo: 30,
  ammoAgain: 15,
  /** 10 per 2 ticks per target, at most 12 hits per target per press. */
  damage: 10,
  every: 2,
  maxHits: 12,
  cooldown: 24,
  /** The stream is 96 px long and active 24 ticks per press. */
  length: 96,
  activeTicks: 24,
  /** Fired down from the air within 32 px of the ground it runs 128 px along the floor. */
  floorReach: 32,
  floorRun: 128,
  /** The flame shoots out at this speed (ours) and dies down over this many ticks (ours). */
  growSpeed: 16,
  fadeTicks: 8,
  maxOnScreen: 1,
} as const;

/** `laser` (GDD §5). */
export const LASER = {
  ammo: 200,
  ammoAgain: 150,
  /** 8 damage per 2 ticks per target. */
  damage: 8,
  every: 2,
  /** One ammo per 4 ticks: one shot every 4 ticks keeps the beam on. */
  cooldown: 4,
  /** A tap is a 12-tick pulse (3 ammo). */
  burst: 3,
  /** The beam lingers 6 ticks after a held trigger is released. */
  linger: 6,
  /** To the first solid or 384 px. */
  range: 384,
} as const;

/** `homing` (GDD §5). */
export const HOMING = {
  ammo: 40,
  ammoAgain: 20,
  /** Each press launches 2 missiles, 15° up and 15° down from the aim. */
  perPress: 2,
  spread: 15 * DEG,
  hit: 30,
  blast: 10,
  radius: 8,
  cooldown: 20,
  speed: 4,
  /** Locks the nearest enemy hurtbox within 220 px in front; turns 4°/tick; lives 120 ticks. */
  lockRange: 220,
  turn: 4 * DEG,
  life: 120,
  /** Max 4 missiles: a press needs room for both (so at most 2 may be in the air). */
  maxMissiles: 4,
} as const;

/** `tuba` (GDD §5). */
export const TUBA = {
  ammo: 25,
  ammoAgain: 15,
  damage: 60,
  cooldown: 30,
  speed: 2.5,
  /** The ring grows from 12 to 40 px over 40 ticks and lives 70 ticks. */
  size0: 12,
  size1: 40,
  growTicks: 40,
  life: 70,
  /** Pushes enemies with ≤ 40 HP back 8 px. */
  pushHp: 40,
  push: 8,
  maxOnScreen: 3,
} as const;

/** `bounce-mine` (GDD §5). */
export const MINE = {
  ammo: 30,
  ammoAgain: 10,
  hit: 30,
  blast: 40,
  radius: 20,
  cooldown: 20,
  /** Thrown low: vx 3.0, vy −2.0, gravity 0.2; lobbed when aimed up; dropped when aimed down. */
  vx: 3,
  vy: -2,
  gravity: 0.2,
  upVx: 1,
  upVy: -4,
  downVy: 1,
  /** Bounces along the ground (vy × −0.6, vx kept); hops gaps ≤ 32 px, steps ≤ 12 px. */
  bounce: 0.6,
  gap: 32,
  step: 12,
  /** Explodes on enemy contact, on the 4th landing or after 150 ticks. */
  landings: 4,
  fuse: 150,
  maxOnScreen: 3,
} as const;

/**
 * Announcer lines (GDD §5, §12.3): the plain weapon name (user decision 2026-10-14). The same
 * weapon again: `MORE <NAME>!`.
 */
export const VOICE = {
  'machine-gun': ['HEAVY MACHINE GUN!', 'MORE HEAVY MACHINE GUN!'],
  shotgun: ['SHOTGUN!', 'MORE SHOTGUN!'],
  'rocket-launcher': ['ROCKET LAUNCHER!', 'MORE ROCKETS!'],
  flamethrower: ['FLAMETHROWER!', 'MORE FLAMETHROWER!'],
  laser: ['LASER GUN!', 'MORE LASER GUN!'],
  homing: ['ENEMY CHASER!', 'MORE ENEMY CHASER!'],
  tuba: ['TUBA!', 'MORE TUBA!'],
  'bounce-mine': ['BOUNCE MINES!', 'MORE BOUNCE MINES!'],
} as const satisfies Record<string, readonly [string, string]>;

/** The knife's sound per character (GDD §6.2, §15.7); the characters module may override it. */
export const KNIFE_SFX: Readonly<Record<string, string>> = {
  // The squad (docs/design/squad.md §1): battle plan, pistol-whip, plunger, model airliner,
  // frikandel.
  vincent: 'weapon/knife-umbrella',
  thom: 'weapon/knife-wrench',
  dirk: 'weapon/knife-pan',
  bob: 'weapon/knife-needles',
  patrick: 'weapon/knife',
  // The retired GDD heroes.
  grace: 'weapon/knife-umbrella',
  mittens: 'weapon/knife-needles',
  pip: 'weapon/knife-pan',
  gramps: 'weapon/knife-wrench',
};
