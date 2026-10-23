/**
 * The rival DE LAATSTE RIT (docs/design/rally.md §6): the black 1980s hearse (models/hearse-shape.ts,
 * tex/hearse.ts) with flowers on the roof. About 400 triangles: the lofted body with its arches and
 * wells, mirrors, plates, a two-tier flower bed, four chrome-capped wheels, a blob shadow; the lamps
 * as emissive meshes; a far version. Pure.
 */
import { MeshBuilder } from '../mesh';
import { S } from '../tex/car-palette';
import { paintHearse } from '../tex/hearse';
import { HRS, hearseLodStations, hearseStations } from './hearse-shape';
import { blobShadow, box, loft, wheel } from './loft';
import { lampMeshes, plates, wells, wheelAnchors, wheelMeshes, withBias, type LampQuad, type LampSet } from './parts';
import type { RallyCarModel } from './types';

export function buildHearse(id: string): RallyCarModel {
  const { sheet: sh, page: pg } = paintHearse();
  const page = pg.id;
  const H = HRS;
  const mb = new MeshBuilder();
  loft(mb, sh, hearseStations());
  wells(mb, sh, 0.66, H.halfW - 0.005, [H.wheelF, H.wheelB], H.archR + 0.01, 0.82);
  for (const g of [1, -1]) box(mb, sh, g > 0 ? H.halfW - 0.01 : -1.03, 0.95, 1.08, g > 0 ? 1.03 : -H.halfW + 0.01, 1.05, 1.2, S.SILVER);
  plates(mb, sh, { z: H.nose + 0.006, y: 0.42 }, { z: H.tail - 0.006, y: 0.71 });
  // The flowers: a long low bed on the rear roof and a narrower tier on it.
  const ft = sh.extra.flowersTop;
  const fs = sh.extra.flowersSide;
  const top = [ft.x, ft.y, ft.x + ft.w, ft.y + ft.h] as const;
  const side = [fs.x, fs.y, fs.x + fs.w, fs.y + fs.h] as const;
  mb.box(-0.48, H.roof - 0.01, -1.7, 0.48, H.roof + 0.12, 0.2, (f) => (f === 'top' ? top : side), [128, 128, 128]);
  mb.box(-0.3, H.roof + 0.12, -1.4, 0.3, H.roof + 0.22, -0.1, (f) => (f === 'top' ? top : side), [128, 128, 128]);
  const body = mb.build(`car/${id}/body`, page, 0);

  const anchors = wheelAnchors(id, H.wheelX, H.wheelR, H.wheelW, H.wheelF, H.wheelB);
  const wheels = wheelMeshes(id, sh, page, anchors);
  const shb = new MeshBuilder();
  blobShadow(shb, sh, 0.9, 2.7, 0.3);
  const shadow = withBias(shb.build(`car/${id}/shadow`, page, 0, { blend: 'sub', emissive: true }), 4);

  const zf = H.nose + 0.012;
  const zb = H.tail - 0.012;
  const q: LampSet = {
    head: [-1, 1].flatMap((g): LampQuad[] => [
      [[g * 0.55, 0.68, zf], [0, 0, 1], 0.08, 0.07],
      [[g * 0.735, 0.68, zf], [0, 0, 1], 0.075, 0.07],
    ]),
    tail: [-1, 1].map((g): LampQuad => [[g * 0.6, 0.735, zb], [0, 0, -1], 0.17, 0.06]),
    brake: [-1, 1].map((g): LampQuad => [[g * 0.6, 0.735, zb], [0, 0, -1], 0.17, 0.06]),
    indL: [
      [[0.84, 0.68, zf], [0, 0, 1], 0.025, 0.07],
      [[0.82, 0.71, zb], [0, 0, -1], 0.035, 0.08],
    ],
    indR: [
      [[-0.84, 0.68, zf], [0, 0, 1], 0.025, 0.07],
      [[-0.82, 0.71, zb], [0, 0, -1], 0.035, 0.08],
    ],
  };
  const lamps = lampMeshes(id, sh, page, q);

  const lb = new MeshBuilder();
  loft(lb, sh, hearseLodStations());
  for (const w of anchors) wheel(lb, sh, w.r, w.width, w.left, 4, [w.x, w.y, w.z]);
  lb.box(-0.48, H.roof - 0.01, -1.7, 0.48, H.roof + 0.16, 0.2, (f) => (f === 'top' ? top : side), [128, 128, 128]);
  const lod = lb.build(`car/${id}/lod`, page, 0);

  const c = (qs: readonly LampQuad[]): [number, number, number][] => qs.map((x) => [x[0][0], x[0][1], x[0][2]]);
  const height = H.roof + 0.22;
  return {
    id,
    meshes: [body, ...wheels.meshes, shadow, ...lamps.meshes, lod],
    pages: [pg],
    parts: [body.id, shadow.id, `car/${id}/wheels`],
    tris: mb.triangles + shb.triangles + wheels.tris,
    body: [body.id, shadow.id],
    wheelsStatic: `car/${id}/wheels`,
    anchors: {
      length: H.nose - H.tail,
      width: 2 * H.halfW,
      height,
      box: { x0: -H.halfW, x1: H.halfW, y0: 0, y1: height, z0: H.tail, z1: H.nose },
      wheelbase: H.wheelF - H.wheelB,
      track: 2 * H.wheelX,
      wheels: anchors,
      lamps: { head: c(q.head), tail: c(q.tail), brake: c(q.brake), indL: c(q.indL), indR: c(q.indR), spots: [], beacons: [] },
      bumperCam: [0, 1.0, 2.25],
    },
    lights: { head: `car/${id}/head`, tail: `car/${id}/tail`, brake: `car/${id}/brake`, indL: `car/${id}/ind-l`, indR: `car/${id}/ind-r` },
    lod: { parts: [lod.id, shadow.id], tris: lb.triangles + shb.triangles },
    rows: ['black'],
    lightTris: lamps.tris,
  };
}
