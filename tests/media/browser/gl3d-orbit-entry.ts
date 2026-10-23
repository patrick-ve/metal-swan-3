/**
 * The second browser bundle of the 3D view (tests/media/browser-3d.test.ts, tools/shot3d.ts
 * `--orbit`): `gl3d-entry.ts` plus the rally content (the track and the car models, registered at
 * import) and `Gl3dTest.orbit(id)`: a contact sheet of a model from 8 angles, 45° apart starting at
 * the nose (4 × 2 views of 96 × 108 logical px), on a neutral grey.
 */
import type { P3 } from '../../../src/game/content/rally/mesh';
import '../../../src/game/content/rally/index';
import { listRallyModels, rallyModel } from '../../../src/game/rally/registry';
import { PS1_ON, type DrawItem, type Light3, type Mesh3, type Ps1Opts, type View3 } from '../../../src/engine/view3d';
import { grab, LIGHT, v3, warnings, type Gl3dTestApi, type Shot } from './gl3d-entry';

/** The bounding box centre and the radius of a model's meshes. */
function bounds(meshList: readonly Mesh3[]): { c: P3; r: number } {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (const m of meshList) {
    for (let i = 0; i < m.pos.length; i += 3) {
      x0 = Math.min(x0, m.pos[i]);
      x1 = Math.max(x1, m.pos[i]);
      y0 = Math.min(y0, m.pos[i + 1]);
      y1 = Math.max(y1, m.pos[i + 1]);
      z0 = Math.min(z0, m.pos[i + 2]);
      z1 = Math.max(z1, m.pos[i + 2]);
    }
  }
  const c: P3 = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  return { c, r: Math.max(0.5, Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2) };
}

const Orbit = {
  models(): string[] {
    return listRallyModels();
  },

  /** A contact sheet of model `id` (a `RALLY_MODEL` id) from 8 angles on a neutral grey. */
  orbit(id: string, o: { d?: 1 | 2 | 4; ps1?: Partial<Ps1Opts>; pitch?: number } = {}): Shot | null {
    const v = v3();
    const from = warnings.length;
    const model = rallyModel(id);
    if (!model) throw new Error(`no model ${id} (models: ${listRallyModels().join(', ')})`);
    v.upload(model.meshes, model.pages);
    const parts = model.meshes.filter((m) => model.parts.includes(m.id));
    const { c, r } = bounds(parts.length > 0 ? parts : model.meshes);
    v.setDensity(o.d ?? 4);
    const fovY = 0.6;
    const dist = (r / Math.tan(fovY / 2)) * 1.08;
    const pitch = o.pitch ?? -0.32;
    const grey: Light3 = { ...LIGHT, fogNear: 1e4, fogFar: 2e4, skyTop: [0.42, 0.44, 0.48], skyBottom: [0.42, 0.44, 0.48], sunDir: [0.45, 0.75, 0.48] };
    const items: DrawItem[] = model.parts.map((p) => ({ mesh: p, m: null }));
    const views: View3[] = [];
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const cp = Math.cos(pitch);
      const px = c[0] + Math.sin(a) * dist * cp;
      const pz = c[2] + Math.cos(a) * dist * cp;
      const py = c[1] - Math.sin(pitch) * dist;
      views.push({ x: (k % 4) * 96, y: Math.floor(k / 4) * 108, w: 96, h: 108, cam: { pos: [px, py, pz], yaw: a + Math.PI, pitch, roll: 0, fovY, near: 0.05, far: dist * 4 }, light: grey, items });
    }
    const src = v.render(views, { ...PS1_ON, ...o.ps1 });
    return grab(src, [], from);
  },
};

const w = window as unknown as { Gl3dTest: Gl3dTestApi & typeof Orbit };
Object.assign(w.Gl3dTest, Orbit);
