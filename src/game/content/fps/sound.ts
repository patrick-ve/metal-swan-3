/**
 * Lazy manifest entry `fps/sound` (docs/design/fps.md §3.6, §9): the first-person mode's synth
 * sound effects (`sfx.ts`, every `fps/*` id of §9.1) and songs (`music.ts`: `fps-floor`,
 * `fps-boss`, `fps-tally`, `fps-bridge`). These are the fallbacks: the ElevenLabs takes of the
 * sample group 'mode:fps' replace them when loaded. Registers at import time.
 */
import { defineSfx } from '../../../engine/audio';
import { hashSeed } from '../../../engine/synth';
import { registerFpsSongs } from './music';
import { FPS_SFX } from './sfx';

// Each recipe's noise seed is pinned to its id (the seed the synth would pick anyway).
for (const [id, recipe] of Object.entries(FPS_SFX)) defineSfx(id, recipe.seed === undefined ? { ...recipe, seed: hashSeed(id) } : recipe);
registerFpsSongs();
