/**
 * The frame constants of the squad's baked 40 px sets that the player code reads (docs/design/ams40.md
 * wave 2, rule 4: code that indexes frames reads named constants exported by the bake). Every hero set
 * (src/game/content/art40/<hero>.gen.ts, made by tools/art40/chars/_hero/) exports the same values;
 * tests/art/heroes40.test.ts checks that, so the player reads them from VINCENT's set.
 *
 * - SHOOT_WINDOW: the shoot strips' first frames that fill the shot window (shootAnimTicks × 2); the
 *   frames after them are the settle tail, drawn only while the hero holds his fire.
 * - MOUNT_HIP_DROP: `mount` frame 1 is drawn this far below a seat when a rider pose is missing (its
 *   hip point is (0, −MOUNT_HIP_DROP)).
 * - THROW_RELEASE: the release frame of the throw strips (the code still finds it by data, the frame
 *   whose `hand` is farthest forward and up; the test checks the two agree).
 */
export { MOUNT_HIP_DROP, SHOOT_WINDOW, THROW_RELEASE } from '../content/art40/vincent.gen';
