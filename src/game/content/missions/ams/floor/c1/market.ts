/**
 * The Waterlooplein market stalls as boxes (docs/design/floor.md §12.2 c1 "the market stalls as boxes on
 * the cobbles at the back", §11 R1): the decor stall `decor/ams/market-stall` (art.ts `marketStall`:
 * 58 × 46, feet anchor; the striped awning over x 1…56, rows 4…12; the table board rows 28…32; the
 * skirt rows 32…45; frames 0–2 in three colour sets) standing at a depth gets a face group: the
 * awning's striped top and its cheeks, the table top, the skirt's ends — receding `STALL_DEEP` world
 * px behind its front. Also used by c2 (the jetty's stall).
 */
import { PAL_HD } from '../../../../../../engine/palette-hd';
import type { Ramp } from '../../../../../../engine/pixel';
import { hash2 } from '../../../../../art/paint';
import { topFace, wallFace, type FaceSide } from '../../../../../mission/floor/faces';
import { defineFloorTile, hasFloorTile } from '../../../../../mission/floor/registry';
import type { FaceGroupDef } from '../../../../../mission/floor/types';
import { G } from '../../terrain';
import { dt, mod } from '../mat';
import { depthBehind, depthPx, ensureBandTile } from '../sides';

/** How deep a stall reaches behind its front (world px) and its table (a little shallower). */
const STALL_DEEP = 22;
const TABLE_DEEP = 16;

/** The awning colours of the three frames (art.ts STALL_SETS as HD ramps; the art-hd-cd-market.ts sets). */
const SETS: readonly (readonly [Ramp, number, Ramp, number])[] = [
  [PAL_HD.red, 4, PAL_HD.cloth, 5],
  [PAL_HD.green, 3.6, PAL_HD.cloth, 5],
  [PAL_HD.sky, 3.2, PAL_HD.gold, 4.6],
];

const r4 = (x: number): number => Math.max(4, Math.ceil(x / 4) * 4);

/** An awning's striped top (a = along x from the awning's left edge at frame x 1, b = depth): stripes 6 px, sagging between ribs. */
function awningTop(frame: number, l: number): string {
  const id = `ams/c1/stall-top/${frame}/${l}`;
  if (hasFloorTile(id)) return id;
  const [ra, ta, rb, tb] = SETS[frame % SETS.length];
  defineFloorTile(id, {
    w: 12,
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(a * d);
      const Y = Math.floor(b * d);
      // The sprite's stripes: k = ⌊frame x / 6⌋, the awning's left edge at frame x 1.
      const k = Math.floor((a + 1) / 6);
      const f = mod(a + 1, 6) / 6;
      const sag = Math.sin((mod(b, 7) / 7) * Math.PI) * 0.35;
      const odd = (k & 1) === 1;
      const t = (odd ? tb : ta) + Math.sin(f * Math.PI) * 0.3 - 0.25 + sag + (hash2(X, Y >> 1, 211) - 0.5) * 0.3;
      return dt(odd ? rb : ra, t, X, Y);
    },
  });
  return id;
}

/** The table top (a = along x, b = depth): grained boards along x. */
function tableTop(l: number): string {
  const id = `ams/c1/stall-table/${l}`;
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: 16,
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(a * d);
      const Y = Math.floor(b * d);
      if (mod(b, 4) < Math.max(0.45, 1 / d)) return dt(PAL_HD.wood, 2.2, X, Y);
      return dt(PAL_HD.wood, 4 + (hash2(Math.floor(b / 4), Math.floor(a / 16), 212) - 0.5) * 0.6 + (hash2(X >> 1, Y, 213) - 0.5) * 0.3, X, Y);
    },
  });
  return id;
}

/**
 * The faces of a decor market stall (`frame` 0–2) drawn at `depth` at world x (its decor's x, base at
 * G): its corners in the stall sprite's px (the decor is drawn unscaled at its depth), the box from its
 * front back `STALL_DEEP` world px. Sides lit on the left, shaded on the right (sides.ts).
 */
export function stallFaces(x: number, depth: number, frame: number): FaceGroupDef {
  const back = depthBehind(depth, STALL_DEEP);
  const backT = depthBehind(depth, TABLE_DEEP);
  const l = r4(depthPx(depth, back));
  const lt = r4(depthPx(depth, backT));
  const [ra, ta] = SETS[frame % SETS.length];
  const cheek = (side: FaceSide): string => ensureBandTile({ key: `c1-stall-cheek-${frame}`, h: 9, l, side, bands: [[0, ra, ta + 0.3], [7, PAL_HD.cloth, 4.6]] });
  const skirt = (side: FaceSide): string => ensureBandTile({ key: 'c1-stall-skirt', h: 14, l: lt, side, joint: 0, bands: [[0, PAL_HD.wood, 4.2], [4, PAL_HD.brown, 2.6]] });
  return {
    name: `c1 market stall #${frame} @${x}`,
    x,
    y: G,
    depth,
    faces: [
      // The skirt's ends and the table top, then the awning's cheeks and its top (the stall is open at its sides).
      wallFace(-24.5, 1, 14, depth, backT, -1, skirt(-1), lt),
      wallFace(24.5, 1, 14, depth, backT, 1, skirt(1), lt),
      topFace(-26.5, 26.5, 18, backT, depth, tableTop(lt), lt),
      wallFace(-27.5, 34, 42.5, depth, back, -1, cheek(-1), l),
      wallFace(26.5, 34, 42.5, depth, back, 1, cheek(1), l),
      topFace(-27.5, 26.5, 42.5, back, depth, awningTop(frame, l), l),
    ],
  };
}
