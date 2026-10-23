/**
 * r3: the pure 3D maths of the race and the 3D view (docs/design/rally.md §12.1, §12.4;
 * docs/api/rally.md "A. Wave A contracts"). PREP's core: vectors (`vec.ts`), column-major 4×4
 * matrices (`mat.ts`), the deterministic trig tables (`trig.ts`) and the closed track spline
 * (`spline.ts`). Builders add their own files here (mesh builders, culling, ...) and export them
 * from their own modules; they never edit these four.
 */
export * from './vec';
export * from './mat';
export * from './trig';
export * from './spline';
