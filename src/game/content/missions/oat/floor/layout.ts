/**
 * The street layout of the oat floors (STREET-A, wave A; docs/design/oat.md §2.1, §2.5, §8.2, §8.4,
 * §8.7 a 6, §8.10): the depths of the street's bands, the stretches of oat-a and of the oat-d night
 * proof strip, and the LOCAL sun model the floor painter and the wetness field read.
 *
 * Depths are the floor's unit (screen px behind the walk line on flat ground; docs/api/floor.md §2):
 *
 *   house stretch (8.2 m, the 9 Straatjes): the façades at 16 (the back edge, y 160) · the narrow far
 *   pavement (dikformaat bricks, stretcher bond) · the granite kerb (12 cm: 2 px, a lit top) · the
 *   one-way clinker street in herringbone (no bike lane), the walk line at 0 · the near kerb · the
 *   near pavement (grey 30 × 30 tiles) to the screen bottom (−40).
 *   open quay: the same street; the far pavement is the quay paving with the stone coping at the
 *   back edge (the canal behind it: decor, art/bridges.ts).
 *   bridge: a deck of herringbone brick over the hump (the terrain's hill) from the back edge to the
 *   near railing, the canal under it in front (a water cut) with the brick arch as the deck's face.
 *   canal-front (oat-d): our row behind, a narrow pavement, the quay street, the stone coping at
 *   −14 … −16.5, the canal in front to the screen bottom.
 *
 * THE SUN (spec §8.3, §8.4; decision 37: left and in front) is LIGHT-WATER's one shade model
 * (missions/oat/light/ `sectionShade(id).floor(u, v, d)`: the opposite row behind the camera and the
 * casters this kit registers from its decor, `castersFromDecor`). The floor painter and the wetness
 * field both read it, so the dry sun strips are exactly where the light is.
 */
import { G } from '../terrain';

/** The camera of every oat street floor (spec §2.1: `yh` 60, `f` 210, façades 16 px behind the feet). */
export const OAT_CAMERA = { yh: 60, f: 210, back: 160 } as const;
/** The façade plane (the back edge): depth 16 (base at screen y 160, s 0.862). */
export const FACADE = 16;
/** The far pavement's kerb line (its face looks at the camera) and the kerb stone's top band. */
export const FAR_KERB = 11.5;
export const KERB_W = 1.1;
/** The near kerb line (the near pavement starts behind it at street level + KERB_H). */
export const NEAR_KERB = -12.5;
/** The kerb's height (12 cm at 20 px/m: 2.4 px; spec §8.7 a 6 "2 px, lit top"). */
export const KERB_H = 2;
/** The open quay's stone coping at the back edge (depths FACADE … COPING). */
export const COPING = 14.6;
/** The prop rows: Amsterdammertjes on the far kerb and on the near kerb (spec §8.7 a 5, 7). */
export const BACK_ROW = 12.3;
export const FRONT_ROW = -14.2;
/** A bridge deck's near railing (the deck from the back edge to here). */
export const DECK_NEAR = -13.6;
/**
 * The canal's water level under the bridges and in front of the d quay (h over the walk plane).
 * The real quay top is 1.0–1.2 m (20–24 px) over the water; this camera (eye 116 px up) would hide
 * a true-depth water plane behind the coping, so the floor keeps it 6 px down (the decor and the
 * arch face carry the true height; the report names the liberty).
 */
export const WATER_LEVEL = -6;
/** oat-d: the near coping (spec §2.5: about y 192) and its outer edge, where the water starts. */
export const D_COPING_FAR = -14;
export const D_COPING_NEAR = -16.5;
/** oat-d: the narrow pavement at our row's foot. */
export const D_FAR_KERB = 12.2;

/** The walk line's screen y on flat ground. */
export const YW = G;

/** A stretch of a floor: its kind over [u0, u1) (world px). */
export type StretchKind = 'house' | 'quay' | 'bridge' | 'canal-front';
export interface Stretch {
  readonly u0: number;
  readonly u1: number;
  readonly kind: StretchKind;
  /** Street width façade to façade (m; the opposite row's distance: spec §8.4). */
  readonly widthM: number;
  /** A bridge: the canal's water span [w0, w1) under it and its name (the arch tile, the vista). */
  readonly water?: readonly [number, number];
  readonly name?: string;
}

/** oat-a's stretches (terrain.ts OAT_A; spec §2.1). */
export const A_STRETCHES: readonly Stretch[] = [
  { u0: 0, u1: 320, kind: 'quay', widthM: 22, name: 'prinsengracht' },
  { u0: 320, u1: 544, kind: 'bridge', widthM: 22, water: [340, 524], name: 'berensluis' },
  { u0: 544, u1: 1568, kind: 'house', widthM: 8.3, name: 'berenstraat' },
  { u0: 1568, u1: 1792, kind: 'bridge', widthM: 22, water: [1586, 1774], name: 'brug-48' },
  { u0: 1792, u1: 2816, kind: 'house', widthM: 8.2, name: 'wolvenstraat' },
  { u0: 2816, u1: 3040, kind: 'bridge', widthM: 22, water: [2838, 3018], name: 'brug-25' },
  { u0: 3040, u1: 4096, kind: 'house', widthM: 6.6, name: 'oude-spiegelstraat' },
  { u0: 4096, u1: 4352, kind: 'quay', widthM: 22, name: 'singel' },
  { u0: 4352, u1: 4608, kind: 'house', widthM: 8.4, name: 'singel-row' },
];

/** The d night proof strip (spec §2.5 0–1,280; the rest of oat-d keeps the same quay until NIGHT). */
export const D_STRETCHES: readonly Stretch[] = [{ u0: 0, u1: 4352, kind: 'canal-front', widthM: 21.5, name: 'achterburgwal' }];

/** The stretch at u (the first or last beyond the ends). */
export function stretchAt(list: readonly Stretch[], u: number): Stretch {
  for (const s of list) if (u < s.u1) return s;
  return list[list.length - 1];
}
