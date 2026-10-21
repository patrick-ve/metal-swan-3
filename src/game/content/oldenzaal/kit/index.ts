/**
 * Mission oldenzaal — the shared kit (docs/api/oldenzaal.md): the light contract
 * (./light-api.ts, CORE), the ghost draw (./ghost-draw.ts, CORE) and the LIGHT builder's runtime
 * pieces: the point light entity 'oz-light-point' (./light-point.ts) and the weather layer
 * generators 'oz-fog' / 'oz-rain' (../weather/). The pass itself is src/game/mission/light/.
 * Owner of this file: LIGHT (it registers its entities and generators at import time).
 */
export * from './light-api';
export * from './ghost-draw';
export { OzLightPoint, OZ_LIGHT_POINT } from './light-point';
export { OZ_FOG_GEN, OZ_RAIN_GEN, paintFog, paintRain } from '../weather/index';
