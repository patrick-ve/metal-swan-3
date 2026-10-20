/**
 * ROBO-HALSEMA — her UHD art (docs/ART_GUIDE.md "UHD art"; likeness rules: docs/ORIGINALITY.md,
 * "Exception: mission ams"). ONE density-generic drawer per strip makes its 2× and its 4× frames
 * natively with the HD kit (lit primitives, PAL_HD ramps, one key light from the upper left, a
 * cool bounce, ambient occlusion, rim light, outline A): never the 1× art scaled.
 *
 * Every frame is drawn in the boss's LOCAL logical coordinates (layout.ts, the anchor (0, 0) is
 * the floor point between her feet; logical pixel (x, y) covers [x, x + 1) × [y, y + 1)) on an
 * `HdPiece` sized from the 1× frame of the same strip and index, so each HD frame has exactly its
 * 1× frame's logical size, anchor and points.
 *
 * Look (identity kept from the 1× / old 2× art): a cream boucle jacket (nubby wool at 4×) with a
 * plush rolled shawl collar over a satin crimson blouse; the silver chain of office in lit rosette
 * links with enamel beads and heater shields; the round silver medallion with a gold bezel and
 * the city arms in enamel, or the glowing core; big wavy dark-chocolate hair (lit lock domes and
 * S-wave ridges with chestnut sheen) with the side sweep; the enamel face plate (a painted height
 * field: brow ridge, sockets, a long straight nose, cheekbones, a strong chin) with arched brows,
 * brown almond eyes under heavy lashes, glossy red lips in a closed smile and the round gold
 * earring; steel neck, ball joints and mitten hands; navy trousers and black patent court shoes;
 * the giant rubber stamp with its oiled wooden block and the GESLOTEN label. She stays a machine.
 * Damage states add dents, cracks and soot to the wig, the jacket, the stamp and the steel, never
 * to the face (only fine panel seams there).
 */
import type { Color } from '../../../../engine/color';
import { drawText, measure } from '../../../../engine/font';
import { PAL, type Ramp } from '../../../../engine/palette';
import { PAL_HD } from '../../../../engine/palette-hd';
import { PixelBuffer } from '../../../../engine/pixel';
import type { Frame } from '../../../../engine/render';
import { getFrames } from '../../../../engine/sprites';
import { inPoly, polyDist, type RenderOpts, type TexSample, type Texture } from '../../../art/hd/canvas';
import { hash2 } from '../../../art/paint';
import { HdPiece, framePx, framePy, geomOf, type FrameGeom, type Pt } from './canvas';
import { MAYOR } from './geometry';
import {
  ARM_FRAMES,
  ARM_POSES,
  BROW_FAR,
  BROW_NEAR,
  CHAIN_CUT,
  CHAIN_RUNS,
  CHAIN_SHIELDS,
  FACE_POLY,
  FAR_SHOULDER,
  HAIR_FLARES,
  HAIR_LOCKS,
  JACKET_POLY,
  LAPEL_FAR,
  LAPEL_NEAR,
  SHADOW_W,
  SPRING_H,
  STAMP_SHOULDER,
  STRANDS,
  SWEEP,
  TEMPLE,
  TIPS,
  WIG_ANCHOR,
  farArmPose,
  legJoints,
  strandPts,
  type LegJoints,
  type Strand,
} from './layout';

const ART = 'boss/ams-mayor';
const R = PAL_HD;

/** Sprites: outline A (style decision), AO where parts meet, the thin cool rim. */
const RENDER: RenderOpts = { outline: 'A', ao: 0.3, rimLight: 2 };

/** Dark chocolate hair: near-black grooves, chestnut sheen on the crests. */
const HAIR: Ramp = [R.ink[0], R.brown[0], R.brown[1], R.brown[2], R.brown[3], R.brown[4], R.brown[5]];
/** Navy trousers with blue-grey lights. */
const PANTS: Ramp = [R.navy[0], R.navy[1], R.navy[2], R.navy[3], R.slate[3], R.slate[4]];
/** The open core (1) and the firing glow (2): rim → white-hot centre. */
const CORE: Ramp = [R.teal[1], R.teal[2], R.teal[3], R.teal[4], R.teal[5], R.teal[6], R.snow[6]];
const GLOW: Ramp = [R.pink[2], R.pink[3], R.pink[5], R.gold[5], R.gold[6], R.gold[7], R.snow[6]];

// ---------------------------------------------------------------------------------------------
// Materials and small helpers
// ---------------------------------------------------------------------------------------------

interface Mats {
  jacket: number;
  jacketFar: number;
  lapel: number;
  blouse: number;
  pants: number;
  pantsFar: number;
  steel: number;
  steelDark: number;
  silver: number;
  gold: number;
  shoe: number;
  sole: number;
  wood: number;
  knob: number;
  rubber: number;
  label: number;
  skin: number;
  hair: number;
  lining: number;
  paper: number;
  ink: number;
  /** Enamel: red, blue, green, white (the chain shields), black (the pale). */
  enamel: readonly [number, number, number, number];
  black: number;
  /** Flat dark (the eyes of the chain rosettes, the core socket). */
  hole: number;
  core: number;
  glow: number;
  /** Cable insulation (the stump): red, gold, blue. */
  cable: readonly [number, number, number];
}

function mats(p: HdPiece): Mats {
  const m = (o: Parameters<HdPiece['material']>[0]): number => p.material(o);
  return {
    jacket: m({ ramp: R.cloth, lo: 2, hi: 5, wrap: 0.12, rim: 0.05, amb: 0.24, bounce: 0.3 }),
    jacketFar: m({ ramp: R.cloth, lo: 1, hi: 4, wrap: 0.12, rim: 0.05, amb: 0.1, bounce: 0.3 }),
    lapel: m({ ramp: R.cloth, lo: 2, hi: 5, wrap: 0.04, spec: 0.18, shine: 10, amb: 0.16 }),
    blouse: m({ ramp: R.red, lo: 1, hi: 5, spec: 0.4, shine: 16, wrap: 0.06 }),
    pants: m({ ramp: PANTS, lo: 1, hi: 4, wrap: 0.14, spec: 0.08, shine: 8, rim: 0.1 }),
    pantsFar: m({ ramp: PANTS, lo: 1, hi: 3, wrap: 0.14, rim: 0.05 }),
    steel: m({ ramp: R.steel, lo: 2, hi: 5, spec: 0.9, shine: 24 }),
    steelDark: m({ ramp: R.steel, lo: 1, hi: 3, spec: 0.5, shine: 18 }),
    silver: m({ ramp: R.steel, lo: 3, hi: 6, spec: 1, shine: 30, amb: 0.04, bounce: 0.12, gain: 1.15 }),
    gold: m({ ramp: R.gold, lo: 2, hi: 6, spec: 1, shine: 26, amb: 0.1 }),
    shoe: m({ ramp: R.black, lo: 1, hi: 3, spec: 0.9, shine: 30, rim: 0.4 }),
    sole: m({ ramp: R.black, lo: 0, hi: 2, rimPx: false }),
    wood: m({ ramp: R.brown, lo: 2, hi: 6, spec: 0.25, shine: 12, wrap: 0.05 }),
    knob: m({ ramp: R.brown, lo: 2, hi: 6, spec: 0.85, shine: 22 }),
    rubber: m({ ramp: R.red, lo: 1, hi: 4, spec: 0.2, shine: 10 }),
    label: m({ ramp: R.cloth, lo: 3, hi: 5, amb: 0.35, wrap: 0.3, rimPx: false }),
    skin: m({ ramp: R.skinA, lo: 2, hi: 6, spec: p.d >= 4 ? 0.55 : 0.35, shine: 24, rim: 0.04, amb: 0.08, wrap: 0.1, bounce: 0.38 }),
    hair: m({ ramp: HAIR, lo: 1, hi: 3, spec: 0.75, shine: 14, wrap: 0.04, amb: 0.06, rim: 0.12 }),
    lining: m({ ramp: HAIR, lo: 0, hi: 2, wrap: 0.2, amb: 0.1 }),
    paper: m({ ramp: R.snow, lo: 3, hi: 5, wrap: 0.25, amb: 0.25, spec: 0.1 }),
    ink: m({ ramp: R.ink, flat: true, lo: 0, hi: 0 }),
    enamel: [
      m({ ramp: R.red, lo: 3, hi: 6, spec: 1, shine: 34 }),
      m({ ramp: R.sky, lo: 1, hi: 5, spec: 1, shine: 34 }),
      m({ ramp: R.green, lo: 2, hi: 6, spec: 1, shine: 34 }),
      m({ ramp: R.snow, lo: 3, hi: 5, spec: 1, shine: 34 }),
    ],
    black: m({ ramp: R.black, lo: 0, hi: 3, spec: 1, shine: 34 }),
    hole: m({ ramp: R.steel, flat: true, lo: 1, hi: 1 }),
    core: m({ ramp: CORE, flat: true, lo: 0, hi: CORE.length - 1 }),
    glow: m({ ramp: GLOW, flat: true, lo: 0, hi: GLOW.length - 1 }),
    cable: [m({ ramp: R.red, lo: 3, hi: 6, spec: 0.7, shine: 20 }), m({ ramp: R.gold, lo: 3, hi: 6, spec: 0.7, shine: 20 }), m({ ramp: R.sky, lo: 1, hi: 5, spec: 0.7, shine: 20 })],
  };
}

/** The continuous centre of logical pixel (x, y). */
function c2(p: Pt): [number, number] {
  return [p[0] + 0.5, p[1] + 0.5];
}

/**
 * A polygon through 1× pixels (inclusive) as a continuous outline: each vertex moves to its
 * pixel's outer corner (away from the centroid), so the shape covers the same pixels.
 */
function cov(pts: ReadonlyArray<Pt>, dx = 0, dy = 0): Pt[] {
  let mx = 0;
  let my = 0;
  for (const [x, y] of pts) {
    mx += x / pts.length;
    my += y / pts.length;
  }
  return pts.map(([x, y]) => [x + 0.5 + (x >= mx ? 0.5 : -0.5) + dx, y + 0.5 + (y >= my ? 0.5 : -0.5) + dy] as const);
}

function gauss(x: number, y: number, cx: number, cy: number, sx: number, sy: number): number {
  const u = (x - cx) / sx;
  const v = (y - cy) / sy;
  return Math.exp(-(u * u + v * v) / 2);
}

/** Distance from (x, y) to the segment a–b and the position along it (0..1). */
function segDist(x: number, y: number, ax: number, ay: number, bx: number, by: number): [number, number] {
  const vx = bx - ax;
  const vy = by - ay;
  const l2 = vx * vx + vy * vy;
  let t = l2 === 0 ? 0 : ((x - ax) * vx + (y - ay) * vy) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return [Math.hypot(x - ax - vx * t, y - ay - vy * t), t];
}

/** Cumulative arc lengths of a polyline. */
function arcLen(pts: ReadonlyArray<Pt>): number[] {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return cum;
}

/** The point at arc length s of a polyline. */
function pointAt(pts: ReadonlyArray<Pt>, cum: readonly number[], s: number): [number, number] {
  let i = 1;
  while (i < pts.length - 1 && cum[i] < s) i++;
  const a = pts[i - 1];
  const b = pts[i];
  const seg = cum[i] - cum[i - 1] || 1;
  const t = Math.min(1, Math.max(0, (s - cum[i - 1]) / seg));
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** Sample f(t), t 0..1, as a polyline of n + 1 points. */
function curve(f: (t: number) => readonly [number, number], n = 32): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) out.push(f(i / n));
  return out;
}

/** The 1× frames of `id` (the geometry every HD frame copies). */
function lowFrames(id: string): readonly Frame[] {
  return getFrames(id, 1);
}

/** The ramp step `n` darker (− lighter) of a PAL_HD colour on one of `ramps` (or the colour). */
function step(c: Color, n: number, ramps: readonly Ramp[]): Color {
  for (const r of ramps) {
    const i = r.indexOf(c);
    if (i >= 0) return r[Math.max(0, Math.min(r.length - 1, i - n))];
  }
  return c;
}

