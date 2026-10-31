/**
 * Art-direction trial style `comic` (kit.ts): COMIC INK — a comic-book page come alive. Bold black
 * brush ink whose weight swells on the side away from the light, flat colour in two tones per
 * material, halftone dots in the shadows and a face drawn with a confident ink line.
 *
 * Built on the rig's own HD drawing (the same skeleton, parts and proportions): comic-capture.ts
 * keeps its G-buffer, comic-ink.ts re-lights and inks it, comic-head.ts draws the face.
 */
import type { PixelBuffer } from '../../../../engine/pixel';
import { PAL_HD } from '../../../../engine/palette-hd';
import { HELIUM_RIM, JOINT_NAMES, poseJoints, renderHuman, type HumanFrame, type HumanStyle, type Pose } from '../../../art/humanoid';
import { drawFolds, type CanvasJoints } from './comic-folds';
import { comic1x } from './comic-1x';
import { captureHd } from './comic-capture';
import { comicHead } from './comic-head';
import { inkRender } from './comic-ink';
import type { ArtStyle } from './kit';

const DEG = Math.PI / 180;

/** The comic head as the rig would place it for this pose (tilted, or twice as large). */
function headFor(style: HumanStyle, pose: Pose, d: 2 | 4): PixelBuffer {
  const big = pose.headScale === 2;
  const tilt = (pose.head?.tilt ?? 0) + (pose.rot ?? 0);
  const tilted = Math.abs(tilt) >= 8;
  const h = comicHead(style, pose.expr ?? 'normal', (big ? 2 * d : d) as 2 | 4 | 8, !tilted);
  return tilted ? h.rotated(tilt * DEG, { align: d }) : h;
}

export const STYLE: ArtStyle = {
  id: 'comic',
  name: 'COMIC INK',
  blurb: 'Bold brush ink with a heavier line on the shadow side, flat two-tone colour and halftone dots.',
  renderPose: (style, pose, part, d) => {
    if (d === 1) return comic1x(renderHuman(style, pose, part, 1));
    const head = part === 'lower' ? null : headFor(style, pose, d);
    const cap = captureHd(style, pose, part, d, head ? (src) => (src.w === head.w && src.h === head.h ? head : null) : undefined);
    const f = cap.frame;
    if (!cap.canvas) return f;
    // The halftone and tweed grids hang on the pelvis (the torso's anchor, the legs' hip point), so
    // they line up across the belt and travel with the body.
    const hp = part === 'upper' ? [0, 0] : (f.pts.hip ?? [0, 0]);
    const ax = cap.cropX + (f.ox + hp[0]) * d;
    const ay = cap.cropY + (f.oy + hp[1]) * d;
    const rim = pose.headScale === 2 && cap.swapped.length > 0 ? { part: cap.swapped[0], color: HELIUM_RIM } : undefined;
    const all = inkRender(cap.canvas, { d, ax, ay, final: new Set(cap.swapped), rim, tweed: d === 4 ? PAL_HD.brown[0] : undefined });
    // The skeleton on the canvas: the pelvis px (the anchor, or the anchor + hip) plus its sub-px rest.
    const J = poseJoints(style, pose);
    const px0 = cap.cropX / d + f.ox + hp[0] - Math.round(J.pelvis[0]) + 0.5;
    const py0 = cap.cropY / d + f.oy + hp[1] - Math.round(J.pelvis[1]) + 0.5;
    const cj = {} as CanvasJoints;
    for (const k of JOINT_NAMES) cj[k] = [px0 + J[k][0], py0 + J[k][1]];
    drawFolds(all, cap.canvas, cj, { d, sleeve: PAL_HD.brown[0], pants: PAL_HD.olive[0] });
    const out: HumanFrame = { ...f, buf: all.crop(cap.cropX, cap.cropY, f.buf.w, f.buf.h) };
    return out;
  },
};
