/**
 * The strip store (docs/design/oat.md §8.6; the contract: ./types.ts `StripStoreApi`). Owner:
 * STRIPS. WAVE A STUB (CORE): it plans the section through its source (so the source can be tested
 * against the store's calls) but builds, holds and draws nothing: `chunk()` is always null and
 * `bytes` 0. STRIPS replaces the body (jobs and band slicing, prefetch by scroll speed, eviction,
 * the two light sets, the memory accounting) and draws it from view.ts.
 */
import type { PixelBuffer } from '../../../engine/pixel';
import { getStripSource } from './source';
import type { SectionStripsDef, StripDensity, StripLightSet, StripPlan, StripSectionInfo, StripStoreApi } from './types';

/** Make the store of a section with `SectionDef.strips`. Never throws: a broken source gives a store without a plan. */
export function createStripStore(def: SectionStripsDef, section: StripSectionInfo): StripStoreApi {
  return new StubStripStore(def, section);
}

class StubStripStore implements StripStoreApi {
  readonly plan: StripPlan | null;
  darkMix = 0;

  constructor(def: SectionStripsDef, section: StripSectionInfo) {
    let plan: StripPlan | null = null;
    try {
      plan = getStripSource(def.source)?.plan(def, section) ?? null;
    } catch (err) {
      console.warn(`[strips] source "${def.source}" failed to plan ${section.id}:`, err);
    }
    this.plan = plan;
  }

  prepare(_viewX: number, _speed: number): void {}

  chunk(_cx: number, _d: StripDensity, _set?: StripLightSet): PixelBuffer | null {
    return null;
  }

  get bytes(): number {
    return 0;
  }

  dispose(): void {}
}
