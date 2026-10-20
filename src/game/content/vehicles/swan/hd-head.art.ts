/**
 * SWAN-3 UHD art, part 2: the neck, the collar and the head at 2× / 4× (look.md §5.6, §5.7).
 *
 * - The neck: the six rings of the 1× rig (`neckParts`: the same Bézier, ring ends and widths) on
 *   the dark steel hose. Each ring is a collar of stamped tin feathers: a lit enamel cylinder whose
 *   base end breaks into three pointed feather tips that lie over the ring before it (alternate
 *   rings half a feather apart, like real plumage), each feather with its own lit and shaded side,
 *   a groove between feathers and, at 4×, a pressed quill. The Mute: black enamel with steel
 *   glints. The telescoping neck shows the hose between spread rings.
 * - The navy collar (a padded band, two gold studs), the head: an enamel dome (a lit egg), the
 *   navy face patch, the orange beak (round across, a raised gold breech ring, the steel nail,
 *   the bore; the closed bill's line at 4×), and the lens eye painted per expression (gold bezel
 *   lit from the upper left, glass lens, ink pupil with a catch light at 4×, the steel shutter lid
 *   with its ink lash line; squint, happy, dizzy in ink; the Mute's steel rim).
 */
import type { Color } from '../../../../engine/color';
import { PAL_HD } from '../../../../engine/palette-hd';
import type { Frame } from '../../../../engine/render';
import { inPoly, polyDist, type TexSample } from '../../../art/hd/index';
import type { NeckSpec, Ring, SwanColour, SwanEye } from './head.art';
import { FACE_PATCH, SOCKET_Y, domeLocal, headFrame, neckParts } from './head.art';
import { type D, SwanCanvas, Z, growPoly, setNormal, stud } from './hd-kit.art';
import type { Pt, V } from './kit.art';
import { OWN } from './kit.art';

const DOME_L = growPoly(domeLocal(), 0.45);
const PATCH_L = growPoly(FACE_PATCH, 0.45);

/** Feather tips per ring (across its width). */
const TIPS = 2;

/**
 * Draw the neck (hose, rings, collar) and the head with the socket at `socket` (body space);
 * returns the head centre (body space).
 */
export function drawNeckHd(sc: SwanCanvas, socket: Pt, spec: NeckSpec, colour: SwanColour, collar = true): V {
  const parts = neckParts(socket, spec);
  const mute = colour === 'mute';
  const hose = sc.part(OWN.neck);
  for (const [a, b] of parts.hose) sc.capsule(a, b, 1.5, 1.5, { mat: sc.mat('hose'), part: hose, z: Z.neck, tex: hoseTex(sc) });
  parts.rings.forEach((r, k) => drawRing(sc, r, k, mute));
  if (collar) drawCollarHd(sc, socket, parts.dir0);
  drawHeadHd(sc, parts.P3, spec, colour);
  return parts.P3;
}

/** Corrugation of the hose at 4× (fine ribs across it). */
function hoseTex(sc: SwanCanvas): ((s: TexSample) => void) | null {
  if (sc.d < 4) return null;
  return (s) => {
    if (((Math.floor(s.x * 2) + Math.floor(s.y * 2)) & 1) === 0) s.tone -= 0.12;
  };
}

