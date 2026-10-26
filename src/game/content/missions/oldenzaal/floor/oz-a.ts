/**
 * The floor of oz-a, the shopping street at dusk (docs/design/floor.md §5.1, §1.1, §3.5–§3.8;
 * start values from the mock-up's line-scroll direction `oz-lijn`, tuned here):
 *
 *   camera yh 56, f 200, the back edge at y 162: the shop fronts stand 14 px behind the feet
 *   (climbable fronts) · the sandstone pavement 162–167.6 · the raised sandstone kerb (top 167.6–
 *   169, 1.5 px face) with the back row of iron posts and chains on it · the gutter of slate setts
 *   169–171 with the drains · the herringbone street from 171 to the bottom (the walk line 176;
 *   the manholes lie whole in the street; a pedestrian street: the walk plane lies in it) · the front
 *   row of posts at y 194 on a flush strip of sandstone blocks (y 192.6–195.6).
 *
 * The platforms keep their physics lines; their art sticks out of the fronts (spec §3.5): the
 * awnings as canvas canopies in their own colours (a slight slope: the back edge 3 px higher on the
 * front), the balconies and the golden record's ledge as sandstone slabs, the bay windows' flat
 * roofs as lead roofs sloping up to the front (5 px). Cars and the low walls stand in the walk
 * plane with top faces (roof and bonnet; brick coping). The manholes are the
 * floor's flat openings (the RUIN entity draws its lifted and open states over them, flat.ts);
 * the rise spots are cracked pavers (town.ts). Contact shadows 0.35.
 *
 * The rows keep clear of what the fights need (spec §3.6): the back row stops at the boarded
 * doors and windows (the tells of the dead who burst out), the lamps, the cars, the walls and the
 * police cordon; the front row stops within 24 px of every spawn spot the script uses (the rise
 * spots, the openings, the crates, the golden record, the checkpoints), the front decor, the start
 * and the exit.
 */
import { depthAtV, makeFloorCam } from '../../../../../engine/floor/cam';
import { PAL_HD } from '../../../../../engine/palette-hd';
import type { DecorDef } from '../../../../mission/index';
import type { FaceGroupDef, FloorDef, FloorOpeningDef, OverhangDef, PropRowDef, TopFaceDef } from '../../../../mission/floor/types';
import { ruinSpotX } from '../../../oldenzaal/ruin/index';
import { OZ_A_DECOR, OZ_A_LAMPS, OZ_A_SIGN_X } from '../art-layout';
import { SHOPS } from '../art-street';
import { OZ_A_CRATES } from '../script-oz-a';
import {
  G,
  OZ_A_AWNING_AT,
  OZ_A_AWNINGS,
  OZ_A_BALCONIES,
  OZ_A_BALCONY_AT,
  OZ_A_BAYS,
  OZ_A_CARS,
  OZ_A_CHECKPOINTS,
  OZ_A_EXIT,
  OZ_A_LEDGE,
  OZ_A_OPENINGS,
  OZ_A_RECORD,
  OZ_A_RISE,
  OZ_A_SHOPS,
  OZ_A_SPOTS,
  OZ_A_WALLS,
  type OzCar,
} from '../terrain';
import { ozDecorDepth, ozFloorDecor, type OzDecorDepths } from './decor';
import { OZ_FLOOR_IDS, ozKitFloor, type OzLight } from './kit';
import { MANHOLE_R, ensureTownPainter } from './town';
import { carSides, overhangSides, shopSides, wallSides } from './sides';
import { ensureOzPost, ensureOzTiles, ozAwningTile } from './tiles';

const LIGHT: OzLight = 'dusk';

/** The layout of oz-a's street (DEPTH units: screen px behind the walk line on flat ground). */
export const OZ_A_STREET = {
  camera: { yh: 56, f: 200, back: 162 },
  /** The shop fronts (the back edge), the lamps' row, the kerb, the gutter, the post rows. */
  facade: 14,
  lamp: 9.5,
  kerbBack: 8.4,
  kerbFront: 7,
  kerbH: 1.5,
  gutterFront: 5,
  backRow: 7.7,
  frontRow: -18,
  /** The flush sandstone strip the front posts stand on (depths: far, near). */
  stripFar: -16.6,
  stripNear: -19.6,
  /** The front decor's base (crowd barriers, bike racks) by the front row. */
  front: -16,
  /** How far back the top faces reach: the cars (parked against the kerb's face, spec §11 R2), the walls. */
  carTop: 7,
  wallTop: 4,
  /** How far back the shop fronts' side walls reach (spec §11 R1: the row ends, the alleys). */
  sideBack: 30,
  /** Awnings and bay roofs rise to the facade by this much (a sloped canopy / roof). */
  awningRise: 3,
  bayRise: 5,
} as const;

export const OZ_A_DEPTHS: OzDecorDepths = { facade: OZ_A_STREET.facade, lamp: OZ_A_STREET.lamp, front: OZ_A_STREET.front };

