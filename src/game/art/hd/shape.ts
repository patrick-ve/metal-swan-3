/**
 * Shape helpers for the UHD rig (docs/ART_GUIDE.md "UHD art"): outlines of limbs, sleeves and
 * boots as polygons in LOGICAL px, for `HdCanvas.blob` (soft cloth volumes) and `poly`.
 */

export type Pt = readonly [number, number];

/**
 * The outline of a limb along the joints `pts` (shoulder → elbow → wrist, hip → knee → ankle)
 * with half widths `hw` at every joint: the left side down, the right side back up, a round
 * cap of `cap` segments at both ends (0 = square ends). Joints get a mitred bend, so an elbow
 * keeps its width on the outside and pinches a little on the inside (a fold reads there).
 */
export function limb(pts: readonly Pt[], hw: readonly number[], cap = 3): Array<[number, number]> {
  const n = pts.length;
  const left: Array<[number, number]> = [];
  const right: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0];
    let ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    // Normal (left of the direction of travel) and a mitre that keeps the width at a bend.
    let m = 1;
    if (i > 0 && i < n - 1) {
      const ux = pts[i][0] - a[0];
      const uy = pts[i][1] - a[1];
      const ul = Math.hypot(ux, uy) || 1;
      const cos = (ux / ul) * tx + (uy / ul) * ty;
      m = 1 / Math.max(0.6, Math.sqrt((1 + cos) / 2));
    }
    const w = hw[i] * m;
    left.push([pts[i][0] + ty * w, pts[i][1] - tx * w]);
    right.push([pts[i][0] - ty * w, pts[i][1] + tx * w]);
  }
  const out: Array<[number, number]> = [];
  const capPts = (c: Pt, from: Pt, w: number, dirx: number, diry: number): void => {
    // Half circle around c from `from` side, bulging along (dirx, diry).
    const a0 = Math.atan2(from[1] - c[1], from[0] - c[0]);
    const s = Math.cos(a0 - Math.PI / 2) * dirx + Math.sin(a0 - Math.PI / 2) * diry > 0 ? 1 : -1;
    for (let k = 1; k < cap; k++) {
      const a = a0 - (s * Math.PI * k) / cap;
      out.push([c[0] + Math.cos(a) * w, c[1] + Math.sin(a) * w]);
    }
  };
  out.push(...left);
  if (cap > 0) {
    const e = pts[n - 1];
    const p = pts[n - 2] ?? e;
    const dx = e[0] - p[0];
    const dy = e[1] - p[1];
    const l = Math.hypot(dx, dy) || 1;
    capPts(e, left[n - 1], hw[n - 1], dx / l, dy / l);
  }
  for (let i = n - 1; i >= 0; i--) out.push(right[i]);
  if (cap > 0) {
    const e = pts[0];
    const p = pts[1] ?? e;
    const dx = e[0] - p[0];
    const dy = e[1] - p[1];
    const l = Math.hypot(dx, dy) || 1;
    capPts(e, right[0], hw[0], dx / l, dy / l);
  }
  return out;
}

/** Point at distance `len` from p along angle `a` (deg from straight down, + = forward / right). */
export function along(p: Pt, a: number, len: number): [number, number] {
  const r = (a * Math.PI) / 180;
  return [p[0] + Math.sin(r) * len, p[1] + Math.cos(r) * len];
}

/** Linear interpolation between two points. */
export function lerpPt(a: Pt, b: Pt, t: number): [number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
