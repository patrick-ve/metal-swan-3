/**
 * Content area `ring/items` (docs/design/ring.md §8; docs/api/ring.md "Entities"). Owner: the ROAD
 * builder. `ring-crate` (crate.ts: the RingPickup driven over on the road), `ring-hostage`
 * (hostage.ts: a tied hostage riding on a carrier) and the carrier hook (carrier.ts) that the
 * hostage van and wave B's parcel vans and caravans implement. Sprites: art.ts.
 */
export { isCarrier, type HostageCarrier, type SeatOut } from './carrier';
export { armourLow, giveItem, LOW_ARMOUR, pickupOf, RingCrate, ringContents, ringCrateRoll, RING_WEAPONS } from './crate';
export { hostageGiftRoll, RingHostage, RING_HOSTAGE, type RingHostageState } from './hostage';
