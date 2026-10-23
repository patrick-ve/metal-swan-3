/**
 * The oncoming decor traffic as a scenery part (FIELD, wave B; docs/design/rally.md §3, §7.5;
 * docs/api/rally.md "B.6", "B.F"): the cars of rally/ai-oncoming.ts's plan near each view, drawn as
 * cheap textured boxes (10 triangles each, one dynamic mesh per view: one draw) beyond the central
 * barrier, with their headlights at night (a second, emissive additive mesh). Cosmetic: never in the
 * sim. No allocation per frame (the vertex arrays are rewritten in place).
 */
import type { DrawItem, Mesh3, TexturePage } from '../../../../engine/view3d';
import { splineSample } from '../../../../engine/r3/spline';
import type { RallyTrack } from '../../../rally/api';
import { ONCOMING_KINDS, ONCOMING_LANES, oncomingDensity, oncomingPlan, oncomingS, type OncomingCar } from '../../../rally/ai-oncoming';
import { PAGE_IDS } from '../../../rally/ids';
import type { RallyDrawCtx, RallyScenery } from '../../../rally/registry';
import { PageBuilder, ramp, type TexRect } from '../tex/kit';
import { tone } from '../tex/car-palette';

/** The decor's texture page (a car page id). */
export const ONCOMING_PAGE = PAGE_IDS.cars + 30;
/** Boxes per view (the nearest ones within the fog). */
export const ONCOMING_MAX = 26;
/** Drawn from this far behind the view's car (m) to the fog's end. */
const BEHIND = 40;

/** The page's 16 colours. */
const C = {
  black: 0,
  glassD: 1,
  glassL: 2,
  lamp: 3,
  red: 4,
  paint: 5, // 5..11: the car colours
  trailer: 12,
  trailerB: 13,
  grey: 14,
  amber: 15,
} as const;
const PAINTS = 7;

interface Skin {
  readonly side: TexRect;
  readonly front: TexRect;
  readonly back: TexRect;
  readonly top: TexRect;
}

/** The page: one skin per car colour and two lorry skins. */
function paintPage(): { page: TexturePage; skins: Skin[]; lorry: Skin[]; glow: TexRect } {
  const b = new PageBuilder(ONCOMING_PAGE, 128, 64);
  b.addRow([
    ramp('ink', 0, 0)[0],
    tone('glass', 1),
    tone('glass', 4),
    tone('steel', 7),
    tone('red', 5),
    tone('red', 4),
    tone('navy', 4),
    tone('steel', 5),
    tone('snow', 5),
    tone('black', 2),
    tone('gold', 5),
    tone('green', 3),
    tone('snow', 6),
    tone('sky', 3),
    tone('steel', 3),
    tone('orange', 4),
  ]);
  const skins: Skin[] = [];
  const at = (x: number, y: number, w: number, h: number): TexRect => b.reserve(x, y, w, h);
  for (let k = 0; k < PAINTS; k++) {
    const p = C.paint + k;
    const side = at(k * 16, 0, 16, 8);
    const front = at(k * 16, 8, 8, 8);
    const back = at(k * 16 + 8, 8, 8, 8);
    const top = at(k * 16, 16, 2, 2);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 16; i++) b.set(side, i, j, j >= 1 && j <= 3 && i % 6 !== 0 ? (j === 1 ? C.glassL : C.glassD) : j === 7 && (i === 3 || i === 12) ? C.black : p);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) b.set(front, i, j, j >= 1 && j <= 3 && i > 0 && i < 7 ? C.glassD : j === 5 && (i < 2 || i > 5) ? C.lamp : j === 7 ? C.black : p);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) b.set(back, i, j, j >= 1 && j <= 3 && i > 0 && i < 7 ? C.glassD : j === 5 && (i < 2 || i > 5) ? C.red : j === 7 ? C.black : p);
    b.fill(top, p);
    skins.push({ side, front, back, top });
  }
  const lorry: Skin[] = [];
  for (let k = 0; k < 2; k++) {
    const t = k === 0 ? C.trailer : C.trailerB;
    const side = at(k * 32, 24, 32, 8);
    const front = at(64 + k * 16, 24, 8, 8);
    const back = at(72 + k * 16, 24, 8, 8);
    const top = at(k * 4, 18, 2, 2);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 32; i++) b.set(side, i, j, i >= 28 ? (j >= 1 && j <= 2 ? C.glassD : C.red) : j === 7 ? C.black : i % 5 === 0 ? C.grey : t);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) b.set(front, i, j, j >= 1 && j <= 2 && i > 0 && i < 7 ? C.glassD : j === 5 && (i < 2 || i > 5) ? C.lamp : j === 7 ? C.black : C.red);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) b.set(back, i, j, j === 6 && (i < 2 || i > 5) ? C.red : i === 0 || i === 7 || i === 4 ? C.grey : t);
    b.fill(top, t);
    lorry.push({ side, front, back, top });
  }
  const glow = at(120, 0, 4, 4);
  b.fill(glow, C.lamp);
  return { page: b.build(), skins, lorry, glow };
}

