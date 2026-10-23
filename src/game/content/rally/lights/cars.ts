/**
 * The lights of the cars and the bodies on the road (WORLD, wave B; docs/design/rally.md §6, §7.5;
 * docs/api/rally.md "B.3"): at night (`day.carLights`) every car drives with its headlights (CARS'
 * lamp lenses, two white glows and a pool of light on the road ahead) and its tail lights (red
 * glows); any time, the indicators blink when a body's owner sets `BODY_LIGHT.left`, `.right` or
 * `.hazard` (on in the first half of every 40 frames). The scene draws the brake lamps; RULES draws
 * the police beacons. A body's `lights` bits head / tail switch its lamps on in the day too.
 *
 * One glow mesh per car model (built and uploaded when the model is first seen: page 302, additive,
 * emissive), one draw per lit car; the matrices are posed in place. No allocation per frame (only
 * when the roster or a body's model changes).
 */
import { mat4PoseYPR } from '../../../../engine/r3/mat';
import { cosT, sinT } from '../../../../engine/r3/trig';
import type { DrawItem, Mesh3 } from '../../../../engine/view3d';
import type { RallyBody, RallyTrack } from '../../../rally/api';
import { BODY_LIGHT } from '../../../rally/ids';
import { defineRallyScenery, rallyModel, type RallyDrawCtx, type RallyScenery } from '../../../rally/registry';
import { carModelInfo, type RallyCarModel } from '../models/types';
import { WORLD_PAGES } from '../sections/pages';
import { glowTex, GLOW_FULL } from './page';

/** Beyond this distance a car's lights are not drawn (m); its pool only within `POOL_M`; its lenses within `LENS_M`. */
export const LIGHTS_M = 300;
const LENS_M = 70;
const POOL_M = 160;
/**
 * The headlight pool (integrator, wave C; lead polish 3a): a beam on the road straight ahead of the
 * nose, inside the car's lane: from `POOL_FROM` to `POOL_LEN` m past the nose, `POOL_W0` m wide at
 * the nose to `POOL_W1` m at the far end (a lane is 3.5 m), soft at the edges and faded at the far
 * end (`GlowTex.beam`), cut into `POOL_X` × `POOL_Z` cells (small cells: the affine warp of big
 * near triangles smeared it sideways). Its own mesh (`fx/carpool/<model>`), so a view draws only
 * the pools in front of its car: its own and those of cars ahead (`POOL_AHEAD`); a car beside or
 * behind lit the road beside the player as a smear.
 */
export const POOL_LEN = 36;
export const POOL_FROM = 0.4;
export const POOL_W0 = 2.0;
export const POOL_W1 = 3.4;
export const POOL_X = 3;
export const POOL_Z = 10;
const POOL_RGB = [100, 98, 88] as const;
/** Another car's pool shows when that car is this far ahead of the view's car (m, along its heading). */
export const POOL_AHEAD = 4;
/** Blinking: frames per cycle (on in the first half). */
const BLINK = 40;

/** The glow mesh of a model (model space: nose +z, the wheels on y = 0). */
export function carGlowMesh(id: string, info: RallyCarModel): Mesh3 {
  const g = glowTex();
  const pos: number[] = [];
  const uv: number[] = [];
  const rgb: number[] = [];
  const idx: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], r: { x: number; y: number; w: number; h: number }, col: number[], flip: boolean): void => {
    const o = pos.length / 3;
    pos.push(...a, ...b, ...c, ...d);
    uv.push(r.x, r.y, r.x + r.w, r.y, r.x + r.w, r.y + r.h, r.x, r.y + r.h);
    for (let k = 0; k < 4; k++) rgb.push(col[0], col[1], col[2]);
    if (flip) idx.push(o, o + 2, o + 1, o, o + 3, o + 2);
    else idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  };
  const L = info.anchors.lamps;
  // Head halos facing forward (+z); seen from in front (counter-clockwise from +z).
  for (const p of L.head) {
    const s = 0.5;
    const z = p[2] + 0.06;
    quad([p[0] + s, p[1] + s, z], [p[0] - s, p[1] + s, z], [p[0] - s, p[1] - s, z], [p[0] + s, p[1] - s, z], g.disc, [235, 228, 200], false);
  }
  // Tail halos facing back (−z).
  for (const p of L.tail) {
    const s = 0.34;
    const z = p[2] - 0.06;
    quad([p[0] - s, p[1] + s, z], [p[0] + s, p[1] + s, z], [p[0] + s, p[1] - s, z], [p[0] - s, p[1] - s, z], g.disc, [230, 40, 30], false);
  }
  const n = pos.length / 3;
  return {
    id,
    pos: Float32Array.from(pos),
    uv: Float32Array.from(uv),
    rgb: Uint8Array.from(rgb),
    idx: n > 65535 ? Uint32Array.from(idx) : Uint16Array.from(idx),
    page: WORLD_PAGES.lights,
    clutRow: GLOW_FULL,
    blend: 'add',
    emissive: true,
    bias: 3,
  };
}

