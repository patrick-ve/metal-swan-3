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
 *   the awning canopies;
 * - `props.ts` — the Amsterdammertje prop `ams/pole` and the bridges' front railings;
 * - `depth.ts` — where the ams decor stands in depth;
 * - `sides.ts` — the side faces of house fronts, houseboats and boxes (spec §11 R1);
 * - `drawbridge.ts` — a raised drawbridge in the street: gallows, leaf, barriers (spec §11 R2);
 * - `boat.ts` — the small open canal boat's top and ends, drawn by the moving entity (spec §11 R1);
 * - `guard.ts` — fail soft: a kit that throws while a section loads leaves that section without a floor;
 * - `section-a.ts` — the floor of section a (wave A; wave B adds b, c, c1, c2, d beside it).
 */
import './painter';
import './tiles';
import './props';

export * from './layout';
export * from './depth';
export { floorLight, type FloorLight } from './mat';
export { onBikeSymbol, crossingOffset, hillAt, TEETH_GAP, TOOTH_LEN } from './painter';
export { ensureArchTile, ensureCanopyTile } from './tiles';
export { ensureFrontRail, frontRailId, poleFrame } from './props';
export { boatSides, boxSides, depthBehind, depthPx, ensureBandTile, ensureRoofTile, ensureWallTile, houseSides, railPostSides } from './sides';
export type { BandTileOpts, BoatSidesOpts, HouseSidesOpts, WallTileOpts } from './sides';
export { drawbridgeFloor, type Drawbridge } from './drawbridge';
export { kitDecor, kitFloor } from './guard';
export { ensureRowboatTiles, ROWBOAT_BEAM, RowboatFaces, withRowboatFaces } from './boat';
export { A_BRIDGE_1, A_BRIDGE_2, A_BULBS, A_DRAWBRIDGE, A_KEEP_CLEAR, A_LAYOUT, AMS_BACK, AMS_CAMERA, aFloor, BOAT_CABIN, BOAT_HULL, BOAT_ROOF, frontRailDecor } from './section-a';
