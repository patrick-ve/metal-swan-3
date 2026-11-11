/**
 * ams2-c AMSTEL (docs/design/ams2.md §3; the contract: docs/design/ams2-contract.md), golden light.
 * Quay of planks before the canal (0–600), the canal with six houseboats on their collision numbers
 * (600–1400), the shop quay with the scan car arena at its end (1400–2448), the fork: the white
 * bridge's ramp up, the jetty steps down to the pontoon. Same script, terrain, exits and checkpoints as `ams`.
 */
import type { DecorDef, SectionDef } from '../../../mission/index';
import { sectionC as base } from '../ams/section-c';
import { C_ARENA, C_BOATS, C_CANAL, C_DECK_Y, C_PONTOON_Y, C_RAMP, C_STEPS_X, C_W } from '../ams/terrain';
import { C_SIGN_BRUG_X } from '../ams/section-c';
import {
  BANK,
  BANK_CROWN_Y,
  BANK_TREES,
  BANK_W,
  BANK_WATER,
  bankCrown,
  BAY_MARK,
  BOAT_PLATFORM,
  BUOY_POST,
  C_LOW_BOATS,
  CANAL_BIKE_TWIN,
  CARGO,
  CAT,
  CLEAT,
  CRATE_OVERRIDES,
  EMPTY,
  FAR,
  HERRING_TWIN,
  id,
  L,
  layExact,
  MARKET_TWIN,
  METER,
  MOORED,
  MOORED_FEET,
  mooredId,
  mooredSmoke,
  PARK_SIGN,
  PILE,
  PILE_LOW,
  PILE_Y,
  plankBand,
  quayEnd,
  riverLayers,
  ROPE,
  routeSign,
  SHOP_ROW,
  shopWindow,
  SURFACE_800,
  tiles,
  WAVER,
} from './art-c';
import { FORK_BRIDGE, FORK_STAIR, FORK_STAIR_X, FORK_STAIR_Y, FORK_X, PONTOON, WHITE_PORTAL } from './art-c1';
import { CRUISE_TWIN, DOLPHIN, TOUR_X } from './art-c2';
import { birdsDecor, cloudsDecor, crownArt, farDecor, perchLamp, repeatAlong, trunkArt } from './scene';
import { atBand, atWorld, bandTiles, bandX, defineFloor, hitProp, HIT_FOOT, keepClear, kerbPosts, mover, placeBand, postRow, S_BACK, S_MID, S_NEAR, skyBackground, stageSection, TILE_W } from './stage';

const W = C_W;
const JETTY = plankBand('c/jetty', C_CANAL[0], 271, { right: true });

/** The shop quay's floor: from the canal's end to the jetty steps. */
const PLAN = defineFloor({ light: L, name: 'c', seed: 291, far: 'pave', walk: 'cobble', near: 'lane' });
const QUAY_FROM = C_CANAL[1];
const QUAY_TO = C_STEPS_X;

const range = (s: number): readonly [number, number] => [bandX(QUAY_FROM, s), bandX(QUAY_TO, s)];
const [farA, farB] = range(S_BACK);
const [nearA, nearB] = range(S_NEAR);
keepClear(PLAN, 0, QUAY_FROM + 24);
keepClear(PLAN, QUAY_TO - 64, W);

const lastWhole = (a: number, b: number): number => a + Math.floor((b - a) / TILE_W) * TILE_W;
const farPosts = kerbPosts(PLAN, L, 'far', postRow(PLAN, 'far', farA + 6, 44, W).filter((x) => x + 10 < lastWhole(farA, farB)));
const nearPosts = kerbPosts(PLAN, L, 'near', postRow(PLAN, 'near', nearA + 20, 92, W).filter((x) => x + 10 < lastWhole(nearA, nearB)));

const river = riverLayers(W);
const BACK_FEET = 161;

const props = {
  lamp: id('lamp-72'),
  bench: id('bench'),
  bikeNavy: id('bike-navy'),
  bikeRed: id('bike-dred'),
  bikeGreen: id('bike-dgreen'),
  planter: id('planter'),
  tulips: id('tulips'),
  pole: id('flag-pole-76'),
  flagNl: id('flag-nl'),
  flagCity: id('flag-city'),
  bin: id('waste-bin'),
  rack: id('bike-rack'),
  smoke: id('smoke'),
};