/** One neck ring: a lit enamel cylinder whose base end breaks into feather tips. */
function drawRing(sc: SwanCanvas, ring: Ring, k: number, mute: boolean): void {
  const A = sc.T(ring.a);
  const B = sc.T(ring.b);
  let tx = B[0] - A[0];
  let ty = B[1] - A[1];
  const L = Math.hypot(tx, ty);
  if (L < 1e-6) {
    tx = 1;
    ty = 0;
  } else {
    tx /= L;
    ty /= L;
  }
  const nx = -ty;
  const ny = tx;
  const r = ring.w / 2;
  const tipLen = Math.min(2.2, r * 0.62);
  const phase = (k & 1) === 1 ? 0.5 : 0;
  const d = sc.d;
  const mat = sc.mat(mute ? 'black' : 'enamel');
  const pad = r + tipLen + 0.5;
  sc.c.plane(Math.min(A[0], B[0]) - pad, Math.min(A[1], B[1]) - pad, Math.abs(B[0] - A[0]) + 2 * pad, Math.abs(B[1] - A[1]) + 2 * pad, {
    mat,
    part: sc.part(OWN.neck),
    z: Z.neck + 2 + 8 * k,
    // Cheap reject: px farther than the radius from the axis (from the tips to the head end).
    mask: (x, y) => {
      const px = x - A[0];
      const py = y - A[1];
      let u = px * tx + py * ty;
      u = u < -tipLen ? -tipLen : u > L ? L : u;
      const ex = px - tx * u;
      const ey = py - ty * u;
      return ex * ex + ey * ey < r * r;
    },
    tex: (s) => {
      const px = s.x - A[0];
      const py = s.y - A[1];
      const u = px * tx + py * ty;
      const v = px * nx + py * ny;
      const q = Math.abs(v) / r;
      if (q >= 1) {
        s.cut = true;
        return;
      }
      if (u > L && (u - L) * (u - L) + v * v > r * r) {
        s.cut = true;
        return;
      }
      // The feather across the ring: f 0..1 inside one feather (0.5 = its middle).
      const p = ((v / r + 1) / 2) * TIPS + phase;
      const f = p - Math.floor(p);
      const w = 2 * f - 1;
      const prof = 1 - Math.abs(w);
      // Feather tips past the base end (foreshortened at the sides of the cylinder).
      const side = Math.sqrt(1 - q * q);
      if (u < 0) {
        const reach = tipLen * Math.pow(prof, 0.55) * (0.45 + 0.55 * side);
        if (-u > reach) {
          s.cut = true;
          return;
        }
      }
      // Cylinder across the neck, each feather a shallow ridge, the tips rolled toward the base.
      const roll = u < 0.6 ? (u - 0.6) * 0.55 : 0;
      setNormal(s, nx * (v / r) * 0.95 + nx * w * 0.32 + tx * roll, ny * (v / r) * 0.95 + ny * w * 0.32 + ty * roll, side + 0.25);
      // The groove between two feathers, from the tips up the ring.
      if (Math.abs(w) > 0.84 && u < Math.min(L, 2.2)) s.tone -= 0.3;
      // A pressed quill down each feather at 4×.
      else if (d >= 4 && Math.abs(w) < 0.13 && u < Math.min(L, 2) && u > -tipLen * 0.6) s.tone -= 0.14;
    },
  });
}

/** The navy collar on the socket, across the neck's first direction `t` (two gold studs). */
export function drawCollarHd(sc: SwanCanvas, socket: Pt, t: Pt): void {
  const n: V = [-t[1], t[0]];
  const c: V = [socket[0] + t[0] * 0.5, socket[1] + t[1] * 0.5];
  const corner = (a: number, b: number): V => [c[0] + t[0] * a + n[0] * b, c[1] + t[1] * a + n[1] * b];
  const gold = sc.mat('gold');
  const studs = [-2.6, 2.6].map((k) => sc.T([c[0] + n[0] * k, c[1] + n[1] * k]));
  sc.blob([corner(-2.2, -4.2), corner(2.2, -4.2), corner(2.2, 4.2), corner(-2.2, 4.2)], 0.5, 0.9, {
    mat: sc.mat('navy'),
    part: sc.part(OWN.neck),
    z: Z.collar,
    bulge: 0.2,
    tex: (s) => {
      for (const [x, y] of studs) {
        if (stud(s, s.x - x, s.y - y, 0.62, gold)) return;
        const ex = s.x - x - 0.45;
        const ey = s.y - y - 0.45;
        if (ex * ex + ey * ey < 0.42) s.tone -= 0.3;
      }
      // A stitched seam along the band at 4×.
      if (sc.d >= 4) {
        const a = (s.x - sc.T(c)[0]) * t[0] + (s.y - sc.T(c)[1]) * t[1];
        if (Math.abs(Math.abs(a) - 1.45) < 0.13 && ((Math.floor((s.x * n[0] + s.y * n[1]) * 2.5) & 1) === 0)) s.tone -= 0.25;
      }
    },
  });
}

/**
 * The head with its centre at P3 (body space): enamel dome, face patch, beak, eye. Past −90°
 * she looks back (the head mirrored, the eye stays on top).
 */
export function drawHeadHd(sc: SwanCanvas, P3: Pt, spec: NeckSpec, colour: SwanColour): void {
  const { u, f, dn, loc } = headFrame(P3, spec);
  const mute = colour === 'mute';
  const [cx, cy] = sc.T(P3);
  // Canvas → head-local (x along the beak, y "down" on the head).
  const lx = (x: number, y: number): number => (x - cx) * u[0] + (y - cy) * u[1];
  const ly = (x: number, y: number): number => (x - cx) * dn[0] + (y - cy) * dn[1];
  const navy = sc.mat('navy');
  const patch = !mute && !spec.flop;
  const head = sc.part(OWN.head);
  const R = 3.6;
  sc.field(
    DOME_L.map(([x, y]) => loc(x, y)),
    0.5,
    (bx, by) => {
      const x = lx(bx + sc.ox, by + sc.oy);
      const y = ly(bx + sc.ox, by + sc.oy);
      if (!inPoly(x, y, DOME_L)) return NaN;
      const e = Math.min(1, polyDist(x, y, DOME_L) / R);
      return R * Math.sqrt(1 - (1 - e) * (1 - e));
    },
    {
      mat: sc.mat(mute ? 'black' : 'enamel'),
      part: head,
      z: Z.head,
      tex: patch
        ? (s) => {
            if (inPoly(lx(s.x, s.y), ly(s.x, s.y), PATCH_L)) s.mat = navy;
          }
        : null,
    },
  );
  drawBeakHd(sc, spec, loc, u, dn, lx, ly, mute);
  const e = loc(1, -1.5);
  paintEye(sc, [e[0] - 0.5, e[1] - 0.5], f, spec.eye ?? 'normal', mute);
}

