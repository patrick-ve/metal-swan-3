/**
 * ams2-c2 RONDVAART (docs/design/ams2.md §3; the contract: docs/design/ams2-contract.md), golden light:
 * the river cruise. The boarding quay (0–60), the Amstel with its far bank and Carre, the low brick
 * bridges, the houseboat at the far quay, the Magere Brug, the Waterlooplein jetty (2492–2632). The boats
 * and the bascule are the shared entities, in their twins. Same play as `ams`.
 */
import type { DecorDef, SectionDef } from '../../../mission/index';
import { LOW_BRIDGE, MAGERE_BRUG } from '../ams/cruise';
import { C2_BRIDGES, C2_MAGERE_X, sectionC2 as base } from '../ams/section-c2';
import { C2_RIVER, C2_W } from '../ams/terrain';
import { BANK_CROWN_Y, bankCrown, BOAT_PLATFORM, CRATE_OVERRIDES, FAR, id, L, layExact, PILE, quayEnd, riverLayers, routeSign, SURFACE_608, tiles } from './art-c';
import { STALL_IDS } from './art-c1';
import { AMSTEL_BANK, AMSTEL_TREES, AMSTEL_WATER, C2_BOAT, CRUISE_TWIN, DOLPHIN, FAR_BOAT, HATCH_TWIN, LOW_BACK, LOW_FACE, MAGERE_BACK, MAGERE_LEAVES, PEDAL, SLOOP } from './art-c2';
import { birdsDecor, cloudsDecor, farDecor, perchLamp } from './scene';
import { atBand, atWorld, bandEnd, bandTiles, bandX, defineFloor, hitProp, HIT_FOOT, keepClear, kerbPosts, mover, postRow, S_BACK, S_MID, S_NEAR, skyBackground, stageSection, TILE_W } from './stage';

const W = C2_W;
const [RIVER_A, RIVER_B] = C2_RIVER;

const PLAN = defineFloor({ light: L, name: 'c2', seed: 371, far: 'pave', walk: 'cobble', near: 'pave' });
keepClear(PLAN, -200, RIVER_B + 2);

const [farA, farB] = [bandX(RIVER_B, S_BACK), bandEnd(W, S_BACK)];
const [nearA, nearB] = [bandX(RIVER_B, S_NEAR), bandEnd(W, S_NEAR)];
const lastWhole = (a: number, b: number): number => a + Math.floor((b - a) / TILE_W) * TILE_W;
const farPosts = kerbPosts(PLAN, L, 'far', postRow(PLAN, 'far', farA + 8, 40, W).filter((x) => x + 10 < lastWhole(farA, farB)));
const nearPosts = kerbPosts(PLAN, L, 'near', postRow(PLAN, 'near', nearA + 10, 70, W).filter((x) => x + 10 < lastWhole(nearA, nearB)));

const river = riverLayers(W);
const BACK_FEET = 161;

const props = {
  lamp: id('lamp-72'),
  bench: id('bench'),
  bikeRed: id('bike-dred'),
  pole: id('flag-pole-76'),
  flagCity: id('flag-city'),
  planter: id('planter'),
  tulips: id('tulips'),
};

/** The river's rows behind the boat: their feet go under the walk rows of the water. World x. */
const WATER_FEET = 168;
const riverProps: DecorDef[] = [
  ...[250, 860, 1430, 1830, 2300].map((x) => atWorld(DOLPHIN, x, WATER_FEET, S_BACK)),
  ...[430, 1300, 2210].map((x, i) => atWorld(SLOOP, x, WATER_FEET, S_BACK, { animate: 40, frame: i })),
  ...[1000, 1540].map((x, i) => atWorld(PEDAL, x, WATER_FEET, S_BACK, { animate: 16, frame: i * 3 })),
];

/** Pile tops in front of everything, on the near plane: the river is deep and close. */
const nearPiles: DecorDef[] = [150, 590, 1060, 1480, 1950, 2380].map((x) => atWorld(PILE, x, 197, S_NEAR, { front: true }));

