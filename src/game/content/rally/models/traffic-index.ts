/**
 * The traffic models (FIELD, wave B; docs/design/rally.md §6, §7.3): registered by the traffic
 * content (content/rally/traffic), not by models/index.ts (CARS' registry of the wave-A models).
 * Our own designs, 120–250 triangles, no badges, made-up plates, colours as CLUT rows.
 */
import type { RallyModelDef } from '../../../rally/registry';
import { RALLY_MODEL } from '../../../rally/ids';
import { HATCH_COLOURS } from '../tex/hatch';
import { buildCoach, buildLorry } from './traffic-big';
import { buildEstateT, buildParcel, buildSaloon, buildTaxi, buildVan } from './traffic-cars';
import type { RallyCarModel } from './types';

/** The traffic model ids (the wave-A hatchback is `RALLY_MODEL.traffic`). */
export const TRAFFIC_MODEL_IDS = {
  saloon: 'traffic-saloon',
  estate: 'traffic-estate',
  van: 'traffic-van',
  parcel: 'traffic-parcel',
  lorry: 'traffic-lorry',
  coach: 'traffic-coach',
  taxi: 'traffic-taxi',
} as const;

const BUILD: Readonly<Record<string, (id: string) => RallyCarModel>> = {
  [TRAFFIC_MODEL_IDS.saloon]: buildSaloon,
  [TRAFFIC_MODEL_IDS.estate]: buildEstateT,
  [TRAFFIC_MODEL_IDS.van]: buildVan,
  [TRAFFIC_MODEL_IDS.parcel]: buildParcel,
  [TRAFFIC_MODEL_IDS.lorry]: buildLorry,
  [TRAFFIC_MODEL_IDS.coach]: buildCoach,
  [TRAFFIC_MODEL_IDS.taxi]: buildTaxi,
};

/** The traffic models (the hatchback is CARS' `traffic`, registered by models/index.ts). */
export const TRAFFIC_MODELS: readonly RallyModelDef[] = Object.values(TRAFFIC_MODEL_IDS).map((id) => ({ id, build: () => BUILD[id](id) }));


/** The colour rows of each traffic model (the hatchback's ten; the others' from their builds). */
export const TRAFFIC_ROWS: Readonly<Record<string, number>> = {
  [RALLY_MODEL.traffic]: HATCH_COLOURS.length,
  [TRAFFIC_MODEL_IDS.saloon]: HATCH_COLOURS.length,
  [TRAFFIC_MODEL_IDS.estate]: HATCH_COLOURS.length,
  [TRAFFIC_MODEL_IDS.van]: 6,
  [TRAFFIC_MODEL_IDS.parcel]: 4,
  [TRAFFIC_MODEL_IDS.lorry]: 6,
  [TRAFFIC_MODEL_IDS.coach]: 4,
  [TRAFFIC_MODEL_IDS.taxi]: 2,
};
