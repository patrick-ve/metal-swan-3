/**
 * COMIC INK (comic.ts): the rig's HD drawing as a G-buffer.
 *
 * The comic renderer re-lights the figure itself (two flat tones, halftone, ink), so it needs the
 * rig's HD canvas (material, part, depth, normal and tone per art px), not its finished pixels.
 * `captureHd` runs `renderHuman` once with two short-lived hooks on `HdCanvas`:
 * - `render` keeps a reference to the LAST canvas it renders (the body: drawBodyHd renders the
 *   head, the gun and the hands first, the body canvas last) and returns the rig's own pixels, so
 *   every cache the rig fills during the call stays exactly as it would be;
 * - `image` lets the caller swap a finished buffer that is placed on the canvas (the head) for its
 *   own version of the same size.
 * Both hooks are installed only for the synchronous call and the previous methods come back in a
 * `finally`: no other caller ever sees them.
 *
 * A fresh copy of the HumanStyle per call keeps the rig's HD memo from handing back an earlier
 * render without painting (a memo hit would leave nothing to capture); the copy is garbage after
 * the call, its geometry cache with it.
 */
import type { PixelBuffer } from '../../../../engine/pixel';
import { HdCanvas } from '../../../art/hd/canvas';
import { renderHuman, type Density, type HumanFrame, type HumanStyle, type Pose, type RenderPart } from '../../../art/humanoid';

export interface Captured {
  /** The rig's own frame (geometry: size, anchor, points; and its pixels). */
  frame: HumanFrame;
  /** The body canvas (null when the rig drew nothing at this density). */
  canvas: HdCanvas | null;
  /** Art px offset of the frame's top-left on the canvas. */
  cropX: number;
  cropY: number;
  /** Part ids of the swapped images (the head). */
  swapped: number[];
}

type ImageFn = HdCanvas['image'];
type RenderFn = HdCanvas['render'];

/**
 * Render a pose through the rig and keep its body canvas. `swap(src)` may return a replacement for
 * any buffer the rig places with `image()` (same size), or null to keep it.
 */
export function captureHd(style: HumanStyle, pose: Pose, part: RenderPart, d: 2 | 4, swap?: (src: PixelBuffer) => PixelBuffer | null): Captured {
  const proto = HdCanvas.prototype as unknown as { render: RenderFn; image: ImageFn };
  const prevRender = proto.render;
  const prevImage = proto.image;
  let last: HdCanvas | null = null;
  const swapped: number[] = [];
  let partSeen = -1;
  proto.render = function (this: HdCanvas, o) {
    last = this;
    return prevRender.call(this, o);
  };
  if (swap) {
    proto.image = function (this: HdCanvas, src, x, y, o = {}) {
      const alt = swap(src);
      if (!alt) return prevImage.call(this, src, x, y, o);
      // The rig gives the head an explicit part id; keep it so the renderer can find the head.
      const id = o.part ?? this.newPart();
      partSeen = id;
      swapped.push(id);
      return prevImage.call(this, alt, x, y, { ...o, part: id });
    };
  }
  let frame: HumanFrame;
  try {
    frame = renderHuman({ ...style }, pose, part, d as Density);
  } finally {
    proto.render = prevRender;
    proto.image = prevImage;
  }
  void partSeen;
  const c = last as HdCanvas | null;
  // drawBodyHd crops its canvas at the frame (a margin of 2 logical px on every side).
  const cropX = c ? Math.round((c.W - frame.buf.w) / 2) : 0;
  const cropY = c ? Math.round((c.H - frame.buf.h) / 2) : 0;
  return { frame, canvas: c, cropX, cropY, swapped };
}
