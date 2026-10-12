/**
 * Content manifest — owned by the orchestrator (docs/ARCHITECTURE.md §7). Ask before editing.
 *
 * Every entry is imported lazily and independently (Promise.allSettled), so one broken module
 * never stops the game; anything it would have registered falls back to placeholders.
 * Modules register their content at import time through the define* functions.
 */
export const CONTENT_MODULES: Readonly<Record<string, () => Promise<unknown>>> = {
  fx: () => import('./fx/index'),
  'fx/art': () => import('./fx/art'),
  ui: () => import('./ui/index'),
  'ui/art': () => import('./ui/art'),
  sfx: () => import('./sfx/index'),
  music: () => import('./music/index'),
  'music/missions': () => import('./music/missions'),
  'music/finale': () => import('./music/finale'),
  characters: () => import('./characters/index'),
  'characters/art': () => import('./characters/art'),
  weapons: () => import('./weapons/index'),
  'weapons/art': () => import('./weapons/art'),
  items: () => import('./items/index'),
  'items/art': () => import('./items/art'),
  props: () => import('./props/index'),
  'props/art': () => import('./props/art'),
  infantry: () => import('./infantry/index'),
  'infantry/art': () => import('./infantry/art'),
  'infantry/rhythm': () => import('./infantry/rhythm/index'),
  'infantry/rhythm/art': () => import('./infantry/rhythm/art'),
  'infantry/winds': () => import('./infantry/winds/index'),
  'infantry/winds/art': () => import('./infantry/winds/art'),
  machines: () => import('./machines/index'),
  'machines/art': () => import('./machines/art'),
  'machines/armor': () => import('./machines/armor/index'),
  'machines/armor/art': () => import('./machines/armor/art'),
  'machines/transport': () => import('./machines/transport/index'),
  'machines/transport/art': () => import('./machines/transport/art'),
  creatures: () => import('./creatures/index'),
  'creatures/art': () => import('./creatures/art'),
  vehicles: () => import('./vehicles/index'),
  'vehicles/art': () => import('./vehicles/art'),
  'vehicles/swan': () => import('./vehicles/swan/index'),
  'vehicles/swan/art': () => import('./vehicles/swan/art'),
  'vehicles/fleet': () => import('./vehicles/fleet/index'),
  'vehicles/fleet/art': () => import('./vehicles/fleet/art'),
  'missions/m0': () => import('./missions/m0/index'),
  'missions/m1': () => import('./missions/m1/index'),
  'missions/m2': () => import('./missions/m2/index'),
  'missions/m3': () => import('./missions/m3/index'),
  'missions/m4': () => import('./missions/m4/index'),
  'missions/m5': () => import('./missions/m5/index'),
  'bosses/m1': () => import('./bosses/m1/index'),
  'bosses/m2': () => import('./bosses/m2/index'),
  'bosses/m3': () => import('./bosses/m3/index'),
  'bosses/m4': () => import('./bosses/m4/index'),
  'bosses/m5': () => import('./bosses/m5/index'),
};

export interface ContentReport {
  loaded: string[];
  failed: Array<{ id: string; error: string }>;
}

/** Import every manifest entry accepted by `filter`. Never throws. */
export async function loadContent(
  filter: (id: string) => boolean = () => true,
): Promise<ContentReport> {
  const ids = Object.keys(CONTENT_MODULES).filter(filter);
  const results = await Promise.allSettled(ids.map((id) => CONTENT_MODULES[id]()));
  const report: ContentReport = { loaded: [], failed: [] };
  results.forEach((result, i) => {
    const id = ids[i];
    if (result.status === 'fulfilled') {
      report.loaded.push(id);
    } else {
      const reason: unknown = result.reason;
      const error =
        reason instanceof Error ? `${reason.message}\n${reason.stack ?? ''}` : String(reason);
      report.failed.push({ id, error });
      console.error(`[content] failed to load "${id}":`, reason);
    }
  });
  return report;
}

/** Manifest ids that only define sprites (used by `npm run sprites`). */
export const ART_MODULE_IDS: readonly string[] = Object.keys(CONTENT_MODULES).filter(
  (id) => id.endsWith('/art') || id.startsWith('missions/') || id.startsWith('bosses/'),
);
