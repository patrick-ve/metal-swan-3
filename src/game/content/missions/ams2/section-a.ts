/**
 * ams2-a GRACHTENGORDEL (docs/design/ams2.md §3; the contract: docs/design/ams2-contract.md), the whole
 * width: the quay street, bridge 1, the raised drawbridge and the side canal with its houseboats, the
 * PLEINTJE, the shopping street with awnings, ledges and the golden record, bridge 2, the arrival and
 * FABEL FRIET. Script, terrain, exits and timers are those of `ams`; every number comes from `ams/terrain.ts`.
 */
import type { DecorDef, SectionDef } from '../../../mission/index';
import { sectionA as base } from '../ams/section-a';
import { A_ARENA, A_BOATS, A_BRIDGES, A_CANAL, A_FABEL_X, A_W, ROOF_Y } from '../ams/terrain';
import { BANK, BANK_W, FAR_TREES, farCrownId, MOORED_BOAT, STAND_ID, WATER } from './art-a';
import { BACK_TOP, BOATS, BRIDGE_BACK, BRIDGE_FACE, BRIDGE_PAD, DRAWBRIDGE, FACE_TOP, QUAY_POST, SMALL_BOAT_TWIN } from './art-a-canal';
import { CRATE_BREAK_TWIN, CRATE_HIT_TWIN, CRATE_TWIN, FLOWER_BUCKETS, HATCH_TWIN, HERRING_TWIN, HOIST_TWIN, ORGAN, pleinFloor, RACK_TWIN, STREET_BOARD, streetKerb, TERRACE, TREE_BIKE_TWIN, TULIP_TWIN, URINAL, WALL_CRATES } from './art-a-props';
import { A_CAT, A_WAVER, AFTER, ARRIVAL, AWNINGS, BALCONY_DECOR, BEAM_DECOR, FABEL_COUNTER, FABEL_DECOR, FABEL_SIGN, houseRowDecor, LEDGE_AWNING, ROW_END_LEFT, STREET, STREET_FOOT, streetWindow } from './art-a-street';
import { EMPTY } from './art-c';
import { birdsDecor, cloudsDecor, crownArt, defineFarBand, farDecor, perchLamp, quayEdge, repeatAlong, trunkArt } from './scene';
import { artId, atBand, atWorld, bandTiles, bandX, defineFloor, G, hitProp, HIT_FOOT, keepClear, kerbPosts, mover, placeBand, postRow, S_BACK, S_MID, S_NEAR, skyBackground, stageSection, waterCut } from './stage';

const L = 'morning';
const W = A_W;

const FAR = defineFarBand(L, 'a/far', 31, 106, [
  [92, 70],
  [372, 52],
]);

export const FLOOR_A = defineFloor({ light: L, name: 'a', seed: 61, farExtra: quayEdge });

/** The stretches, in world x. */
const PLEIN: readonly [number, number] = [1520, 1904];
const STREET_X: readonly [number, number] = [1904, 2596];
const ARRIVAL_X: readonly [number, number] = [2764, W];

// --- water: the side canal, and the water under the two hump bridges. ---
const CANAL_CUT = waterCut(FLOOR_A, L, 'side-canal', A_CANAL[0], A_CANAL[1]);
/** A bridge shows the far and the near band's water; its deck and arch hide the walk band's. */
const bridgeWater = (i: number): DecorDef[] => {
  const [x0, len] = A_BRIDGES[i];
  const cut = waterCut(FLOOR_A, L, `bridge-${i}`, x0, x0 + len);
  return cut.back.filter((d) => !d.sprite.includes('-walk'));
};
const BRIDGE_WATER = [bridgeWater(0), bridgeWater(1)];
for (const [x0, len] of A_BRIDGES) keepClear(FLOOR_A, x0 - 8, x0 + len + 8);

const id = (name: string): string => artId(L, name);

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
  crate: id('crate'),
};

/** The feet line of the back plane's props (their lowest row is 160). */
const BACK_FEET = 161;

