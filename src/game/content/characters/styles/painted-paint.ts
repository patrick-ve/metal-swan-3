/**
 * Art-direction trial `painted` (painted.ts): the painter. It reads the G-buffer of an HdCanvas
 * (material, part, depth, normal, tone offset, fixed colour per art px; src/game/art/hd/canvas.ts)
 * and paints it instead of the canvas's own banded render:
 * - ONE warm key light from the upper left with a wide, soft wrap (broad gradients, no hard
 *   terminator); shadows sink into cool blue-violet tones, the side turned from the light gets a
 *   little reflected light (so the darkest value is the core shadow at the turn), and warm light
 *   bounces up from the ground onto the lower, downward-facing edges;
 * - every material has its own PAINTED RAMP of PAL_HD colours, dark → light, whose darks are cool
 *   and whose lights are warm (the hue shift is in the ramp), plus warm bounce tones;
 * - the tone between two ramp colours is chosen per BRUSH STROKE, not per px: the art grid is cut
 *   into short strokes along the material's brush direction (or in arcs, for hair), each stroke
 *   takes one threshold and a small value jitter, so gradients break into visible dabs (stroke
 *   dither) and flat areas show the brush; the brush frame sits on the part, so strokes move with
 *   the limb instead of swimming over it;
 * - no outline: the form is grown by about one logical px (the rig's outline room) with normals
 *   turning away, the outer half of that ring broken where strokes stop short (a dry-brush edge),
 *   and only the shadow side (right / below) gets a soft dark edge; a part behind a nearer one
 *   gets a soft contact shadow (ambient occlusion) and a short cast shadow, never a line.
 * Fixed-colour px (placed images: the hands, the gun, props) keep their colours and a clean edge,
 * with the same edge and contact darkening as a step down their own ramp.
 */
import type { Color } from '../../../../engine/color';
import { PixelBuffer } from '../../../../engine/pixel';
import { PAL_HD, HD_RAMP_NAMES } from '../../../../engine/palette-hd';
import type { HdCanvas, HdMaterial } from '../../../art/hd/canvas';
import { hash2 } from '../../../art/paint';

/** A painted material: the canvas material plus the painter's ramp and brush. */
export interface PaintMat extends HdMaterial {
  /** The painted ramp: PAL_HD colours, dark (cool) → light (warm). */
  pr: readonly Color[];
  /** Warm ground-bounce tones, same length as `pr` (default: `pr`). */
  warm?: readonly Color[];
  /** Part of `pr` the light spans: [darkest, lightest] as fractions 0..1 (default [0, 1]). */
  span?: readonly [number, number];
  /** Brush direction in degrees on screen (0 = along +x, 90 = down); default the painter's hand. */
  dir?: number;
  /** Brush origin in art px (the part's own frame, so its strokes move with it). */
  bo?: readonly [number, number];
  /** Brush seed (a stable id of the part, so strokes stay put from frame to frame). */
  bs?: number;
  /** A curved brush: strokes run in arcs round this centre (art px), e.g. hair combed back. */
  polar?: readonly [number, number];
  /** Stroke length and width in logical px (default 1.8 × 0.5). */
  len?: number;
  wid?: number;
  /** Value jitter per stroke (default 0.05). */
  jit?: number;
  /** Wrap of the key light (default 0.45: soft cloth; skin 0.6). */
  soft?: number;
  /** Bounce strength (default 1). */
  bounce?: number;
  /** Specular lift on the lit side (0 = matte; leather, metal, lips). */
  gloss?: number;
  /** A flat (unlit) material: the tone alone picks the colour (eyes, mouth interior). */
  flatTone?: boolean;
  /** Its own key light direction (a painter's cheat: faces lit more from the front). */
  key?: readonly [number, number, number];
  /** Reflected light strength on the shadow side (default 1). */
  refl?: number;
  /** Form bend: the normal's sideways part is scaled by this before lighting (rounder forms; default 1.3). */
  bend?: number;
}

