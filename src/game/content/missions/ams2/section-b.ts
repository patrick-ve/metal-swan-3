/**
 * ams2-b MUSEUMPLEIN (docs/design/ams2.md §3; the contract: docs/design/ams2-contract.md): the street to
 * the museum, THE PASSAGE under the museum's gate (the terrain's solid ceiling is its lintel), the lawn with
 * its long pool and the hot-dog wagon, the canal-side road to the exit. Script, terrain and exits: `ams`.
 */
import type { DecorDef, SectionDef } from '../../../mission/index';
import { sectionB as base } from '../ams/section-b';
import { B_HOTDOG_X, B_PASSAGE, B_W, G } from '../ams/terrain';
import { FOUNTAIN, FOUNTAINS, LAWN, LAWN_CROWN, LAWN_TREES, LAWN_W, lawnCrownId, MUSEUM, PLEIN_FAR, PLEIN_FAR_X, POOL, S_LAWN } from './art-b';
import { GATE, GATE_X, MOUTH_PIER, PASSAGE_FLOOR, PIER_FOOT } from './art-b-gate';
import { CRATE_BREAK_TWIN, CRATE_HIT_TWIN, CRATE_TWIN, FINGER_POST, HERRING_CART, ICE_CART, MUSEUM_CRATE, NOTICE, POSTCARDS, POWER_BOX, ROOF_FLAG, SANDWICH_BOARD, STAND, STAND_TICKETS, TERRACE, TULIP_STALL, VENDOR_TWINS } from './art-b-props';
import { NEAR_CANAL, QUAY_END, ROAD, ROAD_SEAM, ROAD_X, SLOOP } from './art-b-road';
import { birdsDecor, cloudsDecor, crownArt, defineFarBand, farDecor, perchLamp, trunkArt } from './scene';
import { artId, atBand, atWorld, B2, bandEnd, bandTiles, bandX, defineFloor, hitProp, HIT_FOOT, kerbPosts, keepClear, mover, placeBand, postRow, S_BACK, S_NEAR, skyBackground, stageSection, TILE_W, VH, type Band } from './stage';

const L = 'noon';
const W = B_W;
const id = (name: string): string => artId(L, name);

/** Where the plein ends and the canal-side road starts. */
const ROAD_FROM = 2200;

const FAR = defineFarBand(L, 'b/far', 131, 100, [
  [60, 56],
  [430, 46],
]);

const PLEIN = defineFloor({ light: L, name: 'b', seed: 161, walk: 'gravel', near: 'pave' });
const ROAD_FLOOR = defineFloor({ light: L, name: 'b-road', seed: 191, far: 'none', walk: 'cobble', near: 'water' });

keepClear(PLEIN, GATE_X, GATE_X + 408);
const NEAR_POSTS_TO = W;

/** The tiles of a band laid from world x `from` on (band x on its plane), starting there and not on a tile's edge. */
function tilesFrom(b: Band, from: number, to: number, o: { front?: boolean } = {}): DecorDef[] {
  const out: DecorDef[] = [];
  for (let k = 0, x = from; x < to; k++, x += TILE_W) {
    const d: DecorDef = { sprite: b.id, frame: k % b.tiles, x, y: b.y, parallax: b.speed };
    if (o.front) d.front = true;
    if (b.anim > 1) {
      d.animate = b.tpf;
      d.animStep = b.tiles;
    }
    out.push(d);
  }
  return out;
}

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
  flagCity: id('flag-city'),
  flagNl: id('flag-nl'),
  bin: id('waste-bin'),
  rack: id('bike-rack'),
  crate: id('crate'),
};

/** The feet line of the back plane's props (their lowest row is 160). */
const BACK_FEET = 161;

const planter = (x: number, frame = 0): DecorDef[] => [atBand(props.planter, x, BACK_FEET, S_BACK), atBand(props.tulips, x, 152, S_BACK, { animate: 30, frame })];
const flag = (x: number, sprite: string, ticks: number): DecorDef[] => [atBand(props.pole, x, BACK_FEET, S_BACK), atBand(sprite, x + 3, 84 + 26, S_BACK, { animate: ticks })];

/** An elm on the back plane at band x: four crowns, each also mirrored, so no two in a row look the same. */
const ELMS = [824, 1420, 620, 1176] as const;
const elm = (x: number, i: number): DecorDef[] => {
  const k = i % ELMS.length;
  // A mirrored sprite stands to the left of its x.
  const flipX = i >= ELMS.length;
  return [atBand(trunkArt(L, 800 + ELMS[k]), x - 22, 159, S_BACK), atBand(crownArt(L, 800 + ELMS[k], 120, 118), flipX ? x + 60 : x - 60, 8, S_BACK, { animate: 20, flipX })];
};

