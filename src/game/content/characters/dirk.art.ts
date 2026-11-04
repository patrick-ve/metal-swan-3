/**
 * `dirk` — DIRK, THE PLUMBER (docs/design/squad.md §1): messy spiky brown hair, a THICK BROWN
 * MUSTACHE with light stubble, a round rosy face, a normal-heavy build and a hi-vis yellow work
 * vest over dark fatigues. Never a famous game plumber: no cap, no overalls, no letter.
 * - Knife look: a plunger, a firm push.
 * - Bored: wipes his mustache, then checks a pipe wrench.
 * - Victory: the plunger raised high.
 *
 * The in-game sprites `char/dirk/…` are the baked 40 px set (docs/design/ams40.md wave 2:
 * tools/art40/chars/dirk/, src/game/content/art40/dirk.gen.ts, registered in art.ts). This style
 * stays for the menu portrait, the ending heads and the HD rig tests.
 */
import { PAL } from '../../../engine/palette';
import type { HumanStyle } from '../../art/humanoid';

export const DIRK_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: 'hairB',
  hairStyle: 'spiky-messy',
  headgear: 'none',
  // The cheek blush.
  accent: [PAL.pink[1], PAL.pink[2], PAL.pink[2]],
  top: 'gold',
  topType: 'vest',
  // Yellow sleeves too: the hi-vis reads at 1× (the near sleeve covers most of the chest).
  shirt: 'gold',
  pants: [PAL.olive[0], PAL.olive[1], PAL.olive[2]],
  boots: 'black',
  gloves: 'brown',
  belt: 'black',
  build: 'normal',
  accessories: ['hivis'],
  face: ['stubble', 'blush', 'thick-mustache'],
};