/** Five faces per box (top, the two sides, the front, the back), four vertices each. */
const FACES = 5;
const VERTS = FACES * 4;

/** The static arrays of a box mesh (`n` boxes): indices and the face shades; positions and uvs are filled per frame. */
function boxMesh(id: string, n: number): Mesh3 {
  const idx = new Uint16Array(n * FACES * 6);
  const rgb = new Uint8Array(n * VERTS * 3);
  const shade = [150, 118, 118, 128, 104];
  for (let b = 0; b < n; b++) {
    for (let f = 0; f < FACES; f++) {
      const v = b * VERTS + f * 4;
      const o = (b * FACES + f) * 6;
      idx[o] = v;
      idx[o + 1] = v + 1;
      idx[o + 2] = v + 2;
      idx[o + 3] = v;
      idx[o + 4] = v + 2;
      idx[o + 5] = v + 3;
      for (let q = 0; q < 4; q++) rgb.fill(shade[f], (v + q) * 3, (v + q) * 3 + 3);
    }
  }
  return { id, pos: new Float32Array(n * VERTS * 3), uv: new Float32Array(n * VERTS * 2), rgb, idx, page: ONCOMING_PAGE, clutRow: 0, blend: 'opaque', twoSided: true, dynamic: true };
}

/** Two headlamp quads per box (emissive, additive): the night's lights. */
function lightMesh(id: string, n: number): Mesh3 {
  const idx = new Uint16Array(n * 2 * 6);
  const rgb = new Uint8Array(n * 8 * 3).fill(200);
  for (let q = 0; q < n * 2; q++) {
    const v = q * 4;
    idx.set([v, v + 1, v + 2, v, v + 2, v + 3], q * 6);
  }
  return { id, pos: new Float32Array(n * 8 * 3), uv: new Float32Array(n * 8 * 2), rgb, idx, page: ONCOMING_PAGE, clutRow: 0, blend: 'add', emissive: true, twoSided: true, dynamic: true };
}

