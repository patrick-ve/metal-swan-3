/**
 * The sky over the A10 (WORLD, wave B; docs/design/rally.md §4, §7.1 item 4): GL's dithered gradient
 * (the time of day's `skyTop` → `skyBottom`, daylight.ts) plus
 * - a CLOUD LAYER: a world-fixed sheet of cut-out clouds 105 m up (above every building, so the depth
 *   test never lets it cover one), lit by the time of day (warm in the afternoon, orange-pink at
 *   sunset, the city's glow at night) and faded into the horizon by the fog;
 * - the SUN: an additive sprite in the sun's direction (`sunAt`, the low autumn sun of lap 1 setting
 *   during lap 2), warm white turning orange-red; gone below the horizon and at night.
 *
 * The cloud sheet follows each view's camera in steps of one tile (a dynamic mesh per view whose uv
 * keeps the clouds fixed in the world). Cosmetic; no allocation per frame.
 */
import { mat4 } from '../../../../engine/r3/mat';
import type { Rgb3, DrawItem, Mesh3, TexturePage } from '../../../../engine/view3d';
import type { RallyTrack } from '../../../rally/api';
import { sunAt } from '../../../rally/daylight';
import { defineRallyScenery, type RallyDrawCtx, type RallyScenery } from '../../../rally/registry';
import { glowTex, GLOW_FULL } from '../lights/page';
import { tone, WORLD_PAGES } from '../sections/pages';
import { CLEAR, PageBuilder } from '../tex/kit';

/** The cloud layer's height (m above the ground; above the tallest building, 96 m). */
export const CLOUD_Y = 105;
/** Tiles of the cloud sheet (m) and their count across. */
const TILE = 100;
const N = 10;
/** Texels per metre of the cloud texture (the page repeats every 1,024 m). */
const TPM = 0.25;
/** The sun sprite: its distance from the camera (inside the fog's near end) and its size (m). */
const SUN_DIST = 140;
const SUN_SIZE = 26;

/** A tileable value noise on a 256 grid (period `p` cells), 0..1. */
function noise(x: number, y: number, p: number, seed: number): number {
  const h = (i: number, j: number): number => {
    let v = (((i % p) + p) % p) * 374761393 + (((j % p) + p) % p) * 668265263 + seed * 2147483647;
    v = Math.imul(v ^ (v >>> 13), 1274126177);
    return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
  };
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** The cloud page (303): 256² of puffy cumulus, cut out between them; shaded light on top, grey below. */
export function cloudPage(): TexturePage {
  const pb = new PageBuilder(WORLD_PAGES.sky, 256, 256);
  pb.addRow([CLEAR, tone('snow', 2), tone('snow', 3), tone('gable', 3), tone('gable', 4), tone('gable', 5), tone('snow', 5), tone('snow', 6)]);
  const r = pb.reserve(0, 0, 256, 256);
  const dens = (x: number, y: number): number => noise(x / 32, y / 32, 8, 1) * 0.55 + noise(x / 16, y / 16, 16, 2) * 0.3;
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const d = dens(x, y) + noise(x / 8, y / 8, 32, 4) * 0.15;
      if (d < 0.56) continue;
      // Light toward the sun side (−y of the texture), darker where the cloud is thin.
      const lit = dens(x, y - 3) - d;
      const k = d > 0.72 ? (lit < 0 ? 7 : 6) : d > 0.64 ? (lit < 0 ? 5 : 4) : d > 0.6 ? 3 : 2;
      pb.set(r, x, y, k);
    }
  }
  return pb.build();
}

/** The sun's tints over the race (warm white → gold → orange → red at the horizon). */
const SUN_TINTS: readonly [number, Rgb3][] = [
  [0, [255, 236, 196]],
  [0.45, [255, 214, 150]],
  [0.75, [255, 168, 96]],
  [0.95, [250, 120, 70]],
];

export interface SkyPart extends RallyScenery {
  /** The sun's direction this frame (tests). */
  readonly sun: Rgb3;
}

