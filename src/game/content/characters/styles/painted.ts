/**
 * Art-direction trial style `painted` (kit.ts): PAINTED. VINCENT as a hand-painted figure, like a
 * painted cel or a storybook illustration: no ink outline (edges come from value and colour, a
 * soft dark edge only on the shadow side), many tones per material with brushy transitions, a
 * warm key light from the upper left, cool blue-violet shadows and a little warm light bounced
 * up from the ground.
 *
 * How (own drawer on the rig's skeleton):
 * - 2× / 4× (painted-body.ts, painted-head.ts, painted-paint.ts): the rig's solved skeleton
 *   (painted-rig.ts, a copy of the rig's solve) drives a copy of the HD body's volumes on an
 *   HdCanvas G-buffer, with a painted head drawn into the same canvas; then the painter replaces
 *   the canvas's banded render: soft wrapped light, painted ramps with the hue shift built in,
 *   stroke dither (each brush stroke picks its tone), part-local brushes that move with the limbs,
 *   contact and cast shadows, the form grown into the outline's room with normals turning away.
 *   The rig's gun, hands and props are placed as images with their bands softened.
 * - 1×: the rig's 1× frame with its ink outline repainted: on the lit side the outline px take
 *   the colour of the form beside them, on the shadow side a darker tone of that form's ramp.
 * Proportions and the frame geometry are the rig's (same anchor, points and frame size).
 */
import type { Color } from '../../../../engine/color';
import { INK, PAL } from '../../../../engine/palette';
import type { Ramp } from '../../../../engine/pixel';
import { renderHuman, type Density, type HumanFrame, type HumanStyle, type Pose, type RenderPart } from '../../../art/humanoid';
import type { ArtStyle } from './kit';
import { drawPaintedBody } from './painted-body';
import { frameRect, OX, OY, resolveStyle, rotateAbout, solveSkeleton, type V } from './painted-rig';

/** Our own copy of a style object (the rig caches by style object; never share its entries). */
const copies = new WeakMap<HumanStyle, HumanStyle>();
function own(s: HumanStyle): HumanStyle {
  let c = copies.get(s);
  if (!c) copies.set(s, (c = { ...s }));
  return c;
}

/** Margin of the HD working region round the 1× frame (logical px). */
const M = 2;

function renderPainted(style: HumanStyle, pose: Pose, part: RenderPart, d: Density): HumanFrame {
  const s = own(style);
  const f1 = renderHuman(s, pose, part, 1);
  if (d === 1) return paint1x(f1);
  const dd = d === 4 ? 4 : 2;
  const st = resolveStyle(s);
  const rect = frameRect(st, pose, part, f1);
  const region = [rect.x - M, rect.y - M, rect.w + 2 * M, rect.h + 2 * M] as const;
  // The HD solve: an upper frame hangs on the 1× pelvis pixel, a grounded figure stands on the
  // unrounded ground line (the rig's rule).
  const sk = solveSkeleton(st, pose, part === 'upper' ? 1 : dd);
  const rot = pose.rot ?? 0;
  const dx = pose.dx ?? 0;
  const dy = pose.dy ?? 0;
  const pivot = sk.pelvis;
  const T = (p: V): V => {
    const r = rotateAbout(p, pivot, rot);
    return [r[0] + dx + OX - region[0] + 0.5, r[1] + dy + OY - region[1] + 0.5];
  };
  const buf = drawPaintedBody({ d: dd, w: region[2], h: region[3], st, sk, pose, part, rot, T, frame: { x: M, y: M, w: rect.w, h: rect.h } });
  return { buf, ox: f1.ox, oy: f1.oy, pts: f1.pts, density: dd };
}

// ------------------------------------------------------------------------------------ 1×

/** Every PAL colour → its ramp and index (the first ramp listing it). */
const PAL_HOME = new Map<number, { ramp: Ramp; i: number }>();
for (const r of Object.values(PAL) as Ramp[]) {
  r.forEach((c, i) => {
    const k = c >>> 0;
    if (!PAL_HOME.has(k)) PAL_HOME.set(k, { ramp: r, i });
  });
}

function stepDown(c: Color, k: number): Color {
  const h = PAL_HOME.get(c >>> 0);
  if (!h) return c;
  return h.ramp[Math.max(0, h.i - k)];
}

/**
 * The 1× repaint: every ink px on the silhouette takes the colour of the form beside it (the
 * inside neighbour); on the shadow side (the empty side to the right or below) a step or two
 * darker. Same size, anchor and points; PAL colours only.
 */
function paint1x(f: HumanFrame): HumanFrame {
  const src = f.buf;
  const buf = src.clone();
  const { w, h, data } = src;
  const ink = INK >>> 0;
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= w || y >= h ? 0 : data[y * w + x]);
  const isInk = (c: number): boolean => (c & 255) !== 0 && (c >>> 0) === ink;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = data[y * w + x];
      if (!isInk(c)) continue;
      // Only the silhouette (an empty px beside it).
      const eR = (at(x + 1, y) & 255) === 0;
      const eD = (at(x, y + 1) & 255) === 0;
      const eL = (at(x - 1, y) & 255) === 0;
      const eU = (at(x, y - 1) & 255) === 0;
      if (!eR && !eD && !eL && !eU) continue;
      // The form beside it: the nearest non-ink opaque neighbour, preferring the side away from the empty one.
      const cands: Array<[number, number]> = [];
      if (eR) cands.push([-1, 0]);
      if (eL) cands.push([1, 0]);
      if (eD) cands.push([0, -1]);
      if (eU) cands.push([0, 1]);
      cands.push([-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]);
      let form = 0;
      for (const [ddx, ddy] of cands) {
        const q = at(x + ddx, y + ddy);
        if ((q & 255) !== 0 && !isInk(q)) {
          form = q;
          break;
        }
      }
      if (!form) continue;
      const shadow = (eR || eD) && !(eL || eU);
      const corner = (eR || eD) && (eL || eU);
      buf.data[y * w + x] = shadow ? stepDown(form, 2) : corner ? stepDown(form, 1) : form;
    }
  }
  buf.touch();
  return { ...f, buf };
}

export const STYLE: ArtStyle = {
  id: 'painted',
  name: 'PAINTED',
  blurb: 'Hand-painted: no hard outline, soft brush strokes, warm light and cool shadows.',
  renderPose: renderPainted,
};
