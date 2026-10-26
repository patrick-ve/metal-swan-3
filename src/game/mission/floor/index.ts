/**
 * The perspective floor's game part (docs/design/floor.md, docs/api/floor.md): the `FloorDef`
 * contract, the registries (painters, tiles, procedural props), the per-section floor the
 * SectionView draws, the hooks for the light pass, the checks the tests and the review run, and the
 * debug floor.
 */
export * from './types';
export * from './registry';
export * from './section-floor';
export * from './hooks';
export * from './builtin';
export * from './debug';
export * from './checks';
export { scaleFrame } from './scale';
