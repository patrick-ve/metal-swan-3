// Bosses of mission m5 (GDD §10.5): the final boss in three stages — THE GRAND ORGAN
// (`grand-organ`), THE CONSOLE (`organ-console`) and THE MAESTRO (`maestro`) — with the prop
// `wreck-block`. Importing this module registers their entities, projectiles and sprites.
import './art-kit';
import './art-organ';
import './art-console';
import './common';
import './wreck-block';
import './grand-organ';
import './organ-console';
import './maestro';
export { ORGAN_NAME, ORGAN_SUBTITLE } from './grand-organ';
export { CONSOLE_NAME, CONSOLE_SUBTITLE } from './organ-console';
export { MAESTRO_NAME, MAESTRO_SUBTITLE } from './maestro';
