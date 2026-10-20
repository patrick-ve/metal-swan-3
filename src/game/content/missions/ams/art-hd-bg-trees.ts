/**
 * Trees for the UHD background layers of mission `ams` (quay trees, the elms, Museumplein's plane
 * trees). A canopy is built from the 1× generator's leaf MASSES (same places and radii, so the
 * layer keeps its footprint); each mass is painted as:
 *
 * 1. its ragged disc in the deepest leaf tones (the shade inside the crown: the deep gaps),
 * 2. 5–9 leaf CLUSTERS inside it, drawn from the bottom up so every upper cluster's dark underside
 *    overlaps the cluster below (shelves of foliage, not round bumps): each cluster has a lit top
 *    (key light from the upper left), a mid body, a dark underside band and a leafy edge notched
 *    per leaf cell; leaf cells (¾ logical px) vary by half a tone, and at 4× the lit cells get a
 *    glint px. Clusters low in the crown and on its right are darker (the crown shades itself).
 *
 * No outline (backgrounds); the background canvas is a BgCanvas (palette indices).
 */
import { hash2 } from '../../../art/paint';
import { type BgCanvas } from './art-hd-bg-kit';

/** Scratch cell hashes of the mass being painted (grown when needed). */
let H5 = new Float32Array(0);
let H6 = new Float32Array(0);
let H11 = new Float32Array(0);

/** A leaf ramp of palette indices, dark → light (6–8 tones). */
export type LeafRamp = Uint8Array;

/**
 * One leaf mass (centre and radii in logical px; `ry` defaults to `br`) of a crown (centre and
 * radius, for the self-shading). `lift` (−1…1) shifts the whole mass lighter (+) or darker (−).
 */
export function leafMass(
  c: BgCanvas,
  bx: number,
  by: number,
  br: number,
  leaf: LeafRamp,
  seed: number,
  crown: { x: number; y: number; r: number },
  lift = 0,
  ry0 = br,
): void {
  const d = c.d;
  const n = leaf.length - 1;
  // Leaf cells (one logical px): three hashes per cell, computed once per mass.
  const gx0 = Math.floor(bx - br) - 1;
  const gy0 = Math.floor(by - ry0) - 1;
  const gw = Math.ceil(br * 2) + 3;
  const gh = Math.ceil(ry0 * 2) + 3;
  const need = gw * gh;
  if (H5.length < need) {
    H5 = new Float32Array(need * 2);
    H6 = new Float32Array(need * 2);
    H11 = new Float32Array(need * 2);
  }
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const k = j * gw + i;
      H5[k] = hash2(gx0 + i, gy0 + j, seed + 5);
      H6[k] = hash2(gx0 + i, gy0 + j, seed + 6);
      H11[k] = hash2(gx0 + i, gy0 + j, seed + 11);
    }
  }
  /** The cell index of an art px (clamped into the mass grid). */
  const cellOf = (X: number, Y: number): number => {
    const i = Math.min(gw - 1, Math.max(0, Math.floor(X / d) - gx0));
    const j = Math.min(gh - 1, Math.max(0, Math.floor(Y / d) - gy0));
    return j * gw + i;
  };
  const deep = leaf[2 + (lift > 0.25 ? 1 : 0)];
  const deepTop = leaf[3 + (lift > 0.25 ? 1 : 0)];
  // 1. The deep inside of the mass, its rim ragged by leaf cells.
  c.disc(bx, by, br, ry0, (X, Y, u, v) => {
    const k = cellOf(X, Y);
    const r2 = u * u + v * v;
    const e = 1 - 0.1 * H5[k];
    if (r2 > e * e) return 0;
    // Deep gaps: a few cells in the middle of the mass in the deepest green.
    if (r2 < 0.35 && H6[k] < 0.12) return leaf[1];
    return v < -0.25 ? deepTop : deep;
  });
  // 2. Clusters spread over the whole mass (more on a big one), drawn bottom first.
  const k = Math.max(6, Math.min(18, Math.round((br * ry0) / 9))) + Math.floor(hash2(bx | 0, by | 0, seed + 7) * 3);
  const cl: Array<[number, number, number]> = [];
  for (let i = 0; i < k; i++) {
    const a = hash2(i, 1, seed) * Math.PI * 2;
    const rr = Math.sqrt(hash2(i, 2, seed)) * 0.8;
    const cr = Math.max(2.2, br * (0.24 + hash2(i, 3, seed) * 0.16));
    cl.push([bx + Math.cos(a) * rr * br, by + Math.sin(a) * rr * ry0 - ry0 * 0.05, cr]);
  }
  cl.sort((p, q) => q[1] - p[1]);
  for (const [qx, qy, qr] of cl) {
    // Self-shade: low and right in the crown is darker; the crown's top left is the lightest.
    const sx = (qx - crown.x) / crown.r;
    const sy = (qy - crown.y) / crown.r;
    const base = 3.3 + lift - sy * 1.1 - sx * 0.45;
    const ry = qr * 0.74;
    c.disc(qx, qy, qr, ry, (X, Y, u, v) => {
      const hv = H11[cellOf(X, Y)];
      // Leafy edge: each leaf cell notches the rim (more at the bottom).
      const e = 1 - (0.1 + (v > 0 ? 0.12 : 0)) * hv;
      if (u * u + v * v > e * e) return 0;
      let t = base + (-u * 0.5 - v * 0.9) * 1.25 + (hv - 0.5) * 0.5;
      // The dark underside band (the shelf's shadow on the leaves below).
      if (v > 0.55) t -= 1;
      if (t >= n - 0.4 && d === 4 && (X & 3) === 0 && (Y & 3) === 1 && hv > 0.55) return leaf[n];
      const ti = Math.round(t);
      return leaf[ti < 2 ? 2 : ti > n - 1 ? n - 1 : ti];
    });
  }
}

/** A trunk from (x, y0) down to y1 (logical px), `tw` wide: lit left, shaded right, bark furrows. */
export function trunk(c: BgCanvas, x: number, y0: number, y1: number, tw: number, bark: Uint8Array, seed: number): void {
  const d = c.d;
  const X0 = Math.round(x * d);
  const X1 = Math.round((x + tw) * d);
  const n = bark.length - 1;
  for (let Y = Math.round(y0 * d); Y < Math.round(y1 * d); Y++) {
    for (let X = X0; X < X1; X++) {
      const u = (X - X0 + 0.5) / (X1 - X0);
      // Cylinder light: lit left third, mid, shaded right.
      let t = u < 0.3 ? n - 1 : u < 0.7 ? n - 2 : n - 3;
      // Furrows: vertical dark runs, broken every few logical px.
      const col = Math.floor((X - X0) / Math.max(1, d >> 1));
      if (hash2(col, Math.floor(Y / (d * 3)), seed) < 0.28) t -= 1;
      c.dot(X, Y, bark[t < 0 ? 0 : t > n ? n : t]);
    }
  }
}
