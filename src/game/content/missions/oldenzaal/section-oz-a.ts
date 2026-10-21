/**
 * oz-a — the drop over the roofs and the main shopping street (docs/design/oldenzaal.md §2, §10.1:
 * dusk, a low red sun, fog, flickering lamps). ~1:45.
 *
 * Layout (TOWN): the street of shop fronts (terrain.ts `OZ_A_ROW`), awnings / balconies / bay
 * roofs as platforms, low walls as cover, the lamps and the dusk light config; the mission's
 * `introDrop` drops the players over the roofs into the street. INTEGRATE writes the script
 * (the waves of the possessed at `OZ_A_ARENAS` / `OZ_A_SPOTS`, the townspeople, Mevrouw Winkel on
 * the roof `OZ_A_WINKEL_ROOF`, the golden record `OZ_A_RECORD`). Keep `sectionOzA` and 'oz-a'.
 */
import { PAL_HD_OZ } from '../../../../engine/palette-hd';
import type { SectionDef } from '../../../mission/index';
import { defineSectionLight } from '../../oldenzaal/kit/light-api';
import { decorArt, OZ_A_DECOR, OZ_A_LAMP_LIGHTS } from './art-layout';
import { BG_OZ_A } from './backgrounds';
import { OZ_AMBIENCE, OZ_SECTION, OZ_SONG } from './ids';
import { OZ_STREET_ART, OZ_WUGHOST_ART } from './script-kit';
import { scriptOzA } from './script-oz-a';
import { G, OZ_A_CHECKPOINTS, OZ_A_EXIT, OZ_A_W, terrainOzA } from './terrain';

/**
 * The town's materials (TOWN; terrain-art.ts + art-terrain.ts): red-brown herringbone brick
 * pavers, the iron rails of awnings / balconies / bays, low brick walls. Wave B's placeholder
 * sections share it until they get their own.
 */
export const OZ_STREET_STYLE = { ground: 'oz-pavers', platform: 'oz-ledge', solid: 'oz-brick', seed: 1 } as const;

/** Dusk: a red-violet dark, ground fog, the street lamps (`lamps`: art-layout.ts). */
export const OZ_A_LIGHT = defineSectionLight(OZ_SECTION.a, {
  darkness: 0.4,
  tint: PAL_HD_OZ.dusk[1],
  lamps: OZ_A_LAMP_LIGHTS,
  fog: { density: 0.75, color: PAL_HD_OZ.night[5], top: 146, drift: -0.1 },
  heroLight: 24,
});

export const sectionOzA: SectionDef = {
  id: OZ_SECTION.a,
  name: 'The shopping street (dusk)',
  width: OZ_A_W,
  height: 216,
  scroll: 'right',
  background: BG_OZ_A,
  terrain: terrainOzA(),
  terrainStyle: OZ_STREET_STYLE,
  decor: [...OZ_A_DECOR],
  // Tier 4: the town decor this section draws, the possessed of the street, Mevrouw Winkel on the
  // roof, the meal's HUD / fx (the snack power carries on from oz-b only, but the icons are tiny).
  art: [...decorArt(OZ_A_DECOR), ...OZ_STREET_ART, ...OZ_WUGHOST_ART, 'item/pickup-gem/golden-record'],
  playerStart: { x: 48, y: G },
  checkpoints: [...OZ_A_CHECKPOINTS],
  exits: [{ id: 'oz-a-end', rect: { ...OZ_A_EXIT }, to: OZ_SECTION.b }],
  music: OZ_SONG.theme,
  ambience: OZ_AMBIENCE.street,
  // The drop, the street, three locks, the exit to the corner (INTEGRATE: script-oz-a.ts).
  script: scriptOzA,
};
