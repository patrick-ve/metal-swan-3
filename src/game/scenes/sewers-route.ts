/**
 * Mission `sewers`'s place in the flow (docs/design/sewers.md §1; the role the former level 2's
 * oat-route.ts had, `git show eb3316a:src/game/scenes/oat-route.ts`):
 *
 * `ams` → its tally (the newspaper) → `missionDone` → MissionIntroScene('sewers') (the MISSION 2
 * card: its text is registered at boot, content/ui/cards.ts `SEWERS_CARD`) — the card loads the LAZY
 * sewers chunk (`loadSewersContent`), then preloads the mission's art and sample group, and holds
 * until the chunk has registered the mission → GameplayScene('sewers') → sewers-a … sewers-end → the
 * tally (the newspaper with euros) → `missionDone` → the MISSION 3 card of the rally (`sewers.next =
 * 'rally'`) → the glitch into 3D.
 *
 * A direct `?mission=sewers` boot loads the chunk with the boot's content (boot.ts); the art workers
 * load it when a request names a sewers sprite (art-worker.ts `isSewersSpriteId`); the node tools and
 * tests load it through `createHeadlessGame({ missionId: 'sewers' })` (src/sim/headless.ts) or
 * `loadContent(isSewersContent)`. A failed chunk never dead-ends the run: the card goes on to the
 * rally's card.
 */
import { isSewersContent, loadContent } from '../content/index';
import { SEWERS_ID } from '../content/missions/sewers/ids';
import { hasMission } from '../registry';

export { SEWERS_ID };

/** Is `id` mission sewers (the flow's dispatch: its content is lazy)? */
export function isSewers(id: string | null | undefined): boolean {
  return id === SEWERS_ID;
}

const LOAD = { started: false, registered: false, failed: false };
let loading: Promise<void> | null = null;

/** The sewers chunk's load state (read every tick by the card; no allocation). */
export function sewersLoadState(): { readonly started: boolean; readonly registered: boolean; readonly failed: boolean } {
  if (!LOAD.registered && hasMission(SEWERS_ID)) LOAD.registered = true;
  return LOAD;
}

/** Load the lazy sewers content once (the mission and its kit register). Never rejects. */
export function loadSewersContent(): Promise<void> {
  if (hasMission(SEWERS_ID)) {
    LOAD.registered = true;
    return loading ?? Promise.resolve();
  }
  if (!loading) {
    LOAD.started = true;
    loading = loadContent(isSewersContent).then(
      (report) => {
        for (const f of report.failed) console.error(`[sewers] content "${f.id}" failed`);
        LOAD.registered = hasMission(SEWERS_ID);
        LOAD.failed = !LOAD.registered;
      },
      (err: unknown) => {
        console.error('[sewers] loading the content failed:', err);
        LOAD.failed = true;
      },
    );
  }
  return loading;
}
