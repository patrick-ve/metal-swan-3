/**
 * Geometry of the ring's road hazards (docs/design/ring.md §7), shared by the art (art.ts) and the
 * entities (gantry.ts, closure.ts, camera.ts, jam.ts).
 *
 * THE GANTRY CROSSES THE ROAD. The side view draws depth as screen y; a structure that spans the
 * carriageway is drawn a little OBLIQUE so it reads as crossing the lanes: its far end leans right
 * (`SLANT` px of x per px of depth), so the beam runs from the far post on the median (up right)
 * to the near post beyond the hard shoulder (down left), and each lane's sign hangs over that lane
 * at `BEAM_H` above it. Lines along the road stay horizontal.
 */
import { LANE_Y } from '../../../ring/lanes';

/** x lean per px of depth (far = right) of a structure across the road. */
export const SLANT = 0.6;
/** The plane y about which the lean is measured (the road's middle). */
export const P_REF = 157;
/** Height of the gantry beam above the road (px). */
export const BEAM_H = 66;
/** Plane y of the far post (on the median) and the near post (beyond the hard shoulder). */
export const FAR_P = 111;
export const NEAR_P = 209;

/** x offset (from the gantry's x) of the point of the gantry over plane y `p`. */
export function slantX(p: number): number {
  return (P_REF - p) * SLANT;
}

/** The far post's x offset from the gantry x (its sprite is anchored at its own foot). */
export const FAR_POST_DX = Math.round(slantX(FAR_P));

/** Sign faces of the matrix signs (strip `ring/hazard/sign`, one frame each). */
export const SIGN_FACES = ['', 'x', 'arrow-far', 'arrow-near', '50', '80', '100', 'end'] as const;
export type SignFace = (typeof SIGN_FACES)[number];

/** A sign face code → its frame (unknown codes: blank). */
export function signFrame(face: string): number {
  const i = (SIGN_FACES as readonly string[]).indexOf(face);
  return i < 0 ? 0 : i;
}

/** Faces that blink the amber corner flashers. */
export function flashes(face: string): boolean {
  return face === 'x' || face === 'arrow-far' || face === 'arrow-near' || face === '50';
}

/** The matrix sign's size (logical px) and how far below the beam its centre hangs. */
export const SIGN_W = 20;
export const SIGN_H = 18;
export const SIGN_DROP = 14;

/** Centre of lane `lane`'s sign relative to (gantry x, 0): x offset and screen y. */
export function signAt(lane: number): [number, number] {
  const p = LANE_Y[lane - 1];
  return [slantX(p), p - BEAM_H + SIGN_DROP];
}

/** The truss sprite's anchor plane (the near post's base). */
export const TRUSS_P = NEAR_P;

// ---------------------------------------------------------------------------------------------
// Closure
// ---------------------------------------------------------------------------------------------

/** A lane closure's parts along x (from its start, the upstream end where the traffic arrives). */
export const CLOSURE = {
  /** The arrow trailer (its middle) and the crash-absorber truck's x range. */
  trailer: 12,
  truck: [30, 108] as const,
  /** The head zone: hitting it costs `headCells` and stops the wagon. */
  head: [-2, 108] as const,
  /** Cones: a taper before the head, then every `coneGap` px to the end. */
  taper: [-72, -48, -24] as const,
  coneGap: 22,
  /** Default length of the closed stretch (px). */
  length: 448,
} as const;

/** Where the arrow board's face sits on the trailer (centre, relative to the trailer anchor). */
export const BOARD_AT: readonly [number, number] = [0, -27];

/** The absorber truck's sprite size; the cone's. */
export const TRUCK_W = 80;
export const CONE_H = 11;