const backProps: DecorDef[] = [
  // The street to the museum: the reference's composition.
  ...elm(24, 2),
  atBand(props.bikeNavy, 62, BACK_FEET, S_BACK),
  atBand(props.bin, 134, BACK_FEET, S_BACK),
  ...flag(164, props.flagCity, 8),
  atBand(STAND_TICKETS, 190, 163, S_BACK),
  ...planter(278, 1),
  atBand(props.bench, 314, BACK_FEET, S_BACK),
  // The plein, from the numbers of `ams` (they stand at these world xs as these pass the screen's centre).
  ...elm(bandX(820, S_BACK), 3),
  atBand(props.rack, bandX(760, S_BACK), BACK_FEET, S_BACK),
  atBand(NOTICE, bandX(860, S_BACK), BACK_FEET, S_BACK),
  ...planter(bandX(925, S_BACK), 2),
  // Clear of the small lamp beside the wagon: that lamp passes band x 922 … 968 while it is on screen.
  atBand(props.bin, bandX(1084, S_BACK), BACK_FEET, S_BACK),
  atBand(props.bikeRed, bandX(1112, S_BACK), BACK_FEET, S_BACK),
  atBand(props.bikeGreen, bandX(1142, S_BACK), BACK_FEET, S_BACK),
  ...elm(bandX(1180, S_BACK), 5),
  atBand(props.bench, bandX(1236, S_BACK), BACK_FEET, S_BACK),
  ...flag(bandX(1290, S_BACK), props.flagCity, 9),
  ...flag(bandX(1330, S_BACK), props.flagNl, 10),
  atBand(ICE_CART, bandX(1390, S_BACK), 163, S_BACK),
  atBand(POSTCARDS, bandX(1450, S_BACK), BACK_FEET, S_BACK),
  ...elm(bandX(1500, S_BACK), 0),
  atBand(TERRACE, bandX(1544, S_BACK), BACK_FEET, S_BACK),
  ...planter(bandX(1600, S_BACK), 3),
  atBand(props.bench, bandX(1660, S_BACK), BACK_FEET, S_BACK),
  atBand(props.bin, bandX(1700, S_BACK), BACK_FEET, S_BACK),
  atBand(props.rack, bandX(1742, S_BACK), BACK_FEET, S_BACK),
  atBand(props.bikeNavy, bandX(1780, S_BACK), BACK_FEET, S_BACK),
  ...elm(bandX(1860, S_BACK), 6),
  atBand(NOTICE, bandX(1912, S_BACK), BACK_FEET, S_BACK),
  atBand(props.lamp, bandX(1960, S_BACK) - 8, BACK_FEET, S_BACK),
  atBand(FINGER_POST, bandX(2004, S_BACK), BACK_FEET, S_BACK),
  ...planter(bandX(2050, S_BACK), 1),
  atBand(props.bench, bandX(2090, S_BACK), BACK_FEET, S_BACK),
  ...elm(bandX(2150, S_BACK), 7),
  // The canal-side road: under the houses, on the far pavement.
  atBand(props.bikeRed, bandX(2262, S_BACK), BACK_FEET, S_BACK),
  atBand(props.bin, bandX(2378, S_BACK), BACK_FEET, S_BACK),
  atBand(props.rack, bandX(2430, S_BACK), BACK_FEET, S_BACK),
  atBand(props.crate, bandX(2500, S_BACK), BACK_FEET, S_BACK),
  ...planter(bandX(2560, S_BACK), 2),
  atBand(TERRACE, bandX(2622, S_BACK), BACK_FEET, S_BACK),
  atBand(props.bikeNavy, bandX(2680, S_BACK), BACK_FEET, S_BACK),
  atBand(SANDWICH_BOARD, bandX(2776, S_BACK), BACK_FEET, S_BACK),
  atBand(props.bench, bandX(2800, S_BACK), BACK_FEET, S_BACK),
  atBand(props.bin, bandX(2850, S_BACK), BACK_FEET, S_BACK),
  atBand(props.bikeGreen, bandX(2900, S_BACK), BACK_FEET, S_BACK),
  atBand(props.lamp, bandX(2940, S_BACK) - 8, BACK_FEET, S_BACK),
  ...planter(bandX(2990, S_BACK), 0),
];

const farPosts = kerbPosts(PLEIN, L, 'far', postRow(PLEIN, 'far', 60, 66, W));
const nearPosts = kerbPosts(PLEIN, L, 'near', postRow(PLEIN, 'near', 120, 170, NEAR_POSTS_TO));

/** A rack with two bikes on the near pavement: all of it under the figures' feet. */
const NEAR_Y = VH;
const nearRack = (wx: number, b0: string, b1: string, gap = 18): DecorDef[] => [
  atWorld(props.rack, wx, NEAR_Y, S_NEAR, { front: true }),
  atWorld(b0, wx - 6, NEAR_Y, S_NEAR, { front: true }),
  atWorld(b1, wx - 6 + gap, NEAR_Y, S_NEAR, { front: true }),
];

