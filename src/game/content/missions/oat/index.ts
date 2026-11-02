/**
 * Mission `oat` — level 2, MISSION 2 "OAT OF CONTROL" (docs/design/oat.md; the API of the waves:
 * docs/api/oat.md). The squad, still on shore leave after `ams`, spends a tourist day in the old
 * centre of Amsterdam, from a morning in the 9 Straatjes to 03:00 in De Wallen; a taxi races them
 * out to the A10, where the 3D race (`rally`, level 3) begins. Six sections: oat-a DE 9 STRAATJES
 * (De Makelaar), oat-b FORT NEGEN & ZESTIG (DE RIJ), oat-c DE KADEMUUR, oat-c1 the chase on the
 * Swan, oat-d DE WALLEN BY NIGHT (De Huisjesmelker), oat-e DE TAXIRIT.
 *
 * A normal `defineMission` 2D mission on the unchanged MissionRunner, LAZY (spec decision 49): the
 * boot never loads it (content/index.ts `isOatContent`); the MISSION 2 card loads the chunk while it
 * shows (mission-intro.ts, oat-route.ts `loadOatContent`), a direct `?mission=oat` boot loads it
 * first, the art workers load it on demand (art-worker.ts). Its card is NOT in this chunk
 * (content/ui/cards.ts lists `OAT_CARD`). `ams.next = 'oat'`, `oat.next = 'rally'`; flow.ts's route
 * guard keeps m5 from naming `oat` (the m5 trap).
 *
 * Owner: CORE (wave A: this file, the ids, the stubs, the contracts); the builders add their
 * section `art`, preload prefixes and side-effect imports through INTEGRATE.
 */
import { bgDensityFor } from '../../../art/art-registry';
import type { MissionDef, SectionDef } from '../../../mission/index';
import { STRIP_BUDGET_BYTES, STRIP_DARK_BUDGET_BYTES } from '../../../mission/strips/types';
import { defineMission } from '../../../registry';
// The scenery kit (spec §11): one index per owner folder (contracts + stubs in wave A).
import './facade/index';
import './floor/index';
import './light/index';
import './art/index';
import { OAT_AUDIO_GROUP, OAT_ID, OAT_SECTION, OAT_SONG, OAT_SPRITE_PREFIXES } from './ids';
import { sectionA } from './section-a';
import { sectionB } from './section-b';
import { sectionC } from './section-c';
import { sectionC1 } from './section-c1';
import { sectionD } from './section-d';
import { sectionE } from './section-e';

/** The mission's name on its card and banner (spec §0 #1). */
export const OAT_NAME = 'OAT OF CONTROL';

/**
 * The 4× scenery reserve (spec §8.12, decision 50): façade strips 18 MB + background layers 50 MB +
 * the 03:00 dark set 11 MB + terrain chunks and margin 5 MB = 84 MB inside the 256 MB tier-4 cap.
 */
export const OAT_SCENERY_RESERVE = 84 * 1024 * 1024;

/** The terrain chunks and margin of the reserve (spec §8.12; with a floor the chunks hold only platforms). */
export const OAT_TERRAIN_MARGIN = 5 * 1024 * 1024;

/**
 * Bytes the 4× scenery of a section takes besides the sprites (the `denseReserve` it must fit; spec
 * §8.12): every background layer with a 4× generator (width × height × 16 px × 4 bytes), the strip
 * store's lit cap (STRIP_BUDGET_BYTES: about 5 resident chunks) and, with a 03:00 dark set, its cap
 * (STRIP_DARK_BUDGET_BYTES), plus the terrain margin. tests/content/oat-dense-budget.test.ts.
 */
export function oatSceneryBytes(sec: Pick<SectionDef, 'background' | 'strips'>): number {
  let b = 0;
  for (const l of sec.background?.layers ?? []) if (bgDensityFor(l.gen, 4) === 4) b += (l.width ?? 512) * (l.height ?? 216) * 64;
  if (sec.strips) b += STRIP_BUDGET_BYTES + (sec.strips.dark ? STRIP_DARK_BUDGET_BYTES : 0);
  return b + OAT_TERRAIN_MARGIN;
}

export const OAT: MissionDef = {
  id: OAT_ID,
  name: OAT_NAME,
  subtitle: 'MISSION 2',
  music: OAT_SONG.a,
  bossMusic: OAT_SONG.boss,
  start: OAT_SECTION.a,
  // `?boss=1` starts in De Huisjesmelker's arena (with `section=oat-a`: De Makelaar's, its bossStart).
  bossSection: OAT_SECTION.d,
  // Both fights count for the BOSS SPEED BONUS (spec decision 42).
  bossSections: [OAT_SECTION.a, OAT_SECTION.d],
  // After the kassabon: the MISSION 3 card BINNEN DE RING and the glitch into 3D (spec §1).
  next: 'rally',
  announce: 'MISSIE TWEE. HOU JE PORTEMONNEE VAST!',
  sections: {
    [OAT_SECTION.a]: sectionA,
    [OAT_SECTION.b]: sectionB,
    [OAT_SECTION.c]: sectionC,
    [OAT_SECTION.c1]: sectionC1,
    [OAT_SECTION.d]: sectionD,
    [OAT_SECTION.e]: sectionE,
  },
  // No hostages (spec decision 59; as oldenzaal): the tally hides the hostage lines.
  hostages: {},
  artDensity: 4,
  footsteps: true,
  // The game-wide budget (spec §7.1) and oat's own tally, the kassabon (spec §7.6): BUDGET reads both.
  economy: 'euro',
  tally: 'receipt',
  // The 2× / 4× preload order (tier 4: the working set of every section): the common effects first;
  // each section lists its own decor and cast as section `art` (the builders add theirs).
  preloadFirst: ['fx/muzzle', 'fx/hit', 'fx/impact', 'fx/dust', 'fx/poof', 'fx/explosion-s', 'fx/explosion-m', 'weapon/', 'ui/icon-', 'ui/onward', 'item/pickup-', 'item/crate'],
  preloadLast: [],
  denseReserve: OAT_SCENERY_RESERVE,
  // What a direct `?mission=oat` boot preloads at 1× (the reused ams locals and the Swan included).
  art: ['item/', 'weapon/', 'fx/', 'ui/', 'enemy/handhaver', 'enemy/delivery-rider', 'enemy/fatbike-youth', 'vehicle/swan', ...OAT_SPRITE_PREFIXES],
  audioGroup: OAT_AUDIO_GROUP,
};

defineMission(OAT);
