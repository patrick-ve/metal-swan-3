/**
 * The Waterlooplein flea market on the floor of `ams` d (docs/design/floor.md §4.4 d, §12.2 d, §11 R1):
 * the decor stalls (art.ts `marketStall`, frames 0–2) stand at the back of the square (`STALL_DEPTH`)
 * as boxes — the striped awning's top and its cheeks, the table board's top, the panelled skirt's
 * ends — in front of the house fronts' pavement. The breakable stalls the script spawns stand in the
 * walk plane and draw their own faces (the kit's `ams-market-stall`, entities.ts).
 *
 * The sprite (58 × 46, feet anchor ox 29): the awning x 1–57 (the HD art's stripes, 6 px from x 1),
 * rows 4–12 (42 … 34 px up); the table board x 2–56, rows 28–31 (18 … 15 up); the skirt x 4–54, rows
 * 32–45 (14 … 1 up). Corners half a px inside the outline. Lit from the left like every `ams` side.
 */
import { PAL_HD } from '../../../../../../engine/palette-hd';
import type { Ramp } from '../../../../../../engine/pixel';
import { hash2 } from '../../../../../art/paint';
import { topFace, wallFace, type FaceSide } from '../../../../../mission/floor/faces';
import { defineFloorTile, hasFloorTile } from '../../../../../mission/floor/registry';
import type { FaceDef, FaceGroupDef } from '../../../../../mission/floor/types';
import type { DecorDef } from '../../../../../mission/types';
import { dt, mod } from '../mat';
import { depthBehind, depthPx, ensureBandTile } from '../sides';

/** The back stalls' depth (their fronts) and how deep their boxes are (world px): the awning, the table. */
export const STALL_DEPTH = 5;
const AWNING_DEEP = 13;
const TABLE_DEEP = 10;

/** Awning stripe A and B of each frame (art-hd-cd-market.ts `SETS`) and their tones on a top lit by the sky. */
const STRIPES: readonly (readonly [Ramp, number, Ramp, number])[] = [
  [PAL_HD.red, 4.4, PAL_HD.cloth, 4.4],
  [PAL_HD.green, 4.3, PAL_HD.cloth, 4.4],
  [PAL_HD.sky, 3.4, PAL_HD.gold, 4.6],
];

const r4 = (x: number): number => Math.max(4, Math.ceil(x / 4) * 4);
/** Tone shift of a side (sides.ts: a left side in the sun, a right one in shade). */
const SHADE = (side: FaceSide): number => (side < 0 ? -0.15 : -1.25);

/** The awning's canvas top (a = along x from its left edge, b = depth): stripes 6 px wide, a seam at each, sagging between the ribs. */
function awningTop(frame: number, l: number): string {
  const id = `ams/d/stall-top/${frame}/${l}`;
  if (hasFloorTile(id)) return id;
  const [ra, ta, rb, tb] = STRIPES[frame % STRIPES.length];
  defineFloorTile(id, {
    w: 12,
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(a * d);
      const Y = Math.floor(b * d);
      // The top's a = 0 lies half a px inside the sprite's x 1, where the first stripe starts.
      const k = Math.floor((a + 0.5) / 6);
      const f = a + 0.5 - k * 6;
      const odd = (k & 1) === 1;
      let t = (odd ? tb : ta) + Math.sin((f / 6) * Math.PI) * 0.35 - 0.15 + (hash2(X, Y >> 1, 71) - 0.5) * 0.3;
      // A seam at the stripe's edge; the rear frame bar along the back (b = 0: the far edge).
      if (f > 6 - Math.max(0.5, 1 / d)) t -= 0.6;
      if (b < 1.2) t -= 1;
      return dt(odd ? rb : ra, t, X, Y);
    },
  });
  return id;
}

/** The table board's top (a = along x, b = depth): grained boards along the table, a darker joint between them. */
function tableTop(l: number): string {
  const id = `ams/d/stall-table/${l}`;
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: 24,
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(a * d);
      const Y = Math.floor(b * d);
      if (mod(b, 3.4) < Math.max(0.45, 1 / d)) return dt(PAL_HD.wood, 2.2, X, Y);
      const board = Math.floor(b / 3.4);
      return dt(PAL_HD.wood, 4.4 + (hash2(board, Math.floor(a / 9), 72) - 0.5) * 0.7 + (hash2(X >> 2, Y, 73) - 0.5) * 0.3, X, Y);
    },
  });
  return id;
}