/** Painter options. */
export interface PaintOpts {
  /** Grow the silhouette by this many logical px (the outline's room). Default 1. */
  grow?: number;
  /** Keep every px inside this art-px rectangle [x, y, w, h] (the frame); default the canvas. */
  clip?: readonly [number, number, number, number];
  /** Strength of the shadow-side edge (default 1). */
  edge?: number;
  /** Contact shadow strength (default 1). */
  ao?: number;
  /** Cast shadow strength (default 1). */
  cast?: number;
  /** Seed of the brush (default 0). */
  seed?: number;
  /** Dry-brush edge: how much of the grown ring's outer half the strokes leave out (default 0.18). */
  ragged?: number;
  /** A coloured rim on the grown edge of these parts (the Helium Head's pink rim). */
  rim?: { parts: readonly number[]; colors: readonly Color[] };
}

/** The key light: upper left, in front (screen x right, y down, z to the viewer). */
const K = norm3(-0.6, -0.62, 0.52);
/** The painter's default stroke direction: a slant from lower left to upper right. */
const HAND_DIR = -62;

function norm3(x: number, y: number, z: number): readonly [number, number, number] {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

// ------------------------------------------------------------------------------------ colour homes

/** Every PAL_HD colour → its ramp and index (the first ramp listing it). */
const HOME = new Map<number, { ramp: readonly Color[]; i: number }>();
for (const n of HD_RAMP_NAMES) {
  const r = PAL_HD[n];
  r.forEach((c, i) => {
    const k = c >>> 0;
    if (!HOME.has(k)) HOME.set(k, { ramp: r, i });
  });
}

/** A fixed colour `k` steps darker along its own ramp (k may be fractional: dithered by `t`). */
export function darker(c: Color, k: number, t = 0.5): Color {
  const h = HOME.get(c >>> 0);
  if (!h) return c;
  const s = Math.floor(k + t);
  return h.ramp[Math.max(0, h.i - s)];
}

// ------------------------------------------------------------------------------------ the brush

const ringCache = new Map<number, Float32Array>();

/** Offsets (dx, dy, distance) within radius g + 0.35, sorted by distance. */
function ringOffsets(g: number): Float32Array {
  let r = ringCache.get(g);
  if (r) return r;
  const list: Array<[number, number, number]> = [];
  for (let dy = -g; dy <= g; dy++) for (let dx = -g; dx <= g; dx++) {
    const dd = Math.hypot(dx, dy);
    if (dd > 0 && dd <= g + 0.35) list.push([dx, dy, dd]);
  }
  list.sort((a, b) => a[2] - b[2]);
  r = new Float32Array(list.flat());
  ringCache.set(g, r);
  return r;
}

/** The stroke under an art px: its threshold (0..1) and value jitter, in the material's brush frame. */
interface Stroke {
  th: number;
  jit: number;
  /** A small per-px noise in the brush frame (ragged stroke edges). */
  px: number;
}
const strokeOut: Stroke = { th: 0, jit: 0, px: 0 };

function strokeAt(pm: PaintMat, m: number, X: number, Y: number, d: number, seed: number): Stroke {
  let along: number;
  let across: number;
  if (pm.polar) {
    // Arcs round the centre; the seam of the angle lies straight below it.
    const dx = X + 0.5 - pm.polar[0];
    const dy = Y + 0.5 - pm.polar[1];
    across = Math.hypot(dx, dy);
    along = across * Math.atan2(dx, -dy);
  } else {
    const dir = ((pm.dir ?? HAND_DIR) * Math.PI) / 180;
    const cs = Math.cos(dir);
    const sn = Math.sin(dir);
    const lx = X + 0.5 - (pm.bo?.[0] ?? 0);
    const ly = Y + 0.5 - (pm.bo?.[1] ?? 0);
    along = lx * cs + ly * sn;
    across = -lx * sn + ly * cs;
  }
  const bs = seed + (pm.bs ?? m) * 7919;
  const sw = Math.max(1, (pm.wid ?? 0.5) * d);
  const sl = Math.max(2, (pm.len ?? 1.8) * d);
  const row = Math.floor(across / sw);
  const rl = sl * (0.75 + 0.5 * hash2(row, 7, bs));
  const col = Math.floor((along + hash2(row, 3, bs) * rl) / rl);
  strokeOut.th = hash2(row, col, bs + 5);
  strokeOut.jit = (hash2(row, col, bs + 11) - 0.5) * (pm.jit ?? 0.05) * 2;
  strokeOut.px = hash2(Math.floor(along), Math.floor(across), bs + 29);
  return strokeOut;
}

// ------------------------------------------------------------------------------------ the painter

/** Paint the canvas into a new (W × H) buffer (see the module comment). */
export function paintRender(c: HdCanvas, o: PaintOpts = {}): PixelBuffer {
  const { W, H, d } = c;
  const n = W * H;
  const { mat, part, zb, pz, nx, ny, nz, tone, fix } = c;
  const seed = o.seed ?? 0;

  // 0. Clip to the frame.
  if (o.clip) {
    const [cx, cy, cw, ch] = o.clip;
    for (let Y = 0; Y < H; Y++) {
      for (let X = 0; X < W; X++) {
        if (X >= cx && X < cx + cw && Y >= cy && Y < cy + ch) continue;
        const i = Y * W + X;
        mat[i] = 0;
        fix[i] = 0;
      }
    }
  }

  // 1. Grow: empty px within `g` art px of the form take the nearest px's surface, its normal
  //    turned away from the viewer towards the outside (the form rolling away at the edge).
  const grown = new Uint8Array(n);
  const g = Math.round((o.grow ?? 1) * d);
  if (g > 0) {
    const src = new Int32Array(n).fill(-1);
    const dist = new Float32Array(n).fill(1e9);
    // Only empty px within the box dilation of the form are searched (most of the canvas is far).
    const rowNear = new Uint8Array(n);
    for (let Y = 0; Y < H; Y++) {
      // Two sweeps: the distance to the nearest filled px on the row, left and right.
      let last = -1e9;
      for (let X = 0; X < W; X++) {
        if (mat[Y * W + X] !== 0) last = X;
        if (X - last <= g) rowNear[Y * W + X] = 1;
      }
      last = 1e9;
      for (let X = W - 1; X >= 0; X--) {
        if (mat[Y * W + X] !== 0) last = X;
        if (last - X <= g) rowNear[Y * W + X] = 1;
      }
    }
    const offs = ringOffsets(g);
    for (let Y = 0; Y < H; Y++) {
      for (let X = 0; X < W; X++) {
        const i = Y * W + X;
        if (mat[i] !== 0) continue;
        let near = false;
        for (let dy = -g; dy <= g && !near; dy++) {
          const yy = Y + dy;
          if (yy >= 0 && yy < H && rowNear[yy * W + X]) near = true;
        }
        if (!near) continue;
        // Offsets sorted by distance: the first hit is the nearest; ties go to the nearer part.
        let best = -1;
        let bd = 1e9;
        for (let k = 0; k < offs.length; k += 3) {
          const dd = offs[k + 2];
          if (dd > bd + 0.01) break;
          const xx = X + offs[k];
          const yy = Y + offs[k + 1];
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const j = yy * W + xx;
          if (mat[j] === 0) continue;
          if (best < 0 || zb[j] > zb[best]) {
            best = j;
            bd = dd;
          }
        }
        if (best >= 0) {
          src[i] = best;
          dist[i] = bd;
        }
      }
    }
    if (o.clip) {
      const [cx, cy, cw, ch] = o.clip;
      for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) if (!(X >= cx && X < cx + cw && Y >= cy && Y < cy + ch)) src[Y * W + X] = -1;
    }
    const rag = o.ragged ?? 0.18;
    for (let i = 0; i < n; i++) {
      const j = src[i];
      if (j < 0) continue;
      const X = i % W;
      const Y = (i - X) / W;
      // A dry-brush edge: in the outer half of the ring, some strokes stop short.
      const tr = dist[i] / Math.max(1, g);
      if (rag > 0 && tr > 0.5) {
        // Hard things (placed images: gun, hands, props) keep a clean edge.
        const pm = c.getMaterial(mat[j]) as PaintMat;
        if (fix[j] === 0 && pm.pr && strokeAt(pm, mat[j], X, Y, d, seed).th < rag * (tr - 0.5) * 2) continue;
      }
      const jx = j % W;
      const jy = (j - jx) / W;
      let ex = X - jx;
      let ey = Y - jy;
      const el = Math.hypot(ex, ey) || 1;
      ex /= el;
      ey /= el;
      // The edge of a soft form: mostly sideways, a little of the source's own turn.
      const t = Math.min(1, dist[i] / Math.max(1, g));
      let ax = nx[j] * (1 - t) + ex * (0.6 + 0.4 * t);
      let ay = ny[j] * (1 - t) + ey * (0.6 + 0.4 * t);
      let az = nz[j] * (1 - t) * 0.6 + 0.25;
      const l = Math.hypot(ax, ay, az) || 1;
      ax /= l;
      ay /= l;
      az /= l;
      grown[i] = 1;
      mat[i] = mat[j];
      part[i] = part[j];
      zb[i] = zb[j] - 0.01;
      pz[i] = pz[j];
      nx[i] = ax;
      ny[i] = ay;
      nz[i] = az;
      tone[i] = tone[j];
      fix[i] = fix[j];
    }
  }

  // 2. Contact shadow (AO): a px next to a nearer part, in 8 directions out to ~1 logical px;
  //    `touch` = a nearer part right beside it (≤ ½ logical px): the soft line between forms.
  const aoK = o.ao ?? 1;
  const ao = new Float32Array(n);
  const touch = new Float32Array(n);
  const DX8 = [-1, 1, 0, 0, -1, 1, -1, 1];
  const DY8 = [0, 0, -1, 1, -1, -1, 1, 1];
  if (aoK > 0) {
    const R = Math.max(2, Math.round(1.1 * d));
    const near = Math.max(1, Math.round(0.5 * d));
    let norm = 0;
    for (let k = 1; k <= R; k++) norm += 8 / k;
    for (let Y = 0; Y < H; Y++) {
      for (let X = 0; X < W; X++) {
        const i = Y * W + X;
        if (mat[i] === 0) continue;
        const p = part[i];
        const z0 = pz[i];
        let acc = 0;
        let tc = 0;
        for (let dir = 0; dir < 8; dir++) {
          for (let k = 1; k <= R; k++) {
            const xx = X + DX8[dir] * k;
            const yy = Y + DY8[dir] * k;
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) break;
            const j = yy * W + xx;
            if (mat[j] === 0) break;
            if (part[j] !== p && pz[j] > z0 + 0.5) {
              acc += 1 / k;
              if (k <= near) tc = Math.max(tc, 1 - (k - 1) / near);
              break;
            }
          }
        }
        ao[i] = (acc / norm) * aoK;
        touch[i] = tc * aoK;
      }
    }
  }

  // 3. Cast shadow: a nearer part up and to the left (towards the key light) within ~1.6 logical px.
  const castK = o.cast ?? 1;
  const cast = new Float32Array(n);
  if (castK > 0) {
    const S = Math.round(1.6 * d);
    for (let Y = 0; Y < H; Y++) {
      for (let X = 0; X < W; X++) {
        const i = Y * W + X;
        if (mat[i] === 0) continue;
        const z0 = pz[i];
        let best = 0;
        for (let k = 1; k <= S; k++) {
          const xx = X - Math.round(k * 0.62);
          const yy = Y - Math.round(k * 0.8);
          if (xx < 0 || yy < 0) break;
          const j = yy * W + xx;
          if (mat[j] !== 0 && part[j] !== part[i] && pz[j] > z0 + 1.5) {
            best = 1 - ((k - 1) / S) * 0.6;
            break;
          }
        }
        cast[i] = best * castK;
      }
    }
  }

  // 4. Shadow-side edge: empty px to the right / below within ~1 logical px.
  const edgeK = o.edge ?? 1;
  const edge = new Float32Array(n);
  if (edgeK > 0) {
    const r = Math.max(1, Math.round(0.9 * d));
    const dirs: ReadonlyArray<readonly [number, number, number]> = [
      [1, 0, 0.8],
      [0, 1, 1],
      [0.7, 0.7, 1],
      [-0.4, 0.92, 0.55],
      [0.92, -0.4, 0.45],
    ];
    for (let Y = 0; Y < H; Y++) {
      for (let X = 0; X < W; X++) {
        const i = Y * W + X;
        if (mat[i] === 0) continue;
        let e = 0;
        for (const [ux, uy, wgt] of dirs) {
          for (let k = 1; k <= r; k++) {
            const xx = X + Math.round(ux * k);
            const yy = Y + Math.round(uy * k);
            const empty = xx < 0 || yy < 0 || xx >= W || yy >= H || mat[yy * W + xx] === 0;
            if (empty) {
              e = Math.max(e, wgt * (1 - (k - 1) / r));
              break;
            }
          }
        }
        edge[i] = e * edgeK;
      }
    }
  }

  // 5. Light, brush and ramp.
  const out = new PixelBuffer(W, H);
  const px = out.data;
  const rimParts = o.rim ? new Set(o.rim.parts) : null;
  const mats: PaintMat[] = [];
  const getMat = (id: number): PaintMat => {
    let m = mats[id];
    if (!m) mats[id] = m = c.getMaterial(id) as PaintMat;
    return m;
  };
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      const i = Y * W + X;
      const m = mat[i];
      if (m === 0) continue;
      if (rimParts && grown[i] && rimParts.has(part[i])) {
        const rc = o.rim!.colors;
        px[i] = rc[Math.floor(hash2(X >> 1, Y >> 1, seed + 515) * rc.length)];
        continue;
      }
      const f = fix[i];
      if (f !== 0) {
        // A fixed px (placed image): only the edge and the contact shadows, a step down its ramp.
        const t = hash2(X, Y, seed + 913);
        const k = edge[i] * 1.3 + touch[i] * 0.9 + cast[i] * 0.6 + (grown[i] ? 0.6 : 0);
        px[i] = k > 0.15 ? darker(f, k, t) : f;
        continue;
      }
      const pm = getMat(m);
      const pr = pm.pr;
      if (!pr) {
        px[i] = PAL_HD.ink[1];
        continue;
      }
      // The brush: strokes of len × wid along the direction; one threshold and jitter per stroke.
      const st = strokeAt(pm, m, X, Y, d, seed);
      const th = st.th;
      const jit = st.jit;
      // A ragged stroke edge: a little per-px noise on the threshold.
      const tpx = th * 0.82 + st.px * 0.18;

      let v: number;
      let bw = 0;
      if (pm.flatTone) {
        v = 0.5 + tone[i] + jit * 0.5;
      } else {
        const bend = pm.bend ?? 1.3;
        let a = nx[i] * bend;
        let b = ny[i] * bend;
        let z = nz[i];
        const nl = Math.hypot(a, b, z) || 1;
        a /= nl;
        b /= nl;
        z /= nl;
        const L = pm.key ?? K;
        const k = a * L[0] + b * L[1] + z * L[2];
        const s = pm.soft ?? 0.45;
        let kk = (k + s) / (1 + s);
        kk = kk < 0 ? 0 : kk > 1 ? 1 : kk;
        // A painter's value curve: the plane facing the viewer at the local colour (mid ramp),
        // only the planes turned to the light climb to the top, the turn away sinks slowly.
        v = 0.05 + 0.95 * Math.pow(kk, 1.45);
        if (pm.gloss) {
          // A soft sheen where the form faces the light.
          const hx = K[0];
          const hy = K[1];
          const hz = K[2] + 1;
          const hl = Math.hypot(hx, hy, hz);
          const h = (a * hx + b * hy + z * hz) / hl;
          if (h > 0) v += pm.gloss * Math.pow(h, 14) * 0.5;
        }
        // Reflected light on the side turned from the key: the darkest value sits at the turn
        // (the core shadow), not at the edge.
        if (k < 0) v += Math.min(0.14, -k * 0.22) * (pm.refl ?? 1);
        // Warm ground bounce on downward faces in shade.
        const down = b > 0 ? b : 0;
        bw = down * (1 - kk) * (pm.bounce ?? 1);
        v += bw * 0.14;
        v += tone[i];
        v += jit;
      }
      v -= ao[i] * 0.32 + touch[i] * 0.16;
      v -= cast[i] * 0.2;
      v -= edge[i] * 0.38;
      if (grown[i] && !pm.flatTone) v -= 0.04;
      const [s0, s1] = pm.span ?? [0, 1];
      const nr = pr.length - 1;
      const vv = v < 0 ? 0 : v > 1 ? 1 : v;
      const pos = (s0 + (s1 - s0) * vv) * nr;
      let idx = Math.floor(pos + tpx * 0.92 + 0.04);
      idx = idx < 0 ? 0 : idx > nr ? nr : idx;
      // The warm bounce replaces a cool shadow tone where it wins this stroke.
      const warm = pm.warm && bw * 1.8 - cast[i] - edge[i] * 0.5 > th ? pm.warm : pr;
      px[i] = warm[idx];
    }
  }
  out.touch();
  return out;
}
