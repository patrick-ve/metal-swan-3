/**
 * ams2-c1 BRUG (docs/design/ams2.md §3; the contract: docs/design/ams2-contract.md), golden light: the
 * white wooden Amstel bridge (deck y 152 over the water 60–860, its ramp down 760–860), the quay
 * of Waterlooplein, the Blauwbrug (1020–1220) and the first market stall. Same play as `ams`.
 */
import type { DecorDef, SectionDef } from '../../../mission/index';
import { sectionC1 as base } from '../ams/section-c1';
import { C_AMSTEL, C_BLAUWBRUG, C_BRIDGE_Y, C1_W } from '../ams/terrain';
import { hillY } from '../ams/art';
import { BANK, BANK_CROWN_Y, BANK_TREES, BANK_W, BANK_WATER, bankCrown, CRATE_OVERRIDES, FAR, id, L, layExact, PILE, quayEnd, riverLayers, SURFACE_800, tiles } from './art-c';
import { BLAUW_BACK, BLAUW_FACE, BLAUW_LAMP, C1_BRIDGE, C1_FOOT_FRONT, C1_FOOT_FRONT_X, HOIST_TWIN, STALL_IDS, WHITE_PORTAL } from './art-c1';
import { TOUR_NPC, TOUR_NPC_TURN } from './art-c2';
import { birdsDecor, cloudsDecor, crownArt, farDecor, perchLamp, trunkArt } from './scene';
import { atWorld, atBand, bandEnd, bandX, defineFloor, G, hitProp, keepClear, kerbPosts, mover, placeBand, postRow, S_BACK, S_MID, S_NEAR, skyBackground, stageSection, waterCut } from './stage';

const W = C1_W;
const [BB_X, BB_LEN, BB_H] = C_BLAUWBRUG;
const PLAN = defineFloor({ light: L, name: 'c1', seed: 331, far: 'pave', walk: 'cobble', near: 'lane' });
const QUAY = C_AMSTEL[1];
/** The canal under the Blauwbrug: the far and near planes show it, the road goes over it. */
const CANAL = waterCut(PLAN, L, 'blauw', BB_X + 14, BB_X + BB_LEN - 14);
keepClear(PLAN, 0, QUAY + 40);
keepClear(PLAN, BB_X - 8, BB_X + BB_LEN + 8);

const [farA, farB] = [bandX(QUAY, S_BACK), bandEnd(W, S_BACK)];
const [nearA, nearB] = [bandX(QUAY, S_NEAR), bandEnd(W, S_NEAR)];
const lastWhole = (a: number, b: number): number => a + Math.floor((b - a) / 256) * 256;
const farPosts = kerbPosts(PLAN, L, 'far', postRow(PLAN, 'far', farA + 8, 40, W).filter((x) => x + 10 < lastWhole(farA, farB)));
const nearPosts = kerbPosts(PLAN, L, 'near', postRow(PLAN, 'near', nearA + 30, 96, W).filter((x) => x + 10 < lastWhole(nearA, nearB)));

const river = riverLayers(W);
const BACK_FEET = 161;
/** The bank's tile starts further along than in section c: other houses come by. */
const BANK_SHIFT = -420;

const props = {
  lamp: id('lamp-72'),
  bench: id('bench'),
  bikeNavy: id('bike-navy'),
  bikeRed: id('bike-dred'),
  bikeGreen: id('bike-dgreen'),
  planter: id('planter'),
  tulips: id('tulips'),
  pole: id('flag-pole-76'),
  pole78: id('flag-pole-78'),
  flagNl: id('flag-nl'),
  flagCity: id('flag-city'),
  bin: id('waste-bin'),
  crate: id('crate'),
};

const TREES: readonly number[] = [962];

