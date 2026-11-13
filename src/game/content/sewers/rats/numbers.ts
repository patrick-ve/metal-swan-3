/**
 * The numbers of the four rats (docs/design/sewers.md §3; NORMAL; *start* values). Pure data.
 * Speeds in px per tick, times in ticks, boxes relative to the feet anchor, facing right.
 * Euro values live in `budget/euro-table.ts` (runner € 2, leaper € 3, spitter € 4, brute € 15).
 */

/** Sprite prefixes (`enemy/sewers-rat-runner/run` …: the `sewers-` segment routes them to the lazy chunk). */
export const RAT_ART = {
  runner: 'enemy/sewers-rat-runner',
  leaper: 'enemy/sewers-rat-leaper',
  spitter: 'enemy/sewers-rat-spitter',
  brute: 'enemy/sewers-rat-brute',
  /** The spitter's slime blob and its puddle. */
  slime: 'fx/sewers-rat-slime',
} as const;

/** Shared by every rat. */
export const RAT = {
  /** The eyes flash white for the first ticks of every tell (lit and dark). */
  eyeFlash: 6,
  /** Rising out of a hole: ticks. */
  rise: 24,
  /** A rat that waits (`delay` param) stays hidden and harmless this many ticks first. */
  maxDelay: 600,
  /** Green slime chunks on a defeat. */
  slime: 6,
} as const;

/**
 * `sewers-rat-runner`: dog-sized, packs of 3–6, 10 HP, 2.4 px/tick. Tell 18 (rears up, squeak) →
 * a bite lunge (reach 14 px ahead of the snout). The hurtbox (20 × 20) is taller than the art
 * (~22 × 15) so a standing hero's shot (y −19 … −23) hits it, and a crouched one too.
 */
export const RUNNER = {
  hp: 10,
  score: 100,
  speed: 2.4,
  tele: 18,
  /** The tell starts with the target this far ahead (px, feet to feet) or nearer. */
  start: 30,
  /** The lunge: ticks, speed; the bite box (ahead of the anchor, low: a jump clears it). */
  biteTicks: 8,
  biteSpeed: 2.0,
  bite: { x: 4, y: -14, w: 14 + 6, h: 12 },
  /** After the bite: runs on past the hero this long before it turns. */
  recover: 26,
  /** Turn hysteresis (px behind, ticks). */
  turnDist: 20,
  turnHold: 10,
  box: { w: 20, h: 20 },
} as const;

/**
 * `sewers-rat-leaper`: waits in a pipe stub (mouth at sim y 150) or a floor grate; 10 HP. Tell 24
 * (eyes flash, hiss) → an arc jump to the hero's x at the tell's start (peak 48 px), one try; then
 * it runs as a runner at 2.0 px/tick.
 */
export const LEAPER = {
  hp: 10,
  score: 150,
  speed: 2.0,
  tele: 24,
  /** Wakes when a hero is within this many px (x) and the mouth is in view. */
  wake: 150,
  peak: 48,
  gravity: 0.13,
  /** The default mouth y of a pipe stub (spec §3). */
  pipeY: 150,
  box: { w: 20, h: 20 },
  /** The hurtbox while it waits in a pipe mouth (the head; a standing hero's shot reaches it). */
  lurkBox: { x: -8, y: -8, w: 16, h: 14 },
  /** The hurtbox while it waits in a floor grate (taller than the head: shots at chest height hit). */
  grateBox: { x: -8, y: -20, w: 16, h: 20 },
} as const;

/**
 * `sewers-rat-spitter`: sits on a one-way plinth (y 148, 48 px wide; two plinths 96 px apart),
 * 20 HP, hops to the other plinth every 3rd spit. Tell 24 (cheeks puff, gurgle) → a slime blob in
 * an arc to where the hero stands; splash 16 px; a 120-tick puddle that only looks wet. Every 150.
 */
export const SPITTER = {
  hp: 20,
  score: 300,
  tele: 24,
  every: 150,
  /** The first spit after it sees a hero. */
  first: 40,
  /** Spits per plinth before the hop. */
  hopEvery: 3,
  hopTicks: 36,
  hopPeak: 28,
  /** The blob's flight time (ticks) and gravity. */
  blobTicks: 44,
  blobGravity: 0.12,
  splash: 16,
  puddle: 120,
  damage: 10,
  /** Shoots only at a hero within this range (px, x). */
  range: 240,
  box: { w: 18, h: 16 },
  /** One that came in by an entry sits on the floor: as tall as a runner's box (P2: a standing shot hits it). */
  floorBoxH: 20,
} as const;

/** The plinths of a spitter (spec §3): one-way platforms, y 148, 48 px wide, 96 px apart. */
export const PLINTH = { y: 148, w: 48, gap: 96 } as const;

/**
 * `sewers-rat-brute`: horse-sized (~56 × 34), 120 HP, 0.8 px/tick. Tell 30 (paws, snorts steam) →
 * a charge 96 px at 3.0 px/tick (contact box 30 px high: a jump clears its back); tell 24 (rears)
 * → a stomp, a ground wave 48 px each way (6 px high: a jump clears it).
 */
export const BRUTE = {
  hp: 120,
  score: 1000,
  speed: 0.8,
  tele: 30,
  stompTele: 24,
  chargeDist: 96,
  chargeSpeed: 3.0,
  /** The charge's contact box (the whole low body; its back at 30 px). */
  chargeBox: { x: -26, y: -30, w: 56, h: 30 },
  /** The stomp wave: reach each way, ticks to reach it, height. */
  wave: 48,
  waveTicks: 8,
  waveH: 6,
  /**
   * Picks the stomp with a hero this near (px), the charge with a hero `chargeNear` … `chargeFar`
   * ahead (the 96-px charge plus the snout reaches 126 px: it never charges from too far).
   */
  stompNear: 44,
  chargeNear: 56,
  chargeFar: 120,
  recover: 40,
  cool: 50,
  box: { w: 50, h: 32 },
} as const;
