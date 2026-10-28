/**
 * The Stopera on the floor of `ams` d (docs/design/floor.md §4.4 d, §12.2 d, §3.7, §12.1 item 3): the
 * curved marble-and-glass music theatre and the red-brick Stadhuis wing stand at `STOPERA_DEPTH`
 * behind the forecourt, with their sides in perspective, and its glass doors in depth. ROBO-HALSEMA
 * steps out of them in the WALK PLANE (spec §3.7 has no exceptions: from her first tick her hurtboxes
 * stop shots, so her art stays with them at depth 0, and so does the dust of her footfalls).
 *
 * - The art is the 2D sprite (art.ts `stopera`, 386 × 169, ox 1) drawn unscaled at its depth: its px p
 *   lies at u = x + p / s there. The floor's copy is anchored so that the doors' centre (sprite px 294)
 *   stands at u = the doors' x (section-d.ts `DOORS_X`, the boss's spawn x) for every camera; the 2D
 *   item (x 896) is hidden on the floor (section-d.ts).
 * - Sides (spec §11 R1): the theatre's left end (the drum's marble ledges and glass turning back into
 *   depth) while the Stopera is right of the screen's centre column, and the Stadhuis wing's left side
 *   above the theatre's roof (the wing is 29 px taller there). The glass doors stand in depth: 3 px
 *   back in the wall, the reveal on the far side of the centre column shows (brick, the steel frame).
 * - The doors stand OPEN on the floor (their glass slid into the walls): the warm lobby behind them
 *   (`ensureLobby`), so ROBO-HALSEMA, dark in her intro, steps out of a lit doorway at the walk line. The
 *   lobby is one face from the left jamb on the facade to the right reveal's back edge: the eye stands
 *   left of the doors for every camera of d (camX ≤ 896, the doors from 1145), so the left jamb hides
 *   the lobby's left part and the visible right reveal frames it. (Swinging the doors open as she
 *   walks out needs her state in the draw: her own `drawFloorFaces` hook, which her file does not
 *   have; the report names it.)
 * - The Stopera's roofs are above the floor's eye (116 px): none of its tops shows.
 */
import { sAtDepth, type FloorCam } from '../../../../../../engine/floor/cam';
import { PAL_HD } from '../../../../../../engine/palette-hd';
import { hash2 } from '../../../../../art/paint';
import { quadFace, wallFace } from '../../../../../mission/floor/faces';
import { defineFloorTile, hasFloorTile } from '../../../../../mission/floor/registry';
import type { FaceGroupDef } from '../../../../../mission/floor/types';
import type { DecorDef } from '../../../../../mission/types';
import { G } from '../../art';
import { D_ARENA } from '../../terrain';
import { AMS_BACK, AMS_CAMERA } from '../layout';
import { dt, mod } from '../mat';
import { depthPx } from '../sides';

/** The depth unit's camera of the `ams` floors (the walk line at G). */
const CAM = { yh: AMS_CAMERA.yh, yw: G, f: AMS_CAMERA.f } as FloorCam;

/** The Stopera's facade depth: the forecourt in front of it (ROBO-HALSEMA's head stays on screen in the doors). */
export const STOPERA_DEPTH = 12;
/** The doors' centre (section-d.ts `DOORS_X`: the boss's spawn x). */
export const DOORS_U = D_ARENA[0] + 294;
/** The sprite: its anchor px, the doors' centre px, the theatre / Stadhuis split, the base row. */
const STOPERA_OX = 1;
const DOOR_PX = 294;
const SPLIT_PX = 230;
const BASE = 168;
/** The door frame's half width and height (art.ts `stopera`: 80 × 100 under the canopy) and how deep the doors stand in the wall. */
const DOOR_HALF = 40;
const DOOR_H = 100;
const DOOR_RECESS = 3;
/** The open doorway's height under the door head's frame (the glass of art.ts `stopera`: 98 px). */
const LOBBY_H = 98;
/** The Stopera's scale on the floor (its sprite px per world px). */
const S = sAtDepth(CAM, STOPERA_DEPTH);
/** The floor's anchor x of the Stopera: its doors at DOORS_U at its depth. */
export const STOPERA_X = DOORS_U - (DOOR_PX - STOPERA_OX) / S;

/** The theatre's top row at sprite px x (art.ts `stopera`: the curve of the drum's top edge). */
function theatreTop(x: number): number {
  const t = (x - 1) / (SPLIT_PX - 2);
  return 30 + Math.round(Math.pow(t - 0.45, 2) * 70);
}

/** The floor's Stopera (a decor item at its depth; section-d.ts hides its 2D item on the floor). */
export function stoperaDecor(): DecorDef {
  return { sprite: 'decor/ams/stopera', x: STOPERA_X, y: G, depth: STOPERA_DEPTH };
}

