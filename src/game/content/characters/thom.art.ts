/**
 * `thom` — THOM, LITTLE NAPOLEON (docs/design/squad.md §1): a navy baseball cap worn BACKWARDS,
 * very short light-blond hair, a HUGE toothy grin and squinting happy eyes; short and sturdy; an
 * olive-green T-shirt. A second pistol in the off hand on every pistol torso strip (drawing only:
 * firing is unchanged; the muzzle point is the aimed gun's).
 * - Knife look: a pistol-whip with the spare pistol.
 * - Bored: the hand-in-jacket Napoleon pose, chin up, chest out.
 * - Victory: both pistols up, akimbo.
 *
 * The in-game sprites `char/thom/…` are the baked 40 px set (docs/design/ams40.md wave 2:
 * tools/art40/chars/thom/, src/game/content/art40/thom.gen.ts, registered in art.ts). This style
 * stays for the menu portrait, the ending heads and the HD rig tests.
 */
import { PAL } from '../../../engine/palette';
import type { HumanStyle } from '../../art/humanoid';

export const THOM_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: [PAL.gold[1], PAL.gold[2], PAL.gold[3]],
  hairStyle: 'buzz',
  headgear: 'cap-back',
  gear: 'navy',
  accent: 'gold',
  top: 'olive',
  topType: 'tee',
  pants: 'sand',
  boots: 'brown',
  gloves: null,
  belt: 'black',
  build: 'stocky',
  face: ['grin', 'beam'],
};
