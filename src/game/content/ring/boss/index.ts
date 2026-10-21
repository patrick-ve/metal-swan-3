/**
 * Content area `ring/boss` (docs/design/ring.md §6; wave B; docs/api/ring.md §22). Owner: the BOSS
 * builder. The test mid-boss `ring-lorry` (lorry.ts) with its adds `ring-forklift` and
 * `ring-barrel` (adds.ts); the geometry they share with the art (geometry.ts). Sprites: art.ts.
 */
export { CARGO_AI, FORKLIFT_AI, RingCargo, RingForklift, type CargoKind, type ForkMode } from './adds';
export { CARGO_ID, FORKLIFT_ID, LORRY, LORRY_ART, LORRY_ID, LORRY_NAME, PART_X, SPR } from './geometry';
export { LORRY_AI, RingLorry, RingLorryBox, type LorryAttackTrace } from './lorry';
