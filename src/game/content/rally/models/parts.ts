/**
 * Parts every car model shares (docs/design/rally.md §6): box ends with an upright texture, the two
 * plates, the dark wheel wells, the wheel anchors and meshes (one local wheel per side for the
 * spinning wheels, the four in place for the static draw), the lamp meshes (emissive, additive).
 * Pure; setup code.
 */
import type { Mesh3 } from '../../../../engine/view3d';
import { MeshBuilder, type UV4 } from '../mesh';
import { S, type Slot } from '../tex/car-palette';
import type { CarSheet } from '../tex/car-sheet';
import type { TexRect } from '../tex/kit';
import { decal, face, lampQuad, wheel } from './loft';
import type { P3, WheelAnchor } from './types';

/**
 * A depth bias for a mesh that lies on another surface (GL's optional `bias`, 0..16; read
 * additively by gl3d.browser.ts until the contract lists it): the blob shadow over the road, the
 * lamp glows on the body. Returns the same mesh.
 */
export function withBias(m: Mesh3, bias: number): Mesh3 {
  return Object.assign(m, { bias });
}

/** One lamp quad: its centre, the face normal, the half sizes along the face. */
export type LampQuad = [P3, P3, number, number];

/** The lamp quads of a car by function. */
export interface LampSet {
  readonly head: readonly LampQuad[];
  readonly tail: readonly LampQuad[];
  readonly brake: readonly LampQuad[];
  readonly indL: readonly LampQuad[];
  readonly indR: readonly LampQuad[];
  readonly spots?: readonly LampQuad[];
  readonly beacons?: readonly (readonly LampQuad[])[];
}

/** A box end's uv so its texture reads upright from outside (MeshBuilder.box maps a → u0 v0 at the bottom). */
export function endUV(r: TexRect): UV4 {
  return [r.x + r.w, r.y + r.h, r.x, r.y];
}

/** The front plate (seen from ahead) and the back plate (seen from behind) as decals. */
export function plates(mb: MeshBuilder, sh: CarSheet, front: { z: number; y: number }, back: { z: number; y: number }, hw = 0.26, hh = 0.06): void {
  const f = sh.plateF;
  const b = sh.plateB;
  decal(mb, [-hw, front.y + hh, front.z], [hw, front.y + hh, front.z], [hw, front.y - hh, front.z], [-hw, front.y - hh, front.z], [f.x, f.y, f.x + f.w, f.y + f.h], [0, 0, 1]);
  decal(mb, [hw, back.y + hh, back.z], [-hw, back.y + hh, back.z], [-hw, back.y - hh, back.z], [hw, back.y - hh, back.z], [b.x, b.y, b.x + b.w, b.y + b.h], [0, 0, -1]);
}

/**
 * Dark wheel wells behind the arches: an open black box per arch and side (the inner wall, the walls
 * in front of and behind the wheel, the ceiling), so no line of sight through an arch reaches the
 * open inside of the body. `xi` the inner wall's |x|, `xo` the body side's; `ceiling` false leaves
 * the ceiling out (a traffic car, 4 triangles less per arch).
 */
export function wells(mb: MeshBuilder, sh: CarSheet, xi: number, xo: number, arches: readonly number[], r: number, top: number, ceiling = true): void {
  const uv = sh.solid(S.BLACK);
  const at: [number, number][] = [[uv[0], uv[1]], [uv[0], uv[1]], [uv[0], uv[1]], [uv[0], uv[1]]];
  const y0 = 0.18;
  for (const zw of arches) {
    const zf = zw + r;
    const zb = zw - r;
    for (const g of [1, -1]) {
      const a = g * xi;
      const o = g * xo;
      face(mb, [[a, y0, zb], [a, y0, zf], [a, top, zf], [a, top, zb]], at, [g, 0, 0]);
      face(mb, [[a, y0, zf], [o, y0, zf], [o, top, zf], [a, top, zf]], at, [0, 0, -1]);
      face(mb, [[a, y0, zb], [o, y0, zb], [o, top, zb], [a, top, zb]], at, [0, 0, 1]);
      if (ceiling) face(mb, [[a, top, zb], [o, top, zb], [o, top, zf], [a, top, zf]], at, [0, -1, 0]);
    }
  }
}

/** The four wheel anchors (FL, FR, RL, RR) of a car whose meshes are `car/<id>/wheel-l|r`. */
export function wheelAnchors(id: string, x: number, r: number, w: number, zf: number, zb: number): WheelAnchor[] {
  const mk = (left: boolean, front: boolean): WheelAnchor => ({ x: left ? x : -x, y: r, z: front ? zf : zb, r, width: w, front, left, mesh: `car/${id}/wheel-${left ? 'l' : 'r'}` });
  return [mk(true, true), mk(false, true), mk(true, false), mk(false, false)];
}

/** The wheel meshes: one local wheel per side and the four in place. */
export function wheelMeshes(id: string, sh: CarSheet, page: number, anchors: readonly WheelAnchor[], n = 8): { meshes: Mesh3[]; tris: number } {
  const a = anchors[0];
  const wl = new MeshBuilder();
  wheel(wl, sh, a.r, a.width, true, n);
  const wr = new MeshBuilder();
  wheel(wr, sh, a.r, a.width, false, n);
  const all = new MeshBuilder();
  for (const w of anchors) wheel(all, sh, w.r, w.width, w.left, n, [w.x, w.y, w.z]);
  return {
    meshes: [wl.build(`car/${id}/wheel-l`, page, 0), wr.build(`car/${id}/wheel-r`, page, 0), all.build(`car/${id}/wheels`, page, 0)],
    tris: all.triangles,
  };
}

/** The lamp meshes (emissive, additive) from the lamp anchors; returns the meshes and their triangles. */
export function lampMeshes(id: string, sh: CarSheet, page: number, lamps: LampSet): { meshes: Mesh3[]; tris: number } {
  const meshes: Mesh3[] = [];
  let tris = 0;
  const one = (name: string, quads: readonly LampQuad[], slot: Slot): void => {
    const mb = new MeshBuilder();
    for (const [c, n, hu, hv] of quads) lampQuad(mb, sh, c, n, hu, hv, slot);
    meshes.push(withBias(mb.build(`car/${id}/${name}`, page, 0, { blend: 'add', emissive: true }), 2));
    tris += mb.triangles;
  };
  one('head', lamps.head, S.LENS);
  one('tail', lamps.tail, S.RED);
  one('brake', lamps.brake, S.RED);
  one('ind-l', lamps.indL, S.AMBER);
  one('ind-r', lamps.indR, S.AMBER);
  if (lamps.spots) one('spots', lamps.spots, S.LENS);
  if (lamps.beacons) lamps.beacons.forEach((q, k) => one(`beacon-${k === 0 ? 'a' : 'b'}`, q, S.ACC_B));
  return { meshes, tris };
}
