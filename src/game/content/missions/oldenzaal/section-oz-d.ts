/**
 * oz-d — the nave of the basilica (docs/design/oldenzaal.md §2, §7: candle light, lightning in the
 * windows; the horde and the church set pieces, no mini-boss; RESPECT: nothing mocked, broken or
 * burned).
 *
 * CORE STUB (wave A): a short flat placeholder with an exit; wave B (NAVE) builds it. Keep
 * `sectionOzD` and 'oz-d'.
 */
import { PAL_HD_OZ } from '../../../../engine/palette-hd';
import type { SectionDef } from '../../../mission/index';
import { defineSectionLight } from '../../oldenzaal/kit/light-api';
import { BG_OZ_D } from './backgrounds';
import { OZ_AMBIENCE, OZ_SECTION, OZ_SONG } from './ids';
import { OZ_STREET_STYLE } from './section-oz-a';
import { G, OZ_D_W, terrainOzD } from './terrain';

/** Dark inside; candles (wave B adds them as `lamps`) and lightning through the windows. */
export const OZ_D_LIGHT = defineSectionLight(OZ_SECTION.d, {
  darkness: 0.6,
  tint: PAL_HD_OZ.night[0],
  lightning: { every: [420, 900], strength: 0.8, double: 0.3 },
  heroLight: 32,
});

export const sectionOzD: SectionDef = {
  id: OZ_SECTION.d,
  name: 'The nave',
  width: OZ_D_W,
  height: 216,
  scroll: 'right',
  background: BG_OZ_D,
  terrain: terrainOzD(),
  terrainStyle: OZ_STREET_STYLE,
  decor: [],
  art: [],
  playerStart: { x: 48, y: G },
  checkpoints: [768],
  music: OZ_SONG.theme,
  ambience: OZ_AMBIENCE.nave,
  *script(ctx) {
    // Placeholder (wave B: the horde, the doors, the chandeliers): on to the small tower door.
    yield ctx.waitPlayerX(OZ_D_W - 64);
    yield ctx.exitTo(OZ_SECTION.e);
  },
};
