/**
 * Mission oldenzaal — the numbers of the possessed (NORMAL; docs/design/oldenzaal.md §3). Ticks
 * at 60 Hz, speeds in px/tick, damage in pistol units ×10. Telegraphs go through `tele()` (the
 * difficulty scale, never below 18 ticks). Owner: POSSESSED. Pure data.
 */

/** The common host: a slow, heavy walk, arms forward; a grab / claw at close range. */
export const SHAMBLER = {
  hp: 30,
  score: 200,
  walk: 0.5,
  /** Reach: he starts the grab when the player is this close (px, |dx|) and level (|dy| ≤ 24). */
  reach: 30,
  tell: 24,
  /** The strike: a lunge of `lunge` px/tick; the claw box is live for the first `active` ticks. */
  strike: 14,
  active: 7,
  lunge: 1.1,
  recover: 34,
  cool: 30,
  coolJitter: 12,
  /** The claw box (relative to the feet, facing right). */
  clawBox: { x: 2, y: -28, w: 18, h: 18 },
  /** Ticks with the player behind (≥ 12 px) before he turns round (a slow, heavy turn). */
  turnDelay: 20,
} as const;

/** The host that stands still while its soul raises a ghost rifle (a slow, visible shot). */
export const GUNNER = {
  hp: 30,
  score: 300,
  walk: 0.4,
  /** He walks until the player is at most this far, then stands. */
  hold: 170,
  range: 260,
  /** The long tell: the soul raises the rifle, it glows brighter. */
  tell: 48,
  shoot: 10,
  recover: 40,
  cool: 100,
  coolJitter: 30,
  /** The spectral shot: along the ground (knee height, jump it) or a low arc (every 3rd shot or a player on another level). */
  shotSpeed: 1.25,
  shotY: 9,
  arcVy: -2.6,
  arcGravity: 0.07,
  shotDamage: 10,
  shotHp: 10,
  shotScore: 50,
  shotLife: 330,
  shotW: 8,
  shotH: 8,
  /** At most this many of his shots in the air. */
  maxShots: 2,
} as const;

/** The big host (the butcher, a bouncer): more HP, a heavy charge with a tell, knocks over street furniture. */
export const BRUTE = {
  hp: 80,
  score: 800,
  walk: 0.45,
  /** He charges when the player is level (|dy| ≤ 30) and within this range. */
  range: 170,
  tell: 36,
  charge: 2.6,
  /** The charge stops after this many ticks, at a wall or an edge, or `overrun` px past the player. */
  chargeMax: 80,
  overrun: 56,
  recover: 50,
  cool: 70,
  coolJitter: 20,
  w: 20,
  h: 36,
} as const;

/** The free soul: a flyer that drifts, swoops with a tell and dies in a few shots. */
export const SOUL = {
  hp: 20,
  score: 150,
  /** Drift: the hover height over the floor, the bob, the speed toward its spot. */
  hover: 52,
  bob: 4,
  drift: 0.6,
  /** The swoop: the tell (it rears back, the eyes flare), the dive speed, the climb back. */
  tell: 30,
  swoop: 2.4,
  swoopMax: 70,
  rise: 1.1,
  recover: 40,
  cool: 110,
  coolJitter: 40,
  /** It swoops at a player within this range (px). */
  range: 200,
  /** Emerging from a drain / chimney / chandelier (it fades in and rises). */
  emerge: 40,
  /** Possession: it looks for a fleeing / dazed townsperson within this range, circles him (the tell) and dives. */
  possessRange: 140,
  circle: 30,
  circleR: 14,
  dive: 2.2,
  diveMax: 60,
  /** The hitbox (a flyer: no body). */
  w: 12,
  h: 18,
} as const;

/** The ejected soul (`oz-soul-eject`): it rises with a wail, flickers and fades. */
export const EJECT = {
  ticks: 40,
  rise: 0.7,
  /** Points for shooting it while it rises (on top of the kill). */
  bonus: 50,
  w: 12,
  h: 16,
} as const;

/** The freed person: the drop, the daze, then off screen; a thank-you line now and then. */
export const FREED = {
  fall: 16,
  dazed: 60,
  getup: 12,
  /** Faster than a hero (1.5), so he clears the view instead of walking with the scroll. */
  run: 2.2,
  /** He leaves against the scroll (left in oz-a / oz-b); after this many ticks he fades out. */
  leaveTicks: 240,
  /** The fade-out length (ticks). */
  fade: 24,
  /** Never more than this many freed people at once: a new one makes the oldest fade out. */
  maxShown: 3,
  /** The chance of a thank-you line as he gets up (cosmetic). */
  thanks: 0.45,
} as const;

/** The frightened townsperson (`oz-townsperson`). */
export const TOWN = {
  run: 1.4,
  /** A threat (a host, a free soul) this close makes him run; when nothing is within `calm` he hides. */
  fear: 130,
  calm: 110,
  /** He hides (crouches, trembles) after running this long with no threat near. */
  runMin: 60,
  /** A fright line now and then (cosmetic chance per fright). */
  shout: 0.2,
  /** The seizure when a soul dives in, before he rises as a host. */
  seized: 24,
} as const;

/** Re-possession (spec §3.4): never more than this many on screen at once (diving souls included). */
export const MAX_REPOSSESS = 2;

/** The soul over a host: how far behind and above it hovers, and how fast it follows (0..1 per tick). */
export const HOST_SOUL = {
  dx: -5,
  dy: -9,
  follow: 0.12,
  alpha: 0.42,
  /** The ghostly helmet over the host's head. */
  helmetAlpha: 0.62,
} as const;
