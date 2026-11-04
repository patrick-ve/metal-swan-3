/**
 * `bob` — BOB, CAPTAIN CLIMATE (docs/design/squad.md §1): tousled brown hair swept up, BLUE eyes,
 * pale skin, faint stubble, tall and slim, a navy T-shirt and a short green superhero cape with a
 * small leaf emblem. No ethnic stereotype in any art.
 * - Knife look: a tiny model airliner, a swoop.
 * - Bored: checks his boarding pass while the cape flutters.
 * - Victory: the flying pose, a fist to the sky, the cape streaming.
 *
 * The in-game sprites `char/bob/…` are the baked 40 px set (docs/design/ams40.md wave 2:
 * tools/art40/chars/bob/, src/game/content/art40/bob.gen.ts, registered in art.ts). This style
 * stays for the menu portrait, the ending heads and the HD rig tests.
 */
import type { HumanStyle } from '../../art/humanoid';

export const BOB_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: 'hairB',
  hairStyle: 'swept-up',
  headgear: 'none',
  // The cape.
  accent: 'green',
  top: 'navy',
  topType: 'tee',
  pants: 'slate',
  boots: 'brown',
  gloves: null,
  belt: 'brown',
  build: 'lanky',
  accessories: ['cape'],
  face: ['stubble', 'blue-eyes'],
};