/** Build the sky part (the cloud sheets of both views and the sun sprites). */
export function buildSky(track: RallyTrack): SkyPart {
  void track;
  const page = cloudPage();
  const g = glowTex();
  const meshes: Mesh3[] = [];
  // The cloud sheet of each view: N × N tiles, local around the origin (the item matrix moves it).
  const sheets: { mesh: Mesh3; item: DrawItem; m: Float32Array; ix: number; iz: number }[] = [];
  for (let v = 0; v < 2; v++) {
    const n1 = N + 1;
    const pos = new Float32Array(n1 * n1 * 3);
    const uv = new Float32Array(n1 * n1 * 2);
    const rgb = new Uint8Array(n1 * n1 * 3).fill(128);
    const idx = new Uint16Array(N * N * 6);
    const half = (N * TILE) / 2;
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const o = j * n1 + i;
        pos[o * 3] = i * TILE - half;
        pos[o * 3 + 1] = 0;
        pos[o * 3 + 2] = j * TILE - half;
      }
    }
    let k = 0;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const a = j * n1 + i, b = a + 1, c = a + n1, d = c + 1;
        // Facing down (seen from below): counter-clockwise from below.
        idx[k++] = a;
        idx[k++] = b;
        idx[k++] = c;
        idx[k++] = b;
        idx[k++] = d;
        idx[k++] = c;
      }
    }
    const mesh: Mesh3 = { id: `sky/clouds/${v}`, pos, uv, rgb, idx, page: WORLD_PAGES.sky, clutRow: 0, blend: 'opaque', dynamic: true };
    meshes.push(mesh);
    const m = mat4();
    sheets.push({ mesh, item: { mesh: mesh.id, m }, m, ix: 1e9, iz: 1e9 });
  }
  // The sun: one sprite per tint (a quad facing +z in its own space; the matrix turns it to the camera).
  const sunIds: string[] = [];
  for (const [, t] of SUN_TINTS) {
    const id = `sky/sun/${sunIds.length}`;
    const s = SUN_SIZE / 2;
    const r = g.sun;
    meshes.push({
      id,
      pos: new Float32Array([-s, s, 0, s, s, 0, s, -s, 0, -s, -s, 0]),
      uv: new Float32Array([r.x, r.y, r.x + r.w, r.y, r.x + r.w, r.y + r.h, r.x, r.y + r.h]),
      rgb: new Uint8Array([t[0], t[1], t[2], t[0], t[1], t[2], t[0], t[1], t[2], t[0], t[1], t[2]]),
      idx: new Uint16Array([0, 2, 1, 0, 3, 2]),
      page: WORLD_PAGES.lights,
      clutRow: GLOW_FULL,
      blend: 'add',
      emissive: true,
      twoSided: true,
    });
    sunIds.push(id);
  }
  // One sun item per view (both views' lists are drawn after both are filled).
  const suns = [0, 1].map(() => {
    const m = mat4();
    return { m, item: { mesh: sunIds[0], m } as DrawItem };
  });
  const sun: Rgb3 = [0, 0, 0];
  const pages: TexturePage[] = [page, g.page];
  return {
    meshes,
    pages,
    sun,
    fill(ctx: RallyDrawCtx, out: DrawItem[], k: number): number {
      const cam = ctx.cam;
      const sh = sheets[ctx.view] ?? sheets[0];
      // The sheet follows the camera tile by tile; its uv keeps the clouds world-fixed.
      const ix = Math.floor(cam.pos[0] / TILE), iz = Math.floor(cam.pos[2] / TILE);
      if (ix !== sh.ix || iz !== sh.iz) {
        sh.ix = ix;
        sh.iz = iz;
        const n1 = N + 1;
        const half = (N * TILE) / 2;
        const uv = sh.mesh.uv as Float32Array;
        const ox = ix * TILE, oz = iz * TILE;
        for (let j = 0; j <= N; j++) {
          for (let i = 0; i <= N; i++) {
            const o = j * n1 + i;
            const wx = ox + i * TILE - half, wz = oz + j * TILE - half;
            uv[o * 2] = wx * TPM - Math.floor((ox * TPM) / 256) * 256;
            uv[o * 2 + 1] = wz * TPM - Math.floor((oz * TPM) / 256) * 256;
          }
        }
        ctx.v3.updateMesh?.(sh.mesh.id);
      }
      const m = sh.m;
      m[0] = 1;
      m[5] = 1;
      m[10] = 1;
      m[15] = 1;
      m[12] = ix * TILE;
      m[13] = CLOUD_Y;
      m[14] = iz * TILE;
      out[k++] = sh.item;
      // The sun: in the sun's direction from the camera, facing it; not at night or below the horizon.
      const p = ctx.day.progress;
      sunAt(p, sun);
      if (sun[1] > -0.03 && ctx.day.night < 0.5) {
        let ti = 0;
        while (ti + 1 < SUN_TINTS.length && p >= SUN_TINTS[ti + 1][0]) ti++;
        const sv = suns[ctx.view] ?? suns[0];
        const sunM = sv.m;
        sv.item.mesh = sunIds[ti];
        // Billboard: z toward the camera (−sun), x horizontal.
        const fx = -sun[0], fy = -sun[1], fz = -sun[2];
        let rx = fz, rz = -fx;
        const rl = Math.sqrt(rx * rx + rz * rz) || 1;
        rx /= rl;
        rz /= rl;
        // up = f × r
        const ux = fy * rz, uy = fz * rx - fx * rz, uz = -fy * rx;
        sunM[0] = rx;
        sunM[1] = 0;
        sunM[2] = rz;
        sunM[3] = 0;
        sunM[4] = ux;
        sunM[5] = uy;
        sunM[6] = uz;
        sunM[7] = 0;
        sunM[8] = fx;
        sunM[9] = fy;
        sunM[10] = fz;
        sunM[11] = 0;
        sunM[12] = cam.pos[0] + sun[0] * SUN_DIST;
        sunM[13] = cam.pos[1] + sun[1] * SUN_DIST;
        sunM[14] = cam.pos[2] + sun[2] * SUN_DIST;
        sunM[15] = 1;
        out[k++] = sv.item;
      }
      return k;
    },
  };
}

defineRallyScenery({ id: 'world/sky', order: 100, build: buildSky });