// ------------------------------------------------------------------------------- tiles

/**
 * The drum's end turning back into depth (a = down from its top, b = back from the facade): the
 * front's marble ledges (9 px of every 26, lit top edge, a soffit) and its curtain-wall glass (dusk
 * purple, a lit steel mullion every 12 px of depth, the transom, a sunset glint now and then) — the
 * HD front's bands (art-hd-cd-stopera.ts), lit: the drum turns toward the sun on the left.
 */
function ensureTheatreSide(h: number, l: number): string {
  const id = `ams/d/theatre-side/${h}x${l}`;
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: h,
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(b * d);
      const Y = Math.floor(a * d);
      const band = mod(a, 26);
      if (band < 9) {
        if (band < 0.75) return dt(PAL_HD.gable, 6, X, Y);
        if (band < 6.6) return dt(PAL_HD.gable, 4.9 - band * 0.12 + (hash2(Math.floor(b / 11), Math.floor(a / 26), 61) - 0.5) * 0.3, X, Y);
        if (band < 7.2) return dt(PAL_HD.gable, 3, X, Y);
        return dt(PAL_HD.gable, 1.4, X, Y);
      }
      const g = band - 9;
      if (mod(b, 12) < Math.max(0.6, 1 / d)) return dt(PAL_HD.steel, 3.6, X, Y);
      if (g >= 8 && g < 9) return dt(PAL_HD.steel, 3.2, X, Y);
      if (g < 1.3) return dt(PAL_HD.purple, 0.6, X, Y);
      // The sunset in the glass: a pink streak along the depth now and then, the sky lighter at the top of a storey.
      const pane = Math.floor(b / 12);
      if (hash2(pane, Math.floor(a / 26), 62) > 0.8 && g > 2 && g < 4.5) return dt(PAL_HD.pink, 3.4, X, Y);
      return dt(PAL_HD.purple, 3.2 - g * 0.12 + (hash2(X >> 1, Y >> 1, 63) - 0.5) * 0.3, X, Y);
    },
  });
  return id;
}

/** The Stadhuis wing's side wall (a = down from its top, b = depth): brick in running bond, a white stone band every 30 px. */
function ensureWingSide(h: number, l: number, top: number): string {
  const id = `ams/d/stadhuis-side/${h}x${l}/${top}`;
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: h,
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(b * d);
      const Y = Math.floor(a * d);
      // The sprite's white bands lie every 30 rows from its top (row 22).
      const row = mod(a + top - 22, 30);
      if (row < 4) return dt(PAL_HD.snow, row < 1 ? 5.4 : 4.4, X, Y);
      if (row < 5) return dt(PAL_HD.stone, 2.2, X, Y);
      const ch = d >= 2 ? 1.5 : 3;
      const bl = d >= 2 ? 3 : 6;
      const course = Math.floor(a / ch);
      const bb = b + (course & 1) * bl * 0.5;
      if (a - course * ch < 1 / d || mod(bb, bl) < 1 / d) return dt(PAL_HD.stone, 1.8, X, Y);
      return dt(PAL_HD.red, 3.1 + (hash2(Math.floor(bb / bl), course, 64) - 0.5) * 1, X, Y);
    },
  });
  return id;
}

/**
 * The lobby behind the open doors (a = down from the door head, b = across from the left jamb, w
 * px): its ceiling with four pendant lamps in a row, the dark blue hall, the warm light pooling on the
 * stone floor (the HD doors' lobby, art-hd-cd-stopera.ts, seen without the glass).
 */
function ensureLobby(h: number, w: number): string {
  const id = `ams/d/lobby/${h}x${w}`;
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: r4(h),
    h: r4(w),
    paint: (a, b, d) => {
      const X = Math.floor(b * d);
      const Y = Math.floor(a * d);
      // The pendant lamps (sprite px 13, 33, 53, 71 of the 78-px opening; 38 px under the head).
      for (const lx of [13, 33, 53, 71]) {
        const lb = (lx / 78) * w;
        if (Math.abs(b - lb) < 0.3 && a < 38 && a > 29) return dt(PAL_HD.navy, 0.4, X, Y);
        const r = Math.hypot(b - lb, (a - 38) * 1.3);
        if (r < 1.3) return dt(PAL_HD.gold, r < 0.6 ? 7 : 5.4, X, Y);
        if (r < 3.4) return dt(PAL_HD.navy, 1.2, X, Y);
      }
      const floor = a - (h - 14);
      if (floor > 0) return dt(PAL_HD.gold, (floor / 14) * 1.3 + 0.6 - Math.abs(b - w / 2) * 0.012 + (hash2(X >> 1, Y >> 1, 66) - 0.5) * 0.4, X, Y);
      // The hall: dark blue, a little lighter toward the lamps' row and the floor.
      return dt(PAL_HD.navy, 0.5 + Math.max(0, 1 - Math.abs(a - 40) / 30) * 0.7 + (a / h) * 0.4 + (hash2(X >> 2, Y >> 1, 67) - 0.5) * 0.3, X, Y);
    },
  });
  return id;
}