const lowBridges: DecorDef[] = C2_BRIDGES.map((x) => hitProp(LOW_BACK, x, LOW_BRIDGE.top));
const lowFaces: DecorDef[] = C2_BRIDGES.map((x) => hitProp(LOW_FACE, x, LOW_BRIDGE.top, { front: true }));

const decor: DecorDef[] = [
  ...cloudsDecor(L, 271),
  ...birdsDecor(L, 100, 22, -0.12, W),
  ...farDecor(FAR, W),
  ...bandTiles(AMSTEL_BANK, W),
  ...bandTiles(AMSTEL_WATER, W),
  ...mover(id('tour-boat'), S_MID, 400, 116, 0.1, 1200, W, 1),
  ...mover(id('far-cyclist-dred'), S_MID, 40, 88, 0.3, 1200, W, 8),
  ...AMSTEL_TREES.map(([x, seed], i) => atBand(bankCrown(seed), i % 2 ? x + 28 : x - 28, BANK_CROWN_Y, S_MID, { animate: 20, flipX: i % 2 === 1 })),
  ...[86, 360, 590, 770, 1140].map((x, i) => atBand(FAR_BOAT, x, 116, S_MID, { animate: 40, frame: i })),
  ...river.far,
  ...riverProps,
  ...river.walk,
  ...river.near,
  // The boarding quay.
  ...layExact(PLAN, 'far', 0, bandX(RIVER_A, S_BACK)),
  ...layExact(PLAN, 'walk', 0, RIVER_A),
  ...layExact(PLAN, 'near', 0, bandX(RIVER_A, S_NEAR)),
  ...quayEnd(RIVER_A, 'r'),
  // The Waterlooplein jetty.
  ...layExact(PLAN, 'far', farA, farB),
  ...layExact(PLAN, 'walk', RIVER_B, W),
  ...layExact(PLAN, 'near', nearA, nearB),
  ...quayEnd(RIVER_B, 'l'),
  ...farPosts,
  atWorld(props.bikeRed, RIVER_B + 40, BACK_FEET, S_BACK),
  atWorld(props.bench, RIVER_B + 92, BACK_FEET, S_BACK),
  atWorld(STALL_IDS[2], C2_W - 30, BACK_FEET, S_BACK),
  atWorld(props.pole, RIVER_B + 140, BACK_FEET, S_BACK),
  atWorld(props.flagCity, RIVER_B + 143, BACK_FEET - 51, S_BACK, { animate: 8 }),
  // On the boarding quay and the jetty.
  perchLamp(L, 14),
  hitProp(routeSign('RONDVAART', 'down'), 26, HIT_FOOT + 1),
  perchLamp(L, RIVER_B + 24),
  hitProp(routeSign('WATERLOOPLEIN', 'none'), RIVER_B + 44, HIT_FOOT + 1),
  // The houseboat at the far quay.
  hitProp(C2_BOAT.id, C2_BOAT.x, C2_BOAT.y),
  hitProp(id('smoke'), C2_BOAT.x + 76, C2_BOAT.y + 2, { animate: 9 }),
  // The bridges over the river: behind the boat.
  ...lowBridges,
  hitProp(MAGERE_BACK, C2_MAGERE_X, MAGERE_BRUG.top),
  // In front of the figures.
  ...tiles(SURFACE_608, RIVER_A, RIVER_B, { front: true }),
  ...lowFaces,
  ...nearPiles,
  ...nearPosts,
];

export const sectionC2: SectionDef = stageSection(base, {
  background: skyBackground(L, 271),
  decor,
  overrides: {
    ...CRATE_OVERRIDES,
    'decor/ams/ams-cruise-boat': CRUISE_TWIN,
    'decor/ams/magere-brug': MAGERE_LEAVES,
    'decor/ams/ams-boat-platform': BOAT_PLATFORM,
    'decor/ams/secret-hatch': HATCH_TWIN,
  },
});