// ---------------------------------------------------------------------------------------------
// Textures (local coordinates: they stay on the object from frame to frame)
// ---------------------------------------------------------------------------------------------

/**
 * Boucle: nubby loops of wool on a staggered grid (a lit top-left and a shaded bottom-right per
 * nub, by the normal). Small and sparse at 2× (the big shapes must read), dense at 4×.
 */
function boucle(p: HdPiece, seed: number, amt = 1): Texture {
  const cell = p.d >= 4 ? 2.0 : 3.0;
  const rr = p.d >= 4 ? 0.66 : 0.8;
  const k = (p.d >= 4 ? 0.55 : 0.45) * amt;
  return p.tex((s) => {
    const row = Math.floor(s.y / cell);
    const off = (row & 1) * cell * 0.5;
    const col = Math.floor((s.x - off) / cell);
    if (hash2(col, row, seed) < 0.28) return;
    const cx = (col + 0.5) * cell + off + (hash2(col, row, seed + 1) - 0.5) * cell * 0.35;
    const cy = (row + 0.5) * cell + (hash2(col, row, seed + 2) - 0.5) * cell * 0.35;
    const dx = (s.x - cx) / rr;
    const dy = (s.y - cy) / rr;
    if (dx * dx + dy * dy >= 1) return;
    s.nx += dx * k;
    s.ny += dy * k;
  });
}

/** A damage mark: dent, crack or soot (the 1× scuff positions). */
interface Mark {
  x: number;
  y: number;
  k: number;
  dx: number;
}

function marks(box: readonly [number, number, number, number], state: number, seed: number): Mark[] {
  if (state <= 0) return [];
  const [x0, y0, w, h] = box;
  const n = Math.round((w * h) / (state === 1 ? 220 : 90));
  const out: Mark[] = [];
  for (let i = 0; i < n; i++) {
    out.push({
      x: x0 + Math.floor(hash2(i, 1, seed) * w) + 0.5,
      y: y0 + Math.floor(hash2(i, 2, seed) * h) + 0.5,
      k: state === 1 ? Math.min(hash2(i, 3, seed), 0.79) : hash2(i, 3, seed),
      dx: hash2(i, 4, seed) < 0.5 ? 1 : -1,
    });
  }
  return out;
}

/**
 * Wear by damage state: dents (a dimple the key light models), cracks (a dark groove with a lit
 * lip under it) and soot (a darker cluster). Deterministic (hash of the mark index).
 */
function wear(p: HdPiece, box: readonly [number, number, number, number], state: number, seed: number): Texture | null {
  const ms = marks(box, state, seed);
  if (ms.length === 0) return null;
  const len = 3 + state;
  const half = 0.55 / p.d + 0.12;
  return p.tex((s) => {
    for (const m of ms) {
      const ex = s.x - m.x;
      const ey = s.y - m.y;
      if (ex < -len - 3 || ex > len + 3 || ey < -4 || ey > 4) continue;
      if (m.k < 0.45) {
        const q = Math.hypot(ex, ey) / 1.15;
        if (q < 1) {
          s.nx -= (ex / 1.15) * 0.9;
          s.ny -= (ey / 1.15) * 0.9;
          s.tone -= 0.08;
        }
      } else if (m.k < 0.8) {
        const [dd, t] = segDist(s.x, s.y, m.x, m.y, m.x + m.dx * len, m.y + len * 0.45);
        if (dd < half && t > 0 && t < 1) s.tone -= 1.2;
        else if (dd < half + 1 / p.d && t > 0.05 && t < 0.95 && ey > (ex * 0.45) / m.dx) s.tone += 0.25;
      } else {
        // Soot: an irregular smudge (a lobed outline), darker in the middle.
        const q = Math.hypot(ex, ey * 1.3);
        const rr = 2.5 + 0.7 * Math.sin(Math.atan2(ey, ex) * 3 + m.dx * 2 + m.k * 9);
        if (q < rr) s.tone -= q < rr * 0.5 ? 0.5 : 0.28;
      }
    }
  });
}

/** Chain of textures (nulls skipped). */
function texs(...t: ReadonlyArray<Texture | null | undefined>): Texture | null {
  const list = t.filter((x): x is Texture => !!x);
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  return (s: TexSample) => {
    for (const f of list) f(s);
  };
}

