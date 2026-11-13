/**
 * THE LIGHT CONTRACT of mission `oldenzaal` (docs/design/oldenzaal.md §10; docs/api/oldenzaal.md
 * "Light"). Since the oat wave A (docs/design/oat.md (deleted; git show eb3316a) §8.9) the contract lives in a neutral home,
 * `src/game/mission/light/api.ts`; this module re-exports it unchanged, so every oldenzaal import
 * keeps working and oldenzaal lights exactly as before.
 */
export * from '../../../mission/light/api';
