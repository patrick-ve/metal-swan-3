/**
 * The light of mission `oat` (docs/design/oat.md §8.3, §8.4, §8.8, §8.9; docs/api/oat.md "LIGHT-WATER").
 * Owner: LIGHT-WATER. One-line contract: the sun of every day section (sun.ts `OAT_SUN`, read by every
 * painter at paint time), the shade function for the floor, the strips and the opposite row
 * (shadow.ts, section-shade.ts), the day sections' ground overlays (day.ts: the actors' sun tails and
 * the dynamic reflections), the night lights of oat-d and oat-e (night.ts: `defineSectionLight` with
 * the oat flags `glow`, `streaks`, `groups`, `bakes`), and the water tiles and baked reflection strips
 * (water.ts). Importing this module registers all of it (the oat chunk does: ../index.ts).
 */
export * from './sun';
export * from './shadow';
export * from './section-shade';
export * from './water';
export * from './night';
export * from './day';
