/**
 * oz-b — the street corner with De Smulhoek, the basilica's tower above the roofs
 * (docs/design/oldenzaal.md §2, §4: late dusk; Meneer Wu's scene, the meal, a short fight on the
 * way to the square). ~1:00.
 *
 * Layout (TOWN): the street, De Smulhoek at `OZ_B_SMULHOEK_X` (Meneer Wu's door `OZ_B_DOOR_X`,
 * the scene's lock `OZ_B_WU_ARENA`), the late-dusk light with the warm windows; WUGHOST supplies
 * Meneer Wu's scene (`oz-wu`, the meal) and INTEGRATE writes the script. Keep `sectionOzB`, 'oz-b'.
 */
import { PAL_HD_OZ } from '../../../../engine/palette-hd';
import type { SectionDef } from '../../../mission/index';
import { defineSectionLight } from '../../oldenzaal/kit/light-api';
import { decorArt, OZ_B_DECOR, OZ_B_LAMP_LIGHTS } from './art-layout';
import { BG_OZ_B } from './backgrounds';
import { OZ_AMBIENCE, OZ_SECTION, OZ_SONG } from './ids';
import { OZ_STREET_ART, OZ_WUGHOST_ART } from './script-kit';
import { scriptOzB } from './script-oz-b';
import { OZ_STREET_STYLE } from './section-oz-a';
import { G, OZ_B_CHECKPOINTS, OZ_B_EXIT, OZ_B_W, terrainOzB } from './terrain';

/** Late dusk: darker, thicker fog; De Smulhoek's windows are the warm light (`lamps`: art-layout.ts). */
export const OZ_B_LIGHT = defineSectionLight(OZ_SECTION.b, {
  darkness: 0.48,
  tint: PAL_HD_OZ.night[1],
  lamps: OZ_B_LAMP_LIGHTS,
  fog: { density: 0.8, color: PAL_HD_OZ.night[5], top: 146, drift: -0.12 },
  heroLight: 24,
});

export const sectionOzB: SectionDef = {
  id: OZ_SECTION.b,
  name: 'De Smulhoek (late dusk)',
  width: OZ_B_W,
  height: 216,
  scroll: 'right',
  background: BG_OZ_B,
  terrain: terrainOzB(),
  terrainStyle: { ...OZ_STREET_STYLE, seed: 2 },
  decor: [...OZ_B_DECOR],
  // Tier 4: the corner's decor, the possessed of the street, Meneer Wu, the meal, the blast.
  art: [...decorArt(OZ_B_DECOR), ...OZ_STREET_ART, ...OZ_WUGHOST_ART],
  playerStart: { x: 48, y: G },
  checkpoints: [...OZ_B_CHECKPOINTS],
  exits: [{ id: 'oz-b-end', rect: { ...OZ_B_EXIT }, to: OZ_SECTION.c }],
  music: OZ_SONG.theme,
  ambience: OZ_AMBIENCE.street,
  // The approach, the corner and MENEER WU's scene, the way to the square (INTEGRATE: script-oz-b.ts).
  script: scriptOzB,
};