/** A prop on the back plane, at the world x it shows at screen centre. */
const back = (sprite: string, wx: number, o: Parameters<typeof atWorld>[4] = {}, y = BACK_FEET): DecorDef => atWorld(sprite, wx, y, S_BACK, o);
/** A tree on the back plane: the crown's seed picks one of three, flipped for more. */
const CROWN_SEEDS = [670, 1030, 1330, 1516];
function backTree(bx: number, i: number): DecorDef[] {
  const seed = CROWN_SEEDS[i % CROWN_SEEDS.length];
  // A flipped sprite mirrors over its anchor: the crown then stands to the left of x.
  const flipX = i >= 3 && i % 2 === 1;
  return [atBand(trunkArt(L, 600 + bx), bx - 22, 160, S_BACK), atBand(crownArt(L, seed), flipX ? bx + 60 : bx - 60, 8, S_BACK, { animate: 20, flipX })];
}

const backTrees: DecorDef[] = [70, 430, 840, 1244, bandX(1440, S_BACK), bandX(1712, S_BACK)].flatMap(backTree);

/** Planter and tulips on the back plane. */
const backPlanter = (wx: number, i: number): DecorDef[] => [back(props.planter, wx), atBand(props.tulips, bandX(wx, S_BACK), 152, S_BACK, { animate: 30, frame: i })];

const backProps: DecorDef[] = [
  // The quay street (band x: as in the reference frames).
  ...[190, 590].map((x) => atBand(props.lamp, x - 8, BACK_FEET, S_BACK)),
  ...[214, 610].map((x) => atBand(props.bench, x, BACK_FEET, S_BACK)),
  atBand(props.bikeNavy, 252, BACK_FEET, S_BACK),
  atBand(props.bikeRed, 290, BACK_FEET, S_BACK),
  atBand(props.bikeNavy, 546, BACK_FEET, S_BACK),
  ...[334].map((x) => atBand(props.planter, x, BACK_FEET, S_BACK)),
  atBand(props.pole, 380, BACK_FEET, S_BACK),
  atBand(STAND_ID, 450, 163, S_BACK),
  ...[150, 636].map((x) => atBand(props.bin, x, BACK_FEET, S_BACK)),
  atBand(props.rack, 406, BACK_FEET, S_BACK),
  atBand(props.tulips, 334, 152, S_BACK, { animate: 30 }),
  atBand(props.flagNl, 383, 84 + 26, S_BACK, { animate: 8 }),
  // Between bridge 1 and the drawbridge.
  back(props.bench, 948),
  back(props.bikeGreen, 990),
  back(props.bin, 912),
  // After the side canal.
  back(props.bikeRed, 1392),
  back(props.rack, 1420),
  ...backPlanter(1476, 1),
  back(URINAL, 1498),
  // The PLEINTJE.
  back(props.lamp, 1540 - 8),
  ...backPlanter(1598, 2),
  back(TERRACE, 1630),
  back(props.bench, 1668),
  back(props.bin, 1698),
  back(TERRACE, 1726),
  back(props.bench, 1770),
  back(props.pole, 1808),
  back(props.flagNl, 1811, { animate: 8 }, 84 + 26),
  back(ORGAN, 1822, { animate: 20 }),
  back(props.lamp, 1876 - 8),
];

// --- the posts: the far row stops before the houses of the shopping street (a post never slides into a wall). ---
const FAR_POSTS_END = bandX(STREET_X[0] - 34, S_BACK);
/** The width of what stands on the back plane and would hide a post half. The first screen stays as approved. */
const POST_HIDERS = new Map<string, number>([
  [props.bench, 42],
  [props.bin, 18],
  [props.planter, 36],
  [TERRACE, 42],
  [ORGAN, 48],
  [URINAL, 32],
]);
const FIRST_SCREEN_END = bandX(720, S_BACK);
const hiddenPost = (x: number): boolean =>
  backProps.some((d) => {
    const w = POST_HIDERS.get(d.sprite);
    return w !== undefined && d.x >= FIRST_SCREEN_END && x + 9 > d.x && x < d.x + w;
  });
const farPosts = kerbPosts(FLOOR_A, L, 'far', postRow(FLOOR_A, 'far', 10, 44, W).filter((x) => x < FAR_POSTS_END && !hiddenPost(x)));
/** The band x of the post that would stand in front of the counter while the camera is locked on FABEL FRIET. */
const COUNTER_POST = 3330 - A_ARENA[0] + A_ARENA[0] * S_NEAR;
const nearPosts = kerbPosts(FLOOR_A, L, 'near', postRow(FLOOR_A, 'near', 60, 92, W).filter((x) => Math.abs(x - COUNTER_POST) > 30));

