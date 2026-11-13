/**
 * The numbers of DE RATTENJONG's fight (docs/design/sewers.md §2.5, §4.2; NORMAL; *start* values).
 * Pure data. Speeds in px per tick, times in ticks, boxes relative to the feet anchor (facing right;
 * mirrored when he faces left). The arena is the sewers-e lock 864–1,248 (terrain.ts `SEWERS_E`).
 */

/** Sprite prefixes (the `sewers-` segment routes them to the lazy chunk). */
export const KING_ART = 'boss/sewers-rattenjong';
/** The suffix of the eyes-only strip of every pose (`boss/sewers-rattenjong/sit-eyes`; P2: emitters). */
export const KING_EYES = '-eyes';
/** The throne pile and the hall's eyes. */
export const THRONE_ART = 'decor/sewers-rattenjong-throne';
/** The throws: `<prefix>/bike`, `/bike-part`, `/cart`, `/scooter`, `/scrap`. */
export const THROW_ART = 'fx/sewers-rattenjong';
/** The tag of the rats his phase-2 squeak calls up (the flood washes them away). */
export const KING_RAT_TAG = 'sewers-e-kingrat';
/** The boss bar name. */
export const KING_NAME = 'DE RATTENJONG';

export const KING = {
  /** One pool (× difficulty × co-op); 20,000 points (€250 is the boss row of the euro table). */
  hp: 4000,
  score: 20000,
  /** Every hit he deals (players die on any hit). */
  damage: 10,
  /** His seat on the throne (the pile's top centre) and the throne's span (spec §2.5: x 1,000–1,200). */
  homeX: 1100,
  throne: [1000, 1200] as const,
  /**
   * The pile's top (his feet on the throne) per level: phase 1 at 128 (his hitbox y 86–128), then
   * three small steps down in phase 2 (spec §4.2: the pile art lowers, his hitbox comes down with
   * it). Moved from the spec's 140 (hitbox 96–140) by the god-bot's arena rule (sim/bot.ts): a
   * boss part ≤ 40 px above its gun (y 154) gets level fire, so on the throne his body's centre
   * stays > 40 px above it (the bot takes its 45° stand-off, a player aims up or 45°), and a level
   * shot from a trash ledge (gun y 128) still reaches his lowest pixels.
   */
  tops: [128, 130, 132, 134] as const,
  /** Phase 2 lowers the pile one level at each of these HP fractions. */
  shrinkAt: [0.6, 0.5, 0.4] as const,
  /** Ticks the pile takes to settle one level. */
  shrinkTicks: 20,
  /** Phase starts (HP fractions; spec §4.2: 100–66 %, 66–33 %, < 33 %). */
  phase2At: 0.66,
  phase3At: 0.33,
  /** The fight's pause at a phase change (GDD §10.0). */
  intermission: 60,
  /** The intro: he rises and screeches (invulnerable). */
  introTicks: 70,
  /** Hurt boxes: seated on the pile; on foot. */
  box: {
    /** Seated: his bulk with the arms and the tail curled round (80 px wide: a shot straight up from his flank hits). */
    sit: { x: -40, y: -42, w: 80, h: 42 },
    foot: { x: -34, y: -44, w: 68, h: 44 },
    /**
     * The charge's contact box: his lowered head, 24 px high. A hero's jump (apex ≈ 47 px) clears
     * it, and a hero on a trash ledge (feet 26 px up) stands above it (spec "jump over his head").
     */
    ram: { x: 16, y: -24, w: 24, h: 24 },
    /** The tail sweep: a low ring round him, 10 px high (jump it; the ledges are safe). */
    tail: { x: -84, y: -10, w: 168, h: 10 },
    /** The bite: 24 px past the front of his body, at chest height. */
    jaw: { x: 30, y: -34, w: 28, h: 20 },
  },
  /** Throws (phase 1 every 90 ticks; phase 2 every 120 between the waves). */
  throwEvery: [120, 140] as const,
  /** Where the thrown thing leaves his paws (above his head). */
  hands: { x: 4, y: -50 },
  bike: { tele: 30, hp: 24, vy: -4.4, gravity: 0.12, w: 22, h: 14, parts: 2, partVx: 1.5, partVy: -2.2, partGravity: 0.2, partBounces: 2 },
  cart: { tele: 24, speed: 2.5, gravity: 0.25, w: 20, h: 14 },
  scooter: { tele: 24, vx: 2.4, vy: -0.6, gravity: 0.16, w: 18, h: 10, bounces: 2, keep: 0.55 },
  /** Phase 2: the squeak (all the hall's eyes light up), then a wave down the pile. */
  wave: { tele: 40, every: 480, runners: 6, spitters: 1, gap: 26, cap: 12 },
  /** Phase 3: the jump down to the walk band (tell: crouch, the pile shakes). */
  jump: { tele: 40, ticks: 36, peak: 30, dx: -60 },
  walk: { speed: 1.0, near: 60, max: 90, stride: 8 },
  /** The charge; with less than `room` px ahead he first backs off toward the middle (at most `backoff` ticks). */
  charge: { tele: 30, speed: 3.2, max: 140, daze: 60, room: 96, backoff: 70 },
  tail: { tele: 24, live: 12, rec: 26 },
  bite: { tele: 20, live: 6, lunge: 8, rec: 24, near: 64 },
  /** His x stays this far inside the arena's edges on foot. */
  margin: 40,
  /** The end (spec §4.2 "End"). */
  end: { back: 40, crack: 50, flood: 120, floodY: 190, washAfter: 30, washSpeed: 2.6 },
} as const;
