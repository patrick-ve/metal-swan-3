/**
 * Looks of the wind soldiers: outfit (GDD §9.0 `params.outfit`) × skin tone → sprite prefix.
 *
 * - `enemy/<type>/…`                     parade outfit, skin A (registered eagerly by art.ts)
 * - `enemy/<type>-<outfit>/…`            another outfit (GDD §15.6, e.g. `enemy/bassoonist-desert/idle`)
 * - `enemy/<type>[-<outfit>]-skin<b|c>/…` the same with skin B or C (GDD §9.0: skin per spawn)
 *
 * The logic (index.ts) asks for a look when a soldier spawns (`ensureLook`). The art module
 * registers one definer per type (`registerLookDefiner`); a look is registered the first time a
 * soldier wears it, so the 15 looks per type cost nothing at boot, and each strip is generated
 * the first time it plays. Without the art module `ensureLook` returns null and the soldier
 * falls back to the default prefix. This file imports no art (the logic stays art-free).
 */

export const OUTFITS = ['parade', 'deck', 'desert', 'snow', 'night'] as const;
export type Outfit = (typeof OUTFITS)[number];

/** Skin tones (`skinA` fair, `skinB` tan, `skinC` deep). */
export const SKINS = ['a', 'b', 'c'] as const;
export type Skin = (typeof SKINS)[number];

/** The wind soldier types (entity ids). */
export const WIND_TYPES = ['oompah-trooper', 'piccolo', 'bassoonist'] as const;
export type WindType = (typeof WIND_TYPES)[number];

/** Read an outfit param (unknown values → 'parade'). */
export function asOutfit(v: unknown): Outfit {
  return typeof v === 'string' && (OUTFITS as readonly string[]).includes(v) ? (v as Outfit) : 'parade';
}

/** Read a skin param ('a' | 'b' | 'c', or 'skinA' …); null when absent or unknown. */
export function asSkin(v: unknown): Skin | null {
  if (typeof v !== 'string') return null;
  const k = v.toLowerCase().replace('skin', '');
  return (SKINS as readonly string[]).includes(k) ? (k as Skin) : null;
}

/** Sprite prefix of a look. */
export function lookPrefix(type: string, outfit: Outfit = 'parade', skin: Skin = 'a'): string {
  let p = `enemy/${type}`;
  if (outfit !== 'parade') p += `-${outfit}`;
  if (skin !== 'a') p += `-skin${skin}`;
  return p;
}

/** Registers every strip of one look under `prefix`. */
export type LookDefiner = (prefix: string, outfit: Outfit, skin: Skin) => void;

const definers = new Map<string, LookDefiner>();
const defined = new Set<string>();

/** Called by the art module, once per type. */
export function registerLookDefiner(type: string, define: LookDefiner): void {
  definers.set(type, define);
}

/**
 * Make sure a look's sprites are registered; returns its prefix, or null when no art module
 * registered this type (headless logic-only runs).
 */
export function ensureLook(type: string, outfit: Outfit = 'parade', skin: Skin = 'a'): string | null {
  const prefix = lookPrefix(type, outfit, skin);
  if (defined.has(prefix)) return prefix;
  const define = definers.get(type);
  if (!define) return null;
  define(prefix, outfit, skin);
  defined.add(prefix);
  return prefix;
}

/** Has a definer been registered for the type (the art module is loaded)? */
export function hasLooks(type: string): boolean {
  return definers.has(type);
}
