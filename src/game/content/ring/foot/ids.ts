/**
 * Ids of the ring's on-foot part (docs/design/ring.md §R.5–§R.7, R-17; docs/api/ring.md "Revision
 * R"). Fixed in the CORE stage: add, never rename.
 */
import { RING_FOOT_SECTIONS } from '../../../ring/ids';

export { RING_FOOT_SECTIONS };

/** The foot sections: `rf-a` DE FILE (the jam, JAM+FOOT), `rf-b` DE BLOKKADE (the blockade, wave B). */
export const RF_SECTION = { a: 'rf-a', b: 'rf-b' } as const;
export type RfSectionId = (typeof RF_SECTION)[keyof typeof RF_SECTION];

/**
 * The art prefixes of the on-foot part (spec §R.10: NEW art only under these, never under the
 * prefixes `ams` preloads): the jam's decor and the gangs on foot (`ring/foot/`), the people
 * (`npc/ring/`: the activists, the police in wave B), effects (`fx/ring/`).
 */
export const RF_ART = { foot: 'ring/foot/', npc: 'npc/ring/', fx: 'fx/ring/' } as const;

/** The ground line of the placeholder sections (feet y; the A10's near lane and hard shoulder). */
export const RF_GROUND = 176;

/** Checkpoints at least every this many px (spec §R.5: ≤ 1,400). */
export const RF_CHECKPOINT_GAP = 1_400;

/**
 * The on-foot part's own 4× reserve besides the sprites (its SectionView's background layers and
 * terrain chunks; gameplay.ts `MissionArtDef.sectionReserve`). JAM+FOOT measured rf-a (2026-10-22):
 * its seven background layers (section-rf-a.ts `RF_BACKGROUND`, 330,048 logical px) cost 21.1 MB at
 * 4× + 5.3 MB at 2×; the terrain style has no HD material (1× chunks, < 2 MB): ≈ 28 MB. 40 MB kept
 * (room for rf-b's own decor; tests/content/ring-foot.test.ts checks the layers fit).
 */
export const RF_SCENERY_RESERVE = 40 * 1024 * 1024;
