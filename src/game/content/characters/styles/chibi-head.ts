/**
 * Art-direction trial `chibi` (chibi.ts): VINCENT's big round chibi head. A soft round skull in
 * three-quarter view (facing right), short dark-brown hair as a few big rounded clumps, big glossy
 * eyes with catchlights, the ONE raised eyebrow (over the near eye), a small lopsided smirk (the
 * back corner pulled up) and the heavy stubble as a soft cool shadow over the jaw.
 *
 * One drawer for every density: lit volumes on an HdCanvas (d 1 with PAL paints, d 2 / 4 with
 * PAL_HD paints); the face is fixed paint, hand-placed px at 1×. The head is rendered without an
 * outline (the body's warm outline wraps the whole figure) and cached per expression, density and
 * scale, so it is pixel-identical in every frame (no shimmer of the features).
 */
import type { Color } from '../../../../engine/color';
import type { PixelBuffer } from '../../../../engine/pixel';
import { HdCanvas, type TexSample } from '../../../art/hd';
import type { Expression } from '../../../art/humanoid';
import { faceInk, paint, toon, type FaceInk } from './chibi-paint';

/** Head ellipse (logical px at scale 1): centre (0, 0). */
export const HEAD = { rx: 8.5, ry: 8.0 } as const;
/** Half size of the head buffer at scale 1 (room for the hair clumps). */
const HALF = 11;

/** The hair cap's lower edge (head-local y) at head-local x: nape, over the ear, the sideburn, the forehead. */
const HAIR_EDGE: ReadonlyArray<readonly [number, number]> = [
  [-10, 4.4],
  [-4.7, 4.3],
  [-4.0, 0.4],
  [-1.3, -0.6],
  [-1.0, 1.9],
  [-0.2, 1.9],
  [0.3, -5.6],
  [3.2, -5.8],
  [10, -4.2],
];

function hairBottom(x: number): number {
  const e = HAIR_EDGE;
  if (x <= e[0][0]) return e[0][1];
  for (let i = 1; i < e.length; i++) {
    if (x <= e[i][0]) {
      const t = (x - e[i - 1][0]) / (e[i][0] - e[i - 1][0]);
      return e[i - 1][1] + (e[i][1] - e[i - 1][1]) * t;
    }
  }
  return e[e.length - 1][1];
}

export interface ChibiHead {
  buf: PixelBuffer;
  /** Logical size of the buffer (the head centre is its middle). */
  w: number;
  h: number;
}

const cache = new Map<string, ChibiHead>();

