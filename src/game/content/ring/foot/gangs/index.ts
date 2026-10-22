/**
 * The ring gangs ON FOOT (docs/design/ring.md §R.5; docs/api/ring.md "Final jam, alight, rf-a"):
 * `ring-foot-rider` (the scooter gang: pistol along the ground, a bottle lob), `ring-foot-courier`
 * (parcel lobs, the NIET THUIS card gag), `ring-foot-crew` (the van crew: a crowbar swing up
 * close, a shotgun burst). Art: art.ts (`ring/foot/<kind>/…`); the shared rules: kit.ts.
 */
import './art';
import './kinds';

export { crowbarBuf, GANG_ART, GANG_BOX } from './art';
export { COURIER_AI, CREW_AI, FOOT_GANG, FootCourier, FootCrew, FootRider, GANG_TELL, NietThuisCard, RIDER } from './kinds';
export { FootGang, GANG, type GangSpec } from './kit';