/**
 * The glass doors' reveal (a = down from the door head, b = back from the facade): the steel door frame
 * along the front, then the brick of the wall's thickness in the recess's shade, the doors' steel
 * frame again at the back where the glass stands.
 */
function ensureDoorReveal(h: number, l: number): string {
  const id = `ams/d/door-reveal/${h}x${l}`;
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: h,
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(b * d);
      const Y = Math.floor(a * d);
      if (b < 1.4) return dt(PAL_HD.steel, b < 0.6 ? 4.4 : 2.6, X, Y);
      if (b > l - 1.2) return dt(PAL_HD.steel, 2, X, Y);
      const ch = d >= 2 ? 1.5 : 3;
      const course = Math.floor(a / ch);
      const bb = b + (course & 1) * 1.5;
      if (a - course * ch < 1 / d || mod(bb, 3) < 1 / d) return dt(PAL_HD.stone, 1.2, X, Y);
      return dt(PAL_HD.red, 1.6 + (hash2(Math.floor(bb / 3), course, 65) - 0.5) * 0.7 - (a / h) * 0.3, X, Y);
    },
  });
  return id;
}

/** Tile px rounded up to a multiple of 4 (the tiles' height rule). */
const r4 = (x: number): number => Math.max(4, Math.ceil(x / 4) * 4);

/**
 * The Stopera's sides (spec §11 R1, §12.2 d): the theatre's left end from its foot to its top, and the
 * Stadhuis wing's left side above the theatre's roof, both back to the floor's back edge.
 */
export function stoperaSides(): FaceGroupDef[] {
  const l = r4(depthPx(STOPERA_DEPTH, AMS_BACK));
  const endTop = BASE - theatreTop(1);
  const theatreAtSplit = BASE - theatreTop(SPLIT_PX - 1);
  const wingTop = BASE - 22;
  const dBack = STOPERA_DEPTH + DOOR_RECESS;
  const lr = r4(depthPx(STOPERA_DEPTH, dBack));
  const reveal = ensureDoorReveal(DOOR_H, lr);
  const dx = DOOR_PX - STOPERA_OX;
  // The open doorway: from the left jamb's glass edge on the facade to the right reveal's back edge.
  const gl = dx - DOOR_HALF + 2;
  const gr = dx + DOOR_HALF - 0.5;
  const lobby = ensureLobby(LOBBY_H, gr - gl);
  return [
    // The open glass doors in depth: they stand back in the wall, so the reveal of the frame on the far
    // side of the centre column shows, the lobby lit behind them (drawn over the facade's art: order a
    // hair in front of its depth).
    {
      name: 'stopera doors',
      x: STOPERA_X,
      y: G,
      depth: STOPERA_DEPTH,
      order: STOPERA_DEPTH - 0.01,
      faces: [
        quadFace(
          [
            [gl, LOBBY_H, STOPERA_DEPTH],
            [gr, LOBBY_H, dBack],
            [gr, 0, dBack],
            [gl, 0, STOPERA_DEPTH],
          ],
          [
            [0, 0],
            [0, gr - gl],
            [LOBBY_H, gr - gl],
            [LOBBY_H, 0],
          ],
          lobby,
        ),
        wallFace(dx - DOOR_HALF + 0.5, 0, DOOR_H, STOPERA_DEPTH, dBack, 1, reveal, lr),
        wallFace(dx + DOOR_HALF - 0.5, 0, DOOR_H, STOPERA_DEPTH, dBack, -1, reveal, lr),
      ],
    },
    {
      name: 'stopera theatre end L',
      x: STOPERA_X,
      y: G,
      depth: STOPERA_DEPTH,
      faces: [wallFace(0.5 - STOPERA_OX, 0, endTop, STOPERA_DEPTH, AMS_BACK, -1, ensureTheatreSide(endTop, l), l)],
    },
    {
      name: 'stopera stadhuis wing L',
      x: STOPERA_X,
      y: G,
      depth: STOPERA_DEPTH,
      faces: [
        wallFace(SPLIT_PX - STOPERA_OX + 0.5, theatreAtSplit, wingTop, STOPERA_DEPTH, AMS_BACK, -1, ensureWingSide(wingTop - theatreAtSplit, l, 22), l),
      ],
    },
  ];
}
