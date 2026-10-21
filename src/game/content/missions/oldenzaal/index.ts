/**
 * Mission `oldenzaal` — level 4, MISSION 4 "A HAUNTING IN OTOWN" (docs/design/oldenzaal.md; the
 * API of the waves: docs/api/oldenzaal.md). The squad drops into Oldenzaal at dusk. Revision 2
 * (six sections): the abandoned shopping street (oz-a), De Smulhoek and Meneer Wu (oz-b),
 * Plechelmusplein: Mevrouw Winkel wakes the statue, the mini-boss St. Plechelmus (oz-c), the nave
 * (oz-d), the crypt (oz-e), the tower and the jet Swan (oz-f). The enemies are the dead soldiers of
 * the old war (content/oldenzaal/zombies/).
 *
 * A normal `defineMission` 2D mission on the unchanged MissionRunner. On the normal route it is
 * reached only from the first-person floors (fps-route.ts → the story card → its intro card);
 * after its tally comes the TO BE CONTINUED card and today's ending (flow.ts `missionDone`).
 * `listMissions` sorts ids, so it comes after m5: flow.ts never sends m5 here (the m5 trap).
 *
 * Owner: CORE (wave A) → PREP (wave B: this file, the ids, the lines, the section stubs); every
 * builder adds its own section `art`, preload prefixes and imports through INTEGRATE.
 */
import type { MissionDef } from '../../../mission/index';
import { defineMission } from '../../../registry';
import { OZ_SCENERY_RESERVE } from './art-layout';
import { OLDENZAAL_ID, OZ_ART_PREFIXES, OZ_AUDIO_GROUP, OZ_SECTION, OZ_SONG } from './ids';
import { OZ_WUGHOST_ART, OZ_ZOMBIE_ART } from './script-kit';
import { sectionOzA } from './section-oz-a';
import { sectionOzB } from './section-oz-b';
import { sectionOzC } from './section-oz-c';
import { sectionOzD } from './section-oz-d';
import { sectionOzE } from './section-oz-e';
import { sectionOzF } from './section-oz-f';

/** The mission's name on its card and banner (the user's title, spec §0 #22). */
export const OZ_NAME = 'A HAUNTING IN OTOWN';

export const OLDENZAAL: MissionDef = {
  id: OLDENZAAL_ID,
  name: OZ_NAME,
  subtitle: 'MISSION 4',
  music: OZ_SONG.theme,
  bossMusic: OZ_SONG.boss,
  start: OZ_SECTION.a,
  bossSection: OZ_SECTION.c,
  announce: 'MISSIE VIER. BLIJF BIJ ELKAAR, ZWAANTJES!',
  sections: {
    [OZ_SECTION.a]: sectionOzA,
    [OZ_SECTION.b]: sectionOzB,
    [OZ_SECTION.c]: sectionOzC,
    [OZ_SECTION.d]: sectionOzD,
    [OZ_SECTION.e]: sectionOzE,
    [OZ_SECTION.f]: sectionOzF,
  },
  // No hostages (spec §13: 0 unless the builders add some; the town is abandoned).
  hostages: {},
  artDensity: 4,
  footsteps: true,
  introDrop: true,
  // The 2× / 4× preload order (tier 4: the working set of every section, gameplay.ts): the drop
  // and the common effects first, then the dead soldiers (every section has them), Meneer Wu, the
  // meal and the light glows. The decor of each place (`decor/oz/`, `decor/oz-nave/`, …) is
  // section `art` (each section lists what it draws), never preloadFirst.
  preloadFirst: [
    'fx/chute',
    'fx/muzzle',
    'fx/hit',
    'fx/impact',
    'fx/dust',
    'fx/poof',
    'fx/explosion-s',
    'fx/explosion-m',
    'weapon/',
    'ui/icon-',
    'ui/onward',
    'item/pickup-',
    'item/crate',
    ...OZ_ZOMBIE_ART,
    ...OZ_WUGHOST_ART,
  ],
  preloadLast: [],
  // The town's 4× scenery (background layers + resident terrain chunks) besides the sprites: the
  // tier-4 run keeps its sprites inside DENSE_BUDGET_BYTES minus this (art-layout.ts).
  denseReserve: OZ_SCENERY_RESERVE,
  // What a direct `?mission=oldenzaal` boot preloads at 1×.
  art: ['item/', 'weapon/', 'fx/', 'ui/', ...OZ_ART_PREFIXES],
  // Sampled music, sfx and voices (ElevenLabs, wave B); until then the synth plays everything.
  audioGroup: OZ_AUDIO_GROUP,
};

defineMission(OLDENZAAL);
