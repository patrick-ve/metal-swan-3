/**
 * The UHD path of the first-person figures (UHD wave, docs/ART_GUIDE.md "UHD art"): the SAME
 * figure3d rigs (src/game/art/figure3d.ts) that make the 1× billboards, weapon views, props and
 * items, rasterised natively at density d (2 or 4) into an HdCanvas G-buffer — exact 3D surfaces,
 * depth and unit normals per art px — and lit by the UHD kit: one key light from the upper left,
 * a cool bounce, rim light, ambient occlusion where parts meet, speculars on metal, HD ramps of
 * 6–8 tones (each 1× material ramp stretched over its HD home ramp, one deeper tone below and one
 * highlight above), clean clusters (no dither on sprites) and outline A (ink, 1 logical px = d art
 * px). Interior seams follow figure3d's rule (a part in front of another by more than 1.2 body
 * units; 3 for the same material) in the deepest tone of the part behind.
 *
 * `fig(f, o)` is the drawers' one entry: renderFigure itself at density 1 (the 1× pixels stay
 * byte-identical), the HD path inside `withFigDensity(d, …)`. Overlays and 2D details read
 * `figDensity()` to draw at the same logical size. Pure and deterministic.
 */
import type { Color } from '../../../engine/color';
import { hdHome, PAL_HD } from '../../../engine/palette-hd';
import { PixelBuffer, type Ramp } from '../../../engine/pixel';
import { mulMM, mulMV, norm3, renderFigure, transpose, IDENT, type Figure, type M3, type Mat, type Projector, type RenderOpts, type V3 } from '../../art/figure3d';
import { HdCanvas, type HdMaterial } from '../../art/hd';

let FD = 1;

/** The density the fps figure drawers paint at now (1, or 2 / 4 inside `withFigDensity`). */
export function figDensity(): number {
  return FD;
}

/** Run `fn` with the fps figure drawers painting at density `d` (1, 2 or 4). */
export function withFigDensity<T>(d: number, fn: () => T): T {
  const prev = FD;
  FD = d === 2 || d === 4 ? d : 1;
  try {
    return fn();
  } finally {
    FD = prev;
  }
}

/** renderFigure at the current density: the 1× rasteriser at 1, the HD path at 2 and 4. */
export function fig(f: Figure, o: RenderOpts): PixelBuffer {
  return FD === 1 ? renderFigure(f, o) : renderFigureHd(f, o, FD);
}

/** `fig` cropped to the logical window x, y, w, h (the HD path renders only the window). */
export function figWin(f: Figure, o: RenderOpts, x: number, y: number, w: number, h: number): PixelBuffer {
  return FD === 1 ? renderFigure(f, o).crop(x, y, w, h) : renderFigureHd(f, o, FD, { win: [x, y, w, h] });
}

// ------------------------------------------------------------------------------------ materials

/** Light of a material in the HD path (the ramp comes from the 1× material). */
export type HdLook = Omit<HdMaterial, 'ramp'>;

const looks = new WeakMap<Mat, HdLook>();

/** Give a 1× material its HD light (metal spec, cloth wrap …); returns the material. */
export function hdLook<M extends Mat>(m: M, look: HdLook): M {
  looks.set(m, look);
  return m;
}

const rampCache = new WeakMap<Ramp, Ramp>();

/**
 * The HD ramp of a 1× material ramp: each colour's HD home tone, the HD tones between two
 * neighbours of the same home ramp, one deeper tone below the darkest (separations, crevices) and
 * one lighter above the lightest (specular, rim). Colours outside both palettes are kept.
 */
export function hdRampFor(r: Ramp): Ramp {
  const hit = rampCache.get(r);
  if (hit) return hit;
  const out: Color[] = [];
  const push = (c: Color): void => {
    if (out.length === 0 || out[out.length - 1] !== c) out.push(c >>> 0);
  };
  const homes = r.map((c) => hdHome(c));
  for (let k = 0; k < r.length; k++) {
    const h = homes[k];
    if (!h) {
      push(r[k]);
      continue;
    }
    if (k === 0 && r.length > 1 && h.i > 0) push(h.ramp[h.i - 1]);
    const prev = k > 0 ? homes[k - 1] : null;
    if (prev && prev.ramp === h.ramp) for (let i = prev.i + 1; i < h.i; i++) push(h.ramp[i]);
    push(h.ramp[h.i]);
    if (k === r.length - 1 && r.length > 1 && h.i < h.ramp.length - 1) push(h.ramp[h.i + 1]);
  }
  rampCache.set(r, out);
  return out;
}

