/**
 * Content category "ui": menu and flow screen content (GDD §13). The mission cards of m0–m5
 * (intro card texts, line map, announcer line, newspaper headline) live in ./cards.ts; the
 * screens themselves are the scenes in src/game/scenes/. Art lives in ./art.ts.
 */
import { defineMissionCards } from './cards';

export { MISSION_CARDS } from './cards';

defineMissionCards();
