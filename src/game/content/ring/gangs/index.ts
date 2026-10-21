/**
 * Content area `ring/gangs` (docs/design/ring.md §5.2, §5.4, §8, §9; docs/api/ring.md "Wave B:
 * gangs"; wave B). Owner: the GANGS builder.
 * - `ring-parcel-van` (van.ts): the parcel van — rear doors, a parcel thrower or a gunner, the
 *   brake check, the hostage behind a grille, the NIET THUIS gloat (courier.ts).
 * - `ring-parcel` (parcel.ts): a thrown parcel, an obstacle in its lane.
 * - `ring-caravan` (caravan.ts): the caravan car — the roof-hatch gunner, the loose caravan that
 *   swerves, tips and slides onto the shoulder, the fleeing tow car, the hostage behind a grille.
 * Shared: geometry.ts (numbers of the art and the entities), kit.ts (lanes, wagon contact,
 * tumbles, drops). Sprites: art.ts (+ art-kit, art-van, art-caravan, art-people). Sounds:
 * content/sfx/ring-gangs.ts (`RING_GANGS`).
 */
export { CARAVAN_AI, RingCaravan, RingTowCar, type CaravanMode } from './caravan';
export { COURIER, RingCard, RingCourier, type CourierState } from './courier';
export { CARAVAN, CARAVAN_ART, GANG_IDS, PARCEL, VAN, VAN_ART } from './geometry';
export { PARCEL_AI, RingParcel, type ParcelState } from './parcel';
export { RingParcelVan, VAN_AI, type VanCrew, type VanMode } from './van';