/** A bridge at speed 1: the part behind the figures. */
const bridgeBack = (x0: number): DecorDef => hitProp(BRIDGE_BACK, x0 - BRIDGE_PAD, BACK_TOP);
const bridgeFace = (x0: number): DecorDef => hitProp(BRIDGE_FACE, x0 - BRIDGE_PAD, FACE_TOP, { front: true });
/** A lamp on a bridge's deck: its top at the gull's perch of the shared script (`G − 14 − 70`, bridge 2 at x 2730). */
const deckLamp = (wx: number): DecorDef => hitProp(props.lamp, wx - 8, 164);

/** A planter with its tulips on the pavement by the houses (speed 1, as the awnings). */
const streetPlanter = (wx: number, i: number): DecorDef[] => [hitProp(props.planter, wx, HIT_FOOT), hitProp(props.tulips, wx, HIT_FOOT - 8, { animate: 30, frame: i })];

/** What a hitbox touches stays at speed 1, and what stands with it. */
const quayHit: DecorDef[] = [
  perchLamp(L, 470),
  hitProp(trunkArt(L, 620), 620 - 22, HIT_FOOT + 1),
  hitProp(crownArt(L, 620), 620 - 60, 22, { animate: 20 }),
  perchLamp(L, 920),
  hitProp(DRAWBRIDGE, 1026 - 38, HIT_FOOT),
  hitProp(QUAY_POST, 1000 - 18, HIT_FOOT + 3),
  hitProp(QUAY_POST, A_CANAL[1] + 4, HIT_FOOT + 3),
  perchLamp(L, 1360),
  ...BOATS.map((b) => hitProp(b.id, b.x, b.y)),
  ...A_BOATS.map((b) => hitProp(id('smoke'), b.cx + b.cw - 7 - 6, ROOF_Y - 10, { animate: true, frame: b.colour })),
];

const streetKerbs = [streetKerb('street', STREET_X[1] - STREET_X[0]), streetKerb('arrival', ARRIVAL_X[1] - ARRIVAL_X[0])];

const streetHit: DecorDef[] = [
  ...placeBand(streetKerbs[0], STREET_X[0]),
  ...placeBand(streetKerbs[1], ARRIVAL_X[0]),
  hitProp(ROW_END_LEFT, STREET_X[0] - 17, STREET_FOOT + 1),
  hitProp(ROW_END_LEFT, ARRIVAL_X[0] - 17, STREET_FOOT + 1),
  ...houseRowDecor(STREET),
  ...AWNINGS,
  LEDGE_AWNING,
  BALCONY_DECOR,
  BEAM_DECOR,
  ...houseRowDecor(ARRIVAL),
  ...FABEL_DECOR,
  ...houseRowDecor(AFTER),
  hitProp(FABEL_SIGN, A_FABEL_X + 86 - 20, 87 - 1, { animate: 24 }),
  // On the pavement by the walls.
  hitProp(FLOWER_BUCKETS, 2000, HIT_FOOT - 1),
  // Clear of the shop names and of what the script spawns here: the tulip stall at 2160, the herring cart at 2470.
  hitProp(props.bikeNavy, 2064, HIT_FOOT - 1),
  ...streetPlanter(2106, 3),
  hitProp(STREET_BOARD, 2190, HIT_FOOT - 1),
  hitProp(props.bikeRed, 2358, HIT_FOOT - 1),
  ...streetPlanter(2400, 4),
  hitProp(WALL_CRATES, 2895, HIT_FOOT - 1),
  hitProp(props.bikeGreen, 2990, HIT_FOOT - 1),
  hitProp(props.bin, 3040, HIT_FOOT - 1),
  ...streetPlanter(A_FABEL_X - 56, 5),
  // Clear of the planter and the flag pole beside it.
  hitProp(props.lamp, 3190 - 8, HIT_FOOT),
  hitProp(id('flag-pole-78'), A_FABEL_X - 30, HIT_FOOT),
  hitProp(props.flagCity, A_FABEL_X - 27, 94, { animate: 10 }),
  hitProp(props.bikeNavy, 3440, HIT_FOOT - 1),
  hitProp(STREET_BOARD, 3380, HIT_FOOT - 1),
];