/** The headlight pool of a model (model space: nose +z, on the road at y = 0.04; see `POOL_LEN`). */
export function carPoolMesh(id: string, info: RallyCarModel): Mesh3 {
  const b = glowTex().beam;
  const pos: number[] = [];
  const uv: number[] = [];
  const rgb: number[] = [];
  const idx: number[] = [];
  const z0 = info.anchors.box.z1 + POOL_FROM;
  const z1 = info.anchors.box.z1 + POOL_LEN;
  // A grid of (POOL_X + 1) × (POOL_Z + 1) vertices (shared), a trapezoid widening ahead.
  for (let iz = 0; iz <= POOL_Z; iz++) {
    const v = iz / POOL_Z;
    const z = z0 + (z1 - z0) * v;
    const half = (POOL_W0 + (POOL_W1 - POOL_W0) * v) / 2;
    for (let ix = 0; ix <= POOL_X; ix++) {
      const u = ix / POOL_X;
      pos.push(half - 2 * half * u, 0.04, z);
      uv.push(b.x + b.w * u, b.y + b.h * v);
      rgb.push(POOL_RGB[0], POOL_RGB[1], POOL_RGB[2]);
    }
  }
  const row = POOL_X + 1;
  for (let iz = 0; iz < POOL_Z; iz++) {
    for (let ix = 0; ix < POOL_X; ix++) {
      const a = iz * row + ix;
      // Facing up (seen from above; the same winding as the old pool cells).
      idx.push(a, a + 1, a + row + 1, a, a + row + 1, a + row);
    }
  }
  return {
    id,
    pos: Float32Array.from(pos),
    uv: Float32Array.from(uv),
    rgb: Uint8Array.from(rgb),
    idx: Uint16Array.from(idx),
    page: WORLD_PAGES.lights,
    clutRow: GLOW_FULL,
    blend: 'add',
    emissive: true,
    bias: 3,
  };
}

/** What one car or body draws with (rebuilt when its model changes). */
interface Lit {
  model: string;
  row: number | undefined;
  /** The frame it was posed for. */
  t: number;
  info: RallyCarModel | null;
  readonly m: Float32Array;
  glow: DrawItem | null;
  pool: DrawItem | null;
  head: DrawItem | null;
  tail: DrawItem | null;
  indL: DrawItem | null;
  indR: DrawItem | null;
}

