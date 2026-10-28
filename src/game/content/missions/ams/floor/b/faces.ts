/**
 * The side faces of `ams` b's own boxes (docs/design/floor.md §11 R1, §12.1 item 1, §12.2 b): the
 * Rijksmuseum's corner wings and towers, the hot-dog stand and the electrical cabinet beside it. The
 * canal houses' sides come from the kit (`houseSides`), the passage's mouths from passage.ts.
 *
 * - The museum (480 × 176 art, anchor 241 px from its left edge) at the facade's depth: each corner
 *   wing shows its end wall (the museum's brick, a cream band at the springing, a few windows) and
 *   its slate hip receding to the floor's back edge; each tower its sides above the main roof (a
 *   square tower: as deep as it is wide).
 * - The hot-dog stand (decor in the walk plane, the vendor in its hatch): a box 64 wide from 12 to 50
 *   px over its feet (the trailer's body above the wheels), ~22 world px deep; its white ends and its
 *   steel roof.
 * - The cabinet (front decor beside the stand, on the square's near side): a small grey box, its ends
 *   and top.
 */
import { PAL_HD } from '../../../../../../engine/palette-hd';
import { slopeFace, topFace, wallFace } from '../../../../../mission/floor/faces';
import { defineFloorTile } from '../../../../../mission/floor/registry';
import type { FaceDef, FaceGroupDef } from '../../../../../mission/floor/types';
import { G } from '../../art';
import { B_HOTDOG_X } from '../../terrain';
import { AMS_BACK, FACADE } from '../layout';
import { dt, mod } from '../mat';
import { depthBehind, depthPx, ensureBandTile, ensureRoofTile, ensureWallTile } from '../sides';
import { MUSEUM_X } from './passage';

const r4 = (x: number): number => Math.max(4, Math.ceil(x / 4) * 4);

/** The museum's art (art.ts `rijksmuseum`): its edges (sprite px from the anchor, half a px inside the outline), the eave, the hip's top and inset. */
const MUSEUM_L = -240.5;
const MUSEUM_R = 240.5;
const MUSEUM_EAVE = 176 - 58;
const MUSEUM_HIP = 176 - 44;
const HIP_INSET = 8.4;
/** The towers (art x 61…99 and 382…420; their top band 152 px over the feet). */
const TOWERS: readonly (readonly [number, number])[] = [
  [61 - 241, 99 - 241],
  [382 - 241, 420 - 241],
];
const TOWER_TOP = 176 - 24;

/** The museum's corner wings and towers in perspective (spec §12.2 b "the museum's corner wing a box"). */
export function museumSides(): FaceGroupDef[] {
  const l = r4(depthPx(FACADE, AMS_BACK));
  const out: FaceGroupDef[] = [];
  for (const side of [-1, 1] as const) {
    const kx = side < 0 ? MUSEUM_L : MUSEUM_R;
    const wall = ensureWallTile({ wall: 'rust', side, h: MUSEUM_EAVE, l, cornice: 2, floors: [28, 70], seed: 43, light: 'noon' });
    out.push({
      name: `museum wing ${side < 0 ? 'L' : 'R'}`,
      x: MUSEUM_X,
      y: G,
      depth: FACADE,
      faces: [
        wallFace(kx, 0, MUSEUM_EAVE, FACADE, AMS_BACK, side, wall, l),
        slopeFace(kx, MUSEUM_EAVE, kx - side * HIP_INSET, MUSEUM_HIP, FACADE, AMS_BACK, side, ensureRoofTile(side), l),
      ],
    });
  }
  // A square tower reaches back as far as it is wide (at the facade's scale).
  TOWERS.forEach(([x0, x1], i) => {
    const w = (x1 - x0) / (1 - FACADE / (176 - 60));
    const back = Math.min(AMS_BACK, depthBehind(FACADE, w));
    const lt = r4(depthPx(FACADE, back));
    const faces: FaceDef[] = [];
    for (const side of [-1, 1] as const) {
      const tile = ensureWallTile({ wall: 'rust', side, h: TOWER_TOP - MUSEUM_EAVE, l: lt, cornice: 2, floors: [16], seed: 44 + i, light: 'noon' });
      faces.push(wallFace(side < 0 ? x0 + 0.5 : x1 - 0.5, MUSEUM_EAVE, TOWER_TOP, FACADE, back, side, tile, lt));
    }
    out.push({ name: `museum tower ${i}`, x: MUSEUM_X, y: G, depth: FACADE, faces });
  });
  return out;
}

