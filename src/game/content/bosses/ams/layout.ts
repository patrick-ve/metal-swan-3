/**
 * MECHA HASLEMA — the presentation schedule of her baked strips (draw only: mayor.ts picks the
 * frame roles of `ams-mayor.gen.ts` by these ticks). Logic time, telegraphs, hit windows and
 * hitboxes are geometry.ts and mayor.ts (decision D7): nothing here moves a box or a tick of the
 * fight. The art (joints, poses) is drawn offline in tools/art40/chars/ams-mayor/.
 */

/** The stamp slam, in ticks since the raise / the slam (ARM_* roles). */
export const STAMP_SHOW = {
  /**
   * The wind-up: the dip until 2, the coil until 5, the rise in five in-betweens (RISE_LOW, RISE_A,
   * RISE_MID, RISE_B, RISE_HIGH) until 7, 9, 11, 13 and 15, the overshoot until 19.
   */
  antic: 2,
  coil: 5,
  riseLow: 7,
  riseA: 9,
  riseMid: 11,
  riseB: 13,
  riseHigh: 15,
  over: 19,
  /** The trembling hold: RAISED / TREMBLE, this many ticks each. */
  tremble: 3,
  /** The last ticks before the slam: SMEAR for the first half, SMEAR_LOW for the second. */
  smear: 4,
  /** After the slam: IMPACT, SLAM, RECOIL, SETTLE until these ticks, then SLAM (on the floor). */
  impact: 3,
  slam: 5,
  recoil: 9,
  settle: 13,
  /** Back to low: LIFT, then LOWER, until these ticks. */
  lift: 4,
  lower: 8,
  /** The death: the stamp rests on the floor (SAG) once she has sat this far down. */
  sag: 15,
} as const;

/** The chain whip (BACK_* / LASH_* roles). */
export const WHIP_SHOW = {
  /** The wind-up before the whirl. */
  wind: 4,
  /** Ticks per 45° whirl step, and the last telegraph ticks that whirl one step per tick. */
  step: 2,
  fast: 6,
  /** The snap at full reach (SNAP_A, then SNAP_B). */
  snap: 3,
  /** The catch after the whip (the arm in front, the chain gathered). */
  catch: 8,
} as const;

/** The stomp hop (LEGS_* roles), in ticks since the change. */
export const STOMP_SHOW = { half: 4, pushOff: 4, tuck: 15, land: 3 } as const;

/** The head (HEAD_* roles): the shout's in-breath, the hatch, the blink every 150 ticks, the bald wobble. */
export const HEAD_SHOW = { shoutIn: 3, ajar: 6, close: 4, blinkEvery: 150, blink: [2, 4, 6] as const, bald: 8, offFlicker: 12 } as const;

/** The medallion (MED_* roles): the opening, the charge, the flash at the volley, the close. */
export const MED_SHOW = { crack: 3, part: 6, charge: 6, pulse: 4, settle: 6, flash: 4, cool: 3, close: 4 } as const;

/**
 * The death wig (draw only): its anchor in the boss's local frame (tools/art40/chars/ams-mayor/wig.py
 * ANCHOR: the launch point and the centre of the tumble; the baked frames keep the floor origin), and
 * the anchor's height over the floor once it has landed (frame 0's lowest row is 32 px under the
 * anchor, so it rests on the floor).
 */
export const WIG_ANCHOR = [-6, -128] as const;
export const WIG_REST = 33;
