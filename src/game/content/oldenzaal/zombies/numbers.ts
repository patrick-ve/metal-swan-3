/**
 * Mission oldenzaal — every tunable number of the dead soldiers (spec §3; revision 2). Owner:
 * ZOMBIES (tuned from PREP's placeholder values with the bot and a human-speed estimate).
 *
 * HP: one pistol shot is 10 HP and the pistol fires at most every 8 ticks (7.5 shots/s); a human
 * taps about 5 shots/s. They are tanks (R2-1): slow (0.35–0.5 px/tick), many hits, a heavy
 * stagger only on big hits (a grenade, the frikandel explosion, the knife, a shotgun blast).
 * - grunt 90: 9 pistol hits ≈ 1.8 s of a human's pistol fire (spec "about 8"; FIX lowered it from
 *   110: he is the common one, ~65 per run, and the pistol-only locks dragged), 0.6 s of the
 *   machine gun (150 HP/s), one shotgun blast (150) or one grenade (100).
 * - rifleman 90: he stands at range; a grenade kills him.
 * - MG 260 (big: × the difficulty and co-op HP factors): 26 pistol hits ≈ 5 s, 1.7 s of the
 *   machine gun, two shotgun blasts. The threat of each locked fight.
 * - crawler 40: 4 hits.
 */

export const GRUNT = {
  hp: 90,
  score: 300,
  walk: 0.4,
  /** Melee reach (px from his x to the target's x). */
  reach: 26,
  /** The wind-up (the shovel goes back over the shoulder; ≥ 18, scaled by difficulty). */
  tell: 28,
  /** The swing (ticks) and the ticks of it the box is live (from the swing's 2nd tick). */
  strike: 16,
  activeFrom: 3,
  active: 7,
  recover: 34,
  cool: 44,
  coolJitter: 16,
  /** The swing's box (relative to the feet, facing right). */
  swingBox: { x: 2, y: -30, w: 22, h: 26 },
  /** The lunge of the swing (px/tick while the box is live). */
  lunge: 0.6,
  w: 14,
  h: 31,
} as const;

export const RIFLEMAN = {
  hp: 90,
  score: 400,
  walk: 0.38,
  /** He stops this far from the target (px). */
  hold: 150,
  range: 250,
  /** The raise-and-aim tell (long and clear: the rifle comes up, the barrel glints). */
  tell: 50,
  /** The slow, visible shot (px/tick; jump or duck it). */
  shotSpeed: 1.5,
  shotDamage: 10,
  /**
   * Shot height above the feet when the target stands on his level: over a crouching hero's
   * 20-px hit box (a crouch ducks it), into a standing one's chest.
   */
  shotY: 25,
  /** A target more than this far above or below gets an aimed shot (no duck; move away). */
  levelDy: 10,
  recover: 24,
  /** The slow reload (the bolt, the clip) between shots. */
  reload: 130,
  reloadJitter: 30,
  w: 14,
  h: 31,
} as const;

export const GUNNER = {
  hp: 260,
  score: 1000,
  walk: 0.35,
  hold: 160,
  range: 270,
  /** Kneeling and setting the bipod (ticks, no attack). */
  plant: 40,
  /** The aim tell before a burst (the barrel lowers onto the target, a glint). */
  tell: 40,
  /** Bullets per burst and the ticks between them (a short sweep). */
  burst: 7,
  every: 6,
  /** The sweep: the aim angle moves this much (radians) over the burst, around the target's chest. */
  sweep: 0.22,
  shotSpeed: 2.2,
  shotDamage: 10,
  /** The gun's height above the feet while planted (kneeling behind the bipod). */
  shotY: 17,
  cool: 110,
  coolJitter: 30,
  /** Getting up with the gun when the target left his arc (ticks). */
  getup: 30,
  /** He gets up and moves when the target is this far behind him or out of range for this long. */
  relocateAfter: 150,
  /** Cosmetic damage states (HP fractions): the helmet flies off, then the barrel jacket breaks. */
  helmetAt: 0.6,
  barrelAt: 0.3,
  w: 20,
  h: 38,
  /** The hit box while kneeling behind the gun. */
  kneelH: 30,
} as const;

export const CRAWLER = {
  hp: 40,
  score: 250,
  /** The drag along the floor. */
  walk: 0.36,
  reach: 20,
  /** The grab's tell (it rears up). */
  tell: 24,
  grab: 12,
  active: 6,
  recover: 40,
  cool: 50,
  coolJitter: 20,
  grabBox: { x: 2, y: -10, w: 18, h: 10 },
  /** The hold on a hero's feet: the most it lasts (ticks), the bite's tell at its end, the taps that break it. */
  hold: 110,
  biteTell: 28,
  taps: 4,
  /** After the hold breaks it lets go and slides back (stagger ticks). */
  letGo: 40,
  /** Low: aim down or jump over. */
  w: 18,
  h: 12,
} as const;

/** The entrances' timing (the rules are in api.ts `ENTRANCE`). */
export const ENTRY = {
  /** 'rise': the cracks spread (tell), then the climb out (spec: 60–90 ticks in all). */
  riseTell: 30,
  riseClimb: 54,
  /** 'manhole': the cover rattles (tell), then he pulls himself up (faster: the hole is open). */
  manholeTell: 30,
  manholeClimb: 44,
  /** 'burst': the planks bang (tell), then the stagger out. */
  burstTell: 34,
  burstOut: 26,
  /** How long a hidden zombie waits for a hero to step off its spot (it never comes up on one). */
  maxWait: 240,
} as const;

/**
 * The clamber over a low wall (INTEGRATE, wave B: the street's 16-px garden walls stood in the
 * arenas, and the dead stood stuck behind them). Body gravity 0.13: vy −2.5 lifts the feet about
 * 24 px; `push` × the walk speed while in the air; `drop` the step down they take off a wall top.
 */
export const CLAMBER = {
  wall: 20,
  vy: -2.5,
  push: 2,
  drop: 20,
} as const;

/** Stagger (ticks) by cause; heavy hits only (spec §3.1). */
export const STAGGER = {
  explosion: 40,
  knife: 22,
  /** A single hit of at least this much damage (a shotgun blast) staggers. */
  bigHit: 50,
  big: 26,
  /** A zombie can not be staggered again within this many ticks after one ends (no stun-lock). */
  immune: 30,
} as const;

/** Hit feedback (cosmetic): chances per hit of a dust puff and of a chunk of rot / cloth. */
export const HIT_FX = {
  dust: 0.5,
  chunk: 0.35,
  /** A helmet flies off on a hit with this chance once HP is below `helmetBelow` (grunt / rifleman). */
  helmet: 0.25,
  helmetBelow: 0.55,
} as const;

/** The collapse into bones (the `oz-bones` fx). */
export const COLLAPSE = {
  /** The bone pile lies this long after the collapse strip, then blinks out over `blink`. */
  lie: 150,
  blink: 30,
} as const;

/** The frikandel explosion (R2-11; items/index.ts `frikandelExplosion`). */
export const FRIKANDEL_BLAST = {
  /** The radius (px; a grenade's is 24). */
  radius: 60,
  /** Damage at the centre and at the edge (linear between). */
  damage: 150,
  edge: 80,
  stagger: 50,
} as const;
