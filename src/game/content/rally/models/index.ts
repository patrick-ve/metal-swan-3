/**
 * The rally car models (docs/design/rally.md §6, §7.3; docs/api/rally.md "A.C The cars"): the two
 * estates (likenesses of the squad's rally estates, ring decisions 13 / 13a), the rival DE LAATSTE
 * RIT (a black 1980s hearse), a traffic hatchback with palette-swap colours and the police estate.
 * Low-poly meshes with 1× palettised pages (tex/estate.ts, tex/hearse.ts, tex/hatch.ts), every model
 * a `RallyCarModel` (models/types.ts: anchors, wheel and lamp meshes, a far version).
 *
 * The models register with the rally registry when this module loads (the lazy content's import,
 * content/rally/index.ts): one definition per `RALLY_MODEL` id. Model space: the nose points +z,
 * y up, +x the car's left, the wheels on y = 0.
 */
import { RALLY_MODEL } from '../../../rally/ids';
import { defineRallyModel, type RallyModelDef } from '../../../rally/registry';
import { buildEstate } from './estate';
import { buildHatch } from './hatch';
import { buildHearse } from './hearse';

export { carModelInfo, poseWheel } from './types';
export type { CarAnchors, CarBox, CarLamps, CarLightParts, RallyCarModel, WheelAnchor } from './types';

/** Every car model of the rally (one per `RALLY_MODEL` id). */
export const RALLY_MODELS: readonly RallyModelDef[] = [
  { id: RALLY_MODEL.white, build: () => buildEstate(RALLY_MODEL.white, 'white') },
  { id: RALLY_MODEL.green, build: () => buildEstate(RALLY_MODEL.green, 'green') },
  { id: RALLY_MODEL.rival, build: () => buildHearse(RALLY_MODEL.rival) },
  { id: RALLY_MODEL.traffic, build: () => buildHatch(RALLY_MODEL.traffic) },
  { id: RALLY_MODEL.police, build: () => buildEstate(RALLY_MODEL.police, 'police') },
];

for (const def of RALLY_MODELS) defineRallyModel(def);
