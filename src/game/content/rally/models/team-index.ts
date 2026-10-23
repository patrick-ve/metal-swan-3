/**
 * The rally teams' models (FIELD, wave B; docs/design/rally.md §6, §7.3): registered by the teams'
 * content (content/rally/teams). Our own designs, 300–500 triangles, no badges, made-up yellow
 * plates, each team's name on the doors and the roof in our lettering. DE LAATSTE RIT is CARS'
 * hearse of wave A (`RALLY_MODEL.rival`).
 */
import type { RallyModelDef } from '../../../rally/registry';
import { buildCamper } from './camper';
import { buildFrietbak } from './frietbak';
import { buildHearse } from './hearse';
import { buildIjsco } from './ijsco';
import { buildLimo } from './limo';
import { buildAchteruit, buildOma } from './small';
import type { RallyCarModel } from './types';

export const TEAM_MODEL_IDS = {
  camper: 'team-camper',
  frietbak: 'team-frietbak',
  limo: 'team-limo',
  ijsco: 'team-ijsco',
  achteruit: 'team-achteruit',
  oma: 'team-oma',
} as const;

const BUILD: Readonly<Record<string, (id: string) => RallyCarModel>> = {
  [TEAM_MODEL_IDS.camper]: buildCamper,
  [TEAM_MODEL_IDS.frietbak]: buildFrietbak,
  [TEAM_MODEL_IDS.limo]: buildLimo,
  [TEAM_MODEL_IDS.ijsco]: buildIjsco,
  [TEAM_MODEL_IDS.achteruit]: buildAchteruit,
  [TEAM_MODEL_IDS.oma]: buildOma,
};

/** The team models (DE LAATSTE RIT's hearse stays CARS' `rival`). */
export const TEAM_MODELS: readonly RallyModelDef[] = Object.values(TEAM_MODEL_IDS).map((id) => ({ id, build: () => (BUILD[id] ?? buildHearse)(id) }));