/** Oiled wood grain along x (local), knots at 4×. */
function grain(p: HdPiece, seed: number): Texture {
  return p.tex((s) => {
    const w = Math.sin(s.y * 2.3 + Math.sin(s.x * 0.21 + seed) * 1.6 + seed);
    s.tone += w * 0.07;
    if (p.d >= 4) {
      const k = hash2(Math.floor(s.x * 0.5), Math.floor(s.y * 1.5), seed);
      if (k > 0.94) s.tone -= 0.12;
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Shared parts: joints, mittens, sleeves, chain, shields
// ---------------------------------------------------------------------------------------------

/** A steel ball joint centred on logical pixel (x, y), 1× radius r. */
function joint(p: HdPiece, M: Mats, x: number, y: number, r: number, z: number): void {
  p.ell(x + 0.5, y + 0.5, r + 0.5, r + 0.5, { mat: M.steel, z });
  // The pivot: a small recessed cap.
  if (p.d >= 4) p.ell(x + 0.7, y + 0.7, 0.75, 0.75, { mat: M.steelDark, z: z + r + 0.3 });
}

/** A steel mitten hand round logical pixel (x, y), 1× radius r: the palm, the thumb, finger seams at 4×. */
function mitten(p: HdPiece, M: Mats, x: number, y: number, r: number, z: number): void {
  const cx = x + 0.5;
  const cy = y + 0.5;
  const part = p.newPart();
  p.ell(cx, cy, r + 0.5, r + 0.35, { mat: M.steel, z, part });
  p.ell(cx + r * 0.5, cy - r * 0.38, r * 0.5, r * 0.42, { mat: M.steel, z: z + 1.4 });
  if (p.d >= 4) {
    // Three finger seams on the lower front.
    p.shade(cx - r, cy - r, 2 * r + 1, 2 * r + 1, (u, v) => {
      const a = Math.atan2(v - cy, u - cx);
      const q = Math.hypot(u - cx, v - cy);
      if (q < r * 0.45 || q > r + 0.2 || a < 0.2 || a > 2.4) return 0;
      const k = (a - 0.2) / 0.55;
      return Math.abs(k - Math.round(k)) < 0.09 ? -0.55 : 0;
    }, part);
  }
}

/** A sleeve segment (a cloth tube) between logical pixels a and b, 1× widths w0 → w1. */
function sleeve(p: HdPiece, a: Pt, b: Pt, w0: number, w1: number, mat: number, tex: Texture | null, z: number, part?: number): void {
  p.cap(a[0] + 0.5, a[1] + 0.5, b[0] + 0.5, b[1] + 0.5, w0 / 2, w1 / 2, { mat, z, tex, part });
}

/** A silver rosette ring with a dark eye, centred (x, y) (continuous), outer radius R. */
function rosette(p: HdPiece, M: Mats, x: number, y: number, rad: number, z: number, tex: Texture | null = null): void {
  const a = rad * 0.45;
  const rc = rad - a;
  p.field(x - rad, y - rad, 2 * rad, 2 * rad, (u, v) => {
    const q = Math.hypot(u - x, v - y);
    const t = (q - rc) / a;
    if (t > 1 || t < -1) return NaN;
    return a * Math.sqrt(1 - t * t);
  }, { mat: M.silver, z, tex });
  p.ell(x, y, rc - a * 0.3, rc - a * 0.3, { mat: M.hole, z: z - 0.2 });
}

/**
 * The chain of office along a polyline (continuous local points): a fine silver link bar, lit
 * rosette rings every `pitch` px and small enamel beads between them (red, blue, green). `phase`
 * (0–5) moves the links along the chain (the whirl).
 */
function chainLinks(p: HdPiece, M: Mats, path: ReadonlyArray<Pt>, z: number, phase = 0, tex: Texture | null = null, pitch = 4.6): void {
  const cum = arcLen(path);
  const L = cum[cum.length - 1];
  if (L < 0.5) return;
  p.stroke(path, 0.7, 0.7, { mat: M.silver, z, tone: -0.12 });
  const off = (((phase % 6) + 6) % 6) * (pitch / 6);
  let k = 0;
  for (let s = off + pitch * 0.5; s <= L + 0.01; s += pitch) {
    const [x, y] = pointAt(path, cum, Math.min(L, s));
    rosette(p, M, x, y, 2.2, z + 1, tex);
    const sb = s + pitch * 0.5;
    if (sb < L - 0.6) {
      const [bx, by] = pointAt(path, cum, sb);
      p.ell(bx, by, 0.95, 0.95, { mat: M.enamel[k % 3], z: z + 1.2 });
    }
    k++;
  }
}

/** A heater shield of the chain: a silver rim and an enamel field; 1× centre pixel (x, y). */
function chainShield(p: HdPiece, M: Mats, x: number, y: number, enamel: number, z: number, tex: Texture | null = null): void {
  const cx = x + 0.5;
  const cy = y + 0.5;
  p.blob([[cx - 2.6, cy - 2.6], [cx + 2.6, cy - 2.6], [cx + 2.6, cy + 0.9], [cx, cy + 3.6], [cx - 2.6, cy + 0.9]], 0.9, { mat: M.silver, z, tex });
  p.blob([[cx - 1.65, cy - 1.7], [cx + 1.65, cy - 1.7], [cx + 1.65, cy + 0.6], [cx, cy + 2.5], [cx - 1.65, cy + 0.6]], 0.7, { mat: enamel, z: z + 0.9 });
}

/** A 4-point sparkle painted on a finished buffer at local (x, y). */
function sparklePx(buf: PixelBuffer, g: FrameGeom, d: number, x: number, y: number, core: Color, arm: Color): void {
  const X = framePx(g, d, x);
  const Y = framePy(g, d, y);
  const n = d >= 4 ? 3 : 2;
  for (let k = -n; k <= n; k++) {
    const c = Math.abs(k) <= d / 4 ? core : arm;
    buf.set(X + k, Y, c);
    buf.set(X, Y + k, c);
  }
  if (d >= 4) {
    buf.set(X + 1, Y + 1, core);
    buf.set(X - 1, Y - 1, core);
  }
}

// ---------------------------------------------------------------------------------------------
// Legs
// ---------------------------------------------------------------------------------------------

/** One leg: a navy trouser leg (thigh and shin), a steel ball knee, a black patent court shoe. */
function leg(p: HdPiece, M: Mats, j: LegJoints, far: boolean, z: number): void {
  const [hip, knee, ankle] = j;
  const mat = far ? M.pantsFar : M.pants;
  const part = p.newPart();
  sleeve(p, hip, knee, 11, 10.2, mat, null, z, part);
  sleeve(p, knee, ankle, 9.4, 8.6, mat, null, z, part);
  // Cloth: the break above the shoe (two creases across the shin), creases behind the knee and,
  // at 4×, the pressed crease down the front.
  const [hx, hy] = c2(hip);
  const [kx, ky] = c2(knee);
  const [ax, ay] = c2(ankle);
  const bx0 = Math.min(hx, kx, ax) - 6;
  const by0 = Math.min(hy, ky, ay) - 6;
  const across = (u: number, v: number, x0: number, y0: number, x1: number, y1: number, r: number): [number, number] => {
    const vx = x1 - x0;
    const vy = y1 - y0;
    const l = Math.hypot(vx, vy) || 1;
    // t along the segment, s across it (−1 the front / toe side … +1 the back), facing right.
    const t = ((u - x0) * vx + (v - y0) * vy) / (l * l);
    const sx = ((u - x0) * vy - (v - y0) * vx) / l / r;
    return [t, -sx];
  };
  p.shade(bx0, by0, Math.max(hx, kx, ax) + 6 - bx0, Math.max(hy, ky, ay) + 6 - by0, (u, v) => {
    const [t, sv] = across(u, v, kx, ky, ax, ay, 4.7);
    if (t > 0.55 && t < 1.05 && Math.abs(sv) < 1) {
      for (const c of [0.8, 0.92]) {
        const e = t - c - sv * 0.06;
        if (Math.abs(e) < 0.025 && sv < 0.75) return -0.45;
        if (e < -0.025 && e > -0.06 && sv < 0.6) return 0.18;
      }
    }
    const [tt, st] = across(u, v, hx, hy, kx, ky, 5.5);
    if (tt > 0.72 && tt < 1 && st > 0.15 && st < 1) {
      const e = ((tt - 0.78) % 0.09) - 0.045;
      if (Math.abs(e) < 0.012 + 0.01 / p.d) return -0.4;
    }
    if (p.d >= 4) {
      const a2 = segDist(u, v, hx + 1.5, hy + 3, kx + 1.6, ky - 2)[0];
      const b2 = segDist(u, v, kx + 1.4, ky + 3, ax + 1.3, ay - 2.5)[0];
      if (Math.min(a2, b2) < 0.3) return 0.22;
    }
    return 0;
  }, part);
  joint(p, M, knee[0], knee[1], 4, z + 4);
  // Shoe: toe forward, a small heel at the back, a sole under the toe (1×: 18 × 6 + soles).
  const [a0, a1] = ankle;
  p.blob(
    [
      [a0 - 6, a1 + 4.1],
      [a0 - 6.2, a1 - 0.6],
      [a0 - 4.2, a1 - 2],
      [a0 + 1, a1 - 2.1],
      [a0 + 6, a1 - 1.2],
      [a0 + 10.2, a1 + 0.4],
      [a0 + 12, a1 + 2.2],
      [a0 + 12, a1 + 4.1],
    ],
    2.2,
    { mat: M.shoe, z: z + 2, bulge: 0.3 },
  );
  p.box(a0 + 1, a1 + 4, 11, 2, { mat: M.sole, z: z + 1.5, r: 0.5, bevel: 0.5 });
  p.box(a0 - 6, a1 + 4, 4, 2, { mat: M.sole, z: z + 1.5, bevel: 0.5 });
}

export function legsHd(d: number): Frame[] {
  return lowFrames(`${ART}/legs`).map((f, i) => {
    const p = new HdPiece(geomOf(f), d);
    const M = mats(p);
    const [far, near] = legJoints(i);
    leg(p, M, far, true, 0);
    leg(p, M, near, false, 12);
    return p.frame(RENDER);
  });
}

// ---------------------------------------------------------------------------------------------
// Body: trousers, boucle jacket, blouse, steel neck
// ---------------------------------------------------------------------------------------------

const JK = cov(JACKET_POLY);
const LAP_N = cov(LAPEL_NEAR);
const LAP_F = cov(LAPEL_FAR);

/** A soft cloth volume over `pts` (the blob profile) plus `extra(x, y)` relief. */
function clothField(p: HdPiece, pts: ReadonlyArray<Pt>, r: number, extra: (x: number, y: number) => number, o: { mat: number; z: number; tex?: Texture | null; part?: number }): void {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  p.field(x0, y0, x1 - x0, y1 - y0, (x, y) => {
    if (!inPoly(x, y, pts)) return NaN;
    const dist = polyDist(x, y, pts);
    const t = dist >= r ? 1 : dist / r;
    return r * Math.sqrt(1 - (1 - t) * (1 - t)) + 0.3 * Math.sqrt(dist) + extra(x, y);
  }, o);
}

/** A soft drape fold: a ridge beside a groove along a–b, fading at the top end. */
function fold(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const [dd, t] = segDist(x, y, ax, ay, bx, by);
  if (dd > 3) return 0;
  const fade = Math.min(1, t * 3);
  const side = (bx - ax) * (y - ay) - (by - ay) * (x - ax) > 0 ? 1 : -1;
  return fade * (0.9 * Math.exp(-((dd - 1.1) ** 2) / 0.5) * (side > 0 ? 1 : 0.4) - 0.8 * Math.exp(-(dd * dd) / 0.35));
}

function bodyFrameHd(p: HdPiece, state: number): void {
  const M = mats(p);
  const wr = wear(p, [-30, -108, 60, 60], state, 23);
  const bc = boucle(p, 23);
  // Trousers at the hips (the jacket hem covers their top), the fly seam.
  const pant = p.newPart();
  p.blob(cov([[-21, -56], [19, -56], [22, -37], [-23, -37]]), 3, { mat: M.pants, z: 0, part: pant });
  p.shade(-2, -48, 3, 11, (x) => (Math.abs(x + 0.5) < 0.35 ? -0.5 : 0), pant);
  // The jacket: a soft wool volume, the chest (3/4 view), the waist, two drape folds.
  clothField(
    p,
    JK,
    5,
    (x, y) =>
      7 * Math.sqrt(Math.max(0, 1 - ((x + 1) / 31) ** 2)) +
      2.4 * gauss(x, y, 17.5, -86, 7, 11) +
      1.2 * gauss(x, y, -12, -90, 9, 10) -
      1.1 * gauss(x, y, 0, -73, 30, 2.6) * (x < -20 || x > 22 ? 1 : 0.4) +
      fold(x, y, -15.5, -82, -17.5, -51) +
      fold(x, y, 15.5, -70, 17.5, -51),
    { mat: M.jacket, z: 2, tex: texs(bc, wr) },
  );
  // The hem rolls under (a soft shade just above it).
  p.shade(-30, -53, 60, 6, (_x, y) => (y > -51 ? -0.12 : 0));
  // The shawl collar stands up behind the neck.
  p.ell(2.5, -107, 12.5, 4, { mat: M.lapel, z: 18, round: 0.6 });
  // The crimson blouse in the deep V and down the open front; a soft fold.
  const bl = p.newPart();
  p.blob(cov([[-9, -106], [13, -106], [6, -74], [0, -74]]), 1.6, { mat: M.blouse, z: 19, part: bl });
  p.box(0, -75, 6, 12, { mat: M.blouse, z: 19, part: bl, bevel: 1.2 });
  p.shade(4, -74, 3, 11, (x) => (Math.abs(x - 5.5) < 0.4 ? -0.4 : 0), bl);
  // The steel neck with its rings.
  const nk = p.newPart();
  p.cyl(-4, -118, 9, 15, { mat: M.steel, z: 20, part: nk });
  p.shade(-4, -118, 9, 15, (_x, y) => (Math.abs(y + 109.5) < 0.35 || Math.abs(y + 106.5) < 0.35 ? -0.6 : Math.abs(y + 105.8) < 0.3 ? 0.35 : 0), nk);
  // The stand collar round the neck base and the dark V of the throat.
  p.box(-5, -103, 11, 2, { mat: M.blouse, z: 26, bevel: 0.7, tone: 0.1 });
  p.poly([[-1.6, -101], [5.6, -101], [2.5, -93.6]], { mat: M.steelDark, z: 25 });
  // The open pointed shirt collar: long points that lie down and out on the lapels.
  p.blob(cov([[-8, -104], [-1, -101], [-10, -94]]), 0.9, { mat: M.blouse, z: 27, tone: 0.18 });
  p.blob(cov([[12, -104], [5, -101], [10, -93]]), 0.9, { mat: M.blouse, z: 27, tone: 0.05 });
  // A covered button.
  p.ell(2, -92, 1.05, 1.05, { mat: M.blouse, z: 27.5 });
  // The wide rolled shawl collar: smooth plush (no nubs), it rolls over onto the jacket.
  p.blob(LAP_N, 3.6, { mat: M.lapel, z: 29, bulge: 0.4, tone: 0.08, tex: wr });
  p.blob(LAP_F, 3, { mat: M.lapel, z: 29, bulge: 0.3, tone: -0.06, tex: wr });
  // Below the pendant the jacket closes: the front panel over the blouse, its edge.
  p.box(-1, -62, 8, 14, { mat: M.jacket, z: 28, bevel: 1.4, tex: texs(bc, wr) });
  p.shade(-1, -62, 8, 14, (x) => (Math.abs(x - 3.5) < 0.35 ? -0.5 : 0));
}

export function bodyHd(state: number, d: number): Frame[] {
  return lowFrames(`${ART}/body-${state}`).map((f) => {
    const p = new HdPiece(geomOf(f), d);
    bodyFrameHd(p, state);
    return p.frame(RENDER);
  });
}

// ---------------------------------------------------------------------------------------------
// The far arm (rest, and the chain whirl)
// ---------------------------------------------------------------------------------------------

function armBackFrameHd(p: HdPiece, f: number): void {
  const M = mats(p);
  const sh = FAR_SHOULDER;
  if (f === 0) {
    // At rest: the sleeve hangs behind the back edge, a cuff ring, the mitten below the hem.
    const tex = boucle(p, 51);
    const part = p.newPart();
    sleeve(p, sh, [-32, -77], 10, 9, M.jacketFar, tex, 0, part);
    sleeve(p, [-32, -77], [-30, -51], 8, 7.4, M.jacketFar, tex, 0, part);
    p.cap(-31.6, -54.5, -30.5, -50.5, 3.9, 3.9, { mat: M.lapel, z: 1.5, tone: -0.15 });
    joint(p, M, -32, -77, 3, 4);
    mitten(p, M, -30, -47, 4, 6);
    return;
  }
  const { p: ph, elbow, hand, loop, rx, ry } = farArmPose(f);
  const tex = boucle(p, 53);
  const part = p.newPart();
  sleeve(p, sh, elbow, 10, 9, M.jacket, tex, 0, part);
  sleeve(p, elbow, hand, 8, 7.4, M.jacket, tex, 0, part);
  joint(p, M, elbow[0], elbow[1], 3, 5);
  // The whirling chain loop (held by the hand): the loop sways, the shields travel round it.
  const [lx, ly] = [loop[0] + 0.5, loop[1] + 0.5];
  const ring = curve((t) => [lx + Math.cos(t * Math.PI * 2) * rx, ly + Math.sin(t * Math.PI * 2) * ry], 64);
  chainLinks(p, M, ring, 8, ph);
  for (let k = 0; k < 4; k++) {
    const t = ((k + ph / 6) / 4) * Math.PI * 2 + 0.4;
    chainShield(p, M, Math.round(lx - 0.5 + Math.cos(t) * rx), Math.round(ly - 0.5 + Math.sin(t) * ry), M.enamel[k % 4], 11);
  }
  const [hx, hy] = c2(hand);
  chainLinks(p, M, curve((t) => [hx + (lx - rx * 0.7 - hx) * t, hy + (ly + ry * 0.7 - hy) * t], 8), 9, 0);
  mitten(p, M, hand[0], hand[1], 4, 14);
}

export function armBackHd(d: number): Frame[] {
  return lowFrames(`${ART}/arm-back`).map((f, i) => {
    const p = new HdPiece(geomOf(f), d);
    armBackFrameHd(p, i);
    return p.frame(RENDER);
  });
}

// ---------------------------------------------------------------------------------------------
// The stamp arm
// ---------------------------------------------------------------------------------------------

/** The giant rubber stamp: a polished knob, a stem with a brass ferrule, the oiled block, the pad, the label. */
function stamp(p: HdPiece, M: Mats, cx: number, bottom: number, state: number, z: number): void {
  const top = bottom - 24;
  const wr = wear(p, [cx - 28, top - 20, 57, 44], state, 7);
  const gr = texs(grain(p, 5), wr);
  p.cyl(cx - 3, top - 12, 7, 13, { mat: M.wood, z, tex: gr });
  p.cyl(cx - 3.6, top - 2.6, 8.2, 2.6, { mat: M.gold, z: z + 1 });
  p.ell(cx + 0.5, top - 15.5, 5.5, 5.5, { mat: M.knob, z: z + 1, tex: wr });
  // The block: rounded corners, a bevel all round (its lit top edge), the grain.
  p.box(cx - 28, top, 57, 21, { mat: M.wood, z: z + 2, r: 2, bevel: 2.2, tex: gr });
  // The rubber pad under it.
  p.box(cx - 27, bottom - 3, 55, 3, { mat: M.rubber, z: z + 2.6, bevel: 0.7, r: 0.5 });
  // The label face (kept clean of wear: the letters always read).
  p.box(cx - 25, top + 5, 51, 11, { mat: M.label, z: z + 5, bevel: 0.6 });
}

/** The label lettering per density (the same letters on every frame). */
const letterCache = new Map<number, PixelBuffer>();

/** The label lettering (rounded rubber-stamp strokes over the 1× glyph pixels) on a finished buffer. */
function lettering(buf: PixelBuffer, g: FrameGeom, d: number, tx: number, ty: number): void {
  let L = letterCache.get(d);
  if (!L) {
    L = letterMask(d);
    letterCache.set(d, L);
  }
  const X0 = framePx(g, d, tx - 1);
  const Y0 = framePy(g, d, ty - 1);
  for (let Y = 0; Y < L.h; Y++) {
    for (let X = 0; X < L.w; X++) {
      const c = L.data[Y * L.w + X];
      if ((c & 255) !== 0) buf.set(X0 + X, Y0 + Y, c);
    }
  }
}

/** The lettering on its own buffer: logical (−1, −1) of the text at its top-left. */
function letterMask(d: number): PixelBuffer {
  const text = 'GESLOTEN';
  const tw = measure(text);
  const m = new PixelBuffer(tw + 2, 12);
  drawText(m, text, 1, 1, { color: PAL.red[2] });
  const on = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < m.w && y < m.h && (m.get(x, y) & 255) !== 0;
  const segs: Array<readonly [number, number, number, number]> = [];
  for (let y = 0; y < m.h; y++) {
    for (let x = 0; x < m.w; x++) {
      if (!on(x, y)) continue;
      segs.push([x, y, x, y]);
      if (on(x + 1, y)) segs.push([x, y, x + 1, y]);
      if (on(x, y + 1)) segs.push([x, y, x, y + 1]);
      if (on(x + 1, y + 1) && !on(x + 1, y) && !on(x, y + 1)) segs.push([x, y, x + 1, y + 1]);
      if (on(x - 1, y + 1) && !on(x - 1, y) && !on(x, y + 1)) segs.push([x, y, x - 1, y + 1]);
    }
  }
  const main = R.red[5];
  const edge = R.red[4];
  const rad = 0.52;
  const out = new PixelBuffer(m.w * d, m.h * d);
  for (let Y = 0; Y < out.h; Y++) {
    for (let X = 0; X < out.w; X++) {
      // Glyph coordinates of this art px (glyph pixel centres at integers).
      const gx = (X + 0.5) / d - 0.5;
      const gy = (Y + 0.5) / d - 0.5;
      let best = Infinity;
      let bx = 0;
      let by = 0;
      for (const [ax, ay, cx, cy] of segs) {
        if (Math.abs(gx - ax) > 2 || Math.abs(gy - ay) > 2) continue;
        const [dd, t] = segDist(gx, gy, ax, ay, cx, cy);
        if (dd < best) {
          best = dd;
          bx = ax + (cx - ax) * t;
          by = ay + (cy - ay) * t;
        }
      }
      if (best > rad) continue;
      const lower = gx - bx + (gy - by) > 0.18 && best > rad - 0.6 / d;
      out.set(X, Y, lower && d >= 4 ? edge : main);
    }
  }
  return out;
}

function stampArmPoseHd(p: HdPiece, f: number, state: number): void {
  const M = mats(p);
  const sh = STAMP_SHOULDER;
  const [elbow, hand, bottom] = ARM_POSES[f];
  if (f === 4) {
    // Smear: speed streaks above the block as it travels (between raised and the floor).
    for (const dx of [-24, -12, 0, 12, 24]) {
      const x = hand[0] + dx + 0.5;
      const len = 28 - (Math.abs(dx) >> 1);
      // The thin tip stays at least half an art px wide, so it reaches the frame top at every d.
      p.cap(x, bottom - 58 + 0.5, x, bottom - 58 + len, Math.max(0.15, 0.6 / p.d), 0.5, { mat: dx % 24 === 0 ? M.wood : M.silver, z: -2, round: 0.3 });
    }
  }
  // The arm first, so the block (and its GESLOTEN face) always sits in front of it.
  const wr = wear(p, [18, -150, 70, 150], state, 41);
  const tex = texs(boucle(p, 41), wr);
  const part = p.newPart();
  sleeve(p, sh, elbow, 11, 10, M.jacket, tex, 0, part);
  sleeve(p, elbow, hand, 9, 8.2, M.jacket, tex, 0, part);
  joint(p, M, elbow[0], elbow[1], 4, 5);
  stamp(p, M, hand[0], bottom, state, 8);
  mitten(p, M, hand[0], hand[1], 5, 16);
  // The jacket shoulder cap (small and low: the neck and the chest stay clear) with two rivets.
  const cap = p.newPart();
  p.ell(sh[0] + 3, sh[1] + 1.5, 8, 6.5, { mat: M.jacket, z: 20, tex, part: cap });
  // A seam slanting down the cap (the 1× rivets ride on it, one high, one low): a pauldron plate.
  const seamY = (x: number): number => sh[1] - 3.2 + (x - sh[0]) * 0.32;
  p.shade(sh[0] - 6, sh[1] - 6, 18, 10, (x, y) => {
    const e = y - seamY(x);
    return e > -0.5 && e < 0.5 ? (e < 0 ? 0.25 : -0.4) : 0;
  }, cap);
  for (const rx of [-1, 6]) p.ell(sh[0] + rx + 0.6, seamY(sh[0] + rx + 0.6), 0.75, 0.75, { mat: M.steel, z: 26.5 });
  if (f === 2) {
    // Slam: wet ink splats round the pad.
    for (const dx of [-34, -31, 31, 34]) p.ell(hand[0] + dx + 1, -1, 1.05, 0.9, { mat: M.enamel[0], z: 12 });
  }
}

export function stampArmHd(state: number, d: number): Frame[] {
  const lo = lowFrames(`${ART}/stamp-arm-${state}`);
  const tw = measure('GESLOTEN');
  const drawn = new Map<string, PixelBuffer>();
  return lo.map((f, i) => {
    const pose = i % ARM_FRAMES;
    const mirror = i >= ARM_FRAMES;
    const g = geomOf(f);
    // A mirrored frame is drawn unmirrored on the mirrored rectangle, then flipped (one render
    // per pose when both facings share the rectangle).
    const gu: FrameGeom = mirror ? { w: g.w, h: g.h, ox: g.w - 1 - g.ox, oy: g.oy } : g;
    const key = `${pose}:${gu.w},${gu.h},${gu.ox},${gu.oy}`;
    let raw = drawn.get(key);
    if (!raw) {
      const p = new HdPiece(gu, d);
      stampArmPoseHd(p, pose, state);
      raw = p.render(RENDER);
      drawn.set(key, raw);
    }
    const buf = mirror ? raw.flipped(true) : raw.clone();
    const [, hand, bottom] = ARM_POSES[pose];
    const top = bottom - 24;
    const cx = hand[0];
    const tx = mirror ? -cx - (tw >> 1) : cx - (tw >> 1);
    lettering(buf, g, d, tx, top + 7);
    return { buf, ox: g.ox, oy: g.oy, density: d };
  });
}

/** The sparking shoulder stump: the cap, the torn steel stub, three cut cables, a spark. */
export function stumpHd(d: number): Frame[] {
  return lowFrames(`${ART}/stamp-arm-gone`).map((f) => {
    const g = geomOf(f);
    const p = new HdPiece(g, d);
    const M = mats(p);
    p.ell(27, -95.5, 8, 6.5, { mat: M.jacket, z: 4, tex: boucle(p, 45) });
    p.cap(26.5, -94.5, 30.5, -87.5, 3, 2.6, { mat: M.steel, z: 6 });
    p.ell(30.6, -87.4, 2.2, 1.6, { mat: M.steelDark, z: 7 });
    p.cap(30.5, -87.5, 36.5, -81.5, 0.6, 0.5, { mat: M.cable[0], z: 8 });
    p.cap(29.5, -85.5, 33.5, -77.5, 0.6, 0.5, { mat: M.cable[1], z: 8.5 });
    p.cap(31.5, -88.5, 38.5, -85.5, 0.6, 0.5, { mat: M.cable[2], z: 8.2 });
    const buf = p.render(RENDER);
    sparklePx(buf, g, d, 37.5, -81.5, R.gold[7], R.gold[6]);
    return { buf, ox: g.ox, oy: g.oy, density: d };
  });
}

// ---------------------------------------------------------------------------------------------
// Chain of office and medallion
// ---------------------------------------------------------------------------------------------

function chainFrameHd(p: HdPiece, state: number, broken: boolean): void {
  const M = mats(p);
  const wr = wear(p, [-20, -110, 46, 26], broken ? 0 : state, 13);
  const gone = (t: number): boolean => broken && t > CHAIN_CUT[0] && t < CHAIN_CUT[1];
  CHAIN_RUNS.forEach((run, r) => {
    const f = (t: number): readonly [number, number] => {
      const [x, y] = run(t);
      return [x + 0.5, y + 0.5];
    };
    if (broken) {
      chainLinks(p, M, curve((t) => f(t * CHAIN_CUT[0]), 12), 0, r);
      chainLinks(p, M, curve((t) => f(CHAIN_CUT[1] + t * (1 - CHAIN_CUT[1])), 12), 0, r);
      // The cut ends dangle.
      const [tx, ty] = f(CHAIN_CUT[0]);
      const [bx, by] = f(CHAIN_CUT[1]);
      chainLinks(p, M, curve((t) => [tx + (r === 0 ? 2 : -2) * t, ty + 7 * t], 6), 0.5, r);
      chainLinks(p, M, curve((t) => [bx + (r === 0 ? -1 : 1) * t, by - 3 * t], 4), 0.5, r);
    } else chainLinks(p, M, curve(f, 40), 0, r, wr);
    CHAIN_SHIELDS.forEach((t, k) => {
      if (gone(t)) return;
      const [x, y] = run(t);
      chainShield(p, M, Math.round(x), Math.round(y), M.enamel[(r * 2 + k) % 4], 4, wr);
    });
  });
  // The chain runs under the hair high at the back of the neck: clear what the wig crown covers.
  const crown = HAIR_LOCKS.filter(([, y]) => y < -110).map(([x, y, rr]) => [x + 0.5, y + 0.5, rr + 0.5] as const);
  p.erase(-30, -125, 70, 25, (x, y) => crown.some(([cx, cy, rr]) => (x - cx) ** 2 + (y - cy) ** 2 < rr * rr));
}

export function chainHd(state: number, broken: boolean, d: number): Frame[] {
  return lowFrames(broken ? `${ART}/chain-gone` : `${ART}/chain-${state}`).map((f) => {
    const p = new HdPiece(geomOf(f), d);
    chainFrameHd(p, state, broken);
    return p.frame(RENDER);
  });
}

/**
 * Medallion frames: 0 closed (the city arms in enamel: a red shield, a black pale, three white
 * saltires, a gold crown), 1 open (a dark socket, the teal core), 2 firing (the hot pink-gold
 * glow, sparks). A silver disc with a domed beaded rim and a gold bezel.
 */
function medallionFrameHd(p: HdPiece, f: number, state: number): Frame['buf'] | null {
  const M = mats(p);
  const cx = MAYOR.medallionC[0] + 0.5;
  const cy = MAYOR.medallionC[1] + 0.5;
  const r = 14.5;
  const wr = wear(p, [cx - 14, cy - 14, 28, 28], state, 5);
  const beads = p.d >= 4 ? 20 : 10;
  // The disc: a beaded rim ridge round a shallow dish.
  p.field(cx - r, cy - r, 2 * r, 2 * r, (x, y) => {
    const q = Math.hypot(x - cx, y - cy);
    if (q > r) return NaN;
    const t = (q - (r - 1.7)) / 1.7;
    let h = Math.abs(t) < 1 ? 1.7 * Math.sqrt(1 - t * t) : 0;
    if (q < r - 3.4) h = -0.5 * (1 - (q / (r - 3.4)) ** 2);
    if (Math.abs(t) < 1) {
      const a = Math.atan2(y - cy, x - cx);
      const k = Math.round((a / (Math.PI * 2)) * beads);
      const ba = (k / beads) * Math.PI * 2;
      const bd = Math.hypot(x - (cx + Math.cos(ba) * (r - 1.7)), y - (cy + Math.sin(ba) * (r - 1.7)));
      if (bd < 0.85) h += 0.7 * Math.sqrt(1 - (bd / 0.85) ** 2);
    }
    return h;
  }, { mat: M.silver, z: 0, tex: wr });
  // The gold bezel round the face.
  p.field(cx - r + 2.6, cy - r + 2.6, 2 * r - 5.2, 2 * r - 5.2, (x, y) => {
    const q = Math.hypot(x - cx, y - cy);
    const t = (q - (r - 3.35)) / 0.62;
    return t > 1 || t < -1 ? NaN : 0.6 * Math.sqrt(1 - t * t);
  }, { mat: M.gold, z: 1.2 });
  if (f === 0) {
    // The city arms: a red enamel shield, a black pale with three white saltires, a gold crown.
    const sh = cov([[cx - 9.5, cy - 9.5], [cx + 8.5, cy - 9.5], [cx + 8.5, cy + 3.5], [cx - 0.5, cy + 11.5], [cx - 9.5, cy + 3.5]]);
    // The shield, kept inside the bezel: a soft enamel volume over the shield ∩ the face disc.
    const inner = r - 3.1;
    p.field(cx - r, cy - r, 2 * r, 2 * r, (x, y) => {
      if (!inPoly(x, y, sh)) return NaN;
      const rim = inner - Math.hypot(x - cx, y - cy);
      if (rim <= 0) return NaN;
      const dd = Math.min(polyDist(x, y, sh), rim);
      return 1.3 * Math.sqrt(Math.min(1, dd / 1.3)) + 0.25 * Math.sqrt(dd);
    }, { mat: M.enamel[0], z: 2 });
    p.box(cx - 2.5, cy - 9.5, 5, 19, { mat: M.black, z: 6, bevel: 0.6 });
    p.poly([[cx - 1.5, cy + 9.5], [cx + 1.5, cy + 9.5], [cx, cy + 11.2]], { mat: M.black, z: 6 });
    for (const dy of [-5, 0, 5]) {
      p.cap(cx - 1, cy + dy - 1, cx + 1, cy + dy + 1, 0.5, 0.5, { mat: M.enamel[3], z: 8 });
      p.cap(cx + 1, cy + dy - 1, cx - 1, cy + dy + 1, 0.5, 0.5, { mat: M.enamel[3], z: 8 });
    }
    // The crown on the rim, where the chain runs end.
    p.box(cx - 4.5, cy - 12.5, 9, 2.2, { mat: M.gold, z: 9, bevel: 0.6 });
    for (const dx of [-4, 0, 4]) p.ell(cx + dx, cy - 12.9, 0.8, 0.8, { mat: M.gold, z: 9.6 });
    return null;
  }
  // Open: a dark socket and the glowing core (flat light bands, a white-hot centre).
  const glow = f === 2;
  p.ell(cx, cy, 9.5, 9.5, { mat: M.ink, z: 1.5, round: 0 });
  p.field(cx - 7.5, cy - 7.5, 15, 15, (x, y) => {
    const q = Math.hypot(x - cx, y - cy);
    return q > 7.5 ? NaN : 0;
  }, {
    mat: glow ? M.glow : M.core,
    z: 3,
    tex: p.tex((s) => {
      const q = Math.hypot(s.x - cx, s.y - cy);
      // Bands outward from the centre: 6 white (r < 1), 5 (r < 2.5), 4, 3, 2, 1, 0 at the rim.
      const k = q < 1.05 ? 6 : q < 2.6 ? 5 : q < 4 ? 4 : q < 5.2 ? 3 : q < 6.3 ? 2 : q < 7 ? 1 : 0;
      s.tone = (k + 0.5) / 7 - 0.5;
    }),
  });
  return null;
}

export function medallionHd(state: number, d: number): Frame[] {
  return lowFrames(`${ART}/medallion-${state}`).map((f, i) => {
    const g = geomOf(f);
    const p = new HdPiece(g, d);
    medallionFrameHd(p, i, state);
    const buf = p.render(RENDER);
    const cx = MAYOR.medallionC[0] + 0.5;
    const cy = MAYOR.medallionC[1] + 0.5;
    if (i > 0) {
      // The glass dome over the core: a bright crescent at the upper left.
      for (let Y = 0; Y < buf.h; Y++) {
        for (let X = 0; X < buf.w; X++) {
          const x = X / d - g.ox + 0.5 / d;
          const y = Y / d - g.oy + 0.5 / d;
          const q = Math.hypot(x - cx, y - cy);
          const a = Math.atan2(y - cy, x - cx);
          if (q > 5.6 && q < 5.6 + 1.05 / d + 0.2 && a > -2.6 && a < -1.75) buf.set(X, Y, R.snow[6]);
        }
      }
      // The white-hot centre pixel (the core's centre reads at every density).
      buf.set(framePx(g, d, MAYOR.medallionC[0]), framePy(g, d, MAYOR.medallionC[1]), PAL.snow[3]);
    }
    if (i === 2) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        sparklePx(buf, g, d, cx + Math.cos(a) * 11, cy + Math.sin(a) * 11, R.gold[7], R.gold[5]);
      }
    }
    return { buf, ox: g.ox, oy: g.oy, density: d };
  });
}

// ---------------------------------------------------------------------------------------------
// Hair (the wig), face plate, skull
// ---------------------------------------------------------------------------------------------

const LOCKS = HAIR_LOCKS.map(([x, y, r]) => [x + 0.5, y + 0.5, r + 0.5] as const);
const FLARES = HAIR_FLARES.map((f) => cov(f));
const FP = cov(FACE_POLY);
const SW = cov(SWEEP);
const TP = cov(TEMPLE);
/** Strand ridges: the layout strands plus a parallel wave beside each (offset, phase-shifted). */
const RIDGE_STRANDS: ReadonlyArray<Strand> = STRANDS.flatMap((s): Strand[] => {
  const [x0, y0, x1, y1, a, k, ph] = s;
  const l = Math.hypot(x1 - x0, y1 - y0);
  const nx = (-(y1 - y0) / l) * 3.4;
  const ny = ((x1 - x0) / l) * 3.4;
  return [s, [x0 + nx, y0 + ny + 2, x1 + nx * 0.8, y1 + ny * 0.8 - 2, a * 0.8, k, ph + 1.7]];
}).concat([
  // More falls down the far side (it frames the face): long S-waves to the shoulder tips.
  [21, -146, 37, -98, 2.5, 3, 0.4],
  [27, -144, 31, -96, 2.5, 3, 2.1],
  [19, -138, 23, -106, 2, 2.5, 1.2],
]);
/** The sweep waves: from the part down to the near temple (x0, y0, x1, y1, bend). */
const SWEEP_WAVES: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [4, -160, -13, -149, 2],
  [16, -155, -7, -141, 3],
  [10, -159, -12, -143, 4],
  [14, -157, -11, -139, 4],
];

/** A scalar field on art-px centres over a local box: cell (i, j) is at (x0 + (i + ½) / d, y0 + (j + ½) / d). */
interface Grid {
  x0: number;
  y0: number;
  w: number;
  h: number;
  d: number;
  v: Float32Array;
}

function grid(x0: number, y0: number, lw: number, lh: number, d: number, fill: number): Grid {
  const w = Math.ceil(lw * d);
  const h = Math.ceil(lh * d);
  return { x0, y0, w, h, d, v: new Float32Array(w * h).fill(fill) };
}

/** Bilinear sample (NaN where a neighbour is outside the shape: the nearest cell then). */
function sample(g: Grid, x: number, y: number): number {
  const fx = (x - g.x0) * g.d - 0.5;
  const fy = (y - g.y0) * g.d - 0.5;
  const i = Math.floor(fx);
  const j = Math.floor(fy);
  const tx = fx - i;
  const ty = fy - j;
  if (i < 0 || j < 0 || i + 1 >= g.w || j + 1 >= g.h) {
    const a = Math.round(fx);
    const b = Math.round(fy);
    return a < 0 || b < 0 || a >= g.w || b >= g.h ? NaN : g.v[b * g.w + a];
  }
  const k = j * g.w + i;
  const v00 = g.v[k];
  if (tx < 1e-6 && ty < 1e-6) return v00;
  const v10 = g.v[k + 1];
  const v01 = g.v[k + g.w];
  const v11 = g.v[k + g.w + 1];
  if (v00 !== v00 || v10 !== v10 || v01 !== v01 || v11 !== v11) return g.v[Math.round(fy) * g.w + Math.round(fx)];
  return (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty;
}

/** Splat the ridge profile of a polyline into `h` (and the groove beside it into `tone`). */
function splatRidge(h: Grid, tone: Grid | null, pts: ReadonlyArray<Pt>, amp: number, half: number, groove: number): void {
  const cum = arcLen(pts);
  const L = cum[cum.length - 1] || 1;
  const reach = half + 0.8;
  let bx0 = Infinity;
  let by0 = Infinity;
  let bx1 = -Infinity;
  let by1 = -Infinity;
  for (const [x, y] of pts) {
    bx0 = Math.min(bx0, x - reach);
    by0 = Math.min(by0, y - reach);
    bx1 = Math.max(bx1, x + reach);
    by1 = Math.max(by1, y + reach);
  }
  const i0 = Math.max(0, Math.floor((bx0 - h.x0) * h.d));
  const i1 = Math.min(h.w - 1, Math.ceil((bx1 - h.x0) * h.d));
  const j0 = Math.max(0, Math.floor((by0 - h.y0) * h.d));
  const j1 = Math.min(h.h - 1, Math.ceil((by1 - h.y0) * h.d));
  const bw = i1 - i0 + 1;
  const bh = j1 - j0 + 1;
  if (bw <= 0 || bh <= 0) return;
  const dist = new Float32Array(bw * bh).fill(Infinity);
  const par = new Float32Array(bw * bh);
  for (let k = 0; k + 1 < pts.length; k++) {
    const [ax, ay] = pts[k];
    const [cx, cy] = pts[k + 1];
    const si0 = Math.max(i0, Math.floor((Math.min(ax, cx) - reach - h.x0) * h.d));
    const si1 = Math.min(i1, Math.ceil((Math.max(ax, cx) + reach - h.x0) * h.d));
    const sj0 = Math.max(j0, Math.floor((Math.min(ay, cy) - reach - h.y0) * h.d));
    const sj1 = Math.min(j1, Math.ceil((Math.max(ay, cy) + reach - h.y0) * h.d));
    for (let j = sj0; j <= sj1; j++) {
      const y = h.y0 + (j + 0.5) / h.d;
      for (let i = si0; i <= si1; i++) {
        const x = h.x0 + (i + 0.5) / h.d;
        const [dd, t] = segDist(x, y, ax, ay, cx, cy);
        const q = (j - j0) * bw + (i - i0);
        if (dd < dist[q]) {
          dist[q] = dd;
          par[q] = (cum[k] + (cum[k + 1] - cum[k]) * t) / L;
        }
      }
    }
  }
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const q = (j - j0) * bw + (i - i0);
      const c = j * h.w + i;
      const hv = h.v[c];
      if (hv !== hv) continue;
      const dd = dist[q];
      const t = par[q];
      const fade = Math.min(1, t * 4, (1 - t) * 6);
      if (dd < half) h.v[c] = hv + amp * Math.cos((dd / half) * (Math.PI / 2)) ** 2 * fade;
      else if (tone && dd < half + 0.7 && t > 0.08 && t < 0.92) tone.v[c] = Math.min(tone.v[c], groove);
    }
  }
}

