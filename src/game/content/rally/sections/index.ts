/**
 * The scenery of the ten sections (WORLD, wave B; docs/design/rally.md §3, §7.4, §7.5;
 * docs/api/rally.md "B.6", "B.W"): the landmarks (likenesses, our own blank or made-up signs), the
 * buildings, trees, water, fields, the central lamp posts, billboards and the night lights of the
 * world (lit windows, lamp glows and pools, floodlights). Built once per track into WORLD's cells
 * (batch.ts), culled per view; the animated parts (the wind turbines' rotors, the metro train) are
 * posed once per frame.
 *
 * The contract: `defineRallyScenery({ id: 'world/sections', order: 110, build(track) })` — `build`
 * runs once per track (pure); `fill(ctx, out, k)` appends this view's items every frame (no
 * allocation). A test track without the A10's anchors gets an empty part.
 */
import { atan2T, cosT, sinT } from '../../../../engine/r3/trig';
import { mat4, mat4Multiply, mat4RotateY, mat4RotateZ, mat4Translate } from '../../../../engine/r3/mat';
import type { DrawItem, Mesh3, TexturePage } from '../../../../engine/view3d';
import type { RallyTrack } from '../../../rally/api';
import { defineRallyScenery, type RallyDrawCtx, type RallyScenery } from '../../../rally/registry';
import { MeshBuilder } from '../mesh';
import { glowLevel, glowTex } from '../lights/page';
import type { A10Track } from '../track/types';
import { CellCuller, WorldBatch, type WorldCell } from './batch';
import { dressA10, startBillboards, type AnimSpec, type DressReport } from './dress';
import { facadeTex, propsTex, WORLD_PAGES } from './pages';
import { WORLD_LAYERS } from './pieces';
// WORLD's other scenery parts register at import (content/rally/index.ts loads this file).
import '../sky/index';
import '../lights/cars';

/** What WORLD dresses per section (spec §3), in the table's order. */
export const SECTION_LOOK: Readonly<Record<string, string>> = {
  zuidas: 'glass and stone towers, the cranes of the endless works, the station',
  'nieuwe-meer': 'water, the bridge over the Schinkel, the trees of the woods',
  'ring-west': '1960s blocks of flats in rows, noise barriers, a metro line beside the road',
  sloterdijk: 'the station, office towers, a busy junction',
  coentunnel: 'the ramps and the tube with rows of orange lamps',
  noord: 'flat polder, sheds, wind turbines, a canal bridge',
  zeeburgertunnel: 'the tube under the IJ; towers of the new islands at the exit',
  oost: 'the Watergraafsmeer, sports fields, a science park, a tall office tower near a station',
  amstel: 'the river with boats, the bridge',
  rai: 'the exhibition halls',
};

/** The A10's fields this part needs (a test track has none of them). */
export function isA10(track: RallyTrack): track is A10Track {
  const t = track as Partial<A10Track>;
  return Array.isArray(t.sections) && Array.isArray(t.landmarks) && typeof t.sample === 'function' && typeof t.flagsAt === 'function';
}

/** The sections' scenery and what it holds (tests and the budget). */
export interface WorldSections extends RallyScenery {
  readonly cells: readonly WorldCell[];
  readonly report: DressReport;
  /** The culler of each view (its `tris` / `draws` after a fill). */
  readonly cullers: readonly CellCuller[];
  /** Triangles per layer (all cells, the larger level of detail). */
  readonly layerTris: Readonly<Record<string, number>>;
}

/** The rotor of a wind turbine (local: the hub at the origin, the blades in the x–y plane). */
function rotorMesh(id: string): Mesh3 {
  const mb = new MeshBuilder();
  const uv = propsTex().flat('white');
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI * 2) / 3;
    const s = sinT(a), c = cosT(a);
    // A blade: 23 m long, 1.6 m at the root to 0.5 m at the tip.
    const P = (x: number, y: number): [number, number, number] => [x * c - y * s, x * s + y * c, 0.4];
    mb.quad(P(-0.8, 1.2), P(0.8, 1.2), P(0.25, 24), P(-0.25, 24), uv, [124, 124, 124], [0, 0, 1]);
  }
  mb.box(-1, -1, -0.4, 1, 1, 1.6, () => uv, [124, 124, 124], false);
  return { ...mb.build(id, WORLD_PAGES.props, 0), twoSided: true };
}

