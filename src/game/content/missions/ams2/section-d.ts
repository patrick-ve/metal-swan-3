/**
 * ams2-d STOPERA at sunset (docs/design/ams2.md §3; the contract: docs/design/ams2-contract.md). The
 * play is `ams` section d: the flea market (0 … 896), the arena (896 … 1280), the boss out of the glass
 * doors, the baker and the staff.
 *
 * The camera ends at 896 (the arena's lock), so the plane of the Stopera is laid out from there: the
 * doors' centre stands at screen x 294 at that camera, world x `DOORS_X`. From the left the player
 * passes the curved theatre, the brick wing with its stair tower, a second curved wing and the entrance.
 */
import type { DecorDef, SectionDef } from '../../../mission/index';
import { sectionD as base } from '../ams/section-d';
import { D_ARENA, D_W } from '../ams/terrain';
import {
  blinkWindow,
  BOOK_CART,
  CHAIRS_MIRROR,
  CHEST_TWIN,
  CLOTHES_RAIL,
  CRATE_BREAK_TWIN,
  CRATE_HIT_TWIN,
  CRATE_TWIN,
  DOOR_STEPS,
  LAMP_76,
  LAMP_ON_CRATES,
  RACK_TWIN,
  RECORD_TABLE,
  ROOF_POLE,
  RUG_RACK,
  stallArt,
  STALL_TWIN,
  STOPERA,
} from './art-d';
import { DOOR_BAND_X, S_BLD, WING_WINDOWS } from './art-d-stopera';
import { birdsDecor, cloudsDecor, crownArt, defineFarBand, farDecor, perchLamp, trunkArt } from './scene';
import { artId, atBand, bandTiles, defineFloor, keepClear, kerbPosts, placeBand, postRow, S_BACK, skyBackground, stageSection } from './stage';
import { R } from '../../../art/herokit/palette';
import { rngf } from '../../../art/herokit/rng';
import type { S } from '../../../art/herokit/canvas';

const L = 'sunset';
const W = D_W;
/** The locked camera of the arena: the view's left edge there. */
const LOCK_CAM = D_ARENA[0];

/** Band x on the back plane of a screen x at the locked camera. */
const lockedBack = (screenX: number): number => Math.round(screenX + LOCK_CAM * S_BACK);

/** The feet line of the back plane's props (their lowest row is 160). */
const BACK_FEET = 161;

const FAR = defineFarBand(L, 'd/far', 331, 118, [[120, 68]]);

export const FLOOR_D = defineFloor({ light: L, name: 'd', seed: 351, walk: 'slab', near: 'pave' });

// The steps and the doors stay free of posts. World x of the band span of the steps.
keepClear(FLOOR_D, 1160, 1260);
// Goods stand on these spots of the far row: no post through the cart's wheels, behind the rail, the rugs or a crate.
keepClear(FLOOR_D, 1000, 1016);
keepClear(FLOOR_D, 308, 310);
keepClear(FLOOR_D, 605, 615);
keepClear(FLOOR_D, 705, 715);

const id = (name: string): string => artId(L, name);

/** The sun on the sky, as the reference: seen over the low wing at the locked camera. */
function sun(sk: S): void {
  const [a, b, c] = R.sun;
  sk.use(5, 1);
  sk.ell(c, 278, 40, 16, 16);
  sk.ell(b, 278, 40, 14, 14);
  sk.ell(a, 278, 40, 10, 10);
}

/** A stall of the market with its goods at band x `x`. */
function stallAt(x: number, i: number, w = 60): DecorDef[] {
  const { box, goods } = stallArt(i, w);
  return [atBand(box, x, BACK_FEET, S_BACK), atBand(goods, x + 4, BACK_FEET - 52 + 13, S_BACK, { animate: 30, frame: i % 2 })];
}

/**
 * The back plane of the market: band x along the street. The two breakable stalls (world 200 and 560, band
 * 199 and 516 as they pass the screen centre) stand in the walk plane with no stall right behind them, so
 * they read as the ones to shoot, and their wrecks show the square.
 */
