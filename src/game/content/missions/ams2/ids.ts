/**
 * Mission `ams2` (docs/design/ams2.md): pure data, no imports, so the boot, the art workers and the
 * tools may import it without pulling in the lazy chunk.
 */

/** The mission id (a registered mission, LAZY: content/index.ts `isAms2Content`; `?mission=ams2`). */
export const AMS2_ID = 'ams2';

/** Every sprite of the mission lives under this prefix: `decor/ams2/<light>/<name>` (stage.ts `artId`). */
export const AMS2_SPRITE_PREFIX = 'decor/ams2/';

/** Is `id` an ams2 sprite (the art worker loads the lazy chunk for it: src/game/art-worker.ts)? */
export function isAms2SpriteId(id: string): boolean {
  return id.startsWith(AMS2_SPRITE_PREFIX);
}