/** The metro train: two cars, local z forward, centred. */
function trainMesh(id: string): Mesh3 {
  const mb = new MeshBuilder();
  const t = propsTex();
  const body = t.flat('light'), glass = t.flat('glass'), red = t.flat('red');
  for (const z0 of [-19, 0.5]) {
    mb.box(-1.4, 0.4, z0, 1.4, 3.6, z0 + 18.5, () => body, [126, 128, 134]);
    for (const x of [-1.42, 1.42]) {
      const n: [number, number, number] = [x > 0 ? 1 : -1, 0, 0];
      mb.quad([x, 2.8, z0 + 1], [x, 2.8, z0 + 17.5], [x, 1.7, z0 + 17.5], [x, 1.7, z0 + 1], glass, [128, 128, 128], n);
      mb.quad([x, 1.2, z0 + 0.5], [x, 1.2, z0 + 18], [x, 0.8, z0 + 18], [x, 0.8, z0 + 0.5], red, [128, 128, 128], n);
    }
  }
  return mb.build(id, WORLD_PAGES.props, 0);
}

interface Anim {
  readonly spec: AnimSpec;
  readonly item: DrawItem;
  readonly m: Float32Array;
  visible: boolean;
}

/** Build the sections' scenery of a track (empty on a test track). */
export function buildSections(track: RallyTrack): WorldSections {
  const cullers = [new CellCuller(), new CellCuller()];
  if (!isA10(track)) {
    return { meshes: [], pages: [], cells: [], report: { landmarks: {}, anims: [] }, cullers, layerTris: {}, fill: (_c, _o, k) => k };
  }
  const b = new WorldBatch('scenery/w', WORLD_LAYERS);
  const report = dressA10(track, b);
  startBillboards(track, b);
  const layerTris = b.triangles();
  const { meshes, cells } = b.build();
  const pages: TexturePage[] = [facadeTex().page, propsTex().page, glowTex().page];
  meshes.push(rotorMesh('scenery/w/rotor'), trainMesh('scenery/w/train'));
  const anims: Anim[] = report.anims.map((spec) => {
    const m = new Float32Array(16);
    return { spec, m, item: { mesh: spec.kind === 'rotor' ? 'scenery/w/rotor' : 'scenery/w/train', m }, visible: false };
  });
  const ta = mat4();
  const tb = mat4();
  const tc = mat4();
  let posedAt = -1;
  /** Pose the animated parts for frame t (once per frame, both views share them). */
  const pose = (t: number): void => {
    if (t === posedAt) return;
    posedAt = t;
    for (const a of anims) {
      const s = a.spec;
      if (s.kind === 'rotor') {
        // About a quarter turn per second.
        mat4Translate(ta, s.x, s.y, s.z);
        mat4RotateY(tb, s.yaw);
        mat4Multiply(tc, ta, tb);
        mat4RotateZ(ta, s.phase + (t / 60) * 1.6);
        mat4Multiply(a.m, tc, ta);
        a.visible = true;
      } else if (s.path && s.length) {
        // The metro runs north at about 70 km/h, then comes round again.
        const loop = s.length + 600;
        const d = ((t / 60) * 19.5) % loop - 300;
        a.visible = d > 0 && d < s.length;
        if (!a.visible) continue;
        let left = d;
        const P = s.path;
        let i = 0;
        for (; i + 1 < P.length; i++) {
          const dx = P[i + 1][0] - P[i][0], dz = P[i + 1][2] - P[i][2];
          const l = Math.sqrt(dx * dx + dz * dz);
          if (left <= l || i + 2 === P.length) {
            const f = l > 0 ? Math.min(1, left / l) : 0;
            const yaw = atan2T(dx, dz);
            mat4RotateY(tb, yaw);
            mat4Translate(ta, P[i][0] + dx * f, P[i][1], P[i][2] + dz * f);
            mat4Multiply(a.m, ta, tb);
            break;
          }
          left -= l;
        }
      }
    }
  };
  return {
    meshes,
    pages,
    cells,
    report,
    cullers,
    layerTris,
    fill(ctx: RallyDrawCtx, out: DrawItem[], k: number): number {
      const cull = cullers[ctx.view] ?? cullers[0];
      k = cull.fill(cells, ctx.cam, ctx.aspect, ctx.far, glowLevel(ctx.day.lampGlow), out, k);
      pose(ctx.t);
      const cx = ctx.cam.pos[0], cz = ctx.cam.pos[2];
      const far2 = ctx.far * ctx.far;
      for (const a of anims) {
        if (!a.visible) continue;
        const dx = a.m[12] - cx, dz = a.m[14] - cz;
        if (dx * dx + dz * dz > far2) continue;
        out[k++] = a.item;
      }
      return k;
    },
  };
}

defineRallyScenery({ id: 'sections', order: 110, build: buildSections });