/** The car-lights part: built per track (no meshes up front; the glows upload as models appear). */
export function buildCarLights(track: RallyTrack): RallyScenery & { readonly glowIds: ReadonlySet<string> } {
  void track;
  const g = glowTex();
  const uploaded = new Set<string>();
  const lits: Lit[] = [];
  let roster = -1;
  const litOf = (i: number, model: string, row: number | undefined): Lit => {
    let l = lits[i];
    if (!l) l = lits[i] = { model: '', row: undefined, t: -1, info: null, m: new Float32Array(16), glow: null, pool: null, head: null, tail: null, indL: null, indR: null };
    if (l.model !== model || l.row !== row) {
      l.model = model;
      l.row = row;
      l.info = carModelInfo(rallyModel(model));
      if (l.info) {
        const it = (mesh: string): DrawItem => (row === undefined ? { mesh, m: l.m } : { mesh, m: l.m, clutRow: row });
        l.glow = { mesh: `fx/carglow/${model}`, m: l.m };
        l.pool = { mesh: `fx/carpool/${model}`, m: l.m };
        l.head = it(l.info.lights.head);
        l.tail = it(l.info.lights.tail);
        l.indL = it(l.info.lights.indL);
        l.indR = it(l.info.lights.indR);
      } else l.glow = l.pool = l.head = l.tail = l.indL = l.indR = null;
    }
    return l;
  };
  return {
    meshes: [],
    pages: [g.page],
    glowIds: uploaded,
    fill(ctx: RallyDrawCtx, out: DrawItem[], k: number): number {
      const runner = ctx.runner;
      const bodies = runner.bodies;
      const night = ctx.day.carLights;
      const blinkOn = ctx.t % BLINK < BLINK / 2;
      if (roster !== runner.roster) {
        // The roster changed: every slot re-reads its model and poses again.
        roster = runner.roster;
        for (const l of lits) if (l) l.t = -1;
      }
      const cx = ctx.cam.pos[0], cy = ctx.cam.pos[1], cz = ctx.cam.pos[2];
      const far = Math.min(ctx.far, LIGHTS_M);
      const far2 = far * far;
      const lens2 = LENS_M * LENS_M;
      const nCars = runner.cars.length;
      // The view's own car (view 0: player 1, else player 2; view 1: player 2) and its heading: the
      // pools of the cars ahead of it show, not of those beside or behind (lead polish 3a).
      const own = ctx.view === 0 ? (runner.carOf(0) ?? runner.carOf(1)) : runner.carOf(1);
      const ofx = own ? sinT(own.yaw) : 0, ofz = own ? cosT(own.yaw) : 0;
      const ox = own ? own.pos[0] : cx, oz = own ? own.pos[2] : cz;
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i] as RallyBody & { spec?: { model: string; clutRow?: number } };
        if (b.hidden) continue;
        const bits = b.lights ?? 0;
        const ind = bits & (BODY_LIGHT.left | BODY_LIGHT.right | BODY_LIGHT.hazard);
        const lamps = night || (bits & (BODY_LIGHT.head | BODY_LIGHT.tail)) !== 0;
        if (!lamps && ind === 0) continue;
        const dx = b.pos[0] - cx, dy = b.pos[1] - cy, dz = b.pos[2] - cz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > far2) continue;
        const model = i < nCars ? b.spec?.model : b.model;
        if (!model) continue;
        const l = litOf(i, model, i < nCars ? b.spec?.clutRow : b.clutRow);
        if (!l.info) continue;
        if (l.t !== ctx.t) {
          l.t = ctx.t;
          mat4PoseYPR(l.m, b.pos[0], b.pos[1], b.pos[2], b.yaw, b.phys.pitch, b.phys.roll);
        }
        if (lamps && l.glow) {
          const id = l.glow.mesh;
          if (!uploaded.has(id)) {
            ctx.v3.upload([carGlowMesh(id, l.info)], [g.page]);
            uploaded.add(id);
          }
          out[k++] = l.glow;
          if (l.pool && d2 <= POOL_M * POOL_M && (b === own || (b.pos[0] - ox) * ofx + (b.pos[2] - oz) * ofz > POOL_AHEAD)) {
            const pid = l.pool.mesh;
            if (!uploaded.has(pid)) {
              ctx.v3.upload([carPoolMesh(pid, l.info)], [g.page]);
              uploaded.add(pid);
            }
            out[k++] = l.pool;
          }
          if (d2 <= lens2) {
            if (l.head) out[k++] = l.head;
            if (l.tail) out[k++] = l.tail;
          }
        }
        if (ind !== 0 && blinkOn) {
          const both = (bits & BODY_LIGHT.hazard) !== 0;
          if ((both || (bits & BODY_LIGHT.left) !== 0) && l.indL) out[k++] = l.indL;
          if ((both || (bits & BODY_LIGHT.right) !== 0) && l.indR) out[k++] = l.indR;
        }
      }
      return k;
    },
  };
}

defineRallyScenery({ id: 'world/car-lights', order: 190, build: buildCarLights });
