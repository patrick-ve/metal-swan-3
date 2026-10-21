/**
 * oz-e — the crypt under the choir (docs/design/oldenzaal.md §2, §7.2, REVISION 2: almost dark;
 * votive candles and a lantern glow). Owner: CHURCH.
 *
 * West → east: the stair down from the choir, squat columns under low round groin vaults, tombs
 * whose lids slide off as the dead climb out (`oz-tomb` openings), old coffins on trestles (low
 * platforms), the iron gate (a short locked fight), the narrow stair up to the tower door
 * (→ oz-f). The back wall with its niches and coffins is the background. Layout:
 * content/oldenzaal/church/layout.ts; art: church/art-crypt.ts; script: script-oz-e.ts.
 */
import { PAL } from '../../../../engine/palette';
import { PAL_HD_OZ } from '../../../../engine/palette-hd';
import type { BackgroundDef, SectionDef } from '../../../mission/index';
import { CRYPT_DECOR, CRYPT_LAMPS, decorIds } from '../../oldenzaal/church/decor';
import { CRYPT_CHECKPOINTS, CRYPT_STYLE, CRYPT_W, G, terrainCrypt } from '../../oldenzaal/church/layout';
import { defineSectionLight } from '../../oldenzaal/kit/light-api';
import { OZ_AMBIENCE, OZ_SECTION, OZ_SONG, OZ_SPRITES } from './ids';
import { scriptOzE } from './script-oz-e';

/** Almost dark: the darkest section (≤ 0.7, the readability rule); candles, lanterns, the heroes' glow. */
export const OZ_E_LIGHT = defineSectionLight(OZ_SECTION.e, {
  darkness: 0.66,
  tint: PAL_HD_OZ.night[0],
  lamps: CRYPT_LAMPS,
  heroLight: 36,
});

/** The crypt's back wall (church/art-crypt.ts `oz-crypt-far`; 5 bays, tiles). */
export const BG_CRYPT: BackgroundDef = {
  sky: PAL.ink[0],
  layers: [{ gen: 'oz-crypt-far', params: { air: 0.3 }, width: 480, factorX: 0.6 }],
};

export const sectionOzE: SectionDef = {
  id: OZ_SECTION.e,
  name: 'The crypt',
  width: CRYPT_W,
  height: 216,
  scroll: 'right',
  background: BG_CRYPT,
  terrain: terrainCrypt(),
  terrainStyle: CRYPT_STYLE,
  decor: [...CRYPT_DECOR],
  // Tier 4: the crypt's decor, the tombs, the gate, the dead soldiers.
  art: [...decorIds(CRYPT_DECOR), 'decor/oz-crypt/gate', 'prop/oz-tomb/', ...OZ_SPRITES.zombies],
  playerStart: { x: 48, y: G },
  checkpoints: [...CRYPT_CHECKPOINTS],
  music: OZ_SONG.theme,
  ambience: OZ_AMBIENCE.nave,
  script: scriptOzE,
};
