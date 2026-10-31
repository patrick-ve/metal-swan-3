/**
 * Art-direction trial style `clay` (kit.ts): CLAY TOY — VINCENT as a plasticine stop-motion
 * puppet. Soft rounded volumes (sausage limbs, a pear torso, mitten hands, bean boots, a big
 * sculpted head), matte clay with a broad satin sheen and faint thumb marks, dark crevices and a
 * wide soft contact shade where parts meet, saturated toy colours, a thin dark outline.
 *
 * Built as its own drawer on the HD canvas (src/game/art/hd/canvas.ts): the skeleton is the
 * rig's own solve (clay.rig.ts, so hip, muzzle and hand points stay the game's), the volumes are
 * new (clay.paint.ts body and gear, clay.head.ts head). The 1× frame is the same drawer at d 1 in
 * `PAL` ramps and fixes the frame geometry; the 2× / 4× frames are drawn natively into it.
 */
import { PixelBuffer } from '../../../../engine/pixel';
import { PAL } from '../../../../engine/palette';
import type { HdCanvas, Outline } from '../../../art/hd/canvas';
import type { Density, HumanFrame, HumanStyle, Pose, RenderPart } from '../../../art/humanoid';
import type { ArtStyle } from './kit';
import { drawHead } from './clay.head';
import { ClayPainter, CH, CW, drawArm, drawBoot, drawGun, drawHand, drawHeld, drawLeg, drawTorso, OX, OY, Z } from './clay.paint';
import { placedGunPts, solve, type V } from './clay.rig';

/** Outline at 2× / 4×: B = ink, ½ logical px (the thin dark line of a toy on a shelf). */
const OUTLINE: Outline = 'B';

interface Painted {
  buf: PixelBuffer;
  /** Anchor and points on the working canvas (index px; only for the 1× render). */
  anchor: V;
  pts: Record<string, V>;
}

/** Draw the figure into `region` of the working canvas at density d; `frame` = the 1× rectangle. */
function paint(style: HumanStyle, pose: Pose, part: RenderPart, d: number, region: readonly [number, number, number, number], frame?: { x: number; y: number; w: number; h: number }): Painted {
  const sk = solve(style, pose, part === 'upper' ? 1 : d);
  const p = new ClayPainter(style, sk, pose, part, d, region);
  const upper = part !== 'lower';
  const lower = part !== 'upper';
  const pts: Record<string, V> = {};
  let headParts: number[] = [];
  if (upper) {
    if (sk.offGun) drawGun(p, sk.offGun, Z.offGun);
    drawArm(p, sk.shF, sk.elF, sk.wrF, true, Z.farArm);
    drawHand(p, sk.elF, sk.wrF, sk.handF, true, Z.farHand);
  }
  if (lower) {
    drawLeg(p, sk.hipF, sk.kneeF, sk.ankleF, true, false, Z.farLeg);
    drawBoot(p, sk.ankleF, sk.footF, true, Z.farBoot);
    drawLeg(p, sk.hipN, sk.kneeN, sk.ankleN, false, true, Z.nearLeg);
    drawBoot(p, sk.ankleN, sk.footN, false, Z.nearBoot);
  }
  if (upper) {
    drawTorso(p);
    // A near arm whose hand or forearm would cross the face goes behind the head (the rig's rule).
    const nk = sk.neck;
    const inFace = (q: V): boolean => q[0] >= nk[0] && q[0] <= nk[0] + 6 && q[1] >= nk[1] - 9 && q[1] <= nk[1] - 1;
    const mid: V = [(sk.elN[0] + sk.wrN[0]) / 2, (sk.elN[1] + sk.wrN[1]) / 2];
    const raised = inFace(sk.wrN) || inFace(mid);
    const headZ = raised ? Z.held + 8 : Z.head;
    const head = drawHead(p, headZ);
    headParts = head.parts;
    pts.head = head.center;
    if (sk.gun) {
      drawGun(p, sk.gun, Z.gun);
      const at0 = p.T0(sk.gun.grip);
      const pl = placedGunPts(sk.gun, p.rot);
      const ox = Math.round(at0[0] - pl.grip[0]);
      const oy = Math.round(at0[1] - pl.grip[1]);
      pts.muzzle = [ox + pl.muzzle[0], oy + pl.muzzle[1]];
    }
    drawArm(p, sk.shN, sk.elN, sk.wrN, false, Z.arm);
    const held = drawHeld(p, sk.elN, sk.wrN, pose.held ?? 'none', Z.knife, Z.held);
    // A thumbs-up stays in front of the face, so the gesture reads.
    drawHand(p, sk.elN, sk.wrN, sk.handN, false, raised && sk.handN === 'thumb' ? headZ + 20 : Z.hand);
    pts.hand = held ?? p.T0(sk.wrN);
  }
  const pel = p.T0(sk.pelvis);
  const pelPx: V = [Math.round(pel[0]), Math.round(pel[1])];
  if (lower) pts.hip = pelPx;

  contactShade(p.c, 0.32, 1.4);
  const ow = OUTLINE === 'A' || d === 1 ? d : Math.max(1, d >> 1);
  const crop = frame ? fitFrame(p.c, frame, ow) : null;
  const out = p.c.render({ outline: d === 1 ? 'A' : OUTLINE, ao: 0.22, rimLight: 1, shadow: 0.16, shadowMax: 1.6, sepW: 1 });
  if (upper && pose.headScale === 2) pinkRim(p.c, out, new Set(headParts), Math.max(1, ow));
  const buf = crop ? out.crop(crop[0], crop[1], crop[2], crop[3]) : out;

  let anchor: V = part === 'upper' ? pelPx : [OX, OY];
  if (part !== 'upper' && pose.grounded !== false && (pose.rot ?? 0) !== 0 && !frame) {
    // A turned grounded pose (falling, lying): rest its lowest px on the ground line (the rig's rule).
    const b = buf.trimBounds();
    if (b) {
      const lowest = b.y + b.h - 1 + region[1];
      const target = OY - 1 + (pose.dy ?? 0);
      anchor = [OX, OY - (target - lowest)];
    }
  }
  return { buf, anchor, pts };
}