const quayProps: DecorDef[] = [
  ...TREES.map((x) => atWorld(trunkArt(L, 900 + x), x - 22, 160, S_BACK)),
  ...TREES.map((x) => atWorld(crownArt(L, 900 + x), x - 60, 8, S_BACK, { animate: 20 })),
  atWorld(props.bench, 975, BACK_FEET, S_BACK),
  atWorld(props.bikeNavy, 890, BACK_FEET, S_BACK),
  atWorld(props.bikeRed, 925, BACK_FEET, S_BACK),
  atWorld(props.bin, 874, BACK_FEET, S_BACK),
  atWorld(STALL_IDS[0], 1244, BACK_FEET, S_BACK),
  atWorld(STALL_IDS[1], 1310, BACK_FEET, S_BACK),
  atWorld(props.crate, 1296, BACK_FEET, S_BACK),
  atWorld(props.pole, 1380, BACK_FEET, S_BACK),
  atWorld(props.flagNl, 1383, BACK_FEET - 51, S_BACK, { animate: 11 }),
];

/** The deck line at a world x of the hill. */
const road = (x: number): number => G + hillY(x - BB_X, BB_LEN, BB_H);

const decor: DecorDef[] = [
  ...cloudsDecor(L, 261),
  ...birdsDecor(L, 100, 26, 0.14, W),
  ...farDecor(FAR, W),
  ...tiles(BANK, BANK_SHIFT, bandEnd(W, S_MID)),
  ...tiles(BANK_WATER, BANK_SHIFT, bandEnd(W, S_MID)),
  ...mover(id('tour-boat'), S_MID, 300, 116, 0.11, BANK_W, W, 1),
  ...mover(id('far-cyclist-navy'), S_MID, 120, 88, -0.26, BANK_W, W, 8),
  ...[0, 1].flatMap((k) => BANK_TREES.map((tx, i) => atBand(bankCrown(tx), BANK_SHIFT + k * BANK_W + (i % 2 ? tx + 28 : tx - 28), BANK_CROWN_Y, S_MID, { animate: 20, flipX: i % 2 === 1 }))),
  ...river.far,
  ...river.walk,
  ...river.near,
  ...layExact(PLAN, 'far', farA, farB),
  ...layExact(PLAN, 'walk', QUAY, W),
  ...layExact(PLAN, 'near', nearA, nearB),
  ...quayEnd(QUAY, 'l'),
  ...CANAL.back,
  ...farPosts,
  ...quayProps,
  ...placeBand(C1_BRIDGE, 0),
  ...[300, 520].map((x) => hitProp(WHITE_PORTAL, x, C_BRIDGE_Y + 2)),
  perchLamp(L, 920),
  ...placeBand(BLAUW_BACK, BB_X - 4),
  hitProp(BLAUW_LAMP, BB_X + 12 - 11, Math.round(road(BB_X + 12)) - 1),
  hitProp(BLAUW_LAMP, BB_X + BB_LEN - 12 - 11, Math.round(road(BB_X + BB_LEN - 12)) - 1),
  hitProp(props.pole78, BB_X + 100 - 2, Math.round(road(BB_X + 100)) - 3),
  hitProp(props.flagCity, BB_X + 101, Math.round(road(BB_X + 100)) - 3 - 53, { animate: 9 }),
  ...tiles(SURFACE_800, C_AMSTEL[0], C_AMSTEL[1], { front: true }),
  ...placeBand(C1_FOOT_FRONT, C1_FOOT_FRONT_X, { front: true }),
  ...placeBand(BLAUW_FACE, BB_X - 4, { front: true }),
  // Pile tops on the near plane: the Amstel is deep and close.
  ...[190, 480, 740].map((x) => atWorld(PILE, x, 197, S_NEAR, { front: true })),
  ...nearPosts,
  atWorld(props.bikeGreen, 1320, 214, S_NEAR, { front: true }),
];

export const sectionC1: SectionDef = stageSection(base, {
  background: skyBackground(L, 261),
  decor,
  overrides: {
    ...CRATE_OVERRIDES,
    'npc/ams/ams-tour-boat': TOUR_NPC,
    'npc/ams/ams-tour-boat/turn': TOUR_NPC_TURN,
    'decor/ams/secret-hoist': HOIST_TWIN,
  },
});
