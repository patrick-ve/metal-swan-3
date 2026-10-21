/**
 * The mission light pass (an additive opt-in; docs/design/oldenzaal.md §10.2): pass.ts (the pass
 * the runner makes for a section with a light config) and lightmap.ts (the darkness / glow map).
 */
export { MissionLight, flickerAt, gustAt, MAX_DARKNESS, FOG_GEN, RAIN_GEN, THUNDER_SFX, REDUCED_FLASH } from './pass';
export { LightMap } from './lightmap';
