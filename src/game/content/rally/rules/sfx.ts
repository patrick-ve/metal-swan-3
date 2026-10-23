/**
 * The rules' synth placeholders (RULES, wave B; docs/design/rally.md §8 "Synth"): only what the
 * feedback needs now — wave C's SFX owner replaces them with the full set (the siren, the horns).
 *
 * - `rally/flash`: a speed camera (or the zone's end gantry, or a red X) caught the player — the
 *   camera's double click and a short bright hiss of the flash.
 * - `rally/pulled`: a player is pulled over — two short low blips of a police horn (a placeholder;
 *   wave C's two-tone siren).
 */
import { defineSfx } from '../../../../engine/audio';
import { hashSeed, type SfxRecipe } from '../../../../engine/synth';
import { click, HP, noise, tone, type Recipes } from '../../sfx/kit';

export const RULES_SFX: Readonly<Recipes> = {
  'rally/flash': {
    vol: 0.45,
    voices: 2,
    gap: 0.12,
    layers: [click(2600, 0.5), click(1900, 0.4, 0.05), noise(0.12, 0.3, HP(5200), { delay: 0.04 }), tone('sine', 3200, 2400, 0.08, 0.12, { delay: 0.04 })],
  },
  'rally/pulled': {
    vol: 0.4,
    voices: 1,
    gap: 0.5,
    layers: [tone('square', 330, 330, 0.12, 0.22), tone('square', 247, 247, 0.16, 0.22, { delay: 0.16 })],
  },
};

for (const [id, recipe] of Object.entries(RULES_SFX)) defineSfx(id, (recipe.seed === undefined ? { ...recipe, seed: hashSeed(id) } : recipe) as SfxRecipe);
