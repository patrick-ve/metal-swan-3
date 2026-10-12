/**
 * Content category "props": sprite definitions only (`prop/<id>/…`, GDD §15.6).
 * Each prop family draws its own strips; sized props (walls, awnings) also register extra sizes
 * on demand when a mission spawns them.
 */
import { defineBreakableSprites } from './breakables.art';
import { definePlatformSprites } from './platforms.art';
import { defineScenerySprites } from './scenery.art';
import { defineSetPieceSprites } from './set-pieces.art';
import { defineWallSprites } from './wall.art';

defineBreakableSprites();
defineWallSprites();
definePlatformSprites();
defineScenerySprites();
defineSetPieceSprites();
