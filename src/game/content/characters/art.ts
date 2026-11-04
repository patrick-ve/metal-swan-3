/**
 * Content category "characters": sprite definitions only (docs/ARCHITECTURE.md §6.1, §7).
 * The squad (docs/design/squad.md §1, the playable roster: VINCENT, THOM, DIRK, BOB, PATRICK) are
 * baked 40 px sets (docs/design/ams40.md wave 2): `src/game/content/art40/<id>.gen.ts`, drawn
 * offline by tools/art40/chars/<id>/ through the shared hero module tools/art40/chars/_hero/:
 * the whole `char/<id>/…` contract (legs, torsos, full-body strips, `salute`, the nine Swan rider
 * strips `ride-*` and the Helium Head twins `helium-*` / `helium-wob-*`), one 1× picture at every
 * art tier. Their `*.art.ts` keep the HumanStyle for the menu portrait and the ending heads; the
 * select panels (select.art.ts) and portraits (portrait.art.ts) are UI and stay.
 * The retired heroes (registered, not playable; m1–m5 and Gramps' radio role still use them) and
 * the test recruit keep the rig (definePlayerSprites, docs/ART_GUIDE.md §3): grace.art.ts,
 * mittens.art.ts, pip.art.ts, gramps.art.ts (GDD §3.1–§3.4).
 */
import { defineSprite } from '../../../engine/sprites';
import { definePlayerSprites, type PlayerArtOpts } from '../../art/human-sprites';
import type { HumanStyle, Pose } from '../../art/humanoid';
import { defineBakedSet } from '../../../engine/baked';
import { SET as BOB_SET } from '../art40/bob.gen';
import { SET as DIRK_SET } from '../art40/dirk.gen';
import { SET as PATRICK_SET } from '../art40/patrick.gen';
import { SET as THOM_SET } from '../art40/thom.gen';
import { SET as VINCENT_SET } from '../art40/vincent.gen';
import { BOB_STYLE } from './bob.art';
import { DIRK_STYLE } from './dirk.art';
import { GRACE_ART, GRACE_STYLE } from './grace.art';
import { GRAMPS_ART, GRAMPS_STYLE } from './gramps.art';
import { MITTENS_ART, MITTENS_STYLE } from './mittens.art';
import { PATRICK_STYLE } from './patrick.art';
import { PIP_ART, PIP_STYLE } from './pip.art';
import { THOM_STYLE } from './thom.art';
import { VINCENT_STYLE } from './vincent.art';
import { defineRigCrush } from './crush.art';
import { heroPortrait, PORTRAITS } from './portrait.art';
import { defineStyleSprites } from './styles/index';
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
  defineRigCrush(`char/${id}`, style);
  heroPortraitSprite(id, style);
}

/** A hero's own portrait replaces the rig's default one (`char/<id>/portrait`, UI). */
function heroPortraitSprite(id: string, style: HumanStyle): void {
  const pc = PORTRAITS[id];
  if (pc) defineSprite(`char/${id}/portrait`, () => heroPortrait(style, pc), { anchor: 'top-left', hi: () => heroPortrait(style, pc, 2) });
}

defineHero('recruit', RECRUIT_STYLE);
defineHero('grace', GRACE_STYLE, GRACE_ART);
defineHero('mittens', MITTENS_STYLE, MITTENS_ART);
defineHero('pip', PIP_STYLE, PIP_ART);
defineHero('gramps', GRAMPS_STYLE, GRAMPS_ART);
/** The squad: the baked 40 px sets and the menu portrait (UI, drawn by the rig). */
for (const [id, set, style] of [
  ['vincent', VINCENT_SET, VINCENT_STYLE],
  ['thom', THOM_SET, THOM_STYLE],
  ['dirk', DIRK_SET, DIRK_STYLE],
  ['bob', BOB_SET, BOB_STYLE],
  ['patrick', PATRICK_SET, PATRICK_STYLE],
] as const) {
  defineBakedSet(set);
  heroPortraitSprite(id, style);
}
// The art-direction trial (styles/kit.ts): every strip of the hidden `vincent-<style>` copies.
defineStyleSprites(HELIUM_VARIANTS);
