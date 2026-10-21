/**
 * Content area `ring/convoy` (docs/design/ring.md §5.3, §9; wave B) — the enforcement convoy follows
 * the squad out of ams: `ring-scan-car` (SCAN LOCK), `ring-tow-truck` (the hook and the tow),
 * `ring-handhaver-moto` (baton or fine sticker) and the sticker on the glass (`ring-fine-sticker`).
 * API: docs/api/ring.md "Wave B: the convoy". Sprites: art.ts. Sounds: content/sfx/ring-convoy.ts.
 * Registers at import time.
 */
import { defineRingArt } from '../../../ring/art-def';
import './art';
import { CONVOY_ID, CONVOY_PREFIX } from './geometry';
import './moto';
import './scan-car';
import './tow-truck';

// The tier-4 working set: each id's own family (art-def's defaults, made explicit here).
defineRingArt(CONVOY_ID.scanCar, [CONVOY_PREFIX.scanCar]);
defineRingArt(CONVOY_ID.towTruck, [CONVOY_PREFIX.towTruck]);
defineRingArt(CONVOY_ID.moto, [CONVOY_PREFIX.moto]);

export { CONVOY_ART_IDS } from './art';
export { CABIN, CONVOY_ID, CONVOY_TAG, MOTO, MOTO_AI, MOTO_ID, SCAN_AI, SCAN_CAR, SCAN_CAR_ID, STICKER, STICKER_STATUS, TOW, TOW_AI, TOW_TRUCK_ID } from './geometry';
export { ConvoyEnemy } from './kit';
export { RingHandhaverMoto, RingSticker, STICKER_DEF, type MotoAttack } from './moto';
export { RingScanCar, ScanStrip, type StripState } from './scan-car';
export { RingTowTruck, TowCable, type TowEnd } from './tow-truck';
