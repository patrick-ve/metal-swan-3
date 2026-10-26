/**
 * The Oldenzaal floor kit (docs/design/floor.md §5; docs/api/floor.md): the perspective floor of
 * the town's sections. Wave A: oz-a (the shopping street at dusk). Wave B adds oz-b, oz-c, the
 * nave and the crypt next to it (their own painters or the town painter with their own layout and
 * light mood; the church's materials as new tiles).
 *
 * - kit.ts — the light moods (graded tone ladders), grain and noise in texture space, the ids;
 * - town.ts — the painter `oz/town` (sandstone pavement, kerb, slate gutter, herringbone street,
 *   wear and moss, cracked pavers at the rise spots, the manholes' cast frames, the drains);
 * - tiles.ts — the tiles (kerb face, awning canvas, balcony slab, bay roof, wall coping, car tops,
 *   manhole cover and shaft) and the iron post prop;
 * - decor.ts — the depth rules of the town's decor (`ozFloorDecor`, `ozDecorDepth`);
 * - flat.ts — the entities' hooks (`ozFacadeDepth`, `FxDepths` + `dustAt`: a burst's fx at the
 *   front's depth, render only; `FlatCover`);
 * - oz-a.ts — `OZ_A_FLOOR` and oz-a's decor on the floor.
 */
export { OZ_FLOOR_IDS, OZ_FLOOR_LIGHTS, blendRamps, moodTones, moodTonesOf, toneAt, type OzLight } from './kit';
export { townGutter, townTexels, ensureTownPainter, BRICK_DARK_MIN, BRICK_MIN, MANHOLE_R, STREET_GRIME, type OzTownLayout } from './town';
export { ensureOzTiles, ensureOzPost, ozAwningTile, postFrame, AWNING_PAIRS, POST_W, POST_H } from './tiles';
export { ozDecorDepth, ozFloorDecor, type OzDecorDepths } from './decor';
export { dustAt, FxDepths, ozFacadeDepth, ozFloorLight, floorDrawDensity, FlatCover } from './flat';
export { OZ_A_FLOOR, OZ_A_STREET, OZ_A_DEPTHS, OZ_A_MANHOLES, OZ_A_KEEP_CLEAR, ozADecor } from './oz-a';
