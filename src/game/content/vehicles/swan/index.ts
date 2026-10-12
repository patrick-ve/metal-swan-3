/**
 * Player vehicle `swan` — SWAN-3 "Metal Swan", the ridden mount (GDD §8.2,
 * docs/design/swan-mount/). Gameplay definitions; art in ./art.ts (and ./*.art.ts) under
 * `vehicle/swan…` (owned by the art side).
 *
 * Registers at import time:
 * - entity `swan` (category 'vehicle'; params `variant` 'ivory' | 'mute', `socks`, `cells`,
 *   `shells`, `facing`) — swan.ts;
 * - weapons `swan-beak-gun`, `swan-beak-shell`, `swan-honk` and the projectile entities
 *   `beak-bullet`, `beak-shell`, `honk-ring` — weapons.ts.
 * Exports the class, its numbers (`SWAN`), the HONK ring (for the Trumpeter's HONK) and
 * `drawRiddenSwan` (the title scene's ridden swimming Swan).
 */
import { defineEntity } from '../../../registry';
import './weapons';
import { Swan } from './swan';

defineEntity('swan', (w, x, y, p) => new Swan(w, x, y, p), {
  category: 'vehicle',
  description: 'SWAN-3 "Metal Swan": the ridden robot swan (GDD 8.2)',
});

export { isSwan, Swan, type GlideState, type SwanMedium, type SwanPhase } from './swan';
export { SWAN } from './constants';
export { BeakShell, HonkRing, spawnBeakShell, spawnHonkRing } from './weapons';
export { drawRiddenSwan, type RiddenSwanOpts } from './draw';
