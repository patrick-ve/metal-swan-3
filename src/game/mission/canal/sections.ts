/**
 * The canal scenes of a running mission (docs/api/canal.md §4): the next sections' first packs load
 * while the current one plays, and a scene no section around the play needs is freed.
 */
import { artTier } from '../../../engine/sprites';
import type { SectionDef } from '../types';
import { canalActive } from './registry';
import { canalState, releaseCanal, scenesHeld, wantCanal } from './store';
import { canalDrawDensity } from './view';

/**
 * Section `current` of a mission started (undefined: the mission's preload, before the first one):
 * prefetch the scenes of the sections in `next` at their start (camera 0) at the art tier (no more
 * than the last canal frame drew), and free every scene that is neither current nor next.
 */
export function canalSections(sections: Readonly<Record<string, SectionDef>> | undefined, current: string | undefined, next: readonly string[]): void {
  if (!sections) return;
  const keep = new Set<string>();
  const cur = current ? sections[current] : undefined;
  if (cur?.canal && canalActive(cur)) keep.add(cur.canal.scene);
  const want = canalDrawDensity() > 0 ? Math.min(canalDrawDensity(), artTier()) : artTier();
  for (const id of next) {
    const def = sections[id];
    if (!def?.canal || !canalActive(def)) continue;
    keep.add(def.canal.scene);
    const st = canalState(def.canal.scene, def.canal.skip ?? []);
    // A scene a view draws already (rank 0) loads at its own camera.
    if (st && st.rank !== 0) wantCanal(st, want, 0, true);
  }
  for (const id of scenesHeld()) if (!keep.has(id)) releaseCanal(id);
}
