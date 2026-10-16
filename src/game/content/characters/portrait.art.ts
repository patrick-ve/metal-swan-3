/**
 * Menu portraits of the heroes (`char/<id>/portrait`, 32×32, top-left anchor; GDD §13.5): the
 * head and shoulders rendered by the rig with the hero's own expression, enlarged with Scale2x
 * (no new colours), on a panel in a colour that sets the hero apart (and keeps the face readable),
 * with a 1-px INK frame. The select screen greys out a taken hero itself.
 *
 * The squad (docs/design/squad.md §2.2) draws its portraits from the select-portrait faces
 * (select.art.ts `smallPortrait`) through `PortraitCfg.draw`: characters/art.ts `defineHero`
 * registers `PORTRAITS[id]` after the rig's default portrait, so these win whatever the load order.
 */
import type { Color } from '../../../engine/color';
import type { PixelBuffer } from '../../../engine/pixel';
import { PAL } from '../../../engine/palette';
import { portraitPanel } from '../../art/human-sprites';
import { renderHuman } from '../../art/humanoid';
import type { Density, Expression, HumanStyle, Pose } from '../../art/humanoid';
import { SQUAD, smallPortrait, type SquadId } from './select.art';

export interface PortraitCfg {
  /** Panel gradient, top → bottom (palette colours). */
  bg: readonly Color[];
  expr: Expression;
  /** Extra pose fields (a head tilt, a trailing scarf …). */
  pose?: Pose;
  /** Shift of the 16×16 source crop (+ right / down). */
  dx?: number;
  dy?: number;
  /** A hand-built portrait (32 × 32, 2×: 64 × 64) that replaces the rig render. */
  draw?: (density: Density) => PixelBuffer;
}

/** The squad's portraits: the select-portrait face, zoomed out, on the navy panel. */
function squadPortrait(id: SquadId): PortraitCfg {
  return { bg: [PAL.navy[0], PAL.navy[1], PAL.purple[0]], expr: 'normal', draw: (d) => smallPortrait(id, d) };
}

/** Each hero's panel colour is the complement of the outfit, so the head stands out. */
export const PORTRAITS: Readonly<Record<string, PortraitCfg>> = {
  grace: { bg: [PAL.sky[2], PAL.sky[1], PAL.sky[0]], expr: 'normal', pose: { flutter: 1 }, dx: 1 },
  mittens: { bg: [PAL.teal[2], PAL.teal[1], PAL.teal[0]], expr: 'happy' },
  pip: { bg: [PAL.purple[2], PAL.purple[1], PAL.purple[0]], expr: 'shout' },
  gramps: { bg: [PAL.green[3], PAL.green[2], PAL.green[1]], expr: 'normal' },
  ...Object.fromEntries(SQUAD.map((id) => [id, squadPortrait(id)])),
};

/** Render a hero's 32×32 portrait (`density` 2: its 64×64 2× twin, the same crop). */
export function heroPortrait(style: HumanStyle, c: PortraitCfg, density: Density = 1): PixelBuffer {
  if (c.draw) return c.draw(density);
  const pose: Pose = { armN: { sh: 4, el: 10 }, armF: { sh: -4, el: 10 }, expr: c.expr, ...c.pose };
  const bust = renderHuman(style, pose, 'upper');
  const head = bust.pts.head ?? [0, -14];
  // 16×16 source px → 32×32 after Scale2x: centred on the head, the headgear top 1 px under the
  // crop's top edge (a bobble or a dome is never cut off).
  const top = bust.buf.trimBounds()?.y ?? bust.oy + head[1] - 8;
  const sx = bust.ox + head[0] - 8 + (c.dx ?? 0);
  const sy = top - 1 + (c.dy ?? 0);
  // The 2× bust has the 1× frame's logical geometry, so the same crop (in logical px) fits it.
  const src = density === 1 ? bust.buf : renderHuman(style, pose, 'upper', 2).buf;
  return portraitPanel(src, sx, sy, c.bg, density);
}
