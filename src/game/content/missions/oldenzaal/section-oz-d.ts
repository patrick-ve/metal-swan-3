/**
 * oz-d — the nave of the basilica (docs/design/oldenzaal.md §2, §7.1, REVISION 2: candle light,
 * lightning in the windows): the spooky Catholic church, abandoned for weeks. Owner: CHURCH.
 *
 * West → east: the red doors and the organ loft, sandstone pillars with the Stations of the
 * Cross, saints and the pulpit, pews (one-way platforms), a confessional, the side chapel of the
 * dead behind its grille, Mary with the votive candles, the choir (the altar, the crucifix, the
 * candlesticks, the red sanctuary lamp) and the stair down to the crypt (→ oz-e). The far side of
 * the nave (the arcade, the aisle windows, the clerestory, the rib vault) is the background.
 * Layout: content/oldenzaal/church/layout.ts; art: church/art*.ts; script: script-oz-d.ts.
 *
 * RESPECT: nothing mocked, broken or burned on purpose; the altar, the crucifix, the statues and
 * the images are decor (never hit); no zombie wears a church vestment.
 */
import { PAL } from '../../../../engine/palette';
import { PAL_HD_OZ } from '../../../../engine/palette-hd';
import type { BackgroundDef, SectionDef } from '../../../mission/index';
import { decorIds, NAVE_DECOR, NAVE_LAMPS } from '../../oldenzaal/church/decor';
import { G, NAVE_CHECKPOINTS, NAVE_STYLE, NAVE_W, terrainNave } from '../../oldenzaal/church/layout';
import { defineSectionLight } from '../../oldenzaal/kit/light-api';
import { OZ_AMBIENCE, OZ_SECTION, OZ_SONG, OZ_SPRITES } from './ids';
import { scriptOzD } from './script-oz-d';

/** Dark inside: candle pools, the red sanctuary lamp, cold moonlight, lightning in the windows. */
export const OZ_D_LIGHT = defineSectionLight(OZ_SECTION.d, {
  darkness: 0.6,
  tint: PAL_HD_OZ.night[0],
  lamps: NAVE_LAMPS,
  lightning: { every: [420, 900], strength: 0.8, double: 0.3 },
  heroLight: 32,
});

/** The far side of the nave (church/art-nave-arch.ts `oz-nave-far`; 4 bays, tiles). */
export const BG_NAVE: BackgroundDef = {
  sky: PAL.ink[0],
  layers: [{ gen: 'oz-nave-far', params: { air: 0.34 }, width: 512, factorX: 0.5 }],
};

export const sectionOzD: SectionDef = {
  id: OZ_SECTION.d,
  name: 'The nave',
  width: NAVE_W,
  height: 216,
  scroll: 'right',
  background: BG_NAVE,
  terrain: terrainNave(),
  terrainStyle: NAVE_STYLE,
  decor: [...NAVE_DECOR],
  // Tier 4: the nave's decor, the openings, the dead soldiers.
  art: [...decorIds(NAVE_DECOR), 'decor/oz-nave/doors', 'decor/oz-nave/grille', 'prop/oz-slab/', ...OZ_SPRITES.zombies],
  playerStart: { x: 48, y: G },
  checkpoints: [...NAVE_CHECKPOINTS],
  music: OZ_SONG.theme,
  ambience: OZ_AMBIENCE.nave,
  script: scriptOzD,
};
