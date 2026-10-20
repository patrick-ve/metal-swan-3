/**
 * The ring's art definition for the tier-4 working set (docs/design/ring.md §11, §13 "Tier 4";
 * docs/api/ring.md §10). `ringArtDef(plan, drivers)` returns a `MissionArtDef` for
 * `preloadMissionArt` / `missionArtSection` (scenes/gameplay.ts):
 *
 * - SECTIONS are the plan's stretches (landmark ids, in order): each holds its landmark's decor
 *   (`decor/ring/<id>/`) and every family the plan uses in it (`ringEntityArt`); the
 *   runner's `stretch` event is the section change (`missionArtSection(id)`).
 * - Always resident (`preloadFirst`): the wagon, civilians, scooters, ring items and fx, the
 *   shared items / fx / weapons / HUD icons.
 * - The bosses last (`preloadLast`, only in their stretch: `bossSection`). Ring boss art lives
 *   under `boss/ring-<name>/` so the working set keeps it out of the other stretches
 *   (gameplay.ts filters `boss/` prefixes outside the boss section).
 * - `extraChar`: the drivers' `char/<id>/ride-*` and `mount` strips pass the hero filter (the
 *   drivers are heroes nobody plays; spec §16: only those strips).
 * - `denseReserve`: the streamed scenery's 4× reserve (`RING_SCENERY_RESERVE`, view.ts); the
 *   tier-4 run keeps the sprites inside the budget minus it.
 * Builders register the art of their entity ids with `defineRingArt(id, prefixes)`.
 */
import type { SectionDef } from '../mission/types';
import type { MissionArtDef } from '../scenes/gameplay';
import { landmarkDecor, RING_ART, RING_ENTITY, RING_ENTITY_B, RING_ID } from './ids';
import type { RingPlan } from './types';
import { RING_SCENERY_RESERVE } from './view';

/** Art always resident on the ring (spec §13: the wagon, civilians, scooters, fx/ring/, items). */
export const RING_PRELOAD_FIRST: readonly string[] = [
  RING_ART.wagon,
  RING_ART.car,
  RING_ART.scooter,
  RING_ART.item,
  RING_ART.fx,
  // The road furniture on every stretch: the median lamp posts and the oncoming cars (view.ts).
  'decor/ring/road/',
  'item/pickup-',
  'item/crate',
  'item/bind',
  'item/hostage/tourist/',
  'fx/explosion-s',
  'fx/explosion-m',
  'fx/muzzle',
  'fx/hit',
  'fx/impact',
  'fx/dust',
  'fx/debris-',
  'fx/poof',
  'fx/shadow',
  'weapon/',
  'ui/icon-',
];

/** Sprite prefixes per entity id (the families a stretch needs). Always-resident ids map to []. */
const ENTITY_ART = new Map<string, readonly string[]>([
  [RING_ENTITY.wagon, []],
  [RING_ENTITY.car, []],
  [RING_ENTITY.scooter, []],
  [RING_ENTITY.crate, []],
  [RING_ENTITY.hostage, []],
  [RING_ENTITY.gantry, [RING_ART.hazard]],
  [RING_ENTITY.closure, [RING_ART.hazard]],
  [RING_ENTITY.speedcam, [RING_ART.hazard]],
  [RING_ENTITY.avgzone, [RING_ART.hazard]],
  [RING_ENTITY.jam, [RING_ART.hazard]],
  [RING_ENTITY_B.parcelVan, ['ring/parcel-van/']],
  [RING_ENTITY_B.caravan, ['ring/caravan/']],
  [RING_ENTITY_B.scanCar, ['ring/scan-car/']],
  [RING_ENTITY_B.towTruck, ['ring/tow-truck/']],
  [RING_ENTITY_B.handhaverMoto, ['ring/handhaver-moto/']],
  [RING_ENTITY_B.roadworks, ['ring/roadworks/']],
  [RING_ENTITY_B.lorry, ['boss/ring-lorry/']],
]);

/** Register (or replace) the sprite prefixes of a ring entity id. */
export function defineRingArt(id: string, prefixes: readonly string[]): void {
  ENTITY_ART.set(id, [...prefixes]);
}

/** The sprite prefixes of a ring entity id ([] = always resident or unknown). */
export function ringEntityArt(id: string): readonly string[] {
  return ENTITY_ART.get(id) ?? [];
}

/** The ring's art definition plus the additive `extraChar` field (gameplay.ts `MissionArtDef`). */
export type RingArtDef = MissionArtDef & { readonly extraChar: readonly string[]; readonly denseReserve: number };

/** The drivers' strips that join the working set (`char/<id>/ride-*`, `char/<id>/mount`). */
export function driverArt(drivers: readonly (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const d of drivers) if (d) out.push(`char/${d}/ride-`, `char/${d}/mount`);
  return [...new Set(out)];
}

/** The MissionArtDef of a plan (sections = stretches); `drivers` = the drivers' hero ids. */
export function ringArtDef(plan: RingPlan, drivers: readonly (string | null | undefined)[] = []): RingArtDef {
  const sections: Record<string, Pick<SectionDef, 'art'>> = {};
  for (const st of plan.stretches) {
    // Every family the stretch uses (a family on many stretches stays in the set on each of them).
    const art: string[] = [landmarkDecor(st.id)];
    const seen = new Set<string>(art);
    for (const s of plan.spawns) {
      if (s.at < st.start || s.at >= st.end) continue;
      for (const p of ringEntityArt(s.id)) {
        if (seen.has(p) || p.startsWith('boss/')) continue;
        seen.add(p);
        art.push(p);
      }
    }
    sections[st.id] = { art };
  }
  const last: string[] = [];
  let bossSection: string | undefined;
  for (const b of plan.bosses) {
    const prefixes = ringEntityArt(b.id);
    if (prefixes.length === 0) continue;
    last.push(...prefixes);
    if (!bossSection) bossSection = plan.stretches.find((s) => b.at >= s.start && b.at < s.end)?.id ?? b.landmark;
  }
  return {
    id: RING_ID,
    artDensity: 4,
    start: plan.stretches[0]?.id,
    // Only `art` is read from a section by the tier-4 code (sectionArt, nextSections, artLate).
    sections: sections as unknown as Record<string, SectionDef>,
    bossSection,
    preloadFirst: RING_PRELOAD_FIRST,
    preloadLast: [...new Set(last)],
    extraChar: driverArt(drivers),
    // The streamed 4× scenery (view.ts) has its own reserve inside the same 256 MB.
    denseReserve: RING_SCENERY_RESERVE,
  };
}