/**
 * The soft contact shade of clay parts that touch: every px near a NEARER part darkens with the
 * nearness (1 / distance), out to `radius` logical px — wider and softer than the canvas's own AO.
 */
function contactShade(c: HdCanvas, strength: number, radius: number): void {
  const { W, H, d, mat, part, pz, fix, tone } = c;
  const R = Math.max(1, Math.round(radius * d));
  const step = d >= 4 ? 2 : 1;
  const DX = [-1, 1, 0, 0, -1, 1, -1, 1];
  const DY = [0, 0, -1, 1, -1, -1, 1, 1];
  let norm = 0;
  for (let k = step; k <= R; k += step) norm += 8 / k;
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const i = Y * W + X;
      if (mat[i] === 0 || fix[i] !== 0) continue;
      const pi = part[i];
      const z0 = pz[i] + 0.5;
      let occ = 0;
      for (let k = step; k <= R; k += step) {
        for (let dir = 0; dir < 8; dir++) {
          const XX = X + DX[dir] * k;
          const YY = Y + DY[dir] * k;
          if (XX < 0 || YY < 0 || XX >= W || YY >= H) continue;
          const j = YY * W + XX;
          if (mat[j] !== 0 && part[j] !== pi && pz[j] > z0) occ += 1 / k;
        }
      }
      if (occ > 0) tone[i] -= (strength * occ) / norm;
    }
  }
}

/** Trim what reaches past the room inside the outline of the 1× rectangle (hd/body.ts `fitFrame`). */
function fitFrame(c: HdCanvas, f: { x: number; y: number; w: number; h: number }, ow: number): [number, number, number, number] {
  const { W, H, d } = c;
  const cx = Math.round(f.x * d);
  const cy = Math.round(f.y * d);
  const cw = Math.round(f.w * d);
  const ch = Math.round(f.h * d);
  const ax = cx + ow;
  const ay = cy + ow;
  const bx = cx + cw - ow;
  const by = cy + ch - ow;
  for (let Y = 0; Y < H; Y++) {
    const inY = Y >= ay && Y < by;
    for (let X = 0; X < W; X++) {
      const i = Y * W + X;
      if (c.mat[i] === 0 || (inY && X >= ax && X < bx)) continue;
      c.mat[i] = 0;
      c.fix[i] = 0;
    }
  }
  return [cx, cy, cw, ch];
}

