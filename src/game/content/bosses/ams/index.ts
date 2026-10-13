// Boss of mission ams: ROBO-HALSEMA, THE IRON MAYOR (docs/design/amsterdam.md §3) — entity
// `ams-mayor`, its projectiles and art. Registers at import time. See docs/api/locals.md §6.
import './art';
import './art-shots';
import './shots';
import './mayor';

export { AmsMayor } from './mayor';
export { NoiseLetter, ShieldShot, StampWave } from './shots';
export { ADD_TAG, MAYOR, MAYOR_NAME, MAYOR_SUBTITLE } from './geometry';
