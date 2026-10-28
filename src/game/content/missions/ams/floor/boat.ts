/**
 * The small open canal boat in perspective (docs/design/floor.md §11 R1 "canal boats more 3D", §12.1
 * item 4): the `ams-boat-platform` the heroes ride over a canal (and the party boat of c2, the same
 * boat) is a moving entity, so its faces are an ENTITY KIND's faces (`EntityFacesDef`, docs/api/
 * floor.md §8.2): the floor that lists the kind lets the entity draw them itself, render only, each
 * frame under every entity, at its x and bob:
 *
 * - the top: the open hull seen from above, from the near gunwale (the sprite's top edge, v = 0) back
 *   over its beam — the far gunwale's rim, the inner side of the far planking, the floorboards, three
 *   thwarts; the bow end narrower (the hull closes to its stem);
 * - the ends: the transom (the stern, square, with the motor on it) and the bow, from the gunwale to
 *   the waterline, receding over the beam — only the end that faces the screen's centre column shows,
 *   narrowing to nothing as the boat passes it (the line-scroll rule of the side faces);
 * - the hull in its own wood (the sprite's brown planks, the light gunwale, the teal stripe).
 *
 * Geometry from the 1× art (npc.art.ts `smallBoat`: 64 × 22, anchor (32, 2); the gunwale on row 3
 * from x 2 to 61, the stern raking to x 8 and the stem to x 57 at the keel; the motor at the stern).
 * A boat sailing left (its sprite flipX) takes the mirrored faces, its lit end shaded (`mirror`).
 */
import { PAL_HD } from '../../../../../engine/palette-hd';
import { hash2 } from '../../../../art/paint';
import { quadFace } from '../../../../mission/floor/faces';
import { defineFloorTile, hasFloorTile } from '../../../../mission/floor/registry';
import type { EntityFacesDef } from '../../../../mission/floor/types';
import { WATER_LEVEL } from './layout';
import { dt, mod } from './mat';
import { depthBehind, ensureBandTile } from './sides';

/** The boat's beam (world px of depth behind the near gunwale; a sloep of ~1.4 m beside the 1.8 m heroes). */
export const ROWBOAT_BEAM = 13;
/** Its length at the gunwale (world px, centred on the entity's x) and at the waterline: the stern rakes, the stem less. */
const HALF = 30;
const STERN_WL = 25.8;
const BOW_WL = 27.2;
/** The far gunwale's bow end sits this far back from the near one's (the hull closes to its stem). */
const BOW_TAPER = 6;
/** The gunwale is 1 px under the entity's y (the sprite's row 3, its anchor on row 2). */
const GUNWALE = -1;
/** The ends' tile: the gunwale (the entity's y − 1) down to the waterline at the platform's rest y (172 → 7 px). */
const END_SPAN = 7;

const INSIDE = 'ams/rowboat-inside';
const END_H = 8;
const END_L = 16;

/** The inside of the open hull (a = along u from the stern, b = back from the far gunwale toward the near one). */
function ensureInsideTile(): string {
  if (hasFloorTile(INSIDE)) return INSIDE;
  defineFloorTile(INSIDE, {
    w: 64,
    h: 16,
    paint: (a, b, d) => {
      const X = Math.floor(a * d);
      const Y = Math.floor(b * d);
      // The far gunwale's rim (the sprite's light cap), the inner side of the far planking in shade.
      if (b < 1.3) return dt(PAL_HD.cloth, b < 0.6 ? 4.4 : 3.4, X, Y);
      if (b < 4.2) return dt(PAL_HD.wood, 2.2 + (mod(b - 1.3, 1.5) < 0.4 ? -0.6 : 0) + (b - 1.3) * 0.15, X, Y);
      // Three thwarts across the hull (lit tops, a shadow on their near side).
      for (const t of [13, 30, 46]) {
        const q = a - t;
        if (q >= 0 && q < 3) return dt(PAL_HD.wood, q < 0.6 ? 5.2 : 4.4, X, Y);
        if (q >= 3 && q < 4) return dt(PAL_HD.wood, 1.6, X, Y);
      }
      // The floorboards along the boat, a joint every 2.4 px across.
      if (mod(b, 2.4) < 0.45) return dt(PAL_HD.wood, 1.9, X, Y);
      return dt(PAL_HD.wood, 3.1 + (hash2(Math.floor(a / 9), Math.floor(b / 2.4), 61) - 0.5) * 0.5, X, Y);
    },
  });
  return INSIDE;
}

/** An end of the hull (the sprite's bands: the gunwale cap, the planks, the teal stripe), lit on the left. */
function endTile(side: -1 | 1): string {
  return ensureBandTile({
    key: 'rowboat-end',
    h: END_H,
    l: END_L,
    side,
    joint: 0,
    bands: [
      [0, PAL_HD.cloth, 4.2],
      [1, PAL_HD.wood, 4.2],
      [2, PAL_HD.wood, 3.4],
      [5, PAL_HD.wood, 2.6],
      [6.4, PAL_HD.teal, 2.6],
    ],
  });
}

/** Register the boat's tiles (once). */
export function ensureRowboatTiles(): void {
  ensureInsideTile();
  endTile(-1);
  endTile(1);
}

/**
 * The faces of the small canal boat (`ams-boat-platform`, `ams-party-boat`): the open hull's top and
 * its two ends (the transom on the left, the bow on the right; mirrored when it sails left).
 * Corners: x right of the boat's centre, y over its platform top (the gunwale 1 px under it), the
 * waterline in world height (it does not bob with the boat: the water stays).
 */
export function rowboatFaces(max = 2): EntityFacesDef {
  ensureRowboatTiles();
  const D = depthBehind(0, ROWBOAT_BEAM);
  const B = ROWBOAT_BEAM;
  const lit = endTile(-1);
  const shade = endTile(1);
  return {
    max,
    y: 172,
    mirror: { [lit]: shade, [shade]: lit },
    states: [
      [
        // The stern (faces −u): front top, front bottom, back bottom, back top.
        quadFace(
          [
            [-HALF, GUNWALE, 0],
            [-STERN_WL, WATER_LEVEL, 0, 1],
            [-STERN_WL, WATER_LEVEL, D, 1],
            [-HALF, GUNWALE, D],
          ],
          [
            [0, 0],
            [END_SPAN, 0],
            [END_SPAN, B],
            [0, B],
          ],
          lit,
        ),
        // The bow (faces +u): front top, back top (the far gunwale's tapered end), back bottom, front bottom.
        quadFace(
          [
            [HALF, GUNWALE, 0],
            [HALF - BOW_TAPER, GUNWALE, D],
            [BOW_WL - BOW_TAPER, WATER_LEVEL, D, 1],
            [BOW_WL, WATER_LEVEL, 0, 1],
          ],
          [
            [0, 0],
            [0, B],
            [END_SPAN, B],
            [END_SPAN, 0],
          ],
          shade,
        ),
        // The open hull: far stern, far bow, near bow, near stern (a from the stern, b from the far gunwale).
        quadFace(
          [
            [-HALF, GUNWALE, D],
            [HALF - BOW_TAPER, GUNWALE, D],
            [HALF, GUNWALE, 0],
            [-HALF, GUNWALE, 0],
          ],
          [
            [0, 0],
            [2 * HALF - BOW_TAPER, 0],
            [2 * HALF, B],
            [0, B],
          ],
          INSIDE,
        ),
      ],
    ],
  };
}
