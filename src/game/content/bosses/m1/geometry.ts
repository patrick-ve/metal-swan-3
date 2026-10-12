/**
 * THE ENCORE — shared layout (GDD §10.1). Local coordinates for the boat drawn FACING RIGHT:
 * the bow tip is the anchor (x 0) and the waterline is y 0; the stern is at x −288.
 *
 * Phase 1 the boss faces left (bow toward the players, the anchor = the bow, the boat reaches
 * right past the view). For phases 2–3 it turns around behind a splash cloud: the anchor moves
 * 288 px right and it faces right, so the STERN (the paddle wheel) sits where the bow was.
 */
export const ENC = {
  /** Overall length (bow tip → stern). */
  len: 288,
  /** Deck line (the hull top) and the bottom of the hull (4 px under the waterline). */
  deckY: -52,
  keelY: 4,
  /** Sprite buffer origin: local (0, 0) is buffer pixel (OX, OY). */
  OX: 291,
  OY: 151,
  W: 296,
  H: 158,
  /**
   * Foghorn: swivel pivot (sprite anchor) and the hurtbox. Mouth = pivot + mouth. The horn and
   * calliope boxes reach 8 px below the deck line (y −44) so a player on the low floating crate
   * (30 px over the river) can hit them; from the pontoon it takes a jump.
   */
  horn: { pivot: [-26, -58] as const, mouth: [24, -2] as const, box: { x: -44, y: -78, w: 44, h: 34 } },
  /** Calliope: the base anchor (feet), 6 pipe tops (x, y) low → high, the hurtbox. */
  calliope: {
    anchor: [-88, -54] as const,
    pipes: [
      [-108, -72],
      [-99, -76],
      [-90, -80],
      [-81, -84],
      [-72, -88],
      [-63, -92],
    ] as const,
    box: { x: -118, y: -96, w: 60, h: 52 },
  },
  /** Bridge window: Blare's head-and-shoulders sprite anchor (window sill centre) and the opening. */
  bridge: { window: [-139, -76] as const, hole: { x: -149, y: -96, w: 21, h: 20 } },
  /** Funnel bell tops (soot balls leave here). */
  funnels: [
    [-186, -142],
    [-214, -136],
  ] as const,
  /** Paddle wheel: centre, radius, hurtbox (exposed from phase 2). */
  wheel: { c: [-256, -26] as const, r: 32, box: { x: -286, y: -58, w: 60, h: 56 } },
  /**
   * Armoured hull box (pings shots; blasts against it reach the nearest live part). Its top sits
   * 8 px under the deck line so shots skimming the deck reach the horn and the calliope.
   */
  hull: { box: { x: -222, y: -44, w: 222, h: 48 } },
  /** Deckhand (barrels) on the stern deck, feet; the barrel he holds overhead (from his feet). */
  deckhand: [-232, -52] as const,
  barrelHeld: [0, -44] as const,
  /** Blare on the stern rail in phase 3 (feet) and the trombone slide tip (from his feet, facing the stern). */
  rail: [-238, -52] as const,
  bell: [30, -22] as const,
} as const;

/** GDD §10.1 numbers (NORMAL; the code scales them with the difficulty). */
export const ENCORE = {
  hp: { horn: 1100, calliope: 1300, wheel: 1600 },
  score: 30000,
  /** Phase 3 starts when the wheel is below this many HP (of 1600, before scaling): 0.2 of 4000. */
  phase3At: 0.2,
  intro: 300,
  steam: { tele: 40, gap: 8, rec: 60, offsets: [-48, -24, 0, 24, 48], puffTicks: 20, puffW: 24, puffH: 16 },
  foghorn: { tele: 50, speed: 3, rec: 40, h: 16, w: 10, low: 0, high: 22 },
  allHands: { every: 600, x: -48, maxAlive: 4 },
  paddle: { tele: 60, speed: 2, rec: 50, h: 24, w: 18 },
  barrels: { tele: 24, n: 3, gap: 20, speed: 1.2, rec: 40, size: 16, hp: 20 },
  soot: { tele: 40, n: 4, vx0: -1.5, vx1: -3.0, vy: -3.0, g: 0.12, rec: 50, r: 10 },
  slide: { tele: 30, n: 3, gap: 30, speed: 4, rec: 40, chest: 24, ankle: 4 },
  /** Phase 3: cooldowns × 0.8; the hull sinks 1 px per 60 ticks up to 16 px. */
  phase3Rate: 0.8,
  sinkEvery: 60,
  sinkMax: 16,
  /** One part gone in phase 1: the other's cooldowns × 0.8. */
  lonePartRate: 0.8,
  /** Turn-around (phase 1 → 2) and the second encore (phase 2 → 3) pauses. */
  turnTicks: 96,
  encoreTicks: 60,
  death: 300,
} as const;

export const ENCORE_NAME = 'THE ENCORE';
export const ENCORE_SUBTITLE = 'COMMODORE BLARE WILL NOT LEAVE THE STAGE';
