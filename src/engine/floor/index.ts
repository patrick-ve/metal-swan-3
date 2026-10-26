/**
 * The perspective floor's engine part (docs/design/floor.md §1–§3, docs/api/floor.md): the camera
 * maths, the height field and its mesh, the texture store, the CPU raster and the GPU contract.
 * Pure and headless-safe; the game layer (src/game/mission/floor/) builds a section's floor from its
 * `FloorDef` and draws it.
 */
export * from './cam';
export * from './mesh';
export * from './tex-layout';
export * from './tex';
export * from './gpu';
export * from './raster';
export * from './quad';
