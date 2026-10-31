/**
 * Art-direction trial style `gritty` (kit.ts): GRITTY — military realism, a grounded, serious
 * soldier in a late-90s realistic-shooter mood. VINCENT redrawn by our own drawer (not the rig's
 * pictures): taller and leaner (about 6½ heads, a small hard head), muted colours (dusty tweed,
 * olive drab, worn leather, a dull red tie), a hard key light from the upper left with deep
 * shadows, a strong cool rim on the edges turned away from it, a thin dark outline that sinks into
 * the shadow side, and more detail (seams, pockets, patches, scuffs, dirt, stubble).
 *
 * - gritty-rig.ts: the skeleton (the rig's solve with GRITTY's bones; the gun held with weight);
 * - gritty-paint.ts: the painter (lit volumes on an HdCanvas, our rim and outline passes);
 * - gritty-head.ts: the head (a sculpted height field, VINCENT's face);
 * - gritty-pal.ts: the muted ramps (PAL_HD; snapped to PAL at 1×).
 *
 * The frame contract (kit.ts): the 1× frame is drawn first and fixes the logical rectangle, the
 * anchor (feet for 'full' / 'lower', the pelvis for 'upper') and the points; a 2× / 4× frame is
 * the same figure drawn natively at that density inside that rectangle.
 */
import type { Density, HumanFrame, HumanStyle, Pose, RenderPart } from '../../../art/humanoid';
import { PixelBuffer } from '../../../../engine/pixel';
import type { ArtStyle } from './kit';
import { paintFigure } from './gritty-paint';
import { K, rotateAbout, solve, type Skel, type V } from './gritty-rig';

/** Where the 1× frame lies on its canvas: rectangle, anchor, offset (body → canvas) and points. */
interface Geo {
  x: number;
  y: number;
  w: number;
  h: number;
  ox: number;
  oy: number;
  off: V;
  pts: Readonly<Record<string, readonly [number, number]>>;
}

const geoCache = new Map<string, Geo>();
const hdMemo = new Map<string, PixelBuffer>();
const HD_MEMO_MAX = 64;

/** Sole height of the solve: the 1× outline (1 px) or the HD outline (½ px) rests on the ground line. */
const SOLE_1X = -1;
const SOLE_HD = -0.5;

/** Body space → canvas (rotation about the pelvis, the pose's offsets, then `off`). */
function bodyT(sk: Skel, pose: Pose, off: V): (p: V) => V {
  const rot = pose.rot ?? 0;
  const dx = (pose.dx ?? 0) * K.body;
  const dy = (pose.dy ?? 0) * K.body;
  const pv = sk.pelvis;
  return (p) => {
    const r = rotateAbout(p, pv, rot);
    return [r[0] + dx + off[0], r[1] + dy + off[1]];
  };
}

/** Canvas origin (integer, body' coords) and size of a generous 1× region round the figure. */
function regionOf(sk: Skel, pose: Pose, part: RenderPart): [number, number, number, number] {
  const T = bodyT(sk, pose, [0, 0]);
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const take = (p: V, r: number): void => {
    const q = T(p);
    x0 = Math.min(x0, q[0] - r);
    y0 = Math.min(y0, q[1] - r);
    x1 = Math.max(x1, q[0] + r);
    y1 = Math.max(y1, q[1] + r);
  };
  take(sk.pelvis, 7);
  if (part !== 'upper') for (const p of [sk.kneeN, sk.ankleN, sk.kneeF, sk.ankleF]) take(p, 8);
  if (part !== 'lower') {
    for (const p of [sk.neck, sk.shN, sk.elN, sk.wrN, sk.shF, sk.elF, sk.wrF]) take(p, 5);
    const big = pose.headScale === 2 ? 2 : 1;
    take(sk.neck, 11 * big + 2);
    for (const g of [sk.gun, sk.offGun]) if (g) take(g.grip, 22);
    if (pose.held && pose.held !== 'none') take(sk.wrN, 16);
  }
  const X0 = Math.floor(x0) - 2;
  const Y0 = Math.floor(y0) - 2;
  return [X0, Y0, Math.ceil(x1) + 2 - X0, Math.ceil(y1) + 2 - Y0];
}

function keyOf(pose: Pose, part: RenderPart): string {
  return `${part}|${JSON.stringify(pose)}`;
}

