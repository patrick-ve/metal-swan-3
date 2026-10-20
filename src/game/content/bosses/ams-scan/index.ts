// The mid-mission boss of mission ams: the parking scan car (docs/design/ams-extras.md §3), its
// tow truck, wheel clamps, the status `clamped` and their art. Registers at import time. How to
// place the fight: docs/api/scan-car.md.
import './art';
import './adds';
import './car';

export { AmsScanCar, type ScanAttackTrace } from './car';
export { AmsTowTruck, AmsWheelClamp, CLAMPED, isClamped, ScanReticle, ScanTicket } from './adds';
export {
  CLAMP,
  CLAMP_ID,
  CLAMP_TAG,
  CLAMPED_ID,
  ID as SCAN_SPRITES,
  SCAN,
  SCAN_ART,
  SCAN_ID,
  SCAN_NAME,
  SCAN_TAG,
  TICKET_ID,
  TRUCK,
  TRUCK_ID,
  TRUCK_TAG,
} from './geometry';
export { SCAN_ART_IDS, SCAN_DEFERRED_IDS } from './art';
