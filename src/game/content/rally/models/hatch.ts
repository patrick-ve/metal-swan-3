/**
 * The traffic hatchback (docs/design/rally.md §6): models/hatch-shape.ts and tex/hatch.ts, about
 * 240 triangles (the body of 16 sections, dark wells, six-sided wheels, plates, a blob shadow), ten
 * paint colours as CLUT rows (`rows`; CarSpec.clutRow picks one), the lamps as emissive meshes
 * (brake lights and indicators for wave B's lane changes), a far version. Pure.
 */
import { MeshBuilder } from '../mesh';
import { HATCH_COLOURS, paintHatch } from '../tex/hatch';
import { HAT, hatchLodStations, hatchStations } from './hatch-shape';
import { blobShadow, loft, wheel } from './loft';
import { lampMeshes, plates, wells, wheelAnchors, wheelMeshes, withBias, type LampQuad, type LampSet } from './parts';
import type { RallyCarModel } from './types';

export function buildHatch(id: string): RallyCarModel {
  const { sheet: sh, page: pg } = paintHatch();
  const page = pg.id;
  const H = HAT;
  const mb = new MeshBuilder();
  loft(mb, sh, hatchStations());
  wells(mb, sh, 0.6, H.halfW - 0.005, [H.wheelF, H.wheelB], H.archR + 0.01, 0.72, false);
  plates(mb, sh, { z: H.nose + 0.006, y: 0.4 }, { z: H.tail - 0.006, y: 0.7 }, 0.24, 0.055);
  const body = mb.build(`car/${id}/body`, page, 0);

  const anchors = wheelAnchors(id, H.wheelX, H.wheelR, H.wheelW, H.wheelF, H.wheelB);
  const wheels = wheelMeshes(id, sh, page, anchors, 6);
  const shb = new MeshBuilder();
  blobShadow(shb, sh, 0.8, 1.8, 0.28);
  const shadow = withBias(shb.build(`car/${id}/shadow`, page, 0, { blend: 'sub', emissive: true }), 4);

  const zf = H.nose + 0.012;
  const zb = H.tail - 0.012;
  const q: LampSet = {
    head: [-1, 1].map((g): LampQuad => [[g * 0.52, 0.65, zf], [0, 0, 1], 0.17, 0.065]),
    tail: [-1, 1].map((g): LampQuad => [[g * 0.63, 0.74, zb], [0, 0, -1], 0.12, 0.07]),
    brake: [-1, 1].map((g): LampQuad => [[g * 0.63, 0.74, zb], [0, 0, -1], 0.12, 0.07]),
    indL: [
      [[0.74, 0.65, zf], [0, 0, 1], 0.03, 0.065],
      [[0.63, 0.59, zb], [0, 0, -1], 0.12, 0.03],
    ],
    indR: [
      [[-0.74, 0.65, zf], [0, 0, 1], 0.03, 0.065],
      [[-0.63, 0.59, zb], [0, 0, -1], 0.12, 0.03],
    ],
  };
  const lamps = lampMeshes(id, sh, page, q);

  const lb = new MeshBuilder();
  loft(lb, sh, hatchLodStations());
  for (const w of anchors) wheel(lb, sh, w.r, w.width, w.left, 4, [w.x, w.y, w.z]);
  const lod = lb.build(`car/${id}/lod`, page, 0);

  const c = (qs: readonly LampQuad[]): [number, number, number][] => qs.map((x) => [x[0][0], x[0][1], x[0][2]]);
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
      height: H.roof,
      box: { x0: -H.halfW, x1: H.halfW, y0: 0, y1: H.roof, z0: H.tail, z1: H.nose },
      wheelbase: H.wheelF - H.wheelB,
      track: 2 * H.wheelX,
      wheels: anchors,
      lamps: { head: c(q.head), tail: c(q.tail), brake: c(q.brake), indL: c(q.indL), indR: c(q.indR), spots: [], beacons: [] },
      bumperCam: [0, 0.95, 1.5],
    },
    lights: { head: `car/${id}/head`, tail: `car/${id}/tail`, brake: `car/${id}/brake`, indL: `car/${id}/ind-l`, indR: `car/${id}/ind-r` },
    lod: { parts: [lod.id, shadow.id], tris: lb.triangles + shb.triangles },
    rows: HATCH_COLOURS.map((h) => h.name),
    lightTris: lamps.tris,
  };
}
