/**
 * Mission `oat`'s place in the flow (docs/design/oat.md §1, decision 49; docs/api/oat.md "Flow"):
 *
 * `ams` → its tally (the newspaper) → `missionDone` → MissionIntroScene('oat') (the MISSION 2 card,
 * the toeristenfolder: its text is registered at boot, content/ui/cards.ts `OAT_CARD`) — the card
 * loads the LAZY oat chunk (`loadOatContent`), then preloads the mission's art and sample group, and
 * holds until the chunk has registered the mission → GameplayScene('oat') → oat-a … oat-e → the
 * kassabon (BUDGET, `MissionDef.tally: 'receipt'`) → `missionDone` → the MISSION 3 card of the rally
 * (`oat.next = 'rally'`) → the glitch into 3D.
 *
 * A direct `?mission=oat` boot loads the chunk with the boot's content (boot.ts); the art workers
 * load it when a request names an oat sprite (art-worker.ts); the node tools and tests load it
 * through `createHeadlessGame({ missionId: 'oat' })` (src/sim/headless.ts) or `loadContent(isOatContent)`.
 * A failed chunk never dead-ends the run: the card goes on to the rally's card.
 */
import { isOatContent, loadContent } from '../content/index';
import { OAT_ID } from '../content/missions/oat/ids';
import { hasMission } from '../registry';

export { OAT_ID };

/** Is `id` mission oat (the flow's dispatch: its content is lazy)? */
export function isOat(id: string | null | undefined): boolean {
  return id === OAT_ID;
}

const LOAD = { started: false, registered: false, failed: false };
let loading: Promise<void> | null = null;

/** The oat chunk's load state (read every tick by the card; no allocation). */
export function oatLoadState(): { readonly started: boolean; readonly registered: boolean; readonly failed: boolean } {
  if (!LOAD.registered && hasMission(OAT_ID)) LOAD.registered = true;
  return LOAD;
}

/** Load the lazy oat content once (the mission and its kit register). Never rejects. */
export function loadOatContent(): Promise<void> {
  if (hasMission(OAT_ID)) {
    LOAD.registered = true;
    return loading ?? Promise.resolve();
  }
  if (!loading) {
    LOAD.started = true;
    loading = loadContent(isOatContent).then(
      (report) => {
        for (const f of report.failed) console.error(`[oat] content "${f.id}" failed`);
        LOAD.registered = hasMission(OAT_ID);
        LOAD.failed = !LOAD.registered;
      },
      (err: unknown) => {
        console.error('[oat] loading the content failed:', err);
        LOAD.failed = true;
      },
    );
  }
  return loading;
}