/** Bikes parked on the front pavement (`ams`: its front racks at 548, 1620, 2860). */
const NEAR_Y = 216;
const frontProps: DecorDef[] = [
  ...[548, 1620, 2860].flatMap((wx, i) => [
    atWorld(props.rack, wx, NEAR_Y, S_NEAR, { front: true }),
    atWorld([props.bikeNavy, props.bikeGreen, props.bikeRed][i], wx - 6, NEAR_Y, S_NEAR, { front: true }),
    // Each pair its own colours and its own gap.
    atWorld([props.bikeRed, props.bikeNavy, props.bikeRed][i], wx - 6 + [18, 30, 42][i], NEAR_Y, S_NEAR, { front: true }),
  ]),
];

/** The figures in real windows of the street: the shared waver has a window of its own that does not fit a facade. */
const wavers: DecorDef[] = [streetWindow('bloemen', 7, A_WAVER, 18), streetWindow('cat', 4, A_CAT, 16), streetWindow('arr-f', 6, A_WAVER, 19, 8)];

const decor: DecorDef[] = [
  ...birdsDecor(L, 0, 30, -0.12, W),
  ...farDecor(FAR, W),
  ...bandTiles(BANK, W),
  ...bandTiles(WATER, W),
  ...repeatAlong(
    [60, 430].map((x, i) => atBand(MOORED_BOAT, x, 124, S_MID, { animate: 40, frame: i })),
    BANK_W,
    S_MID,
    W,
  ),
  ...mover(id('tour-boat'), S_MID, 0, 124, 0.1, BANK_W, W, 1),
  ...mover(id('far-cyclist-dred'), S_MID, 40, 99, 0.34, BANK_W, W, 8),
  ...mover(id('far-cyclist-navy'), S_MID, 320, 99, 0.27, BANK_W, W, 8),
  ...repeatAlong(
    FAR_TREES.map((tx) => atBand(farCrownId(tx), tx - 33, 113 - 74, S_MID, { animate: 20 })),
    BANK_W,
    S_MID,
    W,
  ),
  ...bandTiles(FLOOR_A.far, W),
  ...bandTiles(FLOOR_A.walk, W),
  ...bandTiles(FLOOR_A.near, W),
  ...placeBand(pleinFloor(PLEIN[0], PLEIN[1]), PLEIN[0]),
  ...CANAL_CUT.back,
  ...BRIDGE_WATER.flat(),
  ...farPosts,
  ...backTrees,
  ...backProps,
  ...quayHit,
  bridgeBack(A_BRIDGES[0][0]),
  bridgeBack(A_BRIDGES[1][0]),
  deckLamp(A_BRIDGES[0][0] + 30),
  deckLamp(A_BRIDGES[0][0] + 130),
  deckLamp(A_BRIDGES[1][0] + 30),
  deckLamp(A_BRIDGES[1][0] + 130),
  ...streetHit,
  ...wavers,
  ...CANAL_CUT.front,
  bridgeFace(A_BRIDGES[0][0]),
  bridgeFace(A_BRIDGES[1][0]),
  hitProp(FABEL_COUNTER, 3330, G, { front: true }),
  ...nearPosts,
  ...frontProps,
];

export const sectionA: SectionDef = stageSection(base, {
  background: skyBackground(L, 21),
  decor: [...cloudsDecor(L, 21), ...decor],
  // The twins of what the shared script spawns as scenery.
  overrides: {
    'npc/ams/ams-window-waver/person': EMPTY,
    'npc/ams/ams-window-waver/lean': EMPTY,
    'npc/ams/ams-window-waver/cat-swish': EMPTY,
    'decor/ams/ams-bike-rack': RACK_TWIN,
    'item/crate': CRATE_TWIN,
    'item/crate-hit': CRATE_HIT_TWIN,
    'item/crate-break': CRATE_BREAK_TWIN,
    'decor/ams/ams-boat-platform': SMALL_BOAT_TWIN,
    'decor/ams/ams-herring-cart': HERRING_TWIN,
    'decor/ams/ams-tulip-stall': TULIP_TWIN,
    'decor/ams/secret-hatch': HATCH_TWIN,
    'decor/ams/secret-tree-bike': TREE_BIKE_TWIN,
    'decor/ams/secret-hoist': HOIST_TWIN,
  },
});
