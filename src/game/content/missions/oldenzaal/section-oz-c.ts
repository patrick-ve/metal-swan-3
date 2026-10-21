/**
 * oz-c — Plechelmusplein (docs/design/oldenzaal.md §2, §5, §6, REVISION 2: night, a full moon):
 * the abandoned square in front of the basilica's long side; a short approach with a few dead
 * soldiers; Mevrouw Winkel's ONE scene (she wakes the statue: `WINKEL_WAKE_LINES`, then
 * `possessInto`); the 2-phase mini-boss St. Plechelmus (`OZ_STATUE.boss` = 'oz-plechelmus',
 * about 45–60 s); the saint freed and back on his plinth; the basilica's red doors open → oz-d.
 *
 * Owner: STATUE (wave B). Layout and art: art-square.ts; the script: script-oz-c.ts; the boss:
 * bosses/oldenzaal/. `?mission=oldenzaal&boss=1` starts at the arena (`bossStart`).
 */
import { PAL_HD_OZ } from '../../../../engine/palette-hd';
import { terrain, type SectionDef } from '../../../mission/index';
import { defineSectionLight } from '../../oldenzaal/kit/light-api';
import { ARENA_L, BG_OZ_C_SQUARE, OZ_C_CHECKPOINTS, OZ_C_DECOR, OZ_C_EXIT, OZ_C_LAMP_LIGHTS, OZ_C_W2, OZ_SQUARE_ART } from './art-square';
import { OZ_AMBIENCE, OZ_SECTION, OZ_SONG, OZ_SPRITES } from './ids';
import { OZ_C_EXIT_ID, scriptOzC } from './script-oz-c';
import { OZ_STREET_STYLE } from './section-oz-a';
import { G } from './terrain';

/** Night under a full moon: cold blue; the lamp by the statue and the moonlight on it. */
export const OZ_C_LIGHT = defineSectionLight(OZ_SECTION.c, {
  darkness: 0.55,
  tint: PAL_HD_OZ.night[1],
  lamps: OZ_C_LAMP_LIGHTS,
  fog: { density: 0.35, color: PAL_HD_OZ.night[5], top: 158, drift: -0.08 },
  heroLight: 28,
});

const t = terrain(OZ_C_W2, 216);
t.ground().at(0, G).flat(OZ_C_W2);

/** The square's tier-4 art: its decor, the statue and its effects, Mevrouw Winkel, the dead, the light glows. */
export const OZ_C_ART: readonly string[] = [
  ...OZ_SQUARE_ART,
  'decor/oz/lamp',
  'decor/oz/bench',
  'decor/oz/bin',
  'decor/oz/bollard',
  'boss/oz-plechelmus/',
  'fx/oz/statue/',
  'npc/oz-winkel/',
  ...OZ_SPRITES.light,
  ...OZ_SPRITES.zombies,
];

export const sectionOzC: SectionDef = {
  id: OZ_SECTION.c,
  name: 'Plechelmusplein (night)',
  width: OZ_C_W2,
  height: 216,
  scroll: 'right',
  background: BG_OZ_C_SQUARE,
  terrain: t.build(),
  terrainStyle: { ...OZ_STREET_STYLE, seed: 3 },
  decor: [...OZ_C_DECOR],
  art: OZ_C_ART,
  playerStart: { x: 48, y: G },
  bossStart: { x: ARENA_L + 48, y: G },
  checkpoints: [...OZ_C_CHECKPOINTS],
  exits: [{ id: OZ_C_EXIT_ID, rect: { ...OZ_C_EXIT }, to: OZ_SECTION.d, disabled: true }],
  music: OZ_SONG.theme,
  ambience: OZ_AMBIENCE.street,
  script: scriptOzC,
};
