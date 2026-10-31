/**
 * The façade strips (an additive opt-in; docs/design/oat.md §8.6, docs/api/oat.md "Strips"): the
 * contract (types.ts), the source registry (source.ts) and the store (store.ts; the wave-A stub).
 * `SectionDef.strips` opts a section in; without it nothing here runs.
 */
export * from './types';
export { defineStripSource, getStripSource, hasStripSource } from './source';
export { createStripStore } from './store';