/** The hair fields of one density (built once, shared by the head bases and the wig frames). */
interface HairGrids {
  back: Grid;
  groove: Grid;
  sweep: Grid;
}
const hairGrids = new Map<number, HairGrids>();

function hairGridsOf(d: number): HairGrids {
  const hit = hairGrids.get(d);
  if (hit) return hit;
  // The back mass: lit lock domes (crown locks nearer), the shoulder flares, the S-wave ridges.
  const back = grid(-47, -178, 90, 88, d, NaN);
  // How near each art px is to a lock's lit crown (1 at its centre, 0 at its rim and between locks).
  const crown = grid(-47, -178, 90, 88, d, 0);
  for (const [lx, ly, r] of LOCKS) {
    const lift = ly < -140 ? 1.5 : ly < -120 ? 0.6 : 0;
    const i0 = Math.max(0, Math.floor((lx - r - back.x0) * d));
    const i1 = Math.min(back.w - 1, Math.ceil((lx + r - back.x0) * d));
    const j0 = Math.max(0, Math.floor((ly - r - back.y0) * d));
    const j1 = Math.min(back.h - 1, Math.ceil((ly + r - back.y0) * d));
    for (let j = j0; j <= j1; j++) {
      const y = back.y0 + (j + 0.5) / d;
      for (let i = i0; i <= i1; i++) {
        const x = back.x0 + (i + 0.5) / d;
        const q = (x - lx) ** 2 + (y - ly) ** 2;
        if (q >= r * r) continue;
        const v = (lx > 18 ? 0.3 : 0.45) * Math.sqrt(r * r - q) + lift;
        const c = j * back.w + i;
        if (!(v <= back.v[c])) back.v[c] = v;
        const cr = 1 - q / (r * r);
        if (cr > crown.v[c]) crown.v[c] = cr;
      }
    }
  }
  for (const fl of FLARES) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [x, y] of fl) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    for (let j = Math.max(0, Math.floor((y0 - back.y0) * d)); j <= Math.min(back.h - 1, Math.ceil((y1 - back.y0) * d)); j++) {
      const y = back.y0 + (j + 0.5) / d;
      for (let i = Math.max(0, Math.floor((x0 - back.x0) * d)); i <= Math.min(back.w - 1, Math.ceil((x1 - back.x0) * d)); i++) {
        const x = back.x0 + (i + 0.5) / d;
        if (!inPoly(x, y, fl)) continue;
        const v = 2.2 * Math.sqrt(Math.min(1, polyDist(x, y, fl) / 2.2)) - 0.4;
        const c = j * back.w + i;
        if (!(v <= back.v[c])) back.v[c] = v;
      }
    }
  }
  const groove = grid(-47, -178, 90, 88, d, 0);
  for (const s of RIDGE_STRANDS) splatRidge(back, groove, strandPts(s).map(([x, y]) => [x + 0.5, y + 0.5] as const), 1.8, 2.3, -0.5);
  // The grooves beside the strands sink only in the gaps between the curls: they fade out over a
  // lock's lit crown (no dark lines scribbled across the curls), and stay softer on the far side.
  for (let j = 0; j < groove.h; j++) {
    const far = groove.x0 + 0.5 / d;
    for (let i = 0; i < groove.w; i++) {
      const c = j * groove.w + i;
      const g = groove.v[c];
      if (g >= 0) continue;
      const k = 1 - crown.v[c];
      groove.v[c] = g * k * k * k * (far + i / d > 18 ? 0.6 : 1);
    }
  }
  // The sweep over the forehead: a soft volume with four lit waves from the part to the temple.
  const sweep = grid(-15, -164, 38, 32, d, NaN);
  for (let j = 0; j < sweep.h; j++) {
    const y = sweep.y0 + (j + 0.5) / d;
    for (let i = 0; i < sweep.w; i++) {
      const x = sweep.x0 + (i + 0.5) / d;
      if (!inPoly(x, y, SW)) continue;
      const dd = polyDist(x, y, SW);
      sweep.v[j * sweep.w + i] = 2.4 * Math.sqrt(Math.min(1, dd / 2.4)) + 0.25 * Math.sqrt(dd);
    }
  }
  for (const [x0, y0, x1, y1, b] of SWEEP_WAVES) splatRidge(sweep, null, curve((t) => [x0 + (x1 - x0) * t + 0.5, y0 + (y1 - y0) * t - Math.sin(t * Math.PI) * b + 0.5], 24), 1.1, 1.6, 0);
  const out = { back, groove, sweep };
  hairGrids.set(d, out);
  return out;
}