/** What stands on the far pavement of the shop quay: world x, by the numbers of `ams` where it has them. */
const shopProps: DecorDef[] = [
  ...[1480, 1760, 2250].map((x) => atWorld(props.lamp, x - 8, BACK_FEET, S_BACK)),
  ...[1530, 1980, 2180].map((x) => atWorld(props.bench, x, BACK_FEET, S_BACK)),
  atWorld(props.bikeNavy, 1640, BACK_FEET, S_BACK),
  atWorld(props.bikeRed, 1672, BACK_FEET, S_BACK),
  atWorld(props.bikeGreen, 1910, BACK_FEET, S_BACK),
  atWorld(props.bikeNavy, 2086, BACK_FEET, S_BACK),
  ...[1600, 2120].map((x) => atWorld(props.planter, x, BACK_FEET, S_BACK)),
  ...[1600, 2120].map((x, i) => atWorld(props.tulips, x, BACK_FEET - 9, S_BACK, { animate: 30, frame: i })),
  atWorld(props.pole, 1880, BACK_FEET, S_BACK),
  atWorld(props.flagNl, 1883, BACK_FEET - 51, S_BACK, { animate: 8 }),
  atWorld(props.pole, 2330, BACK_FEET, S_BACK),
  atWorld(props.flagCity, 2333, BACK_FEET - 51, S_BACK, { animate: 9 }),
  atWorld(props.bin, 1450, BACK_FEET, S_BACK),
  atWorld(props.bin, 2040, BACK_FEET, S_BACK),
  atWorld(props.rack, 1700, BACK_FEET, S_BACK),
  atWorld(PARK_SIGN, 2050, BACK_FEET, S_BACK),
  atWorld(METER, 2262, BACK_FEET, S_BACK),
];

const SHOP_TREES: readonly number[] = [1820, 2210];
const shopTrees: DecorDef[] = [
  ...SHOP_TREES.map((x) => atWorld(trunkArt(L, x), x - 22, 160, S_BACK)),
  ...SHOP_TREES.map((x) => atWorld(crownArt(L, x), x - 60, 8, S_BACK, { animate: 20 })),
];

/** The wavers in the windows of the row: at the row's speed. The waver of the shared script draws nothing here. */
const window0 = (k: number, i: number, j: number, sprite: string, ticks: number, frame = 0): DecorDef => {
  const [x, y] = shopWindow(k, i, j);
  return atBand(sprite, farA + x, y, S_BACK, { animate: ticks, frame });
};
const wavers: DecorDef[] = [window0(2, 1, 1, WAVER, 18), window0(5, 1, 0, CAT, 16), window0(9, 0, 2, WAVER, 18, 8)];

const jetty: DecorDef[] = [
  ...[30, 140, 250, 360, 470, 580].map((x) => hitProp(PILE, x, PILE_Y)),
  perchLamp(L, 170),
  hitProp(props.planter, 196, HIT_FOOT),
  hitProp(props.tulips, 196, HIT_FOOT - 9, { animate: 30 }),
  hitProp(CARGO, 300, HIT_FOOT + 1),
  hitProp(props.bench, 382, HIT_FOOT),
  hitProp(props.pole, 430, HIT_FOOT),
  hitProp(props.flagCity, 433, HIT_FOOT - 51, { animate: 8 }),
  // The lamp a gull sleeps on (the rusty bike of the secret leans on it).
  perchLamp(L, 520),
  hitProp(ROPE, 546, HIT_FOOT + 3),
  hitProp(CLEAT, 562, HIT_FOOT + 2),
  hitProp(BUOY_POST, C_CANAL[0] - 24, HIT_FOOT + 1),
];

/** The six houseboats: at speed 1, at their platforms' numbers. A low pile beside each stern. */
const boats: DecorDef[] = [
  ...C_BOATS.map((b) => hitProp(PILE_LOW, b.x0 + b.w + 14, 156)),
  ...C_LOW_BOATS.map((b) => hitProp(b.id, b.x, b.y)),
];

const smoke: DecorDef[] = [
  hitProp(props.smoke, C_BOATS[0].cx + C_BOATS[0].cw - 12, 122, { animate: 9 }),
  hitProp(props.smoke, C_BOATS[2].cx + 4, 122, { animate: 9, frame: 3 }),
];

