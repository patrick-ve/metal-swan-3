/**
 * The ring's ON-FOOT part (docs/design/ring.md §R.4–§R.7, R-17; docs/api/ring.md "Revision R"):
 * an UNREGISTERED `MissionDef` with the id `ring` (NEVER `defineMission`: the sorted id list would
 * make it some mission's default next one; `M2`, the high scores, `recordMissionClear` and the
 * golden record keep the id `ring`). The drive hands over to it without a tally
 * (`RingRunner.handOver` → ring-route.ts `ringHandover` → a `GameplayScene` with
 * `GameplayOpts.handover`); its `missionComplete` ends the level with ONE tally.
 *
 * - sections `rf-a` DE FILE (JAM+FOOT) and `rf-b` DE BLOKKADE (wave B); start `rf-a`;
 * - `bossSections: ['zuid']`: the BOSS SPEED BONUS keeps the drive's train timing (the boat's
 *   fight in rf-b never overwrites it);
 * - `hostages`: the drive's stretches (the plan) + the foot sections (STANDING OVATION counts both);
 * - `footsteps`, `audioGroup: 'mission:ring'`, `artDensity: 4`.
 *
 * `ringFootDef(plan)` builds the def of a play (the drive's hostages); `RING_FOOT_HOSTAGES` are the
 * foot sections' own.
 */
import type { MissionDef } from '../../../mission/index';
import { RING_HOOKS } from '../../../ring/hooks';
import { RING_ID } from '../../../ring/ids';
import type { RingPlan } from '../../../ring/types';
import { RF_SCENERY_RESERVE, RF_SECTION } from './ids';
import { sectionRfA } from './section-rf-a';
import { sectionRfB } from './section-rf-b';
// JAM+FOOT (revision R, additive): the ring gangs on foot, the jam's art and scene (rf-a).
import './gangs/index';
import './art-jam';
import { rfPlanDrivers } from './props';

export * from './ids';
export { sectionRfA, RF_A_W, RF_A_ART, RF_BACKGROUND } from './section-rf-a';
export { sectionRfB, RF_B_W, RF_B_ART } from './section-rf-b';
// JAM+FOOT (revision R, additive): the jam scene, the layout, the gangs on foot.
export { footDrivers, RF_SCENE, RfJamScene, rfPlanDrivers, spawnJamScene } from './props';
export * from './layout-rf-a';
export { scriptRfA, RF_A_FOES } from './script-rf-a';
export * from './gangs/index';

/** Hostages placed in the foot sections (their owners update it with their scripts). */
export const RING_FOOT_HOSTAGES: Readonly<Record<string, number>> = { [RF_SECTION.a]: 1, [RF_SECTION.b]: 0 };

/** The ring's audio group (ring-route.ts `RING_AUDIO_GROUP`; repeated here: no scene import). */
const RING_AUDIO = 'mission:ring';

/** The foot part's def for a play: the drive's hostages (per stretch) + the foot sections'. */
export function ringFootDef(plan: Pick<RingPlan, 'hostages'> & Partial<Pick<RingPlan, 'drivers'>> | null = null): MissionDef {
  const def: MissionDef = {
    id: RING_ID,
    name: 'DE RING',
    subtitle: 'A10',
    // The synth stage song until wave B's `ring-foot` / `ring-boot` songs.
    music: 'ring',
    bossMusic: 'ring-boss',
    start: RF_SECTION.a,
    sections: { [RF_SECTION.a]: sectionRfA, [RF_SECTION.b]: sectionRfB },
    bossSections: ['zuid'],
    hostages: { ...(plan?.hostages ?? {}), ...RING_FOOT_HOSTAGES },
    artDensity: 4,
    footsteps: true,
    audioGroup: RING_AUDIO,
    preloadFirst: ['fx/muzzle', 'fx/hit', 'fx/impact', 'fx/dust', 'fx/poof', 'fx/explosion-s', 'fx/explosion-m', 'weapon/', 'ui/icon-', 'item/pickup-', 'item/crate'],
    preloadLast: [],
    denseReserve: RF_SCENERY_RESERVE,
    clearLine: 'Objective secured!',
  };
  // JAM+FOOT (additive): the parked wagons of rf-a show the drive's drivers (props.ts).
  if (plan?.drivers) rfPlanDrivers.set(def, plan.drivers);
  return def;
}

// The scenes reach the def through the hook (ring/hooks.ts `ringFootDefOf`): no static import of
// this content from the scene modules.
RING_HOOKS.footDef = ringFootDef;

/** The foot def without a plan (tools, tests: only the foot sections' hostages). */
export const RING_FOOT: MissionDef = ringFootDef(null);
