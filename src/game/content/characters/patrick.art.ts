/**
 * `patrick` — PATRICK, THE SUPERNERD (docs/design/squad.md §1): black hair, short sides and a
 * slick swept-back top, dark brows, brown eyes, light-tan skin, a thin trimmed mustache and a
 * black polo shirt.
 * - Knife look: a frikandel, a hearty swat.
 * - Bored: eats a frikandel (bite, chew), then glances at a glowing pocket device.
 * - Victory: the frikandel raised like a trophy.
 *
 * The in-game sprites `char/patrick/…` are the baked 40 px set (docs/design/ams40.md wave 2:
 * tools/art40/chars/patrick/, src/game/content/art40/patrick.gen.ts, registered in art.ts). This style
 * stays for the menu portrait, the ending heads and the HD rig tests.
 */
import { PAL } from '../../../engine/palette';
import type { HumanStyle } from '../../art/humanoid';

export const PATRICK_STYLE: HumanStyle = {
  skin: 'skinB',
  // Glossy black: a cool steel shine on the swept-back top.
  hair: [PAL.ink[0], PAL.black[2], PAL.steel[1]],
  hairStyle: 'slick-back',
  headgear: 'none',
  accent: 'teal',
  top: 'black',
  topType: 'polo',
  pants: 'stone',
  boots: 'black',
  gloves: null,
  belt: 'brown',
  build: 'normal',
  face: ['thin-mustache'],
};
