/**
 * Content area `ring/boss` (docs/design/ring.md §R.3; docs/api/ring.md "ZWAAN train: controller,
 * container, cab"). Revision R: the test lorry `ring-lorry` is RETIRED; its container half is the
 * ZWAAN train's container trailer (zwaan/container.ts) and keeps its adds here: `ring-forklift`
 * and `ring-barrel` (adds.ts) and the shared geometry (geometry.ts). Sprites: art.ts.
 *
 * This module (manifest entry `ring/boss`) also loads the ZWAAN train (`zwaan/index.ts`: the
 * controller and the five parts).
 */
import '../zwaan/index';

export { CARGO_AI, FORKLIFT_AI, RingCargo, RingForklift, type CargoKind, type ForkMode } from './adds';
export { CARGO_ID, CONTAINER_REAR, FORKLIFT_ID, LORRY, LORRY_ART, SPR } from './geometry';
