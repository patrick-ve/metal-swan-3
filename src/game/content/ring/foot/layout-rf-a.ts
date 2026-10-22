/**
 * `rf-a` DE FILE — the layout numbers (docs/design/ring.md §R.5; docs/api/ring.md "Final jam,
 * alight, rf-a"): the A10 at the Zuidas in the normal 2D side view, seen from the hard shoulder.
 *
 * Depth (screen y): the ring's own road layers shifted up by `RF_SHIFT` (27 px), so the heroes'
 * feet line (`RF_GROUND`, 176) lies on the hard shoulder; the near lane's stopped vehicles stand
 * just behind it (`CAR_Y`, 171: wheel line); the far lanes 3, 2, 1 with standing cars (back decor,
 * `FAR_LANE_Y`), the median, the oncoming carriageway and the Zuidas behind (section-rf-a.ts).
 *
 * The near lane's vehicles (`RF_A_VEHICLES`, drawn by props.ts; never solid) give the platforms:
 * their roofs are one-way platforms (`RF_A_PLATFORMS`, from the drive's car geometry, so art and
 * collision agree). Cover in the walking plane: concrete road-works blocks (`RF_A_BLOCKS`, solids).
 * The parked wagons with their drivers stand at the start (no platform: P2's is drawn only in 2P).
 */
import type { RingCarModel } from '../../../ring/ids';
import { CAR_GEO, carColour, type CarGeo } from '../traffic/geometry';
import { VAN } from '../gangs/geometry';
import { BUS, KBARRIER, POLICE_LINE_W, POLICE_VAN } from './art-jam';
import { RF_GROUND } from './ids';

/** The ring's road layers move up by this much (the feet line on the hard shoulder). */
export const RF_SHIFT = 27;
/** The near lane's wheel line (the stopped vehicles), 5 px behind the feet line. */
export const CAR_Y = RF_GROUND - 5;
/** The far lanes' wheel lines (lane 1, 2, 3; the ring's LANE_Y shifted). */
export const FAR_LANE_Y: readonly number[] = [124 - RF_SHIFT, 145 - RF_SHIFT, 167 - RF_SHIFT];

/** Section width (px). */
export const RF_A_W = 3200;

export type RfVehicle =
  | { kind: 'car'; model: RingCarModel; colour: string; x: number }
  | { kind: 'wagon'; slot: 0 | 1; x: number }
  | { kind: 'bus'; x: number }
  | { kind: 'parcel-van'; x: number }
  | { kind: 'police-van'; x: number };

const car = (model: RingCarModel, colour: number, x: number): RfVehicle => ({ kind: 'car', model, colour: carColour(model, colour), x });

/** The near lane, left to right (x = the vehicle's middle). */
export const RF_A_VEHICLES: readonly RfVehicle[] = [
  { kind: 'wagon', slot: 0, x: 150 },
  { kind: 'wagon', slot: 1, x: 262 },
  car('hatch', 0, 384),
  car('estate', 2, 520),
  car('van', 1, 664),
  car('taxi', 0, 808),
  car('hatch', 5, 964),
  car('estate', 4, 1136),
  car('box-truck', 0, 1296),
  car('camper', 1, 1460),
  { kind: 'parcel-van', x: 1660 },
  car('hatch', 6, 1808),
  car('estate', 0, 1944),
  { kind: 'bus', x: 2124 },
  car('taxi', 0, 2296),
  car('van', 0, 2428),
  car('hatch', 3, 2568),
  car('estate', 1, 2744),
  car('hatch', 2, 2884),
  { kind: 'police-van', x: 3060 },
];

/** A platform as [x, y, w] (y = the feet line on it). */
export type Plat = readonly [number, number, number];

/** The roof runs of a side profile: the top (≤ 0.7 px under the highest point) as [x0, x1, y]. */
function roofOf(profile: readonly (readonly [number, number])[]): [number, number, number] {
  let top = Infinity;
  for (const [, y] of profile) top = Math.min(top, y);
  let x0 = Infinity;
  let x1 = -Infinity;
  for (const [x, y] of profile) {
    if (y > top + 0.7) continue;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
  }
  return [Math.ceil(x0), Math.floor(x1), Math.round(top)];
}

/** The roof platforms of a car model (the box truck: the box and the cab). */
export function carRoofs(g: CarGeo): Array<[number, number, number]> {
  const out = [roofOf(g.profile)];
  if (g.cab) out.push(roofOf(g.cab));
  return out;
}

const BUS_ROOF: [number, number, number] = [-70, 66, -BUS.height];
const VAN_ROOF = roofOf(VAN.profile);
/** The police van (facing right like the queue): its roof run. */
const PV_ROOF: [number, number, number] = [-44, 18, -POLICE_VAN.height + 1];

/** The roof platforms of the near lane (left to right). */
export const RF_A_PLATFORMS: readonly Plat[] = RF_A_VEHICLES.flatMap((v): Plat[] => {
  const runs: Array<[number, number, number]> =
    v.kind === 'car' ? carRoofs(CAR_GEO[v.model]) : v.kind === 'bus' ? [BUS_ROOF] : v.kind === 'parcel-van' ? [VAN_ROOF] : v.kind === 'police-van' ? [PV_ROOF] : [];
  return runs.map(([x0, x1, y]) => [v.x + x0, CAR_Y + y, x1 - x0] as const);
});

/** Concrete road-works blocks in the walking plane (cover; solids [x, y, w, h]). */
export const RF_A_BLOCKS: ReadonlyArray<readonly [number, number, number, number]> = [
  [886, RF_GROUND - KBARRIER.h, KBARRIER.w, KBARRIER.h],
  [1560, RF_GROUND - KBARRIER.h, KBARRIER.w, KBARRIER.h],
  [2492, RF_GROUND - KBARRIER.h, KBARRIER.w, KBARRIER.h],
];

/** Scooters the gang dumped in the jam (decor lying on the shoulder: x, look 0–2). */
export const RF_A_SCOOTERS: ReadonlyArray<readonly [number, number]> = [
  [596, 0],
  [742, 1],
  [1046, 2],
  [2352, 0],
  [2652, 1],
];

/** The camera locks (fights): [min x, max x] of the camera's left edge. */
export const RF_A_ARENAS = { first: [700, 700] as const, van: [1500, 1500] as const, last: [2320, 2320] as const };

/** Checkpoints (≤ 1,400 px apart: 0 → 860 → 1,700 → 2,480 → the end). */
export const RF_A_CHECKPOINTS: readonly number[] = [860, 1700, 2480];

/** The hostage in the open parcel van (its rear doorway) and the weapon crates. */
export const RF_A_HOSTAGE_X = 1660 - VAN.len / 2 - 8;
export const RF_A_CRATES: ReadonlyArray<readonly [number, string]> = [
  [560, 'M'],
  [1220, 'S'],
  [2210, 'F'],
];

/** The police line across the shoulder (its left post) and the exit after it. */
export const RF_A_POLICE_LINE_X = 3110;
export const RF_A_EXIT = { x: RF_A_W - 24, y: 0, w: 24, h: 216 } as const;
export const RF_A_POLICE_LINE_W = POLICE_LINE_W;