/** The HD ramp holding most of `ramp`'s colours. */
function homeOf(ramp: Ramp): Ramp | null {
  let best: Ramp | null = null;
  let bestN = 0;
  for (const hd of Object.values(PAL_HD) as Ramp[]) {
    let n = 0;
    for (const c of ramp) if (hd.includes(c)) n++;
    if (n > bestN) {
      bestN = n;
      best = hd;
    }
  }
  return best;
}

/** A default light by the material's colour family (metal shines, cloth wraps, skin a soft sheen). */
function guessLook(ramp: Ramp): HdLook {
  const h = homeOf(ramp);
  if (h === PAL_HD.steel || h === PAL_HD.gold || h === PAL_HD.snow) return { spec: 0.85, shine: 28, wrap: 0.05 };
  if (h === PAL_HD.black || h === PAL_HD.ink) return { spec: 0.4, shine: 18, wrap: 0.1 };
  if (h === PAL_HD.skinA || h === PAL_HD.skinB || h === PAL_HD.skinC) return { spec: 0.22, shine: 14, wrap: 0.22 };
  if (h === PAL_HD.brown || h === PAL_HD.wood) return { spec: 0.15, shine: 14, wrap: 0.18 };
  return { wrap: 0.25 };
}

function hdMatOf(m: Mat): HdMaterial {
  const ramp = hdRampFor(m.ramp);
  return { ramp, ...(looks.get(m) ?? guessLook(ramp)) };
}

// ----------------------------------------------------------------------------------- rasterise

/** Box edge chamfer width (logical px) and how far its normal leans at the very edge (1 = 45°). */
const BEVEL = 0.75;
const BEVEL_LEAN = 1.1;

/** Options of the HD render beyond figure3d's. */
export interface FigHdOpts {
  /** Ambient occlusion strength (default 0.3). */
  ao?: number;
  /** Rim light band (default 1). */
  rimLight?: number;
  /**
   * Render only this window of the size² frame (logical x, y, w, h): the result is w·d × h·d,
   * the same px as cropping the full render (a weapon view keeps 112 × 80 of its 160² rig).
   */
  win?: readonly [number, number, number, number];
}

/**
 * Render a figure at density d: a (size·d)² buffer, the same projection as renderFigure at 1×
 * (every logical size, the ground line and the centre scaled by d), lit and outlined by the UHD
 * kit. Overlays run last on the HD buffer with an HD projector (they read `figDensity()`).
 */