/** The wig's back mass (behind the face); `lining`: the inside of the cap where the face was (the flying wig). */
function hairBack(p: HdPiece, M: Mats, tex: Texture | null, lining = false): void {
  const lin = lining
    ? p.tex((s) => {
        if (s.x < -9.5 || s.x > 24.5 || s.y < -156 || s.y > -104 || !inPoly(s.x, s.y, FP)) return;
        s.mat = M.lining;
        s.nx *= 0.2;
        s.ny *= 0.2;
        if (p.d >= 4 && (Math.floor(s.x * 2) + Math.floor(s.y * 2)) % 4 === 0 && hash2(Math.floor(s.x * 2), Math.floor(s.y * 2), 7) > 0.6) s.tone += 0.35;
      })
    : null;
  const G = hairGridsOf(p.d);
  const curl = p.tex((s) => {
    const g = sample(G.groove, s.x, s.y);
    if (g < 0) s.tone += g;
  });
  p.field(-47, -178, 90, 88, (x, y) => sample(G.back, x, y), { mat: M.hair, z: 0, tex: texs(curl, lin, tex) });
  // The wave tips at the shoulders: a lit curl end pointing down and out.
  for (const [x, y, o] of TIPS) p.cap(x + 0.5 - o * 1.4, y - 1.8, x + 0.5 - o * 0.2, y + 0.4, 1.3, 0.55, { mat: M.hair, z: 1.5, tone: 0.05 });
}

