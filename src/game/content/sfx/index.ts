/**
 * Content category "sfx": every sound effect of the game as an original synth recipe
 * (docs/api/media.md §9.1, docs/api/sfx.md, docs/GAME_DESIGN.md §12.1 and §15.7).
 * Registers at import time.
 *
 * Design rules for the whole set:
 * - Punchy and arcade, never harsh: noise is always filtered, attacks are short, tails decay fast.
 * - One loudness plan per category (peaks ≤ 0.9; tests/content/sfx.test.ts checks peak and a
 *   K-weighted loudness band per category): frequent sounds (steps, hits, guns) sit low,
 *   telegraphs and pickups in the middle, explosions, boss cues and the HONK on top.
 * - Loops (`SFX_LOOPS`) are seamless and meant for `audio.sfxLoop(key, id)`.
 * - Every id the game layer plays is defined (ARCHITECTURE §7.1), plus every GDD §15.7 id
 *   (the engine keeps `ui/announce` and the `drum/*` kit). Ids that mean the same thing share one
 *   recipe (`SFX_ALIASES`).
 *
 * The recipes live per family in this folder: weapons.ts (weapons, explosions, hits), player.ts
 * (player, items, hostages), vehicles.ts (vehicles, swan, fleet), legion.ts (infantry),
 * machines.ts (machines, creatures), bosses.ts, world.ts (`env/*`), ui.ts (menus, mission);
 * kit.ts holds the layer builders.
 */
import { defineSfx } from '../../../engine/audio';
import { hashSeed, type SfxRecipe } from '../../../engine/synth';
import { BOSSES } from './bosses';
import { st } from './kit';
import { ENEMIES } from './legion';
import { CREATURES, MACHINES } from './machines';
import { HOSTAGES, ITEMS, PLAYER } from './player';
import { UI } from './ui';
import { FLEET, SWAN, VEHICLES } from './vehicles';
import { EXPLOSIONS, HITS, WEAPONS } from './weapons';
import { ENV } from './world';

/** Ids that mean the same sound (alias → recipe id). Never delete an entry: other code plays them. */
export const SFX_ALIASES: Readonly<Record<string, string>> = {
  // Task / game-layer names → GDD names.
  'weapon/machine-gun': 'weapon/mg',
  'weapon/cannon': 'vehicle/cannon',
  'bomb/throw': 'weapon/grenade-throw',
  'bomb/bounce': 'weapon/grenade-bounce',
  'hit/armor': 'hit/metal',
  'player/respawn': 'player/spawn',
  'item/bomb': 'item/bombs',
  'crate/break': 'item/crate-break',
  'vehicle/mount': 'vehicle/enter',
  'vehicle/eject': 'vehicle/exit',
  'enemy/shot': 'enemy/rifle',
  'enemy/die': 'enemy/die-1',
  'ui/tally-tick': 'ui/tally',
  'boss/warning': 'ui/warning',
  // The hidden 1UP hostage was renamed 'composer' (GDD §7.2); keep the old id working.
  'hostage/maestro': 'hostage/composer',
  // GDD 12.2 names of pickup sounds used by other proposals.
  'pickup/weapon': 'item/weapon',
  'pickup/bombs': 'item/bombs',
  'pickup/food': 'item/food',
  'pickup/gem': 'item/gem',
  'pickup/1up': 'item/1up',
};

/**
 * Pins each recipe's noise seed to its own id (the seed the synth would pick anyway), so an alias
 * renders exactly the same samples as its target instead of a re-seeded variant.
 */
function pinSeeds(table: Readonly<Record<string, SfxRecipe>>): Record<string, SfxRecipe> {
  const out: Record<string, SfxRecipe> = {};
  for (const [id, r] of Object.entries(table)) out[id] = r.seed === undefined ? { ...r, seed: hashSeed(id) } : r;
  return out;
}

/** Every recipe of this module by id (aliases not included). */
export const SFX: Readonly<Record<string, SfxRecipe>> = pinSeeds({
  ...WEAPONS,
  ...EXPLOSIONS,
  ...HITS,
  ...PLAYER,
  ...ITEMS,
  ...HOSTAGES,
  ...VEHICLES,
  ...SWAN,
  ...FLEET,
  ...ENEMIES,
  ...MACHINES,
  ...CREATURES,
  ...BOSSES,
  ...ENV,
  ...UI,
});

/** Seamless loops: play them with `audio.sfxLoop(key, id)` and stop them with `stopSfx(key)`. */
export const SFX_LOOPS: readonly string[] = Object.keys(SFX).filter((id) => SFX[id].loop === true);

/** The three death-yelp variants (pick one per death, cosmetic rng). */
export const ENEMY_DIE_SFX: readonly string[] = ['enemy/die-1', 'enemy/die-2', 'enemy/die-3'];

/** Pitch ratios of a major scale (the knife-combo aria rises one step per kill). */
export const ARIA_STEPS: readonly number[] = [0, 2, 4, 5, 7, 9, 11, 12].map(st);

for (const [id, recipe] of Object.entries(SFX)) defineSfx(id, recipe);
for (const [alias, id] of Object.entries(SFX_ALIASES)) {
  const recipe = SFX[id];
  if (recipe) defineSfx(alias, recipe);
}
