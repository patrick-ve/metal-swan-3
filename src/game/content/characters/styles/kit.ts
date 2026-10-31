/**
 * Art-direction trial (2026-10-29): six ways to draw a player, tried on VINCENT. Each style is a
 * pose renderer (`ArtStyle.renderPose`) that draws every rig strip of a hidden character
 * `vincent-<style>` (index.ts), so the whole player contract gets the style at once. Play one with
 * `?char=vincent-<style>`; the arena and the shot tool take `--char vincent-<style>`.
 *
 * The frame contract is `renderHuman`'s (src/game/art/humanoid.ts): the same anchor (feet for
 * 'full' / 'lower', pelvis for 'upper') and the same point names (`hip`, `muzzle`, `head`, `hand`,
 * `harness`); a d 2 / 4 frame has its 1× frame's logical size, anchor and points.
 */
import type { PlayerArtOpts } from '../../../art/human-sprites';

export interface ArtStyle {
  /** Short kebab-case id: the character is `vincent-<id>`. */
  readonly id: string;
  /** Display name (the trial page). */
  readonly name: string;
  /** One sentence: what the style is. */
  readonly blurb: string;
  /** Draws one pose of the rig in this style (the frame contract above). */
  readonly renderPose: NonNullable<PlayerArtOpts['renderPose']>;
}
