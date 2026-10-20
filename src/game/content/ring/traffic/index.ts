/**
 * Content area `ring/traffic` (docs/design/ring.md §8; docs/api/ring.md "Entities"). Owner: the
 * ROAD builder. Civilian traffic `ring-car` (params model, colour, rel, hostage, item, stopAt):
 * cover (a SolidBox over its depth slab), dents, bumps, never destroyed. Sprites: art.ts.
 * Shared ROAD helpers: road-kit.ts; our sign lettering: lettering.ts.
 */
export { CAR_GEO, CAR_MODELS, carColour, carSprite, HOSTAGE_VAN, type CarGeo } from './geometry';
export { BUMP_HARD, BUMP_SOFT, DENT_HITS, LANE_REL, makeCar, RingCar } from './car';
export { drivenWagons, jamOf, nearestWagon, PlaneTumbler, RingLayer, tumbleOff, type JamState } from './road-kit';
