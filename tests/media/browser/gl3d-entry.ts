/**
 * Browser bundle for tests/media/browser-3d.test.ts and tools/shot3d.ts (`--test-scene`, `--orbit`):
 * the real WebGL2 3D view (src/engine/gl3d.browser.ts) with small test scenes, built with Vite into
 * an IIFE and run in headless Chromium (SwiftShader without `--gpu`). Exposes `window.Gl3dTest`.
 *
 * Scenes (`shot(name, o)`; the camera at the origin looks along +z unless the scene says else):
 * - `flat`: one emissive quad over the whole view, CLUT grey 102 (the dither reference);
 * - `gradient`: one emissive quad, vertex colours black → white from left to right;
 * - `fog`: five white quads at 20, 100, 180, 260 and 340 m (fog 50 → 300 m toward dark grey);
 * - `snap`: a small quad that moves 0.3 logical px to the side per `t`;
 * - `affine`: a big checker floor (two triangles) seen at a steep angle;
 * - `frontal`: a checker quad that faces the camera (affine = perspective here);
 * - `nearfloor`: a checker floor wholly nearer than `PS1_AFFINE_NEAR` (perspective-correct unless
 *   `o.affineNear` is 0);
 * - `cull`: a front-facing quad left, a back-facing quad right, a two-sided back-facing quad middle;
 * - `blend`: a grey 102 background with a grey 51 quad in the blend mode `o.blend`;
 * - `bias`: two coplanar quads, a red one with a depth bias and a green one without (`t` 1 swaps
 *   their order in the list);
 * - `split`: two views (red quad on top, an empty green sky below);
 * - `scene`: a small road scene (grass, asphalt with lane lines, barriers, buildings, a car with its
 *   blob shadow, lamp glows; sky and fog) for the LOOK at 1×, 2× and 4×, one or two views.
 * The models of the rally content (`orbit(id)`) live in `gl3d-orbit-entry.ts` (a second bundle), so
 * these scenes build even while the content is being edited.
 */
import { createGl3d, type Gl3dStats, type Gl3dView } from '../../../src/engine/gl3d.browser';
import { mat4Identity, mat4Multiply, mat4Perspective, mat4Pose, mat4TransformPoint4, mat4View } from '../../../src/engine/r3/mat';
import { PS1_ON, VIEW3D_H, VIEW3D_W, type Blend3, type Cam3, type DrawItem, type Light3, type Mesh3, type Ps1Opts, type TexturePage, type View3 } from '../../../src/engine/view3d';
import { MeshBuilder, type P3, type UV4 } from '../../../src/game/content/rally/mesh';

export interface Shot {
  w: number;
  h: number;
  /** RGBA bytes, base64. */
  rgba: string;
  /** Projected points of the scene in logical px (fog: the quad centres). */
  points: [number, number][];
  stats: Gl3dStats;
  /** Warnings the GL layer printed during the call. */
  warnings: string[];
}

export interface ShotOpts {
  d?: 1 | 2 | 4;
  ps1?: Partial<Ps1Opts>;
  t?: number;
  players?: 1 | 2;
  blend?: Blend3;
  /** The affine warp's near limit for this shot (m); default the view's own (`PS1_AFFINE_NEAR`). */
  affineNear?: number;
}

const P_FLAT = 900;
const P_CHECK = 901;
const P_GRASS = 902;
const P_ROAD = 903;
const P_WALL = 904;
const P_GLOW = 905;
const P_STEEL = 906;

/** CLUT rows of the flat page. */
const ROW = { grey102: 0, white: 1, red: 2, grey51: 3, green: 4, dark: 5 } as const;

function page(id: number, w: number, h: number, paint: (x: number, y: number) => number, rows: number[][]): TexturePage {
  const index = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) index[y * w + x] = paint(x, y);
  const clut = new Uint32Array(rows.length * 256);
  rows.forEach((r, i) => r.forEach((c, j) => (clut[i * 256 + j] = c >>> 0)));
  return { id, w, h, index, clut };
}

