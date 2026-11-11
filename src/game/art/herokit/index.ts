/**
 * The hero method in TypeScript (docs/design/ams2.md §1, docs/design/ams2-contract.md): scenery built
 * the way the heroes are built. One pixel size per object, ramps of about 4 tones, hard clusters, no
 * gradient, no dither, no grain, no alpha; each part keeps a z and a part id; one selout pass and one
 * exterior outline; light from the upper right. Deterministic: seeded, no clock, no `Math.random`,
 * no DOM, so it runs in the art workers and in node.
 */
export * from './canvas';
export * from './canvas-math';
export * from './floors';
export * from './foliage';
export * from './hi';
export * from './masonry';
export * from './palette';
export * from './props';
export * from './rng';
export * from './sky';
export * from './walls';
export * from './water';
