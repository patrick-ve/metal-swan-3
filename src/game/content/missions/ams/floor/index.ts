/**
 * The Amsterdam floor kit (docs/design/floor.md §4; API docs/api/floor.md): everything the `ams`
 * sections need for their perspective floor, registered at import time.
 *
 * - `mat.ts` — the materials (asphalt, paint, tiles, granite, cobbles, the fan, klinkers) and the
 *   time-of-day light;
 * - `layout.ts` — the street layout as data (kerb lines, street pieces, crossings, bridges, canals)
 *   and its compilers (`streetFeatures`, `poleRow`, `rowGaps`);
 * - `painter.ts` — the floor painter `ams/floor` (the crossing §4.2, the bike symbol §4.3);
 * - `tiles.ts` — kerb faces, quay walls, the canal water, the bridges' arch faces, the top faces and
 *   the awning canopies; wave B: river water (`riverSurface`), pool rims, steps, the pontoon's deck,
 *   the passage's walls and vault;
 * - `props.ts` — the Amsterdammertje prop `ams/pole`, the bridges' front railings, the lawn chains
 *   (`lawnChainRow`, wave B);
 * - `depth.ts` — where the ams decor stands in depth;
 * - `sides.ts` — the side faces of house fronts, houseboats and boxes (spec §11 R1);
 * - `drawbridge.ts` — a raised drawbridge in the street: gallows, leaf, barriers (spec §11 R2);
 * - `boat.ts` — the small open canal boat's top and ends, drawn by the moving entity (spec §11 R1);
 * - `entities.ts` — the faces of the moving and breakable entities (spec §12.1 item 4: crates, stalls,
 *   the cart, the racks, the boats, the bascule, the low bridges): `amsEntityFaces(kinds)`;
 * - `guard.ts` — fail soft: a kit that throws while a section loads leaves that section without a floor;
 * - `section-a.ts` — the floor of section a (wave A, the worked example);
 * - `b/`, `c/`, `c1/`, `c2/`, `d/` — one folder per wave-B section (its builder's): `index.ts` exports
 *   the section's floor (`bFloor(decor)` …) and its switch (`B_FLOOR_ON` …); `sections.ts` lists them.
 *
 * Wave B's materials (spec §4.1, §12.2): the street kinds and `FloorArea`s gravel, grass, stone (the
 * Stopera), planks, tiles, klinkers, granite (layout.ts, painted by `ams/floor`); `pool`,
 * `stepFeatures` (height field), `riverSurface`, `pontoonFaces`, `lawnChainRow`, the passage tiles.
 */
import './painter';
import './tiles';
import './props';

export * from './layout';
export * from './depth';
export { dt, floorLight, granite, grass, gravel, klinkers, planks, stoneTiles, tiles as pavementTiles, type FloorLight } from './mat';
export { onBikeSymbol, crossingOffset, hillAt, TEETH_GAP, TOOTH_LEN } from './painter';
export { ensureArchTile, ensureCanopyTile, ensurePassageWallTile, riverSurface } from './tiles';
export { ensureFrontRail, frontRailId, LAWN_CHAIN, lawnChainRow, lawnPostFrame, poleFrame, type LawnChainRowOpts } from './props';
export { boatSides, boxSides, depthBehind, depthPx, ensureBandTile, ensureRoofTile, ensureWallTile, houseSides, pontoonFaces, railPostSides } from './sides';
export type { BandTileOpts, BoatSidesOpts, HouseSidesOpts, WallTileOpts } from './sides';
export { drawbridgeFloor, type Drawbridge } from './drawbridge';
export { kitDecor, kitFloor } from './guard';
export { ensureRowboatTiles, ROWBOAT_BEAM, rowboatFaces } from './boat';
export {
  AMS_FACES_MAX,
  AMS_STREET_FACED,
  amsEntityFaces,
  breakableFaces,
  crateFaceState,
  crateFaces,
  cruiseBoatFaces,
  lowBridgeFaces,
  magereBrugFaces,
  tourBoatFaces,
  type AmsEntityFacesOpts,
  type AmsFacedKind,
  type BoatFacesOpts,
  type BridgeFacesOpts,
} from './entities';
export { A_BRIDGE_1, A_BRIDGE_2, A_BULBS, A_DRAWBRIDGE, A_KEEP_CLEAR, A_LAYOUT, aFloor, BOAT_CABIN, BOAT_HULL, BOAT_ROOF, frontRailDecor } from './section-a';