/** Helium Head: the outline px near the head turn pink (the rig's rim). */
function pinkRim(c: HdCanvas, out: PixelBuffer, head: ReadonlySet<number>, r: number): void {
  const { W, H } = c;
  const pink = PAL.pink[1] >>> 0;
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const i = Y * W + X;
      if (c.mat[i] !== 0 || (out.data[i] & 255) === 0) continue;
      let hit = false;
      for (let dy = -r; dy <= r && !hit; dy++) {
        const yy = Y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -r; dx <= r; dx++) {
          const xx = X + dx;
          if (xx < 0 || xx >= W || dx * dx + dy * dy > r * r + r * 0.5) continue;
          const j = yy * W + xx;
          if (c.mat[j] !== 0 && head.has(c.part[j])) {
            hit = true;
            break;
          }
        }
      }
      if (hit) out.data[i] = pink;
    }
  }
  out.touch();
}

interface Geometry {
  x: number;
  y: number;
  w: number;
  h: number;
  ox: number;
  oy: number;
  pts: Readonly<Record<string, readonly [number, number]>>;
}

const geometry = new WeakMap<HumanStyle, Map<string, Geometry>>();
const memo = new Map<string, PixelBuffer>();
const MEMO_MAX = 64;
const styleIds = new WeakMap<HumanStyle, number>();
let nextId = 1;

/** One pose of the rig as a clay toy (the frame contract of `renderHuman`). */
export function renderClay(style: HumanStyle, pose: Pose, part: RenderPart, density: Density): HumanFrame {
  const key = JSON.stringify([part, pose]);
  let g = geometry.get(style)?.get(key);
  if (density === 1 || !g) {
    const lo = paint(style, pose, part, 1, [0, 0, CW, CH]);
    const b = lo.buf.trimBounds() ?? { x: lo.anchor[0], y: lo.anchor[1], w: 1, h: 1 };
    const rel: Record<string, readonly [number, number]> = {};
    for (const [k, q] of Object.entries(lo.pts)) rel[k] = [Math.round(q[0] - lo.anchor[0]), Math.round(q[1] - lo.anchor[1])];
    g = { x: b.x, y: b.y, w: b.w, h: b.h, ox: lo.anchor[0] - b.x, oy: lo.anchor[1] - b.y, pts: rel };
    let m = geometry.get(style);
    if (!m) geometry.set(style, (m = new Map()));
    m.set(key, g);
    if (density === 1) return { buf: lo.buf.crop(b.x, b.y, b.w, b.h), ox: g.ox, oy: g.oy, pts: g.pts };
  }
  const d = density === 4 ? 4 : 2;
  let sid = styleIds.get(style);
  if (sid === undefined) styleIds.set(style, (sid = nextId++));
  const mk = `${sid}|${d}|${key}`;
  const hit = memo.get(mk);
  if (hit) return { buf: hit.clone(), ox: g.ox, oy: g.oy, pts: g.pts, density: d };
  const M = 2;
  const out = paint(style, pose, part, d, [g.x - M, g.y - M, g.w + 2 * M, g.h + 2 * M], { x: M, y: M, w: g.w, h: g.h }).buf;
  if (memo.size >= MEMO_MAX) memo.delete(memo.keys().next().value as string);
  memo.set(mk, out.clone());
  return { buf: out, ox: g.ox, oy: g.oy, pts: g.pts, density: d };
}


export const STYLE: ArtStyle = {
  id: 'clay',
  name: 'CLAY TOY',
  blurb: 'A plasticine stop-motion puppet: soft rounded volumes, a satin sheen, thumb-pressed clay, soft contact shadows, saturated toy colours.',
  renderPose: (style, pose, part, d) => renderClay(style, pose, part, d),
};