function hairFront(p: HdPiece, M: Mats, hatch: boolean, tex: Texture | null): void {
  const part = p.newPart();
  const G = hairGridsOf(p.d);
  p.field(-15, -164, 38, 32, (x, y) => sample(G.sweep, x, y), { mat: M.hair, z: 12, part, tex });
  p.blob(TP, 1.6, { mat: M.hair, z: 11.5, tex });
  // The part line: a short dark groove on the far side of the crown.
  p.shade(14, -161, 7, 8, (x, y) => (segDist(x, y, 15.5, -159.5, 19.5, -154.5)[0] < 0.4 ? -0.7 : 0), part);
  if (!hatch) {
    // The letter hatch shut: a thin seam in the crown, a lit lip under it.
    p.shade(-15, -164, 17, 10, (x, y) => {
      if (x < -14 || x > 1) return 0;
      const sy = -160.5 + ((x - 0.5 + 7) * (x - 0.5 + 7)) / 24;
      const e = y - sy;
      return Math.abs(e) < 0.32 ? -0.9 : e > 0.32 && e < 0.32 + 1 / p.d ? 0.3 : 0;
    });
    return;
  }
  // The lid flips up and back on its hinge; letters peek out of the slot.
  p.ell(-6.5, -161, 8.5, 3, { mat: M.ink, z: 13 });
  p.ell(-6.5, -160.7, 7.3, 1.9, { mat: M.hole, z: 13.2 });
  p.blob(cov([[-16, -161], [-23, -163], [-29, -169], [-28, -175], [-21, -174], [-14, -168], [-11, -163]]), 1.3, { mat: M.hair, z: 14, tone: 0.12 });
  p.cap(-14.5, -161.5, -25.5, -172.5, 0.7, 0.7, { mat: M.steel, z: 15 });
  p.ell(-15.5, -160.5, 1, 1, { mat: M.steel, z: 15.5 });
  // An envelope and a folded note with a red mark.
  const env = p.newPart();
  p.box(-12, -168, 8, 6, { mat: M.paper, z: 16, bevel: 0.5, part: env });
  p.shade(-12, -168, 8, 6, (x, y) => (segDist(x, y, -11.5, -167.5, -7.5, -164.8)[0] < 0.3 || segDist(x, y, -4.5, -167.5, -7.5, -164.8)[0] < 0.3 ? -0.6 : 0), env);
  p.box(-3, -170, 6, 6, { mat: M.paper, z: 16.4, bevel: 0.5, tone: -0.1 });
  p.box(-1, -168, 2, 2, { mat: M.enamel[0], z: 17, bevel: 0.4 });
}

/** The face plate height field: skin-tone enamel (brow ridge, sockets, nose, cheekbones, mouth, chin). */
function faceH(x: number, y: number): number {
  if (!inPoly(x, y, FP)) return NaN;
  const dd = polyDist(x, y, FP);
  const t = dd >= 3.5 ? 1 : dd / 3.5;
  let h = 3.5 * Math.sqrt(1 - (1 - t) * (1 - t));
  const e = ((x - 5) / 19) ** 2 + ((y + 131) / 27) ** 2;
  if (e < 1) h += 6 * Math.sqrt(1 - e);
  // Relief strong enough to turn the light (form, not a flat plate): brow ridge, deep sockets,
  // cheekbones, the nose ridge and tip, the lips' mound and a firm chin.
  h += 1.7 * gauss(x, y, 5, -139.6, 5, 1.1) + 1.2 * gauss(x, y, 17.8, -140.6, 2.8, 1.0);
  h -= 1.7 * gauss(x, y, 4.6, -134.8, 3.2, 1.5) + 1.25 * gauss(x, y, 17.6, -135.4, 2.1, 1.4);
  h += 1.4 * gauss(x, y, 0.2, -128.2, 4.6, 3.2) + 1.1 * gauss(x, y, 21.2, -130, 1.8, 3.2);
  const [nd, nt] = segDist(x, y, 13.8, -137.2, 16.3, -126.6);
  h += 4.4 * Math.exp(-((nd / 1.0) ** 2)) * (0.5 + 0.5 * nt);
  h += 2.8 * gauss(x, y, 16.3, -125.3, 1.5, 1.15);
  h += 1.3 * gauss(x, y, 12.2, -124.9, 1.15, 0.85);
  h += 1.3 * gauss(x, y, 14, -118.6, 5.4, 2.4);
  h -= 0.7 * gauss(x, y, 13.4, -114.4, 4.4, 0.9);
  h += 2.3 * gauss(x, y, 12.6, -110.2, 4, 2.2);
  return h;
}

/** The face plate, the near ear and the nose details (no expression: painted per frame). */
function facePlate(p: HdPiece, M: Mats, state: number): void {
  // The near ear (hair tucked behind it): a lit rim, the inner fold, the bowl.
  const ear = p.newPart();
  p.ell(-10, -127.5, 3, 5.5, { mat: M.skin, z: 2, part: ear });
  p.shade(-13, -133, 6, 11, (x, y) => {
    const q = Math.hypot((x + 9.6) / 1.7, (y + 127) / 3.4);
    if (q < 0.5) return -0.6;
    return q < 1 && q > 0.66 && x > -10.6 ? -0.35 : 0;
  }, ear);
  const face = p.newPart();
  p.field(-10, -156, 35, 52, faceH, { mat: M.skin, z: 4, part: face });
  // The shade under the nose tip, the nostril.
  p.shade(10, -126, 9, 4, (x, y) => {
    if (Math.hypot((x - 12.4) / 0.75, (y + 124.0) / 0.5) < 1) return -0.75;
    return y > -124.6 && y < -123.6 && x > 13.2 && x < 17.2 ? -0.3 : 0;
  }, face);
  // Panel seams by damage state (clean hairline cracks; the features stay whole).
  if (state > 0) {
    const cracks: Array<ReadonlyArray<Pt>> = [[[17, -149], [16, -148], [16, -147], [15, -146]]];
    if (state > 1) cracks.push([[-8, -129], [-8, -128], [-7, -127]], [[21, -122], [20, -121]], [[14, -149], [14, -148.4]]);
    for (const c of cracks) {
      const pts = c.map(([x, y]) => [x + 0.5, y + 0.5] as const);
      p.shade(-10, -156, 35, 52, (x, y) => {
        let best = Infinity;
        for (let i = 0; i + 1 < pts.length; i++) best = Math.min(best, segDist(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])[0]);
        return best < 0.5 / p.d + 0.1 ? -1.1 : best < 0.5 / p.d + 0.1 + 1 / p.d && x < pts[0][0] ? 0.3 : 0;
      }, face);
    }
  }
}