const cam = makeFloorCam(OZ_A_STREET.camera);

/** The shop of a row that holds world x (its decor's anchor x: the canopies meet the unscaled front). */
function shopAt(x: number): { frame: number; x: number } | undefined {
  return OZ_A_SHOPS.find((s) => x >= s.x && x < s.x + SHOPS[s.frame].w);
}

/** The awning's colour pair (its decor frame: width class × 3 + colour). */
function awningColour(x: number): number {
  const d = OZ_A_DECOR.find((it) => it.sprite === 'decor/oz/awning' && it.x === x);
  return (d?.frame ?? 0) % 3;
}

function overhangs(): OverhangDef[] {
  const S = OZ_A_STREET;
  const out: OverhangDef[] = [];
  OZ_A_AWNINGS.forEach(([x, y, w], i) => {
    const shop = OZ_A_SHOPS[OZ_A_AWNING_AT[i]];
    out.push({ kind: 'awning', x0: x, x1: x + w, y, depth: S.facade, rise: S.awningRise, tile: ozAwningTile(LIGHT, awningColour(x), x), anchorX: shop.x });
  });
  OZ_A_BALCONIES.forEach(([x, y, w], i) => {
    out.push({ kind: 'slab', x0: x, x1: x + w, y, depth: S.facade, tile: OZ_FLOOR_IDS.slab(LIGHT), anchorX: OZ_A_SHOPS[OZ_A_BALCONY_AT[i]].x });
  });
  {
    const [x, y, w] = OZ_A_LEDGE;
    out.push({ kind: 'slab', x0: x, x1: x + w, y, depth: S.facade, tile: OZ_FLOOR_IDS.slab(LIGHT), anchorX: shopAt(x)?.x });
  }
  for (const [x, y, w] of OZ_A_BAYS) {
    out.push({ kind: 'roof', x0: x, x1: x + w, y, depth: S.facade, rise: S.bayRise, tile: OZ_FLOOR_IDS.bayRoof(LIGHT), anchorX: shopAt(x)?.x });
  }
  return out;
}

/** The car body's top surfaces (ruin/art.ts `carBody`: the frame is 64 × 28, its foot on G; the burnt car sits 3 px lower). */
function carTops(c: OzCar): TopFaceDef[] {
  const S = OZ_A_STREET;
  const dy = c.frame === 2 ? 3 : 0;
  const top = G - 28 + dy;
  const estate = c.frame === 1;
  const paint = OZ_FLOOR_IDS.car(LIGHT, c.frame);
  // The roof and the bonnet (the sloped glass between them stays the sprite's: two quads per car,
  // each a canvas rastered every frame — the 4K frame budget).
  return [
    { x0: c.x + (estate ? 6 : 15), x1: c.x + 41, y: top + 3.6, depth: S.carTop, tile: paint },
    { x0: c.x + 49, x1: c.x + 61.5, y: top + 11, y1: top + 13.6, depth: S.carTop, tile: paint },
  ];
}

function tops(): TopFaceDef[] {
  const S = OZ_A_STREET;
  return [...OZ_A_CARS.flatMap(carTops), ...OZ_A_WALLS.map(([x, y, w]) => ({ x0: x, x1: x + w, y, depth: S.wallTop, tile: OZ_FLOOR_IDS.wallTop(LIGHT) }))];
}

/** The manholes of the layout (world x of each cover's middle). */
export const OZ_A_MANHOLES: readonly number[] = OZ_A_OPENINGS.filter((o) => o.kind === 'manhole').map((o) => o.x);

function openings(): FloorOpeningDef[] {
  const from = depthAtV(cam, -MANHOLE_R);
  const to = depthAtV(cam, MANHOLE_R);
  return OZ_A_MANHOLES.map((x) => ({ x0: x - MANHOLE_R, x1: x + MANHOLE_R, from, to, tile: OZ_FLOOR_IDS.manhole(LIGHT), ellipse: true }));
}

/** Every spot the script spawns at or a player respawns at (the front row keeps 24 px from each). */
export const OZ_A_KEEP_CLEAR: readonly number[] = [
  ...OZ_A_RISE,
  ...OZ_A_OPENINGS.map(ruinSpotX),
  ...OZ_A_CRATES.map(([x]) => x),
  OZ_A_RECORD[0],
  ...OZ_A_CHECKPOINTS,
];

const IRON: readonly [number, number] = [PAL_HD.black[5] >>> 0, PAL_HD.black[1] >>> 0];

