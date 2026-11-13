/**
 * Mission `sewers` — level 2, MISSION 2 "RATTENJONG MET DE RATTENITEMS" (docs/design/sewers.md). The
 * squad, still on shore leave after `ams`, clears De Wallen of crooks by night, drops into the sewer
 * under it, fights the giant rats and their king, DE RATTENJONG, and climbs out at dawn; the squad's white wagon
 * takes them to the A10, where the 3D race (`rally`, level 3) begins. Six sections: sewers-a DE
 * WALLEN (GOUDEN GERRIT), sewers-b DE STEEGJES (the rat eruption), sewers-c DE PUT (the fall,
 * FLASHLIGHTS ON), sewers-d HET RIOOL (the fatberg), sewers-e DE AFVALHAL (DE RATTENJONG), sewers-end
 * DAGERAAD (script only).
 *
 * A normal `defineMission` 2D mission on the unchanged MissionRunner, LAZY (spec L2): the boot never
 * loads it (content/index.ts `isSewersContent`); the MISSION 2 card loads the chunk while it shows
 * (mission-intro.ts, sewers-route.ts `loadSewersContent`), a direct `?mission=sewers` boot loads it
 * first, the art workers load it on demand (art-worker.ts `isSewersSpriteId`). Its card is NOT in
 * this chunk (content/ui/cards.ts lists `SEWERS_CARD`). `ams.next = 'sewers'`, `sewers.next =
 * 'rally'`; flow.ts's route guard keeps m5 from naming `sewers` (`listMissions` sorts ids).
 *
 * Owner: P0 (this file, the ids, the grey stubs); the section builders add their section `art`,
 * preload prefixes and side-effect imports.
 */
import type { MissionDef } from '../../../mission/index';
import { defineMission } from '../../../registry';
import './light';
import { SEWERS_AUDIO_GROUP, SEWERS_ID, SEWERS_NAME, SEWERS_SECTION, SEWERS_SONG } from './ids';
import { sectionA } from './section-a';
import { sectionB } from './section-b';
import { sectionC } from './section-c';
import { sectionD } from './section-d';
import { sectionE } from './section-e';
import { sectionEnd } from './section-end';

export const SEWERS: MissionDef = {
  id: SEWERS_ID,
  name: SEWERS_NAME,
  subtitle: 'MISSION 2',
  music: SEWERS_SONG.street,
  bossMusic: SEWERS_SONG.boss,
  start: SEWERS_SECTION.a,
  // `?boss=1` starts in DE RATTENJONG's arena (with `section=sewers-a`: GOUDEN GERRIT's, its bossStart).
  bossSection: SEWERS_SECTION.e,
  // Both fights count for the BOSS SPEED BONUS (spec §1).
  bossSections: [SEWERS_SECTION.a, SEWERS_SECTION.e],
  // After the tally (the newspaper with euros): the MISSION 3 card BINNEN DE RING and the glitch into 3D.
  next: 'rally',
  announce: 'MISSIE TWEE. HOU JE NEUS DICHT!',
  sections: {
    [SEWERS_SECTION.a]: sectionA,
    [SEWERS_SECTION.b]: sectionB,
    [SEWERS_SECTION.c]: sectionC,
    [SEWERS_SECTION.d]: sectionD,
    [SEWERS_SECTION.e]: sectionE,
    [SEWERS_SECTION.end]: sectionEnd,
  },
  // Spec §1: the tourists of a and b, a sewer worker each in c and d (STANDING OVATION counts them).
  hostages: { [SEWERS_SECTION.a]: 2, [SEWERS_SECTION.b]: 1, [SEWERS_SECTION.c]: 1, [SEWERS_SECTION.d]: 1 },
  artDensity: 4,
  footsteps: true,
  // The mission start drops the players in on a parachute, as every mission's fresh start (ams, oldenzaal).
  introDrop: true,
  // The 2× / 4× preload order (tier 4: the working set of every section): the drop and the common
  // effects first; each section lists its own decor and cast as section `art` (the builders add theirs).
  preloadFirst: ['fx/chute', 'fx/muzzle', 'fx/hit', 'fx/impact', 'fx/dust', 'fx/poof', 'fx/explosion-s', 'fx/explosion-m', 'weapon/', 'ui/icon-', 'ui/onward', 'item/pickup-', 'item/crate'],
  preloadLast: [],
  // What a direct `?mission=sewers` boot preloads at 1× (the returning ams locals included).
  art: ['item/', 'weapon/', 'fx/', 'ui/', 'enemy/delivery-rider', 'enemy/fatbike-youth', 'decor/sewers-grate', 'enemy/sewers-dealer', 'enemy/sewers-pimp', 'enemy/sewers-bodyguard', 'boss/sewers-gerrit', 'decor/sewers-a'],
  audioGroup: SEWERS_AUDIO_GROUP,
  // The game-wide budget (docs/design/budget.md §7.1): euros, the newspaper tally.
  economy: 'euro',
};

defineMission(SEWERS);
