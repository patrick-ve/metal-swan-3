/**
 * Shared geometry of the m4 bosses (art and logic use the same numbers).
 *
 * THE GRAND GRAND (GDD §10.4) — local space for the UNFLIPPED (right-facing) piano: the anchor is
 * the floor point under the middle of the body; the keyboard (the front) is at +x. In the arena it
 * faces left (`facing = -1`), so the base class mirrors every part box. Standing (phases 1–2) the
 * body rests on four 40 px piston legs; folded (phase 3) the body drops by `foldDy`.
 *
 * THE BIG HEAD (GDD §9.4) — anchor = the centre of the 160 × 120 head; never mirrored (it looks
 * at the audience). `moustache-left` is the tip on the screen's left.
 */

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export const PIANO = {
  /** Body (glossy case) 180 × 60 while standing. */
  body: { x: -90, y: -110, w: 180, h: 60 } as Box,
  /** Armoured case (the shots that hit it ping): blocks shots from under the body. */
  caseBox: { x: -90, y: -84, w: 180, h: 34 } as Box,
  /** The lid closed (the upper jaw, with its front lip over the keyboard). */
  lidBox: { x: -86, y: -126, w: 200, h: 38 } as Box,
  /** Lid hinge (the back of the top) and its length to the front lip. */
  hinge: [-88, -112] as const,
  lidLen: 190,
  /** Widest opening of the lid (degrees). */
  lidOpenMax: 16,
  /** The keyboard (the teeth) at the front. */
  keyboardBox: { x: 88, y: -88, w: 18, h: 34 } as Box,
  /** The gold harp frame inside the body (exposed when the lid is gone). */
  stringsBox: { x: -72, y: -108, w: 152, h: 24 } as Box,
  /** Front piston legs (standing / folded). */
  frontLegsBox: { x: 52, y: -52, w: 26, h: 52 } as Box,
  frontLegsFolded: { x: 52, y: -16, w: 26, h: 16 } as Box,
  /** Leg x (front / back pair) and the castor radius. */
  legFront: 70,
  legBack: -70,
  legLen: 40,
  castorR: 5,
  /** Contact boxes: the legs while standing; the whole body during the Castor Charge. */
  legContact: { w: 16, h: 52 },
  /** Body drop when the legs fold (phase 3: the strings' top is 60 px over the floor). */
  foldDy: 44,
  /** The Countess: her seat (hips) on the bench at the back of the top. */
  seat: [-58, -126] as const,
  /** Seat when the lid is gone (she sits on the case rim). */
  seatNoLid: [-58, -112] as const,
  /** Mouth (bite) zone in front of the keyboard: 56 × 40 at the jaw. */
  bite: { x: 100, y: -130, w: 56, h: 40 } as Box,
  /** The mouth point where felt hammers leave. */
  mouth: [100, -92] as const,
  /** Home and walking range of the anchor (view x); the front stays right of view 150. */
  homeView: 290,
  minView: 262,
  maxView: 300,
  /** Castor Charge: the front stops at this view x (left balcony is safe above it). */
  chargeFront: 6,
  /** Chandeliers (view x) and their hanging height (top of the 32 × 24 crystal). */
  chandeliers: [60, 180, 300] as readonly number[],
  chandelierY: 6,
} as const;

export const HEAD = {
  /** Full blimp 160 × 120 around the anchor. */
  size: { w: 160, h: 120 },
  head: { x: -56, y: -46, w: 112, h: 58 } as Box,
  speaker: { x: -18, y: 14, w: 36, h: 24 } as Box,
  moustacheLeft: { x: -80, y: -2, w: 24, h: 16 } as Box,
  moustacheRight: { x: 56, y: -2, w: 24, h: 16 } as Box,
  /** Gun pod muzzles (tips) relative to the anchor. */
  tipLeft: [-78, 4] as const,
  tipRight: [78, 4] as const,
  /** Mouth (cone origin), the hat hatch (leaflets) and the gondola door (paratroopers). */
  mouth: [0, 30] as const,
  hatch: [0, -56] as const,
  gondola: [0, 56] as const,
  /** The top edge bobs between y 4 and y 20 (anchor y 64 … 80). */
  topMin: 4,
  topMax: 20,
  /** Drift range of the anchor (view x) and its speed. */
  minView: 90,
  maxView: 294,
  homeView: 250,
  drift: 0.5,
  /** Sonic cone: width at the mouth and at the ground. */
  coneTop: 18,
  coneBottom: 64,
} as const;