/** What stands at speed 1: the lamps a gull sleeps on, the gate, the wagon and what belongs to it. */
const STAND_X = B_HOTDOG_X - 8;
const STAND_FOOT = 168;
const standBack: DecorDef[] = [
  hitProp(POWER_BOX, B_HOTDOG_X + 68, STAND_FOOT + 1),
  hitProp(id('lamp-38'), B_HOTDOG_X + 88, STAND_FOOT + 1),
  hitProp(STAND, STAND_X, STAND_FOOT),
  hitProp(ROOF_FLAG, B_HOTDOG_X + 54, G - 57 + 6, { animate: 8 }),
];

const canalBandFrom = bandX(ROAD_FROM, S_NEAR);

const decor: DecorDef[] = [
  ...cloudsDecor(L, 121),
  ...birdsDecor(L, 200, 22, 0.1, W),
  ...farDecor(FAR, W),
  ...placeBand(MUSEUM, 0),
  ...placeBand(PLEIN_FAR, PLEIN_FAR_X),
  ...placeBand(LAWN, 0),
  ...placeBand(POOL, 0),
  // Small far cyclists on the path along the pools.
  ...mover(id('far-cyclist-navy'), S_LAWN, 60, 112, 0.22, LAWN_W, W, 8),
  ...mover(id('far-cyclist-dred'), S_LAWN, 700, 112, -0.18, LAWN_W, W, 8),
  ...LAWN_TREES.map((x, i) => atBand(lawnCrownId(i), x - (LAWN_CROWN[0] >> 1), 138 - LAWN_CROWN[1] - 12, S_LAWN, { animate: 20 })),
  ...FOUNTAINS.map((x, i) => atBand(FOUNTAIN, x - 9, 142, S_LAWN, { animate: 9, frame: i })),
  ...bandTiles(PLEIN.far, W),
  // The canal road's house row stands on the far pavement's top edge: under the posts' heads.
  ...placeBand(ROAD, ROAD_X),
  ...bandTiles(PLEIN.walk, W, { to: ROAD_FROM }),
  ...tilesFrom(ROAD_FLOOR.walk, ROAD_FROM, W),
  hitProp(ROAD_SEAM, ROAD_FROM - 4, B2),
  ...placeBand(PASSAGE_FLOOR, B_PASSAGE[0]),
  ...bandTiles(PLEIN.near, W),
  ...tilesFrom(NEAR_CANAL, canalBandFrom, bandEnd(W, S_NEAR)),
  atBand(QUAY_END, canalBandFrom - 7, 216, S_NEAR),
  atBand(SLOOP, bandX(2460, S_NEAR), 197, S_NEAR, { animate: 40 }),
  atBand(SLOOP, bandX(2880, S_NEAR), 198, S_NEAR, { animate: 40, frame: 2 }),
  ...farPosts,
  ...backProps,
  ...placeBand(GATE, GATE_X),
  hitProp(MOUTH_PIER, B_PASSAGE[0] - 9, PIER_FOOT),
  hitProp(MOUTH_PIER, B_PASSAGE[1] - 9, PIER_FOOT),
  perchLamp(L, 110),
  ...standBack,
  perchLamp(L, 2300),
  perchLamp(L, 2620),
  hitProp(props.pole, 2760, HIT_FOOT + 1),
  hitProp(props.flagCity, 2763, HIT_FOOT - 50, { animate: 8 }),
  // The racks on the near pavement, from the numbers of `ams` and two more on the plein; the canal road has no near pavement.
  atWorld(props.bin, 26, NEAR_Y, S_NEAR, { front: true }),
  atWorld(props.bikeGreen, 128, NEAR_Y, S_NEAR, { front: true }),
  atWorld(props.bin, 476, NEAR_Y, S_NEAR, { front: true }),
  ...nearRack(290, props.bikeNavy, props.bikeRed),
  atWorld(props.bikeGreen, 590, NEAR_Y, S_NEAR, { front: true }),
  ...nearRack(1340, props.bikeGreen, props.bikeNavy, 26),
  ...nearRack(1900, props.bikeRed, props.bikeRed, 44),
  ...nearPosts,
];

export const sectionB: SectionDef = stageSection(base, {
  background: skyBackground(L, 121),
  decor,
  overrides: {
    'decor/ams/ams-tulip-stall': TULIP_STALL,
    'decor/ams/ams-herring-cart': HERRING_CART,
    'decor/ams/secret-museum-crate': MUSEUM_CRATE,
    'item/crate': CRATE_TWIN,
    'item/crate-hit': CRATE_HIT_TWIN,
    'item/crate-break': CRATE_BREAK_TWIN,
    ...VENDOR_TWINS,
  },
});
