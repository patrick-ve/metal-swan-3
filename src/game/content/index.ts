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
  'music/ams': () => import('./music/ams'),
  samples: () => import('./samples/index'),
  characters: () => import('./characters/index'),
  'characters/art': () => import('./characters/art'),
  'characters/select': () => import('./characters/select.art'),
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
  locals: () => import('./locals/index'),
  'locals/art': () => import('./locals/art'),
  'vehicles/swan': () => import('./vehicles/swan/index'),
  'vehicles/swan/art': () => import('./vehicles/swan/art'),
  'vehicles/fleet': () => import('./vehicles/fleet/index'),
  'vehicles/fleet/art': () => import('./vehicles/fleet/art'),
  'vehicles/beer-bike': () => import('./vehicles/beer-bike/index'),
  'vehicles/beer-bike/art': () => import('./vehicles/beer-bike/art'),
  stag: () => import('./stag/index'),
  'stag/art': () => import('./stag/art'),
  'missions/ams': () => import('./missions/ams/index'),
  'missions/m0': () => import('./missions/m0/index'),
  'missions/m1': () => import('./missions/m1/index'),
  'missions/m2': () => import('./missions/m2/index'),
  'missions/m3': () => import('./missions/m3/index'),
  'missions/m4': () => import('./missions/m4/index'),
  'missions/m5': () => import('./missions/m5/index'),
  'bosses/ams': () => import('./bosses/ams/index'),
  'bosses/ams-scan': () => import('./bosses/ams-scan/index'),
  'bosses/m1': () => import('./bosses/m1/index'),
  'bosses/m2': () => import('./bosses/m2/index'),
  'bosses/m3': () => import('./bosses/m3/index'),
  'bosses/m4': () => import('./bosses/m4/index'),
  'bosses/m5': () => import('./bosses/m5/index'),
  // Mission `ring` (docs/design/ring.md §13.1; not lazy): one entry per area and builder.
  'ring/wagon': () => import('./ring/wagon/index'),
  'ring/wagon/art': () => import('./ring/wagon/art'),
  'ring/scenery': () => import('./ring/scenery/index'),
  'ring/scenery/art': () => import('./ring/scenery/art'),
  'ring/traffic': () => import('./ring/traffic/index'),
  'ring/traffic/art': () => import('./ring/traffic/art'),
  'ring/hazards': () => import('./ring/hazards/index'),
  'ring/hazards/art': () => import('./ring/hazards/art'),
  'ring/items': () => import('./ring/items/index'),
  'ring/items/art': () => import('./ring/items/art'),
  'ring/scooter': () => import('./ring/scooter/index'),
  'ring/scooter/art': () => import('./ring/scooter/art'),
  // wave B
  'ring/gangs': () => import('./ring/gangs/index'),
  'ring/gangs/art': () => import('./ring/gangs/art'),
  'ring/convoy': () => import('./ring/convoy/index'),
  'ring/convoy/art': () => import('./ring/convoy/art'),
  'ring/crew': () => import('./ring/crew/index'),
  'ring/crew/art': () => import('./ring/crew/art'),
  'ring/boss': () => import('./ring/boss/index'),
  'ring/boss/art': () => import('./ring/boss/art'),
  // Revision R (docs/design/ring.md §R): the ZWAAN truck (TRAIN-1 / TRAIN-2 add their `…/art` entries)
  // and the on-foot part (the unregistered foot MissionDef; JAM+FOOT adds its entities and art).
  'ring/zwaan': () => import('./ring/zwaan/index'),
  'ring/foot': () => import('./ring/foot/index'),
  'ring/foot/art': () => import('./ring/foot/art'),
  // Revision R wave B (PREP): the blockade's people (ACTIVISTS) and the pink boat (BLOCKADE+BOAT).
  'ring/activists': () => import('./ring/activists/index'),
  'ring/activists/art': () => import('./ring/activists/art'),
  'ring/boot': () => import('./ring/boot/index'),
  'ring/boot/art': () => import('./ring/boot/art'),
  // Mission `oldenzaal`, level 4 (docs/design/oldenzaal.md §13; docs/api/oldenzaal.md; not lazy):
  // one entry per area and owner (ids: missions/oldenzaal/ids.ts).
  'missions/oldenzaal': () => import('./missions/oldenzaal/index'),
  'oldenzaal/kit': () => import('./oldenzaal/kit/index'),
  'oldenzaal/kit/art': () => import('./oldenzaal/kit/art'),
  'oldenzaal/npcs': () => import('./oldenzaal/npcs/index'),
  'oldenzaal/npcs/art': () => import('./oldenzaal/npcs/art'),
  'oldenzaal/items': () => import('./oldenzaal/items/index'),
  'oldenzaal/items/art': () => import('./oldenzaal/items/art'),
  // Revision 2 (wave B): the dead soldiers, the ruined town, the church, the tower, the statue.
  'oldenzaal/zombies': () => import('./oldenzaal/zombies/index'),
  'oldenzaal/zombies/art': () => import('./oldenzaal/zombies/art'),
  'oldenzaal/ruin': () => import('./oldenzaal/ruin/index'),
  'oldenzaal/ruin/art': () => import('./oldenzaal/ruin/art'),
  'oldenzaal/church': () => import('./oldenzaal/church/index'),
  'oldenzaal/church/art': () => import('./oldenzaal/church/art'),
  'oldenzaal/tower': () => import('./oldenzaal/tower/index'),
  'oldenzaal/tower/art': () => import('./oldenzaal/tower/art'),
  'bosses/oldenzaal': () => import('./bosses/oldenzaal/index'),
  'music/oldenzaal': () => import('./music/oldenzaal'),
  'sfx/oldenzaal': () => import('./sfx/oldenzaal'),
  // The first-person mode (docs/design/fps.md §3.6): LAZY — the boot skips them (isLazyContent);
  // FpsIntroScene loads them behind its progress bar (loadFpsContent).
  fps: () => import('./fps/index'),
  'fps/art': () => import('./fps/art'),
  'fps/sound': () => import('./fps/sound'),
  'fps/floors': () => import('./fps/floors'),
  // Mission `rally`, level 3 (docs/design/rally.md §12.1; docs/api/rally.md): LAZY too — the boot
  // skips it; the MISSION 3 card / the glitch into 3D load it (rally-route.ts `loadRallyContent`).
  rally: () => import('./rally/index'),
  // Mission `sewers`, level 2 (docs/design/sewers.md §1, §9): LAZY — the boot skips it; the MISSION 2
  // card (sewers-route.ts `loadSewersContent`), a direct `?mission=sewers` boot and the art workers
  // load it. One entry per owner folder as the waves add them (`sewers/…`, `bosses/sewers-…`,
  // `music/sewers`, `sfx/sewers`, `samples/sewers`): every id `isSewersContent` accepts is lazy. Its
  // card is not lazy (content/ui/cards.ts `SEWERS_CARD`).
  'missions/sewers': () => import('./missions/sewers/index'),
  'music/sewers': () => import('./music/sewers'),
  'sfx/sewers': () => import('./sfx/sewers'),
  'samples/sewers': () => import('./samples/sewers'),
  'sewers/rats': () => import('./sewers/rats/index'),
  'sewers/street': () => import('./sewers/street/index'),
  'bosses/sewers-gerrit': () => import('./bosses/sewers-gerrit/index'),
  'sewers/items/battery': () => import('./sewers/items/battery'),
  'sewers/set-pieces/grate': () => import('./sewers/set-pieces/grate'),
  'sewers/set-pieces/fatberg': () => import('./sewers/set-pieces/fatberg'),
  'bosses/sewers-rattenjong': () => import('./bosses/sewers-rattenjong/index'),
  // Mission `ams2` (docs/design/ams2.md): level 1 again in the hero method, LAZY and stand-alone:
  // only a direct `?mission=ams2` boot, the art workers and the node tools load it (`isAms2Content`).
  'missions/ams2': () => import('./missions/ams2/index'),
};

