/**
 * Menu portraits of the heroes (`char/<id>/portrait`, 32×32, top-left anchor; GDD §13.5): the
 * head and shoulders rendered by the rig with the hero's own expression, enlarged with Scale2x
 * (no new colours), on a panel in a colour that sets the hero apart (and keeps the face readable),
 * with a 1-px INK frame. The select screen greys out a taken hero itself.
 */
import type { Color } from '../../../engine/color';
import { PixelBuffer } from '../../../engine/pixel';
import { INK, PAL } from '../../../engine/palette';
import { renderHuman } from '../../art/humanoid';
import type { Expression, HumanStyle, Pose } from '../../art/humanoid';

export interface PortraitCfg {
  /** Panel gradient, top → bottom (palette colours). */
  bg: readonly Color[];
  expr: Expression;
  /** Extra pose fields (a head tilt, a trailing scarf …). */
  pose?: Pose;
  /** Shift of the 16×16 source crop (+ right / down). */
  dx?: number;
  dy?: number;
}

/** Each hero's panel colour is the complement of the outfit, so the head stands out. */
export const PORTRAITS: Readonly<Record<string, PortraitCfg>> = {
  grace: { bg: [PAL.sky[2], PAL.sky[1], PAL.sky[0]], expr: 'normal', pose: { flutter: 1 }, dx: 1 },
  mittens: { bg: [PAL.teal[2], PAL.teal[1], PAL.teal[0]], expr: 'happy' },
  pip: { bg: [PAL.purple[2], PAL.purple[1], PAL.purple[0]], expr: 'shout' },
  gramps: { bg: [PAL.green[3], PAL.green[2], PAL.green[1]], expr: 'normal' },
};

/** Render a hero's 32×32 portrait. */
export function heroPortrait(style: HumanStyle, c: PortraitCfg): PixelBuffer {
  const bust = renderHuman(style, { armN: { sh: 4, el: 10 }, armF: { sh: -4, el: 10 }, expr: c.expr, ...c.pose }, 'upper');
  const head = bust.pts.head ?? [0, -14];
  // 16×16 source px → 32×32 after Scale2x: centred on the head, the headgear top 1 px under the
  // crop's top edge (a bobble or a dome is never cut off).
  const top = bust.buf.trimBounds()?.y ?? bust.oy + head[1] - 8;
  const sx = bust.ox + head[0] - 8 + (c.dx ?? 0);
  const sy = top - 1 + (c.dy ?? 0);
  const crop = bust.buf.crop(sx, sy, 16, 16).scale2x();
  const out = new PixelBuffer(32, 32);
  out.gradient(0, 0, 32, 32, c.bg, { dither: 0.5 });
  out.blit(crop, 0, 1);
  out.strokeRect(0, 0, 32, 32, INK);
  return out;
}
