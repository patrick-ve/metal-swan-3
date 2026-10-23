/**
 * The estate models (docs/design/rally.md §6, §7.3): the white "rozzers" (1P, P1), the green
 * "safari" (P2) and the police estate, on one shape (models/estate-shape.ts) with their own pages
 * (tex/estate.ts). 484 / 494 triangles (the police car 382): a lofted body of 22 sections with real
 * wheel arches and closed black wheel wells, door mirrors, plates, the livery's gear (the white's push
 * bar with two spot lamps and its roof rails; the green's rails, roof rack, two roof lamps, a spare
 * tyre, a bag and a jerrycan; the police roof bar), four wheels, a blob shadow; the lamps as separate
 * emissive meshes; a far version of 158 triangles.
 *
 * Pure; built once by the registry (models/index.ts).
 */
import { MeshBuilder } from '../mesh';
import { S } from '../tex/car-palette';
import { paintEstate, type EstateKind } from '../tex/estate';
import { EST, estateLodStations, estateStations } from './estate-shape';
import { blobShadow, box, boxFaced, flatWheel, loft, wheel } from './loft';
import { endUV, lampMeshes, plates, wells, wheelAnchors, wheelMeshes, withBias, type LampQuad } from './parts';
import type { CarAnchors, CarLamps, P3, RallyCarModel } from './types';