function rows(): PropRowDef[] {
  const S = OZ_A_STREET;
  const back: Array<readonly [number, number]> = [[-200, 24], [OZ_A_EXIT.x - 8, OZ_A_EXIT.x + 200]];
  for (const o of OZ_A_OPENINGS) if (o.kind !== 'manhole') back.push([o.x - 5, o.x + (o.kind === 'door' ? 11 : (o.w ?? 23)) + 5]);
  for (const x of OZ_A_LAMPS) back.push([x - 10, x + 10]);
  for (const c of OZ_A_CARS) back.push([c.x - 6, c.x + 70]);
  for (const [x, , w] of OZ_A_WALLS) back.push([x - 6, x + w + 6]);
  back.push([OZ_A_SIGN_X - 14, OZ_A_SIGN_X + 14]);
  for (const d of OZ_A_DECOR) {
    if (d.sprite === 'decor/oz/signpost') back.push([d.x - 10, d.x + 10]);
    if (d.sprite === 'decor/oz-ruin/tape') back.push([d.x - 24, d.x + 24]);
  }
  const front: Array<readonly [number, number]> = [[-200, 74], [OZ_A_EXIT.x - 26, OZ_A_EXIT.x + 200]];
  for (const x of OZ_A_KEEP_CLEAR) front.push([x - 25, x + 25]);
  for (const d of OZ_A_DECOR) if (d.front) front.push([d.x - 22, d.x + 46]);
  return [
    { name: 'oz-a back posts', prop: OZ_FLOOR_IDS.post(LIGHT), depth: S.backRow, spacing: 30, offset: 6, gaps: back, link: { sag: 2.6, colors: IRON } },
    { name: 'oz-a front posts', prop: OZ_FLOOR_IDS.post(LIGHT), depth: S.frontRow, scale: 1.15, spacing: 34, offset: 20, gaps: front, link: { sag: 3.2, colors: IRON } },
  ];
}

/**
 * The side faces of oz-a (spec §11 R1): the shop fronts at the alleys and the row ends (and above a
 * lower neighbour), the cars' and the low walls' ends, the awnings' cheeks and the balconies' ends.
 */
function faces(): FaceGroupDef[] {
  const S = OZ_A_STREET;
  return [
    ...shopSides(OZ_A_SHOPS, { light: LIGHT, cam, facade: S.facade, back: S.sideBack }),
    ...carSides(OZ_A_CARS, LIGHT, cam, S.carTop),
    ...wallSides(OZ_A_WALLS, LIGHT, cam, S.wallTop),
    ...overhangSides(
      [
        ...OZ_A_AWNINGS.map(([x, y, w], i) => ({ kind: 'awning' as const, x, y, w, anchorX: OZ_A_SHOPS[OZ_A_AWNING_AT[i]].x, tile: ozAwningTile(LIGHT, awningColour(x), x), rise: S.awningRise })),
        ...OZ_A_BALCONIES.map(([x, y, w], i) => ({ kind: 'balcony' as const, x, y, w, anchorX: OZ_A_SHOPS[OZ_A_BALCONY_AT[i]].x })),
        { kind: 'balcony' as const, x: OZ_A_LEDGE[0], y: OZ_A_LEDGE[1], w: OZ_A_LEDGE[2], anchorX: shopAt(OZ_A_LEDGE[0])?.x ?? OZ_A_LEDGE[0] },
      ],
      LIGHT,
      cam,
      S.facade,
    ),
  ];
}

/** The decor of oz-a on the floor (depths; the items below the walk line keep their screen spot: decor.ts). */
export function ozADecor(): DecorDef[] {
  return ozFloorDecor(OZ_A_DECOR, OZ_A_DEPTHS);
}

/** oz-a's floor (fail soft: none when the kit throws while it builds, `ozKitFloor`). */
export const OZ_A_FLOOR: FloorDef | undefined = ozKitFloor('oldenzaal/oz-a', () => {
  ensureTownPainter();
  ensureOzTiles(LIGHT);
  ensureOzPost(LIGHT);
  return {
    camera: OZ_A_STREET.camera,
    painter: {
      id: OZ_FLOOR_IDS.painter,
      params: {
        light: LIGHT,
        kerbBack: OZ_A_STREET.kerbBack,
        kerbFront: OZ_A_STREET.kerbFront,
        gutterFront: OZ_A_STREET.gutterFront,
        stripFar: OZ_A_STREET.stripFar,
        stripNear: OZ_A_STREET.stripNear,
        rise: OZ_A_RISE,
        drains: OZ_A_SPOTS.drains,
        manholes: OZ_A_MANHOLES,
      },
      seed: 41,
    },
    features: [
      { kind: 'kerb', from: OZ_A_STREET.kerbBack, to: OZ_A_STREET.kerbFront, dh: OZ_A_STREET.kerbH, face: OZ_FLOOR_IDS.kerbFace(LIGHT) },
    ],
    rows: rows(),
    overhangs: overhangs(),
    tops: tops(),
    openings: openings(),
    faces: faces(),
    decorDepth: (d) => ozDecorDepth(d, OZ_A_DEPTHS),
    defaultDepth: OZ_A_STREET.facade - 1.5,
    shadow: 0.35,
    keepClear: OZ_A_KEEP_CLEAR,
  };
});