/** The beak (= the gun barrel): one bill or two mandibles opened about the beak base. */
function drawBeakHd(
  sc: SwanCanvas,
  spec: NeckSpec,
  loc: (x: number, y: number) => V,
  u: V,
  dn: V,
  lx: (x: number, y: number) => number,
  ly: (x: number, y: number) => number,
  mute: boolean,
): void {
  const gap = spec.gap ?? (spec.flop ? 1 : 0);
  const open = gap > 0 ? Math.atan2(gap / 2, 8) : 0;
  const beak = sc.mat(mute ? 'black' : 'orange');
  const steel = sc.mat('steel');
  const gold = sc.mat('gold');
  const d = sc.d;
  const sides: ReadonlyArray<readonly [number, number, number]> = open === 0 ? [[0, -2, 2]] : [[-1, -2, 0.08], [1, -0.08, 2]];
  const box = [loc(2.5, -2.6), loc(12, -2.6), loc(12, 2.6), loc(2.5, 2.6)];
  for (const [side, y0, y1] of sides) {
    const a = side * open;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    sc.area(box, 1.5, {
      mat: beak,
      part: sc.part(OWN.head),
      z: Z.head + 4 + (side > 0 ? 1 : 0),
      tex: (s) => {
        const hx = lx(s.x, s.y);
        const hy = ly(s.x, s.y);
        // Into the mandible's own frame (rotated by its half of the opening about (3, 0)).
        const x = 3 + (hx - 3) * ca + hy * sa;
        const y = -(hx - 3) * sa + hy * ca;
        // Half width: 2 at the base (x 3) to 1 at the tip (x 11), half a px of cover, a round tip.
        const hw = (x <= 3 ? 2 : x >= 11 ? 1 : 2 - (x - 3) / 8) + 0.45;
        const tipR = x > 11 ? Math.sqrt(Math.max(0, 1 - ((x - 11) / 0.55) ** 2)) : 1;
        if (x < 3 || x > 11.55 || Math.abs(y) > hw * tipR || y < y0 - 0.45 || y > y1 + 0.45) {
          s.cut = true;
          return;
        }
        // Round across the bill, rolled at the tip.
        const v = y / hw;
        const along = x > 10.3 ? (x - 10.3) * 0.9 : 0;
        let ax = 0;
        if (x >= 3.75 && x <= 4.7) {
          // The raised gold breech ring.
          s.mat = gold;
          ax = (x - 4.22) * 1.9;
        } else if (x >= 9) s.mat = steel;
        setNormal(s, dn[0] * v * 0.8 + u[0] * (along + ax), dn[1] * v * 0.8 + u[1] * (along + ax), 1);
        // The bill's line (closed) and the bore at the tip.
        if (open === 0 && d >= 4 && x > 4.9 && x < 10.4 && Math.abs(y - 0.15) < 0.14) s.tone -= 0.4;
        if (open === 0 && x > 10.45 && Math.abs(y) < 0.36) s.fix = PAL_HD.ink[0];
      },
    });
  }
}

const GOLD = PAL_HD.gold;
const SNOW = PAL_HD.snow;
const STEEL = PAL_HD.steel;
const INK = PAL_HD.ink[0];

/** Pupil offsets (mirrored x: + = toward the beak) per expression. */
const PUPIL: Readonly<Partial<Record<SwanEye, readonly [number, number]>>> = {
  normal: [0.45, 0.45],
  'front-low': [0.45, 0.45],
  'back-low': [-0.45, 0.45],
  'back-high': [-0.45, -0.45],
  'front-high': [0.45, -0.45],
  wide: [0, 0],
  angry: [0.3, 0.55],
  half: [0.3, 0.6],
};

