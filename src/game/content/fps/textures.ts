/**
 * The first-person mode's wall and door textures (docs/design/fps.md §8.1), registered with
 * `defineRayTexture`. The painters live in src/game/art/wall-tex.ts. These definitions replace
 * the fps-shell placeholders (content/fps/textures-basic.ts) whatever the load order: a
 * redefinition keeps the texture index and swaps the generator. Each texture also gets its UHD
 * painter (128² / 256², walls-hd.ts `paintWallHd`) through its carrier sprite (ray-art.ts).
 */
import { paintWall, WALL_PAINTERS } from '../../art/wall-tex';
import { paintWallHd } from './walls-hd';
import { defineRayTextureArt } from './ray-art';

/** Every §8.1 texture id (the art test checks this list against the spec). */
export const FPS_TEXTURE_IDS: readonly string[] = Object.keys(WALL_PAINTERS);

for (const id of FPS_TEXTURE_IDS) defineRayTextureArt(id, () => paintWall(id), (d) => paintWallHd(id, d));
