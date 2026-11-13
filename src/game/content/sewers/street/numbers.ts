/**
 * The numbers of mission sewers' street cast (docs/design/sewers.md §3; owner P1a STREET). Pure data:
 * no imports, so tests and tools read them without the art. NORMAL difficulty; telegraphs scale with
 * the difficulty (`Creature.tele`, never below 18 ticks). Speeds in px/tick, times in ticks.
 * Points: the euro row × 50 (the legacy rule, so a points play pays the same order as the euros).
 */

/** `sewers-dealer`: hood up, hands in the coat; whisper, then a short knife jab. */
export const DEALER = {
  hp: 10,
  /** Points (€ 5,00 in a euro play: budget/euro-table.ts `EURO_BY_ID`). */
  score: 250,
  /** Sidle speed toward the hero. */
  speed: 1.2,
  /** The tell: looks left and right, opens his coat, the whisper. */
  tele: 20,
  /** The jab: ticks the knife box is live, and its reach ahead of the body. */
  jab: 6,
  reach: 20,
  /** The knife box (anchor-relative, facing right): 20 px ahead, belly height. */
  jabBox: { x: 4, y: -24, w: 20, h: 8 },
  /** The tell starts with the hero this close (px, along the facing) and this level (|dy|). */
  tellAt: 24,
  tellDy: 20,
  /** A small lunge during the jab. */
  lunge: 0.6,
  /** After the jab: stand, then back off 48 px (still facing the hero), then a pause. */
  recover: 12,
  back: 48,
  backSpeed: 1.2,
  cool: 30,
  /** `lurk`: he notices a hero this near (px) while on screen, then steps out for `step` ticks. */
  notice: 150,
  step: 16,
  stepSpeed: 0.8,
} as const;

/** `sewers-pimp`: loud suit, gold chains, a cane, a wide hat; the gold pistol and the whistle. */
export const PIMP = {
  hp: 30,
  /** Points (€ 12,00). */
  score: 600,
  /** The strut. */
  speed: 1.0,
  /** He struts until the hero is this far away, then stands and shoots. */
  hold: 120,
  /** Shots and the whistle only with the hero this near (px) and this level (|dy|). */
  range: 220,
  rangeDy: 40,
  /** The pistol: tell (adjusts his hat, cane under the arm), then 3 shots 10 ticks apart. */
  tele: 24,
  shots: 3,
  gap: 10,
  shotSpeed: 2.4,
  /** Shot height above the feet (chest: 22–26 px, a crouch with its 20 px hurtbox dodges it). */
  chestY: 24,
  shotW: 4,
  shotH: 2,
  shotLife: 200,
  /** After the volley, then the pause before the next try (difficulty-scaled, ± jitter). */
  recover: 30,
  cool: 100,
  coolJitter: 20,
  /** The whistle (once per pimp): tell 30 (two fingers in the mouth), the call held this long. */
  whistleTele: 30,
  whistleHold: 16,
} as const;

/** `sewers-bodyguard`: big, black suit, sunglasses, earpiece; walks, never runs; the shoulder charge. */
export const BODYGUARD = {
  hp: 40,
  /** Points (€ 8,00). */
  score: 400,
  speed: 0.9,
  /** The tell: cracks his knuckles, plants his feet. */
  tele: 24,
  /** The charge: 72 px at 2.4 px/tick (30 ticks); its box kills on contact. */
  charge: 72,
  chargeSpeed: 2.4,
  /** The charge box (anchor-relative, facing right): the shoulder and the chest, y −32 … −10. */
  chargeBox: { x: 2, y: -32, w: 16, h: 22 },
  /** The tell starts with the hero this near ahead (px) and this level (|dy|). */
  range: 84,
  rangeDy: 24,
  /** A whiff into a wall: knocked back, stunned this long. */
  stun: 40,
  knock: 1.2,
  /** After a whiff in the open, then the pause before the next try. */
  recover: 30,
  cool: 50,
} as const;

/** Every street person (dealer, pimp, bodyguard) when the rats burst out (spec §2.2, `streetFlee`). */
export const FLEE = {
  /** Run speed off the nearer screen edge. */
  speed: 2.6,
  /** Removed this far outside the view (px), or after this many ticks blocked, or at most after `max`. */
  margin: 16,
  blocked: 20,
  max: 600,
  /** The scream bubble. */
  bubble: 50,
  /** P2: screams of people closer than `near` px stack `rowDy` px apart, at most `rows` rows (the rest run off silent). */
  near: 72,
  rowDy: 18,
  rows: 2,
} as const;

/** After the swoon a fallen person crawls off (away from the nearest hero) this long, at this speed. */
export const CRAWL = { ticks: 70, speed: 0.4 } as const;

/** The mints gag pickup (`sewers-mints`): points (€ 0,50 by the legacy rule ÷ 50, rounded to € 0,50). */
export const MINTS = { score: 25, bubble: 40 } as const;

/** The look pools (spawn param `look`; else one by `world.fxRng`). */
export const DEALER_LOOKS = ['a', 'b', 'c'] as const;
export const PIMP_LOOKS = ['a', 'b'] as const;
export const BODYGUARD_LOOKS = ['a', 'b'] as const;