/**
 * Manifest ids loaded on demand, not at boot: the first-person mode (`fps`, `fps/…`), the 3D race
 * (`rally`, `rally/…`), mission `sewers` (`isSewersContent`) and mission `ams2`.
 */
export function isLazyContent(id: string): boolean {
  return isFpsContent(id) || isRallyContent(id) || isSewersContent(id) || isAms2Content(id);
}

/** Mission `ams2`'s lazy entry (the boot's direct start, the art workers, the node tools). */
export function isAms2Content(id: string): boolean {
  return id === 'missions/ams2' || id.startsWith('missions/ams2/');
}

/**
 * Mission `sewers`'s lazy entries (sewers-route.ts `loadSewersContent`, the boot's direct start, the
 * art workers): `missions/sewers`, `missions/sewers/…`, `sewers/…`, `bosses/sewers-…`,
 * `music/sewers`, `sfx/sewers…`, `samples/sewers`.
 */
export function isSewersContent(id: string): boolean {
  return (
    id === 'missions/sewers' ||
    id.startsWith('missions/sewers/') ||
    id === 'sewers' ||
    id.startsWith('sewers/') ||
    id.startsWith('bosses/sewers-') ||
    id === 'music/sewers' ||
    id.startsWith('sfx/sewers') ||
    id === 'samples/sewers'
  );
}

/** The first-person mode's lazy entries (FpsIntroScene's `loadFpsContent`). */
export function isFpsContent(id: string): boolean {
  return id === 'fps' || id.startsWith('fps/');
}

/** The 3D race's lazy entries (rally-route.ts `loadRallyContent`). */
export function isRallyContent(id: string): boolean {
  return id === 'rally' || id.startsWith('rally/');
}

export interface ContentReport {
  loaded: string[];
  failed: Array<{ id: string; error: string }>;
}

/**
 * Import every manifest entry accepted by `filter` (default: every entry that is not lazy, see
 * `isLazyContent`; pass `() => true` for everything, `isLazyContent` for the fps mode). Never throws.
 */
export async function loadContent(
  filter: (id: string) => boolean = (id) => !isLazyContent(id),
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

/**
 * Manifest ids that define sprites (used by `npm run sprites`): the art modules, the missions, the
 * bosses, and mission sewers' content folders (`sewers/…`: the cast draws in its own modules).
 */
export const ART_MODULE_IDS: readonly string[] = Object.keys(CONTENT_MODULES).filter(
  (id) => id.endsWith('/art') || id.startsWith('missions/') || id.startsWith('bosses/') || id.startsWith('sewers/'),
);