/** Build one estate model. */
export function buildEstate(id: string, kind: EstateKind): RallyCarModel {
  const tex = paintEstate(kind);
  const sh = tex.sheet;
  const page = tex.page.id;
  const E = EST;

  // -- the body (one mesh: the loft, the wells, mirrors, plates and the livery's gear) ----------
  const mb = new MeshBuilder();
  loft(mb, sh, estateStations());
  wells(mb, sh, 0.62, E.halfW - 0.005, [E.wheelF, E.wheelB], E.archR + 0.01, 0.8);
  for (const g of [1, -1]) box(mb, sh, g > 0 ? E.halfW - 0.01 : -1.0, 0.92, 0.84, g > 0 ? 1.0 : -E.halfW + 0.01, 1.03, 0.97, S.BLACK);
  plates(mb, sh, { z: E.nose + 0.006, y: 0.36 }, { z: E.tail - 0.006, y: 0.695 });
  let top: number = E.roof;
  let front: number = E.nose;
  const spotQuads: LampQuad[] = [];
  const beaconQuads: LampQuad[][] = [];
  const spot = sh.extra.spot;
  if (kind !== 'police') {
    // Roof rails.
    for (const g of [1, -1]) box(mb, sh, g > 0 ? 0.6 : -0.66, E.roof - 0.01, -2.0, g > 0 ? 0.66 : -0.6, E.roof + 0.05, 0.36, S.BLACK);
    top = E.roof + 0.05;
  }
  if (kind === 'white') {
    // The black tubular push bar on the nose with two round spot lamps.
    const z0 = 2.56;
    const z1 = 2.62;
    for (const g of [1, -1]) box(mb, sh, g > 0 ? 0.5 : -0.56, 0.18, z0, g > 0 ? 0.56 : -0.5, 0.92, z1, S.BLACK);
    box(mb, sh, -0.5, 0.86, z0, 0.5, 0.92, z1, S.BLACK);
    box(mb, sh, -0.5, 0.55, z0, 0.5, 0.6, z1, S.BLACK);
    box(mb, sh, -0.5, 0.26, z0, 0.5, 0.32, z1, S.BLACK, true);
    // Two short struts back to the bumper.
    for (const g of [1, -1]) box(mb, sh, g > 0 ? 0.42 : -0.48, 0.26, E.nose - 0.02, g > 0 ? 0.48 : -0.42, 0.31, z0, S.BLACK);
    for (const g of [1, -1]) {
      boxFaced(mb, sh, g * 0.22 - 0.11, 0.6, 2.555, g * 0.22 + 0.11, 0.82, 2.665, S.BLACK, { front: endUV(spot) });
      spotQuads.push([[g * 0.22, 0.71, 2.672], [0, 0, 1], 0.085, 0.085]);
    }
    front = 2.665;
  } else if (kind === 'green') {
    // The silver roof rack: two cross bars on the rails, two load bars along it.
    const y0 = E.roof + 0.05;
    for (const zc of [0.22, -1.7]) box(mb, sh, -0.72, y0, zc - 0.03, 0.72, y0 + 0.04, zc + 0.03, S.SILVER);
    for (const g of [1, -1]) box(mb, sh, g > 0 ? 0.52 : -0.56, y0 + 0.04, -2.0, g > 0 ? 0.56 : -0.52, y0 + 0.08, 0.32, S.SILVER);
    // Two round roof lamps at the front (black housings, the lens forward).
    for (const g of [1, -1]) {
      boxFaced(mb, sh, g * 0.3 - 0.13, y0 + 0.04, 0.2, g * 0.3 + 0.13, y0 + 0.3, 0.34, S.BLACK, { front: endUV(spot) });
      spotQuads.push([[g * 0.3, y0 + 0.17, 0.347], [0, 0, 1], 0.1, 0.1]);
    }
    // The spare tyre lying flat at the rear, a bag and a red jerrycan.
    flatWheel(mb, sh, 0, y0 + 0.08, -1.62, 0.33, 0.18);
    box(mb, sh, -0.48, y0 + 0.08, -1.18, 0.36, y0 + 0.32, -0.2, S.BLACK);
    box(mb, sh, 0.4, y0 + 0.08, -1.24, 0.6, y0 + 0.4, -0.96, S.RED);
    top = y0 + 0.4;
  } else {
    // The police roof bar: blue ends, STOP POLITIE on the back, POLITIE on the front.
    boxFaced(mb, sh, -0.62, E.roof - 0.01, -0.15, 0.62, E.roof + 0.15, 0.15, S.PLASTIC, {
      front: endUV(sh.extra.barFront),
      back: endUV(sh.extra.display),
      left: sh.solid(S.ACC_B),
      right: sh.solid(S.ACC_B),
    });
    for (const g of [1, -1]) {
      beaconQuads.push([
        [[g * 0.5, E.roof + 0.07, 0.156], [0, 0, 1], 0.12, 0.07],
        [[g * 0.5, E.roof + 0.07, -0.156], [0, 0, -1], 0.12, 0.07],
        [[g * 0.626, E.roof + 0.07, 0], [g, 0, 0], 0.15, 0.07],
      ]);
    }
    top = E.roof + 0.15;
  }
  const body = mb.build(`car/${id}/body`, page, 0);

  // -- wheels, shadow, lamps, the far version ------------------------------------------------
  const anchors = wheelAnchors(id, E.wheelX, E.wheelR, E.wheelW, E.wheelF, E.wheelB);
  const wheels = wheelMeshes(id, sh, page, anchors);
  const shb = new MeshBuilder();
  blobShadow(shb, sh, 0.86, 2.3, 0.3);
  const shadow = withBias(shb.build(`car/${id}/shadow`, page, 0, { blend: 'sub', emissive: true }), 4);

  const zf = E.nose + 0.012;
  const zb = E.tail - 0.012;
  const lampQ = {
    head: [-1, 1].map((g): LampQuad => [[g * 0.61, 0.705, zf], [0, 0, 1], 0.165, 0.08]),
    tail: [-1, 1].map((g): LampQuad => [[g * 0.74, 1.08, zb], [0, 0, -1], 0.075, 0.27]),
    brake: [...[-1, 1].map((g): LampQuad => [[g * 0.74, 0.98, zb], [0, 0, -1], 0.075, 0.17]), [[0, 1.29, zb + 0.01], [0, 0, -1], 0.15, 0.02] as LampQuad],
    indL: [
      [[0.8, 0.705, zf], [0, 0, 1], 0.02, 0.08],
      [[E.halfW + 0.008, 0.705, 2.32], [1, 0, 0], 0.04, 0.08],
      [[0.74, 0.64, zb], [0, 0, -1], 0.075, 0.045],
    ] as LampQuad[],
    indR: [
      [[-0.8, 0.705, zf], [0, 0, 1], 0.02, 0.08],
      [[-E.halfW - 0.008, 0.705, 2.32], [-1, 0, 0], 0.04, 0.08],
      [[-0.74, 0.64, zb], [0, 0, -1], 0.075, 0.045],
    ] as LampQuad[],
    spots: spotQuads.length ? spotQuads : undefined,
    beacons: beaconQuads.length ? beaconQuads : undefined,
  };
  const lamps = lampMeshes(id, sh, page, lampQ);

  const lb = new MeshBuilder();
  loft(lb, sh, estateLodStations());
  for (const w of anchors) wheel(lb, sh, w.r, w.width, w.left, 4, [w.x, w.y, w.z]);
  if (kind === 'green') box(lb, sh, -0.6, E.roof, -1.95, 0.6, E.roof + 0.3, 0.35, S.BLACK);
  if (kind === 'police') box(lb, sh, -0.62, E.roof - 0.01, -0.15, 0.62, E.roof + 0.15, 0.15, S.ACC_B);
  if (kind === 'white') box(lb, sh, -0.56, 0.2, 2.56, 0.56, 0.92, 2.62, S.BLACK);
  const lod = lb.build(`car/${id}/lod`, page, 0);

  const c = (q: readonly LampQuad[] | undefined): P3[] => (q ?? []).map((x) => x[0]);
  const lampAt: CarLamps = {
    head: c(lampQ.head),
    tail: c(lampQ.tail),
    brake: c(lampQ.brake),
    indL: c(lampQ.indL),
    indR: c(lampQ.indR),
    spots: c(lampQ.spots),
    beacons: beaconQuads.map((q) => q[0][0]),
  };
  const box3 = { x0: -E.halfW, x1: E.halfW, y0: 0, y1: top, z0: E.tail, z1: front };
  const anchorsAll: CarAnchors = {
    length: box3.z1 - box3.z0,
    width: 2 * E.halfW,
    height: top,
    box: box3,
    wheelbase: E.wheelF - E.wheelB,
    track: 2 * E.wheelX,
    wheels: anchors,
    lamps: lampAt,
    bumperCam: [0, 1.02, 1.85],
  };
  const meshes = [body, ...wheels.meshes, shadow, ...lamps.meshes, lod];
  const parts = [body.id, shadow.id, `car/${id}/wheels`];
  const lights = {
    head: `car/${id}/head`,
    tail: `car/${id}/tail`,
    brake: `car/${id}/brake`,
    indL: `car/${id}/ind-l`,
    indR: `car/${id}/ind-r`,
    spots: lampQ.spots ? `car/${id}/spots` : undefined,
    beacons: beaconQuads.length ? ([`car/${id}/beacon-a`, `car/${id}/beacon-b`] as const) : undefined,
  };
  return {
    id,
    meshes,
    pages: [tex.page],
    parts,
    tris: mb.triangles + shb.triangles + wheels.tris,
    body: [body.id, shadow.id],
    wheelsStatic: `car/${id}/wheels`,
    anchors: anchorsAll,
    lights,
    lod: { parts: [lod.id, shadow.id], tris: lb.triangles + shb.triangles },
    rows: [kind],
    lightTris: lamps.tris,
  };
}