/** Small stable hash → 0..1. */
function h2(x: number, y: number, seed: number): number {
  let n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

/** The chibi head at density d, scale `scale` (1, or bigger for the Helium Head). */
export function chibiHead(expr: Expression, d: 1 | 2 | 4, scale = 1): ChibiHead {
  const key = `${expr}|${d}|${scale}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const half = Math.ceil(HALF * scale);
  const c = new HdCanvas(half * 2, half * 2, d);
  drawHead(c, expr, d, scale, half, half);
  const buf = c.render({ outline: 'none', ao: 0.22, sepZ: 0.4, clean: true, sep: d > 1 });
  const out: ChibiHead = { buf, w: half * 2, h: half * 2 };
  cache.set(key, out);
  return out;
}

/**
 * Stubble density (0..1) at head-local (x, y): a crescent along the jaw under the cheeks, the chin
 * and the upper lip round the mouth, fading out towards the sideburn.
 */
function stubble(x: number, y: number): number {
  const q = (x / HEAD.rx) ** 2 + (y / HEAD.ry) ** 2;
  const jaw = y > 0.4 ? Math.min(1, Math.max(0, (q - 0.3) / 0.2)) * Math.min(1, (y - 0.4) / 1.6) : 0;
  const mouth = Math.max(0, 1 - Math.hypot((x - 4.9) / 2.9, (y - 4.9) / 2.0));
  let rho = Math.max(jaw, Math.min(1, mouth * 1.8));
  // Towards the ear: only the jaw under it keeps the stubble.
  const cl = (v: number): number => Math.max(0, Math.min(1, v));
  if (x < -0.6) rho *= Math.max(cl((x + 1.5) / 0.9), cl((x + 4.2) / 1.2) * cl((y - 3.6) / 1.0));
  return rho;
}

/** A rotated ellipsoid (heightField): centre, radii, turn (deg, clockwise). */
function rotEll(c: HdCanvas, cx: number, cy: number, rx: number, ry: number, ang: number, o: { mat: number; part?: number; z?: number; tone?: number; round?: number }): void {
  const cs = Math.cos((ang * Math.PI) / 180);
  const sn = Math.sin((ang * Math.PI) / 180);
  const m = Math.max(rx, ry);
  const rz = Math.min(rx, ry) * (o.round ?? 1);
  c.heightField(cx - m, cy - m, 2 * m, 2 * m, (x, y) => {
    const lx = (x - cx) * cs + (y - cy) * sn;
    const ly = -(x - cx) * sn + (y - cy) * cs;
    const q = (lx / rx) ** 2 + (ly / ry) ** 2;
    return q > 1 ? NaN : rz * Math.sqrt(1 - q);
  }, { mat: o.mat, part: o.part, z: o.z, tone: o.tone });
}

interface HeadCtx {
  c: HdCanvas;
  d: number;
  s: number;
  ox: number;
  oy: number;
  ink: FaceInk;
  expr: Expression;
}

function drawHead(c: HdCanvas, expr: Expression, d: 1 | 2 | 4, s: number, ox: number, oy: number): void {
  const k: HeadCtx = { c, d, s, ox, oy, ink: faceInk(d), expr };
  const X = (x: number): number => ox + x * s;
  const Y = (y: number): number => oy + y * s;
  const skin = toon(c, paint('skin', d), { amb: 0.3, gain: 0.85, wrap: 0.35, spec: 0.12, shine: 16 });
  const stub = toon(c, paint('stubble', d), { amb: 0.3, gain: 0.85, wrap: 0.35, dither: 1e-6 });
  const hair = toon(c, paint('hair', d), { amb: 0.28, gain: 0.95, wrap: 0.25, spec: 0.35, shine: 20 });
  const face = c.newPart();

  // The skull, with the stubble (a material switch: no line between skin and stubble): a soft
  // density along the jaw and round the mouth, speckled hairs at HD, a ragged edge.
  const skullTex = (sm: TexSample): void => {
    const lx = (sm.x - ox) / s;
    const ly = (sm.y - oy) / s;
    const rho = stubble(lx, ly);
    if (rho > 0) {
      const r = d === 1 ? 0.5 : h2(sm.X, sm.Y, 7);
      if (rho > 0.5 + (r - 0.5) * 0.18) {
        sm.mat = stub;
        if (d >= 2 && h2(sm.X, sm.Y, 3) < (d >= 4 ? 0.34 : 0.24) * Math.min(1, rho * 1.3)) sm.fix = k.ink.stubbleDot;
      }
    }
    // The face turned to the viewer stays bright; only the far rim falls into the shade band.
    if (lx > 0) sm.tone += 0.06;
  };
  c.ellipsoid(X(0), Y(0), HEAD.rx * s, HEAD.ry * s, { mat: skin, part: face, z: 0, round: 0.85, tex: skullTex });
  // A small nose bump at the front contour.
  c.ellipsoid(X(8.25), Y(2.2), 1.0 * s, 0.9 * s, { mat: skin, part: face, z: 4.2 * s, round: 0.7, tone: 0.05 });
  // The ear, with its inner fold.
  const ear = c.newPart();
  c.ellipsoid(X(-2.4), Y(1.8), 1.45 * s, 1.95 * s, {
    mat: skin,
    part: ear,
    z: 7.0 * s,
    round: 0.8,
    tone: 0.05,
    tex: (sm) => {
      const u = (sm.x - X(-2.2)) / s;
      const v = (sm.y - Y(1.9)) / s;
      if (u * u / 0.45 + v * v / 1.3 < 1) sm.tone -= 0.32;
    },
  });

  // Hair: a short, smooth cap hugging the skull (its lower edge: the forehead, the sideburn, over
  // the ear, the nape), then a few big rounded clumps swept forward on top of it.
  const capPart = c.newPart();
  const capRx = HEAD.rx + 0.7;
  const capRy = HEAD.ry + 0.7;
  c.heightField(X(-capRx), Y(-capRy - 0.4), capRx * 2 * s, (capRy * 2 + 0.4) * s, (x, y) => {
    const lx = (x - ox) / s;
    const ly = (y - oy) / s;
    const q = (lx / capRx) ** 2 + ((ly + 0.3) / capRy) ** 2;
    if (q > 1 || ly > hairBottom(lx)) return NaN;
    return 5.0 * Math.sqrt(1 - q) * s;
  }, { mat: hair, part: capPart, z: 12 * s, tone: -0.04 });
  const clump = (x: number, y: number, rx: number, ry: number, ang: number, z: number, tone = 0): void => {
    rotEll(c, X(x), Y(y), rx * s, ry * s, ang, { mat: hair, z: (20 + z) * s, round: 0.75, tone });
  };
  clump(-5.7, 2.6, 2.4, 2.5, 10, 0); // the back of the head: two rounded locks
  clump(-6.3, -1.4, 2.6, 2.9, 20, 0.2);
  clump(-4.0, -5.5, 3.2, 2.6, -35, 0.4); // the crown
  clump(-0.4, -7.5, 3.3, 2.3, -10, 0.8);
  clump(3.3, -7.0, 3.0, 2.1, 12, 1.2, 0.03);
  clump(3.9, -6.0, 2.4, 1.5, 22, 2.2, 0.05); // the fringe: three rounded tufts swept forward
  clump(5.9, -4.9, 2.2, 1.45, 36, 2.6, 0.06);
  clump(7.4, -3.6, 1.65, 1.3, 46, 3.0, 0.08);

  // The hair's shine: a soft broken arc of the sheen tone over the lit crown (2× / 4×).
  const sheen = k.ink.shine;
  if (d > 1) {
    paintLocal(k, -8, -10, 12, 8, (x, y) => {
      const a = Math.atan2(y + 0.6, x + 0.4) / (Math.PI / 180);
      if (a < -158 || a > -92) return 0;
      const r = Math.hypot((x + 0.4) / 7.2, (y + 0.6) / 7.6);
      const w = 0.045 * Math.sin(((a + 158) / 66) * Math.PI);
      if (Math.abs(r - 1) > w) return 0;
      // Broken into three dashes along the clumps.
      const t = (a + 158) / 66;
      return (t > 0.08 && t < 0.3) || (t > 0.4 && t < 0.62) || (t > 0.72 && t < 0.9) ? sheen : 0;
    });
  }

  drawEyes(k);
  drawBrows(k);
  drawMouth(k);
  if (expr === 'happy' || expr === 'smile' || expr === 'shout') drawBlush(k);
}

// ------------------------------------------------------------------------------------ the face

const E1 = { x: 1.9, y: 0.9, rx: 1.42, ry: 2.15 };
const E2 = { x: 6.2, y: 0.8, rx: 1.08, ry: 2.02 };

type Px = (x: number, y: number) => Color;

/** Paint in head-local coordinates (logical, scale applied). */
function paintLocal(k: HeadCtx, x0: number, y0: number, w: number, h: number, fn: (lx: number, ly: number) => Color): void {
  const { c, s, ox, oy } = k;
  const f: Px = (x, y) => fn((x - ox) / s, (y - oy) / s);
  c.paint(ox + x0 * s, oy + y0 * s, w * s, h * s, f);
}

/** One 1× px at head-local integer offsets from the head centre (scale 1 only). */
function px1(k: HeadCtx, x: number, y: number, col: Color): void {
  k.c.dot(k.ox + x * k.s + 0.5, k.oy + y * k.s + 0.5, col);
}

function drawEyes(k: HeadCtx): void {
  const { expr, ink } = k;
  const closed = expr === 'blink' || expr === 'yawn';
  const happy = expr === 'happy';
  const squeeze = expr === 'hurt' || expr === 'soot';
  const dazed = expr === 'dazed';
  const wide = expr === 'panic' || expr === 'shout';
  if (k.d === 1 && k.s === 1) {
    drawEyes1x(k, closed, happy, squeeze, dazed, wide);
    return;
  }
  for (const [i, e] of [E1, E2].entries()) {
    const far = i === 1;
    if (closed || happy) {
      // A soft arc: down (closed) or up (happy), with lashes at the outer end.
      const bend = happy ? -0.75 : 0.55;
      paintLocal(k, e.x - e.rx - 0.6, e.y - 1.6, e.rx * 2 + 1.2, 3.2, (x, y) => {
        const t = (x - e.x) / (e.rx + 0.35);
        if (Math.abs(t) > 1) return 0;
        const cy = e.y + 0.2 + bend * (1 - t * t);
        return Math.abs(y - cy) < 0.3 ? ink.lid : 0;
      });
      continue;
    }
    if (squeeze) {
      // > < : squeezed shut.
      const dir = far ? -1 : 1;
      paintLocal(k, e.x - e.rx - 0.4, e.y - 1.6, e.rx * 2 + 0.8, 3.2, (x, y) => {
        const t = (x - e.x) * dir;
        const cy = Math.abs(y - e.y);
        const line = (t + e.rx * 0.7) * 0.75;
        if (t < -e.rx * 0.9 || t > e.rx * 0.9) return 0;
        return Math.abs(cy - line) < 0.32 && cy < 1.3 ? ink.lid : 0;
      });
      continue;
    }
    const rx = e.rx * (wide ? 1.08 : 1);
    const ry = e.ry * (wide ? 1.08 : 1);
    paintLocal(k, e.x - rx - 0.7, e.y - ry - 0.8, rx * 2 + 1.4, ry * 2 + 1.4, (x, y) => {
      const u = (x - e.x) / rx;
      const v = (y - e.y) / ry;
      const q = u * u + v * v;
      // The upper lid: a thick dark arc over the eye, a small flick at the outer (back) corner.
      const lidY = e.y - ry * Math.sqrt(Math.max(0, 1 - u * u)) - 0.05;
      if (Math.abs(u) <= 1.08 && y > lidY - 0.42 && y < lidY + 0.32 && v < 0.1) return ink.lid;
      if (!far && u < -0.85 && u > -1.5 && v > -0.95 && v < -0.45 && y - (e.y - ry * 0.75) < (-0.85 - u) * 0.9) return ink.lid;
      if (q > 1) return 0;
      if (dazed) {
        // A dizzy swirl.
        const r = Math.sqrt(q);
        const a = Math.atan2(v, u);
        const sp = (r * 3.2 + a / Math.PI) % 1;
        return sp < 0.45 ? ink.irisDeep : ink.white;
      }
      if (expr === 'panic') {
        // Wide white eyes, tiny pupils.
        const pr = Math.hypot(u * rx - 0.1, v * ry - 0.1);
        if (pr < 0.55) return ink.irisDeep;
        return ink.white;
      }
      // Catchlights: a big one up front-left, a small one low right.
      const c1 = Math.hypot((x - (e.x - rx * 0.32)) / (rx * 0.42), (y - (e.y - ry * 0.4)) / (ry * 0.27));
      if (c1 < 1) return ink.catch;
      const c2 = Math.hypot((x - (e.x + rx * 0.38)) / (rx * 0.2), (y - (e.y + ry * 0.45)) / (ry * 0.13));
      if (c2 < 1) return ink.catch;
      // The iris: deep at the top, a warm glow at the bottom; a darker pupil core.
      const pu = Math.hypot(u * 1.25, (v + 0.05) * 1.05);
      if (pu < 0.42 && v < 0.35) return ink.irisDeep;
      if (v > 0.45) return ink.irisLow;
      if (v < -0.35) return ink.irisDeep;
      return ink.iris;
    });
  }
}

/** The 1× eyes: hand-placed px (2 × 3 near, 1–2 × 3 far) with a catchlight. */
function drawEyes1x(k: HeadCtx, closed: boolean, happy: boolean, squeeze: boolean, dazed: boolean, wide: boolean): void {
  const { ink } = k;
  // Near eye: columns 1, 2; far eye: columns 5, 6; rows −1 (the lid) .. 2.
  if (closed) {
    for (const [x, y] of [[0, 1], [1, 1], [2, 1], [5, 1], [6, 1]] as const) px1(k, x, y, ink.lid);
    return;
  }
  if (happy) {
    for (const [x, y] of [[0, 1], [1, 0], [2, 0], [3, 1], [5, 1], [6, 0], [7, 1]] as const) px1(k, x, y, ink.lid);
    return;
  }
  if (squeeze) {
    for (const [x, y] of [[1, -1], [2, 0], [1, 1], [6, -1], [5, 0], [6, 1]] as const) px1(k, x, y, ink.lid);
    return;
  }
  const top = wide ? -2 : -1;
  for (const x0 of [1, 5]) {
    px1(k, x0, top, ink.lid);
    px1(k, x0 + 1, top, ink.lid);
    for (let y = top + 1; y <= 2; y++) {
      const low = y === 2;
      px1(k, x0, y, low ? ink.irisLow : ink.irisDeep);
      px1(k, x0 + 1, y, low ? ink.irisLow : y === top + 1 ? ink.irisDeep : ink.iris);
    }
    if (dazed) px1(k, x0, top + 2, ink.white);
    else if (k.expr === 'panic') {
      px1(k, x0, top + 1, ink.white);
      px1(k, x0, top + 2, ink.white);
      px1(k, x0 + 1, 2, ink.white);
    } else px1(k, x0, top + 1, ink.catch);
  }
  // The lash flick at the near eye's back corner.
  px1(k, 0, top, ink.lid);
}

function drawBrows(k: HeadCtx): void {
  const { expr, ink } = k;
  // The near brow is THE raised one (calm faces): a high, round arch. The far brow sits low and flat.
  const calm = expr === 'normal' || expr === 'blink' || expr === 'chew' || expr === 'smile';
  let liftN = calm ? -1.45 : -0.3;
  let archN = calm ? 1.0 : 0.35;
  let liftF = calm ? 0.15 : -0.3;
  let tiltF = calm ? 0.25 : 0;
  if (expr === 'shout' || expr === 'panic') {
    liftN = -0.9;
    liftF = -0.7;
    archN = 0.5;
  }
  if (expr === 'hurt' || expr === 'soot') {
    liftN = -0.4;
    tiltF = -0.5;
  }
  if (expr === 'happy') {
    liftN = -1.0;
    archN = 0.6;
    liftF = -0.4;
  }
  if (k.d === 1 && k.s === 1) {
    // 1×: the raised near brow two px over the eye top, an arch; the far brow one row lower.
    const yN = calm || expr === 'happy' ? -4 : -3;
    px1(k, 0, yN + 1, ink.brow);
    px1(k, 1, yN, ink.brow);
    px1(k, 2, yN, ink.brow);
    px1(k, 3, yN + 1, ink.brow);
    const yF = expr === 'shout' || expr === 'panic' ? -3 : -2;
    px1(k, 5, yF, ink.brow);
    px1(k, 6, yF, ink.brow);
    if (!calm) px1(k, 7, yF, ink.brow);
    return;
  }
  const brow = (x0: number, len: number, y0: number, arch: number, tilt: number, w0: number): void => {
    paintLocal(k, x0 - 0.4, y0 - 2.2, len + 0.8, 3.4, (x, y) => {
      const t = (x - x0) / len;
      if (t < 0 || t > 1) return 0;
      const cy = y0 - Math.sin(t * Math.PI) * arch + (t - 0.5) * tilt;
      const w = w0 * (0.55 + 0.45 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.6 + 0.35));
      const dy = y - cy;
      if (Math.abs(dy) >= w) return 0;
      return k.d >= 4 && dy < -w * 0.3 && t > 0.2 && t < 0.8 ? ink.browHi : ink.brow;
    });
  };
  brow(E1.x - 1.5, 2.9, E1.y - 2.75 + liftN, archN, 0, 0.6);
  brow(E2.x - 1.05, 2.0, E2.y - 2.55 + liftF, 0.15, tiltF, 0.4);
}

function drawMouth(k: HeadCtx): void {
  const { expr, ink } = k;
  const mx = 4.9;
  const my = 4.7;
  const open = expr === 'shout' || expr === 'panic' || expr === 'yawn' || expr === 'hurt' || expr === 'soot';
  if (k.d === 1 && k.s === 1) {
    if (open) {
      const big = expr === 'yawn';
      px1(k, 4, 4, ink.mouth);
      px1(k, 5, 4, ink.mouth);
      px1(k, 4, 5, big ? ink.mouth : ink.tongue);
      px1(k, 5, 5, ink.tongue);
      if (big) px1(k, 4, 6, ink.tongue);
      return;
    }
    if (expr === 'happy' || expr === 'smile') {
      px1(k, 3, 4, ink.lip);
      px1(k, 4, 5, ink.lip);
      px1(k, 5, 5, ink.lip);
      px1(k, 6, 4, ink.lip);
      return;
    }
    if (expr === 'dazed') {
      px1(k, 3, 5, ink.lip);
      px1(k, 4, 4, ink.lip);
      px1(k, 5, 5, ink.lip);
      return;
    }
    // The smirk: the back corner up.
    px1(k, 3, 4, ink.lip);
    px1(k, 4, 5, ink.lip);
    px1(k, 5, 5, ink.lip);
    px1(k, 6, 5, ink.lip);
    return;
  }
  if (open) {
    const rx = expr === 'yawn' ? 1.15 : 1.3;
    const ry = expr === 'yawn' ? 1.5 : expr === 'hurt' || expr === 'soot' ? 0.75 : 1.1;
    const cy = my + 0.2;
    paintLocal(k, mx - rx - 0.5, cy - ry - 0.5, rx * 2 + 1, ry * 2 + 1, (x, y) => {
      const u = (x - mx) / rx;
      const v = (y - cy) / ry;
      // A rounded D: flat top, round bottom.
      const q = u * u + (v < 0 ? v * v * 0.5 : v * v);
      if (q > 1 || v < -1) return 0;
      if (q > 0.72) return ink.lip;
      if (expr === 'shout' && v < -0.35 && k.d >= 4) return ink.teeth;
      if (v > 0.25 && Math.abs(u) < 0.6) return ink.tongue;
      return ink.mouth;
    });
    return;
  }
  if (expr === 'happy' || expr === 'smile') {
    paintLocal(k, mx - 1.9, my - 1.2, 3.8, 2.6, (x, y) => {
      const t = (x - mx) / 1.5;
      if (Math.abs(t) > 1) return 0;
      const cy = my - 0.35 + (1 - t * t) * 0.8;
      if (Math.abs(y - cy) < 0.24) return ink.lip;
      if (expr === 'happy' && y > cy - 0.9 + 0.24 && y < cy && Math.abs(t) < 0.75 && y > my - 0.35 + Math.abs(t) * 0.2) return ink.mouth;
      return 0;
    });
    return;
  }
  if (expr === 'dazed' || expr === 'chew') {
    paintLocal(k, mx - 1.6, my - 1, 3.2, 2, (x, y) => {
      const t = (x - mx) / 1.25;
      if (Math.abs(t) > 1) return 0;
      const cy = my + Math.sin(t * Math.PI * 1.5) * (expr === 'dazed' ? 0.3 : 0.12);
      return Math.abs(y - cy) < 0.22 ? ink.lip : 0;
    });
    return;
  }
  // The smirk: a short line, the back (left) corner pulled up hard, a dimple tick there.
  paintLocal(k, mx - 2.0, my - 1.6, 3.6, 2.6, (x, y) => {
    const t = (x - (mx - 1.55)) / 2.6;
    if (t < 0 || t > 1) return 0;
    const cy = my + 0.25 - (1 - t) * (1 - t) * 1.05 + t * 0.05;
    const w = 0.27 + 0.07 * Math.sin(t * Math.PI);
    if (Math.abs(y - cy) < w) return ink.lip;
    return 0;
  });
  // The dimple at the raised corner.
  paintLocal(k, mx - 2.3, my - 1.4, 0.8, 0.9, (x, y) => (Math.abs(x - (mx - 1.95)) < 0.16 && Math.abs(y - (my - 0.95)) < 0.3 ? ink.lip : 0));
}

/** Soft rosy cheeks (happy faces): a few px of the low skin tone under the near eye. */
function drawBlush(k: HeadCtx): void {
  const { ink } = k;
  if (k.d === 1) return;
  paintLocal(k, 0.2, 2.6, 3.6, 1.4, (x, y) => {
    const q = ((x - 1.9) / 1.5) ** 2 + ((y - 3.25) / 0.55) ** 2;
    if (q > 1) return 0;
    // Hatched: three short diagonal strokes.
    const t = (x - y * 0.6) * 1.6;
    return t - Math.floor(t) < 0.32 ? ink.blush : 0;
  });
}
