/**
 * The façade grammar of mission `oat` (docs/design/oat.md §8.6, levers L7 + L8; §8.2 the MIXED
 * scale; §8.10 façade wear; §8.11 no ink outlines; docs/api/oat.md "GRAMMAR"). Owner: GRAMMAR.
 * One-line contract: it registers the strip source `OAT_STRIP_SOURCE` (`defineStripSource`,
 * mission/strips/) that plans a section's façade rows from a street sheet and paints their chunks
 * at 1× / 2× / 4× in either light set, and it exposes the planned lots (`facadeLots`) so
 * LIGHT-WATER's shadow function and the tests read the same heights and protrusions the painters
 * draw.
 *
 * Files: types.ts (ids, plan types, the scale constants), sheets.ts (the street style sheets),
 * grammar.ts (the lot sequencer: widths, the no-repeat types, the geometry, details, wear,
 * features), rows.ts (each section's rows `OAT_STRIPS`, the opposite row, the plan cache),
 * palette.ts (material ramps, light tables), raster.ts (the index raster of a chunk band), parts.ts
 * (the part drawers), light.ts (sun, shade and night light; the resolve), source.ts (the strip
 * source).
 */
import type { GableType } from './types';
import { sectionLots } from './rows';
import './source';

export type { GableType, StreetSheetId } from './types';
export type { LotPlan, FacadeFeature, WallId, WindowId, GroundKind } from './types';
export { OAT_STRIPS, FACADE_DEPTH, FACADE_HEIGHT, defineFacadeRows, facadeRows, planSection, sectionLots, oppositeRow } from './rows';
export { grammarPlan, OAT_FACADE_SOURCE } from './source';
export { planRow, type FacadeRowParams, type RowPlan } from './grammar';
export { SHEETS, BUILT_SHEETS, sheetOf } from './sheets';

/** One planned lot of a façade row, in world px (the grammar's output; spec §8.2 numbers). */
export interface FacadeLot {
  /** World x of the lot's left edge and its width (Amsterdam feet × 0.6 scale, spec §8.2). */
  u0: number;
  w: number;
  gable: GableType;
  /** Wall material and window type ids of the grammar (the no-repeat triple with `gable`). */
  wall: string;
  window: string;
  /** Height of the ground band above the façade base (true scale, 64–84 px) and of the ridge / gable tip (world px). */
  bandTop: number;
  ridge: number;
  /** Protrusions that cast shadows (spec §8.4): depth in metres and height above the base in world px. */
  protrusions: readonly { readonly kind: string; readonly u0: number; readonly u1: number; readonly y: number; readonly depthM: number }[];
}

/**
 * The planned lots of a section's façade rows (and its unseen opposite row with `opposite`), in
 * world x order (empty for a section without rows).
 */
export function facadeLots(sectionId: string, opposite = false): readonly FacadeLot[] {
  return sectionLots(sectionId, opposite);
}
