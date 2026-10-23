/**
 * The rally's synth sounds of wave A (docs/design/rally.md §1.2, §8; docs/api/rally.md "A.I"): the
 * glitch into 3D and the start countdown. Our own recipes (no sample, no ElevenLabs); wave C adds
 * the engines, tyres, scrapes, the radio and the rest (§8 "Synth"). Lazy: registered when the rally
 * content loads (content/rally/index.ts), so the boot renders none of them, and the scenes check
 * `hasSfx` before they play one.
 *
 * - `rally/glitch`: the 2D picture breaks — a short burst of bit-crushed static with a falling
 *   digital chirp (the family of the glitch bridge's sound, but its own recipe: the bridge's lives
 *   in the lazy fps content).
 * - `rally/fold`: the blocks fold into the 3D grid — a rising swept whoosh that opens into a low
 *   synth swell (the new dimension), then a soft thump as the grid lands.
 * - `rally/count`: one countdown beep (3, 2, 1); `rally/go`: the higher, longer GO tone.
 */
import { defineSfx } from '../../../engine/audio';
import { hashSeed, type SfxRecipe } from '../../../engine/synth';
import { BP, click, HP, hz, LP, noise, tone, type Recipes } from '../sfx/kit';

export const RALLY_SFX: Readonly<Recipes> = {
  'rally/glitch': {
    vol: 0.4,
    voices: 2,
    gap: 0.06,
    crush: 5,
    downsample: 4,
    layers: [
      { wave: 'noise', env: { a: 0.002, s: 1, hold: 0.12, r: 0.05 }, vol: 0.6, filter: BP(1800, 3600, 0.9), tremolo: { rate: 31, depth: 1, shape: 'square' } },
      tone('square', 2400, 600, 0.14, 0.22, { filter: LP(4200) }),
      tone('square', 880, 1320, 0.05, 0.16, { delay: 0.1 }),
    ],
  },
  'rally/fold': {
    vol: 0.5,
    voices: 1,
    gap: 0.4,
    layers: [
      noise(0.55, 0.45, BP(500, 5200, 1.2), { env: { a: 0.3, s: 1, hold: 0.15, r: 0.1 } }),
      { wave: 'saw', freq: hz('A2'), to: hz('A3'), sweep: 0.5, env: { a: 0.2, d: 0.2, s: 0.6, hold: 0.3, r: 0.35 }, vol: 0.22, filter: LP(400, 2400) },
      { wave: 'saw', freq: hz('E3'), to: hz('E4'), sweep: 0.5, env: { a: 0.2, d: 0.2, s: 0.6, hold: 0.3, r: 0.35 }, vol: 0.16, filter: LP(400, 2400) },
      tone('sine', 110, 46, 0.22, 0.7, { delay: 0.55 }),
      click(300, 0.4, 0.55),
    ],
  },
  'rally/count': {
    vol: 0.45,
    voices: 1,
    gap: 0.3,
    layers: [
      { wave: 'square', freq: hz('A5'), env: { a: 0.003, s: 1, hold: 0.16, r: 0.03 }, vol: 0.32, filter: LP(3800) },
      { wave: 'sine', freq: hz('A4'), env: { a: 0.003, s: 1, hold: 0.16, r: 0.04 }, vol: 0.4 },
    ],
  },
  'rally/go': {
    vol: 0.5,
    voices: 1,
    gap: 0.3,
    layers: [
      { wave: 'square', freq: hz('A6'), env: { a: 0.003, s: 1, hold: 0.5, r: 0.12 }, vol: 0.26, filter: LP(5000) },
      { wave: 'sine', freq: hz('A5'), env: { a: 0.003, s: 1, hold: 0.5, r: 0.15 }, vol: 0.42 },
      noise(0.08, 0.15, HP(3000)),
    ],
  },
};

// Each recipe's noise seed is pinned to its id (the seed the synth would pick anyway).
for (const [id, recipe] of Object.entries(RALLY_SFX)) defineSfx(id, (recipe.seed === undefined ? { ...recipe, seed: hashSeed(id) } : recipe) as SfxRecipe);
