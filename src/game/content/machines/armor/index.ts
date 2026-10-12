/**
 * Machines sub-area "armor" (GDD §9.2, §9.5): registers at import time
 * - `oompah-tank` (+ `tank-crewman`, `bell-shell`)      ./tank.ts
 * - `metronome-turret` (+ `metronome-bullet`)           ./metronome.ts
 * - `gramophone-mortar` (+ `record`)                    ./mortar.ts
 * - `pipe-battery` (+ `note-rocket`)                    ./pipes.ts
 * - `anthem-speaker`                                    ./speaker.ts
 * - `drum-barricade`                                    ./barricade.ts
 * Shared: the `Machine` base (./machine.ts) and the geometry the art also reads (./geom.ts).
 * Art (`machine/<id>/…`, `enemy/tank-crewman/…`) is registered by ./art.ts.
 */
export { Machine } from './machine';
export { BassPulse, BellShell, CREWMAN, OOMPAH_TANK, OompahTank, TankCrewman } from './tank';
export { METRONOME_TURRET, MetronomeTurret } from './metronome';
export { GRAMOPHONE, GramophoneMortar, VinylRecord } from './mortar';
export { NoteRocket, PIPE_BATTERY, PipeBattery } from './pipes';
export { ANTHEM, AnthemSpeaker, playAnthem } from './speaker';
export { DRUM_BARRICADE, DrumBarricade } from './barricade';
