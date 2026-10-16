/**
 * The first-person mode's wall and door textures (docs/design/fps.md §8.1), registered with
 * `defineRayTexture`. The painters live in src/game/art/wall-tex.ts. These definitions replace
 * the fps-shell placeholders (content/fps/textures-basic.ts) whatever the load order: a
 * redefinition keeps the texture index and swaps the generator.
 */
import { defineRayTexture } from '../../../engine/ray';
import { paintWall, WALL_PAINTERS } from '../../art/wall-tex';

/** Every §8.1 texture id (the art test checks this list against the spec). */
export const FPS_TEXTURE_IDS: readonly string[] = Object.keys(WALL_PAINTERS);

for (const id of FPS_TEXTURE_IDS) defineRayTexture(id, () => paintWall(id));
