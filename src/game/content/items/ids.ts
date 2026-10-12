/**
 * Item ids and shared geometry used by both the logic (index.ts …) and the art (art.ts …) of the
 * items category, so the art modules never import game logic.
 */

/** Hostage kinds (GDD §7.2, §15.3). */
export const HOSTAGE_KINDS = ['critic', 'roadie', 'tea-lady', 'tourist', 'composer', 'dollop'] as const;
export type HostageKindId = (typeof HOSTAGE_KINDS)[number];

/** Hostage binds (GDD §7.2 `params.bind`). */
export const BIND_IDS = ['chair', 'cage', 'sack', 'float', 'balloon'] as const;
export type BindId = (typeof BIND_IDS)[number];

/** Food and treasure kinds (GDD §7.1). */
export const FOOD_KINDS = ['bread', 'cheese', 'teacake', 'jelly', 'birthday-cake'] as const;
export const GEM_KINDS = ['golden-note', 'gem', 'medal', 'golden-record'] as const;

/**
 * Balloon rig (GDD §7.2 `balloon`), from the hostage's feet: the raised hands where the rope
 * ends, and the rope length up to the balloon's knot.
 */
export const DANGLE_HANDS = -35;
export const BALLOON_ROPE = 12;

/** Cage size (GDD §7.2: 20×30). The hostage's feet are the cage floor. */
export const CAGE_W = 20;
export const CAGE_H = 30;