/** The steel skull: the back (behind the face plate) or the cap over the forehead (bald frames). */
function skull(p: HdPiece, M: Mats, front: boolean, tex: Texture | null): void {
  if (!front) {
    const part = p.newPart();
    p.ell(-2, -140, 15, 20, { mat: M.steel, z: -20, part, tex });
    p.shade(-15, -137, 9, 2, (x, y) => (Math.abs(y + 135.5) < 0.35 && x > -14 && x < -7 ? -0.7 : 0), part);
    return;
  }
  const seam = (x: number): number => -150 - (x - 4.5) / 7 + 0.5;
  const part = p.newPart();
  p.field(-16, -164.5, 39, 20, (x, y) => {
    const e = ((x - 3.5) / 19.5) ** 2 + ((y + 147) / 17) ** 2;
    if (e >= 1 || y > seam(x)) return NaN;
    return 6 * Math.sqrt(1 - e);
  }, { mat: M.steel, z: 10, part, tex });
  // Panel seams at 4×, two rivets.
  if (p.d >= 4) p.shade(-16, -164.5, 39, 20, (x, y) => (Math.abs(x - 3.5 + (y + 160) * 0.15) < 0.25 && y < seam(x) - 1.5 ? -0.6 : 0), part);
  for (const x of [-8, 15]) p.ell(x + 0.6, Math.round(seam(x) - 0.5) - 4 + 0.6, 1, 1, { mat: M.steel, z: 17 });
}

/** The round gold disc earring (ridged rings round a centre hole) on a short gold bar. */
function earring(p: HdPiece, M: Mats): void {
  p.cap(-10, -121.6, -10, -117.6, 0.95, 0.95, { mat: M.gold, z: 14 });
  const cx = -10.5;
  const cy = -113.5;
  p.field(cx - 3.6, cy - 3.6, 7.2, 7.2, (x, y) => {
    const q = Math.hypot(x - cx, y - cy);
    if (q > 3.55 || q < 0.75) return NaN;
    let h = 1.2 * Math.sqrt(1 - (q / 3.55) ** 2);
    if (p.d >= 4) h += 0.18 * Math.cos(q * 4.2);
    return h;
  }, { mat: M.gold, z: 15 });
}

/** A rendered layer (no outline) of the head's lit parts, in local coordinates (x0, y0 = its top-left). */
interface HeadBase {
  buf: PixelBuffer;
  x0: number;
  y0: number;
}

/** The union of the 1× rects of `frames` (local logical geometry). */
function unionGeom(frames: readonly Frame[]): FrameGeom {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const f of frames) {
    const g = geomOf(f);
    x0 = Math.min(x0, -g.ox);
    y0 = Math.min(y0, -g.oy);
    x1 = Math.max(x1, -g.ox + g.w);
    y1 = Math.max(y1, -g.oy + g.h);
  }
  return { w: x1 - x0, h: y1 - y0, ox: -x0, oy: -y0 };
}

/** The lit head without its expression: hair (or skull), face plate, ear, earring, wear by state. */
function headBase(g: FrameGeom, d: number, state: number, kind: 'hair' | 'hatch' | 'bald'): HeadBase {
  const p = new HdPiece(g, d);
  const M = mats(p);
  const wr = wear(p, [-30, -164, 58, 60], state, 31);
  if (kind === 'bald') skull(p, M, false, wr);
  else hairBack(p, M, wr);
  facePlate(p, M, state);
  if (kind === 'bald') skull(p, M, true, wr);
  else hairFront(p, M, kind === 'hatch', wr);
  earring(p, M);
  const buf = p.render({ outline: 'none', ao: 0.28, rimLight: 2, shadow: 0.24, shadowMax: 1.6 });
  return { buf, x0: -g.ox, y0: -g.oy };
}

// ------------------------------------------------------------------------------- expressions

/** Paint context of one head frame: the base colours and the painted overlay. */
interface Face {
  p: HdPiece;
  base: HeadBase;
  d: number;
  /** Base colour at local (x, y). */
  at(x: number, y: number): Color;
}

const SKIN_RAMPS: readonly Ramp[] = [R.skinA, HAIR];