/** Relative point (pixel index convention of the rig: a canvas centre coordinate − ½, rounded). */
function rel(p: V, a: V): [number, number] {
  return [Math.round(p[0] - 0.5 - a[0]), Math.round(p[1] - 0.5 - a[1])];
}

/** The 1× frame and its geometry. */
function render1(pose: Pose, part: RenderPart): { f: HumanFrame; g: Geo } {
  const sk = solve(pose, SOLE_1X);
  const [rx, ry, rw, rh] = regionOf(sk, pose, part);
  let off: V = [-rx, -ry];
  if (part === 'upper') {
    // The pelvis on the centre of a canvas px (the anchor px).
    const cp = bodyT(sk, pose, off)(sk.pelvis);
    off = [off[0] + Math.floor(cp[0]) + 0.5 - cp[0], off[1] + Math.floor(cp[1]) + 0.5 - cp[1]];
  }
  const T = bodyT(sk, pose, off);
  const out = paintFigure({ d: 1, w: rw, h: rh, sk, pose, part, T, rot: pose.rot ?? 0 });
  const buf = out.buf;
  const pel = T(sk.pelvis);
  let anchor: V = part === 'upper' ? [Math.floor(pel[0]), Math.floor(pel[1])] : [off[0], off[1]];
  const b = buf.trimBounds() ?? { x: Math.round(anchor[0]), y: Math.round(anchor[1]), w: 1, h: 1 };
  if (part !== 'upper' && pose.grounded !== false && (pose.rot ?? 0) !== 0) {
    // A turned grounded pose (falls, deaths) rests its lowest px on the ground line (then dy).
    const lowest = b.y + b.h - 1;
    anchor = [anchor[0], lowest + 1 - (pose.dy ?? 0) * K.body];
  }
  const ax = Math.round(anchor[0]);
  const ay = Math.round(anchor[1]);
  const A: V = [ax, ay];
  const pts: Record<string, readonly [number, number]> = {};
  for (const [k, p] of Object.entries(out.pts)) pts[k] = rel(p, A);
  if (part !== 'upper') pts.hip = [Math.floor(pel[0]) - ax, Math.floor(pel[1]) - ay];
  const crop = buf.crop(b.x, b.y, b.w, b.h);
  const f: HumanFrame = { buf: crop, ox: ax - b.x, oy: ay - b.y, pts };
  // The anchor may move (re-grounding): keep the offset that maps body → canvas, and the rect.
  return { f, g: { x: b.x, y: b.y, w: b.w, h: b.h, ox: f.ox, oy: f.oy, off, pts } };
}

/** The 2× / 4× frame inside the 1× rectangle. */
function renderHd(pose: Pose, part: RenderPart, d: 2 | 4, g: Geo): PixelBuffer {
  const M = 2;
  const grounded = part !== 'upper' && pose.grounded !== false;
  const sk = solve(pose, grounded ? SOLE_HD : SOLE_1X);
  const off: V = [g.off[0] - (g.x - M), g.off[1] - (g.y - M)];
  // HD keeps the 1× pelvis for the upper body (it hangs on the legs' hip point).
  const T = bodyT(sk, pose, off);
  const out = paintFigure({ d, w: g.w + 2 * M, h: g.h + 2 * M, sk, pose, part, T, rot: pose.rot ?? 0, frame: { x: M, y: M, w: g.w, h: g.h } });
  return out.buf;
}

export function renderGritty(_style: HumanStyle, pose: Pose, part: RenderPart, d: Density): HumanFrame {
  const key = keyOf(pose, part);
  let g = geoCache.get(key);
  if (d === 1 || !g) {
    const r = render1(pose, part);
    g = r.g;
    geoCache.set(key, g);
    if (d === 1) return r.f;
  }
  const dd = d === 4 ? 4 : 2;
  const mk = `${dd}|${key}`;
  let buf = hdMemo.get(mk);
  if (!buf) {
    buf = renderHd(pose, part, dd, g);
    if (hdMemo.size >= HD_MEMO_MAX) hdMemo.delete(hdMemo.keys().next().value as string);
    hdMemo.set(mk, buf);
  }
  return { buf: buf.clone(), ox: g.ox, oy: g.oy, pts: g.pts, density: dd };
}

export const STYLE: ArtStyle = {
  id: 'gritty',
  name: 'GRITTY',
  blurb: 'Military realism: taller proportions, muted olive and brown, hard key light, a strong rim and detailed gear.',
  renderPose: renderGritty,
};
