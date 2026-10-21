/**
 * The oldenzaal weather (docs/design/oldenzaal.md §10.1, §10.2). Owner: LIGHT.
 *
 * - `oz-fog`  (fog.ts): drifting ground-fog bands, a background layer generator (1×, 2×, 4×).
 * - `oz-rain` (rain.ts): a wrapping tile of rain streaks, a background layer generator (1×, 2×, 4×).
 * - Wind gusts and the lightning schedule are part of the light pass itself
 *   (src/game/mission/light/pass.ts): a gust speeds the rain and the fog sideways; the flash lifts
 *   the darkness, brightens the backdrop and is followed by the thunder sfx `oz/env/thunder`.
 *
 * Registered at import time by the kit (manifest entry 'oldenzaal/kit').
 */
import { registerFog } from './fog';
import { registerRain } from './rain';

export { OZ_FOG_GEN, paintFog } from './fog';
export { OZ_RAIN_GEN, paintRain } from './rain';

registerFog();
registerRain();
