/**
 * GOUDEN GERRIT's numbers (docs/design/sewers.md §4.1; wave P1b A). Pure data: no imports, so tests
 * and tools read them without the art. NORMAL difficulty; telegraphs and recoveries scale with the
 * difficulty (`Boss.telegraphFor` / `recoveryFor`, never below 18 ticks). Local boxes are relative
 * to the anchor (the middle of the limo on the floor) for the UNFLIPPED limo (its nose at +x); the
 * limo stands facing −1 (its nose toward the heroes, left), so the boss mirrors them. Px, ticks,
 * px/tick.
 */

export const GERRIT_ID = 'sewers-gerrit';
export const GERRIT_NAME = 'GOUDEN GERRIT';
/** Sprite prefix (the `sewers-` segment keeps it in the lazy chunk). */
export const GERRIT_ART = 'boss/sewers-gerrit';
/** Tags: the boss, and the bodyguards out of the back door. */
export const GERRIT_TAG = 'sewers-gerrit';
export const GUARD_TAG = 'sewers-gerrit-guard';

export const GERRIT = {
  /** Points (the mini-boss row of the euro table pays € 150,00). */
  score: 10000,
  hp: {
    /** The white stretch limo (required). */
    limo: 900,
    /** Gerrit in the sunroof (required). */
    gerrit: 500,
  },
  /** The limo: 120 px long, its roof a platform at y 148 on the walk line 176 (28 px over the floor). */
  limo: {
    halfW: 60,
    roof: 28,
    /** The hurtbox is 2 px bigger than the solid on every open side (a shot that stops at the solid still hits). */
    box: { x: -62, y: -30, w: 124, h: 30 },
  },
  /** The sunroof: Gerrit's x (local, unflipped: toward the tail) and his hurtbox while up. */
  sun: {
    x: -8,
    box: { x: -16, y: -58, w: 16, h: 30 },
    /** His figure's anchor sits this far below the roof line (the hips inside the car). */
    hip: 15,
    /** Ticks to rise out of the sunroof / to duck into it; px he sinks when down. */
    rise: 10,
    duck: 10,
    sink: 26,
  },
  /** Phase 1 (both parts > 50 %): the shotgun. */
  volley: {
    /** TELL: he pumps it, a gold glint (`sewers/shotgun-pump`). */
    tele: 24,
    /** 3 pellets: the middle one at the target's chest (24 px over his feet), one 10° above, one 10° below. */
    pellets: 3,
    spreadDeg: 10,
    chestY: 24,
    /** Pellet speed (× the difficulty's enemy bullet speed), size, life. */
    speed: 2.6,
    size: 3,
    life: 160,
    /** The mid pellet's angle stays inside these (deg below the horizontal: + is down). */
    minDeg: -20,
    maxDeg: 45,
    /** He stays up this long after a volley (the window), then ducks (spec: 60). */
    up: 60,
    /** Down in the car (invulnerable) before the next volley (*start*; × recovery). */
    down: 90,
  },
  /** The back door: a bodyguard steps out (spec: every 480 ticks, at most 2 alive). */
  door: {
    every: 480,
    /** The first one comes this long after the fight starts (*start*). */
    first: 240,
    maxAlive: 2,
    /** The door stands open this long. */
    open: 40,
    /** He steps out this far in front of the nose. */
    out: 14,
  },
  /** Phase 2 (the limo ≤ 50 %, or Gerrit knocked out): the horn roll. */
  roll: {
    /** TELL: the horn, the car rocks on its springs. */
    tele: 30,
    dist: 64,
    /** Out at up to `speed` (accelerating), a short stop, back at `back`. */
    speed: 2,
    accel: 0.15,
    back: 1,
    pause: 20,
    /** The nose's contact box while it rolls out (local, unflipped: at the nose; a hero on the roof is clear). */
    box: { x: 30, y: -24, w: 36, h: 24 },
    rec: 40,
  },
  /** Phase 2: the gold chain lob between volleys. */
  chain: {
    /** TELL: he swings it over his head (`enemy/windup`). */
    tele: 24,
    hp: 10,
    /** The arc's peak over the throw point and the flight's gravity. */
    peak: 48,
    gravity: 0.18,
    size: 8,
    life: 180,
    rec: 30,
  },
  /** The death: the limo breaks, Gerrit jumps out and flees into depth. */
  death: {
    wreck: 70,
    blasts: 4,
    /** Ticks before he jumps out after the wreck line, and the flee's length. */
    jump: 40,
    flee: 150,
    /** The flee: px/tick right and up (toward the bridge in depth), and the fade. */
    fleeVx: 1.6,
    fleeVy: -0.35,
  },
  /** The speaker point of his lines (local, unflipped). */
  sayAt: [-8, -64] as const,
  /** Intro: ticks he holds the shout pose after the rise before `GOUD IS GOUD!` (20 + 10 + 96 > the 120-tick banner). */
  sayAfter: 96,
} as const;
