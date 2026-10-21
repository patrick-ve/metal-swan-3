/**
 * Shared numbers and sprite ids of content area `ring/crew` (docs/design/ring.md §5.5, §7.2): the
 * road-works crew (`ring-roadworks`) and the jam boarders (`ring-boarder`). The art (art.ts,
 * art-truck.ts, art-people.ts) and the logic (roadworks.ts, boarder.ts) read the same numbers.
 *
 * Local coordinates are drawn FACING RIGHT (the front at +x, the near side towards the camera); the
 * anchor (0, 0) is the road point under the middle; y grows down.
 */
import type { HumanStyle } from '../../../art/humanoid';

export type Pt = readonly [number, number];

// ---------------------------------------------------------------------------------------------
// The road-works truck and its arrow trailer
// ---------------------------------------------------------------------------------------------

/**
 * The road-works truck: an orange cab at the front, a flatbed with low drop sides (the crew stands
 * on it, a stack of cones behind the cab), red-white chevrons on the tail; it tows the arrow
 * trailer of the wave-A closure (`ring/hazard/arrow-trailer` + `ring/hazard/arrow-board`).
 */
export const TRUCK = {
  /** Half length of the truck (without the trailer) and its cab's x range. */
  half: 42,
  cab: [12, 42] as const,
  /** Cab roof height and the beacon bar over it. */
  roof: -34,
  /** The flatbed's deck (where the crew stands: their lift) and the top of its drop sides. */
  deck: 14,
  sideTop: -21,
  /** Wheel centres (x), radius. */
  wheelX: [-27, 27] as readonly number[],
  wheelR: 6,
  /** The trailer's anchor (its middle) behind the truck, and its sprite's board point. */
  trailerX: -57,
  /** The whole thing's x range (trailer rear … cab front): the visual box and the depth slab. */
  x0: -70,
  x1: 43,
  /** Visual height (the beacon bar's top). */
  h: 40,
  /** The crew's places on the deck (x, the back first). */
  crewX: [-33, -19, -5] as readonly number[],
  /** Where a laid cone drops: behind the trailer (x from the anchor). */
  coneDrop: -72,
} as const;

/** Sprite ids of the truck (`ring/roadworks/` = the art-def family of `ring-roadworks`). */
export const TRUCK_ID = {
  /** 5 frames: 0 / 1 the beacons, 2 / 3 battered (≤ half HP), 4 the wreck (dark, burnt). */
  truck: 'ring/roadworks/truck',
  /** 3 frames (clean, battered, wreck): the near drop side, drawn in front of the crew. */
  side: 'ring/roadworks/side',
  /** The wave-A closure's arrow trailer and its board (read only: content/ring/hazards). */
  trailer: 'ring/hazard/arrow-trailer',
  board: 'ring/hazard/arrow-board',
  cone: 'ring/hazard/cone',
} as const;

/** Truck frames. */
export const TRUCK_FRAME = { clean: 0, battered: 2, wreck: 4 } as const;

// ---------------------------------------------------------------------------------------------
// The road workers
// ---------------------------------------------------------------------------------------------

/** The three workers' looks: orange work jackets with silver bands, a hard hat, gloves. */
export const WORKER_LOOKS: readonly HumanStyle[] = [
  { skin: 'skinA', hair: 'hairB', hairStyle: 'short', headgear: 'helmet', gear: 'snow', accent: 'snow', top: 'orange', topType: 'jacket', shirt: 'orange', pants: 'navy', boots: 'black', belt: 'black', gloves: 'gold', accessories: ['hivis'], build: 'heavy', face: ['beard'] },
  { skin: 'skinC', hair: 'hairA', hairStyle: 'short', headgear: 'helmet', gear: 'gold', accent: 'snow', top: 'orange', topType: 'jacket', shirt: 'orange', pants: 'navy', boots: 'black', belt: 'black', gloves: 'gold', accessories: ['hivis'], build: 'normal' },
  { skin: 'skinB', hair: 'hairC', hairStyle: 'short', headgear: 'helmet', gear: 'snow', accent: 'snow', top: 'orange', topType: 'jacket', shirt: 'orange', pants: 'orange', boots: 'black', belt: 'black', gloves: 'gold', accessories: ['hivis'], build: 'stocky' },
];

/** Sprite prefix of a worker look. */
export function workerArt(look: number): string {
  return `ring/roadworks/worker/${look}`;
}

/**
 * Worker strips (`ring/roadworks/worker/<look>/<strip>`, anchor = his feet on the deck):
 * idle (2), tell (3: a cone off the stack and up over his head; he holds the last frame), throw
 * (3: the throw, point `hand` where the cone leaves, the follow-through), gloat (3: the coffee
 * break), cower (2), tumble (4), sit (2).
 */
export const WORKER_STRIPS = ['idle', 'tell', 'throw', 'gloat', 'cower', 'tumble', 'sit'] as const;

/** The cone in the raised hands (from the feet, facing right) at the throw's release. */
export const WORKER_HAND: Pt = [3, -44];

// ---------------------------------------------------------------------------------------------
// The jam boarders
// ---------------------------------------------------------------------------------------------

/** Boarder looks: the ams handhaver (3 skins) and the stag partier (4 looks). */
export const BOARDER_SETS = [
  { kind: 'handhaver', set: 'handhaver', look: 0 },
  { kind: 'handhaver', set: 'handhaver-b', look: 1 },
  { kind: 'handhaver', set: 'handhaver-c', look: 2 },
  { kind: 'stag', set: 'stag-partier', look: 0 },
  { kind: 'stag', set: 'stag-partier-1', look: 1 },
  { kind: 'stag', set: 'stag-partier-2', look: 2 },
  { kind: 'stag', set: 'stag-partier-3', look: 3 },
] as const;
export type BoarderKind = 'handhaver' | 'stag';

/** Sprite prefix of boarder set `i` (`ring/boarder/` = the art family of `ring-boarder`). */
export function boarderArt(i: number): string {
  return `ring/boarder/${BOARDER_SETS[i].set}`;
}

/**
 * Boarder strips (`ring/boarder/<set>/<strip>`, anchor = the feet; facing right):
 * idle (2), run (8), crouch (2: the tell before the hop), hop (2: up and over, airborne), perch (2: kneeling
 * on a bonnet, one hand on the windscreen's foot), tell-hit (2: the arm up — the handhaver's fist,
 * the partier's bottle), hit (2: the slam onto the glass, the bounce), tumble (4), sit (2). The
 * gloat and the cower are the ams sets' own strips (`enemy/<set>/gloat`, `enemy/<set>/cower`).
 */
export const BOARDER_STRIPS = ['idle', 'run', 'crouch', 'hop', 'perch', 'tell-hit', 'hit', 'tumble', 'sit'] as const;

/**
 * The bonnet of a ring wagon (content/ring/wagon/geometry.ts `CAR.profile`: the windscreen's foot
 * at x 20.6, the nose at 44.6; the bonnet top at about y −17.5): where a boarder kneels (x from
 * the wagon's middle, facing the windscreen), his lift, and how far (x) the bonnet may be from
 * the hop's landing for him to land on it.
 */
export const BONNET = { x: 33, lift: 17, reach: 16 } as const;
