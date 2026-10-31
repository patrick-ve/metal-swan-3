/**
 * COMIC INK (comic.ts): the inker's cloth folds. Short tapered brush strokes drawn from the
 * skeleton (poseJoints) where cloth bunches: the inside of a bent elbow (the tweed sleeve), the
 * back of a bent knee (the trousers) and the trouser leg bunching over the boot. Each stroke starts
 * at the inner edge of the bend with a fat end and thins out across the limb; it only paints over
 * the px of the limb's own part, so it never leaks onto the torso or past the silhouette.
 */
import type { PixelBuffer } from '../../../../engine/pixel';
import type { HdCanvas } from '../../../art/hd/canvas';
import type { PoseJoints } from '../../../art/humanoid';
import { INK } from './comic-ink';

type V = readonly [number, number];

const norm = (v: V): [number, number] => {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
};
const rot = (v: V, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
};

/** Joints on the canvas (logical px). */
export type CanvasJoints = Record<keyof PoseJoints, [number, number]>;

export interface FoldOpts {
  d: number;
  /** Ramps of the sleeve and the trousers: a stroke only paints px of these materials' parts. */
  sleeve: number;
  pants: number;
}

/**
 * Paint fold strokes onto `out` (the canvas-sized ink buffer). `j`: the joints on the canvas.
 */
export function drawFolds(out: PixelBuffer, c: HdCanvas, j: CanvasJoints, o: FoldOpts): void {
  const { W, H, mat, part, fix } = c;
  const d = o.d;
  const at = (p: V): number => {
    const X = Math.floor(p[0] * d);
    const Y = Math.floor(p[1] * d);
    return X < 0 || Y < 0 || X >= W || Y >= H ? -1 : Y * W + X;
  };
  /** The part of the cloth px nearest to p (within 1 logical px) of a ramp, or -1. */
  const partAt = (p: V, rampFirst: number): number => {
    for (let r = 0; r <= d; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const i = at([p[0] + dx / d, p[1] + dy / d]);
          if (i < 0 || mat[i] === 0 || fix[i] !== 0) continue;
          if (c.getMaterial(mat[i]).ramp[0] === rampFirst) return part[i];
        }
      }
    }
    return -1;
  };
  /** A tapered stroke from a (width w0 logical) to b (w1), clipped to px of part `pt`. */
  const stroke = (a: V, b: V, w0: number, w1: number, pt: number): void => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(2, Math.ceil(len * d * 2));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = a[0] + (b[0] - a[0]) * t;
      const y = a[1] + (b[1] - a[1]) * t;
      const r = ((w0 + (w1 - w0) * t) * d) / 2;
      const X0 = Math.floor(x * d - r);
      const X1 = Math.ceil(x * d + r);
      const Y0 = Math.floor(y * d - r);
      const Y1 = Math.ceil(y * d + r);
      for (let Y = Y0; Y <= Y1; Y++) {
        if (Y < 0 || Y >= H) continue;
        for (let X = X0; X <= X1; X++) {
          if (X < 0 || X >= W) continue;
          const dx = X + 0.5 - x * d;
          const dy = Y + 0.5 - y * d;
          if (dx * dx + dy * dy > r * r + 0.15) continue;
          const i = Y * W + X;
          if (mat[i] === 0 || part[i] !== pt || fix[i] !== 0) continue;
          out.data[i] = INK;
        }
      }
    }
  };
  /**
   * Folds inside the bend at joint b between limb a-b and b-c: strokes from the inner edge (half
   * width `rad`) across the limb, splayed towards both segments.
   */
  const bend = (a: V, b: V, cc: V, rad: number, rampFirst: number, count: number, minDeg: number): void => {
    const u = norm([a[0] - b[0], a[1] - b[1]]);
    const v = norm([cc[0] - b[0], cc[1] - b[1]]);
    const cos = u[0] * v[0] + u[1] * v[1];
    const ang = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
    if (180 - ang < minDeg) return;
    const inner = norm([u[0] + v[0], u[1] + v[1]]);
    const pt = partAt(b, rampFirst);
    if (pt < 0) return;
    const start: V = [b[0] + inner[0] * rad * 0.85, b[1] + inner[1] * rad * 0.85];
    // Splay: towards each segment, across the limb.
    const across: V = [-inner[0], -inner[1]];
    const spread = count === 1 ? [0] : [-28, 26];
    const lens = count === 1 ? [1.25] : [1.35, 1.05];
    spread.forEach((s, k) => {
      const dir = rot(across, s);
      const s0: V = [start[0] + dir[1] * 0.15 * (k ? 1 : -1), start[1] - dir[0] * 0.15 * (k ? 1 : -1)];
      const end: V = [s0[0] + dir[0] * rad * lens[k], s0[1] + dir[1] * rad * lens[k]];
      stroke(s0, end, 0.8, 0.2, pt);
    });
  };
  // Near elbow: two strokes; the far elbow sits in shade, one.
  bend(j.shN, j.elN, j.wrN, 1.5, o.sleeve, 2, 20);
  bend(j.shF, j.elF, j.wrF, 1.5, o.sleeve, 1, 30);
  // Knees: the back of the bend.
  bend(j.hipN, j.kneeN, j.ankleN, 2.1, o.pants, 2, 22);
  bend(j.hipF, j.kneeF, j.ankleF, 2.1, o.pants, 1, 30);
  // Trousers bunching over the near boot: one stroke across the shin above the ankle.
  {
    const a = j.kneeN;
    const b = j.ankleN;
    const s = norm([b[0] - a[0], b[1] - a[1]]);
    const p: V = [b[0] - s[0] * 2.4, b[1] - s[1] * 2.4];
    const pt = partAt(p, o.pants);
    if (pt >= 0) {
      const nrm: V = [-s[1], s[0]];
      const side = nrm[0] < 0 ? -1 : 1; // start on the back of the leg
      const a0: V = [p[0] - nrm[0] * side * 1.8, p[1] - nrm[1] * side * 1.8];
      const a1: V = [p[0] + nrm[0] * side * 0.2 + s[0] * 0.35, p[1] + nrm[1] * side * 0.2 + s[1] * 0.35];
      stroke(a0, a1, 0.7, 0.2, pt);
    }
  }
}
