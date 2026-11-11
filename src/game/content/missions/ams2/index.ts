/**
 * Mission `ams2` — THE FRYING DUTCHMAN, level 1 again with new scenery in the hero method
 * (docs/design/ams2.md; the contract for section builders: docs/design/ams2-contract.md). The same
 * sections (`a`, `b`, `c`, `c1`, `c2`, `d`), route choice, terrain, scripts, waves, enemies, boss,
 * hitboxes and timers as `ams`; only what the player sees as scenery changes. Lazy and stand-alone:
 * `?mission=ams2` (with `&section=` and `&boss=1`); never someone's next mission, and after its tally
 * the game returns to the title (`MissionDef.standalone`). `seedAs: 'ams'`: the same seeds as `ams`,
 * so a bot plays both the same.
 *
 * HOW THE SCENERY WORKS (decided here; every name is in ./stage.ts):
 *
 * 1. THE PAINTED FLOOR. No mesh, no `SectionDef.floor`. The floor is painted by the kit
 *    (src/game/art/herokit) in three bands: far (.88), walk (1), near (1.16), with seams on kerbs or
 *    lane edges (`defineFloor`). Each band is a tile of sprite frames at most 256 px wide
 *    (`defineBand`), laid along the plane as decor with `parallax` = its speed (`bandTiles`). So the
 *    bands are generated in the art workers and cached like every other sprite.
 * 2. THE PARALLAX PROPS. A prop is a kit drawing (`defineArt`), drawn as decor at its plane's speed: a
 *    band x (`atBand`, the plane's own layout) or a world x (`atWorld`, the line-scroll rule, `bandX`:
 *    every plane lines up at screen centre). The far plane, the far bank, the water, clouds, boats and
 *    far figures are decor too (`mover` for what travels; a drawing longer than 256 px is a band,
 *    `placeBand`). Only the sky is a background layer (`skyBackground`). A front prop is `front: true`.
 * 3. WHAT A HITBOX TOUCHES stays at speed 1 (`hitProp`, `HIT_FOOT`, scene.ts `perchLamp`): platforms,
 *    ledges, awnings, boats, bridges, doors, the lamps a gull sleeps on, breakables. Water cuts come
 *    from the terrain's numbers (`waterCut`).
 * 4. THE TERRAIN PAINTER. `SectionDef.paintedFloor` (`stageSection`): `'all'` the painter draws
 *    nothing, every platform and solid is a kit sprite at speed 1 (the default: no pixel leaves the
 *    palette); `true` it draws no ground and no pit shafts, platforms and solids still draw (a section
 *    still under construction).
 * 5. THE SPRITE OVERRIDE. A shared entity draws `decor/ams/…`; with `stageSection(base, { overrides: {
 *    [shared]: twin } })` it draws the kit's twin while this section draws (`SectionDef.spriteOverrides`,
 *    engine/sprites.ts `setSpriteOverrides`). One map per section: a twin has the section's light.
 *    Scripts and entities stay shared, `ams` never sees it, logic never sees it.
 * 6. THE POST RULE. `kerbPosts` throws `PostOnWrongGround` when an Amsterdammertje is not on a
 *    kerbstone; tests/content/ams2.test.ts checks every post against the painted kerb.
 *
 * Section builders own `section-<key>.ts` and `art-<key>.ts`, nothing else: docs/design/ams2-contract.md §1.
 */
import type { MissionDef } from '../../../mission/index';
import { defineMission } from '../../../registry';
import { REPAIR_DROP_MISSIONS } from '../../items/drops';
import { AMS } from '../ams/index';
import { AMS2_ID, AMS2_SPRITE_PREFIX } from './ids';
import { sectionA } from './section-a';
import { sectionB } from './section-b';
import { sectionC } from './section-c';
import { sectionC1 } from './section-c1';
import { sectionC2 } from './section-c2';
import { sectionD } from './section-d';

/** The vehicle-state drops are the same as in `ams` (same rng calls, same sim). */
REPAIR_DROP_MISSIONS.add(AMS2_ID);

/** The fully stated tier-4 art of `ams` per section (section c's and d's big explosions). */
const art = (base: { art?: readonly string[] }, own: { art?: readonly string[] }): readonly string[] => [...new Set([...(own.art ?? []), ...(base.art ?? []).filter((p) => p.startsWith('fx/'))])];

export const AMS2: MissionDef = {
  ...AMS,
  id: AMS2_ID,
  subtitle: 'MISSION 1 - NEW ART',
  next: undefined,
  standalone: true,
  seedAs: 'ams',
  sections: {
    a: sectionA,
    b: sectionB,
    c: { ...sectionC, art: art(AMS.sections.c, sectionC) },
    c1: { ...sectionC1, art: art(AMS.sections.c1, sectionC1) },
    c2: { ...sectionC2, art: art(AMS.sections.c2, sectionC2) },
    d: { ...sectionD, art: art(AMS.sections.d, sectionD) },
  },
  art: [...(AMS.art ?? []), AMS2_SPRITE_PREFIX],
};

defineMission(AMS2);