/** The oncoming traffic's scenery part (one box mesh and one light mesh per view). */
export function buildOncoming(track: RallyTrack): RallyScenery {
  const { page, skins, lorry, glow } = paintPage();
  const plan: OncomingCar[] = oncomingPlan(track.length, skins.length);
  const meshes: Mesh3[] = [];
  const views: { box: Mesh3; light: Mesh3; boxItem: DrawItem; lightItem: DrawItem; used: number }[] = [];
  for (let v = 0; v < 2; v++) {
    const box = boxMesh(`oncoming/${v}`, ONCOMING_MAX);
    const light = lightMesh(`oncoming/${v}/lights`, ONCOMING_MAX);
    meshes.push(box, light);
    views.push({ box, light, boxItem: { mesh: box.id, m: null }, lightItem: { mesh: light.id, m: null }, used: ONCOMING_MAX });
  }
  const sp = splineSample();
  const L = track.length;
  const gu = glow.x + 1;
  const gv = glow.y + 1;
  /** Write box `b` of mesh `m`: centre (x, y, z), forward (fx, fz) (its direction of travel). Both faces drawn (decor). */
  const writeBox = (m: Mesh3, lm: Mesh3, b: number, x: number, y: number, z: number, fx: number, fz: number, kind: number, sk: Skin): void => {
    const K = ONCOMING_KINDS[kind];
    const rx = -fz;
    const rz = fx;
    const pos = m.pos;
    const uv = m.uv;
    const y0 = y + K.y0;
    const y1 = y + K.y1;
    const fxl = fx * K.hl, fzl = fz * K.hl, rxw = rx * K.hw, rzw = rz * K.hw;
    const P = CORNERS;
    P[0] = x + fxl - rxw; P[1] = z + fzl - rzw;
    P[2] = x + fxl + rxw; P[3] = z + fzl + rzw;
    P[4] = x - fxl + rxw; P[5] = z - fzl + rzw;
    P[6] = x - fxl - rxw; P[7] = z - fzl - rzw;
    let v = b * VERTS;
    const t = sk.top, sd = sk.side, fr = sk.front, bk = sk.back;
    v = putV(pos, uv, v, P[0], y1, P[1], t.x, t.y);
    v = putV(pos, uv, v, P[2], y1, P[3], t.x + t.w, t.y);
    v = putV(pos, uv, v, P[4], y1, P[5], t.x + t.w, t.y + t.h);
    v = putV(pos, uv, v, P[6], y1, P[7], t.x, t.y + t.h);
    v = putV(pos, uv, v, P[2], y0, P[3], sd.x, sd.y + sd.h);
    v = putV(pos, uv, v, P[4], y0, P[5], sd.x + sd.w, sd.y + sd.h);
    v = putV(pos, uv, v, P[4], y1, P[5], sd.x + sd.w, sd.y);
    v = putV(pos, uv, v, P[2], y1, P[3], sd.x, sd.y);
    v = putV(pos, uv, v, P[6], y0, P[7], sd.x + sd.w, sd.y + sd.h);
    v = putV(pos, uv, v, P[0], y0, P[1], sd.x, sd.y + sd.h);
    v = putV(pos, uv, v, P[0], y1, P[1], sd.x, sd.y);
    v = putV(pos, uv, v, P[6], y1, P[7], sd.x + sd.w, sd.y);
    v = putV(pos, uv, v, P[0], y0, P[1], fr.x, fr.y + fr.h);
    v = putV(pos, uv, v, P[2], y0, P[3], fr.x + fr.w, fr.y + fr.h);
    v = putV(pos, uv, v, P[2], y1, P[3], fr.x + fr.w, fr.y);
    v = putV(pos, uv, v, P[0], y1, P[1], fr.x, fr.y);
    v = putV(pos, uv, v, P[4], y0, P[5], bk.x, bk.y + bk.h);
    v = putV(pos, uv, v, P[6], y0, P[7], bk.x + bk.w, bk.y + bk.h);
    v = putV(pos, uv, v, P[6], y1, P[7], bk.x + bk.w, bk.y);
    putV(pos, uv, v, P[4], y1, P[5], bk.x, bk.y);
    // Its headlamps: two small quads just in front of the front face.
    const lp = lm.pos;
    const luv = lm.uv;
    let q = b * 8;
    const ly = y0 + (y1 - y0) * (kind === 2 ? 0.12 : 0.38);
    for (let sgn = -1; sgn <= 1; sgn += 2) {
      const cx = x + fx * (K.hl + 0.05) + rx * sgn * (K.hw - 0.22);
      const cz = z + fz * (K.hl + 0.05) + rz * sgn * (K.hw - 0.22);
      for (let c = 0; c < 4; c++) q = putV(lp, luv, q, cx + rx * LAMP[c * 2] * 0.16, ly + LAMP[c * 2 + 1] * 0.12, cz + rz * LAMP[c * 2] * 0.16, gu, gv);
    }
  };
  /** Collapse box b (and its lamps) to a point (drawn as nothing). */
  const hide = (m: Mesh3, lm: Mesh3, b: number): void => {
    m.pos.fill(0, b * VERTS * 3, (b + 1) * VERTS * 3);
    lm.pos.fill(0, b * 8 * 3, (b + 1) * 8 * 3);
  };
  return {
    meshes,
    pages: [page],
    fill(ctx: RallyDrawCtx, out: DrawItem[], k: number): number {
      const vw = views[ctx.view === 1 ? 1 : 0];
      const car = ctx.runner.carOf(ctx.view === 1 ? 1 : 0) ?? ctx.runner.carOf(0);
      if (!car) return k;
      const dens = oncomingDensity(ctx.day.progress);
      let n = 0;
      for (let i = 0; i < plan.length && n < ONCOMING_MAX; i++) {
        const c = plan[i];
        if (c.rank > dens) continue;
        const s = oncomingS(c, L, ctx.t);
        let ds = s - car.s;
        if (ds > L / 2) ds -= L;
        else if (ds < -L / 2) ds += L;
        if (ds < -BEHIND || ds > ctx.far) continue;
        track.spline.sample(s, sp);
        const side = ONCOMING_LANES[c.lane].side;
        const x = sp.p[0] + sp.r[0] * side;
        const z = sp.p[2] + sp.r[2] * side;
        const th = Math.sqrt(sp.t[0] * sp.t[0] + sp.t[2] * sp.t[2]) || 1;
        const sk = c.kind === 2 ? lorry[c.skin & 1] : skins[c.skin];
        writeBox(vw.box, vw.light, n, x, sp.p[1], z, -sp.t[0] / th, -sp.t[2] / th, c.kind, sk);
        n++;
      }
      for (let b = n; b < vw.used; b++) hide(vw.box, vw.light, b);
      vw.used = n;
      ctx.v3.updateMesh?.(vw.box.id);
      out[k++] = vw.boxItem;
      if (ctx.day.carLights) {
        ctx.v3.updateMesh?.(vw.light.id);
        out[k++] = vw.lightItem;
      }
      return k;
    },
  };
}

/** Scratch corners (x, z) × 4. */
const CORNERS = new Float64Array(8);
/** A lamp quad's corners (−1 / 1 across, down / up). */
const LAMP: readonly number[] = [-1, -1, 1, -1, 1, 1, -1, 1];

/** Write one vertex (position, uv) at index v; returns v + 1. */
function putV(pos: Float32Array, uv: Float32Array, v: number, x: number, y: number, z: number, u: number, w: number): number {
  pos[v * 3] = x;
  pos[v * 3 + 1] = y;
  pos[v * 3 + 2] = z;
  uv[v * 2] = u;
  uv[v * 2 + 1] = w;
  return v + 1;
}