export function renderFigureHd(fig: Figure, o: RenderOpts, d: number, ho: FigHdOpts = {}): PixelBuffer {
  const N1 = o.size;
  const [wx, wy, W1, H1] = ho.win ?? [0, 0, N1, N1];
  const NW = W1 * d;
  const NH = H1 * d;
  const scale = (o.scale ?? 1) * d;
  const cx = ((o.cx ?? N1 / 2) - wx) * d;
  const gy = ((o.ground ?? N1 - 1) - wy) * d;
  const th = o.angle ?? ((o.yaw ?? 0) * Math.PI) / 4;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const turn: M3 = [-c, 0, -s, 0, 1, 0, -s, 0, c];
  const pose = o.pose ?? IDENT;
  const pivot = o.pivot ?? [0, 0, 0];
  const off = o.offset ?? [0, 0, 0];
  const rot = mulMM(turn, pose);
  const toView = (v: V3): V3 => {
    const lx = v[0] - pivot[0];
    const ly = v[1] - pivot[1];
    const lz = v[2] - pivot[2];
    const pv = mulMV(pose, [lx, ly, lz]);
    const w = mulMV(turn, [pv[0] + pivot[0] + off[0], pv[1] + pivot[1] + off[1], pv[2] + pivot[2] + off[2]]);
    return [w[0] * scale, w[1] * scale, w[2] * scale];
  };
  const proj: Projector = {
    p: (v) => {
      const w = toView(v);
      return [cx + w[0], gy - w[1], w[2]];
    },
    rot,
  };

  const n = NW * NH;
  const z = new Float64Array(n).fill(-Infinity);
  const nx = new Float32Array(n);
  const ny = new Float32Array(n);
  const nz = new Float32Array(n);
  const pid = new Int16Array(n).fill(-1);
  const write = (i: number, depth: number, x: number, y: number, zz: number, id: number): void => {
    if (depth <= z[i]) return;
    z[i] = depth;
    nx[i] = x;
    ny[i] = y;
    nz[i] = zz;
    pid[i] = id;
  };

  const Ob: [number, number, number] = [0, 0, 0];
  fig.parts.forEach((part, id) => {
    if (part.k === 'cap') {
      const A = toView(part.a);
      const B = toView(part.b);
      const ra = part.ra * scale;
      const rb = part.rb * scale;
      const rmax = Math.max(ra, rb);
      const x0 = Math.max(0, Math.floor(cx + Math.min(A[0], B[0]) - rmax - 1));
      const x1 = Math.min(NW - 1, Math.ceil(cx + Math.max(A[0], B[0]) + rmax + 1));
      const y0 = Math.max(0, Math.floor(gy - Math.max(A[1], B[1]) - rmax - 1));
      const y1 = Math.min(NH - 1, Math.ceil(gy - Math.min(A[1], B[1]) + rmax + 1));
      const dx = B[0] - A[0];
      const dy = B[1] - A[1];
      const dz = B[2] - A[2];
      const L2xy = dx * dx + dy * dy;
      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          const vx = px + 0.5 - cx;
          const vy = gy - (py + 0.5);
          let t = 0;
          if (L2xy > 1e-9) t = Math.max(0, Math.min(1, ((vx - A[0]) * dx + (vy - A[1]) * dy) / L2xy));
          const qx = A[0] + dx * t;
          const qy = A[1] + dy * t;
          const qz = A[2] + dz * t;
          const r = ra + (rb - ra) * t;
          const ex = vx - qx;
          const ey = vy - qy;
          const d2 = ex * ex + ey * ey;
          if (d2 > r * r) continue;
          const h = Math.sqrt(r * r - d2);
          write(py * NW + px, qz + h, ex / r, ey / r, h / r, id);
        }
      }
      return;
    }
    const C = toView(part.c);
    const R = mulMM(rot, part.rot);
    const Rt = transpose(R);
    const ext = part.k === 'ell' ? part.r : part.h;
    const ex = ext[0] * scale;
    const ey = ext[1] * scale;
    const ez = ext[2] * scale;
    const rad = part.k === 'ell' ? Math.max(ex, ey, ez) : Math.hypot(ex, ey, ez);
    const x0 = Math.max(0, Math.floor(cx + C[0] - rad - 1));
    const x1 = Math.min(NW - 1, Math.ceil(cx + C[0] + rad + 1));
    const y0 = Math.max(0, Math.floor(gy - C[1] - rad - 1));
    const y1 = Math.min(NH - 1, Math.ceil(gy - C[1] + rad + 1));
    const D = mulMV(Rt, [0, 0, 1]);
    const O = Ob;
    const rad2 = (rad + 0.75) * (rad + 0.75);
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const vx = px + 0.5 - cx;
        const vy = gy - (py + 0.5);
        const ax = vx - C[0];
        const ay = vy - C[1];
        // outside the part's bounding sphere seen from the front: no hit
        if (ax * ax + ay * ay > rad2) continue;
        const az = -C[2];
        O[0] = Rt[0] * ax + Rt[1] * ay + Rt[2] * az;
        O[1] = Rt[3] * ax + Rt[4] * ay + Rt[5] * az;
        O[2] = Rt[6] * ax + Rt[7] * ay + Rt[8] * az;
        if (part.k === 'cyl') {
          const r = ex;
          const hh = ey;
          const qa = D[0] * D[0] + D[2] * D[2];
          let t0 = -Infinity;
          let t1 = Infinity;
          if (qa < 1e-9) {
            if (O[0] * O[0] + O[2] * O[2] > r * r) continue;
          } else {
            const qb = 2 * (O[0] * D[0] + O[2] * D[2]);
            const qc = O[0] * O[0] + O[2] * O[2] - r * r;
            const disc = qb * qb - 4 * qa * qc;
            if (disc < 0) continue;
            const sq = Math.sqrt(disc);
            t0 = (-qb - sq) / (2 * qa);
            t1 = (-qb + sq) / (2 * qa);
          }
          let s0 = -Infinity;
          let s1 = Infinity;
          if (Math.abs(D[1]) < 1e-9) {
            if (O[1] < -hh || O[1] > hh) continue;
          } else {
            s0 = (-hh - O[1]) / D[1];
            s1 = (hh - O[1]) / D[1];
            if (s0 > s1) {
              const tt = s0;
              s0 = s1;
              s1 = tt;
            }
          }
          const lo = Math.max(t0, s0);
          const hi = Math.min(t1, s1);
          if (lo > hi) continue;
          let nl: V3;
          if (s1 <= t1) nl = [0, D[1] > 0 ? 1 : -1, 0];
          else nl = [(O[0] + D[0] * hi) / r, 0, (O[2] + D[2] * hi) / r];
          const nv = norm3(mulMV(R, nl));
          write(py * NW + px, hi, nv[0], nv[1], nv[2], id);
        } else if (part.k === 'ell') {
          const ox = O[0] / ex;
          const oy = O[1] / ey;
          const oz = O[2] / ez;
          const dxl = D[0] / ex;
          const dyl = D[1] / ey;
          const dzl = D[2] / ez;
          const qa = dxl * dxl + dyl * dyl + dzl * dzl;
          const qb = 2 * (ox * dxl + oy * dyl + oz * dzl);
          const qc = ox * ox + oy * oy + oz * oz - 1;
          const disc = qb * qb - 4 * qa * qc;
          if (disc < 0) continue;
          const t = (-qb + Math.sqrt(disc)) / (2 * qa);
          const lx = O[0] + D[0] * t;
          const ly = O[1] + D[1] * t;
          const lz = O[2] + D[2] * t;
          const nv = norm3(mulMV(R, [lx / (ex * ex), ly / (ey * ey), lz / (ez * ez)]));
          write(py * NW + px, t, nv[0], nv[1], nv[2], id);
        } else {
          let tmin = -Infinity;
          let tmax = Infinity;
          let axis = 0;
          let sign = 1;
          let miss = false;
          for (let k = 0; k < 3 && !miss; k++) {
            const h = k === 0 ? ex : k === 1 ? ey : ez;
            if (Math.abs(D[k]) < 1e-9) {
              if (O[k] < -h || O[k] > h) miss = true;
              continue;
            }
            let t0 = (-h - O[k]) / D[k];
            let t1 = (h - O[k]) / D[k];
            if (t0 > t1) {
              const tt = t0;
              t0 = t1;
              t1 = tt;
            }
            if (t1 < tmax) {
              tmax = t1;
              axis = k;
              sign = D[k] > 0 ? 1 : -1;
            }
            if (t0 > tmin) tmin = t0;
          }
          if (miss || tmin > tmax) continue;
          const nl: [number, number, number] = axis === 0 ? [sign, 0, 0] : axis === 1 ? [0, sign, 0] : [0, 0, sign];
          // A chamfer along the face's edges (BEVEL logical px, at most a third of the face's
          // smaller half-extent): the normal leans toward the neighbour face, so a box edge
          // catches the key light or falls into shade (form, not one flat tone per face).
          const ha = axis === 0 ? ey : ex;
          const hb = axis === 2 ? ey : ez;
          const bw = Math.min(BEVEL * d, 0.34 * Math.min(ha, hb));
          if (bw > 0.6) {
            const pa = axis === 0 ? O[1] + D[1] * tmax : O[0] + D[0] * tmax;
            const pb = axis === 2 ? O[1] + D[1] * tmax : O[2] + D[2] * tmax;
            const ka = Math.max(0, 1 - (ha - Math.abs(pa)) / bw);
            const kb = Math.max(0, 1 - (hb - Math.abs(pb)) / bw);
            if (ka > 0 || kb > 0) {
              const la = BEVEL_LEAN * ka * (pa < 0 ? -1 : 1);
              const lb = BEVEL_LEAN * kb * (pb < 0 ? -1 : 1);
              if (axis === 0) {
                nl[1] = la;
                nl[2] = lb;
              } else if (axis === 1) {
                nl[0] = la;
                nl[2] = lb;
              } else {
                nl[0] = la;
                nl[1] = lb;
              }
            }
          }
          const nv = norm3(mulMV(R, nl));
          write(py * NW + px, tmax, nv[0], nv[1], nv[2], id);
        }
      }
    }
  });

  // G-buffer → HdCanvas (normals: y down; depth in logical px).
  const cv = new HdCanvas(W1, H1, d);
  const matIds = new Map<Mat, number>();
  const toneOf = new Map<Mat, number>();
  const partMat: number[] = [];
  const partFix: Color[] = [];
  fig.parts.forEach((part, id) => {
    const m = part.mat;
    let mid = matIds.get(m);
    if (mid === undefined) {
      const hm = hdMatOf(m);
      mid = cv.material(hm);
      matIds.set(m, mid);
      toneOf.set(m, (m.bias ?? 0) / Math.max(1, m.ramp.length - 1));
    }
    partMat[id] = mid;
    partFix[id] = m.glow ? cv.getMaterial(mid).ramp[cv.getMaterial(mid).ramp.length - 1] : 0;
  });
  for (let i = 0; i < n; i++) {
    const id = pid[i];
    if (id < 0) continue;
    cv.mat[i] = partMat[id];
    cv.part[i] = id + 1;
    const zl = z[i] / d;
    cv.zb[i] = zl;
    cv.pz[i] = zl;
    cv.nx[i] = nx[i];
    cv.ny[i] = -ny[i];
    cv.nz[i] = nz[i];
    cv.tone[i] = toneOf.get(fig.parts[id].mat) ?? 0;
    cv.fix[i] = partFix[id];
  }
  // Dots (eyes, buttons, badges): fixed-colour discs of the dot's logical size, depth-tested.
  for (const dot of fig.dots) {
    const [sx, sy, sz] = proj.p(dot.p);
    const r = Math.max(0.5, (dot.s ?? 1) / 2) * d;
    const slack = (dot.slack ?? 1.5) * scale;
    const X0 = Math.max(0, Math.floor(sx - r));
    const X1 = Math.min(NW - 1, Math.ceil(sx + r));
    const Y0 = Math.max(0, Math.floor(sy - r));
    const Y1 = Math.min(NH - 1, Math.ceil(sy + r));
    for (let Y = Y0; Y <= Y1; Y++) {
      for (let X = X0; X <= X1; X++) {
        const ddx = X + 0.5 - sx;
        const ddy = Y + 0.5 - sy;
        if (ddx * ddx + ddy * ddy > r * r) continue;
        const i = Y * NW + X;
        if (pid[i] < 0 || z[i] > sz + slack) continue;
        cv.fix[i] = dot.c >>> 0;
      }
    }
  }
  const out = cv.render({ outline: o.outline === false ? 'none' : 'A', ao: ho.ao ?? 0.3, sep: false, sepZ: 1.0, rimLight: ho.rimLight ?? 1 });
  // Seams (figure3d's rule, in art units): a part boundary where the neighbour is nearer.
  const near = 1.2 * scale;
  const sameMat = 3 * scale;
  const seam = new Uint8Array(n);
  for (let Y = 0; Y < NH; Y++) {
    for (let X = 0; X < NW; X++) {
      const i = Y * NW + X;
      const id = pid[i];
      if (id < 0 || cv.fix[i] !== 0) continue;
      for (let k = 0; k < 4; k++) {
        const XX = X + (k === 0 ? 1 : k === 1 ? -1 : 0);
        const YY = Y + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (XX < 0 || YY < 0 || XX >= NW || YY >= NH) continue;
        const j = YY * NW + XX;
        const jd = pid[j];
        if (jd < 0 || jd === id) continue;
        if (fig.parts[jd].mat === fig.parts[id].mat && Math.abs(z[j] - z[i]) < sameMat) continue;
        if (z[j] > z[i] + near) {
          seam[i] = 1;
          break;
        }
      }
    }
  }
  for (let i = 0; i < n; i++) if (seam[i]) out.data[i] = cv.getMaterial(cv.mat[i]).ramp[0];
  for (const f of fig.overlays) f(out, proj);
  return out.touch();
}

