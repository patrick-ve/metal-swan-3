/**
 * The traffic (FIELD, wave B; docs/design/rally.md §2, §4, §6; docs/api/rally.md "B.F"): the eight
 * traffic types (the hatchback of wave A, a saloon, an estate, a van, a parcel van, a lorry with a
 * trailer, a coach and a taxi — our own designs, no badges, made-up plates, palette-swap colours),
 * their models registered here (lazy content), FIELD's system 'traffic' (src/game/rally/ai-traffic.ts:
 * the pools, the spawner, the drivers, the jams) and the oncoming decor traffic beyond the central
 * barrier (a scenery part, `oncoming.ts`).
 */
import type { CarSpecB } from '../../../rally/physics';
import { installTraffic, type TrafficType } from '../../../rally/ai-traffic';
import { RALLY_MODEL } from '../../../rally/ids';
import { defineRallyModel, defineRallyScenery, defineRallySystem } from '../../../rally/registry';
import { TRAFFIC_MODELS, TRAFFIC_MODEL_IDS as M, TRAFFIC_ROWS } from '../models/traffic-index';
import { buildOncoming } from './oncoming';

/** The traffic cars' handling (spec §6; about 80–110 km/h on the road, heavy ones slow to pull away). */
const car = (id: string, model: string, mass: number, topKmh: number, accel: number, length: number, width: number, extra: Partial<CarSpecB> = {}): CarSpecB => ({
  id,
  team: 'TRAFFIC',
  model,
  mass,
  topSpeed: topKmh / 3.6,
  accel,
  grip: 0.9,
  length,
  width,
  ...extra,
});

/** The traffic types (weights: the busy road of a Dutch evening; lorries and coaches stay out of the left lane). */
export const TRAFFIC_TYPES: readonly TrafficType[] = [
  { spec: car('hatch', RALLY_MODEL.traffic, 1050, 150, 3.5, 3.9, 1.7), rows: TRAFFIC_ROWS[RALLY_MODEL.traffic], weight: 22, lanes: [0, 1, 2], pace: 1, maxKmh: 118, pool: 6 },
  { spec: car('saloon', M.saloon, 1300, 175, 3.4, 4.55, 1.72), rows: TRAFFIC_ROWS[M.saloon], weight: 18, lanes: [0, 1, 2], pace: 1.02, maxKmh: 124, pool: 5 },
  { spec: car('estate', M.estate, 1400, 170, 3.2, 4.7, 1.74), rows: TRAFFIC_ROWS[M.estate], weight: 14, lanes: [0, 1, 2], pace: 1, maxKmh: 120, pool: 4 },
  { spec: car('van', M.van, 1900, 145, 2.6, 4.8, 1.9), rows: TRAFFIC_ROWS[M.van], weight: 10, lanes: [0, 1, 2], pace: 0.95, maxKmh: 110, pool: 3 },
  { spec: car('parcel', M.parcel, 3200, 130, 2.0, 5.8, 2.1, { brake: 8 }), rows: TRAFFIC_ROWS[M.parcel], weight: 6, lanes: [1, 2], pace: 0.92, maxKmh: 100, pool: 2 },
  { spec: car('lorry', M.lorry, 18000, 92, 1.2, 16, 2.5, { brake: 6, grip: 0.8 }), rows: TRAFFIC_ROWS[M.lorry], weight: 12, lanes: [1, 2], pace: 0.9, maxKmh: 85, pool: 4 },
  { spec: car('coach', M.coach, 14000, 105, 1.5, 12, 2.55, { brake: 7, grip: 0.8 }), rows: TRAFFIC_ROWS[M.coach], weight: 4, lanes: [1, 2], pace: 0.97, maxKmh: 100, pool: 2 },
  { spec: car('taxi', M.taxi, 1400, 180, 3.6, 4.55, 1.72), rows: TRAFFIC_ROWS[M.taxi], weight: 4, lanes: [0, 1, 2], pace: 1.06, maxKmh: 128, pool: 2 },
];

for (const def of TRAFFIC_MODELS) defineRallyModel(def);

defineRallySystem({ id: 'traffic', order: 100, install: (runner) => void installTraffic(runner, TRAFFIC_TYPES) });
defineRallyScenery({ id: 'oncoming', order: 200, build: buildOncoming });
