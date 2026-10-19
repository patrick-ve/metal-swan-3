/**
 * Content category "characters": sprite definitions only (docs/ARCHITECTURE.md §6.1, §7).
 * Each playable character is one rig style plus its own pose tables and props, registered with
 * definePlayerSprites (docs/ART_GUIDE.md §3): the whole `char/<id>/…` contract, `salute`,
 * `bored`, the nine Swan rider strips `ride-*` and the Helium Head variants `helium-*`. The
 * squad (docs/design/squad.md §1, the playable roster): vincent.art.ts, thom.art.ts,
 * dirk.art.ts, bob.art.ts, patrick.art.ts. The retired heroes (registered, not playable; m1–m5
 * and Gramps' radio role still use them): grace.art.ts, mittens.art.ts, pip.art.ts,
 * gramps.art.ts (GDD §3.1–§3.4). Menu portraits: portrait.art.ts (`PORTRAITS[id]` replaces the
 * rig's default portrait).
 */
import { defineSprite, getFrames } from '../../../engine/sprites';
import { crushStripHi } from '../../art/hi-strips';
import { definePlayerSprites, type PlayerArtOpts } from '../../art/human-sprites';
import { renderHuman, type Density, type HumanStyle, type Pose } from '../../art/humanoid';
import * as P from '../../art/poses';
import { CRUSH_TIMING, crushStrip } from '../creatures/draw';
import { BOB_ART, BOB_STYLE } from './bob.art';
import { DIRK_ART, DIRK_STYLE } from './dirk.art';
import { GRACE_ART, GRACE_STYLE } from './grace.art';
import { GRAMPS_ART, GRAMPS_STYLE } from './gramps.art';
import { MITTENS_ART, MITTENS_STYLE } from './mittens.art';
import { PATRICK_ART, PATRICK_STYLE } from './patrick.art';
import { PIP_ART, PIP_STYLE } from './pip.art';
import { THOM_ART, THOM_STYLE } from './thom.art';
import { VINCENT_ART, VINCENT_STYLE } from './vincent.art';
import { heroPortrait, PORTRAITS } from './portrait.art';
// The time-out snore (fx/snore) belongs to the player's sleep strip.
import '../fx/snore.art';

export { BOB_STYLE } from './bob.art';
export { DIRK_STYLE } from './dirk.art';
export { GRACE_STYLE } from './grace.art';
export { GRAMPS_STYLE } from './gramps.art';
export { MITTENS_STYLE } from './mittens.art';
export { PATRICK_STYLE } from './patrick.art';
export { PIP_STYLE } from './pip.art';
export { THOM_STYLE } from './thom.art';
export { VINCENT_STYLE } from './vincent.art';

/**
 * `recruit` — the test character: short brown hair, olive field vest over a sand T-shirt,
 * grey cargo trousers, brown boots, dark gloves, belt pouches.
 */
export const RECRUIT_STYLE: HumanStyle = {
  skin: 'skinA',
  hair: 'hairB',
  hairStyle: 'short',
  headgear: 'none',
  top: 'olive',
  topType: 'vest',
  shirt: 'sand',
  pants: 'stone',
  boots: 'brown',
  gloves: 'black',
  belt: 'brown',
  gear: 'olive',
  build: 'normal',
  accessories: ['pouches'],
};

/**
 * Helium Head art (GDD §4.13, status `helium-head` in helium.ts): the torso, `bored` and `victory`
 * strips again as `char/<id>/helium-<anim>` with the head and headgear at 2× (pink rim), and as
 * `helium-wob-<anim>` (the same big head 1 px down and forward: the wobble and the bob).
 */
export const HELIUM_VARIANTS: Readonly<Record<string, (p: Pose) => Pose>> = {
  helium: (p) => ({ ...p, headScale: 2 }),
  'helium-wob': (p) => ({ ...p, headScale: 2, head: { ...p.head, dx: (p.head?.dx ?? 0) + 1, dy: (p.head?.dy ?? 0) + 1 } }),
};

/** The heroes' styles by id (tools and previews read them). */
export const HERO_STYLES: Readonly<Record<string, HumanStyle>> = {
  vincent: VINCENT_STYLE,
  thom: THOM_STYLE,
  dirk: DIRK_STYLE,
  bob: BOB_STYLE,
  patrick: PATRICK_STYLE,
  grace: GRACE_STYLE,
  mittens: MITTENS_STYLE,
  pip: PIP_STYLE,
  gramps: GRAMPS_STYLE,
};

/** Register a playable character: the whole §6.1 contract, the rider strips and Helium Head. */
function defineHero(id: string, style: HumanStyle, art: PlayerArtOpts = {}): void {
  definePlayerSprites(id, style, { ...art, variants: HELIUM_VARIANTS });
  // A hero's own portrait replaces the rig's default one.
  // Crushed flat (anim wave p1): the shared pancake / peel strip over the hero's standing pose.
  // Frame 2 (the long hold) is the pancake settling with its arms splayed, so no two frames match.
  const stand = (d: Density) => renderHuman(style, P.STAND, 'full', d);
  const splay = (d: Density) => renderHuman(style, { ...P.STAND, armN: { sh: 80, el: 10, hand: 'open' }, armF: { sh: -70, el: 10, hand: 'open' }, expr: 'dazed' }, 'full', d);
  const flat = `char/${id}/die-flat`;
  defineSprite(
    flat,
    () => {
      const a = crushStrip(stand(1));
      a[2] = crushStrip(splay(1))[1];
      return a;
    },
    {
      durations: CRUSH_TIMING,
      loop: false,
      defer: true,
      hi: () => {
        const a = crushStripHi(stand(1), stand(2), getFrames(flat, 1));
        a[2] = crushStripHi(splay(1), splay(2), crushStrip(splay(1)))[1];
        return a;
      },
    },
  );
  const pc = PORTRAITS[id];
  if (pc) defineSprite(`char/${id}/portrait`, () => heroPortrait(style, pc), { anchor: 'top-left', hi: () => heroPortrait(style, pc, 2) });
}

defineHero('recruit', RECRUIT_STYLE);
defineHero('grace', GRACE_STYLE, GRACE_ART);
defineHero('mittens', MITTENS_STYLE, MITTENS_ART);
defineHero('pip', PIP_STYLE, PIP_ART);
defineHero('gramps', GRAMPS_STYLE, GRAMPS_ART);
defineHero('vincent', VINCENT_STYLE, VINCENT_ART);
defineHero('thom', THOM_STYLE, THOM_ART);
defineHero('dirk', DIRK_STYLE, DIRK_ART);
defineHero('bob', BOB_STYLE, BOB_ART);
defineHero('patrick', PATRICK_STYLE, PATRICK_ART);