/** Distance from (x, y) to a polyline. */
function lineDist(x: number, y: number, pts: ReadonlyArray<readonly [number, number]>): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const vx = bx - ax;
    const vy = by - ay;
    const l2 = vx * vx + vy * vy;
    let t = l2 === 0 ? 0 : ((x - ax) * vx + (y - ay) * vy) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    best = Math.min(best, Math.hypot(x - ax - vx * t, y - ay - vy * t));
  }
  return best;
}

const SQUINT: ReadonlyArray<readonly [number, number]> = [[0.95, -1.35], [-0.85, 0], [0.95, 1.35]];

/**
 * The lens eye, painted (fixed colours): `e` = the centre of the 1× 4 × 4 eye box (body space),
 * `f` = 1 facing her way, −1 looking back.
 */
function paintEye(sc: SwanCanvas, e: Pt, f: number, eye: SwanEye, mute: boolean): void {
  const [ex, ey] = sc.T(e);
  const d = sc.d;
  const wide = eye === 'wide';
  const R = wide ? 2.55 : 2.05;
  const r = wide ? 1.75 : 1.2;
  const span = mute ? 3 : R + 0.2;
  const half = Math.max(0.25, 0.5 / d) + (d >= 4 ? 0.05 : 0);
  const skin = mute ? PAL_HD.black[4] : SNOW[5];
  sc.c.paint(ex - span, ey - span, 2 * span, 2 * span, (x, y): Color => {
    const sx = x - ex;
    const dy = y - ey;
    const mx = sx * f;
    const q = Math.hypot(sx, dy);
    // Light from the upper left, in screen space (−1 lit … 1 dark).
    const lit = q > 0 ? (sx + dy) / (q * 1.4142) : 0;
    if (mute && q >= R && q < R + 0.8) return lit < -0.2 ? STEEL[6] : lit < 0.35 ? STEEL[5] : STEEL[3];
    if (eye === 'happy') {
      // An ink arch.
      const a = Math.hypot(mx, dy - 1) - 1.45;
      return Math.abs(a) < half + 0.05 && dy < 0.55 ? INK : 0;
    }
    if (q >= R) return 0;
    if (eye === 'squint') return lineDist(mx, dy, SQUINT) < half + 0.05 ? INK : skin;
    if (eye === 'dizzy') {
      const th = Math.atan2(dy, mx) + Math.PI;
      for (let k = 0; k < 3; k++) {
        const want = 0.25 + 0.27 * (th + 2 * Math.PI * k);
        if (Math.abs(q - want) < half) return INK;
      }
      return skin;
    }
    // The lid (steel) and its ink lash line.
    let lidY = -Infinity;
    if (eye === 'blink') lidY = 0.5;
    else if (eye === 'half') lidY = -0.15;
    else if (eye === 'angry') lidY = -1.15 + 0.95 * ((mx + R) / (2 * R));
    if (dy < lidY) return dy < lidY - 1.2 || lit < -0.5 ? STEEL[6] : STEEL[5];
    if (dy < lidY + 0.42 + (d >= 4 ? 0 : 0.08)) return INK;
    if (q >= r) {
      // The gold bezel: a lit ring with a glint up left, the inner edge bevelled down.
      const gx = sx + R * 0.48;
      const gy = dy + R * 0.48;
      if (gx * gx + gy * gy < (d >= 4 ? 0.12 : 0.2)) return GOLD[7];
      if (q < r + 0.28 && d >= 4) return GOLD[2];
      return lit < -0.55 ? GOLD[6] : lit < 0.05 ? GOLD[5] : lit < 0.55 ? GOLD[4] : GOLD[3];
    }
    // The lens: glass, the ink pupil with its catch light.
    const pp = PUPIL[eye] ?? PUPIL.normal!;
    const px = mx - pp[0];
    const py = dy - pp[1];
    const pr = wide ? 0.62 : 0.56;
    if (px * px + py * py < pr * pr) {
      const cx = px + 0.2;
      const cy = py + 0.2;
      return d >= 4 && cx * f * cx * f + cy * cy < 0.04 ? SNOW[6] : INK;
    }
    if (q > r - 0.3 && lit > 0.3) return SNOW[4];
    return lit < -0.1 ? SNOW[6] : SNOW[5];
  });
}

/**
 * One HD neck frame in the 1× frame `lo`'s rectangle (anchor = the socket, the 1× points): the
 * collar, the neck and the head drawn natively at density d.
 */
export function renderNeckFrameHd(spec: NeckSpec, colour: SwanColour, d: D, lo: Frame): Frame {
  const sc = new SwanCanvas(lo.buf.w, lo.buf.h, d, lo.ox, lo.oy - SOCKET_Y);
  drawNeckHd(sc, [0, SOCKET_Y], spec, colour);
  return { buf: sc.render(), ox: lo.ox, oy: lo.oy, pts: lo.pts, density: d };
}
