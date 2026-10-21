/**
 * oz-c — Plechelmusplein, the statue boss (docs/design/oldenzaal.md §2, §5: night, a full moon).
 *
 * CORE STUB (wave A): a short flat placeholder with an exit; wave B (STATUE) builds the square,
 * the statue of St. Plechelmus (`oz-statue`) and its fight (`bossSection`). Keep `sectionOzC`
 * and 'oz-c'.
 */
import { PAL_HD_OZ } from '../../../../engine/palette-hd';
import type { SectionDef } from '../../../mission/index';
import { defineSectionLight } from '../../oldenzaal/kit/light-api';
import { BG_OZ_C } from './backgrounds';
import { OZ_AMBIENCE, OZ_SECTION, OZ_SONG } from './ids';
import { OZ_STREET_STYLE } from './section-oz-a';
import { G, OZ_C_W, terrainOzC } from './terrain';

/** Night under a full moon: cold blue; the statue's lamp pool comes with wave B. */
export const OZ_C_LIGHT = defineSectionLight(OZ_SECTION.c, {
  darkness: 0.5,
  tint: PAL_HD_OZ.night[1],
  fog: { density: 0.3, color: PAL_HD_OZ.night[4], top: 160, drift: -0.08 },
  heroLight: 28,
});

export const sectionOzC: SectionDef = {
  id: OZ_SECTION.c,
  name: 'Plechelmusplein (night)',
  width: OZ_C_W,
  height: 216,
  scroll: 'right',
  background: BG_OZ_C,
  terrain: terrainOzC(),
  terrainStyle: OZ_STREET_STYLE,
  decor: [],
  art: [],
  playerStart: { x: 48, y: G },
  bossStart: { x: 48, y: G },
  music: OZ_SONG.theme,
  ambience: OZ_AMBIENCE.street,
  *script(ctx) {
    // Placeholder (wave B: the statue boss): cross the square to the basilica's red doors.
    yield ctx.waitPlayerX(OZ_C_W - 64);
    yield ctx.exitTo(OZ_SECTION.d);
  },
};
