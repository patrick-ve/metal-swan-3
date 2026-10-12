/**
 * Machines sub-area "transport": sprite definitions only (`machine/<id>/…`, GDD §15.6).
 * Every machine is crimson with gold trim, bunting and brass bells (GDD §9.0), drawn with the
 * machines kit (`src/game/art/machines.ts`) and the local kit (`./kit.art.ts`):
 *
 * | file | strips |
 * |---|---|
 * | truck.art.ts | `machine/band-truck/{move,idle,move-dmg,idle-dmg,wreck,body,drum,horn,cymbal,triangle}` |
 * | bomber.art.ts | `machine/piano-bomber/{body,tell,body-dmg,tell-dmg,roll,wreck,piano,piano-landed,piano-collapse}` |
 * | copter.art.ts | `machine/baton-copter/{body,tell,fire,body-dmg,tell-dmg,spin,note-bullet}` |
 * | crew.art.ts | `machine/band-truck/bandsman-{horn,drum}`, `machine/baton-copter/{pilot-chute,pilot-run}` |
 * | boats.art.ts | `machine/rowboat/{idle,row,sink,idle-dmg,row-dmg}`, `machine/tank-barge/body` |
 * | train.art.ts | `machine/subway-train/{head,car}` |
 * | float.art.ts | `machine/parade-float/{tuba,drum,tuba-dmg,drum-dmg,wreck,topper-tuba,topper-drum}` |
 */
import { defineBoatArt } from './boats.art';
import { defineBomberArt } from './bomber.art';
import { defineCopterArt } from './copter.art';
import { defineCrewArt } from './crew.art';
import { defineFloatArt } from './float.art';
import { defineTrainArt } from './train.art';
import { defineTruckArt } from './truck.art';

defineTruckArt();
defineBomberArt();
defineCopterArt();
defineCrewArt();
defineBoatArt();
defineTrainArt();
defineFloatArt();
