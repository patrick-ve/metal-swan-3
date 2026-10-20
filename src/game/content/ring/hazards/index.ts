/**
 * Content area `ring/hazards` (docs/design/ring.md §7; docs/api/ring.md "Entities"). Owner: the
 * ROAD builder. Matrix gantries (`ring-gantry`), lane closures (`ring-closure`), speed cameras
 * (`ring-speedcam`), the average-speed zone (`ring-avgzone`) and the jam controller (`ring-jam`).
 * Sprites: art.ts; shared geometry: geometry.ts.
 */
export { AVG_LENGTH, fineWagon, FRONT_X, RingAvgZone, RingSpeedcam } from './camera';
export { CONE_COST, HEAD_COST, RingClosure } from './closure';
export { gantryFaces, RingGantry } from './gantry';
export { CLOSURE, SIGN_FACES, signFrame, slantX, type SignFace } from './geometry';
export { JAM, RingJam, type JamPhase, type JamWaveEntry } from './jam';