/** A tiny hash for the test textures' noise (no Math.random: the shots repeat). */
function hash(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const PAGES: TexturePage[] = [
  page(P_FLAT, 4, 4, () => 0, [[0x666666ff], [0xffffffff], [0xd04030ff], [0x333333ff], [0x30a050ff], [0x181820ff]]),
  page(P_CHECK, 16, 16, (x, y) => ((x >> 3) + (y >> 3)) & 1, [[0xe8e4dcff, 0x283040ff]]),
  page(P_GRASS, 32, 32, (x, y) => (hash(x, y, 1) < 0.18 ? 2 : hash(x, y, 2) < 0.45 ? 1 : 0), [[0x4a7a34ff, 0x56893cff, 0x3c6430ff]]),
  page(
    P_ROAD,
    32,
    32,
    (x, y) => {
      if (x === 0 || x === 31) return 3; // the edge lines
      if ((x === 10 || x === 21) && y < 16) return 3; // the dashed lane lines
      return hash(x, y, 3) < 0.2 ? 1 : hash(x, y, 4) < 0.15 ? 2 : 0;
    },
    [[0x56585cff, 0x4a4c50ff, 0x626468ff, 0xe8e8e0ff]],
  ),
  page(
    P_WALL,
    32,
    32,
    (x, y) => {
      const wx = x & 7, wy = y & 7;
      if (wx >= 2 && wx <= 5 && wy >= 2 && wy <= 5) return hash(x >> 3, y >> 3, 5) < 0.3 ? 3 : 2;
      return hash(x, y, 6) < 0.2 ? 1 : 0;
    },
    [[0xa89880ff, 0x988a74ff, 0x36485cff, 0xc8d0a0ff]],
  ),
  page(
    P_GLOW,
    16,
    16,
    (x, y) => {
      const dx = x - 7.5, dy = y - 7.5;
      const r = Math.sqrt(dx * dx + dy * dy);
      return r > 7.5 ? 0 : r > 5.5 ? 1 : r > 3 ? 2 : 3;
    },
    [[0x00000000, 0x603010ff, 0xc06020ff, 0xffd080ff]],
  ),
  page(P_STEEL, 8, 8, (_x, y) => (y === 2 || y === 5 ? 1 : 0), [[0x9098a0ff, 0x60686eff]]),
];

const W128: P3 = [128, 128, 128];
const FULL: UV4 = [0, 0, 4, 4];

/** A quad facing the camera at the origin (normal −z), centre (x, y, z), half sizes hx, hy. */
function facing(b: MeshBuilder, x: number, y: number, z: number, hx: number, hy: number, uv: UV4 = FULL, col: P3 = W128): void {
  b.quad([x + hx, y - hy, z], [x - hx, y - hy, z], [x - hx, y + hy, z], [x + hx, y + hy, z], uv, col, [0, 0, -1]);
}

function mesh(id: string, pageId: number, row: number, fill: (b: MeshBuilder) => void, o: { blend?: Blend3; twoSided?: boolean; emissive?: boolean; noNormals?: boolean; bias?: number } = {}): Mesh3 {
  const b = new MeshBuilder();
  fill(b);
  const m: Mesh3 & { bias?: number } = b.build(id, pageId, row, o);
  if (o.bias) m.bias = o.bias;
  return o.noNormals ? { ...m, nrm: undefined } : m;
}

function meshes(): Mesh3[] {
  const out: Mesh3[] = [];
  // Flat colour quads (emissive: the CLUT colour exactly).
  out.push(mesh('t/flat', P_FLAT, ROW.grey102, (b) => facing(b, 0, 0, 10, 40, 40), { emissive: true }));
  out.push(
    mesh(
      't/gradient',
      P_FLAT,
      ROW.white,
      (b) => {
        // Screen left is world +x (the camera looks along +z): black at +x, white at −x.
        const a = b.vertex([12, -8, 10], 0, 0, [0, 0, 0], [0, 0, -1]);
        const c = b.vertex([-12, -8, 10], 0, 0, [128, 128, 128], [0, 0, -1]);
        const d = b.vertex([-12, 8, 10], 0, 0, [128, 128, 128], [0, 0, -1]);
        const e = b.vertex([12, 8, 10], 0, 0, [0, 0, 0], [0, 0, -1]);
        b.tri(a, c, d);
        b.tri(a, d, e);
      },
      { emissive: true },
    ),
  );
  out.push(mesh('t/white', P_FLAT, ROW.white, (b) => facing(b, 0, 0, 0, 0.5, 0.5), { emissive: true }));
  out.push(mesh('t/small', P_FLAT, ROW.red, (b) => facing(b, 0, 0, 10, 1, 1), { emissive: true }));
  out.push(
    mesh('t/floor', P_CHECK, 0, (b) => b.quad([-20, -1.5, 1], [20, -1.5, 1], [20, -1.5, 60], [-20, -1.5, 60], [0, 0, 64, 96], W128, [0, 1, 0]), { emissive: true }),
  );
  out.push(mesh('t/frontal', P_CHECK, 0, (b) => facing(b, 0, 0, 10, 4, 4, [0, 0, 48, 48]), { emissive: true }));
  out.push(mesh('t/nearfloor', P_CHECK, 0, (b) => b.quad([-1.5, -0.6, 0.6], [1.5, -0.6, 0.6], [1.5, -0.6, 2.3], [-1.5, -0.6, 2.3], [0, 0, 48, 32], W128, [0, 1, 0]), { emissive: true }));
  out.push(mesh('t/single', P_FLAT, ROW.red, (b) => facing(b, 0, 0, 0, 1, 1), { emissive: true }));
  out.push(mesh('t/double', P_FLAT, ROW.green, (b) => facing(b, 0, 0, 0, 1, 1), { emissive: true, twoSided: true }));
  out.push(mesh('t/bg', P_FLAT, ROW.grey102, (b) => facing(b, 0, 0, 20, 40, 40), { emissive: true }));
  out.push(mesh('t/biased', P_FLAT, ROW.red, (b) => facing(b, 0, 0, 10, 3, 3), { emissive: true, bias: 2 }));
  out.push(mesh('t/plain', P_FLAT, ROW.green, (b) => facing(b, 0, 0, 10, 3, 3), { emissive: true }));
  for (const bl of ['opaque', 'average', 'add', 'sub', 'quarter'] as const) out.push(mesh(`t/fg-${bl}`, P_FLAT, ROW.grey51, (b) => facing(b, 0, 0, 10, 2, 2), { emissive: true, blend: bl }));
  out.push(...sceneMeshes());
  return out;
}

/** The road scene: grass, a 15 m road along +z with lane lines, barriers, buildings, a car, a blob shadow, glows. */
function sceneMeshes(): Mesh3[] {
  const out: Mesh3[] = [];
  out.push(
    mesh('s/grass', P_GRASS, 0, (b) => {
      for (let z = -40; z < 440; z += 40) for (let x = -160; x < 160; x += 40) b.quad([x, 0, z], [x + 40, 0, z], [x + 40, 0, z + 40], [x, 0, z + 40], [0, 0, 160, 160], W128, [0, 1, 0]);
    }),
  );
  out.push(
    mesh('s/road', P_ROAD, 0, (b) => {
      // Subdivided (4 strips of 3.75 m, 5 m long) so the affine warp shows but the lines stay readable.
      for (let z = -40; z < 440; z += 5) {
        for (let k = 0; k < 4; k++) {
          const x0 = 7.5 - k * 3.75;
          b.quad([x0, 0.02, z], [x0 - 3.75, 0.02, z], [x0 - 3.75, 0.02, z + 5], [x0, 0.02, z + 5], [k * 8, (((z + 40) / 5) & 1) * 16, k * 8 + 8, (((z + 40) / 5) & 1) * 16 + 16], W128, [0, 1, 0]);
        }
      }
    }, { bias: 2 }),
  );
  out.push(
    mesh('s/barrier', P_STEEL, 0, (b) => {
      for (const x of [-8.4, 8.2]) for (let z = -40; z < 440; z += 20) b.box(x, 0, z, x + 0.2, 0.8, z + 20, () => [0, 0, 8, 8], W128);
    }),
  );
  out.push(
    mesh('s/buildings', P_WALL, 0, (b) => {
      let k = 0;
      for (let z = 40; z < 420; z += 55) {
        for (const side of [-1, 1]) {
          const h = 12 + Math.floor(hash(k++, 7, 8) * 30);
          const x0 = side < 0 ? -55 : 30;
          b.box(x0, 0, z, x0 + 25, h, z + 30, (f) => (f === 'top' ? [0, 0, 8, 8] : [0, 0, 32, Math.round((h / 25) * 32)]), [140, 136, 130]);
        }
      }
    }),
  );
  out.push(mesh('s/car', P_FLAT, ROW.red, (b) => b.box(-0.9, 0.25, -2.3, 0.9, 1.45, 2.3, () => FULL, [150, 150, 150])));
  out.push(mesh('s/cabin', P_FLAT, ROW.dark, (b) => b.box(-0.8, 1.45, -1.5, 0.8, 2.0, 1.2, () => FULL, [150, 150, 150])));
  out.push(mesh('s/shadow', P_FLAT, ROW.grey51, (b) => b.quad([-1.2, 0.04, -2.7], [1.2, 0.04, -2.7], [1.2, 0.04, 2.7], [-1.2, 0.04, 2.7], FULL, W128, [0, 1, 0]), { blend: 'sub', emissive: true }));
  out.push(
    mesh(
      's/glows',
      P_GLOW,
      0,
      (b) => {
        for (let z = 20; z < 420; z += 40) for (const x of [-9, 9]) b.quad([x - 1.6, 6.4, z], [x + 1.6, 6.4, z], [x + 1.6, 9.6, z], [x - 1.6, 9.6, z], [0, 0, 16, 16], W128, [0, 0, -1]);
      },
      { blend: 'add', emissive: true, twoSided: true },
    ),
  );
  out.push(
    mesh('s/poles', P_STEEL, 0, (b) => {
      for (let z = 20; z < 420; z += 40) for (const x of [-9.1, 8.9]) b.box(x, 0, z - 0.1, x + 0.2, 8, z + 0.1, () => [0, 0, 8, 8], W128);
    }),
  );
  return out;
}

export const LIGHT: Light3 = {
  sunDir: [0.42, 0.72, 0.55],
  sun: [1, 0.93, 0.8],
  ambient: [0.5, 0.52, 0.6],
  fog: [0.76, 0.82, 0.88],
  fogNear: 160,
  fogFar: 420,
  skyTop: [0.3, 0.5, 0.82],
  skyBottom: [0.76, 0.82, 0.88],
};

const FLAT_LIGHT: Light3 = { ...LIGHT, fogNear: 1000, fogFar: 2000, skyTop: [0.1, 0.15, 0.6], skyBottom: [0.1, 0.15, 0.6] };

function cam(x = 0, y = 0, z = 0, yaw = 0, pitch = 0, fovY = Math.PI / 3, far = 1000): Cam3 {
  return { pos: [x, y, z], yaw, pitch, roll: 0, fovY, near: 0.1, far };
}

let view: Gl3dView | null = null;
let uploaded = false;
export const warnings: string[] = [];
const origWarn = console.warn.bind(console);
console.warn = (...a: unknown[]): void => {
  warnings.push(a.map(String).join(' '));
  origWarn(...a);
};

export function v3(): Gl3dView {
  if (!view) view = createGl3d();
  if (!uploaded && view.ok) {
    view.upload(meshes(), PAGES);
    uploaded = true;
  }
  return view;
}

function base64(bytes: Uint8ClampedArray): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Copy the GL canvas through a 2D canvas (the game's path: `drawImage` in the same task). */
export function grab(src: unknown, points: [number, number][], from: number): Shot | null {
  if (!src || !view) return null;
  const c = src as HTMLCanvasElement;
  const out = document.createElement('canvas');
  out.width = c.width;
  out.height = c.height;
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(c, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height).data;
  return { w: c.width, h: c.height, rgba: base64(data), points, stats: { ...view.stats() }, warnings: warnings.slice(from) };
}

const IDENT = mat4Identity(new Float32Array(16));
const tmp4 = new Float64Array(4);
const proj = new Float32Array(16);
const vm = new Float32Array(16);
const vp = new Float32Array(16);

/** Logical px of a world point in view `v`. */
function project(v: View3, x: number, y: number, z: number): [number, number] {
  mat4Perspective(proj, v.cam.fovY, v.w / v.h, v.cam.near, v.cam.far);
  mat4View(vm, v.cam);
  mat4Multiply(vp, proj, vm);
  mat4TransformPoint4(tmp4, vp, x, y, z);
  return [v.x + (tmp4[0] / tmp4[3] * 0.5 + 0.5) * v.w, v.y + (0.5 - (tmp4[1] / tmp4[3]) * 0.5) * v.h];
}

function full(c: Cam3, light: Light3, items: DrawItem[]): View3 {
  return { x: 0, y: 0, w: VIEW3D_W, h: VIEW3D_H, cam: c, light, items };
}

function sceneItems(carZ: number): DrawItem[] {
  const m = mat4Pose(new Float32Array(16), 1.8, 0, carZ, 0.08);
  return [
    { mesh: 's/grass', m: null },
    { mesh: 's/road', m: null },
    { mesh: 's/barrier', m: null },
    { mesh: 's/buildings', m: null },
    { mesh: 's/poles', m: null },
    { mesh: 's/car', m },
    { mesh: 's/cabin', m },
    { mesh: 's/shadow', m },
    { mesh: 's/glows', m: null },
  ];
}

function build(name: string, o: ShotOpts): { views: View3[]; points: [number, number][] } {
  const t = o.t ?? 0;
  const points: [number, number][] = [];
  switch (name) {
    case 'flat':
      return { views: [full(cam(), FLAT_LIGHT, [{ mesh: 't/flat', m: null }])], points };
    case 'gradient':
      return { views: [full(cam(), FLAT_LIGHT, [{ mesh: 't/gradient', m: null }])], points };
    case 'fog': {
      const light: Light3 = { ...FLAT_LIGHT, fog: [0.1, 0.1, 0.1], fogNear: 50, fogFar: 300 };
      const items: DrawItem[] = [];
      const v = full(cam(), light, items);
      [20, 100, 180, 260, 340].forEach((z, k) => {
        const x = (2 - k) * 0.22 * z;
        const m = new Float32Array(IDENT);
        m[0] = m[5] = m[10] = 0.12 * z;
        m[12] = x;
        m[14] = z;
        items.push({ mesh: 't/white', m });
        points.push(project(v, x, 0, z));
      });
      return { views: [v], points };
    }
    case 'snap': {
      // 1 logical px at 10 m = 2·10·tan(30°)/216 m.
      const px = (20 * Math.tan(Math.PI / 6)) / VIEW3D_H;
      const m = mat4Pose(new Float32Array(16), -0.3 * px * t, 0, 0, 0);
      return { views: [full(cam(), FLAT_LIGHT, [{ mesh: 't/small', m }])], points };
    }
    case 'affine':
      return { views: [full(cam(0, 0, 0, 0, -0.35), FLAT_LIGHT, [{ mesh: 't/floor', m: null }])], points };
    case 'nearfloor':
      return { views: [full(cam(0, 0, 0, 0, -0.75), FLAT_LIGHT, [{ mesh: 't/nearfloor', m: null }])], points };
    case 'frontal':
      return { views: [full(cam(), FLAT_LIGHT, [{ mesh: 't/frontal', m: null }])], points };
    case 'cull': {
      const at = (x: number, yaw: number): Float32Array => mat4Pose(new Float32Array(16), x, 0, 10, yaw);
      return {
        views: [
          full(cam(), FLAT_LIGHT, [
            { mesh: 't/single', m: at(4, 0) },
            { mesh: 't/single', m: at(-4, Math.PI) },
            { mesh: 't/double', m: at(0, Math.PI) },
          ]),
        ],
        points: [project(full(cam(), FLAT_LIGHT, []), 4, 0, 10), project(full(cam(), FLAT_LIGHT, []), -4, 0, 10), project(full(cam(), FLAT_LIGHT, []), 0, 0, 10)],
      };
    }
    case 'bias':
      // Two coplanar quads, the biased one first in the list: it must stay in front.
      return { views: [full(cam(), FLAT_LIGHT, [{ mesh: o.t ? 't/plain' : 't/biased', m: null }, { mesh: o.t ? 't/biased' : 't/plain', m: null }])], points: [[VIEW3D_W / 2, VIEW3D_H / 2]] };
    case 'blend':
      return { views: [full(cam(), FLAT_LIGHT, [{ mesh: 't/bg', m: null }, { mesh: `t/fg-${o.blend ?? 'opaque'}`, m: null }])], points: [[VIEW3D_W / 2, VIEW3D_H / 2], [8, 8]] };
    case 'split': {
      const top: View3 = { x: 0, y: 0, w: VIEW3D_W, h: VIEW3D_H / 2, cam: cam(), light: FLAT_LIGHT, items: [{ mesh: 't/flat', m: null, clutRow: ROW.red }] };
      const green: Light3 = { ...FLAT_LIGHT, skyTop: [0.19, 0.63, 0.31], skyBottom: [0.19, 0.63, 0.31] };
      const bottom: View3 = { x: 0, y: VIEW3D_H / 2, w: VIEW3D_W, h: VIEW3D_H / 2, cam: cam(), light: green, items: [] };
      return { views: [top, bottom], points };
    }
    case 'scene': {
      const carZ = 6 + t * 0.5;
      const items = sceneItems(carZ);
      const chase = cam(1.4, 2.6, carZ - 6.5, 0.05, -0.1, (65 * Math.PI) / 180, 600);
      if ((o.players ?? 1) === 1) return { views: [full(chase, LIGHT, items)], points };
      const c1 = { ...chase, fovY: (38 * Math.PI) / 180 };
      const c2 = cam(-3.5, 1.2, carZ - 14, -0.1, -0.02, (38 * Math.PI) / 180, 600);
      return {
        views: [
          { x: 0, y: 0, w: VIEW3D_W, h: VIEW3D_H / 2, cam: c1, light: LIGHT, items },
          { x: 0, y: VIEW3D_H / 2, w: VIEW3D_W, h: VIEW3D_H / 2, cam: c2, light: LIGHT, items },
        ],
        points,
      };
    }
    default:
      throw new Error(`unknown scene ${name}`);
  }
}

const Gl3dTest = {
  info(): { ok: boolean; reason: string; maxDensity: number } {
    const v = v3();
    return { ok: v.ok, reason: v.reason, maxDensity: v.maxDensity };
  },

  /** Render scene `name` and return its pixels (or null when nothing was drawn). */
  shot(name: string, o: ShotOpts = {}): Shot | null {
    const v = v3();
    const from = warnings.length;
    v.setDensity(o.d ?? 1);
    const { views, points } = build(name, o);
    const keep = v.affineNear;
    if (o.affineNear !== undefined) v.affineNear = o.affineNear;
    const src = v.render(views, { ...PS1_ON, ...o.ps1 });
    v.affineNear = keep;
    return grab(src, points, from);
  },

  /** Lose the context (WEBGL_lose_context); then try to draw and upload while it is lost. */
  async lose(): Promise<{ ok: boolean; reason: string; drew: boolean; threw: string }> {
    const v = v3();
    const c = v.canvas;
    const gl = c?.getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_lose_context') ?? null;
    if (!c || !ext) throw new Error('no WEBGL_lose_context');
    lostExt = ext;
    const ev = new Promise<void>((res) => c.addEventListener('webglcontextlost', () => res(), { once: true }));
    ext.loseContext();
    await Promise.race([ev, new Promise((res) => setTimeout(res, 3000))]);
    let drew = false;
    let threw = '';
    try {
      drew = v.render(build('scene', {}).views, PS1_ON) !== null;
      v.upload([mesh('t/late', P_FLAT, ROW.red, (b) => facing(b, 0, 0, 10, 1, 1), { emissive: true })], []);
      v.setDensity(2);
      v.stats();
    } catch (err) {
      threw = String(err);
    }
    return { ok: v.ok, reason: v.reason, drew, threw };
  },

  /** Restore the lost context and wait for the view to come back. */
  async restore(): Promise<{ ok: boolean; reason: string }> {
    const v = v3();
    const c = v.canvas;
    if (!c || !lostExt) throw new Error('not lost');
    const ev = new Promise<void>((res) => c.addEventListener('webglcontextrestored', () => res(), { once: true }));
    lostExt.restoreContext();
    await Promise.race([ev, new Promise((res) => setTimeout(res, 5000))]);
    lostExt = null;
    return { ok: v.ok, reason: v.reason };
  },

};

let lostExt: WEBGL_lose_context | null = null;

export type Gl3dTestApi = typeof Gl3dTest;
(window as unknown as { Gl3dTest: Gl3dTestApi }).Gl3dTest = Gl3dTest;
