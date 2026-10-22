/**
 * `rf-b` DE BLOKKADE — the layout numbers (docs/design/ring.md §R.6, §R.7; docs/api/ring.md "R.B2"):
 * the A10 at the Zuidas past rf-a's police line, in the same side view (rf-a's road layers moved up
 * by `RF_SHIFT`: the heroes' feet line on the hard shoulder).
 *
 * Left to right: the police van and the police tape with two officers (from rf-a's end), the head
 * of the standing queue (a few cars in the near lane, the far lanes full), then the blockade across
 * the whole road: painted barrels chained together, banners, the activists' lunch table, rows of
 * activists sitting arm in arm on the far lanes, the big spandoek `EXHAUSTING REBELLION` on two poles
 * in the middle lanes, and at the end the pink boat `DE LAATSTE DRUPPEL` on its trailer (the arena,
 * the last screen). Nothing here is solid but the ground and the police van's roof: the barrels and
 * the table are decor the activists walk past (they never get stuck).
 */
import type { RingCarModel } from '../../../ring/ids';
import { carColour } from '../traffic/geometry';
import { POLICE_VAN } from './art-jam';
import { CAR_Y, FAR_LANE_Y } from './layout-rf-a';

/** Section width (px): the blockade (~3,450 px, three locks) and the boat's screen. */
export const RF_B_W = 3840;
/** The boat's arena: the last screen. */
export const RF_B_ARENA_L = RF_B_W - 384;
export const RF_B_ARENA_R = RF_B_W;
/** The boat's anchor (the trailer's middle on the road): its stern ends at the section's end. */
export const RF_B_BOAT_X = RF_B_W - 96;

/** The police van (near lane, facing right like the queue), the tape (its left post) and the officers. */
export const RF_B_VAN_X = 132;
export const RF_B_TAPE_X = 286;
export const RF_B_POLICE_X = 262;

export type RfBCar = { model: RingCarModel; colour: string; x: number };
const car = (model: RingCarModel, colour: number, x: number): RfBCar => ({ model, colour: carColour(model, colour), x });

/** The head of the standing queue in the near lane (left to right; the blockade starts after them). */
export const RF_B_CARS: readonly RfBCar[] = [car('estate', 3, 400), car('hatch', 1, 520)];

/** The far lanes' standing cars end here (the queue's head at the blockade line). */
export const RF_B_QUEUE_END = 880;

/** The police van's roof (a one-way platform: x, feet y, w). */
export const RF_B_PLATFORMS: ReadonlyArray<readonly [number, number, number]> = [[RF_B_VAN_X - 44, CAR_Y - POLICE_VAN.height + 1, 62]];

/** Painted barrels in the walking plane (x, variant 0 sky / 1 orange / 2 green with a chain). */
export const RF_B_BARRELS: ReadonlyArray<readonly [number, number]> = [
  [640, 2],
  [664, 0],
  [1176, 1],
  [1512, 2],
  [1536, 0],
  [2196, 1],
  [2436, 0],
  [2460, 2],
  [2918, 1],
  [2942, 2],
  [3330, 0],
];

/** Chains hanging between barrel pairs (their left barrel's x). */
export const RF_B_CHAINS: readonly number[] = [640, 1512, 2436, 2918];

/** Small banners on sticks in the walking plane (x, the `BANNERS` index). */
export const RF_B_BANNERS: ReadonlyArray<readonly [number, number]> = [
  [740, 0],
  [1250, 3],
  [2050, 1],
  [2560, 2],
  [3060, 0],
];

/** The activists' lunch table (walking plane). */
export const RF_B_PICNIC_X = 1350;

/** The big spandoek in the middle lanes (its middle). */
export const RF_B_SPANDOEK_X = 1900;
export const RF_B_SPANDOEK_Y = FAR_LANE_Y[1];

/** Rows of activists sitting arm in arm across the far lanes (x, lane 0–2, variant): the blockade line. */
export const RF_B_CROWDS: ReadonlyArray<readonly [number, number, number]> = (() => {
  const out: Array<readonly [number, number, number]> = [];
  // The two nearer far lanes (lane 0 borders the median: kept free, the cars stood there).
  for (let lane = 1; lane < 3; lane++) {
    for (let x = 930 + lane * 40, i = 0; x < 3400; x += 104 + ((i * 37 + lane * 11) % 3) * 14, i++) {
      // The spandoek stands on lane 1: nobody sits right behind or under it.
      if (lane < 2 && x > RF_B_SPANDOEK_X - 110 && x < RF_B_SPANDOEK_X + 110) continue;
      // A gap now and then (a lane of the blockade is a little thinner there).
      if ((i * 7 + lane * 3) % 5 === 2) continue;
      out.push([x, lane, (i + lane) % 2]);
    }
  }
  return out;
})();

/** Placards held up over the crowds (x, lane, the `BANNERS` index): one over every third row. */
export const RF_B_PLACARDS: ReadonlyArray<readonly [number, number, number]> = RF_B_CROWDS.filter((_, i) => i % 4 === 1).map(([x, lane], i) => [x + 12, lane, i % 4] as const);

/** The camera locks (fights): the view's [left, right] (one screen; camera.ts `lock`). */
export const RF_B_ARENAS = { first: [560, 944] as const, spandoek: [1716, 2100] as const, last: [2760, 3144] as const };

/** Checkpoints (≤ 1,400 px apart: 0 → 700 → 1,900 → 3,000 → the arena). */
export const RF_B_CHECKPOINTS: readonly number[] = [700, 1900, 3000];

/** Weapon crates (x, contents). */
export const RF_B_CRATES: ReadonlyArray<readonly [number, string]> = [
  [440, 'M'],
  [1460, 'F'],
  [2380, 'S'],
];
