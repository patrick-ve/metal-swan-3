/**
 * The façade strips (an additive opt-in; docs/design/oat.md §8.6, docs/api/oat.md "Strips"): the
 * contract (types.ts), the strip space (space.ts: strip x ↔ world x on the façade plane), the source
 * registry (source.ts), the store (store.ts: jobs, prefetch, eviction, light sets, the budgets), the
 * live-store lookup (live.ts: the light pass's cross-fade) and a placeholder source (placeholder.ts:
 * tests, tools, a fallback). `SectionDef.strips` opts a section in; without it nothing here runs.
 */
export * from './types';
export { defineStripSource, getStripSource, hasStripSource } from './source';
export { createStripStore, stripChunkWorld, StripStore, type StripStats, type StripStoreOpts } from './store';
export { chunkWorldRange, chunksOfRange, stripBandRows, stripBaseY, stripChunkOfU, stripDrawX, stripScale, stripXOfU, TickSpeed, uOfStripX } from './space';
export { liveStripStore, setStripDarkMix } from './live';
export { definePlaceholderStrips, PLACEHOLDER_STRIP_SOURCE } from './placeholder';
