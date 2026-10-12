/**
 * Machines sub-area "armor": sprite definitions only (`machine/<id>/…`, GDD §15.6, and the
 * `enemy/tank-crewman/…` rig strips). Crimson with gold trim, bunting and brass bells (GDD §9.0);
 * geometry shared with the logic lives in ./geom.ts.
 */
import { defineBarricadeSprites } from './barricade.art';
import { defineMetronomeSprites } from './metronome.art';
import { defineMortarSprites } from './mortar.art';
import { definePipeSprites } from './pipes.art';
import { defineSpeakerSprites } from './speaker.art';
import { defineTankSprites } from './tank.art';

defineTankSprites();
defineMetronomeSprites();
defineMortarSprites();
definePipeSprites();
defineSpeakerSprites();
defineBarricadeSprites();