/** Brows: strong, dark and arched (lit hairs on top, a near-black underside). */
function browsHd(F: Face, lift: number, drop: number): void {
  const make = (cols: ReadonlyArray<readonly [number, number, number]>, inner: (x: number) => number, innerRight: boolean): void => {
    const pts: Pt[] = cols.map(([x, top, n]) => [x + 0.5, top - lift + inner(x) + n / 2] as const);
    const half = cols.map(([, , n]) => (n > 1 ? 0.98 : 0.55));
    const cum = arcLen(pts);
    const x0 = pts[0][0] - 1.5;
    const x1 = pts[pts.length - 1][0] + 1.5;
    F.p.paint(x0, -147, x1 - x0, 12, (x, y) => {
      let best = Infinity;
      let k = 0;
      for (let i = 0; i + 1 < pts.length; i++) {
        const [dd, t] = segDist(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
        if (dd < best) {
          best = dd;
          k = i + t;
        }
      }
      const i0 = Math.floor(k);
      const hw = half[Math.min(half.length - 1, i0)] * (1 - (k - i0)) + half[Math.min(half.length - 1, i0 + 1)] * (k - i0);
      const s = cum[cum.length - 1] ? (cum[Math.min(cum.length - 1, i0)] + 0) / cum[cum.length - 1] : 0;
      // The tail tapers (outer end).
      const taper = innerRight ? Math.min(1, 0.55 + s * 1.4) : Math.min(1, 0.55 + (1 - s) * 1.4);
      if (best > hw * taper) return 0;
      // Across the brow: lit hairs on top, the mid, a near-black underside.
      const ci = Math.min(pts.length - 2, Math.max(0, i0));
      const ny = y - (pts[ci][1] + (pts[ci + 1][1] - pts[ci][1]) * (k - ci));
      const v = ny / (hw * taper);
      if (v > 0.38) return R.ink[1];
      if (v < -0.42 && F.d >= 4 && hash2(Math.floor(x * 2.5), 1, 5) > 0.35) return HAIR[3];
      return HAIR[2];
    }, 1e6);
  };
  make(BROW_NEAR, (x) => (x >= 7 ? drop : x >= 5 ? drop >> 1 : 0), true);
  make(BROW_FAR, (x) => (x <= 15 ? drop : 0), false);
}

/** An almond eye: x0 < x1 the corners, `outerLeft`: the near eye (outer corner at the left). */
interface Eye {
  x0: number;
  x1: number;
  outerLeft: boolean;
  /** The corner line. */
  yc: number;
  up: number;
  low: number;
  ix: number;
  iy: number;
  ir: number;
  lash: number;
  flick: readonly [number, number, number, number];
}

function eyeOpenHd(F: Face, e: Eye): void {
  const w = e.x1 - e.x0;
  F.p.paint(e.x0 - 3.5, e.yc - 5, w + 7, 9, (x, y) => {
    // The outer flick (a tapered stroke).
    const [fd, ft] = segDist(x, y, e.flick[0], e.flick[1], e.flick[2], e.flick[3]);
    if (fd < 0.62 - ft * 0.42) return R.ink[0];
    const t = (x - e.x0) / w;
    if (t < 0 || t > 1) return 0;
    const sn = Math.sin(Math.PI * t);
    const outer = e.outerLeft ? 1 - t : t;
    const yU = e.yc - e.up * Math.pow(sn, 0.7) + (outer - 0.5) * 0.25;
    const yL = e.yc + e.low * Math.pow(sn, 0.9);
    const lw = 0.5 + (e.lash - 0.5) * Math.pow(outer, 1.3);
    if (y >= yU - lw && y < yU) return R.ink[0];
    if (y >= yU && y <= yL) {
      const iq = Math.hypot(x - e.ix, y - e.iy);
      if (iq < e.ir) {
        // Iris: a dark rim, warm brown, lighter at the lower opposite side; pupil; catchlight.
        if (Math.hypot(x - (e.ix - e.ir * 0.42), y - (e.iy - e.ir * 0.42)) < 0.36 + 0.2 / F.d) return R.snow[6];
        if (iq < e.ir * 0.42) return R.ink[0];
        if (iq > e.ir - 0.45 / F.d - 0.2) return R.brown[1];
        if (y < yU + 0.55) return R.brown[2];
        return x - e.ix + (y - e.iy) > 0.4 ? R.brown[5] : R.brown[3];
      }
      if (y < yU + 0.5) return R.stone[4];
      return outer > 0.55 ? R.stone[6] : R.snow[5];
    }
    // The lower lid: liner on the outer half, a soft lid line on the inner half.
    if (y > yL && y <= yL + 0.5) return outer > 0.5 ? R.brown[3] : step(F.at(x, y), 1, SKIN_RAMPS);
    // The lid crease above.
    const yCr = yU - lw - 1.2;
    if (Math.abs(y - yCr) < 0.3 && t > 0.12 && t < 0.88) return step(F.at(x, y), 1, SKIN_RAMPS);
    return 0;
  });
}

function eyeClosedHd(F: Face, e: Eye): void {
  const w = e.x1 - e.x0;
  F.p.paint(e.x0 - 3, e.yc - 4, w + 6, 7, (x, y) => {
    const t = (x - e.x0) / w;
    if (t < -0.15 || t > 1.12) return 0;
    const tt = Math.max(0, Math.min(1, t));
    const outer = e.outerLeft ? 1 - tt : tt;
    const yC = e.yc + 0.55 * Math.sin(Math.PI * tt) + 0.5;
    const lw = 0.45 + 0.35 * outer;
    if (y >= yC - lw * 0.5 && y < yC + lw * 0.5 && t >= -0.05 && t <= 1.05) return R.ink[0];
    // Lashes: short ink ticks under the lid line, at 4×.
    if (F.d >= 4 && y >= yC && y < yC + 0.7 && t > 0.1 && t < 0.9 && Math.floor(x * 2) % 2 === 0) return R.ink[1];
    const yCr = e.yc - e.up * 0.6;
    if (Math.abs(y - yCr) < 0.3 && t > 0.15 && t < 0.85) return step(F.at(x, y), 1, SKIN_RAMPS);
    return 0;
  });
}

function eyeDizzyHd(F: Face, cx: number, cy: number): void {
  const b = 0.95;
  F.p.paint(cx - 3, cy - 3, 6, 6, (x, y) => {
    const q = Math.hypot(x - cx, y - cy);
    if (q > 2.5) return 0;
    if (q > 2.5 - 0.5 / F.d - 0.12) return R.stone[3];
    const a = Math.atan2(y - cy, x - cx) / (Math.PI * 2) + 0.5;
    const k = Math.round(q / b - a);
    const dd = Math.abs(q - b * (k + a));
    return dd < 0.18 + 0.25 / F.d ? R.ink[0] : R.snow[5];
  });
}

/** The two eyes for a look (−1 up) and narrowing (the shout). */
function eyesOpenHd(F: Face, look: number, narrow: boolean): void {
  const n = narrow ? -135 : -136;
  const f = n - 1;
  const up = look < 0 ? -0.55 : 0;
  eyeOpenHd(F, {
    x0: 0.6,
    x1: 8.6,
    outerLeft: true,
    yc: n + 1.8,
    up: narrow ? 1.0 : 1.5,
    low: 1.3,
    ix: 5,
    iy: n + 1.95 + up,
    ir: 1.75,
    lash: 1.4,
    flick: [1.0, n + 1.1, -1.6, n - 0.7],
  });
  eyeOpenHd(F, {
    x0: 15.2,
    x1: 20.6,
    outerLeft: false,
    yc: f + 1.85,
    up: narrow ? 0.85 : 1.25,
    low: 1.1,
    ix: 17.7,
    iy: f + 1.95 + up,
    ir: 1.45,
    lash: 1.15,
    flick: [20.2, f + 1.1, 22.0, f - 0.6],
  });
}

function eyesClosedHd(F: Face): void {
  eyeClosedHd(F, { x0: 0.6, x1: 8.6, outerLeft: true, yc: -134.4, up: 1.2, low: 1, ix: 0, iy: 0, ir: 0, lash: 1, flick: [0, 0, 0, 0] });
  eyeClosedHd(F, { x0: 15.2, x1: 20.6, outerLeft: false, yc: -135.4, up: 1, low: 1, ix: 0, iy: 0, ir: 0, lash: 1, flick: [0, 0, 0, 0] });
}

/** Mouth: glossy red lips. kind 0 the closed confident smile, 1 flat, 2 the firm shout, 3 wobbly. */
function mouthHd(F: Face, kind: number): void {
  if (kind === 2) {
    // A firm open "GESLOTEN!": an even mouth, the upper teeth, stern but not a scream.
    F.p.paint(8, -122.5, 13, 9, (x, y) => {
      const e = ((x - 14.5) / 5.6) ** 2 + ((y + 118.4) / 2.7) ** 2;
      const lipU = y < -119.6 && y > -121.7;
      if (e < 1) {
        if (y < -119.9) return lipU ? (y < -120.9 ? R.red[3] : R.red[2]) : R.ink[0];
        if (y < -118.8 && x > 10.6 && x < 18.4) return Math.abs(((x - 10.6) % 1.3) - 1.25) < 0.08 && F.d >= 4 ? R.snow[3] : R.snow[5];
        if (y > -117.3 && x > 11 && x < 18) return R.red[2];
        return R.ink[0];
      }
      // The lower lip under the opening.
      const el = ((x - 14.5) / 4.6) ** 2 + ((y + 115.4) / 1.6) ** 2;
      if (el < 1 && y > -116.4) return y < -115.4 ? (x > 12.4 && x < 14.4 ? R.red[6] : R.red[5]) : R.red[4];
      if (Math.hypot(x - 7.6, y + 119.6) < 0.45) return step(F.at(x, y), 1, SKIN_RAMPS);
      return 0;
    });
    return;
  }
  // The seam (the line between the lips), continuous: smile corners turn up, the far one higher.
  const seam = (x: number): number => {
    if (kind === 1) return x < 16 ? -117.5 : -118.3;
    if (kind === 3) return -117.4 - (x >= 16 ? 0.8 : 0) + 0.45 * Math.sin(x * 1.6);
    const t = (x - 8.5) / 11;
    return -117.0 + 0.35 * Math.sin(Math.PI * Math.min(1, Math.max(0, t))) - (t < 0.12 ? (0.12 - t) * 5 : 0) - (t > 0.8 ? (t - 0.8) * 7 : 0);
  };
  const upperH = (x: number): number => (kind === 0 ? 1.2 + 1.0 * Math.exp(-((x - 13.6) ** 2) / 2.2) + 0.9 * Math.exp(-((x - 15.6) ** 2) / 1.6) - 0.35 * Math.exp(-((x - 14.6) ** 2) / 0.25) : 0.85);
  const lowerH = (x: number): number => (kind === 0 ? 1.0 + 1.3 * Math.exp(-((x - 13.2) ** 2) / 7) : 1.1);
  F.p.paint(7, -123, 15, 10, (x, y) => {
    if (x >= 8.3 && x <= 20) {
      const s = seam(x);
      if (Math.abs(y - s) < 0.26 + 0.12 / F.d) return R.red[0];
      const uh = upperH(x);
      if (y < s && y > s - uh) return y < s - uh + 0.45 ? R.red[4] : R.red[3];
      const lh = lowerH(x);
      if (x >= 9.2 && x <= 19 && y > s && y < s + lh) {
        const v = (y - s) / lh;
        if (kind === 0 && v > 0.15 && v < 0.55 && x > 11.6 && x < 14.4) return F.d >= 4 && v < 0.35 && x > 12.2 && x < 13.2 ? R.red[7] : R.red[6];
        return v > 0.72 ? R.red[4] : R.red[5];
      }
    }
    if (kind !== 0) return 0;
    // Smile corners, the smile line from the near nose wing, the far crease, the chin crease.
    if (Math.hypot(x - 7.6, y + 118.5) < 0.42 || Math.hypot(x - 20.5, y + 119.6) < 0.42) return step(F.at(x, y), 1, SKIN_RAMPS);
    const nl = segDist(x, y, 9.6, -123.6, 7.0, -121.0)[0];
    const nl2 = segDist(x, y, 7.0, -121.0, 6.6, -119.4)[0];
    if (Math.min(nl, nl2) < 0.3) return step(F.at(x, y), 1, SKIN_RAMPS);
    if (segDist(x, y, 21.5, -121.6, 21.3, -120.2)[0] < 0.28) return step(F.at(x, y), 1, SKIN_RAMPS);
    if (segDist(x, y, 12.4, -111.5, 14.8, -111.5)[0] < 0.28) return step(F.at(x, y), 1, SKIN_RAMPS);
    return 0;
  });
}

/** Head frames: 0 smile, 1 hatch open (looks up), 2 shout, 3 blink / powered off, 4 bald + off, 5 bald + dizzy. */
export function headHd(state: number, d: number): Frame[] {
  const lo = lowFrames(`${ART}/head-${state}`);
  const ug = unionGeom(lo);
  const bases = new Map<string, HeadBase>();
  const baseOf = (kind: 'hair' | 'hatch' | 'bald'): HeadBase => {
    let b = bases.get(kind);
    if (!b) {
      b = headBase(ug, d, state, kind);
      bases.set(kind, b);
    }
    return b;
  };
  return lo.map((f, i) => {
    const g = geomOf(f);
    const base = baseOf(i >= 4 ? 'bald' : i === 1 ? 'hatch' : 'hair');
    const p = new HdPiece(g, d);
    p.c.image(base.buf, p.cx(base.x0, base.y0), p.cy(base.x0, base.y0), { z: 0 });
    const F: Face = {
      p,
      base,
      d,
      at: (x, y) => base.buf.get(Math.floor((x - base.x0) * d), Math.floor((y - base.y0) * d)),
    };
    if (i === 0) {
      browsHd(F, 0, 0);
      eyesOpenHd(F, 0, false);
      mouthHd(F, 0);
    } else if (i === 1) {
      browsHd(F, 1, 0);
      eyesOpenHd(F, -1, false);
      mouthHd(F, 0);
    } else if (i === 2) {
      browsHd(F, 0, 2);
      eyesOpenHd(F, 0, true);
      mouthHd(F, 2);
    } else if (i === 5) {
      browsHd(F, 1, 0);
      eyeDizzyHd(F, 4.5, -133.5);
      eyeDizzyHd(F, 17.5, -134.5);
      mouthHd(F, 3);
    } else {
      // Frame 3 is also the idle blink (mayor.ts): only the eyes change, the smile stays.
      browsHd(F, 0, 0);
      eyesClosedHd(F);
      mouthHd(F, i === 3 ? 0 : 1);
    }
    return p.frame({ outline: 'A', ao: 0, sep: false, clean: false });
  });
}

/** The wig alone (death: it flies off), turned in WIG_STEPS steps of 45° about its anchor. */
export function wigHd(d: number): Frame[] {
  return lowFrames(`${ART}/wig`).map((f, k) => {
    const p = new HdPiece(geomOf(f), d, { anchor: WIG_ANCHOR, angle: (k * Math.PI) / 4, margin: 2 });
    const M = mats(p);
    hairBack(p, M, null, true);
    const G = hairGridsOf(d);
    p.field(-15, -164, 38, 32, (x, y) => sample(G.sweep, x, y), { mat: M.hair, z: 12 });
    p.blob(TP, 1.6, { mat: M.hair, z: 11.5 });
    return p.frame(RENDER);
  });
}

// ---------------------------------------------------------------------------------------------
// Spring, floor shadow, lash
// ---------------------------------------------------------------------------------------------

/** A coil spring `h` px tall (bottom anchor): silver wire, the front turns lit, the back turns in shade. */
export function springHd(d: number): Frame[] {
  return lowFrames(`${ART}/spring`).map((f, i) => {
    const h = SPRING_H[i];
    const p = new HdPiece(geomOf(f), d);
    const M = mats(p);
    const n = Math.max(4, h);
    const run: Pt[] = [];
    let front = true;
    const flush = (): void => {
      if (run.length > 1) p.stroke(run.slice(), 0.75, 0.75, { mat: front ? M.silver : M.steelDark, z: front ? 3 : 0 });
      run.length = 0;
    };
    for (let k = 0; k <= h * 4; k++) {
      const y = k / 4;
      const a = (y / n) * Math.PI * 5;
      const fr = Math.cos(a) > 0;
      const pt: Pt = [Math.sin(a) * 5 + 0.5, -y - 0.5];
      if (fr !== front && run.length > 0) {
        run.push(pt);
        flush();
      }
      front = fr;
      run.push(pt);
    }
    flush();
    return p.frame(RENDER);
  });
}

/** A floor shadow (the stamp target and the stomp landing): a red warning rim round a dark core. */
export function shadowHd(d: number): Frame[] {
  return lowFrames(`${ART}/shadow`).map((f, i) => {
    const w = SHADOW_W[i];
    const g = geomOf(f);
    const buf = new PixelBuffer(g.w * d, g.h * d);
    for (let Y = 0; Y < buf.h; Y++) {
      for (let X = 0; X < buf.w; X++) {
        // Buffer-relative logical position (the 1× ellipses are boxes from the buffer origin).
        const x = (X + 0.5) / d;
        const y = (Y + 0.5) / d;
        const inE = (bx: number, by: number, bw: number, bh: number): boolean => ((x - bx - bw / 2) / (bw / 2)) ** 2 + ((y - by - bh / 2) / (bh / 2)) ** 2 <= 1;
        let c: Color = 0;
        if (inE(0, 0, w, 9)) c = inE(0.6, 0.3, w - 1.2, 8.2) ? R.red[5] : R.red[4];
        if (inE(2, 1, w - 4, 7)) c = R.ink[1];
        if (inE(4, 2, w - 8, 5)) c = R.ink[0];
        if (c) buf.set(X, Y, c);
      }
    }
    return { buf, ox: g.ox, oy: g.oy, density: d };
  });
}

/** The lashing chain: 160 px of links with enamel shields, a big red shield at the tip; 2 frames. */
export function lashHd(d: number): Frame[] {
  return lowFrames(`${ART}/lash`).map((f, ph) => {
    const p = new HdPiece(geomOf(f), d);
    const M = mats(p);
    chainLinks(p, M, curve((t) => [t * 158 + 0.5, Math.sin((t * 158 + ph * 6) / 7) * 1.5 + 0.5], 120), 0, ph * 3);
    for (let x = 20; x < 150; x += 26) {
      const k = (x / 26) | 0;
      chainShield(p, M, x, Math.round(Math.sin((x + ph * 6) / 7) * 1.5) - 1, M.enamel[k % 4], 3);
    }
    // The tip: a big red shield in a silver rim with a white saltire.
    p.box(156, -4, 8, 8, { mat: M.silver, z: 4, bevel: 1, r: 0.8 });
    p.box(157, -3, 6, 6, { mat: M.enamel[0], z: 5, bevel: 0.8 });
    p.cap(158.4, -1.6, 161.6, 1.6, 0.5, 0.5, { mat: M.enamel[3], z: 6 });
    p.cap(161.6, -1.6, 158.4, 1.6, 0.5, 0.5, { mat: M.enamel[3], z: 6 });
    return p.frame(RENDER);
  });
}

/** Ids of every HD strip (tests and tools). */
export const HD_IDS: readonly string[] = [
  'legs',
  'body-0',
  'body-1',
  'body-2',
  'stamp-arm-0',
  'stamp-arm-1',
  'stamp-arm-2',
  'stamp-arm-gone',
  'chain-0',
  'chain-1',
  'chain-2',
  'chain-gone',
  'medallion-0',
  'medallion-1',
  'medallion-2',
  'head-0',
  'head-1',
  'head-2',
  'arm-back',
  'wig',
  'spring',
  'shadow',
  'lash',
].map((s) => `${ART}/${s}`);
