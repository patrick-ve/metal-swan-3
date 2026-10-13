/**
 * ROBO-HALSEMA — shared layout and numbers (docs/design/amsterdam.md §3).
 *
 * Local coordinates for the robot drawn FACING RIGHT: the anchor (0, 0) is the floor point
 * between her feet; y grows down (the top of the hair is at y −164). She faces LEFT in the arena
 * (`facing` −1), so the boxes are mirrored there. Every art piece shares this anchor.
 *
 * Reach (measured, see tests/content/boss-ams.test.ts): the medallion centre is 76 px above the
 * floor. Once the arm and the chain are gone, a 45° pistol shot (up + toward) from a standing
 * player reaches it from about 30–84 px in front of her anchor; the chain from about 84–132 px.
 */
export const MAYOR = {
  /** Sprite canvas (local bounds): every body strip is drawn on this box. */
  canvas: { x0: -46, y0: -178, x1: 92, y1: 2 },
  /** Hurtboxes (unflipped). */
  box: {
    /** The giant GESLOTEN stamp and the forearm, held low in front (idle). */
    armLow: { x: 24, y: -74, w: 58, h: 70 },
    /** The stamp raised over her head (stamp slam telegraph). */
    armHigh: { x: 14, y: -156, w: 64, h: 52 },
    /** The stamp down on the floor in front (slam and recovery). */
    armSlam: { x: 26, y: -76, w: 62, h: 76 },
    /** The silver chain of office across the chest (with the enamel shields). */
    chain: { x: -22, y: -112, w: 62, h: 24 },
    /** The big round medallion (core) at the bottom of the chain: centre (−2, −76). */
    medallion: { x: -17, y: -91, w: 30, h: 30 },
    /** The head: the face and the crown of the big wavy wig (optional bonus part, the letter hatch on top). */
    head: { x: -28, y: -164, w: 54, h: 54 },
    /** Armoured legs and hips (shots ping; blasts reach the nearest live part). */
    legs: { x: -24, y: -46, w: 46, h: 46 },
    /** Armoured back of the blouse (behind the medallion). */
    torso: { x: -32, y: -104, w: 16, h: 58 },
  },
  /** Medallion centre (shield-shot muzzle) and the hair hatch (letter launch point). */
  medallionC: [-2, -76] as const,
  hatch: [-7, -160] as const,
  /** Speech point over the head. */
  sayAt: [64, -116] as const,
  /** The stamp lands here (centre of the GESLOTEN block on the floor). */
  slamX: 57,
  slamW: 56,
  slamH: 22,
  /** NORMAL numbers (the code scales them with the difficulty). */
  /**
   * Part HP. The brief lists 400 / 350 / 450 / 250 (pistol units of 10); that fight lasted 11 s
   * for the scripted pistol + grenade player (the other bosses: 46–119 s). ×3 keeps the brief's
   * ratios and puts the time to kill near the 60–120 s target for a real player.
   */
  hp: { arm: 1200, chain: 1050, medallion: 1350, head: 750 },
  score: 20000,
  /** Intro: she steps out of the doors and walks `step` px forward. */
  intro: { dim: 36, walk: 64, step: 40, total: 200 },
  phaseIntermission: 60,
  stamp: { tele: 30, slam: 8, rec: 50, waveSpeed: 2.5, waveW: 14, waveH: 14 },
  letters: { tele: 24, min: 4, max: 6, gap: 6, rec: 40, fall: 0.7, sway: 1.1, hp: 10 },
  whip: { tele: 28, out: 8, hold: 5, back: 8, reach: 124, rec: 44, high: [22, 38] as const, low: [0, 14] as const },
  /**
   * Shield fan angles (° below the horizon; NORMAL the first 5, HARD all 6). Fair lanes (see
   * tests/content/boss-ams.test.ts): standing 149–189 px and crouching 69–80 / 149–236 px in front
   * of the muzzle are safe (HARD: the 6th shot at 42° closes the near crouch lane).
   */
  fan: { tele: 24, speed: 2.2, angles: [6, 12, 30, 54, 72, 42] as const, rec: 40 },
  stomp: { tele: 24, dist: 48, air: 22, lift: 18, land: 6, rec: 30 },
  adds: {
    /** Phase 1: a handhaver from an arena side every `every` ticks, at most `max` alive. */
    officerEvery: 420,
    officerMax: 3,
    /** Phase 2: a flock of `flock` gulls every `every` ticks (none while gulls are still alive). */
    gullEvery: 600,
    flock: 3,
    /** Phase 3: a delivery rider pass from alternating sides. */
    riderEvery: 360,
    riderMax: 1,
  },
  death: 230,
} as const;

export const MAYOR_NAME = 'ROBO-HALSEMA';
export const MAYOR_SUBTITLE = 'THE IRON MAYOR';
/** Tag carried by her adds (the cap counts it). */
export const ADD_TAG = 'ams-mayor-add';
