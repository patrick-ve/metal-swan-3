/**
 * The rideable beer bike `beer-bike` (docs/design/ams-extras.md §2.3) and its weapons
 * (`beer-cork-cannon`, `beer-keg-roll`) and keg (`beer-keg`). Registers at import time; the art is
 * art.ts (manifest entry `vehicles/beer-bike/art`). See docs/api/stag.md.
 */
import './bike';

export { BeerBike, BIKE, RollingKeg } from './bike';
export { BEER_BIKE, TURRET_STEPS, turretAngle, turretMuzzle } from './geometry';