/** One back stall's faces at its sprite (frame = its colours). */
function stallFaces(frame: number, depth: number): FaceDef[] {
  const Da = depthBehind(depth, AWNING_DEEP);
  const Dt = depthBehind(depth, TABLE_DEEP);
  const la = r4(depthPx(depth, Da));
  const lt = r4(depthPx(depth, Dt));
  const [ra, ta] = STRIPES[frame % STRIPES.length];
  const cheek = (side: FaceSide): string =>
    ensureBandTile({ key: `d-stall-cheek${frame}`, h: 9, l: la, side, bands: [[0, PAL_HD.cloth, 4.6], [1, ra, ta + SHADE(side) * 0.5], [8, ra, ta - 1]] });
  const skirt = (side: FaceSide): string =>
    ensureBandTile({ key: 'd-stall-skirt', h: 17, l: lt, side, joint: 0, bands: [[0, PAL_HD.wood, 4.6], [3, PAL_HD.wood, 2.4], [16, PAL_HD.wood, 1.2]] });
  return [
    wallFace(-24.5, 1, 18, depth, Dt, -1, skirt(-1), lt),
    wallFace(24.5, 1, 18, depth, Dt, 1, skirt(1), lt),
    topFace(-26.5, 26.5, 18, Dt, depth, tableTop(lt), lt),
    wallFace(-27.5, 33.5, 42.5, depth, Da, -1, cheek(-1), la),
    wallFace(27.5, 33.5, 42.5, depth, Da, 1, cheek(1), la),
    topFace(-27.5, 27.5, 42.5, Da, depth, awningTop(frame, la), la),
  ];
}

/** The planter's soil under the tulips (a = along x, b = depth): dark earth, the leaves' green now and then, the board's rim at both edges. */
function planterTop(l: number): string {
  const id = `ams/d/planter-top/${l}`;
  if (hasFloorTile(id)) return id;
  defineFloorTile(id, {
    w: 28,
    h: l,
    paint: (a, b, d) => {
      const X = Math.floor(a * d);
      const Y = Math.floor(b * d);
      if (b < 1 || b > l - 1) return dt(PAL_HD.wood, 4.6, X, Y);
      const h = hash2(Math.floor(a * 1.5), Math.floor(b * 1.5), 74);
      if (h > 0.72) return dt(PAL_HD.green, 2.6 + (h - 0.72) * 4, X, Y);
      return dt(PAL_HD.brown, 1.6 + (hash2(X, Y, 75) - 0.5) * 0.6, X, Y);
    },
  });
  return id;
}

/** How deep a tulip planter's box is (world px). */
const PLANTER_DEEP = 8;

/**
 * The tulip planters at a depth (art.ts `tulips`: the board x 1–28, rows 12–18 of 30 × 20, feet anchor
 * ox 15): their two ends and the soil under the tulips, the planter as a box (spec §11 R1).
 */
export function planterSides(decor: readonly DecorDef[]): FaceGroupDef[] {
  const out: FaceGroupDef[] = [];
  for (const it of decor) {
    if (it.sprite !== 'decor/ams/tulips' || it.front || !(typeof it.depth === 'number' && it.depth > 0)) continue;
    const D = depthBehind(it.depth, PLANTER_DEEP);
    const l = r4(depthPx(it.depth, D));
    const end = (side: FaceSide): string => ensureBandTile({ key: 'd-planter', h: 7, l, side, joint: 0, bands: [[0, PAL_HD.wood, 4.8], [1, PAL_HD.wood, 3.4], [6, PAL_HD.wood, 2]] });
    out.push({
      name: `planter @${it.x}`,
      x: it.x,
      y: it.y,
      depth: it.depth,
      faces: [wallFace(-13.5, 1, 7.5, it.depth, D, -1, end(-1), l), wallFace(13.5, 1, 7.5, it.depth, D, 1, end(1), l), topFace(-13.5, 13.5, 7.5, D, it.depth, planterTop(l), l)],
    });
  }
  return out;
}

/** The face groups of the back stalls in a decor list (every `decor/ams/market-stall` at a depth > 0). */
export function marketStallSides(decor: readonly DecorDef[]): FaceGroupDef[] {
  const out: FaceGroupDef[] = [];
  for (const it of decor) {
    if (it.sprite !== 'decor/ams/market-stall' || it.front || !(typeof it.depth === 'number' && it.depth > 0)) continue;
    out.push({ name: `market stall #${it.frame ?? 0} @${it.x}`, x: it.x, y: it.y, depth: it.depth, faces: stallFaces(it.frame ?? 0, it.depth) });
  }
  return out;
}
