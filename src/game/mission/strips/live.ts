/**
 * The live strip store of a section (docs/design/oat.md §8.9: the 03:00 cross-fade). The section view
 * registers the store it draws (by section id) and drops it when it is disposed; the light pass (or a
 * script) sets the cross-fade through it without a reference to the view: `setStripDarkMix('oat-d',
 * mix)`. Art only: nothing here is game state.
 */
import type { StripStoreApi } from './types';

const live = new Map<string, StripStoreApi>();

/** The view registers (store) or drops (null) the store it draws for a section id. */
export function bindLiveStripStore(sectionId: string, store: StripStoreApi | null): void {
  if (store) live.set(sectionId, store);
  else live.delete(sectionId);
}

/** Drop the binding only while it is still this store (a newer view of the section keeps its own). */
export function unbindLiveStripStore(sectionId: string, store: StripStoreApi): void {
  if (live.get(sectionId) === store) live.delete(sectionId);
}

/** The store the live view of a section draws (undefined: none, or the section has no strips). */
export function liveStripStore(sectionId: string): StripStoreApi | undefined {
  return live.get(sectionId);
}

/** Set the lit → dark cross-fade of a section's strips (0 lit … 1 dark; clamped). No store: nothing. */
export function setStripDarkMix(sectionId: string, mix: number): void {
  const s = live.get(sectionId);
  if (s) s.darkMix = mix <= 0 ? 0 : mix >= 1 ? 1 : mix;
}