// ------------------------------------------------------------------------------- 2D details

/**
 * Visit every art px of `b` (density `figDensity()`) whose centre lies in the logical box x, y, w, h:
 * `fn(x, y, c)` gets the centre in logical px and the colour, and returns the new colour (0 = keep).
 * The 2D details of the drawers (bands, stains, stencils, glows) use it to draw natively at d.
 */
export function eachArtPx(b: PixelBuffer, x: number, y: number, w: number, h: number, fn: (x: number, y: number, c: Color) => Color): void {
  const d = FD;
  const X0 = Math.max(0, Math.floor(x * d));
  const X1 = Math.min(b.w, Math.ceil((x + w) * d));
  const Y0 = Math.max(0, Math.floor(y * d));
  const Y1 = Math.min(b.h, Math.ceil((y + h) * d));
  for (let Y = Y0; Y < Y1; Y++) {
    const py = (Y + 0.5) / d;
    for (let X = X0; X < X1; X++) {
      const i = Y * b.w + X;
      const c = fn((X + 0.5) / d, py, b.data[i] >>> 0);
      if (c !== 0) b.data[i] = c >>> 0;
    }
  }
}

/** `c` moved `k` tones along its HD ramp (clamped); a colour outside the HD palette is kept. */
export function hdStep(c: Color, k: number): Color {
  const h = hdHome(c);
  if (!h) return c;
  const i = Math.max(0, Math.min(h.ramp.length - 1, h.i + k));
  return h.ramp[i];
}