const market: DecorDef[] = [
  ...stallAt(-50, 0),
  ...stallAt(22, 1),
  ...stallAt(96, 2),
  atBand(id('bike-rack'), 222, BACK_FEET, S_BACK),
  atBand(LAMP_76, 250 - 8, BACK_FEET, S_BACK),
  atBand(id('waste-bin'), 258, BACK_FEET, S_BACK),
  atBand(id('crate'), 276, BACK_FEET, S_BACK),
  atBand(id('planter'), 306, BACK_FEET, S_BACK),
  atBand(id('tulips'), 306, 152, S_BACK, { animate: 30 }),
  atBand(id('crate'), 344, BACK_FEET, S_BACK),
  ...stallAt(368, 3),
  ...stallAt(438, 4),
  atBand(CLOTHES_RAIL, 552, BACK_FEET, S_BACK, { animate: 30 }),
  atBand(LAMP_76, 604, BACK_FEET, S_BACK),
  atBand(RUG_RACK, 622, BACK_FEET, S_BACK),
  ...stallAt(670, 5),
  atBand(trunkArt(L, 950), 790 - 22, 160, S_BACK),
  atBand(LAMP_ON_CRATES, 742, BACK_FEET, S_BACK),
  atBand(CHAIRS_MIRROR, 778, BACK_FEET, S_BACK),
  atBand(crownArt(L, 950, 110, 118), 735, 8, S_BACK, { animate: 20 }),
  atBand(RECORD_TABLE, 826, BACK_FEET, S_BACK),
  atBand(BOOK_CART, 878, BACK_FEET, S_BACK),
];

/** The forecourt: calm, so the fight reads. Screen xs at the locked camera. */
const forecourt: DecorDef[] = [
  atBand(LAMP_76, lockedBack(158), BACK_FEET, S_BACK),
  atBand(id('planter'), lockedBack(175), BACK_FEET, S_BACK),
  atBand(id('tulips'), lockedBack(175), 152, S_BACK, { animate: 30, frame: 1 }),
  atBand(DOOR_STEPS, lockedBack(294) - 57, 154, S_BACK),
  atBand(id('flag-pole-76'), lockedBack(204), BACK_FEET, S_BACK),
  atBand(id('flag-nl'), lockedBack(207), 110, S_BACK, { animate: 8 }),
];

/** Three windows of the wing go on and off, as the reference: their spots from its generator. */
const r9 = rngf(9);
const blinks: DecorDef[] = r9.sample(WING_WINDOWS.length, 3).map((q, i) => {
  const [lx, ly] = WING_WINDOWS[q];
  return atBand(blinkWindow(i), 340 + 1 + lx, 150 - 176 + 1 + ly, S_BLD, { animate: (7 + i * 3) * 15, frame: i });
});
// Two more at the arena, so the locked view lives too: the low wing's lower row, the tall block.
blinks.push(atBand(blinkWindow(3, 12, 17), 700 + 1 + 7 + 44, 150 - 176 + 1 + 121, S_BLD, { animate: 190, frame: 1 }));
blinks.push(atBand(blinkWindow(4), DOOR_BAND_X + 58 + 1 + 18, 150 - 176 + 1 + 87, S_BLD, { animate: 150, frame: 2 }));

/** A flag on a roof: its foot on row `y`. */
const roofFlag = (x: number, y: number, flag: string, frame = 0): DecorDef[] => [atBand(ROOF_POLE, x, y, S_BLD), atBand(id(flag), x + 3, y - 40 + 26, S_BLD, { animate: 8, frame })];

const decor: DecorDef[] = [
  ...cloudsDecor(L, 321),
  ...birdsDecor(L, 300, 28, -0.13, W),
  ...farDecor(FAR, W),
  ...placeBand(STOPERA, 0),
  ...blinks,
  ...roofFlag(DOOR_BAND_X + 34, 53, 'flag-city'),
  ...bandTiles(FLOOR_D.far, W),
  ...bandTiles(FLOOR_D.walk, W),
  ...bandTiles(FLOOR_D.near, W),
  ...kerbPosts(FLOOR_D, L, 'far', postRow(FLOOR_D, 'far', 30, 88, W)),
  ...market,
  ...forecourt,
  // The lamp the gull sleeps on: the script's perch, speed 1.
  perchLamp(L, 820),
  ...kerbPosts(FLOOR_D, L, 'near', postRow(FLOOR_D, 'near', 70, 130, W)),
];

export const sectionD: SectionDef = stageSection(base, {
  background: skyBackground(L, 321, { paintOver: sun }),
  decor,
  overrides: {
    'decor/ams/ams-market-stall': STALL_TWIN,
    'decor/ams/ams-bike-rack': RACK_TWIN,
    'decor/ams/secret-chest': CHEST_TWIN,
    'item/crate': CRATE_TWIN,
    'item/crate-hit': CRATE_HIT_TWIN,
    'item/crate-break': CRATE_BREAK_TWIN,
  },
});
