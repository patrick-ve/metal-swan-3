/**
 * Lazy manifest entry `fps/art` (docs/design/fps.md §3.6, §8): the first-person mode's textures,
 * billboards, HUD, weapon views and faces. All code-generated, palette-only and original
 * (src/game/art/wall-tex.ts, src/game/art/figure3d.ts); the mech face is the user's own art,
 * imported to palette data (§8.7, content/fps/art/mecha-face.gen.ts).
 */
import './textures';
import './billboards';
import './props';
import './pickups-art';
import './weapon-art';
import './hud-art';
import './faces';