const fork: DecorDef[] = [
  hitProp(routeSign('BRUG', 'up'), C_SIGN_BRUG_X - 18, HIT_FOOT + 1),
  // Left of the other sign, not behind the ramp: the rail and the figures on the ramp would hide it.
  hitProp(routeSign('RONDVAART', 'down'), C_SIGN_BRUG_X - 18 - 62, HIT_FOOT + 1),
];

const decor: DecorDef[] = [
  ...cloudsDecor(L, 221),
  ...birdsDecor(L, 100, 26, 0.14, W),
  ...farDecor(FAR, W),
  ...bandTiles(BANK, W),
  ...bandTiles(BANK_WATER, W),
  ...mover(id('tour-boat'), S_MID, 120, 116, -0.13, BANK_W, W, 1),
  ...mover(id('far-cyclist-dgreen'), S_MID, 60, 88, 0.3, BANK_W, W, 8),
  ...repeatAlong(BANK_TREES.map((tx, i) => atBand(bankCrown(tx), i % 2 ? tx + 28 : tx - 28, BANK_CROWN_Y, S_MID, { animate: 20, flipX: i % 2 === 1 })), BANK_W, S_MID, W),
  ...river.far,
  ...[740, 1110, 1330].map((x) => atWorld(DOLPHIN, x, 168, S_BACK)),
  ...MOORED.flatMap(([x, w], i): DecorDef[] => {
    const [sx, sy] = mooredSmoke(w);
    return [atBand(mooredId(i), x, MOORED_FEET, S_BACK, { animate: 40, frame: i }), atBand(props.smoke, x + sx, sy, S_BACK, { animate: 9, frame: i * 2 })];
  }),
  ...placeBand(SHOP_ROW, farA),
  ...river.walk,
  ...river.near,
  ...layExact(PLAN, 'far', farA, farB),
  ...layExact(PLAN, 'walk', QUAY_FROM, QUAY_TO),
  ...layExact(PLAN, 'near', nearA, nearB),
  ...quayEnd(QUAY_FROM, 'l'),
  ...quayEnd(QUAY_TO, 'r'),
  ...wavers,
  // The arena: the bays the scan car checks.
  ...[C_ARENA[0] + 20, C_ARENA[0] + 76, C_ARENA[0] + 132, C_ARENA[0] + 188, C_ARENA[0] + 244, C_ARENA[0] + 300].map((x) => hitProp(BAY_MARK, x, 167)),
  ...farPosts,
  ...shopTrees.slice(0, SHOP_TREES.length),
  ...shopProps,
  ...shopTrees.slice(SHOP_TREES.length),
  ...placeBand(JETTY, 0),
  ...jetty,
  ...boats,
  ...smoke,
  perchLamp(L, 2000),
  ...fork,
  hitProp(CRUISE_TWIN, TOUR_X, C_PONTOON_Y - 2),
  ...placeBand(FORK_BRIDGE, FORK_X),
  hitProp(FORK_STAIR, FORK_STAIR_X, FORK_STAIR_Y),
  hitProp(WHITE_PORTAL, C_RAMP[1] + 104, C_DECK_Y + 2),
  ...PONTOON,
  ...tiles(SURFACE_800, C_CANAL[0], C_CANAL[1], { front: true }),
  // Pile tops on the near plane: the canal is deep and close.
  ...[690, 980, 1290].map((x) => atWorld(PILE, x, 197, S_NEAR, { front: true })),
  ...nearPosts,
  ...[1540, 1820, 2200].flatMap((x, i): DecorDef[] => [atWorld(props.rack, x, 215, S_NEAR, { front: true }), atWorld([props.bikeNavy, props.bikeRed, props.bikeGreen][i], x - 8, 214, S_NEAR, { front: true })]),
];

export const sectionC: SectionDef = stageSection(base, {
  background: skyBackground(L, 221),
  decor,
  overrides: {
    ...CRATE_OVERRIDES,
    'decor/ams/ams-boat-platform': BOAT_PLATFORM,
    'decor/ams/ams-herring-cart': HERRING_TWIN,
    'decor/ams/ams-market-stall': MARKET_TWIN,
    'decor/ams/secret-canal-bike': CANAL_BIKE_TWIN,
    'npc/ams/ams-window-waver/person': EMPTY,
    'npc/ams/ams-window-waver/lean': EMPTY,
    'npc/ams/ams-window-waver/cat-swish': EMPTY,
  },
});
