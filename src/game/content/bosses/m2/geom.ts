/**
 * Shared geometry of the m2 bosses (art and logic use the same numbers).
 *
 * BA-DUM BEHEMOTH — local space: the anchor is the middle of the tread on the ground (y 0); the
 * machine faces LEFT (its front is −x) and is never mirrored (facing stays +1). About 240 × 170
 * (GDD §10.2): x −124 (the crash shield) … +100 (the tread), y −172 … 0. In the arena the tread's
 * rear may run off the right view edge (the patrol of GDD §10.2 is the anchor's view x).
 *
 * GOLDEN GOOSE — feet anchor between the two feet, faces LEFT, 96 × 96 standing (GDD §9.4).
 */

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export const BEHEMOTH = {
  /** Crimson treads, 200 × 28 (contact). */
  tread: { x: -100, y: -28, w: 200, h: 28 } as Box,
  /** Deck plate over the tread, under the drum (contact). */
  deck: { x: -96, y: -40, w: 192, h: 12 } as Box,
  /** The bass drum front skin (an ellipse in 3/4 view): centre and radii. */
  skinC: [-76, -70] as const,
  skinR: [28, 60] as const,
  /** The rear rim of the shell (3/4 view: back and slightly up). */
  rearC: [-30, -74] as const,
  /**
   * Hurtbox of the bass drum: the front face of the skin (shots from the left hit it; shots fired
   * up from the ledge that stands in front of the drum pass on to the toms).
   */
  bassBox: { x: -104, y: -126, w: 24, h: 112 } as Box,
  /** Tom turrets (32 × 24) on brackets over the front of the drum. */
  tomLeft: { x: -122, y: -154, w: 32, h: 24 } as Box,
  tomRight: { x: -82, y: -154, w: 32, h: 24 } as Box,
  /** Crash cymbal (56 px disc) on its stand arm: pivot and the disc centre in front / aside. */
  shieldPivot: [-96, -84] as const,
  shieldFront: [-114, -44] as const,
  shieldAside: [-70, -166] as const,
  /** Hurtbox size of the shield (vertical in front, flat when aside). */
  shieldFrontBox: { w: 20, h: 60 },
  shieldAsideBox: { w: 56, h: 12 },
  /** Hi-hat arm: the hydraulic root on the tread front, the head point at rest (the bottom of the lower cymbal). */
  armRoot: [-88, -22] as const,
  hihatRest: [-150, -78] as const,
  /** Hi-hat head (two 40 px cymbals) and its hurtbox (head + clutch rod) above the head point. */
  hihat: { w: 40, h: 20 },
  hihatBox: { w: 40, h: 32 },
  /** Wrist (top of the clutch rod) above the head point. */
  hihatRod: 34,
  /** The slam never lands right of this local x (in front of the drum). */
  slamMaxLocal: -112,
  /** Throne seat (Rimshot's hips) and his head while sitting / standing. */
  throne: [6, -126] as const,
  rimshotHead: [6, -156] as const,
  rimshotHeadStand: [6, -170] as const,
  /** Speech-bubble point (low enough that a two-line bubble stays inside the view). */
  speech: [-14, -112] as const,
  /** Where Rimshot throws sticks / the spare cymbal from (his hands, standing). */
  rimshotHands: [0, -160] as const,
  /** Beater pedal pivot on the deck behind the drum (its felt ball rests against the rear skin). */
  beater: [10, -40] as const,
  /** Patrol: the anchor's view x (GDD 230 … 290). */
  patrolMin: 230,
  patrolMax: 290,
  patrolSpeed: 0.4,
  /** Drum-Roll Charge: the tread front stops at this view x (view 0 … 120 is always safe). */
  chargeLine: 130,
  chargeSpeed: 2,
  backSpeed: 1,
  /** Lowest view x a hi-hat slam may reach. */
  slamMinView: 24,
} as const;

export const GOOSE = {
  /** Hull hurtbox 60 × 36 (the core: the belly and the undercarriage, low enough for standing shots). */
  hull: { x: -30, y: -54, w: 60, h: 36 } as Box,
  /** Neck root on the hull front (the neck turns about it). */
  neckRoot: [-24, -56] as const,
  /** Neck length root → head centre. */
  neckLen: 34,
  /** Neck hurtbox (22 × 26) centred on the head point. */
  neckBox: { w: 22, h: 26 },
  /** Canopy (the pilot's glass) centre for bubbles / the pilot's exit. */
  canopy: [8, -72] as const,
  /** Neck angles of the strip frames (degrees; 0 = the beak points forward, − = up). */
  neckAngles: [-75, -60, -45, -30, -15, 0, 10, 20] as readonly number[],
  /** Rest angle of the neck. */
  neckRest: -60,
  /** Where eggs drop out (under the tail). */
  eggPort: [26, -30] as const,
  /** Home: view x 300; Goose Step never goes left of view 72. */
  homeView: 300,
  minView: 72,
  maxView: 340,
  /** Contact box (the legs and the body: touching the goose hurts). */
  body: { x: -26, y: -60, w: 52, h: 60 } as Box,
} as const;
