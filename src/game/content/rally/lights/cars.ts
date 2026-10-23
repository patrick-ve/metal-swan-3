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
/** Fixer (wave B): the headlight pool: its length ahead of the nose (m), its tint, its brightness at the nose (share) and where it is full (share of the length). */
export const POOL_LEN = 24;
const POOL_RGB = [112, 110, 98] as const;
const POOL_NEAR = 0.15;
const POOL_RISE = 0.7;
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
  const box = info.anchors.box;
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
  // The pool of the headlights on the road ahead (facing up).
  // Cut into cells (integrator, wave B): one big quad showed the affine warp as a pool shifted to one side.
  // Fixer (wave B): longer, with its near part faded (vertex colours): the bright middle of a short pool
  // was the only part the car did not hide from a chase camera, and read as a lamp on the roof.
  const z0 = box.z1 + 0.6, z1 = box.z1 + POOL_LEN;
  const PX = 2, PZ = 6;
  const pr = g.pool;
  const shade = (z: number): number[] => {
    const t = (z - z0) / (z1 - z0);
    const f = POOL_NEAR + (1 - POOL_NEAR) * (t >= POOL_RISE ? 1 : t / POOL_RISE);
    return [Math.round(POOL_RGB[0] * f), Math.round(POOL_RGB[1] * f), Math.round(POOL_RGB[2] * f)];
  };
  for (let iz = 0; iz < PZ; iz++) {
    for (let ix = 0; ix < PX; ix++) {
      const xa = 2.3 - (4.6 * ix) / PX, xb = 2.3 - (4.6 * (ix + 1)) / PX;
      const za = z1 - ((z1 - z0) * iz) / PZ, zb = z1 - ((z1 - z0) * (iz + 1)) / PZ;
      const r = { x: pr.x + (pr.w * ix) / PX, y: pr.y + (pr.h * iz) / PZ, w: pr.w / PX, h: pr.h / PZ };
      const o = pos.length / 3;
      pos.push(xa, 0.04, za, xb, 0.04, za, xb, 0.04, zb, xa, 0.04, zb);
      uv.push(r.x, r.y, r.x + r.w, r.y, r.x + r.w, r.y + r.h, r.x, r.y + r.h);
      const ca = shade(za), cb = shade(zb);
      rgb.push(...ca, ...ca, ...cb, ...cb);
      idx.push(o, o + 2, o + 1, o, o + 3, o + 2);
    }
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

/** What one car or body draws with (rebuilt when its model changes). */
interface Lit {
  model: string;
  row: number | undefined;
  /** The frame it was posed for. */
  t: number;
  info: RallyCarModel | null;
  readonly m: Float32Array;
  glow: DrawItem | null;
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
    if (!l) l = lits[i] = { model: '', row: undefined, t: -1, info: null, m: new Float32Array(16), glow: null, head: null, tail: null, indL: null, indR: null };
    if (l.model !== model || l.row !== row) {
      l.model = model;
      l.row = row;
      l.info = carModelInfo(rallyModel(model));
      if (l.info) {
        const it = (mesh: string): DrawItem => (row === undefined ? { mesh, m: l.m } : { mesh, m: l.m, clutRow: row });
        l.glow = { mesh: `fx/carglow/${model}`, m: l.m };
        l.head = it(l.info.lights.head);
        l.tail = it(l.info.lights.tail);
        l.indL = it(l.info.lights.indL);
        l.indR = it(l.info.lights.indR);
      } else l.glow = l.head = l.tail = l.indL = l.indR = null;
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
