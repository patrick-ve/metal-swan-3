/**
 * oz-a — the drop over the roofs and the main shopping street (docs/design/oldenzaal.md §2, §10.1:
 * dusk, a low red sun, fog, flickering lamps). ~1:45.
 *
 * Layout (TOWN): the street of shop fronts (terrain.ts `OZ_A_ROW`), awnings / balconies / bay
 * roofs as platforms, low walls as cover, the lamps and the dusk light config; the mission's
 * `introDrop` drops the players over the roofs into the street. INTEGRATE writes the script
 * (revision 2: the dead soldiers out of RUIN's openings `OZ_A_OPENINGS`, rise spots `OZ_A_RISE`, a
 * column from the fog; the arenas `OZ_A_ARENAS`, the golden record `OZ_A_RECORD`). Keep
 * `sectionOzA` and 'oz-a'.
 */
import { PAL_HD_OZ } from '../../../../engine/palette-hd';
import type { SectionDef } from '../../../mission/index';
import { defineSectionLight } from '../../oldenzaal/kit/light-api';
import { decorArt, OZ_A_DECOR, OZ_A_LAMP_LIGHTS } from './art-layout';
import { BG_OZ_A } from './backgrounds';
import { OZ_AMBIENCE, OZ_SECTION, OZ_SONG } from './ids';
import { OZ_WUGHOST_ART, OZ_ZOMBIE_ART } from './script-kit';
import { OZ_RUIN_ART, withRuin } from '../../oldenzaal/ruin/index';
import { scriptOzA } from './script-oz-a';
import { G, OZ_A_CHECKPOINTS, OZ_A_EXIT, OZ_A_OPENINGS, OZ_A_W, terrainOzA } from './terrain';

/**
 * The town's materials (TOWN; terrain-art.ts + art-terrain.ts): red-brown herringbone brick
 * pavers, the iron rails of awnings / balconies / bays, low brick walls. Wave B's placeholder
 * sections share it until they get their own.
 */
export const OZ_STREET_STYLE = { ground: 'oz-pavers', platform: 'oz-ledge', solid: 'oz-brick', seed: 1 } as const;

/** Dusk: a red-violet dark, ground fog, the street lamps (`lamps`: art-layout.ts). */
export const OZ_A_LIGHT = defineSectionLight(OZ_SECTION.a, {
  darkness: 0.48,
  tint: PAL_HD_OZ.dusk[1],
  lamps: OZ_A_LAMP_LIGHTS,
  fog: { density: 0.95, color: PAL_HD_OZ.night[6], top: 142, drift: -0.1 },
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
  // Tier 4: the town decor this section draws, the openings, the dead soldiers, the meal's HUD / fx
  // and the light glows (the snack power carries on from oz-b only, but the icons are tiny).
  art: [...decorArt(OZ_A_DECOR), ...OZ_RUIN_ART, ...OZ_ZOMBIE_ART, ...OZ_WUGHOST_ART, 'item/pickup-gem/golden-record', 'item/crate'],
  playerStart: { x: 48, y: G },
  checkpoints: [...OZ_A_CHECKPOINTS],
  exits: [{ id: 'oz-a-end', rect: { ...OZ_A_EXIT }, to: OZ_SECTION.b }],
  music: OZ_SONG.theme,
  ambience: OZ_AMBIENCE.street,
  // The drop, the abandoned street, three locks, the exit to the corner (INTEGRATE: script-oz-a.ts).
  // RUIN places the openings (boarded doors / windows, manholes: terrain.ts `OZ_A_OPENINGS`) first.
  script: withRuin(OZ_A_OPENINGS, scriptOzA),
};
