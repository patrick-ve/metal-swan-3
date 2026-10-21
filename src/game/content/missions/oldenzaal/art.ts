/**
 * The town art of mission `oldenzaal` (TOWN, wave A): imports every town art module so they
 * register at import time (the sprites `decor/oz/…`, the background generators `oz-…`, the terrain
 * materials `oz-…`). The section files reach it through `backgrounds.ts`.
 */
import './art-basilica';
import './art-sky';
import './art-smulhoek';
import './art-street';
import './art-terrain';

export { OZ_TOWN_BGS, OZ_TOWN_SPRITES } from './art-kit';