/** The hot-dog stand's box (art.ts `hotdogStand`: the body x 0…64 from the anchor, 12…50 px over the feet). */
const STAND_W = 64;
const STAND_Y0 = 12;
const STAND_Y1 = 50;
/** Its depth: a food trailer about 22 world px deep. */
export const STAND_DEEP = depthBehind(0, 22);
/** The electrical cabinet beside it (front decor): on the square's near side, in front of the heroes' path. */
export const B_CABINET_DEPTH = -22;

defineFloorTile('ams/b/stand-roof', {
  w: 16,
  h: 4,
  paint: (a, b, d) => {
    const X = Math.floor(a * d);
    const Y = Math.floor(b * d);
    // A light steel roof: a standing seam every 8 px (lit from above: a shade greyer than the white body).
    if (mod(a, 8) < 0.7) return dt(PAL_HD.steel, 3.6, X, Y);
    return dt(PAL_HD.steel, 5 + (((X * 5 + Y * 7) % 9) - 4) * 0.05, X, Y);
  },
});

/** The hot-dog stand and the cabinet beside it as boxes (spec §12.2 b: "a box with its side and roof top"). */
export function standSides(): FaceGroupDef[] {
  const l = r4(depthPx(0, STAND_DEEP));
  const h = STAND_Y1 - STAND_Y0;
  const end = (side: -1 | 1): string =>
    ensureBandTile({ key: 'hotdog-end', h, l, side, joint: 0, bands: [[0, PAL_HD.snow, 5.4], [3, PAL_HD.snow, 4.9], [h - 9, PAL_HD.sky, 2.4], [h - 7, PAL_HD.snow, 4.7], [h - 1.5, PAL_HD.snow, 3.4]] });
  const cabBack = depthBehind(B_CABINET_DEPTH, 10);
  const lc = r4(depthPx(B_CABINET_DEPTH, cabBack));
  const cab = (side: -1 | 1): string => ensureBandTile({ key: 'cabinet-end', h: 28, l: lc, side, joint: 0, bands: [[0, PAL_HD.stone, 5.2], [2, PAL_HD.stone, 4.1], [26, PAL_HD.stone, 2.8]] });
  return [
    {
      name: 'hotdog stand',
      x: B_HOTDOG_X,
      y: G,
      depth: 0,
      order: 0,
      faces: [
        wallFace(0.5, STAND_Y0, STAND_Y1 - 2, 0, STAND_DEEP, -1, end(-1), l),
        wallFace(STAND_W - 0.5, STAND_Y0, STAND_Y1 - 2, 0, STAND_DEEP, 1, end(1), l),
        topFace(1.5, STAND_W - 1.5, STAND_Y1, STAND_DEEP, 0, 'ams/b/stand-roof', l),
      ],
    },
    {
      // Front decor on the square's near side: its ends and top drawn over the world with it (low: legs only).
      name: 'cabinet',
      x: B_HOTDOG_X + 66,
      y: G,
      depth: B_CABINET_DEPTH,
      front: true,
      faces: [
        wallFace(-10.5, 0, 28, B_CABINET_DEPTH, cabBack, -1, cab(-1), lc),
        wallFace(10.5, 0, 28, B_CABINET_DEPTH, cabBack, 1, cab(1), lc),
        topFace(-10.5, 10.5, 28, cabBack, B_CABINET_DEPTH, 'ams/counter-top', lc),
      ],
    },
  ];
}
